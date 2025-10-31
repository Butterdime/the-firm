/**
 * Notification Service
 * Handles customer communications (email, SMS, in-app)
 * Tracks all notifications sent for compliance
 */

import pool from '../config/database';

export interface NotificationResult {
  notification_id: string;
  sent_at: Date;
  delivered: boolean;
}

/**
 * Send notification to customer
 * For now, this is a placeholder - integrate with actual email/SMS service
 */
export async function sendNotification(
  individualId: string,
  type: 'email' | 'sms' | 'in_app_notification',
  recipient: string,
  subject: string,
  body: string,
  templateName?: string,
  eventTrigger?: string
): Promise<NotificationResult> {
  // Store notification in database
  const result = await pool.query(`
    INSERT INTO customer_communications (
      individual_id, communication_type, template_name,
      subject, body, recipient, event_trigger, sent_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id, sent_at
  `, [individualId, type, templateName || null, subject, body, recipient, eventTrigger || null]);

  const notificationId = result.rows[0].id;

  // TODO: Integrate with actual email/SMS service
  // For now, just log it
  console.log(`[NOTIFICATION] ${type.toUpperCase()} to ${recipient}: ${subject}`);

  // Simulate delivery (in production, this would come from the email/SMS service)
  await pool.query(`
    UPDATE customer_communications
    SET delivered_at = NOW()
    WHERE id = $1
  `, [notificationId]);

  return {
    notification_id: notificationId,
    sent_at: result.rows[0].sent_at,
    delivered: true,
  };
}

/**
 * Get notification history for an individual
 */
export async function getNotificationHistory(individualId: string): Promise<Array<{
  id: string;
  type: string;
  subject: string;
  recipient: string;
  sent_at: Date;
  delivered_at: Date | null;
}>> {
  const result = await pool.query(`
    SELECT 
      id, communication_type as type, subject,
      recipient, sent_at, delivered_at
    FROM customer_communications
    WHERE individual_id = $1
    ORDER BY sent_at DESC
  `, [individualId]);

  return result.rows;
}

