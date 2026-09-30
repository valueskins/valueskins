// POST /api/deals/:dealId/approve-final — brand gives final approval, which
// unlocks the third payment.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { queryOne } from '@/lib/db-pool';
import { loadDeal, isBrandOwner, dealBudget } from '@/lib/deal-guards';
import { WORKFLOW, canTransition, dealFinancials } from '@/lib/deal-workflow';
import { sendDealEmail } from '@/lib/deal-emails';
import { broadcastDealUpdate } from '@/lib/deal-realtime';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  if (!isBrandOwner(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

  if (!canTransition(deal.workflow_status, WORKFLOW.APPROVED_FOR_FINAL_PAYMENT)) {
    return res.status(409).json({
      error: `Cannot approve while the deal is ${deal.workflow_status}`,
    });
  }

  const f = dealFinancials(dealBudget(deal));

  try {
    const updated = await queryOne(
      `UPDATE deals
          SET workflow_status = $2,
              status = 'approved_for_final', phase = 'approved_for_final',
              updated_at = NOW()
        WHERE id = $1 AND workflow_status = $3
        RETURNING id`,
      [deal.id, WORKFLOW.APPROVED_FOR_FINAL_PAYMENT, deal.workflow_status]
    );
    if (!updated) return res.status(409).json({ error: 'Deal state changed, please reload' });

    if (deal.creator_id) {
      await sendDealEmail({
        dealId: deal.id,
        type: 'FINAL_APPROVAL',
        recipientId: deal.creator_id,
        senderId: Number(userId),
        data: { title: deal.title, final: f.final },
      });
    }

    broadcastDealUpdate({
      dealId: deal.id,
      brandId: deal.brand_id,
      creatorId: deal.creator_id,
      status: WORKFLOW.APPROVED_FOR_FINAL_PAYMENT,
    });

    return res.status(200).json({
      workflow_status: WORKFLOW.APPROVED_FOR_FINAL_PAYMENT,
      next_step: 'pay-remaining',
      final_due: f.final,
    });
  } catch (err) {
    console.error('[approve-final] failed', err);
    return res.status(500).json({ error: 'Could not approve content' });
  }
}
