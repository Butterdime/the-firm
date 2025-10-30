# CURSOR: Complete This Deployment Task

## Your Assignment

Get the API working at **https://the-firm.vercel.app**

Currently: Homepage works, but `/api/health` returns 404

## What You Have

✅ All code is ready in this repository
✅ Database schema: `migrations/001_schema.sql`
✅ Vercel config: `vercel.json`
✅ API endpoints: `api/` directory

## What's Missing (Why API Returns 404)

❌ PostgreSQL database not created
❌ Gemini API key not obtained
❌ Environment variables not set in Vercel

## Your Task (4 Steps - 15 Minutes)

### 1. Create PostgreSQL Database on Railway
- Go to https://railway.app/
- New Project → Provision PostgreSQL
- Copy the `DATABASE_URL`
- Run: `psql "YOUR_URL" < migrations/001_schema.sql`

### 2. Get Gemini API Key
- Go to https://aistudio.google.com/app/apikey
- Create API Key
- Copy the key (starts with `AIza...`)

### 3. Add Environment Variables to Vercel
- Go to https://vercel.com/Butterdime/the-firm/settings/environment-variables
- Add 3 variables:
  - `DATABASE_URL` = (from step 1)
  - `GEMINI_API_KEY` = (from step 2)
  - `NODE_ENV` = `production`

### 4. Deploy
- Create PR: `claude/cis-security-audit-report-011CUdGZHGmP3w6ZfJSgv95U` → `main`
- Merge it (Vercel auto-deploys)

OR run: `vercel --prod`

## Success Check

When done:
```bash
curl https://the-firm.vercel.app/api/health
```

Should return: `{"status":"ok","timestamp":"..."}`

## Detailed Instructions

See `CURSOR_EXECUTE_NOW.md` for step-by-step details.

---

**Start now: https://railway.app/**
