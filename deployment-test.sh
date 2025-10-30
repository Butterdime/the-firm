#!/bin/bash

# CIS Platform Deployment Testing Script
# Run this after completing Steps 1-4 of deployment

echo "🧪 CIS Platform Deployment Test Suite"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [[ $status == "success" ]]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [[ $status == "warning" ]]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

echo "Step 1: Testing Health Endpoint"
echo "-------------------------------"
health_response=$(curl -s -w "HTTPSTATUS:%{http_code}" https://the-firm.vercel.app/api/health)
health_body=$(echo "$health_response" | sed 's/HTTPSTATUS.*//')
health_code=$(echo "$health_response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

if [[ $health_code == "200" ]]; then
    print_status "success" "Health endpoint returns 200 OK"
    echo "Response: $health_body"
else
    print_status "error" "Health endpoint failed (HTTP $health_code)"
    echo "Response: $health_body"
fi
echo ""

echo "Step 2: Testing Document Verification Endpoint"
echo "----------------------------------------------"

# Create test document
cat > test-invoice.txt << 'EOF'
ABN: 51 824 753 556
Business Name: EXAMPLE PTY LTD
Date: 2025-10-20
Invoice Number: INV-001
Amount: $1,234.56
EOF

# Test document verification
verify_response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -X POST https://the-firm.vercel.app/api/verify-document \
  -F "document=@test-invoice.txt" \
  -F "document_date=2025-10-20")

verify_body=$(echo "$verify_response" | sed 's/HTTPSTATUS.*//')
verify_code=$(echo "$verify_response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

if [[ $verify_code == "200" ]]; then
    print_status "success" "Document verification endpoint returns 200 OK"
    # Check if it contains expected fields
    if echo "$verify_body" | grep -q "verification_id\|status"; then
        print_status "success" "Response contains verification data"
    else
        print_status "warning" "Response format may be unexpected"
    fi
    echo "Response preview: $(echo "$verify_body" | head -c 200)..."
else
    print_status "error" "Document verification failed (HTTP $verify_code)"
    echo "Response: $verify_body"
fi

# Clean up test file
rm -f test-invoice.txt
echo ""

echo "Step 3: Testing Database Connection (if DATABASE_URL set)"
echo "-------------------------------------------------------"

if [[ -n "$DATABASE_URL" ]]; then
    echo "Testing database connection..."
    if command -v psql &> /dev/null; then
        if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
            print_status "success" "Database connection successful"

            # Check if tables exist
            table_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('documents', 'verifications', 'audit_logs');" 2>/dev/null)
            if [[ $table_count -eq 3 ]]; then
                print_status "success" "All 3 tables exist (documents, verifications, audit_logs)"
            else
                print_status "error" "Missing tables. Expected 3, found $table_count"
            fi
        else
            print_status "error" "Database connection failed"
        fi
    else
        print_status "warning" "psql not installed - cannot test database connection"
    fi
else
    print_status "warning" "DATABASE_URL not set - cannot test database"
fi

echo ""

echo "Step 4: Testing Gemini API (if GEMINI_API_KEY set)"
echo "-------------------------------------------------"

if [[ -n "$GEMINI_API_KEY" ]]; then
    echo "Testing Gemini API key..."
    gemini_response=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY")
    if echo "$gemini_response" | grep -q "models"; then
        print_status "success" "Gemini API key is valid"
    else
        print_status "error" "Gemini API key validation failed"
        echo "Response: $gemini_response"
    fi
else
    print_status "warning" "GEMINI_API_KEY not set - cannot test Gemini API"
fi

echo ""
echo "📊 Deployment Status Summary"
echo "============================"
echo ""
echo "If all tests pass, your CIS Platform is ready for production!"
echo ""
echo "🔗 Useful Links:"
echo "   Site: https://the-firm.vercel.app"
echo "   Vercel Dashboard: https://vercel.com/Butterdime/the-firm"
echo "   API Docs: Check api/verify-document.ts for endpoint details"
echo ""
echo "🆘 If issues persist:"
echo "   1. Check Vercel deployment logs"
echo "   2. Verify environment variables in Vercel dashboard"
echo "   3. Test DATABASE_URL and GEMINI_API_KEY locally"
echo "   4. Check vercel.json routing configuration"
