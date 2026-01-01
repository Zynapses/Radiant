// RADIANT v4.18.0 - Library Execution Types
// Multi-tenant concurrent library execution with isolation

// ============================================================================
// Execution Request/Response
// ============================================================================

export interface LibraryExecutionRequest {
  executionId: string;
  tenantId: string;
  userId: string;
  libraryId: string;
  
  /** Type of execution */
  executionType: LibraryExecutionType;
  
  /** Code to execute (Python, JavaScript, etc.) */
  code: string;
  
  /** Input data for the execution */
  input?: LibraryExecutionInput;
  
  /** Execution constraints */
  constraints: ExecutionConstraints;
  
  /** Context for tracing */
  context?: {
    conversationId?: string;
    requestId?: string;
    taskType?: string;
  };
  
  /** Priority (higher = more urgent) */
  priority?: number;
  
  /** Callback URL for async results */
  callbackUrl?: string;
}

export type LibraryExecutionType = 
  | 'code_execution'      // Run arbitrary code with library
  | 'data_transformation' // Transform data using library
  | 'analysis'            // Analyze data/content
  | 'inference'           // ML model inference
  | 'optimization'        // Optimization problems
  | 'visualization'       // Generate charts/graphs
  | 'file_processing'     // Process files (PDF, images, etc.)
  | 'web_scraping'        // Fetch and parse web content
  | 'api_call';           // Call external API via library

export interface LibraryExecutionInput {
  /** Inline data (JSON-serializable) */
  data?: unknown;
  
  /** S3 references for large data */
  s3References?: S3Reference[];
  
  /** Environment variables for execution */
  environment?: Record<string, string>;
  
  /** Arguments to pass to the code */
  arguments?: string[];
}

export interface S3Reference {
  bucket: string;
  key: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface ExecutionConstraints {
  /** Maximum execution time in seconds */
  maxDurationSeconds: number;
  
  /** Maximum memory in MB */
  maxMemoryMb: number;
  
  /** Maximum output size in bytes */
  maxOutputBytes: number;
  
  /** Allow network access */
  allowNetwork: boolean;
  
  /** Allow file system writes */
  allowFileWrites: boolean;
  
  /** Allowed domains for network access */
  allowedDomains?: string[];
}

export interface LibraryExecutionResult {
  executionId: string;
  status: LibraryExecutionStatus;
  
  /** Execution output */
  output?: LibraryExecutionOutput;
  
  /** Error details if failed */
  error?: ExecutionError;
  
  /** Execution metrics */
  metrics: ExecutionMetrics;
  
  /** Billing info */
  billing: ExecutionBilling;
}

export type LibraryExecutionStatus = 
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled'
  | 'resource_exceeded';

export interface LibraryExecutionOutput {
  /** Result data (JSON-serializable) */
  data?: unknown;
  
  /** Text output (stdout) */
  stdout?: string;
  
  /** Error output (stderr) */
  stderr?: string;
  
  /** Generated files stored in S3 */
  files?: S3Reference[];
  
  /** Generated code (if applicable) */
  generatedCode?: string;
}

export interface ExecutionError {
  code: string;
  message: string;
  stackTrace?: string;
  category: 'user_error' | 'system_error' | 'timeout' | 'resource_exceeded' | 'security_violation';
}

export interface ExecutionMetrics {
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  /** Total duration in milliseconds */
  durationMs?: number;
  
  /** Queue wait time in milliseconds */
  queueWaitMs?: number;
  
  /** Peak memory usage in MB */
  peakMemoryMb?: number;
  
  /** CPU time in milliseconds */
  cpuTimeMs?: number;
  
  /** Network bytes transferred */
  networkBytesIn?: number;
  networkBytesOut?: number;
}

export interface ExecutionBilling {
  /** Compute units consumed */
  computeUnits: number;
  
  /** Estimated cost in credits */
  creditsUsed: number;
  
  /** Pricing tier applied */
  pricingTier: 'free' | 'standard' | 'premium';
}

// ============================================================================
// Tenant Execution Configuration
// ============================================================================

export interface TenantExecutionConfig {
  tenantId: string;
  
  /** Whether library execution is enabled */
  executionEnabled: boolean;
  
  /** Maximum concurrent executions per tenant */
  maxConcurrentExecutions: number;
  
