/**
 * Bank Verification Service
 * Point 3 of KYC: Multi-document bank account verification with visual authentication
 * 100-point confidence scoring system
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import pool from '../../config/database';
import { analyzeVisualAuth, VisualAuthResult } from '../../lib/visual-auth';
import { lookupPayID, PayIDLookupResult } from '../../lib/integrations/monoova';
import { queryABR } from '../../lib/abr-verification';
import { verifyTrilogy } from '../../lib/trilogy-verification';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface BankDocumentExtraction {
  account_holder_name: string;
  bsb: string;
  account_number: string;
  bank_name: string;
  ocr_confidence: number;
}

export interface BankVerificationResult {
  bank_verification_id: string;
  verification_status: 'approved' | 'manual_review' | 'rejected';
  overall_confidence_score: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  matched_entity_abn: string | null;
  entity_match_confidence: number | null;
  reason?: string;
}

/**
 * Extract bank account data from document
 */
async function extractBankData(
  filePathOrBuffer: string | Buffer,
  mimeType?: string
): Promise<BankDocumentExtraction> {
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
Analyze this Australian bank document.

EXTRACT THE FOLLOWING INFORMATION:
1. Account holder name (exactly as shown)
2. BSB (6 digits)
3. Account number (up to 20 digits)
4. Bank name (Commonwealth Bank, Westpac, ANZ, NAB, etc.)
5. OCR confidence (0-1)

CRITICAL INSTRUCTIONS:
- Extract EXACT text as shown
- Do NOT normalize or correct
- Return ONLY valid JSON, no markdown formatting

RESPONSE FORMAT (JSON only):
{
  "account_holder_name": "string",
  "bsb": "123456",
  "account_number": "12345678",
  "bank_name": "string",
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
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract bank data from document');
  }

  const data = JSON.parse(jsonMatch[0]);

  if (data.ocr_confidence < 0.70) {
    throw new Error(`OCR confidence too low: ${(data.ocr_confidence * 100).toFixed(0)}%`);
  }

  return {
    account_holder_name: data.account_holder_name || '',
    bsb: data.bsb ? data.bsb.replace(/\D/g, '').substring(0, 6) : '',
    account_number: data.account_number ? data.account_number.replace(/\D/g, '') : '',
    bank_name: data.bank_name || '',
    ocr_confidence: data.ocr_confidence,
  };
}

/**
 * Calculate 100-point confidence score
 */
function calculateConfidenceScore(
  documents: Array<BankDocumentExtraction & { visual_auth: VisualAuthResult }>,
  payidResult?: PayIDLookupResult
): {
  name_consistency_score: number;  // 0-40
  bsb_account_consistency_score: number;  // 0-30
  visual_auth_score: number;  // 0-15
  npp_score: number;  // 0-10
  document_quality_score: number;  // 0-5
  overall_score: number;  // 0-100
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
} {
  // Name consistency (0-40 points)
  const names = documents.map(d => d.account_holder_name.toLowerCase().trim()).filter(Boolean);
  const uniqueNames = new Set(names);
  const nameConsistency = names.length > 0
    ? (names.length - uniqueNames.size + 1) / names.length
    : 0;
  const name_consistency_score = Math.round(nameConsistency * 40);

  // BSB/Account consistency (0-30 points)
  const bsbs = documents.map(d => d.bsb).filter(Boolean);
  const accounts = documents.map(d => d.account_number).filter(Boolean);
  const bsbConsistent = bsbs.length > 0 && new Set(bsbs).size === 1;
  const accountConsistent = accounts.length > 0 && new Set(accounts).size === 1;
  const bsb_account_consistency_score = bsbConsistent && accountConsistent ? 30 : 
                                        (bsbConsistent || accountConsistent ? 15 : 0);

  // Visual auth score (0-15) - average across all documents
  const avgVisualAuth = documents.length > 0
    ? documents.reduce((sum, d) => sum + d.visual_auth.visual_auth_total, 0) / documents.length
    : 0;
  const visual_auth_score = Math.round(avgVisualAuth);

  // NPP PayID score (0-10)
  const npp_score = payidResult?.success && payidResult.account_name ? 10 : 0;

  // Document quality score (0-5) - based on OCR confidence
  const avgOCRConfidence = documents.length > 0
    ? documents.reduce((sum, d) => sum + d.ocr_confidence, 0) / documents.length
    : 0;
  const document_quality_score = Math.round(avgOCRConfidence * 5);

  // Overall score
  const overall_score = name_consistency_score +
    bsb_account_consistency_score +
    visual_auth_score +
    npp_score +
    document_quality_score;

  // Confidence level
  let confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  if (overall_score >= 80) {
    confidence_level = 'HIGH';
  } else if (overall_score >= 60) {
    confidence_level = 'MEDIUM';
  } else {
    confidence_level = 'LOW';
  }

  return {
    name_consistency_score,
    bsb_account_consistency_score,
    visual_auth_score,
    npp_score,
    document_quality_score,
    overall_score,
    confidence_level,
  };
}

