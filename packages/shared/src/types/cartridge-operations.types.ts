/**
 * Cartridge Operations Types (Time Machine Integration)
 * 
 * Long-running cartridge operations with checkpointing, progress tracking,
 * and resume capability using Time Machine.
 * 
 * @version 1.0.0
 * @since v6.2.0
 */

// =============================================================================
// Operation Types
// =============================================================================

/**
 * Types of cartridge operations
 */
export type CartridgeOperationType = 
  | 'import'            // Import cartridge from .RADz
  | 'export'            // Export cartridge to .RADz
  | 'compile_rnir'      // Compile RNIR to LoRA/prompts
  | 'federation_sync'   // Sync with federated cluster
  | 'bulk_export'       // Export multiple cartridges
  | 'bulk_import'       // Import multiple cartridges
  | 'migration'         // Migrate cartridge to new format
  | 'validation';       // Full validation check

/**
 * Operation status
 */
export type CartridgeOperationStatus = 
  | 'pending'           // Waiting to start
  | 'initializing'      // Setting up operation
  | 'in_progress'       // Running
  | 'paused'            // Manually paused
  | 'checkpointing'     // Saving checkpoint
  | 'resuming'          // Resuming from checkpoint
  | 'completed'         // Successfully completed
  | 'failed'            // Failed with error
  | 'cancelled'         // User cancelled
  | 'rolled_back';      // Rolled back to checkpoint

/**
 * Operation step definition
 */
export interface CartridgeOperationStep {
  /** Step ID */
  id: string;
  
  /** Step name */
  name: string;
  
  /** Step description */
  description: string;
  
  /** Step order (1-based) */
  order: number;
  
  /** Estimated duration in seconds */
  estimatedDurationSeconds: number;
  
  /** Whether this step is checkpointable */
  checkpointable: boolean;
  
  /** Whether this step is rollbackable */
  rollbackable: boolean;
}

/**
 * Operation step status
 */
export interface CartridgeOperationStepStatus {
  /** Step ID */
  stepId: string;
  
  /** Status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  
  /** Progress within step (0-100) */
  progress: number;
  
  /** Started at */
  startedAt?: string;
  
  /** Completed at */
  completedAt?: string;
  
  /** Error message if failed */
  error?: string;
  
  /** Step-specific metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Checkpoint Types
// =============================================================================

/**
 * Checkpoint data for resuming operations
 */
export interface CartridgeOperationCheckpoint {
  /** Checkpoint ID */
  id: string;
  
  /** Operation ID */
  operationId: string;
  
  /** Step ID this checkpoint is for */
  stepId: string;
  
  /** Step progress at checkpoint */
  stepProgress: number;
  
  /** Serialized state for resuming */
  state: Record<string, unknown>;
  
  /** Created at */
  createdAt: string;
  
  /** S3 path to any partial artifacts */
  partialArtifactPath?: string;
  
  /** Checksum for integrity */
  checksum: string;
}

// =============================================================================
// Operation Record
// =============================================================================

/**
 * Cartridge operation record
 */
export interface CartridgeOperation {
  /** Operation ID */
  id: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** User who initiated */
  initiatedBy: string;
  
  /** Operation type */
  type: CartridgeOperationType;
  
  /** Status */
  status: CartridgeOperationStatus;
  
  /** Overall progress (0-100) */
  progress: number;
  
  /** Current step description */
  currentStep?: string;
  
  /** Target cartridge ID(s) */
  cartridgeIds: string[];
  
  /** Operation-specific parameters */
  parameters: Record<string, unknown>;
  
  /** Steps and their status */
  steps: CartridgeOperationStepStatus[];
  
  /** Latest checkpoint */
  latestCheckpoint?: CartridgeOperationCheckpoint;
  
  /** Error message if failed */
  error?: string;
  
  /** Error details for debugging */
  errorDetails?: Record<string, unknown>;
  
  /** Result data on completion */
  result?: Record<string, unknown>;
  
  /** Created at */
  createdAt: string;
  
  /** Started at */
  startedAt?: string;
  
