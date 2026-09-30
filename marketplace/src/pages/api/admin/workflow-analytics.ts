// GET /api/admin/workflow-analytics — the admin analytics dashboard data.
// Totals, this week, this month, status breakdown, daily series, recent rows.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';
import { WORKFLOW } from '@/lib/deal-workflow';

const DAILY_WINDOW_DAYS = 30;
const RECENT_LIMIT = 25;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  try {
    // Run independent aggregates concurrently: serially this is ~8 round trips.
    const [totals, week, month, byStatus, daily, recentDeals, recentPayouts] =
      await Promise.all([
        queryOne(
          `SELECT
             COUNT(*)::int AS deals_created,
             COUNT(*) FILTER (WHERE workflow_status = $1)::int AS deals_completed,
             COALESCE(SUM(amount) FILTER (WHERE workflow_status = $1), 0)::numeric AS total_value
           FROM deals WHERE cancelled_at IS NULL`,
          [WORKFLOW.COMPLETED]
        ),
        queryOne(
          `SELECT
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS deals_created,
             COUNT(*) FILTER (WHERE workflow_status = $1
                              AND updated_at >= NOW() - INTERVAL '7 days')::int AS deals_completed,
             COALESCE(AVG(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::numeric AS avg_deal_value,
             COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - published_at)) / 86400)
                      FILTER (WHERE workflow_status = $1
                              AND updated_at >= NOW() - INTERVAL '7 days'), 0)::numeric AS avg_days_to_complete
           FROM deals`,
          [WORKFLOW.COMPLETED]
        ),
        queryOne(
          `SELECT
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS deals_created,
             COUNT(*) FILTER (WHERE workflow_status = $1
                              AND updated_at >= NOW() - INTERVAL '30 days')::int AS deals_completed
           FROM deals`,
          [WORKFLOW.COMPLETED]
        ),
        query(
          `SELECT workflow_status, COUNT(*)::int AS count
             FROM deals WHERE cancelled_at IS NULL
            GROUP BY workflow_status ORDER BY count DESC`
        ),
        query(
          `SELECT DATE(created_at) AS day, COUNT(*)::int AS deals
             FROM deals
            WHERE created_at >= NOW() - ($1 || ' days')::interval
            GROUP BY DATE(created_at) ORDER BY day ASC`,
          [DAILY_WINDOW_DAYS]
        ),
        query(
          `SELECT d.id, d.title, d.amount, d.workflow_status, d.created_at,
                  b.username AS brand_username, c.username AS creator_username
             FROM deals d
             LEFT JOIN users b ON b.id = d.brand_id
             LEFT JOIN users c ON c.id = d.creator_id
            ORDER BY d.created_at DESC LIMIT $1`,
          [RECENT_LIMIT]
        ),
        query(
          `SELECT p.id, p.deal_id, p.type, p.amount, p.status, p.created_at,
                  u.username AS creator_username
             FROM payouts p
             LEFT JOIN users u ON u.id = p.creator_id
            ORDER BY p.created_at DESC LIMIT $1`,
          [RECENT_LIMIT]
        ),
      ]);

    const [userCounts, revenue] = await Promise.all([
      queryOne(
        `SELECT
           COUNT(*) FILTER (WHERE role = 'creator')::int AS creators,
           COUNT(*) FILTER (WHERE role = 'brand')::int AS brands
         FROM users WHERE is_active = TRUE AND is_deleted = FALSE`
      ),
      queryOne(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE type = 'COMMISSION'), 0)::numeric AS commission_all_time,
           COALESCE(SUM(amount) FILTER (WHERE type = 'COMMISSION'
                    AND updated_at >= NOW() - INTERVAL '30 days'), 0)::numeric AS commission_30d,
           COALESCE(SUM(amount) FILTER (WHERE type IN ('ADVANCE','FINAL')), 0)::numeric AS creator_payouts_all_time
         FROM deal_workflow_payments WHERE status = 'CONFIRMED'`
      ),
    ]);

    const t = totals as any;
    const m = month as any;
    const completionRate =
      t.deals_created > 0
        ? Math.round((t.deals_completed / t.deals_created) * 1000) / 10
        : 0;

    return res.status(200).json({
      totals: {
        deals_created: t.deals_created,
        deals_completed: t.deals_completed,
        total_value: Number(t.total_value),
        creators: (userCounts as any)?.creators ?? 0,
        brands: (userCounts as any)?.brands ?? 0,
        completion_rate_pct: completionRate,
      },
      this_week: week,
      this_month: {
        ...m,
        revenue: Number((revenue as any)?.commission_30d ?? 0),
      },
      revenue: {
        commission_all_time: Number((revenue as any)?.commission_all_time ?? 0),
        creator_payouts_all_time: Number((revenue as any)?.creator_payouts_all_time ?? 0),
      },
      deals_by_status: byStatus.rows,
      daily_deals: daily.rows,
      recent_deals: recentDeals.rows,
      recent_payouts: recentPayouts.rows,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[workflow-analytics] failed', err);
    return res.status(500).json({ error: 'Could not load analytics' });
  }
}
