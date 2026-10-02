/**
 * @jest-environment node
 *
 * Route-level regression tests for PR-1 (audit C1/C2): identity must come from
 * a validated session, never from `x-user-id` / `x-user-role` headers or the
 * mere presence of a `valueskins_session` cookie.
 */
import { mockReq, mockRes, wireSessionQuery, VALID_TOKEN, SESSION_USER_ID } from './helpers';

// uuid@14 ships ESM only, which Jest's CJS runtime can't load; lib/request-context uses v4().
jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000000' }));
// These two modules start module-level setInterval timers that keep Jest alive.
jest.mock('@/lib/rate-limit', () => ({ rateLimit: () => true }));
jest.mock('@/lib/request-context', () => ({
  createRequestContext: () => ({ requestId: 'test' }),
  logRequestEnd: () => {},
}));
jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  getPool: jest.fn(),
}));
jest.mock('@/lib/razorpay', () => ({
  createOrder: jest.fn(),
  createTransfer: jest.fn(),
  verifySignature: jest.fn(),
  createContact: jest.fn(),
  createFundAccount: jest.fn(),
}));
jest.mock('@/lib/backend-client', () => ({
  backendClient: new Proxy({}, { get: () => jest.fn(async () => ({ ok: true })) }),
}));

import { query, queryOne } from '@/lib/db';
import * as razorpay from '@/lib/razorpay';

import payoutUpi from '@/pages/api/profile/payout-upi';
import payCommission from '@/pages/api/deals/[dealId]/pay-commission';
import downloadAdp from '@/pages/api/deals/[dealId]/download-adp';
import runMigrations from '@/pages/api/admin/run-migrations';
import envCheck from '@/pages/api/admin/env-check';
import financialConfig from '@/pages/api/admin/financial-config';
import notificationsGet from '@/pages/api/notifications/get';
import notificationsMarkRead from '@/pages/api/notifications/mark-read';
import creatorEarnings from '@/pages/api/creator/earnings';
import arbitration from '@/pages/api/disputes/arbitration';

const queryMock = query as unknown as jest.Mock;
const queryOneMock = queryOne as unknown as jest.Mock;
const FORGED = { cookies: { valueskins_session: 'not-a-real-session' }, headers: { 'x-user-id': '1' } };
const VALID = { cookies: { valueskins_session: VALID_TOKEN } };

let errSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  queryMock.mockReset();
  wireSessionQuery(queryMock);
  process.env.ADMIN_IDS = '1';
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errSpy.mockRestore());

/** Every non-session SQL statement the route issued. */
const businessQueries = () =>
  queryMock.mock.calls.filter(([sql]) => !/auth_sessions/i.test(String(sql)));



describe('payout UPI (the only payout destination)', () => {
  // The highest-value target in the app: whoever controls this controls where a
  // creator's earnings land. The old endpoint took creator_id from the body.
  it('rejects a forged session before contacting Razorpay', async () => {
    const res = mockRes();
    await payoutUpi(
      mockReq({
        method: 'POST',
        body: { upi_id: 'attacker@okhdfc', share_consent: true },
        ...FORGED,
      }),
      res as any
    );
    expect(res.statusCode).toBe(401);
    expect(businessQueries()).toHaveLength(0);
  });

  it('ignores an x-user-id header naming someone else', async () => {
    const res = mockRes();
    // Must resolve: session.touchSession calls .catch() on the result, so a
    // plain object here throws before the handler is even reached.
    queryMock.mockImplementation(async (sql: string) => {
      if (/auth_sessions/i.test(sql)) return { rows: [{ user_id: SESSION_USER_ID }] };
      return { rows: [] };
    });
    // The handler loads the user with queryOne. No email on file, so it stops
    // before any Razorpay call — which is the point: it looked up the SESSION
    // user, not the 999 in the header.
    queryOneMock.mockResolvedValue({
      id: SESSION_USER_ID, email: '', email_verified: false,
      display_name: 'Session User', username: 'session_user',
      bank_details_completed: false,
    });
    await payoutUpi(
      mockReq({ method: 'POST', body: { upi_id: 'x@okbank', share_consent: true }, ...VALID,
                headers: { 'x-user-id': '999' } }),
      res as any
    );
    // Acted as the session user: refused for a missing email, not 999's data.
    expect(res.statusCode).toBe(400);
  });
});

