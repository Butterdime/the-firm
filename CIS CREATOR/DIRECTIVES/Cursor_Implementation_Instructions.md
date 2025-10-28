# Cursor AI Implementation Instructions
## CIS Complete Application - Phase 10: Final Completion

**Target**: Cursor AI Code Editor  
**Objective**: Complete Phase 10 implementation (Source of Funds + ABN Integration)  
**Estimated Time**: 4-6 hours  
**Status**: Ready for immediate execution  

---

## QUICK START

### Prerequisites
1. Cursor AI installed and authenticated
2. CIS Complete repository cloned locally
3. Python 3.10+ environment configured
4. `.env` file with ABR_GUID added
5. Reference files open in Cursor:
   - `Phase_10_SOF_Enforcement.md` [153]
   - `ABN_Lookup_Integration.md` [199]

### First Steps (5 minutes)
```bash
# 1. Install dependencies
pip install python-stdnum requests

# 2. Create new service file
touch backend/gemini_service/abn_service.py

# 3. Update requirements.txt
echo "python-stdnum>=1.20" >> requirements.txt
```

---

## IMPLEMENTATION TASKS FOR CURSOR

### TASK 1: ABN Service Implementation (90 minutes)

**File**: `backend/gemini_service/abn_service.py`

**Prompt for Cursor**:
```
Using the ABN_Lookup_Integration.md [199] guide, create the complete ABN service module.

REQUIREMENTS:
1. Import statements:
   - from stdnum.au import abn as abn_validator
   - import requests, logging, json
   - from typing import Dict, Optional, List
   - from datetime import datetime

2. Create ABNLookupService class with methods:
   - __init__(self, abr_guid: str)
   - validate_abn_format(abn: str) -> bool
   - verify_abn_active(abn: str) -> Dict
   - resolve_mismatched_abn(extracted_name, bsb, account_number) -> Optional[str]
   - search_businesses_by_name(business_name, state=None) -> List[Dict]

3. Create CoP_ComplianceChecker class with methods:
   - __init__(self, abn_service: ABNLookupService)
   - verify_cop_compliance(customer_name, account_holder_name, abn) -> Dict
   - _fuzzy_match_names(name1: str, name2: str) -> str (static method)

4. Include error handling:
   - requests.Timeout exception
   - requests.RequestException exception
   - JSON parsing errors
   - Logging at each step

5. Add caching mechanism:
   - Simple dictionary cache
   - Cache hits before API calls
   - Log cache hits/misses

REFERENCE: See "3. IMPLEMENTATION CODE" section in ABN_Lookup_Integration.md

Return the complete, production-ready file with docstrings and type hints.
```

---

### TASK 2: Source of Funds Frontend Validation (75 minutes)

**File**: `frontend/static/js/document-validation.js`

**Prompt for Cursor**:
```
Create the document validation JavaScript module for Source of Funds enforcement.

REQUIREMENTS:
1. DocumentValidator class with:
   - requiredDocs array: ['identity', 'bank_statement', 'cis', 'source_of_funds']
   - uploadedDocs object for tracking uploads
   - sofType property for selected SOF document type

2. Methods:
   - initializeEventListeners() - setup drag/drop and file inputs
   - handleDragOver(e) and handleDrop(e)
   - handleFileSelect(e) for file input changes
   - processFiles(files, docType) for file validation
   - updateDocumentStatus(docType, fileCount) to update UI checkboxes
   - showSOFRequirements(sofType) to display validation messages
   - validateAllDocuments() to check if ALL docs uploaded
   - proceedToExtraction() to upload and submit
   - generateRequestId() for unique request IDs
   - redirectToProcessing(batchId) for next step

3. Validation rules per SOF type:
   - payslip: 3 months max
   - tax_return: 2 years
   - court_order: 5 years
   - probated_will: 5 years
   - property_deed: 2 years
   - business_reg: current
   - investment_stmt: 3 months

4. Button state management:
   - "Extract Data" button DISABLED until all docs + SOF type present
   - Enable only when validateAllDocuments() returns true
   - Update helper text showing missing documents

5. Error handling:
   - File type validation (PDF, JPEG, PNG only)
   - Network error handling
   - User feedback with alert() and visual indicators

6. Event initialization:
   - Initialize on DOMContentLoaded
   - Auto-run: new DocumentValidator()

REFERENCE: See "Frontend Implementation - HTML/JavaScript" in Phase_10_SOF_Enforcement.md [153]

Return production-ready JavaScript with comments and no external dependencies (vanilla JS).
```

