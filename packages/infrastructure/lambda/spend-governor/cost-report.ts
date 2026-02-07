/**
 * RADIANT v7.39.0 — Spend Governor Cost Report Lambda
 *
 * Sends scheduled cost summaries to super admins every X hours / Y days.
 * Runs on EventBridge schedule, checks if a report is due based on
 * the configured interval in spend_governor_instance.
 *
 * Report includes:
 *   - Total AWS spend (from Cost Explorer API or cached)
 *   - Total AI model spend (from cost_events)
 *   - Per-tenant breakdown
 *   - Per-model breakdown
 *   - Budget status and warnings
 */

import { Handler, ScheduledEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { spendGovernorService, CostReportData } from '../shared/services/spend-governor.service';
import { executeStatement } from '../shared/db/client';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'spend-governor/cost-report',
  category: 'infrastructure',
  sourceType: 'lambda',
});

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

export const handler: Handler<ScheduledEvent> = async () => {
  logger.info('Cost report Lambda starting');

  try {
    // Check if a report is due
    const shouldSend = await spendGovernorService.shouldSendCostReport();
    if (!shouldSend) {
      logger.info('Cost report not yet due, skipping');
      return { status: 'skipped', reason: 'not_due' };
    }

    // Get instance config for period
    const instanceConfig = await spendGovernorService.getInstanceConfig();
    const periodHours = instanceConfig.costReportIntervalHours;

    // Build report data
    const reportData = await buildReport(periodHours);

    // Get super admin recipients
    const recipients = await getSuperAdminEmails();
    if (recipients.length === 0) {
      logger.warn('No super admin email recipients found, skipping cost report');
      return { status: 'skipped', reason: 'no_recipients' };
    }

    // Send email report
    await sendCostReportEmail(reportData, recipients, periodHours);

    // Record the report
    await spendGovernorService.recordCostReport(reportData, recipients);

    logger.info('Cost report sent successfully', {
      recipients: recipients.length,
      totalSpend: reportData.totalSpendUsd,
      aiSpend: reportData.aiSpendUsd,
    });

    return {
      status: 'sent',
      recipients: recipients.length,
      totalSpendUsd: reportData.totalSpendUsd,
      aiSpendUsd: reportData.aiSpendUsd,
    };
  } catch (error) {
    logger.error('Cost report Lambda failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

// ============================================================================
// Report Building
// ============================================================================

async function buildReport(periodHours: number): Promise<CostReportData> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodHours * 3_600_000);

  // Get AI spend from cost_events
  const aiSpendResult = await executeStatement(
    `SELECT
       COALESCE(SUM(cost_cents), 0) / 100.0 AS ai_spend_usd,
       COUNT(*) AS total_requests,
       COUNT(DISTINCT tenant_id) AS active_tenants
     FROM cost_events
     WHERE created_at >= $1 AND created_at <= $2`,
    [periodStart.toISOString(), periodEnd.toISOString()]
  );

  const aiRow = (aiSpendResult.rows?.[0] || {}) as Record<string, unknown>;
  const aiSpendUsd = Number(aiRow.ai_spend_usd) || 0;

  // Per-tenant breakdown
  const tenantBreakdownResult = await executeStatement(
    `SELECT
       tenant_id,
       SUM(cost_cents) / 100.0 AS spend_usd,
       COUNT(*) AS requests,
       COUNT(DISTINCT model_id) AS models_used
     FROM cost_events
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY tenant_id
     ORDER BY spend_usd DESC
     LIMIT 50`,
    [periodStart.toISOString(), periodEnd.toISOString()]
  );

  const tenantBreakdown = (tenantBreakdownResult.rows || []).map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      tenantId: String(r.tenant_id),
      spendUsd: Number(r.spend_usd) || 0,
      requests: Number(r.requests) || 0,
      modelsUsed: Number(r.models_used) || 0,
    };
  });

  // Per-model breakdown
  const modelBreakdownResult = await executeStatement(
    `SELECT
       model_id,
       provider,
       SUM(cost_cents) / 100.0 AS spend_usd,
       COUNT(*) AS requests,
       SUM(input_tokens) AS input_tokens,
       SUM(output_tokens) AS output_tokens
     FROM cost_events
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY model_id, provider
     ORDER BY spend_usd DESC
     LIMIT 30`,
    [periodStart.toISOString(), periodEnd.toISOString()]
  );

  const modelBreakdown = (modelBreakdownResult.rows || []).map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      modelId: String(r.model_id),
      provider: String(r.provider),
      spendUsd: Number(r.spend_usd) || 0,
      requests: Number(r.requests) || 0,
      inputTokens: Number(r.input_tokens) || 0,
      outputTokens: Number(r.output_tokens) || 0,
    };
  });

  // Get instance AWS spend (cached in spend_governor_instance)
  const instanceConfig = await spendGovernorService.getInstanceConfig();
  const awsSpendUsd = instanceConfig.currentSpendUsd;

  return {
    scope: 'instance',
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalSpendUsd: aiSpendUsd + awsSpendUsd,
    aiSpendUsd,
    awsSpendUsd,
    breakdown: {
      tenants: tenantBreakdown,
      models: modelBreakdown,
      totalRequests: Number(aiRow.total_requests) || 0,
      activeTenants: Number(aiRow.active_tenants) || 0,
      budgetUsd: instanceConfig.budgetUsd,
      budgetPeriodHours: instanceConfig.periodHours,
      percentUsed: instanceConfig.budgetUsd > 0
        ? ((aiSpendUsd + awsSpendUsd) / instanceConfig.budgetUsd * 100).toFixed(1)
        : '0',
      isFrozen: instanceConfig.isFrozen,
    },
  };
}

