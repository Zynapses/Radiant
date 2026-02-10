/**
 * RADIANT Universal Cartridge System Admin API
 *
 * Manages .RADz cartridge lifecycle: upload, validate, install, uninstall,
 * stack reorder, resolution, Soft ROM export, target registry, and audit.
 *
 * All S3 operations go through cartridgeStorageManager — no direct S3 access.
 *
 * Routes (all admin-only):
 *   GET    /cartridge-system                         — List cartridges
 *   GET    /cartridge-system/:id                     — Get detail
 *   POST   /cartridge-system/upload                  — Get pre-signed upload URL
 *   POST   /cartridge-system/:id/validate            — Trigger validation
 *   POST   /cartridge-system/:id/install             — Install for tenant
 *   POST   /cartridge-system/:id/uninstall           — Uninstall
 *   GET    /cartridge-system/stack                   — Get current stack
 *   PUT    /cartridge-system/stack/reorder            — Reorder priorities
 *   GET    /cartridge-system/resolved                — Get resolved state
 *   POST   /cartridge-system/export-soft-rom          — Export Soft ROM
 *   GET    /cartridge-system/targets                  — List target registry
 *   POST   /cartridge-system/targets                  — Register new target (super_admin)
 *   GET    /cartridge-system/targets/:key/specs       — Get section specs
 *   GET    /cartridge-system/audit                    — Audit log
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { cartridgeStorageManager } from '../shared/services/cartridge-storage-manager.service';
import { executeStatement, stringParam } from '../shared/db/client';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const logger = createRegisteredLogger({
  serviceName: 'admin/cartridge-universal',
  category: 'audit',
  sourceType: 'lambda',
});

const sqs = new SQSClient({});

const VALIDATION_QUEUE_URL = process.env.CARTRIDGE_VALIDATION_QUEUE_URL || '';
const INSTALL_QUEUE_URL = process.env.CARTRIDGE_INSTALL_QUEUE_URL || '';
const RESOLUTION_QUEUE_URL = process.env.CARTRIDGE_RESOLUTION_QUEUE_URL || '';
const EXPORT_QUEUE_URL = process.env.CARTRIDGE_EXPORT_QUEUE_URL || '';

// ============================================================================
// Helpers
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const getTenantId = (event: APIGatewayProxyEvent): string =>
  event.headers['x-tenant-id'] || event.headers['X-Tenant-Id'] || '';

const getUserId = (event: APIGatewayProxyEvent): string =>
  (event.requestContext.authorizer as any)?.claims?.sub || 'system';

const isSuperAdmin = (event: APIGatewayProxyEvent): boolean =>
  (event.requestContext.authorizer as any)?.claims?.['custom:role'] === 'super_admin';

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  const method = event.httpMethod;
  const path = event.path;
  const pathParts = path.split('/').filter(Boolean);

  // Find the segment after 'cartridge-system'
  const csIndex = pathParts.indexOf('cartridge-system');
  const subPath = csIndex >= 0 ? pathParts.slice(csIndex + 1) : [];

  try {
    // GET /cartridge-system/stack
    if (method === 'GET' && subPath[0] === 'stack') {
      return await getCartridgeStack(event);
    }

    // PUT /cartridge-system/stack/reorder
    if (method === 'PUT' && subPath[0] === 'stack' && subPath[1] === 'reorder') {
      return await reorderStack(event);
    }

    // GET /cartridge-system/resolved
    if (method === 'GET' && subPath[0] === 'resolved') {
      return await getResolvedState(event);
    }

    // GET /cartridge-system/targets
    if (method === 'GET' && subPath[0] === 'targets' && !subPath[1]) {
      return await listTargets();
    }

    // GET /cartridge-system/targets/:key/specs
    if (method === 'GET' && subPath[0] === 'targets' && subPath[1] && subPath[2] === 'specs') {
      return await getTargetSpecs(subPath[1]);
    }

    // POST /cartridge-system/targets
    if (method === 'POST' && subPath[0] === 'targets' && !subPath[1]) {
      if (!isSuperAdmin(event)) {
        return respond(403, { error: 'Super admin required to register targets' });
      }
      return await registerTarget(event);
    }

    // GET /cartridge-system/audit
    if (method === 'GET' && subPath[0] === 'audit') {
      return await getAuditLog(event);
    }

    // POST /cartridge-system/upload
    if (method === 'POST' && subPath[0] === 'upload') {
      return await uploadCartridge(event);
    }

    // POST /cartridge-system/export-soft-rom
    if (method === 'POST' && subPath[0] === 'export-soft-rom') {
      return await exportSoftRom(event);
    }

    // GET /cartridge-system/:id (UUID pattern)
    if (method === 'GET' && subPath[0] && subPath[0].match(/^[a-f0-9-]{36}$/)) {
      return await getCartridgeDetail(event, subPath[0]);
    }

    // POST /cartridge-system/:id/validate
    if (method === 'POST' && subPath[0]?.match(/^[a-f0-9-]{36}$/) && subPath[1] === 'validate') {
      return await validateCartridge(event, subPath[0]);
    }

    // POST /cartridge-system/:id/install
    if (method === 'POST' && subPath[0]?.match(/^[a-f0-9-]{36}$/) && subPath[1] === 'install') {
      return await installCartridge(event, subPath[0]);
    }

    // POST /cartridge-system/:id/uninstall
    if (method === 'POST' && subPath[0]?.match(/^[a-f0-9-]{36}$/) && subPath[1] === 'uninstall') {
      return await uninstallCartridge(event, subPath[0]);
    }

    // GET /cartridge-system (list)
    if (method === 'GET' && (!subPath[0] || subPath[0] === '')) {
      return await listCartridges(event);
    }

    return respond(404, { error: 'Not found' });
  } catch (error) {
    logger.error('Cartridge system request failed', { method, path, error });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return respond(500, { error: message });
  }
}

// ============================================================================
// Handlers
// ============================================================================

async function listCartridges(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const params = event.queryStringParameters || {};

  let sql = `
    SELECT cu.*,
      (SELECT COUNT(*) FROM cartridge_installations ci
       WHERE ci.cartridge_id = cu.id AND ci.installation_status = 'active') as install_count
    FROM cartridge_universal cu
    WHERE (cu.tenant_id IS NULL OR cu.tenant_id = $1)
  `;
  const values: Array<{ name: string; value: { stringValue: string } }> = [
    stringParam('tenantId', tenantId),
  ];
  let idx = 2;

  if (params.type) {
    sql += ` AND cu.cartridge_type = $${idx++}`;
    values.push(stringParam('type', params.type));
  }
  if (params.target) {
    sql += ` AND $${idx++} = ANY(cu.targets)`;
    values.push(stringParam('target', params.target));
  }
  if (params.status) {
    sql += ` AND cu.status = $${idx++}`;
    values.push(stringParam('status', params.status));
  }

  sql += ` ORDER BY cu.updated_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  values.push(stringParam('limit', params.limit || '50'));
  values.push(stringParam('offset', params.offset || '0'));

  const result = await executeStatement(sql, values as any);
  return respond(200, { cartridges: result.rows || [], total: result.rows?.length || 0 });
}

async function uploadCartridge(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const userId = getUserId(event);
  const body = JSON.parse(event.body || '{}');

  if (!body.name || !body.display_name || !body.version || !body.cartridge_type || !body.targets?.length) {
    return respond(400, { error: 'name, display_name, version, cartridge_type, and targets are required' });
  }

  // Firmware requires super_admin
  if (body.cartridge_type === 'firmware' && !isSuperAdmin(event)) {
    return respond(403, { error: 'Only super admins can upload firmware cartridges' });
  }

  // Validate targets exist
  const targetCheck = await executeStatement(
    `SELECT service_key FROM cartridge_target_services WHERE service_key = ANY($1) AND is_active = TRUE`,
    [stringParam('targets', `{${body.targets.join(',')}}`)] as any
  );
  const foundTargets = ((targetCheck.rows || []) as any[]).map((r: any) => r.service_key);
  const missing = (body.targets as string[]).filter(t => !foundTargets.includes(t));
  if (missing.length > 0) {
    return respond(400, { error: `Unknown target services: ${missing.join(', ')}` });
  }

  // Generate pre-signed upload URL via storage manager
  const scope = (body.cartridge_type === 'base' || body.cartridge_type === 'domain') ? null : tenantId;
  const presigned = await cartridgeStorageManager.generateUploadUrl(scope, body.name, body.version);

  // Create record in uploaded status
  const insertResult = await executeStatement(
    `INSERT INTO cartridge_universal (
      tenant_id, cartridge_type, name, display_name, version,
      description, author_name, targets, sections_present,
      manifest, storage_ref, storage_bucket, total_size_bytes, checksum_sha256, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', '{}', $9, $10, 0, '', 'uploaded')
    RETURNING id`,
    [
      stringParam('tenantId', scope || ''),
      stringParam('type', body.cartridge_type),
      stringParam('name', body.name),
      stringParam('displayName', body.display_name),
      stringParam('version', body.version),
      stringParam('description', body.description || ''),
      stringParam('author', userId),
      stringParam('targets', `{${body.targets.join(',')}}`),
      stringParam('storageRef', presigned.storage_ref),
      stringParam('bucket', presigned.storage_bucket),
    ] as any
  );

  const cartridgeId = ((insertResult.rows || [])[0] as any)?.id;

  // Audit
  await executeStatement(
    `INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, actor_id, details, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      stringParam('tenantId', tenantId),
      stringParam('cartridgeId', cartridgeId),
      stringParam('action', 'upload_initiated'),
      stringParam('actorId', userId),
      stringParam('details', JSON.stringify({ name: body.name, version: body.version, targets: body.targets })),
    ] as any
  );

  return respond(201, {
    cartridge_id: cartridgeId,
    upload_url: presigned.url,
    storage_ref: presigned.storage_ref,
    expires_at: presigned.expires_at,
  });
}

async function validateCartridge(event: APIGatewayProxyEvent, cartridgeId: string): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);

  // Get cartridge record
  const result = await executeStatement(
    `SELECT * FROM cartridge_universal WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)`,
    [stringParam('id', cartridgeId), stringParam('tenantId', tenantId)] as any
  );
  if (!result.rows?.length) return respond(404, { error: 'Cartridge not found' });

  const cartridge = result.rows[0] as any;

  // Update status to validating
  await executeStatement(
    `UPDATE cartridge_universal SET status = 'validating', updated_at = NOW() WHERE id = $1`,
    [stringParam('id', cartridgeId)] as any
  );

  // Send to validation queue
  if (VALIDATION_QUEUE_URL) {
    await sqs.send(new SendMessageCommand({
      QueueUrl: VALIDATION_QUEUE_URL,
      MessageBody: JSON.stringify({
        cartridge_id: cartridgeId,
        storage_ref: cartridge.storage_ref,
        storage_bucket: cartridge.storage_bucket,
        targets: cartridge.targets,
        tenant_id: tenantId,
      }),
    }));
  }

  return respond(202, { message: 'Validation started', cartridge_id: cartridgeId });
}

async function installCartridge(event: APIGatewayProxyEvent, cartridgeId: string): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const userId = getUserId(event);
  const body = JSON.parse(event.body || '{}');

  // Verify cartridge exists and is validated
  const cartResult = await executeStatement(
    `SELECT * FROM cartridge_universal WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2) AND status IN ('validated', 'active')`,
    [stringParam('id', cartridgeId), stringParam('tenantId', tenantId)] as any
  );
  if (!cartResult.rows?.length) return respond(404, { error: 'Cartridge not found or not validated' });

  const cartridge = cartResult.rows[0] as any;

  // Determine stack priority (default: next available)
  let stackPriority = body.stack_priority;
  if (!stackPriority) {
    const maxResult = await executeStatement(
      `SELECT COALESCE(MAX(stack_priority), 0) + 10 as next_priority FROM cartridge_installations WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)] as any
    );
    stackPriority = ((maxResult.rows || [])[0] as any)?.next_priority || 10;
  }

  // Create installation record
  const installResult = await executeStatement(
    `INSERT INTO cartridge_installations (tenant_id, cartridge_id, stack_priority, installed_by, merge_strategy, configuration_overrides)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id, cartridge_id) DO UPDATE SET
       stack_priority = $3, installation_status = 'installing', merge_strategy = $5,
       configuration_overrides = $6, updated_at = NOW()
     RETURNING id`,
    [
      stringParam('tenantId', tenantId),
      stringParam('cartridgeId', cartridgeId),
      stringParam('priority', String(stackPriority)),
      stringParam('userId', userId),
      stringParam('mergeStrategy', body.merge_strategy || 'replace'),
      stringParam('overrides', JSON.stringify(body.configuration_overrides || null)),
    ] as any
  );

  const installationId = ((installResult.rows || [])[0] as any)?.id;

  // Send to install queue
  if (INSTALL_QUEUE_URL) {
    await sqs.send(new SendMessageCommand({
      QueueUrl: INSTALL_QUEUE_URL,
      MessageBody: JSON.stringify({
        installation_id: installationId,
        cartridge_id: cartridgeId,
        tenant_id: tenantId,
        storage_ref: cartridge.storage_ref,
        targets: cartridge.targets,
        merge_strategy: body.merge_strategy || 'replace',
      }),
    }));
  }

  // Audit
  await executeStatement(
    `INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, actor_id, details, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      stringParam('tenantId', tenantId),
      stringParam('cartridgeId', cartridgeId),
      stringParam('action', 'install_initiated'),
      stringParam('actorId', userId),
      stringParam('details', JSON.stringify({ stack_priority: stackPriority, merge_strategy: body.merge_strategy || 'replace' })),
    ] as any
  );

  return respond(202, { message: 'Installation started', installation_id: installationId, cartridge_id: cartridgeId });
}

async function uninstallCartridge(event: APIGatewayProxyEvent, cartridgeId: string): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const userId = getUserId(event);

  await executeStatement(
    `UPDATE cartridge_installations SET installation_status = 'uninstalling', updated_at = NOW()
     WHERE cartridge_id = $1 AND tenant_id = $2`,
    [stringParam('cartridgeId', cartridgeId), stringParam('tenantId', tenantId)] as any
  );

  // Trigger re-resolution
  if (RESOLUTION_QUEUE_URL) {
    await sqs.send(new SendMessageCommand({
      QueueUrl: RESOLUTION_QUEUE_URL,
      MessageBody: JSON.stringify({ tenant_id: tenantId, reason: 'cartridge_uninstall', cartridge_id: cartridgeId }),
    }));
  }

  // Actually remove the installation record
  await executeStatement(
    `DELETE FROM cartridge_installations WHERE cartridge_id = $1 AND tenant_id = $2`,
    [stringParam('cartridgeId', cartridgeId), stringParam('tenantId', tenantId)] as any
  );

  // Audit
  await executeStatement(
    `INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, actor_id, details, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      stringParam('tenantId', tenantId),
      stringParam('cartridgeId', cartridgeId),
      stringParam('action', 'uninstall_completed'),
      stringParam('actorId', userId),
      stringParam('details', '{}'),
    ] as any
  );

  return respond(200, { message: 'Cartridge uninstalled' });
}

async function getCartridgeStack(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);

  const result = await executeStatement(
    `SELECT ci.*, cu.name, cu.display_name, cu.version, cu.cartridge_type,
            cu.targets, cu.sections_present, cu.status as cartridge_status
     FROM cartridge_installations ci
     JOIN cartridge_universal cu ON cu.id = ci.cartridge_id
     WHERE ci.tenant_id = $1
     ORDER BY ci.stack_priority DESC`,
    [stringParam('tenantId', tenantId)] as any
  );

  return respond(200, { stack: result.rows || [] });
}

async function reorderStack(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const body = JSON.parse(event.body || '{}');

  if (!body.installations?.length) {
    return respond(400, { error: 'installations array required with installation_id and stack_priority' });
  }

  for (const item of body.installations) {
    await executeStatement(
      `UPDATE cartridge_installations SET stack_priority = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [
        stringParam('priority', String(item.stack_priority)),
        stringParam('installId', item.installation_id),
        stringParam('tenantId', tenantId),
      ] as any
    );
  }

  // Trigger re-resolution
  if (RESOLUTION_QUEUE_URL) {
    await sqs.send(new SendMessageCommand({
      QueueUrl: RESOLUTION_QUEUE_URL,
      MessageBody: JSON.stringify({ tenant_id: tenantId, reason: 'stack_reorder' }),
    }));
  }

  return respond(200, { message: 'Stack reordered. Resolution will update within 60 seconds.' });
}

async function getResolvedState(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);

  const result = await executeStatement(
    `SELECT * FROM cartridge_resolved_state WHERE tenant_id = $1`,
    [stringParam('tenantId', tenantId)] as any
  );

  if (!result.rows?.length) {
    return respond(200, { resolved: null, message: 'No resolution computed yet' });
  }

  return respond(200, { resolved: result.rows[0] });
}

async function exportSoftRom(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const userId = getUserId(event);

  if (EXPORT_QUEUE_URL) {
    await sqs.send(new SendMessageCommand({
      QueueUrl: EXPORT_QUEUE_URL,
      MessageBody: JSON.stringify({
        tenant_id: tenantId,
        export_type: 'soft_rom',
        requested_by: userId,
        include_cato_learned: true,
      }),
    }));
  }

  await executeStatement(
    `INSERT INTO cartridge_audit_log (tenant_id, action, actor_id, details, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [
      stringParam('tenantId', tenantId),
      stringParam('action', 'soft_rom_export_initiated'),
      stringParam('actorId', userId),
      stringParam('details', JSON.stringify({ include_cato_learned: true })),
    ] as any
  );

  return respond(202, { message: 'Soft ROM export started. You will be notified when the .RADz file is ready.' });
}

async function listTargets(): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM cartridge_target_services WHERE is_active = TRUE ORDER BY service_key`,
    [] as any
  );
  return respond(200, { targets: result.rows || [] });
}

async function getTargetSpecs(serviceKey: string): Promise<APIGatewayProxyResult> {
  const target = await executeStatement(
    `SELECT * FROM cartridge_target_services WHERE service_key = $1 AND is_active = TRUE`,
    [stringParam('key', serviceKey)] as any
  );
  if (!target.rows?.length) return respond(404, { error: `Target service '${serviceKey}' not found` });

  const specs = await executeStatement(
    `SELECT * FROM cartridge_target_section_specs WHERE target_service_id = $1 ORDER BY section_key`,
    [stringParam('targetId', String((target.rows[0] as any).id))] as any
  );

  return respond(200, { target: target.rows[0], sections: specs.rows || [] });
}

async function registerTarget(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  if (!body.service_key || !body.display_name) {
    return respond(400, { error: 'service_key and display_name are required' });
  }

  const result = await executeStatement(
    `INSERT INTO cartridge_target_services (service_key, display_name, description, required_sections, optional_sections, validation_rules, min_radiant_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      stringParam('key', body.service_key),
      stringParam('name', body.display_name),
      stringParam('desc', body.description || ''),
      stringParam('required', JSON.stringify(body.required_sections || [])),
      stringParam('optional', JSON.stringify(body.optional_sections || [])),
      stringParam('rules', JSON.stringify(body.validation_rules || {})),
      stringParam('minVersion', body.min_radiant_version || ''),
    ] as any
  );

  return respond(201, { target: (result.rows || [])[0] });
}

async function getCartridgeDetail(event: APIGatewayProxyEvent, cartridgeId: string): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);

  const result = await executeStatement(
    `SELECT * FROM cartridge_universal WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)`,
    [stringParam('id', cartridgeId), stringParam('tenantId', tenantId)] as any
  );

  if (!result.rows?.length) return respond(404, { error: 'Cartridge not found' });
  return respond(200, { cartridge: result.rows[0] });
}

async function getAuditLog(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const params = event.queryStringParameters || {};

  const result = await executeStatement(
    `SELECT cal.*, cu.name as cartridge_name, cu.version as cartridge_version
     FROM cartridge_audit_log cal
     LEFT JOIN cartridge_universal cu ON cu.id = cal.cartridge_id
     WHERE cal.tenant_id = $1
     ORDER BY cal.created_at DESC
     LIMIT $2`,
    [stringParam('tenantId', tenantId), stringParam('limit', params.limit || '100')] as any
  );

  return respond(200, { audit: result.rows || [] });
}
