/**
 * RADIANT Genesis Cato Admin API Handler
 * Provides admin endpoints for Cato Safety Architecture management
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../shared/services/database';
import { personaService } from '../shared/services/cato/persona.service';
import { merkleAuditService } from '../shared/services/cato/merkle-audit.service';
import { sensoryVetoService } from '../shared/services/cato/sensory-veto.service';
import { catoStateService } from '../shared/services/cato/redis.service';

// Response helpers
const success = (data: unknown, statusCode = 200): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

const error = (message: string, statusCode = 500): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message }),
});

// Get tenant ID from event (would come from auth middleware)
const getTenantId = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.authorizer?.tenantId || 'demo-tenant';
};

const getUserId = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.authorizer?.userId || 'demo-user';
};

/**
 * GET /admin/cato/metrics
 * Get Cato safety metrics for the tenant
 */
export const getMetrics: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    const result = await query(
      `SELECT * FROM get_cato_safety_metrics($1, INTERVAL '24 hours')`,
      [tenantId]
    );

    // Convert to object
    const metrics: Record<string, number> = {};
    for (const row of result.rows) {
      metrics[row.metric_name] = parseInt(row.metric_value);
    }

    return success(metrics);
  } catch (err) {
    console.error('Failed to get Cato metrics:', err);
    return error('Failed to get metrics', 500);
  }
};

/**
 * GET /admin/cato/recovery-effectiveness
 * Get recovery effectiveness metrics
 */
export const getRecoveryEffectiveness: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    const result = await query(
      `SELECT * FROM get_recovery_effectiveness($1, INTERVAL '7 days')`,
      [tenantId]
    );

    return success(result.rows);
  } catch (err) {
    console.error('Failed to get recovery effectiveness:', err);
    return error('Failed to get recovery effectiveness', 500);
  }
};

/**
 * GET /admin/cato/personas
 * Get all personas available to the tenant
 */
export const getPersonas: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const personas = await personaService.getTenantPersonas(tenantId);
    return success(personas);
  } catch (err) {
    console.error('Failed to get personas:', err);
    return error('Failed to get personas', 500);
  }
};

/**
 * GET /admin/cato/personas/:id
 * Get a specific persona
 */
export const getPersona: APIGatewayProxyHandler = async (event) => {
  try {
    const personaId = event.pathParameters?.id;
    if (!personaId) {
      return error('Persona ID required', 400);
    }

    const persona = await personaService.getPersona(personaId);
    if (!persona) {
      return error('Persona not found', 404);
    }

    return success(persona);
  } catch (err) {
    console.error('Failed to get persona:', err);
    return error('Failed to get persona', 500);
  }
};

/**
 * POST /admin/cato/personas
 * Create a new tenant persona
 */
export const createPersona: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');

    const persona = await personaService.createTenantPersona({
      tenantId,
      ...body,
    });

    return success(persona, 201);
  } catch (err) {
    console.error('Failed to create persona:', err);
    return error('Failed to create persona', 500);
  }
};

/**
 * PUT /admin/cato/personas/:id
 * Update a tenant persona
 */
export const updatePersona: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const personaId = event.pathParameters?.id;
    if (!personaId) {
      return error('Persona ID required', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const persona = await personaService.updatePersona(personaId, tenantId, body);

    if (!persona) {
      return error('Persona not found or not editable', 404);
    }

    return success(persona);
  } catch (err) {
    console.error('Failed to update persona:', err);
    return error('Failed to update persona', 500);
  }
};

/**
 * GET /admin/cato/escalations
 * Get pending human escalations
 */
export const getEscalations: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const status = event.queryStringParameters?.status || 'PENDING';

    const result = await query(
      `SELECT * FROM cato_human_escalations 
       WHERE tenant_id = $1 AND status = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [tenantId, status]
    );

    return success(result.rows);
  } catch (err) {
    console.error('Failed to get escalations:', err);
    return error('Failed to get escalations', 500);
  }
};

/**
 * POST /admin/cato/escalations/:id/respond
 * Respond to a human escalation
 */
export const respondToEscalation: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const escalationId = event.pathParameters?.id;
    if (!escalationId) {
      return error('Escalation ID required', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const { decision, response } = body;

    if (!['APPROVED', 'REJECTED', 'MODIFIED'].includes(decision)) {
      return error('Invalid decision. Must be APPROVED, REJECTED, or MODIFIED', 400);
    }

    const result = await query(
      `UPDATE cato_human_escalations 
       SET human_decision = $1, human_response = $2, 
           responded_at = NOW(), responded_by = $3, status = 'RESOLVED'
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [decision, response, userId, escalationId, tenantId]
    );

    if (result.rows.length === 0) {
      return error('Escalation not found', 404);
    }

    return success(result.rows[0]);
  } catch (err) {
    console.error('Failed to respond to escalation:', err);
    return error('Failed to respond to escalation', 500);
  }
};

/**
 * GET /admin/cato/audit
 * Get audit trail entries
 */
