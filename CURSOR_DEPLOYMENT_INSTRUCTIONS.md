# Cursor Deployment Instructions - CIS Platform

**Objective**: Get the API endpoints working on https://the-firm.vercel.app

**Current Status**:
- ✅ Site is live (homepage loads)
- ❌ API endpoints return 404
- ✅ Code is ready on branch `claude/cis-security-audit-report-011CUdGZHGmP3w6ZfJSgv95U`

---

## STEP 1: Set Up Database (PostgreSQL)

### Option A: Use Railway (Recommended - Fast & Easy)

1. **Go to Railway**: https://railway.app/
2. **Sign in** with GitHub
3. **Create New Project** → "Provision PostgreSQL"
4. **Get Database URL**:
   - Click on the PostgreSQL service
   - Go to "Connect" tab
   - Copy the `DATABASE_URL` (starts with `postgresql://`)
   - Save this URL - you'll need it in Step 2

5. **Run Migration**:
   ```bash
   # In your terminal (from project root):
   psql "postgresql://user:pass@host/db" < migrations/001_schema.sql
   ```
   Replace with your actual DATABASE_URL from Railway

### Option B: Use Vercel Postgres

1. **Go to Vercel Dashboard**: https://vercel.com/Butterdime/the-firm
2. **Storage** tab → "Create Database" → "Postgres"
3. **Follow wizard** to create database
4. **Get DATABASE_URL** from the environment variables section
5. **Run migration** using Vercel CLI:
   ```bash
   vercel env pull .env.local
   psql $DATABASE_URL < migrations/001_schema.sql
   ```

---

## STEP 2: Get Gemini API Key

1. **Go to Google AI Studio**: https://aistudio.google.com/app/apikey
2. **Sign in** with Google account
3. **Create API Key**
4. **Copy the key** - save it for next step

---

## STEP 3: Configure Vercel Environment Variables

1. **Go to Vercel Dashboard**: https://vercel.com/Butterdime/the-firm
2. **Settings** → **Environment Variables**
3. **Add these three variables**:

   | Variable Name | Value | Environment |
   |---------------|-------|-------------|
   | `DATABASE_URL` | `postgresql://...` (from Step 1) | Production, Preview, Development |
   | `GEMINI_API_KEY` | `AIza...` (from Step 2) | Production, Preview, Development |
   | `NODE_ENV` | `production` | Production |

4. **Click "Save"** for each variable

---

## STEP 4: Merge Code to Main Branch (Trigger Redeploy)

### Option A: Create Pull Request (Recommended)

1. **Go to GitHub**: https://github.com/Butterdime/the-firm
2. **Create PR**:
   - From: `claude/cis-security-audit-report-011CUdGZHGmP3w6ZfJSgv95U`
   - To: `main`
3. **Review changes** (should include API fixes)
4. **Merge the PR**
5. Vercel will **automatically redeploy** after merge

### Option B: Force Deploy from Current Branch (Faster)

```bash
# From your terminal in project directory:

# Install Vercel CLI (if not installed)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

This deploys immediately without waiting for PR approval.

---

## STEP 5: Verify Deployment

### Test Health Endpoint

```bash
curl https://the-firm.vercel.app/api/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-30T..."
}
```

If you get 404 or error, check:
- Environment variables are set correctly
- Database migration ran successfully
- Vercel build logs for errors

### Test Document Verification

```bash
# Upload a test document (you need a PDF/image)
curl -X POST https://the-firm.vercel.app/api/verify-document \
  -F "document=@test-invoice.pdf" \
  -F "document_date=2025-10-20"
```

**Expected Response**: JSON with verification result

---

## STEP 6: Check Vercel Build Logs

If API still returns 404:

1. **Go to Vercel Dashboard**: https://vercel.com/Butterdime/the-firm
2. **Deployments** tab
3. **Click latest deployment**
4. **View Build Logs**
5. Look for errors in:
   - Build phase
   - Function initialization
   - Runtime logs

Common issues:
- Missing environment variables
- TypeScript compilation errors
- Database connection failures

---

## TROUBLESHOOTING

### Issue: API Returns 404

**Solution**:
1. Check `vercel.json` routes configuration
2. Verify `api/index.ts` exists and exports correctly
3. Check Vercel build settings: Framework Preset should be "Other"
4. Redeploy after fixing

### Issue: Database Connection Error

**Solution**:
1. Verify `DATABASE_URL` format: `postgresql://user:pass@host:5432/dbname`
2. Check database is accessible (not behind firewall)
3. Test connection locally first:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

### Issue: Gemini API Error

**Solution**:
1. Verify API key is valid
2. Check quota limits in Google AI Studio
3. Test API key locally:
   ```bash
   curl -H "x-goog-api-key: YOUR_KEY" \
     https://generativelanguage.googleapis.com/v1beta/models
   ```

---

## QUICK CHECKLIST

Before marking as complete, verify:

- [ ] PostgreSQL database created and accessible
- [ ] Database migration ran successfully (3 tables created)
- [ ] Gemini API key obtained and tested
- [ ] All 3 environment variables set in Vercel
- [ ] Code merged to main (or deployed directly)
- [ ] Vercel build succeeded (no errors)
- [ ] `/api/health` returns 200 OK
- [ ] `/api/verify-document` accepts POST requests
- [ ] Site is fully functional: https://the-firm.vercel.app

---

## EXPECTED TIMELINE

- **Step 1** (Database): 5 minutes
- **Step 2** (API Key): 2 minutes
- **Step 3** (Environment Variables): 3 minutes
- **Step 4** (Deploy): 5-10 minutes
- **Step 5** (Testing): 5 minutes

**Total Time**: ~20-25 minutes

---

## HELPFUL LINKS

- **Live Site**: https://the-firm.vercel.app
- **Vercel Dashboard**: https://vercel.com/Butterdime/the-firm
- **GitHub Repo**: https://github.com/Butterdime/the-firm
- **Railway**: https://railway.app/
- **Google AI Studio**: https://aistudio.google.com/app/apikey
- **Vercel Docs**: https://vercel.com/docs

---

## AFTER COMPLETION

Once everything is working, you should be able to:

1. **Upload a document** (PDF/image with ABN, ACN, business name)
2. **Get instant verification** via API
3. **View audit trail** for each verification
4. **Check verification status** by ID

The platform will:
- Extract data using Gemini OCR
- Verify against Australian Business Register
- Perform trilogy check (ABN + ACN + Name)
- Return approval or flag for manual review
- Log complete audit trail

---

**Ready to deploy!** Follow the steps above in order, and the site will be fully functional.
