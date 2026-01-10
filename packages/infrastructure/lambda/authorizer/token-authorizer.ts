/**
 * RADIANT v4.18.0 - Token Authorizer Lambda
 * 
 * Validates Cognito JWT tokens and extracts auth context for RLS.
 * Supports both user authentication and M2M client credentials flows.
 */

import jwt, { JwtPayload } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { logger } from '../shared/logging/enhanced-logger';

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const COGNITO_REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1';
const COGNITO_ISSUER = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

const client = jwksClient({
  jwksUri: `${COGNITO_ISSUER}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
});

interface DecodedToken extends JwtPayload {
  sub: string;
  iss: string;
  client_id?: string;
  token_use: string;
  scope?: string;
  'custom:tenant_id'?: string;
  'custom:app_uid'?: string;
  'custom:permission_level'?: string;
  'custom:role'?: string;
  'custom:jurisdiction'?: string;
  'custom:data_region'?: string;
  'custom:app_assignments'?: string;
  'custom:rate_limit_tier'?: string;
  'cognito:groups'?: string[];
}

interface ParsedResource {
  method: string;
  path: string;
  resourceType: string;
  resourceId?: string;
  action: 'read' | 'write' | 'delete' | 'admin';
}

export async function handler(
  event: APIGatewayTokenAuthorizerEvent,
  _context: Context
): Promise<APIGatewayAuthorizerResult> {
  logger.info('Authorizer invoked for:', { data: event.methodArn });
  
  const token = event.authorizationToken?.replace('Bearer ', '');
  
  if (!token) {
    logger.error('No token provided');
    throw new Error('Unauthorized');
  }
  
  try {
    // Decode header to get key ID
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || !decodedHeader.header.kid) {
      throw new Error('Invalid token format');
    }
    
    // Get signing key
    const key = await client.getSigningKey(decodedHeader.header.kid);
    const publicKey = key.getPublicKey();
    
    // Verify token
    const decoded = jwt.verify(token, publicKey, {
      issuer: COGNITO_ISSUER,
      algorithms: ['RS256'],
    }) as DecodedToken;
    
    // Extract claims
    const tenantId = decoded['custom:tenant_id'];
    const appUid = decoded['custom:app_uid'];
    const permissionLevel = decoded['custom:permission_level'] || decoded['custom:role'] || 'user';
    const jurisdiction = decoded['custom:jurisdiction'];
    const dataRegion = decoded['custom:data_region'];
    const scopes = decoded.scope?.split(' ') || [];
    const groups = decoded['cognito:groups'] || [];
    
    // Tenant ID is required
    if (!tenantId) {
      logger.error('Missing tenant_id claim');
      throw new Error('Unauthorized');
    }
    
    // Determine effective permission level
    const isRadiantAdmin = groups.includes('radiant-admins') || permissionLevel === 'radiant_admin';
    const isTenantAdmin = groups.includes('tenant-admins') || permissionLevel === 'tenant_admin';
    
    let effectivePermissionLevel = permissionLevel;
    if (isRadiantAdmin) effectivePermissionLevel = 'radiant_admin';
    else if (isTenantAdmin) effectivePermissionLevel = 'tenant_admin';
    
    // Parse resource for authorization check
    const resource = parseResource(event.methodArn);
    const isAuthorized = checkAuthorization(effectivePermissionLevel, scopes, resource, decoded.sub, appUid);
    
    if (!isAuthorized) {
      logger.warn('Authorization denied', { userId: decoded.sub, resource: resource.path });
      return generatePolicy(decoded.sub, 'Deny', event.methodArn, {});
    }
    
    // Build context for downstream handlers
    const context = {
      tenant_id: tenantId,
      user_id: decoded.sub,
      app_uid: appUid || '',
      permission_level: effectivePermissionLevel,
      jurisdiction: jurisdiction || '',
      data_region: dataRegion || 'us-east-1',
      scopes: JSON.stringify(scopes),
      groups: JSON.stringify(groups),
      token_use: decoded.token_use,
    };
    
    logger.info('Authorization granted', { userId: decoded.sub, permissionLevel: effectivePermissionLevel });
    return generatePolicy(decoded.sub, 'Allow', event.methodArn, context);
    
  } catch (error) {
    logger.error('Authorization failed:', error);
    throw new Error('Unauthorized');
  }
}

function parseResource(methodArn: string): ParsedResource {
  // Format: arn:aws:execute-api:region:account-id:api-id/stage/METHOD/resource-path
  const arnParts = methodArn.split(':');
  const resourcePart = arnParts[5];
  const [, , method, ...pathParts] = resourcePart.split('/');
  const path = '/' + pathParts.join('/');
  
  let resourceType = 'unknown';
  let resourceId: string | undefined;
  let action: 'read' | 'write' | 'delete' | 'admin' = 'read';
  
  // Determine resource type
  if (path.startsWith('/api/admin/user-registry')) {
    resourceType = 'user_registry';
  } else if (path.startsWith('/api/admin/apps') || path.startsWith('/apps')) {
    resourceType = 'application';
    const match = path.match(/\/apps\/([^/]+)/);
    resourceId = match?.[1];
  } else if (path.startsWith('/api/admin/users') || path.startsWith('/users')) {
    resourceType = 'user';
    const match = path.match(/\/users\/([^/]+)/);
    resourceId = match?.[1];
  } else if (path.includes('/assignments')) {
    resourceType = 'assignment';
  } else if (path.includes('/consent')) {
    resourceType = 'consent';
  } else if (path.includes('/dsar')) {
    resourceType = 'dsar';
  } else if (path.includes('/legal-hold')) {
    resourceType = 'legal_hold';
  } else if (path.includes('/break-glass')) {
    resourceType = 'break_glass';
  } else if (path === '/me') {
    resourceType = 'self';
  }
  
  // Determine action from method
  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
    case 'OPTIONS':
      action = 'read';
      break;
    case 'POST':
    case 'PUT':
    case 'PATCH':
      action = 'write';
      break;
    case 'DELETE':
      action = 'delete';
      break;
  }
  
  return { method, path, resourceType, resourceId, action };
}

function checkAuthorization(
  permissionLevel: string,
  scopes: string[],
  resource: ParsedResource,
  userId: string,
  appUid?: string
): boolean {
  // Break Glass requires radiant_admin AND specific scope
  if (resource.resourceType === 'break_glass') {
    return permissionLevel === 'radiant_admin' && 
      (scopes.some(s => s.includes('/break_glass')) || scopes.some(s => s.includes('/admin.full')));
  }
  
  // Legal Hold requires radiant_admin
  if (resource.resourceType === 'legal_hold' && resource.action !== 'read') {
    return permissionLevel === 'radiant_admin';
  }
  
  // Radiant admins have full access
  if (permissionLevel === 'radiant_admin') {
    return true;
  }
  
  // Tenant admins have full access within their tenant
  if (permissionLevel === 'tenant_admin') {
    return true;
  }
  
  // App admins
  if (permissionLevel === 'app_admin') {
    // Can only access their assigned app
    if (resource.resourceType === 'application' && resource.resourceId && resource.resourceId !== appUid) {
      return false;
    }
    
    // Check scopes for user registry operations
    if (resource.resourceType === 'user_registry') {
      if (resource.action === 'read') {
        return scopes.some(s => s.includes('/users.read') || s.includes('/apps.read'));
      }
      if (resource.action === 'write') {
        return scopes.some(s => s.includes('/users.write'));
      }
    }
    
    // Assignment modifications limited
    if (resource.resourceType === 'assignment' && resource.action !== 'read') {
      return false;
    }
    
    return true;
  }
  
  // Regular users
  if (permissionLevel === 'user') {
    // Self-access always allowed
    if (resource.resourceType === 'self') {
      return true;
    }
    
    // Users can access their own data
    if (resource.resourceType === 'user' && resource.resourceId === userId) {
      return true;
    }
    
    // Users can manage their own consent
    if (resource.resourceType === 'consent') {
      return true;
    }
    
    // Users can view their own assignments and submit DSAR
    if (resource.resourceType === 'assignment' && resource.action === 'read') {
      return true;
    }
    if (resource.resourceType === 'dsar') {
      return true;
    }
    
    // Users can read applications they're assigned to
    if (resource.resourceType === 'application' && resource.action === 'read') {
      return true;
    }
    
    return false;
  }
  
  return false;
}

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context: Record<string, string>
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };
}
