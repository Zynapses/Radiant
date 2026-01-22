/**
 * RADIANT v5.0 - HITL Notification Service
 * 
 * Sends notifications for HITL approval requests via email, Slack, and webhooks.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { executeStatement, stringParam } from '../../db/client';
import { enhancedLogger } from '../../logging/enhanced-logger';

const logger = enhancedLogger;
const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

// ============================================================================
// TYPES
// ============================================================================

export type NotificationChannel = 'email' | 'slack' | 'webhook';
export type NotificationType = 
  | 'approval_requested'
  | 'approval_escalated'
  | 'approval_expired'
  | 'approval_resolved'
  | 'sla_warning';

export interface NotificationPayload {
  type: NotificationType;
  requestId: string;
  queueName: string;
  summary: string;
  priority: string;
  escalationLevel?: number;
  expiresAt?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  emailRecipients?: string[];
  slackWebhookUrl?: string;
  customWebhookUrl?: string;
  customWebhookHeaders?: Record<string, string>;
}

interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

class NotificationService {
  private readonly fromEmail = process.env.SES_FROM_EMAIL || 'noreply@radiant.ai';
  private readonly baseUrl = process.env.ADMIN_DASHBOARD_URL || 'https://admin.radiant.ai';
  private readonly sesEnabled = process.env.SES_ENABLED !== 'false';

  async sendNotification(
    tenantId: string,
    payload: NotificationPayload
  ): Promise<NotificationResult[]> {
    const config = await this.getNotificationConfig(tenantId, payload.type);
    if (!config || config.channels.length === 0) {
      logger.debug('No notification channels configured', { tenantId, type: payload.type });
      return [];
    }

    const results: NotificationResult[] = [];

    for (const channel of config.channels) {
      try {
        const result = await this.sendToChannel(channel, config, payload);
        results.push(result);
      } catch (error: any) {
        results.push({
          channel,
          success: false,
          error: error.message,
        });
        logger.warn('Notification failed', { channel, error: error.message });
      }
    }

    await this.logNotification(tenantId, payload, results);
    return results;
  }

  async sendEscalationNotification(
    tenantId: string,
    requestId: string,
    escalationLevel: number
  ): Promise<NotificationResult[]> {
    const request = await this.getApprovalRequest(requestId);
    if (!request) {
      logger.warn('Approval request not found for notification', { requestId });
      return [];
    }

    return this.sendNotification(tenantId, {
      type: 'approval_escalated',
      requestId,
      queueName: request.queue_name || 'Unknown Queue',
      summary: request.request_summary || 'Approval request escalated',
      priority: request.priority || 'normal',
      escalationLevel,
      expiresAt: request.expires_at,
      actionUrl: `${this.baseUrl}/sovereign-mesh/approvals/${requestId}`,
      metadata: {
        requestType: request.request_type,
        createdAt: request.created_at,
      },
    });
  }

  async sendExpirationWarning(
    tenantId: string,
    requestId: string,
    minutesRemaining: number
  ): Promise<NotificationResult[]> {
    const request = await this.getApprovalRequest(requestId);
    if (!request) return [];

    return this.sendNotification(tenantId, {
      type: 'sla_warning',
      requestId,
      queueName: request.queue_name || 'Unknown Queue',
      summary: `Approval expires in ${minutesRemaining} minutes: ${request.request_summary}`,
      priority: request.priority || 'normal',
      expiresAt: request.expires_at,
      actionUrl: `${this.baseUrl}/sovereign-mesh/approvals/${requestId}`,
    });
  }

  private async sendToChannel(
    channel: NotificationChannel,
    config: NotificationConfig,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    switch (channel) {
      case 'email':
        return this.sendEmail(config.emailRecipients || [], payload);
      case 'slack':
        return this.sendSlack(config.slackWebhookUrl || '', payload);
      case 'webhook':
        return this.sendWebhook(
          config.customWebhookUrl || '',
          config.customWebhookHeaders || {},
          payload
        );
      default:
        return { channel, success: false, error: 'Unknown channel' };
    }
  }

  private async sendEmail(
    recipients: string[],
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    if (!this.sesEnabled || recipients.length === 0) {
      return { channel: 'email', success: false, error: 'Email disabled or no recipients' };
    }

    const subject = this.getEmailSubject(payload);
    const htmlBody = this.getEmailHtml(payload);
    const textBody = this.getEmailText(payload);

    const command = new SendEmailCommand({
      Source: this.fromEmail,
      Destination: { ToAddresses: recipients },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    });

    const result = await ses.send(command);
    return {
      channel: 'email',
      success: true,
      messageId: result.MessageId,
    };
  }

  private async sendSlack(
    webhookUrl: string,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    if (!webhookUrl) {
      return { channel: 'slack', success: false, error: 'No Slack webhook URL' };
    }

    const slackPayload = this.getSlackPayload(payload);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      return { channel: 'slack', success: false, error: `Slack error: ${response.status}` };
    }

    return { channel: 'slack', success: true };
  }

  private async sendWebhook(
    url: string,
    headers: Record<string, string>,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    if (!url) {
      return { channel: 'webhook', success: false, error: 'No webhook URL' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        event: payload.type,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    });

    if (!response.ok) {
      return { channel: 'webhook', success: false, error: `Webhook error: ${response.status}` };
    }

    return { channel: 'webhook', success: true };
  }

  private getEmailSubject(payload: NotificationPayload): string {
    const priorityEmoji = payload.priority === 'critical' ? '🚨' : 
                          payload.priority === 'high' ? '⚠️' : '📋';
    
    switch (payload.type) {
      case 'approval_requested':
        return `${priorityEmoji} [RADIANT] Approval Required: ${payload.summary}`;
      case 'approval_escalated':
        return `🔺 [RADIANT] Escalated (L${payload.escalationLevel}): ${payload.summary}`;
      case 'approval_expired':
        return `⏰ [RADIANT] Expired: ${payload.summary}`;
      case 'sla_warning':
        return `⏳ [RADIANT] SLA Warning: ${payload.summary}`;
      case 'approval_resolved':
        return `✅ [RADIANT] Resolved: ${payload.summary}`;
      default:
        return `[RADIANT] ${payload.summary}`;
    }
  }

  private getEmailHtml(payload: NotificationPayload): string {
    const priorityColor = payload.priority === 'critical' ? '#DC2626' :
                          payload.priority === 'high' ? '#F59E0B' : '#3B82F6';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #6366F1, #8B5CF6); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">RADIANT</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Sovereign Mesh Notification</p>
    </div>
    
    <div style="padding: 24px;">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <span style="background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
          ${payload.priority}
        </span>
        <span style="margin-left: 12px; color: #6B7280; font-size: 14px;">
          ${payload.queueName}
        </span>
      </div>
      
      <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 18px;">
        ${this.getTypeTitle(payload.type)}
      </h2>
      
      <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
        ${payload.summary}
      </p>
      
      ${payload.escalationLevel ? `
      <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: #92400E; font-size: 14px;">
          <strong>Escalation Level:</strong> ${payload.escalationLevel}
        </p>
      </div>
      ` : ''}
      
      ${payload.expiresAt ? `
      <p style="color: #6B7280; font-size: 14px; margin-bottom: 20px;">
        <strong>Expires:</strong> ${new Date(payload.expiresAt).toLocaleString()}
      </p>
      ` : ''}
      
      ${payload.actionUrl ? `
      <a href="${payload.actionUrl}" style="display: inline-block; background: #6366F1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Review Request →
      </a>
      ` : ''}
    </div>
    
    <div style="background: #F9FAFB; padding: 16px 24px; text-align: center; border-top: 1px solid #E5E7EB;">
      <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
        This is an automated notification from RADIANT Sovereign Mesh.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  private getEmailText(payload: NotificationPayload): string {
    let text = `RADIANT - ${this.getTypeTitle(payload.type)}\n\n`;
    text += `Queue: ${payload.queueName}\n`;
    text += `Priority: ${payload.priority}\n`;
    text += `Summary: ${payload.summary}\n`;
    
    if (payload.escalationLevel) {
      text += `Escalation Level: ${payload.escalationLevel}\n`;
    }
    if (payload.expiresAt) {
      text += `Expires: ${new Date(payload.expiresAt).toLocaleString()}\n`;
    }
    if (payload.actionUrl) {
      text += `\nReview: ${payload.actionUrl}\n`;
    }
    
    return text;
  }

  private getSlackPayload(payload: NotificationPayload) {
    const priorityEmoji = payload.priority === 'critical' ? ':rotating_light:' :
                          payload.priority === 'high' ? ':warning:' : ':clipboard:';
    
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${priorityEmoji} ${this.getTypeTitle(payload.type)}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Queue:*\n${payload.queueName}` },
            { type: 'mrkdwn', text: `*Priority:*\n${payload.priority}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: payload.summary,
          },
        },
        ...(payload.actionUrl ? [{
          type: 'actions',
          elements: [{
            type: 'button',
            text: { type: 'plain_text', text: 'Review Request', emoji: true },
            url: payload.actionUrl,
            style: 'primary',
          }],
        }] : []),
      ],
    };
  }

  private getTypeTitle(type: NotificationType): string {
    switch (type) {
      case 'approval_requested': return 'Approval Requested';
      case 'approval_escalated': return 'Request Escalated';
      case 'approval_expired': return 'Request Expired';
      case 'approval_resolved': return 'Request Resolved';
      case 'sla_warning': return 'SLA Warning';
      default: return 'Notification';
    }
  }

  private async getNotificationConfig(
    tenantId: string,
    type: NotificationType
  ): Promise<NotificationConfig | null> {
    const result = await executeStatement(
      `SELECT notification_channels, email_recipients, slack_webhook_url, 
              custom_webhook_url, custom_webhook_headers
       FROM hitl_queue_configs 
       WHERE tenant_id = :tenantId AND is_active = true
       LIMIT 1`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.[0]) {
      return {
        channels: ['email'],
        emailRecipients: [],
      };
    }

    const row = result.rows[0];
    return {
      channels: this.parseArray(row.notification_channels) as NotificationChannel[],
      emailRecipients: this.parseArray(row.email_recipients),
      slackWebhookUrl: this.extractValue(row.slack_webhook_url) as string,
      customWebhookUrl: this.extractValue(row.custom_webhook_url) as string,
      customWebhookHeaders: this.parseJson(row.custom_webhook_headers),
    };
  }

  private async getApprovalRequest(requestId: string): Promise<Record<string, any> | null> {
    const result = await executeStatement(
      `SELECT r.*, q.name as queue_name
       FROM hitl_approval_requests r
       JOIN hitl_queue_configs q ON r.queue_id = q.id
       WHERE r.id = :requestId`,
      [stringParam('requestId', requestId)]
    );

    if (!result.rows?.[0]) return null;
    
    const row: Record<string, any> = {};
    for (const [key, value] of Object.entries(result.rows[0])) {
      row[key] = this.extractValue(value);
    }
    return row;
  }

  private async logNotification(
    tenantId: string,
    payload: NotificationPayload,
    results: NotificationResult[]
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO hitl_notification_log (tenant_id, request_id, notification_type, channels, results)
         VALUES (:tenantId, :requestId, :type, :channels::jsonb, :results::jsonb)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('requestId', payload.requestId),
          stringParam('type', payload.type),
          stringParam('channels', JSON.stringify(results.map(r => r.channel))),
          stringParam('results', JSON.stringify(results)),
        ]
      );
    } catch (error) {
      logger.warn('Failed to log notification', { error });
    }
  }

  private extractValue(field: unknown): unknown {
    if (!field) return null;
    if (typeof field === 'object' && 'stringValue' in field) {
      return (field as { stringValue: string }).stringValue;
    }
    return field;
  }

  private parseArray(field: unknown): string[] {
    const value = this.extractValue(field);
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.replace(/[{}]/g, '').split(',').filter(Boolean);
      }
    }
    return [];
  }

  private parseJson(field: unknown): Record<string, string> {
    const value = this.extractValue(field);
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return {};
  }
}

export const notificationService = new NotificationService();
