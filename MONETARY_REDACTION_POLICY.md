# 🔒 Monetary Redaction Policy

## Overview

All fiat currency values from bank statements are **fully redacted** to ensure privacy and compliance. No monetary amounts are stored, displayed, or transmitted in CIS documents or related reports.

---

## What Gets Redacted

### ✅ All Monetary Values

1. **Balance Amounts**
   - Opening balance
   - Closing balance
   - Available balance
   - Current balance

2. **Transaction Amounts**
   - Credit amounts
   - Debit amounts
   - Transfer amounts
   - Payment amounts

3. **Totals and Summaries**
   - Total credits
   - Total debits
   - Period totals
   - Running balances

4. **Currency Values in Any Format**
   - `$1,234.56`
   - `AUD 1,234.56`
   - `1,234.56 CR`
   - `($500.00)` (negative)
   - `+$1,000.00` (positive)

---

## What Remains Visible

### ✅ Non-Monetary Information

1. **Account Details**
   - Account holder name
   - BSB (Bank-State-Branch)
   - Account number
   - Bank name

2. **Transaction Information**
   - Transaction date
   - Merchant/payee name
   - Transaction description (without amounts)
   - Transaction type (credit/debit)

3. **Statement Metadata**
   - Statement period
   - Number of transactions
   - Account type
   - Branch information

---

## Examples

### Before Redaction

```
Commonwealth Bank Statement
Account: John Smith
BSB: 062-000
Account Number: 12345678

Opening Balance: $196,885.98 CR
Total Credits: $45,000.00
Total Debits: $48,500.00
Closing Balance: $193,385.98 CR

Transactions:
22 Sep 25  HH CONCRETE          $4,500.00    $192,385.98
23 Sep 25  SALARY DEPOSIT       $5,000.00    $197,385.98
24 Sep 25  TELSTRA SERVICES       $150.00    $197,235.98
17 Oct 25  RENT PAYMENT         $2,500.00    $194,735.98
```

### After Redaction

```
Commonwealth Bank Statement
Account: John Smith
BSB: 062-000
Account Number: 12345678

Opening Balance: [REDACTED]
Total Credits: [REDACTED]
Total Debits: [REDACTED]
Closing Balance: [REDACTED]

Transactions:
22 Sep 25  HH CONCRETE          [REDACTED]    [REDACTED]
23 Sep 25  SALARY DEPOSIT       [REDACTED]    [REDACTED]
24 Sep 25  TELSTRA SERVICES     [REDACTED]    [REDACTED]
17 Oct 25  RENT PAYMENT         [REDACTED]    [REDACTED]
```

---

## CIS Document Format

### Bank Verification Section

When included in a Customer Information Sheet (CIS), bank account information appears as:

```
=== BANK ACCOUNT VERIFICATION ===

Account Holder: John Smith
BSB: 062-000
Account Number: 12345678
Bank: Commonwealth Bank
Statement Period: Last 3 months

--- Account Summary ---
Opening Balance: [REDACTED]
Total Credits: [REDACTED]
Total Debits: [REDACTED]
Closing Balance: [REDACTED]

--- Sample Transactions (127 total) ---
22 Sep 25 | HH CONCRETE | [REDACTED]
23 Sep 25 | SALARY DEPOSIT | [REDACTED]
24 Sep 25 | TELSTRA SERVICES | [REDACTED]
17 Oct 25 | RENT PAYMENT | [REDACTED]
18 Oct 25 | WOOLWORTHS | [REDACTED]

Note: All monetary values have been redacted for privacy and compliance.
```

---

## Implementation

### Utility Functions

**Location:** `src/lib/monetary-redaction.ts`

**Key Functions:**

1. **`redactMonetaryValues(text: string)`**
   - Redacts all monetary values from plain text
   - Returns text with `[REDACTED]` in place of amounts

2. **`redactBankStatement(statement: BankStatementData)`**
   - Redacts structured bank statement data
   - Preserves account and transaction details
   - Removes all monetary values

3. **`generateRedactedBankSummary(statement: BankStatementData)`**
   - Creates a privacy-compliant summary
   - Suitable for CIS document inclusion
   - Includes sample transactions without amounts

