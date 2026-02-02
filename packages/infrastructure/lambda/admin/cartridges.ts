/**
 * RADIANT Cartridge Admin API
 * Endpoints for managing portable AI brains (.RADz files)
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { cartridgeService } from '../shared/services/cartridge.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import type { CartridgeScope } from '@radiant/shared';

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
 * GET /api/admin/cartridges
 * List cartridges with filtering
 */
export const listCartridges: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const params = event.queryStringParameters || {};
    const result = await cartridgeService.listCartridges({
      tenantId,
      scope: params.scope as CartridgeScope | undefined,
      userId: params.userId,
      status: params.status as any,
      includeArchived: params.includeArchived === 'true',
      limit: params.limit ? parseInt(params.limit) : undefined,
      offset: params.offset ? parseInt(params.offset) : undefined,
    });

    return respond(200, result);
  } catch (error) {
    logger.error('Failed to list cartridges', { error });
    return respond(500, { error: 'Failed to list cartridges' });
  }
};

/**
 * GET /api/admin/cartridges/:id
 * Get a single cartridge
 */
export const getCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const cartridgeId = event.pathParameters?.id;

    if (!tenantId || !cartridgeId) {
      return respond(400, { error: 'Tenant ID and Cartridge ID required' });
    }

    const cartridge = await cartridgeService.getCartridge(cartridgeId, tenantId);
    if (!cartridge) {
      return respond(404, { error: 'Cartridge not found' });
    }

    return respond(200, { cartridge });
  } catch (error) {
    logger.error('Failed to get cartridge', { error });
    return respond(500, { error: 'Failed to get cartridge' });
  }
};

/**
 * POST /api/admin/cartridges
 * Create a new cartridge
 */
export const createCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.name || !body.scope || !body.domains) {
      return respond(400, { error: 'name, scope, and domains are required' });
    }

    const cartridge = await cartridgeService.createCartridge(tenantId, userId, body);
    return respond(201, { cartridge });
  } catch (error) {
    logger.error('Failed to create cartridge', { error });
    return respond(500, { error: 'Failed to create cartridge' });
  }
};

/**
 * PATCH /api/admin/cartridges/:id
 * Update a cartridge
 */
export const updateCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const cartridgeId = event.pathParameters?.id;

    if (!tenantId || !cartridgeId) {
      return respond(400, { error: 'Tenant ID and Cartridge ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    const cartridge = await cartridgeService.updateCartridge(cartridgeId, tenantId, userId, body);
    return respond(200, { cartridge });
  } catch (error) {
    logger.error('Failed to update cartridge', { error });
    return respond(500, { error: 'Failed to update cartridge' });
  }
};

/**
 * DELETE /api/admin/cartridges/:id
 * Archive (soft-delete) a cartridge
 */
export const deleteCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const cartridgeId = event.pathParameters?.id;

    if (!tenantId || !cartridgeId) {
      return respond(400, { error: 'Tenant ID and Cartridge ID required' });
    }

    await cartridgeService.archiveCartridge(cartridgeId, tenantId, userId);
    return respond(200, { success: true, message: 'Cartridge archived' });
  } catch (error) {
    logger.error('Failed to delete cartridge', { error });
    return respond(500, { error: 'Failed to delete cartridge' });
  }
};

/**
 * POST /api/admin/cartridges/export
 * Export a cartridge to .RADz file
 */
export const exportCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.scope || !body.domains) {
      return respond(400, { error: 'scope and domains are required' });
    }

    const result = await cartridgeService.exportCartridge(tenantId, userId, {
      scope: body.scope,
      tenantId,
      userId: body.scope === 'user' ? userId : undefined,
      domains: body.domains,
      includeLora: body.includeLora ?? false,
      includeCurator: body.includeCurator ?? false,
      includeGhost: body.includeGhost ?? false,
      includeDomainExperts: body.includeDomainExperts ?? false,
      encryptionKey: body.encryptionKey,
    });

    return respond(200, result);
  } catch (error) {
    logger.error('Failed to export cartridge', { error });
    return respond(500, { error: 'Failed to export cartridge' });
  }
};

/**
 * POST /api/admin/cartridges/import
 * Import a cartridge from .RADz file
 */
export const importCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.scope || !body.fileKey) {
      return respond(400, { error: 'scope and fileKey are required' });
    }

    const result = await cartridgeService.importCartridge(tenantId, userId, {
      scope: body.scope,
      tenantId,
      userId: body.scope === 'user' ? userId : undefined,
      fileKey: body.fileKey,
      validateSignature: body.validateSignature ?? true,
      mergeStrategy: body.mergeStrategy ?? 'replace',
      activateImmediately: body.activateImmediately ?? false,
    });

    return respond(200, result);
  } catch (error) {
    logger.error('Failed to import cartridge', { error });
    return respond(500, { error: 'Failed to import cartridge' });
  }
};

/**
 * GET /api/admin/cartridges/stack
 * Get the cartridge stack for a user
 */
export const getCartridgeStack: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = event.queryStringParameters?.userId || getUserId(event);

    if (!tenantId) {
      return respond(400, { error: 'Tenant ID required' });
    }

    const stack = await cartridgeService.getCartridgeStack(tenantId, userId);
    return respond(200, { stack });
  } catch (error) {
    logger.error('Failed to get cartridge stack', { error });
    return respond(500, { error: 'Failed to get cartridge stack' });
  }
};

/**
 * POST /api/admin/cartridges/:id/toggle
 * Toggle a user cartridge on/off
 */
export const toggleCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const cartridgeId = event.pathParameters?.id;

    if (!tenantId || !cartridgeId) {
      return respond(400, { error: 'Tenant ID and Cartridge ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    if (typeof body.enabled !== 'boolean') {
      return respond(400, { error: 'enabled (boolean) is required' });
    }

    const cartridge = await cartridgeService.toggleUserCartridge(
      cartridgeId,
      tenantId,
      userId,
      body.enabled
    );

    return respond(200, { cartridge });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle cartridge';
    logger.error('Failed to toggle cartridge', { error });
    
    if (message.includes('Cannot toggle tenant')) {
      return respond(403, { error: message });
    }
    
    return respond(500, { error: message });
  }
};

/**
 * POST /api/admin/cartridges/:id/validate
 * Validate a cartridge file
 */
export const validateCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.fileKey) {
      return respond(400, { error: 'fileKey is required' });
    }

    const result = await cartridgeService.validateCartridgeFile(body.fileKey);
    return respond(200, result);
  } catch (error) {
    logger.error('Failed to validate cartridge', { error });
    return respond(500, { error: 'Failed to validate cartridge' });
  }
};
