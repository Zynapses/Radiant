// RADIANT v4.18.0 - Feedback Service
// Captures all feedback (thumbs, comments, ratings) and feeds into learning system

import { executeStatement } from '../db/client';
import { learningService } from './learning.service';

// ============================================================================
// Types
// ============================================================================

export interface FeedbackSubmission {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  
  // What is being rated
  targetType: 'response' | 'conversation' | 'think_tank' | 'model' | 'feature';
  targetId: string;
  
  // Link to interaction
  interactionId?: string;
  
  // The feedback
  thumbs?: 'up' | 'down';
  rating?: number; // 1-5
  comment?: string;
  
  // Detailed ratings
  accuracyScore?: number;
  helpfulnessScore?: number;
  clarityScore?: number;
  completenessScore?: number;
  creativityScore?: number;
  
  // User action
  userAction?: 'accepted' | 'edited' | 'rejected' | 'regenerated' | 'copied' | 'shared';
  editedContent?: string;
  
  // Context
  originalPrompt?: string;
  originalResponse?: string;
  modelUsed?: string;
  modelsConsidered?: string[];
  workflowUsed?: string;
  
  // Quality metrics
  autoQualityScore?: number;
  confidenceScore?: number;
  latencyMs?: number;
  costCents?: number;
  
  // Tags
  feedbackTags?: string[];
  issueCategory?: string;
  
  // Source
  feedbackSource?: 'inline' | 'modal' | 'think_tank' | 'api' | 'email';
  deviceType?: string;
}

export interface ThinkTankFeedback {
  conversationId: string;
  tenantId: string;
  userId?: string;
  
  // What's being rated
  messageId?: string; // Specific message, or null for whole conversation
  
  // Feedback
  thumbs?: 'up' | 'down';
  rating?: number;
  comment?: string;
  
  // Participant feedback
  bestParticipant?: string;
  worstParticipant?: string;
  participantRatings?: Record<string, { rating: number; comment?: string }>;
  
  // Goal
  userGoal?: string;
  goalAchieved?: boolean;
  
  // Suggestions
  improvementSuggestions?: string;
  
  // Context
  conversationTopic?: string;
  participants?: string[];
  messageCount?: number;
  messageContent?: string;
  fullConversationSnapshot?: Record<string, unknown>;
}

export interface FeedbackStats {
  totalFeedback: number;
  thumbsUp: number;
  thumbsDown: number;
  avgRating: number;
  positiveRatio: number;
  commentsCount: number;
  topIssues: string[];
  topTags: string[];
}

export interface FeedbackForLearning {
  feedbackId: string;
  originalPrompt: string;
  originalResponse: string;
  modelUsed?: string;
  workflowUsed?: string;
  thumbs?: 'up' | 'down';
  rating?: number;
  comment?: string;
  feedbackTags: string[];
  isPositive: boolean;
}

// ============================================================================
// Feedback Service
// ============================================================================

export class FeedbackService {
  
  // ============================================================================
  // Submit Feedback
  // ============================================================================

