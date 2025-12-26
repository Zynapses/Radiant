import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, handleError } from '../shared/response';
import { extractUserFromEvent, type AuthContext } from '../shared/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '../shared/errors';
import { autoResolveService } from '../shared/services/auto-resolve';
import { metricsCollector } from '../shared/services';

interface ResolveRequest {
  prompt: string;
  preferences?: {
    maxCost?: number;
    maxLatencyMs?: number;
    preferredProvider?: string;
    qualityLevel?: 'economy' | 'balanced' | 'premium';
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  try {
    const user = await extractUserFromEvent(event);
    if (!user) {
      return handleError(new UnauthorizedError('Authentication required'));
    }

    if (method === 'POST' && path.endsWith('/resolve')) {
      return handleResolve(event, user);
    }

    if (method === 'GET' && path.endsWith('/history')) {
      return handleGetHistory(event, user);
    }

    if (method === 'GET' && path.endsWith('/stats')) {
      return handleGetStats(user);
    }

    return handleError(new NotFoundError('Endpoint not found'));
  } catch (error) {
    console.error('Auto-resolve error:', error);
    return handleError(error);
  }
}

async function handleResolve(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as ResolveRequest;

  if (!body.prompt || typeof body.prompt !== 'string') {
    return handleError(new ValidationError('prompt is required and must be a string'));
  }

  if (body.prompt.length > 100000) {
    return handleError(new ValidationError('prompt exceeds maximum length of 100,000 characters'));
  }

  const startTime = Date.now();

  const result = await autoResolveService.resolve({
    tenantId: user.tenantId,
    userId: user.userId,
    prompt: body.prompt,
    preferences: body.preferences,
  });

  const latencyMs = Date.now() - startTime;

  metricsCollector.record({
    tenantId: user.tenantId,
    userId: user.userId,
    metricType: 'api_request',
    metricName: 'auto_resolve_request',
    value: 1,
    dimensions: {
      task_type: result.taskType,
      selected_model: result.model,
      quality_level: body.preferences?.qualityLevel || 'balanced',
    },
  });

  return success({
    model: result.model,
    provider: result.provider,
    reason: result.reason,
    estimatedCost: result.estimatedCost,
    taskType: result.taskType,
    tokenEstimate: result.tokenEstimate,
    latencyMs,
  });
}

async function handleGetHistory(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  const validLimit = Math.min(Math.max(1, limit), 100);

  const history = await autoResolveService.getHistory(user.tenantId, user.userId, validLimit);

  return success({ history });
}

async function handleGetStats(user: AuthContext): Promise<APIGatewayProxyResult> {
  const stats = await autoResolveService.getStats(user.tenantId);

  return success(stats);
}
