import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { exchangeInstagramCode } from '@/lib/oauth';
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

    // Auto-detect role from Instagram account_type (in token response, no API call)
    const accountType = (short.account_type || '').toUpperCase().trim();
    let detectedRole: 'brand' | 'creator' = 'creator'; // Default
    if (accountType === 'BUSINESS') {
      detectedRole = 'brand';
    } else if (accountType.includes('CREATOR')) {
      detectedRole = 'creator';
    }

    console.log('[oauth] Instagram login verified', {
      instagramUserId,
      accountType,
      detectedRole,
    });

    // 2. Check if user exists
    const existing = await query(
      'SELECT id FROM users WHERE instagram_user_id = $1',
      [instagramUserId]
    );

    let userId: number;

    if (existing.rows.length > 0) {
      // Returning user - update last login
      userId = existing.rows[0].id;
      await query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [userId]
      );
    } else {
      // New user - create account
      // Profile: only Instagram ID + email + auto-detected role
      const created = await query(
        `INSERT INTO users (instagram_user_id, email, username, display_name, is_active, role, onboarding_stage)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          instagramUserId,
          '', // Email is empty; user provides it on first access
          instagramUserId, // Username = Instagram ID for now
          `IG User ${instagramUserId}`,
          true,
          detectedRole, // Auto-set from account_type
          'complete', // No onboarding needed; just go to app
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

    // 4. Redirect to app (no onboarding needed)
    return res.redirect('/demo/marketplace');
  } catch (error) {
    console.error('Instagram OAuth error:', error);
    return res.status(500).json({
      error: 'auth_failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
