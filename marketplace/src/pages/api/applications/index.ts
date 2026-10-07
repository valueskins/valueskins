// POST /api/applications — creator applies to an open deal.
// GET  /api/applications — the caller's own applications.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';
import { loadDeal, getUserRole, hasEmailOnFile, EMAIL_REQUIRED } from '@/lib/deal-guards';
import { applicationsOpen } from '@/lib/deal-workflow';
import { sendDealEmail } from '@/lib/deal-emails';
import { checkApplicationQuota } from '@/lib/deal-quotas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  if (req.method === 'GET') return listMine(userId, res);
  if (req.method === 'POST') return apply(req, res, userId);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function listMine(userId: string, res: NextApiResponse) {
  try {
    const result = await query(
      `SELECT a.id, a.deal_id, a.status, a.created_at,
              d.title, d.amount, d.workflow_status, d.application_deadline
         FROM applications a
         JOIN deals d ON d.id = a.deal_id
        WHERE a.creator_id = $1
        ORDER BY a.created_at DESC
        LIMIT 200`,
      [userId]
    );
    return res.status(200).json({ applications: result.rows });
  } catch (err) {
    console.error('[applications] list failed', err);
    return res.status(500).json({ error: 'Could not load applications' });
  }
}

async function apply(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const role = await getUserRole(userId);
  if (role !== 'creator') {
    return res.status(403).json({ error: 'Only creators can apply to deals' });
  }

  if (!(await hasEmailOnFile(userId))) return res.status(403).json(EMAIL_REQUIRED);

  const quota = await checkApplicationQuota(userId);
  if (!quota.allowed) {
    if (quota.retryAfterSeconds) {
      res.setHeader('Retry-After', String(quota.retryAfterSeconds));
    }
    return res.status(429).json({
      error: `You can apply to ${quota.limit} deals per 24 hours.`,
      used: quota.used,
      limit: quota.limit,
    });
  }

  const { deal_id } = req.body || {};
  const deal = await loadDeal(deal_id);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  if (!applicationsOpen(deal)) {
    return res.status(409).json({ error: 'Applications closed' });
  }

  try {
    const inserted = await queryOne(
      `INSERT INTO applications (deal_id, creator_id, status)
       VALUES ($1,$2,'APPLIED')
       ON CONFLICT (deal_id, creator_id) DO NOTHING
       RETURNING id`,
      [deal.id, userId]
    );

    // No row back means the unique constraint caught a repeat application.
    if (!inserted) {
      return res.status(409).json({ error: 'You have already applied to this deal' });
    }

    const creator = await queryOne(
      'SELECT username, followers_count FROM users WHERE id = $1',
      [userId]
    );

    if (deal.brand_id) {
      await sendDealEmail({
        dealId: deal.id,
        type: 'NEW_APPLICATION',
        recipientId: deal.brand_id,
        senderId: Number(userId),
        data: {
          title: deal.title,
          creator_username: (creator as any)?.username || `user_${userId}`,
          creator_followers: (creator as any)?.followers_count ?? null,
        },
      });
    }

    return res.status(201).json({ application_id: (inserted as any).id, status: 'APPLIED' });
  } catch (err) {
    console.error('[applications] apply failed', err);
    return res.status(500).json({ error: 'Could not apply' });
  }
}
