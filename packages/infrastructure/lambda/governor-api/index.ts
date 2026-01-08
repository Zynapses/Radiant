/**
 * Economic Governor API Lambda Handler
 * RADIANT v5.0.2 - System Evolution
 * 
 * REST API for managing the Economic Governor (cost optimization).
 * Uses shared utilities to avoid code duplication.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { Logger } from '../shared/logger';
import { success, handleError } from '../shared/response';
import { 
  withSecureDBContext, 
  isTenantAdmin,
  AuthContext 
} from '../shared/services/db-context.service';
import { ValidationError, UnauthorizedError, NotFoundError } from '../shared/errors';
import { EconomicGovernor, GovernorMode } from '../shared/services/governor';

const logger = new Logger({ appId: 'governor-api' });

const VALID_MODES: GovernorMode[] = ['performance', 'balanced', 'cost_saver', 'off'];
const VALID_DOMAINS = ['general', 'medical', 'financial', 'legal', 'technical', 'creative'];

function extractAuthFromEvent(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext.authorizer?.claims || {};
  const authorizer = event.requestContext.authorizer || {};
  return {
    tenantId: claims['custom:tenant_id'] || authorizer.tenant_id || event.headers['x-tenant-id'] || '',
    userId: claims.sub || authorizer.user_id || '',
    permissionLevel: (claims['custom:role'] || authorizer.permission_level || 'user') as any,
    scopes: [],
    groups: []
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const authContext = extractAuthFromEvent(event);
  
  if (!authContext.tenantId) {
    return handleError(new UnauthorizedError('Tenant ID required'));
  }
  
  const path = event.path;
  const method = event.httpMethod;
  
  logger.info('Governor API request', { path, method, tenantId: authContext.tenantId });
  
  try {
    // GET /api/mission-control/governor/config
    if (path.endsWith('/config') && method === 'GET') {
      return await getConfig(authContext);
    }
    
    // PUT /api/mission-control/governor/config
    if (path.endsWith('/config') && method === 'PUT') {
      return await updateConfig(event, authContext);
    }
    
    // GET /api/mission-control/governor/statistics
    if (path.endsWith('/statistics') && method === 'GET') {
      return await getStatistics(event, authContext);
    }
    
    // GET /api/mission-control/governor/recent
    if (path.endsWith('/recent') && method === 'GET') {
      return await getRecentDecisions(event, authContext);
    }
    
    // POST /api/mission-control/governor/analyze
    if (path.endsWith('/analyze') && method === 'POST') {
      return await analyzePrompt(event, authContext);
    }
    
    return handleError(new NotFoundError('Endpoint not found'));
    
  } catch (error: unknown) {
    logger.error('Governor API error', error as Error);
    return handleError(error);
  }
}

async function getConfig(authContext: AuthContext): Promise<APIGatewayProxyResult> {
  return withSecureDBContext(authContext, async (client: PoolClient) => {
    const result = await client.query(`
      SELECT domain, governor_mode, updated_at
      FROM decision_domain_config 
      WHERE tenant_id = $1
      ORDER BY domain
    `, [authContext.tenantId]);
    
    const governor = new EconomicGovernor(logger);
    
    return success({ 
      tenantId: authContext.tenantId,
      globalConfig: governor.getConfig(),
      domains: result.rows.map(row => ({
        domain: row.domain,
        mode: row.governor_mode || 'balanced',
        updatedAt: row.updated_at
      }))
    });
  });
}

async function updateConfig(
  event: APIGatewayProxyEvent,
  authContext: AuthContext
): Promise<APIGatewayProxyResult> {
  if (!isTenantAdmin(authContext)) {
    return handleError(new UnauthorizedError('Admin role required'));
  }
  
  let body: { domain?: string; mode?: GovernorMode };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return handleError(new ValidationError('Invalid JSON body'));
  }
  
  const { domain, mode } = body;

  if (!mode || !VALID_MODES.includes(mode)) {
    return handleError(new ValidationError(`Invalid governor mode. Valid modes: ${VALID_MODES.join(', ')}`));
  }

  if (domain && !VALID_DOMAINS.includes(domain)) {
    return handleError(new ValidationError(`Invalid domain. Valid domains: ${VALID_DOMAINS.join(', ')}`));
  }

  return withSecureDBContext(authContext, async (client: PoolClient) => {
    const targetDomain = domain || 'general';
    
    const prevResult = await client.query(
      `SELECT governor_mode FROM decision_domain_config WHERE tenant_id = $1 AND domain = $2`,
      [authContext.tenantId, targetDomain]
    );
    const previousMode = prevResult.rows[0]?.governor_mode || 'balanced';
    
    await client.query(`
      INSERT INTO decision_domain_config (tenant_id, domain, governor_mode, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (tenant_id, domain) 
      DO UPDATE SET governor_mode = $3, updated_at = NOW()
    `, [authContext.tenantId, targetDomain, mode]);
    
    logger.info('Governor mode updated', { tenantId: authContext.tenantId, domain: targetDomain, mode, previousMode });
    
    await client.query(`
      INSERT INTO audit_logs (tenant_id, action, resource_type, resource_id, details, created_at)
      VALUES ($1, 'UPDATE', 'governor_config', $2, $3, NOW())
    `, [authContext.tenantId, targetDomain, JSON.stringify({ previousMode, newMode: mode })]);
    
    return success({ 
      domain: targetDomain,
      mode,
      previousMode
    });
  });
}

async function getStatistics(
  event: APIGatewayProxyEvent,
  authContext: AuthContext
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const days = parseInt(params.days || '30', 10);
  
  return withSecureDBContext(authContext, async (client: PoolClient) => {
    const overallResult = await client.query(`
      SELECT 
        COUNT(*) as total_decisions,
        AVG(complexity_score) as avg_complexity,
        COALESCE(SUM(savings_amount), 0) as total_savings,
        COUNT(*) FILTER (WHERE selected_model != original_model) as model_swaps,
        COUNT(*) FILTER (WHERE complexity_score <= 4) as simple_tasks,
        COUNT(*) FILTER (WHERE complexity_score BETWEEN 5 AND 8) as medium_tasks,
        COUNT(*) FILTER (WHERE complexity_score >= 9) as complex_tasks
      FROM governor_savings_log
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
    `, [authContext.tenantId, days]);
    
    const dailyResult = await client.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as day,
        COUNT(*) as decisions,
        COALESCE(SUM(savings_amount), 0) as savings,
        AVG(complexity_score) as avg_complexity
      FROM governor_savings_log
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day DESC
      LIMIT 30
    `, [authContext.tenantId, days]);
    
    const byModeResult = await client.query(`
      SELECT 
        governor_mode,
        COUNT(*) as count,
        COALESCE(SUM(savings_amount), 0) as savings
      FROM governor_savings_log
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY governor_mode
    `, [authContext.tenantId, days]);
    
    const overall = overallResult.rows[0];
    
    return success({
      period: { days },
      summary: {
        totalDecisions: parseInt(overall.total_decisions) || 0,
        avgComplexity: parseFloat(overall.avg_complexity) || 0,
        totalSavings: parseFloat(overall.total_savings) || 0,
        modelSwaps: parseInt(overall.model_swaps) || 0,
        taskDistribution: {
          simple: parseInt(overall.simple_tasks) || 0,
          medium: parseInt(overall.medium_tasks) || 0,
          complex: parseInt(overall.complex_tasks) || 0
        }
      },
      daily: dailyResult.rows.map(row => ({
        day: row.day,
        decisions: parseInt(row.decisions),
        savings: parseFloat(row.savings) || 0,
        avgComplexity: parseFloat(row.avg_complexity) || 0
      })),
      byMode: byModeResult.rows.map(row => ({
        mode: row.governor_mode,
        count: parseInt(row.count),
        savings: parseFloat(row.savings) || 0
      }))
    });
  });
}

async function getRecentDecisions(
  event: APIGatewayProxyEvent,
  authContext: AuthContext
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const limit = Math.min(parseInt(params.limit || '50', 10), 100);
  
  return withSecureDBContext(authContext, async (client: PoolClient) => {
    const result = await client.query(`
      SELECT 
        id,
        execution_id,
        original_model,
        selected_model,
        complexity_score,
        estimated_original_cost,
        estimated_actual_cost,
        savings_amount,
        governor_mode,
        reason,
        created_at
      FROM governor_savings_log
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [authContext.tenantId, limit]);
    
    return success({
      decisions: result.rows.map(row => ({
        id: row.id,
        executionId: row.execution_id,
        originalModel: row.original_model,
        selectedModel: row.selected_model,
        complexityScore: row.complexity_score,
        estimatedOriginalCost: parseFloat(row.estimated_original_cost) || 0,
        estimatedActualCost: parseFloat(row.estimated_actual_cost) || 0,
        savingsAmount: parseFloat(row.savings_amount) || 0,
        mode: row.governor_mode,
        reason: row.reason,
        createdAt: row.created_at
      }))
    });
  });
}

async function analyzePrompt(
  event: APIGatewayProxyEvent,
  authContext: AuthContext
): Promise<APIGatewayProxyResult> {
  let body: { prompt?: string; model?: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return handleError(new ValidationError('Invalid JSON body'));
  }
  
  const { prompt, model } = body;
  
  if (!prompt) {
    return handleError(new ValidationError('Prompt is required'));
  }
  
  return withSecureDBContext(authContext, async (client: PoolClient) => {
    const configResult = await client.query(
      `SELECT governor_mode FROM decision_domain_config WHERE tenant_id = $1 AND domain = 'general'`,
      [authContext.tenantId]
    );
    const mode = (configResult.rows[0]?.governor_mode || 'balanced') as GovernorMode;
    
    const governor = new EconomicGovernor(logger);
    const decision = await governor.optimizeModelSelection(
      { id: 'analysis', prompt },
      { id: 'analyzer', name: 'Analyzer', role: 'assistant', model: model || 'gpt-4o' },
      mode
    );
    
    return success({
      complexityScore: decision.complexityScore,
      originalModel: decision.originalModel,
      recommendedModel: decision.selectedModel,
      mode: decision.mode,
      reason: decision.reason,
      estimatedSavings: decision.savingsAmount
    });
  });
}
