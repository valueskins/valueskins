import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUserId } from '@/lib/session';
import { sharedRateLimit } from '@/lib/rate-limit';

// Changes one account may make in a minute, across the whole site. Far above
// what a person does by hand, and low enough to stop a script.
const WRITES_PER_MINUTE = 60;

/**
 * The single source of caller identity for API routes.
 *
 * Identity comes ONLY from the `valueskins_session` cookie, validated against
 * `auth_sessions` (active, unexpired) by lib/session.getSessionUserId. The
 * returned id is `users.id` — the same id the client sees as `account.id`.
 *
 * Never read identity from request headers (`x-user-id`, `x-user-role`), the
 * body or the query string: those are set by the caller and prove nothing.
 */
export async function getAuthenticatedUserId(req: NextApiRequest): Promise<string | null> {
  const token = req.cookies?.valueskins_session;
  if (!token) return null;
  const userId = await getSessionUserId(`valueskins_session=${token}`);
  return userId === null || userId === undefined ? null : String(userId);
}

/**
 * Resolve the session user or end the response.
 * Returns the user id, or null after sending 401 (no/invalid session) or
 * 503 (session store unavailable). Callers must `return` when it is null.
 */
export async function requireUser(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  let userId: string | null;
  try {
    userId = await getAuthenticatedUserId(req);
  } catch (err) {
    console.error('[auth] session lookup failed', err);
    res.status(503).json({ error: 'Authentication temporarily unavailable' });
    return null;
  }
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  // Reading is not counted; anything that changes data is.
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && process.env.NODE_ENV !== 'test') {
    if (!(await sharedRateLimit(`writes:${userId}`, WRITES_PER_MINUTE, 60_000))) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      return null;
    }
  }
  return userId;
}

/** Admins are the users listed in ADMIN_IDS (comma-separated users.id). Empty list = no admins. */
export function isAdminUserId(userId: string | number | null | undefined): boolean {
  if (userId === null || userId === undefined) return false;
  const adminIds = (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(String(userId));
}

/**
 * Resolve the session user and require admin.
 * Returns the user id, or null after sending 401/403/503.
 */
export async function requireAdmin(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  const userId = await requireUser(req, res);
  if (!userId) return null;
  if (!isAdminUserId(userId)) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return userId;
}
