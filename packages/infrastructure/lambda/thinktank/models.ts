// RADIANT v4.18.0 - Think Tank Models Lambda Handler
// API endpoints for Think Tank model listing and user preferences

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { UnauthorizedError, ValidationError } from '../shared/errors';
import { corsHeaders } from '../shared/middleware/api-response';

interface User {
  id: string;
  tenantId: string;
}

interface JwtPayload {
  sub: string;
  'custom:tenant_id'?: string;
  tenant_id?: string;
  exp?: number;
  iat?: number;
}

function decodeJwt(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new UnauthorizedError('Invalid token format');
  }
  
  const payload = parts[1];
  const decoded = Buffer.from(payload, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

async function getUserFromToken(event: APIGatewayProxyEvent): Promise<User> {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader) {
    throw new UnauthorizedError('Missing authorization header');
  }
  
  const token = authHeader.replace(/^Bearer\s+/i, '');
  
  try {
    const payload = decodeJwt(token);
    
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedError('Token expired');
    }
    
    const tenantId = payload['custom:tenant_id'] || payload.tenant_id;
    if (!payload.sub || !tenantId) {
      throw new UnauthorizedError('Invalid token payload');
    }
    
    return { id: payload.sub, tenantId };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid token');
  }
}

// GET /api/thinktank/models - List available models for Think Tank users
export async function listModels(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
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
          m.context_window,
          m.capabilities,
          m.thinktank_enabled,
          m.pricing,
          COALESCE(
            mpo.custom_input_price,
            (m.pricing->>'input_tokens')::DECIMAL * (1 + COALESCE(mpo.markup_percent, pc.external_default_markup, 0.40))
          ) as user_input_price,
          COALESCE(
            mpo.custom_output_price,
            (m.pricing->>'output_tokens')::DECIMAL * (1 + COALESCE(mpo.markup_percent, pc.external_default_markup, 0.40))
          ) as user_output_price,
          $1 = ANY(COALESCE(ump.favorite_models, '[]')::text[]) as is_favorite
        FROM models m
        LEFT JOIN providers p ON m.provider_id = p.id
        LEFT JOIN pricing_config pc ON pc.tenant_id = $2
        LEFT JOIN model_pricing_overrides mpo ON m.id = mpo.model_id AND mpo.tenant_id = $2
        LEFT JOIN thinktank_user_model_preferences ump ON ump.user_id = $1
        WHERE m.thinktank_enabled = true
          AND m.is_enabled = true
        ORDER BY 
          m.is_novel ASC,
          m.thinktank_display_order ASC,
          m.display_name ASC
        `,
        [user.id, user.tenantId]
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
            isNovel: row.is_novel,
            category: row.category,
            contextWindow: row.context_window,
            capabilities: row.capabilities || [],
            userInputPrice: parseFloat(row.user_input_price) || 0,
            userOutputPrice: parseFloat(row.user_output_price) || 0,
            isFavorite: row.is_favorite,
          }))
        ),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list models', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load models' }),
    };
  }
}

// GET /api/thinktank/preferences/models - Get user's model preferences
export async function getModelPreferences(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        SELECT 
          selection_mode,
          default_model_id,
          favorite_models,
          show_standard_models,
          show_novel_models,
          show_self_hosted_models,
          show_cost_per_message,
          max_cost_per_message,
          prefer_cost_optimization,
          domain_mode_model_overrides,
          recent_models
        FROM thinktank_user_model_preferences
        WHERE user_id = $1
        `,
        [user.id]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            selectionMode: 'auto',
            defaultModelId: null,
            favoriteModels: [],
            showStandardModels: true,
            showNovelModels: true,
            showSelfHostedModels: false,
            showCostPerMessage: true,
            maxCostPerMessage: null,
            preferCostOptimization: false,
            domainModeModelOverrides: {},
            recentModels: [],
          }),
        };
      }

      const row = result.rows[0];
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          selectionMode: row.selection_mode,
          defaultModelId: row.default_model_id,
          favoriteModels: row.favorite_models || [],
          showStandardModels: row.show_standard_models,
          showNovelModels: row.show_novel_models,
          showSelfHostedModels: row.show_self_hosted_models,
          showCostPerMessage: row.show_cost_per_message,
          maxCostPerMessage: row.max_cost_per_message
            ? parseFloat(row.max_cost_per_message)
            : null,
          preferCostOptimization: row.prefer_cost_optimization,
          domainModeModelOverrides: row.domain_mode_model_overrides || {},
          recentModels: row.recent_models || [],
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get model preferences', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load preferences' }),
    };
  }
}

