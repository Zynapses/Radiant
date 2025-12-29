// RADIANT v4.18.0 - Security Alert Service
// Webhooks for Slack, Email, PagerDuty alerts
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface AlertConfig {
  enabled: boolean;
  channels: {
    slack?: {
      enabled: boolean;
      webhookUrl: string;
      channel?: string;
      mentionUsers?: string[];
    };
    email?: {
      enabled: boolean;
      recipients: string[];
      fromAddress?: string;
    };
    pagerduty?: {
      enabled: boolean;
      routingKey: string;
      serviceId?: string;
    };
    webhook?: {
      enabled: boolean;
      url: string;
      headers?: Record<string, string>;
    };
  };
  severityFilters: {
    info: boolean;
    warning: boolean;
    critical: boolean;
  };
  cooldownMinutes: number;
}

export interface SecurityAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AlertResult {
  alertId: string;
  sent: boolean;
  channels: string[];
  errors: string[];
}

// ============================================================================
// Security Alert Service
// ============================================================================

class SecurityAlertService {
  private recentAlerts: Map<string, number> = new Map();
  
  /**
   * Send security alert
   */
  async sendAlert(tenantId: string, alert: SecurityAlert): Promise<AlertResult> {
    const alertId = crypto.randomUUID();
    const config = await this.getAlertConfig(tenantId);
    
    const result: AlertResult = {
      alertId,
      sent: false,
      channels: [],
      errors: [],
    };
    
    if (!config.enabled) {
      result.errors.push('Alerts disabled for tenant');
      return result;
    }
    
    // Check severity filter
    if (!config.severityFilters[alert.severity]) {
      result.errors.push(`Severity ${alert.severity} filtered out`);
      return result;
    }
    
    // Check cooldown
    const cooldownKey = `${tenantId}:${alert.type}`;
    const lastAlert = this.recentAlerts.get(cooldownKey);
    const now = Date.now();
    
    if (lastAlert && now - lastAlert < config.cooldownMinutes * 60 * 1000) {
      result.errors.push('Alert in cooldown period');
      return result;
    }
    
    // Send to configured channels
    const sendPromises: Promise<{ channel: string; success: boolean; error?: string }>[] = [];
    
    if (config.channels.slack?.enabled) {
      sendPromises.push(this.sendSlackAlert(config.channels.slack, alert));
    }
    
    if (config.channels.email?.enabled) {
      sendPromises.push(this.sendEmailAlert(config.channels.email, alert));
    }
    
    if (config.channels.pagerduty?.enabled && alert.severity === 'critical') {
      sendPromises.push(this.sendPagerDutyAlert(config.channels.pagerduty, alert));
    }
    
    if (config.channels.webhook?.enabled) {
      sendPromises.push(this.sendWebhookAlert(config.channels.webhook, alert));
    }
    
    const results = await Promise.all(sendPromises);
    
    for (const r of results) {
      if (r.success) {
        result.channels.push(r.channel);
        result.sent = true;
      } else if (r.error) {
        result.errors.push(`${r.channel}: ${r.error}`);
      }
    }
    
    // Update cooldown
    if (result.sent) {
      this.recentAlerts.set(cooldownKey, now);
    }
    
    // Log alert
    await this.logAlert(tenantId, alertId, alert, result);
    
    return result;
  }
  
  /**
   * Send Slack alert
   */
  private async sendSlackAlert(
    config: NonNullable<AlertConfig['channels']['slack']>,
    alert: SecurityAlert
  ): Promise<{ channel: string; success: boolean; error?: string }> {
    try {
      const color = {
        info: '#36a64f',
        warning: '#ff9900',
        critical: '#ff0000',
      }[alert.severity];
      
      const mentions = config.mentionUsers?.length
        ? config.mentionUsers.map(u => `<@${u}>`).join(' ')
        : '';
      
      const payload = {
        channel: config.channel,
        attachments: [
          {
            color,
            title: `🔒 ${alert.title}`,
            text: alert.message + (mentions ? `\n${mentions}` : ''),
            fields: [
              { title: 'Type', value: alert.type, short: true },
              { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
            ],
            footer: 'RADIANT Security',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };
      
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}`);
      }
      
      return { channel: 'slack', success: true };
    } catch (error) {
      logger.error('Failed to send Slack alert', { error });
      return { channel: 'slack', success: false, error: String(error) };
    }
  }
  
  /**
   * Send email alert via SES
   */
  private async sendEmailAlert(
    config: NonNullable<AlertConfig['channels']['email']>,
    alert: SecurityAlert
  ): Promise<{ channel: string; success: boolean; error?: string }> {
    try {
      // This would use AWS SES in production
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
      
      const ses = new SESClient({});
      
      const severityEmoji = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨',
      }[alert.severity];
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: ${alert.severity === 'critical' ? '#ff0000' : '#333'};">
            ${severityEmoji} ${alert.title}
          </h2>
          <p>${alert.message}</p>
          <table style="border-collapse: collapse; margin-top: 20px;">
            <tr>
              <td style="padding: 5px 10px; background: #f5f5f5; font-weight: bold;">Type</td>
              <td style="padding: 5px 10px;">${alert.type}</td>
            </tr>
            <tr>
              <td style="padding: 5px 10px; background: #f5f5f5; font-weight: bold;">Severity</td>
              <td style="padding: 5px 10px;">${alert.severity.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 5px 10px; background: #f5f5f5; font-weight: bold;">Time</td>
              <td style="padding: 5px 10px;">${new Date().toISOString()}</td>
            </tr>
          </table>
          ${alert.metadata ? `
            <h3>Details</h3>
            <pre style="background: #f5f5f5; padding: 10px; overflow-x: auto;">
${JSON.stringify(alert.metadata, null, 2)}
            </pre>
          ` : ''}
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This alert was sent by RADIANT Security Monitoring
          </p>
        </div>
      `;
      
      await ses.send(new SendEmailCommand({
        Source: config.fromAddress || 'security@radiant.ai',
        Destination: {
          ToAddresses: config.recipients,
        },
        Message: {
          Subject: {
            Data: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          },
          Body: {
            Html: { Data: htmlBody },
            Text: { Data: `${alert.title}\n\n${alert.message}\n\nType: ${alert.type}\nSeverity: ${alert.severity}` },
          },
        },
      }));
      
      return { channel: 'email', success: true };
    } catch (error) {
      logger.error('Failed to send email alert', { error });
      return { channel: 'email', success: false, error: String(error) };
    }
  }
  
  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(
    config: NonNullable<AlertConfig['channels']['pagerduty']>,
    alert: SecurityAlert
  ): Promise<{ channel: string; success: boolean; error?: string }> {
    try {
      const payload = {
        routing_key: config.routingKey,
        event_action: 'trigger',
        dedup_key: `radiant-security-${alert.type}-${Date.now()}`,
        payload: {
          summary: alert.title,
          source: 'RADIANT Security',
          severity: alert.severity === 'critical' ? 'critical' : 'warning',
          timestamp: new Date().toISOString(),
          custom_details: {
            message: alert.message,
            type: alert.type,
            ...alert.metadata,
          },
        },
        links: [],
        images: [],
      };
      
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`PagerDuty returned ${response.status}`);
      }
      
      return { channel: 'pagerduty', success: true };
    } catch (error) {
      logger.error('Failed to send PagerDuty alert', { error });
      return { channel: 'pagerduty', success: false, error: String(error) };
    }
  }
  
