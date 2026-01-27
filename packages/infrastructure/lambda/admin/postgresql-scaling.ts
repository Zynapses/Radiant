/**
 * PostgreSQL Scaling Admin API
 * 
 * Provides visibility into:
 * - Connection pool metrics
 * - Queue status (batch writer)
 * - Replica health
 * - Partition statistics
 * - Slow query analysis
 * - Index health
 * - Materialized view refresh status
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { Logger } from '../shared/logger';

const logger = new Logger({ handler: 'postgresql-scaling' });

// Response helper
function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

// ============================================================================
// Dashboard Overview
// ============================================================================

/**
 * GET /admin/scaling/dashboard
 * Get complete PostgreSQL scaling dashboard data
 */
export const getDashboard: APIGatewayProxyHandler = async () => {
  try {
    const [
      connectionMetrics,
      queueStatus,
      replicaHealth,
      partitionStats,
      slowQuerySummary,
      mvRefreshStatus,
    ] = await Promise.all([
      getConnectionMetricsInternal(),
      getQueueStatusInternal(),
      getReplicaHealthInternal(),
      getPartitionStatsInternal(),
      getSlowQuerySummaryInternal(),
      getMaterializedViewStatusInternal(),
    ]);

    return response(200, {
      success: true,
      data: {
        connectionMetrics,
        queueStatus,
        replicaHealth,
        partitionStats,
        slowQuerySummary,
        mvRefreshStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching scaling dashboard', error as Error);
    return response(500, { success: false, error: 'Failed to fetch dashboard data' });
  }
};

// ============================================================================
// Connection Pool Metrics
// ============================================================================

async function getConnectionMetricsInternal() {
  const result = await executeStatement(
    `SELECT 
       timestamp,
       proxy_endpoint,
       active_connections,
       idle_connections,
       waiting_requests,
       max_connections,
       connection_acquisition_time_ms,
       query_latency_p50_ms,
       query_latency_p95_ms,
       query_latency_p99_ms,
       errors_count
     FROM connection_pool_metrics
     ORDER BY timestamp DESC
     LIMIT 100`,
    []
  );

  const rows = result.rows || [];
  
  // Calculate aggregates
  const latest = rows[0] || {};
  const avgAcquisitionTime = rows.length > 0
    ? rows.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.connection_acquisition_time_ms || 0), 0) / rows.length
    : 0;

  return {
    current: {
      activeConnections: Number(latest.active_connections || 0),
      idleConnections: Number(latest.idle_connections || 0),
      waitingRequests: Number(latest.waiting_requests || 0),
      maxConnections: Number(latest.max_connections || 100),
      utilizationPercent: latest.max_connections 
        ? Math.round((Number(latest.active_connections || 0) / Number(latest.max_connections)) * 100)
        : 0,
    },
    latency: {
      acquisitionTimeMs: Number(latest.connection_acquisition_time_ms || 0),
      p50Ms: Number(latest.query_latency_p50_ms || 0),
      p95Ms: Number(latest.query_latency_p95_ms || 0),
      p99Ms: Number(latest.query_latency_p99_ms || 0),
    },
    history: rows.slice(0, 24).map((r: Record<string, unknown>) => ({
      timestamp: r.timestamp,
      active: Number(r.active_connections || 0),
      idle: Number(r.idle_connections || 0),
      waiting: Number(r.waiting_requests || 0),
    })),
    avgAcquisitionTimeMs: Math.round(avgAcquisitionTime * 100) / 100,
    totalErrors: rows.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.errors_count || 0), 0),
  };
}

/**
 * GET /admin/scaling/connections
 * Get connection pool metrics
 */
export const getConnectionMetrics: APIGatewayProxyHandler = async () => {
  try {
    const data = await getConnectionMetricsInternal();
    return response(200, { success: true, data });
  } catch (error) {
    logger.error('Error fetching connection metrics', error as Error);
    return response(500, { success: false, error: 'Failed to fetch connection metrics' });
  }
};

// ============================================================================
// Queue Status (Batch Writer)
// ============================================================================

