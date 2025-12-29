// RADIANT v4.18.0 - Admin API for Zero-Cost Ego System
// Manages Ego configuration, identity, affect, and working memory
// Cost: $0 additional - persistent state in PostgreSQL, injected into existing model calls

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { egoContextService, type EgoConfig, type EgoIdentity } from '../shared/services/ego-context.service';
import { executeStatement } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

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
// GET /admin/ego/state
// Get full Ego state (config, identity, affect, memory, goals)
// ============================================================================
export const getEgoState: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const state = await egoContextService.getFullState(tenantId);
    
    return response(200, { 
      success: true, 
      data: state,
      costInfo: {
        additionalMonthlyCost: 0,
        description: 'Zero-cost Ego - uses existing PostgreSQL and model infrastructure',
      },
    });
  } catch (error) {
    logger.error('Error fetching Ego state', error);
    return response(500, { success: false, error: 'Failed to fetch Ego state' });
  }
};

// ============================================================================
// GET /admin/ego/config
// Get Ego configuration for tenant
// ============================================================================
export const getEgoConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const config = await egoContextService.getConfig(tenantId);
    return response(200, { success: true, data: config });
  } catch (error) {
    logger.error('Error fetching Ego config', error);
    return response(500, { success: false, error: 'Failed to fetch Ego config' });
  }
};

// ============================================================================
// PUT /admin/ego/config
// Update Ego configuration
// ============================================================================
export const updateEgoConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const updates = JSON.parse(event.body || '{}') as Partial<EgoConfig>;
    
    await egoContextService.updateConfig(tenantId, updates);
    const config = await egoContextService.getConfig(tenantId);
    
    return response(200, { success: true, data: config });
  } catch (error) {
    logger.error('Error updating Ego config', error);
    return response(500, { success: false, error: 'Failed to update Ego config' });
  }
};

// ============================================================================
// GET /admin/ego/identity
// Get Ego identity
// ============================================================================
export const getEgoIdentity: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const identity = await egoContextService.getIdentity(tenantId);
    return response(200, { success: true, data: identity });
  } catch (error) {
    logger.error('Error fetching Ego identity', error);
    return response(500, { success: false, error: 'Failed to fetch Ego identity' });
  }
};

// ============================================================================
// PUT /admin/ego/identity
// Update Ego identity
// ============================================================================
export const updateEgoIdentity: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const updates = JSON.parse(event.body || '{}') as Partial<EgoIdentity>;
    
    await egoContextService.updateIdentity(tenantId, updates);
    const identity = await egoContextService.getIdentity(tenantId);
    
    return response(200, { success: true, data: identity });
  } catch (error) {
    logger.error('Error updating Ego identity', error);
    return response(500, { success: false, error: 'Failed to update Ego identity' });
  }
};

// ============================================================================
// GET /admin/ego/affect
// Get current affective state
// ============================================================================
export const getEgoAffect: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const affect = await egoContextService.getAffect(tenantId);
    return response(200, { success: true, data: affect });
  } catch (error) {
    logger.error('Error fetching Ego affect', error);
    return response(500, { success: false, error: 'Failed to fetch Ego affect' });
  }
};

// ============================================================================
// POST /admin/ego/affect/trigger
// Manually trigger an affective event (for testing)
// ============================================================================
export const triggerAffectEvent: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const { eventType, valenceDelta, arousalDelta } = JSON.parse(event.body || '{}');
    
    if (!eventType || valenceDelta === undefined || arousalDelta === undefined) {
      return response(400, { success: false, error: 'Missing required fields: eventType, valenceDelta, arousalDelta' });
    }
    
    const affect = await egoContextService.updateAffect(tenantId, eventType, valenceDelta, arousalDelta);
    
    return response(200, { success: true, data: affect });
  } catch (error) {
    logger.error('Error triggering affect event', error);
    return response(500, { success: false, error: 'Failed to trigger affect event' });
  }
};

