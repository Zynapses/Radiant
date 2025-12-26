// RADIANT v4.18.0 - Think Tank Model Categories Lambda Handler
// API endpoints for admin management of model categorization

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';
import { requireAdmin } from '../shared/auth/admin-auth';

// GET /api/admin/thinktank/model-categories
export async function listModelCategories(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAdmin(event);
    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        SELECT 
          m.id,
          m.display_name,
          m.provider_id,
          p.display_name as provider_name,
          m.is_novel,
          m.category,
          m.thinktank_enabled,
          m.thinktank_display_order,
          m.context_window,
          m.pricing
        FROM models m
        LEFT JOIN providers p ON m.provider_id = p.id
        WHERE m.is_enabled = true
        ORDER BY m.thinktank_display_order ASC, m.display_name ASC
        `
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(
          result.rows.map((row) => ({
            id: row.id,
            displayName: row.display_name,
            providerId: row.provider_id,
            providerName: row.provider_name,
            isNovel: row.is_novel || false,
            category: row.category || 'general',
            thinktankEnabled: row.thinktank_enabled !== false,
            thinktankDisplayOrder: row.thinktank_display_order || 100,
            contextWindow: row.context_window || 0,
            pricing: row.pricing || {},
          }))
        ),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list model categories', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load model categories' }),
    };
  }
}

// PATCH /api/admin/thinktank/model-categories/:modelId
export async function updateModelCategory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAdmin(event);
    const modelId = event.pathParameters?.modelId;

    if (!modelId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'modelId is required' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const client = await getPoolClient();

    try {
      const updates: string[] = [];
      const values: (string | number | boolean)[] = [modelId];
      let paramIndex = 2;

      if (typeof body.isNovel === 'boolean') {
        updates.push(`is_novel = $${paramIndex++}`);
        values.push(body.isNovel);
      }

      if (typeof body.thinktankEnabled === 'boolean') {
        updates.push(`thinktank_enabled = $${paramIndex++}`);
        values.push(body.thinktankEnabled);
      }

      if (typeof body.thinktankDisplayOrder === 'number') {
        updates.push(`thinktank_display_order = $${paramIndex++}`);
        values.push(body.thinktankDisplayOrder);
      }

      if (body.category) {
        updates.push(`category = $${paramIndex++}`);
        values.push(body.category);
      }

      if (updates.length === 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No updates provided' }),
        };
      }

      updates.push('updated_at = NOW()');

      const result = await client.query(
        `UPDATE models SET ${updates.join(', ')} WHERE id = $1 RETURNING id`,
        values
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Model not found' }),
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
    logger.error('Failed to update model category', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update model category' }),
    };
  }
}

// PUT /api/admin/thinktank/model-categories/reorder
export async function reorderModels(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAdmin(event);
    const { modelOrder } = JSON.parse(event.body || '{}');

    if (!Array.isArray(modelOrder)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'modelOrder array is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < modelOrder.length; i++) {
        await client.query(
          `UPDATE models SET thinktank_display_order = $1, updated_at = NOW() WHERE id = $2`,
          [i + 1, modelOrder[i]]
        );
      }

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to reorder models', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to reorder models' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/thinktank/model-categories' && method === 'GET') {
    return listModelCategories(event);
  }

  if (path === '/api/admin/thinktank/model-categories/reorder' && method === 'PUT') {
    return reorderModels(event);
  }

  if (path.match(/\/api\/admin\/thinktank\/model-categories\/[^/]+$/) && method === 'PATCH') {
    return updateModelCategory(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
