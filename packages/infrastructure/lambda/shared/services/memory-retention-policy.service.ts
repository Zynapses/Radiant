/**
 * Memory Retention Policy Service v1.0.0
 * 
 * Three-tier retention policy hierarchy:
 *   Platform Default (Radiant Super-Admin)
 *     → Tenant Override (Think Tank Admin)
 *       → Tenant Admin Override (Think Tank Tenant Admin)
 * 
 * Resolution: tenant_admin > tenant > platform
 * Constraint: tenant_admin CANNOT exceed tenant limits
 */

import { executeStatement } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'memory/retention-policy',
  category: 'infrastructure',
  sourceType: 'application',
});

// =============================================================================
// Types (inline — shared types available after pnpm build)
// =============================================================================

interface EffectiveRetentionPolicy {
  tenantId: string;
  targetType: string;
  retentionDays: number;
  maxStoragePerUserMb: number;
  maxEntriesPerUser: number;
  hotTierDays: number;
  warmTierDays: number;
  coldTierDays: number;
  archiveAfterDays: number;
  autoPruneEnabled: boolean;
  pruneMinImportance: number;
  pruneMinAccessCount: number;
  sessionToSessionMemoryEnabled: boolean;
  conversationHistoryEnabled: boolean;
  autoExtractEnabled: boolean;
  userCanDeleteOwnMemory: boolean;
  uploadedDocumentsEnabled: boolean;
  downloadedFilesEnabled: boolean;
  maxUploadSizeMb: number;
  sources: Record<string, string>;
  resolvedAt: string;
}

interface PlatformPolicy {
  policyId: string;
  targetType: string;
  retentionDays: number;
  maxStoragePerUserMb: number;
  maxEntriesPerUser: number;
  hotTierDays: number;
  warmTierDays: number;
  coldTierDays: number;
  archiveAfterDays: number;
  autoPruneEnabled: boolean;
  pruneMinImportance: number;
  pruneMinAccessCount: number;
  sessionToSessionMemoryEnabled: boolean;
  conversationHistoryEnabled: boolean;
  autoExtractEnabled: boolean;
  userCanDeleteOwnMemory: boolean;
  uploadedDocumentsEnabled: boolean;
  downloadedFilesEnabled: boolean;
  maxUploadSizeMb: number;
  createdAt: string;
  updatedAt: string;
}

interface TenantOverride {
  overrideId: string;
  tenantId: string;
  targetType: string;
  retentionDays?: number;
  maxStoragePerUserMb?: number;
  maxEntriesPerUser?: number;
  hotTierDays?: number;
  warmTierDays?: number;
  coldTierDays?: number;
  archiveAfterDays?: number;
  autoPruneEnabled?: boolean;
  pruneMinImportance?: number;
  pruneMinAccessCount?: number;
  sessionToSessionMemoryEnabled?: boolean;
  conversationHistoryEnabled?: boolean;
  autoExtractEnabled?: boolean;
  userCanDeleteOwnMemory?: boolean;
  uploadedDocumentsEnabled?: boolean;
  downloadedFilesEnabled?: boolean;
  maxUploadSizeMb?: number;
  overriddenBy: string;
  overrideReason?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Service
// =============================================================================

class MemoryRetentionPolicyService {
  // =========================================================================
  // Platform Policy (Radiant Super-Admin)
  // =========================================================================

  async getPlatformPolicy(targetType: string = 'all'): Promise<PlatformPolicy> {
    const result = await executeStatement(
      `SELECT * FROM platform_retention_policies WHERE target_type = $1`,
      [{ name: 'targetType', value: { stringValue: targetType } }]
    );

    if (result.rows.length === 0) {
      // Fall back to 'all'
      const fallback = await executeStatement(
        `SELECT * FROM platform_retention_policies WHERE target_type = 'all'`,
        []
      );
      if (fallback.rows.length === 0) {
        throw new Error('No platform retention policy found — run migration seed');
      }
      return this.mapPlatformPolicy(fallback.rows[0] as Record<string, unknown>);
    }

    return this.mapPlatformPolicy(result.rows[0] as Record<string, unknown>);
  }

