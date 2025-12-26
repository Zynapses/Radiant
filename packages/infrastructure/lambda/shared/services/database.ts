/**
 * Database Service
 * 
 * PostgreSQL connection management with pooling and RLS support
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getSecretJson } from './secrets';

let pool: Pool | null = null;

interface DatabaseCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/**
 * Initialize the database connection pool
 */
export async function initDatabase(): Promise<void> {
  if (pool) return;

  const credentials = await getDatabaseCredentials();

  pool = new Pool({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.username,
    password: credentials.password,
    max: 10, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
  });

  pool.on('error', (err: Error) => {
    console.error('Unexpected database pool error:', err);
  });
}

/**
 * Get database credentials from Secrets Manager or environment
 */
async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  // Try Secrets Manager first
  try {
    return await getSecretJson<DatabaseCredentials>('radiant/database/credentials');
  } catch (error) {
    // Fallback to environment variables when Secrets Manager unavailable
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      const url = new URL(databaseUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port || '5432', 10),
        database: url.pathname.slice(1),
        username: url.username,
        password: url.password,
      };
    }

    return {
      host: process.env.DB_HOST || '',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'radiant',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };
  }
}

/**
 * Get a client from the pool
 */
export async function getClient(): Promise<PoolClient> {
  if (!pool) {
    await initDatabase();
  }
  return pool!.connect();
}

/**
 * Execute a query
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  if (!pool) {
    await initDatabase();
  }
  return pool!.query<T>(text, values);
}

/**
 * Execute a query with Row-Level Security context
 */
export async function queryWithRls<T extends QueryResultRow = QueryResultRow>(
  tenantId: string,
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  const client = await getClient();
  
  try {
    // Set tenant context for RLS
    await client.query('SET app.current_tenant_id = $1', [tenantId]);
    
    // Execute the actual query
    const result = await client.query<T>(text, values);
    
    // Reset context
    await client.query('RESET app.current_tenant_id');
    
    return result;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
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
 * Execute a transaction with RLS context
 */
export async function transactionWithRls<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    await client.query('SET app.current_tenant_id = $1', [tenantId]);
    
    const result = await fn(client);
    
    await client.query('RESET app.current_tenant_id');
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
 * Close the database pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Check database health
 */
export async function checkHealth(): Promise<{ healthy: boolean; latency: number }> {
  const start = Date.now();
  
  try {
    await query('SELECT 1');
    return {
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
    };
  }
}

// ============================================================================
// Query Builders
// ============================================================================

export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

/**
 * Build a SELECT query
 */
export function buildSelectQuery(
  table: string,
  columns: string[] = ['*'],
  options: QueryOptions = {}
): { text: string; values: unknown[] } {
  const { where, orderBy, order = 'ASC', limit, offset } = options;
  const values: unknown[] = [];
  let paramIndex = 1;

  let text = `SELECT ${columns.join(', ')} FROM ${table}`;

  if (where && Object.keys(where).length > 0) {
    const conditions = Object.entries(where).map(([key, value]) => {
      values.push(value);
      return `${key} = $${paramIndex++}`;
    });
    text += ` WHERE ${conditions.join(' AND ')}`;
  }

  if (orderBy) {
    text += ` ORDER BY ${orderBy} ${order}`;
  }

  if (limit) {
    text += ` LIMIT $${paramIndex++}`;
    values.push(limit);
  }

  if (offset) {
    text += ` OFFSET $${paramIndex++}`;
    values.push(offset);
  }

  return { text, values };
}

/**
 * Build an INSERT query
 */
export function buildInsertQuery(
  table: string,
  data: Record<string, unknown>
): { text: string; values: unknown[] } {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`);

  const text = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

  return { text, values };
}

/**
 * Build an UPDATE query
 */
export function buildUpdateQuery(
  table: string,
  data: Record<string, unknown>,
  where: Record<string, unknown>
): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  let paramIndex = 1;

  const setClauses = Object.entries(data).map(([key, value]) => {
    values.push(value);
    return `${key} = $${paramIndex++}`;
  });

  const whereConditions = Object.entries(where).map(([key, value]) => {
    values.push(value);
    return `${key} = $${paramIndex++}`;
  });

  const text = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereConditions.join(' AND ')} RETURNING *`;

  return { text, values };
}

/**
 * Build a DELETE query
 */
export function buildDeleteQuery(
  table: string,
  where: Record<string, unknown>
): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  let paramIndex = 1;

  const conditions = Object.entries(where).map(([key, value]) => {
    values.push(value);
    return `${key} = $${paramIndex++}`;
  });

  const text = `DELETE FROM ${table} WHERE ${conditions.join(' AND ')}`;

  return { text, values };
}
