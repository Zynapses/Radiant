/**
 * RADIANT TMS - Notification Service
 * Email and SMS notifications for tenant operations
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import * as AWSXRay from 'aws-xray-sdk';
import { executeStatement, param, uuidParam, jsonParam } from '../utils/db';
import { logger } from '../utils/logger';

const rawSesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const rawSnsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const sesClient = process.env.AWS_XRAY_DAEMON_ADDRESS
  ? AWSXRay.captureAWSv3Client(rawSesClient)
  : rawSesClient;

const snsClient = process.env.AWS_XRAY_DAEMON_ADDRESS
  ? AWSXRay.captureAWSv3Client(rawSnsClient)
  : rawSnsClient;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@radiant.example.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@radiant.example.com';

export interface NotificationRecipient {
  email: string;
  name?: string;
  phone?: string;
}

export type NotificationType = '7_day' | '3_day' | '1_day' | 'deleted' | 'restored' | 'verification_code';

class NotificationService {
  /**
   * Send deletion warning notification
   */
  async sendDeletionWarning(
    tenantId: string,
    tenantName: string,
    recipients: NotificationRecipient[],
    daysRemaining: number,
    notificationType: '7_day' | '3_day' | '1_day'
  ): Promise<void> {
    logger.info({ tenantId, daysRemaining, recipientCount: recipients.length }, 'Sending deletion warning');

    const subject = `[RADIANT] Action Required: Your workspace "${tenantName}" will be deleted in ${daysRemaining} day(s)`;
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
    h1 { margin: 0; font-size: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Workspace Deletion Notice</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>This is a reminder that your RADIANT workspace <strong>"${tenantName}"</strong> is scheduled for deletion.</p>
      
      <div class="warning">
        <strong>⏰ Time Remaining: ${daysRemaining} day(s)</strong>
        <p style="margin: 10px 0 0 0;">After this period, all data associated with this workspace will be permanently deleted and cannot be recovered.</p>
      </div>
      
      <p>If you wish to keep your workspace, please log in and restore it before the deletion date.</p>
      
      <p style="text-align: center; margin: 30px 0;">
        <a href="${process.env.DASHBOARD_URL || 'https://app.radiant.example.com'}/settings/workspace" class="button">
          Restore Workspace
        </a>
      </p>
      
      <p>If you have any questions, please contact our support team.</p>
      
      <p>Best regards,<br>The RADIANT Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message from RADIANT. Please do not reply to this email.</p>
      <p>© ${new Date().getFullYear()} RADIANT. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    const textBody = `
WORKSPACE DELETION NOTICE

Hello,

This is a reminder that your RADIANT workspace "${tenantName}" is scheduled for deletion.

⏰ Time Remaining: ${daysRemaining} day(s)

After this period, all data associated with this workspace will be permanently deleted and cannot be recovered.

If you wish to keep your workspace, please log in and restore it before the deletion date.

Visit: ${process.env.DASHBOARD_URL || 'https://app.radiant.example.com'}/settings/workspace

Best regards,
The RADIANT Team
`;

    // Send to all recipients
    const sentTo: string[] = [];
    const failed: string[] = [];

    for (const recipient of recipients) {
      try {
        await sesClient.send(new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: {
            ToAddresses: [recipient.email],
          },
          Message: {
            Subject: { Data: subject },
            Body: {
              Html: { Data: htmlBody },
              Text: { Data: textBody },
            },
          },
        }));
        sentTo.push(recipient.email);
      } catch (error) {
        logger.error({ email: recipient.email, error }, 'Failed to send deletion warning email');
        failed.push(recipient.email);
      }
    }

    // Record notification in database
    await executeStatement(
      `INSERT INTO tms_deletion_notifications (
        tenant_id, notification_type, sent_to, delivery_status, error_message
      ) VALUES (
        $1::uuid, $2, $3::jsonb, $4, $5
      )`,
      [
        uuidParam('1', tenantId),
        param('2', notificationType),
        jsonParam('3', sentTo),
        param('4', failed.length === 0 ? 'sent' : (sentTo.length === 0 ? 'failed' : 'sent')),
        param('5', failed.length > 0 ? `Failed for: ${failed.join(', ')}` : null),
      ]
    );

    logger.info({ tenantId, sentCount: sentTo.length, failedCount: failed.length }, 'Deletion warning sent');
  }

  /**
   * Send verification code
   */
  async sendVerificationCode(
    recipient: NotificationRecipient,
    code: string,
    operation: string,
    resourceName: string,
    expiresMinutes: number
  ): Promise<void> {
    logger.info({ email: recipient.email, operation }, 'Sending verification code');

    const operationDescriptions: Record<string, string> = {
      restore_tenant: 'restore your workspace',
      hard_delete: 'permanently delete data',
      transfer_ownership: 'transfer workspace ownership',
      compliance_override: 'override compliance settings',
    };

    const operationDescription = operationDescriptions[operation] || operation;

    const subject = `[RADIANT] Verification Code: ${code}`;
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .code { background: #1f2937; color: #10b981; font-size: 32px; font-family: monospace; padding: 20px; text-align: center; border-radius: 6px; letter-spacing: 8px; margin: 20px 0; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
    h1 { margin: 0; font-size: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Verification Code</h1>
    </div>
    <div class="content">
      <p>Hello${recipient.name ? ` ${recipient.name}` : ''},</p>
      <p>You requested to <strong>${operationDescription}</strong> for "${resourceName}".</p>
      
      <p>Use the following verification code:</p>
      
      <div class="code">${code}</div>
      
      <div class="warning">
        <strong>⏰ This code expires in ${expiresMinutes} minutes</strong>
        <p style="margin: 10px 0 0 0;">If you did not request this action, please ignore this email and contact support immediately.</p>
      </div>
      
      <p>Best regards,<br>The RADIANT Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message from RADIANT. Please do not reply to this email.</p>
      <p>© ${new Date().getFullYear()} RADIANT. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    const textBody = `
VERIFICATION CODE

Hello${recipient.name ? ` ${recipient.name}` : ''},

You requested to ${operationDescription} for "${resourceName}".

Your verification code is: ${code}

This code expires in ${expiresMinutes} minutes.

If you did not request this action, please ignore this email and contact support immediately.

Best regards,
The RADIANT Team
`;

    await sesClient.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [recipient.email],
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: htmlBody },
          Text: { Data: textBody },
        },
      },
    }));

    logger.info({ email: recipient.email }, 'Verification code sent');
  }

  /**
   * Send tenant deleted confirmation
   */
  async sendDeletionConfirmation(
    tenantName: string,
    recipients: NotificationRecipient[]
  ): Promise<void> {
    const subject = `[RADIANT] Your workspace "${tenantName}" has been deleted`;
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ef4444; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    h1 { margin: 0; font-size: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Workspace Deleted</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Your RADIANT workspace <strong>"${tenantName}"</strong> has been permanently deleted.</p>
      <p>All associated data has been removed from our systems in accordance with our data retention policies.</p>
      <p>If you would like to create a new workspace, you can sign up again at any time.</p>
      <p>Thank you for using RADIANT.</p>
      <p>Best regards,<br>The RADIANT Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} RADIANT. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    for (const recipient of recipients) {
      try {
        await sesClient.send(new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: {
            ToAddresses: [recipient.email],
          },
          Message: {
            Subject: { Data: subject },
            Body: {
              Html: { Data: htmlBody },
              Text: { Data: `Your RADIANT workspace "${tenantName}" has been permanently deleted.` },
            },
          },
        }));
      } catch (error) {
        logger.error({ email: recipient.email, error }, 'Failed to send deletion confirmation');
      }
    }
  }

  /**
   * Notify admins of security event
   */
  async notifySecurityEvent(
    eventType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    const topicArn = process.env.SECURITY_ALERTS_TOPIC_ARN;
    if (!topicArn) {
      logger.warn('No security alerts topic configured');
      return;
    }

    try {
      await snsClient.send(new PublishCommand({
        TopicArn: topicArn,
        Subject: `[RADIANT Security] ${eventType}`,
        Message: JSON.stringify({
          eventType,
          timestamp: new Date().toISOString(),
          environment: process.env.ENVIRONMENT || 'unknown',
          ...details,
        }, null, 2),
      }));
      logger.info({ eventType }, 'Security event notification sent');
    } catch (error) {
      logger.error({ eventType, error }, 'Failed to send security notification');
    }
  }
}

export const notificationService = new NotificationService();
