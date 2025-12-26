/**
 * Admin Models API Handler
 * 
 * Manage AI model configurations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { logger } from '../shared/logger';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface Model {
  id: string;
  providerId: string;
  displayName: string;
  description: string;
  category: string;
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  capabilities: string[];
  status: 'active' | 'deprecated' | 'disabled';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Provider {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  status: 'active' | 'degraded' | 'down';
  models: string[];
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  try {
    // Models endpoints
    if (path.startsWith('/admin/models')) {
      const modelId = event.pathParameters?.id;

      if (method === 'GET' && !modelId) {
        return await listModels(event);
      }
      if (method === 'POST' && !modelId) {
        return await createModel(event);
      }
      if (method === 'GET' && modelId) {
        return await getModel(modelId);
      }
      if (method === 'PUT' && modelId) {
        return await updateModel(modelId, event);
      }
      if (method === 'DELETE' && modelId) {
        return await deleteModel(modelId);
      }
      if (method === 'POST' && path.endsWith('/deprecate')) {
        return await deprecateModel(modelId!);
      }
    }

    // Providers endpoints
    if (path.startsWith('/admin/providers')) {
      const providerId = event.pathParameters?.id;

      if (method === 'GET' && !providerId) {
        return await listProviders();
      }
      if (method === 'GET' && providerId) {
        return await getProvider(providerId);
      }
      if (method === 'PUT' && providerId) {
        return await updateProvider(providerId, event);
      }
      if (method === 'POST' && path.endsWith('/health')) {
        return await checkProviderHealth(providerId!);
      }
    }

    return response(404, { error: { message: 'Not found' } });
  } catch (error) {
    logger.error('Admin models error', error instanceof Error ? error : undefined);
    return response(500, { error: { message: 'Internal server error' } });
  }
}

async function listModels(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { category, status, provider } = event.queryStringParameters || {};
  const client = await pool.connect();

  try {
    let query = `
      SELECT 
        m.id,
        m.provider_id,
        m.display_name,
        m.description,
        m.category,
        m.context_window,
        (m.pricing->>'input_tokens')::DECIMAL as input_cost_per_1k,
        (m.pricing->>'output_tokens')::DECIMAL as output_cost_per_1k,
        m.capabilities,
        CASE WHEN m.is_enabled THEN 'active' ELSE 'disabled' END as status,
        m.is_default,
        m.created_at,
        m.updated_at
      FROM models m
      WHERE 1=1
    `;
    const params: (string | boolean)[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND m.category = $${paramIndex++}`;
      params.push(category);
    }
    if (status) {
      query += ` AND m.is_enabled = $${paramIndex++}`;
      params.push(status === 'active');
    }
    if (provider) {
      query += ` AND m.provider_id = $${paramIndex++}`;
      params.push(provider);
    }

    query += ' ORDER BY m.display_name';

    const result = await client.query(query, params);

    const models: Model[] = result.rows.map(row => ({
      id: row.id,
      providerId: row.provider_id,
      displayName: row.display_name,
      description: row.description || '',
      category: row.category,
      contextWindow: row.context_window,
      inputCostPer1k: parseFloat(row.input_cost_per_1k) || 0,
      outputCostPer1k: parseFloat(row.output_cost_per_1k) || 0,
      capabilities: row.capabilities || [],
      status: row.status,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return response(200, { data: models });
  } finally {
    client.release();
  }
}

async function createModel(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const client = await pool.connect();

  try {
    const result = await client.query(
      `INSERT INTO models (
        id, provider_id, display_name, description, category, context_window,
        pricing, capabilities, is_enabled, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false)
      RETURNING *`,
      [
        body.id,
        body.provider_id,
        body.display_name,
        body.description || '',
        body.category || 'chat',
        body.context_window || 4096,
        JSON.stringify({
          input_tokens: body.input_cost_per_1k || 0,
          output_tokens: body.output_cost_per_1k || 0,
        }),
        body.capabilities || ['chat'],
      ]
    );

    const row = result.rows[0];
    const model: Model = {
      id: row.id,
      providerId: row.provider_id,
      displayName: row.display_name,
      description: row.description || '',
      category: row.category,
      contextWindow: row.context_window,
      inputCostPer1k: row.pricing?.input_tokens || 0,
      outputCostPer1k: row.pricing?.output_tokens || 0,
      capabilities: row.capabilities || [],
      status: 'active',
      isDefault: false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return response(201, { data: model });
  } finally {
    client.release();
  }
}

async function getModel(modelId: string): Promise<APIGatewayProxyResult> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT 
        m.id,
        m.provider_id,
        m.display_name,
        m.description,
        m.category,
        m.context_window,
        (m.pricing->>'input_tokens')::DECIMAL as input_cost_per_1k,
        (m.pricing->>'output_tokens')::DECIMAL as output_cost_per_1k,
        m.capabilities,
        CASE WHEN m.is_enabled THEN 'active' ELSE 'disabled' END as status,
        m.is_default,
        m.created_at,
        m.updated_at
      FROM models m
      WHERE m.id = $1`,
      [modelId]
    );

    if (result.rows.length === 0) {
      return response(404, { error: { message: 'Model not found' } });
    }

    const row = result.rows[0];
    return response(200, {
      data: {
        id: row.id,
        providerId: row.provider_id,
        displayName: row.display_name,
        description: row.description || '',
        category: row.category,
        contextWindow: row.context_window,
        inputCostPer1k: parseFloat(row.input_cost_per_1k) || 0,
        outputCostPer1k: parseFloat(row.output_cost_per_1k) || 0,
        capabilities: row.capabilities || [],
        status: row.status,
        isDefault: row.is_default,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } finally {
    client.release();
  }
}

async function updateModel(modelId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const client = await pool.connect();

  try {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      params.push(body.display_name);
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(body.description);
    }
    if (body.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(body.category);
    }
    if (body.context_window !== undefined) {
      updates.push(`context_window = $${paramIndex++}`);
      params.push(body.context_window);
    }
    if (body.capabilities !== undefined) {
      updates.push(`capabilities = $${paramIndex++}`);
      params.push(body.capabilities);
    }
    if (body.is_enabled !== undefined) {
      updates.push(`is_enabled = $${paramIndex++}`);
      params.push(body.is_enabled);
    }

    if (updates.length === 0) {
      return response(400, { error: { message: 'No fields to update' } });
    }

    updates.push('updated_at = NOW()');
    params.push(modelId);

    const result = await client.query(
      `UPDATE models SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return response(404, { error: { message: 'Model not found' } });
    }

    return response(200, { data: result.rows[0] });
  } finally {
    client.release();
  }
}

async function deleteModel(modelId: string): Promise<APIGatewayProxyResult> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM models WHERE id = $1 RETURNING id',
      [modelId]
    );

    if (result.rows.length === 0) {
      return response(404, { error: { message: 'Model not found' } });
    }

    return response(204, null);
  } finally {
    client.release();
  }
}

async function deprecateModel(modelId: string): Promise<APIGatewayProxyResult> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `UPDATE models 
       SET deprecated_at = NOW(), is_enabled = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, deprecated_at`,
      [modelId]
    );

    if (result.rows.length === 0) {
      return response(404, { error: { message: 'Model not found' } });
    }

    return response(200, {
      data: {
        id: modelId,
        status: 'deprecated',
        deprecatedAt: result.rows[0].deprecated_at,
      },
    });
  } finally {
    client.release();
  }
}

async function listProviders(): Promise<APIGatewayProxyResult> {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        p.id,
        p.name,
        p.display_name,
        p.base_url,
        p.status,
        ARRAY_AGG(m.id) FILTER (WHERE m.id IS NOT NULL) as models
      FROM providers p
      LEFT JOIN models m ON m.provider_id = p.id AND m.is_enabled = true
      GROUP BY p.id, p.name, p.display_name, p.base_url, p.status
      ORDER BY p.display_name
    `);

    const providers: Provider[] = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      baseUrl: row.base_url,
      status: row.status || 'active',
      models: row.models || [],
    }));

    return response(200, { data: providers });
  } finally {
    client.release();
  }
}

async function getProvider(providerId: string): Promise<APIGatewayProxyResult> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT 
        p.id,
        p.name,
        p.display_name,
        p.base_url,
        p.status,
        p.created_at,
        p.updated_at
       FROM providers p
       WHERE p.id = $1`,
      [providerId]
    );

    if (result.rows.length === 0) {
      return response(404, { error: { message: 'Provider not found' } });
    }

    const row = result.rows[0];
    return response(200, {
      data: {
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        baseUrl: row.base_url,
        status: row.status || 'active',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } finally {
    client.release();
  }
}

async function updateProvider(providerId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const client = await pool.connect();

  try {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      params.push(body.display_name);
    }
    if (body.base_url !== undefined) {
      updates.push(`base_url = $${paramIndex++}`);
      params.push(body.base_url);
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(body.status);
    }

    if (updates.length === 0) {
      return response(400, { error: { message: 'No fields to update' } });
    }

    updates.push('updated_at = NOW()');
    params.push(providerId);

    const result = await client.query(
      `UPDATE providers SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return response(404, { error: { message: 'Provider not found' } });
    }

    return response(200, { data: result.rows[0] });
  } finally {
    client.release();
  }
}

async function checkProviderHealth(providerId: string): Promise<APIGatewayProxyResult> {
  const client = await pool.connect();

  try {
    const providerResult = await client.query(
      'SELECT base_url FROM providers WHERE id = $1',
      [providerId]
    );

    if (providerResult.rows.length === 0) {
      return response(404, { error: { message: 'Provider not found' } });
    }

    const baseUrl = providerResult.rows[0].base_url;
    const startTime = Date.now();
    let status: 'active' | 'degraded' | 'down' = 'active';

    try {
      const healthUrl = `${baseUrl}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        status = res.status >= 500 ? 'down' : 'degraded';
      }
    } catch {
      status = 'down';
    }

    const latency = Date.now() - startTime;

    await client.query(
      `UPDATE providers SET status = $1, last_health_check = NOW(), updated_at = NOW() WHERE id = $2`,
      [status, providerId]
    );

    return response(200, {
      data: {
        id: providerId,
        status,
        latency,
        checkedAt: new Date().toISOString(),
      },
    });
  } finally {
    client.release();
  }
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: body ? JSON.stringify(body) : '',
  };
}
