# Google Code Assistant: CIS-Complete Phase 12 Bug Fixes & Hardening

## CONTEXT: CIS-Complete Compliance Platform
- **Application**: Customer Information Sheet & Due Diligence Platform (AML/CTF Compliance)
- **Current Phase**: 12 (Testing, Optimization & Deployment)
- **Infrastructure**: Google Cloud Run (us-west1)
- **Primary Stack**: React + TypeScript, Google Gemini Pro Vision v2, OpenCV.js, pdf-lib
- **Regulatory Target**: AUSTRAC compliance for Australian financial institutions

---

## CRITICAL ISSUES TO FIX

### 1. OCR PIPELINE DEGRADATION & CHARACTER ENCODING CORRUPTION

**Problem Statement**:
The OpenCV preprocessing and Gemini Vision OCR pipeline is producing severely corrupted output across all test CDD reports, including:
- Greek character injection (Α, τ, Τo, Cyrillic "Й", "С", "Ы", "М", "Т")
- Garbled field names ("Ratce notice" → "Rates Notice", "townosilie.gid.cor.au", "ENQUIRIES I 13 48 10")
- Impossible date values ("Period bom 01/07/2820 lo 21/12/2020" → Year 2820)
- Nonsensical text replacement ("Cuenmost Aconiane" as license conditions)
- Widespread misspellings suggesting low confidence in character recognition

**Root Cause**:
1. OpenCV preprocessing is too aggressive; creating artifacts instead of clarifying images
2. Character encoding is not UTF-8 validated; foreign characters are bleeding through
3. No confidence scoring validation before accepting OCR output
4. Gemini Vision v2 may be receiving degraded/preprocessed images instead of originals

**Files to Modify**:
- `src/services/ocr/openCVProcessor.ts`
- `src/services/ocr/gemiEOCRExtractor.ts`
- `src/utils/characterValidation.ts` (new file)
- `src/services/imageQuality/imageValidator.ts`

**Implementation Requirements**:

```typescript
// 1. REDUCE OPENCV PREPROCESSING AGGRESSIVENESS
// Current: Multiple filters applied (blur, threshold, contrast, morphology)
// Target: Minimal preprocessing; send high-quality originals to Gemini

const processImageForOCR = (imagePath: string): Buffer => {
  const image = cv.imread(imagePath);
  
  // REMOVE: Aggressive threshold, morphology operations
  // KEEP ONLY: Light grayscale + mild denoising if needed
  const gray = cv.cvtColor(image, cv.COLOR_RGB2GRAY);
  
  // Apply ONLY if image quality is severely degraded
  if (estimateImageQuality(gray) < 0.3) {
    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 1);
  }
  
  return gray.data;
};

// 2. ADD CHARACTER ENCODING VALIDATION
// Reject non-ASCII/invalid UTF-8 characters from OCR output

const validateCharacterEncoding = (text: string): string => {
  // Flag: Non-ASCII characters that are NOT expected in Australian documents
  const invalidChars = /[^\x00-\x7F\u0100-\u017F\u0180-\u024F]/g; 
  const matches = text.match(invalidChars) || [];
  
  if (matches.length > 0) {
    console.warn(`[OCR-VALIDATION] Non-ASCII characters detected:`, matches);
    throw new OCRValidationError(
      `Character encoding issue detected. Found ${matches.length} invalid characters. ` +
      `OCR confidence may be compromised.`
    );
  }
  
  return text;
};

// 3. IMPLEMENT CONFIDENCE THRESHOLD VALIDATION
// Only accept OCR results above 85% confidence; flag lower confidence for manual review

const validateOCRConfidence = (
  extractedData: OCRResult,
  threshold: number = 0.85
): OCRResult => {
  if (extractedData.confidence < threshold) {
    extractedData.requiresManualReview = true;
    extractedData.reviewReason = 
      `OCR confidence ${(extractedData.confidence * 100).toFixed(1)}% below ` +
      `${(threshold * 100).toFixed(0)}% threshold`;
  }
  
  return extractedData;
};

// 4. PRE-VALIDATE IMAGE QUALITY BEFORE OCR
// Reject blurry/low-resolution images before sending to Gemini

const validateImageQualityGate = (imagePath: string): ValidationResult => {
  const image = cv.imread(imagePath);
  const grayImage = cv.cvtColor(image, cv.COLOR_RGB2GRAY);
  
  // Calculate Laplacian variance (blur detection)
  const laplacian = cv.Laplacian(grayImage, cv.CV_64F);
  const mean = new cv.Scalar();
  const stdDev = new cv.Scalar();
  cv.meanStdDev(laplacian, mean, stdDev);
  const blurVariance = stdDev.val[0] * stdDev.val[0];
  
  if (blurVariance < 100) {
    return {
      isValid: false,
      reason: `Image too blurry (variance: ${blurVariance.toFixed(0)}). ` +
              `Minimum acceptable: 100`,
      severity: 'CRITICAL'
    };
  }
  
  // Check resolution
  if (image.cols < 800 || image.rows < 600) {
    return {
      isValid: false,
      reason: `Image resolution too low (${image.cols}x${image.rows}). ` +
              `Minimum: 800x600`,
      severity: 'HIGH'
    };
  }
  
  return { isValid: true };
};
```

