// RADIANT v4.18.0 - Admin API for SageMaker Inference Components
// Manages multi-model hosting with reduced cold starts

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { inferenceComponentsService } from '../shared/services/inference-components.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import type { ModelHostingTier } from '@radiant/shared';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

// ============================================================================
// GET /admin/inference-components/config
// ============================================================================
export const getConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const config = await inferenceComponentsService.getConfig(tenantId);
    return response(200, { success: true, data: config });
  } catch (error) {
    logger.error('Error fetching inference components config', error);
    return response(500, { success: false, error: 'Failed to fetch configuration' });
  }
};

// ============================================================================
// PUT /admin/inference-components/config
// ============================================================================
export const updateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    const config = await inferenceComponentsService.updateConfig(tenantId, body);
    return response(200, { success: true, data: config });
  } catch (error) {
    logger.error('Error updating inference components config', error);
    return response(500, { success: false, error: 'Failed to update configuration' });
  }
};

// ============================================================================
// GET /admin/inference-components/dashboard
// ============================================================================
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const dashboard = await inferenceComponentsService.getDashboard(tenantId);
    return response(200, { success: true, data: dashboard });
  } catch (error) {
    logger.error('Error fetching dashboard', error);
    return response(500, { success: false, error: 'Failed to fetch dashboard' });
  }
};

// ============================================================================
// GET /admin/inference-components/endpoints
// ============================================================================
export const listEndpoints: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const endpoints = await inferenceComponentsService.listSharedEndpoints(tenantId);
    return response(200, { success: true, data: endpoints });
  } catch (error) {
    logger.error('Error listing endpoints', error);
    return response(500, { success: false, error: 'Failed to list endpoints' });
  }
};

// ============================================================================
// POST /admin/inference-components/endpoints
// ============================================================================
export const createEndpoint: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    const { instanceType, instanceCount } = body;

    if (!instanceType) {
      return response(400, { success: false, error: 'instanceType is required' });
    }

    const endpoint = await inferenceComponentsService.createSharedEndpoint(
      tenantId,
      instanceType,
      instanceCount || 1
    );
    return response(201, { success: true, data: endpoint });
  } catch (error) {
    logger.error('Error creating endpoint', error);
    return response(500, { success: false, error: 'Failed to create endpoint' });
  }
};

// ============================================================================
// GET /admin/inference-components/endpoints/{endpointName}
// ============================================================================
export const getEndpoint: APIGatewayProxyHandler = async (event) => {
  try {
    const endpointName = event.pathParameters?.endpointName;
    if (!endpointName) {
      return response(400, { success: false, error: 'endpointName is required' });
    }

    const endpoint = await inferenceComponentsService.getSharedEndpoint(endpointName);
    return response(200, { success: true, data: endpoint });
  } catch (error) {
    logger.error('Error fetching endpoint', error);
    return response(500, { success: false, error: 'Failed to fetch endpoint' });
  }
};

// ============================================================================
// DELETE /admin/inference-components/endpoints/{endpointName}
// ============================================================================
export const deleteEndpoint: APIGatewayProxyHandler = async (event) => {
  try {
    const endpointName = event.pathParameters?.endpointName;
    if (!endpointName) {
      return response(400, { success: false, error: 'endpointName is required' });
    }

    await inferenceComponentsService.deleteSharedEndpoint(endpointName);
    return response(200, { success: true, message: 'Endpoint deletion initiated' });
  } catch (error) {
    logger.error('Error deleting endpoint', error);
    return response(500, { success: false, error: 'Failed to delete endpoint' });
  }
};

// ============================================================================
// GET /admin/inference-components/components
// ============================================================================
export const listComponents: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const components = await inferenceComponentsService.listInferenceComponents(tenantId);
    return response(200, { success: true, data: components });
  } catch (error) {
    logger.error('Error listing components', error);
    return response(500, { success: false, error: 'Failed to list components' });
  }
};

// ============================================================================
// POST /admin/inference-components/components
// ============================================================================
export const createComponent: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    const {
      modelId,
      modelName,
      modelArtifactS3Uri,
      containerImage,
      framework,
      frameworkVersion,
      computeUnits,
    } = body;

    if (!modelId || !modelName) {
      return response(400, { success: false, error: 'modelId and modelName are required' });
    }

    const component = await inferenceComponentsService.createInferenceComponent(
      tenantId,
      modelId,
      modelName,
      modelArtifactS3Uri || '',
      containerImage || '',
      framework || 'pytorch',
      frameworkVersion || '2.0',
      computeUnits || 1
    );
    return response(201, { success: true, data: component });
  } catch (error) {
    logger.error('Error creating component', error);
    return response(500, { success: false, error: 'Failed to create component' });
  }
};

