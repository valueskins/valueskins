// POST /api/deals/:dealId/cancel — brand cancels a deal.
// Spec: allowed through CONFIRMED. Once the commission is paid the money is
// non-refundable and cancelling is refused; once the advance is paid the deal
// must run to completion. The server enforces this, not just the hidden button.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { transaction } from '@/lib/db-pool';
import { loadDeal, isBrandOwner } from '@/lib/deal-guards';
import { WORKFLOW, canCancel, cancellationBlockedReason } from '@/lib/deal-workflow';
import { sendDealEmailToBoth } from '@/lib/deal-emails';
import { broadcastDealUpdate } from '@/lib/deal-realtime';

const MAX_REASON = 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  // Spec: creators cannot cancel at any stage.
  if (!isBrandOwner(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

  if (!canCancel(deal.workflow_status)) {
    return res.status(409).json({ error: cancellationBlockedReason(deal.workflow_status) });
  }

  const rawReason = (req.body || {}).reason;
  const reason =
    typeof rawReason === 'string' ? rawReason.trim().slice(0, MAX_REASON) : '';

  try {
    const result = await transaction(async (client) => {
      // Re-read under a lock: the brand may have paid the commission between
      // the check above and this write.
      const cur = await client.query(
        `SELECT workflow_status FROM deals WHERE id = $1 FOR UPDATE`,
        [deal.id]
      );
      const status = cur.rows[0]?.workflow_status;
      if (!status) return { code: 404 as const };
      if (!canCancel(status)) {
        return { code: 409 as const, message: cancellationBlockedReason(status) };
      }

      await client.query(
        `UPDATE deals
            SET workflow_status = $2, cancelled_at = NOW(), cancelled_by_id = $3,
                cancellation_reason = $4, applications_closed = TRUE,
                status = 'cancelled', phase = 'cancelled', updated_at = NOW()
          WHERE id = $1`,
        [deal.id, WORKFLOW.CANCELLED, userId, reason]
      );
      // Open applicants are released so the deal stops showing as pending.
      await client.query(
        `UPDATE applications SET status='REJECTED', updated_at=NOW()
          WHERE deal_id=$1 AND status='APPLIED'`,
        [deal.id]
      );
      return { code: 200 as const };
    });

    if (result.code === 404) return res.status(404).json({ error: 'Not found' });
    if (result.code === 409) return res.status(409).json({ error: result.message });

    if (deal.brand_id) {
      await sendDealEmailToBoth({
        dealId: deal.id,
        type: 'DEAL_CANCELLED',
        brandId: deal.brand_id,
        creatorId: deal.creator_id,
        data: {
          title: deal.title,
          reason,
          refund_note: 'No payment had been made, so there is nothing to refund.',
        },
      });
    }

    broadcastDealUpdate({
      dealId: deal.id,
      brandId: deal.brand_id,
      creatorId: deal.creator_id,
      status: WORKFLOW.CANCELLED,
    });

    return res.status(200).json({ workflow_status: WORKFLOW.CANCELLED });
  } catch (err) {
    console.error('[cancel] failed', err);
    return res.status(500).json({ error: 'Could not cancel deal' });
  }
}
