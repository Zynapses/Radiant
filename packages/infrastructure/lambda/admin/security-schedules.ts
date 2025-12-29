// RADIANT v4.18.0 - Security Schedules Admin API Handler
// Runtime-adjustable EventBridge schedules for security monitoring
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import {
  securityScheduleService,
  ScheduleType,
  SCHEDULE_PRESETS,
  CronParseResult,
} from '../shared/services/security-schedule.service';

// ============================================================================
// Helper Functions
// ============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function getTenantId(event: { requestContext: { authorizer?: Record<string, unknown> | null } }): string {
  const tenantId = event.requestContext.authorizer?.tenantId as string | undefined;
  if (!tenantId) throw new Error('Tenant ID not found in request context');
  return tenantId;
}

function getUserId(event: { requestContext: { authorizer?: Record<string, unknown> | null } }): string {
  const userId = event.requestContext.authorizer?.userId as string | undefined;
  if (!userId) throw new Error('User ID not found in request context');
  return userId;
}

// ============================================================================
// Route Handlers
// ============================================================================

// GET /api/admin/security/schedules
async function getSchedulesConfig(tenantId: string): Promise<APIGatewayProxyResult> {
  const config = await securityScheduleService.getConfig(tenantId);
  return response(200, config);
}

// PUT /api/admin/security/schedules/:type
async function updateSchedule(
  tenantId: string,
  userId: string,
  scheduleType: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) return response(400, { error: 'Request body required' });

  const validTypes: ScheduleType[] = [
    'drift_detection',
    'anomaly_detection',
    'classification_review',
    'weekly_security_scan',
    'weekly_benchmark',
  ];

  if (!validTypes.includes(scheduleType as ScheduleType)) {
    return response(400, { error: `Invalid schedule type: ${scheduleType}` });
  }

  const request = JSON.parse(body);
  const config = await securityScheduleService.updateSchedule(tenantId, userId, {
    type: scheduleType as ScheduleType,
    enabled: request.enabled,
    cronExpression: request.cronExpression,
    description: request.description,
    reason: request.reason,
  });

  return response(200, config);
}

// POST /api/admin/security/schedules/:type/enable
async function enableSchedule(
  tenantId: string,
  userId: string,
  scheduleType: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  const validTypes: ScheduleType[] = [
    'drift_detection',
    'anomaly_detection',
    'classification_review',
    'weekly_security_scan',
    'weekly_benchmark',
  ];

  if (!validTypes.includes(scheduleType as ScheduleType)) {
    return response(400, { error: `Invalid schedule type: ${scheduleType}` });
  }

  const request = body ? JSON.parse(body) : {};
  await securityScheduleService.enableSchedule(
    tenantId,
    userId,
    scheduleType as ScheduleType,
    request.reason
  );

  return response(200, { success: true, message: `${scheduleType} schedule enabled` });
}

// POST /api/admin/security/schedules/:type/disable
async function disableSchedule(
  tenantId: string,
  userId: string,
  scheduleType: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  const validTypes: ScheduleType[] = [
    'drift_detection',
    'anomaly_detection',
    'classification_review',
    'weekly_security_scan',
    'weekly_benchmark',
  ];

  if (!validTypes.includes(scheduleType as ScheduleType)) {
    return response(400, { error: `Invalid schedule type: ${scheduleType}` });
  }

  const request = body ? JSON.parse(body) : {};
  await securityScheduleService.disableSchedule(
    tenantId,
    userId,
    scheduleType as ScheduleType,
    request.reason
  );

  return response(200, { success: true, message: `${scheduleType} schedule disabled` });
}

// GET /api/admin/security/schedules/:type/status
async function getScheduleStatus(
  tenantId: string,
  scheduleType: string
): Promise<APIGatewayProxyResult> {
  const validTypes: ScheduleType[] = [
    'drift_detection',
    'anomaly_detection',
    'classification_review',
    'weekly_security_scan',
    'weekly_benchmark',
  ];

  if (!validTypes.includes(scheduleType as ScheduleType)) {
    return response(400, { error: `Invalid schedule type: ${scheduleType}` });
  }

  const status = await securityScheduleService.getRuleStatus(
    tenantId,
    scheduleType as ScheduleType
  );

  return response(200, status);
}

// POST /api/admin/security/schedules/:type/run
async function triggerSchedule(
  tenantId: string,
  scheduleType: string
): Promise<APIGatewayProxyResult> {
  const validTypes: ScheduleType[] = [
    'drift_detection',
    'anomaly_detection',
    'classification_review',
    'weekly_security_scan',
    'weekly_benchmark',
  ];

  if (!validTypes.includes(scheduleType as ScheduleType)) {
    return response(400, { error: `Invalid schedule type: ${scheduleType}` });
  }

  // Start a new execution
  const executionId = await securityScheduleService.startExecution(
    tenantId,
    scheduleType as ScheduleType
  );

  // Note: The actual execution would be triggered by invoking the monitoring Lambda
  // This is a placeholder - in production, you'd invoke the Lambda here

  return response(200, {
    success: true,
    message: `${scheduleType} triggered manually`,
    executionId,
  });
}

