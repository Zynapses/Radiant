// RADIANT v4.18.0 - Enhanced Learning Service
// 8 Learning Improvements for Better User Experience
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import type { SqlParameter } from '@aws-sdk/client-rds-data';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface EnhancedLearningConfig {
  tenantId: string;
  
  // Candidate thresholds
  minCandidatesForTraining: number;
  minPositiveCandidates: number;
  minNegativeCandidates: number;
  
  // Training frequency
  trainingFrequency: 'daily' | 'twice_weekly' | 'weekly' | 'biweekly' | 'monthly';
  trainingDayOfWeek: number;
  trainingHourUtc: number | null; // null = auto-optimal
  
  // Intelligent scheduling
  autoOptimalTime: boolean;
  optimalTimeLastCalculated?: Date;
  optimalTimeConfidence?: number;
  
  // Feature toggles
  implicitFeedbackEnabled: boolean;
  negativeLearningEnabled: boolean;
  activeLearningEnabled: boolean;
  domainAdaptersEnabled: boolean;
  patternCachingEnabled: boolean;
  conversationLearningEnabled: boolean;
  
  // Implicit feedback weights
  copySignalWeight: number;
  followupSignalWeight: number;
  abandonSignalWeight: number;
  rephraseSignalWeight: number;
  dwellTimeThresholdSeconds: number;
  
  // Active learning settings
  activeLearningProbability: number;
  activeLearningUncertaintyThreshold: number;
  
  // Pattern cache settings
  patternCacheTtlHours: number;
  patternCacheMinOccurrences: number;
  patternCacheMinRating: number;           // Minimum rating to use cache (default 4.5)
  patternCacheConfidenceThreshold: number; // Min confidence to use cache (default 0.8)
  
  // Per-user learning
  perUserLearningEnabled: boolean;
  
  // Adapter settings
  adapterAutoSelectionEnabled: boolean;
  adapterRollbackEnabled: boolean;
  adapterRollbackThreshold: number;        // Satisfaction drop % to trigger rollback
  
  // Redis cache
  redisCacheEnabled: boolean;
}

export type ImplicitSignalType = 
  | 'copy_response'
  | 'follow_up_question'
  | 'rephrase_question'
  | 'abandon_conversation'
  | 'long_dwell_time'
  | 'quick_dismiss'
  | 'regenerate_request'
  | 'thumbs_up'
  | 'thumbs_down'
  | 'share_response'
  | 'save_response';

export interface ImplicitFeedbackSignal {
  id: string;
  tenantId: string;
  userId: string;
  messageId: string;
  conversationId?: string;
  signalType: ImplicitSignalType;
  signalValue?: number;
  inferredQuality: number;
  confidence: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type ErrorCategory = 
  | 'factual_error'
  | 'incomplete_answer'
  | 'wrong_tone'
  | 'too_verbose'
  | 'too_brief'
  | 'off_topic'
  | 'harmful_content'
  | 'formatting_issue'
  | 'code_error'
  | 'unclear_explanation'
  | 'other';

export interface NegativeLearningCandidate {
  id: string;
  tenantId: string;
  userId: string;
  prompt: string;
  response: string;
  domain?: string;
  rating?: number;
  negativeSignals: string[];
  userFeedback?: string;
  correctedResponse?: string;
  errorCategory?: ErrorCategory;
  status: 'pending' | 'processed' | 'rejected' | 'used_in_training';
  qualityScore: number;
  createdAt: Date;
}

export type ActiveLearningRequestReason = 
  | 'high_uncertainty'
  | 'new_domain'
  | 'complex_query'
  | 'edge_case'
  | 'random_sample'
  | 'domain_calibration'
  | 'after_correction';

export type ActiveLearningRequestType = 
  | 'binary_helpful'
  | 'rating_scale'
  | 'specific_feedback'
  | 'correction_request'
  | 'preference_choice';

export interface ActiveLearningRequest {
  id: string;
  tenantId: string;
  userId: string;
  messageId: string;
  conversationId?: string;
  requestReason: ActiveLearningRequestReason;
  requestType: ActiveLearningRequestType;
  promptShown: string;
  userResponded: boolean;
  userResponse?: Record<string, unknown>;
  modelConfidence?: number;
  uncertaintyScore?: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface DomainLoraAdapter {
  id: string;
  tenantId: string;
  domain: string;
  subdomain?: string;
  adapterName: string;
  baseModel: string;
  adapterVersion: number;
  s3Bucket: string;
  s3Key: string;
  adapterSizeBytes?: number;
  trainingCandidatesCount: number;
  lastTrainedAt?: Date;
  accuracyScore?: number;
  domainRelevanceScore?: number;
  userSatisfactionScore?: number;
  status: 'training' | 'validating' | 'active' | 'deprecated' | 'failed';
  isDefault: boolean;
}

export interface PatternCacheEntry {
  id: string;
  tenantId: string;
  promptHash: string;
  domain?: string;
  normalizedPrompt: string;
  successfulResponse: string;
  responseMetadata?: Record<string, unknown>;
  averageRating: number;
  occurrenceCount: number;
  positiveSignalCount: number;
  modelUsed?: string;
  temperatureUsed?: number;
  lastUsedAt: Date;
  expiresAt: Date;
  cacheHits: number;
}

export interface ConversationLearning {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  messageCount: number;
  domainsDiscussed: string[];
  conversationRating?: number;
  goalAchieved?: boolean;
  userSatisfactionInferred: number;
  positiveSignalsCount: number;
  negativeSignalsCount: number;
  correctionsCount: number;
  regenerationsCount: number;
  learningValueScore: number;
  selectedForTraining: boolean;
  bestInteractionIds: string[];
  worstInteractionIds: string[];
}

export interface LearningAnalytics {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  positiveCandidatesCreated: number;
  negativeCandidatesCreated: number;
  implicitSignalsCaptured: number;
  activeLearningRequestsSent: number;
  activeLearningResponsesReceived: number;
  activeLearningResponseRate: number;
  patternCacheHits: number;
  patternCacheMisses: number;
  patternCacheHitRate: number;
  trainingJobsCompleted: number;
  candidatesUsedInTraining: number;
  avgRatingBefore?: number;
  avgRatingAfter?: number;
  ratingImprovement?: number;
}

// ============================================================================
// Signal Quality Mappings
// ============================================================================

const SIGNAL_QUALITY_MAP: Record<ImplicitSignalType, number> = {
  'copy_response': 0.80,
  'share_response': 0.85,
  'save_response': 0.80,
  'thumbs_up': 0.90,
  'long_dwell_time': 0.30,
  'follow_up_question': 0.30,
  'thumbs_down': -0.90,
  'regenerate_request': -0.60,
  'rephrase_question': -0.50,
  'abandon_conversation': -0.70,
  'quick_dismiss': -0.40,
};

const ACTIVE_LEARNING_PROMPTS: Record<ActiveLearningRequestType, string> = {
  'binary_helpful': 'Was this response helpful?',
  'rating_scale': 'How would you rate this response? (1-5)',
  'specific_feedback': 'What could be improved about this response?',
  'correction_request': 'Is the information in this response correct?',
  'preference_choice': 'Which response do you prefer?',
};

// ============================================================================
// Enhanced Learning Service
// ============================================================================

class EnhancedLearningService {
  