---

### 2. PII MASKING LAYER INCORRECTLY REMOVING NAMES FROM PRIMARY OUTPUT

**Problem Statement**:
Customer names are being removed from CDD reports entirely, appearing as masked values ("6700XX") instead of actual extracted data. This violates AUSTRAC requirements that CDD reports must contain customer identification information.

**Root Cause**:
The PII detection layer added in Phase 11 is being applied during data extraction phase rather than output serialization phase. Names are being masked before PDF generation, resulting in incomplete reports.

**Files to Modify**:
- `src/services/dataExtraction/piiMaskingService.ts`
- `src/services/pdf/cddReportGenerator.ts`
- `src/config/piiConfig.ts`

**Implementation Requirements**:

```typescript
// 1. RELOCATE PII MASKING TO OUTPUT LAYER ONLY

// src/config/piiConfig.ts
export const PII_CONFIG = {
  // CRITICAL: Names must NOT be masked in primary CDD reports
  preserveInCDDReport: true,
  preserveInInternalVerification: true,
  
  // Mask ONLY in external transmission/logging
  maskInExternalAPI: true,
  maskInAuditTrail: true,
  maskInEmailNotifications: true,
  
  // Fields that should NEVER be masked in CDD reports
  neverMaskInReport: [
    'customerName',
    'businessName',
    'tradingName',
    'directorName',
    'trusteeName'
  ],
  
  // Fields that can be masked for security
  maskableFields: [
    'accountNumber',
    'bsb',
    'creditCardNumber',
    'licenseNumber',
    'taxFileNumber'
  ]
};

// 2. SEPARATE EXTRACTION AND MASKING PIPELINES

const extractCustomerData = async (
  document: Buffer
): Promise<UnmaskedCustomerData> => {
  // Return COMPLETE data with all names/numbers intact
  const extracted = await gemiOCRExtractor.extract(document);
  
  // Validate nothing was premature masked
  if (!extracted.customerName || extracted.customerName.includes('XX')) {
    throw new DataExtractionError(
      'Customer name missing or masked during extraction. ' +
      'PII masking should occur only at output layer.'
    );
  }
  
  return extracted;
};

// 3. IMPLEMENT OUTPUT-LAYER MASKING

const generateCDDReportPDF = async (
  data: UnmaskedCustomerData,
  options: GenerateOptions = {}
): Promise<PDFBytes> => {
  const outputEnv = options.environment || 'internal_audit'; // Default: preserve names
  
  // Determine masking strategy based on environment
  let dataForPDF = data;
  
  if (outputEnv === 'external_transmission') {
    dataForPDF = maskPIIForExternalTransport(data);
  } else if (outputEnv === 'internal_audit') {
    dataForPDF = data; // No masking for internal use
  }
  
  // Generate PDF with appropriate data
  const pdfDoc = await PDFDocument.create();
  
  // Add sections with unmasked/masked data as appropriate
  addIdentitySection(pdfDoc, dataForPDF);
  addAddressSection(pdfDoc, dataForPDF);
  addComplianceSection(pdfDoc, dataForPDF);
  addSourceOfFundsSection(pdfDoc, dataForPDF);
  
  return pdfDoc.save();
};

// 4. ADD VALIDATION THAT NAMES ARE PRESERVED

const validateNamePreservation = (report: PDFBytes): ValidationResult => {
  const text = extractTextFromPDF(report);
  
  // Names should appear at least twice (header + attestation)
  const nameOccurrences = (text.match(new RegExp(this.customerName, 'g')) || []).length;
  
  if (nameOccurrences < 1) {
    return {
      isValid: false,
      reason: 'Customer name not found in CDD report. ' +
              'Report is incomplete and not AUSTRAC compliant.',
      severity: 'CRITICAL'
    };
  }
  
  return { isValid: true };
};
```

