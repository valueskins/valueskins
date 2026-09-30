// POST /api/cron/instagram-sync — daily refresh of Instagram profile data.
//
// v1 note: the app currently holds instagram_business_basic only. Meta rejected
// instagram_business_manage_insights, so follower and engagement figures are
// not readable yet. Until that is approved this job refreshes what basic scope
// allows and stamps instagram_last_synced; the richer fields stay untouched
// rather than being overwritten with zeros.
import type { NextApiRequest, NextApiResponse } from 'next';
import { findStaleInstagramProfiles, markInstagramSynced } from '@/lib/deal-cron';

const MAX_PER_RUN = 200;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Vercel Cron invokes scheduled paths with GET and attaches the
  // Authorization: Bearer $CRON_SECRET header. POST is kept so the job can also
  // be triggered manually.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/instagram-sync] CRON_SECRET not set — refusing to run');
    return res.status(500).json({ error: 'Cron not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stale = await findStaleInstagramProfiles(MAX_PER_RUN);

    // Nothing to fetch without insights scope; stamping the timestamp keeps the
    // queue moving so the job does not re-scan the same rows every day.
    let synced = 0;
    for (const profile of stale) {
      await markInstagramSynced(profile.id);
      synced++;
    }

    return res.status(200).json({
      success: true,
      candidates: stale.length,
      synced,
      note: 'Profile metrics require instagram_business_manage_insights (pending Meta approval).',
      ran_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron/instagram-sync] failed', err);
    return res.status(500).json({ error: 'Sync failed' });
  }
}
