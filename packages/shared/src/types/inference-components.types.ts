// RADIANT v4.18.0 - SageMaker Inference Components Types
// Enables efficient multi-model hosting with reduced cold starts

// ============================================================================
// Model Hosting Tiers
// ============================================================================

/**
 * Hosting tier determines how a model is deployed and its cost/latency characteristics
 */
export type ModelHostingTier = 
  | 'hot'       // Dedicated endpoint, always running, <100ms latency
  | 'warm'      // Inference Component, shared infrastructure, 5-15s cold start
  | 'cold'      // Serverless endpoint, scale to zero, 30-60s cold start
  | 'off';      // Not deployed, requires manual deployment, 5-10 min start

export interface TierThresholds {
  /** Requests per day to be promoted to HOT tier */
  hotTierMinRequestsPerDay: number;
  /** Requests per day to remain in WARM tier (below this → COLD) */
  warmTierMinRequestsPerDay: number;
  /** Days of inactivity before moving to OFF tier */
  offTierInactiveDays: number;
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  hotTierMinRequestsPerDay: 100,
  warmTierMinRequestsPerDay: 10,
  offTierInactiveDays: 30,
};

// ============================================================================
// Inference Component Types
// ============================================================================

export interface InferenceComponent {
  componentId: string;
  componentName: string;
  modelId: string;
  modelName: string;
  endpointName: string;
  endpointArn: string;
  variantName: string;
  
  // Component configuration
  computeUnits: number;           // 1 unit = 1 vCPU + proportional GPU
  minCopies: number;              // Minimum model copies (0 = scale to zero)
  maxCopies: number;              // Maximum model copies
  currentCopies: number;          // Current running copies
  
  // Model artifact
  modelArtifactS3Uri: string;
  containerImage: string;
  framework: InferenceFramework;
  frameworkVersion: string;
  
  // Status
  status: InferenceComponentStatus;
  lastLoadedAt?: string;
  lastUnloadedAt?: string;
  loadTimeMs?: number;            // Average time to load model
  
  // Metrics
  requestsLast24h: number;
  avgLatencyMs: number;
  errorRate: number;
  
  createdAt: string;
  updatedAt: string;
}

export type InferenceComponentStatus =
  | 'creating'
  | 'in_service'
  | 'updating'
  | 'deleting'
  | 'failed'
  | 'unloaded';                   // Model weights not in memory

export type InferenceFramework =
  | 'pytorch'
  | 'tensorflow'
  | 'huggingface'
  | 'triton'
  | 'xgboost'
  | 'sklearn';

// ============================================================================
// Shared Endpoint (Host for Inference Components)
// ============================================================================

export interface SharedInferenceEndpoint {
  endpointId: string;
  endpointName: string;
  endpointArn: string;
  
  // Instance configuration
  instanceType: string;           // e.g., 'ml.g5.xlarge'
  instanceCount: number;
  
  // Capacity
  totalComputeUnits: number;
  allocatedComputeUnits: number;
  availableComputeUnits: number;
  
  // Components hosted
  componentCount: number;
  maxComponents: number;
  componentIds: string[];
  
  // Status
  status: SharedEndpointStatus;
  
  // Cost tracking
  hourlyBaseCost: number;
  
  createdAt: string;
  updatedAt: string;
}

export type SharedEndpointStatus =
  | 'creating'
  | 'in_service'
  | 'updating'
  | 'system_updating'
  | 'rolling_back'
  | 'deleting'
  | 'failed';

// ============================================================================
// Tier Assignment & Auto-Scaling
// ============================================================================

export interface TierAssignment {
  modelId: string;
  currentTier: ModelHostingTier;
  recommendedTier: ModelHostingTier;
  tierReason: string;
  
  // Usage metrics used for decision
  requestsLast24h: number;
  requestsLast7d: number;
  avgDailyRequests: number;
  lastRequestAt?: string;
  daysSinceLastRequest: number;
  
  // Cost analysis
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
  potentialSavings: number;
  
  // Override
  tierOverride?: ModelHostingTier;
  overrideReason?: string;
  overrideExpiresAt?: string;
  
  lastEvaluatedAt: string;
}

export interface TierTransition {
  transitionId: string;
  modelId: string;
  fromTier: ModelHostingTier;
  toTier: ModelHostingTier;
  reason: string;
  
  status: TierTransitionStatus;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  
  // Rollback info
  canRollback: boolean;
  rollbackDeadline?: string;
}

