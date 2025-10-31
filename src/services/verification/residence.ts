/**
 * Residence Verification Service
 * Point 2 of KYC: Address verification with fuzzy matching
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import pool from '../../config/database';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ResidenceExtractionResult {
  extracted_address: string;
  extracted_postcode: string;
  issuer: string;
  document_date: Date;
  document_type: string;
  ocr_confidence: number;
}

export interface ResidenceVerificationResult {
  residence_verified: boolean;
  address_match: boolean;
  fuzzy_match_score: number;
  document_fresh: boolean;
  document_age_days: number;
  verification_status: 'approved' | 'manual_review' | 'rejected';
  reason?: string;
}

/**
 * Extract residence data from proof document
 */
async function extractResidenceData(
  filePathOrBuffer: string | Buffer,
  mimeType?: string
): Promise<ResidenceExtractionResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Handle both file path and buffer
  let base64Data: string;
  let actualMimeType: string;

  if (Buffer.isBuffer(filePathOrBuffer)) {
    base64Data = filePathOrBuffer.toString('base64');
    actualMimeType = mimeType || 'application/pdf';
  } else {
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(filePathOrBuffer);
    base64Data = fileBuffer.toString('base64');
    actualMimeType = mimeType || getMimeType(filePathOrBuffer);
  }

  const prompt = `
Analyze this Australian residence proof document.

EXTRACT THE FOLLOWING INFORMATION:
1. Complete residential address (street address, suburb, state, postcode)
2. Postcode (4 digits)
3. Issuer/company name (utility company, government agency, bank)
4. Document date (issue date or statement period end date)
5. Document type (utility_bill / government_letter / bank_statement / rental_agreement)

VALIDATION CHECKS:
1. Is address clearly visible and legible?
2. Is date clearly visible?
3. OCR confidence score (0-1)

CRITICAL INSTRUCTIONS:
- Extract EXACT address as shown on document
- Include unit/apartment number if present
- Do NOT abbreviate or normalize
- Return ONLY valid JSON, no markdown formatting

RESPONSE FORMAT (JSON only):
{
  "extracted_address": "string",
  "extracted_postcode": "string",
  "issuer": "string",
  "document_date": "YYYY-MM-DD",
  "document_type": "utility_bill|government_letter|bank_statement|rental_agreement",
  "ocr_confidence": 0.0-1.0
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

  // Validate OCR confidence
  if (data.ocr_confidence < 0.70) {
    throw new Error(`OCR confidence too low: ${(data.ocr_confidence * 100).toFixed(0)}%. Please upload clearer image.`);
  }

  return {
    extracted_address: data.extracted_address,
    extracted_postcode: data.extracted_postcode,
    issuer: data.issuer || 'Unknown',
    document_date: new Date(data.document_date),
    document_type: data.document_type,
    ocr_confidence: data.ocr_confidence,
  };
}

/**
 * Fuzzy match addresses (80%+ threshold)
 */
function fuzzyMatchAddress(
  extracted: string,
  expected: string
): {
  similarity_score: number;
  match_quality: 'exact' | 'good' | 'poor';
  passes: boolean;
} {
  // Normalize addresses (same logic as identity module)
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

  const norm1 = normalize(extracted);
  const norm2 = normalize(expected);

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  const similarity = maxLength === 0 ? 1 : 1 - (distance / maxLength);

  let match_quality: 'exact' | 'good' | 'poor';
  if (similarity >= 0.95) {
    match_quality = 'exact';
  } else if (similarity >= 0.80) {
    match_quality = 'good';
  } else {
    match_quality = 'poor';
  }

  return {
    similarity_score: similarity,
    match_quality,
    passes: similarity >= 0.80,
  };
}

/**
 * Check document freshness
 */
function checkDocumentFreshness(
  documentDate: Date,
  documentType: string
): {
  document_age_days: number;
  document_fresh: boolean;
  max_age_days: number;
} {
  const now = new Date();
  const ageMs = now.getTime() - documentDate.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  // Age thresholds by document type
  const maxAgeDays: { [key: string]: number } = {
    'utility_bill': 90,  // 3 months
    'bank_statement': 90,  // 3 months
    'government_letter': 365,  // 12 months
    'rental_agreement': 365,  // 12 months
  };

  const maxAge = maxAgeDays[documentType] || 90;
  const fresh = ageDays <= maxAge;

  return {
    document_age_days: ageDays,
    document_fresh: fresh,
    max_age_days: maxAge,
  };
}

/**
 * MAIN: Complete residence verification flow
 */
export async function verifyResidence(
  individualId: string,
  filePathOrBuffer: string | Buffer,
  mimeType?: string
): Promise<ResidenceVerificationResult> {
  try {
    // Get individual's registered address
    const individual = await pool.query(`
      SELECT residential_address, postcode
      FROM individuals
      WHERE id = $1
    `, [individualId]);

    if (individual.rows.length === 0) {
      throw new Error('Individual not found');
    }

    const expectedAddress = individual.rows[0].residential_address;

    // Step 1: Extract residence data
    console.log('Extracting residence data from document...');
    const extracted = await extractResidenceData(filePathOrBuffer, mimeType);

    // Step 2: Fuzzy match addresses
    console.log('Comparing addresses...');
    const addressMatch = fuzzyMatchAddress(extracted.extracted_address, expectedAddress);

    // Step 3: Check document freshness
    const freshnessCheck = checkDocumentFreshness(extracted.document_date, extracted.document_type);

    // Determine verification status
    let verification_status: 'approved' | 'manual_review' | 'rejected';
    let reason: string | undefined;

    if (!addressMatch.passes) {
      verification_status = 'manual_review';
      reason = `Address similarity too low: ${(addressMatch.similarity_score * 100).toFixed(1)}% (threshold: 80%). Extracted: "${extracted.extracted_address}", Expected: "${expectedAddress}"`;
      // Queue for manual review
      const { queueForReview } = await import('../manual-review');
      await queueForReview(individualId, reason, 'normal');
    } else if (!freshnessCheck.document_fresh) {
      verification_status = 'manual_review';
      reason = `Document too old: ${freshnessCheck.document_age_days} days (max: ${freshnessCheck.max_age_days} days for ${extracted.document_type})`;
      // Queue for manual review
      const { queueForReview } = await import('../manual-review');
      await queueForReview(individualId, reason, 'normal');
    } else {
      verification_status = 'approved';
    }

    // Store residence document
    const filePath = Buffer.isBuffer(filePathOrBuffer) ? 'memory-storage' : filePathOrBuffer;
    await pool.query(`
      INSERT INTO residence_documents (
        individual_id, document_type, issuer, document_date,
        file_path, extracted_address, extracted_postcode,
        ocr_confidence, address_match, fuzzy_match_score,
        document_age_days, document_fresh, verification_passed,
        uploaded_at, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
    `, [
      individualId, extracted.document_type, extracted.issuer, extracted.document_date,
      filePath, extracted.extracted_address, extracted.extracted_postcode,
      extracted.ocr_confidence, addressMatch.passes, addressMatch.similarity_score,
      freshnessCheck.document_age_days, freshnessCheck.document_fresh,
      verification_status === 'approved',
    ]);

    // Update individual record
    await pool.query(`
      UPDATE individuals
      SET residence_verified = $1
      WHERE id = $2
    `, [verification_status === 'approved', individualId]);

    // Log audit trail
    await pool.query(`
      INSERT INTO audit_logs (
        verification_id, document_id, event_type,
        decision_maker, decision_result, decision_reason,
        data_snapshot
      ) VALUES (NULL, NULL, 'approval', 'system', $1, $2, $3)
    `, [
      verification_status === 'approved' ? 'pass' : 'flagged',
      `Residence verification: ${verification_status}`,
      JSON.stringify({
        individual_id: individualId,
        address_match: addressMatch.passes,
        similarity: addressMatch.similarity_score,
        document_fresh: freshnessCheck.document_fresh,
      }),
    ]);

    return {
      residence_verified: verification_status === 'approved',
      address_match: addressMatch.passes,
      fuzzy_match_score: addressMatch.similarity_score,
      document_fresh: freshnessCheck.document_fresh,
      document_age_days: freshnessCheck.document_age_days,
      verification_status,
      reason,
    };
  } catch (error) {
    console.error('Residence verification failed:', error);
    throw error;
  }
}

// Reuse Levenshtein distance function
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

