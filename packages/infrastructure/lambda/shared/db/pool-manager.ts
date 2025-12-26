/**
 * Centralized Database Pool Manager
 * 
 * Single shared connection pool for all Lambda handlers.
 * Prevents connection exhaustion and improves resource efficiency.
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../logger';

// Singleton pool instance
let pool: Pool | null = null;
let poolConfig: PoolConfig | null = null;

// Pool statistics
interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  acquiredCount: number;
  releasedCount: number;
  errorCount: number;
  lastError: string | null;
  createdAt: Date;
}

const stats: PoolStats = {
  totalConnections: 0,
  idleConnections: 0,
  waitingClients: 0,
  acquiredCount: 0,
  releasedCount: 0,
  errorCount: 0,
  lastError: null,
  createdAt: new Date(),
};

/**
 * Default pool configuration optimized for Lambda
 */
function getDefaultConfig(): PoolConfig {
  return {
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: parseInt(process.env.DB_POOL_MIN || '1', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
    allowExitOnIdle: true, // Important for Lambda - allows graceful shutdown
  };
}

/**
 * Initialize the connection pool
 */
export function initPool(config?: Partial<PoolConfig>): Pool {
  if (pool) {
    return pool;
  }

  poolConfig = { ...getDefaultConfig(), ...config };
  pool = new Pool(poolConfig);

  // Set up event listeners
  pool.on('connect', () => {
    stats.totalConnections++;
    logger.debug('DB pool: new connection established', { total: stats.totalConnections });
  });

  pool.on('acquire', () => {
    stats.acquiredCount++;
    stats.idleConnections = Math.max(0, stats.idleConnections - 1);
  });

  pool.on('release', () => {
    stats.releasedCount++;
    stats.idleConnections++;
  });

  pool.on('remove', () => {
    stats.totalConnections = Math.max(0, stats.totalConnections - 1);
    stats.idleConnections = Math.max(0, stats.idleConnections - 1);
  });

  pool.on('error', (err) => {
    stats.errorCount++;
    stats.lastError = err.message;
    logger.error('DB pool error', err);
  });

  logger.info('DB pool initialized', { 
    max: poolConfig.max, 
    min: poolConfig.min,
    idleTimeout: poolConfig.idleTimeoutMillis,
  });

  return pool;
}

/**
 * Get the shared pool instance (initializes if needed)
 */
export function getPool(): Pool {
  if (!pool) {
    return initPool();
  }
  return pool;
}

/**
 * Get a client from the pool with automatic release on error
 */
export async function getClient(): Promise<PoolClient> {
  const p = getPool();
  const client = await p.connect();
  
  // Wrap release to track stats
  const originalRelease = client.release.bind(client);
  client.release = (err?: Error | boolean) => {
    if (err) {
      stats.errorCount++;
      stats.lastError = err instanceof Error ? err.message : 'Unknown error';
    }
    return originalRelease(err);
  };
  
  return client;
}

/**
 * Execute a query using a pooled connection
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const p = getPool();
  const result = await p.query(text, values);
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount || 0,
  };
}

/**
 * Execute a transaction with automatic rollback on error
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
 * Get pool statistics
 */
export function getPoolStats(): PoolStats & { poolSize: number; available: number } {
  const p = pool;
  return {
    ...stats,
    poolSize: p?.totalCount || 0,
    available: p?.idleCount || 0,
  };
}

/**
 * Gracefully close the pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    const poolStats = getPoolStats();
    logger.info('Closing DB pool', { stats: poolStats });
    await pool.end();
    pool = null;
    poolConfig = null;
  }
}

/**
 * Health check for the pool
 */
export async function healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  
  try {
    const result = await query('SELECT 1 as health');
    return {
      healthy: result.rows.length > 0,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Wrapper for handlers that need database access
 * Ensures proper connection handling
 */
export function withDatabase<T>(
  handler: (client: PoolClient) => Promise<T>
): Promise<T> {
  return transaction(handler);
}

// Export pool for direct access if needed (prefer using getPool())
export { pool };
