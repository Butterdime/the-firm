# 🚀 CURSOR EXECUTE NOW: Deploy CIS API to Production

**Date:** October 30, 2025
**Target:** Get API working at https://the-firm.vercel.app
**Total Time:** 15 minutes
**Status:** Ready for execution

---

## ✅ PRE-EXECUTION CHECKLIST

- [x] Code is ready on branch `claude/cis-security-audit-report-011CUdGZHGmP3w6ZfJSgv95U`
- [x] Database schema in `migrations/001_schema.sql`
- [x] Vercel config in `vercel.json`
- [x] API endpoints in `api/` directory
- [x] Test script at `deployment-test.sh`

---

## 📋 EXECUTION STEPS

### STEP 1: Create Railway PostgreSQL Database (5 min)

**Objective:** Set up PostgreSQL database for storing verification records

**Actions:**
1. Go to https://railway.app/
2. Sign in with GitHub account
3. Click "New Project"
4. Select "Provision PostgreSQL"
5. Wait for provisioning (~30 seconds)
6. Go to PostgreSQL service → "Variables" tab
7. Copy the `DATABASE_URL` value

**Expected Result:**
- DATABASE_URL looks like: `postgresql://postgres:password@region.railway.app:5432/railway`

**Run Migration:**
```bash
cd /Users/puvansivanasan/the-firm
export DATABASE_URL="paste-your-railway-database-url-here"
psql $DATABASE_URL < migrations/001_schema.sql
```

**Verify:**
```bash
psql $DATABASE_URL -c "\dt"
# Should show: documents, verifications, audit_logs
```

---

### STEP 2: Get Gemini API Key (2 min)

**Objective:** Obtain Google Gemini API key for document OCR

**Actions:**
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Select/create a Google Cloud project
5. Copy the API key (starts with `AIza...`)

**Expected Result:**
- API key: `AIzaSyC1234567890abcdefghijklmnop-qrstuv`

---

### STEP 3: Configure Vercel Environment Variables (3 min)

**Objective:** Set required environment variables in Vercel dashboard

**Actions:**
1. Go to https://vercel.com/Butterdime/the-firm/settings/environment-variables
2. Click "Add New" for each variable:

| Variable | Value | Environments |
|----------|-------|--------------|
| DATABASE_URL | `postgresql://postgres:...` | Production, Preview, Development |
| GEMINI_API_KEY | `AIzaSyC...` | Production, Preview, Development |
| NODE_ENV | `production` | Production |

3. Click "Save" for each variable

**Verify in Vercel:**
- All 3 variables show green checkmarks
- No "(not set)" errors

---

### STEP 4: Deploy to Production (2 min)

**Objective:** Deploy the latest code to Vercel production

**Option A: Via GitHub (Recommended)**
1. Go to https://github.com/Butterdime/the-firm
2. Create PR from `claude/cis-security-audit-report-011CUdGZHGmP3w6ZfJSgv95U` → `main`
3. Merge the PR
4. Vercel auto-deploys (2-3 minutes)

**Option B: Via Vercel CLI (Faster)**
```bash
cd /Users/puvansivanasan/the-firm
npm install -g vercel
vercel login
vercel --prod
```

**Expected Result:**
- Vercel dashboard shows "Ready" status
- No build errors in deployment logs

---

### STEP 5: Test the API (1 min)

**Objective:** Verify all endpoints are working correctly

**Run Test Script:**
```bash
cd /Users/puvansivanasan/the-firm
./deployment-test.sh
```

**Expected Results:**
- ✅ Health endpoint: `{"status":"ok","timestamp":"2025-10-30T..."}`
- ✅ Document verification: JSON response with verification data
- ✅ Database connection: Tables exist and accessible
- ✅ Gemini API: Key is valid

**Manual Tests:**
```bash
# Health check
curl https://the-firm.vercel.app/api/health

# Document verification test
echo "ABN: 51824753556
Business Name: EXAMPLE PTY LTD
Date: 2025-10-20" > test.txt

curl -X POST https://the-firm.vercel.app/api/verify-document \
  -F "document=@test.txt" \
  -F "document_date=2025-10-20"
```

---

## 🧪 SUCCESS CRITERIA

**Deployment is successful when:**
- [ ] https://the-firm.vercel.app loads (already working)
- [ ] `/api/health` returns 200 OK with JSON
- [ ] `/api/verify-document` accepts POST requests and returns verification results
- [ ] Database has 3 tables: `documents`, `verifications`, `audit_logs`
- [ ] Gemini API key is valid and working
- [ ] All environment variables are set in Vercel

---

## 🆘 TROUBLESHOOTING

### If API returns 404:
1. Check Vercel deployment logs
2. Verify `vercel.json` has correct routing
3. Ensure `api/` directory exists with serverless functions
4. Check Framework Preset = "Other" in Vercel

### If Database connection fails:
1. Verify `DATABASE_URL` format: `postgresql://user:pass@host:5432/dbname`
2. Test: `psql $DATABASE_URL -c "SELECT 1;"`
3. Check Railway database is running
4. Verify SSL mode: `?sslmode=require`

### If Gemini API fails:
1. Verify API key starts with `AIza`
2. Test: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"`
3. Check quota in Google AI Studio
4. Ensure Gemini 2.5 Flash model is available

### If Build fails:
1. Check Vercel deployment logs for errors
2. Verify TypeScript compilation: `npm run build`
3. Check all dependencies are installed: `npm install`
4. Verify environment variables aren't required at build time

---

## 📊 POST-DEPLOYMENT

**Once working, the platform provides:**
- ✅ Document OCR via Google Gemini
- ✅ Australian Business Register verification
- ✅ Trilogy check (ABN + ACN + Name matching)
- ✅ Complete audit trail in PostgreSQL
- ✅ Security-compliant verification process

**Useful Links:**
- **Live Site:** https://the-firm.vercel.app
- **Vercel Dashboard:** https://vercel.com/Butterdime/the-firm
- **GitHub Repo:** https://github.com/Butterdime/the-firm
- **Railway:** https://railway.app/
- **Google AI Studio:** https://aistudio.google.com/app/apikey

---

## ⏱️ TIMELINE SUMMARY

- Step 1: Database (5 min)
- Step 2: API Key (2 min)
- Step 3: Environment Variables (3 min)
- Step 4: Deploy (2 min)
- Step 5: Test (1 min)

**Total: 13 minutes**

---

**🎯 Ready to Execute! Start with Step 1: https://railway.app/**