---

### TASK 3: Source of Funds HTML Dashboard (60 minutes)

**File**: `frontend/dashboard/document-upload.html`

**Prompt for Cursor**:
```
Create the HTML5 dashboard for document upload with Source of Funds requirement.

REQUIREMENTS:
1. Structure:
   - Container div: upload-container
   - Section 1: required-docs-section (checklist)
   - Section 2: upload-summary (status display)
   - Section 3: action-section (buttons)

2. Required Documents Checklist (4 items):
   - Identity Document
     * Upload zone with data-doc-type="identity"
     * File input accepting PDF, JPG, PNG
   - Bank Statements (6+ months)
     * Upload zone with data-doc-type="bank_statement"
     * Multiple file support
   - Customer Information Sheet (CIS)
     * Upload zone with data-doc-type="cis"
     * Single file
   - Source of Funds Document (NEW - AUSTRAC Required)
     * Upload zone with data-doc-type="source_of_funds"
     * SOF type selector dropdown (7 types)
     * Validation requirements by type displayed below
     * Age requirements explanation

3. SOF Type Selector:
   - Dropdown with 7 options:
     * Payslip (Employment Income)
     * Tax Return (Self-Employment)
     * Court Order (Legal Settlement)
     * Probated Will (Inheritance)
     * Property Sale Deed (Asset Sale)
     * Business Registration (Business Income)
     * Investment Statement (Investment Income)
   - Initially disabled until SOF document uploaded

4. Upload Zones:
   - Drag-and-drop areas with "Drag & drop [document] here" text
   - File input elements with appropriate accept attributes
   - Visual feedback on hover/drag

5. Status Display:
   - 4 checkbox indicators (initially unchecked)
   - Status text for each: "Not Uploaded" or "✅ Uploaded (n files)"
   - Color changes: red (missing) → green (uploaded)

6. Helper Information:
   - sof-age-requirement section with bulleted list of age limits per SOF type
   - sof-validation-msg displays requirement text based on selected type

7. Action Button:
   - "Extract Data" button initially DISABLED
   - Title tooltip explaining requirement
   - Enabled only when all 4 docs + SOF type present
   - Helper text below button shows status

8. Styling hints:
   - Use Bootstrap 5 classes
   - Professional compliance dashboard appearance
   - Color scheme: green (complete), red (missing), blue (info)
   - Responsive design for mobile/tablet

REFERENCE: See "Frontend Implementation - HTML/JavaScript" section in Phase_10_SOF_Enforcement.md [153]

Return complete HTML5 with embedded Bootstrap 5 CDN links. No inline styles - use classes only.
```

---

### TASK 4: Backend Upload Endpoint Update (75 minutes)

**File**: `backend/api/routes.py` (Update POST /api/documents/upload)

