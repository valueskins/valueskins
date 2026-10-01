// Publishes deal events into Redis so the WebSocket server fans them out.
//
// WHY THIS EXISTS
// The WebSocket server lives on Render (backend-node/src/realtime.js): a
// persistent process holding the client connections, already wired to Redis
// pub/sub on channel `rt:mutations` for cross-instance fan-out.
//
// The API routes that change a deal run on Vercel, in a different process with
// no socket to any client. Previously they broadcast through lib/event-bus, an
// in-memory bus, so a publish only reached clients that happened to be on the
// same Vercel instance — which for a serverless function is usually nobody.
// Writing to the same Redis channel the Render server subscribes to is what
// closes the gap: Vercel publishes, Render delivers, every connected client
// hears it in the same tick.
//
// Delivery is at-most-once and deliberately so. A missed event costs the client
// a late render, which its reconcile already covers; blocking a payment or a
// deal update on Redis being reachable would cost far more.
import Redis from 'ioredis';

// Must match REDIS_CHANNEL in backend-node/src/realtime.js.
const CHANNEL = 'rt:mutations';
// Must be one of COLLECTIONS there, or the server drops the mutation.
const COLLECTION = 'deals';

const PUBLISH_TIMEOUT_MS = 1500;

// One client per process, pinned to globalThis: Next bundles each API route
// separately, so a module-level client would otherwise mean a new Redis
// connection per route and exhaust the connection limit.
const globalForRedis = globalThis as unknown as { __vsRedisPub?: Redis | null };

function getPublisher(): Redis | null {
  if (globalForRedis.__vsRedisPub !== undefined) return globalForRedis.__vsRedisPub;

  const url = process.env.REDIS_URL;
  if (!url) {
    // Expected in local development. Cached as null so we do not retry the
    // lookup on every call.
    globalForRedis.__vsRedisPub = null;
    return null;
  }

  try {
    const client = new Redis(url, {
      // A deal update must not wait on Redis. Fail fast and move on.
      connectTimeout: PUBLISH_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
    // Without a handler an ioredis error is an unhandled 'error' event, which
    // takes down the function.
    client.on('error', (err) => {
      console.warn('[deal-events] redis error', err.message);
    });
    globalForRedis.__vsRedisPub = client;
    return client;
  } catch (err) {
    console.warn('[deal-events] redis unavailable', (err as Error).message);
    globalForRedis.__vsRedisPub = null;
    return null;
  }
}

export interface DealEvent {
  dealId: string;
  /** What happened, for the client to decide whether it cares. */
  event: 'new-deal' | 'deal-updated';
  workflowStatus?: string;
  title?: string;
  description?: string;
  budget?: number;
  brandId?: number;
  brandUsername?: string;
  applicationDeadline?: string;
  /** Present on an update: only these two see a deal's private state. */
  participants?: (number | null)[];
}

/**
 * Publishes one deal event. Never throws and never blocks for long: callers are
 * in the middle of a payment or a state transition, and neither should fail
 * because a cache is down.
 */
export async function publishDealEvent(evt: DealEvent): Promise<{ sent: boolean }> {
  const client = getPublisher();
  if (!client) return { sent: false };

  // The envelope shape the Render server expects. `origin` is required: it uses
  // it to skip mutations it published itself, and a value it will never
  // generate means ours are always applied.
  const envelope = {
    origin: 'vercel-api',
    mutation: {
      op: 'set',
      collection: COLLECTION,
      key: evt.dealId,
      value: {
        id: evt.dealId,
        event: evt.event,
        workflow_status: evt.workflowStatus ?? null,
        title: evt.title ?? null,
        description: evt.description ?? null,
        budget: evt.budget ?? null,
        brand_id: evt.brandId ?? null,
        brand_username: evt.brandUsername ?? null,
        application_deadline: evt.applicationDeadline ?? null,
        participants: evt.participants?.filter((p): p is number => typeof p === 'number') ?? null,
        at: new Date().toISOString(),
      },
    },
  };

  try {
    await Promise.race([
      client.publish(CHANNEL, JSON.stringify(envelope)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('publish timed out')), PUBLISH_TIMEOUT_MS)
      ),
    ]);
    return { sent: true };
  } catch (err) {
    // At-most-once by design: the client's reconcile covers a dropped event.
    console.warn('[deal-events] publish failed', {
      dealId: evt.dealId,
      event: evt.event,
      reason: (err as Error).message,
    });
    return { sent: false };
  }
}
