#!/bin/bash

# CIS Platform Automated Deployment Script
# For GitHub Copilot with credentials already available
# Version: 1.0

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 CIS Platform Automated Deployment${NC}"
echo "========================================"
echo ""

# Parse command line arguments
GEMINI_API_KEY=""
DATABASE_URL=""
VERCEL_PROJECT="the-firm"
VERCEL_ORG="Butterdime"

# Function to show usage
show_usage() {
  echo "Usage: $0 --gemini-key KEY --database-url URL [options]"
  echo ""
  echo "Required:"
  echo "  --gemini-key KEY        Google Gemini API key (starts with AIza)"
  echo "  --database-url URL      PostgreSQL connection string"
  echo ""
  echo "Optional:"
  echo "  --vercel-project NAME   Vercel project name (default: the-firm)"
  echo "  --vercel-org ORG        Vercel organization (default: Butterdime)"
  echo "  --skip-vercel           Skip Vercel environment variable setup"
  echo "  --skip-database         Skip database migration"
  echo "  --verify-only           Only run verification tests"
  echo ""
  echo "Example:"
  echo "  $0 --gemini-key AIzaSy... --database-url postgresql://..."
  echo ""
  exit 1
}

# Parse arguments
SKIP_VERCEL=false
SKIP_DATABASE=false
VERIFY_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --gemini-key)
      GEMINI_API_KEY="$2"
      shift 2
      ;;
    --database-url)
      DATABASE_URL="$2"
      shift 2
      ;;
    --vercel-project)
      VERCEL_PROJECT="$2"
      shift 2
      ;;
    --vercel-org)
      VERCEL_ORG="$2"
      shift 2
      ;;
    --skip-vercel)
      SKIP_VERCEL=true
      shift
      ;;
    --skip-database)
      SKIP_DATABASE=true
      shift
      ;;
    --verify-only)
      VERIFY_ONLY=true
      shift
      ;;
    -h|--help)
      show_usage
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      show_usage
      ;;
  esac
done

# Validate credentials if not verify-only
if [ "$VERIFY_ONLY" = false ]; then
  if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}Error: GEMINI_API_KEY is required${NC}"
    echo "Provide it with: --gemini-key AIzaSy..."
    echo ""
    show_usage
  fi

  if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL is required${NC}"
    echo "Provide it with: --database-url postgresql://..."
    echo ""
    show_usage
  fi

  # Validate Gemini API key format
  if [[ ! "$GEMINI_API_KEY" =~ ^AIza ]]; then
    echo -e "${YELLOW}Warning: GEMINI_API_KEY should start with 'AIza'${NC}"
    echo "Current value starts with: ${GEMINI_API_KEY:0:10}..."
    echo ""
  fi

  # Validate DATABASE_URL format
  if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
    echo -e "${RED}Error: DATABASE_URL must start with 'postgresql://'${NC}"
    echo "Current value starts with: ${DATABASE_URL:0:20}..."
    echo ""
    exit 1
  fi
fi

# Export DATABASE_URL for psql commands
export DATABASE_URL

echo -e "${BLUE}Configuration:${NC}"
echo "  GEMINI_API_KEY: ${GEMINI_API_KEY:0:10}...${GEMINI_API_KEY: -5}"
echo "  DATABASE_URL: ${DATABASE_URL%%@*}@***"
echo "  Vercel Project: $VERCEL_ORG/$VERCEL_PROJECT"
echo ""

# Track overall status
DEPLOYMENT_SUCCESSFUL=true

# ==============================================================================
# STEP 1: Setup Vercel Environment Variables
# ==============================================================================