async function getQueueStatusInternal() {
  const result = await executeStatement(
    `SELECT 
       status,
       target_table,
       COUNT(*) as count,
       MIN(created_at) as oldest,
       MAX(created_at) as newest,
       AVG(retry_count) as avg_retries
     FROM batch_write_staging
     GROUP BY status, target_table
     ORDER BY status, target_table`,
    []
  );

  const rows = result.rows || [];
  
  // Calculate totals
  const pending = rows.filter((r: Record<string, unknown>) => r.status === 'pending')
    .reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.count || 0), 0);
  const processing = rows.filter((r: Record<string, unknown>) => r.status === 'processing')
    .reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.count || 0), 0);
  const failed = rows.filter((r: Record<string, unknown>) => r.status === 'failed')
    .reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.count || 0), 0);
  const completed = rows.filter((r: Record<string, unknown>) => r.status === 'completed')
    .reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.count || 0), 0);

  // Get oldest pending item age
  const oldestPending = rows.find((r: Record<string, unknown>) => r.status === 'pending');
  const queueAgeSeconds = oldestPending?.oldest 
    ? Math.round((Date.now() - new Date(oldestPending.oldest as string).getTime()) / 1000)
    : 0;

  return {
    summary: {
      pending,
      processing,
      failed,
      completed,
      total: pending + processing + failed + completed,
      queueAgeSeconds,
      health: queueAgeSeconds > 60 ? 'critical' : queueAgeSeconds > 30 ? 'warning' : 'healthy',
    },
    byTable: rows.map((r: Record<string, unknown>) => ({
      status: r.status,
      table: r.target_table,
      count: Number(r.count || 0),
      oldest: r.oldest,
      newest: r.newest,
      avgRetries: Math.round(Number(r.avg_retries || 0) * 10) / 10,
    })),
  };
}

/**
 * GET /admin/scaling/queues
 * Get batch writer queue status
 */
export const getQueueStatus: APIGatewayProxyHandler = async () => {
  try {
    const data = await getQueueStatusInternal();
    return response(200, { success: true, data });
  } catch (error) {
    logger.error('Error fetching queue status', error as Error);
    return response(500, { success: false, error: 'Failed to fetch queue status' });
  }
};

/**
 * POST /admin/scaling/queues/retry-failed
 * Retry all failed batch writes
 */
export const retryFailedBatchWrites: APIGatewayProxyHandler = async () => {
  try {
    const result = await executeStatement(
      `UPDATE batch_write_staging 
       SET status = 'pending', retry_count = retry_count + 1
       WHERE status = 'failed' AND retry_count < 5
       RETURNING id`,
      []
    );

    const count = result.rows?.length || 0;
    return response(200, { 
      success: true, 
      data: { retriedCount: count },
      message: `Retried ${count} failed batch writes`,
    });
  } catch (error) {
    logger.error('Error retrying failed writes', error as Error);
    return response(500, { success: false, error: 'Failed to retry writes' });
  }
};

/**
 * DELETE /admin/scaling/queues/clear-completed
 * Clear completed batch writes older than 1 hour
 */
export const clearCompletedBatchWrites: APIGatewayProxyHandler = async () => {
  try {
    await executeStatement(`SELECT cleanup_batch_write_staging()`, []);
    return response(200, { 
      success: true, 
      message: 'Cleared completed batch writes older than 1 hour',
    });
  } catch (error) {
    logger.error('Error clearing completed writes', error as Error);
    return response(500, { success: false, error: 'Failed to clear completed writes' });
  }
};

// ============================================================================
// Replica Health
// ============================================================================

