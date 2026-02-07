/**
 * Environment State Registry Types
 * 
 * Comprehensive type definitions for tracking environment state,
 * persistent data, sync configuration, and backup/restore operations.
 * 
 * @version 1.0.0
 * @since RADIANT 7.0.0
 */

// ============================================================================
// Core Enums
// ============================================================================

export type EnvironmentName = 'dev' | 'staging' | 'prod';

export type PersistentDataType = 'database' | 's3' | 'secret' | 'config';

export type PersistentDataCategory = 
  | 'user_data' 
  | 'system_config' 
  | 'ai_models' 
  | 'audit_logs' 
  | 'media' 
  | 'cache'
  | 'analytics'
  | 'compliance';

export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export type SyncPreference = 'full' | 'structure_only' | 'exclude';

export type StackStatus = 
  | 'CREATE_COMPLETE' 
  | 'CREATE_IN_PROGRESS' 
  | 'CREATE_FAILED'
  | 'UPDATE_COMPLETE' 
  | 'UPDATE_IN_PROGRESS' 
  | 'UPDATE_FAILED'
  | 'DELETE_COMPLETE' 
  | 'DELETE_IN_PROGRESS' 
  | 'DELETE_FAILED'
  | 'ROLLBACK_COMPLETE' 
  | 'ROLLBACK_IN_PROGRESS';

export type BackupType = 'full' | 'incremental' | 'scheduled' | 'pre_deploy' | 'manual';

export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';

export type EnvSyncStatus = 'idle' | 'syncing' | 'completed' | 'failed' | 'conflict';

export type ResourceHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// ============================================================================
// Infrastructure Manifests
// ============================================================================

export interface StackManifest {
  name: string;
  stackId: string;
  status: StackStatus;
  createdAt: string;
  lastUpdatedAt: string;
  templateVersion?: string;
  outputs: Record<string, string>;
  parameters: Record<string, string>;
  tags: Record<string, string>;
  driftStatus?: 'IN_SYNC' | 'DRIFTED' | 'NOT_CHECKED';
}

export interface LambdaManifest {
  name: string;
  arn: string;
  runtime: string;
  handler: string;
  memoryMB: number;
  timeoutSeconds: number;
  codeSize: number;
  lastModified: string;
  version: string;
  environment?: Record<string, string>;
  layers: string[];
  vpcConfig?: {
    subnetIds: string[];
    securityGroupIds: string[];
  };
  concurrency?: {
    reserved?: number;
    provisioned?: number;
  };
}

export interface S3BucketManifest {
  name: string;
  arn: string;
  region: string;
  createdAt: string;
  
  // Versioning
  versioningEnabled: boolean;
  
  // Size metrics
  totalSizeBytes: number;
  objectCount: number;
  lastInventoryAt?: string;
  
  // Lifecycle
  lifecycleRules: LifecycleRule[];
  
  // Encryption
  encryptionType: 'AES256' | 'aws:kms' | 'none';
  kmsKeyId?: string;
  
  // Access
  publicAccessBlocked: boolean;
  corsEnabled: boolean;
  
  // Persistent data items in this bucket
  persistentDataItems: string[];
  
  // Sync preference
  syncPreference: SyncPreference;
}

export interface LifecycleRule {
  id: string;
  prefix?: string;
  enabled: boolean;
  transitions: {
    days: number;
    storageClass: string;
  }[];
  expiration?: {
    days: number;
  };
}

export interface DynamoTableManifest {
  name: string;
  arn: string;
  status: 'ACTIVE' | 'CREATING' | 'UPDATING' | 'DELETING';
  itemCount: number;
  sizeBytes: number;
  
  // Keys
  partitionKey: { name: string; type: string };
  sortKey?: { name: string; type: string };
  
  // Capacity
  billingMode: 'PROVISIONED' | 'PAY_PER_REQUEST';
  readCapacity?: number;
  writeCapacity?: number;
  
  // Indexes
  globalSecondaryIndexes: {
    name: string;
    partitionKey: string;
    sortKey?: string;
    projectionType: string;
  }[];
  
  // Streams
  streamEnabled: boolean;
  streamArn?: string;
  
  // TTL
  ttlEnabled: boolean;
  ttlAttribute?: string;
  
  // Point-in-time recovery
  pitrEnabled: boolean;
  
  // Persistent data reference
  persistentDataItems: string[];
}

export interface AuroraManifest {
  clusterIdentifier: string;
  clusterArn: string;
  engine: string;
  engineVersion: string;
  status: string;
  
  // Endpoints
  endpoint: string;
  readerEndpoint: string;
  port: number;
  
  // Instances
  instances: {
    identifier: string;
    instanceClass: string;
    status: string;
    availabilityZone: string;
  }[];
  
  // Storage
  allocatedStorage: number;
  storageEncrypted: boolean;
  kmsKeyId?: string;
  
  // Backup
  backupRetentionPeriod: number;
  latestRestorableTime?: string;
  
  // Database metrics
  databases: {
    name: string;
    sizeBytes: number;
    tableCount: number;
  }[];
  
  // Persistent data reference
  persistentDataItems: string[];
}

