-- Migration 009: the log of emails the app has tried to send.
--
-- lib/email.ts has always written every send attempt here, but no migration
-- ever created the table. The insert threw, so anything that sent mail through
-- sendEmail failed outright: saving an email address returned
-- "Could not save email address" for every user.

CREATE TABLE IF NOT EXISTS email_queue (
  id BIGSERIAL PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  email_type TEXT NOT NULL DEFAULT '',
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  sent BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_queue(user_id);
