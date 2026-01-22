/**
 * RADIANT v5.38.0 - Sovereign Mesh Scaling Types
 * 
 * Comprehensive types for infrastructure scaling configuration,
 * session management, cost estimation, and capacity planning.
 */

// ============================================================================
// SCALING TIERS
// ============================================================================

export type ScalingTier = 'development' | 'staging' | 'production' | 'enterprise';

export type ScalingMode = 'manual' | 'auto' | 'scheduled' | 'predictive';

export type RegionCode = 
  | 'us-east-1' | 'us-east-2' | 'us-west-1' | 'us-west-2'
  | 'eu-west-1' | 'eu-west-2' | 'eu-central-1'
  | 'ap-southeast-1' | 'ap-southeast-2' | 'ap-northeast-1' | 'ap-northeast-2'
  | 'sa-east-1';

// ============================================================================
// CAPACITY CONFIGURATION
// ============================================================================

export interface LambdaCapacityConfig {
  reservedConcurrency: number;
  provisionedConcurrency: number;
  maxConcurrency: number;
  memoryMb: number;
  timeoutSeconds: number;
  ephemeralStorageMb: number;
  snapStartEnabled: boolean;
}

export interface AuroraCapacityConfig {
  minCapacityAcu: number;
  maxCapacityAcu: number;
  readReplicaCount: number;
  enableGlobalDatabase: boolean;
  secondaryRegions: RegionCode[];
  connectionPoolSize: number;
  enablePgBouncer: boolean;
}

export interface RedisCapacityConfig {
  nodeType: string;
  numShards: number;
  replicasPerShard: number;
  enableClusterMode: boolean;
  enableGlobalDatastore: boolean;
  secondaryRegions: RegionCode[];
  maxConnections: number;
}

export interface ApiGatewayCapacityConfig {
  throttlingRateLimit: number;
  throttlingBurstLimit: number;
  enableEdgeOptimized: boolean;
  enableCloudFront: boolean;
  regionalEndpoints: RegionCode[];
}

export interface SqsCapacityConfig {
  standardQueueCount: number;
  fifoQueueCount: number;
  maxMessageSize: number;
  visibilityTimeoutSeconds: number;
  messageRetentionDays: number;
  enableBatching: boolean;
  batchSize: number;
}

// ============================================================================
// SCALING PROFILE
// ============================================================================

