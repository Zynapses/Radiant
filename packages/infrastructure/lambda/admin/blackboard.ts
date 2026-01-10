/**
 * RADIANT Semantic Blackboard Admin API
 * 
 * API endpoints for managing the multi-agent orchestration system:
 * - Resolved decisions (Facts tab)
 * - Question groups
 * - Agent registry
 * - Resource locks
 * - Process hydration
 * - Configuration
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Client } from 'pg';
import { Redis } from 'ioredis';
import { semanticBlackboardService } from '../shared/services/semantic-blackboard.service';
import { agentOrchestratorService } from '../shared/services/agent-orchestrator.service';
import { processHydrationService } from '../shared/services/process-hydration.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { getDbClient, getRedisClient } from '../shared/db/connections';

// ============================================================================
// Types
// ============================================================================

interface RouteHandler {
  (event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function parseBody<T>(event: APIGatewayProxyEvent): T {
  if (!event.body) {
    throw new Error('Request body is required');
  }
  return JSON.parse(event.body) as T;
}

// ============================================================================
// Route Handlers
// ============================================================================

// Dashboard
const getDashboard: RouteHandler = async (event, tenantId) => {
  const [blackboardStats, orchestratorStats, hydrationStats] = await Promise.all([
    semanticBlackboardService.getResolvedDecisions(tenantId, { limit: 0 }),
    agentOrchestratorService.getDashboardData(tenantId),
    processHydrationService.getStats(tenantId),
  ]);

  return response(200, {
    success: true,
    data: {
      resolvedDecisions: blackboardStats.total,
      ...orchestratorStats,
      hydration: hydrationStats,
    },
  });
};

// Resolved Decisions (Facts)
const getResolvedDecisions: RouteHandler = async (event, tenantId) => {
  const params = event.queryStringParameters || {};
  const result = await semanticBlackboardService.getResolvedDecisions(tenantId, {
    includeInvalid: params.includeInvalid === 'true',
    topic: params.topic,
    limit: params.limit ? parseInt(params.limit, 10) : 50,
    offset: params.offset ? parseInt(params.offset, 10) : 0,
  });

  return response(200, { success: true, data: result });
};

const invalidateDecision: RouteHandler = async (event, tenantId) => {
  const decisionId = event.pathParameters?.decisionId;
  if (!decisionId) {
    return response(400, { success: false, error: 'Decision ID required' });
  }

  const body = parseBody<{ reason: string; newAnswer?: string }>(event);
  const userId = event.requestContext.authorizer?.claims?.sub || 'system';

  const result = await semanticBlackboardService.invalidateAnswer({
    tenantId,
    decisionId,
    reason: body.reason,
    invalidatedBy: userId,
    newAnswer: body.newAnswer,
  });

  return response(200, { success: true, data: result });
};

// Question Groups
const getQuestionGroups: RouteHandler = async (event, tenantId) => {
  const groups = await semanticBlackboardService.getPendingGroups(tenantId);
  return response(200, { success: true, data: { groups } });
};

const answerQuestionGroup: RouteHandler = async (event, tenantId) => {
  const groupId = event.pathParameters?.groupId;
  if (!groupId) {
    return response(400, { success: false, error: 'Group ID required' });
  }

  const body = parseBody<{ answer: string }>(event);
  const userId = event.requestContext.authorizer?.claims?.sub || 'system';

  const result = await semanticBlackboardService.processAnswer(
    tenantId,
    groupId,
    body.answer,
    userId
  );

  return response(200, { success: true, data: result });
};

// Agents
const getActiveAgents: RouteHandler = async (event, tenantId) => {
  const agents = await agentOrchestratorService.getActiveAgents(tenantId);
  return response(200, { success: true, data: { agents } });
};

const getAgent: RouteHandler = async (event, tenantId) => {
  const agentId = event.pathParameters?.agentId;
  if (!agentId) {
    return response(400, { success: false, error: 'Agent ID required' });
  }

  const agent = await agentOrchestratorService.getAgent(agentId);
  if (!agent) {
    return response(404, { success: false, error: 'Agent not found' });
  }

  return response(200, { success: true, data: { agent } });
};

// Resource Locks
const getActiveLocks: RouteHandler = async (event, tenantId) => {
  const locks = await agentOrchestratorService.getActiveLocks(tenantId);
  return response(200, { success: true, data: { locks } });
};

const forceReleaseLock: RouteHandler = async (event, tenantId) => {
  const lockId = event.pathParameters?.lockId;
  if (!lockId) {
    return response(400, { success: false, error: 'Lock ID required' });
  }

  // Get the lock to find the holder agent
  const db = await getDbClient();
  const lockResult = await db.query(
    `SELECT holder_agent_id FROM resource_locks WHERE id = $1 AND tenant_id = $2`,
    [lockId, tenantId]
  );

  if (lockResult.rows.length === 0) {
    return response(404, { success: false, error: 'Lock not found' });
  }

  const result = await agentOrchestratorService.releaseResourceLock(
    lockId,
    lockResult.rows[0].holder_agent_id
  );

  return response(200, { success: true, data: result });
};

// Hydration
const getHydrationSnapshots: RouteHandler = async (event, tenantId) => {
  const agentId = event.pathParameters?.agentId;
  if (!agentId) {
    return response(400, { success: false, error: 'Agent ID required' });
  }

  const params = event.queryStringParameters || {};
  const snapshots = await processHydrationService.listSnapshots(tenantId, agentId, {
    limit: params.limit ? parseInt(params.limit, 10) : 10,
    includeExpired: params.includeExpired === 'true',
  });

  return response(200, { success: true, data: { snapshots } });
};

const restoreAgent: RouteHandler = async (event, tenantId) => {
  const agentId = event.pathParameters?.agentId;
  if (!agentId) {
    return response(400, { success: false, error: 'Agent ID required' });
  }

  const body = parseBody<{ checkpointName?: string }>(event);
  const result = await processHydrationService.restoreState(
    tenantId,
    agentId,
    body.checkpointName
  );

  if (!result.success) {
    return response(400, { success: false, error: result.error });
  }

  return response(200, { success: true, data: result });
};

// Configuration
const getConfig: RouteHandler = async (event, tenantId) => {
  const db = await getDbClient();
  const result = await db.query(
    `SELECT * FROM blackboard_config WHERE tenant_id = $1 OR tenant_id IS NULL
     ORDER BY tenant_id NULLS LAST LIMIT 1`,
    [tenantId]
  );

  const config = result.rows[0] || {};
  return response(200, { success: true, data: { config } });
};

const updateConfig: RouteHandler = async (event, tenantId) => {
  const body = parseBody<Record<string, unknown>>(event);
  const db = await getDbClient();

  // Build update query dynamically
  const allowedFields = [
    'similarity_threshold',
    'embedding_model',
    'enable_question_grouping',
    'grouping_window_seconds',
    'max_group_size',
    'enable_answer_reuse',
    'answer_ttl_seconds',
    'max_reuse_count',
    'default_lock_timeout_seconds',
    'max_lock_wait_seconds',
    'enable_lock_queue',
    'enable_auto_hydration',
    'hydration_threshold_seconds',
    'max_hydration_size_mb',
    'hydration_s3_bucket',
    'enable_cycle_detection',
    'max_dependency_depth',
    'cycle_check_interval_seconds',
  ];

  const updates: string[] = [];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  for (const field of allowedFields) {
    const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (body[camelField] !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      values.push(body[camelField]);
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    return response(400, { success: false, error: 'No valid fields to update' });
  }

  await db.query(
    `INSERT INTO blackboard_config (tenant_id, ${allowedFields.filter((_, i) => values[i + 1] !== undefined).join(', ')})
     VALUES ($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (tenant_id) DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()`,
    values
  );

  return response(200, { success: true, message: 'Configuration updated' });
};

// Events
const getEvents: RouteHandler = async (event, tenantId) => {
  const params = event.queryStringParameters || {};
  const db = await getDbClient();

  let query = `SELECT * FROM blackboard_events WHERE tenant_id = $1`;
  const queryParams: unknown[] = [tenantId];
  let paramIndex = 2;

  if (params.eventType) {
    query += ` AND event_type = $${paramIndex}`;
    queryParams.push(params.eventType);
    paramIndex++;
  }

  if (params.agentId) {
    query += ` AND agent_id = $${paramIndex}`;
    queryParams.push(params.agentId);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
  queryParams.push(params.limit ? parseInt(params.limit, 10) : 100);

  const result = await db.query(query, queryParams);
  return response(200, { success: true, data: { events: result.rows } });
};

// Cleanup jobs (admin only)
const runCleanup: RouteHandler = async (event, tenantId) => {
  const [expiredLocks, expiredSnapshots] = await Promise.all([
    agentOrchestratorService.cleanupExpiredLocks(),
    processHydrationService.cleanupExpiredSnapshots(),
  ]);

  return response(200, {
    success: true,
    data: {
      expiredLocksReleased: expiredLocks,
      expiredSnapshotsDeleted: expiredSnapshots.deleted,
      s3ObjectsDeleted: expiredSnapshots.s3ObjectsDeleted,
    },
  });
};

// ============================================================================
// Router
// ============================================================================

const routes: Record<string, Record<string, RouteHandler>> = {
  GET: {
    '/admin/blackboard/dashboard': getDashboard,
    '/admin/blackboard/decisions': getResolvedDecisions,
    '/admin/blackboard/groups': getQuestionGroups,
    '/admin/blackboard/agents': getActiveAgents,
    '/admin/blackboard/agents/{agentId}': getAgent,
    '/admin/blackboard/agents/{agentId}/snapshots': getHydrationSnapshots,
    '/admin/blackboard/locks': getActiveLocks,
    '/admin/blackboard/config': getConfig,
    '/admin/blackboard/events': getEvents,
  },
  POST: {
    '/admin/blackboard/decisions/{decisionId}/invalidate': invalidateDecision,
    '/admin/blackboard/groups/{groupId}/answer': answerQuestionGroup,
    '/admin/blackboard/agents/{agentId}/restore': restoreAgent,
    '/admin/blackboard/locks/{lockId}/release': forceReleaseLock,
    '/admin/blackboard/cleanup': runCleanup,
  },
  PUT: {
    '/admin/blackboard/config': updateConfig,
  },
};

// ============================================================================
// Handler
// ============================================================================

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  try {
    // Extract tenant ID
    const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id']
      || event.headers['x-tenant-id'];

    if (!tenantId) {
      return response(401, { success: false, error: 'Tenant ID required' });
    }

    // Initialize services
    const db = await getDbClient();
    const redis = await getRedisClient().catch(() => undefined);

    await Promise.all([
      semanticBlackboardService.initialize(db, redis),
      agentOrchestratorService.initialize(db, redis),
      processHydrationService.initialize(db, redis),
    ]);

    // Set tenant context for RLS
    await db.query(`SET app.current_tenant_id = '${tenantId}'`);

    // Route the request
    const method = event.httpMethod;
    const path = event.resource || event.path;

    const routeHandlers = routes[method];
    if (!routeHandlers) {
      return response(405, { success: false, error: 'Method not allowed' });
    }

    const handler = routeHandlers[path];
    if (!handler) {
      return response(404, { success: false, error: 'Endpoint not found' });
    }

    const result = await handler(event, tenantId);

    logger.info('Blackboard API request', {
      method,
      path,
      tenantId,
      statusCode: result.statusCode,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Blackboard API error', { error });
    return response(500, {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};
