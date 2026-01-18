// RADIANT v5.11.0 - Empiricism Loop Admin API
// The "Ghost in the Machine" - Reality-Testing Circuit for Consciousness
// Manages sandbox execution, surprise metrics, and ego affect integration

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam, doubleParam, boolParam, longParam } from '../shared/db/client';
import { empiricismLoopService } from '../shared/services/empiricism-loop.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

interface EmpiricismConfig {
  enabled: boolean;
  surprise_threshold: number;
  max_rethink_cycles: number;
  dream_verification_limit: number;
  sandbox_timeout_ms: number;
  log_all_executions: boolean;
  affect_integration_enabled: boolean;
  graphrag_logging_enabled: boolean;
  temperature_adjustment_enabled: boolean;
  min_confidence: number;
  max_frustration: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function getTenantId(event: APIGatewayProxyEvent): string {
  return event.requestContext.authorizer?.tenantId || 
         event.headers['x-tenant-id'] || 
         'default';
}

// ============================================================================
// Dashboard
// ============================================================================

/**
 * GET /api/admin/empiricism/dashboard
 * Full dashboard with metrics, recent executions, and config
 */
async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    // Get config
    const configResult = await executeStatement(
      `SELECT * FROM empiricism_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    // Get summary metrics (last 24h)
    const metricsResult = await executeStatement(
      `SELECT 
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE success) as successful,
        COUNT(*) FILTER (WHERE NOT success) as failed,
        AVG(surprise_level) as avg_surprise,
        AVG(prediction_error) as avg_prediction_error,
        AVG(confidence_delta) as avg_confidence_impact,
        AVG(frustration_delta) as avg_frustration_impact,
        COUNT(*) FILTER (WHERE rethink_cycle > 0) as rethink_triggered
       FROM sandbox_execution_log 
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [stringParam('tenantId', tenantId)]
    );

    // Get recent executions (last 20)
    const recentResult = await executeStatement(
      `SELECT execution_id, language, success, surprise_level, error_type, 
              confidence_delta, frustration_delta, rethink_cycle, execution_time_ms, created_at
       FROM sandbox_execution_log 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [stringParam('tenantId', tenantId)]
    );

    // Get ego affect state
    const affectResult = await executeStatement(
      `SELECT confidence, frustration, dominant_emotion, last_trigger_event, last_trigger_at
       FROM ego_affect WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    // Get global workspace events (last 10)
    const eventsResult = await executeStatement(
      `SELECT event_id, event_type, priority, content, broadcast_status, created_at
       FROM global_workspace_events 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [stringParam('tenantId', tenantId)]
    );

    // Get active verification stats
    const verificationResult = await executeStatement(
      `SELECT 
        COUNT(*) as total_verifications,
        COUNT(*) FILTER (WHERE success) as successful,
        COUNT(*) FILTER (WHERE surprise_generated) as surprises
       FROM active_verification_log 
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [stringParam('tenantId', tenantId)]
    );

    const config = configResult.rows?.[0] as unknown as EmpiricismConfig | undefined;
    const metrics = metricsResult.rows?.[0] as Record<string, unknown> | undefined;
    const affect = affectResult.rows?.[0] as Record<string, unknown> | undefined;
    const verification = verificationResult.rows?.[0] as Record<string, unknown> | undefined;

    return response(200, {
      config: config || getDefaultConfig(),
      metrics: {
        totalExecutions: Number(metrics?.total_executions || 0),
        successful: Number(metrics?.successful || 0),
        failed: Number(metrics?.failed || 0),
        avgSurprise: Number(metrics?.avg_surprise || 0),
        avgPredictionError: Number(metrics?.avg_prediction_error || 0),
        avgConfidenceImpact: Number(metrics?.avg_confidence_impact || 0),
        avgFrustrationImpact: Number(metrics?.avg_frustration_impact || 0),
        rethinkTriggered: Number(metrics?.rethink_triggered || 0),
      },
      egoAffect: affect ? {
        confidence: Number(affect.confidence || 0.5),
        frustration: Number(affect.frustration || 0),
        dominantEmotion: affect.dominant_emotion || 'neutral',
        lastTrigger: affect.last_trigger_event,
        lastTriggerAt: affect.last_trigger_at,
      } : null,
      recentExecutions: recentResult.rows || [],
      globalWorkspaceEvents: eventsResult.rows || [],
      activeVerification: {
        totalVerifications: Number(verification?.total_verifications || 0),
        successful: Number(verification?.successful || 0),
        surprises: Number(verification?.surprises || 0),
      },
    });
  } catch (error) {
    logger.error('Failed to get empiricism dashboard', { error });
    return response(500, { error: 'Failed to get dashboard' });
  }
}

