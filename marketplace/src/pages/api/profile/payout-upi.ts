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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  if (req.method === 'GET') {
    const row = await queryOne(
      `SELECT payout_vpa, payout_vpa_share_consent_at, email_verified
         FROM users WHERE id = $1`,
      [userId]
    );
    const u = row as any;
    if (!u) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({
      // Masked even to its owner: there is no reason for this response to carry
      // the full handle, and it is enough to recognise which one is saved.
      masked: u.payout_vpa ? maskVpa(u.payout_vpa) : null,
      configured: !!u.payout_vpa,
      consented: !!u.payout_vpa_share_consent_at,
      email_verified: !!u.email_verified,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { upi_id, share_consent } = req.body || {};

  const vpa = typeof upi_id === 'string' ? upi_id.trim() : '';
  if (!isValidVpa(vpa)) {
    // Named explicitly, because someone who pasted an account number needs to
    // know this field is not for that.
    return res.status(400).json({
      error: 'Enter a UPI ID, for example name@okhdfcbank. Bank account numbers are not accepted.',
      field: 'upi_id',
    });
  }
  if (share_consent !== true) {
    return res.status(400).json({
      error: 'Brands you are confirmed on need your UPI ID to pay you, so this has to be agreed.',
      field: 'share_consent',
    });
  }

  const user = await queryOne('SELECT email, email_verified FROM users WHERE id = $1', [userId]);
  const u = user as any;
  if (!u?.email) return res.status(400).json({ error: 'Add your email address first' });
  if (!u.email_verified) return res.status(400).json({ error: 'Confirm your email address first' });

  try {
    await query(
      `UPDATE users
          SET payout_vpa = $2,
              payout_vpa_share_consent_at = NOW(),
              bank_details_completed = TRUE
        WHERE id = $1`,
      [userId, vpa]
    );
    // Returns the masked form only; the caller just sent the value and does not
    // need it echoed back.
    return res.status(200).json({ configured: true, masked: maskVpa(vpa) });
  } catch (err: any) {
    // The CHECK constraint rejects anything that is not name@psp.
    if (err?.code === '23514') {
      return res.status(400).json({ error: 'That is not a valid UPI ID', field: 'upi_id' });
    }
    console.error('[payout-upi] save failed', { userId });
    return res.status(500).json({ error: 'Could not save your UPI ID' });
  }
}
