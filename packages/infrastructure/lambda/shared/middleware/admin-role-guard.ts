/**
 * RADIANT v7.38.0 — Admin Role Enforcement Middleware
 *
 * Guards admin API Lambda handlers with role-based access control.
 * Extracts adminRole from JWT claims, checks against the permission matrix,
 * and returns 403 if insufficient permissions.
 *
 * v7.38.0: System admins now use a SEPARATE Cognito pool (Pool B) and
 * separate middleware (system-admin-auth.ts). This file remains for
 * backwards compatibility and re-exports the new system admin utilities.
 *
 * For NEW code, prefer:
 *   import { extractSystemAdminContext, requireSystemPermission } from '../shared/middleware/system-admin-auth';
 *
 * Legacy usage still works:
 *   import { requirePermission, extractAdminContext } from '../shared/middleware/admin-role-guard';
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import type {
  SystemAdminRole,
  SystemAdminPermissionSet,
} from '@radiant/shared/types/user-profile.types';
import { SYSTEM_ADMIN_PERMISSIONS } from '@radiant/shared/types/user-profile.types';

// Re-export system admin utilities for convenience
export {
  extractSystemAdminContext,
  requireSystemPermission,
  requireSystemMinRole,
  requireSystemSuperAdmin,
  SystemAdminService,
} from './system-admin-auth';
export type { SystemAdminContext, SystemAdminRecord } from './system-admin-auth';

// =============================================================================
// ADMIN CONTEXT
// =============================================================================

export interface AdminContext {
  adminId: string;
  tenantId: string;
  email: string;
  adminRole: SystemAdminRole;
  permissions: SystemAdminPermissionSet;
  isBootstrapAdmin: boolean;
}

// =============================================================================
// EXTRACT ADMIN CONTEXT FROM EVENT
// =============================================================================

export function extractAdminContext(event: APIGatewayProxyEvent): AdminContext | null {
  try {
    const claims = event.requestContext?.authorizer?.claims || {};

    const adminId = claims.sub || claims['cognito:username'] || event.headers['x-admin-id'];
    const tenantId = claims['custom:tenant_id'] || event.headers['x-tenant-id'];
    const email = claims.email || event.headers['x-admin-email'] || '';
    const adminRole = (claims['custom:admin_role'] || event.headers['x-admin-role'] || 'super_admin') as SystemAdminRole;
    const isBootstrapAdmin = claims['custom:is_bootstrap'] === 'true' || event.headers['x-is-bootstrap'] === 'true';

    if (!adminId || !tenantId) return null;

    // Only super_admin is valid (v7.52.0)
    const resolvedRole: SystemAdminRole = adminRole === 'super_admin' ? 'super_admin' : 'super_admin';

    const permissions = SYSTEM_ADMIN_PERMISSIONS[resolvedRole];

    return {
      adminId,
      tenantId,
      email,
      adminRole: resolvedRole,
      permissions,
      isBootstrapAdmin,
    };
  } catch (error) {
    console.error('[AdminRoleGuard] Failed to extract admin context:', error);
    return null;
  }
}

// =============================================================================
// PERMISSION CHECK — returns 403 response or null (allowed)
// =============================================================================

export function requirePermission(
  ctx: AdminContext | null,
  permission: keyof SystemAdminPermissionSet,
): APIGatewayProxyResult | null {
  if (!ctx) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'UNAUTHORIZED',
        message: 'Admin authentication required',
      }),
    };
  }

  if (!ctx.permissions[permission]) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'FORBIDDEN',
        message: `Insufficient permissions. Required: ${permission}. Your role: ${ctx.adminRole}`,
        requiredPermission: permission,
        currentRole: ctx.adminRole,
      }),
    };
  }

  return null; // Allowed
}

// =============================================================================
// ROLE CHECK — minimum role level required
// =============================================================================

const ROLE_HIERARCHY: Record<SystemAdminRole, number> = {
  super_admin: 4,
};

export function requireMinRole(
  ctx: AdminContext | null,
  minRole: SystemAdminRole,
): APIGatewayProxyResult | null {
  if (!ctx) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'UNAUTHORIZED',
        message: 'Admin authentication required',
      }),
    };
  }

  if (ROLE_HIERARCHY[ctx.adminRole] < ROLE_HIERARCHY[minRole]) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'FORBIDDEN',
        message: `Minimum role required: ${minRole}. Your role: ${ctx.adminRole}`,
        requiredRole: minRole,
        currentRole: ctx.adminRole,
      }),
    };
  }

  return null;
}

// =============================================================================
// SUPER ADMIN CHECK — shorthand for super_admin only operations
// =============================================================================

export function requireSuperAdmin(ctx: AdminContext | null): APIGatewayProxyResult | null {
  return requireMinRole(ctx, 'super_admin');
}

// =============================================================================
// ADMIN ROLE SERVICE (Database-backed)
// For bootstrap flow and role management
// =============================================================================

export class AdminRoleService {
  constructor(private pool: Pool) {}

  async getAdminRole(adminId: string, tenantId: string): Promise<SystemAdminRole | null> {
    const result = await this.pool.query(
      `SELECT role FROM admin_role_assignments
       WHERE admin_id = $1 AND tenant_id = $2 AND is_active = true
       LIMIT 1`,
      [adminId, tenantId],
    );
    return result.rows[0]?.role || null;
  }

  async isBootstrapAdmin(adminId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT is_bootstrap_admin FROM admin_role_assignments
       WHERE admin_id = $1 AND is_bootstrap_admin = true AND is_active = true
       LIMIT 1`,
      [adminId],
    );
    return result.rows.length > 0;
  }

  async assignRole(
    adminId: string,
    tenantId: string,
    role: SystemAdminRole,
    grantedBy: string | null,
    isBootstrap: boolean = false,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Only super_admin can create other super_admins
      if (role === 'super_admin' && grantedBy) {
        const granterRole = await this.getAdminRole(grantedBy, tenantId);
        if (granterRole !== 'super_admin') {
          throw new Error('Only super_admin can create other super_admin accounts');
        }
      }

      // Get existing role for audit
      const existing = await client.query(
        `SELECT role FROM admin_role_assignments
         WHERE admin_id = $1 AND tenant_id = $2 AND is_active = true`,
        [adminId, tenantId],
      );
      const oldRole = existing.rows[0]?.role || null;

      // Upsert role
      await client.query(
        `INSERT INTO admin_role_assignments
         (admin_id, tenant_id, role, is_bootstrap_admin, granted_by, granted_at, last_role_change_at, last_role_change_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $5)
         ON CONFLICT (admin_id, tenant_id)
         DO UPDATE SET
           role = $3,
           last_role_change_at = NOW(),
           last_role_change_by = $5,
           updated_at = NOW()`,
        [adminId, tenantId, role, isBootstrap, grantedBy],
      );

      // Audit log
      await client.query(
        `INSERT INTO admin_role_audit_log
         (admin_id, tenant_id, action, old_role, new_role, performed_by, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          adminId,
          tenantId,
          isBootstrap ? 'bootstrap' : oldRole ? 'role_changed' : 'role_assigned',
          oldRole,
          role,
          grantedBy,
          isBootstrap ? 'First admin bootstrap — auto-assigned super_admin' : null,
        ],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeRole(adminId: string, tenantId: string, revokedBy: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Cannot revoke last super_admin
      const superAdminCount = await client.query(
        `SELECT COUNT(*) as cnt FROM admin_role_assignments
         WHERE tenant_id = $1 AND role = 'super_admin' AND is_active = true`,
        [tenantId],
      );

      const targetRole = await this.getAdminRole(adminId, tenantId);
      if (targetRole === 'super_admin' && parseInt(superAdminCount.rows[0].cnt) <= 1) {
        throw new Error('Cannot revoke the last super_admin — at least one must exist');
      }

      await client.query(
        `UPDATE admin_role_assignments
         SET is_active = false, revoked_at = NOW(), revoked_by = $3, updated_at = NOW()
         WHERE admin_id = $1 AND tenant_id = $2 AND is_active = true`,
        [adminId, tenantId, revokedBy],
      );

      await client.query(
        `INSERT INTO admin_role_audit_log
         (admin_id, tenant_id, action, old_role, performed_by)
         VALUES ($1, $2, 'role_revoked', $3, $4)`,
        [adminId, tenantId, targetRole, revokedBy],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async bootstrapFirstAdmin(adminId: string, tenantId: string): Promise<void> {
    // Check if any admin exists
    const existing = await this.pool.query(
      `SELECT COUNT(*) as cnt FROM admin_role_assignments WHERE tenant_id = $1 AND is_active = true`,
      [tenantId],
    );

    if (parseInt(existing.rows[0].cnt) > 0) {
      throw new Error('Bootstrap admin already exists — cannot create another');
    }

    await this.assignRole(adminId, tenantId, 'super_admin', null, true);
    console.log(`[AdminRoleService] Bootstrap admin created: ${adminId} as super_admin for tenant ${tenantId}`);
  }

  /**
   * @deprecated Use SystemAdminService for system admin app access.
   * System admins access Radiant Admin only via Pool B token.
   * This method is retained for tenant admin app access only.
   */
  async getAppAccess(adminId: string, tenantId: string): Promise<string[]> {
    const role = await this.getAdminRole(adminId, tenantId);

    // System admin roles no longer get automatic consumer app access.
    // They access Radiant Admin via Pool B token only.
    if (role === 'super_admin') {
      return ['radiant_admin', 'thinktank_admin'];
    }

    return [];
  }
}
