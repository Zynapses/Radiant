// RADIANT v4.18.55 - File Conversion Learning Service
// Reinforcement learning for AGI Brain format understanding
// Learns from conversion outcomes to improve future decisions

import { executeStatement, stringParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface FormatUnderstanding {
  id: string;
  tenantId: string;
  modelId: string;
  providerId: string;
  fileFormat: string;
  understandingScore: number;  // 0.0 to 1.0
  confidence: number;          // 0.0 to 1.0
  successCount: number;
  failureCount: number;
  totalAttempts: number;
  forceConvert: boolean;
  forceConvertReason?: string;
  updatedAt: Date;
}

export interface ConversionOutcomeFeedback {
  tenantId: string;
  userId: string;
  conversionId: string;
  conversationId?: string;
  modelId: string;
  providerId: string;
  filename: string;
  fileFormat: string;
  fileSize?: number;
  actionTaken: 'pass_original' | 'convert' | 'skip';
  conversionStrategy?: string;
  outcome: 'success' | 'partial' | 'failure' | 'unknown';
  outcomeSource: 'user_feedback' | 'model_response' | 'error_detection' | 'auto_inferred';
  userRating?: number;        // 1-5
  userFeedback?: string;
  modelUnderstood?: boolean;
  modelHallucinated?: boolean;
  modelAskedForClarification?: boolean;
  modelMentionedFormatIssues?: boolean;
  errorType?: string;
  errorMessage?: string;
}

export interface FormatRecommendation {
  shouldConvert: boolean;
  understandingScore: number;
  confidence: number;
  reason: string;
  totalAttempts: number;
  source: 'tenant_learning' | 'global_learning' | 'default';
}

export interface LearningStats {
  totalFeedback: number;
  formatsLearned: number;
  modelsTracked: number;
  averageUnderstanding: number;
  recentImprovements: number;
}

// ============================================================================
// Service
// ============================================================================

class FileConversionLearningService {
  
  // Understanding score threshold - below this, we recommend conversion
  private readonly UNDERSTANDING_THRESHOLD = 0.7;
  
  // Weight for new feedback (exponential moving average)
  private readonly LEARNING_RATE = 0.15;

  // ============================================================================
  // Core Learning Functions
  // ============================================================================

  /**
   * Record outcome feedback and update format understanding
   * This is the main entry point for reinforcement learning
   */
  async recordOutcomeFeedback(feedback: ConversionOutcomeFeedback): Promise<{
    feedbackId: string;
    understandingUpdated: boolean;
    newUnderstandingScore?: number;
    learningCandidateCreated?: boolean;
  }> {
    const feedbackId = uuidv4();

    // Record the feedback
    await executeStatement(`
      INSERT INTO conversion_outcome_feedback (
        id, tenant_id, user_id, conversion_id, conversation_id,
        model_id, provider_id, filename, file_format, file_size,
        action_taken, conversion_strategy, outcome, outcome_source,
        user_rating, user_feedback, model_understood, model_hallucinated,
        model_asked_for_clarification, model_mentioned_format_issues,
        error_type, error_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22
      )
      ON CONFLICT (conversion_id, model_id) DO UPDATE SET
        outcome = EXCLUDED.outcome,
        outcome_source = EXCLUDED.outcome_source,
        user_rating = COALESCE(EXCLUDED.user_rating, conversion_outcome_feedback.user_rating),
        user_feedback = COALESCE(EXCLUDED.user_feedback, conversion_outcome_feedback.user_feedback),
        model_understood = COALESCE(EXCLUDED.model_understood, conversion_outcome_feedback.model_understood)
    `, [
      stringParam(feedbackId),
      stringParam(feedback.tenantId),
      stringParam(feedback.userId),
      stringParam(feedback.conversionId),
      stringParam(feedback.conversationId || ''),
      stringParam(feedback.modelId),
      stringParam(feedback.providerId),
      stringParam(feedback.filename),
      stringParam(feedback.fileFormat),
      { name: 'file_size', value: { longValue: feedback.fileSize || 0 } },
      stringParam(feedback.actionTaken),
      stringParam(feedback.conversionStrategy || ''),
      stringParam(feedback.outcome),
      stringParam(feedback.outcomeSource),
      { name: 'user_rating', value: feedback.userRating ? { longValue: feedback.userRating } : { isNull: true } },
      stringParam(feedback.userFeedback || ''),
      { name: 'model_understood', value: feedback.modelUnderstood !== undefined ? { booleanValue: feedback.modelUnderstood } : { isNull: true } },
      { name: 'model_hallucinated', value: feedback.modelHallucinated !== undefined ? { booleanValue: feedback.modelHallucinated } : { isNull: true } },
      { name: 'model_asked_for_clarification', value: feedback.modelAskedForClarification !== undefined ? { booleanValue: feedback.modelAskedForClarification } : { isNull: true } },
      { name: 'model_mentioned_format_issues', value: feedback.modelMentionedFormatIssues !== undefined ? { booleanValue: feedback.modelMentionedFormatIssues } : { isNull: true } },
      stringParam(feedback.errorType || ''),
      stringParam(feedback.errorMessage || ''),
    ]);

    // Update format understanding if we have a clear outcome
    let understandingUpdated = false;
    let newUnderstandingScore: number | undefined;

    if (feedback.outcome !== 'unknown') {
      const result = await this.updateFormatUnderstanding(
        feedback.tenantId,
        feedback.modelId,
        feedback.providerId,
        feedback.fileFormat,
        feedback.outcome
      );
      understandingUpdated = true;
      newUnderstandingScore = result.understandingScore;
    }

    // Check if this should create a learning candidate for consciousness
    let learningCandidateCreated = false;
    if (this.shouldCreateLearningCandidate(feedback)) {
      await this.createLearningCandidate(feedback, feedbackId);
      learningCandidateCreated = true;
    }

    return {
      feedbackId,
      understandingUpdated,
      newUnderstandingScore,
      learningCandidateCreated,
    };
  }

  /**
   * Update format understanding based on outcome
   * Uses exponential moving average for smooth learning
   */
  async updateFormatUnderstanding(
    tenantId: string,
    modelId: string,
    providerId: string,
    fileFormat: string,
    outcome: 'success' | 'partial' | 'failure'
  ): Promise<FormatUnderstanding> {
    const result = await executeStatement(`
      SELECT * FROM update_format_understanding($1, $2, $3, $4, $5, $6)
    `, [
      stringParam(tenantId),
      stringParam(modelId),
      stringParam(providerId),
      stringParam(fileFormat),
      stringParam(outcome),
      { name: 'weight', value: { doubleValue: this.LEARNING_RATE } },
    ]);

    const record = result.records?.[0];
    return this.mapToFormatUnderstanding(record);
  }

  /**
   * Get recommendation on whether to convert a format for a model
   * Uses learned understanding from this tenant + global learning
   */
  async getFormatRecommendation(
    tenantId: string,
    modelId: string,
    fileFormat: string
  ): Promise<FormatRecommendation> {
    const result = await executeStatement(`
      SELECT * FROM get_format_recommendation($1, $2, $3, $4)
    `, [
      stringParam(tenantId),
      stringParam(modelId),
      stringParam(fileFormat),
      { name: 'threshold', value: { doubleValue: this.UNDERSTANDING_THRESHOLD } },
    ]);

    const record = result.records?.[0];
    
    if (!record) {
      return {
        shouldConvert: false,
        understandingScore: 0.5,
        confidence: 0,
        reason: 'No data available',
        totalAttempts: 0,
        source: 'default',
      };
    }

    const reason = record[3]?.stringValue || '';
    
    return {
      shouldConvert: record[0]?.booleanValue || false,
      understandingScore: parseFloat(record[1]?.stringValue || '0.5'),
      confidence: parseFloat(record[2]?.stringValue || '0'),
      reason,
      totalAttempts: parseInt(record[4]?.longValue || record[4]?.stringValue || '0'),
      source: reason.includes('global') ? 'global_learning' : 
              reason.includes('No learning') ? 'default' : 'tenant_learning',
    };
  }

  // ============================================================================
  // Admin Functions
  // ============================================================================

  /**
   * Force conversion for a model/format combination
   * Used when admin knows the model struggles despite metrics
   */
  async setForceConvert(
    tenantId: string,
    modelId: string,
    fileFormat: string,
    reason: string,
    setBy: string
  ): Promise<void> {
    await executeStatement(`
      INSERT INTO model_format_understanding (
        tenant_id, model_id, provider_id, file_format,
        force_convert, force_convert_reason, force_convert_set_at, force_convert_set_by
      ) VALUES ($1, $2, 'unknown', $3, true, $4, NOW(), $5)
      ON CONFLICT (tenant_id, model_id, file_format) DO UPDATE SET
        force_convert = true,
        force_convert_reason = $4,
        force_convert_set_at = NOW(),
        force_convert_set_by = $5,
        updated_at = NOW()
    `, [
      stringParam(tenantId),
      stringParam(modelId),
      stringParam(fileFormat),
      stringParam(reason),
      stringParam(setBy),
    ]);
  }

  /**
   * Clear force convert override
   */
  async clearForceConvert(
    tenantId: string,
    modelId: string,
    fileFormat: string
  ): Promise<void> {
    await executeStatement(`
      UPDATE model_format_understanding
      SET force_convert = false,
          force_convert_reason = NULL,
          force_convert_set_at = NULL,
          force_convert_set_by = NULL,
          updated_at = NOW()
      WHERE tenant_id = $1 AND model_id = $2 AND file_format = $3
    `, [
      stringParam(tenantId),
      stringParam(modelId),
      stringParam(fileFormat),
    ]);
  }

  /**
   * Get format understanding for a tenant
   */
  async getFormatUnderstandings(
    tenantId: string,
    options?: {
      modelId?: string;
      fileFormat?: string;
      minConfidence?: number;
      limit?: number;
    }
  ): Promise<FormatUnderstanding[]> {
    let query = `
      SELECT * FROM model_format_understanding
      WHERE tenant_id = $1
    `;
    const params: any[] = [stringParam(tenantId)];
    let paramIndex = 2;

    if (options?.modelId) {
      query += ` AND model_id = $${paramIndex}`;
      params.push(stringParam(options.modelId));
      paramIndex++;
    }

    if (options?.fileFormat) {
      query += ` AND file_format = $${paramIndex}`;
      params.push(stringParam(options.fileFormat));
      paramIndex++;
    }

    if (options?.minConfidence) {
      query += ` AND confidence >= $${paramIndex}`;
      params.push({ name: 'min_confidence', value: { doubleValue: options.minConfidence } });
      paramIndex++;
    }

    query += ` ORDER BY updated_at DESC`;

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await executeStatement(query, params);
    return (result.records || []).map(r => this.mapToFormatUnderstanding(r));
  }

  /**
   * Get learning statistics for a tenant
   */
  async getLearningStats(tenantId: string): Promise<LearningStats> {
    const result = await executeStatement(`
      SELECT 
        (SELECT COUNT(*) FROM conversion_outcome_feedback WHERE tenant_id = $1) as total_feedback,
        (SELECT COUNT(DISTINCT file_format) FROM model_format_understanding WHERE tenant_id = $1) as formats_learned,
        (SELECT COUNT(DISTINCT model_id) FROM model_format_understanding WHERE tenant_id = $1) as models_tracked,
        (SELECT AVG(understanding_score) FROM model_format_understanding WHERE tenant_id = $1) as avg_understanding,
        (SELECT COUNT(*) FROM format_understanding_events 
         WHERE tenant_id = $1 
         AND event_type = 'score_updated' 
         AND new_score > previous_score 
         AND created_at > NOW() - INTERVAL '7 days') as recent_improvements
    `, [stringParam(tenantId)]);

    const record = result.records?.[0];
    
    return {
      totalFeedback: parseInt(record?.[0]?.longValue || record?.[0]?.stringValue || '0'),
      formatsLearned: parseInt(record?.[1]?.longValue || record?.[1]?.stringValue || '0'),
      modelsTracked: parseInt(record?.[2]?.longValue || record?.[2]?.stringValue || '0'),
      averageUnderstanding: parseFloat(record?.[3]?.stringValue || '0.5'),
      recentImprovements: parseInt(record?.[4]?.longValue || record?.[4]?.stringValue || '0'),
    };
  }

  // ============================================================================
  // Inference Functions (for response analysis)
  // ============================================================================

  /**
   * Infer outcome from model response
   * Analyzes the response to detect if model understood the file
   */
  inferOutcomeFromResponse(
    response: string,
    fileFormat: string
  ): {
    outcome: 'success' | 'partial' | 'failure' | 'unknown';
    modelUnderstood: boolean | undefined;
    modelMentionedFormatIssues: boolean;
    confidence: number;
  } {
    const lowerResponse = response.toLowerCase();
    
    // Signals that model didn't understand
    const failureSignals = [
      "i can't read",
      "i cannot read",
      "unable to process",
      "cannot process",
      "can't process",
      "don't have access to the file",
      "cannot access the file",
      "i'm not able to view",
      "cannot view the",
      "can't see the content",
      "cannot see the content",
      "appears to be empty",
      "no content",
      "binary data",
      "encoded content",
      "base64",
      "i cannot interpret",
      "unable to interpret",
    ];

    // Signals that model is uncertain
    const uncertainSignals = [
      "i'm not sure",
      "it's unclear",
      "difficult to determine",
      "hard to tell",
      "cannot be certain",
      "may be corrupted",
      "seems to be",
      "appears to be",
      "might be",
    ];

    // Signals of hallucination or format issues
    const formatIssueSignals = [
      "file format",
      "format issue",
      "format problem",
      "unsupported format",
      "unrecognized format",
      "corrupt",
      "malformed",
    ];

    // Check for failure signals
    for (const signal of failureSignals) {
      if (lowerResponse.includes(signal)) {
        return {
          outcome: 'failure',
          modelUnderstood: false,
          modelMentionedFormatIssues: formatIssueSignals.some(s => lowerResponse.includes(s)),
          confidence: 0.8,
        };
      }
    }

    // Check for uncertainty signals
    for (const signal of uncertainSignals) {
      if (lowerResponse.includes(signal)) {
        return {
          outcome: 'partial',
          modelUnderstood: undefined,
          modelMentionedFormatIssues: formatIssueSignals.some(s => lowerResponse.includes(s)),
          confidence: 0.5,
        };
      }
    }

    // If response is very short, might indicate failure
    if (response.length < 50) {
      return {
        outcome: 'unknown',
        modelUnderstood: undefined,
        modelMentionedFormatIssues: false,
        confidence: 0.3,
      };
    }

    // If response mentions specific content from the file, likely success
    // This is a heuristic - actual implementation might use more sophisticated analysis
    const hasSpecificContent = response.length > 200 && 
      !lowerResponse.includes("i cannot") &&
      !lowerResponse.includes("i can't");

    if (hasSpecificContent) {
      return {
        outcome: 'success',
        modelUnderstood: true,
        modelMentionedFormatIssues: false,
        confidence: 0.7,
      };
    }

    return {
      outcome: 'unknown',
      modelUnderstood: undefined,
      modelMentionedFormatIssues: formatIssueSignals.some(s => lowerResponse.includes(s)),
      confidence: 0.3,
    };
  }

  // ============================================================================
  // Integration with Consciousness/Learning System
  // ============================================================================

  /**
   * Determine if feedback should create a learning candidate
   * for the consciousness/predictive coding system
   */
  private shouldCreateLearningCandidate(feedback: ConversionOutcomeFeedback): boolean {
    // Create learning candidate for significant events:
    // 1. User explicitly provided negative feedback
    if (feedback.userRating && feedback.userRating <= 2) return true;
    
    // 2. Model failed on a format we thought it supported
    if (feedback.outcome === 'failure' && feedback.actionTaken === 'pass_original') return true;
    
    // 3. Model succeeded on a format we didn't think it supported
    if (feedback.outcome === 'success' && feedback.actionTaken === 'convert') return true;
    
    // 4. Model hallucinated content
    if (feedback.modelHallucinated) return true;
    
    // 5. User provided explicit feedback
    if (feedback.userFeedback && feedback.userFeedback.length > 20) return true;
    
    return false;
  }

  /**
   * Create a learning candidate for the consciousness system
   */
  private async createLearningCandidate(
    feedback: ConversionOutcomeFeedback,
    feedbackId: string
  ): Promise<string | null> {
    try {
      const candidateId = uuidv4();
      
      // Determine learning type based on what happened
      let learningType: string;
      let quality: number;
      
      if (feedback.outcome === 'failure' && feedback.actionTaken === 'pass_original') {
        learningType = 'format_misunderstanding';
        quality = 0.85;
      } else if (feedback.outcome === 'success' && feedback.actionTaken === 'convert') {
        learningType = 'unnecessary_conversion';
        quality = 0.7;
      } else if (feedback.modelHallucinated) {
        learningType = 'hallucination_detection';
        quality = 0.9;
      } else if (feedback.userRating && feedback.userRating <= 2) {
        learningType = 'user_correction';
        quality = 0.85;
      } else {
        learningType = 'format_feedback';
        quality = 0.6;
      }

      // Insert learning candidate
      await executeStatement(`
        INSERT INTO learning_candidates (
          id, tenant_id, user_id, conversation_id,
          candidate_type, quality_score, context,
          source_type, source_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        stringParam(candidateId),
        stringParam(feedback.tenantId),
        stringParam(feedback.userId),
        stringParam(feedback.conversationId || ''),
        stringParam(learningType),
        { name: 'quality_score', value: { doubleValue: quality } },
        stringParam(JSON.stringify({
          modelId: feedback.modelId,
          providerId: feedback.providerId,
          fileFormat: feedback.fileFormat,
          filename: feedback.filename,
          actionTaken: feedback.actionTaken,
          outcome: feedback.outcome,
          userRating: feedback.userRating,
          userFeedback: feedback.userFeedback,
          modelUnderstood: feedback.modelUnderstood,
          modelHallucinated: feedback.modelHallucinated,
        })),
        stringParam('file_conversion_feedback'),
        stringParam(feedbackId),
      ]);

      // Update feedback record with learning candidate ID
      await executeStatement(`
        UPDATE conversion_outcome_feedback
        SET learning_candidate_id = $1
        WHERE id = $2
      `, [
        stringParam(candidateId),
        stringParam(feedbackId),
      ]);

      return candidateId;
    } catch (error) {
      // Don't fail the main operation if learning candidate creation fails
      logger.error('Failed to create learning candidate', error as Error);
      return null;
    }
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  private mapToFormatUnderstanding(record: any): FormatUnderstanding {
    if (!record) {
      return {
        id: '',
        tenantId: '',
        modelId: '',
        providerId: '',
        fileFormat: '',
        understandingScore: 0.5,
        confidence: 0,
        successCount: 0,
        failureCount: 0,
        totalAttempts: 0,
        forceConvert: false,
        updatedAt: new Date(),
      };
    }

    // Handle array format (from function return) or object format (from table select)
    const getValue = (index: number, key: string) => {
      if (Array.isArray(record)) {
        return record[index];
      }
      return record[key];
    };

    return {
      id: getValue(0, 'id')?.stringValue || '',
      tenantId: getValue(1, 'tenant_id')?.stringValue || '',
      modelId: getValue(2, 'model_id')?.stringValue || '',
      providerId: getValue(3, 'provider_id')?.stringValue || '',
      fileFormat: getValue(4, 'file_format')?.stringValue || '',
      understandingScore: parseFloat(getValue(5, 'understanding_score')?.stringValue || '0.5'),
      confidence: parseFloat(getValue(6, 'confidence')?.stringValue || '0'),
      successCount: parseInt(getValue(7, 'success_count')?.longValue || getValue(7, 'success_count')?.stringValue || '0'),
      failureCount: parseInt(getValue(8, 'failure_count')?.longValue || getValue(8, 'failure_count')?.stringValue || '0'),
      totalAttempts: parseInt(getValue(9, 'total_attempts')?.longValue || getValue(9, 'total_attempts')?.stringValue || '0'),
      forceConvert: getValue(10, 'force_convert')?.booleanValue || false,
      forceConvertReason: getValue(11, 'force_convert_reason')?.stringValue,
      updatedAt: new Date(getValue(14, 'updated_at')?.stringValue || Date.now()),
    };
  }
}

// ============================================================================
// Export singleton
// ============================================================================

export const fileConversionLearningService = new FileConversionLearningService();
