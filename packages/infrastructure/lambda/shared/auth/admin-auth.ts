/**
 * Admin Authentication Helpers
 * 
 * Shared utilities for admin endpoint authentication.
 * Consolidates duplicated requireAdmin/requireSuperAdmin functions.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { extractAuthContext, requireAdmin as verifyAdmin, requireSuperAdmin as verifySuperAdmin } from '../auth';

export interface AdminInfo {
  id: string;
  tenantId: string;
  role?: string;
}

/**
 * Extract and verify admin authentication from an API Gateway event.
 * Throws UnauthorizedError or ForbiddenError if auth fails.
 */
export async function requireAdmin(event: APIGatewayProxyEvent): Promise<AdminInfo> {
  const auth = extractAuthContext(event);
  verifyAdmin(auth);
  return { id: auth.userId, tenantId: auth.tenantId, role: auth.role };
}

/**
 * Extract and verify super admin authentication from an API Gateway event.
 * Throws UnauthorizedError or ForbiddenError if auth fails.
 */
export async function requireSuperAdmin(event: APIGatewayProxyEvent): Promise<AdminInfo> {
  const auth = extractAuthContext(event);
  verifySuperAdmin(auth);
  return { id: auth.userId, tenantId: auth.tenantId, role: auth.role };
}

/**
 * Extract admin info without throwing - returns null if not authenticated.
 */
export async function getAdminIfAuthenticated(event: APIGatewayProxyEvent): Promise<AdminInfo | null> {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) return null;
    return { id: auth.userId, tenantId: auth.tenantId, role: auth.role };
  } catch {
    return null;
  }
}
