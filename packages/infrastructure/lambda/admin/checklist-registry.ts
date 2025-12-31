/**
 * RADIANT v4.18.0 - Compliance Checklist Registry Admin API
 * 
 * API endpoints for managing versioned compliance checklists linked to regulatory standards.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { getChecklistRegistryService } from '../shared/services/checklist-registry.service';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const checklistService = getChecklistRegistryService(pool);

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function success(data: any): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
}

function created(data: any): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
}

function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message })
  };
}

function notFound(message: string): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message })
  };
}

function serverError(error: Error): APIGatewayProxyResult {
  console.error('Server error:', error);
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Internal server error' })
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'] || 
                   event.headers['x-tenant-id'];
  const userId = event.requestContext.authorizer?.claims?.sub ||
                 event.headers['x-user-id'];
  const path = event.path.replace('/api/admin/compliance/checklists', '');
  const method = event.httpMethod;

  // Set tenant context for RLS
  if (tenantId) {
    await pool.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
  }

  try {
    // ========================================================================
    // DASHBOARD
    // ========================================================================
    
    if (path === '/dashboard' && method === 'GET') {
      if (!tenantId) return badRequest('Tenant ID required');
      const data = await checklistService.getDashboardData(tenantId);
      return success(data);
    }

    // ========================================================================
    // VERSIONS
    // ========================================================================

    // GET /versions?standardId=xxx - Get all versions for a standard
    if (path === '/versions' && method === 'GET') {
      const standardId = event.queryStringParameters?.standardId;
      if (!standardId) return badRequest('standardId required');
      const versions = await checklistService.getVersionsForStandard(standardId);
      return success({ versions });
    }

    // GET /versions/latest?standardCode=xxx - Get latest version for a standard
    if (path === '/versions/latest' && method === 'GET') {
      const standardCode = event.queryStringParameters?.standardCode;
      if (!standardCode) return badRequest('standardCode required');
      const version = await checklistService.getLatestVersion(standardCode);
      if (!version) return notFound('No active version found');
      return success(version);
    }

    // GET /versions/:id - Get specific version
    if (path.match(/^\/versions\/[a-f0-9-]+$/) && method === 'GET') {
      const versionId = path.split('/')[2];
      const version = await checklistService.getVersionById(versionId);
      if (!version) return notFound('Version not found');
      return success(version);
    }

    // POST /versions - Create new version
    if (path === '/versions' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.standardId || !body.version || !body.title) {
        return badRequest('standardId, version, and title required');
      }
      const version = await checklistService.createVersion({
        ...body,
        createdBy: userId
      });
      return created(version);
    }

    // POST /versions/:id/set-latest - Set as latest version
    if (path.match(/^\/versions\/[a-f0-9-]+\/set-latest$/) && method === 'POST') {
      const versionId = path.split('/')[2];
      await checklistService.setLatestVersion(versionId);
      return success({ success: true });
    }

    // ========================================================================
    // CATEGORIES
    // ========================================================================

    // GET /versions/:id/categories - Get categories for a version
    if (path.match(/^\/versions\/[a-f0-9-]+\/categories$/) && method === 'GET') {
      const versionId = path.split('/')[2];
      const categories = await checklistService.getCategoriesForVersion(versionId);
      return success({ categories });
    }

    // POST /versions/:id/categories - Create category
    if (path.match(/^\/versions\/[a-f0-9-]+\/categories$/) && method === 'POST') {
      const versionId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      if (!body.code || !body.name) {
        return badRequest('code and name required');
      }
      const category = await checklistService.createCategory({
        versionId,
        ...body
      });
      return created(category);
    }

    // ========================================================================
    // ITEMS
    // ========================================================================

    // GET /versions/:id/items - Get all items for a version
    if (path.match(/^\/versions\/[a-f0-9-]+\/items$/) && method === 'GET') {
      const versionId = path.split('/')[2];
      const items = await checklistService.getItemsForVersion(versionId, tenantId);
      return success({ items });
    }

    // GET /versions/:id/items/category/:code - Get items by category
    if (path.match(/^\/versions\/[a-f0-9-]+\/items\/category\/[a-z_]+$/) && method === 'GET') {
      const parts = path.split('/');
      const versionId = parts[2];
      const categoryCode = parts[5];
      const items = await checklistService.getItemsByCategory(versionId, categoryCode, tenantId);
      return success({ items });
    }

    // POST /versions/:id/items - Create item
    if (path.match(/^\/versions\/[a-f0-9-]+\/items$/) && method === 'POST') {
      const versionId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      if (!body.itemCode || !body.title) {
        return badRequest('itemCode and title required');
      }
      const item = await checklistService.createItem({
        versionId,
        ...body
      });
      return created(item);
    }

    // ========================================================================
    // TENANT CONFIGURATION
    // ========================================================================

    // GET /config - Get all tenant checklist configs
    if (path === '/config' && method === 'GET') {
      if (!tenantId) return badRequest('Tenant ID required');
      const configs = await checklistService.getAllTenantConfigs(tenantId);
      return success({ configs });
    }

    // GET /config/:standardId - Get tenant config for a standard
    if (path.match(/^\/config\/[a-f0-9-]+$/) && method === 'GET') {
      if (!tenantId) return badRequest('Tenant ID required');
      const standardId = path.split('/')[2];
      const config = await checklistService.getTenantConfig(tenantId, standardId);
      return success(config || { 
        standardId, 
        versionSelection: 'auto',
        autoUpdateEnabled: true,
        notificationOnUpdate: true
      });
    }

    // PUT /config/:standardId - Set tenant config for a standard
    if (path.match(/^\/config\/[a-f0-9-]+$/) && method === 'PUT') {
      if (!tenantId) return badRequest('Tenant ID required');
      const standardId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      if (!body.versionSelection) {
        return badRequest('versionSelection required');
      }
      const config = await checklistService.setTenantConfig(tenantId, standardId, body);
      return success(config);
    }

    // GET /config/:standardId/effective-version - Get effective version for tenant
    if (path.match(/^\/config\/[a-f0-9-]+\/effective-version$/) && method === 'GET') {
      if (!tenantId) return badRequest('Tenant ID required');
      const standardId = path.split('/')[2];
      const versionId = await checklistService.getEffectiveVersion(tenantId, standardId);
      if (!versionId) return notFound('No effective version');
      const version = await checklistService.getVersionById(versionId);
      return success(version);
    }

    // ========================================================================
    // PROGRESS
    // ========================================================================

    // GET /progress/:versionId - Get tenant progress for a version
    if (path.match(/^\/progress\/[a-f0-9-]+$/) && method === 'GET') {
      if (!tenantId) return badRequest('Tenant ID required');
      const versionId = path.split('/')[2];
      const progress = await checklistService.getTenantProgress(tenantId, versionId);
      return success(progress);
    }

    // PUT /progress/items/:itemId - Update item progress
    if (path.match(/^\/progress\/items\/[a-f0-9-]+$/) && method === 'PUT') {
      if (!tenantId) return badRequest('Tenant ID required');
      const itemId = path.split('/')[3];
      const body = JSON.parse(event.body || '{}');
      if (!body.status) {
        return badRequest('status required');
      }
      await checklistService.updateItemProgress(tenantId, itemId, {
        ...body,
        completedBy: userId
      });
      return success({ success: true });
    }

    // ========================================================================
    // AUDIT RUNS
    // ========================================================================

    // GET /audit-runs - Get audit run history
    if (path === '/audit-runs' && method === 'GET') {
      if (!tenantId) return badRequest('Tenant ID required');
      const limit = parseInt(event.queryStringParameters?.limit || '20');
      const runs = await checklistService.getAuditRunHistory(tenantId, limit);
      return success({ runs });
    }

    // POST /audit-runs - Start new audit run
    if (path === '/audit-runs' && method === 'POST') {
      if (!tenantId) return badRequest('Tenant ID required');
      const body = JSON.parse(event.body || '{}');
      if (!body.versionId || !body.runType) {
        return badRequest('versionId and runType required');
      }
      const run = await checklistService.startAuditRun(tenantId, body.versionId, {
        runType: body.runType,
        triggeredBy: userId,
        notes: body.notes
      });
      return created(run);
    }

    // PUT /audit-runs/:id/complete - Complete audit run
    if (path.match(/^\/audit-runs\/[a-f0-9-]+\/complete$/) && method === 'PUT') {
      const runId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      if (!body.status) {
        return badRequest('status required');
      }
      const run = await checklistService.completeAuditRun(runId, body);
      return success(run);
    }

    // ========================================================================
    // VERSION UPDATES (AUTO-UPDATE)
    // ========================================================================

    // GET /updates/pending - Get pending regulatory updates
    if (path === '/updates/pending' && method === 'GET') {
      const updates = await checklistService.getPendingUpdates();
      return success({ updates });
    }

    // POST /updates - Record a version update
    if (path === '/updates' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.standardId || !body.newVersion || !body.changeType) {
        return badRequest('standardId, newVersion, and changeType required');
      }
      const update = await checklistService.recordVersionUpdate({
        ...body,
        source: body.source || 'manual'
      });
      return created(update);
    }

    // PUT /updates/:id/process - Process a version update
    if (path.match(/^\/updates\/[a-f0-9-]+\/process$/) && method === 'PUT') {
      const updateId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      if (!body.status) {
        return badRequest('status required');
      }
      await checklistService.processVersionUpdate(updateId, body);
      return success({ success: true });
    }

    // POST /updates/check/:standardId - Check for updates from sources
    if (path.match(/^\/updates\/check\/[a-f0-9-]+$/) && method === 'POST') {
      const standardId = path.split('/')[3];
      const updates = await checklistService.checkForUpdates(standardId);
      return success({ updates, checked: true });
    }

    // ========================================================================
    // 404
    // ========================================================================

    return notFound(`Unknown endpoint: ${method} ${path}`);

  } catch (error) {
    return serverError(error as Error);
  }
}
