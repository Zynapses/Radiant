/**
 * RADIANT v4.18.0 - Log Retention Policy Service
 *
 * Resolves effective log retention per tenant based on compliance licenses.
 * Manages tier transitions (hot → warm → cold → deep archive).
 * Enforces that tenant overrides cannot go below compliance minimums.
 * Provides retention dashboard data for admin UI.
 */

import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogCategory =
  | 'audit'
  | 'security'
  | 'ai_model'
  | 'compliance'
  | 'billing'
  | 'infrastructure'
  | 'application'
  | 'collaboration'
  | 'access'
  | 'platform'
  | 'performance';

export type LogStorageTier = 'hot' | 'warm' | 'cold' | 'deep_archive';

export type LogSourceType =
  | 'lambda' | 'api_gateway' | 'cloudwatch' | 'aurora' | 'cognito'
  | 's3' | 'cloudfront' | 'waf' | 'dynamodb' | 'application' | 'custom';

export const ALL_LOG_CATEGORIES: LogCategory[] = [
  'audit', 'security', 'ai_model', 'compliance',
  'billing', 'infrastructure', 'application', 'collaboration',
  'access', 'platform', 'performance',
];

export const LOG_CATEGORY_LABELS: Record<LogCategory, string> = {
  audit: 'Audit Logs',
  security: 'Security Logs',
  ai_model: 'AI / Model Logs',
  compliance: 'Compliance Logs',
  billing: 'Billing Logs',
  infrastructure: 'Infrastructure Logs',
  application: 'Application Logs',
  collaboration: 'Collaboration Logs',
  access: 'Access Logs',
  platform: 'Platform Logs',
  performance: 'Performance Logs',
};

export interface EffectiveRetention {
  category: LogCategory;
  retentionDays: number;
  hotDays: number;
  warmDays: number;
  maxRetentionDays: number | null;
  immutable: boolean;
  tamperEvident: boolean;
  drivingCompliance: string;
  drivingRegulation: string | null;
  hasOverride: boolean;
  overrideRetentionDays: number | null;
  conflictWithGdpr: boolean;
}

export interface ComplianceRetentionRequirement {
  complianceKey: string;
  category: LogCategory;
  minRetentionDays: number;
  maxRetentionDays: number | null;
  minHotDays: number;
  minWarmDays: number;
  immutable: boolean;
  tamperEvident: boolean;
  regulationSection: string | null;
  regulationDescription: string | null;
}

export interface LogSource {
  id: string;
  sourceName: string;
  sourceType: LogSourceType;
  sourceArn: string | null;
  category: LogCategory;
  subcategory: string | null;
  cloudwatchLogGroup: string | null;
  isActive: boolean;
  loggingEnforced: boolean;
  lastSeenAt: string | null;
  lastIndexedAt: string | null;
  avgDailyBytes: number;
  avgDailyEvents: number;
  estimatedMonthlyCostUsd: number;
  registeredBy: string;
  description: string | null;
  tags: string[];
}

export interface LogIndexEntry {
  id: string;
  sourceId: string;
  tenantId: string | null;
  windowStart: string;
  windowEnd: string;
  category: LogCategory;
  storageTier: LogStorageTier;
  s3Bucket: string | null;
  s3Key: string | null;
  eventCount: number;
  byteSize: number;
  compressedSize: number | null;
  sha256Hash: string | null;
  retentionExpiresAt: string | null;
  immutable: boolean;
}

export interface RetentionDashboard {
  tenantId: string;
  activeComplianceLicenses: string[];
  effectiveRetention: EffectiveRetention[];
  storageBreakdown: {
    tier: LogStorageTier;
    totalBytes: number;
    totalEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  }[];
  sourcesSummary: {
    totalSources: number;
    activeSources: number;
    enforcedSources: number;
    unenforced: number;
    byCategory: Record<LogCategory, number>;
  };
  complianceIssues: ComplianceIssue[];
}

