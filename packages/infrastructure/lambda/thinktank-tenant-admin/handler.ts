/**
 * RADIANT v7.43.1 — Think Tank Tenant Admin Lambda Handler
 * Tenant-scoped administration: dashboard, users, settings, security,
 * collaboration, cartridges, and reports.
 *
 * Routes: /api/v1/tenant/* and /api/tenant-admin/*
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDbClient } from '../shared/db';
import { getAuthTenantId, getAuthUserId } from '../shared/utils';
import { createResponse, createErrorResponse } from '../shared/utils/response';
import { randomUUID } from 'crypto';

const db = getDbClient();

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Normalize path — strip both possible prefixes
  let path = event.path
    .replace(/^\/api\/v1\/tenant/, '')
    .replace(/^\/api\/tenant-admin/, '');
  if (!path.startsWith('/')) path = '/' + path;
  const method = event.httpMethod;

  try {
    const tenantId = getAuthTenantId(event);
    const userId = getAuthUserId(event);

    if (!tenantId) {
      return createErrorResponse('Tenant ID required', 401);
    }

    await db.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

    // ─────────────────────────────────────────────────────────────────────
    // Dashboard
    // ─────────────────────────────────────────────────────────────────────
    if (path === '/dashboard/stats' && method === 'GET') {
      return getDashboardStats(tenantId);
    }
    if (path === '/dashboard/usage-trends' && method === 'GET') {
      return getUsageTrends(tenantId);
    }
    if (path === '/dashboard/activity' && method === 'GET') {
      return getRecentActivity(tenantId);
    }
    if (path === '/dashboard/alerts' && method === 'GET') {
      return getAlerts(tenantId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Users
    // ─────────────────────────────────────────────────────────────────────
    if (path === '/users' && method === 'GET') {
      return getUsers(tenantId);
    }
    if (path.match(/^\/users\/[\w-]+$/) && method === 'GET') {
      return getUserDetail(tenantId, path.split('/')[2]);
    }
    if (path.match(/^\/users\/[\w-]+$/) && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return updateUser(tenantId, path.split('/')[2], body);
    }
    if (path.match(/^\/users\/[\w-]+\/suspend$/) && method === 'POST') {
      return suspendUser(tenantId, path.split('/')[2]);
    }
    if (path.match(/^\/users\/[\w-]+\/activate$/) && method === 'POST') {
      return activateUser(tenantId, path.split('/')[2]);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Settings
    // ─────────────────────────────────────────────────────────────────────
    if (path === '/settings' && method === 'GET') {
      return getSettings(tenantId);
    }
    if (path === '/settings' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return updateSettings(tenantId, body);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Security
    // ─────────────────────────────────────────────────────────────────────
    if (path === '/security' && method === 'GET') {
      return getSecurityConfig(tenantId);
    }
    if (path === '/security' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return updateSecurityConfig(tenantId, body);
    }
    if (path === '/security/audit-log' && method === 'GET') {
      return getAuditLog(tenantId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Collaboration
    // ─────────────────────────────────────────────────────────────────────
    if (path === '/collaboration' && method === 'GET') {
      return getCollaborationConfig(tenantId);
    }
    if (path === '/collaboration' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return updateCollaborationConfig(tenantId, body);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Cartridges
    // ─────────────────────────────────────────────────────────────────────
    if (path === '/cartridges' && method === 'GET') {
      return getCartridges(tenantId);
    }
    if (path === '/cartridges/stack' && method === 'GET') {
      return getCartridgeStack(tenantId);
    }
    if (path === '/cartridges' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return createCartridge(tenantId, userId, body);
    }
    if (path.match(/^\/cartridges\/[\w-]+\/activate$/) && method === 'POST') {
      return activateCartridge(tenantId, path.split('/')[2]);
    }
    if (path.match(/^\/cartridges\/[\w-]+\/deactivate$/) && method === 'POST') {
      return deactivateCartridge(tenantId, path.split('/')[2]);
    }
    if (path.match(/^\/cartridges\/[\w-]+$/) && method === 'DELETE') {
      return deleteCartridge(tenantId, path.split('/')[2]);
    }

    // ─────────────────────────────────────────────────────────────────────
    // API Keys — Credential Lifecycle Management
    // ─────────────────────────────────────────────────────────────────────
    if (path === '/keys' && method === 'GET') {
      return listApiKeys(tenantId);
    }
    if (path === '/keys' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return createApiKey(tenantId, userId, body);
    }
    if (path.match(/^\/keys\/[\w-]+\/rotate$/) && method === 'POST') {
      return rotateApiKey(tenantId, path.split('/')[2], userId);
    }
    if (path.match(/^\/keys\/[\w-]+\/restrictions$/) && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return updateKeyRestrictions(tenantId, path.split('/')[2], body);
    }
    if (path.match(/^\/keys\/[\w-]+\/revoke$/) && method === 'POST') {
      return revokeApiKey(tenantId, path.split('/')[2], userId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Reports
    // ─────────────────────────────────────────────────────────────────────
    if (path === '/reports' && method === 'GET') {
      return getReports(tenantId);
    }
    if (path.match(/^\/reports\/[\w-]+$/) && method === 'GET') {
      return getReportDetail(tenantId, path.split('/')[2]);
    }

    return createErrorResponse(`Route not found: ${method} ${path}`, 404);
  } catch (error) {
    console.error('TT Tenant Admin handler error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
};

// =============================================================================
// Dashboard
// =============================================================================

async function getDashboardStats(tenantId: string): Promise<APIGatewayProxyResult> {
  const [userCount, conversationCount, messageCount] = await Promise.all([
    db.query(`SELECT count(*) as count FROM users WHERE tenant_id = $1`, [tenantId]),
    db.query(`SELECT count(*) as count FROM conversations WHERE tenant_id = $1`, [tenantId]),
    db.query(`SELECT count(*) as count FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.tenant_id = $1`, [tenantId]),
  ]);

  return createResponse({
    total_users: parseInt(String(userCount.rows[0]?.count ?? '0')),
    active_conversations: parseInt(String(conversationCount.rows[0]?.count ?? '0')),
    total_messages: parseInt(String(messageCount.rows[0]?.count ?? '0')),
    ai_requests_today: 0,
    storage_used_mb: 0,
    monthly_cost_usd: 0,
  });
}

async function getUsageTrends(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT date_trunc('day', created_at) as date,
            count(*) as message_count
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.tenant_id = $1
       AND m.created_at > NOW() - INTERVAL '30 days'
     GROUP BY date_trunc('day', created_at)
     ORDER BY date`,
    [tenantId]
  );
  return createResponse(result.rows);
}

async function getRecentActivity(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, user_id, action, resource_type, resource_id, created_at, metadata
     FROM audit_logs
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [tenantId]
  );
  return createResponse(result.rows);
}

async function getAlerts(tenantId: string): Promise<APIGatewayProxyResult> {
  // Check for common alert conditions
  const alerts: Array<{ id: string; severity: string; title: string; message: string; created_at: string }> = [];

  const usageResult = await db.query(
    `SELECT count(*) as count FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.tenant_id = $1 AND m.created_at > NOW() - INTERVAL '1 hour'`,
    [tenantId]
  );
  const hourlyMessages = parseInt(String(usageResult.rows[0]?.count ?? '0'));
  if (hourlyMessages > 1000) {
    alerts.push({
      id: randomUUID(),
      severity: 'warning',
      title: 'High Usage',
      message: `${hourlyMessages} messages in the last hour`,
      created_at: new Date().toISOString(),
    });
  }

  return createResponse(alerts);
}

// =============================================================================
// Users
// =============================================================================

async function getUsers(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, email, display_name, role, status, created_at, last_login_at
     FROM users
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return createResponse({ success: true, users: result.rows });
}

async function getUserDetail(tenantId: string, userId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, email, display_name, role, status, created_at, last_login_at, metadata
     FROM users
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, userId]
  );
  if (result.rows.length === 0) return createErrorResponse('User not found', 404);
  return createResponse({ success: true, user: result.rows[0] });
}

async function updateUser(tenantId: string, userId: string, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const allowedFields = ['display_name', 'role', 'status'];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      setClauses.push(`${field} = $${idx}`);
      values.push(body[field]);
      idx++;
    }
  }
  if (setClauses.length === 0) return createErrorResponse('No fields to update', 400);

  values.push(tenantId, userId);
  const result = await db.query(
    `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE tenant_id = $${idx} AND id = $${idx + 1} RETURNING *`,
    values
  );
  if (result.rows.length === 0) return createErrorResponse('User not found', 404);
  return createResponse({ success: true, user: result.rows[0] });
}

async function suspendUser(tenantId: string, userId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `UPDATE users SET status = 'suspended', updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 RETURNING id, status`,
    [tenantId, userId]
  );
  if (result.rows.length === 0) return createErrorResponse('User not found', 404);
  return createResponse({ success: true, user: result.rows[0] });
}

async function activateUser(tenantId: string, userId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `UPDATE users SET status = 'active', updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 RETURNING id, status`,
    [tenantId, userId]
  );
  if (result.rows.length === 0) return createErrorResponse('User not found', 404);
  return createResponse({ success: true, user: result.rows[0] });
}

// =============================================================================
// Settings
// =============================================================================

async function getSettings(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT settings FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (result.rows.length === 0) return createErrorResponse('Tenant not found', 404);
  return createResponse({ success: true, settings: result.rows[0].settings || {} });
}

async function updateSettings(tenantId: string, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `UPDATE tenants SET settings = settings || $2::jsonb, updated_at = NOW()
     WHERE id = $1 RETURNING settings`,
    [tenantId, JSON.stringify(body)]
  );
  if (result.rows.length === 0) return createErrorResponse('Tenant not found', 404);
  return createResponse({ success: true, settings: result.rows[0].settings });
}

// =============================================================================
// Security
// =============================================================================

async function getSecurityConfig(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT compliance_mode, settings->'security' as security_config
     FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (result.rows.length === 0) return createErrorResponse('Tenant not found', 404);
  return createResponse({
    success: true,
    security: {
      compliance_mode: result.rows[0].compliance_mode,
      config: result.rows[0].security_config || {},
    },
  });
}

async function updateSecurityConfig(tenantId: string, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `UPDATE tenants SET settings = jsonb_set(
       coalesce(settings, '{}'::jsonb),
       '{security}',
       $2::jsonb
     ), updated_at = NOW()
     WHERE id = $1 RETURNING settings->'security' as security_config`,
    [tenantId, JSON.stringify(body)]
  );
  if (result.rows.length === 0) return createErrorResponse('Tenant not found', 404);
  return createResponse({ success: true, security: result.rows[0].security_config });
}

async function getAuditLog(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, user_id, action, resource_type, resource_id, ip_address, created_at
     FROM audit_logs
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [tenantId]
  );
  return createResponse({ success: true, logs: result.rows });
}

// =============================================================================
// Collaboration
// =============================================================================

async function getCollaborationConfig(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT settings->'collaboration' as collaboration_config FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (result.rows.length === 0) return createErrorResponse('Tenant not found', 404);
  return createResponse({
    success: true,
    collaboration: result.rows[0].collaboration_config || {
      enabled: true,
      max_participants: 10,
      allow_external: false,
      require_approval: true,
    },
  });
}

async function updateCollaborationConfig(tenantId: string, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `UPDATE tenants SET settings = jsonb_set(
       coalesce(settings, '{}'::jsonb),
       '{collaboration}',
       $2::jsonb
     ), updated_at = NOW()
     WHERE id = $1 RETURNING settings->'collaboration' as collaboration_config`,
    [tenantId, JSON.stringify(body)]
  );
  if (result.rows.length === 0) return createErrorResponse('Tenant not found', 404);
  return createResponse({ success: true, collaboration: result.rows[0].collaboration_config });
}

// =============================================================================
// Cartridges
// =============================================================================

async function getCartridges(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, tenant_id, name, description, type, status, is_system,
            priority, created_at, updated_at
     FROM cartridges
     WHERE tenant_id = $1 OR is_system = true
     ORDER BY priority DESC, created_at`,
    [tenantId]
  );
  return createResponse({ success: true, cartridges: result.rows });
}

async function getCartridgeStack(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, name, type, priority, status
     FROM cartridges
     WHERE (tenant_id = $1 OR is_system = true) AND status = 'active'
     ORDER BY priority DESC`,
    [tenantId]
  );
  return createResponse({ success: true, stack: result.rows });
}

async function createCartridge(tenantId: string, userId: string | undefined, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO cartridges (id, tenant_id, name, description, type, status, is_system, priority, created_by)
     VALUES ($1, $2, $3, $4, $5, 'draft', false, $6, $7)
     RETURNING *`,
    [id, tenantId, body.name, body.description || '', body.type || 'custom', body.priority || 50, userId || null]
  );
  return createResponse({ success: true, cartridge: result.rows[0] }, 201);
}

async function activateCartridge(tenantId: string, cartridgeId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `UPDATE cartridges SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [cartridgeId, tenantId]
  );
  if (result.rows.length === 0) return createErrorResponse('Cartridge not found', 404);
  return createResponse({ success: true, cartridge: result.rows[0] });
}

async function deactivateCartridge(tenantId: string, cartridgeId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `UPDATE cartridges SET status = 'inactive', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND is_system = false RETURNING *`,
    [cartridgeId, tenantId]
  );
  if (result.rows.length === 0) return createErrorResponse('Cartridge not found or is system cartridge', 404);
  return createResponse({ success: true, cartridge: result.rows[0] });
}

async function deleteCartridge(tenantId: string, cartridgeId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `DELETE FROM cartridges WHERE id = $1 AND tenant_id = $2 AND is_system = false RETURNING id`,
    [cartridgeId, tenantId]
  );
  if (result.rows.length === 0) return createErrorResponse('Cartridge not found or is system cartridge', 404);
  return createResponse({ success: true });
}

// =============================================================================
// Reports
// =============================================================================

async function getReports(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, tenant_id, report_type, title, status, generated_at, parameters
     FROM tenant_reports
     WHERE tenant_id = $1
     ORDER BY generated_at DESC
     LIMIT 50`,
    [tenantId]
  );
  return createResponse({ success: true, reports: result.rows });
}

async function getReportDetail(tenantId: string, reportId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT * FROM tenant_reports WHERE id = $1 AND tenant_id = $2`,
    [reportId, tenantId]
  );
  if (result.rows.length === 0) return createErrorResponse('Report not found', 404);
  return createResponse({ success: true, report: result.rows[0] });
}

// =============================================================================
// API Keys — Credential Lifecycle Management
// =============================================================================

async function listApiKeys(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, name, key_prefix, interface_type, scopes,
            allowed_ips, allowed_origins, allowed_endpoints,
            rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
            is_active, expires_at, last_used_at, use_count,
            dormant_flagged_at, dormant_warning_level,
            replaced_by_key_id, replaces_key_id,
            created_at, updated_at, revoked_at
     FROM api_keys
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return createResponse({ success: true, keys: result.rows });
}

async function createApiKey(
  tenantId: string,
  userId: string | undefined,
  body: Record<string, unknown>,
): Promise<APIGatewayProxyResult> {
  const { createHash, randomBytes } = await import('crypto');
  const keyBytes = randomBytes(32);
  const raw = `rad_${keyBytes.toString('base64url')}`;
  const prefix = raw.substring(0, 12);
  const hash = createHash('sha256').update(raw).digest('hex');

  // Get tenant default expiry
  const tenantResult = await db.query(
    `SELECT api_key_default_expiry_days, api_key_max_expiry_days, require_api_key_ip_restriction
     FROM tenants WHERE id = $1`,
    [tenantId]
  );
  const tenant = tenantResult.rows[0] || {};
  const defaultExpiry = Number(tenant.api_key_default_expiry_days) || 90;
  const maxExpiry = Number(tenant.api_key_max_expiry_days) || 365;

  // Validate IP restriction requirement
  if (tenant.require_api_key_ip_restriction && !body.allowed_ips) {
    return createErrorResponse('This tenant requires IP restrictions on all API keys', 400);
  }

  // Calculate expiry
  let expiryDays = body.expiry_days ? Number(body.expiry_days) : defaultExpiry;
  if (expiryDays > maxExpiry) expiryDays = maxExpiry;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const result = await db.query(
    `INSERT INTO api_keys (
      tenant_id, name, description, key_prefix, key_hash,
      interface_type, scopes,
      allowed_ips, allowed_origins,
      rate_limit_per_minute,
      is_active, expires_at,
      created_by, created_by_app
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, 'thinktank_admin')
    RETURNING id, name, key_prefix, interface_type, scopes, expires_at, created_at`,
    [
      tenantId,
      body.name || 'Untitled Key',
      body.description || null,
      prefix,
      hash,
      body.interface_type || 'api',
      body.scopes || ['chat', 'models'],
      body.allowed_ips ? JSON.stringify(body.allowed_ips) : null,
      body.allowed_origins ? JSON.stringify(body.allowed_origins) : null,
      body.rate_limit_per_minute || null,
      expiresAt.toISOString(),
      userId || null,
    ]
  );

  // Log creation
  await db.query(
    `INSERT INTO api_key_audit_log (tenant_id, key_id, action, details)
     VALUES ($1, $2, 'created', $3::jsonb)`,
    [tenantId, result.rows[0].id, JSON.stringify({ created_by: userId, interface_type: body.interface_type || 'api' })]
  );

  return createResponse({
    success: true,
    key: {
      ...result.rows[0],
      raw_key: raw, // Only returned once!
    },
  }, 201);
}

async function rotateApiKey(
  tenantId: string,
  keyId: string,
  userId: string | undefined,
): Promise<APIGatewayProxyResult> {
  const { createHash, randomBytes } = await import('crypto');
  const keyBytes = randomBytes(32);
  const raw = `rad_${keyBytes.toString('base64url')}`;
  const prefix = raw.substring(0, 12);
  const hash = createHash('sha256').update(raw).digest('hex');

  // Use the DB function for atomic rotation
  const result = await db.query(
    `SELECT * FROM rotate_api_key($1::uuid, $2, $3)`,
    [String(keyId), prefix, hash]
  );

  if (!result.rows[0]?.success) {
    return createErrorResponse(String(result.rows[0]?.error_message || 'Rotation failed'), 400);
  }

  return createResponse({
    success: true,
    new_key: {
      id: result.rows[0].new_key_id,
      raw_key: raw, // Only returned once!
      prefix,
      replaces_key_id: keyId,
    },
  });
}

async function updateKeyRestrictions(
  tenantId: string,
  keyId: string,
  body: Record<string, unknown>,
): Promise<APIGatewayProxyResult> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  if (body.allowed_ips !== undefined) {
    setClauses.push(`allowed_ips = $${idx}`);
    values.push(body.allowed_ips ? JSON.stringify(body.allowed_ips) : null);
    idx++;
  }
  if (body.allowed_origins !== undefined) {
    setClauses.push(`allowed_origins = $${idx}`);
    values.push(body.allowed_origins ? JSON.stringify(body.allowed_origins) : null);
    idx++;
  }
  if (body.allowed_endpoints !== undefined) {
    setClauses.push(`allowed_endpoints = $${idx}`);
    values.push(body.allowed_endpoints || null);
    idx++;
  }
  if (body.denied_endpoints !== undefined) {
    setClauses.push(`denied_endpoints = $${idx}`);
    values.push(body.denied_endpoints || null);
    idx++;
  }
  if (body.rate_limit_per_minute !== undefined) {
    setClauses.push(`rate_limit_per_minute = $${idx}`);
    values.push(body.rate_limit_per_minute);
    idx++;
  }

  values.push(keyId, tenantId);
  const result = await db.query(
    `UPDATE api_keys SET ${setClauses.join(', ')}
     WHERE id = $${idx} AND tenant_id = $${idx + 1}
     RETURNING id, name, allowed_ips, allowed_origins, allowed_endpoints, denied_endpoints, rate_limit_per_minute`,
    values
  );

  if (result.rows.length === 0) return createErrorResponse('API key not found', 404);

  await db.query(
    `INSERT INTO api_key_audit_log (tenant_id, key_id, action, details)
     VALUES ($1, $2, 'updated', $3::jsonb)`,
    [tenantId, keyId, JSON.stringify({ updated_fields: Object.keys(body) })]
  );

  return createResponse({ success: true, key: result.rows[0] });
}

async function revokeApiKey(
  tenantId: string,
  keyId: string,
  userId: string | undefined,
): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `UPDATE api_keys SET
       is_active = false,
       revoked_at = NOW(),
       revoked_by = $3,
       revoked_reason = 'manual_revoke',
       updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING id, name, key_prefix`,
    [keyId, tenantId, userId || null]
  );

  if (result.rows.length === 0) return createErrorResponse('API key not found', 404);

  await db.query(
    `INSERT INTO api_key_audit_log (tenant_id, key_id, action, details)
     VALUES ($1, $2, 'revoked', $3::jsonb)`,
    [tenantId, keyId, JSON.stringify({ revoked_by: userId, reason: 'manual_revoke' })]
  );

  return createResponse({ success: true, key: result.rows[0] });
}
