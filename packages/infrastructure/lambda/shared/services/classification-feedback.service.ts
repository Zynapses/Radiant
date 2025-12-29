// RADIANT v4.18.0 - Classification Feedback Service
// Feedback loop for false positive/negative handling and classifier improvement
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ClassificationFeedback {
  id?: string;
  tenantId: string;
  classificationId: string;
  feedbackType: 'false_positive' | 'false_negative' | 'correct' | 'uncertain';
  correctLabel?: boolean;
  correctCategories?: string[];
  notes?: string;
  submittedBy: string;
  submittedAt?: Date;
}

export interface FeedbackStats {
  totalFeedback: number;
  falsePositives: number;
  falseNegatives: number;
  correct: number;
  uncertain: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  accuracy: number;
}

export interface PatternFeedback {
  patternId: string;
  feedbackType: 'effective' | 'ineffective' | 'too_broad' | 'too_narrow' | 'obsolete';
  examplePrompt?: string;
  notes?: string;
  submittedBy: string;
}

export interface RetrainingCandidate {
  inputHash: string;
  originalLabel: boolean;
  correctedLabel: boolean;
  categories: string[];
  feedbackCount: number;
  confidence: number;
}

// ============================================================================
// Classification Feedback Service
// ============================================================================

class ClassificationFeedbackService {
  
  /**
   * Submit feedback on a classification result
   */
  async submitFeedback(feedback: ClassificationFeedback): Promise<string> {
    const feedbackId = crypto.randomUUID();
    
    await executeStatement(
      `INSERT INTO classification_feedback (
        id, tenant_id, classification_id, feedback_type, correct_label,
        correct_categories, notes, submitted_by
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::uuid)`,
      [
        stringParam('id', feedbackId),
        stringParam('tenantId', feedback.tenantId),
        stringParam('classificationId', feedback.classificationId),
        stringParam('feedbackType', feedback.feedbackType),
        boolParam('correctLabel', feedback.correctLabel ?? false),
        stringParam('correctCategories', feedback.correctCategories ? `{${feedback.correctCategories.join(',')}}` : '{}'),
        stringParam('notes', feedback.notes || ''),
        stringParam('submittedBy', feedback.submittedBy),
      ]
    );
    
    // Update classification result with feedback
    await this.updateClassificationWithFeedback(feedback);
    
    // Check if this triggers a pattern update
    await this.evaluatePatternUpdate(feedback);
    
    logger.info('Classification feedback submitted', { feedbackId, type: feedback.feedbackType });
    
    return feedbackId;
  }
  
  /**
   * Submit feedback on a jailbreak pattern
   */
  async submitPatternFeedback(
    tenantId: string,
    feedback: PatternFeedback
  ): Promise<string> {
    const feedbackId = crypto.randomUUID();
    
    await executeStatement(
      `INSERT INTO pattern_feedback (
        id, tenant_id, pattern_id, feedback_type, example_prompt, notes, submitted_by
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::uuid)`,
      [
        stringParam('id', feedbackId),
        stringParam('tenantId', tenantId),
        stringParam('patternId', feedback.patternId),
        stringParam('feedbackType', feedback.feedbackType),
        stringParam('examplePrompt', feedback.examplePrompt || ''),
        stringParam('notes', feedback.notes || ''),
        stringParam('submittedBy', feedback.submittedBy),
      ]
    );
    
    // Update pattern statistics
    await this.updatePatternStats(feedback.patternId, feedback.feedbackType);
    
    // Check if pattern should be disabled
    await this.evaluatePatternStatus(feedback.patternId);
    
    return feedbackId;
  }
  