// ============================================================================
// POST /admin/ego/affect/reset
// Reset affective state to neutral
// ============================================================================
export const resetAffect: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    await executeStatement(
      `UPDATE ego_affect SET
        valence = 0,
        arousal = 0.5,
        curiosity = 0.5,
        satisfaction = 0.5,
        frustration = 0,
        confidence = 0.6,
        engagement = 0.5,
        dominant_emotion = 'neutral',
        updated_at = NOW()
      WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const affect = await egoContextService.getAffect(tenantId);
    return response(200, { success: true, data: affect });
  } catch (error) {
    logger.error('Error resetting affect', error);
    return response(500, { success: false, error: 'Failed to reset affect' });
  }
};

// ============================================================================
// GET /admin/ego/memory
// Get working memory
// ============================================================================
export const getWorkingMemory: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    
    const memories = await egoContextService.getWorkingMemory(tenantId, limit);
    return response(200, { success: true, data: memories });
  } catch (error) {
    logger.error('Error fetching working memory', error);
    return response(500, { success: false, error: 'Failed to fetch working memory' });
  }
};

// ============================================================================
// POST /admin/ego/memory
// Add a memory to working memory
// ============================================================================
export const addMemory: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const { memoryType, content, importance, isPinned } = JSON.parse(event.body || '{}');
    
    if (!memoryType || !content) {
      return response(400, { success: false, error: 'Missing required fields: memoryType, content' });
    }
    
    const memoryId = await egoContextService.addMemory(
      tenantId, 
      memoryType, 
      content, 
      importance || 0.5,
      undefined,
      isPinned || false
    );
    
    return response(201, { success: true, data: { memoryId } });
  } catch (error) {
    logger.error('Error adding memory', error);
    return response(500, { success: false, error: 'Failed to add memory' });
  }
};

// ============================================================================
// DELETE /admin/ego/memory/:memoryId
// Delete a specific memory
// ============================================================================
export const deleteMemory: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const memoryId = event.pathParameters?.memoryId;
    
    if (!memoryId) {
      return response(400, { success: false, error: 'Missing memoryId parameter' });
    }
    
    await executeStatement(
      `DELETE FROM ego_working_memory WHERE tenant_id = $1 AND memory_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'memoryId', value: { stringValue: memoryId } },
      ]
    );
    
    return response(200, { success: true });
  } catch (error) {
    logger.error('Error deleting memory', error);
    return response(500, { success: false, error: 'Failed to delete memory' });
  }
};

// ============================================================================
// DELETE /admin/ego/memory
// Clear all non-pinned working memory
// ============================================================================
export const clearMemory: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const result = await executeStatement(
      `DELETE FROM ego_working_memory WHERE tenant_id = $1 AND is_pinned = false`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    return response(200, { 
      success: true, 
      data: { deletedCount: result.rowCount || 0 }
    });
  } catch (error) {
    logger.error('Error clearing memory', error);
    return response(500, { success: false, error: 'Failed to clear memory' });
  }
};

// ============================================================================
// GET /admin/ego/goals
// Get active goals
// ============================================================================
export const getGoals: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const status = event.queryStringParameters?.status || 'active';
    const limit = parseInt(event.queryStringParameters?.limit || '10', 10);
    
    const result = await executeStatement(
      `SELECT * FROM ego_goals 
       WHERE tenant_id = $1 AND ($2 = 'all' OR status = $2)
       ORDER BY priority DESC, created_at DESC 
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'status', value: { stringValue: status } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    
    const goals = result.rows.map((row: Record<string, unknown>) => ({
      goalId: String(row.goal_id),
      goalType: String(row.goal_type),
      description: String(row.description),
      priority: Number(row.priority || 5),
      status: String(row.status),
      progress: Number(row.progress || 0),
      createdAt: String(row.created_at),
      targetCompletion: row.target_completion ? String(row.target_completion) : null,
    }));
    
    return response(200, { success: true, data: goals });
  } catch (error) {
    logger.error('Error fetching goals', error);
    return response(500, { success: false, error: 'Failed to fetch goals' });
  }
};

// ============================================================================
// POST /admin/ego/goals
// Add a new goal
// ============================================================================
export const addGoal: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const { goalType, description, priority } = JSON.parse(event.body || '{}');
    
    if (!goalType || !description) {
      return response(400, { success: false, error: 'Missing required fields: goalType, description' });
    }
    
    const goalId = await egoContextService.addGoal(tenantId, goalType, description, priority || 5);
    
    return response(201, { success: true, data: { goalId } });
  } catch (error) {
    logger.error('Error adding goal', error);
    return response(500, { success: false, error: 'Failed to add goal' });
  }
};

// ============================================================================
// PATCH /admin/ego/goals/:goalId
// Update a goal (status, progress)
// ============================================================================
export const updateGoal: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const goalId = event.pathParameters?.goalId;
    const updates = JSON.parse(event.body || '{}');
    
    if (!goalId) {
      return response(400, { success: false, error: 'Missing goalId parameter' });
    }
    
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'goalId', value: { stringValue: goalId } },
    ];
    let idx = 3;
    
    if (updates.status !== undefined) {
      setClauses.push(`status = $${idx}`);
      params.push({ name: `p${idx}`, value: { stringValue: updates.status } });
      idx++;
    }
    if (updates.progress !== undefined) {
      setClauses.push(`progress = $${idx}`);
      params.push({ name: `p${idx}`, value: { doubleValue: updates.progress } });
      idx++;
    }
    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${idx}`);
      params.push({ name: `p${idx}`, value: { longValue: updates.priority } });
      idx++;
    }
    
    await executeStatement(
      `UPDATE ego_goals SET ${setClauses.join(', ')} WHERE tenant_id = $1 AND goal_id = $2`,
      params as Parameters<typeof executeStatement>[1]
    );
    
    return response(200, { success: true });
  } catch (error) {
    logger.error('Error updating goal', error);
    return response(500, { success: false, error: 'Failed to update goal' });
  }
};

