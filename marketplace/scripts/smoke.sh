#!/usr/bin/env bash
# Checks a deployed site for the things that must never break.
#   bash scripts/smoke.sh https://www.valueskins.com
# Exits non-zero, listing every failure, if any check does not hold.
set -uo pipefail

BASE="${1:-https://www.valueskins.com}"
FAILED=0

fail() { echo "FAIL  $1"; FAILED=$((FAILED + 1)); }
pass() { echo "ok    $1"; }

# status <path> <expected-code> [method]
status() {
  local path="$1" want="$2" method="${3:-GET}" got
  got=$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X "$method" \
        -H 'Content-Type: application/json' ${4:+-d "$4"} "$BASE$path")
  if [ "$got" = "$want" ]; then pass "$method $path -> $got"; else fail "$method $path -> $got (expected $want)"; fi
}

# redirects <path> <expected-destination-path>
redirects() {
  local path="$1" want="$2" got
  got=$(curl -s -m 30 -o /dev/null -w '%{redirect_url}' "$BASE$path")
  if [ "$got" = "$BASE$want" ]; then pass "$path -> $want"; else fail "$path -> ${got:-no redirect} (expected $want)"; fi
}

echo "Smoke test: $BASE"

# Public pages load.
for p in / /how-it-works /auth/login /legal/terms /legal/privacy /legal/refund /help; do
  status "$p" 200
done

# The site can reach its database.
health=$(curl -s -m 30 "$BASE/api/health")
case "$health" in
  *'"database":"healthy"'*) pass "database is healthy" ;;
  *) fail "health check: ${health:0:120}" ;;
esac

# Signed-out visitors never see a marketplace page.
for p in /deals/browse /deals/mine /campaigns /campaigns/create; do
  redirects "$p" /auth/login
done

# Nothing can be read or created without signing in.
status /api/deals/feed 401
status /api/applications 401
status /api/profile/details 401
status /api/profile/payout-upi 401
status /api/deals/create-workflow-deal 401 POST '{}'
status /api/applications 401 POST '{}'

# Endpoints that created things with no role check stay switched off.
status /api/deals/bulk-create 410 POST '{}'
status /api/deals/create-with-skin 410 POST '{}'
status /api/campaigns 410 POST '{}'

# Retired pages forward instead of serving old content.
redirects /deals/create /campaigns/create
redirects /demo/marketplace /deals/browse
redirects /competitors /how-it-works
redirects /profile/me /settings

echo
if [ "$FAILED" -gt 0 ]; then
  echo "$FAILED check(s) failed."
  exit 1
fi
echo "All checks passed."
