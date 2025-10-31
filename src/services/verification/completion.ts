/**
 * Verification Completion Service
 * Checks all 3 verification points and determines final status
 */

import pool from '../../config/database';

export interface CompletionResult {
  individual_id: string;
  all_points_verified: boolean;
  final_status: 'approved' | 'manual_review' | 'rejected' | 'pending';
  verified_points: {
    identity: boolean;
    residence: boolean;
    bank: boolean;
  };
  ready_for_cdd_report: boolean;
}

/**
 * Check verification completion status
 */
export async function checkCompletionStatus(individualId: string): Promise<CompletionResult> {
  const individual = await pool.query(`
    SELECT 
      id,
      identity_verified,
      residence_verified,
      bank_verified,
      verification_status
    FROM individuals
    WHERE id = $1
  `, [individualId]);

  if (individual.rows.length === 0) {
    throw new Error('Individual not found');
  }

  const ind = individual.rows[0];
  const all_points_verified = ind.identity_verified && ind.residence_verified && ind.bank_verified;

  // Determine final status
  let final_status: 'approved' | 'manual_review' | 'rejected' | 'pending';
  
  if (all_points_verified) {
    // All points verified - check for any manual review flags
    const bankVerification = await pool.query(`
      SELECT verification_status, confidence_level
      FROM bank_verifications
      WHERE individual_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [individualId]);

    if (bankVerification.rows.length > 0 && bankVerification.rows[0].verification_status === 'manual_review') {
      final_status = 'manual_review';
    } else if (ind.verification_status === 'rejected') {
      final_status = 'rejected';
    } else {
      final_status = 'approved';
    }
  } else {
    // Not all points verified yet
    if (ind.verification_status === 'rejected') {
      final_status = 'rejected';
    } else {
      final_status = 'pending';
    }
  }

  return {
    individual_id: individualId,
    all_points_verified,
    final_status,
    verified_points: {
      identity: ind.identity_verified,
      residence: ind.residence_verified,
      bank: ind.bank_verified,
    },
    ready_for_cdd_report: all_points_verified && final_status === 'approved',
  };
}

/**
 * Update individual final verification status
 */
export async function updateFinalStatus(individualId: string): Promise<void> {
  const completion = await checkCompletionStatus(individualId);

  await pool.query(`
    UPDATE individuals
    SET verification_status = $1,
        verified_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE verified_at END,
        updated_at = NOW()
    WHERE id = $2
  `, [completion.final_status, individualId]);

  // Set AUSTRAC compliance flag if approved
  if (completion.final_status === 'approved') {
    await pool.query(`
      UPDATE individuals
      SET austrac_compliant = TRUE
      WHERE id = $1
    `, [individualId]);
  }
}

