/**
 * RADIANT v6.0.4-S1 - ECD Admin API
 * Entity-Context Divergence monitoring endpoints
 * Project TRUTH - Trustworthy Reasoning Using Thorough Hallucination-prevention
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import { extractAdminContext } from '../shared/auth/admin-context';
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

    const row = result.records?.[0];
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
      avgScore: row[0]?.doubleValue || 0,
      firstPassRate: row[1]?.doubleValue || 100,
      refinementsToday: row[2]?.longValue || 0,
      blockedToday: row[3]?.longValue || 0,
      totalRequests: row[4]?.longValue || 0,
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

    const trendData = (result.records || []).map(row => ({
      date: row[0]?.stringValue || '',
      avgScore: row[1]?.doubleValue || 0,
      passRate: row[2]?.doubleValue || 100,
      totalRequests: row[3]?.longValue || 0,
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

    const entityData = (result.records || []).map(row => ({
      entityType: row[0]?.stringValue || 'unknown',
      totalCount: row[1]?.longValue || 0,
      groundedCount: row[2]?.longValue || 0,
      divergentCount: row[3]?.longValue || 0,
      divergenceRate: row[4]?.doubleValue || 0,
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

    const divergences = (result.records || []).map(row => ({
      entity: row[0]?.stringValue || '',
      type: row[1]?.stringValue || 'unknown',
      reason: row[2]?.stringValue || 'not_in_context',
      timestamp: row[3]?.stringValue || new Date().toISOString(),
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

export const handler: APIGatewayProxyHandler = async (event, context) => {
  const path = event.path || '';
  const method = event.httpMethod || 'GET';

  logger.info(`ECD API: ${method} ${path}`);

  // Route based on path
  if (path.endsWith('/stats') && method === 'GET') {
    return getStats(event, context, () => {});
  }
  
  if (path.endsWith('/trend') && method === 'GET') {
    return getTrend(event, context, () => {});
  }
  
  if (path.endsWith('/entities') && method === 'GET') {
    return getEntityBreakdown(event, context, () => {});
  }
  
  if (path.endsWith('/divergences') && method === 'GET') {
    return getRecentDivergences(event, context, () => {});
  }

  return error(404, 'Not found');
};
