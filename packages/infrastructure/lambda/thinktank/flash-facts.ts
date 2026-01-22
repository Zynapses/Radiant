// RADIANT v4.18.0 - Flash Facts API Handler
// Think Tank fast-access factual memory endpoints
// Novel UI: "Knowledge Sparks" sidebar widget with instant fact cards

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { flashFactsService, FlashFactCategory, FactSource } from '../shared/services/flash-facts.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Helpers
// ============================================================================

const getTenantId = (event: any): string | null => {
  return event.requestContext.authorizer?.tenantId || null;
};

const getUserId = (event: any): string | null => {
  return event.requestContext.authorizer?.userId || null;
};

const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/thinktank/flash-facts
 * List facts for the current user with filtering
 */
export const listFacts: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const params = event.queryStringParameters || {};
    const { facts, total } = await flashFactsService.listFacts(tenantId, {
      category: params.category as FlashFactCategory,
      userId: params.includeGlobal === 'true' ? undefined : userId || undefined,
      source: params.source as FactSource,
      isActive: params.includeInactive === 'true' ? undefined : true,
      limit: parseInt(params.limit || '50', 10),
      offset: parseInt(params.offset || '0', 10),
    });

    return jsonResponse(200, {
      success: true,
      data: { facts, total },
    });
  } catch (error) {
    logger.error('Failed to list flash facts', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * GET /api/thinktank/flash-facts/:id
 * Get a specific fact
 */
export const getFact: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const factId = event.pathParameters?.id;
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }
    if (!factId) {
      return jsonResponse(400, { error: 'Fact ID required' });
    }

    const fact = await flashFactsService.getFact(tenantId, factId);
    if (!fact) {
      return jsonResponse(404, { error: 'Fact not found' });
    }

    return jsonResponse(200, { success: true, data: fact });
  } catch (error) {
    logger.error('Failed to get flash fact', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /api/thinktank/flash-facts
 * Create a new fact
 */
export const createFact: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const body = JSON.parse(event.body || '{}');
    const { category, factKey, factValue, confidence, source, sourceUrl, tags, metadata } = body;

    if (!category || !factKey || !factValue) {
      return jsonResponse(400, { error: 'category, factKey, and factValue are required' });
    }

    const fact = await flashFactsService.createFact(tenantId, {
      userId: userId || undefined,
      category,
      factKey,
      factValue,
      confidence: confidence || 0.8,
      source: source || 'user_provided',
      sourceUrl,
      tags: tags || [],
      metadata: metadata || {},
      isActive: true,
    });

    return jsonResponse(201, { success: true, data: fact });
  } catch (error) {
    logger.error('Failed to create flash fact', { error });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse(500, { error: message });
  }
};

/**
 * PUT /api/thinktank/flash-facts/:id
 * Update a fact
 */
