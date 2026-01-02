/**
 * Common database queries
 */

import { executeStatement, toSqlParams, setTenantContext, withTransaction } from './client';
import type {
  Tenant,
  User,
  Administrator,
  Provider,
  Model,
  UsageEvent,
  AuditLog,
  Invitation,
  ApprovalRequest,
} from './types';

// ============================================================================
// TENANT QUERIES
// ============================================================================

const TENANT_COLUMNS = 'id, name, display_name, domain, settings, status, created_at, updated_at';

export async function getTenantById(id: string): Promise<Tenant | null> {
  const result = await executeStatement<Tenant>(
    `SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = :id`,
    toSqlParams({ id })
  );
  return result.rows[0] || null;
}

export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
  const result = await executeStatement<Tenant>(
    `SELECT ${TENANT_COLUMNS} FROM tenants WHERE domain = :domain`,
    toSqlParams({ domain })
  );
  return result.rows[0] || null;
}

export async function listTenants(limit = 100, offset = 0): Promise<Tenant[]> {
  const result = await executeStatement<Tenant>(
    `SELECT ${TENANT_COLUMNS} FROM tenants ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    toSqlParams({ limit, offset })
  );
  return result.rows;
}

export async function createTenant(tenant: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>): Promise<Tenant> {
  const result = await executeStatement<Tenant>(
    `INSERT INTO tenants (name, display_name, domain, settings, status)
     VALUES (:name, :displayName, :domain, :settings, :status)
     RETURNING *`,
    toSqlParams({
      name: tenant.name,
      displayName: tenant.display_name,
      domain: tenant.domain || null,
      settings: tenant.settings,
      status: tenant.status,
    })
  );
  const newTenant = result.rows[0];

  // Initialize Cato Safety Architecture config for new tenant
  await executeStatement(
    `INSERT INTO cato_tenant_config (tenant_id)
     VALUES (:tenantId)
     ON CONFLICT (tenant_id) DO NOTHING`,
    toSqlParams({ tenantId: newTenant.id })
  );

  return newTenant;
}

// ============================================================================
// USER QUERIES
// ============================================================================

const USER_COLUMNS = 'id, tenant_id, cognito_user_id, email, display_name, role, status, settings, created_at, updated_at';

export async function getUserById(id: string, tenantId: string): Promise<User | null> {
  await setTenantContext(tenantId);
  const result = await executeStatement<User>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = :id`,
    toSqlParams({ id })
  );
  return result.rows[0] || null;
}

export async function getUserByCognitoId(cognitoUserId: string): Promise<User | null> {
  const result = await executeStatement<User>(
    `SELECT ${USER_COLUMNS} FROM users WHERE cognito_user_id = :cognitoUserId`,
    toSqlParams({ cognitoUserId })
  );
  return result.rows[0] || null;
}

export async function listUsersByTenant(tenantId: string, limit = 100, offset = 0): Promise<User[]> {
  await setTenantContext(tenantId);
  const result = await executeStatement<User>(
    `SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    toSqlParams({ limit, offset })
  );
  return result.rows;
}

// ============================================================================
// ADMINISTRATOR QUERIES
// ============================================================================

const ADMIN_COLUMNS = 'id, cognito_user_id, email, display_name, role, permissions, mfa_enabled, last_login_at, created_at, updated_at, invited_by';

export async function getAdministratorById(id: string): Promise<Administrator | null> {
  const result = await executeStatement<Administrator>(
    `SELECT ${ADMIN_COLUMNS} FROM administrators WHERE id = :id`,
    toSqlParams({ id })
  );
  return result.rows[0] || null;
}

export async function getAdministratorByCognitoId(cognitoUserId: string): Promise<Administrator | null> {
  const result = await executeStatement<Administrator>(
    `SELECT ${ADMIN_COLUMNS} FROM administrators WHERE cognito_user_id = :cognitoUserId`,
    toSqlParams({ cognitoUserId })
  );
  return result.rows[0] || null;
}

export async function listAdministrators(limit = 100, offset = 0): Promise<Administrator[]> {
  const result = await executeStatement<Administrator>(
    `SELECT ${ADMIN_COLUMNS} FROM administrators ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    toSqlParams({ limit, offset })
  );
  return result.rows;
}

