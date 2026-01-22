/**
 * Standardized API Response Utilities
 * 
 * Provides consistent response helpers for Lambda handlers.
 */

import type { APIGatewayProxyResult } from 'aws-lambda';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

export function createResponse<T>(
  data: T,
  statusCode = 200,
  headers?: Record<string, string>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { ...DEFAULT_HEADERS, ...headers },
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
}

export function createErrorResponse(
  message: string,
  statusCode = 500,
  code?: string,
  details?: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      success: false,
      error: {
        code: code || 'ERROR',
        message,
        details,
      },
    }),
  };
}

export function jsonResponse(
  statusCode: number,
  body: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  };
}

export function successResponse<T>(data: T): APIGatewayProxyResult {
  return createResponse(data, 200);
}

export function notFoundResponse(message = 'Not found'): APIGatewayProxyResult {
  return createErrorResponse(message, 404, 'NOT_FOUND');
}

export function badRequestResponse(message: string): APIGatewayProxyResult {
  return createErrorResponse(message, 400, 'BAD_REQUEST');
}

export function unauthorizedResponse(message = 'Unauthorized'): APIGatewayProxyResult {
  return createErrorResponse(message, 401, 'UNAUTHORIZED');
}

export function forbiddenResponse(message = 'Forbidden'): APIGatewayProxyResult {
  return createErrorResponse(message, 403, 'FORBIDDEN');
}

export function internalErrorResponse(message = 'Internal server error'): APIGatewayProxyResult {
  return createErrorResponse(message, 500, 'INTERNAL_ERROR');
}
