/**
 * RADIANT v5.0 - Sovereign Mesh Agent Runtime Service
 * 
 * Manages autonomous agent execution with OODA loop state management.
 * Integrates with Genesis Cato for safety, AI Helper for intelligence,
 * and supports HITL approval workflows.
 */

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../../db/client';
import { enhancedLogger } from '../../logging/enhanced-logger';
import { aiHelperService, type AIHelperConfig } from './ai-helper.service';

const logger = enhancedLogger;

// ============================================================================
// TYPES
// ============================================================================

export type AgentCategory = 'research' | 'coding' | 'data' | 'outreach' | 'creative' | 'operations' | 'custom';
export type AgentExecutionMode = 'sync' | 'async' | 'streaming';
export type AgentSafetyProfile = 'minimal' | 'standard' | 'strict' | 'hipaa';
export type AgentExecutionStatus = 'pending' | 'provisioning' | 'running' | 'paused' | 'completed' | 'failed' | 'timeout' | 'budget_exceeded' | 'cancelled';
export type OODAPhase = 'observe' | 'orient' | 'decide' | 'act' | 'report';

export interface Agent {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: AgentCategory;
  capabilities: string[];
  executionMode: AgentExecutionMode;
  maxIterations: number;
  defaultTimeoutMinutes: number;
  defaultBudgetUsd: number;
  maxBudgetUsd: number;
  allowedModels: string[];
  allowedTools: string[];
  safetyProfile: AgentSafetyProfile;
  requiresHitl: boolean;
  cbfOverrides: Record<string, unknown>;
  implementationType: string;
  implementationRef: string;
  aiHelperConfig: AIHelperConfig;
  isActive: boolean;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  goal: string;
  constraints: Record<string, unknown>;
  config: Record<string, unknown>;
  status: AgentExecutionStatus;
  currentPhase: OODAPhase;
  currentIteration: number;
  observations: unknown[];
  hypotheses: unknown[];
  plan: unknown[];
  completedActions: unknown[];
  artifacts: unknown[];
  outputSummary?: string;
  budgetAllocated: number;
  budgetConsumed: number;
  tokensUsed: number;
  startedAt?: Date;
  completedAt?: Date;
  timeoutAt?: Date;
  hitlRequired: boolean;
}