  // ==========================================================================
  // Configuration
  // ==========================================================================
  
  async getConfig(tenantId: string): Promise<EnhancedLearningConfig | null> {
    const result = await executeStatement(
      `SELECT * FROM enhanced_learning_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    if (!result.rows?.length) {
      // Initialize default config
      await this.initializeConfig(tenantId);
      return this.getConfig(tenantId);
    }
    
    return this.mapConfig(result.rows[0]);
  }
  
  async updateConfig(tenantId: string, updates: Partial<EnhancedLearningConfig>): Promise<EnhancedLearningConfig> {
    const setClauses: string[] = [];
    const params: SqlParameter[] = [stringParam('tenantId', tenantId)];
    let paramIndex = 2;
    
    const fieldMap: Record<string, string> = {
      minCandidatesForTraining: 'min_candidates_for_training',
      minPositiveCandidates: 'min_positive_candidates',
      minNegativeCandidates: 'min_negative_candidates',
      trainingFrequency: 'training_frequency',
      trainingDayOfWeek: 'training_day_of_week',
      trainingHourUtc: 'training_hour_utc',
      implicitFeedbackEnabled: 'implicit_feedback_enabled',
      negativeLearningEnabled: 'negative_learning_enabled',
      activeLearningEnabled: 'active_learning_enabled',
      domainAdaptersEnabled: 'domain_adapters_enabled',
      patternCachingEnabled: 'pattern_caching_enabled',
      conversationLearningEnabled: 'conversation_learning_enabled',
      copySignalWeight: 'copy_signal_weight',
      followupSignalWeight: 'followup_signal_weight',
      abandonSignalWeight: 'abandon_signal_weight',
      rephraseSignalWeight: 'rephrase_signal_weight',
      dwellTimeThresholdSeconds: 'dwell_time_threshold_seconds',
      activeLearningProbability: 'active_learning_probability',
      activeLearningUncertaintyThreshold: 'active_learning_uncertainty_threshold',
      patternCacheTtlHours: 'pattern_cache_ttl_hours',
      patternCacheMinOccurrences: 'pattern_cache_min_occurrences',
    };
    
    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        params.push({ name: `p${paramIndex}`, value: { stringValue: String(value) } });
        paramIndex++;
      }
    }
    
    if (setClauses.length > 0) {
      setClauses.push('updated_at = NOW()');
      await executeStatement(
        `UPDATE enhanced_learning_config SET ${setClauses.join(', ')} WHERE tenant_id = $1::uuid`,
        params
      );
    }
    
    return (await this.getConfig(tenantId))!;
  }
  
  private async initializeConfig(tenantId: string): Promise<void> {
    await executeStatement(
      `INSERT INTO enhanced_learning_config (tenant_id) VALUES ($1::uuid) ON CONFLICT (tenant_id) DO NOTHING`,
      [stringParam('tenantId', tenantId)]
    );
  }
  
  // ==========================================================================
  // 1. Implicit Feedback Signals
  // ==========================================================================
  
  async recordImplicitSignal(
    tenantId: string,
    userId: string,
    messageId: string,
    signalType: ImplicitSignalType,
    options: {
      conversationId?: string;
      signalValue?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<ImplicitFeedbackSignal> {
    const config = await this.getConfig(tenantId);
    if (!config?.implicitFeedbackEnabled) {
      throw new Error('Implicit feedback is disabled for this tenant');
    }
    
    const inferredQuality = this.calculateInferredQuality(signalType, config);
    const confidence = this.calculateSignalConfidence(signalType, options.signalValue);
    
    const result = await executeStatement(
      `INSERT INTO implicit_feedback_signals 
       (tenant_id, user_id, message_id, conversation_id, signal_type, signal_value, inferred_quality, confidence, metadata)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('messageId', messageId),
        stringParam('conversationId', options.conversationId || ''),
        stringParam('signalType', signalType),
        doubleParam('signalValue', options.signalValue || 0),
        doubleParam('inferredQuality', inferredQuality),
        doubleParam('confidence', confidence),
        stringParam('metadata', JSON.stringify(options.metadata || {})),
      ]
    );
    
    logger.info('Recorded implicit feedback signal', { tenantId, signalType, inferredQuality });
    
    // Check if this should create a learning candidate
    await this.maybeCreateCandidateFromSignal(tenantId, userId, messageId, signalType, inferredQuality);
    
    return this.mapImplicitSignal(result.rows[0]);
  }
  