function getDefaultConfig(): EmpiricismConfig {
  return {
    enabled: true,
    surprise_threshold: 0.3,
    max_rethink_cycles: 3,
    dream_verification_limit: 5,
    sandbox_timeout_ms: 30000,
    log_all_executions: true,
    affect_integration_enabled: true,
    graphrag_logging_enabled: true,
    temperature_adjustment_enabled: true,
    min_confidence: 0.1,
    max_frustration: 1.0,
  };
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * GET /api/admin/empiricism/config
 * Get empiricism loop configuration
 */
async function getConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    const result = await executeStatement(
      `SELECT * FROM empiricism_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    return response(200, {
      config: result.rows?.[0] || getDefaultConfig(),
    });
  } catch (error) {
    logger.error('Failed to get config', { error });
    return response(500, { error: 'Failed to get config' });
  }
}

/**
 * PUT /api/admin/empiricism/config
 * Update empiricism loop configuration
 */
async function updateConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const body = JSON.parse(event.body || '{}') as Partial<EmpiricismConfig>;
  
  try {
    await executeStatement(
      `INSERT INTO empiricism_config (
        tenant_id, enabled, surprise_threshold, max_rethink_cycles, 
        dream_verification_limit, sandbox_timeout_ms, log_all_executions,
        affect_integration_enabled, graphrag_logging_enabled, 
        temperature_adjustment_enabled, min_confidence, max_frustration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = COALESCE($2, empiricism_config.enabled),
        surprise_threshold = COALESCE($3, empiricism_config.surprise_threshold),
        max_rethink_cycles = COALESCE($4, empiricism_config.max_rethink_cycles),
        dream_verification_limit = COALESCE($5, empiricism_config.dream_verification_limit),
        sandbox_timeout_ms = COALESCE($6, empiricism_config.sandbox_timeout_ms),
        log_all_executions = COALESCE($7, empiricism_config.log_all_executions),
        affect_integration_enabled = COALESCE($8, empiricism_config.affect_integration_enabled),
        graphrag_logging_enabled = COALESCE($9, empiricism_config.graphrag_logging_enabled),
        temperature_adjustment_enabled = COALESCE($10, empiricism_config.temperature_adjustment_enabled),
        min_confidence = COALESCE($11, empiricism_config.min_confidence),
        max_frustration = COALESCE($12, empiricism_config.max_frustration),
        updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        boolParam('enabled', body.enabled ?? true),
        doubleParam('threshold', body.surprise_threshold ?? 0.3),
        longParam('maxCycles', body.max_rethink_cycles ?? 3),
        longParam('verifyLimit', body.dream_verification_limit ?? 5),
        longParam('timeout', body.sandbox_timeout_ms ?? 30000),
        boolParam('logAll', body.log_all_executions ?? true),
        boolParam('affectEnabled', body.affect_integration_enabled ?? true),
        boolParam('graphragEnabled', body.graphrag_logging_enabled ?? true),
        boolParam('tempEnabled', body.temperature_adjustment_enabled ?? true),
        doubleParam('minConf', body.min_confidence ?? 0.1),
        doubleParam('maxFrust', body.max_frustration ?? 1.0),
      ]
    );

    logger.info('Empiricism config updated', { tenantId });
    return response(200, { success: true });
  } catch (error) {
    logger.error('Failed to update config', { error });
    return response(500, { error: 'Failed to update config' });
  }
}

// ============================================================================
// Execution Log
// ============================================================================

/**
 * GET /api/admin/empiricism/executions
 * Get sandbox execution history
 */
async function getExecutions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
  const successOnly = event.queryStringParameters?.success === 'true';
  const failureOnly = event.queryStringParameters?.failure === 'true';
  
  try {
    let whereClause = 'WHERE tenant_id = $1';
    if (successOnly) whereClause += ' AND success = true';
    if (failureOnly) whereClause += ' AND success = false';

    const result = await executeStatement(
      `SELECT execution_id, language, code_snippet, success, output, error, 
              exit_code, execution_time_ms, expected_output, expected_success,
              prediction_confidence, surprise_level, prediction_error, error_type,
              confidence_delta, frustration_delta, temperature_delta, rethink_cycle, created_at
       FROM sandbox_execution_log 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [
        stringParam('tenantId', tenantId),
        longParam('limit', limit),
        longParam('offset', offset),
      ]
    );

    const countResult = await executeStatement(
      `SELECT COUNT(*) as total FROM sandbox_execution_log ${whereClause}`,
      [stringParam('tenantId', tenantId)]
    );

    return response(200, {
      executions: result.rows || [],
      total: Number((countResult.rows?.[0] as { total?: number })?.total || 0),
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Failed to get executions', { error });
    return response(500, { error: 'Failed to get executions' });
  }
}

// ============================================================================
// Global Workspace Events
// ============================================================================

/**
 * GET /api/admin/empiricism/events
 * Get global workspace sensory events
 */
async function getEvents(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  
  try {
    const result = await executeStatement(
      `SELECT event_id, event_type, priority, content, metadata, 
              broadcast_status, processed_at, processing_result, created_at
       FROM global_workspace_events 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [
        stringParam('tenantId', tenantId),
        longParam('limit', limit),
      ]
    );

    return response(200, {
      events: result.rows || [],
    });
  } catch (error) {
    logger.error('Failed to get events', { error });
    return response(500, { error: 'Failed to get events' });
  }
}

