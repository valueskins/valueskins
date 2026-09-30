// POST /api/deals/:dealId/suggest-changes — brand requests a revision.
// Spec: text feedback only, unlimited rounds.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { queryOne } from '@/lib/db-pool';
import { loadDeal, isBrandOwner } from '@/lib/deal-guards';
import { WORKFLOW, canTransition } from '@/lib/deal-workflow';
import { sendDealEmail } from '@/lib/deal-emails';
import { broadcastDealUpdate } from '@/lib/deal-realtime';

const MAX_FEEDBACK = 5000;
// After this many rounds the email suggests both sides consider closing the
// deal; it is advice, not a block (spec: no limit on revisions).
const REVISION_ADVISORY_THRESHOLD = 5;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  if (!isBrandOwner(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

  const raw = (req.body || {}).feedback;
  if (typeof raw !== 'string' || !raw.trim()) {
    return res.status(400).json({ error: 'Feedback is required' });
  }
  if (raw.length > MAX_FEEDBACK) {
    return res.status(400).json({ error: 'Feedback is too long' });
  }
  const feedback = raw.trim();

  if (!canTransition(deal.workflow_status, WORKFLOW.REVISION_REQUESTED)) {
    return res.status(409).json({
      error: `Cannot request changes while the deal is ${deal.workflow_status}`,
    });
  }

  try {
    const updated = await queryOne(
      `UPDATE deals
          SET feedback = $2, workflow_status = $3,
              status = 'revision_requested', phase = 'revision_requested',
              updated_at = NOW()
        WHERE id = $1 AND workflow_status = $4
        RETURNING revision_count`,
      [deal.id, feedback, WORKFLOW.REVISION_REQUESTED, deal.workflow_status]
    );
    if (!updated) return res.status(409).json({ error: 'Deal state changed, please reload' });

    const rounds = Number((updated as any).revision_count) || 0;

    if (deal.creator_id) {
      await sendDealEmail({
        dealId: deal.id,
        type: 'REVISION_REQUESTED',
        recipientId: deal.creator_id,
        senderId: Number(userId),
        data: { title: deal.title, feedback },
      });
    }

    broadcastDealUpdate({
      dealId: deal.id,
      brandId: deal.brand_id,
      creatorId: deal.creator_id,
      status: WORKFLOW.REVISION_REQUESTED,
    });

    return res.status(200).json({
      workflow_status: WORKFLOW.REVISION_REQUESTED,
      revision_count: rounds,
      advisory:
        rounds >= REVISION_ADVISORY_THRESHOLD
          ? 'This deal has had several revision rounds. Consider closing it or contacting support.'
          : undefined,
    });
  } catch (err) {
    console.error('[suggest-changes] failed', err);
    return res.status(500).json({ error: 'Could not send feedback' });
  }
}