  async submitFeedback(feedback: FeedbackSubmission): Promise<string> {
    const result = await executeStatement(
      `SELECT submit_feedback(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) as feedback_id`,
      [
        { name: 'p1', value: { stringValue: feedback.tenantId } },
        { name: 'p2', value: feedback.userId ? { stringValue: feedback.userId } : { isNull: true } },
        { name: 'p3', value: { stringValue: feedback.targetType } },
        { name: 'p4', value: { stringValue: feedback.targetId } },
        { name: 'p5', value: feedback.thumbs ? { stringValue: feedback.thumbs } : { isNull: true } },
        { name: 'p6', value: feedback.rating !== undefined ? { longValue: feedback.rating } : { isNull: true } },
        { name: 'p7', value: feedback.comment ? { stringValue: feedback.comment } : { isNull: true } },
        { name: 'p8', value: feedback.interactionId ? { stringValue: feedback.interactionId } : { isNull: true } },
        { name: 'p9', value: feedback.originalPrompt ? { stringValue: feedback.originalPrompt.substring(0, 50000) } : { isNull: true } },
        { name: 'p10', value: feedback.originalResponse ? { stringValue: feedback.originalResponse.substring(0, 100000) } : { isNull: true } },
        { name: 'p11', value: feedback.modelUsed ? { stringValue: feedback.modelUsed } : { isNull: true } },
        { name: 'p12', value: feedback.workflowUsed ? { stringValue: feedback.workflowUsed } : { isNull: true } },
        { name: 'p13', value: feedback.feedbackTags ? { stringValue: `{${feedback.feedbackTags.join(',')}}` } : { isNull: true } },
        { name: 'p14', value: feedback.userAction ? { stringValue: feedback.userAction } : { isNull: true } },
        { name: 'p15', value: feedback.sessionId ? { stringValue: feedback.sessionId } : { isNull: true } },
      ]
    );

    const feedbackId = (result.rows[0] as { feedback_id: string }).feedback_id;

    // Also record in learning system if we have interaction context
    if (feedback.interactionId) {
      try {
        await learningService.recordFeedback(feedback.interactionId, {
          thumbs: feedback.thumbs,
          rating: feedback.rating,
          feedbackText: feedback.comment,
          responseAction: feedback.userAction,
          feedbackSource: feedback.feedbackSource,
        });
      } catch (err) {
        console.error('Failed to record feedback in learning system:', err);
      }
    }

    // Record implicit signals based on user action
    if (feedback.interactionId && feedback.userAction) {
      try {
        await learningService.recordImplicitSignals(feedback.interactionId, {
          didRegenerate: feedback.userAction === 'regenerated',
          didCopyResponse: feedback.userAction === 'copied',
        });
      } catch (err) {
        console.error('Failed to record implicit signals:', err);
      }
    }

    return feedbackId;
  }

  // ============================================================================
  // Submit Think Tank Feedback
  // ============================================================================

  async submitThinkTankFeedback(feedback: ThinkTankFeedback): Promise<string> {
    const result = await executeStatement(
      `SELECT submit_think_tank_feedback(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) as feedback_id`,
      [
        { name: 'p1', value: { stringValue: feedback.conversationId } },
        { name: 'p2', value: { stringValue: feedback.tenantId } },
        { name: 'p3', value: feedback.userId ? { stringValue: feedback.userId } : { isNull: true } },
        { name: 'p4', value: feedback.thumbs ? { stringValue: feedback.thumbs } : { isNull: true } },
        { name: 'p5', value: feedback.rating !== undefined ? { longValue: feedback.rating } : { isNull: true } },
        { name: 'p6', value: feedback.comment ? { stringValue: feedback.comment } : { isNull: true } },
        { name: 'p7', value: feedback.messageId ? { stringValue: feedback.messageId } : { isNull: true } },
        { name: 'p8', value: feedback.bestParticipant ? { stringValue: feedback.bestParticipant } : { isNull: true } },
        { name: 'p9', value: feedback.worstParticipant ? { stringValue: feedback.worstParticipant } : { isNull: true } },
        { name: 'p10', value: feedback.participantRatings ? { stringValue: JSON.stringify(feedback.participantRatings) } : { isNull: true } },
        { name: 'p11', value: feedback.goalAchieved !== undefined ? { booleanValue: feedback.goalAchieved } : { isNull: true } },
        { name: 'p12', value: feedback.improvementSuggestions ? { stringValue: feedback.improvementSuggestions } : { isNull: true } },
      ]
    );

    const feedbackId = (result.rows[0] as { feedback_id: string }).feedback_id;

    // Record in Think Tank learning
    try {
      await learningService.recordThinkTankLearning(
        feedback.conversationId,
        feedback.tenantId,
        {
          userId: feedback.userId,
          conversationTopic: feedback.conversationTopic,
          participants: feedback.participants,
          totalTurns: feedback.messageCount,
          overallRating: feedback.rating,
          feedbackText: feedback.comment,
          participantScores: feedback.participantRatings ? 
            Object.fromEntries(
              Object.entries(feedback.participantRatings).map(([model, data]) => [
                model,
                { quality: data.rating / 5, helpfulness: data.rating / 5, relevance: data.rating / 5 }
              ])
            ) : undefined,
          bestContributor: feedback.bestParticipant,
          goalAchieved: feedback.goalAchieved,
        }
      );
    } catch (err) {
      console.error('Failed to record Think Tank learning:', err);
    }

    return feedbackId;
  }

