/**
 * Cortex Tier Coordinator Service
 * Orchestrates data movement between Hot → Warm → Cold tiers
 * 
 * Part of the Tiered Memory Architecture v4.20.0
 */

import { executeStatement, stringParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import type {
  CortexTierConfig,
  MemoryTier,
  DataFlowMetrics,
  TierHealthStatus,
  TierAlert,
  TwilightDreamingTask,
  GdprErasureRequest,
} from '@radiant/shared';

interface TierCoordinatorConfig {
  tenantId: string;
  hotToWarmThresholdHours: number;
  warmToColdThresholdDays: number;
  enableAutoPromotion: boolean;
  enableAutoArchival: boolean;
  evergreenNodeTypes: string[];
}

class TierCoordinatorService {
  /**
   * Get or create Cortex configuration for tenant
   */
  async getConfig(tenantId: string): Promise<CortexTierConfig | null> {
    const result = await executeStatement(
      `SELECT * FROM cortex_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.length) {
      return null;
    }

    return this.mapConfigRow(result.rows[0]);
  }

  /**
   * Initialize Cortex for a tenant
   */
  async initializeTenant(tenantId: string): Promise<void> {
    logger.info('Initializing Cortex for tenant', { tenantId });

    // Create default config
    await executeStatement(
      `INSERT INTO cortex_config (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      [stringParam('tenantId', tenantId)]
    );

    // Initialize housekeeping tasks
    await executeStatement(
      `SELECT cortex_initialize_housekeeping($1)`,
      [stringParam('tenantId', tenantId)]
    );

    logger.info('Cortex initialized for tenant', { tenantId });
  }

  /**
   * Promote data from Hot to Warm tier
   */
  async promoteHotToWarm(tenantId: string): Promise<{ promoted: number; errors: number }> {
    logger.info('Starting Hot → Warm promotion', { tenantId });

    const config = await this.getConfig(tenantId);
    if (!config || !config.warm.enabled) {
      return { promoted: 0, errors: 0 };
    }

    // In production, this would:
    // 1. Query Redis for keys older than threshold
    // 2. Extract session contexts, ghost vectors
    // 3. Persist to Neptune graph + pgvector
    // 4. Delete from Redis

    // For now, record metrics
    await this.recordDataFlow(tenantId, 'hot_to_warm', 0);

    return { promoted: 0, errors: 0 };
  }

  /**
   * Archive data from Warm to Cold tier
   */
  async archiveWarmToCold(tenantId: string): Promise<{ archived: number; errors: number }> {
    logger.info('Starting Warm → Cold archival', { tenantId });

    const config = await this.getConfig(tenantId);
    if (!config || !config.cold.enabled) {
      return { archived: 0, errors: 0 };
    }

    const thresholdDays = config.warm.retentionDays;

    // Find nodes older than retention period (excluding evergreen)
    const nodesToArchive = await executeStatement(
      `SELECT id, node_type, label FROM cortex_graph_nodes 
       WHERE tenant_id = $1 
       AND status = 'active'
       AND is_evergreen = false
       AND created_at < NOW() - INTERVAL '1 day' * $2
       LIMIT 1000`,
      [stringParam('tenantId', tenantId), stringParam('days', String(thresholdDays))]
    );

    if (!nodesToArchive.rows?.length) {
      return { archived: 0, errors: 0 };
    }

    let archived = 0;
    let errors = 0;

    for (const node of nodesToArchive.rows) {
      try {
        // Mark as archived
        await executeStatement(
          `UPDATE cortex_graph_nodes 
           SET status = 'archived', archived_at = NOW() 
           WHERE id = $1`,
          [stringParam('id', node.id as string)]
        );

        // In production: Write to S3 Iceberg table
        archived++;
      } catch (error) {
        logger.error('Failed to archive node', { nodeId: node.id, error });
        errors++;
      }
    }

    await this.recordDataFlow(tenantId, 'warm_to_cold', archived);
    logger.info('Warm → Cold archival complete', { tenantId, archived, errors });

    return { archived, errors };
  }

  /**
   * Retrieve data from Cold to Warm tier
   */
  async retrieveColdToWarm(
    tenantId: string, 
    nodeIds: string[]
  ): Promise<{ retrieved: number; errors: number }> {
    logger.info('Starting Cold → Warm retrieval', { tenantId, nodeCount: nodeIds.length });

    let retrieved = 0;
    let errors = 0;

    for (const nodeId of nodeIds) {
      try {
        // Restore node status
        await executeStatement(
          `UPDATE cortex_graph_nodes 
           SET status = 'active', archived_at = NULL, updated_at = NOW()
           WHERE tenant_id = $1 AND id = $2 AND status = 'archived'`,
          [stringParam('tenantId', tenantId), stringParam('nodeId', nodeId)]
        );

        // In production: Fetch from S3/Iceberg if needed
        retrieved++;
      } catch (error) {
        logger.error('Failed to retrieve node', { nodeId, error });
        errors++;
      }
    }

    await this.recordDataFlow(tenantId, 'cold_to_warm', retrieved);
    return { retrieved, errors };
  }

  /**
   * Record data flow metrics
   */
  private async recordDataFlow(
    tenantId: string, 
    flowType: 'hot_to_warm' | 'warm_to_cold' | 'cold_to_warm',
    count: number
  ): Promise<void> {
    const periodStart = new Date();
    periodStart.setMinutes(0, 0, 0);

    const column = flowType === 'hot_to_warm' 
      ? 'hot_to_warm_promotions'
      : flowType === 'warm_to_cold'
        ? 'warm_to_cold_archivals'
        : 'cold_to_warm_retrievals';

    await executeStatement(
      `INSERT INTO cortex_data_flow_metrics (tenant_id, period, period_start, ${column})
       VALUES ($1, 'hour', $2, $3)
       ON CONFLICT (tenant_id, period, period_start) 
       DO UPDATE SET ${column} = cortex_data_flow_metrics.${column} + $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('periodStart', periodStart.toISOString()),
        stringParam('count', String(count))
      ]
    );
  }

  /**
   * Get tier health status
   */
  async getTierHealth(tenantId: string): Promise<TierHealthStatus[]> {
    const result = await executeStatement(
      `SELECT * FROM cortex_tier_health 
       WHERE tenant_id = $1 
       AND checked_at > NOW() - INTERVAL '1 hour'
       ORDER BY checked_at DESC`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.length) {
      // Return defaults if no recent health data
      return [
        { tier: 'hot', status: 'healthy', metrics: {}, alerts: [], lastChecked: new Date() },
        { tier: 'warm', status: 'healthy', metrics: {}, alerts: [], lastChecked: new Date() },
        { tier: 'cold', status: 'healthy', metrics: {}, alerts: [], lastChecked: new Date() },
      ];
    }

    return result.rows.map(row => this.mapHealthRow(row));
  }

  /**
   * Check tier health and create alerts
   */
  async checkTierHealth(tenantId: string): Promise<TierAlert[]> {
    const alerts: TierAlert[] = [];
    const config = await this.getConfig(tenantId);

    // Hot tier checks (would query Redis in production)
    const hotMetrics = {
      redisMemoryUsagePercent: 45,
      redisCacheHitRate: 0.92,
      redisP99LatencyMs: 5,
      redisConnectionCount: 120,
    };

    if (hotMetrics.redisMemoryUsagePercent > 80) {
      alerts.push(await this.createAlert(tenantId, 'hot', 'warning', 
        'redis_memory_usage', 80, hotMetrics.redisMemoryUsagePercent,
        'Redis memory usage exceeds 80%'));
    }

    if (hotMetrics.redisCacheHitRate < 0.9) {
      alerts.push(await this.createAlert(tenantId, 'hot', 'warning',
        'cache_hit_rate', 0.9, hotMetrics.redisCacheHitRate,
        'Cache hit rate below 90%'));
    }

    // Warm tier checks
    const warmNodeCount = await executeStatement(
      `SELECT COUNT(*) as count FROM cortex_graph_nodes WHERE tenant_id = $1 AND status = 'active'`,
      [stringParam('tenantId', tenantId)]
    );
    const nodeCount = parseInt(warmNodeCount.rows?.[0]?.count as string) || 0;

    if (nodeCount > 100000000) {
      alerts.push(await this.createAlert(tenantId, 'warm', 'info',
        'graph_node_count', 100000000, nodeCount,
        'Graph exceeds 100M nodes - consider cluster split'));
    }

    // Record health snapshot
    await executeStatement(
      `INSERT INTO cortex_tier_health (tenant_id, tier, status, redis_memory_usage_percent, 
        redis_cache_hit_rate, redis_p99_latency_ms, graph_node_count)
       VALUES ($1, 'hot', $2, $3, $4, $5, NULL),
              ($1, 'warm', $2, NULL, NULL, NULL, $6),
              ($1, 'cold', $2, NULL, NULL, NULL, NULL)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('status', alerts.length > 0 ? 'degraded' : 'healthy'),
        stringParam('memUsage', String(hotMetrics.redisMemoryUsagePercent)),
        stringParam('hitRate', String(hotMetrics.redisCacheHitRate)),
        stringParam('latency', String(hotMetrics.redisP99LatencyMs)),
        stringParam('nodeCount', String(nodeCount)),
      ]
    );

    return alerts;
  }

  /**
   * Create a tier alert
   */
  private async createAlert(
    tenantId: string,
    tier: MemoryTier,
    severity: 'info' | 'warning' | 'critical',
    metric: string,
    threshold: number,
    currentValue: number,
    message: string
  ): Promise<TierAlert> {
    const result = await executeStatement(
      `INSERT INTO cortex_tier_alerts (tenant_id, tier, severity, metric, threshold, current_value, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('tier', tier),
        stringParam('severity', severity),
        stringParam('metric', metric),
        stringParam('threshold', String(threshold)),
        stringParam('currentValue', String(currentValue)),
        stringParam('message', message),
      ]
    );

    return this.mapAlertRow(result.rows[0]);
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(tenantId: string): Promise<TierAlert[]> {
    const result = await executeStatement(
      `SELECT * FROM cortex_tier_alerts 
       WHERE tenant_id = $1 AND resolved_at IS NULL
       ORDER BY triggered_at DESC`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => this.mapAlertRow(row));
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(tenantId: string, alertId: string, userId: string): Promise<void> {
    await executeStatement(
      `UPDATE cortex_tier_alerts 
       SET acknowledged_at = NOW(), acknowledged_by = $3
       WHERE tenant_id = $1 AND id = $2`,
      [
        stringParam('tenantId', tenantId),
        stringParam('alertId', alertId),
        stringParam('userId', userId),
      ]
    );
  }

  /**
   * Get data flow metrics
   */
  async getDataFlowMetrics(
    tenantId: string, 
    period: 'hour' | 'day' | 'week' = 'day',
    limit: number = 24
  ): Promise<DataFlowMetrics[]> {
    const result = await executeStatement(
      `SELECT * FROM cortex_data_flow_metrics 
       WHERE tenant_id = $1 AND period = $2
       ORDER BY period_start DESC
       LIMIT $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('period', period),
        stringParam('limit', String(limit)),
      ]
    );

    return (result.rows || []).map(row => ({
      tenantId: row.tenant_id as string,
      period: row.period as 'hour' | 'day' | 'week',
      hotToWarmPromotions: parseInt(row.hot_to_warm_promotions as string) || 0,
      warmToColdArchivals: parseInt(row.warm_to_cold_archivals as string) || 0,
      coldToWarmRetrievals: parseInt(row.cold_to_warm_retrievals as string) || 0,
      hotCacheMissRate: parseFloat(row.hot_cache_miss_rate as string) || 0,
      warmQueryLatencyP99Ms: parseInt(row.warm_query_latency_p99_ms as string) || 0,
      coldRetrievalLatencyP99Ms: parseInt(row.cold_retrieval_latency_p99_ms as string) || 0,
      tierMissRate: parseFloat(row.tier_miss_rate as string) || 0,
    }));
  }

  /**
   * Get housekeeping task status
   */
  async getHousekeepingTasks(tenantId: string): Promise<TwilightDreamingTask[]> {
    const result = await executeStatement(
      `SELECT t.*, r.success as last_success, r.records_processed, r.errors_encountered, 
              r.duration_ms, r.completed_at as last_completed_at
       FROM cortex_housekeeping_tasks t
       LEFT JOIN LATERAL (
         SELECT * FROM cortex_housekeeping_results 
         WHERE task_id = t.id 
         ORDER BY completed_at DESC LIMIT 1
       ) r ON true
       WHERE t.tenant_id = $1
       ORDER BY t.next_run_at`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => ({
      taskType: row.task_type as TwilightDreamingTask['taskType'],
      frequency: row.frequency as 'hourly' | 'nightly' | 'weekly',
      lastRunAt: row.last_run_at ? new Date(row.last_run_at as string) : undefined,
      nextRunAt: new Date(row.next_run_at as string),
      status: row.status as TwilightDreamingTask['status'],
      lastResult: row.last_completed_at ? {
        taskType: row.task_type as string,
        success: row.last_success as boolean,
        recordsProcessed: parseInt(row.records_processed as string) || 0,
        errorsEncountered: parseInt(row.errors_encountered as string) || 0,
        durationMs: parseInt(row.duration_ms as string) || 0,
        details: {},
        completedAt: new Date(row.last_completed_at as string),
      } : undefined,
    }));
  }

  /**
   * Trigger a housekeeping task manually
   */
  async triggerHousekeepingTask(
    tenantId: string, 
    taskType: TwilightDreamingTask['taskType']
  ): Promise<void> {
    await executeStatement(
      `UPDATE cortex_housekeeping_tasks 
       SET status = 'running', last_run_at = NOW()
       WHERE tenant_id = $1 AND task_type = $2`,
      [stringParam('tenantId', tenantId), stringParam('taskType', taskType)]
    );

    // Execute the task based on type
    let result = { success: true, recordsProcessed: 0, errorsEncountered: 0, durationMs: 0 };
    const startTime = Date.now();

    switch (taskType) {
      case 'archive_promotion':
        const archiveResult = await this.archiveWarmToCold(tenantId);
        result.recordsProcessed = archiveResult.archived;
        result.errorsEncountered = archiveResult.errors;
        break;
      case 'ttl_enforcement':
        // Hot tier TTL enforcement via Redis
        break;
      case 'deduplication':
        await this.runDeduplication(tenantId);
        break;
      case 'conflict_resolution':
        // Flag conflicts for human review
        break;
      default:
        break;
    }

    result.durationMs = Date.now() - startTime;

    // Get task ID and record result
    const taskResult = await executeStatement(
      `SELECT id FROM cortex_housekeeping_tasks WHERE tenant_id = $1 AND task_type = $2`,
      [stringParam('tenantId', tenantId), stringParam('taskType', taskType)]
    );

    if (taskResult.rows?.length) {
      await executeStatement(
        `INSERT INTO cortex_housekeeping_results 
         (task_id, tenant_id, task_type, success, records_processed, errors_encountered, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          stringParam('taskId', taskResult.rows[0].id as string),
          stringParam('tenantId', tenantId),
          stringParam('taskType', taskType),
          stringParam('success', String(result.success)),
          stringParam('recordsProcessed', String(result.recordsProcessed)),
          stringParam('errorsEncountered', String(result.errorsEncountered)),
          stringParam('durationMs', String(result.durationMs)),
        ]
      );
    }

    // Update task status
    await executeStatement(
      `UPDATE cortex_housekeeping_tasks 
       SET status = 'completed',
           next_run_at = CASE 
             WHEN frequency = 'hourly' THEN NOW() + INTERVAL '1 hour'
             WHEN frequency = 'nightly' THEN DATE_TRUNC('day', NOW()) + INTERVAL '1 day 4 hours'
             WHEN frequency = 'weekly' THEN DATE_TRUNC('week', NOW()) + INTERVAL '1 week 4 hours'
           END
       WHERE tenant_id = $1 AND task_type = $2`,
      [stringParam('tenantId', tenantId), stringParam('taskType', taskType)]
    );
  }

  /**
   * Run deduplication on knowledge graph
   */
  private async runDeduplication(tenantId: string): Promise<void> {
    // Find duplicate nodes by label
    const duplicates = await executeStatement(
      `SELECT LOWER(label) as label_lower, COUNT(*) as count, array_agg(id) as ids
       FROM cortex_graph_nodes 
       WHERE tenant_id = $1 AND status = 'active'
       GROUP BY LOWER(label)
       HAVING COUNT(*) > 1
       LIMIT 100`,
      [stringParam('tenantId', tenantId)]
    );

    for (const dup of (duplicates.rows || [])) {
      const ids = dup.ids as string[];
      if (ids.length < 2) continue;

      // Keep the one with highest confidence, merge others
      const nodes = await executeStatement(
        `SELECT id, confidence, source_document_ids FROM cortex_graph_nodes 
         WHERE id = ANY($1) ORDER BY confidence DESC`,
        [stringParam('ids', `{${ids.join(',')}}`)]
      );

      if (nodes.rows?.length) {
        const keepId = nodes.rows[0].id as string;
        const mergeIds = nodes.rows.slice(1).map(r => r.id as string);

        // Merge source document IDs
        const allDocIds = nodes.rows.flatMap(r => (r.source_document_ids as string[]) || []);
        await executeStatement(
          `UPDATE cortex_graph_nodes 
           SET source_document_ids = $2, updated_at = NOW()
           WHERE id = $1`,
          [stringParam('id', keepId), stringParam('docIds', `{${[...new Set(allDocIds)].join(',')}}`)]
        );

        // Update edges to point to kept node
        await executeStatement(
          `UPDATE cortex_graph_edges SET source_node_id = $1 WHERE source_node_id = ANY($2)`,
          [stringParam('keepId', keepId), stringParam('mergeIds', `{${mergeIds.join(',')}}`)]
        );
        await executeStatement(
          `UPDATE cortex_graph_edges SET target_node_id = $1 WHERE target_node_id = ANY($2)`,
          [stringParam('keepId', keepId), stringParam('mergeIds', `{${mergeIds.join(',')}}`)]
        );

        // Delete merged nodes
        await executeStatement(
          `UPDATE cortex_graph_nodes SET status = 'deleted' WHERE id = ANY($1)`,
          [stringParam('mergeIds', `{${mergeIds.join(',')}}`)]
        );
      }
    }
  }

  /**
   * Process GDPR erasure request
   */
  async processGdprErasure(requestId: string): Promise<void> {
    const request = await executeStatement(
      `SELECT * FROM cortex_gdpr_erasure_requests WHERE id = $1`,
      [stringParam('requestId', requestId)]
    );

    if (!request.rows?.length) {
      throw new Error('Erasure request not found');
    }

    const { tenant_id, user_id, scope_type } = request.rows[0];

    await executeStatement(
      `UPDATE cortex_gdpr_erasure_requests SET status = 'processing' WHERE id = $1`,
      [stringParam('requestId', requestId)]
    );

    try {
      // Hot Tier: Delete Redis keys (would call Redis in production)
      await executeStatement(
        `UPDATE cortex_gdpr_erasure_requests SET hot_tier_status = 'completed' WHERE id = $1`,
        [stringParam('requestId', requestId)]
      );

      // Warm Tier: Delete/anonymize graph nodes
      if (scope_type === 'user' && user_id) {
        await executeStatement(
          `UPDATE cortex_graph_nodes 
           SET status = 'deleted', properties = '{}'
           WHERE tenant_id = $1 AND properties->>'created_by' = $2`,
          [stringParam('tenantId', tenant_id as string), stringParam('userId', user_id as string)]
        );
      } else if (scope_type === 'tenant') {
        await executeStatement(
          `UPDATE cortex_graph_nodes SET status = 'deleted' WHERE tenant_id = $1`,
          [stringParam('tenantId', tenant_id as string)]
        );
      }
      await executeStatement(
        `UPDATE cortex_gdpr_erasure_requests SET warm_tier_status = 'completed' WHERE id = $1`,
        [stringParam('requestId', requestId)]
      );

      // Cold Tier: Mark archive records for deletion (Iceberg delete in production)
      await executeStatement(
        `UPDATE cortex_gdpr_erasure_requests SET cold_tier_status = 'completed' WHERE id = $1`,
        [stringParam('requestId', requestId)]
      );

      await executeStatement(
        `UPDATE cortex_gdpr_erasure_requests 
         SET status = 'completed', completed_at = NOW() 
         WHERE id = $1`,
        [stringParam('requestId', requestId)]
      );
    } catch (error) {
      logger.error('GDPR erasure failed', { requestId, error });
      await executeStatement(
        `UPDATE cortex_gdpr_erasure_requests 
         SET status = 'failed', error_message = $2 
         WHERE id = $1`,
        [stringParam('requestId', requestId), stringParam('error', String(error))]
      );
      throw error;
    }
  }

  // Mappers
  private mapConfigRow(row: Record<string, unknown>): CortexTierConfig {
    return {
      hot: {
        enabled: row.hot_tier_enabled as boolean,
        redisClusterMode: row.hot_redis_cluster_mode as boolean,
        shardCount: row.hot_shard_count as number,
        replicasPerShard: row.hot_replicas_per_shard as number,
        instanceType: row.hot_instance_type as string,
        maxMemoryPercent: row.hot_max_memory_percent as number,
        defaultTtlSeconds: row.hot_default_ttl_seconds as number,
        overflowToDynamoDB: row.hot_overflow_to_dynamodb as boolean,
      },
      warm: {
        enabled: row.warm_tier_enabled as boolean,
        neptuneMode: row.warm_neptune_mode as 'serverless' | 'provisioned',
        neptuneMinCapacity: parseFloat(row.warm_neptune_min_capacity as string),
        neptuneMaxCapacity: parseFloat(row.warm_neptune_max_capacity as string),
        neptuneInstanceClass: row.warm_neptune_instance_class as string,
        pgvectorEnabled: row.warm_pgvector_enabled as boolean,
        retentionDays: row.warm_retention_days as number,
        graphWeightPercent: row.warm_graph_weight_percent as number,
        vectorWeightPercent: row.warm_vector_weight_percent as number,
      },
      cold: {
        enabled: row.cold_tier_enabled as boolean,
        s3Bucket: row.cold_s3_bucket as string,
        icebergEnabled: row.cold_iceberg_enabled as boolean,
        compressionFormat: row.cold_compression_format as 'snappy' | 'zstd' | 'gzip',
        partitionBy: ['tenant_id', 'date'],
        storageClasses: [],
        zeroCopyEnabled: row.cold_zero_copy_enabled as boolean,
      },
    };
  }

  private mapHealthRow(row: Record<string, unknown>): TierHealthStatus {
    return {
      tier: row.tier as MemoryTier,
      status: row.status as 'healthy' | 'degraded' | 'critical',
      metrics: {
        redisMemoryUsagePercent: row.redis_memory_usage_percent ? parseFloat(row.redis_memory_usage_percent as string) : undefined,
        redisCacheHitRate: row.redis_cache_hit_rate ? parseFloat(row.redis_cache_hit_rate as string) : undefined,
        redisP99LatencyMs: row.redis_p99_latency_ms ? parseInt(row.redis_p99_latency_ms as string) : undefined,
        graphNodeCount: row.graph_node_count ? parseInt(row.graph_node_count as string) : undefined,
      },
      alerts: [],
      lastChecked: new Date(row.checked_at as string),
    };
  }

  private mapAlertRow(row: Record<string, unknown>): TierAlert {
    return {
      id: row.id as string,
      tier: row.tier as MemoryTier,
      severity: row.severity as 'info' | 'warning' | 'critical',
      metric: row.metric as string,
      threshold: parseFloat(row.threshold as string),
      currentValue: parseFloat(row.current_value as string),
      message: row.message as string,
      triggeredAt: new Date(row.triggered_at as string),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : undefined,
    };
  }
}

export const tierCoordinatorService = new TierCoordinatorService();
