// RADIANT v4.18.0 - Learning Service
// Comprehensive data collection and feedback capture for continuous learning

import { executeStatement } from '../db/client';

// ============================================================================
// Types
// ============================================================================

export interface LearningInteraction {
  interactionId: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  requestType: string;
  requestSource: string;
  requestText?: string;
  modelSelected: string;
  responseText?: string;
  detectedSpecialty?: string;
  // Domain taxonomy detection
  detectedDomainId?: string;
  detectedSubspecialtyId?: string;
  domainDetectionConfidence?: number;
  domainMatchScore?: number;
  totalLatencyMs?: number;
  totalCostCents?: number;
  autoQualityScore?: number;
  createdAt: string;
}

export interface LearningFeedback {
  feedbackId: string;
  interactionId: string;
  rating?: number;
  thumbs?: 'up' | 'down';
  feedbackText?: string;
  responseAction?: 'accepted' | 'edited' | 'rejected' | 'regenerated' | 'copied' | 'shared';
  createdAt: string;
}

export interface ImplicitSignal {
  signalId: string;
  interactionId: string;
  timeReadingResponseMs?: number;
  didRegenerate: boolean;
  didCopyResponse: boolean;
  didContinueSession: boolean;
  didAbandonSession: boolean;
  didAskFollowup: boolean;
}

export interface LearningOutcome {
  outcomeId: string;
  interactionId: string;
  outcomeScore?: number;
  routingWasOptimal?: boolean;
  includeInTraining: boolean;
  trainingWeight: number;
}

export interface ModelPerformance {
  modelId: string;
  specialty?: string;
  periodStart: string;
  totalRequests: number;
  avgQualityScore?: number;
  avgLatencyMs?: number;
  totalCostCents?: number;
  positiveRatio?: number;
}

export interface SpecialtyInsight {
  specialty: string;
  bestModelQuality?: string;
  bestModelSpeed?: string;
  bestModelCost?: string;
  modelRankings: Array<{
    model: string;
    avgQuality: number;
    avgLatency: number;
    samples: number;
  }>;
  samplesAnalyzed: number;
}

export interface RecordInteractionParams {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  requestType: string;
  requestSource: string;
  requestText?: string;
  modelSelected: string;
  modelsConsidered?: string[];
  routingStrategy?: string;
  routingReason?: string;
  responseText?: string;
  detectedSpecialty?: string;
  detectedIntent?: string;
  detectedComplexity?: 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';
  // Domain taxonomy detection
  detectedDomainId?: string;
  detectedSubspecialtyId?: string;
  domainDetectionConfidence?: number;
  domainMatchScore?: number;
  totalLatencyMs?: number;
  modelLatencyMs?: number;
  routingLatencyMs?: number;
  inputCostCents?: number;
  outputCostCents?: number;
  totalCostCents?: number;
  autoQualityScore?: number;
  irhMoralCompassChecked?: boolean;
  irhMoralApproved?: boolean;
  irhMoralReasoning?: string;
  irhConfidenceCalibrated?: boolean;
  irhCalibratedConfidence?: number;
  irhContextDetected?: boolean;
  irhAdaptationsApplied?: string[];
  hadError?: boolean;
  errorType?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Learning Service
// ============================================================================

export class LearningService {
  // ============================================================================
  // Record Interactions
  // ============================================================================

