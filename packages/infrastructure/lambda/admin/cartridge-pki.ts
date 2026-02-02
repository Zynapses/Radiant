/**
 * RADIANT Cartridge PKI Admin API
 * Manages certificates, signing keys, and federation trust
 * 
 * Security: Super Admin only (platform engineers)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { cartridgePKIService } from '../shared/services/cartridge-pki.service';
import { executeStatement, stringParam, boolParam } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// =============================================================================
// Types
// =============================================================================

interface AuthContext {
  userId: string;
  email: string;
  tenantId: string;
  isSuperAdmin: boolean;
}

// =============================================================================
// Handler
// =============================================================================

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path.replace('/api/admin/pki', '');
  const method = event.httpMethod;

  try {
    const auth = extractAuthContext(event);
    
    // PKI management is super admin only
    if (!auth.isSuperAdmin) {
      return response(403, { error: 'PKI management requires super admin privileges' });
    }

    // Route handling
    // Dashboard
    if (path === '/dashboard' && method === 'GET') {
      return getDashboard();
    }

    // Root CA
    if (path === '/root-ca' && method === 'GET') {
      return getRootCA();
    }
    if (path === '/root-ca/initialize' && method === 'POST') {
      return initializeRootCA(event, auth);
    }

    // Tenant CAs
    if (path === '/tenant-cas' && method === 'GET') {
      return listTenantCAs(event);
    }
    if (path.match(/^\/tenant-cas\/[^/]+$/) && method === 'GET') {
      const tenantId = path.split('/')[2];
      return getTenantCA(tenantId);
    }
    if (path === '/tenant-cas' && method === 'POST') {
      return generateTenantCA(event, auth);
    }
    if (path.match(/^\/tenant-cas\/[^/]+\/revoke$/) && method === 'POST') {
      const tenantId = path.split('/')[2];
      return revokeTenantCA(tenantId, event, auth);
    }

    // Signing Keys
    if (path === '/signing-keys' && method === 'GET') {
      return listSigningKeys(event);
    }
    if (path.match(/^\/signing-keys\/[^/]+\/rotate$/) && method === 'POST') {
      const keyId = path.split('/')[2];
      return rotateSigningKey(keyId, event, auth);
    }

    // Federation / Trusted Roots
    if (path === '/trusted-roots' && method === 'GET') {
      return listTrustedRoots();
    }
    if (path === '/trusted-roots' && method === 'POST') {
      return addTrustedRoot(event, auth);
    }
    if (path.match(/^\/trusted-roots\/[^/]+$/) && method === 'GET') {
      const rootId = path.split('/')[2];
      return getTrustedRoot(rootId);
    }
    if (path.match(/^\/trusted-roots\/[^/]+$/) && method === 'PUT') {
      const rootId = path.split('/')[2];
      return updateTrustedRoot(rootId, event, auth);
    }
    if (path.match(/^\/trusted-roots\/[^/]+$/) && method === 'DELETE') {
      const rootId = path.split('/')[2];
      return removeTrustedRoot(rootId, auth);
    }

    // Signatures
    if (path === '/signatures' && method === 'GET') {
      return listSignatures(event);
    }
    if (path.match(/^\/signatures\/[^/]+\/verify$/) && method === 'POST') {
      const signatureId = path.split('/')[2];
      return verifySignature(signatureId);
    }

    // Audit Log
    if (path === '/audit' && method === 'GET') {
      return getAuditLog(event);
    }

    // Export Root CA (for federation)
    if (path === '/root-ca/export' && method === 'GET') {
      return exportRootCAForFederation();
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    logger.error('PKI admin error', { error, path, method });
    return response(500, { error: 'Internal server error' });
  }
}

// =============================================================================
// Dashboard
// =============================================================================

async function getDashboard(): Promise<APIGatewayProxyResult> {
  const dashboard = await cartridgePKIService.getDashboard();
  return response(200, dashboard);
}

// =============================================================================
// Root CA
// =============================================================================

async function getRootCA(): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT id, cluster_id, cluster_name, fingerprint, algorithm,
            valid_from, valid_until, status, environment, region, version, created_at
     FROM root_ca_certificates
     WHERE status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    []
  );

  if (!result.rows?.length) {
    return response(404, { error: 'No active Root CA found. Run Genesis initialization.' });
  }

  const row = result.rows[0];
  return response(200, {
    id: row.id,
    clusterId: row.cluster_id,
    clusterName: row.cluster_name,
    fingerprint: row.fingerprint,
    algorithm: row.algorithm,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    status: row.status,
    environment: row.environment,
    region: row.region,
    version: row.version,
    createdAt: row.created_at,
  });
}

async function initializeRootCA(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { clusterId, clusterName, environment, region, validityYears } = body;

  if (!clusterId || !clusterName) {
    return response(400, { error: 'clusterId and clusterName are required' });
  }

  // Check if already exists
  const existing = await executeStatement(
    `SELECT id FROM root_ca_certificates WHERE status = 'active'`,
    []
  );
  if (existing.rows?.length) {
    return response(409, { error: 'Active Root CA already exists' });
  }

  // In production, this would generate a key pair in HSM
  // For now, create a placeholder
  const fingerprint = `root-ca-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const publicKey = `-----BEGIN PUBLIC KEY-----\nROOT_CA_PLACEHOLDER_${fingerprint}\n-----END PUBLIC KEY-----`;
  
  const validFrom = new Date();
  const validUntil = new Date(Date.now() + (validityYears || 10) * 365 * 24 * 60 * 60 * 1000);

  const result = await executeStatement(
    `INSERT INTO root_ca_certificates (
      cluster_id, cluster_name, public_key, fingerprint, algorithm,
      valid_from, valid_until, status, environment, region, version
    ) VALUES (
      :cluster_id, :cluster_name, :public_key, :fingerprint, 'ed25519',
      :valid_from, :valid_until, 'active', :environment, :region, '1.0.0'
    ) RETURNING *`,
    [
      stringParam('cluster_id', clusterId),
      stringParam('cluster_name', clusterName),
      stringParam('public_key', publicKey),
      stringParam('fingerprint', fingerprint),
      stringParam('valid_from', validFrom.toISOString()),
      stringParam('valid_until', validUntil.toISOString()),
      stringParam('environment', environment || 'production'),
      stringParam('region', region || 'us-east-1'),
    ]
  );

  // Log audit
  await logPKIAudit('generate_ca', 'root_ca', String(result.rows[0].id), undefined, auth);

  logger.info('Root CA initialized', { clusterId, fingerprint });
  return response(201, { 
    message: 'Root CA initialized successfully',
    fingerprint,
    validUntil: validUntil.toISOString(),
  });
}

async function exportRootCAForFederation(): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT cluster_id, cluster_name, public_key, fingerprint, algorithm,
            valid_from, valid_until, environment
     FROM root_ca_certificates
     WHERE status = 'active'
     LIMIT 1`,
    []
  );

  if (!result.rows?.length) {
    return response(404, { error: 'No active Root CA found' });
  }

  const row = result.rows[0];
  return response(200, {
    exportFormat: 'radiant-federation-v1',
    exportedAt: new Date().toISOString(),
    rootCA: {
      clusterId: row.cluster_id,
      clusterName: row.cluster_name,
      publicKey: row.public_key,
      fingerprint: row.fingerprint,
      algorithm: row.algorithm,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      environment: row.environment,
    },
    instructions: 'Import this into another Radiant cluster via POST /api/admin/pki/trusted-roots',
  });
}

// =============================================================================
// Tenant CAs
// =============================================================================

async function listTenantCAs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const status = params.status || 'active';
  const limit = parseInt(params.limit || '50');
  const offset = parseInt(params.offset || '0');

  const result = await executeStatement(
    `SELECT tc.*, t.name as tenant_display_name,
            (SELECT COUNT(*) FROM cartridge_signing_keys sk WHERE sk.tenant_ca_id = tc.id) as signing_key_count
     FROM tenant_ca_certificates tc
     LEFT JOIN tenants t ON t.id = tc.tenant_id
     WHERE tc.status = :status
     ORDER BY tc.created_at DESC
     LIMIT :limit OFFSET :offset`,
    [
      stringParam('status', status),
      stringParam('limit', String(limit)),
      stringParam('offset', String(offset)),
    ]
  );

  const countResult = await executeStatement(
    `SELECT COUNT(*) as total FROM tenant_ca_certificates WHERE status = :status`,
    [stringParam('status', status)]
  );

  return response(200, {
    tenantCAs: (result.rows || []).map(mapTenantCA),
    total: parseInt((countResult.rows?.[0] as Record<string, unknown>)?.total as string || '0'),
    limit,
    offset,
  });
}

async function getTenantCA(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT tc.*, t.name as tenant_display_name
     FROM tenant_ca_certificates tc
     LEFT JOIN tenants t ON t.id = tc.tenant_id
     WHERE tc.tenant_id = :tenant_id AND tc.status = 'active'
     ORDER BY tc.created_at DESC
     LIMIT 1`,
    [stringParam('tenant_id', tenantId)]
  );

  if (!result.rows?.length) {
    return response(404, { error: 'No active Tenant CA found for this tenant' });
  }

  return response(200, mapTenantCA(result.rows[0]));
}

async function generateTenantCA(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { tenantId, tenantName, validityDays } = body;

  if (!tenantId || !tenantName) {
    return response(400, { error: 'tenantId and tenantName are required' });
  }

  try {
    const tenantCA = await cartridgePKIService.generateTenantCA(
      tenantId,
      tenantName,
      auth.userId,
      validityDays || 365 * 5
    );

    return response(201, {
      message: 'Tenant CA generated successfully',
      tenantCA: {
        id: tenantCA.id,
        tenantId: tenantCA.tenantId,
        fingerprint: tenantCA.fingerprint,
        validUntil: tenantCA.validUntil,
        status: tenantCA.status,
      },
    });
  } catch (error) {
    logger.error('Failed to generate tenant CA', { error, tenantId });
    return response(500, { error: 'Failed to generate tenant CA' });
  }
}

async function revokeTenantCA(
  tenantId: string,
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { reason } = body;

  if (!reason) {
    return response(400, { error: 'reason is required' });
  }

  const result = await executeStatement(
    `UPDATE tenant_ca_certificates
     SET status = 'revoked', revoked_at = NOW(), revoked_reason = :reason, revoked_by = :revoked_by
     WHERE tenant_id = :tenant_id AND status = 'active'
     RETURNING id`,
    [
      stringParam('tenant_id', tenantId),
      stringParam('reason', reason),
      stringParam('revoked_by', auth.userId),
    ]
  );

  if (!result.rows?.length) {
    return response(404, { error: 'No active Tenant CA found for this tenant' });
  }

  // Also revoke all signing keys
  await executeStatement(
    `UPDATE cartridge_signing_keys SET status = 'revoked'
     WHERE tenant_id = :tenant_id AND status = 'active'`,
    [stringParam('tenant_id', tenantId)]
  );

  await logPKIAudit('revoke', 'tenant_ca', String(result.rows[0].id), tenantId, auth, { reason });

  return response(200, { message: 'Tenant CA revoked successfully' });
}

// =============================================================================
// Signing Keys
// =============================================================================

async function listSigningKeys(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const tenantId = params.tenantId;
  const status = params.status || 'active';

  let query = `
    SELECT sk.*, t.name as tenant_name
    FROM cartridge_signing_keys sk
    LEFT JOIN tenants t ON t.id = sk.tenant_id
    WHERE sk.status = :status
  `;
  const queryParams = [stringParam('status', status)];

  if (tenantId) {
    query += ` AND sk.tenant_id = :tenant_id`;
    queryParams.push(stringParam('tenant_id', tenantId));
  }

  query += ` ORDER BY sk.created_at DESC LIMIT 100`;

  const result = await executeStatement(query, queryParams);

  return response(200, {
    signingKeys: (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      keyId: row.key_id,
      fingerprint: row.fingerprint,
      algorithm: row.algorithm,
      purpose: row.purpose,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      status: row.status,
      usageCount: row.usage_count,
      lastUsedAt: row.last_used_at,
    })),
  });
}

async function rotateSigningKey(
  keyId: string,
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  // Get existing key
  const existing = await executeStatement(
    `SELECT * FROM cartridge_signing_keys WHERE id = :key_id AND status = 'active'`,
    [stringParam('key_id', keyId)]
  );

  if (!existing.rows?.length) {
    return response(404, { error: 'Signing key not found' });
  }

  const oldKey = existing.rows[0];

  // Revoke old key
  await executeStatement(
    `UPDATE cartridge_signing_keys SET status = 'revoked' WHERE id = :key_id`,
    [stringParam('key_id', keyId)]
  );

  // Create new key (would use KMS in production)
  const newKeyId = `signing-${oldKey.purpose}-${oldKey.tenant_id}-${Date.now()}`;
  const newFingerprint = `fp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const publicKey = `-----BEGIN PUBLIC KEY-----\nROTATED_KEY_${newFingerprint}\n-----END PUBLIC KEY-----`;

  const validFrom = new Date();
  const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await executeStatement(
    `INSERT INTO cartridge_signing_keys (
      tenant_id, tenant_ca_id, key_id, public_key, fingerprint,
      algorithm, purpose, valid_from, valid_until, status
    ) VALUES (
      :tenant_id, :tenant_ca_id, :key_id, :public_key, :fingerprint,
      :algorithm, :purpose, :valid_from, :valid_until, 'active'
    )`,
    [
      stringParam('tenant_id', String(oldKey.tenant_id)),
      stringParam('tenant_ca_id', String(oldKey.tenant_ca_id)),
      stringParam('key_id', newKeyId),
      stringParam('public_key', publicKey),
      stringParam('fingerprint', newFingerprint),
      stringParam('algorithm', String(oldKey.algorithm)),
      stringParam('purpose', String(oldKey.purpose)),
      stringParam('valid_from', validFrom.toISOString()),
      stringParam('valid_until', validUntil.toISOString()),
    ]
  );

  await logPKIAudit('rotate_key', 'signing_key', keyId, String(oldKey.tenant_id || ''), auth);

  return response(200, { 
    message: 'Signing key rotated successfully',
    newFingerprint,
  });
}

// =============================================================================
// Federation / Trusted Roots
// =============================================================================

async function listTrustedRoots(): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM trusted_root_cas ORDER BY added_at DESC`,
    []
  );

  return response(200, {
    trustedRoots: (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      clusterId: row.cluster_id,
      clusterName: row.cluster_name,
      fingerprint: row.fingerprint,
      addedAt: row.added_at,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      trustLevel: row.trust_level,
      allowedTenantIds: row.allowed_tenant_ids,
      notes: row.notes,
    })),
  });
}

async function getTrustedRoot(rootId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM trusted_root_cas WHERE id = :id`,
    [stringParam('id', rootId)]
  );

  if (!result.rows?.length) {
    return response(404, { error: 'Trusted root not found' });
  }

  const row = result.rows[0];
  return response(200, {
    id: row.id,
    clusterId: row.cluster_id,
    clusterName: row.cluster_name,
    publicKey: row.public_key,
    fingerprint: row.fingerprint,
    addedAt: row.added_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    trustLevel: row.trust_level,
    allowedTenantIds: row.allowed_tenant_ids,
    notes: row.notes,
  });
}

async function addTrustedRoot(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { clusterId, clusterName, publicKey, fingerprint, trustLevel, allowedTenantIds, expiresAt, notes } = body;

  if (!clusterId || !clusterName || !publicKey) {
    return response(400, { error: 'clusterId, clusterName, and publicKey are required' });
  }

  // Check for duplicate
  const existing = await executeStatement(
    `SELECT id FROM trusted_root_cas WHERE cluster_id = :cluster_id`,
    [stringParam('cluster_id', clusterId)]
  );
  if (existing.rows?.length) {
    return response(409, { error: 'Trusted root for this cluster already exists' });
  }

  const result = await executeStatement(
    `INSERT INTO trusted_root_cas (
      cluster_id, cluster_name, public_key, fingerprint, added_by,
      trust_level, allowed_tenant_ids, expires_at, notes, is_active
    ) VALUES (
      :cluster_id, :cluster_name, :public_key, :fingerprint, :added_by,
      :trust_level, :allowed_tenant_ids, :expires_at, :notes, true
    ) RETURNING id`,
    [
      stringParam('cluster_id', clusterId),
      stringParam('cluster_name', clusterName),
      stringParam('public_key', publicKey),
      stringParam('fingerprint', fingerprint || `fp-${clusterId}`),
      stringParam('added_by', auth.userId),
      stringParam('trust_level', trustLevel || 'full'),
      stringParam('allowed_tenant_ids', allowedTenantIds ? JSON.stringify(allowedTenantIds) : '[]'),
      stringParam('expires_at', expiresAt || ''),
      stringParam('notes', notes || ''),
    ]
  );

  await logPKIAudit('add_trust', 'trusted_root', String(result.rows[0].id), undefined, auth, { clusterId });

  return response(201, { 
    message: 'Trusted root added successfully',
    id: result.rows[0].id,
  });
}

async function updateTrustedRoot(
  rootId: string,
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { isActive, trustLevel, allowedTenantIds, notes } = body;

  const updates: string[] = [];
  const params = [stringParam('id', rootId)];

  if (isActive !== undefined) {
    updates.push('is_active = :is_active');
    params.push(boolParam('is_active', isActive));
  }
  if (trustLevel) {
    updates.push('trust_level = :trust_level');
    params.push(stringParam('trust_level', trustLevel));
  }
  if (allowedTenantIds) {
    updates.push('allowed_tenant_ids = :allowed_tenant_ids');
    params.push(stringParam('allowed_tenant_ids', JSON.stringify(allowedTenantIds)));
  }
  if (notes !== undefined) {
    updates.push('notes = :notes');
    params.push(stringParam('notes', notes));
  }

  if (!updates.length) {
    return response(400, { error: 'No updates provided' });
  }

  await executeStatement(
    `UPDATE trusted_root_cas SET ${updates.join(', ')} WHERE id = :id`,
    params
  );

  await logPKIAudit('add_trust', 'trusted_root', rootId, undefined, auth, body);

  return response(200, { message: 'Trusted root updated successfully' });
}

async function removeTrustedRoot(
  rootId: string,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `DELETE FROM trusted_root_cas WHERE id = :id RETURNING cluster_id`,
    [stringParam('id', rootId)]
  );

  if (!result.rows?.length) {
    return response(404, { error: 'Trusted root not found' });
  }

  await logPKIAudit('remove_trust', 'trusted_root', rootId, undefined, auth);

  return response(200, { message: 'Trusted root removed successfully' });
}

// =============================================================================
// Signatures
// =============================================================================

async function listSignatures(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const tenantId = params.tenantId;
  const limit = parseInt(params.limit || '50');
  const offset = parseInt(params.offset || '0');

  let query = `
    SELECT cs.*, c.name as cartridge_name, t.name as tenant_name
    FROM cartridge_signatures cs
    LEFT JOIN cartridges c ON c.id = cs.cartridge_id
    LEFT JOIN tenants t ON t.id = cs.tenant_id
  `;
  const queryParams: ReturnType<typeof stringParam>[] = [];

  if (tenantId) {
    query += ` WHERE cs.tenant_id = :tenant_id`;
    queryParams.push(stringParam('tenant_id', tenantId));
  }

  query += ` ORDER BY cs.created_at DESC LIMIT :limit OFFSET :offset`;
  queryParams.push(stringParam('limit', String(limit)));
  queryParams.push(stringParam('offset', String(offset)));

  const result = await executeStatement(query, queryParams);

  return response(200, {
    signatures: (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      cartridgeId: row.cartridge_id,
      cartridgeName: row.cartridge_name,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      contentHash: row.content_hash,
      signatureVersion: row.signature_version,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      clusterId: row.cluster_id,
    })),
    limit,
    offset,
  });
}

async function verifySignature(signatureId: string): Promise<APIGatewayProxyResult> {
  // Get signature record
  const result = await executeStatement(
    `SELECT cs.*, c.storage_key, c.storage_bucket
     FROM cartridge_signatures cs
     LEFT JOIN cartridges c ON c.id = cs.cartridge_id
     WHERE cs.id = :id`,
    [stringParam('id', signatureId)]
  );

  if (!result.rows?.length) {
    return response(404, { error: 'Signature not found' });
  }

  const sig = result.rows[0];

  // Rebuild signature block and verify
  // This is a simplified check - full verification would re-fetch the cartridge
  const isValid = sig.author_signature && sig.platform_signature;

  return response(200, {
    signatureId,
    isValid,
    contentHash: sig.content_hash,
    signedAt: sig.created_at,
    expiresAt: sig.expires_at,
    trustChain: {
      rootCaFingerprint: sig.root_ca_fingerprint,
      tenantCaFingerprint: sig.tenant_ca_fingerprint,
      clusterId: sig.cluster_id,
    },
  });
}

// =============================================================================
// Audit Log
// =============================================================================

async function getAuditLog(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const action = params.action;
  const limit = parseInt(params.limit || '100');
  const offset = parseInt(params.offset || '0');

  let query = `SELECT * FROM pki_audit_log`;
  const queryParams: ReturnType<typeof stringParam>[] = [];

  if (action) {
    query += ` WHERE action = :action`;
    queryParams.push(stringParam('action', action));
  }

  query += ` ORDER BY performed_at DESC LIMIT :limit OFFSET :offset`;
  queryParams.push(stringParam('limit', String(limit)));
  queryParams.push(stringParam('offset', String(offset)));

  const result = await executeStatement(query, queryParams);

  return response(200, {
    auditLog: (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      tenantId: row.tenant_id,
      performedBy: row.performed_by,
      performedByEmail: row.performed_by_email,
      performedAt: row.performed_at,
      success: row.success,
      errorMessage: row.error_message,
      details: row.details,
      ipAddress: row.ip_address,
    })),
    limit,
    offset,
  });
}

// =============================================================================
// Helpers
// =============================================================================

function extractAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext.authorizer?.claims || {};
  return {
    userId: claims.sub || claims['cognito:username'] || 'unknown',
    email: claims.email || '',
    tenantId: claims['custom:tenant_id'] || '',
    isSuperAdmin: claims['custom:is_super_admin'] === 'true' || 
                  claims['cognito:groups']?.includes('super-admins') || false,
  };
}

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

function mapTenantCA(row: Record<string, unknown>) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name || row.tenant_display_name,
    rootCaId: row.root_ca_id,
    fingerprint: row.fingerprint,
    algorithm: row.algorithm,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    status: row.status,
    signedByRootAt: row.signed_by_root_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    signingKeyCount: row.signing_key_count,
  };
}

async function logPKIAudit(
  action: string,
  targetType: string,
  targetId: string,
  tenantId: string | undefined,
  auth: AuthContext,
  details?: Record<string, unknown>
): Promise<void> {
  await executeStatement(
    `INSERT INTO pki_audit_log (
      action, target_type, target_id, tenant_id,
      performed_by, performed_by_email, success, details
    ) VALUES (
      :action, :target_type, :target_id, :tenant_id,
      :performed_by, :email, true, :details
    )`,
    [
      stringParam('action', action),
      stringParam('target_type', targetType),
      stringParam('target_id', targetId),
      stringParam('tenant_id', tenantId || ''),
      stringParam('performed_by', auth.userId),
      stringParam('email', auth.email),
      stringParam('details', JSON.stringify(details || {})),
    ]
  );
}
