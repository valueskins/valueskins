import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db-pool';
import { getSessionUserId } from '@/lib/session';
import { verifySignature } from '@/lib/razorpay';
import { VALUESKIN_PRICE_CENTS } from '@/lib/pricing';
import { syncSkinPurchase } from '@/lib/skin-sync';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookie = req.headers.cookie || '';
  const userId = await getSessionUserId(cookie);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    profession_id,
    profession_name,
    tier = 1,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !profession_id) {
    return res.status(400).json({ error: 'Missing payment verification fields' });
  }

  try {
    const valid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) {
      return res.status(400).json({ error: 'Payment verification failed, signature mismatch' });
    }

    let valueskinCode: string;
    let attempts = 0;
    do {
      const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
      const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
      valueskinCode = `VS-${randomStr}-${timestamp}`;
      const check = await query('SELECT 1 FROM user_stickers WHERE valueskin_code = $1', [valueskinCode]);
      if (check.rows.length === 0) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique valueskin code' });
    }

    await query(
      `INSERT INTO user_stickers (user_id, profession_id, tier, payment_method, amount_paid_cents, is_active, valueskin_code, razorpay_order_id, razorpay_payment_id)
       VALUES ($1, $2, $3, 'razorpay', $4, TRUE, $5, $6, $7)`,
      [
        userId,
        profession_id,
        tier,
        VALUESKIN_PRICE_CENTS,
        valueskinCode,
        razorpay_order_id,
        razorpay_payment_id,
      ]
    );

    await syncSkinPurchase({
      userId,
      professionId: profession_id,
      professionName: profession_name || valueskinCode,
      valueskinCode,
      tier,
    });

    return res.status(200).json({
      success: true,
      message: 'Value scheme purchased successfully',
      valueskinCode,
    });
  } catch (err: any) {
    console.error('Confirm payment error:', err);
    return res.status(500).json({ error: err.message || 'Failed to confirm payment' });
  }
}
