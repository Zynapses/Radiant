/**
 * RADIANT v5.29.0 - Gateway Admin API
 * 
 * Provides admin controls and statistics for the Multi-Protocol Gateway.
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { executeQuery, executeStatement, stringParam, uuidParam } from '../shared/utils/db';
import type { SqlParameter } from '@aws-sdk/client-rds-data';
import { logger } from '../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

interface GatewayInstance {
  id: string;
  instance_id: string;
  hostname: string;
  region: string;
  availability_zone?: string;
  instance_type: string;
  status: 'active' | 'draining' | 'stopped' | 'unhealthy';
  version: string;
  started_at: string;
  last_heartbeat_at: string;
  metadata: Record<string, unknown>;
}

interface GatewayStatistics {
  bucket_start: string;
  bucket_end: string;
  active_connections: number;
  peak_connections: number;
  messages_inbound: number;
  messages_outbound: number;
  bytes_inbound: number;
  bytes_outbound: number;
  latency_avg?: number;
  latency_p99?: number;
  total_errors: number;
  cpu_percent?: number;
  memory_percent?: number;
}

interface GatewayConfiguration {
  max_connections_per_tenant: number;
  max_connections_per_user: number;
  max_connections_per_agent: number;
  rate_limit_messages_per_second: number;
  rate_limit_bytes_per_second: number;
  rate_limit_connections_per_minute: number;
  timeout_connect_ms: number;
  timeout_idle_ms: number;
  protocols_enabled: string[];
  require_mtls_for_a2a: boolean;
  allow_anonymous_connections: boolean;
  resume_token_ttl_seconds: number;
  maintenance_mode: boolean;
  maintenance_message?: string;
}

interface GatewayAlert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description?: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  threshold_value?: number;
  actual_value?: number;
  created_at: string;
}

// ============================================================================
// Dashboard Overview
// ============================================================================

async function getDashboard(tenantId?: string): Promise<APIGatewayProxyResult> {
  try {
    // Get active instances
    const instancesResult = await executeQuery<GatewayInstance>(
      `SELECT * FROM gateway_instances WHERE status = 'active' ORDER BY started_at DESC`
    );

    // Get current statistics (last 5 minutes)
    const statsResult = await executeQuery<{
      total_connections: number;
      peak_connections: number;
      messages_per_minute: number;
      avg_latency: number;
      error_rate: number;
    }>(
      `SELECT
        COALESCE(SUM(active_connections), 0) AS total_connections,
        COALESCE(MAX(peak_connections), 0) AS peak_connections,
        COALESCE(SUM(messages_inbound + messages_outbound) / 5.0, 0) AS messages_per_minute,
        COALESCE(AVG(latency_avg), 0) AS avg_latency,
        CASE 
          WHEN SUM(messages_inbound + messages_outbound) > 0 
          THEN (SUM(errors_auth + errors_protocol + errors_timeout + errors_nats + errors_other)::FLOAT / 
                SUM(messages_inbound + messages_outbound) * 100)
          ELSE 0
        END AS error_rate
      FROM gateway_statistics
      WHERE bucket_start >= NOW() - INTERVAL '5 minutes'
        ${tenantId ? 'AND tenant_id = $1::uuid' : ''}`,
      tenantId ? [uuidParam('tenantId', tenantId)] : []
    );

    // Get protocol distribution
    const protocolResult = await executeQuery<{
      protocol: string;
      connections: number;
    }>(
      `SELECT
        'mcp' AS protocol, COALESCE(SUM(connections_mcp), 0) AS connections FROM gateway_statistics WHERE bucket_start >= NOW() - INTERVAL '5 minutes'
      UNION ALL
      SELECT 'a2a', COALESCE(SUM(connections_a2a), 0) FROM gateway_statistics WHERE bucket_start >= NOW() - INTERVAL '5 minutes'
      UNION ALL
      SELECT 'openai', COALESCE(SUM(connections_openai), 0) FROM gateway_statistics WHERE bucket_start >= NOW() - INTERVAL '5 minutes'
      UNION ALL
      SELECT 'anthropic', COALESCE(SUM(connections_anthropic), 0) FROM gateway_statistics WHERE bucket_start >= NOW() - INTERVAL '5 minutes'
      UNION ALL
      SELECT 'google', COALESCE(SUM(connections_google), 0) FROM gateway_statistics WHERE bucket_start >= NOW() - INTERVAL '5 minutes'`
    );

    // Get open alerts
    const alertsResult = await executeQuery<GatewayAlert>(
      `SELECT * FROM gateway_alerts 
       WHERE status IN ('open', 'acknowledged')
       ORDER BY 
         CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
         created_at DESC
       LIMIT 10`
    );

    // Get 24-hour trend
    const trendResult = await executeQuery<{
      hour: string;
      connections: number;
      messages: number;
      errors: number;
    }>(
      `SELECT
        date_trunc('hour', bucket_start) AS hour,
        MAX(peak_connections) AS connections,
        SUM(messages_inbound + messages_outbound) AS messages,
        SUM(errors_auth + errors_protocol + errors_timeout + errors_nats + errors_other) AS errors
      FROM gateway_statistics
      WHERE bucket_start >= NOW() - INTERVAL '24 hours'
        ${tenantId ? 'AND tenant_id = $1::uuid' : ''}
      GROUP BY date_trunc('hour', bucket_start)
      ORDER BY hour`,
      tenantId ? [uuidParam('tenantId', tenantId)] : []
    );

    const stats = statsResult.rows[0] || {
      total_connections: 0,
      peak_connections: 0,
      messages_per_minute: 0,
      avg_latency: 0,
      error_rate: 0,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          overview: {
            totalConnections: stats.total_connections,
            peakConnections: stats.peak_connections,
            messagesPerMinute: Math.round(stats.messages_per_minute),
            avgLatencyMs: Math.round(stats.avg_latency / 1000), // Convert from µs
            errorRate: Number(stats.error_rate.toFixed(2)),
            activeInstances: instancesResult.rows.length,
          },
          instances: instancesResult.rows,
          protocols: protocolResult.rows.reduce((acc, row) => {
            acc[row.protocol] = row.connections;
            return acc;
          }, {} as Record<string, number>),
          alerts: alertsResult.rows,
          trend: trendResult.rows,
        },
      }),
    };
  } catch (error) {
    logger.error('Failed to get gateway dashboard', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to get dashboard' }),
    };
  }
}

// ============================================================================
// Statistics
// ============================================================================

async function getStatistics(
  tenantId: string | undefined,
  startDate: string,
  endDate: string,
  granularity: 'minute' | 'hour' | 'day' = 'hour'
): Promise<APIGatewayProxyResult> {
  try {
    const truncFunc = granularity === 'minute' ? '5 minutes' : granularity;
    
    const result = await executeQuery<GatewayStatistics>(
      `SELECT
        date_trunc('${truncFunc}', bucket_start) AS bucket_start,
        MAX(bucket_end) AS bucket_end,
        MAX(peak_connections) AS peak_connections,
        AVG(active_connections)::INTEGER AS active_connections,
        SUM(messages_inbound) AS messages_inbound,
        SUM(messages_outbound) AS messages_outbound,
        SUM(bytes_inbound) AS bytes_inbound,
        SUM(bytes_outbound) AS bytes_outbound,
        AVG(latency_avg)::INTEGER AS latency_avg,
        MAX(latency_p99) AS latency_p99,
        SUM(errors_auth + errors_protocol + errors_timeout + errors_nats + errors_other) AS total_errors,
        AVG(cpu_percent)::NUMERIC(5,2) AS cpu_percent,
        AVG(memory_percent)::NUMERIC(5,2) AS memory_percent
      FROM gateway_statistics
      WHERE bucket_start >= $1::timestamptz
        AND bucket_end <= $2::timestamptz
        ${tenantId ? 'AND tenant_id = $3::uuid' : ''}
      GROUP BY date_trunc('${truncFunc}', bucket_start)
      ORDER BY bucket_start`,
      tenantId
        ? [stringParam('start', startDate), stringParam('end', endDate), uuidParam('tenant', tenantId)]
        : [stringParam('start', startDate), stringParam('end', endDate)]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result.rows,
      }),
    };
  } catch (error) {
    logger.error('Failed to get gateway statistics', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to get statistics' }),
    };
  }
}

// ============================================================================
// Configuration
// ============================================================================

async function getConfiguration(tenantId?: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await executeQuery<GatewayConfiguration>(
      `SELECT * FROM gateway_configuration 
       WHERE tenant_id ${tenantId ? '= $1::uuid' : 'IS NULL'}`,
      tenantId ? [uuidParam('tenant', tenantId)] : []
    );

    if (result.rows.length === 0) {
      // Return global defaults
      const globalResult = await executeQuery<GatewayConfiguration>(
        `SELECT * FROM gateway_configuration WHERE tenant_id IS NULL`
      );
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: globalResult.rows[0] || null,
          isGlobal: true,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result.rows[0],
        isGlobal: false,
      }),
    };
  } catch (error) {
    logger.error('Failed to get gateway configuration', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to get configuration' }),
    };
  }
}

async function updateConfiguration(
  tenantId: string | undefined,
  config: Partial<GatewayConfiguration>,
  actorId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Build update query dynamically
    const updates: string[] = [];
    const params: SqlParameter[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'max_connections_per_tenant', 'max_connections_per_user', 'max_connections_per_agent',
      'rate_limit_messages_per_second', 'rate_limit_bytes_per_second', 'rate_limit_connections_per_minute',
      'timeout_connect_ms', 'timeout_idle_ms', 'timeout_write_ms', 'timeout_read_ms',
      'protocols_enabled', 'require_mtls_for_a2a', 'allow_anonymous_connections',
      'resume_token_ttl_seconds', 'resume_token_max_replay_messages',
      'enable_compression', 'enable_message_batching', 'enable_connection_draining',
      'maintenance_mode', 'maintenance_message',
    ];

    for (const [key, value] of Object.entries(config)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        params.push(stringParam(key, JSON.stringify(value)));
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'No valid fields to update' }),
      };
    }

    updates.push(`updated_by = $${paramIndex}::uuid`);
    params.push(uuidParam('updatedBy', actorId));

    // Upsert configuration
    await executeStatement(
      `INSERT INTO gateway_configuration (tenant_id, ${Object.keys(config).join(', ')}, updated_by)
       VALUES (${tenantId ? '$1::uuid' : 'NULL'}, ${params.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (tenant_id) DO UPDATE SET
         ${updates.join(', ')},
         updated_at = NOW()`,
      tenantId ? [uuidParam('tenant', tenantId), ...params] : params
    );

    // Audit log
    await executeStatement(
      `INSERT INTO gateway_audit_log (tenant_id, actor_id, actor_type, action, resource_type, changes)
       VALUES ($1::uuid, $2::uuid, 'admin', 'update_configuration', 'gateway_configuration', $3::jsonb)`,
      [
        uuidParam('tenant', tenantId || ''),
        uuidParam('actor', actorId),
        stringParam('changes', JSON.stringify(config)),
      ]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Configuration updated' }),
    };
  } catch (error) {
    logger.error('Failed to update gateway configuration', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to update configuration' }),
    };
  }
}

// ============================================================================
// Alerts
// ============================================================================

async function getAlerts(
  tenantId: string | undefined,
  status?: string,
  severity?: string,
  limit = 50
): Promise<APIGatewayProxyResult> {
  try {
    const conditions: string[] = [];
    const params: SqlParameter[] = [];

    if (tenantId) {
      conditions.push(`tenant_id = $${params.length + 1}::uuid`);
      params.push(uuidParam('tenant', tenantId));
    }
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(stringParam('status', status));
    }
    if (severity) {
      conditions.push(`severity = $${params.length + 1}`);
      params.push(stringParam('severity', severity));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await executeQuery<GatewayAlert>(
      `SELECT ga.*, gi.hostname, t.name AS tenant_name
       FROM gateway_alerts ga
       LEFT JOIN gateway_instances gi ON ga.instance_id = gi.instance_id
       LEFT JOIN tenants t ON ga.tenant_id = t.id
       ${whereClause}
       ORDER BY 
         CASE ga.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
         ga.created_at DESC
       LIMIT ${limit}`,
      params
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result.rows,
      }),
    };
  } catch (error) {
    logger.error('Failed to get gateway alerts', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to get alerts' }),
    };
  }
}

async function acknowledgeAlert(alertId: string, actorId: string): Promise<APIGatewayProxyResult> {
  try {
    await executeStatement(
      `UPDATE gateway_alerts SET
        status = 'acknowledged',
        acknowledged_at = NOW(),
        acknowledged_by = $2::uuid,
        updated_at = NOW()
       WHERE id = $1::uuid AND status = 'open'`,
      [uuidParam('id', alertId), uuidParam('actor', actorId)]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Alert acknowledged' }),
    };
  } catch (error) {
    logger.error('Failed to acknowledge alert', { error, alertId });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to acknowledge alert' }),
    };
  }
}

async function resolveAlert(
  alertId: string,
  actorId: string,
  notes?: string
): Promise<APIGatewayProxyResult> {
  try {
    await executeStatement(
      `UPDATE gateway_alerts SET
        status = 'resolved',
        resolved_at = NOW(),
        resolved_by = $2::uuid,
        resolution_notes = $3,
        updated_at = NOW()
       WHERE id = $1::uuid AND status IN ('open', 'acknowledged')`,
      [
        uuidParam('id', alertId),
        uuidParam('actor', actorId),
        stringParam('notes', notes || ''),
      ]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Alert resolved' }),
    };
  } catch (error) {
    logger.error('Failed to resolve alert', { error, alertId });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to resolve alert' }),
    };
  }
}

// ============================================================================
// Sessions
// ============================================================================

async function getSessions(
  tenantId: string,
  status?: string,
  protocol?: string,
  limit = 100
): Promise<APIGatewayProxyResult> {
  try {
    const conditions: string[] = ['tenant_id = $1::uuid'];
    const params: SqlParameter[] = [uuidParam('tenant', tenantId)];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(stringParam('status', status));
    }
    if (protocol) {
      conditions.push(`protocol = $${params.length + 1}`);
      params.push(stringParam('protocol', protocol));
    }

    const result = await executeQuery<{
      session_id: string;
      protocol: string;
      status: string;
      connected_at: string;
      last_message_at: string;
      messages_sent: number;
      messages_received: number;
      client_ip: string;
    }>(
      `SELECT 
        session_id, protocol, status, connected_at, last_message_at,
        messages_sent, messages_received, client_ip
       FROM gateway_sessions
       WHERE ${conditions.join(' AND ')}
       ORDER BY connected_at DESC
       LIMIT ${limit}`,
      params
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result.rows,
      }),
    };
  } catch (error) {
    logger.error('Failed to get gateway sessions', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to get sessions' }),
    };
  }
}

async function terminateSession(
  sessionId: string,
  reason: string,
  actorId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Mark session as draining (Gateway will pick this up and disconnect)
    await executeStatement(
      `UPDATE gateway_sessions SET
        status = 'draining',
        disconnect_reason = $2,
        updated_at = NOW()
       WHERE session_id = $1 AND status = 'active'`,
      [stringParam('sessionId', sessionId), stringParam('reason', reason)]
    );

    // Audit log
    await executeStatement(
      `INSERT INTO gateway_audit_log (actor_id, actor_type, action, resource_type, resource_id, metadata)
       VALUES ($1::uuid, 'admin', 'terminate_session', 'gateway_session', $2, $3::jsonb)`,
      [
        uuidParam('actor', actorId),
        stringParam('sessionId', sessionId),
        stringParam('metadata', JSON.stringify({ reason })),
      ]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Session termination initiated' }),
    };
  } catch (error) {
    logger.error('Failed to terminate session', { error, sessionId });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to terminate session' }),
    };
  }
}

// ============================================================================
// Maintenance Mode
// ============================================================================

async function setMaintenanceMode(
  tenantId: string | undefined,
  enabled: boolean,
  message: string,
  allowedIps: string[],
  actorId: string
): Promise<APIGatewayProxyResult> {
  try {
    await executeStatement(
      `UPDATE gateway_configuration SET
        maintenance_mode = $1,
        maintenance_message = $2,
        maintenance_allowed_ips = $3,
        updated_by = $4::uuid,
        updated_at = NOW()
       WHERE tenant_id ${tenantId ? '= $5::uuid' : 'IS NULL'}`,
      tenantId
        ? [
            stringParam('enabled', enabled.toString()),
            stringParam('message', message),
            stringParam('ips', JSON.stringify(allowedIps)),
            uuidParam('actor', actorId),
            uuidParam('tenant', tenantId),
          ]
        : [
            stringParam('enabled', enabled.toString()),
            stringParam('message', message),
            stringParam('ips', JSON.stringify(allowedIps)),
            uuidParam('actor', actorId),
          ]
    );

    // Audit log
    await executeStatement(
      `INSERT INTO gateway_audit_log (tenant_id, actor_id, actor_type, action, resource_type, changes)
       VALUES ($1::uuid, $2::uuid, 'admin', 'set_maintenance_mode', 'gateway_configuration', $3::jsonb)`,
      [
        uuidParam('tenant', tenantId || ''),
        uuidParam('actor', actorId),
        stringParam('changes', JSON.stringify({ enabled, message, allowedIps })),
      ]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
      }),
    };
  } catch (error) {
    logger.error('Failed to set maintenance mode', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to set maintenance mode' }),
    };
  }
}

// ============================================================================
// Instances
// ============================================================================

async function getInstances(): Promise<APIGatewayProxyResult> {
  try {
    const result = await executeQuery<GatewayInstance>(
      `SELECT 
        gi.*,
        (SELECT COUNT(*) FROM gateway_sessions gs WHERE gs.instance_id = gi.instance_id AND gs.status = 'active') AS active_sessions,
        (SELECT json_build_object(
          'connections', COALESCE(SUM(active_connections), 0),
          'messages', COALESCE(SUM(messages_inbound + messages_outbound), 0),
          'cpu', COALESCE(AVG(cpu_percent), 0),
          'memory', COALESCE(AVG(memory_percent), 0)
        ) FROM gateway_statistics WHERE instance_id = gi.instance_id AND bucket_start >= NOW() - INTERVAL '5 minutes') AS current_stats
       FROM gateway_instances gi
       ORDER BY gi.started_at DESC`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result.rows,
      }),
    };
  } catch (error) {
    logger.error('Failed to get gateway instances', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to get instances' }),
    };
  }
}

async function drainInstance(instanceId: string, actorId: string): Promise<APIGatewayProxyResult> {
  try {
    await executeStatement(
      `UPDATE gateway_instances SET
        status = 'draining',
        updated_at = NOW()
       WHERE instance_id = $1 AND status = 'active'`,
      [stringParam('instanceId', instanceId)]
    );

    // Audit log
    await executeStatement(
      `INSERT INTO gateway_audit_log (actor_id, actor_type, action, resource_type, resource_id)
       VALUES ($1::uuid, 'admin', 'drain_instance', 'gateway_instance', $2)`,
      [uuidParam('actor', actorId), stringParam('instanceId', instanceId)]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Instance drain initiated' }),
    };
  } catch (error) {
    logger.error('Failed to drain instance', { error, instanceId });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to drain instance' }),
    };
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/api\/admin\/gateway/, '');
  const tenantId = event.queryStringParameters?.tenant_id;
  const actorId = event.requestContext.authorizer?.claims?.sub || 'system';

  logger.info('Gateway admin request', { method, path, tenantId });

  try {
    // Dashboard
    if (path === '/dashboard' && method === 'GET') {
      return getDashboard(tenantId);
    }

    // Statistics
    if (path === '/statistics' && method === 'GET') {
      const { start_date, end_date, granularity } = event.queryStringParameters || {};
      if (!start_date || !end_date) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: 'start_date and end_date required' }),
        };
      }
      return getStatistics(tenantId, start_date, end_date, granularity as 'minute' | 'hour' | 'day');
    }

    // Configuration
    if (path === '/configuration' && method === 'GET') {
      return getConfiguration(tenantId);
    }
    if (path === '/configuration' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      return updateConfiguration(tenantId, body, actorId);
    }

    // Maintenance mode
    if (path === '/maintenance' && method === 'POST') {
      const { enabled, message, allowed_ips } = JSON.parse(event.body || '{}');
      return setMaintenanceMode(tenantId, enabled, message, allowed_ips || [], actorId);
    }

    // Alerts
    if (path === '/alerts' && method === 'GET') {
      const { status, severity, limit } = event.queryStringParameters || {};
      return getAlerts(tenantId, status, severity, limit ? parseInt(limit) : 50);
    }
    if (path.match(/^\/alerts\/[^/]+\/acknowledge$/) && method === 'POST') {
      const alertId = path.split('/')[2];
      return acknowledgeAlert(alertId, actorId);
    }
    if (path.match(/^\/alerts\/[^/]+\/resolve$/) && method === 'POST') {
      const alertId = path.split('/')[2];
      const { notes } = JSON.parse(event.body || '{}');
      return resolveAlert(alertId, actorId, notes);
    }

    // Sessions
    if (path === '/sessions' && method === 'GET') {
      if (!tenantId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: 'tenant_id required' }),
        };
      }
      const { status, protocol, limit } = event.queryStringParameters || {};
      return getSessions(tenantId, status, protocol, limit ? parseInt(limit) : 100);
    }
    if (path.match(/^\/sessions\/[^/]+\/terminate$/) && method === 'POST') {
      const sessionId = path.split('/')[2];
      const { reason } = JSON.parse(event.body || '{}');
      return terminateSession(sessionId, reason || 'Admin terminated', actorId);
    }

    // Instances
    if (path === '/instances' && method === 'GET') {
      return getInstances();
    }
    if (path.match(/^\/instances\/[^/]+\/drain$/) && method === 'POST') {
      const instanceId = path.split('/')[2];
      return drainInstance(instanceId, actorId);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ success: false, error: 'Not found' }),
    };
  } catch (error) {
    logger.error('Gateway admin error', { error, path, method });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
};
