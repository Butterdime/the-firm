# Rollout Direction: CIS Platform Implementation via Cursor
## For Claude (executing via Cursor on Mac)

---

## Mission Overview

Implement **mismatched verification prevention** for the CIS platform (Customer Information Sheet Generator) targeting Australian SMB accountants. Single constraint: **mismatched verification can NEVER occur**. Manual review at 10 customers/week scale with Railway backend + Vercel frontend.

---

## Rollout Architecture (High-Level)

```
PHASE 1: Backend Foundation (Week 1)
├─ Express API on Railway
├─ Gemini Vision extraction pipeline
├─ ABR verification integration
└─ PostgreSQL audit schema

PHASE 2: Frontend Integration (Week 2)
├─ Vercel deployment
├─ Upload interface
├─ Results viewer
└─ Audit log viewer

PHASE 3: Manual Review Flow (Week 3)
├─ Email notification system
├─ Manual approval/rejection handler
└─ Override logging

PHASE 4: Compliance Validation (Week 4)
├─ Test suite for mismatch scenarios
├─ Audit trail validation
└─ Production readiness check
```

---

## Phase 1: Backend Foundation - DETAILED ROLLOUT

### 1A: Project Setup
**Responsibility**: Claude (Cursor agent)
**Tasks**:
- Initialize Node.js + Express on Railway template
- Set up environment: `GEMINI_API_KEY`, `ABR_API_KEY`, `DATABASE_URL`, `SENDGRID_API_KEY`
- Create `/api` routes structure
- Initialize PostgreSQL schema

**Deliverable**: Repo ready with `npm run dev` working locally

---

### 1B: Gemini Vision Extraction Pipeline
**Responsibility**: Claude (Cursor - Vision Model Agent)
**Constraint**: **Exact extraction only** — no assumptions

**Tasks**:
1. Create `lib/gemini-extraction.ts`:
   ```
   Input: Document image (PDF, PNG, JPG)
   Output: {
     businessName: string,
     abn: string,
     acn: string,
     tradingAs?: string,
     address?: string,
     confidence: 0-100,
     extractedText: string[]
   }
   ```

2. **Non-negotiable**:
   - ❌ Do NOT fuzzy-match OCR output
   - ❌ Do NOT clean/normalize text automatically
   - ✅ DO return raw extracted values AS-IS
   - ✅ DO return confidence score for each field
   - ✅ DO return full document text for audit trail

3. Test cases (Claude must write):
   - Invoice with "ACME PTY LTD T/A Acme Solutions" → extract EXACTLY as written
   - Document with illegible ABN → return `confidence: 15` + best guess
   - Multi-page PDF → extract from all pages, flag ambiguities

**Deliverable**: `lib/gemini-extraction.ts` + test suite

---

### 1C: ABR Verification Engine
**Responsibility**: Claude (Cursor - API Integration Agent)
**Constraint**: Status checking is MANDATORY

**Tasks**:
1. Create `lib/abr-verification.ts`:
   ```
   Input: { abn, businessName, acn }
   Output: {
     found: boolean,
     abrName: string,
     abrStatus: "Active" | "Removed" | "Cancelled" | "Transferred" | "Unknown",
     acrNumber: string,
     registrationDate: string,
     lastStatusChangeDate: string,
     legalEntityType: string
   }
   ```

2. **Non-negotiable**:
   - ❌ Do NOT auto-approve if status ≠ "Active"
   - ❌ Do NOT fuzzy-match on business names
   - ✅ DO query ABR API with exact values only
   - ✅ DO return complete status history if available
   - ✅ DO log every ABR query (audit trail)

3. Test cases (Claude must write):
   - Active company: ACME Pty Ltd, ABN 12345678901 → return status "Active"
   - Dissolved company: Same ABN but dissolved 6 months ago → return status "Removed"
   - Name variation: ABR has "ACME Pty Ltd" but query is "ACME" → return no match

**Deliverable**: `lib/abr-verification.ts` + test suite + ABR API docs

---

### 1D: Mismatch Detection Logic (THE CRITICAL PIECE)
**Responsibility**: Claude (Cursor - Logic Agent)
**Constraint**: Zero false negatives on mismatches

