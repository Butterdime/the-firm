/**
 * Identity Verification Service
 * Point 1 of KYC: Identity verification with ABR entity discovery
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import pool from '../../config/database';
import { searchByNameAndPostcode, ABREntity } from '../../lib/integrations/abr-search';
import { logAuditEvent } from '../../lib/audit-logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface IdentityExtractionResult {
  extracted_name: string;
  extracted_dob: Date;
  extracted_address: string;
  extracted_postcode: string;
  document_type: string;
  document_number: string;
  expiry_date: Date | null;
  ocr_confidence: number;
  document_valid: boolean;
  document_expired: boolean;
}

export interface IdentityVerificationResult {
  individual_id: string;
  identity_verified: boolean;
  name_match: boolean;
  dob_match: boolean;
  document_valid: boolean;
  entities_discovered: ABREntity[];
  verification_status: 'approved' | 'manual_review' | 'rejected';
  reason?: string;
}

/**
 * Extract identity data from ID document using Gemini Vision
 */
async function extractIdentityData(
  filePathOrBuffer: string | Buffer,
  mimeType?: string
): Promise<IdentityExtractionResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Handle both file path and buffer (for Vercel serverless)
  let base64Data: string;
  let actualMimeType: string;

  if (Buffer.isBuffer(filePathOrBuffer)) {
    base64Data = filePathOrBuffer.toString('base64');
    actualMimeType = mimeType || 'application/pdf';
  } else {
    // File path (local development)
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(filePathOrBuffer);
    base64Data = fileBuffer.toString('base64');
    actualMimeType = mimeType || getMimeType(filePathOrBuffer);
  }

  const prompt = `
Analyze this Australian identity document.

EXTRACT THE FOLLOWING INFORMATION:
1. Full name (exactly as shown on document)
2. Date of birth (format: DD/MM/YYYY or YYYY-MM-DD)
3. Residential address (complete street address)
4. Postcode (4 digits)
5. Document type (drivers_license / passport / birth_certificate / citizenship_certificate)
6. Document number
7. Expiry date (if applicable, format: DD/MM/YYYY or YYYY-MM-DD)

VALIDATION CHECKS:
1. Is document expired? (yes/no)
2. Is document legible and clear? (confidence score 0-1)
3. Any visible signs of tampering or alteration? (yes/no)

CRITICAL INSTRUCTIONS:
- Extract EXACT text as shown on document
- Do NOT normalize or correct spelling
- Do NOT abbreviate names
- If field is not visible or unclear, return null
- Return ONLY valid JSON, no markdown formatting

RESPONSE FORMAT (JSON only):
{
  "extracted_name": "string",
  "extracted_dob": "YYYY-MM-DD",
  "extracted_address": "string",
  "extracted_postcode": "string",
  "document_type": "drivers_license|passport|birth_certificate|citizenship_certificate",
  "document_number": "string",
  "expiry_date": "YYYY-MM-DD or null",
  "ocr_confidence": 0.0-1.0,
  "document_expired": true|false,
  "document_legible": true|false,
  "tampering_detected": true|false
}
`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType: actualMimeType,
      },
    },
  ]);

  const response = result.response.text();

  // Parse JSON response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini did not return valid JSON. Please try again with a clearer image.');
  }

  const data = JSON.parse(jsonMatch[0]);

  // Validate OCR confidence threshold
  if (data.ocr_confidence < 0.70) {
    throw new Error(`OCR confidence too low: ${(data.ocr_confidence * 100).toFixed(0)}%. Please upload clearer image.`);
  }

  // Check for tampering
  if (data.tampering_detected) {
    throw new Error('Document appears to be tampered or altered. Manual review required.');
  }

  return {
    extracted_name: data.extracted_name,
    extracted_dob: new Date(data.extracted_dob),
    extracted_address: data.extracted_address,
    extracted_postcode: data.extracted_postcode,
    document_type: data.document_type,
    document_number: data.document_number || '',
    expiry_date: data.expiry_date ? new Date(data.expiry_date) : null,
    ocr_confidence: data.ocr_confidence,
    document_valid: data.document_legible && !data.tampering_detected,
    document_expired: data.document_expired,
  };
}

/**
 * Validate extracted identity against customer-provided data
 */
