// POST /api/deals/create-workflow-deal — brand creates a deal (DRAFT or OPEN).
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { queryOne } from '@/lib/db-pool';
import { getUserRole } from '@/lib/deal-guards';
import { WORKFLOW } from '@/lib/deal-workflow';
import { sendDealEmail } from '@/lib/deal-emails';
import { broadcastNewDeal } from '@/lib/deal-realtime';
import { checkDealCreationQuota } from '@/lib/deal-quotas';

const MAX_TITLE = 200;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const role = await getUserRole(userId);
  if (role !== 'brand') {
    return res.status(403).json({ error: 'Only brands can create deals' });
  }

  const quota = await checkDealCreationQuota(userId);
  if (!quota.allowed) {
    if (quota.retryAfterSeconds) {
      res.setHeader('Retry-After', String(quota.retryAfterSeconds));
    }
    return res.status(429).json({
      error: `You can create ${quota.limit} deals per 24 hours.`,
      used: quota.used,
      limit: quota.limit,
    });
  }

  const {
    title,
    description,
    budget,
    application_deadline,
    content_upload_deadline,
    deal_deadline,
    publish,
  } = req.body || {};

  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const budgetNum = Number(budget);
  if (!Number.isFinite(budgetNum) || budgetNum <= 0 || budgetNum > 100_000_000) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  // The commission is a flat 885, so a budget at or under it leaves the creator
  // nothing and the 30/70 split would be negative.
  if (budgetNum <= 885) {
    return res.status(400).json({ error: 'Budget must exceed the 885 INR commission' });
  }

  const shouldPublish = publish === true;

  const deadlines = parseDeadlines({
    application_deadline,
    content_upload_deadline,
    deal_deadline,
  });

  const anyDateSupplied =
    application_deadline || content_upload_deadline || deal_deadline;

  // Validate whenever dates are given, not only when publishing. Checking only
  // on publish let a draft be saved with a content deadline before its
  // application deadline, and the error then surfaced much later, after the
  // brand had moved on.
  if ('error' in deadlines && (shouldPublish || anyDateSupplied)) {
    return res.status(400).json({ error: deadlines.error });
  }

  const dates = 'error' in deadlines ? null : deadlines;
  const status = shouldPublish ? WORKFLOW.OPEN : WORKFLOW.DRAFT;

  try {
    const row = await queryOne(
      `INSERT INTO deals
         (brand_id, title, description, amount, workflow_status,
          application_deadline, content_upload_deadline, deal_deadline,
          published_at, status, phase)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, workflow_status, created_at`,
      [
        userId,
        title.trim(),
        description.trim(),
        budgetNum,
        status,
        dates?.application ?? null,
        dates?.contentUpload ?? null,
        dates?.dealDeadline ?? null,
        shouldPublish ? new Date() : null,
        shouldPublish ? 'open' : 'draft',
        shouldPublish ? 'open' : 'draft',
      ]
    );

    const dealId = (row as any).id;

    if (shouldPublish) {
      await broadcastNewDeal({
        id: dealId,
        title: title.trim(),
        description: description.trim(),
        budget: budgetNum,
        brand_id: Number(userId),
        application_deadline: dates!.application.toISOString(),
      });

      await sendDealEmail({
        dealId,
        type: 'DEAL_CREATED',
        recipientId: Number(userId),
        data: {
          title: title.trim(),
          description: description.trim(),
          budget: budgetNum,
          application_deadline: dates!.application.toDateString(),
          content_upload_deadline: dates!.contentUpload.toDateString(),
        },
      });
    }

    return res.status(201).json({
      deal_id: dealId,
      workflow_status: (row as any).workflow_status,
    });
  } catch (err) {
    console.error('[deals/create] failed', err);
    return res.status(500).json({ error: 'Could not create deal' });
  }
}

function parseDeadlines(input: {
  application_deadline: unknown;
  content_upload_deadline: unknown;
  deal_deadline: unknown;
}):
  | { application: Date; contentUpload: Date; dealDeadline: Date }
  | { error: string } {
  const app = new Date(String(input.application_deadline));
  const content = new Date(String(input.content_upload_deadline));
  const deal = new Date(String(input.deal_deadline));

  if ([app, content, deal].some((d) => Number.isNaN(d.getTime()))) {
    return { error: 'All three deadlines are required to publish' };
  }
  const now = Date.now();
  if (app.getTime() <= now) {
    return { error: 'Application deadline must be in the future' };
  }
  // The order matters: creators apply, then deliver, then the deal closes.
  if (content.getTime() <= app.getTime()) {
    return { error: 'Content upload deadline must be after the application deadline' };
  }
  if (deal.getTime() < content.getTime()) {
    return { error: 'Deal deadline must be on or after the content upload deadline' };
  }
  return { application: app, contentUpload: content, dealDeadline: deal };
}
