/**
 * Lambda Middleware System
 * 
 * Composable middleware for Lambda handlers
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export type MiddlewareHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

export type Middleware = (
  next: MiddlewareHandler
) => MiddlewareHandler;

/**
 * Compose multiple middleware functions
 */
export function compose(...middlewares: Middleware[]): Middleware {
  return (handler: MiddlewareHandler): MiddlewareHandler => {
    return middlewares.reduceRight(
      (next, middleware) => middleware(next),
      handler
    );
  };
}

/**
 * Create a handler with middleware
 */
export function withMiddleware(
  handler: MiddlewareHandler,
  ...middlewares: Middleware[]
): MiddlewareHandler {
  return compose(...middlewares)(handler);
}

// Re-export middleware
export { authMiddleware } from './auth';
export { rateLimitMiddleware } from './rate-limit';
export { loggingMiddleware } from './logging';
export { corsMiddleware } from './cors';
export { errorMiddleware } from './error';
export { validationMiddleware } from './validation';