export interface ComplianceIssue {
  severity: 'critical' | 'warning' | 'info';
  category: LogCategory;
  issue: string;
  complianceKey: string;
  regulation: string | null;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LogRetentionPolicyService {
  constructor(private pool: Pool) {}

  // =========================================================================
  // 1. RESOLVE EFFECTIVE RETENTION
  // =========================================================================

  async resolveEffectiveRetention(tenantId: string): Promise<EffectiveRetention[]> {
    const results: EffectiveRetention[] = [];

    for (const category of ALL_LOG_CATEGORIES) {
      const retResult = await this.pool.query(
        `SELECT * FROM resolve_log_retention($1, $2::log_category)`,
        [tenantId, category]
      );

      const row = retResult.rows[0];

      // Check for tenant override
      const overrideResult = await this.pool.query(
        `SELECT retention_days FROM tenant_log_retention_overrides WHERE tenant_id = $1 AND category = $2::log_category`,
        [tenantId, category]
      );
      const hasOverride = overrideResult.rows.length > 0;
      const overrideRetentionDays = hasOverride ? overrideResult.rows[0].retention_days as number : null;

      // Detect GDPR conflict: HIPAA requires 6yr but GDPR caps at 2yr
      const conflictWithGdpr = row.max_retention_days != null && row.retention_days > row.max_retention_days;

      results.push({
        category,
        retentionDays: row.retention_days as number,
        hotDays: row.hot_days as number,
        warmDays: row.warm_days as number,
        maxRetentionDays: row.max_retention_days as number | null,
        immutable: row.immutable as boolean,
        tamperEvident: row.tamper_evident as boolean,
        drivingCompliance: row.driving_compliance as string,
        drivingRegulation: row.driving_regulation as string | null,
        hasOverride,
        overrideRetentionDays,
        conflictWithGdpr,
      });
    }

    return results;
  }

  // =========================================================================
  // 2. GET COMPLIANCE REQUIREMENTS DETAIL
  // =========================================================================

  async getComplianceRequirements(complianceKeys: string[]): Promise<ComplianceRetentionRequirement[]> {
    if (complianceKeys.length === 0) complianceKeys = ['none'];

    const result = await this.pool.query(
      `SELECT * FROM compliance_retention_requirements
       WHERE compliance_key = ANY($1)
       ORDER BY compliance_key, category`,
      [complianceKeys]
    );

    return result.rows.map(this.mapComplianceRequirement);
  }

  // =========================================================================
  // 3. SET TENANT OVERRIDE
  // =========================================================================

  async setTenantOverride(
    tenantId: string,
    category: LogCategory,
    retentionDays: number,
    hotDays: number,
    warmDays: number,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    // Resolve compliance minimum
    const effective = await this.resolveEffectiveRetention(tenantId);
    const current = effective.find(e => e.category === category);
    if (!current) return { success: false, error: 'Invalid category' };

    // Cannot go below compliance minimum
    const complianceMin = current.retentionDays;
    if (retentionDays < complianceMin) {
      return {
        success: false,
        error: `Cannot set retention below compliance minimum of ${complianceMin} days (required by ${current.drivingCompliance}${current.drivingRegulation ? ` ${current.drivingRegulation}` : ''}).`,
      };
    }

    // Cannot exceed GDPR max if applicable
    if (current.maxRetentionDays != null && retentionDays > current.maxRetentionDays) {
      return {
        success: false,
        error: `Cannot set retention above ${current.maxRetentionDays} days (GDPR data minimization requirement).`,
      };
    }

    // Get previous value for audit
    const prevResult = await this.pool.query(
      `SELECT retention_days, hot_days, warm_days FROM tenant_log_retention_overrides WHERE tenant_id = $1 AND category = $2::log_category`,
      [tenantId, category]
    );

    const previousValue = prevResult.rows.length > 0
      ? { retention_days: prevResult.rows[0].retention_days, hot_days: prevResult.rows[0].hot_days, warm_days: prevResult.rows[0].warm_days }
      : null;

    // Upsert override
    await this.pool.query(
      `INSERT INTO tenant_log_retention_overrides (tenant_id, category, retention_days, hot_days, warm_days, set_by, reason, updated_at)
       VALUES ($1, $2::log_category, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (tenant_id, category) DO UPDATE SET
         retention_days = EXCLUDED.retention_days,
         hot_days = EXCLUDED.hot_days,
         warm_days = EXCLUDED.warm_days,
         set_by = EXCLUDED.set_by,
         reason = EXCLUDED.reason,
         updated_at = NOW()`,
      [tenantId, category, retentionDays, hotDays, warmDays, userId, reason ?? null]
    );

    // Audit log
    await this.pool.query(
      `INSERT INTO log_retention_audit (tenant_id, action, category, previous_value, new_value, performed_by)
       VALUES ($1, 'override_set', $2::log_category, $3, $4, $5)`,
      [
        tenantId, category,
        previousValue ? JSON.stringify(previousValue) : null,
        JSON.stringify({ retention_days: retentionDays, hot_days: hotDays, warm_days: warmDays }),
        userId,
      ]
    );

    return { success: true };
  }

  async removeTenantOverride(tenantId: string, category: LogCategory, userId: string): Promise<void> {
    const prevResult = await this.pool.query(
      `DELETE FROM tenant_log_retention_overrides WHERE tenant_id = $1 AND category = $2::log_category RETURNING *`,
      [tenantId, category]
    );

    if (prevResult.rows.length > 0) {
      await this.pool.query(
        `INSERT INTO log_retention_audit (tenant_id, action, category, previous_value, performed_by)
         VALUES ($1, 'override_removed', $2::log_category, $3, $4)`,
        [tenantId, category, JSON.stringify(prevResult.rows[0]), userId]
      );
    }
  }

  // =========================================================================
  // 4. LOG SOURCES
  // =========================================================================

  async getLogSources(filters?: { category?: LogCategory; isActive?: boolean; sourceType?: LogSourceType }): Promise<LogSource[]> {
    let query = `SELECT * FROM log_source_registry WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;

    if (filters?.category) { query += ` AND category = $${idx}::log_category`; params.push(filters.category); idx++; }
    if (filters?.isActive !== undefined) { query += ` AND is_active = $${idx}`; params.push(filters.isActive); idx++; }
    if (filters?.sourceType) { query += ` AND source_type = $${idx}::log_source_type`; params.push(filters.sourceType); idx++; }

    query += ` ORDER BY category, source_name`;
    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapLogSource);
  }

  async getUnenforedSources(): Promise<LogSource[]> {
    const result = await this.pool.query(
      `SELECT * FROM log_source_registry WHERE is_active = true AND logging_enforced = false ORDER BY category, source_name`
    );
    return result.rows.map(this.mapLogSource);
  }

  // =========================================================================
  // 5. LOG INDEX QUERIES
  // =========================================================================

  async getLogIndexEntries(
    tenantId: string | null,
    category: LogCategory | null,
    startTime: string,
    endTime: string,
    tier?: LogStorageTier,
    limit: number = 100
  ): Promise<LogIndexEntry[]> {
    let query = `SELECT * FROM log_index WHERE window_start >= $1 AND window_end <= $2`;
    const params: unknown[] = [startTime, endTime];
    let idx = 3;

    if (tenantId) { query += ` AND tenant_id = $${idx}`; params.push(tenantId); idx++; }
    if (category) { query += ` AND category = $${idx}::log_category`; params.push(category); idx++; }
    if (tier) { query += ` AND storage_tier = $${idx}::log_storage_tier`; params.push(tier); idx++; }

    query += ` ORDER BY window_start DESC LIMIT $${idx}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapLogIndexEntry);
  }

