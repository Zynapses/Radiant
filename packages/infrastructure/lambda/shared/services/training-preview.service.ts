// RADIANT v4.18.0 - Training Preview Service
// Admin can preview and approve/reject candidates before training
// ============================================================================

import { executeStatement, stringParam, longParam } from '../db/client';
import { learningCandidateService } from './learning-candidate.service';
import { enhancedLearningService } from './enhanced-learning.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface TrainingPreviewCandidate {
  candidateId: string;
  candidateType: string;
  source: string;
  promptText: string;
  promptPreview: string; // Truncated for display
  responseText: string;
  responsePreview: string;
  correctionText?: string;
  qualityScore: number;
  domain?: string;
  tokenCount: number;
  createdAt: Date;
  userId?: string;
  conversationId?: string;
  // Admin review fields
  adminReviewStatus: 'pending' | 'approved' | 'rejected';
  adminReviewedBy?: string;
  adminReviewedAt?: Date;
  adminReviewNotes?: string;
}

export interface TrainingPreviewSummary {
  tenantId: string;
  totalCandidates: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  byType: Record<string, number>;
  byDomain: Record<string, number>;
  estimatedTrainingTime: string;
  estimatedTokens: number;
  readyForTraining: boolean;
  nextScheduledTraining?: Date;
}

export interface TrainingPreviewFilters {
  candidateType?: string;
  domain?: string;
  minQualityScore?: number;
  reviewStatus?: 'pending' | 'approved' | 'rejected' | 'all';
  limit?: number;
  offset?: number;
}

// ============================================================================
// Training Preview Service
// ============================================================================

class TrainingPreviewService {
  
  /**
   * Get training preview summary
   */
  async getPreviewSummary(tenantId: string): Promise<TrainingPreviewSummary> {
    const config = await enhancedLearningService.getConfig(tenantId);
    
    const result = await executeStatement(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE admin_review_status = 'pending' OR admin_review_status IS NULL) as pending,
         COUNT(*) FILTER (WHERE admin_review_status = 'approved') as approved,
         COUNT(*) FILTER (WHERE admin_review_status = 'rejected') as rejected
       FROM learning_candidates
       WHERE tenant_id = $1::uuid AND training_status = 'pending' AND expires_at > NOW()`,
      [stringParam('tenantId', tenantId)]
    );
    
    const row = result.rows?.[0] || {};
    const total = Number(row.total || 0);
    const approved = Number(row.approved || 0);
    
    // Get breakdown by type
    const typeResult = await executeStatement(
      `SELECT candidate_type, COUNT(*) as count
       FROM learning_candidates
       WHERE tenant_id = $1::uuid AND training_status = 'pending' AND expires_at > NOW()
       GROUP BY candidate_type`,
      [stringParam('tenantId', tenantId)]
    );
    
    const byType: Record<string, number> = {};
    for (const r of typeResult.rows || []) {
      byType[String(r.candidate_type)] = Number(r.count);
    }
    
    // Get breakdown by domain
    const domainResult = await executeStatement(
      `SELECT COALESCE(domain_detected, 'unknown') as domain, COUNT(*) as count
       FROM learning_candidates
       WHERE tenant_id = $1::uuid AND training_status = 'pending' AND expires_at > NOW()
       GROUP BY domain_detected`,
      [stringParam('tenantId', tenantId)]
    );
    
    const byDomain: Record<string, number> = {};
    for (const r of domainResult.rows || []) {
      byDomain[String(r.domain)] = Number(r.count);
    }
    
    // Estimate training time based on token count
    const tokenResult = await executeStatement(
      `SELECT SUM(token_count) as total_tokens
       FROM learning_candidates
       WHERE tenant_id = $1::uuid AND training_status = 'pending' AND expires_at > NOW()
         AND (admin_review_status = 'approved' OR admin_review_status IS NULL)`,
      [stringParam('tenantId', tenantId)]
    );
    
    const totalTokens = Number(tokenResult.rows?.[0]?.total_tokens || 0);
    const estimatedMinutes = Math.ceil(totalTokens / 10000) * 5; // ~5 min per 10k tokens
    
    // Get next scheduled training
    const scheduleResult = await executeStatement(
      `SELECT next_scheduled_evolution FROM consciousness_evolution_state WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    return {
      tenantId,
      totalCandidates: total,
      pendingReview: Number(row.pending || 0),
      approved,
      rejected: Number(row.rejected || 0),
      byType,
      byDomain,
      estimatedTrainingTime: estimatedMinutes < 60 
        ? `~${estimatedMinutes} minutes` 
        : `~${Math.ceil(estimatedMinutes / 60)} hours`,
      estimatedTokens: totalTokens,
      readyForTraining: approved >= (config?.minCandidatesForTraining || 25),
      nextScheduledTraining: scheduleResult.rows?.[0]?.next_scheduled_evolution 
        ? new Date(scheduleResult.rows[0].next_scheduled_evolution as string) 
        : undefined,
    };
  }
  
