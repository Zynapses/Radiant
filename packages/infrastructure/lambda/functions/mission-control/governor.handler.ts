/**
 * Economic Governor API Handler
 * RADIANT v5.0.2 - System Evolution
 * 
 * Provides REST endpoints for Governor configuration and statistics.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Client } from 'pg';
import { Logger } from '../../shared/logger';
import { GovernorMode, getGovernor } from '../../shared/services/governor';

const logger = new Logger({ appId: 'governor-api' });

const VALID_MODES: GovernorMode[] = ['performance', 'balanced', 'cost_saver', 'off'];
const VALID_DOMAINS = ['general', 'medical', 'financial', 'legal', 'technical', 'creative'];

interface AuthContext {
  tenantId: string;
  userId: string;
  role: string;
}

function extractAuth(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext.authorizer?.claims || {};
  return {
    tenantId: claims['custom:tenant_id'] || event.headers['x-tenant-id'] || '',
    userId: claims.sub || '',
    role: claims['custom:role'] || 'user'
  };
}

async function withTenantContext<T>(
  db: Client,
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  await db.query(`SET app.current_tenant_id = $1`, [tenantId]);
  try {
    return await fn();
  } finally {
    await db.query(`RESET app.current_tenant_id`);
  }
}

function createResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID'
    },
    body: JSON.stringify(body)
  };
}

/**
 * GET /api/mission-control/governor/config
 * Returns current Governor configuration for the tenant
 */
export async function getGovernorConfig(
  event: APIGatewayProxyEvent, 
  db: Client
): Promise<APIGatewayProxyResult> {
  const { tenantId } = extractAuth(event);
  
  if (!tenantId) {
    return createResponse(401, { error: 'Tenant ID required' });
  }
  
  return withTenantContext(db, tenantId, async () => {
    const result = await db.query(`
      SELECT domain, governor_mode, timeout_seconds, escalation_channel, updated_at
      FROM decision_domain_config 
      WHERE tenant_id = $1
      ORDER BY domain
    `, [tenantId]);
    
    const governor = getGovernor(logger);
    const globalConfig = governor.getConfig();
    
    return createResponse(200, { 
      tenantId,
      globalConfig,
      domains: result.rows.map(row => ({
        domain: row.domain,
        mode: row.governor_mode || 'balanced',
        timeoutSeconds: row.timeout_seconds,
        escalationChannel: row.escalation_channel,
        updatedAt: row.updated_at
      }))
    });
  });
}

/**
 * PUT /api/mission-control/governor/config
 * Updates Governor mode for a specific domain
 * 
 * Body: { domain: string, mode: GovernorMode }
 */
export async function updateGovernorMode(
  event: APIGatewayProxyEvent, 
  db: Client
): Promise<APIGatewayProxyResult> {
  const { tenantId, role } = extractAuth(event);
  
  if (!tenantId) {
    return createResponse(401, { error: 'Tenant ID required' });
  }
  
  if (!['admin', 'super_admin'].includes(role)) {
    return createResponse(403, { error: 'Admin role required' });
  }
  
  let body: { domain?: string; mode?: GovernorMode };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return createResponse(400, { error: 'Invalid JSON body' });
  }
  
  const { domain, mode } = body;

  if (!mode || !VALID_MODES.includes(mode)) {
    return createResponse(400, { 
      error: 'Invalid governor mode',
      validModes: VALID_MODES 
    });
  }

  if (domain && !VALID_DOMAINS.includes(domain)) {
    return createResponse(400, { 
      error: 'Invalid domain',
      validDomains: VALID_DOMAINS 
    });
  }

  return withTenantContext(db, tenantId, async () => {
    const targetDomain = domain || 'general';
    
    // Get previous mode for audit
    const prevResult = await db.query(
      `SELECT governor_mode FROM decision_domain_config WHERE tenant_id = $1 AND domain = $2`,
      [tenantId, targetDomain]
    );
    const previousMode = prevResult.rows[0]?.governor_mode || 'balanced';
    
    // Upsert the configuration
    await db.query(`
      INSERT INTO decision_domain_config (tenant_id, domain, governor_mode, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (tenant_id, domain) 
      DO UPDATE SET governor_mode = $3, updated_at = NOW()
    `, [tenantId, targetDomain, mode]);
    
    logger.info('Governor mode updated', { tenantId, domain: targetDomain, mode, previousMode });
    
    // Audit log
    await db.query(`
      INSERT INTO audit_logs (tenant_id, action, resource_type, resource_id, details, created_at)
      VALUES ($1, 'UPDATE', 'governor_config', $2, $3, NOW())
    `, [tenantId, targetDomain, JSON.stringify({ previousMode, newMode: mode })]);
    
    return createResponse(200, { 
      success: true, 
      domain: targetDomain,
      mode,
      previousMode
    });
  });
}