describe('admin', () => {
  it('run-migrations: an admin id in x-user-id without a session is 401', async () => {
    const res = mockRes();
    await runMigrations(mockReq({ method: 'POST', headers: { 'x-user-id': '1' } }), res as any);
    expect(res.statusCode).toBe(401);
    expect(businessQueries()).toHaveLength(0);
  });

  it('run-migrations: a valid non-admin session is 403', async () => {
    const res = mockRes();
    await runMigrations(mockReq({ method: 'POST', ...VALID }), res as any);
    expect(res.statusCode).toBe(403);
    expect(businessQueries()).toHaveLength(0);
  });

  it('env-check: header-only admin claim is 401', async () => {
    const res = mockRes();
    await envCheck(mockReq({ method: 'GET', headers: { 'x-user-id': '1' } }), res as any);
    expect(res.statusCode).toBe(401);
  });

  it('financial-config: x-user-role: admin does not grant write access', async () => {
    const res = mockRes();
    await financialConfig(mockReq({ method: 'POST', body: {}, ...VALID, headers: { 'x-user-role': 'admin' } }), res as any);
    expect(res.statusCode).toBe(403);
  });

  it('arbitration resolve-dispute: a non-admin session is 403', async () => {
    const res = mockRes();
    await arbitration(
      mockReq({ method: 'POST', body: { action: 'resolve-dispute', dispute_id: 'x', ruling: 'creator' }, ...VALID }),
      res as any
    );
    expect(res.statusCode).toBe(403);
  });
});

describe('cookie presence is not authentication', () => {
  it('pay-commission: any cookie value no longer starts a payment', async () => {
    const res = mockRes();
    await payCommission(
      mockReq({ method: 'POST', query: { dealId: '11111111-1111-1111-1111-111111111111' }, ...FORGED }),
      res as any
    );
    expect(res.statusCode).toBe(401);
    expect(businessQueries()).toHaveLength(0);
  });

  it('download-adp: a forged cookie cannot pull another deal\'s report', async () => {
    const res = mockRes();
    await downloadAdp(
      mockReq({ method: 'GET', query: { dealId: '11111111-1111-1111-1111-111111111111' }, ...FORGED }),
      res as any
    );
    expect(res.statusCode).toBe(401);
    expect(businessQueries()).toHaveLength(0);
  });

  it('creator/earnings: header identity without a session is 401', async () => {
    const res = mockRes();
    await creatorEarnings(mockReq({ method: 'GET', headers: { 'x-user-id': '5' } }), res as any);
    expect(res.statusCode).toBe(401);
  });
});

describe('notifications are scoped to the session user', () => {
  it('get ignores ?userId=', async () => {
    const res = mockRes();
    await notificationsGet(mockReq({ method: 'GET', query: { userId: '999' }, ...VALID }), res as any);
    expect(res.statusCode).toBe(200);
    const [, params] = businessQueries()[0];
    expect(params).toEqual([SESSION_USER_ID]);
  });

  it('mark-read only updates the session user\'s notification', async () => {
    const res = mockRes();
    await notificationsMarkRead(mockReq({ method: 'POST', body: { notificationId: 'n1' }, ...VALID }), res as any);
    expect(res.statusCode).toBe(200);
    const [sql, params] = businessQueries()[0];
    expect(sql).toMatch(/AND user_id = \$2/);
    expect(params).toEqual(['n1', SESSION_USER_ID]);
  });
});