if [ "$VERIFY_ONLY" = false ] && [ "$SKIP_VERCEL" = false ]; then
  echo -e "${BLUE}📝 Step 1: Setting up Vercel Environment Variables${NC}"
  echo "------------------------------------------------"

  # Check if vercel CLI is available
  if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not installed${NC}"
    echo ""
    echo "Please install with: npm install -g vercel"
    echo "Or set environment variables manually at:"
    echo "  https://vercel.com/$VERCEL_ORG/$VERCEL_PROJECT/settings/environment-variables"
    echo ""
    echo "Required variables:"
    echo "  - GEMINI_API_KEY = $GEMINI_API_KEY"
    echo "  - DATABASE_URL = $DATABASE_URL"
    echo "  - NODE_ENV = production"
    echo ""
    DEPLOYMENT_SUCCESSFUL=false
  else
    # Check if user is logged in
    if ! vercel whoami &> /dev/null; then
      echo -e "${YELLOW}⚠️  Not logged into Vercel CLI${NC}"
      echo "Please run: vercel login"
      echo ""
      echo "Or set environment variables manually at:"
      echo "  https://vercel.com/$VERCEL_ORG/$VERCEL_PROJECT/settings/environment-variables"
      echo ""
      DEPLOYMENT_SUCCESSFUL=false
    else
      echo "Setting GEMINI_API_KEY..."
      echo "$GEMINI_API_KEY" | vercel env add GEMINI_API_KEY production --force 2>/dev/null || echo "  (may already exist)"
      echo "$GEMINI_API_KEY" | vercel env add GEMINI_API_KEY preview --force 2>/dev/null || echo "  (may already exist)"
      echo "$GEMINI_API_KEY" | vercel env add GEMINI_API_KEY development --force 2>/dev/null || echo "  (may already exist)"

      echo "Setting DATABASE_URL..."
      echo "$DATABASE_URL" | vercel env add DATABASE_URL production --force 2>/dev/null || echo "  (may already exist)"
      echo "$DATABASE_URL" | vercel env add DATABASE_URL preview --force 2>/dev/null || echo "  (may already exist)"
      echo "$DATABASE_URL" | vercel env add DATABASE_URL development --force 2>/dev/null || echo "  (may already exist)"

      echo "Setting NODE_ENV..."
      echo "production" | vercel env add NODE_ENV production --force 2>/dev/null || echo "  (may already exist)"

      echo -e "${GREEN}✅ Environment variables configured${NC}"
    fi
  fi

  echo ""
fi

# ==============================================================================
# STEP 2: Setup Database
# ==============================================================================

