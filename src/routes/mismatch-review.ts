// src/routes/mismatch-review.ts
/**
 * Mismatch Review API Routes
 * Handles verification analysis, manual review, and approval workflow
 */

import express, { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import {
  analyzeMismatches,
  VerificationData,
  MismatchResult,
} from '../lib/mismatch-detection';

const router: Router = express.Router();

// Inject database pool from main app
let dbPool: Pool;

export function setDbPool(pool: Pool) {
  dbPool = pool;
}

/**
 * POST /mismatch/analyze
 * Analyze extracted data against registry for mismatches
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { sessionId, documentData, registryData, abnData } = req.body;

    // Validation
    if (!sessionId || !documentData || !registryData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, documentData, registryData',
      });
    }

    // Run mismatch analysis
    const analysis = analyzeMismatches(
      sessionId,
      documentData as VerificationData,
      registryData as VerificationData,
      abnData
    );

    // Store report in database
    const result = await dbPool.query(
      `INSERT INTO verification_reports
       (session_id, risk_score, risk_level, mismatch_count, requires_manual_review, can_proceed_to_cis)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        sessionId,
        analysis.riskScore,
        analysis.riskLevel,
        analysis.mismatches.length,
        analysis.requiresManualReview,
        analysis.canProceedToCIS,
      ]
    );

    const reportId = result.rows[0].id;

    // Store individual mismatches
    for (const mismatch of analysis.mismatches) {
      await dbPool.query(
        `INSERT INTO verification_mismatches
         (verification_report_id, field_name, extracted_value, registry_value, match_score, severity, recommendation)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          reportId,
          mismatch.field,
          mismatch.extracted,
          mismatch.registry,
          mismatch.matchScore,
          mismatch.severity,
          mismatch.recommendation,
        ]
      );
    }

    // Log to audit trail
    await dbPool.query(
      `INSERT INTO verification_audit_log (session_id, action, details)
       VALUES ($1, $2, $3)`,
      [
        sessionId,
        'verification_analysis_complete',
        JSON.stringify({
          riskScore: analysis.riskScore,
          riskLevel: analysis.riskLevel,
          mismatchCount: analysis.mismatches.length,
        }),
      ]
    );

    // Update CIS session
    await dbPool.query(
      `UPDATE cis_sessions
       SET verification_report_id = $1,
           verification_status = $2,
           final_risk_score = $3
       WHERE id = $4`,
      [
        reportId,
        analysis.canProceedToCIS ? 'passed' : 'manual_review',
        analysis.riskScore,
        sessionId,
      ]
    );

    return res.status(200).json({
      success: true,
      analysis,
      reportId,
      nextAction: analysis.canProceedToCIS
        ? 'Ready for CIS generation'
        : 'Requires manual review',
    });
  } catch (error) {
    console.error('Mismatch analysis error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

/**
 * GET /mismatch/report/:sessionId
 * Retrieve verification report for a session
 */
router.get('/report/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Get verification report
    const reportResult = await dbPool.query(
      `SELECT * FROM verification_reports WHERE session_id = $1`,
      [sessionId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Verification report not found',
      });
    }

    const report = reportResult.rows[0];

    // Get mismatches
    const mismatchesResult = await dbPool.query(
      `SELECT * FROM verification_mismatches WHERE verification_report_id = $1`,
      [report.id]
    );

    const mismatches = mismatchesResult.rows;

    return res.status(200).json({
      success: true,
      report: {
        ...report,
        mismatches,
      },
    });
  } catch (error) {
    console.error('Report retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Retrieval failed',
    });
  }
});

/**
 * POST /mismatch/approve/:sessionId
 * Manually approve a verification despite mismatches
 */
