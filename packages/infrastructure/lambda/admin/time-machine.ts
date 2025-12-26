// RADIANT v4.18.0 - Time Machine Admin Lambda Handler
// API endpoints for admin management of chat history snapshots

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';
import { requireAdmin } from '../shared/auth/admin-auth';

// GET /api/admin/time-machine/snapshots
export async function listSnapshots(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const search = event.queryStringParameters?.search || '';
    const type = event.queryStringParameters?.type || 'all';
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

    const client = await getPoolClient();

    try {
      let whereClause = 'WHERE s.tenant_id = $1';
      const params: (string | number)[] = [admin.tenantId];
      let paramIndex = 2;

      if (search) {
        whereClause += ` AND (u.email ILIKE $${paramIndex} OR s.label ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (type !== 'all') {
        whereClause += ` AND s.snapshot_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      params.push(limit, offset);

      const result = await client.query(
        `
        SELECT 
          s.id,
          s.session_id,
          s.user_id,
          u.email as user_email,
          s.snapshot_type,
          s.label,
          s.message_count,
          s.total_tokens,
          s.parent_snapshot_id,
          s.created_at
        FROM time_machine_snapshots s
        JOIN users u ON s.user_id = u.id
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${paramIndex - 1} OFFSET $${paramIndex}
        `,
        params
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          data: result.rows.map((row) => ({
            id: row.id,
            sessionId: row.session_id,
            userId: row.user_id,
            userEmail: row.user_email,
            snapshotType: row.snapshot_type,
            label: row.label,
            messageCount: row.message_count || 0,
            totalTokens: row.total_tokens || 0,
            parentSnapshotId: row.parent_snapshot_id,
            createdAt: row.created_at,
          })),
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list snapshots', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load snapshots' }),
    };
  }
}

// GET /api/admin/time-machine/stats
export async function getStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await getPoolClient();

    try {
      const statsResult = await client.query(
        `
        SELECT 
          COUNT(*) as total_snapshots,
          COUNT(*) FILTER (WHERE snapshot_type = 'auto') as auto_snapshots,
          COUNT(*) FILTER (WHERE snapshot_type = 'manual') as manual_snapshots,
          COUNT(*) FILTER (WHERE snapshot_type = 'branch') as branch_snapshots,
          COALESCE(SUM(pg_column_size(snapshot_data)) / 1024.0 / 1024.0, 0) as storage_used_mb
        FROM time_machine_snapshots
        WHERE tenant_id = $1
        `,
        [admin.tenantId]
      );

      const stats = statsResult.rows[0];

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          totalSnapshots: parseInt(stats.total_snapshots, 10) || 0,
          autoSnapshots: parseInt(stats.auto_snapshots, 10) || 0,
          manualSnapshots: parseInt(stats.manual_snapshots, 10) || 0,
          branchSnapshots: parseInt(stats.branch_snapshots, 10) || 0,
          storageUsedMb: parseFloat(stats.storage_used_mb) || 0,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get stats', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load stats' }),
    };
  }
}

// GET /api/admin/time-machine/snapshots/:id
export async function getSnapshot(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const snapshotId = event.pathParameters?.id;

    if (!snapshotId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'snapshotId is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        SELECT 
          id,
          snapshot_data,
          metadata
        FROM time_machine_snapshots
        WHERE id = $1 AND tenant_id = $2
        `,
        [snapshotId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Snapshot not found' }),
        };
      }

      const snapshot = result.rows[0];
      const data = snapshot.snapshot_data || {};

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          id: snapshot.id,
          messages: data.messages || [],
          metadata: snapshot.metadata || {},
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get snapshot', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load snapshot' }),
    };
  }
}

// DELETE /api/admin/time-machine/snapshots/:id
export async function deleteSnapshot(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const snapshotId = event.pathParameters?.id;

    if (!snapshotId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'snapshotId is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      const result = await client.query(
        `DELETE FROM time_machine_snapshots WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [snapshotId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Snapshot not found' }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to delete snapshot', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete snapshot' }),
    };
  }
}

// POST /api/admin/time-machine/purge - Purge old snapshots
export async function purgeOldSnapshots(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const { daysOld = 90, snapshotType } = JSON.parse(event.body || '{}');

    const client = await getPoolClient();

    try {
      let whereClause = `tenant_id = $1 AND created_at < NOW() - $2 * INTERVAL '1 day'`;
      const params: (string | number)[] = [admin.tenantId, daysOld];

      if (snapshotType && snapshotType !== 'all') {
        whereClause += ` AND snapshot_type = $3`;
        params.push(snapshotType);
      }

      const result = await client.query(
        `DELETE FROM time_machine_snapshots WHERE ${whereClause} RETURNING id`,
        params
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          deletedCount: result.rows.length,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to purge snapshots', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to purge snapshots' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/time-machine/snapshots' && method === 'GET') {
    return listSnapshots(event);
  }

  if (path === '/api/admin/time-machine/stats' && method === 'GET') {
    return getStats(event);
  }

  if (path === '/api/admin/time-machine/purge' && method === 'POST') {
    return purgeOldSnapshots(event);
  }

  if (path.match(/\/api\/admin\/time-machine\/snapshots\/[^/]+$/) && method === 'GET') {
    return getSnapshot(event);
  }

  if (path.match(/\/api\/admin\/time-machine\/snapshots\/[^/]+$/) && method === 'DELETE') {
    return deleteSnapshot(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