  /** Completed at */
  completedAt?: string;
  
  /** Last updated at */
  updatedAt: string;
  
  /** Estimated completion time */
  estimatedCompletionAt?: string;
  
  /** Total bytes processed */
  bytesProcessed?: number;
  
  /** Total bytes to process */
  totalBytes?: number;
}

// =============================================================================
// Operation Templates
// =============================================================================

/**
 * Steps for import operation
 */
export const IMPORT_OPERATION_STEPS: CartridgeOperationStep[] = [
  { id: 'validate_file', name: 'Validate File', description: 'Validate .RADz file structure', order: 1, estimatedDurationSeconds: 5, checkpointable: false, rollbackable: false },
  { id: 'extract_manifest', name: 'Extract Manifest', description: 'Read cartridge manifest', order: 2, estimatedDurationSeconds: 2, checkpointable: false, rollbackable: false },
  { id: 'verify_signatures', name: 'Verify Signatures', description: 'Verify PKI signatures', order: 3, estimatedDurationSeconds: 10, checkpointable: true, rollbackable: false },
  { id: 'check_compatibility', name: 'Check Compatibility', description: 'Verify cluster compatibility', order: 4, estimatedDurationSeconds: 5, checkpointable: true, rollbackable: false },
  { id: 'check_vault', name: 'Check Vault Requirements', description: 'Verify required secrets available', order: 5, estimatedDurationSeconds: 5, checkpointable: true, rollbackable: false },
  { id: 'extract_content', name: 'Extract Content', description: 'Extract cartridge contents', order: 6, estimatedDurationSeconds: 30, checkpointable: true, rollbackable: true },
  { id: 'import_cortex', name: 'Import Cortex Networks', description: 'Import neural networks', order: 7, estimatedDurationSeconds: 60, checkpointable: true, rollbackable: true },
  { id: 'import_lora', name: 'Import LoRA Adapters', description: 'Import LoRA weights', order: 8, estimatedDurationSeconds: 30, checkpointable: true, rollbackable: true },
  { id: 'import_curator', name: 'Import Curator Knowledge', description: 'Import golden rules and ontology', order: 9, estimatedDurationSeconds: 20, checkpointable: true, rollbackable: true },
  { id: 'finalize', name: 'Finalize', description: 'Complete import and update indexes', order: 10, estimatedDurationSeconds: 10, checkpointable: false, rollbackable: true },
];

/**
 * Steps for export operation
 */
export const EXPORT_OPERATION_STEPS: CartridgeOperationStep[] = [
  { id: 'gather_metadata', name: 'Gather Metadata', description: 'Collect cartridge metadata', order: 1, estimatedDurationSeconds: 5, checkpointable: false, rollbackable: false },
  { id: 'export_cortex', name: 'Export Cortex Networks', description: 'Package neural networks', order: 2, estimatedDurationSeconds: 60, checkpointable: true, rollbackable: false },
  { id: 'export_lora', name: 'Export LoRA Adapters', description: 'Package LoRA weights', order: 3, estimatedDurationSeconds: 30, checkpointable: true, rollbackable: false },
  { id: 'export_curator', name: 'Export Curator Knowledge', description: 'Package golden rules and ontology', order: 4, estimatedDurationSeconds: 20, checkpointable: true, rollbackable: false },
  { id: 'generate_rnir', name: 'Generate RNIR', description: 'Generate RNIR source code', order: 5, estimatedDurationSeconds: 30, checkpointable: true, rollbackable: false },
  { id: 'generate_vault_req', name: 'Generate Vault Requirements', description: 'Create vault.req manifest', order: 6, estimatedDurationSeconds: 5, checkpointable: false, rollbackable: false },
  { id: 'create_manifest', name: 'Create Manifest', description: 'Generate manifest.json', order: 7, estimatedDurationSeconds: 5, checkpointable: false, rollbackable: false },
  { id: 'sign_cartridge', name: 'Sign Cartridge', description: 'Apply PKI signatures', order: 8, estimatedDurationSeconds: 15, checkpointable: true, rollbackable: false },
  { id: 'package_radz', name: 'Package .RADz', description: 'Create final archive', order: 9, estimatedDurationSeconds: 30, checkpointable: true, rollbackable: false },
  { id: 'upload_artifact', name: 'Upload Artifact', description: 'Upload to storage', order: 10, estimatedDurationSeconds: 30, checkpointable: true, rollbackable: false },
];

// =============================================================================
// Admin Dashboard Types
// =============================================================================

/**
 * Operations dashboard summary
 */
export interface CartridgeOperationsDashboard {
  /** Active operations */
  activeOperations: number;
  
