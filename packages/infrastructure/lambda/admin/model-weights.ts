// RADIANT v4.18.0 - Model Weights & Drift Correction Admin API
// Admin endpoints for model weight management, drift correction, quarantine
// Base: /api/admin/model-weights/*
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/model-weights',
  category: 'audit',
  sourceType: 'lambda',
});
import { driftCorrectionService } from '../shared/services/drift-correction.service';

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

  logger.info('Model Weights API request', { method: httpMethod, path, tenantId });

  try {
    const segments = path.replace(/^\/api\/admin\/model-weights\/?/, '').split('/').filter(Boolean);
    const action = segments[0] || '';
    const modelId = segments[1] ? decodeURIComponent(segments[1]) : undefined;

    // GET /api/admin/model-weights/dashboard
    if (httpMethod === 'GET' && action === 'dashboard') {
      const dashboard = await driftCorrectionService.getDashboard(tenantId);
      return jsonResponse(200, dashboard);
    }

    // GET /api/admin/model-weights/models
    if (httpMethod === 'GET' && action === 'models') {
      const models = await driftCorrectionService.getAllWeightConfigs(tenantId);
      return jsonResponse(200, { models });
    }

    // GET /api/admin/model-weights/model/:modelId
    if (httpMethod === 'GET' && action === 'model' && modelId) {
      const config = await driftCorrectionService.getWeightConfig(tenantId, modelId);
      if (!config) {
        return jsonResponse(404, { error: 'Model weight config not found' });
      }
      return jsonResponse(200, config);
    }

    // PUT /api/admin/model-weights/model/:modelId
    if (httpMethod === 'PUT' && action === 'model' && modelId) {
      const updates = body ? JSON.parse(body) : {};
      const config = await driftCorrectionService.updateWeightConfig(tenantId, modelId, updates, userId);
      return jsonResponse(200, config);
    }

    // POST /api/admin/model-weights/quarantine/:modelId
    if (httpMethod === 'POST' && action === 'quarantine' && modelId) {
      const { reason, durationHours } = body ? JSON.parse(body) : {};
      const result = await driftCorrectionService.quarantineModel(
        tenantId, modelId, reason || 'Manual quarantine', durationHours || 24, userId
      );
      return jsonResponse(200, result);
    }

    // POST /api/admin/model-weights/unquarantine/:modelId
    if (httpMethod === 'POST' && action === 'unquarantine' && modelId) {
      const result = await driftCorrectionService.unquarantineModel(tenantId, modelId, userId);
      return jsonResponse(200, result);
    }

    // POST /api/admin/model-weights/check-drift/:modelId
    if (httpMethod === 'POST' && action === 'check-drift' && modelId) {
      const result = await driftCorrectionService.checkAndCorrect(tenantId, modelId);
      return jsonResponse(200, result);
    }

    // POST /api/admin/model-weights/check-drift-all
    if (httpMethod === 'POST' && action === 'check-drift-all') {
      const results = await driftCorrectionService.checkAndCorrectAllModels(tenantId);
      return jsonResponse(200, { results });
    }

    // POST /api/admin/model-weights/recalculate/:modelId
    if (httpMethod === 'POST' && action === 'recalculate' && modelId) {
      await driftCorrectionService.recalculateModelScores(tenantId, modelId);
      const config = await driftCorrectionService.getWeightConfig(tenantId, modelId);
      return jsonResponse(200, config);
    }

    // GET /api/admin/model-weights/history
    if (httpMethod === 'GET' && action === 'history') {
      const qs = event.queryStringParameters || {};
      const history = await driftCorrectionService.getWeightHistory(
        tenantId, qs.modelId, Number(qs.days || 30), Number(qs.limit || 200)
      );
      return jsonResponse(200, { history });
    }

    // GET /api/admin/model-weights/actions
    if (httpMethod === 'GET' && action === 'actions') {
      const qs = event.queryStringParameters || {};
      const actions = await driftCorrectionService.getCorrectionActions(
        tenantId, qs.modelId, Number(qs.days || 30), Number(qs.limit || 100)
      );
      return jsonResponse(200, { actions });
    }

    // GET /api/admin/model-weights/weighted
    if (httpMethod === 'GET' && action === 'weighted') {
      const qs = event.queryStringParameters || {};
      const excludeQuarantined = qs.excludeQuarantined !== 'false';
      const models = await driftCorrectionService.getWeightedModels(tenantId, excludeQuarantined);
      return jsonResponse(200, { models });
    }

    return jsonResponse(404, { error: 'Not found', path });
  } catch (error) {
    logger.error('Model Weights API error', { error: String(error), path });
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal server error' });
  }
};