export interface SecretManifest {
  name: string;
  arn: string;
  description?: string;
  createdAt: string;
  lastChangedAt: string;
  lastRotatedAt?: string;
  rotationEnabled: boolean;
  rotationLambdaArn?: string;
  rotationDays?: number;
  versionId: string;
  versionStage: string;
  tags: Record<string, string>;
  
  // Do NOT include the actual secret value!
  // Only metadata for tracking
}

export interface ApiGatewayManifest {
  restApiId: string;
  name: string;
  description?: string;
  createdAt: string;
  
  // Stages
  stages: {
    name: string;
    deploymentId: string;
    lastUpdatedAt: string;
    throttling?: {
      burstLimit: number;
      rateLimit: number;
    };
  }[];
  
  // Endpoints
  endpointConfiguration: {
    types: string[];
    vpcEndpointIds?: string[];
  };
  
  // Custom domain
  customDomain?: {
    domainName: string;
    certificateArn: string;
    basePath: string;
  };
  
  // Resources count
  resourceCount: number;
  methodCount: number;
}

// ============================================================================
// Persistent Data
// ============================================================================

export interface PersistentDataItem {
  id: string;
  name: string;
  description: string;
  type: PersistentDataType;
  location: string;
  
  // Size/count info
  sizeBytes?: number;
  recordCount?: number;
  
  // Inclusion flags
  includeInSync: boolean;
  includeInBackup: boolean;
  
  // Categorization
  category: PersistentDataCategory;
  sensitivity: DataSensitivity;
  
  // Dependencies
  dependsOn: string[];
  dependents: string[];
  
  // Modification tracking
  lastModified: string;
  lastModifiedBy?: string;
  modificationCount?: number;
  
  // Retention
  retentionDays?: number;
  complianceHold?: boolean;
  
  // Sync metadata
  lastSyncedAt?: string;
  lastSyncedFrom?: EnvironmentName;
  syncConflicts?: SyncConflict[];
}

export interface SyncConflict {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  detectedAt: string;
  resolvedAt?: string;
  resolution?: 'local' | 'remote' | 'merged' | 'skipped';
  resolvedBy?: string;
}

// ============================================================================
// Sync Configuration
// ============================================================================

export interface SyncConfiguration {
  enabled: boolean;
  lastSyncAt?: string;
  lastSyncBy?: string;
  lastSyncDurationMs?: number;
  
  // Source environment (where to sync FROM)
  sourceEnvironment?: EnvironmentName;
  
  // What to sync
  syncInfrastructure: boolean;
  syncPersistentData: boolean;
  syncFeatureFlags: boolean;
  syncSecrets: boolean;
  
  // Selective sync
  includedDataItems: string[];
  excludedDataItems: string[];
  
  // Protection
  requireConfirmation: boolean;
  allowDestructive: boolean;
  requireApproval: boolean;
  approvers?: string[];
  
  // Schedule
  autoSyncEnabled: boolean;
  autoSyncIntervalHours?: number;
  autoSyncCron?: string;
  nextScheduledSync?: string;
  
  // Notifications
  notifyOnSync: boolean;
  notifyOnConflict: boolean;
  notificationChannels: ('email' | 'slack' | 'sns')[];
}

// ============================================================================
// Feature Manifest
// ============================================================================

export interface FeatureManifest {
  // Core features
  enableCurator: boolean;
  enableCortexMemory: boolean;
  enableTimeMachine: boolean;
  enableCollaboration: boolean;
  enableComplianceExport: boolean;
  enableEgoSystem: boolean;
  enableDelight: boolean;
  enableCato: boolean;
  
  // AI features
  enableSelfHostedModels: boolean;
  enableExternalModels: boolean;
  enableModelFallback: boolean;
  enableStreamingResponses: boolean;
  
  // Service layer
  enableMCP: boolean;
  enableA2A: boolean;
  enableExternalAPI: boolean;
  
  // Custom feature flags
  customFlags: Record<string, boolean | string | number>;
}

// ============================================================================
// Environment State Manifest (Main Type)
// ============================================================================

export interface EnvironmentStateManifest {
  // Metadata
  version: string;
  schemaVersion: string;
  environment: EnvironmentName;
  capturedAt: string;
  capturedBy: string;
  radiantVersion: string;
  
  // Infrastructure
  infrastructure: {
    region: string;
    accountId: string;
    vpcId: string;
    
    stacks: StackManifest[];
    lambdas: LambdaManifest[];
    s3Buckets: S3BucketManifest[];
    dynamoTables: DynamoTableManifest[];
    auroraCluster: AuroraManifest;
    secrets: SecretManifest[];
    apiGateway: ApiGatewayManifest;
  };
  
  // Persistent Data
  persistentData: PersistentDataItem[];
  
  // Feature Flags
  features: FeatureManifest;
  
  // Sync Configuration
  syncConfig: SyncConfiguration;
  
  // Health
  health: {
    overall: ResourceHealth;
    services: Record<string, ResourceHealth>;
    lastHealthCheckAt: string;
  };
  
  // Checksums for integrity
  checksums: {
    infrastructure: string;
    persistentData: string;
    features: string;
    full: string;
  };
  
  // History
  previousVersionId?: string;
  changesSinceLastCapture?: ManifestDiff;
}

// ============================================================================
// Diff and Comparison
// ============================================================================

export interface ManifestDiff {
  fromVersion: string;
  toVersion: string;
  fromCapturedAt: string;
  toCapturedAt: string;
  
