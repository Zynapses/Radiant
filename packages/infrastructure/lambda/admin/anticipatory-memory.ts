/**
 * Anticipatory Memory Architecture - Admin API Endpoints
 * 
 * Unified admin API for all 5 leapfrog features:
 * 1. Autobiographical Knowledge Graph (AKG)
 * 2. Predictive Memory Prefetch
 * 3. Memory Contradiction Detector
 * 4. Organizational Memory Mesh
 * 5. Dream Insight Generator
 * 
 * Base path: /api/admin/anticipatory-memory/*
 */

import { akgService } from '../shared/services/akg.service';
import { predictivePrefetchService } from '../shared/services/predictive-prefetch.service';
import { memoryContradictionDetectorService } from '../shared/services/memory-contradiction-detector.service';
import { orgMemoryMeshService } from '../shared/services/org-memory-mesh.service';
import { dreamInsightGeneratorService } from '../shared/services/dream-insight-generator.service';

interface AdminRequest {
  httpMethod: string;
  path: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: string;
  requestContext?: { authorizer?: { tenantId?: string } };
}

interface AdminResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function getTenantId(event: AdminRequest): string {
  const tenantId = event.requestContext?.authorizer?.tenantId
    || event.queryStringParameters?.tenantId;
  if (!tenantId) throw new Error('Missing tenantId');
  return tenantId;
}

function jsonResponse(statusCode: number, data: unknown): AdminResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data),
  };
}

function parseBody(event: AdminRequest): Record<string, unknown> {
  if (!event.body) return {};
  try { return JSON.parse(event.body); } catch { return {}; }
}

// =============================================================================
// Main Handler
// =============================================================================

