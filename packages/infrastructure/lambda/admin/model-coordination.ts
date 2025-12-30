// RADIANT v4.18.0 - Model Coordination Admin API Handler
// Admin endpoints for configuring model sync and viewing registry

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { modelCoordinationService } from '../shared/services/model-coordination.service';
import { logger } from '../shared/logger';

// ============================================================================
// Helper Functions
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const success = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const error = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

// ============================================================================
// Sync Configuration Endpoints
// ============================================================================

/**
 * GET /api/admin/model-coordination/config
 * Get sync configuration
 */
export const getSyncConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.queryStringParameters?.tenantId;
    const config = await modelCoordinationService.getSyncConfig(tenantId);
    
    return success({ config });
  } catch (err) {
    logger.error(`Error getting sync config: ${String(err)}`);
    return error(500, 'Failed to get sync configuration');
  }
};

/**
 * PUT /api/admin/model-coordination/config
 * Update sync configuration
 */
export const updateSyncConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const tenantId = event.queryStringParameters?.tenantId;
    
    const {
      autoSyncEnabled,
      syncIntervalMinutes,
      syncExternalProviders,
      syncSelfHostedModels,
      syncFromHuggingFace,
      autoDiscoveryEnabled,
      autoGenerateProficiencies,
      notifyOnNewModel,
      notifyOnModelRemoved,
      notifyOnSyncFailure,
      notificationEmails,
      notificationWebhook,
    } = body;
    
    // Validate sync interval
    if (syncIntervalMinutes && ![5, 15, 30, 60, 360, 1440].includes(syncIntervalMinutes)) {
      return error(400, 'Sync interval must be one of: 5, 15, 30, 60, 360, or 1440 minutes');
    }
    
    const config = await modelCoordinationService.updateSyncConfig(tenantId, {
      autoSyncEnabled,
      syncIntervalMinutes,
      syncExternalProviders,
      syncSelfHostedModels,
      syncFromHuggingFace,
      autoDiscoveryEnabled,
      autoGenerateProficiencies,
      notifyOnNewModel,
      notifyOnModelRemoved,
      notifyOnSyncFailure,
      notificationEmails,
      notificationWebhook,
    });
    
    return success({
      message: 'Sync configuration updated',
      config,
    });
  } catch (err) {
    logger.error(`Error updating sync config: ${String(err)}`);
    return error(500, 'Failed to update sync configuration');
  }
};

// ============================================================================
// Sync Execution Endpoints
// ============================================================================

/**
 * POST /api/admin/model-coordination/sync
 * Trigger a manual sync
 */
export const triggerSync: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const tenantId = event.queryStringParameters?.tenantId;
    const userId = event.requestContext?.authorizer?.userId;
    
    const job = await modelCoordinationService.executeSync(
      tenantId,
      'manual',
      userId
    );
    
    return success({
      message: 'Sync triggered successfully',
      job,
    });
  } catch (err) {
    logger.error(`Error triggering sync: ${String(err)}`);
    return error(500, 'Failed to trigger sync');
  }
};

/**
 * GET /api/admin/model-coordination/sync/jobs
 * Get recent sync jobs
 */
export const getSyncJobs: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.queryStringParameters?.tenantId;
    const dashboard = await modelCoordinationService.getDashboard(tenantId);
    
    return success({
      jobs: dashboard.recentJobs,
      lastSync: dashboard.lastSync,
    });
  } catch (err) {
    logger.error(`Error getting sync jobs: ${String(err)}`);
    return error(500, 'Failed to get sync jobs');
  }
};

// ============================================================================
// Model Registry Endpoints
// ============================================================================

/**
 * GET /api/admin/model-coordination/registry
 * Get all registry entries
 */
export const getRegistry: APIGatewayProxyHandler = async (event) => {
  try {
    const source = event.queryStringParameters?.source as 'external' | 'self-hosted' | undefined;
    const status = event.queryStringParameters?.status as 'active' | 'inactive' | 'deprecated' | undefined;
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    
    const entries = await modelCoordinationService.getAllRegistryEntries({
      source,
      status,
      limit,
      offset,
    });
    
    return success({
      entries,
      count: entries.length,
      filters: { source, status, limit, offset },
    });
  } catch (err) {
    logger.error(`Error getting registry: ${String(err)}`);
    return error(500, 'Failed to get registry');
  }
};

/**
 * GET /api/admin/model-coordination/registry/:modelId
 * Get single registry entry
 */
export const getRegistryEntry: APIGatewayProxyHandler = async (event) => {
  try {
    const modelId = event.pathParameters?.modelId;
    if (!modelId) {
      return error(400, 'Model ID required');
    }
    
    const entry = await modelCoordinationService.getRegistryEntry(modelId);
    if (!entry) {
      return error(404, 'Model not found in registry');
    }
    
    return success({ entry });
  } catch (err) {
    logger.error(`Error getting registry entry: ${String(err)}`);
    return error(500, 'Failed to get registry entry');
  }
};

/**
 * POST /api/admin/model-coordination/registry
 * Add model to registry
 */
export const addRegistryEntry: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { modelId, source, provider, family, capabilities, inputModalities, outputModalities, status } = body;
    
    if (!modelId || !source || !provider || !family) {
      return error(400, 'modelId, source, provider, and family are required');
    }
    
    const id = await modelCoordinationService.createRegistryEntry({
      modelId,
      source,
      provider,
      family,
      capabilities: capabilities || [],
      inputModalities: inputModalities || [],
      outputModalities: outputModalities || [],
      status,
    });
    
    return success({
      message: 'Model added to registry',
      id,
      modelId,
    });
  } catch (err) {
    logger.error(`Error adding registry entry: ${String(err)}`);
    return error(500, 'Failed to add model to registry');
  }
};

