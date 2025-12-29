// Enhanced Feedback Service
// 5-star rating system with comments for Think Tank

import { executeStatement, stringParam } from '../db/client';
import type {
  ResponseFeedback,
  FeedbackSummary,
  ResponseFeedbackRequest,
  FeedbackConfig,
  StarRating,
  ThumbsFeedback,
  FeedbackCategory,
  DEFAULT_FEEDBACK_CONFIG,
} from '@radiant/shared';

class EnhancedFeedbackService {
  /**
   * Submit feedback for a response
   */
  async submitFeedback(
    tenantId: string,
    userId: string,
    request: ResponseFeedbackRequest
  ): Promise<{ feedbackId: string; success: boolean }> {
    const feedbackType = request.starRating ? 'star_rating' : 'thumbs';

    const result = await executeStatement({
      sql: `
        SELECT submit_response_feedback(
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
          $6, $7, $8, $9, $10,
          $11, $12, $13::uuid,
          $14, $15, $16, $17, $18
        ) as feedback_id
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('conversationId', request.conversationId || ''),
        stringParam('messageId', request.messageId || ''),
        stringParam('planId', request.planId || ''),
        stringParam('feedbackType', feedbackType),
        stringParam('thumbs', request.thumbs || ''),
        stringParam('starRating', request.starRating ? String(request.starRating) : ''),
        stringParam('comment', request.comment || ''),
        stringParam('commentCategories', JSON.stringify(request.commentCategories || [])),
        stringParam('modelUsed', request.modelUsed || ''),
        stringParam('orchestrationMode', request.orchestrationMode || ''),
        stringParam('domainId', request.domainId || ''),
        stringParam('accuracyRating', request.categoryRatings?.accuracy ? String(request.categoryRatings.accuracy) : ''),
        stringParam('helpfulnessRating', request.categoryRatings?.helpfulness ? String(request.categoryRatings.helpfulness) : ''),
        stringParam('clarityRating', request.categoryRatings?.clarity ? String(request.categoryRatings.clarity) : ''),
        stringParam('completenessRating', request.categoryRatings?.completeness ? String(request.categoryRatings.completeness) : ''),
        stringParam('toneRating', request.categoryRatings?.tone ? String(request.categoryRatings.tone) : ''),
      ],
    });

    return {
      feedbackId: result.rows?.[0]?.feedback_id || '',
      success: true,
    };
  }

  /**
   * Submit thumbs up/down feedback (legacy support)
   */
  async submitThumbsFeedback(
    tenantId: string,
    userId: string,
    thumbs: ThumbsFeedback,
    options: {
      conversationId?: string;
      messageId?: string;
      planId?: string;
      comment?: string;
      modelUsed?: string;
      orchestrationMode?: string;
      domainId?: string;
    } = {}
  ): Promise<{ feedbackId: string; success: boolean }> {
    return this.submitFeedback(tenantId, userId, {
      thumbs,
      ...options,
    });
  }

  /**
   * Submit star rating feedback (Think Tank default)
   */
  async submitStarRating(
    tenantId: string,
    userId: string,
    starRating: StarRating,
    options: {
      conversationId?: string;
      messageId?: string;
      planId?: string;
      comment?: string;
      categoryRatings?: {
        accuracy?: StarRating;
        helpfulness?: StarRating;
        clarity?: StarRating;
        completeness?: StarRating;
        tone?: StarRating;
      };
      modelUsed?: string;
      orchestrationMode?: string;
      domainId?: string;
    } = {}
  ): Promise<{ feedbackId: string; success: boolean }> {
    return this.submitFeedback(tenantId, userId, {
      starRating,
      ...options,
    });
  }

  /**
   * Get feedback summary
   */
  async getFeedbackSummary(
    tenantId: string,
    scopeType: 'global' | 'model' | 'mode' | 'domain' | 'user' = 'global',
    scopeValue?: string
  ): Promise<FeedbackSummary> {
    const result = await executeStatement({
      sql: `SELECT * FROM get_feedback_summary($1::uuid, $2, $3)`,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('scopeType', scopeType),
        stringParam('scopeValue', scopeValue || ''),
      ],
    });

    const row = result.rows?.[0] || {};
    const starDist = row.star_distribution || {};
    const catAvg = row.category_averages || {};

    return {
      totalFeedback: (parseInt(row.thumbs_up as string) || 0) + 
                     (parseInt(row.thumbs_down as string) || 0) +
                     (parseInt(row.total_star_ratings as string) || 0),
      thumbsUp: parseInt(row.thumbs_up as string) || 0,
      thumbsDown: parseInt(row.thumbs_down as string) || 0,
      thumbsRatio: parseFloat(row.thumbs_ratio as string) || 0,
      totalStarRatings: parseInt(row.total_star_ratings as string) || 0,
      averageStarRating: parseFloat(row.avg_star_rating as string) || 0,
      starDistribution: {
        1: starDist['1'] || 0,
        2: starDist['2'] || 0,
        3: starDist['3'] || 0,
        4: starDist['4'] || 0,
        5: starDist['5'] || 0,
      },
      categoryAverages: {
        accuracy: catAvg.accuracy,
        helpfulness: catAvg.helpfulness,
        clarity: catAvg.clarity,
        completeness: catAvg.completeness,
        tone: catAvg.tone,
      },
      totalWithComments: parseInt(row.total_with_comments as string) || 0,
      recentComments: [],
    };
  }

  /**
   * Get recent feedback with comments
   */
  async getRecentFeedbackWithComments(
    tenantId: string,
    limit: number = 10
  ): Promise<{ comment: string; rating: StarRating; createdAt: Date }[]> {
    const result = await executeStatement({
      sql: `
        SELECT comment, star_rating, created_at
        FROM response_feedback
        WHERE tenant_id = $1::uuid
          AND comment IS NOT NULL
          AND comment != ''
        ORDER BY created_at DESC
        LIMIT $2
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('limit', String(limit)),
      ],
    });