  // Changes
  added: {
    stacks: string[];
    lambdas: string[];
    buckets: string[];
    tables: string[];
    secrets: string[];
    persistentData: string[];
  };
  
  removed: {
    stacks: string[];
    lambdas: string[];
    buckets: string[];
    tables: string[];
    secrets: string[];
    persistentData: string[];
  };
  
  modified: {
    stacks: { name: string; changes: string[] }[];
    lambdas: { name: string; changes: string[] }[];
    buckets: { name: string; changes: string[] }[];
    tables: { name: string; changes: string[] }[];
    secrets: { name: string; changes: string[] }[];
    persistentData: { id: string; changes: string[] }[];
  };
  
  // Summary
  totalChanges: number;
  breakingChanges: number;
  dataChanges: number;
}

export interface EnvironmentComparison {
  sourceEnvironment: EnvironmentName;
  targetEnvironment: EnvironmentName;
  comparedAt: string;
  comparedBy: string;
  
  diff: ManifestDiff;
  
  // Sync recommendations
  recommendations: SyncRecommendation[];
  
  // Conflicts
  conflicts: SyncConflict[];
  
  // Estimated sync impact
  estimatedSyncDurationMs: number;
  estimatedDataTransferBytes: number;
  requiresDowntime: boolean;
}

export interface SyncRecommendation {
  type: 'sync' | 'skip' | 'review' | 'manual';
  itemType: 'stack' | 'lambda' | 'bucket' | 'table' | 'secret' | 'data';
  itemId: string;
  reason: string;
  risk: 'low' | 'medium' | 'high';
  action: string;
}

// ============================================================================
// Backup and Restore
// ============================================================================

export interface BackupManifest {
  id: string;
  environment: EnvironmentName;
  type: BackupType;
  status: BackupStatus;
  
  // Timing
  createdAt: string;
  createdBy: string;
  completedAt?: string;
  expiresAt?: string;
  
  // Content
  includesInfrastructure: boolean;
  includesDatabase: boolean;
  includesS3: boolean;
  includesSecrets: boolean;
  includesFeatureFlags: boolean;
  
  // References
  stateManifestVersion: string;
  auroraSnapshotId?: string;
  s3InventoryLocation?: string;
  
  // Size
  totalSizeBytes: number;
  componentSizes: {
    infrastructure: number;
    database: number;
    s3: number;
    secrets: number;
    config: number;
  };
  
  // Storage
  storageLocation: string;
  storageClass: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  
  // Integrity
  checksums: {
    manifest: string;
    database?: string;
    s3Inventory?: string;
    full: string;
  };
  
  // Restore info
  lastRestoredAt?: string;
  lastRestoredBy?: string;
  restoreCount: number;
}

export interface RestoreRequest {
  backupId: string;
  targetEnvironment: EnvironmentName;
  requestedBy: string;
  requestedAt: string;
  
  // What to restore
  restoreInfrastructure: boolean;
  restoreDatabase: boolean;
  restoreS3: boolean;
  restoreSecrets: boolean;
  restoreFeatureFlags: boolean;
  
  // Options
  createPreRestoreBackup: boolean;
  preserveCurrentSecrets: boolean;
  skipConflictingData: boolean;
  
  // Status
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  approvedBy?: string;
  approvedAt?: string;
  startedAt?: string;
  completedAt?: string;
  
  // Progress
  progress: {
    phase: string;
    percentComplete: number;
    currentItem?: string;
    itemsCompleted: number;
    itemsTotal: number;
  };
  
  // Errors
  errors: RestoreError[];
}

export interface RestoreError {
  phase: string;
  item: string;
  error: string;
  recoverable: boolean;
  timestamp: string;
}

// ============================================================================
// Sync Operations
// ============================================================================

export interface SyncOperation {
  id: string;
  sourceEnvironment: EnvironmentName;
  targetEnvironment: EnvironmentName;
  initiatedBy: string;
  initiatedAt: string;
  
  // Configuration
  syncInfrastructure: boolean;
  syncData: boolean;
  syncFeatures: boolean;
  dataItemsToSync: string[];
  
  // Status
  status: EnvSyncStatus;
  startedAt?: string;
  completedAt?: string;
  
  // Progress
  progress: {
    phase: 'preparing' | 'validating' | 'syncing_infra' | 'syncing_data' | 'syncing_features' | 'finalizing';
    percentComplete: number;
    currentItem?: string;
    itemsCompleted: number;
    itemsTotal: number;
    bytesTransferred: number;
  };
  
  // Results
  results?: {
    itemsSynced: number;
    itemsSkipped: number;
    itemsFailed: number;
    conflicts: SyncConflict[];
    warnings: string[];
  };
  
  // Errors
  errors: EnvSyncError[];
}

