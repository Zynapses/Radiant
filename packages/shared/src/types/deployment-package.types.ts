/**
 * Deployment Package Types
 * 
 * Versioned deployment packages that capture everything needed to recreate
 * a RADIANT/Think Tank system from scratch.
 * 
 * Flow:
 * 1. Capture current AWS state
 * 2. Generate deployment package from that state
 * 3. Store package in S3 with checksums
 * 4. Can restore entire system from package
 * 
 * @version 7.1.0
 * @since 2026-02-04
 */

import { EnvironmentName } from './environment-state.types';

// =============================================================================
// Deployment Package Core Types
// =============================================================================

/**
 * Complete deployment package manifest.
 * Contains everything needed to recreate a RADIANT system.
 */
export interface DeploymentPackage {
  // Package identification
  id: string;
  version: string; // RADIANT version (e.g., "7.1.0")
  packageVersion: string; // Package build number (e.g., "7.1.0-build.1234")
  environment: EnvironmentName;
  tenantId: string;
  
  // Timestamps
  createdAt: string;
  capturedAt: string; // When AWS state was captured
  expiresAt?: string;
  
  // Package metadata
  description?: string;
  tags: Record<string, string>;
  
  // Source information
  sourceType: 'aws_capture' | 'git_build' | 'manual';
  sourceCommit?: string; // Git commit hash if from git
  sourceBranch?: string;
  
  // Package contents
  contents: DeploymentPackageContents;
  
  // Checksums for integrity verification
  checksums: DeploymentPackageChecksums;
  
  // Size information
  totalSizeBytes: number;
  componentSizes: Record<string, number>;
  
  // Restore information
  restoreCount: number;
  lastRestoredAt?: string;
  lastRestoredBy?: string;
  
  // Status
  status: 'creating' | 'complete' | 'failed' | 'expired' | 'deleted';
  errors?: PackageError[];
}

/**
 * Contents of a deployment package.
 */
export interface DeploymentPackageContents {
  // Infrastructure
  cdkBundle: PackageArtifact;
  cdkContext: Record<string, unknown>; // cdk.context.json
  
  // Application code
  lambdaBundle: PackageArtifact;
  lambdaFunctions: LambdaFunctionInfo[];
  
  // Dashboard
  dashboardBundle: PackageArtifact;
  dashboardConfig: Record<string, unknown>;
  
  // Database
  migrations: MigrationInfo[];
  migrationBundle: PackageArtifact;
  
  // Configuration
  featureFlags: Record<string, unknown>;
  aiModelConfig: Record<string, unknown>;
  tierConfig: Record<string, unknown>;
  
  // State capture
  infrastructureManifest: PackageArtifact; // Full AWS state capture
  
  // Optional: Persistent data
  persistentData?: PersistentDataConfig;
}

/**
 * Individual artifact within a package.
 */
export interface PackageArtifact {
  name: string;
  path: string; // Path within package (e.g., "cdk-bundle.zip")
  s3Key: string; // Full S3 key
  sizeBytes: number;
  checksum: string;
  checksumAlgorithm: 'SHA256' | 'MD5';
  contentType: string;
  compressed: boolean;
  compressionType?: 'gzip' | 'zip' | 'tar.gz';
}

/**
 * Lambda function information.
 */
export interface LambdaFunctionInfo {
  functionName: string;
  handler: string;
  runtime: string;
  memorySize: number;
  timeout: number;
  environment: Record<string, string>;
  layers: string[];
  codeSize: number;
  codeChecksum: string;
}

/**
 * Database migration information.
 */
export interface MigrationInfo {
  version: string; // e.g., "V001", "V044"
  name: string;
  filename: string;
  checksum: string;
  appliedAt?: string;
  executionTime?: number;
}

/**
 * Persistent data configuration for restore.
 */
export interface PersistentDataConfig {
  includeRdsData: boolean;
  includeS3Data: boolean;
  includeDynamoData: boolean;
  includeSecrets: boolean;
  
  // Selective inclusion
  s3BucketsToInclude?: string[];
  dynamoTablesToInclude?: string[];
  
  // Data snapshots
  rdsSnapshotId?: string;
  dynamoBackupArns?: Record<string, string>;
  s3VersionMarkers?: Record<string, string>;
}

/**
 * Package checksums for integrity verification.
 */
export interface DeploymentPackageChecksums {
  manifest: string; // Checksum of the manifest itself
  cdkBundle: string;
  lambdaBundle: string;
  dashboardBundle: string;
  migrationBundle: string;
  infrastructureManifest: string;
  full: string; // Combined checksum of all artifacts
}

/**
 * Package error information.
 */