export async function handler(event: AdminRequest): Promise<AdminResponse> {
  const path = event.path.replace('/api/admin/anticipatory-memory', '');
  const method = event.httpMethod.toUpperCase();

  try {
    const tenantId = getTenantId(event);

    // =========================================================================
    // Dashboard (unified)
    // =========================================================================
    if (path === '/dashboard' && method === 'GET') {
      const [akgStats, prefetchStats, contradictionStats, orgStats, dreamStats] = await Promise.all([
        akgService.getStats(tenantId),
        predictivePrefetchService.getStats(tenantId),
        memoryContradictionDetectorService.getStats(tenantId),
        orgMemoryMeshService.getStats(tenantId),
        dreamInsightGeneratorService.getStats(tenantId),
      ]);

      const [akgConfig, prefetchConfig, contradictionConfig, orgConfig, dreamConfig] = await Promise.all([
        akgService.getConfig(tenantId),
        predictivePrefetchService.getConfig(tenantId),
        memoryContradictionDetectorService.getConfig(tenantId),
        orgMemoryMeshService.getConfig(tenantId),
        dreamInsightGeneratorService.getConfig(tenantId),
      ]);

      return jsonResponse(200, {
        akg: { ...akgStats, config: akgConfig },
        prefetch: { ...prefetchStats, config: prefetchConfig },
        contradictions: { ...contradictionStats, config: contradictionConfig },
        orgMemory: { ...orgStats, config: orgConfig },
        dreamInsights: { ...dreamStats, config: dreamConfig },
        health: {
          akgHealthy: akgConfig.enabled,
          prefetchHealthy: prefetchConfig.enabled,
          contradictionDetectorHealthy: contradictionConfig.enabled,
          orgMemoryHealthy: orgConfig.enabled,
          dreamInsightHealthy: dreamConfig.enabled,
          overallStatus: [akgConfig, prefetchConfig, contradictionConfig, dreamConfig]
            .filter(c => c.enabled).length >= 3 ? 'healthy' : 'degraded',
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // =========================================================================
    // AKG Endpoints
    // =========================================================================
    if (path === '/akg/config' && method === 'GET') {
      return jsonResponse(200, await akgService.getConfig(tenantId));
    }

    if (path === '/akg/config' && method === 'PUT') {
      const body = parseBody(event);
      return jsonResponse(200, await akgService.updateConfig(tenantId, body));
    }

    if (path === '/akg/stats' && method === 'GET') {
      return jsonResponse(200, await akgService.getStats(tenantId));
    }

    if (path === '/akg/nodes' && method === 'GET') {
      const userId = event.queryStringParameters?.userId;
      if (!userId) return jsonResponse(400, { error: 'userId required' });
      const entityTypes = event.queryStringParameters?.entityTypes?.split(',') as any;
      const limit = Number(event.queryStringParameters?.limit || 50);
      return jsonResponse(200, await akgService.getUserNodes(tenantId, userId, { entityTypes, limit }));
    }

    if (path === '/akg/query' && method === 'POST') {
      const body = parseBody(event);
      const result = await akgService.queryGraph({
        tenantId,
        userId: String(body.userId || ''),
        seedNodeIds: body.seedNodeIds as string[],
        naturalLanguageQuery: body.query as string,
        maxDepth: Number(body.maxDepth || 2),
        minEdgeConfidence: Number(body.minEdgeConfidence || 0.5),
        entityTypes: body.entityTypes as any,
        relationshipTypes: body.relationshipTypes as any,
        limit: Number(body.limit || 50),
        includeHistorical: Boolean(body.includeHistorical),
      });
      return jsonResponse(200, result);
    }

    if (path === '/akg/context' && method === 'GET') {
      const userId = event.queryStringParameters?.userId;
      if (!userId) return jsonResponse(400, { error: 'userId required' });
      const maxTokens = Number(event.queryStringParameters?.maxTokens || 500);
      const context = await akgService.getUserContext(tenantId, userId, maxTokens);
      return jsonResponse(200, { context, tokenEstimate: Math.ceil((context?.length || 0) / 4) });
    }

    // =========================================================================
    // Prefetch Endpoints
    // =========================================================================
    if (path === '/prefetch/config' && method === 'GET') {
      return jsonResponse(200, await predictivePrefetchService.getConfig(tenantId));
    }

    if (path === '/prefetch/config' && method === 'PUT') {
      const body = parseBody(event);
      return jsonResponse(200, await predictivePrefetchService.updateConfig(tenantId, body));
    }

    if (path === '/prefetch/stats' && method === 'GET') {
      return jsonResponse(200, await predictivePrefetchService.getStats(tenantId));
    }

    if (path === '/prefetch/predict' && method === 'POST') {
      const body = parseBody(event);
      const prediction = await predictivePrefetchService.predict(
        tenantId,
        String(body.userId || ''),
        (body.currentTopics as string[]) || [],
        (body.lastAccessedNodeIds as string[]) || [],
      );
      return jsonResponse(200, prediction);
    }

    // =========================================================================
    // Contradiction Endpoints
    // =========================================================================
    if (path === '/contradictions/config' && method === 'GET') {
      return jsonResponse(200, await memoryContradictionDetectorService.getConfig(tenantId));
    }

    if (path === '/contradictions/config' && method === 'PUT') {
      const body = parseBody(event);
      return jsonResponse(200, await memoryContradictionDetectorService.updateConfig(tenantId, body));
    }

    if (path === '/contradictions/stats' && method === 'GET') {
      return jsonResponse(200, await memoryContradictionDetectorService.getStats(tenantId));
    }

    if (path === '/contradictions/unresolved' && method === 'GET') {
      const userId = event.queryStringParameters?.userId;
      const limit = Number(event.queryStringParameters?.limit || 20);
      return jsonResponse(200, await memoryContradictionDetectorService.getUnresolved(tenantId, userId, limit));
    }

    if (path === '/contradictions/recent' && method === 'GET') {
      const limit = Number(event.queryStringParameters?.limit || 50);
      return jsonResponse(200, await memoryContradictionDetectorService.getRecent(tenantId, limit));
    }

    if (path.startsWith('/contradictions/') && path.endsWith('/resolve') && method === 'POST') {
      const contradictionId = path.split('/')[2];
      const body = parseBody(event);
      await memoryContradictionDetectorService.userResolve(
        contradictionId, tenantId,
        String(body.userId || 'admin'),
        body.winner as 'new' | 'existing' | 'both' | 'neither',
        body.explanation as string | undefined,
      );
      return jsonResponse(200, { resolved: true, contradictionId });
    }

    // =========================================================================
    // Org Memory Endpoints
    // =========================================================================
    if (path === '/org-memory/config' && method === 'GET') {
      return jsonResponse(200, await orgMemoryMeshService.getConfig(tenantId));
    }

    if (path === '/org-memory/config' && method === 'PUT') {
      const body = parseBody(event);
      return jsonResponse(200, await orgMemoryMeshService.updateConfig(tenantId, body));
    }

    if (path === '/org-memory/stats' && method === 'GET') {
      return jsonResponse(200, await orgMemoryMeshService.getStats(tenantId));
    }

    if (path === '/org-memory/nodes' && method === 'GET') {
      const userId = event.queryStringParameters?.userId || 'admin';
      const limit = Number(event.queryStringParameters?.limit || 50);
      return jsonResponse(200, await orgMemoryMeshService.queryOrgMemory(tenantId, userId, { limit }));
    }

    if (path === '/org-memory/consent' && method === 'POST') {
      const body = parseBody(event);
      const consent = await orgMemoryMeshService.grantConsent(tenantId, String(body.userId), {
        consentedTiers: body.consentedTiers as any || ['team'],
        allowedClassifications: body.allowedClassifications as any || ['public', 'internal'],
        allowedEntityTypes: body.allowedEntityTypes as any,
        processingPurpose: body.processingPurpose as string,
        legalBasis: body.legalBasis as any,
        ipAddress: body.ipAddress as string,
        userAgent: body.userAgent as string,
      });
      return jsonResponse(201, consent);
    }

    if (path === '/org-memory/consent/revoke' && method === 'POST') {
      const body = parseBody(event);
      await orgMemoryMeshService.revokeConsent(tenantId, String(body.userId), body.ipAddress as string);
      return jsonResponse(200, { revoked: true });
    }

    if (path === '/org-memory/consent' && method === 'GET') {
      const userId = event.queryStringParameters?.userId;
      if (!userId) return jsonResponse(400, { error: 'userId required' });
      const consent = await orgMemoryMeshService.getActiveConsent(tenantId, userId);
      return jsonResponse(200, consent || { active: false });
    }

    if (path === '/org-memory/erasure' && method === 'POST') {
      const body = parseBody(event);
      const result = await orgMemoryMeshService.executeErasure(
        tenantId, String(body.userId), body.ipAddress as string
      );
      return jsonResponse(200, { erasure: 'completed', ...result });
    }

    if (path === '/org-memory/audit' && method === 'GET') {
      const limit = Number(event.queryStringParameters?.limit || 50);
      return jsonResponse(200, await orgMemoryMeshService.getAuditLog(tenantId, limit));
    }

    // =========================================================================
    // Dream Insight Endpoints
    // =========================================================================
    if (path === '/dream-insights/config' && method === 'GET') {
      return jsonResponse(200, await dreamInsightGeneratorService.getConfig(tenantId));
    }

    if (path === '/dream-insights/config' && method === 'PUT') {
      const body = parseBody(event);
      return jsonResponse(200, await dreamInsightGeneratorService.updateConfig(tenantId, body));
    }

    if (path === '/dream-insights/stats' && method === 'GET') {
      return jsonResponse(200, await dreamInsightGeneratorService.getStats(tenantId));
    }

    if (path === '/dream-insights/recent' && method === 'GET') {
      const userId = event.queryStringParameters?.userId;
      const limit = Number(event.queryStringParameters?.limit || 20);
      return jsonResponse(200, await dreamInsightGeneratorService.getRecentInsights(tenantId, userId, limit));
    }

    if (path === '/dream-insights/generate' && method === 'POST') {
      const body = parseBody(event);
      const dreamCycleId = `manual_${Date.now()}`;
      if (body.userId) {
        const insights = await dreamInsightGeneratorService.generateInsightsForUser(
          tenantId, String(body.userId), dreamCycleId
        );
        return jsonResponse(200, { dreamCycleId, insights, count: insights.length });
      } else {
        const result = await dreamInsightGeneratorService.generateInsightsForTenant(tenantId, dreamCycleId);
        return jsonResponse(200, { dreamCycleId, ...result });
      }
    }

    if (path === '/dream-insights/surface' && method === 'GET') {
      const userId = event.queryStringParameters?.userId;
      if (!userId) return jsonResponse(400, { error: 'userId required' });
      const insight = await dreamInsightGeneratorService.getNextInsightToSurface(tenantId, userId);
      return jsonResponse(200, insight || { available: false });
    }

    if (path.startsWith('/dream-insights/') && path.endsWith('/react') && method === 'POST') {
      const insightId = path.split('/')[2];
      const body = parseBody(event);
      await dreamInsightGeneratorService.recordReaction(insightId, tenantId, body.reaction as any);
      return jsonResponse(200, { recorded: true, insightId });
    }

    // =========================================================================
    // Not Found
    // =========================================================================
    return jsonResponse(404, {
      error: 'Not found',
      path: event.path,
      availableEndpoints: [
        'GET  /dashboard',
        'GET  /akg/config',
        'PUT  /akg/config',
        'GET  /akg/stats',
        'GET  /akg/nodes?userId=...',
        'POST /akg/query',
        'GET  /akg/context?userId=...',
        'GET  /prefetch/config',
        'PUT  /prefetch/config',
        'GET  /prefetch/stats',
        'POST /prefetch/predict',
        'GET  /contradictions/config',
        'PUT  /contradictions/config',
        'GET  /contradictions/stats',
        'GET  /contradictions/unresolved',
        'GET  /contradictions/recent',
        'POST /contradictions/:id/resolve',
        'GET  /org-memory/config',
        'PUT  /org-memory/config',
        'GET  /org-memory/stats',
        'GET  /org-memory/nodes',
        'POST /org-memory/consent',
        'POST /org-memory/consent/revoke',
        'GET  /org-memory/consent?userId=...',
        'POST /org-memory/erasure',
        'GET  /org-memory/audit',
        'GET  /dream-insights/config',
        'PUT  /dream-insights/config',
        'GET  /dream-insights/stats',
        'GET  /dream-insights/recent',
        'POST /dream-insights/generate',
        'GET  /dream-insights/surface?userId=...',
        'POST /dream-insights/:id/react',
      ],
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse(500, { error: message, path: event.path });
  }
}
