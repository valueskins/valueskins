/**
 * @jest-environment node
 *
 * Who is allowed to do what, driven as real requests against a REAL database.
 *
 * These are the rules that keep breaking: a brand reaching the creator's pages,
 * a creator posting a deal, an account with no email getting in. Each one is a
 * test here, at the handler and at the page gate, so a change that reopens any
 * of them fails before it ships.
 *
 *   npm run test:setup-db
 *   TEST_DATABASE_URL=postgresql://localhost:5432/vs_e2e npx jest role-rules
 */
import { mockReq, mockRes } from './helpers';

const TEST_DB = process.env.TEST_DATABASE_URL || '';
const describeDb = TEST_DB ? describe : describe.skip;
if (!TEST_DB) {
  // eslint-disable-next-line no-console
  console.warn('[role-rules] skipped: TEST_DATABASE_URL is not set');
}
process.env.DATABASE_URL = TEST_DB;
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_stub';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'stub';

jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/lib/rate-limit', () => ({ rateLimit: () => true }));
jest.mock('@/lib/request-context', () => ({
  createRequestContext: () => ({ requestId: 'test' }),
  logRequestEnd: () => {},
}));
// No mail and no sockets in tests.
jest.mock('@/lib/deal-emails', () => ({
  sendDealEmail: jest.fn(async () => ({ sent: true })),
  sendDealEmailToBoth: jest.fn(async () => undefined),
}));
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(async () => ({ sent: true, logged: true })),
}));
jest.mock('@/lib/deal-realtime', () => ({
  broadcastNewDeal: jest.fn(async () => undefined),
  broadcastDealUpdate: jest.fn(() => undefined),
}));
// Made-up Drive links are used here; the check itself is tested on its own.
jest.mock('@/lib/drive-link', () => ({
  ...jest.requireActual('@/lib/drive-link'),
  checkDriveLink: jest.fn(async () => 'public'),
}));
// Instagram is the one outside party at sign-in. What it "says" is set per test.
const identity = { username: '', accountType: '' };
jest.mock('@/lib/oauth', () => {
  const actual = jest.requireActual('@/lib/oauth');
  return {
    ...actual,
    exchangeInstagramCode: jest.fn(async (code: string) => ({
      access_token: 'tok',
      user_id: code.replace('code-', ''),
    })),
    getInstagramIdentity: jest.fn(async () => ({ ...identity })),
    getInstagramStats: jest.fn(async () => ({
      followers: null, bio: '', profilePicUrl: '', engagementRate: null,
    })),
  };
});