export const getAuditTrail: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');
    const entryType = event.queryStringParameters?.type;

    let queryStr = `
      SELECT id, entry_type, entry_content, merkle_hash, timestamp
      FROM cato_audit_trail
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (entryType) {
      queryStr += ` AND entry_type = $${params.length + 1}`;
      params.push(entryType);
    }

    queryStr += ` ORDER BY sequence_number DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);
    return success(result.rows);
  } catch (err) {
    console.error('Failed to get audit trail:', err);
    return error('Failed to get audit trail', 500);
  }
};

/**
 * POST /admin/cato/audit/search
 * Search audit trail
 */
export const searchAuditTrail: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');
    const { searchQuery, limit = 50 } = body;

    if (!searchQuery) {
      return error('searchQuery required', 400);
    }

    const entries = await merkleAuditService.searchEntries(tenantId, searchQuery, limit);
    return success(entries);
  } catch (err) {
    console.error('Failed to search audit trail:', err);
    return error('Failed to search audit trail', 500);
  }
};

/**
 * POST /admin/cato/audit/verify
 * Verify audit chain integrity
 */
export const verifyAuditChain: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');
    const { fromSequence } = body;

    const result = await merkleAuditService.verifyChain(tenantId, fromSequence);
    return success(result);
  } catch (err) {
    console.error('Failed to verify audit chain:', err);
    return error('Failed to verify audit chain', 500);
  }
};

/**
 * GET /admin/cato/cbf
 * Get CBF definitions
 */
export const getCBFDefinitions: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    const result = await query(
      `SELECT * FROM cato_cbf_definitions 
       WHERE scope = 'global' OR tenant_id = $1
       ORDER BY is_critical DESC, name`,
      [tenantId]
    );

    return success(result.rows);
  } catch (err) {
    console.error('Failed to get CBF definitions:', err);
    return error('Failed to get CBF definitions', 500);
  }
};

/**
 * GET /admin/cato/cbf/violations
 * Get recent CBF violations
 */
export const getCBFViolations: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const critical = event.queryStringParameters?.critical === 'true';

    let queryStr = `
      SELECT * FROM cato_cbf_violations 
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (critical) {
      queryStr += ` AND is_critical = TRUE`;
    }

    queryStr += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(queryStr, params);
    return success(result.rows);
  } catch (err) {
    console.error('Failed to get CBF violations:', err);
    return error('Failed to get CBF violations', 500);
  }
};

/**
 * GET /admin/cato/config
 * Get tenant Cato configuration
 */
export const getConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    const result = await query(
      `SELECT * FROM cato_tenant_config WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      // Return defaults
      return success({
        gammaMax: 5.0,
        emergencyThreshold: 0.5,
        sensoryFloor: 0.3,
        livelockThreshold: 3,
        recoveryWindowSeconds: 10,
        maxRecoveryAttempts: 3,
        entropyHighRiskThreshold: 0.8,
        entropyLowRiskThreshold: 0.3,
        tileSize: 1000,
        retentionYears: 7,
        enableSemanticEntropy: true,
        enableRedundantPerception: true,
        enableFractureDetection: true,
      });
    }

    // Map snake_case to camelCase
    const config = result.rows[0];
    return success({
      gammaMax: parseFloat(config.gamma_max),
      emergencyThreshold: parseFloat(config.emergency_threshold),
      sensoryFloor: parseFloat(config.sensory_floor),
      livelockThreshold: config.livelock_threshold,
      recoveryWindowSeconds: config.recovery_window_seconds,
      maxRecoveryAttempts: config.max_recovery_attempts,
      entropyHighRiskThreshold: parseFloat(config.entropy_high_risk_threshold),
      entropyLowRiskThreshold: parseFloat(config.entropy_low_risk_threshold),
      tileSize: config.tile_size,
      retentionYears: config.retention_years,
      enableSemanticEntropy: config.enable_semantic_entropy,
      enableRedundantPerception: config.enable_redundant_perception,
      enableFractureDetection: config.enable_fracture_detection,
      defaultPersonaId: config.default_persona_id,
    });
  } catch (err) {
    console.error('Failed to get Cato config:', err);
    return error('Failed to get configuration', 500);
  }
};

/**
 * PUT /admin/cato/config
 * Update tenant Cato configuration
 */
