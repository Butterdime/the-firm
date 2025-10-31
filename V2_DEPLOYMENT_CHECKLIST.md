# RPR CIS SCAN v2 - Deployment Checklist

## Pre-Deployment Checklist

### 1. Database Migration
- [ ] Connect to Railway PostgreSQL database
- [ ] Run migration: `psql "$DATABASE_URL" < migrations/002_kyc_tables.sql`
- [ ] Verify all tables created: `psql "$DATABASE_URL" -c "\dt"`
- [ ] Verify existing tables unchanged: `psql "$DATABASE_URL" -c "\d verifications"`
- [ ] Test that v1 endpoint still works after migration

### 2. Vercel Environment Variables
Add these in Vercel Dashboard → Settings → Environment Variables:

#### Required Variables:
- [ ] `ABR_API_KEY` - Register at https://abr.business.gov.au/
- [ ] `MONOOVA_API_KEY` - From Monoova sandbox/production
- [ ] `MONOOVA_API_SECRET` - From Monoova sandbox/production
- [ ] `MONOOVA_ENVIRONMENT` - Set to 'sandbox' initially

#### Optional Variables (have defaults):
- [ ] `ABR_API_URL` - Default: https://abr.business.gov.au/abrxmlsearch/ABRXMLSearch.asmx
- [ ] `MONOOVA_API_URL` - Default: https://api.monoova.com/v2
- [ ] `MONTHLY_PAYID_BUDGET` - Default: 5
- [ ] `DAILY_GEMINI_TOKEN_LIMIT` - Default: 10000
- [ ] `ENABLE_NPP_PAYID` - Default: true
- [ ] `ENABLE_VISUAL_AUTH` - Default: true
- [ ] `ENABLE_ABR_SEARCH` - Default: true

### 3. Build Verification
- [x] TypeScript compilation succeeds (`npm run build`)
- [x] No linting errors
- [x] All imports resolve correctly

### 4. Code Review
- [x] All routes integrated into `src/vercel-entry.ts`
- [x] All routes integrated into `src/server.ts` (for local dev)
- [x] Existing v1 endpoints preserved
- [x] Package.json updated to v2.0.0

## Deployment Steps

### Step 1: Commit and Push
```bash
git add .
git commit -m "feat: Add v2 KYC verification system (hybrid Individual + Business Entity)"
git push origin main
```

### Step 2: Verify Vercel Deployment
- [ ] Check Vercel dashboard for deployment status
- [ ] Verify build succeeds
- [ ] Check function logs for any errors

### Step 3: Run Database Migration
```bash
# Get DATABASE_URL from Vercel environment variables or Railway
psql "$DATABASE_URL" < migrations/002_kyc_tables.sql

# Verify migration
psql "$DATABASE_URL" -c "\dt" | grep -E "(individuals|identity_documents|residence|bank_verification)"
```

### Step 4: Post-Deployment Testing

#### Test v1 Endpoint (Should Still Work):
```bash
curl -X POST https://the-firm.vercel.app/api/verify-document \
  -F "document=@test.pdf"
```

#### Test v2 Health Check:
```bash
curl https://the-firm.vercel.app/health
```

#### Test v2 Identity Endpoint:
```bash
curl -X POST https://the-firm.vercel.app/api/kyc/verify-identity \
  -F "document=@id_document.jpg" \
  -F "full_name=Test User" \
  -F "dob=1990-01-01" \
  -F "address=123 Test St" \
  -F "postcode=2000"
```

## Post-Deployment Monitoring

### 1. Monitor Function Logs
- [ ] Check Vercel function logs for errors
- [ ] Monitor API response times
- [ ] Track error rates

### 2. Database Monitoring
- [ ] Monitor database connection pool
- [ ] Check table sizes
- [ ] Monitor query performance

### 3. Cost Monitoring
- [ ] Track PayID usage (should stay under $5/month)
- [ ] Monitor Gemini API token usage
- [ ] Check ABR API rate limits

### 4. SLA Tracking
- [ ] Monitor manual review queue size
- [ ] Check for SLA breaches (reviews >24 hours old)
- [ ] Track verification completion rates

## Rollback Plan

If issues occur:
1. Revert git commit
2. Database tables are additive - no rollback needed (v1 still works)
3. Environment variables can be disabled via feature flags:
   - `ENABLE_NPP_PAYID=false`
   - `ENABLE_VISUAL_AUTH=false`
   - `ENABLE_ABR_SEARCH=false`

## Known Limitations

1. **ABR XML Parsing**: The `parseABRXMLResponse()` function needs actual ABR API response format. Currently returns empty array - will need adjustment once ABR API format is confirmed.

2. **Email/SMS**: Notification service is placeholder - actual email/SMS provider integration needed.

3. **Testing**: Unit and integration tests pending (can be added incrementally).

## Success Criteria

- [x] Build succeeds without errors
- [ ] Database migration completes successfully
- [ ] v1 endpoint continues working
- [ ] v2 endpoints respond correctly
- [ ] No breaking changes to existing functionality
- [ ] Environment variables configured
- [ ] Deployment successful on Vercel

