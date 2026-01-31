// RADIANT v5.2.4 - Model Version Discovery Types
// HuggingFace discovery, S3 storage, thermal management, and deletion queue

// ============================================================================
// Model Version (S3-backed with thermal status)
// ============================================================================

export type ModelThermalState = 'off' | 'cold' | 'warm' | 'hot';
export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'failed';
export type ModelDeploymentStatus = 'not_deployed' | 'deploying' | 'deployed' | 'failed' | 'deleting';

export interface ModelVersion {
  id: string;
  modelId: string;
  family: string;
  version: string;
  
  // HuggingFace metadata
  huggingfaceId?: string;
  huggingfaceRevision?: string;
  discoveredAt: Date;
  discoverySource: 'huggingface_api' | 'manual' | 'registry_sync';
  
  // S3 Storage
  s3Bucket?: string;
  s3KeyPrefix?: string;
  s3Region: string;
  storageSizeBytes?: number;
  downloadStatus: DownloadStatus;
  downloadProgressPct: number;
  downloadStartedAt?: Date;
  downloadCompletedAt?: Date;
  downloadError?: string;
  
  // Thermal Status
  thermalState: ModelThermalState;
  targetThermalState?: ModelThermalState;
  thermalStateChangedAt?: Date;
  autoThermalEnabled: boolean;
  warmUntil?: Date;
  
  // SageMaker deployment
  sagemakerEndpointName?: string;
  sagemakerEndpointConfig?: string;
  sagemakerModelName?: string;
  inferenceComponentId?: string;
  deploymentStatus: ModelDeploymentStatus;
  
  // Model metadata
  displayName?: string;
  description?: string;
  parameterCount?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  capabilities: string[];
  inputModalities: string[];
  outputModalities: string[];
  license?: string;
  commercialUse: boolean;
  
  // Hardware requirements
  instanceType?: string;
  minVramGb?: number;
  quantization?: string;
  tensorParallelism: number;
  
  // Pricing estimate
  pricingInputPer1M?: number;
  pricingOutputPer1M?: number;
  
  // Usage tracking
  totalRequests: number;
  lastRequestAt?: Date;
  isActive: boolean;
  isDefaultForFamily: boolean;
  
  // Computed fields (from view)
  activeSessions?: number;
  totalSessions?: number;
  thermalPriority?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Model Family Watchlist
// ============================================================================

export interface ModelFamilyWatchlist {
  id: string;
  family: string;
  
  // Watch configuration
  isEnabled: boolean;
  autoDownload: boolean;
  autoDeploy: boolean;
  autoThermalTier: ModelThermalState;
  
  // HuggingFace search config
  huggingfaceOrg?: string;
  huggingfaceFilter?: string;
  minLikes: number;
  includeGated: boolean;
  
  // Notification settings
  notifyOnNewVersion: boolean;
  notificationEmails?: string[];
  notificationWebhook?: string;
  
  // Last check
  lastCheckedAt?: Date;
  lastCheckStatus?: string;
  lastCheckError?: string;
  versionsFound: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Discovery Jobs
// ============================================================================

export type DiscoveryJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ModelDiscoveryJob {
  id: string;
  
  // Job details
  jobType: 'scheduled' | 'manual' | 'webhook';
  triggeredBy?: string;
  
  // Progress
  status: DiscoveryJobStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Results
  familiesChecked: number;
  modelsDiscovered: number;
  modelsAdded: number;
  downloadsStarted: number;
  
  // Errors
  errors: DiscoveryError[];
  warnings: string[];
  
  // Detailed results per family
  familyResults: Record<string, FamilyDiscoveryResult>;
  
  // Timestamps
  createdAt: Date;
}

export interface DiscoveryError {
  family?: string;
  modelId?: string;
  errorType: 'api_error' | 'rate_limit' | 'auth_error' | 'parse_error' | 'unknown';
  message: string;
  timestamp: Date;
}

export interface FamilyDiscoveryResult {
  family: string;
  modelsFound: number;
  newVersions: number;
  existingVersions: number;
  downloadsQueued: number;
  errors: string[];
}

// ============================================================================
// Deletion Queue
// ============================================================================

export type DeletionStatus = 'pending' | 'blocked' | 'processing' | 'completed' | 'cancelled' | 'failed';
export type DeletionQueueStatus = DeletionStatus; // Alias for backwards compatibility

export interface ModelDeletionQueueItem {
  id: string;
  modelVersionId: string;
  modelId: string;
  version: string;
  
