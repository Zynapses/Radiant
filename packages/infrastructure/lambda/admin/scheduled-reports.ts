/**
 * RADIANT v5.12.5 - Scheduled Reports Executor
 * 
 * EventBridge Lambda that runs scheduled reports.
 * Triggered by EventBridge rule every 5 minutes.
 */

import { ScheduledHandler } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/utils/db';
import { reportGeneratorService } from '../shared/services/report-generator.service';
import { logger } from '../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

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

    // TODO: Send email to recipients
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
 * Send report emails to recipients
 */
async function sendReportEmails(
  report: DueReport,
  executionId: string,
  downloadUrl: string,
  recipients: string[]
): Promise<void> {
  // TODO: Implement actual email sending via SES
  // For now, just log and update execution record
  
  logger.info('Would send report emails', {
    reportId: report.id,
    executionId,
    recipientCount: recipients.length,
  });

  await executeStatement(
    `UPDATE report_executions SET 
      emails_sent = $2
    WHERE id = $1`,
    [
      stringParam('id', executionId),
      stringParam('emailsSent', recipients.length.toString()),
    ]
  );
}
