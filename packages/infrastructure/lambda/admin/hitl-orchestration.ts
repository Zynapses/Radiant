/**
 * RADIANT v5.33.0 - HITL Orchestration Admin API
 * 
 * Admin endpoints for managing HITL orchestration features:
 * - VOI statistics and configuration
 * - Abstention detection settings
 * - Question batching configuration
 * - Rate limiting management
 * - Escalation chain configuration
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
  },
  PUT: {
    '/abstention/config': updateAbstentionConfig,
    '/rate-limits/:scope': updateRateLimit,
  },
  POST: {
    '/escalation-chains': createEscalationChain,
    '/deduplication/invalidate': invalidateCache,
  },
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const tenantId = event.requestContext?.authorizer?.lambda?.tenantId as string;
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