// ============================================================================
// PROVIDER QUERIES
// ============================================================================

const PROVIDER_COLUMNS = 'id, name, display_name, type, category, base_url, api_key_secret_arn, status, health_status, config, created_at, updated_at';

export async function getProviderById(id: string): Promise<Provider | null> {
  const result = await executeStatement<Provider>(
    `SELECT ${PROVIDER_COLUMNS} FROM providers WHERE id = :id`,
    toSqlParams({ id })
  );
  return result.rows[0] || null;
}

export async function listProviders(status?: string): Promise<Provider[]> {
  let sql = `SELECT ${PROVIDER_COLUMNS} FROM providers`;
  const params: Record<string, unknown> = {};
  
  if (status) {
    sql += ' WHERE status = :status';
    params.status = status;
  }
  
  sql += ' ORDER BY name';
  
  const result = await executeStatement<Provider>(sql, toSqlParams(params));
  return result.rows;
}

export async function updateProviderHealth(
  id: string,
  healthStatus: Provider['health_status']
): Promise<void> {
  await executeStatement(
    'UPDATE providers SET health_status = :healthStatus, updated_at = NOW() WHERE id = :id',
    toSqlParams({ id, healthStatus })
  );
}

// ============================================================================
// MODEL QUERIES
// ============================================================================

const MODEL_COLUMNS = 'id, provider_id, name, display_name, category, capabilities, context_window, max_output_tokens, input_cost_per_1k, output_cost_per_1k, status, config, created_at, updated_at';

export async function getModelById(id: string): Promise<Model | null> {
  const result = await executeStatement<Model>(
    `SELECT ${MODEL_COLUMNS} FROM models WHERE id = :id`,
    toSqlParams({ id })
  );
  return result.rows[0] || null;
}

export async function getModelByName(name: string): Promise<Model | null> {
  const result = await executeStatement<Model>(
    `SELECT ${MODEL_COLUMNS} FROM models WHERE name = :name`,
    toSqlParams({ name })
  );
  return result.rows[0] || null;
}

export async function listModels(category?: string, status?: string): Promise<Model[]> {
  let sql = 'SELECT m.*, p.name as provider_name FROM models m JOIN providers p ON m.provider_id = p.id WHERE 1=1';
  const params: Record<string, unknown> = {};
  
  if (category) {
    sql += ' AND m.category = :category';
    params.category = category;
  }
  
  if (status) {
    sql += ' AND m.status = :status';
    params.status = status;
  }
  
  sql += ' ORDER BY m.display_name';
  
  const result = await executeStatement<Model>(sql, toSqlParams(params));
  return result.rows;
}

// ============================================================================
// USAGE QUERIES
// ============================================================================

export async function recordUsageEvent(event: Omit<UsageEvent, 'id' | 'created_at'>): Promise<UsageEvent> {
  const result = await executeStatement<UsageEvent>(
    `INSERT INTO usage_events (
      tenant_id, user_id, model_id, provider_id, request_id,
      input_tokens, output_tokens, total_tokens,
      input_cost, output_cost, total_cost,
      latency_ms, status, error_message
    ) VALUES (
      :tenantId, :userId, :modelId, :providerId, :requestId,
      :inputTokens, :outputTokens, :totalTokens,
      :inputCost, :outputCost, :totalCost,
      :latencyMs, :status, :errorMessage
    ) RETURNING *`,
    toSqlParams({
      tenantId: event.tenant_id,
      userId: event.user_id,
      modelId: event.model_id,
      providerId: event.provider_id,
      requestId: event.request_id,
      inputTokens: event.input_tokens,
      outputTokens: event.output_tokens,
      totalTokens: event.total_tokens,
      inputCost: event.input_cost,
      outputCost: event.output_cost,
      totalCost: event.total_cost,
      latencyMs: event.latency_ms,
      status: event.status,
      errorMessage: event.error_message || null,
    })
  );
  return result.rows[0];
}