  async getImplicitSignals(
    tenantId: string,
    options: { messageId?: string; userId?: string; limit?: number } = {}
  ): Promise<ImplicitFeedbackSignal[]> {
    let query = `SELECT * FROM implicit_feedback_signals WHERE tenant_id = $1::uuid`;
    const params: SqlParameter[] = [stringParam('tenantId', tenantId)];
    
    if (options.messageId) {
      query += ` AND message_id = $2::uuid`;
      params.push(stringParam('messageId', options.messageId));
    }
    if (options.userId) {
      query += ` AND user_id = $${params.length + 1}::uuid`;
      params.push(stringParam('userId', options.userId));
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(longParam('limit', options.limit || 100));
    
    const result = await executeStatement(query, params);
    return (result.rows || []).map(row => this.mapImplicitSignal(row));
  }
  
  private calculateInferredQuality(signalType: ImplicitSignalType, config: EnhancedLearningConfig): number {
    const baseQuality = SIGNAL_QUALITY_MAP[signalType] || 0;
    
    // Apply config weights for configurable signals
    switch (signalType) {
      case 'copy_response':
        return config.copySignalWeight;
      case 'follow_up_question':
        return config.followupSignalWeight;
      case 'abandon_conversation':
        return -config.abandonSignalWeight;
      case 'rephrase_question':
        return -config.rephraseSignalWeight;
      default:
        return baseQuality;
    }
  }
  
  private calculateSignalConfidence(signalType: ImplicitSignalType, signalValue?: number): number {
    // Higher confidence for explicit signals
    if (['thumbs_up', 'thumbs_down', 'copy_response', 'share_response'].includes(signalType)) {
      return 0.90;
    }
    // Medium confidence for behavioral signals
    if (['regenerate_request', 'save_response'].includes(signalType)) {
      return 0.80;
    }
    // Lower confidence for inferred signals
    if (signalType === 'long_dwell_time' && signalValue) {
      return Math.min(0.85, 0.50 + (signalValue / 120) * 0.35); // More time = more confidence
    }
    return 0.70;
  }
  
  private async maybeCreateCandidateFromSignal(
    tenantId: string,
    userId: string,
    messageId: string,
    signalType: ImplicitSignalType,
    inferredQuality: number
  ): Promise<void> {
    // Strong positive signals create positive candidates
    if (inferredQuality >= 0.75 && ['copy_response', 'thumbs_up', 'share_response'].includes(signalType)) {
      await this.createPositiveCandidateFromMessage(tenantId, userId, messageId, signalType);
    }
    // Strong negative signals create negative candidates
    if (inferredQuality <= -0.6 && ['thumbs_down', 'abandon_conversation', 'regenerate_request'].includes(signalType)) {
      await this.createNegativeCandidateFromMessage(tenantId, userId, messageId, signalType);
    }
  }
  
  // ==========================================================================
  // 2. Negative Learning Candidates
  // ==========================================================================
  
  async createNegativeCandidate(
    tenantId: string,
    userId: string,
    data: {
      prompt: string;
      response: string;
      domain?: string;
      rating?: number;
      negativeSignals?: string[];
      userFeedback?: string;
      correctedResponse?: string;
      errorCategory?: ErrorCategory;
    }
  ): Promise<NegativeLearningCandidate> {
    const config = await this.getConfig(tenantId);
    if (!config?.negativeLearningEnabled) {
      throw new Error('Negative learning is disabled for this tenant');
    }
    
    const qualityScore = this.calculateNegativeCandidateQuality(data);
    
    const result = await executeStatement(
      `INSERT INTO negative_learning_candidates 
       (tenant_id, user_id, prompt, response, domain, rating, negative_signals, user_feedback, corrected_response, error_category, quality_score)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('prompt', data.prompt),
        stringParam('response', data.response),
        stringParam('domain', data.domain || ''),
        longParam('rating', data.rating || 0),
        stringParam('negativeSignals', JSON.stringify(data.negativeSignals || [])),
        stringParam('userFeedback', data.userFeedback || ''),
        stringParam('correctedResponse', data.correctedResponse || ''),
        stringParam('errorCategory', data.errorCategory || ''),
        longParam('qualityScore', qualityScore),
      ]
    );
    
    logger.info('Created negative learning candidate', { tenantId, errorCategory: data.errorCategory });
    
    return this.mapNegativeCandidate(result.rows[0]);
  }
  
  async getNegativeCandidates(
    tenantId: string,
    options: { status?: string; domain?: string; limit?: number } = {}
  ): Promise<NegativeLearningCandidate[]> {
    let query = `SELECT * FROM negative_learning_candidates WHERE tenant_id = $1::uuid`;
    const params: SqlParameter[] = [stringParam('tenantId', tenantId)];
    
    if (options.status) {
      query += ` AND status = $2`;
      params.push(stringParam('status', options.status));
    }
    if (options.domain) {
      query += ` AND domain = $${params.length + 1}`;
      params.push(stringParam('domain', options.domain));
    }
    
    query += ` ORDER BY quality_score DESC, created_at DESC LIMIT $${params.length + 1}`;
    params.push(longParam('limit', options.limit || 100));
    
    const result = await executeStatement(query, params);
    return (result.rows || []).map(row => this.mapNegativeCandidate(row));
  }
  
  private calculateNegativeCandidateQuality(data: {
    rating?: number;
    correctedResponse?: string;
    errorCategory?: ErrorCategory;
    userFeedback?: string;
  }): number {
    let quality = 0.5;
    
    // Corrections are most valuable for contrastive learning
    if (data.correctedResponse) {
      quality += 0.3;
    }
    
    // Categorized errors are more useful
    if (data.errorCategory) {
      quality += 0.1;
    }
    
    // User feedback adds context
    if (data.userFeedback && data.userFeedback.length > 20) {
      quality += 0.1;
    }
    
    // Very negative ratings indicate clear problems
    if (data.rating !== undefined && data.rating <= -3) {
      quality += 0.1;
    }
    
    return Math.min(1, quality);
  }
  
  private async createNegativeCandidateFromMessage(
    tenantId: string,
    userId: string,
    messageId: string,
    signalType: string
  ): Promise<void> {
    try {
      // Fetch message content from UDS messages table
      const messageResult = await executeStatement(
        `SELECT m.content, m.role, c.id as conversation_id,
                LAG(m.content) OVER (ORDER BY m.created_at) as previous_content
         FROM uds_messages m
         JOIN uds_conversations c ON m.conversation_id = c.id
         WHERE m.id = $1::uuid AND c.tenant_id = $2::uuid
         LIMIT 2`,
        [stringParam('messageId', messageId), stringParam('tenantId', tenantId)]
      );

      if (!messageResult.rows || messageResult.rows.length === 0) {
        logger.warn('Message not found for negative candidate', { messageId });
        return;
      }

      const message = messageResult.rows[0] as any;
      
      // Get the prompt (previous user message) and response (assistant message)
      const prompt = message.previous_content || '';
      const response = message.content || '';

      if (!prompt || !response) {
        logger.warn('Incomplete message data for negative candidate', { messageId });
        return;
      }

      // Create the negative candidate
      await this.createNegativeCandidate(tenantId, userId, {
        prompt,
        response,
        negativeSignals: [signalType],
        errorCategory: this.signalToErrorCategory(signalType),
      });

      logger.info('Created negative candidate from message', { tenantId, messageId, signalType });
    } catch (error) {
      logger.error('Failed to create negative candidate from message', { tenantId, messageId, error });
    }
  }
  
  private async createPositiveCandidateFromMessage(
    tenantId: string,
    userId: string,
    messageId: string,
    signalType: string
  ): Promise<void> {
    try {
      // Fetch message content from UDS messages table
      const messageResult = await executeStatement(
        `SELECT m.content, m.role, c.id as conversation_id,
                LAG(m.content) OVER (ORDER BY m.created_at) as previous_content
         FROM uds_messages m
         JOIN uds_conversations c ON m.conversation_id = c.id
         WHERE m.id = $1::uuid AND c.tenant_id = $2::uuid
         LIMIT 2`,
        [stringParam('messageId', messageId), stringParam('tenantId', tenantId)]
      );

      if (!messageResult.rows || messageResult.rows.length === 0) {
        logger.warn('Message not found for positive candidate', { messageId });
        return;
      }

      const message = messageResult.rows[0] as any;
      
      // Get the prompt (previous user message) and response (assistant message)
      const prompt = message.previous_content || '';
      const response = message.content || '';

      if (!prompt || !response) {
        logger.warn('Incomplete message data for positive candidate', { messageId });
        return;
      }

      // Create positive candidate in learning_candidates table
      await executeStatement(
        `INSERT INTO learning_candidates 
         (tenant_id, user_id, prompt_text, response_text, candidate_type, source, quality_score, status)
         VALUES ($1::uuid, $2::uuid, $3, $4, 'implicit_positive', $5, 0.8, 'pending')`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('prompt', prompt),
          stringParam('response', response),
          stringParam('source', `signal:${signalType}`),
        ]
      );

      logger.info('Created positive candidate from message', { tenantId, messageId, signalType });
    } catch (error) {
      logger.error('Failed to create positive candidate from message', { tenantId, messageId, error });
    }
  }

  private signalToErrorCategory(signalType: string): ErrorCategory {
    const mapping: Record<string, ErrorCategory> = {
      'thumbs_down': 'incorrect_answer',
      'abandon_conversation': 'unhelpful_response',
      'regenerate_request': 'poor_formatting',
      'report_issue': 'factual_error',
    };
    return mapping[signalType] || 'other';
  }
  
  // ==========================================================================
  // 3. Active Learning
  // ==========================================================================
  
  async shouldRequestFeedback(
    tenantId: string,
    options: {
      modelConfidence?: number;
      isNewDomain?: boolean;
      isComplexQuery?: boolean;
      recentFeedbackCount?: number;
    }
  ): Promise<{ shouldRequest: boolean; reason?: ActiveLearningRequestReason; requestType?: ActiveLearningRequestType }> {
    const config = await this.getConfig(tenantId);
    if (!config?.activeLearningEnabled) {
      return { shouldRequest: false };
    }
    
    // Don't spam users with requests
    if (options.recentFeedbackCount && options.recentFeedbackCount > 3) {
      return { shouldRequest: false };
    }
    
    // High uncertainty
    if (options.modelConfidence !== undefined && options.modelConfidence < config.activeLearningUncertaintyThreshold) {
      return { shouldRequest: true, reason: 'high_uncertainty', requestType: 'binary_helpful' };
    }
    
    // New domain
    if (options.isNewDomain) {
      return { shouldRequest: true, reason: 'new_domain', requestType: 'rating_scale' };
    }
    
    // Complex query
    if (options.isComplexQuery) {
      return { shouldRequest: true, reason: 'complex_query', requestType: 'specific_feedback' };
    }
    
    // Random sampling
    if (Math.random() < config.activeLearningProbability) {
      return { shouldRequest: true, reason: 'random_sample', requestType: 'binary_helpful' };
    }
    
    return { shouldRequest: false };
  }
  
  async createActiveLearningRequest(
    tenantId: string,
    userId: string,
    messageId: string,
    reason: ActiveLearningRequestReason,
    requestType: ActiveLearningRequestType,
    options: {
      conversationId?: string;
      modelConfidence?: number;
      uncertaintyScore?: number;
      customPrompt?: string;
    } = {}
  ): Promise<ActiveLearningRequest> {
    const promptShown = options.customPrompt || ACTIVE_LEARNING_PROMPTS[requestType];
    
    const result = await executeStatement(
      `INSERT INTO active_learning_requests 
       (tenant_id, user_id, message_id, conversation_id, request_reason, request_type, prompt_shown, model_confidence, uncertainty_score)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('messageId', messageId),
        stringParam('conversationId', options.conversationId || ''),
        stringParam('requestReason', reason),
        stringParam('requestType', requestType),
        stringParam('promptShown', promptShown),
        longParam('modelConfidence', options.modelConfidence || 0),
        longParam('uncertaintyScore', options.uncertaintyScore || 0),
      ]
    );
    
    logger.info('Created active learning request', { tenantId, reason, requestType });
    
    return this.mapActiveLearningRequest(result.rows[0]);
  }
  
