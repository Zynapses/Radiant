/**
 * Cato Global Consciousness Admin API
 * 
 * Admin endpoints for managing the Cato global consciousness service.
 * Includes budget management, cache control, memory statistics, and health checks.
 * 
 * Base Path: /api/admin/cato
 * 
 * @see /docs/cato/api/admin-api.md
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import {
  circadianBudgetService,
  semanticCacheService,
  globalMemoryService,
  shadowSelfClient,
  nliScorerService,
  OperatingMode
} from '../shared/services/cato';

// ============================================================================
// Helper Functions
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const success = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const error = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

// ============================================================================
// Main Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['x-tenant-id'];
  
  if (!tenantId) {
    return error(401, 'Tenant ID required');
  }

  const path = event.path.replace('/api/admin/cato', '');
  const method = event.httpMethod;

  try {
    // OPTIONS for CORS
    if (method === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    // Route to handlers
    if (path === '/status' && method === 'GET') {
      return await getStatus();
    }

    if (path === '/health' && method === 'GET') {
      return await getHealth();
    }

    // Budget endpoints
    if (path === '/budget/status' && method === 'GET') {
      return await getBudgetStatus();
    }

    if (path === '/budget/config' && method === 'GET') {
      return await getBudgetConfig();
    }

    if (path === '/budget/config' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return await updateBudgetConfig(body);
    }

    if (path === '/budget/history' && method === 'GET') {
      return await getBudgetHistory();
    }

    // Cache endpoints
    if (path === '/cache/stats' && method === 'GET') {
      return await getCacheStats();
    }

    if (path === '/cache/invalidate' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return await invalidateCache(body.domain);
    }

    // Memory endpoints
    if (path === '/memory/stats' && method === 'GET') {
      return await getMemoryStats();
    }

    if (path === '/memory/facts' && method === 'GET') {
      const domain = event.queryStringParameters?.domain || 'general';
      const limit = parseInt(event.queryStringParameters?.limit || '50');
      return await getFacts(domain, limit);
    }

    if (path === '/memory/facts' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return await storeFact(body);
    }

    if (path === '/memory/goals' && method === 'GET') {
      return await getGoals();
    }

    if (path === '/memory/goals' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return await updateGoals(body.goals);
    }

    if (path === '/memory/meta-state' && method === 'GET') {
      return await getMetaState();
    }

    // Shadow Self endpoints
    if (path === '/shadow-self/status' && method === 'GET') {
      return await getShadowSelfStatus();
    }

    if (path === '/shadow-self/test' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return await testShadowSelf(body.text);
    }

    // NLI endpoints
    if (path === '/nli/test' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return await testNLI(body.premise, body.hypothesis);
    }

    return error(404, 'Not found');

  } catch (err) {
    logger.error(`Cato admin error: ${String(err)}`);
    return error(500, String(err));
  }
};

// ============================================================================
// Status & Health
// ============================================================================

async function getStatus(): Promise<APIGatewayProxyResult> {
  const [budgetStatus, cacheStats, memoryStats, shadowSelfHealthy] = await Promise.all([
    circadianBudgetService.getStatus(),
    semanticCacheService.getStats(),
    globalMemoryService.getStats(),
    shadowSelfClient.healthCheck()
  ]);

  return success({
    mode: budgetStatus.mode,
    canExplore: budgetStatus.canExplore,
    budget: {
      dailySpend: budgetStatus.dailySpend,
      monthlySpend: budgetStatus.monthlySpend,
      dailyRemaining: budgetStatus.dailyRemaining,
      monthlyRemaining: budgetStatus.monthlyRemaining
    },
    cache: {
      hitRate: cacheStats.hitRate,
      size: cacheStats.cacheSize
    },
    memory: memoryStats,
    shadowSelf: {
      healthy: shadowSelfHealthy
    },
    timestamp: new Date().toISOString()
  });
}

async function getHealth(): Promise<APIGatewayProxyResult> {
  const shadowSelfHealthy = await shadowSelfClient.healthCheck();
  const budgetStatus = await circadianBudgetService.getStatus();

  const healthy = shadowSelfHealthy && budgetStatus.mode !== OperatingMode.EMERGENCY;

  return success({
    healthy,
    components: {
      shadowSelf: shadowSelfHealthy,
      budget: budgetStatus.mode !== OperatingMode.EMERGENCY,
      mode: budgetStatus.mode
    },
    timestamp: new Date().toISOString()
  });
}

// ============================================================================
// Budget Management
// ============================================================================

async function getBudgetStatus(): Promise<APIGatewayProxyResult> {
  const status = await circadianBudgetService.getStatus();
  return success(status);
}

async function getBudgetConfig(): Promise<APIGatewayProxyResult> {
  const config = await circadianBudgetService.getConfig();
  return success(config);
}

async function updateBudgetConfig(updates: {
  monthlyLimit?: number;
  dailyExplorationLimit?: number;
  explorationRatio?: number;
  nightStartHour?: number;
  nightEndHour?: number;
  emergencyThreshold?: number;
}): Promise<APIGatewayProxyResult> {
  // Validate inputs
  if (updates.monthlyLimit !== undefined && (updates.monthlyLimit < 0 || updates.monthlyLimit > 100000)) {
    return error(400, 'monthlyLimit must be between 0 and 100000');
  }
  if (updates.dailyExplorationLimit !== undefined && (updates.dailyExplorationLimit < 0 || updates.dailyExplorationLimit > 1000)) {
    return error(400, 'dailyExplorationLimit must be between 0 and 1000');
  }
  if (updates.nightStartHour !== undefined && (updates.nightStartHour < 0 || updates.nightStartHour > 23)) {
    return error(400, 'nightStartHour must be between 0 and 23');
  }
  if (updates.nightEndHour !== undefined && (updates.nightEndHour < 0 || updates.nightEndHour > 23)) {
    return error(400, 'nightEndHour must be between 0 and 23');
  }

  await circadianBudgetService.updateConfig(updates);

  return success({ message: 'Budget config updated', updates });
}

async function getBudgetHistory(): Promise<APIGatewayProxyResult> {
  const history = await circadianBudgetService.getDailyCostHistory();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const breakdown = await circadianBudgetService.getCostBreakdown(startOfMonth, now);

  return success({
    dailyHistory: history,
    monthlyBreakdown: breakdown
  });
}

// ============================================================================
// Cache Management
// ============================================================================

async function getCacheStats(): Promise<APIGatewayProxyResult> {
  const stats = await semanticCacheService.getStats();
  return success(stats);
}

async function invalidateCache(domain: string): Promise<APIGatewayProxyResult> {
  if (!domain) {
    return error(400, 'domain is required');
  }

  const count = await semanticCacheService.invalidateByDomain(domain);
  return success({ message: 'Cache invalidated', domain, entriesRemoved: count });
}

// ============================================================================
// Memory Management
// ============================================================================

async function getMemoryStats(): Promise<APIGatewayProxyResult> {
  const stats = await globalMemoryService.getStats();
  return success(stats);
}

async function getFacts(domain: string, limit: number): Promise<APIGatewayProxyResult> {
  const facts = await globalMemoryService.getFactsByDomain(domain, limit);
  return success({ domain, facts, count: facts.length });
}

async function storeFact(body: {
  subject: string;
  predicate: string;
  object: string;
  domain: string;
  confidence: number;
  sources: string[];
}): Promise<APIGatewayProxyResult> {
  if (!body.subject || !body.predicate || !body.object || !body.domain) {
    return error(400, 'subject, predicate, object, and domain are required');
  }

  const factId = await globalMemoryService.storeFact({
    subject: body.subject,
    predicate: body.predicate,
    object: body.object,
    domain: body.domain,
    confidence: body.confidence || 0.5,
    sources: body.sources || []
  });

  return success({ message: 'Fact stored', factId });
}

async function getGoals(): Promise<APIGatewayProxyResult> {
  const goals = await globalMemoryService.getGoals();
  return success({ goals });
}

async function updateGoals(goals: string[]): Promise<APIGatewayProxyResult> {
  if (!Array.isArray(goals)) {
    return error(400, 'goals must be an array');
  }

  await globalMemoryService.updateGoals(goals);
  return success({ message: 'Goals updated', goals });
}

async function getMetaState(): Promise<APIGatewayProxyResult> {
  const state = await globalMemoryService.getMetaState();
  const focus = await globalMemoryService.getAttentionFocus();

  return success({
    state,
    attentionFocus: focus
  });
}

// ============================================================================
// Shadow Self Management
// ============================================================================

async function getShadowSelfStatus(): Promise<APIGatewayProxyResult> {
  const status = await shadowSelfClient.getEndpointStatus();
  return success(status);
}

async function testShadowSelf(text: string): Promise<APIGatewayProxyResult> {
  if (!text) {
    return error(400, 'text is required');
  }

  const result = await shadowSelfClient.invokeWithHiddenStates(text, {
    maxNewTokens: 100
  });

  const uncertainty = shadowSelfClient.estimateUncertainty(result);

  return success({
    generatedText: result.generatedText,
    uncertainty,
    logitsEntropy: result.logitsEntropy,
    latencyMs: result.latencyMs,
    hiddenStateLayersExtracted: Object.keys(result.hiddenStates).length
  });
}

// ============================================================================
// NLI Testing
// ============================================================================

async function testNLI(premise: string, hypothesis: string): Promise<APIGatewayProxyResult> {
  if (!premise || !hypothesis) {
    return error(400, 'premise and hypothesis are required');
  }

  const result = await nliScorerService.classify(premise, hypothesis);

  return success(result);
}
