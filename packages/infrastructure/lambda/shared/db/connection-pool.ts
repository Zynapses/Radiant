/**
 * RADIANT v4.18.0 - Database Connection Pool Verification
 * Utilities for verifying and monitoring RDS Proxy connection pooling
 * with connection limits and exhaustion protection
 */

import { executeStatement } from './client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// Connection pool configuration
const POOL_CONFIG = {
  maxConnections: parseInt(process.env.DB_POOL_MAX || '10', 10),
  minConnections: parseInt(process.env.DB_POOL_MIN || '1', 10),
  acquireTimeoutMs: parseInt(process.env.DB_ACQUIRE_TIMEOUT_MS || '10000', 10),
  idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
  maxWaitingClients: parseInt(process.env.DB_MAX_WAITING || '50', 10),
  utilizationWarningThreshold: 0.7,  // 70%
  utilizationCriticalThreshold: 0.9, // 90%
};

// Connection pool state tracking
let activeConnectionCount = 0;
let waitingClientCount = 0;
let connectionAcquireFailures = 0;
let lastExhaustionWarning: Date | null = null;

export interface ConnectionPoolStatus {
  isHealthy: boolean;
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  utilizationPercent: number;
  lastChecked: Date;
  usingProxy: boolean;
  proxyEndpoint?: string;
  waitingClients: number;
  acquireFailures: number;
}

/**
 * Connection pool exhaustion error
 */
export class ConnectionPoolExhaustedError extends Error {
  constructor(
    public readonly activeConnections: number,
    public readonly maxConnections: number,
    public readonly waitingClients: number
  ) {
    super(`Connection pool exhausted: ${activeConnections}/${maxConnections} connections in use, ${waitingClients} clients waiting`);
    this.name = 'ConnectionPoolExhaustedError';
  }
}

/**
 * Acquire a connection with exhaustion protection
 */
export async function acquireConnection(): Promise<void> {
  // Check if pool is exhausted
  if (activeConnectionCount >= POOL_CONFIG.maxConnections) {
    if (waitingClientCount >= POOL_CONFIG.maxWaitingClients) {
      connectionAcquireFailures++;
      throw new ConnectionPoolExhaustedError(
        activeConnectionCount,
        POOL_CONFIG.maxConnections,
        waitingClientCount
      );
    }
    
    // Log warning if utilization is high
    const utilization = activeConnectionCount / POOL_CONFIG.maxConnections;
    if (utilization >= POOL_CONFIG.utilizationCriticalThreshold) {
      const now = new Date();
      if (!lastExhaustionWarning || now.getTime() - lastExhaustionWarning.getTime() > 60000) {
        logger.warn('DB Pool critical utilization', {
          active: activeConnectionCount,
          max: POOL_CONFIG.maxConnections,
          waiting: waitingClientCount,
          utilization: `${(utilization * 100).toFixed(1)}%`,
        });
        lastExhaustionWarning = now;
      }
    }
  }
  
  waitingClientCount++;
  try {
    // Simulated acquire - actual pool management is in pg Pool
    activeConnectionCount++;
  } finally {
    waitingClientCount--;
  }
}

/**
 * Release a connection back to the pool
 */
export function releaseConnection(): void {
  if (activeConnectionCount > 0) {
    activeConnectionCount--;
  }
}

/**
 * Get current pool utilization
 */
export function getPoolUtilization(): {
  utilization: number;
  status: 'healthy' | 'warning' | 'critical' | 'exhausted';
} {
  const utilization = activeConnectionCount / POOL_CONFIG.maxConnections;
  
  let status: 'healthy' | 'warning' | 'critical' | 'exhausted';
  if (utilization >= 1) {
    status = 'exhausted';
  } else if (utilization >= POOL_CONFIG.utilizationCriticalThreshold) {
    status = 'critical';
  } else if (utilization >= POOL_CONFIG.utilizationWarningThreshold) {
    status = 'warning';
  } else {
    status = 'healthy';
  }
  
  return { utilization, status };
}

/**
 * Get pool configuration
 */
export function getPoolConfig(): typeof POOL_CONFIG {
  return { ...POOL_CONFIG };
}

/**
 * Check if RDS Proxy is being used
 */
export function isUsingRdsProxy(): boolean {
  const endpoint = process.env.AURORA_CLUSTER_ARN || '';
  // RDS Proxy endpoints contain 'proxy' in the identifier
  return endpoint.includes('proxy') || 
         process.env.USE_RDS_PROXY === 'true' ||
         !!process.env.RDS_PROXY_ENDPOINT;
}

/**
 * Get the database endpoint being used
 */
