/**
 * RADIANT v5.43.0 - DIA Engine Sniper Validator
 * 
 * Re-validates volatile queries in decision artifacts to check for staleness.
 * Executes the original tool calls and compares results to detect changes.
 */

import { createHash } from 'crypto';
import { executeStatement, stringParam, longParam } from '../../db/client';
// Local type definitions for DIA Sniper Validator
interface VolatileQuery {
  query_id: string;
  tool_name: string;
  original_query: unknown;
  original_result_hash: string;
  staleness_threshold_hours: number;
  volatility_category: string;
  last_verified_at: string;
}

interface DecisionArtifact {
  id: string;
  tenantId: string;
  artifactContent: {
    volatile_queries?: VolatileQuery[];
    [key: string]: unknown;
  };
}

interface QueryValidationResult {
  queryId: string;
  status: 'unchanged' | 'changed' | 'error';
  newResultHash?: string;
  significance?: 'none' | 'minor' | 'moderate' | 'significant' | 'critical';
  costCents: number;
  error?: string;
}

interface ValidateArtifactResponse {
  artifactId: string;
  queriesValidated: number;
  unchanged: number;
  changed: number;
  errors: number;
  totalCostCents: number;
  details: QueryValidationResult[];
  newValidationStatus: ValidationStatus;
}

interface StalenessReport {
  isStale: boolean;
  staleQueries: VolatileQuery[];
  freshQueries: VolatileQuery[];
  totalVolatile: number;
  oldestStaleAgeHours?: number;
}

type ValidationStatus = 'pending' | 'verified' | 'stale' | 'invalidated';

const TOOL_COSTS: Record<string, number> = {
  'web_search': 5,
  'get_stock_price': 1,
  'get_weather': 1,
  'query_database': 10,
  'get_exchange_rate': 1,
  'fetch_news': 5,
  'get_market_data': 2,
  'search_documents': 10,
  'get_analytics': 15,
};

/**
 * Check staleness status of an artifact
 */
export function checkStaleness(artifact: DecisionArtifact): StalenessReport {
  const now = new Date();
  const volatileQueries = artifact.artifactContent.volatile_queries || [];

  const staleQueries: VolatileQuery[] = [];
  const freshQueries: VolatileQuery[] = [];
  let oldestStaleAgeHours = 0;

  for (const query of volatileQueries) {
    const lastVerified = new Date(query.last_verified_at);
    const thresholdMs = query.staleness_threshold_hours * 60 * 60 * 1000;
    const ageMs = now.getTime() - lastVerified.getTime();
    const ageHours = ageMs / (60 * 60 * 1000);

    if (ageMs > thresholdMs) {
      staleQueries.push(query);
      if (ageHours > oldestStaleAgeHours) {
        oldestStaleAgeHours = ageHours;
      }
    } else {
      freshQueries.push(query);
    }
  }

  return {
    isStale: staleQueries.length > 0,
    staleQueries,
    freshQueries,
    totalVolatile: volatileQueries.length,
    oldestStaleAgeHours: staleQueries.length > 0 ? oldestStaleAgeHours : undefined,
  };
}

/**
 * Validate an artifact's volatile queries
 */
