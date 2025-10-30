# Example Deployment Commands for Copilot

## Full Deployment (One Command)

```bash
./scripts/deploy-with-credentials.sh \
  --gemini-key AIzaSyC1234567890abcdefghijklmnop-qrstuv \
  --database-url postgresql://postgres:pass123@railway.app:5432/railway
```

---

## With Environment Variables

```bash
# Set credentials as environment variables
export GEMINI_API_KEY="AIzaSyC1234567890abcdefghijklmnop-qrstuv"
export DATABASE_URL="postgresql://postgres:pass123@railway.app:5432/railway"

# Run deployment script
./scripts/deploy-with-credentials.sh \
  --gemini-key "$GEMINI_API_KEY" \
  --database-url "$DATABASE_URL"
```

---

## Step-by-Step Commands

### 1. Setup Vercel Environment Variables

```bash
vercel login  # If not logged in

# Set all environment variables
echo "$GEMINI_API_KEY" | vercel env add GEMINI_API_KEY production
echo "$GEMINI_API_KEY" | vercel env add GEMINI_API_KEY preview
echo "$GEMINI_API_KEY" | vercel env add GEMINI_API_KEY development

echo "$DATABASE_URL" | vercel env add DATABASE_URL production
echo "$DATABASE_URL" | vercel env add DATABASE_URL preview
echo "$DATABASE_URL" | vercel env add DATABASE_URL development

echo "production" | vercel env add NODE_ENV production
```

### 2. Setup Database

```bash
export DATABASE_URL="postgresql://postgres:pass123@railway.app:5432/railway"
./scripts/setup-database.sh
```

### 3. Deploy to Production

```bash
vercel --prod
```

### 4. Verify Deployment

```bash
export DATABASE_URL="postgresql://postgres:pass123@railway.app:5432/railway"
./scripts/deploy-verify.sh
```

---

## Verification Only (After Deployment)

If deployment is already done and you just want to verify:

```bash
./scripts/deploy-with-credentials.sh \
  --gemini-key "$GEMINI_API_KEY" \
  --database-url "$DATABASE_URL" \
  --verify-only
```

---

## Skip Specific Steps

### Skip Vercel Setup (if already done)

```bash
./scripts/deploy-with-credentials.sh \
  --gemini-key "$GEMINI_API_KEY" \
  --database-url "$DATABASE_URL" \
  --skip-vercel
```

### Skip Database Setup (if already done)

```bash
./scripts/deploy-with-credentials.sh \
  --gemini-key "$GEMINI_API_KEY" \
  --database-url "$DATABASE_URL" \
  --skip-database
```

---

## Expected Output (Success)

```
🚀 CIS Platform Automated Deployment
========================================

Configuration:
  GEMINI_API_KEY: AIzaSyC123...qrstuv
  DATABASE_URL: postgresql://postgres@***
  Vercel Project: Butterdime/the-firm

📝 Step 1: Setting up Vercel Environment Variables
------------------------------------------------
Setting GEMINI_API_KEY...
Setting DATABASE_URL...
Setting NODE_ENV...
✅ Environment variables configured

🗄️  Step 2: Setting up Database
--------------------------------
Testing database connection... ✅ Connected
Running database migration...
✅ Migration completed
Verifying tables...
  Checking 'documents'... ✅
  Checking 'verifications'... ✅
  Checking 'audit_logs'... ✅

🚀 Step 3: Triggering Vercel Deployment
----------------------------------------
Deploying to production...
(This may take 2-3 minutes)

✅ Deployment initiated

Waiting for deployment to complete (30 seconds)...

🧪 Step 4: Verifying Deployment
--------------------------------
Testing health endpoint... ✅ PASS
Testing root API endpoint... ✅ PASS
Testing database connection... ✅ PASS

Database statistics:
 table_name    | count
---------------+-------
 Audit Logs    |     0
 Documents     |     0
 Verifications |     0

========================================
🎉 Deployment Successful!

Production URLs:
  🌐 Main: https://the-firm.vercel.app
  ❤️  Health: https://the-firm.vercel.app/api/health
  📄 Verify: https://the-firm.vercel.app/api/verify-document

Next steps:
  1. Test document verification with a real document
  2. Enable Vercel Analytics (optional)
  3. Set up monitoring alerts (optional)

Documentation:
  - API Guide: README.md
  - Security Audit: AUDIT_REPORT.md
  - Deployment Guide: AI_ASSISTANT_DEPLOYMENT_GUIDE.md
```

---

## Troubleshooting

### "vercel: command not found"

```bash
npm install -g vercel
vercel login
```

### "psql: command not found"

```bash
# Mac
brew install postgresql

# Ubuntu
sudo apt-get install postgresql-client
```

### "Could not connect to database"

Check DATABASE_URL format:
```bash
echo $DATABASE_URL
# Should be: postgresql://user:pass@host:port/database?sslmode=require

# Test connection
psql "$DATABASE_URL" -c "SELECT version();"
```

### API returns 404

Wait 2-3 minutes for deployment to complete, then test again:
```bash
sleep 120
curl https://the-firm.vercel.app/api/health
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Full deployment | `./scripts/deploy-with-credentials.sh --gemini-key KEY --database-url URL` |
| Database only | `./scripts/setup-database.sh` (with DATABASE_URL exported) |
| Verify only | `./scripts/deploy-verify.sh` (with DATABASE_URL exported) |
| Deploy to Vercel | `vercel --prod` |
| Check Vercel env vars | `vercel env ls` |
| View Vercel logs | `vercel logs https://the-firm.vercel.app` |

---

**Note**: Replace example credentials with actual values when running commands.
