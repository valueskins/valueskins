// POST /api/profile/setup-payout — one-time payout details entry.
//
// Replaces the unauthenticated /api/profile/complete-bank-details, which took
// creator_id from the request body and so let any caller set any user's payout
// destination. Identity here comes only from the session.
//
// We never store the account number or IFSC: they go straight to Razorpay and
// we keep only the returned fund_account_id plus a masked tail for display.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';
import { createContact, createFundAccount } from '@/lib/razorpay';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^[0-9]{6,20}$/;
const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const user = await queryOne(
    `SELECT id, email, email_verified, display_name, username,
            bank_details_completed, razorpay_contact_id
       FROM users WHERE id = $1`,
    [userId]
  );
  if (!user) return res.status(404).json({ error: 'Not found' });
  const u = user as any;

  // Spec: email first, then bank details.
  if (!u.email) return res.status(400).json({ error: 'Add your email address first' });
  if (!u.email_verified) {
    return res.status(400).json({ error: 'Verify your email address first' });
  }

  // Spec: entered once. Changing them later is a support action, so that a
  // hijacked session cannot silently redirect a creator's earnings.
  if (u.bank_details_completed) {
    return res.status(409).json({
      error: 'Payout details are already on file. Contact support to change them.',
    });
  }

  const { payment_method, upi_id, account_number, ifsc, account_holder_name } =
    req.body || {};

  if (payment_method !== 'upi' && payment_method !== 'bank') {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const holder =
    typeof account_holder_name === 'string' && account_holder_name.trim()
      ? account_holder_name.trim().slice(0, 120)
      : u.display_name || u.username || `User ${userId}`;

  let fundAccountPayload: Parameters<typeof createFundAccount>[0];
  let maskedTail = '';

  if (payment_method === 'upi') {
    if (typeof upi_id !== 'string' || !UPI_RE.test(upi_id)) {
      return res.status(400).json({ error: 'Invalid UPI ID' });
    }
    maskedTail = upi_id.slice(upi_id.indexOf('@'));
    fundAccountPayload = {
      contact_id: '',
      account_type: 'vpa',
      vpa: { address: upi_id },
    } as any;
  } else {
    if (typeof account_number !== 'string' || !ACCOUNT_RE.test(account_number)) {
      return res.status(400).json({ error: 'Invalid account number' });
    }
    const ifscUpper = typeof ifsc === 'string' ? ifsc.toUpperCase() : '';
    if (!IFSC_RE.test(ifscUpper)) {
      return res.status(400).json({ error: 'Invalid IFSC code' });
    }
    maskedTail = `****${account_number.slice(-4)}`;
    fundAccountPayload = {
      contact_id: '',
      account_type: 'bank_account',
      bank_account: {
        name: holder,
        ifsc: ifscUpper,
        account_number,
      },
    } as any;
  }

  try {
    let contactId: string = u.razorpay_contact_id || '';
    if (!contactId) {
      const contactRes = await createContact({
        name: holder,
        email: u.email,
        type: 'employee',
        reference_id: `user_${userId}`,
      } as any);
      if (!contactRes.success || !(contactRes.data as any)?.id) {
        console.error('[setup-payout] contact creation failed', contactRes.error);
        return res.status(502).json({ error: 'Could not register payout details' });
      }
      contactId = String((contactRes.data as any).id);
    }

    const fundRes = await createFundAccount({
      ...fundAccountPayload,
      contact_id: contactId,
    } as any);
    if (!fundRes.success || !(fundRes.data as any)?.id) {
      console.error('[setup-payout] fund account creation failed', fundRes.error);
      return res.status(502).json({ error: 'Could not register payout details' });
    }
    const fundAccountId = String((fundRes.data as any).id);

    await query(
      `UPDATE users
          SET razorpay_contact_id = $2,
              razorpay_fund_account_id = $3,
              bank_account_ref = $4,
              bank_details_completed = TRUE
        WHERE id = $1`,
      [userId, contactId, fundAccountId, maskedTail]
    );

    return res.status(200).json({
      bank_details_completed: true,
      payment_method,
      masked: maskedTail,
    });
  } catch (err) {
    console.error('[setup-payout] failed', err);
    return res.status(500).json({ error: 'Could not save payout details' });
  }
}
