// RADIANT v4.18.0 - Generative UI Feedback & Learning Service
// Enables user feedback collection and AGI brain learning from UI generation

import { executeStatement, stringParam } from '../db/client';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

type UIFeedbackRating = 'thumbs_up' | 'thumbs_down' | 'star_1' | 'star_2' | 'star_3' | 'star_4' | 'star_5';

type UIFeedbackType =
  | 'helpful' | 'not_helpful' | 'wrong_type' | 'missing_data'
  | 'incorrect_data' | 'layout_issue' | 'functionality'
  | 'improvement' | 'feature_request';

type ImprovementType =
  | 'add_component' | 'remove_component' | 'modify_component'
  | 'change_layout' | 'fix_calculation' | 'add_data'
  | 'change_style' | 'add_interactivity' | 'simplify'
  | 'expand' | 'regenerate';

interface UIFeedbackIssue {
  category: 'accuracy' | 'completeness' | 'usability' | 'design' | 'performance' | 'functionality';
  description: string;
  severity: 'minor' | 'major' | 'critical';
  componentPath?: string;
}

interface ProposedUIChange {
  targetPath: string;
  changeType: 'add' | 'remove' | 'modify' | 'replace';
  beforeValue?: unknown;
  afterValue: unknown;
  explanation: string;
}

interface AGIFeedbackInsights {
  feedbackPattern: string;
  similarFeedbackCount: number;
  promptPatternLearned?: string;
  componentTypeMismatch?: boolean;
  dataExtractionIssue?: boolean;
  recommendedChanges: {
    changeType: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    autoApplicable: boolean;
  }[];
  modelUsed: string;
  confidenceScore: number;
  shouldRetrain: boolean;
  processedAt: Date;
}

interface AGIImprovementAnalysis {
  interpretedIntent: string;
  visionAnalysis?: {
    currentUIDescription: string;
    identifiedIssues: string[];
    suggestedFixes: string[];
  };
  proposedChanges: ProposedUIChange[];
  confidence: number;
  alternatives?: {
    description: string;
    changes: ProposedUIChange[];
  }[];
}

interface UISnapshot {
  timestamp: Date;
  appId: string;
  components: unknown[];
  state: Record<string, unknown>;
  layout: unknown;
  renderHash: string;
}

// ============================================================================
// Generative UI Feedback Service
// ============================================================================

class GenerativeUIFeedbackService {
  // =========================================================================
  // FEEDBACK COLLECTION
  // =========================================================================

  /**
   * Record user feedback on a generated UI
   */
  async recordFeedback(params: {
    tenantId: string;
    userId: string;
    appId: string;
    rating: UIFeedbackRating;
    feedbackType: UIFeedbackType;
    originalPrompt: string;
    generatedOutput: unknown;
    componentId?: string;
    improvementSuggestion?: string;
    expectedBehavior?: string;
    issues?: UIFeedbackIssue[];
  }): Promise<{ feedbackId: string; learningTriggered: boolean }> {
    const feedbackId = crypto.randomUUID();

    await executeStatement(
      `INSERT INTO generative_ui_feedback (
        id, tenant_id, user_id, app_id, component_id, rating, feedback_type,
        original_prompt, generated_output, improvement_suggestion,
        expected_behavior, issues
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::jsonb
      )`,
      [
        stringParam('id', feedbackId),
        stringParam('tenantId', params.tenantId),
        stringParam('userId', params.userId),
        stringParam('appId', params.appId),
        stringParam('componentId', params.componentId || ''),
        stringParam('rating', params.rating),
        stringParam('feedbackType', params.feedbackType),
        stringParam('originalPrompt', params.originalPrompt),
        stringParam('generatedOutput', JSON.stringify(params.generatedOutput)),
        stringParam('improvementSuggestion', params.improvementSuggestion || ''),
        stringParam('expectedBehavior', params.expectedBehavior || ''),
        stringParam('issues', JSON.stringify(params.issues || [])),
      ]
    );

    // Check if learning should be triggered
    const learningTriggered = await this.checkLearningTrigger(params.tenantId, params.feedbackType);

    // If negative feedback, queue for AGI analysis
    if (params.rating === 'thumbs_down' || params.rating === 'star_1' || params.rating === 'star_2') {
      await this.queueForAGIAnalysis(feedbackId);
    }

    return { feedbackId, learningTriggered };
  }