export const updateFact: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const factId = event.pathParameters?.id;
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }
    if (!factId) {
      return jsonResponse(400, { error: 'Fact ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    const fact = await flashFactsService.updateFact(tenantId, factId, body);

    if (!fact) {
      return jsonResponse(404, { error: 'Fact not found' });
    }

    return jsonResponse(200, { success: true, data: fact });
  } catch (error) {
    logger.error('Failed to update flash fact', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * DELETE /api/thinktank/flash-facts/:id
 * Delete a fact
 */
export const deleteFact: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const factId = event.pathParameters?.id;
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }
    if (!factId) {
      return jsonResponse(400, { error: 'Fact ID required' });
    }

    const deleted = await flashFactsService.deleteFact(tenantId, factId);
    if (!deleted) {
      return jsonResponse(404, { error: 'Fact not found' });
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    logger.error('Failed to delete flash fact', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /api/thinktank/flash-facts/query
 * Semantic search for facts
 * Novel UI: "Spark Search" - lightning bolt icon, instant results as user types
 */
export const queryFacts: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const body = JSON.parse(event.body || '{}');
    const { query, category, limit, minConfidence } = body;

    if (!query) {
      return jsonResponse(400, { error: 'Query required' });
    }

    const matches = await flashFactsService.queryFacts(tenantId, {
      query,
      category,
      userId: userId || undefined,
      limit: limit || 10,
      minConfidence,
    });

    return jsonResponse(200, {
      success: true,
      data: {
        matches,
        sparkCount: matches.length,
        topMatch: matches[0] || null,
      },
    });
  } catch (error) {
    logger.error('Failed to query flash facts', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * GET /api/thinktank/flash-facts/instant/:query
 * Instant lookup for a single best match
 * Novel UI: "Knowledge Spark" - shows as a glowing card in sidebar
 */
export const instantLookup: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const query = decodeURIComponent(event.pathParameters?.query || '');
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }
    if (!query) {
      return jsonResponse(400, { error: 'Query required' });
    }

    const match = await flashFactsService.instantLookup(tenantId, query, userId || undefined);

    return jsonResponse(200, {
      success: true,
      data: {
        spark: match,
        found: !!match,
        confidence: match?.fact.confidence || 0,
      },
    });
  } catch (error) {
    logger.error('Failed instant lookup', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /api/thinktank/flash-facts/:id/verify
 * Verify a fact (admin/curator action)
 */
export const verifyFact: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const factId = event.pathParameters?.id;
    if (!tenantId || !userId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }
    if (!factId) {
      return jsonResponse(400, { error: 'Fact ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    const fact = await flashFactsService.verifyFact(
      tenantId,
      factId,
      userId,
      body.confidence
    );

    if (!fact) {
      return jsonResponse(404, { error: 'Fact not found' });
    }

    return jsonResponse(200, { success: true, data: fact });
  } catch (error) {
    logger.error('Failed to verify fact', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /api/thinktank/flash-facts/bulk-verify
 * Bulk verify multiple facts
 */
export const bulkVerify: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const body = JSON.parse(event.body || '{}');
    const { factIds } = body;

    if (!Array.isArray(factIds) || factIds.length === 0) {
      return jsonResponse(400, { error: 'factIds array required' });
    }

    const verified = await flashFactsService.bulkVerify(tenantId, factIds, userId);

    return jsonResponse(200, { success: true, data: { verified } });
  } catch (error) {
    logger.error('Failed bulk verify', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * POST /api/thinktank/flash-facts/extract
 * Extract facts from conversation text
 */
export const extractFacts: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const body = JSON.parse(event.body || '{}');
    const { text, messageId } = body;

    if (!text) {
      return jsonResponse(400, { error: 'text required' });
    }

    const facts = await flashFactsService.extractFromConversation(
      tenantId,
      userId,
      text,
      messageId || `msg_${Date.now()}`
    );

    return jsonResponse(200, {
      success: true,
      data: {
        extracted: facts,
        count: facts.length,
      },
    });
  } catch (error) {
    logger.error('Failed to extract facts', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * GET /api/thinktank/flash-facts/stats
 * Get fact statistics
 * Novel UI: "Spark Meter" - visual gauge showing knowledge density
 */
export const getStats: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const params = event.queryStringParameters || {};
    const stats = await flashFactsService.getStats(
      tenantId,
      params.userOnly === 'true' ? userId || undefined : undefined
    );

    return jsonResponse(200, {
      success: true,
      data: {
        ...stats,
        sparkDensity: Math.min(100, (stats.totalFacts / 100) * 100), // Visual gauge 0-100
        healthScore: stats.avgConfidence * 100,
      },
    });
  } catch (error) {
    logger.error('Failed to get stats', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * GET /api/thinktank/flash-facts/config
 * Get configuration
 */
export const getConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const config = await flashFactsService.getConfig(tenantId);
    return jsonResponse(200, { success: true, data: config });
  } catch (error) {
    logger.error('Failed to get config', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * PUT /api/thinktank/flash-facts/config
 * Update configuration (admin only)
 */
export const updateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const body = JSON.parse(event.body || '{}');
    const config = await flashFactsService.updateConfig(tenantId, body);

    return jsonResponse(200, { success: true, data: config });
  } catch (error) {
    logger.error('Failed to update config', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

/**
 * GET /api/thinktank/flash-facts/categories
 * Get available categories with counts
 */
export const getCategories: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const stats = await flashFactsService.getStats(tenantId);
    const config = await flashFactsService.getConfig(tenantId);

    const categories = config.categories.map(category => ({
      id: category,
      name: category.charAt(0).toUpperCase() + category.slice(1),
      count: stats.byCategory[category] || 0,
      icon: getCategoryIcon(category),
      color: getCategoryColor(category),
    }));

    return jsonResponse(200, { success: true, data: categories });
  } catch (error) {
    logger.error('Failed to get categories', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

// ============================================================================
// UI Helpers - Novel "Knowledge Sparks" Visualization
// ============================================================================

function getCategoryIcon(category: FlashFactCategory): string {
  const icons: Record<FlashFactCategory, string> = {
    definition: '📖',
    statistic: '📊',
    date: '📅',
    person: '👤',
    place: '📍',
    event: '🎯',
    formula: '🔢',
    procedure: '📋',
    reference: '🔗',
    custom: '✨',
  };
  return icons[category] || '💡';
}

function getCategoryColor(category: FlashFactCategory): string {
  const colors: Record<FlashFactCategory, string> = {
    definition: '#3B82F6', // blue
    statistic: '#10B981', // green
    date: '#F59E0B', // amber
    person: '#8B5CF6', // purple
    place: '#EC4899', // pink
    event: '#EF4444', // red
    formula: '#06B6D4', // cyan
    procedure: '#F97316', // orange
    reference: '#6366F1', // indigo
    custom: '#84CC16', // lime
  };
  return colors[category] || '#6B7280';
}

// ============================================================================
// Router
// ============================================================================

export async function handler(
  event: { path: string; httpMethod: string; pathParameters?: Record<string, string> } & Parameters<APIGatewayProxyHandler>[0]
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Route matching
  if (method === 'GET' && path.match(/\/flash-facts\/instant\/.+/)) {
    return instantLookup(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'GET' && path.endsWith('/flash-facts/stats')) {
    return getStats(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'GET' && path.endsWith('/flash-facts/config')) {
    return getConfig(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'PUT' && path.endsWith('/flash-facts/config')) {
    return updateConfig(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'GET' && path.endsWith('/flash-facts/categories')) {
    return getCategories(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'POST' && path.endsWith('/flash-facts/query')) {
    return queryFacts(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'POST' && path.endsWith('/flash-facts/extract')) {
    return extractFacts(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'POST' && path.endsWith('/flash-facts/bulk-verify')) {
    return bulkVerify(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'POST' && path.match(/\/flash-facts\/[^/]+\/verify$/)) {
    return verifyFact(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'GET' && path.match(/\/flash-facts\/[^/]+$/) && !path.endsWith('/flash-facts')) {
    return getFact(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'PUT' && path.match(/\/flash-facts\/[^/]+$/)) {
    return updateFact(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'DELETE' && path.match(/\/flash-facts\/[^/]+$/)) {
    return deleteFact(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'GET' && path.endsWith('/flash-facts')) {
    return listFacts(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'POST' && path.endsWith('/flash-facts')) {
    return createFact(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
  }

  return jsonResponse(404, { error: 'Not found' });
}
