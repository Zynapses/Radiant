// RADIANT v4.18.0 - Think Tank Conversations Lambda Handler
// API endpoints for admin management of Think Tank conversations

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

// GET /api/admin/thinktank/conversations
export async function listConversations(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const search = event.queryStringParameters?.search || '';
    const status = event.queryStringParameters?.status || 'all';
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    const client = await pool.connect();

    try {
      let whereClause = 'WHERE c.tenant_id = $1';
      const params: (string | number)[] = [admin.tenantId];
      let paramIndex = 2;

      if (search) {
        whereClause += ` AND (u.email ILIKE $${paramIndex} OR c.title ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (status !== 'all') {
        whereClause += ` AND c.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      params.push(limit, offset);

      const result = await client.query(
        `
        SELECT 
          c.id,
          c.user_id,
          u.email as user_email,
          c.title,
          c.message_count,
          c.total_tokens,
          c.total_cost,
          c.primary_model,
          c.domain_mode,
          c.created_at,
          c.updated_at,
          c.status
        FROM thinktank_conversations c
        JOIN users u ON c.user_id = u.id
        ${whereClause}
        ORDER BY c.updated_at DESC
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
            userId: row.user_id,
            userEmail: row.user_email,
            title: row.title,
            messageCount: row.message_count || 0,
            totalTokens: row.total_tokens || 0,
            totalCost: parseFloat(row.total_cost) || 0,
            primaryModel: row.primary_model,
            domainMode: row.domain_mode,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            status: row.status || 'active',
          })),
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list conversations', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load conversations' }),
    };
  }
}

// GET /api/admin/thinktank/conversations/stats
export async function getConversationStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await pool.connect();

    try {
      const statsResult = await client.query(
        `
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') as active_today,
          SUM(message_count) as total_messages,
          SUM(total_tokens) as total_tokens
        FROM thinktank_conversations
        WHERE tenant_id = $1
        `,
        [admin.tenantId]
      );

      const stats = statsResult.rows[0];

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          totalConversations: parseInt(stats.total_conversations) || 0,
          activeToday: parseInt(stats.active_today) || 0,
          totalMessages: parseInt(stats.total_messages) || 0,
          totalTokens: parseInt(stats.total_tokens) || 0,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get conversation stats', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load stats' }),
    };
  }
}

// GET /api/admin/thinktank/conversations/:id/messages
export async function getConversationMessages(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const conversationId = event.pathParameters?.id;

    if (!conversationId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'conversationId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      // Verify conversation belongs to tenant
      const convCheck = await client.query(
        `SELECT id FROM thinktank_conversations WHERE id = $1 AND tenant_id = $2`,
        [conversationId, admin.tenantId]
      );

      if (convCheck.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Conversation not found' }),
        };
      }

      const result = await client.query(
        `
        SELECT 
          id,
          role,
          content,
          model,
          tokens_used,
          created_at
        FROM thinktank_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        `,
        [conversationId]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          data: result.rows.map((row) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            model: row.model,
            tokensUsed: row.tokens_used,
            createdAt: row.created_at,
          })),
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get conversation messages', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load messages' }),
    };
  }
}

// DELETE /api/admin/thinktank/conversations/:id
export async function deleteConversation(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const conversationId = event.pathParameters?.id;

    if (!conversationId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'conversationId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `
        UPDATE thinktank_conversations 
        SET status = 'deleted', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
        `,
        [conversationId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Conversation not found' }),
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
    logger.error('Failed to delete conversation', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete conversation' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/thinktank/conversations' && method === 'GET') {
    return listConversations(event);
  }

  if (path === '/api/admin/thinktank/conversations/stats' && method === 'GET') {
    return getConversationStats(event);
  }

  if (path.match(/\/api\/admin\/thinktank\/conversations\/[^/]+\/messages/) && method === 'GET') {
    return getConversationMessages(event);
  }

  if (path.match(/\/api\/admin\/thinktank\/conversations\/[^/]+$/) && method === 'DELETE') {
    return deleteConversation(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
