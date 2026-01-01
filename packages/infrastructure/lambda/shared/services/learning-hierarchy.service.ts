/**
 * RADIANT v4.18.56 - Learning Influence Service
 * Implements the User → Tenant → Global learning influence hierarchy
 * Ensures persistent learning that survives system reboots
 */

import { Pool } from 'pg';
import {
  LearningInfluence,
  LearningInfluenceConfig,
  LearningInfluenceConfigInput,
  LearningDecision,
  UserLearnedPreference,
  UserPreferenceInput,
  TenantAggregateLearning,
  TenantLearningEvent,
  TenantLearningEventInput,
  TenantModelPerformance,
  GlobalAggregateLearning,
  GlobalModelPerformance,
  LearningSnapshot,
  LearningRecoveryLog,
  ScopeType,
  RecoveryType,
} from '@radiant/shared';
import { createHash } from 'crypto';

export class LearningInfluenceService {
  constructor(private pool: Pool) {}

  // ============================================================================
  // LEARNING INFLUENCE HIERARCHY
  // ============================================================================

  /**
   * Get combined learning influence following User → Tenant → Global hierarchy
   * This is the main entry point for any decision that should use learned knowledge
   */
  async getLearningInfluence(
    tenantId: string,
    userId: string,
    decisionType: string,
    context: Record<string, unknown> = {}
  ): Promise<LearningInfluence> {
    const result = await this.pool.query(
      `SELECT * FROM get_learning_influence($1, $2, $3, $4)`,
      [tenantId, userId, decisionType, JSON.stringify(context)]
    );

    const row = result.rows[0];
    return {
      userInfluence: row.user_influence || {},
      tenantInfluence: row.tenant_influence || {},
      globalInfluence: row.global_influence || {},
      userWeight: Number(row.user_weight),
      tenantWeight: Number(row.tenant_weight),
      globalWeight: Number(row.global_weight),
      combinedRecommendation: row.combined_recommendation || {},
    };
  }

  /**
   * Apply learned influence to make a decision
   * Returns the decision with full audit trail of what influenced it
   */
  async makeLearnedDecision(
    tenantId: string,
    userId: string,
    decisionType: string,
    context: Record<string, unknown>,
    defaultDecision: Record<string, unknown>
  ): Promise<{
    decision: Record<string, unknown>;
    decisionId: string;
    influencesUsed: LearningInfluence;
  }> {
    // Get learning influence
    const influence = await this.getLearningInfluence(tenantId, userId, decisionType, context);

    // Apply weighted influence to decision
    const decision = this.applyInfluence(defaultDecision, influence, decisionType);

    // Log the decision for future learning
    const decisionId = await this.logDecision(tenantId, userId, decisionType, context, influence, decision);

    return {
      decision,
      decisionId,
      influencesUsed: influence,
    };
  }

  /**
   * Record outcome for a previous decision (enables feedback loop)
   */
  async recordDecisionOutcome(
    decisionId: string,
    positive: boolean,
    tenantId: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE learning_decision_log
       SET outcome_recorded = true, outcome_positive = $1, outcome_recorded_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [positive, decisionId, tenantId]
    );

    // Get decision details for learning
    const result = await this.pool.query(
      `SELECT * FROM learning_decision_log WHERE id = $1`,
      [decisionId]
    );

