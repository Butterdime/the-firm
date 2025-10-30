# 🤖 AI Assistant Deployment Guide
## For Cursor AI & GitHub Copilot

**Date**: October 30, 2025
**Status**: Ready for AI-assisted deployment
**Estimated Time**: 10 minutes
**Prerequisites**: User must provide API keys

---

## 🎯 OBJECTIVE

Deploy the CIS Platform API to production with:
- ✅ Fixed critical bug (already merged to main)
- ✅ Environment variables configured
- ✅ Database schema migrated
- ✅ API endpoints tested and verified

---

## 📋 CURRENT STATUS

### ✅ Completed
- [x] PR merged to main branch
- [x] Critical multer bug fixed
- [x] Vercel deployment configuration updated
- [x] Code builds successfully

### ⏳ Remaining (Your Tasks)
- [ ] Obtain API keys from user
- [ ] Configure Vercel environment variables
- [ ] Setup PostgreSQL database
- [ ] Run database migration
- [ ] Test API endpoints
- [ ] Verify deployment success

---

## 🔑 STEP 1: Obtain Required Credentials

**ACTION**: Ask the user to provide these credentials.

### Required Information:

**1. GEMINI_API_KEY**
```
User Instructions:
1. Go to: https://aistudio.google.com/app/apikey
2. Click "Create API key"
3. Select "Create API key in new project"
4. Copy the entire key (starts with "AIza")
5. Paste it here: [WAITING FOR USER INPUT]
```

**2. DATABASE_URL**
```
User Instructions - Option A (Railway - Recommended):
1. Go to: https://railway.app/
2. Login with GitHub
3. Click "New Project"
4. Select "Provision PostgreSQL"
5. Click PostgreSQL service → "Variables" tab
6. Copy "DATABASE_URL" value
7. Paste it here: [WAITING FOR USER INPUT]

Format: postgresql://postgres:PASSWORD@HOST.railway.app:5432/railway

User Instructions - Option B (Vercel Postgres):
1. Go to: https://vercel.com/Butterdime/the-firm/stores
2. Create → Postgres
3. Connect to project
4. DATABASE_URL is automatically set
5. Confirm when done: [WAITING FOR USER INPUT]
```

**3. Vercel Access**
```
User Instructions:
Ensure you're logged into Vercel dashboard at:
https://vercel.com/Butterdime/the-firm

Confirm you have access: [WAITING FOR USER INPUT]
```

---

## 🔧 STEP 2: Configure Environment Variables in Vercel

**ACTION**: Use Vercel CLI or guide user through dashboard.

### Method A: Using Vercel Dashboard (User-Guided)

**Instructions for User**:

```markdown
1. Go to: https://vercel.com/Butterdime/the-firm/settings/environment-variables

2. Add Variable #1:
   - Click "Add New"
   - Key: GEMINI_API_KEY
   - Value: [paste your Gemini API key]
   - Environments: Check ALL THREE (Production, Preview, Development)
   - Click "Save"

3. Add Variable #2:
   - Click "Add New"
   - Key: DATABASE_URL
   - Value: [paste your PostgreSQL connection string]
   - Environments: Check ALL THREE (Production, Preview, Development)
   - Click "Save"

4. Add Variable #3:
   - Click "Add New"
   - Key: NODE_ENV
   - Value: production
   - Environments: Check PRODUCTION ONLY
   - Click "Save"

5. Confirm when all three variables are added
```

**Verification**:
```bash
# User should see all three variables listed:
# ✓ GEMINI_API_KEY (Production, Preview, Development)
# ✓ DATABASE_URL (Production, Preview, Development)
# ✓ NODE_ENV (Production)
```

### Method B: Using Vercel CLI (Automated)

**Prerequisites**: User must be logged into Vercel CLI

```bash
# Check if user is logged in
vercel whoami
# If not logged in, user must run: vercel login

# Set environment variables (replace with actual values from user)
vercel env add GEMINI_API_KEY production
# Paste value when prompted: [USER'S GEMINI_API_KEY]

vercel env add GEMINI_API_KEY preview
# Paste value when prompted: [USER'S GEMINI_API_KEY]

vercel env add GEMINI_API_KEY development
# Paste value when prompted: [USER'S GEMINI_API_KEY]

vercel env add DATABASE_URL production
# Paste value when prompted: [USER'S DATABASE_URL]

vercel env add DATABASE_URL preview
# Paste value when prompted: [USER'S DATABASE_URL]

vercel env add DATABASE_URL development
# Paste value when prompted: [USER'S DATABASE_URL]

vercel env add NODE_ENV production
# Paste value when prompted: production
```

**Verification**:
```bash
# List all environment variables
vercel env ls

# Expected output should show:
# GEMINI_API_KEY (Production, Preview, Development)
# DATABASE_URL (Production, Preview, Development)
# NODE_ENV (Production)
```

