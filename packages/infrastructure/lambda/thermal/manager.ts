/**
 * Thermal State Manager Lambda
 * 
 * Manages thermal states for self-hosted SageMaker models:
 * - OFF: Completely disabled, no instances
 * - COLD: Scales to zero when idle, on-demand warm-up
 * - WARM: Minimum instances always running
 * - HOT: Pre-scaled for high traffic
 * - AUTOMATIC: AI-managed scaling based on metrics
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { 
  SageMakerClient, 
  DescribeEndpointCommand,
  UpdateEndpointWeightsAndCapacitiesCommand 
} from '@aws-sdk/client-sagemaker';
import { executeStatement } from '../shared/db/client';
import { logger } from '../shared/logger';
import { extractAuthContext, AuthContext } from '../shared/auth';
import { ForbiddenError } from '../shared/errors';

const sagemaker = new SageMakerClient({});

// ============================================================================
// AUTH HELPERS
// ============================================================================

interface AuthResult {
  valid: true;
  appId: string;
  environment: string;
  userId: string;
  context: AuthContext;
}

interface AuthFailure {
  valid: false;
}

function verifyToken(event: APIGatewayProxyEvent): AuthResult | AuthFailure {
  try {
    const context = extractAuthContext(event);
    return { 
      valid: true, 
      appId: context.appId,
      environment: context.environment,
      userId: context.userId,
      context 
    };
  } catch (error) {
    // Auth validation failed
    return { valid: false };
  }
}

function requirePermission(auth: AuthResult, permission: string): void {
  if (auth.context.isSuperAdmin) return;
  
  const [resource, action] = permission.split(':');
  const hasPermission = auth.context.roles.some(role => {
    if (role === 'admin') return true;
    if (role === 'operator' && action === 'read') return true;
    return false;
  });
  
  if (!hasPermission) {
    throw new ForbiddenError(`Permission denied: ${permission}`);
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function jsonResponse<T>(statusCode: number, data: T): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify({ success: true, data }),
  };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ success: false, error: { message } }),
  };
}

// ============================================================================
// NOTIFICATION HELPER
// ============================================================================

interface ThermalNotification {
  type: string;
  appId: string;
  environment: string;
  modelId: string;
  timestamp: string;
  [key: string]: unknown;
}

async function publishNotification(notification: ThermalNotification): Promise<void> {
  logger.info('Thermal notification', { notificationType: notification.type, appId: notification.appId, modelId: notification.modelId });
}

export type ThermalState = 'OFF' | 'COLD' | 'WARM' | 'HOT' | 'AUTOMATIC';

interface ThermalStateRecord {
  app_id: string;
  environment: string;
  model_id: string;
  current_state: ThermalState;
  target_state: ThermalState;
  instance_count: number;
  min_instances: number;
  max_instances: number;
  last_activity: string | null;
  last_state_change: string;
  scale_to_zero_after_minutes: number;
  warmup_time_seconds: number;
  is_transitioning: boolean;
  error_message: string | null;
}

interface ModelInfo {
  id: string;
  name: string;
  display_name: string;
  endpoint_name: string | null;
  instance_type: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handler(
  event: APIGatewayProxyEvent | ScheduledEvent
): Promise<APIGatewayProxyResult | void> {
  // Check if this is a scheduled event
  if ('source' in event && event.source === 'aws.events') {
    return handleScheduledCheck();
  }

  const apiEvent = event as APIGatewayProxyEvent;
  const method = apiEvent.httpMethod;
  const path = apiEvent.path;

  try {
    // GET /thermal/models - List all models with thermal states
    if (method === 'GET' && path === '/thermal/models') {
      return await handleListModels(apiEvent);
    }

    // GET /thermal/models/:id - Get specific model thermal state
    if (method === 'GET' && path.match(/^\/thermal\/models\/[\w-]+$/)) {
      const modelId = path.split('/').pop()!;
      return await handleGetModel(apiEvent, modelId);
    }

    // PUT /thermal/models/:id - Update thermal state (admin)
    if (method === 'PUT' && path.match(/^\/thermal\/models\/[\w-]+$/)) {
      const modelId = path.split('/').pop()!;
      return await handleUpdateState(apiEvent, modelId);
    }

    // POST /thermal/bulk - Bulk update thermal states
    if (method === 'POST' && path === '/thermal/bulk') {
      return await handleBulkUpdate(apiEvent);
    }

    // POST /thermal/warm/:id - Request model warm-up (API users)
    if (method === 'POST' && path.match(/^\/thermal\/warm\/[\w-]+$/)) {
      const modelId = path.split('/').pop()!;
      return await handleWarmModel(apiEvent, modelId);
    }

    // GET /thermal/metrics - Get summary metrics
    if (method === 'GET' && path === '/thermal/metrics') {
      return await handleGetMetrics(apiEvent);
    }

    return errorResponse(404, 'Not found');
  } catch (error) {
    logger.error('Thermal manager error', error instanceof Error ? error : undefined);
    return errorResponse(500, 'Internal server error');
  }
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

async function handleListModels(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const auth = await verifyToken(event);
  if (!auth.valid) {
    return errorResponse(401, 'Unauthorized');
  }

  await requirePermission(auth, 'settings:read');

  const { appId, environment } = auth;

  const result = await executeStatement(`
    SELECT 
      ts.*,
      shm.name,
      shm.display_name,
      shm.category,
      shm.instance_type,
      shm.hourly_rate
    FROM thermal_states ts
    JOIN self_hosted_models shm ON ts.model_id = shm.id
    WHERE ts.app_id = $1 AND ts.environment = $2
    ORDER BY shm.category, shm.name
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
  ]);

  return jsonResponse(200, { models: result.rows });
}

async function handleGetModel(
  event: APIGatewayProxyEvent, 
  modelId: string
): Promise<APIGatewayProxyResult> {
  const auth = await verifyToken(event);
  if (!auth.valid) {
    return errorResponse(401, 'Unauthorized');
  }

  await requirePermission(auth, 'settings:read');

  const { appId, environment } = auth;

  const result = await executeStatement(`
    SELECT 
      ts.*,
      shm.name,
      shm.display_name,
      shm.category,
      shm.specialty,
      shm.instance_type,
      shm.hourly_rate,
      shm.capabilities,
      shm.input_formats,
      shm.output_formats
    FROM thermal_states ts
    JOIN self_hosted_models shm ON ts.model_id = shm.id
    WHERE ts.app_id = $1 AND ts.environment = $2 AND ts.model_id = $3
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'modelId', value: { stringValue: modelId } },
  ]);

  if (result.rows.length === 0) {
    return errorResponse(404, 'Model not found');
  }

  const model = result.rows[0] as unknown as ThermalStateRecord & ModelInfo;

  // Get recent metrics
  const metricsResult = await executeStatement(`
    SELECT 
      COUNT(*) as request_count,
      AVG(processing_time_ms) as avg_latency_ms,
      SUM(computed_cost) as total_cost
    FROM model_usage
    WHERE model_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
  `, [
    { name: 'modelId', value: { stringValue: modelId } },
  ]);

  return jsonResponse(200, {
    model,
    metrics: metricsResult.rows[0] || {},
  });
}

async function handleUpdateState(
  event: APIGatewayProxyEvent,
  modelId: string
): Promise<APIGatewayProxyResult> {
  const auth = await verifyToken(event);
  if (!auth.valid) {
    return errorResponse(401, 'Unauthorized');
  }

  await requirePermission(auth, 'settings:write');

  const { appId, environment, userId } = auth;
  const body = JSON.parse(event.body || '{}');
  const { targetState, minInstances, maxInstances, scaleToZeroAfterMinutes } = body;

  if (!targetState || !['OFF', 'COLD', 'WARM', 'HOT', 'AUTOMATIC'].includes(targetState)) {
    return errorResponse(400, 'Invalid target state');
  }

  // Update the thermal state
  await executeStatement(`
    UPDATE thermal_states SET
      target_state = $4,
      min_instances = COALESCE($5, min_instances),
      max_instances = COALESCE($6, max_instances),
      scale_to_zero_after_minutes = COALESCE($7, scale_to_zero_after_minutes),
      is_transitioning = true,
      updated_at = NOW(),
      updated_by = $8
    WHERE app_id = $1 AND environment = $2 AND model_id = $3
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'modelId', value: { stringValue: modelId } },
    { name: 'targetState', value: { stringValue: targetState } },
    { name: 'minInstances', value: minInstances ? { longValue: minInstances } : { isNull: true } },
    { name: 'maxInstances', value: maxInstances ? { longValue: maxInstances } : { isNull: true } },
    { name: 'scaleToZero', value: scaleToZeroAfterMinutes ? { longValue: scaleToZeroAfterMinutes } : { isNull: true } },
    { name: 'userId', value: { stringValue: userId } },
  ]);

  // Trigger the state transition
  await transitionThermalState(appId, environment, modelId, targetState);

  // Notify clients
  await publishNotification({
    type: 'thermal_state_change',
    appId,
    environment,
    modelId,
    targetState,
    timestamp: new Date().toISOString(),
  });

  return jsonResponse(200, { success: true, targetState });
}

async function handleBulkUpdate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const auth = await verifyToken(event);
  if (!auth.valid) {
    return errorResponse(401, 'Unauthorized');
  }

  await requirePermission(auth, 'settings:write');

  const { appId, environment, userId } = auth;
  const body = JSON.parse(event.body || '{}');
  const { updates } = body;

  if (!Array.isArray(updates)) {
    return errorResponse(400, 'Updates must be an array');
  }

  const results: { modelId: string; success: boolean; error?: string }[] = [];

  for (const update of updates) {
    try {
      await executeStatement(`
        UPDATE thermal_states SET
          target_state = $4,
          is_transitioning = true,
          updated_at = NOW(),
          updated_by = $5
        WHERE app_id = $1 AND environment = $2 AND model_id = $3
      `, [
        { name: 'appId', value: { stringValue: appId } },
        { name: 'environment', value: { stringValue: environment } },
        { name: 'modelId', value: { stringValue: update.modelId } },
        { name: 'targetState', value: { stringValue: update.targetState } },
        { name: 'userId', value: { stringValue: userId } },
      ]);

      await transitionThermalState(appId, environment, update.modelId, update.targetState);
      results.push({ modelId: update.modelId, success: true });
    } catch (error) {
      results.push({ modelId: update.modelId, success: false, error: String(error) });
    }
  }

  return jsonResponse(200, { results });
}

async function handleWarmModel(
  event: APIGatewayProxyEvent,
  modelId: string
): Promise<APIGatewayProxyResult> {
  const auth = await verifyToken(event);
  if (!auth.valid) {
    return errorResponse(401, 'Unauthorized');
  }

  const { appId, environment } = auth;

  // Check current state
  const result = await executeStatement(`
    SELECT current_state, target_state, warmup_time_seconds
    FROM thermal_states
    WHERE app_id = $1 AND environment = $2 AND model_id = $3
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'modelId', value: { stringValue: modelId } },
  ]);

  if (result.rows.length === 0) {
    return errorResponse(404, 'Model not found');
  }

  const state = result.rows[0] as unknown as ThermalStateRecord;

  // If already warm or hot, return immediately
  if (state.current_state === 'WARM' || state.current_state === 'HOT') {
    return jsonResponse(200, { 
      status: 'ready',
      estimatedWaitSeconds: 0,
    });
  }

  // If OFF, cannot warm
  if (state.current_state === 'OFF') {
    return errorResponse(400, 'Model is disabled and cannot be warmed');
  }

  // Request warm-up
  await transitionThermalState(appId, environment, modelId, 'WARM');

  // Notify clients
  await publishNotification({
    type: 'warmup_requested',
    appId,
    environment,
    modelId,
    estimatedWaitSeconds: state.warmup_time_seconds,
    timestamp: new Date().toISOString(),
  });

  return jsonResponse(202, {
    status: 'warming',
    estimatedWaitSeconds: state.warmup_time_seconds,
  });
}

async function handleGetMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const auth = await verifyToken(event);
  if (!auth.valid) {
    return errorResponse(401, 'Unauthorized');
  }

  await requirePermission(auth, 'settings:read');

  const { appId, environment } = auth;

  // Get thermal state distribution
  const statesResult = await executeStatement(`
    SELECT current_state, COUNT(*) as count
    FROM thermal_states
    WHERE app_id = $1 AND environment = $2
    GROUP BY current_state
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
  ]);

  // Get hourly cost estimate
  const costResult = await executeStatement(`
    SELECT SUM(shm.hourly_rate * ts.instance_count) as estimated_hourly_cost
    FROM thermal_states ts
    JOIN self_hosted_models shm ON ts.model_id = shm.id
    WHERE ts.app_id = $1 AND ts.environment = $2 AND ts.instance_count > 0
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
  ]);

  // Get transitioning count
  const transitioningResult = await executeStatement(`
    SELECT COUNT(*) as transitioning_count
    FROM thermal_states
    WHERE app_id = $1 AND environment = $2 AND is_transitioning = true
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
  ]);

  return jsonResponse(200, {
    stateDistribution: statesResult.rows,
    estimatedHourlyCost: (costResult.rows[0] as Record<string, unknown>)?.estimated_hourly_cost || 0,
    transitioningCount: (transitioningResult.rows[0] as Record<string, unknown>)?.transitioning_count || 0,
  });
}

// ============================================================================
// SCHEDULED HANDLER
// ============================================================================

async function handleScheduledCheck(): Promise<void> {
  logger.info('Running scheduled thermal state check');

  // Get all apps with self-hosted models
  const appsResult = await executeStatement(`
    SELECT DISTINCT app_id, environment FROM thermal_states
  `, []);

  for (const row of appsResult.rows as { app_id: string; environment: string }[]) {
    await checkAndUpdateThermalStates(row.app_id, row.environment);
  }
}

async function checkAndUpdateThermalStates(appId: string, environment: string): Promise<void> {
  // Get models in AUTOMATIC mode or due for scale-to-zero
  const result = await executeStatement(`
    SELECT 
      ts.*,
      shm.name as endpoint_name
    FROM thermal_states ts
    JOIN self_hosted_models shm ON ts.model_id = shm.id
    WHERE ts.app_id = $1 AND ts.environment = $2
      AND (
        ts.current_state = 'AUTOMATIC'
        OR (ts.current_state IN ('WARM', 'HOT') 
            AND ts.last_activity < NOW() - (ts.scale_to_zero_after_minutes || ' minutes')::INTERVAL)
      )
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
  ]);

  for (const state of result.rows as unknown as (ThermalStateRecord & { endpoint_name: string })[]) {
    try {
      if (state.current_state === 'AUTOMATIC') {
        await handleAutomaticScaling(appId, environment, state);
      } else {
        // Scale to zero due to inactivity
        await transitionThermalState(appId, environment, state.model_id, 'COLD');
        await publishNotification({
          type: 'scaled_to_zero',
          appId,
          environment,
          modelId: state.model_id,
          reason: 'inactivity',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error checking thermal state', error instanceof Error ? error : undefined, { modelId: state.model_id });
    }
  }

  // Check transitioning models
  await checkTransitioningModels(appId, environment);
}

async function handleAutomaticScaling(
  appId: string,
  environment: string,
  state: ThermalStateRecord & { endpoint_name: string }
): Promise<void> {
  // Get recent request rate
  const metricsResult = await executeStatement(`
    SELECT COUNT(*) as request_count
    FROM model_usage
    WHERE model_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'
  `, [
    { name: 'modelId', value: { stringValue: state.model_id } },
  ]);

  const requestCount = parseInt(String((metricsResult.rows[0] as Record<string, unknown>)?.request_count || 0), 10);
  const requestsPerMinute = requestCount / 5;

  // Determine target instance count based on load
  let targetInstances: number;
  if (requestsPerMinute === 0) {
    targetInstances = 0;
  } else if (requestsPerMinute < 5) {
    targetInstances = Math.max(state.min_instances, 1);
  } else if (requestsPerMinute < 20) {
    targetInstances = Math.min(state.max_instances, Math.max(2, state.min_instances));
  } else {
    targetInstances = state.max_instances;
  }

  // Only update if different
  if (targetInstances !== state.instance_count) {
    await scaleEndpoint(state.endpoint_name, targetInstances);
    await executeStatement(`
      UPDATE thermal_states SET
        instance_count = $4,
        updated_at = NOW()
      WHERE app_id = $1 AND environment = $2 AND model_id = $3
    `, [
      { name: 'appId', value: { stringValue: appId } },
      { name: 'environment', value: { stringValue: environment } },
      { name: 'modelId', value: { stringValue: state.model_id } },
      { name: 'instanceCount', value: { longValue: targetInstances } },
    ]);
  }
}

async function checkTransitioningModels(appId: string, environment: string): Promise<void> {
  const result = await executeStatement(`
    SELECT ts.*, shm.name as endpoint_name
    FROM thermal_states ts
    JOIN self_hosted_models shm ON ts.model_id = shm.id
    WHERE ts.app_id = $1 AND ts.environment = $2 AND ts.is_transitioning = true
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
  ]);

  for (const state of result.rows as unknown as (ThermalStateRecord & { endpoint_name: string })[]) {
    try {
      const endpointStatus = await getEndpointStatus(state.endpoint_name);
      
      if (endpointStatus === 'InService') {
        // Transition complete
        await executeStatement(`
          UPDATE thermal_states SET
            current_state = target_state,
            is_transitioning = false,
            last_state_change = NOW(),
            error_message = NULL,
            updated_at = NOW()
          WHERE app_id = $1 AND environment = $2 AND model_id = $3
        `, [
          { name: 'appId', value: { stringValue: appId } },
          { name: 'environment', value: { stringValue: environment } },
          { name: 'modelId', value: { stringValue: state.model_id } },
        ]);

        await publishNotification({
          type: 'model_ready',
          appId,
          environment,
          modelId: state.model_id,
          state: state.target_state,
          timestamp: new Date().toISOString(),
        });
      } else if (endpointStatus === 'Failed') {
        await executeStatement(`
          UPDATE thermal_states SET
            is_transitioning = false,
            error_message = 'Endpoint failed to start',
            updated_at = NOW()
          WHERE app_id = $1 AND environment = $2 AND model_id = $3
        `, [
          { name: 'appId', value: { stringValue: appId } },
          { name: 'environment', value: { stringValue: environment } },
          { name: 'modelId', value: { stringValue: state.model_id } },
        ]);
      }
    } catch (error) {
      logger.error('Error checking transition', error instanceof Error ? error : undefined, { modelId: state.model_id });
    }
  }
}

// ============================================================================
// SAGEMAKER HELPERS
// ============================================================================

async function transitionThermalState(
  appId: string,
  environment: string,
  modelId: string,
  targetState: ThermalState
): Promise<void> {
  // Get model endpoint info
  const result = await executeStatement(`
    SELECT shm.name as endpoint_name, ts.current_state, ts.min_instances
    FROM thermal_states ts
    JOIN self_hosted_models shm ON ts.model_id = shm.id
    WHERE ts.app_id = $1 AND ts.environment = $2 AND ts.model_id = $3
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'modelId', value: { stringValue: modelId } },
  ]);

  if (result.rows.length === 0) {
    throw new Error('Model not found');
  }

  const { endpoint_name, min_instances } = result.rows[0] as { endpoint_name: string; min_instances: number };

  // Determine target instance count
  let targetInstances: number;
  switch (targetState) {
    case 'OFF':
    case 'COLD':
      targetInstances = 0;
      break;
    case 'WARM':
      targetInstances = Math.max(1, min_instances);
      break;
    case 'HOT':
      targetInstances = Math.max(2, min_instances);
      break;
    case 'AUTOMATIC':
      targetInstances = 1; // Start with 1, auto-scaling will adjust
      break;
    default:
      targetInstances = 0;
  }

  // Scale the endpoint
  await scaleEndpoint(endpoint_name, targetInstances);

  // Update the database
  await executeStatement(`
    UPDATE thermal_states SET
      target_state = $4,
      instance_count = $5,
      is_transitioning = true,
      updated_at = NOW()
    WHERE app_id = $1 AND environment = $2 AND model_id = $3
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'modelId', value: { stringValue: modelId } },
    { name: 'targetState', value: { stringValue: targetState } },
    { name: 'instanceCount', value: { longValue: targetInstances } },
  ]);
}

async function scaleEndpoint(endpointName: string, instanceCount: number): Promise<void> {
  try {
    await sagemaker.send(new UpdateEndpointWeightsAndCapacitiesCommand({
      EndpointName: endpointName,
      DesiredWeightsAndCapacities: [
        {
          VariantName: 'AllTraffic',
          DesiredInstanceCount: instanceCount,
        },
      ],
    }));
  } catch (error) {
    logger.error('Failed to scale endpoint', error instanceof Error ? error : undefined, { endpointName });
    throw error;
  }
}

async function getEndpointStatus(endpointName: string): Promise<string> {
  try {
    const response = await sagemaker.send(new DescribeEndpointCommand({
      EndpointName: endpointName,
    }));
    return response.EndpointStatus || 'Unknown';
  } catch (error) {
    logger.error('Failed to get endpoint status', error instanceof Error ? error : undefined, { endpointName });
    return 'Unknown';
  }
}
