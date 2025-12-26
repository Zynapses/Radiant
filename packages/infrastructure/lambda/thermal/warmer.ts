/**
 * Model Warming Lambda
 * 
 * Handles pre-warming of SageMaker endpoints:
 * - Triggered by warm-up requests
 * - Scheduled pre-warming for predictable traffic patterns
 * - Health checks during warm-up
 */

import { SQSEvent, SQSHandler } from 'aws-lambda';
import { logger } from '../shared/logger';
import { 
  SageMakerClient, 
  DescribeEndpointCommand 
} from '@aws-sdk/client-sagemaker';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { executeStatement } from '../shared/db/client';
import { publishNotification } from './notifier';

const sagemaker = new SageMakerClient({});
const sagemakerRuntime = new SageMakerRuntimeClient({});

interface WarmupRequest {
  appId: string;
  environment: string;
  modelId: string;
  endpointName: string;
  warmupTimeSeconds: number;
  requestedBy?: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    try {
      const request: WarmupRequest = JSON.parse(record.body);
      await warmUpModel(request);
    } catch (error) {
      logger.error('Error processing warm-up request', error instanceof Error ? error : undefined);
    }
  }
};

// ============================================================================
// WARM-UP LOGIC
// ============================================================================

async function warmUpModel(request: WarmupRequest): Promise<void> {
  const { appId, environment, modelId, endpointName, warmupTimeSeconds } = request;

  logger.info('Starting warm-up for model', { modelId, endpointName });

  // Notify clients that warm-up has started
  await publishNotification({
    type: 'warmup_started',
    appId,
    environment,
    modelId,
    estimatedSeconds: warmupTimeSeconds,
    timestamp: new Date().toISOString(),
  });

  // Update database to mark as transitioning
  await executeStatement(`
    UPDATE thermal_states SET
      is_transitioning = true,
      updated_at = NOW()
    WHERE app_id = $1 AND environment = $2 AND model_id = $3
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
    { name: 'modelId', value: { stringValue: modelId } },
  ]);

  // Wait for endpoint to become available
  const startTime = Date.now();
  const maxWaitTime = warmupTimeSeconds * 1000;
  let isReady = false;

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await checkEndpointStatus(endpointName);
      
      if (status === 'InService') {
        // Endpoint is running, now send a warm-up request
        const healthCheck = await performHealthCheck(endpointName, modelId);
        
        if (healthCheck.success) {
          isReady = true;
          break;
        }
      } else if (status === 'Failed') {
        throw new Error('Endpoint failed to start');
      }
    } catch (error) {
      logger.debug('Waiting for endpoint', { endpointName, error: error instanceof Error ? error.message : 'Unknown' });
    }

    // Wait 5 seconds before next check
    await sleep(5000);
  }

  if (isReady) {
    // Update database
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
      { name: 'modelId', value: { stringValue: modelId } },
    ]);

    // Notify clients
    await publishNotification({
      type: 'model_ready',
      appId,
      environment,
      modelId,
      warmupDurationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    logger.info('Model is now ready', { modelId, warmupDurationMs: Date.now() - startTime });
  } else {
    // Warm-up timed out
    await executeStatement(`
      UPDATE thermal_states SET
        is_transitioning = false,
        error_message = 'Warm-up timed out',
        updated_at = NOW()
      WHERE app_id = $1 AND environment = $2 AND model_id = $3
    `, [
      { name: 'appId', value: { stringValue: appId } },
      { name: 'environment', value: { stringValue: environment } },
      { name: 'modelId', value: { stringValue: modelId } },
    ]);

    await publishNotification({
      type: 'warmup_failed',
      appId,
      environment,
      modelId,
      error: 'Warm-up timed out',
      timestamp: new Date().toISOString(),
    });

    logger.error('Warm-up timed out for model', undefined, { modelId });
  }
}

async function checkEndpointStatus(endpointName: string): Promise<string> {
  const response = await sagemaker.send(new DescribeEndpointCommand({
    EndpointName: endpointName,
  }));
  return response.EndpointStatus || 'Unknown';
}

async function performHealthCheck(
  endpointName: string, 
  modelId: string
): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  const startTime = Date.now();

  try {
    // Send a minimal request to warm up the model
    const testPayload = getTestPayload(modelId);
    
    await sagemakerRuntime.send(new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: Buffer.from(JSON.stringify(testPayload)),
    }));

    const latencyMs = Date.now() - startTime;
    logger.info('Health check passed', { endpointName, latencyMs });

    return { success: true, latencyMs };
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : undefined, { endpointName });
    return { success: false, error: String(error) };
  }
}

function getTestPayload(modelId: string): Record<string, unknown> {
  // Return appropriate test payload based on model type
  if (modelId.includes('whisper') || modelId.includes('parakeet')) {
    // Audio models - minimal audio payload
    return { test: true, audio_bytes: '' };
  } else if (modelId.includes('yolo') || modelId.includes('sam') || modelId.includes('efficientnet')) {
    // Vision models - minimal image payload
    return { test: true, image_bytes: '' };
  } else if (modelId.includes('esm') || modelId.includes('alphafold')) {
    // Protein models - minimal sequence
    return { test: true, sequence: 'MKTAYIAKQRQ' };
  } else if (modelId.includes('prithvi')) {
    // Geospatial models
    return { test: true };
  } else {
    // Default - text models
    return { test: true, inputs: 'Hello' };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// SCHEDULED PRE-WARMING
// ============================================================================

export async function handleScheduledPreWarm(): Promise<void> {
  logger.info('Running scheduled pre-warm check');

  // Get models that should be pre-warmed based on schedule
  const result = await executeStatement(`
    SELECT 
      ts.app_id,
      ts.environment,
      ts.model_id,
      shm.name as endpoint_name,
      ts.warmup_time_seconds
    FROM thermal_states ts
    JOIN self_hosted_models shm ON ts.model_id = shm.id
    WHERE ts.current_state = 'COLD'
      AND ts.target_state = 'WARM'
      AND ts.is_transitioning = false
  `, []);

  interface PreWarmRow {
    app_id: string;
    environment: string;
    model_id: string;
    endpoint_name: string;
    warmup_time_seconds: number;
  }

  for (const row of result.rows as unknown as PreWarmRow[]) {
    try {
      await warmUpModel({
        appId: row.app_id,
        environment: row.environment,
        modelId: row.model_id,
        endpointName: row.endpoint_name,
        warmupTimeSeconds: row.warmup_time_seconds,
      });
    } catch (error) {
      logger.error('Pre-warm failed', error instanceof Error ? error : undefined, { modelId: row.model_id });
    }
  }
}