function validateIdentity(
  extracted: IdentityExtractionResult,
  expected: {
    full_name: string;
    dob: Date;
    address: string;
    postcode: string;
  }
): {
  name_match: boolean;
  dob_match: boolean;
  address_match: boolean;
  all_match: boolean;
  mismatch_reasons: string[];
} {
  const reasons: string[] = [];

  // Exact name match (case-insensitive for flexibility)
  const name_match = extracted.extracted_name.toLowerCase().trim() ===
    expected.full_name.toLowerCase().trim();
  if (!name_match) {
    reasons.push(`Name mismatch: extracted="${extracted.extracted_name}", expected="${expected.full_name}"`);
  }

  // Exact DOB match
  const extractedDOB = extracted.extracted_dob.toISOString().split('T')[0];
  const expectedDOB = expected.dob instanceof Date
    ? expected.dob.toISOString().split('T')[0]
    : new Date(expected.dob).toISOString().split('T')[0];
  const dob_match = extractedDOB === expectedDOB;
  if (!dob_match) {
    reasons.push(`DOB mismatch: extracted="${extractedDOB}", expected="${expectedDOB}"`);
  }

  // Address fuzzy match (allow minor variations)
  const address_similarity = calculateAddressSimilarity(
    extracted.extracted_address,
    expected.address
  );
  const address_match = address_similarity >= 0.85;
  if (!address_match) {
    reasons.push(`Address mismatch (similarity: ${(address_similarity * 100).toFixed(1)}%, threshold: 85%)`);
  }

  return {
    name_match,
    dob_match,
    address_match,
    all_match: name_match && dob_match && address_match,
    mismatch_reasons: reasons,
  };
}

/**
 * Store discovered entities in database
 */
async function storeDiscoveredEntities(
  individualId: string,
  entities: ABREntity[],
  searchName: string,
  searchPostcode: string
): Promise<void> {
  for (const entity of entities) {
    // First, store in verifications table (existing business verification structure)
    const verificationResult = await pool.query(`
      INSERT INTO verifications (
        extracted_abn, extracted_acn, extracted_business_name,
        abr_abn, abr_acn, abr_business_name, abr_entity_status,
        verification_status, trilogy_check_passed, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'discovered', false, NOW())
      RETURNING id
    `, [
      entity.abn, entity.acn, entity.business_name,
      entity.abn, entity.acn, entity.business_name, entity.entity_status,
    ]);

    const verificationId = verificationResult.rows[0].id;

    // Then, link to individual
    await pool.query(`
      INSERT INTO individual_entity_links (
        individual_id, verification_id, is_primary_entity,
        entity_type, link_source, match_confidence,
        discovered_via_search, search_name, search_postcode, search_result_count
      ) VALUES ($1, $2, FALSE, 'discovered_abr', 'abr_search', 0.90, TRUE, $3, $4, $5)
    `, [individualId, verificationId, searchName, searchPostcode, entities.length]);
  }
}

/**
 * Calculate address similarity for fuzzy matching
 */
