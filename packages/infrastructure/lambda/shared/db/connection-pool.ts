/**
 * RADIANT v4.18.0 - Database Connection Pool Verification
 * Utilities for verifying and monitoring RDS Proxy connection pooling
 */

import { executeStatement } from './client';

export interface ConnectionPoolStatus {
  isHealthy: boolean;
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  utilizationPercent: number;
  lastChecked: Date;
  usingProxy: boolean;
  proxyEndpoint?: string;
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
  } catch {
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
