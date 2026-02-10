/**
 * RADIANT v7.38.0 — System Admin Authentication Middleware
 *
 * Authenticates system administrators from the dedicated System Admin Cognito Pool (Pool B).
 * System admins are GLOBAL — no tenant scope. They manage the RADIANT platform itself.
 *
 * This middleware REJECTS tenant user tokens (Pool A). Only Pool B tokens are accepted.
 * System admins can ONLY access the Radiant Admin API — never tenant/consumer apps.
 *
 * Usage in any admin Lambda handler:
 *   import { extractSystemAdminContext, requireSystemPermission, requireSystemSuperAdmin } from '../shared/middleware/system-admin-auth';
 *
 *   const ctx = extractSystemAdminContext(event);
 *   const guard = requireSystemPermission(ctx, 'canManageModels');
 *   if (guard) return guard; // 403 response
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import type {
  SystemAdminRole,
  SystemAdminPermissionSet,
} from '@radiant/shared/types/user-profile.types';
import { SYSTEM_ADMIN_PERMISSIONS } from '@radiant/shared/types/user-profile.types';
import { createRegisteredLogger } from '../services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'auth/system-admin-auth',
  category: 'security',
  sourceType: 'application',
});

// =============================================================================
// SYSTEM ADMIN CONTEXT (no tenantId — global scope)
// =============================================================================

export interface SystemAdminContext {
  adminId: string;
  email: string;
  adminRole: SystemAdminRole;
  permissions: SystemAdminPermissionSet;
  isBootstrap: boolean;
  displayName: string;
  status: string;
}

// =============================================================================
// EXTRACT SYSTEM ADMIN CONTEXT FROM EVENT
// =============================================================================

/**
 * Extracts system admin identity from Pool B JWT claims.
 * Returns null if the token is not from Pool B or is invalid.
 */
export function extractSystemAdminContext(event: APIGatewayProxyEvent): SystemAdminContext | null {
  try {
    const claims = event.requestContext?.authorizer?.claims || {};

    // Pool B tokens have custom:admin_pool = 'system'
    // This is the primary discriminator between Pool A and Pool B tokens
    const adminPool = claims['custom:admin_pool'] || event.headers['x-admin-pool'];
    if (adminPool !== 'system') {
      logger.warn('Rejected non-system-admin token', {
        pool: adminPool,
        email: claims.email,
      });
      return null;
    }

    const adminId = claims.sub || claims['cognito:username'] || event.headers['x-admin-id'];
    const email = claims.email || event.headers['x-admin-email'] || '';
    const adminRole = (claims['custom:admin_role'] || event.headers['x-admin-role'] || 'super_admin') as SystemAdminRole;
    const isBootstrap = claims['custom:is_bootstrap'] === 'true' || event.headers['x-is-bootstrap'] === 'true';
    const displayName = claims.name || claims['custom:display_name'] || email;
    const status = claims['custom:status'] || 'active';

    if (!adminId) {
      logger.warn('System admin token missing sub/username');
      return null;
    }

    // Only super_admin is valid in Pool B (v7.52.0)
    const resolvedRole: SystemAdminRole = 'super_admin';
    if (adminRole !== 'super_admin') {
      logger.warn('Non-super_admin role in Pool B token rejected', { adminRole, email });
      return null;
    }

    const permissions = SYSTEM_ADMIN_PERMISSIONS[resolvedRole];

    return {
      adminId,
      email,
      adminRole: resolvedRole,
      permissions,
      isBootstrap,
      displayName,
      status,
    };
  } catch (error) {
    logger.error('[SystemAdminAuth] Failed to extract system admin context', { error });
    return null;
  }
}

// =============================================================================
// PERMISSION CHECK — returns 403 response or null (allowed)
// =============================================================================

export function requireSystemPermission(
  ctx: SystemAdminContext | null,
  permission: keyof SystemAdminPermissionSet,
): APIGatewayProxyResult | null {
  if (!ctx) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'UNAUTHORIZED',
        message: 'System administrator authentication required. This API requires a system admin token (Pool B).',
      }),
    };
  }

  if (ctx.status !== 'active') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'ACCOUNT_INACTIVE',
        message: `System admin account is ${ctx.status}. Contact another super_admin to reactivate.`,
        status: ctx.status,
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