---

### 3. PDF TEMPLATE ENGINE NOT RENDERING DATA / PLACEHOLDER VARIABLES PERSISTING

**Problem Statement**:
Template variables remain as literal strings in final PDFs:
- `[transactionsTable]` → Not populated with actual transaction rows
- `[statementPeriod]` → Remains literal string instead of "01/07/2020 to 31/12/2020"
- `[trusteeName]` → Empty placeholder instead of actual trustee name
- `[businessName]` → Literal placeholder in business registration section

This indicates the pdf-lib template engine is not receiving populated data structures.

**Root Cause**:
1. Data extraction layer may be returning undefined/null for these fields
2. Template bindings in pdf-lib are not correctly mapped
3. No validation that data is populated before PDF generation

**Files to Modify**:
- `src/services/pdf/templateEngine.ts`
- `src/services/pdf/sectionRenderers.ts`
- `src/services/dataExtraction/fieldMappings.ts`

**Implementation Requirements**:

```typescript
// 1. ADD FIELD MAPPING VALIDATION

const validateFieldMapping = (extractedData: CustomerData): ValidationResult => {
  const requiredFields = [
    'customerName',
    'dateOfBirth',
    'licenseNumber',
    'address',
    'businessName',
    'abnNumber',
    'transactionHistory'
  ];
  
  const missingFields = requiredFields.filter(field => {
    const value = extractedData[field];
    return !value || value === '' || value.includes('[') || value.includes(']');
  });
  
  if (missingFields.length > 0) {
    throw new TemplateValidationError(
      `Cannot render CDD report. Missing required fields: ${missingFields.join(', ')}. ` +
      `These fields must be populated by OCR extraction.`
    );
  }
  
  return { isValid: true };
};

// 2. FIX TRANSACTION TABLE RENDERING

const renderTransactionsTable = (
  transactions: Transaction[],
  pdfDoc: PDFDocument
): void => {
  if (!transactions || transactions.length === 0) {
    console.warn('[PDF-RENDER] No transactions provided. Rendering empty table.');
    transactions = [];
  }
  
  const table = pdfDoc.table({
    rows: [
      ['Date', 'Description', 'Amount', 'Balance'], // Header
      ...transactions.map(tx => [
        tx.date,
        tx.description,
        tx.amount,
        tx.balance
      ])
    ]
  });
  
  // Validate table was rendered
  if (!table || table.rows.length === 0) {
    throw new PDFRenderError(
      'Transaction table failed to render. Ensure transaction data is populated.'
    );
  }
};

// 3. IMPLEMENT PRE-RENDER DATA VALIDATION

const validateDataBeforePDFGeneration = (data: CustomerData): void => {
  const validationRules = {
    transactionHistory: {
      type: 'array',
      minLength: 1,
      errorMsg: 'At least one transaction required for Source of Funds section'
    },
    statementPeriod: {
      type: 'string',
      pattern: /^\d{1,2}\/\d{1,2}\/\d{4}\s+to\s+\d{1,2}\/\d{1,2}\/\d{4}$/,
      errorMsg: 'Statement period must be in format "DD/MM/YYYY to DD/MM/YYYY"'
    },
    customerName: {
      type: 'string',
      minLength: 2,
      errorMsg: 'Customer name must be at least 2 characters'
    },
    abnNumber: {
      type: 'string',
      pattern: /^\d{2}\s\d{3}\s\d{3}\s\d{3}$/,
      errorMsg: 'ABN must be in format "XX XXX XXX XXX"'
    }
  };
  
  for (const [field, rule] of Object.entries(validationRules)) {
    const value = data[field];
    
    if (rule.type === 'array' && (!Array.isArray(value) || value.length < rule.minLength)) {
      throw new DataValidationError(rule.errorMsg);
    }
    
    if (rule.type === 'string' && (!value || value.includes('['))) {
      throw new DataValidationError(`Field '${field}' not populated: ${rule.errorMsg}`);
    }
    
    if (rule.pattern && !rule.pattern.test(value)) {
      throw new DataValidationError(`Field '${field}' format invalid: ${rule.errorMsg}`);
    }
  }
};

// 4. ADD POST-RENDER VALIDATION

const validatePDFOutput = (pdfBytes: Buffer): ValidationResult => {
  const text = pdfBytes.toString('utf-8', 0, 5000); // Check first 5KB
  
  const placeholders = text.match(/\[[a-zA-Z]+\]/g) || [];
  
  if (placeholders.length > 0) {
    return {
      isValid: false,
      reason: `PDF contains unrendered template variables: ${placeholders.join(', ')}. ` +
              `Ensure all data fields are populated before PDF generation.`,
      severity: 'CRITICAL'
    };
  }
  
  return { isValid: true };
};
```