async function getReplicaHealthInternal() {
  const configResult = await executeStatement(
    `SELECT 
       replica_name,
       endpoint,
       is_primary,
       is_healthy,
       last_health_check,
       last_lag_ms,
       weight,
       query_types
     FROM read_replica_config
     ORDER BY is_primary DESC, replica_name`,
    []
  );

  const historyResult = await executeStatement(
    `SELECT 
       replica_name,
       check_time,
       is_healthy,
       replica_lag_ms,
       connections_active,
       error_message
     FROM replica_health_history
     WHERE check_time > NOW() - INTERVAL '24 hours'
     ORDER BY check_time DESC
     LIMIT 100`,
    []
  );

  const replicas = (configResult.rows || []).map((r: Record<string, unknown>) => ({
    name: r.replica_name,
    endpoint: r.endpoint,
    isPrimary: r.is_primary === true,
    isHealthy: r.is_healthy === true,
    lastHealthCheck: r.last_health_check,
    lagMs: r.last_lag_ms !== null ? Number(r.last_lag_ms) : null,
    weight: Number(r.weight || 100),
    queryTypes: r.query_types || [],
    status: r.is_healthy ? 'healthy' : 'unhealthy',
  }));

  const healthyCount = replicas.filter(r => r.isHealthy).length;
  const avgLag = replicas.filter(r => r.lagMs !== null).length > 0
    ? Math.round(replicas.filter(r => r.lagMs !== null).reduce((sum, r) => sum + (r.lagMs || 0), 0) / replicas.filter(r => r.lagMs !== null).length)
    : 0;

  return {
    summary: {
      total: replicas.length,
      healthy: healthyCount,
      unhealthy: replicas.length - healthyCount,
      avgLagMs: avgLag,
      overallHealth: healthyCount === replicas.length ? 'healthy' : healthyCount > 0 ? 'degraded' : 'critical',
    },
    replicas,
    history: (historyResult.rows || []).slice(0, 50).map((r: Record<string, unknown>) => ({
      replica: r.replica_name,
      time: r.check_time,
      healthy: r.is_healthy === true,
      lagMs: r.replica_lag_ms !== null ? Number(r.replica_lag_ms) : null,
      connections: r.connections_active !== null ? Number(r.connections_active) : null,
      error: r.error_message,
    })),
  };
}

/**
 * GET /admin/scaling/replicas
 * Get read replica health status
 */
export const getReplicaHealth: APIGatewayProxyHandler = async () => {
  try {
    const data = await getReplicaHealthInternal();
    return response(200, { success: true, data });
  } catch (error) {
    logger.error('Error fetching replica health', error as Error);
    return response(500, { success: false, error: 'Failed to fetch replica health' });
  }
};

// ============================================================================
// Partition Statistics
// ============================================================================

async function getPartitionStatsInternal() {
  const modelLogsResult = await executeStatement(
    `SELECT * FROM get_partition_stats('model_execution_logs_partitioned')`,
    []
  );

  const usageResult = await executeStatement(
    `SELECT * FROM get_partition_stats('usage_records_partitioned')`,
    []
  );

  const formatPartitions = (rows: Record<string, unknown>[]) => 
    rows.map(r => ({
      name: r.partition_name,
      rowCount: Number(r.row_count || 0),
      size: r.total_size,
      indexSize: r.index_size,
    }));

  const modelLogsPartitions = formatPartitions(modelLogsResult.rows || []);
  const usagePartitions = formatPartitions(usageResult.rows || []);

  return {
    modelExecutionLogs: {
      partitionCount: modelLogsPartitions.length,
      totalRows: modelLogsPartitions.reduce((sum, p) => sum + p.rowCount, 0),
      partitions: modelLogsPartitions,
    },
    usageRecords: {
      partitionCount: usagePartitions.length,
      totalRows: usagePartitions.reduce((sum, p) => sum + p.rowCount, 0),
      partitions: usagePartitions,
    },
  };
}

/**
 * GET /admin/scaling/partitions
 * Get partition statistics
 */
export const getPartitionStats: APIGatewayProxyHandler = async () => {
  try {
    const data = await getPartitionStatsInternal();
    return response(200, { success: true, data });
  } catch (error) {
    logger.error('Error fetching partition stats', error as Error);
    return response(500, { success: false, error: 'Failed to fetch partition stats' });
  }
};

/**
 * POST /admin/scaling/partitions/ensure-future
 * Ensure future partitions exist
 */
export const ensureFuturePartitions: APIGatewayProxyHandler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const monthsAhead = body.monthsAhead || 3;

    const result = await executeStatement(
      `SELECT * FROM ensure_future_partitions($1)`,
      [longParam('months', monthsAhead)]
    );

    return response(200, { 
      success: true, 
      data: {
        created: (result.rows || []).map((r: Record<string, unknown>) => ({
          partition: r.partition_name,
          status: r.status,
        })),
      },
    });
  } catch (error) {
    logger.error('Error ensuring future partitions', error as Error);
    return response(500, { success: false, error: 'Failed to create partitions' });
  }
};

// ============================================================================
// Slow Query Analysis
// ============================================================================

