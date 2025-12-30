// RADIANT v4.18.0 - Learning Alerts Service
// Monitors satisfaction metrics and sends alerts when performance drops
// Triggered by EventBridge every hour
// ============================================================================

import type { ScheduledEvent, Context } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { executeStatement, stringParam, longParam, doubleParam } from '../shared/db/client';
import { enhancedLearningService } from '../shared/services/enhanced-learning.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ALERT_SOURCE_EMAIL = process.env.ALERT_SOURCE_EMAIL || 'alerts@radiant.ai';
const SLACK_WEBHOOK_TIMEOUT_MS = 5000;

// ============================================================================
// Types
// ============================================================================

interface AlertConfig {
  tenantId: string;
  alertsEnabled: boolean;
  satisfactionDropThreshold: number; // % drop to trigger alert
  responseVolumeThreshold: number;   // Min responses to trigger
  alertCooldownHours: number;        // Hours between same alerts
  webhookUrl?: string;
  emailRecipients?: string[];
  slackChannel?: string;
}

interface SatisfactionAlert {
  alertType: 'satisfaction_drop' | 'error_rate_spike' | 'cache_miss_high' | 'training_needed';
  tenantId: string;
  severity: 'info' | 'warning' | 'critical';
  currentValue: number;
  previousValue: number;
  threshold: number;
  message: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler = async (event: ScheduledEvent, context: Context): Promise<void> => {
  const startTime = Date.now();
  logger.info('Starting learning alerts check', { event });

  try {
    // Get all tenants with alerts enabled
    const tenants = await getTenantsWithAlertsEnabled();
    
    let alertsTriggered = 0;
    
    for (const tenantId of tenants) {
      try {
        const alerts = await checkTenantAlerts(tenantId);
        
        for (const alert of alerts) {
          await sendAlert(alert);
          await logAlert(alert);
          alertsTriggered++;
        }
      } catch (error) {
        logger.error('Failed to check alerts for tenant', { tenantId, error });
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info('Learning alerts check complete', {
      tenantsChecked: tenants.length,
      alertsTriggered,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('Learning alerts check failed', { error });
    throw error;
  }
};

// ============================================================================
// Alert Checking Logic
// ============================================================================

async function getTenantsWithAlertsEnabled(): Promise<string[]> {
  const result = await executeStatement(
    `SELECT DISTINCT tenant_id FROM learning_alert_config WHERE alerts_enabled = true`,
    []
  );
  return (result.rows || []).map(row => String(row.tenant_id));
}

async function checkTenantAlerts(tenantId: string): Promise<SatisfactionAlert[]> {
  const alerts: SatisfactionAlert[] = [];
  const config = await getAlertConfig(tenantId);
  
  if (!config?.alertsEnabled) return alerts;
  
  // Check if we're in cooldown period
  const lastAlert = await getLastAlertTime(tenantId);
  if (lastAlert && (Date.now() - lastAlert.getTime()) < config.alertCooldownHours * 60 * 60 * 1000) {
    return alerts;
  }
  
  // 1. Check satisfaction drop
  const satisfactionAlert = await checkSatisfactionDrop(tenantId, config);
  if (satisfactionAlert) alerts.push(satisfactionAlert);
  
  // 2. Check error rate spike
  const errorAlert = await checkErrorRateSpike(tenantId, config);
  if (errorAlert) alerts.push(errorAlert);
  
  // 3. Check cache miss rate
  const cacheAlert = await checkCacheMissRate(tenantId, config);
  if (cacheAlert) alerts.push(cacheAlert);
  
  // 4. Check if training is needed
  const trainingAlert = await checkTrainingNeeded(tenantId, config);
  if (trainingAlert) alerts.push(trainingAlert);
  
  return alerts;
}

async function checkSatisfactionDrop(tenantId: string, config: AlertConfig): Promise<SatisfactionAlert | null> {
  // Compare last 24 hours vs previous 24 hours
  const result = await executeStatement(
    `WITH recent AS (
       SELECT AVG(rating) as avg_rating, COUNT(*) as count
       FROM user_feedback
       WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '24 hours'
     ),
     previous AS (
       SELECT AVG(rating) as avg_rating, COUNT(*) as count
       FROM user_feedback
       WHERE tenant_id = $1::uuid 
         AND created_at >= NOW() - INTERVAL '48 hours'
         AND created_at < NOW() - INTERVAL '24 hours'
     )
     SELECT 
       r.avg_rating as recent_rating,
       r.count as recent_count,
       p.avg_rating as previous_rating,
       p.count as previous_count
     FROM recent r, previous p`,
    [stringParam('tenantId', tenantId)]
  );
  
  if (!result.rows?.length) return null;
  
  const row = result.rows[0];
  const recentRating = Number(row.recent_rating || 0);
  const previousRating = Number(row.previous_rating || 0);
  const recentCount = Number(row.recent_count || 0);
  
  // Need minimum responses to alert
  if (recentCount < config.responseVolumeThreshold) return null;
  if (previousRating === 0) return null;
  
  const dropPercent = ((previousRating - recentRating) / previousRating) * 100;
  
  if (dropPercent >= config.satisfactionDropThreshold) {
    return {
      alertType: 'satisfaction_drop',
      tenantId,
      severity: dropPercent >= 20 ? 'critical' : dropPercent >= 10 ? 'warning' : 'info',
      currentValue: recentRating,
      previousValue: previousRating,
      threshold: config.satisfactionDropThreshold,
      message: `Satisfaction dropped ${dropPercent.toFixed(1)}% (from ${previousRating.toFixed(2)} to ${recentRating.toFixed(2)})`,
      metadata: { recentCount, dropPercent },
    };
  }
  
  return null;
}

async function checkErrorRateSpike(tenantId: string, config: AlertConfig): Promise<SatisfactionAlert | null> {
  const result = await executeStatement(
    `WITH recent AS (
       SELECT 
         COUNT(*) FILTER (WHERE error = true) as errors,
         COUNT(*) as total
       FROM usage_logs
       WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 hour'
     )
     SELECT 
       errors,
       total,
       CASE WHEN total > 0 THEN errors::float / total ELSE 0 END as error_rate
     FROM recent`,
    [stringParam('tenantId', tenantId)]
  );
  
  if (!result.rows?.length) return null;
  
  const row = result.rows[0];
  const errorRate = Number(row.error_rate || 0);
  const total = Number(row.total || 0);
  
  if (total < 10) return null; // Need minimum volume
  
  if (errorRate >= 0.1) { // 10% error rate
    return {
      alertType: 'error_rate_spike',
      tenantId,
      severity: errorRate >= 0.25 ? 'critical' : 'warning',
      currentValue: errorRate * 100,
      previousValue: 0,
      threshold: 10,
      message: `Error rate spiked to ${(errorRate * 100).toFixed(1)}% (${row.errors}/${total} requests)`,
      metadata: { errors: row.errors, total },
    };
  }
  
  return null;
}

async function checkCacheMissRate(tenantId: string, config: AlertConfig): Promise<SatisfactionAlert | null> {
  const result = await executeStatement(
    `SELECT 
       SUM(cache_hits) as hits,
       SUM(occurrence_count) as lookups
     FROM successful_pattern_cache
     WHERE tenant_id = $1::uuid AND last_used_at >= NOW() - INTERVAL '24 hours'`,
    [stringParam('tenantId', tenantId)]
  );
  
  if (!result.rows?.length) return null;
  
  const hits = Number(result.rows[0].hits || 0);
  const lookups = Number(result.rows[0].lookups || 0);
  
  if (lookups < 100) return null; // Need minimum lookups
  
  const hitRate = hits / lookups;
  
  if (hitRate < 0.1) { // Less than 10% hit rate
    return {
      alertType: 'cache_miss_high',
      tenantId,
      severity: 'info',
      currentValue: hitRate * 100,
      previousValue: 0,
      threshold: 10,
      message: `Pattern cache hit rate is low: ${(hitRate * 100).toFixed(1)}%`,
      metadata: { hits, lookups },
    };
  }
  
  return null;
}

async function checkTrainingNeeded(tenantId: string, config: AlertConfig): Promise<SatisfactionAlert | null> {
  const learningConfig = await enhancedLearningService.getConfig(tenantId);
  if (!learningConfig) return null;
  
  const result = await executeStatement(
    `SELECT COUNT(*) as pending_count
     FROM learning_candidates
     WHERE tenant_id = $1::uuid AND training_status = 'pending' AND expires_at > NOW()`,
    [stringParam('tenantId', tenantId)]
  );
  
  const pendingCount = Number(result.rows?.[0]?.pending_count || 0);
  const threshold = learningConfig.minCandidatesForTraining * 2; // Alert at 2x threshold
  
  if (pendingCount >= threshold) {
    return {
      alertType: 'training_needed',
      tenantId,
      severity: 'info',
      currentValue: pendingCount,
      previousValue: 0,
      threshold,
      message: `${pendingCount} learning candidates pending - consider triggering training`,
      metadata: { pendingCount, minRequired: learningConfig.minCandidatesForTraining },
    };
  }
  
  return null;
}

// ============================================================================
// Alert Sending
// ============================================================================

async function sendAlert(alert: SatisfactionAlert): Promise<void> {
  const config = await getAlertConfig(alert.tenantId);
  if (!config) return;
  
  logger.info('Sending learning alert', { alert });
  
  // Send to webhook
  if (config.webhookUrl) {
    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'learning_alert',
          alert,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error('Failed to send webhook alert', { error });
    }
  }
  
  // Send email via SES
  if (config.emailRecipients && config.emailRecipients.length > 0) {
    await sendEmailAlert(alert, config.emailRecipients);
  }
  
  // Send Slack notification
  if (config.slackChannel) {
    await sendSlackAlert(alert, config.slackChannel);
  }
}

async function sendEmailAlert(alert: SatisfactionAlert, recipients: string[]): Promise<void> {
  try {
    const subject = `[RADIANT ${alert.severity.toUpperCase()}] ${formatAlertType(alert.alertType)}`;
    const htmlBody = buildAlertEmailHtml(alert);
    const textBody = buildAlertEmailText(alert);
    
    const command = new SendEmailCommand({
      Source: ALERT_SOURCE_EMAIL,
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    });
    
    await sesClient.send(command);
    logger.info('Sent email alert', { tenantId: alert.tenantId, recipients: recipients.length });
  } catch (error) {
    logger.error(`Failed to send email alert: ${String(error)}`);
  }
}

function buildAlertEmailHtml(alert: SatisfactionAlert): string {
  const severityColor = alert.severity === 'critical' ? '#dc2626' : 
                        alert.severity === 'warning' ? '#f59e0b' : '#3b82f6';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: ${severityColor}; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 20px; }
    .metric { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .metric:last-child { border-bottom: none; }
    .metric-label { color: #6b7280; }
    .metric-value { font-weight: 600; }
    .message { background: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 16px; }
    .footer { padding: 16px 20px; background: #f9fafb; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Learning Alert: ${formatAlertType(alert.alertType)}</h1>
    </div>
    <div class="content">
      <div class="metric">
        <span class="metric-label">Severity</span>
        <span class="metric-value" style="color: ${severityColor}">${alert.severity.toUpperCase()}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Current Value</span>
        <span class="metric-value">${alert.currentValue.toFixed(2)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Previous Value</span>
        <span class="metric-value">${alert.previousValue.toFixed(2)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Threshold</span>
        <span class="metric-value">${alert.threshold.toFixed(2)}</span>
      </div>
      <div class="message">
        <strong>Details:</strong><br/>
        ${alert.message}
      </div>
    </div>
    <div class="footer">
      Tenant ID: ${alert.tenantId}<br/>
      Generated by RADIANT Learning System at ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;
}

function buildAlertEmailText(alert: SatisfactionAlert): string {
  return `
RADIANT Learning Alert: ${formatAlertType(alert.alertType)}

Severity: ${alert.severity.toUpperCase()}
Current Value: ${alert.currentValue.toFixed(2)}
Previous Value: ${alert.previousValue.toFixed(2)}
Threshold: ${alert.threshold.toFixed(2)}

Details:
${alert.message}

Tenant ID: ${alert.tenantId}
Generated at: ${new Date().toISOString()}
`.trim();
}

async function sendSlackAlert(alert: SatisfactionAlert, slackChannel: string): Promise<void> {
  try {
    // Get Slack webhook URL from tenant config or environment
    const slackWebhookUrl = await getSlackWebhookUrl(alert.tenantId);
    if (!slackWebhookUrl) {
      logger.warn('No Slack webhook URL configured', { tenantId: alert.tenantId });
      return;
    }
    
    const severityEmoji = alert.severity === 'critical' ? '🚨' : 
                          alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    const severityColor = alert.severity === 'critical' ? '#dc2626' : 
                          alert.severity === 'warning' ? '#f59e0b' : '#3b82f6';
    
    const slackPayload = {
      channel: slackChannel,
      username: 'RADIANT Learning Alerts',
      icon_emoji: ':brain:',
      attachments: [{
        color: severityColor,
        title: `${severityEmoji} ${formatAlertType(alert.alertType)}`,
        text: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Current Value', value: alert.currentValue.toFixed(2), short: true },
          { title: 'Previous Value', value: alert.previousValue.toFixed(2), short: true },
          { title: 'Threshold', value: alert.threshold.toFixed(2), short: true },
        ],
        footer: `Tenant: ${alert.tenantId}`,
        ts: Math.floor(Date.now() / 1000).toString(),
      }],
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SLACK_WEBHOOK_TIMEOUT_MS);
    
    try {
      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
        signal: controller.signal,
      });
      logger.info('Sent Slack alert', { tenantId: alert.tenantId, channel: slackChannel });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    logger.error(`Failed to send Slack alert: ${String(error)}`);
  }
}

async function getSlackWebhookUrl(tenantId: string): Promise<string | null> {
  // Check tenant-specific config first
  const result = await executeStatement(
    `SELECT slack_webhook_url FROM learning_alert_config WHERE tenant_id = $1::uuid`,
    [stringParam('tenantId', tenantId)]
  );
  
  if (result.rows?.[0]?.slack_webhook_url) {
    return String(result.rows[0].slack_webhook_url);
  }
  
  // Fall back to environment variable
  return process.env.SLACK_WEBHOOK_URL || null;
}

function formatAlertType(alertType: string): string {
  return alertType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function logAlert(alert: SatisfactionAlert): Promise<void> {
  await executeStatement(
    `INSERT INTO learning_alerts_log (tenant_id, alert_type, severity, current_value, previous_value, threshold, message, metadata, created_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      stringParam('tenantId', alert.tenantId),
      stringParam('alertType', alert.alertType),
      stringParam('severity', alert.severity),
      doubleParam('currentValue', alert.currentValue),
      doubleParam('previousValue', alert.previousValue),
      doubleParam('threshold', alert.threshold),
      stringParam('message', alert.message),
      stringParam('metadata', JSON.stringify(alert.metadata)),
    ]
  );
}

// ============================================================================
// Config Helpers
// ============================================================================

async function getAlertConfig(tenantId: string): Promise<AlertConfig | null> {
  const result = await executeStatement(
    `SELECT * FROM learning_alert_config WHERE tenant_id = $1::uuid`,
    [stringParam('tenantId', tenantId)]
  );
  
  if (!result.rows?.length) {
    // Return default config
    return {
      tenantId,
      alertsEnabled: false,
      satisfactionDropThreshold: 10,
      responseVolumeThreshold: 50,
      alertCooldownHours: 4,
    };
  }
  
  const row = result.rows[0];
  return {
    tenantId,
    alertsEnabled: row.alerts_enabled === true,
    satisfactionDropThreshold: Number(row.satisfaction_drop_threshold || 10),
    responseVolumeThreshold: Number(row.response_volume_threshold || 50),
    alertCooldownHours: Number(row.alert_cooldown_hours || 4),
    webhookUrl: row.webhook_url ? String(row.webhook_url) : undefined,
    emailRecipients: row.email_recipients ? JSON.parse(String(row.email_recipients)) : undefined,
    slackChannel: row.slack_channel ? String(row.slack_channel) : undefined,
  };
}

async function getLastAlertTime(tenantId: string): Promise<Date | null> {
  const result = await executeStatement(
    `SELECT MAX(created_at) as last_alert FROM learning_alerts_log WHERE tenant_id = $1::uuid`,
    [stringParam('tenantId', tenantId)]
  );
  
  if (!result.rows?.length || !result.rows[0].last_alert) return null;
  return new Date(result.rows[0].last_alert as string);
}
