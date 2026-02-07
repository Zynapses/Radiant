/**
 * Cartridge Service Layer API
 * 
 * This API is accessed by Think Tank Tenant Admin App which sits BEHIND
 * the service layer. All requests are tenant-isolated - a tenant can ONLY
 * access their own cartridges plus view (but not modify) system cartridges.
 * 
 * The service layer enforces tenant isolation via the tenant ID in the
 * authenticated JWT token.
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { cartridgeService } from '../shared/services/cartridge.service';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'gateway/cartridge-api',
  category: 'infrastructure',
  sourceType: 'lambda',
});
import type { CartridgeScope } from '@radiant/shared';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

/**
 * Extract tenant ID from JWT claims (service layer authenticated)
 */
const getTenantId = (event: { requestContext: { authorizer?: { claims?: { tenant_id?: string } } } }): string => {
  return event.requestContext.authorizer?.claims?.tenant_id || '';
};

const getUserId = (event: { requestContext: { authorizer?: { claims?: { sub?: string } } } }): string => {
  return event.requestContext.authorizer?.claims?.sub || '';
};

// =============================================================================
// Tenant-Isolated Cartridge API (Service Layer)
// =============================================================================

/**
 * GET /api/v1/tenant/cartridges
 * List tenant's cartridges (system cartridges read-only, tenant cartridges manageable)
 * 
 * IMPORTANT: Tenant can only see:
 * - System cartridges (read-only)
 * - Their own tenant cartridges (manageable)
 */
export const listTenantCartridges: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return respond(401, { error: 'Unauthorized - tenant ID required' });
    }

    const params = event.queryStringParameters || {};
    const includeSystem = params.includeSystem !== 'false';

    // Get tenant's own cartridges
    const tenantResult = await cartridgeService.listCartridges({
      tenantId,
      scope: 'tenant',
      includeArchived: params.includeArchived === 'true',
      limit: params.limit ? parseInt(params.limit) : 50,
      offset: params.offset ? parseInt(params.offset) : 0,
    });

    // Optionally include system cartridges (read-only)
    let systemCartridges: unknown[] = [];
    if (includeSystem) {
      const systemResult = await cartridgeService.listSystemCartridges();
      systemCartridges = systemResult.cartridges.map(c => ({
        ...c,
        _readOnly: true, // Mark as read-only for UI
        _scope: 'system',
      }));
    }

    logger.info('Tenant cartridges listed', { tenantId, count: tenantResult.total });

    return respond(200, {
      cartridges: tenantResult.cartridges,
      systemCartridges,
      total: tenantResult.total,
      limit: tenantResult.limit,
      offset: tenantResult.offset,
    });
  } catch (error) {
    logger.error('Failed to list tenant cartridges', { error });
    return respond(500, { error: 'Failed to list cartridges' });
  }
};

/**
 * GET /api/v1/tenant/cartridges/:id
 * Get a single cartridge (must belong to tenant or be system)
 */
export const getTenantCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const cartridgeId = event.pathParameters?.id;

    if (!tenantId) {
      return respond(401, { error: 'Unauthorized - tenant ID required' });
    }

    if (!cartridgeId) {
      return respond(400, { error: 'Cartridge ID required' });
    }

    // First try tenant cartridge
    let cartridge = await cartridgeService.getCartridge(cartridgeId, tenantId);
    
    // If not found, check if it's a system cartridge (read-only access)
    if (!cartridge) {
      const systemResult = await cartridgeService.listSystemCartridges();
      const systemCartridge = systemResult.cartridges.find(c => c.id === cartridgeId);
      if (systemCartridge) {
        return respond(200, { 
          cartridge: { ...systemCartridge, _readOnly: true },
        });
      }
      return respond(404, { error: 'Cartridge not found' });
    }

    return respond(200, { cartridge });
  } catch (error) {
    logger.error('Failed to get tenant cartridge', { error });
    return respond(500, { error: 'Failed to get cartridge' });
  }
};

/**
 * POST /api/v1/tenant/cartridges
 * Create a new tenant cartridge
 * 
 * NOTE: Tenants can ONLY create tenant-scoped cartridges, not system.
 */
