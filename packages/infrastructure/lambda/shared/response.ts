/**
 * Standardized API response helpers
 */

import type { APIGatewayProxyResult } from 'aws-lambda';
import { AppError, toAppError } from './errors.js';
import { Logger } from './logger.js';

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface ResponseMeta {
  requestId?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  timing?: {
    duration: number;
  };
}

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export function success<T>(
  data: T,
  statusCode = 200,
  meta?: ResponseMeta
): APIGatewayProxyResult {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    meta,
  };

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(response),
  };
}

export function created<T>(data: T, meta?: ResponseMeta): APIGatewayProxyResult {
  return success(data, 201, meta);
}

export function noContent(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: DEFAULT_HEADERS,
    body: '',
  };
}

export function error(
  err: AppError,
  logger?: Logger
): APIGatewayProxyResult {
  if (logger) {
    if (err.statusCode >= 500) {
      logger.error('Internal error', err);
    } else {
      logger.warn('Client error', { error: err.toJSON() });
    }
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      code: err.code,
      message: err.message,
      details: 'details' in err ? err.details : undefined,
    },
  };

  const headers: Record<string, string> = { ...DEFAULT_HEADERS };
  
  if ('retryAfter' in err && err.retryAfter) {
    headers['Retry-After'] = String(err.retryAfter);
  }

  return {
    statusCode: err.statusCode,
    headers,
    body: JSON.stringify(response),
  };
}

export function handleError(
  err: unknown,
  logger?: Logger
): APIGatewayProxyResult {
  const appError = toAppError(err);
  return error(appError, logger);
}

export function streamingHeaders(): Record<string, string> {
  return {
    ...DEFAULT_HEADERS,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
}

export function formatSSE(data: unknown, event?: string): string {
  let output = '';
  if (event) {
    output += `event: ${event}\n`;
  }
  output += `data: ${JSON.stringify(data)}\n\n`;
  return output;
}

export const successResponse = success;
export const errorResponse = handleError;

// Compatibility aliases for legacy code
export const createResponse = success;
export const createErrorResponse = handleError;

export async function streamingResponse(
  generator: () => AsyncGenerator<string, void, unknown>
): Promise<APIGatewayProxyResult> {
  const chunks: string[] = [];
  for await (const chunk of generator()) {
    chunks.push(chunk);
  }
  
  return {
    statusCode: 200,
    headers: streamingHeaders(),
    body: chunks.join(''),
  };
}
