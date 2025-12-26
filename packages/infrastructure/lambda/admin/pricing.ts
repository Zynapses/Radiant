// RADIANT v4.18.0 - Admin Pricing Lambda Handler
// API endpoints for admin pricing configuration and model overrides

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { UnauthorizedError, ForbiddenError, ValidationError } from '../shared/errors';
import { corsHeaders } from '../shared/middleware/api-response';

interface Admin {
  id: string;
  tenantId: string;
}

interface JwtPayload {
  sub: string;
  'custom:tenant_id'?: string;
  tenant_id?: string;
  'custom:role'?: string;
  role?: string;
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

async function requireAdmin(event: APIGatewayProxyEvent): Promise<Admin> {
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
    const role = payload['custom:role'] || payload.role;
    
    if (!payload.sub || !tenantId) {
      throw new Error('Invalid token payload');
    }
    
    if (role !== 'admin' && role !== 'super_admin') {
      throw new Error('Admin access required');
    }
    
    return { id: payload.sub, tenantId };
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      throw error;
    }
    throw new Error('Invalid token');
  }
}

// GET /api/admin/pricing/config
export async function getPricingConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAdmin(event);
    const client = await getPoolClient();

    try {
      const result = await client.query(`SELECT * FROM pricing_config LIMIT 1`);

      if (result.rows.length === 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            externalDefaultMarkup: 0.4,
            selfHostedDefaultMarkup: 0.75,
            minimumChargePerRequest: 0.001,
            priceIncreaseGracePeriodHours: 24,
            autoUpdateFromProviders: true,
            autoUpdateFrequency: 'daily',
            notifyOnPriceChange: true,
            notifyThresholdPercent: 10,
          }),
        };
      }

      const row = result.rows[0];
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          externalDefaultMarkup: parseFloat(row.external_default_markup),
          selfHostedDefaultMarkup: parseFloat(row.self_hosted_default_markup),
          minimumChargePerRequest: parseFloat(row.minimum_charge_per_request),
          priceIncreaseGracePeriodHours: row.price_increase_grace_period_hours,
          autoUpdateFromProviders: row.auto_update_from_providers,
          autoUpdateFrequency: row.auto_update_frequency,
          lastAutoUpdate: row.last_auto_update,
          notifyOnPriceChange: row.notify_on_price_change,
          notifyThresholdPercent: parseFloat(row.notify_threshold_percent),
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get pricing config', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load pricing config' }),
    };
  }
}

