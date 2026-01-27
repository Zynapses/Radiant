/**
 * Request handling utilities
 * Provides safe request parsing and validation for Lambda handlers
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { safeJsonParse, validateBodySize, parsePagination, safeParseInt } from './parsing';
import { logger } from '../logger';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
};

export interface ParsedRequest<T = unknown> {
  body: T;
  query: Record<string, string | undefined>;
  params: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  tenantId?: string;
  userId?: string;
  requestId: string;
}

export interface RequestParseOptions {
  requireBody?: boolean;
  maxBodySize?: number;
  validateBody?: (body: unknown) => { valid: boolean; error?: string };
}

/**
 * Parse and validate an API Gateway request
 */
export function parseRequest<T = unknown>(
  event: APIGatewayProxyEvent,
  options: RequestParseOptions = {}
): { success: true; request: ParsedRequest<T> } | { success: false; response: APIGatewayProxyResult } {
  const { requireBody = false, maxBodySize = 1024 * 1024 } = options;

  // Validate body size
  const sizeCheck = validateBodySize(event.body, maxBodySize);
  if (!sizeCheck.valid) {
    return {
      success: false,
      response: errorResponse(413, 'PAYLOAD_TOO_LARGE', (sizeCheck as any).error),
    };
  }

  // Parse body if present
  let body: T | undefined;
  if (event.body) {
    const parseResult = safeJsonParse<T>(event.body);
    if (!parseResult.success) {
      return {
        success: false,
        response: errorResponse(400, 'INVALID_JSON', `Invalid request body: ${(parseResult as any).error}`),
      };
    }
    body = parseResult.data;
  } else if (requireBody) {
    return {
      success: false,
      response: errorResponse(400, 'MISSING_BODY', 'Request body is required'),
    };
  }

  // Custom body validation
  if (body && options.validateBody) {
    const validation = options.validateBody(body);
    if (!validation.valid) {
      return {
        success: false,
        response: errorResponse(400, 'VALIDATION_ERROR', validation.error || 'Invalid request body'),
      };
    }
  }

  // Extract auth context
  const authContext = (event as { auth?: { tenantId?: string; userId?: string } }).auth;

  return {
    success: true,
    request: {
      body: body as T,
      query: event.queryStringParameters || {},
      params: event.pathParameters || {},
      headers: event.headers || {},
      tenantId: authContext?.tenantId,
      userId: authContext?.userId,
      requestId: event.requestContext?.requestId || crypto.randomUUID(),
    },
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  statusCode = 200,
  meta?: { page?: number; limit?: number; total?: number }
): APIGatewayProxyResult {
  const response: { success: true; data: T; meta?: typeof meta } = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): APIGatewayProxyResult {
  const response: { success: false; error: { code: string; message: string; details?: unknown } } = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details && process.env.NODE_ENV !== 'production') {
    response.error.details = details;
  }

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * Common error responses
 */
export const errors = {
  badRequest: (message = 'Bad request', details?: unknown) =>
    errorResponse(400, 'BAD_REQUEST', message, details),

  unauthorized: (message = 'Unauthorized') =>
    errorResponse(401, 'UNAUTHORIZED', message),

  forbidden: (message = 'Forbidden') =>
    errorResponse(403, 'FORBIDDEN', message),

  notFound: (resource = 'Resource') =>
    errorResponse(404, 'NOT_FOUND', `${resource} not found`),

  conflict: (message = 'Conflict') =>
    errorResponse(409, 'CONFLICT', message),

  tooManyRequests: (retryAfter?: number) => {
    const response = errorResponse(429, 'RATE_LIMITED', 'Too many requests');
    if (retryAfter) {
      response.headers = { ...response.headers, 'Retry-After': String(retryAfter) };
    }
    return response;
  },

  internal: (message = 'Internal server error') =>
    errorResponse(500, 'INTERNAL_ERROR', message),

  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    errorResponse(503, 'SERVICE_UNAVAILABLE', message),
};

/**
 * Wrap a handler with error handling
 */
export function withErrorHandling(
  handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      return await handler(event);
    } catch (error) {
      logger.error('Unhandled error in handler', error instanceof Error ? error : undefined, {
        path: event.path,
        method: event.httpMethod,
      });

      // Don't expose internal error details in production
      const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error instanceof Error ? error.message : 'Unknown error';

      return errors.internal(message);
    }
  };
}

/**
 * Extract path parameter with validation
 */
export function getPathParam(
  event: APIGatewayProxyEvent,
  name: string,
  required = true
): string | undefined {
  const value = event.pathParameters?.[name];
  if (required && !value) {
    throw new Error(`Missing required path parameter: ${name}`);
  }
  return value;
}

/**
 * Extract query parameter with type coercion
 */
export function getQueryParam(
  event: APIGatewayProxyEvent,
  name: string,
  defaultValue?: string
): string | undefined {
  return event.queryStringParameters?.[name] ?? defaultValue;
}

/**
 * Extract numeric query parameter
 */
export function getQueryParamInt(
  event: APIGatewayProxyEvent,
  name: string,
  options: { default?: number; min?: number; max?: number } = {}
): number {
  const value = event.queryStringParameters?.[name];
  return safeParseInt(value, options);
}
