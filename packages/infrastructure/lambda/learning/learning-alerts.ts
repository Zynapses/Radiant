// RADIANT v4.18.0 - Learning Alerts Service
// Monitors satisfaction metrics and sends alerts when performance drops
// Triggered by EventBridge every hour
// ============================================================================

import type { ScheduledEvent, Context } from 'aws-lambda';
import { executeStatement, stringParam, longParam, doubleParam } from '../shared/db/client';
import { enhancedLearningService } from '../shared/services/enhanced-learning.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

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
  
  // TODO: Send email via SES
  // TODO: Send Slack notification
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