  // Deletion request
  requestedBy?: string;
  requestedAt?: Date;
  reason?: string;
  priority: number;
  
  // Queue status
  status: DeletionStatus;
  blockedReason?: string;
  
  // Usage at time of request
  activeSessions?: number;
  activeSessionsCount: number;
  requestsLast24h?: number;
  lastRequestAt?: Date;
  
  // Processing
  processingStartedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: string;
  
  // What was deleted
  s3ObjectsDeleted?: number;
  s3FilesDeleted?: number;
  s3BytesDeleted?: number;
  sagemakerResourcesDeleted?: string[];
  
  // Error tracking
  errorMessage?: string;
  error?: string;
  retryCount: number;
  maxRetries?: number;
  nextRetryAt?: Date;
  
  // Queue tracking
  queuedAt: Date;
  deleteS3Data: boolean;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  
  // Joined fields (from view)
  displayName?: string;
  family?: string;
  thermalState?: ModelThermalState;
  s3Bucket?: string;
  s3KeyPrefix?: string;
  sagemakerEndpointName?: string;
  currentActiveSessions?: number;
}

// Usage session tracking
export interface ModelUsageSession {
  id: string;
  modelVersionId: string;
  sessionId?: string;
  sessionType: string;
  userId?: string;
  tenantId?: string;
  startedAt: Date;
  lastActivityAt?: Date;
  endedAt?: Date;
  requestCount?: number;
  endpointName?: string;
  inputTokens?: number;
  outputTokens?: number;
}

// Dashboard for deletion queue
export interface DeletionQueueDashboard {
  totalItems?: number;
  pending: number;
  blocked: number;
  processing: number;
  completed: number;
  failed?: number;
  cancelled: number;
  completedLast24h: number;
  totalBytesFreed: number;
  pendingItems: ModelDeletionQueueItem[];
  recentlyCompleted: ModelDeletionQueueItem[];
  blockedItems: ModelDeletionQueueItem[];
  activeSessionsByModel: Record<string, number>;
}

// Request to queue model for deletion
export interface QueueModelForDeletionRequest {
  modelVersionId: string;
  reason?: string;
  requestedBy?: string;
  priority?: number;
  deleteS3Data?: boolean;
}

// ============================================================================
// HuggingFace API Types
// ============================================================================

export interface HuggingFaceModelInfo {
  id: string; // e.g., 'meta-llama/Llama-3.3-70B-Instruct'
  modelId: string;
  sha: string;
  lastModified: string;
  private: boolean;
  gated: boolean | 'auto' | 'manual';
  disabled: boolean;
  
  // Metadata
  author?: string;
  tags: string[];
  pipeline_tag?: string;
  library_name?: string;
  
  // Stats
  downloads: number;
  likes: number;
  
  // Model card info
  cardData?: {
    license?: string;
    language?: string[];
    model_name?: string;
    base_model?: string;
    datasets?: string[];
  };
  