async function getSlowQuerySummaryInternal() {
  const hintsResult = await executeStatement(
    `SELECT 
       query_digest,
       query_sample,
       table_name,
       avg_duration_ms,
       max_duration_ms,
       call_count,
       rows_examined_avg,
       rows_returned_avg,
       suggested_index,
       last_seen
     FROM query_performance_hints
     ORDER BY avg_duration_ms * call_count DESC
     LIMIT 20`,
    []
  );

  const recentResult = await executeStatement(
    `SELECT 
       query_hash,
       LEFT(query_text, 200) as query_preview,
       duration_ms,
       rows_examined,
       rows_returned,
       tenant_id,
       captured_at
     FROM slow_query_log
     WHERE captured_at > NOW() - INTERVAL '24 hours'
     ORDER BY duration_ms DESC
     LIMIT 50`,
    []
  );

  const topQueries = (hintsResult.rows || []).map((r: Record<string, unknown>) => ({
    digest: r.query_digest,
    sample: r.query_sample ? String(r.query_sample).substring(0, 200) : null,
    table: r.table_name,
    avgDurationMs: Math.round(Number(r.avg_duration_ms || 0)),
    maxDurationMs: Math.round(Number(r.max_duration_ms || 0)),
    callCount: Number(r.call_count || 0),
    totalTimeMs: Math.round(Number(r.avg_duration_ms || 0) * Number(r.call_count || 0)),
    suggestedIndex: r.suggested_index,
    lastSeen: r.last_seen,
  }));

  const recentSlowQueries = (recentResult.rows || []).map((r: Record<string, unknown>) => ({
    hash: r.query_hash,
    preview: r.query_preview,
    durationMs: Math.round(Number(r.duration_ms || 0)),
    rowsExamined: r.rows_examined !== null ? Number(r.rows_examined) : null,
    rowsReturned: r.rows_returned !== null ? Number(r.rows_returned) : null,
    tenantId: r.tenant_id,
    capturedAt: r.captured_at,
  }));

  return {
    summary: {
      totalSlowQueries24h: recentSlowQueries.length,
      uniquePatterns: topQueries.length,
      avgSlowQueryDurationMs: recentSlowQueries.length > 0
        ? Math.round(recentSlowQueries.reduce((sum, q) => sum + q.durationMs, 0) / recentSlowQueries.length)
        : 0,
      queriesNeedingIndexes: topQueries.filter(q => q.suggestedIndex).length,
    },
    topQueries,
    recentSlowQueries: recentSlowQueries.slice(0, 20),
  };
}

/**
 * GET /admin/scaling/slow-queries
 * Get slow query analysis
 */
export const getSlowQueries: APIGatewayProxyHandler = async () => {
  try {
    const data = await getSlowQuerySummaryInternal();
    return response(200, { success: true, data });
  } catch (error) {
    logger.error('Error fetching slow queries', error as Error);
    return response(500, { success: false, error: 'Failed to fetch slow queries' });
  }
};

// ============================================================================
// Index Health
// ============================================================================

/**
 * GET /admin/scaling/indexes
 * Get index health analysis
 */
export const getIndexHealth: APIGatewayProxyHandler = async () => {
  try {
    const result = await executeStatement(`SELECT * FROM analyze_index_health()`, []);

    const indexes = (result.rows || []).map((r: Record<string, unknown>) => ({
      name: r.index_name,
      table: r.table_name,
      size: r.index_size,
      scans: Number(r.index_scans || 0),
      usageRatio: Number(r.usage_ratio || 0),
      recommendation: r.recommendation,
      status: String(r.recommendation).startsWith('OK') ? 'healthy' 
        : String(r.recommendation).includes('UNUSED') ? 'unused'
        : String(r.recommendation).includes('LOW') ? 'low_usage'
        : 'inefficient',
    }));

    const summary = {
      total: indexes.length,
      healthy: indexes.filter(i => i.status === 'healthy').length,
      unused: indexes.filter(i => i.status === 'unused').length,
      lowUsage: indexes.filter(i => i.status === 'low_usage').length,
      inefficient: indexes.filter(i => i.status === 'inefficient').length,
    };

    return response(200, { 
      success: true, 
      data: { summary, indexes },
    });
  } catch (error) {
    logger.error('Error fetching index health', error as Error);
    return response(500, { success: false, error: 'Failed to fetch index health' });
  }
};

/**
 * GET /admin/scaling/indexes/suggestions
 * Get index suggestions based on slow queries
 */
