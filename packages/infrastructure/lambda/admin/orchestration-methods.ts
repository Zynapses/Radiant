/**
 * RADIANT v4.18.0 - Orchestration Methods Admin API
 * Provides endpoints for viewing and configuring orchestration methods
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import { successResponse, errorResponse } from '../shared/middleware/api-response';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

interface MethodMetrics {
  methodCode: string;
  executionCount: number;
  avgLatencyMs: number;
  avgCostCents: number;
  avgQualityScore: number;
  successRate: number;
  last24hExecutions: number;
}

// ============================================================================
// Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  logger.info('Orchestration methods admin request', { path, method });

  try {
    // GET /api/admin/orchestration/methods
    if (path.endsWith('/methods') && method === 'GET') {
      return await getAllMethods();
    }

    // GET /api/admin/orchestration/methods/:code
    const methodMatch = path.match(/\/methods\/([^/]+)$/);
    if (methodMatch && method === 'GET') {
      return await getMethod(methodMatch[1]);
    }

    // PATCH /api/admin/orchestration/methods/:code
    if (methodMatch && method === 'PATCH') {
      const body = JSON.parse(event.body || '{}');
      return await updateMethod(methodMatch[1], body);
    }

    // GET /api/admin/orchestration/metrics
    if (path.endsWith('/metrics') && method === 'GET') {
      return await getMethodMetrics();
    }

    // GET /api/admin/orchestration/metrics/:code
    const metricsMatch = path.match(/\/metrics\/([^/]+)$/);
    if (metricsMatch && method === 'GET') {
      return await getMethodMetricsForCode(metricsMatch[1]);
    }

    // GET /api/admin/orchestration/executions
    if (path.endsWith('/executions') && method === 'GET') {
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      const methodCode = event.queryStringParameters?.methodCode;
      return await getRecentExecutions(limit, methodCode);
    }

    return errorResponse(404, 'NOT_FOUND', 'Endpoint not found');
  } catch (error) {
    logger.error('Orchestration methods admin error', { error });
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
}

// ============================================================================
// Method CRUD
// ============================================================================

async function getAllMethods(): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT 
      method_id, method_code, method_name, description, method_category,
      default_parameters, parameter_schema, implementation_type,
      prompt_template, code_reference, model_role, recommended_models, is_enabled
     FROM orchestration_methods
     ORDER BY method_category, method_name`,
    []
  );

  const methods = result.rows.map(row => mapMethod(row as Record<string, unknown>));
  return successResponse({ methods });
}

async function getMethod(methodCode: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM orchestration_methods WHERE method_code = $1`,
    [{ name: 'code', value: { stringValue: methodCode } }]
  );

  if (result.rows.length === 0) {
    return errorResponse(404, 'NOT_FOUND', `Method ${methodCode} not found`);
  }

  const method = mapMethod(result.rows[0] as Record<string, unknown>);
  return successResponse({ method });
}

async function updateMethod(
  methodCode: string,
  updates: { defaultParameters?: Record<string, unknown>; isEnabled?: boolean }
): Promise<APIGatewayProxyResult> {
  const setClauses: string[] = [];
  const params: Array<{ name: string; value: { stringValue?: string; booleanValue?: boolean } }> = [
    { name: 'code', value: { stringValue: methodCode } },
  ];

  let paramIndex = 2;

  if (updates.defaultParameters !== undefined) {
    setClauses.push(`default_parameters = $${paramIndex}`);
    params.push({ name: `p${paramIndex}`, value: { stringValue: JSON.stringify(updates.defaultParameters) } });
    paramIndex++;
  }

  if (updates.isEnabled !== undefined) {
    setClauses.push(`is_enabled = $${paramIndex}`);
    params.push({ name: `p${paramIndex}`, value: { booleanValue: updates.isEnabled } });
    paramIndex++;
  }

  if (setClauses.length === 0) {
    return errorResponse(400, 'BAD_REQUEST', 'No valid updates provided');
  }

  setClauses.push('updated_at = NOW()');

  await executeStatement(
    `UPDATE orchestration_methods SET ${setClauses.join(', ')} WHERE method_code = $1`,
    params
  );

  return await getMethod(methodCode);
}

// ============================================================================
// Metrics
// ============================================================================

async function getMethodMetrics(): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT 
      om.method_code,
      COUNT(se.step_execution_id) as execution_count,
      AVG(se.latency_ms) as avg_latency_ms,
      AVG(se.cost_cents) as avg_cost_cents,
      AVG(se.quality_score) as avg_quality_score,
      AVG(CASE WHEN se.status = 'completed' THEN 1 ELSE 0 END) as success_rate,
      COUNT(CASE WHEN se.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_executions
     FROM orchestration_methods om
     LEFT JOIN orchestration_step_executions se ON om.method_id = se.method_id
     GROUP BY om.method_code`,
    []
  );

  const metrics: MethodMetrics[] = result.rows.map(row => {
    const r = row as Record<string, unknown>;
    return {
      methodCode: String(r.method_code),
      executionCount: Number(r.execution_count || 0),
      avgLatencyMs: Number(r.avg_latency_ms || 0),
      avgCostCents: Number(r.avg_cost_cents || 0),
      avgQualityScore: Number(r.avg_quality_score || 0),
      successRate: Number(r.success_rate || 0),
      last24hExecutions: Number(r.last_24h_executions || 0),
    };
  });

  return successResponse({ metrics });
}

async function getMethodMetricsForCode(methodCode: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT 
      om.method_code,
      COUNT(se.step_execution_id) as execution_count,
      AVG(se.latency_ms) as avg_latency_ms,
      AVG(se.cost_cents) as avg_cost_cents,
      AVG(se.quality_score) as avg_quality_score,
      AVG(CASE WHEN se.status = 'completed' THEN 1 ELSE 0 END) as success_rate,
      COUNT(CASE WHEN se.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_executions
     FROM orchestration_methods om
     LEFT JOIN orchestration_step_executions se ON om.method_id = se.method_id
     WHERE om.method_code = $1
     GROUP BY om.method_code`,
    [{ name: 'code', value: { stringValue: methodCode } }]
  );

  if (result.rows.length === 0) {
    return successResponse({
      metrics: {
        methodCode,
        executionCount: 0,
        avgLatencyMs: 0,
        avgCostCents: 0,
        avgQualityScore: 0,
        successRate: 0,
        last24hExecutions: 0,
      },
    });
  }

  const r = result.rows[0] as Record<string, unknown>;
  return successResponse({
    metrics: {
      methodCode: String(r.method_code),
      executionCount: Number(r.execution_count || 0),
      avgLatencyMs: Number(r.avg_latency_ms || 0),
      avgCostCents: Number(r.avg_cost_cents || 0),
      avgQualityScore: Number(r.avg_quality_score || 0),
      successRate: Number(r.success_rate || 0),
      last24hExecutions: Number(r.last_24h_executions || 0),
    },
  });
}

// ============================================================================
// Executions
// ============================================================================

async function getRecentExecutions(
  limit: number,
  methodCode?: string
): Promise<APIGatewayProxyResult> {
  let query = `
    SELECT 
      se.step_execution_id as execution_id,
      om.method_code,
      oe.workflow_id,
      ow.workflow_code,
      se.model_used,
      se.latency_ms,
      se.cost_cents,
      se.quality_score,
      se.status,
      se.created_at,
      se.input_tokens,
      se.output_tokens
    FROM orchestration_step_executions se
    JOIN orchestration_methods om ON se.method_id = om.method_id
    LEFT JOIN orchestration_executions oe ON se.execution_id = oe.execution_id
    LEFT JOIN orchestration_workflows ow ON oe.workflow_id = ow.workflow_id
  `;

  const params: Array<{ name: string; value: { stringValue?: string; longValue?: number } }> = [];

  if (methodCode) {
    query += ` WHERE om.method_code = $1`;
    params.push({ name: 'code', value: { stringValue: methodCode } });
    query += ` ORDER BY se.created_at DESC LIMIT $2`;
    params.push({ name: 'limit', value: { longValue: limit } });
  } else {
    query += ` ORDER BY se.created_at DESC LIMIT $1`;
    params.push({ name: 'limit', value: { longValue: limit } });
  }

  const result = await executeStatement(query, params);

  const executions = result.rows.map(row => {
    const r = row as Record<string, unknown>;
    return {
      executionId: String(r.execution_id),
      methodCode: String(r.method_code),
      workflowCode: r.workflow_code ? String(r.workflow_code) : null,
      modelUsed: String(r.model_used || 'unknown'),
      latencyMs: Number(r.latency_ms || 0),
      costCents: Number(r.cost_cents || 0),
      qualityScore: Number(r.quality_score || 0),
      status: String(r.status || 'unknown'),
      createdAt: String(r.created_at),
      inputTokens: Number(r.input_tokens || 0),
      outputTokens: Number(r.output_tokens || 0),
    };
  });

  return successResponse({ executions });
}

// ============================================================================
// Helpers
// ============================================================================

function mapMethod(row: Record<string, unknown>) {
  return {
    methodId: String(row.method_id),
    methodCode: String(row.method_code),
    methodName: String(row.method_name),
    description: String(row.description || ''),
    methodCategory: String(row.method_category),
    defaultParameters: typeof row.default_parameters === 'string'
      ? JSON.parse(row.default_parameters)
      : (row.default_parameters as Record<string, unknown>) || {},
    parameterSchema: typeof row.parameter_schema === 'string'
      ? JSON.parse(row.parameter_schema)
      : (row.parameter_schema as Record<string, unknown>) || {},
    implementationType: String(row.implementation_type) as 'prompt' | 'code' | 'composite' | 'external',
    promptTemplate: row.prompt_template ? String(row.prompt_template) : undefined,
    codeReference: row.code_reference ? String(row.code_reference) : undefined,
    modelRole: String(row.model_role || 'generator'),
    recommendedModels: (row.recommended_models as string[]) || [],
    isEnabled: Boolean(row.is_enabled),
  };
}
