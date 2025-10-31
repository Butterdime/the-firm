# RPR CIS SCAN v1 Testing Guide

**Version**: 1.0.0
**Date**: October 28, 2025
**Platform**: Trilogy Verification System

---

## OVERVIEW

This guide provides comprehensive testing instructions for the CIS platform's trilogy verification system. The system verifies business registration documents against the Australian Business Register (ABR) using exact matching of ABN + ACN + Business Name.

### Testing Objectives
- Validate trilogy verification logic
- Test all edge cases and failure scenarios
- Ensure audit trails are comprehensive
- Verify production readiness

---

## QUICK START

### 1. Environment Setup

```bash
# Install dependencies
npm install

# Setup database
npm run db:migrate

# Configure environment
cp .env.example .env
# Edit .env with:
# GEMINI_API_KEY=your_key_here
# DATABASE_URL=postgresql://user:pass@localhost:5432/cis_db

# Start development server
npm run dev
```

### 2. Basic Test Command

```bash
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@test-document.pdf" \
  -F "document_date=2025-10-28"
```

### 3. Check Results

```bash
curl http://localhost:3000/api/verifications/{verification_id}
```

---

## TEST SCENARIOS

### Scenario 1: Perfect Match ✅ APPROVED

**Objective**: Verify successful verification with exact matches

**Test Document**: Create a PDF with:
```
ABN: 12 345 678 901
ACN: 123 456 789
Business Name: ACME PTY LTD
```

**ABR Data**: Entity exists with exact matches, status "Active"

**Expected Response**:
```json
{
  "status": "approved",
  "reason": "All verification checks passed",
  "trilogy_checks": {
    "abn_match": true,
    "acn_match": true,
    "name_match": true,
    "entity_active": true
  }
}
```

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@perfect-match.pdf" \
  -F "document_date=2025-10-28"
```

---

### Scenario 2: Case Variance ❌ FLAGGED

**Objective**: Verify case-sensitive matching

**Test Document**:
```
ABN: 12 345 678 901
Business Name: acme pty ltd
```

**ABR Data**: Business Name: "ACME PTY LTD"

**Expected Response**:
```json
{
  "status": "manual_review",
  "reason": "Business name mismatch (case-sensitive exact match required)",
  "trilogy_checks": {
    "abn_match": true,
    "acn_match": true,
    "name_match": false,
    "entity_active": true
  }
}
```

---

### Scenario 3: Trading Name Omitted ❌ FLAGGED

**Objective**: Verify exact name matching (no parsing)

**Test Document**:
```
ABN: 12 345 678 901
Business Name: ACME PTY LTD T/A ACME SERVICES
```

**ABR Data**: Business Name: "ACME PTY LTD"

**Expected Response**:
```json
{
  "status": "manual_review",
  "reason": "Business name mismatch (case-sensitive exact match required)",
  "trilogy_checks": {
    "name_match": false
  }
}
```

---

### Scenario 4: Dissolved Entity ❌ FLAGGED

**Objective**: Verify entity status validation

**Test Document**: Valid ABN, ACN, Name

**ABR Data**: Entity status: "Removed" or "Cancelled"

**Expected Response**:
```json
{
  "status": "manual_review",
  "reason": "Entity status is \"Removed\" (must be \"Active\")",
  "trilogy_checks": {
    "entity_active": false
  }
}
```

---

### Scenario 5: Stale Document ❌ FLAGGED

**Objective**: Verify document freshness requirements

**Test Document**: Valid data, but captured 45 days ago

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@document.pdf" \
  -F "document_date=2025-09-13"  # 45 days ago
```

**Expected Response**:
```json
{
  "status": "manual_review",
  "reason": "Document is 45 days old - manual review required",
  "staleness_check": {
    "requires_review": true,
    "staleness_days": 45
  }
}
```

---

### Scenario 6: ACN Mismatch ❌ FLAGGED

**Objective**: Verify ACN exact matching

**Test Document**:
```
ABN: 12 345 678 901
ACN: 987 654 321  # Wrong ACN
```

**ABR Data**: ACN: 123 456 789

**Expected Response**:
```json
{
  "status": "manual_review",
  "reason": "ACN mismatch: extracted=987654321, ABR=123456789",
  "trilogy_checks": {
    "acn_match": false
  }
}
```

