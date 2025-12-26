/**
 * Database Client Wrapper
 * 
 * Provides safe database client management with automatic connection release.
 * Prevents connection leaks by ensuring clients are always released.
 */

import { PoolClient } from 'pg';
import { getPoolClient } from './centralized-pool';
import { logger } from '../logging/enhanced-logger';

/**
 * Execute a database operation with automatic client release.
 * This prevents connection leaks that can exhaust the connection pool.
 * 
 * @example
 * ```ts
 * const result = await withDbClient(async (client) => {
 *   const res = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
 *   return res.rows[0];
 * });
 * ```
 */
export async function withDbClient<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPoolClient();
  try {
    return await operation(client);
  } finally {
    client.release();
  }
}

/**
 * Execute a database transaction with automatic commit/rollback and client release.
 * 
 * @example
 * ```ts
 * const result = await withTransaction(async (client) => {
 *   await client.query('INSERT INTO orders (...) VALUES (...)', [...]);
 *   await client.query('UPDATE inventory SET quantity = quantity - 1 WHERE ...', [...]);
 *   return { success: true };
 * });
 * ```
 */
export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => {
      logger.error('Failed to rollback transaction', rollbackError instanceof Error ? rollbackError : undefined);
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a read-only database operation with automatic client release.
 * Sets the transaction to read-only mode for safety.
 */
export async function withReadOnlyClient<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPoolClient();
  try {
    await client.query('SET TRANSACTION READ ONLY');
    return await operation(client);
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a single connection for efficiency.
 * Useful when you need to run several independent queries.
 */
export async function withBatchQueries<T>(
  operations: ((client: PoolClient) => Promise<unknown>)[]
): Promise<unknown[]> {
  const client = await getPoolClient();
  try {
    const results: unknown[] = [];
    for (const operation of operations) {
      results.push(await operation(client));
    }
    return results;
  } finally {
    client.release();
  }
}

/**
 * Helper to run a query and return first row or null
 */
export async function queryOne<T>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  return withDbClient(async (client) => {
    const result = await client.query(sql, params);
    return (result.rows[0] as T) || null;
  });
}

/**
 * Helper to run a query and return all rows
 */
export async function queryMany<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return withDbClient(async (client) => {
    const result = await client.query(sql, params);
    return result.rows as T[];
  });
}

/**
 * Helper to run an INSERT/UPDATE/DELETE and return affected row count
 */
export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  return withDbClient(async (client) => {
    const result = await client.query(sql, params);
    return result.rowCount ?? 0;
  });
}
