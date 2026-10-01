// /api/cron/deal-maintenance — the one scheduled job.
//
// Does all the daily upkeep in a single run: closes expired application
// windows, chases overdue content, sends queued payouts, and refreshes stale
// Instagram profiles.
//
// It is one job rather than three because Vercel's Hobby plan allows two cron
// entries and only once per day. Three entries, one of them every 15 minutes,
// is what failed the deployment. The individual routes still exist and can be
// triggered by hand or by an external scheduler.
//
// Consequence worth knowing: payouts are attempted once a day, so a creator's
// advance can sit up to 24 hours. If that becomes the bottleneck, drive
// /api/cron/process-payouts from an external scheduler on a tighter interval,
// or move the schedule here to a Vercel paid plan.
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  closeExpiredApplications,
  notifyOverdueContent,
  findStaleInstagramProfiles,
  markInstagramSynced,
} from '@/lib/deal-cron';
import { runPayoutBatch } from '@/lib/payout-worker';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Vercel Cron invokes scheduled paths with GET and attaches the
  // Authorization: Bearer $CRON_SECRET header. POST is kept so the job can also
  // be triggered manually.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  // Without this guard an unset CRON_SECRET makes the expected header the
  // literal "Bearer undefined", which any caller can send.
  if (!secret) {
    console.error('[cron/deal-maintenance] CRON_SECRET not set — refusing to run');
    return res.status(500).json({ error: 'Cron not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results: Record<string, unknown> = {};
  let failed = false;

  // Each task is independent: one failure must not skip the others.
  for (const [name, task] of [
    ['applications_closed', closeExpiredApplications],
    ['overdue_notified', notifyOverdueContent],
    ['payouts', runPayoutBatch],
    ['instagram_synced', async () => {
      const stale = await findStaleInstagramProfiles(200);
      for (const p of stale) await markInstagramSynced(p.id);
      return { candidates: stale.length };
    }],
  ] as const) {
    try {
      results[name] = await task();
    } catch (err) {
      failed = true;
      results[name] = { error: (err as Error).message };
      console.error(`[cron/deal-maintenance] ${name} failed`, err);
    }
  }

  return res.status(failed ? 500 : 200).json({
    success: !failed,
    results,
    ran_at: new Date().toISOString(),
  });
}
