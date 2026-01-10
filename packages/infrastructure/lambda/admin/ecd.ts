/**
 * RADIANT v6.0.4-S1 - ECD Admin API
 * Entity-Context Divergence monitoring endpoints
 * Project TRUTH - Trustworthy Reasoning Using Thorough Hallucination-prevention
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import { extractAuthContext } from '../shared/auth';

function extractAdminContext(event: any) {
  const auth = extractAuthContext(event);
  return { isAuthenticated: auth.isAdmin, tenantId: auth.tenantId };
}
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// =============================================================================
// Response Helpers
// =============================================================================

function success(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ error: message }),
  };
}

// =============================================================================
// Get ECD Stats
// =============================================================================

export const getStats: APIGatewayProxyHandler = async (event) => {
  try {
    const auth = extractAdminContext(event);
    if (!auth.isAuthenticated) {
      return error(401, 'Unauthorized');
    }

    const days = parseInt(event.queryStringParameters?.days || '7', 10);

    const result = await executeStatement(
      `SELECT * FROM get_ecd_stats($1, $2)`,
      [
        { name: 'tenantId', value: { stringValue: auth.tenantId } },
        { name: 'days', value: { longValue: days } },
      ]
    );

    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      return success({
        avgScore: 0,
        firstPassRate: 100,
        refinementsToday: 0,
        blockedToday: 0,
        totalRequests: 0,
      });
    }

    return success({
      avgScore: Number(row.avg_score) || 0,
      firstPassRate: Number(row.first_pass_rate) || 100,
      refinementsToday: Number(row.refinements_today) || 0,
      blockedToday: Number(row.blocked_today) || 0,
      totalRequests: Number(row.total_requests) || 0,
    });
  } catch (err) {
    logger.error(`ECD getStats error: ${String(err)}`);
    return error(500, 'Failed to get ECD stats');
  }
};

// =============================================================================
// Get ECD Trend
// =============================================================================

export const getTrend: APIGatewayProxyHandler = async (event) => {
  try {
    const auth = extractAdminContext(event);
    if (!auth.isAuthenticated) {
      return error(401, 'Unauthorized');
    }

    const days = parseInt(event.queryStringParameters?.days || '7', 10);

    const result = await executeStatement(
      `SELECT * FROM get_ecd_trend($1, $2)`,
      [
        { name: 'tenantId', value: { stringValue: auth.tenantId } },
        { name: 'days', value: { longValue: days } },
      ]
    );

    const trendData = (result.rows || []).map((row: Record<string, unknown>) => ({
      date: (row.date as string) || '',
      avgScore: Number(row.avg_score) || 0,
      passRate: Number(row.pass_rate) || 100,
      totalRequests: Number(row.total_requests) || 0,
    }));

    return success(trendData);
  } catch (err) {
    logger.error(`ECD getTrend error: ${String(err)}`);
    return error(500, 'Failed to get ECD trend');
  }
};

// =============================================================================
// Get Entity Type Breakdown
// =============================================================================

export const getEntityBreakdown: APIGatewayProxyHandler = async (event) => {
  try {
    const auth = extractAdminContext(event);
    if (!auth.isAuthenticated) {
      return error(401, 'Unauthorized');
    }

    const days = parseInt(event.queryStringParameters?.days || '7', 10);

    const result = await executeStatement(
      `SELECT * FROM get_ecd_entity_breakdown($1, $2)`,
      [
        { name: 'tenantId', value: { stringValue: auth.tenantId } },
        { name: 'days', value: { longValue: days } },
      ]
    );

    const entityData = (result.rows || []).map((row: Record<string, unknown>) => ({
      entityType: (row.entity_type as string) || 'unknown',
      totalCount: Number(row.total_count) || 0,
      groundedCount: Number(row.grounded_count) || 0,
      divergentCount: Number(row.divergent_count) || 0,
      divergenceRate: Number(row.divergence_rate) || 0,
    }));

    return success(entityData);
  } catch (err) {
    logger.error(`ECD getEntityBreakdown error: ${String(err)}`);
    return error(500, 'Failed to get entity breakdown');
  }
};

// =============================================================================
// Get Recent Divergences
// =============================================================================

export const getRecentDivergences: APIGatewayProxyHandler = async (event) => {
  try {
    const auth = extractAdminContext(event);
    if (!auth.isAuthenticated) {
      return error(401, 'Unauthorized');
    }

    const limit = parseInt(event.queryStringParameters?.limit || '10', 10);

    const result = await executeStatement(
      `SELECT 
         divergent_entities->0->>'value' as entity,
         divergent_entities->0->>'type' as type,
         divergent_entities->0->>'reason' as reason,
         created_at as timestamp
       FROM ecd_metrics
       WHERE tenant_id = $1::UUID
         AND jsonb_array_length(divergent_entities) > 0
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: auth.tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    const divergences = (result.rows || []).map((row: Record<string, unknown>) => ({
      entity: (row.entity as string) || '',
      type: (row.type as string) || 'unknown',
      reason: (row.reason as string) || 'not_in_context',
      timestamp: (row.timestamp as string) || new Date().toISOString(),
    }));

    return success(divergences);
  } catch (err) {
    logger.error(`ECD getRecentDivergences error: ${String(err)}`);
    return error(500, 'Failed to get recent divergences');
  }
};

// =============================================================================
// Main Handler (routes requests)
// =============================================================================

export const handler: APIGatewayProxyHandler = async (event, context, callback): Promise<APIGatewayProxyResult> => {
  const path = event.path || '';
  const method = event.httpMethod || 'GET';

  logger.info(`ECD API: ${method} ${path}`);

  // Route based on path
  if (path.endsWith('/stats') && method === 'GET') {
    return (await getStats(event, context, callback)) || error(500, 'No response');
  }
  
  if (path.endsWith('/trend') && method === 'GET') {
    return (await getTrend(event, context, callback)) || error(500, 'No response');
  }
  
  if (path.endsWith('/entities') && method === 'GET') {
    return (await getEntityBreakdown(event, context, callback)) || error(500, 'No response');
  }
  
  if (path.endsWith('/divergences') && method === 'GET') {
    return (await getRecentDivergences(event, context, callback)) || error(500, 'No response');
  }

  return error(404, 'Not found');
};
