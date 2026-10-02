// Direct brand-to-creator payments: record, confirm, dispute.
//
// The creator's money does not pass through us, so this module's job is to be a
// trustworthy record of money we never held. Three rules run through it:
//
// 1. The deal advances only when the CREATOR confirms. A brand recording a
//    payment changes nothing about the deal's state.
// 2. A creator's UPI handle is disclosed to exactly one brand — the one
//    confirmed on that deal — and only after the creator consented to sharing
//    it. Every other caller gets a masked form.
// 3. Amounts are derived from the deal's budget, never accepted from a caller,
//    exactly as with the Razorpay stages.
import { query, queryOne, transaction } from '@/lib/db-pool';
import { WORKFLOW, assertTransition, dealFinancials, WorkflowError } from '@/lib/deal-workflow';

export type DirectStage = 'ADVANCE' | 'FINAL';

// A UPI handle is name@psp. Anything else is refused, which is also what stops
// an account number being entered into a field meant for a UPI ID.
const VPA_RE = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/;
// References vary by bank (UTR is 12, UPI refs 12-22). Keep it permissive on
// shape but bounded, and refuse obvious junk.
const REFERENCE_RE = /^[A-Za-z0-9\-/]{6,40}$/;

export function isValidVpa(v: unknown): v is string {
  return typeof v === 'string' && VPA_RE.test(v.trim());
}

/**
 * Masks a UPI handle for anyone not entitled to the full value.
 * `creator@okhdfcbank` becomes `cr•••@okhdfcbank`: enough for the owner to
 * recognise their own, not enough for anyone else to pay it or guess it.
 */
export function maskVpa(vpa: string): string {
  if (!vpa || !vpa.includes('@')) return '';
  const [name, psp] = vpa.split('@');
  const head = name.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(3, Math.min(6, name.length - 2)))}@${psp}`;
}

/** The stage a deal's workflow status is currently expecting a payment for. */
export function expectedStage(workflowStatus: string): DirectStage | null {
  if (workflowStatus === WORKFLOW.COMMISSION_PAID) return 'ADVANCE';
  if (workflowStatus === WORKFLOW.APPROVED_FOR_FINAL_PAYMENT) return 'FINAL';
  return null;
}

export function stageAmountFor(budget: number, stage: DirectStage): number {
  const f = dealFinancials(budget);
  return stage === 'ADVANCE' ? f.advance : f.final;
}

/**
 * The creator's payout destination, disclosed only to the brand that is
 * confirmed on this deal and only with the creator's consent.
 *
 * Returning a reason rather than an empty string matters: the brand needs to
 * know whether to wait for the creator or chase them.
 */
export type DestinationBlock =
  | 'not_brand' | 'no_creator' | 'creator_has_no_upi' | 'no_consent';
export type Destination =
  | { ok: true; vpa: string; creatorId: number }
  | { ok: false; reason: DestinationBlock };

// The project builds with `strict: false`, which disables the narrowing of a
// boolean-literal discriminant, so `if (!d.ok)` does not type the error branch.
export function destinationBlocked(d: Destination): d is { ok: false; reason: DestinationBlock } {
  return d.ok === false;
}

export async function getPayoutDestination(
  dealId: string,
  requesterId: string | number
): Promise<Destination> {
  const deal = await queryOne(
    'SELECT brand_id, creator_id FROM deals WHERE id = $1',
    [dealId]
  );
  const d = deal as any;
  if (!d || String(d.brand_id) !== String(requesterId)) return { ok: false, reason: 'not_brand' };
  if (!d.creator_id) return { ok: false, reason: 'no_creator' };

  const creator = await queryOne(
    'SELECT id, payout_vpa, payout_vpa_share_consent_at FROM users WHERE id = $1',
    [d.creator_id]
  );
  const c = creator as any;
  if (!c?.payout_vpa) return { ok: false, reason: 'creator_has_no_upi' };
  if (!c.payout_vpa_share_consent_at) return { ok: false, reason: 'no_consent' };

  return { ok: true, vpa: c.payout_vpa, creatorId: Number(c.id) };
}

export interface RecordInput {
  dealId: string;
  brandId: string | number;
  stage: DirectStage;
  reference: string;
  note?: string;
}

/**
 * Records that the brand sent a direct payment.
 *
 * Deliberately does NOT move the deal. The brand is asserting something we
 * cannot verify, so the deal stays where it is until the creator confirms.
 */
export async function recordDirectPayment(input: RecordInput): Promise<{ id: string; amount: number }> {
  const reference = String(input.reference || '').trim();
  if (!REFERENCE_RE.test(reference)) {
    throw new WorkflowError('Enter the UPI reference or UTR number from your bank');
  }

  const deal = await queryOne(
    `SELECT id, brand_id, creator_id, amount, workflow_status FROM deals WHERE id = $1`,
    [input.dealId]
  );
  const d = deal as any;
  if (!d) throw new WorkflowError('Deal not found');
  if (String(d.brand_id) !== String(input.brandId)) throw new WorkflowError('Forbidden');
  if (!d.creator_id) throw new WorkflowError('This deal has no confirmed creator');

  const expected = expectedStage(d.workflow_status);
  if (expected !== input.stage) {
    throw new WorkflowError(
      expected
        ? `This deal is waiting for the ${expected.toLowerCase()} payment, not the ${input.stage.toLowerCase()}.`
        : `No payment is due at this stage (${d.workflow_status}).`
    );
  }

  const dest = await getPayoutDestination(input.dealId, input.brandId);
  if (destinationBlocked(dest)) {
    throw new WorkflowError(
      dest.reason === 'creator_has_no_upi'
        ? 'The creator has not added a UPI ID yet.'
        : dest.reason === 'no_consent'
          ? 'The creator has not yet agreed to share their UPI ID.'
          : 'Cannot record a payment for this deal.'
    );
  }

  // Server-derived, so a caller cannot record a smaller figure than they owe.
  const amount = stageAmountFor(Number(d.amount) || 0, input.stage);
  const payToVpa = (dest as { vpa: string }).vpa;

  try {
    const row = await queryOne(
      `INSERT INTO direct_payments
         (deal_id, type, amount, reference, paid_to_vpa, note, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [input.dealId, input.stage, amount, reference, payToVpa, (input.note || '').slice(0, 500), input.brandId]
    );
    return { id: (row as any).id, amount };
  } catch (err: any) {
    if (err?.code === '23505' || /duplicate key/i.test(err?.message || '')) {
      throw new WorkflowError(
        'A payment for this stage is already recorded and waiting on the creator.'
      );
    }
    throw err;
  }
}

