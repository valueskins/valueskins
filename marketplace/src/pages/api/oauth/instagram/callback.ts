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

    // 1. Exchange auth code for access token (proves user controls the IG account)
    const short = await exchangeInstagramCode(code);
    if (!short.access_token || !short.user_id) {
      return res.status(400).json({ error: 'invalid_instagram_response' });
    }

    const instagramUserId = String(short.user_id);
    const username = `ig_${instagramUserId}`; // Placeholder; user will set real username in onboarding

    console.log('[oauth] Instagram login verified', { instagramUserId });

    // 2. Check if user exists
    const existing = await query(
      'SELECT id, onboarding_stage FROM users WHERE instagram_user_id = $1',
      [instagramUserId]
    );

    let onboardingStage: string | null = null;
    let userId: number;

    if (existing.rows.length > 0) {
      // Returning user
      userId = existing.rows[0].id;
      onboardingStage = existing.rows[0].onboarding_stage ?? null;
      await query(
        `UPDATE users SET last_login_at = NOW(), username = COALESCE(NULLIF(username, ''), $2)
         WHERE id = $1`,
        [userId, username]
      );
    } else {
      // New user - create account
      // No role or account_type yet (both set manually in onboarding)
      const created = await query(
        `INSERT INTO users (instagram_user_id, email, username, display_name, is_active, role, onboarding_stage)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          instagramUserId,
          '', // Email collected in onboarding
          username,
          username,
          true,
          'creator', // Default; user can change in onboarding
          'pending', // User must complete onboarding to set followers/bio/role
        ]
      );
      if (!created.rows[0]) throw new Error('Failed to create user');
      userId = created.rows[0].id;
      onboardingStage = 'pending';
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

    // 4. Redirect based on onboarding status
    return res.redirect(
      onboardingStage === 'complete' ? '/demo/marketplace' : '/auth/onboarding'
    );
  } catch (error) {
    console.error('Instagram OAuth error:', error);
    return res.status(500).json({
      error: 'auth_failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
