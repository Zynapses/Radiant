import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, handleError } from '../shared/response';
import { extractUserFromEvent, type AuthContext } from '../shared/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '../shared/errors';
import { brainRouter, type TaskType } from '../shared/services';
import { executeStatement } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

interface RouteRequest {
  taskType: TaskType;
  inputTokenEstimate: number;
  maxLatencyMs?: number;
  maxCost?: number;
  preferredProvider?: string;
  requiresVision?: boolean;
  requiresAudio?: boolean;
  // Domain-aware routing
  prompt?: string;  // Original prompt for domain detection
  useDomainProficiencies?: boolean;  // Enable domain-aware scoring
  domainOverride?: {
    field_id?: string;
    domain_id?: string;
    subspecialty_id?: string;
  };
}

interface RuleRequest {
  name: string;
  description?: string;
  priority?: number;
  conditions: Record<string, unknown>;
  targetModel: string;
  fallbackModels?: string[];
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  try {
    const user = await extractUserFromEvent(event);
    if (!user) {
      return handleError(new UnauthorizedError('Authentication required'));
    }

    // POST /brain/route - Get routing recommendation
    if (method === 'POST' && path.endsWith('/route')) {
      return handleRoute(event, user);
    }

    // GET /brain/rules - List routing rules
    if (method === 'GET' && path.endsWith('/rules')) {
      return handleListRules(user);
    }

    // POST /brain/rules - Create a new routing rule
    if (method === 'POST' && path.endsWith('/rules')) {
      return handleCreateRule(event, user);
    }

    // DELETE /brain/rules/:id - Delete a routing rule
    if (method === 'DELETE' && path.includes('/rules/')) {
      const ruleId = path.split('/rules/')[1];
      return handleDeleteRule(ruleId, user);
    }

    // GET /brain/history - Get routing history
    if (method === 'GET' && path.endsWith('/history')) {
      return handleGetHistory(event, user);
    }

    // GET /brain/stats - Get routing statistics
    if (method === 'GET' && path.endsWith('/stats')) {
      return handleGetStats(user);
    }

    return handleError(new NotFoundError('Endpoint not found'));
  } catch (error) {
    logger.error('Brain router error', error);
    return handleError(error);
  }
}

async function handleRoute(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as RouteRequest;

  if (!body.taskType || typeof body.inputTokenEstimate !== 'number') {
    return handleError(new ValidationError('taskType and inputTokenEstimate are required'));
  }

  const validTaskTypes: TaskType[] = ['chat', 'code', 'analysis', 'creative', 'vision', 'audio'];
  if (!validTaskTypes.includes(body.taskType)) {
    return handleError(new ValidationError(`Invalid taskType. Must be one of: ${validTaskTypes.join(', ')}`));
  }

  const result = await brainRouter.route({
    tenantId: user.tenantId,
    userId: user.userId,
    taskType: body.taskType,
    inputTokenEstimate: body.inputTokenEstimate,
    maxLatencyMs: body.maxLatencyMs,
    maxCost: body.maxCost,
    preferredProvider: body.preferredProvider,
    requiresVision: body.requiresVision,
    requiresAudio: body.requiresAudio,
    // Domain-aware routing
    prompt: body.prompt,
    useDomainProficiencies: body.useDomainProficiencies ?? (body.prompt ? true : false),
    domainOverride: body.domainOverride,
  });

  return success(result);
}

async function handleListRules(
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT id, name, description, priority, conditions, target_model, 
            fallback_models, is_active, created_at
     FROM brain_routing_rules
     WHERE tenant_id = $1 OR tenant_id IS NULL
     ORDER BY priority ASC`,
    [{ name: 'tenantId', value: { stringValue: user.tenantId } }]
  );

  return success({ rules: result.rows });
}

async function handleCreateRule(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as RuleRequest;

  if (!body.name || !body.conditions || !body.targetModel) {
    return handleError(new ValidationError('name, conditions, and targetModel are required'));
  }

  const result = await executeStatement(
    `INSERT INTO brain_routing_rules 
     (tenant_id, name, description, priority, conditions, target_model, fallback_models)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      { name: 'tenantId', value: { stringValue: user.tenantId } },
      { name: 'name', value: { stringValue: body.name } },
      { name: 'description', value: body.description ? { stringValue: body.description } : { isNull: true } },
      { name: 'priority', value: { longValue: body.priority || 100 } },
      { name: 'conditions', value: { stringValue: JSON.stringify(body.conditions) } },
      { name: 'targetModel', value: { stringValue: body.targetModel } },
      { name: 'fallbackModels', value: { stringValue: `{${(body.fallbackModels || []).join(',')}}` } },
    ]
  );

  const ruleId = String((result.rows[0] as Record<string, unknown>)?.id || '');

  return success({ id: ruleId, message: 'Rule created successfully' }, 201);
}

async function handleDeleteRule(
  ruleId: string,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `DELETE FROM brain_routing_rules WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [
      { name: 'ruleId', value: { stringValue: ruleId } },
      { name: 'tenantId', value: { stringValue: user.tenantId } },
    ]
  );

  if (result.rows.length === 0) {
    return handleError(new NotFoundError('Rule not found or not owned by tenant'));
  }

  return success({ message: 'Rule deleted successfully' });
}

async function handleGetHistory(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  const modelFilter = event.queryStringParameters?.model;

  let sql = `SELECT id, task_type, selected_model, selection_reason, 
                    input_tokens, output_tokens, latency_ms, cost, success, created_at
             FROM brain_routing_history
             WHERE tenant_id = $1`;
  
  const params = [{ name: 'tenantId', value: { stringValue: user.tenantId } }];

  if (modelFilter) {
    sql += ` AND selected_model = $2`;
    params.push({ name: 'model', value: { stringValue: modelFilter } });
  }

  sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

  const result = await executeStatement(sql, params);

  return success({ history: result.rows });
}

async function handleGetStats(
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT 
       selected_model,
       COUNT(*) as total_requests,
       AVG(latency_ms) as avg_latency_ms,
       SUM(cost) as total_cost,
       COUNT(*) FILTER (WHERE success = true) as success_count,
       COUNT(*) FILTER (WHERE success = false) as failure_count
     FROM brain_routing_history
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
     GROUP BY selected_model
     ORDER BY total_requests DESC`,
    [{ name: 'tenantId', value: { stringValue: user.tenantId } }]
  );

  return success({ stats: result.rows });
}
