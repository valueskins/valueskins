-- Payout processing state.
--
-- A payout moves PENDING -> PROCESSING (claimed by the worker) -> CONFIRMED or
-- FAILED. PROCESSING exists so that two concurrent worker runs cannot both send
-- the same payout: the claim is an atomic UPDATE, and only the run that wins
-- the row talks to Razorpay.

ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_status_chk;
ALTER TABLE payouts ADD CONSTRAINT payouts_status_chk
  CHECK (status IN ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED'));

ALTER TABLE payouts ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
-- The fund account token the money was actually sent to, captured at send time.
-- Kept so a payout remains auditable even if the user's current token changes.
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS fund_account_id TEXT DEFAULT '';

-- Rebuild the one-payout-per-stage guard to include PROCESSING, so a claimed
-- payout still blocks a duplicate being queued for the same stage.
DROP INDEX IF EXISTS idx_payouts_one_per_type;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_one_per_type
  ON payouts(deal_id, type)
  WHERE status IN ('PENDING', 'PROCESSING', 'CONFIRMED');

-- The worker's queue scan.
CREATE INDEX IF NOT EXISTS idx_payouts_pending
  ON payouts(created_at) WHERE status = 'PENDING';
-- Finding stale claims to release after a crashed run.
CREATE INDEX IF NOT EXISTS idx_payouts_claimed
  ON payouts(claimed_at) WHERE status = 'PROCESSING';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_razorpay_id
  ON payouts(razorpay_payout_id) WHERE razorpay_payout_id <> '';
