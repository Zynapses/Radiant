/**
 * RADIANT v5.34.0 - HITL Orchestration Admin API
 * 
 * Admin endpoints for managing HITL orchestration features:
 * - VOI statistics and configuration
 * - Abstention detection settings
 * - Question batching configuration
 * - Rate limiting management
 * - Escalation chain configuration
 * - Semantic deduplication configuration
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';
import { logger } from '../shared/utils/logger';
import { voiService } from '../shared/services/hitl-orchestration/voi.service';
import { abstentionService } from '../shared/services/hitl-orchestration/abstention.service';
import { batchingService } from '../shared/services/hitl-orchestration/batching.service';
import { rateLimitingService } from '../shared/services/hitl-orchestration/rate-limiting.service';
import { escalationService } from '../shared/services/hitl-orchestration/escalation.service';
import { deduplicationService } from '../shared/services/hitl-orchestration/deduplication.service';

interface RouteHandler {
  (tenantId: string, body: unknown, pathParams: Record<string, string>): Promise<unknown>;
}

const routes: Record<string, Record<string, RouteHandler>> = {
  GET: {
    '/dashboard': getDashboard,
    '/voi/statistics': getVOIStatistics,
    '/abstention/config': getAbstentionConfig,
    '/abstention/statistics': getAbstentionStatistics,
    '/batching/statistics': getBatchingStatistics,
    '/rate-limits': getRateLimits,
    '/rate-limits/statistics': getRateLimitStatistics,
    '/escalation-chains': getEscalationChains,
    '/deduplication/statistics': getDeduplicationStatistics,
    '/deduplication/config': getDeduplicationConfig,
    '/deduplication/semantic-matches': getSemanticMatchStatistics,
  },
  PUT: {
    '/abstention/config': updateAbstentionConfig,
    '/rate-limits/:scope': updateRateLimit,
    '/deduplication/config': updateDeduplicationConfig,
  },
  POST: {
    '/escalation-chains': createEscalationChain,
    '/deduplication/invalidate': invalidateCache,
    '/deduplication/backfill-embeddings': backfillEmbeddings,
  },
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const tenantId = (event.requestContext as { authorizer?: { lambda?: { tenantId?: string } } })?.authorizer?.lambda?.tenantId as string;
  if (!tenantId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const method = event.requestContext.http.method;
  const path = event.rawPath.replace('/api/admin/hitl-orchestration', '') || '/';
  
  try {
    // Find matching route
    const methodRoutes = routes[method];
    if (!methodRoutes) {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let matchedHandler: RouteHandler | undefined;
    let pathParams: Record<string, string> = {};

    for (const [pattern, routeHandler] of Object.entries(methodRoutes)) {
      const match = matchPath(pattern, path);
      if (match) {
        matchedHandler = routeHandler;
        pathParams = match.params;
        break;
      }
    }

    if (!matchedHandler) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const result = await matchedHandler(tenantId, body, pathParams);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('HITL orchestration API error', { error: err.message, path, method });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function matchPath(pattern: string, path: string): { params: Record<string, string> } | null {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return { params };
}

// ============================================================================
// HANDLERS
// ============================================================================

async function getDashboard(tenantId: string): Promise<unknown> {
  const [voiStats, abstentionStats, batchStats, rateLimitStats, cacheStats] = await Promise.all([
    voiService.getVOIStatistics(tenantId),
    abstentionService.getAbstentionStatistics(tenantId),
    batchingService.getBatchStatistics(tenantId),
    rateLimitingService.getRateLimitStatistics(tenantId),
    deduplicationService.getCacheStatistics(tenantId),
  ]);

  const questionReductionRate = voiStats.totalDecisions > 0
    ? ((voiStats.skipDecisions + voiStats.inferDecisions) / voiStats.totalDecisions * 100)
    : 0;

  return {
    summary: {
      questionReductionRate,
      priorAccuracy: voiStats.priorAccuracy,
      abstentionEvents: abstentionStats.totalEvents,
      batchCompletionRate: batchStats.completionRate,
      cacheHitRate: cacheStats.hitRate,
    },
    voi: voiStats,
    abstention: abstentionStats,
    batching: batchStats,
    rateLimits: rateLimitStats,
    cache: cacheStats,
  };
}

async function getVOIStatistics(tenantId: string): Promise<unknown> {
  return voiService.getVOIStatistics(tenantId);
}

async function getAbstentionConfig(tenantId: string): Promise<unknown> {
  return abstentionService.getAbstentionConfig(tenantId);
}

async function getAbstentionStatistics(tenantId: string): Promise<unknown> {
  return abstentionService.getAbstentionStatistics(tenantId);
}

async function updateAbstentionConfig(tenantId: string, body: unknown): Promise<unknown> {
  const config = body as Parameters<typeof abstentionService.updateAbstentionConfig>[1];
  await abstentionService.updateAbstentionConfig(tenantId, config);
  return { success: true };
}

async function getBatchingStatistics(tenantId: string): Promise<unknown> {
  return batchingService.getBatchStatistics(tenantId);
}

async function getRateLimits(tenantId: string): Promise<unknown> {
  return rateLimitingService.getRateLimitConfigs(tenantId);
}

async function getRateLimitStatistics(tenantId: string): Promise<unknown> {
  return rateLimitingService.getRateLimitStatistics(tenantId);
}

async function updateRateLimit(
  tenantId: string,
  body: unknown,
  pathParams: Record<string, string>
): Promise<unknown> {
  const { scope } = pathParams;
  const config = body as Parameters<typeof rateLimitingService.updateRateLimitConfig>[2];
  await rateLimitingService.updateRateLimitConfig(
    tenantId,
    scope as 'global' | 'per_user' | 'per_workflow',
    config
  );
  return { success: true };
}

async function getEscalationChains(tenantId: string): Promise<unknown> {
  return escalationService.getEscalationChains(tenantId);
}

async function createEscalationChain(tenantId: string, body: unknown): Promise<unknown> {
  const chain = body as Parameters<typeof escalationService.createEscalationChain>[1];
  const chainId = await escalationService.createEscalationChain(tenantId, chain);
  return { id: chainId };
}

async function getDeduplicationStatistics(tenantId: string): Promise<unknown> {
  return deduplicationService.getCacheStatistics(tenantId);
}

async function invalidateCache(tenantId: string, body: unknown): Promise<unknown> {
  const { cacheId, questionHash, reason } = body as {
    cacheId?: string;
    questionHash?: string;
    reason?: string;
  };
  const count = await deduplicationService.invalidateCache(tenantId, cacheId, questionHash, reason);
  return { invalidated: count };
}

async function getDeduplicationConfig(tenantId: string): Promise<unknown> {
  const result = await executeStatement({
    sql: `
      SELECT 
        semantic_matching_enabled,
        semantic_similarity_threshold,
        semantic_max_candidates
      FROM hitl_rate_limits
      WHERE tenant_id = :tenantId AND scope = 'global'
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  if (result.rows && result.rows.length > 0) {
    const row = result.rows[0];
    return {
      semanticMatchingEnabled: row.semantic_matching_enabled ?? false,
      semanticSimilarityThreshold: Number(row.semantic_similarity_threshold) || 0.85,
      semanticMaxCandidates: Number(row.semantic_max_candidates) || 20,
    };
  }

  return {
    semanticMatchingEnabled: false,
    semanticSimilarityThreshold: 0.85,
    semanticMaxCandidates: 20,
  };
}

async function updateDeduplicationConfig(tenantId: string, body: unknown): Promise<unknown> {
  const config = body as {
    semanticMatchingEnabled?: boolean;
    semanticSimilarityThreshold?: number;
    semanticMaxCandidates?: number;
  };

  await executeStatement({
    sql: `
      UPDATE hitl_rate_limits
      SET 
        semantic_matching_enabled = COALESCE(:enabled, semantic_matching_enabled),
        semantic_similarity_threshold = COALESCE(:threshold, semantic_similarity_threshold),
        semantic_max_candidates = COALESCE(:maxCandidates, semantic_max_candidates),
        updated_at = NOW()
      WHERE tenant_id = :tenantId AND scope = 'global'
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('enabled', config.semanticMatchingEnabled?.toString() ?? ''),
      stringParam('threshold', config.semanticSimilarityThreshold?.toString() ?? ''),
      stringParam('maxCandidates', config.semanticMaxCandidates?.toString() ?? ''),
    ],
  });

  logger.info('Deduplication config updated', { tenantId, config });
  return { success: true };
}

async function getSemanticMatchStatistics(tenantId: string): Promise<unknown> {
  const result = await executeStatement({
    sql: `
      SELECT 
        COUNT(*) FILTER (WHERE match_type = 'semantic') as semantic_matches,
        COUNT(*) FILTER (WHERE match_type = 'exact') as exact_matches,
        COUNT(*) FILTER (WHERE match_type = 'fuzzy') as fuzzy_matches,
        COUNT(*) FILTER (WHERE question_embedding IS NOT NULL) as with_embeddings,
        COUNT(*) as total_cached,
        AVG(semantic_similarity) FILTER (WHERE match_type = 'semantic') as avg_semantic_similarity
      FROM hitl_question_cache
      WHERE tenant_id = :tenantId
        AND is_valid = true
        AND created_at > NOW() - INTERVAL '24 hours'
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  if (result.rows && result.rows.length > 0) {
    const row = result.rows[0];
    return {
      semanticMatches: Number(row.semantic_matches) || 0,
      exactMatches: Number(row.exact_matches) || 0,
      fuzzyMatches: Number(row.fuzzy_matches) || 0,
      withEmbeddings: Number(row.with_embeddings) || 0,
      totalCached: Number(row.total_cached) || 0,
      avgSemanticSimilarity: Number(row.avg_semantic_similarity) || 0,
    };
  }

  return {
    semanticMatches: 0,
    exactMatches: 0,
    fuzzyMatches: 0,
    withEmbeddings: 0,
    totalCached: 0,
    avgSemanticSimilarity: 0,
  };
}

async function backfillEmbeddings(tenantId: string): Promise<unknown> {
  const result = await executeStatement({
    sql: `
      SELECT COUNT(*) as count
      FROM hitl_question_cache
      WHERE tenant_id = :tenantId
        AND is_valid = true
        AND question_embedding IS NULL
        AND expires_at > NOW()
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const pendingCount = Number(result.rows?.[0]?.count) || 0;

  logger.info('Embedding backfill requested', { tenantId, pendingCount });

  return {
    message: 'Backfill job queued',
    pendingCount,
    estimatedTimeMinutes: Math.ceil(pendingCount / 100),
  };
}