    return (result.rows || []).map(row => ({
      comment: row.comment as string,
      rating: parseInt(row.star_rating as string) as StarRating,
      createdAt: new Date(row.created_at as string),
    }));
  }

  /**
   * Get feedback for a specific conversation/message
   */
  async getFeedbackForMessage(
    tenantId: string,
    messageId: string
  ): Promise<ResponseFeedback | null> {
    const result = await executeStatement({
      sql: `
        SELECT *
        FROM response_feedback
        WHERE tenant_id = $1::uuid
          AND message_id = $2::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('messageId', messageId),
      ],
    });

    if (!result.rows?.length) return null;

    const row = result.rows[0];
    return this.mapRowToFeedback(row);
  }

  /**
   * Get all feedback for a conversation
   */
  async getFeedbackForConversation(
    tenantId: string,
    conversationId: string
  ): Promise<ResponseFeedback[]> {
    const result = await executeStatement({
      sql: `
        SELECT *
        FROM response_feedback
        WHERE tenant_id = $1::uuid
          AND conversation_id = $2::uuid
        ORDER BY created_at DESC
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('conversationId', conversationId),
      ],
    });

    return (result.rows || []).map(row => this.mapRowToFeedback(row));
  }

  /**
   * Get model performance based on feedback
   */
  async getModelPerformance(
    tenantId: string
  ): Promise<{ modelId: string; avgRating: number; totalRatings: number; thumbsUpRatio: number }[]> {
    const result = await executeStatement({
      sql: `
        SELECT 
          model_used as model_id,
          AVG(star_rating) as avg_rating,
          COUNT(*) FILTER (WHERE star_rating IS NOT NULL) as total_ratings,
          CASE WHEN COUNT(*) FILTER (WHERE thumbs IS NOT NULL) > 0
            THEN COUNT(*) FILTER (WHERE thumbs = 'up')::decimal / COUNT(*) FILTER (WHERE thumbs IS NOT NULL)
            ELSE 0
          END as thumbs_up_ratio
        FROM response_feedback
        WHERE tenant_id = $1::uuid
          AND model_used IS NOT NULL
        GROUP BY model_used
        HAVING COUNT(*) >= 5
        ORDER BY AVG(star_rating) DESC NULLS LAST
      `,
      parameters: [stringParam('tenantId', tenantId)],
    });

    return (result.rows || []).map(row => ({
      modelId: row.model_id as string,
      avgRating: parseFloat(row.avg_rating as string) || 0,
      totalRatings: parseInt(row.total_ratings as string) || 0,
      thumbsUpRatio: parseFloat(row.thumbs_up_ratio as string) || 0,
    }));
  }

  /**
   * Get feedback configuration for tenant
   */
  async getFeedbackConfig(tenantId: string): Promise<FeedbackConfig> {
    const result = await executeStatement({
      sql: `
        SELECT *
        FROM feedback_config
        WHERE tenant_id = $1::uuid
      `,
      parameters: [stringParam('tenantId', tenantId)],
    });

    if (!result.rows?.length) {
      return {
        defaultFeedbackType: 'star_rating',
        showCategoryRatings: false,
        showCommentBox: true,
        commentRequired: false,
        commentRequiredThreshold: 2,
        starLabels: {
          1: 'Poor',
          2: 'Fair',
          3: 'Good',
          4: 'Very Good',
          5: 'Excellent',
        },
        enabledCategories: ['accuracy', 'helpfulness', 'overall'],
        feedbackPromptDelay: 3000,
        showFeedbackPrompt: true,
        feedbackPromptText: 'How was this response?',
      };
    }

    const row = result.rows[0];
    return {
      defaultFeedbackType: (row.default_feedback_type as string) === 'thumbs' ? 'thumbs' : 'star_rating',
      showCategoryRatings: row.show_category_ratings as boolean,
      showCommentBox: row.show_comment_box as boolean,
      commentRequired: row.comment_required as boolean,
      commentRequiredThreshold: parseInt(row.comment_required_threshold as string) as StarRating,
      starLabels: row.star_labels as Record<1 | 2 | 3 | 4 | 5, string>,
      enabledCategories: row.enabled_categories as FeedbackCategory[],
      feedbackPromptDelay: parseInt(row.feedback_prompt_delay_ms as string),
      showFeedbackPrompt: row.show_feedback_prompt as boolean,
      feedbackPromptText: row.feedback_prompt_text as string,
    };
  }

  /**
   * Update feedback configuration
   */
  async updateFeedbackConfig(
    tenantId: string,
    config: Partial<FeedbackConfig>
  ): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO feedback_config (
          tenant_id, default_feedback_type, show_category_ratings,
          show_comment_box, comment_required, comment_required_threshold,
          star_labels, enabled_categories, feedback_prompt_delay_ms,
          show_feedback_prompt, feedback_prompt_text
        ) VALUES (
          $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          default_feedback_type = COALESCE($2, feedback_config.default_feedback_type),
          show_category_ratings = COALESCE($3, feedback_config.show_category_ratings),
          show_comment_box = COALESCE($4, feedback_config.show_comment_box),
          comment_required = COALESCE($5, feedback_config.comment_required),
          comment_required_threshold = COALESCE($6, feedback_config.comment_required_threshold),
          star_labels = COALESCE($7::jsonb, feedback_config.star_labels),
          enabled_categories = COALESCE($8, feedback_config.enabled_categories),
          feedback_prompt_delay_ms = COALESCE($9, feedback_config.feedback_prompt_delay_ms),
          show_feedback_prompt = COALESCE($10, feedback_config.show_feedback_prompt),
          feedback_prompt_text = COALESCE($11, feedback_config.feedback_prompt_text),
          updated_at = NOW()
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('defaultFeedbackType', config.defaultFeedbackType || ''),
        stringParam('showCategoryRatings', config.showCategoryRatings !== undefined ? String(config.showCategoryRatings) : ''),
        stringParam('showCommentBox', config.showCommentBox !== undefined ? String(config.showCommentBox) : ''),
        stringParam('commentRequired', config.commentRequired !== undefined ? String(config.commentRequired) : ''),
        stringParam('commentRequiredThreshold', config.commentRequiredThreshold ? String(config.commentRequiredThreshold) : ''),
        stringParam('starLabels', config.starLabels ? JSON.stringify(config.starLabels) : ''),
        stringParam('enabledCategories', config.enabledCategories ? `{${config.enabledCategories.join(',')}}` : ''),
        stringParam('feedbackPromptDelay', config.feedbackPromptDelay ? String(config.feedbackPromptDelay) : ''),
        stringParam('showFeedbackPrompt', config.showFeedbackPrompt !== undefined ? String(config.showFeedbackPrompt) : ''),
        stringParam('feedbackPromptText', config.feedbackPromptText || ''),
      ],
    });
  }

  /**
   * Map database row to ResponseFeedback
   */
  private mapRowToFeedback(row: Record<string, unknown>): ResponseFeedback {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      conversationId: row.conversation_id as string,
      messageId: row.message_id as string,
      planId: row.plan_id as string,
      feedbackType: (row.feedback_type as string) === 'thumbs' ? 'thumbs' : 'star_rating',
      thumbs: row.thumbs as ThumbsFeedback,
      starRating: row.star_rating ? parseInt(row.star_rating as string) as StarRating : undefined,
      categoryRatings: {
        accuracy: row.accuracy_rating ? parseInt(row.accuracy_rating as string) as StarRating : undefined,
        helpfulness: row.helpfulness_rating ? parseInt(row.helpfulness_rating as string) as StarRating : undefined,
        clarity: row.clarity_rating ? parseInt(row.clarity_rating as string) as StarRating : undefined,
        completeness: row.completeness_rating ? parseInt(row.completeness_rating as string) as StarRating : undefined,
        tone: row.tone_rating ? parseInt(row.tone_rating as string) as StarRating : undefined,
      },
      comment: row.comment as string,
      commentCategories: row.comment_categories as FeedbackCategory[],
      source: row.source as 'think_tank' | 'api' | 'admin_dashboard' | 'automated',
      modelUsed: row.model_used as string,
      orchestrationMode: row.orchestration_mode as string,
      domainId: row.domain_id as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    };
  }
}

export const enhancedFeedbackService = new EnhancedFeedbackService();
