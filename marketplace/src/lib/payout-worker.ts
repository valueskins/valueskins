// Sends the queued creator payouts.
//
// Payments in (brand -> us) happen inside a request. Payments out (us ->
// creator) cannot: Razorpay payouts are asynchronous and the request that
// triggers one has already returned by the time it settles. So a confirmed
// ADVANCE or FINAL payment only *queues* a payout row, and this worker sends
// it, driven by cron.
//
// The properties that matter, because paying a creator twice is unrecoverable:
//   - a row is CLAIMED atomically before any network call, so two overlapping
//     worker runs cannot both send the same payout;
//   - the payout row's own id is the Razorpay `reference_id`, so even if a claim
//     were somehow duplicated, Razorpay itself dedupes;
//   - a send is only ever marked CONFIRMED by the webhook, never optimistically
//     here, because a queued payout can still fail downstream.
import { query, queryOne } from '@/lib/db-pool';
import { sendPayout, PayoutError } from '@/lib/razorpay-payouts';

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;
// A run that dies mid-flight leaves a row PROCESSING. After this long it is
// assumed dead and released, which is safe because Razorpay dedupes on
// reference_id if the original send did in fact land.
const STALE_CLAIM_MINUTES = 30;

export interface PayoutRunResult {
  claimed: number;
  sent: number;
  failed: number;
  deferred: number;
  released: number;
  halted?: string;
}

export async function runPayoutBatch(): Promise<PayoutRunResult> {
  const released = await releaseStaleClaims();

  const claimed = await claimBatch();
  const result: PayoutRunResult = {
    claimed: claimed.length,
    sent: 0,
    failed: 0,
    deferred: 0,
    released,
  };

  for (const row of claimed) {
    const outcome = await processOne(row);
    if (outcome === 'sent') result.sent++;
    else if (outcome === 'failed') result.failed++;
    else result.deferred++;

    if (outcome === 'halt') {
      // Payouts are not enabled on the account. Every remaining row would fail
      // identically, so stop and leave them queued for when it is switched on.
      result.halted = 'Payouts are not enabled on this Razorpay account';
      await releaseRemaining(claimed.slice(claimed.indexOf(row) + 1));
      break;
    }
  }

  return result;
}

interface ClaimedPayout {
  id: string;
  deal_id: string;
  creator_id: number;
  type: string;
  amount: string;
  attempts: number;
  fund_account_token: string | null;
}

/**
 * Atomically claims up to BATCH_SIZE pending payouts.
 *
 * SKIP LOCKED lets several workers run concurrently without blocking on each
 * other, each taking a disjoint set of rows.
 */
async function claimBatch(): Promise<ClaimedPayout[]> {
  const result = await query(
    `WITH claimable AS (
       SELECT p.id
         FROM payouts p
        WHERE p.status = 'PENDING'
          AND p.attempts < $2
        ORDER BY p.created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE payouts p
        SET status = 'PROCESSING',
            claimed_at = NOW(),
            attempts = p.attempts + 1,
            last_attempt_at = NOW(),
            updated_at = NOW()
       FROM claimable c
      WHERE p.id = c.id
      RETURNING p.id, p.deal_id, p.creator_id, p.type, p.amount, p.attempts,
                (SELECT u.razorpay_fund_account_id FROM users u WHERE u.id = p.creator_id)
                  AS fund_account_token`,
    [BATCH_SIZE, MAX_ATTEMPTS]
  );
  return (result.rows || []) as ClaimedPayout[];
}

