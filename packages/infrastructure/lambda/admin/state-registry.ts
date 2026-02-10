/**
 * Environment State Registry Admin API
 * 
 * API handlers for managing environment state manifests,
 * comparisons, syncs, and backups.
 * 
 * Base Path: /api/admin/state-registry
 * 
 * @version 1.0.0
 * @since RADIANT 7.0.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createEnvironmentStateService, EnvironmentStateService } from '../shared/services/state-registry';

import type {
  EnvironmentName,
  CaptureManifestRequest,
  CompareEnvironmentsRequest,
  StartSyncRequest,
  CreateBackupRequest,
  SyncConfiguration,
} from '@radiant/shared';

// ============================================================================
// Configuration
// ============================================================================

const SERVICE_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  accountId: process.env.AWS_ACCOUNT_ID || '',
  environment: (process.env.RADIANT_ENVIRONMENT || 'dev') as EnvironmentName,
  stateRegistryBucket: process.env.STATE_REGISTRY_BUCKET || '',
  radiantVersion: process.env.RADIANT_VERSION || '7.0.0',
};

let stateService: EnvironmentStateService | null = null;

function getStateService(): EnvironmentStateService {
  if (!stateService) {
    stateService = createEnvironmentStateService(SERVICE_CONFIG);
  }
  return stateService;
}

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function successResponse(data: unknown): APIGatewayProxyResult {
  return jsonResponse(200, { success: true, data });
}

function errorResponse(statusCode: number, message: string, details?: unknown): APIGatewayProxyResult {
  return jsonResponse(statusCode, { success: false, error: message, details });
}

function parseBody<T>(event: APIGatewayProxyEvent): T | null {
  try {
    return event.body ? JSON.parse(event.body) : null;
  } catch {
    return null;
  }
}

function getEnvironmentParam(event: APIGatewayProxyEvent): EnvironmentName | null {
  const env = event.pathParameters?.environment || event.queryStringParameters?.environment;
  if (env === 'dev' || env === 'staging' || env === 'prod') {
    return env;
  }
  return null;
}

function getUserFromEvent(event: APIGatewayProxyEvent): string {
  // Extract user from JWT claims or API key
  const claims = event.requestContext.authorizer?.claims;
  return claims?.email || claims?.sub || 'system';
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('State Registry API:', event.httpMethod, event.path);
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, {});
  }
  
  const path = event.path.replace('/api/admin/state-registry', '');
  const method = event.httpMethod;
  
  try {
    // Route requests
    if (path === '' || path === '/') {
      if (method === 'GET') return await getDashboard(event);
    }
    
    // Manifest operations
    if (path === '/manifests' || path.startsWith('/manifests/')) {
      if (method === 'GET' && path === '/manifests') return await listManifests(event);
      if (method === 'GET' && path.match(/^\/manifests\/(dev|staging|prod)$/)) return await getManifest(event);
      if (method === 'POST' && path.match(/^\/manifests\/(dev|staging|prod)\/capture$/)) return await captureManifest(event);
      if (method === 'GET' && path.match(/^\/manifests\/(dev|staging|prod)\/history$/)) return await getManifestHistory(event);
    }
    
    // Comparison operations
    if (path === '/compare') {
      if (method === 'POST') return await compareEnvironments(event);
    }
    
    // Sync operations
    if (path.startsWith('/sync')) {
      if (method === 'POST' && path === '/sync') return await startSync(event);
      if (method === 'GET' && path.match(/^\/sync\/[a-z0-9-]+$/)) return await getSyncStatus(event);
      if (method === 'POST' && path.match(/^\/sync\/[a-z0-9-]+\/cancel$/)) return await cancelSync(event);
      if (method === 'GET' && path === '/sync/history') return await getSyncHistory(event);
    }
    
    // Sync configuration
    if (path.startsWith('/config')) {
      if (method === 'GET' && path.match(/^\/config\/(dev|staging|prod)$/)) return await getSyncConfig(event);
      if (method === 'PUT' && path.match(/^\/config\/(dev|staging|prod)$/)) return await updateSyncConfig(event);
    }
    
    // Backup operations
    if (path.startsWith('/backups')) {
      if (method === 'GET' && path === '/backups') return await listBackups(event);
      if (method === 'POST' && path === '/backups') return await createBackup(event);
      if (method === 'GET' && path.match(/^\/backups\/[a-z0-9-]+$/)) return await getBackup(event);
      if (method === 'POST' && path.match(/^\/backups\/[a-z0-9-]+\/restore$/)) return await restoreBackup(event);
      if (method === 'DELETE' && path.match(/^\/backups\/[a-z0-9-]+$/)) return await deleteBackup(event);
    }
    
    // Persistent data operations
    if (path.startsWith('/persistent-data')) {
      if (method === 'GET' && path.match(/^\/persistent-data\/(dev|staging|prod)$/)) return await getPersistentData(event);
      if (method === 'PUT' && path.match(/^\/persistent-data\/(dev|staging|prod)$/)) return await updatePersistentData(event);
    }
    
    return errorResponse(404, 'Endpoint not found');
  } catch (error) {
    console.error('State Registry API Error:', error);
    return errorResponse(500, error instanceof Error ? error.message : 'Internal server error');
  }
}

// ============================================================================
// Dashboard
// ============================================================================

async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const service = getStateService();
  
  // Get current manifests for all environments
  const [devManifest, stagingManifest, prodManifest] = await Promise.all([
    service.captureManifest({ environment: 'dev', capturedBy: 'dashboard', includeInfrastructure: false }),
    service.captureManifest({ environment: 'staging', capturedBy: 'dashboard', includeInfrastructure: false }),
    service.captureManifest({ environment: 'prod', capturedBy: 'dashboard', includeInfrastructure: false }),
  ]);
  
  const dashboard = {
    environments: {
      dev: devManifest.success ? {
        lastCaptured: devManifest.manifest?.capturedAt,
        health: devManifest.manifest?.health.overall,
        stackCount: devManifest.manifest?.infrastructure.stacks.length || 0,
        lambdaCount: devManifest.manifest?.infrastructure.lambdas.length || 0,
        persistentDataItems: devManifest.manifest?.persistentData.length || 0,
      } : null,
      staging: stagingManifest.success ? {
        lastCaptured: stagingManifest.manifest?.capturedAt,
        health: stagingManifest.manifest?.health.overall,
        stackCount: stagingManifest.manifest?.infrastructure.stacks.length || 0,
        lambdaCount: stagingManifest.manifest?.infrastructure.lambdas.length || 0,
        persistentDataItems: stagingManifest.manifest?.persistentData.length || 0,
      } : null,
      prod: prodManifest.success ? {
        lastCaptured: prodManifest.manifest?.capturedAt,
        health: prodManifest.manifest?.health.overall,
        stackCount: prodManifest.manifest?.infrastructure.stacks.length || 0,
        lambdaCount: prodManifest.manifest?.infrastructure.lambdas.length || 0,
        persistentDataItems: prodManifest.manifest?.persistentData.length || 0,
      } : null,
    },
    recentSyncs: [], // Would load from S3
    recentBackups: [], // Would load from S3
    syncEnabled: {
      dev: true,
      staging: true,
      prod: false, // Default off for production
    },
  };
  
  return successResponse(dashboard);
}

// ============================================================================
// Manifest Operations
// ============================================================================

async function listManifests(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const service = getStateService();
  
  // Get summaries for all environments
  const environments: EnvironmentName[] = ['dev', 'staging', 'prod'];
  const summaries = await Promise.all(
    environments.map(async (env) => {
      const result = await service.captureManifest({ 
        environment: env, 
        capturedBy: 'list',
        includeInfrastructure: false,
        includePersistentData: false,
      });
      
      if (!result.success || !result.manifest) {
        return { environment: env, available: false };
      }
      
      return {
        environment: env,
        available: true,
        version: result.manifest.version,
        capturedAt: result.manifest.capturedAt,
        capturedBy: result.manifest.capturedBy,
        health: result.manifest.health.overall,
        checksum: result.manifest.checksums.full,
      };
    })
  );
  
  return successResponse({ manifests: summaries });
}

async function getManifest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const environment = getEnvironmentParam(event);
  if (!environment) {
    return errorResponse(400, 'Invalid environment parameter');
  }
  
  const service = getStateService();
  const result = await service.captureManifest({
    environment,
    capturedBy: getUserFromEvent(event),
  });
  
  if (!result.success) {
    return errorResponse(500, result.error || 'Failed to get manifest');
  }
  
  return successResponse(result.manifest);
}

async function captureManifest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const environment = getEnvironmentParam(event);
  if (!environment) {
    return errorResponse(400, 'Invalid environment parameter');
  }
  
  const body = parseBody<Partial<CaptureManifestRequest>>(event) || {};
  
  const service = getStateService();
  const result = await service.captureManifest({
    environment,
    capturedBy: getUserFromEvent(event),
    includeInfrastructure: body.includeInfrastructure ?? true,
    includePersistentData: body.includePersistentData ?? true,
    includeFeatures: body.includeFeatures ?? true,
  });
  
  if (!result.success) {
    return errorResponse(500, result.error || 'Failed to capture manifest');
  }
  
  return successResponse({
    manifest: result.manifest,
    duration: result.duration,
  });
}

async function getManifestHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const environment = getEnvironmentParam(event);
  if (!environment) {
    return errorResponse(400, 'Invalid environment parameter');
  }
  
  // Parse pagination parameters
  const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
  const before = event.queryStringParameters?.before;
  
  // Would load history from S3
  return successResponse({
    environment,
    history: [], // Would be populated from S3 listing
    pagination: {
      limit,
      before,
      hasMore: false,
    },
  });
}

// ============================================================================
// Comparison Operations
// ============================================================================

async function compareEnvironments(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody<CompareEnvironmentsRequest>(event);
  if (!body?.sourceEnvironment || !body?.targetEnvironment) {
    return errorResponse(400, 'Missing sourceEnvironment or targetEnvironment');
  }
  
  const service = getStateService();
  const result = await service.compareEnvironments({
    sourceEnvironment: body.sourceEnvironment,
    targetEnvironment: body.targetEnvironment,
    comparedBy: getUserFromEvent(event),
    includeInfrastructure: body.includeInfrastructure ?? true,
    includePersistentData: body.includePersistentData ?? true,
    includeFeatures: body.includeFeatures ?? true,
  });
  
  if (!result.success) {
    return errorResponse(500, result.error || 'Failed to compare environments');
  }
  
  return successResponse(result.comparison);
}

// ============================================================================
// Sync Operations
// ============================================================================

async function startSync(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody<StartSyncRequest>(event);
  if (!body?.sourceEnvironment || !body?.targetEnvironment) {
    return errorResponse(400, 'Missing sourceEnvironment or targetEnvironment');
  }
  
  // Prevent syncing to production without explicit confirmation
  if (body.targetEnvironment === 'prod' && !body.confirmProduction) {
    return errorResponse(400, 'Syncing to production requires confirmProduction: true');
  }
  
  const service = getStateService();
  const result = await service.startSync({
    ...body,
    initiatedBy: getUserFromEvent(event),
  });
  
  if (!result.success) {
    return errorResponse(500, result.error || 'Failed to start sync');
  }
  
  return successResponse({
    operationId: result.operationId,
    message: 'Sync operation started',
  });
}

async function getSyncStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const operationId = event.pathParameters?.operationId;
  if (!operationId) {
    return errorResponse(400, 'Missing operationId');
  }
  
  const service = getStateService();
  const operation = await service.getSyncOperation(operationId);
  if (!operation) {
    return errorResponse(404, `Sync operation ${operationId} not found`);
  }
  return successResponse(operation);
}

async function cancelSync(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const operationId = event.pathParameters?.operationId;
  if (!operationId) {
    return errorResponse(400, 'Missing operationId');
  }
  
  const service = getStateService();
  const operation = await service.cancelSyncOperation(operationId);
  if (!operation) {
    return errorResponse(404, `Sync operation ${operationId} not found`);
  }
  return successResponse({
    operationId,
    status: operation.status,
    message: 'Sync operation cancelled',
  });
}

async function getSyncHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const environment = event.queryStringParameters?.environment as EnvironmentName | undefined;
  const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
  
  const service = getStateService();
  const history = await service.listSyncOperations({ environment: environment || undefined, limit });
  return successResponse({
    history,
    pagination: {
      limit,
      hasMore: history.length >= limit,
    },
  });
}

// ============================================================================
// Sync Configuration
// ============================================================================

async function getSyncConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const environment = getEnvironmentParam(event);
  if (!environment) {
    return errorResponse(400, 'Invalid environment parameter');
  }
  
  const service = getStateService();
  const config = await service.getSyncConfig(environment);
  return successResponse({
    environment,
    config,
  });
}

async function updateSyncConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const environment = getEnvironmentParam(event);
  if (!environment) {
    return errorResponse(400, 'Invalid environment parameter');
  }
  
  const body = parseBody<Partial<SyncConfiguration>>(event);
  if (!body) {
    return errorResponse(400, 'Invalid request body');
  }
  
  // Prevent enabling auto-sync to production
  if (environment === 'prod' && body.autoSyncEnabled) {
    return errorResponse(400, 'Auto-sync cannot be enabled for production environment');
  }
  
  const service = getStateService();
  const currentConfig = await service.getSyncConfig(environment);
  const mergedConfig: SyncConfiguration = { ...currentConfig, ...body };
  await service.saveSyncConfig(environment, mergedConfig);
  return successResponse({
    environment,
    config: mergedConfig,
    message: 'Sync configuration updated',
  });
}

// ============================================================================
// Backup Operations
// ============================================================================

async function listBackups(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const environment = event.queryStringParameters?.environment as EnvironmentName | undefined;
  const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
  
  const service = getStateService();
  const backups = await service.listBackupManifests({ environment: environment || undefined, limit });
  return successResponse({
    backups,
    pagination: {
      limit,
      hasMore: backups.length >= limit,
    },
  });
}

async function createBackup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody<CreateBackupRequest>(event);
  if (!body?.environment) {
    return errorResponse(400, 'Missing environment');
  }
  
  const service = getStateService();
  const result = await service.createBackup({
    ...body,
    createdBy: getUserFromEvent(event),
  });
  
  if (!result.success) {
    return errorResponse(500, result.error || 'Failed to create backup');
  }
  
  return successResponse({
    backupId: result.backupId,
    message: 'Backup operation started',
  });
}

async function getBackup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const backupId = event.pathParameters?.backupId;
  if (!backupId) {
    return errorResponse(400, 'Missing backupId');
  }
  
  const service = getStateService();
  const backup = await service.getBackupManifest(backupId);
  if (!backup) {
    return errorResponse(404, `Backup ${backupId} not found`);
  }
  return successResponse(backup);
}

async function restoreBackup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const backupId = event.pathParameters?.backupId;
  if (!backupId) {
    return errorResponse(400, 'Missing backupId');
  }
  
  const body = parseBody<{
    targetEnvironment: EnvironmentName;
    confirmRestore: boolean;
    restoreItems?: string[];
  }>(event);
  
  if (!body?.targetEnvironment) {
    return errorResponse(400, 'Missing targetEnvironment');
  }
  
  // Require confirmation for restore
  if (!body.confirmRestore) {
    return errorResponse(400, 'Restore requires confirmRestore: true');
  }
  
  // Would start restore operation
  return successResponse({
    restoreOperationId: `restore-${Date.now()}`,
    backupId,
    targetEnvironment: body.targetEnvironment,
    message: 'Restore operation started',
  });
}

async function deleteBackup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const backupId = event.pathParameters?.backupId;
  if (!backupId) {
    return errorResponse(400, 'Missing backupId');
  }
  
  const service = getStateService();
  const deleted = await service.deleteBackupManifest(backupId);
  if (!deleted) {
    return errorResponse(404, `Backup ${backupId} not found`);
  }
  return successResponse({
    backupId,
    message: 'Backup deleted',
  });
}

// ============================================================================
// Persistent Data Operations
// ============================================================================

async function getPersistentData(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const environment = getEnvironmentParam(event);
  if (!environment) {
    return errorResponse(400, 'Invalid environment parameter');
  }
  
  const service = getStateService();
  const result = await service.captureManifest({
    environment,
    capturedBy: 'get-data',
    includeInfrastructure: false,
    includePersistentData: true,
    includeFeatures: false,
  });
  
  if (!result.success || !result.manifest) {
    return errorResponse(500, result.error || 'Failed to get persistent data');
  }
  
  return successResponse({
    environment,
    persistentData: result.manifest.persistentData,
  });
}

async function updatePersistentData(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const environment = getEnvironmentParam(event);
  if (!environment) {
    return errorResponse(400, 'Invalid environment parameter');
  }
  
  const body = parseBody<{
    itemId: string;
    includeInSync: boolean;
  }>(event);
  
  if (!body?.itemId) {
    return errorResponse(400, 'Missing itemId');
  }
  
  // Would update in sync config
  return successResponse({
    environment,
    itemId: body.itemId,
    includeInSync: body.includeInSync,
    message: 'Persistent data item updated',
  });
}
