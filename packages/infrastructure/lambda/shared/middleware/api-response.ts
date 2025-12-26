/**
 * RADIANT v4.18.0 - Standardized API Response Formatter
 * 
 * Provides consistent response formatting with request ID propagation,
 * error handling, and CORS headers.
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { RadiantError, toRadiantError, isRadiantError } from '../errors/radiant-error';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { getRequestContext } from '../utils/request-context';

export interface ApiResponseOptions {
  statusCode?: number;
  headers?: Record<string, string>;
  requestId?: string;
  language?: string;
}

export const DEFAULT_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-ID,X-Tenant-ID,Accept-Language',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'X-Request-ID,X-RateLimit-Remaining,X-RateLimit-Reset',
  'Content-Type': 'application/json',
};

export { DEFAULT_CORS_HEADERS as corsHeaders };

/**
 * Get response headers with request ID
 */
function getResponseHeaders(
  requestId?: string,
  customHeaders?: Record<string, string>
): Record<string, string> {
  const context = getRequestContext();
  const finalRequestId = requestId || context?.requestId || generateRequestId();
  
  return {
    ...DEFAULT_CORS_HEADERS,
    'X-Request-ID': finalRequestId,
    ...customHeaders,
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
}

/**
 * Standard success response
 */
export function successResponse<T>(
  data: T,
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const { statusCode = 200, headers, requestId } = options;
  const responseHeaders = getResponseHeaders(requestId, headers);

  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify({
      success: true,
      data,
      requestId: responseHeaders['X-Request-ID'],
    }),
  };
}

/**
 * Standard created response (201)
 */
export function createdResponse<T>(
  data: T,
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  return successResponse(data, { ...options, statusCode: 201 });
}

/**
 * Standard no content response (204)
 */
export function noContentResponse(
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const { headers, requestId } = options;
  const responseHeaders = getResponseHeaders(requestId, headers);

  return {
    statusCode: 204,
    headers: responseHeaders,
    body: '',
  };
}

/**
 * Paginated list response
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function paginatedResponse<T>(
  items: T[],
  pagination: PaginationMeta,
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const { statusCode = 200, headers, requestId } = options;
  const responseHeaders = getResponseHeaders(requestId, headers);

  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify({
      success: true,
      data: items,
      pagination,
      requestId: responseHeaders['X-Request-ID'],
    }),
  };
}

/**
 * Standard error response from RadiantError
 */
export function errorResponse(
  error: RadiantError,
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const { headers, requestId } = options;
  const responseHeaders = getResponseHeaders(requestId, headers);
  const finalRequestId = responseHeaders['X-Request-ID'];

  // Log the error
  logger.error(`API Error: ${error.code}`, error, {
    requestId: finalRequestId,
    httpStatus: error.httpStatus,
    category: error.category,
  });

  return {
    statusCode: error.httpStatus,
    headers: responseHeaders,
    body: JSON.stringify({
      success: false,
      ...error.toResponse(finalRequestId),
      requestId: finalRequestId,
    }),
  };
}

/**
 * Convert any error to a standardized error response
 */
export function handleError(
  error: unknown,
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const radiantError = toRadiantError(error);
  return errorResponse(radiantError, options);
}

/**
 * Validation error response with field details
 */
export function validationErrorResponse(
  message: string,
  fieldErrors: Record<string, string[]>,
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const { headers, requestId } = options;
  const responseHeaders = getResponseHeaders(requestId, headers);
  const finalRequestId = responseHeaders['X-Request-ID'];

  return {
    statusCode: 400,
    headers: responseHeaders,
    body: JSON.stringify({
      success: false,
      error: {
        code: 'RADIANT_VAL_3001',
        message,
        details: { fieldErrors },
        retryable: false,
        timestamp: new Date().toISOString(),
        requestId: finalRequestId,
      },
      requestId: finalRequestId,
    }),
  };
}

/**
 * Rate limit error response with retry information
 */
export function rateLimitResponse(
  retryAfterSeconds: number,
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const { headers, requestId } = options;
  const responseHeaders = getResponseHeaders(requestId, {
    ...headers,
    'Retry-After': String(retryAfterSeconds),
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + retryAfterSeconds),
  });
  const finalRequestId = responseHeaders['X-Request-ID'];

  return {
    statusCode: 429,
    headers: responseHeaders,
    body: JSON.stringify({
      success: false,
      error: {
        code: 'RADIANT_RATE_5001',
        message: 'Rate limit exceeded',
        details: { retryAfterSeconds },
        retryable: true,
        timestamp: new Date().toISOString(),
        requestId: finalRequestId,
      },
      requestId: finalRequestId,
    }),
  };
}

/**
 * Not found error response
 */
export function notFoundResponse(
  resourceType: string,
  resourceId?: string,
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const { headers, requestId } = options;
  const responseHeaders = getResponseHeaders(requestId, headers);
  const finalRequestId = responseHeaders['X-Request-ID'];

  const message = resourceId
    ? `${resourceType} not found: ${resourceId}`
    : `${resourceType} not found`;

  return {
    statusCode: 404,
    headers: responseHeaders,
    body: JSON.stringify({
      success: false,
      error: {
        code: 'RADIANT_RES_4001',
        message,
        resourceType,
        resourceId,
        retryable: false,
        timestamp: new Date().toISOString(),
        requestId: finalRequestId,
      },
      requestId: finalRequestId,
    }),
  };
}

/**
 * Unauthorized error response
 */
export function unauthorizedResponse(
  message = 'Authentication required',
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const { headers, requestId } = options;
  const responseHeaders = getResponseHeaders(requestId, headers);
  const finalRequestId = responseHeaders['X-Request-ID'];

  return {
    statusCode: 401,
    headers: responseHeaders,
    body: JSON.stringify({
      success: false,
      error: {
        code: 'RADIANT_AUTH_1003',
        message,
        retryable: false,
        timestamp: new Date().toISOString(),
        requestId: finalRequestId,
      },
      requestId: finalRequestId,
    }),
  };
}

/**
 * Forbidden error response
 */
export function forbiddenResponse(
  message = 'Access denied',
  options: ApiResponseOptions = {}
): APIGatewayProxyResult {
  const { headers, requestId } = options;
  const responseHeaders = getResponseHeaders(requestId, headers);
  const finalRequestId = responseHeaders['X-Request-ID'];

  return {
    statusCode: 403,
    headers: responseHeaders,
    body: JSON.stringify({
      success: false,
      error: {
        code: 'RADIANT_AUTHZ_2001',
        message,
        retryable: false,
        timestamp: new Date().toISOString(),
        requestId: finalRequestId,
      },
      requestId: finalRequestId,
    }),
  };
}

/**
 * CORS preflight response
 */
export function corsPreflightResponse(
  allowedMethods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  maxAge = 86400
): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: {
      ...DEFAULT_CORS_HEADERS,
      'Access-Control-Allow-Methods': allowedMethods,
      'Access-Control-Max-Age': String(maxAge),
    },
    body: '',
  };
}

/**
 * Wrapper for Lambda handlers with standardized error handling
 */
export function withErrorHandling<T extends Record<string, unknown>>(
  handler: () => Promise<APIGatewayProxyResult>
): Promise<APIGatewayProxyResult> {
  return handler().catch((error) => handleError(error));
}

/**
 * Extract request ID from event headers
 */
export function extractRequestId(headers: Record<string, string | undefined>): string {
  return (
    headers['x-request-id'] ||
    headers['X-Request-ID'] ||
    headers['x-amzn-requestid'] ||
    generateRequestId()
  );
}