export interface ScalingProfile {
  id: string;
  name: string;
  description: string;
  tier: ScalingTier;
  targetSessions: number;
  lambda: LambdaCapacityConfig;
  aurora: AuroraCapacityConfig;
  redis: RedisCapacityConfig;
  apiGateway: ApiGatewayCapacityConfig;
  sqs: SqsCapacityConfig;
  estimatedMonthlyCost: number;
  isDefault: boolean;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScalingProfilePreset {
  tier: ScalingTier;
  name: string;
  targetSessions: number;
  description: string;
  monthlyCost: number;
}

export const SCALING_PROFILE_PRESETS: ScalingProfilePreset[] = [
  {
    tier: 'development',
    name: 'Development',
    targetSessions: 100,
    description: 'Scale-to-zero, minimal cost for development and testing',
    monthlyCost: 70,
  },
  {
    tier: 'staging',
    name: 'Staging',
    targetSessions: 1000,
    description: 'Low-cost staging environment with basic redundancy',
    monthlyCost: 500,
  },
  {
    tier: 'production',
    name: 'Production',
    targetSessions: 10000,
    description: 'Production-ready with high availability',
    monthlyCost: 5000,
  },
  {
    tier: 'enterprise',
    name: 'Enterprise (500K)',
    targetSessions: 500000,
    description: 'Multi-region, global scale with maximum redundancy',
    monthlyCost: 68500,
  },
];

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export interface SessionMetrics {
  currentActiveSessions: number;
  peakSessionsToday: number;
  peakSessionsWeek: number;
  peakSessionsMonth: number;
  avgSessionDurationSeconds: number;
  sessionsLast1Hour: number;
  sessionsLast24Hours: number;
  sessionsLast7Days: number;
  sessionsLast30Days: number;
  sessionsByRegion: Record<RegionCode, number>;
  sessionsByTenant: Array<{ tenantId: string; tenantName: string; sessions: number }>;
}

export interface SessionCapacity {
  maxConcurrentSessions: number;
  currentUtilizationPercent: number;
  headroomSessions: number;
  estimatedTimeToCapacity: string | null;
  bottleneck: 'lambda' | 'aurora' | 'redis' | 'api_gateway' | 'sqs' | 'none';
  bottleneckUtilization: number;
}

export interface SessionTrend {
  timestamp: string;
  activeSessions: number;
  newSessions: number;
  completedSessions: number;
  failedSessions: number;
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

export interface ComponentCost {
  component: string;
  baseCost: number;
  usageCost: number;
  totalCost: number;
  unit: string;
  quantity: number;
  pricePerUnit: number;
}

export interface ScalingCostEstimate {
  profileId: string;
  tier: ScalingTier;
  targetSessions: number;
  components: {
    lambda: ComponentCost;
    aurora: ComponentCost;
    redis: ComponentCost;
    apiGateway: ComponentCost;
    sqs: ComponentCost;
    cloudFront: ComponentCost;
    dataTransfer: ComponentCost;
  };
  totalMonthlyCost: number;
  costPerSession: number;
  costPer1000Sessions: number;
  savingsVsOnDemand: number;
  savingsPercent: number;
}

export interface CostBreakdown {
  category: string;
  items: Array<{
    name: string;
    description: string;
    monthlyCost: number;
    hourlyCost: number;
    isProvisioned: boolean;
    scalesWithUsage: boolean;
  }>;
  subtotal: number;
}

// ============================================================================
// SCALING OPERATIONS
// ============================================================================

export type ScalingOperationType = 
  | 'scale_up' 
  | 'scale_down' 
  | 'scale_out' 
  | 'scale_in'
  | 'provision'
  | 'deprovision'
  | 'migrate_region'
  | 'enable_feature'
  | 'disable_feature';

export type ScalingOperationStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

export interface ScalingOperation {
  id: string;
  tenantId: string;
  operationType: ScalingOperationType;
  status: ScalingOperationStatus;
  sourceProfile: string;
  targetProfile: string;
  changes: Array<{
    component: string;
    setting: string;
    oldValue: string | number;
    newValue: string | number;
  }>;
  estimatedDuration: number;
  actualDuration?: number;
  startedAt: string;
  completedAt?: string;
  initiatedBy: string;
  approvedBy?: string;
  error?: string;
  rollbackAvailable: boolean;
}

// ============================================================================
// AUTO-SCALING RULES
// ============================================================================

export interface AutoScalingRule {
  id: string;
  name: string;
  enabled: boolean;
  metric: 'session_count' | 'cpu_utilization' | 'memory_utilization' | 'queue_depth' | 'latency_p99';
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  duration: number;
  action: ScalingOperationType;
  targetValue?: number;
  cooldownSeconds: number;
  minCapacity?: number;
  maxCapacity?: number;
}

export interface ScheduledScalingRule {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  timezone: string;
  targetProfile: string;
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

// ============================================================================
// SCALING DASHBOARD
// ============================================================================

export interface ScalingDashboard {
  tenantId: string;
  generatedAt: string;
  currentProfile: ScalingProfile;
  sessionMetrics: SessionMetrics;
  sessionCapacity: SessionCapacity;
  sessionTrends: SessionTrend[];
  costEstimate: ScalingCostEstimate;
  recentOperations: ScalingOperation[];
  activeAlerts: ScalingAlert[];
  recommendations: ScalingRecommendation[];
  componentHealth: ComponentHealth[];
}

export interface ComponentHealth {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  utilization: number;
  capacity: number;
  latencyMs: number;
  errorRate: number;
  lastChecked: string;
}

export interface ScalingAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  component: string;
  metric: string;
  currentValue: number;
  threshold: number;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface ScalingRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'cost' | 'performance' | 'reliability' | 'capacity';
  title: string;
  description: string;
  impact: string;
  currentState: string;
  recommendedState: string;
  estimatedSavings?: number;
  estimatedImprovement?: string;
  autoApplyAvailable: boolean;
  requiresDowntime: boolean;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface GetScalingDashboardRequest {
  tenantId: string;
  includeHistory?: boolean;
  historyHours?: number;
}

export interface UpdateScalingProfileRequest {
  profileId?: string;
  tier?: ScalingTier;
  targetSessions?: number;
  lambda?: Partial<LambdaCapacityConfig>;
  aurora?: Partial<AuroraCapacityConfig>;
  redis?: Partial<RedisCapacityConfig>;
  apiGateway?: Partial<ApiGatewayCapacityConfig>;
  sqs?: Partial<SqsCapacityConfig>;
}

export interface ApplyScalingProfileRequest {
  profileId: string;
  scheduledAt?: string;
  requiresApproval?: boolean;
  rollbackOnFailure?: boolean;
}

export interface ApplyScalingProfileResponse {
  success: boolean;
  operationId: string;
  estimatedDuration: number;
  changes: Array<{ component: string; setting: string; oldValue: string; newValue: string }>;
  requiresApproval: boolean;
  error?: string;
}

export interface EstimateCostRequest {
  targetSessions: number;
  tier?: ScalingTier;
  customConfig?: Partial<UpdateScalingProfileRequest>;
}

export interface EstimateCostResponse {
  estimate: ScalingCostEstimate;
  breakdown: CostBreakdown[];
  comparisonToCurrentCost: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS BY TIER
// ============================================================================

export const DEFAULT_LAMBDA_CONFIG: Record<ScalingTier, LambdaCapacityConfig> = {
  development: {
    reservedConcurrency: 0,
    provisionedConcurrency: 0,
    maxConcurrency: 10,
    memoryMb: 1024,
    timeoutSeconds: 300,
    ephemeralStorageMb: 512,
    snapStartEnabled: false,
  },
  staging: {
    reservedConcurrency: 10,
    provisionedConcurrency: 0,
    maxConcurrency: 50,
    memoryMb: 2048,
    timeoutSeconds: 600,
    ephemeralStorageMb: 512,
    snapStartEnabled: false,
  },
  production: {
    reservedConcurrency: 100,
    provisionedConcurrency: 5,
    maxConcurrency: 200,
    memoryMb: 2048,
    timeoutSeconds: 900,
    ephemeralStorageMb: 1024,
    snapStartEnabled: true,
  },
  enterprise: {
    reservedConcurrency: 1000,
    provisionedConcurrency: 100,
    maxConcurrency: 1000,
    memoryMb: 3072,
    timeoutSeconds: 900,
    ephemeralStorageMb: 2048,
    snapStartEnabled: true,
  },
};

export const DEFAULT_AURORA_CONFIG: Record<ScalingTier, AuroraCapacityConfig> = {
  development: {
    minCapacityAcu: 0.5,
    maxCapacityAcu: 2,
    readReplicaCount: 0,
    enableGlobalDatabase: false,
    secondaryRegions: [],
    connectionPoolSize: 20,
    enablePgBouncer: false,
  },
  staging: {
    minCapacityAcu: 1,
    maxCapacityAcu: 8,
    readReplicaCount: 1,
    enableGlobalDatabase: false,
    secondaryRegions: [],
    connectionPoolSize: 50,
    enablePgBouncer: false,
  },
  production: {
    minCapacityAcu: 4,
    maxCapacityAcu: 64,
    readReplicaCount: 2,
    enableGlobalDatabase: false,
    secondaryRegions: [],
    connectionPoolSize: 200,
    enablePgBouncer: true,
  },
  enterprise: {
    minCapacityAcu: 16,
    maxCapacityAcu: 256,
    readReplicaCount: 3,
    enableGlobalDatabase: true,
    secondaryRegions: ['us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1'],
    connectionPoolSize: 1000,
    enablePgBouncer: true,
  },
};

export const DEFAULT_REDIS_CONFIG: Record<ScalingTier, RedisCapacityConfig> = {
  development: {
    nodeType: 'cache.t4g.micro',
    numShards: 1,
    replicasPerShard: 0,
    enableClusterMode: false,
    enableGlobalDatastore: false,
    secondaryRegions: [],
    maxConnections: 1000,
  },
  staging: {
    nodeType: 'cache.t4g.small',
    numShards: 1,
    replicasPerShard: 1,
    enableClusterMode: false,
    enableGlobalDatastore: false,
    secondaryRegions: [],
    maxConnections: 5000,
  },
  production: {
    nodeType: 'cache.r6g.large',
    numShards: 1,
    replicasPerShard: 2,
    enableClusterMode: false,
    enableGlobalDatastore: false,
    secondaryRegions: [],
    maxConnections: 65000,
  },
  enterprise: {
    nodeType: 'cache.r6g.xlarge',
    numShards: 10,
    replicasPerShard: 2,
    enableClusterMode: true,
    enableGlobalDatastore: true,
    secondaryRegions: ['us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1'],
    maxConnections: 500000,
  },
};

export const DEFAULT_API_GATEWAY_CONFIG: Record<ScalingTier, ApiGatewayCapacityConfig> = {
  development: {
    throttlingRateLimit: 100,
    throttlingBurstLimit: 200,
    enableEdgeOptimized: false,
    enableCloudFront: false,
    regionalEndpoints: ['us-east-1'],
  },
  staging: {
    throttlingRateLimit: 1000,
    throttlingBurstLimit: 2000,
    enableEdgeOptimized: false,
    enableCloudFront: false,
    regionalEndpoints: ['us-east-1'],
  },
  production: {
    throttlingRateLimit: 10000,
    throttlingBurstLimit: 20000,
    enableEdgeOptimized: true,
    enableCloudFront: true,
    regionalEndpoints: ['us-east-1'],
  },
  enterprise: {
    throttlingRateLimit: 100000,
    throttlingBurstLimit: 200000,
    enableEdgeOptimized: true,
    enableCloudFront: true,
    regionalEndpoints: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1'],
  },
};

export const DEFAULT_SQS_CONFIG: Record<ScalingTier, SqsCapacityConfig> = {
  development: {
    standardQueueCount: 2,
    fifoQueueCount: 0,
    maxMessageSize: 262144,
    visibilityTimeoutSeconds: 300,
    messageRetentionDays: 4,
    enableBatching: false,
    batchSize: 1,
  },
  staging: {
    standardQueueCount: 5,
    fifoQueueCount: 2,
    maxMessageSize: 262144,
    visibilityTimeoutSeconds: 600,
    messageRetentionDays: 7,
    enableBatching: true,
    batchSize: 5,
  },
  production: {
    standardQueueCount: 10,
    fifoQueueCount: 5,
    maxMessageSize: 262144,
    visibilityTimeoutSeconds: 900,
    messageRetentionDays: 14,
    enableBatching: true,
    batchSize: 10,
  },
  enterprise: {
    standardQueueCount: 50,
    fifoQueueCount: 50,
    maxMessageSize: 262144,
    visibilityTimeoutSeconds: 900,
    messageRetentionDays: 14,
    enableBatching: true,
    batchSize: 10,
  },
};

// ============================================================================
// COST CALCULATION CONSTANTS
// ============================================================================

export const AWS_PRICING = {
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
  },
  apiGateway: {
    requestPer1M: 3.50,
    httpApiPer1M: 1.00,
    webSocketPer1M: 1.00,
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
// HELPER FUNCTIONS
// ============================================================================

export function getDefaultScalingProfile(tier: ScalingTier): Omit<ScalingProfile, 'id' | 'createdAt' | 'updatedAt'> {
  const preset = SCALING_PROFILE_PRESETS.find(p => p.tier === tier) || SCALING_PROFILE_PRESETS[0];
  
  return {
    name: preset.name,
    description: preset.description,
    tier,
    targetSessions: preset.targetSessions,
    lambda: DEFAULT_LAMBDA_CONFIG[tier],
    aurora: DEFAULT_AURORA_CONFIG[tier],
    redis: DEFAULT_REDIS_CONFIG[tier],
    apiGateway: DEFAULT_API_GATEWAY_CONFIG[tier],
    sqs: DEFAULT_SQS_CONFIG[tier],
    estimatedMonthlyCost: preset.monthlyCost,
    isDefault: true,
    isCustom: false,
  };
}

export function calculateMaxSessions(config: {
  lambda: LambdaCapacityConfig;
  aurora: AuroraCapacityConfig;
  redis: RedisCapacityConfig;
  apiGateway: ApiGatewayCapacityConfig;
}): { maxSessions: number; bottleneck: string } {
  const lambdaMax = config.lambda.maxConcurrency * 10; // 10 sessions per concurrent execution
  const auroraMax = config.aurora.connectionPoolSize * 50; // 50 sessions per connection
  const redisMax = config.redis.maxConnections;
  const apiMax = config.apiGateway.throttlingRateLimit;

  const capacities = [
    { component: 'lambda', max: lambdaMax },
    { component: 'aurora', max: auroraMax },
    { component: 'redis', max: redisMax },
    { component: 'api_gateway', max: apiMax },
  ];

  const bottleneck = capacities.reduce((min, curr) => curr.max < min.max ? curr : min);

  return {
    maxSessions: bottleneck.max,
    bottleneck: bottleneck.component,
  };
}
