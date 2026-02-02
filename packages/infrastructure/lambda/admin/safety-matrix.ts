/**
 * RADIANT Safety Matrix Manager Admin API
 * Entity-Action Contraindication Grid Endpoints
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { safetyMatrixService } from '../shared/services/safety-matrix.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import type { EntityCategory } from '@radiant/shared';

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
 * GET /api/admin/safety-matrix/dashboard
 * Get safety matrix dashboard
 */
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const dashboard = await safetyMatrixService.getDashboard(tenantId);
    return respond(200, dashboard);
  } catch (error) {
    logger.error('Failed to get safety matrix dashboard', { error });
    return respond(500, { error: 'Failed to get dashboard' });
  }
};

/**
 * GET /api/admin/safety-matrix/entities
 * List entities
 */
export const listEntities: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const params = event.queryStringParameters || {};

    if (!tenantId || !params.domainId) {
      return respond(400, { error: 'Tenant ID and Domain ID required' });
    }

    const result = await safetyMatrixService.listEntities({
      tenantId,
      domainId: params.domainId,
      category: params.category as EntityCategory | undefined,
      search: params.search,
      limit: params.limit ? parseInt(params.limit) : undefined,
      offset: params.offset ? parseInt(params.offset) : undefined,
    });

    return respond(200, result);
  } catch (error) {
    logger.error('Failed to list entities', { error });
    return respond(500, { error: 'Failed to list entities' });
  }
};

/**
 * POST /api/admin/safety-matrix/entities
 * Create entity
 */
export const createEntity: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.domainId || !body.name || !body.category) {
      return respond(400, { error: 'domainId, name, and category are required' });
    }

    const entity = await safetyMatrixService.createEntity(tenantId, userId, body);
    return respond(201, { entity });
  } catch (error) {
    logger.error('Failed to create entity', { error });
    return respond(500, { error: 'Failed to create entity' });
  }
};

/**
 * GET /api/admin/safety-matrix/actions
 * List actions
 */
export const listActions: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const domainId = event.queryStringParameters?.domainId;

    if (!tenantId || !domainId) {
      return respond(400, { error: 'Tenant ID and Domain ID required' });
    }

    const actions = await safetyMatrixService.listActions(tenantId, domainId);
    return respond(200, { actions });
  } catch (error) {
    logger.error('Failed to list actions', { error });
    return respond(500, { error: 'Failed to list actions' });
  }
};

/**
 * POST /api/admin/safety-matrix/actions
 * Create action
 */
export const createAction: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.domainId || !body.name || !body.category) {
      return respond(400, { error: 'domainId, name, and category are required' });
    }

    const action = await safetyMatrixService.createAction(tenantId, userId, body);
    return respond(201, { action });
  } catch (error) {
    logger.error('Failed to create action', { error });
    return respond(500, { error: 'Failed to create action' });
  }
};

/**
 * GET /api/admin/safety-matrix/contraindications
 * List contraindications
 */
export const listContraindications: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const params = event.queryStringParameters || {};

    if (!tenantId || !params.domainId) {
      return respond(400, { error: 'Tenant ID and Domain ID required' });
    }

    const contraindications = await safetyMatrixService.listContraindications(
      tenantId,
      params.domainId,
      {
        entityId: params.entityId,
        actionId: params.actionId,
        status: params.status,
        limit: params.limit ? parseInt(params.limit) : undefined,
      }
    );

    return respond(200, { contraindications });
  } catch (error) {
    logger.error('Failed to list contraindications', { error });
    return respond(500, { error: 'Failed to list contraindications' });
  }
};

/**
 * POST /api/admin/safety-matrix/contraindications
 * Create contraindication
 */
export const createContraindication: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.domainId || !body.entityId || !body.actionId || !body.severity || !body.reason) {
      return respond(400, { error: 'domainId, entityId, actionId, severity, and reason are required' });
    }

    const contraindication = await safetyMatrixService.createContraindication(tenantId, userId, body);
    return respond(201, { contraindication });
  } catch (error) {
    logger.error('Failed to create contraindication', { error });
    return respond(500, { error: 'Failed to create contraindication' });
  }
};

/**
 * PATCH /api/admin/safety-matrix/contraindications/:id
 * Update contraindication
 */
export const updateContraindication: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const contraindicationId = event.pathParameters?.id;

    if (!tenantId || !contraindicationId) {
      return respond(400, { error: 'Tenant ID and Contraindication ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    const contraindication = await safetyMatrixService.updateContraindication(tenantId, contraindicationId, body);
    return respond(200, { contraindication });
  } catch (error) {
    logger.error('Failed to update contraindication', { error });
    return respond(500, { error: 'Failed to update contraindication' });
  }
};

/**
 * POST /api/admin/safety-matrix/contraindications/:id/review
 * Review contraindication
 */
export const reviewContraindication: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const contraindicationId = event.pathParameters?.id;

    if (!tenantId || !contraindicationId) {
      return respond(400, { error: 'Tenant ID and Contraindication ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (typeof body.approved !== 'boolean') {
      return respond(400, { error: 'approved is required' });
    }

    await safetyMatrixService.reviewContraindication(tenantId, contraindicationId, userId, body);
    return respond(200, { success: true });
  } catch (error) {
    logger.error('Failed to review contraindication', { error });
    return respond(500, { error: 'Failed to review contraindication' });
  }
};

/**
 * POST /api/admin/safety-matrix/check
 * Check for contraindications
 */
export const checkContraindication: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.domainId) {
      return respond(400, { error: 'domainId is required' });
    }

    const result = await safetyMatrixService.checkContraindication({
      tenantId,
      domainId: body.domainId,
      entityId: body.entityId,
      entityName: body.entityName,
      actionId: body.actionId,
      actionName: body.actionName,
      secondEntityId: body.secondEntityId,
      secondEntityName: body.secondEntityName,
      context: body.context,
      includeAlternatives: body.includeAlternatives,
      includeMlSuggestions: body.includeMlSuggestions,
    });

    return respond(200, result);
  } catch (error) {
    logger.error('Failed to check contraindication', { error });
    return respond(500, { error: 'Failed to check contraindication' });
  }
};

/**
 * GET /api/admin/safety-matrix/grid
 * Get matrix grid
 */
export const getMatrixGrid: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const params = event.queryStringParameters || {};

    if (!tenantId || !params.domainId) {
      return respond(400, { error: 'Tenant ID and Domain ID required' });
    }

    const grid = await safetyMatrixService.getMatrixGrid({
      tenantId,
      domainId: params.domainId,
      entityCategory: params.entityCategory as EntityCategory | undefined,
      entityLimit: params.entityLimit ? parseInt(params.entityLimit) : undefined,
      actionLimit: params.actionLimit ? parseInt(params.actionLimit) : undefined,
    });

    return respond(200, grid);
  } catch (error) {
    logger.error('Failed to get matrix grid', { error });
    return respond(500, { error: 'Failed to get matrix grid' });
  }
};
