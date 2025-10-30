# 🚀 Quick Start for Cursor - CIS Platform Deployment

**Goal**: Get https://the-firm.vercel.app API working in 20 minutes

---

## TL;DR - What You Need

1. **PostgreSQL Database** (Railway or Vercel Postgres)
2. **Gemini API Key** (from Google AI Studio)
3. **Vercel Dashboard Access** (to set environment variables)

---

## 5-Minute Setup

### 1️⃣ Get Database (Railway - Easiest)
```
1. Go to https://railway.app/
2. New Project → Provision PostgreSQL
3. Copy DATABASE_URL
4. Run: psql "YOUR_URL" < migrations/001_schema.sql
```

### 2️⃣ Get API Key
```
1. Go to https://aistudio.google.com/app/apikey
2. Create API Key
3. Copy the key
```

### 3️⃣ Set Environment Variables
```
1. Go to https://vercel.com/Butterdime/the-firm
2. Settings → Environment Variables
3. Add:
   - DATABASE_URL = postgresql://...
   - GEMINI_API_KEY = AIza...
   - NODE_ENV = production
```

### 4️⃣ Deploy
```bash
# Option A: Merge PR (auto-deploys)
Create PR: claude/cis-security-audit-report-011CUdGZHGmP3w6ZfJSgv95U → main

# Option B: Deploy directly (faster)
vercel --prod
```

### 5️⃣ Test
```bash
curl https://the-firm.vercel.app/api/health
# Should return: {"status": "ok", ...}
```

---

## Current Issue

- ✅ Homepage works: https://the-firm.vercel.app
- ❌ API returns 404 (missing environment variables)

## After Setup

API will be fully functional:
- Upload document → OCR extraction
- ABR verification → Trilogy check
- Approval/flagging → Audit trail

---

**Full Instructions**: See `CURSOR_DEPLOYMENT_INSTRUCTIONS.md`

**Estimated Time**: 20-25 minutes total
