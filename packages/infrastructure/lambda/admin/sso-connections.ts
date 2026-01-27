/**
 * RADIANT v5.1.1 - SSO Connections Admin Handler
 * 
 * Enterprise SSO configuration:
 * - SAML 2.0 and OIDC support
 * - Domain enforcement
 * - Group-to-role mapping
 * - Connection testing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { successResponse, handleError, notFoundResponse, validationErrorResponse } from '../shared/middleware/api-response';
import { extractAuthContext, requireAdmin } from '../shared/auth';
import type { TenantSsoConnection, SsoProtocol, CreateSsoConnectionRequest } from '@radiant/shared';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    // GET /api/admin/sso-connections - List all connections
    if (method === 'GET' && path.endsWith('/sso-connections')) {
      return await listConnections(event);
    }

    // POST /api/admin/sso-connections - Create new connection
    if (method === 'POST' && path.endsWith('/sso-connections')) {
      return await createConnection(event, auth.userId);
    }

    // GET /api/admin/sso-connections/:id - Get connection details
    if (method === 'GET' && path.match(/\/sso-connections\/[^/]+$/)) {
      const connectionId = path.split('/').pop()!;
      return await getConnection(connectionId);
    }

    // PUT /api/admin/sso-connections/:id - Update connection
    if (method === 'PUT' && path.match(/\/sso-connections\/[^/]+$/)) {
      const connectionId = path.split('/').pop()!;
      return await updateConnection(connectionId, event, auth.userId);
    }

    // DELETE /api/admin/sso-connections/:id - Delete connection
    if (method === 'DELETE' && path.match(/\/sso-connections\/[^/]+$/)) {
      const connectionId = path.split('/').pop()!;
      return await deleteConnection(connectionId, auth.userId);
    }

    // POST /api/admin/sso-connections/:id/test - Test connection
    if (method === 'POST' && path.includes('/test')) {
      const connectionId = path.split('/sso-connections/')[1].split('/')[0];
      return await testConnection(connectionId);
    }

    // POST /api/admin/sso-connections/:id/enable - Enable connection
    if (method === 'POST' && path.includes('/enable')) {
      const connectionId = path.split('/sso-connections/')[1].split('/')[0];
      return await toggleConnection(connectionId, true, auth.userId);
    }

    // POST /api/admin/sso-connections/:id/disable - Disable connection
    if (method === 'POST' && path.includes('/disable')) {
      const connectionId = path.split('/sso-connections/')[1].split('/')[0];
      return await toggleConnection(connectionId, false, auth.userId);
    }

    return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    logger.error('SSO Connections error', error instanceof Error ? error : undefined);
    return handleError(error);
  }
}

async function listConnections(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { tenant_id, protocol, enabled } = event.queryStringParameters || {};
  const client = await getPoolClient();

  try {
    let query = `
      SELECT 
        id, tenant_id, name, protocol, is_enabled, is_default,
        idp_entity_id, idp_sso_url, idp_certificate,
        oidc_issuer_url, oidc_client_id,
        enforced_domains, default_role, group_role_mappings,
        allow_jit_provisioning, sync_user_attributes,
        last_used_at, use_count, created_at, updated_at
      FROM tenant_sso_connections
      WHERE 1=1
    `;
    const params: (string | boolean)[] = [];
    let paramIndex = 1;

    if (tenant_id) {
      query += ` AND tenant_id = $${paramIndex++}`;
      params.push(tenant_id);
    }
    if (protocol) {
      query += ` AND protocol = $${paramIndex++}`;
      params.push(protocol);
    }
    if (enabled !== undefined) {
      query += ` AND is_enabled = $${paramIndex++}`;
      params.push(enabled === 'true');
    }

    query += ` ORDER BY created_at DESC`;

    const result = await client.query(query, params);

    const connections: TenantSsoConnection[] = result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      protocol: row.protocol,
      isEnabled: row.is_enabled,
      isDefault: row.is_default,
      idpEntityId: row.idp_entity_id,
      idpSsoUrl: row.idp_sso_url,
      idpCertificate: row.idp_certificate ? '[REDACTED]' : undefined,
      oidcIssuerUrl: row.oidc_issuer_url,
      oidcClientId: row.oidc_client_id,
      oidcClientSecret: undefined, // Never expose
      enforcedDomains: row.enforced_domains,
      defaultRole: row.default_role,
      groupRoleMappings: row.group_role_mappings,
      allowJitProvisioning: row.allow_jit_provisioning,
      syncUserAttributes: row.sync_user_attributes,
      lastUsedAt: row.last_used_at,
      useCount: row.use_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return successResponse({ data: connections });
  } finally {
    client.release();
  }
}

async function createConnection(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  const body: CreateSsoConnectionRequest = JSON.parse(event.body || '{}');

  if (!body.tenantId || !body.name || !body.protocol) {
    return validationErrorResponse('Missing required fields', {
      tenantId: !body.tenantId ? ['Tenant ID is required'] : [],
      name: !body.name ? ['Name is required'] : [],
      protocol: !body.protocol ? ['Protocol is required'] : [],
    });
  }

  // Validate protocol-specific fields
  if (body.protocol === 'saml') {
    if (!body.idpEntityId || !body.idpSsoUrl || !body.idpCertificate) {
      return validationErrorResponse('Missing SAML configuration', {
        idpEntityId: !body.idpEntityId ? ['IdP Entity ID is required for SAML'] : [],
        idpSsoUrl: !body.idpSsoUrl ? ['IdP SSO URL is required for SAML'] : [],
        idpCertificate: !body.idpCertificate ? ['IdP Certificate is required for SAML'] : [],
      });
    }
  } else if (body.protocol === 'oidc') {
    if (!body.oidcIssuerUrl || !body.oidcClientId || !body.oidcClientSecret) {
      return validationErrorResponse('Missing OIDC configuration', {
        oidcIssuerUrl: !body.oidcIssuerUrl ? ['Issuer URL is required for OIDC'] : [],
        oidcClientId: !body.oidcClientId ? ['Client ID is required for OIDC'] : [],
        oidcClientSecret: !body.oidcClientSecret ? ['Client Secret is required for OIDC'] : [],
      });
    }
  }

  const client = await getPoolClient();
  try {
    const result = await client.query(`
      INSERT INTO tenant_sso_connections (
        tenant_id, name, protocol, is_enabled, is_default,
        idp_entity_id, idp_sso_url, idp_certificate,
        oidc_issuer_url, oidc_client_id, oidc_client_secret,
        enforced_domains, default_role, group_role_mappings,
        allow_jit_provisioning, sync_user_attributes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, tenant_id, name, protocol, is_enabled, is_default,
        idp_entity_id, idp_sso_url, oidc_issuer_url, oidc_client_id,
        enforced_domains, default_role, group_role_mappings,
        allow_jit_provisioning, sync_user_attributes, created_at
    `, [
      body.tenantId,
      body.name,
      body.protocol,
      body.isEnabled ?? false,
      body.isDefault ?? false,
      body.idpEntityId || null,
      body.idpSsoUrl || null,
      body.idpCertificate || null,
      body.oidcIssuerUrl || null,
      body.oidcClientId || null,
      body.oidcClientSecret || null,
      body.enforcedDomains || null,
      body.defaultRole || 'standard_user',
      body.groupRoleMappings ? JSON.stringify(body.groupRoleMappings) : null,
      body.allowJitProvisioning ?? true,
      body.syncUserAttributes ?? ['email', 'name'],
      userId,
    ]);

    const row = result.rows[0];
    const connection: TenantSsoConnection = {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      protocol: row.protocol,
      isEnabled: row.is_enabled,
      isDefault: row.is_default,
      idpEntityId: row.idp_entity_id,
      idpSsoUrl: row.idp_sso_url,
      oidcIssuerUrl: row.oidc_issuer_url,
      oidcClientId: row.oidc_client_id,
      enforcedDomains: row.enforced_domains,
      defaultRole: row.default_role,
      groupRoleMappings: row.group_role_mappings,
      allowJitProvisioning: row.allow_jit_provisioning,
      syncUserAttributes: row.sync_user_attributes,
      createdAt: row.created_at,
    };

    // Log audit
    await client.query(`
      INSERT INTO configuration_audit_log (config_key, action, new_value, changed_by)
      VALUES ($1, 'create', $2, $3)
    `, [`sso_connection:${row.id}`, JSON.stringify({ name: body.name, protocol: body.protocol }), userId]);

    return successResponse({ data: connection, statusCode: 201 });
  } finally {
    client.release();
  }
}

async function getConnection(connectionId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();
  try {
    const result = await client.query(`
      SELECT 
        id, tenant_id, name, protocol, is_enabled, is_default,
        idp_entity_id, idp_sso_url, idp_certificate,
        oidc_issuer_url, oidc_client_id,
        enforced_domains, default_role, group_role_mappings,
        allow_jit_provisioning, sync_user_attributes,
        last_used_at, use_count, created_at, updated_at
      FROM tenant_sso_connections WHERE id = $1
    `, [connectionId]);

    if (result.rows.length === 0) {
      return notFoundResponse('SSO Connection', connectionId);
    }

    const row = result.rows[0];
    const connection: TenantSsoConnection = {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      protocol: row.protocol,
      isEnabled: row.is_enabled,
      isDefault: row.is_default,
      idpEntityId: row.idp_entity_id,
      idpSsoUrl: row.idp_sso_url,
      idpCertificate: row.idp_certificate ? '[CERTIFICATE PRESENT]' : undefined,
      oidcIssuerUrl: row.oidc_issuer_url,
      oidcClientId: row.oidc_client_id,
      enforcedDomains: row.enforced_domains,
      defaultRole: row.default_role,
      groupRoleMappings: row.group_role_mappings,
      allowJitProvisioning: row.allow_jit_provisioning,
      syncUserAttributes: row.sync_user_attributes,
      lastUsedAt: row.last_used_at,
      useCount: row.use_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return successResponse({ data: connection });
  } finally {
    client.release();
  }
}

async function updateConnection(connectionId: string, event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const client = await getPoolClient();

  try {
    const result = await client.query(`
      UPDATE tenant_sso_connections SET
        name = COALESCE($1, name),
        is_enabled = COALESCE($2, is_enabled),
        is_default = COALESCE($3, is_default),
        idp_entity_id = COALESCE($4, idp_entity_id),
        idp_sso_url = COALESCE($5, idp_sso_url),
        idp_certificate = COALESCE($6, idp_certificate),
        oidc_issuer_url = COALESCE($7, oidc_issuer_url),
        oidc_client_id = COALESCE($8, oidc_client_id),
        oidc_client_secret = COALESCE($9, oidc_client_secret),
        enforced_domains = COALESCE($10, enforced_domains),
        default_role = COALESCE($11, default_role),
        group_role_mappings = COALESCE($12, group_role_mappings),
        allow_jit_provisioning = COALESCE($13, allow_jit_provisioning),
        sync_user_attributes = COALESCE($14, sync_user_attributes),
        updated_at = NOW(),
        updated_by = $15
      WHERE id = $16
      RETURNING id, name, protocol, is_enabled, updated_at
    `, [
      body.name,
      body.isEnabled,
      body.isDefault,
      body.idpEntityId,
      body.idpSsoUrl,
      body.idpCertificate,
      body.oidcIssuerUrl,
      body.oidcClientId,
      body.oidcClientSecret,
      body.enforcedDomains,
      body.defaultRole,
      body.groupRoleMappings ? JSON.stringify(body.groupRoleMappings) : null,
      body.allowJitProvisioning,
      body.syncUserAttributes,
      userId,
      connectionId,
    ]);

    if (result.rows.length === 0) {
      return notFoundResponse('SSO Connection', connectionId);
    }

    // Log audit
    await client.query(`
      INSERT INTO configuration_audit_log (config_key, action, new_value, changed_by)
      VALUES ($1, 'update', $2, $3)
    `, [`sso_connection:${connectionId}`, JSON.stringify(body), userId]);

    return successResponse({ data: result.rows[0], message: 'SSO connection updated' });
  } finally {
    client.release();
  }
}

async function deleteConnection(connectionId: string, userId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();

  try {
    const result = await client.query(`
      DELETE FROM tenant_sso_connections WHERE id = $1
      RETURNING id, name
    `, [connectionId]);

    if (result.rows.length === 0) {
      return notFoundResponse('SSO Connection', connectionId);
    }

    // Log audit
    await client.query(`
      INSERT INTO configuration_audit_log (config_key, action, old_value, changed_by)
      VALUES ($1, 'delete', $2, $3)
    `, [`sso_connection:${connectionId}`, JSON.stringify({ name: result.rows[0].name }), userId]);

    return successResponse({ message: `SSO connection '${result.rows[0].name}' deleted` });
  } finally {
    client.release();
  }
}

async function toggleConnection(connectionId: string, enabled: boolean, userId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();

  try {
    const result = await client.query(`
      UPDATE tenant_sso_connections SET
        is_enabled = $1,
        updated_at = NOW(),
        updated_by = $2
      WHERE id = $3
      RETURNING id, name, is_enabled
    `, [enabled, userId, connectionId]);

    if (result.rows.length === 0) {
      return notFoundResponse('SSO Connection', connectionId);
    }

    return successResponse({ 
      data: result.rows[0],
      message: `SSO connection ${enabled ? 'enabled' : 'disabled'}` 
    });
  } finally {
    client.release();
  }
}

async function testConnection(connectionId: string): Promise<APIGatewayProxyResult> {
  const client = await getPoolClient();

  try {
    const result = await client.query(`
      SELECT protocol, idp_sso_url, oidc_issuer_url FROM tenant_sso_connections WHERE id = $1
    `, [connectionId]);

    if (result.rows.length === 0) {
      return notFoundResponse('SSO Connection', connectionId);
    }

    const { protocol, idp_sso_url, oidc_issuer_url } = result.rows[0];

    // Test connectivity
    try {
      const testUrl = protocol === 'saml' ? idp_sso_url : `${oidc_issuer_url}/.well-known/openid-configuration`;
      
      const response = await fetch(testUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        return successResponse({
          success: true,
          message: 'Connection test successful',
          details: {
            protocol,
            endpoint: testUrl,
            statusCode: response.status,
            responseTime: 'OK',
          }
        });
      } else {
        return successResponse({
          success: false,
          message: `Connection test failed with status ${response.status}`,
          details: {
            protocol,
            endpoint: testUrl,
            statusCode: response.status,
          }
        });
      }
    } catch (fetchError) {
      return successResponse({
        success: false,
        message: 'Connection test failed',
        details: {
          protocol,
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        }
      });
    }
  } finally {
    client.release();
  }
}
