// v1 Launch: Instagram OAuth login without API calls
// Account type auto-detected from Instagram token response
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { exchangeInstagramCode, getInstagramIdentity, roleFromInstagramAccountType } from '@/lib/oauth';
import { placeholderUsername } from '@/lib/handle';
import { query } from '@/lib/db';
import { SESSION_IDLE_TIMEOUT_MS, SESSION_ABSOLUTE_TIMEOUT_MS } from '@/config/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error, error_description } = req.query;

  if (error) {
    const reason = error_description ? String(error_description) : String(error);
    return res.redirect(`/?error=${encodeURIComponent(reason)}`);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing code' });
  }

  // Verify the state cookie matches the state Instagram echoes back. Prevents CSRF.
  const rawCookie = req.headers.cookie || '';
  const stateMatch = rawCookie.match(/oauth_state=([^;]+)/);
  const stateCookie = stateMatch ? stateMatch[1] : null;
  const state = req.query.state;

  if (!stateCookie || !state || stateCookie !== String(state)) {
    return res.status(400).json({ error: 'invalid_state' });
  }

  try {
    // v1 LAUNCH: Instagram OAuth login only (no API calls).
    // Meta rejected our app for instagram_business_manage_insights (analytics).
    // For v1, we just verify OAuth succeeded and get the Instagram ID.
    // User enters username/followers/bio manually in onboarding.
    // Once Meta approves v2, replace this with getInstagramUserInfo() to auto-fetch.

    // 1. Exchange auth code for access token
    // The response includes user_id + account_type (no extra API call needed)
    const short = await exchangeInstagramCode(code);
    if (!short.access_token || !short.user_id) {
      return res.status(400).json({ error: 'invalid_instagram_response' });
    }

    const instagramUserId = String(short.user_id);

    // Who this is, read from Instagram: username and account type. Never
    // throws and is time-boxed, so login cannot stall on it.
    const identity = await getInstagramIdentity(short.access_token);
    const igUsername = identity.username;
    const accountType = identity.accountType;
    const verifiedRole = roleFromInstagramAccountType(accountType);

    const existing = await query(
      'SELECT id, role, instagram_account_type FROM users WHERE instagram_user_id = $1',
      [instagramUserId]
    );
    const known = existing.rows[0] as
      | { id: number; role: string; instagram_account_type: string }
      | undefined;

    // The role is never guessed. If Instagram reports a type we do not serve,
    // or will not report one at all for an account whose role it has never
    // confirmed, the sign-in stops here with an explanation. Defaulting to
    // "creator" is what let brands browse and apply to deals.
    if (!verifiedRole) {
      if (accountType) {
        console.warn('[oauth] unsupported instagram account type', { accountType });
        return res.redirect('/auth/login?error=account_type_unsupported');
      }
      if (!known || !roleFromInstagramAccountType(known.instagram_account_type)) {
        console.warn('[oauth] instagram account type unavailable at login');
        return res.redirect('/auth/login?error=account_type_unreadable');
      }
    }

    // A returning account whose type Instagram confirmed before keeps that role
    // when today's read failed.
    let role: 'brand' | 'creator' =
      verifiedRole || (known!.role === 'brand' ? 'brand' : 'creator');

    console.log('[oauth] Instagram login verified', { accountType, role });

    let userId: number;

    if (known) {
      userId = known.id;

      // The account type changed on Instagram since the role was set. Follow
      // it only if this account has done nothing in its current role: a brand
      // with posted deals cannot become a creator and leave them ownerless.
      let roleChanged = false;
      if (verifiedRole && verifiedRole !== known.role) {
        const activity = await query(
          `SELECT (SELECT COUNT(*) FROM deals WHERE brand_id = $1 OR creator_id = $1)
                + (SELECT COUNT(*) FROM applications WHERE creator_id = $1) AS n`,
          [userId]
        );
        if (Number(activity.rows[0]?.n) > 0) {
          console.warn('[oauth] account type changed but the account has deals; role kept', { userId });
          role = known.role === 'brand' ? 'brand' : 'creator';
        } else {
          roleChanged = true;
        }
      }

      await query(
        `UPDATE users
            SET last_login_at = NOW(),
                role = $4,
                instagram_account_type = COALESCE(NULLIF($5, ''), instagram_account_type),
                instagram_handle = COALESCE(NULLIF($2, ''), instagram_handle),
                username = CASE
                  WHEN $2 <> '' THEN $2
                  WHEN username = instagram_user_id THEN $3
                  ELSE username
                END
          WHERE id = $1`,
        [userId, igUsername, placeholderUsername(instagramUserId), role, verifiedRole ? accountType : '']
      );

      // A creator's profile and a brand's are different forms. If the role
      // moved, the one-time profile is released so the right form can be filled.
      if (roleChanged) {
        await query(
          `UPDATE users
              SET profile_locked_at = NULL, age = NULL, age_recorded_at = NULL,
                  gender = '', website = '', payout_vpa = '', payout_name = '',
                  payout_vpa_share_consent_at = NULL, bank_details_completed = FALSE
            WHERE id = $1`,
          [userId]
        );
      }
    } else {
      // New user - create account
      // Profile: only Instagram ID + email + auto-detected role
      const created = await query(
        `INSERT INTO users (instagram_user_id, email, username, display_name, is_active, role, onboarding_stage, instagram_handle, instagram_account_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9) RETURNING id`,
        [
          instagramUserId,
          '', // Email is empty; user provides it on first access
          // Never the bare numeric id: it was displayed as a username and linked
          // to whichever Instagram account happens to have that name.
          igUsername || placeholderUsername(instagramUserId),
          igUsername ? `@${igUsername}` : 'Instagram user',
          true,
          role, // from the Instagram account type, never chosen
          'complete', // No onboarding needed; just go to app
          igUsername,
          accountType,
        ]
      );
      if (!created.rows[0]) throw new Error('Failed to create user');
      userId = created.rows[0].id;
    }

    // 3. Create session
    const sessionId = crypto.randomUUID();
    const sessionExpiresAt = new Date(Date.now() + SESSION_IDLE_TIMEOUT_MS);

    await query(
      'INSERT INTO auth_sessions (id, user_id, is_active, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionId, userId, true, sessionExpiresAt]
    );

    const isSecure =
      req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    const cookieMaxAgeSec = Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000);

    res.setHeader('Set-Cookie', [
      `valueskins_session=${sessionId}; HttpOnly${isSecure ? '; Secure' : ''}; SameSite=Lax; Path=/; Max-Age=${cookieMaxAgeSec}`,
      `oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`, // Clear one-time state
    ]);

    // 4. Into the deal workflow. /deals/browse sends brands on to /campaigns.
    return res.redirect('/deals/browse');
  } catch (error) {
    console.error('Instagram OAuth error:', error);
    // The cause stays in the server log. Returning error.message here put
    // database internals (table names) in the browser.
    return res.status(500).json({ error: 'auth_failed' });
  }
}
