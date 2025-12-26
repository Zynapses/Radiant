/**
 * RADIANT v4.18.0 - Standardized Error Response Utilities
 * 
 * Provides consistent error response formatting across all API endpoints
 * with i18n support and proper error code propagation.
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { AppError, toAppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, RateLimitError, InternalError } from '../errors';
import { getRequestId } from './request-context';
import { logger } from '../logging/enhanced-logger';

// Response headers
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

// Configuration from environment
const CONFIG = {
  includeErrorDetails: process.env.INCLUDE_ERROR_DETAILS === 'true',
  includeStackInDev: process.env.INCLUDE_STACK_IN_DEV !== 'false',
  environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'production',
};

export interface ErrorResponseOptions {
  includeDetails?: boolean;
  includeStack?: boolean;
  additionalHeaders?: Record<string, string>;
  logError?: boolean;
}

export interface StandardErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
    timestamp: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
    stack?: string;
  };
}

export interface StandardSuccessResponse<T = unknown> {
  data: T;
  meta?: {
    requestId?: string;
    timestamp: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  options: ErrorResponseOptions = {}
): APIGatewayProxyResult {
  const requestId = getRequestId();
  const appError = toAppError(error);

  // Log the error
  if (options.logError !== false) {
    logger.error('API Error', error instanceof Error ? error : undefined, {
      code: appError.code,
      statusCode: appError.statusCode,
      requestId,
    });
  }

  const includeDetails = options.includeDetails ?? CONFIG.includeErrorDetails;
  const includeStack = options.includeStack ?? 
    (CONFIG.includeStackInDev && CONFIG.environment !== 'production');

  const isRetryable = appError.statusCode >= 500 || appError.statusCode === 429;

  const responseBody: StandardErrorResponse = {
    error: {
      code: appError.code,
      message: appError.message,
      requestId,
      timestamp: new Date().toISOString(),
      retryable: isRetryable,
    },
  };

  if (includeDetails && (appError as ValidationError).details) {
    responseBody.error.details = (appError as ValidationError).details;
  }

  if (includeStack && appError.stack) {
    responseBody.error.stack = appError.stack;
  }

  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...options.additionalHeaders,
  };

  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }

  if (isRetryable) {
    headers['Retry-After'] = '5';
  }

  return {
    statusCode: appError.statusCode,
    headers,
    body: JSON.stringify(responseBody),
  };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode = 200,
  options?: {
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
    additionalHeaders?: Record<string, string>;
  }
): APIGatewayProxyResult {
  const requestId = getRequestId();

  const responseBody: StandardSuccessResponse<T> = {
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  if (options?.pagination) {
    const { page, pageSize, total } = options.pagination;
    responseBody.meta!.pagination = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...options?.additionalHeaders,
  };

  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(responseBody),
  };
}

/**
 * Create a 201 Created response
 */
export function createCreatedResponse<T>(
  data: T,
  location?: string
): APIGatewayProxyResult {
  const headers: Record<string, string> = {};
  if (location) {
    headers['Location'] = location;
  }
  return createSuccessResponse(data, 201, { additionalHeaders: headers });
}

/**
 * Create a 204 No Content response
 */
export function createNoContentResponse(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: {
      ...DEFAULT_HEADERS,
      'X-Request-ID': getRequestId() || '',
    },
    body: '',
  };
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  message: string,
  details?: Record<string, string[]>
): APIGatewayProxyResult {
  const error = new ValidationError(message, details);
  return createErrorResponse(error);
}

/**
 * Create a not found error response
 */
export function createNotFoundResponse(resource: string, id?: string): APIGatewayProxyResult {
  const error = new NotFoundError(resource);
  return createErrorResponse(error);
}

/**
 * Create an unauthorized error response
 */
export function createUnauthorizedResponse(message = 'Authentication required'): APIGatewayProxyResult {
  const error = new UnauthorizedError(message);
  return createErrorResponse(error);
}

/**
 * Create a forbidden error response
 */
export function createForbiddenResponse(message = 'Access denied'): APIGatewayProxyResult {
  const error = new ForbiddenError(message);
  return createErrorResponse(error);
}

/**
 * Create a rate limit error response
 */
export function createRateLimitResponse(retryAfter = 60): APIGatewayProxyResult {
  const error = new RateLimitError(retryAfter);
  return createErrorResponse(error, {
    additionalHeaders: { 'Retry-After': String(retryAfter) },
  });
}

/**
 * Create an internal server error response
 */
export function createInternalErrorResponse(
  message = 'An unexpected error occurred'
): APIGatewayProxyResult {
  const error = new InternalError(message);
  return createErrorResponse(error);
}

/**
 * Handler wrapper that catches errors and returns standardized responses
 */
export function withErrorHandling<TEvent, TResult extends APIGatewayProxyResult>(
  handler: (event: TEvent) => Promise<TResult>
): (event: TEvent) => Promise<APIGatewayProxyResult> {
  return async (event: TEvent) => {
    try {
      return await handler(event);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}

/**
 * Parse request body with error handling
 */
export function parseRequestBody<T>(body: string | null): T {
  if (!body) {
    throw new ValidationError('Request body is required');
  }

  try {
    return JSON.parse(body) as T;
  } catch (parseError) {
    console.debug('JSON parse error:', parseError instanceof Error ? parseError.message : 'unknown');
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Extract path parameter with validation
 */
export function getPathParameter(
  pathParameters: Record<string, string | undefined> | null,
  name: string
): string {
  const value = pathParameters?.[name];
  if (!value) {
    throw new ValidationError(`Missing path parameter: ${name}`, { [name]: ['required'] });
  }
  return value;
}

/**
 * Extract query parameter with optional default
 */
export function getQueryParameter(
  queryParameters: Record<string, string | undefined> | null,
  name: string,
  defaultValue?: string
): string | undefined {
  return queryParameters?.[name] ?? defaultValue;
}

/**
 * Extract required query parameter
 */
export function getRequiredQueryParameter(
  queryParameters: Record<string, string | undefined> | null,
  name: string
): string {
  const value = queryParameters?.[name];
  if (!value) {
    throw new ValidationError(`Missing query parameter: ${name}`, { [name]: ['required'] });
  }
  return value;
}

export { DEFAULT_HEADERS };