**Tasks**:
1. Create `lib/mismatch-detector.ts`:
   ```
   Input: { 
     extracted: GeminiOutput,
     abrResult: ABROutput,
     documentTimestamp: Date
   }
   Output: {
     isMatch: boolean,
     mismatchType?: "NAME_VARIANCE" | "ABN_INACTIVE" | "STALE_DOCUMENT" | "ACN_MISMATCH",
     confidence: 0-100,
     evidence: {
       field: string,
       extracted: string,
       abrRecord: string,
       severity: "critical" | "warning"
     }[]
   }
   ```

2. **Trilogy Check Logic**:
   ```
   PASS only if:
   ✓ extracted.abn === abrResult.abn
   ✓ extracted.businessName === abrResult.abrName (EXACT, case-sensitive)
   ✓ extracted.acn === abrResult.acrNumber (if both provided)
   ✓ abrResult.abrStatus === "Active"
   ✓ documentTimestamp within 30 days of current date
   
   FAIL on any:
   ✗ Name case mismatch (ACME vs acme)
   ✗ Trading name not captured (ACME T/A Solutions → only ACME extracted)
   ✗ Status not Active
   ✗ ABN doesn't exist in ABR
   ```

3. Test cases (Claude must write - at least 8):
   - Perfect match: All fields match, status Active, recent doc → PASS
   - Case variance: Extracted "ACME PTY LTD" vs ABR "Acme Pty Ltd" → MISMATCH (flag for review)
   - Trading name omitted: Extracted "ACME" vs ABR "ACME T/A Solutions" → MISMATCH
   - Dissolved entity: Status "Removed" → MISMATCH (automatic reject)
   - Stale doc: Document 35 days old → MISMATCH (flag for review)
   - Subsidiary confusion: Parent ABN verified but doc shows subsidiary → MISMATCH (if detected)

**Deliverable**: `lib/mismatch-detector.ts` + comprehensive test suite (8+ scenarios)

---

### 1E: Database Schema & Audit Logging
**Responsibility**: Claude (Cursor - Database Agent)
**Tasks**:
1. Create PostgreSQL schema:
   ```sql
   -- Verification requests
   CREATE TABLE verification_log (
     id UUID PRIMARY KEY,
     accountant_id VARCHAR,
     document_name VARCHAR,
     document_url VARCHAR,  -- stored in Railway filesystem
     extracted_data JSONB,  -- raw Gemini output
     abr_query_data JSONB,  -- what we searched for
     abr_result_data JSONB, -- ABR response
     mismatch_detection JSONB, -- mismatch verdict
     decision VARCHAR,  -- "APPROVED" | "FLAGGED" | "REJECTED"
     decision_reason TEXT,
     decided_by VARCHAR,  -- "AI" or user email
     decided_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Audit overrides (if manual override)
   CREATE TABLE override_log (
     id UUID PRIMARY KEY,
     verification_id UUID REFERENCES verification_log,
     override_from VARCHAR,  -- "FLAGGED" to "APPROVED"
     override_by VARCHAR,  -- user email
     reason TEXT,
     override_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. **Non-negotiable**:
   - ❌ Do NOT delete audit logs
   - ✅ DO store raw data (extractedData, abrResult) for compliance
   - ✅ DO timestamp every decision
   - ✅ DO track who made manual decisions

3. Backup strategy: PostgreSQL backups automatic (Railway handles)

**Deliverable**: Migration file + schema validation script

---

### 1F: Express API Endpoints
**Responsibility**: Claude (Cursor - API Agent)
**Tasks**:

**Endpoint 1: POST /api/verify-document**
```typescript
// Input: multipart/form-data { document: File }
// Process:
// 1. Extract from document (Gemini)
// 2. Query ABR (ABR API)
// 3. Detect mismatch (mismatch-detector)
// 4. Log to PostgreSQL
// 5. If flagged: send email to you
// Output: JSON { status, extractedData, abrData, decision }
```

**Endpoint 2: GET /api/audit-log/:id**
```typescript
// Return: Full audit trail for verification (for compliance)
```

**Endpoint 3: POST /api/manual-review/:id**
```typescript
// Input: { decision: "APPROVED" | "REJECTED", reason: string }
// Update PostgreSQL override_log
// Output: Confirmation
```

**Non-negotiable**:
- ❌ Do NOT expose API keys in responses
- ❌ Do NOT allow unauthenticated access to audit logs
- ✅ DO validate input (file size limits, mime types)
- ✅ DO handle errors gracefully (return 400/500 with reason)

**Deliverable**: Routes with error handling + rate limiting

---

## Phase 2: Frontend Integration - SUMMARY

**Responsibility**: Claude (Cursor - Frontend Agent)

### 2A: Update Vercel Frontend
- Add `POST /api/verify-document` call to upload handler
- Display mismatch warnings clearly (red banner)
- Show audit trail for transparency
- Add manual review link (for flagged cases)

### 2B: Results Display
- Show extracted data vs ABR data side-by-side
- Highlight mismatches in yellow
- Display confidence scores

**Deliverable**: Updated React components + integration tests

---

## Phase 3: Manual Review Flow - SUMMARY

**Responsibility**: Claude (Cursor - Email/Notification Agent)

### 3A: SendGrid Integration
- When mismatch detected → email to your inbox
- Email includes:
  - Extracted data
  - ABR result
  - Mismatch reason
  - Manual review link: `https://your-app.vercel.app/review/{verificationId}`

