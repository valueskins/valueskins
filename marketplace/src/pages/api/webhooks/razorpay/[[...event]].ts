import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db-pool';
import { logAudit } from '@/lib/escrow';
import { verifyWebhookSignature, isKnownRazorpayIp } from '@/lib/razorpay';
import { handleWorkflowPaymentEvent } from '@/lib/deal-payment-events';

// The signature covers the exact bytes Razorpay sent. Re-serialising a parsed
// body (JSON.stringify(req.body)) does not reproduce them — key order,
// whitespace and number formatting can all differ — so the raw body is read
// here and parsed after verification.
export const config = {
  api: { bodyParser: false },
};

const MAX_BODY_BYTES = 1_000_000;

function readRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not set — webhook disabled');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  let rawBody: string;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Could not read body' });
  }

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.error('Razorpay webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (process.env.RAZORPAY_WEBHOOK_IP_CHECK === 'true') {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || '';
    if (!isKnownRazorpayIp(ip)) {
      console.error(`Webhook from unknown IP: ${ip}`);
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const event = body?.event;
  const payload = body?.payload;

  if (!event || !payload) return res.status(400).json({ error: 'Missing event or payload' });

  try {
    // ---- Build-spec deal workflow (commission / advance / final) ----------
    // Runs first and independently: a workflow order id never matches an
    // escrow order id, so the two paths cannot both claim the same payment.
    if (
      event === 'payment.captured' ||
      event === 'payment.authorized' ||
      event === 'payment.failed'
    ) {
      const orderId = payload.payment?.entity?.order_id || payload.payment?.order_id;
      const paymentId = payload.payment?.entity?.id || payload.payment?.id;
      if (orderId) {
        await handleWorkflowPaymentEvent({
          event,
          orderId,
          paymentId: paymentId || '',
          failureReason:
            payload.payment?.entity?.error_description ||
            payload.payment?.error_description ||
            '',
        });
      }
    }

    // Payout completed
    if (event === 'payout.processed') {
      const transferId = payload.payout?.id || payload.payout?.entity?.id;
      if (transferId) {
        await query(
          `UPDATE milestone_releases SET status = 'completed', completed_at = NOW()
           WHERE razorpay_transfer_id = $1 AND status = 'processing'`,
          [transferId]
        );
        await query(
          `UPDATE payouts SET status = 'CONFIRMED', updated_at = NOW()
           WHERE razorpay_payout_id = $1 AND status = 'PENDING'`,
          [transferId]
        );

        const release = await query(
          'SELECT deal_id FROM milestone_releases WHERE razorpay_transfer_id = $1',
          [transferId]
        );
        if (release.rows[0]) {
          await logAudit(release.rows[0].deal_id, null, 'system', 'payout_completed', {
            transferId, status: 'completed',
          });
        }
      }
    }

    // Payout failed
    if (event === 'payout.failed') {
      const transferId = payload.payout?.id || payload.payout?.entity?.id;
      const errorMsg = payload.payout?.failure_reason || 'Unknown failure';
      const errorCode = payload.payout?.failure_code || 'UNKNOWN';

      if (transferId) {
        const release = await query(
          `UPDATE milestone_releases SET status = 'failed', failure_reason = $2, retry_count = retry_count + 1
           WHERE razorpay_transfer_id = $1 RETURNING deal_id`,
          [transferId, errorMsg]
        );

        await query(
          `UPDATE payouts SET status = 'FAILED', failure_reason = $2, updated_at = NOW()
           WHERE razorpay_payout_id = $1`,
          [transferId, errorMsg]
        );

        await query(
          `INSERT INTO payout_retry_log (milestone_release_id, attempt, error_message, error_code)
           SELECT id, retry_count, $2, $3 FROM milestone_releases WHERE razorpay_transfer_id = $1`,
          [transferId, errorMsg, errorCode]
        );

        if (release.rows[0]) {
          await logAudit(release.rows[0].deal_id, null, 'system', 'payout_failed', {
            transferId, error: errorMsg, errorCode,
          });
        }
      }
    }

    // Payment captured — escrow fallback; primary flow is confirmEscrowFunding
    if (event === 'payment.captured') {
      const orderId = payload.payment?.entity?.order_id || payload.payment?.order_id;
      const paymentId = payload.payment?.entity?.id || payload.payment?.id;

      if (orderId && paymentId) {
        const escrow = await query(
          `SELECT deal_id FROM deal_escrow WHERE razorpay_order_id = $1 AND status = 'pending'`,
          [orderId]
        );

        if (escrow.rows[0]) {
          const dealId = escrow.rows[0].deal_id;
          await query(
            `UPDATE deal_escrow SET razorpay_payment_id = $2, status = 'completed', funded_at = NOW()
             WHERE razorpay_order_id = $1`,
            [orderId, paymentId]
          );

          await logAudit(dealId, null, 'system', 'escrow_funded_webhook', { orderId, paymentId });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Razorpay webhook error:', error);
    // A 500 makes Razorpay retry, which the idempotent stage confirmation
    // handles safely.
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