export const getIndexSuggestions: APIGatewayProxyHandler = async () => {
  try {
    const result = await executeStatement(`SELECT * FROM suggest_indexes()`, []);

    const suggestions = (result.rows || []).map((r: Record<string, unknown>) => ({
      table: r.table_name,
      suggestion: r.column_suggestion,
      queryCount: Number(r.query_count || 0),
      avgDurationMs: Math.round(Number(r.avg_duration_ms || 0)),
      priority: r.priority,
    }));

    return response(200, { success: true, data: { suggestions } });
  } catch (error) {
    logger.error('Error fetching index suggestions', error as Error);
    return response(500, { success: false, error: 'Failed to fetch index suggestions' });
  }
};

// ============================================================================
// Materialized View Status
// ============================================================================

async function getMaterializedViewStatusInternal() {
  const refreshLogResult = await executeStatement(
    `SELECT 
       view_name,
       refresh_status,
       duration_ms,
       refreshed_at
     FROM mv_refresh_log
     ORDER BY refreshed_at DESC
     LIMIT 50`,
    []
  );

  const viewsResult = await executeStatement(
    `SELECT 
       matviewname as name,
       pg_size_pretty(pg_relation_size(matviewname::regclass)) as size
     FROM pg_matviews
     WHERE schemaname = 'public'
     AND matviewname LIKE 'mv_%'
     ORDER BY matviewname`,
    []
  );

  const views = (viewsResult.rows || []).map((r: Record<string, unknown>) => {
    const recentRefresh = (refreshLogResult.rows || []).find(
      (log: Record<string, unknown>) => log.view_name === r.name
    );
    return {
      name: r.name,
      size: r.size,
      lastRefresh: recentRefresh?.refreshed_at || null,
      lastStatus: recentRefresh?.refresh_status || 'unknown',
      lastDurationMs: recentRefresh?.duration_ms ? Math.round(Number(recentRefresh.duration_ms)) : null,
    };
  });

  const refreshHistory = (refreshLogResult.rows || []).slice(0, 20).map((r: Record<string, unknown>) => ({
    view: r.view_name,
    status: r.refresh_status,
    durationMs: Math.round(Number(r.duration_ms || 0)),
    refreshedAt: r.refreshed_at,
  }));

  return {
    views,
    refreshHistory,
    summary: {
      totalViews: views.length,
      lastRefreshSuccess: refreshHistory.filter(r => r.status === 'success').length,
      lastRefreshFailed: refreshHistory.filter(r => r.status !== 'success').length,
    },
  };
}

/**
 * GET /admin/scaling/materialized-views
 * Get materialized view status
 */
export const getMaterializedViewStatus: APIGatewayProxyHandler = async () => {
  try {
    const data = await getMaterializedViewStatusInternal();
    return response(200, { success: true, data });
  } catch (error) {
    logger.error('Error fetching MV status', error as Error);
    return response(500, { success: false, error: 'Failed to fetch materialized view status' });
  }
};

/**
 * POST /admin/scaling/materialized-views/refresh
 * Trigger materialized view refresh
 */
export const triggerMaterializedViewRefresh: APIGatewayProxyHandler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const priority = body.priority || 'high';

    const functionName = priority === 'all' 
      ? 'refresh_all_materialized_views'
      : 'refresh_priority_materialized_views';

    const result = await executeStatement(`SELECT * FROM ${functionName}()`, []);

    const refreshResults = (result.rows || []).map((r: Record<string, unknown>) => ({
      view: r.view_name,
      status: r.refresh_status,
      durationMs: Math.round(Number(r.duration_ms || 0)),
    }));

    return response(200, { 
      success: true, 
      data: { refreshResults },
      message: `Refreshed ${refreshResults.length} materialized views`,
    });
  } catch (error) {
    logger.error('Error refreshing MVs', error as Error);
    return response(500, { success: false, error: 'Failed to refresh materialized views' });
  }
};

// ============================================================================
// Table Statistics
// ============================================================================

/**
 * GET /admin/scaling/tables
 * Get table statistics
 */
