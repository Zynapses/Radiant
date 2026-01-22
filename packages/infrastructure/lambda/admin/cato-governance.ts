/**
 * RADIANT Governance Presets Admin API Handler
 * Project Cato Integration: Variable Friction / Leash Metaphor
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { governancePresetService } from '../shared/services/governance-preset.service';
import { logger } from '../shared/logging/enhanced-logger';
import { GovernancePreset } from '@radiant/shared';

const success = (data: unknown, statusCode = 200): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

const error = (message: string, statusCode = 500): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message }),
});

const getTenantId = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.authorizer?.tenantId || 'demo-tenant';
};

const getUserId = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.authorizer?.userId || 'demo-user';
};

/**
 * GET /admin/cato/governance/config
 * Get tenant's governance configuration
 */
export const getGovernanceConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const config = await governancePresetService.getEffectiveConfig(tenantId);
    return success(config);
  } catch (err) {
    logger.error('Failed to get governance config:', err);
    return error('Failed to get governance config', 500);
  }
};

/**
 * PUT /admin/cato/governance/preset
 * Set governance preset
 */
export const setGovernancePreset: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');

    const { preset, reason } = body as { preset: GovernancePreset; reason?: string };

    if (!preset || !['paranoid', 'balanced', 'cowboy'].includes(preset)) {
      return error('Invalid preset. Must be: paranoid, balanced, or cowboy', 400);
    }

    const config = await governancePresetService.setPreset(tenantId, preset, userId, reason);
    return success(config);
  } catch (err) {
    logger.error('Failed to set governance preset:', err);
    return error('Failed to set governance preset', 500);
  }
};

/**
 * PATCH /admin/cato/governance/overrides
 * Update custom overrides for governance
 */
export const updateGovernanceOverrides: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');

    const { frictionLevel, autoApproveThreshold, checkpoints } = body;

    const config = await governancePresetService.updateCustomOverrides(tenantId, {
      frictionLevel,
      autoApproveThreshold,
      checkpoints,
    });

    return success(config);
  } catch (err) {
    logger.error('Failed to update governance overrides:', err);
    return error('Failed to update governance overrides', 500);
  }
};

/**
 * GET /admin/cato/governance/metrics
 * Get governance checkpoint metrics
 */
export const getGovernanceMetrics: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const days = parseInt(event.queryStringParameters?.days || '7');
    
    const metrics = await governancePresetService.getMetrics(tenantId, days);
    return success(metrics);
  } catch (err) {
    logger.error('Failed to get governance metrics:', err);
    return error('Failed to get governance metrics', 500);
  }
};

/**
 * GET /admin/cato/governance/history
 * Get preset change history
 */
export const getGovernanceHistory: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    
    const history = await governancePresetService.getChangeHistory(tenantId, limit);
    return success(history);
  } catch (err) {
    logger.error('Failed to get governance history:', err);
    return error('Failed to get governance history', 500);
  }
};

/**
 * POST /admin/cato/governance/checkpoint
 * Record a checkpoint decision (for testing/manual entry)
 */
export const recordCheckpoint: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');

    const decision = await governancePresetService.recordCheckpointDecision({
      tenantId,
      sessionId: body.sessionId,
      userId: body.userId,
      pipelineId: body.pipelineId,
      checkpointType: body.checkpointType,
      checkpointMode: body.checkpointMode,
      decision: body.decision,
      decidedBy: body.decidedBy,
      decisionReason: body.decisionReason,
      riskScore: body.riskScore,
      confidenceScore: body.confidenceScore,
      costEstimateCents: body.costEstimateCents,
      requestedAt: new Date(),
      decidedAt: body.decision !== 'PENDING' ? new Date() : undefined,
    });

    return success(decision, 201);
  } catch (err) {
    logger.error('Failed to record checkpoint:', err);
    return error('Failed to record checkpoint', 500);
  }
};

/**
 * GET /admin/cato/governance/checkpoints/pending
 * Get pending checkpoints for a session
 */
export const getPendingCheckpoints: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const sessionId = event.queryStringParameters?.sessionId;

    if (!sessionId) {
      return error('sessionId query parameter required', 400);
    }

    const pending = await governancePresetService.getPendingCheckpoints(tenantId, sessionId);
    return success(pending);
  } catch (err) {
    logger.error('Failed to get pending checkpoints:', err);
    return error('Failed to get pending checkpoints', 500);
  }
};

/**
 * POST /admin/cato/governance/checkpoints/{id}/resolve
 * Resolve a pending checkpoint
 */
export const resolveCheckpoint: APIGatewayProxyHandler = async (event) => {
  try {
    const checkpointId = event.pathParameters?.id;
    if (!checkpointId) {
      return error('Checkpoint ID required', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const { decision, reason, modifications, feedback } = body;

    if (!decision || !['APPROVED', 'REJECTED', 'MODIFIED'].includes(decision)) {
      return error('Invalid decision. Must be: APPROVED, REJECTED, or MODIFIED', 400);
    }

    const resolved = await governancePresetService.resolveCheckpoint(
      checkpointId,
      decision,
      'USER',
      { reason, modifications, feedback }
    );

    return success(resolved);
  } catch (err) {
    logger.error('Failed to resolve checkpoint:', err);
    return error('Failed to resolve checkpoint', 500);
  }
};

/**
 * Main handler router
 */
export const handler: APIGatewayProxyHandler = async (event, context): Promise<APIGatewayProxyResult> => {
  const path = event.path.replace(/^\/api\/admin\/cato\/governance/, '');
  const method = event.httpMethod;

  logger.info(`Governance API: ${method} ${path}`);

  // Route requests
  if (method === 'GET' && path === '/config') {
    const result = await getGovernanceConfig(event, context, () => {});
    return result as APIGatewayProxyResult;
  }
  if (method === 'PUT' && path === '/preset') {
    const result = await setGovernancePreset(event, context, () => {});
    return result as APIGatewayProxyResult;
  }
  if (method === 'PATCH' && path === '/overrides') {
    const result = await updateGovernanceOverrides(event, context, () => {});
    return result as APIGatewayProxyResult;
  }
  if (method === 'GET' && path === '/metrics') {
    const result = await getGovernanceMetrics(event, context, () => {});
    return result as APIGatewayProxyResult;
  }
  if (method === 'GET' && path === '/history') {
    const result = await getGovernanceHistory(event, context, () => {});
    return result as APIGatewayProxyResult;
  }
  if (method === 'POST' && path === '/checkpoint') {
    const result = await recordCheckpoint(event, context, () => {});
    return result as APIGatewayProxyResult;
  }
  if (method === 'GET' && path === '/checkpoints/pending') {
    const result = await getPendingCheckpoints(event, context, () => {});
    return result as APIGatewayProxyResult;
  }
  if (method === 'POST' && path.match(/^\/checkpoints\/[^/]+\/resolve$/)) {
    const result = await resolveCheckpoint(event, context, () => {});
    return result as APIGatewayProxyResult;
  }

  return error('Not found', 404);
};