### 3B: Manual Approval Handler
- You click link → approve/reject with reason
- Reason stored in override_log
- Response sent back to accountant

**Deliverable**: Email templates + override endpoint

---

## Phase 4: Compliance Validation - SUMMARY

**Responsibility**: Claude (Cursor - Test Agent)

### 4A: Test Suite
- Run 8+ mismatch scenarios
- Validate all edge cases from job brief
- Confirm audit trail is complete

### 4B: Compliance Checklist
- ✅ Zero false positives (no mismatches slip through)
- ✅ 100% audit trail (every decision logged)
- ✅ Privacy Act compliance (no biometric data)
- ✅ Data retention (5-year audit logs)

**Deliverable**: Test report + compliance sign-off

---

## Claude's AI Agent Allocation (Cursor Management)

Since Claude is executing via Cursor on Mac, here's the recommended agent allocation:

| Phase | Agent Role | Cursor Personality | Primary Tool |
|---|---|---|---|
| 1A | **DevOps** | Pragmatic, infrastructure-focused | Railway template + env setup |
| 1B | **Vision Model Expert** | Precision-focused, detail-oriented | Gemini API docs + test design |
| 1C | **API Integration Specialist** | Defensive programming, error handling | ABR API docs + query design |
| 1D | **Logic Architect** | Rigorous, constraint-aware | Test-driven development |
| 1E | **Database Designer** | Compliance-focused, audit-trail obsessed | SQL schema + migration patterns |
| 1F | **Backend Engineer** | Security-conscious, error handling | Express middleware + validation |
| 2x | **Frontend Engineer** | User-centric, visual feedback | React components + Axios integration |
| 3x | **Systems Integration** | Notification-focused | SendGrid + webhook handling |
| 4x | **QA Engineer** | Exhaustive testing, edge cases | Jest + integration tests |

---

## Key Concerns & Guardrails for Claude

### CONCERN 1: False Negatives (Critical)
**Risk**: Mismatched verification slips through as approved
**Guard**: 
- Every code review for mismatch-detector.ts must include test cases
- Trio check logic must be explicit (no shortcuts)
- All 8 edge case tests must pass before merging

### CONCERN 2: Audit Trail Gaps (Compliance)
**Risk**: Decision reasoning lost → audit failure
**Guard**:
- Every database write must include reason + timestamp + decision-maker
- Never delete logs (append-only architecture)
- Compliance audit: check PostgreSQL for completeness

### CONCERN 3: API Key Exposure (Security)
**Risk**: GEMINI_API_KEY or ABR_API_KEY visible in frontend
**Guard**:
- All API calls must go through Railway backend
- Frontend should never see keys
- Environment validation on startup

### CONCERN 4: Stale Documentation (Business Logic)
**Risk**: Old document passes verification because ABR data hasn't changed
**Guard**:
- Document timestamp MUST be captured
- Flag if doc > 7 days old (warning) or > 30 days old (block)
- Store documentCaptureDate in verification_log

### CONCERN 5: ABR API Outage (Resilience)
**Risk**: ABR API down → system can't verify
**Guard**:
- Implement exponential backoff retry logic
- If ABR fails after 3 retries → return "REVIEW_REQUIRED" (manual)
- Log all ABR API failures separately

