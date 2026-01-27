/**
 * Agent Registry & Tenant Permission Management API
 * Used by Think Tank Admin for agent-agnostic user access control
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDbClient } from '../shared/db';
import { getAuthTenantId, getAuthUserId } from '../shared/utils';
import { createResponse, createErrorResponse } from '../shared/utils/response';
import {
  AgentRegistryEntry,
  TenantRole,
  TenantUserRole,
  UserAgentAccess,
  TenantAdminDashboardData,
} from '@radiant/shared';

const db = getDbClient();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path.replace(/^\/api\/admin\/agents/, '');
  const method = event.httpMethod;

  try {
    const tenantId = getAuthTenantId(event);
    const userId = getAuthUserId(event);

    if (!tenantId) {
      return createErrorResponse('Tenant ID required', 401);
    }

    // Set tenant context for RLS
    await db.query(`SET app.current_tenant_id = '${tenantId}'`);

    // Route handling
    if (path === '/registry' && method === 'GET') {
      return getAgentRegistry();
    }

    if (path === '/dashboard' && method === 'GET') {
      return getTenantAdminDashboard(tenantId);
    }

    if (path === '/roles' && method === 'GET') {
      return getTenantRoles(tenantId);
    }

    if (path === '/roles' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return createTenantRole(tenantId, userId, body);
    }

    if (path.match(/^\/roles\/[\w-]+$/) && method === 'GET') {
      const roleId = path.split('/')[2];
      return getTenantRole(tenantId, roleId);
    }

    if (path.match(/^\/roles\/[\w-]+$/) && method === 'PUT') {
      const roleId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return updateTenantRole(tenantId, roleId, body);
    }

    if (path.match(/^\/roles\/[\w-]+$/) && method === 'DELETE') {
      const roleId = path.split('/')[2];
      return deleteTenantRole(tenantId, roleId);
    }

    if (path === '/users' && method === 'GET') {
      return getUsersWithAccess(tenantId);
    }

    if (path.match(/^\/users\/[\w-]+\/roles$/) && method === 'GET') {
      const targetUserId = path.split('/')[2];
      return getUserRoles(tenantId, targetUserId);
    }

    if (path.match(/^\/users\/[\w-]+\/roles$/) && method === 'POST') {
      const targetUserId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return assignUserRole(tenantId, userId, targetUserId, body);
    }

    if (path.match(/^\/users\/[\w-]+\/roles\/[\w-]+$/) && method === 'DELETE') {
      const parts = path.split('/');
      const targetUserId = parts[2];
      const roleId = parts[4];
      return revokeUserRole(tenantId, userId, targetUserId, roleId);
    }

    if (path.match(/^\/users\/[\w-]+\/agents$/) && method === 'GET') {
      const targetUserId = path.split('/')[2];
      return getUserAgentAccess(tenantId, targetUserId);
    }

    if (path.match(/^\/users\/[\w-]+\/agents$/) && method === 'POST') {
      const targetUserId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return grantAgentAccess(tenantId, userId, targetUserId, body);
    }

    if (path.match(/^\/users\/[\w-]+\/agents\/[\w-]+$/) && method === 'DELETE') {
      const parts = path.split('/');
      const targetUserId = parts[2];
      const agentKey = parts[4];
      return revokeAgentAccess(tenantId, userId, targetUserId, agentKey);
    }

    if (path.match(/^\/users\/[\w-]+\/permissions$/) && method === 'GET') {
      const targetUserId = path.split('/')[2];
      return getEffectivePermissions(tenantId, targetUserId);
    }

    if (path === '/initialize-roles' && method === 'POST') {
      return initializeTenantRoles(tenantId);
    }

    return createErrorResponse('Endpoint not found');
  } catch (error) {
    console.error('Agent Registry API error:', error);
    return createErrorResponse('Internal server error');
  }
};

// =============================================================================
// Agent Registry (Global)
// =============================================================================

async function getAgentRegistry(): Promise<APIGatewayProxyResult> {
  const query = `
    SELECT * FROM agent_registry 
    WHERE is_active = true 
    ORDER BY sort_order, display_name
  `;
  const result = await db.query(query);

  return createResponse(result.rows.map(mapAgentRegistry));
}

// =============================================================================
// Tenant Admin Dashboard
// =============================================================================

async function getTenantAdminDashboard(tenantId: string): Promise<APIGatewayProxyResult> {
  const userCountQuery = `
    SELECT COUNT(DISTINCT user_id) as count 
    FROM tenant_user_roles 
    WHERE tenant_id = $1 AND is_active = true
  `;

  const roleCountQuery = `
    SELECT COUNT(*) as count FROM tenant_roles WHERE tenant_id = $1
  `;

  const agentAccessQuery = `
    SELECT 
      ar.id, ar.agent_key, ar.display_name, ar.icon_name,
      COUNT(DISTINCT uaa.user_id) as user_count
    FROM agent_registry ar
    LEFT JOIN user_agent_access uaa ON uaa.agent_id = ar.id 
      AND uaa.tenant_id = $1 AND uaa.is_active = true
    WHERE ar.is_active = true
    GROUP BY ar.id, ar.agent_key, ar.display_name, ar.icon_name
    ORDER BY ar.sort_order
  `;

  const recentChangesQuery = `
    SELECT 
      tur.user_id,
      tur.role_id,
      tr.display_name as role_name,
      tur.assigned_at as timestamp,
      'assigned' as action
    FROM tenant_user_roles tur
    JOIN tenant_roles tr ON tr.id = tur.role_id
    WHERE tur.tenant_id = $1
    ORDER BY tur.assigned_at DESC
    LIMIT 10
  `;

  const [userCountResult, roleCountResult, agentAccessResult, recentChangesResult] = await Promise.all([
    db.query(userCountQuery, [tenantId]),
    db.query(roleCountQuery, [tenantId]),
    db.query(agentAccessQuery, [tenantId]),
    db.query(recentChangesQuery, [tenantId]),
  ]);

  const dashboard: TenantAdminDashboardData = {
    userCount: parseInt((userCountResult.rows[0] as any)?.count) || 0,
    roleCount: parseInt((roleCountResult.rows[0] as any)?.count) || 0,
    agentAccessSummary: agentAccessResult.rows.map((row: any) => ({
      agent: {
        id: row.id,
        agentKey: row.agent_key,
        displayName: row.display_name,
        iconName: row.icon_name,
      } as AgentRegistryEntry,
      userCount: parseInt(row.user_count) || 0,
    })),
    recentRoleChanges: recentChangesResult.rows.map((row: any) => ({
      userId: row.user_id,
      userName: row.user_name || 'Unknown',
      roleId: row.role_id,
      roleName: row.role_name,
      action: row.action,
      timestamp: row.timestamp,
    })),
  };

  return createResponse(dashboard);
}

// =============================================================================
// Tenant Roles
// =============================================================================

async function getTenantRoles(tenantId: string): Promise<APIGatewayProxyResult> {
  const query = `
    SELECT * FROM tenant_roles 
    WHERE tenant_id = $1 
    ORDER BY is_system_role DESC, display_name
  `;
  const result = await db.query(query, [tenantId]);

  return createResponse(result.rows.map(mapTenantRole));
}

async function getTenantRole(tenantId: string, roleId: string): Promise<APIGatewayProxyResult> {
  const query = `SELECT * FROM tenant_roles WHERE tenant_id = $1 AND id = $2`;
  const result = await db.query(query, [tenantId, roleId]);

  if (result.rows.length === 0) {
    return createErrorResponse('Role not found');
  }

  return createResponse(mapTenantRole(result.rows[0]));
}

async function createTenantRole(tenantId: string, userId: string, body: any): Promise<APIGatewayProxyResult> {
  const { roleKey, displayName, description, permissions, agentAccess } = body;

  if (!roleKey || !displayName) {
    return createErrorResponse('roleKey and displayName required');
  }

  const insertQuery = `
    INSERT INTO tenant_roles (tenant_id, role_key, display_name, description, permissions, agent_access, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const result = await db.query(insertQuery, [
    tenantId, roleKey, displayName, description,
    JSON.stringify(permissions || {}),
    JSON.stringify(agentAccess || []),
    userId
  ]);

  return createResponse(mapTenantRole(result.rows[0]));
}

async function updateTenantRole(tenantId: string, roleId: string, body: any): Promise<APIGatewayProxyResult> {
  const { displayName, description, permissions, agentAccess } = body;

  // Check if system role
  const checkQuery = `SELECT is_system_role FROM tenant_roles WHERE tenant_id = $1 AND id = $2`;
  const checkResult = await db.query(checkQuery, [tenantId, roleId]);

  if (checkResult.rows.length === 0) {
    return createErrorResponse('Role not found');
  }

  if (checkResult.rows[0].is_system_role) {
    return createErrorResponse('Cannot modify system roles', 403);
  }

  const updateQuery = `
    UPDATE tenant_roles 
    SET display_name = COALESCE($3, display_name),
        description = COALESCE($4, description),
        permissions = COALESCE($5, permissions),
        agent_access = COALESCE($6, agent_access),
        updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;

  const result = await db.query(updateQuery, [
    tenantId, roleId, displayName, description,
    permissions ? JSON.stringify(permissions) : null,
    agentAccess ? JSON.stringify(agentAccess) : null
  ]);

  return createResponse(mapTenantRole(result.rows[0]));
}

async function deleteTenantRole(tenantId: string, roleId: string): Promise<APIGatewayProxyResult> {
  // Check if system role
  const checkQuery = `SELECT is_system_role FROM tenant_roles WHERE tenant_id = $1 AND id = $2`;
  const checkResult = await db.query(checkQuery, [tenantId, roleId]);

  if (checkResult.rows.length === 0) {
    return createErrorResponse('Role not found');
  }

  if (checkResult.rows[0].is_system_role) {
    return createErrorResponse('Cannot delete system roles', 403);
  }

  const query = `DELETE FROM tenant_roles WHERE tenant_id = $1 AND id = $2 RETURNING id`;
  const result = await db.query(query, [tenantId, roleId]);

  return createResponse({ deleted: true, id: roleId });
}

// =============================================================================
// User Role Assignments
// =============================================================================

async function getUsersWithAccess(tenantId: string): Promise<APIGatewayProxyResult> {
  const query = `
    SELECT DISTINCT 
      tur.user_id,
      array_agg(DISTINCT tr.display_name) as roles,
      array_agg(DISTINCT ar.display_name) as agents
    FROM tenant_user_roles tur
    JOIN tenant_roles tr ON tr.id = tur.role_id
    LEFT JOIN LATERAL unnest(tr.agent_access::text[]) as agent_key ON true
    LEFT JOIN agent_registry ar ON ar.agent_key = agent_key
    WHERE tur.tenant_id = $1 AND tur.is_active = true
    GROUP BY tur.user_id
  `;

  const result = await db.query(query, [tenantId]);

  return createResponse(result.rows.map((row: any) => ({
    userId: row.user_id,
    roles: row.roles.filter(Boolean),
    agents: row.agents.filter(Boolean),
  })));
}

async function getUserRoles(tenantId: string, targetUserId: string): Promise<APIGatewayProxyResult> {
  const query = `
    SELECT tur.*, tr.role_key, tr.display_name as role_name, tr.permissions, tr.agent_access
    FROM tenant_user_roles tur
    JOIN tenant_roles tr ON tr.id = tur.role_id
    WHERE tur.tenant_id = $1 AND tur.user_id = $2 AND tur.is_active = true
  `;

  const result = await db.query(query, [tenantId, targetUserId]);

  return createResponse(result.rows.map((row: any) => ({
    ...mapTenantUserRole(row),
    role: {
      id: row.role_id,
      roleKey: row.role_key,
      displayName: row.role_name,
      permissions: row.permissions,
      agentAccess: row.agent_access,
    },
  })));
}

async function assignUserRole(
  tenantId: string,
  assignedBy: string,
  targetUserId: string,
  body: any
): Promise<APIGatewayProxyResult> {
  const { roleId, expiresAt } = body;

  if (!roleId) {
    return createErrorResponse('roleId required');
  }

  const insertQuery = `
    INSERT INTO tenant_user_roles (tenant_id, user_id, role_id, assigned_by, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (tenant_id, user_id, role_id) 
    DO UPDATE SET is_active = true, assigned_at = NOW(), assigned_by = $4, expires_at = $5
    RETURNING *
  `;

  const result = await db.query(insertQuery, [tenantId, targetUserId, roleId, assignedBy, expiresAt]);

  return createResponse(mapTenantUserRole(result.rows[0]));
}

async function revokeUserRole(
  tenantId: string,
  revokedBy: string,
  targetUserId: string,
  roleId: string
): Promise<APIGatewayProxyResult> {
  const updateQuery = `
    UPDATE tenant_user_roles 
    SET is_active = false 
    WHERE tenant_id = $1 AND user_id = $2 AND role_id = $3
    RETURNING id
  `;

  const result = await db.query(updateQuery, [tenantId, targetUserId, roleId]);

  if (result.rows.length === 0) {
    return createErrorResponse('Role assignment not found');
  }

  return createResponse({ revoked: true, userId: targetUserId, roleId });
}

// =============================================================================
// Direct Agent Access
// =============================================================================

async function getUserAgentAccess(tenantId: string, targetUserId: string): Promise<APIGatewayProxyResult> {
  const query = `
    SELECT uaa.*, ar.agent_key, ar.display_name as agent_name, ar.icon_name
    FROM user_agent_access uaa
    JOIN agent_registry ar ON ar.id = uaa.agent_id
    WHERE uaa.tenant_id = $1 AND uaa.user_id = $2 AND uaa.is_active = true
  `;

  const result = await db.query(query, [tenantId, targetUserId]);

  return createResponse(result.rows.map((row: any) => ({
    ...mapUserAgentAccess(row),
    agent: {
      id: row.agent_id,
      agentKey: row.agent_key,
      displayName: row.agent_name,
      iconName: row.icon_name,
    },
  })));
}

async function grantAgentAccess(
  tenantId: string,
  grantedBy: string,
  targetUserId: string,
  body: any
): Promise<APIGatewayProxyResult> {
  const { agentKey, accessLevel = 'user', permissions, expiresAt } = body;

  if (!agentKey) {
    return createErrorResponse('agentKey required');
  }

  // Get agent ID
  const agentQuery = `SELECT id FROM agent_registry WHERE agent_key = $1 AND is_active = true`;
  const agentResult = await db.query(agentQuery, [agentKey]);

  if (agentResult.rows.length === 0) {
    return createErrorResponse('Agent not found');
  }

  const agentId = agentResult.rows[0].id;

  const insertQuery = `
    INSERT INTO user_agent_access (tenant_id, user_id, agent_id, access_level, permissions, granted_by, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (tenant_id, user_id, agent_id) 
    DO UPDATE SET is_active = true, access_level = $4, permissions = $5, granted_at = NOW(), granted_by = $6, expires_at = $7
    RETURNING *
  `;

  const result = await db.query(insertQuery, [
    tenantId, targetUserId, agentId, accessLevel,
    JSON.stringify(permissions || {}), grantedBy, expiresAt
  ]);

  return createResponse(mapUserAgentAccess(result.rows[0]));
}

async function revokeAgentAccess(
  tenantId: string,
  revokedBy: string,
  targetUserId: string,
  agentKey: string
): Promise<APIGatewayProxyResult> {
  // Get agent ID
  const agentQuery = `SELECT id FROM agent_registry WHERE agent_key = $1`;
  const agentResult = await db.query(agentQuery, [agentKey]);

  if (agentResult.rows.length === 0) {
    return createErrorResponse('Agent not found');
  }

  const updateQuery = `
    UPDATE user_agent_access 
    SET is_active = false 
    WHERE tenant_id = $1 AND user_id = $2 AND agent_id = $3
    RETURNING id
  `;

  const result = await db.query(updateQuery, [tenantId, targetUserId, agentResult.rows[0].id]);

  if (result.rows.length === 0) {
    return createErrorResponse('Agent access not found');
  }

  return createResponse({ revoked: true, userId: targetUserId, agentKey });
}

// =============================================================================
// Effective Permissions
// =============================================================================

async function getEffectivePermissions(tenantId: string, targetUserId: string): Promise<APIGatewayProxyResult> {
  // Get all active agents
  const agentsQuery = `SELECT * FROM agent_registry WHERE is_active = true ORDER BY sort_order`;
  const agentsResult = await db.query(agentsQuery);

  const permissions = await Promise.all(
    agentsResult.rows.map(async (agent: any) => {
      // Check access using helper function
      const accessQuery = `SELECT check_user_agent_access($1, $2, $3) as has_access`;
      const accessResult = await db.query(accessQuery, [tenantId, targetUserId, agent.agent_key]);

      // Get permissions using helper function
      const permsQuery = `SELECT get_user_agent_permissions($1, $2, $3) as permissions`;
      const permsResult = await db.query(permsQuery, [tenantId, targetUserId, agent.agent_key]);

      return {
        agentKey: agent.agent_key,
        agentName: agent.display_name,
        hasAccess: accessResult.rows[0]?.has_access || false,
        permissions: permsResult.rows[0]?.permissions || {},
      };
    })
  );

  return createResponse(permissions);
}

// =============================================================================
// Initialize Tenant Roles
// =============================================================================

async function initializeTenantRoles(tenantId: string): Promise<APIGatewayProxyResult> {
  await db.query(`SELECT initialize_tenant_roles($1)`, [tenantId]);

  const roles = await getTenantRoles(tenantId);
  return roles;
}

// =============================================================================
// Mappers
// =============================================================================

function mapAgentRegistry(row: any): AgentRegistryEntry {
  return {
    id: row.id,
    agentKey: row.agent_key,
    displayName: row.display_name,
    description: row.description,
    iconName: row.icon_name,
    baseUrl: row.base_url,
    port: row.port,
    isActive: row.is_active,
    isInternal: row.is_internal,
    requiresLicense: row.requires_license,
    licenseTier: row.license_tier,
    capabilities: row.capabilities || [],
    defaultPermissions: row.default_permissions || {},
    metadata: row.metadata || {},
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTenantRole(row: any): TenantRole {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    roleKey: row.role_key,
    displayName: row.display_name,
    description: row.description,
    isSystemRole: row.is_system_role,
    permissions: row.permissions || {},
    agentAccess: row.agent_access || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

function mapTenantUserRole(row: any): TenantUserRole {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    roleId: row.role_id,
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    expiresAt: row.expires_at,
    isActive: row.is_active,
  };
}

function mapUserAgentAccess(row: any): UserAgentAccess {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    agentId: row.agent_id,
    accessLevel: row.access_level,
    permissions: row.permissions || {},
    grantedAt: row.granted_at,
    grantedBy: row.granted_by,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    metadata: row.metadata || {},
  };
}