// ============================================================================
// Super Admin Email Resolution
// ============================================================================

async function getSuperAdminEmails(): Promise<string[]> {
  // Resolve from system_admins table (Pool B)
  const result = await executeStatement(
    `SELECT DISTINCT c.contact_value
     FROM system_admin_contacts c
     JOIN system_admins sa ON c.system_admin_id = sa.id
     WHERE sa.status = 'active'
       AND c.contact_type = 'email'
       AND c.is_verified = true
     ORDER BY c.is_primary DESC`,
    []
  );

  const emails = (result.rows || []).map((row: unknown) =>
    String((row as Record<string, unknown>).contact_value)
  );

  // Fallback: environment variable
  if (emails.length === 0 && process.env.ADMIN_ALERT_EMAIL) {
    return [process.env.ADMIN_ALERT_EMAIL];
  }

  return emails;
}

// ============================================================================
// Email Rendering
// ============================================================================

async function sendCostReportEmail(
  report: CostReportData,
  recipients: string[],
  periodHours: number
): Promise<void> {
  const periodLabel = periodHours >= 24
    ? `${Math.round(periodHours / 24)} day${Math.round(periodHours / 24) !== 1 ? 's' : ''}`
    : `${periodHours} hour${periodHours !== 1 ? 's' : ''}`;

  const breakdown = report.breakdown as Record<string, unknown>;
  const tenants = (breakdown.tenants || []) as Array<Record<string, unknown>>;
  const models = (breakdown.models || []) as Array<Record<string, unknown>>;
  const isFrozen = Boolean(breakdown.isFrozen);

  const frozenBanner = isFrozen
    ? `<div style="background: #dc2626; color: white; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
         <strong>AWS SERVICES ARE FROZEN</strong> — Instance budget exceeded. Use Deployer to restore.
       </div>`
    : '';

  const subject = isFrozen
    ? `[CRITICAL] RADIANT Cost Report — AWS FROZEN — $${report.totalSpendUsd.toFixed(2)} (${periodLabel})`
    : `RADIANT Cost Report — $${report.totalSpendUsd.toFixed(2)} (${periodLabel})`;

  const tenantRows = tenants.slice(0, 20).map((t: Record<string, unknown>) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${String(t.tenantId).substring(0, 8)}...</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">$${Number(t.spendUsd).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${Number(t.requests).toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${Number(t.modelsUsed)}</td>
    </tr>
  `).join('');

  const modelRows = models.slice(0, 15).map((m: Record<string, unknown>) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${String(m.modelId)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${String(m.provider)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">$${Number(m.spendUsd).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${Number(m.requests).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f3f4f6;">
  <div style="max-width: 700px; margin: 0 auto; padding: 24px;">
    ${frozenBanner}
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 24px;">
        <h1 style="margin: 0; font-size: 20px;">RADIANT Cost Report</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.8; font-size: 14px;">
          ${new Date(report.periodStart).toLocaleDateString()} — ${new Date(report.periodEnd).toLocaleDateString()}
          (${periodLabel})
        </p>
      </div>

      <div style="padding: 24px;">
        <div style="display: flex; gap: 16px; margin-bottom: 24px;">
          <div style="flex: 1; background: #f8fafc; border-radius: 8px; padding: 16px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Total Spend</div>
            <div style="font-size: 28px; font-weight: bold; color: #0f172a;">$${report.totalSpendUsd.toFixed(2)}</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border-radius: 8px; padding: 16px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">AI Spend</div>
            <div style="font-size: 28px; font-weight: bold; color: #3b82f6;">$${report.aiSpendUsd.toFixed(2)}</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border-radius: 8px; padding: 16px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Budget Used</div>
            <div style="font-size: 28px; font-weight: bold; color: ${Number(breakdown.percentUsed) > 90 ? '#dc2626' : '#10b981'};">${breakdown.percentUsed}%</div>
          </div>
        </div>

        <div style="margin-bottom: 16px; padding: 12px; background: #f1f5f9; border-radius: 8px; font-size: 13px; color: #475569;">
          Requests: <strong>${Number(breakdown.totalRequests).toLocaleString()}</strong> |
          Active Tenants: <strong>${breakdown.activeTenants}</strong> |
          Budget: <strong>$${Number(breakdown.budgetUsd).toFixed(2)} / ${Number(breakdown.budgetPeriodHours)}h</strong>
        </div>

        ${tenantRows ? `
        <h3 style="margin: 24px 0 12px 0; font-size: 15px; color: #1e293b;">Top Tenants by Spend</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 8px; text-align: left; font-size: 12px; color: #64748b;">Tenant</th>
              <th style="padding: 8px; text-align: right; font-size: 12px; color: #64748b;">Spend</th>
              <th style="padding: 8px; text-align: right; font-size: 12px; color: #64748b;">Requests</th>
              <th style="padding: 8px; text-align: right; font-size: 12px; color: #64748b;">Models</th>
            </tr>
          </thead>
          <tbody>${tenantRows}</tbody>
        </table>
        ` : ''}

        ${modelRows ? `
        <h3 style="margin: 24px 0 12px 0; font-size: 15px; color: #1e293b;">Top Models by Spend</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 8px; text-align: left; font-size: 12px; color: #64748b;">Model</th>
              <th style="padding: 8px; text-align: left; font-size: 12px; color: #64748b;">Provider</th>
              <th style="padding: 8px; text-align: right; font-size: 12px; color: #64748b;">Spend</th>
              <th style="padding: 8px; text-align: right; font-size: 12px; color: #64748b;">Requests</th>
            </tr>
          </thead>
          <tbody>${modelRows}</tbody>
        </table>
        ` : ''}
      </div>

      <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        RADIANT Spend Governor — Automated cost report. Manage settings in Admin Dashboard &rarr; Spend Governor.
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const sourceEmail = process.env.ALERT_SOURCE_EMAIL || process.env.SES_FROM_EMAIL || 'alerts@radiant.ai';

  await sesClient.send(new SendEmailCommand({
    Source: sourceEmail,
    Destination: { ToAddresses: recipients },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html, Charset: 'UTF-8' },
        Text: {
          Data: `RADIANT Cost Report\n\nPeriod: ${periodLabel}\nTotal Spend: $${report.totalSpendUsd.toFixed(2)}\nAI Spend: $${report.aiSpendUsd.toFixed(2)}\nBudget Used: ${breakdown.percentUsed}%\n\n${isFrozen ? 'WARNING: AWS SERVICES ARE FROZEN\n' : ''}View details in Admin Dashboard.`,
          Charset: 'UTF-8',
        },
      },
    },
  }));

  logger.info('Cost report email sent', {
    recipients: recipients.length,
    subject,
  });
}