// GET /api/admin/security/schedules/executions
async function getExecutions(
  tenantId: string,
  queryParams: { scheduleType?: string; limit?: string; since?: string }
): Promise<APIGatewayProxyResult> {
  const executions = await securityScheduleService.getRecentExecutions(tenantId, {
    scheduleType: queryParams.scheduleType as ScheduleType | undefined,
    limit: queryParams.limit ? parseInt(queryParams.limit, 10) : undefined,
    since: queryParams.since ? new Date(queryParams.since) : undefined,
  });

  return response(200, { executions });
}

// GET /api/admin/security/schedules/stats
async function getExecutionStats(
  tenantId: string,
  queryParams: { days?: string }
): Promise<APIGatewayProxyResult> {
  const days = queryParams.days ? parseInt(queryParams.days, 10) : 30;
  const stats = await securityScheduleService.getExecutionStats(tenantId, days);

  return response(200, stats);
}

// GET /api/admin/security/schedules/audit
async function getAuditLog(
  tenantId: string,
  queryParams: { scheduleType?: string; limit?: string }
): Promise<APIGatewayProxyResult> {
  const audit = await securityScheduleService.getAuditLog(tenantId, {
    scheduleType: queryParams.scheduleType as ScheduleType | undefined,
    limit: queryParams.limit ? parseInt(queryParams.limit, 10) : undefined,
  });

  return response(200, { audit });
}

// GET /api/admin/security/schedules/presets
async function getPresets(): Promise<APIGatewayProxyResult> {
  return response(200, { presets: SCHEDULE_PRESETS });
}

// POST /api/admin/security/schedules/parse-cron
async function parseCron(body: string | null): Promise<APIGatewayProxyResult> {
  if (!body) return response(400, { error: 'Request body required' });
  const { cronExpression } = JSON.parse(body);
  const result = securityScheduleService.parseCronExpression(cronExpression);
  return response(200, result);
}

// POST /api/admin/security/schedules/:type/run-now
async function runNow(
  tenantId: string,
  scheduleType: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  const request = body ? JSON.parse(body) : {};
  const result = await securityScheduleService.runNow(
    tenantId,
    scheduleType as ScheduleType,
    { dryRun: request.dryRun }
  );
  return response(200, result);
}

// POST /api/admin/security/schedules/bulk/enable
async function bulkEnable(
  tenantId: string,
  userId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  const request = body ? JSON.parse(body) : {};
  const config = await securityScheduleService.enableAllSchedules(tenantId, userId, request.reason);
  return response(200, config);
}

// POST /api/admin/security/schedules/bulk/disable
async function bulkDisable(
  tenantId: string,
  userId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  const request = body ? JSON.parse(body) : {};
  const config = await securityScheduleService.disableAllSchedules(tenantId, userId, request.reason);
  return response(200, config);
}

// GET /api/admin/security/schedules/templates
async function getTemplates(tenantId: string): Promise<APIGatewayProxyResult> {
  const templates = await securityScheduleService.getTemplates(tenantId);
  return response(200, { templates });
}

// POST /api/admin/security/schedules/templates
async function createTemplate(
  tenantId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) return response(400, { error: 'Request body required' });
  const request = JSON.parse(body);
  const template = await securityScheduleService.saveTemplate(tenantId, request);
  return response(201, template);
}

// POST /api/admin/security/schedules/templates/:id/apply
async function applyTemplate(
  tenantId: string,
  userId: string,
  templateId: string
): Promise<APIGatewayProxyResult> {
  const config = await securityScheduleService.applyTemplate(tenantId, userId, templateId);
  return response(200, config);
}

// DELETE /api/admin/security/schedules/templates/:id
async function deleteTemplate(
  tenantId: string,
  templateId: string
): Promise<APIGatewayProxyResult> {
  await securityScheduleService.deleteTemplate(tenantId, templateId);
  return response(200, { success: true });
}

// GET /api/admin/security/schedules/notifications
async function getNotifications(tenantId: string): Promise<APIGatewayProxyResult> {
  const config = await securityScheduleService.getNotificationConfig(tenantId);
  return response(200, config);
}

// PUT /api/admin/security/schedules/notifications
async function updateNotifications(
  tenantId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) return response(400, { error: 'Request body required' });
  const request = JSON.parse(body);
  const config = await securityScheduleService.updateNotificationConfig(tenantId, request);
  return response(200, config);
}