**Prompt for Cursor**:
```
Update the document upload endpoint to enforce Source of Funds requirement.

REQUIREMENTS:
1. Endpoint: POST /api/documents/upload
   - Accept multipart/form-data
   - Require authentication (@require_auth decorator)
   - Return JSON responses

2. Request validation (6 points):
   - VALIDATION 1: All 4 required document types present (identity, bank_statement, cis, source_of_funds)
   - VALIDATION 2: sof_type parameter provided and valid (one of 7 valid types)
   - VALIDATION 3: All file inputs non-empty
   - VALIDATION 4: MIME types valid (application/pdf, image/jpeg, image/png)
   - VALIDATION 5: SOF document-specific validation using validate_sof_document() function
   - VALIDATION 6: Return 400 with descriptive error if any validation fails

3. Success flow:
   - Generate unique batch_id using datetime.timestamp()
   - Create audit_entry dict with all metadata
   - Upload files to GCS using upload_to_gcs() helper
   - Store file paths in storage_paths dict
   - Create DocumentUpload database record with:
     * batch_id, user_id
     * document_manifest JSON with all file paths
     * sof_type (which SOF category)
     * sof_validated flag
     * ready_for_processing = True
     * austrac_cdd_compliant flag
     * austrac_sof_verified flag
   - Commit database transaction
   - Log structured audit entry
   - Return 201 JSON with batch_id and success status

4. Error responses:
   - 400: Missing required document (with doc type)
   - 400: Invalid SOF type (with list of valid types)
   - 400: SOF document validation failed (with reason)
   - 415: Invalid MIME type (with allowed types)
   - 500: Server error (with batch_id for reference)

5. Logging:
   - Log success: batch_id, user_id, doc_count, sof_type
   - Log errors: batch_id, user_id, error_reason
   - Use logger.info() for success, logger.error() for failures

6. Helper function: validate_sof_document(file, sof_type)
   - Extract document metadata using Gemini API
   - Check document age against max_age_days for sof_type
   - Check for required fields specific to sof_type
   - Return {'valid': bool, 'message': str, 'method': str, 'extracted_data': dict}

REFERENCE: See "Backend Implementation - Python" section in Phase_10_SOF_Enforcement.md [153]

Return the complete updated route handler with error handling, logging, and database operations.
```

---

### TASK 5: Database Model Creation (45 minutes)

**File**: `backend/database/models.py` (Add DocumentUpload class)

**Prompt for Cursor**:
```
Create the DocumentUpload SQLAlchemy ORM model for audit trail tracking.

REQUIREMENTS:
1. Model Class: DocumentUpload
   - Inherits from db.Model
   - Table name: 'document_uploads'

2. Columns:
   - id (Integer, primary key)
   - batch_id (String 100, unique, indexed)
   - user_id (String 100, indexed, foreign key to users table)
   - document_manifest (JSON type, not null - stores all file metadata)
   - sof_type (String 50, not null - one of 7 valid SOF types)
   - sof_validated (Boolean, default False)
   - sof_validation_timestamp (DateTime, default utcnow)
   - upload_status (String 50, default 'COMPLETE' - values: COMPLETE|FAILED)
   - ready_for_processing (Boolean, default False)
   - austrac_cdd_compliant (Boolean, default False)
   - austrac_sof_verified (Boolean, default False)
   - upload_time (DateTime, default utcnow, indexed)
   - created_at (DateTime, default utcnow)
   - updated_at (DateTime, default utcnow, onupdate utcnow)

3. Indexes:
   - Composite index on (batch_id, user_id)
   - Composite index on (upload_time)

4. Methods:
   - to_dict() -> Dict: Return JSON-serializable representation

5. Constraints:
   - PrimaryKeyConstraint on id
   - UniqueConstraint on batch_id
   - Foreign key to users(id) on user_id (optional, if users table exists)

REFERENCE: See "Database Model Update" section in Phase_10_SOF_Enforcement.md [153]

Return complete SQLAlchemy model class with all columns, indexes, constraints, and docstrings.
```

---

### TASK 6: ABN Service Integration (60 minutes)

**File**: `backend/api/routes.py` (Add new endpoint or update existing extraction route)

**Prompt for Cursor**:
```
Integrate ABN verification into the document extraction pipeline.

REQUIREMENTS:
1. Integration point: After Gemini document extraction (Step 3)

2. Create new route (or update existing): GET /api/documents/{batch_id}/verify-abn
   - Accept batch_id parameter
   - Retrieve batch from database
   - Extract customer name from batch metadata
   - Call ABNLookupService.resolve_mismatched_abn()
   - If mismatch found:
     * Query ABR Web Service
     * Retrieve corrected ABN
     * Call CoP_ComplianceChecker.verify_cop_compliance()
     * Store corrected ABN in batch metadata
     * Set austrac_sof_verified = True
     * Alert developer (Slack webhook)
   - Return JSON with verification results

3. ABNLookupService initialization:
   - Import from backend.gemini_service.abn_service
   - Initialize with ABR_GUID from environment config
   - Create as singleton or per-request instance

4. Error handling:
   - Timeout: Return 504 with fallback message
   - Invalid ABN: Return 400 with details
   - API Error: Return 500 with logs
   - Not found: Return 404

5. Response format:
   {
     "batch_id": "batch_xxx",
     "cop_verification": {
       "compliant": bool,
       "name_match": "MATCH|CLOSE_MATCH|NO_MATCH",
       "abn_valid": bool,
       "abn_active": bool,
       "verified_entity_name": str,
       "verification_timestamp": ISO datetime,
       "recommendations": [list]
     },
     "corrected_abn": str or null,
     "status": "VERIFIED|REQUIRES_REVIEW|ERROR"
   }

6. Logging:
   - Log verification attempts
   - Log ABN corrections
   - Log CoP compliance status
   - Log errors with full context

REFERENCE: See "ABNLookupService class" in ABN_Lookup_Integration.md [199]

Return the complete route handler with full ABN integration.
```

