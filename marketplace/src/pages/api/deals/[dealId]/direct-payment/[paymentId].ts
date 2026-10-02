// PATCH — the creator confirms a direct payment arrived, or disputes it.
//
// Confirmation is what advances the deal, so this is the critical endpoint in
// the direct-payment flow. The result is pushed over the WebSocket immediately:
// the brand is waiting on this and should not have to reload to learn it landed.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { loadDeal, isConfirmedCreator, isUuid } from '@/lib/deal-guards';
import {
  confirmDirectPayment,
  disputeDirectPayment,
  WorkflowError,
} from '@/lib/direct-payments';
import { sendDealEmailToBoth } from '@/lib/deal-emails';
import { broadcastDealUpdate } from '@/lib/deal-realtime';
import { generateAndRecordAdp } from '@/lib/adp-generator';
import { WORKFLOW } from '@/lib/deal-workflow';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });
  // Only the creator settles a payment to the creator.
  if (!isConfirmedCreator(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

  const { paymentId } = req.query;
  if (!isUuid(paymentId)) return res.status(404).json({ error: 'Not found' });

  const action = (req.body || {}).action;
  if (action !== 'confirm' && action !== 'dispute') {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    if (action === 'dispute') {
      const { stage } = await disputeDirectPayment({
        paymentId,
        creatorId: userId,
        reason: String((req.body || {}).reason || ''),
      });
      broadcastDealUpdate({
        dealId: deal.id,
        brandId: deal.brand_id,
        creatorId: deal.creator_id,
        status: deal.workflow_status,
        event: 'payment-disputed',
      });
      return res.status(200).json({ status: 'DISPUTED', stage });
    }

    const result = await confirmDirectPayment({ paymentId, creatorId: userId });

    // Pushed before the slower work below, so the brand sees it immediately.
    broadcastDealUpdate({
      dealId: deal.id,
      brandId: deal.brand_id,
      creatorId: deal.creator_id,
      status: result.newStatus,
      event: 'payment-confirmed',
    });

    if (!result.alreadyConfirmed && deal.brand_id) {
      await sendDealEmailToBoth({
        dealId: deal.id,
        type: result.stage === 'ADVANCE' ? 'ADVANCE_CONFIRMED' : 'FINAL_CONFIRMED',
        brandId: deal.brand_id,
        creatorId: deal.creator_id,
        data: { title: deal.title, amount: result.amount, payment_id: 'direct' },
      });

      // The final confirmation completes the deal, which is when the report
      // becomes meaningful.
      if (result.newStatus === WORKFLOW.COMPLETED) {
        try {
          const adp = await generateAndRecordAdp(deal.id);
          await sendDealEmailToBoth({
            dealId: deal.id,
            type: 'ADP_READY',
            brandId: deal.brand_id,
            creatorId: deal.creator_id,
            data: { title: deal.title },
            attachments: adp
              ? [{ filename: `ValueSkins_ADP_${deal.id}.pdf`, content: adp.pdf }]
              : undefined,
          });
        } catch (err) {
          // The report regenerates on download, so this costs only the email.
          console.error('[direct-payment] ADP failed', (err as Error).message);
        }
      }
    }

    return res.status(200).json({
      status: 'CONFIRMED',
      stage: result.stage,
      workflow_status: result.newStatus,
      already_confirmed: result.alreadyConfirmed,
    });
  } catch (err) {
    if (err instanceof WorkflowError || (err as any)?.isWorkflowError) {
      return res.status(409).json({ error: (err as Error).message });
    }
    console.error('[direct-payment] patch failed', err);
    return res.status(500).json({ error: 'Could not update the payment' });
  }
}