// PUT /api/admin/pricing/config
export async function updatePricingConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const body = JSON.parse(event.body || '{}');
    const client = await getPoolClient();

    try {
      await client.query(
        `
        INSERT INTO pricing_config (
          tenant_id, external_default_markup, self_hosted_default_markup,
          minimum_charge_per_request, price_increase_grace_period_hours,
          auto_update_from_providers, auto_update_frequency,
          notify_on_price_change, notify_threshold_percent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tenant_id) DO UPDATE SET
          external_default_markup = COALESCE($2, pricing_config.external_default_markup),
          self_hosted_default_markup = COALESCE($3, pricing_config.self_hosted_default_markup),
          minimum_charge_per_request = COALESCE($4, pricing_config.minimum_charge_per_request),
          price_increase_grace_period_hours = COALESCE($5, pricing_config.price_increase_grace_period_hours),
          auto_update_from_providers = COALESCE($6, pricing_config.auto_update_from_providers),
          auto_update_frequency = COALESCE($7, pricing_config.auto_update_frequency),
          notify_on_price_change = COALESCE($8, pricing_config.notify_on_price_change),
          notify_threshold_percent = COALESCE($9, pricing_config.notify_threshold_percent),
          updated_at = NOW()
        `,
        [
          admin.tenantId,
          body.externalDefaultMarkup,
          body.selfHostedDefaultMarkup,
          body.minimumChargePerRequest,
          body.priceIncreaseGracePeriodHours,
          body.autoUpdateFromProviders,
          body.autoUpdateFrequency,
          body.notifyOnPriceChange,
          body.notifyThresholdPercent,
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
    logger.error('Failed to update pricing config', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save config' }),
    };
  }
}

// GET /api/admin/pricing/models - List all model pricing
export async function getModelPricing(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        SELECT 
          m.id as model_id,
          m.display_name,
          m.provider_id,
          m.is_novel,
          m.category,
          (m.pricing->>'input_tokens')::DECIMAL as base_input_price,
          (m.pricing->>'output_tokens')::DECIMAL as base_output_price,
          COALESCE(mpo.markup_percent, pc.external_default_markup, 0.40) as effective_markup,
          COALESCE(
            mpo.custom_input_price,
            (m.pricing->>'input_tokens')::DECIMAL * (1 + COALESCE(mpo.markup_percent, pc.external_default_markup, 0.40))
          ) as user_input_price,
          COALESCE(
            mpo.custom_output_price,
            (m.pricing->>'output_tokens')::DECIMAL * (1 + COALESCE(mpo.markup_percent, pc.external_default_markup, 0.40))
          ) as user_output_price,
          mpo.id IS NOT NULL as has_override
        FROM models m
        LEFT JOIN pricing_config pc ON pc.tenant_id = $1
        LEFT JOIN model_pricing_overrides mpo ON m.id = mpo.model_id AND mpo.tenant_id = $1
        WHERE m.is_enabled = true
        ORDER BY m.display_name
        `,
        [admin.tenantId]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(
          result.rows.map((row: Record<string, unknown>) => ({
            modelId: row.model_id,
            displayName: row.display_name,
            providerId: row.provider_id,
            isNovel: row.is_novel,
            category: row.category,
            baseInputPrice: parseFloat(String(row.base_input_price)) || 0,
            baseOutputPrice: parseFloat(String(row.base_output_price)) || 0,
            effectiveMarkup: parseFloat(String(row.effective_markup)) || 0.4,
            userInputPrice: parseFloat(String(row.user_input_price)) || 0,
            userOutputPrice: parseFloat(String(row.user_output_price)) || 0,
            hasOverride: row.has_override,
          }))
        ),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get model pricing', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load model pricing' }),
    };
  }
}

// POST /api/admin/pricing/bulk-update - Bulk update markups
export async function bulkUpdatePricing(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const { type, markup } = JSON.parse(event.body || '{}');

    if (!type || markup === undefined) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'type and markup are required' }),
      };
    }

    const client = await getPoolClient();

    try {
      await client.query('BEGIN');

      // Get affected models
      const modelsResult = await client.query(
        `
        SELECT id FROM models
        WHERE provider_id ${type === 'self_hosted' ? "= 'self_hosted'" : "!= 'self_hosted'"}
        `
      );

      // Update or create overrides for each model
      for (const model of modelsResult.rows) {
        await client.query(
          `
          INSERT INTO model_pricing_overrides (tenant_id, model_id, markup_percent)
          VALUES ($1, $2, $3)
          ON CONFLICT (tenant_id, model_id) DO UPDATE SET
            markup_percent = $3,
            updated_at = NOW()
          `,
          [admin.tenantId, model.id, markup / 100]
        );
      }

      // Update default in pricing_config
      if (type === 'self_hosted') {
        await client.query(
          `
          INSERT INTO pricing_config (tenant_id, self_hosted_default_markup)
          VALUES ($1, $2)
          ON CONFLICT (tenant_id) DO UPDATE SET
            self_hosted_default_markup = $2,
            updated_at = NOW()
          `,
          [admin.tenantId, markup / 100]
        );
      } else {
        await client.query(
          `
          INSERT INTO pricing_config (tenant_id, external_default_markup)
          VALUES ($1, $2)
          ON CONFLICT (tenant_id) DO UPDATE SET
            external_default_markup = $2,
            updated_at = NOW()
          `,
          [admin.tenantId, markup / 100]
        );
      }

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          modelsUpdated: modelsResult.rows.length,
        }),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to bulk update pricing', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update pricing' }),
    };
  }
}

// PUT /api/admin/pricing/models/:modelId/override - Set individual model override
export async function setModelPricingOverride(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const modelId = event.pathParameters?.modelId;
    const { markup, inputPrice, outputPrice } = JSON.parse(event.body || '{}');

    if (!modelId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'modelId is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      await client.query(
        `
        INSERT INTO model_pricing_overrides (
          tenant_id, model_id, markup_percent, custom_input_price, custom_output_price
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, model_id) DO UPDATE SET
          markup_percent = COALESCE($3, model_pricing_overrides.markup_percent),
          custom_input_price = $4,
          custom_output_price = $5,
          updated_at = NOW()
        `,
        [admin.tenantId, modelId, markup, inputPrice, outputPrice]
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
    logger.error('Failed to set pricing override', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save override' }),
    };
  }
}

// DELETE /api/admin/pricing/models/:modelId/override - Remove override
export async function deleteModelPricingOverride(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const modelId = event.pathParameters?.modelId;

    if (!modelId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'modelId is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      await client.query(
        `DELETE FROM model_pricing_overrides WHERE tenant_id = $1 AND model_id = $2`,
        [admin.tenantId, modelId]
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
    logger.error('Failed to delete pricing override', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to remove override' }),
    };
  }
}

// GET /api/admin/pricing/history - Get price change history
export async function getPriceHistory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    const modelId = event.queryStringParameters?.modelId;
    const client = await getPoolClient();

    try {
      let query = `
        SELECT 
          ph.id,
          ph.model_id,
          m.display_name as model_name,
          ph.old_input_price,
          ph.new_input_price,
          ph.old_output_price,
          ph.new_output_price,
          ph.change_reason,
          ph.changed_by,
          ph.created_at
        FROM price_history ph
        LEFT JOIN models m ON ph.model_id = m.id
        WHERE ph.tenant_id = $1
      `;
      const params: (string | number)[] = [admin.tenantId];
      let paramIndex = 2;

      if (modelId) {
        query += ` AND ph.model_id = $${paramIndex++}`;
        params.push(modelId);
      }

      query += ` ORDER BY ph.created_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(query, params);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(
          result.rows.map((row: Record<string, unknown>) => ({
            id: row.id,
            modelId: row.model_id,
            modelName: row.model_name,
            oldInputPrice: row.old_input_price ? parseFloat(String(row.old_input_price)) : null,
            newInputPrice: row.new_input_price ? parseFloat(String(row.new_input_price)) : null,
            oldOutputPrice: row.old_output_price ? parseFloat(String(row.old_output_price)) : null,
            newOutputPrice: row.new_output_price ? parseFloat(String(row.new_output_price)) : null,
            changeReason: row.change_reason,
            changedBy: row.changed_by,
            createdAt: row.created_at,
          }))
        ),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get price history', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load price history' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/pricing/config') {
    if (method === 'GET') return getPricingConfig(event);
    if (method === 'PUT') return updatePricingConfig(event);
  }

  if (path === '/api/admin/pricing/models' && method === 'GET') {
    return getModelPricing(event);
  }

  if (path === '/api/admin/pricing/bulk-update' && method === 'POST') {
    return bulkUpdatePricing(event);
  }

  if (path.match(/\/api\/admin\/pricing\/models\/[^/]+\/override/)) {
    if (method === 'PUT') return setModelPricingOverride(event);
    if (method === 'DELETE') return deleteModelPricingOverride(event);
  }

  if (path === '/api/admin/pricing/history' && method === 'GET') {
    return getPriceHistory(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
