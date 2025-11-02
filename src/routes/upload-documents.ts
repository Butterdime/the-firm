/**
 * Customer Document Upload Route
 * 
 * Handles upload of all customer proof documents (identity, address, bank)
 * before or after verification. Documents are stored on disk for CIS generation.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import pool from '../config/database';
import { saveUploadedFile, DocumentType } from '../lib/document-storage';
import { generalApiLimiter } from '../middleware/rate-limiter';
import { logAuditEvent } from '../lib/audit-logger';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = /pdf|image/.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  },
});

/**
 * POST /api/upload-customer-documents
 * 
 * Upload customer proof documents (identity, address, bank) for a verification.
 * 
 * Body (multipart/form-data):
 * - verification_id: UUID (required)
 * - identity: File (optional)
 * - address: File (optional)
 * - bank: File (optional, can be multiple)
 * 
 * Response:
 * {
 *   success: boolean,
 *   uploaded: {
 *     identity: { filename, file_path, file_size },
 *     address: { filename, file_path, file_size },
 *     bank: [{ filename, file_path, file_size }]
 *   }
 * }
 */
router.post(
  '/upload-customer-documents',
  generalApiLimiter,
  upload.fields([
    { name: 'identity', maxCount: 1 },
    { name: 'address', maxCount: 1 },
    { name: 'bank', maxCount: 5 }, // Multiple bank statements allowed
    { name: 'abn', maxCount: 1 }, // ABN statement
  ]),
  async (req: Request, res: Response) => {
    try {
      const { verification_id } = req.body;
      
      if (!verification_id) {
        return res.status(400).json({
          error: 'verification_id is required',
        });
      }

      // Verify that verification exists
      const verificationCheck = await pool.query(
        'SELECT id, verification_status FROM verifications WHERE id = $1',
        [verification_id]
      );

      if (verificationCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Verification not found',
          verification_id,
        });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const uploaded: any = {};

      // Upload identity document
      if (files.identity && files.identity[0]) {
        const file = files.identity[0];
        const stored = await saveUploadedFile(
          file.buffer,
          verification_id,
          'identity',
          file.originalname,
          file.mimetype
        );

        // Store metadata in database
        await pool.query(
          `INSERT INTO verification_documents (
            verification_id, document_type, filename, file_path, file_size, mime_type
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (verification_id, document_type) 
          DO UPDATE SET 
            filename = EXCLUDED.filename,
            file_path = EXCLUDED.file_path,
            file_size = EXCLUDED.file_size,
            mime_type = EXCLUDED.mime_type,
            updated_at = CURRENT_TIMESTAMP`,
          [
            stored.verification_id,
            stored.document_type,
            stored.filename,
            stored.file_path,
            stored.file_size,
            stored.mime_type,
          ]
        );

        uploaded.identity = {
          filename: stored.filename,
          file_path: stored.file_path,
          file_size: stored.file_size,
        };

        await logAuditEvent({
          verification_id,
          document_id: null,
          event_type: 'approval',
          decision_maker: 'system',
          decision_result: 'pass',
          decision_reason: 'Identity document uploaded and stored',
          data_snapshot: { document_type: 'identity', filename: stored.filename },
        });
      }

      // Upload address document
      if (files.address && files.address[0]) {
        const file = files.address[0];
        const stored = await saveUploadedFile(
          file.buffer,
          verification_id,
          'address',
          file.originalname,
          file.mimetype
        );

        await pool.query(
          `INSERT INTO verification_documents (
            verification_id, document_type, filename, file_path, file_size, mime_type
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (verification_id, document_type) 
          DO UPDATE SET 
            filename = EXCLUDED.filename,
            file_path = EXCLUDED.file_path,
            file_size = EXCLUDED.file_size,
            mime_type = EXCLUDED.mime_type,
            updated_at = CURRENT_TIMESTAMP`,
          [
            stored.verification_id,
            stored.document_type,
            stored.filename,
            stored.file_path,
            stored.file_size,
            stored.mime_type,
          ]
        );

        uploaded.address = {
          filename: stored.filename,
          file_path: stored.file_path,
          file_size: stored.file_size,
        };

        await logAuditEvent({
          verification_id,
          document_id: null,
          event_type: 'approval',
          decision_maker: 'system',
          decision_result: 'pass',
          decision_reason: 'Address document uploaded and stored',
          data_snapshot: { document_type: 'address', filename: stored.filename },
        });
      }

      // Upload bank statement(s)
      if (files.bank && files.bank.length > 0) {
        uploaded.bank = [];
        
        for (const file of files.bank) {
          const stored = await saveUploadedFile(
            file.buffer,
            verification_id,
            'bank',
            file.originalname,
            file.mimetype
          );

          // For multiple bank statements, use unique filenames
          await pool.query(
            `INSERT INTO verification_documents (
              verification_id, document_type, filename, file_path, file_size, mime_type
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              stored.verification_id,
              stored.document_type,
              stored.filename,
              stored.file_path,
              stored.file_size,
              stored.mime_type,
            ]
          );

          uploaded.bank.push({
            filename: stored.filename,
            file_path: stored.file_path,
            file_size: stored.file_size,
          });
        }

        await logAuditEvent({
          verification_id,
          document_id: null,
          event_type: 'approval',
          decision_maker: 'system',
          decision_result: 'pass',
          decision_reason: `${files.bank.length} bank statement(s) uploaded and stored`,
          data_snapshot: { document_type: 'bank', count: files.bank.length },
        });
      }

      // Upload ABN statement
      if (files.abn && files.abn[0]) {
        const file = files.abn[0];
        const stored = await saveUploadedFile(
          file.buffer,
          verification_id,
          'abn',
          file.originalname,
          file.mimetype
        );

        await pool.query(
          `INSERT INTO verification_documents (
            verification_id, document_type, filename, file_path, file_size, mime_type
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (verification_id, document_type)
          DO UPDATE SET
            filename = EXCLUDED.filename,
            file_path = EXCLUDED.file_path,
            file_size = EXCLUDED.file_size,
            mime_type = EXCLUDED.mime_type,
            updated_at = CURRENT_TIMESTAMP`,
          [
            stored.verification_id,
            stored.document_type,
            stored.filename,
            stored.file_path,
            stored.file_size,
            stored.mime_type,
          ]
        );

        uploaded.abn = {
          filename: stored.filename,
          file_path: stored.file_path,
          file_size: stored.file_size,
        };

        await logAuditEvent({
          verification_id,
          document_id: null,
          event_type: 'approval',
          decision_maker: 'system',
          decision_result: 'pass',
          decision_reason: 'ABN statement uploaded and stored',
          data_snapshot: { document_type: 'abn', filename: stored.filename },
        });
      }

      res.json({
        success: true,
        verification_id,
        uploaded,
        message: 'Documents uploaded successfully',
      });
    } catch (error: any) {
      console.error('❌ Error uploading documents:', error);
      res.status(500).json({
        error: 'Failed to upload documents',
        details: error.message,
      });
    }
  }
);

export default router;