  /**
   * Send generic webhook alert
   */
  private async sendWebhookAlert(
    config: NonNullable<AlertConfig['channels']['webhook']>,
    alert: SecurityAlert
  ): Promise<{ channel: string; success: boolean; error?: string }> {
    try {
      const payload = {
        event: 'security_alert',
        timestamp: new Date().toISOString(),
        alert: {
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata,
        },
      };
      
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }
      
      return { channel: 'webhook', success: true };
    } catch (error) {
      logger.error('Failed to send webhook alert', { error });
      return { channel: 'webhook', success: false, error: String(error) };
    }
  }
  
  /**
   * Get alert configuration for tenant
   */
  async getAlertConfig(tenantId: string): Promise<AlertConfig> {
    const result = await executeStatement(
      `SELECT alert_config FROM security_protection_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    const config = result.rows?.[0]?.alert_config as Partial<AlertConfig> | undefined;
    
    return {
      enabled: config?.enabled ?? false,
      channels: config?.channels ?? {},
      severityFilters: config?.severityFilters ?? { info: false, warning: true, critical: true },
      cooldownMinutes: config?.cooldownMinutes ?? 60,
    };
  }
  
  /**
   * Update alert configuration
   */
  async updateAlertConfig(tenantId: string, config: Partial<AlertConfig>): Promise<void> {
    await executeStatement(
      `UPDATE security_protection_config SET alert_config = $1::jsonb WHERE tenant_id = $2::uuid`,
      [
        stringParam('config', JSON.stringify(config)),
        stringParam('tenantId', tenantId),
      ]
    );
  }
  
  /**
   * Get alert history
   */
  async getAlertHistory(
    tenantId: string,
    options?: { limit?: number; severity?: string; since?: Date }
  ): Promise<Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    channels: string[];
    createdAt: Date;
  }>> {
    let query = `SELECT * FROM security_alerts WHERE tenant_id = $1::uuid`;
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];
    let idx = 2;
    
    if (options?.severity) {
      query += ` AND severity = $${idx}`;
      params.push(stringParam('severity', options.severity));
      idx++;
    }
    
    if (options?.since) {
      query += ` AND created_at >= $${idx}`;
      params.push(stringParam('since', options.since.toISOString()));
      idx++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(longParam('limit', options?.limit || 100));
    
    const result = await executeStatement(query, params);
    
    return (result.rows || []).map(row => ({
      id: String(row.id),
      type: String(row.alert_type),
      severity: String(row.severity),
      title: String(row.title),
      message: String(row.message),
      channels: (row.channels_sent as string[]) || [],
      createdAt: new Date(row.created_at as string),
    }));
  }
  
  /**
   * Test alert configuration
   */
  async testAlert(tenantId: string, channel: string): Promise<AlertResult> {
    return this.sendAlert(tenantId, {
      type: 'test',
      severity: 'info',
      title: 'Test Alert',
      message: 'This is a test alert from RADIANT Security Monitoring.',
      metadata: { test: true, channel },
    });
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private async logAlert(
    tenantId: string,
    alertId: string,
    alert: SecurityAlert,
    result: AlertResult
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO security_alerts (
          id, tenant_id, alert_type, severity, title, message, metadata, channels_sent, errors
        ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
        [
          stringParam('id', alertId),
          stringParam('tenantId', tenantId),
          stringParam('alertType', alert.type),
          stringParam('severity', alert.severity),
          stringParam('title', alert.title),
          stringParam('message', alert.message),
          stringParam('metadata', JSON.stringify(alert.metadata || {})),
          stringParam('channels', `{${result.channels.join(',')}}`),
          stringParam('errors', `{${result.errors.map(e => `"${e.replace(/"/g, '\\"')}"`).join(',')}}`),
        ]
      );
    } catch (error) {
      logger.error('Failed to log alert', { alertId, error });
    }
  }
}

export const securityAlertService = new SecurityAlertService();