4. **`validateRedaction(text: string)`**
   - Validates that all monetary values are redacted
   - Returns list of any remaining currency values
   - Ensures compliance before storage/display

### Regex Patterns Used

The redaction engine uses comprehensive regex patterns to detect:

```typescript
- $1,234.56          // Dollar signs with amounts
- AUD 1,234.56       // Currency code formats
- 1,234.56 CR/DR     // Credit/Debit indicators
- ($500.00)          // Negative amounts in parentheses
- +$1,000.00         // Amounts with signs
- Balance: $1,234    // Balance descriptors
- Total: 1,234.56    // Total descriptors
```

---

## Database Storage

### What Gets Stored

**✅ Stored (Non-Monetary):**
```sql
bank_verifications:
  - account_holder_name
  - bsb
  - account_number
  - bank_name
  - documents_count
  - name_consistency_score
  - overall_confidence_score
```

**❌ NOT Stored (Monetary):**
- Balance amounts
- Transaction amounts
- Credit/debit totals
- Any currency values

### Bank Document Storage

```sql
bank_documents:
  - document_id (UUID)
  - bank_verification_id (FK)
  - document_type (enum)
  - account_holder_name (extracted)
  - bsb (extracted)
  - account_number (extracted)
  - bank_name (extracted)
  - ocr_confidence
  - visual_auth_score
  - uploaded_at
  
  -- NO MONETARY FIELDS
```

---

## Compliance Benefits

### Privacy Protection

✅ **Client Privacy**
- Financial details remain confidential
- Only account verification needed
- No exposure of wealth/income

✅ **AUSTRAC Compliance**
- Meets CDD requirements without storing amounts
- Account verification sufficient for identity
- Reduces data breach risk

✅ **Regulatory Alignment**
- GDPR "data minimization" principle
- Australian Privacy Principles
- Limits PII (Personally Identifiable Information)

### Risk Mitigation

1. **Data Breach**
   - Stolen database reveals no financial amounts
   - Reduces value to attackers
   - Limits client exposure

2. **Internal Access**
   - Staff cannot see client balances
   - Prevents unauthorized disclosure
   - Reduces insider threat

3. **Audit Trail**
   - Verification performed without amount knowledge
   - Objective criteria (account match, not balance)
   - Reduces potential for bias

---

## Verification Without Amounts

### What We Verify

**✅ Account Ownership:**
- Name on account matches client
- BSB and account number consistency across documents
- Bank name verification

**✅ Account Activity:**
- Recent transactions present (dates only)
- Merchant names visible
- Transaction frequency (count)

**✅ Document Authenticity:**
- Visual authentication (watermarks, logos)
- Document format consistency
- Multiple statement cross-verification

**❌ NOT Verified:**
- Account balance sufficiency
- Credit/debit ratios
- Specific transaction amounts
- Financial capacity

---

## Testing & Validation

### Automated Tests

**Location:** `src/lib/monetary-redaction.ts` (includes test function)

**Test Cases:**
```typescript
testRedaction() {
  // Test 1: Simple balance
  "$196,885.98 CR" → "[REDACTED] CR"
  
  // Test 2: Transaction line
  "22 Sep 25 HH CONCRETE $4,500.00 $192,385.98"
  → "22 Sep 25 HH CONCRETE [REDACTED] [REDACTED]"
  
  // Test 3: Totals
  "Total Credits $45,000.00" → "Total Credits [REDACTED]"
  
  // Test 4: Various formats
  "AUD 1,234.56" → "[REDACTED]"
  "($250.50)" → "[REDACTED]"
  "+$1,000.00" → "[REDACTED]"
}
```

### Manual Validation

**Before Storage:**
```typescript
const redacted = redactBankStatement(statement);
const validation = validateRedaction(JSON.stringify(redacted));

if (!validation.is_fully_redacted) {
  throw new Error(`Redaction incomplete: ${validation.remaining_values.join(', ')}`);
}
```

---

## Integration Points

### 1. Bank Statement Upload

