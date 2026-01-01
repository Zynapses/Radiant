// RADIANT v4.18.19 - Bipolar Rating Service
// Novel rating system allowing negative ratings (-5 to +5)
// Integrates with learning candidates for LoRA training

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { learningCandidateService } from './distillation-pipeline.service';
import type {
  BipolarRating,
  BipolarRatingInput,
  BipolarRatingValue,
  RatingAnalytics,
  ModelRatingAnalytics,
  UserRatingPattern,
  RatingDimension,
  RatingReason,
  QuickRating,
  getSentiment,
  getIntensity,
  calculateNetSentimentScore,
  QUICK_RATING_VALUES,
} from '@radiant/shared';

// ============================================================================
// Types
// ============================================================================

interface RatingSubmitResult {
  ratingId: string;
  value: BipolarRatingValue;
  sentiment: 'negative' | 'neutral' | 'positive';
  intensity: 'extreme' | 'strong' | 'mild' | 'neutral';
  learningCandidateCreated: boolean;
}

interface RatingDashboard {
  analytics: RatingAnalytics;
  recentRatings: BipolarRating[];
  modelPerformance: ModelRatingAnalytics[];
  topIssues: Array<{ reason: RatingReason; count: number; avgRating: number }>;
  topPraises: Array<{ reason: RatingReason; count: number; avgRating: number }>;
}

// ============================================================================
// Bipolar Rating Service
// ============================================================================

class BipolarRatingService {
  
  // ==========================================================================
  // Submit Ratings
  // ==========================================================================
  
