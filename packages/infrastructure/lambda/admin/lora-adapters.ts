// RADIANT v5.9.0 - LoRA Adapter Management Admin API
// Tri-Layer LoRA Architecture: Genesis (Base) → Cato (Global) → User (Personal)
// Manages adapter stacking, scales, and pinning for personalized AI responses

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam, doubleParam, boolParam, longParam } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

interface LoraConfig {
  enabled: boolean;
  use_global_adapter: boolean;
  use_user_adapter: boolean;
  global_scale: number;
  user_scale: number;
  auto_selection_enabled: boolean;
  rollback_enabled: boolean;
  warmup_enabled: boolean;
  warmup_interval_minutes: number;
  max_adapters_in_memory: number;
  lru_eviction_enabled: boolean;
}

interface AdapterInfo {
  adapter_id: string;
  adapter_name: string;
  adapter_layer: 'global' | 'user' | 'domain';
  base_model: string;
  s3_key: string;
  is_pinned: boolean;
  is_active: boolean;
  scale: number;
  load_count: number;
  last_used_at: string;
  created_at: string;
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
 * GET /api/admin/lora/dashboard
 * Full dashboard with adapter stats, config, and usage
 */
async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    // Get config
    const configResult = await executeStatement(
      `SELECT * FROM lora_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    // Get adapter counts by layer
    const countsResult = await executeStatement(
      `SELECT 
        adapter_layer,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE is_active) as active_count,
        COUNT(*) FILTER (WHERE is_pinned) as pinned_count
       FROM lora_adapters 
       WHERE tenant_id = $1 
       GROUP BY adapter_layer`,
      [stringParam('tenantId', tenantId)]
    );

    // Get recent adapter usage (last 24h)
    const usageResult = await executeStatement(
      `SELECT 
        COUNT(*) as total_invocations,
        COUNT(DISTINCT adapter_id) as unique_adapters,
        AVG(latency_ms) as avg_latency,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
       FROM lora_invocations 
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [stringParam('tenantId', tenantId)]
    );

    // Get top adapters by usage
    const topAdaptersResult = await executeStatement(
      `SELECT 
        a.adapter_id, a.adapter_name, a.adapter_layer, a.is_pinned,
        COUNT(i.id) as invocation_count
       FROM lora_adapters a
       LEFT JOIN lora_invocations i ON a.adapter_id = i.adapter_id 
         AND i.created_at > NOW() - INTERVAL '7 days'
       WHERE a.tenant_id = $1
       GROUP BY a.adapter_id, a.adapter_name, a.adapter_layer, a.is_pinned
       ORDER BY invocation_count DESC
       LIMIT 10`,
      [stringParam('tenantId', tenantId)]
    );

    // Get warmup status
    const warmupResult = await executeStatement(
      `SELECT * FROM lora_warmup_log 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [stringParam('tenantId', tenantId)]
    );

    const config = configResult.rows?.[0] as unknown as LoraConfig | undefined;
    const usage = usageResult.rows?.[0] as Record<string, unknown> | undefined;

    // Parse counts by layer
    const layerCounts: Record<string, { count: number; active: number; pinned: number }> = {};
    for (const row of (countsResult.rows || []) as Array<Record<string, unknown>>) {
      layerCounts[row.adapter_layer as string] = {
        count: Number(row.count || 0),
        active: Number(row.active_count || 0),
        pinned: Number(row.pinned_count || 0),
      };
    }

    return response(200, {
      config: config || getDefaultConfig(),
      layerCounts,
      usage: {
        totalInvocations: Number(usage?.total_invocations || 0),
        uniqueAdapters: Number(usage?.unique_adapters || 0),
        avgLatency: Number(usage?.avg_latency || 0),
        successRate: usage?.total_invocations 
          ? (Number(usage?.successful || 0) / Number(usage?.total_invocations) * 100).toFixed(1)
          : '100',
      },
      topAdapters: topAdaptersResult.rows || [],
      recentWarmups: warmupResult.rows || [],
    });
  } catch (error) {
    logger.error('Failed to get LoRA dashboard', { error });
    return response(500, { error: 'Failed to get dashboard' });
  }
}

function getDefaultConfig(): LoraConfig {
  return {
    enabled: true,
    use_global_adapter: true,
    use_user_adapter: true,
    global_scale: 1.0,
    user_scale: 1.0,
    auto_selection_enabled: true,
    rollback_enabled: true,
    warmup_enabled: true,
    warmup_interval_minutes: 15,
    max_adapters_in_memory: 50,
    lru_eviction_enabled: true,
  };
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * GET /api/admin/lora/config
 * Get LoRA configuration
 */
async function getConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    const result = await executeStatement(
      `SELECT * FROM lora_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    return response(200, {
      config: (result.rows?.[0] as unknown as LoraConfig) || getDefaultConfig(),
    });
  } catch (error) {
    logger.error('Failed to get config', { error });
    return response(500, { error: 'Failed to get config' });
  }
}

