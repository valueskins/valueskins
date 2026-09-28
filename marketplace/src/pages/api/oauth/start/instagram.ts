import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

// Instagram Login (via Meta) — starts the OAuth flow.
// Replaces the Google start route. Only Business/Creator Instagram accounts can
// authorize; personal accounts have no API access.
const INSTAGRAM_CLIENT_ID = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID || '';
const INSTAGRAM_REDIRECT_URI =
  process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI ||
  'http://localhost:3000/api/oauth/instagram/callback';
const STATE_COOKIE = 'oauth_state';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { role } = req.query;
  const selectedRole = role === 'brand' ? 'brand' : 'creator';

  const rawState = crypto.randomBytes(32).toString('hex');
  const state = `${selectedRole}_${rawState}`;

  const params = new URLSearchParams({
    client_id: INSTAGRAM_CLIENT_ID,
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    response_type: 'code',
    // instagram_business_basic = identity + read the creator's own profile and media (Virtual Resume data).
    // NOTE: instagram_business_manage_insights (analytics) requires Advanced Access approval.
    // Once app is approved by Meta, add it back: scope: 'instagram_business_basic,instagram_business_manage_insights'
    scope: 'instagram_business_basic',
    state,
  });

  const isSecure =
    req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${STATE_COOKIE}=${state}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=600`
  );

  return res.status(200).json({
    url: `https://www.instagram.com/oauth/authorize?${params.toString()}`,
  });
}
