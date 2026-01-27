/**
 * PostgreSQL Scaling Service
 * 
 * Provides application-level access to the PostgreSQL scaling infrastructure:
 * - Connection routing (primary vs read replicas)
 * - Read-after-write consistency via session affinity
 * - Slow query logging
 * - Materialized view refresh orchestration
 * - Partition management
 * - Health monitoring
 * 
 * @see OpenAI PostgreSQL scaling patterns
 */

import { Pool, PoolClient } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// ============================================================================
// Types
// ============================================================================

interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: { rejectUnauthorized: boolean };
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statement_timeout: number;
}

interface ReplicaInfo {
  replicaName: string;
  endpoint: string;
  isPrimary: boolean;
  isHealthy: boolean;
  lagMs: number | null;
  weight: number;
}

interface RoutingDecision {
  targetEndpoint: string;
  targetReplica: string;
  routingReason: string;
  consistencyMode: 'strong' | 'eventual';
}

interface QueryMetrics {
  queryHash: string;
  durationMs: number;
  rowsExamined?: number;
  rowsReturned?: number;
  tenantId?: string;
  executionPlan?: string;
}

interface MaterializedViewRefreshResult {
  viewName: string;
  status: 'success' | 'error';
  durationMs: number;
  errorMessage?: string;
}

interface PartitionStats {
  partitionName: string;
  rowCount: number;
  totalSize: string;
  indexSize: string;
}

interface TableStats {
  tableName: string;
  rowCount: number;
  totalSize: string;
  indexSize: string;
  rowsInserted: number;
  rowsUpdated: number;
  rowsDeleted: number;
  lastVacuum?: Date;
  lastAnalyze?: Date;
}

// ============================================================================
// Service Implementation
// ============================================================================

class PostgreSQLScalingService {
  private primaryPool: Pool | null = null;
  private replicaPools: Map<string, Pool> = new Map();
  private credentials: { username: string; password: string } | null = null;
  private secretsClient = new SecretsManagerClient({});
  private sessionWriteCache: Map<string, Map<string, number>> = new Map(); // session -> table -> timestamp

  // Slow query threshold (ms)
  private readonly SLOW_QUERY_THRESHOLD_MS = 500;

  /**
   * Get database credentials from Secrets Manager
   */
  private async getCredentials(): Promise<{ username: string; password: string }> {
    if (this.credentials) {
      return this.credentials;
    }

    const secretArn = process.env.DB_SECRET_ARN;
    if (!secretArn) {
      throw new Error('DB_SECRET_ARN environment variable not set');
    }

    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await this.secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    this.credentials = {
      username: secret.username,
      password: secret.password,
    };

    return this.credentials;
  }

  /**
   * Get connection pool for primary (writes)
   */
  async getPrimaryPool(): Promise<Pool> {
    if (this.primaryPool) {
      return this.primaryPool;
    }

    const credentials = await this.getCredentials();
    const endpoint = process.env.RDS_PROXY_ENDPOINT || process.env.DB_PRIMARY_ENDPOINT;

    if (!endpoint) {
      throw new Error('RDS_PROXY_ENDPOINT or DB_PRIMARY_ENDPOINT not set');
    }

    this.primaryPool = new Pool({
      host: endpoint,
      port: 5432,
      database: 'radiant',
      user: credentials.username,
      password: credentials.password,
      ssl: { rejectUnauthorized: true },
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 60000,
    });

    return this.primaryPool;
  }

  /**
   * Get connection pool for read replica
   */
  async getReplicaPool(replicaName: string = 'reader-1'): Promise<Pool> {
    if (this.replicaPools.has(replicaName)) {
      return this.replicaPools.get(replicaName)!;
    }

    const credentials = await this.getCredentials();
    const endpoint = process.env.DB_READER_ENDPOINT;

    if (!endpoint) {
      // Fall back to primary if no reader endpoint configured
      console.warn('No reader endpoint configured, falling back to primary');
      return this.getPrimaryPool();
    }

    const pool = new Pool({
      host: endpoint,
      port: 5432,
      database: 'radiant',
      user: credentials.username,
      password: credentials.password,
      ssl: { rejectUnauthorized: true },
      max: 10,
      min: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 120000, // Higher timeout for analytics
    });

    this.replicaPools.set(replicaName, pool);
    return pool;
  }

