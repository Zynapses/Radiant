// RADIANT v7.11.0 - Inference Response Cache Admin API
//
// Admin endpoints for managing the inference response cache.
// Provides dashboard data, configuration management, cache invalidation,
// and audit trail access.
//
// Base path: /api/admin/inference-cache
//
// Endpoints:
//   GET    /dashboard              - Full dashboard (config + metrics + events + top entries)
//   GET    /config                 - Get current configuration
//   PUT    /config                 - Update configuration
//   GET    /metrics                - Get cache performance metrics
//   GET    /events                 - Get recent cache events (audit log)
//   GET    /entries                - Get top cache entries by hit count
//   POST   /invalidate             - Invalidate a specific cache entry
//   POST   /invalidate-model       - Invalidate all entries for a model
//   POST   /purge                  - Purge all cache entries for tenant
//   POST   /expire                 - Run TTL expiration (cleanup stale entries)
//   GET    /stats                  - Quick summary statistics

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { inferenceCacheService } from '../shared/services/inference-cache.service';

/**
 * Extract tenant ID from the request context.
 * In production, this comes from the authenticated JWT token.
 */
function getTenantId(event: APIGatewayProxyEvent): string {
  return event.requestContext?.authorizer?.tenantId
    || event.headers?.['x-tenant-id']
    || '';
}

/**
 * Extract admin user ID from the request context.
 */
function getAdminUserId(event: APIGatewayProxyEvent): string {
  return event.requestContext?.authorizer?.userId
    || event.headers?.['x-user-id']
    || 'admin';
}

/**
 * Build a standard JSON response.
 */
function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Main Lambda handler for inference cache admin endpoints.
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  if (!tenantId) {
    return jsonResponse(401, { error: 'Missing tenant ID' });
  }

  const path = event.path.replace(/^\/api\/admin\/inference-cache/, '').replace(/\/$/, '') || '/';
  const method = event.httpMethod;

  try {
    // ========================================================================
    // GET /dashboard - Full dashboard data
    // Returns: config, metrics, recent events, top entries, model breakdown
    // ========================================================================
    if (method === 'GET' && path === '/dashboard') {
      const dashboard = await inferenceCacheService.getDashboard(tenantId);
      return jsonResponse(200, {
        success: true,
        data: dashboard,
      });
    }

    // ========================================================================
    // GET /config - Get current cache configuration
    // ========================================================================
    if (method === 'GET' && path === '/config') {
      const config = await inferenceCacheService.getConfig(tenantId);
      return jsonResponse(200, {
        success: true,
        data: config,
      });
    }

    // ========================================================================
    // PUT /config - Update cache configuration
    // Body: Partial<InferenceCacheConfig>
    // ========================================================================
    if (method === 'PUT' && path === '/config') {
      const body = JSON.parse(event.body || '{}');
      const adminUserId = getAdminUserId(event);
      const config = await inferenceCacheService.updateConfig(tenantId, body, adminUserId);
      return jsonResponse(200, {
        success: true,
        data: config,
        message: 'Cache configuration updated',
      });
    }

    // ========================================================================
    // GET /metrics - Get cache performance metrics
    // ========================================================================
    if (method === 'GET' && path === '/metrics') {
      const metrics = await inferenceCacheService.getMetrics(tenantId);
      return jsonResponse(200, {
        success: true,
        data: metrics,
      });
    }

    // ========================================================================
    // GET /events - Get recent cache events (audit log)
    // Query params: limit (default: 50)
    // ========================================================================
    if (method === 'GET' && path === '/events') {
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      const events = await inferenceCacheService.getRecentEvents(tenantId, limit);
      return jsonResponse(200, {
        success: true,
        data: events,
        count: events.length,
      });
    }

    // ========================================================================
    // POST /invalidate - Invalidate a specific cache entry
    // Body: { cacheKey: string, reason?: string }
    // ========================================================================
    if (method === 'POST' && path === '/invalidate') {
      const body = JSON.parse(event.body || '{}');
      if (!body.cacheKey) {
        return jsonResponse(400, { error: 'cacheKey is required' });
      }
      const success = await inferenceCacheService.invalidateEntry(
        tenantId,
        body.cacheKey,
        body.reason || 'manual_admin'
      );
      return jsonResponse(200, {
        success,
        message: success ? 'Cache entry invalidated' : 'Cache entry not found or already invalidated',
      });
    }

    // ========================================================================
    // POST /invalidate-model - Invalidate all entries for a model
    // Body: { modelId: string }
    // ========================================================================
    if (method === 'POST' && path === '/invalidate-model') {
      const body = JSON.parse(event.body || '{}');
      if (!body.modelId) {
        return jsonResponse(400, { error: 'modelId is required' });
      }
      const count = await inferenceCacheService.invalidateByModel(tenantId, body.modelId);
      return jsonResponse(200, {
        success: true,
        invalidatedCount: count,
        message: `Invalidated ${count} cache entries for model ${body.modelId}`,
      });
    }

    // ========================================================================
    // POST /purge - Purge ALL cache entries for tenant
    // Body: { confirm: true } (safety check)
    // ========================================================================
    if (method === 'POST' && path === '/purge') {
      const body = JSON.parse(event.body || '{}');
      if (!body.confirm) {
        return jsonResponse(400, {
          error: 'Confirmation required. Send { "confirm": true } to purge all cache entries.',
        });
      }
      const count = await inferenceCacheService.purgeForTenant(tenantId);
      return jsonResponse(200, {
        success: true,
        purgedCount: count,
        message: `Purged ${count} cache entries`,
      });
    }

    // ========================================================================
    // POST /expire - Run TTL expiration cleanup
    // ========================================================================
    if (method === 'POST' && path === '/expire') {
      const result = await inferenceCacheService.expireStaleEntries();
      return jsonResponse(200, {
        success: true,
        data: result,
        message: `Expired ${result.expiredCount} stale entries, freed ${(result.freedBytes / 1024).toFixed(1)}KB`,
      });
    }

    // ========================================================================
    // GET /stats - Quick summary statistics
    // ========================================================================
    if (method === 'GET' && path === '/stats') {
      const metrics = await inferenceCacheService.getMetrics(tenantId);
      return jsonResponse(200, {
        success: true,
        data: {
          enabled: (await inferenceCacheService.getConfig(tenantId)).enabled,
          hitRate: metrics.hitRate,
          totalCostSavedUsd: metrics.totalCostSavedUsd,
          projectedMonthlySavingsUsd: metrics.projectedMonthlySavingsUsd,
          activeEntries: metrics.activeEntries,
          totalRequests: metrics.totalRequests,
        },
      });
    }

    return jsonResponse(404, { error: `Unknown endpoint: ${method} ${path}` });
  } catch (error) {
    console.error('Inference cache admin error:', error);
    return jsonResponse(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
