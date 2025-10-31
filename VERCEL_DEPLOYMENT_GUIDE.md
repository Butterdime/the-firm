# Vercel Deployment Guide

## Overview
This guide covers the complete setup and deployment process for the Firm application on Vercel.

## What Was Fixed
1. **Vercel Routing Configuration** - Updated `vercel.json` to properly handle API endpoints:
   - `/api/*` → routes to Express app
   - `/health` → routes to Express app
   - Fallback for all other routes

## Step 1: Push the Branch (Do this now in Cursor)

```bash
cd /path/to/the-firm
git push -u origin claude/fix-vercel-routing-011CUdSkkLvUAMhJKAHcc89m
```

## Step 2: Create Pull Request

Go to: https://github.com/Butterdime/the-firm/compare/main...claude/fix-vercel-routing-011CUdSkkLvUAMhJKAHcc89m

**Title:** "fix: Update Vercel routing to fix API 404 errors"

**Description:**
```
Fixes API endpoint 404 errors and adds deployment guide
- Updated vercel.json routing configuration
- Added comprehensive deployment documentation
```

Click "Create Pull Request" then "Merge Pull Request"

## Step 3: Set Up Environment Variables in Vercel

Go to https://vercel.com/Butterdime/the-firm/settings/environment-variables

Add these variables:

#### Required (v1 + v2):
| Variable | Value | Where to Get It |
|----------|-------|-----------------|
| GEMINI_API_KEY | Your API key | https://aistudio.google.com/apikey |
| DATABASE_URL | PostgreSQL URL | Railway or Vercel Postgres |
| NODE_ENV | production | Just type this |

#### v2 KYC Additional Variables:
| Variable | Value | Where to Get It |
|----------|-------|-----------------|
| ABR_API_KEY | Your ABR GUID | https://abr.business.gov.au/ (register GUID) |
| ABR_API_URL | https://abr.business.gov.au/abrxmlsearch/ABRXMLSearch.asmx | Default (optional) |
| MONOOVA_API_KEY | Your Monoova API key | https://monoova.com/ (sandbox credentials) |
| MONOOVA_API_SECRET | Your Monoova API secret | https://monoova.com/ |
| MONOOVA_API_URL | https://api.monoova.com/v2 | Default (optional) |
| MONOOVA_ENVIRONMENT | sandbox | Change to 'production' after testing |
| MONTHLY_PAYID_BUDGET | 5 | Dollar amount (default: $5/month) |
| ENABLE_NPP_PAYID | true | Set to 'false' to disable PayID |
| ENABLE_VISUAL_AUTH | true | Set to 'false' to disable visual auth |
| ENABLE_ABR_SEARCH | true | Set to 'false' to disable ABR entity discovery |

## Step 4: Set Up PostgreSQL Database

**Recommended:** Use Railway

1. Go to https://railway.app
2. Create new project
3. Add PostgreSQL database
4. Copy the DATABASE_URL
5. Run migration:

```bash
# Run v1 migration (if not already done)
psql "YOUR_DATABASE_URL" < migrations/001_schema.sql

# Run v2 migration (adds KYC tables)
psql "YOUR_DATABASE_URL" < migrations/002_kyc_tables.sql
```

## Step 5: Verify It Works

After Vercel redeploys (automatic after merge):

```bash
# Test health endpoint
curl https://the-firm.vercel.app/health

# Test v1 endpoint (should still work)
curl -X POST https://the-firm.vercel.app/api/verify-document \
  -F "document=@test.pdf"

# Test v2 endpoint
curl https://the-firm.vercel.app/api/kyc/verify-identity
```

**Expected:** Health check returns `{"status":"ok","timestamp":"..."}`

**Note:** v2 endpoints require authentication/document upload - test with actual requests

## Time Estimate
- Push & PR: 2 minutes
- Environment setup: 10 minutes
- Database setup: 10 minutes
- **Total: ~20-25 minutes**

## Success Checklist
- ✅ API endpoints responding (no more 404)
- ✅ Health check working
- ✅ Database connected
- ✅ v1 Document verification functional (POST /api/verify-document)
- ✅ v2 KYC endpoints accessible (POST /api/kyc/verify-identity)
- ✅ Database migration v2 completed (all KYC tables exist)
- ✅ Environment variables configured (ABR, Monoova, etc.)

## Troubleshooting

### API 404 Errors Still Occur
- Check that the PR was merged and Vercel redeployed
- Verify environment variables are set correctly
- Check Vercel function logs for errors

### Database Connection Issues
- Verify DATABASE_URL format
- Ensure database is running and accessible
- Check database credentials

### Environment Variable Issues
- Confirm all required variables are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)
- Ensure GEMINI_API_KEY is valid and has proper permissions

## Alternative Database Options

### Vercel Postgres
1. Go to Vercel dashboard → Storage → Create Database
2. Select PostgreSQL
3. Copy connection string to DATABASE_URL

### Other PostgreSQL Providers
- AWS RDS
- Google Cloud SQL
- DigitalOcean Managed Database

All require updating the DATABASE_URL environment variable.

## Testing Commands

```bash
# Health check
curl https://the-firm.vercel.app/health

# API test (if you have test endpoints)
curl https://the-firm.vercel.app/api/verify

# Check Vercel deployment status
vercel --prod
```

## Support
If you encounter issues not covered here, check:
1. Vercel function logs in dashboard
2. GitHub Actions (if CI/CD is set up)
3. Application error logs in database
