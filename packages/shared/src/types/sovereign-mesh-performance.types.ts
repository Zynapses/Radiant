/**
 * RADIANT v5.38.0 - Sovereign Mesh Performance Types
 * 
 * Types for performance optimization, scaling configuration, caching,
 * and resource management for the Sovereign Mesh infrastructure.
 */

// ============================================================================
// SCALING CONFIGURATION
// ============================================================================

export type ScalingStrategy = 'fixed' | 'auto' | 'scheduled';
export type TenantIsolationMode = 'shared' | 'dedicated' | 'fifo';
export type CacheBackend = 'memory' | 'redis' | 'elasticache';
export type ArtifactStorageBackend = 'database' | 's3' | 'hybrid';

export interface LambdaConcurrencyConfig {
  /** Reserved concurrency (0 = unreserved, uses account default) */
  reservedConcurrency: number;
  /** Provisioned concurrency for warm starts (0 = disabled) */
  provisionedConcurrency: number;
  /** Maximum concurrent executions per SQS event source */
  maxConcurrency: number;
  /** Memory allocation in MB */
  memoryMb: number;
  /** Timeout in seconds */
  timeoutSeconds: number;
}

export interface QueueConfig {
  /** Visibility timeout in seconds */
  visibilityTimeoutSeconds: number;
  /** Message retention period in days */
  retentionDays: number;
  /** Dead letter queue max receive count before DLQ */
  maxReceiveCount: number;
  /** Batch size for Lambda processing */
  batchSize: number;
  /** Enable FIFO queue for ordering guarantees */
  fifoEnabled: boolean;
  /** Content-based deduplication (FIFO only) */
  contentBasedDeduplication: boolean;
}

export interface ScalingConfig {
  strategy: ScalingStrategy;
  /** Minimum instances (for auto scaling) */
  minInstances: number;
  /** Maximum instances (for auto scaling) */
  maxInstances: number;
  /** Target utilization percentage (for auto scaling) */
  targetUtilization: number;
  /** Scale-in cooldown in seconds */
  scaleInCooldownSeconds: number;
  /** Scale-out cooldown in seconds */
  scaleOutCooldownSeconds: number;
}

// ============================================================================
// CACHING CONFIGURATION
// ============================================================================

export interface CacheConfig {
  backend: CacheBackend;
  /** Redis/ElastiCache connection string (if applicable) */
  connectionString?: string;
  /** Default TTL in seconds */
  defaultTtlSeconds: number;
  /** Maximum entries for in-memory cache */
  maxEntries: number;
  /** Enable compression for large values */
  compressionEnabled: boolean;
  /** Compression threshold in bytes */
  compressionThresholdBytes: number;
}

export interface AgentCacheConfig extends CacheConfig {
  /** TTL for agent definitions */
  agentTtlSeconds: number;
  /** TTL for execution state */
  executionStateTtlSeconds: number;
  /** TTL for working memory */
  workingMemoryTtlSeconds: number;
  /** Enable cache warming on startup */
  warmOnStartup: boolean;
}

export interface ExecutionCacheConfig extends CacheConfig {
  /** Cache hot execution state in Redis */
  hotStateCacheEnabled: boolean;
  /** Write-through to database */
  writeThroughEnabled: boolean;
  /** Write-behind delay in milliseconds */
  writeBehindDelayMs: number;
  /** Batch size for write-behind */
  writeBehindBatchSize: number;
}

// ============================================================================
// ARTIFACT ARCHIVAL
// ============================================================================

export interface ArtifactArchivalConfig {
  /** Storage backend for artifacts */
  storageBackend: ArtifactStorageBackend;
  /** S3 bucket name (if using S3) */
  s3Bucket?: string;
  /** S3 prefix for artifacts */
  s3Prefix?: string;
  /** Archive completed executions after N days */
  archiveAfterDays: number;
  /** Delete archived artifacts after N days (0 = never) */
  deleteAfterDays: number;
  /** Maximum artifact size in bytes before forcing S3 */
  maxDbArtifactBytes: number;
  /** Enable compression for archived artifacts */
  compressionEnabled: boolean;
  /** Compression algorithm */
  compressionAlgorithm: 'gzip' | 'lz4' | 'zstd';
}

// ============================================================================
// DATABASE OPTIMIZATION
// ============================================================================

