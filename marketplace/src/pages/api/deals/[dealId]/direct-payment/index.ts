// GET  — the payout destination and recorded payments for this deal.
// POST — the brand records a direct payment it has made.
//
// Recording does not advance the deal: see lib/direct-payments.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { loadDeal, isBrandOwner, isConfirmedCreator } from '@/lib/deal-guards';
import {
  recordDirectPayment,
  getPayoutDestination,
  listDirectPayments,
  expectedStage,
  stageAmountFor,
  maskVpa,
  destinationBlocked,
  WorkflowError,
} from '@/lib/direct-payments';
import { dealBudget } from '@/lib/deal-guards';
import { sendDealEmail } from '@/lib/deal-emails';
import { broadcastDealUpdate } from '@/lib/deal-realtime';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  const isBrand = isBrandOwner(deal, userId);
  const isCreator = isConfirmedCreator(deal, userId);
  if (!isBrand && !isCreator) return res.status(404).json({ error: 'Not found' });

  if (req.method === 'GET') {
    const payments = await listDirectPayments(deal.id);
    const stage = expectedStage(deal.workflow_status);

    // The full UPI handle goes to the brand that has to pay it, and to nobody
    // else. The creator sees their own masked, which is enough to recognise.
    let destination: { vpa?: string; name?: string; masked?: string; blocked?: string } = {};
    if (isBrand) {
      const dest = await getPayoutDestination(deal.id, userId);
      destination = destinationBlocked(dest)
        ? { blocked: dest.reason }
        : { vpa: dest.vpa, name: dest.name };
    }

    return res.status(200).json({
      expected_stage: stage,
      amount_due: stage ? stageAmountFor(dealBudget(deal), stage) : null,
      destination,
      // Masked in the list too: this response is also what the creator reads.
      payments: payments.map((p: any) => ({
        ...p,
        paid_to_vpa: isBrand ? p.paid_to_vpa : maskVpa(p.paid_to_vpa),
      })),
    });
  }

  if (req.method === 'POST') {
    if (!isBrand) return res.status(403).json({ error: 'Forbidden' });
    const { stage, reference, note } = req.body || {};
    if (stage !== 'ADVANCE' && stage !== 'FINAL') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    try {
      const result = await recordDirectPayment({
        dealId: deal.id,
        brandId: userId,
        stage,
        reference: String(reference || ''),
        note: typeof note === 'string' ? note : '',
      });

      // Tell the creator at once: they cannot confirm what they do not know
      // about, and the deal is blocked until they do.
      if (deal.creator_id) {
        await sendDealEmail({
          dealId: deal.id,
          type: stage === 'ADVANCE' ? 'ADVANCE_CONFIRMED' : 'FINAL_CONFIRMED',
          recipientId: deal.creator_id,
          senderId: Number(userId),
          data: {
            title: deal.title,
            amount: result.amount,
            payment_id: String(reference).slice(0, 40),
            content_upload_deadline: deal.content_upload_deadline
              ? new Date(deal.content_upload_deadline).toDateString()
              : 'see deal page',
          },
        });
      }
      broadcastDealUpdate({
        dealId: deal.id,
        brandId: deal.brand_id,
        creatorId: deal.creator_id,
        status: deal.workflow_status,
        event: 'payment-recorded',
      });

      return res.status(201).json({
        payment_id: result.id,
        amount: result.amount,
        awaiting: 'creator_confirmation',
      });
    } catch (err) {
      if (err instanceof WorkflowError || (err as any)?.isWorkflowError) {
        return res.status(409).json({ error: (err as Error).message });
      }
      console.error('[direct-payment] record failed', err);
      return res.status(500).json({ error: 'Could not record the payment' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