---

## 🗄️ STEP 3: Setup PostgreSQL Database

**ACTION**: Run database migration to create required tables.

### Method A: Using psql (Recommended)

**Prerequisites Check**:
```bash
# Check if psql is installed
which psql

# If not found:
# Mac: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client
# Windows: Download from postgresql.org
```

**Run Migration**:
```bash
# Navigate to project directory
cd /Users/puvansivanasan/the-firm

# Set DATABASE_URL (use value from Step 1)
export DATABASE_URL="[USER'S DATABASE_URL HERE]"

# Verify connection
psql $DATABASE_URL -c "SELECT version();"

# Run migration
psql $DATABASE_URL < migrations/001_schema.sql

# Verify tables were created
psql $DATABASE_URL -c "\dt"
```

**Expected Output**:
```
          List of relations
 Schema |      Name       | Type  |  Owner
--------+-----------------+-------+--------
 public | audit_logs      | table | postgres
 public | documents       | table | postgres
 public | verifications   | table | postgres
(3 rows)
```

**Success Criteria**:
- [x] All 3 tables created (audit_logs, documents, verifications)
- [x] No error messages
- [x] Connection successful

### Method B: Using Railway Dashboard (If psql unavailable)

**Instructions for User**:

```markdown
1. Go to your Railway project: https://railway.app/
2. Click on your PostgreSQL service
3. Click "Data" tab
4. Click "Query" button
5. Open migrations/001_schema.sql in your editor
6. Copy entire contents
7. Paste into Railway query editor
8. Click "Run Query"
9. Verify: Should see "Query executed successfully"
```

**Verification Query**:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected Result**:
```
 table_name
-------------
 audit_logs
 documents
 verifications
```

### Method C: Using Vercel Postgres Dashboard (If using Vercel Postgres)

**Instructions for User**:

```markdown
1. Go to: https://vercel.com/Butterdime/the-firm/stores
2. Click your Postgres database
3. Click "Query" tab
4. Copy contents of migrations/001_schema.sql
5. Paste and click "Execute"
6. Verify success message
```

---

## 🚀 STEP 4: Trigger Vercel Redeployment

**ACTION**: Ensure Vercel deploys with new environment variables.

### Automatic Redeployment (Most Common)

**Note**: Vercel automatically redeploys when environment variables are added.

**Check Deployment Status**:
```bash
# User should check:
# https://vercel.com/Butterdime/the-firm/deployments

# Look for:
# - Status: "Building" or "Ready"
# - Latest deployment has environment variables
# - Build logs show no errors
```

**Wait Time**: 2-3 minutes for build to complete.

### Manual Redeployment (If Needed)

**Instructions for User**:

```markdown
1. Go to: https://vercel.com/Butterdime/the-firm
2. Click "Deployments" tab
3. Find the latest deployment
4. Click three dots (⋮) → "Redeploy"
5. Confirm redeployment
6. Wait 2-3 minutes
```

**Alternative - CLI Method**:
```bash
# Trigger deployment via CLI
cd /Users/puvansivanasan/the-firm
vercel --prod

# Follow prompts:
# - Link to existing project? Yes
# - Which scope? Select your account
# - Link to Butterdime/the-firm? Yes
# Wait for deployment to complete...
```

---

## 🧪 STEP 5: Test API Endpoints

**ACTION**: Verify all endpoints are working correctly.

### Test 1: Health Check (CRITICAL)

```bash
# Test health endpoint
curl https://the-firm.vercel.app/api/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2025-10-30T..."
# }
```

**Success Criteria**: Status code 200, JSON response with "status": "ok"

**If 404 Error**:
```bash
# Deployment may still be in progress
# Wait 2 more minutes and retry
sleep 120
curl https://the-firm.vercel.app/api/health
```

**If Still Failing**:
- Check Vercel deployment logs
- Verify environment variables are set
- Check vercel.json routing configuration

### Test 2: Root API Endpoint

```bash
# Test root API
curl https://the-firm.vercel.app/

# Expected response:
# {
#   "message": "CIS Platform API",
#   "version": "1.0.0",
#   "endpoints": {
#     "health": "/api/health",
#     "verify": "/api/verify-document"
#   },
#   "documentation": "https://github.com/Butterdime/the-firm"
# }
```

**Success Criteria**: Status code 200, JSON response with API information

### Test 3: Database Connection

```bash
# Verify database is accessible
psql $DATABASE_URL -c "SELECT COUNT(*) FROM documents;"

# Expected response:
#  count
# -------
#      0
# (1 row)
```

**Success Criteria**: Query executes without errors

### Test 4: Document Verification Endpoint (Integration Test)

