// RADIANT v4.18.0 - Liquid Interface API Handler
// "Don't Build the Tool. BE the Tool."

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { 
  liquidInterfaceService, 
  ghostStateService, 
  ejectService,
  COMPONENT_REGISTRY,
  searchComponents,
} from '../shared/services/liquid-interface';
import {
  MorphRequest,
  GhostEventRequest,
  EjectRequest,
} from '@radiant/shared';

// ============================================================================
// Response Helpers
// ============================================================================

function success(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function created(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}

function notFound(message: string): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}

function serverError(message: string): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/api\/thinktank\/liquid/, '');
  const tenantId = event.requestContext.authorizer?.tenantId || 'default';
  const userId = event.requestContext.authorizer?.userId || 'anonymous';

  logger.info('Liquid Interface API request', { method, path, tenantId });

  try {
    // Route requests
    // -------------------------------------------------------------------------
    // Component Registry
    // -------------------------------------------------------------------------
    if (path === '/registry' && method === 'GET') {
      return success({
        version: COMPONENT_REGISTRY.version,
        categories: COMPONENT_REGISTRY.categories,
        componentCount: COMPONENT_REGISTRY.components.length,
      });
    }

    if (path === '/registry/components' && method === 'GET') {
      const category = event.queryStringParameters?.category;
      const query = event.queryStringParameters?.q;

      let components = COMPONENT_REGISTRY.components;

      if (category) {
        components = components.filter(c => c.category === category);
      }

      if (query) {
        components = searchComponents(query);
      }

      return success({ components });
    }

    if (path.startsWith('/registry/components/') && method === 'GET') {
      const componentId = path.replace('/registry/components/', '');
      const component = COMPONENT_REGISTRY.byId[componentId];

      if (!component) {
        return notFound(`Component not found: ${componentId}`);
      }

      return success({ component });
    }

    // -------------------------------------------------------------------------
    // Session Management
    // -------------------------------------------------------------------------
    if (path === '/sessions' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const conversationId = body.conversationId || `conv_${Date.now()}`;

      const session = await liquidInterfaceService.createSession(
        tenantId,
        userId,
        conversationId
      );

      return created({ session });
    }

    if (path.startsWith('/sessions/') && method === 'GET') {
      const sessionId = path.replace('/sessions/', '').split('/')[0];
      const session = await liquidInterfaceService.getSession(tenantId, sessionId);

      if (!session) {
        return notFound(`Session not found: ${sessionId}`);
      }

      return success({ session });
    }

    // -------------------------------------------------------------------------
    // Morph Operations
    // -------------------------------------------------------------------------
    if (path === '/morph' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      if (!body.message) {
        return badRequest('message is required');
      }

      const request: MorphRequest = {
        tenantId,
        userId,
        sessionId: body.sessionId,
        message: body.message,
        attachments: body.attachments,
        currentState: body.currentState,
        conversationHistory: body.conversationHistory,
      };

      const response = await liquidInterfaceService.processMorphRequest(request);

      return success(response);
    }

    if (path === '/detect-intent' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      if (!body.message) {
        return badRequest('message is required');
      }

      const intent = liquidInterfaceService.detectIntent(body.message);

      return success({ intent });
    }

    if (path.startsWith('/sessions/') && path.endsWith('/revert') && method === 'POST') {
      const sessionId = path.replace('/sessions/', '').replace('/revert', '');

      const transition = await liquidInterfaceService.revertToChat(tenantId, sessionId);

      return success({ transition });
    }

    // -------------------------------------------------------------------------
    // Ghost State Operations
    // -------------------------------------------------------------------------
    if (path === '/ghost/event' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      if (!body.sessionId || !body.event) {
        return badRequest('sessionId and event are required');
      }

      const request: GhostEventRequest = {
        sessionId: body.sessionId,
        event: {
          ...body.event,
          userId,
          sessionId: body.sessionId,
          timestamp: new Date().toISOString(),
        },
      };

      const response = await liquidInterfaceService.processGhostEvent(request);

      return success(response);
    }

    if (path.startsWith('/ghost/state/') && method === 'GET') {
      const sessionId = path.replace('/ghost/state/', '');

      const snapshot = ghostStateService.getSnapshot(sessionId);

      if (!snapshot) {
        return notFound(`No ghost state for session: ${sessionId}`);
      }

      return success({ snapshot });
    }

    if (path === '/ghost/sync' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      if (!body.sessionId || !body.updates) {
        return badRequest('sessionId and updates are required');
      }

      const triggeredBindings = await ghostStateService.syncMultiple(
        body.sessionId,
        body.updates
      );

      return success({ triggeredBindings });
    }

    if (path.startsWith('/ghost/history/') && method === 'GET') {
      const sessionId = path.replace('/ghost/history/', '');
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

      const events = await ghostStateService.getEventHistory(sessionId, limit);

      return success({ events });
    }

    if (path.startsWith('/ghost/context/') && method === 'GET') {
      const sessionId = path.replace('/ghost/context/', '');

      const contextBlock = ghostStateService.buildAIContext(sessionId);

      return success({ contextBlock });
    }

    // -------------------------------------------------------------------------
    // Eject Operations
    // -------------------------------------------------------------------------
    if (path === '/eject' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      if (!body.sessionId || !body.config) {
        return badRequest('sessionId and config are required');
      }

      const request: EjectRequest = {
        sessionId: body.sessionId,
        config: body.config,
      };

      const response = await ejectService.eject(request);

      return success(response);
    }

    if (path === '/eject/preview' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      if (!body.sessionId) {
        return badRequest('sessionId is required');
      }

      // Get session to preview what would be ejected
      const session = await liquidInterfaceService.getSession(tenantId, body.sessionId);

      if (!session || !session.currentSchema) {
        return notFound('No active schema to eject');
      }

      return success({
        schema: session.currentSchema,
        estimatedFiles: 15, // Approximate
        supportedFrameworks: ['nextjs', 'vite', 'remix', 'astro'],
        features: ['database', 'auth', 'api', 'ai', 'realtime'],
      });
    }

    // -------------------------------------------------------------------------
    // Analytics
    // -------------------------------------------------------------------------
    if (path === '/analytics/usage' && method === 'GET') {
      // Component usage analytics would be fetched from database
      return success({
        totalMorphs: 0,
        totalEjects: 0,
        topComponents: [],
        topIntents: [],
      });
    }

    // -------------------------------------------------------------------------
    // Not Found
    // -------------------------------------------------------------------------
    return notFound(`Unknown endpoint: ${method} ${path}`);

  } catch (error) {
    logger.error('Liquid Interface API error', { error, method, path });
    return serverError(String(error));
  }
};