---

### Scenario 7: ABN Not Found ❌ FLAGGED

**Objective**: Verify invalid ABN handling

**Test Document**:
```
ABN: 00 000 000 000  # Invalid ABN
```

**Expected Response**:
```json
{
  "status": "manual_review",
  "reason": "ABR lookup failed: Entity not found in registry"
}
```

---

### Scenario 8: OCR Extraction Failure ❌ FLAGGED

**Objective**: Verify low-confidence extraction handling

**Test Document**: Poor quality scan, unclear text

**Expected Response**:
```json
{
  "status": "manual_review",
  "reason": "Document extraction failed or incomplete - manual review required",
  "extracted_data": {
    "extraction_successful": false
  }
}
```

---

## AUTOMATED TESTING

### Jest Test Template

Create `tests/verification.test.ts`:

```typescript
import { verifyTrilogy } from '../src/lib/trilogy-verification';
import { queryABR } from '../src/lib/abr-verification';

describe('Trilogy Verification', () => {
  test('perfect match should pass', async () => {
    const extracted = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD'
    };

    const abr = await queryABR('12345678901');
    const result = verifyTrilogy(extracted, abr);

    expect(result.passed).toBe(true);
    expect(result.checks.abn_match).toBe(true);
    expect(result.checks.acn_match).toBe(true);
    expect(result.checks.name_match).toBe(true);
    expect(result.checks.entity_active).toBe(true);
  });

  test('case variance should fail', () => {
    const extracted = {
      abn: '12345678901',
      business_name: 'acme pty ltd'
    };

    const abr = {
      abn: '12345678901',
      business_name: 'ACME PTY LTD',
      entity_status: 'Active'
    };

    const result = verifyTrilogy(extracted, abr);
    expect(result.passed).toBe(false);
    expect(result.checks.name_match).toBe(false);
  });

  // Add more test cases...
});
```

### Running Tests

```bash
# Install Jest
npm install --save-dev jest @types/jest ts-jest

# Run tests
npm test
```

---

## API TESTING

### Endpoint Testing

#### 1. Document Upload
```bash
# Success case
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@valid-document.pdf" \
  -F "document_date=2025-10-28" \
  -H "Content-Type: multipart/form-data"

# Expected: 200 OK with verification result
```

#### 2. Verification Retrieval
```bash
curl http://localhost:3000/api/verifications/{id}

# Expected: Complete verification with audit trail
```

### Error Testing

#### File Too Large
```bash
# Create large file (>10MB)
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@large-file.pdf"

# Expected: 400 Bad Request
```

#### Invalid File Type
```bash
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@document.txt"

# Expected: 400 Bad Request - "Only PDF and image files allowed"
```

#### Missing Document
```bash
curl -X POST http://localhost:3000/api/verify-document

# Expected: 400 Bad Request - "No document provided"
```

---

## DATABASE TESTING

### Migration Testing

```bash
# Reset database
npm run db:reset

# Run migrations
npm run db:migrate

# Verify tables created
psql $DATABASE_URL -c "\dt"
```

**Expected Tables**:
- documents
- verifications
- audit_logs

### Data Persistence Testing

```bash
# Upload document
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@test.pdf" \
  -F "document_date=2025-10-28"

# Extract verification ID from response
# Then query database:
psql $DATABASE_URL -c "SELECT * FROM verifications WHERE id = '$VERIFICATION_ID'"
```

---

## PERFORMANCE TESTING

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Create test script (load-test.yml)
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5  # 5 requests per second

scenarios:
  - name: 'Document verification'
    flow:
      - post:
          url: '/api/verify-document'
          formData:
            document: '@test-document.pdf'
            document_date: '2025-10-28'