```bash
# Create test document
cd /Users/puvansivanasan/the-firm
cat > test-document.txt << 'EOF'
ABN: 51824753556
Business Name: EXAMPLE PTY LTD
Date: 2025-10-30
EOF

# Test verification endpoint
curl -X POST https://the-firm.vercel.app/api/verify-document \
  -F "document=@test-document.txt" \
  -F "document_date=2025-10-30"

# Expected response (will vary based on ABR lookup):
# {
#   "status": "approved" or "manual_review",
#   "verification_id": "uuid",
#   "document_id": "uuid",
#   "extracted_data": {
#     "abn": "51824753556",
#     "business_name": "EXAMPLE PTY LTD"
#   },
#   "abr_data": { ... },
#   "trilogy_checks": {
#     "abn_match": true/false,
#     "acn_match": true/false,
#     "name_match": true/false,
#     "entity_active": true/false
#   }
# }
```

**Success Criteria**:
- Status code 200
- JSON response with verification_id
- No error messages about missing environment variables
- Database records created

### Test 5: Verify Database Records

```bash
# Check that verification was recorded
psql $DATABASE_URL -c "SELECT id, verification_status FROM verifications ORDER BY created_at DESC LIMIT 1;"

# Expected: Should show the verification record

# Check audit logs
psql $DATABASE_URL -c "SELECT COUNT(*) FROM audit_logs;"

# Expected: Should show > 0 (multiple events per verification)
```

**Success Criteria**:
- Verification record exists in database
- Audit logs created
- No database errors

---

## ✅ STEP 6: Verification & Sign-off

**ACTION**: Confirm all systems are operational.

### Final Checklist

Run this comprehensive verification:

```bash
#!/bin/bash
echo "🔍 CIS Platform Deployment Verification"
echo "========================================"

# Test 1: Health endpoint
echo -n "Health endpoint: "
if curl -s https://the-firm.vercel.app/api/health | grep -q "ok"; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# Test 2: Root API
echo -n "Root API: "
if curl -s https://the-firm.vercel.app/ | grep -q "CIS Platform API"; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# Test 3: Database connection
echo -n "Database connection: "
if psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# Test 4: Tables exist
echo -n "Database tables: "
TABLE_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
if [ "$TABLE_COUNT" -eq 3 ]; then
  echo "✅ PASS (3 tables)"
else
  echo "❌ FAIL ($TABLE_COUNT tables)"
fi

echo ""
echo "========================================"
echo "Deployment verification complete!"
```

**Save and run**:
```bash
# Save script
cat > verify-deployment.sh << 'EOF'
[paste script above]
EOF

# Make executable
chmod +x verify-deployment.sh

# Run verification
./verify-deployment.sh
```

### Expected Output

```
🔍 CIS Platform Deployment Verification
========================================
Health endpoint: ✅ PASS
Root API: ✅ PASS
Database connection: ✅ PASS
Database tables: ✅ PASS (3 tables)

========================================
Deployment verification complete!
```

### Success Criteria - All Must Pass

- [x] Health endpoint returns 200 OK
- [x] Root API returns JSON with version info
- [x] Database connection successful
- [x] All 3 tables created (documents, verifications, audit_logs)
- [x] Environment variables set in Vercel
- [x] No errors in Vercel deployment logs
- [x] Document verification endpoint accepts requests
- [x] Verification records saved to database
- [x] Audit logs created for each verification

---

## 🎉 DEPLOYMENT COMPLETE

### Summary

**Live URLs**:
- **Production**: https://the-firm.vercel.app
- **API Health**: https://the-firm.vercel.app/api/health
- **API Docs**: https://github.com/Butterdime/the-firm

**Environment**:
- Platform: Vercel (Serverless)
- Database: PostgreSQL (Railway/Vercel)
- OCR: Google Gemini 2.5 Flash
- Registry: ABR (Australian Business Register)

**Features Deployed**:
- ✅ Document upload and OCR extraction
- ✅ ABR registry verification
- ✅ Trilogy verification (ABN + ACN + Name)
- ✅ Entity status validation (Active only)
- ✅ Document staleness checks
- ✅ Complete audit trail
- ✅ Security compliance verified

**Security Status**:
- ✅ No fuzzy matching
- ✅ Exact string matching (case-sensitive)
- ✅ No confidence threshold bypasses
- ✅ Fail-safe design (edge cases → manual review)
- ✅ Critical bug fixed (multer memory storage)

---

## 📊 POST-DEPLOYMENT MONITORING

### Recommended Actions

**1. Enable Vercel Analytics** (Optional):
```markdown
1. Go to: https://vercel.com/Butterdime/the-firm/analytics
2. Enable "Web Analytics"
3. Monitor request volume and response times
```

