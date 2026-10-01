// POST /api/cron/deal-maintenance — daily workflow upkeep.
// Closes expired application windows, chases overdue content, prunes the
// idempotency cache. Scheduled in vercel.json.
import type { NextApiRequest, NextApiResponse } from 'next';
import { closeExpiredApplications, notifyOverdueContent } from '@/lib/deal-cron';

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