export interface EnvSyncError {
  item: string;
  itemType: string;
  error: string;
  recoverable: boolean;
  timestamp: string;
  retryCount: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CaptureManifestRequest {
  environment: EnvironmentName;
  capturedBy: string;
  includeInfrastructure?: boolean;
  includePersistentData?: boolean;
  includeFeatures?: boolean;
  forceRefresh?: boolean;
}

export interface CaptureManifestResponse {
  success: boolean;
  manifest?: EnvironmentStateManifest;
  error?: string;
  duration: number;
}

export interface CompareEnvironmentsRequest {
  sourceEnvironment: EnvironmentName;
  targetEnvironment: EnvironmentName;
  comparedBy: string;
  includeDataDiff?: boolean;
}

export interface CompareEnvironmentsResponse {
  success: boolean;
  comparison?: EnvironmentComparison;
  error?: string;
}

export interface StartSyncRequest {
  sourceEnvironment: EnvironmentName;
  targetEnvironment: EnvironmentName;
  initiatedBy: string;
  syncInfrastructure?: boolean;
  syncData?: boolean;
  syncFeatures?: boolean;
  dataItemsToSync?: string[];
  skipConflicts?: boolean;
}

export interface StartSyncResponse {
  success: boolean;
  operationId?: string;
  error?: string;
}

export interface CreateBackupRequest {
  environment: EnvironmentName;
  createdBy: string;
  type?: BackupType;
  includeInfrastructure?: boolean;
  includeDatabase?: boolean;
  includeS3?: boolean;
  includeSecrets?: boolean;
  includeFeatureFlags?: boolean;
  expiresInDays?: number;
}

export interface CreateBackupResponse {
  success: boolean;
  backupId?: string;
  error?: string;
}

export interface StartRestoreRequest {
  backupId: string;
  targetEnvironment: EnvironmentName;
  requestedBy: string;
  restoreInfrastructure?: boolean;
  restoreDatabase?: boolean;
  restoreS3?: boolean;
  restoreSecrets?: boolean;
  restoreFeatureFlags?: boolean;
  createPreRestoreBackup?: boolean;
}

export interface StartRestoreResponse {
  success: boolean;
  requestId?: string;
  requiresApproval?: boolean;
  error?: string;
}

// ============================================================================
// Event Types (for EventBridge / notifications)
// ============================================================================

export interface StateRegistryEvent {
  eventType: 
    | 'manifest.captured'
    | 'manifest.changed'
    | 'sync.started'
    | 'sync.completed'
    | 'sync.failed'
    | 'sync.conflict'
    | 'backup.created'
    | 'backup.expired'
    | 'restore.requested'
    | 'restore.approved'
    | 'restore.completed'
    | 'restore.failed';
  environment: EnvironmentName;
  timestamp: string;
  initiatedBy: string;
  details: Record<string, unknown>;
}

// ============================================================================
// Default Persistent Data Items
// ============================================================================

export const DEFAULT_PERSISTENT_DATA_ITEMS: Omit<PersistentDataItem, 'sizeBytes' | 'recordCount' | 'lastModified'>[] = [
  // User Data
  {
    id: 'user_conversations',
    name: 'User Conversations',
    description: 'All chat history and conversation data from UDS',
    type: 'database',
    location: 'uds_conversations',
    includeInSync: true,
    includeInBackup: true,
    category: 'user_data',
    sensitivity: 'confidential',
    dependsOn: ['user_preferences'],
    dependents: ['user_analytics'],
  },
  {
    id: 'user_messages',
    name: 'User Messages',
    description: 'Individual messages within conversations',
    type: 'database',
    location: 'uds_messages',
    includeInSync: true,
    includeInBackup: true,
    category: 'user_data',
    sensitivity: 'confidential',
    dependsOn: ['user_conversations'],
    dependents: [],
  },
  {
    id: 'user_uploads',
    name: 'User Uploads',
    description: 'User-uploaded files and media',
    type: 's3',
    location: 'radiant-{env}-uploads',
    includeInSync: true,
    includeInBackup: true,
    category: 'media',
    sensitivity: 'confidential',
    dependsOn: [],
    dependents: [],
  },
  {
    id: 'user_preferences',
    name: 'User Preferences',
    description: 'User settings and personalization data',
    type: 'database',
    location: 'user_context_preferences',
    includeInSync: true,
    includeInBackup: true,
    category: 'user_data',
    sensitivity: 'internal',
    dependsOn: [],
    dependents: ['user_conversations'],
  },
  {
    id: 'user_persistent_context',
    name: 'User Persistent Context',
    description: 'Long-term user context for AI personalization',
    type: 'database',
    location: 'user_persistent_context',
    includeInSync: true,
    includeInBackup: true,
    category: 'user_data',
    sensitivity: 'confidential',
    dependsOn: ['user_preferences'],
    dependents: [],
  },
  
  // System Config
  {
    id: 'tenant_config',
    name: 'Tenant Configuration',
    description: 'Tenant settings, branding, and limits',
    type: 'database',
    location: 'tenants',
    includeInSync: true,
    includeInBackup: true,
    category: 'system_config',
    sensitivity: 'internal',
    dependsOn: [],
    dependents: ['feature_flags', 'model_config'],
  },
  {
    id: 'feature_flags',
    name: 'Feature Flags',
    description: 'Feature toggles per tenant',
    type: 'database',
    location: 'feature_flags',
    includeInSync: true,
    includeInBackup: true,
    category: 'system_config',
    sensitivity: 'internal',
    dependsOn: ['tenant_config'],
    dependents: [],
  },
  {
    id: 'model_config',
    name: 'AI Model Configuration',
    description: 'Model routing rules, thresholds, and settings',
    type: 'database',
    location: 'model_configurations',
    includeInSync: true,
    includeInBackup: true,
    category: 'system_config',
    sensitivity: 'internal',
    dependsOn: ['tenant_config'],
    dependents: [],
  },
  {
    id: 'routing_rules',
    name: 'Brain Routing Rules',
    description: 'AGI Brain routing configuration',
    type: 'database',
    location: 'brain_routing_rules',
    includeInSync: true,
    includeInBackup: true,
    category: 'system_config',
    sensitivity: 'internal',
    dependsOn: ['model_config'],
    dependents: [],
  },
  
  // AI Models
  {
    id: 'model_weights',
    name: 'Self-Hosted Model Weights',
    description: 'Fine-tuned model weights for self-hosted models',
    type: 's3',
    location: 'radiant-{env}-models',
    includeInSync: false, // Too large for routine sync
    includeInBackup: true,
    category: 'ai_models',
    sensitivity: 'restricted',
    dependsOn: [],
    dependents: ['model_metadata'],
  },
  {
    id: 'model_metadata',
    name: 'Model Registry Metadata',
    description: 'Model catalog and version information',
    type: 'database',
    location: 'self_hosted_models',
    includeInSync: true,
    includeInBackup: true,
    category: 'ai_models',
    sensitivity: 'internal',
    dependsOn: [],
    dependents: [],
  },
  
  // Curator / Knowledge
  {
    id: 'curator_documents',
    name: 'Curator Documents',
    description: 'Uploaded documents and knowledge base',
    type: 's3',
    location: 'radiant-{env}-curator',
    includeInSync: true,
    includeInBackup: true,
    category: 'user_data',
    sensitivity: 'confidential',
    dependsOn: [],
    dependents: ['curator_embeddings'],
  },
  {
    id: 'curator_embeddings',
    name: 'Curator Embeddings',
    description: 'Vector embeddings for semantic search',
    type: 'database',
    location: 'curator_embeddings',
    includeInSync: false, // Can be regenerated
    includeInBackup: true,
    category: 'ai_models',
    sensitivity: 'internal',
    dependsOn: ['curator_documents'],
    dependents: [],
  },
  
  // Audit Logs
  {
    id: 'audit_merkle',
    name: 'Merkle Audit Trail',
    description: 'Tamper-evident audit log with cryptographic chain',
    type: 'database',
    location: 'audit_merkle_chain',
    includeInSync: false, // Compliance: must not sync between envs
    includeInBackup: true,
    category: 'audit_logs',
    sensitivity: 'restricted',
    dependsOn: [],
    dependents: [],
    complianceHold: true,
  },
  {
    id: 'cato_safety_log',
    name: 'Cato Safety Decisions',
    description: 'Genesis Cato safety evaluation logs',
    type: 'database',
    location: 'cato_decisions',
    includeInSync: false, // Audit data
    includeInBackup: true,
    category: 'audit_logs',
    sensitivity: 'restricted',
    dependsOn: [],
    dependents: [],
  },
  {
    id: 'uds_audit_log',
    name: 'UDS Audit Log',
    description: 'User Data Service audit trail',
    type: 'database',
    location: 'uds_audit_log',
    includeInSync: false,
    includeInBackup: true,
    category: 'audit_logs',
    sensitivity: 'restricted',
    dependsOn: [],
    dependents: [],
  },
  
  // Analytics
  {
    id: 'user_analytics',
    name: 'User Analytics',
    description: 'Usage metrics and analytics data',
    type: 'database',
    location: 'analytics_events',
    includeInSync: false, // PII concerns
    includeInBackup: true,
    category: 'analytics',
    sensitivity: 'confidential',
    dependsOn: ['user_conversations'],
    dependents: [],
  },
  {
    id: 'model_analytics',
    name: 'Model Performance Analytics',
    description: 'AI model usage and performance metrics',
    type: 'database',
    location: 'model_analytics',
    includeInSync: true,
    includeInBackup: true,
    category: 'analytics',
    sensitivity: 'internal',
    dependsOn: [],
    dependents: [],
  },
  
  // Secrets (metadata only)
  {
    id: 'api_keys',
    name: 'API Keys',
    description: 'External API keys (OpenAI, Anthropic, etc.)',
    type: 'secret',
    location: 'radiant/{env}/api-keys',
    includeInSync: false, // Never sync secrets
    includeInBackup: false, // Secrets Manager handles this
    category: 'system_config',
    sensitivity: 'restricted',
    dependsOn: [],
    dependents: [],
  },
  {
    id: 'database_credentials',
    name: 'Database Credentials',
    description: 'Aurora PostgreSQL connection credentials',
    type: 'secret',
    location: 'radiant/{env}/db-credentials',
    includeInSync: false,
    includeInBackup: false,
    category: 'system_config',
    sensitivity: 'restricted',
    dependsOn: [],
    dependents: [],
  },
];

// ============================================================================
// Utility Types
// ============================================================================

export type ManifestValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checksumValid: boolean;
};

