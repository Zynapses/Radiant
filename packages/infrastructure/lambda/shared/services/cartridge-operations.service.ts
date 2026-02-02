/**
 * Cartridge Operations Service (Time Machine Integration)
 * 
 * Long-running cartridge operations with checkpointing, progress tracking,
 * and resume capability.
 * 
 * @version 1.0.0
 * @since v6.2.0
 */

import { executeStatement } from '../db/client';
import { logger } from '../logging/enhanced-logger';
import crypto from 'crypto';

import type {
  CartridgeOperation,
  CartridgeOperationType,
  CartridgeOperationStatus,
  CartridgeOperationStep,
  CartridgeOperationStepStatus,
  CartridgeOperationCheckpoint,
  CartridgeOperationsDashboard,
  CartridgeOperationProgressEvent,
  StartCartridgeOperationRequest,
  ResumeCartridgeOperationRequest,
  RollbackCartridgeOperationRequest,
  IMPORT_OPERATION_STEPS,
  EXPORT_OPERATION_STEPS,
} from '@radiant/shared';

export class CartridgeOperationsService {
  /**
   * Start a new cartridge operation
   */
  async startOperation(
    tenantId: string,
    initiatedBy: string,
    request: StartCartridgeOperationRequest
  ): Promise<CartridgeOperation> {
    // Create operation record
    const result = await executeStatement(
      `INSERT INTO cartridge_operations (
        tenant_id, initiated_by, operation_type, cartridge_ids, parameters, priority
      ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
      RETURNING *`,
      [
        tenantId,
        initiatedBy,
        request.type,
        JSON.stringify(request.cartridgeIds),
        JSON.stringify(request.parameters || {}),
        request.priority || 5,
      ]
    );

    const operation = this.mapOperation(result.rows[0]);

    // Create steps based on operation type
    const steps = this.getStepsForType(request.type);
    for (const step of steps) {
      await executeStatement(
        `INSERT INTO cartridge_operation_steps (
          operation_id, tenant_id, step_id, step_name, step_description, step_order,
          is_checkpointable, is_rollbackable, estimated_duration_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          operation.id,
          tenantId,
          step.id,
          step.name,
          step.description,
          step.order,
          step.checkpointable,
          step.rollbackable,
          step.estimatedDurationSeconds,
        ]
      );
    }

    // Emit start event
    await this.emitEvent(operation.id, tenantId, 'progress', 0, steps[0]?.name, 'Operation started');

    logger.info('Cartridge operation started', { operationId: operation.id, type: request.type });

    return this.getOperation(operation.id, tenantId);
  }

  /**
   * Get operation by ID
   */
  async getOperation(operationId: string, tenantId: string): Promise<CartridgeOperation> {
    const [opResult, stepsResult, checkpointResult] = await Promise.all([
      executeStatement(
        `SELECT * FROM cartridge_operations WHERE id = $1 AND tenant_id = $2`,
        [operationId, tenantId]
      ),
      executeStatement(
        `SELECT * FROM cartridge_operation_steps WHERE operation_id = $1 ORDER BY step_order`,
        [operationId]
      ),
      executeStatement(
        `SELECT * FROM cartridge_operation_checkpoints WHERE operation_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [operationId]
      ),
    ]);

    if (opResult.rows.length === 0) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    const operation = this.mapOperation(opResult.rows[0]);
    operation.steps = stepsResult.rows.map(row => this.mapStepStatus(row));
    
    if (checkpointResult.rows.length > 0) {
      operation.latestCheckpoint = this.mapCheckpoint(checkpointResult.rows[0]);
    }

