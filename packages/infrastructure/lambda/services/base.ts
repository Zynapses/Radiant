/**
 * Base Service Orchestration Utilities
 * 
 * Common functionality for mid-level service Lambdas
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { executeStatement } from '../shared/db/client';
import { success as successResponse } from '../shared/response';
import { publishNotification } from '../thermal/notifier';
import { AppError } from '../shared/errors';

// Simple error response helper
function createError(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ success: false, error: { code: 'ERROR', message } }),
  };
}

const sagemakerRuntime = new SageMakerRuntimeClient({});

export type ServiceState = 'RUNNING' | 'DEGRADED' | 'DISABLED' | 'OFFLINE';

export interface ServiceContext {
  appId: string;
  environment: string;
  tenantId: string;
  userId: string;
  tier: number;
  requestId: string;
}

export interface ModelEndpoint {
  modelId: string;
  endpointName: string;
  thermalState: string;
  isAvailable: boolean;
}

export interface ServiceHealthStatus {
  serviceId: string;
  state: ServiceState;
  availableModels: string[];
  unavailableModels: string[];
  degradedReason?: string;
}

// ============================================================================
// AUTH & CONTEXT
// ============================================================================

export async function getServiceContext(
  event: APIGatewayProxyEvent
): Promise<{ context: ServiceContext } | { error: APIGatewayProxyResult }> {
  // Extract auth info from headers/authorizer
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader) {
    return { error: createError(401, 'Unauthorized') };
  }

  // JWT validation is handled by API Gateway authorizer - extract claims from authorizer context
  const authContext = event.requestContext?.authorizer as Record<string, string> | undefined;
  
  if (!authContext?.appId) {
    return { error: createError(401, 'Invalid authorization') };
  }

  return {
    context: {
      appId: authContext.appId,
      environment: authContext.environment || 'production',
      tenantId: authContext.tenantId || authContext.appId,
      userId: authContext.userId || 'anonymous',
      tier: parseInt(authContext.tier || '1', 10),
      requestId: event.requestContext?.requestId || crypto.randomUUID(),
    },
  };
}

// ============================================================================
// MODEL AVAILABILITY
// ============================================================================

export async function checkModelAvailability(
  appId: string,
  environment: string,
  modelIds: string[]
): Promise<Map<string, ModelEndpoint>> {
  const result = await executeStatement(`
    SELECT 
      ts.model_id,
      shm.name as endpoint_name,
      ts.current_state as thermal_state,
      CASE 
        WHEN ts.current_state IN ('WARM', 'HOT') THEN true
        ELSE false
      END as is_available
    FROM thermal_states ts
    JOIN self_hosted_models shm ON ts.model_id = shm.id
    WHERE ts.app_id = $1 
      AND ts.environment = $2 
      AND ts.model_id = ANY($3::text[])
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'modelIds', value: { stringValue: JSON.stringify(modelIds) } },
  ]);

  const endpoints = new Map<string, ModelEndpoint>();
  for (const row of (result.rows as unknown as ModelEndpoint[])) {
    endpoints.set(row.modelId, row);
  }

  return endpoints;
}

export async function ensureModelAvailable(
  appId: string,
  environment: string,
  modelId: string
): Promise<{ available: boolean; endpoint?: string; waitSeconds?: number }> {
  const result = await executeStatement(`
    SELECT 
      shm.name as endpoint_name,
      ts.current_state,
      ts.warmup_time_seconds
    FROM thermal_states ts
    JOIN self_hosted_models shm ON ts.model_id = shm.id
    WHERE ts.app_id = $1 AND ts.environment = $2 AND ts.model_id = $3
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'modelId', value: { stringValue: modelId } },
  ]);

  if (result.rows.length === 0) {
    return { available: false };
  }

  const state = result.rows[0] as { endpoint_name: string; current_state: string; warmup_time_seconds: number };

  if (state.current_state === 'WARM' || state.current_state === 'HOT') {
    return { available: true, endpoint: state.endpoint_name };
  }

  if (state.current_state === 'OFF') {
    return { available: false };
  }

  // Model is COLD - trigger warm-up
  await publishNotification({
    type: 'warmup_requested',
    appId,
    environment,
    modelId,
    estimatedWaitSeconds: state.warmup_time_seconds,
    timestamp: new Date().toISOString(),
  });

  return { 
    available: false, 
    waitSeconds: state.warmup_time_seconds,
  };
}

// ============================================================================
// MODEL INVOCATION
// ============================================================================

export async function invokeModel(
  endpointName: string,
  payload: unknown,
  contentType: string = 'application/json'
): Promise<{ success: boolean; data?: unknown; error?: string; latencyMs: number }> {
  const startTime = Date.now();

  try {
    const response = await sagemakerRuntime.send(new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: contentType,
      Body: Buffer.from(JSON.stringify(payload)),
    }));

    const latencyMs = Date.now() - startTime;
    const responseBody = response.Body ? JSON.parse(Buffer.from(response.Body).toString()) : null;

    return { success: true, data: responseBody, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`Model invocation failed for ${endpointName}:`, error);
    return { success: false, error: String(error), latencyMs };
  }
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

export async function recordUsage(
  context: ServiceContext,
  modelId: string,
  serviceId: string,
  operation: string,
  processingTimeMs: number,
  inputSizeBytes: number,
  outputSizeBytes: number,
  computedCost: number
): Promise<void> {
  await executeStatement(`
    INSERT INTO model_usage (
      app_id, environment, tenant_id, user_id, model_id, service_id,
      operation, processing_time_ms, input_size_bytes, output_size_bytes,
      computed_cost, request_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
  `, [
    { name: 'appId', value: { stringValue: context.appId } },
    { name: 'environment', value: { stringValue: context.environment } },
    { name: 'tenantId', value: { stringValue: context.tenantId } },
    { name: 'userId', value: { stringValue: context.userId } },
    { name: 'modelId', value: { stringValue: modelId } },
    { name: 'serviceId', value: { stringValue: serviceId } },
    { name: 'operation', value: { stringValue: operation } },
    { name: 'processingTimeMs', value: { longValue: processingTimeMs } },
    { name: 'inputSizeBytes', value: { longValue: inputSizeBytes } },
    { name: 'outputSizeBytes', value: { longValue: outputSizeBytes } },
    { name: 'computedCost', value: { stringValue: computedCost.toFixed(8) } },
    { name: 'requestId', value: { stringValue: context.requestId } },
  ]);
}

// ============================================================================
// SERVICE STATE MANAGEMENT
// ============================================================================

export async function getServiceState(
  appId: string,
  environment: string,
  serviceId: string
): Promise<ServiceHealthStatus | null> {
  const result = await executeStatement(`
    SELECT 
      service_id,
      current_state,
      available_models,
      unavailable_models,
      degraded_reason
    FROM service_states
    WHERE app_id = $1 AND environment = $2 AND service_id = $3
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'serviceId', value: { stringValue: serviceId } },
  ]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as {
    service_id: string;
    current_state: ServiceState;
    available_models: string[];
    unavailable_models: string[];
    degraded_reason: string | null;
  };

  return {
    serviceId: row.service_id,
    state: row.current_state,
    availableModels: row.available_models || [],
    unavailableModels: row.unavailable_models || [],
    degradedReason: row.degraded_reason || undefined,
  };
}

export async function updateServiceState(
  appId: string,
  environment: string,
  serviceId: string,
  state: ServiceState,
  availableModels: string[],
  unavailableModels: string[],
  degradedReason?: string
): Promise<void> {
  await executeStatement(`
    INSERT INTO service_states (
      app_id, environment, service_id, current_state, 
      available_models, unavailable_models, degraded_reason, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (app_id, environment, service_id) DO UPDATE SET
      current_state = $4,
      available_models = $5,
      unavailable_models = $6,
      degraded_reason = $7,
      updated_at = NOW()
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'serviceId', value: { stringValue: serviceId } },
    { name: 'state', value: { stringValue: state } },
    { name: 'availableModels', value: { stringValue: JSON.stringify(availableModels) } },
    { name: 'unavailableModels', value: { stringValue: JSON.stringify(unavailableModels) } },
    { name: 'degradedReason', value: degradedReason ? { stringValue: degradedReason } : { isNull: true } },
  ]);
}

// ============================================================================
// TIER VALIDATION
// ============================================================================

export function validateTier(
  requiredTier: number,
  userTier: number
): { allowed: boolean; error?: APIGatewayProxyResult } {
  if (userTier < requiredTier) {
    return {
      allowed: false,
      error: createError(403, `This feature requires Tier ${requiredTier}+. Your tier: ${userTier}`),
    };
  }
  return { allowed: true };
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

export { successResponse, createError as errorResponse };