  // =========================================================================
  // 6. STORAGE BREAKDOWN
  // =========================================================================

  async getStorageBreakdown(tenantId?: string): Promise<RetentionDashboard['storageBreakdown']> {
    const tenantClause = tenantId ? `AND (tenant_id = $1 OR tenant_id IS NULL)` : '';
    const params = tenantId ? [tenantId] : [];

    const result = await this.pool.query(
      `SELECT storage_tier,
              COUNT(*) as total_entries,
              COALESCE(SUM(byte_size), 0) as total_bytes,
              MIN(window_start) as oldest_entry,
              MAX(window_end) as newest_entry
       FROM log_index
       WHERE 1=1 ${tenantClause}
       GROUP BY storage_tier
       ORDER BY storage_tier`,
      params
    );

    return result.rows.map(r => ({
      tier: r.storage_tier as LogStorageTier,
      totalBytes: parseInt(r.total_bytes as string) || 0,
      totalEntries: parseInt(r.total_entries as string) || 0,
      oldestEntry: r.oldest_entry ? (r.oldest_entry as Date).toISOString() : null,
      newestEntry: r.newest_entry ? (r.newest_entry as Date).toISOString() : null,
    }));
  }

  // =========================================================================
  // 7. COMPLIANCE ISSUES DETECTION
  // =========================================================================

