# 📎 CIS Document Attachment Specification

## Overview

The final Customer Information Sheet (CIS) PDF must include **complete copies of all customer proof documents** as appended pages, not just file references. This ensures full regulatory compliance and provides a complete audit trail.

---

## Document Structure

### Page Layout

```
┌─────────────────────────────────────────┐
│  PAGE 1: CIS Summary                    │
│  - Customer Details Table               │
│  - Entity Information                   │
│  - Attachments Index                    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  PAGE 2: Separator - Attachment 1       │
│  "ATTACHMENT: PROOF OF IDENTITY"        │
│  - Label and metadata                   │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  PAGES 3-n: Identity Document           │
│  Complete Driver License / Passport     │
│  (all pages if multi-page)              │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  PAGE n+1: Separator - Attachment 2     │
│  "ATTACHMENT: PROOF OF ADDRESS"         │
│  - Label and metadata                   │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  PAGES n+2-m: Address Document          │
│  Complete Utility Bill / Statement      │
│  (all pages if multi-page)              │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  PAGE m+1: Separator - Attachment 3     │
│  "ATTACHMENT: PROOF OF BANK ACCOUNT"    │
│  - Label, metadata, redaction notice    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  PAGES m+2-end: Bank Statement          │
│  Complete Bank Statement                │
│  ⚠️ ALL MONETARY VALUES REDACTED        │
└─────────────────────────────────────────┘
```

---

## Required Attachments

### 1. Proof of Identity (Attachment 1)

**Acceptable Documents:**
- Driver License (front and back)
- Passport (photo page)
- National ID Card
- Government-issued Photo ID

**Requirements:**
- ✅ Must show customer's full name
- ✅ Must show date of birth
- ✅ Must show photo (if applicable)
- ✅ Must show ID number
- ✅ Must be current/not expired
- ✅ Must be legible (high quality scan/photo)

**Separator Page Contains:**
```
ATTACHMENT: PROOF OF IDENTITY
Proof of Identity - Government-issued ID
Document: GV License.pdf
[Teal separator line]
The following pages contain the complete customer proof document.
```

---

### 2. Proof of Address (Attachment 2)

**Acceptable Documents:**
- Utility Bill (electricity, gas, water)
- Bank Statement showing address
- Government correspondence
- Lease agreement
- Rates notice

**Requirements:**
- ✅ Must show customer's full name
- ✅ Must show complete address
- ✅ Must be dated within last 3 months
- ✅ Must be from recognized authority/company
- ✅ Must be legible

**Separator Page Contains:**
```
ATTACHMENT: PROOF OF ADDRESS
Proof of Address - Official Correspondence
Document: GV Pop Water Bill.pdf
[Teal separator line]
The following pages contain the complete customer proof document.
```

---

### 3. Proof of Bank Account (Attachment 3)

**Acceptable Documents:**
- Bank Statement (last 3-6 months)
- Multiple statements for consistency check

**Requirements:**
- ✅ Must show account holder name
- ✅ Must show BSB and account number
- ✅ Must show bank name
- ✅ Must show transactions (dates and descriptions)
- ⚠️ **ALL MONETARY VALUES MUST BE REDACTED**
- ✅ Must be legible after redaction

**Separator Page Contains:**
```
ATTACHMENT: PROOF OF BANK ACCOUNT
Proof of Bank Account - Statement (Monetary Values Redacted)
Document: GV Bank Statement.pdf
[Teal separator line]
The following pages contain the complete customer proof document.
NOTE: All monetary values have been redacted for privacy and compliance.
```

---

## Page 1: CIS Summary Content

### Header Section
```
CUSTOMER INFORMATION SHEET
AUSTRAC Compliant CDD Report with Attached Proof Documents
────────────────────────────────────────── (Teal line)
```

### Customer Details Section
```
CUSTOMER DETAILS

Full Name: GAVRIL VASILE
Date of Birth: [DD/MM/YYYY]
Address: [Complete residential address]
ID Number: [License/Passport number]
```

### Entity Information Section
```
VERIFIED ENTITY INFORMATION

Business Name: [Entity name]
ABN: [11 digits]
ACN: [9 digits or N/A]
Verification ID: [UUID]
```

