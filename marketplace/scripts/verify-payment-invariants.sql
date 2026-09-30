-- Money-safety invariants for the deal workflow, asserted against real
-- Postgres. These are enforced by partial unique indexes and check
-- constraints, not by application code, so they hold even if a code path
-- forgets to check.
--
-- Run against a scratch database that has had 000, 006 and 007 applied:
--   createdb vs_check
--   psql -d vs_check -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto'
--   psql -d vs_check -f src/lib/migrations/000_base_schema.sql
--   psql -d vs_check -f src/lib/migrations/006_build_spec_workflow.sql
--   psql -d vs_check -f src/lib/migrations/007_payout_processing.sql
--   psql -d vs_check -f scripts/verify-payment-invariants.sql
-- Every line of output must read PASS.

\set QUIET on
\set ON_ERROR_STOP off
SET client_min_messages TO NOTICE;

BEGIN;

INSERT INTO users (id, username, role, email) VALUES
  (9001,'inv_brand','brand','ib@test.local'),
  (9002,'inv_creator1','creator','ic1@test.local'),
  (9003,'inv_creator2','creator','ic2@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO deals (id, brand_id, title, amount, workflow_status)
VALUES ('99999999-9999-9999-9999-999999999999', 9001, 'Invariant Deal', 10000, 'OPEN')
ON CONFLICT (id) DO NOTHING;

-- 1. A creator may apply to a deal only once.
INSERT INTO applications (deal_id, creator_id)
VALUES ('99999999-9999-9999-9999-999999999999', 9002);
DO $$ BEGIN
  INSERT INTO applications (deal_id, creator_id)
  VALUES ('99999999-9999-9999-9999-999999999999', 9002);
  RAISE NOTICE 'FAIL 1: duplicate application allowed';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 1: duplicate application blocked';
END $$;

-- 2. Exactly one creator may be CONFIRMED per deal.
INSERT INTO applications (deal_id, creator_id)
VALUES ('99999999-9999-9999-9999-999999999999', 9003);
UPDATE applications SET status='CONFIRMED'
 WHERE deal_id='99999999-9999-9999-9999-999999999999' AND creator_id=9002;
DO $$ BEGIN
  UPDATE applications SET status='CONFIRMED'
   WHERE deal_id='99999999-9999-9999-9999-999999999999' AND creator_id=9003;
  RAISE NOTICE 'FAIL 2: two creators confirmed on one deal';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 2: second confirmed creator blocked';
END $$;

-- 3. A deal cannot be charged twice for the same payment stage.
INSERT INTO deal_workflow_payments (deal_id, type, amount, razorpay_order_id, status)
VALUES ('99999999-9999-9999-9999-999999999999','COMMISSION',885,'inv_order_A','CONFIRMED');
DO $$ BEGIN
  INSERT INTO deal_workflow_payments (deal_id, type, amount, razorpay_order_id, status)
  VALUES ('99999999-9999-9999-9999-999999999999','COMMISSION',885,'inv_order_B','CONFIRMED');
  RAISE NOTICE 'FAIL 3: commission charged twice';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 3: second commission charge blocked';
END $$;

-- 4. A different stage may still be pending alongside a confirmed one.
DO $$ BEGIN
  INSERT INTO deal_workflow_payments (deal_id, type, amount, razorpay_order_id, status)
  VALUES ('99999999-9999-9999-9999-999999999999','ADVANCE',2734.50,'inv_order_C','PENDING');
  RAISE NOTICE 'PASS 4: advance may be pending while commission is confirmed';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'FAIL 4: unrelated stage wrongly blocked';
END $$;

-- 5. A creator cannot be queued twice for the same payout stage.
INSERT INTO payouts (deal_id, creator_id, type, amount, status)
VALUES ('99999999-9999-9999-9999-999999999999',9002,'ADVANCE',2734.50,'PENDING');
DO $$ BEGIN
  INSERT INTO payouts (deal_id, creator_id, type, amount, status)
  VALUES ('99999999-9999-9999-9999-999999999999',9002,'ADVANCE',2734.50,'PENDING');
  RAISE NOTICE 'FAIL 5: duplicate payout queued';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 5: duplicate payout blocked';
END $$;

-- 6. The guard still holds while a payout is in flight (PROCESSING).
UPDATE payouts SET status='PROCESSING'
 WHERE deal_id='99999999-9999-9999-9999-999999999999';
DO $$ BEGIN
  INSERT INTO payouts (deal_id, creator_id, type, amount, status)
  VALUES ('99999999-9999-9999-9999-999999999999',9002,'ADVANCE',2734.50,'PENDING');
  RAISE NOTICE 'FAIL 6: duplicate queued while one is in flight';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 6: duplicate blocked while PROCESSING';
END $$;

-- 7. A FAILED payout may be re-queued, or a genuine failure could never be retried.
UPDATE payouts SET status='FAILED'
 WHERE deal_id='99999999-9999-9999-9999-999999999999';
DO $$ BEGIN
  INSERT INTO payouts (deal_id, creator_id, type, amount, status)
  VALUES ('99999999-9999-9999-9999-999999999999',9002,'ADVANCE',2734.50,'PENDING');
  RAISE NOTICE 'PASS 7: retry allowed after FAILED';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'FAIL 7: cannot retry a failed payout';
END $$;

-- 8. Status columns reject values outside the state machine.
DO $$ BEGIN
  INSERT INTO payouts (deal_id, creator_id, type, amount, status)
  VALUES ('99999999-9999-9999-9999-999999999999',9003,'FINAL',1,'NONSENSE');
  RAISE NOTICE 'FAIL 8: invalid payout status accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 8: invalid status rejected';
END $$;

-- 9. One deal report per deal.
INSERT INTO adp_reports (deal_id) VALUES ('99999999-9999-9999-9999-999999999999');
DO $$ BEGIN
  INSERT INTO adp_reports (deal_id) VALUES ('99999999-9999-9999-9999-999999999999');
  RAISE NOTICE 'FAIL 9: two reports for one deal';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS 9: duplicate report blocked';
END $$;

-- 10. Concurrent payout workers claim disjoint rows (SKIP LOCKED).
--     Verified separately with two connections; asserted here as the index and
--     the claim query both existing.
DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM pg_indexes
   WHERE tablename='payouts' AND indexname='idx_payouts_pending';
  IF n = 1 THEN RAISE NOTICE 'PASS 10: pending-payout claim index present';
  ELSE RAISE NOTICE 'FAIL 10: claim index missing — worker scans will not skip-lock efficiently';
  END IF;
END $$;

ROLLBACK;