  /**
   * Get feedback for an app
   */
  async getAppFeedback(appId: string): Promise<{
    totalFeedback: number;
    positiveCount: number;
    negativeCount: number;
    avgRating: number | null;
    feedbackByType: Record<string, number>;
    recentFeedback: unknown[];
  }> {
    const statsResult = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rating IN ('thumbs_up', 'star_4', 'star_5')) as positive,
        COUNT(*) FILTER (WHERE rating IN ('thumbs_down', 'star_1', 'star_2')) as negative,
        AVG(CASE 
          WHEN rating = 'star_1' THEN 1
          WHEN rating = 'star_2' THEN 2
          WHEN rating = 'star_3' THEN 3
          WHEN rating = 'star_4' THEN 4
          WHEN rating = 'star_5' THEN 5
          ELSE NULL
        END) as avg_rating
       FROM generative_ui_feedback
       WHERE app_id = $1::uuid`,
      [stringParam('appId', appId)]
    );

    const byTypeResult = await executeStatement(
      `SELECT feedback_type, COUNT(*) as count
       FROM generative_ui_feedback
       WHERE app_id = $1::uuid
       GROUP BY feedback_type`,
      [stringParam('appId', appId)]
    );

    const recentResult = await executeStatement(
      `SELECT * FROM generative_ui_feedback
       WHERE app_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 10`,
      [stringParam('appId', appId)]
    );

    const stats = statsResult.rows?.[0] as Record<string, unknown> || {};
    const feedbackByType: Record<string, number> = {};
    (byTypeResult.rows || []).forEach((row: Record<string, unknown>) => {
      feedbackByType[row.feedback_type as string] = parseInt(row.count as string, 10);
    });

    return {
      totalFeedback: parseInt(stats.total as string, 10) || 0,
      positiveCount: parseInt(stats.positive as string, 10) || 0,
      negativeCount: parseInt(stats.negative as string, 10) || 0,
      avgRating: stats.avg_rating ? parseFloat(stats.avg_rating as string) : null,
      feedbackByType,
      recentFeedback: recentResult.rows || [],
    };
  }

  // =========================================================================
  // REAL-TIME IMPROVEMENT ("Improve Before Your Eyes")
  // =========================================================================

  /**
   * Start an improvement session
   */
  async startImprovementSession(params: {
    tenantId: string;
    userId: string;
    appId: string;
    currentSnapshot: UISnapshot;
  }): Promise<string> {
    const sessionId = crypto.randomUUID();

    await executeStatement(
      `INSERT INTO ui_improvement_sessions (
        id, tenant_id, user_id, app_id, status, current_snapshot
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'active', $5::jsonb)`,
      [
        stringParam('id', sessionId),
        stringParam('tenantId', params.tenantId),
        stringParam('userId', params.userId),
        stringParam('appId', params.appId),
        stringParam('currentSnapshot', JSON.stringify(params.currentSnapshot)),
      ]
    );

    return sessionId;
  }

  /**
   * Request an improvement from AGI
   */
  async requestImprovement(params: {
    sessionId: string;
    userRequest: string;
    currentSnapshot: UISnapshot;
  }): Promise<{
    iterationNumber: number;
    agiResponse: {
      understood: string;
      changes: ProposedUIChange[];
      explanation: string;
    };
    newSnapshot?: UISnapshot;
  }> {
    // Get current iteration number
    const iterResult = await executeStatement(
      `SELECT COALESCE(MAX(iteration_number), 0) + 1 as next_iter
       FROM ui_improvement_iterations
       WHERE session_id = $1::uuid`,
      [stringParam('sessionId', params.sessionId)]
    );
    const iterationNumber = parseInt((iterResult.rows?.[0] as Record<string, unknown>)?.next_iter as string, 10) || 1;

    // Analyze the request with AGI
    const analysis = await this.analyzeImprovementRequest(
      params.userRequest,
      params.currentSnapshot
    );

    // Generate the AGI response
    const agiResponse = {
      understood: analysis.interpretedIntent,
      changes: analysis.proposedChanges,
      explanation: this.generateExplanation(analysis),
    };

    // Apply changes to create new snapshot
    const newSnapshot = await this.applyChanges(params.currentSnapshot, analysis.proposedChanges);

    // Record the iteration
    await executeStatement(
      `INSERT INTO ui_improvement_iterations (
        session_id, iteration_number, user_request, agi_response,
        before_snapshot, after_snapshot
      ) VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)`,
      [
        stringParam('sessionId', params.sessionId),
        stringParam('iterationNumber', String(iterationNumber)),
        stringParam('userRequest', params.userRequest),
        stringParam('agiResponse', JSON.stringify(agiResponse)),
        stringParam('beforeSnapshot', JSON.stringify(params.currentSnapshot)),
        stringParam('afterSnapshot', JSON.stringify(newSnapshot)),
      ]
    );

    // Update session
    await executeStatement(
      `UPDATE ui_improvement_sessions
       SET current_snapshot = $2::jsonb, last_activity_at = NOW()
       WHERE id = $1::uuid`,
      [
        stringParam('sessionId', params.sessionId),
        stringParam('currentSnapshot', JSON.stringify(newSnapshot)),
      ]
    );

    return { iterationNumber, agiResponse, newSnapshot };
  }

  /**
   * Record user satisfaction with an improvement iteration
   */
  async recordIterationFeedback(params: {
    sessionId: string;
    iterationNumber: number;
    applied: boolean;
    userSatisfied: boolean;
    feedback?: string;
  }): Promise<void> {
    await executeStatement(
      `UPDATE ui_improvement_iterations
       SET applied = $3, user_satisfied = $4, feedback = $5
       WHERE session_id = $1::uuid AND iteration_number = $2`,
      [
        stringParam('sessionId', params.sessionId),
        stringParam('iterationNumber', String(params.iterationNumber)),
        stringParam('applied', String(params.applied)),
        stringParam('userSatisfied', String(params.userSatisfied)),
        stringParam('feedback', params.feedback || ''),
      ]
    );

    // If satisfied, mark session as completed
    if (params.userSatisfied) {
      await executeStatement(
        `UPDATE ui_improvement_sessions
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1::uuid`,
        [stringParam('sessionId', params.sessionId)]
      );
    }
  }

  /**
   * Complete or abandon an improvement session
   */
  async endSession(sessionId: string, status: 'completed' | 'abandoned'): Promise<void> {
    await executeStatement(
      `UPDATE ui_improvement_sessions
       SET status = $2, completed_at = NOW()
       WHERE id = $1::uuid`,
      [stringParam('sessionId', sessionId), stringParam('status', status)]
    );
  }

  // =========================================================================
  // AGI ANALYSIS & LEARNING
  // =========================================================================

  /**
   * Analyze an improvement request using AGI
   */
  private async analyzeImprovementRequest(
    userRequest: string,
    currentSnapshot: UISnapshot
  ): Promise<AGIImprovementAnalysis> {
    // Build analysis prompt
    const analysisPrompt = this.buildAnalysisPrompt(userRequest, currentSnapshot);
    
    // For now, use pattern-based analysis
    // In production, this would call the AGI brain service
    const analysis = this.performPatternAnalysis(userRequest, currentSnapshot);

    // If vision analysis is enabled, describe the current UI
    const visionAnalysis = await this.performVisionAnalysis(currentSnapshot);

    return {
      interpretedIntent: analysis.intent,
      visionAnalysis,
      proposedChanges: analysis.changes,
      confidence: analysis.confidence,
      alternatives: analysis.alternatives,
    };
  }

  /**
   * Perform pattern-based analysis of improvement request
   */
  private performPatternAnalysis(
    userRequest: string,
    snapshot: UISnapshot
  ): {
    intent: string;
    changes: ProposedUIChange[];
    confidence: number;
    alternatives?: { description: string; changes: ProposedUIChange[] }[];
  } {
    const lowerRequest = userRequest.toLowerCase();
    const changes: ProposedUIChange[] = [];
    let intent = 'Modify the generated UI';
    let confidence = 0.7;

    // Detect intent patterns
    if (lowerRequest.includes('add') || lowerRequest.includes('include')) {
      intent = 'Add new elements to the UI';
      if (lowerRequest.includes('column') || lowerRequest.includes('field')) {
        changes.push({
          targetPath: 'components[0].inputs',
          changeType: 'add',
          afterValue: { id: 'new_field', label: 'New Field', type: 'text' },
          explanation: 'Adding a new input field as requested',
        });
      }
      confidence = 0.75;
    } else if (lowerRequest.includes('remove') || lowerRequest.includes('delete')) {
      intent = 'Remove elements from the UI';
      confidence = 0.8;
    } else if (lowerRequest.includes('change') || lowerRequest.includes('modify')) {
      intent = 'Modify existing UI elements';
      confidence = 0.75;
    } else if (lowerRequest.includes('fix') || lowerRequest.includes('correct')) {
      intent = 'Fix an issue with the UI';
      if (lowerRequest.includes('calculation') || lowerRequest.includes('formula')) {
        changes.push({
          targetPath: 'components[0].config.formula',
          changeType: 'modify',
          beforeValue: 'unknown',
          afterValue: 'corrected_formula',
          explanation: 'Correcting the calculation formula',
        });
      }
      confidence = 0.7;
    } else if (lowerRequest.includes('simpler') || lowerRequest.includes('simplify')) {
      intent = 'Simplify the UI by removing complexity';
      confidence = 0.7;
    } else if (lowerRequest.includes('more') || lowerRequest.includes('expand')) {
      intent = 'Expand the UI with more details';
      confidence = 0.7;
    }

    return { intent, changes, confidence };
  }

  /**
   * Perform vision analysis on the current UI state
   */
  private async performVisionAnalysis(snapshot: UISnapshot): Promise<{
    currentUIDescription: string;
    identifiedIssues: string[];
    suggestedFixes: string[];
  } | undefined> {
    // In production, this would use a vision model to analyze the rendered UI
    // For now, we analyze the component structure

    const components = snapshot.components as { type: string; title: string; inputs?: unknown[] }[];
    const componentTypes = components.map(c => c.type);
    const issues: string[] = [];
    const fixes: string[] = [];

    // Check for common issues
    if (componentTypes.includes('calculator')) {
      const calc = components.find(c => c.type === 'calculator');
      if (calc && (!calc.inputs || (calc.inputs as unknown[]).length === 0)) {
        issues.push('Calculator has no input fields');
        fixes.push('Add input fields for user values');
      }
    }

    if (components.length > 5) {
      issues.push('UI may be too complex with many components');
      fixes.push('Consider consolidating or using tabs');
    }

    return {
      currentUIDescription: `UI contains ${components.length} components: ${componentTypes.join(', ')}`,
      identifiedIssues: issues,
      suggestedFixes: fixes,
    };
  }

  /**
   * Apply proposed changes to create a new snapshot
   */
  private async applyChanges(
    snapshot: UISnapshot,
    changes: ProposedUIChange[]
  ): Promise<UISnapshot> {
    const newSnapshot = JSON.parse(JSON.stringify(snapshot)) as UISnapshot;
    newSnapshot.timestamp = new Date();
    newSnapshot.renderHash = crypto.randomUUID().slice(0, 8);

    // Apply each change (simplified implementation)
    for (const change of changes) {
      // In production, this would use a path-based update mechanism
      // For now, we just update the timestamp to indicate change
    }

    return newSnapshot;
  }

  /**
   * Generate human-readable explanation of changes
   */
  private generateExplanation(analysis: AGIImprovementAnalysis): string {
    let explanation = `I understood that you want to: ${analysis.interpretedIntent}\n\n`;

    if (analysis.proposedChanges.length > 0) {
      explanation += 'Here are the changes I made:\n';
      analysis.proposedChanges.forEach((change, i) => {
        explanation += `${i + 1}. ${change.explanation}\n`;
      });
    } else {
      explanation += 'I couldn\'t identify specific changes to make. Could you be more specific about what you\'d like to change?';
    }

    if (analysis.visionAnalysis && analysis.visionAnalysis.identifiedIssues.length > 0) {
      explanation += '\n\nI also noticed these potential issues:\n';
      analysis.visionAnalysis.identifiedIssues.forEach(issue => {
        explanation += `• ${issue}\n`;
      });
    }

    return explanation;
  }

  /**
   * Build analysis prompt for AGI
   */
  private buildAnalysisPrompt(userRequest: string, snapshot: UISnapshot): string {
    return `