/**
 * PUT /api/admin/lora/config
 * Update LoRA configuration
 */
async function updateConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const body = JSON.parse(event.body || '{}') as Partial<LoraConfig>;
  
  try {
    await executeStatement(
      `INSERT INTO lora_config (
        tenant_id, enabled, use_global_adapter, use_user_adapter,
        global_scale, user_scale, auto_selection_enabled, rollback_enabled,
        warmup_enabled, warmup_interval_minutes, max_adapters_in_memory, lru_eviction_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = COALESCE($2, lora_config.enabled),
        use_global_adapter = COALESCE($3, lora_config.use_global_adapter),
        use_user_adapter = COALESCE($4, lora_config.use_user_adapter),
        global_scale = COALESCE($5, lora_config.global_scale),
        user_scale = COALESCE($6, lora_config.user_scale),
        auto_selection_enabled = COALESCE($7, lora_config.auto_selection_enabled),
        rollback_enabled = COALESCE($8, lora_config.rollback_enabled),
        warmup_enabled = COALESCE($9, lora_config.warmup_enabled),
        warmup_interval_minutes = COALESCE($10, lora_config.warmup_interval_minutes),
        max_adapters_in_memory = COALESCE($11, lora_config.max_adapters_in_memory),
        lru_eviction_enabled = COALESCE($12, lora_config.lru_eviction_enabled),
        updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        boolParam('enabled', body.enabled ?? true),
        boolParam('useGlobal', body.use_global_adapter ?? true),
        boolParam('useUser', body.use_user_adapter ?? true),
        doubleParam('globalScale', body.global_scale ?? 1.0),
        doubleParam('userScale', body.user_scale ?? 1.0),
        boolParam('autoSelect', body.auto_selection_enabled ?? true),
        boolParam('rollback', body.rollback_enabled ?? true),
        boolParam('warmup', body.warmup_enabled ?? true),
        longParam('warmupInterval', body.warmup_interval_minutes ?? 15),
        longParam('maxAdapters', body.max_adapters_in_memory ?? 50),
        boolParam('lruEviction', body.lru_eviction_enabled ?? true),
      ]
    );

    logger.info('LoRA config updated', { tenantId });
    return response(200, { success: true });
  } catch (error) {
    logger.error('Failed to update config', { error });
    return response(500, { error: 'Failed to update config' });
  }
}

// ============================================================================
// Adapters Management
// ============================================================================

/**
 * GET /api/admin/lora/adapters
 * List all adapters
 */
async function getAdapters(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const layer = event.queryStringParameters?.layer;
  const activeOnly = event.queryStringParameters?.active === 'true';
  
  try {
    let whereClause = 'WHERE tenant_id = $1';
    const params = [stringParam('tenantId', tenantId)];

    if (layer) {
      whereClause += ` AND adapter_layer = $${params.length + 1}`;
      params.push(stringParam('layer', layer));
    }
    if (activeOnly) {
      whereClause += ' AND is_active = true';
    }

    const result = await executeStatement(
      `SELECT adapter_id, adapter_name, adapter_layer, base_model, s3_key,
              is_pinned, is_active, scale, load_count, last_used_at, created_at
       FROM lora_adapters 
       ${whereClause}
       ORDER BY adapter_layer, adapter_name`,
      params
    );

    return response(200, {
      adapters: result.rows || [],
    });
  } catch (error) {
    logger.error('Failed to get adapters', { error });
    return response(500, { error: 'Failed to get adapters' });
  }
}

/**
 * POST /api/admin/lora/adapters
 * Create new adapter
 */
async function createAdapter(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const body = JSON.parse(event.body || '{}') as Partial<AdapterInfo>;
  
  if (!body.adapter_name || !body.adapter_layer || !body.base_model || !body.s3_key) {
    return response(400, { error: 'Missing required fields' });
  }
  
  try {
    const result = await executeStatement(
      `INSERT INTO lora_adapters (
        tenant_id, adapter_name, adapter_layer, base_model, s3_key,
        is_pinned, is_active, scale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING adapter_id`,
      [
        stringParam('tenantId', tenantId),
        stringParam('name', body.adapter_name),
        stringParam('layer', body.adapter_layer),
        stringParam('baseModel', body.base_model),
        stringParam('s3Key', body.s3_key),
        boolParam('pinned', body.is_pinned ?? (body.adapter_layer === 'global')),
        boolParam('active', body.is_active ?? true),
        doubleParam('scale', body.scale ?? 1.0),
      ]
    );

    const adapterId = (result.rows?.[0] as { adapter_id?: string })?.adapter_id;
    logger.info('Adapter created', { tenantId, adapterId });
    return response(201, { adapterId });
  } catch (error) {
    logger.error('Failed to create adapter', { error });
    return response(500, { error: 'Failed to create adapter' });
  }
}

/**
 * PUT /api/admin/lora/adapters/:adapterId
 * Update adapter
 */
async function updateAdapter(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const adapterId = event.pathParameters?.adapterId;
  const body = JSON.parse(event.body || '{}') as Partial<AdapterInfo>;
  
  if (!adapterId) {
    return response(400, { error: 'Missing adapterId' });
  }
  
  try {
    await executeStatement(
      `UPDATE lora_adapters SET
        adapter_name = COALESCE($3, adapter_name),
        is_pinned = COALESCE($4, is_pinned),
        is_active = COALESCE($5, is_active),
        scale = COALESCE($6, scale),
        updated_at = NOW()
       WHERE tenant_id = $1 AND adapter_id = $2`,
      [
        stringParam('tenantId', tenantId),
        stringParam('adapterId', adapterId),
        stringParam('name', body.adapter_name || ''),
        boolParam('pinned', body.is_pinned ?? false),
        boolParam('active', body.is_active ?? true),
        doubleParam('scale', body.scale ?? 1.0),
      ]
    );

    logger.info('Adapter updated', { tenantId, adapterId });
    return response(200, { success: true });
  } catch (error) {
    logger.error('Failed to update adapter', { error });
    return response(500, { error: 'Failed to update adapter' });
  }
}

/**
 * DELETE /api/admin/lora/adapters/:adapterId
 * Delete adapter (only if not pinned)
 */
async function deleteAdapter(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  const adapterId = event.pathParameters?.adapterId;
  
  if (!adapterId) {
    return response(400, { error: 'Missing adapterId' });
  }
  
  try {
    // Check if pinned
    const checkResult = await executeStatement(
      `SELECT is_pinned FROM lora_adapters WHERE tenant_id = $1 AND adapter_id = $2`,
      [stringParam('tenantId', tenantId), stringParam('adapterId', adapterId)]
    );

    if ((checkResult.rows?.[0] as { is_pinned?: boolean })?.is_pinned) {
      return response(400, { error: 'Cannot delete pinned adapter' });
    }

    await executeStatement(
      `DELETE FROM lora_adapters WHERE tenant_id = $1 AND adapter_id = $2`,
      [stringParam('tenantId', tenantId), stringParam('adapterId', adapterId)]
    );

    logger.info('Adapter deleted', { tenantId, adapterId });
    return response(200, { success: true });
  } catch (error) {
    logger.error('Failed to delete adapter', { error });
    return response(500, { error: 'Failed to delete adapter' });
  }
}

// ============================================================================
// Warmup Management
// ============================================================================

/**
 * POST /api/admin/lora/warmup
 * Trigger manual warmup
 */
async function triggerWarmup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    // Log warmup request
    await executeStatement(
      `INSERT INTO lora_warmup_log (tenant_id, trigger_type, status)
       VALUES ($1, 'manual', 'pending')`,
      [stringParam('tenantId', tenantId)]
    );

    // In production, this would invoke the warmup Lambda
    logger.info('Warmup triggered', { tenantId });
    return response(200, { success: true, message: 'Warmup triggered' });
  } catch (error) {
    logger.error('Failed to trigger warmup', { error });
    return response(500, { error: 'Failed to trigger warmup' });
  }
}

/**
 * GET /api/admin/lora/warmup/status
 * Get warmup status
 */
async function getWarmupStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = getTenantId(event);
  
  try {
    const result = await executeStatement(
      `SELECT * FROM lora_warmup_log 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [stringParam('tenantId', tenantId)]
    );

    return response(200, {
      warmupHistory: result.rows || [],
    });
  } catch (error) {
    logger.error('Failed to get warmup status', { error });
    return response(500, { error: 'Failed to get warmup status' });
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path.replace('/api/admin/lora', '');
  const method = event.httpMethod;

  logger.info('LoRA admin request', { path, method });

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

    // Adapters
    if (path === '/adapters' && method === 'GET') {
      return getAdapters(event);
    }
    if (path === '/adapters' && method === 'POST') {
      return createAdapter(event);
    }
    if (path.match(/^\/adapters\/[^/]+$/) && method === 'PUT') {
      return updateAdapter(event);
    }
    if (path.match(/^\/adapters\/[^/]+$/) && method === 'DELETE') {
      return deleteAdapter(event);
    }

    // Warmup
    if (path === '/warmup' && method === 'POST') {
      return triggerWarmup(event);
    }
    if (path === '/warmup/status' && method === 'GET') {
      return getWarmupStatus(event);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    logger.error('LoRA admin error', { error });
    return response(500, { error: 'Internal server error' });
  }
}