  // Siblings (files)
  siblings?: Array<{
    rfilename: string;
    size?: number;
    blobId?: string;
  }>;
}

export interface HuggingFaceSearchParams {
  search?: string;
  author?: string;
  filter?: string;
  sort?: 'lastModified' | 'downloads' | 'likes' | 'created';
  direction?: 'asc' | 'desc';
  limit?: number;
  full?: boolean;
}

// ============================================================================
// Admin API Types
// ============================================================================

// Model Versions
export interface ListModelVersionsRequest {
  family?: string;
  thermalState?: ModelThermalState;
  downloadStatus?: DownloadStatus;
  deploymentStatus?: ModelDeploymentStatus;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListModelVersionsResponse {
  versions: ModelVersion[];
  total: number;
  hasMore: boolean;
}

export interface CreateModelVersionRequest {
  modelId: string;
  family: string;
  version: string;
  huggingfaceId?: string;
  displayName?: string;
  description?: string;
  parameterCount?: string;
  capabilities?: string[];
  instanceType?: string;
  autoDownload?: boolean;
}

export interface UpdateModelVersionRequest {
  thermalState?: ModelThermalState;
  isActive?: boolean;
  isDefaultForFamily?: boolean;
  displayName?: string;
  description?: string;
  capabilities?: string[];
  instanceType?: string;
  autoThermalEnabled?: boolean;
}

// Watchlist
export interface ListWatchlistResponse {
  families: ModelFamilyWatchlist[];
}

export interface UpdateWatchlistRequest {
  isEnabled?: boolean;
  autoDownload?: boolean;
  autoDeploy?: boolean;
  autoThermalTier?: ModelThermalState;
  huggingfaceOrg?: string;
  huggingfaceFilter?: string;
  minLikes?: number;
  includeGated?: boolean;
  notifyOnNewVersion?: boolean;
  notificationEmails?: string[];
}

export interface AddWatchlistFamilyRequest {
  family: string;
  huggingfaceOrg?: string;
  isEnabled?: boolean;
  autoDownload?: boolean;
}

// Discovery
export interface TriggerDiscoveryRequest {
  families?: string[]; // If not specified, check all enabled families
  forceRefresh?: boolean;
}

export interface TriggerDiscoveryResponse {
  jobId: string;
  status: DiscoveryJobStatus;
  message: string;
}

export interface GetDiscoveryJobResponse {
  job: ModelDiscoveryJob;
}

export interface ListDiscoveryJobsRequest {
  status?: DiscoveryJobStatus;
  limit?: number;
  offset?: number;
}

export interface ListDiscoveryJobsResponse {
  jobs: ModelDiscoveryJob[];
  total: number;
}

// Deletion Queue
export interface QueueDeletionRequest {
  modelVersionId: string;
  reason?: string;
}

export interface QueueDeletionResponse {
  queueItemId: string;
  status: DeletionStatus;
  message: string;
}

export interface ListDeletionQueueRequest {
  status?: DeletionStatus;
  family?: string;
  limit?: number;
  offset?: number;
}

export interface ListDeletionQueueResponse {
  items: ModelDeletionQueueItem[];
  total: number;
  blockedCount: number;
  pendingCount: number;
}

export interface CancelDeletionRequest {
  queueItemId: string;
}

export interface ProcessDeletionQueueResponse {
  processed: number;
  completed: number;
  stillBlocked: number;
  failed: number;
}

// Dashboard
export interface ModelVersionDashboard {
  // Summary stats
  totalVersions: number;
  activeVersions: number;
  downloadedVersions: number;
  deployedVersions: number;
  
  // By thermal state
  thermalBreakdown: {
    hot: number;
    warm: number;
    cold: number;
    off: number;
  };
  
  // By family
  familyBreakdown: Array<{
    family: string;
    totalVersions: number;
    activeVersions: number;
    latestVersion: string;
    isWatched: boolean;
  }>;
  
  // Recent activity
  recentDiscoveries: ModelVersion[];
  recentDownloads: ModelVersion[];
  
  // Deletion queue
  deletionQueueSummary: {
    pending: number;
    blocked: number;
    processing: number;
  };
  
  // Discovery jobs
  lastDiscoveryJob?: ModelDiscoveryJob;
  nextScheduledDiscovery?: Date;
  
  // Storage stats
  totalStorageBytes: number;
  storageByFamily: Record<string, number>;
}

// S3 Storage
export interface ModelStorageInfo {
  modelVersionId: string;
  s3Bucket: string;
  s3KeyPrefix: string;
  s3Region: string;
  
  // Files
  files: Array<{
    key: string;
    size: number;
    lastModified: Date;
  }>;
  
  totalSize: number;
  fileCount: number;
}

// Thermal Management
export interface SetThermalStateRequest {
  modelVersionId: string;
  thermalState: ModelThermalState;
  warmDurationMinutes?: number; // For 'warm' state
}

export interface BulkThermalStateRequest {
  modelVersionIds: string[];
  thermalState: ModelThermalState;
}

export interface ThermalStateResponse {
  modelVersionId: string;
  previousState: ModelThermalState;
  newState: ModelThermalState;
  estimatedTransitionTime?: number; // seconds
}