export const updateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');

    const result = await query(
      `INSERT INTO cato_tenant_config (
        tenant_id, gamma_max, emergency_threshold, sensory_floor,
        livelock_threshold, recovery_window_seconds, max_recovery_attempts,
        entropy_high_risk_threshold, entropy_low_risk_threshold,
        tile_size, retention_years,
        enable_semantic_entropy, enable_redundant_perception, enable_fracture_detection,
        default_persona_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (tenant_id) DO UPDATE SET
        gamma_max = EXCLUDED.gamma_max,
        emergency_threshold = EXCLUDED.emergency_threshold,
        sensory_floor = EXCLUDED.sensory_floor,
        livelock_threshold = EXCLUDED.livelock_threshold,
        recovery_window_seconds = EXCLUDED.recovery_window_seconds,
        max_recovery_attempts = EXCLUDED.max_recovery_attempts,
        entropy_high_risk_threshold = EXCLUDED.entropy_high_risk_threshold,
        entropy_low_risk_threshold = EXCLUDED.entropy_low_risk_threshold,
        tile_size = EXCLUDED.tile_size,
        retention_years = EXCLUDED.retention_years,
        enable_semantic_entropy = EXCLUDED.enable_semantic_entropy,
        enable_redundant_perception = EXCLUDED.enable_redundant_perception,
        enable_fracture_detection = EXCLUDED.enable_fracture_detection,
        default_persona_id = EXCLUDED.default_persona_id,
        updated_at = NOW()
      RETURNING *`,
      [
        tenantId,
        body.gammaMax ?? 5.0,
        body.emergencyThreshold ?? 0.5,
        body.sensoryFloor ?? 0.3,
        body.livelockThreshold ?? 3,
        body.recoveryWindowSeconds ?? 10,
        body.maxRecoveryAttempts ?? 3,
        body.entropyHighRiskThreshold ?? 0.8,
        body.entropyLowRiskThreshold ?? 0.3,
        body.tileSize ?? 1000,
        body.retentionYears ?? 7,
        body.enableSemanticEntropy ?? true,
        body.enableRedundantPerception ?? true,
        body.enableFractureDetection ?? true,
        body.defaultPersonaId ?? null,
      ]
    );

    return success(result.rows[0]);
  } catch (err) {
    console.error('Failed to update Cato config:', err);
    return error('Failed to update configuration', 500);
  }
};

/**
 * GET /admin/cato/dashboard
 * Get complete dashboard data
 */
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    const [metricsResult, effectivenessResult, escalationsResult, violationsResult, configResult] =
      await Promise.all([
        query(`SELECT * FROM get_cato_safety_metrics($1, INTERVAL '24 hours')`, [tenantId]),
        query(`SELECT * FROM get_recovery_effectiveness($1, INTERVAL '7 days')`, [tenantId]),
        query(
          `SELECT * FROM cato_human_escalations WHERE tenant_id = $1 AND status = 'PENDING' LIMIT 10`,
          [tenantId]
        ),
        query(
          `SELECT * FROM cato_cbf_violations WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT 10`,
          [tenantId]
        ),
        query(`SELECT * FROM cato_tenant_config WHERE tenant_id = $1`, [tenantId]),
      ]);

    // Convert metrics to object
    const metrics: Record<string, number> = {};
    for (const row of metricsResult.rows) {
      metrics[row.metric_name] = parseInt(row.metric_value);
    }

    return success({
      metrics,
      recoveryEffectiveness: effectivenessResult.rows,
      pendingEscalations: escalationsResult.rows,
      recentViolations: violationsResult.rows,
      config: configResult.rows[0] || null,
    });
  } catch (err) {
    console.error('Failed to get dashboard:', err);
    return error('Failed to get dashboard', 500);
  }
};

/**
 * GET /admin/cato/recovery
 * Get recovery events
 */
