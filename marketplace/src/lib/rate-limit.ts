import { queryOne, query } from './db-pool';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

export function getRateLimitStatus(key: string): { remaining: number; resetTime: number } | null {
  const entry = store.get(key);
  if (!entry) return null;
  return {
    remaining: Math.max(0, 100 - entry.count),
    resetTime: entry.resetTime,
  };
}

// Cleanup old entries every hour. unref: this timer must never be the thing
// that keeps a process (or a test run) alive.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}, 60 * 60 * 1000);
if (typeof sweep === 'object' && sweep && 'unref' in sweep) (sweep as { unref: () => void }).unref();

/**
 * A limit counted in the database, so it is one limit for the whole site and
 * not one per server instance. Returns false when the caller is over it.
 *
 * It allows the request when the count cannot be read: a limiter that is down
 * must not take the site down with it.
 */
export async function sharedRateLimit(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
  try {
    const row = await queryOne(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, NOW() + ($2::int * INTERVAL '1 millisecond'))
       ON CONFLICT (key) DO UPDATE
         SET count = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.count + 1 END,
             reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
       RETURNING count`,
      [key.slice(0, 200), windowMs]
    );
    return Number(row?.count ?? 0) <= maxRequests;
  } catch (err) {
    console.error('[rate-limit] shared count unavailable', (err as Error).message);
    return true;
  }
}

/** Removes windows that ended more than a day ago. Run by the daily job. */
export async function clearExpiredRateLimits(): Promise<{ removed: number }> {
  const r = await query(`DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 day'`);
  return { removed: r.rowCount ?? 0 };
}
