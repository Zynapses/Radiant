/**
 * Memory Retention & User Profile - Admin API Endpoints
 * 
 * Serves ALL THREE admin apps:
 *   1. Radiant Admin (platform-level policies)
 *   2. Think Tank Admin (tenant-level overrides)
 *   3. Think Tank Tenant Admin (tenant-admin-level overrides)
 * 
 * Base path: /api/admin/memory-retention/*
 */

import { memoryRetentionPolicyService } from '../shared/services/memory-retention-policy.service';
import { userMemoryProfileService } from '../shared/services/user-memory-profile.service';

interface AdminRequest {
  httpMethod: string;
  path: string;
  queryStringParameters?: Record<string, string>;
  body?: string;
  requestContext?: {
    authorizer?: {
      tenantId?: string;
      userId?: string;
      role?: string; // 'super_admin' | 'tenant_admin' | 'tenant_owner' | etc.
    };
  };
}

interface AdminResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function getTenantId(event: AdminRequest): string {
  const tenantId = event.requestContext?.authorizer?.tenantId
    || event.queryStringParameters?.tenantId;
  if (!tenantId) throw new Error('Missing tenantId');
  return tenantId;
}

function getAdminUserId(event: AdminRequest): string {
  return event.requestContext?.authorizer?.userId || 'admin';
}

function getAdminRole(event: AdminRequest): string {
  return event.requestContext?.authorizer?.role || 'admin';
}

function jsonResponse(statusCode: number, data: unknown): AdminResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data),
  };
}

function parseBody(event: AdminRequest): Record<string, unknown> {
  if (!event.body) return {};
  try { return JSON.parse(event.body); } catch { return {}; }
}

// =============================================================================
// Main Handler
// =============================================================================