export interface DatabasePoolConfig {
  /** Minimum pool size */
  minConnections: number;
  /** Maximum pool size */
  maxConnections: number;
  /** Connection idle timeout in seconds */
  idleTimeoutSeconds: number;
  /** Connection acquire timeout in seconds */
  acquireTimeoutSeconds: number;
  /** Enable RDS Proxy */
  rdsProxyEnabled: boolean;
  /** RDS Proxy endpoint (if enabled) */
  rdsProxyEndpoint?: string;
}

export interface DatabaseIndexConfig {
  /** Index on (tenant_id, status) for agent_executions */
  tenantStatusIndexEnabled: boolean;
  /** Index on (agent_id, status) for agent_executions */
  agentStatusIndexEnabled: boolean;
  /** Index on (created_at) for time-based queries */
  createdAtIndexEnabled: boolean;
  /** Partial index on running executions only */
  runningExecutionsPartialIndexEnabled: boolean;
  /** BRIN index for time-series data */
  brinIndexEnabled: boolean;
}

// ============================================================================
// TENANT ISOLATION
// ============================================================================

export interface TenantIsolationConfig {
  mode: TenantIsolationMode;
  /** Create dedicated queues for high-volume tenants */
  dedicatedQueueThreshold: number;
  /** Enable per-tenant rate limiting */
  rateLimitingEnabled: boolean;
  /** Max concurrent executions per tenant */
  maxConcurrentPerTenant: number;
  /** Max concurrent executions per user */
  maxConcurrentPerUser: number;
  /** Priority queue for premium tenants */
  priorityQueueEnabled: boolean;
}

// ============================================================================
// METRICS & OBSERVABILITY
// ============================================================================

export interface MetricsConfig {
  /** Enable CloudWatch custom metrics */
  cloudWatchEnabled: boolean;
  /** CloudWatch metrics namespace */
  cloudWatchNamespace: string;
  /** Enable X-Ray tracing */
  xrayEnabled: boolean;
  /** X-Ray sampling rate (0.0 - 1.0) */
  xraySamplingRate: number;
  /** Enable detailed OODA phase metrics */
  oodaPhaseMetricsEnabled: boolean;
  /** Metrics flush interval in seconds */
  flushIntervalSeconds: number;
}

export interface MeshAlertConfig {
  /** Alert on DLQ messages */
  dlqAlertEnabled: boolean;
  /** DLQ message threshold for alert */
  dlqAlertThreshold: number;
  /** Alert on high latency */
  latencyAlertEnabled: boolean;
  /** Latency threshold in milliseconds */
  latencyAlertThresholdMs: number;
  /** Alert on budget exhaustion */
  budgetAlertEnabled: boolean;
  /** Budget exhaustion threshold percentage */
  budgetAlertThresholdPercent: number;
  /** SNS topic ARN for alerts */
  alertSnsTopicArn?: string;
}

// ============================================================================
// MAIN CONFIGURATION
// ============================================================================

export interface SovereignMeshPerformanceConfig {
  id: string;
  tenantId: string;
  
  // Lambda Configuration
  agentWorkerConfig: LambdaConcurrencyConfig;
  transparencyWorkerConfig: LambdaConcurrencyConfig;
  
  // Queue Configuration
  agentExecutionQueueConfig: QueueConfig;
  transparencyQueueConfig: QueueConfig;
  
  // Scaling Configuration
  scalingConfig: ScalingConfig;
  
  // Caching Configuration
  agentCacheConfig: AgentCacheConfig;
  executionCacheConfig: ExecutionCacheConfig;
  
  // Artifact Archival
  artifactArchivalConfig: ArtifactArchivalConfig;
  
  // Database Optimization
  databasePoolConfig: DatabasePoolConfig;
  databaseIndexConfig: DatabaseIndexConfig;
  
  // Tenant Isolation
  tenantIsolationConfig: TenantIsolationConfig;
  
