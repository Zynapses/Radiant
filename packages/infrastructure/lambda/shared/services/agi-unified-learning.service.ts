// AGI Unified Learning Service
// Single integration point for ALL AGI learning - ensures everything is persistent
//
// @deprecated Use enhanced-learning.service.ts for comprehensive learning features.
// Migration: Import { enhancedLearningService } from './enhanced-learning.service'
//

import { executeStatement, stringParam } from '../db/client';
import crypto from 'crypto';

export type LearningType = 
  | 'prompt' 
  | 'model' 
  | 'routing' 
  | 'domain' 
  | 'mode' 
  | 'preprompt' 
  | 'quality'
  | 'idea'
  | 'user_preference';

export interface LearningContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  planId?: string;
}

export interface ModelSelectionOutcome {
  promptHash: string;
  modelId: string;
  provider: string;
  domainId?: string;
  orchestrationMode?: string;
  selectionReason?: string;
  rating?: number;
  latencyMs?: number;
  costCents?: number;
  hadError?: boolean;
  errorType?: string;
}

export interface DomainDetectionFeedback {
  promptText: string;
  promptHash: string;
  detectedDomainId?: string;
  detectedDomainName?: string;
  correctDomainId?: string;
  feedbackType: 'confirmed' | 'corrected' | 'implicit';
  confidence?: number;
}

export interface RoutingOutcome {
  routingPath: string;
  promptHash: string;
  steps: { step: string; decision: string; latencyMs: number }[];
  totalLatencyMs: number;
  cacheHits: number;
  rating?: number;
}

export interface ModeOutcome {
  orchestrationMode: string;
  promptCategory?: string;
  domainId?: string;
  rating: number;
  latencyMs?: number;
  costCents?: number;
}

export interface ResponseQualityMetrics {
  planId?: string;
  conversationId?: string;
  messageId?: string;
  rating?: number;
  wasCopied?: boolean;
  wasRegenerated?: boolean;
  wasEdited?: boolean;
  timeSpentReadingMs?: number;
  responseLength?: number;
  hasCodeBlocks?: boolean;
  modelUsed?: string;
  orchestrationMode?: string;
  domainId?: string;
}

export interface UserPreferenceUpdate {
  domainId?: string;
  rating?: number;
  responseLength?: 'concise' | 'detailed' | 'comprehensive';
  responseFormat?: 'prose' | 'lists' | 'mixed';
}

class AGIUnifiedLearningService {
  /**
   * Record model selection outcome - PERSISTENT
   */
  async recordModelSelection(
    ctx: LearningContext,
    outcome: ModelSelectionOutcome
  ): Promise<string> {
    const result = await executeStatement({
      sql: `
        SELECT record_model_selection_outcome(
          $1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7, $8, $9, $10
        ) as id
      `,
      parameters: [
        stringParam('tenantId', ctx.tenantId),
        stringParam('userId', ctx.userId || ''),
        stringParam('promptHash', outcome.promptHash),
        stringParam('modelId', outcome.modelId),
        stringParam('provider', outcome.provider),
        stringParam('domainId', outcome.domainId || ''),
        stringParam('orchestrationMode', outcome.orchestrationMode || ''),
        stringParam('selectionReason', outcome.selectionReason || ''),
        stringParam('rating', outcome.rating ? String(outcome.rating) : ''),
        stringParam('latencyMs', outcome.latencyMs ? String(outcome.latencyMs) : ''),
      ],
    });

    return result.rows?.[0]?.id || '';
  }

  /**
   * Record domain detection feedback - PERSISTENT
   */
  async recordDomainFeedback(
    ctx: LearningContext,
    feedback: DomainDetectionFeedback
  ): Promise<void> {
    await executeStatement({
      sql: `
        SELECT record_domain_detection_feedback(
          $1::uuid, $2::uuid, $3, $4, $5::uuid, $6, $7::uuid, $8, $9
        )
      `,
      parameters: [
        stringParam('tenantId', ctx.tenantId),
        stringParam('userId', ctx.userId || ''),
        stringParam('promptText', feedback.promptText),
        stringParam('promptHash', feedback.promptHash),
        stringParam('detectedDomainId', feedback.detectedDomainId || ''),
        stringParam('detectedDomainName', feedback.detectedDomainName || ''),
        stringParam('correctDomainId', feedback.correctDomainId || ''),
        stringParam('feedbackType', feedback.feedbackType),
        stringParam('confidence', feedback.confidence ? String(feedback.confidence) : ''),
      ],
    });
  }

