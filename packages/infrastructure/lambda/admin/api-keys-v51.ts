/**
 * RADIANT v5.1.1 - Service API Keys Admin Handler
 * 
 * Full CRUD for service API keys with:
 * - Scoped permissions
 * - Rate limiting
 * - IP restrictions
 * - Audit logging
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomBytes, createHash } from 'crypto';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { successResponse, handleError, notFoundResponse, validationErrorResponse } from '../shared/middleware/api-response';
import { extractAuthContext, requireAdmin } from '../shared/auth';
import type { ServiceApiKey, ApiKeyScope, CreateApiKeyRequest, CreateApiKeyResponse, ApiKeyAuditEntry } from '@radiant/shared';

const API_KEY_PREFIX = 'rdk_'; // RADIANT API Key prefix
const KEY_HASH_ALGO = 'sha256';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    // GET /api/admin/service-api-keys - List all keys
    if (method === 'GET' && path.endsWith('/service-api-keys')) {
      return await listApiKeys(event);
    }

    // POST /api/admin/service-api-keys - Create new key
    if (method === 'POST' && path.endsWith('/service-api-keys')) {
      return await createApiKey(event, auth.userId, auth.tenantId);
    }

    // GET /api/admin/service-api-keys/:id - Get key details
    if (method === 'GET' && path.match(/\/service-api-keys\/[^/]+$/)) {
      const keyId = path.split('/').pop()!;
      return await getApiKey(keyId);
    }

    // PUT /api/admin/service-api-keys/:id - Update key
    if (method === 'PUT' && path.match(/\/service-api-keys\/[^/]+$/)) {
      const keyId = path.split('/').pop()!;
      return await updateApiKey(keyId, event, auth.userId);
    }

    // DELETE /api/admin/service-api-keys/:id - Revoke key
    if (method === 'DELETE' && path.match(/\/service-api-keys\/[^/]+$/)) {
      const keyId = path.split('/').pop()!;
      return await revokeApiKey(keyId, event, auth.userId);
    }

    // POST /api/admin/service-api-keys/:id/rotate - Rotate key
    if (method === 'POST' && path.includes('/rotate')) {
      const keyId = path.split('/service-api-keys/')[1].split('/')[0];
      return await rotateApiKey(keyId, auth.userId, auth.tenantId);
    }

    // GET /api/admin/service-api-keys/:id/audit - Get audit log
    if (method === 'GET' && path.includes('/audit')) {
      const keyId = path.split('/service-api-keys/')[1].split('/')[0];
      return await getAuditLog(keyId, event);
    }

    // GET /api/admin/service-api-keys/scopes - List available scopes
    if (method === 'GET' && path.endsWith('/scopes')) {
      return await listScopes();
    }

    return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    logger.error('Service API Keys error', error instanceof Error ? error : undefined);
    return handleError(error);
  }
}

async function listApiKeys(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { tenant_id, status, scope, limit = '50', offset = '0' } = event.queryStringParameters || {};
  const client = await getPoolClient();

  try {
    let query = `
      SELECT 
        id, tenant_id, name, description, key_prefix,
        scopes, is_active, expires_at, last_used_at, use_count,
        rate_limit_per_minute, rate_limit_per_day, allowed_ip_addresses,
        created_at, created_by, revoked_at, revoked_by, revoked_reason
      FROM service_api_keys
      WHERE 1=1
    `;
    const params: (string | boolean | number)[] = [];
    let paramIndex = 1;

    if (tenant_id) {
      query += ` AND tenant_id = $${paramIndex++}`;
      params.push(tenant_id);
    }
    if (status === 'active') {
      query += ` AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())`;
    } else if (status === 'revoked') {
      query += ` AND revoked_at IS NOT NULL`;
    } else if (status === 'expired') {
      query += ` AND expires_at < NOW()`;
    }
    if (scope) {
      query += ` AND $${paramIndex++} = ANY(scopes)`;
      params.push(scope);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await client.query(query, params);
    
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM service_api_keys
    `);

    const keys = result.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      keyPrefix: row.key_prefix,
      scopes: row.scopes,
      isActive: row.is_active,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      useCount: row.use_count,
      rateLimitPerMinute: row.rate_limit_per_minute,
      rateLimitPerDay: row.rate_limit_per_day,
      allowedIpAddresses: row.allowed_ip_addresses,
      createdAt: row.created_at,
      createdBy: row.created_by,
      revokedAt: row.revoked_at,
      revokedBy: row.revoked_by,
      revokedReason: row.revoked_reason,
    }));

    return successResponse({ 
      data: keys,
      meta: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
      }
    });
  } finally {
    client.release();
  }
}

async function createApiKey(event: APIGatewayProxyEvent, userId: string, adminTenantId: string): Promise<APIGatewayProxyResult> {
  const body: any = JSON.parse(event.body || '{}');

  if (!body.name || !body.tenantId || !body.scopes?.length) {
    return validationErrorResponse('Missing required fields', {
      name: !body.name ? ['Name is required'] : [],
      tenantId: !body.tenantId ? ['Tenant ID is required'] : [],
      scopes: !body.scopes?.length ? ['At least one scope is required'] : [],
    });
  }

  // Generate secure API key
  const rawKey = randomBytes(32).toString('base64url');
  const fullKey = `${API_KEY_PREFIX}${rawKey}`;
  const keyHash = createHash(KEY_HASH_ALGO).update(fullKey).digest('hex');
  const keyPrefix = fullKey.substring(0, 12);

  const client = await getPoolClient();
  try {
    const result = await client.query(`
      INSERT INTO service_api_keys (
        tenant_id, name, description, key_hash, key_prefix,
        scopes, expires_at, rate_limit_per_minute, rate_limit_per_day,
        allowed_ip_addresses, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, tenant_id, name, description, key_prefix, scopes, is_active,
        expires_at, rate_limit_per_minute, rate_limit_per_day, allowed_ip_addresses,
        created_at, created_by
    `, [
      body.tenantId,
      body.name,
      body.description || null,
      keyHash,
      keyPrefix,
      body.scopes,
      body.expiresAt || null,
      body.rateLimitPerMinute || 100,
      body.rateLimitPerDay || 10000,
      body.allowedIpAddresses || null,
      userId,
    ]);

    const row = result.rows[0];
    const response = {
      key: {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        description: row.description,
        keyPrefix: row.key_prefix,
        scopes: row.scopes,
        isActive: row.is_active,
        expiresAt: row.expires_at,
        lastUsedAt: null,
        useCount: 0,
        rateLimitPerMinute: row.rate_limit_per_minute,
        rateLimitPerDay: row.rate_limit_per_day,
        allowedIpAddresses: row.allowed_ip_addresses,
        createdAt: row.created_at,
        createdBy: row.created_by,
      },
      rawKey: fullKey,
      warning: 'Store this key securely. It will not be shown again.',
    };

    // Audit log
    await client.query(`
      INSERT INTO service_api_key_audit (key_id, action, details, performed_by, ip_address)
      VALUES ($1, 'created', $2, $3, $4)
    `, [row.id, JSON.stringify({ name: body.name, scopes: body.scopes }), userId, getClientIp(event)]);

    return successResponse({ data: response, statusCode: 201 });
  } finally {
    client.release();
  }
}

async function getApiKey(keyId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  try {
    const result = await client.query(`
      SELECT * FROM service_api_keys WHERE id = $1
    `, [keyId]);

    if (result.rows.length === 0) {
      return notFoundResponse('API Key', keyId);
    }

    const row = result.rows[0];
    const key = {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      keyPrefix: row.key_prefix,
      scopes: row.scopes,
      isActive: row.is_active,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      usageCount: row.use_count,
      rateLimitPerMinute: row.rate_limit_per_minute,
      rateLimitPerDay: row.rate_limit_per_day,
      allowedIpAddresses: row.allowed_ip_addresses,
      createdAt: row.created_at,
      createdBy: row.created_by,
      revokedAt: row.revoked_at,
      revokedBy: row.revoked_by,
      revokedReason: row.revoked_reason,
    };

    return successResponse({ data: key });
  } finally {
    client.release();
  }
}

async function updateApiKey(keyId: string, event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const client = await getPoolClient();

  try {
    const result = await client.query(`
      UPDATE service_api_keys SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        scopes = COALESCE($3, scopes),
        expires_at = COALESCE($4, expires_at),
        rate_limit_per_minute = COALESCE($5, rate_limit_per_minute),
        rate_limit_per_day = COALESCE($6, rate_limit_per_day),
        allowed_ip_addresses = COALESCE($7, allowed_ip_addresses),
        is_active = COALESCE($8, is_active)
      WHERE id = $9 AND revoked_at IS NULL
      RETURNING *
    `, [
      body.name,
      body.description,
      body.scopes,
      body.expiresAt,
      body.rateLimitPerMinute,
      body.rateLimitPerDay,
      body.allowedIpAddresses,
      body.isActive,
      keyId,
    ]);

    if (result.rows.length === 0) {
      return notFoundResponse('API Key', keyId);
    }

    // Audit log
    await client.query(`
      INSERT INTO service_api_key_audit (key_id, action, details, performed_by, ip_address)
      VALUES ($1, 'updated', $2, $3, $4)
    `, [keyId, JSON.stringify(body), userId, getClientIp(event)]);

    return successResponse({ data: result.rows[0], message: 'API key updated' });
  } finally {
    client.release();
  }
}

async function revokeApiKey(keyId: string, event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const client = await getPoolClient();

  try {
    const result = await client.query(`
      UPDATE service_api_keys SET
        is_active = false,
        revoked_at = NOW(),
        revoked_by = $1,
        revoked_reason = $2
      WHERE id = $3 AND revoked_at IS NULL
      RETURNING id, name
    `, [userId, body.reason || 'Manually revoked', keyId]);

    if (result.rows.length === 0) {
      return notFoundResponse('API Key', keyId);
    }

    // Audit log
    await client.query(`
      INSERT INTO service_api_key_audit (key_id, action, details, performed_by, ip_address)
      VALUES ($1, 'revoked', $2, $3, $4)
    `, [keyId, JSON.stringify({ reason: body.reason }), userId, getClientIp(event)]);

    return successResponse({ message: `API key '${result.rows[0].name}' revoked` });
  } finally {
    client.release();
  }
}

async function rotateApiKey(keyId: string, userId: string, tenantId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();

  try {
    // Get existing key
    const existing = await client.query(`SELECT * FROM service_api_keys WHERE id = $1 AND revoked_at IS NULL`, [keyId]);
    if (existing.rows.length === 0) {
      return notFoundResponse('API Key', keyId);
    }

    const oldKey = existing.rows[0];

    // Generate new key
    const rawKey = randomBytes(32).toString('base64url');
    const fullKey = `${API_KEY_PREFIX}${rawKey}`;
    const keyHash = createHash(KEY_HASH_ALGO).update(fullKey).digest('hex');
    const keyPrefix = fullKey.substring(0, 12);

    // Update with new hash
    await client.query(`
      UPDATE service_api_keys SET
        key_hash = $1,
        key_prefix = $2,
        use_count = 0,
        last_used_at = NULL
      WHERE id = $3
    `, [keyHash, keyPrefix, keyId]);

    // Audit log
    await client.query(`
      INSERT INTO service_api_key_audit (key_id, action, details, performed_by)
      VALUES ($1, 'rotated', $2, $3)
    `, [keyId, JSON.stringify({ oldPrefix: oldKey.key_prefix, newPrefix: keyPrefix }), userId]);

    return successResponse({
      data: {
        id: keyId,
        rawKey: fullKey,
        keyPrefix,
      },
      warning: 'Store this key securely. It will not be shown again.',
    });
  } finally {
    client.release();
  }
}

async function getAuditLog(keyId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { limit = '100', offset = '0' } = event.queryStringParameters || {};
  const client = await getPoolClient();

  try {
    const result = await client.query(`
      SELECT * FROM service_api_key_audit
      WHERE key_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [keyId, parseInt(limit), parseInt(offset)]);

    const entries = result.rows.map((row: any) => ({
      id: row.id,
      keyId: row.key_id,
      action: row.action,
      endpoint: row.endpoint,
      statusCode: row.status_code,
      responseTimeMs: row.response_time_ms,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      details: row.details,
      performedBy: row.performed_by,
      createdAt: row.created_at,
    }));

    return successResponse({ data: entries });
  } finally {
    client.release();
  }
}

async function listScopes(): Promise<APIGatewayProxyResult> {
  const scopes: { scope: ApiKeyScope; description: string; category: string }[] = [
    { scope: 'chat:read', description: 'Read chat conversations', category: 'Chat' },
    { scope: 'chat:write', description: 'Create and update chat messages', category: 'Chat' },
    { scope: 'models:read', description: 'List and view AI models', category: 'Models' },
    { scope: 'embeddings:write', description: 'Generate vector embeddings', category: 'Embeddings' },
    { scope: 'files:read', description: 'Read uploaded files', category: 'Files' },
    { scope: 'files:write', description: 'Upload and delete files', category: 'Files' },
    { scope: 'knowledge:read', description: 'Query knowledge graph', category: 'Knowledge' },
    { scope: 'knowledge:write', description: 'Update knowledge graph', category: 'Knowledge' },
    { scope: 'admin:read', description: 'Read administrative data', category: 'Admin' },
    { scope: 'admin:write', description: 'Perform administrative actions', category: 'Admin' },
  ];

  return successResponse({ data: scopes });
}

function getClientIp(event: APIGatewayProxyEvent): string {
  return event.requestContext?.identity?.sourceIp || 
         event.headers?.['X-Forwarded-For']?.split(',')[0] || 
         'unknown';
}