  // Metrics & Observability
  metricsConfig: MetricsConfig;
  alertConfig: MeshAlertConfig;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export const DEFAULT_AGENT_WORKER_CONFIG: LambdaConcurrencyConfig = {
  reservedConcurrency: 0,
  provisionedConcurrency: 5,
  maxConcurrency: 50,
  memoryMb: 2048,
  timeoutSeconds: 900, // 15 minutes
};

export const DEFAULT_TRANSPARENCY_WORKER_CONFIG: LambdaConcurrencyConfig = {
  reservedConcurrency: 0,
  provisionedConcurrency: 0,
  maxConcurrency: 20,
  memoryMb: 512,
  timeoutSeconds: 300, // 5 minutes
};

export const DEFAULT_AGENT_EXECUTION_QUEUE_CONFIG: QueueConfig = {
  visibilityTimeoutSeconds: 900,
  retentionDays: 7,
  maxReceiveCount: 3,
  batchSize: 1,
  fifoEnabled: false,
  contentBasedDeduplication: false,
};

export const DEFAULT_TRANSPARENCY_QUEUE_CONFIG: QueueConfig = {
  visibilityTimeoutSeconds: 300,
  retentionDays: 7,
  maxReceiveCount: 3,
  batchSize: 5,
  fifoEnabled: false,
  contentBasedDeduplication: false,
};

export const DEFAULT_SCALING_CONFIG: ScalingConfig = {
  strategy: 'auto',
  minInstances: 1,
  maxInstances: 100,
  targetUtilization: 70,
  scaleInCooldownSeconds: 300,
  scaleOutCooldownSeconds: 60,
};

export const DEFAULT_AGENT_CACHE_CONFIG: AgentCacheConfig = {
  backend: 'redis',
  defaultTtlSeconds: 3600,
  maxEntries: 10000,
  compressionEnabled: true,
  compressionThresholdBytes: 1024,
  agentTtlSeconds: 300,
  executionStateTtlSeconds: 3600,
  workingMemoryTtlSeconds: 86400,
  warmOnStartup: true,
};

export const DEFAULT_EXECUTION_CACHE_CONFIG: ExecutionCacheConfig = {
  backend: 'redis',
  defaultTtlSeconds: 3600,
  maxEntries: 50000,
  compressionEnabled: true,
  compressionThresholdBytes: 1024,
  hotStateCacheEnabled: true,
  writeThroughEnabled: false,
  writeBehindDelayMs: 1000,
  writeBehindBatchSize: 100,
};

export const DEFAULT_ARTIFACT_ARCHIVAL_CONFIG: ArtifactArchivalConfig = {
  storageBackend: 'hybrid',
  archiveAfterDays: 7,
  deleteAfterDays: 90,
  maxDbArtifactBytes: 65536, // 64KB
  compressionEnabled: true,
  compressionAlgorithm: 'gzip',
};

export const DEFAULT_DATABASE_POOL_CONFIG: DatabasePoolConfig = {
  minConnections: 2,
  maxConnections: 20,
  idleTimeoutSeconds: 300,
  acquireTimeoutSeconds: 30,
  rdsProxyEnabled: true,
};

export const DEFAULT_DATABASE_INDEX_CONFIG: DatabaseIndexConfig = {
  tenantStatusIndexEnabled: true,
  agentStatusIndexEnabled: true,
  createdAtIndexEnabled: true,
  runningExecutionsPartialIndexEnabled: true,
  brinIndexEnabled: false,
};

export const DEFAULT_TENANT_ISOLATION_CONFIG: TenantIsolationConfig = {
  mode: 'shared',
  dedicatedQueueThreshold: 1000,
  rateLimitingEnabled: true,
  maxConcurrentPerTenant: 50,
  maxConcurrentPerUser: 10,
  priorityQueueEnabled: false,
};

export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  cloudWatchEnabled: true,
  cloudWatchNamespace: 'RADIANT/SovereignMesh',
  xrayEnabled: true,
  xraySamplingRate: 0.1,
  oodaPhaseMetricsEnabled: true,
  flushIntervalSeconds: 60,
};

export const DEFAULT_ALERT_CONFIG: MeshAlertConfig = {
  dlqAlertEnabled: true,
  dlqAlertThreshold: 10,
  latencyAlertEnabled: true,
  latencyAlertThresholdMs: 30000,
  budgetAlertEnabled: true,
  budgetAlertThresholdPercent: 80,
};

export function getDefaultPerformanceConfig(tenantId: string): Omit<SovereignMeshPerformanceConfig, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    tenantId,
    agentWorkerConfig: { ...DEFAULT_AGENT_WORKER_CONFIG },
    transparencyWorkerConfig: { ...DEFAULT_TRANSPARENCY_WORKER_CONFIG },
    agentExecutionQueueConfig: { ...DEFAULT_AGENT_EXECUTION_QUEUE_CONFIG },
    transparencyQueueConfig: { ...DEFAULT_TRANSPARENCY_QUEUE_CONFIG },
    scalingConfig: { ...DEFAULT_SCALING_CONFIG },
    agentCacheConfig: { ...DEFAULT_AGENT_CACHE_CONFIG },
    executionCacheConfig: { ...DEFAULT_EXECUTION_CACHE_CONFIG },
    artifactArchivalConfig: { ...DEFAULT_ARTIFACT_ARCHIVAL_CONFIG },
    databasePoolConfig: { ...DEFAULT_DATABASE_POOL_CONFIG },
    databaseIndexConfig: { ...DEFAULT_DATABASE_INDEX_CONFIG },
    tenantIsolationConfig: { ...DEFAULT_TENANT_ISOLATION_CONFIG },
    metricsConfig: { ...DEFAULT_METRICS_CONFIG },
    alertConfig: { ...DEFAULT_ALERT_CONFIG },
  };
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export interface OODAPhaseMetrics {
  phase: 'observe' | 'orient' | 'decide' | 'act' | 'report';
  executionCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  errorCount: number;
  errorRate: number;
}

