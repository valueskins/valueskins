// GET /api/deals/[dealId] — Get deal details for viewing
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { loadDeal, isBrandOwner, isConfirmedCreator } from '@/lib/deal-guards';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  const isBrand = isBrandOwner(deal, userId);
  const isCreator = isConfirmedCreator(deal, userId);

  // Public deals (OPEN) viewable by anyone, draft only by owner
  if (!isBrand && !isCreator && deal.workflow_status !== 'OPEN') {
    return res.status(404).json({ error: 'Not found' });
  }

  // Return deal with role context
  return res.status(200).json({
    id: deal.id,
    title: deal.title,
    description: deal.description,
    budget: deal.amount,
    workflow_status: deal.workflow_status,
    application_deadline: deal.application_deadline,
    content_upload_deadline: deal.content_upload_deadline,
    deal_deadline: deal.deal_deadline,
    content_link: deal.content_link || '',
    feedback: deal.feedback || '',
    revision_count: deal.revision_count || 0,
    applications_open: deal.workflow_status === 'OPEN',
    viewer: isBrand ? 'brand' : 'creator',
    is_confirmed_creator: isCreator,
    counterpart: isBrand ? {
      username: deal.creator_username || 'Creator',
      followers_count: deal.creator_followers || null,
    } : {
      username: deal.brand_username || 'Brand',
      followers_count: null,
    },
  });
}
