/**
 * RADIANT v5.12.5 - Reports Admin API
 * 
 * CRUD endpoints for admin reports with generation and scheduling.
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { executeStatement, stringParam, boolParam } from '../shared/utils/db';
import { reportGeneratorService } from '../shared/services/report-generator.service';
import { logger } from '../shared/utils/logger';
import { withAdminAuth, getTenantId } from '../shared/utils/auth';
import { v4 as uuidv4 } from 'uuid';

const getUserId = (event: APIGatewayProxyEvent): string | undefined => {
  return event.requestContext?.authorizer?.userId;
};

// ============================================================================
// Types
// ============================================================================

interface CreateReportInput {
  name: string;
  description?: string;
  template_id?: string;
  report_type: 'usage' | 'cost' | 'security' | 'performance' | 'compliance' | 'custom';
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  schedule_time?: string;
  schedule_day_of_week?: number;
  schedule_day_of_month?: number;
  schedule_timezone?: string;
  format: 'pdf' | 'csv' | 'json' | 'excel';
  recipients?: string[];
  parameters?: Record<string, unknown>;
}

interface UpdateReportInput extends Partial<CreateReportInput> {
  status?: 'active' | 'paused' | 'draft';
  is_favorite?: boolean;
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/admin/reports
 * List all reports for tenant
 */
export const listReports: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const { type, status, schedule, favorite } = event.queryStringParameters || {};

  try {
    let query = `
      SELECT 
        r.*,
        t.name as template_name,
        t.icon as template_icon
      FROM admin_reports r
      LEFT JOIN report_templates t ON t.id = r.template_id
      WHERE r.tenant_id = $1 AND r.status != 'deleted'
    `;
    const params = [stringParam('tenantId', tenantId)];
    let paramIndex = 2;

    if (type && type !== 'all') {
      query += ` AND r.report_type = $${paramIndex}`;
      params.push(stringParam('type', type));
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND r.status = $${paramIndex}`;
      params.push(stringParam('status', status));
      paramIndex++;
    }

    if (schedule && schedule !== 'all') {
      query += ` AND r.schedule = $${paramIndex}`;
      params.push(stringParam('schedule', schedule));
      paramIndex++;
    }

    if (favorite === 'true') {
      query += ` AND r.is_favorite = true`;
    }

    query += ` ORDER BY r.is_favorite DESC, r.updated_at DESC`;

    const result = await executeStatement(query, params);

    return {
      statusCode: 200,
      body: JSON.stringify({
        reports: result.rows || [],
        count: (result.rows || []).length,
      }),
    };
  } catch (error) {
    logger.error('Failed to list reports', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to list reports' }),
    };
  }
});

/**
 * GET /api/admin/reports/:id
 * Get single report
 */
export const getReport: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const reportId = event.pathParameters?.id;

  if (!reportId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Report ID required' }) };
  }

  try {
    const result = await executeStatement(
      `SELECT r.*, t.name as template_name, t.icon as template_icon
       FROM admin_reports r
       LEFT JOIN report_templates t ON t.id = r.template_id
       WHERE r.id = $1 AND r.tenant_id = $2`,
      [stringParam('id', reportId), stringParam('tenantId', tenantId)]
    );

    if (!result.rows || result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Report not found' }) };
    }

    // Get recent executions
    const executions = await executeStatement(
      `SELECT * FROM report_executions 
       WHERE report_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [stringParam('reportId', reportId)]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        report: result.rows[0],
        executions: executions.rows || [],
      }),
    };
  } catch (error) {
    logger.error('Failed to get report', { error, reportId });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get report' }),
    };
  }
});

/**
 * POST /api/admin/reports
 * Create new report
 */
