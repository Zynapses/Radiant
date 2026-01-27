/**
 * RADIANT OAuth 2.0 Provider Lambda Handler
 * 
 * RFC 6749 compliant OAuth Authorization Server endpoints.
 * Supports Authorization Code (with PKCE), Client Credentials, and Refresh Token grants.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Logger } from '../shared/logger';

const logger = new Logger({ handler: 'oauth' });

let pool: Pool | null = null;
let redis: Redis | null = null;
let signingKey: string | null = null;

const ISSUER = process.env.OAUTH_ISSUER || 'https://auth.radiant.cloud';
const AUTH_CODE_TTL = 300; // 5 minutes

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  logger.info('OAuth request', { method, path });

  try {
    // Initialize connections
    if (!pool) {
      pool = new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
      });
    }

    if (!redis && process.env.REDIS_HOST) {
      redis = new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
      });
    }

    // Route to appropriate handler
    if (path.endsWith('/authorize') && method === 'GET') {
      return handleAuthorize(event);
    }
    if (path.endsWith('/authorize') && method === 'POST') {
      return handleAuthorizeConsent(event);
    }
    if (path.endsWith('/token') && method === 'POST') {
      return handleToken(event);
    }
    if (path.endsWith('/revoke') && method === 'POST') {
      return handleRevoke(event);
    }
    if (path.endsWith('/userinfo') && method === 'GET') {
      return handleUserInfo(event);
    }
    if (path.endsWith('/introspect') && method === 'POST') {
      return handleIntrospect(event);
    }
    if (path.includes('/.well-known/openid-configuration')) {
      return handleOpenIDConfig(event);
    }
    if (path.endsWith('/jwks.json') || path.endsWith('/jwks')) {
      return handleJWKS(event);
    }

    return jsonResponse(404, { error: 'not_found', error_description: 'Endpoint not found' });
  } catch (error) {
    logger.error('OAuth error', error as Error);
    return jsonResponse(500, { error: 'server_error', error_description: 'Internal server error' });
  }
}

// ============================================================================
// AUTHORIZE ENDPOINT
// ============================================================================

async function handleAuthorize(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};

  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    nonce,
  } = params;

  // Validate required parameters
  if (!client_id || !redirect_uri || !response_type) {
    return jsonResponse(400, {
      error: 'invalid_request',
      error_description: 'Missing required parameters: client_id, redirect_uri, response_type',
    });
  }

  if (response_type !== 'code') {
    return jsonResponse(400, {
      error: 'unsupported_response_type',
      error_description: 'Only response_type=code is supported',
    });
  }

  // Look up client
  const clientResult = await pool!.query(`
    SELECT * FROM oauth_clients WHERE client_id = $1 AND status = 'approved'
  `, [client_id]);

  if (clientResult.rows.length === 0) {
    return jsonResponse(400, {
      error: 'invalid_client',
      error_description: 'Client not found or not approved',
    });
  }

  const client = clientResult.rows[0];

  // Validate redirect URI
  const redirectUris: string[] = client.redirect_uris || [];
  if (!redirectUris.includes(redirect_uri)) {
    return jsonResponse(400, {
      error: 'invalid_request',
      error_description: 'Invalid redirect_uri',
    });
  }

  // Validate scopes
  const requestedScopes = scope ? scope.split(' ').filter(Boolean) : client.default_scopes;
  const allowedScopes: string[] = client.allowed_scopes;
  const invalidScopes = requestedScopes.filter((s: string) => !allowedScopes.includes(s));

  if (invalidScopes.length > 0) {
    return redirectWithError(redirect_uri, state, 'invalid_scope', `Invalid scopes: ${invalidScopes.join(', ')}`);
  }

  // PKCE validation for public clients
  if (!client.is_confidential && !code_challenge) {
    return redirectWithError(redirect_uri, state, 'invalid_request', 'PKCE required for public clients');
  }

  if (code_challenge && code_challenge_method && code_challenge_method !== 'S256') {
    return redirectWithError(redirect_uri, state, 'invalid_request', 'Only S256 code_challenge_method is supported');
  }

  // Return consent page HTML
  const consentHtml = generateConsentPage({
    client,
    requestedScopes,
    redirectUri: redirect_uri,
    state,
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method,
    nonce,
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: consentHtml,
  };
}

async function handleAuthorizeConsent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Parse form body
  const body = parseFormBody(event.body || '');
  const {
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    nonce,
    user_id,
    tenant_id,
    action, // 'allow' or 'deny'
  } = body;

  if (action === 'deny') {
    return redirectWithError(redirect_uri, state, 'access_denied', 'User denied the authorization request');
  }

  // Look up client
  const clientResult = await pool!.query(`
    SELECT * FROM oauth_clients WHERE client_id = $1 AND status = 'approved'
  `, [client_id]);

  if (clientResult.rows.length === 0) {
    return redirectWithError(redirect_uri, state, 'invalid_client', 'Client not found');
  }

  const client = clientResult.rows[0];
  const scopes = scope ? scope.split(' ').filter(Boolean) : [];

  // Generate authorization code
  const code = randomBytes(32).toString('base64url');

  // Store authorization code
  await pool!.query(`
    INSERT INTO oauth_authorization_codes (
      code, client_id, user_id, tenant_id, redirect_uri, scopes,
      state, code_challenge, code_challenge_method, nonce, expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    code,
    client.id,
    user_id,
    tenant_id,
    redirect_uri,
    JSON.stringify(scopes),
    state,
    code_challenge,
    code_challenge_method,
    nonce,
    new Date(Date.now() + AUTH_CODE_TTL * 1000),
  ]);

  // Update or create user authorization
  await pool!.query(`
    INSERT INTO oauth_user_authorizations (user_id, tenant_id, client_id, scopes)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, client_id)
    DO UPDATE SET scopes = $4, is_active = true, updated_at = NOW()
  `, [user_id, tenant_id, client.id, JSON.stringify(scopes)]);

  // Log event
  await logOAuthEvent('authorization_granted', {
    client_id: client.id,
    user_id,
    tenant_id,
    scopes,
    ip_address: event.requestContext?.identity?.sourceIp,
  });

  // Redirect with code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  return {
    statusCode: 302,
    headers: { Location: redirectUrl.toString() },
    body: '',
  };
}

// ============================================================================
// TOKEN ENDPOINT
// ============================================================================

async function handleToken(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = parseFormBody(event.body || '');
  const { grant_type } = params;

  // Validate grant type
  if (!grant_type) {
    return tokenError(400, 'invalid_request', 'Missing grant_type');
  }

  switch (grant_type) {
    case 'authorization_code':
      return handleAuthorizationCodeGrant(params, event);
    case 'refresh_token':
      return handleRefreshTokenGrant(params, event);
    case 'client_credentials':
      return handleClientCredentialsGrant(params, event);
    default:
      return tokenError(400, 'unsupported_grant_type', `Unsupported grant_type: ${grant_type}`);
  }
}

async function handleAuthorizationCodeGrant(
  params: Record<string, string>,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { code, redirect_uri, client_id, client_secret, code_verifier } = params;

  if (!code || !redirect_uri || !client_id) {
    return tokenError(400, 'invalid_request', 'Missing required parameters');
  }

  // Validate client
  const client = await validateClient(client_id, client_secret);
  if (!client) {
    return tokenError(401, 'invalid_client', 'Client authentication failed');
  }

  // Look up authorization code
  const codeResult = await pool!.query(`
    SELECT * FROM oauth_authorization_codes
    WHERE code = $1 AND client_id = $2 AND is_used = false AND expires_at > NOW()
  `, [code, client.id]);

  if (codeResult.rows.length === 0) {
    return tokenError(400, 'invalid_grant', 'Authorization code is invalid or expired');
  }

  const authCode = codeResult.rows[0];

  // Validate redirect URI
  if (authCode.redirect_uri !== redirect_uri) {
    return tokenError(400, 'invalid_grant', 'Redirect URI mismatch');
  }

  // Validate PKCE
  if (authCode.code_challenge) {
    if (!code_verifier) {
      return tokenError(400, 'invalid_request', 'Code verifier required');
    }

    const expectedChallenge = authCode.code_challenge_method === 'S256'
      ? createHash('sha256').update(code_verifier).digest('base64url')
      : code_verifier;

    if (expectedChallenge !== authCode.code_challenge) {
      return tokenError(400, 'invalid_grant', 'Code verifier mismatch');
    }
  }

  // Mark code as used
  await pool!.query(`
    UPDATE oauth_authorization_codes SET is_used = true, used_at = NOW() WHERE id = $1
  `, [authCode.id]);

  // Generate tokens
  const tokens = await generateTokens({
    client,
    userId: authCode.user_id,
    tenantId: authCode.tenant_id,
    scopes: authCode.scopes,
    nonce: authCode.nonce,
    includeRefreshToken: authCode.scopes.includes('offline_access'),
    event,
  });

  // Log event
  await logOAuthEvent('token_issued', {
    client_id: client.id,
    user_id: authCode.user_id,
    tenant_id: authCode.tenant_id,
    scopes: authCode.scopes,
    grant_type: 'authorization_code',
    ip_address: event.requestContext?.identity?.sourceIp,
  });

  return jsonResponse(200, tokens, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' });
}

async function handleRefreshTokenGrant(
  params: Record<string, string>,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { refresh_token, client_id, client_secret, scope } = params;

  if (!refresh_token || !client_id) {
    return tokenError(400, 'invalid_request', 'Missing required parameters');
  }

  // Validate client
  const client = await validateClient(client_id, client_secret);
  if (!client) {
    return tokenError(401, 'invalid_client', 'Client authentication failed');
  }

  // Look up refresh token
  const tokenHash = createHash('sha256').update(refresh_token).digest('hex');
  const tokenResult = await pool!.query(`
    SELECT * FROM oauth_refresh_tokens
    WHERE token_hash = $1 AND client_id = $2 AND is_revoked = false AND expires_at > NOW()
  `, [tokenHash, client.id]);

  if (tokenResult.rows.length === 0) {
    return tokenError(400, 'invalid_grant', 'Refresh token is invalid or expired');
  }

  const storedToken = tokenResult.rows[0];

  // Validate scope (can only request subset)
  let requestedScopes = storedToken.scopes;
  if (scope) {
    requestedScopes = scope.split(' ').filter(Boolean);
    const originalScopes: string[] = storedToken.scopes;
    const invalidScopes = requestedScopes.filter((s: string) => !originalScopes.includes(s));

    if (invalidScopes.length > 0) {
      return tokenError(400, 'invalid_scope', 'Cannot request scopes not in original grant');
    }
  }

  // Rotate refresh token (revoke old, issue new)
  await pool!.query(`
    UPDATE oauth_refresh_tokens
    SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'rotated'
    WHERE id = $1
  `, [storedToken.id]);

  // Generate new tokens
  const tokens = await generateTokens({
    client,
    userId: storedToken.user_id,
    tenantId: storedToken.tenant_id,
    scopes: requestedScopes,
    includeRefreshToken: true,
    previousRefreshTokenId: storedToken.id,
    generation: storedToken.generation + 1,
    event,
  });

  // Log event
  await logOAuthEvent('token_refreshed', {
    client_id: client.id,
    user_id: storedToken.user_id,
    tenant_id: storedToken.tenant_id,
    scopes: requestedScopes,
    ip_address: event.requestContext?.identity?.sourceIp,
  });

  return jsonResponse(200, tokens, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' });
}

async function handleClientCredentialsGrant(
  params: Record<string, string>,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { client_id, client_secret, scope } = params;

  if (!client_id || !client_secret) {
    return tokenError(400, 'invalid_request', 'Missing client credentials');
  }

  // Validate client
  const client = await validateClient(client_id, client_secret);
  if (!client) {
    return tokenError(401, 'invalid_client', 'Client authentication failed');
  }

  // Check if grant type is allowed
  const allowedGrants: string[] = client.allowed_grant_types;
  if (!allowedGrants.includes('client_credentials')) {
    return tokenError(400, 'unauthorized_client', 'Client not authorized for client_credentials');
  }

  // Validate scopes
  const requestedScopes = scope ? scope.split(' ').filter(Boolean) : client.default_scopes;
  const allowedScopes: string[] = client.allowed_scopes;
  const invalidScopes = requestedScopes.filter((s: string) => !allowedScopes.includes(s));

  if (invalidScopes.length > 0) {
    return tokenError(400, 'invalid_scope', `Invalid scopes: ${invalidScopes.join(', ')}`);
  }

  // Generate access token only (no refresh for client_credentials)
  const tokens = await generateTokens({
    client,
    userId: null,
    tenantId: client.created_by_tenant_id,
    scopes: requestedScopes,
    includeRefreshToken: false,
    event,
  });

  // Log event
  await logOAuthEvent('token_issued', {
    client_id: client.id,
    user_id: null,
    tenant_id: client.created_by_tenant_id,
    scopes: requestedScopes,
    grant_type: 'client_credentials',
    ip_address: event.requestContext?.identity?.sourceIp,
  });

  return jsonResponse(200, tokens, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' });
}

// ============================================================================
// REVOKE ENDPOINT
// ============================================================================

async function handleRevoke(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = parseFormBody(event.body || '');
  const { token, token_type_hint, client_id, client_secret } = params;

  if (!token) {
    return jsonResponse(400, { error: 'invalid_request', error_description: 'Missing token' });
  }

  // Validate client
  const client = await validateClient(client_id, client_secret);
  if (!client) {
    return jsonResponse(401, { error: 'invalid_client', error_description: 'Client authentication failed' });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');

  // Try to revoke as access token first
  if (!token_type_hint || token_type_hint === 'access_token') {
    const result = await pool!.query(`
      UPDATE oauth_access_tokens
      SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'explicit_revoke'
      WHERE token_hash = $1 AND client_id = $2
      RETURNING id
    `, [tokenHash, client.id]);

    if (result.rows.length > 0) {
      await logOAuthEvent('token_revoked', {
        client_id: client.id,
        token_type: 'access_token',
        ip_address: event.requestContext?.identity?.sourceIp,
      });
      return jsonResponse(200, {});
    }
  }

  // Try to revoke as refresh token
  if (!token_type_hint || token_type_hint === 'refresh_token') {
    const result = await pool!.query(`
      UPDATE oauth_refresh_tokens
      SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'explicit_revoke'
      WHERE token_hash = $1 AND client_id = $2
      RETURNING id
    `, [tokenHash, client.id]);

    if (result.rows.length > 0) {
      await logOAuthEvent('token_revoked', {
        client_id: client.id,
        token_type: 'refresh_token',
        ip_address: event.requestContext?.identity?.sourceIp,
      });
    }
  }

  // Per RFC 7009, always return 200 even if token not found
  return jsonResponse(200, {});
}

// ============================================================================
// USERINFO ENDPOINT
// ============================================================================

async function handleUserInfo(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Extract token from Authorization header
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'invalid_token', error_description: 'Bearer token required' });
  }

  const token = authHeader.slice(7);

  try {
    // Verify token
    const key = await getSigningKey();
    const payload = jwt.verify(token, key, { algorithms: ['RS256'] }) as any;

    // Check scopes
    const scopes: string[] = payload.scope?.split(' ') || [];
    if (!scopes.includes('openid')) {
      return jsonResponse(403, { error: 'insufficient_scope', error_description: 'openid scope required' });
    }

    // Get user info
    const userResult = await pool!.query(`
      SELECT id, email, first_name, last_name, display_name, avatar_url
      FROM tenant_users WHERE id = $1
    `, [payload.sub]);

    if (userResult.rows.length === 0) {
      return jsonResponse(404, { error: 'not_found', error_description: 'User not found' });
    }

    const user = userResult.rows[0];

    const response: any = {
      sub: user.id,
      tenant_id: payload.tenant_id,
    };

    if (scopes.includes('email')) {
      response.email = user.email;
      response.email_verified = true;
    }

    if (scopes.includes('profile')) {
      response.name = user.display_name || `${user.first_name} ${user.last_name}`.trim();
      response.given_name = user.first_name;
      response.family_name = user.last_name;
      response.picture = user.avatar_url;
    }

    return jsonResponse(200, response);
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return jsonResponse(401, { error: 'invalid_token', error_description: 'Token expired' });
    }
    return jsonResponse(401, { error: 'invalid_token', error_description: 'Invalid token' });
  }
}

// ============================================================================
// INTROSPECT ENDPOINT
// ============================================================================

async function handleIntrospect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const params = parseFormBody(event.body || '');
  const { token, client_id, client_secret } = params;

  // Validate client (introspection requires client auth)
  const client = await validateClient(client_id, client_secret);
  if (!client) {
    return jsonResponse(401, { error: 'invalid_client' });
  }

  if (!token) {
    return jsonResponse(200, { active: false });
  }

  try {
    const key = await getSigningKey();
    const payload = jwt.verify(token, key, { algorithms: ['RS256'] }) as any;

    // Check if token is revoked
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const revokedResult = await pool!.query(`
      SELECT is_revoked FROM oauth_access_tokens WHERE token_hash = $1
    `, [tokenHash]);

    if (revokedResult.rows.length > 0 && revokedResult.rows[0].is_revoked) {
      return jsonResponse(200, { active: false });
    }

    return jsonResponse(200, {
      active: true,
      scope: payload.scope,
      client_id: payload.client_id,
      username: payload.sub,
      token_type: 'Bearer',
      exp: payload.exp,
      iat: payload.iat,
      sub: payload.sub,
      aud: payload.aud,
      iss: payload.iss,
      tenant_id: payload.tenant_id,
    });
  } catch {
    return jsonResponse(200, { active: false });
  }
}

// ============================================================================
// OIDC DISCOVERY
// ============================================================================

async function handleOpenIDConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const baseUrl = `https://${event.headers.Host || 'auth.radiant.cloud'}`;

  const config = {
    issuer: ISSUER,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    introspection_endpoint: `${baseUrl}/oauth/introspect`,
    jwks_uri: `${baseUrl}/oauth/jwks.json`,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'chat:read', 'chat:write', 'knowledge:read', 'knowledge:write', 'models:read', 'usage:read', 'files:read', 'files:write', 'agents:execute'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'name', 'given_name', 'family_name', 'email', 'email_verified', 'tenant_id'],
  };

  return jsonResponse(200, config);
}

async function handleJWKS(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Get active signing keys
  const result = await pool!.query(`
    SELECT kid, public_key_pem, algorithm FROM oauth_signing_keys WHERE is_active = true
  `);

  const keys = result.rows.map(row => ({
    kty: 'RSA',
    use: 'sig',
    kid: row.kid,
    alg: row.algorithm,
    // Convert PEM to JWK format (simplified - would need proper conversion)
    n: '', // Base64url encoded modulus
    e: 'AQAB', // Base64url encoded exponent (65537)
  }));

  return jsonResponse(200, { keys }, { 'Cache-Control': 'public, max-age=3600' });
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

interface TokenGenerationParams {
  client: any;
  userId: string | null;
  tenantId: string;
  scopes: string[];
  nonce?: string;
  includeRefreshToken: boolean;
  previousRefreshTokenId?: string;
  generation?: number;
  event: APIGatewayProxyEvent;
}

async function generateTokens(params: TokenGenerationParams): Promise<any> {
  const key = await getSigningKey();
  const now = Math.floor(Date.now() / 1000);

  const accessTokenTtl = params.client.access_token_ttl_seconds || 3600;
  const refreshTokenTtl = params.client.refresh_token_ttl_seconds || 2592000;

  // Generate access token JWT
  const accessTokenPayload = {
    iss: ISSUER,
    sub: params.userId || params.client.client_id,
    aud: 'radiant-api',
    exp: now + accessTokenTtl,
    iat: now,
    client_id: params.client.client_id,
    tenant_id: params.tenantId,
    scope: params.scopes.join(' '),
    token_type: 'access_token',
  };

  const accessToken = jwt.sign(accessTokenPayload, key, { algorithm: 'RS256' });

  // Store access token hash
  const accessTokenHash = createHash('sha256').update(accessToken).digest('hex');
  await pool!.query(`
    INSERT INTO oauth_access_tokens (
      token_hash, token_prefix, client_id, user_id, tenant_id, scopes,
      expires_at, client_ip, user_agent
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    accessTokenHash,
    accessToken.slice(0, 16),
    params.client.id,
    params.userId,
    params.tenantId,
    JSON.stringify(params.scopes),
    new Date((now + accessTokenTtl) * 1000),
    params.event.requestContext?.identity?.sourceIp,
    params.event.headers['user-agent'],
  ]);

  const response: any = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: accessTokenTtl,
    scope: params.scopes.join(' '),
  };

  // Generate refresh token if requested
  if (params.includeRefreshToken && params.userId) {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');

    await pool!.query(`
      INSERT INTO oauth_refresh_tokens (
        token_hash, token_prefix, client_id, user_id, tenant_id, scopes,
        generation, previous_token_id, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      refreshTokenHash,
      refreshToken.slice(0, 16),
      params.client.id,
      params.userId,
      params.tenantId,
      JSON.stringify(params.scopes),
      params.generation || 1,
      params.previousRefreshTokenId,
      new Date((now + refreshTokenTtl) * 1000),
    ]);

    response.refresh_token = refreshToken;
  }

  // Generate ID token for OIDC (if openid scope)
  if (params.scopes.includes('openid') && params.userId) {
    const userResult = await pool!.query(`
      SELECT email, first_name, last_name, display_name
      FROM tenant_users WHERE id = $1
    `, [params.userId]);

    const user = userResult.rows[0];

    const idTokenPayload: any = {
      iss: ISSUER,
      sub: params.userId,
      aud: params.client.client_id,
      exp: now + accessTokenTtl,
      iat: now,
      auth_time: now,
    };

    if (params.nonce) idTokenPayload.nonce = params.nonce;

    if (params.scopes.includes('email') && user) {
      idTokenPayload.email = user.email;
      idTokenPayload.email_verified = true;
    }

    if (params.scopes.includes('profile') && user) {
      idTokenPayload.name = user.display_name || `${user.first_name} ${user.last_name}`.trim();
      idTokenPayload.given_name = user.first_name;
      idTokenPayload.family_name = user.last_name;
    }

    response.id_token = jwt.sign(idTokenPayload, key, { algorithm: 'RS256' });
  }

  return response;
}

// ============================================================================
// HELPERS
// ============================================================================

async function validateClient(clientId: string, clientSecret?: string): Promise<any | null> {
  const result = await pool!.query(`
    SELECT * FROM oauth_clients WHERE client_id = $1 AND status = 'approved'
  `, [clientId]);

  if (result.rows.length === 0) return null;

  const client = result.rows[0];

  if (client.is_confidential) {
    if (!clientSecret) return null;
    const valid = await bcrypt.compare(clientSecret, client.client_secret_hash);
    if (!valid) return null;
  }

  return client;
}

async function getSigningKey(): Promise<string> {
  if (signingKey) return signingKey;

  // Get from Secrets Manager
  const client = new SecretsManagerClient({});
  const result = await pool!.query(`
    SELECT private_key_secret_arn FROM oauth_signing_keys WHERE is_active = true LIMIT 1
  `);

  if (result.rows.length === 0) {
    throw new Error('No active signing key found');
  }

  const response = await client.send(new GetSecretValueCommand({
    SecretId: result.rows[0].private_key_secret_arn,
  }));

  signingKey = response.SecretString!;
  return signingKey;
}

async function logOAuthEvent(eventType: string, details: any): Promise<void> {
  try {
    await pool!.query(`
      INSERT INTO oauth_audit_log (event_type, client_id, user_id, tenant_id, scopes, details, ip_address, success)
      VALUES ($1, $2, $3, $4, $5, $6, $7::inet, true)
    `, [
      eventType,
      details.client_id,
      details.user_id,
      details.tenant_id,
      JSON.stringify(details.scopes || []),
      JSON.stringify(details),
      details.ip_address,
    ]);
  } catch (error) {
    logger.error('Failed to log OAuth event', error as Error);
  }
}

function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = body.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  }
  return params;
}

function jsonResponse(
  statusCode: number,
  body: any,
  extraHeaders: Record<string, string> = {}
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function tokenError(statusCode: number, error: string, description: string): APIGatewayProxyResult {
  return jsonResponse(statusCode, { error, error_description: description }, {
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
  });
}

function redirectWithError(redirectUri: string, state: string | undefined, error: string, description: string): APIGatewayProxyResult {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);

  return {
    statusCode: 302,
    headers: { Location: url.toString() },
    body: '',
  };
}

function generateConsentPage(params: {
  client: any;
  requestedScopes: string[];
  redirectUri: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  nonce?: string;
}): string {
  const scopeDescriptions: Record<string, string> = {
    openid: 'Verify your identity',
    profile: 'Read your basic profile information',
    email: 'Read your email address',
    offline_access: 'Access your data when you\'re not using the app',
    'chat:read': 'View your conversations and messages',
    'chat:write': 'Send messages on your behalf',
    'chat:delete': 'Delete your conversations',
    'knowledge:read': 'Search your knowledge base',
    'knowledge:write': 'Add to your knowledge base',
    'models:read': 'View available AI models',
    'usage:read': 'View your API usage',
    'files:read': 'View your uploaded files',
    'files:write': 'Upload files on your behalf',
    'agents:execute': 'Run AI agents on your behalf',
  };

  const scopeList = params.requestedScopes
    .map(s => `<li>${scopeDescriptions[s] || s}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Authorize ${params.client.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 400px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 30px; }
    .logo { width: 64px; height: 64px; border-radius: 12px; margin-bottom: 20px; }
    h1 { font-size: 24px; margin: 0 0 10px; }
    .app-name { color: #0066cc; }
    p { color: #666; line-height: 1.5; }
    ul { list-style: none; padding: 0; margin: 20px 0; }
    li { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; align-items: center; }
    li:last-child { border-bottom: none; }
    li::before { content: '✓'; color: #22c55e; margin-right: 10px; font-weight: bold; }
    .buttons { display: flex; gap: 10px; margin-top: 30px; }
    button { flex: 1; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
    .allow { background: #0066cc; color: white; }
    .deny { background: #f3f4f6; color: #333; }
    .allow:hover { background: #0052a3; }
    .deny:hover { background: #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    ${params.client.logo_url ? `<img src="${params.client.logo_url}" class="logo" alt="">` : ''}
    <h1><span class="app-name">${params.client.name}</span> wants to access your account</h1>
    <p>This application will be able to:</p>
    <ul>${scopeList}</ul>
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${params.client.client_id}">
      <input type="hidden" name="redirect_uri" value="${params.redirectUri}">
      <input type="hidden" name="scope" value="${params.requestedScopes.join(' ')}">
      <input type="hidden" name="state" value="${params.state || ''}">
      <input type="hidden" name="code_challenge" value="${params.codeChallenge || ''}">
      <input type="hidden" name="code_challenge_method" value="${params.codeChallengeMethod || ''}">
      <input type="hidden" name="nonce" value="${params.nonce || ''}">
      <input type="hidden" name="user_id" value="">
      <input type="hidden" name="tenant_id" value="">
      <div class="buttons">
        <button type="submit" name="action" value="deny" class="deny">Deny</button>
        <button type="submit" name="action" value="allow" class="allow">Allow</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}