export interface ConfirmResult {
  stage: DirectStage;
  amount: number;
  newStatus: string;
  alreadyConfirmed: boolean;
}

/**
 * The creator confirms the money arrived. This is what advances the deal.
 *
 * Done in one transaction with a row lock so a double-tap cannot advance the
 * deal twice, and guarded on the deal's current status so a stale client cannot
 * skip a stage.
 */
export async function confirmDirectPayment(args: {
  paymentId: string;
  creatorId: string | number;
}): Promise<ConfirmResult> {
  return transaction(async (client) => {
    const payRes = await client.query(
      `SELECT dp.id, dp.deal_id, dp.type, dp.amount, dp.confirmed_at, dp.disputed_at,
              d.creator_id, d.workflow_status
         FROM direct_payments dp
         JOIN deals d ON d.id = dp.deal_id
        WHERE dp.id = $1
        FOR UPDATE OF dp`,
      [args.paymentId]
    );
    const p = payRes.rows[0];
    if (!p) throw new WorkflowError('Payment record not found');
    // Only the creator who would have received the money may settle it.
    if (String(p.creator_id) !== String(args.creatorId)) throw new WorkflowError('Forbidden');
    if (p.disputed_at) throw new WorkflowError('This payment was disputed and cannot be confirmed');

    const stage = p.type as DirectStage;
    const target = stage === 'ADVANCE' ? WORKFLOW.ADVANCE_PAID : WORKFLOW.COMPLETED;

    if (p.confirmed_at) {
      return {
        stage, amount: Number(p.amount),
        newStatus: p.workflow_status, alreadyConfirmed: true,
      };
    }

    await client.query(
      `UPDATE direct_payments SET confirmed_at = NOW(), confirmed_by = $2 WHERE id = $1`,
      [p.id, args.creatorId]
    );

    // A confirmation arriving when the deal has already moved on must not drag
    // it backwards.
    if (p.workflow_status !== target) {
      assertTransition(p.workflow_status, target);
      await client.query(
        `UPDATE deals
            SET workflow_status = $2,
                ${stage === 'ADVANCE' ? 'advance_confirmed_at' : 'final_confirmed_at'} = NOW(),
                status = $3, phase = $3, updated_at = NOW()
          WHERE id = $1`,
        [p.deal_id, target, stage === 'ADVANCE' ? 'advance_paid' : 'completed']
      );
    }

    return { stage, amount: Number(p.amount), newStatus: target, alreadyConfirmed: false };
  });
}

/**
 * The creator says the money did not arrive.
 *
 * Marks the record disputed rather than deleting it, and frees the stage so the
 * brand can record a corrected payment. The deal does not advance.
 */
export async function disputeDirectPayment(args: {
  paymentId: string;
  creatorId: string | number;
  reason: string;
}): Promise<{ stage: DirectStage }> {
  const reason = String(args.reason || '').trim().slice(0, 500);
  if (!reason) throw new WorkflowError('Say what went wrong, so the brand can correct it');

  const row = await queryOne(
    `UPDATE direct_payments dp
        SET disputed_at = NOW(), dispute_reason = $3
      WHERE dp.id = $1
        AND dp.confirmed_at IS NULL
        AND dp.disputed_at IS NULL
        AND EXISTS (
          SELECT 1 FROM deals d WHERE d.id = dp.deal_id AND d.creator_id = $2
        )
      RETURNING dp.type`,
    [args.paymentId, args.creatorId, reason]
  );
  if (!row) {
    throw new WorkflowError('That payment cannot be disputed. It may already be confirmed.');
  }
  return { stage: (row as any).type as DirectStage };
}

/** Every direct payment on a deal, for the deal page and the ADP. */
export async function listDirectPayments(dealId: string) {
  const res = await query(
    `SELECT id, type, amount::numeric AS amount, reference, paid_to_vpa, note,
            recorded_at, confirmed_at, disputed_at, dispute_reason
       FROM direct_payments
      WHERE deal_id = $1
      ORDER BY recorded_at ASC`,
    [dealId]
  );
  return res.rows || [];
}

export { WorkflowError };
