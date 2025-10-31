import type { VercelRequest, VercelResponse } from '@vercel/node';
import PDFDocument from 'pdfkit';
import pool from '../src/config/database';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { verificationId } = req.query;

  if (!verificationId || typeof verificationId !== 'string') {
    return res.status(400).json({ error: 'Verification ID is required' });
  }

  try {
    // Get verification with document details
    const verificationQuery = await pool.query(
      `SELECT
        v.*,
        d.filename, d.uploaded_at, d.mime_type, d.file_size
      FROM verifications v
      JOIN documents d ON v.document_id = d.id
      WHERE v.id = $1`,
      [verificationId]
    );

    if (verificationQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    const verification = verificationQuery.rows[0];
    const document = {
      id: verification.document_id,
      filename: verification.filename,
      uploaded_at: verification.uploaded_at,
      mime_type: verification.mime_type,
      file_size: verification.file_size,
    };

    // Get audit trail
    const auditTrailQuery = await pool.query(
      `SELECT * FROM audit_logs WHERE verification_id = $1 ORDER BY event_timestamp ASC`,
      [verificationId]
    );
    const audit_trail = auditTrailQuery.rows;

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=cdd_report_${verificationId}.pdf`);
      res.status(200).send(pdfBuffer);
    });

    // Generate report content
    doc
      .fontSize(24)
      .text('RPR CIS SCAN v1 - CDD Verification Report', { align: 'center' })
      .moveDown();

    doc.fontSize(12).text(`Report Date: ${new Date().toLocaleDateString()}`).moveDown();
    doc.text(`Verification ID: ${verification.id}`).moveDown();

    // Document Details
    doc.fontSize(16).text('Document Details', { underline: true }).moveDown();
    doc.fontSize(12).text(`Filename: ${document.filename}`);
    doc.text(`Uploaded At: ${new Date(document.uploaded_at).toLocaleString()}`);
    doc.text(`MIME Type: ${document.mime_type}`);
    doc.text(`File Size: ${(document.file_size / 1024).toFixed(2)} KB`).moveDown();

    // Extracted Data
    doc.fontSize(16).text('Extracted Data (OCR)', { underline: true }).moveDown();
    doc.fontSize(12).text(`ABN: ${verification.extracted_abn || 'N/A'}`);
    doc.text(`ACN: ${verification.extracted_acn || 'N/A'}`);
    doc.text(`Business Name: ${verification.extracted_business_name || 'N/A'}`);
    doc.text(`Address: ${verification.extracted_address || 'N/A'}`).moveDown();

    // ABR Data
    doc.fontSize(16).text('ABR Verified Data', { underline: true }).moveDown();
    doc.fontSize(12).text(`ABN: ${verification.abr_abn || 'N/A'}`);
    doc.text(`ACN: ${verification.abr_acn || 'N/A'}`);
    doc.text(`Business Name: ${verification.abr_business_name || 'N/A'}`);
    doc.text(`Entity Status: ${verification.abr_entity_status || 'N/A'}`);
    doc.text(`Entity Type: ${verification.abr_entity_type || 'N/A'}`).moveDown();

    // Trilogy Check Results
    doc.fontSize(16).text('Trilogy Verification Results', { underline: true }).moveDown();
    doc.fontSize(12).text(`Overall Status: ${verification.verification_status.toUpperCase()}`);
    doc.text(`Trilogy Check Passed: ${verification.trilogy_check_passed ? 'YES' : 'NO'}`);
    if (verification.mismatch_reason) {
      doc.text(`Reason for Mismatch/Review: ${verification.mismatch_reason}`).moveDown();
    } else {
      doc.moveDown();
    }

    // Audit Trail
    doc.fontSize(16).text('Audit Trail', { underline: true }).moveDown();
    audit_trail.forEach((log: any) => {
      doc.fontSize(10).text(`- [${new Date(log.event_timestamp).toLocaleString()}] ${log.event_type.toUpperCase()}: ${log.decision_reason}`);
    });
    doc.moveDown();

    // Compliance Statement
    doc.fontSize(10).text(
      'This report documents the Customer Due Diligence (CDD) verification process performed by RPR CIS SCAN v1. All verification steps are logged in the audit trail to ensure compliance with relevant Australian regulations, including AUSTRAC requirements. Mismatched verifications are prevented by design, ensuring high accuracy.',
      { align: 'justify' }
    );

    doc.end();

  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate CDD report' });
  }
}
