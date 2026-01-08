/**
 * Economic Governor API Lambda Handler
 * RADIANT v5.0.2 - System Evolution
 * 
 * REST API for managing the Economic Governor (cost optimization).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Client } from 'pg';
import { Logger } from '../shared/logger';
import { EconomicGovernor, GovernorMode } from '../shared/services/governor';

const logger = new Logger({ appId: 'governor-api' });

const VALID_MODES: GovernorMode[] = ['performance', 'balanced', 'cost_saver', 'off'];
const VALID_DOMAINS = ['general', 'medical', 'financial', 'legal', 'technical', 'creative'];

let dbClient: Client | null = null;

async function getDbClient(): Promise<Client> {
  if (!dbClient) {
    const { SecretsManager } = await import('@aws-sdk/client-secrets-manager');
    const sm = new SecretsManager({});
    const secretArn = process.env.DB_SECRET_ARN;
    
    if (!secretArn) {
      throw new Error('DB_SECRET_ARN not configured');
    }
    
    const secretResponse = await sm.getSecretValue({ SecretId: secretArn });
    const secret = JSON.parse(secretResponse.SecretString || '{}');
    
    dbClient = new Client({
      host: secret.host,
      database: secret.dbname,
      user: secret.username,
      password: secret.password,
      port: secret.port || 5432,
      ssl: { rejectUnauthorized: false }
    });
    
    await dbClient.connect();
  }
  return dbClient;
}

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

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const { tenantId, role } = extractAuth(event);
  
  if (!tenantId) {
    return createResponse(401, { error: 'Tenant ID required' });
  }
  
  const path = event.path;
  const method = event.httpMethod;
  
  logger.info('Governor API request', { path, method, tenantId });
  
  try {
    const db = await getDbClient();
    
    // GET /api/mission-control/governor/config
    if (path.endsWith('/config') && method === 'GET') {
      return await getConfig(db, tenantId);
    }
    
    // PUT /api/mission-control/governor/config
    if (path.endsWith('/config') && method === 'PUT') {
      return await updateConfig(event, db, tenantId, role);
    }
    
    // GET /api/mission-control/governor/statistics
    if (path.endsWith('/statistics') && method === 'GET') {
      return await getStatistics(event, db, tenantId);
    }
    
    // GET /api/mission-control/governor/recent
    if (path.endsWith('/recent') && method === 'GET') {
      return await getRecentDecisions(event, db, tenantId);
    }
    
    // POST /api/mission-control/governor/analyze
    if (path.endsWith('/analyze') && method === 'POST') {
      return await analyzePrompt(event, db, tenantId);
    }
    
    return createResponse(404, { error: 'Not found' });
    
  } catch (error: any) {
    logger.error('Governor API error', error);
    return createResponse(500, { error: error.message || 'Internal server error' });
  }
}

async function getConfig(
  db: Client,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  return withTenantContext(db, tenantId, async () => {
    const result = await db.query(`
      SELECT domain, governor_mode, updated_at
      FROM decision_domain_config 
      WHERE tenant_id = $1
      ORDER BY domain
    `, [tenantId]);
    
    const governor = new EconomicGovernor(logger);
    
    return createResponse(200, { 
      tenantId,
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
  db: Client,
  tenantId: string,
  role: string
): Promise<APIGatewayProxyResult> {
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
    
    const prevResult = await db.query(
      `SELECT governor_mode FROM decision_domain_config WHERE tenant_id = $1 AND domain = $2`,
      [tenantId, targetDomain]
    );
    const previousMode = prevResult.rows[0]?.governor_mode || 'balanced';
    
    await db.query(`
      INSERT INTO decision_domain_config (tenant_id, domain, governor_mode, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (tenant_id, domain) 
      DO UPDATE SET governor_mode = $3, updated_at = NOW()
    `, [tenantId, targetDomain, mode]);
    
    logger.info('Governor mode updated', { tenantId, domain: targetDomain, mode, previousMode });
    
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

async function getStatistics(
  event: APIGatewayProxyEvent,
  db: Client,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const days = parseInt(params.days || '30', 10);
  
  return withTenantContext(db, tenantId, async () => {
    const overallResult = await db.query(`
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
    `, [tenantId, days]);
    
    const dailyResult = await db.query(`
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
    `, [tenantId, days]);
    
    const byModeResult = await db.query(`
      SELECT 
        governor_mode,
        COUNT(*) as count,
        COALESCE(SUM(savings_amount), 0) as savings
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

async function getRecentDecisions(
  event: APIGatewayProxyEvent,
  db: Client,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const limit = Math.min(parseInt(params.limit || '50', 10), 100);
  
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

async function analyzePrompt(
  event: APIGatewayProxyEvent,
  db: Client,
  tenantId: string
): Promise<APIGatewayProxyResult> {
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
    const configResult = await db.query(
      `SELECT governor_mode FROM decision_domain_config WHERE tenant_id = $1 AND domain = 'general'`,
      [tenantId]
    );
    const mode = (configResult.rows[0]?.governor_mode || 'balanced') as GovernorMode;
    
    const governor = new EconomicGovernor(logger);
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
