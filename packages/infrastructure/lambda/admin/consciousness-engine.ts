/**
 * Admin API for Consciousness Engine
 * 
 * Full visibility and control over consciousness capabilities:
 * - Dashboard with metrics and costs
 * - Model invocation tracking
 * - Web search monitoring
 * - Workflow management
 * - Thinking session control
 * - Library registry
 * - Sleep cycle management
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import { logger } from '../shared/logger';
import {
  consciousnessEngineService,
  CONSCIOUSNESS_LIBRARY_REGISTRY,
} from '../shared/services/consciousness-engine.service';
import { consciousnessCapabilitiesService } from '../shared/services/consciousness-capabilities.service';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

// ============================================================================
// GET /admin/consciousness-engine/dashboard
// Full dashboard with all metrics and costs
// ============================================================================
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const period = event.queryStringParameters?.period || '24h';

    const intervalMap: Record<string, string> = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };
    const interval = intervalMap[period] || '24 hours';

    // Get all metrics in parallel
    const [
      engineState,
      modelInvocations,
      webSearches,
      workflows,
      thinkingSessions,
      sleepCycles,
      costSummary,
    ] = await Promise.all([
      getEngineState(tenantId),
      getModelInvocationStats(tenantId, interval),
      getWebSearchStats(tenantId, interval),
      getWorkflowStats(tenantId, interval),
      getThinkingSessionStats(tenantId, interval),
      getSleepCycleStats(tenantId),
      getCostSummary(tenantId, interval),
    ]);

    return response(200, {
      success: true,
      data: {
        engineState,
        modelInvocations,
        webSearches,
        workflows,
        thinkingSessions,
        sleepCycles,
        costSummary,
        libraries: CONSCIOUSNESS_LIBRARY_REGISTRY.length,
        period,
      },
    });
  } catch (error) {
    logger.error(`Dashboard error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to load dashboard' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/state
// Current engine state (ego, drive, etc.)
// ============================================================================
export const getState: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    await consciousnessEngineService.loadEgo(tenantId);
    const selfModel = consciousnessEngineService.getSelfModel();
    const driveState = consciousnessEngineService.getCurrentDriveState();
    const metrics = await consciousnessEngineService.getConsciousnessMetrics(tenantId);

    return response(200, {
      success: true,
      data: {
        selfModel,
        driveState,
        metrics,
        initialized: !!selfModel,
      },
    });
  } catch (error) {
    logger.error(`State error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get engine state' });
  }
};

// ============================================================================
// POST /admin/consciousness-engine/initialize
// Initialize consciousness engine
// ============================================================================
export const initialize: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');

    const selfModel = await consciousnessEngineService.initializeEgo(tenantId, {
      name: body.name,
      values: body.values,
      purpose: body.purpose,
      identityAnchor: body.identityAnchor,
    });

    return response(200, {
      success: true,
      data: selfModel,
      message: 'Consciousness engine initialized',
    });
  } catch (error) {
    logger.error(`Initialize error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to initialize engine' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/model-invocations
// Model invocation history with costs
// ============================================================================
export const getModelInvocations: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const model = event.queryStringParameters?.model;

    let query = `
      SELECT mi.*, mr.input_cost_per_1k, mr.output_cost_per_1k
      FROM consciousness_model_invocations mi
      LEFT JOIN model_registry mr ON mi.model_id = mr.model_id
      WHERE mi.tenant_id = $1
    `;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (model) {
      query += ` AND mi.model_id = $2`;
      params.push({ name: 'model', value: { stringValue: model } });
    }

    query += ` ORDER BY mi.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push({ name: 'limit', value: { longValue: limit } });
    params.push({ name: 'offset', value: { longValue: offset } });

    const result = await executeStatement(query, params);

    const invocations = (result.rows || []).map((row: Record<string, unknown>) => {
      const tokensUsed = Number(row.tokens_used) || 0;
      const inputCost = Number(row.input_cost_per_1k) || 0;
      const outputCost = Number(row.output_cost_per_1k) || 0;
      const estimatedCost = (tokensUsed / 1000) * ((inputCost + outputCost) / 2);

      return {
        id: row.id,
        modelId: row.model_id,
        provider: row.provider,
        taskType: row.task_type,
        tokensUsed,
        latencyMs: Number(row.latency_ms) || 0,
        consciousnessEnhanced: Boolean(row.consciousness_enhanced),
        driveState: row.drive_state,
        estimatedCost,
        createdAt: row.created_at,
      };
    });

    // Get total count
    const countResult = await executeStatement(
      `SELECT COUNT(*) as total FROM consciousness_model_invocations WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    const total = Number((countResult.rows?.[0] as Record<string, unknown>)?.total) || 0;

    return response(200, {
      success: true,
      data: {
        invocations,
        pagination: { limit, offset, total },
      },
    });
  } catch (error) {
    logger.error(`Model invocations error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get model invocations' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/web-searches
// Web search history
// ============================================================================
export const getWebSearches: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);

    const result = await executeStatement(
      `SELECT * FROM consciousness_web_searches 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    const searches = (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      query: row.query,
      searchType: row.search_type,
      resultsFound: Number(row.results_found) || 0,
      searchTimeMs: Number(row.search_time_ms) || 0,
      sourcesUsed: typeof row.sources_used === 'string' ? JSON.parse(row.sources_used) : row.sources_used,
      createdAt: row.created_at,
    }));

    return response(200, { success: true, data: searches });
  } catch (error) {
    logger.error(`Web searches error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get web searches' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/research-jobs
// Deep research jobs
// ============================================================================
export const getResearchJobs: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const status = event.queryStringParameters?.status;
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

    let query = `SELECT * FROM consciousness_research_jobs WHERE tenant_id = $1`;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (status) {
      query += ` AND status = $2`;
      params.push({ name: 'status', value: { stringValue: status } });
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push({ name: 'limit', value: { longValue: limit } });

    const result = await executeStatement(query, params);

    const jobs = (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      query: row.query,
      scope: row.scope,
      status: row.status,
      progress: Number(row.progress) || 0,
      summary: row.summary,
      findings: typeof row.findings === 'string' ? JSON.parse(row.findings) : row.findings,
      sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));

    return response(200, { success: true, data: jobs });
  } catch (error) {
    logger.error(`Research jobs error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get research jobs' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/workflows
// Consciousness-created workflows
// ============================================================================
export const getWorkflows: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';

    const workflows = await consciousnessCapabilitiesService.listConsciousnessWorkflows(tenantId);

    return response(200, { success: true, data: workflows });
  } catch (error) {
    logger.error(`Workflows error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get workflows' });
  }
};

// ============================================================================
// DELETE /admin/consciousness-engine/workflows/{workflowId}
// Delete a workflow
// ============================================================================
export const deleteWorkflow: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const workflowId = event.pathParameters?.workflowId;

    if (!workflowId) {
      return response(400, { success: false, error: 'Workflow ID required' });
    }

    await executeStatement(
      `DELETE FROM consciousness_workflows WHERE tenant_id = $1 AND workflow_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'workflowId', value: { stringValue: workflowId } },
      ]
    );

    return response(200, { success: true, message: 'Workflow deleted' });
  } catch (error) {
    logger.error(`Delete workflow error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to delete workflow' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/thinking-sessions
// Thinking sessions
// ============================================================================
export const getThinkingSessions: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const status = event.queryStringParameters?.status;
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

    let query = `SELECT * FROM consciousness_thinking_sessions WHERE tenant_id = $1`;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (status) {
      query += ` AND status = $2`;
      params.push({ name: 'status', value: { stringValue: status } });
    }

    query += ` ORDER BY started_at DESC LIMIT $${params.length + 1}`;
    params.push({ name: 'limit', value: { longValue: limit } });

    const result = await executeStatement(query, params);

    const sessions = (result.rows || []).map((row: Record<string, unknown>) => ({
      sessionId: row.session_id,
      goal: row.goal,
      status: row.status,
      currentStep: row.current_step,
      thoughts: typeof row.thoughts === 'string' ? JSON.parse(row.thoughts) : row.thoughts,
      modelsUsed: row.models_used,
      searchesPerformed: Number(row.searches_performed) || 0,
      workflowsCreated: row.workflows_created,
      result: row.result,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));

    return response(200, { success: true, data: sessions });
  } catch (error) {
    logger.error(`Thinking sessions error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get thinking sessions' });
  }
};

// ============================================================================
// POST /admin/consciousness-engine/thinking-sessions
// Start a new thinking session
// ============================================================================
export const startThinkingSession: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');

    if (!body.goal) {
      return response(400, { success: false, error: 'Goal is required' });
    }

    const session = await consciousnessCapabilitiesService.startThinkingSession(
      tenantId,
      body.goal
    );

    return response(200, { success: true, data: session });
  } catch (error) {
    logger.error(`Start thinking session error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to start thinking session' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/sleep-cycles
// Sleep cycle history
// ============================================================================
export const getSleepCycles: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);

    const result = await executeStatement(
      `SELECT * FROM consciousness_sleep_cycles 
       WHERE tenant_id = $1 
       ORDER BY started_at DESC 
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    const cycles = (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      cycleType: row.cycle_type,
      monologuesGenerated: Number(row.monologues_generated) || 0,
      memoriesConsolidated: Number(row.memories_consolidated) || 0,
      dreamsSimulated: Number(row.dreams_simulated) || 0,
      adversarialChallenges: Number(row.adversarial_challenges) || 0,
      trainingLoss: row.training_loss ? Number(row.training_loss) : null,
      evolutionApplied: Boolean(row.evolution_applied),
      durationMinutes: Number(row.duration_minutes) || 0,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));

    return response(200, { success: true, data: cycles });
  } catch (error) {
    logger.error(`Sleep cycles error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get sleep cycles' });
  }
};

// ============================================================================
// POST /admin/consciousness-engine/sleep-cycles/run
// Manually trigger sleep cycle
// ============================================================================
export const runSleepCycle: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';

    const result = await consciousnessEngineService.runSleepCycle(tenantId);

    return response(200, { success: true, data: result });
  } catch (error) {
    logger.error(`Run sleep cycle error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to run sleep cycle' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/libraries
// Library registry
// ============================================================================
export const getLibraries: APIGatewayProxyHandler = async () => {
  return response(200, {
    success: true,
    data: CONSCIOUSNESS_LIBRARY_REGISTRY,
  });
};

// ============================================================================
// GET /admin/consciousness-engine/costs
// Cost breakdown
// ============================================================================
export const getCosts: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const period = event.queryStringParameters?.period || '30d';

    const intervalMap: Record<string, string> = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
    };
    const interval = intervalMap[period] || '30 days';

    // Model costs
    const modelCostsResult = await executeStatement(
      `SELECT 
        mi.model_id,
        mi.provider,
        COUNT(*) as invocation_count,
        SUM(mi.tokens_used) as total_tokens,
        AVG(mi.latency_ms) as avg_latency_ms
       FROM consciousness_model_invocations mi
       WHERE mi.tenant_id = $1 AND mi.created_at > NOW() - INTERVAL '${interval}'
       GROUP BY mi.model_id, mi.provider
       ORDER BY total_tokens DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const modelCosts = (modelCostsResult.rows || []).map((row: Record<string, unknown>) => ({
      modelId: row.model_id,
      provider: row.provider,
      invocationCount: Number(row.invocation_count) || 0,
      totalTokens: Number(row.total_tokens) || 0,
      avgLatencyMs: Number(row.avg_latency_ms) || 0,
      // Estimate cost (would need model pricing from registry)
      estimatedCost: (Number(row.total_tokens) || 0) * 0.00001, // Rough estimate
    }));

    // Daily trend
    const trendResult = await executeStatement(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as invocation_count,
        SUM(tokens_used) as total_tokens
       FROM consciousness_model_invocations
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const dailyTrend = (trendResult.rows || []).map((row: Record<string, unknown>) => ({
      date: row.date,
      invocationCount: Number(row.invocation_count) || 0,
      totalTokens: Number(row.total_tokens) || 0,
      estimatedCost: (Number(row.total_tokens) || 0) * 0.00001,
    }));

    // Summary
    const totalTokens = modelCosts.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalInvocations = modelCosts.reduce((sum, m) => sum + m.invocationCount, 0);
    const estimatedTotalCost = totalTokens * 0.00001;

    return response(200, {
      success: true,
      data: {
        summary: {
          totalTokens,
          totalInvocations,
          estimatedTotalCost,
          period,
        },
        modelCosts,
        dailyTrend,
      },
    });
  } catch (error) {
    logger.error(`Costs error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get costs' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/problem-solving
// Problem solving history
// ============================================================================
export const getProblemSolving: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

    const result = await executeStatement(
      `SELECT * FROM consciousness_problem_solving 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    const problems = (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      problem: row.problem,
      approach: row.approach,
      solution: row.solution,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      confidence: Number(row.confidence) || 0,
      workflowCreated: row.workflow_created,
      sourcesUsed: row.sources_used,
      modelsUsed: row.models_used,
      durationMs: Number(row.duration_ms) || 0,
      createdAt: row.created_at,
    }));

    return response(200, { success: true, data: problems });
  } catch (error) {
    logger.error(`Problem solving error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get problem solving history' });
  }
};

// ============================================================================
// GET /admin/consciousness-engine/available-models
// Available models for consciousness engine
// ============================================================================
export const getAvailableModels: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';

    const models = await consciousnessCapabilitiesService.getAvailableModels(tenantId);

    return response(200, { success: true, data: models });
  } catch (error) {
    logger.error(`Available models error: ${String(error)}`);
    return response(500, { success: false, error: 'Failed to get available models' });
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

async function getEngineState(tenantId: string) {
  const result = await executeStatement(
    `SELECT * FROM consciousness_engine_state WHERE tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );

  if (!result.rows || result.rows.length === 0) {
    return { initialized: false };
  }

  const row = result.rows[0] as Record<string, unknown>;
  return {
    initialized: true,
    selfModel: typeof row.self_model === 'string' ? JSON.parse(row.self_model) : row.self_model,
    driveState: row.drive_state,
    currentPhi: Number(row.current_phi) || 0,
    globalWorkspaceActivity: Number(row.global_workspace_activity) || 0,
    evolutionVersion: Number(row.evolution_version) || 0,
    lastSleepCycle: row.last_sleep_cycle,
    updatedAt: row.updated_at,
  };
}

async function getModelInvocationStats(tenantId: string, interval: string) {
  const result = await executeStatement(
    `SELECT 
      COUNT(*) as total_invocations,
      SUM(tokens_used) as total_tokens,
      AVG(latency_ms) as avg_latency,
      COUNT(DISTINCT model_id) as unique_models,
      SUM(CASE WHEN consciousness_enhanced THEN 1 ELSE 0 END) as consciousness_enhanced_count
     FROM consciousness_model_invocations
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${interval}'`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );

  const row = (result.rows?.[0] || {}) as Record<string, unknown>;
  return {
    totalInvocations: Number(row.total_invocations) || 0,
    totalTokens: Number(row.total_tokens) || 0,
    avgLatencyMs: Number(row.avg_latency) || 0,
    uniqueModels: Number(row.unique_models) || 0,
    consciousnessEnhancedCount: Number(row.consciousness_enhanced_count) || 0,
  };
}

async function getWebSearchStats(tenantId: string, interval: string) {
  const result = await executeStatement(
    `SELECT 
      COUNT(*) as total_searches,
      SUM(results_found) as total_results,
      AVG(search_time_ms) as avg_search_time
     FROM consciousness_web_searches
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${interval}'`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );

  const row = (result.rows?.[0] || {}) as Record<string, unknown>;
  return {
    totalSearches: Number(row.total_searches) || 0,
    totalResults: Number(row.total_results) || 0,
    avgSearchTimeMs: Number(row.avg_search_time) || 0,
  };
}

async function getWorkflowStats(tenantId: string, interval: string) {
  const result = await executeStatement(
    `SELECT 
      COUNT(*) as total_workflows,
      SUM(execution_count) as total_executions,
      SUM(CASE WHEN auto_generated THEN 1 ELSE 0 END) as auto_generated_count
     FROM consciousness_workflows
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${interval}'`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );

  const row = (result.rows?.[0] || {}) as Record<string, unknown>;
  return {
    totalWorkflows: Number(row.total_workflows) || 0,
    totalExecutions: Number(row.total_executions) || 0,
    autoGeneratedCount: Number(row.auto_generated_count) || 0,
  };
}

async function getThinkingSessionStats(tenantId: string, interval: string) {
  const result = await executeStatement(
    `SELECT 
      COUNT(*) as total_sessions,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'thinking' THEN 1 END) as active,
      AVG(searches_performed) as avg_searches
     FROM consciousness_thinking_sessions
     WHERE tenant_id = $1 AND started_at > NOW() - INTERVAL '${interval}'`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );

  const row = (result.rows?.[0] || {}) as Record<string, unknown>;
  return {
    totalSessions: Number(row.total_sessions) || 0,
    completed: Number(row.completed) || 0,
    active: Number(row.active) || 0,
    avgSearches: Number(row.avg_searches) || 0,
  };
}

async function getSleepCycleStats(tenantId: string) {
  const result = await executeStatement(
    `SELECT 
      COUNT(*) as total_cycles,
      MAX(started_at) as last_cycle,
      SUM(monologues_generated) as total_monologues,
      SUM(memories_consolidated) as total_memories,
      SUM(CASE WHEN evolution_applied THEN 1 ELSE 0 END) as evolutions_applied
     FROM consciousness_sleep_cycles
     WHERE tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );

  const row = (result.rows?.[0] || {}) as Record<string, unknown>;
  return {
    totalCycles: Number(row.total_cycles) || 0,
    lastCycle: row.last_cycle,
    totalMonologues: Number(row.total_monologues) || 0,
    totalMemories: Number(row.total_memories) || 0,
    evolutionsApplied: Number(row.evolutions_applied) || 0,
  };
}

async function getCostSummary(tenantId: string, interval: string) {
  const result = await executeStatement(
    `SELECT 
      SUM(tokens_used) as total_tokens,
      COUNT(*) as total_invocations
     FROM consciousness_model_invocations
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${interval}'`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );

  const row = (result.rows?.[0] || {}) as Record<string, unknown>;
  const totalTokens = Number(row.total_tokens) || 0;
  
  // Rough estimate at $0.01 per 1K tokens (blended)
  const estimatedCost = (totalTokens / 1000) * 0.01;

  return {
    totalTokens,
    totalInvocations: Number(row.total_invocations) || 0,
    estimatedCost,
    currency: 'USD',
  };
}