// GET /api/admin/security/schedules/webhooks
async function getWebhooks(tenantId: string): Promise<APIGatewayProxyResult> {
  const webhooks = await securityScheduleService.getWebhooks(tenantId);
  return response(200, { webhooks });
}

// POST /api/admin/security/schedules/webhooks
async function createWebhook(
  tenantId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) return response(400, { error: 'Request body required' });
  const request = JSON.parse(body);
  const result = await securityScheduleService.registerWebhook(tenantId, request);
  return response(201, result);
}

// DELETE /api/admin/security/schedules/webhooks/:id
async function deleteWebhook(
  tenantId: string,
  webhookId: string
): Promise<APIGatewayProxyResult> {
  await securityScheduleService.deleteWebhook(tenantId, webhookId);
  return response(200, { success: true });
}

// GET /api/admin/security/schedules/dashboard
async function getDashboard(tenantId: string): Promise<APIGatewayProxyResult> {
  const [config, stats, recentExecutions] = await Promise.all([
    securityScheduleService.getConfig(tenantId),
    securityScheduleService.getExecutionStats(tenantId, 30),
    securityScheduleService.getRecentExecutions(tenantId, { limit: 10 }),
  ]);

  return response(200, {
    config,
    stats,
    recentExecutions,
  });
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  logger.info('Security schedules request', {
    method: event.httpMethod,
    path: event.path,
  });

  try {
    // Handle OPTIONS for CORS
    if (event.httpMethod === 'OPTIONS') {
      return response(200, {});
    }

    const tenantId = getTenantId(event);
    const path = event.path.replace('/api/admin/security/schedules', '');
    const pathParts = path.split('/').filter(Boolean);

    // Route handling
    switch (event.httpMethod) {
      case 'GET':
        if (path === '' || path === '/') {
          return await getSchedulesConfig(tenantId);
        }
        if (path === '/dashboard') {
          return await getDashboard(tenantId);
        }
        if (path === '/executions') {
          return await getExecutions(tenantId, event.queryStringParameters || {});
        }
        if (path === '/stats') {
          return await getExecutionStats(tenantId, event.queryStringParameters || {});
        }
        if (path === '/audit') {
          return await getAuditLog(tenantId, event.queryStringParameters || {});
        }
        if (path === '/presets') {
          return await getPresets();
        }
        if (path === '/templates') {
          return await getTemplates(tenantId);
        }
        if (path === '/notifications') {
          return await getNotifications(tenantId);
        }
        if (path === '/webhooks') {
          return await getWebhooks(tenantId);
        }
        if (pathParts.length === 2 && pathParts[1] === 'status') {
          return await getScheduleStatus(tenantId, pathParts[0]);
        }
        break;

      case 'PUT':
        if (pathParts.length === 1) {
          const userId = getUserId(event);
          return await updateSchedule(tenantId, userId, pathParts[0], event.body);
        }
        if (path === '/notifications') {
          return await updateNotifications(tenantId, event.body);
        }
        break;

      case 'POST':
        if (pathParts.length === 2 && pathParts[1] === 'enable') {
          const userId = getUserId(event);
          return await enableSchedule(tenantId, userId, pathParts[0], event.body);
        }
        if (pathParts.length === 2 && pathParts[1] === 'disable') {
          const userId = getUserId(event);
          return await disableSchedule(tenantId, userId, pathParts[0], event.body);
        }
        if (pathParts.length === 2 && pathParts[1] === 'run') {
          return await triggerSchedule(tenantId, pathParts[0]);
        }
        if (pathParts.length === 2 && pathParts[1] === 'run-now') {
          return await runNow(tenantId, pathParts[0], event.body);
        }
        if (path === '/parse-cron') {
          return await parseCron(event.body);
        }
        if (path === '/bulk/enable') {
          const userId = getUserId(event);
          return await bulkEnable(tenantId, userId, event.body);
        }
        if (path === '/bulk/disable') {
          const userId = getUserId(event);
          return await bulkDisable(tenantId, userId, event.body);
        }
        if (path === '/templates') {
          return await createTemplate(tenantId, event.body);
        }
        if (pathParts.length === 3 && pathParts[0] === 'templates' && pathParts[2] === 'apply') {
          const userId = getUserId(event);
          return await applyTemplate(tenantId, userId, pathParts[1]);
        }
        if (path === '/webhooks') {
          return await createWebhook(tenantId, event.body);
        }
        break;

      case 'DELETE':
        if (pathParts.length === 2 && pathParts[0] === 'templates') {
          return await deleteTemplate(tenantId, pathParts[1]);
        }
        if (pathParts.length === 2 && pathParts[0] === 'webhooks') {
          return await deleteWebhook(tenantId, pathParts[1]);
        }
        break;
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    logger.error('Security schedules error', { error: String(error) });
    return response(500, { error: 'Internal server error', message: String(error) });
  }
};
