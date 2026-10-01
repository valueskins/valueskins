// GET /api/deals/:dealId/communications — the email audit trail for a deal.
// Spec: both parties see every email sent, who it went to and when.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query } from '@/lib/db-pool';
import { loadDeal, isParticipant } from '@/lib/deal-guards';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  if (!isParticipant(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const result = await query(
      `SELECT ec.id, ec.email_type, ec.subject, ec.body, ec.attachments,
              ec.delivery_status, ec.sent_at, ec.read_at,
              sender.username   AS sender_username,
              recipient.username AS recipient_username
         FROM email_communications ec
         LEFT JOIN users sender    ON sender.id = ec.sender_id
         LEFT JOIN users recipient ON recipient.id = ec.recipient_id
        WHERE ec.deal_id = $1
        ORDER BY ec.sent_at ASC
        LIMIT 500`,
      [deal.id]
    );

    return res.status(200).json({
      deal_id: deal.id,
      communications: result.rows,
    });
  } catch (err) {
    console.error('[communications] failed', err);
    return res.status(500).json({ error: 'Could not load communications' });
  }
}