router.post('/approve/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { notes, reviewedBy, ipAddress } = req.body;

    // Get report
    const reportResult = await dbPool.query(
      `SELECT id FROM verification_reports WHERE session_id = $1`,
      [sessionId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Verification report not found',
      });
    }

    const reportId = reportResult.rows[0].id;

    // Update report status
    await dbPool.query(
      `UPDATE verification_reports
       SET review_status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE id = $4`,
      ['approved', reviewedBy || 'system', notes || '', reportId]
    );

    // Update CIS session
    await dbPool.query(
      `UPDATE cis_sessions
       SET verification_status = $1
       WHERE id = $2`,
      ['passed', sessionId]
    );

    // Log to audit
    await dbPool.query(
      `INSERT INTO verification_audit_log (session_id, action, actor, new_value, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, 'manual_approval', reviewedBy || 'system', 'approved', ipAddress]
    );

    return res.status(200).json({
      success: true,
      message: 'Verification approved. Ready for CIS generation.',
    });
  } catch (error) {
    console.error('Approval error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Approval failed',
    });
  }
});

/**
 * POST /mismatch/reject/:sessionId
 * Reject a verification and request resubmission
 */
router.post('/reject/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { reason, reviewedBy, ipAddress } = req.body;

    // Get report
    const reportResult = await dbPool.query(
      `SELECT id FROM verification_reports WHERE session_id = $1`,
      [sessionId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Verification report not found',
      });
    }

    const reportId = reportResult.rows[0].id;

    // Update report status
    await dbPool.query(
      `UPDATE verification_reports
       SET review_status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE id = $4`,
      ['rejected', reviewedBy || 'system', reason || 'Critical mismatches detected', reportId]
    );

    // Update CIS session
    await dbPool.query(
      `UPDATE cis_sessions
       SET verification_status = $1
       WHERE id = $2`,
      ['failed', sessionId]
    );

    // Log to audit
    await dbPool.query(
      `INSERT INTO verification_audit_log (session_id, action, actor, new_value, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, 'manual_rejection', reviewedBy || 'system', 'rejected', ipAddress]
    );

    return res.status(200).json({
      success: true,
      message: 'Verification rejected. Customer must resubmit documents.',
    });
  } catch (error) {
    console.error('Rejection error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Rejection failed',
    });
  }
});

/**
 * GET /mismatch/dashboard
 * Get dashboard statistics for verification monitoring
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const dashResult = await dbPool.query(
      `SELECT * FROM verification_dashboard ORDER BY created_at DESC LIMIT 100`
    );

    const stats = await dbPool.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN risk_level = 'clear' THEN 1 ELSE 0 END) as clear,
        SUM(CASE WHEN risk_level = 'low_risk' THEN 1 ELSE 0 END) as low_risk,
        SUM(CASE WHEN risk_level = 'medium_risk' THEN 1 ELSE 0 END) as medium_risk,
        SUM(CASE WHEN risk_level = 'high_risk' THEN 1 ELSE 0 END) as high_risk,
        SUM(CASE WHEN risk_level = 'critical_risk' THEN 1 ELSE 0 END) as critical_risk
       FROM verification_reports
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );

    return res.status(200).json({
      success: true,
      recentReports: dashResult.rows,
      dailyStats: stats.rows,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Dashboard retrieval failed',
    });
  }
});

/**
 * GET /mismatch/pending
 * Get all verifications pending manual review
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const result = await dbPool.query(
      `SELECT vr.*, cs.customer_name, cs.customer_email
       FROM verification_reports vr
       JOIN cis_sessions cs ON vr.session_id = cs.id
       WHERE vr.requires_manual_review = true
       AND vr.review_status = 'pending'
       ORDER BY vr.risk_score DESC, vr.created_at ASC`
    );

    return res.status(200).json({
      success: true,
      pendingReviews: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Pending reviews error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
    });
  }
});

/**
 * GET /mismatch/audit-log/:sessionId
 * Get complete audit trail for a session
 */
router.get('/audit-log/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const result = await dbPool.query(
      `SELECT * FROM verification_audit_log
       WHERE session_id = $1
       ORDER BY created_at DESC`,
      [sessionId]
    );

    return res.status(200).json({
      success: true,
      auditTrail: result.rows,
    });
  } catch (error) {
    console.error('Audit log error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
    });
  }
});

export default router;
