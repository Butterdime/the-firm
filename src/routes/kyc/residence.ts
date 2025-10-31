/**
 * Residence Verification Route
 * POST /api/kyc/verify-residence
 * Point 2 of KYC: Address verification
 */

import { Router, Request, Response } from 'express';
import { uploadSingle } from '../../lib/file-upload';
import { verifyResidence } from '../../services/verification/residence';
import { generalApiLimiter } from '../../middleware/rate-limiter';

const router = Router();

/**
 * POST /api/kyc/verify-residence
 * 
 * Verify residence address from proof document (utility bill, government letter, etc.)
 * 
 * Request:
 * - multipart/form-data
 *   - document: Residence proof document (utility bill, bank statement, etc.)
 *   - individual_id: UUID of the individual (from identity verification)
 * 
 * Response:
 * {
 *   "residence_verified": true,
 *   "verification_status": "approved",
 *   "address_match": true,
 *   "fuzzy_match_score": 0.95,
 *   "document_fresh": true,
 *   "document_age_days": 15
 * }
 */
router.post('/verify-residence', generalApiLimiter, uploadSingle.single('document'), async (req: Request, res: Response) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No document provided',
        message: 'Please upload a residence proof document (utility bill, government letter, etc.)',
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

    // Call residence verification service
    const result = await verifyResidence(
      individual_id,
      req.file.buffer,
      req.file.mimetype
    );

    // Return success response
    return res.status(200).json({
      success: true,
      residence_verified: result.residence_verified,
      verification_status: result.verification_status,
      address_match: result.address_match,
      fuzzy_match_score: result.fuzzy_match_score,
      match_quality: result.fuzzy_match_score >= 0.95 ? 'exact' : result.fuzzy_match_score >= 0.80 ? 'good' : 'poor',
      document_fresh: result.document_fresh,
      document_age_days: result.document_age_days,
      reason: result.reason,
    });
  } catch (error: any) {
    console.error('Residence verification endpoint error:', error);

    // Return appropriate error response
    if (error.message.includes('Individual not found')) {
      return res.status(404).json({
        error: 'Individual not found',
        message: 'Please complete identity verification first',
      });
    }

    if (error.message.includes('confidence too low') ||
        error.message.includes('did not return valid JSON')) {
      return res.status(400).json({
        error: 'Document processing failed',
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'Residence verification failed',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

export default router;

