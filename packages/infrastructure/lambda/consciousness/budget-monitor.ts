/**
 * Consciousness Budget Monitor Lambda
 * 
 * Monitors and enforces spending limits for consciousness engine usage.
 * Runs every 15 minutes via EventBridge.
 */

import { Handler, ScheduledEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { executeStatement } from '../shared/db/client';
import { logger } from '../shared/logger';

const snsClient = new SNSClient({});
const sesClient = new SESClient({});

interface TenantBudget {
  tenantId: string;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  alertThreshold: number; // 0-1, percentage at which to alert
  todaySpend: number;
  monthSpend: number;
  isEnabled: boolean;
  isOverLimit: boolean;
}

interface BudgetAlert {
  tenantId: string;
  alertType: 'warning' | 'limit_reached' | 'limit_exceeded';
  currentSpend: number;
  limit: number;
  period: 'daily' | 'monthly';
  message: string;
}

export const handler: Handler<ScheduledEvent> = async () => {
  logger.info('Starting consciousness budget monitor');

  try {
    // Get all tenants with consciousness budget configuration
    const tenants = await getTenantBudgets();
    
    const alerts: BudgetAlert[] = [];
    const overLimitTenants: string[] = [];

    for (const tenant of tenants) {
      // Check daily limit
      if (tenant.dailyLimitUsd > 0) {
        const dailyPercentage = tenant.todaySpend / tenant.dailyLimitUsd;
        
        if (dailyPercentage >= 1) {
          // Over daily limit
          overLimitTenants.push(tenant.tenantId);
          alerts.push({
            tenantId: tenant.tenantId,
            alertType: 'limit_exceeded',
            currentSpend: tenant.todaySpend,
            limit: tenant.dailyLimitUsd,
            period: 'daily',
            message: `Daily consciousness budget exceeded: $${tenant.todaySpend.toFixed(2)} / $${tenant.dailyLimitUsd.toFixed(2)}`,
          });
        } else if (dailyPercentage >= tenant.alertThreshold) {
          // Approaching daily limit
          alerts.push({
            tenantId: tenant.tenantId,
            alertType: 'warning',
            currentSpend: tenant.todaySpend,
            limit: tenant.dailyLimitUsd,
            period: 'daily',
            message: `Daily consciousness budget at ${(dailyPercentage * 100).toFixed(0)}%: $${tenant.todaySpend.toFixed(2)} / $${tenant.dailyLimitUsd.toFixed(2)}`,
          });
        }
      }

      // Check monthly limit
      if (tenant.monthlyLimitUsd > 0) {
        const monthlyPercentage = tenant.monthSpend / tenant.monthlyLimitUsd;
        
        if (monthlyPercentage >= 1) {
          // Over monthly limit
          if (!overLimitTenants.includes(tenant.tenantId)) {
            overLimitTenants.push(tenant.tenantId);
          }
          alerts.push({
            tenantId: tenant.tenantId,
            alertType: 'limit_exceeded',
            currentSpend: tenant.monthSpend,
            limit: tenant.monthlyLimitUsd,
            period: 'monthly',
            message: `Monthly consciousness budget exceeded: $${tenant.monthSpend.toFixed(2)} / $${tenant.monthlyLimitUsd.toFixed(2)}`,
          });
        } else if (monthlyPercentage >= tenant.alertThreshold) {
          // Approaching monthly limit
          alerts.push({
            tenantId: tenant.tenantId,
            alertType: 'warning',
            currentSpend: tenant.monthSpend,
            limit: tenant.monthlyLimitUsd,
            period: 'monthly',
            message: `Monthly consciousness budget at ${(monthlyPercentage * 100).toFixed(0)}%: $${tenant.monthSpend.toFixed(2)} / $${tenant.monthlyLimitUsd.toFixed(2)}`,
          });
        }
      }
    }

    // Disable consciousness for over-limit tenants
    if (overLimitTenants.length > 0) {
      await disableConsciousnessForTenants(overLimitTenants);
    }

    // Save alerts
    if (alerts.length > 0) {
      await saveAlerts(alerts);
    }

    // Update aggregate stats
    await updateAggregateStats();

    logger.info('Budget monitor completed', {
      tenantsChecked: tenants.length,
      alertsGenerated: alerts.length,
      tenantsDisabled: overLimitTenants.length,
    });

    return {
      status: 'completed',
      tenantsChecked: tenants.length,
      alertsGenerated: alerts.length,
      tenantsDisabled: overLimitTenants.length,
    };
  } catch (error) {
    logger.error(`Budget monitor failed: ${String(error)}`);
    throw error;
  }
};

async function getTenantBudgets(): Promise<TenantBudget[]> {
  // Get budget configuration for all tenants
  const configResult = await executeStatement(
    `SELECT 
      cb.tenant_id,
      cb.daily_limit_usd,
      cb.monthly_limit_usd,
      cb.alert_threshold,
      cb.is_enabled,
      COALESCE(today.total_cost_usd, 0) as today_spend,
      COALESCE(month.total_cost_usd, 0) as month_spend
     FROM consciousness_budget_config cb
     LEFT JOIN consciousness_cost_aggregates today 
       ON cb.tenant_id = today.tenant_id AND today.date = CURRENT_DATE
     LEFT JOIN (
       SELECT tenant_id, SUM(total_cost_usd) as total_cost_usd
       FROM consciousness_cost_aggregates
       WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY tenant_id
     ) month ON cb.tenant_id = month.tenant_id
     WHERE cb.is_enabled = true`,
    []
  );

  return (configResult.rows || []).map((row: Record<string, unknown>) => ({
    tenantId: String(row.tenant_id),
    dailyLimitUsd: Number(row.daily_limit_usd) || 0,
    monthlyLimitUsd: Number(row.monthly_limit_usd) || 0,
    alertThreshold: Number(row.alert_threshold) || 0.8,
    todaySpend: Number(row.today_spend) || 0,
    monthSpend: Number(row.month_spend) || 0,
    isEnabled: Boolean(row.is_enabled),
    isOverLimit: false,
  }));
}

async function disableConsciousnessForTenants(tenantIds: string[]): Promise<void> {
  for (const tenantId of tenantIds) {
    await executeStatement(
      `UPDATE consciousness_budget_config 
       SET is_over_limit = true, disabled_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    // Log the disablement
    await executeStatement(
      `INSERT INTO consciousness_budget_events 
       (tenant_id, event_type, event_data, created_at)
       VALUES ($1, 'limit_exceeded_disabled', $2::jsonb, NOW())`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'data', value: { stringValue: JSON.stringify({ reason: 'Budget limit exceeded', timestamp: new Date().toISOString() }) } },
      ]
    );
  }

  logger.warn('Disabled consciousness for over-limit tenants', { tenantIds });
}

async function saveAlerts(alerts: BudgetAlert[]): Promise<void> {
  for (const alert of alerts) {
    // Check if we already sent this alert today
    const existingResult = await executeStatement(
      `SELECT id FROM consciousness_budget_alerts 
       WHERE tenant_id = $1 AND alert_type = $2 AND period = $3 
       AND DATE(created_at) = CURRENT_DATE`,
      [
        { name: 'tenantId', value: { stringValue: alert.tenantId } },
        { name: 'alertType', value: { stringValue: alert.alertType } },
        { name: 'period', value: { stringValue: alert.period } },
      ]
    );

    if (!existingResult.rows || existingResult.rows.length === 0) {
      // Insert new alert
      await executeStatement(
        `INSERT INTO consciousness_budget_alerts 
         (tenant_id, alert_type, period, current_spend, spend_limit, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          { name: 'tenantId', value: { stringValue: alert.tenantId } },
          { name: 'alertType', value: { stringValue: alert.alertType } },
          { name: 'period', value: { stringValue: alert.period } },
          { name: 'currentSpend', value: { doubleValue: alert.currentSpend } },
          { name: 'limit', value: { doubleValue: alert.limit } },
          { name: 'message', value: { stringValue: alert.message } },
        ]
      );

      // Send notification via SNS and/or email
      await sendAlertNotification(alert);
      logger.info('Budget alert created and notification sent', { alert });
    }
  }
}