  async recordActiveLearningResponse(
    requestId: string,
    response: Record<string, unknown>
  ): Promise<ActiveLearningRequest> {
    const result = await executeStatement(
      `UPDATE active_learning_requests 
       SET user_responded = true, user_response = $2, response_timestamp = NOW()
       WHERE id = $1::uuid
       RETURNING *`,
      [
        stringParam('requestId', requestId),
        stringParam('response', JSON.stringify(response)),
      ]
    );
    
    if (!result.rows?.length) {
      throw new Error('Active learning request not found');
    }
    
    return this.mapActiveLearningRequest(result.rows[0]);
  }
  
  async getPendingActiveLearningRequests(tenantId: string, userId: string): Promise<ActiveLearningRequest[]> {
    const result = await executeStatement(
      `SELECT * FROM active_learning_requests 
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid 
       AND user_responded = false AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );
    
    return (result.rows || []).map(row => this.mapActiveLearningRequest(row));
  }
  
  // ==========================================================================
  // 4. Domain-Specific Adapters
  // ==========================================================================
  
  async getActiveAdapter(tenantId: string, domain: string, subdomain?: string): Promise<DomainLoraAdapter | null> {
    const result = await executeStatement(
      `SELECT * FROM domain_lora_adapters 
       WHERE tenant_id = $1::uuid AND domain = $2 AND status = 'active'
       ${subdomain ? `AND subdomain = $3` : `AND subdomain IS NULL`}
       ORDER BY adapter_version DESC LIMIT 1`,
      subdomain 
        ? [stringParam('tenantId', tenantId), stringParam('domain', domain), stringParam('subdomain', subdomain)]
        : [stringParam('tenantId', tenantId), stringParam('domain', domain)]
    );
    
    if (!result.rows?.length) return null;
    return this.mapDomainAdapter(result.rows[0]);
  }
  
  async listDomainAdapters(tenantId: string, options: { domain?: string; status?: string } = {}): Promise<DomainLoraAdapter[]> {
    let query = `SELECT * FROM domain_lora_adapters WHERE tenant_id = $1::uuid`;
    const params: SqlParameter[] = [stringParam('tenantId', tenantId)];
    
    if (options.domain) {
      query += ` AND domain = $2`;
      params.push(stringParam('domain', options.domain));
    }
    if (options.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(stringParam('status', options.status));
    }
    
    query += ` ORDER BY domain, subdomain, adapter_version DESC`;
    
    const result = await executeStatement(query, params);
    return (result.rows || []).map(row => this.mapDomainAdapter(row));
  }
  
  async incrementDomainTrainingQueue(tenantId: string, domain: string, subdomain: string | null, isPositive: boolean): Promise<void> {
    await executeStatement(
      `INSERT INTO domain_adapter_training_queue (tenant_id, domain, subdomain, positive_candidates_count, negative_candidates_count)
       VALUES ($1::uuid, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, domain, subdomain) DO UPDATE SET
         positive_candidates_count = domain_adapter_training_queue.positive_candidates_count + $4,
         negative_candidates_count = domain_adapter_training_queue.negative_candidates_count + $5,
         last_checked_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        stringParam('domain', domain),
        stringParam('subdomain', subdomain || ''),
        longParam('positive', isPositive ? 1 : 0),
        longParam('negative', isPositive ? 0 : 1),
      ]
    );
  }
  
  // ==========================================================================
  // 5. Pattern Cache
  // ==========================================================================
  
