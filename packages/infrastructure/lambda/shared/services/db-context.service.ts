/**
 * RADIANT v4.18.0 - Database Context Middleware Service
 * 
 * Provides secure database context management for multi-tenant RLS.
 * Uses SET LOCAL for transaction-scoped context (critical for connection pooling).
 */

import { Pool, PoolClient } from 'pg';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { AuthContext, PermissionLevel } from '@radiant/shared/types/user-registry.types';

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', err);
});

/**
 * Execute database operation with secure tenant context.
 * Uses SET LOCAL for transaction-scoped variables (required for connection pooling).
 */
export async function withSecureDBContext<T>(
  authContext: AuthContext,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // CRITICAL: Use SET LOCAL for transaction-scoped context
    // This ensures context doesn't leak across pooled connections
    await client.query(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      [authContext.tenantId]
    );
    
    await client.query(
      `SELECT set_config('app.current_user_id', $1, true)`,
      [authContext.userId]
    );
    
    await client.query(
      `SELECT set_config('app.permission_level', $1, true)`,
      [authContext.permissionLevel]
    );
    
    if (authContext.appId) {
      await client.query(
        `SELECT set_config('app.current_app_id', $1, true)`,
        [authContext.appId]
      );
    }
    
    if (authContext.jurisdiction) {
      await client.query(
        `SELECT set_config('app.user_jurisdiction', $1, true)`,
        [authContext.jurisdiction]
      );
    }
    
    if (authContext.dataRegion) {
      await client.query(
        `SELECT set_config('app.data_region', $1, true)`,
        [authContext.dataRegion]
      );
    }
    
    if (authContext.breakGlassMode) {
      await client.query(
        `SELECT set_config('app.break_glass_mode', 'true', true)`
      );
    }
    
    // Backward compatibility with existing RLS policies
    const isSuperAdmin = authContext.permissionLevel === 'radiant_admin';
    await client.query(
      `SELECT set_config('app.is_super_admin', $1, true)`,
      [isSuperAdmin.toString()]
    );
    
    const result = await operation(client);
    
    await client.query('COMMIT');
    
    return result;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
    
  } finally {
    // Reset all session variables before returning to pool
    try {
      await client.query('RESET ALL');
    } catch (resetError) {
      logger.error('Failed to reset session', resetError as Error);
    }
    client.release();
  }
}

/**
 * Execute database operation with auth schema context setter.
 * Uses the auth.set_context() function for cleaner context management.
 */
export async function withAuthContext<T>(
  authContext: AuthContext,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Use the auth.set_context() function
    await client.query(
      `SELECT auth.set_context($1, $2, $3, $4, $5, $6, $7)`,
      [
        authContext.tenantId,
        authContext.userId || null,
        authContext.appId || null,
        authContext.permissionLevel,
        authContext.jurisdiction || null,
        authContext.dataRegion || null,
        authContext.breakGlassMode || false,
      ]
    );
    
    const result = await operation(client);
    
    await client.query('COMMIT');
    
    return result;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
    
  } finally {
    try {
      await client.query('SELECT auth.clear_context()');
    } catch (clearError) {
      logger.error('Failed to clear auth context', clearError as Error);
    }
    client.release();
  }
}

/**
 * Extract auth context from API Gateway event authorizer context.
 */
export function extractAuthContext(event: {
  requestContext?: {
    authorizer?: Record<string, string>;
  };
}): AuthContext {
  const authorizer = event.requestContext?.authorizer || {};
  
  if (!authorizer.tenant_id) {
    throw new Error('Missing tenant_id in authorization context');
  }
  
  return {
    tenantId: authorizer.tenant_id,
    userId: authorizer.user_id,
    permissionLevel: (authorizer.permission_level || 'user') as PermissionLevel,
    appId: authorizer.app_uid || undefined,
    jurisdiction: authorizer.jurisdiction || undefined,
    dataRegion: authorizer.data_region || undefined,
    breakGlassMode: authorizer.break_glass_mode === 'true',
    scopes: authorizer.scopes ? JSON.parse(authorizer.scopes) : [],
    groups: authorizer.groups ? JSON.parse(authorizer.groups) : [],
  };
}

/**
 * HOC wrapper for Lambda handlers with database context.
 */
export function withDBContext(
  handler: (event: any, client: PoolClient, authContext: AuthContext) => Promise<any>
) {
  return async (event: any) => {
    const authContext = extractAuthContext(event);
    return withSecureDBContext(authContext, (client) => handler(event, client, authContext));
  };
}

/**
 * Check if user has specific permission level or higher.
 */
export function hasPermission(
  authContext: AuthContext,
  requiredLevel: PermissionLevel
): boolean {
  const levels: PermissionLevel[] = ['user', 'app_admin', 'tenant_admin', 'radiant_admin'];
  const currentIndex = levels.indexOf(authContext.permissionLevel);
  const requiredIndex = levels.indexOf(requiredLevel);
  return currentIndex >= requiredIndex;
}

/**
 * Check if user is Radiant admin (platform super admin).
 */
export function isRadiantAdmin(authContext: AuthContext): boolean {
  return authContext.permissionLevel === 'radiant_admin' ||
    authContext.groups?.includes('radiant-admins') === true;
}

/**
 * Check if user is Tenant admin or higher.
 */
export function isTenantAdmin(authContext: AuthContext): boolean {
  return authContext.permissionLevel === 'tenant_admin' ||
    authContext.permissionLevel === 'radiant_admin' ||
    authContext.groups?.includes('tenant-admins') === true ||
    authContext.groups?.includes('radiant-admins') === true;
}

/**
 * Check if Break Glass mode is active.
 */
export function isBreakGlassActive(authContext: AuthContext): boolean {
  return authContext.breakGlassMode === true;
}

/**
 * Validate that user has required scope.
 */
export function hasScope(authContext: AuthContext, scope: string): boolean {
  return authContext.scopes?.includes(scope) === true ||
    authContext.scopes?.some(s => s.endsWith('/admin.full')) === true;
}

/**
 * Get raw database pool for advanced operations.
 * Use with caution - prefer withSecureDBContext for most operations.
 */
export function getPool(): Pool {
  return pool;
}

/**
 * Gracefully shut down the connection pool.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

export const dbContextService = {
  withSecureDBContext,
  withAuthContext,
  extractAuthContext,
  withDBContext,
  hasPermission,
  isRadiantAdmin,
  isTenantAdmin,
  isBreakGlassActive,
  hasScope,
  getPool,
  closePool,
};

export default dbContextService;
