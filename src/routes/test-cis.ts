import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import pool from '../config/database';

const router = Router();

/**
 * POST /api/test-generate-cis
 * 
 * Test endpoint that creates an approved verification and generates CIS in one step.
 * This bypasses the document upload verification flow for testing purposes.
 */
router.post('/test-generate-cis', async (req: Request, res: Response) => {
  const { 
    client_name, 
    client_address, 
    relationship_start_date,
    entity_name,
    entity_abn,
    entity_acn
  } = req.body;

  try {
    // Validate required fields
    if (!client_name || !client_address || !relationship_start_date || !entity_name || !entity_abn) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['client_name', 'client_address', 'relationship_start_date', 'entity_name', 'entity_abn']
      });
    }

    console.log('🧪 TEST: Creating approved verification and generating CIS...');

    // Step 1: Create an approved verification in the database
    const verificationResult = await pool.query(
      `INSERT INTO verifications (
        extracted_abn,
        extracted_acn,
        extracted_business_name,
        abr_abn,
        abr_acn,
        abr_business_name,
        abr_entity_status,
        abr_entity_type,
        abr_response_raw,
        trilogy_check_passed,
        verification_status,
        verification_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING id`,
      [
        entity_abn,
        entity_acn || null,
        entity_name,
        entity_abn,
        entity_acn || null,
        entity_name,
        'Active',
        'Australian Private Company',
        JSON.stringify({
          test: true,
          abn: entity_abn,
          acn: entity_acn,
          business_name: entity_name,
          generated_for: 'test_cis'
        }),
        true, // trilogy_check_passed
        'approved' // verification_status
      ]
    );

    const verificationId = verificationResult.rows[0].id;
    console.log('✅ Test verification created:', verificationId);

    // Step 2: Generate the PDF
    const pdfBuffer = await generateCISPDF({
      client_name,
      client_address,
      relationship_start_date,
      entity_name,
      entity_abn,
      entity_acn: entity_acn || 'N/A',
      entity_status: 'Active',
      entity_type: 'Australian Private Company',
      verification_id: verificationId
    });

    console.log('✅ PDF generated, size:', pdfBuffer.length, 'bytes');

    // Step 3: Store in database
    const cisResult = await pool.query(
      `INSERT INTO cis_documents (
        verification_id,
        client_name,
        client_address,
        relationship_start_date,
        entity_abn,
        entity_acn,
        entity_name,
        entity_type,
        entity_status,
        document_content,
        document_filename,
        document_format,
        generation_status,
        austrac_cdd_compliant,
        austrac_retention_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING cis_id, generated_at, expires_at`,
      [
        verificationId,
        client_name,
        client_address,
        relationship_start_date,
        entity_abn,
        entity_acn || null,
        entity_name,
        'Australian Private Company',
        'Active',
        pdfBuffer,
        `CIS_${client_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
        'PDF',
        'completed',
        true,
        true
      ]
    );

    const cisDoc = cisResult.rows[0];
    console.log('✅ CIS document stored:', cisDoc.cis_id);

    // Return the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CIS_${client_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);

    console.log('✅ PDF sent to client');

  } catch (error: any) {
    console.error('❌ Test CIS generation error:', error);
    res.status(500).json({
      error: 'Failed to generate test CIS',
      details: error.message
    });
  }
});

/**
 * Generate CIS PDF
 */
async function generateCISPDF(data: {
  client_name: string;
  client_address: string;
  relationship_start_date: string;
  entity_name: string;
  entity_abn: string;
  entity_acn: string;
  entity_status: string;
  entity_type: string;
  verification_id: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Colors
      const primaryNavy = '#002B5B';
      const accentTeal = '#00A896';
      const coolGray = '#6B7280';

      // Header
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor(primaryNavy)
        .text('CUSTOMER INFORMATION SHEET', { align: 'center' });

      doc.moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(coolGray)
        .text('AUSTRAC Compliant CDD Report', { align: 'center' });

      doc.moveDown(1);

      // Horizontal line
      doc
        .strokeColor(accentTeal)
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown(1.5);

      // Client Information Section
      addSection(doc, 'CLIENT INFORMATION', [
        { label: 'Client Name', value: data.client_name },
        { label: 'Client Address', value: data.client_address },
        { label: 'Relationship Start Date', value: data.relationship_start_date },
      ]);

      doc.moveDown(1);

      // Entity Information Section
      addSection(doc, 'VERIFIED ENTITY INFORMATION', [
        { label: 'Business Name', value: data.entity_name },
        { label: 'ABN', value: data.entity_abn },
        { label: 'ACN', value: data.entity_acn },
        { label: 'Entity Type', value: data.entity_type },
        { label: 'Entity Status', value: data.entity_status },
      ]);

      doc.moveDown(1);

      // Verification Details Section
      addSection(doc, 'VERIFICATION DETAILS', [
        { label: 'Verification ID', value: data.verification_id },
        { label: 'Verification Date', value: new Date().toISOString().split('T')[0] },
        { label: 'Verification Status', value: 'APPROVED' },
        { label: 'Verification Method', value: 'Trilogy Verification (ABN + ACN + Business Name)' },
      ]);

      doc.moveDown(1);

      // Compliance Section
      addSection(doc, 'AUSTRAC COMPLIANCE', [
        { label: 'CDD Compliant', value: '✓ Yes' },
        { label: 'Document Retention', value: '7 Years (as per AUSTRAC requirements)' },
        { label: 'Generated', value: new Date().toLocaleString('en-AU') },
        { label: 'Expires', value: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000).toLocaleString('en-AU') },
      ]);

      // Footer
      doc.moveDown(3);
      doc
        .fontSize(8)
        .fillColor(coolGray)
        .text(
          'This document has been generated in compliance with AUSTRAC Customer Due Diligence (CDD) requirements. ' +
          'It contains verified information from the Australian Business Register (ABR) and must be retained for 7 years.',
          { align: 'center' }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Helper: Add formatted section to PDF
 */
function addSection(doc: PDFKit.PDFDocument, title: string, fields: { label: string; value: string }[]) {
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#00A896')
    .text(title);

  doc.moveDown(0.5);

  fields.forEach(field => {
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#002B5B')
      .text(field.label + ':', { continued: true })
      .font('Helvetica')
      .fillColor('#374151')
      .text(' ' + field.value);
    
    doc.moveDown(0.3);
  });
}

export default router;

