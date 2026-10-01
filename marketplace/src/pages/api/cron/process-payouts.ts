// Sends queued creator payouts. Runs frequently, since a creator waiting on an
// advance is blocked from starting work.
import type { NextApiRequest, NextApiResponse } from 'next';
import { runPayoutBatch, payoutQueueStats } from '@/lib/payout-worker';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/process-payouts] CRON_SECRET not set — refusing to run');
    return res.status(500).json({ error: 'Cron not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await runPayoutBatch();
    const queue = await payoutQueueStats();

    if (result.halted) {
      // Not an error in this job: the rows are safely queued. It does need to be
      // visible, because creators are not being paid until it is resolved.
      console.error('[cron/process-payouts] HALTED — creators are not being paid', {
        reason: result.halted,
        pending: queue.PENDING,
      });
    }
    if (result.failed > 0) {
      console.error('[cron/process-payouts] permanent failures in batch', {
        failed: result.failed,
      });
    }

    return res.status(200).json({ success: true, ...result, queue });
  } catch (err) {
    console.error('[cron/process-payouts] run failed', err);
    return res.status(500).json({ error: 'Payout run failed' });
  }
}
