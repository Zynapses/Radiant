/**
 * Direct Aurora PostgreSQL connection for OMEGA Forge
 *
 * ⚠️  OMEGA Forge is a PLATFORM-LEVEL SYSTEM ADMIN tool.
 * ⚠️  It is NOT part of the Think Tank Suite of tenant apps.
 * ⚠️  Access is restricted to authenticated system admins via middleware.ts.
 *
 * Unlike tenant apps (Think Tank, Curator, Dojo, etc.) which go through
 * the Lambda service layer with RLS, Forge connects directly via pg driver
 * through RDS Proxy with full cross-tenant visibility. This is intentional —
 * Forge manages cartridges, brains, and firmware across ALL tenants.
 *
 * Authentication: System admin token validated by middleware.ts
 * Authorization: Pool B super_admin role required
 * Audit: All write operations are logged to cartridge_audit_log
 */

import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.AURORA_PROXY_ENDPOINT!,
      port: parseInt(process.env.AURORA_PORT || '5432'),
      database: process.env.AURORA_DATABASE!,
      user: process.env.AURORA_FORGE_USER!,
      password: process.env.AURORA_FORGE_PASSWORD!,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

/**
 * Execute a query. No RLS. Full access.
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount || 0 };
  } finally {
    client.release();
  }
}

/**
 * Execute within a transaction
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Query with tenant context (optional — Forge can set tenant context for testing RLS)
 */
export async function queryAsTenant<T = any>(
  tenantId: string,
  sql: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const client = await getPool().connect();
  try {
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
    const result = await client.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount || 0 };
  } finally {
    client.release();
  }
}
