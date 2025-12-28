/**
 * RADIANT v4.18.0 - System Configuration Admin API Handler
 * 
 * API endpoints for managing system-wide configuration parameters
 * that were previously hardcoded in Lambda handlers.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { successResponse, handleError, notFoundResponse, validationErrorResponse } from '../shared/middleware/api-response';
import { extractAuthContext, requireSuperAdmin as verifySuperAdmin } from '../shared/auth';

interface Admin {
  id: string;
  tenantId: string;
  role: string;
}

async function requireSuperAdmin(event: APIGatewayProxyEvent): Promise<Admin> {
  const auth = extractAuthContext(event);
  verifySuperAdmin(auth);
  return { id: auth.userId, tenantId: auth.tenantId, role: auth.role };
}

// GET /api/admin/system-config/categories
export async function listCategories(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireSuperAdmin(event);
    const client = await getPoolClient();

    try {
      const result = await client.query(`
        SELECT id, name, description, icon, sort_order
        FROM system_config_categories
        WHERE is_active = true
        ORDER BY sort_order ASC
      `);

      return successResponse({
        categories: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          icon: row.icon,
          sortOrder: row.sort_order,
        })),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list config categories', error instanceof Error ? error : undefined);
    return handleError(error);
  }
}

// GET /api/admin/system-config/:category
export async function getConfigsByCategory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireSuperAdmin(event);
    const category = event.pathParameters?.category;

    if (!category) {
      return validationErrorResponse('Category is required', { category: ['Category parameter is required'] });
    }

    const client = await getPoolClient();

    try {
      const result = await client.query(`
        SELECT 
          id, category, key, value, value_type,
          display_name, description, unit,
          min_value, max_value, default_value,
          is_sensitive, requires_restart, sort_order
        FROM system_config
        WHERE category = $1
        ORDER BY sort_order ASC
      `, [category]);

      if (result.rows.length === 0) {
        // Check if category exists
        const categoryCheck = await client.query(
          `SELECT id FROM system_config_categories WHERE id = $1`,
          [category]
        );
        if (categoryCheck.rows.length === 0) {
          return notFoundResponse('Category', category);
        }
      }

      return successResponse({
        category,
        configs: result.rows.map(row => ({
          id: row.id,
          category: row.category,
          key: row.key,
          value: parseConfigValue(row.value, row.value_type),
          valueType: row.value_type,
          displayName: row.display_name,
          description: row.description,
          unit: row.unit,
          minValue: row.min_value ? parseFloat(row.min_value) : null,
          maxValue: row.max_value ? parseFloat(row.max_value) : null,
          defaultValue: row.default_value ? parseConfigValue(row.default_value, row.value_type) : null,
          isSensitive: row.is_sensitive,
          requiresRestart: row.requires_restart,
          sortOrder: row.sort_order,
        })),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get configs by category', error instanceof Error ? error : undefined);
    return handleError(error);
  }
}

// PUT /api/admin/system-config/:category/:key
export async function updateConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireSuperAdmin(event);
    const category = event.pathParameters?.category;
    const key = event.pathParameters?.key;

    if (!category || !key) {
      return validationErrorResponse('Category and key are required', {
        category: !category ? ['Category is required'] : [],
        key: !key ? ['Key is required'] : [],
      });
    }

    const body = JSON.parse(event.body || '{}');
    const { value, reason } = body;

    if (value === undefined) {
      return validationErrorResponse('Value is required', { value: ['Value is required'] });
    }

    const client = await getPoolClient();

    try {
      // Get current config to validate
      const configResult = await client.query(`
        SELECT id, value_type, min_value, max_value, is_sensitive
        FROM system_config
        WHERE category = $1 AND key = $2
      `, [category, key]);

      if (configResult.rows.length === 0) {
        return notFoundResponse('Configuration', `${category}.${key}`);
      }

      const config = configResult.rows[0];

      // Validate numeric values
      if (config.value_type === 'integer' || config.value_type === 'decimal') {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return validationErrorResponse('Invalid numeric value', { value: ['Must be a number'] });
        }
        if (config.min_value !== null && numValue < parseFloat(config.min_value)) {
          return validationErrorResponse(
            `Value must be at least ${config.min_value}`,
            { value: [`Minimum value is ${config.min_value}`] }
          );
        }
        if (config.max_value !== null && numValue > parseFloat(config.max_value)) {
          return validationErrorResponse(
            `Value must be at most ${config.max_value}`,
            { value: [`Maximum value is ${config.max_value}`] }
          );
        }
      }

      // Update the config
      await client.query(`
        UPDATE system_config
        SET value = $1, updated_at = NOW(), updated_by = $2
        WHERE category = $3 AND key = $4
      `, [JSON.stringify(value), admin.id, category, key]);

      // Log the change with reason
      await client.query(`
        INSERT INTO system_config_audit (
          config_id, config_key, old_value, new_value, 
          changed_by, changed_by_email, change_reason
        ) VALUES ($1, $2, 
          (SELECT value FROM system_config WHERE id = $1),
          $3, $4, $5, $6
        )
      `, [config.id, `${category}.${key}`, JSON.stringify(value), admin.id, null, reason || null]);

      logger.info('System config updated', {
        category,
        key,
        updatedBy: admin.id,
        reason,
      });

      return successResponse({
        message: 'Configuration updated successfully',
        requiresRestart: config.requires_restart,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update config', error instanceof Error ? error : undefined);
    return handleError(error);
  }
}

// POST /api/admin/system-config/:category/:key/reset
export async function resetConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireSuperAdmin(event);
    const category = event.pathParameters?.category;
    const key = event.pathParameters?.key;

    if (!category || !key) {
      return validationErrorResponse('Category and key are required', {
        category: !category ? ['Category is required'] : [],
        key: !key ? ['Key is required'] : [],
      });
    }

    const client = await getPoolClient();

    try {
      const result = await client.query(`
        UPDATE system_config
        SET value = default_value, updated_at = NOW(), updated_by = $1
        WHERE category = $2 AND key = $3 AND default_value IS NOT NULL
        RETURNING id, value, default_value
      `, [admin.id, category, key]);

      if (result.rows.length === 0) {
        return notFoundResponse('Configuration', `${category}.${key}`);
      }

      logger.info('System config reset to default', { category, key, updatedBy: admin.id });

      return successResponse({
        message: 'Configuration reset to default value',
        value: result.rows[0].default_value,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to reset config', error instanceof Error ? error : undefined);
    return handleError(error);
  }
}

// GET /api/admin/system-config/audit
export async function getAuditLog(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireSuperAdmin(event);
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const category = event.queryStringParameters?.category;

    const client = await getPoolClient();

    try {
      let query = `
        SELECT 
          a.id, a.config_key, a.old_value, a.new_value,
          a.changed_by, a.changed_by_email, a.change_reason, a.created_at
        FROM system_config_audit a
      `;
      const params: (string | number)[] = [];
      let paramIndex = 1;

      if (category) {
        query += ` WHERE a.config_key LIKE $${paramIndex++} || '.%'`;
        params.push(category);
      }

      query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await client.query(query, params);

      return successResponse({
        auditLog: result.rows.map(row => ({
          id: row.id,
          configKey: row.config_key,
          oldValue: row.old_value,
          newValue: row.new_value,
          changedBy: row.changed_by,
          changedByEmail: row.changed_by_email,
          changeReason: row.change_reason,
          createdAt: row.created_at,
        })),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get audit log', error instanceof Error ? error : undefined);
    return handleError(error);
  }
}

// POST /api/admin/system-config/bulk-update
export async function bulkUpdate(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireSuperAdmin(event);
    const body = JSON.parse(event.body || '{}');
    const { updates, reason } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return validationErrorResponse('Updates array is required', { updates: ['Must provide an array of updates'] });
    }

    const client = await getPoolClient();

    try {
      await client.query('BEGIN');

      const results: { key: string; success: boolean; error?: string }[] = [];

      for (const update of updates) {
        const { category, key, value } = update;
        if (!category || !key || value === undefined) {
          results.push({ key: `${category}.${key}`, success: false, error: 'Missing required fields' });
          continue;
        }

        try {
          await client.query(`
            UPDATE system_config
            SET value = $1, updated_at = NOW(), updated_by = $2
            WHERE category = $3 AND key = $4
          `, [JSON.stringify(value), admin.id, category, key]);

          results.push({ key: `${category}.${key}`, success: true });
        } catch (err) {
          results.push({ key: `${category}.${key}`, success: false, error: (err as Error).message });
        }
      }

      await client.query('COMMIT');

      logger.info('Bulk config update completed', {
        updatedBy: admin.id,
        totalUpdates: updates.length,
        successful: results.filter(r => r.success).length,
        reason,
      });

      return successResponse({
        message: 'Bulk update completed',
        results,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to perform bulk update', error instanceof Error ? error : undefined);
    return handleError(error);
  }
}

function parseConfigValue(value: unknown, valueType: string): unknown {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      switch (valueType) {
        case 'integer':
          return parseInt(String(parsed), 10);
        case 'decimal':
        case 'percentage':
          return parseFloat(String(parsed));
        case 'boolean':
          return Boolean(parsed);
        default:
          return parsed;
      }
    } catch (error) {
      // JSON parse failed, return original value
      logger.warn('Failed to parse config value', { value, error: error instanceof Error ? error.message : 'unknown' });
      return value;
    }
  }
  return value;
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // GET /api/admin/system-config/categories
  if (path === '/api/admin/system-config/categories' && method === 'GET') {
    return listCategories(event);
  }

  // GET /api/admin/system-config/audit
  if (path === '/api/admin/system-config/audit' && method === 'GET') {
    return getAuditLog(event);
  }

  // POST /api/admin/system-config/bulk-update
  if (path === '/api/admin/system-config/bulk-update' && method === 'POST') {
    return bulkUpdate(event);
  }

  // GET /api/admin/system-config/:category
  const categoryMatch = path.match(/^\/api\/admin\/system-config\/([^/]+)$/);
  if (categoryMatch && method === 'GET') {
    return getConfigsByCategory(event);
  }

  // PUT /api/admin/system-config/:category/:key
  const updateMatch = path.match(/^\/api\/admin\/system-config\/([^/]+)\/([^/]+)$/);
  if (updateMatch && method === 'PUT') {
    return updateConfig(event);
  }

  // POST /api/admin/system-config/:category/:key/reset
  const resetMatch = path.match(/^\/api\/admin\/system-config\/([^/]+)\/([^/]+)\/reset$/);
  if (resetMatch && method === 'POST') {
    return resetConfig(event);
  }

  return notFoundResponse('Endpoint');
}
