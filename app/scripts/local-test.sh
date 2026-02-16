#!/usr/bin/env bash
# Local test for ChristianGetsFit - run with dev server on localhost:3000
# Usage: ./scripts/local-test.sh [cookie-file]
set -e
COOKIE_FILE="${1:-/tmp/cgf_test_cookies.txt}"
BASE="http://localhost:3000"
PASS=0
FAIL=0

check() {
  local name="$1"
  local code="$2"
  local expect="${3:-200}"
  if [ "$code" = "$expect" ]; then
    echo "  OK $name ($code)"
    ((PASS++)) || true
    return 0
  else
    echo "  FAIL $name (got $code, expected $expect)"
    ((FAIL++)) || true
    return 1
  fi
}

echo "=== ChristianGetsFit local test ==="
echo ""

echo "1. Public routes"
check "GET /" "$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")"
check "GET /login" "$(curl -s -o /dev/null -w "%{http_code}" "$BASE/login")"
check "GET /manifest.json" "$(curl -s -o /dev/null -w "%{http_code}" "$BASE/manifest.json")"

echo ""
echo "2. Auth (magic link + callback)"
RES=$(curl -s -X POST "$BASE/api/auth/magic-link" -H "Content-Type: application/json" -d '{"email":"runner@test.com"}')
if echo "$RES" | grep -q '"ok":true'; then
  echo "  OK POST /api/auth/magic-link"
  ((PASS++)) || true
else
  echo "  FAIL POST /api/auth/magic-link"
  ((FAIL++)) || true
fi

# Get token from DB and complete login
TOKEN=$(cd "$(dirname "$0")/.." && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.magicLinkToken.findFirst({ where: { email: 'runner@test.com', usedAt: null }, orderBy: { expiresAt: 'desc' }, select: { token: true } })
  .then(r => { console.log(r?.token || ''); p.\$disconnect(); });
" 2>/dev/null)
if [ -n "$TOKEN" ]; then
  CB=$(curl -s -c "$COOKIE_FILE" -b "$COOKIE_FILE" -L -o /dev/null -w "%{http_code}" "$BASE/api/auth/callback?token=$TOKEN")
  check "GET /api/auth/callback (session)" "$CB"
else
  echo "  SKIP callback (no token from DB)"
fi

echo ""
echo "3. Protected routes (with session)"
check "GET /dashboard" "$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE/dashboard")"
check "GET /dashboard/workout" "$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE/dashboard/workout")"
check "GET /dashboard/analytics" "$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE/dashboard/analytics")"
check "GET /dashboard/settings" "$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE/dashboard/settings")"
check "GET /dashboard/log-weight" "$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE/dashboard/log-weight")"

echo ""
echo "4. APIs (with session)"
check "GET /api/workout/next?type=A&express=true" "$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE/api/workout/next?type=A&express=true")"
WL=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" -X POST "$BASE/api/weight" -H "Content-Type: application/json" -d '{"weightKg":81.2}')
check "POST /api/weight" "$(echo "$WL" | tail -1)"
echo "$WL" | head -1 | grep -q '"ok":true' && echo "  OK POST /api/weight body" && ((PASS++)) || { echo "  FAIL POST /api/weight body"; ((FAIL++)); }

echo ""
echo "5. Cron (no auth = 401, with CRON_SECRET = 200)"
check "GET /api/cron/daily (no auth)" "$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cron/daily")" "401"
CRON_SECRET=$(grep CRON_SECRET "$(dirname "$0")/../.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "local-cron-secret")
check "GET /api/cron/daily (with secret)" "$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/daily")"

echo ""
echo "6. Unauthenticated dashboard redirects to login"
DASH=$(curl -s -o /tmp/dash_body.html -w "%{http_code}" -c /tmp/empty.txt -b /tmp/empty.txt -L "$BASE/dashboard")
if [ "$DASH" = "200" ] && grep -q "magic\|Log in" /tmp/dash_body.html 2>/dev/null; then
  echo "  OK /dashboard without cookie shows login"
  ((PASS++)) || true
else
  echo "  FAIL /dashboard without cookie (code=$DASH)"
  ((FAIL++)) || true
fi

echo ""
echo "=== Result: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
