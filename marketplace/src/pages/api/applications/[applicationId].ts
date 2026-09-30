// PATCH /api/applications/:applicationId — brand confirms or rejects a creator.
// Confirming locks the deal to that creator and auto-rejects every other
// applicant, in one transaction (spec: exactly 1 creator per deal).
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { transaction, queryOne } from '@/lib/db-pool';
import { isUuid } from '@/lib/deal-guards';
import { WORKFLOW, assertTransition, dealFinancials, WorkflowError } from '@/lib/deal-workflow';
import { sendDealEmail } from '@/lib/deal-emails';
import { broadcastDealUpdate } from '@/lib/deal-realtime';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const { applicationId } = req.query;
  if (!isUuid(applicationId)) return res.status(404).json({ error: 'Not found' });

  const action = (req.body || {}).action;
  if (action !== 'confirm' && action !== 'reject') {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const outcome = await transaction(async (client) => {
      // Lock the deal first, then the application, so two brands clicking
      // Confirm on different applicants cannot both win.
      const appRes = await client.query(
        `SELECT a.id, a.deal_id, a.creator_id, a.status
           FROM applications a WHERE a.id = $1`,
        [applicationId]
      );
      const app = appRes.rows[0];
      if (!app) return { code: 404 as const };

      const dealRes = await client.query(
        `SELECT id, brand_id, creator_id, title, amount, workflow_status,
                content_upload_deadline
           FROM deals WHERE id = $1 FOR UPDATE`,
        [app.deal_id]
      );
      const deal = dealRes.rows[0];
      if (!deal) return { code: 404 as const };

      if (String(deal.brand_id) !== String(userId)) return { code: 403 as const };

      if (action === 'reject') {
        if (app.status === 'CONFIRMED') {
          return { code: 409 as const, message: 'That creator is already confirmed' };
        }
        await client.query(
          `UPDATE applications SET status='REJECTED', updated_at=NOW() WHERE id=$1`,
          [app.id]
        );
        return { code: 200 as const, rejected: true, deal, app };
      }

      // confirm
      assertTransition(deal.workflow_status, WORKFLOW.CONFIRMED);

      await client.query(
        `UPDATE applications SET status='CONFIRMED', updated_at=NOW() WHERE id=$1`,
        [app.id]
      );
      // Everyone else on this deal is out.
      const rejected = await client.query(
        `UPDATE applications SET status='REJECTED', updated_at=NOW()
          WHERE deal_id=$1 AND id <> $2 AND status='APPLIED'
          RETURNING creator_id`,
        [app.deal_id, app.id]
      );
      await client.query(
        `UPDATE deals
            SET creator_id=$2, workflow_status=$3, applications_closed=TRUE,
                status='confirmed', phase='confirmed', updated_at=NOW()
          WHERE id=$1`,
        [app.deal_id, app.creator_id, WORKFLOW.CONFIRMED]
      );

      return {
        code: 200 as const,
        confirmed: true,
        deal,
        app,
        rejectedCount: rejected.rows.length,
      };
    });

    if (outcome.code === 404) return res.status(404).json({ error: 'Not found' });
    if (outcome.code === 403) return res.status(403).json({ error: 'Forbidden' });
    if (outcome.code === 409) return res.status(409).json({ error: outcome.message });

    const { deal, app } = outcome;

    if ('confirmed' in outcome && outcome.confirmed) {
      const brand = await queryOne('SELECT username FROM users WHERE id = $1', [deal.brand_id]);
      const f = dealFinancials(Number(deal.amount) || 0);

      await sendDealEmail({
        dealId: deal.id,
        type: 'APPLICATION_APPROVED',
        recipientId: Number(app.creator_id),
        senderId: Number(userId),
        data: {
          title: deal.title,
          brand_username: (brand as any)?.username || 'the brand',
          creator_total: f.creatorTotal,
          advance: f.advance,
          final: f.final,
          content_upload_deadline: deal.content_upload_deadline
            ? new Date(deal.content_upload_deadline).toDateString()
            : 'see deal page',
        },
      });

      broadcastDealUpdate({
        dealId: deal.id,
        brandId: Number(deal.brand_id),
        creatorId: Number(app.creator_id),
        status: WORKFLOW.CONFIRMED,
      });

      return res.status(200).json({
        status: 'CONFIRMED',
        deal_id: deal.id,
        creator_id: app.creator_id,
        others_rejected: outcome.rejectedCount,
        next_step: 'pay-commission',
        commission_due: f.commissionTotal,
      });
    }

    return res.status(200).json({ status: 'REJECTED', deal_id: deal.id });
  } catch (err) {
    if (err instanceof WorkflowError || (err as any)?.isWorkflowError) {
      return res.status(409).json({ error: (err as Error).message });
    }
    // The one-confirmed-per-deal partial index fires here on a race.
    if ((err as any)?.code === '23505') {
      return res.status(409).json({ error: 'This deal already has a confirmed creator' });
    }
    console.error('[applications] patch failed', err);
    return res.status(500).json({ error: 'Could not update application' });
  }
}
