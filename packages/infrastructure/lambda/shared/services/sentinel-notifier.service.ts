/**
 * RADIANT SENTINEL v1.0.0 — Notification Service
 *
 * Architecture (ratified):
 *   Brain (SENTINEL) → Mouth (PagerDuty) → Human
 *
 * Channels:
 *   SEV 1: PagerDuty (phone/SMS/push) + Twilio direct fallback ("Paranoiac" path)
 *   SEV 2: PagerDuty (SMS/push) + Slack @channel
 *   SEV 3: Slack team channel + auto-create Jira ticket
 *   SEV 4: Slack low-priority + email digest
 *   SEV 5: Email digest only
 *
 * Critical constraint: If PagerDuty returns non-200 or times out (3s),
 * immediately fire the "Paranoiac" direct Twilio call.
 */

import { Pool } from 'pg';
import https from 'https';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  SentinelAlert,
  SentinelIncident,
  SentinelSeverity,
  SentinelNotificationChannel,
  SentinelNotification,
  SentinelAlertPreferences,
  DEFAULT_ESCALATION_RULES,
  EscalationRule,
} from '@radiant/shared/types/sentinel.types';
import { ContactVerificationService } from './contact-verification.service';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'sentinel/notifier',
  category: 'security',
  sourceType: 'application',
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface NotifierConfig {
  pagerdutyRoutingKey: string;
  pagerdutyApiUrl?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  twilioEmergencyNumbers: string[];   // CTO, Lead Engineer direct lines
  slackWebhookUrl?: string;
  slackCriticalChannelId?: string;
  sesFromEmail?: string;
  sesRegion?: string;
  statusPageApiKey?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SentinelNotifierService {
  private pool: Pool;
  private config: NotifierConfig;
  private contactService: ContactVerificationService;
  private snsClient: SNSClient;
  private sesClient: SESClient;
  private senderEmail: string;

  constructor(pool: Pool, config: NotifierConfig) {
    this.pool = pool;
    this.config = config;
    this.contactService = new ContactVerificationService(pool);
    this.snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.senderEmail = config.sesFromEmail || process.env.SES_SENDER_EMAIL || 'noreply@radiant.app';
  }

  // =========================================================================
  // Main: Dispatch notifications for an alert / incident
  // =========================================================================

  async notifyForAlert(alert: SentinelAlert, incident?: SentinelIncident): Promise<SentinelNotification[]> {
    const rule = this.getEscalationRule(alert.severity);
    if (!rule) return [];

    const notifications: SentinelNotification[] = [];

    // Primary channels
    for (const channel of rule.primaryChannels) {
      const notification = await this.dispatchToChannel(channel, alert, incident);
      if (notification) notifications.push(notification);
    }

    // Compliance overrides — additional recipients
    for (const ctx of alert.complianceContext) {
      if (ctx === 'none') continue;
      const override = rule.complianceOverrides?.find(o => o.context === ctx);
      if (override) {
        for (const ch of override.additionalChannels) {
          const n = await this.dispatchToChannel(ch, alert, incident, `compliance:${ctx}`);
          if (n) notifications.push(n);
        }
      }
    }

    // v7.38.0: Dual-resolution — system admin contacts + tenant admin contacts
    // System admin contacts are GLOBAL (no tenant scope) — always resolved
    try {
      const systemAdminContacts = await this.contactService.resolveSystemAdminContacts(
        alert.category, alert.severity,
      );

      for (const contact of systemAdminContacts) {
        try {
          const contactNotification = await this.dispatchToRoutedContact(
            contact, alert, incident,
          );
          if (contactNotification) notifications.push(contactNotification);
        } catch (routeErr) {
          logger.error(`System admin contact dispatch failed for ${contact.adminId}`, routeErr as Error);
        }
      }
    } catch (routeErr) {
      logger.error('System admin contact routing lookup failed', routeErr as Error);
    }

    // Tenant-scoped admin contacts — only if the alert has a tenant scope
    if (alert.tenantScope) {
      try {
        const tenantContacts = await this.contactService.resolveContactsForAlert(
          alert.tenantScope, alert.category, alert.severity,
        );

        for (const contact of tenantContacts) {
          try {
            const contactNotification = await this.dispatchToRoutedContact(
              contact, alert, incident,
            );
            if (contactNotification) notifications.push(contactNotification);
          } catch (routeErr) {
            logger.error(`Tenant contact dispatch failed for ${contact.adminId}`, routeErr as Error);
          }
        }
      } catch (routeErr) {
        logger.error('Tenant contact routing lookup failed', routeErr as Error);
      }
    }

    // Persist notification records
    await this.persistNotifications(notifications, alert);

    return notifications;
  }

  async notifyForIncident(incident: SentinelIncident, alerts: SentinelAlert[]): Promise<SentinelNotification[]> {
    const primaryAlert = alerts[0] || this.incidentToAlert(incident);
    return this.notifyForAlert(primaryAlert, incident);
  }

  // =========================================================================
  // Channel Dispatchers
  // =========================================================================

  private async dispatchToChannel(
    channel: SentinelNotificationChannel,
    alert: SentinelAlert,
    incident?: SentinelIncident,
    recipientOverride?: string
  ): Promise<SentinelNotification | null> {
    const notificationId = this.generateUuid();
    const title = incident
      ? `[SEV ${alert.severity}] ${incident.title}`
      : `[SEV ${alert.severity}] ${alert.title}`;
    const body = this.buildNotificationBody(alert, incident);

    try {
      switch (channel) {
        case 'pagerduty':
          await this.sendPagerDuty(alert, incident);
          break;
        case 'twilio_voice':
          await this.sendTwilioVoice(title);
          break;
        case 'twilio_sms':
          await this.sendTwilioSms(title, body);
          break;
        case 'slack':
          await this.sendSlack(alert, incident);
          break;
        case 'email':
          await this.sendEmail(title, body, recipientOverride);
          break;
        case 'in_app':
          // WebSocket push handled by the admin dashboard SSE/WS endpoint
          break;
        case 'status_page':
          await this.updateStatusPage(alert, incident);
          break;
        case 'webhook':
          // Custom webhook integrations handled separately
          break;
      }

      return {
        id: notificationId,
        alertId: alert.alertId,
        incidentId: incident?.id,
        channel,
        recipientId: recipientOverride || 'default',
        severity: alert.severity,
        title,
        body,
        delivered: true,
        deliveredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const notification: SentinelNotification = {
        id: notificationId,
        alertId: alert.alertId,
        incidentId: incident?.id,
        channel,
        recipientId: recipientOverride || 'default',
        severity: alert.severity,
        title,
        body,
        delivered: false,
        error: (error as Error).message,
        createdAt: new Date().toISOString(),
      };

      // SEV 1 Paranoiac fallback: if PagerDuty fails, call Twilio directly
      if (channel === 'pagerduty' && alert.severity === 1) {
        logger.error('PagerDuty failed for SEV 1, activating Paranoiac Twilio fallback');
        await this.activateParanoiacFallback(alert, incident);
      }

      return notification;
    }
  }

  // =========================================================================
  // PagerDuty Integration (Events API v2)
  // =========================================================================

  private async sendPagerDuty(alert: SentinelAlert, incident?: SentinelIncident): Promise<void> {
    const pdSeverity = this.mapSeverityToPagerDuty(alert.severity);
    const dedupKey = incident?.id || alert.deduplicationKey;

    const payload = {
      routing_key: this.config.pagerdutyRoutingKey,
      event_action: 'trigger',
      dedup_key: `sentinel-${dedupKey}`,
      payload: {
        summary: incident
          ? `[SEV ${alert.severity}] ${incident.title}`
          : `[SEV ${alert.severity}] ${alert.title}`,
        severity: pdSeverity,
        source: `radiant-sentinel-${alert.region}`,
        component: alert.service,
        group: alert.category,
        class: alert.source,
        timestamp: alert.createdAt,
        custom_details: {
          service: alert.service,
          category: alert.category,
          region: alert.region,
          tenantScope: alert.tenantScope,
          complianceContext: alert.complianceContext,
          occurrenceCount: alert.occurrenceCount,
          message: alert.message,
          incidentId: incident?.id,
          alertId: alert.alertId,
        },
      },
      links: [
        {
          href: `${process.env.ADMIN_DASHBOARD_URL || 'https://admin.radiant.app'}/sentinel?incident=${incident?.id || alert.alertId}`,
          text: 'View in SENTINEL Dashboard',
        },
      ],
    };

    const apiUrl = this.config.pagerdutyApiUrl || 'https://events.pagerduty.com';
    await this.httpPostWithTimeout(
      `${apiUrl}/v2/enqueue`,
      payload,
      3000  // 3s timeout — Paranoiac rule
    );
  }

  private mapSeverityToPagerDuty(sev: SentinelSeverity): string {
    switch (sev) {
      case 1: return 'critical';
      case 2: return 'error';
      case 3: return 'warning';
      case 4: return 'info';
      case 5: return 'info';
    }
  }

  // =========================================================================
  // Paranoiac Fallback: Direct Twilio (bypasses PagerDuty & SNS)
  // =========================================================================

  private async activateParanoiacFallback(alert: SentinelAlert, incident?: SentinelIncident): Promise<void> {
    if (!this.config.twilioAccountSid || !this.config.twilioAuthToken || !this.config.twilioFromNumber) {
      logger.error('Paranoiac fallback: Twilio credentials not configured');
      return;
    }

    const message = `SENTINEL SEV 1 ALERT: ${incident?.title || alert.title}. Service: ${alert.service}. Category: ${alert.category}. PagerDuty failed. Check SENTINEL dashboard immediately.`;

    for (const number of this.config.twilioEmergencyNumbers) {
      try {
        await this.twilioCall(number, message);
        logger.info(`Paranoiac: Voice call initiated to ${number.slice(-4)}`);
      } catch (err) {
        logger.error(`Paranoiac: Voice call failed to ${number.slice(-4)}`, err as Error);
        // Try SMS as final fallback
        try {
          await this.twilioSms(number, message);
          logger.info(`Paranoiac: SMS sent to ${number.slice(-4)}`);
        } catch (smsErr) {
          logger.error(`Paranoiac: SMS also failed to ${number.slice(-4)}`, smsErr as Error);
        }
      }
    }
  }

  // =========================================================================
  // Twilio Voice & SMS
  // =========================================================================

  private async sendTwilioVoice(message: string): Promise<void> {
    for (const number of this.config.twilioEmergencyNumbers) {
      await this.twilioCall(number, message);
    }
  }

  private async sendTwilioSms(title: string, body: string): Promise<void> {
    const message = `${title}\n${body}`.substring(0, 1600);
    for (const number of this.config.twilioEmergencyNumbers) {
      await this.twilioSms(number, message);
    }
  }

  private async twilioCall(to: string, message: string): Promise<void> {
    const sid = this.config.twilioAccountSid!;
    const token = this.config.twilioAuthToken!;
    const from = this.config.twilioFromNumber!;

    const twiml = `<Response><Say voice="alice">${this.escapeXml(message)}</Say><Pause length="2"/><Say voice="alice">Repeating. ${this.escapeXml(message)}</Say></Response>`;

    const params = new URLSearchParams({
      To: to,
      From: from,
      Twiml: twiml,
    });

    await this.httpPostForm(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
      params.toString(),
      Buffer.from(`${sid}:${token}`).toString('base64'),
      5000
    );
  }

  private async twilioSms(to: string, message: string): Promise<void> {
    const sid = this.config.twilioAccountSid!;
    const token = this.config.twilioAuthToken!;
    const from = this.config.twilioFromNumber!;

    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: message,
    });

    await this.httpPostForm(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      params.toString(),
      Buffer.from(`${sid}:${token}`).toString('base64'),
      5000
    );
  }

  // =========================================================================
  // Slack Integration
  // =========================================================================

  private async sendSlack(alert: SentinelAlert, incident?: SentinelIncident): Promise<void> {
    if (!this.config.slackWebhookUrl) return;

    const color = alert.severity <= 1 ? '#FF0000' : alert.severity <= 2 ? '#FF6600' : alert.severity <= 3 ? '#FFCC00' : '#36A64F';
    const emoji = alert.severity <= 1 ? '🚨' : alert.severity <= 2 ? '⚠️' : alert.severity <= 3 ? '🔶' : 'ℹ️';

    const payload = {
      channel: alert.severity <= 2 ? this.config.slackCriticalChannelId : undefined,
      text: `${emoji} *[SEV ${alert.severity}] ${incident?.title || alert.title}*`,
      attachments: [
        {
          color,
          fields: [
            { title: 'Service', value: alert.service, short: true },
            { title: 'Category', value: alert.category, short: true },
            { title: 'Region', value: alert.region, short: true },
            { title: 'Severity', value: `SEV ${alert.severity}`, short: true },
            { title: 'Occurrences', value: `${alert.occurrenceCount}`, short: true },
            { title: 'Compliance', value: alert.complianceContext.join(', '), short: true },
          ],
          text: alert.message,
          footer: 'RADIANT SENTINEL',
          ts: Math.floor(Date.now() / 1000).toString(),
          actions: incident ? [
            {
              type: 'button',
              text: 'View Incident',
              url: `${process.env.ADMIN_DASHBOARD_URL || 'https://admin.radiant.app'}/sentinel?incident=${incident.id}`,
            },
          ] : undefined,
        },
      ],
    };

    await this.httpPostJson(this.config.slackWebhookUrl, payload, 5000);
  }

  // =========================================================================
  // Email (SES)
  // =========================================================================

  private async sendEmail(title: string, body: string, recipientOverride?: string): Promise<void> {
    // In production, use AWS SES SDK
    // For now, log the email dispatch
    logger.info(`Email dispatch: ${title}`, { recipient: recipientOverride || 'admin-alerts@radiant.app' });
  }

  // =========================================================================
  // Status Page
  // =========================================================================

  private async updateStatusPage(alert: SentinelAlert, incident?: SentinelIncident): Promise<void> {
    // In production, update Statuspage.io via their API
    // Only for SEV 1-3 customer-facing incidents
    if (alert.severity > 3) return;

    logger.info(`Status page update: SEV ${alert.severity}`, { title: incident?.title || alert.title });
  }

  // =========================================================================
  // Per-Admin Contact Routing Dispatch
  // =========================================================================

  private async dispatchToRoutedContact(
    contact: { adminId: string; contactType: string; value: string; label: string },
    alert: SentinelAlert,
    incident?: SentinelIncident,
  ): Promise<SentinelNotification | null> {
    const notificationId = this.generateUuid();
    const title = incident
      ? `[SEV ${alert.severity}] ${incident.title}`
      : `[SEV ${alert.severity}] ${alert.title}`;
    const body = this.buildNotificationBody(alert, incident);

    try {
      if (contact.contactType === 'phone') {
        // Send SMS via SNS to the admin's specific phone number
        await this.snsClient.send(new PublishCommand({
          PhoneNumber: contact.value,
          Message: `SENTINEL ${title}\n${body}`.substring(0, 1600),
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
            'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'SENTINEL' },
          },
        }));
        logger.info('Routed SMS to admin', { adminId: contact.adminId, label: contact.label, lastFour: contact.value.slice(-4) });
      } else if (contact.contactType === 'email') {
        // Send email via SES to the admin's specific email
        await this.sesClient.send(new SendEmailCommand({
          Source: this.senderEmail,
          Destination: { ToAddresses: [contact.value] },
          Message: {
            Subject: { Data: `SENTINEL: ${title}`, Charset: 'UTF-8' },
            Body: {
              Html: {
                Data: `
                  <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <div style="background: ${alert.severity <= 1 ? '#991b1b' : alert.severity <= 2 ? '#9a3412' : '#854d0e'}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
                      <h2 style="margin: 0;">SENTINEL Alert — SEV ${alert.severity}</h2>
                    </div>
                    <div style="background: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                      <p style="font-size: 16px; font-weight: 600; color: #0f172a;">${alert.title}</p>
                      <p style="color: #475569;">${alert.message}</p>
                      <table style="width: 100%; font-size: 13px; color: #64748b; margin-top: 12px;">
                        <tr><td><strong>Service:</strong> ${alert.service}</td><td><strong>Category:</strong> ${alert.category}</td></tr>
                        <tr><td><strong>Region:</strong> ${alert.region}</td><td><strong>Source:</strong> ${alert.source}</td></tr>
                        ${alert.complianceContext[0] !== 'none' ? `<tr><td colspan="2"><strong>Compliance:</strong> ${alert.complianceContext.join(', ')}</td></tr>` : ''}
                      </table>
                      <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.radiant.app'}/sentinel" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View in SENTINEL</a>
                    </div>
                  </div>
                `,
                Charset: 'UTF-8',
              },
              Text: { Data: `${title}\n\n${body}`, Charset: 'UTF-8' },
            },
          },
        }));
        logger.info('Routed email to admin', { adminId: contact.adminId, label: contact.label, domain: contact.value.split('@')[1] });
      }

      return {
        id: notificationId,
        alertId: alert.alertId,
        incidentId: incident?.id,
        channel: contact.contactType === 'phone' ? 'twilio_sms' : 'email',
        recipientId: `routed:${contact.adminId}:${contact.label}`,
        severity: alert.severity,
        title,
        body,
        delivered: true,
        deliveredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Routed dispatch failed for ${contact.contactType}`, error as Error, { lastFour: contact.value.slice(-4) });
      return {
        id: notificationId,
        alertId: alert.alertId,
        incidentId: incident?.id,
        channel: contact.contactType === 'phone' ? 'twilio_sms' : 'email',
        recipientId: `routed:${contact.adminId}:${contact.label}`,
        severity: alert.severity,
        title,
        body,
        delivered: false,
        error: (error as Error).message,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // =========================================================================
  // Alert Preferences
  // =========================================================================

  async getAlertPreferences(userId: string): Promise<SentinelAlertPreferences | null> {
    const result = await this.pool.query(
      `SELECT * FROM sentinel_alert_preferences WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      userId: row.user_id,
      subscribedCategories: row.subscribed_categories,
      subscribedServices: row.subscribed_services,
      minimumSeverity: row.minimum_severity,
      channels: {
        phone: row.phone,
        sms: row.sms,
        email: row.email,
        slackId: row.slack_id,
        pushEnabled: row.push_enabled,
      },
      quietHours: row.quiet_hours_start ? {
        start: row.quiet_hours_start,
        end: row.quiet_hours_end,
      } : undefined,
      timezone: row.timezone,
      updatedAt: row.updated_at,
    };
  }

  async upsertAlertPreferences(prefs: SentinelAlertPreferences, tenantId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO sentinel_alert_preferences
       (user_id, tenant_id, subscribed_categories, subscribed_services, minimum_severity,
        phone, sms, email, slack_id, push_enabled, quiet_hours_start, quiet_hours_end, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (user_id) DO UPDATE SET
         subscribed_categories = EXCLUDED.subscribed_categories,
         subscribed_services = EXCLUDED.subscribed_services,
         minimum_severity = EXCLUDED.minimum_severity,
         phone = EXCLUDED.phone,
         sms = EXCLUDED.sms,
         email = EXCLUDED.email,
         slack_id = EXCLUDED.slack_id,
         push_enabled = EXCLUDED.push_enabled,
         quiet_hours_start = EXCLUDED.quiet_hours_start,
         quiet_hours_end = EXCLUDED.quiet_hours_end,
         timezone = EXCLUDED.timezone,
         updated_at = NOW()`,
      [
        prefs.userId, tenantId,
        prefs.subscribedCategories, prefs.subscribedServices,
        prefs.minimumSeverity,
        prefs.channels.phone, prefs.channels.sms, prefs.channels.email,
        prefs.channels.slackId, prefs.channels.pushEnabled,
        prefs.quietHours?.start, prefs.quietHours?.end,
        prefs.timezone,
      ]
    );
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private getEscalationRule(severity: SentinelSeverity): EscalationRule | undefined {
    return DEFAULT_ESCALATION_RULES.find(r => r.severity === severity);
  }

  private buildNotificationBody(alert: SentinelAlert, incident?: SentinelIncident): string {
    const lines = [
      `Service: ${alert.service}`,
      `Category: ${alert.category}`,
      `Region: ${alert.region}`,
      `Severity: SEV ${alert.severity}`,
      `Source: ${alert.source}`,
      `Message: ${alert.message}`,
    ];
    if (alert.complianceContext.length > 0 && alert.complianceContext[0] !== 'none') {
      lines.push(`Compliance: ${alert.complianceContext.join(', ')}`);
    }
    if (incident) {
      lines.push(`Incident: ${incident.id}`);
    }
    return lines.join('\n');
  }

  private incidentToAlert(incident: SentinelIncident): SentinelAlert {
    return {
      alertId: incident.alertIds[0] || incident.id,
      severity: incident.severity,
      category: incident.category,
      status: 'firing',
      service: incident.service,
      region: incident.region || 'us-east-1',
      environment: 'production',
      tenantScope: incident.tenantScope as 'none' | 'all' | 'multi' | 'single',
      complianceContext: incident.complianceContext,
      title: incident.title,
      message: incident.description || incident.title,
      details: {},
      source: 'manual',
      deduplicationKey: `incident:${incident.id}`,
      occurrenceCount: 1,
      firstOccurrenceAt: incident.createdAt,
      lastOccurrenceAt: incident.createdAt,
      autoRemediationStatus: 'not_applicable',
      createdAt: incident.createdAt,
    };
  }

  private async persistNotifications(notifications: SentinelNotification[], alert: SentinelAlert): Promise<void> {
    const client = await this.pool.connect();
    try {
      for (const n of notifications) {
        await client.query(
          `INSERT INTO sentinel_notifications
           (id, tenant_id, alert_id, incident_id, channel, recipient_id, severity, title, body, delivered, delivered_at, error, pagerduty_incident_key)
           VALUES ($1, $2, $3, $4, $5::sentinel_notification_channel, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            n.id, '00000000-0000-0000-0000-000000000000',
            n.alertId, n.incidentId, n.channel, n.recipientId,
            n.severity, n.title, n.body, n.delivered, n.deliveredAt,
            n.error, n.pagerdutyIncidentKey,
          ]
        );
      }
    } finally {
      client.release();
    }
  }

  private escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  private async httpPostWithTimeout(url: string, data: unknown, timeoutMs: number): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(data);
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: 'POST',
        timeout: timeoutMs,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout after ${timeoutMs}ms`)); });
      req.write(payload);
      req.end();
    });
  }

  private async httpPostJson(url: string, data: unknown, timeoutMs: number): Promise<void> {
    await this.httpPostWithTimeout(url, data, timeoutMs);
  }

  private async httpPostForm(url: string, formBody: string, authBase64: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formBody),
          'Authorization': `Basic ${authBase64}`,
        },
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Twilio request timeout')); });
      req.write(formBody);
      req.end();
    });
  }
}