// ============================================================================
// Ego Affect Management
// ============================================================================

/**
 * GET /api/admin/empiricism/affect
 * Get current ego affect state
 */
async function getAffect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    const result = await executeStatement(
      `SELECT * FROM ego_affect WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    return response(200, {
      affect: result.rows?.[0] || {
        confidence: 0.6,
        frustration: 0,
        dominant_emotion: 'neutral',
      },
    });
  } catch (error) {
    logger.error('Failed to get affect', { error });
    return response(500, { error: 'Failed to get affect' });
  }
}

/**
 * POST /api/admin/empiricism/affect/reset
 * Reset ego affect to defaults
 */
async function resetAffect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    await executeStatement(
      `UPDATE ego_affect SET 
        confidence = 0.6, frustration = 0, valence = 0, arousal = 0.5,
        dominant_emotion = 'neutral', last_trigger_event = 'admin_reset',
        last_trigger_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    logger.info('Ego affect reset', { tenantId });
    return response(200, { success: true });
  } catch (error) {
    logger.error('Failed to reset affect', { error });
    return response(500, { error: 'Failed to reset affect' });
  }
}

// ============================================================================
// Active Verification (Dreaming)
// ============================================================================

/**
 * GET /api/admin/empiricism/verifications
 * Get active verification history from dreams
 */
async function getVerifications(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  
  try {
    const result = await executeStatement(
      `SELECT verification_id, skill_name, initial_confidence, success, 
              new_confidence, surprise_generated, trigger_reason, created_at
       FROM active_verification_log 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [
        stringParam('tenantId', tenantId),
        longParam('limit', limit),
      ]
    );

    return response(200, {
      verifications: result.rows || [],
    });
  } catch (error) {
    logger.error('Failed to get verifications', { error });
    return response(500, { error: 'Failed to get verifications' });
  }
}

/**
 * POST /api/admin/empiricism/verify-now
 * Manually trigger active verification
 */
async function triggerVerification(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    const result = await empiricismLoopService.activeVerification(tenantId);
    
    logger.info('Manual verification triggered', { tenantId, result });
    return response(200, {
      success: true,
      result,
    });
  } catch (error) {
    logger.error('Failed to trigger verification', { error });
    return response(500, { error: 'Failed to trigger verification' });
  }
}

// ============================================================================
// Metrics
// ============================================================================

/**
 * GET /api/admin/empiricism/metrics
 * Get hourly metrics for the last 7 days
 */
async function getMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    const result = await executeStatement(
      `SELECT * FROM empiricism_metrics WHERE tenant_id = $1 ORDER BY hour DESC`,
      [stringParam('tenantId', tenantId)]
    );

    return response(200, {
      metrics: result.rows || [],
    });
  } catch (error) {
    logger.error('Failed to get metrics', { error });
    return response(500, { error: 'Failed to get metrics' });
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path.replace('/api/admin/empiricism', '');
  const method = event.httpMethod;

  logger.info('Empiricism admin request', { path, method });

  try {
    // Dashboard
    if (path === '/dashboard' && method === 'GET') {
      return getDashboard(event);
    }

    // Configuration
    if (path === '/config' && method === 'GET') {
      return getConfig(event);
    }
    if (path === '/config' && method === 'PUT') {
      return updateConfig(event);
    }

    // Executions
    if (path === '/executions' && method === 'GET') {
      return getExecutions(event);
    }

    // Events
    if (path === '/events' && method === 'GET') {
      return getEvents(event);
    }

    // Affect
    if (path === '/affect' && method === 'GET') {
      return getAffect(event);
    }
    if (path === '/affect/reset' && method === 'POST') {
      return resetAffect(event);
    }

    // Verifications
    if (path === '/verifications' && method === 'GET') {
      return getVerifications(event);
    }
    if (path === '/verify-now' && method === 'POST') {
      return triggerVerification(event);
    }

    // Metrics
    if (path === '/metrics' && method === 'GET') {
      return getMetrics(event);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    logger.error('Empiricism admin error', { error });
    return response(500, { error: 'Internal server error' });
  }
}
