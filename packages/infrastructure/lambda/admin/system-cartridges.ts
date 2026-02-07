/**
 * RADIANT Admin API: System Cartridge Registry
 * v6.1.0: Domain experts as system cartridges with full audit trail
 * 
 * Base path: /api/admin/system-cartridges
 * 
 * Endpoints:
 * - GET    /dashboard          - Get system cartridge dashboard
 * - GET    /                   - List system cartridges
 * - GET    /:id                - Get a system cartridge
 * - POST   /                   - Register a system cartridge (super admin only)
 * - PUT    /:id                - Update a system cartridge (super admin only)
 * - DELETE /:id                - Delete a system cartridge (super admin only)
 * - POST   /:id/upgrade        - Upgrade system cartridge to new version
 * - GET    /:id/audit          - Get audit log for cartridge
 * - GET    /audit              - Get recent audit log (all cartridges)
 * 
 * Tenant Admin Endpoints:
 * - GET    /tenant/visibility  - Get visibility status for tenant
 * - PUT    /tenant/visibility  - Update visibility for a cartridge
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { systemCartridgeRegistryService } from '../shared/services/system-cartridge-registry.service';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/system-cartridges',
  category: 'audit',
  sourceType: 'lambda',
});
import type {
  RegisterSystemCartridgeRequest,
  UpdateTenantVisibilityRequest,
  ListSystemCartridgesRequest,
  CartridgeCategory,
  CartridgeThermalState,
} from '@radiant/shared';

// =============================================================================
// Types
// =============================================================================

interface AuthContext {
  userId: string;
  email?: string;
  tenantId: string;
  isSuperAdmin: boolean;
}

// =============================================================================
// Main Handler
// =============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path.replace('/api/admin/system-cartridges', '');

  try {
    // Extract auth context from request
    const authContext = extractAuthContext(event);
    if (!authContext) {
      return response(401, { error: 'Unauthorized' });
    }

    // Build audit context
    const auditContext = {
      userId: authContext.userId,
      userEmail: authContext.email,
      ipAddress: event.requestContext.identity?.sourceIp,
      userAgent: event.headers['User-Agent'] || event.headers['user-agent'],
    };

    // Route request
    // Dashboard
    if (method === 'GET' && path === '/dashboard') {
      return await getDashboard(authContext);
    }

    // Audit log (all cartridges)
    if (method === 'GET' && path === '/audit') {
      return await getRecentAuditLog(authContext);
    }

    // Tenant visibility endpoints
    if (path.startsWith('/tenant/visibility')) {
      if (method === 'GET') {
        return await getTenantVisibility(authContext);
      }
      if (method === 'PUT') {
        return await updateTenantVisibility(event, authContext, auditContext);
      }
    }

    // List system cartridges
    if (method === 'GET' && (path === '' || path === '/')) {
      return await listSystemCartridges(event, authContext);
    }

    // Single cartridge operations
    const cartridgeIdMatch = path.match(/^\/([a-f0-9-]{36})(\/.*)?$/);
    if (cartridgeIdMatch) {
      const cartridgeId = cartridgeIdMatch[1];
      const subPath = cartridgeIdMatch[2] || '';

      if (method === 'GET' && subPath === '') {
        return await getSystemCartridge(cartridgeId, authContext);
      }

      if (method === 'GET' && subPath === '/audit') {
        return await getCartridgeAuditLog(cartridgeId, authContext);
      }

      // Super admin only operations
      if (!authContext.isSuperAdmin) {
        return response(403, { error: 'Super admin access required' });
      }

      if (method === 'PUT' && subPath === '') {
        return await updateSystemCartridge(cartridgeId, event, auditContext);
      }

      if (method === 'DELETE' && subPath === '') {
        return await deleteSystemCartridge(cartridgeId, event, auditContext);
      }

      if (method === 'POST' && subPath === '/upgrade') {
        return await upgradeSystemCartridge(cartridgeId, event, auditContext);
      }
    }

    // Register new system cartridge (super admin only)
    if (method === 'POST' && (path === '' || path === '/')) {
      if (!authContext.isSuperAdmin) {
        return response(403, { error: 'Super admin access required' });
      }
      return await registerSystemCartridge(event, auditContext);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    logger.error('System cartridge API error', { error, path, method });
    return response(500, { error: 'Internal server error' });
  }
}

// =============================================================================
// Dashboard
// =============================================================================

async function getDashboard(auth: AuthContext): Promise<APIGatewayProxyResult> {
  // All admins can view dashboard
  const dashboard = await systemCartridgeRegistryService.getDashboard();
  return response(200, dashboard);
}

// =============================================================================
// List & Get
// =============================================================================

async function listSystemCartridges(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const query = event.queryStringParameters || {};

  const request: ListSystemCartridgesRequest = {
    category: query.category as CartridgeCategory | undefined,
    thermalState: query.thermalState as CartridgeThermalState | undefined,
    domainId: query.domainId,
    includeAuditHistory: query.includeAuditHistory === 'true',
    limit: query.limit ? parseInt(query.limit, 10) : undefined,
    offset: query.offset ? parseInt(query.offset, 10) : undefined,
  };

  const result = await systemCartridgeRegistryService.listSystemCartridges(request);
  return response(200, result);
}

async function getSystemCartridge(
  cartridgeId: string,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const cartridge = await systemCartridgeRegistryService.getSystemCartridge(cartridgeId);
  
  if (!cartridge) {
    return response(404, { error: 'System cartridge not found' });
  }

  return response(200, cartridge);
}

// =============================================================================
// Registration (Super Admin Only)
// =============================================================================

async function registerSystemCartridge(
  event: APIGatewayProxyEvent,
  auditContext: { userId: string; userEmail?: string; ipAddress?: string; userAgent?: string }
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  const request: RegisterSystemCartridgeRequest = {
    fileKey: body.fileKey,
    name: body.name,
    description: body.description,
    domainId: body.domainId,
    category: body.category || 'general',
    registeredVia: body.registeredVia || 'curator',
    reason: body.reason,
  };

  // Validate required fields
  if (request.category === 'domain_expert' && !request.domainId) {
    return response(400, { error: 'domainId is required for domain_expert category' });
  }

  if (request.registeredVia === 'radz_import' && !request.fileKey) {
    return response(400, { error: 'fileKey is required for RADz import' });
  }

  const cartridge = await systemCartridgeRegistryService.registerSystemCartridge(
    request,
    { ...auditContext, reason: request.reason }
  );

  return response(201, cartridge);
}

// =============================================================================
// Update (Super Admin Only)
// =============================================================================

async function updateSystemCartridge(
  cartridgeId: string,
  event: APIGatewayProxyEvent,
  auditContext: { userId: string; userEmail?: string; ipAddress?: string; userAgent?: string }
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  const updates: { name?: string; description?: string; complianceNotes?: string } = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.complianceNotes !== undefined) updates.complianceNotes = body.complianceNotes;

  const cartridge = await systemCartridgeRegistryService.updateSystemCartridge(
    cartridgeId,
    updates,
    { ...auditContext, reason: body.reason }
  );

  return response(200, cartridge);
}

// =============================================================================
// Delete (Super Admin Only)
// =============================================================================

async function deleteSystemCartridge(
  cartridgeId: string,
  event: APIGatewayProxyEvent,
  auditContext: { userId: string; userEmail?: string; ipAddress?: string; userAgent?: string }
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  await systemCartridgeRegistryService.deleteSystemCartridge(
    cartridgeId,
    { ...auditContext, reason: body.reason }
  );

  return response(204, null);
}

// =============================================================================
// Upgrade (Super Admin Only)
// =============================================================================

async function upgradeSystemCartridge(
  cartridgeId: string,
  event: APIGatewayProxyEvent,
  auditContext: { userId: string; userEmail?: string; ipAddress?: string; userAgent?: string }
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  if (!body.fileKey) {
    return response(400, { error: 'fileKey is required for upgrade' });
  }

  const cartridge = await systemCartridgeRegistryService.upgradeSystemCartridge(
    cartridgeId,
    body.fileKey,
    { ...auditContext, reason: body.reason }
  );

  return response(200, cartridge);
}

// =============================================================================
// Tenant Visibility
// =============================================================================

async function getTenantVisibility(auth: AuthContext): Promise<APIGatewayProxyResult> {
  const visibility = await systemCartridgeRegistryService.getTenantVisibility(auth.tenantId);
  return response(200, { visibility });
}

async function updateTenantVisibility(
  event: APIGatewayProxyEvent,
  auth: AuthContext,
  auditContext: { userId: string; userEmail?: string; ipAddress?: string; userAgent?: string }
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  if (!body.cartridgeId) {
    return response(400, { error: 'cartridgeId is required' });
  }

  if (typeof body.isVisible !== 'boolean') {
    return response(400, { error: 'isVisible must be a boolean' });
  }

  const request: UpdateTenantVisibilityRequest = {
    cartridgeId: body.cartridgeId,
    isVisible: body.isVisible,
    reason: body.reason,
  };

  const visibility = await systemCartridgeRegistryService.updateTenantVisibility(
    auth.tenantId,
    request,
    { ...auditContext, reason: request.reason }
  );

  return response(200, visibility);
}

// =============================================================================
// Audit Log
// =============================================================================

async function getRecentAuditLog(auth: AuthContext): Promise<APIGatewayProxyResult> {
  const auditLog = await systemCartridgeRegistryService.getRecentAuditLog(100);
  return response(200, { auditLog });
}

async function getCartridgeAuditLog(
  cartridgeId: string,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const auditLog = await systemCartridgeRegistryService.getAuditLogForCartridge(cartridgeId);
  return response(200, { auditLog });
}

// =============================================================================
// Helpers
// =============================================================================

function extractAuthContext(event: APIGatewayProxyEvent): AuthContext | null {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) return null;

  return {
    userId: authorizer.userId || authorizer.sub || '',
    email: authorizer.email,
    tenantId: authorizer.tenantId || '',
    isSuperAdmin: authorizer.isSuperAdmin === 'true' || authorizer.role === 'super_admin',
  };
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: body ? JSON.stringify(body) : '',
  };
}
