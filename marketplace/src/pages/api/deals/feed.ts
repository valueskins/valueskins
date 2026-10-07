// GET /api/deals/feed — the open deals feed.
//
// Spec: all open deals are visible to all creators, no niche filtering. The
// SSE push is best-effort (see lib/deal-realtime), so this endpoint accepts a
// `since` cursor: a client that reconnects asks for anything published after
// the newest deal it already holds and misses nothing.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query } from '@/lib/db-pool';
import { WORKFLOW } from '@/lib/deal-workflow';
import { getUserRole, hasEmailOnFile, EMAIL_REQUIRED } from '@/lib/deal-guards';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  // Creators only. This list exists to be applied to, and a brand reading it
  // saw deals it could never apply to, including its own.
  const role = await getUserRole(userId);
  if (role !== 'creator') {
    return res.status(403).json({
      error: 'The deal feed is for creators. Your deals are under Campaigns.',
      role,
    });
  }

  if (!(await hasEmailOnFile(userId))) return res.status(403).json(EMAIL_REQUIRED);

  const limit = Math.min(
    Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  // Cursor is a timestamp, not an offset: offsets skip or repeat rows when new
  // deals are published between pages.
  const sinceRaw = typeof req.query.since === 'string' ? req.query.since : '';
  const since = sinceRaw ? new Date(sinceRaw) : null;
  if (since && Number.isNaN(since.getTime())) {
    return res.status(400).json({ error: 'Invalid since cursor' });
  }

  try {
    const params: any[] = [WORKFLOW.OPEN, limit];
    let cursorClause = '';
    if (since) {
      params.push(since);
      cursorClause = `AND d.published_at > $3`;
    }

    const result = await query(
      `SELECT d.id, d.title, d.description, d.amount AS budget,
              d.application_deadline, d.content_upload_deadline, d.deal_deadline,
              d.published_at, d.brand_id,
              u.username AS brand_username,
              u.instagram_user_id AS brand_instagram_id,
              u.followers_count AS brand_followers,
              (SELECT COUNT(*) FROM applications a WHERE a.deal_id = d.id) AS application_count,
              EXISTS (
                SELECT 1 FROM applications a
                 WHERE a.deal_id = d.id AND a.creator_id = $${params.length + 1}
              ) AS already_applied,
              (d.application_deadline IS NULL OR d.application_deadline > NOW())
                AND d.applications_closed = FALSE AS applications_open
         FROM deals d
         JOIN users u ON u.id = d.brand_id
        WHERE d.workflow_status = $1
          AND d.cancelled_at IS NULL
          ${cursorClause}
        ORDER BY d.published_at DESC
        LIMIT $2`,
      [...params, userId]
    );

    const rows = result.rows || [];
    return res.status(200).json({
      deals: rows,
      // Clients pass this back as `since` on reconnect.
      cursor: rows.length > 0 ? rows[0].published_at : sinceRaw || null,
    });
  } catch (err) {
    console.error('[deals/feed] failed', err);
    return res.status(500).json({ error: 'Could not load deals' });
  }
}
