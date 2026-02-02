/**
 * AXIOM Curator Integration Service
 * 
 * Integrates Curator (content/knowledge management system) with AXIOM:
 * - Curated content informs domain taxonomy enhancements
 * - Expert-validated prompts can be injected as high-weight patterns
 * - Curator quality signals feed into AXIOM's fitness functions
 * - Curator can flag domains needing AXIOM attention
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import { executeStatement, stringParam, longParam, doubleParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Types
// =============================================================================

export type CuratorFeedbackType = 'pattern_quality' | 'domain_flag' | 'taxonomy_suggestion';
export type CuratorFeedbackStatus = 'pending' | 'approved' | 'rejected' | 'implemented';
export type DomainFlagType = 'needs_patterns' | 'low_confidence' | 'high_skip_rate' | 'curator_flagged';
export type DomainFlagSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CuratorFeedback {
  feedbackId: string;
  tenantId: string;
  curatorUserId: string;
  domainId: string;
  feedbackType: CuratorFeedbackType;
  targetId?: string;
  rating?: number;
  notes?: string;
  suggestedContent?: string;
  status: CuratorFeedbackStatus;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface CuratorPattern {
  patternId: string;
  curatorUserId: string;
  tenantId: string;
  validationStatus: string;
  validationScore?: number;
  weightBoost: number;
  promotedAt?: string;
  createdAt: string;
}

export interface DomainFlag {
  flagId: string;
  domainId: string;
  tenantId?: string;
  flagType: DomainFlagType;
  severity: DomainFlagSeverity;
  description?: string;
  autoDetected: boolean;
  flaggedBy?: string;
  resolved: boolean;
  resolvedBy?: string;
  createdAt: string;
  resolvedAt?: string;
}

// =============================================================================
// Curator Integration Service
// =============================================================================

class AxiomCuratorService {

  // ===========================================================================
  // Curator Feedback
  // ===========================================================================

  /**
   * Submit feedback from a Curator user
   */
  async submitFeedback(params: {
    tenantId: string;
    curatorUserId: string;
    domainId: string;
    feedbackType: CuratorFeedbackType;
    targetId?: string;
    rating?: number;
    notes?: string;
    suggestedContent?: string;
  }): Promise<CuratorFeedback> {
    const feedbackId = `curator-fb-${uuidv4()}`;

    await executeStatement(
      `INSERT INTO axiom_curator_feedback (
        feedback_id, tenant_id, curator_user_id, domain_id, feedback_type,
        target_id, rating, notes, suggested_content, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())`,
      [
        stringParam('feedbackId', feedbackId),
        stringParam('tenantId', params.tenantId),
        stringParam('curatorUserId', params.curatorUserId),
        stringParam('domainId', params.domainId),
        stringParam('feedbackType', params.feedbackType),
        stringParam('targetId', params.targetId || ''),
        params.rating ? longParam('rating', params.rating) : longParam('rating', 0),
        stringParam('notes', params.notes || ''),
        stringParam('suggestedContent', params.suggestedContent || ''),
      ]
    );

    logger.info('[AXIOM:CURATOR] Feedback submitted', {
      feedbackId,
      domainId: params.domainId,
      feedbackType: params.feedbackType,
    });

    return {
      feedbackId,
      tenantId: params.tenantId,
      curatorUserId: params.curatorUserId,
      domainId: params.domainId,
      feedbackType: params.feedbackType,
      targetId: params.targetId,
      rating: params.rating,
      notes: params.notes,
      suggestedContent: params.suggestedContent,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get pending feedback for review
   */
  async getPendingFeedback(tenantId?: string, limit: number = 50): Promise<CuratorFeedback[]> {
    let query = `SELECT * FROM axiom_curator_feedback WHERE status = 'pending'`;
    const params: any[] = [];

    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(stringParam('tenantId', tenantId));
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(longParam('limit', limit));

    const result = await executeStatement(query, params);
    return result.rows.map((row: any) => this.parseFeedbackRow(row));
  }

  /**
   * Process feedback (approve/reject/implement)
   */
  async processFeedback(
    feedbackId: string,
    status: CuratorFeedbackStatus,
    processedBy: string
  ): Promise<void> {
    await executeStatement(
      `UPDATE axiom_curator_feedback 
       SET status = $1, processed_at = NOW(), processed_by = $2
       WHERE feedback_id = $3`,
      [
        stringParam('status', status),
        stringParam('processedBy', processedBy),
        stringParam('feedbackId', feedbackId),
      ]
    );

    // If implemented and it's a taxonomy suggestion, trigger domain update
    if (status === 'implemented') {
      const feedback = await this.getFeedback(feedbackId);
      if (feedback?.feedbackType === 'taxonomy_suggestion' && feedback.suggestedContent) {
        await this.applyTaxonomySuggestion(feedback);
      }
    }

    logger.info('[AXIOM:CURATOR] Feedback processed', { feedbackId, status, processedBy });
  }

  /**
   * Get a specific feedback entry
   */
  async getFeedback(feedbackId: string): Promise<CuratorFeedback | null> {
    const result = await executeStatement(
      `SELECT * FROM axiom_curator_feedback WHERE feedback_id = $1`,
      [stringParam('feedbackId', feedbackId)]
    );

    if (result.rows.length === 0) return null;
    return this.parseFeedbackRow(result.rows[0] as any);
  }

  // ===========================================================================
  // Expert-Validated Patterns
  // ===========================================================================

  /**
   * Promote a pattern as curator-validated (high weight)
   */
  async promotePattern(params: {
    patternId: string;
    curatorUserId: string;
    tenantId: string;
    validationScore?: number;
    weightBoost?: number;
  }): Promise<CuratorPattern> {
    const boost = params.weightBoost || 0.2;

    await executeStatement(
      `INSERT INTO axiom_curator_patterns (
        pattern_id, curator_user_id, tenant_id, validation_status,
        validation_score, weight_boost, promoted_at, created_at
      ) VALUES ($1, $2, $3, 'validated', $4, $5, NOW(), NOW())
      ON CONFLICT (pattern_id) DO UPDATE SET
        validation_status = 'validated',
        validation_score = EXCLUDED.validation_score,
        weight_boost = EXCLUDED.weight_boost,
        promoted_at = NOW()`,
      [
        stringParam('patternId', params.patternId),
        stringParam('curatorUserId', params.curatorUserId),
        stringParam('tenantId', params.tenantId),
        params.validationScore ? doubleParam('score', params.validationScore) : doubleParam('score', 0),
        doubleParam('boost', boost),
      ]
    );

    logger.info('[AXIOM:CURATOR] Pattern promoted', {
      patternId: params.patternId,
      curatorUserId: params.curatorUserId,
      boost,
    });

    return {
      patternId: params.patternId,
      curatorUserId: params.curatorUserId,
      tenantId: params.tenantId,
      validationStatus: 'validated',
      validationScore: params.validationScore,
      weightBoost: boost,
      promotedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get curator-promoted patterns for a domain
   */
  async getPromotedPatterns(domainId: string, tenantId?: string): Promise<CuratorPattern[]> {
    let query = `SELECT cp.*, p.domain_id, p.content
                 FROM axiom_curator_patterns cp
                 JOIN axiom_prompt_patterns p ON cp.pattern_id = p.pattern_id
                 WHERE p.domain_id = $1 AND cp.validation_status = 'validated'`;
    const params: any[] = [stringParam('domainId', domainId)];

    if (tenantId) {
      query += ` AND cp.tenant_id = $2`;
      params.push(stringParam('tenantId', tenantId));
    }

    query += ` ORDER BY cp.weight_boost DESC`;

    const result = await executeStatement(query, params);
    return result.rows.map((row: any) => ({
      patternId: row.pattern_id,
      curatorUserId: row.curator_user_id,
      tenantId: row.tenant_id,
      validationStatus: row.validation_status,
      validationScore: row.validation_score ? Number(row.validation_score) : undefined,
      weightBoost: Number(row.weight_boost) || 0.2,
      promotedAt: row.promoted_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get weight boost for a pattern (used in pattern retrieval)
   */
  async getPatternBoost(patternId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT weight_boost FROM axiom_curator_patterns 
       WHERE pattern_id = $1 AND validation_status = 'validated'`,
      [stringParam('patternId', patternId)]
    );

    if (result.rows.length === 0) return 0;
    return Number((result.rows[0] as any).weight_boost) || 0;
  }

  // ===========================================================================
  // Domain Flagging
  // ===========================================================================

  /**
   * Flag a domain as needing attention
   */
  async flagDomain(params: {
    domainId: string;
    tenantId?: string;
    flagType: DomainFlagType;
    severity?: DomainFlagSeverity;
    description?: string;
    flaggedBy?: string;
    autoDetected?: boolean;
  }): Promise<DomainFlag> {
    const flagId = `flag-${uuidv4()}`;
    const severity = params.severity || 'medium';
    const autoDetected = params.autoDetected ?? (params.flaggedBy === undefined);

    await executeStatement(
      `INSERT INTO axiom_domain_flags (
        flag_id, domain_id, tenant_id, flag_type, severity,
        description, auto_detected, flagged_by, resolved, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW())`,
      [
        stringParam('flagId', flagId),
        stringParam('domainId', params.domainId),
        stringParam('tenantId', params.tenantId || ''),
        stringParam('flagType', params.flagType),
        stringParam('severity', severity),
        stringParam('description', params.description || ''),
        stringParam('autoDetected', String(autoDetected)),
        stringParam('flaggedBy', params.flaggedBy || ''),
      ]
    );

    logger.info('[AXIOM:CURATOR] Domain flagged', {
      flagId,
      domainId: params.domainId,
      flagType: params.flagType,
      severity,
    });

    return {
      flagId,
      domainId: params.domainId,
      tenantId: params.tenantId,
      flagType: params.flagType,
      severity,
      description: params.description,
      autoDetected,
      flaggedBy: params.flaggedBy,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get unresolved domain flags
   */
  async getUnresolvedFlags(tenantId?: string, limit: number = 50): Promise<DomainFlag[]> {
    let query = `SELECT * FROM axiom_domain_flags WHERE resolved = false`;
    const params: any[] = [];

    if (tenantId) {
      query += ` AND (tenant_id = $1 OR tenant_id IS NULL OR tenant_id = '')`;
      params.push(stringParam('tenantId', tenantId));
    }

    query += ` ORDER BY 
      CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
      END, 
      created_at DESC 
      LIMIT $${params.length + 1}`;
    params.push(longParam('limit', limit));

    const result = await executeStatement(query, params);
    return result.rows.map((row: any) => this.parseFlagRow(row));
  }

  /**
   * Resolve a domain flag
   */
  async resolveFlag(flagId: string, resolvedBy: string): Promise<void> {
    await executeStatement(
      `UPDATE axiom_domain_flags 
       SET resolved = true, resolved_by = $1, resolved_at = NOW()
       WHERE flag_id = $2`,
      [
        stringParam('resolvedBy', resolvedBy),
        stringParam('flagId', flagId),
      ]
    );

    logger.info('[AXIOM:CURATOR] Domain flag resolved', { flagId, resolvedBy });
  }

  /**
   * Auto-detect domains needing attention
   */
  async detectProblematicDomains(): Promise<DomainFlag[]> {
    const flags: DomainFlag[] = [];

    // Find domains with high skip rates
    const highSkipResult = await executeStatement(
      `SELECT domain, AVG(skip_count::float / NULLIF(ask_count, 0)) as skip_rate
       FROM clarion_question_effectiveness
       GROUP BY domain
       HAVING AVG(skip_count::float / NULLIF(ask_count, 0)) > 0.5`,
      []
    );

    for (const row of highSkipResult.rows as any[]) {
      const existing = await this.checkExistingFlag(row.domain, 'high_skip_rate');
      if (!existing) {
        const flag = await this.flagDomain({
          domainId: row.domain,
          flagType: 'high_skip_rate',
          severity: 'medium',
          description: `Skip rate: ${(Number(row.skip_rate) * 100).toFixed(1)}%`,
          autoDetected: true,
        });
        flags.push(flag);
      }
    }

    // Find domains with low pattern coverage
    const lowPatternResult = await executeStatement(
      `SELECT DISTINCT s.domain
       FROM clarion_sessions s
       LEFT JOIN axiom_prompt_patterns p ON s.domain = p.domain_id
       WHERE p.pattern_id IS NULL
       AND s.created_at > NOW() - INTERVAL '7 days'`,
      []
    );

    for (const row of lowPatternResult.rows as any[]) {
      const existing = await this.checkExistingFlag(row.domain, 'needs_patterns');
      if (!existing) {
        const flag = await this.flagDomain({
          domainId: row.domain,
          flagType: 'needs_patterns',
          severity: 'high',
          description: 'Domain has no patterns defined',
          autoDetected: true,
        });
        flags.push(flag);
      }
    }

    // Find domains with low average confidence
    const lowConfidenceResult = await executeStatement(
      `SELECT domain, AVG(current_confidence) as avg_confidence
       FROM clarion_sessions
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY domain
       HAVING AVG(current_confidence) < 0.5`,
      []
    );

    for (const row of lowConfidenceResult.rows as any[]) {
      const existing = await this.checkExistingFlag(row.domain, 'low_confidence');
      if (!existing) {
        const flag = await this.flagDomain({
          domainId: row.domain,
          flagType: 'low_confidence',
          severity: 'medium',
          description: `Average confidence: ${(Number(row.avg_confidence) * 100).toFixed(1)}%`,
          autoDetected: true,
        });
        flags.push(flag);
      }
    }

    return flags;
  }

  /**
   * Check if a flag already exists for a domain/type
   */
  private async checkExistingFlag(domainId: string, flagType: string): Promise<boolean> {
    const result = await executeStatement(
      `SELECT 1 FROM axiom_domain_flags 
       WHERE domain_id = $1 AND flag_type = $2 AND resolved = false`,
      [stringParam('domainId', domainId), stringParam('flagType', flagType)]
    );
    return result.rows.length > 0;
  }

  // ===========================================================================
  // Quality Signal Integration
  // ===========================================================================

  /**
   * Record quality signal from Curator that feeds into fitness function
   */
  async recordQualitySignal(params: {
    tenantId: string;
    curatorUserId: string;
    patternId: string;
    qualityScore: number;  // 0-1
    dimensions?: {
      accuracy?: number;
      relevance?: number;
      completeness?: number;
      clarity?: number;
    };
  }): Promise<void> {
    // Update pattern success rate based on curator quality signal
    const weight = 0.3; // Curator signals have 30% weight
    
    await executeStatement(
      `UPDATE axiom_prompt_patterns 
       SET success_rate = success_rate * (1 - $1) + $2 * $1,
           updated_at = NOW()
       WHERE pattern_id = $3`,
      [
        doubleParam('weight', weight),
        doubleParam('qualityScore', params.qualityScore),
        stringParam('patternId', params.patternId),
      ]
    );

    // Record the feedback
    await this.submitFeedback({
      tenantId: params.tenantId,
      curatorUserId: params.curatorUserId,
      domainId: '', // Will be looked up
      feedbackType: 'pattern_quality',
      targetId: params.patternId,
      rating: Math.round(params.qualityScore * 5),
      notes: params.dimensions ? JSON.stringify(params.dimensions) : undefined,
    });

    logger.info('[AXIOM:CURATOR] Quality signal recorded', {
      patternId: params.patternId,
      qualityScore: params.qualityScore,
    });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private async applyTaxonomySuggestion(feedback: CuratorFeedback): Promise<void> {
    if (!feedback.suggestedContent) return;

    try {
      const suggestion = JSON.parse(feedback.suggestedContent);
      
      // Apply domain signature update if suggested
      if (suggestion.template) {
        await executeStatement(
          `UPDATE axiom_domain_signatures 
           SET template = $1, updated_at = NOW()
           WHERE domain_id = $2`,
          [
            stringParam('template', JSON.stringify(suggestion.template)),
            stringParam('domainId', feedback.domainId),
          ]
        );
      }

      logger.info('[AXIOM:CURATOR] Taxonomy suggestion applied', {
        feedbackId: feedback.feedbackId,
        domainId: feedback.domainId,
      });
    } catch (error) {
      logger.error('[AXIOM:CURATOR] Failed to apply taxonomy suggestion', {
        feedbackId: feedback.feedbackId,
        error,
      });
    }
  }

  private parseFeedbackRow(row: any): CuratorFeedback {
    return {
      feedbackId: row.feedback_id,
      tenantId: row.tenant_id,
      curatorUserId: row.curator_user_id,
      domainId: row.domain_id,
      feedbackType: row.feedback_type,
      targetId: row.target_id || undefined,
      rating: row.rating ? Number(row.rating) : undefined,
      notes: row.notes || undefined,
      suggestedContent: row.suggested_content || undefined,
      status: row.status,
      createdAt: row.created_at,
      processedAt: row.processed_at || undefined,
      processedBy: row.processed_by || undefined,
    };
  }

  private parseFlagRow(row: any): DomainFlag {
    return {
      flagId: row.flag_id,
      domainId: row.domain_id,
      tenantId: row.tenant_id || undefined,
      flagType: row.flag_type,
      severity: row.severity,
      description: row.description || undefined,
      autoDetected: row.auto_detected === true || row.auto_detected === 'true',
      flaggedBy: row.flagged_by || undefined,
      resolved: row.resolved === true || row.resolved === 'true',
      resolvedBy: row.resolved_by || undefined,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at || undefined,
    };
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const axiomCuratorService = new AxiomCuratorService();
