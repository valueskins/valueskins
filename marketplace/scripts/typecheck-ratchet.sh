#!/usr/bin/env bash
# Type-check ratchet.
#
# next.config.js sets typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds,
# so a broken import compiles and ships — that is how two dead deal-PDF endpoints
# reached production (ui-specs/phase-2/flagged.md, P2-F4). CI ran `tsc --noEmit`
# but with `continue-on-error: true` *and* `|| true`, so it could never fail.
#
# There are too many pre-existing errors to fix in one pass, so this ratchets
# instead of gating outright: the build fails when the count goes UP, and asks
# you to lower the baseline when it goes DOWN. New breakage cannot slip in, and
# the number only moves one way.
set -uo pipefail
cd "$(dirname "$0")/.."

BASELINE_FILE=".typecheck-baseline"
[ -f "$BASELINE_FILE" ] || { echo "missing $BASELINE_FILE"; exit 1; }
BASELINE=$(tr -dc '0-9' < "$BASELINE_FILE")

OUT=$(npx tsc --noEmit 2>&1)
COUNT=$(printf '%s\n' "$OUT" | grep -c 'error TS' || true)

echo "type errors: $COUNT (baseline $BASELINE)"

if [ "$COUNT" -gt "$BASELINE" ]; then
  echo ""
  echo "FAIL: $((COUNT - BASELINE)) new type error(s)."
  echo "ignoreBuildErrors means these would ship silently. Fix them."
  echo ""
  printf '%s\n' "$OUT" | grep 'error TS' | head -40
  exit 1
fi

if [ "$COUNT" -lt "$BASELINE" ]; then
  echo ""
  echo "$((BASELINE - COUNT)) error(s) fixed. Lower the baseline to lock it in:"
  echo "    echo $COUNT > marketplace/$BASELINE_FILE"
  # Not a failure. Fixing type errors must never be what blocks a merge; this
  # exited 1, which punished exactly the change it should reward.
  exit 0
fi

echo "OK: no new type errors."
