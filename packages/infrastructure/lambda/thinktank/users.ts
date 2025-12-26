// RADIANT v4.18.0 - Think Tank Users Lambda Handler
// API endpoints for admin management of Think Tank users

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { logger } from '../shared/logger';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

interface Admin {
  id: string;
  tenantId: string;
}

async function requireAdmin(event: APIGatewayProxyEvent): Promise<Admin> {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader) {
    throw new Error('Unauthorized');
  }
  return { id: 'admin-id', tenantId: 'tenant-id' };
}

// GET /api/admin/thinktank/users
export async function listUsers(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const search = event.queryStringParameters?.search || '';
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    const client = await pool.connect();

    try {
      let whereClause = 'WHERE u.tenant_id = $1';
      const params: (string | number)[] = [admin.tenantId];
      let paramIndex = 2;

      if (search) {
        whereClause += ` AND (u.email ILIKE $${paramIndex} OR u.display_name ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      params.push(limit, offset);

      const result = await client.query(
        `
        SELECT 
          u.id,
          u.email,
          u.display_name,
          u.language,
          COALESCE(s.tier, 'free') as subscription_tier,
          COUNT(DISTINCT c.id) as conversation_count,
          COALESCE(SUM(c.total_tokens), 0) as total_tokens_used,
          COALESCE(SUM(c.total_cost), 0) as total_spent,
          MAX(c.updated_at) as last_active_at,
          CASE 
            WHEN u.is_active = false THEN 'suspended'
            WHEN MAX(c.updated_at) > NOW() - INTERVAL '30 days' THEN 'active'
            ELSE 'inactive'
          END as status
        FROM users u
        LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
        LEFT JOIN thinktank_conversations c ON u.id = c.user_id
        ${whereClause}
        GROUP BY u.id, u.email, u.display_name, u.language, u.is_active, s.tier
        ORDER BY MAX(c.updated_at) DESC NULLS LAST
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
            email: row.email,
            display_name: row.display_name,
            language: row.language,
            subscription_tier: row.subscription_tier,
            conversation_count: parseInt(row.conversation_count) || 0,
            total_tokens_used: parseInt(row.total_tokens_used) || 0,
            total_spent: parseFloat(row.total_spent) || 0,
            last_active_at: row.last_active_at,
            status: row.status,
          })),
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list users', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load users' }),
    };
  }
}

// GET /api/admin/thinktank/users/stats
export async function getUserStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await pool.connect();

    try {
      const statsResult = await client.query(
        `
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT u.id) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM thinktank_conversations c 
              WHERE c.user_id = u.id AND c.updated_at > NOW() - INTERVAL '7 days'
            )
          ) as active_users_7d,
          COUNT(DISTINCT u.id) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM subscriptions s 
              WHERE s.user_id = u.id AND s.status = 'active' AND s.tier != 'free'
            )
          ) as paid_users,
          COALESCE(SUM(c.total_cost), 0) as total_revenue
        FROM users u
        LEFT JOIN thinktank_conversations c ON u.id = c.user_id
        WHERE u.tenant_id = $1
        `,
        [admin.tenantId]
      );

      const stats = statsResult.rows[0];

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          totalUsers: parseInt(stats.total_users) || 0,
          activeUsers7d: parseInt(stats.active_users_7d) || 0,
          paidUsers: parseInt(stats.paid_users) || 0,
          totalRevenue: parseFloat(stats.total_revenue) || 0,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get user stats', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load stats' }),
    };
  }
}

// GET /api/admin/thinktank/users/:id
export async function getUser(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const userId = event.pathParameters?.id;

    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `
        SELECT 
          u.id,
          u.email,
          u.display_name,
          u.language,
          u.created_at,
          u.is_active,
          COALESCE(s.tier, 'free') as subscription_tier,
          s.started_at as subscription_started,
          COUNT(DISTINCT c.id) as conversation_count,
          COALESCE(SUM(c.total_tokens), 0) as total_tokens_used,
          COALESCE(SUM(c.total_cost), 0) as total_spent
        FROM users u
        LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
        LEFT JOIN thinktank_conversations c ON u.id = c.user_id
        WHERE u.id = $1 AND u.tenant_id = $2
        GROUP BY u.id, u.email, u.display_name, u.language, u.created_at, u.is_active, s.tier, s.started_at
        `,
        [userId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'User not found' }),
        };
      }

      const user = result.rows[0];

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          language: user.language,
          createdAt: user.created_at,
          isActive: user.is_active,
          subscriptionTier: user.subscription_tier,
          subscriptionStarted: user.subscription_started,
          conversationCount: parseInt(user.conversation_count) || 0,
          totalTokensUsed: parseInt(user.total_tokens_used) || 0,
          totalSpent: parseFloat(user.total_spent) || 0,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get user', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load user' }),
    };
  }
}

// PUT /api/admin/thinktank/users/:id/suspend
export async function suspendUser(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const userId = event.pathParameters?.id;

    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `
        UPDATE users SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
        `,
        [userId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'User not found' }),
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
    logger.error('Failed to suspend user', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to suspend user' }),
    };
  }
}

// PUT /api/admin/thinktank/users/:id/activate
export async function activateUser(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const userId = event.pathParameters?.id;

    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `
        UPDATE users SET is_active = true, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
        `,
        [userId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'User not found' }),
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
    logger.error('Failed to activate user', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to activate user' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/thinktank/users' && method === 'GET') {
    return listUsers(event);
  }

  if (path === '/api/admin/thinktank/users/stats' && method === 'GET') {
    return getUserStats(event);
  }

  if (path.match(/\/api\/admin\/thinktank\/users\/[^/]+$/) && method === 'GET') {
    return getUser(event);
  }

  if (path.match(/\/api\/admin\/thinktank\/users\/[^/]+\/suspend/) && method === 'PUT') {
    return suspendUser(event);
  }

  if (path.match(/\/api\/admin\/thinktank\/users\/[^/]+\/activate/) && method === 'PUT') {
    return activateUser(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