---

### 4. MISSING IDENTITY DOCUMENT PHOTO RENDERING

**Problem Statement**:
Identity document photos are missing or not rendering in PDF attachments. The "Proof of Identity" and "Proof of Address" sections show empty attachment containers with no visible images. This breaks the visual verification chain and enables fraud.

**Root Cause**:
1. Photo embedding in pdf-lib may be failing silently
2. Image encoding from OCR buffer to PDF may be corrupted
3. No fallback when photo processing fails

**Files to Modify**:
- `src/services/pdf/attachmentRenderer.ts`
- `src/services/imageProcessing/photoEmbedder.ts`

**Implementation Requirements**:

```typescript
// 1. ADD PHOTO EMBEDDING WITH ERROR HANDLING

const embedPhotoInPDF = async (
  pdfDoc: PDFDocument,
  photoBuffer: Buffer,
  metadata: PhotoMetadata
): Promise<void> => {
  try {
    // Validate photo buffer
    if (!photoBuffer || photoBuffer.length === 0) {
      throw new PhotoEmbeddingError('Photo buffer is empty or null');
    }
    
    // Detect image format
    const imageFormat = detectImageFormat(photoBuffer);
    if (!['jpeg', 'png', 'pdf'].includes(imageFormat)) {
      throw new PhotoEmbeddingError(
        `Unsupported image format: ${imageFormat}. ` +
        `Only JPEG, PNG, and PDF are supported.`
      );
    }
    
    // Embed in PDF
    let embeddedImage;
    if (imageFormat === 'jpeg') {
      embeddedImage = await pdfDoc.embedJpg(photoBuffer);
    } else if (imageFormat === 'png') {
      embeddedImage = await pdfDoc.embedPng(photoBuffer);
    }
    
    // Draw image with dimensions
    const imageWidth = 150;
    const imageHeight = (embeddedImage.height / embeddedImage.width) * imageWidth;
    
    pdfDoc.drawImage(embeddedImage, {
      x: 50,
      y: pdfDoc.getPage(0).getHeight() - imageHeight - 50,
      width: imageWidth,
      height: imageHeight
    });
    
    // Validate embedding succeeded
    if (!embeddedImage) {
      throw new PhotoEmbeddingError('Image embedding returned null');
    }
    
  } catch (error) {
    console.error(`[PHOTO-EMBED] Failed to embed photo:`, error.message);
    
    // Add error indicator in PDF
    addPhotoErrorPlaceholder(pdfDoc, metadata.documentType);
    
    throw new PhotoEmbeddingError(
      `Failed to embed ${metadata.documentType} photo: ${error.message}`
    );
  }
};

// 2. ADD PHOTO QUALITY VALIDATION

const validatePhotoQuality = (photoBuffer: Buffer): PhotoQualityResult => {
  const image = cv.imdecode(cv.matFromArray(1, photoBuffer.length, cv.CV_8U, Array.from(photoBuffer)));
  
  // Check dimensions
  const minWidth = 400, minHeight = 300;
  if (image.cols < minWidth || image.rows < minHeight) {
    return {
      isValid: false,
      reason: `Photo too small (${image.cols}x${image.rows}). Minimum: ${minWidth}x${minHeight}`,
      severity: 'HIGH'
    };
  }
  
  // Check for minimum contrast (not washed out)
  const gray = cv.cvtColor(image, cv.COLOR_RGB2GRAY);
  const stdDev = new cv.Scalar();
  const mean = new cv.Scalar();
  cv.meanStdDev(gray, mean, stdDev);
  
  if (stdDev.val[0] < 20) {
    return {
      isValid: false,
      reason: 'Photo lacks contrast. May be washed out or overexposed.',
      severity: 'HIGH'
    };
  }
  
  return { isValid: true };
};

// 3. ADD ERROR INDICATOR IN PDF

const addPhotoErrorPlaceholder = (
  pdfDoc: PDFDocument,
  documentType: string
): void => {
  pdfDoc.drawText(
    `[${documentType} PHOTO UNAVAILABLE - MANUAL REVIEW REQUIRED]`,
    {
      x: 50,
      y: 700,
      color: rgb(1, 0, 0),
      fontSize: 10
    }
  );
};

// 4. ADD VALIDATION THAT PHOTOS ARE EMBEDDED

const validatePhotosInPDF = (pdfBytes: Buffer): ValidationResult => {
  const text = pdfBytes.toString('utf-8');
  
  // Check for error placeholders
  if (text.includes('PHOTO UNAVAILABLE')) {
    return {
      isValid: false,
      reason: 'One or more photos failed to embed. Report is incomplete.',
      severity: 'CRITICAL'
    };
  }
  
  // Note: Full binary validation of embedded images is complex;
  // this is a basic text-based check
  return { isValid: true };
};
```