export interface PackageError {
  timestamp: string;
  phase: string;
  code: string;
  message: string;
  recoverable: boolean;
}

// =============================================================================
// Package Creation Types
// =============================================================================

/**
 * Request to create a deployment package.
 */
export interface CreateDeploymentPackageRequest {
  environment: EnvironmentName;
  description?: string;
  
  // Source type
  sourceType: 'aws_capture' | 'git_build';
  gitCommit?: string;
  gitBranch?: string;
  
  // What to include
  includeCdk: boolean;
  includeLambdas: boolean;
  includeDashboard: boolean;
  includeMigrations: boolean;
  includeConfig: boolean;
  
  // Persistent data options
  persistentData?: {
    includeRdsData: boolean;
    includeS3Data: boolean;
    includeDynamoData: boolean;
    includeSecrets: boolean;
    s3BucketsToInclude?: string[];
    dynamoTablesToInclude?: string[];
  };
  
  // Tags
  tags?: Record<string, string>;
  
  // Who's creating
  createdBy: string;
}

/**
 * Response from package creation.
 */
export interface CreateDeploymentPackageResponse {
  success: boolean;
  packageId?: string;
  estimatedSizeBytes?: number;
  estimatedDurationMinutes?: number;
  error?: string;
}

// =============================================================================
// Package Restore Types
// =============================================================================

/**
 * Request to restore from a deployment package.
 */
export interface RestoreFromPackageRequest {
  packageId: string;
  targetEnvironment: EnvironmentName;
  
  // What to restore
  restoreCdk: boolean;
  restoreLambdas: boolean;
  restoreDashboard: boolean;
  runMigrations: boolean;
  restoreConfig: boolean;
  
  // Persistent data options
  restorePersistentData?: {
    restoreRdsData: boolean;
    restoreS3Data: boolean;
    restoreDynamoData: boolean;
    restoreSecrets: boolean;
  };
  
  // Options
  createNewResources: boolean; // Create new vs replace existing
  resourceSuffix?: string; // e.g., "-restored"
  validateBeforeRestore: boolean;
  dryRun: boolean; // Preview without actually restoring
  
  // Who's restoring
  restoredBy: string;
}

/**
 * Response from package restore.
 */
export interface RestoreFromPackageResponse {
  success: boolean;
  restoreOperationId?: string;
  
  // Progress
  progress?: RestoreProgress;
  
  // Results
  restoredResources?: RestoredResource[];
  
  // New resource endpoints (if createNewResources=true)
  newEndpoints?: {
    apiGateway?: string;
    dashboard?: string;
    database?: string;
  };
  
  // Warnings
  warnings?: string[];
  
  error?: string;
}

/**
 * Restore operation progress.
 */
export interface RestoreProgress {
  phase: 'validating' | 'cdk' | 'lambdas' | 'dashboard' | 'migrations' | 'data' | 'verification' | 'complete';
  percentComplete: number;
  currentStep?: string;
  stepsCompleted: number;
  stepsTotal: number;
  estimatedTimeRemaining?: number; // seconds
}

/**
 * Individual restored resource.
 */
export interface RestoredResource {
  type: 'stack' | 'lambda' | 'bucket' | 'table' | 'secret' | 'dashboard';
  name: string;
  arn?: string;
  status: 'pending' | 'restoring' | 'success' | 'failed' | 'skipped';
  error?: string;
}

// =============================================================================
// Package Management Types
// =============================================================================

/**
 * List packages request.
 */
export interface ListDeploymentPackagesRequest {
  environment?: EnvironmentName;
  status?: DeploymentPackage['status'];
  sourceType?: DeploymentPackage['sourceType'];
  
  // Date range
  createdAfter?: string;
  createdBefore?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: 'createdAt' | 'version' | 'sizeBytes';
  sortOrder?: 'asc' | 'desc';
}

/**
 * List packages response.
 */
export interface ListDeploymentPackagesResponse {
  success: boolean;
  packages: DeploymentPackage[];
  total: number;
  hasMore: boolean;
  error?: string;
}

/**
 * Package validation result.
 */
export interface PackageValidationResult {
  packageId: string;
  validatedAt: string;
  
  // Overall status
  isValid: boolean;
  canRestore: boolean;
  
  // Component validation
  components: {
    name: string;
    valid: boolean;
    exists: boolean;
    checksumValid: boolean;
    error?: string;
  }[];
  
  // Compatibility checks
  compatibility: {
    cdkVersion: string;
    nodeVersion: string;
    awsRegion: string;
    compatible: boolean;
    issues?: string[];
  };
  
  // Restore estimate
  estimatedRestoreTime: {
    cdk: number; // minutes
    lambdas: number;
    dashboard: number;
    migrations: number;
    data: number;
    total: number;
  };
  
