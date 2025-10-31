/**
 * KYC Reports Route
 * GET /api/kyc/cdd-report/:individual_id
 * Generate CDD report for individual KYC verification
 */

import { Router, Request, Response } from 'express';
import { generateIndividualCDDReport } from '../../lib/report-generator';
import { generalApiLimiter } from '../../middleware/rate-limiter';

const router = Router();

/**
 * GET /api/kyc/cdd-report/:individual_id
 * 
 * Generate and download CDD Report PDF for an individual
 * 
 * Response: PDF file download
 */
router.get('/cdd-report/:individual_id', generalApiLimiter, async (req: Request, res: Response) => {
  try {
    const { individual_id } = req.params;

    if (!individual_id) {
      return res.status(400).json({
        error: 'Individual ID is required',
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

    // Generate PDF report
    const pdfBuffer = await generateIndividualCDDReport(individual_id);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CDD_Report_Individual_${individual_id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    // Send PDF
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Error generating individual CDD report:', error);

    if (error.message === 'Individual not found') {
      return res.status(404).json({
        error: 'Individual not found',
        message: 'The specified individual ID does not exist',
      });
    }

    return res.status(500).json({
      error: 'Failed to generate report',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

export default router;

