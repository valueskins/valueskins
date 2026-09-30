// POST /api/deals/:dealId/upload-content — confirmed creator submits a Google
// Drive link. Also used for re-uploads after a revision request.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';
import { loadDeal, isConfirmedCreator } from '@/lib/deal-guards';
import { WORKFLOW, canTransition } from '@/lib/deal-workflow';
import { sendDealEmail } from '@/lib/deal-emails';
import { broadcastDealUpdate } from '@/lib/deal-realtime';
import { checkUploadQuota } from '@/lib/deal-quotas';

// Spec: Google Drive links only. Anything else is rejected rather than stored,
// so a brand is never sent to an attacker-controlled host from a deal page.
const ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
]);

function validateContentLink(raw: unknown): { url: string } | { error: string } {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) {
    return { error: 'A content link is required' };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: 'Content link is not a valid URL' };
  }
  if (parsed.protocol !== 'https:') {
    return { error: 'Content link must use https' };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return { error: 'Content link must be a Google Drive or Google Docs URL' };
  }
  return { url: parsed.toString() };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  if (!isConfirmedCreator(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

  const link = validateContentLink((req.body || {}).content_link);
  if ('error' in link) return res.status(400).json({ error: link.error });

  // Uploads are allowed from ADVANCE_PAID (first submission) and from
  // REVISION_REQUESTED (a re-upload).
  if (!canTransition(deal.workflow_status, WORKFLOW.CONTENT_UPLOADED)) {
    return res.status(409).json({
      error:
        deal.workflow_status === WORKFLOW.CONTENT_UPLOADED
          ? 'Content is already uploaded and awaiting review'
          : `Cannot upload content while the deal is ${deal.workflow_status}`,
    });
  }

  const uploadQuota = checkUploadQuota(deal.revision_count);
  if (!uploadQuota.allowed) {
    return res.status(429).json({
      error: `This deal has reached its limit of ${uploadQuota.limit} uploads. Contact support.`,
      used: uploadQuota.used,
      limit: uploadQuota.limit,
    });
  }

  const isRevision = deal.workflow_status === WORKFLOW.REVISION_REQUESTED;

  try {
    const updated = await queryOne(
      `UPDATE deals
          SET content_link = $2,
              content_uploaded_at = NOW(),
              workflow_status = $3,
              revision_count = revision_count + $4,
              status = 'content_uploaded', phase = 'content_uploaded',
              updated_at = NOW()
        WHERE id = $1 AND workflow_status = $5
        RETURNING revision_count`,
      [
        deal.id,
        link.url,
        WORKFLOW.CONTENT_UPLOADED,
        isRevision ? 1 : 0,
        deal.workflow_status,
      ]
    );

    // The guarded WHERE means a concurrent request already moved the deal on.
    if (!updated) {
      return res.status(409).json({ error: 'Deal state changed, please reload' });
    }

    if (deal.brand_id) {
      await sendDealEmail({
        dealId: deal.id,
        type: 'CONTENT_UPLOADED',
        recipientId: deal.brand_id,
        senderId: Number(userId),
        data: {
          title: deal.title,
          content_link: link.url,
          revision_count: (updated as any).revision_count,
        },
      });
    }

    broadcastDealUpdate({
      dealId: deal.id,
      brandId: deal.brand_id,
      creatorId: deal.creator_id,
      status: WORKFLOW.CONTENT_UPLOADED,
    });

    return res.status(200).json({
      workflow_status: WORKFLOW.CONTENT_UPLOADED,
      revision_count: (updated as any).revision_count,
    });
  } catch (err) {
    console.error('[upload-content] failed', err);
    return res.status(500).json({ error: 'Could not upload content' });
  }
}
