-- Direct brand-to-creator payments.
--
-- Neither Razorpay payout path is open to us: Route is gated behind ₹40L
-- turnover by the September 2025 RBI mandate, and RazorpayX needs a current
-- account. So the creator's share never passes through ValueSkins. The brand
-- pays the creator directly, records the transfer, and the creator confirms it
-- arrived.
--
-- Two properties this schema enforces, both deliberate:
--
-- 1. The deal advances on the CREATOR's confirmation, never the brand's claim.
--    A brand saying "I paid" is an assertion; only the person who would have
--    received the money can settle it. Hence confirmed_at/confirmed_by being
--    separate from recorded_at/recorded_by.
--
-- 2. Because we are not a party to this money, this table IS the record for a
--    dispute. Rows are never updated in place once confirmed or disputed, and
--    nothing is deleted — a superseded record is marked disputed and a new one
--    written, so the history stays readable.
--
-- Our own commission still runs through Razorpay (deal_workflow_payments).
-- That is our money and collecting it was never blocked.

CREATE TABLE IF NOT EXISTS direct_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  -- Validated against the deal's budget on write, so a mistyped figure is
  -- refused rather than quietly recorded as the agreed amount.
  amount NUMERIC(12,2) NOT NULL,
  -- UPI reference / UTR. Free text: the format differs by bank, and we are
  -- recording what the brand reports rather than verifying it with anyone.
  reference TEXT NOT NULL DEFAULT '',
  -- The UPI handle the brand says it paid to, captured at payment time. Stored
  -- here as well as on the user so the record stays true even if the creator
  -- later changes their handle.
  paid_to_vpa TEXT NOT NULL DEFAULT '',
  note TEXT DEFAULT '',
  recorded_by BIGINT NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Null until the creator says the money arrived. This is what moves the deal.
  confirmed_at TIMESTAMPTZ,
  confirmed_by BIGINT REFERENCES users(id),
  -- Set when the creator says it did not arrive, so a dispute leaves a record
  -- rather than just an absence of confirmation.
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT DEFAULT '',
  CONSTRAINT direct_payments_type_chk CHECK (type IN ('ADVANCE', 'FINAL')),
  -- A row cannot be both confirmed and disputed.
  CONSTRAINT direct_payments_outcome_chk
    CHECK (NOT (confirmed_at IS NOT NULL AND disputed_at IS NOT NULL)),
  -- Confirmation must name who confirmed it, or the audit trail is worthless.
  CONSTRAINT direct_payments_confirmed_by_chk
    CHECK ((confirmed_at IS NULL) = (confirmed_by IS NULL))
);

-- One live record per stage. A brand that mistyped a reference has the creator
-- dispute it, then records again — rather than two rows claiming the same money.
CREATE UNIQUE INDEX IF NOT EXISTS idx_direct_payments_one_per_stage
  ON direct_payments(deal_id, type) WHERE disputed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_direct_payments_deal ON direct_payments(deal_id);
-- What is waiting on a creator, for the reminder job and the brand's own view.
CREATE INDEX IF NOT EXISTS idx_direct_payments_unconfirmed
  ON direct_payments(recorded_at)
  WHERE confirmed_at IS NULL AND disputed_at IS NULL;

-- Mirrored onto deals so "what is this waiting on" needs no join.
ALTER TABLE deals ADD COLUMN IF NOT EXISTS advance_confirmed_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS final_confirmed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- UPI only, and nothing else
-- ---------------------------------------------------------------------------
-- A brand paying directly needs a destination, so we hold the creator's UPI
-- handle. That is a receive-only identifier designed to be shared, unlike an
-- account number and IFSC, which are a fraud input. So the bank-account path is
-- closed rather than left available: the column stays for the Razorpay tokens
-- already issued, but no new account number is ever accepted.
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_vpa TEXT DEFAULT '';
-- Set when the creator agrees their UPI ID may be shown to brands they are
-- confirmed on. Without this we have no basis for disclosing it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_vpa_share_consent_at TIMESTAMPTZ;

-- A UPI handle is always name@psp. Rejecting anything else at the database
-- boundary stops an account number being pasted into this column.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_payout_vpa_chk;
ALTER TABLE users ADD CONSTRAINT users_payout_vpa_chk
  CHECK (payout_vpa = '' OR payout_vpa ~ '^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$');

CREATE INDEX IF NOT EXISTS idx_users_payout_vpa
  ON users(id) WHERE payout_vpa <> '';