// ============================================================================
// GET /admin/inference-components/components/{componentName}
// ============================================================================
export const getComponent: APIGatewayProxyHandler = async (event) => {
  try {
    const componentName = event.pathParameters?.componentName;
    if (!componentName) {
      return response(400, { success: false, error: 'componentName is required' });
    }

    const component = await inferenceComponentsService.getInferenceComponent(componentName);
    return response(200, { success: true, data: component });
  } catch (error) {
    logger.error('Error fetching component', error);
    return response(500, { success: false, error: 'Failed to fetch component' });
  }
};

// ============================================================================
// DELETE /admin/inference-components/components/{componentName}
// ============================================================================
export const deleteComponent: APIGatewayProxyHandler = async (event) => {
  try {
    const componentName = event.pathParameters?.componentName;
    if (!componentName) {
      return response(400, { success: false, error: 'componentName is required' });
    }

    await inferenceComponentsService.deleteInferenceComponent(componentName);
    return response(200, { success: true, message: 'Component deletion initiated' });
  } catch (error) {
    logger.error('Error deleting component', error);
    return response(500, { success: false, error: 'Failed to delete component' });
  }
};

// ============================================================================
// POST /admin/inference-components/components/{componentId}/load
// ============================================================================
export const loadComponent: APIGatewayProxyHandler = async (event) => {
  try {
    const componentId = event.pathParameters?.componentId;
    const body = JSON.parse(event.body || '{}');
    const userId = event.requestContext.authorizer?.userId;

    if (!componentId) {
      return response(400, { success: false, error: 'componentId is required' });
    }

    const result = await inferenceComponentsService.loadComponent({
      componentId,
      priority: body.priority || 'normal',
      requesterUserId: userId,
      reason: body.reason || 'Manual load request',
      timeoutMs: body.timeoutMs,
    });

    return response(200, { success: true, data: result });
  } catch (error) {
    logger.error('Error loading component', error);
    return response(500, { success: false, error: 'Failed to load component' });
  }
};

// ============================================================================
// POST /admin/inference-components/components/{componentId}/unload
// ============================================================================
export const unloadComponent: APIGatewayProxyHandler = async (event) => {
  try {
    const componentId = event.pathParameters?.componentId;
    if (!componentId) {
      return response(400, { success: false, error: 'componentId is required' });
    }

    await inferenceComponentsService.unloadComponent(componentId);
    return response(200, { success: true, message: 'Component unload initiated' });
  } catch (error) {
    logger.error('Error unloading component', error);
    return response(500, { success: false, error: 'Failed to unload component' });
  }
};