---

### TASK 7: Configuration & Environment Setup (30 minutes)

**File**: `.env` (Update)

**Prompt for Cursor**:
```
Update environment configuration for Phase 10 features.

ADD these variables:

# ABN Lookup Configuration
ABR_GUID=<YOUR-GUID-FROM-ABR-REGISTRATION>
ABN_VALIDATION_ENABLED=true
ABN_VERIFICATION_ENABLED=true
ABN_CACHE_ENABLED=true
ABN_CACHE_TTL_SECONDS=3600

# Source of Funds Configuration
SOF_ENFORCEMENT_ENABLED=true
SOF_DOCUMENT_REQUIRED=true
SOF_AGE_VALIDATION_ENABLED=true

# Document Processing
DOCUMENT_PROCESSING_TIMEOUT=300
MAX_FILE_SIZE_MB=50
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png

# Audit Trail
AUDIT_LOG_LEVEL=INFO
RETAIN_AUDIT_LOGS_DAYS=2555  # 7 years

NOTES:
- ABR_GUID: Get from https://abr.business.gov.au/Tools/WebServices (free registration)
- Store securely, never commit to version control
- Use .env.example for template (without sensitive values)

Return the complete .env addition.
```

**Also create** `.env.example`:
```bash
# Copy all new variables but leave values empty
ABR_GUID=your-guid-here
ABN_VALIDATION_ENABLED=true
...
```

---

### TASK 8: Unit Tests (90 minutes)

**File**: `tests/unit/test_abn_service.py` (New)

**Prompt for Cursor**:
```
Create comprehensive unit tests for ABN service.

REQUIREMENTS:
1. Test file: tests/unit/test_abn_service.py

2. Fixtures:
   - abn_service: ABNLookupService instance with test GUID
   - sample_abn: Valid test ABN '53004085616'
   - invalid_abns: List of invalid ABNs to test

3. Test cases for ABNLookupService:
   - test_validate_abn_format_valid() → Should return True
   - test_validate_abn_format_with_spaces() → Should handle '53 004 085 616'
   - test_validate_abn_format_invalid_too_short() → Should return False
   - test_validate_abn_format_invalid_checksum() → Should return False
   - test_verify_abn_active_valid() → Mock API, verify success response
   - test_verify_abn_active_invalid_format() → Should handle gracefully
   - test_verify_abn_active_not_found() → ABN not in ABR
   - test_verify_abn_active_api_timeout() → Handle request.Timeout
   - test_cache_hit() → Verify cache improves performance
   - test_resolve_mismatched_abn() → Test name resolution

4. Test cases for CoP_ComplianceChecker:
   - test_exact_name_match() → Should return 'MATCH'
   - test_close_name_match() → Should return 'CLOSE_MATCH'
   - test_no_name_match() → Should return 'NO_MATCH'
   - test_cop_verification_compliant() → All checks pass
   - test_cop_verification_non_compliant() → Mismatch detected
   - test_fuzzy_matching_punctuation() → Handle apostrophes, hyphens
   - test_fuzzy_matching_case_insensitive() → Case handling

5. Mocking:
   - Mock requests.get() for ABR API calls
   - Mock Gemini API calls for document extraction
   - Use pytest-mock fixtures

6. Coverage:
   - Target >85% code coverage
   - Test both success and error paths

REFERENCE: See "Testing" section in ABN_Lookup_Integration.md [199]

Return complete pytest test suite with fixtures, parametrization, and assertions.
```