  /** Pending operations */
  pendingOperations: number;
  
  /** Completed today */
  completedToday: number;
  
  /** Failed today */
  failedToday: number;
  
  /** Operations by type */
  byType: Record<CartridgeOperationType, number>;
  
  /** Operations by status */
  byStatus: Record<CartridgeOperationStatus, number>;
  
  /** Recent operations */
  recentOperations: CartridgeOperation[];
  
  /** Average completion time by type (seconds) */
  avgCompletionTime: Record<CartridgeOperationType, number>;
  
  /** Current queue depth */
  queueDepth: number;
}

/**
 * Start operation request
 */
export interface StartCartridgeOperationRequest {
  /** Operation type */
  type: CartridgeOperationType;
  
  /** Target cartridge ID(s) */
  cartridgeIds: string[];
  
  /** Operation-specific parameters */
  parameters?: Record<string, unknown>;
  
  /** Priority (1-10, default 5) */
  priority?: number;
  
  /** Whether to skip vault checks */
  skipVaultCheck?: boolean;
  
  /** Whether to skip compatibility checks */
  skipCompatibilityCheck?: boolean;
}

/**
 * Operation progress event (for real-time updates)
 */
export interface CartridgeOperationProgressEvent {
  /** Operation ID */
  operationId: string;
  
  /** Event type */
  eventType: 'progress' | 'step_complete' | 'checkpoint' | 'error' | 'complete';
  
  /** Overall progress */
  progress: number;
  
  /** Current step */
  currentStep?: string;
  
  /** Step progress */
  stepProgress?: number;
  
  /** Message */
  message?: string;
  
  /** Timestamp */
  timestamp: string;
}

/**
 * Resume operation request
 */
export interface ResumeCartridgeOperationRequest {
  /** Operation ID */
  operationId: string;
  
  /** Checkpoint ID to resume from (latest if not specified) */
  checkpointId?: string;
  
  /** Whether to skip failed step */
  skipFailedStep?: boolean;
}

/**
 * Rollback operation request
 */
export interface RollbackCartridgeOperationRequest {
  /** Operation ID */
  operationId: string;
  
  /** Checkpoint ID to rollback to */
  checkpointId: string;
  
  /** Reason for rollback */
  reason: string;
}

// =============================================================================
// Cato Checkpoint Levels (from v4.21.0 spec)
// =============================================================================

/**
 * Checkpoint levels aligned with Cato CP1-CP5
 * Higher levels = more human oversight required
 */
export type CatoCheckpointLevel = 'CP1' | 'CP2' | 'CP3' | 'CP4' | 'CP5';

export interface CartridgeCheckpointConfig {
  /** Checkpoint level */
  level: CatoCheckpointLevel;
  
  /** Human-readable name */
  name: string;
  
  /** Description */
  description: string;
  
  /** Requires human approval? */
  requiresHumanApproval: boolean;
  
  /** Timeout for approval (ms) */
  approvalTimeoutMs: number;
  
  /** Auto-approve if timeout? */
  autoApproveOnTimeout: boolean;
  