export const getRecoveryEvents: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const resolved = event.queryStringParameters?.resolved;

    let queryStr = `
      SELECT * FROM cato_epistemic_recovery 
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (resolved !== undefined) {
      queryStr += ` AND resolved = $${params.length + 1}`;
      params.push(resolved === 'true');
    }

    queryStr += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(queryStr, params);
    return success(result.rows);
  } catch (err) {
    console.error('Failed to get recovery events:', err);
    return error('Failed to get recovery events', 500);
  }
};

/**
 * POST /admin/cato/veto/activate
 * Manually activate a veto signal (admin action)
 */
export const activateVeto: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');
    const { signal, reason } = body;

    if (!signal) {
      return error('Signal type required', 400);
    }

    const validSignals = [
      'SYSTEM_OVERLOAD',
      'COMPLIANCE_VIOLATION',
      'ANOMALY_DETECTED',
      'TENANT_SUSPENDED',
      'MODEL_UNAVAILABLE',
    ];

    if (!validSignals.includes(signal)) {
      return error(`Invalid signal. Valid signals: ${validSignals.join(', ')}`, 400);
    }

    sensoryVetoService.activateVeto(tenantId, signal as any, reason || 'Admin action');

    return success({ message: `Veto signal ${signal} activated` });
  } catch (err) {
    console.error('Failed to activate veto:', err);
    return error('Failed to activate veto', 500);
  }
};

/**
 * POST /admin/cato/veto/deactivate
 * Manually deactivate a veto signal (admin action)
 */
export const deactivateVeto: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');
    const { signal } = body;

    if (!signal) {
      return error('Signal type required', 400);
    }

    sensoryVetoService.deactivateVeto(tenantId, signal);

    return success({ message: `Veto signal ${signal} deactivated` });
  } catch (err) {
    console.error('Failed to deactivate veto:', err);
    return error('Failed to deactivate veto', 500);
  }
};

/**
 * GET /admin/cato/veto/active
 * Get active veto signals
 */
export const getActiveVetos: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const vetos = sensoryVetoService.getActiveVetos(tenantId);
    return success(vetos);
  } catch (err) {
    console.error('Failed to get active vetos:', err);
    return error('Failed to get active vetos', 500);
  }
};

/**
 * GET /admin/cato/default-mood
 * Get tenant default mood setting
 */
export const getTenantDefaultMood: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    const result = await query(
      `SELECT default_mood FROM cato_tenant_config WHERE tenant_id = $1`,
      [tenantId]
    );

    const defaultMood = result.rows.length > 0 ? result.rows[0].default_mood || 'balanced' : 'balanced';

    // Get all available moods for selection
    const moodsResult = await query(
      `SELECT name, display_name, description FROM genesis_personas 
       WHERE scope = 'system' AND is_active = TRUE ORDER BY name`
    );

    return success({
      currentDefault: defaultMood,
      availableMoods: moodsResult.rows,
    });
  } catch (err) {
    console.error('Failed to get tenant default mood:', err);
    return error('Failed to get default mood', 500);
  }
};

/**
 * PUT /admin/cato/default-mood
 * Set tenant default mood
 */
export const setTenantDefaultMood: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');
    const { mood } = body;

    if (!mood) {
      return error('mood is required', 400);
    }

    const validMoods = ['balanced', 'scout', 'sage', 'spark', 'guide'];
    if (!validMoods.includes(mood)) {
      return error(`Invalid mood. Valid moods: ${validMoods.join(', ')}`, 400);
    }

    await query(
      `INSERT INTO cato_tenant_config (tenant_id, default_mood)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET default_mood = $2, updated_at = NOW()`,
      [tenantId, mood]
    );

    return success({ message: `Default mood set to ${mood}`, defaultMood: mood });
  } catch (err) {
    console.error('Failed to set tenant default mood:', err);
    return error('Failed to set default mood', 500);
  }
};

/**
 * POST /admin/cato/persona-override
 * Set API-level persona override for a session
 */
export const setApiPersonaOverride: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');
    const { sessionId, personaName, durationMinutes, reason } = body;

    if (!sessionId || !personaName) {
      return error('sessionId and personaName are required', 400);
    }

    const validMoods = ['balanced', 'scout', 'sage', 'spark', 'guide'];
    if (!validMoods.includes(personaName)) {
      return error(`Invalid personaName. Valid moods: ${validMoods.join(', ')}`, 400);
    }

    await personaService.setApiOverride({
      tenantId,
      sessionId,
      personaName,
      durationMinutes: durationMinutes || 60,
      reason,
      createdBy: userId,
    });

    return success({ 
      message: `Persona override set to ${personaName} for session ${sessionId}`,
      sessionId,
      personaName,
      expiresIn: `${durationMinutes || 60} minutes`,
    });
  } catch (err) {
    console.error('Failed to set persona override:', err);
    return error('Failed to set persona override', 500);
  }
};

/**
 * DELETE /admin/cato/persona-override
 * Clear API-level persona override for a session
 */
export const clearApiPersonaOverride: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const sessionId = event.queryStringParameters?.sessionId;

    if (!sessionId) {
      return error('sessionId query parameter is required', 400);
    }

    await personaService.clearApiOverride(tenantId, sessionId);

    return success({ message: `Persona override cleared for session ${sessionId}` });
  } catch (err) {
    console.error('Failed to clear persona override:', err);
    return error('Failed to clear persona override', 500);
  }
};

/**
 * GET /admin/cato/advanced-config
 * Get advanced Cato configuration (Redis, CloudWatch, Entropy, Fracture Detection)
 */
export const getAdvancedConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    const result = await query(
      `SELECT 
        enable_redis, redis_rejection_ttl_seconds, redis_persona_override_ttl_seconds, redis_recovery_state_ttl_seconds,
        enable_cloudwatch_veto_sync, cloudwatch_sync_interval_seconds, cloudwatch_alarm_mappings,
        enable_async_entropy, entropy_async_threshold, entropy_job_ttl_hours, entropy_max_concurrent_jobs,
        fracture_word_overlap_weight, fracture_intent_keyword_weight, fracture_sentiment_weight,
        fracture_topic_coherence_weight, fracture_completeness_weight, fracture_alignment_threshold, fracture_evasion_threshold,
        cbf_authorization_check_enabled, cbf_baa_verification_enabled, cbf_cost_alternative_enabled, cbf_max_cost_reduction_percent
       FROM cato_tenant_config WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      // Return defaults
      return success({
        redis: {
          enabled: true,
          rejectionTtlSeconds: 60,
          personaOverrideTtlSeconds: 300,
          recoveryStateTtlSeconds: 600,
          connected: catoStateService.isRedisConnected(),
        },
        cloudwatch: {
          enabled: true,
          syncIntervalSeconds: 60,
          customAlarmMappings: {},
        },
        asyncEntropy: {
          enabled: true,
          asyncThreshold: 0.6,
          jobTtlHours: 24,
          maxConcurrentJobs: 10,
        },
        fractureDetection: {
          weights: {
            wordOverlap: 0.20,
            intentKeyword: 0.25,
            sentiment: 0.15,
            topicCoherence: 0.20,
            completeness: 0.20,
          },
          alignmentThreshold: 0.40,
          evasionThreshold: 0.60,
        },
        controlBarrier: {
          authorizationCheckEnabled: true,
          baaVerificationEnabled: true,
          costAlternativeEnabled: true,
          maxCostReductionPercent: 50,
        },
      });
    }

    const config = result.rows[0];
    return success({
      redis: {
        enabled: config.enable_redis ?? true,
        rejectionTtlSeconds: config.redis_rejection_ttl_seconds ?? 60,
        personaOverrideTtlSeconds: config.redis_persona_override_ttl_seconds ?? 300,
        recoveryStateTtlSeconds: config.redis_recovery_state_ttl_seconds ?? 600,
        connected: catoStateService.isRedisConnected(),
      },
      cloudwatch: {
        enabled: config.enable_cloudwatch_veto_sync ?? true,
        syncIntervalSeconds: config.cloudwatch_sync_interval_seconds ?? 60,
        customAlarmMappings: config.cloudwatch_alarm_mappings ?? {},
      },
      asyncEntropy: {
        enabled: config.enable_async_entropy ?? true,
        asyncThreshold: parseFloat(config.entropy_async_threshold ?? 0.6),
        jobTtlHours: config.entropy_job_ttl_hours ?? 24,
        maxConcurrentJobs: config.entropy_max_concurrent_jobs ?? 10,
      },
      fractureDetection: {
        weights: {
          wordOverlap: parseFloat(config.fracture_word_overlap_weight ?? 0.20),
          intentKeyword: parseFloat(config.fracture_intent_keyword_weight ?? 0.25),
          sentiment: parseFloat(config.fracture_sentiment_weight ?? 0.15),
          topicCoherence: parseFloat(config.fracture_topic_coherence_weight ?? 0.20),
          completeness: parseFloat(config.fracture_completeness_weight ?? 0.20),
        },
        alignmentThreshold: parseFloat(config.fracture_alignment_threshold ?? 0.40),
        evasionThreshold: parseFloat(config.fracture_evasion_threshold ?? 0.60),
      },
      controlBarrier: {
        authorizationCheckEnabled: config.cbf_authorization_check_enabled ?? true,
        baaVerificationEnabled: config.cbf_baa_verification_enabled ?? true,
        costAlternativeEnabled: config.cbf_cost_alternative_enabled ?? true,
        maxCostReductionPercent: parseFloat(config.cbf_max_cost_reduction_percent ?? 50),
      },
    });
  } catch (err) {
    console.error('Failed to get advanced Cato config:', err);
    return error('Failed to get advanced configuration', 500);
  }
};

