/**
 * RADIANT v5.0 - Snapshot Capture Service
 * 
 * Captures execution state snapshots for time-travel debugging and replay.
 */

import { executeStatement, stringParam, longParam, doubleParam } from '../../db/client';
import { enhancedLogger } from '../../logging/enhanced-logger';

const logger = enhancedLogger;

// ============================================================================
// TYPES
// ============================================================================

export interface SnapshotInput {
  executionId: string;
  tenantId: string;
  stepNumber: number;
  stepType: string;
  inputState: Record<string, unknown>;
  outputState: Record<string, unknown>;
  internalState?: Record<string, unknown>;
  modelId?: string;
  governorState?: Record<string, unknown>;
  cbfEvaluation?: Record<string, unknown>;
  costUsd?: number;
  tokensUsed?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface Snapshot {
  id: string;
  executionId: string;
  stepNumber: number;
  stepType: string;
  inputState: Record<string, unknown>;
  outputState: Record<string, unknown>;
  internalState: Record<string, unknown>;
  modelId: string | null;
  governorState: Record<string, unknown>;
  cbfEvaluation: Record<string, unknown>;
  costUsd: number;
  tokensUsed: number;
  latencyMs: number;
  capturedAt: string;
}

export interface ReplaySession {
  id: string;
  originalExecutionId: string;
  replayMode: 'full' | 'from_step' | 'modified_input';
  startFromStep: number;
  modifiedInputs: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ============================================================================
// SERVICE
// ============================================================================

class SnapshotCaptureService {
  async captureSnapshot(input: SnapshotInput): Promise<string> {
    const startTime = Date.now();

    try {
      const result = await executeStatement(
        `INSERT INTO execution_snapshots (
           execution_id, step_number, step_type,
           input_state, output_state, internal_state,
           model_id, governor_state, cbf_evaluation,
           cost_usd, tokens_used, latency_ms, metadata
         ) VALUES (
           :executionId, :stepNumber, :stepType,
           :inputState::jsonb, :outputState::jsonb, :internalState::jsonb,
           :modelId, :governorState::jsonb, :cbfEvaluation::jsonb,
           :costUsd, :tokensUsed, :latencyMs, :metadata::jsonb
         ) RETURNING id`,
        [
          stringParam('executionId', input.executionId),
          longParam('stepNumber', input.stepNumber),
          stringParam('stepType', input.stepType),
          stringParam('inputState', JSON.stringify(input.inputState)),
          stringParam('outputState', JSON.stringify(input.outputState)),
          stringParam('internalState', JSON.stringify(input.internalState || {})),
          stringParam('modelId', input.modelId || ''),
          stringParam('governorState', JSON.stringify(input.governorState || {})),
          stringParam('cbfEvaluation', JSON.stringify(input.cbfEvaluation || {})),
          doubleParam('costUsd', input.costUsd || 0),
          longParam('tokensUsed', input.tokensUsed || 0),
          longParam('latencyMs', input.latencyMs || (Date.now() - startTime)),
          stringParam('metadata', JSON.stringify(input.metadata || {})),
        ]
      );

      const snapshotId = result.rows?.[0]?.id as string;
      logger.debug('Snapshot captured', { 
        snapshotId, 
        executionId: input.executionId, 
        step: input.stepNumber,
      });

      return snapshotId;
    } catch (error: any) {
      logger.error('Failed to capture snapshot', { error: error.message, input });
      throw error;
    }
  }

  async getSnapshots(executionId: string): Promise<Snapshot[]> {
    const result = await executeStatement(
      `SELECT * FROM execution_snapshots WHERE execution_id = :executionId ORDER BY step_number`,
      [stringParam('executionId', executionId)]
    );

    return (result.rows || []).map(row => this.mapSnapshot(row));
  }

  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    const result = await executeStatement(
      `SELECT * FROM execution_snapshots WHERE id = :snapshotId`,
      [stringParam('snapshotId', snapshotId)]
    );

    if (!result.rows?.[0]) return null;
    return this.mapSnapshot(result.rows[0]);
  }

  async getSnapshotAtStep(executionId: string, stepNumber: number): Promise<Snapshot | null> {
    const result = await executeStatement(
      `SELECT * FROM execution_snapshots 
       WHERE execution_id = :executionId AND step_number = :stepNumber`,
      [stringParam('executionId', executionId), longParam('stepNumber', stepNumber)]
    );

    if (!result.rows?.[0]) return null;
    return this.mapSnapshot(result.rows[0]);
  }