/**
 * Send budget alert notification via SNS and email
 */
async function sendAlertNotification(alert: BudgetAlert): Promise<void> {
  try {
    // Get tenant notification preferences
    const prefResult = await executeStatement(
      `SELECT admin_email, sns_topic_arn, notification_preferences
       FROM tenants WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: alert.tenantId } }]
    );
    
    const tenant = prefResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!tenant) return;
    
    const adminEmail = tenant.admin_email as string | undefined;
    const snsTopicArn = tenant.sns_topic_arn as string | undefined;
    const prefs = tenant.notification_preferences 
      ? JSON.parse(String(tenant.notification_preferences)) 
      : { budgetAlerts: true, emailEnabled: true, snsEnabled: true };
    
    if (!prefs.budgetAlerts) return;
    
    // Build notification content
    const subject = alert.alertType === 'limit_exceeded'
      ? `🚨 RADIANT: Consciousness Budget Exceeded - ${alert.period}`
      : `⚠️ RADIANT: Consciousness Budget Warning - ${alert.period}`;
    
    const body = buildAlertEmailBody(alert);
    
    // Send SNS notification
    if (prefs.snsEnabled && snsTopicArn) {
      try {
        await snsClient.send(new PublishCommand({
          TopicArn: snsTopicArn,
          Subject: subject,
          Message: JSON.stringify({
            alertType: alert.alertType,
            tenantId: alert.tenantId,
            period: alert.period,
            currentSpend: alert.currentSpend,
            limit: alert.limit,
            message: alert.message,
            timestamp: new Date().toISOString(),
          }),
          MessageAttributes: {
            alertType: { DataType: 'String', StringValue: alert.alertType },
            period: { DataType: 'String', StringValue: alert.period },
          },
        }));
        logger.info('SNS notification sent', { tenantId: alert.tenantId, alertType: alert.alertType });
      } catch (snsError) {
        logger.error(`Failed to send SNS notification for ${alert.tenantId}: ${String(snsError)}`);
      }
    }
    
    // Send email notification
    if (prefs.emailEnabled && adminEmail) {
      try {
        const sourceEmail = process.env.ALERT_SOURCE_EMAIL || 'alerts@radiant.ai';
        await sesClient.send(new SendEmailCommand({
          Source: sourceEmail,
          Destination: { ToAddresses: [adminEmail] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: body, Charset: 'UTF-8' },
              Text: { Data: alert.message, Charset: 'UTF-8' },
            },
          },
        }));
        logger.info('Email notification sent', { tenantId: alert.tenantId, email: adminEmail });
      } catch (emailError) {
        logger.error(`Failed to send email notification for ${alert.tenantId}: ${String(emailError)}`);
      }
    }
    
    // Record notification sent
    await executeStatement(
      `UPDATE consciousness_budget_alerts 
       SET notification_sent = true, notification_sent_at = NOW()
       WHERE tenant_id = $1 AND alert_type = $2 AND period = $3 
       AND DATE(created_at) = CURRENT_DATE`,
      [
        { name: 'tenantId', value: { stringValue: alert.tenantId } },
        { name: 'alertType', value: { stringValue: alert.alertType } },
        { name: 'period', value: { stringValue: alert.period } },
      ]
    );
  } catch (error) {
    logger.error(`Failed to send alert notification for ${alert.tenantId}: ${String(error)}`);
  }
}

/**
 * Build HTML email body for budget alert
 */
function buildAlertEmailBody(alert: BudgetAlert): string {
  const isExceeded = alert.alertType === 'limit_exceeded';
  const percentage = ((alert.currentSpend / alert.limit) * 100).toFixed(1);
  const color = isExceeded ? '#dc2626' : '#f59e0b';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .metric { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; }
    .metric-label { color: #6b7280; font-size: 14px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #111827; }
    .progress { background: #e5e7eb; border-radius: 4px; height: 8px; margin-top: 10px; }
    .progress-bar { background: ${color}; border-radius: 4px; height: 8px; }
    .action { margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 8px; }
    .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">${isExceeded ? '🚨 Budget Exceeded' : '⚠️ Budget Warning'}</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">${alert.period.charAt(0).toUpperCase() + alert.period.slice(1)} Consciousness Budget</p>
    </div>
    <div class="content">
      <div class="metric">
        <div class="metric-label">Current Spend</div>
        <div class="metric-value">$${alert.currentSpend.toFixed(2)} / $${alert.limit.toFixed(2)}</div>
        <div class="progress">
          <div class="progress-bar" style="width: ${Math.min(100, parseFloat(percentage))}%;"></div>
        </div>
        <div style="margin-top: 5px; font-size: 14px; color: #6b7280;">${percentage}% of ${alert.period} limit</div>
      </div>
      
      ${isExceeded ? `
      <div class="action">
        <strong>⚠️ Consciousness features have been suspended</strong>
        <p style="margin: 5px 0 0 0; font-size: 14px;">
          To restore service, increase your budget limit or wait for the next ${alert.period === 'daily' ? 'day' : 'month'}.
        </p>
      </div>
      ` : `
      <div class="action">
        <strong>📊 Approaching Limit</strong>
        <p style="margin: 5px 0 0 0; font-size: 14px;">
          Consider increasing your budget limit to avoid service interruption.
        </p>
      </div>
      `}
      
      <div class="footer">
        <p>This alert was sent by RADIANT Consciousness Budget Monitor.</p>
        <p>Manage your budget settings in the Admin Dashboard → Consciousness → Budget.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

async function updateAggregateStats(): Promise<void> {
  // Update platform-wide consciousness usage stats
  await executeStatement(
    `INSERT INTO consciousness_platform_stats (date, total_invocations, total_tokens, total_cost_usd, active_tenants)
     SELECT 
       CURRENT_DATE,
       COALESCE(SUM(invocation_count), 0),
       COALESCE(SUM(total_tokens), 0),
       COALESCE(SUM(total_cost_usd), 0),
       COUNT(DISTINCT tenant_id)
     FROM consciousness_cost_aggregates
     WHERE date = CURRENT_DATE
     ON CONFLICT (date) DO UPDATE SET
       total_invocations = EXCLUDED.total_invocations,
       total_tokens = EXCLUDED.total_tokens,
       total_cost_usd = EXCLUDED.total_cost_usd,
       active_tenants = EXCLUDED.active_tenants,
       updated_at = NOW()`,
    []
  );
}

/**
 * Check if a tenant can use consciousness features (called before operations)
 */
export async function checkBudgetAllowance(tenantId: string): Promise<{
  allowed: boolean;
  reason?: string;
  remainingDaily?: number;
  remainingMonthly?: number;
}> {
  const result = await executeStatement(
    `SELECT 
      cb.daily_limit_usd,
      cb.monthly_limit_usd,
      cb.is_enabled,
      cb.is_over_limit,
      COALESCE(today.total_cost_usd, 0) as today_spend,
      COALESCE(month.total_cost_usd, 0) as month_spend
     FROM consciousness_budget_config cb
     LEFT JOIN consciousness_cost_aggregates today 
       ON cb.tenant_id = today.tenant_id AND today.date = CURRENT_DATE
     LEFT JOIN (
       SELECT tenant_id, SUM(total_cost_usd) as total_cost_usd
       FROM consciousness_cost_aggregates
       WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY tenant_id
     ) month ON cb.tenant_id = month.tenant_id
     WHERE cb.tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );

  if (!result.rows || result.rows.length === 0) {
    // No budget config = unlimited (or use defaults)
    return { allowed: true };
  }

  const row = result.rows[0] as Record<string, unknown>;
  const dailyLimit = Number(row.daily_limit_usd) || 0;
  const monthlyLimit = Number(row.monthly_limit_usd) || 0;
  const todaySpend = Number(row.today_spend) || 0;
  const monthSpend = Number(row.month_spend) || 0;
  const isEnabled = Boolean(row.is_enabled);
  const isOverLimit = Boolean(row.is_over_limit);

  if (!isEnabled) {
    return { allowed: false, reason: 'Consciousness features disabled for this tenant' };
  }

  if (isOverLimit) {
    return { allowed: false, reason: 'Budget limit exceeded - consciousness features suspended' };
  }

  if (dailyLimit > 0 && todaySpend >= dailyLimit) {
    return { 
      allowed: false, 
      reason: 'Daily budget limit reached',
      remainingDaily: 0,
      remainingMonthly: monthlyLimit > 0 ? Math.max(0, monthlyLimit - monthSpend) : undefined,
    };
  }

  if (monthlyLimit > 0 && monthSpend >= monthlyLimit) {
    return { 
      allowed: false, 
      reason: 'Monthly budget limit reached',
      remainingDaily: dailyLimit > 0 ? Math.max(0, dailyLimit - todaySpend) : undefined,
      remainingMonthly: 0,
    };
  }

  return {
    allowed: true,
    remainingDaily: dailyLimit > 0 ? Math.max(0, dailyLimit - todaySpend) : undefined,
    remainingMonthly: monthlyLimit > 0 ? Math.max(0, monthlyLimit - monthSpend) : undefined,
  };
}
