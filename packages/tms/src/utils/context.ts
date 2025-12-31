/**
 * RADIANT TMS - Context Utilities
 * Shared context extraction for Lambda handlers
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { TmsContext } from '../types/tenant.types';

export function extractContext(event: APIGatewayProxyEvent): TmsContext {
  const authHeader = event.headers['Authorization'] || event.headers['authorization'] || '';
  const isInternalService = authHeader.startsWith('Internal-Service-Token ');
  
  return {
    adminId: event.headers['x-admin-id'] || undefined,
    userId: event.headers['x-user-id'] || undefined,
    tenantId: event.headers['x-tenant-id'] || undefined,
    isSuperAdmin: isInternalService || event.headers['x-is-super-admin'] === 'true',
    ipAddress: event.requestContext?.identity?.sourceIp || undefined,
    userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || undefined,
    traceId: event.headers['X-Trace-Id'] || event.headers['x-trace-id'] || undefined,
  };
}

export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',');
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Trace-Id,X-Tenant-Id,X-User-Id,X-Admin-Id',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json',
  };
}

export function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function errorResponse(
  statusCode: number,
  error: string,
  message: string,
  corsHeaders: Record<string, string>,
  details?: unknown
): { statusCode: number; headers: Record<string, string>; body: string } {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({
      error,
      message,
      ...(details ? { details } : {}),
    }),
  };
}

export function successResponse(
  statusCode: number,
  data: unknown,
  corsHeaders: Record<string, string>,
  message?: string
): { statusCode: number; headers: Record<string, string>; body: string } {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      data,
      ...(message ? { message } : {}),
    }),
  };
}