  /**
   * Get candidates for preview
   */
  async getPreviewCandidates(
    tenantId: string,
    filters: TrainingPreviewFilters = {}
  ): Promise<TrainingPreviewCandidate[]> {
    let query = `SELECT * FROM learning_candidates 
                 WHERE tenant_id = $1::uuid AND training_status = 'pending' AND expires_at > NOW()`;
    const params = [stringParam('tenantId', tenantId)];
    let paramIndex = 2;
    
    if (filters.candidateType) {
      query += ` AND candidate_type = $${paramIndex}`;
      params.push(stringParam('candidateType', filters.candidateType));
      paramIndex++;
    }
    
    if (filters.domain) {
      query += ` AND domain_detected = $${paramIndex}`;
      params.push(stringParam('domain', filters.domain));
      paramIndex++;
    }
    
    if (filters.minQualityScore !== undefined) {
      query += ` AND quality_score >= $${paramIndex}`;
      params.push(stringParam('minQuality', String(filters.minQualityScore)));
      paramIndex++;
    }
    
    if (filters.reviewStatus && filters.reviewStatus !== 'all') {
      if (filters.reviewStatus === 'pending') {
        query += ` AND (admin_review_status = 'pending' OR admin_review_status IS NULL)`;
      } else {
        query += ` AND admin_review_status = $${paramIndex}`;
        params.push(stringParam('reviewStatus', filters.reviewStatus));
        paramIndex++;
      }
    }
    
    query += ` ORDER BY quality_score DESC, created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(longParam('limit', filters.limit || 50));
    params.push(longParam('offset', filters.offset || 0));
    
    const result = await executeStatement(query, params);
    
    return (result.rows || []).map(row => this.mapPreviewCandidate(row));
  }
  
  /**
   * Approve a candidate for training
   */
  async approveCandidate(
    tenantId: string,
    candidateId: string,
    adminUserId: string,
    notes?: string
  ): Promise<void> {
    await executeStatement(
      `UPDATE learning_candidates SET
        admin_review_status = 'approved',
        admin_reviewed_by = $3::uuid,
        admin_reviewed_at = NOW(),
        admin_review_notes = $4
       WHERE tenant_id = $1::uuid AND candidate_id = $2::uuid`,
      [
        stringParam('tenantId', tenantId),
        stringParam('candidateId', candidateId),
        stringParam('adminUserId', adminUserId),
        stringParam('notes', notes || ''),
      ]
    );
    
    logger.info('Approved training candidate', { tenantId, candidateId, adminUserId });
  }
  
  /**
   * Reject a candidate from training
   */
  async rejectCandidate(
    tenantId: string,
    candidateId: string,
    adminUserId: string,
    reason: string
  ): Promise<void> {
    await executeStatement(
      `UPDATE learning_candidates SET
        admin_review_status = 'rejected',
        admin_reviewed_by = $3::uuid,
        admin_reviewed_at = NOW(),
        admin_review_notes = $4
       WHERE tenant_id = $1::uuid AND candidate_id = $2::uuid`,
      [
        stringParam('tenantId', tenantId),
        stringParam('candidateId', candidateId),
        stringParam('adminUserId', adminUserId),
        stringParam('reason', reason),
      ]
    );
    
    logger.info('Rejected training candidate', { tenantId, candidateId, adminUserId, reason });
  }
  
  /**
   * Bulk approve candidates
   */
  async bulkApprove(
    tenantId: string,
    candidateIds: string[],
    adminUserId: string
  ): Promise<number> {
    if (candidateIds.length === 0) return 0;
    
    const result = await executeStatement(
      `UPDATE learning_candidates SET
        admin_review_status = 'approved',
        admin_reviewed_by = $2::uuid,
        admin_reviewed_at = NOW()
       WHERE tenant_id = $1::uuid AND candidate_id = ANY($3::uuid[])
       RETURNING candidate_id`,
      [
        stringParam('tenantId', tenantId),
        stringParam('adminUserId', adminUserId),
        stringParam('candidateIds', `{${candidateIds.join(',')}}`),
      ]
    );
    
    const count = result.rows?.length || 0;
    logger.info('Bulk approved training candidates', { tenantId, count, adminUserId });
    return count;
  }
  
  /**
   * Bulk reject candidates
   */
  async bulkReject(
    tenantId: string,
    candidateIds: string[],
    adminUserId: string,
    reason: string
  ): Promise<number> {
    if (candidateIds.length === 0) return 0;
    
    const result = await executeStatement(
      `UPDATE learning_candidates SET
        admin_review_status = 'rejected',
        admin_reviewed_by = $2::uuid,
        admin_reviewed_at = NOW(),
        admin_review_notes = $4
       WHERE tenant_id = $1::uuid AND candidate_id = ANY($3::uuid[])
       RETURNING candidate_id`,
      [
        stringParam('tenantId', tenantId),
        stringParam('adminUserId', adminUserId),
        stringParam('candidateIds', `{${candidateIds.join(',')}}`),
        stringParam('reason', reason),
      ]
    );
    
    const count = result.rows?.length || 0;
    logger.info('Bulk rejected training candidates', { tenantId, count, adminUserId, reason });
    return count;
  }
  
  /**
   * Auto-approve candidates above quality threshold
   */
  async autoApproveHighQuality(
    tenantId: string,
    minQualityScore: number = 0.9
  ): Promise<number> {
    const result = await executeStatement(
      `UPDATE learning_candidates SET
        admin_review_status = 'approved',
        admin_reviewed_at = NOW(),
        admin_review_notes = 'Auto-approved: high quality score'
       WHERE tenant_id = $1::uuid 
         AND training_status = 'pending' 
         AND expires_at > NOW()
         AND quality_score >= $2
         AND (admin_review_status IS NULL OR admin_review_status = 'pending')
       RETURNING candidate_id`,
      [stringParam('tenantId', tenantId), stringParam('minQuality', String(minQualityScore))]
    );
    
    const count = result.rows?.length || 0;
    logger.info('Auto-approved high quality candidates', { tenantId, count, minQualityScore });
    return count;
  }
  
  /**
   * Get candidates that will be used in next training
   */
  async getTrainingQueue(tenantId: string): Promise<{
    candidates: TrainingPreviewCandidate[];
    summary: {
      totalCount: number;
      totalTokens: number;
      byType: Record<string, number>;
    };
  }> {
    const result = await executeStatement(
      `SELECT * FROM learning_candidates 
       WHERE tenant_id = $1::uuid 
         AND training_status = 'pending' 
         AND expires_at > NOW()
         AND (admin_review_status = 'approved' OR admin_review_status IS NULL)
       ORDER BY quality_score DESC
       LIMIT 1000`,
      [stringParam('tenantId', tenantId)]
    );
    
    const candidates = (result.rows || []).map(row => this.mapPreviewCandidate(row));
    
    const byType: Record<string, number> = {};
    let totalTokens = 0;
    
    for (const c of candidates) {
      byType[c.candidateType] = (byType[c.candidateType] || 0) + 1;
      totalTokens += c.tokenCount;
    }
    
    return {
      candidates,
      summary: {
        totalCount: candidates.length,
        totalTokens,
        byType,
      },
    };
  }
  
  private mapPreviewCandidate(row: Record<string, unknown>): TrainingPreviewCandidate {
    const promptText = String(row.prompt_text || '');
    const responseText = String(row.response_text || '');
    
    return {
      candidateId: String(row.candidate_id),
      candidateType: String(row.candidate_type),
      source: String(row.candidate_type), // Same as type for now
      promptText,
      promptPreview: promptText.length > 200 ? promptText.substring(0, 200) + '...' : promptText,
      responseText,
      responsePreview: responseText.length > 300 ? responseText.substring(0, 300) + '...' : responseText,
      correctionText: row.correction_text ? String(row.correction_text) : undefined,
      qualityScore: Number(row.quality_score || 0),
      domain: row.domain_detected ? String(row.domain_detected) : undefined,
      tokenCount: Number(row.token_count || 0),
      createdAt: new Date(row.created_at as string),
      userId: row.user_id ? String(row.user_id) : undefined,
      conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
      adminReviewStatus: (row.admin_review_status as 'pending' | 'approved' | 'rejected') || 'pending',
      adminReviewedBy: row.admin_reviewed_by ? String(row.admin_reviewed_by) : undefined,
      adminReviewedAt: row.admin_reviewed_at ? new Date(row.admin_reviewed_at as string) : undefined,
      adminReviewNotes: row.admin_review_notes ? String(row.admin_review_notes) : undefined,
    };
  }
}

export const trainingPreviewService = new TrainingPreviewService();
