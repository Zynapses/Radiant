/**
 * The Crucible - Competitive Multi-LLM Deliberation Service
 * 
 * Core service for managing Crucible deliberation sessions.
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  CrucibleConfig,
  CrucibleSession,
  CrucibleSessionConfig,
  CrucibleParticipant,
  CruciblePrePrompt,
  CrucibleQuestion,
  CrucibleAnswer,
  CrucibleCitation,
  CrucibleFinalReport,
  CrucibleSessionSummary,
  CrucibleLearningInsight,
  CrucibleEvaluationCriteria,
  CrucibleParticipantInfo,
  CrucibleCompetitionRules,
  CrucibleCostMode,
  CrucibleModelType,
  CrucibleSessionStatus,
  QuestionType,
  QuestionQuality,
  CreateCrucibleSessionRequest,
  SubmitQuestionRequest,
  SubmitAnswerRequest,
  SubmitFinalReportRequest,
  DEFAULT_CRUCIBLE_CONFIG,
  DEFAULT_EVALUATION_CRITERIA,
  generateCruciblePrePrompt,
} from '@radiant/shared';

export class CrucibleService {
  constructor(private pool: Pool) {}

  // ===========================================================================
  // Configuration
  // ===========================================================================

  async getConfig(tenantId: string): Promise<CrucibleConfig> {
    const result = await this.pool.query(
      `SELECT * FROM crucible_config WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return {
        tenantId,
        ...DEFAULT_CRUCIBLE_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return this.mapConfigRow(result.rows[0]);
  }

  async updateConfig(tenantId: string, updates: Partial<CrucibleConfig>): Promise<CrucibleConfig> {
    const config = await this.getConfig(tenantId);
    const merged = { ...config, ...updates, updatedAt: new Date() };

    await this.pool.query(
      `INSERT INTO crucible_config (
        tenant_id, enabled, default_max_questions, question_timeout_seconds,
        session_timeout_seconds, min_llms_for_crucible, store_for_learning,
        session_retention_days, detect_circular_reasoning, circular_citation_penalty,
        score_question_quality, cost_mode_question_limits, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        default_max_questions = EXCLUDED.default_max_questions,
        question_timeout_seconds = EXCLUDED.question_timeout_seconds,
        session_timeout_seconds = EXCLUDED.session_timeout_seconds,
        min_llms_for_crucible = EXCLUDED.min_llms_for_crucible,
        store_for_learning = EXCLUDED.store_for_learning,
        session_retention_days = EXCLUDED.session_retention_days,
        detect_circular_reasoning = EXCLUDED.detect_circular_reasoning,
        circular_citation_penalty = EXCLUDED.circular_citation_penalty,
        score_question_quality = EXCLUDED.score_question_quality,
        cost_mode_question_limits = EXCLUDED.cost_mode_question_limits,
        updated_at = NOW()`,
      [
        tenantId,
        merged.enabled,
        merged.defaultMaxQuestions,
        merged.questionTimeoutSeconds,
        merged.sessionTimeoutSeconds,
        merged.minLlmsForCrucible,
        merged.storeForLearning,
        merged.sessionRetentionDays,
        merged.detectCircularReasoning,
        merged.circularCitationPenalty,
        merged.scoreQuestionQuality,
        JSON.stringify(merged.costModeQuestionLimits),
      ]
    );

    await this.logAudit(tenantId, null, 'config_updated', { updates });
    return merged;
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  async createSession(
    tenantId: string,
    request: CreateCrucibleSessionRequest,
    modelInfoResolver: (modelId: string) => Promise<{
      modelName: string;
      provider: string;
      modelType: CrucibleModelType;
      modelMode?: string;
      strengths?: string[];
    }>
  ): Promise<CrucibleSession> {
    const config = await this.getConfig(tenantId);

    if (!config.enabled) {
      throw new Error('Crucible is disabled for this tenant');
    }

    const costMode = request.costMode || 'balanced';
    const maxQuestions = request.maxQuestions || config.costModeQuestionLimits[costMode];

    const sessionConfig: CrucibleSessionConfig = {
      maxQuestions,
      questionTimeoutSeconds: config.questionTimeoutSeconds,
      sessionTimeoutSeconds: config.sessionTimeoutSeconds,
      costMode,
      storeForLearning: config.storeForLearning,
      detectCircularReasoning: config.detectCircularReasoning,
      circularCitationPenalty: config.circularCitationPenalty,
    };

    const sessionId = uuidv4();

    // Resolve model info and create participants
    const participants: CrucibleParticipant[] = [];
    const llmParticipantIds: string[] = [];

    for (let i = 0; i < request.participantModelIds.length; i++) {
      const modelId = request.participantModelIds[i];
      const modelInfo = await modelInfoResolver(modelId);
      const participantId = `P${i + 1}`;
      const canDeliberate = modelInfo.modelType === 'llm';

      const participant: CrucibleParticipant = {
        participantId,
        modelId,
        modelName: modelInfo.modelName,
        provider: modelInfo.provider,
        modelType: modelInfo.modelType,
        canDeliberate,
        modelMode: modelInfo.modelMode,
        wasInterrogated: false,
        questionsRemaining: canDeliberate ? maxQuestions : 0,
        questionsAsked: 0,
        questionsReceived: 0,
        scoreAdjustment: 0,
        circularCitations: 0,
      };

      participants.push(participant);
      if (canDeliberate) {
        llmParticipantIds.push(participantId);
      }
    }

    // Check minimum LLMs requirement
    if (llmParticipantIds.length < config.minLlmsForCrucible) {
      throw new Error(
        `Crucible requires at least ${config.minLlmsForCrucible} LLM participants, got ${llmParticipantIds.length}`
      );
    }

    // Create session in database
    await this.pool.query(
      `INSERT INTO crucible_sessions (
        id, tenant_id, pipeline_execution_id, method_invocation_id,
        method_name, status, config, questions_remaining
      ) VALUES ($1, $2, $3, $4, $5, 'initializing', $6, $7)`,
      [
        sessionId,
        tenantId,
        request.pipelineExecutionId,
        request.methodInvocationId,
        request.methodName,
        JSON.stringify(sessionConfig),
        maxQuestions,
      ]
    );

    // Insert participants
    for (const participant of participants) {
      await this.pool.query(
        `INSERT INTO crucible_participants (
          session_id, participant_id, model_id, model_name, provider,
          model_type, can_deliberate, model_mode, questions_remaining
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sessionId,
          participant.participantId,
          participant.modelId,
          participant.modelName,
          participant.provider,
          participant.modelType,
          participant.canDeliberate,
          participant.modelMode,
          participant.questionsRemaining,
        ]
      );
    }

    await this.logAudit(tenantId, sessionId, 'session_created', {
      participantCount: participants.length,
      llmCount: llmParticipantIds.length,
      maxQuestions,
      costMode,
    });

    return {
      sessionId,
      tenantId,
      pipelineExecutionId: request.pipelineExecutionId,
      methodInvocationId: request.methodInvocationId,
      methodName: request.methodName,
      status: 'initializing',
      participants,
      llmParticipantIds,
      config: sessionConfig,
      totalQuestionsAsked: 0,
      questionsRemaining: maxQuestions,
      startedAt: new Date(),
    };
  }

  async getSession(sessionId: string): Promise<CrucibleSession | null> {
    const result = await this.pool.query(
      `SELECT * FROM crucible_sessions WHERE id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    const participants = await this.getSessionParticipants(sessionId);

    return {
      sessionId: session.id,
      tenantId: session.tenant_id,
      pipelineExecutionId: session.pipeline_execution_id,
      methodInvocationId: session.method_invocation_id,
      methodName: session.method_name,
      status: session.status,
      participants,
      llmParticipantIds: participants.filter(p => p.canDeliberate).map(p => p.participantId),
      config: session.config,
      prePrompt: session.pre_prompt,
      totalQuestionsAsked: session.total_questions_asked,
      questionsRemaining: session.questions_remaining,
      startedAt: session.started_at,
      deliberationStartedAt: session.deliberation_started_at,
      completedAt: session.completed_at,
      error: session.error,
      summary: session.summary,
    };
  }

  async getSessionParticipants(sessionId: string): Promise<CrucibleParticipant[]> {
    const result = await this.pool.query(
      `SELECT * FROM crucible_participants WHERE session_id = $1 ORDER BY participant_id`,
      [sessionId]
    );

    return result.rows.map(row => ({
      participantId: row.participant_id,
      modelId: row.model_id,
      modelName: row.model_name,
      provider: row.provider,
      modelType: row.model_type,
      canDeliberate: row.can_deliberate,
      modelMode: row.model_mode,
      integrityScore: row.integrity_score ? parseFloat(row.integrity_score) : undefined,
      wasInterrogated: row.was_interrogated,
      questionsRemaining: row.questions_remaining,
      questionsAsked: row.questions_asked,
      questionsReceived: row.questions_received,
      scoreAdjustment: parseFloat(row.score_adjustment),
      circularCitations: row.circular_citations,
    }));
  }

  async updateSessionStatus(
    sessionId: string,
    status: CrucibleSessionStatus,
    error?: string
  ): Promise<void> {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [sessionId, status];

    if (status === 'deliberating') {
      updates.push('deliberation_started_at = NOW()');
    }

    if (status === 'completed' || status === 'failed' || status === 'timeout') {
      updates.push('completed_at = NOW()');
    }

    if (error) {
      updates.push(`error = $${params.length + 1}`);
      params.push(error);
    }

    await this.pool.query(
      `UPDATE crucible_sessions SET ${updates.join(', ')} WHERE id = $1`,
      params
    );

    const session = await this.getSession(sessionId);
    if (session) {
      await this.logAudit(session.tenantId, sessionId, 'session_status_changed', { status, error });
    }
  }

  // ===========================================================================
  // Pre-Prompt Generation
  // ===========================================================================

  async generatePrePrompt(
    sessionId: string,
    criteria?: Partial<CrucibleEvaluationCriteria>
  ): Promise<CruciblePrePrompt> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const evaluationCriteria: CrucibleEvaluationCriteria = {
      ...DEFAULT_EVALUATION_CRITERIA,
      ...criteria,
    };

    const participantRoster: CrucibleParticipantInfo[] = session.participants
      .filter(p => p.canDeliberate)
      .map(p => ({
        participantId: p.participantId,
        modelName: p.modelName,
        provider: p.provider,
        modelMode: p.modelMode,
      }));

    const competitionRules: CrucibleCompetitionRules = {
      maxQuestions: session.config.maxQuestions,
      iterativeQuestioning: true,
      noPenaltyForQuestions: true,
      competitiveMode: true,
      trackProvenance: true,
      detectCircularCitations: session.config.detectCircularReasoning,
      questionTimeout: session.config.questionTimeoutSeconds,
    };

    const promptText = generateCruciblePrePrompt(
      evaluationCriteria,
      participantRoster,
      competitionRules
    );

    const prePrompt: CruciblePrePrompt = {
      evaluationCriteria,
      participantRoster,
      competitionRules,
      promptText,
    };

    // Store pre-prompt in session
    await this.pool.query(
      `UPDATE crucible_sessions SET pre_prompt = $2, status = 'pre_prompting', updated_at = NOW() WHERE id = $1`,
      [sessionId, JSON.stringify(prePrompt)]
    );

    await this.logAudit(session.tenantId, sessionId, 'pre_prompt_generated', {
      criteria: evaluationCriteria,
      participantCount: participantRoster.length,
    });

    return prePrompt;
  }

  // ===========================================================================
  // Deliberation
  // ===========================================================================

  async submitQuestion(request: SubmitQuestionRequest): Promise<CrucibleQuestion> {
    const session = await this.getSession(request.sessionId);
    if (!session) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    if (session.status !== 'deliberating') {
      throw new Error(`Session is not in deliberating status (current: ${session.status})`);
    }

    if (session.questionsRemaining <= 0) {
      throw new Error('No questions remaining in this session');
    }

    const asker = session.participants.find(p => p.participantId === request.askerId);
    if (!asker || !asker.canDeliberate) {
      throw new Error(`Participant ${request.askerId} cannot ask questions`);
    }

    const target = session.participants.find(p => p.participantId === request.targetId);
    if (!target || !target.canDeliberate) {
      throw new Error(`Participant ${request.targetId} cannot be questioned`);
    }

    const questionId = uuidv4();
    const questionNumber = session.totalQuestionsAsked + 1;

    await this.pool.query(
      `INSERT INTO crucible_questions (
        id, session_id, asker_id, target_id, question_number,
        question_type, question_text, is_iterative_refinement, previous_question_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        questionId,
        request.sessionId,
        request.askerId,
        request.targetId,
        questionNumber,
        request.questionType,
        request.questionText,
        !!request.previousQuestionId,
        request.previousQuestionId,
      ]
    );

    await this.logAudit(session.tenantId, request.sessionId, 'question_asked', {
      questionId,
      askerId: request.askerId,
      targetId: request.targetId,
      questionType: request.questionType,
      questionNumber,
    });

    return {
      questionId,
      sessionId: request.sessionId,
      askerId: request.askerId,
      targetId: request.targetId,
      questionNumber,
      questionType: request.questionType,
      questionText: request.questionText,
      isIterativeRefinement: !!request.previousQuestionId,
      previousQuestionId: request.previousQuestionId,
      askedAt: new Date(),
    };
  }

  async submitAnswer(request: SubmitAnswerRequest): Promise<CrucibleAnswer> {
    const questionResult = await this.pool.query(
      `SELECT q.*, s.tenant_id FROM crucible_questions q
       JOIN crucible_sessions s ON q.session_id = s.id
       WHERE q.id = $1`,
      [request.questionId]
    );

    if (questionResult.rows.length === 0) {
      throw new Error(`Question ${request.questionId} not found`);
    }

    const question = questionResult.rows[0];
    const startTime = new Date(question.asked_at).getTime();
    const latencyMs = Date.now() - startTime;

    const answerId = uuidv4();
    const tokenCount = Math.ceil(request.answerText.length / 4); // Approximate

    await this.pool.query(
      `INSERT INTO crucible_answers (
        id, question_id, answer_text, latency_ms, token_count
      ) VALUES ($1, $2, $3, $4, $5)`,
      [answerId, request.questionId, request.answerText, latencyMs, tokenCount]
    );

    // Insert citations
    const citations: CrucibleCitation[] = [];
    if (request.citations) {
      for (const citation of request.citations) {
        const citationId = uuidv4();
        await this.pool.query(
          `INSERT INTO crucible_citations (
            id, answer_id, source_type, source_participant_id, citation_text
          ) VALUES ($1, $2, $3, $4, $5)`,
          [citationId, answerId, citation.sourceType, citation.sourceParticipantId, citation.citationText]
        );
        citations.push({
          citationId,
          sourceType: citation.sourceType,
          sourceParticipantId: citation.sourceParticipantId,
          citationText: citation.citationText,
          isCircular: false, // Will be updated by trigger
        });
      }
    }

    // Check for circular citations after insert (trigger will have updated)
    const circularCheck = await this.pool.query(
      `SELECT circular_citation_detected, circular_citation_details FROM crucible_answers WHERE id = $1`,
      [answerId]
    );

    const circularDetected = circularCheck.rows[0]?.circular_citation_detected || false;

    await this.logAudit(question.tenant_id, question.session_id, 'answer_submitted', {
      questionId: request.questionId,
      answerId,
      latencyMs,
      tokenCount,
      citationCount: citations.length,
      circularDetected,
    });

    return {
      answerId,
      questionId: request.questionId,
      answerText: request.answerText,
      citations,
      circularCitationDetected: circularDetected,
      circularCitationDetails: circularCheck.rows[0]?.circular_citation_details,
      latencyMs,
      tokenCount,
      answeredAt: new Date(),
    };
  }

  async scoreQuestion(
    questionId: string,
    quality: QuestionQuality
  ): Promise<void> {
    await this.pool.query(
      `UPDATE crucible_questions SET quality_score = $2 WHERE id = $1`,
      [questionId, quality]
    );
  }

  // ===========================================================================
  // Final Reports
  // ===========================================================================

  async submitFinalReport(request: SubmitFinalReportRequest): Promise<CrucibleFinalReport> {
    const session = await this.getSession(request.sessionId);
    if (!session) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    const reportId = uuidv4();

    await this.pool.query(
      `INSERT INTO crucible_final_reports (
        id, session_id, participant_id, refined_output, refinement_notes,
        confidence, self_assessed_accuracy, key_insights, identified_weaknesses
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        reportId,
        request.sessionId,
        request.participantId,
        request.refinedOutput,
        request.refinementNotes,
        request.confidence,
        request.selfAssessedAccuracy,
        JSON.stringify(request.keyInsights),
        JSON.stringify(request.identifiedWeaknesses),
      ]
    );

    await this.logAudit(session.tenantId, request.sessionId, 'final_report_submitted', {
      reportId,
      participantId: request.participantId,
      confidence: request.confidence,
    });

    return {
      reportId,
      sessionId: request.sessionId,
      participantId: request.participantId,
      refinedOutput: request.refinedOutput,
      refinementNotes: request.refinementNotes,
      confidence: request.confidence,
      selfAssessedAccuracy: request.selfAssessedAccuracy,
      keyInsights: request.keyInsights,
      identifiedWeaknesses: request.identifiedWeaknesses,
      submittedAt: new Date(),
    };
  }

  async scoreReports(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const reports = await this.pool.query(
      `SELECT * FROM crucible_final_reports WHERE session_id = $1`,
      [sessionId]
    );

    const criteria = session.prePrompt?.evaluationCriteria || DEFAULT_EVALUATION_CRITERIA;

    for (const report of reports.rows) {
      const participant = session.participants.find(
        p => p.participantId === report.participant_id
      );

      if (!participant) continue;

      // Calculate scores (simplified - would use actual evaluation in production)
      const accuracyScore = report.self_assessed_accuracy;
      const truthfulnessScore = 1 - (participant.circularCitations * session.config.circularCitationPenalty);
      const reasoningScore = report.key_insights?.length > 0 ? 0.8 : 0.5;
      const completenessScore = report.identified_weaknesses?.length > 0 ? 0.9 : 0.6;
      const citationScore = 0.7; // Would evaluate actual citation quality

      // Question quality bonus
      const highQualityQuestions = await this.pool.query(
        `SELECT COUNT(*) FROM crucible_questions 
         WHERE session_id = $1 AND asker_id = $2 AND quality_score IN ('high', 'exceptional')`,
        [sessionId, participant.participantId]
      );
      const questionQualityBonus = parseInt(highQualityQuestions.rows[0].count) * 0.02;

      // Deliberation participation score
      const deliberationScore = Math.min(1, (participant.questionsAsked + participant.questionsReceived) / 4);

      // Circular citation penalty
      const circularPenalty = participant.circularCitations * session.config.circularCitationPenalty;

      // Weighted total
      const weightedTotal = 
        (accuracyScore * criteria.accuracyWeight) +
        (truthfulnessScore * criteria.truthfulnessWeight) +
        (reasoningScore * criteria.reasoningWeight) +
        (completenessScore * criteria.completenessWeight) +
        (citationScore * criteria.citationWeight) +
        questionQualityBonus -
        circularPenalty;

      const scoreBreakdown = {
        accuracyScore,
        truthfulnessScore,
        reasoningScore,
        completenessScore,
        citationScore,
        circularCitationPenalty: circularPenalty,
        questionQualityBonus,
        deliberationScore,
        weightedTotal: Math.max(0, Math.min(1, weightedTotal)),
      };

      await this.pool.query(
        `UPDATE crucible_final_reports 
         SET final_score = $2, score_breakdown = $3 
         WHERE id = $1`,
        [report.id, scoreBreakdown.weightedTotal, JSON.stringify(scoreBreakdown)]
      );
    }

    await this.logAudit(session.tenantId, sessionId, 'reports_scored', {
      reportCount: reports.rows.length,
    });
  }

  // ===========================================================================
  // Session Completion
  // ===========================================================================

  async completeSession(sessionId: string): Promise<CrucibleSessionSummary> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Score all reports
    await this.scoreReports(sessionId);

    // Get questions by type
    const questionsByType = await this.pool.query(
      `SELECT question_type, COUNT(*) as count 
       FROM crucible_questions WHERE session_id = $1 
       GROUP BY question_type`,
      [sessionId]
    );

    const questionsByTypeMap: Record<QuestionType, number> = {
      clarification: 0,
      challenge: 0,
      evidence: 0,
      reasoning: 0,
      edge_case: 0,
      contradiction: 0,
    };
    for (const row of questionsByType.rows) {
      questionsByTypeMap[row.question_type as QuestionType] = parseInt(row.count);
    }

    // Get average question quality
    const avgQuality = await this.pool.query(
      `SELECT AVG(CASE 
        WHEN quality_score = 'exceptional' THEN 4
        WHEN quality_score = 'high' THEN 3
        WHEN quality_score = 'medium' THEN 2
        WHEN quality_score = 'low' THEN 1
        ELSE 2 END) as avg
       FROM crucible_questions WHERE session_id = $1`,
      [sessionId]
    );

    // Get winner
    const winner = await this.pool.query(
      `SELECT fr.participant_id, p.model_name, fr.final_score
       FROM crucible_final_reports fr
       JOIN crucible_participants p ON fr.session_id = p.session_id AND fr.participant_id = p.participant_id
       WHERE fr.session_id = $1
       ORDER BY fr.final_score DESC NULLS LAST
       LIMIT 1`,
      [sessionId]
    );

    // Get score spread
    const scoreRange = await this.pool.query(
      `SELECT MAX(final_score) - MIN(final_score) as spread
       FROM crucible_final_reports WHERE session_id = $1`,
      [sessionId]
    );

    // Get circular citations count
    const circularCount = await this.pool.query(
      `SELECT SUM(circular_citations) as total FROM crucible_participants WHERE session_id = $1`,
      [sessionId]
    );

    const deliberationDuration = session.deliberationStartedAt
      ? Date.now() - session.deliberationStartedAt.getTime()
      : 0;

    const summary: CrucibleSessionSummary = {
      sessionId,
      methodName: session.methodName,
      participantCount: session.participants.length,
      llmParticipantCount: session.llmParticipantIds.length,
      totalQuestions: session.totalQuestionsAsked,
      questionsByType: questionsByTypeMap,
      avgQuestionQuality: parseFloat(avgQuality.rows[0]?.avg || '2'),
      circularCitationsDetected: parseInt(circularCount.rows[0]?.total || '0'),
      sessionDurationMs: Date.now() - session.startedAt.getTime(),
      deliberationDurationMs: deliberationDuration,
      winnerId: winner.rows[0]?.participant_id,
      winnerModelName: winner.rows[0]?.model_name,
      scoreSpread: parseFloat(scoreRange.rows[0]?.spread || '0'),
      meaningfulRefinement: session.totalQuestionsAsked >= 2,
      learningInsights: [],
    };

    // Extract learning insights
    const insights = await this.extractLearningInsights(session, summary);
    summary.learningInsights = insights;

    // Update session with summary
    await this.pool.query(
      `UPDATE crucible_sessions 
       SET status = 'completed', summary = $2, completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [sessionId, JSON.stringify(summary)]
    );

    await this.logAudit(session.tenantId, sessionId, 'session_completed', {
      winnerId: summary.winnerId,
      winnerModelName: summary.winnerModelName,
      totalQuestions: summary.totalQuestions,
      scoreSpread: summary.scoreSpread,
    });

    return summary;
  }

  // ===========================================================================
  // Learning Insights
  // ===========================================================================

  async extractLearningInsights(
    session: CrucibleSession,
    summary: CrucibleSessionSummary
  ): Promise<CrucibleLearningInsight[]> {
    const insights: CrucibleLearningInsight[] = [];

    // Insight: Winner's strength
    if (summary.winnerId && summary.winnerModelName) {
      const winnerReport = await this.pool.query(
        `SELECT * FROM crucible_final_reports WHERE session_id = $1 AND participant_id = $2`,
        [session.sessionId, summary.winnerId]
      );

      if (winnerReport.rows.length > 0) {
        insights.push({
          type: 'model_strength',
          modelId: session.participants.find(p => p.participantId === summary.winnerId)?.modelId,
          description: `${summary.winnerModelName} won with score ${winnerReport.rows[0].final_score?.toFixed(3)}. Method: ${session.methodName}`,
          confidence: 0.8,
          actionable: true,
        });
      }
    }

    // Insight: High circular citation rate
    for (const participant of session.participants) {
      if (participant.circularCitations > 2) {
        insights.push({
          type: 'model_weakness',
          modelId: participant.modelId,
          description: `${participant.modelName} had ${participant.circularCitations} circular citations - may struggle with provenance tracking`,
          confidence: 0.7,
          actionable: true,
        });
      }
    }

    // Insight: Question patterns
    const dominantQuestionType = Object.entries(summary.questionsByType)
      .sort((a, b) => b[1] - a[1])[0];
    if (dominantQuestionType && dominantQuestionType[1] > 2) {
      insights.push({
        type: 'question_pattern',
        description: `Most common question type was '${dominantQuestionType[0]}' (${dominantQuestionType[1]} times) in ${session.methodName}`,
        confidence: 0.6,
        actionable: false,
      });
    }

    // Store insights
    for (const insight of insights) {
      await this.pool.query(
        `INSERT INTO crucible_learning_insights (
          tenant_id, session_id, insight_type, model_id, description, confidence, actionable
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          session.tenantId,
          session.sessionId,
          insight.type,
          insight.modelId,
          insight.description,
          insight.confidence,
          insight.actionable,
        ]
      );
    }

    return insights;
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  async getRecentSessions(
    tenantId: string,
    limit = 20
  ): Promise<CrucibleSession[]> {
    const result = await this.pool.query(
      `SELECT id FROM crucible_sessions 
       WHERE tenant_id = $1 
       ORDER BY started_at DESC 
       LIMIT $2`,
      [tenantId, limit]
    );

    const sessions: CrucibleSession[] = [];
    for (const row of result.rows) {
      const session = await this.getSession(row.id);
      if (session) sessions.push(session);
    }

    return sessions;
  }

  async getSessionQuestions(sessionId: string): Promise<CrucibleQuestion[]> {
    const result = await this.pool.query(
      `SELECT q.*, a.id as answer_id, a.answer_text, a.circular_citation_detected,
              a.latency_ms, a.token_count, a.answered_at
       FROM crucible_questions q
       LEFT JOIN crucible_answers a ON q.id = a.question_id
       WHERE q.session_id = $1
       ORDER BY q.question_number`,
      [sessionId]
    );

    return result.rows.map(row => ({
      questionId: row.id,
      sessionId: row.session_id,
      askerId: row.asker_id,
      targetId: row.target_id,
      questionNumber: row.question_number,
      questionType: row.question_type,
      questionText: row.question_text,
      qualityScore: row.quality_score,
      isIterativeRefinement: row.is_iterative_refinement,
      previousQuestionId: row.previous_question_id,
      askedAt: row.asked_at,
      answer: row.answer_id ? {
        answerId: row.answer_id,
        questionId: row.id,
        answerText: row.answer_text,
        citations: [], // Would need separate query
        circularCitationDetected: row.circular_citation_detected,
        latencyMs: row.latency_ms,
        tokenCount: row.token_count,
        answeredAt: row.answered_at,
      } : undefined,
    }));
  }

  async getModelPerformance(tenantId: string, limit = 10): Promise<{
    modelId: string;
    modelName: string;
    sessionsParticipated: number;
    winRate: number;
    avgScore: number;
    avgQuestionQuality: number;
    circularCitationRate: number;
  }[]> {
    const result = await this.pool.query(
      `SELECT * FROM crucible_model_stats 
       WHERE tenant_id = $1 
       ORDER BY win_rate DESC, avg_score DESC 
       LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows.map(row => ({
      modelId: row.model_id,
      modelName: row.model_name,
      sessionsParticipated: row.sessions_participated,
      winRate: parseFloat(row.win_rate),
      avgScore: parseFloat(row.avg_score),
      avgQuestionQuality: parseFloat(row.question_quality_rate),
      circularCitationRate: parseFloat(row.circular_citation_rate),
    }));
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private mapConfigRow(row: Record<string, unknown>): CrucibleConfig {
    return {
      tenantId: row.tenant_id as string,
      enabled: row.enabled as boolean,
      defaultMaxQuestions: row.default_max_questions as number,
      questionTimeoutSeconds: row.question_timeout_seconds as number,
      sessionTimeoutSeconds: row.session_timeout_seconds as number,
      minLlmsForCrucible: row.min_llms_for_crucible as number,
      storeForLearning: row.store_for_learning as boolean,
      sessionRetentionDays: row.session_retention_days as number,
      detectCircularReasoning: row.detect_circular_reasoning as boolean,
      circularCitationPenalty: parseFloat(row.circular_citation_penalty as string),
      scoreQuestionQuality: row.score_question_quality as boolean,
      costModeQuestionLimits: row.cost_mode_question_limits as Record<CrucibleCostMode, number>,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private async logAudit(
    tenantId: string,
    sessionId: string | null,
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO crucible_audit_log (tenant_id, session_id, event_type, event_data)
       VALUES ($1, $2, $3, $4)`,
      [tenantId, sessionId, eventType, JSON.stringify(eventData)]
    );
  }
}
