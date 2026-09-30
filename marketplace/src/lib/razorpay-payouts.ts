// Razorpay payout client: contacts, fund accounts, payouts.
//
// WHY THIS EXISTS AND NOT lib/razorpay.ts
// The razorpay npm SDK (2.9.6) does not expose these. Its instance has
// `fundAccount` (singular, and its fetch() is keyed by customer_id, not
// contact_id) and has no `contacts` or `payouts` resource at all. The helpers
// in lib/razorpay.ts call `razorpay.contacts`, `razorpay.fundAccounts` and
// `razorpay.payouts`, all of which are undefined at runtime — they throw
// TypeError on first use. This module talks to the REST API directly instead.
//
// THE CORE RULE: WE NEVER STORE BANK DETAILS
// An account number or UPI address passes through this process exactly once, in
// memory, on its way to Razorpay. Razorpay returns an opaque `fa_...` token and
// that token is all we keep. Razorpay is then the custodian of record, which is
// the whole point: it keeps our database free of payment instruments and keeps
// that liability with a PCI-DSS audited processor.
//
// Two consequences that are easy to get wrong:
//   1. The /fund_accounts RESPONSE echoes the full account number back. So the
//      response must never be logged, returned to a caller, or persisted. The
//      functions below deliberately destructure out only the id and a masked
//      hint and let the rest go out of scope.
//   2. Nothing here may log its arguments. Error paths are the usual leak: a
//      `console.error(err, params)` added later would write account numbers to
//      the log aggregator. Only ids, HTTP status and Razorpay's own `field`
//      name are ever logged.

const API_BASE = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

export class PayoutError extends Error {
  readonly isPayoutError = true;
  constructor(
    message: string,
    readonly kind:
      | 'validation'      // caller's data is wrong; safe to show the user
      | 'not_enabled'     // RazorpayX not activated on this account
      | 'auth'            // our credentials are wrong
      | 'transient'       // retryable; Razorpay or the network faltered
      | 'unknown',
    readonly field?: string
  ) {
    super(message);
    this.name = 'PayoutError';
  }
}

function credentials(): string {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) {
    throw new PayoutError('Payments are not configured', 'unknown');
  }
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

interface RawResult {
  status: number;
  body: any;
}

/**
 * One authenticated REST call, with a timeout and retries on transient faults.
 *
 * `body` is sent and then dropped: it is never logged, and never returned in an
 * error, because for fund-account calls it holds the account number.
 */
async function request(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<RawResult> {
  const auth = credentials();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    // A hung request would otherwise burn the whole function timeout.
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      let parsed: any;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = { raw: text.slice(0, 200) };
      }

      // Retry server-side faults; a 4xx is our fault and will not improve.
      if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
        await backoff(attempt);
        continue;
      }
      return { status: res.status, body: parsed };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await backoff(attempt);
        continue;
      }
    }
  }

  console.error('[razorpay-payouts] request failed after retries', {
    path,
    // The message only; an error object can carry the request body in `cause`.
    reason: lastError instanceof Error ? lastError.message : 'unknown',
  });
  throw new PayoutError('Could not reach the payment provider', 'transient');
}

const backoff = (attempt: number) =>
  new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));