export const createTenantCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(401, { error: 'Unauthorized - tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    
    // CRITICAL: Tenants can ONLY create tenant-scoped cartridges
    if (body.scope && body.scope !== 'tenant') {
      return respond(403, { 
        error: 'Forbidden - tenants can only create tenant-scoped cartridges' 
      });
    }

    if (!body.name || !body.domains) {
      return respond(400, { error: 'name and domains are required' });
    }

    const cartridge = await cartridgeService.createCartridge(tenantId, userId, {
      ...body,
      scope: 'tenant', // Force tenant scope
    });

    logger.info('Tenant cartridge created', { cartridgeId: cartridge.id, tenantId });

    return respond(201, { cartridge });
  } catch (error) {
    logger.error('Failed to create tenant cartridge', { error });
    return respond(500, { error: 'Failed to create cartridge' });
  }
};

/**
 * PATCH /api/v1/tenant/cartridges/:id
 * Update a tenant cartridge
 * 
 * NOTE: Cannot modify system cartridges.
 */
export const updateTenantCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const cartridgeId = event.pathParameters?.id;

    if (!tenantId) {
      return respond(401, { error: 'Unauthorized - tenant ID required' });
    }

    if (!cartridgeId) {
      return respond(400, { error: 'Cartridge ID required' });
    }

    // Verify this is a tenant cartridge (not system)
    const existing = await cartridgeService.getCartridge(cartridgeId, tenantId);
    if (!existing) {
      return respond(404, { error: 'Cartridge not found or not editable' });
    }

    if (existing.scope === 'system') {
      return respond(403, { error: 'Cannot modify system cartridges' });
    }

    const body = JSON.parse(event.body || '{}');
    
    // Don't allow changing scope
    delete body.scope;

    const cartridge = await cartridgeService.updateCartridge(
      cartridgeId, 
      tenantId, 
      userId, 
      body
    );

    logger.info('Tenant cartridge updated', { cartridgeId, tenantId });

    return respond(200, { cartridge });
  } catch (error) {
    logger.error('Failed to update tenant cartridge', { error });
    return respond(500, { error: 'Failed to update cartridge' });
  }
};

/**
 * DELETE /api/v1/tenant/cartridges/:id
 * Archive a tenant cartridge
 * 
 * NOTE: Cannot delete system cartridges.
 */
export const deleteTenantCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const cartridgeId = event.pathParameters?.id;

    if (!tenantId) {
      return respond(401, { error: 'Unauthorized - tenant ID required' });
    }

    if (!cartridgeId) {
      return respond(400, { error: 'Cartridge ID required' });
    }

    // Verify this is a tenant cartridge (not system)
    const existing = await cartridgeService.getCartridge(cartridgeId, tenantId);
    if (!existing) {
      return respond(404, { error: 'Cartridge not found' });
    }

    if (existing.scope === 'system') {
      return respond(403, { error: 'Cannot delete system cartridges' });
    }

    await cartridgeService.archiveCartridge(cartridgeId, tenantId, userId);

    logger.info('Tenant cartridge archived', { cartridgeId, tenantId });

    return respond(200, { success: true, message: 'Cartridge archived' });
  } catch (error) {
    logger.error('Failed to delete tenant cartridge', { error });
    return respond(500, { error: 'Failed to delete cartridge' });
  }
};

/**
 * GET /api/v1/tenant/cartridges/stack
 * Get the cartridge stack for the tenant
 * Shows system → tenant resolution
 */
export const getTenantCartridgeStack: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = event.queryStringParameters?.userId || getUserId(event);

    if (!tenantId) {
      return respond(401, { error: 'Unauthorized - tenant ID required' });
    }

    const stack = await cartridgeService.getCartridgeStack(tenantId, userId);

    // Mark system cartridges as read-only
    stack.systemStack = stack.systemStack.map(entry => ({
      ...entry,
      cartridge: { ...entry.cartridge, _readOnly: true },
    }));

    logger.info('Tenant cartridge stack retrieved', { tenantId, userId });

    return respond(200, { stack });
  } catch (error) {
    logger.error('Failed to get tenant cartridge stack', { error });
    return respond(500, { error: 'Failed to get cartridge stack' });
  }
};