  // Blockers and warnings
  blockers: string[];
  warnings: string[];
}

// =============================================================================
// Sync Status Types (for "Completed with errors")
// =============================================================================

/**
 * Enhanced sync status that distinguishes success from partial success.
 */
export type EnhancedSyncStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'           // 100% success
  | 'completed_with_errors' // Partial success (configurable threshold met)
  | 'failed'              // Below threshold or critical failure
  | 'cancelled'
  | 'rolled_back';

/**
 * Sync result with detailed breakdown.
 */
export interface EnhancedSyncResult {
  status: EnhancedSyncStatus;
  
  // Counts
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  
  // Percentage
  successRate: number; // 0-100
  
  // Threshold used
  successThreshold: number; // Default: 80
  
  // Failed items detail
  failures: {
    itemId: string;
    itemType: string;
    error: string;
    recoverable: boolean;
  }[];
  
  // Warnings
  warnings: string[];
  
  // Timing
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

// =============================================================================
// Health Check Types (for monitoring dashboard)
// =============================================================================

/**
 * System health status.
 */
export interface SystemHealthStatus {
  timestamp: string;
  environment: EnvironmentName;
  
  // Overall status
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  
  // Component health
  components: DeploymentComponentHealth[];
  
  // Metrics
  metrics: HealthMetrics;
  
  // Active alerts
  alerts: HealthAlert[];
  
  // SLA compliance
  slaCompliance: {
    availability: number; // percentage
    syncSuccessRate: number;
    backupSuccessRate: number;
    avgLatencyMs: number;
    meetsTargets: boolean;
  };
}

/**
 * Individual component health for deployment monitoring.
 */
export interface DeploymentComponentHealth {
  name: string;
  type: 'database' | 's3' | 'lambda' | 'api' | 'cache' | 'queue';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  
  // Details
  latencyMs?: number;
  errorRate?: number;
  lastChecked: string;
  
  // Resource-specific
  connectionCount?: number;
  storageUsedBytes?: number;
  storageAvailableBytes?: number;
  
  // Issues
  issues?: string[];
}

/**
 * Health metrics.
 */
export interface HealthMetrics {
  // Performance
  avgApiLatencyMs: number;
  p95ApiLatencyMs: number;
  p99ApiLatencyMs: number;
  
  // Throughput
  requestsPerMinute: number;
  errorsPerMinute: number;
  
  // Resources
  cpuUtilization: number;
  memoryUtilization: number;
  connectionPoolUsage: number;
  
  // Storage
  databaseSizeBytes: number;
  s3SizeBytes: number;
  cacheSizeBytes: number;
}

/**
 * Health alert.
 */
export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// =============================================================================
// Offline Mode Types
// =============================================================================

/**
 * Offline mode status.
 */
export interface OfflineModeStatus {
  isOffline: boolean;
  offlineSince?: string;
  
  // Cache status
  cacheStatus: {
    available: boolean;
    lastSyncAt?: string;
    ageMinutes?: number;
    isStale: boolean;
    itemCount: number;
  };
  
  // Connection attempts
  connectionAttempts: {
    count: number;
    lastAttemptAt?: string;
    nextAttemptAt?: string;
    backoffSeconds: number;
  };
  
  // Pending operations
  pendingOperations: {
    count: number;
    types: string[];
    willSyncOnReconnect: boolean;
  };
  
  // User actions available
  availableActions: string[];
  unavailableActions: string[];
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default deployment package configuration.
 */
export const DEFAULT_PACKAGE_CONFIG = {
  retentionDays: 90,
  maxPackagesPerEnvironment: 50,
  compressionType: 'zip' as const,
  checksumAlgorithm: 'SHA256' as const,
  
  // What to include by default
  defaults: {
    includeCdk: true,
    includeLambdas: true,
    includeDashboard: true,
    includeMigrations: true,
    includeConfig: true,
    includeRdsData: false, // Large, user's choice
    includeS3Data: false,  // Large, user's choice
    includeDynamoData: false, // Large, user's choice
    includeSecrets: true,
  },
};

/**
 * Default sync thresholds.
 */
export const DEFAULT_SYNC_THRESHOLDS = {
  successThreshold: 80, // Percentage required for "completed_with_errors"
  criticalFailureThreshold: 50, // Below this = "failed"
  warningThreshold: 95, // Above this = clean "completed"
};

/**
 * Default health check intervals.
 */
export const DEFAULT_HEALTH_CHECK_CONFIG = {
  intervalSeconds: 30,
  timeoutSeconds: 10,
  unhealthyThreshold: 3, // Consecutive failures before unhealthy
  healthyThreshold: 2, // Consecutive successes before healthy
};
