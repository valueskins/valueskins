// The record of everything that happens on a deal, in order.
//
// Each handler that changes a deal calls recordDealEvent once it has succeeded.
// The deal report (the ADP) prints the full list, so either party can show
// exactly what was said, sent and paid, and when.
import { query } from '@/lib/db-pool';

export type DealEventType =
  | 'DEAL_POSTED'
  | 'APPLIED'
  | 'CREATOR_CONFIRMED'
  | 'APPLICATION_DECLINED'
  | 'FEE_PAID'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_DISPUTED'
  | 'CONTENT_SUBMITTED'
  | 'CHANGES_REQUESTED'
  | 'CONTENT_APPROVED'
  | 'DEAL_COMPLETED'
  | 'DEAL_CANCELLED';

export interface DealEventRow {
  event_type: DealEventType;
  actor_id: number | null;
  detail: Record<string, any>;
  created_at: string;
}

/**
 * Appends one event. Never throws: the action it describes has already
 * happened, and failing the request because its record could not be written
 * would leave the user looking at an error for something that worked.
 */
export async function recordDealEvent(e: {
  dealId: string;
  actorId?: string | number | null;
  type: DealEventType;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO deal_events (deal_id, actor_id, event_type, detail)
       VALUES ($1, $2, $3, $4)`,
      [e.dealId, e.actorId ?? null, e.type, JSON.stringify(e.detail || {})]
    );
  } catch (err) {
    console.error('[deal-events] could not record', { dealId: e.dealId, type: e.type, message: (err as Error).message });
  }
}

export async function listDealEvents(dealId: string): Promise<DealEventRow[]> {
  const res = await query(
    `SELECT event_type, actor_id, detail, created_at
       FROM deal_events
      WHERE deal_id = $1
      ORDER BY created_at, id`,
    [dealId]
  );
  return (res.rows || []) as DealEventRow[];
}

const money = (n: unknown) =>
  `${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`;

/**
 * One event as a line for the report: who did what. `who` maps a user id to
 * the name to print for them.
 */
export function describeDealEvent(ev: DealEventRow, who: (id: number | null) => string): { line: string; quote?: string } {
  const actor = who(ev.actor_id);
  const d = ev.detail || {};
  switch (ev.event_type) {
    case 'DEAL_POSTED':
      return { line: `${actor} posted the deal.` };
    case 'APPLIED':
      return { line: `${actor} applied.` };
    case 'CREATOR_CONFIRMED':
      return { line: `${actor} confirmed ${who(Number(d.creator_id) || null)} for the deal. All other applications were closed.` };
    case 'APPLICATION_DECLINED':
      return { line: `${actor} declined the application from ${who(Number(d.creator_id) || null)}.` };
    case 'FEE_PAID':
      return { line: `The ValueSkins fee of ${money(d.amount)} was paid through Razorpay (payment ${d.razorpay_payment_id || 'n/a'}).` };
    case 'PAYMENT_RECORDED':
      return {
        line: `${actor} recorded the ${d.stage === 'ADVANCE' ? '30% advance' : '70% final'} payment of ${money(d.amount)} to ${d.paid_to || 'the creator'}, UPI reference ${d.reference || 'n/a'}.`,
        quote: d.note ? String(d.note) : undefined,
      };
    case 'PAYMENT_CONFIRMED':
      return { line: `${actor} confirmed the ${d.stage === 'ADVANCE' ? '30% advance' : '70% final'} payment of ${money(d.amount)} arrived.` };
    case 'PAYMENT_DISPUTED':
      return {
        line: `${actor} reported that the ${d.stage === 'ADVANCE' ? '30% advance' : '70% final'} payment did not arrive.`,
        quote: d.reason ? String(d.reason) : undefined,
      };
    case 'CONTENT_SUBMITTED':
      return { line: `${actor} ${d.resubmission ? 'submitted revised content' : 'submitted the content'}: ${d.link || 'n/a'}` };
    case 'CHANGES_REQUESTED':
      return { line: `${actor} asked for changes (request ${d.round || '?'}):`, quote: String(d.feedback || '') };
    case 'CONTENT_APPROVED':
      return { line: `${actor} approved the content.` };
    case 'DEAL_COMPLETED':
      return { line: 'The deal was completed.' };
    case 'DEAL_CANCELLED':
      return { line: `${actor} cancelled the deal.`, quote: d.reason ? String(d.reason) : undefined };
    default:
      return { line: `${actor}: ${ev.event_type}` };
  }
}
