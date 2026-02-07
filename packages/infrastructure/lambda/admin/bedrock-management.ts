// RADIANT v4.18.0 - Bedrock Model Management Admin API
// Admin endpoints for Bedrock model discovery, registry, auto-upgrade, settings
// Base: /api/admin/bedrock/*
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/bedrock-management',
  category: 'audit',
  sourceType: 'lambda',
});
import { bedrockModelDiscoveryService } from '../shared/services/bedrock-model-discovery.service';

// ============================================================================
// Response Helpers
// ============================================================================

const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
});

const getTenantId = (event: APIGatewayProxyEvent): string =>
  event.requestContext.authorizer?.tenantId || event.headers['x-tenant-id'] || '';

const getUserId = (event: APIGatewayProxyEvent): string =>
  event.requestContext.authorizer?.userId || event.headers['x-user-id'] || '';

// ============================================================================
// Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const { httpMethod, path, body } = event;
  const tenantId = getTenantId(event);
  const userId = getUserId(event);

  if (!tenantId) {
    return jsonResponse(401, { error: 'Unauthorized - tenant ID required' });
  }

  logger.info('Bedrock Management API request', { method: httpMethod, path, tenantId });

  try {
    const segments = path.replace(/^\/api\/admin\/bedrock\/?/, '').split('/').filter(Boolean);
    const action = segments[0] || '';
    const subAction = segments[1] || '';

    // ========================================================================
    // Model Registry
    // ========================================================================

    // GET /api/admin/bedrock/models
    if (httpMethod === 'GET' && action === 'models') {
      const qs = event.queryStringParameters || {};
      const activeOnly = qs.activeOnly !== 'false';

      let models;
      if (qs.provider) {
        models = await bedrockModelDiscoveryService.getModelsByProvider(qs.provider);
      } else if (qs.family) {
        models = await bedrockModelDiscoveryService.getModelsByFamily(qs.family);
      } else {
        models = await bedrockModelDiscoveryService.getAllModels(activeOnly);
      }

      return jsonResponse(200, { models, count: models.length });
    }

    // GET /api/admin/bedrock/models/:modelId
    if (httpMethod === 'GET' && action === 'models' && subAction) {
      const modelId = decodeURIComponent(subAction);
      const model = await bedrockModelDiscoveryService.getModel(modelId);
      if (!model) {
        return jsonResponse(404, { error: 'Model not found in registry' });
      }
      return jsonResponse(200, model);
    }

    // GET /api/admin/bedrock/providers
    if (httpMethod === 'GET' && action === 'providers') {
      const providers = await bedrockModelDiscoveryService.getProviders();
      return jsonResponse(200, { providers });
    }

    // POST /api/admin/bedrock/poll
    if (httpMethod === 'POST' && action === 'poll') {
      const result = await bedrockModelDiscoveryService.pollAndSyncModels();
      await bedrockModelDiscoveryService.recordPoll(tenantId);
      return jsonResponse(200, result);
    }

    // ========================================================================
    // Auto-Upgrade
    // ========================================================================

    // POST /api/admin/bedrock/auto-upgrade
    if (httpMethod === 'POST' && action === 'auto-upgrade') {
      const result = await bedrockModelDiscoveryService.checkAndAutoUpgrade(tenantId);
      return jsonResponse(200, result);
    }

    // ========================================================================
    // AI Helper Config
    // ========================================================================

    // GET /api/admin/bedrock/config
    if (httpMethod === 'GET' && action === 'config') {
      const config = await bedrockModelDiscoveryService.ensureHelperConfig(tenantId);
      return jsonResponse(200, config);
    }

    // PUT /api/admin/bedrock/config
    if (httpMethod === 'PUT' && action === 'config') {
      const updates = body ? JSON.parse(body) : {};
      const config = await bedrockModelDiscoveryService.updateHelperConfig(tenantId, updates, userId);
      return jsonResponse(200, config);
    }

    // GET /api/admin/bedrock/poll-status
    if (httpMethod === 'GET' && action === 'poll-status') {
      const isDue = await bedrockModelDiscoveryService.isPollDue(tenantId);
      const config = await bedrockModelDiscoveryService.getHelperConfig(tenantId);
      return jsonResponse(200, {
        pollDue: isDue,
        lastPollAt: config?.lastModelPollAt,
        pollIntervalHours: config?.modelPollIntervalHours,
        lastAutoUpgradeAt: config?.lastAutoUpgradeAt,
        lastAutoUpgradeFrom: config?.lastAutoUpgradeFrom,
        lastAutoUpgradeTo: config?.lastAutoUpgradeTo,
      });
    }

    // ========================================================================
    // Dashboard
    // ========================================================================

    // GET /api/admin/bedrock/dashboard
    if (httpMethod === 'GET' && action === 'dashboard') {
      const [config, models, providers] = await Promise.all([
        bedrockModelDiscoveryService.ensureHelperConfig(tenantId),
        bedrockModelDiscoveryService.getAllModels(true),
        bedrockModelDiscoveryService.getProviders(),
      ]);

      const modelsByProvider: Record<string, number> = {};
      for (const model of models) {
        modelsByProvider[model.providerName] = (modelsByProvider[model.providerName] || 0) + 1;
      }

      return jsonResponse(200, {
        config,
        totalModels: models.length,
        providers,
        modelsByProvider,
        currentModelId: config.bedrockModelId,
        autoUpgradeEnabled: config.autoUpgradeModel,
        pollIntervalHours: config.modelPollIntervalHours,
        lastPollAt: config.lastModelPollAt,
        totalAIHelperRequests: config.totalRequests,
        totalAIHelperCostCents: config.totalCostCents,
      });
    }

    return jsonResponse(404, { error: 'Not found', path });
  } catch (error) {
    logger.error('Bedrock Management API error', { error: String(error), path });
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal server error' });
  }
};
