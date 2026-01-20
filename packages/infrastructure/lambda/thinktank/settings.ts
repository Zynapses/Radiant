// RADIANT v4.18.0 - Think Tank Settings Lambda Handler
// API endpoints for Think Tank status and configuration

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';
import { requireAdmin } from '../shared/auth/admin-auth';

interface ThinkTankHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  activeUsers: number;
  activeConversations: number;
  errorRate: number;
}

interface ThinkTankStatus {
  installed: boolean;
  version: string | null;
  dataRetained: boolean;
  health: ThinkTankHealth | null;
}

interface ThinkTankConfig {
  maxUsersPerTenant: number;
  maxConversationsPerUser: number;
  maxTokensPerConversation: number;
  enabledModels: string[];
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  features: {
    collaboration: boolean;
    voiceInput: boolean;
    codeExecution: boolean;
    fileUploads: boolean;
    imageGeneration: boolean;
  };
}

const DEFAULT_CONFIG: ThinkTankConfig = {
  maxUsersPerTenant: 1000,
  maxConversationsPerUser: 100,
  maxTokensPerConversation: 100000,
  enabledModels: [],
  rateLimits: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
  },
  features: {
    collaboration: true,
    voiceInput: false,
    codeExecution: false,
    fileUploads: true,
    imageGeneration: false,
  },
};

// GET /api/admin/thinktank/status
export async function getStatus(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await getPoolClient();

    try {
      // Check if Think Tank is installed by checking for thinktank_conversations table
      const tableCheck = await client.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'thinktank_conversations'
        ) as installed
        `
      );

      const installed = tableCheck.rows[0]?.installed === true;

      if (!installed) {
        const status: ThinkTankStatus = {
          installed: false,
          version: null,
          dataRetained: false,
          health: null,
        };

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(status),
        };
      }

      // Get health metrics
      const healthResult = await client.query(
        `
        SELECT 
          COUNT(DISTINCT user_id) FILTER (WHERE updated_at > NOW() - INTERVAL '15 minutes') as active_users,
          COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '15 minutes') as active_conversations,
          (SELECT COALESCE(AVG(latency_ms), 0) FROM thinktank_messages WHERE created_at > NOW() - INTERVAL '1 hour') as avg_latency,
          (SELECT COUNT(*) FILTER (WHERE status = 'error') * 1.0 / NULLIF(COUNT(*), 0) FROM thinktank_messages WHERE created_at > NOW() - INTERVAL '1 hour') as error_rate
        FROM thinktank_conversations
        WHERE tenant_id = $1
        `,
        [admin.tenantId]
      );

      const health = healthResult.rows[0];
      const errorRate = parseFloat(health.error_rate) || 0;
      const latencyMs = parseFloat(health.avg_latency) || 0;

      let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (errorRate > 0.1 || latencyMs > 10000) {
        healthStatus = 'unhealthy';
      } else if (errorRate > 0.05 || latencyMs > 5000) {
        healthStatus = 'degraded';
      }

      // Get version from dynamic_config
      const versionResult = await client.query(
        `
        SELECT config_value->>'version' as version
        FROM dynamic_config
        WHERE tenant_id = $1 AND config_key = 'thinktank_status'
        `,
        [admin.tenantId]
      );

      const status: ThinkTankStatus = {
        installed: true,
        version: versionResult.rows[0]?.version || '4.18.0',
        dataRetained: true,
        health: {
          status: healthStatus,
          latencyMs,
          activeUsers: parseInt(health.active_users, 10) || 0,
          activeConversations: parseInt(health.active_conversations, 10) || 0,
          errorRate,
        },
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(status),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get status', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load status' }),
    };
  }
}

// GET /api/admin/thinktank/config
export async function getConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        SELECT config_value 
        FROM dynamic_config 
        WHERE tenant_id = $1 AND config_key = 'thinktank_config'
        `,
        [admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(DEFAULT_CONFIG),
        };
      }

      const config = { ...DEFAULT_CONFIG, ...result.rows[0].config_value };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(config),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get config', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load config' }),
    };
  }
}

// PATCH /api/admin/thinktank/config
export async function updateConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const updates = JSON.parse(event.body || '{}');
    const client = await getPoolClient();

    try {
      // Get existing config
      const existingResult = await client.query(
        `
        SELECT config_value 
        FROM dynamic_config 
        WHERE tenant_id = $1 AND config_key = 'thinktank_config'
        `,
        [admin.tenantId]
      );

      const existingConfig = existingResult.rows[0]?.config_value || DEFAULT_CONFIG;
      const newConfig = { ...existingConfig, ...updates };

      // Validate config
      if (newConfig.maxUsersPerTenant < 1 || newConfig.maxUsersPerTenant > 100000) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'maxUsersPerTenant must be between 1 and 100000' }),
        };
      }

      if (newConfig.maxConversationsPerUser < 1 || newConfig.maxConversationsPerUser > 10000) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'maxConversationsPerUser must be between 1 and 10000' }),
        };
      }

      // Upsert config
      await client.query(
        `
        INSERT INTO dynamic_config (tenant_id, config_key, config_value, updated_by)
        VALUES ($1, 'thinktank_config', $2, $3)
        ON CONFLICT (tenant_id, config_key) DO UPDATE SET
          config_value = $2,
          updated_by = $3,
          updated_at = NOW()
        `,
        [admin.tenantId, JSON.stringify(newConfig), admin.id]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(newConfig),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update config', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update config' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/thinktank/status' && method === 'GET') {
    return getStatus(event);
  }

  if (path === '/api/admin/thinktank/config') {
    if (method === 'GET') return getConfig(event);
    if (method === 'PATCH') return updateConfig(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
