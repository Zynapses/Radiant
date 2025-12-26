import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route Authentication Wrapper
 * 
 * Provides authentication and authorization for API routes.
 * Use this to wrap your route handlers for protected endpoints.
 */

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
}

export interface AuthenticatedRequest extends NextRequest {
  user: AuthenticatedUser;
}

type RouteHandler = (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

type AuthenticatedRouteHandler = (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

interface AuthOptions {
  requiredRoles?: string[];
  allowPublic?: boolean;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.warn('[Auth] Failed to decode JWT token:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  const tokenCookie = request.cookies.get('radiant_access_token');
  if (tokenCookie?.value) {
    return tokenCookie.value;
  }
  
  return null;
}

function extractUserFromToken(token: string): AuthenticatedUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  
  // Check expiration
  if (payload.exp && (payload.exp as number) * 1000 < Date.now()) {
    return null;
  }
  
  return {
    id: (payload.sub as string) || (payload['cognito:username'] as string) || '',
    email: (payload.email as string) || '',
    role: (payload['custom:role'] as string) || (payload.role as string) || 'user',
    tenantId: (payload['custom:tenant_id'] as string) || (payload.tenantId as string),
  };
}

/**
 * Wrap an API route handler with authentication
 * 
 * @example
 * export const GET = withAuth(async (request) => {
 *   const { user } = request;
 *   return NextResponse.json({ user });
 * });
 * 
 * @example
 * // With role requirement
 * export const DELETE = withAuth(
 *   async (request) => {
 *     return NextResponse.json({ deleted: true });
 *   },
 *   { requiredRoles: ['admin', 'super_admin'] }
 * );
 */
export function withAuth(
  handler: AuthenticatedRouteHandler,
  options: AuthOptions = {}
): RouteHandler {
  return async (request: NextRequest, context?: { params: Record<string, string> }) => {
    const { requiredRoles, allowPublic } = options;
    
    const token = getTokenFromRequest(request);
    
    // No token provided
    if (!token) {
      if (allowPublic) {
        // Allow public access but without user context
        const publicRequest = request as AuthenticatedRequest;
        publicRequest.user = { id: '', email: '', role: 'anonymous' };
        return handler(publicRequest, context);
      }
      
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }
    
    // Extract user from token
    const user = extractUserFromToken(token);
    
    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
          },
        },
        { status: 401 }
      );
    }
    
    // Check role requirements
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role)) {
        return NextResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions',
              required: requiredRoles,
              current: user.role,
            },
          },
          { status: 403 }
        );
      }
    }
    
    // Attach user to request and call handler
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = user;
    
    return handler(authenticatedRequest, context);
  };
}

/**
 * Wrap an API route handler that requires admin role
 */
export function withAdminAuth(handler: AuthenticatedRouteHandler): RouteHandler {
  return withAuth(handler, { requiredRoles: ['admin', 'super_admin'] });
}

/**
 * Wrap an API route handler that requires super admin role
 */
export function withSuperAdminAuth(handler: AuthenticatedRouteHandler): RouteHandler {
  return withAuth(handler, { requiredRoles: ['super_admin'] });
}

/**
 * Create a standardized error response
 */
export function apiError(
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status }
  );
}

/**
 * Create a standardized success response
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}