---

### TASK 9: Integration Tests (60 minutes)

**File**: `tests/integration/test_document_upload.py` (Update)

**Prompt for Cursor**:
```
Create integration tests for complete document upload with SOF enforcement.

REQUIREMENTS:
1. Test file: tests/integration/test_document_upload.py

2. Setup:
   - Create test database
   - Setup Flask test client
   - Create test files (PDF, JPG samples)
   - Mock Gemini API
   - Mock ABR Web Service

3. Test scenarios:
   - test_upload_missing_identity_doc() → 400 error
   - test_upload_missing_sof_doc() → 400 error
   - test_upload_invalid_sof_type() → 400 error
   - test_upload_all_docs_success() → 201 success
   - test_upload_creates_batch_id() → Verify batch_id generated
   - test_upload_stores_in_database() → Verify DocumentUpload record
   - test_upload_audit_trail_recorded() → Verify logging
   - test_sof_document_age_validation_payslip() → Too old payslip rejected
   - test_sof_document_age_validation_tax_return() → Valid tax return accepted
   - test_abn_verification_called_on_extraction() → Verify ABN service called
   - test_abn_mismatch_triggers_alert() → Developer alert sent
   - test_cop_compliance_verified() → CoP check performed

4. Request payloads:
   - Valid upload with all 4 documents
   - Missing documents (test each)
   - Invalid SOF types
   - Invalid file types

5. Assertions:
   - Status codes (201, 400, 500)
   - JSON response structure
   - Database state
   - Audit log entries

REFERENCE: All integration requirements from Phase_10_SOF_Enforcement.md [153]

Return complete integration test suite with comprehensive coverage.
```

---

### TASK 10: Documentation Updates (45 minutes)

**File**: `docs/API.md` (Update), `docs/COMPLIANCE.md` (New)

**Prompt for Cursor**:
```
Update API documentation and create compliance mapping document.

REQUIREMENTS:

1. UPDATE docs/API.md - Add new endpoints:
   
   POST /api/documents/upload
   - Description: Upload customer documents with SOF requirement
   - Auth: Required (Bearer token)
   - Content-Type: multipart/form-data
   - Request fields:
     * identity (file, required)
     * bank_statement (file array, required, min 6 files)
     * cis (file, required)
     * source_of_funds (file, required)
     * sof_type (string, required, enum: payslip|tax_return|...)
   - Response 201: {batch_id, status, documents_uploaded, sof_document_type}
   - Response 400: {error, missing_doc, valid_types}
   - Response 500: {error, batch_id}
   - Example cURL command with all fields

   GET /api/documents/{batch_id}/verify-abn
   - Description: Verify ABN and CoP compliance
   - Auth: Required
   - Response: {batch_id, cop_verification, corrected_abn, status}

2. CREATE docs/COMPLIANCE.md:
   - Title: AUSTRAC Compliance Mapping - CIS Complete
   - Sections:
     * CDD Requirements → Implementation mapping
     * CoP Requirements → Implementation mapping
     * SOF Requirements → Implementation mapping
     * Data Retention Policy → 7-year retention details
     * Audit Trail Requirements → Logging implementation
     * PII Protection → Encryption & masking details

   - Table: Requirement vs Implementation vs File Location vs Status

3. Formatting:
   - Use Markdown tables for mappings
   - Include code examples
   - Link to source code files
   - Add timestamps and version info

REFERENCE: Section "Regulatory Compliance Checklist" in both [153] and [199]

Return updated API.md with new endpoints and new COMPLIANCE.md with full mapping table.
```

---

## EXECUTION ORDER (Priority)

### Phase 10A: Core Implementation (2-3 hours)
1. ✅ **TASK 1**: ABN Service → `abn_service.py` (90 min)
2. ✅ **TASK 5**: Database Model → `models.py` (45 min)
3. ✅ **TASK 4**: Backend Endpoint → `routes.py` (75 min)

### Phase 10B: Frontend (1.5-2 hours)
4. ✅ **TASK 3**: HTML Dashboard → `document-upload.html` (60 min)
5. ✅ **TASK 2**: JavaScript Validation → `document-validation.js` (75 min)

