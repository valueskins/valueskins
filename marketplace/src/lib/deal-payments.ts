// Shared logic for the three brand-side payment stages (commission, advance,
// final). All three differ only in which stage they are, so the order creation,
// guard checks and confirmation live here once.
//
// Two rules hold throughout:
//   - the amount is always derived from the deal's stored budget, never read
//     from the request body;
//   - a stage that is already CONFIRMED is never charged again.
import { query, queryOne, transaction } from '@/lib/db-pool';
import { createOrder } from '@/lib/razorpay';
import {
  PAYMENT_ADVANCES_TO,
  PAYMENT_REQUIRES_STATUS,
  WORKFLOW,
  WorkflowError,
  assertTransition,
  dealFinancials,
  stageAmount,
} from '@/lib/deal-workflow';
import { dealBudget, type DealRow } from '@/lib/deal-guards';

export type StageType = 'COMMISSION' | 'ADVANCE' | 'FINAL';

export interface StartedStage {
  order_id: string;
  amount_paise: number;
  amount: number;
  currency: 'INR';
  key_id: string;
  payment_row_id: string;
  type: StageType;
}

/**
 * Creates (or returns the existing) Razorpay order for one payment stage.
 *
 * Idempotent per stage: a PENDING row for the same stage returns its existing
 * order instead of opening a second one, so a brand who reloads the checkout
 * does not end up with two orders for the same money.
 */
export async function startPaymentStage(
  deal: DealRow,
  type: StageType
): Promise<StartedStage> {
  const required = PAYMENT_REQUIRES_STATUS[type];
  if (deal.workflow_status !== required) {
    throw new WorkflowError(
      `Deal must be ${required} before the ${type.toLowerCase()} payment; it is ${deal.workflow_status}.`
    );
  }

  const existingConfirmed = await queryOne(
    `SELECT id FROM deal_workflow_payments
      WHERE deal_id = $1 AND type = $2 AND status = 'CONFIRMED'`,
    [deal.id, type]
  );
  if (existingConfirmed) {
    throw new WorkflowError(`The ${type.toLowerCase()} payment is already confirmed.`);
  }

  const budget = dealBudget(deal);
  if (budget <= 0) throw new WorkflowError('Deal has no budget set.');

  const amount = stageAmount(budget, type);
  if (amount <= 0) throw new WorkflowError('Computed payment amount is zero.');
  const amountPaise = Math.round(amount * 100);

  // Reuse a pending order for this stage when the amount still matches.
  const pending = await queryOne(
    `SELECT id, razorpay_order_id, amount FROM deal_workflow_payments
      WHERE deal_id = $1 AND type = $2 AND status = 'PENDING'
        AND razorpay_order_id <> ''
      ORDER BY created_at DESC LIMIT 1`,
    [deal.id, type]
  );
  if (pending && Number((pending as any).amount) === amount) {
    return {
      order_id: (pending as any).razorpay_order_id,
      amount_paise: amountPaise,
      amount,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID || '',
      payment_row_id: (pending as any).id,
      type,
    };
  }

  const result = await createOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt: `${type.toLowerCase()}_${deal.id}`.slice(0, 40),
    notes: { deal_id: deal.id, type },
  });

  // createOrder swallows the Razorpay error and reports it in `success`.
  if (!result.success || !(result.data as any)?.id) {
    throw new Error(`Razorpay order creation failed for ${type}`);
  }
  const orderId = String((result.data as any).id);

  const inserted = await queryOne(
    `INSERT INTO deal_workflow_payments
       (deal_id, type, amount, razorpay_order_id, status)
     VALUES ($1,$2,$3,$4,'PENDING')
     RETURNING id`,
    [deal.id, type, amount, orderId]
  );

  return {
    order_id: orderId,
    amount_paise: amountPaise,
    amount,
    currency: 'INR',
    key_id: process.env.RAZORPAY_KEY_ID || '',
    payment_row_id: (inserted as any).id,
    type,
  };
}

export interface ConfirmedStage {
  alreadyConfirmed: boolean;
  type: StageType;
  amount: number;
  newStatus: string;
  dealId: string;
}

/**
 * Marks a stage paid and advances the deal, in one transaction.
 *
 * Called from the Razorpay webhook, which can fire more than once for the same
 * payment, so a repeat call for an already-confirmed stage returns
 * alreadyConfirmed instead of double-advancing the deal.
 */
export async function confirmPaymentStage(args: {
  orderId: string;
  paymentId: string;
  invoiceId?: string;
}): Promise<ConfirmedStage | null> {
  return transaction(async (client) => {
    // Lock the payment row so two concurrent webhook deliveries serialise.
    const payRes = await client.query(
      `SELECT id, deal_id, type, amount, status
         FROM deal_workflow_payments
        WHERE razorpay_order_id = $1
        FOR UPDATE`,
      [args.orderId]
    );
    const pay = payRes.rows[0];
    if (!pay) return null;

    const dealRes = await client.query(
      `SELECT id, workflow_status FROM deals WHERE id = $1 FOR UPDATE`,
      [pay.deal_id]
    );
    const deal = dealRes.rows[0];
    if (!deal) return null;

    if (pay.status === 'CONFIRMED') {
      return {
        alreadyConfirmed: true,
        type: pay.type as StageType,
        amount: Number(pay.amount),
        newStatus: deal.workflow_status,
        dealId: pay.deal_id,
      };
    }

    await client.query(
      `UPDATE deal_workflow_payments
          SET status = 'CONFIRMED', razorpay_payment_id = $2,
              razorpay_invoice_id = COALESCE(NULLIF($3,''), razorpay_invoice_id),
              updated_at = NOW()
        WHERE id = $1`,
      [pay.id, args.paymentId, args.invoiceId || '']
    );

    const target = PAYMENT_ADVANCES_TO[pay.type as StageType];
    // A webhook arriving out of order must not drag the deal backwards.
    if (deal.workflow_status !== target) {
      assertTransition(deal.workflow_status, target);
      await client.query(
        `UPDATE deals SET workflow_status = $2, updated_at = NOW() WHERE id = $1`,
        [pay.deal_id, target]
      );
    }

    return {
      alreadyConfirmed: false,
      type: pay.type as StageType,
      amount: Number(pay.amount),
      newStatus: target,
      dealId: pay.deal_id,
    };
  });
}

export async function markPaymentFailed(orderId: string, reason: string): Promise<void> {
  await query(
    `UPDATE deal_workflow_payments
        SET status = 'FAILED', updated_at = NOW(),
            razorpay_invoice_id = razorpay_invoice_id
      WHERE razorpay_order_id = $1 AND status = 'PENDING'`,
    [orderId]
  );
  console.warn('[deal-payments] stage failed', { orderId, reason });
}

/**
 * Queues the creator payout for a stage. The transfer itself is executed by
 * the payout worker; this only records the intent, so a webhook retry cannot
 * queue the same payout twice (enforced by idx_payouts_one_per_type).
 */
export async function queuePayout(args: {
  dealId: string;
  creatorId: number;
  type: 'ADVANCE' | 'FINAL';
  amount: number;
}): Promise<{ queued: boolean }> {
  try {
    await query(
      `INSERT INTO payouts (deal_id, creator_id, type, amount, status)
       VALUES ($1,$2,$3,$4,'PENDING')`,
      [args.dealId, args.creatorId, args.type, args.amount]
    );
    return { queued: true };
  } catch (err: any) {
    // Unique violation: this payout is already queued or done.
    if (err?.code === '23505' || /duplicate key/i.test(err?.message || '')) {
      return { queued: false };
    }
    throw err;
  }
}

export { dealFinancials, WORKFLOW };
