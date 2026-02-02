/**
 * LIVS Admin API Handler
 * 
 * Admin endpoints for LLM Integrity Verification System:
 * - Configuration management
 * - Soft rules CRUD
 * - Dashboard & analytics
 * - Interrogation history
 * - Model integrity reports
 * 
 * @version 1.0.0
 * @since v6.3.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import {
  LIVSConfigService,
  LIVSSoftRulesService,
  LIVSWeightsService,
  LIVSOrchestrationService,
  LIVSInterrogatorService
} from '../shared/services/livs';
import {
  LIVSConfiguration,
  CreateLIVSSoftRuleRequest,
  LIVSDashboard,
  InterrogateRequest
} from '@radiant/shared';

// Initialize services (would be injected in production)
let pool: Pool;
let configService: LIVSConfigService;
let softRulesService: LIVSSoftRulesService;
let weightsService: LIVSWeightsService;
let orchestrationService: LIVSOrchestrationService;
let interrogatorService: LIVSInterrogatorService;

const initServices = () => {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    configService = new LIVSConfigService({ pool });
    softRulesService = new LIVSSoftRulesService({ pool });
    weightsService = new LIVSWeightsService({ pool });

    // Note: interrogatorService and orchestrationService need LLM client
    // In production, this would be injected
  }
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  },
  body: JSON.stringify(body)
});

const getTenantId = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.authorizer?.tenantId || 
         event.headers['x-tenant-id'] || 
         'default';
};

const getUserId = (event: APIGatewayProxyEvent): string | undefined => {
  return event.requestContext.authorizer?.userId || 
         event.headers['x-user-id'];
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  initServices();

  const { httpMethod, path, pathParameters, body } = event;
  const tenantId = getTenantId(event);
  const userId = getUserId(event);

  // Set tenant context for RLS
  await pool.query(`SET app.current_tenant_id = '${tenantId}'`);

  try {
    // Route handling
    const pathParts = path.replace('/api/admin/livs', '').split('/').filter(Boolean);
    const resource = pathParts[0] || '';
    const resourceId = pathParts[1];
    const subResource = pathParts[2];

    // =========================================================================
    // Configuration Endpoints
    // =========================================================================
    
    if (resource === 'config' || resource === '') {
      if (httpMethod === 'GET') {
        // GET /api/admin/livs/config - Get LIVS configuration
        const config = await configService.getConfig(tenantId);
        return response(200, { config });
      }

      if (httpMethod === 'PUT') {
        // PUT /api/admin/livs/config - Update LIVS configuration
        const updates = JSON.parse(body || '{}') as Partial<LIVSConfiguration>;
        const config = await configService.updateConfig(tenantId, updates, userId);
        return response(200, { config });
      }

      if (httpMethod === 'DELETE') {
        // DELETE /api/admin/livs/config - Reset to defaults
        const config = await configService.resetConfig(tenantId, userId);
        return response(200, { config, message: 'Configuration reset to defaults' });
      }
    }

    // =========================================================================
    // Soft Rules Endpoints
    // =========================================================================
    
    if (resource === 'rules') {
      if (httpMethod === 'GET' && !resourceId) {
        // GET /api/admin/livs/rules - List all soft rules
        const activeOnly = event.queryStringParameters?.activeOnly === 'true';
        const rules = await softRulesService.getRules(tenantId, { activeOnly });
        return response(200, { rules, count: rules.length });
      }

      if (httpMethod === 'GET' && resourceId) {
        // GET /api/admin/livs/rules/:id - Get single rule
        const rule = await softRulesService.getRule(tenantId, resourceId);
        if (!rule) {
          return response(404, { error: 'Rule not found' });
        }
        return response(200, { rule });
      }

      if (httpMethod === 'POST' && !resourceId) {
        // POST /api/admin/livs/rules - Create new rule
        const request = JSON.parse(body || '{}') as CreateLIVSSoftRuleRequest;
        if (!request.name) {
          return response(400, { error: 'Rule name is required' });
        }
        const rule = await softRulesService.createRule(
          tenantId,
          request,
          'tenant_admin',
          userId
        );
        return response(201, { rule });
      }

      if (httpMethod === 'PUT' && resourceId) {
        // PUT /api/admin/livs/rules/:id - Update rule
        const updates = JSON.parse(body || '{}') as Partial<CreateLIVSSoftRuleRequest>;
        const rule = await softRulesService.updateRule(tenantId, resourceId, updates);
        if (!rule) {
          return response(404, { error: 'Rule not found' });
        }
        return response(200, { rule });
      }

      if (httpMethod === 'DELETE' && resourceId) {
        // DELETE /api/admin/livs/rules/:id - Delete rule
        const deleted = await softRulesService.deleteRule(tenantId, resourceId);
        if (!deleted) {
          return response(404, { error: 'Rule not found' });
        }
        return response(200, { message: 'Rule deleted' });
      }

      if (httpMethod === 'POST' && resourceId === 'toggle') {
        // POST /api/admin/livs/rules/:id/toggle - Toggle rule active status
        const ruleId = subResource;
        if (!ruleId) {
          return response(400, { error: 'Rule ID required' });
        }
        const active = await softRulesService.toggleRule(tenantId, ruleId);
        return response(200, { active });
      }
    }

    // =========================================================================
    // Dashboard & Analytics Endpoints
    // =========================================================================
    
    if (resource === 'dashboard') {
      if (httpMethod === 'GET') {
        // GET /api/admin/livs/dashboard - Get dashboard data
        const dashboard = await getDashboardData(tenantId);
        return response(200, { dashboard });
      }
    }

    // =========================================================================
    // Model Integrity Endpoints
    // =========================================================================
    
    if (resource === 'models') {
      if (httpMethod === 'GET' && !resourceId) {
        // GET /api/admin/livs/models - List all model integrity profiles
        const sortBy = event.queryStringParameters?.sortBy as 'lie_rate' | 'total_interrogations' || 'lie_rate';
        const order = event.queryStringParameters?.order as 'asc' | 'desc' || 'desc';
        const profiles = await weightsService.getAllProfiles(tenantId, { sortBy, order });
        return response(200, { profiles, count: profiles.length });
      }

      if (httpMethod === 'GET' && resourceId && !subResource) {
        // GET /api/admin/livs/models/:modelId - Get model integrity profile
        const profile = await weightsService.getModelProfile(tenantId, resourceId);
        if (!profile) {
          return response(404, { error: 'Model profile not found' });
        }

        // Get additional data
        const trend = await weightsService.getLieRateTrend(tenantId, resourceId, 30);
        const domainBreakdown = await weightsService.getDomainBreakdown(tenantId, resourceId);
        const globalWeights = await weightsService.getGlobalWeights(resourceId);

        return response(200, {
          profile,
          trend,
          domainBreakdown,
          globalWeights
        });
      }

      if (httpMethod === 'GET' && resourceId === 'top-lying') {
        // GET /api/admin/livs/models/top-lying - Get top lying models
        const limit = parseInt(event.queryStringParameters?.limit || '5');
        const minSampleSize = parseInt(event.queryStringParameters?.minSampleSize || '10');
        const models = await weightsService.getTopLyingModels(tenantId, limit, minSampleSize);
        return response(200, { models });
      }

      if (httpMethod === 'GET' && resourceId === 'most-reliable') {
        // GET /api/admin/livs/models/most-reliable - Get most reliable models
        const limit = parseInt(event.queryStringParameters?.limit || '5');
        const minSampleSize = parseInt(event.queryStringParameters?.minSampleSize || '10');
        const models = await weightsService.getMostReliableModels(tenantId, limit, minSampleSize);
        return response(200, { models });
      }
    }

    // =========================================================================
    // Interrogation Endpoints
    // =========================================================================
    
    if (resource === 'interrogations') {
      if (httpMethod === 'GET' && !resourceId) {
        // GET /api/admin/livs/interrogations - List recent interrogations
        const limit = parseInt(event.queryStringParameters?.limit || '20');
        const modelId = event.queryStringParameters?.modelId;

        let interrogations;
        if (modelId) {
          interrogations = await interrogatorService?.getModelHistory(tenantId, modelId, limit);
        } else {
          interrogations = await interrogatorService?.getRecentInterrogations(tenantId, limit);
        }

        return response(200, { 
          interrogations: interrogations || [], 
          count: interrogations?.length || 0 
        });
      }

      if (httpMethod === 'GET' && resourceId) {
        // GET /api/admin/livs/interrogations/:id - Get single interrogation
        const result = await pool.query(
          `SELECT * FROM livs_interrogations WHERE tenant_id = $1 AND id = $2`,
          [tenantId, resourceId]
        );

        if (result.rows.length === 0) {
          return response(404, { error: 'Interrogation not found' });
        }

        return response(200, { interrogation: result.rows[0] });
      }

      if (httpMethod === 'POST' && !resourceId) {
        // POST /api/admin/livs/interrogations - Manually trigger interrogation
        const request = JSON.parse(body || '{}') as InterrogateRequest;
        
        if (!request.response || !request.modelId) {
          return response(400, { error: 'response and modelId are required' });
        }

        if (!interrogatorService) {
          return response(503, { error: 'Interrogator service not available' });
        }

        const result = await interrogatorService.interrogate(tenantId, request);
        return response(200, { result });
      }
    }

    // =========================================================================
    // Pipeline Audit Endpoints
    // =========================================================================
    
    if (resource === 'audits') {
      if (httpMethod === 'GET' && !resourceId) {
        // GET /api/admin/livs/audits - List recent pipeline audits
        const limit = parseInt(event.queryStringParameters?.limit || '20');
        const audits = await orchestrationService?.getRecentAudits(tenantId, limit);
        return response(200, { audits: audits || [], count: audits?.length || 0 });
      }

      if (httpMethod === 'GET' && resourceId) {
        // GET /api/admin/livs/audits/:id - Get single audit
        const result = await pool.query(
          `SELECT * FROM livs_pipeline_audits WHERE tenant_id = $1 AND id = $2`,
          [tenantId, resourceId]
        );

        if (result.rows.length === 0) {
          return response(404, { error: 'Audit not found' });
        }

        return response(200, { audit: result.rows[0] });
      }
    }

    // =========================================================================
    // Orchestration Pattern Endpoints
    // =========================================================================
    
    if (resource === 'patterns') {
      if (httpMethod === 'GET' && !resourceId) {
        // GET /api/admin/livs/patterns - List orchestration patterns
        const result = await pool.query(
          `SELECT * FROM livs_orchestration_weights 
           WHERE tenant_id = $1 
           ORDER BY reliability_score DESC`,
          [tenantId]
        );
        return response(200, { patterns: result.rows, count: result.rows.length });
      }

      if (httpMethod === 'GET' && resourceId) {
        // GET /api/admin/livs/patterns/:patternId - Get pattern profile
        const profile = await orchestrationService?.getOrchestrationProfile(tenantId, resourceId);
        if (!profile) {
          return response(404, { error: 'Pattern not found' });
        }
        return response(200, { profile });
      }
    }

    // =========================================================================
    // Global Weights (Admin Only)
    // =========================================================================
    
    if (resource === 'global') {
      if (httpMethod === 'POST' && resourceId === 'aggregate') {
        // POST /api/admin/livs/global/aggregate - Trigger global weight aggregation
        await weightsService.aggregateGlobalWeights();
        return response(200, { message: 'Global weights aggregated' });
      }

      if (httpMethod === 'GET' && resourceId) {
        // GET /api/admin/livs/global/:modelId - Get global weights for model
        const weights = await weightsService.getGlobalWeights(resourceId);
        if (!weights) {
          return response(404, { error: 'No global weights for this model' });
        }
        return response(200, { weights });
      }
    }

    return response(404, { error: 'Endpoint not found' });

  } catch (error) {
    console.error('LIVS API Error:', error);
    return response(500, { 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Build dashboard data
 */
