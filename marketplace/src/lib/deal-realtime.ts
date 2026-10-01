// Real-time fan-out of newly published deals to creators.
//
// Delivery is over Redis to the WebSocket server on Render, which holds the
// client connections and fans out in the same tick. See lib/deal-events-redis.
//
// The in-process SSE bus (lib/event-bus) is kept as a local-development
// fallback: it is per-process, so on serverless a broadcast reaches only the
// clients that happen to share this Vercel instance. The feed also supports a
// `since` cursor, so a dropped event costs a late render rather than a missing
// deal.
import { query } from '@/lib/db-pool';
import { broadcast } from '@/lib/event-bus';
import { publishDealEvent } from '@/lib/deal-events-redis';

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
  // The real path: Redis -> the WebSocket server on Render -> every connected
  // client, in the same tick. The in-process bus below only reaches clients that
  // happen to share this Vercel instance, which is usually none of them, so it
  // is a local-development fallback rather than the delivery mechanism.
  await publishDealEvent({
    dealId: deal.id,
    event: 'new-deal',
    title: deal.title,
    description: deal.description,
    budget: deal.budget,
    brandId: deal.brand_id,
    applicationDeadline: deal.application_deadline,
  });

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
  // Fire-and-forget: a state transition must not wait on Redis. `participants`
  // tells the client which two users this concerns, so a third party's socket
  // ignores it.
  void publishDealEvent({
    dealId: args.dealId,
    event: 'deal-updated',
    workflowStatus: args.status,
    participants: [args.brandId, args.creatorId],
  });

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
