// RADIANT v5.2.4 - Model Registry Admin API
// Handles model versions, discovery, watchlist, and deletion queue

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { huggingfaceDiscoveryService } from '../shared/services/huggingface-discovery.service';
import { modelVersionManagerService } from '../shared/services/model-version-manager.service';
import { modelDeletionQueueService } from '../shared/services/model-deletion-queue.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Main Handler
// ============================================================================

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path.replace('/api/admin/model-registry', '');
  const method = event.httpMethod;

  try {
    // Model Versions
    if (path === '/versions' && method === 'GET') return await listVersions(event);
    if (path === '/versions' && method === 'POST') return await createVersion(event);
    if (path.match(/^\/versions\/[^/]+$/) && method === 'GET') return await getVersion(event);
    if (path.match(/^\/versions\/[^/]+$/) && method === 'PATCH') return await updateVersion(event);
    if (path.match(/^\/versions\/[^/]+\/thermal$/) && method === 'POST') return await setThermalState(event);
    if (path === '/versions/thermal/bulk' && method === 'POST') return await bulkSetThermalState(event);
    if (path.match(/^\/versions\/[^/]+\/storage$/) && method === 'GET') return await getStorageInfo(event);

    // Dashboard
    if (path === '/dashboard' && method === 'GET') return await getDashboard(event);

    // Discovery
    if (path === '/discovery/run' && method === 'POST') return await runDiscovery(event);
    if (path === '/discovery/jobs' && method === 'GET') return await listDiscoveryJobs(event);
    if (path.match(/^\/discovery\/jobs\/[^/]+$/) && method === 'GET') return await getDiscoveryJob(event);

    // Watchlist
    if (path === '/watchlist' && method === 'GET') return await listWatchlist(event);
    if (path === '/watchlist' && method === 'POST') return await addToWatchlist(event);
    if (path.match(/^\/watchlist\/[^/]+$/) && method === 'PATCH') return await updateWatchlistItem(event);
    if (path.match(/^\/watchlist\/[^/]+$/) && method === 'DELETE') return await removeFromWatchlist(event);

    // Deletion Queue
    if (path === '/deletion-queue' && method === 'GET') return await listDeletionQueue(event);
    if (path === '/deletion-queue' && method === 'POST') return await queueForDeletion(event);
    if (path === '/deletion-queue/dashboard' && method === 'GET') return await getDeletionDashboard(event);
    if (path.match(/^\/deletion-queue\/[^/]+$/) && method === 'GET') return await getQueueItem(event);
    if (path.match(/^\/deletion-queue\/[^/]+\/cancel$/) && method === 'POST') return await cancelDeletion(event);
    if (path.match(/^\/deletion-queue\/[^/]+\/priority$/) && method === 'PATCH') return await updatePriority(event);
    if (path === '/deletion-queue/process' && method === 'POST') return await processNextDeletion(event);
    if (path === '/deletion-queue/refresh-blocked' && method === 'POST') return await refreshBlocked(event);

    // Usage Sessions
    if (path.match(/^\/versions\/[^/]+\/sessions$/) && method === 'GET') return await getActiveSessions(event);

    return response(404, { error: 'Not found' });
  } catch (error) {
    logger.error('Model registry API error', { error, path, method });
    return response(500, { error: String(error) });
  }
};

// ============================================================================
// Model Version Endpoints
// ============================================================================

async function listVersions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const result = await modelVersionManagerService.listModelVersions({
    family: params.family,
    thermalState: params.thermalState as any,
    downloadStatus: params.downloadStatus as any,
    deploymentStatus: params.deploymentStatus as any,
    isActive: params.isActive ? params.isActive === 'true' : undefined,
    limit: params.limit ? parseInt(params.limit) : 50,
    offset: params.offset ? parseInt(params.offset) : 0,
  });
  return response(200, result);
}

async function getVersion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id || event.path.split('/').pop()!;
  const version = await modelVersionManagerService.getModelVersion(id);
  if (!version) return response(404, { error: 'Model version not found' });
  return response(200, version);
}

async function createVersion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const version = await modelVersionManagerService.createModelVersion({
    modelId: body.modelId,
    family: body.family,
    version: body.version,
    huggingfaceId: body.huggingfaceId,
    displayName: body.displayName,
    description: body.description,
    parameterCount: body.parameterCount,
    capabilities: body.capabilities,
    instanceType: body.instanceType,
    thermalState: body.thermalState,
  });
  return response(201, version);
}

async function updateVersion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id || event.path.split('/').pop()!;
  const body = JSON.parse(event.body || '{}');
  const version = await modelVersionManagerService.updateModelVersion(id, body);
  return response(200, version);
}

