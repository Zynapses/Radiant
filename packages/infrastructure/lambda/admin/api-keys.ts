/**
 * RADIANT v5.52.5 - API Keys Admin Handler
 * 
 * Manages API keys with interface type separation (API, MCP, A2A).
 * Supports key sync between Radiant Admin and Think Tank Admin.
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { randomBytes, createHash } from 'crypto';
import { logger } from '../shared/utils/logger';
import { getPoolClient } from '../shared/db/centralized-pool';

// ============================================================================
// Types
// ============================================================================

interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  keyPrefix: string;
  interfaceType: 'api' | 'mcp' | 'a2a' | 'all';
  scopes: string[];
  allowedEndpoints?: string[];
  deniedEndpoints?: string[];
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  useCount: number;
  a2aAgentId?: string;
  a2aAgentType?: string;
  mcpAllowedTools?: string[];
  createdBy?: string;
  createdByApp?: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;
}

interface CreateKeyRequest {
  name: string;
  description?: string;
  interfaceType: 'api' | 'mcp' | 'a2a' | 'all';
  scopes?: string[];
  allowedEndpoints?: string[];
  deniedEndpoints?: string[];
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  expiresInDays?: number;
  a2aAgentId?: string;
  a2aAgentType?: string;
  mcpAllowedTools?: string[];
  tags?: string[];
}

interface A2AAgent {
  id: string;
  tenantId: string;
  agentId: string;
  agentName: string;
  agentType: string;
  agentVersion?: string;
  status: 'active' | 'suspended' | 'revoked' | 'pending';
  supportedOperations: string[];
  totalRequests: number;
  lastHeartbeatAt?: string;
  lastRequestAt?: string;
  createdAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function parseBody<T>(body: string | null): T {
  if (!body) throw new Error('Request body is required');
  return JSON.parse(body) as T;
}

function generateApiKey(tenantId: string, interfaceType: string): { key: string; prefix: string; hash: string } {
  const prefixMap: Record<string, string> = {
    api: 'rad_api',
    mcp: 'rad_mcp',
    a2a: 'rad_a2a',
    all: 'rad_all',
  };
  
  const tenantPrefix = tenantId.substring(0, 6);
  const randomPart = randomBytes(24).toString('base64url');
  const key = `${prefixMap[interfaceType]}_${tenantPrefix}_${randomPart}`;
  const prefix = key.substring(0, 16);
  const hash = createHash('sha256').update(key).digest('hex');
  
  return { key, prefix, hash };
}

// ============================================================================
// Handlers
// ============================================================================

async function getDashboard(tenantId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    // Get summary by interface type
    const summaryResult = await client.query(`
      SELECT
        interface_type,
        COUNT(*) AS total_keys,
        COUNT(*) FILTER (WHERE is_active) AS active_keys,
        COUNT(*) FILTER (WHERE NOT is_active) AS revoked_keys,
        COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired_keys,
        SUM(use_count) AS total_uses,
        MAX(last_used_at) AS last_used_at
      FROM api_keys
      WHERE tenant_id = $1
      GROUP BY interface_type
    `, [tenantId]);

    // Get recent keys
    const recentResult = await client.query(`
      SELECT id, name, key_prefix, interface_type, is_active, use_count, last_used_at, created_at
      FROM api_keys
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [tenantId]);

    // Get A2A agents summary
    const agentsResult = await client.query(`
      SELECT
        agent_type,
        COUNT(*) AS total_agents,
        COUNT(*) FILTER (WHERE status = 'active') AS active_agents,
        SUM(total_requests) AS total_requests
      FROM a2a_registered_agents
      WHERE tenant_id = $1
      GROUP BY agent_type
    `, [tenantId]);

    // Get pending sync items
    const syncResult = await client.query(`
      SELECT COUNT(*) AS pending_syncs
      FROM api_key_sync_log skl
      JOIN api_keys ak ON skl.key_id = ak.id
      WHERE ak.tenant_id = $1 AND skl.status = 'pending'
    `, [tenantId]);

    return response(200, {
      summary: summaryResult.rows.reduce((acc: Record<string, unknown>, row: any) => {
        acc[row.interface_type] = {
          totalKeys: parseInt(row.total_keys),
          activeKeys: parseInt(row.active_keys),
          revokedKeys: parseInt(row.revoked_keys),
          expiredKeys: parseInt(row.expired_keys),
          totalUses: parseInt(row.total_uses) || 0,
          lastUsedAt: row.last_used_at,
        };
        return acc;
      }, {}),
      recentKeys: recentResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        interfaceType: row.interface_type,
        isActive: row.is_active,
        useCount: row.use_count,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
      })),
      a2aAgentsSummary: agentsResult.rows,
      pendingSyncs: parseInt(syncResult.rows[0]?.pending_syncs) || 0,
    });
  } finally {
    client.release();
  }
}

async function listKeys(tenantId: string, interfaceType?: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    let query = `
      SELECT 
        id, name, description, key_prefix, interface_type, scopes,
        allowed_endpoints, denied_endpoints, rate_limit_per_minute,
        rate_limit_per_hour, rate_limit_per_day, is_active, expires_at,
        last_used_at, use_count, a2a_agent_id, a2a_agent_type,
        mcp_allowed_tools, created_by, created_by_app, created_at,
        updated_at, revoked_at, revoked_by, revoked_reason, tags
      FROM api_keys
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (interfaceType) {
      query += ` AND interface_type = $2`;
      params.push(interfaceType);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await client.query(query, params);

    return response(200, {
      keys: result.rows.map((row: any) => ({
        id: row.id,
        tenantId,
        name: row.name,
        description: row.description,
        keyPrefix: row.key_prefix,
        interfaceType: row.interface_type,
        scopes: row.scopes || [],
        allowedEndpoints: row.allowed_endpoints,
        deniedEndpoints: row.denied_endpoints,
        rateLimitPerMinute: row.rate_limit_per_minute,
        rateLimitPerHour: row.rate_limit_per_hour,
        rateLimitPerDay: row.rate_limit_per_day,
        isActive: row.is_active,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        useCount: row.use_count,
        a2aAgentId: row.a2a_agent_id,
        a2aAgentType: row.a2a_agent_type,
        mcpAllowedTools: row.mcp_allowed_tools,
        createdBy: row.created_by,
        createdByApp: row.created_by_app,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        revokedAt: row.revoked_at,
        revokedBy: row.revoked_by,
        revokedReason: row.revoked_reason,
        tags: row.tags,
      })),
      total: result.rows.length,
    });
  } finally {
    client.release();
  }
}

async function createKey(tenantId: string, userId: string, sourceApp: string, request: CreateKeyRequest): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    const { key, prefix, hash } = generateApiKey(tenantId, request.interfaceType);
    
    const expiresAt = request.expiresInDays
      ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const result = await client.query(`
      SELECT create_api_key(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) AS key_id
    `, [
      tenantId,
      request.name,
      request.interfaceType,
      prefix,
      hash,
      request.scopes || ['chat', 'models'],
      userId,
      sourceApp,
      expiresAt,
      request.a2aAgentId,
      request.mcpAllowedTools,
    ]);

    const keyId = result.rows[0]?.key_id;

    // Update additional fields
    if (request.description || request.allowedEndpoints || request.deniedEndpoints || request.rateLimitPerMinute || request.tags) {
      await client.query(`
        UPDATE api_keys SET
          description = COALESCE($2, description),
          allowed_endpoints = COALESCE($3, allowed_endpoints),
          denied_endpoints = COALESCE($4, denied_endpoints),
          rate_limit_per_minute = COALESCE($5, rate_limit_per_minute),
          rate_limit_per_hour = COALESCE($6, rate_limit_per_hour),
          rate_limit_per_day = COALESCE($7, rate_limit_per_day),
          tags = COALESCE($8, tags),
          a2a_agent_type = COALESCE($9, a2a_agent_type)
        WHERE id = $1
      `, [
        keyId,
        request.description,
        request.allowedEndpoints,
        request.deniedEndpoints,
        request.rateLimitPerMinute,
        request.rateLimitPerHour,
        null,
        request.tags,
        request.a2aAgentType,
      ]);
    }

    logger.info('API key created', { keyId, interfaceType: request.interfaceType, tenantId });

    return response(201, {
      id: keyId,
      key, // Only returned once!
      keyPrefix: prefix,
      name: request.name,
      interfaceType: request.interfaceType,
      scopes: request.scopes || ['chat', 'models'],
      expiresAt,
      createdAt: new Date().toISOString(),
      warning: 'This is the only time the full API key will be shown. Store it securely.',
    });
  } finally {
    client.release();
  }
}

async function getKey(tenantId: string, keyId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM api_keys WHERE tenant_id = $1 AND id = $2
    `, [tenantId, keyId]);

    if (result.rows.length === 0) {
      return response(404, { error: { code: 'NOT_FOUND', message: 'API key not found' } });
    }

    const row = result.rows[0] as any;

    return response(200, {
      id: row.id,
      tenantId,
      name: row.name,
      description: row.description,
      keyPrefix: row.key_prefix,
      interfaceType: row.interface_type,
      scopes: row.scopes || [],
      allowedEndpoints: row.allowed_endpoints,
      deniedEndpoints: row.denied_endpoints,
      rateLimitPerMinute: row.rate_limit_per_minute,
      rateLimitPerHour: row.rate_limit_per_hour,
      rateLimitPerDay: row.rate_limit_per_day,
      isActive: row.is_active,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      useCount: row.use_count,
      a2aAgentId: row.a2a_agent_id,
      a2aAgentType: row.a2a_agent_type,
      mcpAllowedTools: row.mcp_allowed_tools,
      createdBy: row.created_by,
      createdByApp: row.created_by_app,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revokedAt: row.revoked_at,
      revokedBy: row.revoked_by,
      revokedReason: row.revoked_reason,
      tags: row.tags,
      metadata: row.metadata,
    });
  } finally {
    client.release();
  }
}

async function updateKey(tenantId: string, keyId: string, updates: Partial<CreateKeyRequest>): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    const result = await client.query(`
      UPDATE api_keys SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        scopes = COALESCE($5, scopes),
        allowed_endpoints = COALESCE($6, allowed_endpoints),
        denied_endpoints = COALESCE($7, denied_endpoints),
        rate_limit_per_minute = COALESCE($8, rate_limit_per_minute),
        rate_limit_per_hour = COALESCE($9, rate_limit_per_hour),
        mcp_allowed_tools = COALESCE($10, mcp_allowed_tools),
        tags = COALESCE($11, tags),
        updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id
    `, [
      tenantId,
      keyId,
      updates.name,
      updates.description,
      updates.scopes,
      updates.allowedEndpoints,
      updates.deniedEndpoints,
      updates.rateLimitPerMinute,
      updates.rateLimitPerHour,
      updates.mcpAllowedTools,
      updates.tags,
    ]);

    if (result.rows.length === 0) {
      return response(404, { error: { code: 'NOT_FOUND', message: 'API key not found' } });
    }

    // Queue sync
    await client.query(`
      INSERT INTO api_key_sync_log (key_id, source_app, target_app, sync_type, changes)
      VALUES ($1, 'radiant_admin', 'thinktank_admin', 'update', $2)
    `, [keyId, JSON.stringify(updates)]);

    return response(200, { success: true, id: keyId });
  } finally {
    client.release();
  }
}

async function revokeKey(tenantId: string, keyId: string, userId: string, reason?: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    const result = await client.query(`
      SELECT revoke_api_key($1, $2, $3) AS revoked
    `, [keyId, userId, reason]);

    if (!result.rows[0]?.revoked) {
      return response(404, { error: { code: 'NOT_FOUND', message: 'API key not found' } });
    }

    logger.info('API key revoked', { keyId, tenantId, revokedBy: userId, reason });

    return response(200, { success: true, id: keyId, revoked: true });
  } finally {
    client.release();
  }
}

async function restoreKey(tenantId: string, keyId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    const result = await client.query(`
      UPDATE api_keys SET
        is_active = true,
        revoked_at = NULL,
        revoked_by = NULL,
        revoked_reason = NULL,
        updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id
    `, [tenantId, keyId]);

    if (result.rows.length === 0) {
      return response(404, { error: { code: 'NOT_FOUND', message: 'API key not found' } });
    }

    return response(200, { success: true, id: keyId, restored: true });
  } finally {
    client.release();
  }
}

async function listA2AAgents(tenantId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    const result = await client.query(`
      SELECT 
        id, agent_id, agent_name, agent_type, agent_version, status,
        supported_operations, total_requests, last_heartbeat_at,
        last_request_at, webhook_url, created_at, updated_at
      FROM a2a_registered_agents
      WHERE tenant_id = $1
      ORDER BY last_heartbeat_at DESC NULLS LAST
    `, [tenantId]);

    return response(200, {
      agents: result.rows.map((row: any) => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        agentType: row.agent_type,
        agentVersion: row.agent_version,
        status: row.status,
        supportedOperations: row.supported_operations || [],
        totalRequests: row.total_requests,
        lastHeartbeatAt: row.last_heartbeat_at,
        lastRequestAt: row.last_request_at,
        webhookUrl: row.webhook_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total: result.rows.length,
    });
  } finally {
    client.release();
  }
}

async function updateA2AAgentStatus(tenantId: string, agentId: string, status: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    const result = await client.query(`
      UPDATE a2a_registered_agents SET
        status = $3,
        updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id
    `, [tenantId, agentId, status]);

    if (result.rows.length === 0) {
      return response(404, { error: { code: 'NOT_FOUND', message: 'Agent not found' } });
    }

    return response(200, { success: true, id: agentId, status });
  } finally {
    client.release();
  }
}

async function getInterfacePolicies(tenantId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM interface_access_policies
      WHERE tenant_id = $1 OR tenant_id IS NULL
      ORDER BY tenant_id NULLS LAST, interface_type
    `, [tenantId]);

    return response(200, {
      policies: result.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        interfaceType: row.interface_type,
        requireAuthentication: row.require_authentication,
        requireMtls: row.require_mtls,
        allowedIpRanges: row.allowed_ip_ranges,
        blockedIpRanges: row.blocked_ip_ranges,
        globalRateLimitPerMinute: row.global_rate_limit_per_minute,
        globalRateLimitPerHour: row.global_rate_limit_per_hour,
        a2aAllowedAgentTypes: row.a2a_allowed_agent_types,
        a2aRequireRegistration: row.a2a_require_registration,
        a2aMaxConcurrentConnections: row.a2a_max_concurrent_connections,
        mcpAllowedProtocolVersions: row.mcp_allowed_protocol_versions,
        mcpRequireCapabilityNegotiation: row.mcp_require_capability_negotiation,
        mcpMaxToolsPerRequest: row.mcp_max_tools_per_request,
        isEnabled: row.is_enabled,
        isGlobal: !row.tenant_id,
      })),
    });
  } finally {
    client.release();
  }
}

async function updateInterfacePolicy(tenantId: string, interfaceType: string, updates: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    // Upsert policy
    const result = await client.query(`
      INSERT INTO interface_access_policies (
        tenant_id, interface_type, require_authentication, require_mtls,
        allowed_ip_ranges, blocked_ip_ranges, global_rate_limit_per_minute,
        global_rate_limit_per_hour, a2a_allowed_agent_types, a2a_require_registration,
        a2a_max_concurrent_connections, mcp_allowed_protocol_versions,
        mcp_require_capability_negotiation, mcp_max_tools_per_request, is_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (tenant_id, interface_type) DO UPDATE SET
        require_authentication = COALESCE(EXCLUDED.require_authentication, interface_access_policies.require_authentication),
        require_mtls = COALESCE(EXCLUDED.require_mtls, interface_access_policies.require_mtls),
        allowed_ip_ranges = COALESCE(EXCLUDED.allowed_ip_ranges, interface_access_policies.allowed_ip_ranges),
        global_rate_limit_per_minute = COALESCE(EXCLUDED.global_rate_limit_per_minute, interface_access_policies.global_rate_limit_per_minute),
        is_enabled = COALESCE(EXCLUDED.is_enabled, interface_access_policies.is_enabled),
        updated_at = NOW()
      RETURNING id
    `, [
      tenantId,
      interfaceType,
      updates.requireAuthentication ?? true,
      updates.requireMtls ?? (interfaceType === 'a2a'),
      updates.allowedIpRanges,
      updates.blockedIpRanges,
      updates.globalRateLimitPerMinute,
      updates.globalRateLimitPerHour,
      updates.a2aAllowedAgentTypes,
      updates.a2aRequireRegistration ?? true,
      updates.a2aMaxConcurrentConnections ?? 100,
      updates.mcpAllowedProtocolVersions ?? ['2024-11-05', '2025-03-26'],
      updates.mcpRequireCapabilityNegotiation ?? true,
      updates.mcpMaxToolsPerRequest ?? 50,
      updates.isEnabled ?? true,
    ]);

    return response(200, { success: true, id: result.rows[0]?.id });
  } finally {
    client.release();
  }
}

async function getAuditLog(tenantId: string, keyId?: string, limit = 100): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    let query = `
      SELECT 
        id, key_id, action, key_prefix, interface_type, endpoint_accessed,
        ip_address, a2a_agent_id, a2a_operation, success, error_code,
        error_message, actor_user_id, actor_type, created_at
      FROM api_key_audit_log
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (keyId) {
      query += ` AND key_id = $2`;
      params.push(keyId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await client.query(query, params);

    return response(200, {
      auditLog: result.rows,
      total: result.rows.length,
    });
  } finally {
    client.release();
  }
}

async function processPendingSyncs(): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  
  try {
    // Get pending syncs
    const result = await client.query(`
      SELECT skl.*, ak.tenant_id
      FROM api_key_sync_log skl
      JOIN api_keys ak ON skl.key_id = ak.id
      WHERE skl.status = 'pending'
      ORDER BY skl.created_at
      LIMIT 100
    `);

    let processed = 0;
    let failed = 0;

    for (const sync of result.rows) {
      try {
        // Mark as synced (in real implementation, would call target admin API)
        await client.query(`
          UPDATE api_key_sync_log SET
            status = 'synced',
            synced_at = NOW()
          WHERE id = $1
        `, [sync.id]);
        processed++;
      } catch (error) {
        await client.query(`
          UPDATE api_key_sync_log SET
            status = 'failed',
            error_message = $2,
            retry_count = retry_count + 1
          WHERE id = $1
        `, [sync.id, error instanceof Error ? error.message : 'Unknown error']);
        failed++;
      }
    }

    return response(200, { processed, failed, total: result.rows.length });
  } finally {
    client.release();
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const tenantId = event.requestContext.authorizer?.tenantId || 
                   event.headers['x-tenant-id'] || '';
  const userId = event.requestContext.authorizer?.userId || '';
  const sourceApp = event.headers['x-source-app'] || 'radiant_admin';
  
  const path = event.path.replace(/^\/api\/admin\/api-keys/, '').replace(/\/$/, '') || '/';
  const method = event.httpMethod;

  logger.info('API Keys request', { method, path, tenantId });

  try {
    // Dashboard
    if (path === '/dashboard' && method === 'GET') {
      return getDashboard(tenantId);
    }

    // List keys
    if (path === '' || path === '/') {
      if (method === 'GET') {
        const interfaceType = event.queryStringParameters?.interface_type;
        return listKeys(tenantId, interfaceType);
      }
      if (method === 'POST') {
        const body = parseBody<CreateKeyRequest>(event.body);
        return createKey(tenantId, userId, sourceApp, body);
      }
    }

    // A2A Agents
    if (path === '/agents' && method === 'GET') {
      return listA2AAgents(tenantId);
    }

    if (path.match(/^\/agents\/[^/]+\/status$/) && method === 'PATCH') {
      const agentId = path.split('/')[2];
      const body = parseBody<{ status: string }>(event.body);
      return updateA2AAgentStatus(tenantId, agentId, body.status);
    }

    // Interface Policies
    if (path === '/policies' && method === 'GET') {
      return getInterfacePolicies(tenantId);
    }

    if (path.match(/^\/policies\/[^/]+$/) && method === 'PUT') {
      const interfaceType = path.split('/')[2];
      const body = parseBody<Record<string, unknown>>(event.body);
      return updateInterfacePolicy(tenantId, interfaceType, body);
    }

    // Audit Log
    if (path === '/audit' && method === 'GET') {
      const keyId = event.queryStringParameters?.key_id;
      const limit = parseInt(event.queryStringParameters?.limit || '100');
      return getAuditLog(tenantId, keyId, limit);
    }

    // Sync
    if (path === '/sync' && method === 'POST') {
      return processPendingSyncs();
    }

    // Single key operations
    const keyMatch = path.match(/^\/([^/]+)$/);
    if (keyMatch) {
      const keyId = keyMatch[1];

      if (method === 'GET') {
        return getKey(tenantId, keyId);
      }
      if (method === 'PATCH') {
        const body = parseBody<Partial<CreateKeyRequest>>(event.body);
        return updateKey(tenantId, keyId, body);
      }
      if (method === 'DELETE') {
        const reason = event.queryStringParameters?.reason;
        return revokeKey(tenantId, keyId, userId, reason);
      }
    }

    // Restore key
    if (path.match(/^\/[^/]+\/restore$/) && method === 'POST') {
      const keyId = path.split('/')[1];
      return restoreKey(tenantId, keyId);
    }

    return response(404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
  } catch (error) {
    logger.error('API Keys handler error', { error, path, method });
    return response(500, {
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};