export const getTableStatistics: APIGatewayProxyHandler = async () => {
  try {
    const result = await executeStatement(`SELECT * FROM get_table_statistics()`, []);

    const tables = (result.rows || []).map((r: Record<string, unknown>) => ({
      name: r.table_name,
      rowCount: Number(r.row_count || 0),
      totalSize: r.total_size,
      indexSize: r.index_size,
      toastSize: r.toast_size,
      rowsInserted: Number(r.rows_inserted || 0),
      rowsUpdated: Number(r.rows_updated || 0),
      rowsDeleted: Number(r.rows_deleted || 0),
      lastVacuum: r.last_vacuum,
      lastAnalyze: r.last_analyze,
    }));

    return response(200, { success: true, data: { tables } });
  } catch (error) {
    logger.error('Error fetching table stats', error as Error);
    return response(500, { success: false, error: 'Failed to fetch table statistics' });
  }
};

// ============================================================================
// Maintenance Operations
// ============================================================================

/**
 * POST /admin/scaling/maintenance/run
 * Run scheduled maintenance
 */
export const runMaintenance: APIGatewayProxyHandler = async () => {
  try {
    const result = await executeStatement(`SELECT * FROM perform_scheduled_maintenance()`, []);

    const operations = (result.rows || []).map((r: Record<string, unknown>) => ({
      operation: r.operation,
      table: r.table_name,
      status: r.status,
      durationMs: Math.round(Number(r.duration_ms || 0)),
    }));

    return response(200, { 
      success: true, 
      data: { operations },
      message: `Completed ${operations.length} maintenance operations`,
    });
  } catch (error) {
    logger.error('Error running maintenance', error as Error);
    return response(500, { success: false, error: 'Failed to run maintenance' });
  }
};

/**
 * GET /admin/scaling/maintenance/history
 * Get maintenance history
 */
export const getMaintenanceHistory: APIGatewayProxyHandler = async () => {
  try {
    const result = await executeStatement(
      `SELECT 
         operation_type,
         table_name,
         partition_name,
         duration_ms,
         rows_affected,
         dead_tuples_removed,
         status,
         error_message,
         executed_at
       FROM maintenance_log
       ORDER BY executed_at DESC
       LIMIT 100`,
      []
    );

    const history = (result.rows || []).map((r: Record<string, unknown>) => ({
      operation: r.operation_type,
      table: r.table_name,
      partition: r.partition_name,
      durationMs: r.duration_ms ? Math.round(Number(r.duration_ms)) : null,
      rowsAffected: r.rows_affected !== null ? Number(r.rows_affected) : null,
      deadTuplesRemoved: r.dead_tuples_removed !== null ? Number(r.dead_tuples_removed) : null,
      status: r.status,
      error: r.error_message,
      executedAt: r.executed_at,
    }));

    return response(200, { success: true, data: { history } });
  } catch (error) {
    logger.error('Error fetching maintenance history', error as Error);
    return response(500, { success: false, error: 'Failed to fetch maintenance history' });
  }
};

// ============================================================================
// Rate Limiting Status
// ============================================================================

/**
 * GET /admin/scaling/rate-limits
 * Get rate limiting status
 */
export const getRateLimitStatus: APIGatewayProxyHandler = async () => {
  try {
    const result = await executeStatement(
      `SELECT 
         limit_key,
         limit_type,
         window_start,
         window_size_seconds,
         current_count,
         max_allowed,
         last_request
       FROM rate_limit_state
       WHERE window_start > NOW() - INTERVAL '1 hour'
       ORDER BY current_count DESC
       LIMIT 100`,
      []
    );

    const limits = (result.rows || []).map((r: Record<string, unknown>) => ({
      key: r.limit_key,
      type: r.limit_type,
      windowStart: r.window_start,
      windowSizeSeconds: Number(r.window_size_seconds || 60),
      currentCount: Number(r.current_count || 0),
      maxAllowed: Number(r.max_allowed || 100),
      utilizationPercent: Math.round((Number(r.current_count || 0) / Number(r.max_allowed || 100)) * 100),
      lastRequest: r.last_request,
    }));

    const summary = {
      activeWindows: limits.length,
      nearLimit: limits.filter(l => l.utilizationPercent >= 80).length,
      atLimit: limits.filter(l => l.utilizationPercent >= 100).length,
    };

    return response(200, { success: true, data: { summary, limits } });
  } catch (error) {
    logger.error('Error fetching rate limit status', error as Error);
    return response(500, { success: false, error: 'Failed to fetch rate limit status' });
  }
};
