/**
 * RADIANT v5.0 - Sovereign Mesh Admin API
 * 
 * Admin endpoints for managing agents, apps, transparency, HITL approvals,
 * and AI Helper configuration.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../shared/db/client';
import { enhancedLogger } from '../shared/logging/enhanced-logger';
import { agentRuntimeService } from '../shared/services/sovereign-mesh';

const logger = enhancedLogger;

// ============================================================================
// TYPES
// ============================================================================

interface RouteHandler {
  (event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult>;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path.replace('/api/admin/sovereign-mesh', '');
  const method = event.httpMethod;
  
  // Extract tenant ID from claims or headers
  const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'] 
    || event.headers['x-tenant-id'] 
    || '';

  if (!tenantId) {
    return response(401, { error: 'Unauthorized: Missing tenant ID' });
  }

  try {
    // Route to appropriate handler
    const routeKey = `${method} ${path}`;
    
    // Agents
    if (routeKey === 'GET /agents') return await listAgents(event, tenantId);
    if (routeKey === 'GET /agents/categories') return await getAgentCategories(event, tenantId);
    if (routeKey.match(/^GET \/agents\/[^/]+$/)) return await getAgent(event, tenantId);
    if (routeKey === 'POST /agents') return await createAgent(event, tenantId);
    if (routeKey.match(/^PUT \/agents\/[^/]+$/)) return await updateAgent(event, tenantId);
    if (routeKey.match(/^DELETE \/agents\/[^/]+$/)) return await deleteAgent(event, tenantId);
    
    // Agent Executions
    if (routeKey === 'GET /executions') return await listExecutions(event, tenantId);
    if (routeKey.match(/^GET \/executions\/[^/]+$/)) return await getExecution(event, tenantId);
    if (routeKey === 'POST /executions') return await startExecution(event, tenantId);
    if (routeKey.match(/^POST \/executions\/[^/]+\/cancel$/)) return await cancelExecution(event, tenantId);
    if (routeKey.match(/^POST \/executions\/[^/]+\/resume$/)) return await resumeExecution(event, tenantId);
    
    // Apps
    if (routeKey === 'GET /apps') return await listApps(event, tenantId);
    if (routeKey.match(/^GET \/apps\/[^/]+$/)) return await getApp(event, tenantId);
    if (routeKey.match(/^PUT \/apps\/[^/]+\/ai-config$/)) return await updateAppAIConfig(event, tenantId);
    if (routeKey === 'GET /apps/sync/status') return await getSyncStatus(event, tenantId);
    if (routeKey === 'POST /apps/sync/trigger') return await triggerSync(event, tenantId);
    
    // App Connections
    if (routeKey === 'GET /connections') return await listConnections(event, tenantId);
    if (routeKey.match(/^DELETE \/connections\/[^/]+$/)) return await deleteConnection(event, tenantId);
    
    // Transparency
    if (routeKey === 'GET /decisions') return await listDecisions(event, tenantId);
    if (routeKey.match(/^GET \/decisions\/[^/]+$/)) return await getDecision(event, tenantId);
    if (routeKey.match(/^GET \/decisions\/[^/]+\/war-room$/)) return await getWarRoom(event, tenantId);
    if (routeKey.match(/^GET \/decisions\/[^/]+\/explanation$/)) return await getExplanation(event, tenantId);
    
    // HITL Approvals
    if (routeKey === 'GET /approvals') return await listApprovals(event, tenantId);
    if (routeKey === 'GET /approvals/queues') return await listQueues(event, tenantId);
    if (routeKey.match(/^GET \/approvals\/[^/]+$/)) return await getApproval(event, tenantId);
    if (routeKey.match(/^POST \/approvals\/[^/]+\/approve$/)) return await approveRequest(event, tenantId);
    if (routeKey.match(/^POST \/approvals\/[^/]+\/reject$/)) return await rejectRequest(event, tenantId);
    if (routeKey.match(/^POST \/approvals\/[^/]+\/escalate$/)) return await escalateRequest(event, tenantId);
    
    // AI Helper Config
    if (routeKey === 'GET /ai-helper/config') return await getAIHelperConfig(event, tenantId);
    if (routeKey === 'PUT /ai-helper/config') return await updateAIHelperConfig(event, tenantId);
    if (routeKey === 'GET /ai-helper/usage') return await getAIHelperUsage(event, tenantId);
    
    // Dashboard
    if (routeKey === 'GET /dashboard') return await getDashboard(event, tenantId);

    return response(404, { error: 'Not found' });
  } catch (error) {
    logger.error('Sovereign Mesh API error', { error, path, method });
    return response(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// AGENT HANDLERS
// ============================================================================

async function listAgents(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const category = event.queryStringParameters?.category;
  const agents = await agentRuntimeService.listAgents(tenantId, category as any);
  return response(200, { agents });
}

async function getAgentCategories(_event: APIGatewayProxyEvent, _tenantId: string): Promise<APIGatewayProxyResult> {
  return response(200, {
    categories: [
      { id: 'research', name: 'Research', description: 'Web research and information synthesis' },
      { id: 'coding', name: 'Coding', description: 'Code writing, debugging, and refactoring' },
      { id: 'data', name: 'Data Analysis', description: 'Data analysis and visualization' },
      { id: 'outreach', name: 'Outreach', description: 'Lead generation and communication' },
      { id: 'creative', name: 'Creative', description: 'Writing, editing, and content creation' },
      { id: 'operations', name: 'Operations', description: 'Workflow automation and operations' },
      { id: 'custom', name: 'Custom', description: 'Custom tenant-defined agents' },
    ],
  });
}

async function getAgent(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const agentId = event.pathParameters?.id || event.path.split('/').pop();
  if (!agentId) return response(400, { error: 'Missing agent ID' });
  
  const agent = await agentRuntimeService.getAgent(agentId, tenantId);
  if (!agent) return response(404, { error: 'Agent not found' });
  
  return response(200, { agent });
}

async function createAgent(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  
  const result = await executeStatement(
    `INSERT INTO agents (
      name, display_name, description, category, capabilities,
      execution_mode, max_iterations, default_timeout_minutes,
      default_budget_usd, max_budget_usd, allowed_models, allowed_tools,
      safety_profile, requires_hitl, implementation_type, implementation_ref,
      ai_helper_config, scope, tenant_id
    ) VALUES (
      :name, :displayName, :description, :category::agent_category, :capabilities,
      :executionMode::agent_execution_mode, :maxIterations, :timeoutMinutes,
      :defaultBudget, :maxBudget, :allowedModels, :allowedTools,
      :safetyProfile::agent_safety_profile, :requiresHitl, :implType, :implRef,
      :aiHelperConfig::jsonb, 'tenant', :tenantId
    ) RETURNING id`,
    [
      stringParam('name', body.name),
      stringParam('displayName', body.displayName),
      stringParam('description', body.description || ''),
      stringParam('category', body.category),
      stringParam('capabilities', `{${(body.capabilities || []).join(',')}}`),
      stringParam('executionMode', body.executionMode || 'async'),
      longParam('maxIterations', body.maxIterations || 50),
      longParam('timeoutMinutes', body.defaultTimeoutMinutes || 30),
      doubleParam('defaultBudget', body.defaultBudgetUsd || 1.0),
      doubleParam('maxBudget', body.maxBudgetUsd || 10.0),
      stringParam('allowedModels', `{${(body.allowedModels || ['claude-sonnet-4']).join(',')}}`),
      stringParam('allowedTools', `{${(body.allowedTools || []).join(',')}}`),
      stringParam('safetyProfile', body.safetyProfile || 'standard'),
      boolParam('requiresHitl', body.requiresHitl || false),
      stringParam('implType', body.implementationType || 'custom'),
      stringParam('implRef', body.implementationRef || ''),
      stringParam('aiHelperConfig', JSON.stringify(body.aiHelperConfig || { enabled: true })),
      stringParam('tenantId', tenantId),
    ]
  );

  const id = result.records?.[0]?.id;
  return response(201, { id: typeof id === 'object' && 'stringValue' in id ? id.stringValue : id });
}

async function updateAgent(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const agentId = event.pathParameters?.id || event.path.split('/').pop();
  const body = JSON.parse(event.body || '{}');
  
  await executeStatement(
    `UPDATE agents SET
      display_name = COALESCE(:displayName, display_name),
      description = COALESCE(:description, description),
      max_iterations = COALESCE(:maxIterations, max_iterations),
      default_timeout_minutes = COALESCE(:timeoutMinutes, default_timeout_minutes),
      default_budget_usd = COALESCE(:defaultBudget, default_budget_usd),
      max_budget_usd = COALESCE(:maxBudget, max_budget_usd),
      safety_profile = COALESCE(:safetyProfile::agent_safety_profile, safety_profile),
      requires_hitl = COALESCE(:requiresHitl, requires_hitl),
      ai_helper_config = COALESCE(:aiHelperConfig::jsonb, ai_helper_config),
      is_active = COALESCE(:isActive, is_active),
      updated_at = NOW()
     WHERE id = :agentId AND (scope = 'tenant' AND tenant_id = :tenantId)`,
    [
      stringParam('displayName', body.displayName || ''),
      stringParam('description', body.description || ''),
      longParam('maxIterations', body.maxIterations || 0),
      longParam('timeoutMinutes', body.defaultTimeoutMinutes || 0),
      doubleParam('defaultBudget', body.defaultBudgetUsd || 0),
      doubleParam('maxBudget', body.maxBudgetUsd || 0),
      stringParam('safetyProfile', body.safetyProfile || ''),
      boolParam('requiresHitl', body.requiresHitl ?? false),
      stringParam('aiHelperConfig', body.aiHelperConfig ? JSON.stringify(body.aiHelperConfig) : ''),
      boolParam('isActive', body.isActive ?? true),
      stringParam('agentId', agentId || ''),
      stringParam('tenantId', tenantId),
    ]
  );

  return response(200, { success: true });
}

async function deleteAgent(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const agentId = event.pathParameters?.id || event.path.split('/').pop();
  
  await executeStatement(
    `UPDATE agents SET is_active = false, updated_at = NOW() 
     WHERE id = :agentId AND scope = 'tenant' AND tenant_id = :tenantId`,
    [stringParam('agentId', agentId || ''), stringParam('tenantId', tenantId)]
  );

  return response(200, { success: true });
}

// ============================================================================
// EXECUTION HANDLERS
// ============================================================================

async function listExecutions(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const agentId = event.queryStringParameters?.agentId;
  const status = event.queryStringParameters?.status;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  
  const executions = await agentRuntimeService.listExecutions(tenantId, { agentId, status: status as any, limit });
  return response(200, { executions });
}

async function getExecution(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const executionId = event.pathParameters?.id || event.path.split('/').pop();
  if (!executionId) return response(400, { error: 'Missing execution ID' });
  
  const execution = await agentRuntimeService.getExecution(executionId, tenantId);
  if (!execution) return response(404, { error: 'Execution not found' });
  
  return response(200, { execution });
}

async function startExecution(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = event.requestContext.authorizer?.claims?.sub;
  
  const result = await agentRuntimeService.startExecution({
    agentId: body.agentId,
    tenantId,
    userId,
    sessionId: body.sessionId,
    goal: body.goal,
    constraints: body.constraints,
    config: body.config,
  });

  return response(201, result);
}

async function cancelExecution(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const executionId = event.path.split('/').slice(-2)[0];
  const body = JSON.parse(event.body || '{}');
  
  const success = await agentRuntimeService.cancelExecution(executionId, tenantId, body.reason);
  return response(200, { success });
}

async function resumeExecution(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const executionId = event.path.split('/').slice(-2)[0];
  const body = JSON.parse(event.body || '{}');
  
  const success = await agentRuntimeService.resumeExecution(executionId, tenantId, body.modifications);
  return response(200, { success });
}

// ============================================================================
// APP HANDLERS
// ============================================================================

async function listApps(event: APIGatewayProxyEvent, _tenantId: string): Promise<APIGatewayProxyResult> {
  const search = event.queryStringParameters?.search;
  const source = event.queryStringParameters?.source;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  const offset = parseInt(event.queryStringParameters?.offset || '0');
  
  let sql = `SELECT id, name, display_name, description, logo_url, source, auth_type, 
             health_status, usage_count_30d, is_featured, is_active
             FROM apps WHERE is_active = true`;
  const params: any[] = [];
  
  if (search) {
    sql += ` AND (display_name ILIKE :search OR description ILIKE :search)`;
    params.push(stringParam('search', `%${search}%`));
  }
  
  if (source) {
    sql += ` AND source = :source::app_source`;
    params.push(stringParam('source', source));
  }
  
  sql += ` ORDER BY usage_count_30d DESC NULLS LAST, display_name LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await executeStatement(sql, params);
  const apps = (result.records || []).map(r => extractRow(r));
  
  // Get total count
  const countResult = await executeStatement(
    `SELECT COUNT(*) as total FROM apps WHERE is_active = true`,
    []
  );
  const total = extractValue(countResult.records?.[0]?.total) || 0;
  
  return response(200, { apps, total, limit, offset });
}

async function getApp(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const appId = event.pathParameters?.id || event.path.split('/').pop();
  
  const result = await executeStatement(
    `SELECT * FROM apps WHERE id = :appId`,
    [stringParam('appId', appId || '')]
  );
  
  if (!result.records?.[0]) return response(404, { error: 'App not found' });
  
  const app = extractRow(result.records[0]);
  
  // Get connection status for this tenant
  const connResult = await executeStatement(
    `SELECT id, name, is_active, last_used_at FROM app_connections 
     WHERE app_id = :appId AND tenant_id = :tenantId`,
    [stringParam('appId', appId || ''), stringParam('tenantId', tenantId)]
  );
  
  const connections = (connResult.records || []).map(r => extractRow(r));
  
  return response(200, { app, connections });
}

async function updateAppAIConfig(event: APIGatewayProxyEvent, _tenantId: string): Promise<APIGatewayProxyResult> {
  const appId = event.path.split('/').slice(-2)[0];
  const body = JSON.parse(event.body || '{}');
  
  await executeStatement(
    `UPDATE apps SET ai_enhancements = :config::jsonb, updated_at = NOW() WHERE id = :appId`,
    [stringParam('config', JSON.stringify(body)), stringParam('appId', appId)]
  );
  
  return response(200, { success: true });
}

async function getSyncStatus(_event: APIGatewayProxyEvent, _tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM app_sync_logs ORDER BY sync_started_at DESC LIMIT 10`,
    []
  );
  
  const logs = (result.records || []).map(r => extractRow(r));
  return response(200, { logs });
}

async function triggerSync(_event: APIGatewayProxyEvent, _tenantId: string): Promise<APIGatewayProxyResult> {
  // In production, this would trigger an async Lambda
  return response(202, { message: 'Sync triggered', syncId: 'pending' });
}

// ============================================================================
// CONNECTION HANDLERS
// ============================================================================

async function listConnections(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT c.*, a.display_name as app_name, a.logo_url as app_logo
     FROM app_connections c
     JOIN apps a ON c.app_id = a.id
     WHERE c.tenant_id = :tenantId
     ORDER BY c.last_used_at DESC NULLS LAST`,
    [stringParam('tenantId', tenantId)]
  );
  
  const connections = (result.records || []).map(r => extractRow(r));
  return response(200, { connections });
}

async function deleteConnection(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const connectionId = event.pathParameters?.id || event.path.split('/').pop();
  
  await executeStatement(
    `DELETE FROM app_connections WHERE id = :connectionId AND tenant_id = :tenantId`,
    [stringParam('connectionId', connectionId || ''), stringParam('tenantId', tenantId)]
  );
  
  return response(200, { success: true });
}

// ============================================================================
// TRANSPARENCY HANDLERS
// ============================================================================

async function listDecisions(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const decisionType = event.queryStringParameters?.type;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  
  let sql = `SELECT id, decision_type, selected_model, estimated_cost, actual_cost, 
             decision_latency_ms, safety_score, created_at
             FROM cato_decision_events WHERE tenant_id = :tenantId`;
  const params = [stringParam('tenantId', tenantId)];
  
  if (decisionType) {
    sql += ` AND decision_type = :type::decision_type`;
    params.push(stringParam('type', decisionType));
  }
  
  sql += ` ORDER BY created_at DESC LIMIT ${limit}`;
  
  const result = await executeStatement(sql, params);
  const decisions = (result.records || []).map(r => extractRow(r));
  
  return response(200, { decisions });
}

async function getDecision(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const decisionId = event.pathParameters?.id || event.path.split('/').pop();
  
  const result = await executeStatement(
    `SELECT * FROM cato_decision_events WHERE id = :decisionId AND tenant_id = :tenantId`,
    [stringParam('decisionId', decisionId || ''), stringParam('tenantId', tenantId)]
  );
  
  if (!result.records?.[0]) return response(404, { error: 'Decision not found' });
  
  return response(200, { decision: extractRow(result.records[0]) });
}

async function getWarRoom(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const decisionId = event.path.split('/').slice(-2)[0];
  
  // Verify decision belongs to tenant
  const check = await executeStatement(
    `SELECT id FROM cato_decision_events WHERE id = :decisionId AND tenant_id = :tenantId`,
    [stringParam('decisionId', decisionId), stringParam('tenantId', tenantId)]
  );
  if (!check.records?.[0]) return response(404, { error: 'Decision not found' });
  
  const result = await executeStatement(
    `SELECT * FROM cato_war_room_deliberations WHERE decision_event_id = :decisionId ORDER BY phase_order`,
    [stringParam('decisionId', decisionId)]
  );
  
  const deliberations = (result.records || []).map(r => extractRow(r));
  return response(200, { deliberations });
}

async function getExplanation(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const decisionId = event.path.split('/').slice(-2)[0];
  const tier = event.queryStringParameters?.tier || 'standard';
  
  const result = await executeStatement(
    `SELECT * FROM cato_decision_explanations 
     WHERE decision_event_id = :decisionId AND tier = :tier::explanation_tier`,
    [stringParam('decisionId', decisionId), stringParam('tier', tier)]
  );
  
  if (!result.records?.[0]) return response(404, { error: 'Explanation not found' });
  
  return response(200, { explanation: extractRow(result.records[0]) });
}

// ============================================================================
// HITL APPROVAL HANDLERS
// ============================================================================

async function listApprovals(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const status = event.queryStringParameters?.status || 'pending';
  const queueId = event.queryStringParameters?.queueId;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  
  let sql = `SELECT r.*, q.name as queue_name
             FROM hitl_approval_requests r
             JOIN hitl_queue_configs q ON r.queue_id = q.id
             WHERE r.tenant_id = :tenantId AND r.status = :status::hitl_request_status`;
  const params = [stringParam('tenantId', tenantId), stringParam('status', status)];
  
  if (queueId) {
    sql += ` AND r.queue_id = :queueId`;
    params.push(stringParam('queueId', queueId));
  }
  
  sql += ` ORDER BY r.priority DESC, r.created_at LIMIT ${limit}`;
  
  const result = await executeStatement(sql, params);
  const approvals = (result.records || []).map(r => extractRow(r));
  
  return response(200, { approvals });
}

async function listQueues(_event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT q.*, 
            (SELECT COUNT(*) FROM hitl_approval_requests r WHERE r.queue_id = q.id AND r.status = 'pending') as pending_count
     FROM hitl_queue_configs q WHERE q.tenant_id = :tenantId AND q.is_active = true`,
    [stringParam('tenantId', tenantId)]
  );
  
  const queues = (result.records || []).map(r => extractRow(r));
  return response(200, { queues });
}

async function getApproval(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const approvalId = event.pathParameters?.id || event.path.split('/').pop();
  
  const result = await executeStatement(
    `SELECT r.*, q.name as queue_name
     FROM hitl_approval_requests r
     JOIN hitl_queue_configs q ON r.queue_id = q.id
     WHERE r.id = :approvalId AND r.tenant_id = :tenantId`,
    [stringParam('approvalId', approvalId || ''), stringParam('tenantId', tenantId)]
  );
  
  if (!result.records?.[0]) return response(404, { error: 'Approval not found' });
  
  // Get comments
  const comments = await executeStatement(
    `SELECT c.*, u.email as user_email FROM hitl_request_comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.request_id = :approvalId ORDER BY c.created_at`,
    [stringParam('approvalId', approvalId || '')]
  );
  
  return response(200, { 
    approval: extractRow(result.records[0]),
    comments: (comments.records || []).map(r => extractRow(r)),
  });
}

async function approveRequest(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const approvalId = event.path.split('/').slice(-2)[0];
  const userId = event.requestContext.authorizer?.claims?.sub;
  const body = JSON.parse(event.body || '{}');
  
  await executeStatement(
    `UPDATE hitl_approval_requests SET
       status = 'approved',
       resolved_at = NOW(),
       resolved_by = :userId,
       resolution_action = 'approved',
       resolution_notes = :notes,
       resolution_modifications = :modifications::jsonb
     WHERE id = :approvalId AND tenant_id = :tenantId AND status = 'pending'`,
    [
      stringParam('userId', userId || ''),
      stringParam('notes', body.notes || ''),
      stringParam('modifications', JSON.stringify(body.modifications || {})),
      stringParam('approvalId', approvalId),
      stringParam('tenantId', tenantId),
    ]
  );
  
  // Resume associated execution if exists
  const result = await executeStatement(
    `SELECT agent_execution_id FROM hitl_approval_requests WHERE id = :approvalId`,
    [stringParam('approvalId', approvalId)]
  );
  const executionId = extractValue(result.records?.[0]?.agent_execution_id);
  if (executionId) {
    await agentRuntimeService.resumeExecution(executionId as string, tenantId, body.modifications);
  }
  
  return response(200, { success: true });
}

async function rejectRequest(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const approvalId = event.path.split('/').slice(-2)[0];
  const userId = event.requestContext.authorizer?.claims?.sub;
  const body = JSON.parse(event.body || '{}');
  
  await executeStatement(
    `UPDATE hitl_approval_requests SET
       status = 'rejected',
       resolved_at = NOW(),
       resolved_by = :userId,
       resolution_action = 'rejected',
       resolution_notes = :notes
     WHERE id = :approvalId AND tenant_id = :tenantId AND status = 'pending'`,
    [
      stringParam('userId', userId || ''),
      stringParam('notes', body.notes || ''),
      stringParam('approvalId', approvalId),
      stringParam('tenantId', tenantId),
    ]
  );
  
  // Cancel associated execution if exists
  const result = await executeStatement(
    `SELECT agent_execution_id FROM hitl_approval_requests WHERE id = :approvalId`,
    [stringParam('approvalId', approvalId)]
  );
  const executionId = extractValue(result.records?.[0]?.agent_execution_id);
  if (executionId) {
    await agentRuntimeService.cancelExecution(executionId as string, tenantId, 'HITL request rejected');
  }
  
  return response(200, { success: true });
}

async function escalateRequest(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const approvalId = event.path.split('/').slice(-2)[0];
  const body = JSON.parse(event.body || '{}');
  
  await executeStatement(
    `UPDATE hitl_approval_requests SET
       status = 'escalated',
       escalated_at = NOW(),
       escalation_level = escalation_level + 1
     WHERE id = :approvalId AND tenant_id = :tenantId AND status = 'pending'`,
    [stringParam('approvalId', approvalId), stringParam('tenantId', tenantId)]
  );
  
  // Add comment about escalation
  if (body.reason) {
    const userId = event.requestContext.authorizer?.claims?.sub;
    await executeStatement(
      `INSERT INTO hitl_request_comments (request_id, user_id, comment)
       VALUES (:requestId, :userId, :comment)`,
      [
        stringParam('requestId', approvalId),
        stringParam('userId', userId || ''),
        stringParam('comment', `Escalated: ${body.reason}`),
      ]
    );
  }
  
  return response(200, { success: true });
}

// ============================================================================
// AI HELPER CONFIG HANDLERS
// ============================================================================

async function getAIHelperConfig(_event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM ai_helper_config WHERE tenant_id = :tenantId OR scope = 'system' ORDER BY scope DESC`,
    [stringParam('tenantId', tenantId)]
  );
  
  const configs = (result.records || []).map(r => extractRow(r));
  const tenantConfig = configs.find(c => c.scope === 'tenant');
  const systemConfig = configs.find(c => c.scope === 'system');
  
  return response(200, { tenantConfig, systemConfig });
}

async function updateAIHelperConfig(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  
  await executeStatement(
    `INSERT INTO ai_helper_config (
       scope, tenant_id, is_enabled,
       default_model_disambiguation, default_model_inference, default_model_recovery,
       default_model_validation, default_model_explanation,
       disambiguation_confidence_threshold, validation_strictness,
       max_cost_per_request, max_cost_per_day,
       cache_enabled, cache_ttl_seconds, learning_enabled
     ) VALUES (
       'tenant', :tenantId, :isEnabled,
       :modelDisambiguation, :modelInference, :modelRecovery,
       :modelValidation, :modelExplanation,
       :confidenceThreshold, :validationStrictness,
       :maxCostRequest, :maxCostDay,
       :cacheEnabled, :cacheTtl, :learningEnabled
     )
     ON CONFLICT (scope, tenant_id) DO UPDATE SET
       is_enabled = EXCLUDED.is_enabled,
       default_model_disambiguation = EXCLUDED.default_model_disambiguation,
       default_model_inference = EXCLUDED.default_model_inference,
       default_model_recovery = EXCLUDED.default_model_recovery,
       default_model_validation = EXCLUDED.default_model_validation,
       default_model_explanation = EXCLUDED.default_model_explanation,
       disambiguation_confidence_threshold = EXCLUDED.disambiguation_confidence_threshold,
       validation_strictness = EXCLUDED.validation_strictness,
       max_cost_per_request = EXCLUDED.max_cost_per_request,
       max_cost_per_day = EXCLUDED.max_cost_per_day,
       cache_enabled = EXCLUDED.cache_enabled,
       cache_ttl_seconds = EXCLUDED.cache_ttl_seconds,
       learning_enabled = EXCLUDED.learning_enabled,
       updated_at = NOW()`,
    [
      stringParam('tenantId', tenantId),
      boolParam('isEnabled', body.isEnabled ?? true),
      stringParam('modelDisambiguation', body.defaultModelDisambiguation || 'claude-haiku-35'),
      stringParam('modelInference', body.defaultModelInference || 'claude-haiku-35'),
      stringParam('modelRecovery', body.defaultModelRecovery || 'claude-haiku-35'),
      stringParam('modelValidation', body.defaultModelValidation || 'claude-sonnet-4'),
      stringParam('modelExplanation', body.defaultModelExplanation || 'claude-haiku-35'),
      doubleParam('confidenceThreshold', body.disambiguationConfidenceThreshold || 0.7),
      stringParam('validationStrictness', body.validationStrictness || 'balanced'),
      doubleParam('maxCostRequest', body.maxCostPerRequest || 0.1),
      doubleParam('maxCostDay', body.maxCostPerDay || 10.0),
      boolParam('cacheEnabled', body.cacheEnabled ?? true),
      longParam('cacheTtl', body.cacheTtlSeconds || 3600),
      boolParam('learningEnabled', body.learningEnabled ?? true),
    ]
  );
  
  return response(200, { success: true });
}

async function getAIHelperUsage(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const days = parseInt(event.queryStringParameters?.days || '30');
  
  const result = await executeStatement(
    `SELECT * FROM ai_helper_daily_usage 
     WHERE tenant_id = :tenantId AND usage_date >= CURRENT_DATE - INTERVAL '${days} days'
     ORDER BY usage_date DESC`,
    [stringParam('tenantId', tenantId)]
  );
  
  const usage = (result.records || []).map(r => extractRow(r));
  
  // Calculate totals
  const totals = usage.reduce((acc, u) => ({
    totalCalls: acc.totalCalls + (u.total_calls || 0),
    cachedCalls: acc.cachedCalls + (u.cached_calls || 0),
    failedCalls: acc.failedCalls + (u.failed_calls || 0),
    totalCost: acc.totalCost + parseFloat(u.total_cost_usd || 0),
  }), { totalCalls: 0, cachedCalls: 0, failedCalls: 0, totalCost: 0 });
  
  return response(200, { usage, totals });
}

// ============================================================================
// DASHBOARD HANDLER
// ============================================================================

async function getDashboard(_event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  // Get agent counts
  const agentResult = await executeStatement(
    `SELECT 
       COUNT(*) as total_agents,
       COUNT(*) FILTER (WHERE scope = 'tenant') as custom_agents
     FROM agents WHERE is_active = true AND (scope = 'system' OR tenant_id = :tenantId)`,
    [stringParam('tenantId', tenantId)]
  );
  
  // Get execution stats (last 24h)
  const execResult = await executeStatement(
    `SELECT 
       COUNT(*) as total_executions,
       COUNT(*) FILTER (WHERE status = 'completed') as completed,
       COUNT(*) FILTER (WHERE status = 'running') as running,
       COUNT(*) FILTER (WHERE status = 'failed') as failed,
       SUM(budget_consumed) as total_cost
     FROM agent_executions 
     WHERE tenant_id = :tenantId AND created_at >= NOW() - INTERVAL '24 hours'`,
    [stringParam('tenantId', tenantId)]
  );
  
  // Get pending approvals
  const approvalResult = await executeStatement(
    `SELECT COUNT(*) as pending FROM hitl_approval_requests 
     WHERE tenant_id = :tenantId AND status = 'pending'`,
    [stringParam('tenantId', tenantId)]
  );
  
  // Get connected apps
  const appsResult = await executeStatement(
    `SELECT COUNT(DISTINCT app_id) as connected_apps FROM app_connections 
     WHERE tenant_id = :tenantId AND is_active = true`,
    [stringParam('tenantId', tenantId)]
  );
  
  // Get AI helper usage today
  const aiResult = await executeStatement(
    `SELECT * FROM ai_helper_daily_usage 
     WHERE tenant_id = :tenantId AND usage_date = CURRENT_DATE`,
    [stringParam('tenantId', tenantId)]
  );
  
  return response(200, {
    agents: extractRow(agentResult.records?.[0] || {}),
    executions: extractRow(execResult.records?.[0] || {}),
    pendingApprovals: extractValue(approvalResult.records?.[0]?.pending) || 0,
    connectedApps: extractValue(appsResult.records?.[0]?.connected_apps) || 0,
    aiHelperToday: extractRow(aiResult.records?.[0] || {}),
  });
}

// ============================================================================
// HELPERS
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

function extractValue(field: unknown): unknown {
  if (!field) return null;
  if (typeof field === 'object') {
    if ('stringValue' in field) return (field as { stringValue: string }).stringValue;
    if ('longValue' in field) return (field as { longValue: number }).longValue;
    if ('booleanValue' in field) return (field as { booleanValue: boolean }).booleanValue;
    if ('doubleValue' in field) return (field as { doubleValue: number }).doubleValue;
  }
  return field;
}

function extractRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = extractValue(value);
  }
  return result;
}