export async function validateArtifact(params: {
  artifactId: string;
  tenantId: string;
  userId: string;
  queryIds?: string[];
}): Promise<ValidateArtifactResponse> {
  const { artifactId, tenantId, userId, queryIds } = params;

  // Get artifact
  const artifactResult = await executeStatement<{
    artifact_content: string;
    validation_status: string;
  }>(
    `SELECT artifact_content, validation_status 
     FROM decision_artifacts 
     WHERE id = $1 AND tenant_id = $2`,
    [stringParam('id', artifactId), stringParam('tenantId', tenantId)]
  );

  if (artifactResult.rows.length === 0) {
    throw new Error('Artifact not found');
  }

  const artifact = artifactResult.rows[0];
  const content = typeof artifact.artifact_content === 'string'
    ? JSON.parse(artifact.artifact_content)
    : artifact.artifact_content;

  const volatileQueries: VolatileQuery[] = content.volatile_queries || [];

  // Determine which queries to validate
  const queriesToValidate = queryIds
    ? volatileQueries.filter((q) => queryIds.includes(q.query_id))
    : volatileQueries.filter((q) => {
        const lastVerified = new Date(q.last_verified_at);
        const thresholdMs = q.staleness_threshold_hours * 60 * 60 * 1000;
        return Date.now() - lastVerified.getTime() > thresholdMs;
      });

  const results: QueryValidationResult[] = [];
  let totalCost = 0;

  for (const query of queriesToValidate) {
    const result = await validateQuery(query);
    results.push(result);
    totalCost += result.costCents;

    // Log validation
    await executeStatement(
      `INSERT INTO decision_artifact_validation_log 
       (artifact_id, tenant_id, query_id, tool_name, validation_status, 
        original_result_hash, new_result_hash, significance, api_cost_cents, validated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        stringParam('artifactId', artifactId),
        stringParam('tenantId', tenantId),
        stringParam('queryId', query.query_id),
        stringParam('toolName', query.tool_name),
        stringParam('status', result.status),
        stringParam('originalHash', query.original_result_hash),
        stringParam('newHash', result.newResultHash || ''),
        stringParam('significance', result.significance || 'none'),
        longParam('cost', result.costCents),
        stringParam('userId', userId),
      ]
    );
  }

  // Determine new validation status
  const unchangedCount = results.filter((r) => r.status === 'unchanged').length;
  const changedCount = results.filter((r) => r.status === 'changed').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  let newValidationStatus: ValidationStatus = 'verified';
  if (changedCount > 0) {
    // Check significance of changes
    const hasSignificantChange = results.some(
      (r) => r.significance === 'significant' || r.significance === 'critical'
    );
    newValidationStatus = hasSignificantChange ? 'invalidated' : 'verified';
  } else if (errorCount === results.length && results.length > 0) {
    newValidationStatus = 'stale'; // Couldn't validate, keep as stale
  }

  // Update artifact validation status
  await executeStatement(
    `UPDATE decision_artifacts 
     SET validation_status = $1, last_validated_at = NOW()
     WHERE id = $2 AND tenant_id = $3`,
    [
      stringParam('status', newValidationStatus),
      stringParam('id', artifactId),
      stringParam('tenantId', tenantId),
    ]
  );

  // Update volatile queries with new timestamps
  if (results.length > 0) {
    const updatedQueries = content.volatile_queries.map((q: VolatileQuery) => {
      const result = results.find((r) => r.queryId === q.query_id);
      if (result && result.status === 'unchanged') {
        return {
          ...q,
          last_verified_at: new Date().toISOString(),
        };
      }
      return q;
    });

    content.volatile_queries = updatedQueries;

    await executeStatement(
      `UPDATE decision_artifacts 
       SET artifact_content = $1::jsonb
       WHERE id = $2 AND tenant_id = $3`,
      [
        stringParam('content', JSON.stringify(content)),
        stringParam('id', artifactId),
        stringParam('tenantId', tenantId),
      ]
    );
  }

  return {
    artifactId,
    queriesValidated: results.length,
    unchanged: unchangedCount,
    changed: changedCount,
    errors: errorCount,
    totalCostCents: totalCost,
    details: results,
    newValidationStatus,
  };
}

/**
 * Validate a single query by re-executing and comparing
 */
async function validateQuery(query: VolatileQuery): Promise<QueryValidationResult> {
  const cost = TOOL_COSTS[query.tool_name] || 5;

  try {
    // In a real implementation, this would call the actual tool
    // For now, we simulate by returning unchanged status
    // TODO: Integrate with actual tool execution system
    
    const newResult = await simulateToolExecution(query.tool_name, query.original_query);
    const newHash = createHash('sha256').update(JSON.stringify(newResult)).digest('hex');

    if (newHash === query.original_result_hash) {
      return {
        queryId: query.query_id,
        status: 'unchanged',
        newResultHash: newHash,
        significance: 'none',
        costCents: cost,
      };
    } else {
      // Determine significance based on tool type
      const significance = determineSignificance(query.tool_name, query.volatility_category);
      return {
        queryId: query.query_id,
        status: 'changed',
        newResultHash: newHash,
        significance,
        costCents: cost,
      };
    }
  } catch (error) {
    return {
      queryId: query.query_id,
      status: 'error',
      costCents: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute tool via the appropriate backend (Lambda, HTTP, or MCP)
 */
async function simulateToolExecution(
  toolName: string,
  originalQuery: unknown
): Promise<unknown> {
  // Import tool registry for lookup
  const { createCatoToolRegistryService } = await import('../cato-tool-registry.service.js');
  const { Pool } = await import('pg');
  const pool = new Pool();
  const toolRegistry = createCatoToolRegistryService(pool);
  
  try {
    // Search for tool by name in registry
    const tools = await toolRegistry.listTools({ enabled: true });
    const toolDef = tools.find(t => t.toolName === toolName);
    
    if (!toolDef) {
      // Tool not found in registry - use HTTP fallback for external APIs
      return await executeExternalTool(toolName, originalQuery);
    }

    // Execute based on tool type
    if (toolRegistry.isLambdaTool(toolDef)) {
      // Execute via Lambda
      const functionName = toolRegistry.getLambdaFunctionName(toolDef);
      if (functionName) {
        const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
        const lambda = new LambdaClient({});
        const command = new InvokeCommand({
          FunctionName: functionName,
          InvocationType: 'RequestResponse',
          Payload: Buffer.from(JSON.stringify(originalQuery)),
        });
        const response = await lambda.send(command);
        if (response.Payload) {
          return JSON.parse(Buffer.from(response.Payload).toString());
        }
      }
    }

    // For MCP tools or HTTP, use external execution
    return await executeExternalTool(toolName, originalQuery);
  } catch (error) {
    console.error(`Tool execution failed: ${toolName}`, error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Execute external tools via HTTP when not in registry
 */
async function executeExternalTool(
  toolName: string,
  query: unknown
): Promise<unknown> {
  const toolEndpoints: Record<string, string> = {
    'web_search': '/api/tools/web-search',
    'get_stock_price': '/api/tools/stock-price',
    'get_weather': '/api/tools/weather',
    'get_exchange_rate': '/api/tools/exchange-rate',
    'fetch_news': '/api/tools/news',
    'get_market_data': '/api/tools/market-data',
  };

  const endpoint = toolEndpoints[toolName];
  
  if (!endpoint) {
    // Unknown tool - return query unchanged for hash comparison
    return { toolName, query, executedAt: new Date().toISOString() };
  }

  // Execute via internal API
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    throw new Error(`Tool ${toolName} failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Determine the significance of a data change
 */
function determineSignificance(
  toolName: string,
  volatilityCategory: string
): 'none' | 'minor' | 'moderate' | 'significant' | 'critical' {
  // Real-time data changes are generally expected
  if (volatilityCategory === 'real-time') {
    return 'minor';
  }

  // Financial data changes are more significant
  if (toolName.includes('stock') || toolName.includes('market') || toolName.includes('exchange')) {
    return 'moderate';
  }

  // Database queries changing could be significant
  if (toolName.includes('database') || toolName.includes('query')) {
    return 'significant';
  }

  return 'moderate';
}

/**
 * Get validation history for an artifact
 */
export async function getValidationHistory(
  artifactId: string,
  tenantId: string,
  limit = 50
): Promise<Array<{
  validationId: string;
  queryId: string;
  toolName: string;
  status: string;
  significance: string | null;
  costCents: number;
  validatedAt: string;
}>> {
  const result = await executeStatement<{
    id: string;
    query_id: string;
    tool_name: string;
    validation_status: string;
    significance: string | null;
    api_cost_cents: number;
    validated_at: string;
  }>(
    `SELECT id, query_id, tool_name, validation_status, significance, api_cost_cents, validated_at
     FROM decision_artifact_validation_log
     WHERE artifact_id = $1 AND tenant_id = $2
     ORDER BY validated_at DESC
     LIMIT $3`,
    [
      stringParam('artifactId', artifactId),
      stringParam('tenantId', tenantId),
      longParam('limit', limit),
    ]
  );

  return result.rows.map((row) => ({
    validationId: row.id,
    queryId: row.query_id,
    toolName: row.tool_name,
    status: row.validation_status,
    significance: row.significance,
    costCents: row.api_cost_cents,
    validatedAt: row.validated_at,
  }));
}

/**
 * Get total validation costs for a tenant
 */
export async function getValidationCosts(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{ totalCents: number; validationCount: number }> {
  const result = await executeStatement<{
    total_cost: number;
    validation_count: number;
  }>(
    `SELECT COALESCE(SUM(api_cost_cents), 0) as total_cost, COUNT(*) as validation_count
     FROM decision_artifact_validation_log
     WHERE tenant_id = $1 AND validated_at >= $2 AND validated_at <= $3`,
    [
      stringParam('tenantId', tenantId),
      stringParam('startDate', startDate.toISOString()),
      stringParam('endDate', endDate.toISOString()),
    ]
  );

  const row = result.rows[0];
  return {
    totalCents: Number(row?.total_cost) || 0,
    validationCount: Number(row?.validation_count) || 0,
  };
}
