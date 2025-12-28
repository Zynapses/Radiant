// RADIANT v4.18.0 - Think Tank Models Lambda Handler
// API endpoints for Think Tank model listing and user preferences
// Integrated with Domain Taxonomy Service for intelligent model selection

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { UnauthorizedError, ValidationError } from '../shared/errors';
import { corsHeaders } from '../shared/middleware/api-response';
import { domainTaxonomyService } from '../shared/services';

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

// POST /api/thinktank/models/recommend - Get model recommendations for prompt/domain
export async function recommendModels(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await getUserFromToken(event);
    const body = JSON.parse(event.body || '{}');

    let proficiencies;
    let detectionResult;

    // Option 1: Detect from prompt
    if (body.prompt) {
      detectionResult = await domainTaxonomyService.detectDomain(body.prompt, {
        include_subspecialties: true,
        min_confidence: 0.3,
      });
      proficiencies = detectionResult.merged_proficiencies;
    }
    // Option 2: Use provided domain ID
    else if (body.domainId) {
      const taxonomy = await domainTaxonomyService.getTaxonomy();
      for (const field of taxonomy.fields) {
        const domain = field.domains.find(d => d.domain_id === body.domainId);
        if (domain) {
          proficiencies = domainTaxonomyService.mergeProficiencies(field, domain);
          break;
        }
      }
    }

    if (!proficiencies) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'prompt or domainId is required' }),
      };
    }

    // Get matching models
    const matches = await domainTaxonomyService.getMatchingModels(proficiencies, {
      max_models: body.maxModels || 5,
      min_match_score: body.minMatchScore || 50,
      include_self_hosted: body.includeSelfHosted ?? true,
    });

    // Determine recommended mode
    let recommendedMode = 'thinking';
    if (proficiencies.reasoning_depth >= 9 && proficiencies.multi_step_problem_solving >= 9) {
      recommendedMode = 'extended_thinking';
    } else if (proficiencies.code_generation >= 8) {
      recommendedMode = 'coding';
    } else if (proficiencies.creative_generative >= 8) {
      recommendedMode = 'creative';
    } else if (proficiencies.research_synthesis >= 8) {
      recommendedMode = 'research';
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        domainDetection: detectionResult ? {
          fieldId: detectionResult.primary_field?.field_id,
          fieldName: detectionResult.primary_field?.field_name,
          domainId: detectionResult.primary_domain?.domain_id,
          domainName: detectionResult.primary_domain?.domain_name,
          subspecialtyId: detectionResult.primary_subspecialty?.subspecialty_id,
          subspecialtyName: detectionResult.primary_subspecialty?.subspecialty_name,
          confidence: detectionResult.detection_confidence,
        } : null,
        proficiencies,
        recommendedMode,
        models: matches.map(m => ({
          modelId: m.model_id,
          modelName: m.model_name,
          provider: m.provider,
          matchScore: m.match_score,
          strengths: m.strengths,
          weaknesses: m.weaknesses,
          isRecommended: m.recommended,
          ranking: m.ranking,
        })),
        primaryModel: matches.find(m => m.recommended)?.model_id || matches[0]?.model_id,
      }),
    };
  } catch (error) {
    logger.error('Failed to recommend models', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get model recommendations' }),
    };
  }
}

// GET /api/thinktank/domain-selection - Get user's current domain selection
export async function getDomainSelection(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const sessionId = event.queryStringParameters?.sessionId;
    const client = await getPoolClient();

    try {
      let query = `SELECT * FROM domain_taxonomy_selections 
                   WHERE tenant_id = $1 AND user_id = $2`;
      const params: (string)[] = [user.tenantId, user.id];

      if (sessionId) {
        query += ` AND session_id = $3 ORDER BY created_at DESC LIMIT 1`;
        params.push(sessionId);
      } else {
        query += ` AND is_default = true ORDER BY created_at DESC LIMIT 1`;
      }

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ selection: null }),
        };
      }

      const row = result.rows[0];
      
      // Get domain details from taxonomy
      let domainDetails = null;
      if (row.domain_id) {
        const taxonomy = await domainTaxonomyService.getTaxonomy();
        for (const field of taxonomy.fields) {
          const domain = field.domains.find(d => d.domain_id === row.domain_id);
          if (domain) {
            domainDetails = {
              fieldId: field.field_id,
              fieldName: field.field_name,
              fieldIcon: field.field_icon,
              domainId: domain.domain_id,
              domainName: domain.domain_name,
              domainIcon: domain.domain_icon,
            };
            break;
          }
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          selection: {
            fieldId: row.field_id,
            domainId: row.domain_id,
            subspecialtyId: row.subspecialty_id,
            isDefault: row.is_default,
            createdAt: row.created_at,
          },
          domainDetails,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get domain selection', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get domain selection' }),
    };
  }
}

// POST /api/thinktank/domain-selection - Save domain selection
export async function saveDomainSelection(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const body = JSON.parse(event.body || '{}');
    const client = await getPoolClient();

    try {
      await client.query(
        `INSERT INTO domain_taxonomy_selections 
         (tenant_id, user_id, field_id, domain_id, subspecialty_id, session_id, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user.tenantId,
          user.id,
          body.fieldId || null,
          body.domainId || null,
          body.subspecialtyId || null,
          body.sessionId || null,
          body.isDefault ?? false,
        ]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ saved: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to save domain selection', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save domain selection' }),
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

  if (path === '/api/thinktank/models/recommend' && method === 'POST') {
    return recommendModels(event);
  }

  if (path === '/api/thinktank/preferences/models') {
    if (method === 'GET') return getModelPreferences(event);
    if (method === 'PUT') return updateModelPreferences(event);
  }

  if (path === '/api/thinktank/preferences/models/favorite' && method === 'POST') {
    return toggleFavoriteModel(event);
  }

  if (path === '/api/thinktank/domain-selection') {
    if (method === 'GET') return getDomainSelection(event);
    if (method === 'POST') return saveDomainSelection(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
