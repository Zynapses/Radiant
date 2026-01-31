// RADIANT v5.2.4 - Scheduled Model Sync Lambda
// Triggered by EventBridge on configured interval
// Syncs model registry from code registries, discovers new versions, and processes deletions

import { ScheduledEvent, Context } from 'aws-lambda';
import { modelCoordinationService } from '../shared/services/model-coordination.service';
import { huggingfaceDiscoveryService } from '../shared/services/huggingface-discovery.service';
import { modelDeletionQueueService } from '../shared/services/model-deletion-queue.service';
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
  discovery?: {
    ran: boolean;
    modelsDiscovered: number;
    modelsAdded: number;
  };
  deletionQueue?: {
    processed: number;
    unblocked: number;
  };
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

    // Run HuggingFace discovery if enabled
    let discoveryResult = { ran: false, modelsDiscovered: 0, modelsAdded: 0 };
    if (config.syncFromHuggingFace) {
      try {
        logger.info('Running HuggingFace discovery');
        const discoveryJob = await huggingfaceDiscoveryService.runDiscovery();
        discoveryResult = {
          ran: true,
          modelsDiscovered: discoveryJob.modelsDiscovered,
          modelsAdded: discoveryJob.modelsAdded,
        };
        logger.info('HuggingFace discovery completed', discoveryResult);
      } catch (discoveryError) {
        logger.error('HuggingFace discovery failed', discoveryError instanceof Error ? discoveryError : undefined);
        job.errors.push({ 
          errorType: 'unknown',
          message: `Discovery failed: ${discoveryError instanceof Error ? discoveryError.message : 'Unknown error'}`,
          timestamp: new Date(),
        });
      }
    }

    // Process deletion queue
    let deletionResult = { processed: 0, unblocked: 0 };
    try {
      // Refresh blocked items that may now be ready
      deletionResult.unblocked = await modelDeletionQueueService.refreshBlockedItems();
      
      // Process pending deletions (up to 5 per run)
      for (let i = 0; i < 5; i++) {
        const processed = await modelDeletionQueueService.processNextInQueue();
        if (!processed) break;
        deletionResult.processed++;
      }
      
      if (deletionResult.processed > 0 || deletionResult.unblocked > 0) {
        logger.info('Deletion queue processed', deletionResult);
      }
    } catch (deletionError) {
      logger.error('Deletion queue processing failed', deletionError instanceof Error ? deletionError : undefined);
    }

    return {
      success: job.status === 'completed' || job.status === 'partial',
      jobId: job.id,
      modelsScanned: job.modelsScanned,
      modelsAdded: job.modelsAdded,
      modelsUpdated: job.modelsUpdated,
      proficienciesGenerated: job.proficienciesGenerated,
      durationMs: job.durationMs || (Date.now() - startTime),
      errors: job.errors.map((e: { message: string }) => e.message),
      discovery: discoveryResult,
      deletionQueue: deletionResult,
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