function calculateAddressSimilarity(address1: string, address2: string): number {
  // Normalize addresses
  const normalize = (addr: string) => {
    return addr
      .toUpperCase()
      .replace(/\bSTREET\b/g, 'ST')
      .replace(/\bROAD\b/g, 'RD')
      .replace(/\bAVENUE\b/g, 'AVE')
      .replace(/\bDRIVE\b/g, 'DR')
      .replace(/\bAPARTMENT\b/g, 'APT')
      .replace(/\bUNIT\b/g, 'U')
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const norm1 = normalize(address1);
  const norm2 = normalize(address2);

  // Levenshtein distance
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  const similarity = maxLength === 0 ? 1 : 1 - (distance / maxLength);

  return similarity;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * MAIN: Complete identity verification flow
 */
export async function verifyIdentity(
  filePathOrBuffer: string | Buffer,
  customerData: {
    full_name: string;
    dob: Date | string;
    address: string;
    postcode: string;
  },
  mimeType?: string
): Promise<IdentityVerificationResult> {
  try {
    // Step 1: Extract data from ID document
    console.log('Extracting identity data from document...');
    const extracted = await extractIdentityData(filePathOrBuffer, mimeType);

    // Normalize customer DOB
    const customerDOB = customerData.dob instanceof Date
      ? customerData.dob
      : new Date(customerData.dob);

    // Step 2: Validate against expected data
    console.log('Validating identity...');
    const validation = validateIdentity(extracted, {
      full_name: customerData.full_name,
      dob: customerDOB,
      address: customerData.address,
      postcode: customerData.postcode,
    });

    // Check if document is valid and not expired
    if (extracted.document_expired) {
      throw new Error('Document has expired. Please upload current ID.');
    }

    if (!extracted.document_valid) {
      throw new Error('Document appears invalid or illegible.');
    }

    // Check if identity matches
    if (!validation.all_match) {
      // Create individual record with failed status
      const individual = await pool.query(`
        INSERT INTO individuals (
          full_name, dob, residential_address, postcode,
          identity_verified, verification_status
        ) VALUES ($1, $2, $3, $4, FALSE, 'rejected')
        RETURNING id
      `, [customerData.full_name, customerDOB, customerData.address, customerData.postcode]);

      return {
        individual_id: individual.rows[0].id,
        identity_verified: false,
        name_match: validation.name_match,
        dob_match: validation.dob_match,
        document_valid: extracted.document_valid,
        entities_discovered: [],
        verification_status: 'rejected',
        reason: `Identity validation failed: ${validation.mismatch_reasons.join(', ')}`,
      };
    }

    // Step 3: Create individual record (verified)
    console.log('Creating individual record...');
    const individual = await pool.query(`
      INSERT INTO individuals (
        full_name, dob, residential_address, postcode,
        identity_verified, verification_status
      ) VALUES ($1, $2, $3, $4, TRUE, 'pending')
      RETURNING id
    `, [extracted.extracted_name, extracted.extracted_dob, extracted.extracted_address, extracted.extracted_postcode]);

    const individualId = individual.rows[0].id;

    // Step 4: Store identity document
    const filePath = Buffer.isBuffer(filePathOrBuffer) ? 'memory-storage' : filePathOrBuffer;
    await pool.query(`
      INSERT INTO identity_documents (
        individual_id, document_type, document_number,
        expiry_date, file_path, extracted_name, extracted_dob,
        extracted_address, extracted_postcode, ocr_confidence,
        name_match, dob_match, document_valid, document_expired,
        verification_passed, uploaded_at, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE, NOW(), NOW())
    `, [
      individualId, extracted.document_type, extracted.document_number,
      extracted.expiry_date, filePath, extracted.extracted_name, extracted.extracted_dob,
      extracted.extracted_address, extracted.extracted_postcode, extracted.ocr_confidence,
      validation.name_match, validation.dob_match, extracted.document_valid, extracted.document_expired,
    ]);

    // Step 5: Search ABR for entities
    console.log('Searching ABR for business entities...');
    const entities = await searchByNameAndPostcode(
      extracted.extracted_name,
      extracted.extracted_postcode
    );

    console.log(`Found ${entities.length} business entities`);

    // Step 6: Store discovered entities (if any)
    if (entities.length > 0) {
      await storeDiscoveredEntities(
        individualId,
        entities,
        extracted.extracted_name,
        extracted.extracted_postcode
      );
    }

    // Step 7: Log audit trail (using existing audit logger format)
    // Note: For KYC, we'll extend audit logs to support individual_id as resource
    await pool.query(`
      INSERT INTO audit_logs (
        verification_id, document_id, event_type,
        decision_maker, decision_result, decision_reason,
        data_snapshot
      ) VALUES ($1, NULL, 'approval', 'system', 'pass', $2, $3)
    `, [
      null, // verification_id not applicable for KYC identity verification
      `Identity verified. ${entities.length} business entities discovered.`,
      JSON.stringify({ 
        individual_id: individualId,
        name: extracted.extracted_name, 
        entities_found: entities.length 
      }),
    ]);

    return {
      individual_id: individualId,
      identity_verified: true,
      name_match: true,
      dob_match: true,
      document_valid: true,
      entities_discovered: entities,
      verification_status: 'approved',
    };
  } catch (error) {
    console.error('Identity verification failed:', error);
    throw error;
  }
}

function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  const mimeTypes: { [key: string]: string } = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

