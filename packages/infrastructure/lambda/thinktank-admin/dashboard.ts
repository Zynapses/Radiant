// RADIANT v4.18.0 - Think Tank Admin Dashboard Lambda Handler
// API endpoints for Think Tank Admin dashboard stats

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';
import { requireAdmin } from '../shared/auth/admin-auth';

interface DashboardStats {
  activeUsers: number;
  activeUsersChange: number;
  conversations: number;
  conversationsChange: number;
  userRules: number;
  userRulesChange: number;
  apiRequests: number;
  apiRequestsChange: number;
}

// GET /api/thinktank-admin/dashboard/stats
export async function getDashboardStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await getPoolClient();

    try {
      // Get current period stats (last 7 days)
      const currentPeriodResult = await client.query(
        `
        WITH current_stats AS (
          SELECT
            COUNT(DISTINCT u.id) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM thinktank_conversations c 
                WHERE c.user_id = u.id AND c.updated_at > NOW() - INTERVAL '7 days'
              )
            ) as active_users,
            (SELECT COUNT(*) FROM thinktank_conversations WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days') as conversations,
            (SELECT COUNT(*) FROM user_rules WHERE tenant_id = $1) as user_rules,
            (SELECT COUNT(*) FROM api_request_logs WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days') as api_requests
          FROM users u
          WHERE u.tenant_id = $1
        ),
        previous_stats AS (
          SELECT
            COUNT(DISTINCT u.id) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM thinktank_conversations c 
                WHERE c.user_id = u.id 
                  AND c.updated_at > NOW() - INTERVAL '14 days'
                  AND c.updated_at <= NOW() - INTERVAL '7 days'
              )
            ) as active_users,
            (SELECT COUNT(*) FROM thinktank_conversations WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '14 days' AND created_at <= NOW() - INTERVAL '7 days') as conversations,
            (SELECT COUNT(*) FROM user_rules WHERE tenant_id = $1 AND created_at <= NOW() - INTERVAL '7 days') as user_rules,
            (SELECT COUNT(*) FROM api_request_logs WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '14 days' AND created_at <= NOW() - INTERVAL '7 days') as api_requests
          FROM users u
          WHERE u.tenant_id = $1
        )
        SELECT 
          c.active_users as current_active_users,
          c.conversations as current_conversations,
          c.user_rules as current_user_rules,
          c.api_requests as current_api_requests,
          p.active_users as previous_active_users,
          p.conversations as previous_conversations,
          p.user_rules as previous_user_rules,
          p.api_requests as previous_api_requests
        FROM current_stats c, previous_stats p
        `,
        [admin.tenantId]
      );

      const stats = currentPeriodResult.rows[0] || {
        current_active_users: 0,
        current_conversations: 0,
        current_user_rules: 0,
        current_api_requests: 0,
        previous_active_users: 0,
        previous_conversations: 0,
        previous_user_rules: 0,
        previous_api_requests: 0,
      };

      const calcChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const dashboardStats: DashboardStats = {
        activeUsers: parseInt(stats.current_active_users, 10) || 0,
        activeUsersChange: calcChange(
          parseInt(stats.current_active_users, 10) || 0,
          parseInt(stats.previous_active_users, 10) || 0
        ),
        conversations: parseInt(stats.current_conversations, 10) || 0,
        conversationsChange: calcChange(
          parseInt(stats.current_conversations, 10) || 0,
          parseInt(stats.previous_conversations, 10) || 0
        ),
        userRules: parseInt(stats.current_user_rules, 10) || 0,
        userRulesChange: calcChange(
          parseInt(stats.current_user_rules, 10) || 0,
          parseInt(stats.previous_user_rules, 10) || 0
        ),
        apiRequests: parseInt(stats.current_api_requests, 10) || 0,
        apiRequestsChange: calcChange(
          parseInt(stats.current_api_requests, 10) || 0,
          parseInt(stats.previous_api_requests, 10) || 0
        ),
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(dashboardStats),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get dashboard stats', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load dashboard stats' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/thinktank-admin/dashboard/stats' && method === 'GET') {
    return getDashboardStats(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
