import { query } from '@/lib/db';
import { SESSION_IDLE_TIMEOUT_MS, SESSION_ABSOLUTE_TIMEOUT_MS } from '@/config/constants';

// Sliding idle timeout: each authenticated request pushes expires_at forward
// by SESSION_IDLE_TIMEOUT_MS, but never past created_at + SESSION_ABSOLUTE_TIMEOUT_MS.
export async function touchSession(sessionToken: string): Promise<void> {
  await query(
    `UPDATE auth_sessions
     SET expires_at = LEAST(
       NOW() + ($2 || ' milliseconds')::interval,
       created_at + ($3 || ' milliseconds')::interval
     )
     WHERE id = $1 AND is_active = true AND expires_at > NOW()`,
    [sessionToken, String(SESSION_IDLE_TIMEOUT_MS), String(SESSION_ABSOLUTE_TIMEOUT_MS)]
  ).catch(() => {}); // renewal is best-effort; validation still gates access
}

export async function getSessionUserId(cookie: string): Promise<string | null> {
  // Anchor on the cookie name so e.g. `xvalueskins_session=` cannot match.
  const match = cookie.match(/(?:^|;\s*)valueskins_session=([^;]+)/);
  if (!match) return null;

  const sessionToken = match[1];

  const result = await query(
    `SELECT user_id FROM auth_sessions
     WHERE id = $1 AND is_active = true AND expires_at > NOW()`,
    [sessionToken]
  );
  if (result.rows.length === 0) return null;

  // Sliding-expiry renewal is best-effort and its result does not affect this
  // response, so it must not sit in the critical path. Awaiting it added a full
  // database round trip to EVERY authenticated request — measured at ~75ms
  // against this database, on top of the lookup above. Access is still gated by
  // the SELECT; this only extends the window.
  void touchSession(sessionToken);
  return result.rows[0].user_id;
}

/**
 * The signed-in user with the two fields every page gate needs, in one query.
 *
 * Pages used to call getSessionUserId and then run a second query for the role
 * and email. That is two round trips to the database before the page has done
 * anything, on every navigation.
 */
export async function getSessionUser(
  cookie: string
): Promise<{ id: string; role: string | null; email: string } | null> {
  const match = cookie.match(/(?:^|;\s*)valueskins_session=([^;]+)/);
  if (!match) return null;
  const sessionToken = match[1];

  const result = await query(
    `SELECT u.id, u.role, u.email
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.is_active = true AND s.expires_at > NOW()`,
    [sessionToken]
  );
  if (result.rows.length === 0) return null;

  // Sliding expiry, off the critical path, exactly as in getSessionUserId.
  void touchSession(sessionToken);
  const u = result.rows[0];
  return { id: String(u.id), role: u.role ?? null, email: u.email || '' };
}

export async function getAccountId(cookie: string): Promise<string | null> {
  const userId = await getSessionUserId(cookie);
  if (!userId) return null;

  // Ensure an account row exists for this user, then return the account_id.
  // The accounts table may have different schemas depending on which migrations ran:
  //   - Backend schema: accounts(id, legacy_user_id, ...) — no user_id column
  //   - Marketplace schema: accounts(id, user_id, ...) — has user_id column
  try {
    const result = await query(
      'INSERT INTO accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET user_id = $1 RETURNING id',
      [userId]
    );
    if (result.rows.length > 0) {
      return String(result.rows[0].id);
    }

    // If insert didn't return anything, try to fetch the account_id
    const fetch = await query(
      'SELECT id FROM accounts WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (fetch.rows.length > 0) {
      return String(fetch.rows[0].id);
    }
  } catch (e: any) {
    // If the column doesn't exist (backend schema), try the legacy_user_id column
    if (e?.code === '42703') {
      // 42703 = undefined_column
      try {
        const result = await query(
          'INSERT INTO accounts (legacy_user_id) VALUES ($1) ON CONFLICT (legacy_user_id) DO UPDATE SET legacy_user_id = $1 RETURNING id',
          [userId]
        );
        if (result.rows.length > 0) {
          return String(result.rows[0].id);
        }

        const fetch = await query(
          'SELECT id FROM accounts WHERE legacy_user_id = $1 LIMIT 1',
          [userId]
        );
        if (fetch.rows.length > 0) {
          return String(fetch.rows[0].id);
        }
      } catch {
        // If neither works, fallback to returning userId — callers may need to handle this
      }
    }
  }

  // Last resort: try to find account by user_id
  try {
    const result = await query(
      'SELECT id FROM accounts WHERE user_id = $1 OR id = $2 LIMIT 1',
      [userId, userId]
    );
    if (result.rows.length > 0) {
      return String(result.rows[0].id);
    }
  } catch {}

  // If all else fails, return userId (may not match account_id but preserves auth)
  return userId;
}

export async function getUserDisplay(userId: string): Promise<string> {
  const result = await query(
    'SELECT display_name, username FROM users WHERE id = $1',
    [userId]
  );
  if (result.rows.length === 0) return 'User';
  return result.rows[0].display_name || result.rows[0].username || 'User';
}