const BRAND = 7201;
const CREATOR = 7202;
const OTHER_CREATOR = 7203;
const NO_EMAIL_CREATOR = 7204;
const NO_EMAIL_BRAND = 7205;
const NO_ROLE = 7206;
// Signed in and email confirmed, but nothing else filled in yet.
const FRESH_CREATOR = 7207;
const FRESH_BRAND = 7208;
const IDS = [
  BRAND, CREATOR, OTHER_CREATOR, NO_EMAIL_CREATOR, NO_EMAIL_BRAND, NO_ROLE,
  FRESH_CREATOR, FRESH_BRAND,
];
const session = (id: number) => `rr-sess-${id}`;
const asUser = (id: number) => ({ cookies: { valueskins_session: session(id) } });
const pageCtx = (id?: number, extra: any = {}) => ({
  req: { headers: { cookie: id ? `valueskins_session=${session(id)}` : '' } },
  query: {},
  params: {},
  ...extra,
});
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describeDb('role rules (real database)', () => {
  jest.setTimeout(60_000);

  /* eslint-disable @typescript-eslint/no-var-requires */
  const { query, queryOne } = require('@/lib/db-pool');
  const createDeal = require('@/pages/api/deals/create-workflow-deal').default;
  const applications = require('@/pages/api/applications/index').default;
  const feed = require('@/pages/api/deals/feed').default;
  const payoutUpi = require('@/pages/api/profile/payout-upi').default;
  const details = require('@/pages/api/profile/details').default;
  const resume = require('@/pages/api/users/[username]/resume').default;
  const callback = require('@/pages/api/oauth/instagram/callback').default;
  /* eslint-enable @typescript-eslint/no-var-requires */

  async function cleanup() {
    await query('DELETE FROM applications WHERE creator_id = ANY($1::bigint[])', [IDS]);
    await query('DELETE FROM deals WHERE brand_id = ANY($1::bigint[])', [IDS]);
    await query('DELETE FROM auth_sessions WHERE id LIKE $1', ['rr-sess-%']);
    await query(
      `DELETE FROM auth_sessions WHERE user_id IN
         (SELECT id FROM users WHERE instagram_user_id LIKE 'rr-ig-%')`
    );
    await query(`DELETE FROM users WHERE id = ANY($1::bigint[]) OR instagram_user_id LIKE 'rr-ig-%'`, [IDS]);
  }

  beforeAll(async () => {
    await cleanup();
    await query(
      `INSERT INTO users (id, username, role, email, email_verified, instagram_user_id, instagram_account_type)
       VALUES ($1,'rr_brand','brand','brand@rr.local',true,'rr-seed-b','BUSINESS'),
              ($2,'rr_creator','creator','c1@rr.local',true,'rr-seed-c1','MEDIA_CREATOR'),
              ($3,'rr_other','creator','c2@rr.local',true,'rr-seed-c2','MEDIA_CREATOR'),
              ($4,'rr_noemail_c','creator','',false,'rr-seed-c3','MEDIA_CREATOR'),
              ($5,'rr_noemail_b','brand','',false,'rr-seed-b2','BUSINESS'),
              ($6,'rr_norole',NULL,'x@rr.local',true,'rr-seed-x',''),
              ($7,'rr_fresh_c','creator','fc@rr.local',true,'rr-seed-fc','MEDIA_CREATOR'),
              ($8,'rr_fresh_b','brand','fb@rr.local',true,'rr-seed-fb','BUSINESS')`,
      IDS
    );
    // The three working accounts have finished Settings.
    await query(
      `UPDATE users
          SET profile_locked_at = NOW(), pitch_text = 'About this account',
              payout_vpa = 'rr' || id || '@okhdfcbank', payout_name = 'Role Rules',
              payout_vpa_share_consent_at = NOW()
        WHERE id = ANY($1::bigint[])`,
      [[BRAND, CREATOR, OTHER_CREATOR]]
    );
    for (const id of IDS) {
      await query(
        `INSERT INTO auth_sessions (id, user_id, is_active, expires_at)
         VALUES ($1, $2, true, NOW() + INTERVAL '1 hour')`,
        [session(id), id]
      );
    }
  });

  afterAll(async () => {
    await cleanup();
    const { pool } = require('@/lib/db-pool');
    await pool.end();
  });

  const dealBody = () => ({
    title: 'Role rules deal', description: 'x', budget: 10000,
    application_deadline: future(7), content_upload_deadline: future(14),
    deal_deadline: future(21), publish: true,
  });

  // -- posting a deal is a brand's action -----------------------------------

  it('a creator cannot post a deal', async () => {
    const res = mockRes();
    await createDeal(mockReq({ method: 'POST', body: dealBody(), ...asUser(CREATOR) }), res as any);
    expect(res.statusCode).toBe(403);
    const made = await queryOne('SELECT COUNT(*)::int AS n FROM deals WHERE brand_id = $1', [CREATOR]);
    expect(made.n).toBe(0);
  });

  it('an account with no role cannot post a deal', async () => {
    const res = mockRes();
    await createDeal(mockReq({ method: 'POST', body: dealBody(), ...asUser(NO_ROLE) }), res as any);
    expect(res.statusCode).toBe(403);
  });

  it('a brand with no email cannot post a deal', async () => {
    const res = mockRes();
    await createDeal(mockReq({ method: 'POST', body: dealBody(), ...asUser(NO_EMAIL_BRAND) }), res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body.reason).toBe('email_required');
  });

  it('a brand that has not finished Settings cannot post a deal', async () => {
    const res = mockRes();
    await createDeal(mockReq({ method: 'POST', body: dealBody(), ...asUser(FRESH_BRAND) }), res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body.reason).toBe('setup_incomplete');
    expect(res.body.missing).toEqual(['profile', 'upi', 'about']);
    const made = await queryOne('SELECT COUNT(*)::int AS n FROM deals WHERE brand_id = $1', [FRESH_BRAND]);
    expect(made.n).toBe(0);
  });

  let dealId = '';
  it('a brand can post a deal', async () => {
    const res = mockRes();
    await createDeal(mockReq({ method: 'POST', body: dealBody(), ...asUser(BRAND) }), res as any);
    expect(res.statusCode).toBeLessThan(300);
    dealId = res.body.deal_id || res.body.dealId || res.body.id;
    expect(typeof dealId).toBe('string');
  });

  // -- browsing and applying is a creator's action ---------------------------

  it('a brand cannot read the deal feed', async () => {
    const res = mockRes();
    await feed(mockReq({ method: 'GET', ...asUser(BRAND) }), res as any);
    expect(res.statusCode).toBe(403);
  });

  it('a creator with no email cannot read the deal feed', async () => {
    const res = mockRes();
    await feed(mockReq({ method: 'GET', ...asUser(NO_EMAIL_CREATOR) }), res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body.reason).toBe('email_required');
  });

  it('a creator can read the deal feed and sees the open deal', async () => {
    const res = mockRes();
    await feed(mockReq({ method: 'GET', ...asUser(CREATOR) }), res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.deals.some((d: any) => d.id === dealId)).toBe(true);
  });

  it('a brand cannot apply to a deal, its own or anyone else\'s', async () => {
    const res = mockRes();
    await applications(mockReq({ method: 'POST', body: { deal_id: dealId }, ...asUser(BRAND) }), res as any);
    expect(res.statusCode).toBe(403);
    const n = await queryOne('SELECT COUNT(*)::int AS n FROM applications WHERE deal_id = $1', [dealId]);
    expect(n.n).toBe(0);
  });

  it('a creator with no email cannot apply', async () => {
    const res = mockRes();
    await applications(
      mockReq({ method: 'POST', body: { deal_id: dealId }, ...asUser(NO_EMAIL_CREATOR) }), res as any
    );
    expect(res.statusCode).toBe(403);
  });

  it('a creator that has not finished Settings cannot apply', async () => {
    const res = mockRes();
    await applications(
      mockReq({ method: 'POST', body: { deal_id: dealId }, ...asUser(FRESH_CREATOR) }), res as any
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.reason).toBe('setup_incomplete');
    expect(res.body.missing).toEqual(['profile', 'upi', 'about']);
    const n = await queryOne(
      'SELECT COUNT(*)::int AS n FROM applications WHERE deal_id = $1 AND creator_id = $2',
      [dealId, FRESH_CREATOR]
    );
    expect(n.n).toBe(0);
  });

  it('the setup checklist names exactly what is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const setupStatus = require('@/pages/api/profile/setup-status').default;
    const fresh = mockRes();
    await setupStatus(mockReq({ method: 'GET', ...asUser(FRESH_CREATOR) }), fresh as any);
    expect(fresh.body.complete).toBe(false);
    expect(fresh.body.items.filter((i: any) => !i.done).map((i: any) => i.key)).toEqual(['profile', 'upi', 'about']);

    const done = mockRes();
    await setupStatus(mockReq({ method: 'GET', ...asUser(CREATOR) }), done as any);
    expect(done.body.complete).toBe(true);

    // A brand is asked for a UPI ID as well.
    const brand = mockRes();
    await setupStatus(mockReq({ method: 'GET', ...asUser(BRAND) }), brand as any);
    expect(brand.body.complete).toBe(true);
    expect(brand.body.items.map((i: any) => i.key)).toContain('upi');
    const freshBrand = mockRes();
    await setupStatus(mockReq({ method: 'GET', ...asUser(FRESH_BRAND) }), freshBrand as any);
    expect(freshBrand.body.items.filter((i: any) => !i.done).map((i: any) => i.key)).toContain('upi');
  });

  it('a creator can apply', async () => {
    const res = mockRes();
    await applications(mockReq({ method: 'POST', body: { deal_id: dealId }, ...asUser(CREATOR) }), res as any);
    expect(res.statusCode).toBeLessThan(300);
  });

  // -- retired endpoints stay retired ---------------------------------------

  it.each([
    ['@/pages/api/deals/bulk-create'],
    ['@/pages/api/deals/create-with-skin'],
    ['@/pages/api/campaigns/[[...path]]'],
  ])('%s creates nothing for anyone', async (mod) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const handler = require(mod).default;
    for (const who of [BRAND, CREATOR]) {
      const res = mockRes();
      await handler(mockReq({ method: 'POST', body: dealBody(), query: { path: [] }, ...asUser(who) }), res as any);
      expect(res.statusCode).toBe(410);
    }
  });

  // -- page gates ------------------------------------------------------------

  describe('page gates', () => {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const browse = require('@/pages/deals/browse').getServerSideProps;
    const mine = require('@/pages/deals/mine').getServerSideProps;
    const campaigns = require('@/pages/campaigns/index').getServerSideProps;
    const create = require('@/pages/campaigns/create').getServerSideProps;
    /* eslint-enable @typescript-eslint/no-var-requires */
    const dest = (r: any) => r?.redirect?.destination;

    it('signed-out visitors are sent to login from every marketplace page', async () => {
      for (const gate of [browse, mine, campaigns, create]) {
        expect(dest(await gate(pageCtx() as any))).toBe('/auth/login');
      }
    });

    it('a brand never lands on a creator page', async () => {
      expect(dest(await browse(pageCtx(BRAND) as any))).toBe('/campaigns');
      expect(dest(await mine(pageCtx(BRAND) as any))).toBe('/campaigns');
    });

    it('a creator never lands on a brand page', async () => {
      expect(dest(await campaigns(pageCtx(CREATOR) as any))).toBe('/deals/browse');
      expect(dest(await create(pageCtx(CREATOR) as any))).toBe('/deals/browse');
    });

    it('each role reaches its own pages', async () => {
      expect((await browse(pageCtx(CREATOR) as any)).props).toBeDefined();
      expect((await mine(pageCtx(CREATOR) as any)).props).toBeDefined();
      expect((await campaigns(pageCtx(BRAND) as any)).props).toBeDefined();
      expect((await create(pageCtx(BRAND) as any)).props).toBeDefined();
    });

    it('a brand that has not finished Settings is sent there instead of the form', async () => {
      expect(dest(await create(pageCtx(FRESH_BRAND) as any))).toBe('/settings?setup=1');
    });

    it('an account with no email is sent to add one first', async () => {
      expect(dest(await browse(pageCtx(NO_EMAIL_CREATOR) as any))).toBe('/settings/email');
      expect(dest(await campaigns(pageCtx(NO_EMAIL_BRAND) as any))).toBe('/settings/email');
      expect(dest(await create(pageCtx(NO_EMAIL_BRAND) as any))).toBe('/settings/email');
    });

    // The two-way redirect between the role pages once looped forever for this.
    it('an account with no role gets neither side, and no redirect loop', async () => {
      for (const gate of [browse, mine, campaigns, create]) {
        expect(dest(await gate(pageCtx(NO_ROLE) as any))).toBe('/settings');
      }
    });
  });

  // -- UPI: consent is the creator's question --------------------------------

  it('a creator must agree to share their UPI ID; a brand is not asked', async () => {
    const body = { upi_id: 'rr.test@okhdfcbank', account_name: 'Role Rules' };

    const refused = mockRes();
    await payoutUpi(mockReq({ method: 'POST', body, ...asUser(CREATOR) }), refused as any);
    expect(refused.statusCode).toBe(400);
    expect(refused.body.field).toBe('share_consent');

    const creatorOk = mockRes();
    await payoutUpi(
      mockReq({ method: 'POST', body: { ...body, share_consent: true }, ...asUser(CREATOR) }), creatorOk as any
    );
    expect(creatorOk.statusCode).toBe(200);

    const brandOk = mockRes();
    await payoutUpi(mockReq({ method: 'POST', body, ...asUser(BRAND) }), brandOk as any);
    expect(brandOk.statusCode).toBe(200);
    const row = await queryOne('SELECT payout_vpa_share_consent_at FROM users WHERE id = $1', [BRAND]);
    expect(row.payout_vpa_share_consent_at).toBeNull();
  });

  // -- profile: saved once ----------------------------------------------------

  it('a creator under 18 cannot save a profile', async () => {
    const res = mockRes();
    await details(
      mockReq({
        method: 'POST',
        body: { name: 'Too Young', city: 'Pune', age: 17, gender: 'Male', followers: 10 },
        ...asUser(FRESH_CREATOR),
      }),
      res as any
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('age');
  });

  it('profile details save once; after that only followers change', async () => {
    const first = mockRes();
    await details(
      mockReq({
        method: 'POST',
        body: { name: 'Asha Rao', city: 'Pune', age: 27, gender: 'Female', followers: 1200 },
        ...asUser(FRESH_CREATOR),
      }),
      first as any
    );
    expect(first.statusCode).toBe(200);
    expect(first.body.locked).toBe(true);

    const second = mockRes();
    await details(
      mockReq({
        method: 'POST',
        body: { name: 'Someone Else', city: 'Delhi', age: 40, gender: 'Male', followers: 1500 },
        ...asUser(FRESH_CREATOR),
      }),
      second as any
    );
    expect(second.statusCode).toBe(200);
    expect(second.body).toMatchObject({ name: 'Asha Rao', city: 'Pune', age: 27, gender: 'Female', followers: 1500 });
  });

  it('finishing Settings is what lets a creator apply', async () => {
    // The profile was saved above. Add the two things still missing.
    await query(
      `UPDATE users SET pitch_text = 'I make short fashion reels.',
              payout_vpa = 'fresh@okhdfcbank', payout_name = 'Asha Rao',
              payout_vpa_share_consent_at = NOW()
        WHERE id = $1`,
      [FRESH_CREATOR]
    );
    const res = mockRes();
    await applications(
      mockReq({ method: 'POST', body: { deal_id: dealId }, ...asUser(FRESH_CREATOR) }), res as any
    );
    expect(res.statusCode).toBeLessThan(300);
  });

  // -- email on the resume ------------------------------------------------------

  it('shows a user\'s email only to someone who shares a deal with them', async () => {
    const view = async (viewer: number, username: string) => {
      const res = mockRes();
      await resume(mockReq({ method: 'GET', query: { username }, ...asUser(viewer) }), res as any);
      return res;
    };
    // CREATOR applied to BRAND's deal above; OTHER_CREATOR did not.
    expect((await view(CREATOR, 'rr_brand')).body.email).toBe('brand@rr.local');
    expect((await view(BRAND, 'rr_creator')).body.email).toBe('c1@rr.local');
    expect((await view(OTHER_CREATOR, 'rr_brand')).body.email).toBeNull();
    expect((await view(BRAND, 'rr_other')).body.email).toBeNull();
  });

  // -- past deals -------------------------------------------------------------

  describe('past deals', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const past = require('@/pages/deals/past').getServerSideProps;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const brandHome = require('@/pages/campaigns/index').getServerSideProps;
    let doneId = '';
    let cancelledId = '';

    beforeAll(async () => {
      const done = await queryOne(
        `INSERT INTO deals (brand_id, creator_id, title, description, amount, workflow_status)
         VALUES ($1, $2, 'rr finished deal', 'x', 12000, 'COMPLETED') RETURNING id`,
        [BRAND, CREATOR]
      );
      const cancelled = await queryOne(
        `INSERT INTO deals (brand_id, creator_id, title, description, amount, workflow_status, cancelled_at)
         VALUES ($1, NULL, 'rr cancelled deal', 'x', 8000, 'CANCELLED', NOW()) RETURNING id`,
        [BRAND]
      );
      doneId = done.id;
      cancelledId = cancelled.id;
    });

    const ids = (r: any) => (r.props?.deals || []).map((d: any) => d.id);

    it('signed-out visitors are sent to login', async () => {
      expect((await past(pageCtx() as any)).redirect.destination).toBe('/auth/login');
    });

    it('a brand sees its finished and cancelled deals', async () => {
      const r = await past(pageCtx(BRAND) as any);
      expect(r.props.role).toBe('brand');
      expect(ids(r)).toEqual(expect.arrayContaining([doneId, cancelledId]));
    });

    it('a creator sees only the finished deals it was confirmed on', async () => {
      const r = await past(pageCtx(CREATOR) as any);
      expect(r.props.role).toBe('creator');
      expect(ids(r)).toContain(doneId);
      expect(ids(r)).not.toContain(cancelledId);
    });

    it('nobody sees a deal they were not part of', async () => {
      expect(ids(await past(pageCtx(OTHER_CREATOR) as any))).not.toContain(doneId);
      expect(ids(await past(pageCtx(FRESH_BRAND) as any))).toEqual([]);
    });

    it('finished deals leave the brand\'s current list', async () => {
      const current = ((await brandHome(pageCtx(BRAND) as any)).props.deals || []).map((d: any) => d.id);
      expect(current).not.toContain(doneId);
      expect(current).not.toContain(cancelledId);
      expect(current).toContain(dealId);
    });

    it('the report downloads for either party to a completed deal, and nobody else', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const downloadAdp = require('@/pages/api/deals/[dealId]/download-adp').default;
      const get = async (who: number, id: string) => {
        const res = mockRes();
        await downloadAdp(mockReq({ method: 'GET', query: { dealId: id }, ...asUser(who) }), res as any);
        return res;
      };
      for (const who of [BRAND, CREATOR]) {
        const res = await get(who, doneId);
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('application/pdf');
        expect(String(res.headers['content-disposition'])).toContain('attachment');
        expect(Buffer.isBuffer(res.body) || res.body instanceof Uint8Array).toBe(true);
      }
      expect((await get(OTHER_CREATOR, doneId)).statusCode).toBe(403);
      // A cancelled deal has no report.
      expect((await get(BRAND, cancelledId)).statusCode).toBe(409);
    });
  });

  // -- the report holds the whole story ------------------------------------------

  describe('the deal report records everything', () => {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const suggestChanges = require('@/pages/api/deals/[dealId]/suggest-changes').default;
    const uploadContent = require('@/pages/api/deals/[dealId]/upload-content').default;
    const approveFinal = require('@/pages/api/deals/[dealId]/approve-final').default;
    const { collectAdpData, renderAdpPdf } = require('@/lib/adp-generator');
    const { describeDealEvent } = require('@/lib/deal-events');
    /* eslint-enable @typescript-eslint/no-var-requires */
    let id = '';
    const FIRST = 'Round one: the logo is cut off at 0:04, please reframe.';
    const SECOND = 'Round two: add the price at the end.';
    const post = async (handler: any, who: number, body: any = {}) => {
      const res = mockRes();
      await handler(mockReq({ method: 'POST', query: { dealId: id }, body, ...asUser(who) }), res as any);
      return res;
    };

    beforeAll(async () => {
      const row = await queryOne(
        `INSERT INTO deals (brand_id, creator_id, title, description, amount, workflow_status,
                            content_link, content_uploaded_at)
         VALUES ($1, $2, 'rr reviewed deal', 'x', 15000, 'CONTENT_UPLOADED',
                 'https://drive.google.com/file/d/v1/view', NOW()) RETURNING id`,
        [BRAND, CREATOR]
      );
      id = row.id;
    });

    it('keeps every change request in full, not just the latest', async () => {
      expect((await post(suggestChanges, BRAND, { feedback: FIRST })).statusCode).toBe(200);
      expect(
        (await post(uploadContent, CREATOR, { content_link: 'https://drive.google.com/file/d/v2/view' })).statusCode
      ).toBe(200);
      expect((await post(suggestChanges, BRAND, { feedback: SECOND })).statusCode).toBe(200);
      expect(
        (await post(uploadContent, CREATOR, { content_link: 'https://drive.google.com/file/d/v3/view' })).statusCode
      ).toBe(200);
      expect((await post(approveFinal, BRAND)).statusCode).toBe(200);

      const snap = await collectAdpData(id);
      const types = snap.events.map((e: any) => e.event_type);
      expect(types).toEqual([
        'CHANGES_REQUESTED', 'CONTENT_SUBMITTED', 'CHANGES_REQUESTED', 'CONTENT_SUBMITTED', 'CONTENT_APPROVED',
      ]);
      const asked = snap.events.filter((e: any) => e.event_type === 'CHANGES_REQUESTED');
      expect(asked.map((e: any) => e.detail.feedback)).toEqual([FIRST, SECOND]);
      expect(asked.map((e: any) => e.detail.round)).toEqual([1, 2]);
      // Each one says who did it and when.
      for (const e of snap.events) {
        expect(e.actor_id).not.toBeNull();
        expect(new Date(e.created_at).getTime()).not.toBeNaN();
      }
      const sent = snap.events.filter((e: any) => e.event_type === 'CONTENT_SUBMITTED');
      expect(sent.map((e: any) => e.detail.link)).toEqual([
        'https://drive.google.com/file/d/v2/view',
        'https://drive.google.com/file/d/v3/view',
      ]);
    });

    it('names both parties and renders as a PDF', async () => {
      const snap = await collectAdpData(id);
      expect(snap.names[String(BRAND)]).toBe('rr_brand');
      expect(snap.names[String(CREATOR)]).toBe('rr_creator');
      const who = (uid: number | null) => (Number(uid) === BRAND ? 'Brand @rr_brand' : 'Creator @rr_creator');
      const first = describeDealEvent(snap.events[0], who);
      expect(first.line).toContain('Brand @rr_brand asked for changes');
      expect(first.quote).toBe(FIRST);

      const pdf: Buffer = await renderAdpPdf(snap);
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
      expect(pdf.length).toBeGreaterThan(2000);
    });

    it('records applying and being confirmed', async () => {
      const events = await query(
        `SELECT event_type, actor_id FROM deal_events WHERE deal_id = $1 ORDER BY created_at, id`,
        [dealId]
      );
      const seen = events.rows.map((r: any) => `${r.event_type}:${r.actor_id}`);
      expect(seen).toContain(`DEAL_POSTED:${BRAND}`);
      expect(seen).toContain(`APPLIED:${CREATOR}`);
    });
  });

  // -- sign-in: the role is read from Instagram, never guessed -----------------

  describe('sign-in', () => {
    const signIn = async (igId: string, said: { username: string; accountType: string }) => {
      identity.username = said.username;
      identity.accountType = said.accountType;
      const res = mockRes();
      await callback(
        mockReq({
          method: 'GET',
          query: { code: `code-${igId}`, state: 'st' },
          headers: { cookie: 'oauth_state=st' },
        }),
        res as any
      );
      const user = await queryOne('SELECT id, role, username FROM users WHERE instagram_user_id = $1', [igId]);
      return { res, user };
    };

    it('a Business account becomes a brand', async () => {
      const { res, user } = await signIn('rr-ig-1', { username: 'rr_ig_brand', accountType: 'BUSINESS' });
      expect(res.body).toBe('/deals/browse');
      expect(user.role).toBe('brand');
      expect(user.username).toBe('rr_ig_brand');
    });

    it('a Creator account becomes a creator', async () => {
      const { user } = await signIn('rr-ig-2', { username: 'rr_ig_creator', accountType: 'MEDIA_CREATOR' });
      expect(user.role).toBe('creator');
    });

    // The original bug: with no type to read, everyone became a creator.
    it('with no account type from Instagram, a new account is not created', async () => {
      const { res, user } = await signIn('rr-ig-3', { username: 'rr_ig_unknown', accountType: '' });
      expect(res.body).toBe('/auth/login?error=account_type_unreadable');
      expect(user).toBeNull();
    });

    it('an unsupported account type is turned away', async () => {
      const { res, user } = await signIn('rr-ig-4', { username: 'rr_ig_personal', accountType: 'PERSONAL' });
      expect(res.body).toBe('/auth/login?error=account_type_unsupported');
      expect(user).toBeNull();
    });

    it('a confirmed account keeps its role when Instagram will not answer today', async () => {
      const { res, user } = await signIn('rr-ig-1', { username: '', accountType: '' });
      expect(res.body).toBe('/deals/browse');
      expect(user.role).toBe('brand');
      expect(user.username).toBe('rr_ig_brand');
    });

    it('a changed account type is followed only while the account has no deals', async () => {
      // rr-ig-2 has done nothing yet, so it follows Instagram.
      const moved = await signIn('rr-ig-2', { username: 'rr_ig_creator', accountType: 'BUSINESS' });
      expect(moved.user.role).toBe('brand');

      // Give it a deal, then report it as a Creator account again.
      await query(
        `INSERT INTO deals (brand_id, title, description, amount, workflow_status)
         VALUES ($1, 'kept', 'x', 5000, 'DRAFT')`,
        [moved.user.id]
      );
      const kept = await signIn('rr-ig-2', { username: 'rr_ig_creator', accountType: 'MEDIA_CREATOR' });
      expect(kept.user.role).toBe('brand');
      await query('DELETE FROM deals WHERE brand_id = $1', [moved.user.id]);
    });
  });
});
