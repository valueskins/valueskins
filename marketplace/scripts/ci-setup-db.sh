#!/usr/bin/env bash
# Builds the schema in the CI database. The same migrations, in the same
# order, as scripts/setup-test-db.sh uses locally; this version talks to the
# Postgres service container instead of creating a local database.
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${PGHOST:-localhost}"
USER_NAME="${PGUSER:-postgres}"
DB="${CI_DB_NAME:-vs_ci}"

run() { psql -h "$HOST" -U "$USER_NAME" -d "$DB" -q -v ON_ERROR_STOP=1 "$@"; }

run -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto'

# Kept in step with setup-test-db.sh by reading its list, so a new migration
# added there cannot be forgotten here.
MIGRATIONS=$(grep -oE 'for f in [^;]+' scripts/setup-test-db.sh | sed 's/^for f in //')
for f in $MIGRATIONS; do
  run -f "src/lib/migrations/$f.sql" >/dev/null
  echo "applied $f"
done
