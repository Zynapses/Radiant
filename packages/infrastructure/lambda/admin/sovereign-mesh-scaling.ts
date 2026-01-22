/**
 * RADIANT v5.38.0 - Sovereign Mesh Scaling Admin API
 * 
 * Comprehensive API for infrastructure scaling management,
 * session monitoring, cost estimation, and capacity planning.
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { scalingService } from '../shared/services/sovereign-mesh/scaling.service';
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

function getUserId(event: any): string | undefined {
  return event.requestContext?.authorizer?.claims?.sub;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const { httpMethod, path, pathParameters, body } = event;
  const tenantId = getTenantId(event);
  const userId = getUserId(event);

  if (httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  if (!tenantId) {
    return response(400, { error: 'Missing tenant ID' });
  }

  try {
    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[pathParts.length - 1];
    const subResource = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

    // ========================================================================
    // DASHBOARD
    // ========================================================================

    // GET /api/admin/sovereign-mesh/scaling/dashboard
    if (httpMethod === 'GET' && resource === 'dashboard') {
      const dashboard = await scalingService.getDashboard(tenantId);
      return response(200, dashboard);
    }

    // ========================================================================
    // PROFILES
    // ========================================================================

    // GET /api/admin/sovereign-mesh/scaling/profiles
    if (httpMethod === 'GET' && resource === 'profiles') {
      const profiles = await scalingService.getProfiles(tenantId);
      return response(200, { profiles });
    }

    // GET /api/admin/sovereign-mesh/scaling/profiles/active
    if (httpMethod === 'GET' && resource === 'active' && subResource === 'profiles') {
      const profile = await scalingService.getActiveProfile(tenantId);
      return response(200, { profile });
    }

    // POST /api/admin/sovereign-mesh/scaling/profiles
    if (httpMethod === 'POST' && resource === 'profiles') {
      const data = body ? JSON.parse(body) : {};
      const profile = await scalingService.createProfile(tenantId, data.tier || 'production', data.name);
      return response(201, { profile });
    }

    // PUT /api/admin/sovereign-mesh/scaling/profiles/:id
    if (httpMethod === 'PUT' && subResource === 'profiles') {
      const profileId = pathParameters?.id || resource;
      const updates = body ? JSON.parse(body) : {};
      const profile = await scalingService.updateProfile(tenantId, profileId, updates, userId);
      return response(200, { profile });
    }

    // POST /api/admin/sovereign-mesh/scaling/profiles/:id/apply
    if (httpMethod === 'POST' && path.endsWith('/apply')) {
      const profileId = pathParameters?.id || pathParts[pathParts.length - 2];
      const options = body ? JSON.parse(body) : {};
      const result = await scalingService.applyProfile(tenantId, profileId, userId || 'system', options);
      return response(result.success ? 200 : 400, result);
    }

    // ========================================================================
    // SESSIONS
    // ========================================================================

    // GET /api/admin/sovereign-mesh/scaling/sessions
    if (httpMethod === 'GET' && resource === 'sessions') {
      const metrics = await scalingService.getSessionMetrics(tenantId);
      return response(200, { metrics });
    }

    // GET /api/admin/sovereign-mesh/scaling/sessions/capacity
    if (httpMethod === 'GET' && resource === 'capacity') {
      const capacity = await scalingService.getSessionCapacity(tenantId);
      return response(200, { capacity });
    }

    // GET /api/admin/sovereign-mesh/scaling/sessions/trends
    if (httpMethod === 'GET' && resource === 'trends') {
      const hours = parseInt(event.queryStringParameters?.hours || '24', 10);
      const trends = await scalingService.getSessionTrends(tenantId, hours);
      return response(200, { trends });
    }

    // ========================================================================
    // COST ESTIMATION
    // ========================================================================

    // GET /api/admin/sovereign-mesh/scaling/cost
    if (httpMethod === 'GET' && resource === 'cost') {
      const profile = await scalingService.getActiveProfile(tenantId);
      const estimate = await scalingService.estimateCost(tenantId, profile);
      return response(200, { estimate });
    }

    // POST /api/admin/sovereign-mesh/scaling/cost/estimate
    if (httpMethod === 'POST' && resource === 'estimate') {
      const data = body ? JSON.parse(body) : {};
      // Create a temporary profile for estimation
      const profile = await scalingService.getActiveProfile(tenantId);
      // Apply custom config if provided
      if (data.customConfig) {
        Object.assign(profile.lambda, data.customConfig.lambda || {});
        Object.assign(profile.aurora, data.customConfig.aurora || {});
        Object.assign(profile.redis, data.customConfig.redis || {});
        Object.assign(profile.apiGateway, data.customConfig.apiGateway || {});
        Object.assign(profile.sqs, data.customConfig.sqs || {});
      }
      if (data.targetSessions) {
        profile.targetSessions = data.targetSessions;
      }
      const estimate = await scalingService.estimateCost(tenantId, profile);
      return response(200, { estimate });
    }

    // ========================================================================
    // OPERATIONS
    // ========================================================================

    // GET /api/admin/sovereign-mesh/scaling/operations
    if (httpMethod === 'GET' && resource === 'operations') {
      const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
      const operations = await scalingService.getRecentOperations(tenantId, limit);
      return response(200, { operations });
    }

    // ========================================================================
    // ALERTS
    // ========================================================================

    // GET /api/admin/sovereign-mesh/scaling/alerts
    if (httpMethod === 'GET' && resource === 'alerts') {
      const alerts = await scalingService.getActiveAlerts(tenantId);
      return response(200, { alerts });
    }

    // ========================================================================
    // HEALTH
    // ========================================================================

    // GET /api/admin/sovereign-mesh/scaling/health
    if (httpMethod === 'GET' && resource === 'health') {
      const health = await scalingService.getComponentHealth(tenantId);
      return response(200, { health });
    }

    // ========================================================================
    // PRESETS
    // ========================================================================

    // GET /api/admin/sovereign-mesh/scaling/presets
    if (httpMethod === 'GET' && resource === 'presets') {
      const presets = [
        { tier: 'development', name: 'Development', targetSessions: 100, description: 'Scale-to-zero, minimal cost', monthlyCost: 70 },
        { tier: 'staging', name: 'Staging', targetSessions: 1000, description: 'Low-cost with basic redundancy', monthlyCost: 500 },
        { tier: 'production', name: 'Production', targetSessions: 10000, description: 'Production-ready high availability', monthlyCost: 5000 },
        { tier: 'enterprise', name: 'Enterprise (500K)', targetSessions: 500000, description: 'Multi-region global scale', monthlyCost: 68500 },
      ];
      return response(200, { presets });
    }

    // POST /api/admin/sovereign-mesh/scaling/presets/:tier/apply
    if (httpMethod === 'POST' && subResource === 'presets' && path.endsWith('/apply')) {
      const tier = pathParameters?.tier || pathParts[pathParts.length - 2];
      const profile = await scalingService.createProfile(tenantId, tier as any);
      const result = await scalingService.applyProfile(tenantId, profile.id, userId || 'system');
      return response(result.success ? 200 : 400, { profile, operation: result });
    }

    return response(404, { error: 'Not found', path });

  } catch (error: any) {
    logger.error('Sovereign Mesh Scaling API error', { error: error.message, path });
    return response(500, { error: error.message });
  }
};
