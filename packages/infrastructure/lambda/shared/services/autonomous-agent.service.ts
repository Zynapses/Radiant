// RADIANT v4.18.0 - Autonomous Agent Service
// Advanced Cognition: Bounded proactive behavior, background learning, scheduled tasks

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';
import { memoryConsolidationService } from './memory-consolidation.service';
import { theoryOfMindService } from './theory-of-mind.service';
import { logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export type TaskType = 'suggestion' | 'background_learning' | 'maintenance' | 'exploration' | 'monitoring';
export type TriggerType = 'scheduled' | 'event' | 'threshold' | 'pattern';
export type ActionType = 'generate_suggestions' | 'consolidate_memory' | 'update_model' | 'analyze_patterns';
export type ExecutionStatus = 'pending' | 'running' | 'awaiting_approval' | 'approved' | 'rejected' | 'completed' | 'failed';

export interface AutonomousTask {
  taskId: string;
  tenantId: string;
  taskType: TaskType;
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  resourceBudget: ResourceBudget;
  requiresApproval: boolean;
  maxImpactLevel: string;
  allowedActions: string[];
  forbiddenActions: string[];
  isEnabled: boolean;
  isPaused: boolean;
  nextRunAt?: Date;
  lastRunAt?: Date;
  runCount: number;
}

export interface ResourceBudget {
  maxTokens?: number;
  maxApiCalls?: number;
  maxDurationMs?: number;
}

export interface ProposedAction {
  action: string;
  target: string;
  params: Record<string, unknown>;
  impactAssessment: {
    level: string;
    description: string;
    reversible: boolean;
  };
}

export interface AutonomousExecution {
  executionId: string;
  taskId: string;
  status: ExecutionStatus;
  proposedActions: ProposedAction[];
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  actionsTaken: ProposedAction[];
  outcomes: Record<string, unknown>;
  tokensUsed: number;
  apiCallsMade: number;
  durationMs?: number;
  triggeredAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface AutonomySettings {
  autonomousEnabled: boolean;
  approvalRequired: boolean;
  maxActionsPerDay: number;
  resourceBudget: {
    maxTokensPerDay: number;
    maxApiCallsPerDay: number;
  };
  allowedTasks: TaskType[];
}

// ============================================================================
// Autonomous Agent Service
// ============================================================================

export class AutonomousAgentService {
  // ============================================================================
  // Task Management
  // ============================================================================

  async createTask(
    tenantId: string,
    taskType: TaskType,
    name: string,
    triggerType: TriggerType,
    actionType: ActionType,
    options: {
      description?: string;
      triggerConfig?: Record<string, unknown>;
      actionConfig?: Record<string, unknown>;
      resourceBudget?: ResourceBudget;
      requiresApproval?: boolean;
      maxImpactLevel?: string;
      allowedActions?: string[];
      forbiddenActions?: string[];
      targetUsers?: string[];
    } = {}
  ): Promise<AutonomousTask> {
    const result = await executeStatement(
      `INSERT INTO autonomous_tasks (
        tenant_id, task_type, name, description, trigger_type, trigger_config,
        action_type, action_config, resource_budget, requires_approval,
        max_impact_level, allowed_actions, forbidden_actions, target_users
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'taskType', value: { stringValue: taskType } },
        { name: 'name', value: { stringValue: name } },
        { name: 'description', value: options.description ? { stringValue: options.description } : { isNull: true } },
        { name: 'triggerType', value: { stringValue: triggerType } },
        { name: 'triggerConfig', value: { stringValue: JSON.stringify(options.triggerConfig || {}) } },
        { name: 'actionType', value: { stringValue: actionType } },
        { name: 'actionConfig', value: { stringValue: JSON.stringify(options.actionConfig || {}) } },
        { name: 'resourceBudget', value: { stringValue: JSON.stringify(options.resourceBudget || {}) } },
        { name: 'requiresApproval', value: { booleanValue: options.requiresApproval ?? true } },
        { name: 'maxImpactLevel', value: { stringValue: options.maxImpactLevel || 'low' } },
        { name: 'allowedActions', value: { stringValue: `{${(options.allowedActions || []).join(',')}}` } },
        { name: 'forbiddenActions', value: { stringValue: `{${(options.forbiddenActions || []).join(',')}}` } },
        { name: 'targetUsers', value: { stringValue: `{${(options.targetUsers || []).join(',')}}` } },
      ]
    );

    return this.mapTask(result.rows[0] as Record<string, unknown>);
  }

  async getTask(taskId: string): Promise<AutonomousTask | null> {
    const result = await executeStatement(
      `SELECT * FROM autonomous_tasks WHERE task_id = $1`,
      [{ name: 'taskId', value: { stringValue: taskId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapTask(result.rows[0] as Record<string, unknown>);
  }

  async getTasks(tenantId: string, options: { enabledOnly?: boolean; taskType?: TaskType } = {}): Promise<AutonomousTask[]> {
    let query = `SELECT * FROM autonomous_tasks WHERE tenant_id = $1`;
    const params: Array<{ name: string; value: { stringValue: string } | { booleanValue: boolean } }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (options.enabledOnly) {
      query += ` AND is_enabled = true AND is_paused = false`;
    }

    if (options.taskType) {
      query += ` AND task_type = $2`;
      params.push({ name: 'taskType', value: { stringValue: options.taskType } });
    }

    query += ` ORDER BY created_at DESC`;

    const result = await executeStatement(query, params);
    return result.rows.map((row) => this.mapTask(row as Record<string, unknown>));
  }

  async enableTask(taskId: string): Promise<void> {
    await executeStatement(
      `UPDATE autonomous_tasks SET is_enabled = true, is_paused = false, pause_reason = NULL WHERE task_id = $1`,
      [{ name: 'taskId', value: { stringValue: taskId } }]
    );
  }

  async disableTask(taskId: string): Promise<void> {
    await executeStatement(
      `UPDATE autonomous_tasks SET is_enabled = false WHERE task_id = $1`,
      [{ name: 'taskId', value: { stringValue: taskId } }]
    );
  }

  async pauseTask(taskId: string, reason?: string): Promise<void> {
    await executeStatement(
      `UPDATE autonomous_tasks SET is_paused = true, pause_reason = $2 WHERE task_id = $1`,
      [
        { name: 'taskId', value: { stringValue: taskId } },
        { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Task Execution
  // ============================================================================

  async triggerTask(taskId: string): Promise<AutonomousExecution> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error('Task not found');

    if (!task.isEnabled || task.isPaused) {
      throw new Error('Task is not enabled or is paused');
    }

    // Check resource budget
    const withinBudget = await this.checkResourceBudget(taskId, task.resourceBudget);
    if (!withinBudget) {
      throw new Error('Resource budget exceeded');
    }

    // Create execution record
    const result = await executeStatement(
      `INSERT INTO autonomous_executions (
        task_id, tenant_id, status, approval_required
      ) SELECT task_id, tenant_id, 'running', requires_approval FROM autonomous_tasks WHERE task_id = $1
      RETURNING execution_id`,
      [{ name: 'taskId', value: { stringValue: taskId } }]
    );

    const executionId = (result.rows[0] as { execution_id: string }).execution_id;

    try {
      // Generate proposed actions
      const proposedActions = await this.generateProposedActions(task);

      // Check if approval is required
      if (task.requiresApproval && proposedActions.length > 0) {
        await executeStatement(
          `UPDATE autonomous_executions SET
            status = 'awaiting_approval',
            proposed_actions = $2
          WHERE execution_id = $1`,
          [
            { name: 'executionId', value: { stringValue: executionId } },
            { name: 'proposedActions', value: { stringValue: JSON.stringify(proposedActions) } },
          ]
        );

        return this.getExecution(executionId) as Promise<AutonomousExecution>;
      }

      // Execute actions directly
      const outcomes = await this.executeActions(task, proposedActions);

      await executeStatement(
        `UPDATE autonomous_executions SET
          status = 'completed',
          proposed_actions = $2,
          actions_taken = $2,
          outcomes = $3,
          completed_at = NOW()
        WHERE execution_id = $1`,
        [
          { name: 'executionId', value: { stringValue: executionId } },
          { name: 'actions', value: { stringValue: JSON.stringify(proposedActions) } },
          { name: 'outcomes', value: { stringValue: JSON.stringify(outcomes) } },
        ]
      );

      // Update task last run
      await executeStatement(
        `UPDATE autonomous_tasks SET last_run_at = NOW(), run_count = run_count + 1 WHERE task_id = $1`,
        [{ name: 'taskId', value: { stringValue: taskId } }]
      );

      return this.getExecution(executionId) as Promise<AutonomousExecution>;

    } catch (error) {
      await executeStatement(
        `UPDATE autonomous_executions SET status = 'failed', error_message = $2 WHERE execution_id = $1`,
        [
          { name: 'executionId', value: { stringValue: executionId } },
          { name: 'error', value: { stringValue: error instanceof Error ? error.message : 'Unknown error' } },
        ]
      );
      throw error;
    }
  }

  async approveExecution(executionId: string, approvedBy: string): Promise<AutonomousExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) throw new Error('Execution not found');

    if (execution.status !== 'awaiting_approval') {
      throw new Error('Execution is not awaiting approval');
    }

    const task = await this.getTask(execution.taskId);
    if (!task) throw new Error('Task not found');

    // Execute the approved actions
    const outcomes = await this.executeActions(task, execution.proposedActions);

    await executeStatement(
      `UPDATE autonomous_executions SET
        status = 'completed',
        approved_by = $2,
        approved_at = NOW(),
        actions_taken = proposed_actions,
        outcomes = $3,
        completed_at = NOW()
      WHERE execution_id = $1`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'approvedBy', value: { stringValue: approvedBy } },
        { name: 'outcomes', value: { stringValue: JSON.stringify(outcomes) } },
      ]
    );

    // Update task last run
    await executeStatement(
      `UPDATE autonomous_tasks SET last_run_at = NOW(), run_count = run_count + 1 WHERE task_id = $1`,
      [{ name: 'taskId', value: { stringValue: task.taskId } }]
    );

    return this.getExecution(executionId) as Promise<AutonomousExecution>;
  }

  async rejectExecution(executionId: string, reason: string): Promise<void> {
    await executeStatement(
      `UPDATE autonomous_executions SET
        status = 'rejected',
        rejection_reason = $2,
        completed_at = NOW()
      WHERE execution_id = $1`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'reason', value: { stringValue: reason } },
      ]
    );
  }

  async getExecution(executionId: string): Promise<AutonomousExecution | null> {
    const result = await executeStatement(
      `SELECT * FROM autonomous_executions WHERE execution_id = $1`,
      [{ name: 'executionId', value: { stringValue: executionId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapExecution(result.rows[0] as Record<string, unknown>);
  }

  async getPendingApprovals(tenantId: string): Promise<AutonomousExecution[]> {
    const result = await executeStatement(
      `SELECT ae.* FROM autonomous_executions ae
       JOIN autonomous_tasks at ON ae.task_id = at.task_id
       WHERE at.tenant_id = $1 AND ae.status = 'awaiting_approval'
       ORDER BY ae.triggered_at DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map((row) => this.mapExecution(row as Record<string, unknown>));
  }

  // ============================================================================
  // Action Generation & Execution
  // ============================================================================

  private async generateProposedActions(task: AutonomousTask): Promise<ProposedAction[]> {
    const actions: ProposedAction[] = [];

    switch (task.actionType) {
      case 'generate_suggestions':
        actions.push(...await this.generateSuggestionActions(task));
        break;

      case 'consolidate_memory':
        actions.push(...await this.generateConsolidationActions(task));
        break;

      case 'update_model':
        actions.push(...await this.generateModelUpdateActions(task));
        break;

      case 'analyze_patterns':
        actions.push(...await this.generatePatternAnalysisActions(task));
        break;
    }

    // Filter by allowed/forbidden actions
    return actions.filter((a) => {
      if (task.forbiddenActions.includes(a.action)) return false;
      if (task.allowedActions.length > 0 && !task.allowedActions.includes(a.action)) return false;
      return true;
    });
  }

  private async generateSuggestionActions(task: AutonomousTask): Promise<ProposedAction[]> {
    const config = task.actionConfig;
    const maxSuggestions = Number(config.max_suggestions) || 3;
    const tenantId = task.tenantId;

    // Analyze user patterns to generate personalized suggestions
    const patterns = await this.analyzeUserPatterns(tenantId, maxSuggestions);
    
    if (patterns.length === 0) {
      return [{
        action: 'create_suggestion',
        target: 'user_suggestions',
        params: { suggestion_type: 'proactive', count: maxSuggestions },
        impactAssessment: {
          level: 'low',
          description: 'Will create proactive suggestions for users',
          reversible: true,
        },
      }];
    }

    // Generate actions for each identified pattern
    return patterns.map(pattern => ({
      action: 'create_personalized_suggestion',
      target: 'user_suggestions',
      params: {
        suggestion_type: pattern.type,
        user_id: pattern.userId,
        content: pattern.suggestedContent,
        reason: pattern.reason,
        confidence: pattern.confidence,
      },
      impactAssessment: {
        level: 'low',
        description: `Personalized suggestion for user based on ${pattern.reason}`,
        reversible: true,
      },
    }));
  }

  /**
   * Analyze user behavior patterns to generate personalized suggestions
   */
  private async analyzeUserPatterns(
    tenantId: string,
    maxSuggestions: number
  ): Promise<Array<{
    userId: string;
    type: string;
    suggestedContent: string;
    reason: string;
    confidence: number;
  }>> {
    const patterns: Array<{
      userId: string;
      type: string;
      suggestedContent: string;
      reason: string;
      confidence: number;
    }> = [];

    try {
      // Query recent user activity patterns
      const activityResult = await executeStatement(
        `WITH user_activity AS (
          SELECT 
            user_id,
            COUNT(*) as session_count,
            MAX(created_at) as last_active,
            array_agg(DISTINCT focus_mode) FILTER (WHERE focus_mode IS NOT NULL) as used_modes,
            AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE NULL END) as avg_rating
          FROM sessions
          WHERE tenant_id = $1 
            AND created_at > NOW() - INTERVAL '7 days'
          GROUP BY user_id
          HAVING COUNT(*) >= 3
        ),
        common_topics AS (
          SELECT 
            s.user_id,
            m.content,
            COUNT(*) as topic_count
          FROM messages m
          JOIN sessions s ON m.session_id = s.id
          WHERE s.tenant_id = $1
            AND s.created_at > NOW() - INTERVAL '7 days'
            AND m.role = 'user'
          GROUP BY s.user_id, m.content
          ORDER BY topic_count DESC
        )
        SELECT 
          ua.user_id,
          ua.session_count,
          ua.last_active,
          ua.used_modes,
          ua.avg_rating,
          (SELECT ct.content FROM common_topics ct WHERE ct.user_id = ua.user_id LIMIT 1) as common_topic
        FROM user_activity ua
        ORDER BY ua.session_count DESC
        LIMIT $2`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'limit', value: { longValue: maxSuggestions * 2 } },
        ]
      );

      for (const row of activityResult.rows as Record<string, unknown>[]) {
        const userId = String(row.user_id);
        const sessionCount = Number(row.session_count) || 0;
        const lastActive = row.last_active ? new Date(String(row.last_active)) : new Date();
        const usedModes = (row.used_modes as string[]) || [];
        const avgRating = Number(row.avg_rating) || 0;
        const commonTopic = String(row.common_topic || '');

        // Pattern 1: Inactive user re-engagement
        const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceActive > 3 && daysSinceActive < 14) {
          patterns.push({
            userId,
            type: 'reengagement',
            suggestedContent: `Welcome back! We've added new features since your last visit. Would you like to explore what's new?`,
            reason: `User inactive for ${Math.round(daysSinceActive)} days`,
            confidence: 0.7,
          });
        }

        // Pattern 2: Power user feature discovery
        if (sessionCount > 10 && usedModes.length < 3) {
          const unusedModes = ['research', 'creative', 'analysis', 'coding']
            .filter(m => !usedModes.includes(m));
          if (unusedModes.length > 0) {
            patterns.push({
              userId,
              type: 'feature_discovery',
              suggestedContent: `Try ${unusedModes[0]} mode for your next task - it's optimized for ${unusedModes[0] === 'research' ? 'finding information' : unusedModes[0] === 'creative' ? 'creative writing' : unusedModes[0] === 'analysis' ? 'data analysis' : 'code generation'}.`,
              reason: `Power user with ${sessionCount} sessions, only using ${usedModes.length} modes`,
              confidence: 0.8,
            });
          }
        }

        // Pattern 3: Topic-based suggestion
        if (commonTopic && commonTopic.length > 10) {
          patterns.push({
            userId,
            type: 'topic_continuation',
            suggestedContent: `Would you like to continue exploring topics related to your recent interests?`,
            reason: `Frequent discussions on similar topics`,
            confidence: 0.6,
          });
        }

        // Pattern 4: Low satisfaction recovery
        if (avgRating > 0 && avgRating < 3.5) {
          patterns.push({
            userId,
            type: 'satisfaction_recovery',
            suggestedContent: `We noticed some responses didn't meet your expectations. Try using more specific prompts or selecting a specialized mode for better results.`,
            reason: `Average rating ${avgRating.toFixed(1)}/5`,
            confidence: 0.75,
          });
        }

        if (patterns.length >= maxSuggestions) break;
      }
    } catch (error) {
      logger.warn('Failed to analyze user patterns', { tenantId, error });
    }

    return patterns.slice(0, maxSuggestions);
  }

  private async generateConsolidationActions(task: AutonomousTask): Promise<ProposedAction[]> {
    const config = task.actionConfig;
    const actions: ProposedAction[] = [];

    if (config.compress) {
      actions.push({
        action: 'compress_memories',
        target: String(config.target) || 'episodic',
        params: { compression_ratio: 0.7 },
        impactAssessment: {
          level: 'medium',
          description: 'Will compress old memories to save space',
          reversible: false,
        },
      });
    }

    if (config.prune) {
      actions.push({
        action: 'prune_memories',
        target: String(config.target) || 'episodic',
        params: { importance_threshold: 0.1 },
        impactAssessment: {
          level: 'high',
          description: 'Will permanently remove low-importance memories',
          reversible: false,
        },
      });
    }

    if (config.decay) {
      actions.push({
        action: 'apply_decay',
        target: String(config.target) || 'episodic',
        params: {},
        impactAssessment: {
          level: 'low',
          description: 'Will apply importance decay to memories',
          reversible: true,
        },
      });
    }

    return actions;
  }

  private async generateModelUpdateActions(task: AutonomousTask): Promise<ProposedAction[]> {
    const config = task.actionConfig;

    if (config.target === 'causal_graph') {
      return [{
        action: 'update_causal_graph',
        target: 'causal_knowledge',
        params: {},
        impactAssessment: {
          level: 'low',
          description: 'Will update causal knowledge graph from recent interactions',
          reversible: true,
        },
      }];
    }

    return [];
  }

  private async generatePatternAnalysisActions(task: AutonomousTask): Promise<ProposedAction[]> {
    const config = task.actionConfig;
    const actions: ProposedAction[] = [];

    if (config.extract_skills) {
      actions.push({
        action: 'extract_skills',
        target: 'procedural_memory',
        params: {},
        impactAssessment: {
          level: 'low',
          description: 'Will analyze recent tasks to extract reusable skills',
          reversible: true,
        },
      });
    }

    return actions;
  }

  private async executeActions(task: AutonomousTask, actions: ProposedAction[]): Promise<Record<string, unknown>> {
    const outcomes: Record<string, unknown> = {};

    for (const action of actions) {
      try {
        switch (action.action) {
          case 'create_suggestion':
            outcomes[action.action] = await this.executeCreateSuggestion(task, action);
            break;

          case 'compress_memories':
          case 'prune_memories':
          case 'apply_decay':
            outcomes[action.action] = await this.executeMemoryAction(task, action);
            break;

          case 'update_causal_graph':
            outcomes[action.action] = await this.executeModelUpdate(task, action);
            break;

          case 'extract_skills':
            outcomes[action.action] = await this.executeSkillExtraction(task, action);
            break;

          default:
            outcomes[action.action] = { status: 'skipped', reason: 'Unknown action type' };
        }
      } catch (error) {
        outcomes[action.action] = { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    return outcomes;
  }

  private async executeCreateSuggestion(task: AutonomousTask, action: ProposedAction): Promise<unknown> {
    // Get tenant ID from task
    const taskResult = await executeStatement(
      `SELECT tenant_id FROM autonomous_tasks WHERE task_id = $1`,
      [{ name: 'taskId', value: { stringValue: task.taskId } }]
    );
    const tenantId = String((taskResult.rows[0] as { tenant_id: string }).tenant_id);

    // Get active users to generate suggestions for
    const usersResult = await executeStatement(
      `SELECT user_id FROM user_activity_log 
       WHERE tenant_id = $1 AND last_active_at > NOW() - INTERVAL '7 days'
       GROUP BY user_id LIMIT 100`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const maxSuggestions = Number(action.params.count) || 3;
    let suggestionsCreated = 0;

    for (const row of usersResult.rows as { user_id: string }[]) {
      try {
        // Use theory of mind service to understand user and generate suggestions
        const userModel = await theoryOfMindService.getOrCreateUserModel(tenantId, row.user_id);
        
        // Use expertise domains or active goals to generate suggestions
        const expertiseDomains = Object.keys(userModel.expertiseDomains || {});
        const activeGoals = (userModel.currentGoals || []).filter(g => g.status === 'active');
        
        if (expertiseDomains.length > 0 || activeGoals.length > 0) {
          const topics = expertiseDomains.length > 0 
            ? expertiseDomains.slice(0, 3).join(', ')
            : activeGoals.slice(0, 2).map(g => g.goalText.substring(0, 50)).join(', ');
          
          // Insert proactive suggestion based on user model
          await executeStatement(
            `INSERT INTO user_suggestions (tenant_id, user_id, suggestion_type, content, priority, created_by_task)
             VALUES ($1, $2, 'proactive', $3, $4, $5)
             ON CONFLICT (tenant_id, user_id, content) DO NOTHING`,
            [
              { name: 'tenantId', value: { stringValue: tenantId } },
              { name: 'userId', value: { stringValue: row.user_id } },
              { name: 'content', value: { stringValue: `Based on your interests in ${topics}, you might find this helpful.` } },
              { name: 'priority', value: { longValue: Math.min(suggestionsCreated + 1, maxSuggestions) } },
              { name: 'taskId', value: { stringValue: task.taskId } },
            ]
          );
          suggestionsCreated++;
        }
      } catch (err) {
        // Continue with next user if one fails
      }

      if (suggestionsCreated >= maxSuggestions * 10) break; // Cap total suggestions
    }

    return { status: 'completed', suggestions_created: suggestionsCreated };
  }

  private async executeMemoryAction(task: AutonomousTask, action: ProposedAction): Promise<unknown> {
    const taskResult = await executeStatement(
      `SELECT tenant_id FROM autonomous_tasks WHERE task_id = $1`,
      [{ name: 'taskId', value: { stringValue: task.taskId } }]
    );
    const tenantId = String((taskResult.rows[0] as { tenant_id: string }).tenant_id);

    let jobType: 'compress' | 'prune' | 'decay';
    switch (action.action) {
      case 'compress_memories':
        jobType = 'compress';
        break;
      case 'prune_memories':
        jobType = 'prune';
        break;
      case 'apply_decay':
        jobType = 'decay';
        break;
      default:
        return { status: 'skipped' };
    }

    const job = await memoryConsolidationService.createConsolidationJob(tenantId, jobType, {
      targetMemoryType: action.target,
      compressionRatio: action.params.compression_ratio as number | undefined,
      importanceThreshold: action.params.importance_threshold as number | undefined,
    });

    const result = await memoryConsolidationService.runConsolidationJob(job.jobId);
    return { status: 'completed', job_id: job.jobId, result };
  }

  private async executeModelUpdate(task: AutonomousTask, action: ProposedAction): Promise<unknown> {
    // Get tenant ID from task
    const taskResult = await executeStatement(
      `SELECT tenant_id FROM autonomous_tasks WHERE task_id = $1`,
      [{ name: 'taskId', value: { stringValue: task.taskId } }]
    );
    const tenantId = String((taskResult.rows[0] as { tenant_id: string }).tenant_id);

    // Find stale causal relationships that need updating
    const staleRelations = await executeStatement(
      `SELECT id, source_node_id, target_node_id, relationship_type, confidence_score
       FROM cortex_causal_graph
       WHERE tenant_id = $1 
         AND (last_validated_at IS NULL OR last_validated_at < NOW() - INTERVAL '30 days')
         AND confidence_score > 0.3
       ORDER BY confidence_score DESC
       LIMIT 50`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    let updatesApplied = 0;

    for (const row of staleRelations.rows as { id: string; source_node_id: string; target_node_id: string; relationship_type: string; confidence_score: number }[]) {
      try {
        // Check if relationship still has supporting evidence
        const evidenceResult = await executeStatement(
          `SELECT COUNT(*) as evidence_count FROM cortex_causal_evidence
           WHERE relation_id = $1 AND is_valid = true`,
          [{ name: 'relationId', value: { stringValue: row.id } }]
        );
        
        const evidenceCount = Number((evidenceResult.rows[0] as { evidence_count: number }).evidence_count);
        
        // Decay confidence if no recent evidence, otherwise validate
        const newConfidence = evidenceCount > 0 
          ? Math.min(row.confidence_score * 1.05, 1.0) 
          : row.confidence_score * 0.9;

        await executeStatement(
          `UPDATE cortex_causal_graph 
           SET confidence_score = $1, last_validated_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [
            { name: 'confidence', value: { doubleValue: newConfidence } },
            { name: 'id', value: { stringValue: row.id } },
          ]
        );
        updatesApplied++;
      } catch (err) {
        // Continue with next relation if one fails
      }
    }

    return { status: 'completed', updates: updatesApplied };
  }

  private async executeSkillExtraction(task: AutonomousTask, action: ProposedAction): Promise<unknown> {
    // Get tenant ID from task
    const taskResult = await executeStatement(
      `SELECT tenant_id FROM autonomous_tasks WHERE task_id = $1`,
      [{ name: 'taskId', value: { stringValue: task.taskId } }]
    );
    const tenantId = String((taskResult.rows[0] as { tenant_id: string }).tenant_id);

    // Find successful task patterns from recent executions
    const successfulPatterns = await executeStatement(
      `SELECT 
         at.action_type,
         at.action_config,
         COUNT(*) as success_count,
         AVG(ae.tokens_used) as avg_tokens,
         AVG(EXTRACT(EPOCH FROM (ae.completed_at - ae.triggered_at))) as avg_duration_secs
       FROM autonomous_executions ae
       JOIN autonomous_tasks at ON ae.task_id = at.task_id
       WHERE at.tenant_id = $1 
         AND ae.status = 'completed'
         AND ae.completed_at > NOW() - INTERVAL '30 days'
       GROUP BY at.action_type, at.action_config
       HAVING COUNT(*) >= 3
       ORDER BY success_count DESC
       LIMIT 20`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    let skillsExtracted = 0;

    for (const row of successfulPatterns.rows as { action_type: string; action_config: string; success_count: number; avg_tokens: number; avg_duration_secs: number }[]) {
      try {
        // Extract and store skill pattern
        await executeStatement(
          `INSERT INTO autonomous_learned_skills (
             tenant_id, skill_name, action_type, optimal_config, 
             success_rate, avg_tokens, avg_duration_secs, sample_count, extracted_from_task
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (tenant_id, skill_name) DO UPDATE SET
             success_rate = EXCLUDED.success_rate,
             avg_tokens = EXCLUDED.avg_tokens,
             avg_duration_secs = EXCLUDED.avg_duration_secs,
             sample_count = autonomous_learned_skills.sample_count + EXCLUDED.sample_count,
             updated_at = NOW()`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'skillName', value: { stringValue: `${row.action_type}_optimized` } },
            { name: 'actionType', value: { stringValue: row.action_type } },
            { name: 'optimalConfig', value: { stringValue: row.action_config } },
            { name: 'successRate', value: { doubleValue: 1.0 } },
            { name: 'avgTokens', value: { doubleValue: row.avg_tokens || 0 } },
            { name: 'avgDuration', value: { doubleValue: row.avg_duration_secs || 0 } },
            { name: 'sampleCount', value: { longValue: row.success_count } },
            { name: 'taskId', value: { stringValue: task.taskId } },
          ]
        );
        skillsExtracted++;
      } catch (err) {
        // Continue with next pattern if one fails
      }
    }

    return { status: 'completed', skills_extracted: skillsExtracted };
  }

  // ============================================================================
  // Resource Budget Management
  // ============================================================================

  private async checkResourceBudget(taskId: string, budget: ResourceBudget): Promise<boolean> {
    // Check today's usage
    const result = await executeStatement(
      `SELECT SUM(tokens_used) as total_tokens, SUM(api_calls_made) as total_calls
       FROM autonomous_executions
       WHERE task_id = $1
         AND triggered_at > NOW() - INTERVAL '24 hours'
         AND status IN ('completed', 'running')`,
      [{ name: 'taskId', value: { stringValue: taskId } }]
    );

    const row = result.rows[0] as { total_tokens: number; total_calls: number } | undefined;
    const usedTokens = Number(row?.total_tokens || 0);
    const usedCalls = Number(row?.total_calls || 0);

    if (budget.maxTokens && usedTokens >= budget.maxTokens) return false;
    if (budget.maxApiCalls && usedCalls >= budget.maxApiCalls) return false;

    return true;
  }

  // ============================================================================
  // Scheduled Task Runner
  // ============================================================================

  async runDueTasks(tenantId: string): Promise<Array<{ taskId: string; executionId: string; status: string }>> {
    // Find tasks that are due to run
    const result = await executeStatement(
      `SELECT task_id FROM autonomous_tasks
       WHERE tenant_id = $1
         AND is_enabled = true
         AND is_paused = false
         AND trigger_type = 'scheduled'
         AND (next_run_at IS NULL OR next_run_at <= NOW())
       LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const results: Array<{ taskId: string; executionId: string; status: string }> = [];

    for (const row of result.rows) {
      const taskId = (row as { task_id: string }).task_id;

      try {
        const execution = await this.triggerTask(taskId);
        results.push({
          taskId,
          executionId: execution.executionId,
          status: execution.status,
        });

        // Update next run time (simplified - in production would parse cron)
        await executeStatement(
          `UPDATE autonomous_tasks SET next_run_at = NOW() + INTERVAL '1 day' WHERE task_id = $1`,
          [{ name: 'taskId', value: { stringValue: taskId } }]
        );

      } catch (error) {
        results.push({
          taskId,
          executionId: '',
          status: `failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return results;
  }

  // ============================================================================
  // Settings Management
  // ============================================================================

  async getSettings(tenantId: string): Promise<AutonomySettings> {
    const result = await executeStatement(
      `SELECT * FROM advanced_cognition_settings WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) {
      return this.getDefaultSettings();
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      autonomousEnabled: Boolean(row.autonomous_enabled ?? false),
      approvalRequired: Boolean(row.autonomous_approval_required ?? true),
      maxActionsPerDay: Number(row.max_autonomous_actions_per_day ?? 10),
      resourceBudget: typeof row.autonomous_resource_budget === 'string'
        ? JSON.parse(row.autonomous_resource_budget)
        : row.autonomous_resource_budget as { maxTokensPerDay: number; maxApiCallsPerDay: number } || this.getDefaultSettings().resourceBudget,
      allowedTasks: (row.allowed_autonomous_tasks as TaskType[]) || ['suggestion', 'maintenance'],
    };
  }

  private getDefaultSettings(): AutonomySettings {
    return {
      autonomousEnabled: false,
      approvalRequired: true,
      maxActionsPerDay: 10,
      resourceBudget: {
        maxTokensPerDay: 100000,
        maxApiCallsPerDay: 500,
      },
      allowedTasks: ['suggestion', 'maintenance'],
    };
  }

  async updateSettings(tenantId: string, updates: Partial<AutonomySettings>): Promise<void> {
    const sets: string[] = [];
    const params: Array<{ name: string; value: { stringValue: string } | { booleanValue: boolean } | { longValue: number } }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (updates.autonomousEnabled !== undefined) {
      sets.push(`autonomous_enabled = $${params.length + 1}`);
      params.push({ name: `p${params.length}`, value: { booleanValue: updates.autonomousEnabled } });
    }

    if (updates.approvalRequired !== undefined) {
      sets.push(`autonomous_approval_required = $${params.length + 1}`);
      params.push({ name: `p${params.length}`, value: { booleanValue: updates.approvalRequired } });
    }

    if (updates.maxActionsPerDay !== undefined) {
      sets.push(`max_autonomous_actions_per_day = $${params.length + 1}`);
      params.push({ name: `p${params.length}`, value: { longValue: updates.maxActionsPerDay } });
    }

    if (updates.resourceBudget !== undefined) {
      sets.push(`autonomous_resource_budget = $${params.length + 1}`);
      params.push({ name: `p${params.length}`, value: { stringValue: JSON.stringify(updates.resourceBudget) } });
    }

    if (updates.allowedTasks !== undefined) {
      sets.push(`allowed_autonomous_tasks = $${params.length + 1}`);
      params.push({ name: `p${params.length}`, value: { stringValue: `{${updates.allowedTasks.join(',')}}` } });
    }

    if (sets.length > 0) {
      await executeStatement(
        `UPDATE advanced_cognition_settings SET ${sets.join(', ')}, updated_at = NOW() WHERE tenant_id = $1`,
        params
      );
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapTask(row: Record<string, unknown>): AutonomousTask {
    return {
      taskId: String(row.task_id),
      tenantId: String(row.tenant_id),
      taskType: row.task_type as TaskType,
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      triggerType: row.trigger_type as TriggerType,
      triggerConfig: typeof row.trigger_config === 'string' ? JSON.parse(row.trigger_config) : (row.trigger_config as Record<string, unknown>) || {},
      actionType: row.action_type as ActionType,
      actionConfig: typeof row.action_config === 'string' ? JSON.parse(row.action_config) : (row.action_config as Record<string, unknown>) || {},
      resourceBudget: typeof row.resource_budget === 'string' ? JSON.parse(row.resource_budget) : (row.resource_budget as ResourceBudget) || {},
      requiresApproval: Boolean(row.requires_approval ?? true),
      maxImpactLevel: String(row.max_impact_level || 'low'),
      allowedActions: (row.allowed_actions as string[]) || [],
      forbiddenActions: (row.forbidden_actions as string[]) || [],
      isEnabled: Boolean(row.is_enabled ?? false),
      isPaused: Boolean(row.is_paused ?? false),
      nextRunAt: row.next_run_at ? new Date(row.next_run_at as string) : undefined,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at as string) : undefined,
      runCount: Number(row.run_count || 0),
    };
  }

  private mapExecution(row: Record<string, unknown>): AutonomousExecution {
    return {
      executionId: String(row.execution_id),
      taskId: String(row.task_id),
      status: row.status as ExecutionStatus,
      proposedActions: typeof row.proposed_actions === 'string' ? JSON.parse(row.proposed_actions) : (row.proposed_actions as ProposedAction[]) || [],
      approvalRequired: Boolean(row.approval_required ?? true),
      approvedBy: row.approved_by ? String(row.approved_by) : undefined,
      approvedAt: row.approved_at ? new Date(row.approved_at as string) : undefined,
      rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
      actionsTaken: typeof row.actions_taken === 'string' ? JSON.parse(row.actions_taken) : (row.actions_taken as ProposedAction[]) || [],
      outcomes: typeof row.outcomes === 'string' ? JSON.parse(row.outcomes) : (row.outcomes as Record<string, unknown>) || {},
      tokensUsed: Number(row.tokens_used || 0),
      apiCallsMade: Number(row.api_calls_made || 0),
      durationMs: row.duration_ms ? Number(row.duration_ms) : undefined,
      triggeredAt: new Date(row.triggered_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      errorMessage: row.error_message ? String(row.error_message) : undefined,
    };
  }
}

export const autonomousAgentService = new AutonomousAgentService();
