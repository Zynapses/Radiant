/**
 * Cortex Memory System Admin API
 * Tiered Memory Architecture v4.20.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { tierCoordinatorService } from '../shared/services/cortex/tier-coordinator.service';
import { extractAuthContext } from '../shared/auth';
import { executeStatement, stringParam } from '../shared/db/client';
import { Logger } from '../shared/logger';

const logger = new Logger({ handler: 'cortex' });

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

function jsonResponse(data: unknown, statusCode = 200): APIGatewayProxyResult {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(data) };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: corsHeaders, body: JSON.stringify({ error: message }) };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path.replace(/^\/api\/admin\/cortex/, '');
  const method = event.httpMethod;

  try {
    const auth = extractAuthContext(event);
    const tenantId = auth.tenantId;
    const userId = auth.userId;

    if (!tenantId) {
      return errorResponse(401, 'Tenant ID required');
    }

    // Set tenant context
    await executeStatement(`SET app.current_tenant_id = '${tenantId}'`, []);

    // Dashboard overview
    if (path === '/overview' && method === 'GET') {
      return getOverview(tenantId);
    }

    // Configuration
    if (path === '/config' && method === 'GET') {
      return getConfig(tenantId);
    }

    if (path === '/config' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return updateConfig(tenantId, body);
    }

    // Tier Health
    if (path === '/health' && method === 'GET') {
      return getTierHealth(tenantId);
    }

    if (path === '/health/check' && method === 'POST') {
      return checkTierHealth(tenantId);
    }

    // Alerts
    if (path === '/alerts' && method === 'GET') {
      return getAlerts(tenantId);
    }

    if (path.match(/^\/alerts\/[\w-]+\/acknowledge$/) && method === 'POST') {
      const alertId = path.split('/')[2];
      return acknowledgeAlert(tenantId, alertId, userId);
    }

    // Data Flow Metrics
    if (path === '/metrics' && method === 'GET') {
      const period = event.queryStringParameters?.period || 'day';
      return getDataFlowMetrics(tenantId, period as 'hour' | 'day' | 'week');
    }

    // Graph Explorer
    if (path === '/graph/stats' && method === 'GET') {
      return getGraphStats(tenantId);
    }

    if (path === '/graph/explore' && method === 'GET') {
      const params = event.queryStringParameters || {};
      return exploreGraph(tenantId, params);
    }

    if (path === '/graph/conflicts' && method === 'GET') {
      return getConflicts(tenantId);
    }

    // Housekeeping
    if (path === '/housekeeping/status' && method === 'GET') {
      return getHousekeepingStatus(tenantId);
    }

    if (path === '/housekeeping/trigger' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return triggerHousekeeping(tenantId, body.taskType);
    }

    // Zero-Copy Mounts
    if (path === '/mounts' && method === 'GET') {
      return getMounts(tenantId);
    }

    if (path === '/mounts' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return createMount(tenantId, body);
    }

    if (path.match(/^\/mounts\/[\w-]+\/rescan$/) && method === 'POST') {
      const mountId = path.split('/')[2];
      return rescanMount(tenantId, mountId);
    }

    if (path.match(/^\/mounts\/[\w-]+$/) && method === 'DELETE') {
      const mountId = path.split('/')[2];
      return deleteMount(tenantId, mountId);
    }

    // GDPR Erasure
    if (path === '/gdpr/erasure' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return createErasureRequest(tenantId, userId, body);
    }

    if (path === '/gdpr/erasure' && method === 'GET') {
      return getErasureRequests(tenantId);
    }

    return errorResponse(404, 'Endpoint not found');
  } catch (error) {
    logger.error('Cortex handler error', error as Error);
    return errorResponse(500, 'Internal server error');
  }
};

// ============================================================================
// Dashboard
// ============================================================================

async function getOverview(tenantId: string): Promise<APIGatewayProxyResult> {
  const [config, health, metrics, alerts, mounts, housekeeping] = await Promise.all([
    tierCoordinatorService.getConfig(tenantId),
    tierCoordinatorService.getTierHealth(tenantId),
    tierCoordinatorService.getDataFlowMetrics(tenantId, 'day', 7),
    tierCoordinatorService.getActiveAlerts(tenantId),
    getMountsData(tenantId),
    tierCoordinatorService.getHousekeepingTasks(tenantId),
  ]);

  // Get storage stats
  const storageStats = await executeStatement(
    `SELECT 
      (SELECT COUNT(*) FROM cortex_graph_nodes WHERE tenant_id = $1 AND status = 'active') as node_count,
      (SELECT COUNT(*) FROM cortex_graph_edges WHERE tenant_id = $1) as edge_count,
      (SELECT COUNT(*) FROM cortex_graph_documents WHERE tenant_id = $1) as doc_count,
      (SELECT COUNT(*) FROM cortex_cold_archives WHERE tenant_id = $1) as archive_count`,
    [stringParam('tenantId', tenantId)]
  );

  const stats = storageStats.rows?.[0] || {};

  return jsonResponse({
    config,
    tiers: {
      hot: health.find((h: { tier: string }) => h.tier === 'hot') || { tier: 'hot', status: 'healthy' },
      warm: health.find((h: { tier: string }) => h.tier === 'warm') || { tier: 'warm', status: 'healthy' },
      cold: health.find((h: { tier: string }) => h.tier === 'cold') || { tier: 'cold', status: 'healthy' },
    },
    stats: {
      nodeCount: parseInt(stats.node_count as string) || 0,
      edgeCount: parseInt(stats.edge_count as string) || 0,
      documentCount: parseInt(stats.doc_count as string) || 0,
      archiveCount: parseInt(stats.archive_count as string) || 0,
    },
    dataFlow: metrics[0] || null,
    recentMetrics: metrics,
    alerts,
    mounts,
    housekeeping,
  });
}

// ============================================================================
// Configuration
// ============================================================================

async function getConfig(tenantId: string): Promise<APIGatewayProxyResult> {
  let config = await tierCoordinatorService.getConfig(tenantId);
  
  if (!config) {
    await tierCoordinatorService.initializeTenant(tenantId);
    config = await tierCoordinatorService.getConfig(tenantId);
  }

  return jsonResponse(config);
}

async function updateConfig(tenantId: string, updates: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const fields: string[] = [];
  const values: any[] = [stringParam('tenantId', tenantId)];
  let paramIndex = 2;

  const fieldMap: Record<string, string> = {
    'hot.retentionDays': 'hot_default_ttl_seconds',
    'warm.retentionDays': 'warm_retention_days',
    'warm.graphWeightPercent': 'warm_graph_weight_percent',
    'cold.zeroCopyEnabled': 'cold_zero_copy_enabled',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    const [tier, field] = key.split('.');
    if (updates[tier] && (updates[tier] as Record<string, unknown>)[field] !== undefined) {
      fields.push(`${column} = $${paramIndex}`);
      values.push(stringParam(`param${paramIndex}`, String((updates[tier] as Record<string, unknown>)[field])));
      paramIndex++;
    }
  }

  if (fields.length > 0) {
    await executeStatement(
      `UPDATE cortex_config SET ${fields.join(', ')}, updated_at = NOW() WHERE tenant_id = $1`,
      values
    );
  }

  return jsonResponse(await tierCoordinatorService.getConfig(tenantId));
}

// ============================================================================
// Tier Health
// ============================================================================

async function getTierHealth(tenantId: string): Promise<APIGatewayProxyResult> {
  const health = await tierCoordinatorService.getTierHealth(tenantId);
  return jsonResponse(health);
}

async function checkTierHealth(tenantId: string): Promise<APIGatewayProxyResult> {
  const alerts = await tierCoordinatorService.checkTierHealth(tenantId);
  const health = await tierCoordinatorService.getTierHealth(tenantId);
  return jsonResponse({ health, newAlerts: alerts });
}

// ============================================================================
// Alerts
// ============================================================================

async function getAlerts(tenantId: string): Promise<APIGatewayProxyResult> {
  const alerts = await tierCoordinatorService.getActiveAlerts(tenantId);
  return jsonResponse(alerts);
}

async function acknowledgeAlert(tenantId: string, alertId: string, userId: string): Promise<APIGatewayProxyResult> {
  await tierCoordinatorService.acknowledgeAlert(tenantId, alertId, userId);
  return jsonResponse({ acknowledged: true });
}

// ============================================================================
// Data Flow Metrics
// ============================================================================

async function getDataFlowMetrics(tenantId: string, period: 'hour' | 'day' | 'week'): Promise<APIGatewayProxyResult> {
  const metrics = await tierCoordinatorService.getDataFlowMetrics(tenantId, period);
  return jsonResponse(metrics);
}

// ============================================================================
// Graph Explorer
// ============================================================================

async function getGraphStats(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT 
      node_type, COUNT(*) as count
     FROM cortex_graph_nodes 
     WHERE tenant_id = $1 AND status = 'active'
     GROUP BY node_type`,
    [stringParam('tenantId', tenantId)]
  );

  const edgeResult = await executeStatement(
    `SELECT 
      edge_type, COUNT(*) as count
     FROM cortex_graph_edges 
     WHERE tenant_id = $1
     GROUP BY edge_type`,
    [stringParam('tenantId', tenantId)]
  );

  return jsonResponse({
    nodesByType: (result.rows || []).reduce((acc: Record<string, number>, row) => {
      acc[row.node_type as string] = parseInt(row.count as string);
      return acc;
    }, {}),
    edgesByType: (edgeResult.rows || []).reduce((acc: Record<string, number>, row) => {
      acc[row.edge_type as string] = parseInt(row.count as string);
      return acc;
    }, {}),
  });
}

async function exploreGraph(tenantId: string, params: Record<string, string | undefined>): Promise<APIGatewayProxyResult> {
  const { nodeId, search, nodeType, limit = '50' } = params;

  let query = `SELECT * FROM cortex_graph_nodes WHERE tenant_id = $1 AND status = 'active'`;
  const queryParams: any[] = [stringParam('tenantId', tenantId)];
  let paramIndex = 2;

  if (nodeId) {
    query += ` AND id = $${paramIndex++}`;
    queryParams.push(stringParam('nodeId', nodeId));
  }

  if (search) {
    query += ` AND label ILIKE $${paramIndex++}`;
    queryParams.push(stringParam('search', `%${search}%`));
  }

  if (nodeType) {
    query += ` AND node_type = $${paramIndex++}`;
    queryParams.push(stringParam('nodeType', nodeType));
  }

  query += ` ORDER BY confidence DESC, created_at DESC LIMIT $${paramIndex}`;
  queryParams.push(stringParam('limit', limit));

  const nodesResult = await executeStatement(query, queryParams);
  const nodes = nodesResult.rows || [];
  const nodeIds = nodes.map(n => n.id as string);

  let edges: any[] = [];
  if (nodeIds.length > 0) {
    const edgesResult = await executeStatement(
      `SELECT * FROM cortex_graph_edges 
       WHERE tenant_id = $1 
       AND (source_node_id = ANY($2) OR target_node_id = ANY($2))`,
      [stringParam('tenantId', tenantId), stringParam('nodeIds', `{${nodeIds.join(',')}}`)]
    );
    edges = edgesResult.rows || [];
  }

  return jsonResponse({ nodes, edges });
}

async function getConflicts(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT cf.*, 
      n1.label as node1_label, n1.node_type as node1_type,
      n2.label as node2_label, n2.node_type as node2_type
     FROM cortex_conflicting_facts cf
     JOIN cortex_graph_nodes n1 ON n1.id = cf.node_id_1
     JOIN cortex_graph_nodes n2 ON n2.id = cf.node_id_2
     WHERE cf.tenant_id = $1 AND cf.resolved_at IS NULL
     ORDER BY cf.detected_at DESC
     LIMIT 50`,
    [stringParam('tenantId', tenantId)]
  );

  return jsonResponse(result.rows || []);
}

// ============================================================================
// Housekeeping
// ============================================================================

async function getHousekeepingStatus(tenantId: string): Promise<APIGatewayProxyResult> {
  const tasks = await tierCoordinatorService.getHousekeepingTasks(tenantId);
  return jsonResponse(tasks);
}

async function triggerHousekeeping(tenantId: string, taskType: string): Promise<APIGatewayProxyResult> {
  await tierCoordinatorService.triggerHousekeepingTask(tenantId, taskType as any);
  return jsonResponse({ triggered: true, taskType });
}

// ============================================================================
// Zero-Copy Mounts
// ============================================================================

async function getMountsData(tenantId: string): Promise<any[]> {
  const result = await executeStatement(
    `SELECT * FROM cortex_zero_copy_mounts WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [stringParam('tenantId', tenantId)]
  );
  return result.rows || [];
}

async function getMounts(tenantId: string): Promise<APIGatewayProxyResult> {
  const mounts = await getMountsData(tenantId);
  return jsonResponse(mounts);
}

async function createMount(tenantId: string, body: any): Promise<APIGatewayProxyResult> {
  const { name, sourceType, connectionConfig } = body;

  const result = await executeStatement(
    `INSERT INTO cortex_zero_copy_mounts (tenant_id, name, source_type, connection_config)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      stringParam('tenantId', tenantId),
      stringParam('name', name),
      stringParam('sourceType', sourceType),
      stringParam('connectionConfig', JSON.stringify(connectionConfig)),
    ]
  );

  return jsonResponse(result.rows[0], 201);
}

async function rescanMount(tenantId: string, mountId: string): Promise<APIGatewayProxyResult> {
  await executeStatement(
    `UPDATE cortex_zero_copy_mounts SET status = 'scanning' WHERE tenant_id = $1 AND id = $2`,
    [stringParam('tenantId', tenantId), stringParam('mountId', mountId)]
  );

  const scanLambda = process.env.CORTEX_MOUNT_SCAN_LAMBDA;
  
  if (scanLambda) {
    try {
      const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
      
      await lambdaClient.send(new InvokeCommand({
        FunctionName: scanLambda,
        InvocationType: 'Event', // Async
        Payload: JSON.stringify({
          type: 'mount_scan',
          tenantId,
          mountId,
          requestedAt: new Date().toISOString(),
        }),
      }));
      
      logger.info('Mount scan Lambda invoked', { tenantId, mountId, lambda: scanLambda });
    } catch (error) {
      logger.error('Failed to invoke scan Lambda, marking as failed', { tenantId, mountId, error });
      await executeStatement(
        `UPDATE cortex_zero_copy_mounts SET status = 'scan_failed' WHERE tenant_id = $1 AND id = $2`,
        [stringParam('tenantId', tenantId), stringParam('mountId', mountId)]
      );
      return jsonResponse({ scanning: false, error: 'Failed to start scan' }, 500);
    }
  } else {
    // No Lambda configured - complete synchronously for dev environments
    logger.warn('No scan Lambda configured, completing synchronously', { tenantId, mountId });
    await executeStatement(
      `UPDATE cortex_zero_copy_mounts 
       SET status = 'active', last_scan_at = NOW() 
       WHERE tenant_id = $1 AND id = $2`,
      [stringParam('tenantId', tenantId), stringParam('mountId', mountId)]
    );
  }

  return jsonResponse({ scanning: true, mountId });
}

async function deleteMount(tenantId: string, mountId: string): Promise<APIGatewayProxyResult> {
  await executeStatement(
    `DELETE FROM cortex_zero_copy_mounts WHERE tenant_id = $1 AND id = $2`,
    [stringParam('tenantId', tenantId), stringParam('mountId', mountId)]
  );

  return jsonResponse({ deleted: true, mountId });
}

// ============================================================================
// GDPR Erasure
// ============================================================================

async function createErasureRequest(tenantId: string, userId: string, body: any): Promise<APIGatewayProxyResult> {
  const { targetUserId, scopeType, reason } = body;

  const result = await executeStatement(
    `INSERT INTO cortex_gdpr_erasure_requests (tenant_id, user_id, scope_type, reason, requested_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      stringParam('tenantId', tenantId),
      stringParam('userId', targetUserId || null),
      stringParam('scopeType', scopeType),
      stringParam('reason', reason),
      stringParam('requestedBy', userId),
    ]
  );

  // Trigger async GDPR erasure processing
  const requestId = result.rows[0].id as string;
  
  try {
    await tierCoordinatorService.processGdprErasure(requestId);
    logger.info('GDPR erasure processing started', { tenantId, requestId });
  } catch (error) {
    logger.error('Failed to start GDPR erasure processing', { requestId, error });
    // Update request status to indicate processing failed to start
    await executeStatement(
      `UPDATE cortex_gdpr_erasure_requests SET status = 'processing_failed', error_message = $2 WHERE id = $1`,
      [stringParam('id', requestId), stringParam('error', error instanceof Error ? error.message : 'Unknown error')]
    );
  }

  return jsonResponse(result.rows[0], 201);
}

async function getErasureRequests(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM cortex_gdpr_erasure_requests WHERE tenant_id = $1 ORDER BY requested_at DESC`,
    [stringParam('tenantId', tenantId)]
  );

  return jsonResponse(result.rows || []);
}
