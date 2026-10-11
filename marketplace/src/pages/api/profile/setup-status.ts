// GET — what the signed-in account still has to fill in before it can post a
// deal or apply to one. Drives the checklist in Settings and the banner on the
// marketplace pages. The same rule is enforced on the server where it matters:
// see requireCompleteSetup in lib/deal-guards.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { queryOne } from '@/lib/db-pool';
import {
  SETUP_COLUMNS, SETUP_LABELS, missingSetup, requiredSetup, type SetupRow,
} from '@/lib/setup-status';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const userId = await requireUser(req, res);
  if (!userId) return;

  const row = (await queryOne(`SELECT ${SETUP_COLUMNS} FROM users WHERE id = $1`, [userId])) as SetupRow | null;
  if (!row) return res.status(404).json({ error: 'Not found' });

  const role = row.role === 'brand' ? 'brand' : 'creator';
  const missing = missingSetup(row);
  return res.status(200).json({
    role,
    complete: missing.length === 0,
    missing,
    items: requiredSetup(role).map((key) => ({
      key,
      label: SETUP_LABELS[role][key],
      done: !missing.includes(key),
    })),
  });
}