  async recordInteraction(params: RecordInteractionParams): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO learning_interactions (
        tenant_id, user_id, session_id, request_type, request_source,
        request_text, model_selected, models_considered, routing_strategy, routing_reason,
        response_text, detected_specialty, detected_intent, detected_complexity,
        total_latency_ms, model_latency_ms, routing_latency_ms,
        input_cost_cents, output_cost_cents, total_cost_cents,
        auto_quality_score,
        irh_moral_compass_checked, irh_moral_approved, irh_moral_reasoning,
        irh_confidence_calibrated, irh_calibrated_confidence,
        irh_context_detected, irh_adaptations_applied,
        had_error, error_type, error_message, context_metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
      ) RETURNING interaction_id`,
      [
        { name: 'p1', value: { stringValue: params.tenantId } },
        { name: 'p2', value: params.userId ? { stringValue: params.userId } : { isNull: true } },
        { name: 'p3', value: params.sessionId ? { stringValue: params.sessionId } : { isNull: true } },
        { name: 'p4', value: { stringValue: params.requestType } },
        { name: 'p5', value: { stringValue: params.requestSource || 'api' } },
        { name: 'p6', value: params.requestText ? { stringValue: params.requestText.substring(0, 50000) } : { isNull: true } },
        { name: 'p7', value: { stringValue: params.modelSelected } },
        { name: 'p8', value: params.modelsConsidered ? { stringValue: `{${params.modelsConsidered.join(',')}}` } : { isNull: true } },
        { name: 'p9', value: params.routingStrategy ? { stringValue: params.routingStrategy } : { isNull: true } },
        { name: 'p10', value: params.routingReason ? { stringValue: params.routingReason } : { isNull: true } },
        { name: 'p11', value: params.responseText ? { stringValue: params.responseText.substring(0, 100000) } : { isNull: true } },
        { name: 'p12', value: params.detectedSpecialty ? { stringValue: params.detectedSpecialty } : { isNull: true } },
        { name: 'p13', value: params.detectedIntent ? { stringValue: params.detectedIntent } : { isNull: true } },
        { name: 'p14', value: params.detectedComplexity ? { stringValue: params.detectedComplexity } : { isNull: true } },
        { name: 'p15', value: params.totalLatencyMs !== undefined ? { longValue: params.totalLatencyMs } : { isNull: true } },
        { name: 'p16', value: params.modelLatencyMs !== undefined ? { longValue: params.modelLatencyMs } : { isNull: true } },
        { name: 'p17', value: params.routingLatencyMs !== undefined ? { longValue: params.routingLatencyMs } : { isNull: true } },
        { name: 'p18', value: params.inputCostCents !== undefined ? { doubleValue: params.inputCostCents } : { isNull: true } },
        { name: 'p19', value: params.outputCostCents !== undefined ? { doubleValue: params.outputCostCents } : { isNull: true } },
        { name: 'p20', value: params.totalCostCents !== undefined ? { doubleValue: params.totalCostCents } : { isNull: true } },
        { name: 'p21', value: params.autoQualityScore !== undefined ? { doubleValue: params.autoQualityScore } : { isNull: true } },
        { name: 'p22', value: { booleanValue: params.irhMoralCompassChecked ?? false } },
        { name: 'p23', value: params.irhMoralApproved !== undefined ? { booleanValue: params.irhMoralApproved } : { isNull: true } },
        { name: 'p24', value: params.irhMoralReasoning ? { stringValue: params.irhMoralReasoning } : { isNull: true } },
        { name: 'p25', value: { booleanValue: params.irhConfidenceCalibrated ?? false } },
        { name: 'p26', value: params.irhCalibratedConfidence !== undefined ? { doubleValue: params.irhCalibratedConfidence } : { isNull: true } },
        { name: 'p27', value: { booleanValue: params.irhContextDetected ?? false } },
        { name: 'p28', value: params.irhAdaptationsApplied ? { stringValue: `{${params.irhAdaptationsApplied.join(',')}}` } : { isNull: true } },
        { name: 'p29', value: { booleanValue: params.hadError ?? false } },
        { name: 'p30', value: params.errorType ? { stringValue: params.errorType } : { isNull: true } },
        { name: 'p31', value: params.errorMessage ? { stringValue: params.errorMessage } : { isNull: true } },
        { name: 'p32', value: params.metadata ? { stringValue: JSON.stringify(params.metadata) } : { stringValue: '{}' } },
      ]
    );

    const interactionId = (result.rows[0] as { interaction_id: string }).interaction_id;

    // Create outcome record
    await executeStatement(
      `INSERT INTO learning_outcomes (interaction_id) VALUES ($1)`,
      [{ name: 'interactionId', value: { stringValue: interactionId } }]
    );

    return interactionId;
  }

  // ============================================================================
  // Record Feedback
  // ============================================================================

  async recordFeedback(
    interactionId: string,
    feedback: {
      rating?: number;
      thumbs?: 'up' | 'down';
      feedbackText?: string;
      feedbackCategories?: string[];
      accuracyRating?: number;
      helpfulnessRating?: number;
      clarityRating?: number;
      completenessRating?: number;
      responseAction?: 'accepted' | 'edited' | 'rejected' | 'regenerated' | 'copied' | 'shared';
      editedResponse?: string;
      feedbackSource?: string;
      timeToFeedbackMs?: number;
    }
  ): Promise<string> {
    // Get tenant and user from interaction
    const interactionResult = await executeStatement(
      `SELECT tenant_id, user_id FROM learning_interactions WHERE interaction_id = $1`,
      [{ name: 'interactionId', value: { stringValue: interactionId } }]
    );

    if (interactionResult.rows.length === 0) {
      throw new Error(`Interaction ${interactionId} not found`);
    }

    const interaction = interactionResult.rows[0] as { tenant_id: string; user_id: string | null };

    const result = await executeStatement(
      `INSERT INTO learning_feedback (
        interaction_id, tenant_id, user_id, rating, thumbs, feedback_text,
        feedback_categories, accuracy_rating, helpfulness_rating, clarity_rating, completeness_rating,
        response_action, edited_response, feedback_source, time_to_feedback_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING feedback_id`,
      [
        { name: 'p1', value: { stringValue: interactionId } },
        { name: 'p2', value: { stringValue: interaction.tenant_id } },
        { name: 'p3', value: interaction.user_id ? { stringValue: interaction.user_id } : { isNull: true } },
        { name: 'p4', value: feedback.rating !== undefined ? { longValue: feedback.rating } : { isNull: true } },
        { name: 'p5', value: feedback.thumbs ? { stringValue: feedback.thumbs } : { isNull: true } },
        { name: 'p6', value: feedback.feedbackText ? { stringValue: feedback.feedbackText } : { isNull: true } },
        { name: 'p7', value: feedback.feedbackCategories ? { stringValue: `{${feedback.feedbackCategories.join(',')}}` } : { isNull: true } },
        { name: 'p8', value: feedback.accuracyRating !== undefined ? { longValue: feedback.accuracyRating } : { isNull: true } },
        { name: 'p9', value: feedback.helpfulnessRating !== undefined ? { longValue: feedback.helpfulnessRating } : { isNull: true } },
        { name: 'p10', value: feedback.clarityRating !== undefined ? { longValue: feedback.clarityRating } : { isNull: true } },
        { name: 'p11', value: feedback.completenessRating !== undefined ? { longValue: feedback.completenessRating } : { isNull: true } },
        { name: 'p12', value: feedback.responseAction ? { stringValue: feedback.responseAction } : { isNull: true } },
        { name: 'p13', value: feedback.editedResponse ? { stringValue: feedback.editedResponse } : { isNull: true } },
        { name: 'p14', value: feedback.feedbackSource ? { stringValue: feedback.feedbackSource } : { isNull: true } },
        { name: 'p15', value: feedback.timeToFeedbackMs !== undefined ? { longValue: feedback.timeToFeedbackMs } : { isNull: true } },
      ]
    );

    return (result.rows[0] as { feedback_id: string }).feedback_id;
  }

  // ============================================================================
  // Record Implicit Signals
  // ============================================================================

  async recordImplicitSignals(
    interactionId: string,
    signals: {
      timeReadingResponseMs?: number;
      timeBeforeNextActionMs?: number;
      didRegenerate?: boolean;
      regenerateCount?: number;
      didCopyResponse?: boolean;
      didShareResponse?: boolean;
      didBookmarkResponse?: boolean;
      didContinueSession?: boolean;
      didAbandonSession?: boolean;
      messagesAfterInSession?: number;
      didAskFollowup?: boolean;
      followupWasClarification?: boolean;
      followupWasDeeper?: boolean;
      wasAbTest?: boolean;
      abVariant?: string;
      abChosen?: boolean;
    }
  ): Promise<string> {
    // Get tenant and user from interaction
    const interactionResult = await executeStatement(
      `SELECT tenant_id, user_id FROM learning_interactions WHERE interaction_id = $1`,
      [{ name: 'interactionId', value: { stringValue: interactionId } }]
    );

    if (interactionResult.rows.length === 0) {
      throw new Error(`Interaction ${interactionId} not found`);
    }

    const interaction = interactionResult.rows[0] as { tenant_id: string; user_id: string | null };

    const result = await executeStatement(
      `INSERT INTO learning_implicit_signals (
        interaction_id, tenant_id, user_id,
        time_reading_response_ms, time_before_next_action_ms,
        did_regenerate, regenerate_count, did_copy_response, did_share_response, did_bookmark_response,
        did_continue_session, did_abandon_session, messages_after_in_session,
        did_ask_followup, followup_was_clarification, followup_was_deeper,
        was_ab_test, ab_variant, ab_chosen
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (interaction_id) DO UPDATE SET
        time_reading_response_ms = COALESCE(EXCLUDED.time_reading_response_ms, learning_implicit_signals.time_reading_response_ms),
        did_regenerate = EXCLUDED.did_regenerate OR learning_implicit_signals.did_regenerate,
        did_copy_response = EXCLUDED.did_copy_response OR learning_implicit_signals.did_copy_response,
        did_continue_session = EXCLUDED.did_continue_session OR learning_implicit_signals.did_continue_session,
        did_abandon_session = EXCLUDED.did_abandon_session OR learning_implicit_signals.did_abandon_session,
        did_ask_followup = EXCLUDED.did_ask_followup OR learning_implicit_signals.did_ask_followup
      RETURNING signal_id`,
      [
        { name: 'p1', value: { stringValue: interactionId } },
        { name: 'p2', value: { stringValue: interaction.tenant_id } },
        { name: 'p3', value: interaction.user_id ? { stringValue: interaction.user_id } : { isNull: true } },
        { name: 'p4', value: signals.timeReadingResponseMs !== undefined ? { longValue: signals.timeReadingResponseMs } : { isNull: true } },
        { name: 'p5', value: signals.timeBeforeNextActionMs !== undefined ? { longValue: signals.timeBeforeNextActionMs } : { isNull: true } },
        { name: 'p6', value: { booleanValue: signals.didRegenerate ?? false } },
        { name: 'p7', value: { longValue: signals.regenerateCount ?? 0 } },
        { name: 'p8', value: { booleanValue: signals.didCopyResponse ?? false } },
        { name: 'p9', value: { booleanValue: signals.didShareResponse ?? false } },
        { name: 'p10', value: { booleanValue: signals.didBookmarkResponse ?? false } },
        { name: 'p11', value: { booleanValue: signals.didContinueSession ?? false } },
        { name: 'p12', value: { booleanValue: signals.didAbandonSession ?? false } },
        { name: 'p13', value: { longValue: signals.messagesAfterInSession ?? 0 } },
        { name: 'p14', value: { booleanValue: signals.didAskFollowup ?? false } },
        { name: 'p15', value: { booleanValue: signals.followupWasClarification ?? false } },
        { name: 'p16', value: { booleanValue: signals.followupWasDeeper ?? false } },
        { name: 'p17', value: { booleanValue: signals.wasAbTest ?? false } },
        { name: 'p18', value: signals.abVariant ? { stringValue: signals.abVariant } : { isNull: true } },
        { name: 'p19', value: signals.abChosen !== undefined ? { booleanValue: signals.abChosen } : { isNull: true } },
      ]
    );

    return (result.rows[0] as { signal_id: string }).signal_id;
  }

  // ============================================================================
  // Record Think Tank Learning
  // ============================================================================

  async recordThinkTankLearning(
    conversationId: string,
    tenantId: string,
    data: {
      userId?: string;
      conversationTopic?: string;
      participants?: string[];
      totalTurns?: number;
      userEngagementScore?: number;
      conversationCoherence?: number;
      goalAchieved?: boolean;
      goalAchievementScore?: number;
      overallRating?: number;
      feedbackText?: string;
      participantScores?: Record<string, { quality: number; helpfulness: number; relevance: number }>;
      bestContributor?: string;
      effectiveStrategies?: string[];
      ineffectiveStrategies?: string[];
    }
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO learning_think_tank (
        conversation_id, tenant_id, user_id, conversation_topic, participants, total_turns,
        user_engagement_score, conversation_coherence, goal_achieved, goal_achievement_score,
        overall_rating, feedback_text, participant_scores, best_contributor,
        effective_strategies, ineffective_strategies
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (conversation_id) DO UPDATE SET
        total_turns = EXCLUDED.total_turns,
        user_engagement_score = EXCLUDED.user_engagement_score,
        overall_rating = COALESCE(EXCLUDED.overall_rating, learning_think_tank.overall_rating),
        feedback_text = COALESCE(EXCLUDED.feedback_text, learning_think_tank.feedback_text),
        participant_scores = EXCLUDED.participant_scores
      RETURNING think_tank_id`,
      [
        { name: 'p1', value: { stringValue: conversationId } },
        { name: 'p2', value: { stringValue: tenantId } },
        { name: 'p3', value: data.userId ? { stringValue: data.userId } : { isNull: true } },
        { name: 'p4', value: data.conversationTopic ? { stringValue: data.conversationTopic } : { isNull: true } },
        { name: 'p5', value: data.participants ? { stringValue: `{${data.participants.join(',')}}` } : { isNull: true } },
        { name: 'p6', value: { longValue: data.totalTurns ?? 0 } },
        { name: 'p7', value: data.userEngagementScore !== undefined ? { doubleValue: data.userEngagementScore } : { isNull: true } },
        { name: 'p8', value: data.conversationCoherence !== undefined ? { doubleValue: data.conversationCoherence } : { isNull: true } },
        { name: 'p9', value: data.goalAchieved !== undefined ? { booleanValue: data.goalAchieved } : { isNull: true } },
        { name: 'p10', value: data.goalAchievementScore !== undefined ? { doubleValue: data.goalAchievementScore } : { isNull: true } },
        { name: 'p11', value: data.overallRating !== undefined ? { longValue: data.overallRating } : { isNull: true } },
        { name: 'p12', value: data.feedbackText ? { stringValue: data.feedbackText } : { isNull: true } },
        { name: 'p13', value: data.participantScores ? { stringValue: JSON.stringify(data.participantScores) } : { stringValue: '{}' } },
        { name: 'p14', value: data.bestContributor ? { stringValue: data.bestContributor } : { isNull: true } },
        { name: 'p15', value: data.effectiveStrategies ? { stringValue: `{${data.effectiveStrategies.join(',')}}` } : { isNull: true } },
        { name: 'p16', value: data.ineffectiveStrategies ? { stringValue: `{${data.ineffectiveStrategies.join(',')}}` } : { isNull: true } },
      ]
    );

    return (result.rows[0] as { think_tank_id: string }).think_tank_id;
  }

