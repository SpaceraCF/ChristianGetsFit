#!/bin/sh
set -e

if [ -z "$APP_URL" ] || [ -z "$CRON_SECRET" ]; then
  echo "ERROR: APP_URL and CRON_SECRET must be set"
  exit 1
fi

AUTH="Authorization: Bearer $CRON_SECRET"

call() {
  echo "--- $1 ---"
  curl -sf --max-time 55 -H "$AUTH" "$APP_URL$1" && echo "" || echo "  (failed or skipped)"
}

if [ "$CRON_MODE" = "daily" ]; then
  call /api/cron/fitbit-sync
  call /api/cron/schedule-calcom
  call /api/cron/weekly
else
  call /api/cron/tick
fi

echo "Done."