export async function handler(event: AdminRequest): Promise<AdminResponse> {
  const path = event.path.replace('/api/admin/memory-retention', '');
  const method = event.httpMethod.toUpperCase();

  try {
    // =========================================================================
    // Platform Policy (Radiant Super-Admin ONLY)
    // =========================================================================

    if (path === '/platform/policy' && method === 'GET') {
      const targetType = event.queryStringParameters?.targetType || 'all';
      return jsonResponse(200, await memoryRetentionPolicyService.getPlatformPolicy(targetType));
    }

    if (path === '/platform/policy' && method === 'PUT') {
      const role = getAdminRole(event);
      if (role !== 'super_admin' && role !== 'admin') {
        return jsonResponse(403, { error: 'Only Radiant super-admins can modify platform policies' });
      }
      const body = parseBody(event);
      const targetType = (body.targetType as string) || 'all';
      delete body.targetType;
      return jsonResponse(200, await memoryRetentionPolicyService.updatePlatformPolicy(targetType, body));
    }

    // =========================================================================
    // Tenant Override (Think Tank Admin)
    // =========================================================================

    if (path === '/tenant/override' && method === 'GET') {
      const tenantId = getTenantId(event);
      const targetType = event.queryStringParameters?.targetType || 'all';
      const override = await memoryRetentionPolicyService.getTenantOverride(tenantId, targetType);
      return jsonResponse(200, override || { active: false, tenantId, targetType });
    }

    if (path === '/tenant/override' && method === 'PUT') {
      const tenantId = getTenantId(event);
      const adminUserId = getAdminUserId(event);
      const body = parseBody(event);
      const targetType = (body.targetType as string) || 'all';
      const reason = body.reason as string | undefined;
      delete body.targetType;
      delete body.reason;
      return jsonResponse(200, await memoryRetentionPolicyService.setTenantOverride(
        tenantId, targetType, adminUserId, body, reason
      ));
    }

    if (path === '/tenant/override' && method === 'DELETE') {
      const tenantId = getTenantId(event);
      const adminUserId = getAdminUserId(event);
      const targetType = event.queryStringParameters?.targetType || 'all';
      await memoryRetentionPolicyService.deleteTenantOverride(tenantId, targetType, adminUserId);
      return jsonResponse(200, { deleted: true });
    }

    // =========================================================================
    // Tenant Admin Override (Think Tank Tenant Admin)
    // =========================================================================

    if (path === '/tenant-admin/override' && method === 'GET') {
      const tenantId = getTenantId(event);
      const targetType = event.queryStringParameters?.targetType || 'all';
      const override = await memoryRetentionPolicyService.getTenantAdminOverride(tenantId, targetType);
      return jsonResponse(200, override || { active: false, tenantId, targetType });
    }

    if (path === '/tenant-admin/override' && method === 'PUT') {
      const tenantId = getTenantId(event);
      const adminUserId = getAdminUserId(event);
      const body = parseBody(event);
      const targetType = (body.targetType as string) || 'all';
      const reason = body.reason as string | undefined;
      delete body.targetType;
      delete body.reason;
      return jsonResponse(200, await memoryRetentionPolicyService.setTenantAdminOverride(
        tenantId, targetType, adminUserId, body, reason
      ));
    }

    if (path === '/tenant-admin/override' && method === 'DELETE') {
      const tenantId = getTenantId(event);
      const adminUserId = getAdminUserId(event);
      const targetType = event.queryStringParameters?.targetType || 'all';
      await memoryRetentionPolicyService.deleteTenantAdminOverride(tenantId, targetType, adminUserId);
      return jsonResponse(200, { deleted: true });
    }

    // =========================================================================
    // Effective Policy (resolved from hierarchy — used by all 3 admin apps)
    // =========================================================================

    if (path === '/effective' && method === 'GET') {
      const tenantId = getTenantId(event);
      const targetType = event.queryStringParameters?.targetType || 'all';
      return jsonResponse(200, await memoryRetentionPolicyService.getEffectivePolicy(tenantId, targetType));
    }

    // =========================================================================
    // Dashboard (used by all 3 admin apps)
    // =========================================================================

    if (path === '/dashboard' && method === 'GET') {
      const tenantId = getTenantId(event);
      return jsonResponse(200, await memoryRetentionPolicyService.getDashboard(tenantId));
    }

    // =========================================================================
    // User Profiles (used by all 3 admin apps)
    // =========================================================================

    if (path === '/profiles' && method === 'GET') {
      const tenantId = getTenantId(event);
      const limit = Number(event.queryStringParameters?.limit || 50);
      const offset = Number(event.queryStringParameters?.offset || 0);
      const minQuality = event.queryStringParameters?.minQuality
        ? Number(event.queryStringParameters.minQuality) : undefined;
      const sortBy = event.queryStringParameters?.sortBy;
      return jsonResponse(200, await userMemoryProfileService.listProfiles(tenantId, {
        limit, offset, minQuality, sortBy,
      }));
    }

    if (path.startsWith('/profiles/') && method === 'GET') {
      const userId = path.split('/')[2];
      const tenantId = getTenantId(event);
      const profile = await userMemoryProfileService.getProfileStats(tenantId, userId);
      if (!profile) return jsonResponse(404, { error: 'Profile not found' });
      return jsonResponse(200, profile);
    }

    if (path.startsWith('/profiles/') && path.endsWith('/summary') && method === 'GET') {
      const userId = path.split('/')[2];
      const tenantId = getTenantId(event);
      const maxTokens = Number(event.queryStringParameters?.maxTokens || 800);
      const summary = await userMemoryProfileService.getProfileSummary(tenantId, userId, maxTokens);
      return jsonResponse(200, summary || { available: false, reason: 'Session memory disabled' });
    }

    // =========================================================================
    // Memory Pruning (admin-triggered)
    // =========================================================================

    if (path === '/prune' && method === 'POST') {
      const tenantId = getTenantId(event);
      const body = parseBody(event);
      if (body.userId) {
        const deleted = await memoryRetentionPolicyService.pruneUserMemories(tenantId, String(body.userId));
        return jsonResponse(200, { pruned: true, deletedEntries: deleted, userId: body.userId });
      } else {
        const result = await memoryRetentionPolicyService.pruneTenantMemories(tenantId);
        return jsonResponse(200, { pruned: true, ...result });
      }
    }

    // =========================================================================
    // Audit Log
    // =========================================================================

    if (path === '/audit' && method === 'GET') {
      const tenantId = getTenantId(event);
      const limit = Number(event.queryStringParameters?.limit || 50);
      return jsonResponse(200, await memoryRetentionPolicyService.getAuditLog(tenantId, limit));
    }

    // =========================================================================
    // Not Found
    // =========================================================================

    return jsonResponse(404, {
      error: 'Not found',
      path: event.path,
      availableEndpoints: [
        'GET     /platform/policy              — Platform retention defaults (Radiant Admin)',
        'PUT     /platform/policy              — Update platform defaults (Radiant Admin only)',
        'GET     /tenant/override              — Tenant retention override (TT Admin)',
        'PUT     /tenant/override              — Set tenant override (TT Admin)',
        'DELETE  /tenant/override              — Remove tenant override (TT Admin)',
        'GET     /tenant-admin/override        — Tenant admin override (TT Tenant Admin)',
        'PUT     /tenant-admin/override        — Set tenant admin override (TT Tenant Admin)',
        'DELETE  /tenant-admin/override        — Remove tenant admin override (TT Tenant Admin)',
        'GET     /effective                    — Resolved effective policy (all apps)',
        'GET     /dashboard                    — Full dashboard (all apps)',
        'GET     /profiles                     — List user profiles (all apps)',
        'GET     /profiles/:userId             — User profile stats (all apps)',
        'GET     /profiles/:userId/summary     — User profile summary (all apps)',
        'POST    /prune                        — Trigger memory pruning (all apps)',
        'GET     /audit                        — Retention audit log (all apps)',
      ],
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse(message.includes('cannot') ? 403 : 500, { error: message, path: event.path });
  }
}