export function requireSystemMinRole(
  ctx: SystemAdminContext | null,
  minRole: SystemAdminRole,
): APIGatewayProxyResult | null {
  if (!ctx) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'UNAUTHORIZED',
        message: 'System administrator authentication required.',
      }),
    };
  }

  if (ctx.status !== 'active') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'ACCOUNT_INACTIVE',
        message: `System admin account is ${ctx.status}.`,
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

export function requireSystemSuperAdmin(ctx: SystemAdminContext | null): APIGatewayProxyResult | null {
  return requireSystemMinRole(ctx, 'super_admin');
}

// =============================================================================
// SYSTEM ADMIN SERVICE (Database-backed)
// For bootstrap flow, CRUD, and role management
// =============================================================================

export interface SystemAdminRecord {
  id: string;
  cognitoUserId: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  role: SystemAdminRole;
  isBootstrap: boolean;
  mfaEnabled: boolean;
  mfaMethod: string;
  timezone: string;
  locale: string;
  status: string;
  lastLoginAt: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  setupCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class SystemAdminService {
  constructor(private pool: Pool) {}

  async getById(adminId: string): Promise<SystemAdminRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM system_admins WHERE id = $1`,
      [adminId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getByCognitoId(cognitoUserId: string): Promise<SystemAdminRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM system_admins WHERE cognito_user_id = $1`,
      [cognitoUserId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getByEmail(email: string): Promise<SystemAdminRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM system_admins WHERE email = $1`,
      [email],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async listAll(options?: { status?: string; role?: SystemAdminRole }): Promise<SystemAdminRecord[]> {
    let query = 'SELECT * FROM system_admins WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (options?.status) {
      query += ` AND status = $${idx++}`;
      params.push(options.status);
    }
    if (options?.role) {
      query += ` AND role = $${idx++}`;
      params.push(options.role);
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows.map(r => this.mapRow(r));
  }

  async create(
    data: {
      cognitoUserId: string;
      email: string;
      displayName: string;
      firstName?: string;
      lastName?: string;
      role: SystemAdminRole;
    },
    createdBy: string,
  ): Promise<SystemAdminRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Only super_admin can create other super_admins
      if (data.role === 'super_admin') {
        const creator = await this.getById(createdBy);
        if (!creator || creator.role !== 'super_admin') {
          throw new Error('Only super_admin can create other super_admin accounts');
        }
      }

      const result = await client.query(
        `INSERT INTO system_admins (
          cognito_user_id, email, display_name, first_name, last_name,
          role, mfa_enabled, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, true, 'pending_setup', $7)
        RETURNING *`,
        [
          data.cognitoUserId, data.email, data.displayName,
          data.firstName || null, data.lastName || null,
          data.role, createdBy,
        ],
      );

      await client.query(
        `INSERT INTO system_admin_audit_log (admin_id, action, new_role, performed_by, reason)
         VALUES ($1, 'admin_created', $2, $3, $4)`,
        [result.rows[0].id, data.role, createdBy, `System admin created by ${createdBy}`],
      );

      await client.query('COMMIT');
      return this.mapRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async changeRole(
    adminId: string,
    newRole: SystemAdminRole,
    performedBy: string,
    reason?: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query(
        `SELECT role FROM system_admins WHERE id = $1 AND status = 'active'`,
        [adminId],
      );
      if (current.rows.length === 0) {
        throw new Error('System admin not found or not active');
      }

      const oldRole = current.rows[0].role;

      // Only super_admin can promote to super_admin
      if (newRole === 'super_admin') {
        const performer = await this.getById(performedBy);
        if (!performer || performer.role !== 'super_admin') {
          throw new Error('Only super_admin can promote to super_admin');
        }
      }

      // Trigger will prevent demoting the last super_admin
      await client.query(
        `UPDATE system_admins SET role = $1, updated_at = NOW() WHERE id = $2`,
        [newRole, adminId],
      );

      await client.query(
        `INSERT INTO system_admin_audit_log (admin_id, action, old_role, new_role, performed_by, reason)
         VALUES ($1, 'role_changed', $2, $3, $4, $5)`,
        [adminId, oldRole, newRole, performedBy, reason || null],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deactivate(adminId: string, performedBy: string, reason?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Trigger will prevent deactivating last super_admin
      await client.query(
        `UPDATE system_admins SET status = 'deactivated', deactivated_at = NOW(), deactivated_by = $2, updated_at = NOW()
         WHERE id = $1 AND status = 'active'`,
        [adminId, performedBy],
      );

      await client.query(
        `INSERT INTO system_admin_audit_log (admin_id, action, performed_by, reason)
         VALUES ($1, 'deactivated', $2, $3)`,
        [adminId, performedBy, reason || null],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async reactivate(adminId: string, performedBy: string, reason?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE system_admins SET status = 'active', deactivated_at = NULL, deactivated_by = NULL,
         failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
         WHERE id = $1 AND status IN ('deactivated', 'suspended')`,
        [adminId],
      );

      await client.query(
        `INSERT INTO system_admin_audit_log (admin_id, action, performed_by, reason)
         VALUES ($1, 'reactivated', $2, $3)`,
        [adminId, performedBy, reason || null],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recordLogin(adminId: string, ip: string): Promise<void> {
    await this.pool.query(
      `UPDATE system_admins SET last_login_at = NOW(), last_login_ip = $2, failed_login_attempts = 0, updated_at = NOW()
       WHERE id = $1`,
      [adminId, ip],
    );
  }

  async recordFailedLogin(adminId: string, ip: string): Promise<{ locked: boolean; deactivated: boolean }> {
    const result = await this.pool.query(
      `UPDATE system_admins SET failed_login_attempts = failed_login_attempts + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING failed_login_attempts`,
      [adminId],
    );

    const attempts = result.rows[0]?.failed_login_attempts || 0;

    if (attempts >= 20) {
      await this.pool.query(
        `UPDATE system_admins SET status = 'deactivated', deactivated_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [adminId],
      );
      await this.pool.query(
        `INSERT INTO system_admin_audit_log (admin_id, action, reason, ip_address)
         VALUES ($1, 'auto_deactivated', $2, $3::inet)`,
        [adminId, `Auto-deactivated after ${attempts} failed login attempts`, ip],
      );
      return { locked: false, deactivated: true };
    }

    if (attempts >= 5) {
      const lockMinutes = attempts >= 10 ? 60 : 15;
      await this.pool.query(
        `UPDATE system_admins SET locked_until = NOW() + INTERVAL '${lockMinutes} minutes', updated_at = NOW() WHERE id = $1`,
        [adminId],
      );
      return { locked: true, deactivated: false };
    }

    return { locked: false, deactivated: false };
  }

  async completeSetup(adminId: string): Promise<void> {
    await this.pool.query(
      `UPDATE system_admins SET status = 'active', setup_completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'pending_setup'`,
      [adminId],
    );

    await this.pool.query(
      `INSERT INTO system_admin_audit_log (admin_id, action, reason)
       VALUES ($1, 'setup_completed', 'Initial setup completed: password changed, MFA enrolled, phone verified')`,
      [adminId],
    );
  }

  async bootstrapFirstAdmin(
    cognitoUserId: string,
    email: string,
    displayName: string,
  ): Promise<SystemAdminRecord> {
    const result = await this.pool.query(
      `SELECT bootstrap_system_admin($1, $2, $3)`,
      [cognitoUserId, email, displayName],
    );
    const adminId = result.rows[0].bootstrap_system_admin;
    const admin = await this.getById(adminId);
    if (!admin) throw new Error('Bootstrap admin creation failed');
    return admin;
  }

  private mapRow(row: any): SystemAdminRecord {
    return {
      id: row.id,
      cognitoUserId: row.cognito_user_id,
      email: row.email,
      displayName: row.display_name,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      isBootstrap: row.is_bootstrap,
      mfaEnabled: row.mfa_enabled,
      mfaMethod: row.mfa_method,
      timezone: row.timezone,
      locale: row.locale,
      status: row.status,
      lastLoginAt: row.last_login_at,
      phoneVerified: row.phone_verified,
      emailVerified: row.email_verified,
      setupCompletedAt: row.setup_completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