/**
 * GET /api/mission-control/governor/statistics
 * Returns Governor usage statistics and savings
 */
export async function getGovernorStatistics(
  event: APIGatewayProxyEvent,
  db: Client
): Promise<APIGatewayProxyResult> {
  const { tenantId } = extractAuth(event);
  
  if (!tenantId) {
    return createResponse(401, { error: 'Tenant ID required' });
  }
  
  const queryParams = event.queryStringParameters || {};
  const days = parseInt(queryParams.days || '30', 10);
  
  return withTenantContext(db, tenantId, async () => {
    // Overall statistics
    const overallResult = await db.query(`
      SELECT 
        COUNT(*) as total_decisions,
        AVG(complexity_score) as avg_complexity,
        SUM(savings_amount) as total_savings,
        COUNT(*) FILTER (WHERE selected_model != original_model) as model_swaps,
        COUNT(*) FILTER (WHERE complexity_score <= 4) as simple_tasks,
        COUNT(*) FILTER (WHERE complexity_score BETWEEN 5 AND 8) as medium_tasks,
        COUNT(*) FILTER (WHERE complexity_score >= 9) as complex_tasks
      FROM governor_savings_log
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
    `, [tenantId, days]);
    
    // Daily breakdown
    const dailyResult = await db.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as day,
        COUNT(*) as decisions,
        SUM(savings_amount) as savings,
        AVG(complexity_score) as avg_complexity
      FROM governor_savings_log
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day DESC
      LIMIT 30
    `, [tenantId, days]);
    
    // By mode
    const byModeResult = await db.query(`
      SELECT 
        governor_mode,
        COUNT(*) as count,
        SUM(savings_amount) as savings
      FROM governor_savings_log
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY governor_mode
    `, [tenantId, days]);
    
    const overall = overallResult.rows[0];
    
    return createResponse(200, {
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

/**
 * POST /api/mission-control/governor/analyze
 * Analyzes a prompt's complexity without executing
 */
export async function analyzePromptComplexity(
  event: APIGatewayProxyEvent,
  db: Client
): Promise<APIGatewayProxyResult> {
  const { tenantId } = extractAuth(event);
  
  if (!tenantId) {
    return createResponse(401, { error: 'Tenant ID required' });
  }
  
  let body: { prompt?: string; model?: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return createResponse(400, { error: 'Invalid JSON body' });
  }
  
  const { prompt, model } = body;
  
  if (!prompt) {
    return createResponse(400, { error: 'Prompt is required' });
  }
  
  return withTenantContext(db, tenantId, async () => {
    // Get tenant's governor mode
    const configResult = await db.query(
      `SELECT governor_mode FROM decision_domain_config WHERE tenant_id = $1 AND domain = 'general'`,
      [tenantId]
    );
    const mode = (configResult.rows[0]?.governor_mode || 'balanced') as GovernorMode;
    
    const governor = getGovernor(logger);
    const decision = await governor.optimizeModelSelection(
      { id: 'analysis', prompt },
      { id: 'analyzer', name: 'Analyzer', role: 'assistant', model: model || 'gpt-4o' },
      mode
    );
    
    return createResponse(200, {
      complexityScore: decision.complexityScore,
      originalModel: decision.originalModel,
      recommendedModel: decision.selectedModel,
      mode: decision.mode,
      reason: decision.reason,
      estimatedSavings: decision.savingsAmount
    });
  });
}

/**
 * GET /api/mission-control/governor/recent
 * Returns recent Governor decisions
 */
export async function getRecentDecisions(
  event: APIGatewayProxyEvent,
  db: Client
): Promise<APIGatewayProxyResult> {
  const { tenantId } = extractAuth(event);
  
  if (!tenantId) {
    return createResponse(401, { error: 'Tenant ID required' });
  }
  
  const queryParams = event.queryStringParameters || {};
  const limit = Math.min(parseInt(queryParams.limit || '50', 10), 100);
  
  return withTenantContext(db, tenantId, async () => {
    const result = await db.query(`
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
    `, [tenantId, limit]);
    
    return createResponse(200, {
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