**2. Monitor Error Rates**:
```bash
# Check Vercel logs
vercel logs https://the-firm.vercel.app --follow

# Look for:
# - 500 errors (server errors)
# - Database connection failures
# - Gemini API quota issues
# - ABR API timeouts
```

**3. Database Monitoring**:
```bash
# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Check record counts
psql $DATABASE_URL -c "SELECT
  (SELECT COUNT(*) FROM documents) as documents,
  (SELECT COUNT(*) FROM verifications) as verifications,
  (SELECT COUNT(*) FROM audit_logs) as audit_logs;"
```

**4. Set Up Alerts** (Recommended):
```markdown
Monitor for:
- Error rate > 5%
- Response time > 10 seconds
- Database connection failures
- API quota exceeded (Gemini)

Notification channels:
- Email alerts (Vercel dashboard)
- Slack webhook (optional)
```

---

## 🆘 TROUBLESHOOTING

### Issue: Environment Variables Not Working

**Symptoms**: API returns errors about missing GEMINI_API_KEY or DATABASE_URL

**Solution**:
```bash
# 1. Verify variables are set
vercel env ls

# 2. Check variable values (without exposing secrets)
# Go to Vercel dashboard → Settings → Environment Variables
# Verify each has green checkmark

# 3. Redeploy
vercel --prod

# 4. Test again
curl https://the-firm.vercel.app/api/health
```

### Issue: Database Connection Failed

**Symptoms**: Errors about "database connection failed" or "relation does not exist"

**Solution**:
```bash
# 1. Test connection directly
psql $DATABASE_URL -c "SELECT version();"

# 2. Verify tables exist
psql $DATABASE_URL -c "\dt"

# 3. If tables missing, re-run migration
psql $DATABASE_URL < migrations/001_schema.sql

# 4. Check SSL mode
# DATABASE_URL should end with: ?sslmode=require
```

### Issue: API Returns 404

**Symptoms**: All API endpoints return "NOT_FOUND"

**Solution**:
```bash
# 1. Check deployment status
# Go to: https://vercel.com/Butterdime/the-firm/deployments
# Verify latest deployment is "Ready" (green)

# 2. Check build logs for errors
# Click deployment → "Building" tab → Look for errors

# 3. Verify vercel.json exists
cat vercel.json
# Should have routing configuration

# 4. Verify api/ directory has functions
ls -la api/
# Should show: health.ts, index.ts, verify-document.ts

# 5. Redeploy
vercel --prod
```

### Issue: Gemini API Errors

**Symptoms**: "Invalid API key" or "Quota exceeded"

**Solution**:
```bash
# 1. Test API key directly
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"

# 2. Verify key format (should start with AIza)
# Go to: https://aistudio.google.com/app/apikey

# 3. Check quota
# Google AI Studio → Billing & Quotas

# 4. Regenerate key if needed
# Create new key → Update Vercel env vars → Redeploy
```

---

## 📝 HANDOFF NOTES

### For User

**What was deployed**:
- Fixed critical bug in document verification
- Configured serverless deployment on Vercel
- Set up PostgreSQL database with audit logging
- Enabled OCR via Google Gemini AI
- Integrated with Australian Business Register API

**What you need to maintain**:
- Keep Gemini API key active (monitor quotas)
- Monitor database storage (expand if needed)
- Review audit logs periodically
- Update environment variables if API keys rotate

**Next steps (optional)**:
- Set up monitoring alerts (Sentry, Vercel Analytics)
- Add authentication for API access
- Implement rate limiting
- Create admin dashboard for manual reviews

### For Next AI Assistant

**If issues arise**:
1. Check deployment logs in Vercel dashboard
2. Verify environment variables are set
3. Test database connection directly
4. Review audit logs for failed verifications
5. Consult AUDIT_REPORT.md for security requirements

**Key files**:
- `/api/verify-document.ts` - Main verification endpoint
- `/src/lib/trilogy-verification.ts` - Core verification logic
- `/src/lib/abr-verification.ts` - ABR API integration
- `/src/lib/gemini-extraction.ts` - OCR extraction
- `/migrations/001_schema.sql` - Database schema

---

## ✅ DEPLOYMENT SIGN-OFF

**Deployment completed by**: [AI Assistant Name]
**Date**: [Completion Date]
**Time**: [Completion Time]
**Status**: 🎉 SUCCESS

**Verified**:
- [x] All API endpoints working
- [x] Database migration successful
- [x] Environment variables configured
- [x] Security audit compliance verified
- [x] No critical errors in logs

**Production URLs**:
- Main: https://the-firm.vercel.app
- Health: https://the-firm.vercel.app/api/health
- Verify: https://the-firm.vercel.app/api/verify-document

**Ready for production use!** 🚀

---

**Created by**: Claude Code
**For**: Cursor AI / GitHub Copilot
**Version**: 1.0
**Last Updated**: October 30, 2025
