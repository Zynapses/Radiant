// RADIANT v4.18.0 - Security Schedule Service
// Runtime-adjustable EventBridge schedules for security monitoring
// ============================================================================

import { executeStatement, stringParam, longParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import {
  EventBridgeClient,
  PutRuleCommand,
  DeleteRuleCommand,
  EnableRuleCommand,
  DisableRuleCommand,
  DescribeRuleCommand,
  ListRulesCommand,
  PutTargetsCommand,
} from '@aws-sdk/client-eventbridge';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// ============================================================================
// Types
// ============================================================================

export type ScheduleType = 
  | 'drift_detection'
  | 'anomaly_detection'
  | 'classification_review'
  | 'weekly_security_scan'
  | 'weekly_benchmark';

export interface ScheduleConfig {
  type: ScheduleType;
  enabled: boolean;
  cronExpression: string;
  description: string;
  lastExecution?: Date;
  nextExecution?: Date;
}

export interface SecurityScheduleConfig {
  tenantId: string;
  schedules: ScheduleConfig[];
  updatedAt: Date;
  updatedBy?: string;
}

export interface ScheduleExecution {
  id: string;
  tenantId: string;
  scheduleType: ScheduleType;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  itemsProcessed: number;
  itemsFlagged: number;
  errorsCount: number;
  executionTimeMs?: number;
  details: Record<string, unknown>;
  errorMessage?: string;
}

export interface ScheduleAuditEntry {
  id: string;
  tenantId: string;
  userId?: string;
  scheduleType: ScheduleType;
  action: 'created' | 'updated' | 'enabled' | 'disabled';
  oldCron?: string;
  newCron?: string;
  oldEnabled?: boolean;
  newEnabled?: boolean;
  reason?: string;
  createdAt: Date;
}

export interface UpdateScheduleRequest {
  type: ScheduleType;
  enabled?: boolean;
  cronExpression?: string;
  description?: string;
  reason?: string;
}

export interface ScheduleTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  schedules: Array<{
    type: ScheduleType;
    enabled: boolean;
    cronExpression: string;
  }>;
  isDefault: boolean;
  createdAt: Date;
}

export interface NotificationConfig {
  enabled: boolean;
  snsTopicArn?: string;
  slackWebhookUrl?: string;
  emailRecipients?: string[];
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

export interface CronParseResult {
  valid: boolean;
  humanReadable: string;
  nextExecutions: Date[];
  error?: string;
}

// Cron expression presets for common schedules
export const SCHEDULE_PRESETS: Record<string, { cron: string; label: string; description: string }> = {
  // Frequency presets
  every_5_minutes: { cron: '0/5 * * * ? *', label: 'Every 5 minutes', description: 'Runs every 5 minutes' },
  every_15_minutes: { cron: '0/15 * * * ? *', label: 'Every 15 minutes', description: 'Runs every 15 minutes' },
  every_30_minutes: { cron: '0/30 * * * ? *', label: 'Every 30 minutes', description: 'Runs every 30 minutes' },
  hourly: { cron: '0 * * * ? *', label: 'Hourly', description: 'Runs at the start of every hour' },
  every_2_hours: { cron: '0 0/2 * * ? *', label: 'Every 2 hours', description: 'Runs every 2 hours' },
  every_4_hours: { cron: '0 0/4 * * ? *', label: 'Every 4 hours', description: 'Runs every 4 hours' },
  every_6_hours: { cron: '0 0,6,12,18 * * ? *', label: 'Every 6 hours', description: 'Runs at 00:00, 06:00, 12:00, 18:00 UTC' },
  every_12_hours: { cron: '0 0,12 * * ? *', label: 'Every 12 hours', description: 'Runs at 00:00 and 12:00 UTC' },
  daily_midnight: { cron: '0 0 * * ? *', label: 'Daily at midnight', description: 'Runs daily at 00:00 UTC' },
  daily_6am: { cron: '0 6 * * ? *', label: 'Daily at 6 AM', description: 'Runs daily at 06:00 UTC' },
  daily_noon: { cron: '0 12 * * ? *', label: 'Daily at noon', description: 'Runs daily at 12:00 UTC' },
  weekly_sunday_2am: { cron: '0 2 ? * SUN *', label: 'Weekly Sunday 2 AM', description: 'Runs every Sunday at 02:00 UTC' },
  weekly_saturday_3am: { cron: '0 3 ? * SAT *', label: 'Weekly Saturday 3 AM', description: 'Runs every Saturday at 03:00 UTC' },
  weekly_monday_6am: { cron: '0 6 ? * MON *', label: 'Weekly Monday 6 AM', description: 'Runs every Monday at 06:00 UTC' },
  monthly_first_day: { cron: '0 0 1 * ? *', label: 'Monthly (1st)', description: 'Runs on the 1st of every month at 00:00 UTC' },
};

// Default schedules
const DEFAULT_SCHEDULES: Record<ScheduleType, { cron: string; description: string }> = {
  drift_detection: { cron: '0 0 * * ? *', description: 'Daily at midnight UTC' },
  anomaly_detection: { cron: '0 * * * ? *', description: 'Every hour' },
  classification_review: { cron: '0 0,6,12,18 * * ? *', description: 'Every 6 hours' },
  weekly_security_scan: { cron: '0 2 ? * SUN *', description: 'Sunday at 2 AM UTC' },
  weekly_benchmark: { cron: '0 3 ? * SAT *', description: 'Saturday at 3 AM UTC' },
};

// ============================================================================
// Security Schedule Service
// ============================================================================

class SecurityScheduleService {
  private eventBridge: EventBridgeClient;
  private lambdaClient: LambdaClient;
  private snsClient: SNSClient;
  private environment: string;

