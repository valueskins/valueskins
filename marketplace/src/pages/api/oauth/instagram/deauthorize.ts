// Meta calls this when someone removes ValueSkins from their Instagram
// account. We keep no Instagram token, so the only thing to undo is the
// person's signed-in sessions: they have taken back the access they signed in
// with. Their account and deal records stay, as the Terms describe.
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { parseSignedRequest } from '@/lib/meta-signed-request';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = parseSignedRequest(req.body?.signed_request, process.env.INSTAGRAM_CLIENT_SECRET || '');
  if (!payload) return res.status(400).json({ error: 'Invalid request' });

  try {
    await query(
      `UPDATE auth_sessions SET is_active = FALSE
        WHERE is_active = TRUE
          AND user_id IN (SELECT id FROM users WHERE instagram_user_id = $1)`,
      [payload.user_id]
    );
    console.info('[instagram] deauthorized');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[instagram] deauthorize failed', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