/**
 * PUT /admin/cato/advanced-config
 * Update advanced Cato configuration
 */
export const updateAdvancedConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');

    // Validate fracture weights sum to 1.0
    if (body.fractureDetection?.weights) {
      const weights = body.fractureDetection.weights;
      const sum = (weights.wordOverlap ?? 0.20) + (weights.intentKeyword ?? 0.25) +
                  (weights.sentiment ?? 0.15) + (weights.topicCoherence ?? 0.20) +
                  (weights.completeness ?? 0.20);
      if (Math.abs(sum - 1.0) > 0.01) {
        return error('Fracture detection weights must sum to 1.0', 400);
      }
    }

    const result = await query(
      `INSERT INTO cato_tenant_config (
        tenant_id,
        enable_redis, redis_rejection_ttl_seconds, redis_persona_override_ttl_seconds, redis_recovery_state_ttl_seconds,
        enable_cloudwatch_veto_sync, cloudwatch_sync_interval_seconds, cloudwatch_alarm_mappings,
        enable_async_entropy, entropy_async_threshold, entropy_job_ttl_hours, entropy_max_concurrent_jobs,
        fracture_word_overlap_weight, fracture_intent_keyword_weight, fracture_sentiment_weight,
        fracture_topic_coherence_weight, fracture_completeness_weight, fracture_alignment_threshold, fracture_evasion_threshold,
        cbf_authorization_check_enabled, cbf_baa_verification_enabled, cbf_cost_alternative_enabled, cbf_max_cost_reduction_percent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enable_redis = EXCLUDED.enable_redis,
        redis_rejection_ttl_seconds = EXCLUDED.redis_rejection_ttl_seconds,
        redis_persona_override_ttl_seconds = EXCLUDED.redis_persona_override_ttl_seconds,
        redis_recovery_state_ttl_seconds = EXCLUDED.redis_recovery_state_ttl_seconds,
        enable_cloudwatch_veto_sync = EXCLUDED.enable_cloudwatch_veto_sync,
        cloudwatch_sync_interval_seconds = EXCLUDED.cloudwatch_sync_interval_seconds,
        cloudwatch_alarm_mappings = EXCLUDED.cloudwatch_alarm_mappings,
        enable_async_entropy = EXCLUDED.enable_async_entropy,
        entropy_async_threshold = EXCLUDED.entropy_async_threshold,
        entropy_job_ttl_hours = EXCLUDED.entropy_job_ttl_hours,
        entropy_max_concurrent_jobs = EXCLUDED.entropy_max_concurrent_jobs,
        fracture_word_overlap_weight = EXCLUDED.fracture_word_overlap_weight,
        fracture_intent_keyword_weight = EXCLUDED.fracture_intent_keyword_weight,
        fracture_sentiment_weight = EXCLUDED.fracture_sentiment_weight,
        fracture_topic_coherence_weight = EXCLUDED.fracture_topic_coherence_weight,
        fracture_completeness_weight = EXCLUDED.fracture_completeness_weight,
        fracture_alignment_threshold = EXCLUDED.fracture_alignment_threshold,
        fracture_evasion_threshold = EXCLUDED.fracture_evasion_threshold,
        cbf_authorization_check_enabled = EXCLUDED.cbf_authorization_check_enabled,
        cbf_baa_verification_enabled = EXCLUDED.cbf_baa_verification_enabled,
        cbf_cost_alternative_enabled = EXCLUDED.cbf_cost_alternative_enabled,
        cbf_max_cost_reduction_percent = EXCLUDED.cbf_max_cost_reduction_percent,
        updated_at = NOW()
      RETURNING *`,
      [
        tenantId,
        body.redis?.enabled ?? true,
        body.redis?.rejectionTtlSeconds ?? 60,
        body.redis?.personaOverrideTtlSeconds ?? 300,
        body.redis?.recoveryStateTtlSeconds ?? 600,
        body.cloudwatch?.enabled ?? true,
        body.cloudwatch?.syncIntervalSeconds ?? 60,
        JSON.stringify(body.cloudwatch?.customAlarmMappings ?? {}),
        body.asyncEntropy?.enabled ?? true,
        body.asyncEntropy?.asyncThreshold ?? 0.6,
        body.asyncEntropy?.jobTtlHours ?? 24,
        body.asyncEntropy?.maxConcurrentJobs ?? 10,
        body.fractureDetection?.weights?.wordOverlap ?? 0.20,
        body.fractureDetection?.weights?.intentKeyword ?? 0.25,
        body.fractureDetection?.weights?.sentiment ?? 0.15,
        body.fractureDetection?.weights?.topicCoherence ?? 0.20,
        body.fractureDetection?.weights?.completeness ?? 0.20,
        body.fractureDetection?.alignmentThreshold ?? 0.40,
        body.fractureDetection?.evasionThreshold ?? 0.60,
        body.controlBarrier?.authorizationCheckEnabled ?? true,
        body.controlBarrier?.baaVerificationEnabled ?? true,
        body.controlBarrier?.costAlternativeEnabled ?? true,
        body.controlBarrier?.maxCostReductionPercent ?? 50,
      ]
    );

    return success({ message: 'Advanced configuration updated', config: result.rows[0] });
  } catch (err) {
    console.error('Failed to update advanced Cato config:', err);
    return error('Failed to update advanced configuration', 500);
  }
};

