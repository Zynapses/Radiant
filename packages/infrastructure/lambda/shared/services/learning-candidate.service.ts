// RADIANT v4.18.0 - Learning Candidate Service
// Flags high-value interactions for weekly LoRA fine-tuning
// This enables "Epigenetic Evolution" - the system physically changes based on experience

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export type CandidateType =
  | 'correction'           // User corrected the AI
  | 'high_satisfaction'    // Explicit positive feedback
  | 'preference_learned'   // New user preference discovered
  | 'mistake_recovery'     // AI recovered from an error
  | 'novel_solution'       // Creative/novel response that worked
  | 'domain_expertise'     // Demonstrated domain mastery
  | 'high_prediction_error' // High surprise = high learning value
  | 'user_explicit_teach'; // User explicitly taught something

export type TrainingStatus = 
  | 'pending'    // Awaiting next training run
  | 'queued'     // Selected for next training batch
  | 'training'   // Currently being used in training
  | 'completed'  // Successfully used in training
  | 'rejected'   // Rejected (low quality, duplicate, etc.)
  | 'expired';   // Too old to be useful

export interface LearningCandidate {
  candidateId: string;
  tenantId: string;
  userId?: string;
  conversationId: string;
  messageId?: string;
  candidateType: CandidateType;
  promptText: string;
  responseText: string;
  correctionText?: string;
  qualityScore?: number;
  userRating?: number;
  predictionErrorAtTime?: number;
  trainingStatus: TrainingStatus;
  trainingJobId?: string;
  trainedAt?: string;
  domainDetected?: string;
  complexityLevel?: string;
  tokenCount?: number;
  createdAt: string;
  expiresAt: string;
}

export interface CandidateCreateParams {
  tenantId: string;
  userId?: string;
  conversationId: string;
  messageId?: string;
  candidateType: CandidateType;
  promptText: string;
  responseText: string;
  correctionText?: string;
  qualityScore?: number;
  userRating?: number;
  predictionErrorAtTime?: number;
  domainDetected?: string;
  complexityLevel?: string;
}

export interface TrainingDataset {
  candidates: Array<{
    candidateId: string;
    candidateType: CandidateType;
    promptText: string;
    responseText: string;
    correctionText?: string;
    qualityScore?: number;
  }>;
  totalTokens: number;
  typeDistribution: Record<CandidateType, number>;
}

// ============================================================================
// Learning Candidate Service
// ============================================================================

class LearningCandidateService {

  // ============================================================================
  // Candidate Creation
  // ============================================================================

  /**
   * Flag an interaction as a learning candidate
   */
  async createCandidate(params: CandidateCreateParams): Promise<string> {
    // Calculate token count (rough estimate)
    const tokenCount = Math.ceil((params.promptText.length + params.responseText.length) / 4);
    
    const result = await executeStatement(
      `INSERT INTO learning_candidates (
        tenant_id, user_id, conversation_id, message_id,
        candidate_type, prompt_text, response_text, correction_text,
        quality_score, user_rating, prediction_error_at_time,
        domain_detected, complexity_level, token_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING candidate_id`,
      [
        { name: 'tenantId', value: { stringValue: params.tenantId } },
        { name: 'userId', value: params.userId ? { stringValue: params.userId } : { isNull: true } },
        { name: 'conversationId', value: { stringValue: params.conversationId } },
        { name: 'messageId', value: params.messageId ? { stringValue: params.messageId } : { isNull: true } },
        { name: 'candidateType', value: { stringValue: params.candidateType } },
        { name: 'promptText', value: { stringValue: params.promptText } },
        { name: 'responseText', value: { stringValue: params.responseText } },
        { name: 'correctionText', value: params.correctionText ? { stringValue: params.correctionText } : { isNull: true } },
        { name: 'qualityScore', value: params.qualityScore !== undefined ? { doubleValue: params.qualityScore } : { isNull: true } },
        { name: 'userRating', value: params.userRating !== undefined ? { longValue: params.userRating } : { isNull: true } },
        { name: 'predictionError', value: params.predictionErrorAtTime !== undefined ? { doubleValue: params.predictionErrorAtTime } : { isNull: true } },
        { name: 'domain', value: params.domainDetected ? { stringValue: params.domainDetected } : { isNull: true } },
        { name: 'complexity', value: params.complexityLevel ? { stringValue: params.complexityLevel } : { isNull: true } },
        { name: 'tokenCount', value: { longValue: tokenCount } },
      ]
    );
    
    const candidateId = String((result.rows[0] as Record<string, unknown>).candidate_id);
    
    logger.info('Learning candidate created', {
      candidateId,
      type: params.candidateType,
      conversationId: params.conversationId,
    });
    
    return candidateId;
  }

  /**
   * Create candidate from user correction
   */
  async createFromCorrection(
    tenantId: string,
    conversationId: string,
    originalPrompt: string,
    originalResponse: string,
    correctionMessage: string,
    userId?: string
  ): Promise<string> {
    return this.createCandidate({
      tenantId,
      userId,
      conversationId,
      candidateType: 'correction',
      promptText: originalPrompt,
      responseText: originalResponse,
      correctionText: correctionMessage,
      qualityScore: 0.9, // Corrections are high value
    });
  }

