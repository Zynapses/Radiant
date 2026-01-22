/**
 * RADIANT Governance Preset Service
 * Project Cato Integration: Variable Friction / Leash Metaphor
 * 
 * Provides user-friendly governance presets (Paranoid/Balanced/Cowboy) that map
 * to underlying Genesis Cato Moods while offering a simpler mental model.
 */

import { query, transaction } from './database.js';
import {
  GovernancePreset,
  GovernancePresetConfig,
  GovernanceCheckpointConfig,
  TenantGovernanceConfig,
  CheckpointMode,
  GOVERNANCE_PRESETS,
} from '@radiant/shared';

// ============================================================================
// Types
// ============================================================================

export interface CheckpointDecision {
  id: string;
  tenantId: string;
  sessionId: string;
  userId?: string;
  pipelineId?: string;
  checkpointType: string;
  checkpointMode: CheckpointMode;
  decision: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'TIMEOUT' | 'PENDING';
  decidedBy: 'AUTO' | 'USER' | 'TIMEOUT';
  decisionReason?: string;
  riskScore?: number;
  confidenceScore?: number;
  costEstimateCents?: number;
  requestedAt: Date;
  decidedAt?: Date;
  timeoutAt?: Date;
  modifications?: Record<string, unknown>;
  feedback?: string;
}

export interface GovernanceMetrics {
  totalCheckpoints: number;
  autoApproved: number;
  userApproved: number;
  rejected: number;
  modified: number;
  timeouts: number;
  avgDecisionTimeMs: number;
  byCheckpointType: Record<string, number>;
}

// ============================================================================
// Core Service
// ============================================================================

