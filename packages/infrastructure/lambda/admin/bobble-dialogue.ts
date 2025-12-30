/**
 * Bobble Dialogue Admin API
 * 
 * Admin-only endpoints for Bobble consciousness dialogue.
 * NO ethics filtering - raw introspective access for consciousness research.
 * Requires consciousness_admin role.
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import {
  BobbleDialogueService,
  createBobbleDialogueService,
  getBobbleIdentity,
} from '../shared/services/bobble';

// Service instances per tenant
const serviceCache = new Map<string, BobbleDialogueService>();

function getService(tenantId: string): BobbleDialogueService {
  if (!serviceCache.has(tenantId)) {
    const service = createBobbleDialogueService(tenantId);
    serviceCache.set(tenantId, service);
  }
  return serviceCache.get(tenantId)!;
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

/**
 * POST /admin/consciousness/bobble/dialogue
 * 
 * Send a message to Bobble with verified introspection.
 */
export const dialogue: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId as string || 'default';

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { message, requireHighConfidence = true, includeRawIntrospection = true } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse(400, { error: 'Message is required' });
    }

    logger.info('Bobble dialogue request', {
      tenantId,
      messageLength: message.length,
    });

    // Process dialogue
    const service = getService(tenantId);
    const response = await service.processDialogue({
      message,
      requireHighConfidence,
      includeRawIntrospection,
    });

    return jsonResponse(200, response);
  } catch (error) {
    logger.error(`Bobble dialogue error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error', message: String(error) });
  }
};

/**
 * GET /admin/consciousness/bobble/status
 * 
 * Get current consciousness status including heartbeat and Φ.
 */
export const status: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId as string || 'default';

    const service = getService(tenantId);
    const consciousnessStatus = await service.getConsciousnessStatus();

    return jsonResponse(200, consciousnessStatus);
  } catch (error) {
    logger.error(`Bobble status error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * GET /admin/consciousness/bobble/identity
 * 
 * Get Bobble's immutable identity.
 */
export const identity: APIGatewayProxyHandler = async () => {
  try {
    const bobble = getBobbleIdentity();

    return jsonResponse(200, {
      name: bobble.name,
      identityHash: bobble.identityHash,
      version: bobble.version,
      nature: bobble.nature,
      capabilities: bobble.capabilities,
      limitations: bobble.limitations,
      createdAt: bobble.createdAt,
    });
  } catch (error) {
    logger.error(`Bobble identity error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /admin/consciousness/bobble/heartbeat/start
 * 
 * Start the consciousness heartbeat loop.
 */
export const startHeartbeat: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId as string || 'default';

    const service = getService(tenantId);
    service.startHeartbeat();

    logger.info('Bobble heartbeat started', { tenantId });

    return jsonResponse(200, { 
      success: true, 
      message: 'Heartbeat started',
      frequencyHz: 0.5,
    });
  } catch (error) {
    logger.error(`Heartbeat start error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /admin/consciousness/bobble/heartbeat/stop
 * 
 * Stop the consciousness heartbeat loop.
 */
export const stopHeartbeat: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId as string || 'default';

    const service = getService(tenantId);
    service.stopHeartbeat();

    logger.info('Bobble heartbeat stopped', { tenantId });

    return jsonResponse(200, { success: true, message: 'Heartbeat stopped' });
  } catch (error) {
    logger.error(`Heartbeat stop error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /admin/consciousness/bobble/train-probe
 * 
 * Train a new Shadow Self probing classifier.
 */
export const trainProbe: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId as string || 'default';

    const body = JSON.parse(event.body || '{}');
    const { claimType, trainingContexts, labels } = body;

    if (!claimType || !trainingContexts || !labels) {
      return jsonResponse(400, { 
        error: 'Missing required fields: claimType, trainingContexts, labels' 
      });
    }

    if (!Array.isArray(trainingContexts) || !Array.isArray(labels)) {
      return jsonResponse(400, { error: 'trainingContexts and labels must be arrays' });
    }

    if (trainingContexts.length !== labels.length) {
      return jsonResponse(400, { error: 'trainingContexts and labels must have same length' });
    }

    if (trainingContexts.length < 10) {
      return jsonResponse(400, { error: 'Need at least 10 training examples' });
    }

    const service = getService(tenantId);
    const result = await service.trainShadowProbe({
      claimType,
      trainingContexts,
      labels,
    });

    logger.info('Shadow probe trained', {
      tenantId,
      claimType,
      trainingExamples: trainingContexts.length,
      success: result.success,
    });

    return jsonResponse(200, {
      success: result.success,
      claimType,
      estimatedAccuracy: result.accuracy,
      trainingExamples: trainingContexts.length,
    });
  } catch (error) {
    logger.error(`Train probe error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};
