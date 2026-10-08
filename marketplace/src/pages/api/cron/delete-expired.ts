import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { query, transaction } from '@/lib/db';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET not set, delete-expired cron disabled');
    return res.status(500).json({ error: 'Cron not configured' });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  console.log(`[delete-expired cron] triggered from ${ip} at ${new Date().toISOString()}`);

  try {
    const processed: Record<string, number> = {};

    // 1. Process deletion_queue: anonymize users whose deadline has passed
    const expiredDeletions = await query(
      `SELECT dq.user_id, dq.export_id, u.email, u.display_name
       FROM deletion_queue dq
       JOIN users u ON u.id = dq.user_id
       WHERE dq.deletion_deadline <= NOW() AND dq.status = 'pending'`
    );

    for (const row of expiredDeletions.rows) {
      const uid = row.user_id;
      const exportId = row.export_id;

      await transaction(async (client) => {
        // Clean up messages (remove content, keep audit trail)
        await client.query(
          "UPDATE deal_messages SET message = '[deleted]' WHERE sender_id = $1",
          [uid]
        );

        // Delete notifications
        await client.query('DELETE FROM notifications WHERE user_id = $1', [uid]);

        // Delete consents
        await client.query('DELETE FROM user_consents WHERE user_id = $1', [uid]);

        // Anonymize audit logs (remove user reference)
        await client.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [uid]);

        // Delete sessions
        await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [uid]);

        // Delete email verifications
        await client.query('DELETE FROM email_verifications WHERE user_id = $1', [uid]);

        // Delete user preferences
        await client.query('DELETE FROM user_email_preferences WHERE user_id = $1', [uid]);

        // Delete value skins
        await client.query('DELETE FROM user_value_skins WHERE user_id = $1', [uid]);

        // Delete pending deletion export (no longer needed)
        if (exportId) {
          await client.query('DELETE FROM pending_deletion_exports WHERE id = $1', [exportId]);
        }

        // ANONYMIZE user (not hard delete) — frees email for re-registration
        const anonymizedEmail = `deleted_${uid.replace(/-/g, '')}@deleted.invalid`;
        await client.query(
          `UPDATE users SET
             email = $2,
             password_hash = NULL,
             google_id = NULL,
             display_name = '[Deleted User]',
             avatar_url = NULL,
             username = NULL,
             is_deleted = TRUE,
             deleted_at = NOW(),
             is_anonymized = TRUE,
             anonymized_at = NOW()
           WHERE id = $1`,
          [uid, anonymizedEmail]
        );

        // Mark queue as completed
        await client.query(
          `UPDATE deletion_queue SET status = 'completed', completed_at = NOW() WHERE user_id = $1`,
          [uid]
        );

        // Log anonymization
        await client.query(
          `INSERT INTO audit_logs (table_name, operation, user_id, new_values)
           VALUES ('users', 'DELETE_ANONYMIZED', NULL, $1)`,
          [JSON.stringify({ anonymized_user_id: uid, email_freed: true })]
        );
      });

      processed.anonymized = (processed.anonymized || 0) + 1;
    }

    // 2. Anonymize audit_logs older than 90 days (remove PII)
    const anonymizedAudit = await query(
      `UPDATE audit_logs
       SET old_values = '{}'::jsonb, new_values = '{}'::jsonb
       WHERE created_at < NOW() - INTERVAL '90 days'
         AND (old_values != '{}'::jsonb OR new_values != '{}'::jsonb)`
    );
    processed.anonymizedAuditLogs = anonymizedAudit.rowCount || 0;

    // 3. Clean up completed deletion_queue entries older than 90 days
    const cleanedQueue = await query(
      `DELETE FROM deletion_queue
       WHERE status = 'completed' AND completed_at < NOW() - INTERVAL '90 days'`
    );
    processed.cleanedQueueEntries = cleanedQueue.rowCount || 0;

    // 4. Clean up expired pending_deletion_exports older than 7 days
    const cleanedExports = await query(
      `DELETE FROM pending_deletion_exports
       WHERE created_at < NOW() - INTERVAL '7 days'`
    );
    processed.cleanedExports = cleanedExports.rowCount || 0;

    return res.status(200).json({
      success: true,
      processed,
      timestamp: new Date().toISOString(),
      note: 'Users are anonymized (not hard-deleted) so emails are freed for re-registration',
    });
  } catch (error: any) {
    console.error('[delete-expired cron] Error:', error);
    return res.status(500).json({ error: error.message || 'Cron failed' });
  }
}

export default withApiHandler(handler);