  async createReplaySession(
    originalExecutionId: string,
    tenantId: string,
    userId: string,
    options: {
      mode: 'full' | 'from_step' | 'modified_input';
      startFromStep?: number;
      modifiedInputs?: Record<string, unknown>;
    }
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO replay_sessions (
         original_execution_id, tenant_id, created_by,
         replay_mode, start_from_step, modified_inputs, status
       ) VALUES (
         :originalId, :tenantId, :userId,
         :mode::replay_mode, :startStep, :modifiedInputs::jsonb, 'pending'
       ) RETURNING id`,
      [
        stringParam('originalId', originalExecutionId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('mode', options.mode),
        longParam('startStep', options.startFromStep || 0),
        stringParam('modifiedInputs', JSON.stringify(options.modifiedInputs || {})),
      ]
    );

    return result.rows?.[0]?.id as string;
  }

  async startReplaySession(sessionId: string): Promise<void> {
    const session = await this.getReplaySession(sessionId);
    if (!session) {
      throw new Error('Replay session not found');
    }

    // Create new execution for replay
    const originalExecution = await this.getOriginalExecution(session.originalExecutionId);
    if (!originalExecution) {
      throw new Error('Original execution not found');
    }

    // Get snapshots to replay
    const snapshots = await this.getSnapshots(session.originalExecutionId);
    const startStep = session.startFromStep || 0;
    const snapshotsToReplay = snapshots.filter(s => s.stepNumber >= startStep);

    // Update session status
    await executeStatement(
      `UPDATE replay_sessions SET status = 'running', started_at = NOW() WHERE id = :sessionId`,
      [stringParam('sessionId', sessionId)]
    );

    // Create replay execution
    const replayExecutionId = await this.createReplayExecution(
      session,
      originalExecution,
      session.modifiedInputs
    );

    // Link replay execution to session
    await executeStatement(
      `UPDATE replay_sessions SET replay_execution_id = :replayId WHERE id = :sessionId`,
      [stringParam('sessionId', sessionId), stringParam('replayId', replayExecutionId)]
    );

    logger.info('Replay session started', { sessionId, replayExecutionId, steps: snapshotsToReplay.length });
  }

  async compareExecutions(
    executionId1: string,
    executionId2: string
  ): Promise<{
    divergenceStep: number | null;
    differences: Array<{
      step: number;
      field: string;
      value1: unknown;
      value2: unknown;
    }>;
  }> {
    const snapshots1 = await this.getSnapshots(executionId1);
    const snapshots2 = await this.getSnapshots(executionId2);

    const differences: Array<{
      step: number;
      field: string;
      value1: unknown;
      value2: unknown;
    }> = [];

    let divergenceStep: number | null = null;

    const maxSteps = Math.max(snapshots1.length, snapshots2.length);
    for (let i = 0; i < maxSteps; i++) {
      const s1 = snapshots1[i];
      const s2 = snapshots2[i];

      if (!s1 || !s2) {
        if (divergenceStep === null) divergenceStep = i;
        continue;
      }

      // Compare outputs
      const output1 = JSON.stringify(s1.outputState);
      const output2 = JSON.stringify(s2.outputState);
      if (output1 !== output2) {
        if (divergenceStep === null) divergenceStep = i;
        differences.push({
          step: i,
          field: 'outputState',
          value1: s1.outputState,
          value2: s2.outputState,
        });
      }

      // Compare model used
      if (s1.modelId !== s2.modelId) {
        differences.push({
          step: i,
          field: 'modelId',
          value1: s1.modelId,
          value2: s2.modelId,
        });
      }
    }

    // Store diff if significant
    if (differences.length > 0) {
      await this.storeDiff(executionId1, executionId2, divergenceStep, differences);
    }

    return { divergenceStep, differences };
  }

  async addBookmark(
    snapshotId: string,
    userId: string,
    name: string,
    description?: string
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO execution_bookmarks (snapshot_id, user_id, name, description)
       VALUES (:snapshotId, :userId, :name, :description)
       RETURNING id`,
      [
        stringParam('snapshotId', snapshotId),
        stringParam('userId', userId),
        stringParam('name', name),
        stringParam('description', description || ''),
      ]
    );

    return result.rows?.[0]?.id as string;
  }