  /**
   * Submit a bipolar rating (-5 to +5)
   */
  async submitRating(
    tenantId: string,
    userId: string,
    input: BipolarRatingInput
  ): Promise<RatingSubmitResult> {
    const { targetType, targetId, value, dimension = 'overall', reasons = [], feedback } = input;
    
    // Validate value
    if (value < -5 || value > 5) {
      throw new Error('Rating value must be between -5 and +5');
    }
    
    // Compute derived fields
    const sentiment = this.getSentiment(value);
    const intensity = this.getIntensity(value);
    
    // Submit to database
    const result = await executeStatement(
      `SELECT submit_bipolar_rating($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) as rating_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'targetType', value: { stringValue: targetType } },
        { name: 'targetId', value: { stringValue: targetId } },
        { name: 'value', value: { longValue: value } },
        { name: 'dimension', value: { stringValue: dimension } },
        { name: 'reasons', value: { stringValue: JSON.stringify(reasons) } },
        { name: 'feedback', value: { stringValue: feedback || '' } },
        { name: 'conversationId', value: { stringValue: input.conversationId || '' } },
        { name: 'sessionId', value: { stringValue: input.sessionId || '' } },
        { name: 'modelUsed', value: { stringValue: '' } },
        { name: 'domainDetected', value: { stringValue: '' } },
        { name: 'promptComplexity', value: { stringValue: '' } },
        { name: 'responseTimeMs', value: { longValue: 0 } },
      ]
    );
    
    const ratingId = String(result.rows[0]?.rating_id || '');
    
    // Create learning candidate for extreme ratings
    let learningCandidateCreated = false;
    if (Math.abs(value) >= 4) {
      learningCandidateCreated = await this.createLearningCandidate(
        tenantId,
        userId,
        targetId,
        value,
        reasons,
        feedback
      );
    }
    
    logger.info('Bipolar rating submitted', {
      tenantId,
      ratingId,
      value,
      sentiment,
      intensity,
      learningCandidateCreated,
    });
    
    return {
      ratingId,
      value,
      sentiment,
      intensity,
      learningCandidateCreated,
    };
  }
  
  /**
   * Submit a quick rating (terrible/bad/meh/good/amazing)
   */
  async submitQuickRating(
    tenantId: string,
    userId: string,
    targetType: BipolarRating['targetType'],
    targetId: string,
    quickRating: QuickRating,
    conversationId?: string
  ): Promise<RatingSubmitResult> {
    const value = this.quickRatingToBipolar(quickRating);
    
    return this.submitRating(tenantId, userId, {
      targetType,
      targetId,
      value,
      dimension: 'overall',
      conversationId,
    });
  }
  
  /**
   * Submit multi-dimension rating
   */
  async submitMultiDimensionRating(
    tenantId: string,
    userId: string,
    targetType: BipolarRating['targetType'],
    targetId: string,
    ratings: Partial<Record<RatingDimension, BipolarRatingValue>>,
    reasons?: RatingReason[],
    feedback?: string,
    conversationId?: string
  ): Promise<RatingSubmitResult[]> {
    const results: RatingSubmitResult[] = [];
    
    for (const [dimension, value] of Object.entries(ratings)) {
      if (value !== undefined) {
        const result = await this.submitRating(tenantId, userId, {
          targetType,
          targetId,
          value,
          dimension: dimension as RatingDimension,
          reasons,
          feedback,
          conversationId,
        });
        results.push(result);
      }
    }
    
    return results;
  }
  
  // ==========================================================================
  // Retrieve Ratings
  // ==========================================================================
  
  /**
   * Get rating for a specific target
   */
  async getRating(
    tenantId: string,
    userId: string,
    targetId: string,
    dimension: RatingDimension = 'overall'
  ): Promise<BipolarRating | null> {
    const result = await executeStatement(
      `SELECT * FROM bipolar_ratings 
       WHERE tenant_id = $1 AND user_id = $2 AND target_id = $3 AND dimension = $4`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'targetId', value: { stringValue: targetId } },
        { name: 'dimension', value: { stringValue: dimension } },
      ]
    );
    
    if (result.rows.length === 0) return null;
    return this.mapRating(result.rows[0] as Record<string, unknown>);
  }
  
  /**
   * Get all ratings for a target
   */
  async getRatingsForTarget(
    tenantId: string,
    targetId: string
  ): Promise<BipolarRating[]> {
    const result = await executeStatement(
      `SELECT * FROM bipolar_ratings 
       WHERE tenant_id = $1 AND target_id = $2
       ORDER BY created_at DESC`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'targetId', value: { stringValue: targetId } },
      ]
    );
    
    return result.rows.map(row => this.mapRating(row as Record<string, unknown>));
  }
  
  /**
   * Get user's recent ratings
   */
  async getUserRatings(
    tenantId: string,
    userId: string,
    limit: number = 50
  ): Promise<BipolarRating[]> {
    const result = await executeStatement(
      `SELECT * FROM bipolar_ratings 
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    
    return result.rows.map(row => this.mapRating(row as Record<string, unknown>));
  }
  
  // ==========================================================================
  // Analytics
  // ==========================================================================
  
  /**
   * Get rating analytics for tenant
   */
  async getAnalytics(
    tenantId: string,
    period: 'day' | 'week' | 'month' | 'all' = 'month',
    targetType?: string,
    modelId?: string
  ): Promise<RatingAnalytics> {
    const result = await executeStatement(
      `SELECT * FROM get_rating_analytics($1, $2, $3, $4)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'period', value: { stringValue: period } },
        { name: 'targetType', value: { stringValue: targetType || '' } },
        { name: 'modelId', value: { stringValue: modelId || '' } },
      ]
    );
    
    const row = result.rows[0] as Record<string, unknown>;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - (period === 'day' ? 1 : period === 'week' ? 7 : 30));
    
    return {
      tenantId,
      period,
      periodStart: periodStart.toISOString(),
      periodEnd: new Date().toISOString(),
      totalRatings: Number(row.total_ratings) || 0,
      averageRating: Number(row.average_rating) || 0,
      sentimentDistribution: {
        negative: Number(row.negative_count) || 0,
        neutral: Number(row.neutral_count) || 0,
        positive: Number(row.positive_count) || 0,
      },
      netSentimentScore: Number(row.net_sentiment_score) || 0,
      ratingDistribution: typeof row.rating_distribution === 'string'
        ? JSON.parse(row.rating_distribution)
        : (row.rating_distribution as Record<BipolarRatingValue, number>) || {},
      dimensionAverages: {},
      topPositiveReasons: [],
      topNegativeReasons: [],
      trend: 'stable',
      trendPercentage: 0,
    };
  }
  
  /**
   * Get model-specific analytics
   */
  async getModelAnalytics(
    tenantId: string,
    modelId: string,
    period: 'day' | 'week' | 'month' | 'all' = 'month'
  ): Promise<ModelRatingAnalytics> {
    const analytics = await this.getAnalytics(tenantId, period, undefined, modelId);
    
    // Get model rank
    const rankResult = await executeStatement(
      `SELECT COUNT(*) + 1 as rank, 
              (SELECT COUNT(DISTINCT model_used) FROM bipolar_ratings WHERE tenant_id = $1) as total
       FROM model_rating_summary
       WHERE tenant_id = $1 AND average_rating > (
         SELECT average_rating FROM model_rating_summary WHERE tenant_id = $1 AND model_id = $2
       )`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'modelId', value: { stringValue: modelId } },
      ]
    );
    
    const rankRow = rankResult.rows[0] as Record<string, unknown>;
    
    return {
      ...analytics,
      modelId,
      modelName: modelId,
      rankAmongModels: Number(rankRow?.rank) || 1,
      totalModels: Number(rankRow?.total) || 1,
      strengthDimensions: [],
      weaknessDimensions: [],
    };
  }
  
  /**
   * Get user rating pattern
   */
  async getUserRatingPattern(
    tenantId: string,
    userId: string
  ): Promise<UserRatingPattern | null> {
    const result = await executeStatement(
      `SELECT * FROM user_rating_patterns WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0] as Record<string, unknown>;
    return {
      userId,
      averageRating: Number(row.average_rating) || 0,
      ratingVariance: Number(row.rating_variance) || 0,
      totalRatings: Number(row.total_ratings) || 0,
      raterType: (row.rater_type as 'harsh' | 'balanced' | 'generous') || 'balanced',
      calibrationFactor: Number(row.calibration_factor) || 1.0,
    };
  }
  
  /**
   * Get rating dashboard for admin
   */
  async getDashboard(tenantId: string): Promise<RatingDashboard> {
    const [analytics, recentRatings, modelPerformance] = await Promise.all([
      this.getAnalytics(tenantId, 'month'),
      this.getRecentRatings(tenantId, 20),
      this.getModelPerformanceList(tenantId),
    ]);
    
    // Get top issues (negative reasons)
    const issuesResult = await executeStatement(
      `SELECT r.reasons, COUNT(*) as count, AVG(r.value) as avg_rating
       FROM bipolar_ratings r, jsonb_array_elements_text(r.reasons) as reason
       WHERE r.tenant_id = $1 AND r.value < 0
       GROUP BY reason
       ORDER BY count DESC
       LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    // Get top praises (positive reasons)
    const praisesResult = await executeStatement(
      `SELECT r.reasons, COUNT(*) as count, AVG(r.value) as avg_rating
       FROM bipolar_ratings r, jsonb_array_elements_text(r.reasons) as reason
       WHERE r.tenant_id = $1 AND r.value > 0
       GROUP BY reason
       ORDER BY count DESC
       LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    return {
      analytics,
      recentRatings,
      modelPerformance,
      topIssues: issuesResult.rows.map(r => ({
        reason: String((r as Record<string, unknown>).reasons) as RatingReason,
        count: Number((r as Record<string, unknown>).count),
        avgRating: Number((r as Record<string, unknown>).avg_rating),
      })),
      topPraises: praisesResult.rows.map(r => ({
        reason: String((r as Record<string, unknown>).reasons) as RatingReason,
        count: Number((r as Record<string, unknown>).count),
        avgRating: Number((r as Record<string, unknown>).avg_rating),
      })),
    };
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private async getRecentRatings(tenantId: string, limit: number): Promise<BipolarRating[]> {
    const result = await executeStatement(
      `SELECT * FROM bipolar_ratings WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows.map(row => this.mapRating(row as Record<string, unknown>));
  }
  
  private async getModelPerformanceList(tenantId: string): Promise<ModelRatingAnalytics[]> {
    const result = await executeStatement(
      `SELECT DISTINCT model_used FROM bipolar_ratings WHERE tenant_id = $1 AND model_used IS NOT NULL`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const models: ModelRatingAnalytics[] = [];
    for (const row of result.rows) {
      const modelId = String((row as Record<string, unknown>).model_used);
      if (modelId) {
        models.push(await this.getModelAnalytics(tenantId, modelId));
      }
    }
    
    return models.sort((a, b) => b.averageRating - a.averageRating);
  }
  
  private async createLearningCandidate(
    tenantId: string,
    userId: string,
    targetId: string,
    value: BipolarRatingValue,
    reasons: RatingReason[],
    feedback?: string
  ): Promise<boolean> {
    try {
      const candidateType = value >= 4 ? 'high_satisfaction' : 'correction';
      const quality = Math.abs(value) / 5; // 0.8 for ±4, 1.0 for ±5
      
      await learningCandidateService.createCandidate(tenantId, {
        userId,
        conversationId: targetId,
        responseId: targetId,
        candidateType,
        quality,
        reason: feedback || `Rating: ${value}, Reasons: ${reasons.join(', ')}`,
        metadata: {
          ratingValue: value,
          reasons,
          feedback,
        },
      });
      
      return true;
    } catch (error) {
      logger.warn('Failed to create learning candidate from rating', { error });
      return false;
    }
  }
  
  private getSentiment(value: BipolarRatingValue): 'negative' | 'neutral' | 'positive' {
    if (value < 0) return 'negative';
    if (value > 0) return 'positive';
    return 'neutral';
  }
  
  private getIntensity(value: BipolarRatingValue): 'extreme' | 'strong' | 'mild' | 'neutral' {
    const abs = Math.abs(value);
    if (abs === 0) return 'neutral';
    if (abs <= 2) return 'mild';
    if (abs <= 4) return 'strong';
    return 'extreme';
  }
  
  private quickRatingToBipolar(quick: QuickRating): BipolarRatingValue {
    const map: Record<QuickRating, BipolarRatingValue> = {
      terrible: -5,
      bad: -3,
      meh: 0,
      good: 3,
      amazing: 5,
    };
    return map[quick];
  }
  
  private mapRating(row: Record<string, unknown>): BipolarRating {
    return {
      ratingId: String(row.rating_id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: String(row.user_id || ''),
      targetType: row.target_type as BipolarRating['targetType'],
      targetId: String(row.target_id || ''),
      value: Number(row.value) as BipolarRatingValue,
      dimension: (row.dimension as RatingDimension) || 'overall',
      sentiment: row.sentiment as 'negative' | 'neutral' | 'positive',
      intensity: row.intensity as 'extreme' | 'strong' | 'mild' | 'neutral',
      reasons: typeof row.reasons === 'string' ? JSON.parse(row.reasons) : (row.reasons as RatingReason[]) || [],
      feedback: row.feedback ? String(row.feedback) : undefined,
      conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
      sessionId: row.session_id ? String(row.session_id) : undefined,
      modelUsed: row.model_used ? String(row.model_used) : undefined,
      domainDetected: row.domain_detected ? String(row.domain_detected) : undefined,
      promptComplexity: row.prompt_complexity ? String(row.prompt_complexity) : undefined,
      responseTimeMs: row.response_time_ms ? Number(row.response_time_ms) : undefined,
      createdAt: String(row.created_at || ''),
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    };
  }
}

export const bipolarRatingService = new BipolarRatingService();