  constructor() {
    this.eventBridge = new EventBridgeClient({});
    this.lambdaClient = new LambdaClient({});
    this.snsClient = new SNSClient({});
    this.environment = process.env.ENVIRONMENT || 'dev';
  }

  // ==========================================================================
  // Cron Parsing & Next Execution Time
  // ==========================================================================

  parseCronExpression(cronExpression: string): CronParseResult {
    const parts = cronExpression.trim().split(/\s+/);
    
    if (parts.length !== 6) {
      return {
        valid: false,
        humanReadable: 'Invalid format',
        nextExecutions: [],
        error: 'Cron expression must have 6 parts: Minutes Hours Day-of-month Month Day-of-week Year',
      };
    }

    const [minutes, hours, dayOfMonth, month, dayOfWeek, year] = parts;

    // Generate human-readable description
    const humanReadable = this.generateHumanReadable(minutes, hours, dayOfMonth, month, dayOfWeek);
    
    // Calculate next executions
    const nextExecutions = this.calculateNextExecutions(cronExpression, 5);

    return {
      valid: true,
      humanReadable,
      nextExecutions,
    };
  }

  private generateHumanReadable(minutes: string, hours: string, dayOfMonth: string, month: string, dayOfWeek: string): string {
    const descriptions: string[] = [];

    // Time
    if (minutes === '0' && hours === '*') {
      descriptions.push('Every hour at :00');
    } else if (minutes.includes('/')) {
      const interval = minutes.split('/')[1];
      descriptions.push(`Every ${interval} minutes`);
    } else if (hours.includes('/')) {
      const interval = hours.split('/')[1];
      descriptions.push(`Every ${interval} hours`);
    } else if (hours.includes(',')) {
      const hourList = hours.split(',').map(h => `${h}:00`).join(', ');
      descriptions.push(`At ${hourList} UTC`);
    } else if (hours !== '*' && minutes !== '*') {
      descriptions.push(`At ${hours.padStart(2, '0')}:${minutes.padStart(2, '0')} UTC`);
    }

    // Day of week
    const dayNames: Record<string, string> = {
      'SUN': 'Sunday', 'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday',
      'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday',
      '1': 'Sunday', '2': 'Monday', '3': 'Tuesday', '4': 'Wednesday',
      '5': 'Thursday', '6': 'Friday', '7': 'Saturday',
    };
    
    if (dayOfWeek !== '?' && dayOfWeek !== '*') {
      const days = dayOfWeek.split(',').map(d => dayNames[d] || d).join(', ');
      descriptions.push(`on ${days}`);
    }

    // Day of month
    if (dayOfMonth !== '?' && dayOfMonth !== '*') {
      if (dayOfMonth === '1') {
        descriptions.push('on the 1st of each month');
      } else if (dayOfMonth === 'L') {
        descriptions.push('on the last day of each month');
      } else {
        descriptions.push(`on day ${dayOfMonth}`);
      }
    }

    // Month
    if (month !== '*' && month !== '?') {
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      if (/^\d+$/.test(month)) {
        descriptions.push(`in ${monthNames[parseInt(month)]}`);
      }
    }

    return descriptions.join(' ') || 'Custom schedule';
  }

  private calculateNextExecutions(cronExpression: string, count: number): Date[] {
    // Simplified next execution calculator for common patterns
    const parts = cronExpression.trim().split(/\s+/);
    const [minutes, hours, dayOfMonth, month, dayOfWeek] = parts;
    const executions: Date[] = [];
    
    let current = new Date();
    current.setSeconds(0);
    current.setMilliseconds(0);

    for (let i = 0; i < count && executions.length < count; i++) {
      const next = this.findNextExecution(current, minutes, hours, dayOfMonth, dayOfWeek);
      if (next) {
        executions.push(next);
        current = new Date(next.getTime() + 60000); // Move 1 minute forward
      } else {
        break;
      }
    }

    return executions;
  }