export type SyncPreview = {
  itemsToAdd: string[];
  itemsToUpdate: string[];
  itemsToRemove: string[];
  conflicts: SyncConflict[];
  estimatedDuration: number;
  estimatedDataTransfer: number;
  warnings: string[];
};

// ============================================================================
// Reliability & Fault Tolerance Types (v7.1.0)
// ============================================================================

/**
 * Storage configuration for manifests, backups, and packages.
 * Allows administrators to specify custom paths for large datasets.
 */
export interface StateRegistryStorageConfig {
  // Local storage paths (Swift Deployer)
  localManifestPath: string;
  localBackupPath: string;
  localPackagePath: string;
  localCachePath: string;
  
  // S3 storage configuration (AWS)
  s3ManifestBucket: string;
  s3BackupBucket: string;
  s3PackageBucket: string;
  s3Region: string;
  
  // Storage limits
  maxLocalCacheSizeGB: number;
  maxBackupRetentionDays: number;
  maxManifestVersions: number;
  
  // Cleanup policies
  autoCleanupEnabled: boolean;
  cleanupThresholdPercent: number; // Cleanup when disk usage exceeds this %
}

/**
 * Retry configuration with exponential backoff for transient failures.
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[]; // HTTP status codes or error types to retry
  jitterEnabled: boolean;
}

/**
 * Default retry configuration for different operation types.
 */