### Phase 10C: Integration & Config (1-1.5 hours)
6. ✅ **TASK 6**: ABN Integration → Update extraction route (60 min)
7. ✅ **TASK 7**: Environment Setup → `.env` files (30 min)

### Phase 10D: Testing & Docs (2-2.5 hours)
8. ✅ **TASK 8**: Unit Tests → `test_abn_service.py` (90 min)
9. ✅ **TASK 9**: Integration Tests → `test_document_upload.py` (60 min)
10. ✅ **TASK 10**: Documentation → `API.md`, `COMPLIANCE.md` (45 min)

---

## STEP-BY-STEP CURSOR WORKFLOW

### 1. Open Reference Files
```
In Cursor:
- Open Tab 1: Phase_10_SOF_Enforcement.md [153]
- Open Tab 2: ABN_Lookup_Integration.md [199]
- Open Tab 3: Current project file being worked on
- Use Cursor's split view (⌘\) to see reference + code
```

### 2. Use Cursor's AI Features Effectively

**For code generation**:
```
Command: Ctrl+K (Mac: Cmd+K)
Input the specific task prompt from above
Let Cursor generate code
Review and accept/modify as needed
```

**For code review**:
```
Command: Ctrl+Alt+A (Select code section)
Ask: "Review this code for production quality, security issues, and compliance requirements"
```

**For testing**:
```
Command: Ctrl+K
Input: "Generate comprehensive pytest test cases for this function"
```

### 3. Verify Syntax & Imports
```
After each file creation:
1. Check for import errors (Ctrl+Shift+M)
2. Run linter (Ctrl+K: "Fix linting issues")
3. Format code (Ctrl+Shift+P: Format Document)
```

### 4. Test as You Go
```
After completing each task:
1. Run unit tests for that component
2. Check for import errors
3. Verify database migrations (if applicable)
```

---

## CRITICAL CHECKLIST

### Before Starting
- [ ] `.env` file created with `ABR_GUID` populated
- [ ] Python 3.10+ environment active
- [ ] Dependencies installed: `pip install python-stdnum requests`
- [ ] Reference files visible in Cursor
- [ ] Git branch created: `feature/phase-10-sof-abv-integration`

### During Implementation
- [ ] Each file has proper docstrings
- [ ] Type hints used throughout
- [ ] Error handling for all external API calls
- [ ] Logging at every key step
- [ ] AUSTRAC compliance maintained
- [ ] No sensitive data in code (use environment variables)

### Before Committing
- [ ] All tests passing (`pytest --cov=backend --cov-report=html`)
- [ ] Coverage >85%
- [ ] No linting errors (`flake8 backend/`)
- [ ] Documentation updated
- [ ] No hardcoded values or secrets
- [ ] Code review checklist completed

### Before Production Deployment
- [ ] Database migration tested
- [ ] ABR GUID verified working
- [ ] E2E tests passed
- [ ] Security audit completed
- [ ] Performance tested (<30s processing)
- [ ] Monitoring configured

---

## COMMON CURSOR PATTERNS TO USE

### Pattern 1: Generate Function with Docstring
```
@app.route('/api/verify', methods=['GET'])
def verify_document():
    """[CURSOR: Generate complete function body matching this docstring]"""
```

### Pattern 2: Add Tests to Existing Code
```
[Select function in editor]
Cmd+K: "Generate pytest tests for this function with >85% coverage"
```

### Pattern 3: Refactor for Compliance
```
[Select code section]
Cmd+K: "Refactor this code to include AUSTRAC compliance logging and error handling"
```

### Pattern 4: Find Integration Points
```
Cmd+K: "Where should this ABN service be integrated into the document processing pipeline? Show code locations."
```

---

## TROUBLESHOOTING

### Issue: Import errors after generation
**Solution**: 
```python
# Run in terminal
pip install -r requirements.txt
python -c "import backend.gemini_service.abn_service"
```

### Issue: ABN API calls failing
**Solution**:
```bash
# Verify ABR_GUID in .env
echo $ABR_GUID

# Test connectivity
curl -X GET "https://abr.asic.gov.au/json/SearchByABNv201604.json?GUID=$ABR_GUID&SearchText=53004085616"
```

