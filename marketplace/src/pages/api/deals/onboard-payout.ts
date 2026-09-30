import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { requireUser } from '@/lib/auth/require-user';
import { query } from '@/lib/db-pool';
import { createContact, createFundAccount } from '@/lib/razorpay';
import { savePayoutAccountReference } from '@/lib/escrow';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const {
    accountHolderName,
    accountNumber,
    ifsc,
    beneficiaryName,
  } = req.body;

  if (!accountHolderName || typeof accountHolderName !== 'string' || accountHolderName.length > 255) {
    return res.status(400).json({ error: 'accountHolderName required (max 255 chars)' });
  }
  if (!accountNumber || typeof accountNumber !== 'string' || !/^\d{9,18}$/.test(accountNumber)) {
    return res.status(400).json({ error: 'accountNumber required (9-18 digits)' });
  }
  if (!ifsc || typeof ifsc !== 'string' || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return res.status(400).json({ error: 'ifsc required (e.g. HDFC0001234)' });
  }

  // Get user info for contact
  const userRow = await query(
    'SELECT display_name, username, email FROM users WHERE id = $1',
    [userId]
  );
  if (!userRow.rows[0]) return res.status(404).json({ error: 'User not found' });

  const userName = userRow.rows[0].display_name || userRow.rows[0].username || accountHolderName;
  const userEmail = userRow.rows[0].email;

  // Step 1: Create or get Razorpay contact
  const contact = await createContact({
    name: userName,
    email: userEmail || undefined,
    type: 'vendor',
    reference_id: `user_${userId}`,
  });

  if (!contact.success) {
    throw new Error('Failed to create Razorpay contact');
  }

  // Step 2: Create fund account (Razorpay stores bank details, we keep only reference)
  const fundAccount = await createFundAccount({
    contactId: contact.data.id,
    accountType: 'bank_account',
    bankAccount: {
      name: accountHolderName,
      accountNumber,
      ifsc,
    },
  });

  if (!fundAccount.success) {
    throw new Error('Failed to create Razorpay fund account');
  }

  // Step 3: Save only the reference — no bank details
  const existing = await query(
    'SELECT COUNT(*) as cnt FROM creator_payout_accounts WHERE creator_id = $1',
    [userId]
  );
  const isDefault = parseInt(existing.rows[0]?.cnt || '0') === 0;

  await savePayoutAccountReference({
    creatorId: userId,
    paymentProvider: 'razorpay',
    payoutAccountId: fundAccount.data.id,
    // Razorpay does not independently verify a new fund account, and its
    // response has no `status` field, so a freshly linked account is always
    // pending until a payout to it succeeds.
    verificationStatus: 'pending',
    lastFourDigits: accountNumber.slice(-4),
    beneficiaryName: beneficiaryName || accountHolderName,
  });

  if (isDefault) {
    await query(
      `UPDATE creator_payout_accounts SET is_default = TRUE
       WHERE creator_id = $1 AND payout_account_id = $2`,
      [userId, fundAccount.data.id]
    );
  }

  return res.status(200).json({
    success: true,
    payoutAccountId: fundAccount.data.id,
    verificationStatus: 'pending',
    isDefault,
    message: 'Bank account linked. Payouts will be sent to this account once verified.',
  });
}

export default withApiHandler(handler, {
  rateLimit: { maxRequests: 5, windowMs: 60000 },
});
