/**
 * Authentication Middleware
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Middleware, MiddlewareHandler } from './index';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface AuthContext {
  tenantId: string;
  userId?: string;
  apiKeyId?: string;
  tier: string;
  scopes: string[];
}

// Extended event type with auth context
export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  auth?: AuthContext;
}

/**
 * Authentication middleware
 */
export function authMiddleware(options: {
  required?: boolean;
  scopes?: string[];
} = {}): Middleware {
  const { required = true, scopes = [] } = options;

  return (next: MiddlewareHandler): MiddlewareHandler => {
    return async (event: APIGatewayProxyEvent, context: Context) => {
      const authHeader = event.headers['Authorization'] || event.headers['authorization'];
      
      if (!authHeader) {
        if (required) {
          return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: {
                code: 'unauthorized',
                message: 'Missing authorization header',
              },
            }),
          };
        }
        return next(event, context);
      }

      // Extract token
      const [type, token] = authHeader.split(' ');
      if (type !== 'Bearer' || !token) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: {
              code: 'invalid_auth',
              message: 'Invalid authorization format. Use: Bearer <token>',
            },
          }),
        };
      }

      try {
        // Validate token and extract context
        const auth = await validateToken(token);
        
        // Check required scopes
        if (scopes.length > 0) {
          const hasScopes = scopes.every(s => auth.scopes.includes(s));
          if (!hasScopes) {
            return {
              statusCode: 403,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                error: {
                  code: 'forbidden',
                  message: 'Insufficient permissions',
                  required_scopes: scopes,
                },
              }),
            };
          }
        }

        // Attach auth context to event
        (event as AuthenticatedEvent).auth = auth;
        
        return next(event, context);
      } catch (error) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: {
              code: 'invalid_token',
              message: error instanceof Error ? error.message : 'Invalid token',
            },
          }),
        };
      }
    };
  };
}

async function validateToken(token: string): Promise<AuthContext> {
  // Check if it's an API key (starts with 'rad_')
  if (token.startsWith('rad_')) {
    return validateApiKey(token);
  }
  
  // Otherwise treat as JWT
  return validateJwt(token);
}

async function validateApiKey(key: string): Promise<AuthContext> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT 
        ak.id,
        ak.tenant_id,
        ak.scopes,
        ak.is_active,
        t.tier,
        t.status as tenant_status
       FROM api_keys ak
       JOIN tenants t ON ak.tenant_id = t.id
       WHERE ak.key_hash = encode(sha256($1::bytea), 'hex')
         OR ak.key_prefix = $2`,
      [key, key.substring(0, 12)]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid API key');
    }

    const row = result.rows[0];

    if (!row.is_active) {
      throw new Error('API key is disabled');
    }

    if (row.tenant_status !== 'active') {
      throw new Error('Tenant account is not active');
    }

    await client.query(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
      [row.id]
    );

    return {
      tenantId: row.tenant_id,
      apiKeyId: row.id,
      tier: row.tier || 'starter',
      scopes: row.scopes || ['chat'],
    };
  } finally {
    client.release();
  }
}

async function validateJwt(token: string): Promise<AuthContext> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [, payload] = parts;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }

    const tenantId = decoded['custom:tenant_id'] || decoded.tenant_id;
    if (!tenantId) {
      throw new Error('Missing tenant_id in token');
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT tier, status FROM tenants WHERE id = $1`,
        [tenantId]
      );

      if (result.rows.length === 0) {
        throw new Error('Tenant not found');
      }

      if (result.rows[0].status !== 'active') {
        throw new Error('Tenant account is not active');
      }

      return {
        tenantId,
        userId: decoded.sub,
        tier: result.rows[0].tier || decoded['custom:tier'] || 'starter',
        scopes: decoded.scope?.split(' ') || decoded.scopes || ['chat'],
      };
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Invalid JWT token');
  }
}
