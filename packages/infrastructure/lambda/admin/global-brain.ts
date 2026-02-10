/**
 * RADIANT Global Brain — Admin API Handler
 *
 * Endpoints:
 *   GET  /admin/global-brain/enrollment         — Get enrollment status
 *   PUT  /admin/global-brain/enrollment         — Update enrollment + consent
 *   GET  /admin/global-brain/contributions      — View contribution history
 *   GET  /admin/global-brain/rounds             — List federated learning rounds
 *   POST /admin/global-brain/rounds             — Create new round (Forge)
 *   POST /admin/global-brain/rounds/:id/run     — Trigger averaging for a round
 *   GET  /admin/global-brain/pipeline           — List pipelines
 *   POST /admin/global-brain/pipeline           — Schedule new pipeline
 *   POST /admin/global-brain/pipeline/:id/run   — Trigger pipeline execution
 *   GET  /admin/global-brain/stats              — Global Brain statistics
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { runFederatedAveragingRound, createNewRound, getActiveRound } from '../shared/services/global-brain/federated-averaging.service';
import { generateBaseCartridge, schedulePipeline, getPipelineStatus } from '../shared/services/global-brain/cartridge-pipeline.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/global-brain',
  category: 'platform',
  sourceType: 'application',
});

function success(body: unknown): APIGatewayProxyResult {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: message }) };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const pathParts = event.path.replace(/^\/+|\/+$/g, '').split('/');
  // pathParts: ['admin', 'global-brain', ...]
  const subPath = pathParts.slice(2).join('/');

  logger.info('Global Brain admin request', { method, subPath });

  try {
    // GET /enrollment
    if (subPath === 'enrollment' && method === 'GET') {
      return await getEnrollment(event);
    }

    // PUT /enrollment
    if (subPath === 'enrollment' && method === 'PUT') {
      return await updateEnrollment(event);
    }

    // GET /contributions
    if (subPath === 'contributions' && method === 'GET') {
      return await getContributions(event);
    }

    // GET /rounds
    if (subPath === 'rounds' && method === 'GET') {
      return await listRounds();
    }

    // POST /rounds
    if (subPath === 'rounds' && method === 'POST') {
      return await createRound(event);
    }

    // POST /rounds/:id/run
    if (subPath.match(/^rounds\/[^/]+\/run$/) && method === 'POST') {
      const roundId = pathParts[4];
      return await triggerAveraging(roundId);
    }

    // GET /pipeline
    if (subPath === 'pipeline' && method === 'GET') {
      return await listPipelines();
    }

    // POST /pipeline
    if (subPath === 'pipeline' && method === 'POST') {
      return await createPipeline(event);
    }

    // POST /pipeline/:id/run
    if (subPath.match(/^pipeline\/[^/]+\/run$/) && method === 'POST') {
      const pipelineId = pathParts[4];
      return await triggerPipeline(pipelineId);
    }

    // GET /stats
    if (subPath === 'stats' && method === 'GET') {
      return await getStats();
    }

    return error(404, `Global Brain route not found: ${method} ${subPath}`);
  } catch (err: any) {
    logger.error('Global Brain admin error', { error: err.message, method, subPath });
    return error(500, err.message || 'Internal server error');
  }
}

// ============================================================================
// Enrollment
// ============================================================================

async function getEnrollment(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || event.queryStringParameters?.tenant_id;
  if (!tenantId) return error(400, 'tenant_id required');

  const result = await executeStatement(
    `SELECT * FROM global_brain_enrollment WHERE tenant_id = $1`,
    [stringParam('tenantId', tenantId)]
  );

  if (!result.rows || result.rows.length === 0) {
    return success({
      enrolled: false,
      privacy_config: null,
      data_consent: null,
    });
  }
  return success(result.rows[0]);
}

async function updateEnrollment(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || event.queryStringParameters?.tenant_id;
  if (!tenantId) return error(400, 'tenant_id required');

  const body = JSON.parse(event.body || '{}');
  const enrolled = body.enrolled ?? false;

  await executeStatement(
    `INSERT INTO global_brain_enrollment (tenant_id, enrolled, privacy_config, data_consent, enrolled_at)
     VALUES ($1, $2, COALESCE($3, '{
       "dp_epsilon": 8.0, "dp_delta": 1e-5, "dp_clip_norm": 1.0,
       "noise_multiplier": 1.1, "min_participation_rounds": 5, "gradient_retention_days": 30
     }'::jsonb), COALESCE($4, '{
       "allow_omega_gradients": true, "allow_cortex_metrics": true,
       "allow_cato_metadata": true, "allow_cross_domain": false, "phi_exclusion": true
     }'::jsonb), CASE WHEN $2 THEN NOW() ELSE NULL END)
     ON CONFLICT (tenant_id) DO UPDATE SET
       enrolled = $2,
       privacy_config = COALESCE($3, global_brain_enrollment.privacy_config),
       data_consent = COALESCE($4, global_brain_enrollment.data_consent),
       enrolled_at = CASE WHEN $2 AND NOT global_brain_enrollment.enrolled THEN NOW() ELSE global_brain_enrollment.enrolled_at END,
       updated_at = NOW()`,
    [
      stringParam('tenantId', tenantId),
      stringParam('enrolled', String(enrolled)),
      body.privacy_config ? stringParam('privacyConfig', JSON.stringify(body.privacy_config)) : stringParam('privacyConfig', ''),
      body.data_consent ? stringParam('dataConsent', JSON.stringify(body.data_consent)) : stringParam('dataConsent', ''),
    ]
  );

  logger.info('Global Brain enrollment updated', { tenantId, enrolled });
  return success({ message: enrolled ? 'Enrolled in Global Brain' : 'Unenrolled from Global Brain' });
}

// ============================================================================
// Contributions
// ============================================================================

async function getContributions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.headers['x-tenant-id'] || event.queryStringParameters?.tenant_id;
  if (!tenantId) return error(400, 'tenant_id required');

  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  const result = await executeStatement(
    `SELECT id, gradient_type, dream_cycle_id, round_id, size_bytes,
            dp_noise_applied, dp_epsilon_used, quality_score, status, uploaded_at
     FROM global_brain_gradients
     WHERE tenant_id = $1
     ORDER BY uploaded_at DESC
     LIMIT $2`,
    [stringParam('tenantId', tenantId), longParam('limit', limit)]
  );

  return success({ contributions: result.rows || [] });
}

// ============================================================================
// Rounds
// ============================================================================

async function listRounds(): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT id, round_number, round_type, status, target_participants,
            actual_participants, quality_metrics, started_at, completed_at
     FROM global_brain_rounds
     ORDER BY round_number DESC
     LIMIT 50`,
    []
  );
  return success({ rounds: result.rows || [] });
}

async function createRound(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const roundType = body.round_type || 'omega_qnode';
  const targetParticipants = body.target_participants || 10;

  const roundId = await createNewRound(roundType, targetParticipants);
  return success({ round_id: roundId, message: 'Round created' });
}

async function triggerAveraging(roundId: string): Promise<APIGatewayProxyResult> {
  const result = await runFederatedAveragingRound(roundId);
  return success(result);
}

// ============================================================================
// Pipeline
// ============================================================================

async function listPipelines(): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT id, pipeline_type, status, output_cartridge_id, target_version,
            progress, scheduled_for, started_at, completed_at
     FROM global_brain_cartridge_pipeline
     ORDER BY created_at DESC
     LIMIT 50`,
    []
  );
  return success({ pipelines: result.rows || [] });
}

async function createPipeline(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const pipelineType = body.pipeline_type || 'base';
  const inputRounds = body.input_rounds || [];
  const targetVersion = body.target_version;

  const pipelineId = await schedulePipeline(pipelineType, inputRounds, targetVersion);
  return success({ pipeline_id: pipelineId, message: 'Pipeline scheduled' });
}

async function triggerPipeline(pipelineId: string): Promise<APIGatewayProxyResult> {
  const result = await generateBaseCartridge(pipelineId);
  return success(result);
}

// ============================================================================
// Stats
// ============================================================================

async function getStats(): Promise<APIGatewayProxyResult> {
  const [enrollmentStats, gradientStats, roundStats, pipelineStats] = await Promise.all([
    executeStatement(
      `SELECT
        COUNT(*) FILTER (WHERE enrolled = TRUE) as enrolled_count,
        COUNT(*) as total_count,
        AVG(contribution_quality_score) FILTER (WHERE enrolled = TRUE) as avg_quality,
        SUM(total_contributions) as total_contributions
      FROM global_brain_enrollment`,
      []
    ),
    executeStatement(
      `SELECT
        COUNT(*) as total_gradients,
        COUNT(*) FILTER (WHERE status = 'uploaded') as pending,
        COUNT(*) FILTER (WHERE status = 'aggregated') as aggregated,
        SUM(size_bytes) as total_bytes,
        COUNT(DISTINCT tenant_id) as unique_contributors
      FROM global_brain_gradients
      WHERE uploaded_at > NOW() - INTERVAL '30 days'`,
      []
    ),
    executeStatement(
      `SELECT
        COUNT(*) as total_rounds,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'collecting') as active,
        AVG(actual_participants) FILTER (WHERE status = 'completed') as avg_participants
      FROM global_brain_rounds`,
      []
    ),
    executeStatement(
      `SELECT
        COUNT(*) as total_pipelines,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled
      FROM global_brain_cartridge_pipeline`,
      []
    ),
  ]);

  return success({
    enrollment: enrollmentStats.rows?.[0] || {},
    gradients: gradientStats.rows?.[0] || {},
    rounds: roundStats.rows?.[0] || {},
    pipelines: pipelineStats.rows?.[0] || {},
  });
}