  /** Maximum concurrent executions per user */
  maxConcurrentPerUser: number;
  
  /** Default execution constraints */
  defaultConstraints: ExecutionConstraints;
  
  /** Per-library overrides */
  libraryOverrides?: Record<string, Partial<ExecutionConstraints>>;
  
  /** Daily execution budget (in credits) */
  dailyBudget?: number;
  
  /** Monthly execution budget (in credits) */
  monthlyBudget?: number;
  
  /** Allowed execution types */
  allowedExecutionTypes: LibraryExecutionType[];
  
  /** Blocked libraries */
  blockedLibraries: string[];
  
  /** Priority boost (for premium tenants) */
  priorityBoost: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Execution Queue
// ============================================================================

export interface QueuedExecution {
  executionId: string;
  tenantId: string;
  userId: string;
  priority: number;
  queuedAt: Date;
  estimatedStartAt?: Date;
  request: LibraryExecutionRequest;
}

export interface ExecutionQueueStatus {
  tenantId: string;
  
  /** Current queue depth */
  queueDepth: number;
  
  /** Active executions */
  activeExecutions: number;
  
  /** Average wait time in seconds */
  avgWaitTimeSeconds: number;
  
  /** Estimated wait for new execution */
  estimatedWaitSeconds: number;
  
  /** Queue health */
  health: 'healthy' | 'degraded' | 'overloaded';
}

// ============================================================================
// Executor Pool
// ============================================================================

export interface ExecutorPoolStatus {
  /** Available executors by type */
  executors: {
    lambda: { available: number; busy: number; maxCapacity: number };
    fargate: { available: number; busy: number; maxCapacity: number };
    sagemaker: { available: number; busy: number; maxCapacity: number };
  };
  
  /** Overall pool utilization (0-1) */
  utilization: number;
  
  /** Auto-scaling status */
  scaling: {
    isScaling: boolean;
    targetCapacity: number;
    currentCapacity: number;
  };
}

// ============================================================================
// Execution Dashboard
// ============================================================================

export interface ExecutionDashboard {
  config: TenantExecutionConfig;
  
  stats: {
    totalExecutions24h: number;
    successfulExecutions24h: number;
    failedExecutions24h: number;
    avgDurationMs: number;
    creditsUsed24h: number;
    creditsRemaining: number;
  };
  
  queueStatus: ExecutionQueueStatus;
  
  activeExecutions: Array<{
    executionId: string;
    libraryId: string;
    userId: string;
    status: LibraryExecutionStatus;
    startedAt: Date;
    durationMs: number;
  }>;
  
  recentExecutions: Array<{
    executionId: string;
    libraryId: string;
    userId: string;
    status: LibraryExecutionStatus;
    completedAt: Date;
    durationMs: number;
    creditsUsed: number;
  }>;
  
  topLibraries: Array<{
    libraryId: string;
    executionCount: number;
    avgDurationMs: number;
    successRate: number;
  }>;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_EXECUTION_CONSTRAINTS: ExecutionConstraints = {
  maxDurationSeconds: 60,
  maxMemoryMb: 512,
  maxOutputBytes: 10 * 1024 * 1024, // 10MB
  allowNetwork: false,
  allowFileWrites: false,
};

export const DEFAULT_TENANT_EXECUTION_CONFIG: Omit<TenantExecutionConfig, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  executionEnabled: true,
  maxConcurrentExecutions: 10,
  maxConcurrentPerUser: 3,
  defaultConstraints: DEFAULT_EXECUTION_CONSTRAINTS,
  allowedExecutionTypes: [
    'code_execution',
    'data_transformation',
    'analysis',
    'visualization',
  ],
  blockedLibraries: [],
  priorityBoost: 0,
};

// ============================================================================
// Pricing
// ============================================================================

export const EXECUTION_PRICING = {
  /** Credits per second of execution */
  creditsPerSecond: 0.001,
  
  /** Credits per MB of memory per second */
  creditsPerMbSecond: 0.0001,
  
  /** Credits per MB of output */
  creditsPerMbOutput: 0.01,
  
  /** Minimum credits per execution */
  minimumCredits: 0.01,
  
  /** Premium tier multiplier */
  premiumMultiplier: 2.0,
};