export const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  network: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', '502', '503', '504'],
    jitterEnabled: true,
  },
  sync: {
    maxRetries: 3,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    retryableErrors: ['LOCK_CONFLICT', 'RATE_LIMIT', 'TEMPORARY_FAILURE'],
    jitterEnabled: true,
  },
  backup: {
    maxRetries: 3,
    initialDelayMs: 10000,
    maxDelayMs: 120000,
    backoffMultiplier: 2,
    retryableErrors: ['S3_THROTTLE', 'DB_TIMEOUT', 'NETWORK_ERROR'],
    jitterEnabled: false,
  },
};

/**
 * Data integrity verification using multiple checksum algorithms.
 */
export interface DataIntegrityChecksum {
  algorithm: 'sha256' | 'sha512' | 'md5' | 'xxhash';
  value: string;
  computedAt: string;
  verified: boolean;
  verifiedAt?: string;
}

/**
 * Comprehensive backup validation result.
 */
export interface BackupValidationResult {
  backupId: string;
  validatedAt: string;
  
  // Overall status
  overallValid: boolean;
  validationDurationMs: number;
  
  // Component validation
  components: {
    infrastructure: ComponentValidation;
    database: ComponentValidation;
    s3: ComponentValidation;
    secrets: ComponentValidation;
    featureFlags: ComponentValidation;
  };
  
  // Data integrity
  integrityChecks: {
    checksumValid: boolean;
    checksumAlgorithm: string;
    expectedChecksum: string;
    actualChecksum: string;
  };
  
  // Recoverability assessment
  recoverability: {
    canRestore: boolean;
    estimatedRestoreTime: number;
    blockers: string[];
    warnings: string[];
  };
}

export interface ComponentValidation {
  valid: boolean;
  itemCount: number;
  validItems: number;
  invalidItems: string[];
  missingDependencies: string[];
  sizeBytes: number;
}

/**
 * Conflict resolution strategies for sync operations.
 */
export type ConflictResolutionStrategy = 
  | 'source_wins'      // Always use source value
  | 'target_wins'      // Always keep target value
  | 'newest_wins'      // Use the most recently modified value
  | 'manual'           // Require manual resolution
  | 'merge'            // Attempt to merge (for compatible data types)
  | 'skip';            // Skip conflicting items

/**
 * Enhanced sync configuration with conflict resolution.
 */
export interface EnhancedSyncConfig {
  // Base sync settings
  enabled: boolean;
  sourceEnvironment?: EnvironmentName;
  
  // Conflict handling
  conflictResolution: ConflictResolutionStrategy;
  conflictNotifications: boolean;
  autoResolveThreshold: number; // Auto-resolve if confidence > this %
  
  // Retry and timeout settings
  retryConfig: RetryConfig;
  operationTimeoutMs: number;
  itemTimeoutMs: number;
  
  // Data validation
  validateBeforeSync: boolean;
  validateAfterSync: boolean;
  checksumVerification: boolean;
  
  // Rollback settings
  createCheckpointBeforeSync: boolean;
  autoRollbackOnFailure: boolean;
  rollbackThresholdPercent: number; // Rollback if > this % of items fail
  
  // Rate limiting
  maxConcurrentItems: number;
  throttleDelayMs: number;
  
  // Notifications
  notifyOnStart: boolean;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
  notifyOnConflict: boolean;
  notificationChannels: ('email' | 'slack' | 'webhook')[];
}

/**
 * Health check result for State Registry components.
 */
export interface StateRegistryHealthCheck {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  
  components: {
    localCache: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      diskSpaceAvailableGB: number;
      diskSpaceUsedGB: number;
      lastWriteAt?: string;
      errors: string[];
    };
    s3Connection: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      latencyMs: number;
      lastSuccessfulAt?: string;
      errors: string[];
    };
    apiConnection: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      latencyMs: number;
      lastSuccessfulAt?: string;
      errors: string[];
    };
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      connectionPoolUsage: number;
      lastSuccessfulAt?: string;
      errors: string[];
    };
  };
  
  // Reliability metrics
  metrics: {
    uptime: number; // Percentage
    successRate: number; // Percentage of successful operations
    avgLatencyMs: number;
    errorCount24h: number;
    lastErrorAt?: string;
    lastError?: string;
  };
}

