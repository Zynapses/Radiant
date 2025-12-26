/**
 * Logging Middleware
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Middleware, MiddlewareHandler } from './index';

interface AuthenticatedEvent extends APIGatewayProxyEvent {
  auth?: {
    tenantId?: string;
    userId?: string;
  };
}

interface LogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  tenantId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  error?: string;
}

/**
 * Request/Response logging middleware
 */
export function loggingMiddleware(options: {
  logBody?: boolean;
  logHeaders?: boolean;
  skipPaths?: string[];
} = {}): Middleware {
  const { logBody = false, logHeaders = false, skipPaths = ['/health', '/metrics'] } = options;

  return (next: MiddlewareHandler): MiddlewareHandler => {
    return async (event: APIGatewayProxyEvent, context: Context) => {
      const startTime = Date.now();
      const requestId = context.awsRequestId;

      // Skip logging for certain paths
      if (skipPaths.some(p => event.path.startsWith(p))) {
        return next(event, context);
      }

      // Log request
      const requestLog: Record<string, unknown> = {
        type: 'request',
        requestId,
        method: event.httpMethod,
        path: event.path,
        query: event.queryStringParameters,
        ip: event.requestContext.identity?.sourceIp,
        userAgent: event.headers['User-Agent'] || event.headers['user-agent'],
      };

      if (logHeaders) {
        requestLog.headers = sanitizeHeaders(event.headers);
      }

      if (logBody && event.body) {
        requestLog.body = truncateBody(event.body);
      }

      console.log(JSON.stringify(requestLog));

      let response: APIGatewayProxyResult;
      let error: Error | undefined;

      try {
        response = await next(event, context);
      } catch (e) {
        error = e as Error;
        response = {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: { message: 'Internal server error' } }),
        };
      }

      const duration = Date.now() - startTime;

      // Log response
      const responseLog: LogEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: event.httpMethod,
        path: event.path,
        statusCode: response.statusCode,
        duration,
        tenantId: (event as AuthenticatedEvent).auth?.tenantId,
        userId: (event as AuthenticatedEvent).auth?.userId,
        ip: event.requestContext.identity?.sourceIp,
        userAgent: event.headers['User-Agent'] || event.headers['user-agent'],
      };

      if (error) {
        responseLog.error = error.message;
      }

      console.log(JSON.stringify({ type: 'response', ...responseLog }));

      // Add request ID to response headers
      response.headers = {
        ...response.headers,
        'X-Request-Id': requestId,
        'X-Response-Time': `${duration}ms`,
      };

      if (error) {
        throw error;
      }

      return response;
    };
  };
}

/**
 * Sanitize headers to remove sensitive data
 */
function sanitizeHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Truncate body for logging
 */
function truncateBody(body: string, maxLength: number = 1000): string {
  if (body.length <= maxLength) {
    return body;
  }
  return body.substring(0, maxLength) + '...[truncated]';
}

/**
 * Structured logger
 */
export const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, ...data, timestamp: new Date().toISOString() }));
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...data, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error?: Error, data?: Record<string, unknown>) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message,
      stack: error?.stack,
      ...data,
      timestamp: new Date().toISOString(),
    }));
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(JSON.stringify({ level: 'debug', message, ...data, timestamp: new Date().toISOString() }));
    }
  },
};