/**
 * Match account holder name to discovered entities
 */
async function matchEntityToABR(
  accountHolderName: string,
  individualId: string
): Promise<{
  matched_entity_abn: string | null;
  entity_match_confidence: number;
  entity_match_method: 'exact' | 'fuzzy' | 'manual' | null; // Must match database CHECK constraint
}> {
  // Get discovered entities for this individual
  const links = await pool.query(`
    SELECT v.id, v.extracted_business_name, v.abr_business_name
    FROM individual_entity_links iel
    JOIN verifications v ON v.id = iel.verification_id
    WHERE iel.individual_id = $1
      AND v.verification_status = 'discovered'
  `, [individualId]);

  if (links.rows.length === 0) {
    return {
      matched_entity_abn: null,
      entity_match_confidence: 0,
      entity_match_method: null, // NULL for database constraint (allows 'exact', 'fuzzy', 'manual', or NULL)
    };
  }

  // Fuzzy match account holder name to entity names
  const normalizedAccountName = accountHolderName.toLowerCase().trim();
  let bestMatch = null;
  let bestConfidence = 0;

  for (const link of links.rows) {
    const entityName = (link.extracted_business_name || link.abr_business_name || '').toLowerCase();
    const similarity = calculateNameSimilarity(normalizedAccountName, entityName);
    
    if (similarity > bestConfidence && similarity >= 0.85) {
      bestConfidence = similarity;
      bestMatch = link;
    }
  }

  if (bestMatch && bestConfidence >= 0.85) {
    // Get ABN for matched entity
    const verification = await pool.query(`
      SELECT abr_abn FROM verifications WHERE id = $1
    `, [bestMatch.id]);

    return {
      matched_entity_abn: verification.rows[0]?.abr_abn || null,
      entity_match_confidence: bestConfidence,
      entity_match_method: 'fuzzy',
    };
  }

  return {
    matched_entity_abn: null,
    entity_match_confidence: 0,
    entity_match_method: null, // NULL for database constraint (allows 'exact', 'fuzzy', 'manual', or NULL)
  };
}