  /** Risk level triggering this checkpoint */
  triggerRiskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const CATO_CHECKPOINT_LEVELS: Record<CatoCheckpointLevel, CartridgeCheckpointConfig> = {
  CP1: {
    level: 'CP1',
    name: 'Informational',
    description: 'Log only, no approval needed',
    requiresHumanApproval: false,
    approvalTimeoutMs: 0,
    autoApproveOnTimeout: true,
    triggerRiskLevel: 'NONE',
  },
  CP2: {
    level: 'CP2',
    name: 'Advisory',
    description: 'Notify but auto-approve after timeout',
    requiresHumanApproval: false,
    approvalTimeoutMs: 60000,
    autoApproveOnTimeout: true,
    triggerRiskLevel: 'LOW',
  },
  CP3: {
    level: 'CP3',
    name: 'Review Required',
    description: 'Human must acknowledge before proceeding',
    requiresHumanApproval: true,
    approvalTimeoutMs: 300000,
    autoApproveOnTimeout: false,
    triggerRiskLevel: 'MEDIUM',
  },
  CP4: {
    level: 'CP4',
    name: 'Approval Required',
    description: 'Human must explicitly approve',
    requiresHumanApproval: true,
    approvalTimeoutMs: 3600000,
    autoApproveOnTimeout: false,
    triggerRiskLevel: 'HIGH',
  },
  CP5: {
    level: 'CP5',
    name: 'Multi-Party Approval',
    description: 'Multiple approvers required',
    requiresHumanApproval: true,
    approvalTimeoutMs: 86400000,
    autoApproveOnTimeout: false,
    triggerRiskLevel: 'CRITICAL',
  },
};

// =============================================================================
// SAGA Compensation Pattern (from v4.21.0 spec)
// =============================================================================

/**
 * SAGA compensation action for rollback
 */
export interface SagaCompensationAction {
  /** Action ID */
  actionId: string;
  
  /** Step ID this compensates */
  stepId: string;
  
  /** Compensation type */
  compensationType: 'undo' | 'cleanup' | 'notify' | 'archive';
  
  /** Compensation handler function name */
  handlerName: string;
  
  /** Parameters for compensation */
  parameters: Record<string, unknown>;
  
  /** Order of execution (lower = first) */
  executionOrder: number;
  
  /** Is this compensation reversible? */
  isReversible: boolean;
}

/**
 * SAGA compensation log entry
 */
export interface SagaCompensationLog {
  /** Log ID */
  id: string;
  
  /** Operation ID */
  operationId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Compensation action */
  action: SagaCompensationAction;
  
  /** Status */
  status: 'pending' | 'executing' | 'completed' | 'failed';
  
  /** Started at */
  startedAt?: string;
  
  /** Completed at */
  completedAt?: string;
  
  /** Error if failed */
  error?: string;
  
  /** Created at */
  createdAt: string;
}

/**
 * SAGA transaction state
 */
export interface SagaTransactionState {
  /** Transaction ID (same as operation ID) */
  transactionId: string;
  
  /** Current phase */
  phase: 'forward' | 'compensating' | 'completed' | 'failed';
  
  /** Completed steps (for forward execution) */
  completedSteps: string[];
  
  /** Compensation actions to execute on rollback */
  compensationStack: SagaCompensationAction[];
  
  /** Executed compensations */
  executedCompensations: string[];
}

// =============================================================================
// Universal Envelope Protocol (from v4.21.0 spec)
// =============================================================================

/**
 * Tracing context aligned with Cato Universal Envelope Protocol
 */
export interface OperationTracingContext {
  /** 64-char hex trace ID, same across entire operation */
  traceId: string;
  
  /** 32-char hex span ID, unique per step */
  spanId: string;
  
  /** Parent span ID (links to previous step) */
  parentSpanId?: string;
  
  /** Baggage (propagated metadata) */
  baggage?: Record<string, string>;
}

/**
 * Extended operation with tracing and SAGA
 */
export interface CartridgeOperationWithSaga extends CartridgeOperation {
  /** Tracing context */
  tracing: OperationTracingContext;
  
  /** SAGA transaction state */
  sagaState: SagaTransactionState;
  
  /** Checkpoint level for this operation */
  checkpointLevel: CatoCheckpointLevel;
  
  /** Governance preset */
  governancePreset: 'PARANOID' | 'BALANCED' | 'COWBOY';
}