### CONCERN 6: Gemini Extraction Hallucination (Model Reliability)
**Risk**: Gemini makes up data (e.g., hallucinates ABN)
**Guard**:
- Always require confidence score > 70% for auto-approval
- Flag if confidence < 70%
- Return raw extracted text alongside parsed fields (let human verify)

---

## Success Metrics for Claude

✅ **Code Quality**:
- Zero hardcoded values (all config via environment)
- 100% test coverage for mismatch-detector.ts
- All tests passing (no skipped tests)

✅ **Functional Requirements**:
- Mismatched verification detection works (all 8 test cases pass)
- Audit trail is complete (every decision logged with reason)
- Manual review flow works (email → approve → override logged)

✅ **Security & Compliance**:
- API keys never exposed to frontend
- PostgreSQL audit logs immutable
- Privacy Act compliance (no biometric data)

✅ **Operational**:
- Railway backend runs on $5/month plan
- Vercel frontend deployment works
- Email notifications send reliably

---

## Timeline & Cadence for Claude

| Week | Phase | Deliverable | Your Validation |
|---|---|---|---|
| Week 1 | 1A-1E | Backend + DB + 90% tests passing | Review code + test coverage |
| Week 2 | 1F + 2x | API endpoints + Frontend integration | Test manually with sample docs |
| Week 3 | 3x | Email flow + manual review | Review email format + override logic |
| Week 4 | 4x + Production | Full test suite + compliance sign-off | Run through 5 real scenarios |

---

## Prompt for Claude (Copy & Paste This)

---

**CLAUDE: Here's the rollout direction for the CIS platform implementation via Cursor.**

You'll execute this using Cursor on Mac. I've allocated which AI agents (within Cursor) should handle which components. Your job is to:

1. **Work through Phase 1 systematically** (Backend Foundation)
2. **Write comprehensive tests** for mismatch detection (the critical constraint)
3. **Allocate Cursor agents** as needed (you know your tools best)
4. **Flag concerns** if you hit limitations (e.g., "ABR API doesn't return status field")
5. **Deliver working code** that meets the job brief constraints

**Your Single Non-Negotiable**: Mismatched verification can NEVER occur. Every mismatch scenario in the test suite must FAIL in the system (reject or flag for manual review).

**Key Concerns I Have** (build guardrails):
- False negatives (mismatches slipping through)
- Audit trail gaps (decisions not logged)
- API key exposure (security)
- Stale documents (business logic)
- ABR API failures (resilience)
- Gemini hallucination (model reliability)

**Your First Output Should Be**:
1. Confirmation you understand the constraints
2. Questions about ABR API (do you have access? What fields does it return?)
3. Proposed Cursor agent allocation (any adjustments?)
4. Timeline estimate (Phase 1 how many hours?)
5. Early test suite outline (what are the 8 mismatch scenarios you'll test?)

Ready?

---

## Summary: What You're Handing to Claude

**Documents in `/CIS-PLATFORM-BRIEF/`**:
- `claude-job-brief.md` → Technical mandate
- `final-objectives.md` → Business context
- `handoff-strategy.md` → Collaboration framework
- `rollout-direction.md` (THIS FILE) → Implementation roadmap + concerns

Claude sees the full picture:
- **What** to build (mismatched verification prevention)
- **How** to build it (Phases 1-4, specific agents)
- **What concerns** to watch for (6 guardrails)
- **What success looks like** (test suite, audit trail, compliance)

Claude then decides:
- Cursor agent allocation (your workflow optimization)
- Pace and timeline (manage complexity)
- Risk mitigation (flag blockers early)

---

## Files Ready in Your Workspace

```
/Users/puvansivanasan/Documents/APP BUILDING/PERPLEXITY WORKSPACE/
├── CIS-PLATFORM-BRIEF/
│   ├── claude-job-brief.md ← Technical mandate
│   ├── final-objectives.md ← Business context
│   ├── handoff-strategy.md ← Collaboration model
│   └── rollout-direction.md ← THIS FILE (implementation roadmap)
└── [Ready to execute]
```

**Next Step**: Share all four documents with Claude and run the prompt above.
