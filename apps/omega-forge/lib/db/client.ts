/**
 * Direct Aurora PostgreSQL connection for OMEGA Forge
 *
 * Unlike the tenant admin dashboard which goes through Lambda + Data API,
 * Forge connects directly via pg driver through RDS Proxy.
 *
 * NO ROW-LEVEL SECURITY is enforced at this level.
 * Forge sees ALL tenants, ALL data. This is intentional.
 * Forge is a SYSTEM ADMIN tool behind the firewall.
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
