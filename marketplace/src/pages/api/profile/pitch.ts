// GET  — the creator's "why brands should hire you" text.
// POST — save it.
//
// Plain text only. It is shown to brands on the virtual resume, where React
// renders it as text, so nothing here is ever interpreted as markup.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';

export const PITCH_MAX = 600;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  if (req.method === 'GET') {
    const row = await queryOne('SELECT pitch_text FROM users WHERE id = $1', [userId]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ pitch: (row as any).pitch_text || '', max: PITCH_MAX });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const raw = (req.body || {}).pitch;
  if (typeof raw !== 'string') return res.status(400).json({ error: 'Invalid request' });

  // Control characters out, runs of blank lines collapsed, ends trimmed.
  const pitch = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (pitch.length > PITCH_MAX) {
    return res.status(400).json({ error: `Keep it under ${PITCH_MAX} characters.` });
  }

  try {
    await query('UPDATE users SET pitch_text = $2 WHERE id = $1', [userId, pitch]);
    return res.status(200).json({ pitch });
  } catch (err) {
    console.error('[profile/pitch] save failed', { userId });
    return res.status(500).json({ error: 'Could not save' });
  }
}
