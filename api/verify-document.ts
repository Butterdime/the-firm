import type { VercelRequest, VercelResponse } from '@vercel/node';
import multer from 'multer';
import path from 'path';
import pool from '../src/config/database';
import { extractFromDocument } from '../src/lib/gemini-extraction';
import { queryABR } from '../src/lib/abr-verification';
import { verifyTrilogy, checkStaleness } from '../src/lib/trilogy-verification';
import { logAuditEvent } from '../src/lib/audit-logger';

// Configure multer for file uploads (serverless - use memory storage)
const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for serverless
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  },
});

// Promisify multer
const uploadMiddleware = (req: any, res: any) => {
  return new Promise((resolve, reject) => {
    upload.single('document')(req, res, (err: any) => {
      if (err) reject(err);
      else resolve(req.file);
    });
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let documentId: string | null = null;
  let verificationId: string | null = null;

  try {
    // Handle file upload
    await uploadMiddleware(req, res);
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({
        error: 'No document provided',
      });
    }

    const filename = file.originalname;
    const fileBuffer = file.buffer; // Buffer from memory storage
    const mimeType = file.mimetype;

    // Step 1: Create document record
    const documentResult = await pool.query(
      `INSERT INTO documents (filename, file_path, file_size, mime_type, status)
       VALUES ($1, $2, $3, $4, 'processing')
       RETURNING id`,
      [filename, 'memory-storage', file.size, mimeType]
    );
    documentId = documentResult.rows[0].id;

    // Step 2: Extract entity data using Gemini Vision (pass buffer directly)
    const extracted = await extractFromDocument(fileBuffer, mimeType);

    await logAuditEvent({
      document_id: documentId,
      event_type: 'ocr_extraction',
      decision_maker: 'system',
      decision_result: extracted.extraction_successful ? 'pass' : 'fail',
      decision_reason: extracted.extraction_successful 
        ? 'Successfully extracted entity data'
        : `Extraction failed: ${extracted.extraction_errors.join(', ')}`,
      data_snapshot: extracted,
    });

    // If extraction failed, flag for manual review
    if (!extracted.extraction_successful || !extracted.abn) {
      const verificationResult = await pool.query(
        `INSERT INTO verifications (
          document_id,
          extracted_abn,
          extracted_acn,
          extracted_business_name,
          trilogy_check_passed,
          verification_status,
          mismatch_reason,
          requires_manual_review
        ) VALUES ($1, $2, $3, $4, false, 'manual_review', $5, true)
        RETURNING id`,
        [
          documentId,
          extracted.abn,
          extracted.acn,
          extracted.business_name,
          'Extraction failed or ABN not found - manual review required',
        ]
      );
      verificationId = verificationResult.rows[0].id;

      await logAuditEvent({
        verification_id: verificationId,
        document_id: documentId,
        event_type: 'manual_review',
        decision_maker: 'system',
        decision_result: 'flagged',
        decision_reason: 'Extraction failed - requires manual review',
        data_snapshot: { extracted },
      });

      await pool.query(
        `UPDATE documents SET status = 'completed' WHERE id = $1`,
        [documentId]
      );

      return res.status(200).json({
        status: 'manual_review',
        verification_id: verificationId,
        reason: 'Document extraction failed or incomplete - manual review required',
        extracted_data: extracted,
      });
    }

    // Step 3: Query ABR for entity details
    const abrResult = await queryABR(extracted.abn);

    await logAuditEvent({
      document_id: documentId,
      event_type: 'abr_query',
      decision_maker: 'system',
      decision_result: abrResult.lookup_successful ? 'pass' : 'fail',
      decision_reason: abrResult.lookup_successful
        ? 'ABR lookup successful'
        : `ABR lookup failed: ${abrResult.lookup_errors.join(', ')}`,
      data_snapshot: abrResult,
    });

    // If ABR lookup failed, flag for manual review
    if (!abrResult.lookup_successful) {
      const verificationResult = await pool.query(
        `INSERT INTO verifications (
          document_id,
          extracted_abn,
          extracted_acn,
          extracted_business_name,
          trilogy_check_passed,
          verification_status,
          mismatch_reason,
          requires_manual_review
        ) VALUES ($1, $2, $3, $4, false, 'manual_review', $5, true)
        RETURNING id`,
        [
          documentId,
          extracted.abn,
          extracted.acn,
          extracted.business_name,
          `ABR lookup failed: ${abrResult.lookup_errors.join(', ')}`,
        ]
      );
      verificationId = verificationResult.rows[0].id;

      await pool.query(
        `UPDATE documents SET status = 'completed' WHERE id = $1`,
        [documentId]
      );

      return res.status(200).json({
        status: 'manual_review',
        verification_id: verificationId,
        reason: 'ABR lookup failed - manual review required',
        extracted_data: extracted,
        abr_errors: abrResult.lookup_errors,
      });
    }

    // Step 4: Trilogy verification (ABN + ACN + Name exact match)
    const trilogyResult = verifyTrilogy(extracted, abrResult);

    await logAuditEvent({
      document_id: documentId,
      event_type: 'trilogy_check',
      decision_maker: 'system',
      decision_result: trilogyResult.passed ? 'pass' : 'fail',
      decision_reason: trilogyResult.passed
        ? 'Trilogy verification passed (ABN + ACN + Name match, entity active)'
        : trilogyResult.mismatch_reason || 'Trilogy verification failed',
      data_snapshot: {
        extracted,
        abr: abrResult,
        checks: trilogyResult.checks,
      },
    });

    // Step 5: Check document staleness
    const documentCaptureDate = (req.body as any).document_date 
      ? new Date((req.body as any).document_date) 
      : null;
    const stalenessCheck = checkStaleness(documentCaptureDate);

    if (stalenessCheck.warning_message) {
      await logAuditEvent({
        document_id: documentId,
        event_type: 'staleness_check',
        decision_maker: 'system',
        decision_result: stalenessCheck.requires_review ? 'flagged' : 'warning',
        decision_reason: stalenessCheck.warning_message,
        data_snapshot: {
          document_capture_date: documentCaptureDate,
          staleness_days: stalenessCheck.staleness_days,
        },
      });
    }

    // Step 6: Determine final verification status
    let finalStatus: 'approved' | 'rejected' | 'manual_review';
    let finalReason: string;

    if (!trilogyResult.passed) {
      finalStatus = 'manual_review';
      finalReason = trilogyResult.mismatch_reason || 'Verification failed';
    } else if (stalenessCheck.requires_review) {
      finalStatus = 'manual_review';
      finalReason = stalenessCheck.warning_message || 'Document is stale';
    } else {
      finalStatus = 'approved';
      finalReason = 'All verification checks passed';
    }

    // Step 7: Save verification result
    const verificationResult = await pool.query(
      `INSERT INTO verifications (
        document_id,
        extracted_abn,
        extracted_acn,
        extracted_business_name,
        extracted_address,
        abr_abn,
        abr_acn,
        abr_business_name,
        abr_entity_status,
        abr_entity_type,
        abr_response_raw,
        trilogy_check_passed,
        verification_status,
        mismatch_reason,
        document_capture_date,
        staleness_warning,
        staleness_days,
        requires_manual_review
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id`,
      [
        documentId,
        extracted.abn,
        extracted.acn,
        extracted.business_name,
        extracted.address,
        abrResult.abn,
        abrResult.acn,
        abrResult.business_name,
        abrResult.entity_status,
        abrResult.entity_type,
        JSON.stringify(abrResult.raw_response),
        trilogyResult.passed,
        finalStatus,
        finalReason,
        documentCaptureDate,
        stalenessCheck.is_stale,
        stalenessCheck.staleness_days,
        finalStatus === 'manual_review',
      ]
    );
    verificationId = verificationResult.rows[0].id;

    // Log final decision
    await logAuditEvent({
      verification_id: verificationId,
      document_id: documentId,
      event_type: finalStatus === 'approved' ? 'approval' : 'rejection',
      decision_maker: 'system',
      decision_result: finalStatus === 'approved' ? 'pass' : 'flagged',
      decision_reason: finalReason,
      data_snapshot: {
        final_status: finalStatus,
        trilogy_checks: trilogyResult.checks,
        staleness: stalenessCheck,
      },
    });

    await pool.query(
      `UPDATE documents SET status = 'completed' WHERE id = $1`,
      [documentId]
    );

    // Return complete result
    return res.status(200).json({
      status: finalStatus,
      verification_id: verificationId,
      document_id: documentId,
      reason: finalReason,
      extracted_data: extracted,
      abr_data: {
        abn: abrResult.abn,
        acn: abrResult.acn,
        business_name: abrResult.business_name,
        entity_status: abrResult.entity_status,
        entity_type: abrResult.entity_type,
      },
      trilogy_checks: trilogyResult.checks,
      staleness_check: stalenessCheck,
    });

  } catch (error) {
    console.error('Verification error:', error);

    // Log error
    if (documentId) {
      await pool.query(
        `UPDATE documents SET status = 'failed' WHERE id = $1`,
        [documentId]
      ).catch(err => console.error('Failed to update document status:', err));
    }

    return res.status(500).json({
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

