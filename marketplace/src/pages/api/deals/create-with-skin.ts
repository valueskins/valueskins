import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';
import { requireUser } from '@/lib/auth/require-user';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Retired. This endpoint created deals or campaigns for any signed-in account
  // without checking its role, so a creator could post one. Deals are created
  // only through /api/deals/create-workflow-deal, which is brands-only.
  return res.status(410).json({ error: 'This endpoint has been retired' });
  // eslint-disable-next-line no-unreachable
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionUserId = await requireUser(req, res);
    if (!sessionUserId) return;

    const { title, description, budget, valueSkin, creatorId } = req.body;
    if (!title || !valueSkin || !creatorId) return res.status(400).json({ error: 'Missing fields' });

    const dealId = `deal_${Date.now()}`;

    await query(
      `INSERT INTO deals (id, title, description, budget, value_skin, creator_id, status, phase, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'negotiation', 'awaiting_response', NOW())`,
      [dealId, title, description, budget || 0, valueSkin, creatorId]
    );

    return res.status(200).json({ dealId, valueSkin, message: 'Deal created with value skin' });
  } catch (error) {
    console.error('Deal creation error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
