/**
 * RADIANT v4.18.0 - Centralized Database Pool Manager
 * 
 * Single shared connection pool for all Lambda handlers.
 * Reads configuration from database with fallback to environment variables.
 * Prevents connection exhaustion and improves resource efficiency.
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../logger';

// Singleton pool instance
let sharedPool: Pool | null = null;
let poolInitializing = false;
let poolInitPromise: Promise<Pool> | null = null;

// Configuration cache
interface PoolConfigCache {
  config: PoolConfig;
  loadedAt: number;
  ttlMs: number;
}

let configCache: PoolConfigCache | null = null;
const CONFIG_CACHE_TTL_MS = 60000; // 1 minute

// Pool statistics
export interface CentralizedPoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  acquiredCount: number;
  releasedCount: number;
  errorCount: number;
  lastError: string | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  configLoadedAt: Date | null;
  utilizationPercent: number;
  status: 'healthy' | 'warning' | 'critical' | 'exhausted' | 'uninitialized';
}

const stats: CentralizedPoolStats = {
  totalConnections: 0,
  idleConnections: 0,
  waitingClients: 0,
  acquiredCount: 0,
  releasedCount: 0,
  errorCount: 0,
  lastError: null,
  lastErrorAt: null,
  createdAt: new Date(),
  configLoadedAt: null,
  utilizationPercent: 0,
  status: 'uninitialized',
};

// Default configuration from environment variables
function getDefaultPoolConfig(): PoolConfig {
  return {
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: parseInt(process.env.DB_POOL_MIN || '1', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000', 10),
    allowExitOnIdle: true, // Important for Lambda - allows graceful shutdown
  };
}

// Thresholds from environment (will be overridden by DB config)
let utilizationWarningThreshold = parseFloat(process.env.DB_UTILIZATION_WARNING || '0.7');
let utilizationCriticalThreshold = parseFloat(process.env.DB_UTILIZATION_CRITICAL || '0.9');

/**
 * Load configuration from database
 * Falls back to environment variables if DB is not available
 */