```

### Response Time Benchmarks

| Operation | Expected Time | Acceptable Range |
|-----------|---------------|------------------|
| OCR Extraction | 2-5 seconds | < 10 seconds |
| ABR Lookup | 0.5-2 seconds | < 5 seconds |
| Trilogy Check | < 0.1 seconds | < 1 second |
| Database Save | 0.2-1 seconds | < 2 seconds |
| **Total** | **3-8 seconds** | **< 15 seconds** |

---

## INTEGRATION TESTING

### End-to-End Flow

1. **Document Upload**
   - Valid PDF/image file
   - Within size limits
   - Correct MIME type

2. **OCR Extraction**
   - Gemini API key configured
   - Document readable
   - Text extraction successful

3. **ABR Lookup**
   - Valid ABN format
   - Network connectivity
   - ABR service available

4. **Trilogy Verification**
   - Exact string matching
   - Status validation
   - Staleness check

5. **Audit Logging**
   - All events logged
   - Data snapshots captured
   - Timestamps accurate

6. **Response Generation**
   - Correct status codes
   - Complete data returned
   - Audit trail included

### Failure Mode Testing

#### Network Failure
```bash
# Simulate network issues
# Disconnect internet during ABR lookup
# Expected: Manual review flagged
```

#### API Key Invalid
```bash
# Use invalid GEMINI_API_KEY
# Expected: OCR extraction fails → manual review
```

#### Database Unavailable
```bash
# Stop PostgreSQL
# Expected: 500 Internal Server Error
```

---

## DEBUGGING GUIDE

### Common Issues

#### 1. OCR Extraction Fails
**Symptoms**: `extraction_successful: false`
**Debug**:
```bash
# Check API key
echo $GEMINI_API_KEY

# Test Gemini API directly
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GEMINI_API_KEY
```

#### 2. ABR Lookup Fails
**Symptoms**: `lookup_successful: false`
**Debug**:
```bash
# Test ABR API manually
curl "https://abr.business.gov.au/abrxmlsearch/abrxmlsearch.asmx/ABRSearchByABN?searchString=12345678901&includeHistoricalDetails=N"
```

#### 3. Database Connection Issues
**Symptoms**: Connection timeout errors
**Debug**:
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

### Log Analysis

```bash
# Check application logs
tail -f logs/app.log

# Check audit logs
psql $DATABASE_URL -c "SELECT * FROM audit_logs ORDER BY event_timestamp DESC LIMIT 10"
```

---

## PRODUCTION CHECKLIST

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] API keys validated
- [ ] File upload directory permissions set
- [ ] SSL certificates installed

### Post-Deployment
- [ ] Health check endpoint responding
- [ ] Sample document verification works
- [ ] Audit logs being written
- [ ] Error handling tested
- [ ] Performance benchmarks met

### Monitoring Setup
- [ ] Response time monitoring
- [ ] Error rate alerts
- [ ] Database connection pool monitoring
- [ ] Disk space monitoring (uploads)
- [ ] API quota monitoring (Gemini)

---

## TROUBLESHOOTING

### Error: "pandoc not found"
**Solution**: Install pandoc for PDF processing
```bash
# macOS
brew install pandoc

# Ubuntu
sudo apt-get install pandoc
```

### Error: "Database connection failed"
**Solution**: Check DATABASE_URL format
```bash
# Example format
DATABASE_URL=postgresql://username:password@localhost:5432/cis_platform
```

### Error: "Gemini API quota exceeded"
**Solution**: Check API usage in Google Cloud Console
- Navigate to APIs & Services → Quotas
- Monitor Gemini API usage
- Upgrade quota if needed

### Error: "File upload failed"
**Solution**: Check file permissions
```bash
chmod 755 uploads/
```

---

## TEST DATA GENERATION

### Sample Documents

Create test PDFs with different scenarios:

```bash
# Install text-to-pdf tool
npm install -g text-to-pdf

# Create perfect match document
echo "ABN: 12 345 678 901
ACN: 123 456 789
Business Name: ACME PTY LTD" | text-to-pdf > perfect-match.pdf

# Create case variance document
echo "ABN: 12 345 678 901
Business Name: acme pty ltd" | text-to-pdf > case-variant.pdf
```

### Mock ABR Responses

For testing without real ABR calls, mock the responses in tests.

---

## CONCLUSION

This testing guide ensures comprehensive validation of the CIS platform's trilogy verification system. All 8 test scenarios must pass before production deployment.

**Remember**: The system is designed to be conservative - when in doubt, flag for manual review. This ensures zero false positives while maintaining verification integrity.

---

**Test Environment Ready**: Follow quick start steps above  
**All Scenarios Tested**: 8/8 scenarios documented  
**Production Ready**: After successful testing completion</content>
<parameter name="filePath">/Users/puvansivanasan/Documents/CLAUDE MAC/cis-platform/TEST_GUIDE.md