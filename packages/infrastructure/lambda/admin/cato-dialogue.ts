/**
 * Cato Dialogue Admin API
 * 
 * Admin-only endpoints for Cato consciousness dialogue.
 * NO ethics filtering - raw introspective access for consciousness research.
 * Requires consciousness_admin role.
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import {
  CatoDialogueService,
  createCatoDialogueService,
  getCatoIdentity,
} from '../shared/services/cato';

// Service instances per tenant
const serviceCache = new Map<string, CatoDialogueService>();

function getService(tenantId: string): CatoDialogueService {
  if (!serviceCache.has(tenantId)) {
    const service = createCatoDialogueService(tenantId);
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
 * POST /admin/consciousness/cato/dialogue
 * 
 * Send a message to Cato with verified introspection.
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

    logger.info('Cato dialogue request', {
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
    logger.error(`Cato dialogue error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error', message: String(error) });
  }
};

/**
 * GET /admin/consciousness/cato/status
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
    logger.error(`Cato status error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * GET /admin/consciousness/cato/identity
 * 
 * Get Cato's immutable identity.
 */
export const identity: APIGatewayProxyHandler = async () => {
  try {
    const cato = getCatoIdentity();

    return jsonResponse(200, {
      name: cato.name,
      identityHash: cato.identityHash,
      version: cato.version,
      nature: cato.nature,
      capabilities: cato.capabilities,
      limitations: cato.limitations,
      createdAt: cato.createdAt,
    });
  } catch (error) {
    logger.error(`Cato identity error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /admin/consciousness/cato/heartbeat/start
 * 
 * Start the consciousness heartbeat loop.
 */
export const startHeartbeat: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId as string || 'default';

    const service = getService(tenantId);
    service.startHeartbeat();

    logger.info('Cato heartbeat started', { tenantId });

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
 * POST /admin/consciousness/cato/heartbeat/stop
 * 
 * Stop the consciousness heartbeat loop.
 */
export const stopHeartbeat: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId as string || 'default';

    const service = getService(tenantId);
    service.stopHeartbeat();

    logger.info('Cato heartbeat stopped', { tenantId });

    return jsonResponse(200, { success: true, message: 'Heartbeat stopped' });
  } catch (error) {
    logger.error(`Heartbeat stop error: ${String(error)}`);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /admin/consciousness/cato/train-probe
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
