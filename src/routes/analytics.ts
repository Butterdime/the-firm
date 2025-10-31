import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

/**
 * GET /api/analytics/summary
 * Get overall verification statistics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_verifications,
        COUNT(CASE WHEN verification_status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN verification_status = 'manual_review' THEN 1 END) as manual_review_count,
        COUNT(CASE WHEN verification_status = 'rejected' THEN 1 END) as rejected_count,
        ROUND(
          COUNT(CASE WHEN verification_status = 'approved' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as approval_rate,
        ROUND(
          COUNT(CASE WHEN verification_status = 'manual_review' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as manual_review_rate,
        COUNT(CASE WHEN trilogy_check_passed = true THEN 1 END) as trilogy_passed_count,
        COUNT(CASE WHEN requires_manual_review = true THEN 1 END) as needs_review_count
      FROM verifications
    `);

    const stats = result.rows[0];

    res.json({
      total_verifications: parseInt(stats.total_verifications) || 0,
      approved_count: parseInt(stats.approved_count) || 0,
      manual_review_count: parseInt(stats.manual_review_count) || 0,
      rejected_count: parseInt(stats.rejected_count) || 0,
      approval_rate: parseFloat(stats.approval_rate) || 0,
      manual_review_rate: parseFloat(stats.manual_review_rate) || 0,
      trilogy_passed_count: parseInt(stats.trilogy_passed_count) || 0,
      needs_review_count: parseInt(stats.needs_review_count) || 0,
    });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics summary',
    });
  }
});

/**
 * GET /api/analytics/timeline
 * Get verification counts by date
 */
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const daysInt = parseInt(days as string);

    const result = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_count,
        COUNT(CASE WHEN verification_status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN verification_status = 'manual_review' THEN 1 END) as manual_review_count,
        COUNT(CASE WHEN verification_status = 'rejected' THEN 1 END) as rejected_count
      FROM verifications
      WHERE created_at >= CURRENT_DATE - INTERVAL '${daysInt} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({
      timeline: result.rows.map(row => ({
        date: row.date,
        total_count: parseInt(row.total_count),
        approved_count: parseInt(row.approved_count),
        manual_review_count: parseInt(row.manual_review_count),
        rejected_count: parseInt(row.rejected_count),
      })),
    });
  } catch (error) {
    console.error('Error fetching timeline data:', error);
    res.status(500).json({
      error: 'Failed to fetch timeline data',
    });
  }
});

/**
 * GET /api/analytics/failure-reasons
 * Get most common mismatch reasons
 */
router.get('/failure-reasons', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        mismatch_reason,
        COUNT(*) as count,
        ROUND(
          COUNT(*)::numeric / 
          (SELECT COUNT(*) FROM verifications WHERE mismatch_reason IS NOT NULL)::numeric * 100,
          2
        ) as percentage
      FROM verifications
      WHERE mismatch_reason IS NOT NULL
      GROUP BY mismatch_reason
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      failure_reasons: result.rows.map(row => ({
        reason: row.mismatch_reason,
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage) || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching failure reasons:', error);
    res.status(500).json({
      error: 'Failed to fetch failure reasons',
    });
  }
});

/**
 * GET /api/analytics/recent
 * Get recent verifications
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    const limitInt = parseInt(limit as string);

    const result = await pool.query(`
      SELECT 
        v.id,
        v.verification_status,
        v.extracted_business_name,
        v.extracted_abn,
        v.trilogy_check_passed,
        v.created_at,
        d.filename
      FROM verifications v
      JOIN documents d ON v.document_id = d.id
      ORDER BY v.created_at DESC
      LIMIT $1
    `, [limitInt]);

    res.json({
      recent_verifications: result.rows.map(row => ({
        id: row.id,
        status: row.verification_status,
        business_name: row.extracted_business_name || 'Unknown',
        abn: row.extracted_abn || 'N/A',
        trilogy_passed: row.trilogy_check_passed,
        created_at: row.created_at,
        filename: row.filename,
      })),
    });
  } catch (error) {
    console.error('Error fetching recent verifications:', error);
    res.status(500).json({
      error: 'Failed to fetch recent verifications',
    });
  }
});

export default router;

