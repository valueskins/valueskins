-- Migration 014: request counters shared by every server instance.
--
-- The limiter in lib/rate-limit kept its counts in memory. On Vercel each
-- function instance has its own memory, so a limit of 60 a minute was really
-- 60 a minute per instance, and more traffic meant more instances and a
-- weaker limit. One row per key here is one count for the whole site.
--
-- UNLOGGED: the counts are short-lived and losing them in a crash only resets
-- the windows.

CREATE UNLOGGED TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);
