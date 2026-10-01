// What happens after a workflow payment stage is confirmed: the emails, the
// creator payout, and the ADP on completion.
//
// Razorpay retries webhooks, so every step here is safe to run twice:
// confirmPaymentStage short-circuits an already-confirmed stage, and the side
// effects below only run on the transition itself.
import { queryOne } from '@/lib/db-pool';
import { confirmPaymentStage, markPaymentFailed, queuePayout } from '@/lib/deal-payments';
import { dealFinancials, WORKFLOW } from '@/lib/deal-workflow';
import { sendDealEmail, sendDealEmailToBoth } from '@/lib/deal-emails';
import { broadcastDealUpdate } from '@/lib/deal-realtime';
import { generateAndRecordAdp } from '@/lib/adp-generator';

export async function handleWorkflowPaymentEvent(args: {
  event: string;
  orderId: string;
  paymentId: string;
  failureReason?: string;
}): Promise<void> {
  if (args.event === 'payment.failed') {
    await markPaymentFailed(args.orderId, args.failureReason || 'unknown');
    return;
  }

  const confirmed = await confirmPaymentStage({
    orderId: args.orderId,
    paymentId: args.paymentId,
  });

  // Not one of ours (escrow order, or an order we never recorded).
  if (!confirmed) return;
  // A retry of an already-processed payment: the emails and payout already ran.
  if (confirmed.alreadyConfirmed) return;

  const deal = await queryOne(
    `SELECT id, brand_id, creator_id, title, amount, content_upload_deadline
       FROM deals WHERE id = $1`,
    [confirmed.dealId]
  );
  if (!deal) return;

  const d = deal as any;
  const f = dealFinancials(Number(d.amount) || 0);
  const brandId = d.brand_id ? Number(d.brand_id) : null;
  const creatorId = d.creator_id ? Number(d.creator_id) : null;

  broadcastDealUpdate({
    dealId: d.id,
    brandId,
    creatorId,
    status: confirmed.newStatus,
  });

  try {
    if (confirmed.type === 'COMMISSION' && brandId) {
      await sendDealEmailToBoth({
        dealId: d.id,
        type: 'COMMISSION_CONFIRMED',
        brandId,
        creatorId,
        data: {
          title: d.title,
          amount: confirmed.amount,
          base: f.commissionBase,
          gst: f.commissionGst,
          payment_id: args.paymentId,
        },
      });
      return;
    }

    if (confirmed.type === 'ADVANCE') {
      if (creatorId) {
        await queuePayout({
          dealId: d.id,
          creatorId,
          type: 'ADVANCE',
          amount: f.advance,
        });
        await sendDealEmail({
          dealId: d.id,
          type: 'ADVANCE_CONFIRMED',
          recipientId: creatorId,
          data: {
            title: d.title,
            amount: confirmed.amount,
            payment_id: args.paymentId,
            content_upload_deadline: d.content_upload_deadline
              ? new Date(d.content_upload_deadline).toDateString()
              : 'see deal page',
          },
        });
      }
      return;
    }

    // FINAL: pay the creator, then generate and email the report.
    if (confirmed.type === 'FINAL') {
      if (creatorId) {
        await queuePayout({
          dealId: d.id,
          creatorId,
          type: 'FINAL',
          amount: f.final,
        });
      }

      if (brandId) {
        await sendDealEmailToBoth({
          dealId: d.id,
          type: 'FINAL_CONFIRMED',
          brandId,
          creatorId,
          data: {
            title: d.title,
            amount: confirmed.amount,
            payment_id: args.paymentId,
          },
        });
      }

      await emitAdp(d.id, d.title, brandId, creatorId);
    }
  } catch (err) {
    // The payment is committed and the deal has advanced. A failure in the
    // notifications must not make Razorpay retry the money.
    console.error('[deal-payment-events] side effects failed', {
      dealId: d.id,
      type: confirmed.type,
      err: (err as Error).message,
    });
  }
}

async function emitAdp(
  dealId: string,
  title: string,
  brandId: number | null,
  creatorId: number | null
): Promise<void> {
  if (!brandId) return;
  try {
    const result = await generateAndRecordAdp(dealId);
    await sendDealEmailToBoth({
      dealId,
      type: 'ADP_READY',
      brandId,
      creatorId,
      data: { title },
      attachments: result
        ? [{ filename: `ValueSkins_ADP_${dealId}.pdf`, content: result.pdf }]
        : undefined,
    });
  } catch (err) {
    // The report is regenerated on demand by the download endpoint, so a
    // failure here only costs the email attachment.
    console.error('[deal-payment-events] ADP generation failed', {
      dealId,
      err: (err as Error).message,
    });
  }
}

export { WORKFLOW };