// ============================================================================
// GET /admin/inference-components/tiers
// ============================================================================
export const listTierAssignments: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    // Get all tier assignments for tenant's models
    const { executeStatement } = await import('../shared/db/client');
    const result = await executeStatement(
      `SELECT ta.* FROM tier_assignments ta
       JOIN model_registry mr ON ta.model_id = mr.model_id
       WHERE mr.tenant_id = $1
       ORDER BY ta.potential_savings DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const assignments = result.rows.map((row: Record<string, unknown>) => ({
      modelId: row.model_id,
      currentTier: row.current_tier,
      recommendedTier: row.recommended_tier,
      tierReason: row.tier_reason,
      requestsLast24h: Number(row.requests_last_24h || 0),
      requestsLast7d: Number(row.requests_last_7d || 0),
      avgDailyRequests: Number(row.avg_daily_requests || 0),
      lastRequestAt: row.last_request_at,
      daysSinceLastRequest: Number(row.days_since_last_request || 0),
      currentMonthlyCost: Number(row.current_monthly_cost || 0),
      projectedMonthlyCost: Number(row.projected_monthly_cost || 0),
      potentialSavings: Number(row.potential_savings || 0),
      tierOverride: row.tier_override,
      overrideReason: row.override_reason,
      overrideExpiresAt: row.override_expires_at,
      lastEvaluatedAt: row.last_evaluated_at,
    }));

    return response(200, { success: true, data: assignments });
  } catch (error) {
    logger.error('Error listing tier assignments', error);
    return response(500, { success: false, error: 'Failed to list tier assignments' });
  }
};

// ============================================================================
// GET /admin/inference-components/tiers/{modelId}
// ============================================================================
export const getTierAssignment: APIGatewayProxyHandler = async (event) => {
  try {
    const modelId = event.pathParameters?.modelId;
    if (!modelId) {
      return response(400, { success: false, error: 'modelId is required' });
    }

    const assignment = await inferenceComponentsService.getTierAssignment(modelId);
    if (!assignment) {
      return response(404, { success: false, error: 'Tier assignment not found' });
    }

    return response(200, { success: true, data: assignment });
  } catch (error) {
    logger.error('Error fetching tier assignment', error);
    return response(500, { success: false, error: 'Failed to fetch tier assignment' });
  }
};

// ============================================================================
// POST /admin/inference-components/tiers/{modelId}/evaluate
// ============================================================================
export const evaluateTier: APIGatewayProxyHandler = async (event) => {
  try {
    const modelId = event.pathParameters?.modelId;
    if (!modelId) {
      return response(400, { success: false, error: 'modelId is required' });
    }

    const assignment = await inferenceComponentsService.evaluateTier(modelId);
    return response(200, { success: true, data: assignment });
  } catch (error) {
    logger.error('Error evaluating tier', error);
    return response(500, { success: false, error: 'Failed to evaluate tier' });
  }
};

// ============================================================================
// POST /admin/inference-components/tiers/{modelId}/transition
// ============================================================================
export const transitionTier: APIGatewayProxyHandler = async (event) => {
  try {
    const modelId = event.pathParameters?.modelId;
    const body = JSON.parse(event.body || '{}');
    const { targetTier, reason } = body;

    if (!modelId) {
      return response(400, { success: false, error: 'modelId is required' });
    }

    if (!targetTier || !['hot', 'warm', 'cold', 'off'].includes(targetTier)) {
      return response(400, { success: false, error: 'Valid targetTier is required (hot, warm, cold, off)' });
    }

    const transition = await inferenceComponentsService.transitionTier(
      modelId,
      targetTier as ModelHostingTier,
      reason || 'Manual tier transition'
    );

    return response(200, { success: true, data: transition });
  } catch (error) {
    logger.error('Error transitioning tier', error);
    return response(500, { success: false, error: 'Failed to transition tier' });
  }
};

// ============================================================================
// POST /admin/inference-components/tiers/{modelId}/override
// ============================================================================
export const overrideTier: APIGatewayProxyHandler = async (event) => {
  try {
    const modelId = event.pathParameters?.modelId;
    const body = JSON.parse(event.body || '{}');
    const { tier, reason, expiresInDays } = body;
    const userId = event.requestContext.authorizer?.userId;

    if (!modelId) {
      return response(400, { success: false, error: 'modelId is required' });
    }

    if (!tier || !['hot', 'warm', 'cold', 'off'].includes(tier)) {
      return response(400, { success: false, error: 'Valid tier is required (hot, warm, cold, off)' });
    }

    const { executeStatement } = await import('../shared/db/client');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await executeStatement(
      `UPDATE tier_assignments SET
        tier_override = $2,
        override_reason = $3,
        override_expires_at = $4,
        overridden_by = $5,
        updated_at = NOW()
      WHERE model_id = $1`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'tier', value: { stringValue: tier } },
        { name: 'reason', value: { stringValue: reason || 'Admin override' } },
        { name: 'expires', value: expiresAt ? { stringValue: expiresAt } : { isNull: true } },
        { name: 'userId', value: { stringValue: userId || 'admin' } },
      ]
    );

    // Transition to the override tier
    await inferenceComponentsService.transitionTier(modelId, tier, `Override: ${reason || 'Admin override'}`);

    return response(200, { success: true, message: 'Tier override applied' });
  } catch (error) {
    logger.error('Error overriding tier', error);
    return response(500, { success: false, error: 'Failed to override tier' });
  }
};

// ============================================================================
// DELETE /admin/inference-components/tiers/{modelId}/override
// ============================================================================
export const clearTierOverride: APIGatewayProxyHandler = async (event) => {
  try {
    const modelId = event.pathParameters?.modelId;
    if (!modelId) {
      return response(400, { success: false, error: 'modelId is required' });
    }

    const { executeStatement } = await import('../shared/db/client');
    await executeStatement(
      `UPDATE tier_assignments SET
        tier_override = NULL,
        override_reason = NULL,
        override_expires_at = NULL,
        overridden_by = NULL,
        updated_at = NOW()
      WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    // Re-evaluate tier without override
    const assignment = await inferenceComponentsService.evaluateTier(modelId);

    return response(200, { success: true, data: assignment });
  } catch (error) {
    logger.error('Error clearing tier override', error);
    return response(500, { success: false, error: 'Failed to clear tier override' });
  }
};

// ============================================================================
// POST /admin/inference-components/auto-tier
// ============================================================================
export const runAutoTiering: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const result = await inferenceComponentsService.runAutoTieringJob(tenantId);
    return response(200, { success: true, data: result });
  } catch (error) {
    logger.error('Error running auto-tiering', error);
    return response(500, { success: false, error: 'Failed to run auto-tiering' });
  }
};

// ============================================================================
// GET /admin/inference-components/routing/{modelId}
// ============================================================================
export const getRoutingDecision: APIGatewayProxyHandler = async (event) => {
  try {
    const modelId = event.pathParameters?.modelId;
    if (!modelId) {
      return response(400, { success: false, error: 'modelId is required' });
    }

    const decision = await inferenceComponentsService.getRoutingDecision(modelId);
    return response(200, { success: true, data: decision });
  } catch (error) {
    logger.error('Error getting routing decision', error);
    return response(500, { success: false, error: 'Failed to get routing decision' });
  }
};
