// Scheduled maintenance for the deal workflow: closing applications, chasing
// overdue content, and refreshing Instagram profile data.
import { query } from '@/lib/db-pool';
import { WORKFLOW } from '@/lib/deal-workflow';
import { sendDealEmailToBoth } from '@/lib/deal-emails';

/**
 * Marks open deals whose application deadline has passed. The feed already
 * computes this from the deadline, so the flag is only a durable record for
 * queries and reporting.
 */
export async function closeExpiredApplications(): Promise<{ closed: number }> {
  const result = await query(
    `UPDATE deals
        SET applications_closed = TRUE, updated_at = NOW()
      WHERE workflow_status = $1
        AND applications_closed = FALSE
        AND application_deadline IS NOT NULL
        AND application_deadline <= NOW()
      RETURNING id`,
    [WORKFLOW.OPEN]
  );
  return { closed: (result.rows || []).length };
}

/**
 * Emails both parties once per day about content that is past its upload
 * deadline. Spec: no auto-refund and no auto-cancellation, the deal simply sits
 * in limbo until someone intervenes.
 */
export async function notifyOverdueContent(): Promise<{ notified: number }> {
  const result = await query(
    `SELECT id, brand_id, creator_id, title, content_upload_deadline,
            GREATEST(0, EXTRACT(DAY FROM NOW() - content_upload_deadline))::int AS days_overdue
       FROM deals
      WHERE workflow_status = $1
        AND content_upload_deadline IS NOT NULL
        AND content_upload_deadline <= NOW()
        AND content_uploaded_at IS NULL
        AND cancelled_at IS NULL
      LIMIT 500`,
    [WORKFLOW.ADVANCE_PAID]
  );

  let notified = 0;
  for (const row of result.rows || []) {
    // One reminder per deal per day: the unique guard is the audit trail, so a
    // re-run of the cron on the same day does not re-send.
    const already = await query(
      `SELECT 1 FROM email_communications
        WHERE deal_id = $1 AND email_type = 'CONTENT_OVERDUE'
          AND sent_at > NOW() - INTERVAL '20 hours'
        LIMIT 1`,
      [row.id]
    );
    if ((already.rows || []).length > 0) continue;

    await sendDealEmailToBoth({
      dealId: row.id,
      type: 'CONTENT_OVERDUE',
      brandId: Number(row.brand_id),
      creatorId: row.creator_id ? Number(row.creator_id) : null,
      data: {
        title: row.title,
        content_upload_deadline: new Date(row.content_upload_deadline).toDateString(),
        days_overdue: row.days_overdue,
      },
    });
    notified++;
  }

  return { notified };
}

/**
 * Returns the users whose Instagram profile data is stale, so the sync worker
 * can refresh followers and bio once a day (spec).
 *
 * Only returns candidates; the actual Graph call needs an access token per user
 * and is done by the sync route, which knows whether the app currently holds
 * the required Instagram permissions.
 */
export async function findStaleInstagramProfiles(
  limit = 200
): Promise<{ id: number; instagram_user_id: string }[]> {
  const result = await query(
    `SELECT id, instagram_user_id
       FROM users
      WHERE instagram_user_id <> ''
        AND is_active = TRUE AND is_deleted = FALSE
        AND (instagram_last_synced IS NULL
             OR instagram_last_synced < NOW() - INTERVAL '24 hours')
      ORDER BY instagram_last_synced NULLS FIRST
      LIMIT $1`,
    [limit]
  );
  return (result.rows || []).map((r: any) => ({
    id: Number(r.id),
    instagram_user_id: String(r.instagram_user_id),
  }));
}

export async function markInstagramSynced(userId: number): Promise<void> {
  await query('UPDATE users SET instagram_last_synced = NOW() WHERE id = $1', [userId]);
}

/** Drops expired idempotency rows so the table does not grow without bound. */
export async function pruneIdempotencyCache(): Promise<{ pruned: number }> {
  const result = await query(
    'DELETE FROM idempotency_cache WHERE expires_at < NOW() RETURNING idempotency_key'
  );
  return { pruned: (result.rows || []).length };
}