  // ============================================================================
  // Record Feature Metrics
  // ============================================================================

  async recordFeatureMetrics(
    featureName: string,
    tenantId: string,
    metrics: {
      timesInvoked?: number;
      timesSucceeded?: number;
      timesFailed?: number;
      avgLatencyMs?: number;
      totalCostCents?: number;
      impactOnQuality?: number;
      userSatisfaction?: number;
      customMetrics?: Record<string, unknown>;
    }
  ): Promise<void> {
    const periodStart = new Date();
    periodStart.setMinutes(0, 0, 0);

    await executeStatement(
      `INSERT INTO learning_feature_metrics (
        feature_name, tenant_id, period_start, period_end,
        times_invoked, times_succeeded, times_failed,
        avg_latency_ms, total_cost_cents, impact_on_quality, user_satisfaction_with_feature,
        custom_metrics
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (feature_name, tenant_id, period_start) DO UPDATE SET
        times_invoked = learning_feature_metrics.times_invoked + COALESCE(EXCLUDED.times_invoked, 0),
        times_succeeded = learning_feature_metrics.times_succeeded + COALESCE(EXCLUDED.times_succeeded, 0),
        times_failed = learning_feature_metrics.times_failed + COALESCE(EXCLUDED.times_failed, 0),
        avg_latency_ms = COALESCE(EXCLUDED.avg_latency_ms, learning_feature_metrics.avg_latency_ms),
        total_cost_cents = learning_feature_metrics.total_cost_cents + COALESCE(EXCLUDED.total_cost_cents, 0)`,
      [
        { name: 'p1', value: { stringValue: featureName } },
        { name: 'p2', value: { stringValue: tenantId } },
        { name: 'p3', value: { stringValue: periodStart.toISOString() } },
        { name: 'p4', value: { stringValue: new Date(periodStart.getTime() + 3600000).toISOString() } },
        { name: 'p5', value: { longValue: metrics.timesInvoked ?? 1 } },
        { name: 'p6', value: { longValue: metrics.timesSucceeded ?? 0 } },
        { name: 'p7', value: { longValue: metrics.timesFailed ?? 0 } },
        { name: 'p8', value: metrics.avgLatencyMs !== undefined ? { longValue: metrics.avgLatencyMs } : { isNull: true } },
        { name: 'p9', value: metrics.totalCostCents !== undefined ? { doubleValue: metrics.totalCostCents } : { isNull: true } },
        { name: 'p10', value: metrics.impactOnQuality !== undefined ? { doubleValue: metrics.impactOnQuality } : { isNull: true } },
        { name: 'p11', value: metrics.userSatisfaction !== undefined ? { doubleValue: metrics.userSatisfaction } : { isNull: true } },
        { name: 'p12', value: metrics.customMetrics ? { stringValue: JSON.stringify(metrics.customMetrics) } : { stringValue: '{}' } },
      ]
    );
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  async getModelPerformance(
    modelId?: string,
    specialty?: string,
    periodType: 'hourly' | 'daily' | 'weekly' = 'daily',
    limit = 30
  ): Promise<ModelPerformance[]> {
    let sql = `SELECT * FROM learning_model_performance WHERE period_type = $1`;
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'periodType', value: { stringValue: periodType } },
    ];