export interface StartExecutionParams {
  agentId: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  goal: string;
  constraints?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface OODAState {
  phase: OODAPhase;
  observations: unknown[];
  hypotheses: unknown[];
  plan: unknown[];
  completedActions: unknown[];
  artifacts: unknown[];
  budgetRemaining: number;
  tokensUsed: number;
  goalAchieved: boolean;
}

// ============================================================================
// AGENT RUNTIME SERVICE
// ============================================================================

class AgentRuntimeService {
  private agentCache: Map<string, { agent: Agent; cachedAt: number }> = new Map();
  private readonly AGENT_CACHE_TTL = 60000; // 1 minute

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string, tenantId: string): Promise<Agent | null> {
    const cacheKey = `${agentId}:${tenantId}`;
    const cached = this.agentCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.AGENT_CACHE_TTL) {
      return cached.agent;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM agents 
         WHERE id = :agentId 
         AND is_active = true 
         AND (scope = 'system' OR tenant_id = :tenantId)`,
        [stringParam('agentId', agentId), stringParam('tenantId', tenantId)]
      );

      if (!result.rows?.[0]) return null;
      
      const agent = this.rowToAgent(result.rows[0]);
      this.agentCache.set(cacheKey, { agent, cachedAt: Date.now() });
      return agent;
    } catch (error) {
      logger.error('Failed to get agent', { error, agentId });
      return null;
    }
  }

  /**
   * List available agents for a tenant
   */
  async listAgents(tenantId: string, category?: AgentCategory): Promise<Agent[]> {
    try {
      let sql = `SELECT * FROM agents 
                 WHERE is_active = true 
                 AND (scope = 'system' OR tenant_id = :tenantId)`;
      const params = [stringParam('tenantId', tenantId)];

      if (category) {
        sql += ` AND category = :category::agent_category`;
        params.push(stringParam('category', category));
      }

      sql += ` ORDER BY display_name`;

      const result = await executeStatement(sql, params);
      return (result.rows || []).map(r => this.rowToAgent(r));
    } catch (error) {
      logger.error('Failed to list agents', { error, tenantId });
      return [];
    }
  }

  /**
   * Start agent execution
   */
  async startExecution(params: StartExecutionParams): Promise<{ executionId: string; status: AgentExecutionStatus }> {
    const agent = await this.getAgent(params.agentId, params.tenantId);
    if (!agent) {
      throw new Error(`Agent not found: ${params.agentId}`);
    }

    // Calculate budget
    const requestedBudget = (params.constraints?.budget_usd as number) || agent.defaultBudgetUsd;
    const budget = Math.min(requestedBudget, agent.maxBudgetUsd);

    // Calculate timeout
    const timeoutMinutes = (params.config?.timeout_minutes as number) || agent.defaultTimeoutMinutes;

    try {
      // Create execution record
      const result = await executeStatement(
        `INSERT INTO agent_executions 
         (agent_id, tenant_id, user_id, session_id, goal, constraints, config, 
          budget_allocated, timeout_at, hitl_required, status, current_phase)
         VALUES (:agentId, :tenantId, :userId, :sessionId, :goal, :constraints::jsonb, :config::jsonb,
          :budget, NOW() + INTERVAL '${timeoutMinutes} minutes', :hitlRequired, 'pending', 'observe')
         RETURNING id`,
        [
          stringParam('agentId', params.agentId),
          stringParam('tenantId', params.tenantId),
          params.userId ? stringParam('userId', params.userId) : stringParam('userId', ''),
          params.sessionId ? stringParam('sessionId', params.sessionId) : stringParam('sessionId', ''),
          stringParam('goal', params.goal),
          stringParam('constraints', JSON.stringify(params.constraints || {})),
          stringParam('config', JSON.stringify(params.config || {})),
          doubleParam('budget', budget),
          boolParam('hitlRequired', agent.requiresHitl),
        ]
      );

      const executionId = this.extractStringValue(result.rows?.[0]?.id);
      if (!executionId) {
        throw new Error('Failed to create execution record');
      }

      // Dispatch for async execution
      if (agent.executionMode === 'async') {
        await this.dispatchExecution(executionId, params.tenantId);
      }

      logger.info('Agent execution started', { 
        executionId, 
        agentId: params.agentId, 
        tenantId: params.tenantId,
        goal: params.goal.substring(0, 100),
      });

      return { executionId, status: 'pending' };
    } catch (error) {
      logger.error('Failed to start agent execution', { error, params });
      throw error;
    }
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string, tenantId: string): Promise<AgentExecution | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM agent_executions WHERE id = :executionId AND tenant_id = :tenantId`,
        [stringParam('executionId', executionId), stringParam('tenantId', tenantId)]
      );

