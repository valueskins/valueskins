-- Build-spec deal workflow: 9-state machine, 3 deadlines, applications,
-- email audit trail, payouts, ADP reports.
-- Statuses: DRAFT, OPEN, CONFIRMED, COMMISSION_PAID, ADVANCE_PAID,
--           CONTENT_UPLOADED, REVISION_REQUESTED, APPROVED_FOR_FINAL_PAYMENT, COMPLETED

-- ---------------------------------------------------------------------------
-- deals: spec columns
-- ---------------------------------------------------------------------------
ALTER TABLE deals ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS content_upload_deadline TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_deadline TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS content_link TEXT DEFAULT '';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS content_uploaded_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS feedback TEXT DEFAULT '';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS cancelled_by_id BIGINT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT '';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS applications_closed BOOLEAN DEFAULT FALSE;
-- Workflow status kept in its own column so the legacy `status`/`phase` columns
-- used by older screens keep working unchanged.
ALTER TABLE deals ADD COLUMN IF NOT EXISTS workflow_status TEXT DEFAULT 'DRAFT';

CREATE INDEX IF NOT EXISTS idx_deals_workflow_status ON deals(workflow_status);
CREATE INDEX IF NOT EXISTS idx_deals_open_feed
  ON deals(published_at DESC) WHERE workflow_status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_deals_app_deadline
  ON deals(application_deadline) WHERE workflow_status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_deals_content_overdue
  ON deals(content_upload_deadline) WHERE workflow_status = 'ADVANCE_PAID';
CREATE INDEX IF NOT EXISTS idx_deals_brand ON deals(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_creator ON deals(creator_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- users: payout + instagram sync columns
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_ref TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_contact_id TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_fund_account_id TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS gstin TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_last_synced TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_profile_pic_url TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_account_type TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_details_completed BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_instagram_user_id
  ON users(instagram_user_id) WHERE instagram_user_id <> '';
CREATE INDEX IF NOT EXISTS idx_users_instagram_sync ON users(instagram_last_synced);

-- ---------------------------------------------------------------------------
-- applications: one row per creator per deal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  creator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'APPLIED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT applications_status_chk
    CHECK (status IN ('APPLIED', 'CONFIRMED', 'REJECTED')),
  CONSTRAINT applications_unique_creator_deal UNIQUE (deal_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_deal ON applications(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_creator
  ON applications(creator_id, created_at DESC);
-- At most one CONFIRMED creator per deal (spec: 1 creator per deal).
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_one_confirmed
  ON applications(deal_id) WHERE status = 'CONFIRMED';

-- ---------------------------------------------------------------------------
-- email_communications: audit trail, visible to both parties
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  sender_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  recipient_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL,
  subject TEXT DEFAULT '',
  body TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  delivery_status TEXT DEFAULT 'sent',
  delivery_error TEXT DEFAULT '',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_comms_deal
  ON email_communications(deal_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_comms_recipient
  ON email_communications(recipient_id, sent_at DESC);

-- ---------------------------------------------------------------------------
-- deal_workflow_payments: the 3 brand-side transactions per deal
-- (separate from the legacy `deal_payments` table, which older screens use)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deal_workflow_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  razorpay_order_id TEXT DEFAULT '',
  razorpay_payment_id TEXT DEFAULT '',
  razorpay_invoice_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT dwp_type_chk CHECK (type IN ('COMMISSION', 'ADVANCE', 'FINAL')),
  CONSTRAINT dwp_status_chk CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED'))
);

-- One confirmed payment of each type per deal: makes webhook replay a no-op
-- and stops a second charge for the same stage.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dwp_one_confirmed_per_type
  ON deal_workflow_payments(deal_id, type) WHERE status = 'CONFIRMED';
CREATE INDEX IF NOT EXISTS idx_dwp_deal ON deal_workflow_payments(deal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dwp_order
  ON deal_workflow_payments(razorpay_order_id) WHERE razorpay_order_id <> '';

-- ---------------------------------------------------------------------------
-- payouts: creator-side transfers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  creator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  razorpay_payout_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING',
  failure_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT payouts_type_chk CHECK (type IN ('ADVANCE', 'FINAL')),
  CONSTRAINT payouts_status_chk CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_one_per_type
  ON payouts(deal_id, type) WHERE status IN ('PENDING', 'CONFIRMED');
CREATE INDEX IF NOT EXISTS idx_payouts_creator
  ON payouts(creator_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- adp_reports: one per completed deal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adp_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  pdf_url TEXT DEFAULT '',
  snapshot JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- idempotency_cache: replay protection for payment endpoints
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_cache (
  idempotency_key TEXT PRIMARY KEY,
  user_id BIGINT,
  endpoint TEXT DEFAULT '',
  response JSONB,
  status_code INTEGER DEFAULT 200,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_cache(expires_at);