### Attachments Index Section
```
ATTACHED PROOF DOCUMENTS

The following pages contain complete copies of customer proof documents:

• Attachment 1: Proof of Identity
  (Driver License, Passport, or Government-issued ID)

• Attachment 2: Proof of Address
  (Utility Bill, Bank Statement, or Official Correspondence)

• Attachment 3: Proof of Bank Account
  (Bank Statement with monetary values redacted)
```

### Footer
```
This document has been generated in compliance with AUSTRAC Customer 
Due Diligence (CDD) requirements. All attached proof documents must be 
retained for 7 years. Monetary values in financial documents have been 
redacted for privacy and compliance.

Generated: [Date/Time in AU format]
```

---

## Implementation Requirements

### Technical Specifications

**1. PDF Merging:**
```typescript
// Use pdf-lib for page-level PDF manipulation
import { PDFDocument } from 'pdf-lib';

// Merge process:
1. Create CIS summary page (page 1)
2. For each attachment:
   a. Add separator page
   b. Copy all pages from source PDF
   c. Append to final document
3. Save complete merged PDF
```

**2. Separator Pages:**
```typescript
// Each separator must:
- Use A4 page size (595.28 × 841.89 points)
- Include attachment type label (large, navy blue)
- Include subtitle (medium, cool gray)
- Include source filename (small, cool gray)
- Include teal horizontal line
- Include descriptive text
- Include redaction warning (if applicable, red text)
```

**3. Monetary Redaction:**
```typescript
// For bank statement attachments:
1. Load PDF
2. Add watermark: "[MONETARY VALUES REDACTED]"
3. (Future: OCR + text replacement for true redaction)
4. Append to CIS
```

**4. Quality Checks:**
```typescript
// Before finalizing:
✓ All 3 attachments present
✓ All pages copied successfully
✓ Separator pages inserted correctly
✓ Bank attachment has redaction watermark
✓ Final PDF is valid and openable
✓ Total page count matches expected
```

---

## File Organization

### Upload Storage Structure

```
uploads/
├── verifications/
│   └── [verification_id]/
│       ├── identity/
│       │   └── GV_License.pdf
│       ├── address/
│       │   └── GV_Pop_Water_Bill.pdf
│       └── bank/
│           └── GV_Bank_Statement.pdf
└── cis/
    └── [cis_id]/
        └── Complete_CIS_[client_name]_[date].pdf
```

### Database References

```sql
-- Store attachment metadata
cis_documents:
  - cis_id (primary key)
  - verification_id (foreign key)
  - document_content (bytea) -- Complete merged PDF
  - attachment_identity_filename
  - attachment_address_filename
  - attachment_bank_filename
  - total_pages
  - generation_date
```

---

## API Changes

### Updated POST /api/generate-cis

**Request Body:**
```json
{
  "verification_id": "uuid",
  "client_name": "GAVRIL VASILE",
  "client_address": "123 Main St, Sydney NSW 2000",
  "date_of_birth": "1985-05-15",
  "id_number": "NSW123456",
  "relationship_start_date": "2024-01-01",
  "attachments": {
    "identity": {
      "filename": "GV_License.pdf",
      "path": "/uploads/verifications/[id]/identity/GV_License.pdf"
    },
    "address": {
      "filename": "GV_Pop_Water_Bill.pdf",
      "path": "/uploads/verifications/[id]/address/GV_Pop_Water_Bill.pdf"
    },
    "bank": {
      "filename": "GV_Bank_Statement.pdf",
      "path": "/uploads/verifications/[id]/bank/GV_Bank_Statement.pdf"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "cis_id": "uuid",
  "document_filename": "Complete_CIS_GAVRIL_VASILE_2025-11-01.pdf",
  "total_pages": 15,
  "pages_breakdown": {
    "summary": 1,
    "identity_separator": 1,
    "identity_pages": 2,
    "address_separator": 1,
    "address_pages": 3,
    "bank_separator": 1,
    "bank_pages": 6
  },
  "download_url": "/api/download-cis/[cis_id]"
}
```

---

## Validation Rules

### Pre-Generation Checks

