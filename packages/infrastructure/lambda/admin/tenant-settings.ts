/**
 * RADIANT v7.43.0 - Tenant Settings Admin API
 * 
 * Unified tenant settings management for retention, storage, AI, features, and compliance.
 * Uses the tenant_settings table for persistent, RLS-isolated configuration.
 * 
 * Endpoints:
 *   GET    /admin/tenant-settings/:tenantId       - Get tenant settings
 *   PUT    /admin/tenant-settings/:tenantId       - Update tenant settings
 *   GET    /admin/tenant-settings                  - List all tenant settings (platform admin)
 *   POST   /admin/tenant-settings/:tenantId/reset - Reset to defaults
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/tenant-settings',
  category: 'audit',
  sourceType: 'lambda',
});

// =============================================================================
// Types
// =============================================================================

interface TenantSettings {
  tenantId: string;
  chatRetentionDays: number;
  fileRetentionDays: number;
  auditLogRetentionDays: number;
  maxStorageGb: number | null;
  storageTierAutoPromote: boolean;
  hotToWarmHours: number;
  warmToColdDays: number;
  coldToGlacierYears: number;
  defaultModelId: string | null;
  maxTokensPerRequest: number;
  temperatureDefault: number;
  enableStreaming: boolean;
  enableCollaboration: boolean;
  enableFileUpload: boolean;
  enableConversationExport: boolean;
  enableConversationFork: boolean;
  complianceFrameworks: string[];
  dataClassificationDefault: string;
  requireEncryption: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

const DEFAULT_SETTINGS: Omit<TenantSettings, 'tenantId' | 'updatedAt' | 'updatedBy'> = {
  chatRetentionDays: 180,
  fileRetentionDays: 180,
  auditLogRetentionDays: 365,
  maxStorageGb: null,
  storageTierAutoPromote: true,
  hotToWarmHours: 24,
  warmToColdDays: 180,
  coldToGlacierYears: 7,
  defaultModelId: null,
  maxTokensPerRequest: 8192,
  temperatureDefault: 0.7,
  enableStreaming: true,
  enableCollaboration: true,
  enableFileUpload: true,
  enableConversationExport: true,
  enableConversationFork: true,
  complianceFrameworks: [],
  dataClassificationDefault: 'INTERNAL',
  requireEncryption: true,
};

// =============================================================================
// Handler
// =============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const pathParts = event.path.split('/').filter(Boolean);
  const tenantId = pathParts[2]; // /admin/tenant-settings/:tenantId
  const action = pathParts[3];   // /admin/tenant-settings/:tenantId/reset

  try {
    // GET /admin/tenant-settings - List all
    if (method === 'GET' && !tenantId) {
      return await listAllSettings(event);
    }

    // GET /admin/tenant-settings/:tenantId - Get one
    if (method === 'GET' && tenantId && !action) {
      return await getSettings(tenantId);
    }

    // PUT /admin/tenant-settings/:tenantId - Update
    if (method === 'PUT' && tenantId && !action) {
      const body = JSON.parse(event.body || '{}');
      const userId = event.requestContext?.authorizer?.userId as string || 'system';
      return await updateSettings(tenantId, body, userId);
    }

    // POST /admin/tenant-settings/:tenantId/reset - Reset to defaults
    if (method === 'POST' && tenantId && action === 'reset') {
      const userId = event.requestContext?.authorizer?.userId as string || 'system';
      return await resetSettings(tenantId, userId);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not Found', message: `Unknown route: ${method} ${event.path}` }),
    };
  } catch (error) {
    logger.error('Tenant settings error', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) }),
    };
  }
}

// =============================================================================
// Operations
// =============================================================================

async function getSettings(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT ts.*, t.name as tenant_name, t.display_name as tenant_display_name
     FROM tenant_settings ts
     JOIN tenants t ON ts.tenant_id = t.id
     WHERE ts.tenant_id = $1`,
    [stringParam('tenantId', tenantId)]
  );

  if (!result.rows?.length) {
    // Auto-create with defaults
    await executeStatement(
      `INSERT INTO tenant_settings (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      [stringParam('tenantId', tenantId)]
    );
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...DEFAULT_SETTINGS, tenantId, updatedAt: new Date().toISOString(), updatedBy: null }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapRow(result.rows[0] as Record<string, unknown>)),
  };
}

async function listAllSettings(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

  const result = await executeStatement(
    `SELECT ts.*, t.name as tenant_name, t.display_name as tenant_display_name
     FROM tenant_settings ts
     JOIN tenants t ON ts.tenant_id = t.id
     ORDER BY t.name
     LIMIT $1 OFFSET $2`,
    [
      stringParam('limit', String(limit)),
      stringParam('offset', String(offset)),
    ]
  );

  const countResult = await executeStatement(
    `SELECT COUNT(*) as total FROM tenant_settings`, []
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: (result.rows || []).map((r: Record<string, unknown>) => mapRow(r)),
      total: Number((countResult.rows?.[0] as Record<string, unknown>)?.total || 0),
      limit,
      offset,
    }),
  };
}

async function updateSettings(
  tenantId: string,
  updates: Partial<TenantSettings>,
  updatedBy: string
): Promise<APIGatewayProxyResult> {
  // Build dynamic SET clause from allowed fields
  const allowedFields: Record<string, string> = {
    chatRetentionDays: 'chat_retention_days',
    fileRetentionDays: 'file_retention_days',
    auditLogRetentionDays: 'audit_log_retention_days',
    maxStorageGb: 'max_storage_gb',
    storageTierAutoPromote: 'storage_tier_auto_promote',
    hotToWarmHours: 'hot_to_warm_hours',
    warmToColdDays: 'warm_to_cold_days',
    coldToGlacierYears: 'cold_to_glacier_years',
    defaultModelId: 'default_model_id',
    maxTokensPerRequest: 'max_tokens_per_request',
    temperatureDefault: 'temperature_default',
    enableStreaming: 'enable_streaming',
    enableCollaboration: 'enable_collaboration',
    enableFileUpload: 'enable_file_upload',
    enableConversationExport: 'enable_conversation_export',
    enableConversationFork: 'enable_conversation_fork',
    complianceFrameworks: 'compliance_frameworks',
    dataClassificationDefault: 'data_classification_default',
    requireEncryption: 'require_encryption',
  };

  const setClauses: string[] = ['updated_at = NOW()', 'updated_by = $2'];
  const params = [
    stringParam('tenantId', tenantId),
    stringParam('updatedBy', updatedBy),
  ];
  let paramIndex = 3;

  for (const [key, column] of Object.entries(allowedFields)) {
    if (key in updates) {
      const value = (updates as Record<string, unknown>)[key];
      if (column === 'compliance_frameworks') {
        setClauses.push(`${column} = $${paramIndex}::text[]`);
        params.push(stringParam(`p${paramIndex}`, `{${(value as string[]).join(',')}}`));
      } else {
        setClauses.push(`${column} = $${paramIndex}`);
        params.push(stringParam(`p${paramIndex}`, String(value ?? '')));
      }
      paramIndex++;
    }
  }

  if (setClauses.length <= 2) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Bad Request', message: 'No valid fields to update' }),
    };
  }

  // Upsert
  await executeStatement(
    `INSERT INTO tenant_settings (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
    [stringParam('tenantId', tenantId)]
  );

  const result = await executeStatement(
    `UPDATE tenant_settings SET ${setClauses.join(', ')} WHERE tenant_id = $1 RETURNING *`,
    params
  );

  // Also sync retention_days on tenants table for backward compatibility
  if ('chatRetentionDays' in updates && updates.chatRetentionDays !== undefined) {
    await executeStatement(
      `UPDATE tenants SET retention_days = $2 WHERE id = $1`,
      [stringParam('tenantId', tenantId), stringParam('retentionDays', String(updates.chatRetentionDays))]
    );
  }

  logger.info('Tenant settings updated', { tenantId, updatedBy, fields: Object.keys(updates) });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapRow(result.rows[0] as Record<string, unknown>)),
  };
}

async function resetSettings(tenantId: string, updatedBy: string): Promise<APIGatewayProxyResult> {
  await executeStatement(
    `DELETE FROM tenant_settings WHERE tenant_id = $1`,
    [stringParam('tenantId', tenantId)]
  );
  await executeStatement(
    `INSERT INTO tenant_settings (tenant_id, updated_by) VALUES ($1, $2)`,
    [stringParam('tenantId', tenantId), stringParam('updatedBy', updatedBy)]
  );

  logger.info('Tenant settings reset to defaults', { tenantId, updatedBy });

  return getSettings(tenantId);
}

// =============================================================================
// Row Mapper
// =============================================================================

function mapRow(row: Record<string, unknown>): TenantSettings & { tenantName?: string; tenantDisplayName?: string } {
  return {
    tenantId: String(row.tenant_id),
    chatRetentionDays: Number(row.chat_retention_days ?? 180),
    fileRetentionDays: Number(row.file_retention_days ?? 180),
    auditLogRetentionDays: Number(row.audit_log_retention_days ?? 365),
    maxStorageGb: row.max_storage_gb ? Number(row.max_storage_gb) : null,
    storageTierAutoPromote: Boolean(row.storage_tier_auto_promote ?? true),
    hotToWarmHours: Number(row.hot_to_warm_hours ?? 24),
    warmToColdDays: Number(row.warm_to_cold_days ?? 180),
    coldToGlacierYears: Number(row.cold_to_glacier_years ?? 7),
    defaultModelId: row.default_model_id ? String(row.default_model_id) : null,
    maxTokensPerRequest: Number(row.max_tokens_per_request ?? 8192),
    temperatureDefault: Number(row.temperature_default ?? 0.7),
    enableStreaming: Boolean(row.enable_streaming ?? true),
    enableCollaboration: Boolean(row.enable_collaboration ?? true),
    enableFileUpload: Boolean(row.enable_file_upload ?? true),
    enableConversationExport: Boolean(row.enable_conversation_export ?? true),
    enableConversationFork: Boolean(row.enable_conversation_fork ?? true),
    complianceFrameworks: (row.compliance_frameworks as string[]) || [],
    dataClassificationDefault: String(row.data_classification_default ?? 'INTERNAL'),
    requireEncryption: Boolean(row.require_encryption ?? true),
    updatedAt: row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    ...(row.tenant_name ? { tenantName: String(row.tenant_name) } : {}),
    ...(row.tenant_display_name ? { tenantDisplayName: String(row.tenant_display_name) } : {}),
  };
}
