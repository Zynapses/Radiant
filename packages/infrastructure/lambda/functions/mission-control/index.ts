/**
 * Mission Control API Lambda
 * 
 * Handles all REST API endpoints for the Mission Control HITL system:
 * - List pending decisions
 * - Get decision details
 * - Resolve decisions
 * - Get dashboard stats
 * - Manage domain configuration
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Client } from 'pg';
import { Redis } from 'ioredis';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { FlyteLauncher } from '../../shared/services/swarm/flyte-launcher';

// ============================================================================
// TYPES
// ============================================================================

interface PendingDecision {
  id: string;
  tenantId: string;
  sessionId: string;
  question: string;
  context: Record<string, unknown>;
  options: unknown[];
  topicTag?: string;
  domain: string;
  urgency: string;
  status: string;
  timeoutSeconds: number;
  expiresAt: string;
  flyteExecutionId: string;
  flyteNodeId: string;
  catoEscalationId?: string;
  resolution?: string;
  guidance?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  pendingCount: number;
  resolvedToday: number;
  expiredToday: number;
  escalatedToday: number;
  avgResolutionTimeMs: number;
  byDomain: Record<string, number>;
  byUrgency: Record<string, number>;
}

interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

const secretsManager = new SecretsManager({});

let dbClient: Client | null = null;
let redis: Redis | null = null;
let flyteLauncher: FlyteLauncher | null = null;

const logger: Logger = {
  info: (message, meta) => console.log(JSON.stringify({ level: 'info', message, ...meta })),
  warn: (message, meta) => console.warn(JSON.stringify({ level: 'warn', message, ...meta })),
  error: (message, meta) => console.error(JSON.stringify({ level: 'error', message, ...meta })),
};

async function initializeConnections(): Promise<void> {
  if (!dbClient) {
    const secret = await secretsManager.getSecretValue({
      SecretId: process.env.DB_SECRET_ARN!,
    });
    const credentials = JSON.parse(secret.SecretString!);

    dbClient = new Client({
      host: credentials.host,
      port: credentials.port,
      database: credentials.dbname,
      user: credentials.username,
      password: credentials.password,
      ssl: { rejectUnauthorized: false },
    });
    await dbClient.connect();
  }

  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT!, 10),
    });
  }

  if (!flyteLauncher) {
    flyteLauncher = new FlyteLauncher(
      process.env.FLYTE_ADMIN_URL!,
      'radiant',
      process.env.NODE_ENV === 'prod' ? 'production' : 'development',
      logger
    );
  }
}

async function withTenantContext<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  await dbClient!.query(`SET app.tenant_id = $1`, [tenantId]);
  try {
    return await fn();
  } finally {
    await dbClient!.query(`RESET app.tenant_id`);
  }
}

// ============================================================================
// DECISION HANDLERS
// ============================================================================

async function listDecisions(
  tenantId: string,
  params: {
    status?: string;
    domain?: string;
    limit?: number;
    offset?: number;
  }
): Promise<PendingDecision[]> {
  const { status, domain, limit = 50, offset = 0 } = params;

  let query = `
    SELECT 
      id, tenant_id, session_id, question, context, options, topic_tag,
      domain, urgency, status, timeout_seconds, expires_at,
      flyte_execution_id, flyte_node_id, cato_escalation_id,
      resolution, guidance, resolved_by, resolved_at,
      created_at, updated_at
    FROM pending_decisions
    WHERE 1=1
  `;
  const values: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND status = $${paramIndex++}`;
    values.push(status);
  }

  if (domain) {
    query += ` AND domain = $${paramIndex++}`;
    values.push(domain);
  }

  query += ` ORDER BY 
    CASE urgency 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      WHEN 'low' THEN 4 
    END,
    created_at ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  values.push(limit, offset);

  const result = await dbClient!.query(query, values);

  return result.rows.map(row => ({
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    question: row.question,
    context: row.context,
    options: row.options,
    topicTag: row.topic_tag,
    domain: row.domain,
    urgency: row.urgency,
    status: row.status,
    timeoutSeconds: row.timeout_seconds,
    expiresAt: row.expires_at?.toISOString(),
    flyteExecutionId: row.flyte_execution_id,
    flyteNodeId: row.flyte_node_id,
    catoEscalationId: row.cato_escalation_id,
    resolution: row.resolution,
    guidance: row.guidance,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at?.toISOString(),
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  }));
}

async function getDecision(
  tenantId: string,
  decisionId: string
): Promise<PendingDecision | null> {
  const result = await dbClient!.query(
    `SELECT 
      id, tenant_id, session_id, question, context, options, topic_tag,
      domain, urgency, status, timeout_seconds, expires_at,
      flyte_execution_id, flyte_node_id, cato_escalation_id,
      resolution, guidance, resolved_by, resolved_at,
      created_at, updated_at
    FROM pending_decisions
    WHERE id = $1`,
    [decisionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    question: row.question,
    context: row.context,
    options: row.options,
    topicTag: row.topic_tag,
    domain: row.domain,
    urgency: row.urgency,
    status: row.status,
    timeoutSeconds: row.timeout_seconds,
    expiresAt: row.expires_at?.toISOString(),
    flyteExecutionId: row.flyte_execution_id,
    flyteNodeId: row.flyte_node_id,
    catoEscalationId: row.cato_escalation_id,
    resolution: row.resolution,
    guidance: row.guidance,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at?.toISOString(),
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}

async function createDecision(
  tenantId: string,
  data: {
    sessionId: string;
    question: string;
    context: Record<string, unknown>;
    domain: string;
    urgency?: string;
    timeoutSeconds: number;
    expiresAt: string;
    flyteExecutionId: string;
    flyteNodeId: string;
    catoEscalationId?: string;
  }
): Promise<PendingDecision> {
  const result = await dbClient!.query(
    `INSERT INTO pending_decisions 
     (tenant_id, session_id, question, context, domain, urgency, 
      timeout_seconds, expires_at, flyte_execution_id, flyte_node_id, cato_escalation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      tenantId,
      data.sessionId,
      data.question,
      JSON.stringify(data.context),
      data.domain,
      data.urgency || 'normal',
      data.timeoutSeconds,
      data.expiresAt,
      data.flyteExecutionId,
      data.flyteNodeId,
      data.catoEscalationId || null,
    ]
  );

  const row = result.rows[0];
  const decision: PendingDecision = {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    question: row.question,
    context: row.context,
    options: row.options,
    topicTag: row.topic_tag,
    domain: row.domain,
    urgency: row.urgency,
    status: row.status,
    timeoutSeconds: row.timeout_seconds,
    expiresAt: row.expires_at?.toISOString(),
    flyteExecutionId: row.flyte_execution_id,
    flyteNodeId: row.flyte_node_id,
    catoEscalationId: row.cato_escalation_id,
    resolution: row.resolution,
    guidance: row.guidance,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at?.toISOString(),
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };

  await redis!.publish(
    `decision_pending:${tenantId}`,
    JSON.stringify({
      decisionId: decision.id,
      question: decision.question,
      domain: decision.domain,
      urgency: decision.urgency,
      expiresAt: decision.expiresAt,
      timestamp: new Date().toISOString(),
    })
  );

  return decision;
}

async function resolveDecision(
  tenantId: string,
  decisionId: string,
  userId: string,
  data: {
    resolution: 'approved' | 'rejected' | 'modified';
    guidance?: string;
  }
): Promise<PendingDecision> {
  const existing = await getDecision(tenantId, decisionId);
  if (!existing) {
    throw new Error('Decision not found');
  }

  if (existing.status !== 'pending') {
    throw new Error(`Decision is already ${existing.status}`);
  }

  const resolvedAt = new Date().toISOString();

  const result = await dbClient!.query(
    `UPDATE pending_decisions 
     SET status = 'resolved',
         resolution = $1,
         guidance = $2,
         resolved_by = $3,
         resolved_at = $4
     WHERE id = $5
     RETURNING *`,
    [data.resolution, data.guidance || '', userId, resolvedAt, decisionId]
  );

  const row = result.rows[0];
  const decision: PendingDecision = {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    question: row.question,
    context: row.context,
    options: row.options,
    topicTag: row.topic_tag,
    domain: row.domain,
    urgency: row.urgency,
    status: row.status,
    timeoutSeconds: row.timeout_seconds,
    expiresAt: row.expires_at?.toISOString(),
    flyteExecutionId: row.flyte_execution_id,
    flyteNodeId: row.flyte_node_id,
    catoEscalationId: row.cato_escalation_id,
    resolution: row.resolution,
    guidance: row.guidance,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at?.toISOString(),
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };

  await redis!.publish(
    `decision_resolved:${tenantId}`,
    JSON.stringify({
      decisionId: decision.id,
      resolution: decision.resolution,
      resolvedBy: userId,
      timestamp: resolvedAt,
    })
  );

  const signalId = `human_decision_${decisionId}`;
  try {
    await flyteLauncher!.sendSignal(decision.flyteExecutionId, signalId, {
      resolution: data.resolution,
      guidance: data.guidance || '',
      resolved_by: userId,
      resolved_at: resolvedAt,
    });
    logger.info('Flyte signal sent', { decisionId, signalId });
  } catch (error) {
    logger.error('Failed to send Flyte signal', {
      decisionId,
      signalId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  return decision;
}

async function getStats(tenantId: string): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingResult = await dbClient!.query(
    `SELECT COUNT(*) as count FROM pending_decisions WHERE status = 'pending'`
  );

  const resolvedResult = await dbClient!.query(
    `SELECT COUNT(*) as count FROM pending_decisions 
     WHERE status = 'resolved' AND resolved_at >= $1`,
    [today.toISOString()]
  );

  const expiredResult = await dbClient!.query(
    `SELECT COUNT(*) as count FROM pending_decisions 
     WHERE status = 'expired' AND updated_at >= $1`,
    [today.toISOString()]
  );

  const escalatedResult = await dbClient!.query(
    `SELECT COUNT(*) as count FROM pending_decisions 
     WHERE status = 'escalated' AND updated_at >= $1`,
    [today.toISOString()]
  );

  const avgTimeResult = await dbClient!.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000) as avg_ms
     FROM pending_decisions 
     WHERE status = 'resolved' AND resolved_at >= $1`,
    [today.toISOString()]
  );

  const byDomainResult = await dbClient!.query(
    `SELECT domain, COUNT(*) as count 
     FROM pending_decisions 
     WHERE status = 'pending'
     GROUP BY domain`
  );

  const byUrgencyResult = await dbClient!.query(
    `SELECT urgency, COUNT(*) as count 
     FROM pending_decisions 
     WHERE status = 'pending'
     GROUP BY urgency`
  );

  const byDomain: Record<string, number> = {};
  for (const row of byDomainResult.rows) {
    byDomain[row.domain] = parseInt(row.count, 10);
  }

  const byUrgency: Record<string, number> = {};
  for (const row of byUrgencyResult.rows) {
    byUrgency[row.urgency] = parseInt(row.count, 10);
  }

  return {
    pendingCount: parseInt(pendingResult.rows[0]?.count || '0', 10),
    resolvedToday: parseInt(resolvedResult.rows[0]?.count || '0', 10),
    expiredToday: parseInt(expiredResult.rows[0]?.count || '0', 10),
    escalatedToday: parseInt(escalatedResult.rows[0]?.count || '0', 10),
    avgResolutionTimeMs: parseFloat(avgTimeResult.rows[0]?.avg_ms || '0'),
    byDomain,
    byUrgency,
  };
}

// ============================================================================
// CONFIG HANDLERS
// ============================================================================

async function getConfig(
  tenantId: string,
  domain?: string
): Promise<unknown[]> {
  let query = `
    SELECT * FROM decision_domain_config 
    WHERE tenant_id = $1 OR tenant_id IS NULL
  `;
  const values: unknown[] = [tenantId];

  if (domain) {
    query += ` AND domain = $2`;
    values.push(domain);
  }

  query += ` ORDER BY tenant_id NULLS LAST, domain`;

  const result = await dbClient!.query(query, values);
  return result.rows;
}

async function updateConfig(
  tenantId: string,
  domain: string,
  data: {
    defaultTimeoutSeconds?: number;
    escalationTimeoutSeconds?: number;
    autoEscalate?: boolean;
    escalationChannel?: string;
    escalationTarget?: string;
    requiredRoles?: string[];
    allowAutoResolve?: boolean;
    requireGuidance?: boolean;
  }
): Promise<unknown> {
  const result = await dbClient!.query(
    `INSERT INTO decision_domain_config 
     (tenant_id, domain, default_timeout_seconds, escalation_timeout_seconds,
      auto_escalate, escalation_channel, escalation_target, required_roles,
      allow_auto_resolve, require_guidance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (tenant_id, domain) DO UPDATE SET
       default_timeout_seconds = COALESCE($3, decision_domain_config.default_timeout_seconds),
       escalation_timeout_seconds = COALESCE($4, decision_domain_config.escalation_timeout_seconds),
       auto_escalate = COALESCE($5, decision_domain_config.auto_escalate),
       escalation_channel = COALESCE($6, decision_domain_config.escalation_channel),
       escalation_target = COALESCE($7, decision_domain_config.escalation_target),
       required_roles = COALESCE($8, decision_domain_config.required_roles),
       allow_auto_resolve = COALESCE($9, decision_domain_config.allow_auto_resolve),
       require_guidance = COALESCE($10, decision_domain_config.require_guidance),
       updated_at = NOW()
     RETURNING *`,
    [
      tenantId,
      domain,
      data.defaultTimeoutSeconds,
      data.escalationTimeoutSeconds,
      data.autoEscalate,
      data.escalationChannel,
      data.escalationTarget,
      data.requiredRoles,
      data.allowAutoResolve,
      data.requireGuidance,
    ]
  );

  return result.rows[0];
}

// ============================================================================
// REQUEST ROUTING
// ============================================================================

function parseBody(event: APIGatewayProxyEvent): Record<string, unknown> {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
    },
    body: JSON.stringify(body),
  };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  await initializeConnections();

  const tenantId = event.headers['X-Tenant-ID'] || event.headers['x-tenant-id'];
  if (!tenantId) {
    return response(401, { error: 'Missing X-Tenant-ID header' });
  }

  const userId = event.requestContext.authorizer?.claims?.sub || 'anonymous';
  const method = event.httpMethod;
  const path = event.path;
  const pathParams = event.pathParameters || {};
  const queryParams = event.queryStringParameters || {};

  try {
    return await withTenantContext(tenantId, async () => {
      if (path.endsWith('/decisions') && method === 'GET') {
        const decisions = await listDecisions(tenantId, {
          status: queryParams.status,
          domain: queryParams.domain,
          limit: queryParams.limit ? parseInt(queryParams.limit, 10) : undefined,
          offset: queryParams.offset ? parseInt(queryParams.offset, 10) : undefined,
        });
        return response(200, decisions);
      }

      if (path.endsWith('/decisions') && method === 'POST') {
        const body = parseBody(event);
        const decision = await createDecision(tenantId, {
          sessionId: body.session_id as string,
          question: body.question as string,
          context: (body.context as Record<string, unknown>) || {},
          domain: body.domain as string,
          urgency: body.urgency as string,
          timeoutSeconds: body.timeout_seconds as number,
          expiresAt: body.expires_at as string,
          flyteExecutionId: body.flyte_execution_id as string,
          flyteNodeId: body.flyte_node_id as string,
          catoEscalationId: body.cato_escalation_id as string,
        });
        return response(201, decision);
      }

      if (path.match(/\/decisions\/[^/]+$/) && method === 'GET') {
        const decisionId = pathParams.id!;
        const decision = await getDecision(tenantId, decisionId);
        if (!decision) {
          return response(404, { error: 'Decision not found' });
        }
        return response(200, decision);
      }

      if (path.match(/\/decisions\/[^/]+\/resolve$/) && method === 'POST') {
        const decisionId = pathParams.id!;
        const body = parseBody(event);
        const decision = await resolveDecision(tenantId, decisionId, userId, {
          resolution: body.resolution as 'approved' | 'rejected' | 'modified',
          guidance: body.guidance as string,
        });
        return response(200, decision);
      }

      if (path.endsWith('/stats') && method === 'GET') {
        const stats = await getStats(tenantId);
        return response(200, stats);
      }

      if (path.endsWith('/config') && method === 'GET') {
        const config = await getConfig(tenantId, queryParams.domain);
        return response(200, config);
      }

      if (path.endsWith('/config') && method === 'PUT') {
        const body = parseBody(event);
        const domain = body.domain as string;
        if (!domain) {
          return response(400, { error: 'Missing domain' });
        }
        const config = await updateConfig(tenantId, domain, {
          defaultTimeoutSeconds: body.default_timeout_seconds as number,
          escalationTimeoutSeconds: body.escalation_timeout_seconds as number,
          autoEscalate: body.auto_escalate as boolean,
          escalationChannel: body.escalation_channel as string,
          escalationTarget: body.escalation_target as string,
          requiredRoles: body.required_roles as string[],
          allowAutoResolve: body.allow_auto_resolve as boolean,
          requireGuidance: body.require_guidance as boolean,
        });
        return response(200, config);
      }

      return response(404, { error: 'Not found' });
    });
  } catch (error) {
    logger.error('Request failed', {
      path,
      method,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return response(500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};
