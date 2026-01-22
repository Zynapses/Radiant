/**
 * Cato Checkpoint Service
 * 
 * Manages human-in-the-loop checkpoints (CP1-CP5) for the pipeline.
 * Handles triggering, approval, timeout, and escalation.
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  CatoCheckpointType,
  CatoCheckpointMode,
  CatoCheckpointDecision,
  CatoCheckpointConfig,
  CatoCheckpointConfiguration,
  CatoCheckpointDecisionRecord,
  CatoMethodEnvelope,
  CatoRiskLevel,
  CATO_GOVERNANCE_PRESETS,
} from '@radiant/shared';

export interface CheckpointTriggerContext {
  pipelineId: string;
  tenantId: string;
  envelope: CatoMethodEnvelope;
  checkpointType: CatoCheckpointType;
  triggerReason: string;
  governancePreset: 'COWBOY' | 'BALANCED' | 'PARANOID';
}

export interface CheckpointResult {
  triggered: boolean;
  checkpointId?: string;
  decision?: CatoCheckpointDecision;
  waitRequired: boolean;
  autoApproved: boolean;
  reason: string;
}

export class CatoCheckpointService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getConfiguration(tenantId: string): Promise<CatoCheckpointConfiguration | null> {
    const result = await this.pool.query(
      `SELECT * FROM cato_checkpoint_configurations WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToConfig(result.rows[0]);
  }

  async createOrUpdateConfiguration(
    tenantId: string,
    preset: 'COWBOY' | 'BALANCED' | 'PARANOID',
    overrides?: Partial<CatoCheckpointConfiguration>
  ): Promise<CatoCheckpointConfiguration> {
    const presetConfig = CATO_GOVERNANCE_PRESETS[preset];
    
    const result = await this.pool.query(
      `INSERT INTO cato_checkpoint_configurations (
        tenant_id, preset, checkpoints, domain_overrides, action_type_overrides,
        default_timeout_seconds, timeout_action, escalation_chain
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id) DO UPDATE SET
        preset = EXCLUDED.preset,
        checkpoints = EXCLUDED.checkpoints,
        domain_overrides = COALESCE(EXCLUDED.domain_overrides, cato_checkpoint_configurations.domain_overrides),
        action_type_overrides = COALESCE(EXCLUDED.action_type_overrides, cato_checkpoint_configurations.action_type_overrides),
        default_timeout_seconds = EXCLUDED.default_timeout_seconds,
        timeout_action = EXCLUDED.timeout_action,
        escalation_chain = COALESCE(EXCLUDED.escalation_chain, cato_checkpoint_configurations.escalation_chain),
        updated_at = NOW()
      RETURNING *`,
      [
        tenantId,
        preset,
        JSON.stringify(presetConfig.checkpoints),
        JSON.stringify(overrides?.domainOverrides || {}),
        JSON.stringify(overrides?.actionTypeOverrides || {}),
        overrides?.defaultTimeoutSeconds || 3600,
        overrides?.timeoutAction || CatoCheckpointDecision.ESCALATED,
        JSON.stringify(overrides?.escalationChain || []),
      ]
    );

    return this.mapRowToConfig(result.rows[0]);
  }

  async evaluateCheckpoint(context: CheckpointTriggerContext): Promise<CheckpointResult> {
    const config = await this.getConfiguration(context.tenantId);
    if (!config) {
      // Use default from governance preset
      const preset = CATO_GOVERNANCE_PRESETS[context.governancePreset];
      const checkpointConfig = preset.checkpoints[context.checkpointType];
      return this.processCheckpointConfig(checkpointConfig, context);
    }

    // Get checkpoint config, applying domain/action overrides
    let checkpointConfig = config.checkpoints[context.checkpointType];

    // Check for domain overrides
    const domain = this.extractDomain(context.envelope);
    if (domain && config.domainOverrides[domain]?.[context.checkpointType]) {
      checkpointConfig = config.domainOverrides[domain][context.checkpointType];
    }

    // Check for action type overrides
    const actionType = this.extractActionType(context.envelope);
    if (actionType && config.actionTypeOverrides[actionType]?.[context.checkpointType]) {
      checkpointConfig = config.actionTypeOverrides[actionType][context.checkpointType];
    }

    return this.processCheckpointConfig(checkpointConfig, context, config);
  }

  private async processCheckpointConfig(
    checkpointConfig: CatoCheckpointConfig,
    context: CheckpointTriggerContext,
    config?: CatoCheckpointConfiguration
  ): Promise<CheckpointResult> {
    // Check if checkpoint is disabled
    if (checkpointConfig.mode === CatoCheckpointMode.DISABLED) {
      return { triggered: false, waitRequired: false, autoApproved: false, reason: 'Checkpoint disabled' };
    }

    // Check if auto-approve conditions are met
    if (checkpointConfig.autoApproveConditions?.length) {
      const allConditionsMet = checkpointConfig.autoApproveConditions.every(cond =>
        this.evaluateCondition(cond, context.envelope)
      );
      if (allConditionsMet) {
        return { triggered: true, waitRequired: false, autoApproved: true, decision: CatoCheckpointDecision.AUTO_APPROVED, reason: 'Auto-approve conditions met' };
      }
    }

    // Check if trigger conditions are met (for CONDITIONAL mode)
    if (checkpointConfig.mode === CatoCheckpointMode.CONDITIONAL) {
      const shouldTrigger = checkpointConfig.triggerOn.some(trigger =>
        this.evaluateTrigger(trigger, context)
      );
      if (!shouldTrigger) {
        return { triggered: false, waitRequired: false, autoApproved: false, reason: 'Trigger conditions not met' };
      }
    }

    // AUTO mode always triggers but doesn't wait
    if (checkpointConfig.mode === CatoCheckpointMode.AUTO) {
      const checkpointId = await this.createCheckpointDecision(context, checkpointConfig, config);
      // Auto-approve immediately but log it
      await this.resolveCheckpoint(checkpointId, CatoCheckpointDecision.AUTO_APPROVED, 'system', undefined);
      return { triggered: true, checkpointId, waitRequired: false, autoApproved: true, decision: CatoCheckpointDecision.AUTO_APPROVED, reason: 'Auto mode - logged but not blocked' };
    }

    // MANUAL mode - create checkpoint and wait
    const checkpointId = await this.createCheckpointDecision(context, checkpointConfig, config);
    return { triggered: true, checkpointId, waitRequired: true, autoApproved: false, reason: 'Manual approval required' };
  }

  async createCheckpointDecision(
    context: CheckpointTriggerContext,
    checkpointConfig: CatoCheckpointConfig,
    config?: CatoCheckpointConfiguration
  ): Promise<string> {
    const checkpointId = uuidv4();
    const timeoutSeconds = checkpointConfig.timeoutSeconds || config?.defaultTimeoutSeconds || 3600;
    const deadline = new Date(Date.now() + timeoutSeconds * 1000);

    await this.pool.query(
      `INSERT INTO cato_checkpoint_decisions (
        id, pipeline_id, tenant_id, envelope_id, checkpoint_type, checkpoint_name,
        trigger_reason, presented_data, available_actions, status, deadline,
        timeout_action, escalation_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10, $11, 0)`,
      [
        checkpointId,
        context.pipelineId,
        context.tenantId,
        context.envelope.envelopeId,
        context.checkpointType,
        this.getCheckpointName(context.checkpointType),
        context.triggerReason,
        JSON.stringify(this.buildPresentedData(context.envelope)),
        JSON.stringify(['APPROVE', 'REJECT', 'MODIFY']),
        deadline,
        checkpointConfig.timeoutAction || config?.timeoutAction || CatoCheckpointDecision.ESCALATED,
      ]
    );

    return checkpointId;
  }

  async resolveCheckpoint(
    checkpointId: string,
    decision: CatoCheckpointDecision,
    decidedBy: string,
    decidedByUserId?: string,
    modifications?: string[],
    feedback?: string
  ): Promise<void> {
    const startTime = await this.pool.query(
      `SELECT triggered_at FROM cato_checkpoint_decisions WHERE id = $1`,
      [checkpointId]
    );

    const triggeredAt = startTime.rows[0]?.triggered_at;
    const decisionTimeMs = triggeredAt ? Date.now() - new Date(triggeredAt).getTime() : 0;

    await this.pool.query(
      `UPDATE cato_checkpoint_decisions SET
        status = 'DECIDED',
        decision = $1,
        decided_by = $2,
        decided_by_user_id = $3,
        modifications = $4,
        feedback = $5,
        decided_at = NOW(),
        decision_time_ms = $6
      WHERE id = $7`,
      [decision, decidedBy, decidedByUserId, modifications || [], feedback, decisionTimeMs, checkpointId]
    );
  }

  async getPendingCheckpoints(tenantId: string): Promise<CatoCheckpointDecisionRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM cato_checkpoint_decisions
       WHERE tenant_id = $1 AND status = 'PENDING'
       ORDER BY deadline ASC`,
      [tenantId]
    );

    return result.rows.map(row => this.mapRowToDecision(row));
  }

  async getCheckpointById(checkpointId: string): Promise<CatoCheckpointDecisionRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM cato_checkpoint_decisions WHERE id = $1`,
      [checkpointId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToDecision(result.rows[0]);
  }

  async processTimeouts(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE cato_checkpoint_decisions SET
        status = 'TIMEOUT',
        decision = timeout_action,
        decided_by = 'system',
        decided_at = NOW()
       WHERE status = 'PENDING' AND deadline < NOW()
       RETURNING id`
    );

    return result.rowCount || 0;
  }

  async escalateCheckpoint(checkpointId: string): Promise<void> {
    await this.pool.query(
      `UPDATE cato_checkpoint_decisions SET
        escalation_level = escalation_level + 1,
        status = 'ESCALATED'
       WHERE id = $1`,
      [checkpointId]
    );
  }

  private evaluateTrigger(trigger: string, context: CheckpointTriggerContext): boolean {
    switch (trigger) {
      case 'always':
        return true;
      case 'ambiguous_intent':
        return context.envelope.riskSignals.some(s => s.signalType === 'ambiguous_intent');
      case 'missing_context':
        return context.envelope.context.prunedCount === 0;
      case 'high_cost':
        return context.envelope.costCents > 100;
      case 'irreversible_actions':
      case 'irreversible':
        return context.envelope.riskSignals.some(s => s.signalType === 'irreversible_actions');
      case 'objections_raised':
        return context.envelope.riskSignals.some(s => s.signalType.includes('rejection') || s.signalType.includes('dissent'));
      case 'consensus_not_reached':
      case 'low_consensus':
        return context.envelope.riskSignals.some(s => s.signalType === 'consensus_deadlock');
      case 'risk_above_threshold':
        return context.envelope.riskSignals.some(s => s.severity === CatoRiskLevel.HIGH || s.severity === CatoRiskLevel.CRITICAL);
      case 'cost_above_threshold':
        return context.envelope.costCents > 500;
      case 'critical_risk':
        return context.envelope.riskSignals.some(s => s.severity === CatoRiskLevel.CRITICAL);
      case 'destructive_action':
        return context.envelope.riskSignals.some(s => s.signalType.includes('destructive'));
      case 'CHECKPOINT_REQUIRED':
        return context.triggerReason.includes('CHECKPOINT_REQUIRED');
      case 'execution_completed':
        return context.envelope.output.outputType === 'EXECUTION_RESULT';
      default:
        return false;
    }
  }

  private evaluateCondition(condition: string, envelope: CatoMethodEnvelope): boolean {
    switch (condition) {
      case 'low_risk':
        return !envelope.riskSignals.some(s => s.severity === CatoRiskLevel.HIGH || s.severity === CatoRiskLevel.CRITICAL);
      case 'reversible':
        return !envelope.riskSignals.some(s => s.signalType === 'irreversible_actions');
      case 'low_cost':
        return envelope.costCents < 50;
      default:
        return false;
    }
  }

  private extractDomain(envelope: CatoMethodEnvelope): string | null {
    const data = envelope.output.data as Record<string, unknown>;
    if (data?.domain && typeof data.domain === 'object') {
      return (data.domain as Record<string, unknown>).detected as string || null;
    }
    return null;
  }

  private extractActionType(envelope: CatoMethodEnvelope): string | null {
    const data = envelope.output.data as Record<string, unknown>;
    if (data?.category) return data.category as string;
    if (data?.actions && Array.isArray(data.actions) && data.actions.length > 0) {
      return (data.actions[0] as Record<string, unknown>).type as string;
    }
    return null;
  }

  private getCheckpointName(type: CatoCheckpointType): string {
    const names: Record<CatoCheckpointType, string> = {
      CP1: 'Context Gate',
      CP2: 'Plan Gate',
      CP3: 'Review Gate',
      CP4: 'Execution Gate',
      CP5: 'Post-Mortem Gate',
    };
    return names[type];
  }

  private buildPresentedData(envelope: CatoMethodEnvelope): Record<string, unknown> {
    return {
      outputType: envelope.output.outputType,
      summary: envelope.output.summary,
      confidence: envelope.confidence.score,
      riskSignals: envelope.riskSignals,
      costCents: envelope.costCents,
      data: envelope.output.data,
    };
  }

  private mapRowToConfig(row: Record<string, unknown>): CatoCheckpointConfiguration {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      preset: row.preset as 'COWBOY' | 'BALANCED' | 'PARANOID',
      checkpoints: row.checkpoints as Record<CatoCheckpointType, CatoCheckpointConfig>,
      domainOverrides: row.domain_overrides as Record<string, Record<CatoCheckpointType, CatoCheckpointConfig>>,
      actionTypeOverrides: row.action_type_overrides as Record<string, Record<CatoCheckpointType, CatoCheckpointConfig>>,
      defaultTimeoutSeconds: row.default_timeout_seconds as number,
      timeoutAction: row.timeout_action as CatoCheckpointDecision,
      escalationChain: row.escalation_chain as string[],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapRowToDecision(row: Record<string, unknown>): CatoCheckpointDecisionRecord {
    return {
      id: row.id as string,
      pipelineId: row.pipeline_id as string,
      tenantId: row.tenant_id as string,
      envelopeId: row.envelope_id as string,
      checkpointType: row.checkpoint_type as CatoCheckpointType,
      checkpointName: row.checkpoint_name as string,
      triggerReason: row.trigger_reason as string,
      presentedData: row.presented_data as Record<string, unknown>,
      availableActions: row.available_actions as string[],
      status: row.status as 'PENDING' | 'DECIDED' | 'TIMEOUT' | 'ESCALATED',
      decision: row.decision as CatoCheckpointDecision | undefined,
      decidedBy: row.decided_by as string | undefined,
      decidedByUserId: row.decided_by_user_id as string | undefined,
      modifications: row.modifications as string[] | undefined,
      feedback: row.feedback as string | undefined,
      deadline: new Date(row.deadline as string),
      timeoutAction: row.timeout_action as CatoCheckpointDecision,
      escalationLevel: row.escalation_level as number,
      escalatedTo: row.escalated_to as string[] | undefined,
      triggeredAt: new Date(row.triggered_at as string),
      decidedAt: row.decided_at ? new Date(row.decided_at as string) : undefined,
      decisionTimeMs: row.decision_time_ms as number | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

export const createCatoCheckpointService = (pool: Pool): CatoCheckpointService => {
  return new CatoCheckpointService(pool);
};
