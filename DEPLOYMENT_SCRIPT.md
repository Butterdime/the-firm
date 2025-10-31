# 🚀 RPR CIS SCAN v2 - Deployment Instructions

## Quick Deploy

### Option 1: Use Deployment Script
```bash
./DEPLOY_COMMANDS.sh
```

### Option 2: Manual Deployment

#### 1. Commit Changes
```bash
git add .
git commit -m "feat: Add v2 KYC verification system

- Implement 3-point KYC verification (Identity → Residence → Bank)
- Add ABR entity discovery integration
- Add bank verification with 100-point confidence scoring
- Add CDD report generation
- Add manual review queue system
- Fix: entity_match_method empty string → NULL
- Fix: search_postcode empty string → actual postcode
- Preserve all v1 functionality (zero breaking changes)"
```

#### 2. Push to GitHub
```bash
git push origin main
```

This will automatically trigger Vercel deployment.

---

## Post-Deployment Steps

### 1. Run Database Migration
```bash
psql "$DATABASE_URL" < migrations/002_kyc_tables.sql
```

**Verify tables created:**
```bash
psql "$DATABASE_URL" -c "\dt" | grep -E "(individuals|identity|residence|bank|entity_links)"
```

Expected output should include:
- `individuals`
- `identity_documents`
- `residence_documents`
- `bank_verification_documents`
- `bank_verifications`
- `individual_entity_links`
- `abr_search_cache`
- `manual_review_queue`
- `customer_communications`
- `npp_payid_usage`

### 2. Configure Vercel Environment Variables

Go to: https://vercel.com/Butterdime/the-firm/settings/environment-variables

**Required:**
- `ABR_API_KEY` - Register at https://abr.business.gov.au/
- `MONOOVA_API_KEY` - From Monoova dashboard
- `MONOOVA_API_SECRET` - From Monoova dashboard
- `MONOOVA_ENVIRONMENT=sandbox`

**Optional (have defaults):**
- `ABR_API_URL` - Default provided
- `MONOOVA_API_URL` - Default provided
- `MONTHLY_PAYID_BUDGET=5`
- `ENABLE_NPP_PAYID=true`
- `ENABLE_VISUAL_AUTH=true`
- `ENABLE_ABR_SEARCH=true`

### 3. Verify Deployment

After Vercel finishes deploying:

```bash
# Health check
curl https://the-firm.vercel.app/health

# Should return: {"status":"ok","timestamp":"..."}
```

---

## Deployment Checklist

- [ ] Build passes locally (`npm run build`)
- [ ] Changes committed to git
- [ ] Pushed to GitHub (triggers Vercel)
- [ ] Database migration run
- [ ] Environment variables configured
- [ ] Vercel deployment successful
- [ ] Health endpoint responds
- [ ] v1 endpoint still works (`/api/verify-document`)
- [ ] v2 endpoints accessible (`/api/kyc/*`)

---

## Troubleshooting

### Build Fails on Vercel
- Check Vercel build logs
- Verify all dependencies in `package.json`
- Check TypeScript configuration

### Database Migration Fails
- Verify `DATABASE_URL` is correct
- Check database connection
- Ensure v1 migration was run first

### API Returns 404
- Verify routes are exported correctly
- Check Vercel function logs
- Ensure deployment completed successfully

---

**Ready to deploy!** 🚀

