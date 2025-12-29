/**
 * RADIANT v4.18.0 - Pre-Prompt Learning Service
 * Selects, tracks, and learns from pre-prompt effectiveness
 */

import { executeStatement, stringParam, longParam } from '../db/client';
import { enhancedLogger } from '../logging/enhanced-logger';
import { userRulesService } from './user-rules.service';
import { v4 as uuidv4 } from 'uuid';

import type { OrchestrationMode } from '@radiant/shared';
import type { AppliedUserRules } from '@radiant/shared';
import type {
  PrepromptTemplate,
  PrepromptInstance,
  PrepromptFeedback,
  PrepromptSelectionRequest,
  PrepromptSelectionResult,
  PrepromptSelectionLog,
  PrepromptEffectivenessSummary,
  PrepromptAdminDashboard,
  IssueAttribution,
  AttributionWeights,
} from '@radiant/shared';

const logger = enhancedLogger;

// ============================================================================
// Pre-Prompt Learning Service
// ============================================================================

class PrepromptLearningService {
  private configCache: Map<string, Record<string, unknown>> = new Map();
  private templateCache: Map<string, PrepromptTemplate> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheRefresh = 0;

  // ============================================================================
  // Template Selection
  // ============================================================================

  async selectPreprompt(request: PrepromptSelectionRequest): Promise<PrepromptSelectionResult> {
    const startTime = Date.now();
    
    // Get all applicable templates
    const templates = await this.getApplicableTemplates(
      request.orchestrationMode,
      request.detectedDomainId,
      request.modelId,
      request.taskType,
      request.complexity
    );

    if (templates.length === 0) {
      // Fall back to default template
      const defaultTemplate = await this.getDefaultTemplate(request.orchestrationMode);
      if (!defaultTemplate) {
        throw new Error('No applicable pre-prompt template found');
      }
      templates.push(defaultTemplate);
    }

    // Score each template
    const scoredTemplates = await Promise.all(
      templates.map(async (template) => {
        const score = await this.calculateTemplateScore(
          template,
          request.orchestrationMode,
          request.detectedDomainId,
          request.modelId,
          request.complexity,
          request.taskType
        );
        return { template, score };
      })
    );

    // Sort by score
    scoredTemplates.sort((a, b) => b.score.finalScore - a.score.finalScore);

    // Check for exploration (occasionally try lower-ranked templates to learn)
    const explorationConfig = await this.getExplorationConfig();
    const shouldExplore = Math.random() < explorationConfig.rate;
    
    let selectedIndex = 0;
    if (shouldExplore && scoredTemplates.length > 1) {
      // Pick a random template from top 3 (not the best one)
      const explorePool = Math.min(3, scoredTemplates.length);
      selectedIndex = 1 + Math.floor(Math.random() * (explorePool - 1));
    }

    // Handle preferred template override
    if (request.preferredTemplateCode) {
      const preferredIndex = scoredTemplates.findIndex(
        s => s.template.templateCode === request.preferredTemplateCode
      );
      if (preferredIndex >= 0) {
        selectedIndex = preferredIndex;
      }
    }

    const selected = scoredTemplates[selectedIndex];

    // Render the pre-prompt with variables
    const rendered = this.renderPreprompt(selected.template, request.variables);

    // Fetch and apply user rules
    let userRulesText = '';
    let userRulesCount = 0;
    try {
      const userRules = await userRulesService.getRulesForPrompt(
        request.tenantId,
        request.userId,
        request.detectedDomainId,
        request.orchestrationMode
      );
      
      // Append user rules to the full preprompt
      if (userRules && userRules.formattedForPrompt) {
        userRulesText = userRules.formattedForPrompt;
        userRulesCount = userRules.ruleCount;
        rendered.full = rendered.full + userRulesText;
        
        // Log rule applications
        for (const rule of userRules.rules) {
          await userRulesService.logRuleApplication(rule.id, request.planId, undefined, 'preprompt');
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch user rules, continuing without them', { error: err });
    }

    // Create instance record
    const instanceId = uuidv4();
    await this.createInstance({
      id: instanceId,
      planId: request.planId,
      templateId: selected.template.id,
      systemPromptRendered: rendered.systemPrompt,
      contextRendered: rendered.context,
      instructionRendered: rendered.instruction,
      fullPreprompt: rendered.full,
      tenantId: request.tenantId,
      userId: request.userId,
      modelId: request.modelId,
      orchestrationMode: request.orchestrationMode,
      detectedDomainId: request.detectedDomainId,
      taskType: request.taskType,
      complexity: request.complexity,
      status: 'pending',
      createdAt: new Date(),
    });

    // Log selection
    const selectionLog = await this.logSelection({
      instanceId,
      candidatesConsidered: scoredTemplates.length,
      selectionMethod: request.preferredTemplateCode ? 'admin_forced' : shouldExplore ? 'random_explore' : 'best_match',
      scoringBreakdown: {
        templateScores: scoredTemplates.slice(0, 5).map(s => ({
          templateId: s.template.id,
          templateCode: s.template.templateCode,
          baseScore: s.score.baseScore,
          domainBonus: s.score.domainBonus,
          modeBonus: s.score.modeBonus,
          modelBonus: s.score.modelBonus,
          feedbackAdjustment: s.score.feedbackAdjustment,
          finalScore: s.score.finalScore,
        })),
        selectionReason: this.generateSelectionReason(selected, request, shouldExplore),
      },
      explorationFactor: explorationConfig.rate,
      wasExploration: shouldExplore && selectedIndex > 0,
    });

    logger.info('Pre-prompt selected', {
      planId: request.planId,
      templateCode: selected.template.templateCode,
      score: selected.score.finalScore,
      wasExploration: shouldExplore && selectedIndex > 0,
      selectionTimeMs: Date.now() - startTime,
    });

    return {
      selectedTemplate: selected.template,
      renderedPreprompt: rendered,
      selectionLog,
      alternatives: scoredTemplates.slice(1, 4).map(s => ({
        template: s.template,
        score: s.score.finalScore,
        reason: `Score: ${s.score.finalScore.toFixed(3)}`,
      })),
    };
  }

  // ============================================================================
  // Template Scoring
  // ============================================================================

  private async calculateTemplateScore(
    template: PrepromptTemplate,
    mode: OrchestrationMode,
    domainId?: string,
    modelId?: string,
    complexity?: string,
    taskType?: string
  ): Promise<{
    baseScore: number;
    domainBonus: number;
    modeBonus: number;
    modelBonus: number;
    complexityBonus: number;
    taskTypeBonus: number;
    feedbackAdjustment: number;
    finalScore: number;
  }> {
    let baseScore = template.baseEffectivenessScore;
    let domainBonus = 0;
    let modeBonus = 0;
    let modelBonus = 0;
    let complexityBonus = 0;
    let taskTypeBonus = 0;
    let feedbackAdjustment = 0;

    // Mode bonus
    if (template.applicableModes.includes(mode)) {
      modeBonus = template.modeWeight;
      
      // Check attribution score for this mode
      const modeAttr = await this.getAttributionScore(template.id, 'mode', mode);
      if (modeAttr) {
        feedbackAdjustment += modeAttr.successCorrelation * template.feedbackWeight * modeAttr.confidence;
      }
    }

    // Domain bonus
    if (domainId && (template.applicableDomains.includes(domainId) || template.applicableDomains.length === 0)) {
      domainBonus = template.domainWeight;
      
      const domainAttr = await this.getAttributionScore(template.id, 'domain', domainId);
      if (domainAttr) {
        feedbackAdjustment += domainAttr.successCorrelation * template.feedbackWeight * domainAttr.confidence;
      }
    }

    // Model bonus
    if (modelId) {
      if (template.preferredModels.includes(modelId)) {
        modelBonus = template.modelWeight + 0.1;
      } else if (template.compatibleModels.includes(modelId) || template.compatibleModels.length === 0) {
        modelBonus = template.modelWeight;
      } else if (template.incompatibleModels.includes(modelId)) {
        modelBonus = -0.5; // Penalty
      }
      
      const modelAttr = await this.getAttributionScore(template.id, 'model', modelId);
      if (modelAttr) {
        feedbackAdjustment += modelAttr.successCorrelation * template.feedbackWeight * modelAttr.confidence;
      }
    }

    // Complexity bonus
    if (complexity && template.complexityRange.includes(complexity as any)) {
      complexityBonus = template.complexityWeight;
    }

    // Task type bonus
    if (taskType && (template.applicableTaskTypes.includes(taskType) || template.applicableTaskTypes.length === 0)) {
      taskTypeBonus = template.taskTypeWeight;
    }

    // Average feedback adjustment
    if (template.avgFeedbackScore !== undefined) {
      feedbackAdjustment += ((template.avgFeedbackScore - 3) / 10); // -0.2 to +0.2
    }

    const finalScore = Math.max(0, Math.min(2, 
      baseScore + domainBonus + modeBonus + modelBonus + complexityBonus + taskTypeBonus + feedbackAdjustment
    ));

    return {
      baseScore,
      domainBonus,
      modeBonus,
      modelBonus,
      complexityBonus,
      taskTypeBonus,
      feedbackAdjustment,
      finalScore,
    };
  }

  // ============================================================================
  // Template Rendering
  // ============================================================================

  private renderPreprompt(
    template: PrepromptTemplate,
    variables: Record<string, string>
  ): {
    systemPrompt: string;
    context?: string;
    instruction?: string;
    full: string;
  } {
    const render = (text: string | undefined): string | undefined => {
      if (!text) return undefined;
      let rendered = text;
      for (const [key, value] of Object.entries(variables)) {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
      }
      // Remove any remaining unresolved variables
      rendered = rendered.replace(/{{[^}]+}}/g, '');
      return rendered.trim();
    };

    const systemPrompt = render(template.systemPrompt) || template.systemPrompt;
    const context = render(template.contextTemplate);
    const instruction = render(template.instructionTemplate);

    const parts = [systemPrompt];
    if (context) parts.push(context);
    if (instruction) parts.push(instruction);

    return {
      systemPrompt,
      context,
      instruction,
      full: parts.join('\n\n'),
    };
  }

  // ============================================================================
  // Feedback Processing
  // ============================================================================

  async submitFeedback(
    instanceId: string,
    feedback: {
      rating?: number;
      thumbsUp?: boolean;
      issueAttribution?: IssueAttribution;
      feedbackText?: string;
      improvementSuggestions?: string;
      wouldReuse?: boolean;
      userId?: string;
    }
  ): Promise<PrepromptFeedback> {
    const feedbackId = uuidv4();
    
    // Determine attribution confidence based on user input
    let attributionConfidence = 0.5;
    if (feedback.issueAttribution) {
      // If user explicitly selected attribution, higher confidence
      attributionConfidence = 0.8;
    } else if (feedback.rating !== undefined) {
      // Auto-determine attribution based on rating and context
      const instance = await this.getInstance(instanceId);
      if (instance) {
        const autoAttribution = await this.inferAttribution(instance, feedback.rating);
        feedback.issueAttribution = autoAttribution.attribution;
        attributionConfidence = autoAttribution.confidence;
      }
    }

    await executeStatement(`
      INSERT INTO preprompt_feedback (
        id, instance_id, feedback_source, user_id, rating, thumbs_up,
        issue_attribution, issue_attribution_confidence,
        feedback_text, improvement_suggestions, would_reuse
      ) VALUES (
        :id, :instance_id, :source, :user_id, :rating, :thumbs_up,
        :attribution, :attribution_confidence,
        :feedback_text, :suggestions, :would_reuse
      )
    `, [
      stringParam('id', feedbackId),
      stringParam('instance_id', instanceId),
      stringParam('source', feedback.userId ? 'user' : 'auto'),
      stringParam('user_id', feedback.userId || ''),
      longParam('rating', feedback.rating || 0),
      stringParam('thumbs_up', String(feedback.thumbsUp ?? '')),
      stringParam('attribution', feedback.issueAttribution || ''),
      stringParam('attribution_confidence', String(attributionConfidence)),
      stringParam('feedback_text', feedback.feedbackText || ''),
      stringParam('suggestions', feedback.improvementSuggestions || ''),
      stringParam('would_reuse', String(feedback.wouldReuse ?? '')),
    ]);

    // The trigger will automatically update attribution scores

    logger.info('Pre-prompt feedback recorded', {
      instanceId,
      feedbackId,
      rating: feedback.rating,
      attribution: feedback.issueAttribution,
    });

    return {
      id: feedbackId,
      instanceId,
      feedbackSource: feedback.userId ? 'user' : 'auto',
      userId: feedback.userId,
      rating: feedback.rating,
      thumbsUp: feedback.thumbsUp,
      issueAttribution: feedback.issueAttribution,
      issueAttributionConfidence: attributionConfidence,
      feedbackText: feedback.feedbackText,
      improvementSuggestions: feedback.improvementSuggestions,
      conversationContext: {},
      wouldReuse: feedback.wouldReuse,
      createdAt: new Date(),
    };
  }

  private async inferAttribution(
    instance: PrepromptInstance,
    rating: number
  ): Promise<{ attribution: IssueAttribution; confidence: number }> {
    // Low rating - try to determine what went wrong
    if (rating <= 2) {
      // Get historical data for this combination
      const stats = await this.getContextStats(instance);
      
      // Check which factor has lowest success rate
      if (stats.modelSuccessRate < 0.5 && stats.modelSuccessRate < stats.templateSuccessRate) {
        return { attribution: 'model', confidence: 0.6 };
      }
      if (stats.modeSuccessRate < 0.5 && stats.modeSuccessRate < stats.templateSuccessRate) {
        return { attribution: 'mode', confidence: 0.6 };
      }
      if (stats.domainSuccessRate < 0.5 && stats.domainSuccessRate < stats.templateSuccessRate) {
        return { attribution: 'domain_detection', confidence: 0.6 };
      }
      if (stats.templateSuccessRate < 0.5) {
        return { attribution: 'preprompt', confidence: 0.6 };
      }
      
      return { attribution: 'other', confidence: 0.4 };
    }
    
    // Medium/high rating - likely everything worked
    return { attribution: 'other', confidence: 0.3 };
  }

  private async getContextStats(instance: PrepromptInstance): Promise<{
    templateSuccessRate: number;
    modelSuccessRate: number;
    modeSuccessRate: number;
    domainSuccessRate: number;
  }> {
    const result = await executeStatement<{
      template_rate: number;
      model_rate: number;
      mode_rate: number;
      domain_rate: number;
    }>(`
      SELECT 
        COALESCE(AVG(CASE WHEN pi.template_id = :template_id THEN f.rating END) / 5.0, 0.5) as template_rate,
        COALESCE(AVG(CASE WHEN pi.model_id = :model_id THEN f.rating END) / 5.0, 0.5) as model_rate,
        COALESCE(AVG(CASE WHEN pi.orchestration_mode = :mode THEN f.rating END) / 5.0, 0.5) as mode_rate,
        COALESCE(AVG(CASE WHEN pi.detected_domain_id = :domain_id THEN f.rating END) / 5.0, 0.5) as domain_rate
      FROM preprompt_instances pi
      JOIN preprompt_feedback f ON pi.id = f.instance_id
      WHERE pi.created_at > NOW() - INTERVAL '30 days'
    `, [
      stringParam('template_id', instance.templateId || ''),
      stringParam('model_id', instance.modelId),
      stringParam('mode', instance.orchestrationMode),
      stringParam('domain_id', instance.detectedDomainId || ''),
    ]);

    const row = result.rows[0] || {};
    return {
      templateSuccessRate: Number(row.template_rate) || 0.5,
      modelSuccessRate: Number(row.model_rate) || 0.5,
      modeSuccessRate: Number(row.mode_rate) || 0.5,
      domainSuccessRate: Number(row.domain_rate) || 0.5,
    };
  }

  // ============================================================================
  // Admin Dashboard
  // ============================================================================

  async getAdminDashboard(): Promise<PrepromptAdminDashboard> {
    // Get template stats
    const templateStats = await executeStatement<{
      total: number;
      active: number;
    }>(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active
      FROM preprompt_templates
    `, []);

    // Get instance/feedback stats
    const usageStats = await executeStatement<{
      total_instances: number;
      total_feedback: number;
      avg_rating: number;
      thumbs_up_rate: number;
    }>(`
      SELECT 
        COUNT(DISTINCT pi.id) as total_instances,
        COUNT(DISTINCT pf.id) as total_feedback,
        AVG(pf.rating) as avg_rating,
        COUNT(*) FILTER (WHERE pf.thumbs_up = true)::FLOAT / NULLIF(COUNT(pf.thumbs_up), 0) as thumbs_up_rate
      FROM preprompt_instances pi
      LEFT JOIN preprompt_feedback pf ON pi.id = pf.instance_id
      WHERE pi.created_at > NOW() - INTERVAL '30 days'
    `, []);

    // Get attribution distribution
    const attributionStats = await executeStatement<{
      attribution: string;
      count: number;
    }>(`
      SELECT 
        issue_attribution as attribution,
        COUNT(*) as count
      FROM preprompt_feedback
      WHERE issue_attribution IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY issue_attribution
    `, []);

    const attributionDist: Record<string, number> = {
      preprompt: 0, model: 0, mode: 0, workflow: 0, domain: 0, other: 0
    };
    let totalAttr = 0;
    for (const row of attributionStats.rows) {
      const key = row.attribution as string;
      const count = Number(row.count);
      if (key in attributionDist) {
        attributionDist[key] = count;
        totalAttr += count;
      }
    }
    // Convert to percentages
    if (totalAttr > 0) {
      for (const key of Object.keys(attributionDist)) {
        attributionDist[key] = attributionDist[key] / totalAttr;
      }
    }

    // Get top templates
    const topTemplates = await executeStatement<{
      template_code: string;
      name: string;
      avg_rating: number;
      uses: number;
    }>(`
      SELECT 
        pt.template_code,
        pt.name,
        COALESCE(pt.avg_feedback_score, 0) as avg_rating,
        pt.total_uses as uses
      FROM preprompt_templates pt
      WHERE pt.is_active = true AND pt.total_uses > 0
      ORDER BY pt.avg_feedback_score DESC NULLS LAST
      LIMIT 5
    `, []);

    // Get low performing templates
    const lowTemplates = await executeStatement<{
      template_code: string;
      name: string;
      avg_rating: number;
      blamed_count: number;
    }>(`
      SELECT 
        pt.template_code,
        pt.name,
        COALESCE(pt.avg_feedback_score, 0) as avg_rating,
        COUNT(pf.id) FILTER (WHERE pf.issue_attribution = 'preprompt') as blamed_count
      FROM preprompt_templates pt
      LEFT JOIN preprompt_instances pi ON pt.id = pi.template_id
      LEFT JOIN preprompt_feedback pf ON pi.id = pf.instance_id
      WHERE pt.is_active = true AND pt.total_uses >= 5
      GROUP BY pt.id, pt.template_code, pt.name, pt.avg_feedback_score
      HAVING COALESCE(pt.avg_feedback_score, 0) < 3.5 OR COUNT(pf.id) FILTER (WHERE pf.issue_attribution = 'preprompt') > 5
      ORDER BY pt.avg_feedback_score ASC NULLS FIRST
      LIMIT 5
    `, []);

    // Get recent feedback
    const recentFeedback = await executeStatement<{
      instance_id: string;
      rating: number;
      attribution: string;
      feedback_text: string;
      created_at: string;
    }>(`
      SELECT 
        instance_id,
        rating,
        issue_attribution as attribution,
        feedback_text,
        created_at
      FROM preprompt_feedback
      ORDER BY created_at DESC
      LIMIT 10
    `, []);

    // Get learning config
    const learningConfig = await this.getLearningConfig();
    const explorationConfig = await this.getExplorationConfig();

    const tStats = templateStats.rows[0] || { total: 0, active: 0 };
    const uStats = usageStats.rows[0] || { total_instances: 0, total_feedback: 0, avg_rating: 0, thumbs_up_rate: 0 };

    return {
      totalTemplates: Number(tStats.total),
      activeTemplates: Number(tStats.active),
      totalInstances: Number(uStats.total_instances),
      totalFeedback: Number(uStats.total_feedback),
      overallAvgRating: Number(uStats.avg_rating) || 0,
      overallThumbsUpRate: Number(uStats.thumbs_up_rate) || 0,
      attributionDistribution: attributionDist as any,
      learningEnabled: learningConfig.enabled,
      explorationRate: explorationConfig.rate,
      topTemplates: topTemplates.rows.map(r => ({
        templateCode: String(r.template_code),
        name: String(r.name),
        avgRating: Number(r.avg_rating),
        uses: Number(r.uses),
      })),
      lowPerformingTemplates: lowTemplates.rows.map(r => ({
        templateCode: String(r.template_code),
        name: String(r.name),
        avgRating: Number(r.avg_rating),
        issues: Number(r.blamed_count) > 5 ? ['Frequently blamed for issues'] : ['Low average rating'],
      })),
      recentFeedback: recentFeedback.rows.map(r => ({
        instanceId: String(r.instance_id),
        rating: Number(r.rating),
        attribution: r.attribution as IssueAttribution | undefined,
        feedbackText: r.feedback_text ? String(r.feedback_text) : undefined,
        createdAt: new Date(r.created_at),
      })),
    };
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  async getTemplates(activeOnly = true): Promise<PrepromptTemplate[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM preprompt_templates
      ${activeOnly ? 'WHERE is_active = true' : ''}
      ORDER BY total_uses DESC, name ASC
    `, []);

    return result.rows.map(this.mapTemplateRow);
  }

  async updateTemplateWeights(
    templateId: string,
    weights: Partial<{
      baseEffectivenessScore: number;
      domainWeight: number;
      modeWeight: number;
      modelWeight: number;
      complexityWeight: number;
      taskTypeWeight: number;
      feedbackWeight: number;
    }>
  ): Promise<void> {
    const updates: string[] = [];
    const params = [stringParam('id', templateId)];

    if (weights.baseEffectivenessScore !== undefined) {
      updates.push('base_effectiveness_score = :base');
      params.push(stringParam('base', String(weights.baseEffectivenessScore)));
    }
    if (weights.domainWeight !== undefined) {
      updates.push('domain_weight = :domain');
      params.push(stringParam('domain', String(weights.domainWeight)));
    }
    if (weights.modeWeight !== undefined) {
      updates.push('mode_weight = :mode');
      params.push(stringParam('mode', String(weights.modeWeight)));
    }
    if (weights.modelWeight !== undefined) {
      updates.push('model_weight = :model');
      params.push(stringParam('model', String(weights.modelWeight)));
    }
    if (weights.complexityWeight !== undefined) {
      updates.push('complexity_weight = :complexity');
      params.push(stringParam('complexity', String(weights.complexityWeight)));
    }
    if (weights.taskTypeWeight !== undefined) {
      updates.push('task_type_weight = :task_type');
      params.push(stringParam('task_type', String(weights.taskTypeWeight)));
    }
    if (weights.feedbackWeight !== undefined) {
      updates.push('feedback_weight = :feedback');
      params.push(stringParam('feedback', String(weights.feedbackWeight)));
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      await executeStatement(`
        UPDATE preprompt_templates SET ${updates.join(', ')} WHERE id = :id
      `, params);

      // Clear cache
      this.templateCache.clear();
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async getApplicableTemplates(
    mode: OrchestrationMode,
    domainId?: string,
    modelId?: string,
    taskType?: string,
    complexity?: string
  ): Promise<PrepromptTemplate[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM preprompt_templates
      WHERE is_active = true
        AND (:mode = ANY(applicable_modes) OR array_length(applicable_modes, 1) IS NULL)
        AND (NOT :model_id = ANY(incompatible_models) OR array_length(incompatible_models, 1) IS NULL)
      ORDER BY 
        CASE WHEN :mode = ANY(applicable_modes) THEN 1 ELSE 2 END,
        total_uses DESC
      LIMIT 20
    `, [
      stringParam('mode', mode),
      stringParam('model_id', modelId || ''),
    ]);

    return result.rows.map(this.mapTemplateRow);
  }

  private async getDefaultTemplate(mode: OrchestrationMode): Promise<PrepromptTemplate | null> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM preprompt_templates
      WHERE is_default = true AND is_active = true
        AND (:mode = ANY(applicable_modes) OR array_length(applicable_modes, 1) IS NULL)
      ORDER BY total_uses DESC
      LIMIT 1
    `, [stringParam('mode', mode)]);

    if (result.rows.length === 0) return null;
    return this.mapTemplateRow(result.rows[0]);
  }

  private async getAttributionScore(
    templateId: string,
    factorType: string,
    factorValue: string
  ): Promise<{ successCorrelation: number; confidence: number } | null> {
    const result = await executeStatement<{
      success_correlation: number;
      confidence: number;
    }>(`
      SELECT success_correlation, confidence
      FROM preprompt_attribution_scores
      WHERE template_id = :template_id AND factor_type = :factor_type AND factor_value = :factor_value
    `, [
      stringParam('template_id', templateId),
      stringParam('factor_type', factorType),
      stringParam('factor_value', factorValue),
    ]);

    if (result.rows.length === 0) return null;
    return {
      successCorrelation: Number(result.rows[0].success_correlation),
      confidence: Number(result.rows[0].confidence),
    };
  }

  private async getInstance(instanceId: string): Promise<PrepromptInstance | null> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM preprompt_instances WHERE id = :id
    `, [stringParam('id', instanceId)]);

    if (result.rows.length === 0) return null;
    return this.mapInstanceRow(result.rows[0]);
  }

  private async createInstance(instance: Partial<PrepromptInstance>): Promise<void> {
    await executeStatement(`
      INSERT INTO preprompt_instances (
        id, plan_id, template_id, system_prompt_rendered, context_rendered,
        instruction_rendered, full_preprompt, tenant_id, user_id, model_id,
        orchestration_mode, detected_domain_id, task_type, complexity, status
      ) VALUES (
        :id, :plan_id, :template_id, :system_prompt, :context,
        :instruction, :full_preprompt, :tenant_id, :user_id, :model_id,
        :mode, :domain_id, :task_type, :complexity, :status
      )
    `, [
      stringParam('id', instance.id!),
      stringParam('plan_id', instance.planId!),
      stringParam('template_id', instance.templateId || ''),
      stringParam('system_prompt', instance.systemPromptRendered || ''),
      stringParam('context', instance.contextRendered || ''),
      stringParam('instruction', instance.instructionRendered || ''),
      stringParam('full_preprompt', instance.fullPreprompt || ''),
      stringParam('tenant_id', instance.tenantId!),
      stringParam('user_id', instance.userId!),
      stringParam('model_id', instance.modelId!),
      stringParam('mode', instance.orchestrationMode!),
      stringParam('domain_id', instance.detectedDomainId || ''),
      stringParam('task_type', instance.taskType || ''),
      stringParam('complexity', instance.complexity || ''),
      stringParam('status', instance.status || 'pending'),
    ]);
  }

  private async logSelection(log: Omit<PrepromptSelectionLog, 'id' | 'createdAt'>): Promise<PrepromptSelectionLog> {
    const id = uuidv4();
    await executeStatement(`
      INSERT INTO preprompt_selection_log (
        id, instance_id, candidates_considered, selection_method,
        scoring_breakdown, exploration_factor, was_exploration
      ) VALUES (
        :id, :instance_id, :candidates, :method, :breakdown::jsonb, :exploration, :was_exploration
      )
    `, [
      stringParam('id', id),
      stringParam('instance_id', log.instanceId),
      longParam('candidates', log.candidatesConsidered),
      stringParam('method', log.selectionMethod),
      stringParam('breakdown', JSON.stringify(log.scoringBreakdown)),
      stringParam('exploration', String(log.explorationFactor)),
      stringParam('was_exploration', String(log.wasExploration)),
    ]);

    return {
      id,
      ...log,
      createdAt: new Date(),
    };
  }

  private generateSelectionReason(
    selected: { template: PrepromptTemplate; score: any },
    request: PrepromptSelectionRequest,
    wasExploration: boolean
  ): string {
    if (request.preferredTemplateCode) {
      return `Admin-specified template: ${selected.template.templateCode}`;
    }
    if (wasExploration) {
      return `Exploration selection to gather learning data (score: ${selected.score.finalScore.toFixed(3)})`;
    }
    
    const reasons: string[] = [];
    if (selected.score.modeBonus > 0) {
      reasons.push(`optimized for ${request.orchestrationMode} mode`);
    }
    if (selected.score.domainBonus > 0 && request.detectedDomainId) {
      reasons.push('domain-matched');
    }
    if (selected.score.modelBonus > 0) {
      reasons.push(`compatible with ${request.modelId}`);
    }
    if (selected.score.feedbackAdjustment > 0) {
      reasons.push('positive historical performance');
    }
    
    return `Best match (score: ${selected.score.finalScore.toFixed(3)}) - ${reasons.join(', ') || 'default selection'}`;
  }

  private async getLearningConfig(): Promise<{ enabled: boolean }> {
    const cached = this.configCache.get('learning_enabled');
    if (cached) return cached as { enabled: boolean };

    const result = await executeStatement<{ config_value: string }>(`
      SELECT config_value FROM preprompt_learning_config WHERE config_key = 'learning_enabled'
    `, []);

    const config = result.rows[0] ? JSON.parse(result.rows[0].config_value) : { enabled: true };
    this.configCache.set('learning_enabled', config);
    return config;
  }

  private async getExplorationConfig(): Promise<{ rate: number; decay: number; minRate: number }> {
    const cached = this.configCache.get('exploration_rate');
    if (cached) return cached as { rate: number; decay: number; minRate: number };

    const result = await executeStatement<{ config_value: string }>(`
      SELECT config_value FROM preprompt_learning_config WHERE config_key = 'exploration_rate'
    `, []);

    const config = result.rows[0] ? JSON.parse(result.rows[0].config_value) : { rate: 0.1, decay: 0.99, minRate: 0.01 };
    this.configCache.set('exploration_rate', config);
    return config;
  }

  private mapTemplateRow(row: Record<string, unknown>): PrepromptTemplate {
    return {
      id: String(row.id),
      templateCode: String(row.template_code),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      systemPrompt: String(row.system_prompt),
      contextTemplate: row.context_template ? String(row.context_template) : undefined,
      instructionTemplate: row.instruction_template ? String(row.instruction_template) : undefined,
      applicableModes: (row.applicable_modes as string[]) || [],
      applicableDomains: (row.applicable_domains as string[]) || [],
      applicableTaskTypes: (row.applicable_task_types as string[]) || [],
      complexityRange: (row.complexity_range as any[]) || [],
      compatibleModels: (row.compatible_models as string[]) || [],
      preferredModels: (row.preferred_models as string[]) || [],
      incompatibleModels: (row.incompatible_models as string[]) || [],
      baseEffectivenessScore: Number(row.base_effectiveness_score),
      domainWeight: Number(row.domain_weight),
      modeWeight: Number(row.mode_weight),
      modelWeight: Number(row.model_weight),
      complexityWeight: Number(row.complexity_weight),
      taskTypeWeight: Number(row.task_type_weight),
      feedbackWeight: Number(row.feedback_weight),
      totalUses: Number(row.total_uses),
      successfulUses: Number(row.successful_uses),
      avgFeedbackScore: row.avg_feedback_score ? Number(row.avg_feedback_score) : undefined,
      learnedAdjustments: (row.learned_adjustments as Record<string, number>) || {},
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      createdBy: row.created_by ? String(row.created_by) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapInstanceRow(row: Record<string, unknown>): PrepromptInstance {
    return {
      id: String(row.id),
      planId: String(row.plan_id),
      templateId: row.template_id ? String(row.template_id) : undefined,
      systemPromptRendered: String(row.system_prompt_rendered),
      contextRendered: row.context_rendered ? String(row.context_rendered) : undefined,
      instructionRendered: row.instruction_rendered ? String(row.instruction_rendered) : undefined,
      fullPreprompt: String(row.full_preprompt),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      modelId: String(row.model_id),
      modelName: row.model_name ? String(row.model_name) : undefined,
      provider: row.provider ? String(row.provider) : undefined,
      orchestrationMode: row.orchestration_mode as OrchestrationMode,
      detectedFieldId: row.detected_field_id ? String(row.detected_field_id) : undefined,
      detectedDomainId: row.detected_domain_id ? String(row.detected_domain_id) : undefined,
      detectedSubspecialtyId: row.detected_subspecialty_id ? String(row.detected_subspecialty_id) : undefined,
      domainConfidence: row.domain_confidence ? Number(row.domain_confidence) : undefined,
      taskType: row.task_type ? String(row.task_type) : undefined,
      complexity: row.complexity as any,
      promptTokenCount: row.prompt_token_count ? Number(row.prompt_token_count) : undefined,
      workflowId: row.workflow_id ? String(row.workflow_id) : undefined,
      workflowCode: row.workflow_code ? String(row.workflow_code) : undefined,
      workflowStepId: row.workflow_step_id ? String(row.workflow_step_id) : undefined,
      responseQualityScore: row.response_quality_score ? Number(row.response_quality_score) : undefined,
      latencyMs: row.latency_ms ? Number(row.latency_ms) : undefined,
      tokensUsed: row.tokens_used ? Number(row.tokens_used) : undefined,
      costCents: row.cost_cents ? Number(row.cost_cents) : undefined,
      status: row.status as any,
      errorMessage: row.error_message ? String(row.error_message) : undefined,
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }
}

export const prepromptLearningService = new PrepromptLearningService();
