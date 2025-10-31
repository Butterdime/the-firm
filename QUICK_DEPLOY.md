# 🚀 Quick Deploy Guide

## One-Command Deploy

```bash
git add . && git commit -m "feat: Add v2 KYC verification system" && git push origin main
```

This will:
1. Stage all changes
2. Commit with descriptive message
3. Push to GitHub
4. Trigger Vercel auto-deployment

---

## After Deployment

### 1. Database Migration
```bash
psql "$DATABASE_URL" < migrations/002_kyc_tables.sql
```

### 2. Environment Variables
Add in Vercel dashboard:
- `ABR_API_KEY`
- `MONOOVA_API_KEY`
- `MONOOVA_API_SECRET`
- `MONOOVA_ENVIRONMENT=sandbox`

### 3. Verify
```bash
curl https://the-firm.vercel.app/health
```

---

**That's it!** System will be live after these steps. 🎉

