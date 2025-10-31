# RPR CIS SCAN v2 - Quick Start Guide

## What's New in v2

v2 adds **Individual KYC verification** on top of existing business entity verification:
- 3-point verification: Identity → Residence → Bank Account
- Automatic business entity discovery via ABR search
- Multi-document bank verification with visual authentication
- 100-point confidence scoring system
- Optional NPP PayID verification
- Complete AUSTRAC-compliant CDD reports

## Quick API Test

### 1. Identity Verification (Point 1)
```bash
curl -X POST https://the-firm.vercel.app/api/kyc/verify-identity \
  -F "document=@drivers_license.jpg" \
  -F "full_name=John Smith" \
  -F "dob=1990-01-01" \
  -F "address=123 Main Street" \
  -F "postcode=2000"
```

**Response includes:**
- `individual_id` - Use this for next steps
- `entities_discovered` - Business entities found via ABR

### 2. Residence Verification (Point 2)
```bash
curl -X POST https://the-firm.vercel.app/api/kyc/verify-residence \
  -F "document=@utility_bill.pdf" \
  -F "individual_id=YOUR_INDIVIDUAL_ID"
```

### 3. Bank Verification (Point 3)
```bash
curl -X POST https://the-firm.vercel.app/api/kyc/verify-bank-account \
  -F "documents=@bank_statement1.pdf" \
  -F "documents=@bank_statement2.pdf" \
  -F "individual_id=YOUR_INDIVIDUAL_ID" \
  -F "payid_value=test@example.com" \
  -F "payid_type=email"
```

### 4. Generate CDD Report
```bash
curl https://the-firm.vercel.app/api/kyc/cdd-report/YOUR_INDIVIDUAL_ID \
  --output cdd_report.pdf
```

## Environment Variables Quick Reference

```bash
# Required
ABR_API_KEY=your_abr_guid
MONOOVA_API_KEY=your_key
MONOOVA_API_SECRET=your_secret
MONOOVA_ENVIRONMENT=sandbox

# Optional (have defaults)
ENABLE_NPP_PAYID=true
ENABLE_VISUAL_AUTH=true
ENABLE_ABR_SEARCH=true
MONTHLY_PAYID_BUDGET=5
```

## Database Migration

```bash
psql "$DATABASE_URL" < migrations/002_kyc_tables.sql
```

## Verification Flow

```
1. Identity Verification
   ↓ (discovers 0-N business entities)
2. Residence Verification  
   ↓ (address proof)
3. Bank Verification
   ↓ (1-5 documents, confidence scoring)
   ↓ (if entity matched → triggers trilogy verification)
4. Generate CDD Report
```

## Cost Estimate

- **30 verifications/month**: ~$5/month
- Gemini API: ~$3-5/month
- PayID (optional): ~$0-2/month
- ABR API: Free

## Feature Flags

Disable features if needed:
```bash
ENABLE_NPP_PAYID=false      # Disable PayID lookups
ENABLE_VISUAL_AUTH=false    # Disable visual authentication
ENABLE_ABR_SEARCH=false     # Disable ABR entity discovery
```

## Support

See full documentation:
- `README.md` - Complete API documentation
- `VERCEL_DEPLOYMENT_GUIDE.md` - Deployment instructions
- `V2_DEPLOYMENT_CHECKLIST.md` - Deployment checklist
- `KYC_V2_IMPLEMENTATION_SUMMARY.md` - Technical details