export type TierTransitionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolled_back';

// ============================================================================
// Component Loading & Routing
// ============================================================================

export interface ComponentLoadRequest {
  componentId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requesterUserId?: string;
  reason: string;
  timeoutMs?: number;
}

export interface ComponentLoadResult {
  componentId: string;
  success: boolean;
  loadTimeMs: number;
  fromCache: boolean;
  errorMessage?: string;
}

export interface ModelRoutingDecision {
  modelId: string;
  routingStrategy: RoutingStrategy;
  primaryTarget: RoutingTarget;
  fallbackTargets: RoutingTarget[];
  estimatedLatencyMs: number;
  
  // If component needs loading
  requiresLoading: boolean;
  estimatedLoadTimeMs?: number;
}

export type RoutingStrategy =
  | 'direct'           // Route directly to ready component
  | 'load_and_route'   // Load component first, then route
  | 'fallback'         // Use external provider while loading
  | 'queue';           // Queue request until component ready

export interface RoutingTarget {
  type: 'inference_component' | 'dedicated_endpoint' | 'serverless' | 'external_provider';
  targetId: string;
  targetName: string;
  isReady: boolean;
  estimatedLatencyMs: number;
  costPer1kTokens?: number;
}

// ============================================================================
// Configuration & Settings
// ============================================================================

export interface InferenceComponentsConfig {
  tenantId: string;
  
  // Feature flags
  enabled: boolean;
  autoTieringEnabled: boolean;
  predictiveLoadingEnabled: boolean;
  fallbackToExternalEnabled: boolean;
  
  // Tier thresholds
  tierThresholds: TierThresholds;
  
  // Endpoint configuration
  defaultInstanceType: string;
  maxSharedEndpoints: number;
  maxComponentsPerEndpoint: number;
  
  // Loading behavior
  defaultLoadTimeoutMs: number;
  preloadWindowMinutes: number;      // Pre-load models this many minutes before predicted usage
  unloadAfterIdleMinutes: number;    // Unload model weights after this idle time
  
  // Cost controls
  maxMonthlyBudget?: number;
  alertThresholdPercent: number;
  
  // Notifications
  notifyOnTierChange: boolean;
  notifyOnLoadFailure: boolean;
  notifyOnBudgetAlert: boolean;
  
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_INFERENCE_COMPONENTS_CONFIG: Omit<InferenceComponentsConfig, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  autoTieringEnabled: true,
  predictiveLoadingEnabled: true,
  fallbackToExternalEnabled: true,
  tierThresholds: DEFAULT_TIER_THRESHOLDS,
  defaultInstanceType: 'ml.g5.xlarge',
  maxSharedEndpoints: 3,
  maxComponentsPerEndpoint: 15,
  defaultLoadTimeoutMs: 30000,
  preloadWindowMinutes: 15,
  unloadAfterIdleMinutes: 30,
  alertThresholdPercent: 80,
  notifyOnTierChange: true,
  notifyOnLoadFailure: true,
  notifyOnBudgetAlert: true,
};

// ============================================================================
// Dashboard & Metrics
// ============================================================================

export interface InferenceComponentsDashboard {
  // Summary
  totalModels: number;
  modelsByTier: Record<ModelHostingTier, number>;
  totalComponents: number;
  activeComponents: number;
  
  // Endpoints
  sharedEndpoints: SharedInferenceEndpoint[];
  totalComputeUnits: number;
  usedComputeUnits: number;
  utilizationPercent: number;
  
  // Cost
  currentMonthCost: number;
  projectedMonthCost: number;
  costByTier: Record<ModelHostingTier, number>;
  savingsVsDedicated: number;
  
  // Performance
  avgLoadTimeMs: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  
  // Recent activity
  recentTransitions: TierTransition[];
  recentLoadEvents: ComponentLoadResult[];
  
  lastUpdated: string;
}

// ============================================================================
// Events
// ============================================================================

export interface InferenceComponentEvent {
  eventId: string;
  eventType: InferenceComponentEventType;
  componentId?: string;
  modelId?: string;
  endpointId?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export type InferenceComponentEventType =
  | 'component_created'
  | 'component_loaded'
  | 'component_unloaded'
  | 'component_deleted'
  | 'component_failed'
  | 'tier_changed'
  | 'endpoint_created'
  | 'endpoint_scaled'
  | 'endpoint_deleted'
  | 'budget_alert'
  | 'load_timeout';