    if (modelId) {
      sql += ` AND model_id = $${params.length + 1}`;
      params.push({ name: 'modelId', value: { stringValue: modelId } });
    }
    if (specialty) {
      sql += ` AND specialty = $${params.length + 1}`;
      params.push({ name: 'specialty', value: { stringValue: specialty } });
    }

    sql += ` ORDER BY period_start DESC LIMIT $${params.length + 1}`;
    params.push({ name: 'limit', value: { longValue: limit } });

    const result = await executeStatement(sql, params);
    return result.rows.map(r => this.mapModelPerformance(r as Record<string, unknown>));
  }

  async getSpecialtyInsights(specialty?: string): Promise<SpecialtyInsight[]> {
    const sql = specialty
      ? `SELECT * FROM learning_specialty_insights WHERE specialty = $1`
      : `SELECT * FROM learning_specialty_insights ORDER BY samples_analyzed DESC`;

    const params = specialty
      ? [{ name: 'specialty', value: { stringValue: specialty } }]
      : [];

    const result = await executeStatement(sql, params);
    return result.rows.map(r => this.mapSpecialtyInsight(r as Record<string, unknown>));
  }

  async getLearningStats(tenantId?: string): Promise<{
    totalInteractions: number;
    interactionsWithFeedback: number;
    avgOutcomeScore: number;
    feedbackPositiveRatio: number;
    topModels: Array<{ model: string; count: number; avgQuality: number }>;
    topSpecialties: Array<{ specialty: string; count: number }>;
  }> {
    const whereClause = tenantId ? `WHERE tenant_id = $1` : '';
    const params = tenantId ? [{ name: 'tenantId', value: { stringValue: tenantId } }] : [];

    const statsResult = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE interaction_id IN (SELECT interaction_id FROM learning_feedback)) as with_feedback,
        AVG(lo.outcome_score) as avg_outcome
      FROM learning_interactions li
      LEFT JOIN learning_outcomes lo ON li.interaction_id = lo.interaction_id
      ${whereClause}`,
      params
    );

    const feedbackResult = await executeStatement(
      `SELECT 
        AVG(CASE WHEN thumbs = 'up' THEN 1.0 WHEN thumbs = 'down' THEN 0.0 ELSE NULL END) as positive_ratio
      FROM learning_feedback
      ${whereClause}`,
      params
    );

    const topModelsResult = await executeStatement(
      `SELECT model_selected, COUNT(*) as count, AVG(lo.outcome_score) as avg_quality
      FROM learning_interactions li
      LEFT JOIN learning_outcomes lo ON li.interaction_id = lo.interaction_id
      ${whereClause}
      GROUP BY model_selected
      ORDER BY count DESC
      LIMIT 10`,
      params
    );

    const topSpecialtiesResult = await executeStatement(
      `SELECT detected_specialty, COUNT(*) as count
      FROM learning_interactions
      ${whereClause} ${tenantId ? 'AND' : 'WHERE'} detected_specialty IS NOT NULL
      GROUP BY detected_specialty
      ORDER BY count DESC
      LIMIT 10`,
      params
    );

    const stats = statsResult.rows[0] as Record<string, unknown>;
    const feedback = feedbackResult.rows[0] as Record<string, unknown>;

    return {
      totalInteractions: Number(stats.total || 0),
      interactionsWithFeedback: Number(stats.with_feedback || 0),
      avgOutcomeScore: Number(stats.avg_outcome || 0),
      feedbackPositiveRatio: Number(feedback.positive_ratio || 0),
      topModels: topModelsResult.rows.map(r => ({
        model: String((r as Record<string, unknown>).model_selected),
        count: Number((r as Record<string, unknown>).count),
        avgQuality: Number((r as Record<string, unknown>).avg_quality || 0),
      })),
      topSpecialties: topSpecialtiesResult.rows.map(r => ({
        specialty: String((r as Record<string, unknown>).detected_specialty),
        count: Number((r as Record<string, unknown>).count),
      })),
    };
  }

  async getFeatureMetrics(featureName?: string, days = 7): Promise<Array<{
    featureName: string;
    totalInvocations: number;
    successRate: number;
    avgLatencyMs: number;
    totalCost: number;
  }>> {
    const sql = featureName
      ? `SELECT feature_name, SUM(times_invoked) as invocations, 
         SUM(times_succeeded)::float / NULLIF(SUM(times_invoked), 0) as success_rate,
         AVG(avg_latency_ms) as avg_latency,
         SUM(total_cost_cents) as total_cost
         FROM learning_feature_metrics 
         WHERE feature_name = $1 AND period_start >= NOW() - INTERVAL '${days} days'
         GROUP BY feature_name`
      : `SELECT feature_name, SUM(times_invoked) as invocations,
         SUM(times_succeeded)::float / NULLIF(SUM(times_invoked), 0) as success_rate,
         AVG(avg_latency_ms) as avg_latency,
         SUM(total_cost_cents) as total_cost
         FROM learning_feature_metrics 
         WHERE period_start >= NOW() - INTERVAL '${days} days'
         GROUP BY feature_name
         ORDER BY invocations DESC`;

    const params = featureName ? [{ name: 'featureName', value: { stringValue: featureName } }] : [];
    const result = await executeStatement(sql, params);

    return result.rows.map(r => ({
      featureName: String((r as Record<string, unknown>).feature_name),
      totalInvocations: Number((r as Record<string, unknown>).invocations || 0),
      successRate: Number((r as Record<string, unknown>).success_rate || 0),
      avgLatencyMs: Number((r as Record<string, unknown>).avg_latency || 0),
      totalCost: Number((r as Record<string, unknown>).total_cost || 0),
    }));
  }

  // ============================================================================
  // Aggregation
  // ============================================================================

  async runAggregations(): Promise<{ hourly: number; daily: number }> {
    const hourlyResult = await executeStatement(
      `SELECT aggregate_model_performance('hourly') as count`,
      []
    );

    let dailyCount = 0;
    const hour = new Date().getHours();
    if (hour === 0) {
      const dailyResult = await executeStatement(
        `SELECT aggregate_model_performance('daily') as count`,
        []
      );
      dailyCount = Number((dailyResult.rows[0] as { count: number }).count);
    }

    return {
      hourly: Number((hourlyResult.rows[0] as { count: number }).count),
      daily: dailyCount,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapModelPerformance(row: Record<string, unknown>): ModelPerformance {
    return {
      modelId: String(row.model_id),
      specialty: row.specialty ? String(row.specialty) : undefined,
      periodStart: String(row.period_start),
      totalRequests: Number(row.total_requests || 0),
      avgQualityScore: row.avg_quality_score ? Number(row.avg_quality_score) : undefined,
      avgLatencyMs: row.avg_latency_ms ? Number(row.avg_latency_ms) : undefined,
      totalCostCents: row.total_cost_cents ? Number(row.total_cost_cents) : undefined,
      positiveRatio: row.positive_feedback_ratio ? Number(row.positive_feedback_ratio) : undefined,
    };
  }

  private mapSpecialtyInsight(row: Record<string, unknown>): SpecialtyInsight {
    const rankings = row.model_rankings;
    return {
      specialty: String(row.specialty),
      bestModelQuality: row.best_model_quality ? String(row.best_model_quality) : undefined,
      bestModelSpeed: row.best_model_speed ? String(row.best_model_speed) : undefined,
      bestModelCost: row.best_model_cost ? String(row.best_model_cost) : undefined,
      modelRankings: (typeof rankings === 'string' ? JSON.parse(rankings) : rankings) as SpecialtyInsight['modelRankings'] || [],
      samplesAnalyzed: Number(row.samples_analyzed || 0),
    };
  }
}

export const learningService = new LearningService();