      if (!result.rows?.[0]) return null;
      return this.rowToExecution(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get execution', { error, executionId });
      return null;
    }
  }

  /**
   * List executions for a tenant
   */
  async listExecutions(
    tenantId: string, 
    options?: { agentId?: string; status?: AgentExecutionStatus; limit?: number }
  ): Promise<AgentExecution[]> {
    try {
      let sql = `SELECT * FROM agent_executions WHERE tenant_id = :tenantId`;
      const params = [stringParam('tenantId', tenantId)];

      if (options?.agentId) {
        sql += ` AND agent_id = :agentId`;
        params.push(stringParam('agentId', options.agentId));
      }

      if (options?.status) {
        sql += ` AND status = :status::agent_execution_status`;
        params.push(stringParam('status', options.status));
      }

      sql += ` ORDER BY created_at DESC LIMIT ${options?.limit || 50}`;

      const result = await executeStatement(sql, params);
      return (result.rows || []).map(r => this.rowToExecution(r));
    } catch (error) {
      logger.error('Failed to list executions', { error, tenantId });
      return [];
    }
  }

  /**
   * Run a single OODA iteration
   */
  async runOODAIteration(executionId: string, tenantId: string): Promise<{ completed: boolean; nextPhase: OODAPhase }> {
    const execution = await this.getExecution(executionId, tenantId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'running') {
      throw new Error(`Execution is not running: ${execution.status}`);
    }

    const agent = await this.getAgent(execution.agentId, tenantId);
    if (!agent) {
      throw new Error(`Agent not found: ${execution.agentId}`);
    }

    // Build current state
    const state: OODAState = {
      phase: execution.currentPhase,
      observations: execution.observations,
      hypotheses: execution.hypotheses,
      plan: execution.plan,
      completedActions: execution.completedActions,
      artifacts: execution.artifacts,
      budgetRemaining: execution.budgetAllocated - execution.budgetConsumed,
      tokensUsed: execution.tokensUsed,
      goalAchieved: false,
    };

    // Check budget and iteration limits
    if (state.budgetRemaining <= 0) {
      await this.updateExecutionStatus(executionId, 'budget_exceeded');
      return { completed: true, nextPhase: 'report' };
    }

    if (execution.currentIteration >= agent.maxIterations) {
      await this.updateExecutionStatus(executionId, 'timeout');
      return { completed: true, nextPhase: 'report' };
    }

    const startTime = Date.now();
    let newState: OODAState;

    try {
      switch (state.phase) {
        case 'observe':
          newState = await this.observePhase(execution, agent, state);
          break;
        case 'orient':
          newState = await this.orientPhase(execution, agent, state);
          break;
        case 'decide':
          newState = await this.decidePhase(execution, agent, state);
          break;
        case 'act':
          newState = await this.actPhase(execution, agent, state);
          break;
        case 'report':
          await this.reportPhase(execution, agent, state);
          return { completed: true, nextPhase: 'report' };
        default:
          throw new Error(`Unknown phase: ${state.phase}`);
      }

      // Log iteration
      await this.logIteration(executionId, execution.currentIteration + 1, state.phase, {
        input: state,
        output: newState,
        durationMs: Date.now() - startTime,
      });

      // Update execution state
      await this.updateExecutionState(executionId, newState, execution.currentIteration + 1);

      return { 
        completed: newState.goalAchieved, 
        nextPhase: newState.goalAchieved ? 'report' : newState.phase 
      };
    } catch (error) {
      logger.error('OODA iteration failed', { error, executionId, phase: state.phase });
      await this.updateExecutionStatus(executionId, 'failed', (error as Error).message);
      return { completed: true, nextPhase: 'report' };
    }
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string, tenantId: string, reason?: string): Promise<boolean> {
    try {
      await executeStatement(
        `UPDATE agent_executions 
         SET status = 'cancelled', completed_at = NOW(), output_summary = :reason
         WHERE id = :executionId AND tenant_id = :tenantId AND status IN ('pending', 'running', 'paused')`,
        [
          stringParam('executionId', executionId),
          stringParam('tenantId', tenantId),
          stringParam('reason', reason || 'Cancelled by user'),
        ]
      );
      return true;
    } catch (error) {
      logger.error('Failed to cancel execution', { error, executionId });
      return false;
    }
  }

  /**
   * Resume paused execution (after HITL approval)
   */
  async resumeExecution(executionId: string, tenantId: string, modifications?: Record<string, unknown>): Promise<boolean> {
    try {
      let sql = `UPDATE agent_executions SET status = 'running' WHERE id = :executionId AND tenant_id = :tenantId AND status = 'paused'`;
      const params = [stringParam('executionId', executionId), stringParam('tenantId', tenantId)];

      if (modifications) {
        sql = `UPDATE agent_executions SET status = 'running', plan = :plan::jsonb WHERE id = :executionId AND tenant_id = :tenantId AND status = 'paused'`;
        params.push(stringParam('plan', JSON.stringify(modifications)));
      }

      await executeStatement(sql, params);
      
      // Re-dispatch for execution
      await this.dispatchExecution(executionId, tenantId);
      
      return true;
    } catch (error) {
      logger.error('Failed to resume execution', { error, executionId });
      return false;
    }
  }

  // ============================================================================
  // OODA PHASE IMPLEMENTATIONS
  // ============================================================================

  private async observePhase(execution: AgentExecution, agent: Agent, state: OODAState): Promise<OODAState> {
    const model = agent.allowedModels[0] || 'claude-sonnet-4';

    const prompt = `You are a ${agent.displayName}. Your goal: "${execution.goal}"

Current observations: ${JSON.stringify(state.observations)}
Current plan: ${JSON.stringify(state.plan)}
Budget remaining: $${state.budgetRemaining}

What information do you need to gather? List 1-3 specific observations needed.
Respond with JSON: { "observationsNeeded": ["...", "..."], "reasoning": "..." }`;

    const response = await this.callModel(execution.tenantId, model, prompt);
    const parsed = this.parseJson<{ observationsNeeded: string[]; reasoning: string }>(response.content);

    // Execute observations using allowed tools
    const newObservations: unknown[] = [];
    for (const obs of parsed.observationsNeeded || []) {
      // Use AI Helper for disambiguation if needed
      const observation = await this.executeObservation(obs, execution, agent);
      newObservations.push({
        timestamp: new Date().toISOString(),
        query: obs,
        result: observation,
      });
    }

    return {
      ...state,
      observations: [...state.observations, ...newObservations],
      phase: 'orient',
      tokensUsed: state.tokensUsed + (response.usage?.totalTokens || 0),
      budgetRemaining: state.budgetRemaining - (response.cost || 0),
    };
  }

  private async orientPhase(execution: AgentExecution, agent: Agent, state: OODAState): Promise<OODAState> {
    const model = agent.allowedModels[0] || 'claude-sonnet-4';

    const prompt = `You are a ${agent.displayName}. Your goal: "${execution.goal}"

Observations: ${JSON.stringify(state.observations)}

Analyze these observations. Is the goal achieved? What hypotheses do you have?
Respond with JSON: { "goalAchieved": true/false, "hypotheses": ["...", "..."], "analysis": "..." }`;

    const response = await this.callModel(execution.tenantId, model, prompt);
    const parsed = this.parseJson<{ goalAchieved: boolean; hypotheses: string[]; analysis: string }>(response.content);

    return {
      ...state,
      hypotheses: parsed.hypotheses || [],
      goalAchieved: parsed.goalAchieved || false,
      phase: parsed.goalAchieved ? 'report' : 'decide',
      tokensUsed: state.tokensUsed + (response.usage?.totalTokens || 0),
      budgetRemaining: state.budgetRemaining - (response.cost || 0),
    };
  }

  private async decidePhase(execution: AgentExecution, agent: Agent, state: OODAState): Promise<OODAState> {
    const model = agent.allowedModels[0] || 'claude-sonnet-4';

    const prompt = `You are a ${agent.displayName}. Your goal: "${execution.goal}"

Observations: ${JSON.stringify(state.observations)}
Hypotheses: ${JSON.stringify(state.hypotheses)}
Available tools: ${agent.allowedTools.join(', ')}
Budget remaining: $${state.budgetRemaining}

What actions should be taken? Create a plan with 1-3 steps.
Respond with JSON: { "plan": [{ "tool": "...", "params": {...}, "rationale": "..." }] }`;

    const response = await this.callModel(execution.tenantId, model, prompt);
    const parsed = this.parseJson<{ plan: Array<{ tool: string; params: Record<string, unknown>; rationale: string }> }>(response.content);

    // Safety check via Genesis Cato if strict profile
    if (agent.safetyProfile === 'strict' || agent.safetyProfile === 'hipaa') {
      const safetyResult = await this.evaluateSafety(execution, parsed.plan);
      if (!safetyResult.allowed) {
        // Use AI Helper for recovery suggestion
        const recovery = await aiHelperService.suggestRecovery({
          error: { code: 'SAFETY_BLOCKED', message: safetyResult.reason || 'Action blocked by safety evaluation' },
          action: { app: 'agent', action: 'execute_plan', params: { plan: parsed.plan } },
          attemptNumber: 1,
        }, execution.tenantId, agent.aiHelperConfig);

        if (!recovery.canAutoRecover && agent.requiresHitl) {
          // Pause for HITL approval
          await this.updateExecutionStatus(execution.id, 'paused');
          await this.createHITLRequest(execution, parsed.plan, safetyResult.reason);
          return { ...state, phase: 'decide' }; // Stay in decide phase
        }
      }
    }

    return {
      ...state,
      plan: parsed.plan || [],
      phase: 'act',
      tokensUsed: state.tokensUsed + (response.usage?.totalTokens || 0),
      budgetRemaining: state.budgetRemaining - (response.cost || 0),
    };
  }

  private async actPhase(execution: AgentExecution, agent: Agent, state: OODAState): Promise<OODAState> {
    const completedActions: unknown[] = [...state.completedActions];
    const artifacts: unknown[] = [...state.artifacts];
    let budgetRemaining = state.budgetRemaining;
    let tokensUsed = state.tokensUsed;

    for (const action of state.plan as Array<{ tool: string; params: Record<string, unknown>; rationale: string }>) {
      try {
        const result = await this.executeAction(action, execution, agent);
        completedActions.push({
          action,
          result,
          timestamp: new Date().toISOString(),
          success: true,
        });

        if (result.artifact) {
          artifacts.push(result.artifact);
        }
      } catch (error) {
        // Use AI Helper for error recovery
        const recovery = await aiHelperService.suggestRecovery({
          error: { 
            code: (error as Error).name || 'EXECUTION_ERROR', 
            message: (error as Error).message 
          },
          action: { app: action.tool, action: action.tool, params: action.params },
          attemptNumber: 1,
        }, execution.tenantId, agent.aiHelperConfig);

        if (recovery.canAutoRecover && recovery.modifiedParams) {
          try {
            const retryResult = await this.executeAction(
              { ...action, params: recovery.modifiedParams },
              execution,
              agent
            );
            completedActions.push({
              action,
              result: retryResult,
              timestamp: new Date().toISOString(),
              success: true,
              recovered: true,
            });
          } catch (retryError) {
            completedActions.push({
              action,
              error: (retryError as Error).message,
              timestamp: new Date().toISOString(),
              success: false,
            });
          }
        } else {
          completedActions.push({
            action,
            error: (error as Error).message,
            timestamp: new Date().toISOString(),
            success: false,
            suggestion: recovery.suggestion,
          });
        }
      }
    }

    return {
      ...state,
      completedActions,
      artifacts,
      plan: [], // Clear plan after execution
      phase: 'observe', // Loop back to observe
      budgetRemaining,
      tokensUsed,
    };
  }

  private async reportPhase(execution: AgentExecution, agent: Agent, state: OODAState): Promise<void> {
    const model = agent.allowedModels[0] || 'claude-sonnet-4';

    const prompt = `Summarize the work completed:
Goal: "${execution.goal}"
Actions taken: ${JSON.stringify(state.completedActions)}
Artifacts produced: ${JSON.stringify(state.artifacts)}

Provide a concise summary (2-3 sentences).`;

    const response = await this.callModel(execution.tenantId, model, prompt);

    // Update execution as completed
    await executeStatement(
      `UPDATE agent_executions SET 
        status = 'completed', 
        completed_at = NOW(), 
        output_summary = :summary,
        artifacts = :artifacts::jsonb, 
        budget_consumed = :budgetConsumed, 
        tokens_used = :tokensUsed,
        completed_actions = :completedActions::jsonb
       WHERE id = :executionId`,
      [
        stringParam('summary', response.content),
        stringParam('artifacts', JSON.stringify(state.artifacts)),
        doubleParam('budgetConsumed', execution.budgetAllocated - state.budgetRemaining),
        longParam('tokensUsed', state.tokensUsed),
        stringParam('completedActions', JSON.stringify(state.completedActions)),
        stringParam('executionId', execution.id),
      ]
    );

    logger.info('Agent execution completed', {
      executionId: execution.id,
      agentId: execution.agentId,
      tokensUsed: state.tokensUsed,
      budgetConsumed: execution.budgetAllocated - state.budgetRemaining,
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async executeObservation(
    query: string, 
    execution: AgentExecution, 
    agent: Agent
  ): Promise<unknown> {
    // Implement tool execution based on agent's allowed tools
    // This would integrate with the app registry and tool execution system
    logger.debug('Executing observation', { query, executionId: execution.id });
    
    // For now, return a placeholder
    return {
      type: 'observation',
      query,
      result: `Observation result for: ${query}`,
      timestamp: new Date().toISOString(),
    };
  }

  private async executeAction(
    action: { tool: string; params: Record<string, unknown>; rationale: string },
    execution: AgentExecution,
    agent: Agent
  ): Promise<{ success: boolean; result?: unknown; artifact?: unknown }> {
    // Implement action execution based on agent's allowed tools
    logger.debug('Executing action', { action, executionId: execution.id });
    
    // Validate tool is allowed
    if (!agent.allowedTools.includes(action.tool)) {
      throw new Error(`Tool not allowed: ${action.tool}`);
    }

    // For now, return a placeholder
    return {
      success: true,
      result: `Action result for: ${action.tool}`,
    };
  }

  private async evaluateSafety(
    execution: AgentExecution,
    plan: unknown[]
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Integrate with Genesis Cato safety pipeline
    // For now, return allowed
    return { allowed: true };
  }

  private async createHITLRequest(
    execution: AgentExecution,
    plan: unknown[],
    reason?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO hitl_approval_requests 
       (queue_id, tenant_id, agent_execution_id, request_type, request_summary, request_details, priority, expires_at)
       VALUES (
         (SELECT id FROM hitl_queue_configs WHERE tenant_id = :tenantId AND trigger_type = 'agent_plan' LIMIT 1),
         :tenantId, :executionId, 'agent_plan', :summary, :details::jsonb, 'normal', NOW() + INTERVAL '1 hour'
       )`,
      [
        stringParam('tenantId', execution.tenantId),
        stringParam('executionId', execution.id),
        stringParam('summary', `Agent plan requires approval: ${reason || 'Safety evaluation'}`),
        stringParam('details', JSON.stringify({ plan, reason })),
      ]
    );
  }

  private async dispatchExecution(executionId: string, tenantId: string): Promise<void> {
    // Update status to running
    await executeStatement(
      `UPDATE agent_executions SET status = 'running', started_at = NOW() WHERE id = :executionId`,
      [stringParam('executionId', executionId)]
    );
    
    // In production: send to SQS for async processing
    logger.info('Execution dispatched', { executionId, tenantId });
  }

  private async updateExecutionStatus(executionId: string, status: AgentExecutionStatus, error?: string): Promise<void> {
    await executeStatement(
      `UPDATE agent_executions SET status = :status::agent_execution_status, output_summary = COALESCE(:error, output_summary) WHERE id = :executionId`,
      [
        stringParam('status', status),
        stringParam('error', error || ''),
        stringParam('executionId', executionId),
      ]
    );
  }

  private async updateExecutionState(executionId: string, state: OODAState, iteration: number): Promise<void> {
    await executeStatement(
      `UPDATE agent_executions SET 
        current_phase = :phase::ooda_phase,
        current_iteration = :iteration,
        observations = :observations::jsonb,
        hypotheses = :hypotheses::jsonb,
        plan = :plan::jsonb,
        completed_actions = :completedActions::jsonb,
        artifacts = :artifacts::jsonb,
        budget_consumed = budget_allocated - :budgetRemaining,
        tokens_used = :tokensUsed
       WHERE id = :executionId`,
      [
        stringParam('phase', state.phase),
        longParam('iteration', iteration),
        stringParam('observations', JSON.stringify(state.observations)),
        stringParam('hypotheses', JSON.stringify(state.hypotheses)),
        stringParam('plan', JSON.stringify(state.plan)),
        stringParam('completedActions', JSON.stringify(state.completedActions)),
        stringParam('artifacts', JSON.stringify(state.artifacts)),
        doubleParam('budgetRemaining', state.budgetRemaining),
        longParam('tokensUsed', state.tokensUsed),
        stringParam('executionId', executionId),
      ]
    );
  }

  private async logIteration(
    executionId: string,
    iterationNumber: number,
    phase: OODAPhase,
    data: { input: unknown; output: unknown; durationMs: number }
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO agent_iteration_logs 
       (execution_id, iteration_number, phase, phase_input, phase_output, duration_ms, completed_at)
       VALUES (:executionId, :iteration, :phase::ooda_phase, :input::jsonb, :output::jsonb, :duration, NOW())`,
      [
        stringParam('executionId', executionId),
        longParam('iteration', iterationNumber),
        stringParam('phase', phase),
        stringParam('input', JSON.stringify(data.input)),
        stringParam('output', JSON.stringify(data.output)),
        longParam('duration', data.durationMs),
      ]
    );
  }

  private async callModel(
    tenantId: string,
    model: string,
    prompt: string
  ): Promise<{ content: string; usage?: { totalTokens: number }; cost?: number }> {
    try {
      // Import LiteLLM service for actual model calls
      const { callLiteLLM } = await import('../litellm.service.js');
      
      const response = await callLiteLLM({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.4,
      });

      return {
        content: response.content,
        usage: response.usage ? { totalTokens: response.usage.total_tokens || 0 } : undefined,
        cost: response.usage ? Math.ceil((response.usage.prompt_tokens * 0.003 + response.usage.completion_tokens * 0.015) / 10) : 0,
      };
    } catch (error) {
      logger.error('Model call failed', { error, model, tenantId });
      throw error;
    }
  }

  private parseJson<T>(content: string): T {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch {
      throw new Error(`Failed to parse JSON: ${content.substring(0, 200)}`);
    }
  }

  private extractStringValue(field: unknown): string {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && 'stringValue' in field) {
      return (field as { stringValue: string }).stringValue;
    }
    return String(field);
  }

  private rowToAgent(row: Record<string, unknown>): Agent {
    const getValue = (field: string) => {
      const val = row[field];
      if (val && typeof val === 'object' && 'stringValue' in val) {
        return (val as { stringValue: string }).stringValue;
      }
      if (val && typeof val === 'object' && 'booleanValue' in val) {
        return (val as { booleanValue: boolean }).booleanValue;
      }
      if (val && typeof val === 'object' && 'longValue' in val) {
        return (val as { longValue: number }).longValue;
      }
      return val;
    };

    return {
      id: getValue('id') as string,
      name: getValue('name') as string,
      displayName: getValue('display_name') as string,
      description: getValue('description') as string | undefined,
      category: getValue('category') as AgentCategory,
      capabilities: this.parseArray(getValue('capabilities')),
      executionMode: getValue('execution_mode') as AgentExecutionMode,
      maxIterations: Number(getValue('max_iterations')) || 50,
      defaultTimeoutMinutes: Number(getValue('default_timeout_minutes')) || 30,
      defaultBudgetUsd: Number(getValue('default_budget_usd')) || 1.0,
      maxBudgetUsd: Number(getValue('max_budget_usd')) || 10.0,
      allowedModels: this.parseArray(getValue('allowed_models')),
      allowedTools: this.parseArray(getValue('allowed_tools')),
      safetyProfile: getValue('safety_profile') as AgentSafetyProfile,
      requiresHitl: getValue('requires_hitl') as boolean || false,
      cbfOverrides: this.parseJsonField(getValue('cbf_overrides')) as Record<string, unknown> || {},
      implementationType: getValue('implementation_type') as string,
      implementationRef: getValue('implementation_ref') as string,
      aiHelperConfig: (this.parseJsonField(getValue('ai_helper_config')) || { enabled: true }) as any,
      isActive: getValue('is_active') as boolean || true,
    };
  }

  private rowToExecution(row: Record<string, unknown>): AgentExecution {
    const getValue = (field: string) => {
      const val = row[field];
      if (val && typeof val === 'object' && 'stringValue' in val) {
        return (val as { stringValue: string }).stringValue;
      }
      if (val && typeof val === 'object' && 'booleanValue' in val) {
        return (val as { booleanValue: boolean }).booleanValue;
      }
      if (val && typeof val === 'object' && 'longValue' in val) {
        return (val as { longValue: number }).longValue;
      }
      return val;
    };

    return {
      id: getValue('id') as string,
      agentId: getValue('agent_id') as string,
      tenantId: getValue('tenant_id') as string,
      userId: getValue('user_id') as string | undefined,
      sessionId: getValue('session_id') as string | undefined,
      goal: getValue('goal') as string,
      constraints: this.parseJsonField(getValue('constraints')) as Record<string, unknown> || {},
      config: this.parseJsonField(getValue('config')) as Record<string, unknown> || {},
      status: getValue('status') as AgentExecutionStatus,
      currentPhase: getValue('current_phase') as OODAPhase || 'observe',
      currentIteration: Number(getValue('current_iteration')) || 0,
      observations: this.parseJsonField(getValue('observations')) as unknown[] || [],
      hypotheses: this.parseJsonField(getValue('hypotheses')) as unknown[] || [],
      plan: this.parseJsonField(getValue('plan')) as unknown[] || [],
      completedActions: this.parseJsonField(getValue('completed_actions')) as unknown[] || [],
      artifacts: this.parseJsonField(getValue('artifacts')) as unknown[] || [],
      outputSummary: getValue('output_summary') as string | undefined,
      budgetAllocated: Number(getValue('budget_allocated')) || 0,
      budgetConsumed: Number(getValue('budget_consumed')) || 0,
      tokensUsed: Number(getValue('tokens_used')) || 0,
      hitlRequired: getValue('hitl_required') as boolean || false,
    };
  }

  private parseArray(value: unknown): string[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return value.replace(/[{}]/g, '').split(',').filter(Boolean);
      }
    }
    return [];
  }

  private parseJsonField(value: unknown): Record<string, unknown> | unknown[] | null {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Export singleton instance
export const agentRuntimeService = new AgentRuntimeService();