  // ============================================================================
  // Quick Feedback Methods (convenience)
  // ============================================================================

  async thumbsUp(
    tenantId: string,
    targetType: FeedbackSubmission['targetType'],
    targetId: string,
    options: Partial<FeedbackSubmission> = {}
  ): Promise<string> {
    return this.submitFeedback({
      tenantId,
      targetType,
      targetId,
      thumbs: 'up',
      ...options,
    });
  }

  async thumbsDown(
    tenantId: string,
    targetType: FeedbackSubmission['targetType'],
    targetId: string,
    options: Partial<FeedbackSubmission> = {}
  ): Promise<string> {
    return this.submitFeedback({
      tenantId,
      targetType,
      targetId,
      thumbs: 'down',
      ...options,
    });
  }

  async addComment(
    tenantId: string,
    targetType: FeedbackSubmission['targetType'],
    targetId: string,
    comment: string,
    options: Partial<FeedbackSubmission> = {}
  ): Promise<string> {
    return this.submitFeedback({
      tenantId,
      targetType,
      targetId,
      comment,
      ...options,
    });
  }

  async rate(
    tenantId: string,
    targetType: FeedbackSubmission['targetType'],
    targetId: string,
    rating: number,
    options: Partial<FeedbackSubmission> = {}
  ): Promise<string> {
    return this.submitFeedback({
      tenantId,
      targetType,
      targetId,
      rating,
      ...options,
    });
  }

  // ============================================================================
  // Query Feedback
  // ============================================================================

  async getFeedbackStats(
    tenantId?: string,
    targetType?: string,
    days = 7
  ): Promise<FeedbackStats> {
    let sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE thumbs = 'up') as thumbs_up,
        COUNT(*) FILTER (WHERE thumbs = 'down') as thumbs_down,
        AVG(rating) as avg_rating,
        AVG(CASE WHEN thumbs = 'up' THEN 1.0 WHEN thumbs = 'down' THEN 0.0 ELSE NULL END) as positive_ratio,
        COUNT(*) FILTER (WHERE comment IS NOT NULL AND comment != '') as comments_count
      FROM feedback_registry
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;
    
    const params: Array<{ name: string; value: Record<string, unknown> }> = [];
    
    if (tenantId) {
      sql += ` AND tenant_id = $${params.length + 1}`;
      params.push({ name: 'tenantId', value: { stringValue: tenantId } });
    }
    
    if (targetType) {
      sql += ` AND target_type = $${params.length + 1}`;
      params.push({ name: 'targetType', value: { stringValue: targetType } });
    }

    const result = await executeStatement(sql, params);
    const row = result.rows[0] as Record<string, unknown>;

    // Get top issues
    const issuesResult = await executeStatement(
      `SELECT issue_category, COUNT(*) as count
       FROM feedback_registry
       WHERE issue_category IS NOT NULL
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY issue_category
       ORDER BY count DESC
       LIMIT 5`,
      []
    );

    // Get top tags
    const tagsResult = await executeStatement(
      `SELECT UNNEST(feedback_tags) as tag, COUNT(*) as count
       FROM feedback_registry
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY tag
       ORDER BY count DESC
       LIMIT 10`,
      []
    );

