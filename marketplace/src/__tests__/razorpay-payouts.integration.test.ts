/**
 * @jest-environment node
 *
 * The repo default is jsdom, whose fetch cannot make real outbound requests —
 * every call fails and surfaces as a transient error, which looks like a bug in
 * the client rather than a wrong test environment. These tests need Node.
 *
 * Integration tests against the real Razorpay TEST API.
 *
 * These make live network calls, so they are skipped unless RAZORPAY_KEY_ID is
 * a test key. Run with:
 *   npx jest razorpay-payouts.integration --setupFiles=./jest.env.js
 *
 * They exist because the payout path cannot be proved with mocks: the whole
 * point is that Razorpay accepts our payload shape and hands back a token, and
 * a mock would happily confirm whatever shape we invented. An earlier version of
 * this code called SDK methods that do not exist and typechecked cleanly.
 */
import {
  ensureContact,
  tokeniseAccount,
  sendPayout,
  payoutsAvailable,
  PayoutError,
} from '@/lib/razorpay-payouts';

const KEY = process.env.RAZORPAY_KEY_ID || '';
const isTestKey = KEY.startsWith('rzp_test_');

// Guard: never let these run against live credentials. tokeniseAccount on a
// live key would register a real payment instrument.
const describeLive = isTestKey ? describe : describe.skip;

if (!isTestKey) {
  // eslint-disable-next-line no-console
  console.warn(
    `[razorpay-payouts.integration] skipped: RAZORPAY_KEY_ID is ${KEY ? 'not a test key' : 'unset'}`
  );
}

// Razorpay's documented test fixtures.
const TEST_BANK = { accountNumber: '1121431121541121', ifsc: 'HDFC0000001' };
const TEST_VPA = 'success@razorpay';

describeLive('razorpay payouts (live test API)', () => {
  jest.setTimeout(60_000);

  // A fresh id per run so contact idempotency is tested honestly rather than
  // colliding with a previous run's contact.
  const userId = 900_000 + Math.floor(Math.random() * 90_000);
  let contactId = '';

  it('creates a contact', async () => {
    const result = await ensureContact({
      userId,
      name: 'Integration Creator',
      email: `it${userId}@example.com`,
    });
    expect(result.contactId).toMatch(/^cont_/);
    contactId = result.contactId;
  });

  it('is idempotent: the same user never gets a second contact', async () => {
    const again = await ensureContact({
      userId,
      name: 'Integration Creator',
      email: `it${userId}@example.com`,
    });
    expect(again.contactId).toBe(contactId);
  });

  it('tokenises a bank account and returns only a token', async () => {
    const token = await tokeniseAccount(contactId, {
      kind: 'bank',
      accountNumber: TEST_BANK.accountNumber,
      ifsc: TEST_BANK.ifsc,
      holderName: 'Integration Creator',
    });

    expect(token.fundAccountId).toMatch(/^fa_/);
    expect(token.method).toBe('bank');
    expect(token.displayHint).toBe('****1121');

    // The liability boundary. Razorpay's response echoes the full account
    // number; if any of it survives into our return value, it will end up in
    // our database.
    const serialised = JSON.stringify(token);
    expect(serialised).not.toContain(TEST_BANK.accountNumber);
    expect(serialised).not.toContain(TEST_BANK.ifsc);
  });

  it('tokenises a UPI address and returns only a token', async () => {
    const token = await tokeniseAccount(contactId, {
      kind: 'upi',
      vpa: TEST_VPA,
      holderName: 'Integration Creator',
    });
    expect(token.fundAccountId).toMatch(/^fa_/);
    expect(token.method).toBe('upi');
    expect(token.displayHint).toBe('@razorpay');
    // The handle is fine to keep; the username half is not retained.
    expect(token.displayHint).not.toContain('success');
  });

  it('classifies a bad IFSC as validation, naming the field', async () => {
    expect.assertions(3);
    try {
      await tokeniseAccount(contactId, {
        kind: 'bank',
        accountNumber: '123456',
        ifsc: 'BADCODE0001',
        holderName: 'Integration Creator',
      });
    } catch (err) {
      const e = err as PayoutError;
      expect(e.isPayoutError).toBe(true);
      expect(e.kind).toBe('validation');
      expect(typeof e.message).toBe('string');
    }
  });

  it('classifies a bad UPI address as validation', async () => {
    expect.assertions(2);
    try {
      await tokeniseAccount(contactId, {
        kind: 'upi',
        vpa: 'definitely-not-a-vpa',
        holderName: 'Integration Creator',
      });
    } catch (err) {
      const e = err as PayoutError;
      expect(e.kind).toBe('validation');
      expect(e.field).toBe('address');
    }
  });

  it('reports whether this account can actually move money out', async () => {
    const available = await payoutsAvailable();
    expect(typeof available).toBe('boolean');
    // eslint-disable-next-line no-console
    console.log(
      available
        ? '[payouts] ENABLED on these credentials'
        : '[payouts] NOT ENABLED — RazorpayX is required to pay creators'
    );
  });

  it('fails a payout cleanly when RazorpayX is not enabled', async () => {
    if (await payoutsAvailable()) {
      // eslint-disable-next-line no-console
      console.log('[payouts] enabled; skipping the not_enabled assertion');
      return;
    }
    const prior = process.env.RAZORPAYX_ACCOUNT_NUMBER;
    process.env.RAZORPAYX_ACCOUNT_NUMBER = '2323230099089097';
    try {
      await sendPayout({
        fundAccountId: 'fa_probe',
        amount: 100,
        referenceId: `test_${userId}`,
      });
      throw new Error('expected sendPayout to fail');
    } catch (err) {
      expect((err as PayoutError).kind).toBe('not_enabled');
    } finally {
      if (prior === undefined) delete process.env.RAZORPAYX_ACCOUNT_NUMBER;
      else process.env.RAZORPAYX_ACCOUNT_NUMBER = prior;
    }
  });

  it('refuses a payout with no source account configured', async () => {
    const prior = process.env.RAZORPAYX_ACCOUNT_NUMBER;
    delete process.env.RAZORPAYX_ACCOUNT_NUMBER;
    try {
      await sendPayout({ fundAccountId: 'fa_x', amount: 100, referenceId: 'r' });
      throw new Error('expected sendPayout to fail');
    } catch (err) {
      expect((err as PayoutError).kind).toBe('not_enabled');
    } finally {
      if (prior !== undefined) process.env.RAZORPAYX_ACCOUNT_NUMBER = prior;
    }
  });

  it('rejects a non-positive payout amount before calling out', async () => {
    process.env.RAZORPAYX_ACCOUNT_NUMBER = '2323230099089097';
    for (const amount of [0, -5, Number.NaN]) {
      await expect(
        sendPayout({ fundAccountId: 'fa_x', amount, referenceId: 'r' })
      ).rejects.toMatchObject({ kind: 'validation', field: 'amount' });
    }
  });
});
