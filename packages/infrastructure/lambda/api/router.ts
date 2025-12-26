/**
 * API Router Lambda Handler
 * Main entry point for all API requests
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '../shared/logger';
import { successResponse, errorResponse } from '../shared/response';
import { UnauthorizedError, NotFoundError, ValidationError } from '../shared/errors';
import { extractUserFromEvent } from '../shared/auth';
import { handleChat } from './chat';
import { handleModels } from './models';
import { handleProviders } from './providers';

const logger = new Logger({ handler: 'router' });

interface RouteHandler {
  (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>;
}

const routes: Map<string, Map<string, RouteHandler>> = new Map();

function registerRoute(method: string, pathPattern: string, handler: RouteHandler): void {
  if (!routes.has(method)) {
    routes.set(method, new Map());
  }
  routes.get(method)!.set(pathPattern, handler);
}

registerRoute('GET', '/api/v2/health', handleHealth);
registerRoute('POST', '/api/v2/chat/completions', handleChat);
registerRoute('GET', '/api/v2/models', handleModels);
registerRoute('GET', '/api/v2/models/{modelId}', handleModels);
registerRoute('GET', '/api/v2/providers', handleProviders);
registerRoute('POST', '/api/v2/usage', handleUsage);

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  logger.setRequestId(requestId);

  const startTime = Date.now();
  const method = event.httpMethod;
  const path = event.path;

  logger.info('Request received', { method, path, requestId });

  try {
    if (path !== '/api/v2/health' && path !== '/api/v2/usage') {
      const user = await extractUserFromEvent(event);
      if (!user) {
        throw new UnauthorizedError('Invalid or missing authorization token');
      }
      logger.setTenantId(user.tenantId);
      logger.setUserId(user.userId);
    }

    const routeHandler = findRouteHandler(method, path);
    if (!routeHandler) {
      throw new NotFoundError(`Route not found: ${method} ${path}`);
    }

    const result = await routeHandler(event, context);

    logger.info('Request completed', {
      method,
      path,
      statusCode: result.statusCode,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Request failed', error as Error, {
      method,
      path,
      durationMs: Date.now() - startTime,
    });

    return errorResponse(error as Error);
  }
}

function findRouteHandler(method: string, path: string): RouteHandler | null {
  const methodRoutes = routes.get(method);
  if (!methodRoutes) {
    return null;
  }

  for (const [pattern, handler] of methodRoutes) {
    if (matchPath(pattern, path)) {
      return handler;
    }
  }

  return null;
}

function matchPath(pattern: string, path: string): boolean {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  if (patternParts.length !== pathParts.length) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      continue;
    }

    if (patternPart !== pathPart) {
      return false;
    }
  }

  return true;
}

async function handleHealth(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  return successResponse({
    status: 'healthy',
    version: process.env.RADIANT_VERSION || 'unknown',
    timestamp: new Date().toISOString(),
    region: process.env.AWS_REGION,
  });
}

async function handleUsage(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  
  logger.info('Usage event recorded', {
    tenantId: body.tenant_id,
    modelId: body.model_id,
    tokens: body.total_tokens,
  });

  return successResponse({ recorded: true });
}
