/**
 * Identity Verification Route
 * POST /api/kyc/verify-identity
 * Point 1 of KYC: Identity verification with ABR entity discovery
 */

import { Router, Request, Response } from 'express';
import { uploadSingle } from '../../lib/file-upload';
import { verifyIdentity } from '../../services/verification/identity';
import { generalApiLimiter } from '../../middleware/rate-limiter';

const router = Router();

/**
 * POST /api/kyc/verify-identity
 * 
 * Verify individual identity from ID document and discover business entities via ABR
 * 
 * Request:
 * - multipart/form-data
 *   - document: ID document (drivers license, passport, etc.)
 *   - full_name: Customer's full name
 *   - dob: Date of birth (YYYY-MM-DD)
 *   - address: Residential address
 *   - postcode: Postcode (4 digits)
 * 
 * Response:
 * {
 *   "individual_id": "uuid",
 *   "identity_verified": true,
 *   "verification_status": "approved",
 *   "entities_discovered": [
 *     {
 *       "abn": "12345678901",
 *       "acn": "123456789",
 *       "business_name": "EXAMPLE PTY LTD",
 *       "entity_status": "Active"
 *     }
 *   ]
 * }
 */
router.post('/verify-identity', generalApiLimiter, uploadSingle.single('document'), async (req: Request, res: Response) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No document provided',
        message: 'Please upload an identity document (drivers license, passport, etc.)',
      });
    }

    // Validate required fields
    const { full_name, dob, address, postcode } = req.body;

    if (!full_name || !dob || !address || !postcode) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['full_name', 'dob', 'address', 'postcode'],
        received: {
          full_name: !!full_name,
          dob: !!dob,
          address: !!address,
          postcode: !!postcode,
        },
      });
    }

    // Validate postcode format (Australian postcodes are 4 digits)
    if (!/^\d{4}$/.test(postcode)) {
      return res.status(400).json({
        error: 'Invalid postcode format',
        message: 'Postcode must be 4 digits',
      });
    }

    // Validate date format
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        message: 'Date of birth must be in YYYY-MM-DD format',
      });
    }

    // Call identity verification service
    const result = await verifyIdentity(
      req.file.buffer,
      {
        full_name: full_name.trim(),
        dob: dobDate,
        address: address.trim(),
        postcode: postcode.trim(),
      },
      req.file.mimetype
    );

    // Return success response
    return res.status(200).json({
      success: true,
      individual_id: result.individual_id,
      identity_verified: result.identity_verified,
      verification_status: result.verification_status,
      entities_discovered: result.entities_discovered,
      entities_count: result.entities_discovered.length,
      reason: result.reason,
    });
  } catch (error: any) {
    console.error('Identity verification endpoint error:', error);

    // Return appropriate error response
    if (error.message.includes('confidence too low') || 
        error.message.includes('tampered') ||
        error.message.includes('expired') ||
        error.message.includes('invalid')) {
      return res.status(400).json({
        error: 'Document validation failed',
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'Identity verification failed',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

export default router;