    return operation;
  }

  /**
   * Update operation progress
   */
  async updateProgress(
    operationId: string,
    tenantId: string,
    stepId: string,
    stepProgress: number,
    message?: string
  ): Promise<void> {
    // Update step progress
    await executeStatement(
      `UPDATE cartridge_operation_steps SET progress = $3, status = 'in_progress', started_at = COALESCE(started_at, NOW())
       WHERE operation_id = $1 AND step_id = $2`,
      [operationId, stepId, stepProgress]
    );

    // Calculate overall progress
    const stepsResult = await executeStatement(
      `SELECT step_order, progress, 
         (SELECT COUNT(*) FROM cartridge_operation_steps WHERE operation_id = $1) as total_steps
       FROM cartridge_operation_steps WHERE operation_id = $1`,
      [operationId]
    );

    const totalSteps = Number((stepsResult.rows[0] as Record<string, unknown>).total_steps);
    let overallProgress = 0;
    
    for (const row of stepsResult.rows) {
      const r = row as Record<string, unknown>;
      overallProgress += (Number(r.progress) / 100) / totalSteps * 100;
    }

    // Update operation
    await executeStatement(
      `UPDATE cartridge_operations SET progress = $2, current_step = $3, status = 'in_progress',
         started_at = COALESCE(started_at, NOW()),
         estimated_completion_at = estimate_operation_completion($1)
       WHERE id = $1`,
      [operationId, Math.round(overallProgress), stepId]
    );

    // Emit progress event
    await this.emitEvent(operationId, tenantId, 'progress', Math.round(overallProgress), stepId, message, stepProgress);
  }

  /**
   * Complete a step
   */
  async completeStep(
    operationId: string,
    tenantId: string,
    stepId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await executeStatement(
      `UPDATE cartridge_operation_steps SET status = 'completed', progress = 100, completed_at = NOW(), metadata = $4::jsonb
       WHERE operation_id = $1 AND step_id = $2 AND tenant_id = $3`,
      [operationId, stepId, tenantId, metadata ? JSON.stringify(metadata) : null]
    );

    await this.emitEvent(operationId, tenantId, 'step_complete', undefined, stepId, `Step completed: ${stepId}`);

    // Check if all steps are complete
    const incompleteResult = await executeStatement(
      `SELECT COUNT(*) as incomplete FROM cartridge_operation_steps
       WHERE operation_id = $1 AND status NOT IN ('completed', 'skipped')`,
      [operationId]
    );

    if (Number((incompleteResult.rows[0] as Record<string, unknown>).incomplete) === 0) {
      await this.completeOperation(operationId, tenantId);
    }
  }

  /**
   * Fail a step
   */
  async failStep(
    operationId: string,
    tenantId: string,
    stepId: string,
    error: string
  ): Promise<void> {
    await executeStatement(
      `UPDATE cartridge_operation_steps SET status = 'failed', error = $4, completed_at = NOW()
       WHERE operation_id = $1 AND step_id = $2 AND tenant_id = $3`,
      [operationId, stepId, tenantId, error]
    );

    await executeStatement(
      `UPDATE cartridge_operations SET status = 'failed', error = $2, completed_at = NOW()
       WHERE id = $1`,
      [operationId, error]
    );

    await this.emitEvent(operationId, tenantId, 'error', undefined, stepId, error);

    logger.error('Cartridge operation step failed', { operationId, stepId, error });
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    operationId: string,
    tenantId: string,
    stepId: string,
    stepProgress: number,
    state: Record<string, unknown>,
    partialArtifactPath?: string
  ): Promise<CartridgeOperationCheckpoint> {
    const stateJson = JSON.stringify(state);
    const checksum = crypto.createHash('sha256').update(stateJson).digest('hex');

    await executeStatement(
      `UPDATE cartridge_operations SET status = 'checkpointing' WHERE id = $1`,
      [operationId]
    );

    const result = await executeStatement(
      `INSERT INTO cartridge_operation_checkpoints (
        operation_id, tenant_id, step_id, step_progress, state, partial_artifact_path, checksum
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      RETURNING *`,
      [operationId, tenantId, stepId, stepProgress, stateJson, partialArtifactPath || null, checksum]
    );

    await executeStatement(
      `UPDATE cartridge_operations SET status = 'in_progress' WHERE id = $1`,
      [operationId]
    );

    await this.emitEvent(operationId, tenantId, 'checkpoint', undefined, stepId, 'Checkpoint created');

    logger.info('Checkpoint created', { operationId, stepId, stepProgress });

    return this.mapCheckpoint(result.rows[0]);
  }

  /**
   * Resume operation from checkpoint
   */
  async resumeOperation(
    tenantId: string,
    request: ResumeCartridgeOperationRequest
  ): Promise<CartridgeOperation> {
    // Get checkpoint
    let checkpointQuery = `SELECT * FROM cartridge_operation_checkpoints WHERE operation_id = $1`;
    const params: unknown[] = [request.operationId];
    
    if (request.checkpointId) {
      checkpointQuery += ` AND id = $2`;
      params.push(request.checkpointId);
    } else {
      checkpointQuery += ` ORDER BY created_at DESC LIMIT 1`;
    }

    const checkpointResult = await executeStatement(checkpointQuery, params);

    if (checkpointResult.rows.length === 0) {
      throw new Error('No checkpoint found');
    }

    const checkpoint = this.mapCheckpoint(checkpointResult.rows[0]);

    // Update operation status
    await executeStatement(
      `UPDATE cartridge_operations SET status = 'resuming', updated_at = NOW() WHERE id = $1`,
      [request.operationId]
    );

    // If skipping failed step, mark it as skipped
    if (request.skipFailedStep) {
      await executeStatement(
        `UPDATE cartridge_operation_steps SET status = 'skipped'
         WHERE operation_id = $1 AND step_id = $2 AND status = 'failed'`,
        [request.operationId, checkpoint.stepId]
      );
    }

    await this.emitEvent(request.operationId, tenantId, 'progress', undefined, checkpoint.stepId, 'Resuming from checkpoint');

    logger.info('Operation resumed', { operationId: request.operationId, checkpointId: checkpoint.id });

    return this.getOperation(request.operationId, tenantId);
  }

  /**
   * Rollback operation to checkpoint
   */
  async rollbackOperation(
    tenantId: string,
    request: RollbackCartridgeOperationRequest
  ): Promise<CartridgeOperation> {
    // Get checkpoint
    const checkpointResult = await executeStatement(
      `SELECT * FROM cartridge_operation_checkpoints WHERE operation_id = $1 AND id = $2`,
      [request.operationId, request.checkpointId]
    );

    if (checkpointResult.rows.length === 0) {
      throw new Error('Checkpoint not found');
    }

    const checkpoint = this.mapCheckpoint(checkpointResult.rows[0]);

    // Reset steps after checkpoint
    await executeStatement(
      `UPDATE cartridge_operation_steps 
       SET status = 'pending', progress = 0, started_at = NULL, completed_at = NULL, error = NULL
       WHERE operation_id = $1 AND step_order > (
         SELECT step_order FROM cartridge_operation_steps WHERE operation_id = $1 AND step_id = $2
       )`,
      [request.operationId, checkpoint.stepId]
    );

    // Update current step to checkpoint progress
    await executeStatement(
      `UPDATE cartridge_operation_steps SET status = 'pending', progress = $3
       WHERE operation_id = $1 AND step_id = $2`,
      [request.operationId, checkpoint.stepId, checkpoint.stepProgress]
    );

    // Update operation
    await executeStatement(
      `UPDATE cartridge_operations SET status = 'rolled_back', error = $2, updated_at = NOW()
       WHERE id = $1`,
      [request.operationId, `Rolled back: ${request.reason}`]
    );

    logger.info('Operation rolled back', { operationId: request.operationId, checkpointId: request.checkpointId });

    return this.getOperation(request.operationId, tenantId);
  }

  /**
   * Cancel operation
   */
  async cancelOperation(operationId: string, tenantId: string, reason: string): Promise<void> {
    await executeStatement(
      `UPDATE cartridge_operations SET status = 'cancelled', error = $2, completed_at = NOW()
       WHERE id = $1 AND tenant_id = $3`,
      [operationId, reason, tenantId]
    );

    await this.emitEvent(operationId, tenantId, 'complete', undefined, undefined, `Cancelled: ${reason}`);

    logger.info('Operation cancelled', { operationId, reason });
  }

  /**
   * Pause operation
   */
  async pauseOperation(operationId: string, tenantId: string): Promise<void> {
    await executeStatement(
      `UPDATE cartridge_operations SET status = 'paused', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'in_progress'`,
      [operationId, tenantId]
    );

    logger.info('Operation paused', { operationId });
  }

  /**
   * List operations for a tenant
   */
  async listOperations(
    tenantId: string,
    options: {
      status?: CartridgeOperationStatus;
      type?: CartridgeOperationType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CartridgeOperation[]> {
    let query = `SELECT * FROM cartridge_operations WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(options.status);
    }

    if (options.type) {
      query += ` AND operation_type = $${paramIndex++}`;
      params.push(options.type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(options.limit || 20);
    params.push(options.offset || 0);

    const result = await executeStatement(query, params);
    return result.rows.map(row => this.mapOperation(row));
  }

  /**
   * Get operations dashboard
   */
  async getDashboard(tenantId: string): Promise<CartridgeOperationsDashboard> {
    const [stats, recentOps, avgTimes] = await Promise.all([
      executeStatement(
        `SELECT 
           COUNT(*) FILTER (WHERE status IN ('pending', 'initializing', 'in_progress', 'paused', 'checkpointing', 'resuming')) as active,
           COUNT(*) FILTER (WHERE status = 'pending') as pending,
           COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today,
           COUNT(*) FILTER (WHERE status = 'failed' AND completed_at >= CURRENT_DATE) as failed_today,
           jsonb_object_agg(operation_type, type_count) as by_type,
           jsonb_object_agg(status, status_count) as by_status
         FROM (
           SELECT operation_type, status, COUNT(*) as type_count, COUNT(*) as status_count
           FROM cartridge_operations WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
           GROUP BY operation_type, status
         ) sub`,
        [tenantId]
      ),
      executeStatement(
        `SELECT * FROM cartridge_operations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [tenantId]
      ),
      executeStatement(
        `SELECT operation_type, AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
         FROM cartridge_operations
         WHERE tenant_id = $1 AND status = 'completed' AND started_at IS NOT NULL
         GROUP BY operation_type`,
        [tenantId]
      ),
    ]);

    const statsRow = stats.rows[0] as Record<string, unknown>;

    const avgCompletionTime: Record<CartridgeOperationType, number> = {} as Record<CartridgeOperationType, number>;
    for (const row of avgTimes.rows) {
      const r = row as Record<string, unknown>;
      avgCompletionTime[r.operation_type as CartridgeOperationType] = Math.round(Number(r.avg_seconds));
    }

    // Get queue depth
    const queueResult = await executeStatement(
      `SELECT COUNT(*) as depth FROM cartridge_operations WHERE status = 'pending'`,
      []
    );

    return {
      activeOperations: Number(statsRow.active) || 0,
      pendingOperations: Number(statsRow.pending) || 0,
      completedToday: Number(statsRow.completed_today) || 0,
      failedToday: Number(statsRow.failed_today) || 0,
      byType: (statsRow.by_type || {}) as Record<CartridgeOperationType, number>,
      byStatus: (statsRow.by_status || {}) as Record<CartridgeOperationStatus, number>,
      recentOperations: recentOps.rows.map(row => this.mapOperation(row)),
      avgCompletionTime,
      queueDepth: Number((queueResult.rows[0] as Record<string, unknown>).depth) || 0,
    };
  }

  /**
   * Get recent events for an operation
   */
  async getEvents(operationId: string, limit = 50): Promise<CartridgeOperationProgressEvent[]> {
    const result = await executeStatement(
      `SELECT * FROM cartridge_operation_events WHERE operation_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [operationId, limit]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        operationId: r.operation_id as string,
        eventType: r.event_type as 'progress' | 'step_complete' | 'checkpoint' | 'error' | 'complete',
        progress: r.progress as number | undefined,
        currentStep: r.current_step as string | undefined,
        stepProgress: r.step_progress as number | undefined,
        message: r.message as string | undefined,
        timestamp: (r.timestamp as Date).toISOString(),
      };
    });
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private async completeOperation(operationId: string, tenantId: string): Promise<void> {
    await executeStatement(
      `UPDATE cartridge_operations SET status = 'completed', progress = 100, completed_at = NOW()
       WHERE id = $1`,
      [operationId]
    );

    await this.emitEvent(operationId, tenantId, 'complete', 100, undefined, 'Operation completed');

    logger.info('Cartridge operation completed', { operationId });
  }

  private async emitEvent(
    operationId: string,
    tenantId: string,
    eventType: string,
    progress?: number,
    currentStep?: string,
    message?: string,
    stepProgress?: number
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO cartridge_operation_events (operation_id, tenant_id, event_type, progress, current_step, step_progress, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [operationId, tenantId, eventType, progress ?? null, currentStep ?? null, stepProgress ?? null, message ?? null]
    );
  }

  private getStepsForType(type: CartridgeOperationType): CartridgeOperationStep[] {
    switch (type) {
      case 'import':
        return [
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
      case 'export':
        return [
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
      case 'compile_rnir':
        return [
          { id: 'fetch_rnir', name: 'Fetch RNIR', description: 'Load RNIR documents', order: 1, estimatedDurationSeconds: 5, checkpointable: false, rollbackable: false },
          { id: 'validate_examples', name: 'Validate Examples', description: 'Validate training examples', order: 2, estimatedDurationSeconds: 10, checkpointable: true, rollbackable: false },
          { id: 'compile', name: 'Compile', description: 'Compile to target format', order: 3, estimatedDurationSeconds: 300, checkpointable: true, rollbackable: false },
          { id: 'store_artifact', name: 'Store Artifact', description: 'Store compiled artifact', order: 4, estimatedDurationSeconds: 30, checkpointable: false, rollbackable: false },
        ];
      default:
        return [
          { id: 'execute', name: 'Execute', description: 'Execute operation', order: 1, estimatedDurationSeconds: 60, checkpointable: true, rollbackable: false },
        ];
    }
  }

  private mapOperation(row: Record<string, unknown>): CartridgeOperation {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      initiatedBy: row.initiated_by as string,
      type: row.operation_type as CartridgeOperationType,
      status: row.status as CartridgeOperationStatus,
      progress: row.progress as number,
      currentStep: row.current_step as string | undefined,
      cartridgeIds: (row.cartridge_ids as string[]) || [],
      parameters: (row.parameters as Record<string, unknown>) || {},
      steps: [],
      error: row.error as string | undefined,
      errorDetails: row.error_details as Record<string, unknown> | undefined,
      result: row.result as Record<string, unknown> | undefined,
      createdAt: (row.created_at as Date).toISOString(),
      startedAt: row.started_at ? (row.started_at as Date).toISOString() : undefined,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : undefined,
      updatedAt: (row.updated_at as Date).toISOString(),
      estimatedCompletionAt: row.estimated_completion_at ? (row.estimated_completion_at as Date).toISOString() : undefined,
      bytesProcessed: row.bytes_processed ? Number(row.bytes_processed) : undefined,
      totalBytes: row.total_bytes ? Number(row.total_bytes) : undefined,
    };
  }

  private mapStepStatus(row: Record<string, unknown>): CartridgeOperationStepStatus {
    return {
      stepId: row.step_id as string,
      status: row.status as 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped',
      progress: row.progress as number,
      startedAt: row.started_at ? (row.started_at as Date).toISOString() : undefined,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : undefined,
      error: row.error as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
    };
  }

  private mapCheckpoint(row: Record<string, unknown>): CartridgeOperationCheckpoint {
    return {
      id: row.id as string,
      operationId: row.operation_id as string,
      stepId: row.step_id as string,
      stepProgress: row.step_progress as number,
      state: (row.state as Record<string, unknown>) || {},
      createdAt: (row.created_at as Date).toISOString(),
      partialArtifactPath: row.partial_artifact_path as string | undefined,
      checksum: row.checksum as string,
    };
  }
}

export const cartridgeOperationsService = new CartridgeOperationsService();
