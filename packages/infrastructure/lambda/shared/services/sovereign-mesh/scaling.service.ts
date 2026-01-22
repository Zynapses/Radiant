/**
 * RADIANT v5.38.0 - Sovereign Mesh Scaling Service
 * 
 * Comprehensive infrastructure scaling management with cost calculation,
 * session tracking, and auto-scaling capabilities.
 */

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../../db/client';
import { enhancedLogger } from '../../logging/enhanced-logger';
import type {
  ScalingTier,
  ScalingProfile,
  ScalingDashboard,
  SessionMetrics,
  SessionCapacity,
  SessionTrend,
  ScalingCostEstimate,
  CostBreakdown,
  ComponentCost,
  ScalingOperation,
  ScalingAlert,
  ScalingRecommendation,
  ComponentHealth,
  AutoScalingRule,
  ScheduledScalingRule,
  UpdateScalingProfileRequest,
  ApplyScalingProfileResponse,
  EstimateCostResponse,
  AWS_PRICING,
  DEFAULT_LAMBDA_CONFIG,
  DEFAULT_AURORA_CONFIG,
  DEFAULT_REDIS_CONFIG,
  DEFAULT_API_GATEWAY_CONFIG,
  DEFAULT_SQS_CONFIG,
  getDefaultScalingProfile,
  calculateMaxSessions,
} from '@radiant/shared';

const logger = enhancedLogger;

// ============================================================================
// AWS PRICING CONSTANTS (as of Jan 2026)
// ============================================================================

const PRICING = {
  lambda: {
    requestPer1M: 0.20,
    gbSecond: 0.0000166667,
    provisionedGbHour: 0.000004167,
  },
  aurora: {
    acuHour: 0.12,
    storageGbMonth: 0.10,
    ioPerMillion: 0.20,
  },
  redis: {
    't4g.micro': 0.016,
    't4g.small': 0.032,
    'r6g.large': 0.182,
    'r6g.xlarge': 0.364,
    'r6g.2xlarge': 0.728,
  } as Record<string, number>,
  apiGateway: {
    requestPer1M: 3.50,
    httpApiPer1M: 1.00,
  },
  sqs: {
    requestPer1M: 0.40,
    fifoRequestPer1M: 0.50,
  },
  cloudFront: {
    requestPer10K: 0.01,
    dataTransferGb: 0.085,
  },
  dataTransfer: {
    outGb: 0.09,
    interRegionGb: 0.02,
  },
};

// ============================================================================
// SCALING SERVICE
// ============================================================================