  /**
   * Create candidate from high prediction error (surprise)
   */
  async createFromPredictionError(
    tenantId: string,
    conversationId: string,
    promptText: string,
    responseText: string,
    predictionError: number,
    userId?: string
  ): Promise<string> {
    return this.createCandidate({
      tenantId,
      userId,
      conversationId,
      candidateType: 'high_prediction_error',
      promptText,
      responseText,
      predictionErrorAtTime: predictionError,
      qualityScore: Math.min(1, predictionError + 0.3), // Higher error = higher value
    });
  }

  /**
   * Create candidate from positive feedback
   */
  async createFromPositiveFeedback(
    tenantId: string,
    conversationId: string,
    promptText: string,
    responseText: string,
    rating: number,
    userId?: string
  ): Promise<string> {
    return this.createCandidate({
      tenantId,
      userId,
      conversationId,
      candidateType: 'high_satisfaction',
      promptText,
      responseText,
      userRating: rating,
      qualityScore: rating / 5,
    });
  }

  /**
   * Create candidate when user explicitly teaches
   */
  async createFromExplicitTeaching(
    tenantId: string,
    conversationId: string,
    teachingPrompt: string,
    learnedContent: string,
    userId?: string
  ): Promise<string> {
    return this.createCandidate({
      tenantId,
      userId,
      conversationId,
      candidateType: 'user_explicit_teach',
      promptText: teachingPrompt,
      responseText: learnedContent,
      qualityScore: 0.95, // Explicit teaching is highest value
    });
  }

  // ============================================================================
  // Training Dataset Management
  // ============================================================================

  /**
   * Get candidates ready for next training job
   */
  async getTrainingDataset(
    tenantId: string,
    maxCandidates: number = 1000,
    maxTokens: number = 500000
  ): Promise<TrainingDataset> {
    const result = await executeStatement(
      `SELECT * FROM get_training_candidates($1, $2)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'maxCandidates', value: { longValue: maxCandidates } },
      ]
    );
    
    const candidates: TrainingDataset['candidates'] = [];
    let totalTokens = 0;
    const typeDistribution: Record<string, number> = {};
    
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const tokenCount = Math.ceil((String(r.prompt_text).length + String(r.response_text).length) / 4);
      
      if (totalTokens + tokenCount > maxTokens) break;
      
      candidates.push({
        candidateId: String(r.candidate_id),
        candidateType: r.candidate_type as CandidateType,
        promptText: String(r.prompt_text),
        responseText: String(r.response_text),
        correctionText: r.correction_text ? String(r.correction_text) : undefined,
        qualityScore: r.quality_score ? Number(r.quality_score) : undefined,
      });
      
      totalTokens += tokenCount;
      const type = r.candidate_type as string;
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    }
    
    return {
      candidates,
      totalTokens,
      typeDistribution: typeDistribution as Record<CandidateType, number>,
    };
  }

  /**
   * Mark candidates as queued for training
   */
  async markAsQueued(candidateIds: string[], jobId: string): Promise<void> {
    if (candidateIds.length === 0) return;
    
    await executeStatement(
      `UPDATE learning_candidates 
       SET training_status = 'queued', training_job_id = $2
       WHERE candidate_id = ANY($1::uuid[])`,
      [
        { name: 'candidateIds', value: { stringValue: `{${candidateIds.join(',')}}` } },
        { name: 'jobId', value: { stringValue: jobId } },
      ]
    );
  }

  /**
   * Mark candidates as training complete
   */
  async markAsCompleted(jobId: string): Promise<void> {
    await executeStatement(
      `UPDATE learning_candidates 
       SET training_status = 'completed', trained_at = NOW()
       WHERE training_job_id = $1 AND training_status = 'queued'`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );
  }

  /**
   * Mark candidates as rejected
   */
  async markAsRejected(candidateIds: string[], reason: string): Promise<void> {
    if (candidateIds.length === 0) return;
    
    await executeStatement(
      `UPDATE learning_candidates 
       SET training_status = 'rejected'
       WHERE candidate_id = ANY($1::uuid[])`,
      [{ name: 'candidateIds', value: { stringValue: `{${candidateIds.join(',')}}` } }]
    );
    
    logger.info('Learning candidates rejected', { count: candidateIds.length, reason });
  }

  // ============================================================================
  // Candidate Management
  // ============================================================================

  /**
   * Get candidate by ID
   */
  async getCandidate(candidateId: string): Promise<LearningCandidate | null> {
    const result = await executeStatement(
      `SELECT * FROM learning_candidates WHERE candidate_id = $1`,
      [{ name: 'candidateId', value: { stringValue: candidateId } }]
    );
    
    if (result.rows.length === 0) return null;
    return this.mapCandidate(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Get pending candidates for a tenant
   */
  async getPendingCandidates(
    tenantId: string,
    limit: number = 100
  ): Promise<LearningCandidate[]> {
    const result = await executeStatement(
      `SELECT * FROM learning_candidates 
       WHERE tenant_id = $1 AND training_status = 'pending'
       AND expires_at > NOW()
       ORDER BY quality_score DESC NULLS LAST, created_at DESC
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    
    return result.rows.map(row => this.mapCandidate(row as Record<string, unknown>));
  }

  /**
   * Get candidate statistics
   */
  async getCandidateStats(tenantId: string): Promise<{
    totalPending: number;
    totalCompleted: number;
    byType: Record<CandidateType, number>;
    avgQualityScore: number;
    estimatedTrainingTokens: number;
  }> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) FILTER (WHERE training_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE training_status = 'completed') as completed,
        AVG(quality_score) FILTER (WHERE training_status = 'pending') as avg_quality,
        SUM(token_count) FILTER (WHERE training_status = 'pending') as pending_tokens
      FROM learning_candidates
      WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const row = result.rows[0] as Record<string, unknown>;
    
