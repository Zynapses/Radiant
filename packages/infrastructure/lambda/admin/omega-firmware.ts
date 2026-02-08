// RADIANT v4.18.0 - OMEGA Firmware Admin Handler
// Endpoints: activate (2-person rule), revert, status

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import * as crypto from 'crypto';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const subPath = event.path.replace('/admin/omega/firmware', '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId;
  const userId = event.requestContext.authorizer?.userId;

  if (!tenantId || !userId) {
    return respond(401, { error: 'Unauthorized' });
  }

  try {
    if (method === 'POST' && subPath === '/activate') {
      return await activate(event, tenantId, userId);
    }
    if (method === 'POST' && subPath === '/revert') {
      return await revert(event, tenantId);
    }
    if (method === 'GET' && subPath === '/status') {
      return await status(event, tenantId);
    }
    return respond(404, { error: 'Not found' });
  } catch (err: any) {
    console.error(`[OMEGA Firmware] ${err.message}`);
    return respond(500, { error: 'Internal server error' });
  }
}

/**
 * Activate firmware on a brain.
 *
 * Enforces:
 * - 2-person rule: the activator must differ from the signer
 * - Content hash integrity: recomputes hash and compares to stored
 * - Supersedes currently active firmware
 * - Updates brain.firmware_hash to trigger hot-swap on next inference
 */
async function activate(
  event: APIGatewayProxyEvent,
  tenantId: string,
  activatorId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { firmware_id, brain_id } = body;

  if (!firmware_id || !brain_id) {
    return respond(400, { error: 'firmware_id and brain_id required' });
  }

  // Fetch firmware record
  const fwResult = await executeStatement(
    `SELECT id, signed_by, is_verified, status, content_hash
     FROM omega_firmware
     WHERE id = $1 AND tenant_id = $2`,
    [firmware_id, tenantId]
  );

  if (fwResult.rows.length === 0) {
    return respond(404, { error: 'Firmware not found' });
  }

  const fw = fwResult.rows[0];

  if (fw.status === 'revoked') {
    return respond(400, { error: 'Cannot activate revoked firmware' });
  }

  // 2-person rule: activator cannot be the signer
  if (fw.signed_by === activatorId) {
    return respond(403, {
      error: '2-person rule: activator cannot be the signer',
      signed_by: fw.signed_by,
      activator: activatorId
    });
  }

  // Recompute content hash for integrity verification
  const fwContent = await executeStatement(
    `SELECT quantum, ambition, personality, helix_rules_snapshot
     FROM omega_firmware WHERE id = $1`,
    [firmware_id]
  );
  const computedHash = crypto
    .createHash('sha512')
    .update(JSON.stringify(fwContent.rows[0]))
    .digest('hex');

  if (fw.content_hash && fw.content_hash !== computedHash) {
    return respond(400, { error: 'Content hash mismatch — possible tampering' });
  }

  // Supersede currently active firmware for this brain
  await executeStatement(
    `UPDATE omega_firmware
     SET status = 'superseded', superseded_by = $1, updated_at = NOW()
     WHERE id = (SELECT active_firmware_id FROM omega_brains WHERE id = $2 AND tenant_id = $3)
       AND status = 'active'`,
    [firmware_id, brain_id, tenantId]
  );

  // Activate the new firmware
  await executeStatement(
    `UPDATE omega_firmware
     SET status = 'active', is_verified = true, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [firmware_id, tenantId]
  );

  // Update brain's firmware_hash — triggers hot-swap on next inference
  await executeStatement(
    `UPDATE omega_brains
     SET active_firmware_id = $1, firmware_hash = $2, updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4`,
    [firmware_id, computedHash, brain_id, tenantId]
  );

  return respond(200, {
    success: true,
    firmware_id,
    brain_id,
    content_hash: computedHash,
    message: 'Firmware activated. Hot-swap will occur on next inference cycle.'
  });
}

/**
 * Revert brain to previously superseded firmware.
 */
async function revert(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { brain_id } = body;

  if (!brain_id) {
    return respond(400, { error: 'brain_id required' });
  }

  // Find the most recently superseded firmware for this brain
  const result = await executeStatement(
    `SELECT f_prev.id AS prev_id, f_prev.content_hash AS prev_hash
     FROM omega_brains b
     JOIN omega_firmware f_cur ON f_cur.id = b.active_firmware_id
     JOIN omega_firmware f_prev ON f_prev.status = 'superseded'
       AND f_prev.superseded_by = f_cur.id
     WHERE b.id = $1 AND b.tenant_id = $2
     ORDER BY f_prev.updated_at DESC
     LIMIT 1`,
    [brain_id, tenantId]
  );

  if (result.rows.length === 0) {
    return respond(404, { error: 'No previous firmware to revert to' });
  }

  const prev = result.rows[0];

  // Re-activate the previous firmware
  await executeStatement(
    `UPDATE omega_firmware
     SET status = 'active', superseded_by = NULL, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [prev.prev_id, tenantId]
  );

  // Supersede current firmware
  await executeStatement(
    `UPDATE omega_firmware
     SET status = 'superseded', updated_at = NOW()
     WHERE id = (SELECT active_firmware_id FROM omega_brains WHERE id = $1 AND tenant_id = $2)`,
    [brain_id, tenantId]
  );

  // Update brain pointer to trigger hot-swap
  await executeStatement(
    `UPDATE omega_brains
     SET active_firmware_id = $1, firmware_hash = $2, updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4`,
    [prev.prev_id, prev.prev_hash, brain_id, tenantId]
  );

  return respond(200, {
    success: true,
    reverted_to: prev.prev_id,
    brain_id
  });
}

/**
 * Get firmware status for a brain.
 */
async function status(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const brainId = event.queryStringParameters?.brain_id;
  if (!brainId) {
    return respond(400, { error: 'brain_id query param required' });
  }

  const result = await executeStatement(
    `SELECT b.id AS brain_id, b.firmware_hash, b.active_firmware_id, b.hilbert_dimension,
            b.last_norm_value, b.unitarity_corrections_count,
            f.status AS fw_status, f.content_hash, f.is_verified, f.signed_by,
            f.created_at AS fw_created_at, f.quantum, f.hilbert_dimension AS fw_hilbert_dim,
            f.unitarity_mode
     FROM omega_brains b
     LEFT JOIN omega_firmware f ON f.id = b.active_firmware_id
     WHERE b.id = $1 AND b.tenant_id = $2`,
    [brainId, tenantId]
  );

  if (result.rows.length === 0) {
    return respond(404, { error: 'Brain not found' });
  }

  return respond(200, result.rows[0]);
}

function respond(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