export interface ExecutionThroughputMetrics {
  period: 'minute' | 'hour' | 'day';
  startTime: Date;
  endTime: Date;
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  avgIterationsPerExecution: number;
  avgDurationSeconds: number;
  throughputPerSecond: number;
}

export interface QueueMetrics {
  queueName: string;
  approximateMessages: number;
  approximateMessagesNotVisible: number;
  approximateMessagesDelayed: number;
  oldestMessageAgeSeconds: number;
  dlqMessages: number;
}

export interface MeshCacheMetrics {
  backend: CacheBackend;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  memoryUsageBytes: number;
  connectionCount: number;
  avgLatencyMs: number;
}

export interface PerformanceDashboard {
  tenantId: string;
  generatedAt: Date;
  
  // Overall health
  healthScore: number; // 0-100
  healthStatus: 'healthy' | 'degraded' | 'critical';
  
  // Execution metrics
  activeExecutions: number;
  pendingExecutions: number;
  executionsLast24h: number;
  avgExecutionDurationSeconds: number;
  
  // Queue metrics
  agentQueueMetrics: QueueMetrics;
  transparencyQueueMetrics: QueueMetrics;
  
  // Cache metrics
  agentCacheMetrics: MeshCacheMetrics;
  executionCacheMetrics: MeshCacheMetrics;
  
  // OODA phase breakdown
  oodaPhaseMetrics: OODAPhaseMetrics[];
  
  // Throughput
  throughputMetrics: ExecutionThroughputMetrics;
  
  // Alerts
  activeAlerts: PerformanceAlert[];
  
  // Cost
  estimatedMonthlyCost: number;
  costBreakdown: {
    lambdaCost: number;
    sqsCost: number;
    cacheCost: number;
    storageCost: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'dlq_threshold' | 'latency_threshold' | 'budget_threshold' | 'error_rate' | 'queue_backlog';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface UpdatePerformanceConfigRequest {
  agentWorkerConfig?: Partial<LambdaConcurrencyConfig>;
  transparencyWorkerConfig?: Partial<LambdaConcurrencyConfig>;
  agentExecutionQueueConfig?: Partial<QueueConfig>;
  transparencyQueueConfig?: Partial<QueueConfig>;
  scalingConfig?: Partial<ScalingConfig>;
  agentCacheConfig?: Partial<AgentCacheConfig>;
  executionCacheConfig?: Partial<ExecutionCacheConfig>;
  artifactArchivalConfig?: Partial<ArtifactArchivalConfig>;
  databasePoolConfig?: Partial<DatabasePoolConfig>;
  databaseIndexConfig?: Partial<DatabaseIndexConfig>;
  tenantIsolationConfig?: Partial<TenantIsolationConfig>;
  metricsConfig?: Partial<MetricsConfig>;
  alertConfig?: Partial<MeshAlertConfig>;
}

export interface PerformanceConfigResponse {
  config: SovereignMeshPerformanceConfig;
  effectiveConfig: SovereignMeshPerformanceConfig;
  pendingChanges: string[];
  lastAppliedAt?: Date;
}

export interface ApplyConfigResponse {
  success: boolean;
  appliedChanges: string[];
  failedChanges: { change: string; error: string }[];
  rollbackAvailable: boolean;
}

export interface PerformanceRecommendation {
  id: string;
  category: 'scaling' | 'caching' | 'database' | 'queue' | 'cost';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  currentValue: string;
  recommendedValue: string;
  estimatedImpact: string;
  autoApplyAvailable: boolean;
}

export interface PerformanceRecommendationsResponse {
  recommendations: PerformanceRecommendation[];
  generatedAt: Date;
  basedOnDataFrom: Date;
  basedOnDataTo: Date;
}
