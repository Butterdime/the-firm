import pool from '../config/database';

export interface AuditLogEntry {
  verification_id?: string;
  document_id: string;
  event_type: 
    | 'ocr_extraction' 
    | 'abr_query' 
    | 'trilogy_check' 
    | 'manual_review' 
    | 'approval' 
    | 'rejection'
    | 'staleness_check';
  decision_maker: 'system' | 'user';
  decision_result: 'pass' | 'fail' | 'warning' | 'flagged';
  decision_reason: string;
  data_snapshot: any;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Log every decision in the verification pipeline
 * CRITICAL: This provides the audit trail that proves no false positives occurred
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (
        verification_id,
        document_id,
        event_type,
        decision_maker,
        decision_result,
        decision_reason,
        data_snapshot,
        user_id,
        ip_address,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.verification_id || null,
        entry.document_id,
        entry.event_type,
        entry.decision_maker,
        entry.decision_result,
        entry.decision_reason,
        JSON.stringify(entry.data_snapshot),
        entry.user_id || null,
        entry.ip_address || null,
        entry.user_agent || null,
      ]
    );
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging failure shouldn't break verification
  }
}

/**
 * Get complete audit trail for a verification
 */
export async function getAuditTrail(verificationId: string): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT 
        event_type,
        event_timestamp,
        decision_maker,
        decision_result,
        decision_reason,
        data_snapshot
      FROM audit_logs
      WHERE verification_id = $1
      ORDER BY event_timestamp ASC`,
      [verificationId]
    );
    return result.rows;
  } catch (error) {
    console.error('Failed to retrieve audit trail:', error);
    return [];
  }
}
