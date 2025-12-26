/**
 * Admin Tenants API Handler
 * 
 * Manage tenant accounts and configurations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getClient, query } from '../shared/db/pool-manager';
import { logger } from '../shared/logger';

interface Tenant {
  id: string;
  name: string;
  email: string;
  tier: string;
  status: 'active' | 'suspended' | 'pending';
  createdAt: string;
  updatedAt: string;
  settings: TenantSettings;
}

interface TenantSettings {
  maxUsers: number;
  maxApiKeys: number;
  allowedModels: string[];
  customDomain?: string;
  ssoEnabled: boolean;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const tenantId = event.pathParameters?.id;

  try {
    // GET /admin/tenants - List all tenants
    if (method === 'GET' && path === '/admin/tenants') {
      return await listTenants(event);
    }

    // POST /admin/tenants - Create tenant
    if (method === 'POST' && path === '/admin/tenants') {
      return await createTenant(event);
    }

    // GET /admin/tenants/:id - Get tenant
    if (method === 'GET' && tenantId) {
      return await getTenant(tenantId);
    }

    // PUT /admin/tenants/:id - Update tenant
    if (method === 'PUT' && tenantId) {
      return await updateTenant(tenantId, event);
    }

    // DELETE /admin/tenants/:id - Delete tenant
    if (method === 'DELETE' && tenantId) {
      return await deleteTenant(tenantId);
    }

    // POST /admin/tenants/:id/suspend - Suspend tenant
    if (method === 'POST' && path.endsWith('/suspend')) {
      return await suspendTenant(tenantId!);
    }

    // POST /admin/tenants/:id/activate - Activate tenant
    if (method === 'POST' && path.endsWith('/activate')) {
      return await activateTenant(tenantId!);
    }

    return response(404, { error: { message: 'Not found' } });
  } catch (error) {
    logger.error('Admin tenants error', error instanceof Error ? error : undefined);
    return response(500, { error: { message: 'Internal server error' } });
  }
}

async function listTenants(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { page = '1', limit = '20', status, tier, search } = event.queryStringParameters || {};
  const client = await getClient();

  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (tier) {
      params.push(tier);
      conditions.push(`t.tier = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(t.name ILIKE $${params.length} OR t.email ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Execute count and data queries in parallel
    const countParams = [...params];
    params.push(limitNum, offset);
    const query = `
      SELECT 
        t.id, t.name, t.email, t.tier, t.status,
        t.created_at, t.updated_at, t.settings
      FROM tenants t
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const [countResult, result] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM tenants t ${whereClause}`, countParams),
      client.query(query, params),
    ]);

    const tenants: Tenant[] = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      tier: row.tier,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      settings: row.settings || {
        maxUsers: 5,
        maxApiKeys: 3,
        allowedModels: [],
        ssoEnabled: false,
      },
    }));

    return response(200, {
      data: tenants,
      meta: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult.rows[0].count, 10),
      },
    });
  } finally {
    client.release();
  }
}

async function createTenant(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { name, email, tier = 'starter' } = body;

  if (!name || !email) {
    return response(400, { error: { message: 'name and email are required' } });
  }

  const client = await getClient();

  try {
    const settings: TenantSettings = {
      maxUsers: tier === 'enterprise' ? 100 : tier === 'business' ? 25 : 5,
      maxApiKeys: tier === 'enterprise' ? 50 : tier === 'business' ? 10 : 3,
      allowedModels: ['gpt-4o', 'gpt-3.5-turbo', 'claude-3-sonnet'],
      ssoEnabled: tier === 'enterprise',
    };

    const result = await client.query(
      `INSERT INTO tenants (id, name, email, tier, status, settings)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [generateId(), name, email, tier, JSON.stringify(settings)]
    );

    const row = result.rows[0];
    const tenant: Tenant = {
      id: row.id,
      name: row.name,
      email: row.email,
      tier: row.tier,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      settings: row.settings || settings,
    };

    return response(201, { data: tenant });
  } finally {
    client.release();
  }
}

async function getTenant(tenantId: string): Promise<APIGatewayProxyResult> {
  const client = await getClient();

  try {
    const result = await client.query(
      `SELECT * FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return response(404, { error: { message: 'Tenant not found' } });
    }

    const row = result.rows[0];
    const tenant: Tenant = {
      id: row.id,
      name: row.name,
      email: row.email,
      tier: row.tier,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      settings: row.settings || {
        maxUsers: 5,
        maxApiKeys: 3,
        allowedModels: [],
        ssoEnabled: false,
      },
    };

    return response(200, { data: tenant });
  } finally {
    client.release();
  }
}

async function updateTenant(tenantId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const client = await getClient();

  try {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(body.name);
    }
    if (body.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(body.email);
    }
    if (body.tier !== undefined) {
      updates.push(`tier = $${paramIndex++}`);
      params.push(body.tier);
    }
    if (body.settings !== undefined) {
      updates.push(`settings = $${paramIndex++}`);
      params.push(JSON.stringify(body.settings));
    }

    if (updates.length === 0) {
      return response(400, { error: { message: 'No fields to update' } });
    }

    updates.push('updated_at = NOW()');
    params.push(tenantId);

    const result = await client.query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return response(404, { error: { message: 'Tenant not found' } });
    }

    return response(200, { data: result.rows[0] });
  } finally {
    client.release();
  }
}

async function deleteTenant(tenantId: string): Promise<APIGatewayProxyResult> {
  const client = await getClient();

  try {
    const result = await client.query(
      `UPDATE tenants SET status = 'deleted', deleted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return response(404, { error: { message: 'Tenant not found' } });
    }

    return response(204, null);
  } finally {
    client.release();
  }
}

async function suspendTenant(tenantId: string): Promise<APIGatewayProxyResult> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE tenants SET status = 'suspended', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return response(404, { error: { message: 'Tenant not found' } });
    }

    await client.query(
      `UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId]
    );

    await client.query('COMMIT');

    return response(200, { data: { id: tenantId, status: 'suspended' } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function activateTenant(tenantId: string): Promise<APIGatewayProxyResult> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE tenants SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return response(404, { error: { message: 'Tenant not found' } });
    }

    await client.query(
      `UPDATE api_keys SET is_active = true, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId]
    );

    await client.query('COMMIT');

    return response(200, { data: { id: tenantId, status: 'active' } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function generateId(): string {
  return 'tn_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
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
