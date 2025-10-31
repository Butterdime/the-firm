# RPR CIS SCAN v2 - Document Verification API

Hybrid Individual KYC + Business Entity Verification system with **mismatched verification prevention**.

## Core Constraint

**Mismatched verification can NEVER occur.** The system guarantees:
- ABN + ACN + Name exact match (trilogy verification)
- Entity status = "Active" check
- Complete audit trail for every decision
- No fuzzy matching, no false positives

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
# Copy from example
cp .env.example .env

# Edit .env with your values:
DATABASE_URL=postgresql://user:pass@host:5432/database
GEMINI_API_KEY=your-gemini-api-key
PORT=3000
```

### 3. Setup Database

Run the migration script in Railway or local PostgreSQL:

```bash
psql $DATABASE_URL < migrations/001_schema.sql
```

### 4. Start Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

Server runs on `http://localhost:3000`

---

## API Endpoints

### v2 KYC Endpoints (New)

#### POST /api/kyc/verify-identity
Verify individual identity and discover business entities.

**Request:**
```bash
curl -X POST http://localhost:3000/api/kyc/verify-identity \
  -F "document=@drivers_license.jpg" \
  -F "full_name=John Smith" \
  -F "dob=1990-01-01" \
  -F "address=123 Main Street" \
  -F "postcode=2000"
```

**Response:**
```json
{
  "success": true,
  "individual_id": "uuid",
  "identity_verified": true,
  "verification_status": "approved",
  "entities_discovered": [
    {
      "abn": "12345678901",
      "acn": "123456789",
      "business_name": "JOHN SMITH PTY LTD",
      "entity_status": "Active"
    }
  ]
}
```

#### POST /api/kyc/verify-residence
Verify residential address from proof document.

**Request:**
```bash
curl -X POST http://localhost:3000/api/kyc/verify-residence \
  -F "document=@utility_bill.pdf" \
  -F "individual_id=uuid-from-identity-verification"
```

#### POST /api/kyc/verify-bank-account
Verify bank account with 1-5 documents.

**Request:**
```bash
curl -X POST http://localhost:3000/api/kyc/verify-bank-account \
  -F "documents=@bank_statement1.pdf" \
  -F "documents=@bank_statement2.pdf" \
  -F "individual_id=uuid" \
  -F "payid_value=test@example.com" \
  -F "payid_type=email"
```

**Response:**
```json
{
  "success": true,
  "bank_verification_id": "uuid",
  "verification_status": "approved",
  "overall_confidence_score": 85,
  "confidence_level": "HIGH",
  "matched_entity_abn": "12345678901"
}
```

#### GET /api/kyc/cdd-report/:individual_id
Generate CDD report PDF.

#### GET /api/kyc/review-queue
List pending manual reviews.

#### POST /api/kyc/review/:review_id/assign
Assign review to accountant.

#### POST /api/kyc/review/:review_id/complete
Submit review decision.

### v1 Business Entity Endpoints (Existing)

#### POST /api/verify-document

Upload document for entity verification.

**Request:**
```bash
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@invoice.pdf" \
  -F "document_date=2025-10-20"
```

**Response (Approved):**
```json
{
  "status": "approved",
  "verification_id": "uuid",
  "document_id": "uuid",
  "reason": "All verification checks passed",
  "extracted_data": {
    "abn": "12345678901",
    "acn": "123456789",
    "business_name": "EXAMPLE PTY LTD"
  },
  "abr_data": {
    "abn": "12345678901",
    "acn": "123456789",
    "business_name": "EXAMPLE PTY LTD",
    "entity_status": "Active"
  },
  "trilogy_checks": {
    "abn_match": true,
    "acn_match": true,
    "name_match": true,
    "entity_active": true
  }
}
```

**Response (Manual Review Required):**
```json
{
  "status": "manual_review",
  "verification_id": "uuid",
  "reason": "Business name mismatch (case-sensitive exact match required): Extracted: 'ACME PTY LTD', ABR: 'Acme Pty Ltd'",
  "extracted_data": {...},
  "abr_data": {...},
  "trilogy_checks": {
    "abn_match": true,
    "acn_match": true,
    "name_match": false,
    "entity_active": true
  }
}
```

