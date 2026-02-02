/**
 * RADIANT CATO Twilight Dreaming Admin API
 * Endpoints for 30% Invention Enforcement & PromptBreeder Evolution
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { twilightDreamingService } from '../shared/services/cato/twilight-dreaming.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const getTenantId = (event: { headers: Record<string, string | undefined> }): string => {
  return event.headers['x-tenant-id'] || event.headers['X-Tenant-Id'] || '';
};

const getUserId = (event: { requestContext: { authorizer?: { claims?: { sub?: string } } } }): string => {
  return event.requestContext.authorizer?.claims?.sub || 'system';
};

/**
 * GET /api/admin/cato-twilight/dashboard
 * Get twilight dreaming dashboard
 */
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const dashboard = await twilightDreamingService.getDashboard(tenantId);
    return respond(200, dashboard);
  } catch (error) {
    logger.error('Failed to get twilight dashboard', { error });
    return respond(500, { error: 'Failed to get dashboard' });
  }
};

/**
 * POST /api/admin/cato-twilight/sessions
 * Start a new dreaming session
 */
export const startSession: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    const result = await twilightDreamingService.startDreamingSession(tenantId, {
      tenantId,
      populationId: body.populationId,
      generationsToEvolve: body.generations,
      operatorOverrides: body.operatorOverrides,
    });

    return respond(201, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start session';
    logger.error('Failed to start dreaming session', { error });
    return respond(500, { error: message });
  }
};

/**
 * GET /api/admin/cato-twilight/invention-rate
 * Check current invention rate and enforcement status
 */
export const getInventionRate: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = event.queryStringParameters?.userId;

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const result = await twilightDreamingService.checkInventionRate(tenantId, userId);
    return respond(200, result);
  } catch (error) {
    logger.error('Failed to get invention rate', { error });
    return respond(500, { error: 'Failed to get invention rate' });
  }
};

/**
 * GET /api/admin/cato-twilight/config
 * Get invention enforcement configuration
 */
export const getConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const config = await twilightDreamingService.getEnforcementConfig(tenantId);
    return respond(200, { config });
  } catch (error) {
    logger.error('Failed to get enforcement config', { error });
    return respond(500, { error: 'Failed to get config' });
  }
};

/**
 * PATCH /api/admin/cato-twilight/config
 * Update invention enforcement configuration
 */
export const updateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    const config = await twilightDreamingService.updateEnforcementConfig(tenantId, body);
    return respond(200, { config });
  } catch (error) {
    logger.error('Failed to update enforcement config', { error });
    return respond(500, { error: 'Failed to update config' });
  }
};

/**
 * POST /api/admin/cato-twilight/inventions/:id/approve
 * Approve an invention candidate
 */
export const approveInvention: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const inventionId = event.pathParameters?.id;

    if (!tenantId || !inventionId) {
      return respond(400, { error: 'Tenant ID and Invention ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    await twilightDreamingService.approveInvention(
      tenantId,
      inventionId,
      userId,
      body.notes,
      body.deployImmediately
    );

    return respond(200, { success: true, message: 'Invention approved' });
  } catch (error) {
    logger.error('Failed to approve invention', { error });
    return respond(500, { error: 'Failed to approve invention' });
  }
};

/**
 * POST /api/admin/cato-twilight/record-response
 * Record a response for invention tracking
 */
export const recordResponse: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (typeof body.noveltyScore !== 'number') {
      return respond(400, { error: 'noveltyScore is required' });
    }

    await twilightDreamingService.recordResponse(tenantId, userId, {
      noveltyScore: body.noveltyScore,
      creativityScore: body.creativityScore || 0,
      isInventive: body.isInventive ?? (body.noveltyScore >= 0.6),
    });

    return respond(200, { success: true });
  } catch (error) {
    logger.error('Failed to record response', { error });
    return respond(500, { error: 'Failed to record response' });
  }
};
