/**
 * RADIANT v4.18.0 - AWS Monitoring Notifications Service
 * Sends threshold alerts via SNS (SMS) and SES (Email)
 * Tracks spend per hour, day, week, month
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer';
import { executeStatement, stringParam, longParam, doubleParam, boolParam, setTenantContext } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

const sns = new SNSClient({});
const ses = new SESClient({});
const costExplorer = new CostExplorerClient({});

const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS || 'alerts@radiant.app';

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationTarget {
  id: string;
  tenantId: string;
  type: 'email' | 'sms';
  value: string; // email address or phone number (E.164 format)
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SpendThreshold {
  id: string;
  tenantId: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  thresholdAmount: number;
  warningPercent: number; // e.g., 80 = warn at 80% of threshold
  enabled: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricThreshold {
  id: string;
  tenantId: string;
  metricType: 'lambda_error_rate' | 'lambda_p99_latency' | 'aurora_cpu' | 'xray_error_rate' | 'free_tier_usage';
  thresholdValue: number;
  comparison: 'gt' | 'lt' | 'gte' | 'lte'; // greater than, less than, etc.
  enabled: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpendSummary {
  hourly: number;
  daily: number;
  weekly: number;
  monthly: number;
  hourlyChange: number;
  dailyChange: number;
  weeklyChange: number;
  monthlyChange: number;
}

export interface NotificationLog {
  id: string;
  tenantId: string;
  targetId: string;
  thresholdId?: string;
  type: 'spend_warning' | 'spend_exceeded' | 'metric_exceeded' | 'free_tier_warning' | 'free_tier_exceeded';
  message: string;
  sentAt: string;
  deliveryStatus: 'sent' | 'failed' | 'pending';
  errorMessage?: string;
}

export type AWSServiceType = 
  | 'lambda' | 'aurora' | 'xray' | 'cloudwatch' | 'cost_explorer'
  | 'api_gateway' | 'sqs' | 's3' | 'dynamodb' | 'sns' | 'ses';

export interface FreeTierServiceSetting {
  id: string;
  tenantId: string;
  service: AWSServiceType;
  freeTierEnabled: boolean;   // Free tier ON by default
  paidTierEnabled: boolean;   // Paid tier requires admin toggle
  autoScaleToPaid: boolean;   // Auto-upgrade when free tier exceeded
  maxPaidBudget?: number;     // Optional budget cap
  enabledAt: string;
  enabledBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// NOTIFICATION TARGETS MANAGEMENT
// ============================================================================

export class MonitoringNotificationsService {
  
  /**
   * Set RLS context for tenant isolation before executing queries.
   * This ensures all subsequent queries in this session are scoped to the tenant.
   */
  private async ensureTenantContext(tenantId: string): Promise<void> {
    try {
      await setTenantContext(tenantId);
    } catch (error) {
      logger.warn('Failed to set tenant context, continuing with explicit WHERE clause', { tenantId, error });
    }
  }

  async getNotificationTargets(tenantId: string): Promise<NotificationTarget[]> {
    await this.ensureTenantContext(tenantId);
    
    const result = await executeStatement(
      `SELECT * FROM aws_monitoring_notification_targets 
       WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => this.mapNotificationTarget(row as Record<string, unknown>));
  }

  async addNotificationTarget(
    tenantId: string,
    type: 'email' | 'sms',
    value: string,
    name: string
  ): Promise<NotificationTarget> {
    // Validate email or phone format
    if (type === 'email' && !this.isValidEmail(value)) {
      throw new Error('Invalid email address format');
    }
    if (type === 'sms' && !this.isValidE164Phone(value)) {
      throw new Error('Invalid phone number format. Use E.164 format (e.g., +15551234567)');
    }

    const result = await executeStatement(
      `INSERT INTO aws_monitoring_notification_targets 
       (tenant_id, type, value, name, enabled)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('type', type),
        stringParam('value', value),
        stringParam('name', name),
      ]
    );

    return this.mapNotificationTarget(result.rows?.[0] as Record<string, unknown>);
  }

  async updateNotificationTarget(
    tenantId: string,
    targetId: string,
    updates: { name?: string; enabled?: boolean }
  ): Promise<void> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params = [stringParam('tenantId', tenantId), stringParam('targetId', targetId)];
    let paramIndex = 3;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(stringParam(`name`, updates.name));
      paramIndex++;
    }
    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex}`);
      params.push(stringParam(`enabled`, String(updates.enabled)));
    }

    await executeStatement(
      `UPDATE aws_monitoring_notification_targets 
       SET ${setClauses.join(', ')}
       WHERE tenant_id = $1 AND id = $2`,
      params
    );
  }

  async deleteNotificationTarget(tenantId: string, targetId: string): Promise<void> {
    await executeStatement(
      `DELETE FROM aws_monitoring_notification_targets 
       WHERE tenant_id = $1 AND id = $2`,
      [stringParam('tenantId', tenantId), stringParam('targetId', targetId)]
    );
  }

  // ============================================================================
  // SPEND THRESHOLDS MANAGEMENT
  // ============================================================================

  async getSpendThresholds(tenantId: string): Promise<SpendThreshold[]> {
    const result = await executeStatement(
      `SELECT * FROM aws_monitoring_spend_thresholds 
       WHERE tenant_id = $1 ORDER BY period`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => this.mapSpendThreshold(row as Record<string, unknown>));
  }

  async setSpendThreshold(
    tenantId: string,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    thresholdAmount: number,
    warningPercent: number = 80
  ): Promise<SpendThreshold> {
    const result = await executeStatement(
      `INSERT INTO aws_monitoring_spend_thresholds 
       (tenant_id, period, threshold_amount, warning_percent, enabled)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (tenant_id, period) DO UPDATE SET
         threshold_amount = EXCLUDED.threshold_amount,
         warning_percent = EXCLUDED.warning_percent,
         enabled = true,
         updated_at = NOW()
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('period', period),
        doubleParam('thresholdAmount', thresholdAmount),
        longParam('warningPercent', warningPercent),
      ]
    );

    return this.mapSpendThreshold(result.rows?.[0] as Record<string, unknown>);
  }

  async updateSpendThreshold(
    tenantId: string,
    thresholdId: string,
    updates: { thresholdAmount?: number; warningPercent?: number; enabled?: boolean }
  ): Promise<void> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params = [stringParam('tenantId', tenantId), stringParam('thresholdId', thresholdId)];
    let paramIndex = 3;

    if (updates.thresholdAmount !== undefined) {
      setClauses.push(`threshold_amount = $${paramIndex}`);
      params.push(doubleParam(`amount`, updates.thresholdAmount));
      paramIndex++;
    }
    if (updates.warningPercent !== undefined) {
      setClauses.push(`warning_percent = $${paramIndex}`);
      params.push(longParam(`percent`, updates.warningPercent));
      paramIndex++;
    }
    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex}`);
      params.push(stringParam(`enabled`, String(updates.enabled)));
    }

    await executeStatement(
      `UPDATE aws_monitoring_spend_thresholds 
       SET ${setClauses.join(', ')}
       WHERE tenant_id = $1 AND id = $2`,
      params
    );
  }

  async deleteSpendThreshold(tenantId: string, thresholdId: string): Promise<void> {
    await executeStatement(
      `DELETE FROM aws_monitoring_spend_thresholds 
       WHERE tenant_id = $1 AND id = $2`,
      [stringParam('tenantId', tenantId), stringParam('thresholdId', thresholdId)]
    );
  }

  // ============================================================================
  // METRIC THRESHOLDS MANAGEMENT
  // ============================================================================

  async getMetricThresholds(tenantId: string): Promise<MetricThreshold[]> {
    const result = await executeStatement(
      `SELECT * FROM aws_monitoring_metric_thresholds 
       WHERE tenant_id = $1 ORDER BY metric_type`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => this.mapMetricThreshold(row as Record<string, unknown>));
  }

  async setMetricThreshold(
    tenantId: string,
    metricType: MetricThreshold['metricType'],
    thresholdValue: number,
    comparison: MetricThreshold['comparison'] = 'gt'
  ): Promise<MetricThreshold> {
    const result = await executeStatement(
      `INSERT INTO aws_monitoring_metric_thresholds 
       (tenant_id, metric_type, threshold_value, comparison, enabled)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (tenant_id, metric_type) DO UPDATE SET
         threshold_value = EXCLUDED.threshold_value,
         comparison = EXCLUDED.comparison,
         enabled = true,
         updated_at = NOW()
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('metricType', metricType),
        doubleParam('thresholdValue', thresholdValue),
        stringParam('comparison', comparison),
      ]
    );

    return this.mapMetricThreshold(result.rows?.[0] as Record<string, unknown>);
  }

  // ============================================================================
  // SPEND TRACKING (REAL DATA FROM COST EXPLORER)
  // ============================================================================

  async getSpendSummary(tenantId: string): Promise<SpendSummary> {
    const now = new Date();
    
    // Calculate time periods
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Fetch costs for each period
    const [hourly, prevHourly, daily, prevDaily, weekly, prevWeekly, monthly, prevMonthly] = await Promise.all([
      this.getCostForPeriod(hourAgo, now),
      this.getCostForPeriod(twoHoursAgo, hourAgo),
      this.getCostForPeriod(dayAgo, now),
      this.getCostForPeriod(twoDaysAgo, dayAgo),
      this.getCostForPeriod(weekAgo, now),
      this.getCostForPeriod(twoWeeksAgo, weekAgo),
      this.getCostForPeriod(startOfMonth, now),
      this.getCostForPeriod(startOfLastMonth, startOfMonth),
    ]);

    return {
      hourly,
      daily,
      weekly,
      monthly,
      hourlyChange: prevHourly > 0 ? ((hourly - prevHourly) / prevHourly) * 100 : 0,
      dailyChange: prevDaily > 0 ? ((daily - prevDaily) / prevDaily) * 100 : 0,
      weeklyChange: prevWeekly > 0 ? ((weekly - prevWeekly) / prevWeekly) * 100 : 0,
      monthlyChange: prevMonthly > 0 ? ((monthly - prevMonthly) / prevMonthly) * 100 : 0,
    };
  }

  private async getCostForPeriod(start: Date, end: Date): Promise<number> {
    try {
      const response = await costExplorer.send(new GetCostAndUsageCommand({
        TimePeriod: {
          Start: start.toISOString().split('T')[0],
          End: end.toISOString().split('T')[0],
        },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
      }));

      let total = 0;
      for (const result of response.ResultsByTime || []) {
        total += parseFloat(result.Total?.UnblendedCost?.Amount || '0');
      }
      return total;
    } catch (error) {
      logger.warn('Failed to get cost for period', { start, end, error });
      return 0;
    }
  }

  // ============================================================================
  // THRESHOLD CHECKING & NOTIFICATIONS
  // ============================================================================

  async checkAndNotifyThresholds(tenantId: string): Promise<void> {
    const [spendThresholds, metricThresholds, targets, spendSummary] = await Promise.all([
      this.getSpendThresholds(tenantId),
      this.getMetricThresholds(tenantId),
      this.getNotificationTargets(tenantId),
    this.getSpendSummary(tenantId),
    ]);

    const enabledTargets = targets.filter(t => t.enabled);
    if (enabledTargets.length === 0) {
      logger.info('No enabled notification targets', { tenantId });
      return;
    }

    // Check spend thresholds
    for (const threshold of spendThresholds.filter(t => t.enabled)) {
      const currentSpend = this.getSpendForPeriod(spendSummary, threshold.period);
      const warningAmount = threshold.thresholdAmount * (threshold.warningPercent / 100);

      if (currentSpend >= threshold.thresholdAmount) {
        await this.sendNotification(
          tenantId,
          enabledTargets,
          'spend_exceeded',
          `ALERT: ${threshold.period.charAt(0).toUpperCase() + threshold.period.slice(1)} spend exceeded! ` +
          `Current: $${currentSpend.toFixed(2)}, Threshold: $${threshold.thresholdAmount.toFixed(2)}`,
          threshold.id
        );
      } else if (currentSpend >= warningAmount) {
        await this.sendNotification(
          tenantId,
          enabledTargets,
          'spend_warning',
          `WARNING: ${threshold.period.charAt(0).toUpperCase() + threshold.period.slice(1)} spend at ${((currentSpend / threshold.thresholdAmount) * 100).toFixed(0)}% of threshold. ` +
          `Current: $${currentSpend.toFixed(2)}, Threshold: $${threshold.thresholdAmount.toFixed(2)}`,
          threshold.id
        );
      }
    }
  }

  private getSpendForPeriod(summary: SpendSummary, period: SpendThreshold['period']): number {
    switch (period) {
      case 'hourly': return summary.hourly;
      case 'daily': return summary.daily;
      case 'weekly': return summary.weekly;
      case 'monthly': return summary.monthly;
    }
  }

  // ============================================================================
  // NOTIFICATION SENDING (SNS for SMS, SES for Email)
  // ============================================================================

  private async sendNotification(
    tenantId: string,
    targets: NotificationTarget[],
    type: NotificationLog['type'],
    message: string,
    thresholdId?: string
  ): Promise<void> {
    for (const target of targets) {
      try {
        if (target.type === 'sms') {
          await this.sendSMS(target.value, message);
        } else if (target.type === 'email') {
          await this.sendEmail(target.value, 'RADIANT AWS Monitoring Alert', message);
        }

        await this.logNotification(tenantId, target.id, type, message, 'sent', thresholdId);
        logger.info('Notification sent', { tenantId, targetId: target.id, type });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.logNotification(tenantId, target.id, type, message, 'failed', thresholdId, errorMessage);
        logger.error('Failed to send notification', { tenantId, targetId: target.id, error });
      }
    }
  }

  private async sendSMS(phoneNumber: string, message: string): Promise<void> {
    await sns.send(new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    }));
  }

  private async sendEmail(emailAddress: string, subject: string, body: string): Promise<void> {
    try {
      await ses.send(new SendEmailCommand({
        Source: SES_FROM_ADDRESS,
        Destination: {
          ToAddresses: [emailAddress],
        },
        Message: {
          Subject: { Data: subject },
          Body: {
            Text: { Data: body },
            Html: {
              Data: `
                <html>
                  <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #1a1a1a;">RADIANT AWS Monitoring Alert</h2>
                      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 16px;">${body}</p>
                      </div>
                      <p style="color: #666; font-size: 12px;">
                        This is an automated alert from RADIANT AWS Monitoring. 
                        To manage your notification preferences, visit the Monitoring section in the Radiant Admin App.
                      </p>
                    </div>
                  </body>
                </html>
              `,
            },
          },
        },
      }));
    } catch (error) {
      // Handle SES-specific errors with helpful messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Email address is not verified')) {
        logger.error('SES sender verification error', { 
          fromAddress: SES_FROM_ADDRESS,
          error: 'SES_FROM_ADDRESS must be a verified identity in SES. Verify the email address or domain in AWS SES console.',
        });
        throw new Error(`SES sender not verified: ${SES_FROM_ADDRESS}. Please verify this email in AWS SES console.`);
      }
      
      if (errorMessage.includes('not authorized') || errorMessage.includes('AccessDenied')) {
        logger.error('SES permission error', {
          error: 'Lambda execution role needs ses:SendEmail permission',
        });
        throw new Error('SES permission denied. Ensure Lambda has ses:SendEmail permission.');
      }
      
      if (errorMessage.includes('sandbox') || errorMessage.includes('ProductionAccessNotGranted')) {
        logger.error('SES sandbox mode', {
          error: 'SES is in sandbox mode. Request production access or verify recipient email.',
          toAddress: emailAddress,
        });
        throw new Error(`SES in sandbox mode. Either request production access or verify recipient: ${emailAddress}`);
      }
      
      throw error;
    }
  }

  private async logNotification(
    tenantId: string,
    targetId: string,
    type: NotificationLog['type'],
    message: string,
    status: NotificationLog['deliveryStatus'],
    thresholdId?: string,
    errorMessage?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO aws_monitoring_notification_log 
       (tenant_id, target_id, threshold_id, type, message, delivery_status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('targetId', targetId),
        stringParam('thresholdId', thresholdId || ''),
        stringParam('type', type),
        stringParam('message', message),
        stringParam('status', status),
        stringParam('error', errorMessage || ''),
      ]
    );
  }

  async getNotificationLog(tenantId: string, limit: number = 50): Promise<NotificationLog[]> {
    const result = await executeStatement(
      `SELECT * FROM aws_monitoring_notification_log 
       WHERE tenant_id = $1 
       ORDER BY sent_at DESC 
       LIMIT $2`,
      [stringParam('tenantId', tenantId), longParam('limit', limit)]
    );

    return (result.rows || []).map(row => ({
      id: String((row as Record<string, unknown>).id),
      tenantId: String((row as Record<string, unknown>).tenant_id),
      targetId: String((row as Record<string, unknown>).target_id),
      thresholdId: (row as Record<string, unknown>).threshold_id ? String((row as Record<string, unknown>).threshold_id) : undefined,
      type: String((row as Record<string, unknown>).type) as NotificationLog['type'],
      message: String((row as Record<string, unknown>).message),
      sentAt: String((row as Record<string, unknown>).sent_at),
      deliveryStatus: String((row as Record<string, unknown>).delivery_status) as NotificationLog['deliveryStatus'],
      errorMessage: (row as Record<string, unknown>).error_message ? String((row as Record<string, unknown>).error_message) : undefined,
    }));
  }

  // ============================================================================
  // CHARGEABLE TIER SCALING
  // ============================================================================

  async checkChargeableScaling(tenantId: string): Promise<{
    isChargeable: boolean;
    reason?: string;
    estimatedMonthlyCost: number;
    recommendation: string;
  }> {
    const spendSummary = await this.getSpendSummary(tenantId);
    
    // Check if exceeding free tier limits
    const exceededFreeTier = spendSummary.monthly > 0; // Any spend means past free tier
    
    // Project monthly cost based on current usage
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthlyCost = (spendSummary.monthly / dayOfMonth) * daysInMonth;

    if (exceededFreeTier) {
      return {
        isChargeable: true,
        reason: 'Usage has exceeded AWS free tier limits',
        estimatedMonthlyCost: projectedMonthlyCost,
        recommendation: projectedMonthlyCost > 100 
          ? 'Consider Reserved Capacity or Savings Plans for cost optimization'
          : 'Current usage is within acceptable chargeable limits',
      };
    }

    return {
      isChargeable: false,
      estimatedMonthlyCost: 0,
      recommendation: 'Usage is within free tier. No charges expected.',
    };
  }

  // ============================================================================
  // FREE TIER SERVICE SETTINGS (Admin toggles)
  // ============================================================================

  async getFreeTierSettings(tenantId: string): Promise<FreeTierServiceSetting[]> {
    const result = await executeStatement(
      `SELECT * FROM aws_free_tier_settings WHERE tenant_id = $1 ORDER BY service`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => this.mapFreeTierSetting(row as Record<string, unknown>));
  }

  async getFreeTierSettingForService(tenantId: string, service: AWSServiceType): Promise<FreeTierServiceSetting | null> {
    const result = await executeStatement(
      `SELECT * FROM aws_free_tier_settings WHERE tenant_id = $1 AND service = $2`,
      [stringParam('tenantId', tenantId), stringParam('service', service)]
    );

    if (!result.rows || result.rows.length === 0) return null;
    return this.mapFreeTierSetting(result.rows[0] as Record<string, unknown>);
  }

  async togglePaidTier(
    tenantId: string,
    service: AWSServiceType,
    enabled: boolean,
    adminEmail?: string,
    maxBudget?: number
  ): Promise<FreeTierServiceSetting> {
    const result = await executeStatement(
      `INSERT INTO aws_free_tier_settings 
       (tenant_id, service, free_tier_enabled, paid_tier_enabled, max_paid_budget, enabled_by, enabled_at)
       VALUES ($1, $2, true, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, service) DO UPDATE SET
         paid_tier_enabled = $3,
         max_paid_budget = COALESCE($4, aws_free_tier_settings.max_paid_budget),
         enabled_by = CASE WHEN $3 = true THEN $5 ELSE aws_free_tier_settings.enabled_by END,
         enabled_at = CASE WHEN $3 = true THEN NOW() ELSE aws_free_tier_settings.enabled_at END,
         updated_at = NOW()
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('service', service),
        boolParam('paidEnabled', enabled),
        maxBudget !== undefined ? doubleParam('maxBudget', maxBudget) : stringParam('maxBudget', ''),
        stringParam('adminEmail', adminEmail || ''),
      ]
    );

    logger.info('Toggled paid tier for service', { tenantId, service, enabled, adminEmail });
    return this.mapFreeTierSetting(result.rows?.[0] as Record<string, unknown>);
  }

  async setAutoScaleToPaid(
    tenantId: string,
    service: AWSServiceType,
    autoScale: boolean
  ): Promise<FreeTierServiceSetting> {
    const result = await executeStatement(
      `UPDATE aws_free_tier_settings 
       SET auto_scale_to_paid = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND service = $2
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('service', service),
        boolParam('autoScale', autoScale),
      ]
    );

    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Free tier setting not found for service: ${service}`);
    }

    logger.info('Set auto-scale to paid for service', { tenantId, service, autoScale });
    return this.mapFreeTierSetting(result.rows[0] as Record<string, unknown>);
  }

  async setBudgetCap(
    tenantId: string,
    service: AWSServiceType,
    maxBudget: number | null
  ): Promise<FreeTierServiceSetting> {
    const result = await executeStatement(
      `UPDATE aws_free_tier_settings 
       SET max_paid_budget = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND service = $2
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('service', service),
        maxBudget !== null ? doubleParam('maxBudget', maxBudget) : stringParam('maxBudget', ''),
      ]
    );

    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Free tier setting not found for service: ${service}`);
    }

    return this.mapFreeTierSetting(result.rows[0] as Record<string, unknown>);
  }

  async initializeFreeTierSettingsForTenant(tenantId: string): Promise<FreeTierServiceSetting[]> {
    const services: AWSServiceType[] = [
      'lambda', 'aurora', 'xray', 'cloudwatch', 'cost_explorer',
      'api_gateway', 'sqs', 's3', 'dynamodb', 'sns', 'ses'
    ];

    for (const service of services) {
      await executeStatement(
        `INSERT INTO aws_free_tier_settings (tenant_id, service, free_tier_enabled, paid_tier_enabled)
         VALUES ($1, $2, true, false)
         ON CONFLICT (tenant_id, service) DO NOTHING`,
        [stringParam('tenantId', tenantId), stringParam('service', service)]
      );
    }

    return this.getFreeTierSettings(tenantId);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidE164Phone(phone: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }

  private mapNotificationTarget(row: Record<string, unknown>): NotificationTarget {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      type: String(row.type) as 'email' | 'sms',
      value: String(row.value),
      name: String(row.name),
      enabled: Boolean(row.enabled),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapSpendThreshold(row: Record<string, unknown>): SpendThreshold {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      period: String(row.period) as SpendThreshold['period'],
      thresholdAmount: Number(row.threshold_amount),
      warningPercent: Number(row.warning_percent),
      enabled: Boolean(row.enabled),
      lastTriggeredAt: row.last_triggered_at ? String(row.last_triggered_at) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapMetricThreshold(row: Record<string, unknown>): MetricThreshold {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      metricType: String(row.metric_type) as MetricThreshold['metricType'],
      thresholdValue: Number(row.threshold_value),
      comparison: String(row.comparison) as MetricThreshold['comparison'],
      enabled: Boolean(row.enabled),
      lastTriggeredAt: row.last_triggered_at ? String(row.last_triggered_at) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapFreeTierSetting(row: Record<string, unknown>): FreeTierServiceSetting {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      service: String(row.service) as AWSServiceType,
      freeTierEnabled: Boolean(row.free_tier_enabled),
      paidTierEnabled: Boolean(row.paid_tier_enabled),
      autoScaleToPaid: Boolean(row.auto_scale_to_paid),
      maxPaidBudget: row.max_paid_budget ? Number(row.max_paid_budget) : undefined,
      enabledAt: String(row.enabled_at),
      enabledBy: row.enabled_by ? String(row.enabled_by) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}

export const monitoringNotificationsService = new MonitoringNotificationsService();