/** Maps a Razorpay error response onto a PayoutError, without echoing values. */
function toPayoutError(result: RawResult, context: string): PayoutError {
  const err = result.body?.error || {};
  const description: string = err.description || 'Payment provider rejected the request';
  const field: string | undefined = err.field;

  if (result.status === 401 || result.status === 403) {
    console.error(`[razorpay-payouts] auth rejected during ${context}`);
    return new PayoutError('Payment provider authentication failed', 'auth');
  }

  // A missing or wrong RazorpayX account is a configuration problem, not bad
  // caller data, so it must classify as not_enabled. This distinction decides
  // whether the worker holds a payout or fails it permanently: Razorpay reports
  // it as a plain 400, which would otherwise fall through to 'validation' below
  // and mark a creator's payout FAILED for a reason a retry would fix.
  //
  // Verified against the live test API — these are the actual strings:
  //   "The account number field is required."
  //   "The RazorpayX Account number is invalid."
  //   "Access to requested resource not available"
  if (
    /razorpayx account number/i.test(description) ||
    /account number field is required/i.test(description) ||
    /not available|not found on the server/i.test(description)
  ) {
    return new PayoutError(
      'Payouts are not available: RazorpayX is not set up on this account',
      'not_enabled'
    );
  }

  // Razorpay Route is a separate product and is gated by a feature flag that
  // Razorpay support enables. Unlike payouts it needs no RazorpayX account.
  if (/route feature not enabled/i.test(description)) {
    return new PayoutError(
      'Razorpay Route is not enabled on this account',
      'not_enabled'
    );
  }

  if (err.reason === 'input_validation_failed' || result.status === 400) {
    return new PayoutError(description, 'validation', field);
  }

  console.error(`[razorpay-payouts] ${context} failed`, {
    status: result.status,
    code: err.code,
    field,
  });
  return new PayoutError(description, 'unknown', field);
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

/**
 * Creates (or returns) the Razorpay contact for a user.
 *
 * Idempotent by `reference_id`: verified against the live test API, posting the
 * same reference_id twice returns the original contact with HTTP 200 rather
 * than creating a duplicate. So a retry, a double-submit or a re-run after a
 * crash all converge on one contact per user.
 */
export async function ensureContact(args: {
  userId: number | string;
  name: string;
  email?: string;
}): Promise<{ contactId: string }> {
  const result = await request('POST', '/contacts', {
    name: args.name.slice(0, 120),
    email: args.email || undefined,
    type: 'customer',
    reference_id: `user_${args.userId}`,
  });

  if (result.status !== 200 && result.status !== 201) {
    throw toPayoutError(result, 'contact creation');
  }
  const contactId = result.body?.id;
  if (typeof contactId !== 'string' || !contactId.startsWith('cont_')) {
    throw new PayoutError('Payment provider returned no contact id', 'unknown');
  }
  return { contactId };
}

// ---------------------------------------------------------------------------
// Fund accounts — the tokenisation step
// ---------------------------------------------------------------------------

export type PayoutMethod =
  | { kind: 'bank'; accountNumber: string; ifsc: string; holderName: string }
  | { kind: 'upi'; vpa: string; holderName: string };

export interface TokenisedAccount {
  fundAccountId: string;
  /** Safe to persist and display, e.g. "****4321" or "@okhdfcbank". */
  displayHint: string;
  method: 'bank' | 'upi';
}

/**
 * Sends a payment instrument to Razorpay and returns only its token.
 *
 * This is the liability boundary. The caller hands over the real details; what
 * comes back holds no recoverable account data, so the caller has nothing
 * sensitive left to store even if it wanted to.
 */
export async function tokeniseAccount(
  contactId: string,
  method: PayoutMethod
): Promise<TokenisedAccount> {
  const payload =
    method.kind === 'bank'
      ? {
          contact_id: contactId,
          account_type: 'bank_account',
          bank_account: {
            name: method.holderName.slice(0, 120),
            ifsc: method.ifsc,
            account_number: method.accountNumber,
          },
        }
      : {
          contact_id: contactId,
          account_type: 'vpa',
          vpa: { address: method.vpa },
        };

  // Computed from the input, before the call, so we never need to read it back
  // out of the response (which carries the full number).
  const displayHint =
    method.kind === 'bank'
      ? `****${method.accountNumber.slice(-4)}`
      : method.vpa.slice(method.vpa.indexOf('@'));

  const result = await request('POST', '/fund_accounts', payload);

  if (result.status !== 200 && result.status !== 201) {
    throw toPayoutError(result, 'fund account creation');
  }

  // Read the id and let everything else — including bank_account.account_number
  // — fall out of scope unreferenced.
  const fundAccountId = result.body?.id;
  if (typeof fundAccountId !== 'string' || !fundAccountId.startsWith('fa_')) {
    throw new PayoutError('Payment provider returned no fund account id', 'unknown');
  }

  return { fundAccountId, displayHint, method: method.kind };
}

// ---------------------------------------------------------------------------
// Payouts — moving money to the creator
// ---------------------------------------------------------------------------

export interface PayoutRequest {
  fundAccountId: string;
  /** Rupees. Converted to paise here so callers never juggle units. */
  amount: number;
  /** Our own id for this payout, used as the idempotency reference. */
  referenceId: string;
  narration?: string;
}

/**
 * Sends one payout.
 *
 * Requires RazorpayX to be activated on the account and
 * RAZORPAYX_ACCOUNT_NUMBER to be set (the source virtual account). Against a
 * plain Razorpay Payments account this raises PayoutError('not_enabled') —
 * which is the current state of the test credentials, so this path is written
 * and typed but has NOT been executed end to end. See PAYOUTS.md.
 */
export async function sendPayout(
  req: PayoutRequest
): Promise<{ payoutId: string; status: string }> {
  const sourceAccount = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!sourceAccount) {
    throw new PayoutError(
      'RAZORPAYX_ACCOUNT_NUMBER is not configured',
      'not_enabled'
    );
  }
  if (!Number.isFinite(req.amount) || req.amount <= 0) {
    throw new PayoutError('Payout amount must be positive', 'validation', 'amount');
  }

  const result = await request('POST', '/payouts', {
    account_number: sourceAccount,
    fund_account_id: req.fundAccountId,
    amount: Math.round(req.amount * 100),
    currency: 'INR',
    // Spec: NEFT, settling the next business day.
    mode: 'NEFT',
    purpose: 'payout',
    queue_if_low_balance: true,
    // Razorpay dedupes on this, so a retry cannot pay a creator twice.
    reference_id: req.referenceId,
    narration: (req.narration || 'ValueSkins payout').slice(0, 30),
  });

  if (result.status !== 200 && result.status !== 201) {
    throw toPayoutError(result, 'payout');
  }
  const payoutId = result.body?.id;
  if (typeof payoutId !== 'string') {
    throw new PayoutError('Payment provider returned no payout id', 'unknown');
  }
  return { payoutId, status: String(result.body?.status || 'queued') };
}

/**
 * True when this account can actually move money out.
 *
 * The account number must be included: /payouts rejects a request without it
 * regardless of whether RazorpayX is set up, so probing bare would report
 * "unavailable" even on a working account.
 */
export async function payoutsAvailable(): Promise<boolean> {
  const sourceAccount = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!sourceAccount) return false;
  try {
    const result = await request(
      'GET',
      `/payouts?account_number=${encodeURIComponent(sourceAccount)}&count=1`
    );
    return result.status === 200;
  } catch {
    return false;
  }
}