export const createReport: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const userId = getUserId(event);
  const body = JSON.parse(event.body || '{}') as CreateReportInput;

  if (!body.name || !body.report_type || !body.format) {
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: 'name, report_type, and format are required' }) 
    };
  }

  try {
    const reportId = uuidv4();

    await executeStatement(
      `INSERT INTO admin_reports (
        id, tenant_id, name, description, template_id, report_type,
        schedule, schedule_time, schedule_day_of_week, schedule_day_of_month, schedule_timezone,
        format, recipients, parameters, status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active', $15
      )`,
      [
        stringParam('id', reportId),
        stringParam('tenantId', tenantId),
        stringParam('name', body.name),
        stringParam('description', body.description || ''),
        stringParam('templateId', body.template_id || null),
        stringParam('reportType', body.report_type),
        stringParam('schedule', body.schedule || 'manual'),
        stringParam('scheduleTime', body.schedule_time || '09:00:00'),
        stringParam('scheduleDayOfWeek', body.schedule_day_of_week?.toString() || null),
        stringParam('scheduleDayOfMonth', body.schedule_day_of_month?.toString() || null),
        stringParam('scheduleTimezone', body.schedule_timezone || 'UTC'),
        stringParam('format', body.format),
        stringParam('recipients', JSON.stringify(body.recipients || [])),
        stringParam('parameters', JSON.stringify(body.parameters || {})),
        stringParam('createdBy', userId || null),
      ]
    );

    logger.info('Report created', { reportId, tenantId, name: body.name });

    return {
      statusCode: 201,
      body: JSON.stringify({ id: reportId, success: true }),
    };
  } catch (error) {
    logger.error('Failed to create report', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create report' }),
    };
  }
});

/**
 * PUT /api/admin/reports/:id
 * Update report
 */
export const updateReport: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const reportId = event.pathParameters?.id;
  const body = JSON.parse(event.body || '{}') as UpdateReportInput;

  if (!reportId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Report ID required' }) };
  }

  try {
    // Build dynamic update
    const updates: string[] = [];
    const params = [stringParam('id', reportId), stringParam('tenantId', tenantId)];
    let paramIndex = 3;

    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      report_type: 'report_type',
      schedule: 'schedule',
      schedule_time: 'schedule_time',
      schedule_timezone: 'schedule_timezone',
      format: 'format',
      status: 'status',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (body[key as keyof UpdateReportInput] !== undefined) {
        updates.push(`${column} = $${paramIndex}`);
        params.push(stringParam(key, String(body[key as keyof UpdateReportInput])));
        paramIndex++;
      }
    }

    if (body.recipients !== undefined) {
      updates.push(`recipients = $${paramIndex}`);
      params.push(stringParam('recipients', JSON.stringify(body.recipients)));
      paramIndex++;
    }

    if (body.parameters !== undefined) {
      updates.push(`parameters = $${paramIndex}`);
      params.push(stringParam('parameters', JSON.stringify(body.parameters)));
      paramIndex++;
    }

    if (body.is_favorite !== undefined) {
      updates.push(`is_favorite = $${paramIndex}`);
      params.push(boolParam('isFavorite', body.is_favorite));
      paramIndex++;
    }

    if (body.schedule_day_of_week !== undefined) {
      updates.push(`schedule_day_of_week = $${paramIndex}`);
      params.push(stringParam('scheduleDayOfWeek', body.schedule_day_of_week.toString()));
      paramIndex++;
    }

    if (body.schedule_day_of_month !== undefined) {
      updates.push(`schedule_day_of_month = $${paramIndex}`);
      params.push(stringParam('scheduleDayOfMonth', body.schedule_day_of_month.toString()));
      paramIndex++;
    }

    if (updates.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No fields to update' }) };
    }

    updates.push('updated_at = NOW()');

    await executeStatement(
      `UPDATE admin_reports SET ${updates.join(', ')} WHERE id = $1 AND tenant_id = $2`,
      params
    );

    logger.info('Report updated', { reportId, updates: updates.length });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    logger.error('Failed to update report', { error, reportId });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update report' }),
    };
  }
});

/**
 * DELETE /api/admin/reports/:id
 * Delete report (soft delete)
 */
export const deleteReport: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const reportId = event.pathParameters?.id;

  if (!reportId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Report ID required' }) };
  }

  try {
    await executeStatement(
      `UPDATE admin_reports SET status = 'deleted', updated_at = NOW() 
       WHERE id = $1 AND tenant_id = $2`,
      [stringParam('id', reportId), stringParam('tenantId', tenantId)]
    );

    logger.info('Report deleted', { reportId });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    logger.error('Failed to delete report', { error, reportId });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete report' }),
    };
  }
});

/**
 * POST /api/admin/reports/:id/run
 * Run report immediately
 */
