/**
 * Manual Review Queue Service
 * Manages cases requiring human review with SLA tracking
 */

import pool from '../config/database';

export interface ReviewQueueItem {
  id: string;
  individual_id: string;
  review_reason: string;
  review_priority: 'urgent' | 'normal' | 'low';
  confidence_score: number | null;
  assigned_to: string | null;
  queued_at: Date;
  due_at: Date;
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Queue an individual for manual review
 */
export async function queueForReview(
  individualId: string,
  reason: string,
  priority: 'urgent' | 'normal' | 'low' = 'normal',
  confidenceScore?: number
): Promise<string> {
  // Check if already queued
  const existing = await pool.query(`
    SELECT id FROM manual_review_queue
    WHERE individual_id = $1 AND status IN ('pending', 'in_progress')
  `, [individualId]);

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Create new review queue entry
  const result = await pool.query(`
    INSERT INTO manual_review_queue (
      individual_id, review_reason, review_priority, confidence_score
    ) VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [individualId, reason, priority, confidenceScore || null]);

  return result.rows[0].id;
}

/**
 * Assign review to an accountant
 */
export async function assignReview(
  reviewId: string,
  accountantEmail: string
): Promise<void> {
  await pool.query(`
    UPDATE manual_review_queue
    SET assigned_to = $1,
        assigned_at = NOW(),
        status = 'in_progress'
    WHERE id = $2
  `, [accountantEmail, reviewId]);
}

/**
 * Complete review with decision
 */
export async function completeReview(
  reviewId: string,
  decision: 'approved' | 'rejected' | 'request_more_info',
  decisionReason: string,
  notes?: string
): Promise<void> {
  await pool.query(`
    UPDATE manual_review_queue
    SET decision = $1,
        decision_reason = $2,
        decision_notes = $3,
        reviewed_at = NOW(),
        status = 'completed'
    WHERE id = $4
  `, [decision, decisionReason, notes || null, reviewId]);

  // Update individual status based on decision
  const review = await pool.query(`
    SELECT individual_id FROM manual_review_queue WHERE id = $1
  `, [reviewId]);

  if (review.rows.length > 0) {
    const individualId = review.rows[0].individual_id;
    
    if (decision === 'approved') {
      await pool.query(`
        UPDATE individuals
        SET verification_status = 'approved',
            verified_at = NOW()
        WHERE id = $1
      `, [individualId]);
    } else if (decision === 'rejected') {
      await pool.query(`
        UPDATE individuals
        SET verification_status = 'rejected'
        WHERE id = $1
      `, [individualId]);
    }
  }
}

/**
 * Check for SLA breaches (overdue reviews)
 */
export async function checkSLABreaches(): Promise<Array<{
  review_id: string;
  individual_id: string;
  hours_overdue: number;
  priority: string;
  assigned_to: string | null;
}>> {
  const result = await pool.query(`
    SELECT 
      id as review_id,
      individual_id,
      EXTRACT(EPOCH FROM (NOW() - due_at)) / 3600 as hours_overdue,
      review_priority as priority,
      assigned_to
    FROM manual_review_queue
    WHERE status IN ('pending', 'in_progress')
      AND due_at < NOW()
    ORDER BY hours_overdue DESC
  `);

  return result.rows.map(row => ({
    review_id: row.review_id,
    individual_id: row.individual_id,
    hours_overdue: Math.round(row.hours_overdue),
    priority: row.priority,
    assigned_to: row.assigned_to,
  }));
}

/**
 * Get review queue list
 */
export async function getReviewQueue(
  status?: 'pending' | 'in_progress' | 'completed',
  assignedTo?: string
): Promise<ReviewQueueItem[]> {
  let query = `
    SELECT 
      id, individual_id, review_reason, review_priority,
      confidence_score, assigned_to, queued_at, due_at, status
    FROM manual_review_queue
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (assignedTo) {
    query += ` AND assigned_to = $${paramIndex}`;
    params.push(assignedTo);
    paramIndex++;
  }

  query += ` ORDER BY 
    CASE WHEN status = 'pending' THEN 1
         WHEN status = 'in_progress' THEN 2
         ELSE 3 END,
    CASE review_priority
      WHEN 'urgent' THEN 1
      WHEN 'normal' THEN 2
      ELSE 3 END,
    due_at ASC`;

  const result = await pool.query(query, params);

  return result.rows.map(row => ({
    id: row.id,
    individual_id: row.individual_id,
    review_reason: row.review_reason,
    review_priority: row.review_priority,
    confidence_score: row.confidence_score,
    assigned_to: row.assigned_to,
    queued_at: row.queued_at,
    due_at: row.due_at,
    status: row.status,
  }));
}

