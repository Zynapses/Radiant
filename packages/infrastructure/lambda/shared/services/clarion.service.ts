/**
 * CLARION Service - Context-aware Learning Adaptive Reasoning Interrogation ONtology
 * 
 * Adaptive questioning system that gathers context users omit but AI needs.
 * 
 * Key Features:
 * - [CLARION:CORE] Session management with confidence tracking
 * - [CLARION:TREE] Question tree traversal with branching logic
 * - [CLARION:ADAPT] Answer-based question adaptation
 * - [CLARION:MODEL] Model-aware question selection
 * - [CLARION:LEARN] Question effectiveness tracking
 * - [CLARION:FEEDBACK] Compiler feedback loop
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import { executeStatement, stringParam, doubleParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { domainTaxonomyService } from './domain-taxonomy.service';
import { axiomEventsService } from './axiom-events.service';
import { axiomNeuralCortexService } from './axiom-neural-cortex.service';
import { v4 as uuidv4 } from 'uuid';
import type {
  ClarionSession,
  ClarionQuestion,
  ClarionAnswer,
  ClarionModelPrediction,
  ClarionSessionStatus,
  ClarionWorkingContext,
  ClarionStoppingCriteria,
  ClarionCompilerClarificationRequest,
  ClarionQuestionEffectiveness,
} from '@radiant/shared';
import {
  CLARION_DEFAULTS,
  QUESTION_SCORE_WEIGHTS,
} from '@radiant/shared';

// =============================================================================
// [CLARION:CORE] Constants
// =============================================================================

const DEFAULTS = {
  maxQuestions: 5,
  confidenceThreshold: 0.85,
  minInformationGain: 0.1,
  skipPenalty: 0.15,
  sessionTimeoutMinutes: 30,
};

const SCORE_WEIGHTS = {
  neural: 0.40,
  infoGain: 0.25,
  skipRateInverse: 0.15,
  modelRelevance: 0.10,
  recency: 0.10,
};

// =============================================================================
// [CLARION:CORE] Service Class
// =============================================================================

class ClarionService {
  
  // ===========================================================================
  // [CLARION:CORE] Session Management
  // ===========================================================================

  /**
   * Start a new CLARION questioning session
   */
  async startSession(params: {
    tenantId: string;
    userId: string;
    query: string;
    locale?: string;
    chainId?: string;
    conversationId?: string;
  }): Promise<ClarionSession> {
    const sessionId = `clarion-${uuidv4()}`;
    const locale = params.locale || 'en';
    
    // Detect domain from query
    const domainResult = await domainTaxonomyService.detectDomain(params.query);
    const domain = domainResult.primary_domain?.domain_id || 'general';
    const domainConfidence = domainResult.detection_confidence;

    // Initialize model predictions based on domain
    const modelPredictions = await this.initializeModelPredictions(domain, params.query);

    const session: ClarionSession = {
      sessionId,
      tenantId: params.tenantId,
      userId: params.userId,
      chainId: params.chainId || `chain-${uuidv4()}`,
      domain,
      originalQuery: params.query,
      locale,
      status: 'active',
      answers: {},
      askedQuestions: [],
      skippedQuestions: [],
      currentConfidence: domainConfidence,
      modelPredictions,
      workingContext: {
        inferredIntent: '',
        predictedComplexity: 0.5,
        confidenceTrajectory: [domainConfidence],
        compilerClarificationPending: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist session
    await this.saveSession(session);

    logger.info('[CLARION:CORE] Session started', {
      sessionId,
      domain,
      confidence: domainConfidence,
    });

    // Emit session started event via UEP
    axiomEventsService.emitSessionStarted(sessionId, {
      domain,
      confidence: domainConfidence,
      modelPredictions: modelPredictions.map((p, i) => ({
        modelId: p.modelId,
        modelName: p.modelName,
        provider: p.provider,
        score: p.score,
        isLeading: i === 0,
        reasons: p.reasons,
      })),
    });

    axiomEventsService.emitDomainUpdate(sessionId, {
      domain,
      confidence: domainConfidence,
      path: domain.split('.'),
    });

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ClarionSession | null> {
    const result = await executeStatement(
      `SELECT * FROM clarion_sessions WHERE session_id = $1`,
      [stringParam('sessionId', sessionId)]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return this.parseSessionRow(row);
  }

  /**
   * Save/update session
   */
  private async saveSession(session: ClarionSession): Promise<void> {
    await executeStatement(
      `INSERT INTO clarion_sessions (
        session_id, tenant_id, user_id, chain_id, domain, original_query,
        locale, status, current_confidence, model_predictions, working_context,
        answers, asked_questions, skipped_questions, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (session_id) DO UPDATE SET
        status = EXCLUDED.status,
        current_confidence = EXCLUDED.current_confidence,
        model_predictions = EXCLUDED.model_predictions,
        working_context = EXCLUDED.working_context,
        answers = EXCLUDED.answers,
        asked_questions = EXCLUDED.asked_questions,
        skipped_questions = EXCLUDED.skipped_questions,
        updated_at = EXCLUDED.updated_at`,
      [
        stringParam('sessionId', session.sessionId),
        stringParam('tenantId', session.tenantId),
        stringParam('userId', session.userId),
        stringParam('chainId', session.chainId),
        stringParam('domain', session.domain),
        stringParam('originalQuery', session.originalQuery),
        stringParam('locale', session.locale),
        stringParam('status', session.status),
        doubleParam('currentConfidence', session.currentConfidence),
        stringParam('modelPredictions', JSON.stringify(session.modelPredictions)),
        stringParam('workingContext', JSON.stringify(session.workingContext)),
        stringParam('answers', JSON.stringify(session.answers)),
        stringParam('askedQuestions', JSON.stringify(session.askedQuestions)),
        stringParam('skippedQuestions', JSON.stringify(session.skippedQuestions)),
        stringParam('createdAt', session.createdAt),
        stringParam('updatedAt', new Date().toISOString()),
      ]
    );
  }

  // ===========================================================================
  // [CLARION:TREE] Question Selection
  // ===========================================================================

  /**
   * Select the next best question to ask
   */
  async selectNextQuestion(session: ClarionSession): Promise<ClarionQuestion | null> {
    // Check stopping criteria
    const stopping = await this.checkStoppingCriteria(session);
    if (stopping.allCriticalAnswered || 
        stopping.userRequestedStop ||
        session.askedQuestions.length >= stopping.maxQuestions) {
      return null;
    }

    if (session.currentConfidence >= stopping.confidenceThreshold) {
      const criticalRemaining = await this.getCriticalQuestionsRemaining(session);
      if (criticalRemaining.length === 0) {
        return null;
      }
    }

    // Get candidate questions for this domain
    const candidates = await this.getCandidateQuestions(session.domain, session.tenantId);

    // Filter eligible questions
    const eligible = candidates.filter(q => 
      !session.askedQuestions.includes(q.questionId) &&
      !session.skippedQuestions.includes(q.questionId) &&
      this.checkDependencies(q, session) &&
      this.checkConflicts(q, session)
    );

    if (eligible.length === 0) return null;

    // Score and rank questions
    const scored = await Promise.all(
      eligible.map(async q => ({
        question: q,
        score: await this.scoreQuestion(q, session),
      }))
    );

    scored.sort((a, b) => b.score - a.score);

    const selected = scored[0]?.question || null;

    if (selected) {
      logger.info('[CLARION:TREE] Question selected', {
        sessionId: session.sessionId,
        questionId: selected.questionId,
        score: scored[0].score,
      });
    }

    return selected;
  }

  /**
   * Score a question for relevance
   */
  private async scoreQuestion(
    question: ClarionQuestion,
    session: ClarionSession
  ): Promise<number> {
    // Neural score (simulated - would call actual CORTEX network)
    const neuralScore = await this.getNeuralScore(question, session);

    // Information gain from question definition
    const infoGain = question.informationGain;

    // Skip rate inverse
    const effectiveness = await this.getQuestionEffectiveness(question.questionId, session.domain);
    const skipRateInverse = 1 - (effectiveness?.skip_count || 0) / Math.max(1, effectiveness?.ask_count || 1);

    // Model relevance - boost questions relevant to predicted models
    const modelRelevance = this.calculateModelRelevance(question, session.modelPredictions);

    // Recency bonus
    const recencyBonus = 0.5; // Neutral for now

    // Weighted combination
    const finalScore = 
      neuralScore * SCORE_WEIGHTS.neural +
      infoGain * SCORE_WEIGHTS.infoGain +
      skipRateInverse * SCORE_WEIGHTS.skipRateInverse +
      modelRelevance * SCORE_WEIGHTS.modelRelevance +
      recencyBonus * SCORE_WEIGHTS.recency;

    return Math.min(1.0, Math.max(0.0, finalScore));
  }

  /**
   * Get neural network score for question relevance
   * Uses CLARION Network from AXIOM Neural Cortex for intelligent question scoring
   */
  private async getNeuralScore(
    question: ClarionQuestion,
    session: ClarionSession
  ): Promise<number> {
    try {
      // Build session context features
      const sessionContext = this.buildSessionContextFeatures(session);
      
      // Build question features
      const questionFeatures = this.buildQuestionFeatures(question);
      
      // Call CLARION Network from Neural Cortex
      const result = await axiomNeuralCortexService.scoreClarionQuestions(
        sessionContext,
        [{ questionId: question.questionId, features: questionFeatures }]
      );
      
      const neuralScore = result.scores[0]?.score || 0.5;
      
      logger.debug('[CLARION:NEURAL] Question scored by Neural Cortex', {
        sessionId: session.sessionId,
        questionId: question.questionId,
        neuralScore,
        usedFallback: result.usedFallback,
        latencyMs: result.latencyMs,
      });
      
      return neuralScore;
    } catch (error) {
      logger.warn('[CLARION:NEURAL] Neural scoring failed, using heuristic', { error });
      
      // Fallback to heuristic scoring
      let score = question.priority;

      // Boost based on category relevance
      if (session.askedQuestions.length === 0 && question.category === 'intent') {
        score += 0.2;
      } else if (session.askedQuestions.length === 1 && question.category === 'scope') {
        score += 0.15;
      }

      // Domain match boost
      if (question.domainApplicability.includes('*') || 
          question.domainApplicability.some(d => session.domain.startsWith(d))) {
        score += 0.1;
      }

      return Math.min(1.0, score);
    }
  }

  /**
   * Build session context features for CLARION Network
   */
  private buildSessionContextFeatures(session: ClarionSession): number[] {
    const features = new Array(1408).fill(0);
    
    // Encode domain info (256 dims)
    const domainParts = session.domain.split('.');
    for (let i = 0; i < Math.min(domainParts.length, 8); i++) {
      features[i * 32] = 1;
    }
    
    // Encode session progress (128 dims)
    features[256] = session.askedQuestions.length / 10;
    features[257] = session.currentConfidence;
    features[258] = Object.keys(session.answers).length / 10;
    features[259] = session.skippedQuestions.length / 5;
    
    // Encode confidence trajectory (64 dims)
    const trajectory = session.workingContext.confidenceTrajectory || [];
    for (let i = 0; i < Math.min(trajectory.length, 64); i++) {
      features[384 + i] = trajectory[i];
    }
    
    // Encode model prediction diversity (64 dims)
    const predictions = session.modelPredictions || [];
    if (predictions.length > 0) {
      features[448] = predictions.length / 10;
      const topScore = Math.max(...predictions.map(p => p.score));
      features[449] = topScore;
    }
    
    return features;
  }

  /**
   * Build question features for CLARION Network
   */
  private buildQuestionFeatures(question: ClarionQuestion): number[] {
    const features = new Array(128).fill(0);
    
    // Encode question characteristics
    features[0] = question.informationGain;
    features[1] = question.priority;
    features[2] = question.priority >= 0.9 ? 1 : 0; // High priority as proxy for critical
    
    // Encode category (one-hot, 8 categories)
    const categories = ['intent', 'scope', 'constraints', 'preferences', 'context', 'format', 'technical', 'other'];
    const catIndex = categories.indexOf(question.category);
    if (catIndex >= 0) features[8 + catIndex] = 1;
    
    // Encode question type (one-hot, 5 types)
    const types = ['choice', 'multi_select', 'text', 'scale', 'boolean'];
    const typeIndex = types.indexOf(question.type);
    if (typeIndex >= 0) features[16 + typeIndex] = 1;
    
    // Encode domain applicability breadth
    features[24] = question.domainApplicability.includes('*') ? 1 : question.domainApplicability.length / 10;
    
    return features;
  }

  /**
   * Calculate relevance to predicted models
   */
  private calculateModelRelevance(
    question: ClarionQuestion,
    predictions: ClarionModelPrediction[]
  ): number {
    if (!question.modelRules || predictions.length === 0) return 0.5;

    const topModel = predictions.reduce((a, b) => a.score > b.score ? a : b);
    const rules = question.modelRules[topModel.modelId];

    if (!rules) return 0.5;
    if (rules.require) return 1.0;
    if (rules.skip) return 0.0;

    return 0.5 + (rules.priorityBoost || 0);
  }

  // ===========================================================================
  // [CLARION:ADAPT] Answer Processing
  // ===========================================================================

  /**
   * Process user's answer to a question
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    value: string | string[] | number | boolean
  ): Promise<{
    session: ClarionSession;
    nextQuestion: ClarionQuestion | null;
    readyToCompile: boolean;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const question = await this.getQuestion(questionId);
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    // Record answer
    const answer: ClarionAnswer = {
      questionId,
      value,
      timestamp: new Date().toISOString(),
      responseTimeMs: 0, // Would be calculated from client
    };

    session.answers[questionId] = answer;
    session.askedQuestions.push(questionId);

    // Apply branching logic
    if (question.branches) {
      const branchKey = String(value);
      const branch = question.branches[branchKey];
      if (branch) {
        // Add skip questions
        session.skippedQuestions.push(...branch.skipQuestions.filter(
          q => !session.skippedQuestions.includes(q)
        ));

        // Apply model signals
        for (const signal of branch.modelSignals) {
          this.applyModelSignal(session, signal.modelId, signal.adjustment, signal.reason);
        }
      }
    }

    // Update confidence based on answer
    const confidenceGain = question.informationGain * 0.5; // Partial gain on answer
    session.currentConfidence = Math.min(1.0, session.currentConfidence + confidenceGain);
    session.workingContext.confidenceTrajectory.push(session.currentConfidence);

    // Update working context
    await this.updateWorkingContext(session, question, answer);

    // Save session
    session.updatedAt = new Date().toISOString();
    await this.saveSession(session);

    // Track effectiveness
    await this.recordQuestionAsked(questionId, session.domain);

    // Get next question
    const nextQuestion = await this.selectNextQuestion(session);
    const readyToCompile = nextQuestion === null;

    if (readyToCompile) {
      session.status = 'ready_to_compile';
      await this.saveSession(session);
    }

    logger.info('[CLARION:ADAPT] Answer processed', {
      sessionId,
      questionId,
      newConfidence: session.currentConfidence,
      readyToCompile,
    });

    // Emit events via UEP
    axiomEventsService.emitAnswerReceived(sessionId, {
      questionId,
      answer: value,
      confidence: session.currentConfidence,
    });

    axiomEventsService.emitConfidenceUpdate(sessionId, {
      confidence: session.currentConfidence,
      previousConfidence: session.workingContext.confidenceTrajectory[
        session.workingContext.confidenceTrajectory.length - 2
      ],
      reason: `Answer to question ${questionId}`,
    });

    axiomEventsService.emitModelScoresUpdate(sessionId, session.modelPredictions.map((p, i) => ({
      modelId: p.modelId,
      modelName: p.modelName,
      provider: p.provider,
      score: p.score,
      isLeading: i === 0,
      reasons: p.reasons,
    })));

    if (nextQuestion) {
      axiomEventsService.emitQuestionSelected(sessionId, {
        questionId: nextQuestion.questionId,
        questionNumber: session.askedQuestions.length + 1,
        totalQuestions: 5,
        text: nextQuestion.text.en,
        type: nextQuestion.type,
        category: nextQuestion.category,
        options: nextQuestion.options?.en,
      });
    } else {
      axiomEventsService.emitClarificationComplete(sessionId, {
        answeredCount: Object.keys(session.answers).length,
        skippedCount: session.skippedQuestions.length,
        finalConfidence: session.currentConfidence,
      });
    }

    return { session, nextQuestion, readyToCompile };
  }

  /**
   * Skip a question
   */
  async skipQuestion(
    sessionId: string,
    questionId: string,
    reason?: string
  ): Promise<{
    session: ClarionSession;
    nextQuestion: ClarionQuestion | null;
    readyToCompile: boolean;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.skippedQuestions.push(questionId);
    session.askedQuestions.push(questionId);

    // Apply skip penalty to confidence
    session.currentConfidence = Math.max(0, session.currentConfidence - DEFAULTS.skipPenalty);
    session.workingContext.confidenceTrajectory.push(session.currentConfidence);

    session.updatedAt = new Date().toISOString();
    await this.saveSession(session);

    // Track skip
    await this.recordQuestionSkipped(questionId, session.domain);

    const nextQuestion = await this.selectNextQuestion(session);
    const readyToCompile = nextQuestion === null;

    if (readyToCompile) {
      session.status = 'ready_to_compile';
      await this.saveSession(session);
    }

    logger.info('[CLARION:ADAPT] Question skipped', {
      sessionId,
      questionId,
      reason,
      newConfidence: session.currentConfidence,
    });

    return { session, nextQuestion, readyToCompile };
  }

  /**
   * Apply model signal from answer branching
   */
  private applyModelSignal(
    session: ClarionSession,
    modelId: string,
    adjustment: number,
    reason: string
  ): void {
    const prediction = session.modelPredictions.find(p => p.modelId === modelId);
    if (prediction) {
      prediction.score = Math.min(1.0, Math.max(0.0, prediction.score + adjustment));
      prediction.reasons.push(reason);
      prediction.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Update working context based on answer
   */
  private async updateWorkingContext(
    session: ClarionSession,
    question: ClarionQuestion,
    answer: ClarionAnswer
  ): Promise<void> {
    // Infer intent from intent questions
    if (question.category === 'intent') {
      session.workingContext.inferredIntent = String(answer.value);
    }

    // Update complexity prediction from scope questions
    if (question.category === 'scope' && typeof answer.value === 'number') {
      session.workingContext.predictedComplexity = answer.value / 5;
    }
  }

  // ===========================================================================
  // [CLARION:MODEL] Model-Aware Questioning
  // ===========================================================================

  /**
   * Initialize model predictions based on domain
   */
  private async initializeModelPredictions(
    domain: string,
    query: string
  ): Promise<ClarionModelPrediction[]> {
    // Get domain proficiencies
    const taxonomy = await domainTaxonomyService.getTaxonomy();
    let targetDomain = null;

    for (const field of taxonomy.fields) {
      for (const d of field.domains) {
        if (d.domain_id === domain) {
          targetDomain = d;
          break;
        }
      }
    }

    // Get matching models based on proficiencies
    const proficiencies = targetDomain?.domain_proficiencies || {
      reasoning_depth: 5,
      mathematical_quantitative: 5,
      code_generation: 5,
      creative_generative: 5,
      research_synthesis: 5,
      factual_recall_precision: 5,
      multi_step_problem_solving: 5,
      domain_terminology_handling: 5,
    };

    const matches = await domainTaxonomyService.getMatchingModels(proficiencies, {
      max_models: 5,
      min_match_score: 40,
    });

    return matches.map(m => ({
      modelId: m.model_id,
      modelName: m.model_name,
      provider: m.provider,
      score: m.match_score / 100,
      confidence: 0.5, // Initial confidence
      reasons: m.strengths.map(s => `Strong in ${s}`),
      updatedAt: new Date().toISOString(),
    }));
  }

  // ===========================================================================
  // [CLARION:FEEDBACK] Compiler Feedback Loop
  // ===========================================================================

  /**
   * Handle clarification request from AXIOM compiler
   */
  async handleCompilerClarification(
    request: ClarionCompilerClarificationRequest
  ): Promise<ClarionQuestion | null> {
    const session = await this.getSession(request.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${request.sessionId}`);
    }

    session.workingContext.compilerClarificationPending = true;
    session.status = 'awaiting_clarification';

    // Filter suggested questions to those not already asked
    const available = request.suggestedQuestions.filter(
      qid => !session.askedQuestions.includes(qid)
    );

    if (available.length === 0) {
      if (request.priority === 'required') {
        // Generate ad-hoc question for missing slot
        return this.generateAdHocQuestion(request);
      }
      return null;
    }

    const question = await this.getQuestion(available[0]);
    await this.saveSession(session);

    logger.info('[CLARION:FEEDBACK] Compiler clarification requested', {
      sessionId: request.sessionId,
      ambiguityType: request.ambiguityType,
      suggestedQuestion: available[0],
    });

    return question;
  }

  /**
   * Generate ad-hoc question for missing slot
   */
  private async generateAdHocQuestion(
    request: ClarionCompilerClarificationRequest
  ): Promise<ClarionQuestion> {
    const questionId = `adhoc-${uuidv4()}`;
    
    const question: ClarionQuestion = {
      questionId,
      domainApplicability: ['*'],
      type: 'text',
      text: {
        en: `Could you please provide more details about: ${request.details.slotName || 'your request'}?`,
      },
      priority: 1.0,
      informationGain: 0.8,
      category: 'context',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return question;
  }

  // ===========================================================================
  // [CLARION:LEARN] Question Effectiveness
  // ===========================================================================

  /**
   * Record that a question was asked
   */
  private async recordQuestionAsked(questionId: string, domain: string): Promise<void> {
    await executeStatement(
      `INSERT INTO clarion_question_effectiveness (question_id, domain, ask_count, last_updated)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (question_id, domain) DO UPDATE SET
         ask_count = clarion_question_effectiveness.ask_count + 1,
         last_updated = NOW()`,
      [
        stringParam('questionId', questionId),
        stringParam('domain', domain),
      ]
    );
  }

  /**
   * Record that a question was skipped
   */
  private async recordQuestionSkipped(questionId: string, domain: string): Promise<void> {
    await executeStatement(
      `INSERT INTO clarion_question_effectiveness (question_id, domain, skip_count, last_updated)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (question_id, domain) DO UPDATE SET
         skip_count = clarion_question_effectiveness.skip_count + 1,
         last_updated = NOW()`,
      [
        stringParam('questionId', questionId),
        stringParam('domain', domain),
      ]
    );
  }

  /**
   * Get question effectiveness stats
   */
  private async getQuestionEffectiveness(
    questionId: string,
    domain: string
  ): Promise<{ ask_count: number; skip_count: number } | null> {
    const result = await executeStatement(
      `SELECT ask_count, skip_count FROM clarion_question_effectiveness
       WHERE question_id = $1 AND domain = $2`,
      [
        stringParam('questionId', questionId),
        stringParam('domain', domain),
      ]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      ask_count: Number(row.ask_count) || 0,
      skip_count: Number(row.skip_count) || 0,
    };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Get candidate questions for a domain
   */
  private async getCandidateQuestions(
    domain: string,
    tenantId: string
  ): Promise<ClarionQuestion[]> {
    const result = await executeStatement(
      `SELECT * FROM clarion_questions
       WHERE is_active = true
       AND (tenant_id IS NULL OR tenant_id = $1)
       AND (
         domain_applicability @> '["*"]'::jsonb
         OR domain_applicability @> $2::jsonb
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(domain_applicability) AS d
           WHERE $3 LIKE d || '%'
         )
       )
       ORDER BY priority DESC
       LIMIT 50`,
      [
        stringParam('tenantId', tenantId),
        stringParam('domainJson', JSON.stringify([domain])),
        stringParam('domain', domain),
      ]
    );

    return result.rows.map(row => this.parseQuestionRow(row as Record<string, unknown>));
  }

  /**
   * Get a single question by ID
   */
  async getQuestion(questionId: string): Promise<ClarionQuestion | null> {
    const result = await executeStatement(
      `SELECT * FROM clarion_questions WHERE question_id = $1`,
      [stringParam('questionId', questionId)]
    );

    if (result.rows.length === 0) return null;
    return this.parseQuestionRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Check question dependencies
   */
  private checkDependencies(question: ClarionQuestion, session: ClarionSession): boolean {
    if (!question.requiresAnswers || question.requiresAnswers.length === 0) return true;
    return question.requiresAnswers.every(req => session.answers[req] !== undefined);
  }

  /**
   * Check question conflicts
   */
  private checkConflicts(question: ClarionQuestion, session: ClarionSession): boolean {
    if (!question.conflictsWith || question.conflictsWith.length === 0) return true;
    return !question.conflictsWith.some(conflict => session.answers[conflict] !== undefined);
  }

  /**
   * Check stopping criteria
   */
  private async checkStoppingCriteria(session: ClarionSession): Promise<ClarionStoppingCriteria> {
    return {
      maxQuestions: DEFAULTS.maxQuestions,
      confidenceThreshold: DEFAULTS.confidenceThreshold,
      userRequestedStop: false,
      timeBudgetExceeded: false,
      allCriticalAnswered: false, // Would check critical questions
    };
  }

  /**
   * Get critical questions that haven't been answered
   */
  private async getCriticalQuestionsRemaining(session: ClarionSession): Promise<string[]> {
    // Questions with priority >= 0.9 are considered critical
    const result = await executeStatement(
      `SELECT question_id FROM clarion_questions
       WHERE is_active = true
       AND priority >= 0.9
       AND (
         domain_applicability @> '["*"]'::jsonb
         OR domain_applicability @> $1::jsonb
       )`,
      [stringParam('domainJson', JSON.stringify([session.domain]))]
    );

    const criticalIds = result.rows.map(r => String((r as Record<string, unknown>).question_id));
    return criticalIds.filter(id => 
      !session.askedQuestions.includes(id) && 
      !session.skippedQuestions.includes(id)
    );
  }

  /**
   * Parse session row from database
   */
  private parseSessionRow(row: Record<string, unknown>): ClarionSession {
    return {
      sessionId: String(row.session_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      chainId: String(row.chain_id || ''),
      domain: String(row.domain),
      originalQuery: String(row.original_query),
      locale: String(row.locale || 'en'),
      status: String(row.status) as ClarionSessionStatus,
      currentConfidence: Number(row.current_confidence) || 0,
      modelPredictions: this.parseJson(row.model_predictions, []),
      workingContext: this.parseJson(row.working_context, {
        inferredIntent: '',
        predictedComplexity: 0.5,
        confidenceTrajectory: [],
        compilerClarificationPending: false,
      }),
      answers: this.parseJson(row.answers, {}),
      askedQuestions: this.parseJson(row.asked_questions, []),
      skippedQuestions: this.parseJson(row.skipped_questions, []),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
    };
  }

  /**
   * Parse question row from database
   */
  private parseQuestionRow(row: Record<string, unknown>): ClarionQuestion {
    return {
      questionId: String(row.question_id),
      domainApplicability: this.parseJson(row.domain_applicability, ['*']),
      type: String(row.question_type) as ClarionQuestion['type'],
      text: this.parseJson(row.text_localized, { en: '' }),
      options: this.parseJson(row.options_localized, undefined),
      branches: this.parseJson(row.branches, undefined),
      priority: Number(row.priority) || 0.5,
      informationGain: Number(row.information_gain) || 0.5,
      category: String(row.category) as ClarionQuestion['category'],
      requiresAnswers: this.parseJson(row.requires_answers, []),
      conflictsWith: this.parseJson(row.conflicts_with, []),
      modelRules: this.parseJson(row.model_rules, undefined),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  /**
   * Parse JSON safely
   */
  private parseJson<T>(value: unknown, defaultValue: T): T {
    if (!value) return defaultValue;
    if (typeof value === 'object') return value as T;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const clarionService = new ClarionService();
