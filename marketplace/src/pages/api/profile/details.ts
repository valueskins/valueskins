// GET  — the account's own profile essentials, shaped for its role.
// POST — save them once; afterwards only the follower count can change.
//
// These are what the other side of a deal sees on the virtual resume, so they
// are entered once and then fixed: a profile that could be rewritten between
// deals would not be worth reading. The follower count is the exception, since
// it genuinely changes. Age needs no editing either: it is stored with the
// moment it was given and advances by itself.
//
// A creator is a person and a brand is a business, so the two do not fill in
// the same form. The role is read from the account, never from the request.
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { query, queryOne } from '@/lib/db-pool';
import {
  GENDERS, MIN_AGE, MAX_AGE, MAX_FOLLOWERS, CURRENT_AGE_SQL, isPlaceholderName,
} from '@/lib/profile-essentials';

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

function wholeNumber(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^[0-9]{1,10}$/.test(raw.trim()) ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

async function read(userId: string) {
  const row = await queryOne(
    `SELECT role, display_name, location, website, gender, followers_count,
            profile_locked_at, ${CURRENT_AGE_SQL} AS current_age
       FROM users WHERE id = $1`,
    [userId]
  );
  if (!row) return null;
  const u = row as any;
  const role: 'brand' | 'creator' = u.role === 'brand' ? 'brand' : 'creator';
  return {
    role,
    locked: !!u.profile_locked_at,
    name: isPlaceholderName(u.display_name) ? '' : u.display_name,
    city: u.location || '',
    followers: Number(u.followers_count) || 0,
    ...(role === 'brand'
      ? { website: u.website || '' }
      : { age: u.current_age === null || u.current_age === undefined ? null : Number(u.current_age), gender: u.gender || '' }),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  const current = await read(userId);
  if (!current) return res.status(404).json({ error: 'Not found' });

  if (req.method === 'GET') return res.status(200).json(current);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  const followers = wholeNumber(body.followers, 0, MAX_FOLLOWERS);
  if (followers === null) {
    return res.status(400).json({ error: 'Enter your follower count as a whole number.', field: 'followers' });
  }

  try {
    // Already saved once: the follower count is the only thing that moves.
    // Anything else in the request is ignored rather than trusted.
    if (current.locked) {
      await query('UPDATE users SET followers_count = $2 WHERE id = $1', [userId, followers]);
      return res.status(200).json(await read(userId));
    }

    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    const city = typeof body.city === 'string' ? body.city.trim().replace(/\s+/g, ' ') : '';
    if (!NAME_RE.test(name)) {
      return res.status(400).json({
        error: current.role === 'brand' ? 'Enter your brand name.' : 'Enter your full name.',
        field: 'name',
      });
    }
    if (!CITY_RE.test(city)) {
      return res.status(400).json({ error: 'Enter your city.', field: 'city' });
    }

    if (current.role === 'brand') {
      const w = cleanWebsite(body.website);
      if (!w.ok) {
        return res.status(400).json({ error: 'Enter a valid website address, or leave it blank.', field: 'website' });
      }
      // The WHERE clause makes the lock atomic: two simultaneous first saves
      // cannot both land.
      const done = await query(
        `UPDATE users
            SET display_name = $2, location = $3, website = $4, followers_count = $5,
                country = 'India', profile_locked_at = NOW()
          WHERE id = $1 AND profile_locked_at IS NULL
          RETURNING id`,
        [userId, name, city, w.value, followers]
      );
      if ((done.rows || []).length === 0) {
        return res.status(409).json({ error: 'These details have already been saved.' });
      }
      return res.status(200).json(await read(userId));
    }

    const age = wholeNumber(body.age, MIN_AGE, MAX_AGE);
    if (age === null) {
      return res.status(400).json({ error: `Enter your age. You must be ${MIN_AGE} or over.`, field: 'age' });
    }
    const gender = typeof body.gender === 'string' ? body.gender : '';
    if (!(GENDERS as readonly string[]).includes(gender)) {
      return res.status(400).json({ error: 'Choose an option for gender.', field: 'gender' });
    }

    const done = await query(
      `UPDATE users
          SET display_name = $2, location = $3, age = $4, age_recorded_at = NOW(),
              gender = $5, followers_count = $6, country = 'India', profile_locked_at = NOW()
        WHERE id = $1 AND profile_locked_at IS NULL
        RETURNING id`,
      [userId, name, city, age, gender, followers]
    );
    if ((done.rows || []).length === 0) {
      return res.status(409).json({ error: 'These details have already been saved.' });
    }
    return res.status(200).json(await read(userId));
  } catch (err) {
    console.error('[profile/details] save failed', { userId });
    return res.status(500).json({ error: 'Could not save' });
  }
}
