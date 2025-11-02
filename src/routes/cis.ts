import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/database';
import { extractFromDocument } from '../lib/gemini-extraction';
import { queryABR } from '../lib/abr-verification';
import { logAuditEvent } from '../lib/audit-logger';
import { saveUploadedFile } from '../lib/document-storage';
import { generalApiLimiter } from '../middleware/rate-limiter';

const router = Router();

// Configure multer for multiple file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 4 // Maximum 4 files
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
 * POST /api/cis/upload-documents
 *
 * Upload multiple documents for CIS verification
 */
router.post('/upload-documents', generalApiLimiter, upload.array('documents', 4), async (req: Request, res: Response) => {
  const cisSessionId = req.body.cisSessionId || `cis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const customerType = req.body.customerType || 'individual';

  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({
        error: 'No documents provided',
      });
    }

    const files = req.files as Express.Multer.File[];
    const documentTypes = req.body.documentTypes ? JSON.parse(req.body.documentTypes) : [];

    // Create CIS session record
    const sessionResult = await pool.query(
      `INSERT INTO cis_sessions (id, customer_type, status, created_at)
       VALUES ($1, $2, 'processing', CURRENT_TIMESTAMP)
       RETURNING id`,
      [cisSessionId, customerType]
    );

    const processedDocuments = [];

    // Process each uploaded document
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const docType = documentTypes[i] || 'unknown';

      try {
        // Create document record
        const documentResult = await pool.query(
          `INSERT INTO cis_documents_platform (cis_session_id, document_type, filename, file_size, mime_type, status)
           VALUES ($1, $2, $3, $4, $5, 'processing')
           RETURNING id`,
          [cisSessionId, docType, file.originalname, file.size, file.mimetype]
        );
        const documentId = documentResult.rows[0].id;

        // Extract data using OCR
        const extracted = await extractFromDocument(file.buffer, file.mimetype);

        // Update document with extracted data
        await pool.query(
          `UPDATE cis_documents_platform
           SET extracted_data = $1, status = 'processed', processed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [JSON.stringify(extracted), documentId]
        );

        // Log extraction event
        await logAuditEvent({
          cis_session_id: cisSessionId,
          document_id: documentId,
          event_type: 'ocr_extraction',
          decision_maker: 'system',
          decision_result: extracted.extraction_successful ? 'pass' : 'fail',
          decision_reason: extracted.extraction_successful
            ? 'Successfully extracted data'
            : `Extraction failed: ${extracted.extraction_errors.join(', ')}`,
          data_snapshot: extracted,
        });

        processedDocuments.push({
          id: documentId,
          type: docType,
          filename: file.originalname,
          extracted,
          status: extracted.extraction_successful ? 'success' : 'failed'
        });

      } catch (error: any) {
        console.error(`Error processing document ${file.originalname}:`, error);
        processedDocuments.push({
          type: docType,
          filename: file.originalname,
          error: error.message,
          status: 'error'
        });
      }
    }

    // Update session status
    await pool.query(
      `UPDATE cis_sessions SET status = 'documents_processed' WHERE id = $1`,
      [cisSessionId]
    );

    return res.status(200).json({
      cisSessionId,
      customerType,
      documents: processedDocuments,
      status: 'documents_processed'
    });

  } catch (error: any) {
    console.error('CIS document upload error:', error);

    // Mark session as failed
    if (cisSessionId) {
      await pool.query(
        `UPDATE cis_sessions SET status = 'failed' WHERE id = $1`,
        [cisSessionId]
      ).catch(() => {}); // Ignore errors in cleanup
    }

    return res.status(500).json({
      error: 'Document processing failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/cis/analyze
 *
 * Analyze uploaded documents and perform cross-verification
 */
router.post('/analyze', generalApiLimiter, async (req: Request, res: Response) => {
  const { cisSessionId } = req.body;

  if (!cisSessionId) {
    return res.status(400).json({ error: 'CIS Session ID is required' });
  }

  try {
    // Get session and documents
    const sessionResult = await pool.query(
      'SELECT * FROM cis_sessions WHERE id = $1',
      [cisSessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'CIS session not found' });
    }

    const session = sessionResult.rows[0];

    const documentsResult = await pool.query(
      'SELECT * FROM cis_documents_platform WHERE cis_session_id = $1 AND status = $2',
      [cisSessionId, 'processed']
    );

    const documents = documentsResult.rows;

    if (documents.length < 2) {
      return res.status(400).json({
        error: 'At least 2 documents required for analysis (ID and Address)'
      });
    }

    // Extract data from all documents
    const extractedData = documents.map(doc => ({
      type: doc.document_type,
      data: doc.extracted_data,
      id: doc.id
    }));

    // Perform cross-verification
    const verificationResult = await performCrossVerification(extractedData, session.customer_type);

    // Update session with verification results
    await pool.query(
      `UPDATE cis_sessions
       SET verification_result = $1, status = $2, verified_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(verificationResult), verificationResult.status, cisSessionId]
    );

    // Log verification event
    await logAuditEvent({
      cis_session_id: cisSessionId,
      event_type: 'cross_verification',
      decision_maker: 'system',
      decision_result: verificationResult.status === 'verified' ? 'pass' : 'flagged',
      decision_reason: verificationResult.message,
      data_snapshot: verificationResult,
    });

    return res.status(200).json({
      cisSessionId,
      verification: verificationResult,
      status: verificationResult.status
    });

  } catch (error: any) {
    console.error('CIS analysis error:', error);

    // Mark session as failed
    await pool.query(
      `UPDATE cis_sessions SET status = 'failed' WHERE id = $1`,
      [cisSessionId]
    ).catch(() => {}); // Ignore cleanup errors

    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/cis/generate
 *
 * Generate CIS PDF with verification results
 */
router.post('/generate', generalApiLimiter, async (req: Request, res: Response) => {
  const { cisSessionId, formData } = req.body;

  if (!cisSessionId) {
    return res.status(400).json({ error: 'CIS Session ID is required' });
  }

  try {
    // Get session data
    const sessionResult = await pool.query(
      'SELECT * FROM cis_sessions WHERE id = $1',
      [cisSessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'CIS session not found' });
    }

    const session = sessionResult.rows[0];

    if (session.status !== 'verified') {
      return res.status(400).json({
        error: 'Session must be verified before generating CIS'
      });
    }

    // Generate CIS PDF
    const pdfBuffer = await generateCISPDF(session, formData);

    // Update session status
    await pool.query(
      `UPDATE cis_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [cisSessionId]
    );

    // Log generation event
    await logAuditEvent({
      cis_session_id: cisSessionId,
      event_type: 'cis_generation',
      decision_maker: 'system',
      decision_result: 'pass',
      decision_reason: 'CIS PDF generated successfully',
      data_snapshot: { formData },
    });

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CIS_${cisSessionId}.pdf"`);
    return res.send(pdfBuffer);

  } catch (error: any) {
    console.error('CIS generation error:', error);
    return res.status(500).json({
      error: 'CIS generation failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/cis/session/:id
 *
 * Get CIS session status and data
 */
router.get('/session/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const sessionResult = await pool.query(
      'SELECT * FROM cis_sessions WHERE id = $1',
      [id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'CIS session not found' });
    }

    const session = sessionResult.rows[0];

    const documentsResult = await pool.query(
      'SELECT id, document_type, filename, status, extracted_data, created_at FROM cis_documents_platform WHERE cis_session_id = $1',
      [id]
    );

    return res.status(200).json({
      session,
      documents: documentsResult.rows
    });

  } catch (error: any) {
    console.error('Error fetching CIS session:', error);
    return res.status(500).json({
      error: 'Failed to fetch session',
    });
  }
});

/**
 * POST /api/cis/admin/approve/:id
 *
 * Administrative endpoint to manually approve a CIS session (for testing)
 */
router.post('/admin/approve/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Update session status to verified
    await pool.query(
      `UPDATE cis_sessions SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Log administrative approval
    await logAuditEvent({
      cis_session_id: id,
      event_type: 'admin_approval',
      decision_maker: 'admin',
      decision_result: 'pass',
      decision_reason: 'Session manually approved for testing',
      data_snapshot: { adminApproval: true },
    });

    return res.status(200).json({
      message: 'Session manually approved',
      sessionId: id,
      status: 'verified'
    });

  } catch (error: any) {
    console.error('Error approving CIS session:', error);
    return res.status(500).json({
      error: 'Failed to approve session',
    });
  }
});

// Helper functions

async function performCrossVerification(extractedData: any[], customerType: string) {
  const result = {
    status: 'verified', // Default to verified, override only if issues found
    message: 'All verifications passed',
    nameMatch: true,
    abnFound: false,
    abnNumber: null,
    issues: [],
    extractedInfo: {}
  };

  try {
    // Extract names from different document types
    const names = extractedData.map(doc => {
      let name = '';
      switch (doc.type) {
        case 'proofOfId':
          name = doc.data.clientName || doc.data.licenceHolder || doc.data.accountHolder || '';
          break;
        case 'proofOfResidence':
          name = doc.data.accountHolder || doc.data.clientName || '';
          break;
        case 'sourceOfFunds':
          name = doc.data.accountHolder || doc.data.clientName || '';
          break;
        case 'business':
          name = doc.data.entityName || doc.data.business_name || '';
          break;
      }
      return { type: doc.type, name: name.toLowerCase().trim(), original: name };
    }).filter(item => item.name);

    // Check name consistency - only flag if there are actual mismatches
    if (names.length > 1) {
      const firstName = names[0].name;
      const nameMismatches = names.filter(item => item.name !== firstName && item.name !== ''); // Ignore empty names

      if (nameMismatches.length > 0) {
        result.nameMatch = false;
        result.status = 'manual_review';
        result.message = 'Name mismatches detected across documents';
        result.issues.push(`Name inconsistency: ${nameMismatches.map(m => `${m.type}: "${m.original}"`).join(', ')}`);
      }
    }

    // Extract address for ABN lookup
    const addressDoc = extractedData.find(doc => doc.type === 'proofOfResidence');
    let postcode = null;
    if (addressDoc?.data?.address) {
      const postcodeMatch = addressDoc.data.address.match(/\b\d{4}\b/);
      if (postcodeMatch) {
        postcode = postcodeMatch[0];
      }
    }

    // For entities, try ABN lookup - this is the main blocker for entities
    if (customerType === 'entity') {
      const businessDoc = extractedData.find(doc => doc.type === 'business');
      const entityName = businessDoc?.data?.entityName || businessDoc?.data?.business_name;

      // Only require ABN lookup if we have the necessary data
      if (entityName && postcode) {
        try {
          // TODO: Implement name-based ABN lookup - for now skip this step
          const abrResult = {
            abn: null,
            acn: null,
            business_name: null,
            entity_status: null,
            entity_type: null,
            raw_response: null,
            lookup_successful: false,
            lookup_errors: ['Name-based ABN lookup not yet implemented']
          };

          if (abrResult.lookup_successful && abrResult.abn) {
            result.abnFound = true;
            result.abnNumber = abrResult.abn;
            result.extractedInfo.abn = abrResult.abn;
            result.extractedInfo.entityName = abrResult.business_name;
            // Status stays 'verified' since ABN was found
          } else {
            result.status = 'needs_business_docs';
            result.message = 'ABN not found - additional business documents required';
            result.issues.push('ABN lookup failed for entity');
          }
        } catch (error) {
          result.status = 'needs_business_docs';
          result.message = 'ABN lookup failed - additional business documents required';
          result.issues.push('ABN registry query error');
        }
      } else if (!entityName) {
        // No entity name found - require business docs
        result.status = 'needs_business_docs';
        result.message = 'Entity name not found in documents - additional business documents required';
        result.issues.push('Entity name missing for ABN lookup');
      } else if (!postcode) {
        // No postcode found - this is less critical, allow verification but note it
        result.issues.push('Postcode not found - ABN lookup skipped');
        // Status stays 'verified' since we have entity name
      }
    }

    // Compile extracted information
    extractedData.forEach(doc => {
      result.extractedInfo = { ...result.extractedInfo, ...doc.data };
    });

    // Final check: if status is still 'verified', make sure we have minimum required data
    if (result.status === 'verified') {
      const hasRequiredData = extractedData.length >= 2; // At least ID and Address
      if (!hasRequiredData) {
        result.status = 'manual_review';
        result.message = 'Insufficient document data for verification';
        result.issues.push('Minimum required documents not processed');
      }
    }

  } catch (error: any) {
    result.status = 'error';
    result.message = `Cross-verification failed: ${error.message}`;
    throw new Error("Verification system error" as any);
  }

  return result;
}

async function generateCISPDF(session: any, formData: any) {
  // This would implement the actual PDF generation
  // For now, return a simple placeholder
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(600, 800);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 800);

  ctx.fillStyle = '#000000';
  ctx.font = '24px Arial';
  ctx.fillText('Customer Information Sheet', 50, 50);

  ctx.font = '16px Arial';
  ctx.fillText(`Session ID: ${session.id}`, 50, 100);
  ctx.fillText(`Customer Type: ${session.customer_type}`, 50, 130);
  ctx.fillText(`Status: ${session.status}`, 50, 160);

  if (formData) {
    ctx.fillText(`Client Name: ${formData.clientName || 'N/A'}`, 50, 200);
    ctx.fillText(`Entity Name: ${formData.entityName || 'N/A'}`, 50, 230);
    ctx.fillText(`ABN: ${formData.abn || 'N/A'}`, 50, 260);
  }

  return canvas.toBuffer('application/pdf');
}

export default router;