    if (result.rows.length > 0) {
      const decision = result.rows[0];
      
      // Record learning event based on outcome
      await this.recordLearningEvent({
        tenantId,
        userId: decision.user_id,
        eventType: positive ? 'model_success' : 'model_failure',
        learningDimension: decision.decision_type,
        eventData: {
          decision: decision.final_decision,
          context: decision.decision_context,
          outcome: positive ? 'positive' : 'negative',
        },
        impactScore: positive ? 0.7 : 0.8, // Failures have higher impact for learning
      });
    }
  }

  private applyInfluence(
    defaultDecision: Record<string, unknown>,
    influence: LearningInfluence,
    decisionType: string
  ): Record<string, unknown> {
    const result = { ...defaultDecision };

    // Apply user preferences (highest weight)
    if (influence.userInfluence && Object.keys(influence.userInfluence).length > 0) {
      this.mergeInfluence(result, influence.userInfluence, influence.userWeight);
    }

    // Apply tenant learning (medium weight)
    if (influence.tenantInfluence && Object.keys(influence.tenantInfluence).length > 0) {
      this.mergeInfluence(result, influence.tenantInfluence, influence.tenantWeight);
    }

    // Apply global learning (lowest weight, but still valuable)
    if (influence.globalInfluence && Object.keys(influence.globalInfluence).length > 0) {
      this.mergeInfluence(result, influence.globalInfluence, influence.globalWeight);
    }

    return result;
  }

  private mergeInfluence(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
    weight: number
  ): void {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'number' && typeof target[key] === 'number') {
        // Weighted average for numeric values
        target[key] = (target[key] as number) * (1 - weight) + (value as number) * weight;
      } else if (value !== null && value !== undefined) {
        // Override for non-numeric values (if weight is significant)
        if (weight >= 0.3) {
          target[key] = value;
        }
      }
    }
  }

  private async logDecision(
    tenantId: string,
    userId: string,
    decisionType: string,
    context: Record<string, unknown>,
    influence: LearningInfluence,
    decision: Record<string, unknown>
  ): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO learning_decision_log (
        tenant_id, user_id, decision_type, decision_context,
        user_influence_used, tenant_influence_used, global_influence_used,
        user_weight_applied, tenant_weight_applied, global_weight_applied,
        final_decision, decided_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING id`,
      [
        tenantId,
        userId,
        decisionType,
        JSON.stringify(context),
        JSON.stringify(influence.userInfluence),
        JSON.stringify(influence.tenantInfluence),
        JSON.stringify(influence.globalInfluence),
        influence.userWeight,
        influence.tenantWeight,
        influence.globalWeight,
        JSON.stringify(decision),
      ]
    );

    return result.rows[0].id;
  }

  // ============================================================================
  // INFLUENCE CONFIGURATION
  // ============================================================================

  async getInfluenceConfig(tenantId: string): Promise<LearningInfluenceConfig | null> {
    const result = await this.pool.query(
      `SELECT * FROM learning_influence_config WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapInfluenceConfig(result.rows[0]);
  }

  async setInfluenceConfig(input: LearningInfluenceConfigInput): Promise<LearningInfluenceConfig> {
    // Validate weights sum to 1.0
    const userWeight = input.userWeight ?? 0.60;
    const tenantWeight = input.tenantWeight ?? 0.30;
    const globalWeight = input.globalWeight ?? 0.10;

    if (Math.abs(userWeight + tenantWeight + globalWeight - 1.0) > 0.001) {
      throw new Error('Influence weights must sum to 1.0');
    }

    const result = await this.pool.query(
      `INSERT INTO learning_influence_config (
        tenant_id, user_weight, tenant_weight, global_weight,
        dimension_overrides,
        enable_user_learning, enable_tenant_aggregation, enable_global_learning,
        contribute_to_global, anonymization_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (tenant_id) DO UPDATE SET
        user_weight = EXCLUDED.user_weight,
        tenant_weight = EXCLUDED.tenant_weight,
        global_weight = EXCLUDED.global_weight,
        dimension_overrides = COALESCE(EXCLUDED.dimension_overrides, learning_influence_config.dimension_overrides),
        enable_user_learning = COALESCE(EXCLUDED.enable_user_learning, learning_influence_config.enable_user_learning),
        enable_tenant_aggregation = COALESCE(EXCLUDED.enable_tenant_aggregation, learning_influence_config.enable_tenant_aggregation),
        enable_global_learning = COALESCE(EXCLUDED.enable_global_learning, learning_influence_config.enable_global_learning),
        contribute_to_global = COALESCE(EXCLUDED.contribute_to_global, learning_influence_config.contribute_to_global),
        updated_at = NOW()
      RETURNING *`,
      [
        input.tenantId,
        userWeight,
        tenantWeight,
        globalWeight,
        JSON.stringify(input.dimensionOverrides || {}),
        input.enableUserLearning ?? true,
        input.enableTenantAggregation ?? true,
        input.enableGlobalLearning ?? true,
        input.contributeToGlobal ?? true,
        'high',
      ]
    );

    return this.mapInfluenceConfig(result.rows[0]);
  }

  // ============================================================================
  // USER LEARNED PREFERENCES
  // ============================================================================

  async getUserPreferences(tenantId: string, userId: string): Promise<UserLearnedPreference[]> {
    const result = await this.pool.query(
      `SELECT * FROM user_learned_preferences
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY confidence DESC`,
      [tenantId, userId]
    );

    return result.rows.map(this.mapUserPreference);
  }

  async setUserPreference(input: UserPreferenceInput): Promise<UserLearnedPreference> {
    const result = await this.pool.query(
      `INSERT INTO user_learned_preferences (
        tenant_id, user_id, preference_key, preference_category,
        preference_value, confidence, learned_from
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id, user_id, preference_key) DO UPDATE SET
        preference_value = EXCLUDED.preference_value,
        confidence = GREATEST(user_learned_preferences.confidence, EXCLUDED.confidence),
        evidence_count = user_learned_preferences.evidence_count + 1,
        last_evidence_at = NOW(),
        current_version = user_learned_preferences.current_version + 1,
        updated_at = NOW()
      RETURNING *`,
      [
        input.tenantId,
        input.userId,
        input.preferenceKey,
        input.preferenceCategory || null,
        JSON.stringify(input.preferenceValue),
        input.confidence ?? 0.50,
        input.learnedFrom || 'implicit_behavior',
      ]
    );

    // Version the preference
    await this.pool.query(
      `INSERT INTO user_preference_versions (
        preference_id, version, preference_value, confidence, change_type, change_reason
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        result.rows[0].id,
        result.rows[0].current_version,
        JSON.stringify(input.preferenceValue),
        input.confidence ?? 0.50,
        'update',
        `Learned from ${input.learnedFrom || 'implicit_behavior'}`,
      ]
    );

    return this.mapUserPreference(result.rows[0]);
  }

  async strengthenPreference(
    tenantId: string,
    userId: string,
    preferenceKey: string,
    additionalEvidence: Record<string, unknown>
  ): Promise<void> {
    await this.pool.query(
      `UPDATE user_learned_preferences
       SET 
         confidence = LEAST(confidence + 0.05, 1.0),
         evidence_count = evidence_count + 1,
         last_evidence_at = NOW(),
         updated_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2 AND preference_key = $3`,
      [tenantId, userId, preferenceKey]
    );
  }

  async weakenPreference(
    tenantId: string,
    userId: string,
    preferenceKey: string,
    reason: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE user_learned_preferences
       SET 
         confidence = GREATEST(confidence - 0.10, 0.0),
         updated_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2 AND preference_key = $3`,
      [tenantId, userId, preferenceKey]
    );
  }

  // ============================================================================
  // TENANT AGGREGATE LEARNING
  // ============================================================================

  async getTenantLearning(tenantId: string): Promise<TenantAggregateLearning[]> {
    const result = await this.pool.query(
      `SELECT * FROM tenant_aggregate_learning
       WHERE tenant_id = $1
       ORDER BY last_updated DESC`,
      [tenantId]
    );

    return result.rows.map(this.mapTenantLearning);
  }

  async recordLearningEvent(input: TenantLearningEventInput): Promise<string> {
    const result = await this.pool.query(
      `SELECT record_learning_event($1, $2, $3, $4, $5, $6) as event_id`,
      [
        input.tenantId,
        input.userId,
        input.eventType,
        input.learningDimension,
        JSON.stringify(input.eventData),
        input.impactScore ?? 0.50,
      ]
    );

    return result.rows[0].event_id;
  }

  async getTenantModelPerformance(
    tenantId: string,
    taskType?: string
  ): Promise<TenantModelPerformance[]> {
    let query = `SELECT * FROM tenant_model_performance WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (taskType) {
      query += ` AND task_type = $2`;
      params.push(taskType);
    }

    query += ` ORDER BY quality_score DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapTenantModelPerformance);
  }

  async updateTenantModelPerformance(
    tenantId: string,
    modelId: string,
    taskType: string,
    success: boolean,
    feedbackPositive?: boolean
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO tenant_model_performance (
        tenant_id, model_id, task_type,
        total_uses, successful_uses,
        positive_feedback, negative_feedback
      ) VALUES ($1, $2, $3, 1, $4, $5, $6)
      ON CONFLICT (tenant_id, model_id, task_type) DO UPDATE SET
        total_uses = tenant_model_performance.total_uses + 1,
        successful_uses = tenant_model_performance.successful_uses + CASE WHEN $4 THEN 1 ELSE 0 END,
        positive_feedback = tenant_model_performance.positive_feedback + CASE WHEN $5 THEN 1 ELSE 0 END,
        negative_feedback = tenant_model_performance.negative_feedback + CASE WHEN $6 THEN 1 ELSE 0 END,
        quality_score = CASE 
          WHEN tenant_model_performance.total_uses > 0 
          THEN (tenant_model_performance.successful_uses + CASE WHEN $4 THEN 1 ELSE 0 END)::DECIMAL / 
               (tenant_model_performance.total_uses + 1)
          ELSE 0.5
        END,
        confidence = LEAST(0.95, 0.3 + (tenant_model_performance.total_uses + 1) * 0.01),
        updated_at = NOW()`,
      [
        tenantId,
        modelId,
        taskType,
        success,
        feedbackPositive === true,
        feedbackPositive === false,
      ]
    );
  }

  // ============================================================================
  // GLOBAL AGGREGATE LEARNING
  // ============================================================================

  async getGlobalLearning(): Promise<GlobalAggregateLearning[]> {
    const result = await this.pool.query(
      `SELECT * FROM global_aggregate_learning ORDER BY last_updated DESC`
    );
    return result.rows.map(this.mapGlobalLearning);
  }

  async getGlobalModelPerformance(taskType?: string): Promise<GlobalModelPerformance[]> {
    let query = `SELECT * FROM global_model_performance`;
    const params: unknown[] = [];

    if (taskType) {
      query += ` WHERE task_type = $1`;
      params.push(taskType);
    }

    query += ` ORDER BY quality_score DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapGlobalModelPerformance);
  }

  async aggregateToGlobal(): Promise<void> {
    await this.pool.query(`SELECT aggregate_to_global()`);
  }

  // ============================================================================
  // SNAPSHOTS & RECOVERY
  // ============================================================================

  async createSnapshot(
    scopeType: ScopeType,
    scopeId?: string,
    tenantId?: string
  ): Promise<string> {
    const result = await this.pool.query(
      `SELECT create_learning_snapshot($1, $2, $3) as snapshot_id`,
      [scopeType, scopeId || null, tenantId || null]
    );

    return result.rows[0].snapshot_id;
  }

  async getLatestSnapshot(
    scopeType: ScopeType,
    scopeId?: string
  ): Promise<LearningSnapshot | null> {
    const result = await this.pool.query(
      `SELECT * FROM learning_snapshots
       WHERE scope_type = $1 AND scope_id IS NOT DISTINCT FROM $2 AND is_current = true
       ORDER BY snapshot_timestamp DESC
       LIMIT 1`,
      [scopeType, scopeId || null]
    );

    if (result.rows.length === 0) return null;
    return this.mapSnapshot(result.rows[0]);
  }

  async recoverFromSnapshot(
    snapshotId: string,
    tenantId?: string
  ): Promise<LearningRecoveryLog> {
    const startTime = Date.now();

    // Get snapshot
    const snapshotResult = await this.pool.query(
      `SELECT * FROM learning_snapshots WHERE id = $1`,
      [snapshotId]
    );

    if (snapshotResult.rows.length === 0) {
      throw new Error('Snapshot not found');
    }

    const snapshot = snapshotResult.rows[0];
    let recordsRecovered = 0;
    let success = true;
    let errorMessage: string | undefined;

    try {
      const state = snapshot.learning_state;

      if (snapshot.scope_type === 'user') {
        // Recover user preferences
        if (state.preferences) {
          for (const pref of state.preferences) {
            await this.pool.query(
              `INSERT INTO user_learned_preferences (
                id, tenant_id, user_id, preference_key, preference_category,
                preference_value, confidence, evidence_count, learned_from
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (tenant_id, user_id, preference_key) DO UPDATE SET
                preference_value = EXCLUDED.preference_value,
                confidence = EXCLUDED.confidence`,
              [
                pref.id, pref.tenant_id, pref.user_id, pref.preference_key,
                pref.preference_category, JSON.stringify(pref.preference_value),
                pref.confidence, pref.evidence_count, pref.learned_from,
              ]
            );
            recordsRecovered++;
          }
        }

        // Recover user rules
        if (state.rules) {
          for (const rule of state.rules) {
            await this.pool.query(
              `INSERT INTO user_rules (
                id, tenant_id, user_id, rule_name, rule_category,
                rule_content, rule_priority, is_active
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (tenant_id, user_id, rule_name) DO UPDATE SET
                rule_content = EXCLUDED.rule_content,
                rule_priority = EXCLUDED.rule_priority`,
              [
                rule.id, rule.tenant_id, rule.user_id, rule.rule_name,
                rule.rule_category, rule.rule_content, rule.rule_priority, rule.is_active,
              ]
            );
            recordsRecovered++;
          }
        }
      } else if (snapshot.scope_type === 'tenant') {
        // Recover tenant aggregate learning
        if (state.aggregate_learning) {
          for (const learning of state.aggregate_learning) {
            await this.pool.query(
              `INSERT INTO tenant_aggregate_learning (
                id, tenant_id, learning_dimension, state_data, confidence, sample_count
              ) VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (tenant_id, learning_dimension) DO UPDATE SET
                state_data = EXCLUDED.state_data,
                confidence = EXCLUDED.confidence`,
              [
                learning.id, learning.tenant_id, learning.learning_dimension,
                JSON.stringify(learning.state_data), learning.confidence, learning.sample_count,
              ]
            );
            recordsRecovered++;
          }
        }

        // Recover model performance
        if (state.model_performance) {
          for (const perf of state.model_performance) {
            await this.pool.query(
              `INSERT INTO tenant_model_performance (
                id, tenant_id, model_id, task_type,
                quality_score, speed_score, cost_efficiency_score, reliability_score,
                total_uses, successful_uses, confidence
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (tenant_id, model_id, task_type) DO UPDATE SET
                quality_score = EXCLUDED.quality_score,
                total_uses = EXCLUDED.total_uses`,
              [
                perf.id, perf.tenant_id, perf.model_id, perf.task_type,
                perf.quality_score, perf.speed_score, perf.cost_efficiency_score,
                perf.reliability_score, perf.total_uses, perf.successful_uses, perf.confidence,
              ]
            );
            recordsRecovered++;
          }
        }
      } else if (snapshot.scope_type === 'global') {
        // Recover global learning
        if (state.aggregate_learning) {
          for (const learning of state.aggregate_learning) {
            await this.pool.query(
              `INSERT INTO global_aggregate_learning (
                id, learning_dimension, state_data, confidence, sample_count
              ) VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (learning_dimension) DO UPDATE SET
                state_data = EXCLUDED.state_data,
                confidence = EXCLUDED.confidence`,
              [
                learning.id, learning.learning_dimension,
                JSON.stringify(learning.state_data), learning.confidence, learning.sample_count,
              ]
            );
            recordsRecovered++;
          }
        }
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    const timeToRecover = Date.now() - startTime;

    // Log recovery
    const logResult = await this.pool.query(
      `INSERT INTO learning_recovery_log (
        recovery_type, scope_type, scope_id, tenant_id, snapshot_id,
        started_at, completed_at, success, records_recovered, time_to_recover_ms,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10)
      RETURNING *`,
      [
        'snapshot_restore',
        snapshot.scope_type,
        snapshot.scope_id,
        tenantId || snapshot.tenant_id,
        snapshotId,
        new Date(startTime).toISOString(),
        success,
        recordsRecovered,
        timeToRecover,
        errorMessage || null,
      ]
    );

    return this.mapRecoveryLog(logResult.rows[0]);
  }

  async getRecoveryLogs(
    tenantId?: string,
    limit: number = 20
  ): Promise<LearningRecoveryLog[]> {
    let query = `SELECT * FROM learning_recovery_log`;
    const params: unknown[] = [];

    if (tenantId) {
      query += ` WHERE tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY started_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapRecoveryLog);
  }

  // ============================================================================
  // SCHEDULED TASKS
  // ============================================================================

  /**
   * Scheduled task to create snapshots (run daily)
   */
  async createScheduledSnapshots(): Promise<void> {
    // Create global snapshot
    await this.createSnapshot('global');

    // Create tenant snapshots for active tenants
    const tenantsResult = await this.pool.query(
      `SELECT DISTINCT tenant_id FROM tenant_aggregate_learning`
    );

    for (const row of tenantsResult.rows) {
      await this.createSnapshot('tenant', row.tenant_id, row.tenant_id);
    }
  }

  /**
   * Scheduled task to aggregate tenant learning to global (run weekly)
   */
  async runGlobalAggregation(): Promise<void> {
    await this.aggregateToGlobal();
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapInfluenceConfig(row: Record<string, unknown>): LearningInfluenceConfig {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userWeight: Number(row.user_weight),
      tenantWeight: Number(row.tenant_weight),
      globalWeight: Number(row.global_weight),
      dimensionOverrides: row.dimension_overrides as Record<string, { userWeight: number; tenantWeight: number; globalWeight: number }>,
      enableUserLearning: row.enable_user_learning as boolean,
      enableTenantAggregation: row.enable_tenant_aggregation as boolean,
      enableGlobalLearning: row.enable_global_learning as boolean,
      contributeToGlobal: row.contribute_to_global as boolean,
      anonymizationLevel: row.anonymization_level as 'low' | 'medium' | 'high',
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapUserPreference(row: Record<string, unknown>): UserLearnedPreference {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      preferenceKey: row.preference_key as string,
      preferenceCategory: row.preference_category as UserLearnedPreference['preferenceCategory'],
      currentVersion: row.current_version as number,
      preferenceValue: row.preference_value,
      confidence: Number(row.confidence),
      evidenceCount: row.evidence_count as number,
      lastEvidenceAt: row.last_evidence_at as string,
      learnedFrom: row.learned_from as UserLearnedPreference['learnedFrom'],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapTenantLearning(row: Record<string, unknown>): TenantAggregateLearning {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      learningDimension: row.learning_dimension as string,
      currentVersion: row.current_version as number,
      stateData: row.state_data as Record<string, unknown>,
      confidence: Number(row.confidence),
      sampleCount: row.sample_count as number,
      contributingUsers: row.contributing_users as number,
      lastUpdated: row.last_updated as string,
      lastLearningEventAt: row.last_learning_event_at as string | undefined,
    };
  }

  private mapTenantModelPerformance(row: Record<string, unknown>): TenantModelPerformance {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      modelId: row.model_id as string,
      taskType: row.task_type as string,
      qualityScore: Number(row.quality_score),
      speedScore: Number(row.speed_score),
      costEfficiencyScore: Number(row.cost_efficiency_score),
      reliabilityScore: Number(row.reliability_score),
      totalUses: row.total_uses as number,
      successfulUses: row.successful_uses as number,
      positiveFeedback: row.positive_feedback as number,
      negativeFeedback: row.negative_feedback as number,
      confidence: Number(row.confidence),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapGlobalLearning(row: Record<string, unknown>): GlobalAggregateLearning {
    return {
      id: row.id as string,
      learningDimension: row.learning_dimension as string,
      currentVersion: row.current_version as number,
      stateData: row.state_data as Record<string, unknown>,
      confidence: Number(row.confidence),
      sampleCount: row.sample_count as number,
      contributingTenants: row.contributing_tenants as number,
      contributingUsers: row.contributing_users as number,
      minTenantThreshold: row.min_tenant_threshold as number,
      anonymizationLevel: row.anonymization_level as 'low' | 'medium' | 'high',
      lastUpdated: row.last_updated as string,
      lastAggregationAt: row.last_aggregation_at as string | undefined,
    };
  }

  private mapGlobalModelPerformance(row: Record<string, unknown>): GlobalModelPerformance {
    return {
      id: row.id as string,
      modelId: row.model_id as string,
      taskType: row.task_type as string,
      qualityScore: Number(row.quality_score),
      speedScore: Number(row.speed_score),
      costEfficiencyScore: Number(row.cost_efficiency_score),
      reliabilityScore: Number(row.reliability_score),
      totalTenantsUsing: row.total_tenants_using as number,
      totalUses: row.total_uses as number,
      positiveFeedbackRate: Number(row.positive_feedback_rate),
      confidence: Number(row.confidence),
      lastAggregatedAt: row.last_aggregated_at as string,
    };
  }

  private mapSnapshot(row: Record<string, unknown>): LearningSnapshot {
    return {
      id: row.id as string,
      scopeType: row.scope_type as ScopeType,
      scopeId: row.scope_id as string | undefined,
      tenantId: row.tenant_id as string | undefined,
      snapshotVersion: row.snapshot_version as number,
      snapshotTimestamp: row.snapshot_timestamp as string,
      learningState: row.learning_state as Record<string, unknown>,
      stateChecksum: row.state_checksum as string,
      modelVersions: row.model_versions as Record<string, string>,
      totalSamples: row.total_samples as number | undefined,
      isCurrent: row.is_current as boolean,
      canRecoverFrom: row.can_recover_from as boolean,
      recoveryTestedAt: row.recovery_tested_at as string | undefined,
    };
  }

  private mapRecoveryLog(row: Record<string, unknown>): LearningRecoveryLog {
    return {
      id: row.id as string,
      recoveryType: row.recovery_type as RecoveryType,
      scopeType: row.scope_type as ScopeType,
      scopeId: row.scope_id as string | undefined,
      tenantId: row.tenant_id as string | undefined,
      snapshotId: row.snapshot_id as string | undefined,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
      success: row.success as boolean | undefined,
      recordsRecovered: row.records_recovered as number | undefined,
      timeToRecoverMs: row.time_to_recover_ms as number | undefined,
      errorMessage: row.error_message as string | undefined,
      errorDetails: row.error_details as Record<string, unknown> | undefined,
    };
  }
}

export const learningInfluenceService = new LearningInfluenceService(
  null as unknown as Pool // Will be initialized with actual pool
);
