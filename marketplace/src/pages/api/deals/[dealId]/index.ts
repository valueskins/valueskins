// GET /api/deals/:dealId — the deal, for either party.
//
// Fills a real gap: the feed only lists OPEN deals, and
// /api/deals/:id/applications is brand-only, so a creator confirmed on a deal
// had no way to read its state. Without this the creator side of the workflow
// cannot render at all.
//
// Only the two parties may read it. Anyone else gets 404 rather than 403, so a
// stranger cannot use the response code to discover that a deal exists.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { queryOne } from '@/lib/db-pool';
import { loadDeal, isBrandOwner, isConfirmedCreator, dealBudget } from '@/lib/deal-guards';
import { applicationsOpen } from '@/lib/deal-workflow';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  const isBrand = isBrandOwner(deal, userId);
  const isCreator = isConfirmedCreator(deal, userId);

  // An applicant who was not picked keeps read access, so they can see the deal
  // they applied to rather than it vanishing.
  let isApplicant = false;
  if (!isBrand && !isCreator) {
    const row = await queryOne(
      'SELECT 1 FROM applications WHERE deal_id = $1 AND creator_id = $2',
      [deal.id, userId]
    );
    isApplicant = !!row;
  }

  if (!isBrand && !isCreator && !isApplicant) {
    return res.status(404).json({ error: 'Not found' });
  }

  const counterpartId = isBrand ? deal.creator_id : deal.brand_id;
  const counterpart = counterpartId
    ? await queryOne(
        `SELECT username, display_name, instagram_user_id, instagram_profile_pic_url,
                followers_count
           FROM users WHERE id = $1`,
        [counterpartId]
      )
    : null;

  return res.status(200).json({
    id: deal.id,
    title: deal.title,
    description: deal.description,
    budget: dealBudget(deal),
    workflow_status: deal.workflow_status,
    application_deadline: deal.application_deadline,
    content_upload_deadline: deal.content_upload_deadline,
    deal_deadline: deal.deal_deadline,
    // The delivery link is between the two parties; an unsuccessful applicant
    // has no business seeing the work that was produced.
    content_link: isBrand || isCreator ? deal.content_link : '',
    content_uploaded_at: deal.content_uploaded_at,
    feedback: isBrand || isCreator ? deal.feedback : '',
    revision_count: deal.revision_count,
    applications_open: applicationsOpen(deal),
    published_at: deal.published_at,
    cancelled_at: deal.cancelled_at,
    viewer: isBrand ? 'brand' : 'creator',
    is_confirmed_creator: isCreator,
    counterpart: counterpart || null,
  });
}