    return {
      totalFeedback: Number(row.total || 0),
      thumbsUp: Number(row.thumbs_up || 0),
      thumbsDown: Number(row.thumbs_down || 0),
      avgRating: Number(row.avg_rating || 0),
      positiveRatio: Number(row.positive_ratio || 0),
      commentsCount: Number(row.comments_count || 0),
      topIssues: issuesResult.rows.map(r => String((r as Record<string, unknown>).issue_category)),
      topTags: tagsResult.rows.map(r => String((r as Record<string, unknown>).tag)),
    };
  }

  async getRecentFeedback(
    tenantId?: string,
    limit = 50
  ): Promise<Array<{
    feedbackId: string;
    targetType: string;
    thumbs?: string;
    rating?: number;
    comment?: string;
    modelUsed?: string;
    createdAt: string;
  }>> {
    let sql = `
      SELECT feedback_id, target_type, thumbs, rating, comment, model_used, created_at
      FROM feedback_registry
    `;
    
    const params: Array<{ name: string; value: Record<string, unknown> }> = [];
    
    if (tenantId) {
      sql += ` WHERE tenant_id = $1`;
      params.push({ name: 'tenantId', value: { stringValue: tenantId } });
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push({ name: 'limit', value: { longValue: limit } });

    const result = await executeStatement(sql, params);
    
    return result.rows.map(r => {
      const row = r as Record<string, unknown>;
      return {
        feedbackId: String(row.feedback_id),
        targetType: String(row.target_type),
        thumbs: row.thumbs ? String(row.thumbs) : undefined,
        rating: row.rating ? Number(row.rating) : undefined,
        comment: row.comment ? String(row.comment) : undefined,
        modelUsed: row.model_used ? String(row.model_used) : undefined,
        createdAt: String(row.created_at),
      };
    });
  }

  async getFeedbackByModel(days = 30): Promise<Array<{
    modelId: string;
    totalFeedback: number;
    thumbsUp: number;
    thumbsDown: number;
    avgRating: number;
    positiveRatio: number;
  }>> {
    const result = await executeStatement(
      `SELECT 
        model_used,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE thumbs = 'up') as thumbs_up,
        COUNT(*) FILTER (WHERE thumbs = 'down') as thumbs_down,
        AVG(rating) as avg_rating,
        AVG(CASE WHEN thumbs = 'up' THEN 1.0 WHEN thumbs = 'down' THEN 0.0 ELSE NULL END) as positive_ratio
      FROM feedback_registry
      WHERE model_used IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY model_used
      ORDER BY total DESC`,
      []
    );

    return result.rows.map(r => {
      const row = r as Record<string, unknown>;
      return {
        modelId: String(row.model_used),
        totalFeedback: Number(row.total || 0),
        thumbsUp: Number(row.thumbs_up || 0),
        thumbsDown: Number(row.thumbs_down || 0),
        avgRating: Number(row.avg_rating || 0),
        positiveRatio: Number(row.positive_ratio || 0),
      };
    });
  }

  // ============================================================================
  // Learning Integration
  // ============================================================================

  async getFeedbackForLearning(limit = 1000): Promise<FeedbackForLearning[]> {
    const result = await executeStatement(
      `SELECT * FROM get_feedback_for_learning($1)`,
      [{ name: 'limit', value: { longValue: limit } }]
    );

    return result.rows.map(r => {
      const row = r as Record<string, unknown>;
      return {
        feedbackId: String(row.feedback_id),
        originalPrompt: String(row.original_prompt || ''),
        originalResponse: String(row.original_response || ''),
        modelUsed: row.model_used ? String(row.model_used) : undefined,
        workflowUsed: row.workflow_used ? String(row.workflow_used) : undefined,
        thumbs: row.thumbs ? (String(row.thumbs) as 'up' | 'down') : undefined,
        rating: row.rating ? Number(row.rating) : undefined,
        comment: row.comment ? String(row.comment) : undefined,
        feedbackTags: (row.feedback_tags as string[]) || [],
        isPositive: Boolean(row.is_positive),
      };
    });
  }

  async markFeedbackProcessed(feedbackIds: string[], batchId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT mark_feedback_processed($1, $2) as count`,
      [
        { name: 'feedbackIds', value: { stringValue: `{${feedbackIds.join(',')}}` } },
        { name: 'batchId', value: { stringValue: batchId } },
      ]
    );

    return Number((result.rows[0] as { count: number }).count);
  }

  async runAggregations(): Promise<number> {
    const result = await executeStatement(
      `SELECT aggregate_feedback('daily') as count`,
      []
    );
    return Number((result.rows[0] as { count: number }).count);
  }
}

export const feedbackService = new FeedbackService();
