/**
 * RADIANT Tenant Cartridge Management API
 *
 * Tenant-scoped cartridge operations for Think Tank Tenant Administration.
 * All operations are automatically tenant-isolated via RLS and auth context.
 *
 * Cartridge Stacking Hierarchy (highest priority first):
 *   1. Soft ROM (brain's own learning) — additive deltas on top
 *   2. Tenant cartridge — REPLACES matching sections from lower layers
 *   3. Domain cartridge — fills gaps not covered by tenant
 *   4. Base cartridge — foundation, fills remaining gaps
 *   5. Firmware — safety floor, enforced via min() (NEVER loosened)
 *
 * When a tenant installs/uninstalls/reorders cartridges:
 *   1. Resolution engine re-computes effective stack
 *   2. EventBridge event triggers OMEGA brain cartridge reload
 *
 * Routes (all tenant-scoped):
 *   GET    /tenant/cartridges                    — List tenant + system cartridges
 *   GET    /tenant/cartridges/:id                — Get cartridge detail
 *   POST   /tenant/cartridges/install            — Install a cartridge for this tenant
 *   POST   /tenant/cartridges/uninstall          — Uninstall a cartridge
 *   GET    /tenant/cartridges/stack              — Get current stacking order
 *   PUT    /tenant/cartridges/stack/reorder      — Reorder tenant cartridge priorities
 *   GET    /tenant/cartridges/resolved           — Get resolved state after stacking
 *   POST   /tenant/cartridges/resolve            — Trigger re-resolution manually
 *   GET    /tenant/cartridges/omega/status       — Get OMEGA brain cartridge status
 *   POST   /tenant/cartridges/omega/reload       — Trigger OMEGA brain cartridge reload
 *   GET    /tenant/cartridges/audit              — Tenant-scoped audit log
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { executeStatement, stringParam } from '../shared/db/client';
import { resolveAndPersist } from '../shared/cartridge/resolution';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const logger = createRegisteredLogger({
  serviceName: 'tenant/cartridge-management',
  category: 'audit',
  sourceType: 'lambda',
});

const eventBridge = new EventBridgeClient({});
const sqs = new SQSClient({});

const RESOLUTION_QUEUE_URL = process.env.CARTRIDGE_RESOLUTION_QUEUE_URL || '';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'radiant-events';

// ============================================================================
// Helpers
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

function extractTenantContext(event: APIGatewayProxyEvent): { tenantId: string; userId: string } {
  const claims = (event.requestContext.authorizer as any)?.claims || {};
  const tenantId = claims['custom:tenantId'] || claims['custom:tenant_id'] ||
    event.headers['x-tenant-id'] || event.headers['X-Tenant-Id'] || '';
  const userId = claims.sub || claims['cognito:username'] || 'unknown';

  if (!tenantId) {
    throw new Error('TENANT_REQUIRED');
  }

  return { tenantId, userId };
}

function isTenantAdmin(event: APIGatewayProxyEvent): boolean {
  const claims = (event.requestContext.authorizer as any)?.claims || {};
  const role = claims['custom:role'] || '';
  const groups = claims['cognito:groups'] || [];
  return role === 'tenant_admin' || groups.includes('TenantAdmin') || groups.includes('tenant_admin');
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  try {
    const { tenantId, userId } = extractTenantContext(event);

    if (!isTenantAdmin(event)) {
      return respond(403, {
        error: 'TENANT_ADMIN_REQUIRED',
        message: 'Cartridge management requires tenant_admin role.',
      });
    }

    const method = event.httpMethod;
    const path = event.path;
    const pathParts = path.split('/').filter(Boolean);
    const cartridgesIdx = pathParts.indexOf('cartridges');
    const subPath = cartridgesIdx >= 0 ? pathParts.slice(cartridgesIdx + 1) : [];

    // GET /tenant/cartridges/stack
    if (method === 'GET' && subPath[0] === 'stack') {
      return await getStack(tenantId);
    }

    // PUT /tenant/cartridges/stack/reorder
    if (method === 'PUT' && subPath[0] === 'stack' && subPath[1] === 'reorder') {
      return await reorderStack(tenantId, userId, event);
    }

    // GET /tenant/cartridges/resolved
    if (method === 'GET' && subPath[0] === 'resolved') {
      return await getResolvedState(tenantId);
    }

    // POST /tenant/cartridges/resolve
    if (method === 'POST' && subPath[0] === 'resolve') {
      return await triggerResolution(tenantId, userId);
    }

    // GET /tenant/cartridges/omega/status
    if (method === 'GET' && subPath[0] === 'omega' && subPath[1] === 'status') {
      return await getOmegaStatus(tenantId);
    }

    // POST /tenant/cartridges/omega/reload
    if (method === 'POST' && subPath[0] === 'omega' && subPath[1] === 'reload') {
      return await triggerOmegaReload(tenantId, userId);
    }

    // GET /tenant/cartridges/audit
    if (method === 'GET' && subPath[0] === 'audit') {
      return await getAuditLog(tenantId, event);
    }

    // POST /tenant/cartridges/install
    if (method === 'POST' && subPath[0] === 'install') {
      return await installCartridge(tenantId, userId, event);
    }

    // POST /tenant/cartridges/uninstall
    if (method === 'POST' && subPath[0] === 'uninstall') {
      return await uninstallCartridge(tenantId, userId, event);
    }

    // GET /tenant/cartridges/:id (UUID)
    if (method === 'GET' && subPath[0]?.match(/^[a-f0-9-]{36}$/)) {
      return await getCartridgeDetail(tenantId, subPath[0]);
    }

    // GET /tenant/cartridges (list)
    if (method === 'GET' && (!subPath[0] || subPath[0] === '')) {
      return await listCartridges(tenantId, event);
    }

    return respond(404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof Error && error.message === 'TENANT_REQUIRED') {
      return respond(401, { error: 'Tenant context required' });
    }
    logger.error('Tenant cartridge management request failed', { error });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return respond(500, { error: message });
  }
}

// ============================================================================
// Handlers
// ============================================================================

async function listCartridges(
  tenantId: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};

  // List cartridges visible to this tenant: their own + system-wide (tenant_id IS NULL)
  const result = await executeStatement(
    `SELECT cu.*,
       ci.stack_priority,
       ci.installation_status,
       ci.installed_at
     FROM cartridge_universal cu
     LEFT JOIN cartridge_installations ci
       ON ci.cartridge_id = cu.id AND ci.tenant_id = $1
     WHERE (cu.tenant_id IS NULL OR cu.tenant_id = $1)
       AND cu.status IN ('validated', 'active')
     ORDER BY COALESCE(ci.stack_priority, 0) DESC, cu.updated_at DESC
     LIMIT $2 OFFSET $3`,
    [
      stringParam('tenantId', tenantId),
      stringParam('limit', params.limit || '100'),
      stringParam('offset', params.offset || '0'),
    ] as any,
  );

  const rows = (result.rows || []) as any[];

  const systemCartridges = rows.filter((r: any) => !r.tenant_id);
  const tenantCartridges = rows.filter((r: any) => r.tenant_id === tenantId);

  return respond(200, {
    cartridges: tenantCartridges,
    systemCartridges,
    total: rows.length,
  });
}

async function getCartridgeDetail(
  tenantId: string,
  cartridgeId: string,
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT cu.*,
       ci.stack_priority,
       ci.installation_status,
       ci.installed_at
     FROM cartridge_universal cu
     LEFT JOIN cartridge_installations ci
       ON ci.cartridge_id = cu.id AND ci.tenant_id = $2
     WHERE cu.id = $1 AND (cu.tenant_id IS NULL OR cu.tenant_id = $2)`,
    [stringParam('id', cartridgeId), stringParam('tenantId', tenantId)] as any,
  );

  if (!result.rows?.length) {
    return respond(404, { error: 'Cartridge not found' });
  }

  return respond(200, { cartridge: result.rows[0] });
}

async function installCartridge(
  tenantId: string,
  userId: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { cartridgeId, stackPriority } = body;

  if (!cartridgeId) {
    return respond(400, { error: 'cartridgeId is required' });
  }

  // Verify cartridge exists and is accessible
  const cartCheck = await executeStatement(
    `SELECT id, name, cartridge_type, sections_present FROM cartridge_universal
     WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2) AND status IN ('validated', 'active')`,
    [stringParam('id', cartridgeId), stringParam('tenantId', tenantId)] as any,
  );

  if (!cartCheck.rows?.length) {
    return respond(404, { error: 'Cartridge not found or not accessible' });
  }

  const cartridge = cartCheck.rows[0] as any;

  // Firmware cartridges cannot be installed by tenants
  if (cartridge.cartridge_type === 'firmware') {
    return respond(403, {
      error: 'FIRMWARE_RESTRICTED',
      message: 'Firmware cartridges can only be installed by platform administrators.',
    });
  }

  // Calculate priority: tenant cartridges start at 100+, system stays below 100
  const priorityResult = await executeStatement(
    `SELECT COALESCE(MAX(stack_priority), 99) + 1 as next_priority
     FROM cartridge_installations
     WHERE tenant_id = $1 AND installation_status = 'active'`,
    [stringParam('tenantId', tenantId)] as any,
  );
  const priority = stackPriority || ((priorityResult.rows || [])[0] as any)?.next_priority || 100;

  // Install
  const installResult = await executeStatement(
    `INSERT INTO cartridge_installations (tenant_id, cartridge_id, stack_priority, installed_by, installation_status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (tenant_id, cartridge_id)
     DO UPDATE SET stack_priority = $3, installation_status = 'active', installed_by = $4, installed_at = NOW()
     RETURNING *`,
    [
      stringParam('tenantId', tenantId),
      stringParam('cartridgeId', cartridgeId),
      stringParam('priority', String(priority)),
      stringParam('userId', userId),
    ] as any,
  );

  // Audit
  await writeAudit(tenantId, cartridgeId, 'install', userId, {
    cartridgeName: cartridge.name,
    stackPriority: priority,
  });

  // Trigger resolution + OMEGA reload
  await triggerResolutionAndReload(tenantId, userId, 'install');

  return respond(201, {
    installation: (installResult.rows || [])[0],
    message: `Cartridge '${cartridge.name}' installed at priority ${priority}. Resolution triggered.`,
  });
}

async function uninstallCartridge(
  tenantId: string,
  userId: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { cartridgeId } = body;

  if (!cartridgeId) {
    return respond(400, { error: 'cartridgeId is required' });
  }

  // Verify it's a tenant installation (not system)
  const check = await executeStatement(
    `SELECT ci.*, cu.name, cu.cartridge_type FROM cartridge_installations ci
     JOIN cartridge_universal cu ON cu.id = ci.cartridge_id
     WHERE ci.tenant_id = $1 AND ci.cartridge_id = $2 AND ci.installation_status = 'active'`,
    [stringParam('tenantId', tenantId), stringParam('cartridgeId', cartridgeId)] as any,
  );

  if (!check.rows?.length) {
    return respond(404, { error: 'Active installation not found' });
  }

  const installation = check.rows[0] as any;

  // System cartridges cannot be uninstalled by tenants
  if (installation.cartridge_type === 'base' || installation.cartridge_type === 'firmware') {
    return respond(403, {
      error: 'SYSTEM_CARTRIDGE',
      message: 'System and firmware cartridges cannot be uninstalled by tenant administrators.',
    });
  }

  // Deactivate
  await executeStatement(
    `UPDATE cartridge_installations SET installation_status = 'uninstalled', installed_at = NOW()
     WHERE tenant_id = $1 AND cartridge_id = $2`,
    [stringParam('tenantId', tenantId), stringParam('cartridgeId', cartridgeId)] as any,
  );

  // Audit
  await writeAudit(tenantId, cartridgeId, 'uninstall', userId, {
    cartridgeName: installation.name,
  });

  // Trigger resolution + OMEGA reload
  await triggerResolutionAndReload(tenantId, userId, 'uninstall');

  return respond(200, {
    message: `Cartridge '${installation.name}' uninstalled. Resolution triggered.`,
  });
}

async function getStack(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT ci.*, cu.name, cu.display_name, cu.cartridge_type, cu.version, cu.description,
       cu.sections_present, cu.targets, cu.total_size_bytes, cu.tenant_id as cartridge_tenant_id
     FROM cartridge_installations ci
     JOIN cartridge_universal cu ON cu.id = ci.cartridge_id
     WHERE ci.tenant_id = $1 AND ci.installation_status = 'active'
     ORDER BY ci.stack_priority DESC`,
    [stringParam('tenantId', tenantId)] as any,
  );

  const rows = (result.rows || []) as any[];

  // Separate system vs tenant cartridges in the stack
  const systemStack = rows.filter((r: any) => !r.cartridge_tenant_id);
  const tenantStack = rows.filter((r: any) => r.cartridge_tenant_id === tenantId);

  return respond(200, {
    stack: {
      systemStack: systemStack.map(mapStackEntry),
      tenantStack: tenantStack.map(mapStackEntry),
      totalEntries: rows.length,
    },
    hierarchy: [
      { layer: 'Soft ROM', description: 'Brain\'s own learning (additive deltas)', editable: false },
      { layer: 'Tenant Cartridges', description: 'Your organization\'s cartridges (REPLACE lower layers)', editable: true },
      { layer: 'Domain Cartridges', description: 'Industry-specific (fills gaps)', editable: false },
      { layer: 'Base Cartridges', description: 'Platform foundation', editable: false },
      { layer: 'Firmware', description: 'Safety floor — min() enforcement (NEVER loosened)', editable: false },
    ],
  });
}

async function reorderStack(
  tenantId: string,
  userId: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { order } = body;

  if (!Array.isArray(order) || order.length === 0) {
    return respond(400, { error: 'order array required: [{ cartridgeId, priority }]' });
  }

  // Only allow reordering tenant cartridges (not system)
  for (const item of order) {
    const check = await executeStatement(
      `SELECT cu.cartridge_type FROM cartridge_installations ci
       JOIN cartridge_universal cu ON cu.id = ci.cartridge_id
       WHERE ci.tenant_id = $1 AND ci.cartridge_id = $2 AND ci.installation_status = 'active'`,
      [stringParam('tenantId', tenantId), stringParam('cartridgeId', item.cartridgeId)] as any,
    );

    const row = (check.rows || [])[0] as any;
    if (!row) {
      return respond(404, { error: `Cartridge ${item.cartridgeId} not found in your stack` });
    }
    if (row.cartridge_type === 'base' || row.cartridge_type === 'firmware') {
      return respond(403, { error: 'Cannot reorder system/firmware cartridges' });
    }
  }

  // Apply new priorities
  for (const item of order) {
    await executeStatement(
      `UPDATE cartridge_installations SET stack_priority = $3
       WHERE tenant_id = $1 AND cartridge_id = $2 AND installation_status = 'active'`,
      [
        stringParam('tenantId', tenantId),
        stringParam('cartridgeId', item.cartridgeId),
        stringParam('priority', String(item.priority)),
      ] as any,
    );
  }

  // Audit
  await writeAudit(tenantId, 'stack', 'reorder', userId, { order });

  // Trigger resolution + OMEGA reload
  await triggerResolutionAndReload(tenantId, userId, 'reorder');

  return respond(200, { message: 'Stack reordered. Resolution triggered.' });
}

async function getResolvedState(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM cartridge_resolved_state WHERE tenant_id = $1`,
    [stringParam('tenantId', tenantId)] as any,
  );

  if (!result.rows?.length) {
    return respond(200, {
      resolved: null,
      message: 'No resolved state yet. Install a cartridge or trigger resolution.',
    });
  }

  const row = result.rows[0] as any;

  return respond(200, {
    resolved: {
      firmware: typeof row.resolved_firmware === 'string'
        ? JSON.parse(row.resolved_firmware) : row.resolved_firmware,
      sections: typeof row.resolved_sections === 'string'
        ? JSON.parse(row.resolved_sections) : row.resolved_sections,
      resolutionLog: typeof row.resolution_log === 'string'
        ? JSON.parse(row.resolution_log) : row.resolution_log,
      resolvedAt: row.resolved_at,
    },
  });
}

async function triggerResolution(
  tenantId: string,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const resolved = await resolveAndPersist(tenantId);

  await writeAudit(tenantId, 'resolution', 'manual_resolve', userId, {
    sectionsResolved: Object.keys(resolved.section_sources).length,
  });

  return respond(200, {
    resolved: {
      firmware: resolved.effective_firmware,
      sections: resolved.section_sources,
      resolutionLog: resolved.resolution_log,
      resolvedAt: resolved.resolved_at,
    },
    message: 'Resolution completed successfully.',
  });
}

async function getOmegaStatus(tenantId: string): Promise<APIGatewayProxyResult> {
  // Query the OMEGA brain state for this tenant from the quantum brain checkpoint table
  const result = await executeStatement(
    `SELECT
       qbc.brain_id,
       qbc.tenant_id,
       qbc.hilbert_dimension,
       qbc.dopamine,
       qbc.total_cycles,
       qbc.loaded_firmware_id,
       qbc.helix_rule_count,
       qbc.cartridge_boot_status,
       qbc.cartridge_boot_duration_ms,
       qbc.firmware_enforcement_count,
       qbc.soft_rom_version,
       qbc.knowledge_fact_count,
       qbc.updated_at
     FROM omega_brain_checkpoints qbc
     WHERE qbc.tenant_id = $1
     ORDER BY qbc.updated_at DESC
     LIMIT 1`,
    [stringParam('tenantId', tenantId)] as any,
  );

  if (!result.rows?.length) {
    return respond(200, {
      omega: null,
      message: 'No OMEGA brain instance found for this tenant. Brain will initialize on first request.',
    });
  }

  const brain = result.rows[0] as any;

  // Also get the resolved cartridge state
  const resolvedResult = await executeStatement(
    `SELECT resolved_at FROM cartridge_resolved_state WHERE tenant_id = $1`,
    [stringParam('tenantId', tenantId)] as any,
  );

  const lastResolved = (resolvedResult.rows || [])[0] as any;
  const brainStale = lastResolved?.resolved_at && brain.updated_at
    ? new Date(lastResolved.resolved_at) > new Date(brain.updated_at)
    : false;

  return respond(200, {
    omega: {
      brainId: brain.brain_id,
      hilbertDimension: brain.hilbert_dimension,
      dopamine: brain.dopamine,
      totalCycles: brain.total_cycles,
      loadedFirmwareId: brain.loaded_firmware_id,
      helixRuleCount: brain.helix_rule_count,
      cartridgeBootStatus: brain.cartridge_boot_status,
      cartridgeBootDurationMs: brain.cartridge_boot_duration_ms,
      firmwareEnforcementCount: brain.firmware_enforcement_count,
      softRomVersion: brain.soft_rom_version,
      knowledgeFactCount: brain.knowledge_fact_count,
      lastUpdated: brain.updated_at,
    },
    cartridgeSync: {
      lastResolved: lastResolved?.resolved_at || null,
      brainLastUpdated: brain.updated_at,
      isStale: brainStale,
      message: brainStale
        ? 'Cartridge stack has been updated since last brain boot. Consider triggering a reload.'
        : 'Brain is up to date with current cartridge resolution.',
    },
  });
}

async function triggerOmegaReload(
  tenantId: string,
  userId: string,
): Promise<APIGatewayProxyResult> {
  // Emit EventBridge event to trigger OMEGA brain cartridge reload
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'radiant.tenant-admin',
      DetailType: 'CartridgeReloadRequested',
      EventBusName: EVENT_BUS_NAME,
      Detail: JSON.stringify({
        tenantId,
        requestedBy: userId,
        reason: 'manual_tenant_admin_reload',
        timestamp: new Date().toISOString(),
      }),
    }],
  }));

  await writeAudit(tenantId, 'omega', 'reload_requested', userId, {
    reason: 'manual_tenant_admin_reload',
  });

  logger.info('OMEGA brain reload requested by tenant admin', { tenantId, userId });

  return respond(200, {
    message: 'OMEGA brain cartridge reload triggered. The brain will re-boot from the current resolved cartridge state.',
  });
}

async function getAuditLog(
  tenantId: string,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const limit = params.limit || '50';
  const offset = params.offset || '0';

  const result = await executeStatement(
    `SELECT * FROM cartridge_audit_log
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [
      stringParam('tenantId', tenantId),
      stringParam('limit', limit),
      stringParam('offset', offset),
    ] as any,
  );

  return respond(200, {
    audit: result.rows || [],
    total: (result.rows || []).length,
  });
}

// ============================================================================
// Utilities
// ============================================================================

function mapStackEntry(row: any) {
  return {
    cartridgeId: row.cartridge_id,
    name: row.name || row.display_name,
    displayName: row.display_name,
    cartridgeType: row.cartridge_type,
    version: row.version,
    description: row.description,
    sectionsPresent: Array.isArray(row.sections_present) ? row.sections_present : [],
    targets: Array.isArray(row.targets) ? row.targets : [],
    stackPriority: row.stack_priority,
    installationStatus: row.installation_status,
    installedAt: row.installed_at,
    totalSizeBytes: row.total_size_bytes,
    isSystem: !row.cartridge_tenant_id,
  };
}

async function writeAudit(
  tenantId: string,
  cartridgeId: string,
  action: string,
  actorId: string,
  details: Record<string, unknown>,
) {
  try {
    await executeStatement(
      `INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, actor_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        stringParam('tenantId', tenantId),
        stringParam('cartridgeId', cartridgeId),
        stringParam('action', action),
        stringParam('actorId', actorId),
        stringParam('details', JSON.stringify(details)),
      ] as any,
    );
  } catch (err) {
    logger.warn('Failed to write cartridge audit log', { tenantId, action, err });
  }
}

async function triggerResolutionAndReload(
  tenantId: string,
  userId: string,
  trigger: string,
) {
  // 1. Queue resolution
  if (RESOLUTION_QUEUE_URL) {
    try {
      await sqs.send(new SendMessageCommand({
        QueueUrl: RESOLUTION_QUEUE_URL,
        MessageBody: JSON.stringify({ tenantId, trigger, requestedBy: userId }),
      }));
    } catch (err) {
      logger.warn('Failed to queue resolution, running inline', { tenantId, err });
      await resolveAndPersist(tenantId);
    }
  } else {
    await resolveAndPersist(tenantId);
  }

  // 2. Emit EventBridge event for OMEGA brain reload
  try {
    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'radiant.cartridge-system',
        DetailType: 'CartridgeStackChanged',
        EventBusName: EVENT_BUS_NAME,
        Detail: JSON.stringify({
          tenantId,
          trigger,
          requestedBy: userId,
          timestamp: new Date().toISOString(),
        }),
      }],
    }));
  } catch (err) {
    logger.warn('Failed to emit CartridgeStackChanged event', { tenantId, err });
  }
}
