// GET /api/deals/:dealId/download-adp — either party downloads the deal report.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { loadDeal, isParticipant } from '@/lib/deal-guards';
import { WORKFLOW } from '@/lib/deal-workflow';
import { generateAndRecordAdp } from '@/lib/adp-generator';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res);
  if (!userId) return;

  const deal = await loadDeal(req.query.dealId);
  if (!deal) return res.status(404).json({ error: 'Not found' });

  // Only the two parties to the deal; the report carries payment identifiers.
  if (!isParticipant(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

  if (deal.workflow_status !== WORKFLOW.COMPLETED) {
    return res.status(409).json({ error: 'The report is available once the deal is completed' });
  }

  try {
    const result = await generateAndRecordAdp(deal.id);
    if (!result) return res.status(404).json({ error: 'Not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ValueSkins_ADP_${deal.id}.pdf"`
    );
    // The report embeds payment identifiers, so it must not be cached by any
    // shared proxy.
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(result.pdf);
  } catch (err) {
    console.error('[download-adp] failed', err);
    return res.status(500).json({ error: 'Could not generate report' });
  }
}
