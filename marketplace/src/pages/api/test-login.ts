// TEMPORARY TEST ONLY - Bypasses database for workflow testing
// Once real database is available, delete this and use /api/dev-login

import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow on localhost in development
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }

  const host = (req.headers.host || '').split(':')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') {
    return res.status(404).json({ error: 'Not found' });
  }

  const role = req.query.as === 'brand' ? 'brand' : 'creator';
  const sessionId = crypto.randomUUID();
  const userId = role === 'brand' ? '999001' : '999002';

  // Create a mock session cookie (format: userid:role:sessionid)
  const mockSession = Buffer.from(`${userId}:${role}:${sessionId}`).toString('base64');

  res.setHeader('Set-Cookie', [
    `valueskins_session=${mockSession}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${12 * 3600}`,
    `user_role=${role}; Path=/; Max-Age=${12 * 3600}`,
    `user_id=${userId}; Path=/; Max-Age=${12 * 3600}`,
  ]);

  // Redirect to home page based on role
  const redirectUrl = role === 'brand' ? '/campaigns/create' : '/deals/browse';
  return res.redirect(302, redirectUrl);
}