### Issue: Tests failing
**Solution**:
```bash
# Run with verbose output
pytest -vv tests/unit/test_abn_service.py

# Check coverage
pytest --cov=backend tests/
```

### Issue: Database migration issues
**Solution**:
```bash
# Reset test database
flask db downgrade
flask db upgrade

# Check migration status
flask db current
```

---

## VALIDATION CHECKLIST - AFTER EACH TASK

| Task | File | Tests | Logs | Docs | ✅ |
|------|------|-------|------|------|-----|
| 1: ABN Service | abn_service.py | Run unit tests | Check logs | Docstrings | |
| 2: Frontend JS | document-validation.js | Browser console | Browser dev tools | JSDoc | |
| 3: HTML Dashboard | document-upload.html | Manual testing | N/A | HTML comments | |
| 4: Backend Upload | routes.py | Integration test | Server logs | API docs | |
| 5: Database Model | models.py | Migration test | Alembic logs | Docstrings | |
| 6: ABN Integration | routes.py update | Integration test | Server logs | Updated | |
| 7: Configuration | .env, .env.example | Manual verify | N/A | README | |
| 8: Unit Tests | test_abn_service.py | pytest run | Test output | N/A | |
| 9: Integration Tests | test_document_upload.py | pytest run | Test output | N/A | |
| 10: Documentation | docs/ | Link check | N/A | Manual review | |

---

## FINAL DEPLOYMENT STEPS

```bash
# After all tasks complete:

# 1. Run all tests
pytest --cov=backend --cov-report=html

# 2. Check coverage target
# Open htmlcov/index.html - ensure >85%

# 3. Commit code
git add -A
git commit -m "Phase 10: Source of Funds + ABN Integration Complete"

# 4. Run migrations
flask db upgrade

# 5. Deploy to staging
gcloud run deploy cis-complete \
  --source . \
  --region us-west1 \
  --no-promote

# 6. Test in staging
# Open staging URL, test complete workflow

# 7. Deploy to production
gcloud run deploy cis-complete \
  --source . \
  --region us-west1

# 8. Verify monitoring
# Check Cloud Logging for errors
# Monitor ABN API usage
```

---

## SUCCESS CRITERIA

### Code Quality
- ✅ All functions have docstrings with type hints
- ✅ >85% test coverage
- ✅ Zero linting errors
- ✅ No hardcoded secrets

### Functionality  
- ✅ SOF document required before extraction
- ✅ All 7 SOF types validated
- ✅ ABN verified against ABR
- ✅ Mismatches corrected automatically
- ✅ CoP compliance checked

### Compliance
- ✅ AUSTRAC CDD requirements satisfied
- ✅ CoP standard compliance verified
- ✅ Audit trail complete
- ✅ PII protected

### Performance
- ✅ Document processing <30 seconds
- ✅ ABN lookup <2 seconds
- ✅ API response <1 second

---

## ESTIMATED TIMELINE

| Phase | Duration | Status |
|-------|----------|--------|
| Setup (before tasks) | 15 min | Ready |
| Tasks 1-3 (Core) | 2-3 hours | Ready for implementation |
| Tasks 4-5 (Frontend) | 1.5-2 hours | Ready for implementation |
| Tasks 6-7 (Integration) | 1-1.5 hours | Ready for implementation |
| Tasks 8-10 (Testing/Docs) | 2-2.5 hours | Ready for implementation |
| **TOTAL** | **4-6 hours** | **Can be done in 1 work session** |

---

## NEXT ACTION

1. **Open Cursor with this project**
2. **Read through this entire document** (15 min)
3. **Start with TASK 1** using the prompt provided above
4. **Paste the prompt into Cursor** (Cmd+K)
5. **Let Cursor generate the code**
6. **Review, refine, commit**
7. **Move to TASK 2**

---

**Status**: ✅ **READY FOR CURSOR IMPLEMENTATION**

**Timeline to Completion**: Same day (4-6 hours)

**Go-Live Ready**: After testing and deployment (1 additional day for staging)