/**
 * GET /admin/cato/cloudwatch/mappings
 * Get CloudWatch alarm to veto signal mappings
 */
export const getCloudWatchMappings: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    const result = await query(
      `SELECT id, alarm_name, alarm_name_pattern, veto_signal, veto_severity, 
              is_enabled, auto_clear_on_ok, description, created_at, updated_at
       FROM cato_cloudwatch_alarm_mappings 
       WHERE tenant_id = $1
       ORDER BY alarm_name`,
      [tenantId]
    );

    return success(result.rows);
  } catch (err) {
    console.error('Failed to get CloudWatch mappings:', err);
    return error('Failed to get CloudWatch mappings', 500);
  }
};

/**
 * POST /admin/cato/cloudwatch/mappings
 * Create a new CloudWatch alarm mapping
 */
export const createCloudWatchMapping: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body || '{}');

    if (!body.alarmName || !body.vetoSignal || !body.vetoSeverity) {
      return error('alarmName, vetoSignal, and vetoSeverity are required', 400);
    }

    const validSignals = ['SYSTEM_OVERLOAD', 'DATA_BREACH_DETECTED', 'COMPLIANCE_VIOLATION', 
                          'ANOMALY_DETECTED', 'TENANT_SUSPENDED', 'MODEL_UNAVAILABLE'];
    if (!validSignals.includes(body.vetoSignal)) {
      return error(`Invalid vetoSignal. Valid signals: ${validSignals.join(', ')}`, 400);
    }

    const validSeverities = ['warning', 'critical', 'emergency'];
    if (!validSeverities.includes(body.vetoSeverity)) {
      return error(`Invalid vetoSeverity. Valid severities: ${validSeverities.join(', ')}`, 400);
    }

    const result = await query(
      `INSERT INTO cato_cloudwatch_alarm_mappings 
        (tenant_id, alarm_name, alarm_name_pattern, veto_signal, veto_severity, is_enabled, auto_clear_on_ok, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        body.alarmName,
        body.alarmNamePattern || null,
        body.vetoSignal,
        body.vetoSeverity,
        body.isEnabled ?? true,
        body.autoClearOnOk ?? true,
        body.description || null,
      ]
    );

    return success(result.rows[0], 201);
  } catch (err: any) {
    if (err.code === '23505') {
      return error('Alarm mapping already exists', 409);
    }
    console.error('Failed to create CloudWatch mapping:', err);
    return error('Failed to create CloudWatch mapping', 500);
  }
};

/**
 * PUT /admin/cato/cloudwatch/mappings/:id
 * Update a CloudWatch alarm mapping
 */
export const updateCloudWatchMapping: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const mappingId = event.pathParameters?.id;
    if (!mappingId) {
      return error('Mapping ID required', 400);
    }

    const body = JSON.parse(event.body || '{}');

    const result = await query(
      `UPDATE cato_cloudwatch_alarm_mappings SET
        alarm_name = COALESCE($3, alarm_name),
        alarm_name_pattern = COALESCE($4, alarm_name_pattern),
        veto_signal = COALESCE($5, veto_signal),
        veto_severity = COALESCE($6, veto_severity),
        is_enabled = COALESCE($7, is_enabled),
        auto_clear_on_ok = COALESCE($8, auto_clear_on_ok),
        description = COALESCE($9, description),
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [
        mappingId,
        tenantId,
        body.alarmName,
        body.alarmNamePattern,
        body.vetoSignal,
        body.vetoSeverity,
        body.isEnabled,
        body.autoClearOnOk,
        body.description,
      ]
    );

    if (result.rows.length === 0) {
      return error('Mapping not found', 404);
    }

    return success(result.rows[0]);
  } catch (err) {
    console.error('Failed to update CloudWatch mapping:', err);
    return error('Failed to update CloudWatch mapping', 500);
  }
};