---

### 5. INCONSISTENT DATA MASKING LOGIC

**Problem Statement**:
Account numbers show inconsistent masking patterns ("######467" vs. "XXXX1059" vs. "XXXX4855"), suggesting multiple masking implementations or missing validation. License numbers also show inconsistency ("6700XX" vs. "6700XK").

**Root Cause**:
1. Multiple masking functions with different patterns
2. No centralized masking configuration
3. Masking applied inconsistently across document types

**Files to Modify**:
- `src/utils/maskingUtils.ts`
- `src/services/verification/verificationMaskingService.ts`

**Implementation Requirements**:

```typescript
// 1. CENTRALIZED MASKING CONFIGURATION

export const MASKING_PATTERNS = {
  accountNumber: {
    pattern: 'XXXX{{last4}}',
    example: 'XXXX9714',
    minLength: 6
  },
  bsb: {
    pattern: '{{first2}}-{{last3}}',
    example: '066-164',
    noMask: true // BSB is not sensitive
  },
  licenseNumber: {
    pattern: '{{first4}}XX',
    example: '6700XX',
    minLength: 6
  },
  taxFileNumber: {
    pattern: '{{first3}} {{mid3}} {{last3}}',
    example: '123 456 789',
    minLength: 11
  },
  creditCardNumber: {
    pattern: 'XXXX-XXXX-XXXX-{{last4}}',
    example: 'XXXX-XXXX-XXXX-9999',
    minLength: 13
  }
} as const;

// 2. UNIFIED MASKING FUNCTION

const maskSensitiveField = (
  value: string,
  fieldType: keyof typeof MASKING_PATTERNS,
  shouldMask: boolean = true
): string => {
  if (!shouldMask) return value;
  
  const config = MASKING_PATTERNS[fieldType];
  
  if (!config) {
    throw new MaskingError(`Unknown field type for masking: ${fieldType}`);
  }
  
  if (config.noMask) {
    return value; // Don't mask this field
  }
  
  // Validate minimum length
  if (value.length < config.minLength) {
    throw new MaskingError(
      `Value too short for ${fieldType}: ${value.length} < ${config.minLength}`
    );
  }
  
  // Apply masking pattern
  const last4 = value.slice(-4);
  const first2 = value.slice(0, 2);
  const first3 = value.slice(0, 3);
  const first4 = value.slice(0, 4);
  const mid3 = value.slice(3, 6);
  const last3 = value.slice(-3);
  
  let masked = config.pattern
    .replace('{{last4}}', last4)
    .replace('{{first2}}', first2)
    .replace('{{first3}}', first3)
    .replace('{{first4}}', first4)
    .replace('{{mid3}}', mid3)
    .replace('{{last3}}', last3);
  
  return masked;
};

// 3. VALIDATE MASKING CONSISTENCY

const validateMaskingConsistency = (data: CustomerData): ValidationResult => {
  // Ensure same field is masked consistently
  if (data.accountNumber1 && data.accountNumber2) {
    const masked1 = data.accountNumberMasked1;
    const masked2 = data.accountNumberMasked2;
    
    // Both should follow same pattern
    if (!masked1.match(/^XXXX\d{4}$/) || !masked2.match(/^XXXX\d{4}$/)) {
      return {
        isValid: false,
        reason: 'Account masking patterns are inconsistent',
        severity: 'HIGH'
      };
    }
  }
  
  return { isValid: true };
};
```