/**
 * Fallback configuration for graceful degradation.
 */
export interface FallbackConfig {
  // Cache fallback
  useCacheOnNetworkFailure: boolean;
  maxCacheAgeMinutes: number;
  
  // Partial sync fallback
  continueOnPartialFailure: boolean;
  minSuccessThreshold: number; // Minimum % of items that must succeed
  
  // Alternative storage fallback
  fallbackStoragePath?: string;
  fallbackS3Bucket?: string;
  
  // Read-only mode fallback
  enableReadOnlyOnWriteFailure: boolean;
  
  // Retry escalation
  escalateAfterRetries: number;
  escalationNotificationChannels: ('email' | 'slack' | 'pagerduty')[];
}

/**
 * Operation checkpoint for recovery and rollback.
 */
export interface OperationCheckpoint {
  id: string;
  operationType: 'sync' | 'backup' | 'restore';
  operationId: string;
  createdAt: string;
  
  // State snapshot
  state: {
    phase: string;
    itemsCompleted: string[];
    itemsPending: string[];
    itemsFailed: string[];
  };
  
  // Recovery info
  canResume: boolean;
  resumeFrom?: string;
  
  // Checksum of state
  stateChecksum: DataIntegrityChecksum;
}

/**
 * Comprehensive error with recovery suggestions.
 */
export interface RecoverableError {
  code: string;
  message: string;
  timestamp: string;
  
  // Error classification
  category: 'network' | 'storage' | 'permission' | 'data' | 'timeout' | 'conflict' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isTransient: boolean;
  
  // Recovery information
  recoverable: boolean;
  suggestedActions: string[];
  autoRecoveryAttempted: boolean;
  autoRecoverySucceeded?: boolean;
  
  // Context
  operationId?: string;
  itemId?: string;
  environment?: EnvironmentName;
  
  // Retry tracking
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
}

/**
 * Default storage configuration.
 */
export const DEFAULT_STORAGE_CONFIG: StateRegistryStorageConfig = {
  // Local paths (will be overridden by admin)
  localManifestPath: '~/Library/Application Support/RadiantDeployer/StateRegistry/manifests',
  localBackupPath: '~/Library/Application Support/RadiantDeployer/StateRegistry/backups',
  localPackagePath: '~/Library/Application Support/RadiantDeployer/StateRegistry/packages',
  localCachePath: '~/Library/Application Support/RadiantDeployer/StateRegistry/cache',
  
  // S3 (template - actual bucket names include environment)
  s3ManifestBucket: 'radiant-{env}-state-manifests',
  s3BackupBucket: 'radiant-{env}-state-backups',
  s3PackageBucket: 'radiant-{env}-deployment-packages',
  s3Region: 'us-east-1',
  
  // Limits
  maxLocalCacheSizeGB: 50,
  maxBackupRetentionDays: 90,
  maxManifestVersions: 100,
  
  // Cleanup
  autoCleanupEnabled: true,
  cleanupThresholdPercent: 85,
};

/**
 * Default fallback configuration.
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  useCacheOnNetworkFailure: true,
  maxCacheAgeMinutes: 60,
  continueOnPartialFailure: true,
  minSuccessThreshold: 80,
  enableReadOnlyOnWriteFailure: true,
  escalateAfterRetries: 3,
  escalationNotificationChannels: ['email'],
};

/**
 * SLA targets for reliability.
 */
export const RELIABILITY_SLA_TARGETS = {
  availability: 99.99, // 4 nines = 52 minutes downtime/year
  syncSuccessRate: 99.9,
  backupSuccessRate: 99.99,
  restoreSuccessRate: 99.9,
  maxSyncLatencyMs: 30000,
  maxBackupLatencyMs: 300000,
  maxRestoreLatencyMs: 600000,
  maxApiLatencyMs: 5000,
  dataIntegrityRate: 100, // Must be 100%
};

// =============================================================================
// AWS Snapshot Types (v7.1.0)
// =============================================================================

/**
 * AWS snapshot configuration for automated instance snapshots.
 */
export interface AWSSnapshotConfig {
  // Schedule
  enabled: boolean;
  scheduleType: 'interval' | 'cron';
  intervalHours: number; // Default: 24
  cronExpression?: string; // e.g., "0 2 * * *" for 2AM daily
  timezone: string; // Default: 'America/Los_Angeles' (PT)
  
  // What to snapshot
  snapshotRDS: boolean;
  snapshotS3: boolean; // Enable versioning + replication
  snapshotSecrets: boolean;
  snapshotDynamoDB: boolean;
  
  // Retention
  retentionDays: number; // Default: 30
  maxSnapshots?: number; // Optional cap on total snapshots
  
  // Storage
  storageClass: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  crossRegionReplication: boolean;
  replicationRegion?: string;
  
  // Notifications
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  notificationChannels: ('email' | 'slack' | 'pagerduty' | 'sns')[];
}

/**
 * Individual AWS snapshot record.
 */
export interface AWSSnapshot {
  id: string;
  environment: EnvironmentName;
  tenantId: string;
  
  // Timing
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
  
