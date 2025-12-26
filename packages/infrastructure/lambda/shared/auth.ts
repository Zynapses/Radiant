/**
 * Authentication and authorization utilities
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { UnauthorizedError, ForbiddenError } from './errors.js';
import { Logger } from './logger.js';

export interface AuthContext {
  userId: string;
  appUserId: string;
  tenantId: string;
  appId: string;
  email: string;
  roles: string[];
  groups: string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  sessionId?: string;
  tokenExpiry: number;
  environment: 'dev' | 'staging' | 'prod';
  role: string;
}

export interface TokenClaims {
  sub: string;
  email?: string;
  'cognito:username'?: string;
  'cognito:groups'?: string[];
  'custom:tenantId'?: string;
  'custom:tenant_id'?: string;
  'custom:appId'?: string;
  'custom:app_id'?: string;
  'custom:appUserId'?: string;
  'custom:app_user_id'?: string;
  'custom:role'?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export function extractAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext.authorizer?.claims as TokenClaims | undefined;
  
  if (!claims) {
    throw new UnauthorizedError('No authentication claims found');
  }

  if (claims.exp && claims.exp < Date.now() / 1000) {
    throw new UnauthorizedError('Token has expired');
  }
  
  const userId = claims.sub;
  const tenantId = claims['custom:tenantId'] || claims['custom:tenant_id'];
  const appId = claims['custom:appId'] || claims['custom:app_id'];
  const appUserId = claims['custom:appUserId'] || claims['custom:app_user_id'];
  const email = claims.email || claims['cognito:username'] || '';
  
  if (!userId) throw new UnauthorizedError('Missing user ID');
  if (!tenantId) throw new UnauthorizedError('Missing tenant ID');
  
  const resolvedAppId = appId || extractAppIdFromRoute(event) || 'default';
  const resolvedAppUserId = appUserId || userId;
  
  const routeAppId = extractAppIdFromRoute(event);
  if (routeAppId && appId && routeAppId !== appId) {
    throw new ForbiddenError(`Token app_id (${appId}) does not match route (${routeAppId})`);
  }
  
  const groups = claims['cognito:groups'] || [];
  const roles = claims['custom:role'] ? [claims['custom:role']] : [];
  
  const isAdmin = groups.some(g => 
    ['super_admin', 'admin', 'operator', 'auditor'].includes(g)
  );
  const isSuperAdmin = groups.includes('super_admin');

  const environment = (process.env.ENVIRONMENT as 'dev' | 'staging' | 'prod') || 'dev';
  const primaryRole = roles[0] || groups.find(g => ['super_admin', 'admin', 'operator', 'auditor'].includes(g)) || 'user';

  return {
    userId,
    appUserId: resolvedAppUserId,
    tenantId,
    appId: resolvedAppId,
    email,
    roles,
    groups,
    isAdmin,
    isSuperAdmin,
    tokenExpiry: claims.exp || 0,
    environment,
    role: primaryRole,
  };
}

function extractAppIdFromRoute(event: APIGatewayProxyEvent): string | null {
  const host = event.headers.Host || event.headers['host'];
  if (host) {
    const subdomain = host.split('.')[0];
    if (['thinktank', 'launchboard', 'alwaysme', 'mechanicalmaker'].includes(subdomain)) {
      return subdomain;
    }
  }
  
  const pathMatch = event.path.match(/^\/api\/(thinktank|launchboard|alwaysme|mechanicalmaker)/);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  return null;
}

export function requireRoles(auth: AuthContext, requiredRoles: string[]): void {
  const hasRole = requiredRoles.some(role => 
    auth.roles.includes(role) || auth.groups.includes(role)
  );

  if (!hasRole) {
    throw new ForbiddenError(
      `Required roles: ${requiredRoles.join(', ')}`
    );
  }
}

export function requireAdmin(auth: AuthContext): void {
  if (!auth.isAdmin) {
    throw new ForbiddenError('Admin access required');
  }
}

export function requireSuperAdmin(auth: AuthContext): void {
  if (!auth.groups.includes('super_admin')) {
    throw new ForbiddenError('Super admin access required');
  }
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['admin:*', 'billing:*', 'settings:*', 'deployments:*', 'approvals:*', 'audit:*'],
  admin: ['admin:read', 'admin:write', 'billing:read', 'settings:read', 'settings:write', 'deployments:read', 'deployments:write', 'approvals:read', 'approvals:initiate'],
  operator: ['admin:read', 'billing:read', 'settings:read', 'deployments:read'],
  auditor: ['admin:read', 'billing:read', 'audit:read'],
};

export function requirePermission(auth: AuthContext, permission: string): void {
  const userPermissions = ROLE_PERMISSIONS[auth.role] || [];
  const [category, action] = permission.split(':');
  
  const hasPermission = userPermissions.some(p => {
    if (p === permission) return true;
    if (p === `${category}:*`) return true;
    return false;
  });

  if (!hasPermission) {
    throw new ForbiddenError(`Permission '${permission}' required`);
  }
}

export function canAccessTenant(auth: AuthContext, tenantId: string): boolean {
  if (auth.groups.includes('super_admin')) {
    return true;
  }
  return auth.tenantId === tenantId;
}

export function requireTenantAccess(auth: AuthContext, tenantId: string): void {
  if (!canAccessTenant(auth, tenantId)) {
    throw new ForbiddenError('Access to tenant denied');
  }
}

export function extractApiKey(event: APIGatewayProxyEvent): string | undefined {
  return event.headers['X-Api-Key'] || event.headers['x-api-key'];
}

export function logAuthContext(auth: AuthContext, logger: Logger): void {
  logger.info('Authenticated request', {
    userId: auth.userId,
    tenantId: auth.tenantId,
    isAdmin: auth.isAdmin,
    groupCount: auth.groups.length,
  });
}

export async function extractUserFromEvent(
  event: APIGatewayProxyEvent
): Promise<AuthContext | null> {
  try {
    return extractAuthContext(event);
  } catch (error) {
    // Auth extraction failed, return null to indicate unauthenticated
    return null;
  }
}
