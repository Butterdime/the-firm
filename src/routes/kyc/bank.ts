/**
 * Bank Verification Route
 * POST /api/kyc/upload-bank-document - Upload bank documents
 * POST /api/kyc/verify-bank-account - Verify bank account
 * Point 3 of KYC: Multi-document bank account verification
 */

import { Router, Request, Response } from 'express';
import { uploadMultiple, validateFileCount } from '../../lib/file-upload';
import { verifyBankAccount } from '../../services/verification/bank';
import { generalApiLimiter } from '../../middleware/rate-limiter';
import pool from '../../config/database';

const router = Router();

/**
 * POST /api/kyc/verify-bank-account
 * 
 * Verify bank account with multiple documents (1-5 documents)
 * Optionally include PayID for NPP verification
 * 
 * Request:
 * - multipart/form-data
 *   - documents: 1-5 bank documents (bank statement, transfer slip, etc.)
 *   - individual_id: UUID of the individual (from identity verification)
 *   - payid_value (optional): PayID value (email/phone/ABN)
 *   - payid_type (optional): 'email', 'phone', or 'abn'
 * 
 * Response:
 * {
 *   "bank_verification_id": "uuid",
 *   "verification_status": "approved",
 *   "overall_confidence_score": 85,
 *   "confidence_level": "HIGH",
 *   "matched_entity_abn": "12345678901",
 *   "entity_match_confidence": 0.92
 * }
 */
router.post('/verify-bank-account', generalApiLimiter, uploadMultiple.array('documents', 5), async (req: Request, res: Response) => {
  try {
    // Validate file uploads
    const files = req.files as Express.Multer.File[] | undefined;
    const fileValidation = validateFileCount(files, 1, 5);

    if (!fileValidation.valid) {
      return res.status(400).json({
        error: 'Invalid file upload',
        message: fileValidation.error,
      });
    }

    // Validate required fields
    const { individual_id } = req.body;

    if (!individual_id) {
      return res.status(400).json({
        error: 'Missing required field',
        required: ['individual_id'],
        message: 'individual_id is required. Get this from the identity verification response.',
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(individual_id)) {
      return res.status(400).json({
        error: 'Invalid individual_id format',
        message: 'individual_id must be a valid UUID',
      });
    }

    // Validate individual exists
    const individualCheck = await pool.query(`
      SELECT id FROM individuals WHERE id = $1
    `, [individual_id]);

    if (individualCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Individual not found',
        message: 'Please complete identity verification first',
      });
    }

    // Prepare documents array
    const documentBuffers = files!.map(file => ({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    }));

    // Optional PayID
    const payidValue = req.body.payid_value;
    const payidType = req.body.payid_type;
    let payid: { value: string; type: 'email' | 'phone' | 'abn' } | undefined;

    if (payidValue && payidType) {
      if (!['email', 'phone', 'abn'].includes(payidType)) {
        return res.status(400).json({
          error: 'Invalid payid_type',
          message: 'payid_type must be one of: email, phone, abn',
        });
      }
      payid = {
        value: payidValue.trim(),
        type: payidType as 'email' | 'phone' | 'abn',
      };
    }

    // Call bank verification service
    const result = await verifyBankAccount(individual_id, documentBuffers, payid);

    // Return success response
    return res.status(200).json({
      success: true,
      bank_verification_id: result.bank_verification_id,
      verification_status: result.verification_status,
      overall_confidence_score: result.overall_confidence_score,
      confidence_level: result.confidence_level,
      matched_entity_abn: result.matched_entity_abn,
      entity_match_confidence: result.entity_match_confidence,
      reason: result.reason,
    });
  } catch (error: any) {
    console.error('Bank verification endpoint error:', error);

    // Return appropriate error response
    if (error.message.includes('Individual not found') ||
        error.message.includes('at least one') ||
        error.message.includes('Maximum')) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }

    if (error.message.includes('confidence too low') ||
        error.message.includes('Failed to extract')) {
      return res.status(400).json({
        error: 'Document processing failed',
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'Bank verification failed',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

export default router;

