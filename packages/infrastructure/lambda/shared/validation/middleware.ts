// RADIANT v4.18.0 - Validation Middleware
// Zod-based request validation for API handlers

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z, ZodError, ZodSchema } from 'zod';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface ValidationConfig<TBody, TQuery, TPath> {
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  path?: ZodSchema<TPath>;
}

export interface ValidatedRequest<TBody = unknown, TQuery = unknown, TPath = unknown> {
  body: TBody;
  query: TQuery;
  path: TPath;
  event: APIGatewayProxyEvent;
  tenantId: string;
  userId?: string;
}

export type ValidatedHandler<TBody, TQuery, TPath> = (
  request: ValidatedRequest<TBody, TQuery, TPath>
) => Promise<APIGatewayProxyResult>;

// ============================================================================
// Error Formatting
// ============================================================================

function formatValidationError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map(e => ({
    field: e.path.join('.') || 'root',
    message: e.message,
  }));
}

function createErrorResponse(
  statusCode: number,
  message: string,
  details?: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: false,
      error: message,
      details,
    }),
  };
}

// ============================================================================
// Validation Middleware
// ============================================================================

export function validationMiddleware<
  TBody = unknown,
  TQuery = unknown,
  TPath = unknown
>(
  config: ValidationConfig<TBody, TQuery, TPath>,
  handler: ValidatedHandler<TBody, TQuery, TPath>
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Parse and validate body
      let body: TBody = {} as TBody;
      if (config.body) {
        if (!event.body) {
          return createErrorResponse(400, 'Request body is required');
        }
        try {
          const parsed = JSON.parse(event.body);
          body = config.body.parse(parsed);
        } catch (error) {
          if (error instanceof SyntaxError) {
            return createErrorResponse(400, 'Invalid JSON in request body');
          }
          if (error instanceof ZodError) {
            logger.warn('Request body validation failed', { 
              errors: formatValidationError(error),
              path: event.path,
            });
            return createErrorResponse(400, 'Validation failed', formatValidationError(error));
          }
          throw error;
        }
      }

      // Parse and validate query parameters
      let query: TQuery = {} as TQuery;
      if (config.query) {
        try {
          query = config.query.parse(event.queryStringParameters || {});
        } catch (error) {
          if (error instanceof ZodError) {
            logger.warn('Query parameter validation failed', {
              errors: formatValidationError(error),
              path: event.path,
            });
            return createErrorResponse(400, 'Invalid query parameters', formatValidationError(error));
          }
          throw error;
        }
      }

      // Parse and validate path parameters
      let path: TPath = {} as TPath;
      if (config.path) {
        try {
          path = config.path.parse(event.pathParameters || {});
        } catch (error) {
          if (error instanceof ZodError) {
            logger.warn('Path parameter validation failed', {
              errors: formatValidationError(error),
              path: event.path,
            });
            return createErrorResponse(400, 'Invalid path parameters', formatValidationError(error));
          }
          throw error;
        }
      }

      // Extract auth context
      const tenantId = event.requestContext.authorizer?.tenantId || 
                       event.requestContext.authorizer?.claims?.['custom:tenantId'] ||
                       'default';
      const userId = event.requestContext.authorizer?.userId ||
                     event.requestContext.authorizer?.claims?.sub;

      // Call the handler with validated request
      const validatedRequest: ValidatedRequest<TBody, TQuery, TPath> = {
        body,
        query,
        path,
        event,
        tenantId,
        userId,
      };

      return await handler(validatedRequest);
    } catch (error) {
      logger.error('Unhandled error in validated handler', error);
      return createErrorResponse(500, 'Internal server error');
    }
  };
}

// ============================================================================
// Decorator-style Helper
// ============================================================================

export function withValidation<TBody, TQuery, TPath>(
  config: ValidationConfig<TBody, TQuery, TPath>
) {
  return (handler: ValidatedHandler<TBody, TQuery, TPath>) => {
    return validationMiddleware(config, handler);
  };
}

// ============================================================================
// Common Response Helpers
// ============================================================================

export function successResponse<T>(data: T, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
}

export function errorResponse(
  message: string,
  statusCode = 400,
  details?: unknown
): APIGatewayProxyResult {
  return createErrorResponse(statusCode, message, details);
}

export function notFoundResponse(resource = 'Resource'): APIGatewayProxyResult {
  return createErrorResponse(404, `${resource} not found`);
}

export function unauthorizedResponse(message = 'Unauthorized'): APIGatewayProxyResult {
  return createErrorResponse(401, message);
}

export function forbiddenResponse(message = 'Forbidden'): APIGatewayProxyResult {
  return createErrorResponse(403, message);
}
