# 🤖 GitHub Copilot - Start Here

**Quick deployment with credentials you already have**

---

## ✨ Single Command Deployment

Since you have the credentials, run this **one command**:

```bash
./scripts/deploy-with-credentials.sh \
  --gemini-key YOUR_GEMINI_API_KEY \
  --database-url YOUR_DATABASE_URL
```

**Replace**:
- `YOUR_GEMINI_API_KEY` - with the Gemini API key you have
- `YOUR_DATABASE_URL` - with the PostgreSQL connection string you have

---

## 📋 Step-by-Step (If Preferred)

### Step 1: Set Environment Variables in Vercel

```bash
# Login to Vercel (if not already logged in)
vercel login

# Set GEMINI_API_KEY
echo "YOUR_GEMINI_API_KEY" | vercel env add GEMINI_API_KEY production
echo "YOUR_GEMINI_API_KEY" | vercel env add GEMINI_API_KEY preview
echo "YOUR_GEMINI_API_KEY" | vercel env add GEMINI_API_KEY development

# Set DATABASE_URL
echo "YOUR_DATABASE_URL" | vercel env add DATABASE_URL production
echo "YOUR_DATABASE_URL" | vercel env add DATABASE_URL preview
echo "YOUR_DATABASE_URL" | vercel env add DATABASE_URL development

# Set NODE_ENV
echo "production" | vercel env add NODE_ENV production
```

### Step 2: Setup Database

```bash
export DATABASE_URL="YOUR_DATABASE_URL"
./scripts/setup-database.sh
```

### Step 3: Trigger Deployment

```bash
vercel --prod
```

### Step 4: Verify

```bash
./scripts/deploy-verify.sh
```

---

## ✅ Success Criteria

When done, you should see:

```
🎉 Deployment Successful!

Production URLs:
  🌐 Main: https://the-firm.vercel.app
  ❤️  Health: https://the-firm.vercel.app/api/health
  📄 Verify: https://the-firm.vercel.app/api/verify-document
```

---

## 🧪 Quick Test

After deployment, test the API:

```bash
# Test health endpoint
curl https://the-firm.vercel.app/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-10-30T..."}
```

---

## 🆘 If Something Fails

Run the automated deployment script with your credentials - it will show exactly what failed:

```bash
./scripts/deploy-with-credentials.sh \
  --gemini-key YOUR_KEY \
  --database-url YOUR_URL
```

Or check the detailed guide:
- **Full deployment guide**: `AI_ASSISTANT_DEPLOYMENT_GUIDE.md`
- **Troubleshooting**: Section "🆘 TROUBLESHOOTING"

---

## 📊 What This Deploys

- ✅ CIS Platform API for document verification
- ✅ OCR extraction via Google Gemini AI
- ✅ ABR (Australian Business Register) integration
- ✅ Trilogy verification (ABN + ACN + Business Name)
- ✅ Complete audit trail for compliance
- ✅ PostgreSQL database for records

---

**Ready to deploy?** Run the single command at the top! 🚀
