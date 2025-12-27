// RADIANT v4.18.0 - AGI Self-Improvement Service
// Self-aware performance tracking, improvement proposals, idea evolution, and deprecation

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';
import type { SqlParameter } from '@aws-sdk/client-rds-data';

// ============================================================================
// Types
// ============================================================================

export interface SelfImprovementIdea {
  ideaId: string;
  ideaCode: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  originType: string;
  problemStatement?: string;
  proposedSolution?: string;
  status: string;
  version: number;
  isDeprecated: boolean;
  deprecationReason?: string;
  supersededById?: string;
  confidenceScore: number;
  impactScore?: number;
  feasibilityScore?: number;
  urgencyScore?: number;
  compositeScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceSelfAwareness {
  awarenessId: string;
  capabilityArea: string;
  selfAssessedStrength: number;
  selfAssessedWeakness: number;
  actualPerformance?: number;
  performanceTrend?: string;
  assessmentAccuracy: number;
  identifiedWeaknesses: string[];
  improvementOpportunities: string[];
}

export interface SelfAnalysisSession {
  sessionId: string;
  analysisType: string;
  areasAnalyzed: string[];
  performanceSummary: Record<string, unknown>;
  strengthsIdentified: string[];
  weaknessesIdentified: string[];
  newIdeasGenerated: number;
  ideasUpdated: number;
  ideasDeprecated: number;
  completedAt?: string;
}

export interface ImprovementNotification {
  notificationId: string;
  notificationType: string;
  title: string;
  message?: string;
  relatedIdeaId?: string;
  priority: string;
  read: boolean;
  requiresAction: boolean;
  createdAt: string;
}

export interface IdeaEvolution {
  evolutionId: string;
  ideaId: string;
  versionFrom: number;
  versionTo: number;
  changeType: string;
  changeSummary: string;
  triggeredBy: string;
  createdAt: string;
}

// ============================================================================
// Self-Improvement Service
// ============================================================================

export class SelfImprovementService {
  // ============================================================================
  // Idea Management
  // ============================================================================

  async createIdea(
    tenantId: string | null,
    title: string,
    description: string,
    category: string,
    originType: string,
    options: {
      problemStatement?: string;
      proposedSolution?: string;
      confidence?: number;
      affectedCapabilities?: string[];
    } = {}
  ): Promise<SelfImprovementIdea> {
    const result = await executeStatement(
      `SELECT create_improvement_idea($1, $2, $3, $4, $5, $6, $7, $8) as idea_id`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'title', value: { stringValue: title } },
        { name: 'description', value: { stringValue: description } },
        { name: 'category', value: { stringValue: category } },
        { name: 'originType', value: { stringValue: originType } },
        { name: 'problemStatement', value: options.problemStatement ? { stringValue: options.problemStatement } : { isNull: true } },
        { name: 'proposedSolution', value: options.proposedSolution ? { stringValue: options.proposedSolution } : { isNull: true } },
        { name: 'confidence', value: { doubleValue: options.confidence || 0.5 } },
      ]
    );

    const ideaId = String((result.rows[0] as { idea_id: string }).idea_id);
    
    // Update affected capabilities if provided
    if (options.affectedCapabilities && options.affectedCapabilities.length > 0) {
      await executeStatement(
        `UPDATE self_improvement_ideas SET affected_capabilities = $2 WHERE idea_id = $1`,
        [
          { name: 'ideaId', value: { stringValue: ideaId } },
          { name: 'capabilities', value: { stringValue: `{${options.affectedCapabilities.join(',')}}` } },
        ]
      );
    }