---

### 6. DATE FORMAT ERRORS & IMPOSSIBLE VALUES

**Problem Statement**:
Multiple impossible dates appearing in OCR output:
- "Period bom 01/07/2820 lo 21/12/2020" (year 2820, typos "bom" instead of "from")
- "07/00/2020" (month 00 is invalid)
- "25:07/2980" (hour 25 is impossible)

**Root Cause**:
1. OCR is misreading date fields entirely
2. No date validation after extraction
3. No correction of common OCR errors

**Files to Modify**:
- `src/services/dataExtraction/dateExtractor.ts`
- `src/utils/dateValidation.ts`

**Implementation Requirements**:

```typescript
// 1. COMPREHENSIVE DATE VALIDATION

const validateAndCorrectDate = (dateString: string): Date => {
  // Remove common OCR errors
  let cleaned = dateString
    .replace(/\bbom\b/gi, 'from') // "bom" → "from"
    .replace(/\blo\b/gi, 'to')     // "lo" → "to"
    .replace(/O/gi, '0')            // Letter O → zero
    .replace(/l/gi, '1')            // Letter l → one
    .trim();
  
  // Try multiple date formats
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY
    /(\d{1,2})-(\d{1,2})-(\d{4})/,    // DD-MM-YYYY
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,  // YYYY/MM/DD
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/   // Month DD, YYYY
  ];
  
  for (const format of formats) {
    const match = cleaned.match(format);
    if (!match) continue;
    
    let day, month, year;
    
    if (format === formats[0]) {
      [, day, month, year] = match;
    } else if (format === formats[2]) {
      [, year, month, day] = match;
    } else if (format === formats[3]) {
      const monthName = match[1];
      month = parseMonthName(monthName);
      day = match[2];
      year = match[3];
    }
    
    // Validate ranges
    day = parseInt(day, 10);
    month = parseInt(month, 10);
    year = parseInt(year, 10);
    
    if (day < 1 || day > 31) continue;
    if (month < 1 || month > 12) continue;
    if (year < 1900 || year > new Date().getFullYear() + 1) continue;
    
    // Validate day for month
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year % 4 === 0) daysInMonth[1] = 29; // Leap year
    
    if (day > daysInMonth[month - 1]) continue;
    
    return new Date(year, month - 1, day);
  }
  
  throw new DateValidationError(
    `Cannot parse date: "${dateString}". No valid date format found.`
  );
};

// 2. VALIDATE DATE RANGES IN CONTEXT

const validateStatementPeriod = (
  startDate: Date,
  endDate: Date
): ValidationResult => {
  // End date must be after start date
  if (endDate <= startDate) {
    return {
      isValid: false,
      reason: `End date (${endDate.toISOString()}) must be after start date (${startDate.toISOString()})`,
      severity: 'HIGH'
    };
  }
  
  // Statement period should not exceed 2 years
  const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 730) {
    return {
      isValid: false,
      reason: `Statement period too long (${daysDiff} days). Maximum allowed: 730 days`,
      severity: 'MEDIUM'
    };
  }
  
  // Statement should not be too recent (typically issued with slight delay)
  const today = new Date();
  if (endDate > today) {
    return {
      isValid: false,
      reason: `Statement end date (${endDate.toISOString()}) is in the future`,
      severity: 'CRITICAL'
    };
  }
  
  return { isValid: true };
};
```

