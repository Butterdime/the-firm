/**
 * CDD Report Generator
 * Generates Customer Due Diligence PDF reports for verified documents
 */

import PDFDocument from 'pdfkit';
import pool from '../config/database';

interface ReportData {
  verification: any;
  document: any;
  audit_trail: any[];
}

/**
 * Generate CDD Report PDF for a verification
 */
export async function generateCDDReport(verificationId: string): Promise<Buffer> {
  // Fetch verification data with document and audit trail
  const data = await fetchReportData(verificationId);
  
  if (!data) {
    throw new Error('Verification not found');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Generate report content
    generateReportContent(doc, data);
    
    doc.end();
  });
}

async function fetchReportData(verificationId: string): Promise<ReportData | null> {
  try {
    // Get verification with document details
    const verificationQuery = await pool.query(`
      SELECT 
        v.*,
        d.filename,
        d.uploaded_at,
        d.file_size,
        d.mime_type
      FROM verifications v
      JOIN documents d ON v.document_id = d.id
      WHERE v.id = $1
    `, [verificationId]);

    if (verificationQuery.rows.length === 0) {
      return null;
    }

    const verification = verificationQuery.rows[0];

    // Get audit trail
    const auditQuery = await pool.query(`
      SELECT *
      FROM audit_logs
      WHERE verification_id = $1
      ORDER BY created_at ASC
    `, [verificationId]);

    return {
      verification,
      document: {
        filename: verification.filename,
        uploaded_at: verification.uploaded_at,
        file_size: verification.file_size,
        mime_type: verification.mime_type,
      },
      audit_trail: auditQuery.rows,
    };
  } catch (error) {
    console.error('Error fetching report data:', error);
    throw error;
  }
}