  async detectComplianceIssues(tenantId: string): Promise<ComplianceIssue[]> {
    const issues: ComplianceIssue[] = [];
    const effective = await this.resolveEffectiveRetention(tenantId);

    // Get active compliance licenses
    const licResult = await this.pool.query(
      `SELECT license_key FROM tenant_licenses WHERE tenant_id = $1 AND license_type = 'compliance' AND status = 'active'`,
      [tenantId]
    );
    const activeLicenses = licResult.rows.map((r: { license_key: string }) => r.license_key);

    for (const ret of effective) {
      // GDPR vs HIPAA conflict
      if (ret.conflictWithGdpr) {
        issues.push({
          severity: 'warning',
          category: ret.category,
          issue: `GDPR recommends max ${ret.maxRetentionDays} days but ${ret.drivingCompliance} requires ${ret.retentionDays} days`,
          complianceKey: 'gdpr',
          regulation: 'Art. 5(1)(e)',
          recommendation: 'HIPAA minimum takes precedence. Document the justification for exceeding GDPR recommended maximum. Consult your DPO.',
        });
      }

      // Check if any log sources for this category are not logging
      const unenforced = await this.pool.query(
        `SELECT COUNT(*) as cnt FROM log_source_registry WHERE category = $1::log_category AND is_active = true AND logging_enforced = false`,
        [ret.category]
      );
      const unenforcedCount = parseInt(unenforced.rows[0].cnt as string) || 0;
      if (unenforcedCount > 0 && activeLicenses.length > 0) {
        issues.push({
          severity: 'critical',
          category: ret.category,
          issue: `${unenforcedCount} active log source(s) do not have logging enforced`,
          complianceKey: ret.drivingCompliance,
          regulation: ret.drivingRegulation,
          recommendation: `Enable logging enforcement for all ${ret.category} sources. Required by ${ret.drivingCompliance}.`,
        });
      }

      // Check for immutable categories that have non-immutable index entries
      if (ret.immutable) {
        const mutableEntries = await this.pool.query(
          `SELECT COUNT(*) as cnt FROM log_index WHERE category = $1::log_category AND immutable = false AND (tenant_id = $2 OR tenant_id IS NULL)`,
          [ret.category, tenantId]
        );
        const mutableCount = parseInt(mutableEntries.rows[0].cnt as string) || 0;
        if (mutableCount > 0) {
          issues.push({
            severity: 'warning',
            category: ret.category,
            issue: `${mutableCount} log archive(s) are not marked immutable but compliance requires immutability`,
            complianceKey: ret.drivingCompliance,
            regulation: ret.drivingRegulation,
            recommendation: 'Run the log indexer to re-process and apply immutability flags to existing archives.',
          });
        }
      }
    }

    return issues;
  }

  // =========================================================================
  // 8. FULL DASHBOARD
  // =========================================================================

