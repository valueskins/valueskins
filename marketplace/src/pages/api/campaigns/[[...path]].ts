import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { getAccountId } from '@/lib/session';

let schemaReady = false;
const ok = (r: NextApiResponse, d: any) => r.status(200).json(d);
const created = (r: NextApiResponse, d: any) => r.status(201).json(d);
const bad = (r: NextApiResponse, m: string) => r.status(400).json({ error: m });
const notFound = (r: NextApiResponse) => r.status(404).json({ error: 'Not found' });
const serverError = (r: NextApiResponse, m: string) => r.status(500).json({ error: m });

async function ensureSchema() {
  if (schemaReady) return;
  await query(`CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    brief_id INTEGER REFERENCES briefs(id) ON DELETE SET NULL,
    budget_per_creator DECIMAL(12,2) DEFAULT 0,
    total_budget DECIMAL(12,2) DEFAULT 0,
    deadline TIMESTAMP,
    status VARCHAR(50) DEFAULT 'draft',
    delivery_type VARCHAR(50) DEFAULT 'no_delivery',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS campaign_invites (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    creator_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, creator_id)
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON campaigns(brand_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_campaign_invites_campaign ON campaign_invites(campaign_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_campaign_invites_creator ON campaign_invites(creator_id)');
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(50) DEFAULT 'no_delivery'`);
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS advance_pct DECIMAL(5,2) DEFAULT 30`);
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS review_period_days INTEGER DEFAULT 7`);
  await query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS usage_rights_days INTEGER DEFAULT NULL`);
  await query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS required_niches TEXT[] DEFAULT '{}'`);
  await query(`CREATE TABLE IF NOT EXISTS delivery_tracking (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    delivery_type VARCHAR(50) NOT NULL,
    brand_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    creator_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending_brand',
    access_link TEXT DEFAULT '',
    license_key TEXT DEFAULT '',
    coupon_code TEXT DEFAULT '',
    login_credentials TEXT DEFAULT '',
    courier_company VARCHAR(200) DEFAULT '',
    tracking_number VARCHAR(200) DEFAULT '',
    shipment_date TIMESTAMP,
    product_value DECIMAL(12,2) DEFAULT 0,
    product_list TEXT DEFAULT '',
    shipping_notes TEXT DEFAULT '',
    courier_receipt_url TEXT DEFAULT '',
    shipping_screenshot_url TEXT DEFAULT '',
    upload_screenshot_url TEXT DEFAULT '',
    unboxing_photo_url TEXT DEFAULT '',
    product_photo_url TEXT DEFAULT '',
    creator_confirmed_at TIMESTAMP,
    brand_confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_delivery_tracking_deal ON delivery_tracking(deal_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_delivery_tracking_status ON delivery_tracking(status)');
  schemaReady = true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Retired. This endpoint created deals or campaigns for any signed-in account
  // without checking its role, so a creator could post one. Deals are created
  // only through /api/deals/create-workflow-deal, which is brands-only.
  return res.status(410).json({ error: 'This endpoint has been retired' });
  // eslint-disable-next-line no-unreachable
  let userId = await getAccountId(req.headers.cookie || '');
  if (!userId && req.body?.user_id) {
    userId = req.body.user_id;
  }
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { path } = req.query;
  const parts = Array.isArray(path) ? path : (path || '').split('/').filter(Boolean);
  const resource = parts[0] || '';
  const id = parts[1] ? parseInt(parts[1]) : null;

  try {
    await ensureSchema();

    // ── CAMPAIGNS ──
    if (!resource || resource === 'list') {
      if (req.method === 'GET') {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const pageSize = Math.min(Math.max(1, parseInt(req.query.pageSize as string) || 20), 100);
        const offset = (page - 1) * pageSize;
        const countResult = await query('SELECT COUNT(*) as total FROM campaigns WHERE brand_id = $1', [userId]);
        const total = parseInt(countResult.rows[0]?.total || '0');
        const r = await query(`
          SELECT c.*, COUNT(ci.id) as invite_count,
            COUNT(ci.id) FILTER (WHERE ci.status = 'accepted') as accepted_count
          FROM campaigns c
          LEFT JOIN campaign_invites ci ON c.id = ci.campaign_id
          WHERE c.brand_id = $1
          GROUP BY c.id ORDER BY c.created_at DESC
          LIMIT $2 OFFSET $3`, [userId, pageSize, offset]);
        return ok(res, { campaigns: r.rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total } });
      }

      if (req.method === 'POST') {
        const { title, description, brief_id, budget_per_creator, total_budget, deadline, delivery_type, usage_rights_days, required_niches } = req.body;
        if (!title || title.trim().length < 3) return bad(res, 'Title must be at least 3 characters');
        if (title.length > 200) return bad(res, 'Title max 200 characters');
        const dt = ['no_delivery', 'digital_access', 'physical_product'].includes(delivery_type) ? delivery_type : 'no_delivery';
        const urd = typeof usage_rights_days === 'number' && usage_rights_days >= 0 && usage_rights_days <= 3650
          ? usage_rights_days : null;

        const r = await query(`INSERT INTO campaigns (brand_id, title, description, brief_id, budget_per_creator, total_budget, deadline, status, delivery_type, usage_rights_days, required_niches)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [userId, title.trim(), description || '', brief_id || null, budget_per_creator || 0, total_budget || 0,
           deadline ? new Date(deadline) : null, 'active', dt, urd, required_niches || []]);
        return created(res, { campaign: r.rows[0] });
      }
    }

    // ── CAMPAIGN BY ID ──
    if (resource === 'campaign' && id) {
      if (req.method === 'GET') {
        const campaign = await query('SELECT * FROM campaigns WHERE id = $1 AND brand_id = $2', [id, userId]);
        if (!campaign.rows[0]) return notFound(res);
        const invites = await query(
          `SELECT ci.*, a.display_name as creator_name, a.username as creator_username, a.avatar_url as creator_avatar
           FROM campaign_invites ci LEFT JOIN accounts a ON ci.creator_id = a.id
           WHERE ci.campaign_id = $1 ORDER BY ci.created_at DESC`, [id]);
        return ok(res, { campaign: campaign.rows[0], invites: invites.rows });
      }

      if (req.method === 'PATCH') {
        const { title, description, budget_per_creator, total_budget, deadline, status, delivery_type, usage_rights_days, required_niches } = req.body;
        const sets: string[] = [];
        const params: any[] = [];
        let p = 1;
        if (title !== undefined) { sets.push(`title = $${p++}`); params.push(title); }
        if (description !== undefined) { sets.push(`description = $${p++}`); params.push(description); }
        if (budget_per_creator !== undefined) { sets.push(`budget_per_creator = $${p++}`); params.push(budget_per_creator); }
        if (total_budget !== undefined) { sets.push(`total_budget = $${p++}`); params.push(total_budget); }
        if (deadline !== undefined) { sets.push(`deadline = $${p++}`); params.push(deadline ? new Date(deadline) : null); }
        if (status !== undefined) { sets.push(`status = $${p++}`); params.push(status); }
        if (delivery_type !== undefined) { sets.push(`delivery_type = $${p++}`); params.push(delivery_type); }
        if (usage_rights_days !== undefined) { sets.push(`usage_rights_days = $${p++}`); params.push(usage_rights_days); }
        if (required_niches !== undefined) { sets.push(`required_niches = $${p++}`); params.push(required_niches); }
        if (sets.length === 0) return bad(res, 'No fields to update');
        sets.push('updated_at = NOW()');
        params.push(id, userId);
        const r = await query(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${p++} AND brand_id = $${p++} RETURNING *`, params);
        if (!r.rows[0]) return notFound(res);
        return ok(res, { campaign: r.rows[0] });
      }

      if (req.method === 'DELETE') {
        await query('DELETE FROM campaigns WHERE id = $1 AND brand_id = $2', [id, userId]);
        return ok(res, { message: 'Deleted' });
      }
    }

    // ── CAMPAIGN INVITES ──
    if (resource === 'invite') {
      const campaignId = id;
      if (!campaignId) return bad(res, 'Campaign ID required');

      if (req.method === 'POST') {
        const { creatorIds } = req.body;
        if (!Array.isArray(creatorIds) || creatorIds.length === 0) return bad(res, 'creatorIds array required');
        if (creatorIds.length > 50) return bad(res, 'Max 50 creators per campaign');

        const campaign = await query('SELECT * FROM campaigns WHERE id = $1 AND brand_id = $2', [campaignId, userId]);
        if (!campaign.rows[0]) return notFound(res);

        const results: any[] = [];
        for (const cid of creatorIds) {
          try {
            const inv = await query(`INSERT INTO campaign_invites (campaign_id, creator_id, status)
              VALUES ($1, $2, 'pending') ON CONFLICT (campaign_id, creator_id)
              DO UPDATE SET status = 'pending', updated_at = NOW() RETURNING *`, [campaignId, cid]);
            results.push(inv.rows[0]);
          } catch (err: any) {
            results.push({ creator_id: cid, error: err.message });
          }
        }
        return created(res, { invites: results });
      }
    }

    // ── BRAND ACCEPT/DECLINE ── (creator facing)
    if (resource === 'respond') {
      const inviteId = id;
      if (!inviteId) return bad(res, 'Invite ID required');
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

      const invite = await query(
        'SELECT ci.*, c.title as campaign_title FROM campaign_invites ci JOIN campaigns c ON ci.campaign_id = c.id WHERE ci.id = $1',
        [inviteId]);

      if (!invite.rows[0]) return notFound(res);
      if (Number(invite.rows[0].creator_id) !== Number(userId)) return res.status(403).json({ error: 'Not your invite' });
      if (invite.rows[0].status !== 'pending') return bad(res, 'Invite already responded to');

      const { action } = req.body;
      if (action !== 'accept' && action !== 'decline') return bad(res, 'action must be accept or decline');

      await query(`UPDATE campaign_invites SET status = $1, updated_at = NOW() WHERE id = $2`, [action === 'accept' ? 'accepted' : 'declined', inviteId]);

      if (action === 'accept') {
        const dealResult = await query(
          `INSERT INTO deals (brand_id, creator_id, title, status, offer_amount, value_skin, deal_state, delivery_type, usage_rights_days)
           SELECT $1, $2, c.title, 'offer', c.budget_per_creator, '', 'offer', c.delivery_type, c.usage_rights_days
           FROM campaigns c WHERE c.id = $3 RETURNING id`,
          [invite.rows[0].campaign_id, userId, invite.rows[0].creator_id]);

        await query('UPDATE campaign_invites SET deal_id = $1 WHERE id = $2', [dealResult.rows[0].id, inviteId]);

        return created(res, { message: 'Accepted. Deal created.', dealId: dealResult.rows[0].id });
      }

      return ok(res, { message: 'Declined' });
    }

    return notFound(res);
  } catch (err: any) {
    console.error('Campaigns error:', err);
    return serverError(res, err.message || 'Server error');
  }
}
