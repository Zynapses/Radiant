/**
 * RADIANT v6.0.4 - Brain Admin API Handler
 * Admin endpoints for AGI Brain configuration and monitoring
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { executeStatement } from '../shared/db/client';
import { brainConfigService } from '../shared/services/brain-config.service';
import { ghostManagerService } from '../shared/services/ghost-manager.service';
import { dreamSchedulerService } from '../shared/services/dream-scheduler.service';
import { oversightService } from '../shared/services/oversight.service';
import { sofaiRouterService } from '../shared/services/sofai-router.service';
import { manualTriggerHandler } from '../brain/reconciliation';

// =============================================================================
// Response Helpers
// =============================================================================

function success(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: message }),
  };
}

// =============================================================================
// Main Handler
// =============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Dashboard
    if (path === '/api/admin/brain/dashboard' && method === 'GET') {
      return getDashboard(event);
    }

    // Configuration
    if (path === '/api/admin/brain/config' && method === 'GET') {
      return getConfig(event);
    }
    if (path === '/api/admin/brain/config' && method === 'PUT') {
      return updateConfig(event);
    }
    if (path.match(/^\/api\/admin\/brain\/config\/[^/]+$/) && method === 'GET') {
      return getConfigValue(event);
    }
    if (path.match(/^\/api\/admin\/brain\/config\/[^/]+$/) && method === 'PUT') {
      return setConfigValue(event);
    }
    if (path.match(/^\/api\/admin\/brain\/config\/[^/]+\/reset$/) && method === 'POST') {
      return resetConfigValue(event);
    }

    // Config history
    if (path === '/api/admin/brain/config/history' && method === 'GET') {
      return getConfigHistory(event);
    }

    // Ghost management
    if (path === '/api/admin/brain/ghost/stats' && method === 'GET') {
      return getGhostStats(event);
    }
    if (path.match(/^\/api\/admin\/brain\/ghost\/[^/]+\/health$/) && method === 'GET') {
      return getGhostHealth(event);
    }

    // Dream management
    if (path === '/api/admin/brain/dreams/queue' && method === 'GET') {
      return getDreamQueue(event);
    }
    if (path === '/api/admin/brain/dreams/schedules' && method === 'GET') {
      return getDreamSchedules(event);
    }
    if (path === '/api/admin/brain/dreams/trigger' && method === 'POST') {
      return triggerDream(event);
    }

    // Oversight queue
    if (path === '/api/admin/brain/oversight' && method === 'GET') {
      return getOversightQueue(event);
    }
    if (path === '/api/admin/brain/oversight/stats' && method === 'GET') {
      return getOversightStats(event);
    }
    if (path.match(/^\/api\/admin\/brain\/oversight\/[^/]+\/approve$/) && method === 'POST') {
      return approveOversight(event);
    }
    if (path.match(/^\/api\/admin\/brain\/oversight\/[^/]+\/reject$/) && method === 'POST') {
      return rejectOversight(event);
    }

    // SOFAI stats
    if (path === '/api/admin/brain/sofai/stats' && method === 'GET') {
      return getSofaiStats(event);
    }

    // ECD (Entity-Context Divergence) - Truth Engine™
    if (path.startsWith('/api/admin/brain/ecd')) {
      const { handler: ecdHandler } = await import('./ecd');
      return ecdHandler(event, {} as any, () => {});
    }

    // Reconciliation
    if (path === '/api/admin/brain/reconciliation/trigger' && method === 'POST') {
      return triggerReconciliation(event);
    }

    return error(404, `Not found: ${method} ${path}`);
  } catch (err) {
    logger.error('Brain admin error', { error: String(err) });
    return error(500, String(err));
  }
}

// =============================================================================
// Dashboard
// =============================================================================

async function getDashboard(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = _event.headers['X-Tenant-Id'] || _event.headers['x-tenant-id'];

  const [ghostStats, dreamQueue, oversightStats, sofaiStats] = await Promise.all([
    ghostManagerService.getStats(tenantId),
    dreamSchedulerService.getQueueStatus(),
    oversightService.getQueueStats(tenantId),
    tenantId ? sofaiRouterService.getStats(tenantId) : Promise.resolve(null),
  ]);

  return success({
    ghost: ghostStats,
    dreams: dreamQueue,
    oversight: oversightStats,
    sofai: sofaiStats,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// Configuration
// =============================================================================

async function getConfig(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const categories = await brainConfigService.getParametersByCategory();
  return success({ categories });
}

async function updateConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { updates, changedBy } = body;

  if (!updates || !Array.isArray(updates)) {
    return error(400, 'updates array is required');
  }

  const results = await brainConfigService.setMultiple(updates, changedBy || 'admin');
  return success({ results });
}

async function getConfigValue(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const key = event.pathParameters?.key || event.path.split('/').pop();
  if (!key) return error(400, 'key is required');

  const value = await brainConfigService.getValue(key as any);
  return success({ key, value });
}

async function setConfigValue(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const key = event.pathParameters?.key || event.path.split('/').slice(-1)[0];
  const body = JSON.parse(event.body || '{}');
  const { value, changedBy, reason } = body;

  if (!key) return error(400, 'key is required');
  if (value === undefined) return error(400, 'value is required');

  const result = await brainConfigService.setValue(key as any, value, changedBy || 'admin', reason);
  return success(result);
}

async function resetConfigValue(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const key = event.pathParameters?.key || event.path.split('/').slice(-2)[0];
  const body = JSON.parse(event.body || '{}');
  const { changedBy } = body;

  if (!key) return error(400, 'key is required');

  const result = await brainConfigService.resetToDefault(key as any, changedBy || 'admin');
  return success(result);
}

async function getConfigHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const key = event.queryStringParameters?.key;
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  const history = await brainConfigService.getHistory(key as any, limit);
  return success({ history });
}

// =============================================================================
// Ghost Management
// =============================================================================

async function getGhostStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const stats = await ghostManagerService.getStats(tenantId);
  return success(stats);
}

async function getGhostHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.pathParameters?.userId || event.path.split('/').slice(-2)[0];
  const tenantId = event.queryStringParameters?.tenantId;

  if (!userId || !tenantId) {
    return error(400, 'userId and tenantId are required');
  }

  const health = await ghostManagerService.healthCheck(userId, tenantId);
  return success(health);
}

// =============================================================================
// Dream Management
// =============================================================================

async function getDreamQueue(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const status = await dreamSchedulerService.getQueueStatus();
  return success(status);
}

async function getDreamSchedules(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  const schedules = await dreamSchedulerService.getTenantSchedules(limit);
  return success({ schedules });
}

async function triggerDream(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { tenantId } = body;

  if (!tenantId) {
    return error(400, 'tenantId is required');
  }

  const job = await dreamSchedulerService.triggerManualDream(tenantId);
  return success({ job });
}

// =============================================================================
// Oversight Queue
// =============================================================================

async function getOversightQueue(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  if (!tenantId) {
    return error(400, 'tenantId is required');
  }

  const items = await oversightService.getPendingItems(tenantId, limit);
  return success({ items });
}

async function getOversightStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const stats = await oversightService.getQueueStats(tenantId);
  return success(stats);
}

async function approveOversight(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const insightId = event.pathParameters?.insightId || event.path.split('/').slice(-2)[0];
  const body = JSON.parse(event.body || '{}');
  const { reviewerId, reasoning, attestation } = body;

  if (!insightId || !reviewerId || !reasoning || !attestation) {
    return error(400, 'insightId, reviewerId, reasoning, and attestation are required');
  }

  const decision = await oversightService.approve(insightId, reviewerId, reasoning, attestation);
  return success({ decision });
}

async function rejectOversight(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const insightId = event.pathParameters?.insightId || event.path.split('/').slice(-2)[0];
  const body = JSON.parse(event.body || '{}');
  const { reviewerId, reasoning, attestation } = body;

  if (!insightId || !reviewerId || !reasoning || !attestation) {
    return error(400, 'insightId, reviewerId, reasoning, and attestation are required');
  }

  const decision = await oversightService.reject(insightId, reviewerId, reasoning, attestation);
  return success({ decision });
}

// =============================================================================
// SOFAI Stats
// =============================================================================

async function getSofaiStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const days = parseInt(event.queryStringParameters?.days || '7', 10);

  if (!tenantId) {
    return error(400, 'tenantId is required');
  }

  const stats = await sofaiRouterService.getStats(tenantId, days);
  return success(stats);
}

// =============================================================================
// Reconciliation
// =============================================================================

async function triggerReconciliation(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const result = await manualTriggerHandler();
  return success(result);
}
