// GET  — the creator's saved UPI handle, masked.
// POST — save it, with explicit consent to show it to confirmed brands.
//
// UPI only. A brand paying directly needs a destination, and a UPI handle is a
// receive-only identifier made to be shared — unlike an account number and
// IFSC, which are a fraud input and which this endpoint will not accept. The
// database CHECK on payout_vpa enforces the same shape, so an account number
// pasted here is refused twice.
//
// Consent is recorded as a timestamp rather than assumed: we disclose this to a
// brand, so we need a basis for doing so and a record of when it was given.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';
import { isValidVpa, maskVpa } from '@/lib/direct-payments';
import { sendEmail } from '@/lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  if (req.method === 'GET') {
    const row = await queryOne(
      `SELECT payout_vpa, payout_name, payout_vpa_share_consent_at, email_verified
         FROM users WHERE id = $1`,
      [userId]
    );
    const u = row as any;
    if (!u) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({
      // In full, to its owner only (this route answers for the session user and
      // nobody else). It was masked here, which meant a creator could not check
      // what they had saved — and a typo in a UPI ID sends money to a stranger.
      upi_id: u.payout_vpa || null,
      account_name: u.payout_name || '',
      masked: u.payout_vpa ? maskVpa(u.payout_vpa) : null,
      configured: !!u.payout_vpa,
      consented: !!u.payout_vpa_share_consent_at,
      email_verified: !!u.email_verified,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { upi_id, share_consent, account_name } = req.body || {};

  // The name the bank has for this account. The brand compares it with what
  // their UPI app shows before paying, so it is required, and limited to what a
  // name can contain: it is rendered to another user and placed in a UPI link.
  const name = typeof account_name === 'string' ? account_name.trim().replace(/\s+/g, ' ') : '';
  if (!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(name)) {
    return res.status(400).json({
      error: 'Enter the name on your bank account, as your UPI app shows it.',
      field: 'account_name',
    });
  }

  const vpa = typeof upi_id === 'string' ? upi_id.trim() : '';
  if (!isValidVpa(vpa)) {
    // Named explicitly, because someone who pasted an account number needs to
    // know this field is not for that.
    return res.status(400).json({
      error: 'Enter a UPI ID, for example name@okhdfcbank. Bank account numbers are not accepted.',
      field: 'upi_id',
    });
  }
  const user = await queryOne('SELECT email, email_verified, payout_vpa, role FROM users WHERE id = $1', [userId]);
  const u = user as any;

  // A creator's UPI ID is shown to the brand that confirms them, so a creator
  // has to agree to that. A brand's is shown to nobody: there is nothing to
  // consent to, and no consent is recorded for it. The role is read from the
  // account, so a creator cannot skip the question by claiming to be a brand.
  const isCreator = u?.role !== 'brand';
  if (isCreator && share_consent !== true) {
    return res.status(400).json({
      error: 'Brands you are confirmed on need your UPI ID to pay you, so this has to be agreed.',
      field: 'share_consent',
    });
  }
  if (!u?.email) return res.status(400).json({ error: 'Add your email address first' });
  if (!u.email_verified) return res.status(400).json({ error: 'Confirm your email address first' });

  try {
    await query(
      `UPDATE users
          SET payout_vpa = $2,
              payout_name = $3,
              payout_vpa_share_consent_at = CASE WHEN $4 THEN NOW() ELSE NULL END,
              bank_details_completed = TRUE
        WHERE id = $1`,
      [userId, vpa, name, isCreator]
    );

    // Changing where money goes is the most valuable thing a stolen session can
    // do. It is allowed, because a creator who mistyped or switched banks must
    // be able to fix it, but never silently: the change is recorded and the
    // account's verified email is told at once. Both are best-effort and must
    // not undo a save that has already happened.
    const previous: string = u.payout_vpa || '';
    if (previous && previous !== vpa) {
      try {
        await query(
          `INSERT INTO audit_logs (operation, table_name, user_id, resource_id, old_values, new_values)
           VALUES ('UPDATE', 'users', $1, $2, $3, $4)`,
          [
            userId,
            String(userId),
            // Masked: the audit trail needs to show that it changed, not hold
            // a second copy of the handles.
            JSON.stringify({ payout_vpa: maskVpa(previous) }),
            JSON.stringify({ payout_vpa: maskVpa(vpa) }),
          ]
        );
      } catch {
        console.error('[payout-upi] audit write failed', { userId });
      }
      try {
        await sendEmail({
          to: u.email,
          userId: Number(userId),
          type: 'payout_changed',
          data: { masked: maskVpa(vpa) },
        });
      } catch {
        console.error('[payout-upi] change notice failed', { userId });
      }
    }

    return res.status(200).json({
      configured: true,
      upi_id: vpa,
      account_name: name,
      masked: maskVpa(vpa),
      changed: !!previous && previous !== vpa,
    });
  } catch (err: any) {
    // The CHECK constraint rejects anything that is not name@psp.
    if (err?.code === '23514') {
      return res.status(400).json({ error: 'That is not a valid UPI ID', field: 'upi_id' });
    }
    console.error('[payout-upi] save failed', { userId });
    return res.status(500).json({ error: 'Could not save your UPI ID' });
  }
}