    return (await this.getIdea(ideaId))!;
  }

  async getIdea(ideaId: string): Promise<SelfImprovementIdea | null> {
    const result = await executeStatement(
      `SELECT * FROM self_improvement_ideas WHERE idea_id = $1`,
      [{ name: 'ideaId', value: { stringValue: ideaId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapIdea(result.rows[0] as Record<string, unknown>);
  }

  async getIdeas(options: {
    tenantId?: string;
    status?: string;
    category?: string;
    includeDeprecated?: boolean;
    limit?: number;
    orderBy?: 'composite_score' | 'created_at' | 'priority';
  } = {}): Promise<SelfImprovementIdea[]> {
    let sql = `SELECT * FROM self_improvement_ideas WHERE 1=1`;
    const params: SqlParameter[] = [];
    let paramIndex = 1;

    if (options.tenantId) {
      sql += ` AND (tenant_id = $${paramIndex++} OR tenant_id IS NULL)`;
      params.push({ name: 'tenantId', value: { stringValue: options.tenantId } });
    }

    if (options.status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push({ name: 'status', value: { stringValue: options.status } });
    }

    if (options.category) {
      sql += ` AND category = $${paramIndex++}`;
      params.push({ name: 'category', value: { stringValue: options.category } });
    }

    if (!options.includeDeprecated) {
      sql += ` AND is_deprecated = false`;
    }

    const orderBy = options.orderBy || 'composite_score';
    sql += ` ORDER BY ${orderBy} DESC NULLS LAST`;

    sql += ` LIMIT $${paramIndex}`;
    params.push({ name: 'limit', value: { longValue: options.limit || 50 } });

    const result = await executeStatement(sql, params);
    return result.rows.map(row => this.mapIdea(row as Record<string, unknown>));
  }

  async updateIdeaStatus(ideaId: string, status: string, reviewedBy?: string): Promise<void> {
    await executeStatement(
      `UPDATE self_improvement_ideas SET 
        status = $2, 
        reviewed_by = COALESCE($3, reviewed_by),
        approved_by = CASE WHEN $2 = 'approved' THEN COALESCE($3, 'admin') ELSE approved_by END
      WHERE idea_id = $1`,
      [
        { name: 'ideaId', value: { stringValue: ideaId } },
        { name: 'status', value: { stringValue: status } },
        { name: 'reviewedBy', value: reviewedBy ? { stringValue: reviewedBy } : { isNull: true } },
      ]
    );
  }

  async updateIdeaScores(
    ideaId: string,
    scores: {
      confidence?: number;
      impact?: number;
      feasibility?: number;
      urgency?: number;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const params: SqlParameter[] = [
      { name: 'ideaId', value: { stringValue: ideaId } },
    ];

    if (scores.confidence !== undefined) {
      updates.push(`confidence_score = $${params.length + 1}`);
      params.push({ name: 'confidence', value: { doubleValue: scores.confidence } });
    }
    if (scores.impact !== undefined) {
      updates.push(`impact_score = $${params.length + 1}`);
      params.push({ name: 'impact', value: { doubleValue: scores.impact } });
    }
    if (scores.feasibility !== undefined) {
      updates.push(`feasibility_score = $${params.length + 1}`);
      params.push({ name: 'feasibility', value: { doubleValue: scores.feasibility } });
    }
    if (scores.urgency !== undefined) {
      updates.push(`urgency_score = $${params.length + 1}`);
      params.push({ name: 'urgency', value: { doubleValue: scores.urgency } });
    }

    if (updates.length > 0) {
      await executeStatement(
        `UPDATE self_improvement_ideas SET ${updates.join(', ')} WHERE idea_id = $1`,
        params
      );
    }
  }

  // ============================================================================
  // Idea Evolution
  // ============================================================================

  async evolveIdea(
    ideaId: string,
    changeType: 'refinement' | 'expansion' | 'pivot' | 'split' | 'merge',
    changeSummary: string,
    changes: Record<string, { old: unknown; new: unknown }>
  ): Promise<number> {
    // Apply changes to the idea
    const changeEntries = Object.entries(changes);
    if (changeEntries.length > 0) {
      const updates: string[] = [];
      const params: SqlParameter[] = [
        { name: 'ideaId', value: { stringValue: ideaId } },
      ];

      for (const [field, { new: newValue }] of changeEntries) {
        const dbField = this.toSnakeCase(field);
        updates.push(`${dbField} = $${params.length + 1}`);
        
        if (typeof newValue === 'string') {
          params.push({ name: field, value: { stringValue: newValue } });
        } else if (typeof newValue === 'number') {
          params.push({ name: field, value: { doubleValue: newValue } });
        } else if (typeof newValue === 'boolean') {
          params.push({ name: field, value: { booleanValue: newValue } });
        } else {
          params.push({ name: field, value: { stringValue: JSON.stringify(newValue) } });
        }
      }

      if (updates.length > 0) {
        await executeStatement(
          `UPDATE self_improvement_ideas SET ${updates.join(', ')} WHERE idea_id = $1`,
          params
        );
      }
    }

    // Record evolution
    const result = await executeStatement(
      `SELECT evolve_improvement_idea($1, $2, $3, $4, $5) as new_version`,
      [
        { name: 'ideaId', value: { stringValue: ideaId } },
        { name: 'changeType', value: { stringValue: changeType } },
        { name: 'changeSummary', value: { stringValue: changeSummary } },
        { name: 'changes', value: { stringValue: JSON.stringify(changes) } },
        { name: 'trigger', value: { stringValue: 'agi_self_evolution' } },
      ]
    );

    return Number((result.rows[0] as { new_version: number }).new_version);
  }

  async deprecateIdea(ideaId: string, reason: string, supersededById?: string): Promise<void> {
    await executeStatement(
      `SELECT deprecate_improvement_idea($1, $2, $3)`,
      [
        { name: 'ideaId', value: { stringValue: ideaId } },
        { name: 'reason', value: { stringValue: reason } },
        { name: 'supersededById', value: supersededById ? { stringValue: supersededById } : { isNull: true } },
      ]
    );
  }

  async getEvolutionHistory(ideaId: string): Promise<IdeaEvolution[]> {
    const result = await executeStatement(
      `SELECT * FROM improvement_evolution_history WHERE idea_id = $1 ORDER BY created_at DESC`,
      [{ name: 'ideaId', value: { stringValue: ideaId } }]
    );

    return result.rows.map(row => this.mapEvolution(row as Record<string, unknown>));
  }

  async autoDeprecateStaleIdeas(): Promise<number> {
    const result = await executeStatement(
      `SELECT auto_deprecate_stale_ideas() as count`,
      []
    );
    return Number((result.rows[0] as { count: number }).count);
  }

  // ============================================================================
  // Self-Analysis
  // ============================================================================

  async runSelfAnalysis(
    tenantId: string | null,
    analysisType: 'scheduled' | 'triggered' | 'manual',
    areasToAnalyze?: string[]
  ): Promise<SelfAnalysisSession> {
    const startTime = Date.now();

    // Create session
    const sessionResult = await executeStatement(
      `INSERT INTO self_analysis_sessions (tenant_id, analysis_type, areas_analyzed)
       VALUES ($1, $2, $3)
       RETURNING session_id`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'analysisType', value: { stringValue: analysisType } },
        { name: 'areas', value: { stringValue: `{${(areasToAnalyze || ['reasoning', 'memory', 'performance', 'safety']).join(',')}}` } },
      ]
    );

    const sessionId = (sessionResult.rows[0] as { session_id: string }).session_id;

    // Run analysis
    const analysis = await this.performSelfAnalysis(tenantId, areasToAnalyze);

    // Generate improvement ideas from analysis
    const generatedIds: string[] = [];
    let ideasUpdated = 0;
    let ideasDeprecated = 0;

    for (const weakness of analysis.weaknessesIdentified) {
      // Check if similar idea exists
      const existingResult = await executeStatement(
        `SELECT idea_id, version FROM self_improvement_ideas 
         WHERE description ILIKE '%' || $1 || '%' AND NOT is_deprecated
         LIMIT 1`,
        [{ name: 'weakness', value: { stringValue: weakness.substring(0, 50) } }]
      );

      if (existingResult.rows.length === 0) {
        // Create new idea
        const newIdea = await this.createIdea(
          tenantId,
          `Address: ${weakness.substring(0, 100)}`,
          weakness,
          'performance',
          'self_generated',
          {
            problemStatement: weakness,
            confidence: analysis.confidenceLevel,
          }
        );
        generatedIds.push(newIdea.ideaId);
      } else {
        // Update existing idea's confidence
        const existing = existingResult.rows[0] as { idea_id: string };
        await this.updateIdeaScores(existing.idea_id, {
          confidence: Math.min(1, analysis.confidenceLevel + 0.1),
        });
        ideasUpdated++;
      }
    }

    // Auto-deprecate stale ideas
    ideasDeprecated = await this.autoDeprecateStaleIdeas();

    // Update session
    await executeStatement(
      `UPDATE self_analysis_sessions SET
        performance_summary = $2,
        strengths_identified = $3,
        weaknesses_identified = $4,
        new_ideas_generated = $5,
        ideas_updated = $6,
        ideas_deprecated = $7,
        generated_idea_ids = $8,
        analysis_depth = $9,
        confidence_level = $10,
        completed_at = NOW(),
        duration_ms = $11
      WHERE session_id = $1`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'summary', value: { stringValue: JSON.stringify(analysis.performanceSummary) } },
        { name: 'strengths', value: { stringValue: JSON.stringify(analysis.strengthsIdentified) } },
        { name: 'weaknesses', value: { stringValue: JSON.stringify(analysis.weaknessesIdentified) } },
        { name: 'newIdeas', value: { longValue: generatedIds.length } },
        { name: 'updated', value: { longValue: ideasUpdated } },
        { name: 'deprecated', value: { longValue: ideasDeprecated } },
        { name: 'generatedIds', value: { stringValue: `{${generatedIds.join(',')}}` } },
        { name: 'depth', value: { stringValue: 'moderate' } },
        { name: 'confidence', value: { doubleValue: analysis.confidenceLevel } },
        { name: 'duration', value: { longValue: Date.now() - startTime } },
      ]
    );

    return {
      sessionId,
      analysisType,
      areasAnalyzed: areasToAnalyze || ['reasoning', 'memory', 'performance', 'safety'],
      performanceSummary: analysis.performanceSummary,
      strengthsIdentified: analysis.strengthsIdentified,
      weaknessesIdentified: analysis.weaknessesIdentified,
      newIdeasGenerated: generatedIds.length,
      ideasUpdated,
      ideasDeprecated,
      completedAt: new Date().toISOString(),
    };
  }

  private async performSelfAnalysis(
    tenantId: string | null,
    areas?: string[]
  ): Promise<{
    performanceSummary: Record<string, unknown>;
    strengthsIdentified: string[];
    weaknessesIdentified: string[];
    confidenceLevel: number;
  }> {
    const prompt = `You are an AGI system performing self-analysis. Analyze your own capabilities and performance.

AREAS TO ANALYZE: ${(areas || ['reasoning', 'memory', 'performance', 'safety']).join(', ')}

Based on typical AGI system behavior patterns, identify:
1. Strengths - areas where performance is strong
2. Weaknesses - areas needing improvement
3. Specific improvement opportunities

Be critical and honest. Focus on actionable improvements.

Return JSON:
{
  "performance_summary": {
    "overall_assessment": "brief overall assessment",
    "by_area": {
      "reasoning": {"score": 0.0-1.0, "notes": "..."},
      "memory": {"score": 0.0-1.0, "notes": "..."},
      "performance": {"score": 0.0-1.0, "notes": "..."},
      "safety": {"score": 0.0-1.0, "notes": "..."}
    }
  },
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1 with specific improvement opportunity", "weakness 2..."],
  "confidence_in_assessment": 0.0-1.0
}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1500,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          performanceSummary: parsed.performance_summary || {},
          strengthsIdentified: parsed.strengths || [],
          weaknessesIdentified: parsed.weaknesses || [],
          confidenceLevel: parsed.confidence_in_assessment || 0.7,
        };
      }
    } catch { /* analysis failed */ }

    return {
      performanceSummary: {},
      strengthsIdentified: [],
      weaknessesIdentified: [],
      confidenceLevel: 0.5,
    };
  }

  // ============================================================================
  // Performance Self-Awareness
  // ============================================================================

  async recordSelfAwareness(
    tenantId: string,
    capability: string,
    selfStrength: number,
    selfWeakness: number,
    actualPerformance?: number
  ): Promise<string> {
    const result = await executeStatement(
      `SELECT record_self_awareness($1, $2, $3, $4, $5) as awareness_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'capability', value: { stringValue: capability } },
        { name: 'selfStrength', value: { doubleValue: selfStrength } },
        { name: 'selfWeakness', value: { doubleValue: selfWeakness } },
        { name: 'actualPerformance', value: actualPerformance !== undefined ? { doubleValue: actualPerformance } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as { awareness_id: string }).awareness_id);
  }

  async getSelfAwareness(tenantId: string): Promise<PerformanceSelfAwareness[]> {
    const result = await executeStatement(
      `SELECT * FROM performance_self_awareness 
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY capability_area`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapSelfAwareness(row as Record<string, unknown>));
  }

  // ============================================================================
  // Notifications
  // ============================================================================

  async getNotifications(
    tenantId: string,
    options: { unreadOnly?: boolean; limit?: number } = {}
  ): Promise<ImprovementNotification[]> {
    const result = await executeStatement(
      `SELECT * FROM improvement_notifications
       WHERE (tenant_id = $1 OR tenant_id IS NULL)
         ${options.unreadOnly ? 'AND read = false' : ''}
       ORDER BY created_at DESC
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: options.limit || 50 } },
      ]
    );

    return result.rows.map(row => this.mapNotification(row as Record<string, unknown>));
  }

  async markNotificationRead(notificationId: string, readBy: string): Promise<void> {
    await executeStatement(
      `UPDATE improvement_notifications SET read = true, read_by = $2, read_at = NOW()
       WHERE notification_id = $1`,
      [
        { name: 'notificationId', value: { stringValue: notificationId } },
        { name: 'readBy', value: { stringValue: readBy } },
      ]
    );
  }

  async getUnreadCount(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM improvement_notifications
       WHERE (tenant_id = $1 OR tenant_id IS NULL) AND read = false`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return Number((result.rows[0] as { count: number }).count);
  }

  // ============================================================================
  // Dashboard Stats
  // ============================================================================

  async getDashboardStats(tenantId: string): Promise<{
    totalIdeas: number;
    activeIdeas: number;
    deprecatedIdeas: number;
    implementedIdeas: number;
    pendingReview: number;
    recentAnalyses: number;
    unreadNotifications: number;
    topCategories: Array<{ category: string; count: number }>;
    statusBreakdown: Array<{ status: string; count: number }>;
  }> {
    const statsResult = await executeStatement(
      `SELECT 
        COUNT(*) as total_ideas,
        COUNT(*) FILTER (WHERE NOT is_deprecated AND status NOT IN ('deprecated', 'rejected')) as active_ideas,
        COUNT(*) FILTER (WHERE is_deprecated) as deprecated_ideas,
        COUNT(*) FILTER (WHERE status = 'implemented' OR status = 'validated') as implemented_ideas,
        COUNT(*) FILTER (WHERE status = 'proposed' OR status = 'under_review') as pending_review
      FROM self_improvement_ideas
      WHERE tenant_id = $1 OR tenant_id IS NULL`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const analysesResult = await executeStatement(
      `SELECT COUNT(*) as count FROM self_analysis_sessions
       WHERE (tenant_id = $1 OR tenant_id IS NULL) AND completed_at > NOW() - INTERVAL '7 days'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const categoriesResult = await executeStatement(
      `SELECT category, COUNT(*) as count FROM self_improvement_ideas
       WHERE (tenant_id = $1 OR tenant_id IS NULL) AND NOT is_deprecated
       GROUP BY category ORDER BY count DESC LIMIT 5`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const statusResult = await executeStatement(
      `SELECT status, COUNT(*) as count FROM self_improvement_ideas
       WHERE (tenant_id = $1 OR tenant_id IS NULL)
       GROUP BY status ORDER BY count DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const stats = statsResult.rows[0] as Record<string, unknown>;
    const analyses = analysesResult.rows[0] as { count: number };

    return {
      totalIdeas: Number(stats.total_ideas || 0),
      activeIdeas: Number(stats.active_ideas || 0),
      deprecatedIdeas: Number(stats.deprecated_ideas || 0),
      implementedIdeas: Number(stats.implemented_ideas || 0),
      pendingReview: Number(stats.pending_review || 0),
      recentAnalyses: Number(analyses.count || 0),
      unreadNotifications: await this.getUnreadCount(tenantId),
      topCategories: categoriesResult.rows.map(r => ({
        category: String((r as Record<string, unknown>).category),
        count: Number((r as Record<string, unknown>).count),
      })),
      statusBreakdown: statusResult.rows.map(r => ({
        status: String((r as Record<string, unknown>).status),
        count: Number((r as Record<string, unknown>).count),
      })),
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private mapIdea(row: Record<string, unknown>): SelfImprovementIdea {
    return {
      ideaId: String(row.idea_id),
      ideaCode: String(row.idea_code),
      title: String(row.title),
      description: String(row.description),
      category: String(row.category),
      priority: String(row.priority || 'medium'),
      originType: String(row.origin_type),
      problemStatement: row.problem_statement ? String(row.problem_statement) : undefined,
      proposedSolution: row.proposed_solution ? String(row.proposed_solution) : undefined,
      status: String(row.status || 'proposed'),
      version: Number(row.version || 1),
      isDeprecated: Boolean(row.is_deprecated),
      deprecationReason: row.deprecation_reason ? String(row.deprecation_reason) : undefined,
      supersededById: row.superseded_by_id ? String(row.superseded_by_id) : undefined,
      confidenceScore: Number(row.confidence_score ?? 0.5),
      impactScore: row.impact_score ? Number(row.impact_score) : undefined,
      feasibilityScore: row.feasibility_score ? Number(row.feasibility_score) : undefined,
      urgencyScore: row.urgency_score ? Number(row.urgency_score) : undefined,
      compositeScore: row.composite_score ? Number(row.composite_score) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapEvolution(row: Record<string, unknown>): IdeaEvolution {
    return {
      evolutionId: String(row.evolution_id),
      ideaId: String(row.idea_id),
      versionFrom: Number(row.version_from),
      versionTo: Number(row.version_to),
      changeType: String(row.change_type),
      changeSummary: String(row.change_summary),
      triggeredBy: String(row.triggered_by || 'agi_self_evolution'),
      createdAt: String(row.created_at),
    };
  }

  private mapSelfAwareness(row: Record<string, unknown>): PerformanceSelfAwareness {
    return {
      awarenessId: String(row.awareness_id),
      capabilityArea: String(row.capability_area),
      selfAssessedStrength: Number(row.self_assessed_strength ?? 0.5),
      selfAssessedWeakness: Number(row.self_assessed_weakness ?? 0.5),
      actualPerformance: row.actual_performance ? Number(row.actual_performance) : undefined,
      performanceTrend: row.performance_trend ? String(row.performance_trend) : undefined,
      assessmentAccuracy: Number(row.assessment_accuracy ?? 0.5),
      identifiedWeaknesses: typeof row.identified_weaknesses === 'string'
        ? JSON.parse(row.identified_weaknesses)
        : (row.identified_weaknesses as string[]) || [],
      improvementOpportunities: typeof row.improvement_opportunities === 'string'
        ? JSON.parse(row.improvement_opportunities)
        : (row.improvement_opportunities as string[]) || [],
    };
  }

  private mapNotification(row: Record<string, unknown>): ImprovementNotification {
    return {
      notificationId: String(row.notification_id),
      notificationType: String(row.notification_type),
      title: String(row.title),
      message: row.message ? String(row.message) : undefined,
      relatedIdeaId: row.related_idea_id ? String(row.related_idea_id) : undefined,
      priority: String(row.priority || 'normal'),
      read: Boolean(row.read),
      requiresAction: Boolean(row.requires_action),
      createdAt: String(row.created_at),
    };
  }
}

export const selfImprovementService = new SelfImprovementService();