async function setThermalState(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParts = event.path.split('/');
  const id = pathParts[pathParts.length - 2];
  const body = JSON.parse(event.body || '{}');
  const result = await modelVersionManagerService.setThermalState(
    id,
    body.thermalState,
    body.warmDurationMinutes
  );
  return response(200, result);
}

async function bulkSetThermalState(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const count = await modelVersionManagerService.bulkSetThermalState(body.ids, body.thermalState);
  return response(200, { updated: count });
}

async function getStorageInfo(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParts = event.path.split('/');
  const id = pathParts[pathParts.length - 2];
  const info = await modelVersionManagerService.getStorageInfo(id);
  if (!info) return response(404, { error: 'Storage info not found' });
  return response(200, info);
}

// ============================================================================
// Dashboard Endpoint
// ============================================================================

async function getDashboard(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const dashboard = await modelVersionManagerService.getDashboard();
  return response(200, dashboard);
}

// ============================================================================
// Discovery Endpoints
// ============================================================================

async function runDiscovery(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = event.requestContext?.authorizer?.claims?.sub;
  
  const job = await huggingfaceDiscoveryService.runDiscovery(userId, body.families);
  
  return response(200, job);
}

async function listDiscoveryJobs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const limit = params.limit ? parseInt(params.limit) : 20;
  const jobs = await huggingfaceDiscoveryService.getRecentDiscoveryJobs(limit);
  return response(200, { jobs, total: jobs.length });
}

async function getDiscoveryJob(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id || event.path.split('/').pop()!;
  const job = await huggingfaceDiscoveryService.getDiscoveryJob(id);
  if (!job) return response(404, { error: 'Discovery job not found' });
  return response(200, job);
}

// ============================================================================
// Watchlist Endpoints
// ============================================================================

async function listWatchlist(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const watchlist = await huggingfaceDiscoveryService.getWatchlist();
  return response(200, { items: watchlist });
}

async function addToWatchlist(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const item = await huggingfaceDiscoveryService.addWatchlistFamily(
    body.family,
    body.huggingfaceOrg,
    body.isEnabled ?? true
  );
  return response(201, item);
}

async function updateWatchlistItem(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const family = event.pathParameters?.id || event.path.split('/').pop()!;
  const body = JSON.parse(event.body || '{}');
  const item = await huggingfaceDiscoveryService.updateWatchlistItem(family, body);
  return response(200, item);
}

async function removeFromWatchlist(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const family = event.pathParameters?.id || event.path.split('/').pop()!;
  await huggingfaceDiscoveryService.removeWatchlistFamily(family);
  return response(204, null);
}

// ============================================================================
// Deletion Queue Endpoints
// ============================================================================

async function listDeletionQueue(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const result = await modelDeletionQueueService.listQueueItems({
    status: params.status as any,
    family: params.family,
    limit: params.limit ? parseInt(params.limit) : 50,
    offset: params.offset ? parseInt(params.offset) : 0,
  });
  return response(200, result);
}

async function queueForDeletion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = event.requestContext?.authorizer?.claims?.sub;
  
  const item = await modelDeletionQueueService.queueModelForDeletion({
    modelVersionId: body.modelVersionId,
    requestedBy: userId || body.requestedBy,
    reason: body.reason,
    priority: body.priority,
    deleteS3Data: body.deleteS3Data,
  });
  
  return response(201, item);
}

async function getDeletionDashboard(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const dashboard = await modelDeletionQueueService.getDashboard();
  return response(200, dashboard);
}

async function getQueueItem(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id || event.path.split('/').pop()!;
  const item = await modelDeletionQueueService.getQueueItem(id);
  if (!item) return response(404, { error: 'Queue item not found' });
  return response(200, item);
}

async function cancelDeletion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParts = event.path.split('/');
  const id = pathParts[pathParts.length - 2];
  const userId = event.requestContext?.authorizer?.claims?.sub;
  const item = await modelDeletionQueueService.cancelDeletion(id, userId);
  return response(200, item);
}

async function updatePriority(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParts = event.path.split('/');
  const id = pathParts[pathParts.length - 2];
  const body = JSON.parse(event.body || '{}');
  const item = await modelDeletionQueueService.updatePriority(id, body.priority);
  return response(200, item);
}

async function processNextDeletion(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const item = await modelDeletionQueueService.processNextInQueue();
  if (!item) return response(200, { message: 'No items to process' });
  return response(200, item);
}

async function refreshBlocked(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const count = await modelDeletionQueueService.refreshBlockedItems();
  return response(200, { unblocked: count });
}

// ============================================================================
// Usage Session Endpoints
// ============================================================================

async function getActiveSessions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParts = event.path.split('/');
  const id = pathParts[pathParts.length - 2];
  const sessions = await modelDeletionQueueService.getActiveSessions(id);
  return response(200, { sessions });
}

// ============================================================================
// Helpers
// ============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: body ? JSON.stringify(body) : '',
  };
}
