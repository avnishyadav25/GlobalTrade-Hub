#!/usr/bin/env bash
# Self-hosted scheduler for GlobalTrade Hub automation.
#
# Calls /api/automation/run on an interval. Deliberately NOT Vercel Cron: the Hobby tier
# allows one run per day, which is useless for anything but end-of-day strategies.
#
# THIS IS ONLY AS RELIABLE AS THE MACHINE IT RUNS ON. A sleeping laptop is a stopped
# scheduler. The app reflects that honestly — "running on the server" is derived from a
# real heartbeat, never from this script having been started once.
#
#   BASE_URL=http://localhost:3000 CRON_SECRET=... ./scripts/scheduler.sh
#   INTERVAL=300 ./scripts/scheduler.sh          # every 5 minutes instead of 60s
#   MAX_TICKS=5 ./scripts/scheduler.sh           # stop after 5 ticks (useful for testing)

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
INTERVAL="${INTERVAL:-60}"
MAX_TICKS="${MAX_TICKS:-0}"   # 0 = run forever

if [ -z "${CRON_SECRET:-}" ]; then
    echo "CRON_SECRET is not set." >&2
    echo "The endpoint places orders; in production it fails closed without one." >&2
    exit 1
fi

echo "scheduler: ${BASE_URL}/api/automation/run every ${INTERVAL}s$([ "$MAX_TICKS" -gt 0 ] && echo ", ${MAX_TICKS} ticks")"
trap 'echo; echo "scheduler: stopped."; exit 0' INT TERM

ticks=0
while :; do
    ticks=$((ticks + 1))
    stamp="$(date '+%H:%M:%S')"
    # The secret goes in a header, not the query string: query strings land in access
    # logs and shell history.
    body="$(curl -sS -m 120 -H "x-cron-secret: ${CRON_SECRET}" "${BASE_URL}/api/automation/run" 2>&1)" || body='{"ok":false,"reason":"request failed"}'
    echo "[${stamp}] ${body}"

    if [ "$MAX_TICKS" -gt 0 ] && [ "$ticks" -ge "$MAX_TICKS" ]; then
        echo "scheduler: reached ${MAX_TICKS} ticks, stopping."
        exit 0
    fi
    sleep "$INTERVAL"
done