---

## PHASE 12 TESTING REQUIREMENTS

### Unit Tests to Add

```typescript
// tests/ocr/characterEncoding.test.ts
describe('Character Encoding Validation', () => {
  it('should reject text with Greek characters', () => {
    const text = 'Αρθρο Τι CHAOS';
    expect(() => validateCharacterEncoding(text)).toThrow(OCRValidationError);
  });
  
  it('should accept valid Australian document text', () => {
    const text = 'AUSTRAC Customer Information Sheet';
    expect(validateCharacterEncoding(text)).toBe(text);
  });
  
  it('should flag mixed character sets', () => {
    const text = 'Amount: $1,000 Сумма: Йога';
    expect(() => validateCharacterEncoding(text)).toThrow();
  });
});

// tests/pdf/templateRendering.test.ts
describe('PDF Template Rendering', () => {
  it('should fail if transaction table is empty', async () => {
    const data = { transactionHistory: null };
    expect(() => validateDataBeforePDFGeneration(data)).toThrow();
  });
  
  it('should populate all template variables', async () => {
    const data = {
      customerName: 'John Doe',
      transactionHistory: [{ date: '01/01/2020', amount: 100 }],
      statementPeriod: '01/01/2020 to 31/01/2020'
    };
    const pdf = await generateCDDReportPDF(data);
    const validation = validatePDFOutput(pdf);
    expect(validation.isValid).toBe(true);
  });
});

// tests/pii/namePreservation.test.ts
describe('Name Preservation in CDD Reports', () => {
  it('should preserve customer name in final report', async () => {
    const data = {
      customerName: 'Antony John Baron',
      // ... other fields
    };
    const pdf = await generateCDDReportPDF(data);
    const validation = validateNamePreservation(pdf);
    expect(validation.isValid).toBe(true);
  });
  
  it('should NOT preserve names in external transmission', async () => {
    const data = { customerName: 'John Doe', // ... };
    const pdf = await generateCDDReportPDF(data, { environment: 'external_transmission' });
    // Names should be masked
    expect(pdf).not.toContain('John Doe');
  });
});

// tests/photo/embedding.test.ts
describe('Photo Embedding in PDFs', () => {
  it('should embed valid photos in PDF', async () => {
    const photoBuffer = fs.readFileSync('test-license.jpg');
    const pdfDoc = await PDFDocument.create();
    await embedPhotoInPDF(pdfDoc, photoBuffer, { documentType: 'License' });
    
    // Verify embedding
    const validation = validatePhotosInPDF(pdfDoc);
    expect(validation.isValid).toBe(true);
  });
  
  it('should handle missing photos gracefully', async () => {
    const pdfDoc = await PDFDocument.create();
    expect(() => embedPhotoInPDF(pdfDoc, Buffer.alloc(0), { documentType: 'License' }))
      .toThrow(PhotoEmbeddingError);
  });
});
```