async function loadConfigFromDatabase(pool: Pool): Promise<Partial<PoolConfig>> {
  try {
    const result = await pool.query(`
      SELECT key, value 
      FROM system_config 
      WHERE category_id = 'connection_pool'
    `);

    const dbConfig: Record<string, unknown> = {};
    for (const row of result.rows) {
      const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      dbConfig[row.key] = value;
    }

    // Update thresholds
    if (dbConfig.utilization_warning_threshold) {
      utilizationWarningThreshold = Number(dbConfig.utilization_warning_threshold);
    }
    if (dbConfig.utilization_critical_threshold) {
      utilizationCriticalThreshold = Number(dbConfig.utilization_critical_threshold);
    }

    stats.configLoadedAt = new Date();

    return {
      max: dbConfig.max_connections ? Number(dbConfig.max_connections) : undefined,
      min: dbConfig.min_connections ? Number(dbConfig.min_connections) : undefined,
      idleTimeoutMillis: dbConfig.idle_timeout_ms ? Number(dbConfig.idle_timeout_ms) : undefined,
      connectionTimeoutMillis: dbConfig.connection_timeout_ms ? Number(dbConfig.connection_timeout_ms) : undefined,
      statement_timeout: dbConfig.statement_timeout_ms ? Number(dbConfig.statement_timeout_ms) : undefined,
    };
  } catch (error) {
    logger.warn('Failed to load pool config from database, using defaults', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return {};
  }
}

/**
 * Calculate pool utilization status
 */
function calculateStatus(): 'healthy' | 'warning' | 'critical' | 'exhausted' | 'uninitialized' {
  if (!sharedPool) return 'uninitialized';
  
  const maxConnections = (sharedPool as Pool & { options?: { max?: number } }).options?.max || 10;
  const utilization = stats.totalConnections / maxConnections;
  stats.utilizationPercent = Math.round(utilization * 100);

  if (utilization >= 1) return 'exhausted';
  if (utilization >= utilizationCriticalThreshold) return 'critical';
  if (utilization >= utilizationWarningThreshold) return 'warning';
  return 'healthy';
}

/**
 * Initialize the centralized connection pool
 */
export async function initCentralizedPool(customConfig?: Partial<PoolConfig>): Promise<Pool> {
  // Return existing pool if available
  if (sharedPool) {
    return sharedPool;
  }

  // Prevent multiple simultaneous initializations
  if (poolInitializing && poolInitPromise) {
    return poolInitPromise;
  }

  poolInitializing = true;
  poolInitPromise = (async () => {
    try {
      // Start with default config
      const defaultConfig = getDefaultPoolConfig();
      const mergedConfig = { ...defaultConfig, ...customConfig };

      // Create initial pool
      sharedPool = new Pool(mergedConfig);

      // Try to load config from database and recreate pool if different
      const dbConfig = await loadConfigFromDatabase(sharedPool);
      const hasDbChanges = Object.keys(dbConfig).some(
        key => dbConfig[key as keyof PoolConfig] !== undefined && 
               dbConfig[key as keyof PoolConfig] !== mergedConfig[key as keyof PoolConfig]
      );

      if (hasDbChanges) {
        await sharedPool.end();
        const finalConfig = { ...mergedConfig, ...dbConfig };
        sharedPool = new Pool(finalConfig);
        
        configCache = {
          config: finalConfig,
          loadedAt: Date.now(),
          ttlMs: CONFIG_CACHE_TTL_MS,
        };
      }

      // Set up event listeners
      setupPoolEventListeners(sharedPool);

      logger.info('Centralized DB pool initialized', {
        max: sharedPool.options.max,
        min: sharedPool.options.min,
        idleTimeout: sharedPool.options.idleTimeoutMillis,
        configSource: hasDbChanges ? 'database' : 'environment',
      });

      stats.status = 'healthy';
      return sharedPool;
    } catch (error) {
      poolInitializing = false;
      poolInitPromise = null;
      throw error;
    } finally {
      poolInitializing = false;
    }
  })();

  return poolInitPromise;
}

/**
 * Set up pool event listeners for monitoring
 */
function setupPoolEventListeners(pool: Pool): void {
  pool.on('connect', () => {
    stats.totalConnections++;
    stats.status = calculateStatus();
    logger.debug('DB pool: connection established', { 
      total: stats.totalConnections,
      status: stats.status,
    });
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
    stats.status = calculateStatus();
  });

  pool.on('error', (err) => {
    stats.errorCount++;
    stats.lastError = err.message;
    stats.lastErrorAt = new Date();
    logger.error('DB pool error', err, { stats: getPoolStats() });
  });
}

/**
 * Get the shared pool instance (initializes if needed)
 */
export async function getCentralizedPool(): Promise<Pool> {
  if (!sharedPool) {
    return initCentralizedPool();
  }
  return sharedPool;
}

/**
 * Get the shared pool instance synchronously (returns null if not initialized)
 */
export function getCentralizedPoolSync(): Pool | null {
  return sharedPool;
}

/**
 * Get a client from the pool with automatic release on error
 */
export async function getPoolClient(): Promise<PoolClient> {
  const pool = await getCentralizedPool();
  const client = await pool.connect();

  // Wrap release to track stats
  const originalRelease = client.release.bind(client);
  let released = false;

  client.release = (err?: Error | boolean) => {
    if (released) {
      logger.warn('Attempted to release client multiple times');
      return;
    }
    released = true;

    if (err) {
      stats.errorCount++;
      stats.lastError = err instanceof Error ? err.message : 'Unknown error';
      stats.lastErrorAt = new Date();
    }
    return originalRelease(err);
  };

  return client;
}

/**
 * Execute a query using a pooled connection
 */
export async function poolQuery<T = Record<string, unknown>>(
  text: string,
  values?: unknown[],
  requestId?: string
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = await getCentralizedPool();
  const start = Date.now();

  try {
    const result = await pool.query(text, values);
    const duration = Date.now() - start;

    if (duration > 5000) {
      logger.warn('Slow query detected', {
        duration,
        query: text.substring(0, 100),
        requestId,
      });
    }

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    stats.errorCount++;
    stats.lastError = error instanceof Error ? error.message : 'Unknown error';
    stats.lastErrorAt = new Date();
    throw error;
  }
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function poolTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  requestId?: string
): Promise<T> {
  const client = await getPoolClient();
  const start = Date.now();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');

    const duration = Date.now() - start;
    logger.debug('Transaction completed', { duration, requestId });

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', error instanceof Error ? error : undefined, {
      duration: Date.now() - start,
      requestId,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get pool statistics
 */
export function getPoolStats(): CentralizedPoolStats {
  const pool = sharedPool;
  stats.status = calculateStatus();

  return {
    ...stats,
    totalConnections: pool?.totalCount || stats.totalConnections,
    idleConnections: pool?.idleCount || stats.idleConnections,
    waitingClients: pool?.waitingCount || stats.waitingClients,
  };
}

/**
 * Health check for the pool
 */
export async function poolHealthCheck(): Promise<{
  healthy: boolean;
  latencyMs: number;
  stats: CentralizedPoolStats;
  error?: string;
}> {
  const start = Date.now();

  try {
    const result = await poolQuery('SELECT 1 as health');
    const poolStats = getPoolStats();

    return {
      healthy: result.rows.length > 0 && poolStats.status !== 'exhausted',
      latencyMs: Date.now() - start,
      stats: poolStats,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      stats: getPoolStats(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully close the pool
 */
export async function closeCentralizedPool(): Promise<void> {
  if (sharedPool) {
    const poolStats = getPoolStats();
    logger.info('Closing centralized DB pool', { stats: poolStats });
    await sharedPool.end();
    sharedPool = null;
    poolInitPromise = null;
    configCache = null;
  }
}

/**
 * Refresh configuration from database
 */
export async function refreshPoolConfig(): Promise<void> {
  if (!sharedPool) return;

  const dbConfig = await loadConfigFromDatabase(sharedPool);
  logger.info('Pool configuration refreshed from database', { config: dbConfig });
}

/**
 * Wrapper for handlers that need database access
 */
export function withCentralizedDatabase<T>(
  handler: (client: PoolClient) => Promise<T>,
  requestId?: string
): Promise<T> {
  return poolTransaction(handler, requestId);
}

// Export for backward compatibility
export { sharedPool as pool };