  /**
   * Get routed connection based on query type and session
   */
  async getRoutedConnection(
    queryType: 'read' | 'write' | 'analytics',
    tableName: string,
    sessionId?: string,
    tenantId?: string
  ): Promise<{ pool: Pool; routing: RoutingDecision }> {
    // Writes always go to primary
    if (queryType === 'write') {
      const pool = await this.getPrimaryPool();
      return {
        pool,
        routing: {
          targetEndpoint: process.env.RDS_PROXY_ENDPOINT || 'primary',
          targetReplica: 'primary',
          routingReason: 'Write operation',
          consistencyMode: 'strong',
        },
      };
    }

    // Check session affinity for read-after-write consistency
    if (sessionId && this.needsPrimaryForSession(sessionId, tableName)) {
      const pool = await this.getPrimaryPool();
      return {
        pool,
        routing: {
          targetEndpoint: process.env.RDS_PROXY_ENDPOINT || 'primary',
          targetReplica: 'primary',
          routingReason: 'Read-after-write consistency (session affinity)',
          consistencyMode: 'strong',
        },
      };
    }

    // Route reads to replica
    const pool = await this.getReplicaPool();
    return {
      pool,
      routing: {
        targetEndpoint: process.env.DB_READER_ENDPOINT || 'reader',
        targetReplica: 'reader-1',
        routingReason: queryType === 'analytics' ? 'Analytics query' : 'Read query',
        consistencyMode: 'eventual',
      },
    };
  }