  async cacheSuccessfulPattern(
    tenantId: string,
    prompt: string,
    response: string,
    options: {
      domain?: string;
      rating: number;
      modelUsed?: string;
      temperatureUsed?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<PatternCacheEntry> {
    const config = await this.getConfig(tenantId);
    if (!config?.patternCachingEnabled) {
      throw new Error('Pattern caching is disabled for this tenant');
    }
    
    const normalizedPrompt = this.normalizePrompt(prompt);
    const promptHash = this.hashPrompt(normalizedPrompt);
    const expiresAt = new Date(Date.now() + config.patternCacheTtlHours * 60 * 60 * 1000);
    
    const result = await executeStatement(
      `INSERT INTO successful_pattern_cache 
       (tenant_id, prompt_hash, domain, normalized_prompt, successful_response, response_metadata, average_rating, model_used, temperature_used, expires_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id, prompt_hash) DO UPDATE SET
         occurrence_count = successful_pattern_cache.occurrence_count + 1,
         average_rating = (successful_pattern_cache.average_rating * successful_pattern_cache.occurrence_count + $7) / (successful_pattern_cache.occurrence_count + 1),
         positive_signal_count = successful_pattern_cache.positive_signal_count + 1,
         last_used_at = NOW(),
         expires_at = $10
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('promptHash', promptHash),
        stringParam('domain', options.domain || ''),
        stringParam('normalizedPrompt', normalizedPrompt),
        stringParam('response', response),
        stringParam('metadata', JSON.stringify(options.metadata || {})),
        longParam('rating', options.rating),
        stringParam('modelUsed', options.modelUsed || ''),
        longParam('temperatureUsed', options.temperatureUsed || 0),
        stringParam('expiresAt', expiresAt.toISOString()),
      ]
    );
    
    logger.debug('Cached successful pattern', { tenantId, promptHash });
    
    return this.mapPatternCache(result.rows[0]);
  }
  
  async findCachedPattern(
    tenantId: string, 
    prompt: string,
    options: { userId?: string } = {}
  ): Promise<PatternCacheEntry | null> {
    const config = await this.getConfig(tenantId);
    if (!config?.patternCachingEnabled) return null;
    
    const normalizedPrompt = this.normalizePrompt(prompt);
    const promptHash = this.hashPrompt(normalizedPrompt);
    
    // Try Redis first if enabled
    if (config.redisCacheEnabled) {
      const redisResult = await this.findInRedisCache(tenantId, promptHash, options.userId);
      if (redisResult) return redisResult;
    }
    
    // Fall back to PostgreSQL
    const minRating = config.patternCacheMinRating || 4.5;
    
    // Build query based on per-user learning setting
    let query = `SELECT * FROM successful_pattern_cache 
       WHERE tenant_id = $1::uuid AND prompt_hash = $2 
       AND expires_at > NOW() 
       AND occurrence_count >= $3
       AND average_rating >= $4`;
    
    const params = [
      stringParam('tenantId', tenantId),
      stringParam('promptHash', promptHash),
      longParam('minOccurrences', config.patternCacheMinOccurrences),
      doubleParam('minRating', minRating),
    ];
    
    // If per-user learning enabled, prefer user-specific cache
    if (config.perUserLearningEnabled && options.userId) {
      query += ` ORDER BY CASE WHEN user_id = $5::uuid THEN 0 ELSE 1 END, average_rating DESC LIMIT 1`;
      params.push(stringParam('userId', options.userId));
    } else {
      query += ` ORDER BY average_rating DESC, occurrence_count DESC LIMIT 1`;
    }
    
    const result = await executeStatement(query, params);
    
    if (!result.rows?.length) return null;
    
    const cached = this.mapPatternCache(result.rows[0]);
    
    // Apply confidence threshold - only use cache if high confidence
    const confidenceScore = this.calculateCacheConfidence(cached, config);
    if (confidenceScore < config.patternCacheConfidenceThreshold) {
      logger.debug('Cache hit rejected due to low confidence', { 
        tenantId, promptHash, confidenceScore, threshold: config.patternCacheConfidenceThreshold 
      });
      return null;
    }
    
    // Increment cache hit counter
    await executeStatement(
      `UPDATE successful_pattern_cache SET cache_hits = cache_hits + 1, last_used_at = NOW() WHERE id = $1::uuid`,
      [stringParam('id', String(result.rows[0].id))]
    );
    
    // Populate Redis cache for future lookups
    if (config.redisCacheEnabled) {
      await this.populateRedisCache(tenantId, promptHash, cached, options.userId);
    }
    
    return cached;
  }
  
  private calculateCacheConfidence(cached: PatternCacheEntry, config: EnhancedLearningConfig): number {
    // Confidence based on: rating, occurrence count, recency, signal counts
    const ratingScore = (cached.averageRating - 4) / 1; // 4-5 star → 0-1
    const occurrenceScore = Math.min(cached.occurrenceCount / 10, 1); // 0-10 occurrences → 0-1
    const signalScore = Math.min((cached.positiveSignalCount || 0) / 5, 1); // 0-5 signals → 0-1
    const recencyScore = cached.lastUsedAt 
      ? Math.max(0, 1 - (Date.now() - new Date(cached.lastUsedAt).getTime()) / (7 * 24 * 60 * 60 * 1000)) 
      : 0.5; // Decay over 7 days
    
    return (ratingScore * 0.4) + (occurrenceScore * 0.3) + (signalScore * 0.2) + (recencyScore * 0.1);
  }
  
  private async findInRedisCache(tenantId: string, promptHash: string, userId?: string): Promise<PatternCacheEntry | null> {
    // Redis integration using ioredis (dynamically loaded)
    try {
      const redis = await this.getRedisClient();
      if (!redis) return null;
      
      // Try user-specific key first, then tenant-wide
      const userKey = userId ? `pattern:${tenantId}:${userId}:${promptHash}` : null;
      const tenantKey = `pattern:${tenantId}:${promptHash}`;
      
      let cached: string | null = null;
      if (userKey) {
        cached = await redis.get(userKey);
      }
      if (!cached) {
        cached = await redis.get(tenantKey);
      }
      
      if (cached) {
        logger.debug('Redis cache hit', { tenantId, promptHash });
        return JSON.parse(cached) as PatternCacheEntry;
      }
      
      return null;
    } catch (error) {
      logger.warn('Redis cache lookup failed', { error });
      return null;
    }
  }
  
  private async populateRedisCache(
    tenantId: string, 
    promptHash: string, 
    cached: PatternCacheEntry,
    userId?: string
  ): Promise<void> {
    try {
      const redis = await this.getRedisClient();
      if (!redis) return;
      
      const ttlSeconds = 3600; // 1 hour in Redis
      const tenantKey = `pattern:${tenantId}:${promptHash}`;
      
      await redis.setex(tenantKey, ttlSeconds, JSON.stringify(cached));
      
      // Also cache under user key if per-user learning
      if (userId) {
        const userKey = `pattern:${tenantId}:${userId}:${promptHash}`;
        await redis.setex(userKey, ttlSeconds, JSON.stringify(cached));
      }
    } catch (error) {
      logger.warn('Redis cache population failed', { error });
    }
  }
  
  private redisClient: any = null;
  
  private async getRedisClient(): Promise<any> {
    if (this.redisClient) return this.redisClient;
    
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;
    
    try {
      // Dynamic import to avoid issues if Redis not available
      const ioredis = await import('ioredis');
      const Redis = ioredis.default || ioredis;
      this.redisClient = new (Redis as any)(redisUrl);
      return this.redisClient;
    } catch {
      return null;
    }
  }
  
  private normalizePrompt(prompt: string): string {
    return prompt
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }
  
  private hashPrompt(normalizedPrompt: string): string {
    return crypto.createHash('sha256').update(normalizedPrompt).digest('hex').substring(0, 32);
  }
  
  // ==========================================================================
  // 6. Conversation-Level Learning
  // ==========================================================================
  
  async startConversationLearning(tenantId: string, userId: string, conversationId: string): Promise<ConversationLearning> {
    const result = await executeStatement(
      `INSERT INTO conversation_learning (tenant_id, user_id, conversation_id, message_count, conversation_start)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 0, NOW())
       ON CONFLICT (conversation_id) DO NOTHING
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('conversationId', conversationId),
      ]
    );
    
    if (!result.rows?.length) {
      // Already exists, fetch it
      const existing = await this.getConversationLearning(tenantId, conversationId);
      return existing!;
    }
    
    return this.mapConversationLearning(result.rows[0]);
  }
  