  private findNextExecution(from: Date, minutes: string, hours: string, dayOfMonth: string, dayOfWeek: string): Date | null {
    const maxIterations = 366 * 24 * 60; // Max 1 year of minutes
    let current = new Date(from);

    for (let i = 0; i < maxIterations; i++) {
      current = new Date(current.getTime() + 60000); // Add 1 minute

      // Check if matches
      if (this.matchesCronField(current.getUTCMinutes(), minutes) &&
          this.matchesCronField(current.getUTCHours(), hours) &&
          this.matchesCronDayOfMonth(current.getUTCDate(), dayOfMonth) &&
          this.matchesCronDayOfWeek(current.getUTCDay(), dayOfWeek)) {
        return current;
      }
    }

    return null;
  }

  private matchesCronField(value: number, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.includes('/')) {
      const [start, interval] = pattern.split('/');
      const startVal = start === '*' || start === '0' ? 0 : parseInt(start);
      return (value - startVal) % parseInt(interval) === 0 && value >= startVal;
    }
    if (pattern.includes(',')) {
      return pattern.split(',').map(p => parseInt(p)).includes(value);
    }
    if (pattern.includes('-')) {
      const [min, max] = pattern.split('-').map(p => parseInt(p));
      return value >= min && value <= max;
    }
    return parseInt(pattern) === value;
  }

  private matchesCronDayOfMonth(value: number, pattern: string): boolean {
    if (pattern === '?' || pattern === '*') return true;
    return this.matchesCronField(value, pattern);
  }

  private matchesCronDayOfWeek(value: number, pattern: string): boolean {
    if (pattern === '?' || pattern === '*') return true;
    const dayMap: Record<string, number> = {
      'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6,
    };
    const normalizedPattern = pattern.split(',').map(p => {
      const upper = p.toUpperCase();
      return dayMap[upper] !== undefined ? dayMap[upper].toString() : p;
    }).join(',');
    return this.matchesCronField(value, normalizedPattern);
  }

  // ==========================================================================
  // Run Now - Actually Invoke Lambda
  // ==========================================================================