```typescript
// src/services/verification/bank.ts

async function processBankStatement(document: Buffer) {
  // Extract data (includes amounts initially)
  const extracted = await extractBankData(document);
  
  // Redact before storage
  const redacted = redactBankStatement(extracted);
  
  // Validate redaction
  const validation = validateRedaction(JSON.stringify(redacted));
  if (!validation.is_fully_redacted) {
    throw new Error('Redaction validation failed');
  }
  
  // Store only redacted data
  await pool.query(
    'INSERT INTO bank_documents (...) VALUES (...)',
    [redacted.account_holder_name, redacted.bsb, redacted.account_number]
    // NO monetary values
  );
}
```

### 2. CIS PDF Generation

```typescript
// src/routes/generate-cis.ts

function addBankSection(doc: PDFDocument, bankData: BankStatementData) {
  const summary = generateRedactedBankSummary(bankData);
  const formatted = formatRedactedStatementForCIS(summary);
  
  doc.text(formatted);
  // All amounts show as [REDACTED]
}
```

### 3. API Responses

```typescript
// Never return monetary values in API responses
GET /api/bank-verification/:id

Response:
{
  "account_holder_name": "John Smith",
  "bsb": "062-000",
  "account_number": "12345678",
  "bank_name": "Commonwealth Bank",
  "verification_status": "approved",
  "confidence_score": 95,
  
  // NO MONETARY FIELDS
  // "balance": NEVER INCLUDED
  // "total_credits": NEVER INCLUDED
  // "transaction_amounts": NEVER INCLUDED
}
```

---

## Configuration

### Environment Variables

```bash
# Enable/disable redaction (always enabled in production)
ENABLE_MONETARY_REDACTION=true

# Redaction token (customize if needed)
REDACTION_TOKEN="[REDACTED]"

# Validation strictness
REDACTION_VALIDATION_STRICT=true
```

### Feature Flags

```typescript
// config/features.ts
export const FEATURES = {
  MONETARY_REDACTION: {
    enabled: true,
    validate_before_storage: true,
    validate_before_display: true,
    allow_override: false, // Never allow unredacted amounts
  }
};
```

---

## Audit & Logging

### Redaction Events

```typescript
// Log all redaction operations
logAuditEvent({
  event_type: 'MONETARY_REDACTION',
  action: 'BANK_STATEMENT_PROCESSED',
  entity_id: bank_verification_id,
  details: {
    document_id: doc_id,
    redaction_validated: true,
    values_redacted_count: 47,
    timestamp: new Date(),
  }
});
```

### Monitoring

Track redaction metrics:
- Total documents processed
- Redaction validation failures
- Average values redacted per document
- Compliance audit requests

---

## Future Enhancements

### 1. OCR Skipping

**Optimization:** Don't extract monetary values in the first place

```typescript
const prompt = `
Extract bank account details:
- Account holder name
- BSB
- Account number
- Bank name

DO NOT extract any monetary values, balances, or amounts.
`;
```

### 2. Document Masking

**Pre-processing:** Mask amounts before OCR

```typescript
async function maskMonetaryValues(pdfBuffer: Buffer): Promise<Buffer> {
  // Use image processing to black out amount areas
  // Preserves document layout
  // OCR cannot extract masked values
}
```

### 3. Blockchain Verification

**Future:** Store redacted statements on blockchain

```typescript
// Immutable proof of verification without amounts
const hash = hashRedactedStatement(redacted);
await blockchain.store({
  statement_hash: hash,
  account_verified: true,
  verification_date: new Date(),
  // NO AMOUNTS
});
```

---

## Support & Questions

For questions about monetary redaction policy:

1. **Review this document first**
2. **Check `src/lib/monetary-redaction.ts` for implementation**
3. **Run test function:** `testRedaction()`
4. **Validate specific text:** `validateRedaction(yourText)`

---

**Policy Version:** 1.0  
**Last Updated:** November 1, 2025  
**Applies To:** All bank statements, financial documents, CIS reports  
**Enforcement:** Automated (cannot be disabled)  
**Compliance:** AUSTRAC CDD, Australian Privacy Principles, GDPR

