// RADIANT v4.18.0 - Think Tank Domain Modes Lambda Handler
// API endpoints for admin management of domain mode configurations

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';
import { requireAdmin } from '../shared/auth/admin-auth';

interface ModeConfig {
  enabled: boolean;
  defaultModel: string;
  temperature: number;
  systemPrompt: string;
}

interface DomainModesConfig {
  modes: Record<string, ModeConfig>;
}

// GET /api/admin/thinktank/domain-modes
export async function getDomainModes(
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
        WHERE tenant_id = $1 AND config_key = 'thinktank_domain_modes'
        `,
        [admin.tenantId]
      );

      if (result.rows.length === 0) {
        // Return default configuration
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            modes: {
              general: { enabled: true, defaultModel: 'auto', temperature: 0.7, systemPrompt: '' },
              medical: { enabled: true, defaultModel: 'auto', temperature: 0.3, systemPrompt: '' },
              legal: { enabled: true, defaultModel: 'auto', temperature: 0.3, systemPrompt: '' },
              code: { enabled: true, defaultModel: 'auto', temperature: 0.2, systemPrompt: '' },
              academic: { enabled: true, defaultModel: 'auto', temperature: 0.5, systemPrompt: '' },
              creative: { enabled: true, defaultModel: 'auto', temperature: 0.9, systemPrompt: '' },
              scientific: { enabled: true, defaultModel: 'auto', temperature: 0.4, systemPrompt: '' },
            },
          }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.rows[0].config_value),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get domain modes', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load domain modes' }),
    };
  }
}

// PUT /api/admin/thinktank/domain-modes
export async function updateDomainModes(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const config: DomainModesConfig = JSON.parse(event.body || '{}');
    const client = await getPoolClient();

    try {
      await client.query(
        `
        INSERT INTO dynamic_config (tenant_id, config_key, config_value, updated_by)
        VALUES ($1, 'thinktank_domain_modes', $2, $3)
        ON CONFLICT (tenant_id, config_key) DO UPDATE SET
          config_value = $2,
          updated_by = $3,
          updated_at = NOW()
        `,
        [admin.tenantId, JSON.stringify(config), admin.id]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update domain modes', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save domain modes' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/thinktank/domain-modes') {
    if (method === 'GET') return getDomainModes(event);
    if (method === 'PUT') return updateDomainModes(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
