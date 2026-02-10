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
  LIVSInterrogatorService,
  LIVSVersionService,
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
let versionService: LIVSVersionService;

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
    versionService = new LIVSVersionService({ pool });

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

  // Set tenant context for RLS (parameterized)
  await pool.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

  try {
    // Route handling
    const pathParts = path.replace('/api/admin/livs', '').split('/').filter(Boolean);
    const resource = pathParts[0] || '';
    const resourceId = pathParts[1];
    const subResource = pathParts[2];

    // =========================================================================
    // Version Endpoints
    // =========================================================================

    if (resource === 'version') {
      if (httpMethod === 'GET') {
        // GET /api/admin/livs/version - Check for updates
        const result = await versionService.checkForUpdates(tenantId);
        return response(200, { success: true, data: result });
      }
      if (httpMethod === 'POST' && resourceId === 'upgrade') {
        // POST /api/admin/livs/version/upgrade - Upgrade to latest version
        const result = await versionService.upgradeTenant(tenantId, userId || 'admin');
        return response(200, { success: true, data: result });
      }
    }

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

    // =========================================================================
    // Cognitive Precision Protocol Endpoints (v7.10.0)
    // =========================================================================
    
    if (resource === 'cognitive-precision') {
      // GET /api/admin/livs/cognitive-precision/config - Get cognitive precision configuration
      if (httpMethod === 'GET' && resourceId === 'config') {
        const result = await pool.query(
          `SELECT * FROM livs_cognitive_precision_config WHERE tenant_id = $1`,
          [tenantId]
        );
        
        if (result.rows.length === 0) {
          // Return defaults if no custom config
          return response(200, { 
            config: {
              contextAnchorEnabled: true,
              contextAnchorMinConfidence: 0.7,
              constraintInjectionEnabled: true,
              criticEnabled: true,
              tieredEscalationEnabled: true,
              ensembleEnabled: false,
            }
          });
        }
        return response(200, { config: result.rows[0] });
      }

      // PUT /api/admin/livs/cognitive-precision/config - Update cognitive precision configuration
      if (httpMethod === 'PUT' && resourceId === 'config') {
        const updates = JSON.parse(body || '{}');
        
        const result = await pool.query(`
          INSERT INTO livs_cognitive_precision_config (
            tenant_id, context_anchor_enabled, context_anchor_min_confidence,
            context_anchor_allow_override, constraint_injection_enabled,
            critic_enabled, critic_model_id, screening_model_id,
            tiered_escalation_enabled, ensemble_enabled, ensemble_voting_strategy,
            isolation_enabled, isolation_level, track_performance
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (tenant_id) DO UPDATE SET
            context_anchor_enabled = COALESCE($2, livs_cognitive_precision_config.context_anchor_enabled),
            context_anchor_min_confidence = COALESCE($3, livs_cognitive_precision_config.context_anchor_min_confidence),
            context_anchor_allow_override = COALESCE($4, livs_cognitive_precision_config.context_anchor_allow_override),
            constraint_injection_enabled = COALESCE($5, livs_cognitive_precision_config.constraint_injection_enabled),
            critic_enabled = COALESCE($6, livs_cognitive_precision_config.critic_enabled),
            critic_model_id = COALESCE($7, livs_cognitive_precision_config.critic_model_id),
            screening_model_id = COALESCE($8, livs_cognitive_precision_config.screening_model_id),
            tiered_escalation_enabled = COALESCE($9, livs_cognitive_precision_config.tiered_escalation_enabled),
            ensemble_enabled = COALESCE($10, livs_cognitive_precision_config.ensemble_enabled),
            ensemble_voting_strategy = COALESCE($11, livs_cognitive_precision_config.ensemble_voting_strategy),
            isolation_enabled = COALESCE($12, livs_cognitive_precision_config.isolation_enabled),
            isolation_level = COALESCE($13, livs_cognitive_precision_config.isolation_level),
            track_performance = COALESCE($14, livs_cognitive_precision_config.track_performance),
            updated_at = NOW()
          RETURNING *
        `, [
          tenantId,
          updates.contextAnchorEnabled,
          updates.contextAnchorMinConfidence,
          updates.contextAnchorAllowOverride,
          updates.constraintInjectionEnabled,
          updates.criticEnabled,
          updates.criticModelId,
          updates.screeningModelId,
          updates.tieredEscalationEnabled,
          updates.ensembleEnabled,
          updates.ensembleVotingStrategy,
          updates.isolationEnabled,
          updates.isolationLevel,
          updates.trackPerformance,
        ]);

        return response(200, { config: result.rows[0] });
      }

      // GET /api/admin/livs/cognitive-precision/constraints - List negative constraints
      if (httpMethod === 'GET' && resourceId === 'constraints') {
        const taskType = event.queryStringParameters?.taskType;
        const includeSystem = event.queryStringParameters?.includeSystem !== 'false';
        
        let query = `
          SELECT * FROM livs_negative_constraints 
          WHERE (tenant_id = $1 OR (is_system_default = true AND $2 = true))
            AND is_active = true
        `;
        const params: unknown[] = [tenantId, includeSystem];
        
        if (taskType) {
          query += ` AND $3 = ANY(task_types)`;
          params.push(taskType);
        }
        
        query += ` ORDER BY is_system_default ASC, severity DESC, created_at DESC`;
        
        const result = await pool.query(query, params);
        return response(200, { constraints: result.rows, count: result.rows.length });
      }

      // POST /api/admin/livs/cognitive-precision/constraints - Create negative constraint
      if (httpMethod === 'POST' && resourceId === 'constraints') {
        const { constraintText, taskTypes, category, severity } = JSON.parse(body || '{}');
        
        if (!constraintText) {
          return response(400, { error: 'constraintText is required' });
        }

        const result = await pool.query(`
          INSERT INTO livs_negative_constraints (tenant_id, constraint_text, task_types, category, severity)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [tenantId, constraintText, taskTypes || ['unknown'], category || 'custom', severity || 'medium']);

        return response(201, { constraint: result.rows[0] });
      }

      // PUT /api/admin/livs/cognitive-precision/constraints/:id - Update negative constraint
      if (httpMethod === 'PUT' && resourceId === 'constraints' && subResource) {
        const updates = JSON.parse(body || '{}');
        
        const result = await pool.query(`
          UPDATE livs_negative_constraints 
          SET constraint_text = COALESCE($3, constraint_text),
              task_types = COALESCE($4, task_types),
              category = COALESCE($5, category),
              severity = COALESCE($6, severity),
              is_active = COALESCE($7, is_active),
              updated_at = NOW()
          WHERE tenant_id = $1 AND id = $2 AND is_system_default = false
          RETURNING *
        `, [tenantId, subResource, updates.constraintText, updates.taskTypes, updates.category, updates.severity, updates.isActive]);

        if (result.rows.length === 0) {
          return response(404, { error: 'Constraint not found or is a system default' });
        }
        return response(200, { constraint: result.rows[0] });
      }

      // DELETE /api/admin/livs/cognitive-precision/constraints/:id - Delete negative constraint
      if (httpMethod === 'DELETE' && resourceId === 'constraints' && subResource) {
        const result = await pool.query(`
          DELETE FROM livs_negative_constraints 
          WHERE tenant_id = $1 AND id = $2 AND is_system_default = false
          RETURNING id
        `, [tenantId, subResource]);

        if (result.rows.length === 0) {
          return response(404, { error: 'Constraint not found or is a system default' });
        }
        return response(200, { deleted: true, id: subResource });
      }

      // GET /api/admin/livs/cognitive-precision/metrics - Get critic performance metrics
      if (httpMethod === 'GET' && resourceId === 'metrics') {
        const days = parseInt(event.queryStringParameters?.days || '30');
        
        const result = await pool.query(`
          SELECT 
            SUM(total_invocations) as total_invocations,
            SUM(screening_invocations) as screening_invocations,
            SUM(full_invocations) as full_invocations,
            SUM(ensemble_invocations) as ensemble_invocations,
            AVG(escalation_rate) as avg_escalation_rate,
            AVG(heuristic_agreement_rate) as avg_heuristic_agreement_rate,
            AVG(avg_confidence_screening) as avg_confidence_screening,
            AVG(avg_confidence_full) as avg_confidence_full,
            AVG(avg_confidence_ensemble) as avg_confidence_ensemble,
            SUM(verdict_supports) as verdict_supports,
            SUM(verdict_weakens) as verdict_weakens,
            SUM(verdict_inconclusive) as verdict_inconclusive,
            AVG(avg_processing_time_screening_ms) as avg_processing_time_screening_ms,
            AVG(avg_processing_time_full_ms) as avg_processing_time_full_ms,
            AVG(avg_processing_time_ensemble_ms) as avg_processing_time_ensemble_ms
          FROM livs_critic_performance_metrics
          WHERE (tenant_id = $1 OR tenant_id IS NULL)
            AND metric_period >= CURRENT_DATE - $2::integer
        `, [tenantId, days]);

        return response(200, { metrics: result.rows[0] || {}, periodDays: days });
      }

      // GET /api/admin/livs/cognitive-precision/anchor-logs - Get context anchor logs
      if (httpMethod === 'GET' && resourceId === 'anchor-logs') {
        const limit = parseInt(event.queryStringParameters?.limit || '50');
        const gateAction = event.queryStringParameters?.gateAction;
        
        let query = `
          SELECT * FROM livs_context_anchor_logs 
          WHERE tenant_id = $1
        `;
        const params: unknown[] = [tenantId];
        
        if (gateAction) {
          query += ` AND gate_action = $2`;
          params.push(gateAction);
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        
        const result = await pool.query(query, params);
        return response(200, { logs: result.rows, count: result.rows.length });
      }

      // GET /api/admin/livs/cognitive-precision/dashboard - Get cognitive precision dashboard
      if (httpMethod === 'GET' && (resourceId === 'dashboard' || !resourceId)) {
        const configResult = await pool.query(
          `SELECT * FROM livs_cognitive_precision_config WHERE tenant_id = $1`,
          [tenantId]
        );

        const anchorStatsResult = await pool.query(`
          SELECT 
            gate_action,
            COUNT(*) as count,
            AVG(confidence_score) as avg_confidence,
            AVG(constraints_applied) as avg_constraints
          FROM livs_context_anchor_logs
          WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
          GROUP BY gate_action
        `, [tenantId]);

        const constraintCountResult = await pool.query(`
          SELECT COUNT(*) as custom_count
          FROM livs_negative_constraints
          WHERE tenant_id = $1 AND is_system_default = false AND is_active = true
        `, [tenantId]);

        const criticMetricsResult = await pool.query(`
          SELECT 
            SUM(total_invocations) as total_invocations,
            AVG(escalation_rate) as avg_escalation_rate,
            SUM(verdict_weakens)::float / NULLIF(SUM(total_invocations), 0) as lie_detection_rate
          FROM livs_critic_performance_metrics
          WHERE (tenant_id = $1 OR tenant_id IS NULL)
            AND metric_period >= CURRENT_DATE - 7
        `, [tenantId]);

        return response(200, {
          config: configResult.rows[0] || null,
          anchorStats: anchorStatsResult.rows,
          customConstraintCount: parseInt(constraintCountResult.rows[0]?.custom_count) || 0,
          criticMetrics: criticMetricsResult.rows[0] || {},
        });
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
