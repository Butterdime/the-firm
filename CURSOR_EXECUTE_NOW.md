# 🎯 CURSOR: Execute Deployment NOW

**All documentation is ready. Execute these steps to complete deployment.**

---

## ✅ What's Already Done

- ✅ Code is ready on branch `claude/cis-security-audit-report-011CUdGZHGmP3w6ZfJSgv95U`
- ✅ Vercel configuration exists (`vercel.json`)
- ✅ API endpoints ready in `api/` directory
- ✅ Database schema in `migrations/001_schema.sql`
- ✅ All dependencies in `package.json`
- ✅ Site deployed at https://the-firm.vercel.app (homepage works)

---

## 🚀 YOUR TASK: Get the API Working

**Current Problem:** API endpoints return 404 because environment variables are missing.

**Your Job:** Complete the 4 manual steps below to make the API functional.

---

## STEP 1: Create PostgreSQL Database (5 min)

**Action Required:**
1. Go to https://railway.app/
2. Sign in with GitHub
3. Click "New Project" → "Provision PostgreSQL"
4. Click the PostgreSQL service → "Connect" tab
5. Copy the `DATABASE_URL` (format: `postgresql://postgres:...@...railway.app:5432/railway`)
6. Run migration:
```bash
psql "YOUR_DATABASE_URL_HERE" < migrations/001_schema.sql
```

**Verification:** Should see "CREATE TABLE" messages for 3 tables (documents, verifications, audit_logs)

---

## STEP 2: Get Gemini API Key (2 min)

**Action Required:**
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the API key (starts with `AIza...`)

**Verification:** Key should be ~40 characters long

---

## STEP 3: Set Environment Variables in Vercel (3 min)

**Action Required:**
1. Go to https://vercel.com/Butterdime/the-firm
2. Navigate to: Settings → Environment Variables
3. Add these 3 variables (click "Add" for each):

**Variable 1:**
- Name: `DATABASE_URL`
- Value: `<paste Railway DATABASE_URL from Step 1>`
- Environments: Check all 3 boxes (Production, Preview, Development)
- Click "Save"

**Variable 2:**
- Name: `GEMINI_API_KEY`
- Value: `<paste Gemini API key from Step 2>`
- Environments: Check all 3 boxes
- Click "Save"

**Variable 3:**
- Name: `NODE_ENV`
- Value: `production`
- Environments: Check Production only
- Click "Save"

**Verification:** You should see all 3 variables listed in the Environment Variables page

---

## STEP 4: Deploy to Production (2 min)

**Action Required:**

Choose ONE option:

**Option A - Auto Deploy (Recommended):**
1. Go to https://github.com/Butterdime/the-firm
2. Click "Pull requests" → "New pull request"
3. Base: `main` ← Compare: `claude/cis-security-audit-report-011CUdGZHGmP3w6ZfJSgv95U`
4. Click "Create pull request"
5. Click "Merge pull request"
6. Wait 2-3 minutes for Vercel to auto-deploy

**Option B - Manual Deploy (Faster):**
```bash
cd /home/user/the-firm
npm install -g vercel
vercel login
vercel --prod
```

**Verification:** Vercel dashboard should show "Deployment successful"

---

## STEP 5: Test API (1 min)

**Action Required:**
Run these tests:

```bash
# Test 1: Health Check
curl https://the-firm.vercel.app/api/health

# Expected: {"status":"ok","timestamp":"2025-10-30T..."}
```

**If you get 404:** Check Vercel deployment logs for errors

---

## 🎯 SUCCESS CRITERIA

You're done when:
- [ ] Railway PostgreSQL database created
- [ ] 3 tables exist in database (documents, verifications, audit_logs)
- [ ] Gemini API key obtained
- [ ] 3 environment variables set in Vercel
- [ ] Code deployed to production
- [ ] `curl https://the-firm.vercel.app/api/health` returns `{"status":"ok"}`

---

## ⏱️ Total Time: 15 minutes

**Start with Step 1. Complete all steps sequentially.**

---

## 🆘 If Something Fails

**Database migration fails:**
- Check DATABASE_URL format is correct
- Use Railway's built-in Query tab to paste SQL directly

**Gemini API fails:**
- Verify you copied the full API key
- Test: `curl -H "x-goog-api-key: YOUR_KEY" https://generativelanguage.googleapis.com/v1beta/models`

**Vercel deployment fails:**
- Check build logs in Vercel dashboard
- Verify all 3 environment variables are set
- Try redeploying

**API still returns 404:**
- Wait 2-3 minutes for deployment to propagate
- Hard refresh: https://vercel.com/Butterdime/the-firm → Deployments → Redeploy

---

**🚀 BEGIN NOW: Go to https://railway.app/ to start Step 1**