  // Type
  type: 'scheduled' | 'manual' | 'pre-deployment' | 'pre-sync';
  trigger: 'automatic' | 'user' | 'system';
  triggeredBy?: string; // User ID or system name
  
  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired' | 'deleted';
  progress: {
    phase: 'rds' | 's3' | 'secrets' | 'dynamodb' | 'verification' | 'complete';
    percentComplete: number;
    currentComponent?: string;
  };
  
  // Components
  components: AWSSnapshotComponent[];
  
  // Metadata
  description?: string;
  tags: Record<string, string>;
  
  // Size and cost
  totalSizeBytes: number;
  estimatedMonthlyCostUSD: number;
  
  // Integrity
  checksums: {
    manifest: string;
    components: Record<string, string>;
  };
  
  // Restore info
  restoreCount: number;
  lastRestoredAt?: string;
  lastRestoredBy?: string;
  
  // Errors
  errors: AWSSnapshotError[];
}

/**
 * Individual component within a snapshot.
 */
export interface AWSSnapshotComponent {
  type: 'rds_cluster' | 'rds_instance' | 's3_bucket' | 'dynamodb_table' | 'secret';
  name: string;
  arn: string;
  
  // AWS snapshot identifiers
  awsSnapshotId?: string; // For RDS
  awsSnapshotArn?: string;
  versionId?: string; // For S3/Secrets
  
  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  
  // Size
  sizeBytes: number;
  
  // Checksum
  checksum?: string;
  checksumAlgorithm?: 'SHA256' | 'MD5';
  
  // Error
  error?: string;
}

/**
 * Snapshot error details.
 */
export interface AWSSnapshotError {
  timestamp: string;
  component?: string;
  code: string;
  message: string;
  awsErrorCode?: string;
  recoverable: boolean;
  suggestedAction?: string;
}

/**
 * Request to create a manual snapshot.
 */
export interface CreateAWSSnapshotRequest {
  environment: EnvironmentName;
  description?: string;
  
  // What to include
  includeRDS?: boolean; // Default: true
  includeS3?: boolean; // Default: true
  includeSecrets?: boolean; // Default: true
  includeDynamoDB?: boolean; // Default: true
  
  // Retention override
  retentionDays?: number;
  
  // Tags
  tags?: Record<string, string>;
  
  // Who's creating
  createdBy: string;
}

/**
 * Response from snapshot creation.
 */
export interface CreateAWSSnapshotResponse {
  success: boolean;
  snapshotId?: string;
  estimatedDurationMinutes?: number;
  error?: string;
}

/**
 * Request to restore from a snapshot.
 */
export interface RestoreAWSSnapshotRequest {
  snapshotId: string;
  targetEnvironment: EnvironmentName;
  
  // What to restore
  restoreRDS?: boolean;
  restoreS3?: boolean;
  restoreSecrets?: boolean;
  restoreDynamoDB?: boolean;
  
  // Options
  createNewCluster?: boolean; // For RDS - create new vs replace
  newClusterSuffix?: string; // e.g., "-restored"
  
  // Verification
  validateBeforeRestore?: boolean;
  
  // Who's restoring
  restoredBy: string;
}

/**
 * Response from snapshot restore.
 */
export interface RestoreAWSSnapshotResponse {
  success: boolean;
  restoreOperationId?: string;
  estimatedDurationMinutes?: number;
  
  // For RDS new cluster creation
  newClusterEndpoint?: string;
  
  // Warnings
  warnings?: string[];
  
  error?: string;
}

/**
 * Snapshot list query parameters.
 */
export interface ListAWSSnapshotsRequest {
  environment?: EnvironmentName;
  status?: AWSSnapshot['status'];
  type?: AWSSnapshot['type'];
  
  // Date range
  createdAfter?: string;
  createdBefore?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: 'createdAt' | 'sizeBytes' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Snapshot list response.
 */
export interface ListAWSSnapshotsResponse {
  success: boolean;
  snapshots: AWSSnapshot[];
  total: number;
  hasMore: boolean;
  error?: string;
}

/**
 * Snapshot validation result.
 */
export interface AWSSnapshotValidation {
  snapshotId: string;
  validatedAt: string;
  
  // Overall
  isValid: boolean;
  canRestore: boolean;
  
  // Component validation
  components: {
    name: string;
    type: string;
    valid: boolean;
    exists: boolean;
    checksumValid?: boolean;
    error?: string;
  }[];
  
  // Restore estimate
  estimatedRestoreTime: {
    rds: number; // minutes
    s3: number;
    secrets: number;
    dynamodb: number;
    total: number;
  };
  
  // Blockers
  blockers: string[];
  warnings: string[];
}

/**
 * Default AWS snapshot configuration.
 */
export const DEFAULT_AWS_SNAPSHOT_CONFIG: AWSSnapshotConfig = {
  enabled: true,
  scheduleType: 'cron',
  intervalHours: 24,
  cronExpression: '0 10 * * *', // 2AM PT = 10:00 UTC
  timezone: 'America/Los_Angeles',
  
  snapshotRDS: true,
  snapshotS3: true,
  snapshotSecrets: true,
  snapshotDynamoDB: true,
  
  retentionDays: 30,
  
  storageClass: 'STANDARD',
  crossRegionReplication: false,
  
  notifyOnSuccess: false,
  notifyOnFailure: true,
  notificationChannels: ['email'],
};
