/**
 * Manual Review Queue Route
 * GET /api/kyc/review-queue - List pending reviews
 * POST /api/kyc/review/:review_id/assign - Assign reviewer
 * POST /api/kyc/review/:review_id/complete - Submit decision
 */

import { Router, Request, Response } from 'express';
import { getReviewQueue, assignReview, completeReview, checkSLABreaches } from '../../services/manual-review';
import { generalApiLimiter } from '../../middleware/rate-limiter';

const router = Router();

/**
 * GET /api/kyc/review-queue
 * 
 * Get list of reviews in queue
 * Query params:
 *   - status: 'pending' | 'in_progress' | 'completed'
 *   - assigned_to: filter by assignee email
 */
router.get('/review-queue', generalApiLimiter, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as 'pending' | 'in_progress' | 'completed' | undefined;
    const assignedTo = req.query.assigned_to as string | undefined;

    const queue = await getReviewQueue(status, assignedTo);

    // Check for SLA breaches
    const breaches = await checkSLABreaches();

    return res.status(200).json({
      success: true,
      reviews: queue,
      total: queue.length,
      sla_breaches: breaches.length,
      breaches: breaches,
    });
  } catch (error: any) {
    console.error('Error fetching review queue:', error);
    return res.status(500).json({
      error: 'Failed to fetch review queue',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/kyc/review/:review_id/assign
 * 
 * Assign a review to an accountant
 */
router.post('/review/:review_id/assign', generalApiLimiter, async (req: Request, res: Response) => {
  try {
    const { review_id } = req.params;
    const { accountant_email } = req.body;

    if (!accountant_email) {
      return res.status(400).json({
        error: 'Missing required field',
        required: ['accountant_email'],
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(accountant_email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    await assignReview(review_id, accountant_email);

    return res.status(200).json({
      success: true,
      message: 'Review assigned successfully',
      review_id,
      assigned_to: accountant_email,
    });
  } catch (error: any) {
    console.error('Error assigning review:', error);
    return res.status(500).json({
      error: 'Failed to assign review',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/kyc/review/:review_id/complete
 * 
 * Submit review decision
 */
router.post('/review/:review_id/complete', generalApiLimiter, async (req: Request, res: Response) => {
  try {
    const { review_id } = req.params;
    const { decision, decision_reason, notes } = req.body;

    if (!decision || !decision_reason) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['decision', 'decision_reason'],
      });
    }

    if (!['approved', 'rejected', 'request_more_info'].includes(decision)) {
      return res.status(400).json({
        error: 'Invalid decision',
        valid_choices: ['approved', 'rejected', 'request_more_info'],
      });
    }

    await completeReview(review_id, decision, decision_reason, notes);

    return res.status(200).json({
      success: true,
      message: 'Review completed successfully',
      review_id,
      decision,
    });
  } catch (error: any) {
    console.error('Error completing review:', error);
    return res.status(500).json({
      error: 'Failed to complete review',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

export default router;