async function getDashboardData(tenantId: string): Promise<LIVSDashboard> {
  const config = await configService.getConfig(tenantId);

  // Get interrogation metrics
  const metricsResult = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as total_24h,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as total_7d,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as total_30d,
      COUNT(*) FILTER (WHERE lie_detected AND created_at >= NOW() - INTERVAL '24 hours') as lies_24h,
      COUNT(*) FILTER (WHERE lie_detected AND created_at >= NOW() - INTERVAL '7 days') as lies_7d,
      COUNT(*) FILTER (WHERE lie_detected AND created_at >= NOW() - INTERVAL '30 days') as lies_30d,
      AVG(CASE WHEN lie_detected THEN 1.0 ELSE 0.0 END) as avg_lie_rate
    FROM livs_interrogations
    WHERE tenant_id = $1
  `, [tenantId]);

  const metrics = metricsResult.rows[0];

  // Get top lying models
  const topLyingResult = await pool.query(`
    SELECT model_id, lie_rate, sample_size
    FROM livs_model_weights
    WHERE tenant_id = $1 AND sample_size >= 5
    ORDER BY lie_rate DESC
    LIMIT 5
  `, [tenantId]);

  // Get top reliable models
  const topReliableResult = await pool.query(`
    SELECT model_id, lie_rate, sample_size
    FROM livs_model_weights
    WHERE tenant_id = $1 AND sample_size >= 5
    ORDER BY lie_rate ASC
    LIMIT 5
  `, [tenantId]);

  // Get orchestration metrics
  const orchResult = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as audits_24h,
      COUNT(*) FILTER (WHERE 
        created_at >= NOW() - INTERVAL '24 hours' AND 
        jsonb_array_length(detected_patterns) > 0
      ) as failures_24h,
      AVG(overall_integrity_score) as avg_score
    FROM livs_pipeline_audits
    WHERE tenant_id = $1
  `, [tenantId]);

  const orchMetrics = orchResult.rows[0];

  // Get active soft rules count
  const rulesResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM livs_soft_rules
    WHERE tenant_id = $1 AND active = true
  `, [tenantId]);

  // Get recent interrogations
  const recentResult = await pool.query(`
    SELECT id, original_model_id as model_id, verdict, created_at as timestamp
    FROM livs_interrogations
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 10
  `, [tenantId]);

  // Calculate cost savings from prevented bad outputs
  // Estimate: Each detected lie prevents ~$5 in downstream costs (rework, user complaints, escalations)
  // Higher severity lies (confirmed_lie) prevent more costs (~$15 each)
  const costSavingsResult = await pool.query(`
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN verdict = 'confirmed_lie' THEN 15.0
          WHEN verdict = 'likely_lie' THEN 5.0
          WHEN verdict = 'suspicious' THEN 1.0
          ELSE 0
        END
      ), 0) as estimated_savings_30d
    FROM livs_interrogations
    WHERE tenant_id = $1 
      AND lie_detected = true 
      AND created_at >= NOW() - INTERVAL '30 days'
  `, [tenantId]);

  const costSavings = parseFloat(costSavingsResult.rows[0]?.estimated_savings_30d) || 0;

  return {
    config: {
      enabled: config.enabled,
      tier1Enabled: config.individualInterrogation.enabled,
      tier2Enabled: config.orchestrationIntegrity.enabled,
      costMode: config.costMode
    },
    interrogationMetrics: {
      total24h: parseInt(metrics.total_24h) || 0,
      total7d: parseInt(metrics.total_7d) || 0,
      total30d: parseInt(metrics.total_30d) || 0,
      liesDetected24h: parseInt(metrics.lies_24h) || 0,
      liesDetected7d: parseInt(metrics.lies_7d) || 0,
      liesDetected30d: parseInt(metrics.lies_30d) || 0,
      averageLieRate: parseFloat(metrics.avg_lie_rate) || 0,
      costSavings
    },
    topLyingModels: topLyingResult.rows.map(r => ({
      modelId: r.model_id,
      lieRate: parseFloat(r.lie_rate),
      sampleSize: r.sample_size
    })),
    topReliableModels: topReliableResult.rows.map(r => ({
      modelId: r.model_id,
      lieRate: parseFloat(r.lie_rate),
      sampleSize: r.sample_size
    })),
    orchestrationMetrics: {
      pipelinesAudited24h: parseInt(orchMetrics.audits_24h) || 0,
      failurePatternsDetected24h: parseInt(orchMetrics.failures_24h) || 0,
      averageIntegrityScore: parseFloat(orchMetrics.avg_score) || 0
    },
    activeSoftRules: parseInt(rulesResult.rows[0].count) || 0,
    recentInterrogations: recentResult.rows.map(r => ({
      id: r.id,
      modelId: r.model_id,
      verdict: r.verdict,
      timestamp: new Date(r.timestamp)
    }))
  };
}
