// GET /api/users/:username/resume — the virtual resume shown on profile hover.
// Spec: Instagram stats plus the last 10 deals.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';
import { WORKFLOW } from '@/lib/deal-workflow';

const USERNAME_RE = /^[A-Za-z0-9._-]{1,64}$/;
const RECENT_DEALS = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // The resume is only for signed-in users: it aggregates deal history and
  // should not be scrapeable anonymously.
  const viewerId = await requireUser(req, res);
  if (!viewerId) return;

  const { username } = req.query;
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const user = await queryOne(
      `SELECT id, username, display_name, role, instagram_user_id,
              instagram_handle, instagram_bio, instagram_profile_pic_url,
              followers_count, engagement_rate, created_at
         FROM users
        WHERE username = $1 AND is_active = TRUE AND is_deleted = FALSE`,
      [username]
    );
    if (!user) return res.status(404).json({ error: 'Not found' });

    const u = user as any;
    const isCreator = u.role === 'creator';

    // A creator's resume lists the deals they delivered; a brand's lists the
    // deals they ran. Only completed deals are shown, so an in-flight
    // negotiation is never exposed to a third party.
    const deals = await query(
      isCreator
        ? `SELECT d.id, d.title, d.amount, d.workflow_status, d.updated_at,
                  counterpart.username AS counterpart_username
             FROM deals d
             LEFT JOIN users counterpart ON counterpart.id = d.brand_id
            WHERE d.creator_id = $1 AND d.workflow_status = $2
            ORDER BY d.updated_at DESC LIMIT $3`
        : `SELECT d.id, d.title, d.amount, d.workflow_status, d.updated_at,
                  counterpart.username AS counterpart_username
             FROM deals d
             LEFT JOIN users counterpart ON counterpart.id = d.creator_id
            WHERE d.brand_id = $1 AND d.workflow_status = $2
            ORDER BY d.updated_at DESC LIMIT $3`,
      [u.id, WORKFLOW.COMPLETED, RECENT_DEALS]
    );

    const stats = await queryOne(
      isCreator
        ? `SELECT COUNT(*)::int AS completed_deals,
                  COALESCE(SUM(amount),0)::numeric AS total_value
             FROM deals WHERE creator_id = $1 AND workflow_status = $2`
        : `SELECT COUNT(*)::int AS completed_deals,
                  COALESCE(SUM(amount),0)::numeric AS total_value
             FROM deals WHERE brand_id = $1 AND workflow_status = $2`,
      [u.id, WORKFLOW.COMPLETED]
    );

    return res.status(200).json({
      username: u.username,
      display_name: u.display_name,
      role: u.role,
      instagram: {
        user_id: u.instagram_user_id || null,
        handle: u.instagram_handle || u.username,
        bio: u.instagram_bio || '',
        profile_pic_url: u.instagram_profile_pic_url || '',
        followers: u.followers_count ?? 0,
        engagement_rate: u.engagement_rate ?? 0,
      },
      stats: {
        completed_deals: (stats as any)?.completed_deals ?? 0,
        total_value: Number((stats as any)?.total_value ?? 0),
        member_since: u.created_at,
      },
      recent_deals: deals.rows,
    });
  } catch (err) {
    console.error('[users/resume] failed', err);
    return res.status(500).json({ error: 'Could not load profile' });
  }
}
