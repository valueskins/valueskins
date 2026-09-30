// The shared request handler behind the three pay-* endpoints. They differ
// only in which stage they open, so the auth, ownership and readiness checks
// live here once.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { loadDeal, isBrandOwner, getTransactReadiness } from '@/lib/deal-guards';
import { startPaymentStage, type StageType } from '@/lib/deal-payments';
import { WorkflowError } from '@/lib/deal-workflow';

export function makePaymentRoute(type: StageType) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = await requireUser(req, res);
    if (!userId) return;

    const deal = await loadDeal(req.query.dealId);
    if (!deal) return res.status(404).json({ error: 'Not found' });

    // Only the brand that owns the deal pays for it.
    if (!isBrandOwner(deal, userId)) return res.status(403).json({ error: 'Forbidden' });

    const readiness = await getTransactReadiness(userId);
    if (!readiness.ready) {
      return res.status(403).json({ error: 'Account setup incomplete', reason: readiness.reason });
    }

    try {
      const started = await startPaymentStage(deal, type);
      return res.status(200).json({
        order_id: started.order_id,
        amount: started.amount,
        amount_paise: started.amount_paise,
        currency: started.currency,
        key_id: started.key_id,
        type: started.type,
      });
    } catch (err) {
      if (err instanceof WorkflowError || (err as any)?.isWorkflowError) {
        return res.status(409).json({ error: (err as Error).message });
      }
      console.error(`[pay-${type}] failed`, err);
      return res.status(500).json({ error: 'Could not start payment' });
    }
  };
}
