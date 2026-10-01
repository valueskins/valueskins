// POST /api/profile/setup-payout — one-time payout details entry.
// GET  /api/profile/setup-payout — what we hold, safe fields only.
//
// WE DO NOT STORE BANK DETAILS.
// The account number / UPI address exists in this handler's memory for the
// duration of one request. It goes to Razorpay, Razorpay returns an opaque
// `fa_...` token, and the token plus a masked hint ("****4321") is all that is
// written to our database. Nothing here is ever logged. Razorpay is the
// custodian of record, which keeps payment instruments out of our database and
// keeps that liability with a PCI-DSS audited processor.
//
// This replaces /api/profile/complete-bank-details, which took `creator_id`
// from the request body with no authentication — any caller could point any
// creator's earnings at their own account — and which called SDK methods
// (razorpay.contacts, razorpay.fundAccounts) that do not exist at runtime.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';
import {
  ensureContact,
  tokeniseAccount,
  PayoutError,
  type PayoutMethod,
} from '@/lib/razorpay-payouts';

// Razorpay is the authority on these formats (verified: it rejects a bad IFSC
// with "The ifsc must be 11 characters" and a bad VPA with "Invalid VPA").
// Checking here first avoids a network round trip for obvious typos and keeps
// malformed input from reaching an external service at all.
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^[0-9]{6,20}$/;
const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,119}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  if (req.method === 'GET') return readStatus(userId, res);
  if (req.method === 'POST') return setup(req, res, userId);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function readStatus(userId: string, res: NextApiResponse) {
  const row = await queryOne(
    `SELECT bank_details_completed, bank_account_ref, razorpay_fund_account_id
       FROM users WHERE id = $1`,
    [userId]
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  const u = row as any;
  return res.status(200).json({
    configured: !!u.bank_details_completed,
    // The masked hint only. There is nothing else to return: we hold no
    // account number to reveal even to its owner.
    display_hint: u.bank_account_ref || null,
    has_token: !!u.razorpay_fund_account_id,
  });
}

async function setup(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const user = await queryOne(
    `SELECT id, email, email_verified, display_name, username,
            bank_details_completed
       FROM users WHERE id = $1`,
    [userId]
  );
  if (!user) return res.status(404).json({ error: 'Not found' });
  const u = user as any;

  // Spec order: email, then confirm it, then bank details. The verified address
  // is where payout confirmations and the deal report go, so it must be proven
  // before earnings can be routed anywhere.
  if (!u.email) return res.status(400).json({ error: 'Add your email address first' });
  if (!u.email_verified) {
    return res.status(400).json({ error: 'Confirm your email address first' });
  }

  // Spec: entered once. Re-pointing a payout destination is the highest-value
  // action an attacker could take with a stolen session, so it is not an API
  // operation at all — changing it requires support.
  if (u.bank_details_completed) {
    return res.status(409).json({
      error: 'Payout details are already on file. Contact support to change them.',
    });
  }

  const parsed = parseMethod(req.body || {}, u);
  if ('error' in parsed) {
    return res.status(400).json({ error: parsed.error, field: parsed.field });
  }

  try {
    // Idempotent on reference_id `user_<id>`, so a retry after a failure here
    // reuses the same contact rather than accumulating duplicates.
    const { contactId } = await ensureContact({
      userId,
      name: parsed.method.holderName,
      email: u.email,
    });

    // The one moment the real details leave this process. What comes back
    // holds no recoverable account data.
    const token = await tokeniseAccount(contactId, parsed.method);

    // Conditional write: whichever concurrent request gets here first wins and
    // the other is refused. Without the WHERE clause two simultaneous submits
    // could both write, and the later one would silently take over the payout
    // destination.
    const updated = await query(
      `UPDATE users
          SET razorpay_contact_id = $2,
              razorpay_fund_account_id = $3,
              bank_account_ref = $4,
              bank_details_completed = TRUE
        WHERE id = $1 AND bank_details_completed = FALSE
        RETURNING id`,
      [userId, contactId, token.fundAccountId, token.displayHint]
    );

    if ((updated.rows || []).length === 0) {
      // Another request completed setup while this one was talking to
      // Razorpay. The token we just made is unreferenced; Razorpay allows
      // several fund accounts per contact, so the orphan is inert and no
      // cleanup call is needed.
      return res.status(409).json({
        error: 'Payout details were already saved. Contact support to change them.',
      });
    }

    return res.status(200).json({
      configured: true,
      method: token.method,
      display_hint: token.displayHint,
    });
  } catch (err) {
    if (err instanceof PayoutError) {
      // Razorpay's validation message names the offending field but never
      // echoes its value, so it is safe to pass to the user.
      if (err.kind === 'validation') {
        return res.status(400).json({ error: err.message, field: err.field });
      }
      if (err.kind === 'transient') {
        return res.status(503).json({
          error: 'The payment provider is unavailable. Please try again shortly.',
        });
      }
      // auth / not_enabled / unknown are our configuration problems, not the
      // user's; details are in the server log, not the response.
      console.error('[setup-payout] provider error', { kind: err.kind, userId });
      return res.status(502).json({ error: 'Could not register payout details' });
    }
    // Deliberately does not log the error object: an exception raised mid-call
    // can carry the request payload, and that payload is the account number.
    console.error('[setup-payout] unexpected failure', {
      userId,
      message: err instanceof Error ? err.message : 'unknown',
    });
    return res.status(500).json({ error: 'Could not save payout details' });
  }
}

function parseMethod(
  body: any,
  user: any
): { method: PayoutMethod } | { error: string; field?: string } {
  const { payment_method, upi_id, account_number, ifsc, account_holder_name } = body;

  const rawHolder =
    typeof account_holder_name === 'string' && account_holder_name.trim()
      ? account_holder_name.trim()
      : user.display_name || user.username || '';
  const holderName = String(rawHolder).slice(0, 120);
  if (!NAME_RE.test(holderName)) {
    return { error: 'Enter the account holder name as it appears on the account', field: 'account_holder_name' };
  }

  if (payment_method === 'upi') {
    if (typeof upi_id !== 'string' || !UPI_RE.test(upi_id.trim())) {
      return { error: 'Enter a valid UPI ID, for example name@bank', field: 'upi_id' };
    }
    return { method: { kind: 'upi', vpa: upi_id.trim(), holderName } };
  }

  if (payment_method === 'bank') {
    const acct = typeof account_number === 'string' ? account_number.trim() : '';
    if (!ACCOUNT_RE.test(acct)) {
      return { error: 'Enter a valid account number', field: 'account_number' };
    }
    const code = typeof ifsc === 'string' ? ifsc.trim().toUpperCase() : '';
    if (!IFSC_RE.test(code)) {
      return { error: 'Enter a valid 11-character IFSC code', field: 'ifsc' };
    }
    return {
      method: { kind: 'bank', accountNumber: acct, ifsc: code, holderName },
    };
  }

  return { error: 'Choose either UPI or bank transfer', field: 'payment_method' };
}