/**
 * DELETE /admin/cato/cloudwatch/mappings/:id
 * Delete a CloudWatch alarm mapping
 */
export const deleteCloudWatchMapping: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const mappingId = event.pathParameters?.id;
    if (!mappingId) {
      return error('Mapping ID required', 400);
    }

    const result = await query(
      `DELETE FROM cato_cloudwatch_alarm_mappings WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [mappingId, tenantId]
    );

    if (result.rows.length === 0) {
      return error('Mapping not found', 404);
    }

    return success({ message: 'Mapping deleted' });
  } catch (err) {
    console.error('Failed to delete CloudWatch mapping:', err);
    return error('Failed to delete CloudWatch mapping', 500);
  }
};

/**
 * POST /admin/cato/cloudwatch/sync
 * Manually trigger CloudWatch sync
 */
export const triggerCloudWatchSync: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const startTime = Date.now();

    await sensoryVetoService.syncFromCloudWatch();

    // Log the sync
    await query(
      `INSERT INTO cato_cloudwatch_sync_log (tenant_id, sync_type, success, completed_at, duration_ms)
       VALUES ($1, 'manual', TRUE, NOW(), $2)`,
      [tenantId, Date.now() - startTime]
    );

    return success({ 
      message: 'CloudWatch sync completed',
      cloudwatchEnabled: sensoryVetoService.isCloudWatchEnabled(),
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('Failed to sync CloudWatch:', err);
    return error('Failed to sync CloudWatch', 500);
  }
};

/**
 * GET /admin/cato/entropy-jobs
 * Get async entropy job status
 */
export const getEntropyJobs: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const status = event.queryStringParameters?.status;
    const limit = parseInt(event.queryStringParameters?.limit || '50');

    let queryStr = `
      SELECT id, job_id, status, model, check_mode, 
             entropy_score, consistency, is_potential_deception,
             created_at, started_at, completed_at, error_message, retry_count
      FROM cato_entropy_jobs
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (status) {
      queryStr += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(queryStr, params);

    // Get summary counts
    const summaryResult = await query(
      `SELECT status, COUNT(*) as count
       FROM cato_entropy_jobs WHERE tenant_id = $1
       GROUP BY status`,
      [tenantId]
    );

    const summary: Record<string, number> = {};
    for (const row of summaryResult.rows) {
      summary[row.status] = parseInt(row.count);
    }

    return success({ jobs: result.rows, summary });
  } catch (err) {
    console.error('Failed to get entropy jobs:', err);
    return error('Failed to get entropy jobs', 500);
  }
};

/**
 * GET /admin/cato/system-status
 * Get overall Cato system status including Redis, CloudWatch, etc.
 */
export const getSystemStatus: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);

    // Get tenant config
    const configResult = await query(
      `SELECT * FROM cato_tenant_config WHERE tenant_id = $1`,
      [tenantId]
    );
    const config = configResult.rows[0];

    // Get recent sync logs
    const syncResult = await query(
      `SELECT sync_type, success, duration_ms, started_at 
       FROM cato_cloudwatch_sync_log 
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY started_at DESC LIMIT 5`,
      [tenantId]
    );

    // Get entropy job counts
    const entropyResult = await query(
      `SELECT status, COUNT(*) as count
       FROM cato_entropy_jobs WHERE tenant_id = $1
       GROUP BY status`,
      [tenantId]
    );

    const entropyJobCounts: Record<string, number> = {};
    for (const row of entropyResult.rows) {
      entropyJobCounts[row.status] = parseInt(row.count);
    }

    return success({
      redis: {
        connected: catoStateService.isRedisConnected(),
        enabled: config?.enable_redis ?? true,
      },
      cloudwatch: {
        enabled: config?.enable_cloudwatch_veto_sync ?? true,
        integrationActive: sensoryVetoService.isCloudWatchEnabled(),
        recentSyncs: syncResult.rows,
      },
      asyncEntropy: {
        enabled: config?.enable_async_entropy ?? true,
        jobCounts: entropyJobCounts,
      },
      activeVetos: sensoryVetoService.getActiveVetos(tenantId).length,
    });
  } catch (err) {
    console.error('Failed to get system status:', err);
    return error('Failed to get system status', 500);
  }
};