function generateReportContent(doc: any, data: ReportData) {
  const { verification, document, audit_trail } = data;

  // Header
  doc
    .fontSize(24)
    .fillColor('#2563eb')
    .text('CUSTOMER DUE DILIGENCE REPORT', { align: 'center' })
    .moveDown(0.5);

  doc
    .fontSize(12)
    .fillColor('#666')
    .text('RPR CIS SCAN v1 - Document Verification System', { align: 'center' })
    .moveDown(1);

  // Report metadata
  doc
    .fontSize(10)
    .fillColor('#000')
    .text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'right' })
    .text(`Verification ID: ${verification.id}`, { align: 'right' })
    .moveDown(1);

  // Divider
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke()
    .moveDown(1);

  // Verification Status
  doc
    .fontSize(16)
    .fillColor('#000')
    .text('VERIFICATION STATUS', { underline: true })
    .moveDown(0.5);

  const statusColor = verification.verification_status === 'approved' ? '#10b981' 
                    : verification.verification_status === 'manual_review' ? '#f59e0b' 
                    : '#ef4444';

  doc
    .fontSize(14)
    .fillColor(statusColor)
    .text(`Status: ${verification.verification_status.toUpperCase().replace('_', ' ')}`)
    .fontSize(10)
    .fillColor('#000')
    .text(`Decision Date: ${new Date(verification.verification_date).toLocaleString()}`)
    .moveDown(0.5);

  if (verification.mismatch_reason) {
    doc
      .fontSize(10)
      .fillColor('#666')
      .text(`Reason: ${verification.mismatch_reason}`)
      .moveDown(0.5);
  }

  doc.moveDown(1);

  // Document Information
  doc
    .fontSize(16)
    .fillColor('#000')
    .text('DOCUMENT INFORMATION', { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .text(`Filename: ${document.filename}`)
    .text(`Upload Date: ${new Date(document.uploaded_at).toLocaleString()}`)
    .text(`File Size: ${formatFileSize(document.file_size)}`)
    .text(`Type: ${document.mime_type}`)
    .moveDown(1);

  // Extracted Entity Data
  doc
    .fontSize(16)
    .fillColor('#000')
    .text('EXTRACTED ENTITY DATA', { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .text(`ABN: ${verification.extracted_abn || 'Not extracted'}`)
    .text(`ACN: ${verification.extracted_acn || 'Not extracted'}`)
    .text(`Business Name: ${verification.extracted_business_name || 'Not extracted'}`)
    .text(`Address: ${verification.extracted_address || 'Not extracted'}`)
    .moveDown(1);

  // ABR Verified Data
  if (verification.abr_abn) {
    doc
      .fontSize(16)
      .fillColor('#000')
      .text('ABR VERIFIED DATA', { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .text(`ABN: ${verification.abr_abn}`)
      .text(`ACN: ${verification.abr_acn || 'N/A'}`)
      .text(`Business Name: ${verification.abr_business_name}`)
      .text(`Entity Status: ${verification.abr_entity_status}`)
      .text(`Entity Type: ${verification.abr_entity_type || 'N/A'}`)
      .moveDown(1);
  }

  // Trilogy Verification Checks
  doc
    .fontSize(16)
    .fillColor('#000')
    .text('TRILOGY VERIFICATION CHECKS', { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor('#000')
    .text(`Overall Result: ${verification.trilogy_check_passed ? '✓ PASSED' : '✕ FAILED'}`)
    .moveDown(0.5);

  // Page break if needed
  if (doc.y > 650) {
    doc.addPage();
  }

  // Audit Trail
  doc
    .fontSize(16)
    .fillColor('#000')
    .text('AUDIT TRAIL', { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(9)
    .fillColor('#666')
    .text('Complete verification decision history for compliance purposes')
    .moveDown(0.5);

  audit_trail.forEach((event, index) => {
    if (doc.y > 700) {
      doc.addPage();
    }

    doc
      .fontSize(10)
      .fillColor('#000')
      .text(`${index + 1}. ${event.event_type.toUpperCase().replace(/_/g, ' ')}`, { continued: false })
      .fontSize(8)
      .fillColor('#666')
      .text(`   Time: ${new Date(event.event_timestamp).toLocaleString()}`)
      .text(`   Result: ${event.decision_result}`)
      .text(`   Reason: ${event.decision_reason}`)
      .moveDown(0.3);
  });

  doc.moveDown(1);

  // Compliance Statement
  if (doc.y > 650) {
    doc.addPage();
  }

  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke()
    .moveDown(1);

  doc
    .fontSize(12)
    .fillColor('#000')
    .text('COMPLIANCE STATEMENT', { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(9)
    .fillColor('#000')
    .text('This Customer Due Diligence report has been generated by RPR CIS SCAN v1, an automated document verification system compliant with AUSTRAC Customer Due Diligence requirements.')
    .moveDown(0.5)
    .text('The trilogy verification system ensures ABN + ACN + Business Name exact matching with zero false positives.')
    .moveDown(0.5)
    .text('This report provides a complete audit trail suitable for regulatory compliance and can be retained for the required 7-year period.')
    .moveDown(1);

  // Footer
  doc
    .fontSize(8)
    .fillColor('#666')
    .text(`Report ID: ${verification.id}`, { align: 'center' })
    .text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' })
    .text('RPR CIS SCAN v1 - Trilogy Verification System', { align: 'center' });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Generate Individual CDD Report PDF for KYC verification
 * Includes all 3 verification points (identity, residence, bank) and discovered entities
 */
export async function generateIndividualCDDReport(individualId: string): Promise<Buffer> {
  const data = await fetchIndividualReportData(individualId);

  if (!data) {
    throw new Error('Individual not found');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Generate report content
    generateIndividualReportContent(doc, data);

    doc.end();
  });
}

interface IndividualReportData {
  individual: any;
  identity_document: any;
  residence_document: any;
  bank_verification: any;
  bank_documents: any[];
  linked_entities: any[];
}

async function fetchIndividualReportData(individualId: string): Promise<IndividualReportData | null> {
  try {
    // Get individual
    const individualQuery = await pool.query(`
      SELECT * FROM individuals WHERE id = $1
    `, [individualId]);

    if (individualQuery.rows.length === 0) {
      return null;
    }

    const individual = individualQuery.rows[0];

    // Get identity document
    const identityQuery = await pool.query(`
      SELECT * FROM identity_documents
      WHERE individual_id = $1
      ORDER BY uploaded_at DESC
      LIMIT 1
    `, [individualId]);

    // Get residence document
    const residenceQuery = await pool.query(`
      SELECT * FROM residence_documents
      WHERE individual_id = $1
      ORDER BY uploaded_at DESC
      LIMIT 1
    `, [individualId]);

    // Get bank verification
    const bankVerificationQuery = await pool.query(`
      SELECT * FROM bank_verifications
      WHERE individual_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [individualId]);

    // Get bank documents
    const bankDocsQuery = await pool.query(`
      SELECT * FROM bank_verification_documents
      WHERE individual_id = $1
      ORDER BY uploaded_at ASC
    `, [individualId]);

    // Get linked entities
    const entitiesQuery = await pool.query(`
      SELECT 
        iel.*,
        v.abr_abn,
        v.abr_business_name,
        v.abr_entity_status
      FROM individual_entity_links iel
      JOIN verifications v ON v.id = iel.verification_id
      WHERE iel.individual_id = $1
      ORDER BY iel.is_primary_entity DESC, iel.created_at ASC
    `, [individualId]);

    return {
      individual,
      identity_document: identityQuery.rows[0] || null,
      residence_document: residenceQuery.rows[0] || null,
      bank_verification: bankVerificationQuery.rows[0] || null,
      bank_documents: bankDocsQuery.rows,
      linked_entities: entitiesQuery.rows,
    };
  } catch (error) {
    console.error('Error fetching individual report data:', error);
    throw error;
  }
}

function generateIndividualReportContent(doc: any, data: IndividualReportData) {
  const { individual, identity_document, residence_document, bank_verification, bank_documents, linked_entities } = data;

  // Header
  doc
    .fontSize(24)
    .fillColor('#2563eb')
    .text('INDIVIDUAL KYC CDD REPORT', { align: 'center' })
    .moveDown(0.5);

  doc
    .fontSize(12)
    .fillColor('#666')
    .text('RPR CIS SCAN v2 - Hybrid Individual KYC + Business Entity Verification', { align: 'center' })
    .moveDown(1);

  // Report metadata
  doc
    .fontSize(10)
    .fillColor('#000')
    .text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'right' })
    .text(`Individual ID: ${individual.id}`, { align: 'right' })
    .moveDown(1);

  // Divider
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke()
    .moveDown(1);

  // Individual Information
  doc
    .fontSize(16)
    .fillColor('#000')
    .text('INDIVIDUAL INFORMATION', { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .text(`Full Name: ${individual.full_name}`)
    .text(`Date of Birth: ${new Date(individual.dob).toLocaleDateString()}`)
    .text(`Address: ${individual.residential_address}`)
    .text(`Postcode: ${individual.postcode}`)
    .text(`Verification Status: ${individual.verification_status.toUpperCase()}`)
    .moveDown(1);

  // Three-Point Verification Status
  doc
    .fontSize(16)
    .fillColor('#000')
    .text('THREE-POINT VERIFICATION STATUS', { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor(individual.identity_verified ? '#10b981' : '#ef4444')
    .text(`1. Identity: ${individual.identity_verified ? '✓ VERIFIED' : '✕ NOT VERIFIED'}`)
    .fillColor(individual.residence_verified ? '#10b981' : '#ef4444')
    .text(`2. Residence: ${individual.residence_verified ? '✓ VERIFIED' : '✕ NOT VERIFIED'}`)
    .fillColor(individual.bank_verified ? '#10b981' : '#ef4444')
    .text(`3. Bank Account: ${individual.bank_verified ? '✓ VERIFIED' : '✕ NOT VERIFIED'}`)
    .fillColor('#000')
    .moveDown(1);

  // Identity Verification Details
  if (identity_document) {
    if (doc.y > 650) doc.addPage();
    doc
      .fontSize(14)
      .fillColor('#000')
      .text('IDENTITY VERIFICATION', { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .text(`Document Type: ${identity_document.document_type}`)
      .text(`Document Number: ${identity_document.document_number || 'N/A'}`)
      .text(`OCR Confidence: ${(identity_document.ocr_confidence * 100).toFixed(0)}%`)
      .text(`Verification Passed: ${identity_document.verification_passed ? 'Yes' : 'No'}`)
      .moveDown(1);
  }

  // Residence Verification Details
  if (residence_document) {
    if (doc.y > 650) doc.addPage();
    doc
      .fontSize(14)
      .fillColor('#000')
      .text('RESIDENCE VERIFICATION', { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .text(`Document Type: ${residence_document.document_type}`)
      .text(`Issuer: ${residence_document.issuer || 'N/A'}`)
      .text(`Address Match: ${residence_document.address_match ? 'Yes' : 'No'}`)
      .text(`Fuzzy Match Score: ${(residence_document.fuzzy_match_score * 100).toFixed(1)}%`)
      .text(`Document Age: ${residence_document.document_age_days} days`)
      .moveDown(1);
  }

  // Bank Verification Details
  if (bank_verification) {
    if (doc.y > 650) doc.addPage();
    doc
      .fontSize(14)
      .fillColor('#000')
      .text('BANK VERIFICATION', { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .text(`Account Holder: ${bank_verification.account_holder_name}`)
      .text(`BSB: ${bank_verification.bsb || 'N/A'}`)
      .text(`Account Number: ${bank_verification.account_number ? '***' + bank_verification.account_number.slice(-4) : 'N/A'}`)
      .text(`Bank: ${bank_verification.bank_name || 'N/A'}`)
      .text(`Documents Processed: ${bank_verification.documents_count}`)
      .text(`Confidence Score: ${bank_verification.overall_confidence_score}/100`)
      .text(`Confidence Level: ${bank_verification.confidence_level}`)
      .moveDown(0.5);

    if (bank_verification.matched_entity_abn) {
      doc
        .fillColor('#10b981')
        .text(`Matched Entity ABN: ${bank_verification.matched_entity_abn}`)
        .text(`Entity Match Confidence: ${(bank_verification.entity_match_confidence * 100).toFixed(0)}%`)
        .fillColor('#000');
    }

    doc.moveDown(1);
  }

  // Discovered Entities
  if (linked_entities.length > 0) {
    if (doc.y > 650) doc.addPage();
    doc
      .fontSize(14)
      .fillColor('#000')
      .text('DISCOVERED BUSINESS ENTITIES', { underline: true })
      .moveDown(0.5);

    linked_entities.forEach((entity, index) => {
      if (doc.y > 700) doc.addPage();
      doc
        .fontSize(10)
        .fillColor(entity.is_primary_entity ? '#10b981' : '#000')
        .text(`${index + 1}. ${entity.abr_business_name} ${entity.is_primary_entity ? '(PRIMARY)' : ''}`)
        .fillColor('#666')
        .fontSize(9)
        .text(`   ABN: ${entity.abr_abn}`)
        .text(`   Status: ${entity.abr_entity_status}`)
        .text(`   Link Source: ${entity.link_source}`)
        .fillColor('#000')
        .moveDown(0.5);
    });

    doc.moveDown(1);
  }

  // AUSTRAC Compliance Statement
  if (doc.y > 650) doc.addPage();
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke()
    .moveDown(1);

  doc
    .fontSize(12)
    .fillColor('#000')
    .text('AUSTRAC COMPLIANCE STATEMENT', { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(9)
    .fillColor('#000')
    .text('This Customer Due Diligence report has been generated by RPR CIS SCAN v2, a hybrid Individual KYC + Business Entity Verification system compliant with AUSTRAC Customer Due Diligence requirements.')
    .moveDown(0.5)
    .text('The three-point verification system (Identity → Residence → Bank Account) ensures comprehensive individual verification with automatic business entity discovery.')
    .moveDown(0.5)
    .text('This report provides a complete audit trail suitable for regulatory compliance and will be retained for the required 7-year period.')
    .moveDown(0.5)
    .text(`Data Retention: ${individual.retention_until ? new Date(individual.retention_until).toLocaleDateString() : 'N/A'}`)
    .moveDown(1);

  // Footer
  doc
    .fontSize(8)
    .fillColor('#666')
    .text(`Report ID: ${individual.id}`, { align: 'center' })
    .text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' })
    .text('RPR CIS SCAN v2 - Hybrid Individual KYC + Business Entity Verification', { align: 'center' });
}