  async addAnnotation(
    snapshotId: string,
    userId: string,
    content: string,
    annotationType: 'note' | 'question' | 'issue' | 'insight' = 'note'
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO execution_annotations (snapshot_id, user_id, annotation_type, content)
       VALUES (:snapshotId, :userId, :type::annotation_type, :content)
       RETURNING id`,
      [
        stringParam('snapshotId', snapshotId),
        stringParam('userId', userId),
        stringParam('type', annotationType),
        stringParam('content', content),
      ]
    );

    return result.rows?.[0]?.id as string;
  }

  private async getReplaySession(sessionId: string): Promise<ReplaySession | null> {
    const result = await executeStatement(
      `SELECT * FROM replay_sessions WHERE id = :sessionId`,
      [stringParam('sessionId', sessionId)]
    );

    if (!result.rows?.[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      originalExecutionId: row.original_execution_id as string,
      replayMode: row.replay_mode as 'full' | 'from_step' | 'modified_input',
      startFromStep: (row.start_from_step as number) || 0,
      modifiedInputs: this.parseJson(row.modified_inputs),
      status: row.status as 'pending' | 'running' | 'completed' | 'failed',
    };
  }

  private async getOriginalExecution(executionId: string): Promise<Record<string, unknown> | null> {
    const result = await executeStatement(
      `SELECT * FROM agent_executions WHERE id = :executionId`,
      [stringParam('executionId', executionId)]
    );
    return result.rows?.[0] || null;
  }

  private async createReplayExecution(
    session: ReplaySession,
    originalExecution: Record<string, unknown>,
    modifiedInputs: Record<string, unknown>
  ): Promise<string> {
    const goal = modifiedInputs.goal || originalExecution.goal;
    const parsedOriginal = this.parseJson(originalExecution.constraints) || {};
    const modConstraints = modifiedInputs.constraints || {};
    const constraints = { 
      ...(typeof parsedOriginal === 'object' ? parsedOriginal as Record<string, unknown> : {}),
      ...(typeof modConstraints === 'object' ? modConstraints as Record<string, unknown> : {}),
    };

    const result = await executeStatement(
      `INSERT INTO agent_executions (
         agent_id, tenant_id, user_id, session_id, goal, constraints,
         status, budget_allocated, timeout_minutes, is_replay, original_execution_id
       ) VALUES (
         :agentId, :tenantId, :userId, :sessionId, :goal, :constraints::jsonb,
         'pending', :budget, :timeout, true, :originalId
       ) RETURNING id`,
      [
        stringParam('agentId', originalExecution.agent_id as string),
        stringParam('tenantId', originalExecution.tenant_id as string),
        stringParam('userId', originalExecution.user_id as string),
        stringParam('sessionId', originalExecution.session_id as string || ''),
        stringParam('goal', goal as string),
        stringParam('constraints', JSON.stringify(constraints)),
        doubleParam('budget', parseFloat(originalExecution.budget_allocated as string) || 1),
        longParam('timeout', (originalExecution.timeout_minutes as number) || 30),
        stringParam('originalId', session.originalExecutionId),
      ]
    );

    return result.rows?.[0]?.id as string;
  }

  private async storeDiff(
    executionId1: string,
    executionId2: string,
    divergenceStep: number | null,
    differences: Array<{ step: number; field: string; value1: unknown; value2: unknown }>
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO execution_diffs (execution_id_1, execution_id_2, divergence_step, diff_summary)
       VALUES (:id1, :id2, :step, :summary::jsonb)`,
      [
        stringParam('id1', executionId1),
        stringParam('id2', executionId2),
        longParam('step', divergenceStep || 0),
        stringParam('summary', JSON.stringify({ differences })),
      ]
    );
  }

  private mapSnapshot(row: Record<string, unknown>): Snapshot {
    return {
      id: row.id as string,
      executionId: row.execution_id as string,
      stepNumber: (row.step_number as number) || 0,
      stepType: row.step_type as string,
      inputState: this.parseJson(row.input_state),
      outputState: this.parseJson(row.output_state),
      internalState: this.parseJson(row.internal_state),
      modelId: row.model_id as string | null,
      governorState: this.parseJson(row.governor_state),
      cbfEvaluation: this.parseJson(row.cbf_evaluation),
      costUsd: parseFloat(row.cost_usd as string) || 0,
      tokensUsed: (row.tokens_used as number) || 0,
      latencyMs: (row.latency_ms as number) || 0,
      capturedAt: row.captured_at as string,
    };
  }

  private parseJson(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    if (typeof value === 'object') {
      return value as Record<string, unknown>;
    }
    return {};
  }
}

export const snapshotCaptureService = new SnapshotCaptureService();