Analyze this user request to improve a generated UI:

USER REQUEST: "${userRequest}"

CURRENT UI STATE:
${JSON.stringify(snapshot, null, 2)}

Identify:
1. What the user wants to change
2. Which components/elements are affected
3. The specific changes needed
4. Any potential issues with the current UI

Respond with a structured analysis.
`;
  }

  /**
   * Queue feedback for AGI analysis
   */
  private async queueForAGIAnalysis(feedbackId: string): Promise<void> {
    // In production, this would add to a queue for background processing
    // For now, we'll mark it for processing
    console.log(`Feedback ${feedbackId} queued for AGI analysis`);
  }

  /**
   * Process feedback with AGI to extract insights
   */
  async processWithAGI(feedbackId: string): Promise<AGIFeedbackInsights> {
    // Get the feedback
    const feedbackResult = await executeStatement(
      `SELECT * FROM generative_ui_feedback WHERE id = $1::uuid`,
      [stringParam('feedbackId', feedbackId)]
    );

    const feedback = feedbackResult.rows?.[0] as Record<string, unknown>;
    if (!feedback) {
      throw new Error('Feedback not found');
    }

    // Find similar feedback
    const similarResult = await executeStatement(
      `SELECT COUNT(*) as count FROM generative_ui_feedback
       WHERE feedback_type = $1 AND id != $2::uuid`,
      [
        stringParam('feedbackType', feedback.feedback_type as string),
        stringParam('feedbackId', feedbackId),
      ]
    );
    const similarCount = parseInt((similarResult.rows?.[0] as Record<string, unknown>)?.count as string, 10) || 0;

    // Generate insights
    const insights: AGIFeedbackInsights = {
      feedbackPattern: `${feedback.feedback_type} feedback on generated UI`,
      similarFeedbackCount: similarCount,
      componentTypeMismatch: feedback.feedback_type === 'wrong_type',
      dataExtractionIssue: feedback.feedback_type === 'missing_data' || feedback.feedback_type === 'incorrect_data',
      recommendedChanges: [],
      modelUsed: 'pattern-analysis',
      confidenceScore: 0.7,
      shouldRetrain: similarCount >= 5,
      processedAt: new Date(),
    };

    // Add recommended changes based on feedback type
    if (feedback.feedback_type === 'wrong_type') {
      insights.recommendedChanges.push({
        changeType: 'component_selection',
        description: 'Improve component type detection for similar prompts',
        priority: 'high',
        autoApplicable: false,
      });
    }

    if (feedback.feedback_type === 'layout_issue') {
      insights.recommendedChanges.push({
        changeType: 'layout',
        description: 'Adjust default layout settings',
        priority: 'medium',
        autoApplicable: true,
      });
    }

    // Update feedback with insights
    await executeStatement(
      `UPDATE generative_ui_feedback
       SET agi_processed = true, agi_insights = $2::jsonb, agi_processed_at = NOW()
       WHERE id = $1::uuid`,
      [
        stringParam('feedbackId', feedbackId),
        stringParam('insights', JSON.stringify(insights)),
      ]
    );

    return insights;
  }

  // =========================================================================
  // LEARNING SYSTEM
  // =========================================================================

  /**
   * Check if learning should be triggered based on feedback count
   */
  private async checkLearningTrigger(tenantId: string, feedbackType: string): Promise<boolean> {
    const configResult = await executeStatement(
      `SELECT min_feedback_for_learning FROM ui_feedback_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    const threshold = parseInt((configResult.rows?.[0] as Record<string, unknown>)?.min_feedback_for_learning as string, 10) || 10;

    const countResult = await executeStatement(
      `SELECT COUNT(*) as count FROM generative_ui_feedback
       WHERE tenant_id = $1::uuid AND feedback_type = $2 AND agi_processed = false`,
      [stringParam('tenantId', tenantId), stringParam('feedbackType', feedbackType)]
    );
    const count = parseInt((countResult.rows?.[0] as Record<string, unknown>)?.count as string, 10) || 0;

    if (count >= threshold) {
      // Trigger learning
      await this.triggerLearning(tenantId, feedbackType);
      return true;
    }

    return false;
  }

  /**
   * Trigger learning from accumulated feedback
   */
  private async triggerLearning(tenantId: string, feedbackType: string): Promise<void> {
    // Get unprocessed feedback of this type
    const feedbackResult = await executeStatement(
      `SELECT id, original_prompt, generated_output, improvement_suggestion
       FROM generative_ui_feedback
       WHERE tenant_id = $1::uuid AND feedback_type = $2 AND agi_processed = false
       LIMIT 100`,
      [stringParam('tenantId', tenantId), stringParam('feedbackType', feedbackType)]
    );

    const feedbacks = feedbackResult.rows || [];
    if (feedbacks.length < 5) return;

    // Analyze patterns in the feedback
    const feedbackIds = feedbacks.map((f: Record<string, unknown>) => f.id as string);

    // Create a learning entry
    const learningId = crypto.randomUUID();
    await executeStatement(
      `INSERT INTO ui_feedback_learnings (
        id, tenant_id, learning_type, pattern, feedback_ids, example_count, status
      ) VALUES (
        $1::uuid, $2::uuid, 'prompt_pattern', $3::jsonb, $4::uuid[], $5, 'proposed'
      )`,
      [
        stringParam('id', learningId),
        stringParam('tenantId', tenantId),
        stringParam('pattern', JSON.stringify({
          trigger: `Feedback pattern: ${feedbackType}`,
          response: 'Adjust UI generation behavior',
          confidence: 0.7,
        })),
        stringParam('feedbackIds', `{${feedbackIds.join(',')}}`),
        stringParam('exampleCount', String(feedbacks.length)),
      ]
    );

    // Mark feedback as processed
    await executeStatement(
      `UPDATE generative_ui_feedback SET agi_processed = true
       WHERE id = ANY($1::uuid[])`,
      [stringParam('ids', `{${feedbackIds.join(',')}}`)]
    );
  }

  /**
   * Get proposed learnings for admin review
   */
  async getProposedLearnings(tenantId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM ui_feedback_learnings
       WHERE (tenant_id = $1::uuid OR tenant_id IS NULL)
         AND status = 'proposed'
       ORDER BY created_at DESC`,
      [stringParam('tenantId', tenantId)]
    );
    return result.rows || [];
  }

  /**
   * Approve a proposed learning
   */
  async approveLearning(learningId: string, approvedBy: string): Promise<void> {
    await executeStatement(
      `UPDATE ui_feedback_learnings
       SET status = 'approved', approved_at = NOW(), approved_by = $2::uuid
       WHERE id = $1::uuid`,
      [stringParam('learningId', learningId), stringParam('approvedBy', approvedBy)]
    );
  }

  /**
   * Activate an approved learning
   */
  async activateLearning(learningId: string): Promise<void> {
    await executeStatement(
      `UPDATE ui_feedback_learnings SET status = 'active' WHERE id = $1::uuid`,
      [stringParam('learningId', learningId)]
    );
  }

  // =========================================================================
  // CONFIGURATION
  // =========================================================================

  /**
   * Get feedback configuration for a tenant
   */
  async getConfig(tenantId: string): Promise<Record<string, unknown> | null> {
    const result = await executeStatement(
      `SELECT * FROM ui_feedback_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    return (result.rows?.[0] as Record<string, unknown>) || null;
  }

  /**
   * Update feedback configuration
   */
  async updateConfig(tenantId: string, config: Record<string, unknown>): Promise<void> {
    await executeStatement(
      `INSERT INTO ui_feedback_config (
        tenant_id, collect_feedback, feedback_prompt_delay, show_feedback_on_every_app,
        enable_real_time_improvement, max_improvement_iterations,
        auto_apply_high_confidence_changes, auto_apply_threshold,
        enable_agi_learning, learning_approval_required, min_feedback_for_learning,
        enable_vision_analysis, vision_model
      ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        collect_feedback = COALESCE($2, ui_feedback_config.collect_feedback),
        feedback_prompt_delay = COALESCE($3, ui_feedback_config.feedback_prompt_delay),
        show_feedback_on_every_app = COALESCE($4, ui_feedback_config.show_feedback_on_every_app),
        enable_real_time_improvement = COALESCE($5, ui_feedback_config.enable_real_time_improvement),
        max_improvement_iterations = COALESCE($6, ui_feedback_config.max_improvement_iterations),
        auto_apply_high_confidence_changes = COALESCE($7, ui_feedback_config.auto_apply_high_confidence_changes),
        auto_apply_threshold = COALESCE($8, ui_feedback_config.auto_apply_threshold),
        enable_agi_learning = COALESCE($9, ui_feedback_config.enable_agi_learning),
        learning_approval_required = COALESCE($10, ui_feedback_config.learning_approval_required),
        min_feedback_for_learning = COALESCE($11, ui_feedback_config.min_feedback_for_learning),
        enable_vision_analysis = COALESCE($12, ui_feedback_config.enable_vision_analysis),
        vision_model = COALESCE($13, ui_feedback_config.vision_model),
        updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        stringParam('collectFeedback', String(config.collectFeedback ?? true)),
        stringParam('feedbackPromptDelay', String(config.feedbackPromptDelay ?? 5000)),
        stringParam('showFeedbackOnEveryApp', String(config.showFeedbackOnEveryApp ?? false)),
        stringParam('enableRealTimeImprovement', String(config.enableRealTimeImprovement ?? true)),
        stringParam('maxImprovementIterations', String(config.maxImprovementIterations ?? 5)),
        stringParam('autoApplyHighConfidenceChanges', String(config.autoApplyHighConfidenceChanges ?? false)),
        stringParam('autoApplyThreshold', String(config.autoApplyThreshold ?? 0.95)),
        stringParam('enableAGILearning', String(config.enableAGILearning ?? true)),
        stringParam('learningApprovalRequired', String(config.learningApprovalRequired ?? true)),
        stringParam('minFeedbackForLearning', String(config.minFeedbackForLearning ?? 10)),
        stringParam('enableVisionAnalysis', String(config.enableVisionAnalysis ?? true)),
        stringParam('visionModel', config.visionModel as string || 'claude-3-5-sonnet'),
      ]
    );
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  /**
   * Get feedback analytics for dashboard
   */
  async getAnalytics(tenantId: string, days: number = 30): Promise<{
    totalFeedback: number;
    positiveRate: number;
    topIssues: { type: string; count: number }[];
    improvementSessions: number;
    learningsActive: number;
    dailyTrend: { date: string; positive: number; negative: number }[];
  }> {
    // Get overall stats
    const statsResult = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rating IN ('thumbs_up', 'star_4', 'star_5')) as positive
       FROM generative_ui_feedback
       WHERE tenant_id = $1::uuid AND created_at > NOW() - INTERVAL '${days} days'`,
      [stringParam('tenantId', tenantId)]
    );

    const stats = statsResult.rows?.[0] as Record<string, unknown> || {};
    const total = parseInt(stats.total as string, 10) || 0;
    const positive = parseInt(stats.positive as string, 10) || 0;

    // Get top issues
    const issuesResult = await executeStatement(
      `SELECT feedback_type, COUNT(*) as count
       FROM generative_ui_feedback
       WHERE tenant_id = $1::uuid 
         AND rating IN ('thumbs_down', 'star_1', 'star_2')
         AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY feedback_type
       ORDER BY count DESC
       LIMIT 5`,
      [stringParam('tenantId', tenantId)]
    );

    // Get session count
    const sessionsResult = await executeStatement(
      `SELECT COUNT(*) as count FROM ui_improvement_sessions
       WHERE tenant_id = $1::uuid AND started_at > NOW() - INTERVAL '${days} days'`,
      [stringParam('tenantId', tenantId)]
    );

    // Get active learnings
    const learningsResult = await executeStatement(
      `SELECT COUNT(*) as count FROM ui_feedback_learnings
       WHERE (tenant_id = $1::uuid OR tenant_id IS NULL) AND status = 'active'`,
      [stringParam('tenantId', tenantId)]
    );

    // Get daily trend
    const trendResult = await executeStatement(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE rating IN ('thumbs_up', 'star_4', 'star_5')) as positive,
        COUNT(*) FILTER (WHERE rating IN ('thumbs_down', 'star_1', 'star_2')) as negative
       FROM generative_ui_feedback
       WHERE tenant_id = $1::uuid AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [stringParam('tenantId', tenantId)]
    );

    return {
      totalFeedback: total,
      positiveRate: total > 0 ? positive / total : 0,
      topIssues: (issuesResult.rows || []).map((row: Record<string, unknown>) => ({
        type: row.feedback_type as string,
        count: parseInt(row.count as string, 10),
      })),
      improvementSessions: parseInt((sessionsResult.rows?.[0] as Record<string, unknown>)?.count as string, 10) || 0,
      learningsActive: parseInt((learningsResult.rows?.[0] as Record<string, unknown>)?.count as string, 10) || 0,
      dailyTrend: (trendResult.rows || []).map((row: Record<string, unknown>) => ({
        date: row.date as string,
        positive: parseInt(row.positive as string, 10),
        negative: parseInt(row.negative as string, 10),
      })),
    };
  }
}

export const generativeUIFeedbackService = new GenerativeUIFeedbackService();