```typescript
// Must validate before generating CIS:

1. All 3 attachments provided
   ✓ identity file exists and is readable
   ✓ address file exists and is readable
   ✓ bank file exists and is readable

2. All attachments are valid PDFs or images
   ✓ PDF format OR
   ✓ Image format (JPG, PNG) that can be converted to PDF

3. File sizes within limits
   ✓ Each attachment < 10 MB
   ✓ Total size < 25 MB

4. Customer metadata complete
   ✓ client_name not empty
   ✓ client_address not empty
   ✓ verification_id exists in database

5. Verification is approved
   ✓ verification_status === 'approved'
```

### Post-Generation Validation

```typescript
// After PDF generated:

1. Final PDF is valid
   ✓ Can be opened with pdf-lib
   ✓ All pages present
   ✓ No corruption

2. Page count matches expected
   ✓ 1 summary + 3 separators + attachment pages

3. File size reasonable
   ✓ < 30 MB total

4. Bank redaction applied
   ✓ Redaction watermark present on bank pages
```

---

## Error Handling

### Missing Attachments

If any attachment is missing:

```typescript
// Option 1: Fail generation
return res.status(400).json({
  error: 'Missing required attachments',
  missing: ['identity', 'bank']
});

// Option 2: Generate with placeholders
// Add separator page with "DOCUMENT NOT PROVIDED" note
```

### Corrupted Attachments

If attachment cannot be read:

```typescript
// Log error and skip that attachment
console.error(`Failed to append ${attachment.type}: ${error.message}`);

// Add separator page with error note
page.drawText('ERROR: Document could not be attached', {
  color: rgb(0.8, 0, 0)
});
```

### Large Files

If attachment is too large:

```typescript
// Compress before appending
const compressed = await compressPDF(attachmentBuffer);

// Or reject if too large
if (fileSize > 10 * 1024 * 1024) {
  throw new Error('Attachment exceeds 10MB limit');
}
```

---

## Compliance Notes

### AUSTRAC Requirements

✅ **Customer Identification:**
- CIS must include actual ID documents, not references
- Documents must be legible and verifiable
- Documents must be current

✅ **Document Retention:**
- Complete CIS with attachments stored for 7 years
- All components in single PDF for integrity
- No separate file management needed

✅ **Privacy Protection:**
- Monetary values redacted from financial documents
- Only necessary information visible
- Secure storage required

### Audit Trail

✅ **Traceability:**
- Each attachment clearly labeled with source filename
- Separator pages show document type
- Generation timestamp on summary page

✅ **Completeness:**
- All proof documents in single file
- No external dependencies
- Self-contained evidence package

---

## Testing Checklist

### Manual Test Procedure

1. **Upload Test Documents:**
   ```
   - Identity: Driver license (2 pages)
   - Address: Utility bill (3 pages)
   - Bank: Statement (6 pages)
   ```

2. **Generate CIS:**
   ```
   POST /api/generate-cis
   - Include all 3 attachments
   - Verify response shows 15 total pages
   ```

3. **Download and Verify:**
   ```
   - Open PDF in viewer
   - Check page 1: Summary present
   - Check page 2: Identity separator
   - Check pages 3-4: License pages
   - Check page 5: Address separator
   - Check pages 6-8: Utility bill pages
   - Check page 9: Bank separator
   - Check pages 10-15: Bank statement pages
   - Verify bank pages have redaction watermark
   ```

4. **Quality Checks:**
   ```
   ✓ All images legible
   ✓ No pages cut off
   ✓ No pages missing
   ✓ Separator pages formatted correctly
   ✓ Colors match brand guidelines
   ✓ File size reasonable
   ```

---

## Future Enhancements

### Phase 2 Features

1. **OCR-based Redaction:**
   - Extract text from bank PDFs
   - Identify and black out monetary values
   - More secure than watermark overlay

2. **Image Optimization:**
   - Compress images before embedding
   - Reduce file size without quality loss
   - Balance between quality and size

3. **Digital Signatures:**
   - Sign final CIS PDF
   - Verify authenticity
   - Prevent tampering

4. **Batch Processing:**
   - Generate multiple CIS documents
   - Queue-based processing
   - Progress tracking

---

**Document Version:** 1.0  
**Last Updated:** November 1, 2025  
**Applies To:** All CIS document generation  
**Compliance:** AUSTRAC CDD, Privacy Act, Document Retention Standards

