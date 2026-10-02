// LOCAL ONLY. Signs you in as a seeded brand or creator so the workflow can be
// walked in a browser while Instagram login is blocked by the Meta dashboard
// issue. The Instagram OAuth flow is untouched and still the real login.
//
// This is a backdoor, so it is shut three ways and any one of them closes it:
//   1. refuses unless NODE_ENV is development
//   2. refuses unless DEV_LOGIN_SECRET is set AND matches
//   3. refuses any host that is not localhost
//
// It therefore cannot authenticate anyone on a deployed environment even if this
// file ships. Delete it once Instagram login works.
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { query, queryOne } from '@/lib/db-pool';
import { SESSION_ABSOLUTE_TIMEOUT_MS } from '@/config/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Never outside development.
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }
  // 2. Never without a matching secret.
  const secret = process.env.DEV_LOGIN_SECRET;
  if (!secret || req.query.secret !== secret) {
    return res.status(404).json({ error: 'Not found' });
  }
  // 3. Never off localhost: guards a dev server reached over the LAN or a tunnel.
  const host = (req.headers.host || '').split(':')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') {
    return res.status(404).json({ error: 'Not found' });
  }

  const as = req.query.as === 'brand' ? 'brand' : 'creator';
  const username = as === 'brand' ? 'demo_brand' : 'demo_creator';

  try {
    let user = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
    if (!user) {
      user = await queryOne(
        `INSERT INTO users
           (username, role, email, email_verified, display_name, instagram_user_id,
            followers_count, instagram_bio, bank_details_completed,
            payout_vpa, payout_vpa_share_consent_at, is_active, onboarding_stage)
         VALUES ($1,$2,$3,TRUE,$4,$5,$6,$7,TRUE,$8,$9,TRUE,'complete')
         RETURNING id`,
        [
          username, as, `${username}@local.test`,
          as === 'brand' ? 'Demo Brand' : 'Demo Creator',
          `ig_${username}`,
          as === 'brand' ? 0 : 12400,
          as === 'brand' ? '' : 'Food and travel creator',
          as === 'brand' ? '' : 'democreator@okaxis',
          as === 'brand' ? null : new Date(),
        ]
      );
    }
    const userId = (user as any).id;

    const sessionId = crypto.randomUUID();
    await query(
      `INSERT INTO auth_sessions (id, user_id, is_active, expires_at)
       VALUES ($1,$2,TRUE, NOW() + INTERVAL '12 hours')`,
      [sessionId, userId]
    );

    res.setHeader('Set-Cookie', [
      `valueskins_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000)}`,
    ]);

    // Straight to the right home for the role, so the next click is the test.
    return res.redirect(as === 'brand' ? '/campaigns' : '/deals/browse');
  } catch (err) {
    console.error('[dev-login] failed', err);
    return res.status(500).json({ error: 'Dev login failed' });
  }
}