export const runReport: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const userId = getUserId(event);
  const reportId = event.pathParameters?.id;

  if (!reportId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Report ID required' }) };
  }

  try {
    // Get report config
    const result = await executeStatement(
      `SELECT * FROM admin_reports WHERE id = $1 AND tenant_id = $2`,
      [stringParam('id', reportId), stringParam('tenantId', tenantId)]
    );

    if (!result.rows || result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Report not found' }) };
    }

    const report = result.rows[0] as {
      id: string;
      tenant_id: string;
      name: string;
      report_type: string;
      format: string;
      parameters: string;
      recipients: string;
      template_id: string;
    };

    // Create execution record
    const executionId = uuidv4();
    await executeStatement(
      `INSERT INTO report_executions (
        id, tenant_id, report_id, triggered_by, triggered_by_user_id,
        status, output_format, parameters_snapshot, recipients_snapshot
      ) VALUES ($1, $2, $3, 'manual', $4, 'pending', $5, $6, $7)`,
      [
        stringParam('id', executionId),
        stringParam('tenantId', tenantId),
        stringParam('reportId', reportId),
        stringParam('userId', userId || null),
        stringParam('format', report.format),
        stringParam('parameters', report.parameters),
        stringParam('recipients', report.recipients),
      ]
    );

    // Generate report
    const generationResult = await reportGeneratorService.generateReport(
      {
        id: report.id,
        tenant_id: report.tenant_id,
        name: report.name,
        report_type: report.report_type as 'usage' | 'cost' | 'security' | 'performance' | 'compliance' | 'custom',
        format: report.format as 'pdf' | 'csv' | 'json' | 'excel',
        parameters: JSON.parse(report.parameters || '{}'),
        recipients: JSON.parse(report.recipients || '[]'),
        template_id: report.template_id,
      },
      executionId
    );

    // Update report last run
    await executeStatement(
      `UPDATE admin_reports SET 
        last_run_at = NOW(),
        last_run_status = $2,
        last_run_error = $3,
        run_count = run_count + 1,
        updated_at = NOW()
      WHERE id = $1`,
      [
        stringParam('id', reportId),
        stringParam('status', generationResult.success ? 'success' : 'failed'),
        stringParam('error', generationResult.error || null),
      ]
    );

    logger.info('Report run completed', { reportId, executionId, success: generationResult.success });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: generationResult.success,
        execution_id: executionId,
        download_url: generationResult.download_url,
        error: generationResult.error,
      }),
    };
  } catch (error) {
    logger.error('Failed to run report', { error, reportId });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to run report' }),
    };
  }
});

/**
 * GET /api/admin/reports/:id/download/:executionId
 * Get download URL for a report execution
 */
export const downloadReport: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const reportId = event.pathParameters?.id;
  const executionId = event.pathParameters?.executionId;

  if (!reportId || !executionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Report ID and Execution ID required' }) };
  }

  try {
    const result = await executeStatement(
      `SELECT e.output_s3_key, e.output_s3_bucket, e.status
       FROM report_executions e
       JOIN admin_reports r ON r.id = e.report_id
       WHERE e.id = $1 AND e.report_id = $2 AND r.tenant_id = $3`,
      [
        stringParam('executionId', executionId),
        stringParam('reportId', reportId),
        stringParam('tenantId', tenantId),
      ]
    );

    if (!result.rows || result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Execution not found' }) };
    }

    const execution = result.rows[0] as { output_s3_key: string; status: string };

    if (execution.status !== 'success' || !execution.output_s3_key) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Report not ready for download' }) };
    }

    const downloadUrl = await reportGeneratorService.getDownloadUrl(execution.output_s3_key);

    return {
      statusCode: 200,
      body: JSON.stringify({ download_url: downloadUrl }),
    };
  } catch (error) {
    logger.error('Failed to get download URL', { error, reportId, executionId });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get download URL' }),
    };
  }
});

/**
 * GET /api/admin/reports/templates
 * List available report templates
 */
export const listTemplates: APIGatewayProxyHandler = withAdminAuth(async () => {
  try {
    const result = await executeStatement(
      `SELECT * FROM report_templates WHERE is_active = true ORDER BY name`,
      []
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        templates: result.rows || [],
      }),
    };
  } catch (error) {
    logger.error('Failed to list templates', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to list templates' }),
    };
  }
});

/**
 * GET /api/admin/reports/stats
 * Get report statistics
 */
