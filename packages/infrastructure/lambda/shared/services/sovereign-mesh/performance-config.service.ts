/**
 * RADIANT v5.38.0 - Sovereign Mesh Performance Configuration Service
 * 
 * Manages performance configuration for the Sovereign Mesh infrastructure.
 * Provides CRUD operations, validation, and configuration application.
 */

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../../db/client';
import { enhancedLogger } from '../../logging/enhanced-logger';
import { redisCacheService } from './redis-cache.service';
import { sqsDispatcherService } from './sqs-dispatcher.service';
import type {
  SovereignMeshPerformanceConfig,
  UpdatePerformanceConfigRequest,
  PerformanceConfigResponse,
  ApplyConfigResponse,
  PerformanceRecommendation,
  PerformanceRecommendationsResponse,
  PerformanceDashboard,
  PerformanceAlert,
  OODAPhaseMetrics,
  ExecutionThroughputMetrics,
  QueueMetrics,
  CacheMetrics,
  getDefaultPerformanceConfig,
} from '@radiant/shared';

const logger = enhancedLogger;

// ============================================================================
// PERFORMANCE CONFIGURATION SERVICE
// ============================================================================

class PerformanceConfigService {
  /**
   * Get performance configuration for a tenant
   */
  async getConfig(tenantId: string): Promise<SovereignMeshPerformanceConfig | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM sovereign_mesh_performance_config WHERE tenant_id = :tenantId`,
        [stringParam('tenantId', tenantId)]
      );

      if (!result.rows?.[0]) {
        return null;
      }

      return this.rowToConfig(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get performance config', { tenantId, error });
      return null;
    }
  }

  /**
   * Get or create configuration with defaults
   */
  async getOrCreateConfig(tenantId: string): Promise<SovereignMeshPerformanceConfig> {
    const existing = await this.getConfig(tenantId);
    if (existing) {
      return existing;
    }

    // Create with defaults
    return this.createConfig(tenantId);
  }

  /**
   * Create new configuration with defaults
   */
  async createConfig(tenantId: string, createdBy?: string): Promise<SovereignMeshPerformanceConfig> {
    try {
      const result = await executeStatement(
        `INSERT INTO sovereign_mesh_performance_config (tenant_id, created_by)
         VALUES (:tenantId, :createdBy)
         RETURNING *`,
        [
          stringParam('tenantId', tenantId),
          stringParam('createdBy', createdBy || ''),
        ]
      );

      if (!result.rows?.[0]) {
        throw new Error('Failed to create config');
      }

      logger.info('Performance config created', { tenantId });
      return this.rowToConfig(result.rows[0]);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        const existing = await this.getConfig(tenantId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  /**
   * Update performance configuration
   */
  async updateConfig(
    tenantId: string,
    updates: UpdatePerformanceConfigRequest,
    updatedBy?: string
  ): Promise<PerformanceConfigResponse> {
    try {
      // Ensure config exists
      await this.getOrCreateConfig(tenantId);

      // Build SET clauses dynamically
      const setClauses: string[] = [];
      const params: any[] = [
        stringParam('tenantId', tenantId),
      ];

      // Lambda Config - Agent Worker
      if (updates.agentWorkerConfig) {
        const awc = updates.agentWorkerConfig;
        if (awc.reservedConcurrency !== undefined) {
          setClauses.push('agent_worker_reserved_concurrency = :awReserved');
          params.push(longParam('awReserved', awc.reservedConcurrency));
        }
        if (awc.provisionedConcurrency !== undefined) {
          setClauses.push('agent_worker_provisioned_concurrency = :awProvisioned');
          params.push(longParam('awProvisioned', awc.provisionedConcurrency));
        }
        if (awc.maxConcurrency !== undefined) {
          setClauses.push('agent_worker_max_concurrency = :awMaxConcurrency');
          params.push(longParam('awMaxConcurrency', awc.maxConcurrency));
        }
        if (awc.memoryMb !== undefined) {
          setClauses.push('agent_worker_memory_mb = :awMemory');
          params.push(longParam('awMemory', awc.memoryMb));
        }
        if (awc.timeoutSeconds !== undefined) {
          setClauses.push('agent_worker_timeout_seconds = :awTimeout');
          params.push(longParam('awTimeout', awc.timeoutSeconds));
        }
      }

      // Lambda Config - Transparency Worker
      if (updates.transparencyWorkerConfig) {
        const twc = updates.transparencyWorkerConfig;
        if (twc.reservedConcurrency !== undefined) {
          setClauses.push('transparency_worker_reserved_concurrency = :twReserved');
          params.push(longParam('twReserved', twc.reservedConcurrency));
        }
        if (twc.provisionedConcurrency !== undefined) {
          setClauses.push('transparency_worker_provisioned_concurrency = :twProvisioned');
          params.push(longParam('twProvisioned', twc.provisionedConcurrency));
        }
        if (twc.maxConcurrency !== undefined) {
          setClauses.push('transparency_worker_max_concurrency = :twMaxConcurrency');
          params.push(longParam('twMaxConcurrency', twc.maxConcurrency));
        }
        if (twc.memoryMb !== undefined) {
          setClauses.push('transparency_worker_memory_mb = :twMemory');
          params.push(longParam('twMemory', twc.memoryMb));
        }
        if (twc.timeoutSeconds !== undefined) {
          setClauses.push('transparency_worker_timeout_seconds = :twTimeout');
          params.push(longParam('twTimeout', twc.timeoutSeconds));
        }
      }

      // Queue Config - Agent Execution
      if (updates.agentExecutionQueueConfig) {
        const aqc = updates.agentExecutionQueueConfig;
        if (aqc.visibilityTimeoutSeconds !== undefined) {
          setClauses.push('agent_queue_visibility_timeout_seconds = :aqVisibility');
          params.push(longParam('aqVisibility', aqc.visibilityTimeoutSeconds));
        }
        if (aqc.retentionDays !== undefined) {
          setClauses.push('agent_queue_retention_days = :aqRetention');
          params.push(longParam('aqRetention', aqc.retentionDays));
        }
        if (aqc.maxReceiveCount !== undefined) {
          setClauses.push('agent_queue_max_receive_count = :aqMaxReceive');
          params.push(longParam('aqMaxReceive', aqc.maxReceiveCount));
        }
        if (aqc.batchSize !== undefined) {
          setClauses.push('agent_queue_batch_size = :aqBatch');
          params.push(longParam('aqBatch', aqc.batchSize));
        }
        if (aqc.fifoEnabled !== undefined) {
          setClauses.push('agent_queue_fifo_enabled = :aqFifo');
          params.push(boolParam('aqFifo', aqc.fifoEnabled));
        }
      }

      // Scaling Config
      if (updates.scalingConfig) {
        const sc = updates.scalingConfig;
        if (sc.strategy !== undefined) {
          setClauses.push('scaling_strategy = :scStrategy::scaling_strategy');
          params.push(stringParam('scStrategy', sc.strategy));
        }
        if (sc.minInstances !== undefined) {
          setClauses.push('scaling_min_instances = :scMin');
          params.push(longParam('scMin', sc.minInstances));
        }
        if (sc.maxInstances !== undefined) {
          setClauses.push('scaling_max_instances = :scMax');
          params.push(longParam('scMax', sc.maxInstances));
        }
        if (sc.targetUtilization !== undefined) {
          setClauses.push('scaling_target_utilization = :scTarget');
          params.push(longParam('scTarget', sc.targetUtilization));
        }
      }

      // Tenant Isolation Config
      if (updates.tenantIsolationConfig) {
        const tic = updates.tenantIsolationConfig;
        if (tic.mode !== undefined) {
          setClauses.push('tenant_isolation_mode = :tiMode::tenant_isolation_mode');
          params.push(stringParam('tiMode', tic.mode));
        }
        if (tic.maxConcurrentPerTenant !== undefined) {
          setClauses.push('tenant_max_concurrent_per_tenant = :tiMaxTenant');
          params.push(longParam('tiMaxTenant', tic.maxConcurrentPerTenant));
        }
        if (tic.maxConcurrentPerUser !== undefined) {
          setClauses.push('tenant_max_concurrent_per_user = :tiMaxUser');
          params.push(longParam('tiMaxUser', tic.maxConcurrentPerUser));
        }
        if (tic.rateLimitingEnabled !== undefined) {
          setClauses.push('tenant_rate_limiting_enabled = :tiRateLimit');
          params.push(boolParam('tiRateLimit', tic.rateLimitingEnabled));
        }
      }

      // Alert Config
      if (updates.alertConfig) {
        const ac = updates.alertConfig;
        if (ac.dlqAlertEnabled !== undefined) {
          setClauses.push('alert_dlq_enabled = :acDlqEnabled');
          params.push(boolParam('acDlqEnabled', ac.dlqAlertEnabled));
        }
        if (ac.dlqAlertThreshold !== undefined) {
          setClauses.push('alert_dlq_threshold = :acDlqThreshold');
          params.push(longParam('acDlqThreshold', ac.dlqAlertThreshold));
        }
        if (ac.latencyAlertEnabled !== undefined) {
          setClauses.push('alert_latency_enabled = :acLatencyEnabled');
          params.push(boolParam('acLatencyEnabled', ac.latencyAlertEnabled));
        }
        if (ac.latencyAlertThresholdMs !== undefined) {
          setClauses.push('alert_latency_threshold_ms = :acLatencyThreshold');
          params.push(longParam('acLatencyThreshold', ac.latencyAlertThresholdMs));
        }
      }

      // Always update timestamp and updater
      if (updatedBy) {
        setClauses.push('updated_by = :updatedBy');
        params.push(stringParam('updatedBy', updatedBy));
      }

      if (setClauses.length === 0) {
        const config = await this.getConfig(tenantId);
        return {
          config: config!,
          effectiveConfig: config!,
          pendingChanges: [],
        };
      }

      const result = await executeStatement(
        `UPDATE sovereign_mesh_performance_config 
         SET ${setClauses.join(', ')}
         WHERE tenant_id = :tenantId
         RETURNING *`,
        params
      );

      const config = this.rowToConfig(result.rows![0]);

      // Record change in history
      await this.recordConfigChange(tenantId, config, Object.keys(updates), updatedBy);

      logger.info('Performance config updated', { tenantId, changes: Object.keys(updates) });

      return {
        config,
        effectiveConfig: config,
        pendingChanges: this.getPendingChanges(updates),
      };
    } catch (error) {
      logger.error('Failed to update performance config', { tenantId, error });
      throw error;
    }
  }

  /**
   * Get performance dashboard data
   */
  async getDashboard(tenantId: string): Promise<PerformanceDashboard> {
    const config = await this.getOrCreateConfig(tenantId);

    // Get execution metrics
    const execMetrics = await this.getExecutionMetrics(tenantId);
    
    // Get queue metrics
    const agentQueueMetrics = await sqsDispatcherService.getQueueMetrics();
    
    // Get cache metrics
    const cacheStats = redisCacheService.getStats();

    // Get OODA phase metrics
    const oodaMetrics = await this.getOODAPhaseMetrics(tenantId);

    // Get throughput metrics
    const throughputMetrics = await this.getThroughputMetrics(tenantId);

    // Get active alerts
    const alerts = await this.getActiveAlerts(tenantId);

    // Calculate health score
    const healthScore = this.calculateHealthScore({
      dlqMessages: agentQueueMetrics.approximateMessages,
      cacheHitRate: cacheStats.hitRate,
      errorRate: execMetrics.failedExecutions / Math.max(1, execMetrics.totalExecutions),
      queueBacklog: agentQueueMetrics.approximateMessages,
    });

    return {
      tenantId,
      generatedAt: new Date(),
      healthScore,
      healthStatus: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'critical',
      activeExecutions: execMetrics.activeExecutions,
      pendingExecutions: execMetrics.pendingExecutions,
      executionsLast24h: execMetrics.totalExecutions,
      avgExecutionDurationSeconds: execMetrics.avgDurationSeconds,
      agentQueueMetrics: {
        queueName: 'agent-execution',
        approximateMessages: agentQueueMetrics.approximateMessages,
        approximateMessagesNotVisible: agentQueueMetrics.approximateMessagesNotVisible,
        approximateMessagesDelayed: agentQueueMetrics.approximateMessagesDelayed,
        oldestMessageAgeSeconds: 0,
        dlqMessages: 0,
      },
      transparencyQueueMetrics: {
        queueName: 'transparency',
        approximateMessages: 0,
        approximateMessagesNotVisible: 0,
        approximateMessagesDelayed: 0,
        oldestMessageAgeSeconds: 0,
        dlqMessages: 0,
      },
      agentCacheMetrics: {
        backend: redisCacheService.isRedisConnected() ? 'redis' : 'memory',
        hitCount: cacheStats.hits,
        missCount: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        evictionCount: cacheStats.evictions,
        memoryUsageBytes: cacheStats.memoryUsedBytes,
        connectionCount: cacheStats.connectedClients,
        avgLatencyMs: cacheStats.avgLatencyMs,
      },
      executionCacheMetrics: {
        backend: redisCacheService.isRedisConnected() ? 'redis' : 'memory',
        hitCount: cacheStats.hits,
        missCount: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        evictionCount: cacheStats.evictions,
        memoryUsageBytes: cacheStats.memoryUsedBytes,
        connectionCount: cacheStats.connectedClients,
        avgLatencyMs: cacheStats.avgLatencyMs,
      },
      oodaPhaseMetrics: oodaMetrics,
      throughputMetrics,
      activeAlerts: alerts,
      estimatedMonthlyCost: this.estimateMonthlyCost(config, throughputMetrics),
      costBreakdown: {
        lambdaCost: 0,
        sqsCost: 0,
        cacheCost: 0,
        storageCost: 0,
      },
    };
  }

  /**
   * Get performance recommendations
   */
  async getRecommendations(tenantId: string): Promise<PerformanceRecommendationsResponse> {
    const config = await this.getOrCreateConfig(tenantId);
    const dashboard = await this.getDashboard(tenantId);
    const recommendations: PerformanceRecommendation[] = [];

    // Check concurrency
    if (dashboard.activeExecutions > config.agentWorkerConfig.maxConcurrency * 0.8) {
      recommendations.push({
        id: 'increase-concurrency',
        category: 'scaling',
        priority: 'high',
        title: 'Increase Lambda Concurrency',
        description: 'Active executions approaching concurrency limit. Consider increasing maxConcurrency.',
        currentValue: `${config.agentWorkerConfig.maxConcurrency}`,
        recommendedValue: `${Math.ceil(config.agentWorkerConfig.maxConcurrency * 1.5)}`,
        estimatedImpact: '50% more throughput capacity',
        autoApplyAvailable: true,
      });
    }

    // Check cache hit rate
    if (dashboard.agentCacheMetrics.hitRate < 0.8) {
      recommendations.push({
        id: 'improve-cache-hit-rate',
        category: 'caching',
        priority: 'medium',
        title: 'Improve Cache Hit Rate',
        description: `Cache hit rate (${(dashboard.agentCacheMetrics.hitRate * 100).toFixed(1)}%) is below optimal. Consider increasing cache TTL or enabling cache warming.`,
        currentValue: `${(dashboard.agentCacheMetrics.hitRate * 100).toFixed(1)}%`,
        recommendedValue: '>80%',
        estimatedImpact: 'Reduced database load, faster response times',
        autoApplyAvailable: false,
      });
    }

    // Check for DLQ messages
    if (dashboard.agentQueueMetrics.dlqMessages > 0) {
      recommendations.push({
        id: 'investigate-dlq',
        category: 'queue',
        priority: 'high',
        title: 'Investigate Dead Letter Queue',
        description: `${dashboard.agentQueueMetrics.dlqMessages} messages in DLQ indicate processing failures.`,
        currentValue: `${dashboard.agentQueueMetrics.dlqMessages} messages`,
        recommendedValue: '0 messages',
        estimatedImpact: 'Prevent lost executions',
        autoApplyAvailable: false,
      });
    }

    // Check memory configuration
    if (config.agentWorkerConfig.memoryMb < 2048 && dashboard.avgExecutionDurationSeconds > 60) {
      recommendations.push({
        id: 'increase-memory',
        category: 'scaling',
        priority: 'medium',
        title: 'Increase Lambda Memory',
        description: 'Long execution times may benefit from increased memory allocation.',
        currentValue: `${config.agentWorkerConfig.memoryMb} MB`,
        recommendedValue: '2048 MB',
        estimatedImpact: '20-40% faster executions',
        autoApplyAvailable: true,
      });
    }

    return {
      recommendations,
      generatedAt: new Date(),
      basedOnDataFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      basedOnDataTo: new Date(),
    };
  }

  /**
   * Apply a recommendation
   */
  async applyRecommendation(
    tenantId: string,
    recommendationId: string,
    updatedBy?: string
  ): Promise<ApplyConfigResponse> {
    const recommendations = await this.getRecommendations(tenantId);
    const rec = recommendations.recommendations.find(r => r.id === recommendationId);

    if (!rec) {
      return {
        success: false,
        appliedChanges: [],
        failedChanges: [{ change: recommendationId, error: 'Recommendation not found' }],
        rollbackAvailable: false,
      };
    }

    if (!rec.autoApplyAvailable) {
      return {
        success: false,
        appliedChanges: [],
        failedChanges: [{ change: recommendationId, error: 'This recommendation requires manual action' }],
        rollbackAvailable: false,
      };
    }

    try {
      let updates: UpdatePerformanceConfigRequest = {};

      switch (recommendationId) {
        case 'increase-concurrency':
          const currentMax = (await this.getConfig(tenantId))?.agentWorkerConfig.maxConcurrency || 50;
          updates = {
            agentWorkerConfig: {
              maxConcurrency: Math.ceil(currentMax * 1.5),
            },
          };
          break;
        case 'increase-memory':
          updates = {
            agentWorkerConfig: {
              memoryMb: 2048,
            },
          };
          break;
        default:
          return {
            success: false,
            appliedChanges: [],
            failedChanges: [{ change: recommendationId, error: 'Unknown recommendation' }],
            rollbackAvailable: false,
          };
      }

      await this.updateConfig(tenantId, updates, updatedBy);

      return {
        success: true,
        appliedChanges: [rec.title],
        failedChanges: [],
        rollbackAvailable: true,
      };
    } catch (error: any) {
      return {
        success: false,
        appliedChanges: [],
        failedChanges: [{ change: rec.title, error: error.message }],
        rollbackAvailable: false,
      };
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(tenantId: string): Promise<PerformanceAlert[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM sovereign_mesh_performance_alerts 
         WHERE tenant_id = :tenantId AND resolved_at IS NULL
         ORDER BY triggered_at DESC
         LIMIT 100`,
        [stringParam('tenantId', tenantId)]
      );

      return (result.rows || []).map(row => ({
        id: row.id as string,
        type: row.alert_type as PerformanceAlert['type'],
        severity: row.severity as PerformanceAlert['severity'],
        message: row.message as string,
        metric: row.metric_name as string,
        threshold: parseFloat(row.threshold_value as string),
        currentValue: parseFloat(row.current_value as string),
        triggeredAt: new Date(row.triggered_at as string),
        acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : undefined,
        resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
      }));
    } catch (error) {
      logger.error('Failed to get active alerts', { tenantId, error });
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, tenantId: string, userId: string): Promise<boolean> {
    try {
      await executeStatement(
        `UPDATE sovereign_mesh_performance_alerts 
         SET acknowledged_at = NOW(), acknowledged_by = :userId
         WHERE id = :alertId AND tenant_id = :tenantId`,
        [
          stringParam('alertId', alertId),
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
        ]
      );
      return true;
    } catch (error) {
      logger.error('Failed to acknowledge alert', { alertId, error });
      return false;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, tenantId: string, userId?: string): Promise<boolean> {
    try {
      await executeStatement(
        `UPDATE sovereign_mesh_performance_alerts 
         SET resolved_at = NOW(), resolved_by = :userId, auto_resolved = :autoResolved
         WHERE id = :alertId AND tenant_id = :tenantId`,
        [
          stringParam('alertId', alertId),
          stringParam('tenantId', tenantId),
          stringParam('userId', userId || ''),
          boolParam('autoResolved', !userId),
        ]
      );
      return true;
    } catch (error) {
      logger.error('Failed to resolve alert', { alertId, error });
      return false;
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private rowToConfig(row: Record<string, unknown>): SovereignMeshPerformanceConfig {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      agentWorkerConfig: {
        reservedConcurrency: row.agent_worker_reserved_concurrency as number,
        provisionedConcurrency: row.agent_worker_provisioned_concurrency as number,
        maxConcurrency: row.agent_worker_max_concurrency as number,
        memoryMb: row.agent_worker_memory_mb as number,
        timeoutSeconds: row.agent_worker_timeout_seconds as number,
      },
      transparencyWorkerConfig: {
        reservedConcurrency: row.transparency_worker_reserved_concurrency as number,
        provisionedConcurrency: row.transparency_worker_provisioned_concurrency as number,
        maxConcurrency: row.transparency_worker_max_concurrency as number,
        memoryMb: row.transparency_worker_memory_mb as number,
        timeoutSeconds: row.transparency_worker_timeout_seconds as number,
      },
      agentExecutionQueueConfig: {
        visibilityTimeoutSeconds: row.agent_queue_visibility_timeout_seconds as number,
        retentionDays: row.agent_queue_retention_days as number,
        maxReceiveCount: row.agent_queue_max_receive_count as number,
        batchSize: row.agent_queue_batch_size as number,
        fifoEnabled: row.agent_queue_fifo_enabled as boolean,
        contentBasedDeduplication: row.agent_queue_content_dedup as boolean,
      },
      transparencyQueueConfig: {
        visibilityTimeoutSeconds: row.transparency_queue_visibility_timeout_seconds as number,
        retentionDays: row.transparency_queue_retention_days as number,
        maxReceiveCount: row.transparency_queue_max_receive_count as number,
        batchSize: row.transparency_queue_batch_size as number,
        fifoEnabled: row.transparency_queue_fifo_enabled as boolean,
        contentBasedDeduplication: row.transparency_queue_content_dedup as boolean,
      },
      scalingConfig: {
        strategy: row.scaling_strategy as 'fixed' | 'auto' | 'scheduled',
        minInstances: row.scaling_min_instances as number,
        maxInstances: row.scaling_max_instances as number,
        targetUtilization: row.scaling_target_utilization as number,
        scaleInCooldownSeconds: row.scaling_scale_in_cooldown_seconds as number,
        scaleOutCooldownSeconds: row.scaling_scale_out_cooldown_seconds as number,
      },
      agentCacheConfig: {
        backend: row.agent_cache_backend as 'memory' | 'redis' | 'elasticache',
        defaultTtlSeconds: row.agent_cache_default_ttl_seconds as number,
        maxEntries: row.agent_cache_max_entries as number,
        compressionEnabled: row.agent_cache_compression_enabled as boolean,
        compressionThresholdBytes: row.agent_cache_compression_threshold_bytes as number,
        agentTtlSeconds: row.agent_cache_agent_ttl_seconds as number,
        executionStateTtlSeconds: row.agent_cache_execution_state_ttl_seconds as number,
        workingMemoryTtlSeconds: row.agent_cache_working_memory_ttl_seconds as number,
        warmOnStartup: row.agent_cache_warm_on_startup as boolean,
      },
      executionCacheConfig: {
        backend: row.execution_cache_backend as 'memory' | 'redis' | 'elasticache',
        defaultTtlSeconds: row.execution_cache_default_ttl_seconds as number,
        maxEntries: row.execution_cache_max_entries as number,
        compressionEnabled: row.execution_cache_compression_enabled as boolean,
        compressionThresholdBytes: row.execution_cache_compression_threshold_bytes as number,
        hotStateCacheEnabled: row.execution_cache_hot_state_enabled as boolean,
        writeThroughEnabled: row.execution_cache_write_through_enabled as boolean,
        writeBehindDelayMs: row.execution_cache_write_behind_delay_ms as number,
        writeBehindBatchSize: row.execution_cache_write_behind_batch_size as number,
      },
      artifactArchivalConfig: {
        storageBackend: row.artifact_storage_backend as 'database' | 's3' | 'hybrid',
        s3Bucket: row.artifact_s3_bucket as string | undefined,
        s3Prefix: row.artifact_s3_prefix as string | undefined,
        archiveAfterDays: row.artifact_archive_after_days as number,
        deleteAfterDays: row.artifact_delete_after_days as number,
        maxDbArtifactBytes: row.artifact_max_db_bytes as number,
        compressionEnabled: row.artifact_compression_enabled as boolean,
        compressionAlgorithm: row.artifact_compression_algorithm as 'gzip' | 'lz4' | 'zstd',
      },
      databasePoolConfig: {
        minConnections: row.db_pool_min_connections as number,
        maxConnections: row.db_pool_max_connections as number,
        idleTimeoutSeconds: row.db_pool_idle_timeout_seconds as number,
        acquireTimeoutSeconds: row.db_pool_acquire_timeout_seconds as number,
        rdsProxyEnabled: row.db_pool_rds_proxy_enabled as boolean,
        rdsProxyEndpoint: row.db_pool_rds_proxy_endpoint as string | undefined,
      },
      databaseIndexConfig: {
        tenantStatusIndexEnabled: true,
        agentStatusIndexEnabled: true,
        createdAtIndexEnabled: true,
        runningExecutionsPartialIndexEnabled: true,
        brinIndexEnabled: false,
      },
      tenantIsolationConfig: {
        mode: row.tenant_isolation_mode as 'shared' | 'dedicated' | 'fifo',
        dedicatedQueueThreshold: row.tenant_dedicated_queue_threshold as number,
        rateLimitingEnabled: row.tenant_rate_limiting_enabled as boolean,
        maxConcurrentPerTenant: row.tenant_max_concurrent_per_tenant as number,
        maxConcurrentPerUser: row.tenant_max_concurrent_per_user as number,
        priorityQueueEnabled: row.tenant_priority_queue_enabled as boolean,
      },
      metricsConfig: {
        cloudWatchEnabled: row.metrics_cloudwatch_enabled as boolean,
        cloudWatchNamespace: row.metrics_cloudwatch_namespace as string,
        xrayEnabled: row.metrics_xray_enabled as boolean,
        xraySamplingRate: parseFloat(row.metrics_xray_sampling_rate as string),
        oodaPhaseMetricsEnabled: row.metrics_ooda_phase_enabled as boolean,
        flushIntervalSeconds: row.metrics_flush_interval_seconds as number,
      },
      alertConfig: {
        dlqAlertEnabled: row.alert_dlq_enabled as boolean,
        dlqAlertThreshold: row.alert_dlq_threshold as number,
        latencyAlertEnabled: row.alert_latency_enabled as boolean,
        latencyAlertThresholdMs: row.alert_latency_threshold_ms as number,
        budgetAlertEnabled: row.alert_budget_enabled as boolean,
        budgetAlertThresholdPercent: row.alert_budget_threshold_percent as number,
        alertSnsTopicArn: row.alert_sns_topic_arn as string | undefined,
      },
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      createdBy: row.created_by as string | undefined,
      updatedBy: row.updated_by as string | undefined,
    };
  }

  private async recordConfigChange(
    tenantId: string,
    config: SovereignMeshPerformanceConfig,
    changedFields: string[],
    createdBy?: string
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO sovereign_mesh_config_history (
           tenant_id, config_snapshot, changed_fields, created_by
         ) VALUES (
           :tenantId, :snapshot::jsonb, :fields, :createdBy
         )`,
        [
          stringParam('tenantId', tenantId),
          stringParam('snapshot', JSON.stringify(config)),
          stringParam('fields', `{${changedFields.join(',')}}`),
          stringParam('createdBy', createdBy || ''),
        ]
      );
    } catch (error) {
      logger.error('Failed to record config change', { tenantId, error });
    }
  }

  private getPendingChanges(updates: UpdatePerformanceConfigRequest): string[] {
    const pending: string[] = [];
    
    // Some changes require infrastructure updates (CDK deploy)
    if (updates.agentWorkerConfig?.provisionedConcurrency !== undefined) {
      pending.push('Provisioned concurrency requires CDK deployment');
    }
    if (updates.agentExecutionQueueConfig?.fifoEnabled !== undefined) {
      pending.push('FIFO queue change requires queue recreation');
    }
    
    return pending;
  }

  private async getExecutionMetrics(tenantId: string): Promise<{
    activeExecutions: number;
    pendingExecutions: number;
    totalExecutions: number;
    failedExecutions: number;
    avgDurationSeconds: number;
  }> {
    try {
      const result = await executeStatement(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'running') as active,
           COUNT(*) FILTER (WHERE status = 'pending') as pending,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as total_24h,
           COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') as failed_24h,
           AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_duration
         FROM agent_executions
         WHERE tenant_id = :tenantId`,
        [stringParam('tenantId', tenantId)]
      );

      const row = result.rows?.[0] || {};
      return {
        activeExecutions: parseInt(row.active as string, 10) || 0,
        pendingExecutions: parseInt(row.pending as string, 10) || 0,
        totalExecutions: parseInt(row.total_24h as string, 10) || 0,
        failedExecutions: parseInt(row.failed_24h as string, 10) || 0,
        avgDurationSeconds: parseFloat(row.avg_duration as string) || 0,
      };
    } catch (error) {
      logger.error('Failed to get execution metrics', { tenantId, error });
      return {
        activeExecutions: 0,
        pendingExecutions: 0,
        totalExecutions: 0,
        failedExecutions: 0,
        avgDurationSeconds: 0,
      };
    }
  }

  private async getOODAPhaseMetrics(tenantId: string): Promise<OODAPhaseMetrics[]> {
    const phases = ['observe', 'orient', 'decide', 'act', 'report'] as const;
    const results: OODAPhaseMetrics[] = [];

    try {
      // Query execution_snapshots for phase timing data from the last 24 hours
      for (const phase of phases) {
        const result = await executeStatement(
          `WITH phase_data AS (
            SELECT 
              es.duration_ms,
              es.status = 'error' as is_error
            FROM execution_snapshots es
            JOIN agent_executions ae ON es.execution_id = ae.id
            WHERE ae.tenant_id = :tenantId
              AND es.phase = :phase
              AND es.created_at > NOW() - INTERVAL '24 hours'
          ),
          percentiles AS (
            SELECT 
              PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50,
              PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95,
              PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99
            FROM phase_data
          )
          SELECT 
            COUNT(*) as execution_count,
            COALESCE(SUM(duration_ms), 0) as total_duration_ms,
            COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
            COALESCE((SELECT p50 FROM percentiles), 0) as p50_duration_ms,
            COALESCE((SELECT p95 FROM percentiles), 0) as p95_duration_ms,
            COALESCE((SELECT p99 FROM percentiles), 0) as p99_duration_ms,
            COALESCE(SUM(CASE WHEN is_error THEN 1 ELSE 0 END), 0) as error_count
          FROM phase_data`,
          [
            stringParam('tenantId', tenantId),
            stringParam('phase', phase),
          ]
        );

        const row = result.rows?.[0] || {};
        const executionCount = parseInt(row.execution_count as string, 10) || 0;
        const errorCount = parseInt(row.error_count as string, 10) || 0;

        results.push({
          phase,
          executionCount,
          totalDurationMs: parseFloat(row.total_duration_ms as string) || 0,
          avgDurationMs: parseFloat(row.avg_duration_ms as string) || 0,
          p50DurationMs: parseFloat(row.p50_duration_ms as string) || 0,
          p95DurationMs: parseFloat(row.p95_duration_ms as string) || 0,
          p99DurationMs: parseFloat(row.p99_duration_ms as string) || 0,
          errorCount,
          errorRate: executionCount > 0 ? errorCount / executionCount : 0,
        });
      }

      return results;
    } catch (error) {
      logger.error('Failed to get OODA phase metrics', { tenantId, error });
      // Return empty metrics on error
      return phases.map(phase => ({
        phase,
        executionCount: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        errorCount: 0,
        errorRate: 0,
      }));
    }
  }

  private async getThroughputMetrics(tenantId: string): Promise<ExecutionThroughputMetrics> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      const result = await executeStatement(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           COUNT(*) FILTER (WHERE status = 'failed') as failed,
           COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
           AVG(current_iteration) as avg_iterations,
           AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
         FROM agent_executions
         WHERE tenant_id = :tenantId
           AND created_at >= :startTime`,
        [
          stringParam('tenantId', tenantId),
          stringParam('startTime', hourAgo.toISOString()),
        ]
      );

      const row = result.rows?.[0] || {};
      const total = parseInt(row.total as string, 10) || 0;

      return {
        period: 'hour',
        startTime: hourAgo,
        endTime: now,
        totalExecutions: total,
        completedExecutions: parseInt(row.completed as string, 10) || 0,
        failedExecutions: parseInt(row.failed as string, 10) || 0,
        cancelledExecutions: parseInt(row.cancelled as string, 10) || 0,
        avgIterationsPerExecution: parseFloat(row.avg_iterations as string) || 0,
        avgDurationSeconds: parseFloat(row.avg_duration as string) || 0,
        throughputPerSecond: total / 3600,
      };
    } catch (error) {
      logger.error('Failed to get throughput metrics', { tenantId, error });
      return {
        period: 'hour',
        startTime: hourAgo,
        endTime: now,
        totalExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0,
        cancelledExecutions: 0,
        avgIterationsPerExecution: 0,
        avgDurationSeconds: 0,
        throughputPerSecond: 0,
      };
    }
  }

  private calculateHealthScore(metrics: {
    dlqMessages: number;
    cacheHitRate: number;
    errorRate: number;
    queueBacklog: number;
  }): number {
    let score = 100;

    // DLQ messages penalty
    score -= Math.min(30, metrics.dlqMessages * 3);

    // Low cache hit rate penalty
    if (metrics.cacheHitRate < 0.8) {
      score -= (0.8 - metrics.cacheHitRate) * 20;
    }

    // Error rate penalty
    score -= metrics.errorRate * 30;

    // Queue backlog penalty
    if (metrics.queueBacklog > 100) {
      score -= Math.min(20, (metrics.queueBacklog - 100) / 10);
    }

    return Math.max(0, Math.round(score));
  }

  private estimateMonthlyCost(
    config: SovereignMeshPerformanceConfig,
    throughput: ExecutionThroughputMetrics
  ): number {
    // Rough cost estimation
    const lambdaGbSeconds = throughput.totalExecutions * throughput.avgDurationSeconds * 
      (config.agentWorkerConfig.memoryMb / 1024) * 30 * 24;
    const lambdaCost = lambdaGbSeconds * 0.0000166667;

    const sqsRequests = throughput.totalExecutions * 5 * 30 * 24; // ~5 messages per execution
    const sqsCost = sqsRequests * 0.0000004;

    return lambdaCost + sqsCost;
  }
}

// Export singleton instance
export const performanceConfigService = new PerformanceConfigService();