export const governancePresetService = {
  /**
   * Get tenant's governance configuration
   */
  async getConfig(tenantId: string): Promise<TenantGovernanceConfig | null> {
    const result = await query(
      `SELECT 
        id,
        tenant_id as "tenantId",
        active_preset as "activePreset",
        custom_friction_level as "customFrictionLevel",
        custom_auto_approve_threshold as "customAutoApproveThreshold",
        checkpoint_after_observer,
        checkpoint_after_proposer,
        checkpoint_after_critics,
        checkpoint_before_execution,
        checkpoint_after_execution,
        daily_budget_cents as "dailyBudgetCents",
        max_action_cost_cents as "maxActionCostCents",
        compliance_frameworks as "complianceFrameworks",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM tenant_governance_config
      WHERE tenant_id = $1`,
      [tenantId]
    );

    if (!result.rows[0]) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      tenantId: String(row.tenantId),
      activePreset: String(row.activePreset) as GovernancePreset,
      dailyBudgetCents: Number(row.dailyBudgetCents),
      maxActionCostCents: Number(row.maxActionCostCents),
      complianceFrameworks: (row.complianceFrameworks as string[]) || [],
      customFrictionLevel: row.customFrictionLevel ? Number(row.customFrictionLevel) : undefined,
      customAutoApproveThreshold: row.customAutoApproveThreshold ? Number(row.customAutoApproveThreshold) : undefined,
      customCheckpoints: this.buildCustomCheckpoints(row),
      createdAt: new Date(String(row.createdAt)),
      updatedAt: new Date(String(row.updatedAt)),
    } as TenantGovernanceConfig;
  },

  /**
   * Get effective configuration (preset + overrides)
   */
  async getEffectiveConfig(tenantId: string): Promise<GovernancePresetConfig> {
    const config = await this.getConfig(tenantId);
    
    if (!config) {
      return GOVERNANCE_PRESETS.balanced;
    }

    const basePreset = GOVERNANCE_PRESETS[config.activePreset];
    
    return {
      ...basePreset,
      frictionLevel: config.customFrictionLevel ?? basePreset.frictionLevel,
      autoApproveThreshold: config.customAutoApproveThreshold ?? basePreset.autoApproveThreshold,
      checkpoints: {
        ...basePreset.checkpoints,
        ...config.customCheckpoints,
      },
    };
  },

  /**
   * Set governance preset
   */
  async setPreset(
    tenantId: string,
    preset: GovernancePreset,
    changedBy?: string,
    reason?: string
  ): Promise<TenantGovernanceConfig> {
    return await transaction(async (client: any) => {
      // Get current config for audit
      const currentResult = await client.query(
        `SELECT active_preset, custom_friction_level, custom_auto_approve_threshold,
                checkpoint_after_observer, checkpoint_after_proposer, checkpoint_after_critics,
                checkpoint_before_execution, checkpoint_after_execution,
                daily_budget_cents, max_action_cost_cents, compliance_frameworks
         FROM tenant_governance_config WHERE tenant_id = $1`,
        [tenantId]
      );
      const current = currentResult.rows[0];

      // Upsert config
      const result = await query(
        `INSERT INTO tenant_governance_config (tenant_id, active_preset)
         VALUES ($1, $2)
         ON CONFLICT (tenant_id) DO UPDATE SET
           active_preset = $2,
           custom_friction_level = NULL,
           custom_auto_approve_threshold = NULL,
           checkpoint_after_observer = NULL,
           checkpoint_after_proposer = NULL,
           checkpoint_after_critics = NULL,
           checkpoint_before_execution = NULL,
           checkpoint_after_execution = NULL
         RETURNING 
           id,
           tenant_id as "tenantId",
           active_preset as "activePreset",
           daily_budget_cents as "dailyBudgetCents",
           max_action_cost_cents as "maxActionCostCents",
           compliance_frameworks as "complianceFrameworks",
           created_at as "createdAt",
           updated_at as "updatedAt"`,
        [tenantId, preset]
      );

      // Log change
      await client.query(
        `INSERT INTO governance_preset_changes 
         (tenant_id, previous_preset, new_preset, changed_by, change_reason, config_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          current?.active_preset || null,
          preset,
          changedBy || null,
          reason || null,
          JSON.stringify(current || {}),
        ]
      );

      const row = result.rows[0] as Record<string, unknown>;
      return {
        id: String(row.id),
        tenantId: String(row.tenantId),
        activePreset: String(row.activePreset) as GovernancePreset,
        dailyBudgetCents: Number(row.dailyBudgetCents),
        maxActionCostCents: Number(row.maxActionCostCents),
        complianceFrameworks: (row.complianceFrameworks as string[]) || [],
        createdAt: new Date(String(row.createdAt)),
        updatedAt: new Date(String(row.updatedAt)),
      } as TenantGovernanceConfig;
    });
  },

  /**
   * Update custom overrides
   */
  async updateCustomOverrides(
    tenantId: string,
    overrides: {
      frictionLevel?: number;
      autoApproveThreshold?: number;
      checkpoints?: Partial<GovernanceCheckpointConfig>;
    }
  ): Promise<TenantGovernanceConfig> {
    const updates: string[] = [];
    const values: unknown[] = [tenantId];
    let paramIndex = 2;

    if (overrides.frictionLevel !== undefined) {
      updates.push(`custom_friction_level = $${paramIndex++}`);
      values.push(overrides.frictionLevel);
    }

    if (overrides.autoApproveThreshold !== undefined) {
      updates.push(`custom_auto_approve_threshold = $${paramIndex++}`);
      values.push(overrides.autoApproveThreshold);
    }

    if (overrides.checkpoints) {
      const cp = overrides.checkpoints;
      if (cp.afterObserver !== undefined) {
        updates.push(`checkpoint_after_observer = $${paramIndex++}`);
        values.push(cp.afterObserver);
      }
      if (cp.afterProposer !== undefined) {
        updates.push(`checkpoint_after_proposer = $${paramIndex++}`);
        values.push(cp.afterProposer);
      }
      if (cp.afterCritics !== undefined) {
        updates.push(`checkpoint_after_critics = $${paramIndex++}`);
        values.push(cp.afterCritics);
      }
      if (cp.beforeExecution !== undefined) {
        updates.push(`checkpoint_before_execution = $${paramIndex++}`);
        values.push(cp.beforeExecution);
      }
      if (cp.afterExecution !== undefined) {
        updates.push(`checkpoint_after_execution = $${paramIndex++}`);
        values.push(cp.afterExecution);
      }
    }

    if (updates.length === 0) {
      const config = await this.getConfig(tenantId);
      if (!config) throw new Error('Governance config not found');
      return config;
    }

    const result = await query(
      `UPDATE tenant_governance_config
       SET ${updates.join(', ')}
       WHERE tenant_id = $1
       RETURNING 
         id,
         tenant_id as "tenantId",
         active_preset as "activePreset",
         custom_friction_level as "customFrictionLevel",
         custom_auto_approve_threshold as "customAutoApproveThreshold",
         daily_budget_cents as "dailyBudgetCents",
         max_action_cost_cents as "maxActionCostCents",
         compliance_frameworks as "complianceFrameworks",
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      values
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      tenantId: String(row.tenantId),
      activePreset: String(row.activePreset) as GovernancePreset,
      dailyBudgetCents: Number(row.dailyBudgetCents),
      maxActionCostCents: Number(row.maxActionCostCents),
      complianceFrameworks: (row.complianceFrameworks as string[]) || [],
      customFrictionLevel: row.customFrictionLevel ? Number(row.customFrictionLevel) : undefined,
      customAutoApproveThreshold: row.customAutoApproveThreshold ? Number(row.customAutoApproveThreshold) : undefined,
      createdAt: new Date(String(row.createdAt)),
      updatedAt: new Date(String(row.updatedAt)),
    } as TenantGovernanceConfig;
  },

  /**
   * Check if checkpoint is required based on current config
   */
  async shouldCheckpoint(
    tenantId: string,
    checkpointType: keyof GovernanceCheckpointConfig,
    context: {
      riskScore: number;
      confidenceScore: number;
      costEstimateCents: number;
    }
  ): Promise<{ required: boolean; mode: CheckpointMode; reason: string }> {
    const config = await this.getEffectiveConfig(tenantId);
    const mode = config.checkpoints[checkpointType];

    switch (mode) {
      case 'ALWAYS':
        return { required: true, mode, reason: 'Checkpoint mode is ALWAYS' };

      case 'NEVER':
        return { required: false, mode, reason: 'Checkpoint mode is NEVER' };

      case 'NOTIFY_ONLY':
        return { required: false, mode, reason: 'Checkpoint mode is NOTIFY_ONLY (async notification)' };

      case 'CONDITIONAL':
        const shouldCheckpoint = context.riskScore > config.autoApproveThreshold;
        return {
          required: shouldCheckpoint,
          mode,
          reason: shouldCheckpoint
            ? `Risk score ${context.riskScore.toFixed(2)} exceeds threshold ${config.autoApproveThreshold}`
            : `Risk score ${context.riskScore.toFixed(2)} within auto-approve threshold`,
        };

      default:
        return { required: true, mode: 'ALWAYS', reason: 'Unknown mode, defaulting to ALWAYS' };
    }
  },

  /**
   * Record a checkpoint decision
   */
  async recordCheckpointDecision(decision: Omit<CheckpointDecision, 'id'>): Promise<CheckpointDecision> {
    const result = await query(
      `INSERT INTO governance_checkpoint_decisions (
        tenant_id, session_id, user_id, pipeline_id,
        checkpoint_type, checkpoint_mode, decision, decided_by,
        decision_reason, risk_score, confidence_score, cost_estimate_cents,
        requested_at, decided_at, timeout_at, modifications, feedback
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING 
        id,
        tenant_id as "tenantId",
        session_id as "sessionId",
        user_id as "userId",
        pipeline_id as "pipelineId",
        checkpoint_type as "checkpointType",
        checkpoint_mode as "checkpointMode",
        decision,
        decided_by as "decidedBy",
        decision_reason as "decisionReason",
        risk_score as "riskScore",
        confidence_score as "confidenceScore",
        cost_estimate_cents as "costEstimateCents",
        requested_at as "requestedAt",
        decided_at as "decidedAt",
        timeout_at as "timeoutAt",
        modifications,
        feedback`,
      [
        decision.tenantId,
        decision.sessionId,
        decision.userId || null,
        decision.pipelineId || null,
        decision.checkpointType,
        decision.checkpointMode,
        decision.decision,
        decision.decidedBy,
        decision.decisionReason || null,
        decision.riskScore || null,
        decision.confidenceScore || null,
        decision.costEstimateCents || null,
        decision.requestedAt,
        decision.decidedAt || null,
        decision.timeoutAt || null,
        decision.modifications ? JSON.stringify(decision.modifications) : null,
        decision.feedback || null,
      ]
    );

    return result.rows[0] as CheckpointDecision;
  },

  /**
   * Get pending checkpoints for a session
   */
  async getPendingCheckpoints(tenantId: string, sessionId: string): Promise<CheckpointDecision[]> {
    const result = await query(
      `SELECT 
        id,
        tenant_id as "tenantId",
        session_id as "sessionId",
        user_id as "userId",
        pipeline_id as "pipelineId",
        checkpoint_type as "checkpointType",
        checkpoint_mode as "checkpointMode",
        decision,
        decided_by as "decidedBy",
        risk_score as "riskScore",
        confidence_score as "confidenceScore",
        cost_estimate_cents as "costEstimateCents",
        requested_at as "requestedAt",
        timeout_at as "timeoutAt"
      FROM governance_checkpoint_decisions
      WHERE tenant_id = $1 AND session_id = $2 AND decision = 'PENDING'
      ORDER BY requested_at ASC`,
      [tenantId, sessionId]
    );

    return result.rows as CheckpointDecision[];
  },

  /**
   * Resolve a pending checkpoint
   */
  async resolveCheckpoint(
    checkpointId: string,
    decision: 'APPROVED' | 'REJECTED' | 'MODIFIED',
    decidedBy: 'USER' | 'TIMEOUT',
    options?: {
      reason?: string;
      modifications?: Record<string, unknown>;
      feedback?: string;
    }
  ): Promise<CheckpointDecision> {
    const result = await query(
      `UPDATE governance_checkpoint_decisions
       SET 
         decision = $2,
         decided_by = $3,
         decided_at = NOW(),
         decision_reason = $4,
         modifications = $5,
         feedback = $6
       WHERE id = $1
       RETURNING 
         id,
         tenant_id as "tenantId",
         session_id as "sessionId",
         checkpoint_type as "checkpointType",
         decision,
         decided_by as "decidedBy",
         decided_at as "decidedAt"`,
      [
        checkpointId,
        decision,
        decidedBy,
        options?.reason || null,
        options?.modifications ? JSON.stringify(options.modifications) : null,
        options?.feedback || null,
      ]
    );

    return result.rows[0] as CheckpointDecision;
  },

  /**
   * Get governance metrics for dashboard
   */
  async getMetrics(tenantId: string, days: number = 7): Promise<GovernanceMetrics> {
    const result = await query<{
      total: number;
      auto_approved: number;
      user_approved: number;
      rejected: number;
      modified: number;
      timeouts: number;
      avg_decision_ms: number;
    }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE decided_by = 'AUTO' AND decision = 'APPROVED') as auto_approved,
        COUNT(*) FILTER (WHERE decided_by = 'USER' AND decision = 'APPROVED') as user_approved,
        COUNT(*) FILTER (WHERE decision = 'REJECTED') as rejected,
        COUNT(*) FILTER (WHERE decision = 'MODIFIED') as modified,
        COUNT(*) FILTER (WHERE decided_by = 'TIMEOUT') as timeouts,
        AVG(EXTRACT(EPOCH FROM (decided_at - requested_at)) * 1000) 
          FILTER (WHERE decided_at IS NOT NULL) as avg_decision_ms
      FROM governance_checkpoint_decisions
      WHERE tenant_id = $1 AND requested_at > NOW() - INTERVAL '1 day' * $2`,
      [tenantId, days]
    );

    const byTypeResult = await query(
      `SELECT checkpoint_type, COUNT(*) as count
       FROM governance_checkpoint_decisions
       WHERE tenant_id = $1 AND requested_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY checkpoint_type`,
      [tenantId, days]
    );

    const row = result.rows[0];
    return {
      totalCheckpoints: Number(row.total),
      autoApproved: Number(row.auto_approved),
      userApproved: Number(row.user_approved),
      rejected: Number(row.rejected),
      modified: Number(row.modified),
      timeouts: Number(row.timeouts),
      avgDecisionTimeMs: row.avg_decision_ms || 0,
      byCheckpointType: byTypeResult.rows.reduce(
        (acc: any, r: any) => ({ ...acc, [r.checkpoint_type]: Number(r.count) }),
        {}
      ),
    };
  },

  /**
   * Get preset change history
   */
  async getChangeHistory(
    tenantId: string,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    previousPreset: string | null;
    newPreset: string;
    changedBy: string | null;
    changeReason: string | null;
    createdAt: Date;
  }>> {
    const result = await query(
      `SELECT 
        id,
        previous_preset as "previousPreset",
        new_preset as "newPreset",
        changed_by as "changedBy",
        change_reason as "changeReason",
        created_at as "createdAt"
      FROM governance_preset_changes
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows as Array<{
      id: string;
      previousPreset: string | null;
      newPreset: string;
      changedBy: string | null;
      changeReason: string | null;
      createdAt: Date;
    }>;
  },

  // Helper to build custom checkpoints from DB row
  buildCustomCheckpoints(row: Record<string, unknown>): Partial<GovernanceCheckpointConfig> | undefined {
    const checkpoints: Partial<GovernanceCheckpointConfig> = {};
    let hasAny = false;

    if (row.checkpoint_after_observer) {
      checkpoints.afterObserver = row.checkpoint_after_observer as CheckpointMode;
      hasAny = true;
    }
    if (row.checkpoint_after_proposer) {
      checkpoints.afterProposer = row.checkpoint_after_proposer as CheckpointMode;
      hasAny = true;
    }
    if (row.checkpoint_after_critics) {
      checkpoints.afterCritics = row.checkpoint_after_critics as CheckpointMode;
      hasAny = true;
    }
    if (row.checkpoint_before_execution) {
      checkpoints.beforeExecution = row.checkpoint_before_execution as CheckpointMode;
      hasAny = true;
    }
    if (row.checkpoint_after_execution) {
      checkpoints.afterExecution = row.checkpoint_after_execution as CheckpointMode;
      hasAny = true;
    }

    return hasAny ? checkpoints : undefined;
  },
};

export default governancePresetService;