/**
 * POST /api/v1/tenant/cartridges/:id/activate
 * Activate a tenant cartridge
 */
export const activateTenantCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const cartridgeId = event.pathParameters?.id;

    if (!tenantId || !cartridgeId) {
      return respond(400, { error: 'Tenant ID and Cartridge ID required' });
    }

    // Verify ownership
    const existing = await cartridgeService.getCartridge(cartridgeId, tenantId);
    if (!existing) {
      return respond(404, { error: 'Cartridge not found' });
    }

    if (existing.scope === 'system') {
      return respond(403, { error: 'Cannot modify system cartridges' });
    }

    const cartridge = await cartridgeService.updateCartridge(
      cartridgeId,
      tenantId,
      userId,
      { status: 'active' as const }
    );

    logger.info('Tenant cartridge activated', { cartridgeId, tenantId });

    return respond(200, { cartridge });
  } catch (error) {
    logger.error('Failed to activate tenant cartridge', { error });
    return respond(500, { error: 'Failed to activate cartridge' });
  }
};

/**
 * POST /api/v1/tenant/cartridges/:id/deactivate
 * Deactivate a tenant cartridge
 */
export const deactivateTenantCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const cartridgeId = event.pathParameters?.id;

    if (!tenantId || !cartridgeId) {
      return respond(400, { error: 'Tenant ID and Cartridge ID required' });
    }

    // Verify ownership
    const existing = await cartridgeService.getCartridge(cartridgeId, tenantId);
    if (!existing) {
      return respond(404, { error: 'Cartridge not found' });
    }

    if (existing.scope === 'system') {
      return respond(403, { error: 'Cannot modify system cartridges' });
    }

    const cartridge = await cartridgeService.updateCartridge(
      cartridgeId,
      tenantId,
      userId,
      { status: 'ready' as const }
    );

    logger.info('Tenant cartridge deactivated', { cartridgeId, tenantId });

    return respond(200, { cartridge });
  } catch (error) {
    logger.error('Failed to deactivate tenant cartridge', { error });
    return respond(500, { error: 'Failed to deactivate cartridge' });
  }
};

/**
 * POST /api/v1/tenant/cartridges/export
 * Export tenant cartridges to .RADz file
 */
export const exportTenantCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(401, { error: 'Unauthorized - tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    
    // Force tenant scope for exports
    const result = await cartridgeService.exportCartridge(tenantId, userId, {
      scope: 'tenant',
      tenantId,
      domains: body.domains || [],
      includeLora: body.includeLora ?? false,
      includeCurator: body.includeCurator ?? false,
      includeGhost: body.includeGhost ?? false,
      includeDomainExperts: body.includeDomainExperts ?? false,
    });

    logger.info('Tenant cartridge exported', { cartridgeId: result.cartridgeId, tenantId });

    return respond(200, result);
  } catch (error) {
    logger.error('Failed to export tenant cartridge', { error });
    return respond(500, { error: 'Failed to export cartridge' });
  }
};

/**
 * POST /api/v1/tenant/cartridges/import
 * Import a .RADz file as tenant cartridge
 */
export const importTenantCartridge: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);

    if (!tenantId) {
      return respond(401, { error: 'Unauthorized - tenant ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    
    if (!body.fileKey) {
      return respond(400, { error: 'fileKey is required' });
    }

    // Force tenant scope for imports
    const result = await cartridgeService.importCartridge(tenantId, userId, {
      scope: 'tenant',
      tenantId,
      fileKey: body.fileKey,
      validateSignature: body.validateSignature ?? true,
      mergeStrategy: body.mergeStrategy ?? 'replace',
      activateImmediately: body.activateImmediately ?? false,
    });

    logger.info('Tenant cartridge imported', { cartridgeId: result.cartridgeId, tenantId });

    return respond(200, result);
  } catch (error) {
    logger.error('Failed to import tenant cartridge', { error });
    return respond(500, { error: 'Failed to import cartridge' });
  }
};