export const getStats: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);

  try {
    const result = await executeStatement(
      `SELECT * FROM v_report_stats WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    // Get sent this month
    const sentResult = await executeStatement(
      `SELECT COUNT(*) as count FROM report_executions e
       JOIN admin_reports r ON r.id = e.report_id
       WHERE r.tenant_id = $1 
       AND e.status = 'success'
       AND e.created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [stringParam('tenantId', tenantId)]
    );

    const stats = result.rows?.[0] || {
      total_reports: 0,
      active_reports: 0,
      scheduled_reports: 0,
      favorite_reports: 0,
      run_today: 0,
      failed_reports: 0,
    };

    const sentThisMonth = (sentResult.rows?.[0] as { count: string })?.count || '0';

    return {
      statusCode: 200,
      body: JSON.stringify({
        ...stats,
        sent_this_month: parseInt(sentThisMonth, 10),
      }),
    };
  } catch (error) {
    logger.error('Failed to get stats', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get stats' }),
    };
  }
});

/**
 * POST /api/admin/reports/:id/duplicate
 * Duplicate a report
 */
export const duplicateReport: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const userId = getUserId(event);
  const reportId = event.pathParameters?.id;

  if (!reportId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Report ID required' }) };
  }

  try {
    // Get original report
    const result = await executeStatement(
      `SELECT * FROM admin_reports WHERE id = $1 AND tenant_id = $2`,
      [stringParam('id', reportId), stringParam('tenantId', tenantId)]
    );

    if (!result.rows || result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Report not found' }) };
    }

    const original = result.rows[0] as Record<string, unknown>;
    const newId = uuidv4();

    await executeStatement(
      `INSERT INTO admin_reports (
        id, tenant_id, name, description, template_id, report_type,
        schedule, schedule_time, schedule_day_of_week, schedule_day_of_month, schedule_timezone,
        format, recipients, parameters, status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft', $15
      )`,
      [
        stringParam('id', newId),
        stringParam('tenantId', tenantId),
        stringParam('name', `${original.name} (Copy)`),
        stringParam('description', original.description as string || ''),
        stringParam('templateId', original.template_id as string || null),
        stringParam('reportType', original.report_type as string),
        stringParam('schedule', original.schedule as string),
        stringParam('scheduleTime', original.schedule_time as string || '09:00:00'),
        stringParam('scheduleDayOfWeek', original.schedule_day_of_week?.toString() || null),
        stringParam('scheduleDayOfMonth', original.schedule_day_of_month?.toString() || null),
        stringParam('scheduleTimezone', original.schedule_timezone as string || 'UTC'),
        stringParam('format', original.format as string),
        stringParam('recipients', JSON.stringify(original.recipients || [])),
        stringParam('parameters', JSON.stringify(original.parameters || {})),
        stringParam('createdBy', userId || null),
      ]
    );

    logger.info('Report duplicated', { originalId: reportId, newId });

    return {
      statusCode: 201,
      body: JSON.stringify({ id: newId, success: true }),
    };
  } catch (error) {
    logger.error('Failed to duplicate report', { error, reportId });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to duplicate report' }),
    };
  }
});

// Export handler map
export const handler: APIGatewayProxyHandler = async (event, context) => {
  const path = event.path;
  const method = event.httpMethod;

  // Templates
  if (path.endsWith('/templates') && method === 'GET') {
    return listTemplates(event, context, () => {});
  }

  // Stats
  if (path.endsWith('/stats') && method === 'GET') {
    return getStats(event, context, () => {});
  }

  // Report operations
  if (path.match(/\/reports\/[^/]+\/run$/) && method === 'POST') {
    return runReport(event, context, () => {});
  }

  if (path.match(/\/reports\/[^/]+\/duplicate$/) && method === 'POST') {
    return duplicateReport(event, context, () => {});
  }

  if (path.match(/\/reports\/[^/]+\/download\/[^/]+$/) && method === 'GET') {
    return downloadReport(event, context, () => {});
  }

  // CRUD
  if (path.endsWith('/reports') && method === 'GET') {
    return listReports(event, context, () => {});
  }

  if (path.endsWith('/reports') && method === 'POST') {
    return createReport(event, context, () => {});
  }

  if (path.match(/\/reports\/[^/]+$/) && method === 'GET') {
    return getReport(event, context, () => {});
  }

  if (path.match(/\/reports\/[^/]+$/) && method === 'PUT') {
    return updateReport(event, context, () => {});
  }

  if (path.match(/\/reports\/[^/]+$/) && method === 'DELETE') {
    return deleteReport(event, context, () => {});
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Not found' }),
  };
};