  async runNow(
    tenantId: string,
    scheduleType: ScheduleType,
    options?: { dryRun?: boolean }
  ): Promise<{ executionId: string; invoked: boolean; dryRun: boolean }> {
    // Start execution record
    const executionId = await this.startExecution(tenantId, scheduleType);

    if (options?.dryRun) {
      // Dry run - just validate without invoking
      await this.completeExecution(executionId, {
        status: 'completed',
        details: { dryRun: true, message: 'Dry run completed successfully' },
      });
      return { executionId, invoked: false, dryRun: true };
    }

    // Get the appropriate Lambda ARN
    const lambdaArn = scheduleType === 'weekly_benchmark'
      ? process.env.BENCHMARK_LAMBDA_ARN
      : process.env.SECURITY_MONITORING_LAMBDA_ARN;

    if (!lambdaArn) {
      await this.completeExecution(executionId, {
        status: 'failed',
        errorMessage: `Lambda ARN not configured for ${scheduleType}`,
      });
      throw new Error(`Lambda ARN not configured for ${scheduleType}`);
    }

    try {
      // Invoke Lambda asynchronously
      await this.lambdaClient.send(new InvokeCommand({
        FunctionName: lambdaArn,
        InvocationType: 'Event', // Async invocation
        Payload: JSON.stringify({
          type: scheduleType,
          tenantId,
          source: 'manual',
          executionId,
        }),
      }));

      logger.info('Lambda invoked for manual run', { scheduleType, tenantId, executionId });
      return { executionId, invoked: true, dryRun: false };
    } catch (error) {
      await this.completeExecution(executionId, {
        status: 'failed',
        errorMessage: `Failed to invoke Lambda: ${String(error)}`,
      });
      throw error;
    }
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  async enableAllSchedules(tenantId: string, userId: string, reason?: string): Promise<SecurityScheduleConfig> {
    const scheduleTypes: ScheduleType[] = [
      'drift_detection', 'anomaly_detection', 'classification_review',
      'weekly_security_scan', 'weekly_benchmark'
    ];

    for (const type of scheduleTypes) {
      await this.updateSchedule(tenantId, userId, { type, enabled: true, reason: reason || 'Bulk enable all schedules' });
    }

    return this.getConfig(tenantId);
  }

  async disableAllSchedules(tenantId: string, userId: string, reason?: string): Promise<SecurityScheduleConfig> {
    const scheduleTypes: ScheduleType[] = [
      'drift_detection', 'anomaly_detection', 'classification_review',
      'weekly_security_scan', 'weekly_benchmark'
    ];

    for (const type of scheduleTypes) {
      await this.updateSchedule(tenantId, userId, { type, enabled: false, reason: reason || 'Bulk disable all schedules' });
    }

    return this.getConfig(tenantId);
  }

  // ==========================================================================
  // Schedule Templates
  // ==========================================================================

  async getTemplates(tenantId: string): Promise<ScheduleTemplate[]> {
    const result = await executeStatement(
      `SELECT * FROM security_schedule_templates WHERE tenant_id = $1::uuid OR is_default = true ORDER BY is_default DESC, name`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(this.mapTemplateFromRow);
  }

  async saveTemplate(
    tenantId: string,
    template: { name: string; description: string; schedules: Array<{ type: ScheduleType; enabled: boolean; cronExpression: string }> }
  ): Promise<ScheduleTemplate> {
    const result = await executeStatement(
      `INSERT INTO security_schedule_templates (tenant_id, name, description, schedules, is_default)
       VALUES ($1::uuid, $2, $3, $4::jsonb, false)
       RETURNING id`,
      [
        stringParam('tenantId', tenantId),
        stringParam('name', template.name),
        stringParam('description', template.description),
        stringParam('schedules', JSON.stringify(template.schedules)),
      ]
    );

    const templates = await this.getTemplates(tenantId);
    return templates.find(t => t.id === String(result.rows?.[0]?.id))!;
  }

  async applyTemplate(tenantId: string, userId: string, templateId: string): Promise<SecurityScheduleConfig> {
    const templates = await this.getTemplates(tenantId);
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    for (const schedule of template.schedules) {
      await this.updateSchedule(tenantId, userId, {
        type: schedule.type,
        enabled: schedule.enabled,
        cronExpression: schedule.cronExpression,
        reason: `Applied template: ${template.name}`,
      });
    }

    return this.getConfig(tenantId);
  }

  async deleteTemplate(tenantId: string, templateId: string): Promise<void> {
    await executeStatement(
      `DELETE FROM security_schedule_templates WHERE id = $1::uuid AND tenant_id = $2::uuid AND is_default = false`,
      [stringParam('templateId', templateId), stringParam('tenantId', tenantId)]
    );
  }

  private mapTemplateFromRow(row: Record<string, unknown>): ScheduleTemplate {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      name: String(row.name),
      description: String(row.description || ''),
      schedules: (row.schedules as Array<{ type: ScheduleType; enabled: boolean; cronExpression: string }>) || [],
      isDefault: row.is_default === true,
      createdAt: new Date(row.created_at as string),
    };
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  async getNotificationConfig(tenantId: string): Promise<NotificationConfig> {
    const result = await executeStatement(
      `SELECT * FROM security_schedule_notifications WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.length) {
      return {
        enabled: false,
        notifyOnSuccess: false,
        notifyOnFailure: true,
      };
    }

    const row = result.rows[0];
    return {
      enabled: row.enabled === true,
      snsTopicArn: row.sns_topic_arn ? String(row.sns_topic_arn) : undefined,
      slackWebhookUrl: row.slack_webhook_url ? String(row.slack_webhook_url) : undefined,
      emailRecipients: (row.email_recipients as string[]) || [],
      notifyOnSuccess: row.notify_on_success === true,
      notifyOnFailure: row.notify_on_failure !== false,
    };
  }

  async updateNotificationConfig(tenantId: string, config: Partial<NotificationConfig>): Promise<NotificationConfig> {
    await executeStatement(
      `INSERT INTO security_schedule_notifications (tenant_id, enabled, sns_topic_arn, slack_webhook_url, email_recipients, notify_on_success, notify_on_failure)
       VALUES ($1::uuid, $2, $3, $4, $5::text[], $6, $7)
       ON CONFLICT (tenant_id) DO UPDATE SET
         enabled = COALESCE($2, security_schedule_notifications.enabled),
         sns_topic_arn = COALESCE($3, security_schedule_notifications.sns_topic_arn),
         slack_webhook_url = COALESCE($4, security_schedule_notifications.slack_webhook_url),
         email_recipients = COALESCE($5::text[], security_schedule_notifications.email_recipients),
         notify_on_success = COALESCE($6, security_schedule_notifications.notify_on_success),
         notify_on_failure = COALESCE($7, security_schedule_notifications.notify_on_failure),
         updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        boolParam('enabled', config.enabled ?? false),
        stringParam('snsTopicArn', config.snsTopicArn || ''),
        stringParam('slackWebhookUrl', config.slackWebhookUrl || ''),
        stringParam('emailRecipients', JSON.stringify(config.emailRecipients || [])),
        boolParam('notifyOnSuccess', config.notifyOnSuccess ?? false),
        boolParam('notifyOnFailure', config.notifyOnFailure ?? true),
      ]
    );

    return this.getNotificationConfig(tenantId);
  }

  async sendExecutionNotification(
    tenantId: string,
    execution: ScheduleExecution
  ): Promise<void> {
    const config = await this.getNotificationConfig(tenantId);

    if (!config.enabled) return;
    if (execution.status === 'completed' && !config.notifyOnSuccess) return;
    if (execution.status === 'failed' && !config.notifyOnFailure) return;
    if (execution.status === 'running') return;

    const message = this.formatNotificationMessage(execution);

    // Send to SNS
    if (config.snsTopicArn) {
      try {
        await this.snsClient.send(new PublishCommand({
          TopicArn: config.snsTopicArn,
          Subject: `Security Schedule ${execution.status}: ${execution.scheduleType}`,
          Message: message,
        }));
      } catch (error) {
        logger.error('Failed to send SNS notification', { error: String(error) });
      }
    }

    // Send to Slack
    if (config.slackWebhookUrl) {
      try {
        await this.sendSlackNotification(config.slackWebhookUrl, execution);
      } catch (error) {
        logger.error('Failed to send Slack notification', { error: String(error) });
      }
    }
  }

  private formatNotificationMessage(execution: ScheduleExecution): string {
    const statusEmoji = execution.status === 'completed' ? '✅' : '❌';
    return `${statusEmoji} Security Schedule Execution ${execution.status.toUpperCase()}

Schedule: ${execution.scheduleType}
Started: ${execution.startedAt.toISOString()}
${execution.completedAt ? `Completed: ${execution.completedAt.toISOString()}` : ''}
Duration: ${execution.executionTimeMs ? `${(execution.executionTimeMs / 1000).toFixed(1)}s` : 'N/A'}

Results:
- Items Processed: ${execution.itemsProcessed}
- Items Flagged: ${execution.itemsFlagged}
- Errors: ${execution.errorsCount}

${execution.errorMessage ? `Error: ${execution.errorMessage}` : ''}`;
  }

  private async sendSlackNotification(webhookUrl: string, execution: ScheduleExecution): Promise<void> {
    const color = execution.status === 'completed' ? '#36a64f' : '#ff0000';
    const payload = {
      attachments: [{
        color,
        title: `Security Schedule ${execution.status}: ${execution.scheduleType}`,
        fields: [
          { title: 'Status', value: execution.status, short: true },
          { title: 'Duration', value: execution.executionTimeMs ? `${(execution.executionTimeMs / 1000).toFixed(1)}s` : 'N/A', short: true },
          { title: 'Items Processed', value: String(execution.itemsProcessed), short: true },
          { title: 'Items Flagged', value: String(execution.itemsFlagged), short: true },
        ],
        footer: 'RADIANT Security',
        ts: Math.floor(Date.now() / 1000),
      }],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  // ==========================================================================
  // Webhook Notifications
  // ==========================================================================

  async registerWebhook(
    tenantId: string,
    webhook: { url: string; events: string[]; secret?: string }
  ): Promise<{ id: string }> {
    const result = await executeStatement(
      `INSERT INTO security_schedule_webhooks (tenant_id, url, events, secret, enabled)
       VALUES ($1::uuid, $2, $3::text[], $4, true)
       RETURNING id`,
      [
        stringParam('tenantId', tenantId),
        stringParam('url', webhook.url),
        stringParam('events', JSON.stringify(webhook.events)),
        stringParam('secret', webhook.secret || ''),
      ]
    );

    return { id: String(result.rows?.[0]?.id) };
  }

  async getWebhooks(tenantId: string): Promise<Array<{ id: string; url: string; events: string[]; enabled: boolean }>> {
    const result = await executeStatement(
      `SELECT id, url, events, enabled FROM security_schedule_webhooks WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => ({
      id: String(row.id),
      url: String(row.url),
      events: (row.events as string[]) || [],
      enabled: row.enabled === true,
    }));
  }

  async deleteWebhook(tenantId: string, webhookId: string): Promise<void> {
    await executeStatement(
      `DELETE FROM security_schedule_webhooks WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [stringParam('webhookId', webhookId), stringParam('tenantId', tenantId)]
    );
  }

  async triggerWebhooks(tenantId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const webhooks = await this.getWebhooks(tenantId);
    const matchingWebhooks = webhooks.filter(w => w.enabled && w.events.includes(event));

    for (const webhook of matchingWebhooks) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
        });
      } catch (error) {
        logger.error('Failed to trigger webhook', { webhookId: webhook.id, error: String(error) });
      }
    }
  }

  // ==========================================================================
  // Configuration Management
  // ==========================================================================

  async getConfig(tenantId: string): Promise<SecurityScheduleConfig> {
    const result = await executeStatement(
      `SELECT * FROM security_schedule_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.length) {
      // Return default config
      return this.getDefaultConfig(tenantId);
    }

    return this.mapConfigFromRow(result.rows[0]);
  }

  async updateSchedule(
    tenantId: string,
    userId: string,
    request: UpdateScheduleRequest
  ): Promise<SecurityScheduleConfig> {
    const currentConfig = await this.getConfig(tenantId);
    const currentSchedule = currentConfig.schedules.find(s => s.type === request.type);

    // Build update query dynamically based on schedule type
    const columnPrefix = this.getColumnPrefix(request.type);
    const updates: string[] = [];
    const params = [stringParam('tenantId', tenantId)];
    let paramIndex = 2;

    if (request.enabled !== undefined) {
      updates.push(`${columnPrefix}_enabled = $${paramIndex}`);
      params.push(boolParam('enabled', request.enabled));
      paramIndex++;
    }

    if (request.cronExpression !== undefined) {
      // Validate cron expression
      if (!this.isValidCronExpression(request.cronExpression)) {
        throw new Error(`Invalid cron expression: ${request.cronExpression}`);
      }
      updates.push(`${columnPrefix}_cron = $${paramIndex}`);
      params.push(stringParam('cron', request.cronExpression));
      paramIndex++;
    }

    if (request.description !== undefined) {
      updates.push(`${columnPrefix}_description = $${paramIndex}`);
      params.push(stringParam('description', request.description));
      paramIndex++;
    }

    params.push(stringParam('userId', userId));
    updates.push(`updated_by = $${paramIndex}::uuid`);

    // Upsert config
    await executeStatement(
      `INSERT INTO security_schedule_config (tenant_id, ${columnPrefix}_enabled, ${columnPrefix}_cron, ${columnPrefix}_description, updated_by)
       VALUES ($1::uuid, $2, $3, $4, $5::uuid)
       ON CONFLICT (tenant_id) DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()`,
      params
    );

    // Log audit entry
    await this.logAudit(tenantId, userId, {
      scheduleType: request.type,
      action: request.enabled !== undefined ? (request.enabled ? 'enabled' : 'disabled') : 'updated',
      oldCron: currentSchedule?.cronExpression,
      newCron: request.cronExpression,
      oldEnabled: currentSchedule?.enabled,
      newEnabled: request.enabled,
      reason: request.reason,
    });

    // Update EventBridge rule
    await this.syncEventBridgeRule(tenantId, request.type, {
      enabled: request.enabled ?? currentSchedule?.enabled ?? true,
      cronExpression: request.cronExpression ?? currentSchedule?.cronExpression ?? DEFAULT_SCHEDULES[request.type].cron,
    });

    return this.getConfig(tenantId);
  }

  async enableSchedule(tenantId: string, userId: string, type: ScheduleType, reason?: string): Promise<void> {
    await this.updateSchedule(tenantId, userId, { type, enabled: true, reason });
  }

  async disableSchedule(tenantId: string, userId: string, type: ScheduleType, reason?: string): Promise<void> {
    await this.updateSchedule(tenantId, userId, { type, enabled: false, reason });
  }

  // ==========================================================================
  // Execution Tracking
  // ==========================================================================

  async startExecution(tenantId: string, scheduleType: ScheduleType): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO security_schedule_executions (tenant_id, schedule_type, status)
       VALUES ($1::uuid, $2, 'running')
       RETURNING id`,
      [stringParam('tenantId', tenantId), stringParam('scheduleType', scheduleType)]
    );

    return String(result.rows?.[0]?.id);
  }

  async completeExecution(
    executionId: string,
    result: {
      status: 'completed' | 'failed';
      itemsProcessed?: number;
      itemsFlagged?: number;
      errorsCount?: number;
      details?: Record<string, unknown>;
      errorMessage?: string;
    }
  ): Promise<void> {
    await executeStatement(
      `UPDATE security_schedule_executions
       SET completed_at = NOW(),
           status = $2,
           items_processed = $3,
           items_flagged = $4,
           errors_count = $5,
           execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
           details = $6::jsonb,
           error_message = $7
       WHERE id = $1::uuid`,
      [
        stringParam('executionId', executionId),
        stringParam('status', result.status),
        longParam('itemsProcessed', result.itemsProcessed ?? 0),
        longParam('itemsFlagged', result.itemsFlagged ?? 0),
        longParam('errorsCount', result.errorsCount ?? 0),
        stringParam('details', JSON.stringify(result.details || {})),
        stringParam('errorMessage', result.errorMessage || ''),
      ]
    );
  }

  async getRecentExecutions(
    tenantId: string,
    options?: { scheduleType?: ScheduleType; limit?: number; since?: Date }
  ): Promise<ScheduleExecution[]> {
    let query = `SELECT * FROM security_schedule_executions WHERE tenant_id = $1::uuid`;
    const params = [stringParam('tenantId', tenantId)];
    let paramIndex = 2;

    if (options?.scheduleType) {
      query += ` AND schedule_type = $${paramIndex}`;
      params.push(stringParam('scheduleType', options.scheduleType));
      paramIndex++;
    }

    if (options?.since) {
      query += ` AND started_at >= $${paramIndex}`;
      params.push(stringParam('since', options.since.toISOString()));
      paramIndex++;
    }

    query += ` ORDER BY started_at DESC LIMIT $${paramIndex}`;
    params.push(longParam('limit', options?.limit ?? 50));

    const result = await executeStatement(query, params);
    return (result.rows || []).map(this.mapExecutionFromRow);
  }

  async getExecutionStats(tenantId: string, days: number = 30): Promise<{
    byType: Record<ScheduleType, { total: number; successful: number; failed: number; avgDurationMs: number }>;
    totalExecutions: number;
    successRate: number;
  }> {
    const result = await executeStatement(
      `SELECT 
         schedule_type,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'completed') as successful,
         COUNT(*) FILTER (WHERE status = 'failed') as failed,
         AVG(execution_time_ms) FILTER (WHERE status = 'completed') as avg_duration_ms
       FROM security_schedule_executions
       WHERE tenant_id = $1::uuid
         AND started_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY schedule_type`,
      [stringParam('tenantId', tenantId), longParam('days', days)]
    );

    const byType: Record<string, { total: number; successful: number; failed: number; avgDurationMs: number }> = {};
    let totalExecutions = 0;
    let totalSuccessful = 0;

    for (const row of result.rows || []) {
      const type = String(row.schedule_type) as ScheduleType;
      byType[type] = {
        total: Number(row.total),
        successful: Number(row.successful),
        failed: Number(row.failed),
        avgDurationMs: Math.round(Number(row.avg_duration_ms) || 0),
      };
      totalExecutions += Number(row.total);
      totalSuccessful += Number(row.successful);
    }

    return {
      byType: byType as Record<ScheduleType, { total: number; successful: number; failed: number; avgDurationMs: number }>,
      totalExecutions,
      successRate: totalExecutions > 0 ? totalSuccessful / totalExecutions : 1,
    };
  }

  // ==========================================================================
  // Audit Log
  // ==========================================================================

  async getAuditLog(
    tenantId: string,
    options?: { scheduleType?: ScheduleType; limit?: number }
  ): Promise<ScheduleAuditEntry[]> {
    let query = `SELECT * FROM security_schedule_audit WHERE tenant_id = $1::uuid`;
    const params = [stringParam('tenantId', tenantId)];
    let paramIndex = 2;

    if (options?.scheduleType) {
      query += ` AND schedule_type = $${paramIndex}`;
      params.push(stringParam('scheduleType', options.scheduleType));
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(longParam('limit', options?.limit ?? 100));

    const result = await executeStatement(query, params);
    return (result.rows || []).map(this.mapAuditFromRow);
  }

  private async logAudit(
    tenantId: string,
    userId: string,
    entry: {
      scheduleType: ScheduleType;
      action: string;
      oldCron?: string;
      newCron?: string;
      oldEnabled?: boolean;
      newEnabled?: boolean;
      reason?: string;
    }
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO security_schedule_audit 
       (tenant_id, user_id, schedule_type, action, old_cron, new_cron, old_enabled, new_enabled, reason)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('scheduleType', entry.scheduleType),
        stringParam('action', entry.action),
        stringParam('oldCron', entry.oldCron || ''),
        stringParam('newCron', entry.newCron || ''),
        boolParam('oldEnabled', entry.oldEnabled ?? true),
        boolParam('newEnabled', entry.newEnabled ?? true),
        stringParam('reason', entry.reason || ''),
      ]
    );
  }

  // ==========================================================================
  // EventBridge Integration
  // ==========================================================================

  private async syncEventBridgeRule(
    tenantId: string,
    scheduleType: ScheduleType,
    config: { enabled: boolean; cronExpression: string }
  ): Promise<void> {
    const ruleName = this.getRuleName(tenantId, scheduleType);

    try {
      if (config.enabled) {
        // Create or update the rule
        await this.eventBridge.send(new PutRuleCommand({
          Name: ruleName,
          ScheduleExpression: `cron(${config.cronExpression})`,
          State: 'ENABLED',
          Description: `RADIANT security ${scheduleType} for tenant ${tenantId}`,
        }));

        // Add target (Lambda function)
        const targetArn = process.env.SECURITY_MONITORING_LAMBDA_ARN;
        if (targetArn) {
          await this.eventBridge.send(new PutTargetsCommand({
            Rule: ruleName,
            Targets: [{
              Id: `${scheduleType}-target`,
              Arn: targetArn,
              Input: JSON.stringify({
                type: scheduleType,
                tenantId,
                source: 'scheduled',
              }),
            }],
          }));
        }

        logger.info('EventBridge rule synced', { ruleName, tenantId, scheduleType });
      } else {
        // Disable the rule
        await this.eventBridge.send(new DisableRuleCommand({ Name: ruleName }));
        logger.info('EventBridge rule disabled', { ruleName, tenantId, scheduleType });
      }
    } catch (error) {
      logger.error('Failed to sync EventBridge rule', {
        error: String(error),
        ruleName,
        tenantId,
        scheduleType,
      });
      throw error;
    }
  }

  async getRuleStatus(tenantId: string, scheduleType: ScheduleType): Promise<{
    exists: boolean;
    enabled: boolean;
    schedule?: string;
  }> {
    const ruleName = this.getRuleName(tenantId, scheduleType);

    try {
      const response = await this.eventBridge.send(new DescribeRuleCommand({ Name: ruleName }));
      return {
        exists: true,
        enabled: response.State === 'ENABLED',
        schedule: response.ScheduleExpression,
      };
    } catch (error) {
      return { exists: false, enabled: false };
    }
  }

  private getRuleName(tenantId: string, scheduleType: ScheduleType): string {
    const shortTenantId = tenantId.substring(0, 8);
    return `radiant-${scheduleType.replace(/_/g, '-')}-${shortTenantId}-${this.environment}`;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getDefaultConfig(tenantId: string): SecurityScheduleConfig {
    return {
      tenantId,
      schedules: Object.entries(DEFAULT_SCHEDULES).map(([type, config]) => ({
        type: type as ScheduleType,
        enabled: true,
        cronExpression: config.cron,
        description: config.description,
      })),
      updatedAt: new Date(),
    };
  }

  private getColumnPrefix(type: ScheduleType): string {
    return type; // Column names match schedule type with underscores
  }

  private isValidCronExpression(cron: string): boolean {
    // Basic validation for AWS EventBridge cron format
    // Format: Minutes Hours Day-of-month Month Day-of-week Year
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 6) return false;

    // Check each field has valid characters
    const validChars = /^[0-9,\-\*\/\?LW#]+$/;
    return parts.every(part => validChars.test(part));
  }

  private mapConfigFromRow(row: Record<string, unknown>): SecurityScheduleConfig {
    return {
      tenantId: String(row.tenant_id),
      schedules: [
        {
          type: 'drift_detection',
          enabled: row.drift_detection_enabled !== false,
          cronExpression: String(row.drift_detection_cron || DEFAULT_SCHEDULES.drift_detection.cron),
          description: String(row.drift_detection_description || DEFAULT_SCHEDULES.drift_detection.description),
        },
        {
          type: 'anomaly_detection',
          enabled: row.anomaly_detection_enabled !== false,
          cronExpression: String(row.anomaly_detection_cron || DEFAULT_SCHEDULES.anomaly_detection.cron),
          description: String(row.anomaly_detection_description || DEFAULT_SCHEDULES.anomaly_detection.description),
        },
        {
          type: 'classification_review',
          enabled: row.classification_review_enabled !== false,
          cronExpression: String(row.classification_review_cron || DEFAULT_SCHEDULES.classification_review.cron),
          description: String(row.classification_review_description || DEFAULT_SCHEDULES.classification_review.description),
        },
        {
          type: 'weekly_security_scan',
          enabled: row.weekly_security_scan_enabled !== false,
          cronExpression: String(row.weekly_security_scan_cron || DEFAULT_SCHEDULES.weekly_security_scan.cron),
          description: String(row.weekly_security_scan_description || DEFAULT_SCHEDULES.weekly_security_scan.description),
        },
        {
          type: 'weekly_benchmark',
          enabled: row.weekly_benchmark_enabled !== false,
          cronExpression: String(row.weekly_benchmark_cron || DEFAULT_SCHEDULES.weekly_benchmark.cron),
          description: String(row.weekly_benchmark_description || DEFAULT_SCHEDULES.weekly_benchmark.description),
        },
      ],
      updatedAt: new Date(row.updated_at as string),
      updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    };
  }

  private mapExecutionFromRow(row: Record<string, unknown>): ScheduleExecution {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      scheduleType: row.schedule_type as ScheduleType,
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      status: row.status as 'running' | 'completed' | 'failed',
      itemsProcessed: Number(row.items_processed || 0),
      itemsFlagged: Number(row.items_flagged || 0),
      errorsCount: Number(row.errors_count || 0),
      executionTimeMs: row.execution_time_ms ? Number(row.execution_time_ms) : undefined,
      details: (row.details as Record<string, unknown>) || {},
      errorMessage: row.error_message ? String(row.error_message) : undefined,
    };
  }

  private mapAuditFromRow(row: Record<string, unknown>): ScheduleAuditEntry {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      userId: row.user_id ? String(row.user_id) : undefined,
      scheduleType: row.schedule_type as ScheduleType,
      action: row.action as 'created' | 'updated' | 'enabled' | 'disabled',
      oldCron: row.old_cron ? String(row.old_cron) : undefined,
      newCron: row.new_cron ? String(row.new_cron) : undefined,
      oldEnabled: row.old_enabled as boolean | undefined,
      newEnabled: row.new_enabled as boolean | undefined,
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

export const securityScheduleService = new SecurityScheduleService();
