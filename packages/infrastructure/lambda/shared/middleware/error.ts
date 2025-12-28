/**
 * Error Handling Middleware
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Middleware, MiddlewareHandler } from './index';
import { logger } from '../logger';

/**
 * Custom error classes
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, 'bad_request', message, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(401, 'unauthorized', message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(403, 'forbidden', message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(404, 'not_found', `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, 'conflict', message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter: number) {
    super(429, 'rate_limit', 'Too many requests', { retry_after: retryAfter });
    this.name = 'RateLimitError';
  }
}

export class InsufficientCreditsError extends ApiError {
  constructor(required: number, available: number) {
    super(402, 'insufficient_credits', 'Insufficient credits', { required, available });
    this.name = 'InsufficientCreditsError';
  }
}

export class ValidationError extends ApiError {
  constructor(errors: Array<{ path: string; message: string }>) {
    super(400, 'validation_error', 'Validation failed', { errors });
    this.name = 'ValidationError';
  }
}

export class InternalError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(500, 'internal_error', message);
    this.name = 'InternalError';
  }
}

/**
 * Error handling middleware
 */
export function errorMiddleware(options: {
  includeStack?: boolean;
  onError?: (error: Error, event: APIGatewayProxyEvent) => void;
} = {}): Middleware {
  const { includeStack = false, onError } = options;

  return (next: MiddlewareHandler): MiddlewareHandler => {
    return async (event: APIGatewayProxyEvent, context: Context) => {
      try {
        return await next(event, context);
      } catch (error) {
        // Call error handler if provided
        if (onError && error instanceof Error) {
          onError(error, event);
        }

        // Handle known API errors
        if (error instanceof ApiError) {
          return {
            statusCode: error.statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: {
                code: error.code,
                message: error.message,
                details: error.details,
                ...(includeStack && { stack: error.stack }),
              },
            }),
          };
        }

        // Log unexpected errors
        logger.error('Unhandled error', error instanceof Error ? error : new Error(String(error)));

        // Return generic error for unknown errors
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: {
              code: 'internal_error',
              message: 'An unexpected error occurred',
              ...(includeStack && error instanceof Error && { stack: error.stack }),
            },
          }),
        };
      }
    };
  };
}
