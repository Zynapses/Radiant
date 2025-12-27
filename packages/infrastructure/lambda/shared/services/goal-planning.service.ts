// RADIANT v4.18.0 - Goal Planning Service
// AGI Enhancement Phase 5: Hierarchical Task Networks, long-horizon planning, multi-session continuity

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';
import { episodicMemoryService } from './episodic-memory.service';

// ============================================================================
// Types
// ============================================================================

export type TaskType = 'compound' | 'primitive';
export type TaskStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'blocked';
export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed' | 'abandoned';
export type ActionType = 'generate' | 'search' | 'analyze' | 'code' | 'review' | 'execute' | 'decide';

export interface TaskPlan {
  planId: string;
  tenantId: string;
  userId: string;
  name: string;
  description?: string;
  rootGoal: string;
  taskTree: TaskTreeNode;
  totalTasks: number;
  completedTasks: number;
  status: PlanStatus;
  progress: number;
  currentPhase?: string;
  isMultiSession: boolean;
  sessionsCount: number;
  priority: number;
  estimatedDurationHours?: number;
  deadline?: Date;
  createdAt: Date;
  startedAt?: Date;
}

export interface TaskTreeNode {
  taskId?: string;
  name: string;
  description?: string;
  type: TaskType;
  actionType?: ActionType;
  actionParams?: Record<string, unknown>;
  status?: TaskStatus;
  progress?: number;
  output?: string;
  children?: TaskTreeNode[];
  dependsOn?: string[];
  estimatedDurationMins?: number;
}

export interface PlanTask {
  taskId: string;
  planId: string;
  name: string;
  description?: string;
  parentTaskId?: string;
  depth: number;
  path: string;
  taskType: TaskType;
  actionType?: ActionType;
  actionParams: Record<string, unknown>;
  dependsOn: string[];
  status: TaskStatus;
  progress: number;
  output?: string;
  outputArtifacts: Array<{ type: string; content: string }>;
  estimatedDurationMins?: number;
  actualDurationMins?: number;
  attempts: number;
  maxAttempts: number;
  success?: boolean;
  qualityScore?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface PlanMilestone {
  milestoneId: string;
  planId: string;
  name: string;
  description?: string;
  sequenceNumber: number;
  successCriteria: Array<{ criterion: string; metric?: string; targetValue?: unknown }>;
  requiredTasks: string[];
  status: 'pending' | 'in_progress' | 'achieved' | 'missed';
  targetDate?: Date;
  achievedDate?: Date;
}

export interface PlanSession {
  sessionId: string;
  planId: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  durationMins?: number;
  progressAtStart: number;
  progressAtEnd?: number;
  tasksCompleted: number;
  tasksWorkedOn: string[];
  nextSteps: Array<{ step: string; priority: number }>;
  sessionNotes?: string;
}

export interface SessionHandoff {
  planId: string;
  planName: string;
  progress: number;
  lastSessionSummary: string;
  nextSteps: Array<{ step: string; priority: number }>;
  readyTasks: PlanTask[];
  blockers: string[];
  estimatedRemainingHours: number;
}

export interface DecompositionResult {
  tasks: TaskTreeNode[];
  milestones: Array<{ name: string; sequenceNumber: number; criteria: string[] }>;
  estimatedTotalHours: number;
}

// ============================================================================
// Goal Planning Service
// ============================================================================

export class GoalPlanningService {
  // ============================================================================
  // Plan Management
  // ============================================================================

