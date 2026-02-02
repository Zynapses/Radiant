/**
 * Crucible Configuration Service
 * 
 * Handles hierarchical configuration resolution:
 * System (Radiant Admin) > Tenant (Think Tank Admin) > User (Method-level)
 * 
 * @version 1.1.0
 * @since v6.4.0
 */

import { Pool } from 'pg';
import {
  CrucibleSystemConfig,
  CrucibleTenantConfig,
  CrucibleUserPreference,
  CrucibleResolvedConfig,
  CruciblePreferenceScope,
  CrucibleCostMode,
  UpdateCruciblePreferenceRequest,
} from '@radiant/shared';

export class CrucibleConfigService {
  constructor(private pool: Pool) {}

  // =========================================================================
  // System Config (Radiant Admin)
  // =========================================================================

  async getSystemConfig(): Promise<CrucibleSystemConfig> {
    const result = await this.pool.query(
      `SELECT * FROM crucible_system_config LIMIT 1`
    );

    if (result.rows.length === 0) {
      // Return defaults if not configured
      return {
        id: '',
        defaultMaxQuestions: 5,
        questionTimeoutSeconds: 30,
        sessionTimeoutSeconds: 180,
        minLlmsForCrucible: 2,
        defaultCostMode: 'balanced',
        costModeQuestionLimits: { economy: 3, balanced: 5, thorough: 8 },
        circularCitationPenalty: 0.15,
        allowTenantOverride: true,
        allowUserOverride: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const row = result.rows[0];
    return {
      id: row.id,
      defaultMaxQuestions: row.default_max_questions,
      questionTimeoutSeconds: row.question_timeout_seconds,
      sessionTimeoutSeconds: row.session_timeout_seconds,
      minLlmsForCrucible: row.min_llms_for_crucible,
      defaultCostMode: row.default_cost_mode,
      costModeQuestionLimits: row.cost_mode_question_limits,
      circularCitationPenalty: parseFloat(row.circular_citation_penalty),
      allowTenantOverride: row.allow_tenant_override,
      allowUserOverride: row.allow_user_override,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateSystemConfig(updates: Partial<CrucibleSystemConfig>): Promise<CrucibleSystemConfig> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.defaultMaxQuestions !== undefined) {
      fields.push(`default_max_questions = $${paramIndex++}`);
      values.push(updates.defaultMaxQuestions);
    }
    if (updates.questionTimeoutSeconds !== undefined) {
      fields.push(`question_timeout_seconds = $${paramIndex++}`);
      values.push(updates.questionTimeoutSeconds);
    }
    if (updates.sessionTimeoutSeconds !== undefined) {
      fields.push(`session_timeout_seconds = $${paramIndex++}`);
      values.push(updates.sessionTimeoutSeconds);
    }
    if (updates.minLlmsForCrucible !== undefined) {
      fields.push(`min_llms_for_crucible = $${paramIndex++}`);
      values.push(updates.minLlmsForCrucible);
    }
    if (updates.defaultCostMode !== undefined) {
      fields.push(`default_cost_mode = $${paramIndex++}`);
      values.push(updates.defaultCostMode);
    }
    if (updates.costModeQuestionLimits !== undefined) {
      fields.push(`cost_mode_question_limits = $${paramIndex++}`);
      values.push(JSON.stringify(updates.costModeQuestionLimits));
    }
    if (updates.circularCitationPenalty !== undefined) {
      fields.push(`circular_citation_penalty = $${paramIndex++}`);
      values.push(updates.circularCitationPenalty);
    }
    if (updates.allowTenantOverride !== undefined) {
      fields.push(`allow_tenant_override = $${paramIndex++}`);
      values.push(updates.allowTenantOverride);
    }
    if (updates.allowUserOverride !== undefined) {
      fields.push(`allow_user_override = $${paramIndex++}`);
      values.push(updates.allowUserOverride);
    }

    if (fields.length > 0) {
      await this.pool.query(
        `UPDATE crucible_system_config SET ${fields.join(', ')}, updated_at = NOW()`,
        values
      );
    }

    return this.getSystemConfig();
  }

  // =========================================================================
  // Tenant Config (Think Tank Admin)
  // =========================================================================

  async getTenantConfig(tenantId: string): Promise<CrucibleTenantConfig | null> {
    const result = await this.pool.query(
      `SELECT * FROM crucible_tenant_config WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      tenantId: row.tenant_id,
      maxQuestionsOverride: row.max_questions_override,
      questionTimeoutOverride: row.question_timeout_override,
      sessionTimeoutOverride: row.session_timeout_override,
      minLlmsOverride: row.min_llms_override,
      costModeOverride: row.cost_mode_override,
      costModeLimitsOverride: row.cost_mode_limits_override,
      circularPenaltyOverride: row.circular_penalty_override ? parseFloat(row.circular_penalty_override) : undefined,
      allowUserOverride: row.allow_user_override,
      showDeliberationToUsers: row.show_deliberation_to_users,
      autoEnableForMultiLlm: row.auto_enable_for_multi_llm,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async upsertTenantConfig(tenantId: string, updates: Partial<CrucibleTenantConfig>): Promise<CrucibleTenantConfig> {
    const existing = await this.getTenantConfig(tenantId);

    if (existing) {
      const fields: string[] = [];
      const values: unknown[] = [tenantId];
      let paramIndex = 2;

      if (updates.maxQuestionsOverride !== undefined) {
        fields.push(`max_questions_override = $${paramIndex++}`);
        values.push(updates.maxQuestionsOverride);
      }
      if (updates.questionTimeoutOverride !== undefined) {
        fields.push(`question_timeout_override = $${paramIndex++}`);
        values.push(updates.questionTimeoutOverride);
      }
      if (updates.sessionTimeoutOverride !== undefined) {
        fields.push(`session_timeout_override = $${paramIndex++}`);
        values.push(updates.sessionTimeoutOverride);
      }
      if (updates.minLlmsOverride !== undefined) {
        fields.push(`min_llms_override = $${paramIndex++}`);
        values.push(updates.minLlmsOverride);
      }
      if (updates.costModeOverride !== undefined) {
        fields.push(`cost_mode_override = $${paramIndex++}`);
        values.push(updates.costModeOverride);
      }
      if (updates.costModeLimitsOverride !== undefined) {
        fields.push(`cost_mode_limits_override = $${paramIndex++}`);
        values.push(JSON.stringify(updates.costModeLimitsOverride));
      }
      if (updates.circularPenaltyOverride !== undefined) {
        fields.push(`circular_penalty_override = $${paramIndex++}`);
        values.push(updates.circularPenaltyOverride);
      }
      if (updates.allowUserOverride !== undefined) {
        fields.push(`allow_user_override = $${paramIndex++}`);
        values.push(updates.allowUserOverride);
      }
      if (updates.showDeliberationToUsers !== undefined) {
        fields.push(`show_deliberation_to_users = $${paramIndex++}`);
        values.push(updates.showDeliberationToUsers);
      }
      if (updates.autoEnableForMultiLlm !== undefined) {
        fields.push(`auto_enable_for_multi_llm = $${paramIndex++}`);
        values.push(updates.autoEnableForMultiLlm);
      }

      if (fields.length > 0) {
        await this.pool.query(
          `UPDATE crucible_tenant_config SET ${fields.join(', ')}, updated_at = NOW() WHERE tenant_id = $1`,
          values
        );
      }
    } else {
      await this.pool.query(
        `INSERT INTO crucible_tenant_config (
          tenant_id, max_questions_override, question_timeout_override, session_timeout_override,
          min_llms_override, cost_mode_override, cost_mode_limits_override, circular_penalty_override,
          allow_user_override, show_deliberation_to_users, auto_enable_for_multi_llm
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          tenantId,
          updates.maxQuestionsOverride ?? null,
          updates.questionTimeoutOverride ?? null,
          updates.sessionTimeoutOverride ?? null,
          updates.minLlmsOverride ?? null,
          updates.costModeOverride ?? null,
          updates.costModeLimitsOverride ? JSON.stringify(updates.costModeLimitsOverride) : null,
          updates.circularPenaltyOverride ?? null,
          updates.allowUserOverride ?? true,
          updates.showDeliberationToUsers ?? true,
          updates.autoEnableForMultiLlm ?? true,
        ]
      );
    }

    return (await this.getTenantConfig(tenantId))!;
  }

  // =========================================================================
  // User Preferences (Think Tank App)
  // =========================================================================

  async getUserPreferences(tenantId: string, userId: string): Promise<CrucibleUserPreference[]> {
    const result = await this.pool.query(
      `SELECT * FROM crucible_user_preferences 
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY scope, method_id, workflow_id`,
      [tenantId, userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      scope: row.scope,
      methodId: row.method_id,
      workflowId: row.workflow_id,
      maxQuestions: row.max_questions,
      costMode: row.cost_mode,
      enabled: row.enabled,
      explicitlySet: row.explicitly_set,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async upsertUserPreference(
    tenantId: string,
    userId: string,
    request: UpdateCruciblePreferenceRequest
  ): Promise<CrucibleUserPreference> {
    // Check if user is allowed to override
    const systemConfig = await this.getSystemConfig();
    if (!systemConfig.allowUserOverride) {
      throw new Error('User overrides are disabled by system administrator');
    }

    const tenantConfig = await this.getTenantConfig(tenantId);
    if (tenantConfig && !tenantConfig.allowUserOverride) {
      throw new Error('User overrides are disabled by tenant administrator');
    }

    // Upsert the preference
    const result = await this.pool.query(
      `INSERT INTO crucible_user_preferences (
        tenant_id, user_id, scope, method_id, workflow_id, max_questions, cost_mode, enabled, explicitly_set
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      ON CONFLICT (tenant_id, user_id, scope, method_id, workflow_id)
      DO UPDATE SET 
        max_questions = EXCLUDED.max_questions,
        cost_mode = EXCLUDED.cost_mode,
        enabled = EXCLUDED.enabled,
        explicitly_set = TRUE,
        updated_at = NOW()
      RETURNING *`,
      [
        tenantId,
        userId,
        request.scope,
        request.methodId ?? null,
        request.workflowId ?? null,
        request.maxQuestions ?? null,
        request.costMode ?? null,
        request.enabled ?? null,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      scope: row.scope,
      methodId: row.method_id,
      workflowId: row.workflow_id,
      maxQuestions: row.max_questions,
      costMode: row.cost_mode,
      enabled: row.enabled,
      explicitlySet: row.explicitly_set,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async deleteUserPreference(tenantId: string, userId: string, preferenceId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM crucible_user_preferences 
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [preferenceId, tenantId, userId]
    );
  }

  // =========================================================================
  // Resolved Config (Hierarchy Resolution)
  // =========================================================================

  async getResolvedConfig(
    tenantId: string,
    userId?: string,
    methodId?: string,
    workflowId?: string
  ): Promise<CrucibleResolvedConfig> {
    // Use the database function for resolution
    const result = await this.pool.query(
      `SELECT get_crucible_resolved_config($1, $2, $3, $4) as config`,
      [tenantId, userId ?? null, methodId ?? null, workflowId ?? null]
    );

    const config = result.rows[0]?.config;

    if (!config) {
      // Fallback to system defaults
      const systemConfig = await this.getSystemConfig();
      return {
        maxQuestions: systemConfig.defaultMaxQuestions,
        questionTimeoutSeconds: systemConfig.questionTimeoutSeconds,
        sessionTimeoutSeconds: systemConfig.sessionTimeoutSeconds,
        minLlmsForCrucible: systemConfig.minLlmsForCrucible,
        costMode: systemConfig.defaultCostMode,
        costModeQuestionLimits: systemConfig.costModeQuestionLimits,
        circularCitationPenalty: systemConfig.circularCitationPenalty,
        showDeliberationToUsers: true,
        autoEnableForMultiLlm: true,
        enabled: true,
        source: 'system',
      };
    }

    return {
      maxQuestions: config.max_questions,
      questionTimeoutSeconds: config.question_timeout_seconds,
      sessionTimeoutSeconds: config.session_timeout_seconds,
      minLlmsForCrucible: config.min_llms_for_crucible,
      costMode: config.cost_mode,
      costModeQuestionLimits: config.cost_mode_question_limits,
      circularCitationPenalty: parseFloat(config.circular_citation_penalty),
      showDeliberationToUsers: config.show_deliberation_to_users ?? true,
      autoEnableForMultiLlm: config.auto_enable_for_multi_llm ?? true,
      enabled: config.enabled ?? true,
      source: config.source,
    };
  }

  /**
   * Get effective max questions for a specific context
   * This is the main method used during deliberation
   */
  async getEffectiveMaxQuestions(
    tenantId: string,
    userId: string,
    methodId: string,
    workflowId?: string,
    costMode?: CrucibleCostMode
  ): Promise<number> {
    const resolved = await this.getResolvedConfig(tenantId, userId, methodId, workflowId);
    
    // Use cost mode limits if specified
    if (costMode && resolved.costModeQuestionLimits[costMode]) {
      return resolved.costModeQuestionLimits[costMode];
    }

    // Use resolved max questions (respects user override)
    return resolved.maxQuestions;
  }
}