async function processOne(
  row: ClaimedPayout
): Promise<'sent' | 'failed' | 'deferred' | 'halt'> {
  // No payout destination on file: the creator never completed setup. This is
  // not retryable, so it is failed with a reason rather than burning attempts.
  if (!row.fund_account_token) {
    await markFailed(row.id, 'Creator has no payout account on file');
    return 'failed';
  }

  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    await markFailed(row.id, 'Invalid payout amount');
    return 'failed';
  }

  try {
    const sent = await sendPayout({
      fundAccountId: row.fund_account_token,
      amount,
      // The row id is stable across retries, so Razorpay dedupes a resend.
      referenceId: row.id,
      narration: `ValueSkins ${row.type.toLowerCase()}`,
    });

    // Stays PROCESSING: only the payout.processed webhook confirms it. Marking
    // it CONFIRMED here would claim the creator has been paid when Razorpay has
    // merely accepted the instruction.
    await query(
      `UPDATE payouts
          SET razorpay_payout_id = $2, fund_account_id = $3, updated_at = NOW()
        WHERE id = $1`,
      [row.id, sent.payoutId, row.fund_account_token]
    );
    return 'sent';
  } catch (err) {
    if (err instanceof PayoutError) {
      if (err.kind === 'not_enabled') {
        await releaseToPending(row.id, 'RazorpayX not enabled');
        return 'halt';
      }
      if (err.kind === 'validation') {
        // The stored token or amount is wrong; retrying cannot fix it.
        await markFailed(row.id, err.message);
        return 'failed';
      }
      if (err.kind === 'auth') {
        await releaseToPending(row.id, 'Provider auth failed');
        return 'halt';
      }
      // transient / unknown: put it back and let the next run retry.
      await releaseToPending(row.id, err.message);
      return 'deferred';
    }

    await releaseToPending(
      row.id,
      err instanceof Error ? err.message : 'unknown error'
    );
    return 'deferred';
  }
}

async function markFailed(payoutId: string, reason: string): Promise<void> {
  await query(
    `UPDATE payouts
        SET status = 'FAILED', failure_reason = $2, claimed_at = NULL, updated_at = NOW()
      WHERE id = $1`,
    [payoutId, reason.slice(0, 300)]
  );
  console.error('[payout-worker] payout failed permanently', { payoutId, reason });
}

/** Returns a claimed row to the queue so a later run retries it. */
async function releaseToPending(payoutId: string, reason: string): Promise<void> {
  await query(
    `UPDATE payouts
        SET status = 'PENDING', claimed_at = NULL,
            failure_reason = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'PROCESSING'`,
    [payoutId, reason.slice(0, 300)]
  );
}

async function releaseRemaining(rows: ClaimedPayout[]): Promise<void> {
  if (rows.length === 0) return;
  await query(
    `UPDATE payouts
        SET status = 'PENDING', claimed_at = NULL, attempts = GREATEST(0, attempts - 1),
            updated_at = NOW()
      WHERE id = ANY($1::uuid[]) AND status = 'PROCESSING'`,
    [rows.map((r) => r.id)]
  );
}

/**
 * Releases claims left behind by a run that died.
 *
 * Only rows with no razorpay_payout_id are released: if an id was recorded the
 * send did reach Razorpay and the webhook will settle it, so re-queueing would
 * risk a second instruction.
 */
async function releaseStaleClaims(): Promise<number> {
  const result = await query(
    `UPDATE payouts
        SET status = 'PENDING', claimed_at = NULL, updated_at = NOW()
      WHERE status = 'PROCESSING'
        AND razorpay_payout_id = ''
        AND claimed_at < NOW() - ($1 || ' minutes')::interval
      RETURNING id`,
    [STALE_CLAIM_MINUTES]
  );
  const rows = result.rows || [];
  if (rows.length > 0) {
    console.warn('[payout-worker] released stale claims', { count: rows.length });
  }
  return rows.length;
}

/** Queue depth, for the admin dashboard and alerting. */
export async function payoutQueueStats(): Promise<Record<string, number>> {
  const result = await query(
    `SELECT status, COUNT(*)::int AS count FROM payouts GROUP BY status`
  );
  const stats: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    CONFIRMED: 0,
    FAILED: 0,
  };
  for (const row of result.rows || []) stats[row.status] = row.count;
  return stats;
}