export function getDatabaseEndpoint(): string {
  return process.env.RDS_PROXY_ENDPOINT || 
         process.env.AURORA_CLUSTER_ENDPOINT || 
         'unknown';
}

/**
 * Check connection pool health
 * Note: This uses PostgreSQL's pg_stat_activity to check connections
 */
export async function checkConnectionPoolHealth(): Promise<ConnectionPoolStatus> {
  const lastChecked = new Date();
  
  try {
    // Query PostgreSQL for connection statistics
    const result = await executeStatement<{
      total_connections: number;
      active_connections: number;
      idle_connections: number;
      max_connections: number;
    }>(`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
    `, []);
    
    if (result.rows.length === 0) {
      return {
        isHealthy: false,
        activeConnections: 0,
        idleConnections: 0,
        maxConnections: 0,
        utilizationPercent: 0,
        lastChecked,
        usingProxy: isUsingRdsProxy(),
        proxyEndpoint: getDatabaseEndpoint(),
        waitingClients: waitingClientCount,
        acquireFailures: connectionAcquireFailures,
      };
    }
    
    const stats = result.rows[0];
    const totalConnections = stats.total_connections || 0;
    const maxConnections = stats.max_connections || 100;
    const utilizationPercent = (totalConnections / maxConnections) * 100;
    
    return {
      isHealthy: utilizationPercent < 80, // Healthy if under 80% utilization
      activeConnections: stats.active_connections || 0,
      idleConnections: stats.idle_connections || 0,
      maxConnections,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      lastChecked,
      usingProxy: isUsingRdsProxy(),
      proxyEndpoint: getDatabaseEndpoint(),
      waitingClients: waitingClientCount,
      acquireFailures: connectionAcquireFailures,
    };
  } catch (error) {
    // Return degraded status if we can't check
    return {
      isHealthy: false,
      activeConnections: -1,
      idleConnections: -1,
      maxConnections: -1,
      utilizationPercent: -1,
      lastChecked,
      usingProxy: isUsingRdsProxy(),
      proxyEndpoint: getDatabaseEndpoint(),
      waitingClients: waitingClientCount,
      acquireFailures: connectionAcquireFailures,
    };
  }
}

/**
 * Verify RDS Proxy configuration
 */
export async function verifyRdsProxyConfig(): Promise<{
  configured: boolean;
  endpoint: string;
  recommendations: string[];
}> {
  const recommendations: string[] = [];
  const endpoint = getDatabaseEndpoint();
  const usingProxy = isUsingRdsProxy();
  
  if (!usingProxy) {
    recommendations.push('Consider enabling RDS Proxy for better connection pooling');
    recommendations.push('RDS Proxy reduces connection overhead for Lambda functions');
  }
  
  // Check environment variables
  if (!process.env.AURORA_CLUSTER_ARN) {
    recommendations.push('AURORA_CLUSTER_ARN environment variable not set');
  }
  
  if (!process.env.AURORA_SECRET_ARN) {
    recommendations.push('AURORA_SECRET_ARN environment variable not set');
  }
  
  // Check if connection test succeeds
  try {
    await executeStatement('SELECT 1', []);
  } catch (error) {
    logger.warn('Database connection test failed:', { data: error instanceof Error ? error.message : 'unknown' });
    recommendations.push('Database connection test failed - verify credentials and network');
  }
  
  return {
    configured: usingProxy && recommendations.length === 0,
    endpoint,
    recommendations,
  };
}

/**
 * Connection pool metrics for monitoring
 */
export interface ConnectionMetrics {
  timestamp: Date;
  queryCount: number;
  averageLatencyMs: number;
  errorCount: number;
  connectionReuseCount: number;
}

// In-memory metrics tracking
let metricsStartTime = Date.now();
let queryCount = 0;
let totalLatencyMs = 0;
let errorCount = 0;
let connectionReuseCount = 0;

export function recordQueryMetrics(latencyMs: number, reusedConnection: boolean, error: boolean): void {
  queryCount++;
  totalLatencyMs += latencyMs;
  if (error) errorCount++;
  if (reusedConnection) connectionReuseCount++;
}

export function getConnectionMetrics(): ConnectionMetrics {
  return {
    timestamp: new Date(),
    queryCount,
    averageLatencyMs: queryCount > 0 ? totalLatencyMs / queryCount : 0,
    errorCount,
    connectionReuseCount,
  };
}

export function resetConnectionMetrics(): void {
  metricsStartTime = Date.now();
  queryCount = 0;
  totalLatencyMs = 0;
  errorCount = 0;
  connectionReuseCount = 0;
}
