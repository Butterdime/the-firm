#!/bin/bash

# CIS Platform Deployment Verification Script
# For use by Cursor AI / GitHub Copilot
# Version: 1.0

set -e  # Exit on error

echo "🚀 CIS Platform Deployment Verification"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ALL_TESTS_PASSED=true

# Function to run test
run_test() {
  local test_name="$1"
  local test_command="$2"

  echo -n "Testing $test_name... "

  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
    return 0
  else
    echo -e "${RED}❌ FAIL${NC}"
    ALL_TESTS_PASSED=false
    return 1
  fi
}

# Function to run test with output check
run_test_with_output() {
  local test_name="$1"
  local test_command="$2"
  local expected_pattern="$3"

  echo -n "Testing $test_name... "

  output=$(eval "$test_command" 2>&1)

  if echo "$output" | grep -q "$expected_pattern"; then
    echo -e "${GREEN}✅ PASS${NC}"
    return 0
  else
    echo -e "${RED}❌ FAIL${NC}"
    echo -e "${YELLOW}Expected pattern: $expected_pattern${NC}"
    echo -e "${YELLOW}Got: $output${NC}"
    ALL_TESTS_PASSED=false
    return 1
  fi
}

echo "🔍 Step 1: Testing API Endpoints"
echo "--------------------------------"

# Test 1: Health endpoint
run_test_with_output \
  "Health endpoint" \
  "curl -s -f https://the-firm.vercel.app/api/health" \
  '"status":"ok"'

# Test 2: Root API endpoint
run_test_with_output \
  "Root API endpoint" \
  "curl -s -f https://the-firm.vercel.app/" \
  '"message":"CIS Platform API"'

echo ""
echo "🗄️  Step 2: Testing Database Connection"
echo "---------------------------------------"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL environment variable not set${NC}"
  echo -e "${YELLOW}Please set it with: export DATABASE_URL=\"your-database-url\"${NC}"
  ALL_TESTS_PASSED=false
else
  # Test 3: Database connection
  run_test \
    "Database connection" \
    "psql \$DATABASE_URL -c 'SELECT 1;'"

  # Test 4: Tables exist
  echo -n "Checking database tables... "
  TABLE_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

  if [ "$TABLE_COUNT" = "3" ]; then
    echo -e "${GREEN}✅ PASS${NC} (3 tables found)"
  else
    echo -e "${RED}❌ FAIL${NC} ($TABLE_COUNT tables found, expected 3)"
    ALL_TESTS_PASSED=false
  fi

  # Test 5: Verify specific tables
  TABLES=("documents" "verifications" "audit_logs")
  for table in "${TABLES[@]}"; do
    echo -n "Checking table '$table'... "
    if psql $DATABASE_URL -t -c "\dt $table" 2>/dev/null | grep -q "$table"; then
      echo -e "${GREEN}✅ EXISTS${NC}"
    else
      echo -e "${RED}❌ MISSING${NC}"
      ALL_TESTS_PASSED=false
    fi
  done
fi

echo ""
echo "🔐 Step 3: Checking Environment Variables"
echo "-----------------------------------------"

# Check if vercel CLI is available
if command -v vercel &> /dev/null; then
  # Test 6: Environment variables in Vercel
  echo "Checking Vercel environment variables..."

  ENV_VARS=("GEMINI_API_KEY" "DATABASE_URL" "NODE_ENV")
  for var in "${ENV_VARS[@]}"; do
    echo -n "Checking $var... "
    if vercel env ls 2>/dev/null | grep -q "$var"; then
      echo -e "${GREEN}✅ SET${NC}"
    else
      echo -e "${YELLOW}⚠️  NOT FOUND${NC}"
      echo -e "${YELLOW}   Set with: vercel env add $var${NC}"
    fi
  done
else
  echo -e "${YELLOW}⚠️  Vercel CLI not installed - skipping env var check${NC}"
  echo -e "${YELLOW}   Install with: npm install -g vercel${NC}"
fi

echo ""
echo "📊 Step 4: Database Statistics"
echo "-------------------------------"

if [ ! -z "$DATABASE_URL" ]; then
  echo "Record counts:"
  psql $DATABASE_URL -c "
    SELECT
      'Documents' as table_name,
      COUNT(*) as count
    FROM documents
    UNION ALL
    SELECT
      'Verifications' as table_name,
      COUNT(*) as count
    FROM verifications
    UNION ALL
    SELECT
      'Audit Logs' as table_name,
      COUNT(*) as count
    FROM audit_logs
    ORDER BY table_name;
  " 2>/dev/null || echo "Could not fetch statistics"

  echo ""
  echo "Database size:"
  psql $DATABASE_URL -c "
    SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
  " 2>/dev/null || echo "Could not fetch database size"
fi

echo ""
echo "========================================"

if [ "$ALL_TESTS_PASSED" = true ]; then
  echo -e "${GREEN}🎉 All tests PASSED!${NC}"
  echo ""
  echo "✅ Deployment is successful and ready for production use!"
  echo ""
  echo "Production URLs:"
  echo "  - Main: https://the-firm.vercel.app"
  echo "  - Health: https://the-firm.vercel.app/api/health"
  echo "  - API: https://the-firm.vercel.app/api/verify-document"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tests FAILED${NC}"
  echo ""
  echo "Please review the failures above and:"
  echo "  1. Check Vercel deployment status"
  echo "  2. Verify environment variables are set"
  echo "  3. Ensure database migration was run"
  echo "  4. Review deployment logs for errors"
  echo ""
  echo "For detailed troubleshooting, see:"
  echo "  AI_ASSISTANT_DEPLOYMENT_GUIDE.md"
  echo ""
  exit 1
fi