  async updateConversationLearning(
    tenantId: string,
    conversationId: string,
    updates: {
      incrementMessageCount?: boolean;
      addDomain?: string;
      conversationRating?: number;
      goalAchieved?: boolean;
      incrementCorrections?: boolean;
      incrementRegenerations?: boolean;
      addBestInteraction?: string;
      addWorstInteraction?: string;
    }
  ): Promise<ConversationLearning | null> {
    const setClauses: string[] = [];
    const params: SqlParameter[] = [
      stringParam('tenantId', tenantId),
      stringParam('conversationId', conversationId),
    ];
    
    if (updates.incrementMessageCount) {
      setClauses.push('message_count = message_count + 1');
    }
    if (updates.addDomain) {
      setClauses.push(`domains_discussed = array_append(domains_discussed, $${params.length + 1})`);
      params.push(stringParam('domain', updates.addDomain));
    }
    if (updates.conversationRating !== undefined) {
      setClauses.push(`conversation_rating = $${params.length + 1}`);
      params.push(longParam('rating', updates.conversationRating));
    }
    if (updates.goalAchieved !== undefined) {
      setClauses.push(`goal_achieved = $${params.length + 1}`);
      params.push(stringParam('goalAchieved', String(updates.goalAchieved)));
    }
    if (updates.incrementCorrections) {
      setClauses.push('corrections_count = corrections_count + 1');
    }
    if (updates.incrementRegenerations) {
      setClauses.push('regenerations_count = regenerations_count + 1');
    }
    if (updates.addBestInteraction) {
      setClauses.push(`best_interaction_ids = array_append(best_interaction_ids, $${params.length + 1}::uuid)`);
      params.push(stringParam('bestId', updates.addBestInteraction));
    }
    if (updates.addWorstInteraction) {
      setClauses.push(`worst_interaction_ids = array_append(worst_interaction_ids, $${params.length + 1}::uuid)`);
      params.push(stringParam('worstId', updates.addWorstInteraction));
    }
    
    if (setClauses.length === 0) return this.getConversationLearning(tenantId, conversationId);
    
    // Also recalculate learning value
    setClauses.push('learning_value_score = assess_conversation_learning_value($1::uuid, $2::uuid)');
    
    const result = await executeStatement(
      `UPDATE conversation_learning SET ${setClauses.join(', ')} 
       WHERE tenant_id = $1::uuid AND conversation_id = $2::uuid
       RETURNING *`,
      params
    );
    
    if (!result.rows?.length) return null;
    return this.mapConversationLearning(result.rows[0]);
  }
  
  async endConversation(tenantId: string, conversationId: string): Promise<ConversationLearning | null> {
    const result = await executeStatement(
      `UPDATE conversation_learning 
       SET conversation_end = NOW(), 
           learning_value_score = assess_conversation_learning_value($1::uuid, $2::uuid)
       WHERE tenant_id = $1::uuid AND conversation_id = $2::uuid
       RETURNING *`,
      [stringParam('tenantId', tenantId), stringParam('conversationId', conversationId)]
    );
    
    if (!result.rows?.length) return null;
    
    const learning = this.mapConversationLearning(result.rows[0]);
    
    // Mark high-value conversations for training
    if (learning.learningValueScore >= 0.7) {
      await executeStatement(
        `UPDATE conversation_learning SET selected_for_training = true WHERE id = $1::uuid`,
        [stringParam('id', learning.id)]
      );
      learning.selectedForTraining = true;
    }
    
    return learning;
  }
  
  async getConversationLearning(tenantId: string, conversationId: string): Promise<ConversationLearning | null> {
    const result = await executeStatement(
      `SELECT * FROM conversation_learning WHERE tenant_id = $1::uuid AND conversation_id = $2::uuid`,
      [stringParam('tenantId', tenantId), stringParam('conversationId', conversationId)]
    );
    
    if (!result.rows?.length) return null;
    return this.mapConversationLearning(result.rows[0]);
  }
  
  async getHighValueConversations(tenantId: string, limit: number = 50): Promise<ConversationLearning[]> {
    const result = await executeStatement(
      `SELECT * FROM conversation_learning 
       WHERE tenant_id = $1::uuid AND learning_value_score >= 0.6
       ORDER BY learning_value_score DESC
       LIMIT $2`,
      [stringParam('tenantId', tenantId), longParam('limit', limit)]
    );
    
    return (result.rows || []).map(row => this.mapConversationLearning(row));
  }
  
  // ==========================================================================
  // 7. Analytics
  // ==========================================================================
  
  async getLearningAnalytics(tenantId: string, periodDays: number = 7): Promise<LearningAnalytics> {
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    
    const [signals, negative, positive, active, cache, training] = await Promise.all([
      executeStatement(
        `SELECT COUNT(*) as count FROM implicit_feedback_signals WHERE tenant_id = $1::uuid AND created_at >= $2`,
        [stringParam('tenantId', tenantId), stringParam('start', periodStart.toISOString())]
      ),
      executeStatement(
        `SELECT COUNT(*) as count FROM negative_learning_candidates WHERE tenant_id = $1::uuid AND created_at >= $2`,
        [stringParam('tenantId', tenantId), stringParam('start', periodStart.toISOString())]
      ),
      executeStatement(
        `SELECT COUNT(*) as count FROM learning_candidates WHERE tenant_id = $1::uuid AND created_at >= $2 AND signal_type = 'positive'`,
        [stringParam('tenantId', tenantId), stringParam('start', periodStart.toISOString())]
      ),
      executeStatement(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE user_responded = true) as responded
         FROM active_learning_requests WHERE tenant_id = $1::uuid AND created_at >= $2`,
        [stringParam('tenantId', tenantId), stringParam('start', periodStart.toISOString())]
      ),
      executeStatement(
        `SELECT SUM(cache_hits) as hits, SUM(cache_misses) as misses, COUNT(*) as total FROM successful_pattern_cache WHERE tenant_id = $1::uuid`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           SUM(candidates_used) as candidates_used
         FROM training_jobs WHERE tenant_id = $1::uuid AND created_at >= $2`,
        [stringParam('tenantId', tenantId), stringParam('start', periodStart.toISOString())]
      ),
    ]);
    
