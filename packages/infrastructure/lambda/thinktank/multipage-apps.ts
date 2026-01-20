/**
 * Think Tank Multipage Apps Lambda
 * Handles user-generated multipage applications
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID,X-User-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

interface MultipageApp {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  theme: {
    primaryColor: string;
    mode: 'light' | 'dark';
  };
  pages: Array<{
    id: string;
    name: string;
    icon: string;
    content: Record<string, unknown>;
  }>;
  navigation: {
    type: 'tabs' | 'sidebar' | 'drawer';
    position: 'top' | 'bottom' | 'left' | 'right';
  };
  sharedState: Record<string, unknown>;
  isPublished: boolean;
  publishedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['X-Tenant-ID'];
  const userId = event.requestContext.authorizer?.userId || event.headers['X-User-ID'];
  
  if (!tenantId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Tenant ID required' }),
    };
  }

  const pathParts = event.path.split('/').filter(Boolean);
  const appId = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null;

  try {
    switch (event.httpMethod) {
      case 'GET':
        if (appId && appId !== 'multipage-apps') {
          return await getApp(tenantId, appId);
        }
        return await listApps(tenantId, userId);
      case 'POST':
        return await createApp(tenantId, userId || 'anonymous', JSON.parse(event.body || '{}'));
      case 'PUT':
        if (!appId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'App ID required for update' }),
          };
        }
        return await updateApp(tenantId, appId, JSON.parse(event.body || '{}'));
      case 'DELETE':
        if (!appId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'App ID required for delete' }),
          };
        }
        return await deleteApp(tenantId, appId);
      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Multipage Apps handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function listApps(
  tenantId: string,
  userId: string | undefined
): Promise<APIGatewayProxyResult> {
  let query = `
    SELECT 
      id, user_id as "userId", name, description, icon, theme,
      pages, navigation, shared_state as "sharedState",
      is_published as "isPublished", published_at as "publishedAt",
      version, created_at as "createdAt", updated_at as "updatedAt"
    FROM thinktank_multipage_apps
    WHERE tenant_id = $1
  `;
  
  const params = [stringParam('tenant_id', tenantId)];
  
  if (userId) {
    query += ` AND (user_id = $2 OR is_published = true)`;
    params.push(stringParam('user_id', userId));
  } else {
    query += ` AND is_published = true`;
  }
  
  query += ` ORDER BY updated_at DESC LIMIT 100`;

  const result = await executeStatement(query, params);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ apps: result.rows }),
  };
}

async function getApp(
  tenantId: string,
  appId: string
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    SELECT 
      id, user_id as "userId", name, description, icon, theme,
      pages, navigation, shared_state as "sharedState",
      is_published as "isPublished", published_at as "publishedAt",
      version, created_at as "createdAt", updated_at as "updatedAt"
    FROM thinktank_multipage_apps
    WHERE tenant_id = $1 AND id = $2
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('id', appId),
  ]);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'App not found' }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.rows[0]),
  };
}

async function createApp(
  tenantId: string,
  userId: string,
  body: Partial<MultipageApp>
): Promise<APIGatewayProxyResult> {
  const {
    name,
    description,
    icon = '📱',
    theme = { primaryColor: '#3B82F6', mode: 'light' },
    pages = [],
    navigation = { type: 'tabs', position: 'bottom' },
    sharedState = {},
  } = body;

  if (!name) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'name is required' }),
    };
  }

  const result = await executeStatement(`
    INSERT INTO thinktank_multipage_apps (
      tenant_id, user_id, name, description, icon, theme,
      pages, navigation, shared_state
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, created_at as "createdAt"
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('name', name),
    stringParam('description', description || ''),
    stringParam('icon', icon),
    stringParam('theme', JSON.stringify(theme)),
    stringParam('pages', JSON.stringify(pages)),
    stringParam('navigation', JSON.stringify(navigation)),
    stringParam('shared_state', JSON.stringify(sharedState)),
  ]);

  const row = result.rows[0] as Record<string, string>;

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ 
      success: true,
      id: row.id,
      createdAt: row.createdAt,
    }),
  };
}

async function updateApp(
  tenantId: string,
  appId: string,
  body: Partial<MultipageApp> & { publish?: boolean }
): Promise<APIGatewayProxyResult> {
  const {
    name,
    description,
    icon,
    theme,
    pages,
    navigation,
    sharedState,
    publish,
  } = body;

  let updateFields: string[] = ['updated_at = NOW()', 'version = version + 1'];
  const params = [
    stringParam('tenant_id', tenantId),
    stringParam('id', appId),
  ];
  let paramIndex = 3;

  if (name !== undefined) {
    updateFields.push(`name = $${paramIndex}`);
    params.push(stringParam('name', name));
    paramIndex++;
  }

  if (description !== undefined) {
    updateFields.push(`description = $${paramIndex}`);
    params.push(stringParam('description', description));
    paramIndex++;
  }

  if (icon !== undefined) {
    updateFields.push(`icon = $${paramIndex}`);
    params.push(stringParam('icon', icon));
    paramIndex++;
  }

  if (theme !== undefined) {
    updateFields.push(`theme = $${paramIndex}`);
    params.push(stringParam('theme', JSON.stringify(theme)));
    paramIndex++;
  }

  if (pages !== undefined) {
    updateFields.push(`pages = $${paramIndex}`);
    params.push(stringParam('pages', JSON.stringify(pages)));
    paramIndex++;
  }

  if (navigation !== undefined) {
    updateFields.push(`navigation = $${paramIndex}`);
    params.push(stringParam('navigation', JSON.stringify(navigation)));
    paramIndex++;
  }

  if (sharedState !== undefined) {
    updateFields.push(`shared_state = $${paramIndex}`);
    params.push(stringParam('shared_state', JSON.stringify(sharedState)));
    paramIndex++;
  }

  if (publish === true) {
    updateFields.push(`is_published = true, published_at = NOW()`);
  } else if (publish === false) {
    updateFields.push(`is_published = false`);
  }

  const result = await executeStatement(`
    UPDATE thinktank_multipage_apps SET
      ${updateFields.join(', ')}
    WHERE tenant_id = $1 AND id = $2
    RETURNING id, version, updated_at as "updatedAt"
  `, params);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'App not found' }),
    };
  }

  const row = result.rows[0] as Record<string, string | number>;

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ 
      success: true,
      id: row.id,
      version: row.version,
      updatedAt: row.updatedAt,
    }),
  };
}

async function deleteApp(
  tenantId: string,
  appId: string
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    DELETE FROM thinktank_multipage_apps
    WHERE tenant_id = $1 AND id = $2
    RETURNING id
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('id', appId),
  ]);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'App not found' }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: 'App deleted' }),
  };
}
