// GET  — the account's own details, shaped for its role.
// POST — save them.
//
// A creator is a person and a brand is a business, so they do not fill in the
// same form: a creator has a name and a city; a brand has a brand name, a
// website and a city. The role is read from the account, never from the
// request, so a caller cannot write the other role's fields.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';

// Letters in any script, digits, spaces and the punctuation names really use.
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} .,'&()\-]{1,79}$/u;
const CITY_RE = /^[\p{L}][\p{L} .'\-]{1,59}$/u;

function cleanWebsite(raw: unknown): { ok: true; value: string } | { ok: false } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: '' };
  if (typeof raw !== 'string' || raw.length > 200) return { ok: false };
  const candidate = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  try {
    const url = new URL(candidate);
    // Only web addresses: this is rendered as a link to other users.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false };
    if (!url.hostname.includes('.')) return { ok: false };
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  const row = await queryOne(
    'SELECT role, display_name, location, website FROM users WHERE id = $1',
    [userId]
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  const u = row as any;
  const role: 'brand' | 'creator' = u.role === 'brand' ? 'brand' : 'creator';

  if (req.method === 'GET') {
    // Login writes a stand-in display name until the user gives a real one.
    const placeholder = /^(@|IG User |Instagram user$)/.test(u.display_name || '');
    return res.status(200).json({
      role,
      name: placeholder ? '' : u.display_name || '',
      city: u.location || '',
      ...(role === 'brand' ? { website: u.website || '' } : {}),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const city = typeof body.city === 'string' ? body.city.trim().replace(/\s+/g, ' ') : '';

  if (!NAME_RE.test(name)) {
    return res.status(400).json({
      error: role === 'brand' ? 'Enter your brand name.' : 'Enter your full name.',
      field: 'name',
    });
  }
  if (!CITY_RE.test(city)) {
    return res.status(400).json({ error: 'Enter your city.', field: 'city' });
  }

  let website = u.website || '';
  if (role === 'brand') {
    const w = cleanWebsite(body.website);
    if (!w.ok) {
      return res.status(400).json({ error: 'Enter a valid website address, or leave it blank.', field: 'website' });
    }
    website = w.value;
  }

  try {
    await query(
      `UPDATE users SET display_name = $2, location = $3, website = $4, country = 'India' WHERE id = $1`,
      [userId, name, city, website]
    );
    return res.status(200).json({
      role, name, city,
      ...(role === 'brand' ? { website } : {}),
    });
  } catch (err) {
    console.error('[profile/details] save failed', { userId });
    return res.status(500).json({ error: 'Could not save' });
  }
}
