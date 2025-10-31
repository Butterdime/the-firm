import { Router, Request, Response } from 'express';
import { generateCDDReport } from '../lib/report-generator';

const router = Router();

/**
 * GET /api/reports/:verification_id
 * Generate and download CDD Report PDF
 */
router.get('/:verification_id', async (req: Request, res: Response) => {
  try {
    const { verification_id } = req.params;

    if (!verification_id) {
      return res.status(400).json({
        error: 'Verification ID is required',
      });
    }

    // Generate PDF report
    const pdfBuffer = await generateCDDReport(verification_id);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CDD_Report_${verification_id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Error generating report:', error);
    
    if (error.message === 'Verification not found') {
      return res.status(404).json({
        error: 'Verification not found',
      });
    }

    res.status(500).json({
      error: 'Failed to generate report',
      message: error.message,
    });
  }
});

export default router;

