// Meta calls this when someone asks, from Instagram, for ValueSkins to delete
// their data. The request goes into the same 30-day deletion queue as a
// request made in Settings, and their sessions end now. Meta expects a status
// URL and a confirmation code back; the person sees both.
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { parseSignedRequest } from '@/lib/meta-signed-request';

const SITE = 'https://www.valueskins.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = parseSignedRequest(req.body?.signed_request, process.env.INSTAGRAM_CLIENT_SECRET || '');
  if (!payload) return res.status(400).json({ error: 'Invalid request' });

  const confirmationCode = crypto.randomBytes(8).toString('hex');

  try {
    const user = await query('SELECT id FROM users WHERE instagram_user_id = $1', [payload.user_id]);
    const userId = user.rows[0]?.id;
    // Someone who never signed up has nothing stored, but still gets a code.
    if (userId) {
      await query(
        `INSERT INTO deletion_queue (user_id, requested_at, deletion_deadline, status)
         VALUES ($1, NOW(), NOW() + INTERVAL '30 days', 'pending')
         ON CONFLICT (user_id) DO UPDATE
           SET status = 'pending', requested_at = NOW(),
               deletion_deadline = LEAST(deletion_queue.deletion_deadline, EXCLUDED.deletion_deadline),
               cancelled_at = NULL
         WHERE deletion_queue.status <> 'completed'`,
        [userId]
      );
      await query('UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE', [userId]);
    }
    console.info('[instagram] data deletion requested', { confirmationCode, known: Boolean(userId) });

    return res.status(200).json({
      url: `${SITE}/legal/deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    console.error('[instagram] data deletion failed', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