  /**
   * Record a write for session affinity tracking
   */
  recordSessionWrite(sessionId: string, tableName: string): void {
    if (!this.sessionWriteCache.has(sessionId)) {
      this.sessionWriteCache.set(sessionId, new Map());
    }
    this.sessionWriteCache.get(sessionId)!.set(tableName, Date.now());

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      this.cleanupSessionWriteCache();
    }
  }

  /**
   * Check if session needs primary (recent write within 5 seconds)
   */
  private needsPrimaryForSession(sessionId: string, tableName: string): boolean {
    const sessionTables = this.sessionWriteCache.get(sessionId);
    if (!sessionTables) return false;

    const lastWrite = sessionTables.get(tableName);
    if (!lastWrite) return false;

    const consistencyWindowMs = 5000; // 5 seconds
    return Date.now() - lastWrite < consistencyWindowMs;
  }

  /**
   * Cleanup old session write entries
   */
  private cleanupSessionWriteCache(): void {
    const expiryMs = 60000; // 1 minute
    const now = Date.now();

    for (const [sessionId, tables] of this.sessionWriteCache.entries()) {
      for (const [tableName, timestamp] of tables.entries()) {
        if (now - timestamp > expiryMs) {
          tables.delete(tableName);
        }
      }
      if (tables.size === 0) {
        this.sessionWriteCache.delete(sessionId);
      }
    }
  }

  /**
   * Execute query with automatic slow query logging
   */
  async executeWithMetrics<T>(
    pool: Pool,
    query: string,
    params: unknown[],
    tenantId?: string
  ): Promise<{ result: T; metrics: QueryMetrics }> {
    const startTime = Date.now();
    const client = await pool.connect();

    try {
      // Set tenant context for RLS
      if (tenantId) {
        await client.query(`SET app.current_tenant_id = '${tenantId}'`);
      }

      const result = await client.query(query, params);
      const durationMs = Date.now() - startTime;

      const metrics: QueryMetrics = {
        queryHash: this.hashQuery(query),
        durationMs,
        rowsReturned: result.rowCount || 0,
        tenantId,
      };

      // Log slow queries
      if (durationMs >= this.SLOW_QUERY_THRESHOLD_MS) {
        await this.logSlowQuery(client, query, metrics);
      }

      return { result: result.rows as T, metrics };
    } finally {
      client.release();
    }
  }

  /**
   * Hash query for deduplication
   */
  private hashQuery(query: string): string {
    const normalized = query.replace(/\s+/g, ' ').trim();
    // Simple hash - in production, use crypto.createHash('md5')
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Log slow query to database
   */
  private async logSlowQuery(client: PoolClient, query: string, metrics: QueryMetrics): Promise<void> {
    try {
      await client.query(
        `SELECT log_slow_query($1, $2, $3, $4, $5, $6)`,
        [
          query.substring(0, 10000),
          metrics.durationMs,
          metrics.rowsExamined || null,
          metrics.rowsReturned || null,
          metrics.tenantId || null,
          metrics.executionPlan || null,
        ]
      );
    } catch (error) {
      console.error('Failed to log slow query:', error);
    }
  }

  /**
   * Refresh materialized views
   */
  async refreshMaterializedViews(priority: 'high' | 'all' = 'high'): Promise<MaterializedViewRefreshResult[]> {
    const pool = await this.getPrimaryPool();
    const client = await pool.connect();

    try {
      const functionName = priority === 'high' 
        ? 'refresh_priority_materialized_views'
        : 'refresh_all_materialized_views';

      const result = await client.query(`SELECT * FROM ${functionName}()`);

      return result.rows.map(row => ({
        viewName: row.view_name,
        status: row.refresh_status.startsWith('error') ? 'error' : 'success',
        durationMs: Number(row.duration_ms),
        errorMessage: row.refresh_status.startsWith('error') ? row.refresh_status : undefined,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Ensure future partitions exist
   */
  async ensureFuturePartitions(monthsAhead: number = 3): Promise<string[]> {
    const pool = await this.getPrimaryPool();
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM ensure_future_partitions($1)`,
        [monthsAhead]
      );

      return result.rows.map(row => `${row.partition_name}: ${row.status}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get partition statistics
   */
  async getPartitionStats(tableName: string): Promise<PartitionStats[]> {
    const pool = await this.getReplicaPool();
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM get_partition_stats($1)`,
        [tableName]
      );

      return result.rows.map(row => ({
        partitionName: row.partition_name,
        rowCount: Number(row.row_count || 0),
        totalSize: row.total_size,
        indexSize: row.index_size,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get table statistics
   */
  async getTableStatistics(): Promise<TableStats[]> {
    const pool = await this.getReplicaPool();
    const client = await pool.connect();

    try {
      const result = await client.query(`SELECT * FROM get_table_statistics()`);

      return result.rows.map(row => ({
        tableName: row.table_name,
        rowCount: Number(row.row_count || 0),
        totalSize: row.total_size,
        indexSize: row.index_size,
        rowsInserted: Number(row.rows_inserted || 0),
        rowsUpdated: Number(row.rows_updated || 0),
        rowsDeleted: Number(row.rows_deleted || 0),
        lastVacuum: row.last_vacuum ? new Date(row.last_vacuum) : undefined,
        lastAnalyze: row.last_analyze ? new Date(row.last_analyze) : undefined,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Analyze index health
   */
  async analyzeIndexHealth(): Promise<Array<{
    indexName: string;
    tableName: string;
    indexSize: string;
    indexScans: number;
    usageRatio: number;
    recommendation: string;
  }>> {
    const pool = await this.getReplicaPool();
    const client = await pool.connect();

    try {
      const result = await client.query(`SELECT * FROM analyze_index_health()`);

      return result.rows.map(row => ({
        indexName: row.index_name,
        tableName: row.table_name,
        indexSize: row.index_size,
        indexScans: Number(row.index_scans || 0),
        usageRatio: Number(row.usage_ratio || 0),
        recommendation: row.recommendation,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Run scheduled maintenance
   */
  async runScheduledMaintenance(): Promise<Array<{
    operation: string;
    tableName: string;
    status: string;
    durationMs: number;
  }>> {
    const pool = await this.getPrimaryPool();
    const client = await pool.connect();

    try {
      const result = await client.query(`SELECT * FROM perform_scheduled_maintenance()`);

      return result.rows.map(row => ({
        operation: row.operation,
        tableName: row.table_name,
        status: row.status,
        durationMs: Number(row.duration_ms || 0),
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get replica health status
   */
  async getReplicaHealth(): Promise<ReplicaInfo[]> {
    const pool = await this.getPrimaryPool();
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT replica_name, endpoint, is_primary, is_healthy, last_lag_ms, weight
         FROM read_replica_config ORDER BY is_primary DESC, replica_name`
      );

      return result.rows.map(row => ({
        replicaName: row.replica_name,
        endpoint: row.endpoint,
        isPrimary: row.is_primary,
        isHealthy: row.is_healthy,
        lagMs: row.last_lag_ms,
        weight: row.weight,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Graceful shutdown - close all pools
   */
  async shutdown(): Promise<void> {
    if (this.primaryPool) {
      await this.primaryPool.end();
      this.primaryPool = null;
    }

    for (const [name, pool] of this.replicaPools.entries()) {
      await pool.end();
      this.replicaPools.delete(name);
    }

    console.log('PostgreSQL scaling service shut down');
  }
}

// Singleton instance
export const postgresqlScalingService = new PostgreSQLScalingService();

// Graceful shutdown on Lambda freeze
process.on('beforeExit', async () => {
  await postgresqlScalingService.shutdown();
});