// PUT /api/thinktank/preferences/models - Update user's model preferences
export async function updateModelPreferences(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const body = JSON.parse(event.body || '{}');
    const client = await getPoolClient();

    try {
      await client.query(
        `
        INSERT INTO thinktank_user_model_preferences (
          user_id, tenant_id, selection_mode, default_model_id, favorite_models,
          show_standard_models, show_novel_models, show_self_hosted_models,
          show_cost_per_message, max_cost_per_message, prefer_cost_optimization,
          domain_mode_model_overrides
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id) DO UPDATE SET
          selection_mode = COALESCE($3, thinktank_user_model_preferences.selection_mode),
          default_model_id = COALESCE($4, thinktank_user_model_preferences.default_model_id),
          favorite_models = COALESCE($5, thinktank_user_model_preferences.favorite_models),
          show_standard_models = COALESCE($6, thinktank_user_model_preferences.show_standard_models),
          show_novel_models = COALESCE($7, thinktank_user_model_preferences.show_novel_models),
          show_self_hosted_models = COALESCE($8, thinktank_user_model_preferences.show_self_hosted_models),
          show_cost_per_message = COALESCE($9, thinktank_user_model_preferences.show_cost_per_message),
          max_cost_per_message = $10,
          prefer_cost_optimization = COALESCE($11, thinktank_user_model_preferences.prefer_cost_optimization),
          domain_mode_model_overrides = COALESCE($12, thinktank_user_model_preferences.domain_mode_model_overrides),
          updated_at = NOW()
        `,
        [
          user.id,
          user.tenantId,
          body.selectionMode,
          body.defaultModelId,
          JSON.stringify(body.favoriteModels || []),
          body.showStandardModels,
          body.showNovelModels,
          body.showSelfHostedModels,
          body.showCostPerMessage,
          body.maxCostPerMessage,
          body.preferCostOptimization,
          JSON.stringify(body.domainModeModelOverrides || {}),
        ]
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
    logger.error('Failed to update model preferences', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save preferences' }),
    };
  }
}

// POST /api/thinktank/preferences/models/favorite - Toggle favorite model
export async function toggleFavoriteModel(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const { modelId } = JSON.parse(event.body || '{}');

    if (!modelId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'modelId is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      const currentResult = await client.query(
        `SELECT favorite_models FROM thinktank_user_model_preferences WHERE user_id = $1`,
        [user.id]
      );

      let favorites: string[] = currentResult.rows[0]?.favorite_models || [];

      if (favorites.includes(modelId)) {
        favorites = favorites.filter((id) => id !== modelId);
      } else {
        favorites.push(modelId);
      }

      await client.query(
        `
        INSERT INTO thinktank_user_model_preferences (user_id, tenant_id, favorite_models)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
          favorite_models = $3,
          updated_at = NOW()
        `,
        [user.id, user.tenantId, JSON.stringify(favorites)]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          isFavorite: favorites.includes(modelId),
          favoriteModels: favorites,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to toggle favorite', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update favorites' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/thinktank/models' && method === 'GET') {
    return listModels(event);
  }

  if (path === '/api/thinktank/preferences/models') {
    if (method === 'GET') return getModelPreferences(event);
    if (method === 'PUT') return updateModelPreferences(event);
  }

  if (path === '/api/thinktank/preferences/models/favorite' && method === 'POST') {
    return toggleFavoriteModel(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
