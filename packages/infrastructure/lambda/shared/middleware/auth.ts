/**
 * Authentication Middleware
 * Uses centralized pool manager for database connections
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Middleware, MiddlewareHandler } from './index';
import { getPoolClient } from '../db/centralized-pool';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { createRegisteredLogger } from '../services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'shared/middleware-auth',
  category: 'access',
  sourceType: 'lambda',
});

export interface AuthContext {
  tenantId: string;
  userId?: string;
  apiKeyId?: string;
  tier: string;
  scopes: string[];
  expiresAt?: string;
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
        // Extract source IP and origin for restriction checks
        const sourceIp = event.requestContext?.identity?.sourceIp;
        const origin = event.headers['Origin'] || event.headers['origin'];

        // Validate token and extract context
        const auth = await validateToken(token, sourceIp, origin);
        
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
        
        const response = await next(event, context);

        // Inject X-Key-Expires-In header for API key requests
        if (auth.expiresAt && response?.headers) {
          const msUntilExpiry = new Date(auth.expiresAt).getTime() - Date.now();
          if (msUntilExpiry > 0) {
            const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));
            response.headers['X-Key-Expires-In'] = `${daysUntilExpiry}d`;
          }
        }

        return response;
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

async function validateToken(
  token: string,
  sourceIp?: string,
  origin?: string,
): Promise<AuthContext> {
  // Check if it's an API key (starts with 'rad_')
  if (token.startsWith('rad_')) {
    return validateApiKey(token, sourceIp, origin);
  }
  
  // Otherwise treat as JWT
  return validateJwt(token);
}

async function validateApiKey(
  key: string,
  sourceIp?: string,
  origin?: string,
): Promise<AuthContext> {
  const client = await getPoolClient();

  try {
    const result = await client.query(
      `SELECT 
        ak.id,
        ak.tenant_id,
        ak.scopes,
        ak.is_active,
        ak.expires_at,
        ak.allowed_ips,
        ak.allowed_origins,
        t.tier,
        t.status as tenant_status
       FROM api_keys ak
       JOIN tenants t ON ak.tenant_id = t.id
       WHERE ak.key_hash = encode(sha256($1::bytea), 'hex')
         OR ak.key_prefix = $2`,
      [key, key.substring(0, 12)]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid API key');
    }

    const row = result.rows[0];

    if (!row.is_active) {
      throw new UnauthorizedError('API key is disabled');
    }

    if (row.tenant_status !== 'active') {
      throw new ForbiddenError('Tenant account is not active');
    }

    // Check expiration
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      throw new UnauthorizedError('API key has expired');
    }

    // Enforce IP restriction
    if (sourceIp && row.allowed_ips) {
      const allowedIps: string[] = row.allowed_ips;
      const ipAllowed = allowedIps.some(cidr => isIpInCidr(sourceIp, cidr));
      if (!ipAllowed) {
        logger.warn('API key IP restriction denied', { keyId: row.id, sourceIp });
        throw new ForbiddenError('Source IP is not in the allowed list for this API key');
      }
    }

    // Enforce origin restriction
    if (origin && row.allowed_origins) {
      const allowedOrigins: string[] = row.allowed_origins;
      if (!allowedOrigins.includes(origin)) {
        logger.warn('API key origin restriction denied', { keyId: row.id, origin });
        throw new ForbiddenError('Origin is not in the allowed list for this API key');
      }
    }

    await client.query(
      `UPDATE api_keys SET last_used_at = NOW(), use_count = use_count + 1 WHERE id = $1`,
      [row.id]
    );

    return {
      tenantId: row.tenant_id,
      apiKeyId: row.id,
      tier: row.tier || 'starter',
      scopes: row.scopes || ['chat'],
      expiresAt: row.expires_at || undefined,
    };
  } finally {
    client.release();
  }
}

/**
 * Simple CIDR match check for IPv4.
 * For production-grade matching, consider a library like 'ip-cidr'.
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  // Exact match shortcut
  if (cidr === ip || cidr === `${ip}/32`) return true;

  const [cidrBase, cidrBits] = cidr.split('/');
  if (!cidrBits) return ip === cidrBase;

  const mask = ~(2 ** (32 - parseInt(cidrBits, 10)) - 1) >>> 0;
  const ipNum = ipToInt(ip);
  const cidrNum = ipToInt(cidrBase);

  return (ipNum & mask) === (cidrNum & mask);
}

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

async function validateJwt(token: string): Promise<AuthContext> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedError('Invalid JWT format');
    }

    const [, payload] = parts;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      throw new UnauthorizedError('Token expired');
    }

    const tenantId = decoded['custom:tenant_id'] || decoded.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedError('Missing tenant_id in token');
    }

    const client = await getPoolClient();
    try {
      const result = await client.query(
        `SELECT tier, status FROM tenants WHERE id = $1`,
        [tenantId]
      );

      if (result.rows.length === 0) {
        throw new UnauthorizedError('Tenant not found');
      }

      if (result.rows[0].status !== 'active') {
        throw new ForbiddenError('Tenant account is not active');
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
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      throw error;
    }
    logger.error('JWT validation failed', error instanceof Error ? error : undefined);
    throw new UnauthorizedError('Invalid JWT token');
  }
}
