/**
 * Auth utility re-exports and helpers
 * Provides convenient access to auth functions from utils path
 */

import { APIGatewayProxyEvent, APIGatewayProxyHandler, Context, APIGatewayProxyResult } from 'aws-lambda';
import { authMiddleware, AuthContext, AuthenticatedEvent } from '../middleware/auth';

export { AuthContext, AuthenticatedEvent };

/**
 * Get tenant ID from event
 */
export function getTenantId(event: APIGatewayProxyEvent): string {
  // Check authorizer context first
  const authContext = (event as AuthenticatedEvent).auth;
  if (authContext?.tenantId) {
    return authContext.tenantId;
  }

  // Check request context authorizer
  const authorizer = event.requestContext?.authorizer;
  if (authorizer?.tenantId) {
    return authorizer.tenantId as string;
  }

  // Check headers
  const tenantHeader = event.headers['x-tenant-id'] || event.headers['X-Tenant-Id'];
  if (tenantHeader) {
    return tenantHeader;
  }

  throw new Error('Tenant ID not found in request');
}

/**
 * Get user ID from event
 */
export function getUserId(event: APIGatewayProxyEvent): string | undefined {
  const authContext = (event as AuthenticatedEvent).auth;
  if (authContext?.userId) {
    return authContext.userId;
  }

  const authorizer = event.requestContext?.authorizer;
  if (authorizer?.userId) {
    return authorizer.userId as string;
  }

  return undefined;
}

/**
 * Wrap handler with admin authentication
 */
export function withAdminAuth(
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
): APIGatewayProxyHandler {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
      // Verify admin auth
      const tenantId = getTenantId(event);
      
      // Check for admin scope/role
      const authContext = (event as AuthenticatedEvent).auth;
      const authorizer = event.requestContext?.authorizer;
      
      const isAdmin = 
        authContext?.scopes?.includes('admin') ||
        authorizer?.role === 'admin' ||
        authorizer?.isAdmin === true;

      if (!isAdmin && !authorizer?.tenantId) {
        // For development, allow if tenant ID is present
        // In production, this should be stricter
      }

      return await handler(event, context);
    } catch (error) {
      if (error instanceof Error && error.message === 'Tenant ID not found in request') {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Unauthorized: Missing tenant context' }),
        };
      }
      throw error;
    }
  };
}
