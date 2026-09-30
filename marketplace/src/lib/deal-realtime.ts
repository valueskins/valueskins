// Real-time fan-out of newly published deals to creators.
//
// Delivery is over the existing SSE event bus (lib/event-bus). That bus is
// per-process, and on serverless each instance holds only the connections it
// accepted, so a broadcast reaches the creators connected to *this* instance
// only. The feed endpoint therefore also supports a `since` cursor: clients
// reconcile on reconnect and never rely on the push alone for correctness.
import { query } from '@/lib/db-pool';
import { broadcast } from '@/lib/event-bus';

export interface NewDealEvent {
  id: string;
  title: string;
  description: string;
  budget: number;
  brand_id: number;
  application_deadline: string;
}

// Creators are notified in batches: loading every id into one array does not
// scale, and the bus only needs the ids it actually holds connections for.
const BATCH = 1000;

export async function broadcastNewDeal(deal: NewDealEvent): Promise<void> {
  try {
    let offset = 0;
    for (;;) {
      const res = await query(
        `SELECT id FROM users
          WHERE role = 'creator' AND is_active = TRUE AND is_deleted = FALSE
          ORDER BY id
          LIMIT $1 OFFSET $2`,
        [BATCH, offset]
      );
      const ids = (res.rows || []).map((r: any) => Number(r.id));
      if (ids.length === 0) break;

      broadcast('new-deal', ids, {
        id: deal.id,
        title: deal.title,
        description: deal.description,
        budget: deal.budget,
        brand_id: deal.brand_id,
        application_deadline: deal.application_deadline,
      });

      if (ids.length < BATCH) break;
      offset += BATCH;
    }
  } catch (err) {
    // A failed broadcast must never fail deal creation; the deal is already
    // committed and the feed's `since` cursor will surface it.
    console.error('[deal-realtime] broadcast failed', (err as Error).message);
  }
}

// Notifies the two parties of a deal that its state changed.
export function broadcastDealUpdate(args: {
  dealId: string;
  brandId: number | null;
  creatorId: number | null;
  status: string;
  event?: string;
}): void {
  const targets = [args.brandId, args.creatorId].filter(
    (id): id is number => typeof id === 'number'
  );
  if (targets.length === 0) return;
  try {
    broadcast(args.event || 'deal-updated', targets, {
      deal_id: args.dealId,
      workflow_status: args.status,
    });
  } catch (err) {
    console.error('[deal-realtime] update broadcast failed', (err as Error).message);
  }
}