/**
 * PUT /api/admin/model-coordination/registry/:modelId
 * Update registry entry
 */
export const updateRegistryEntry: APIGatewayProxyHandler = async (event) => {
  try {
    const modelId = event.pathParameters?.modelId;
    if (!modelId) {
      return error(400, 'Model ID required');
    }
    
    const body = JSON.parse(event.body || '{}');
    const { capabilities, inputModalities, outputModalities, status } = body;
    
    await modelCoordinationService.updateRegistryEntry(modelId, {
      capabilities,
      inputModalities,
      outputModalities,
      status,
    });
    
    const entry = await modelCoordinationService.getRegistryEntry(modelId);
    
    return success({
      message: 'Registry entry updated',
      entry,
    });
  } catch (err) {
    logger.error(`Error updating registry entry: ${String(err)}`);
    return error(500, 'Failed to update registry entry');
  }
};

// ============================================================================
// Endpoint Management
// ============================================================================

/**
 * POST /api/admin/model-coordination/endpoints
 * Add endpoint for a model
 */
export const addEndpoint: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      modelId,
      endpointType,
      baseUrl,
      path,
      method,
      authMethod,
      authConfig,
      requestFormat,
      responseFormat,
      rateLimitRpm,
      rateLimitTpm,
      maxConcurrent,
      timeoutMs,
      healthCheckUrl,
      priority,
    } = body;
    
    if (!modelId || !baseUrl) {
      return error(400, 'modelId and baseUrl are required');
    }
    
    const id = await modelCoordinationService.createEndpoint({
      modelId,
      endpointType: endpointType || 'custom_rest',
      baseUrl,
      path,
      method: method || 'POST',
      authMethod: authMethod || 'api_key',
      authConfig,
      requestFormat,
      responseFormat,
      rateLimitRpm,
      rateLimitTpm,
      maxConcurrent,
      timeoutMs,
      healthCheckUrl,
      priority: priority || 1,
      healthStatus: 'unknown',
      isActive: true,
    });
    
    return success({
      message: 'Endpoint added',
      id,
      modelId,
    });
  } catch (err) {
    logger.error(`Error adding endpoint: ${String(err)}`);
    return error(500, 'Failed to add endpoint');
  }
};

/**
 * PUT /api/admin/model-coordination/endpoints/:endpointId/health
 * Update endpoint health status
 */
export const updateEndpointHealth: APIGatewayProxyHandler = async (event) => {
  try {
    const endpointId = event.pathParameters?.endpointId;
    if (!endpointId) {
      return error(400, 'Endpoint ID required');
    }
    
    const body = JSON.parse(event.body || '{}');
    const { healthStatus } = body;
    
    if (!['healthy', 'degraded', 'unhealthy'].includes(healthStatus)) {
      return error(400, 'healthStatus must be healthy, degraded, or unhealthy');
    }
    
    await modelCoordinationService.updateEndpointHealth(endpointId, healthStatus);
    
    return success({
      message: 'Endpoint health updated',
      endpointId,
      healthStatus,
    });
  } catch (err) {
    logger.error(`Error updating endpoint health: ${String(err)}`);
    return error(500, 'Failed to update endpoint health');
  }
};

// ============================================================================
// New Model Detection
// ============================================================================

/**
 * GET /api/admin/model-coordination/detections
 * Get pending model detections
 */
export const getPendingDetections: APIGatewayProxyHandler = async () => {
  try {
    const detections = await modelCoordinationService.getPendingDetections();
    
    return success({
      detections,
      count: detections.length,
    });
  } catch (err) {
    logger.error(`Error getting pending detections: ${String(err)}`);
    return error(500, 'Failed to get pending detections');
  }
};

/**
 * POST /api/admin/model-coordination/detect
 * Manually report a new model detection
 */
export const reportDetection: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { modelId, provider, family, capabilities } = body;
    
    if (!modelId) {
      return error(400, 'modelId required');
    }
    
    const detectionId = await modelCoordinationService.detectNewModel(
      modelId,
      'manual',
      { provider, family, capabilities }
    );
    
    return success({
      message: 'Model detection reported',
      detectionId,
      modelId,
    });
  } catch (err) {
    logger.error(`Error reporting detection: ${String(err)}`);
    return error(500, 'Failed to report detection');
  }
};

// ============================================================================
// Dashboard
// ============================================================================

/**
 * GET /api/admin/model-coordination/dashboard
 * Get full dashboard data
 */
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.queryStringParameters?.tenantId;
    const dashboard = await modelCoordinationService.getDashboard(tenantId);
    
    return success({ dashboard });
  } catch (err) {
    logger.error(`Error getting dashboard: ${String(err)}`);
    return error(500, 'Failed to get dashboard');
  }
};

// ============================================================================
// Sync Interval Presets
// ============================================================================

/**
 * GET /api/admin/model-coordination/intervals
 * Get available sync interval options
 */
export const getSyncIntervals: APIGatewayProxyHandler = async () => {
  return success({
    intervals: [
      { value: 5, label: 'Every 5 minutes', description: 'High frequency - recommended for development' },
      { value: 15, label: 'Every 15 minutes', description: 'Frequent updates with lower overhead' },
      { value: 30, label: 'Every 30 minutes', description: 'Balanced frequency' },
      { value: 60, label: 'Hourly', description: 'Recommended for production' },
      { value: 360, label: 'Every 6 hours', description: 'Low frequency for stable environments' },
      { value: 1440, label: 'Daily', description: 'Once per day at configured time' },
    ],
  });
};
