/**
 * RADIANT v5.12.5 - Scheduled Reports Executor
 * 
 * EventBridge Lambda that runs scheduled reports.
 * Triggered by EventBridge rule every 5 minutes.
 */

import { ScheduledHandler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { executeStatement, stringParam } from '../shared/utils/db';
import { reportGeneratorService } from '../shared/services/report-generator.service';
import { logger } from '../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const sesClient = new SESClient({});
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || 'reports@radiant.ai';
const SES_ENABLED = process.env.SES_ENABLED === 'true';

interface DueReport {
  id: string;
  tenant_id: string;
  name: string;
  report_type: string;
  format: string;
  parameters: string;
  recipients: string;
  template_id: string | null;
}

/**
 * Main handler - runs every 5 minutes via EventBridge
 */
export const handler: ScheduledHandler = async (event) => {
  logger.info('Scheduled reports executor started', { event });

  try {
    // Get reports due for execution
    const dueReports = await getDueReports();
    
    if (dueReports.length === 0) {
      logger.info('No reports due for execution');
      return;
    }

    logger.info('Processing due reports', { count: dueReports.length });

    // Process each report
    const results = await Promise.allSettled(
      dueReports.map(report => processReport(report))
    );

    // Log summary
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('Scheduled reports execution complete', { succeeded, failed });
  } catch (error) {
    logger.error('Scheduled reports executor failed', { error });
    throw error;
  }
};

/**
 * Get reports due for execution
 */
async function getDueReports(): Promise<DueReport[]> {
  const result = await executeStatement(
    `SELECT 
      id, tenant_id, name, report_type, format, 
      parameters::text, recipients::text, template_id
    FROM admin_reports
    WHERE status = 'active'
    AND schedule != 'manual'
    AND next_run_at IS NOT NULL
    AND next_run_at <= NOW()
    AND (last_run_status IS NULL OR last_run_status != 'running')
    ORDER BY next_run_at ASC
    LIMIT 50`,
    []
  );

  return (result.rows || []) as unknown as DueReport[];
}

/**
 * Process a single scheduled report
 */
async function processReport(report: DueReport): Promise<void> {
  const executionId = uuidv4();

  try {
    logger.info('Processing scheduled report', { 
      reportId: report.id, 
      name: report.name,
      executionId 
    });

    // Create execution record
    await executeStatement(
      `INSERT INTO report_executions (
        id, tenant_id, report_id, triggered_by, status, 
        output_format, parameters_snapshot, recipients_snapshot
      ) VALUES ($1, $2, $3, 'scheduled', 'pending', $4, $5, $6)`,
      [
        stringParam('id', executionId),
        stringParam('tenantId', report.tenant_id),
        stringParam('reportId', report.id),
        stringParam('format', report.format),
        stringParam('parameters', report.parameters),
        stringParam('recipients', report.recipients),
      ]
    );

    // Generate report
    const result = await reportGeneratorService.generateReport(
      {
        id: report.id,
        tenant_id: report.tenant_id,
        name: report.name,
        report_type: report.report_type as 'usage' | 'cost' | 'security' | 'performance' | 'compliance' | 'custom',
        format: report.format as 'pdf' | 'csv' | 'json' | 'excel',
        parameters: JSON.parse(report.parameters || '{}'),
        recipients: JSON.parse(report.recipients || '[]'),
        template_id: report.template_id || undefined,
      },
      executionId
    );

    // Update report with result
    await executeStatement(
      `UPDATE admin_reports SET 
        last_run_at = NOW(),
        last_run_status = $2,
        last_run_error = $3,
        run_count = run_count + 1,
        next_run_at = calculate_next_run(schedule, schedule_time, schedule_day_of_week, schedule_day_of_month, schedule_timezone),
        updated_at = NOW()
      WHERE id = $1`,
      [
        stringParam('id', report.id),
        stringParam('status', result.success ? 'success' : 'failed'),
        stringParam('error', result.error || ''),
      ]
    );

    // Send email to recipients via SES
    if (result.success && result.download_url) {
      const recipients = JSON.parse(report.recipients || '[]') as string[];
      if (recipients.length > 0) {
        await sendReportEmails(report, executionId, result.download_url, recipients);
      }
    }

    logger.info('Scheduled report completed', { 
      reportId: report.id, 
      executionId,
      success: result.success 
    });
  } catch (error) {
    logger.error('Scheduled report failed', { 
      reportId: report.id, 
      executionId,
      error 
    });

    // Update with failure
    await executeStatement(
      `UPDATE admin_reports SET 
        last_run_at = NOW(),
        last_run_status = 'failed',
        last_run_error = $2,
        next_run_at = calculate_next_run(schedule, schedule_time, schedule_day_of_week, schedule_day_of_month, schedule_timezone),
        updated_at = NOW()
      WHERE id = $1`,
      [
        stringParam('id', report.id),
        stringParam('error', error instanceof Error ? error.message : 'Unknown error'),
      ]
    );

    throw error;
  }
}

/**
 * Send report emails to recipients via SES
 */
async function sendReportEmails(
  report: DueReport,
  executionId: string,
  downloadUrl: string,
  recipients: string[]
): Promise<void> {
  if (!SES_ENABLED) {
    logger.info('SES disabled, skipping email send', {
      reportId: report.id,
      executionId,
      recipientCount: recipients.length,
    });
    return;
  }

  let emailsSent = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    try {
      const command = new SendEmailCommand({
        Source: SES_FROM_EMAIL,
        Destination: {
          ToAddresses: [recipient],
        },
        Message: {
          Subject: {
            Data: `RADIANT Report: ${report.name}`,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
    .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📊 ${report.name}</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Your scheduled report is ready</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Your scheduled <strong>${report.report_type}</strong> report has been generated and is ready for download.</p>
      <p><strong>Report Details:</strong></p>
      <ul>
        <li>Name: ${report.name}</li>
        <li>Type: ${report.report_type}</li>
        <li>Format: ${report.format.toUpperCase()}</li>
        <li>Generated: ${new Date().toISOString()}</li>
      </ul>
      <a href="${downloadUrl}" class="button">Download Report</a>
      <p class="footer">
        This link will expire in 24 hours. If you have any questions, please contact your administrator.<br>
        — RADIANT Platform
      </p>
    </div>
  </div>
</body>
</html>
              `,
              Charset: 'UTF-8',
            },
            Text: {
              Data: `RADIANT Report: ${report.name}\n\nYour scheduled ${report.report_type} report is ready.\n\nDownload: ${downloadUrl}\n\nThis link expires in 24 hours.`,
              Charset: 'UTF-8',
            },
          },
        },
      });

      await sesClient.send(command);
      emailsSent++;
      
      logger.info('Report email sent', {
        reportId: report.id,
        executionId,
        recipient,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${recipient}: ${errorMsg}`);
      logger.error('Failed to send report email', {
        reportId: report.id,
        executionId,
        recipient,
        error: errorMsg,
      });
    }
  }

  // Update execution record with email stats
  await executeStatement(
    `UPDATE report_executions SET 
      emails_sent = $2,
      email_errors = $3
    WHERE id = $1`,
    [
      stringParam('id', executionId),
      stringParam('emailsSent', emailsSent.toString()),
      stringParam('emailErrors', errors.length > 0 ? JSON.stringify(errors) : undefined),
    ]
  );

  logger.info('Report emails completed', {
    reportId: report.id,
    executionId,
    sent: emailsSent,
    failed: errors.length,
  });
}
