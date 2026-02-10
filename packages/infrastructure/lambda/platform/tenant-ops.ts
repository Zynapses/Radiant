/**
 * RADIANT v7.56.0 — Tenant Infrastructure Operations API
 *
 * Provides a service-layer API for operations that require system-admin
 * database permissions but are requested on behalf of tenants.
 *
 * Think Tank Suite apps (Think Tank, Curator, Dojo, Tenant Admin, etc.)
 * MUST NOT directly access Radiant infrastructure. Instead, they request
 * operations through this API, which validates permissions and executes
 * with elevated privileges.
 *
 * Routes: POST /api/v1/platform/tenant-ops/*
 * Auth: System admin token OR tenant-admin with explicit approval
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDbPool } from '../shared/services/database';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID,X-System-Admin-Token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function ok(body: unknown): APIGatewayProxyResult {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) };
}

function err(status: number, message: string): APIGatewayProxyResult {
  return { statusCode: status, headers: corsHeaders, body: JSON.stringify({ error: message }) };
}

// Valid operation types that can be requested
type TenantOperation =
  | 'enable_omega_brain'
  | 'disable_omega_brain'
  | 'provision_storage'
  | 'wire_feature'
  | 'reload_cartridge_stack'
  | 'reset_tenant_cache'
  | 'rotate_api_keys'
  | 'run_tenant_health_check';

const VALID_OPERATIONS: TenantOperation[] = [
  'enable_omega_brain',
  'disable_omega_brain',
  'provision_storage',
  'wire_feature',
  'reload_cartridge_stack',
  'reset_tenant_cache',
  'rotate_api_keys',
  'run_tenant_health_check',
];

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const path = event.path.replace(/^\/api\/v1\/platform\/tenant-ops/, '') || '/';
  const method = event.httpMethod;

  // Extract auth context
  const adminId = event.requestContext.authorizer?.userId
    || event.requestContext.authorizer?.claims?.sub;
  const isSystemAdmin = event.requestContext.authorizer?.isSuperAdmin === 'true'
    || event.requestContext.authorizer?.claims?.['custom:role'] === 'super_admin';

  if (!adminId) {
    return err(401, 'Authentication required');
  }

  try {
    const pool = await getDbPool();

    // =========================================================================
    // POST /request — Submit an infrastructure operation request
    // =========================================================================
    if (path === '/request' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { tenantId, operation, parameters } = body;

      if (!tenantId || !operation) {
        return err(400, 'tenantId and operation are required');
      }

      if (!VALID_OPERATIONS.includes(operation)) {
        return err(400, `Invalid operation. Valid: ${VALID_OPERATIONS.join(', ')}`);
      }

      // Only system admins can execute infrastructure operations
      if (!isSystemAdmin) {
        // Tenant admins can REQUEST operations but they go into a pending queue
        const result = await pool.query(
          `INSERT INTO tenant_ops_requests (tenant_id, operation, parameters, requested_by, status)
           VALUES ($1, $2, $3, $4, 'pending_approval')
           RETURNING id, tenant_id, operation, status, created_at`,
          [tenantId, operation, JSON.stringify(parameters || {}), adminId]
        );
        return ok({
          success: true,
          message: 'Operation request submitted for system admin approval',
          request: result.rows[0],
        });
      }

      // System admin — execute immediately
      const result = await executeOperation(pool, tenantId, operation, parameters || {}, adminId);
      return ok(result);
    }

    // =========================================================================
    // GET /requests — List pending operation requests (system admin only)
    // =========================================================================
    if (path === '/requests' && method === 'GET') {
      if (!isSystemAdmin) {
        return err(403, 'System admin access required');
      }

      const status = event.queryStringParameters?.status || 'pending_approval';
      const result = await pool.query(
        `SELECT id, tenant_id, operation, parameters, requested_by, status, created_at, completed_at
         FROM tenant_ops_requests
         WHERE status = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [status]
      );
      return ok({ requests: result.rows });
    }

    // =========================================================================
    // POST /requests/:id/approve — Approve and execute a pending request
    // =========================================================================
    const approveMatch = path.match(/^\/requests\/([\w-]+)\/approve$/);
    if (approveMatch && method === 'POST') {
      if (!isSystemAdmin) {
        return err(403, 'System admin access required');
      }

      const requestId = approveMatch[1];
      const reqResult = await pool.query(
        `SELECT * FROM tenant_ops_requests WHERE id = $1 AND status = 'pending_approval'`,
        [requestId]
      );

      if (reqResult.rows.length === 0) {
        return err(404, 'Request not found or already processed');
      }

      const req = reqResult.rows[0];
      const opResult = await executeOperation(
        pool, req.tenant_id, req.operation, req.parameters, adminId
      );

      await pool.query(
        `UPDATE tenant_ops_requests SET status = 'completed', completed_at = NOW(), approved_by = $2
         WHERE id = $1`,
        [requestId, adminId]
      );

      return ok({ ...opResult, requestId });
    }

    // =========================================================================
    // POST /requests/:id/reject — Reject a pending request
    // =========================================================================
    const rejectMatch = path.match(/^\/requests\/([\w-]+)\/reject$/);
    if (rejectMatch && method === 'POST') {
      if (!isSystemAdmin) {
        return err(403, 'System admin access required');
      }

      const requestId = rejectMatch[1];
      const body = JSON.parse(event.body || '{}');

      await pool.query(
        `UPDATE tenant_ops_requests SET status = 'rejected', completed_at = NOW(),
         approved_by = $2, rejection_reason = $3
         WHERE id = $1 AND status = 'pending_approval'`,
        [requestId, adminId, body.reason || 'No reason provided']
      );

      return ok({ success: true, message: 'Request rejected' });
    }

    // =========================================================================
    // GET /health/:tenantId — Check tenant infrastructure health
    // =========================================================================
    const healthMatch = path.match(/^\/health\/([\w-]+)$/);
    if (healthMatch && method === 'GET') {
      if (!isSystemAdmin) {
        return err(403, 'System admin access required');
      }

      const tenantId = healthMatch[1];
      const health = await checkTenantHealth(pool, tenantId);
      return ok(health);
    }

    return err(404, `Route not found: ${method} ${path}`);
  } catch (error) {
    console.error('Tenant ops error:', error);
    return err(500, error instanceof Error ? error.message : 'Internal server error');
  }
}

// =============================================================================
// Operation Executor
// =============================================================================

async function executeOperation(
  pool: import('pg').Pool,
  tenantId: string,
  operation: string,
  parameters: Record<string, unknown>,
  executedBy: string
): Promise<{ success: boolean; operation: string; tenantId: string; result: unknown }> {
  // Log the operation
  await pool.query(
    `INSERT INTO tenant_ops_audit_log (tenant_id, operation, parameters, executed_by)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, operation, JSON.stringify(parameters), executedBy]
  );

  let result: unknown;

  switch (operation) {
    case 'enable_omega_brain': {
      // Initialize OMEGA brain instance for tenant
      await pool.query(
        `INSERT INTO omega_brain_instances (tenant_id, status, config)
         VALUES ($1, 'initializing', $2)
         ON CONFLICT (tenant_id) DO UPDATE SET status = 'initializing', updated_at = NOW()`,
        [tenantId, JSON.stringify(parameters.config || {})]
      );
      result = { message: 'OMEGA brain initialization started' };
      break;
    }

    case 'disable_omega_brain': {
      await pool.query(
        `UPDATE omega_brain_instances SET status = 'disabled', updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId]
      );
      result = { message: 'OMEGA brain disabled' };
      break;
    }

    case 'provision_storage': {
      // Mark tenant storage as provisioned with requested tier
      const tier = (parameters.tier as string) || 'standard';
      await pool.query(
        `UPDATE tenants SET settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{storage}',
           $2::jsonb
         ), updated_at = NOW()
         WHERE id = $1`,
        [tenantId, JSON.stringify({ tier, provisioned: true, provisioned_at: new Date().toISOString() })]
      );
      result = { message: `Storage provisioned at ${tier} tier` };
      break;
    }

    case 'wire_feature': {
      const feature = parameters.feature as string;
      if (!feature) throw new Error('feature parameter required');
      await pool.query(
        `INSERT INTO tenant_features (tenant_id, feature_key, enabled, enabled_by)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = true, enabled_by = $3, updated_at = NOW()`,
        [tenantId, feature, executedBy]
      );
      result = { message: `Feature '${feature}' enabled for tenant` };
      break;
    }

    case 'reload_cartridge_stack': {
      // Trigger cartridge stack re-resolution for tenant
      await pool.query(
        `UPDATE tenants SET settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{cartridge_reload_requested}',
           to_jsonb(NOW()::text)
         ), updated_at = NOW()
         WHERE id = $1`,
        [tenantId]
      );
      result = { message: 'Cartridge stack reload requested' };
      break;
    }

    case 'reset_tenant_cache': {
      // Mark all caches as invalidated for this tenant
      await pool.query(
        `DELETE FROM inference_cache_entries WHERE tenant_id = $1`,
        [tenantId]
      );
      result = { message: 'Tenant cache cleared' };
      break;
    }

    case 'rotate_api_keys': {
      // Rotate all API keys for tenant (mark old ones as expired)
      const rotated = await pool.query(
        `UPDATE api_keys SET status = 'rotated', rotated_at = NOW()
         WHERE tenant_id = $1 AND status = 'active'
         RETURNING id`,
        [tenantId]
      );
      result = { message: `${rotated.rowCount} API keys rotated` };
      break;
    }

    case 'run_tenant_health_check': {
      result = await checkTenantHealth(pool, tenantId);
      break;
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  return { success: true, operation, tenantId, result };
}

async function checkTenantHealth(
  pool: import('pg').Pool,
  tenantId: string
): Promise<Record<string, unknown>> {
  const [tenant, users, conversations, cartridges, omega] = await Promise.all([
    pool.query(`SELECT id, name, status, tier, created_at FROM tenants WHERE id = $1`, [tenantId]),
    pool.query(`SELECT COUNT(*) as count FROM users WHERE tenant_id = $1`, [tenantId]),
    pool.query(`SELECT COUNT(*) as count FROM conversations WHERE tenant_id = $1`, [tenantId]),
    pool.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active
       FROM cartridges WHERE tenant_id = $1 OR is_system = true`,
      [tenantId]
    ),
    pool.query(
      `SELECT status FROM omega_brain_instances WHERE tenant_id = $1`,
      [tenantId]
    ).catch(() => ({ rows: [] })),
  ]);

  return {
    tenant: tenant.rows[0] || null,
    users: parseInt(String(users.rows[0]?.count || '0')),
    conversations: parseInt(String(conversations.rows[0]?.count || '0')),
    cartridges: cartridges.rows[0],
    omegaBrain: omega.rows[0]?.status || 'not_configured',
    healthy: !!tenant.rows[0] && tenant.rows[0].status === 'active',
  };
}