---

## DEPLOYMENT CHECKLIST FOR PHASE 12

- [ ] OCR preprocessing aggressiveness reduced; test with original vs. preprocessed images
- [ ] Character encoding validation implemented and tested
- [ ] Confidence threshold validation in place (85% minimum)
- [ ] Image quality gates preventing low-resolution/blurry document processing
- [ ] PII masking layer relocated to output serialization
- [ ] Name preservation validated in all CDD reports
- [ ] PDF template variables all rendering correctly
- [ ] Photo embedding with error handling
- [ ] Photo quality validation before embedding
- [ ] Masking patterns centralized and consistent
- [ ] Date parsing and validation comprehensive
- [ ] All unit tests passing with >95% code coverage
- [ ] E2E tests with sample Australian documents (license, utility bills, ABN)
- [ ] Manual QA review of 10+ sample CDD reports for completeness
- [ ] Security audit of PII masking implementation
- [ ] Performance testing (target <25s p50, <45s p95)
- [ ] Staging deployment with full monitoring
- [ ] Production deployment with automated rollback

---

## SUCCESS METRICS

| Metric | Current | Phase 12 Target | Validation |
|--------|---------|-----------------|-----------|
| OCR Accuracy | 70-75% | 93-97% | Sample document accuracy rate |
| Zero Character Corruption | 0% | 100% | Regex check for non-ASCII |
| Template Variable Coverage | 40% | 100% | All `[variable]` patterns tested |
| Photo Embedding Success | ~30% | 98% | Visual verification in 50+ PDFs |
| Name Preservation in Reports | 0% | 100% | Customer name present in all CDD outputs |
| Confidence Score Adoption | N/A | 100% | All OCR results tagged with confidence |
| Masking Consistency | 60% | 100% | Same field always masked identically |
| Code Coverage | Unknown | >95% | Jest coverage report |

---

## PRIORITY EXECUTION ORDER

**Week 1 (Days 1-3)**: Character encoding fix + OCR preprocessing reduction  
**Week 1 (Days 4-5)**: PII masking relocation + name preservation  
**Week 2 (Days 1-2)**: PDF template rendering fixes  
**Week 2 (Days 3-4)**: Photo embedding + quality validation  
**Week 2 (Days 5)**: Masking consistency + date validation  
**Week 3**: Comprehensive testing + QA  
**Week 4**: Staging + production deployment  

---

## NOTES FOR CODE ASSISTANT

- Priority #1: Fix OCR character corruption (affects all reports)
- Priority #2: Relocate PII masking (regulatory compliance requirement)
- Priority #3: Template variable rendering (incomplete reports violate AUSTRAC)
- Do NOT introduce new features during Phase 12; focus entirely on bug fixes and hardening
- Ensure all error messages include actionable remediation steps
- Maintain backward compatibility with existing verification workflows
- Add comprehensive logging for debugging and audit trails
