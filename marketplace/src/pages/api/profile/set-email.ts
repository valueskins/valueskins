// POST /api/profile/set-email — collects the email a user must provide before
// entering the marketplace, and sends the confirmation link.
// GET  /api/profile/set-email — the caller's onboarding readiness.
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';
import { sendEmail } from '@/lib/email';

// Deliberately simple and linear: the nested-quantifier patterns often used
// for email validation backtrack catastrophically on hostile input.
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]{1,63}(\.[^\s@.]{1,63}){1,4}$/;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.valueskins.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  if (req.method === 'GET') return status(userId, res);
  if (req.method === 'POST') return setEmail(req, res, userId);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function status(userId: string, res: NextApiResponse) {
  const row = await queryOne(
    `SELECT email, email_verified, bank_details_completed, role
       FROM users WHERE id = $1`,
    [userId]
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  const u = row as any;
  return res.status(200).json({
    email: u.email || '',
    email_verified: !!u.email_verified,
    bank_details_completed: !!u.bank_details_completed,
    role: u.role,
    // The client uses this to decide which onboarding step to show.
    next_step: !u.email
      ? 'email'
      : !u.email_verified
        ? 'verify_email'
        : !u.bank_details_completed && u.role === 'creator'
          ? 'bank_details'
          : 'ready',
  });
}

async function setEmail(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const raw = (req.body || {}).email;
  if (typeof raw !== 'string') return res.status(400).json({ error: 'Invalid request' });

  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }

  try {
    const current = await queryOne(
      'SELECT email, email_verified FROM users WHERE id = $1',
      [userId]
    );
    const cur = current as any;

    // Already verified on this address: nothing to do, and re-sending would let
    // a session be used to spam the address.
    if (cur?.email === email && cur?.email_verified) {
      return res.status(200).json({ email, email_verified: true, next_step: 'bank_details' });
    }

    // One account per email address: invoices and the ADP are delivered here.
    const taken = await queryOne(
      'SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 AND is_deleted = FALSE',
      [email, userId]
    );
    if (taken) {
      return res.status(409).json({ error: 'That email address is already in use' });
    }

    // Changing the address clears the verified flag: otherwise a user could
    // point a verified account at an address they do not control.
    await query(
      `UPDATE users SET email = $2, email_verified = FALSE WHERE id = $1`,
      [userId, email]
    );

    const token = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO email_verifications (user_id, token, expires_at)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
      [userId, token, new Date(Date.now() + TOKEN_TTL_MS)]
    );

    // /settings/email is the page that consumes the token. This used to point
    // at /verify-email, which does not exist, so every confirmation link 404'd.
    const link = `${APP_URL}/settings/email?token=${token}`;
    await sendEmail({
      to: email,
      userId: Number(userId),
      type: 'email_verification',
      // The template reads `verify_url`. This passed `link`, `verificationLink`
      // and `url` — none of which it reads — so the button's href was the
      // literal string "undefined" and every confirmation link 404'd.
      data: { verify_url: link },
    });

    return res.status(200).json({
      email,
      email_verified: false,
      next_step: 'verify_email',
    });
  } catch (err) {
    console.error('[set-email] failed', err);
    return res.status(500).json({ error: 'Could not save email address' });
  }
}