  async createPlan(
    tenantId: string,
    userId: string,
    goal: string,
    options: {
      name?: string;
      description?: string;
      deadline?: Date;
      priority?: number;
      autoDecompose?: boolean;
      templateSlug?: string;
    } = {}
  ): Promise<TaskPlan> {
    const goalEmbedding = await this.generateEmbedding(goal);
    let taskTree: TaskTreeNode = { name: goal, type: 'compound', children: [] };
    let milestones: Array<{ name: string; sequenceNumber: number; criteria: string[] }> = [];

    // Use template if provided
    if (options.templateSlug) {
      const template = await this.getTemplate(tenantId, options.templateSlug);
      if (template) {
        taskTree = template.taskTree;
        milestones = template.milestones;
      }
    } else if (options.autoDecompose !== false) {
      // Auto-decompose the goal
      const decomposition = await this.decomposeGoal(goal);
      taskTree = { name: goal, type: 'compound', children: decomposition.tasks };
      milestones = decomposition.milestones;
    }

    // Create plan
    const result = await executeStatement(
      `INSERT INTO task_plans (
        tenant_id, user_id, name, description, root_goal, root_goal_embedding,
        task_tree, priority, deadline, estimated_duration_hours
      ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, $9, $10)
      RETURNING plan_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'name', value: { stringValue: options.name || goal.substring(0, 100) } },
        { name: 'description', value: options.description ? { stringValue: options.description } : { isNull: true } },
        { name: 'rootGoal', value: { stringValue: goal } },
        { name: 'goalEmbedding', value: { stringValue: `[${goalEmbedding.join(',')}]` } },
        { name: 'taskTree', value: { stringValue: JSON.stringify(taskTree) } },
        { name: 'priority', value: { longValue: options.priority || 5 } },
        { name: 'deadline', value: options.deadline ? { stringValue: options.deadline.toISOString() } : { isNull: true } },
        { name: 'estimatedHours', value: { isNull: true } },
      ]
    );

    const planId = (result.rows[0] as { plan_id: string }).plan_id;

    // Create tasks from tree
    await this.createTasksFromTree(tenantId, planId, taskTree);

    // Create milestones
    for (const milestone of milestones) {
      await this.createMilestone(tenantId, planId, milestone.name, milestone.sequenceNumber, milestone.criteria);
    }

    // Update task count
    await executeStatement(
      `UPDATE task_plans SET total_tasks = (SELECT COUNT(*) FROM plan_tasks WHERE plan_id = $1) WHERE plan_id = $1`,
      [{ name: 'planId', value: { stringValue: planId } }]
    );

    return this.getPlan(planId) as Promise<TaskPlan>;
  }

  async getPlan(planId: string): Promise<TaskPlan | null> {
    const result = await executeStatement(
      `SELECT * FROM task_plans WHERE plan_id = $1`,
      [{ name: 'planId', value: { stringValue: planId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapPlan(result.rows[0] as Record<string, unknown>);
  }

  async getUserPlans(tenantId: string, userId: string, status?: PlanStatus): Promise<TaskPlan[]> {
    let query = `SELECT * FROM task_plans WHERE tenant_id = $1 AND user_id = $2`;
    const params: Array<{ name: string; value: { stringValue: string } }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'userId', value: { stringValue: userId } },
    ];

    if (status) {
      query += ` AND status = $3`;
      params.push({ name: 'status', value: { stringValue: status } });
    }

    query += ` ORDER BY priority DESC, updated_at DESC`;

    const result = await executeStatement(query, params);
    return result.rows.map((row) => this.mapPlan(row as Record<string, unknown>));
  }

  async updatePlanStatus(planId: string, status: PlanStatus, outcome?: string): Promise<void> {
    await executeStatement(
      `UPDATE task_plans SET
        status = $2,
        final_outcome = COALESCE($3, final_outcome),
        completed_at = CASE WHEN $2 IN ('completed', 'failed', 'abandoned') THEN NOW() ELSE completed_at END
      WHERE plan_id = $1`,
      [
        { name: 'planId', value: { stringValue: planId } },
        { name: 'status', value: { stringValue: status } },
        { name: 'outcome', value: outcome ? { stringValue: outcome } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Task Decomposition (HTN Planning)
  // ============================================================================

  async decomposeGoal(goal: string, depth = 0, maxDepth = 4): Promise<DecompositionResult> {
    if (depth >= maxDepth) {
      return { tasks: [{ name: goal, type: 'primitive', actionType: 'execute' }], milestones: [], estimatedTotalHours: 1 };
    }

    const prompt = `Decompose this goal into a hierarchical task structure.

GOAL: "${goal}"

Create a structured plan with:
1. Compound tasks (have subtasks) and primitive tasks (atomic actions)
2. Clear dependencies between tasks
3. Milestones to track progress

Return JSON:
{
  "tasks": [
    {
      "name": "task name",
      "type": "compound|primitive",
      "action_type": "generate|search|analyze|code|review|execute|decide",
      "estimated_mins": 30,
      "children": [...] // for compound tasks
    }
  ],
  "milestones": [
    {"name": "milestone name", "sequence_number": 1, "criteria": ["success criterion"]}
  ],
  "estimated_total_hours": 5
}

Keep tasks concrete and actionable. Each primitive task should be completable in under 60 minutes.`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          tasks: this.mapDecomposedTasks(parsed.tasks || []),
          milestones: parsed.milestones || [],
          estimatedTotalHours: parsed.estimated_total_hours || 1,
        };
      }
    } catch { /* use defaults */ }

    return {
      tasks: [{ name: goal, type: 'primitive', actionType: 'analyze' }],
      milestones: [],
      estimatedTotalHours: 1,
    };
  }

  private mapDecomposedTasks(tasks: Array<{
    name: string;
    type: string;
    action_type?: string;
    estimated_mins?: number;
    children?: Array<unknown>;
  }>): TaskTreeNode[] {
    return tasks.map((t) => ({
      name: t.name,
      type: (t.type as TaskType) || 'primitive',
      actionType: t.action_type as ActionType,
      estimatedDurationMins: t.estimated_mins,
      children: t.children ? this.mapDecomposedTasks(t.children as Array<{ name: string; type: string; action_type?: string; estimated_mins?: number; children?: Array<unknown> }>) : undefined,
    }));
  }

  async decomposeTask(planId: string, taskId: string): Promise<PlanTask[]> {
    const task = await this.getTask(taskId);
    if (!task || task.taskType !== 'compound') {
      return [];
    }

    const decomposition = await this.decomposeGoal(task.name, task.depth, task.depth + 3);
    const createdTasks: PlanTask[] = [];

    for (let i = 0; i < decomposition.tasks.length; i++) {
      const subtask = decomposition.tasks[i];
      const newTaskId = await this.createTask(task.planId, {
        name: subtask.name,
        taskType: subtask.type,
        actionType: subtask.actionType,
        parentTaskId: taskId,
        path: `${task.path}.${i + 1}`,
        depth: task.depth + 1,
        estimatedDurationMins: subtask.estimatedDurationMins,
      });
      const newTask = await this.getTask(newTaskId);
      if (newTask) createdTasks.push(newTask);
    }

    return createdTasks;
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  async createTask(planId: string, task: {
    name: string;
    taskType: TaskType;
    actionType?: ActionType;
    actionParams?: Record<string, unknown>;
    parentTaskId?: string;
    path?: string;
    depth?: number;
    dependsOn?: string[];
    estimatedDurationMins?: number;
  }): Promise<string> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error('Plan not found');

    const embedding = await this.generateEmbedding(task.name);

    const result = await executeStatement(
      `INSERT INTO plan_tasks (
        plan_id, tenant_id, name, task_embedding, parent_task_id, depth, path,
        task_type, action_type, action_params, depends_on, estimated_duration_mins
      ) VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING task_id`,
      [
        { name: 'planId', value: { stringValue: planId } },
        { name: 'tenantId', value: { stringValue: plan.tenantId } },
        { name: 'name', value: { stringValue: task.name } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'parentId', value: task.parentTaskId ? { stringValue: task.parentTaskId } : { isNull: true } },
        { name: 'depth', value: { longValue: task.depth || 0 } },
        { name: 'path', value: { stringValue: task.path || '1' } },
        { name: 'taskType', value: { stringValue: task.taskType } },
        { name: 'actionType', value: task.actionType ? { stringValue: task.actionType } : { isNull: true } },
        { name: 'actionParams', value: { stringValue: JSON.stringify(task.actionParams || {}) } },
        { name: 'dependsOn', value: { stringValue: `{${(task.dependsOn || []).join(',')}}` } },
        { name: 'estimatedMins', value: task.estimatedDurationMins ? { longValue: task.estimatedDurationMins } : { isNull: true } },
      ]
    );

    return (result.rows[0] as { task_id: string }).task_id;
  }

  async getTask(taskId: string): Promise<PlanTask | null> {
    const result = await executeStatement(
      `SELECT * FROM plan_tasks WHERE task_id = $1`,
      [{ name: 'taskId', value: { stringValue: taskId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapTask(result.rows[0] as Record<string, unknown>);
  }

  async getPlanTasks(planId: string): Promise<PlanTask[]> {
    const result = await executeStatement(
      `SELECT * FROM plan_tasks WHERE plan_id = $1 ORDER BY path`,
      [{ name: 'planId', value: { stringValue: planId } }]
    );

    return result.rows.map((row) => this.mapTask(row as Record<string, unknown>));
  }

  async getReadyTasks(planId: string): Promise<PlanTask[]> {
    const result = await executeStatement(
      `SELECT * FROM get_ready_tasks($1)`,
      [{ name: 'planId', value: { stringValue: planId } }]
    );

    const taskIds = result.rows.map((r) => (r as { task_id: string }).task_id);
    const tasks: PlanTask[] = [];

    for (const taskId of taskIds) {
      const task = await this.getTask(taskId);
      if (task) tasks.push(task);
    }

    return tasks;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, output?: string): Promise<void> {
    await executeStatement(
      `SELECT update_task_status($1, $2, $3)`,
      [
        { name: 'taskId', value: { stringValue: taskId } },
        { name: 'status', value: { stringValue: status } },
        { name: 'output', value: output ? { stringValue: output } : { isNull: true } },
      ]
    );
  }

  async executeTask(taskId: string, context?: Record<string, unknown>): Promise<{ success: boolean; output: string }> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error('Task not found');

    // Mark as in progress
    await this.updateTaskStatus(taskId, 'in_progress');

    try {
      let output = '';

      switch (task.actionType) {
        case 'generate':
          output = await this.executeGenerateAction(task, context);
          break;
        case 'analyze':
          output = await this.executeAnalyzeAction(task, context);
          break;
        case 'code':
          output = await this.executeCodeAction(task, context);
          break;
        case 'review':
          output = await this.executeReviewAction(task, context);
          break;
        case 'search':
          output = await this.executeSearchAction(task, context);
          break;
        case 'decide':
          output = await this.executeDecideAction(task, context);
          break;
        default:
          output = await this.executeGenericAction(task, context);
      }

      await this.updateTaskStatus(taskId, 'completed', output);
      return { success: true, output };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await executeStatement(
        `UPDATE plan_tasks SET attempts = attempts + 1, last_error = $2 WHERE task_id = $1`,
        [
          { name: 'taskId', value: { stringValue: taskId } },
          { name: 'error', value: { stringValue: errorMsg } },
        ]
      );

      // Check if max attempts reached
      const updatedTask = await this.getTask(taskId);
      if (updatedTask && updatedTask.attempts >= updatedTask.maxAttempts) {
        await this.updateTaskStatus(taskId, 'failed', `Failed after ${updatedTask.attempts} attempts: ${errorMsg}`);
      } else {
        await this.updateTaskStatus(taskId, 'pending');
      }

      return { success: false, output: errorMsg };
    }
  }

  private async executeGenerateAction(task: PlanTask, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Complete this task: ${task.name}

${task.description ? `Details: ${task.description}` : ''}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Provide a comprehensive response.`;

    return this.invokeModel(prompt);
  }

  private async executeAnalyzeAction(task: PlanTask, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Analyze the following: ${task.name}

${task.description ? `Details: ${task.description}` : ''}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Provide a detailed analysis with key findings and recommendations.`;

    return this.invokeModel(prompt);
  }

  private async executeCodeAction(task: PlanTask, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Write code for: ${task.name}

${task.description ? `Requirements: ${task.description}` : ''}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Provide well-structured, documented code.`;

    return this.invokeModel(prompt);
  }

  private async executeReviewAction(task: PlanTask, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Review the following: ${task.name}

${task.description ? `Details: ${task.description}` : ''}
${context ? `Content to review: ${JSON.stringify(context)}` : ''}

Provide constructive feedback with specific suggestions for improvement.`;

    return this.invokeModel(prompt);
  }

  private async executeSearchAction(task: PlanTask, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Research and find information about: ${task.name}

${task.description ? `Focus on: ${task.description}` : ''}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Provide relevant findings and sources.`;

    return this.invokeModel(prompt);
  }

  private async executeDecideAction(task: PlanTask, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Make a decision about: ${task.name}

${task.description ? `Considerations: ${task.description}` : ''}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Analyze options and provide a clear recommendation with rationale.`;

    return this.invokeModel(prompt);
  }

  private async executeGenericAction(task: PlanTask, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Execute this task: ${task.name}

${task.description ? `Details: ${task.description}` : ''}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Complete the task and provide the result.`;

    return this.invokeModel(prompt);
  }

  // ============================================================================
  // Milestones
  // ============================================================================

  async createMilestone(
    tenantId: string,
    planId: string,
    name: string,
    sequenceNumber: number,
    criteria: string[],
    targetDate?: Date
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO plan_milestones (plan_id, tenant_id, name, sequence_number, success_criteria, target_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING milestone_id`,
      [
        { name: 'planId', value: { stringValue: planId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'name', value: { stringValue: name } },
        { name: 'sequenceNumber', value: { longValue: sequenceNumber } },
        { name: 'criteria', value: { stringValue: JSON.stringify(criteria.map((c) => ({ criterion: c }))) } },
        { name: 'targetDate', value: targetDate ? { stringValue: targetDate.toISOString() } : { isNull: true } },
      ]
    );

    return (result.rows[0] as { milestone_id: string }).milestone_id;
  }

  async getPlanMilestones(planId: string): Promise<PlanMilestone[]> {
    const result = await executeStatement(
      `SELECT * FROM plan_milestones WHERE plan_id = $1 ORDER BY sequence_number`,
      [{ name: 'planId', value: { stringValue: planId } }]
    );

    return result.rows.map((row) => this.mapMilestone(row as Record<string, unknown>));
  }

  async checkMilestone(milestoneId: string): Promise<{ achieved: boolean; progress: number }> {
    const result = await executeStatement(
      `SELECT * FROM plan_milestones WHERE milestone_id = $1`,
      [{ name: 'milestoneId', value: { stringValue: milestoneId } }]
    );

    if (result.rows.length === 0) return { achieved: false, progress: 0 };

    const milestone = this.mapMilestone(result.rows[0] as Record<string, unknown>);

    // Check if required tasks are complete
    if (milestone.requiredTasks.length > 0) {
      const taskResult = await executeStatement(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'completed') as completed
         FROM plan_tasks WHERE task_id = ANY($1)`,
        [{ name: 'taskIds', value: { stringValue: `{${milestone.requiredTasks.join(',')}}` } }]
      );

      const counts = taskResult.rows[0] as { total: number; completed: number };
      const progress = counts.total > 0 ? (counts.completed / counts.total) * 100 : 0;
      const achieved = counts.completed === counts.total;

      if (achieved && milestone.status !== 'achieved') {
        await executeStatement(
          `UPDATE plan_milestones SET status = 'achieved', achieved_date = NOW() WHERE milestone_id = $1`,
          [{ name: 'milestoneId', value: { stringValue: milestoneId } }]
        );
      }

      return { achieved, progress };
    }

    return { achieved: milestone.status === 'achieved', progress: milestone.status === 'achieved' ? 100 : 0 };
  }

