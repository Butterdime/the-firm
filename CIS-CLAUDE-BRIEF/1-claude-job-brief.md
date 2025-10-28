# Claude Job Brief: CIS Platform - Mismatched Verification Prevention

## Mission Statement

Build an Australian business entity verification system for SMB accountants that **guarantees mismatched verification can never occur**. The system must prevent fraudulent entity substitution, stale documentation, and OCR-induced false positives that create legal liability for accounting firms processing transactions.

## Project Context

**Your Role**: Technical architect & code implementer
**Your User**: Small CPA firms (1-5 partners) processing business documents for clients
**Your Single Critical Constraint**: Mismatched verification = system failure (no partial credit)

---

## What Is \"Mismatched Verification\"? (The Problem You Must Eliminate)

Mismatched verification occurs when:

1. **OCR Extraction Error**: Document shows \"ACME Pty Ltd T/A Acme Solutions\" but Gemini Vision extracts only \"ACME PTY LTD\" → Platform verifies wrong entity
2. **Business Name Variance**: Document shows \"XYZ Trading\" but ABR registered as \"XYZ Trading Pty Ltd\" → Platform auto-approves, but entity status is dissolved/transferred
3. **Document Staleness**: Document captured Oct 1, verified Oct 27 → ABN changed status, transferred, or company dissolved between dates → Platform doesn't detect time gap
4. **Subsidiary Confusion**: Parent company ABN verified, but transaction goes to subsidiary ABN (different legal entity) → Platform treated as same entity

**Real Impact**: Your accountant customer processes payment/transaction based on platform's ✓ approval, but the verified entity doesn't match the actual receiving entity. When fraud occurs or ATO inquires, the audit trail points to your platform's verification as the source of the error.

**Your CPA Client's Legal Exposure**: 
- Negligent misadventure claims from their clients
- Loss of professional indemnity insurance
- ASIC enforcement if pattern emerges

---

## Design Principles (Non-Negotiable)

### 1. **Verification is Trilogy-Based, Not Singular**
Do not verify ABN alone, business name alone, or ACN alone.
- **Trilogy check**: ABN + registered business name + ACN must all match together
- If OCR extracted name differs from ABR registered name → REJECT or require manual review
- No fuzzy matching on business names

### 2. **Entity Status Must Be Active**
ABR returns metadata field for entity status: \"Active\", \"Removed\", \"Cancelled\", \"Transferred\", etc.
- Verify status = \"Active\" before approval
- Flag if status changed since document capture date
- If status uncertain, require manual verification step

### 3. **Document Timestamp Validation**
Every verification must record when document was captured vs. when verification performed.
- If gap > 30 days → flag for manual review (entity could have changed status)
- Accountant can override with \"I have current confirmation\", but override is logged
- Default: warn on gaps > 7 days

### 4. **Extraction Validation Loop**
After Gemini Vision extracts entity name from document:
1. Query ABR with extracted name
2. If ABR returns zero results → REJECT (extraction failed)
3. If ABR returns results but name doesn't match exactly → human review required
4. If ABR returns match → proceed to trilogy check

### 5. **Audit Trail for Every Mismatch**
Every decision point must be logged:
- OCR extracted: [value]
- ABR queried for: [query]
- ABR returned: [result + status + timestamp]
- User decision: [approved/rejected/flagged]
- Reason if override: [text]

---

## Specific Implementation Requirements

### Technology Stack
- **Entity verification**: ABR (Australian Business Register) API lookup
- **Document processing**: Gemini Vision API (you already have this)
- **Backend**: Node.js/Express on Railway
- **Storage**: PostgreSQL for audit trail

### Output: Two Modes

**Mode 1: Automated Approval** (Safe conditions only)
- ✅ OCR extraction matches ABR name exactly
- ✅ ABR status = \"Active\"
- ✅ Document capture date within 7 days
- ✅ Trilogy check passes (ABN + name + ACN)
- → **Auto-approve**, log it, move on

**Mode 2: Manual Review Required** (Any concern)
- ❌ OCR extraction differs from ABR name
- ❌ ABR status ≠ \"Active\"
- ❌ Document capture date > 7 days old
- ❌ Trilogy check fails
- → **Flag for human review**, show all evidence, let accountant decide with full context

---

## Success Criteria

You've succeeded when:

1. **Zero false positives on mismatch detection** — Platform never approves an entity that doesn't match exactly
2. **100% audit trail coverage** — Every verification decision has complete reasoning logged
3. **ABN lookup integration** — System queries ABR and validates status field
4. **Extraction validation loop** — OCR results validated against ABR before approval
5. **Manual override capability** — Accountant can override with logging, but override is visible
6. **Timestamp validation** — System warns/blocks if document is stale

---

## Your Deliverable

Provide:
1. **Updated document verification pipeline** (with the mismatch-prevention layers above)
2. **ABR API integration code** (status checking, exact name matching)
3. **Audit logging schema** (what to log, where to store)
4. **Manual review UI** (what accountant sees when flag is triggered)
5. **Test cases** (example scenarios where your system correctly rejects/approves)

---

## Constraints & Guardrails

- **Do not** ship this with fuzzy matching on entity names
- **Do not** approve entity if status is anything other than \"Active\"
- **Do not** skip the extraction validation loop
- **Do not** assume accountant will check manually — make the system foolproof

---

## Questions for You Before Starting

1. Do you have ABR API access, or should I use public API?
2. What's your acceptable false positive rate? (0% is requirement)
3. How should manual review workflow work? (Email notification? In-app queue?)
4. What's the acceptable delay for manual review? (Same day? Next day?)", "_tool_input_summary": "Write claude-job-brief.md", "_requires_user_approval": true}