export async function getUsageStats(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<{
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  by_model: { model_id: string; count: number; tokens: number; cost: number }[];
}> {
  await setTenantContext(tenantId);
  
  const summaryResult = await executeStatement<{
    total_requests: number;
    total_tokens: number;
    total_cost: number;
  }>(
    `SELECT 
      COUNT(*) as total_requests,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(total_cost), 0) as total_cost
     FROM usage_events
     WHERE created_at >= :startDate AND created_at < :endDate`,
    toSqlParams({ startDate, endDate })
  );
  
  const byModelResult = await executeStatement<{
    model_id: string;
    count: number;
    tokens: number;
    cost: number;
  }>(
    `SELECT 
      model_id,
      COUNT(*) as count,
      COALESCE(SUM(total_tokens), 0) as tokens,
      COALESCE(SUM(total_cost), 0) as cost
     FROM usage_events
     WHERE created_at >= :startDate AND created_at < :endDate
     GROUP BY model_id
     ORDER BY cost DESC`,
    toSqlParams({ startDate, endDate })
  );
  
  return {
    ...summaryResult.rows[0],
    by_model: byModelResult.rows,
  };
}

// ============================================================================
// AUDIT LOG QUERIES
// ============================================================================

export async function createAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
  const result = await executeStatement<AuditLog>(
    `INSERT INTO audit_logs (
      tenant_id, actor_id, actor_type, action, resource_type, resource_id,
      details, ip_address, user_agent
    ) VALUES (
      :tenantId, :actorId, :actorType, :action, :resourceType, :resourceId,
      :details, :ipAddress, :userAgent
    ) RETURNING *`,
    toSqlParams({
      tenantId: log.tenant_id || null,
      actorId: log.actor_id,
      actorType: log.actor_type,
      action: log.action,
      resourceType: log.resource_type,
      resourceId: log.resource_id || null,
      details: log.details,
      ipAddress: log.ip_address || null,
      userAgent: log.user_agent || null,
    })
  );
  return result.rows[0];
}

export async function listAuditLogs(
  filters: {
    tenantId?: string;
    actorId?: string;
    action?: string;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
  },
  limit = 100,
  offset = 0
): Promise<AuditLog[]> {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: Record<string, unknown> = { limit, offset };
  
  if (filters.tenantId) {
    sql += ' AND tenant_id = :tenantId';
    params.tenantId = filters.tenantId;
  }
  if (filters.actorId) {
    sql += ' AND actor_id = :actorId';
    params.actorId = filters.actorId;
  }
  if (filters.action) {
    sql += ' AND action = :action';
    params.action = filters.action;
  }
  if (filters.resourceType) {
    sql += ' AND resource_type = :resourceType';
    params.resourceType = filters.resourceType;
  }
  if (filters.startDate) {
    sql += ' AND created_at >= :startDate';
    params.startDate = filters.startDate;
  }
  if (filters.endDate) {
    sql += ' AND created_at < :endDate';
    params.endDate = filters.endDate;
  }
  
  sql += ' ORDER BY created_at DESC LIMIT :limit OFFSET :offset';
  
  const result = await executeStatement<AuditLog>(sql, toSqlParams(params));
  return result.rows;
}

// ============================================================================
// INVITATION QUERIES
// ============================================================================

export async function getInvitationByToken(tokenHash: string): Promise<Invitation | null> {
  const result = await executeStatement<Invitation>(
    'SELECT * FROM invitations WHERE token_hash = :tokenHash AND expires_at > NOW() AND accepted_at IS NULL',
    toSqlParams({ tokenHash })
  );
  return result.rows[0] || null;
}

export async function listPendingInvitations(): Promise<Invitation[]> {
  const result = await executeStatement<Invitation>(
    'SELECT * FROM invitations WHERE accepted_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC'
  );
  return result.rows;
}

// ============================================================================
// APPROVAL REQUEST QUERIES
// ============================================================================

export async function getApprovalRequestById(id: string): Promise<ApprovalRequest | null> {
  const result = await executeStatement<ApprovalRequest>(
    'SELECT * FROM approval_requests WHERE id = :id',
    toSqlParams({ id })
  );
  return result.rows[0] || null;
}

export async function listPendingApprovalRequests(): Promise<ApprovalRequest[]> {
  const result = await executeStatement<ApprovalRequest>(
    `SELECT * FROM approval_requests 
     WHERE status = 'pending' AND expires_at > NOW() 
     ORDER BY created_at DESC`
  );
  return result.rows;
}