  /**
   * Record orchestration mode outcome - PERSISTENT
   */
  async recordModeOutcome(
    ctx: LearningContext,
    outcome: ModeOutcome
  ): Promise<void> {
    await executeStatement({
      sql: `
        SELECT record_mode_outcome(
          $1::uuid, $2, $3, $4::uuid, $5, $6, $7
        )
      `,
      parameters: [
        stringParam('tenantId', ctx.tenantId),
        stringParam('orchestrationMode', outcome.orchestrationMode),
        stringParam('promptCategory', outcome.promptCategory || ''),
        stringParam('domainId', outcome.domainId || ''),
        stringParam('rating', String(outcome.rating)),
        stringParam('latencyMs', outcome.latencyMs ? String(outcome.latencyMs) : ''),
        stringParam('costCents', outcome.costCents ? String(outcome.costCents) : ''),
      ],
    });
  }

  /**
   * Record routing outcome - PERSISTENT
   */
  async recordRoutingOutcome(
    ctx: LearningContext,
    outcome: RoutingOutcome
  ): Promise<void> {
    const routingHash = crypto.createHash('sha256')
      .update(outcome.routingPath + outcome.promptHash)
      .digest('hex')
      .slice(0, 16);

    await executeStatement({
      sql: `
        INSERT INTO agi_routing_outcomes (
          tenant_id, routing_path, routing_decision_hash, prompt_hash,
          steps_taken, total_latency_ms, cache_hits, final_rating,
          routing_effectiveness
        ) VALUES (
          $1::uuid, $2, $3, $4, $5::jsonb, $6, $7, $8,
          CASE WHEN $8::integer >= 4 THEN 1.0 ELSE 0.5 END
        )
        ON CONFLICT (tenant_id, routing_decision_hash) DO UPDATE SET
          times_used = agi_routing_outcomes.times_used + 1,
          avg_rating = (agi_routing_outcomes.avg_rating * agi_routing_outcomes.times_used + $8) / (agi_routing_outcomes.times_used + 1),
          success_rate = (agi_routing_outcomes.success_rate * agi_routing_outcomes.times_used + CASE WHEN $8::integer >= 4 THEN 1.0 ELSE 0.0 END) / (agi_routing_outcomes.times_used + 1),
          last_used_at = NOW()
      `,
      parameters: [
        stringParam('tenantId', ctx.tenantId),
        stringParam('routingPath', outcome.routingPath),
        stringParam('routingHash', routingHash),
        stringParam('promptHash', outcome.promptHash),
        stringParam('steps', JSON.stringify(outcome.steps)),
        stringParam('totalLatencyMs', String(outcome.totalLatencyMs)),
        stringParam('cacheHits', String(outcome.cacheHits)),
        stringParam('rating', outcome.rating ? String(outcome.rating) : '0'),
      ],
    });
  }