  // ============================================================================
  // Session Management (Multi-Session Continuity)
  // ============================================================================

  async startSession(planId: string, userId: string): Promise<PlanSession> {
    const result = await executeStatement(
      `SELECT start_plan_session($1, $2) as session_id`,
      [
        { name: 'planId', value: { stringValue: planId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    const sessionId = (result.rows[0] as { session_id: string }).session_id;
    return this.getSession(sessionId) as Promise<PlanSession>;
  }

  async getSession(sessionId: string): Promise<PlanSession | null> {
    const result = await executeStatement(
      `SELECT * FROM plan_sessions WHERE session_id = $1`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapSession(result.rows[0] as Record<string, unknown>);
  }

  async endSession(sessionId: string, notes?: string): Promise<SessionHandoff> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const plan = await this.getPlan(session.planId);
    if (!plan) throw new Error('Plan not found');

    const readyTasks = await this.getReadyTasks(session.planId);

    // Generate next steps
    const nextSteps = await this.generateNextSteps(session.planId, readyTasks);

    // End the session
    await executeStatement(
      `SELECT end_plan_session($1, $2, $3)`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'nextSteps', value: { stringValue: JSON.stringify(nextSteps) } },
        { name: 'notes', value: notes ? { stringValue: notes } : { isNull: true } },
      ]
    );

    // Generate summary
    const summary = await this.generateSessionSummary(sessionId);

    // Store in episodic memory
    await episodicMemoryService.createMemory(
      plan.tenantId,
      session.userId,
      `Work session on "${plan.name}": ${summary}`,
      'action',
      { category: 'planning', tags: ['session', 'progress'] }
    );

    return {
      planId: session.planId,
      planName: plan.name,
      progress: plan.progress,
      lastSessionSummary: summary,
      nextSteps,
      readyTasks,
      blockers: [], // Would come from plan.blockers
      estimatedRemainingHours: this.estimateRemainingHours(plan),
    };
  }

  async getSessionHandoff(planId: string): Promise<SessionHandoff | null> {
    const plan = await this.getPlan(planId);
    if (!plan) return null;

    // Get last session
    const result = await executeStatement(
      `SELECT * FROM plan_sessions WHERE plan_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [{ name: 'planId', value: { stringValue: planId } }]
    );

    let lastSessionSummary = 'No previous sessions';
    let nextSteps: Array<{ step: string; priority: number }> = [];

    if (result.rows.length > 0) {
      const lastSession = this.mapSession(result.rows[0] as Record<string, unknown>);
      lastSessionSummary = await this.generateSessionSummary(lastSession.sessionId);
      nextSteps = lastSession.nextSteps;
    }

    const readyTasks = await this.getReadyTasks(planId);

    return {
      planId,
      planName: plan.name,
      progress: plan.progress,
      lastSessionSummary,
      nextSteps: nextSteps.length > 0 ? nextSteps : await this.generateNextSteps(planId, readyTasks),
      readyTasks,
      blockers: [],
      estimatedRemainingHours: this.estimateRemainingHours(plan),
    };
  }

  private async generateNextSteps(planId: string, readyTasks: PlanTask[]): Promise<Array<{ step: string; priority: number }>> {
    if (readyTasks.length === 0) return [];

    return readyTasks.slice(0, 5).map((task, i) => ({
      step: task.name,
      priority: 5 - i,
    }));
  }

  private async generateSessionSummary(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) return 'Session not found';

    return `Completed ${session.tasksCompleted} tasks. Progress: ${session.progressAtStart?.toFixed(0)}% → ${session.progressAtEnd?.toFixed(0) || session.progressAtStart?.toFixed(0)}%`;
  }

  private estimateRemainingHours(plan: TaskPlan): number {
    if (!plan.estimatedDurationHours) return 0;
    return plan.estimatedDurationHours * (1 - plan.progress / 100);
  }

  // ============================================================================
  // Replanning
  // ============================================================================

  async replan(planId: string, reason: string, newGoal?: string): Promise<TaskPlan> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error('Plan not found');

    // Store old task tree
    const oldTaskTree = plan.taskTree;

    // Generate new decomposition
    const goal = newGoal || plan.rootGoal;
    const decomposition = await this.decomposeGoal(goal);

    // Create revision record
    await executeStatement(
      `INSERT INTO plan_revisions (
        plan_id, tenant_id, revision_number, revision_type, change_summary,
        previous_task_tree, new_task_tree, trigger_reason
      ) VALUES ($1, $2, 
        (SELECT COALESCE(MAX(revision_number), 0) + 1 FROM plan_revisions WHERE plan_id = $1),
        'replan', $3, $4, $5, 'user_request')`,
      [
        { name: 'planId', value: { stringValue: planId } },
        { name: 'tenantId', value: { stringValue: plan.tenantId } },
        { name: 'summary', value: { stringValue: reason } },
        { name: 'oldTree', value: { stringValue: JSON.stringify(oldTaskTree) } },
        { name: 'newTree', value: { stringValue: JSON.stringify(decomposition.tasks) } },
      ]
    );

    // Mark incomplete tasks as skipped
    await executeStatement(
      `UPDATE plan_tasks SET status = 'skipped' WHERE plan_id = $1 AND status NOT IN ('completed', 'skipped')`,
      [{ name: 'planId', value: { stringValue: planId } }]
    );

    // Create new tasks
    const newTree: TaskTreeNode = { name: goal, type: 'compound', children: decomposition.tasks };
    await this.createTasksFromTree(plan.tenantId, planId, newTree);

    // Update plan
    await executeStatement(
      `UPDATE task_plans SET
        task_tree = $2,
        root_goal = $3,
        total_tasks = (SELECT COUNT(*) FROM plan_tasks WHERE plan_id = $1 AND status != 'skipped')
      WHERE plan_id = $1`,
      [
        { name: 'planId', value: { stringValue: planId } },
        { name: 'taskTree', value: { stringValue: JSON.stringify(newTree) } },
        { name: 'rootGoal', value: { stringValue: goal } },
      ]
    );

    return this.getPlan(planId) as Promise<TaskPlan>;
  }

  // ============================================================================
  // Templates
  // ============================================================================

  async getTemplate(tenantId: string, slug: string): Promise<{ taskTree: TaskTreeNode; milestones: Array<{ name: string; sequenceNumber: number; criteria: string[] }> } | null> {
    const result = await executeStatement(
      `SELECT * FROM plan_templates WHERE tenant_id = $1 AND slug = $2 AND is_active = true`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'slug', value: { stringValue: slug } },
      ]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as { task_tree_template: string; milestones_template: string };
    const taskTreeTemplate = typeof row.task_tree_template === 'string' ? JSON.parse(row.task_tree_template) : row.task_tree_template;
    const milestonesTemplate = typeof row.milestones_template === 'string' ? JSON.parse(row.milestones_template) : row.milestones_template;

    return {
      taskTree: taskTreeTemplate.root || taskTreeTemplate,
      milestones: milestonesTemplate.map((m: { name: string; sequence_number: number; success_criteria: Array<{ criterion: string }> }) => ({
        name: m.name,
        sequenceNumber: m.sequence_number,
        criteria: m.success_criteria?.map((c) => c.criterion) || [],
      })),
    };
  }

  async getTemplates(tenantId: string, category?: string): Promise<Array<{ templateId: string; name: string; slug: string; description?: string; category?: string }>> {
    let query = `SELECT template_id, name, slug, description, category FROM plan_templates WHERE tenant_id = $1 AND is_active = true`;
    const params: Array<{ name: string; value: { stringValue: string } }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (category) {
      query += ` AND category = $2`;
      params.push({ name: 'category', value: { stringValue: category } });
    }

    query += ` ORDER BY times_used DESC`;

    const result = await executeStatement(query, params);
    return result.rows.map((row) => {
      const r = row as { template_id: string; name: string; slug: string; description?: string; category?: string };
      return {
        templateId: r.template_id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        category: r.category,
      };
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async createTasksFromTree(tenantId: string, planId: string, tree: TaskTreeNode, parentId?: string, path = '1', depth = 0): Promise<void> {
    const taskId = await this.createTask(planId, {
      name: tree.name,
      taskType: tree.type,
      actionType: tree.actionType,
      actionParams: tree.actionParams,
      parentTaskId: parentId,
      path,
      depth,
      dependsOn: tree.dependsOn,
      estimatedDurationMins: tree.estimatedDurationMins,
    });

    if (tree.children) {
      for (let i = 0; i < tree.children.length; i++) {
        await this.createTasksFromTree(tenantId, planId, tree.children[i], taskId, `${path}.${i + 1}`, depth + 1);
      }
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      await modelRouterService.invoke({
        modelId: 'amazon/titan-embed-text',
        messages: [{ role: 'user', content: text.substring(0, 8000) }],
      });
      return new Array(1536).fill(0);
    } catch {
      return new Array(1536).fill(0);
    }
  }

  private async invokeModel(prompt: string): Promise<string> {
    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
    });
    return response.content;
  }

  private mapPlan(row: Record<string, unknown>): TaskPlan {
    return {
      planId: String(row.plan_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      rootGoal: String(row.root_goal),
      taskTree: typeof row.task_tree === 'string' ? JSON.parse(row.task_tree) : (row.task_tree as TaskTreeNode) || { name: '', type: 'compound' },
      totalTasks: Number(row.total_tasks || 0),
      completedTasks: Number(row.completed_tasks || 0),
      status: (row.status as PlanStatus) || 'draft',
      progress: Number(row.progress || 0),
      currentPhase: row.current_phase ? String(row.current_phase) : undefined,
      isMultiSession: Boolean(row.is_multi_session),
      sessionsCount: Number(row.sessions_count || 0),
      priority: Number(row.priority || 5),
      estimatedDurationHours: row.estimated_duration_hours ? Number(row.estimated_duration_hours) : undefined,
      deadline: row.deadline ? new Date(row.deadline as string) : undefined,
      createdAt: new Date(row.created_at as string),
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
    };
  }

  private mapTask(row: Record<string, unknown>): PlanTask {
    return {
      taskId: String(row.task_id),
      planId: String(row.plan_id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      parentTaskId: row.parent_task_id ? String(row.parent_task_id) : undefined,
      depth: Number(row.depth || 0),
      path: String(row.path || '1'),
      taskType: (row.task_type as TaskType) || 'primitive',
      actionType: row.action_type as ActionType | undefined,
      actionParams: typeof row.action_params === 'string' ? JSON.parse(row.action_params) : (row.action_params as Record<string, unknown>) || {},
      dependsOn: (row.depends_on as string[]) || [],
      status: (row.status as TaskStatus) || 'pending',
      progress: Number(row.progress || 0),
      output: row.output ? String(row.output) : undefined,
      outputArtifacts: typeof row.output_artifacts === 'string' ? JSON.parse(row.output_artifacts) : (row.output_artifacts as Array<{ type: string; content: string }>) || [],
      estimatedDurationMins: row.estimated_duration_mins ? Number(row.estimated_duration_mins) : undefined,
      actualDurationMins: row.actual_duration_mins ? Number(row.actual_duration_mins) : undefined,
      attempts: Number(row.attempts || 0),
      maxAttempts: Number(row.max_attempts || 3),
      success: row.success !== null ? Boolean(row.success) : undefined,
      qualityScore: row.quality_score ? Number(row.quality_score) : undefined,
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }

  private mapMilestone(row: Record<string, unknown>): PlanMilestone {
    return {
      milestoneId: String(row.milestone_id),
      planId: String(row.plan_id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      sequenceNumber: Number(row.sequence_number),
      successCriteria: typeof row.success_criteria === 'string' ? JSON.parse(row.success_criteria) : (row.success_criteria as Array<{ criterion: string }>) || [],
      requiredTasks: (row.required_tasks as string[]) || [],
      status: (row.status as 'pending' | 'in_progress' | 'achieved' | 'missed') || 'pending',
      targetDate: row.target_date ? new Date(row.target_date as string) : undefined,
      achievedDate: row.achieved_date ? new Date(row.achieved_date as string) : undefined,
    };
  }

  private mapSession(row: Record<string, unknown>): PlanSession {
    return {
      sessionId: String(row.session_id),
      planId: String(row.plan_id),
      userId: String(row.user_id),
      startedAt: new Date(row.started_at as string),
      endedAt: row.ended_at ? new Date(row.ended_at as string) : undefined,
      durationMins: row.duration_mins ? Number(row.duration_mins) : undefined,
      progressAtStart: Number(row.progress_at_start || 0),
      progressAtEnd: row.progress_at_end ? Number(row.progress_at_end) : undefined,
      tasksCompleted: Number(row.tasks_completed || 0),
      tasksWorkedOn: (row.tasks_worked_on as string[]) || [],
      nextSteps: typeof row.next_steps === 'string' ? JSON.parse(row.next_steps) : (row.next_steps as Array<{ step: string; priority: number }>) || [],
      sessionNotes: row.session_notes ? String(row.session_notes) : undefined,
    };
  }
}

export const goalPlanningService = new GoalPlanningService();