    const activeTotal = Number(active.rows?.[0]?.total || 0);
    const activeResponded = Number(active.rows?.[0]?.responded || 0);
    const cacheHits = Number(cache.rows?.[0]?.hits || 0);
    const cacheMisses = Number(cache.rows?.[0]?.misses || 0);
    const cacheTotal = cacheHits + cacheMisses;
    
    return {
      tenantId,
      periodStart,
      periodEnd: new Date(),
      positiveCandidatesCreated: Number(positive.rows?.[0]?.count || 0),
      negativeCandidatesCreated: Number(negative.rows?.[0]?.count || 0),
      implicitSignalsCaptured: Number(signals.rows?.[0]?.count || 0),
      activeLearningRequestsSent: activeTotal,
      activeLearningResponsesReceived: activeResponded,
      activeLearningResponseRate: activeTotal > 0 ? activeResponded / activeTotal : 0,
      patternCacheHits: cacheHits,
      patternCacheMisses: cacheMisses,
      patternCacheHitRate: cacheTotal > 0 ? cacheHits / cacheTotal : 0,
      trainingJobsCompleted: Number(training.rows?.[0]?.completed || 0),
      candidatesUsedInTraining: Number(training.rows?.[0]?.candidates_used || 0),
    };
  }
  
  // ==========================================================================
  // 8. Optimal Training Time Prediction
  // ==========================================================================
  
  async predictOptimalTrainingTime(tenantId: string): Promise<{
    optimalHourUtc: number;
    optimalDayOfWeek: number; // -1 = any day
    activityScore: number;
    confidence: number;
    recommendation: string;
  }> {
    const result = await executeStatement(
      `SELECT * FROM predict_optimal_training_time($1::uuid)`,
      [stringParam('tenantId', tenantId)]
    );
    
    if (!result.rows?.length) {
      return {
        optimalHourUtc: 3,
        optimalDayOfWeek: -1,
        activityScore: 0,
        confidence: 0.1,
        recommendation: 'No data available. Using default 3 AM UTC.',
      };
    }
    
    const row = result.rows[0];
    return {
      optimalHourUtc: Number(row.optimal_hour_utc || 3),
      optimalDayOfWeek: Number(row.optimal_day_of_week ?? -1),
      activityScore: Number(row.activity_score || 0),
      confidence: Number(row.confidence || 0.1),
      recommendation: String(row.recommendation || ''),
    };
  }
  
  async recordActivityForOptimalTime(
    tenantId: string,
    hourUtc: number,
    dayOfWeek: number,
    requests: number,
    tokens: number,
    activeUsers: number
  ): Promise<void> {
    await executeStatement(
      `SELECT update_hourly_activity_stats($1::uuid, $2, $3, $4, $5::bigint, $6)`,
      [
        stringParam('tenantId', tenantId),
        longParam('hourUtc', hourUtc),
        longParam('dayOfWeek', dayOfWeek),
        longParam('requests', requests),
        longParam('tokens', tokens),
        longParam('activeUsers', activeUsers),
      ]
    );
  }
  
  async getEffectiveTrainingTime(tenantId: string): Promise<{
    hourUtc: number;
    dayOfWeek: number | null;
    isAutoOptimal: boolean;
    confidence?: number;
    recommendation?: string;
  }> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      return { hourUtc: 3, dayOfWeek: null, isAutoOptimal: true };
    }
    
    // If admin has set a specific time, use it
    if (!config.autoOptimalTime && config.trainingHourUtc !== null) {
      return {
        hourUtc: config.trainingHourUtc,
        dayOfWeek: config.trainingDayOfWeek,
        isAutoOptimal: false,
      };
    }
    
    // Otherwise, predict optimal time
    const prediction = await this.predictOptimalTrainingTime(tenantId);
    return {
      hourUtc: prediction.optimalHourUtc,
      dayOfWeek: prediction.optimalDayOfWeek === -1 ? null : prediction.optimalDayOfWeek,
      isAutoOptimal: true,
      confidence: prediction.confidence,
      recommendation: prediction.recommendation,
    };
  }
  
  async getHourlyActivityStats(tenantId: string): Promise<Array<{
    hourUtc: number;
    dayOfWeek: number;
    avgRequestsPerHour: number;
    activityScore: number;
    isLowActivityWindow: boolean;
  }>> {
    const result = await executeStatement(
      `SELECT * FROM hourly_activity_stats WHERE tenant_id = $1::uuid ORDER BY hour_utc, day_of_week`,
      [stringParam('tenantId', tenantId)]
    );
    
    return (result.rows || []).map(row => ({
      hourUtc: Number(row.hour_utc),
      dayOfWeek: Number(row.day_of_week),
      avgRequestsPerHour: Number(row.avg_requests_per_hour || 0),
      activityScore: Number(row.activity_score || 0),
      isLowActivityWindow: row.is_low_activity_window === true,
    }));
  }
  
  // ==========================================================================
  // Mapping Functions
  // ==========================================================================
  
  private mapConfig(row: Record<string, unknown>): EnhancedLearningConfig {
    return {
      tenantId: String(row.tenant_id || ''),
      minCandidatesForTraining: Number(row.min_candidates_for_training || 25),
      minPositiveCandidates: Number(row.min_positive_candidates || 15),
      minNegativeCandidates: Number(row.min_negative_candidates || 5),
      trainingFrequency: (row.training_frequency as EnhancedLearningConfig['trainingFrequency']) || 'daily',
      trainingDayOfWeek: Number(row.training_day_of_week || 0),
      trainingHourUtc: row.training_hour_utc !== null ? Number(row.training_hour_utc) : null,
      autoOptimalTime: row.auto_optimal_time !== false,
      optimalTimeLastCalculated: row.optimal_time_last_calculated ? new Date(row.optimal_time_last_calculated as string) : undefined,
      optimalTimeConfidence: row.optimal_time_confidence ? Number(row.optimal_time_confidence) : undefined,
      implicitFeedbackEnabled: row.implicit_feedback_enabled === true,
      negativeLearningEnabled: row.negative_learning_enabled === true,
      activeLearningEnabled: row.active_learning_enabled === true,
      domainAdaptersEnabled: row.domain_adapters_enabled === true,
      patternCachingEnabled: row.pattern_caching_enabled === true,
      conversationLearningEnabled: row.conversation_learning_enabled === true,
      copySignalWeight: Number(row.copy_signal_weight || 0.80),
      followupSignalWeight: Number(row.followup_signal_weight || 0.30),
      abandonSignalWeight: Number(row.abandon_signal_weight || 0.70),
      rephraseSignalWeight: Number(row.rephrase_signal_weight || 0.50),
      dwellTimeThresholdSeconds: Number(row.dwell_time_threshold_seconds || 30),
      activeLearningProbability: Number(row.active_learning_probability || 0.15),
      activeLearningUncertaintyThreshold: Number(row.active_learning_uncertainty_threshold || 0.60),
      patternCacheTtlHours: Number(row.pattern_cache_ttl_hours || 168),
      patternCacheMinOccurrences: Number(row.pattern_cache_min_occurrences || 3),
      patternCacheMinRating: Number(row.pattern_cache_min_rating || 4.5),
      patternCacheConfidenceThreshold: Number(row.pattern_cache_confidence_threshold || 0.8),
      perUserLearningEnabled: row.per_user_learning_enabled === true,
      adapterAutoSelectionEnabled: row.adapter_auto_selection_enabled === true,
      adapterRollbackEnabled: row.adapter_rollback_enabled === true,
      adapterRollbackThreshold: Number(row.adapter_rollback_threshold || 10),
      redisCacheEnabled: row.redis_cache_enabled === true,
    };
  }
  
  private mapImplicitSignal(row: Record<string, unknown>): ImplicitFeedbackSignal {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: String(row.user_id || ''),
      messageId: String(row.message_id || ''),
      conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
      signalType: row.signal_type as ImplicitSignalType,
      signalValue: row.signal_value ? Number(row.signal_value) : undefined,
      inferredQuality: Number(row.inferred_quality || 0),
      confidence: Number(row.confidence || 0.7),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata as Record<string, unknown>,
      createdAt: new Date(row.created_at as string),
    };
  }
  
  private mapNegativeCandidate(row: Record<string, unknown>): NegativeLearningCandidate {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: String(row.user_id || ''),
      prompt: String(row.prompt || ''),
      response: String(row.response || ''),
      domain: row.domain ? String(row.domain) : undefined,
      rating: row.rating ? Number(row.rating) : undefined,
      negativeSignals: Array.isArray(row.negative_signals) ? row.negative_signals : [],
      userFeedback: row.user_feedback ? String(row.user_feedback) : undefined,
      correctedResponse: row.corrected_response ? String(row.corrected_response) : undefined,
      errorCategory: row.error_category as ErrorCategory | undefined,
      status: (row.status as NegativeLearningCandidate['status']) || 'pending',
      qualityScore: Number(row.quality_score || 0.5),
      createdAt: new Date(row.created_at as string),
    };
  }
  
  private mapActiveLearningRequest(row: Record<string, unknown>): ActiveLearningRequest {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: String(row.user_id || ''),
      messageId: String(row.message_id || ''),
      conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
      requestReason: row.request_reason as ActiveLearningRequestReason,
      requestType: row.request_type as ActiveLearningRequestType,
      promptShown: String(row.prompt_shown || ''),
      userResponded: row.user_responded === true,
      userResponse: typeof row.user_response === 'string' ? JSON.parse(row.user_response) : row.user_response as Record<string, unknown>,
      modelConfidence: row.model_confidence ? Number(row.model_confidence) : undefined,
      uncertaintyScore: row.uncertainty_score ? Number(row.uncertainty_score) : undefined,
      createdAt: new Date(row.created_at as string),
      expiresAt: new Date(row.expires_at as string),
    };
  }
  
  private mapDomainAdapter(row: Record<string, unknown>): DomainLoraAdapter {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      domain: String(row.domain || ''),
      subdomain: row.subdomain ? String(row.subdomain) : undefined,
      adapterName: String(row.adapter_name || ''),
      baseModel: String(row.base_model || ''),
      adapterVersion: Number(row.adapter_version || 1),
      s3Bucket: String(row.s3_bucket || ''),
      s3Key: String(row.s3_key || ''),
      adapterSizeBytes: row.adapter_size_bytes ? Number(row.adapter_size_bytes) : undefined,
      trainingCandidatesCount: Number(row.training_candidates_count || 0),
      lastTrainedAt: row.last_trained_at ? new Date(row.last_trained_at as string) : undefined,
      accuracyScore: row.accuracy_score ? Number(row.accuracy_score) : undefined,
      domainRelevanceScore: row.domain_relevance_score ? Number(row.domain_relevance_score) : undefined,
      userSatisfactionScore: row.user_satisfaction_score ? Number(row.user_satisfaction_score) : undefined,
      status: (row.status as DomainLoraAdapter['status']) || 'training',
      isDefault: row.is_default === true,
    };
  }
  
  private mapPatternCache(row: Record<string, unknown>): PatternCacheEntry {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      promptHash: String(row.prompt_hash || ''),
      domain: row.domain ? String(row.domain) : undefined,
      normalizedPrompt: String(row.normalized_prompt || ''),
      successfulResponse: String(row.successful_response || ''),
      responseMetadata: typeof row.response_metadata === 'string' ? JSON.parse(row.response_metadata) : row.response_metadata as Record<string, unknown>,
      averageRating: Number(row.average_rating || 0),
      occurrenceCount: Number(row.occurrence_count || 1),
      positiveSignalCount: Number(row.positive_signal_count || 0),
      modelUsed: row.model_used ? String(row.model_used) : undefined,
      temperatureUsed: row.temperature_used ? Number(row.temperature_used) : undefined,
      lastUsedAt: new Date(row.last_used_at as string),
      expiresAt: new Date(row.expires_at as string),
      cacheHits: Number(row.cache_hits || 0),
    };
  }
  
  private mapConversationLearning(row: Record<string, unknown>): ConversationLearning {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: String(row.user_id || ''),
      conversationId: String(row.conversation_id || ''),
      messageCount: Number(row.message_count || 0),
      domainsDiscussed: Array.isArray(row.domains_discussed) ? row.domains_discussed : [],
      conversationRating: row.conversation_rating ? Number(row.conversation_rating) : undefined,
      goalAchieved: row.goal_achieved === true,
      userSatisfactionInferred: Number(row.user_satisfaction_inferred || 0),
      positiveSignalsCount: Number(row.positive_signals_count || 0),
      negativeSignalsCount: Number(row.negative_signals_count || 0),
      correctionsCount: Number(row.corrections_count || 0),
      regenerationsCount: Number(row.regenerations_count || 0),
      learningValueScore: Number(row.learning_value_score || 0.5),
      selectedForTraining: row.selected_for_training === true,
      bestInteractionIds: Array.isArray(row.best_interaction_ids) ? row.best_interaction_ids : [],
      worstInteractionIds: Array.isArray(row.worst_interaction_ids) ? row.worst_interaction_ids : [],
    };
  }
}

export const enhancedLearningService = new EnhancedLearningService();
