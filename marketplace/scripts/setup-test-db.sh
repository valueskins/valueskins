#!/usr/bin/env bash
# Builds the scratch database the end-to-end and invariant tests run against.
# Safe to re-run: the database is dropped and rebuilt each time.
set -euo pipefail

DB="${TEST_DB_NAME:-vs_e2e}"

dropdb --if-exists "$DB"
createdb "$DB"
psql -q -d "$DB" -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto'

for f in 000_base_schema 006_build_spec_workflow 007_payout_processing 008_direct_payments 009_email_queue 010_payout_name; do
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "src/lib/migrations/$f.sql" >/dev/null
  echo "applied $f"
done

echo
echo "Ready. Run the tests with:"
echo "  TEST_DATABASE_URL=postgresql://localhost:5432/$DB npx jest deal-workflow.e2e"
echo "  psql -d $DB -f scripts/verify-payment-invariants.sql"