/**
 * Main handler - routes requests to appropriate functions
 */
export const handler: APIGatewayProxyHandler = async (event, context) => {
  const method = event.httpMethod;
  const pathParts = event.path.split('/').filter(Boolean);
  // pathParts: ['api', 'v2', 'admin', 'cato', ...]
  const resource = pathParts[4]; // First part after 'cato'
  const subResource = pathParts[5]; // Second part if exists
  const resourceId = pathParts[6]; // ID if exists

  try {
    // Dashboard
    if (resource === 'dashboard') {
      return getDashboard(event, context);
    }

    // Metrics
    if (resource === 'metrics') {
      return getMetrics(event, context);
    }

    // Recovery effectiveness
    if (resource === 'recovery-effectiveness') {
      return getRecoveryEffectiveness(event, context);
    }

    // Personas
    if (resource === 'personas') {
      if (method === 'GET' && !subResource) {
        return getPersonas(event, context);
      }
      if (method === 'GET' && subResource) {
        event.pathParameters = { id: subResource };
        return getPersona(event, context);
      }
      if (method === 'POST') {
        return createPersona(event, context);
      }
      if (method === 'PUT' && subResource) {
        event.pathParameters = { id: subResource };
        return updatePersona(event, context);
      }
    }

    // Escalations
    if (resource === 'escalations') {
      if (method === 'GET' && !subResource) {
        return getEscalations(event, context);
      }
      if (method === 'POST' && subResource && resourceId === 'respond') {
        event.pathParameters = { id: subResource };
        return respondToEscalation(event, context);
      }
    }

    // Audit trail
    if (resource === 'audit') {
      if (method === 'GET') {
        return getAuditTrail(event, context);
      }
      if (method === 'POST' && subResource === 'search') {
        return searchAuditTrail(event, context);
      }
      if (method === 'POST' && subResource === 'verify') {
        return verifyAuditChain(event, context);
      }
    }

    // CBF definitions and violations
    if (resource === 'cbf') {
      if (method === 'GET' && !subResource) {
        return getCBFDefinitions(event, context);
      }
      if (method === 'GET' && subResource === 'violations') {
        return getCBFViolations(event, context);
      }
    }

    // Configuration
    if (resource === 'config') {
      if (method === 'GET') {
        return getConfig(event, context);
      }
      if (method === 'PUT') {
        return updateConfig(event, context);
      }
    }

    // Recovery events
    if (resource === 'recovery') {
      return getRecoveryEvents(event, context);
    }

    // Veto management
    if (resource === 'veto') {
      if (method === 'GET' && subResource === 'active') {
        return getActiveVetos(event, context);
      }
      if (method === 'POST' && subResource === 'activate') {
        return activateVeto(event, context);
      }
      if (method === 'POST' && subResource === 'deactivate') {
        return deactivateVeto(event, context);
      }
    }

    // Advanced configuration
    if (resource === 'advanced-config') {
      if (method === 'GET') {
        return getAdvancedConfig(event, context);
      }
      if (method === 'PUT') {
        return updateAdvancedConfig(event, context);
      }
    }

    // CloudWatch integration
    if (resource === 'cloudwatch') {
      if (subResource === 'mappings') {
        if (method === 'GET' && !resourceId) {
          return getCloudWatchMappings(event, context);
        }
        if (method === 'POST' && !resourceId) {
          return createCloudWatchMapping(event, context);
        }
        if (method === 'PUT' && resourceId) {
          event.pathParameters = { id: resourceId };
          return updateCloudWatchMapping(event, context);
        }
        if (method === 'DELETE' && resourceId) {
          event.pathParameters = { id: resourceId };
          return deleteCloudWatchMapping(event, context);
        }
      }
      if (subResource === 'sync' && method === 'POST') {
        return triggerCloudWatchSync(event, context);
      }
    }

    // Entropy jobs
    if (resource === 'entropy-jobs') {
      if (method === 'GET') {
        return getEntropyJobs(event, context);
      }
    }

    // System status
    if (resource === 'system-status') {
      if (method === 'GET') {
        return getSystemStatus(event, context);
      }
    }

    // Tenant default mood
    if (resource === 'default-mood') {
      if (method === 'GET') {
        return getTenantDefaultMood(event, context);
      }
      if (method === 'PUT') {
        return setTenantDefaultMood(event, context);
      }
    }

    // API persona override (for sessions)
    if (resource === 'persona-override') {
      if (method === 'POST') {
        return setApiPersonaOverride(event, context);
      }
      if (method === 'DELETE') {
        return clearApiPersonaOverride(event, context);
      }
    }

    return error(`Cato route not found: ${method} ${event.path}`, 404);
  } catch (err) {
    console.error('Cato handler error:', err);
    return error('Internal server error', 500);
  }
};