if [ "$VERIFY_ONLY" = false ] && [ "$SKIP_DATABASE" = false ]; then
  echo -e "${BLUE}🗄️  Step 2: Setting up Database${NC}"
  echo "--------------------------------"

  # Check if psql is available
  if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not installed${NC}"
    echo ""
    echo "Install PostgreSQL client:"
    echo "  Mac: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    echo ""
    DEPLOYMENT_SUCCESSFUL=false
  else
    # Test connection
    echo -n "Testing database connection... "
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ Connected${NC}"

      # Check if migration file exists
      if [ ! -f "migrations/001_schema.sql" ]; then
        echo -e "${RED}❌ Migration file not found: migrations/001_schema.sql${NC}"
        DEPLOYMENT_SUCCESSFUL=false
      else
        # Check if tables already exist
        EXISTING_TABLES=$(psql "$DATABASE_URL" -t -c "
          SELECT COUNT(*)
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN ('documents', 'verifications', 'audit_logs');
        " 2>/dev/null | tr -d ' ')

        if [ "$EXISTING_TABLES" = "3" ]; then
          echo -e "${YELLOW}⚠️  Tables already exist - skipping migration${NC}"
        else
          echo "Running database migration..."
          if psql "$DATABASE_URL" < migrations/001_schema.sql > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Migration completed${NC}"
          else
            echo -e "${RED}❌ Migration failed${NC}"
            DEPLOYMENT_SUCCESSFUL=false
          fi
        fi

        # Verify tables
        echo "Verifying tables..."
        TABLES=("documents" "verifications" "audit_logs")
        for table in "${TABLES[@]}"; do
          echo -n "  Checking '$table'... "
          if psql "$DATABASE_URL" -t -c "\dt $table" 2>/dev/null | grep -q "$table"; then
            echo -e "${GREEN}✅${NC}"
          else
            echo -e "${RED}❌${NC}"
            DEPLOYMENT_SUCCESSFUL=false
          fi
        done
      fi
    else
      echo -e "${RED}❌ Failed${NC}"
      echo "Could not connect to database"
      DEPLOYMENT_SUCCESSFUL=false
    fi
  fi

  echo ""
fi

# ==============================================================================
# STEP 3: Trigger Vercel Deployment
# ==============================================================================

if [ "$VERIFY_ONLY" = false ] && [ "$SKIP_VERCEL" = false ]; then
  echo -e "${BLUE}🚀 Step 3: Triggering Vercel Deployment${NC}"
  echo "----------------------------------------"

  if command -v vercel &> /dev/null && vercel whoami &> /dev/null; then
    echo "Deploying to production..."
    echo "(This may take 2-3 minutes)"
    echo ""

    # Deploy to production
    if vercel --prod --yes > /dev/null 2>&1; then
      echo -e "${GREEN}✅ Deployment initiated${NC}"
      echo ""
      echo "Waiting for deployment to complete (30 seconds)..."
      sleep 30
    else
      echo -e "${YELLOW}⚠️  Could not trigger automatic deployment${NC}"
      echo "Please check Vercel dashboard:"
      echo "  https://vercel.com/$VERCEL_ORG/$VERCEL_PROJECT"
    fi
  else
    echo -e "${YELLOW}⚠️  Vercel CLI not available - skipping automatic deployment${NC}"
    echo ""
    echo "Deployment should trigger automatically when environment variables are set."
    echo "Check status at: https://vercel.com/$VERCEL_ORG/$VERCEL_PROJECT/deployments"
  fi

  echo ""
fi

# ==============================================================================
# STEP 4: Verify Deployment
# ==============================================================================

echo -e "${BLUE}🧪 Step 4: Verifying Deployment${NC}"
echo "--------------------------------"

# Test 1: Health endpoint
echo -n "Testing health endpoint... "
HEALTH_RESPONSE=$(curl -s -f https://the-firm.vercel.app/api/health 2>&1)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
  echo "Response: $HEALTH_RESPONSE"
  DEPLOYMENT_SUCCESSFUL=false
fi

# Test 2: Root API endpoint
echo -n "Testing root API endpoint... "
ROOT_RESPONSE=$(curl -s -f https://the-firm.vercel.app/ 2>&1)
if echo "$ROOT_RESPONSE" | grep -q '"message":"CIS Platform API"'; then
  echo -e "${GREEN}✅ PASS${NC}"
else
  echo -e "${RED}❌ FAIL${NC}"
  echo "Response: $ROOT_RESPONSE"
  DEPLOYMENT_SUCCESSFUL=false
fi

# Test 3: Database connection (if DATABASE_URL is set)
if [ ! -z "$DATABASE_URL" ] && command -v psql &> /dev/null; then
  echo -n "Testing database connection... "
  if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"

    # Show record counts
    echo ""
    echo "Database statistics:"
    psql "$DATABASE_URL" -c "
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
  else
    echo -e "${RED}❌ FAIL${NC}"
    DEPLOYMENT_SUCCESSFUL=false
  fi
fi

echo ""
echo "========================================"

# Final status
if [ "$DEPLOYMENT_SUCCESSFUL" = true ]; then
  echo -e "${GREEN}🎉 Deployment Successful!${NC}"
  echo ""
  echo "Production URLs:"
  echo "  🌐 Main: https://the-firm.vercel.app"
  echo "  ❤️  Health: https://the-firm.vercel.app/api/health"
  echo "  📄 Verify: https://the-firm.vercel.app/api/verify-document"
  echo ""
  echo "Next steps:"
  echo "  1. Test document verification with a real document"
  echo "  2. Enable Vercel Analytics (optional)"
  echo "  3. Set up monitoring alerts (optional)"
  echo ""
  echo "Documentation:"
  echo "  - API Guide: README.md"
  echo "  - Security Audit: AUDIT_REPORT.md"
  echo "  - Deployment Guide: AI_ASSISTANT_DEPLOYMENT_GUIDE.md"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Deployment Failed${NC}"
  echo ""
  echo "Some steps did not complete successfully."
  echo "Please review the errors above and:"
  echo ""
  echo "  1. Check Vercel deployment logs:"
  echo "     https://vercel.com/$VERCEL_ORG/$VERCEL_PROJECT/deployments"
  echo ""
  echo "  2. Verify environment variables:"
  echo "     https://vercel.com/$VERCEL_ORG/$VERCEL_PROJECT/settings/environment-variables"
  echo ""
  echo "  3. Test database connection:"
  echo "     psql \$DATABASE_URL -c 'SELECT 1;'"
  echo ""
  echo "  4. Review troubleshooting guide:"
  echo "     AI_ASSISTANT_DEPLOYMENT_GUIDE.md → Section 'TROUBLESHOOTING'"
  echo ""
  exit 1
fi