function calculateNameSimilarity(name1: string, name2: string): number {
  // Simple similarity check - could be improved
  if (name1 === name2) return 1.0;
  if (name1.includes(name2) || name2.includes(name1)) return 0.9;
  
  // Levenshtein distance
  const maxLen = Math.max(name1.length, name2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(name1, name2);
  return 1 - (distance / maxLen);
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
 * MAIN: Complete bank verification flow
 */
export async function verifyBankAccount(
  individualId: string,
  documentBuffers: Array<{ buffer: Buffer; mimetype: string; originalname: string }>,
  payid?: { value: string; type: 'email' | 'phone' | 'abn' }
): Promise<BankVerificationResult> {
  try {
    // Validate individual exists
    const individual = await pool.query(`
      SELECT id FROM individuals WHERE id = $1
    `, [individualId]);

    if (individual.rows.length === 0) {
      throw new Error('Individual not found');
    }

    if (documentBuffers.length === 0) {
      throw new Error('At least one bank document is required');
    }

    if (documentBuffers.length > 5) {
      throw new Error('Maximum 5 bank documents allowed');
    }

    // Step 1: Extract data from all documents
    console.log(`Processing ${documentBuffers.length} bank documents...`);
    const documentData: Array<BankDocumentExtraction & { visual_auth: VisualAuthResult; document_id: string }> = [];

    for (const doc of documentBuffers) {
      const extracted = await extractBankData(doc.buffer, doc.mimetype);
      const visualAuth = await analyzeVisualAuth(doc.buffer, doc.mimetype);

      // Store document
      const docResult = await pool.query(`
        INSERT INTO bank_verification_documents (
          individual_id, document_type, file_path, file_size, mime_type,
          extracted_account_holder, extracted_bsb, extracted_account_number,
          extracted_bank_name, ocr_confidence,
          bank_logo_detected, logo_confidence, logo_points,
          font_matched, font_confidence, font_points,
          watermark_detected, watermark_confidence, watermark_points,
          visual_auth_total,
          uploaded_at, processed_at
        ) VALUES ($1, 'bank_statement', 'memory-storage', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
        RETURNING id
      `, [
        individualId,
        doc.buffer.length,
        doc.mimetype,
        extracted.account_holder_name,
        extracted.bsb,
        extracted.account_number,
        extracted.bank_name,
        extracted.ocr_confidence,
        visualAuth.bank_logo_detected,
        visualAuth.logo_confidence,
        visualAuth.logo_points,
        visualAuth.font_matched,
        visualAuth.font_confidence,
        visualAuth.font_points,
        visualAuth.watermark_detected,
        visualAuth.watermark_confidence,
        visualAuth.watermark_points,
        visualAuth.visual_auth_total,
      ]);

      documentData.push({
        ...extracted,
        visual_auth: visualAuth,
        document_id: docResult.rows[0].id,
      });
    }

    // Step 2: Optional NPP PayID lookup
    let payidResult: PayIDLookupResult | undefined;
    if (payid) {
      console.log('Looking up PayID...');
      payidResult = await lookupPayID(payid.value, payid.type, individualId);
    }

    // Step 3: Calculate confidence score
    const score = calculateConfidenceScore(documentData, payidResult);

    // Step 4: Determine primary account details (most common values)
    const accountHolderName = documentData[0].account_holder_name;
    const bsb = documentData.find(d => d.bsb)?.bsb || '';
    const accountNumber = documentData.find(d => d.account_number)?.account_number || '';
    const bankName = documentData[0].bank_name;

    // Step 5: Match entity to ABR
    const entityMatch = await matchEntityToABR(accountHolderName, individualId);

    // Step 6: Determine verification status
    let verification_status: 'approved' | 'manual_review' | 'rejected';
    let reason: string | undefined;

    if (score.overall_score >= 80) {
      verification_status = 'approved';
    } else if (score.overall_score >= 60) {
      verification_status = 'manual_review';
      reason = `Confidence score ${score.overall_score} requires manual review`;
      // Queue for manual review
      const { queueForReview } = await import('../manual-review');
      await queueForReview(individualId, reason, 'normal', score.overall_score);
    } else {
      verification_status = 'rejected';
      reason = `Confidence score ${score.overall_score} below minimum threshold (60)`;
    }

    // Step 7: Store bank verification result
    const verificationResult = await pool.query(`
      INSERT INTO bank_verifications (
        individual_id, account_holder_name, bsb, account_number, bank_name,
        documents_count, npp_payid_verified, payid_value, payid_type, payid_account_name,
        payid_match, payid_points,
        name_consistency_score, bsb_account_consistency_score, visual_auth_score,
        npp_score, document_quality_score, overall_confidence_score, confidence_level,
        matched_entity_abn, entity_match_confidence, entity_match_method,
        verification_status, verified_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
      RETURNING id
    `, [
      individualId,
      accountHolderName,
      bsb,
      accountNumber,
      bankName,
      documentBuffers.length,
      payidResult?.success || false,
      payid?.value || null,
      payid?.type || null,
      payidResult?.account_name || null,
      payidResult?.account_name?.toLowerCase() === accountHolderName.toLowerCase(),
      score.npp_score,
      score.name_consistency_score,
      score.bsb_account_consistency_score,
      score.visual_auth_score,
      score.npp_score,
      score.document_quality_score,
      score.overall_score,
      score.confidence_level,
      entityMatch.matched_entity_abn,
      entityMatch.entity_match_confidence,
      entityMatch.entity_match_method,
      verification_status,
    ]);

    const bankVerificationId = verificationResult.rows[0].id;

    // Link documents to verification
    for (const doc of documentData) {
      await pool.query(`
        UPDATE bank_verification_documents
        SET bank_verification_id = $1
        WHERE id = $2
      `, [bankVerificationId, doc.document_id]);
    }

    // Step 8: Update individual record
    await pool.query(`
      UPDATE individuals
      SET bank_verified = $1
      WHERE id = $2
    `, [verification_status === 'approved', individualId]);

    // Step 9: If entity matched, trigger trilogy verification
    if (entityMatch.matched_entity_abn) {
      console.log('Entity matched - triggering trilogy verification...');
      const abrResult = await queryABR(entityMatch.matched_entity_abn);
      if (abrResult.lookup_successful && abrResult.business_name) {
        // Use existing trilogy verification logic
        const trilogyResult = verifyTrilogy(
          {
            abn: entityMatch.matched_entity_abn,
            acn: abrResult.acn || null,
            business_name: abrResult.business_name,
            address: null,
            extraction_successful: true,
            extraction_errors: [],
          },
          abrResult
        );

        // Update entity link to mark as primary if trilogy passes
        if (trilogyResult.passed) {
          await pool.query(`
            UPDATE individual_entity_links
            SET is_primary_entity = TRUE
            WHERE individual_id = $1 AND verification_id IN (
              SELECT id FROM verifications WHERE abr_abn = $2
            )
          `, [individualId, entityMatch.matched_entity_abn]);
        }
      }
    }

    return {
      bank_verification_id: bankVerificationId,
      verification_status,
      overall_confidence_score: score.overall_score,
      confidence_level: score.confidence_level,
      matched_entity_abn: entityMatch.matched_entity_abn,
      entity_match_confidence: entityMatch.entity_match_confidence,
      reason,
    };
  } catch (error) {
    console.error('Bank verification failed:', error);
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