// ============================================================================
// GET /admin/ego/preview
// Preview the Ego context that would be injected
// ============================================================================
export const previewEgoContext: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const context = await egoContextService.buildEgoContext(tenantId);
    
    if (!context) {
      return response(200, { 
        success: true, 
        data: null,
        message: 'Ego injection is disabled for this tenant',
      });
    }
    
    return response(200, { 
      success: true, 
      data: {
        contextBlock: context.contextBlock,
        tokenEstimate: context.tokenEstimate,
        stateSnapshot: context.stateSnapshot,
      },
    });
  } catch (error) {
    logger.error('Error previewing Ego context', error);
    return response(500, { success: false, error: 'Failed to preview Ego context' });
  }
};

// ============================================================================
// GET /admin/ego/injection-log
// Get recent Ego injection logs
// ============================================================================
export const getInjectionLog: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const hours = parseInt(event.queryStringParameters?.hours || '24', 10);
    
    const result = await executeStatement(
      `SELECT * FROM ego_injection_log 
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY created_at DESC 
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    
    const logs = result.rows.map((row: Record<string, unknown>) => ({
      logId: String(row.log_id),
      tokenCount: Number(row.token_count || 0),
      affectSnapshot: row.affect_snapshot ? JSON.parse(String(row.affect_snapshot)) : null,
      activeGoalsCount: Number(row.active_goals_count || 0),
      workingMemoryCount: Number(row.working_memory_count || 0),
      buildTimeMs: Number(row.build_time_ms || 0),
      createdAt: String(row.created_at),
    }));
    
    return response(200, { 
      success: true, 
      data: logs,
      summary: {
        totalInjections: logs.length,
        avgTokenCount: logs.length > 0 ? logs.reduce((s, l) => s + l.tokenCount, 0) / logs.length : 0,
        avgBuildTimeMs: logs.length > 0 ? logs.reduce((s, l) => s + l.buildTimeMs, 0) / logs.length : 0,
      },
    });
  } catch (error) {
    logger.error('Error fetching injection log', error);
    return response(500, { success: false, error: 'Failed to fetch injection log' });
  }
};

// ============================================================================
// GET /admin/ego/dashboard
// Get full Ego dashboard data
// ============================================================================
export const getEgoDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const [state, preview, recentLogs] = await Promise.all([
      egoContextService.getFullState(tenantId),
      egoContextService.buildEgoContext(tenantId),
      executeStatement(
        `SELECT COUNT(*) as count, 
                AVG(token_count) as avg_tokens,
                AVG(build_time_ms) as avg_build_time
         FROM ego_injection_log 
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      ),
    ]);
    
    const logStats = recentLogs.rows[0] as Record<string, unknown>;
    
    return response(200, {
      success: true,
      data: {
        state,
        preview: preview ? {
          contextBlock: preview.contextBlock,
          tokenEstimate: preview.tokenEstimate,
          stateSnapshot: preview.stateSnapshot,
        } : null,
        stats: {
          injectionsLast24h: Number(logStats.count || 0),
          avgTokensPerInjection: Number(logStats.avg_tokens || 0),
          avgBuildTimeMs: Number(logStats.avg_build_time || 0),
        },
        costInfo: {
          additionalMonthlyCost: 0,
          perTenantCost: 0,
          description: 'Zero-cost architecture - Ego state stored in PostgreSQL, injected into existing model calls',
          comparison: {
            sagemakerG5xlarge: 360,
            sagemakerServerless: 35,
            groqAPI: 10,
            thisApproach: 0,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching Ego dashboard', error);
    return response(500, { success: false, error: 'Failed to fetch Ego dashboard' });
  }
};