  /**
   * Get feedback statistics for tenant
   */
  async getFeedbackStats(tenantId: string, days: number = 30): Promise<FeedbackStats> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN feedback_type = 'false_positive' THEN 1 ELSE 0 END) as false_positives,
        SUM(CASE WHEN feedback_type = 'false_negative' THEN 1 ELSE 0 END) as false_negatives,
        SUM(CASE WHEN feedback_type = 'correct' THEN 1 ELSE 0 END) as correct,
        SUM(CASE WHEN feedback_type = 'uncertain' THEN 1 ELSE 0 END) as uncertain
       FROM classification_feedback
       WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 day' * $2`,
      [stringParam('tenantId', tenantId), longParam('days', days)]
    );
    
    const row = result.rows?.[0] || {};
    const total = Number(row.total || 0);
    const falsePositives = Number(row.false_positives || 0);
    const falseNegatives = Number(row.false_negatives || 0);
    const correct = Number(row.correct || 0);
    const uncertain = Number(row.uncertain || 0);
    
    const labeled = falsePositives + falseNegatives + correct;
    
    return {
      totalFeedback: total,
      falsePositives,
      falseNegatives,
      correct,
      uncertain,
      falsePositiveRate: labeled > 0 ? falsePositives / labeled : 0,
      falseNegativeRate: labeled > 0 ? falseNegatives / labeled : 0,
      accuracy: labeled > 0 ? correct / labeled : 0,
    };
  }
  
  /**
   * Get classifications pending review
   */
  async getPendingReview(
    tenantId: string,
    options?: { limit?: number; minConfidence?: number; maxConfidence?: number }
  ): Promise<Array<{
    id: string;
    inputHash: string;
    isHarmful: boolean;
    confidenceScore: number;
    harmCategories: Array<{ category: string; score: number }>;
    attackType?: string;
    createdAt: Date;
  }>> {
    let query = `SELECT cr.* FROM classification_results cr
                 LEFT JOIN classification_feedback cf ON cr.id = cf.classification_id
                 WHERE cr.tenant_id = $1::uuid AND cf.id IS NULL`;
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];
    let idx = 2;
    
    if (options?.minConfidence !== undefined) {
      query += ` AND cr.confidence_score >= $${idx}`;
      params.push(doubleParam('minConf', options.minConfidence));
      idx++;
    }
    
    if (options?.maxConfidence !== undefined) {
      query += ` AND cr.confidence_score <= $${idx}`;
      params.push(doubleParam('maxConf', options.maxConfidence));
      idx++;
    }
    
    // Prioritize uncertain classifications (mid-range confidence)
    query += ` ORDER BY ABS(cr.confidence_score - 0.5) ASC, cr.created_at DESC LIMIT $${idx}`;
    params.push(longParam('limit', options?.limit || 50));
    
    const result = await executeStatement(query, params);
    
    return (result.rows || []).map(row => ({
      id: String(row.id),
      inputHash: String(row.input_hash),
      isHarmful: row.is_harmful === true,
      confidenceScore: Number(row.confidence_score || 0),
      harmCategories: (row.harm_categories as Array<{ category: string; score: number }>) || [],
      attackType: row.attack_type ? String(row.attack_type) : undefined,
      createdAt: new Date(row.created_at as string),
    }));
  }
  
  /**
   * Get candidates for retraining based on feedback
   */
  async getRetrainingCandidates(
    tenantId: string,
    minFeedbackCount: number = 3
  ): Promise<RetrainingCandidate[]> {
    const result = await executeStatement(
      `SELECT 
        cr.input_hash,
        cr.is_harmful as original_label,
        cf.correct_label as corrected_label,
        cf.correct_categories,
        COUNT(*) as feedback_count,
        AVG(cr.confidence_score) as avg_confidence
       FROM classification_results cr
       JOIN classification_feedback cf ON cr.id = cf.classification_id
       WHERE cr.tenant_id = $1::uuid
         AND cf.feedback_type IN ('false_positive', 'false_negative')
       GROUP BY cr.input_hash, cr.is_harmful, cf.correct_label, cf.correct_categories
       HAVING COUNT(*) >= $2
       ORDER BY COUNT(*) DESC`,
      [stringParam('tenantId', tenantId), longParam('minCount', minFeedbackCount)]
    );
    
    return (result.rows || []).map(row => ({
      inputHash: String(row.input_hash),
      originalLabel: row.original_label === true,
      correctedLabel: row.corrected_label === true,
      categories: (row.correct_categories as string[]) || [],
      feedbackCount: Number(row.feedback_count || 0),
      confidence: Number(row.avg_confidence || 0),
    }));
  }
  
  /**
   * Export feedback data for model retraining
   */
  async exportTrainingData(
    tenantId: string,
    options?: { format?: 'jsonl' | 'csv'; minConfidence?: number }
  ): Promise<string> {
    const result = await executeStatement(
      `SELECT 
        cr.input_hash,
        cf.correct_label as label,
        cf.correct_categories as categories,
        cr.confidence_score,
        cf.feedback_type
       FROM classification_results cr
       JOIN classification_feedback cf ON cr.id = cf.classification_id
       WHERE cr.tenant_id = $1::uuid
         AND cf.feedback_type IN ('false_positive', 'false_negative', 'correct')
       ORDER BY cr.created_at DESC`,
      [stringParam('tenantId', tenantId)]
    );
    
    const format = options?.format || 'jsonl';
    
    if (format === 'jsonl') {
      return (result.rows || [])
        .map(row => JSON.stringify({
          input_hash: row.input_hash,
          label: row.label,
          categories: row.categories,
          confidence: row.confidence_score,
          feedback_type: row.feedback_type,
        }))
        .join('\n');
    } else {
      const headers = 'input_hash,label,categories,confidence,feedback_type';
      const rows = (result.rows || [])
        .map(row => `${row.input_hash},${row.label},"${(row.categories as string[] || []).join(';')}",${row.confidence_score},${row.feedback_type}`)
        .join('\n');
      return `${headers}\n${rows}`;
    }
  }
  
  /**
   * Get patterns with poor effectiveness
   */
  async getIneffectivePatterns(
    minFeedback: number = 5,
    maxEffectivenessRate: number = 0.3
  ): Promise<Array<{
    patternId: string;
    patternName: string;
    patternType: string;
    totalFeedback: number;
    effectiveCount: number;
    ineffectiveCount: number;
    effectivenessRate: number;
  }>> {
    const result = await executeStatement(
      `SELECT 
        jp.id as pattern_id,
        jp.pattern_name,
        jp.pattern_type,
        COUNT(*) as total_feedback,
        SUM(CASE WHEN pf.feedback_type = 'effective' THEN 1 ELSE 0 END) as effective_count,
        SUM(CASE WHEN pf.feedback_type IN ('ineffective', 'too_broad', 'obsolete') THEN 1 ELSE 0 END) as ineffective_count
       FROM jailbreak_patterns jp
       JOIN pattern_feedback pf ON jp.id = pf.pattern_id
       WHERE jp.is_active = true
       GROUP BY jp.id, jp.pattern_name, jp.pattern_type
       HAVING COUNT(*) >= $1`,
      [longParam('minFeedback', minFeedback)]
    );
    
    return (result.rows || [])
      .map(row => {
        const total = Number(row.total_feedback || 0);
        const effective = Number(row.effective_count || 0);
        const ineffective = Number(row.ineffective_count || 0);
        
        return {
          patternId: String(row.pattern_id),
          patternName: String(row.pattern_name),
          patternType: String(row.pattern_type),
          totalFeedback: total,
          effectiveCount: effective,
          ineffectiveCount: ineffective,
          effectivenessRate: total > 0 ? effective / total : 0,
        };
      })
      .filter(p => p.effectivenessRate <= maxEffectivenessRate);
  }
  
  /**
   * Auto-disable ineffective patterns
   */
  async autoDisableIneffectivePatterns(
    tenantId: string,
    options?: { minFeedback?: number; maxEffectivenessRate?: number }
  ): Promise<{ disabled: string[]; skipped: string[] }> {
    const ineffective = await this.getIneffectivePatterns(
      options?.minFeedback || 10,
      options?.maxEffectivenessRate || 0.2
    );
    
    const disabled: string[] = [];
    const skipped: string[] = [];
    
    for (const pattern of ineffective) {
      try {
        // Check if pattern has admin override
        const overrideResult = await executeStatement(
          `SELECT admin_override FROM jailbreak_patterns WHERE id = $1::uuid`,
          [stringParam('patternId', pattern.patternId)]
        );
        
        if (overrideResult.rows?.[0]?.admin_override) {
          skipped.push(pattern.patternId);
          continue;
        }
        
        // Disable pattern
        await executeStatement(
          `UPDATE jailbreak_patterns SET is_active = false, 
           disabled_reason = 'Auto-disabled due to low effectiveness', 
           disabled_at = NOW()
           WHERE id = $1::uuid`,
          [stringParam('patternId', pattern.patternId)]
        );
        
        disabled.push(pattern.patternId);
        
        logger.info('Pattern auto-disabled', {
          patternId: pattern.patternId,
          patternName: pattern.patternName,
          effectivenessRate: pattern.effectivenessRate,
        });
      } catch (error) {
        logger.error('Failed to disable pattern', { patternId: pattern.patternId, error: String(error) });
        skipped.push(pattern.patternId);
      }
    }
    
    return { disabled, skipped };
  }
  
  /**
   * Get feedback for specific classification
   */
  async getFeedbackForClassification(
    tenantId: string,
    classificationId: string
  ): Promise<ClassificationFeedback[]> {
    const result = await executeStatement(
      `SELECT * FROM classification_feedback
       WHERE tenant_id = $1::uuid AND classification_id = $2::uuid
       ORDER BY created_at DESC`,
      [stringParam('tenantId', tenantId), stringParam('classificationId', classificationId)]
    );
    
    return (result.rows || []).map(row => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      classificationId: String(row.classification_id),
      feedbackType: row.feedback_type as ClassificationFeedback['feedbackType'],
      correctLabel: row.correct_label === true,
      correctCategories: (row.correct_categories as string[]) || [],
      notes: row.notes ? String(row.notes) : undefined,
      submittedBy: String(row.submitted_by),
      submittedAt: new Date(row.created_at as string),
    }));
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private async updateClassificationWithFeedback(feedback: ClassificationFeedback): Promise<void> {
    await executeStatement(
      `UPDATE classification_results SET 
        has_feedback = true,
        feedback_type = $1,
        corrected_label = $2
       WHERE id = $3::uuid`,
      [
        stringParam('feedbackType', feedback.feedbackType),
        boolParam('correctedLabel', feedback.correctLabel ?? false),
        stringParam('classificationId', feedback.classificationId),
      ]
    );
  }
  
  private async evaluatePatternUpdate(feedback: ClassificationFeedback): Promise<void> {
    // If false positive, check if we should adjust pattern
    if (feedback.feedbackType === 'false_positive') {
      const result = await executeStatement(
        `SELECT attack_type FROM classification_results WHERE id = $1::uuid`,
        [stringParam('classificationId', feedback.classificationId)]
      );
      
      const attackType = result.rows?.[0]?.attack_type;
      if (attackType) {
        // Increment false positive count for patterns of this type
        await executeStatement(
          `UPDATE jailbreak_patterns SET 
            false_positive_count = COALESCE(false_positive_count, 0) + 1,
            updated_at = NOW()
           WHERE pattern_type = $1 AND is_active = true`,
          [stringParam('patternType', String(attackType))]
        );
      }
    }
  }
  
  private async updatePatternStats(patternId: string, feedbackType: string): Promise<void> {
    const column = feedbackType === 'effective' ? 'effective_count' : 'ineffective_count';
    
    await executeStatement(
      `UPDATE jailbreak_patterns SET 
        ${column} = COALESCE(${column}, 0) + 1,
        updated_at = NOW()
       WHERE id = $1::uuid`,
      [stringParam('patternId', patternId)]
    );
  }
  
  private async evaluatePatternStatus(patternId: string): Promise<void> {
    const result = await executeStatement(
      `SELECT effective_count, ineffective_count, false_positive_count
       FROM jailbreak_patterns WHERE id = $1::uuid`,
      [stringParam('patternId', patternId)]
    );
    
    if (!result.rows?.length) return;
    
    const row = result.rows[0];
    const effective = Number(row.effective_count || 0);
    const ineffective = Number(row.ineffective_count || 0);
    const falsePositives = Number(row.false_positive_count || 0);
    
    const total = effective + ineffective;
    
    // Flag for review if effectiveness drops below 30% with sufficient feedback
    if (total >= 10 && effective / total < 0.3) {
      await executeStatement(
        `UPDATE jailbreak_patterns SET 
          needs_review = true,
          review_reason = 'Low effectiveness rate'
         WHERE id = $1::uuid`,
        [stringParam('patternId', patternId)]
      );
    }
    
    // Flag if false positive rate is high
    if (falsePositives >= 5) {
      await executeStatement(
        `UPDATE jailbreak_patterns SET 
          needs_review = true,
          review_reason = 'High false positive count'
         WHERE id = $1::uuid`,
        [stringParam('patternId', patternId)]
      );
    }
  }
}

export const classificationFeedbackService = new ClassificationFeedbackService();
