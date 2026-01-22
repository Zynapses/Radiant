/**
 * User Violations Admin API Handler
 * 
 * API endpoints for managing user violations, appeals, and enforcement actions.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/utils/logger';
import { userViolationService } from '../shared/services/user-violation.service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const tenantId = event.requestContext.authorizer?.tenantId;
  const adminId = event.requestContext.authorizer?.userId;

  if (!tenantId || !adminId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const path = event.path.replace('/api/admin/violations', '');
  const method = event.httpMethod;

  try {
    // ========================================================================
    // Dashboard
    // ========================================================================

    // GET /dashboard - Get dashboard data
    if (path === '/dashboard' && method === 'GET') {
      const data = await userViolationService.getDashboardData(tenantId);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data),
      };
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    // GET /config - Get configuration
    if (path === '/config' && method === 'GET') {
      const config = await userViolationService.getConfig(tenantId);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(config),
      };
    }

    // PUT /config - Update configuration
    if (path === '/config' && method === 'PUT') {
      const updates = JSON.parse(event.body || '{}');
      const config = await userViolationService.updateConfig(tenantId, updates);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(config),
      };
    }

    // ========================================================================
    // Violations
    // ========================================================================

    // GET /violations - List/search violations
    if (path === '/violations' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const filters = {
        userId: params.userId,
        category: params.category as any,
        type: params.type as any,
        severity: params.severity as any,
        status: params.status as any,
        dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
        dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
        hasActiveEnforcement: params.hasActiveEnforcement === 'true',
      };
      const limit = parseInt(params.limit || '50', 10);
      const offset = parseInt(params.offset || '0', 10);

      const result = await userViolationService.searchViolations(tenantId, filters, limit, offset);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result),
      };
    }

    // POST /violations - Report a new violation
    if (path === '/violations' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const violation = await userViolationService.reportViolation(tenantId, adminId, body);
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(violation),
      };
    }

    // GET /violations/:id - Get single violation
    const violationMatch = path.match(/^\/violations\/([^/]+)$/);
    if (violationMatch && method === 'GET') {
      const violationId = violationMatch[1];
      const violation = await userViolationService.getViolation(tenantId, violationId);
      if (!violation) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Violation not found' }),
        };
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(violation),
      };
    }

    // PUT /violations/:id - Update violation
    if (violationMatch && method === 'PUT') {
      const violationId = violationMatch[1];
      const updates = JSON.parse(event.body || '{}');
      const violation = await userViolationService.updateViolation(tenantId, violationId, updates, adminId);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(violation),
      };
    }

    // POST /violations/:id/action - Take enforcement action
    const actionMatch = path.match(/^\/violations\/([^/]+)\/action$/);
    if (actionMatch && method === 'POST') {
      const violationId = actionMatch[1];
      const body = JSON.parse(event.body || '{}');
      const violation = await userViolationService.takeAction(
        tenantId,
        violationId,
        body.action,
        adminId,
        body.notes,
        body.expiresAt ? new Date(body.expiresAt) : undefined
      );
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(violation),
      };
    }

    // ========================================================================
    // User-specific
    // ========================================================================

    // GET /users/:userId/violations - Get user violations
    const userViolationsMatch = path.match(/^\/users\/([^/]+)\/violations$/);
    if (userViolationsMatch && method === 'GET') {
      const userId = userViolationsMatch[1];
      const violations = await userViolationService.getUserViolations(tenantId, userId);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ violations }),
      };
    }

    // GET /users/:userId/summary - Get user violation summary
    const userSummaryMatch = path.match(/^\/users\/([^/]+)\/summary$/);
    if (userSummaryMatch && method === 'GET') {
      const userId = userSummaryMatch[1];
      const summary = await userViolationService.getUserSummary(tenantId, userId);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(summary || { userId, tenantId, totalViolations: 0 }),
      };
    }

    // POST /users/:userId/suspend - Suspend user
    const suspendMatch = path.match(/^\/users\/([^/]+)\/suspend$/);
    if (suspendMatch && method === 'POST') {
      const userId = suspendMatch[1];
      const body = JSON.parse(event.body || '{}');
      await userViolationService.suspendUser(tenantId, userId, body.reason, body.durationDays);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    }

    // POST /users/:userId/reinstate - Reinstate user
    const reinstateMatch = path.match(/^\/users\/([^/]+)\/reinstate$/);
    if (reinstateMatch && method === 'POST') {
      const userId = reinstateMatch[1];
      const body = JSON.parse(event.body || '{}');
      await userViolationService.reinstateUser(tenantId, userId, adminId, body.reason);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    }

    // ========================================================================
    // Appeals
    // ========================================================================

    // GET /appeals - Get pending appeals
    if (path === '/appeals' && method === 'GET') {
      const appeals = await userViolationService.getPendingAppeals(tenantId);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ appeals }),
      };
    }

    // GET /appeals/:id - Get single appeal
    const appealMatch = path.match(/^\/appeals\/([^/]+)$/);
    if (appealMatch && method === 'GET') {
      const appealId = appealMatch[1];
      const appeal = await userViolationService.getAppeal(tenantId, appealId);
      if (!appeal) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Appeal not found' }),
        };
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(appeal),
      };
    }

    // POST /appeals/:id/review - Review appeal
    const reviewMatch = path.match(/^\/appeals\/([^/]+)\/review$/);
    if (reviewMatch && method === 'POST') {
      const appealId = reviewMatch[1];
      const body = JSON.parse(event.body || '{}');
      const appeal = await userViolationService.reviewAppeal(tenantId, appealId, adminId, body);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(appeal),
      };
    }

    // ========================================================================
    // Metrics
    // ========================================================================

    // GET /metrics - Get violation metrics
    if (path === '/metrics' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const startDate = params.startDate 
        ? new Date(params.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = params.endDate ? new Date(params.endDate) : new Date();

      const metrics = await userViolationService.getMetrics(tenantId, startDate, endDate);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(metrics),
      };
    }

    // ========================================================================
    // Escalation Policies
    // ========================================================================

    // GET /policies - Get escalation policies
    if (path === '/policies' && method === 'GET') {
      const policy = await userViolationService.getEscalationPolicy(tenantId);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ policy }),
      };
    }

    // POST /policies - Create escalation policy
    if (path === '/policies' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const policy = await userViolationService.createEscalationPolicy(
        tenantId,
        body.name,
        body.description,
        body.rules
      );
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(policy),
      };
    }

    // 404 for unknown routes
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' }),
    };

  } catch (error) {
    logger.error('Error handling violations request', { error, path, method });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
    };
  }
}
