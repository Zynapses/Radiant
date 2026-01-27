/**
 * OAuth Apps Admin API
 * 
 * Admin endpoints for managing OAuth applications, scopes, and settings.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { successResponse, errorResponse } from '../shared/response';
import { Logger } from '../shared/logger';
import { ValidationError, NotFoundError } from '../shared/errors';
import { query, transaction } from '../shared/db';

const logger = new Logger({ handler: 'oauth-apps' });

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const pathParts = event.path.split('/').filter(Boolean);
  const subPath = pathParts.slice(3).join('/');

  logger.info('OAuth Apps admin request', { method, path: event.path, subPath });

  try {
    // Dashboard
    if (subPath === 'dashboard' && method === 'GET') {
      return getDashboard(event);
    }

    // Apps CRUD
    if (subPath === 'apps' && method === 'GET') {
      return listApps(event);
    }
    if (subPath === 'apps' && method === 'POST') {
      return registerApp(event);
    }
    if (subPath.match(/^apps\/[^/]+$/) && method === 'GET') {
      return getApp(event, pathParts[5]);
    }
    if (subPath.match(/^apps\/[^/]+$/) && method === 'PUT') {
      return updateApp(event, pathParts[5]);
    }
    if (subPath.match(/^apps\/[^/]+$/) && method === 'DELETE') {
      return deleteApp(event, pathParts[5]);
    }

    // App actions
    if (subPath.match(/^apps\/[^/]+\/approve$/) && method === 'POST') {
      return approveApp(event, pathParts[5]);
    }
    if (subPath.match(/^apps\/[^/]+\/reject$/) && method === 'POST') {
      return rejectApp(event, pathParts[5]);
    }
    if (subPath.match(/^apps\/[^/]+\/suspend$/) && method === 'POST') {
      return suspendApp(event, pathParts[5]);
    }
    if (subPath.match(/^apps\/[^/]+\/rotate-secret$/) && method === 'POST') {
      return rotateSecret(event, pathParts[5]);
    }
    if (subPath.match(/^apps\/[^/]+\/stats$/) && method === 'GET') {
      return getAppStats(event, pathParts[5]);
    }

    // Scopes
    if (subPath === 'scopes' && method === 'GET') {
      return listScopes(event);
    }
    if (subPath === 'scopes' && method === 'POST') {
      return createScope(event);
    }
    if (subPath.match(/^scopes\/[^/]+$/) && method === 'PUT') {
      return updateScope(event, pathParts[5]);
    }

    // User authorizations
    if (subPath === 'authorizations' && method === 'GET') {
      return listAuthorizations(event);
    }
    if (subPath.match(/^authorizations\/[^/]+\/revoke$/) && method === 'POST') {
      return revokeAuthorization(event, pathParts[5]);
    }

    // Tenant settings
    if (subPath === 'settings' && method === 'GET') {
      return getSettings(event);
    }
    if (subPath === 'settings' && method === 'PUT') {
      return updateSettings(event);
    }

    // Audit log
    if (subPath === 'audit' && method === 'GET') {
      return getAuditLog(event);
    }

    return errorResponse(new NotFoundError(`Unknown endpoint: ${method} ${event.path}`));
  } catch (error) {
    logger.error('OAuth Apps admin error', error as Error);
    return errorResponse(error as Error);
  }
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const [stats, pending, topApps] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) as total_apps,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_apps,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_apps,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_apps,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_apps
      FROM oauth_clients
    `),
    query(`
      SELECT * FROM oauth_clients WHERE status = 'pending'
      ORDER BY created_at DESC LIMIT 10
    `),
    query(`
      SELECT 
        c.id, c.client_id, c.name, c.app_type, c.status,
        COUNT(DISTINCT a.id) as total_authorizations,
        COUNT(DISTINCT a.id) FILTER (WHERE a.is_active) as active_authorizations,
        MAX(c.last_used_at) as last_used_at
      FROM oauth_clients c
      LEFT JOIN oauth_user_authorizations a ON a.client_id = c.id
      WHERE c.status = 'approved'
      GROUP BY c.id
      ORDER BY active_authorizations DESC
      LIMIT 10
    `),
  ]);

  const authStats = await query(`
    SELECT 
      COUNT(*) as total_authorizations,
      COUNT(*) FILTER (WHERE is_active) as active_authorizations
    FROM oauth_user_authorizations
  `);

  const eventStats = await query(`
    SELECT COUNT(*) as events_last_24h
    FROM oauth_audit_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);

  const statsRow = stats.rows[0] as any;
  const authRow = authStats.rows[0] as any;
  const eventRow = eventStats.rows[0] as any;
  
  return successResponse({
    data: {
      totalApps: parseInt(statsRow.total_apps),
      appsByStatus: {
        pending: parseInt(statsRow.pending_apps),
        approved: parseInt(statsRow.approved_apps),
        rejected: parseInt(statsRow.rejected_apps),
        suspended: parseInt(statsRow.suspended_apps),
      },
      pendingApprovals: pending.rows.map(mapClientFromDb),
      topApps: topApps.rows.map((row: any) => ({
        id: row.id,
        clientId: row.client_id,
        name: row.name,
        appType: row.app_type,
        status: row.status,
        totalAuthorizations: parseInt(row.total_authorizations) || 0,
        activeAuthorizations: parseInt(row.active_authorizations) || 0,
        lastUsedAt: row.last_used_at,
      })),
      totalAuthorizations: parseInt(authRow.total_authorizations) || 0,
      activeAuthorizations: parseInt(authRow.active_authorizations) || 0,
      eventsLast24h: parseInt(eventRow.events_last_24h) || 0,
    },
  });
}

// ============================================================================
// APPS CRUD
// ============================================================================

async function listApps(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const status = event.queryStringParameters?.status;
  const appType = event.queryStringParameters?.appType;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  const offset = parseInt(event.queryStringParameters?.offset || '0');

  let sql = `
    SELECT c.*, 
      COUNT(DISTINCT a.id) FILTER (WHERE a.is_active) as active_authorizations
    FROM oauth_clients c
    LEFT JOIN oauth_user_authorizations a ON a.client_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    sql += ` AND c.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (appType) {
    sql += ` AND c.app_type = $${paramIndex}`;
    params.push(appType);
    paramIndex++;
  }

  sql += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await query(sql, params);

  const countResult = await query(`SELECT COUNT(*) FROM oauth_clients`);

  return successResponse({
    data: result.rows.map((row: any) => ({
      ...mapClientFromDb(row),
      activeAuthorizations: parseInt(row.active_authorizations) || 0,
    })),
    total: parseInt((countResult.rows[0] as any).count),
  });
}

async function registerApp(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const tenantId = event.queryStringParameters?.tenantId;

  if (!body.name || !body.redirectUris?.length) {
    throw new ValidationError('name and redirectUris are required');
  }

  // Generate client credentials
  const clientId = `rad_${randomBytes(16).toString('hex')}`;
  const clientSecret = randomBytes(32).toString('base64url');
  const clientSecretHash = await bcrypt.hash(clientSecret, 10);

  const isConfidential = body.appType !== 'single_page_application';

  const result = await query(`
    INSERT INTO oauth_clients (
      client_id, client_secret_hash, name, description, logo_url, homepage_url,
      privacy_policy_url, terms_of_service_url, app_type, is_confidential,
      redirect_uris, allowed_scopes, default_scopes, allowed_grant_types,
      created_by_tenant_id, created_by_user_id, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *
  `, [
    clientId,
    isConfidential ? clientSecretHash : null,
    body.name,
    body.description,
    body.logoUrl,
    body.homepageUrl,
    body.privacyPolicyUrl,
    body.termsOfServiceUrl,
    body.appType || 'web_application',
    isConfidential,
    JSON.stringify(body.redirectUris),
    JSON.stringify(body.requestedScopes || ['openid', 'profile']),
    JSON.stringify(['openid']),
    JSON.stringify(body.appType === 'machine_to_machine' ? ['client_credentials'] : ['authorization_code', 'refresh_token']),
    tenantId,
    body.userId,
    'pending',
  ]);

  return successResponse({
    data: {
      clientId,
      clientSecret: isConfidential ? clientSecret : undefined,
      app: mapClientFromDb(result.rows[0]),
    },
    message: 'Application registered. Awaiting approval.',
  });
}

async function getApp(event: APIGatewayProxyEvent, appId: string): Promise<APIGatewayProxyResult> {
  const result = await query(`
    SELECT c.*, 
      COUNT(DISTINCT a.id) as total_authorizations,
      COUNT(DISTINCT a.id) FILTER (WHERE a.is_active) as active_authorizations
    FROM oauth_clients c
    LEFT JOIN oauth_user_authorizations a ON a.client_id = c.id
    WHERE c.id = $1 OR c.client_id = $1
    GROUP BY c.id
  `, [appId]);

  if (result.rows.length === 0) {
    throw new NotFoundError('App not found');
  }

  return successResponse({
    data: {
      ...mapClientFromDb(result.rows[0]),
      totalAuthorizations: parseInt((result.rows[0] as any).total_authorizations) || 0,
      activeAuthorizations: parseInt((result.rows[0] as any).active_authorizations) || 0,
    },
  });
}

async function updateApp(event: APIGatewayProxyEvent, appId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  const result = await query(`
    UPDATE oauth_clients SET
      name = COALESCE($2, name),
      description = COALESCE($3, description),
      logo_url = COALESCE($4, logo_url),
      homepage_url = COALESCE($5, homepage_url),
      privacy_policy_url = COALESCE($6, privacy_policy_url),
      terms_of_service_url = COALESCE($7, terms_of_service_url),
      redirect_uris = COALESCE($8, redirect_uris),
      allowed_scopes = COALESCE($9, allowed_scopes),
      access_token_ttl_seconds = COALESCE($10, access_token_ttl_seconds),
      refresh_token_ttl_seconds = COALESCE($11, refresh_token_ttl_seconds),
      rate_limit_requests_per_minute = COALESCE($12, rate_limit_requests_per_minute),
      updated_at = NOW()
    WHERE id = $1 OR client_id = $1
    RETURNING *
  `, [
    appId,
    body.name,
    body.description,
    body.logoUrl,
    body.homepageUrl,
    body.privacyPolicyUrl,
    body.termsOfServiceUrl,
    body.redirectUris ? JSON.stringify(body.redirectUris) : null,
    body.allowedScopes ? JSON.stringify(body.allowedScopes) : null,
    body.accessTokenTtlSeconds,
    body.refreshTokenTtlSeconds,
    body.rateLimitRequestsPerMinute,
  ]);

  if (result.rows.length === 0) {
    throw new NotFoundError('App not found');
  }

  return successResponse({ data: mapClientFromDb(result.rows[0]) });
}

async function deleteApp(event: APIGatewayProxyEvent, appId: string): Promise<APIGatewayProxyResult> {
  await query(`DELETE FROM oauth_clients WHERE id = $1 OR client_id = $1`, [appId]);
  return successResponse({ message: 'App deleted' });
}

// ============================================================================
// APP ACTIONS
// ============================================================================

async function approveApp(event: APIGatewayProxyEvent, appId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  const result = await query(`
    UPDATE oauth_clients SET
      status = 'approved',
      approved_by = $2,
      approved_at = NOW(),
      updated_at = NOW()
    WHERE (id = $1 OR client_id = $1) AND status = 'pending'
    RETURNING *
  `, [appId, body.approvedBy]);

  if (result.rows.length === 0) {
    throw new NotFoundError('App not found or not pending');
  }

  await logAuditEvent('app_approved', { client_id: result.rows[0].id });

  return successResponse({ data: mapClientFromDb(result.rows[0]), message: 'App approved' });
}

async function rejectApp(event: APIGatewayProxyEvent, appId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  const result = await query(`
    UPDATE oauth_clients SET
      status = 'rejected',
      rejection_reason = $2,
      updated_at = NOW()
    WHERE (id = $1 OR client_id = $1) AND status = 'pending'
    RETURNING *
  `, [appId, body.reason]);

  if (result.rows.length === 0) {
    throw new NotFoundError('App not found or not pending');
  }

  await logAuditEvent('app_rejected', { client_id: result.rows[0].id, reason: body.reason });

  return successResponse({ data: mapClientFromDb(result.rows[0]), message: 'App rejected' });
}

async function suspendApp(event: APIGatewayProxyEvent, appId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  await transaction(async (client) => {
    // Update app status
    await client.query(`
      UPDATE oauth_clients SET status = 'suspended', updated_at = NOW()
      WHERE id = $1 OR client_id = $1
    `, [appId]);

    // Revoke all tokens
    await client.query(`
      UPDATE oauth_access_tokens SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'app_suspended'
      WHERE client_id = (SELECT id FROM oauth_clients WHERE id = $1 OR client_id = $1)
    `, [appId]);

    await client.query(`
      UPDATE oauth_refresh_tokens SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'app_suspended'
      WHERE client_id = (SELECT id FROM oauth_clients WHERE id = $1 OR client_id = $1)
    `, [appId]);
  });

  await logAuditEvent('app_suspended', { client_id: appId, reason: body.reason });

  return successResponse({ message: 'App suspended and all tokens revoked' });
}

async function rotateSecret(event: APIGatewayProxyEvent, appId: string): Promise<APIGatewayProxyResult> {
  const newSecret = randomBytes(32).toString('base64url');
  const newSecretHash = await bcrypt.hash(newSecret, 10);

  const result = await query(`
    UPDATE oauth_clients SET client_secret_hash = $2, updated_at = NOW()
    WHERE (id = $1 OR client_id = $1) AND is_confidential = true
    RETURNING client_id
  `, [appId, newSecretHash]);

  if (result.rows.length === 0) {
    throw new NotFoundError('App not found or is not confidential');
  }

  return successResponse({
    data: {
      clientId: result.rows[0].client_id,
      clientSecret: newSecret,
    },
    message: 'Client secret rotated. Old secret is now invalid.',
  });
}

async function getAppStats(event: APIGatewayProxyEvent, appId: string): Promise<APIGatewayProxyResult> {
  const [tokenStats, authStats, eventStats] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(*) FILTER (WHERE is_revoked = false AND expires_at > NOW()) as active_tokens
      FROM oauth_access_tokens
      WHERE client_id = (SELECT id FROM oauth_clients WHERE id = $1 OR client_id = $1)
    `, [appId]),
    query(`
      SELECT 
        COUNT(*) as total_authorizations,
        COUNT(*) FILTER (WHERE is_active) as active_authorizations
      FROM oauth_user_authorizations
      WHERE client_id = (SELECT id FROM oauth_clients WHERE id = $1 OR client_id = $1)
    `, [appId]),
    query(`
      SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as requests_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as requests_7d
      FROM oauth_audit_log
      WHERE client_id = (SELECT id FROM oauth_clients WHERE id = $1 OR client_id = $1)
    `, [appId]),
  ]);

  return successResponse({
    data: {
      totalTokens: parseInt((tokenStats.rows[0] as any).total_tokens) || 0,
      activeTokens: parseInt((tokenStats.rows[0] as any).active_tokens) || 0,
      totalAuthorizations: parseInt((authStats.rows[0] as any).total_authorizations) || 0,
      activeAuthorizations: parseInt((authStats.rows[0] as any).active_authorizations) || 0,
      requestsLast24h: parseInt((eventStats.rows[0] as any).requests_24h) || 0,
      requestsLast7d: parseInt((eventStats.rows[0] as any).requests_7d) || 0,
    },
  });
}

// ============================================================================
// SCOPES
// ============================================================================

async function listScopes(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const result = await query(`SELECT * FROM oauth_scope_definitions ORDER BY category, name`);
  return successResponse({ data: result.rows.map(mapScopeFromDb) });
}

async function createScope(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  if (!body.name || !body.category || !body.displayName || !body.description) {
    throw new ValidationError('name, category, displayName, and description are required');
  }

  const result = await query(`
    INSERT INTO oauth_scope_definitions (
      name, category, display_name, description, risk_level,
      allowed_endpoints, requires_approval, allowed_app_types
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    body.name,
    body.category,
    body.displayName,
    body.description,
    body.riskLevel || 'medium',
    JSON.stringify(body.allowedEndpoints || []),
    body.requiresApproval || false,
    JSON.stringify(body.allowedAppTypes || ['web_application', 'native_application']),
  ]);

  return successResponse({ data: mapScopeFromDb(result.rows[0]) });
}

async function updateScope(event: APIGatewayProxyEvent, scopeId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  const result = await query(`
    UPDATE oauth_scope_definitions SET
      display_name = COALESCE($2, display_name),
      description = COALESCE($3, description),
      risk_level = COALESCE($4, risk_level),
      allowed_endpoints = COALESCE($5, allowed_endpoints),
      is_enabled = COALESCE($6, is_enabled),
      requires_approval = COALESCE($7, requires_approval),
      updated_at = NOW()
    WHERE id = $1 OR name = $1
    RETURNING *
  `, [
    scopeId,
    body.displayName,
    body.description,
    body.riskLevel,
    body.allowedEndpoints ? JSON.stringify(body.allowedEndpoints) : null,
    body.isEnabled,
    body.requiresApproval,
  ]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Scope not found');
  }

  return successResponse({ data: mapScopeFromDb(result.rows[0]) });
}

// ============================================================================
// AUTHORIZATIONS
// ============================================================================

async function listAuthorizations(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  const clientId = event.queryStringParameters?.clientId;
  const limit = parseInt(event.queryStringParameters?.limit || '50');

  let sql = `
    SELECT a.*, c.name as app_name, c.logo_url as app_logo, u.email as user_email
    FROM oauth_user_authorizations a
    JOIN oauth_clients c ON c.id = a.client_id
    JOIN tenant_users u ON u.id = a.user_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;

  if (userId) {
    sql += ` AND a.user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  if (clientId) {
    sql += ` AND a.client_id = $${paramIndex}`;
    params.push(clientId);
    paramIndex++;
  }

  sql += ` ORDER BY a.created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await query(sql, params);

  return successResponse({
    data: result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      tenantId: row.tenant_id,
      clientId: row.client_id,
      appName: row.app_name,
      appLogo: row.app_logo,
      scopes: row.scopes,
      isActive: row.is_active,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    })),
  });
}

async function revokeAuthorization(event: APIGatewayProxyEvent, authId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  await transaction(async (client) => {
    // Get authorization details
    const authResult = await client.query(`
      SELECT user_id, client_id FROM oauth_user_authorizations WHERE id = $1
    `, [authId]);

    if (authResult.rows.length === 0) {
      throw new NotFoundError('Authorization not found');
    }

    const { user_id, client_id } = authResult.rows[0];

    // Revoke authorization
    await client.query(`
      UPDATE oauth_user_authorizations 
      SET is_active = false, revoked_at = NOW(), revoked_reason = $2
      WHERE id = $1
    `, [authId, body.reason || 'admin_revoked']);

    // Revoke all tokens
    await client.query(`
      UPDATE oauth_access_tokens 
      SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'authorization_revoked'
      WHERE user_id = $1 AND client_id = $2
    `, [user_id, client_id]);

    await client.query(`
      UPDATE oauth_refresh_tokens 
      SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'authorization_revoked'
      WHERE user_id = $1 AND client_id = $2
    `, [user_id, client_id]);
  });

  await logAuditEvent('consent_revoked', { authorization_id: authId });

  return successResponse({ message: 'Authorization revoked' });
}

// ============================================================================
// SETTINGS
// ============================================================================

async function getSettings(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;

  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }

  const result = await query(`
    SELECT * FROM tenant_oauth_settings WHERE tenant_id = $1
  `, [tenantId]);

  if (result.rows.length === 0) {
    // Return defaults
    return successResponse({
      data: {
        tenantId,
        oauthEnabled: true,
        allowThirdPartyApps: true,
        requireAppApproval: true,
        allowedAppTypes: ['web_application', 'native_application', 'mcp_server'],
        blockedScopes: [],
        maxAuthorizationsPerUser: 50,
        defaultAccessTokenTtlSeconds: 3600,
        defaultRefreshTokenTtlSeconds: 2592000,
      },
    });
  }

  return successResponse({ data: mapSettingsFromDb(result.rows[0]) });
}

async function updateSettings(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const body = JSON.parse(event.body || '{}');

  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }

  const result = await query(`
    INSERT INTO tenant_oauth_settings (
      tenant_id, oauth_enabled, allow_third_party_apps, require_app_approval,
      allowed_app_types, blocked_scopes, max_authorizations_per_user,
      default_access_token_ttl_seconds, default_refresh_token_ttl_seconds
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (tenant_id) DO UPDATE SET
      oauth_enabled = COALESCE($2, tenant_oauth_settings.oauth_enabled),
      allow_third_party_apps = COALESCE($3, tenant_oauth_settings.allow_third_party_apps),
      require_app_approval = COALESCE($4, tenant_oauth_settings.require_app_approval),
      allowed_app_types = COALESCE($5, tenant_oauth_settings.allowed_app_types),
      blocked_scopes = COALESCE($6, tenant_oauth_settings.blocked_scopes),
      max_authorizations_per_user = COALESCE($7, tenant_oauth_settings.max_authorizations_per_user),
      default_access_token_ttl_seconds = COALESCE($8, tenant_oauth_settings.default_access_token_ttl_seconds),
      default_refresh_token_ttl_seconds = COALESCE($9, tenant_oauth_settings.default_refresh_token_ttl_seconds),
      updated_at = NOW()
    RETURNING *
  `, [
    tenantId,
    body.oauthEnabled,
    body.allowThirdPartyApps,
    body.requireAppApproval,
    body.allowedAppTypes ? JSON.stringify(body.allowedAppTypes) : null,
    body.blockedScopes ? JSON.stringify(body.blockedScopes) : null,
    body.maxAuthorizationsPerUser,
    body.defaultAccessTokenTtlSeconds,
    body.defaultRefreshTokenTtlSeconds,
  ]);

  return successResponse({ data: mapSettingsFromDb(result.rows[0]) });
}

// ============================================================================
// AUDIT LOG
// ============================================================================

async function getAuditLog(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const clientId = event.queryStringParameters?.clientId;
  const eventType = event.queryStringParameters?.eventType;
  const limit = parseInt(event.queryStringParameters?.limit || '100');

  let sql = `SELECT * FROM oauth_audit_log WHERE 1=1`;
  const params: any[] = [];
  let paramIndex = 1;

  if (clientId) {
    sql += ` AND client_id = $${paramIndex}`;
    params.push(clientId);
    paramIndex++;
  }

  if (eventType) {
    sql += ` AND event_type = $${paramIndex}`;
    params.push(eventType);
    paramIndex++;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await query(sql, params);

  return successResponse({ data: result.rows });
}

// ============================================================================
// HELPERS
// ============================================================================

function mapClientFromDb(row: any): any {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    description: row.description,
    logoUrl: row.logo_url,
    homepageUrl: row.homepage_url,
    privacyPolicyUrl: row.privacy_policy_url,
    termsOfServiceUrl: row.terms_of_service_url,
    appType: row.app_type,
    isConfidential: row.is_confidential,
    redirectUris: row.redirect_uris,
    allowedScopes: row.allowed_scopes,
    defaultScopes: row.default_scopes,
    allowedGrantTypes: row.allowed_grant_types,
    accessTokenTtlSeconds: row.access_token_ttl_seconds,
    refreshTokenTtlSeconds: row.refresh_token_ttl_seconds,
    rateLimitRequestsPerMinute: row.rate_limit_requests_per_minute,
    rateLimitTokensPerDay: row.rate_limit_tokens_per_day,
    createdByTenantId: row.created_by_tenant_id,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  };
}

function mapScopeFromDb(row: any): any {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    displayName: row.display_name,
    description: row.description,
    riskLevel: row.risk_level,
    allowedEndpoints: row.allowed_endpoints,
    isEnabled: row.is_enabled,
    requiresApproval: row.requires_approval,
    allowedAppTypes: row.allowed_app_types,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettingsFromDb(row: any): any {
  return {
    tenantId: row.tenant_id,
    oauthEnabled: row.oauth_enabled,
    allowThirdPartyApps: row.allow_third_party_apps,
    requireAppApproval: row.require_app_approval,
    allowedAppTypes: row.allowed_app_types,
    blockedScopes: row.blocked_scopes,
    maxAuthorizationsPerUser: row.max_authorizations_per_user,
    defaultAccessTokenTtlSeconds: row.default_access_token_ttl_seconds,
    defaultRefreshTokenTtlSeconds: row.default_refresh_token_ttl_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function logAuditEvent(eventType: string, details: any): Promise<void> {
  try {
    await query(`
      INSERT INTO oauth_audit_log (event_type, client_id, details, success)
      VALUES ($1, $2, $3, true)
    `, [eventType, details.client_id, JSON.stringify(details)]);
  } catch (error) {
    logger.error('Failed to log audit event', error as Error);
  }
}