### GET /api/verifications/:id

Get verification result with complete audit trail.

**Response:**
```json
{
  "verification": {
    "id": "uuid",
    "verification_status": "approved",
    "extracted_abn": "12345678901",
    "abr_abn": "12345678901",
    "trilogy_check_passed": true,
    "mismatch_reason": null,
    "created_at": "2025-10-28T..."
  },
  "audit_trail": [
    {
      "event_type": "ocr_extraction",
      "event_timestamp": "2025-10-28T...",
      "decision_result": "pass",
      "decision_reason": "Successfully extracted entity data"
    },
    {
      "event_type": "abr_query",
      "decision_result": "pass",
      "decision_reason": "ABR lookup successful"
    },
    {
      "event_type": "trilogy_check",
      "decision_result": "pass",
      "decision_reason": "Trilogy verification passed"
    },
    {
      "event_type": "approval",
      "decision_result": "pass",
      "decision_reason": "All verification checks passed"
    }
  ]
}
```

---

## Verification Logic

### Trilogy Check (ABN + ACN + Name)

1. **ABN Match:** Extracted ABN === ABR ABN (exact, 11 digits)
2. **ACN Match:** Extracted ACN === ABR ACN (exact, 9 digits) OR both null
3. **Name Match:** Extracted name === ABR name (case-sensitive, whitespace trimmed)
4. **Entity Active:** ABR status === "Active"

**ALL four checks must pass** for approval. Any failure → manual review.

### Staleness Detection

- Document > 7 days old → warning
- Document > 30 days old → manual review required
- Entity status could have changed since document creation

### No Fuzzy Matching

Business names must match **exactly** (case-sensitive):
- ✅ "ACME PTY LTD" === "ACME PTY LTD"
- ❌ "ACME PTY LTD" !== "Acme Pty Ltd"
- ❌ "ACME PTY LTD" !== "ACME PTY. LTD."

---

## Technology Stack

- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (Railway)
- **OCR:** Gemini 2.5 Flash Vision API
- **ABR Lookup:** Public API (data.business.gov.au)

---

## Database Schema

### documents
- Stores uploaded files
- Tracks processing status

### verifications
- Stores trilogy verification results
- Extracted vs. ABR comparison
- Entity status check
- Staleness flags

### audit_logs
- Complete decision trail
- Every check logged with reasoning
- Proves no false positives occurred

---

## Deployment to Railway

### Option 1: GitHub Auto-Deploy

1. Push code to GitHub
2. In Railway: "New Project" → "Deploy from GitHub"
3. Select repository
4. Railway auto-detects Node.js and deploys

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

---

## Environment Variables (Railway)

Add these in Railway dashboard → Variables:

```
DATABASE_URL = [Railway PostgreSQL URL]
GEMINI_API_KEY = [Your Gemini API key]
PORT = 3000
NODE_ENV = production
```

---

## Testing

### Manual Test

```bash
# 1. Start server
npm run dev

# 2. Upload test document
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@test-invoice.pdf" \
  -F "document_date=2025-10-20"

# 3. Check result
curl http://localhost:3000/api/verifications/{verification_id}
```

### Test Cases to Verify

1. ✅ Valid entity (all checks pass) → approved
2. ❌ Name mismatch → manual_review
3. ❌ Entity status = "Cancelled" → manual_review
4. ❌ ABN not found in ABR → manual_review
5. ❌ Extraction failed → manual_review
6. ⚠️ Document > 30 days old → manual_review

---

## Success Criteria

- ✅ Zero false positive approvals
- ✅ 100% audit trail coverage
- ✅ Case-sensitive exact name matching
- ✅ Entity status validation
- ✅ Staleness detection
- ✅ Complete decision reasoning logged

---

## Support

For issues or questions, check:
- [ABR API Docs](https://abr.business.gov.au/)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Railway Docs](https://docs.railway.app/)
