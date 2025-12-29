// RADIANT v4.18.0 - Model Coordination Types
// Service for coordinating communication between hosted and self-hosted AI models

// ============================================================================
// Model Communication Protocol
// ============================================================================

export interface ModelEndpoint {
  id: string;
  modelId: string;
  
  // Endpoint details
  endpointType: EndpointType;
  baseUrl: string;
  path?: string;
  method: 'POST' | 'GET';
  
  // Authentication
  authMethod: AuthMethod;
  authConfig?: AuthConfig;
  
  // Request format
  requestFormat: RequestFormat;
  requestTemplate?: string;
  
  // Response format
  responseFormat: ResponseFormat;
  responseMapping?: ResponseMapping;
  
  // Limits and quotas
  rateLimitRpm?: number;
  rateLimitTpm?: number;
  maxConcurrent?: number;
  timeoutMs?: number;
  
  // Health
  healthCheckUrl?: string;
  healthCheckInterval?: number;
  lastHealthCheck?: Date;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  
  // Metadata
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type EndpointType = 
  | 'openai_compatible'
  | 'anthropic_compatible'
  | 'sagemaker'
  | 'bedrock'
  | 'custom_rest'
  | 'custom_grpc';

export type AuthMethod = 
  | 'api_key'
  | 'bearer_token'
  | 'aws_sig_v4'
  | 'oauth2'
  | 'custom_header'
  | 'none';

export interface AuthConfig {
  headerName?: string;
  headerPrefix?: string;
  keyPath?: string; // Path in AWS Secrets Manager
  region?: string;
  roleArn?: string;
}

export interface RequestFormat {
  contentType: 'application/json' | 'application/x-www-form-urlencoded' | 'multipart/form-data';
  messageField: string;
  modelField?: string;
  maxTokensField?: string;
  temperatureField?: string;
  systemPromptField?: string;
  streamField?: string;
  additionalFields?: Record<string, unknown>;
}

export interface ResponseFormat {
  contentType: 'application/json' | 'text/event-stream';
  textPath: string; // JSON path to text response
  usagePath?: string;
  finishReasonPath?: string;
  errorPath?: string;
}

export interface ResponseMapping {
  textExtractor: string; // JS expression
  usageExtractor?: string;
  streamParser?: string;
}

// ============================================================================
// Model Registry Entry
// ============================================================================

export interface ModelRegistryEntry {
  id: string;
  modelId: string;
  
  // Classification
  source: 'external' | 'self-hosted' | 'hybrid';
  provider: string;
  family: string;
  
  // Capabilities
  capabilities: string[];
  inputModalities: string[];
  outputModalities: string[];
  
  // Endpoints (can have multiple for redundancy)
  endpoints: ModelEndpoint[];
  primaryEndpointId: string;
  
  // Routing hints
  routingPriority: number;
  fallbackModelIds: string[];
  
  // Proficiency (from proficiency registry)
  proficiencyProfile?: {
    topDomains: string[];
    topModes: string[];
    overallScore: number;
  };
  
  // Status
  status: 'active' | 'inactive' | 'deprecated' | 'pending';
  lastSyncedAt?: Date;
  syncSource?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Sync Service Types
// ============================================================================

export interface SyncConfig {
  id: string;
  tenantId?: string; // null = global config
  
  // Sync intervals
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number; // 5, 15, 30, 60, 360, 1440
  
  // Sync sources
  syncExternalProviders: boolean;
  syncSelfHostedModels: boolean;
  syncFromHuggingFace: boolean;
  
  // Auto-discovery
  autoDiscoveryEnabled: boolean;
  autoGenerateProficiencies: boolean;
  
  // Notifications
  notifyOnNewModel: boolean;
  notifyOnModelRemoved: boolean;
  notifyOnSyncFailure: boolean;
  notificationEmails?: string[];
  notificationWebhook?: string;
  
  // Metadata
  lastSyncAt?: Date;
  lastSyncStatus?: SyncStatus;
  lastSyncDurationMs?: number;
  nextScheduledSync?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export type SyncStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial';

export interface SyncJob {
  id: string;
  configId: string;
  
  // Job details
  triggerType: 'scheduled' | 'manual' | 'new_model' | 'webhook';
  triggeredBy?: string;
  
  // Progress
  status: SyncStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Results
  modelsScanned: number;
  modelsAdded: number;
  modelsUpdated: number;
  modelsRemoved: number;
  endpointsUpdated: number;
  proficienciesGenerated: number;
  
  // Errors
  errors: SyncError[];
  warnings: string[];
  
  // Details
  sourceBreakdown?: {
    external: { scanned: number; added: number; updated: number };
    selfHosted: { scanned: number; added: number; updated: number };
  };
}

export interface SyncError {
  modelId?: string;
  source?: string;
  errorType: 'connection' | 'auth' | 'format' | 'validation' | 'unknown';
  message: string;
  timestamp: Date;
}

// ============================================================================
// New Model Detection
// ============================================================================

export interface NewModelDetection {
  id: string;
  
  // Detection details
  modelId: string;
  detectedAt: Date;
  detectionSource: 'api_call' | 'health_check' | 'provider_sync' | 'huggingface' | 'manual';
  
  // Model info
  provider?: string;
  family?: string;
  capabilities?: string[];
  
  // Processing
  processed: boolean;
  processedAt?: Date;
  addedToRegistry: boolean;
  proficienciesGenerated: boolean;
  
  // If not added, why
  skipReason?: string;
}

// ============================================================================
// Admin API Types
// ============================================================================

export interface GetSyncConfigRequest {
  tenantId?: string;
}

export interface UpdateSyncConfigRequest {
  autoSyncEnabled?: boolean;
  syncIntervalMinutes?: number;
  syncExternalProviders?: boolean;
  syncSelfHostedModels?: boolean;
  autoDiscoveryEnabled?: boolean;
  autoGenerateProficiencies?: boolean;
  notifyOnNewModel?: boolean;
  notificationEmails?: string[];
}

export interface TriggerSyncRequest {
  sources?: ('external' | 'self-hosted' | 'huggingface')[];
  forceRefresh?: boolean;
}

export interface SyncDashboard {
  config: SyncConfig;
  lastSync?: SyncJob;
  recentJobs: SyncJob[];
  registryStats: {
    totalModels: number;
    externalModels: number;
    selfHostedModels: number;
    activeEndpoints: number;
    healthyEndpoints: number;
  };
  pendingDetections: NewModelDetection[];
}

// ============================================================================
// Model Routing Types
// ============================================================================

export interface ModelRoutingRules {
  id: string;
  
  // Rules
  rules: RoutingRule[];
  
  // Fallback behavior
  fallbackBehavior: 'next_priority' | 'cheapest' | 'fastest' | 'most_capable' | 'random';
  maxFallbackAttempts: number;
  
  // Load balancing
  loadBalancingStrategy: 'round_robin' | 'weighted' | 'least_connections' | 'latency_based';
  
  // Health-aware routing
  excludeUnhealthyEndpoints: boolean;
  unhealthyThresholdMs: number;
  
  updatedAt: Date;
}

export interface RoutingRule {
  id: string;
  name: string;
  
  // Conditions
  conditions: {
    domain?: string;
    mode?: string;
    capability?: string;
    minQuality?: number;
    maxCost?: number;
    maxLatency?: number;
  };
  
  // Target
  targetModelIds: string[];
  targetPriority: 'first_match' | 'best_score' | 'load_balanced';
  
  isActive: boolean;
}
