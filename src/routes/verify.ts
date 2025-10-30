import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/database';
import { extractFromDocument } from '../lib/gemini-extraction';
import { queryABR } from '../lib/abr-verification';
import { verifyTrilogy, checkStaleness } from '../lib/trilogy-verification';
import { logAuditEvent } from '../lib/audit-logger';

const router = Router();

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

/**
 * POST /api/verify-document
 * 
 * Complete verification pipeline:
 * 1. Upload document
 * 2. Extract entity data (Gemini Vision)
 * 3. Query ABR
 * 4. Trilogy verification (ABN + ACN + Name exact match)
 * 5. Check entity status = "Active"
 * 6. Check document staleness
 * 7. Return result with complete audit trail
 */
router.post('/verify-document', upload.single('document'), async (req: Request, res: Response) => {
  let documentId: string | null = null;
  let verificationId: string | null = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No document provided',
      });
    }

    const filename = req.file.originalname;
    const fileBuffer = req.file.buffer; // Buffer from memory storage
    const mimeType = req.file.mimetype;

    // Step 1: Create document record
    const documentResult = await pool.query(
      `INSERT INTO documents (filename, file_path, file_size, mime_type, status)
       VALUES ($1, $2, $3, $4, 'processing')
       RETURNING id`,
      [filename, 'memory-storage', req.file.size, mimeType]
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
    const documentCaptureDate = req.body.document_date 
      ? new Date(req.body.document_date) 
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
      // Trilogy check failed → manual review
      finalStatus = 'manual_review';
      finalReason = trilogyResult.mismatch_reason || 'Verification failed';
    } else if (stalenessCheck.requires_review) {
      // Document too old → manual review
      finalStatus = 'manual_review';
      finalReason = stalenessCheck.warning_message || 'Document is stale';
    } else {
      // All checks passed → approved
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
      );
    }

    return res.status(500).json({
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/verifications/:id
 * Get verification result with complete audit trail
 */
router.get('/verifications/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        v.*,
        d.filename,
        d.uploaded_at
      FROM verifications v
      JOIN documents d ON v.document_id = d.id
      WHERE v.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    const verification = result.rows[0];

    // Get audit trail
    const auditTrail = await pool.query(
      `SELECT 
        event_type,
        event_timestamp,
        decision_result,
        decision_reason
      FROM audit_logs
      WHERE verification_id = $1
      ORDER BY event_timestamp ASC`,
      [id]
    );

    return res.status(200).json({
      verification,
      audit_trail: auditTrail.rows,
    });

  } catch (error) {
    console.error('Error fetching verification:', error);
    return res.status(500).json({
      error: 'Failed to fetch verification',
    });
  }
});

export default router;
