// RADIANT v4.18.0 - OMEGA Quantum State Admin Handler
// Endpoints: state-summary, unitarity-health, helix-test

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const subPath = event.path.replace('/admin/omega/quantum', '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId;

  if (!tenantId) {
    return respond(401, { error: 'Unauthorized' });
  }

  try {
    if (method === 'GET' && subPath === '/state-summary') {
      return await stateSummary(event, tenantId);
    }
    if (method === 'GET' && subPath === '/unitarity-health') {
      return await unitarityHealth(event, tenantId);
    }
    if (method === 'POST' && subPath === '/helix-test') {
      return await helixTest(event, tenantId);
    }
    return respond(404, { error: 'Not found' });
  } catch (err: any) {
    console.error(`[OMEGA Quantum] ${err.message}`);
    return respond(500, { error: 'Internal server error' });
  }
}

/**
 * Get quantum state summary for a brain, including 24h measurement stats.
 */
async function stateSummary(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const brainId = event.queryStringParameters?.brain_id;
  if (!brainId) {
    return respond(400, { error: 'brain_id required' });
  }

  const brain = await executeStatement(
    `SELECT b.id, b.hilbert_dimension, b.last_norm_value, b.last_unitarity_check,
            b.unitarity_corrections_count, b.firmware_hash, b.active_firmware_id,
            f.status AS fw_status, f.hilbert_dimension AS fw_dim
     FROM omega_brains b
     LEFT JOIN omega_firmware f ON f.id = b.active_firmware_id
     WHERE b.id = $1 AND b.tenant_id = $2`,
    [brainId, tenantId]
  );

  if (brain.rows.length === 0) {
    return respond(404, { error: 'Brain not found' });
  }

  const mStats = await executeStatement(
    `SELECT COUNT(*) AS total,
            AVG(probability_measured) AS avg_prob,
            MAX(measured_at) AS last_at
     FROM omega_measurements
     WHERE brain_id = $1 AND tenant_id = $2
       AND measured_at > NOW() - INTERVAL '24 hours'`,
    [brainId, tenantId]
  );

  return respond(200, {
    brain: brain.rows[0],
    measurements_24h: mStats.rows[0]
  });
}

/**
 * Get unitarity health events and stats for a brain.
 */
async function unitarityHealth(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const brainId = event.queryStringParameters?.brain_id;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  if (!brainId) {
    return respond(400, { error: 'brain_id required' });
  }

  const events = await executeStatement(
    `SELECT event_type, measured_norm, deviation, action_taken, detected_at, cycle_number
     FROM omega_unitarity_events
     WHERE brain_id = $1 AND tenant_id = $2
     ORDER BY detected_at DESC
     LIMIT $3`,
    [brainId, tenantId, limit]
  );

  const stats = await executeStatement(
    `SELECT event_type, COUNT(*) AS count, AVG(deviation) AS avg_deviation
     FROM omega_unitarity_events
     WHERE brain_id = $1 AND tenant_id = $2
       AND detected_at > NOW() - INTERVAL '24 hours'
     GROUP BY event_type`,
    [brainId, tenantId]
  );

  const hasViolations = stats.rows.some(
    (s: any) => s.event_type === 'violation' && parseInt(String(s.count)) > 0
  );

  return respond(200, {
    events: events.rows,
    stats_24h: stats.rows,
    healthy: !hasViolations
  });
}

/**
 * Test a Helix rule against a test vector (admin dry-run).
 * Does not modify any brain state.
 */
async function helixTest(
  event: APIGatewayProxyEvent,
  _tenantId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { rule, test_vector } = body;

  if (!rule || !test_vector) {
    return respond(400, { error: 'rule and test_vector required' });
  }

  const {
    projectOutForbidden,
    dampenForbidden,
    stateNorm
  } = await import('../shared/services/omega/quantum-math.js');

  const toVec = (v: { real: number[]; imaginary: number[] }) => ({
    amplitudes: v.real.map((r: number, i: number) => ({
      real: r,
      imaginary: v.imaginary[i] || 0
    })),
    hilbertDimension: v.real.length,
    norm: 1.0
  });

  const forbiddenVec = toVec(rule.forbidden_state);
  const inputVec = toVec(test_vector);

  if (rule.interference_type === 'destructive') {
    const { safeState, overlap, projected } = projectOutForbidden(inputVec, forbiddenVec);
    return respond(200, {
      action: 'destructive',
      overlap,
      projected,
      safe_state_norm: stateNorm(safeState)
    });
  } else {
    const { dampenedState, overlap } = dampenForbidden(
      inputVec,
      forbiddenVec,
      rule.dampening_factor || 0.5
    );
    return respond(200, {
      action: 'dampening',
      overlap,
      dampened_state_norm: stateNorm(dampenedState)
    });
  }
}

function respond(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
