// RADIANT v4.18.0 - Scheduled Model Sync Lambda
// Triggered by EventBridge on configured interval
// Syncs model registry from code registries and checks health

import { ScheduledEvent, Context } from 'aws-lambda';
import { modelCoordinationService } from '../shared/services/model-coordination.service';
import { logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

interface SyncResult {
  success: boolean;
  jobId?: string;
  modelsScanned: number;
  modelsAdded: number;
  modelsUpdated: number;
  proficienciesGenerated: number;
  durationMs: number;
  errors: string[];
}

// ============================================================================
// Handler
// ============================================================================

/**
 * Scheduled Lambda handler for periodic model sync
 * Triggered by EventBridge rule based on sync_interval_minutes setting
 */
export const handler = async (
  event: ScheduledEvent,
  context: Context
): Promise<SyncResult> => {
  const startTime = Date.now();
  logger.info('Model sync scheduled job started', {
    eventTime: event.time,
    requestId: context.awsRequestId,
  });

  try {
    // Get sync config to check if enabled
    const config = await modelCoordinationService.getSyncConfig();
    
    if (!config.autoSyncEnabled) {
      logger.info('Auto sync is disabled, skipping');
      return {
        success: true,
        modelsScanned: 0,
        modelsAdded: 0,
        modelsUpdated: 0,
        proficienciesGenerated: 0,
        durationMs: Date.now() - startTime,
        errors: [],
      };
    }

    // Execute sync
    const job = await modelCoordinationService.executeSync(
      undefined, // Global sync (no tenant)
      'scheduled'
    );

    logger.info('Model sync completed', {
      jobId: job.id,
      status: job.status,
      modelsScanned: job.modelsScanned,
      modelsAdded: job.modelsAdded,
      modelsUpdated: job.modelsUpdated,
      proficienciesGenerated: job.proficienciesGenerated,
      durationMs: job.durationMs,
      errorCount: job.errors.length,
    });

    return {
      success: job.status === 'completed' || job.status === 'partial',
      jobId: job.id,
      modelsScanned: job.modelsScanned,
      modelsAdded: job.modelsAdded,
      modelsUpdated: job.modelsUpdated,
      proficienciesGenerated: job.proficienciesGenerated,
      durationMs: job.durationMs || (Date.now() - startTime),
      errors: job.errors.map((e: { message: string }) => e.message),
    };

  } catch (error) {
    logger.error('Model sync failed', error instanceof Error ? error : undefined);
    
    return {
      success: false,
      modelsScanned: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      proficienciesGenerated: 0,
      durationMs: Date.now() - startTime,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ============================================================================
// Manual Trigger Handler (for API Gateway)
// ============================================================================

/**
 * API Gateway handler for manual sync trigger
 * POST /api/admin/model-coordination/sync
 */
export const manualTriggerHandler = async (event: {
  requestContext?: { authorizer?: { userId?: string } };
  queryStringParameters?: { tenantId?: string };
}): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  const startTime = Date.now();
  const userId = event.requestContext?.authorizer?.userId;
  const tenantId = event.queryStringParameters?.tenantId;

  try {
    const job = await modelCoordinationService.executeSync(
      tenantId,
      'manual',
      userId
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Sync completed',
        job,
      }),
    };

  } catch (error) {
    logger.error('Manual sync failed', error instanceof Error ? error : undefined);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      }),
    };
  }
};
