// RADIANT v4.18.0 - Think Tank Analytics Lambda Handler
// API endpoints for Think Tank analytics and usage metrics

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';
import { requireAdmin } from '../shared/auth/admin-auth';

interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  totalConversations: number;
  totalMessages: number;
  avgMessagesPerUser: number;
  avgSessionDuration: number;
  totalTokensUsed: number;
  totalCost: number;
}

interface UsageTrend {
  date: string;
  users: number;
  conversations: number;
  messages: number;
  tokens: number;
  cost: number;
}

interface ModelUsage {
  modelId: string;
  modelName: string;
  requests: number;
  tokens: number;
  cost: number;
  avgLatency: number;
}

interface Analytics {
  overview: AnalyticsOverview;
  trends: UsageTrend[];
  modelUsage: ModelUsage[];
}

// GET /api/admin/thinktank/analytics?days=7|30|90
export async function getAnalytics(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const days = parseInt(event.queryStringParameters?.days || '30', 10);
    const validDays = [7, 30, 90].includes(days) ? days : 30;

    const client = await getPoolClient();

    try {
      // Get overview stats
      const overviewResult = await client.query(
        `
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT u.id) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM thinktank_conversations c 
              WHERE c.user_id = u.id AND c.updated_at > NOW() - INTERVAL '${validDays} days'
            )
          ) as active_users,
          (SELECT COUNT(*) FROM thinktank_conversations WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${validDays} days') as total_conversations,
          (SELECT COALESCE(SUM(message_count), 0) FROM thinktank_conversations WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${validDays} days') as total_messages,
          (SELECT COALESCE(SUM(total_tokens), 0) FROM thinktank_conversations WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${validDays} days') as total_tokens,
          (SELECT COALESCE(SUM(total_cost), 0) FROM thinktank_conversations WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${validDays} days') as total_cost,
          (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000), 0) FROM thinktank_conversations WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${validDays} days') as avg_session_duration
        FROM users u
        WHERE u.tenant_id = $1
        `,
        [admin.tenantId]
      );

      const overview = overviewResult.rows[0];
      const totalUsers = parseInt(overview.total_users, 10) || 0;
      const totalMessages = parseInt(overview.total_messages, 10) || 0;

      const analyticsOverview: AnalyticsOverview = {
        totalUsers,
        activeUsers: parseInt(overview.active_users, 10) || 0,
        totalConversations: parseInt(overview.total_conversations, 10) || 0,
        totalMessages,
        avgMessagesPerUser: totalUsers > 0 ? totalMessages / totalUsers : 0,
        avgSessionDuration: parseFloat(overview.avg_session_duration) || 0,
        totalTokensUsed: parseInt(overview.total_tokens, 10) || 0,
        totalCost: parseFloat(overview.total_cost) || 0,
      };

      // Get daily trends
      const trendsResult = await client.query(
        `
        SELECT 
          DATE(c.created_at) as date,
          COUNT(DISTINCT c.user_id) as users,
          COUNT(*) as conversations,
          COALESCE(SUM(c.message_count), 0) as messages,
          COALESCE(SUM(c.total_tokens), 0) as tokens,
          COALESCE(SUM(c.total_cost), 0) as cost
        FROM thinktank_conversations c
        WHERE c.tenant_id = $1 AND c.created_at > NOW() - INTERVAL '${validDays} days'
        GROUP BY DATE(c.created_at)
        ORDER BY date DESC
        `,
        [admin.tenantId]
      );

      const trends: UsageTrend[] = trendsResult.rows.map((row) => ({
        date: row.date,
        users: parseInt(row.users, 10) || 0,
        conversations: parseInt(row.conversations, 10) || 0,
        messages: parseInt(row.messages, 10) || 0,
        tokens: parseInt(row.tokens, 10) || 0,
        cost: parseFloat(row.cost) || 0,
      }));

      // Get model usage breakdown
      const modelUsageResult = await client.query(
        `
        SELECT 
          m.model,
          COALESCE(md.display_name, m.model) as model_name,
          COUNT(*) as requests,
          COALESCE(SUM(m.tokens_used), 0) as tokens,
          COALESCE(SUM(m.cost), 0) as cost,
          COALESCE(AVG(m.latency_ms), 0) as avg_latency
        FROM thinktank_messages m
        JOIN thinktank_conversations c ON m.conversation_id = c.id
        LEFT JOIN models md ON m.model = md.id
        WHERE c.tenant_id = $1 
          AND m.created_at > NOW() - INTERVAL '${validDays} days'
          AND m.role = 'assistant'
        GROUP BY m.model, md.display_name
        ORDER BY requests DESC
        LIMIT 20
        `,
        [admin.tenantId]
      );

      const modelUsage: ModelUsage[] = modelUsageResult.rows.map((row) => ({
        modelId: row.model,
        modelName: row.model_name,
        requests: parseInt(row.requests, 10) || 0,
        tokens: parseInt(row.tokens, 10) || 0,
        cost: parseFloat(row.cost) || 0,
        avgLatency: parseFloat(row.avg_latency) || 0,
      }));

      const analytics: Analytics = {
        overview: analyticsOverview,
        trends,
        modelUsage,
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(analytics),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get analytics', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load analytics' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/thinktank/analytics' && method === 'GET') {
    return getAnalytics(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
