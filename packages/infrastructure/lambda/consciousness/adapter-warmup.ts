/**
 * RADIANT v4.18.0 - Adapter Warm-Up Lambda
 * 
 * Proactively loads global "Cato" adapters on container boot/deployment.
 * Eliminates cold-start latency for the first user request.
 * 
 * Triggered by:
 * - CloudFormation deployment (custom resource)
 * - EventBridge schedule (every 15 minutes to keep warm)
 * - Manual invocation for testing
 * 
 * This implements Gemini's recommendation for proactive hydration:
 * "Boot: Load Cato (Global LoRA) from S3 into VRAM (Pinned/Shared)"
 */

import { Handler, ScheduledEvent, CloudFormationCustomResourceEvent } from 'aws-lambda';
import { loraInferenceService, WarmUpResult, WarmUpStatus } from '../shared/services/lora-inference.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

interface WarmUpEvent {
  action?: 'warmup' | 'status' | 'warmup-endpoint';
  endpointName?: string;
  maxAdapters?: number;
}

interface WarmUpResponse {
  statusCode: number;
  body: {
    action: string;
    result: WarmUpResult | WarmUpStatus | unknown;
    timestamp: string;
  };
}

// ============================================================================
// Handler
// ============================================================================

export const handler: Handler = async (event: WarmUpEvent | ScheduledEvent | CloudFormationCustomResourceEvent): Promise<WarmUpResponse> => {
  const startTime = Date.now();
  
  logger.info('Adapter warm-up Lambda invoked', {
    eventType: getEventType(event),
  });

  try {
    // Determine action based on event type
    const action = getAction(event);
    
    let result: WarmUpResult | WarmUpStatus | unknown;

    switch (action) {
      case 'warmup':
        logger.info('Executing global adapter warm-up');
        result = await loraInferenceService.warmUpGlobalAdapters();
        break;

      case 'warmup-endpoint':
        const endpointEvent = event as WarmUpEvent;
        if (!endpointEvent.endpointName) {
          throw new Error('endpointName required for warmup-endpoint action');
        }
        logger.info('Executing endpoint-specific warm-up', {
          endpointName: endpointEvent.endpointName,
        });
        result = await loraInferenceService.warmUpEndpoint(
          endpointEvent.endpointName,
          endpointEvent.maxAdapters
        );
        break;

      case 'status':
        logger.info('Getting warm-up status');
        result = await loraInferenceService.getWarmUpStatus();
        break;

      default:
        // Default to warm-up for scheduled events
        logger.info('Executing default warm-up (scheduled/deployment trigger)');
        result = await loraInferenceService.warmUpGlobalAdapters();
    }

    const response: WarmUpResponse = {
      statusCode: 200,
      body: {
        action,
        result,
        timestamp: new Date().toISOString(),
      },
    };

    logger.info('Adapter warm-up complete', {
      action,
      durationMs: Date.now() - startTime,
    });

    return response;

  } catch (error) {
    logger.error('Adapter warm-up failed', {
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      statusCode: 500,
      body: {
        action: 'error',
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
    };
  }
};

// ============================================================================
// Helpers
// ============================================================================

function getEventType(event: unknown): string {
  if (isScheduledEvent(event)) return 'scheduled';
  if (isCloudFormationEvent(event)) return 'cloudformation';
  if (isWarmUpEvent(event)) return 'manual';
  return 'unknown';
}

function getAction(event: unknown): string {
  // Manual invocation with explicit action
  if (isWarmUpEvent(event) && event.action) {
    return event.action;
  }
  
  // CloudFormation custom resource - always warm up
  if (isCloudFormationEvent(event)) {
    return 'warmup';
  }
  
  // Scheduled event - always warm up
  if (isScheduledEvent(event)) {
    return 'warmup';
  }
  
  // Default to warm-up
  return 'warmup';
}

function isScheduledEvent(event: unknown): event is ScheduledEvent {
  return typeof event === 'object' && event !== null && 
    'source' in event && (event as ScheduledEvent).source === 'aws.events';
}

function isCloudFormationEvent(event: unknown): event is CloudFormationCustomResourceEvent {
  return typeof event === 'object' && event !== null && 
    'RequestType' in event && 'ServiceToken' in event;
}

function isWarmUpEvent(event: unknown): event is WarmUpEvent {
  return typeof event === 'object' && event !== null && 
    ('action' in event || 'endpointName' in event);
}
