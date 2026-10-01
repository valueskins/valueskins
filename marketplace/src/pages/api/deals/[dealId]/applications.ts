// GET /api/deals/:dealId/applications — the brand reviews who applied.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query } from '@/lib/db-pool';
import { loadDeal, isBrandOwner } from '@/lib/deal-guards';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  // Applicants are visible only to the brand running the deal: one creator
  // must not be able to enumerate who else is competing for it.
  if (!isBrandOwner(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const result = await query(
      `SELECT a.id, a.status, a.created_at,
              u.id AS creator_id, u.username, u.display_name,
              u.instagram_user_id, u.instagram_profile_pic_url,
              u.followers_count, u.engagement_rate,
              (SELECT COUNT(*)::int FROM deals d2
                WHERE d2.creator_id = u.id AND d2.workflow_status = 'COMPLETED'
           
                ) AS completed_deals
         FROM applications a
         JOIN users u ON u.id = a.creator_id
        WHERE a.deal_id = $1
        ORDER BY
          CASE a.status WHEN 'CONFIRMED' THEN 0 WHEN 'APPLIED' THEN 1 ELSE 2 END,
          a.created_at ASC
        LIMIT 500`,
      [deal.id]
    );

    return res.status(200).json({
      deal_id: deal.id,
      workflow_status: deal.workflow_status,
      applications: result.rows,
    });
  } catch (err) {
    console.error('[deal applications] failed', err);
    return res.status(500).json({ error: 'Could not load applications' });
  }
}