    // Get type breakdown
    const typeResult = await executeStatement(
      `SELECT candidate_type, COUNT(*) as count
       FROM learning_candidates
       WHERE tenant_id = $1 AND training_status = 'pending'
       GROUP BY candidate_type`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const byType: Record<string, number> = {};
    for (const r of typeResult.rows) {
      const tr = r as Record<string, unknown>;
      byType[String(tr.candidate_type)] = Number(tr.count);
    }
    
    return {
      totalPending: Number(row.pending || 0),
      totalCompleted: Number(row.completed || 0),
      byType: byType as Record<CandidateType, number>,
      avgQualityScore: Number(row.avg_quality || 0),
      estimatedTrainingTokens: Number(row.pending_tokens || 0),
    };
  }

  // ============================================================================
  // Automatic Candidate Detection
  // ============================================================================

  /**
   * Analyze a conversation turn to detect learning opportunities
   */
  async analyzeForLearningOpportunity(
    tenantId: string,
    conversationId: string,
    promptText: string,
    responseText: string,
    nextUserMessage?: string,
    predictionError?: number,
    userId?: string
  ): Promise<{ shouldLearn: boolean; candidateId?: string; reason?: string }> {
    
    // Check 1: High prediction error
    if (predictionError !== undefined && predictionError > 0.5) {
      const candidateId = await this.createFromPredictionError(
        tenantId, conversationId, promptText, responseText, predictionError, userId
      );
      return { shouldLearn: true, candidateId, reason: 'high_prediction_error' };
    }
    
    // Check 2: User correction detected in next message
    if (nextUserMessage) {
      const correctionPatterns = [
        'no,', 'wrong', 'incorrect', 'that\'s not', 'actually,',
        'you\'re mistaken', 'not what i', 'i meant', 'should be'
      ];
      
      const lowerNext = nextUserMessage.toLowerCase();
      if (correctionPatterns.some(p => lowerNext.includes(p))) {
        const candidateId = await this.createFromCorrection(
          tenantId, conversationId, promptText, responseText, nextUserMessage, userId
        );
        return { shouldLearn: true, candidateId, reason: 'correction' };
      }
      
      // Check 3: Explicit teaching patterns
      const teachingPatterns = [
        'remember that', 'note that', 'fyi', 'for future reference',
        'you should know', 'keep in mind', 'learn this'
      ];
      
      if (teachingPatterns.some(p => lowerNext.includes(p))) {
        const candidateId = await this.createFromExplicitTeaching(
          tenantId, conversationId, promptText, nextUserMessage, userId
        );
        return { shouldLearn: true, candidateId, reason: 'explicit_teaching' };
      }
    }
    
    return { shouldLearn: false };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private mapCandidate(row: Record<string, unknown>): LearningCandidate {
    return {
      candidateId: String(row.candidate_id),
      tenantId: String(row.tenant_id),
      userId: row.user_id ? String(row.user_id) : undefined,
      conversationId: String(row.conversation_id),
      messageId: row.message_id ? String(row.message_id) : undefined,
      candidateType: row.candidate_type as CandidateType,
      promptText: String(row.prompt_text),
      responseText: String(row.response_text),
      correctionText: row.correction_text ? String(row.correction_text) : undefined,
      qualityScore: row.quality_score ? Number(row.quality_score) : undefined,
      userRating: row.user_rating ? Number(row.user_rating) : undefined,
      predictionErrorAtTime: row.prediction_error_at_time ? Number(row.prediction_error_at_time) : undefined,
      trainingStatus: row.training_status as TrainingStatus,
      trainingJobId: row.training_job_id ? String(row.training_job_id) : undefined,
      trainedAt: row.trained_at ? String(row.trained_at) : undefined,
      domainDetected: row.domain_detected ? String(row.domain_detected) : undefined,
      complexityLevel: row.complexity_level ? String(row.complexity_level) : undefined,
      tokenCount: row.token_count ? Number(row.token_count) : undefined,
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
    };
  }
}

export const learningCandidateService = new LearningCandidateService();
