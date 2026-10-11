-- Migration 013: a complete, time-ordered record of what happened on a deal.
--
-- The deals table keeps only the latest state: the newest content link, the
-- newest change request, a count of revisions. That is enough to run a deal
-- and not enough to account for one. Every action either party takes, from
-- applying to the final confirmation, is appended here with who did it and
-- when, and the deal report prints the whole list.
--
-- Append-only: rows are inserted and never updated.

CREATE TABLE IF NOT EXISTS deal_events (
  id BIGSERIAL PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  -- Null for something the system did (for example, completing the deal).
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_events_deal ON deal_events(deal_id, created_at, id);
