#!/bin/bash

# CIS Platform Database Setup Script
# For use by Cursor AI / GitHub Copilot
# Version: 1.0

set -e  # Exit on error

echo "🗄️  CIS Platform Database Setup"
echo "==============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is provided
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
  echo ""
  echo "Usage:"
  echo "  export DATABASE_URL=\"postgresql://user:pass@host:port/db\""
  echo "  ./scripts/setup-database.sh"
  echo ""
  echo "Or:"
  echo "  DATABASE_URL=\"postgresql://...\" ./scripts/setup-database.sh"
  echo ""
  exit 1
fi

echo "📍 Database URL: ${DATABASE_URL%%@*}@***" # Hide credentials
echo ""

# Test connection
echo -n "🔌 Testing database connection... "
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Connected${NC}"
else
  echo -e "${RED}❌ Failed${NC}"
  echo ""
  echo "Could not connect to database. Please check:"
  echo "  1. DATABASE_URL is correct"
  echo "  2. Database server is accessible"
  echo "  3. Credentials are valid"
  echo "  4. SSL mode is configured (?sslmode=require)"
  echo ""
  exit 1
fi

# Check if migration file exists
MIGRATION_FILE="migrations/001_schema.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
  echo ""
  echo "Please ensure you're running this script from the project root directory:"
  echo "  cd /path/to/the-firm"
  echo "  ./scripts/setup-database.sh"
  echo ""
  exit 1
fi

echo ""
echo "📋 Migration file: $MIGRATION_FILE"
echo ""

# Check if tables already exist
echo "🔍 Checking existing tables..."
EXISTING_TABLES=$(psql "$DATABASE_URL" -t -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
" 2>/dev/null | tr -d ' ' | grep -v '^$')

if [ ! -z "$EXISTING_TABLES" ]; then
  echo -e "${YELLOW}⚠️  Tables already exist:${NC}"
  echo "$EXISTING_TABLES" | while read table; do
    echo "  - $table"
  done
  echo ""
  echo -n "Do you want to continue? This will skip creating existing tables. (y/N) "
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  echo ""
fi

# Run migration
echo "🚀 Running database migration..."
echo ""

if psql "$DATABASE_URL" < "$MIGRATION_FILE"; then
  echo ""
  echo -e "${GREEN}✅ Migration completed successfully${NC}"
else
  echo ""
  echo -e "${RED}❌ Migration failed${NC}"
  echo ""
  echo "Please check the error messages above and:"
  echo "  1. Verify the migration SQL is valid"
  echo "  2. Ensure database user has CREATE TABLE permissions"
  echo "  3. Check if tables already exist"
  echo ""
  exit 1
fi

echo ""
echo "🔍 Verifying tables were created..."
echo ""

# Verify tables
TABLES=("documents" "verifications" "audit_logs")
ALL_TABLES_EXIST=true

for table in "${TABLES[@]}"; do
  echo -n "Checking table '$table'... "
  if psql "$DATABASE_URL" -t -c "\dt $table" 2>/dev/null | grep -q "$table"; then
    echo -e "${GREEN}✅ EXISTS${NC}"
  else
    echo -e "${RED}❌ MISSING${NC}"
    ALL_TABLES_EXIST=false
  fi
done

echo ""

if [ "$ALL_TABLES_EXIST" = true ]; then
  echo -e "${GREEN}🎉 All tables created successfully!${NC}"
  echo ""
  echo "Created tables:"
  echo "  ✓ documents - Stores uploaded document metadata"
  echo "  ✓ verifications - Stores verification results"
  echo "  ✓ audit_logs - Stores complete audit trail"
  echo ""

  # Show table counts
  echo "Current record counts:"
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
  "

  echo ""
  echo "✅ Database setup complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Ensure GEMINI_API_KEY is set in Vercel"
  echo "  2. Ensure DATABASE_URL is set in Vercel"
  echo "  3. Redeploy application if needed"
  echo "  4. Test API endpoints"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tables are missing${NC}"
  echo ""
  echo "Please check the migration logs above for errors."
  echo ""
  exit 1
fi
