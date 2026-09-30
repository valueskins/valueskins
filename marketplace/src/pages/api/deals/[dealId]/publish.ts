// POST /api/deals/:dealId/publish — takes a DRAFT deal live.
//
// Without this a draft was a dead end: create-workflow-deal could save one, but
// nothing could move it to OPEN, so it could never be seen or applied to. The
// spec has brands saving drafts while they write the brief, which only works if
// there is a way out of DRAFT.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { queryOne } from '@/lib/db-pool';
import { loadDeal, isBrandOwner, dealBudget } from '@/lib/deal-guards';
import { WORKFLOW, canTransition } from '@/lib/deal-workflow';
import { sendDealEmail } from '@/lib/deal-emails';
import { broadcastNewDeal } from '@/lib/deal-realtime';
import { checkDealCreationQuota } from '@/lib/deal-quotas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });
  if (!isBrandOwner(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

  if (!canTransition(deal.workflow_status, WORKFLOW.OPEN)) {
    return res.status(409).json({
      error:
        deal.workflow_status === WORKFLOW.OPEN
          ? 'This deal is already live'
          : `A deal cannot be published from ${deal.workflow_status}`,
    });
  }

  // A draft may have been saved before its dates were filled in, and going live
  // without them would leave applications open forever.
  if (!deal.application_deadline || !deal.content_upload_deadline || !deal.deal_deadline) {
    return res.status(400).json({
      error: 'Set all three deadlines before publishing',
    });
  }
  if (new Date(deal.application_deadline).getTime() <= Date.now()) {
    return res.status(400).json({
      error: 'The application deadline has already passed. Set a new one before publishing.',
    });
  }

  const budget = dealBudget(deal);
  if (budget <= 885) {
    return res.status(400).json({ error: 'Budget must exceed the 885 INR commission' });
  }

  // Publishing is what makes a deal cost us anything, so it is what the daily
  // quota counts — otherwise a brand could bank drafts and release them all at
  // once.
  const quota = await checkDealCreationQuota(userId);
  if (!quota.allowed) {
    if (quota.retryAfterSeconds) {
      res.setHeader('Retry-After', String(quota.retryAfterSeconds));
    }
    return res.status(429).json({
      error: `You can publish ${quota.limit} deals per 24 hours.`,
      used: quota.used,
      limit: quota.limit,
    });
  }

  try {
    // Guarded on the current status so two concurrent publishes cannot both
    // broadcast the same deal.
    const updated = await queryOne(
      `UPDATE deals
          SET workflow_status = $2, published_at = NOW(),
              status = 'open', phase = 'open', updated_at = NOW()
        WHERE id = $1 AND workflow_status = $3
        RETURNING id, published_at`,
      [deal.id, WORKFLOW.OPEN, deal.workflow_status]
    );
    if (!updated) {
      return res.status(409).json({ error: 'Deal state changed, please reload' });
    }

    await broadcastNewDeal({
      id: deal.id,
      title: deal.title,
      description: deal.description,
      budget,
      brand_id: Number(userId),
      application_deadline: new Date(deal.application_deadline).toISOString(),
    });

    await sendDealEmail({
      dealId: deal.id,
      type: 'DEAL_CREATED',
      recipientId: Number(userId),
      data: {
        title: deal.title,
        description: deal.description,
        budget,
        application_deadline: new Date(deal.application_deadline).toDateString(),
        content_upload_deadline: new Date(deal.content_upload_deadline).toDateString(),
      },
    });

    return res.status(200).json({
      workflow_status: WORKFLOW.OPEN,
      published_at: (updated as any).published_at,
    });
  } catch (err) {
    console.error('[publish] failed', err);
    return res.status(500).json({ error: 'Could not publish deal' });
  }
}
