/**
 * RADIANT - Snapshot Storage Manager Admin API
 * Persistent configuration for snapshot lifecycle, tiered storage, and policies
 * Base path: /api/admin/snapshot-storage
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/snapshot-storage',
  category: 'audit',
  sourceType: 'lambda',
});

// =============================================================================
// Types
// =============================================================================

interface RequestContext {
  tenantId: string;
  userId: string;
}

type StorageTier = 'hot' | 'warm' | 'cold' | 'archive';

// =============================================================================
// Helpers
// =============================================================================

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  },
  body: JSON.stringify(body),
});

const success = (data: unknown) => response(200, { success: true, data });
const badRequest = (message: string) => response(400, { success: false, error: { code: 'BAD_REQUEST', message } });
const unauthorized = () => response(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
const notFound = (message: string) => response(404, { success: false, error: { code: 'NOT_FOUND', message } });
const serverError = (message: string) => response(500, { success: false, error: { code: 'SERVER_ERROR', message } });

function getRequestContext(event: any): RequestContext | null {
  const tenantId = event.headers?.['x-tenant-id'] || event.requestContext?.authorizer?.tenantId;
  const userId = event.requestContext?.authorizer?.userId || 'system';
  
  if (!tenantId) return null;
  return { tenantId, userId };
}

// =============================================================================
// Main Handler
// =============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const ctx = getRequestContext(event);
  if (!ctx) return unauthorized();

  const path = event.path.replace('/api/admin/snapshot-storage', '');
  const method = event.httpMethod;

  logger.info('Snapshot storage API request', { path, method, tenantId: ctx.tenantId });

  try {
    // GET /dashboard
    if (method === 'GET' && path === '/dashboard') {
      return await getDashboard(ctx);
    }
    // GET /config
    if (method === 'GET' && path === '/config') {
      return await getConfig(ctx);
    }
    // PUT /config
    if (method === 'PUT' && path === '/config') {
      return await updateConfig(ctx, JSON.parse(event.body || '{}'));
    }
    // GET /tier-rules
    if (method === 'GET' && path === '/tier-rules') {
      return await getTierRules(ctx);
    }
    // PUT /tier-rules
    if (method === 'PUT' && path === '/tier-rules') {
      return await updateTierRules(ctx, JSON.parse(event.body || '{}'));
    }
    // GET /tier-costs
    if (method === 'GET' && path === '/tier-costs') {
      return await getTierCosts(ctx);
    }
    // PUT /tier-costs
    if (method === 'PUT' && path === '/tier-costs') {
      return await updateTierCosts(ctx, JSON.parse(event.body || '{}'));
    }
    // GET /snapshots
    if (method === 'GET' && path === '/snapshots') {
      return await getSnapshots(ctx, event.queryStringParameters || {});
    }
    // POST /snapshots/:id/transition
    if (method === 'POST' && path.includes('/transition')) {
      const snapshotId = path.split('/')[2];
      return await transitionSnapshotTier(ctx, snapshotId, JSON.parse(event.body || '{}'));
    }
    // DELETE /snapshots/:id
    if (method === 'DELETE' && path.startsWith('/snapshots/')) {
      const snapshotId = path.replace('/snapshots/', '');
      return await deleteSnapshot(ctx, snapshotId);
    }
    // GET /stats
    if (method === 'GET' && path === '/stats') {
      return await getStats(ctx);
    }
    // POST /process-transitions
    if (method === 'POST' && path === '/process-transitions') {
      return await processTransitions(ctx);
    }

    return notFound('Endpoint not found');
  } catch (error) {
    logger.error('Snapshot storage API error', { error, path, method });
    return serverError((error as Error).message);
  }
};

// =============================================================================
// API Handlers
// =============================================================================

// GET /dashboard - Full dashboard data
async function getDashboard(ctx: RequestContext): Promise<APIGatewayProxyResult> {
  const configResult = await executeStatement(
    'SELECT * FROM snapshot_storage_config WHERE tenant_id = :tenantId',
    [stringParam('tenantId', ctx.tenantId)]
  );

  const rulesResult = await executeStatement(
    'SELECT * FROM snapshot_tier_rules WHERE tenant_id = :tenantId ORDER BY after_days',
    [stringParam('tenantId', ctx.tenantId)]
  );

  const costsResult = await executeStatement(
    'SELECT * FROM snapshot_tier_costs WHERE tenant_id = :tenantId',
    [stringParam('tenantId', ctx.tenantId)]
  );

  const statsResult = await executeStatement(`
    SELECT 
      COUNT(*) as total_snapshots,
      COUNT(*) FILTER (WHERE storage_tier = 'hot') as hot_count,
      COUNT(*) FILTER (WHERE storage_tier = 'warm') as warm_count,
      COUNT(*) FILTER (WHERE storage_tier = 'cold') as cold_count,
      COUNT(*) FILTER (WHERE storage_tier = 'archive') as archive_count,
      COALESCE(SUM(size_bytes), 0) as total_size_bytes
    FROM snapshot_registry
    WHERE tenant_id = :tenantId
  `, [stringParam('tenantId', ctx.tenantId)]);

  return success({
    config: configResult.rows?.[0] || null,
    tierRules: rulesResult.rows || [],
    tierCosts: costsResult.rows || [],
    stats: statsResult.rows?.[0] || {},
  });
}

// GET /config
async function getConfig(ctx: RequestContext): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    'SELECT * FROM snapshot_storage_config WHERE tenant_id = :tenantId',
    [stringParam('tenantId', ctx.tenantId)]
  );
  
  if (!result.rows?.length) {
    // Create default config
    await executeStatement(
      'INSERT INTO snapshot_storage_config (tenant_id) VALUES (:tenantId) ON CONFLICT DO NOTHING',
      [stringParam('tenantId', ctx.tenantId)]
    );
    
    const newResult = await executeStatement(
      'SELECT * FROM snapshot_storage_config WHERE tenant_id = :tenantId',
      [stringParam('tenantId', ctx.tenantId)]
    );
    return success(newResult.rows?.[0]);
  }
  
  return success(result.rows[0]);
}

// PUT /config
async function updateConfig(ctx: RequestContext, body: any): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    UPDATE snapshot_storage_config SET
      auto_snapshot_enabled = COALESCE(:autoSnapshotEnabled, auto_snapshot_enabled),
      auto_snapshot_schedule = COALESCE(:autoSnapshotSchedule, auto_snapshot_schedule),
      auto_snapshot_type = COALESCE(:autoSnapshotType, auto_snapshot_type),
      retention_days = COALESCE(:retentionDays, retention_days),
      max_snapshots_per_tier = COALESCE(:maxSnapshotsPerTier, max_snapshots_per_tier),
      pre_deployment_snapshot_enabled = COALESCE(:preDeploymentSnapshotEnabled, pre_deployment_snapshot_enabled),
      pre_migration_snapshot_enabled = COALESCE(:preMigrationSnapshotEnabled, pre_migration_snapshot_enabled),
      updated_at = NOW(),
      updated_by = :userId
    WHERE tenant_id = :tenantId
    RETURNING *
  `, [
    stringParam('tenantId', ctx.tenantId),
    stringParam('userId', ctx.userId),
    { name: 'autoSnapshotEnabled', value: { booleanValue: body.autoSnapshotEnabled } },
    stringParam('autoSnapshotSchedule', body.autoSnapshotSchedule || ''),
    stringParam('autoSnapshotType', body.autoSnapshotType || ''),
    { name: 'retentionDays', value: { longValue: body.retentionDays } },
    { name: 'maxSnapshotsPerTier', value: { longValue: body.maxSnapshotsPerTier } },
    { name: 'preDeploymentSnapshotEnabled', value: { booleanValue: body.preDeploymentSnapshotEnabled } },
    { name: 'preMigrationSnapshotEnabled', value: { booleanValue: body.preMigrationSnapshotEnabled } },
  ]);

  return success(result.rows?.[0]);
}

// GET /tier-rules
async function getTierRules(ctx: RequestContext): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    SELECT * FROM snapshot_tier_rules 
    WHERE tenant_id = :tenantId 
    ORDER BY 
      CASE from_tier 
        WHEN 'hot' THEN 1 
        WHEN 'warm' THEN 2 
        WHEN 'cold' THEN 3 
        WHEN 'archive' THEN 4 
      END
  `, [stringParam('tenantId', ctx.tenantId)]);
  
  return success(result.rows || []);
}

// PUT /tier-rules
async function updateTierRules(ctx: RequestContext, body: { rules: any[] }): Promise<APIGatewayProxyResult> {
  for (const rule of body.rules) {
    await executeStatement(`
      UPDATE snapshot_tier_rules SET
        after_days = :afterDays,
        is_enabled = :isEnabled,
        updated_at = NOW()
      WHERE tenant_id = :tenantId AND id = :ruleId
    `, [
      stringParam('tenantId', ctx.tenantId),
      stringParam('ruleId', rule.id),
      { name: 'afterDays', value: { longValue: rule.afterDays } },
      { name: 'isEnabled', value: { booleanValue: rule.isEnabled } },
    ]);
  }

  return await getTierRules(ctx);
}

// GET /tier-costs
async function getTierCosts(ctx: RequestContext): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    SELECT * FROM snapshot_tier_costs 
    WHERE tenant_id = :tenantId 
    ORDER BY 
      CASE tier 
        WHEN 'hot' THEN 1 
        WHEN 'warm' THEN 2 
        WHEN 'cold' THEN 3 
        WHEN 'archive' THEN 4 
      END
  `, [stringParam('tenantId', ctx.tenantId)]);
  
  return success(result.rows || []);
}

// PUT /tier-costs
async function updateTierCosts(ctx: RequestContext, body: { costs: any[] }): Promise<APIGatewayProxyResult> {
  for (const cost of body.costs) {
    await executeStatement(`
      UPDATE snapshot_tier_costs SET
        cost_per_gb_month = :costPerGbMonth,
        retrieval_cost_per_gb = :retrievalCostPerGb,
        retrieval_time_hours = :retrievalTimeHours,
        updated_at = NOW()
      WHERE tenant_id = :tenantId AND tier = :tier
    `, [
      stringParam('tenantId', ctx.tenantId),
      stringParam('tier', cost.tier),
      { name: 'costPerGbMonth', value: { doubleValue: cost.costPerGbMonth } },
      { name: 'retrievalCostPerGb', value: { doubleValue: cost.retrievalCostPerGb } },
      { name: 'retrievalTimeHours', value: { doubleValue: cost.retrievalTimeHours } },
    ]);
  }

  return await getTierCosts(ctx);
}

// GET /snapshots
async function getSnapshots(ctx: RequestContext, params: any): Promise<APIGatewayProxyResult> {
  const tier = params?.tier;
  const limit = parseInt(params?.limit || '50', 10);
  const offset = parseInt(params?.offset || '0', 10);

  let query = 'SELECT * FROM snapshot_registry WHERE tenant_id = :tenantId';
  const queryParams = [stringParam('tenantId', ctx.tenantId)];

  if (tier && tier !== 'all') {
    query += ' AND storage_tier = :tier';
    queryParams.push(stringParam('tier', tier));
  }

  query += ' ORDER BY created_at DESC LIMIT :limit OFFSET :offset';
  queryParams.push(
    { name: 'limit', value: { longValue: limit } },
    { name: 'offset', value: { longValue: offset } }
  );

  const result = await executeStatement(query, queryParams);

  return success({
    snapshots: result.rows || [],
    limit,
    offset,
  });
}

// POST /snapshots/:id/transition
async function transitionSnapshotTier(ctx: RequestContext, snapshotId: string, body: { targetTier: StorageTier }): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    UPDATE snapshot_registry SET
      storage_tier = :targetTier,
      tier_transition_date = NOW(),
      status = 'available'
    WHERE tenant_id = :tenantId AND (id::text = :snapshotId OR snapshot_id = :snapshotId)
    RETURNING *
  `, [
    stringParam('tenantId', ctx.tenantId),
    stringParam('snapshotId', snapshotId),
    stringParam('targetTier', body.targetTier),
  ]);

  if (!result.rows?.length) {
    return notFound('Snapshot not found');
  }

  return success(result.rows[0]);
}

// DELETE /snapshots/:id
async function deleteSnapshot(ctx: RequestContext, snapshotId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    DELETE FROM snapshot_registry 
    WHERE tenant_id = :tenantId AND (id::text = :snapshotId OR snapshot_id = :snapshotId)
    RETURNING *
  `, [
    stringParam('tenantId', ctx.tenantId),
    stringParam('snapshotId', snapshotId),
  ]);

  if (!result.rows?.length) {
    return notFound('Snapshot not found');
  }

  return success({ deleted: true, snapshot: result.rows[0] });
}

// GET /stats
async function getStats(ctx: RequestContext): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    SELECT 
      COUNT(*) as total_snapshots,
      COUNT(*) FILTER (WHERE storage_tier = 'hot') as hot_count,
      COUNT(*) FILTER (WHERE storage_tier = 'warm') as warm_count,
      COUNT(*) FILTER (WHERE storage_tier = 'cold') as cold_count,
      COUNT(*) FILTER (WHERE storage_tier = 'archive') as archive_count,
      COUNT(*) FILTER (WHERE status = 'available') as available_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      COALESCE(SUM(size_bytes), 0) as total_size_bytes,
      COALESCE(SUM(restore_count), 0) as total_restores,
      MAX(created_at) as last_snapshot_at
    FROM snapshot_registry
    WHERE tenant_id = :tenantId
  `, [stringParam('tenantId', ctx.tenantId)]);

  return success(result.rows?.[0] || {});
}

// POST /process-transitions - Process tier transitions based on rules
async function processTransitions(ctx: RequestContext): Promise<APIGatewayProxyResult> {
  const rulesResult = await executeStatement(`
    SELECT * FROM snapshot_tier_rules 
    WHERE tenant_id = :tenantId AND is_enabled = true
    ORDER BY after_days
  `, [stringParam('tenantId', ctx.tenantId)]);

  let transitioned = 0;

  for (const rule of rulesResult.rows || []) {
    const ruleData = rule as Record<string, any>;
    const fromTier = ruleData.from_tier;
    const toTier = ruleData.to_tier;
    const afterDays = ruleData.after_days;

    const result = await executeStatement(`
      UPDATE snapshot_registry SET
        storage_tier = :toTier,
        tier_transition_date = NOW()
      WHERE tenant_id = :tenantId 
        AND storage_tier = :fromTier 
        AND status = 'available'
        AND created_at < NOW() - INTERVAL '1 day' * :afterDays
      RETURNING id
    `, [
      stringParam('tenantId', ctx.tenantId),
      stringParam('fromTier', fromTier),
      stringParam('toTier', toTier),
      { name: 'afterDays', value: { longValue: afterDays } },
    ]);

    transitioned += result.rows?.length || 0;
  }

  return success({ 
    transitioned,
    message: `Transitioned ${transitioned} snapshots based on lifecycle rules`,
  });
}
