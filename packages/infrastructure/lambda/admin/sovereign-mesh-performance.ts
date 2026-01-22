/**
 * RADIANT v5.38.0 - Sovereign Mesh Performance Admin API
 * 
 * Endpoints for managing Sovereign Mesh performance configuration,
 * viewing dashboard metrics, and handling performance alerts.
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { performanceConfigService } from '../shared/services/sovereign-mesh/performance-config.service';
import { redisCacheService } from '../shared/services/sovereign-mesh/redis-cache.service';
import { sqsDispatcherService } from '../shared/services/sovereign-mesh/sqs-dispatcher.service';
import { enhancedLogger } from '../shared/logging/enhanced-logger';

const logger = enhancedLogger;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

function getTenantId(event: { headers?: Record<string, string | undefined> }): string {
  return event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'] || '';
}

function getUserId(event: { requestContext?: { authorizer?: { claims?: { sub?: string } } } }): string | undefined {
  return event.requestContext?.authorizer?.claims?.sub;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const { httpMethod, path, pathParameters, body } = event;
  const tenantId = getTenantId(event);
  const userId = getUserId(event);

  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  if (!tenantId) {
    return response(400, { error: 'Missing tenant ID' });
  }

  try {
    // Route handling
    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[pathParts.length - 1];
    const subResource = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

    // GET /api/admin/sovereign-mesh/performance/dashboard
    if (httpMethod === 'GET' && resource === 'dashboard') {
      const dashboard = await performanceConfigService.getDashboard(tenantId);
      return response(200, dashboard);
    }

    // GET /api/admin/sovereign-mesh/performance/config
    if (httpMethod === 'GET' && resource === 'config') {
      const config = await performanceConfigService.getOrCreateConfig(tenantId);
      return response(200, { config });
    }

    // PUT /api/admin/sovereign-mesh/performance/config
    if (httpMethod === 'PUT' && resource === 'config') {
      const updates = body ? JSON.parse(body) : {};
      const result = await performanceConfigService.updateConfig(tenantId, updates, userId);
      return response(200, result);
    }

    // PATCH /api/admin/sovereign-mesh/performance/config
    if (httpMethod === 'PATCH' && resource === 'config') {
      const updates = body ? JSON.parse(body) : {};
      const result = await performanceConfigService.updateConfig(tenantId, updates, userId);
      return response(200, result);
    }

    // GET /api/admin/sovereign-mesh/performance/recommendations
    if (httpMethod === 'GET' && resource === 'recommendations') {
      const recommendations = await performanceConfigService.getRecommendations(tenantId);
      return response(200, recommendations);
    }

    // POST /api/admin/sovereign-mesh/performance/recommendations/:id/apply
    if (httpMethod === 'POST' && subResource === 'recommendations' && path.endsWith('/apply')) {
      const recommendationId = pathParameters?.id || pathParts[pathParts.length - 2];
      const result = await performanceConfigService.applyRecommendation(tenantId, recommendationId, userId);
      return response(result.success ? 200 : 400, result);
    }

    // GET /api/admin/sovereign-mesh/performance/alerts
    if (httpMethod === 'GET' && resource === 'alerts') {
      const alerts = await performanceConfigService.getActiveAlerts(tenantId);
      return response(200, { alerts });
    }

    // POST /api/admin/sovereign-mesh/performance/alerts/:id/acknowledge
    if (httpMethod === 'POST' && path.includes('/alerts/') && path.endsWith('/acknowledge')) {
      const alertId = pathParameters?.id || pathParts[pathParts.length - 2];
      if (!userId) {
        return response(401, { error: 'User ID required for acknowledgment' });
      }
      const success = await performanceConfigService.acknowledgeAlert(alertId, tenantId, userId);
      return response(success ? 200 : 400, { success });
    }

    // POST /api/admin/sovereign-mesh/performance/alerts/:id/resolve
    if (httpMethod === 'POST' && path.includes('/alerts/') && path.endsWith('/resolve')) {
      const alertId = pathParameters?.id || pathParts[pathParts.length - 2];
      const success = await performanceConfigService.resolveAlert(alertId, tenantId, userId);
      return response(success ? 200 : 400, { success });
    }

    // GET /api/admin/sovereign-mesh/performance/cache/stats
    if (httpMethod === 'GET' && resource === 'stats' && path.includes('/cache/')) {
      const stats = redisCacheService.getStats();
      const health = await redisCacheService.healthCheck();
      return response(200, { stats, health });
    }

    // DELETE /api/admin/sovereign-mesh/performance/cache
    if (httpMethod === 'DELETE' && resource === 'cache') {
      await redisCacheService.clearTenantCache(tenantId);
      return response(200, { success: true, message: 'Cache cleared for tenant' });
    }

    // DELETE /api/admin/sovereign-mesh/performance/cache/all
    if (httpMethod === 'DELETE' && resource === 'all' && path.includes('/cache/')) {
      await redisCacheService.clearAll();
      return response(200, { success: true, message: 'All cache cleared' });
    }

    // GET /api/admin/sovereign-mesh/performance/queue/metrics
    if (httpMethod === 'GET' && resource === 'metrics' && path.includes('/queue/')) {
      const metrics = await sqsDispatcherService.getQueueMetrics();
      return response(200, { metrics });
    }

    // GET /api/admin/sovereign-mesh/performance/health
    if (httpMethod === 'GET' && resource === 'health') {
      const cacheHealth = await redisCacheService.healthCheck();
      const queueMetrics = await sqsDispatcherService.getQueueMetrics();
      
      const isHealthy = cacheHealth.healthy && queueMetrics.approximateMessages < 1000;
      
      return response(200, {
        status: isHealthy ? 'healthy' : 'degraded',
        cache: cacheHealth,
        queue: {
          healthy: queueMetrics.approximateMessages < 1000,
          ...queueMetrics,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Not found
    return response(404, { error: 'Not found', path });

  } catch (error: any) {
    logger.error('Sovereign Mesh Performance API error', { error: error.message, path });
    return response(500, { error: error.message });
  }
};