  /**
   * Record response quality metrics - PERSISTENT
   */
  async recordQualityMetrics(
    ctx: LearningContext,
    metrics: ResponseQualityMetrics
  ): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO agi_response_quality_metrics (
          tenant_id, plan_id, conversation_id, message_id,
          explicit_rating, was_copied, was_regenerated, was_edited,
          time_spent_reading_ms, response_length, has_code_blocks,
          model_used, orchestration_mode, domain_id
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid,
          $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::uuid
        )
      `,
      parameters: [
        stringParam('tenantId', ctx.tenantId),
        stringParam('planId', metrics.planId || ''),
        stringParam('conversationId', metrics.conversationId || ''),
        stringParam('messageId', metrics.messageId || ''),
        stringParam('rating', metrics.rating ? String(metrics.rating) : ''),
        stringParam('wasCopied', String(metrics.wasCopied || false)),
        stringParam('wasRegenerated', String(metrics.wasRegenerated || false)),
        stringParam('wasEdited', String(metrics.wasEdited || false)),
        stringParam('timeSpentReadingMs', metrics.timeSpentReadingMs ? String(metrics.timeSpentReadingMs) : ''),
        stringParam('responseLength', metrics.responseLength ? String(metrics.responseLength) : ''),
        stringParam('hasCodeBlocks', String(metrics.hasCodeBlocks || false)),
        stringParam('modelUsed', metrics.modelUsed || ''),
        stringParam('orchestrationMode', metrics.orchestrationMode || ''),
        stringParam('domainId', metrics.domainId || ''),
      ],
    });
  }

  /**
   * Update user learning profile - PERSISTENT
   */
  async updateUserProfile(
    ctx: LearningContext,
    update: UserPreferenceUpdate
  ): Promise<void> {
    if (!ctx.userId) return;

    await executeStatement({
      sql: `
        SELECT update_user_learning_profile(
          $1::uuid, $2::uuid, $3::uuid, $4, $5, $6
        )
      `,
      parameters: [
        stringParam('tenantId', ctx.tenantId),
        stringParam('userId', ctx.userId),
        stringParam('domainId', update.domainId || ''),
        stringParam('rating', update.rating ? String(update.rating) : ''),
        stringParam('responseLength', update.responseLength || ''),
        stringParam('responseFormat', update.responseFormat || ''),
      ],
    });
  }

  /**
   * Record preprompt effectiveness - PERSISTENT
   */
  async recordPrepromptEffectiveness(
    ctx: LearningContext,
    prepromptId: string,
    prepromptHash: string,
    domainId: string | undefined,
    orchestrationMode: string | undefined,
    modelId: string | undefined,
    rating: number
  ): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO agi_preprompt_effectiveness (
          tenant_id, preprompt_id, preprompt_hash,
          domain_id, orchestration_mode, model_id,
          response_rating, user_satisfaction
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7,
          CASE WHEN $7 >= 4 THEN true ELSE false END
        )
        ON CONFLICT (tenant_id, preprompt_hash, domain_id, orchestration_mode) DO UPDATE SET
          times_used = agi_preprompt_effectiveness.times_used + 1,
          avg_rating = (agi_preprompt_effectiveness.avg_rating * agi_preprompt_effectiveness.times_used + $7) / (agi_preprompt_effectiveness.times_used + 1),
          success_rate = (agi_preprompt_effectiveness.success_rate * agi_preprompt_effectiveness.times_used + CASE WHEN $7 >= 4 THEN 1.0 ELSE 0.0 END) / (agi_preprompt_effectiveness.times_used + 1),
          last_used_at = NOW()
      `,
      parameters: [
        stringParam('tenantId', ctx.tenantId),
        stringParam('prepromptId', prepromptId),
        stringParam('prepromptHash', prepromptHash),
        stringParam('domainId', domainId || ''),
        stringParam('orchestrationMode', orchestrationMode || ''),
        stringParam('modelId', modelId || ''),
        stringParam('rating', String(rating)),
      ],
    });
  }

  /**
   * Log to unified learning log - PERSISTENT
   */
  async logLearningEvent(
    ctx: LearningContext,
    learningType: LearningType,
    eventSubtype: string,
    data: {
      inputHash?: string;
      decisionType?: string;
      decisionValue?: string;
      decisionConfidence?: number;
      outcomeRating?: number;
      outcomeSuccess?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const result = await executeStatement({
      sql: `
        INSERT INTO agi_unified_learning_log (
          tenant_id, user_id, learning_type, event_subtype,
          session_id, conversation_id, plan_id,
          input_hash, decision_type, decision_value, decision_confidence,
          outcome_rating, outcome_success,
          outcome_recorded_at, metadata
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4,
          $5::uuid, $6::uuid, $7::uuid,
          $8, $9, $10, $11,
          $12, $13,
          CASE WHEN $12 IS NOT NULL THEN NOW() ELSE NULL END,
          $14::jsonb
        )
        RETURNING id
      `,
      parameters: [
        stringParam('tenantId', ctx.tenantId),
        stringParam('userId', ctx.userId || ''),
        stringParam('learningType', learningType),
        stringParam('eventSubtype', eventSubtype),
        stringParam('sessionId', ctx.sessionId || ''),
        stringParam('conversationId', ctx.conversationId || ''),
        stringParam('planId', ctx.planId || ''),
        stringParam('inputHash', data.inputHash || ''),
        stringParam('decisionType', data.decisionType || ''),
        stringParam('decisionValue', data.decisionValue || ''),
        stringParam('decisionConfidence', data.decisionConfidence ? String(data.decisionConfidence) : ''),
        stringParam('outcomeRating', data.outcomeRating ? String(data.outcomeRating) : ''),
        stringParam('outcomeSuccess', data.outcomeSuccess !== undefined ? String(data.outcomeSuccess) : ''),
        stringParam('metadata', JSON.stringify(data.metadata || {})),
      ],
    });

    return result.rows?.[0]?.id || '';
  }

  /**
   * Record outcome for an existing learning event - PERSISTENT
   */
  async recordEventOutcome(
    eventId: string,
    rating: number,
    success?: boolean
  ): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE agi_unified_learning_log
        SET outcome_rating = $1,
            outcome_success = $2,
            outcome_recorded_at = NOW()
        WHERE id = $3::uuid
      `,
      parameters: [
        stringParam('rating', String(rating)),
        stringParam('success', success !== undefined ? String(success) : String(rating >= 4)),
        stringParam('eventId', eventId),
      ],
    });
  }

  /**
   * Get best model for context based on learned outcomes
   */
  async getBestModelForContext(
    tenantId: string,
    domainId?: string,
    orchestrationMode?: string,
    promptCategory?: string
  ): Promise<{ modelId: string; provider: string; successRate: number; avgRating: number }[]> {
    const result = await executeStatement({
      sql: `
        SELECT * FROM get_best_model_for_context(
          $1::uuid, $2::uuid, $3, $4
        )
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('domainId', domainId || ''),
        stringParam('orchestrationMode', orchestrationMode || ''),
        stringParam('promptCategory', promptCategory || ''),
      ],
    });

    return (result.rows || []).map(row => ({
      modelId: row.model_id as string,
      provider: row.provider as string,
      successRate: parseFloat(row.success_rate as string) || 0,
      avgRating: parseFloat(row.avg_rating as string) || 0,
    }));
  }

  /**
   * Get user learning profile
   */
  async getUserProfile(tenantId: string, userId: string): Promise<{
    preferredResponseLength?: string;
    preferredFormat?: string;
    preferredTone?: string;
    topDomains?: { domainId: string; usageCount: number; avgRating: number }[];
    totalInteractions: number;
    avgRatingGiven?: number;
  } | null> {
    const result = await executeStatement({
      sql: `
        SELECT * FROM agi_user_learning_profile
        WHERE tenant_id = $1::uuid AND user_id = $2::uuid
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
      ],
    });

    if (!result.rows?.length) return null;

    const row = result.rows[0];
    return {
      preferredResponseLength: row.preferred_response_length as string,
      preferredFormat: row.preferred_format as string,
      preferredTone: row.preferred_tone as string,
      topDomains: row.top_domains as { domainId: string; usageCount: number; avgRating: number }[],
      totalInteractions: parseInt(row.total_interactions as string) || 0,
      avgRatingGiven: parseFloat(row.avg_rating_given as string),
    };
  }

  /**
   * Get learning statistics for a tenant
   */
  async getLearningStats(tenantId: string): Promise<{
    totalModelOutcomes: number;
    totalRoutingOutcomes: number;
    totalDomainFeedback: number;
    totalModeOutcomes: number;
    totalQualityMetrics: number;
    avgModelSuccessRate: number;
    topPerformingModes: { mode: string; successRate: number }[];
  }> {
    const modelStats = await executeStatement({
      sql: `
        SELECT COUNT(*) as total, AVG(CASE WHEN user_satisfaction THEN 1.0 ELSE 0.0 END) as avg_success
        FROM agi_model_selection_outcomes WHERE tenant_id = $1::uuid
      `,
      parameters: [stringParam('tenantId', tenantId)],
    });

    const routingStats = await executeStatement({
      sql: `SELECT COUNT(*) as total FROM agi_routing_outcomes WHERE tenant_id = $1::uuid`,
      parameters: [stringParam('tenantId', tenantId)],
    });

    const domainStats = await executeStatement({
      sql: `SELECT COUNT(*) as total FROM agi_domain_detection_feedback WHERE tenant_id = $1::uuid`,
      parameters: [stringParam('tenantId', tenantId)],
    });

    const modeStats = await executeStatement({
      sql: `
        SELECT orchestration_mode as mode, success_rate
        FROM agi_orchestration_mode_outcomes 
        WHERE tenant_id = $1::uuid AND times_used >= 5
        ORDER BY success_rate DESC LIMIT 5
      `,
      parameters: [stringParam('tenantId', tenantId)],
    });

    const qualityStats = await executeStatement({
      sql: `SELECT COUNT(*) as total FROM agi_response_quality_metrics WHERE tenant_id = $1::uuid`,
      parameters: [stringParam('tenantId', tenantId)],
    });

    const modelRow = modelStats.rows?.[0] || {};
    const routingRow = routingStats.rows?.[0] || {};
    const domainRow = domainStats.rows?.[0] || {};
    const qualityRow = qualityStats.rows?.[0] || {};

    return {
      totalModelOutcomes: parseInt(modelRow.total as string) || 0,
      totalRoutingOutcomes: parseInt(routingRow.total as string) || 0,
      totalDomainFeedback: parseInt(domainRow.total as string) || 0,
      totalModeOutcomes: (modeStats.rows || []).length,
      totalQualityMetrics: parseInt(qualityRow.total as string) || 0,
      avgModelSuccessRate: parseFloat(modelRow.avg_success as string) || 0,
      topPerformingModes: (modeStats.rows || []).map(row => ({
        mode: row.mode as string,
        successRate: parseFloat(row.success_rate as string) || 0,
      })),
    };
  }

  /**
   * Helper to generate hash
   */
  generateHash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}

export const agiUnifiedLearningService = new AGIUnifiedLearningService();