  async getDashboard(tenantId: string): Promise<RetentionDashboard> {
    // Active compliance licenses
    const licResult = await this.pool.query(
      `SELECT license_key FROM tenant_licenses WHERE tenant_id = $1 AND license_type = 'compliance' AND status = 'active'`,
      [tenantId]
    );
    const activeComplianceLicenses = licResult.rows.map((r: { license_key: string }) => r.license_key);

    // Parallel fetch
    const [effectiveRetention, storageBreakdown, complianceIssues, sources] = await Promise.all([
      this.resolveEffectiveRetention(tenantId),
      this.getStorageBreakdown(tenantId),
      this.detectComplianceIssues(tenantId),
      this.getLogSources({ isActive: true }),
    ]);

    // Sources summary
    const enforcedSources = sources.filter(s => s.loggingEnforced).length;
    const byCategory = {} as Record<LogCategory, number>;
    for (const cat of ALL_LOG_CATEGORIES) byCategory[cat] = 0;
    for (const s of sources) byCategory[s.category] = (byCategory[s.category] || 0) + 1;

    return {
      tenantId,
      activeComplianceLicenses,
      effectiveRetention,
      storageBreakdown,
      sourcesSummary: {
        totalSources: sources.length,
        activeSources: sources.length,
        enforcedSources,
        unenforced: sources.length - enforcedSources,
        byCategory,
      },
      complianceIssues,
    };
  }

  // =========================================================================
  // Mappers
  // =========================================================================

  private mapComplianceRequirement(row: Record<string, unknown>): ComplianceRetentionRequirement {
    return {
      complianceKey: row.compliance_key as string,
      category: row.category as LogCategory,
      minRetentionDays: row.min_retention_days as number,
      maxRetentionDays: row.max_retention_days as number | null,
      minHotDays: row.min_hot_days as number,
      minWarmDays: row.min_warm_days as number,
      immutable: row.immutable as boolean,
      tamperEvident: row.tamper_evident as boolean,
      regulationSection: row.regulation_section as string | null,
      regulationDescription: row.regulation_description as string | null,
    };
  }

  private mapLogSource(row: Record<string, unknown>): LogSource {
    return {
      id: row.id as string,
      sourceName: row.source_name as string,
      sourceType: row.source_type as LogSourceType,
      sourceArn: row.source_arn as string | null,
      category: row.category as LogCategory,
      subcategory: row.subcategory as string | null,
      cloudwatchLogGroup: row.cloudwatch_log_group as string | null,
      isActive: row.is_active as boolean,
      loggingEnforced: row.logging_enforced as boolean,
      lastSeenAt: row.last_seen_at ? (row.last_seen_at as Date).toISOString() : null,
      lastIndexedAt: row.last_indexed_at ? (row.last_indexed_at as Date).toISOString() : null,
      avgDailyBytes: parseInt(row.avg_daily_bytes as string) || 0,
      avgDailyEvents: parseInt(row.avg_daily_events as string) || 0,
      estimatedMonthlyCostUsd: parseFloat(row.estimated_monthly_cost_usd as string) || 0,
      registeredBy: row.registered_by as string,
      description: row.description as string | null,
      tags: (row.tags as string[]) || [],
    };
  }

  private mapLogIndexEntry(row: Record<string, unknown>): LogIndexEntry {
    return {
      id: row.id as string,
      sourceId: row.source_id as string,
      tenantId: row.tenant_id as string | null,
      windowStart: (row.window_start as Date).toISOString(),
      windowEnd: (row.window_end as Date).toISOString(),
      category: row.category as LogCategory,
      storageTier: row.storage_tier as LogStorageTier,
      s3Bucket: row.s3_bucket as string | null,
      s3Key: row.s3_key as string | null,
      eventCount: row.event_count as number,
      byteSize: parseInt(row.byte_size as string) || 0,
      compressedSize: row.compressed_size ? parseInt(row.compressed_size as string) : null,
      sha256Hash: row.sha256_hash as string | null,
      retentionExpiresAt: row.retention_expires_at ? (row.retention_expires_at as Date).toISOString() : null,
      immutable: row.immutable as boolean,
    };
  }
}