  async updatePlatformPolicy(
    targetType: string,
    updates: Partial<Omit<PlatformPolicy, 'policyId' | 'targetType' | 'createdAt' | 'updatedAt'>>
  ): Promise<PlatformPolicy> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'targetType', value: { stringValue: targetType } },
    ];
    let idx = 2;

    const fieldMap: Record<string, string> = {
      retentionDays: 'retention_days',
      maxStoragePerUserMb: 'max_storage_per_user_mb',
      maxEntriesPerUser: 'max_entries_per_user',
      hotTierDays: 'hot_tier_days',
      warmTierDays: 'warm_tier_days',
      coldTierDays: 'cold_tier_days',
      archiveAfterDays: 'archive_after_days',
      autoPruneEnabled: 'auto_prune_enabled',
      pruneMinImportance: 'prune_min_importance',
      pruneMinAccessCount: 'prune_min_access_count',
      sessionToSessionMemoryEnabled: 'session_to_session_memory_enabled',
      conversationHistoryEnabled: 'conversation_history_enabled',
      autoExtractEnabled: 'auto_extract_enabled',
      userCanDeleteOwnMemory: 'user_can_delete_own_memory',
      uploadedDocumentsEnabled: 'uploaded_documents_enabled',
      downloadedFilesEnabled: 'downloaded_files_enabled',
      maxUploadSizeMb: 'max_upload_size_mb',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((updates as Record<string, unknown>)[key] !== undefined) {
        sets.push(`${col} = $${idx}`);
        const val = (updates as Record<string, unknown>)[key];
        if (typeof val === 'boolean') {
          params.push({ name: key, value: { booleanValue: val } });
        } else if (typeof val === 'number') {
          if (Number.isInteger(val)) {
            params.push({ name: key, value: { longValue: val } });
          } else {
            params.push({ name: key, value: { doubleValue: val } });
          }
        }
        idx++;
      }
    }

    await executeStatement(
      `UPDATE platform_retention_policies SET ${sets.join(', ')} WHERE target_type = $1`,
      params as Parameters<typeof executeStatement>[1]
    );

    return this.getPlatformPolicy(targetType);
  }

  // =========================================================================
  // Tenant Override (Think Tank Admin)
  // =========================================================================

  async getTenantOverride(tenantId: string, targetType: string = 'all'): Promise<TenantOverride | null> {
    const result = await executeStatement(
      `SELECT * FROM tenant_retention_overrides WHERE tenant_id = $1 AND target_type = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'targetType', value: { stringValue: targetType } },
      ]
    );

    if (result.rows.length === 0) return null;
    return this.mapTenantOverride(result.rows[0] as Record<string, unknown>);
  }

  async setTenantOverride(
    tenantId: string,
    targetType: string,
    overriddenBy: string,
    overrides: Record<string, unknown>,
    reason?: string
  ): Promise<TenantOverride> {
    const cols = ['tenant_id', 'target_type', 'overridden_by'];
    const vals = ['$1', '$2', '$3'];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'targetType', value: { stringValue: targetType } },
      { name: 'overriddenBy', value: { stringValue: overriddenBy } },
    ];
    let idx = 4;

    if (reason) {
      cols.push('override_reason');
      vals.push(`$${idx}`);
      params.push({ name: 'reason', value: { stringValue: reason } });
      idx++;
    }

    const fieldMap: Record<string, string> = {
      retentionDays: 'retention_days',
      maxStoragePerUserMb: 'max_storage_per_user_mb',
      maxEntriesPerUser: 'max_entries_per_user',
      hotTierDays: 'hot_tier_days',
      warmTierDays: 'warm_tier_days',
      coldTierDays: 'cold_tier_days',
      archiveAfterDays: 'archive_after_days',
      autoPruneEnabled: 'auto_prune_enabled',
      pruneMinImportance: 'prune_min_importance',
      pruneMinAccessCount: 'prune_min_access_count',
      sessionToSessionMemoryEnabled: 'session_to_session_memory_enabled',
      conversationHistoryEnabled: 'conversation_history_enabled',
      autoExtractEnabled: 'auto_extract_enabled',
      userCanDeleteOwnMemory: 'user_can_delete_own_memory',
      uploadedDocumentsEnabled: 'uploaded_documents_enabled',
      downloadedFilesEnabled: 'downloaded_files_enabled',
      maxUploadSizeMb: 'max_upload_size_mb',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (overrides[key] !== undefined) {
        cols.push(col);
        vals.push(`$${idx}`);
        const val = overrides[key];
        if (typeof val === 'boolean') {
          params.push({ name: key, value: { booleanValue: val } });
        } else if (typeof val === 'number') {
          if (Number.isInteger(val)) {
            params.push({ name: key, value: { longValue: val } });
          } else {
            params.push({ name: key, value: { doubleValue: val } });
          }
        }
        idx++;
      }
    }

    // Upsert
    const updateSets = cols.slice(3).map((c, i) => `${c} = $${i + 4}`);
    updateSets.push('updated_at = NOW()');

    await executeStatement(
      `INSERT INTO tenant_retention_overrides (${cols.join(', ')})
       VALUES (${vals.join(', ')})
       ON CONFLICT (tenant_id, target_type) DO UPDATE SET ${updateSets.join(', ')}`,
      params as Parameters<typeof executeStatement>[1]
    );

    // Audit log
    await this.logAudit(tenantId, 'tenant_override_set', 'tenant', overriddenBy, targetType, overrides);

    return (await this.getTenantOverride(tenantId, targetType))!;
  }

  async deleteTenantOverride(tenantId: string, targetType: string, deletedBy: string): Promise<void> {
    await executeStatement(
      `DELETE FROM tenant_retention_overrides WHERE tenant_id = $1 AND target_type = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'targetType', value: { stringValue: targetType } },
      ]
    );
    await this.logAudit(tenantId, 'tenant_override_deleted', 'tenant', deletedBy, targetType);
  }

  // =========================================================================
  // Tenant Admin Override (Think Tank Tenant Admin)
  // =========================================================================

  async getTenantAdminOverride(tenantId: string, targetType: string = 'all'): Promise<TenantOverride | null> {
    const result = await executeStatement(
      `SELECT * FROM tenant_admin_retention_overrides WHERE tenant_id = $1 AND target_type = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'targetType', value: { stringValue: targetType } },
      ]
    );

    if (result.rows.length === 0) return null;
    return this.mapTenantOverride(result.rows[0] as Record<string, unknown>);
  }

  async setTenantAdminOverride(
    tenantId: string,
    targetType: string,
    overriddenBy: string,
    overrides: Record<string, unknown>,
    reason?: string
  ): Promise<TenantOverride> {
    // Validate: tenant admin CANNOT exceed tenant-level limits
    const tenantOverride = await this.getTenantOverride(tenantId, targetType);
    if (tenantOverride) {
      // If tenant set retention to 90 days, tenant admin cannot set it to 180
      if (overrides.retentionDays !== undefined && tenantOverride.retentionDays !== undefined) {
        if (tenantOverride.retentionDays > 0 && (overrides.retentionDays as number) > tenantOverride.retentionDays) {
          throw new Error(
            `Tenant admin cannot exceed tenant retention limit of ${tenantOverride.retentionDays} days`
          );
        }
      }
      // If tenant set max storage, tenant admin cannot exceed it
      if (overrides.maxStoragePerUserMb !== undefined && tenantOverride.maxStoragePerUserMb !== undefined) {
        if (tenantOverride.maxStoragePerUserMb > 0 && (overrides.maxStoragePerUserMb as number) > tenantOverride.maxStoragePerUserMb) {
          throw new Error(
            `Tenant admin cannot exceed tenant storage limit of ${tenantOverride.maxStoragePerUserMb}MB`
          );
        }
      }
      // If tenant disabled session memory, tenant admin cannot re-enable
      if (overrides.sessionToSessionMemoryEnabled === true && tenantOverride.sessionToSessionMemoryEnabled === false) {
        throw new Error('Tenant admin cannot re-enable session memory when tenant has disabled it');
      }
    }

    const cols = ['tenant_id', 'target_type', 'overridden_by'];
    const vals = ['$1', '$2', '$3'];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'targetType', value: { stringValue: targetType } },
      { name: 'overriddenBy', value: { stringValue: overriddenBy } },
    ];
    let idx = 4;

    if (reason) {
      cols.push('override_reason');
      vals.push(`$${idx}`);
      params.push({ name: 'reason', value: { stringValue: reason } });
      idx++;
    }

    const fieldMap: Record<string, string> = {
      retentionDays: 'retention_days',
      maxStoragePerUserMb: 'max_storage_per_user_mb',
      maxEntriesPerUser: 'max_entries_per_user',
      hotTierDays: 'hot_tier_days',
      warmTierDays: 'warm_tier_days',
      sessionToSessionMemoryEnabled: 'session_to_session_memory_enabled',
      conversationHistoryEnabled: 'conversation_history_enabled',
      autoExtractEnabled: 'auto_extract_enabled',
      userCanDeleteOwnMemory: 'user_can_delete_own_memory',
      uploadedDocumentsEnabled: 'uploaded_documents_enabled',
      downloadedFilesEnabled: 'downloaded_files_enabled',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (overrides[key] !== undefined) {
        cols.push(col);
        vals.push(`$${idx}`);
        const val = overrides[key];
        if (typeof val === 'boolean') {
          params.push({ name: key, value: { booleanValue: val } });
        } else if (typeof val === 'number') {
          if (Number.isInteger(val)) {
            params.push({ name: key, value: { longValue: val } });
          } else {
            params.push({ name: key, value: { doubleValue: val } });
          }
        }
        idx++;
      }
    }

    const updateSets = cols.slice(3).map((c, i) => `${c} = $${i + 4}`);
    updateSets.push('updated_at = NOW()');

    await executeStatement(
      `INSERT INTO tenant_admin_retention_overrides (${cols.join(', ')})
       VALUES (${vals.join(', ')})
       ON CONFLICT (tenant_id, target_type) DO UPDATE SET ${updateSets.join(', ')}`,
      params as Parameters<typeof executeStatement>[1]
    );

    await this.logAudit(tenantId, 'tenant_admin_override_set', 'tenant_admin', overriddenBy, targetType, overrides);

    return (await this.getTenantAdminOverride(tenantId, targetType))!;
  }

  async deleteTenantAdminOverride(tenantId: string, targetType: string, deletedBy: string): Promise<void> {
    await executeStatement(
      `DELETE FROM tenant_admin_retention_overrides WHERE tenant_id = $1 AND target_type = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'targetType', value: { stringValue: targetType } },
      ]
    );
    await this.logAudit(tenantId, 'tenant_admin_override_deleted', 'tenant_admin', deletedBy, targetType);
  }

  // =========================================================================
  // Effective Policy Resolution
  // =========================================================================

  async getEffectivePolicy(tenantId: string, targetType: string = 'all'): Promise<EffectiveRetentionPolicy> {
    const result = await executeStatement(
      `SELECT resolve_effective_retention($1, $2) as policy`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'targetType', value: { stringValue: targetType } },
      ]
    );

    const row = result.rows[0] as Record<string, unknown>;
    const policy = typeof row.policy === 'string' ? JSON.parse(row.policy) : row.policy;
    return policy as EffectiveRetentionPolicy;
  }

  // =========================================================================
  // Memory Pruning
  // =========================================================================

  async pruneUserMemories(tenantId: string, userId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT prune_user_memories($1, $2) as deleted_count`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    const count = Number((result.rows[0] as Record<string, unknown>).deleted_count || 0);
    if (count > 0) {
      logger.info('Pruned user memories', { tenantId, userId, deletedCount: count });
    }
    return count;
  }

  async pruneTenantMemories(tenantId: string): Promise<{ usersProcessed: number; totalDeleted: number }> {
    const policy = await this.getEffectivePolicy(tenantId);
    if (!policy.autoPruneEnabled || policy.retentionDays === 0) {
      return { usersProcessed: 0, totalDeleted: 0 };
    }

    const usersResult = await executeStatement(
      `SELECT DISTINCT user_id FROM user_memory_profiles WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    let totalDeleted = 0;
    for (const row of usersResult.rows) {
      const userId = String((row as Record<string, unknown>).user_id);
      totalDeleted += await this.pruneUserMemories(tenantId, userId);
    }

    return { usersProcessed: usersResult.rows.length, totalDeleted };
  }

  // =========================================================================
  // Dashboard Stats
  // =========================================================================

  async getDashboard(tenantId: string): Promise<Record<string, unknown>> {
    const [platformPolicy, tenantOverride, tenantAdminOverride, effectivePolicy] = await Promise.all([
      this.getPlatformPolicy(),
      this.getTenantOverride(tenantId),
      this.getTenantAdminOverride(tenantId),
      this.getEffectivePolicy(tenantId),
    ]);

    // Usage stats
    const usageResult = await executeStatement(
      `SELECT 
        COUNT(DISTINCT user_id) as total_users,
        SUM(total_entries) as total_entries,
        SUM(total_bytes) as total_bytes,
        AVG(total_entries) as avg_entries_per_user,
        AVG(total_bytes) / 1048576.0 as avg_storage_mb,
        SUM(hot_tier_entries) as hot_entries,
        SUM(warm_tier_entries) as warm_entries,
        SUM(cold_tier_entries) as cold_entries,
        SUM(archive_tier_entries) as archive_entries
       FROM user_memory_usage WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const usage = usageResult.rows[0] as Record<string, unknown>;

    // Profile stats
    const profileResult = await executeStatement(
      `SELECT 
        COUNT(*) as total_profiles,
        AVG(profile_quality) as avg_quality,
        AVG(total_memory_entries) as avg_entries,
        MAX(total_memory_entries) as max_entries,
        COUNT(*) FILTER (WHERE profile_quality > 0.7) as high_quality_profiles
       FROM user_memory_profiles WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const profiles = profileResult.rows[0] as Record<string, unknown>;

    return {
      platformPolicy,
      tenantOverride,
      tenantAdminOverride,
      effectivePolicy,
      usage: {
        totalUsers: Number(usage.total_users || 0),
        totalEntries: Number(usage.total_entries || 0),
        totalStorageBytes: Number(usage.total_bytes || 0),
        avgEntriesPerUser: Number(usage.avg_entries_per_user || 0),
        avgStorageMb: Number(usage.avg_storage_mb || 0),
        hotTierEntries: Number(usage.hot_entries || 0),
        warmTierEntries: Number(usage.warm_entries || 0),
        coldTierEntries: Number(usage.cold_entries || 0),
        archiveTierEntries: Number(usage.archive_entries || 0),
      },
      profiles: {
        totalProfiles: Number(profiles.total_profiles || 0),
        avgQuality: Number(profiles.avg_quality || 0),
        avgEntries: Number(profiles.avg_entries || 0),
        maxEntries: Number(profiles.max_entries || 0),
        highQualityProfiles: Number(profiles.high_quality_profiles || 0),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // =========================================================================
  // Audit Log
  // =========================================================================

  async getAuditLog(tenantId: string, limit: number = 50): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM memory_retention_audit WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows;
  }

  private async logAudit(
    tenantId: string,
    action: string,
    scope: string,
    performedBy: string,
    targetType?: string,
    newValue?: unknown
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO memory_retention_audit (tenant_id, action, scope, performed_by, target_type, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'action', value: { stringValue: action } },
        { name: 'scope', value: { stringValue: scope } },
        { name: 'performedBy', value: { stringValue: performedBy } },
        { name: 'targetType', value: targetType ? { stringValue: targetType } : { isNull: true } },
        { name: 'newValue', value: newValue ? { stringValue: JSON.stringify(newValue) } : { isNull: true } },
      ]
    );
  }

  // =========================================================================
  // Mappers
  // =========================================================================

  private mapPlatformPolicy(row: Record<string, unknown>): PlatformPolicy {
    return {
      policyId: String(row.policy_id || ''),
      targetType: String(row.target_type || 'all'),
      retentionDays: Number(row.retention_days || 0),
      maxStoragePerUserMb: Number(row.max_storage_per_user_mb || 0),
      maxEntriesPerUser: Number(row.max_entries_per_user || 0),
      hotTierDays: Number(row.hot_tier_days || 30),
      warmTierDays: Number(row.warm_tier_days || 180),
      coldTierDays: Number(row.cold_tier_days || 365),
      archiveAfterDays: Number(row.archive_after_days || 0),
      autoPruneEnabled: Boolean(row.auto_prune_enabled),
      pruneMinImportance: Number(row.prune_min_importance || 0.1),
      pruneMinAccessCount: Number(row.prune_min_access_count || 0),
      sessionToSessionMemoryEnabled: row.session_to_session_memory_enabled !== false,
      conversationHistoryEnabled: row.conversation_history_enabled !== false,
      autoExtractEnabled: row.auto_extract_enabled !== false,
      userCanDeleteOwnMemory: row.user_can_delete_own_memory !== false,
      uploadedDocumentsEnabled: row.uploaded_documents_enabled !== false,
      downloadedFilesEnabled: row.downloaded_files_enabled !== false,
      maxUploadSizeMb: Number(row.max_upload_size_mb || 100),
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  private mapTenantOverride(row: Record<string, unknown>): TenantOverride {
    return {
      overrideId: String(row.override_id || ''),
      tenantId: String(row.tenant_id || ''),
      targetType: String(row.target_type || 'all'),
      retentionDays: row.retention_days != null ? Number(row.retention_days) : undefined,
      maxStoragePerUserMb: row.max_storage_per_user_mb != null ? Number(row.max_storage_per_user_mb) : undefined,
      maxEntriesPerUser: row.max_entries_per_user != null ? Number(row.max_entries_per_user) : undefined,
      hotTierDays: row.hot_tier_days != null ? Number(row.hot_tier_days) : undefined,
      warmTierDays: row.warm_tier_days != null ? Number(row.warm_tier_days) : undefined,
      coldTierDays: row.cold_tier_days != null ? Number(row.cold_tier_days) : undefined,
      archiveAfterDays: row.archive_after_days != null ? Number(row.archive_after_days) : undefined,
      autoPruneEnabled: row.auto_prune_enabled != null ? Boolean(row.auto_prune_enabled) : undefined,
      pruneMinImportance: row.prune_min_importance != null ? Number(row.prune_min_importance) : undefined,
      pruneMinAccessCount: row.prune_min_access_count != null ? Number(row.prune_min_access_count) : undefined,
      sessionToSessionMemoryEnabled: row.session_to_session_memory_enabled != null ? Boolean(row.session_to_session_memory_enabled) : undefined,
      conversationHistoryEnabled: row.conversation_history_enabled != null ? Boolean(row.conversation_history_enabled) : undefined,
      autoExtractEnabled: row.auto_extract_enabled != null ? Boolean(row.auto_extract_enabled) : undefined,
      userCanDeleteOwnMemory: row.user_can_delete_own_memory != null ? Boolean(row.user_can_delete_own_memory) : undefined,
      uploadedDocumentsEnabled: row.uploaded_documents_enabled != null ? Boolean(row.uploaded_documents_enabled) : undefined,
      downloadedFilesEnabled: row.downloaded_files_enabled != null ? Boolean(row.downloaded_files_enabled) : undefined,
      maxUploadSizeMb: row.max_upload_size_mb != null ? Number(row.max_upload_size_mb) : undefined,
      overriddenBy: String(row.overridden_by || ''),
      overrideReason: row.override_reason ? String(row.override_reason) : undefined,
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }
}

export const memoryRetentionPolicyService = new MemoryRetentionPolicyService();
