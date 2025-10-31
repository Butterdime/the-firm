import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../src/config/database';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total_verifications,
        COUNT(*) FILTER (WHERE verification_status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE verification_status = 'manual_review') AS manual_review_count,
        COUNT(*) FILTER (WHERE verification_status = 'rejected') AS rejected_count,
        ROUND(COUNT(*) FILTER (WHERE trilogy_check_passed = TRUE) * 100.0 / COUNT(*), 2) AS approval_rate,
        ROUND(COUNT(*) FILTER (WHERE requires_manual_review = TRUE) * 100.0 / COUNT(*), 2) AS manual_review_rate,
        COUNT(*) FILTER (WHERE trilogy_check_passed = TRUE) AS trilogy_passed_count,
        COUNT(*) FILTER (WHERE requires_manual_review = TRUE) AS needs_review_count
      FROM verifications;
    `);

    const summary = result.rows[0];
    summary.approval_rate = parseFloat(summary.approval_rate || 0);
    summary.manual_review_rate = parseFloat(summary.manual_review_rate || 0);

    res.status(200).json(summary);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
}
