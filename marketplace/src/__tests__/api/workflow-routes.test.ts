/**
 * @jest-environment node
 *
 * The workflow endpoints driven as real requests against a REAL database.
 *
 * Everything else tests a layer: the unit tests cover arithmetic, the e2e test
 * calls the libraries, the invariant script checks the schema. None of them
 * exercise a *handler* — so auth, ownership, input validation and the SQL had
 * never run together. This is where an IDOR or a missing role check would show
 * up, and those are the defects that matter most here: the endpoints move money.
 *
 * Razorpay is stubbed (no network, no real orders); the database is not.
 *
 *   npm run test:setup-db
 *   TEST_DATABASE_URL=postgresql://localhost:5432/vs_e2e npx jest workflow-routes
 */
import { mockReq, mockRes } from './helpers';

const TEST_DB = process.env.TEST_DATABASE_URL || '';
const describeDb = TEST_DB ? describe : describe.skip;
if (!TEST_DB) {
  // eslint-disable-next-line no-console
  console.warn('[workflow-routes] skipped: TEST_DATABASE_URL is not set');
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
// No network in tests. Orders get a deterministic id so the webhook path can
// find them again; the real thing is covered by the live integration test.
let orderSeq = 0;
jest.mock('@/lib/razorpay', () => {
  const actual = jest.requireActual('@/lib/razorpay');
  return {
    ...actual,
    createOrder: jest.fn(async () => ({
      success: true,
      data: { id: `order_stub_${++orderSeq}` },
    })),
  };
});
// Email sending would try SMTP; the audit-trail row is what matters here.
jest.mock('@/lib/deal-emails', () => ({
  sendDealEmail: jest.fn(async () => ({ sent: true })),
  sendDealEmailToBoth: jest.fn(async () => undefined),
}));

const BRAND = 7101;
const CREATOR = 7102;
const OTHER_CREATOR = 7103;
const OUTSIDER = 7104;
const BRAND_SESSION = 'sess-brand-7101';
const CREATOR_SESSION = 'sess-creator-7102';
const OTHER_SESSION = 'sess-other-7103';
const OUTSIDER_SESSION = 'sess-outsider-7104';

const asUser = (token: string) => ({ cookies: { valueskins_session: token } });

describeDb('workflow routes (real database)', () => {
  jest.setTimeout(60_000);

  /* eslint-disable @typescript-eslint/no-var-requires */
  const { query, queryOne } = require('@/lib/db-pool');
  const createDeal = require('@/pages/api/deals/create-workflow-deal').default;
  const applications = require('@/pages/api/applications/index').default;
  const decideApplication = require('@/pages/api/applications/[applicationId]').default;
  const payCommission = require('@/pages/api/deals/[dealId]/pay-commission').default;
  const payAdvance = require('@/pages/api/deals/[dealId]/pay-advance').default;
  const payRemaining = require('@/pages/api/deals/[dealId]/pay-remaining').default;
  const uploadContent = require('@/pages/api/deals/[dealId]/upload-content').default;
  const suggestChanges = require('@/pages/api/deals/[dealId]/suggest-changes').default;
  const approveFinal = require('@/pages/api/deals/[dealId]/approve-final').default;
  const cancelDeal = require('@/pages/api/deals/[dealId]/cancel').default;
  const dealApplications = require('@/pages/api/deals/[dealId]/applications').default;
  const feed = require('@/pages/api/deals/feed').default;
  const publishDeal = require('@/pages/api/deals/[dealId]/publish').default;
  const { confirmPaymentStage } = require('@/lib/deal-payments');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const future = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString();

  let dealId = '';
  let applicationId = '';

  beforeAll(async () => {
    for (const t of [
      'adp_reports', 'payouts', 'deal_workflow_payments',
      'email_communications', 'applications', 'deals',
    ]) {
      await query(`DELETE FROM ${t}`);
    }
    await query('DELETE FROM auth_sessions WHERE id LIKE $1', ['sess-%']);
    await query('DELETE FROM users WHERE id = ANY($1::bigint[])', [
      [BRAND, CREATOR, OTHER_CREATOR, OUTSIDER],
    ]);

    await query(
      `INSERT INTO users (id,username,role,email,email_verified,instagram_user_id,
                          bank_details_completed,razorpay_fund_account_id)
       VALUES ($1,'rt_brand','brand','brand@rt.local',true,'ig_b',true,''),
              ($2,'rt_creator','creator','c1@rt.local',true,'ig_c1',true,'fa_1'),
              ($3,'rt_other','creator','c2@rt.local',true,'ig_c2',true,'fa_2'),
              ($4,'rt_outsider','creator','c3@rt.local',true,'ig_c3',true,'fa_3')`,
      [BRAND, CREATOR, OTHER_CREATOR, OUTSIDER]
    );
    for (const [token, uid] of [
      [BRAND_SESSION, BRAND], [CREATOR_SESSION, CREATOR],
      [OTHER_SESSION, OTHER_CREATOR], [OUTSIDER_SESSION, OUTSIDER],
    ] as [string, number][]) {
      await query(
        `INSERT INTO auth_sessions (id,user_id,is_active,expires_at)
         VALUES ($1,$2,true,NOW() + INTERVAL '1 hour')`,
        [token, uid]
      );
    }
  });

  afterAll(async () => {
    const { pool } = require('@/lib/db-pool');
    await pool.end();
  });

  // -- creation -------------------------------------------------------------

  it('refuses deal creation without a session', async () => {
    const res = mockRes();
    await createDeal(
      mockReq({ method: 'POST', body: { title: 'x', description: 'y', budget: 10000 } }),
      res as any
    );
    expect(res.statusCode).toBe(401);
  });

  it('refuses deal creation by a creator', async () => {
    const res = mockRes();
    await createDeal(
      mockReq({
        method: 'POST',
        body: {
          title: 'Creator tries to post', description: 'x', budget: 10000,
          application_deadline: future(7), content_upload_deadline: future(14),
          deal_deadline: future(21),
        },
        ...asUser(CREATOR_SESSION),
      }),
      res as any
    );
    expect(res.statusCode).toBe(403);
  });

  it('rejects a budget at or below the commission', async () => {
    const res = mockRes();
    await createDeal(
      mockReq({
        method: 'POST',
        body: {
          title: 'Too small', description: 'x', budget: 885,
          application_deadline: future(7), content_upload_deadline: future(14),
          deal_deadline: future(21),
        },
        ...asUser(BRAND_SESSION),
      }),
      res as any
    );
    // 885 would leave the creator nothing, and the 30/70 split would be zero.
    expect(res.statusCode).toBe(400);
  });

  // Validation must not depend on `publish`: a draft saved with a content
  // deadline before its application deadline would only fail much later.
  it('rejects deadlines in the wrong order, published or not', async () => {
    for (const publish of [true, false]) {
      const res = mockRes();
      await createDeal(
        mockReq({
          method: 'POST',
          body: {
            title: 'Bad dates', description: 'x', budget: 10000,
            application_deadline: future(14),
            content_upload_deadline: future(7), // before applications close
            deal_deadline: future(21),
            publish,
          },
          ...asUser(BRAND_SESSION),
        }),
        res as any
      );
      expect(res.statusCode).toBe(400);
    }
  });

  // A draft with no way to go live is a dead end, which is what this caught.
  it('saves a draft and publishes it', async () => {
    const created = mockRes();
    await createDeal(
      mockReq({
        method: 'POST',
        body: {
          title: 'Draft Deal', description: 'later', budget: 20000,
          application_deadline: future(5), content_upload_deadline: future(10),
          deal_deadline: future(15), publish: false,
        },
        ...asUser(BRAND_SESSION),
      }),
      created as any
    );
    expect(created.statusCode).toBe(201);
    expect(created.body.workflow_status).toBe('DRAFT');
    const draftId = created.body.deal_id;

    // Not visible while it is a draft.
    const hidden = mockRes();
    await feed(mockReq({ method: 'GET', query: {}, ...asUser(CREATOR_SESSION) }), hidden as any);
    expect(hidden.body.deals.find((d: any) => d.id === draftId)).toBeFalsy();

    // Only the owning brand may publish it.
    const stranger = mockRes();
    await publishDeal(
      mockReq({ method: 'POST', query: { dealId: draftId }, ...asUser(OUTSIDER_SESSION) }),
      stranger as any
    );
    expect(stranger.statusCode).toBe(403);

    const res = mockRes();
    await publishDeal(
      mockReq({ method: 'POST', query: { dealId: draftId }, ...asUser(BRAND_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.workflow_status).toBe('OPEN');

    // Now on the feed, and publishing twice is refused.
    const shown = mockRes();
    await feed(mockReq({ method: 'GET', query: {}, ...asUser(CREATOR_SESSION) }), shown as any);
    expect(shown.body.deals.find((d: any) => d.id === draftId)).toBeTruthy();

    const again = mockRes();
    await publishDeal(
      mockReq({ method: 'POST', query: { dealId: draftId }, ...asUser(BRAND_SESSION) }),
      again as any
    );
    expect(again.statusCode).toBe(409);
  });

  it('creates and publishes a deal for the brand', async () => {
    const res = mockRes();
    await createDeal(
      mockReq({
        method: 'POST',
        body: {
          title: 'Route Test Deal', description: '3 posts + 1 reel', budget: 10000,
          application_deadline: future(7), content_upload_deadline: future(14),
          deal_deadline: future(21), publish: true,
        },
        ...asUser(BRAND_SESSION),
      }),
      res as any
    );
    expect(res.statusCode).toBe(201);
    expect(res.body.workflow_status).toBe('OPEN');
    dealId = res.body.deal_id;
  });

  // -- feed and applying ----------------------------------------------------

  it('shows the open deal on the feed', async () => {
    const res = mockRes();
    await feed(mockReq({ method: 'GET', query: {}, ...asUser(CREATOR_SESSION) }), res as any);
    expect(res.statusCode).toBe(200);
    const found = res.body.deals.find((d: any) => d.id === dealId);
    expect(found).toBeTruthy();
    expect(found.applications_open).toBe(true);
    expect(found.already_applied).toBe(false);
  });

  it('lets a creator apply', async () => {
    const res = mockRes();
    await applications(
      mockReq({ method: 'POST', body: { deal_id: dealId }, ...asUser(CREATOR_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(201);
    applicationId = res.body.application_id;
  });

  it('refuses a second application from the same creator', async () => {
    const res = mockRes();
    await applications(
      mockReq({ method: 'POST', body: { deal_id: dealId }, ...asUser(CREATOR_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(409);
  });

  it('refuses an application from a brand', async () => {
    const res = mockRes();
    await applications(
      mockReq({ method: 'POST', body: { deal_id: dealId }, ...asUser(BRAND_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(403);
  });

  // The applicant list reveals who else is competing, so it is brand-only.
  it('hides the applicant list from creators', async () => {
    const res = mockRes();
    await dealApplications(
      mockReq({ method: 'GET', query: { dealId }, ...asUser(CREATOR_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(403);
  });

  it('shows the applicant list to the owning brand', async () => {
    const other = mockRes();
    await applications(
      mockReq({ method: 'POST', body: { deal_id: dealId }, ...asUser(OTHER_SESSION) }),
      other as any
    );
    expect(other.statusCode).toBe(201);

    const res = mockRes();
    await dealApplications(
      mockReq({ method: 'GET', query: { dealId }, ...asUser(BRAND_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.applications).toHaveLength(2);
  });

  // -- confirmation ---------------------------------------------------------

  it('refuses confirmation by anyone but the owning brand', async () => {
    for (const token of [CREATOR_SESSION, OUTSIDER_SESSION]) {
      const res = mockRes();
      await decideApplication(
        mockReq({
          method: 'PATCH', query: { applicationId },
          body: { action: 'confirm' }, ...asUser(token),
        }),
        res as any
      );
      expect(res.statusCode).toBe(403);
    }
  });

  it('confirms one creator and rejects the rest', async () => {
    const res = mockRes();
    await decideApplication(
      mockReq({
        method: 'PATCH', query: { applicationId },
        body: { action: 'confirm' }, ...asUser(BRAND_SESSION),
      }),
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.others_rejected).toBe(1);
    expect(res.body.commission_due).toBe(885);

    const d = await queryOne(
      'SELECT workflow_status, creator_id FROM deals WHERE id=$1',
      [dealId]
    );
    expect(d.workflow_status).toBe('CONFIRMED');
    expect(Number(d.creator_id)).toBe(CREATOR);
  });

  // -- payments -------------------------------------------------------------

  // The whole point of the rewrite: the amount is the server's to decide.
  it('ignores any amount the caller sends and uses the deal budget', async () => {
    const res = mockRes();
    await payCommission(
      mockReq({
        method: 'POST', query: { dealId },
        body: { amount: 1, amount_paise: 100, budget: 1 },
        ...asUser(BRAND_SESSION),
      }),
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.amount).toBe(885);
    expect(res.body.amount_paise).toBe(88500);
  });

  it('refuses payment by anyone but the owning brand', async () => {
    for (const token of [CREATOR_SESSION, OUTSIDER_SESSION]) {
      const res = mockRes();
      await payCommission(
        mockReq({ method: 'POST', query: { dealId }, ...asUser(token) }),
        res as any
      );
      expect(res.statusCode).toBe(403);
    }
  });

  it('refuses a stage that is out of order', async () => {
    // Commission has not been confirmed yet, so the advance cannot start.
    const res = mockRes();
    await payAdvance(
      mockReq({ method: 'POST', query: { dealId }, ...asUser(BRAND_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(409);
  });

  it('advances to COMMISSION_PAID when the webhook confirms', async () => {
    const order = await queryOne(
      `SELECT razorpay_order_id FROM deal_workflow_payments
        WHERE deal_id=$1 AND type='COMMISSION' AND status='PENDING'
        ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );
    const result = await confirmPaymentStage({
      orderId: order.razorpay_order_id,
      paymentId: 'pay_rt_commission',
    });
    expect(result.newStatus).toBe('COMMISSION_PAID');
  });

  it('refuses to charge a confirmed stage twice', async () => {
    const res = mockRes();
    await payCommission(
      mockReq({ method: 'POST', query: { dealId }, ...asUser(BRAND_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(409);
  });

  it('takes the advance and reaches ADVANCE_PAID', async () => {
    const res = mockRes();
    await payAdvance(
      mockReq({ method: 'POST', query: { dealId }, ...asUser(BRAND_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.amount).toBe(2734.5);

    const order = await queryOne(
      `SELECT razorpay_order_id FROM deal_workflow_payments
        WHERE deal_id=$1 AND type='ADVANCE' AND status='PENDING'
        ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );
    const result = await confirmPaymentStage({
      orderId: order.razorpay_order_id,
      paymentId: 'pay_rt_advance',
    });
    expect(result.newStatus).toBe('ADVANCE_PAID');
  });

  // -- cancellation ---------------------------------------------------------

  // Spec: no refund after the commission, and no cancelling after the advance.
  it('refuses cancellation once money has moved', async () => {
    const res = mockRes();
    await cancelDeal(
      mockReq({
        method: 'POST', query: { dealId },
        body: { reason: 'changed my mind' }, ...asUser(BRAND_SESSION),
      }),
      res as any
    );
    expect(res.statusCode).toBe(409);
    expect(String(res.body.error)).toMatch(/advance|non-refundable/i);
  });

  it('never lets a creator cancel', async () => {
    const res = mockRes();
    await cancelDeal(
      mockReq({ method: 'POST', query: { dealId }, ...asUser(CREATOR_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(403);
  });

  // -- content --------------------------------------------------------------

  it('refuses content upload from anyone but the confirmed creator', async () => {
    for (const token of [BRAND_SESSION, OTHER_SESSION, OUTSIDER_SESSION]) {
      const res = mockRes();
      await uploadContent(
        mockReq({
          method: 'POST', query: { dealId },
          body: { content_link: 'https://drive.google.com/file/d/x/view' },
          ...asUser(token),
        }),
        res as any
      );
      expect(res.statusCode).toBe(403);
    }
  });

  // A deal page renders this link, so a non-Drive host would be a way to send
  // the brand somewhere the attacker controls.
  it('rejects a content link that is not Google Drive or https', async () => {
    for (const link of [
      'https://evil.example.com/payload',
      'http://drive.google.com/file/d/x/view',
      'javascript:alert(1)',
      'not a url',
      '',
    ]) {
      const res = mockRes();
      await uploadContent(
        mockReq({
          method: 'POST', query: { dealId },
          body: { content_link: link }, ...asUser(CREATOR_SESSION),
        }),
        res as any
      );
      expect(res.statusCode).toBe(400);
    }
  });

  it('accepts a Drive link from the confirmed creator', async () => {
    const res = mockRes();
    await uploadContent(
      mockReq({
        method: 'POST', query: { dealId },
        body: { content_link: 'https://drive.google.com/file/d/rt1/view' },
        ...asUser(CREATOR_SESSION),
      }),
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.workflow_status).toBe('CONTENT_UPLOADED');
  });

  it('runs a revision round', async () => {
    const reject = mockRes();
    await suggestChanges(
      mockReq({
        method: 'POST', query: { dealId },
        body: { feedback: 'Brighter colours please' }, ...asUser(CREATOR_SESSION),
      }),
      reject as any
    );
    expect(reject.statusCode).toBe(403); // creators cannot request revisions

    const res = mockRes();
    await suggestChanges(
      mockReq({
        method: 'POST', query: { dealId },
        body: { feedback: 'Brighter colours please' }, ...asUser(BRAND_SESSION),
      }),
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.workflow_status).toBe('REVISION_REQUESTED');

    const reupload = mockRes();
    await uploadContent(
      mockReq({
        method: 'POST', query: { dealId },
        body: { content_link: 'https://drive.google.com/file/d/rt2/view' },
        ...asUser(CREATOR_SESSION),
      }),
      reupload as any
    );
    expect(reupload.statusCode).toBe(200);
    expect(reupload.body.revision_count).toBe(1);
  });

  it('rejects empty feedback', async () => {
    const res = mockRes();
    await suggestChanges(
      mockReq({
        method: 'POST', query: { dealId },
        body: { feedback: '   ' }, ...asUser(BRAND_SESSION),
      }),
      res as any
    );
    expect(res.statusCode).toBe(400);
  });

  // -- approval and the final payment --------------------------------------

  it('refuses approval by anyone but the brand, then approves', async () => {
    const bad = mockRes();
    await approveFinal(
      mockReq({ method: 'POST', query: { dealId }, ...asUser(CREATOR_SESSION) }),
      bad as any
    );
    expect(bad.statusCode).toBe(403);

    const res = mockRes();
    await approveFinal(
      mockReq({ method: 'POST', query: { dealId }, ...asUser(BRAND_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.workflow_status).toBe('APPROVED_FOR_FINAL_PAYMENT');
    expect(res.body.final_due).toBe(6380.5);
  });

  it('completes the deal on the final payment', async () => {
    const res = mockRes();
    await payRemaining(
      mockReq({ method: 'POST', query: { dealId }, ...asUser(BRAND_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.amount).toBe(6380.5);

    const order = await queryOne(
      `SELECT razorpay_order_id FROM deal_workflow_payments
        WHERE deal_id=$1 AND type='FINAL' AND status='PENDING'
        ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );
    const result = await confirmPaymentStage({
      orderId: order.razorpay_order_id,
      paymentId: 'pay_rt_final',
    });
    expect(result.newStatus).toBe('COMPLETED');
  });

  it('accounts for every rupee of the budget', async () => {
    const rows = await query(
      `SELECT type, amount::numeric AS amount FROM deal_workflow_payments
        WHERE deal_id=$1 AND status='CONFIRMED'`,
      [dealId]
    );
    expect(rows.rows).toHaveLength(3);
    const total = rows.rows.reduce((s: number, r: any) => s + Number(r.amount), 0);
    expect(Math.round(total * 100) / 100).toBe(10000);
  });

  // -- terminal states, expiry, and a passed-over creator -------------------
  //
  // These all passed when probed by hand. Committed so they stay that way: each
  // is a place where a stale client or a guessed URL could act on a deal that
  // has moved past the point of accepting the action.

  it('refuses an application once the deadline has passed', async () => {
    const expired = await queryOne(
      `INSERT INTO deals (brand_id,title,description,amount,workflow_status,
          application_deadline,content_upload_deadline,deal_deadline,published_at)
       VALUES ($1,'Expired','x',10000,'OPEN',
          NOW()-INTERVAL '1 day',NOW()+INTERVAL '5 days',NOW()+INTERVAL '10 days',NOW())
       RETURNING id`,
      [BRAND]
    );
    const res = mockRes();
    await applications(
      mockReq({ method: 'POST', body: { deal_id: expired.id }, ...asUser(OUTSIDER_SESSION) }),
      res as any
    );
    expect(res.statusCode).toBe(409);

    // Still listed, but flagged closed: the feed shows it without an apply path.
    const feedRes = mockRes();
    await feed(mockReq({ method: 'GET', query: {}, ...asUser(OUTSIDER_SESSION) }), feedRes as any);
    const row = feedRes.body.deals.find((d: any) => d.id === expired.id);
    if (row) expect(row.applications_open).toBe(false);
  });

  it('keeps a passed-over creator out of the deal they lost', async () => {
    // OTHER_CREATOR applied earlier and was auto-rejected when CREATOR won.
    const upload = mockRes();
    await uploadContent(
      mockReq({
        method: 'POST', query: { dealId },
        body: { content_link: 'https://drive.google.com/file/d/nope/view' },
        ...asUser(OTHER_SESSION),
      }),
      upload as any
    );
    expect(upload.statusCode).toBe(403);
  });

  it('refuses every action on a cancelled deal', async () => {
    const cancelled = await queryOne(
      `INSERT INTO deals (brand_id,title,description,amount,workflow_status,
          application_deadline,content_upload_deadline,deal_deadline,published_at,cancelled_at)
       VALUES ($1,'Cancelled','x',10000,'CANCELLED',
          NOW()+INTERVAL '7 days',NOW()+INTERVAL '14 days',NOW()+INTERVAL '21 days',NOW(),NOW())
       RETURNING id`,
      [BRAND]
    );
    for (const [handler, token] of [
      [payCommission, BRAND_SESSION],
      [cancelDeal, BRAND_SESSION],
      [approveFinal, BRAND_SESSION],
    ] as [any, string][]) {
      const res = mockRes();
      await handler(
        mockReq({ method: 'POST', query: { dealId: cancelled.id }, body: {}, ...asUser(token) }),
        res as any
      );
      expect(res.statusCode).toBe(409);
    }

    const applyRes = mockRes();
    await applications(
      mockReq({ method: 'POST', body: { deal_id: cancelled.id }, ...asUser(OUTSIDER_SESSION) }),
      applyRes as any
    );
    expect(applyRes.statusCode).toBe(409);
  });

  it('refuses every action on a completed deal', async () => {
    // `dealId` reached COMPLETED earlier in this file.
    for (const [handler, token, body] of [
      [payRemaining, BRAND_SESSION, {}],
      [approveFinal, BRAND_SESSION, {}],
      [cancelDeal, BRAND_SESSION, {}],
      [suggestChanges, BRAND_SESSION, { feedback: 'more' }],
      [uploadContent, CREATOR_SESSION, { content_link: 'https://drive.google.com/file/d/z/view' }],
    ] as [any, string, any][]) {
      const res = mockRes();
      await handler(
        mockReq({ method: 'POST', query: { dealId }, body, ...asUser(token) }),
        res as any
      );
      expect(res.statusCode).toBe(409);
    }
  });

  it('rejects budgets that are not usable money', async () => {
    const dates = {
      application_deadline: future(7),
      content_upload_deadline: future(14),
      deal_deadline: future(21),
    };
    for (const budget of [-10000, 0, 885, '10000; DROP TABLE deals', null, Number.NaN] as any[]) {
      const res = mockRes();
      await createDeal(
        mockReq({
          method: 'POST',
          body: { title: 'Edge', description: 'd', budget, ...dates },
          ...asUser(BRAND_SESSION),
        }),
        res as any
      );
      expect(res.statusCode).toBe(400);
    }

    // One rupee over the commission is the smallest viable deal.
    const ok = mockRes();
    await createDeal(
      mockReq({
        method: 'POST',
        body: { title: 'Smallest', description: 'd', budget: 886, ...dates },
        ...asUser(BRAND_SESSION),
      }),
      ok as any
    );
    expect(ok.statusCode).toBe(201);
  });

  // -- IDOR sweep -----------------------------------------------------------

  // A random uuid must never leak another deal's state, whoever is asking.
  it('answers 404, not 403, for a deal that does not exist', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    for (const handler of [payCommission, uploadContent, approveFinal, dealApplications]) {
      const res = mockRes();
      await handler(
        mockReq({
          method: handler === dealApplications ? 'GET' : 'POST',
          query: { dealId: ghost },
          body: { content_link: 'https://drive.google.com/file/d/x/view' },
          ...asUser(BRAND_SESSION),
        }),
        res as any
      );
      expect(res.statusCode).toBe(404);
    }
  });

  it('rejects a malformed deal id without touching the database', async () => {
    for (const bad of ['not-a-uuid', '../../etc/passwd', "1' OR '1'='1", '']) {
      const res = mockRes();
      await payCommission(
        mockReq({ method: 'POST', query: { dealId: bad }, ...asUser(BRAND_SESSION) }),
        res as any
      );
      expect(res.statusCode).toBe(404);
    }
  });
});