class ScalingService {
  /**
   * Get complete scaling dashboard
   */
  async getDashboard(tenantId: string): Promise<ScalingDashboard> {
    const [
      currentProfile,
      sessionMetrics,
      sessionCapacity,
      sessionTrends,
      recentOperations,
      activeAlerts,
      componentHealth,
    ] = await Promise.all([
      this.getActiveProfile(tenantId),
      this.getSessionMetrics(tenantId),
      this.getSessionCapacity(tenantId),
      this.getSessionTrends(tenantId, 24),
      this.getRecentOperations(tenantId, 10),
      this.getActiveAlerts(tenantId),
      this.getComponentHealth(tenantId),
    ]);

    const costEstimate = await this.estimateCost(tenantId, currentProfile);
    const recommendations = await this.generateRecommendations(tenantId, currentProfile, sessionMetrics, componentHealth);

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      currentProfile,
      sessionMetrics,
      sessionCapacity,
      sessionTrends,
      costEstimate,
      recentOperations,
      activeAlerts,
      recommendations,
      componentHealth,
    };
  }

  /**
   * Get or create active scaling profile
   */
  async getActiveProfile(tenantId: string): Promise<ScalingProfile> {
    const result = await executeStatement(
      `SELECT * FROM sovereign_mesh_scaling_profiles 
       WHERE tenant_id = :tenantId AND is_active = true
       LIMIT 1`,
      [stringParam('tenantId', tenantId)]
    );

    if (result.rows?.[0]) {
      return this.rowToProfile(result.rows[0]);
    }

    // Create default production profile
    return this.createProfile(tenantId, 'production');
  }

  /**
   * Get all profiles for tenant
   */
  async getProfiles(tenantId: string): Promise<ScalingProfile[]> {
    const result = await executeStatement(
      `SELECT * FROM sovereign_mesh_scaling_profiles 
       WHERE tenant_id = :tenantId
       ORDER BY target_sessions ASC`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => this.rowToProfile(row));
  }

  /**
   * Create a new scaling profile
   */
  async createProfile(tenantId: string, tier: ScalingTier, customName?: string): Promise<ScalingProfile> {
    const defaults = getDefaultScalingProfile(tier);
    const name = customName || defaults.name;

    const result = await executeStatement(
      `INSERT INTO sovereign_mesh_scaling_profiles (
         tenant_id, name, description, tier, target_sessions, is_active, is_default,
         lambda_reserved_concurrency, lambda_provisioned_concurrency, lambda_max_concurrency,
         lambda_memory_mb, lambda_timeout_seconds, lambda_ephemeral_storage_mb, lambda_snap_start_enabled,
         aurora_min_capacity_acu, aurora_max_capacity_acu, aurora_read_replica_count,
         aurora_enable_global_database, aurora_secondary_regions, aurora_connection_pool_size, aurora_enable_pgbouncer,
         redis_node_type, redis_num_shards, redis_replicas_per_shard,
         redis_enable_cluster_mode, redis_enable_global_datastore, redis_secondary_regions, redis_max_connections,
         api_throttling_rate_limit, api_throttling_burst_limit, api_enable_edge_optimized,
         api_enable_cloudfront, api_regional_endpoints,
         sqs_standard_queue_count, sqs_fifo_queue_count, sqs_max_message_size,
         sqs_visibility_timeout_seconds, sqs_message_retention_days, sqs_enable_batching, sqs_batch_size,
         estimated_monthly_cost
       ) VALUES (
         :tenantId, :name, :description, :tier::scaling_tier, :targetSessions, true, true,
         :lambdaReserved, :lambdaProvisioned, :lambdaMax,
         :lambdaMemory, :lambdaTimeout, :lambdaEphemeral, :lambdaSnapStart,
         :auroraMin, :auroraMax, :auroraReplicas,
         :auroraGlobal, :auroraRegions, :auroraPool, :auroraPgBouncer,
         :redisNode, :redisShards, :redisReplicas,
         :redisCluster, :redisGlobal, :redisRegions, :redisConnections,
         :apiRate, :apiBurst, :apiEdge,
         :apiCloudFront, :apiRegions,
         :sqsStandard, :sqsFifo, :sqsMessageSize,
         :sqsVisibility, :sqsRetention, :sqsBatching, :sqsBatchSize,
         :estimatedCost
       )
       ON CONFLICT (tenant_id, name) DO UPDATE SET
         is_active = true, updated_at = NOW()
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('name', name),
        stringParam('description', defaults.description),
        stringParam('tier', tier),
        longParam('targetSessions', defaults.targetSessions),
        longParam('lambdaReserved', defaults.lambda.reservedConcurrency),
        longParam('lambdaProvisioned', defaults.lambda.provisionedConcurrency),
        longParam('lambdaMax', defaults.lambda.maxConcurrency),
        longParam('lambdaMemory', defaults.lambda.memoryMb),
        longParam('lambdaTimeout', defaults.lambda.timeoutSeconds),
        longParam('lambdaEphemeral', defaults.lambda.ephemeralStorageMb),
        boolParam('lambdaSnapStart', defaults.lambda.snapStartEnabled),
        doubleParam('auroraMin', defaults.aurora.minCapacityAcu),
        doubleParam('auroraMax', defaults.aurora.maxCapacityAcu),
        longParam('auroraReplicas', defaults.aurora.readReplicaCount),
        boolParam('auroraGlobal', defaults.aurora.enableGlobalDatabase),
        stringParam('auroraRegions', `{${defaults.aurora.secondaryRegions.join(',')}}`),
        longParam('auroraPool', defaults.aurora.connectionPoolSize),
        boolParam('auroraPgBouncer', defaults.aurora.enablePgBouncer),
        stringParam('redisNode', defaults.redis.nodeType),
        longParam('redisShards', defaults.redis.numShards),
        longParam('redisReplicas', defaults.redis.replicasPerShard),
        boolParam('redisCluster', defaults.redis.enableClusterMode),
        boolParam('redisGlobal', defaults.redis.enableGlobalDatastore),
        stringParam('redisRegions', `{${defaults.redis.secondaryRegions.join(',')}}`),
        longParam('redisConnections', defaults.redis.maxConnections),
        longParam('apiRate', defaults.apiGateway.throttlingRateLimit),
        longParam('apiBurst', defaults.apiGateway.throttlingBurstLimit),
        boolParam('apiEdge', defaults.apiGateway.enableEdgeOptimized),
        boolParam('apiCloudFront', defaults.apiGateway.enableCloudFront),
        stringParam('apiRegions', `{${defaults.apiGateway.regionalEndpoints.join(',')}}`),
        longParam('sqsStandard', defaults.sqs.standardQueueCount),
        longParam('sqsFifo', defaults.sqs.fifoQueueCount),
        longParam('sqsMessageSize', defaults.sqs.maxMessageSize),
        longParam('sqsVisibility', defaults.sqs.visibilityTimeoutSeconds),
        longParam('sqsRetention', defaults.sqs.messageRetentionDays),
        boolParam('sqsBatching', defaults.sqs.enableBatching),
        longParam('sqsBatchSize', defaults.sqs.batchSize),
        doubleParam('estimatedCost', defaults.estimatedMonthlyCost),
      ]
    );

    logger.info('Scaling profile created', { tenantId, tier, name });
    return this.rowToProfile(result.rows![0]);
  }

  /**
   * Update scaling profile
   */
  async updateProfile(
    tenantId: string,
    profileId: string,
    updates: UpdateScalingProfileRequest,
    updatedBy?: string
  ): Promise<ScalingProfile> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [
      stringParam('tenantId', tenantId),
      stringParam('profileId', profileId),
    ];

    if (updates.tier) {
      setClauses.push('tier = :tier::scaling_tier');
      params.push(stringParam('tier', updates.tier));
    }
    if (updates.targetSessions !== undefined) {
      setClauses.push('target_sessions = :targetSessions');
      params.push(longParam('targetSessions', updates.targetSessions));
    }

    // Lambda updates
    if (updates.lambda) {
      const l = updates.lambda;
      if (l.reservedConcurrency !== undefined) {
        setClauses.push('lambda_reserved_concurrency = :lReserved');
        params.push(longParam('lReserved', l.reservedConcurrency));
      }
      if (l.provisionedConcurrency !== undefined) {
        setClauses.push('lambda_provisioned_concurrency = :lProvisioned');
        params.push(longParam('lProvisioned', l.provisionedConcurrency));
      }
      if (l.maxConcurrency !== undefined) {
        setClauses.push('lambda_max_concurrency = :lMax');
        params.push(longParam('lMax', l.maxConcurrency));
      }
      if (l.memoryMb !== undefined) {
        setClauses.push('lambda_memory_mb = :lMemory');
        params.push(longParam('lMemory', l.memoryMb));
      }
    }

    // Aurora updates
    if (updates.aurora) {
      const a = updates.aurora;
      if (a.minCapacityAcu !== undefined) {
        setClauses.push('aurora_min_capacity_acu = :aMin');
        params.push(doubleParam('aMin', a.minCapacityAcu));
      }
      if (a.maxCapacityAcu !== undefined) {
        setClauses.push('aurora_max_capacity_acu = :aMax');
        params.push(doubleParam('aMax', a.maxCapacityAcu));
      }
      if (a.readReplicaCount !== undefined) {
        setClauses.push('aurora_read_replica_count = :aReplicas');
        params.push(longParam('aReplicas', a.readReplicaCount));
      }
      if (a.enableGlobalDatabase !== undefined) {
        setClauses.push('aurora_enable_global_database = :aGlobal');
        params.push(boolParam('aGlobal', a.enableGlobalDatabase));
      }
    }

    // Redis updates
    if (updates.redis) {
      const r = updates.redis;
      if (r.nodeType !== undefined) {
        setClauses.push('redis_node_type = :rNode');
        params.push(stringParam('rNode', r.nodeType));
      }
      if (r.numShards !== undefined) {
        setClauses.push('redis_num_shards = :rShards');
        params.push(longParam('rShards', r.numShards));
      }
      if (r.enableClusterMode !== undefined) {
        setClauses.push('redis_enable_cluster_mode = :rCluster');
        params.push(boolParam('rCluster', r.enableClusterMode));
      }
    }

    // API Gateway updates
    if (updates.apiGateway) {
      const api = updates.apiGateway;
      if (api.throttlingRateLimit !== undefined) {
        setClauses.push('api_throttling_rate_limit = :apiRate');
        params.push(longParam('apiRate', api.throttlingRateLimit));
      }
      if (api.enableCloudFront !== undefined) {
        setClauses.push('api_enable_cloudfront = :apiCf');
        params.push(boolParam('apiCf', api.enableCloudFront));
      }
    }

    if (updatedBy) {
      setClauses.push('updated_by = :updatedBy');
      params.push(stringParam('updatedBy', updatedBy));
    }

    const result = await executeStatement(
      `UPDATE sovereign_mesh_scaling_profiles 
       SET ${setClauses.join(', ')}
       WHERE tenant_id = :tenantId AND id = :profileId
       RETURNING *`,
      params
    );

    if (!result.rows?.[0]) {
      throw new Error('Profile not found');
    }

    // Recalculate cost
    await executeStatement(
      `SELECT calculate_scaling_cost(:profileId)`,
      [stringParam('profileId', profileId)]
    );

    logger.info('Scaling profile updated', { tenantId, profileId });
    return this.rowToProfile(result.rows[0]);
  }

  /**
   * Apply a scaling profile (trigger infrastructure changes)
   */
  async applyProfile(
    tenantId: string,
    profileId: string,
    initiatedBy: string,
    options?: { requiresApproval?: boolean; scheduledAt?: string }
  ): Promise<ApplyScalingProfileResponse> {
    // Get current and target profiles
    const [currentProfile, targetProfile] = await Promise.all([
      this.getActiveProfile(tenantId),
      this.getProfileById(tenantId, profileId),
    ]);

    if (!targetProfile) {
      return { success: false, operationId: '', estimatedDuration: 0, changes: [], requiresApproval: false, error: 'Target profile not found' };
    }

    // Calculate changes
    const changes = this.calculateChanges(currentProfile, targetProfile);
    const estimatedDuration = this.estimateOperationDuration(changes);
    const requiresApproval = options?.requiresApproval || changes.some(c => c.component === 'aurora' && c.setting.includes('global'));

    // Create scaling operation
    const opResult = await executeStatement(
      `INSERT INTO sovereign_mesh_scaling_operations (
         tenant_id, operation_type, status, source_profile_id, target_profile_id,
         changes, estimated_duration_seconds, requires_approval, initiated_by,
         scheduled_at
       ) VALUES (
         :tenantId, 'scale_up'::scaling_operation_type, 
         CASE WHEN :requiresApproval THEN 'pending'::scaling_operation_status ELSE 'in_progress'::scaling_operation_status END,
         :sourceId, :targetId, :changes::jsonb, :duration, :requiresApproval, :initiatedBy,
         :scheduledAt::timestamptz
       ) RETURNING id`,
      [
        stringParam('tenantId', tenantId),
        stringParam('sourceId', currentProfile.id),
        stringParam('targetId', targetProfile.id),
        stringParam('changes', JSON.stringify(changes)),
        longParam('duration', estimatedDuration),
        boolParam('requiresApproval', requiresApproval),
        stringParam('initiatedBy', initiatedBy),
        stringParam('scheduledAt', options?.scheduledAt || ''),
      ]
    );

    const operationId = opResult.rows?.[0]?.id as string;

    // If no approval needed and not scheduled, activate immediately
    if (!requiresApproval && !options?.scheduledAt) {
      await this.activateProfile(tenantId, profileId, operationId);
    }

    logger.info('Scaling operation created', { tenantId, operationId, changes: changes.length });

    return {
      success: true,
      operationId,
      estimatedDuration,
      changes: changes.map(c => ({ ...c, oldValue: String(c.oldValue), newValue: String(c.newValue) })),
      requiresApproval,
    };
  }

  /**
   * Estimate cost for a configuration
   */
  async estimateCost(tenantId: string, profile: ScalingProfile): Promise<ScalingCostEstimate> {
    const lambda = this.calculateLambdaCost(profile);
    const aurora = this.calculateAuroraCost(profile);
    const redis = this.calculateRedisCost(profile);
    const apiGateway = this.calculateApiGatewayCost(profile);
    const sqs = this.calculateSqsCost(profile);
    const cloudFront = this.calculateCloudFrontCost(profile);
    const dataTransfer = this.calculateDataTransferCost(profile);

    const totalMonthlyCost = lambda.totalCost + aurora.totalCost + redis.totalCost + 
      apiGateway.totalCost + sqs.totalCost + cloudFront.totalCost + dataTransfer.totalCost;

    const maxSessions = calculateMaxSessions({
      lambda: profile.lambda,
      aurora: profile.aurora,
      redis: profile.redis,
      apiGateway: profile.apiGateway,
    });

    return {
      profileId: profile.id,
      tier: profile.tier,
      targetSessions: profile.targetSessions,
      components: { lambda, aurora, redis, apiGateway, sqs, cloudFront, dataTransfer },
      totalMonthlyCost,
      costPerSession: totalMonthlyCost / Math.max(maxSessions.maxSessions, 1),
      costPer1000Sessions: (totalMonthlyCost / Math.max(maxSessions.maxSessions, 1)) * 1000,
      savingsVsOnDemand: totalMonthlyCost * 0.3, // Estimate 30% savings with reserved
      savingsPercent: 30,
    };
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(tenantId: string): Promise<SessionMetrics> {
    const result = await executeStatement(
      `SELECT 
         COALESCE(active_sessions, 0) as active,
         COALESCE(pending_sessions, 0) as pending,
         COALESCE(completed_sessions, 0) as completed,
         COALESCE(failed_sessions, 0) as failed,
         COALESCE(sessions_by_region, '{}') as by_region,
         COALESCE(avg_session_duration_ms, 0) as avg_duration
       FROM sovereign_mesh_session_metrics
       WHERE tenant_id = :tenantId
       ORDER BY metric_time DESC
       LIMIT 1`,
      [stringParam('tenantId', tenantId)]
    );

    const row = result.rows?.[0];
    const now = new Date();

    // Get historical counts
    const hourlyResult = await executeStatement(
      `SELECT 
         COALESCE(SUM(total_sessions) FILTER (WHERE hour_start >= NOW() - INTERVAL '1 hour'), 0) as last_1h,
         COALESCE(SUM(total_sessions) FILTER (WHERE hour_start >= NOW() - INTERVAL '24 hours'), 0) as last_24h,
         COALESCE(SUM(total_sessions) FILTER (WHERE hour_start >= NOW() - INTERVAL '7 days'), 0) as last_7d,
         COALESCE(SUM(total_sessions) FILTER (WHERE hour_start >= NOW() - INTERVAL '30 days'), 0) as last_30d,
         COALESCE(MAX(peak_concurrent_sessions) FILTER (WHERE hour_start >= NOW() - INTERVAL '24 hours'), 0) as peak_24h,
         COALESCE(MAX(peak_concurrent_sessions) FILTER (WHERE hour_start >= NOW() - INTERVAL '7 days'), 0) as peak_7d,
         COALESCE(MAX(peak_concurrent_sessions) FILTER (WHERE hour_start >= NOW() - INTERVAL '30 days'), 0) as peak_30d
       FROM sovereign_mesh_session_metrics_hourly
       WHERE tenant_id = :tenantId`,
      [stringParam('tenantId', tenantId)]
    );

    const hourly = hourlyResult.rows?.[0] || {};

    return {
      currentActiveSessions: parseInt(row?.active || '0', 10),
      peakSessionsToday: parseInt(hourly.peak_24h || '0', 10),
      peakSessionsWeek: parseInt(hourly.peak_7d || '0', 10),
      peakSessionsMonth: parseInt(hourly.peak_30d || '0', 10),
      avgSessionDurationSeconds: parseInt(row?.avg_duration || '0', 10) / 1000,
      sessionsLast1Hour: parseInt(hourly.last_1h || '0', 10),
      sessionsLast24Hours: parseInt(hourly.last_24h || '0', 10),
      sessionsLast7Days: parseInt(hourly.last_7d || '0', 10),
      sessionsLast30Days: parseInt(hourly.last_30d || '0', 10),
      sessionsByRegion: row?.by_region || {},
      sessionsByTenant: [],
    };
  }

  /**
   * Get session capacity
   */
  async getSessionCapacity(tenantId: string): Promise<SessionCapacity> {
    const result = await executeStatement(
      `SELECT * FROM get_session_capacity(:tenantId)`,
      [stringParam('tenantId', tenantId)]
    );

    const row = result.rows?.[0];
    return {
      maxConcurrentSessions: parseInt(row?.max_sessions || '10000', 10),
      currentUtilizationPercent: parseFloat(row?.utilization_percent || '0'),
      headroomSessions: parseInt(row?.headroom || '10000', 10),
      estimatedTimeToCapacity: null,
      bottleneck: (row?.bottleneck as any) || 'none',
      bottleneckUtilization: parseFloat(row?.utilization_percent || '0'),
    };
  }

  /**
   * Get session trends
   */
  async getSessionTrends(tenantId: string, hours: number = 24): Promise<SessionTrend[]> {
    const result = await executeStatement(
      `SELECT 
         hour_start as timestamp,
         COALESCE(avg_concurrent_sessions, 0) as active,
         COALESCE(total_sessions, 0) - LAG(COALESCE(total_sessions, 0)) OVER (ORDER BY hour_start) as new_sessions,
         COALESCE(completed_sessions, 0) as completed,
         COALESCE(failed_sessions, 0) as failed
       FROM sovereign_mesh_session_metrics_hourly
       WHERE tenant_id = :tenantId AND hour_start >= NOW() - :hours * INTERVAL '1 hour'
       ORDER BY hour_start`,
      [stringParam('tenantId', tenantId), longParam('hours', hours)]
    );

    return (result.rows || []).map(row => ({
      timestamp: row.timestamp as string,
      activeSessions: parseFloat(row.active as string) || 0,
      newSessions: parseInt(row.new_sessions as string, 10) || 0,
      completedSessions: parseInt(row.completed as string, 10) || 0,
      failedSessions: parseInt(row.failed as string, 10) || 0,
    }));
  }

  /**
   * Get recent scaling operations
   */
  async getRecentOperations(tenantId: string, limit: number = 10): Promise<ScalingOperation[]> {
    const result = await executeStatement(
      `SELECT * FROM sovereign_mesh_scaling_operations
       WHERE tenant_id = :tenantId
       ORDER BY created_at DESC
       LIMIT :limit`,
      [stringParam('tenantId', tenantId), longParam('limit', limit)]
    );

    return (result.rows || []).map(row => this.rowToOperation(row));
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(tenantId: string): Promise<ScalingAlert[]> {
    const result = await executeStatement(
      `SELECT * FROM sovereign_mesh_scaling_alerts
       WHERE tenant_id = :tenantId AND resolved_at IS NULL
       ORDER BY triggered_at DESC`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => ({
      id: row.id as string,
      severity: row.severity as 'info' | 'warning' | 'critical',
      type: row.alert_type as string,
      message: row.message as string,
      component: row.component as string,
      metric: row.metric as string,
      currentValue: parseFloat(row.current_value as string) || 0,
      threshold: parseFloat(row.threshold as string) || 0,
      triggeredAt: row.triggered_at as string,
      acknowledgedAt: row.acknowledged_at as string | undefined,
      resolvedAt: row.resolved_at as string | undefined,
    }));
  }

  /**
   * Get component health
   */
  async getComponentHealth(tenantId: string): Promise<ComponentHealth[]> {
    const result = await executeStatement(
      `SELECT DISTINCT ON (component) *
       FROM sovereign_mesh_component_health
       WHERE tenant_id = :tenantId
       ORDER BY component, checked_at DESC`,
      [stringParam('tenantId', tenantId)]
    );

    const components = ['lambda', 'aurora', 'redis', 'api_gateway', 'sqs'];
    const healthMap = new Map((result.rows || []).map(row => [row.component, row]));

    return components.map(component => {
      const row = healthMap.get(component);
      return {
        component,
        status: (row?.status as 'healthy' | 'degraded' | 'unhealthy') || 'healthy',
        utilization: parseFloat(row?.utilization as string) || 0,
        capacity: parseInt(row?.capacity as string, 10) || 0,
        latencyMs: parseInt(row?.latency_ms as string, 10) || 0,
        errorRate: parseFloat(row?.error_rate as string) || 0,
        lastChecked: (row?.checked_at as string) || new Date().toISOString(),
      };
    });
  }

  /**
   * Generate scaling recommendations
   */
  async generateRecommendations(
    tenantId: string,
    profile: ScalingProfile,
    metrics: SessionMetrics,
    health: ComponentHealth[]
  ): Promise<ScalingRecommendation[]> {
    const recommendations: ScalingRecommendation[] = [];
    const capacity = await this.getSessionCapacity(tenantId);

    // High utilization recommendation
    if (capacity.currentUtilizationPercent > 70) {
      recommendations.push({
        id: `rec-scale-up-${Date.now()}`,
        priority: capacity.currentUtilizationPercent > 85 ? 'critical' : 'high',
        category: 'capacity',
        title: 'Scale Up Infrastructure',
        description: `Current utilization is ${capacity.currentUtilizationPercent.toFixed(1)}%. Consider scaling up to maintain headroom.`,
        impact: 'Prevent potential service degradation during traffic spikes',
        currentState: `${capacity.maxConcurrentSessions.toLocaleString()} max sessions`,
        recommendedState: `${(capacity.maxConcurrentSessions * 1.5).toLocaleString()} max sessions`,
        estimatedImprovement: '50% more capacity',
        autoApplyAvailable: true,
        requiresDowntime: false,
      });
    }

    // Low utilization cost optimization
    if (capacity.currentUtilizationPercent < 20 && profile.tier !== 'development') {
      const currentCost = profile.estimatedMonthlyCost;
      const savingsTier = profile.tier === 'enterprise' ? 'production' : 'staging';
      
      recommendations.push({
        id: `rec-cost-opt-${Date.now()}`,
        priority: 'medium',
        category: 'cost',
        title: 'Reduce Infrastructure Costs',
        description: `Utilization is only ${capacity.currentUtilizationPercent.toFixed(1)}%. Consider scaling down to save costs.`,
        impact: 'Reduce monthly infrastructure costs',
        currentState: `$${currentCost.toLocaleString()}/month`,
        recommendedState: `$${(currentCost * 0.5).toLocaleString()}/month (estimated)`,
        estimatedSavings: currentCost * 0.5,
        autoApplyAvailable: true,
        requiresDowntime: false,
      });
    }

    // Provisioned concurrency recommendation
    if (profile.lambda.provisionedConcurrency === 0 && metrics.peakSessionsToday > 100) {
      recommendations.push({
        id: `rec-provisioned-${Date.now()}`,
        priority: 'medium',
        category: 'performance',
        title: 'Enable Provisioned Concurrency',
        description: 'Enable provisioned concurrency to eliminate cold starts and improve latency.',
        impact: 'Reduce P99 latency by 60-80%',
        currentState: '0 provisioned instances',
        recommendedState: '5 provisioned instances',
        estimatedImprovement: '~200ms latency reduction',
        autoApplyAvailable: true,
        requiresDowntime: false,
      });
    }

    // Unhealthy component alerts
    const unhealthyComponents = health.filter(h => h.status === 'unhealthy');
    for (const component of unhealthyComponents) {
      recommendations.push({
        id: `rec-health-${component.component}-${Date.now()}`,
        priority: 'critical',
        category: 'reliability',
        title: `Fix Unhealthy ${component.component}`,
        description: `${component.component} is reporting unhealthy status with ${component.errorRate * 100}% error rate.`,
        impact: 'Restore service reliability',
        currentState: `${component.status} - ${(component.errorRate * 100).toFixed(2)}% errors`,
        recommendedState: 'healthy - <0.1% errors',
        autoApplyAvailable: false,
        requiresDowntime: false,
      });
    }

    return recommendations;
  }

  // ============================================================================
  // COST CALCULATION HELPERS
  // ============================================================================

  private calculateLambdaCost(profile: ScalingProfile): ComponentCost {
    const provisionedCost = profile.lambda.provisionedConcurrency * 
      (profile.lambda.memoryMb / 1024) * PRICING.lambda.provisionedGbHour * 24 * 30;
    
    // Estimate on-demand usage (10% of reserved capacity)
    const estimatedInvocations = profile.lambda.reservedConcurrency * 1000 * 30; // 1000/day per concurrent
    const estimatedDurationMs = 5000; // 5 seconds average
    const onDemandCost = (estimatedInvocations / 1000000) * PRICING.lambda.requestPer1M +
      (estimatedInvocations * estimatedDurationMs / 1000) * (profile.lambda.memoryMb / 1024) * PRICING.lambda.gbSecond;

    return {
      component: 'lambda',
      baseCost: provisionedCost,
      usageCost: onDemandCost,
      totalCost: provisionedCost + onDemandCost,
      unit: 'GB-second',
      quantity: profile.lambda.provisionedConcurrency * (profile.lambda.memoryMb / 1024) * 24 * 30,
      pricePerUnit: PRICING.lambda.provisionedGbHour,
    };
  }

  private calculateAuroraCost(profile: ScalingProfile): ComponentCost {
    const avgAcu = (profile.aurora.minCapacityAcu + profile.aurora.maxCapacityAcu) / 2;
    const primaryCost = avgAcu * PRICING.aurora.acuHour * 24 * 30;
    const replicaCost = profile.aurora.readReplicaCount * avgAcu * 0.5 * PRICING.aurora.acuHour * 24 * 30;
    const globalCost = profile.aurora.enableGlobalDatabase ? 
      profile.aurora.secondaryRegions.length * primaryCost * 0.8 : 0;

    return {
      component: 'aurora',
      baseCost: primaryCost + replicaCost + globalCost,
      usageCost: 0, // IO is usage-based but hard to estimate
      totalCost: primaryCost + replicaCost + globalCost,
      unit: 'ACU-hour',
      quantity: avgAcu * 24 * 30,
      pricePerUnit: PRICING.aurora.acuHour,
    };
  }

  private calculateRedisCost(profile: ScalingProfile): ComponentCost {
    const nodePrice = PRICING.redis[profile.redis.nodeType] || 0.182;
    const nodeCount = profile.redis.numShards * (1 + profile.redis.replicasPerShard);
    const primaryCost = nodeCount * nodePrice * 24 * 30;
    const globalCost = profile.redis.enableGlobalDatastore ?
      profile.redis.secondaryRegions.length * primaryCost * 0.5 : 0;

    return {
      component: 'redis',
      baseCost: primaryCost + globalCost,
      usageCost: 0,
      totalCost: primaryCost + globalCost,
      unit: 'node-hour',
      quantity: nodeCount * 24 * 30,
      pricePerUnit: nodePrice,
    };
  }

  private calculateApiGatewayCost(profile: ScalingProfile): ComponentCost {
    // Estimate 10% average utilization of rate limit
    const estimatedRequests = profile.apiGateway.throttlingRateLimit * 0.1 * 3600 * 24 * 30;
    const requestCost = (estimatedRequests / 1000000) * PRICING.apiGateway.httpApiPer1M;

    return {
      component: 'apiGateway',
      baseCost: 0,
      usageCost: requestCost,
      totalCost: requestCost,
      unit: 'million requests',
      quantity: estimatedRequests / 1000000,
      pricePerUnit: PRICING.apiGateway.httpApiPer1M,
    };
  }

  private calculateSqsCost(profile: ScalingProfile): ComponentCost {
    // Estimate 1M messages per queue per month
    const standardCost = profile.sqs.standardQueueCount * 1 * PRICING.sqs.requestPer1M;
    const fifoCost = profile.sqs.fifoQueueCount * 1 * PRICING.sqs.fifoRequestPer1M;

    return {
      component: 'sqs',
      baseCost: 0,
      usageCost: standardCost + fifoCost,
      totalCost: standardCost + fifoCost,
      unit: 'million requests',
      quantity: profile.sqs.standardQueueCount + profile.sqs.fifoQueueCount,
      pricePerUnit: PRICING.sqs.requestPer1M,
    };
  }

  private calculateCloudFrontCost(profile: ScalingProfile): ComponentCost {
    if (!profile.apiGateway.enableCloudFront) {
      return { component: 'cloudFront', baseCost: 0, usageCost: 0, totalCost: 0, unit: 'GB', quantity: 0, pricePerUnit: 0 };
    }

    // Estimate based on API request volume
    const estimatedRequests = profile.apiGateway.throttlingRateLimit * 0.1 * 3600 * 24 * 30;
    const requestCost = (estimatedRequests / 10000) * PRICING.cloudFront.requestPer10K;
    const dataTransferGb = estimatedRequests * 0.0001; // 100KB average response
    const dataCost = dataTransferGb * PRICING.cloudFront.dataTransferGb;

    return {
      component: 'cloudFront',
      baseCost: 0,
      usageCost: requestCost + dataCost,
      totalCost: requestCost + dataCost,
      unit: 'GB',
      quantity: dataTransferGb,
      pricePerUnit: PRICING.cloudFront.dataTransferGb,
    };
  }

  private calculateDataTransferCost(profile: ScalingProfile): ComponentCost {
    // Estimate inter-region data transfer for global deployments
    const regionCount = profile.aurora.enableGlobalDatabase ? profile.aurora.secondaryRegions.length : 0;
    const estimatedGb = regionCount * 100; // 100GB/month per region
    const cost = estimatedGb * PRICING.dataTransfer.interRegionGb;

    return {
      component: 'dataTransfer',
      baseCost: 0,
      usageCost: cost,
      totalCost: cost,
      unit: 'GB',
      quantity: estimatedGb,
      pricePerUnit: PRICING.dataTransfer.interRegionGb,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async getProfileById(tenantId: string, profileId: string): Promise<ScalingProfile | null> {
    const result = await executeStatement(
      `SELECT * FROM sovereign_mesh_scaling_profiles WHERE tenant_id = :tenantId AND id = :profileId`,
      [stringParam('tenantId', tenantId), stringParam('profileId', profileId)]
    );
    return result.rows?.[0] ? this.rowToProfile(result.rows[0]) : null;
  }

  private async activateProfile(tenantId: string, profileId: string, operationId: string): Promise<void> {
    await executeStatement(
      `UPDATE sovereign_mesh_scaling_profiles SET is_active = false WHERE tenant_id = :tenantId`,
      [stringParam('tenantId', tenantId)]
    );
    await executeStatement(
      `UPDATE sovereign_mesh_scaling_profiles SET is_active = true WHERE id = :profileId`,
      [stringParam('profileId', profileId)]
    );
    await executeStatement(
      `UPDATE sovereign_mesh_scaling_operations SET status = 'completed', completed_at = NOW() WHERE id = :opId`,
      [stringParam('opId', operationId)]
    );
  }

  private calculateChanges(current: ScalingProfile, target: ScalingProfile): Array<{ component: string; setting: string; oldValue: any; newValue: any }> {
    const changes: Array<{ component: string; setting: string; oldValue: any; newValue: any }> = [];

    // Lambda changes
    if (current.lambda.maxConcurrency !== target.lambda.maxConcurrency) {
      changes.push({ component: 'lambda', setting: 'maxConcurrency', oldValue: current.lambda.maxConcurrency, newValue: target.lambda.maxConcurrency });
    }
    if (current.lambda.provisionedConcurrency !== target.lambda.provisionedConcurrency) {
      changes.push({ component: 'lambda', setting: 'provisionedConcurrency', oldValue: current.lambda.provisionedConcurrency, newValue: target.lambda.provisionedConcurrency });
    }

    // Aurora changes
    if (current.aurora.maxCapacityAcu !== target.aurora.maxCapacityAcu) {
      changes.push({ component: 'aurora', setting: 'maxCapacityAcu', oldValue: current.aurora.maxCapacityAcu, newValue: target.aurora.maxCapacityAcu });
    }
    if (current.aurora.enableGlobalDatabase !== target.aurora.enableGlobalDatabase) {
      changes.push({ component: 'aurora', setting: 'enableGlobalDatabase', oldValue: current.aurora.enableGlobalDatabase, newValue: target.aurora.enableGlobalDatabase });
    }

    // Redis changes
    if (current.redis.numShards !== target.redis.numShards) {
      changes.push({ component: 'redis', setting: 'numShards', oldValue: current.redis.numShards, newValue: target.redis.numShards });
    }

    return changes;
  }

  private estimateOperationDuration(changes: Array<{ component: string; setting: string; oldValue: any; newValue: any }>): number {
    let duration = 60; // Base 60 seconds
    for (const change of changes) {
      if (change.component === 'aurora' && change.setting.includes('global')) {
        duration += 1800; // 30 minutes for global database
      } else if (change.component === 'redis' && change.setting === 'numShards') {
        duration += 600; // 10 minutes for resharding
      } else {
        duration += 120; // 2 minutes for other changes
      }
    }
    return duration;
  }

  private rowToProfile(row: Record<string, unknown>): ScalingProfile {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      tier: row.tier as ScalingTier,
      targetSessions: parseInt(row.target_sessions as string, 10),
      lambda: {
        reservedConcurrency: parseInt(row.lambda_reserved_concurrency as string, 10),
        provisionedConcurrency: parseInt(row.lambda_provisioned_concurrency as string, 10),
        maxConcurrency: parseInt(row.lambda_max_concurrency as string, 10),
        memoryMb: parseInt(row.lambda_memory_mb as string, 10),
        timeoutSeconds: parseInt(row.lambda_timeout_seconds as string, 10),
        ephemeralStorageMb: parseInt(row.lambda_ephemeral_storage_mb as string, 10),
        snapStartEnabled: row.lambda_snap_start_enabled as boolean,
      },
      aurora: {
        minCapacityAcu: parseFloat(row.aurora_min_capacity_acu as string),
        maxCapacityAcu: parseFloat(row.aurora_max_capacity_acu as string),
        readReplicaCount: parseInt(row.aurora_read_replica_count as string, 10),
        enableGlobalDatabase: row.aurora_enable_global_database as boolean,
        secondaryRegions: (row.aurora_secondary_regions as string[]) || [],
        connectionPoolSize: parseInt(row.aurora_connection_pool_size as string, 10),
        enablePgBouncer: row.aurora_enable_pgbouncer as boolean,
      },
      redis: {
        nodeType: row.redis_node_type as string,
        numShards: parseInt(row.redis_num_shards as string, 10),
        replicasPerShard: parseInt(row.redis_replicas_per_shard as string, 10),
        enableClusterMode: row.redis_enable_cluster_mode as boolean,
        enableGlobalDatastore: row.redis_enable_global_datastore as boolean,
        secondaryRegions: (row.redis_secondary_regions as string[]) || [],
        maxConnections: parseInt(row.redis_max_connections as string, 10),
      },
      apiGateway: {
        throttlingRateLimit: parseInt(row.api_throttling_rate_limit as string, 10),
        throttlingBurstLimit: parseInt(row.api_throttling_burst_limit as string, 10),
        enableEdgeOptimized: row.api_enable_edge_optimized as boolean,
        enableCloudFront: row.api_enable_cloudfront as boolean,
        regionalEndpoints: (row.api_regional_endpoints as string[]) || ['us-east-1'],
      },
      sqs: {
        standardQueueCount: parseInt(row.sqs_standard_queue_count as string, 10),
        fifoQueueCount: parseInt(row.sqs_fifo_queue_count as string, 10),
        maxMessageSize: parseInt(row.sqs_max_message_size as string, 10),
        visibilityTimeoutSeconds: parseInt(row.sqs_visibility_timeout_seconds as string, 10),
        messageRetentionDays: parseInt(row.sqs_message_retention_days as string, 10),
        enableBatching: row.sqs_enable_batching as boolean,
        batchSize: parseInt(row.sqs_batch_size as string, 10),
      },
      estimatedMonthlyCost: parseFloat(row.estimated_monthly_cost as string) || 0,
      isDefault: row.is_default as boolean,
      isCustom: row.is_custom as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private rowToOperation(row: Record<string, unknown>): ScalingOperation {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      operationType: row.operation_type as any,
      status: row.status as any,
      sourceProfile: row.source_profile_id as string,
      targetProfile: row.target_profile_id as string,
      changes: (row.changes as any[]) || [],
      estimatedDuration: parseInt(row.estimated_duration_seconds as string, 10) || 0,
      actualDuration: row.actual_duration_seconds ? parseInt(row.actual_duration_seconds as string, 10) : undefined,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
      initiatedBy: row.initiated_by as string,
      approvedBy: row.approved_by as string | undefined,
      error: row.error_message as string | undefined,
      rollbackAvailable: row.rollback_available as boolean,
    };
  }
}

export const scalingService = new ScalingService();
