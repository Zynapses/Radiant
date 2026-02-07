/**
 * RADIANT v4.18.0 - Log Report Service
 *
 * Generates retention/compliance reports on-demand or on schedule.
 * Reports are persisted to PostgreSQL + S3, visible in admin dashboard list.
 *
 * Report types:
 *   - compliance_summary   — retention posture vs active compliance licenses
 *   - retention_audit      — what's stored, where, expiry dates, overrides
 *   - storage_forecast     — cost/capacity projections based on growth rates
 *   - source_coverage      — which services are logging, which are not
 *   - gdpr_data_map        — data inventory for GDPR Article 30
 *   - custom               — ad-hoc query with filters
 */

import { Pool } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { LogRetentionPolicyService, LogCategory, ALL_LOG_CATEGORIES } from './log-retention-policy.service';

const REGION = process.env.AWS_REGION || 'us-east-1';
const REPORT_BUCKET = process.env.LOG_REPORT_BUCKET || 'radiant-log-reports';
const s3Client = new S3Client({ region: REGION });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportType = 'compliance_summary' | 'retention_audit' | 'storage_forecast' | 'source_coverage' | 'gdpr_data_map' | 'custom';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'archived';

export interface LogReport {
  id: string;
  tenantId: string;
  reportType: ReportType;
  title: string;
  description: string | null;
  parameters: Record<string, unknown>;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  categories: LogCategory[];
  complianceKeys: string[];
  status: ReportStatus;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  summary: Record<string, unknown> | null;
  findings: unknown[];
  recommendations: unknown[];
  s3Bucket: string | null;
  s3Key: string | null;
  fileSizeBytes: number | null;
  pageCount: number | null;
  isScheduled: boolean;
  scheduleCron: string | null;
  nextScheduledAt: string | null;
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateReportRequest {
  tenantId: string;
  reportType: ReportType;
  title?: string;
  description?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  categories?: LogCategory[];
  complianceKeys?: string[];
  parameters?: Record<string, unknown>;
  generatedBy: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LogReportService {
  private retentionService: LogRetentionPolicyService;

  constructor(private pool: Pool) {
    this.retentionService = new LogRetentionPolicyService(pool);
  }

  // =========================================================================
  // LIST REPORTS
  // =========================================================================

  async listReports(tenantId: string, filters?: {
    reportType?: ReportType;
    status?: ReportStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ reports: LogReport[]; total: number }> {
    let countQuery = `SELECT COUNT(*) FROM log_reports WHERE tenant_id = $1`;
    let query = `SELECT * FROM log_reports WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (filters?.reportType) {
      const clause = ` AND report_type = $${idx}::log_report_type`;
      countQuery += clause;
      query += clause;
      params.push(filters.reportType);
      idx++;
    }
    if (filters?.status) {
      const clause = ` AND status = $${idx}::log_report_status`;
      countQuery += clause;
      query += clause;
      params.push(filters.status);
      idx++;
    }

    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count as string);

    query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(filters?.limit || 50, filters?.offset || 0);

    const result = await this.pool.query(query, params);
    return { reports: result.rows.map(this.mapReport), total };
  }

  // =========================================================================
  // GET SINGLE REPORT
  // =========================================================================

  async getReport(reportId: string): Promise<LogReport | null> {
    const result = await this.pool.query(`SELECT * FROM log_reports WHERE id = $1`, [reportId]);
    if (result.rows.length === 0) return null;
    return this.mapReport(result.rows[0]);
  }

  // =========================================================================
  // GET REPORT DOWNLOAD URL
  // =========================================================================

  async getReportDownloadUrl(reportId: string): Promise<string | null> {
    const report = await this.getReport(reportId);
    if (!report || !report.s3Bucket || !report.s3Key) return null;

    const url = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: report.s3Bucket,
      Key: report.s3Key,
    }), { expiresIn: 3600 });

    return url;
  }

  // =========================================================================
  // GENERATE REPORT
  // =========================================================================

  async generateReport(request: GenerateReportRequest): Promise<LogReport> {
    const title = request.title || this.getDefaultTitle(request.reportType);

    // Create report record
    const insertResult = await this.pool.query(
      `INSERT INTO log_reports (tenant_id, report_type, title, description, parameters,
        date_range_start, date_range_end, categories, compliance_keys, status, generated_by)
       VALUES ($1, $2::log_report_type, $3, $4, $5, $6, $7, $8, $9, 'generating', $10)
       RETURNING *`,
      [
        request.tenantId, request.reportType, title, request.description || null,
        JSON.stringify(request.parameters || {}),
        request.dateRangeStart || null, request.dateRangeEnd || null,
        request.categories || [], request.complianceKeys || [],
        request.generatedBy,
      ]
    );
    const reportId = insertResult.rows[0].id as string;

    try {
      const startTime = Date.now();

      await this.pool.query(
        `UPDATE log_reports SET status = 'generating', started_at = NOW() WHERE id = $1`,
        [reportId]
      );

      // Generate report content based on type
      let summary: Record<string, unknown> = {};
      let findings: unknown[] = [];
      let recommendations: unknown[] = [];

      switch (request.reportType) {
        case 'compliance_summary':
          ({ summary, findings, recommendations } = await this.generateComplianceSummary(request));
          break;
        case 'retention_audit':
          ({ summary, findings, recommendations } = await this.generateRetentionAudit(request));
          break;
        case 'storage_forecast':
          ({ summary, findings, recommendations } = await this.generateStorageForecast(request));
          break;
        case 'source_coverage':
          ({ summary, findings, recommendations } = await this.generateSourceCoverage(request));
          break;
        case 'gdpr_data_map':
          ({ summary, findings, recommendations } = await this.generateGdprDataMap(request));
          break;
        case 'custom':
          ({ summary, findings, recommendations } = await this.generateCustomReport(request));
          break;
      }

      // Serialize and upload to S3
      const reportData = JSON.stringify({ summary, findings, recommendations, metadata: {
        reportId, tenantId: request.tenantId, reportType: request.reportType,
        generatedAt: new Date().toISOString(), generatedBy: request.generatedBy,
      }}, null, 2);

      const reportBytes = Buffer.from(reportData, 'utf-8');
      const dateStr = new Date().toISOString().split('T')[0];
      const s3Key = `reports/${request.tenantId}/${request.reportType}/${dateStr}/${reportId}.json`;

      await s3Client.send(new PutObjectCommand({
        Bucket: REPORT_BUCKET,
        Key: s3Key,
        Body: reportBytes,
        ContentType: 'application/json',
        ServerSideEncryption: 'aws:kms',
        Metadata: {
          'report-id': reportId,
          'tenant-id': request.tenantId,
          'report-type': request.reportType,
        },
      }));

      const durationMs = Date.now() - startTime;

      await this.pool.query(
        `UPDATE log_reports SET
          status = 'completed', completed_at = NOW(), duration_ms = $1,
          summary = $2, findings = $3, recommendations = $4,
          s3_bucket = $5, s3_key = $6, file_size_bytes = $7
         WHERE id = $8`,
        [durationMs, JSON.stringify(summary), JSON.stringify(findings),
         JSON.stringify(recommendations), REPORT_BUCKET, s3Key, reportBytes.length, reportId]
      );

      return (await this.getReport(reportId))!;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.pool.query(
        `UPDATE log_reports SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
        [msg, reportId]
      );
      throw error;
    }
  }

  // =========================================================================
  // REPORT GENERATORS
  // =========================================================================

  private async generateComplianceSummary(request: GenerateReportRequest) {
    const retention = await this.retentionService.resolveEffectiveRetention(request.tenantId);
    const issues = await this.retentionService.detectComplianceIssues(request.tenantId);
    const storage = await this.retentionService.getStorageBreakdown(request.tenantId);

    const licResult = await this.pool.query(
      `SELECT license_key, license_type, status, created_at FROM tenant_licenses
       WHERE tenant_id = $1 AND license_type = 'compliance' AND status = 'active'`,
      [request.tenantId]
    );

    const summary = {
      tenantId: request.tenantId,
      generatedAt: new Date().toISOString(),
      activeLicenses: licResult.rows.map((r: Record<string, unknown>) => r.license_key),
      totalCategories: retention.length,
      immutableCategories: retention.filter(r => r.immutable).length,
      tamperEvidentCategories: retention.filter(r => r.tamperEvident).length,
      maxRetentionDays: Math.max(...retention.map(r => r.retentionDays)),
      gdprConflicts: retention.filter(r => r.conflictWithGdpr).length,
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      totalStorageBytes: storage.reduce((s, b) => s + b.totalBytes, 0),
    };

    const findings = [
      ...retention.map(r => ({
        type: 'retention_policy',
        category: r.category,
        retentionDays: r.retentionDays,
        immutable: r.immutable,
        drivingCompliance: r.drivingCompliance,
        conflictWithGdpr: r.conflictWithGdpr,
      })),
      ...issues.map(i => ({
        type: 'compliance_issue',
        severity: i.severity,
        category: i.category,
        issue: i.issue,
        complianceKey: i.complianceKey,
      })),
    ];

    const recommendations = issues.map(i => ({
      priority: i.severity,
      category: i.category,
      recommendation: i.recommendation,
    }));

    return { summary, findings, recommendations };
  }

  private async generateRetentionAudit(request: GenerateReportRequest) {
    const retention = await this.retentionService.resolveEffectiveRetention(request.tenantId);
    const storage = await this.retentionService.getStorageBreakdown(request.tenantId);

    // Get overrides
    const overrides = await this.pool.query(
      `SELECT * FROM tenant_log_retention_overrides WHERE tenant_id = $1`,
      [request.tenantId]
    );

    // Get audit trail
    const auditTrail = await this.pool.query(
      `SELECT * FROM log_retention_audit WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [request.tenantId]
    );

    // Expiring entries
    const expiringEntries = await this.pool.query(
      `SELECT category, COUNT(*) as count, SUM(byte_size) as bytes
       FROM log_index
       WHERE retention_expires_at < NOW() + INTERVAL '30 days'
       AND (tenant_id = $1 OR tenant_id IS NULL)
       GROUP BY category`,
      [request.tenantId]
    );

    const summary = {
      tenantId: request.tenantId,
      generatedAt: new Date().toISOString(),
      retentionPolicies: retention.length,
      overrides: overrides.rows.length,
      auditEvents: auditTrail.rows.length,
      expiringSoon: expiringEntries.rows.reduce((s: number, r: Record<string, unknown>) => s + parseInt(r.count as string), 0),
      storageByTier: storage,
    };

    const findings = [
      ...retention.map(r => ({ type: 'policy', ...r })),
      ...overrides.rows.map((r: Record<string, unknown>) => ({ type: 'override', category: r.category, retentionDays: r.retention_days, setBy: r.set_by, reason: r.reason })),
      ...expiringEntries.rows.map((r: Record<string, unknown>) => ({ type: 'expiring', category: r.category, count: parseInt(r.count as string), bytes: parseInt(r.bytes as string) })),
    ];

    return { summary, findings, recommendations: [] };
  }

  private async generateStorageForecast(request: GenerateReportRequest) {
    // Get daily ingestion rates
    const dailyRates = await this.pool.query(
      `SELECT category, AVG(avg_daily_bytes) as avg_bytes, AVG(avg_daily_events) as avg_events
       FROM log_source_registry WHERE is_active = true GROUP BY category`
    );

    const storage = await this.retentionService.getStorageBreakdown(request.tenantId);
    const currentTotal = storage.reduce((s, b) => s + b.totalBytes, 0);

    // Project 30, 90, 365 day growth
    const dailyIngestion = dailyRates.rows.reduce((s: number, r: Record<string, unknown>) => s + (parseFloat(r.avg_bytes as string) || 0), 0);

    const summary = {
      currentStorageBytes: currentTotal,
      dailyIngestionBytes: dailyIngestion,
      projected30dBytes: currentTotal + dailyIngestion * 30,
      projected90dBytes: currentTotal + dailyIngestion * 90,
      projected365dBytes: currentTotal + dailyIngestion * 365,
      estimatedMonthlyCostUsd: this.estimateStorageCost(currentTotal + dailyIngestion * 30),
      estimatedYearlyCostUsd: this.estimateStorageCost(currentTotal + dailyIngestion * 365) * 12,
    };

    const findings = dailyRates.rows.map((r: Record<string, unknown>) => ({
      type: 'ingestion_rate',
      category: r.category,
      avgDailyBytes: parseFloat(r.avg_bytes as string) || 0,
      avgDailyEvents: parseFloat(r.avg_events as string) || 0,
    }));

    const recommendations = [];
    if (dailyIngestion > 1024 * 1024 * 1024) {
      recommendations.push({ priority: 'warning', recommendation: 'Daily ingestion exceeds 1 GB. Consider adjusting log verbosity for non-critical categories.' });
    }

    return { summary, findings, recommendations };
  }

  private async generateSourceCoverage(request: GenerateReportRequest) {
    const sources = await this.pool.query(`SELECT * FROM log_source_registry WHERE is_active = true ORDER BY category`);
    const staleThreshold = new Date(Date.now() - 7 * 86400000);

    const byCategory: Record<string, { total: number; enforced: number; stale: number }> = {};
    for (const cat of ALL_LOG_CATEGORIES) byCategory[cat] = { total: 0, enforced: 0, stale: 0 };

    for (const s of sources.rows) {
      const cat = s.category as string;
      if (!byCategory[cat]) byCategory[cat] = { total: 0, enforced: 0, stale: 0 };
      byCategory[cat].total++;
      if (s.logging_enforced) byCategory[cat].enforced++;
      if (!s.last_seen_at || new Date(s.last_seen_at as string) < staleThreshold) byCategory[cat].stale++;
    }

    const summary = {
      totalSources: sources.rows.length,
      enforced: sources.rows.filter((s: Record<string, unknown>) => s.logging_enforced).length,
      unenforced: sources.rows.filter((s: Record<string, unknown>) => !s.logging_enforced).length,
      stale: sources.rows.filter((s: Record<string, unknown>) => !s.last_seen_at || new Date(s.last_seen_at as string) < staleThreshold).length,
      byCategory,
    };

    const findings = sources.rows.filter((s: Record<string, unknown>) => !s.logging_enforced).map((s: Record<string, unknown>) => ({
      type: 'unenforced_source', name: s.source_name, category: s.category, lastSeen: s.last_seen_at,
    }));

    const recommendations = [];
    if (summary.unenforced > 0) {
      recommendations.push({ priority: 'critical', recommendation: `${summary.unenforced} active sources do not have logging enforced. Wrap them with withEnforcedLogging().` });
    }
    if (summary.stale > 0) {
      recommendations.push({ priority: 'warning', recommendation: `${summary.stale} sources have not reported in 7+ days. Investigate if they are still active.` });
    }

    return { summary, findings, recommendations };
  }

  private async generateGdprDataMap(request: GenerateReportRequest) {
    // GDPR Article 30 data inventory
    const sources = await this.pool.query(`SELECT * FROM log_source_registry WHERE is_active = true`);
    const retention = await this.retentionService.resolveEffectiveRetention(request.tenantId);
    const storage = await this.retentionService.getStorageBreakdown(request.tenantId);

    const summary = {
      generatedAt: new Date().toISOString(),
      tenantId: request.tenantId,
      purpose: 'GDPR Article 30 — Record of Processing Activities (Log Data)',
      totalDataSources: sources.rows.length,
      dataCategories: ALL_LOG_CATEGORIES.length,
      storageLocations: ['Aurora PostgreSQL', 'S3 Standard', 'S3 Glacier', 'S3 Glacier Deep Archive'],
      retentionPolicies: retention.map(r => ({
        category: r.category,
        retentionDays: r.retentionDays,
        maxRetentionDays: r.maxRetentionDays,
        immutable: r.immutable,
        legalBasis: r.drivingCompliance === 'gdpr' ? 'Legitimate interest / Legal obligation' : r.drivingCompliance,
      })),
      totalDataVolume: storage.reduce((s, b) => s + b.totalBytes, 0),
    };

    const findings = ALL_LOG_CATEGORIES.map(cat => {
      const catRetention = retention.find(r => r.category === cat);
      const catSources = sources.rows.filter((s: Record<string, unknown>) => s.category === cat);
      return {
        type: 'data_category',
        category: cat,
        description: this.getCategoryDescription(cat),
        containsPersonalData: ['audit', 'security', 'compliance', 'collaboration'].includes(cat),
        sourcesCount: catSources.length,
        retentionDays: catRetention?.retentionDays || 90,
        legalBasis: this.getGdprLegalBasis(cat),
        erasable: !catRetention?.immutable,
      };
    });

    return { summary, findings, recommendations: [] };
  }

  private async generateCustomReport(request: GenerateReportRequest) {
    const categories = request.categories || ALL_LOG_CATEGORIES;
    const entries = await this.pool.query(
      `SELECT category, storage_tier, COUNT(*) as count, SUM(byte_size) as bytes, MIN(window_start) as earliest, MAX(window_end) as latest
       FROM log_index
       WHERE ($1::TIMESTAMPTZ IS NULL OR window_start >= $1)
         AND ($2::TIMESTAMPTZ IS NULL OR window_end <= $2)
         AND category = ANY($3::log_category[])
         AND (tenant_id = $4 OR tenant_id IS NULL)
       GROUP BY category, storage_tier`,
      [request.dateRangeStart || null, request.dateRangeEnd || null, categories, request.tenantId]
    );

    const summary = {
      dateRange: { start: request.dateRangeStart, end: request.dateRangeEnd },
      categories,
      totalEntries: entries.rows.reduce((s: number, r: Record<string, unknown>) => s + parseInt(r.count as string), 0),
      totalBytes: entries.rows.reduce((s: number, r: Record<string, unknown>) => s + parseInt(r.bytes as string || '0'), 0),
    };

    return { summary, findings: entries.rows, recommendations: [] };
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private estimateStorageCost(bytes: number): number {
    const gb = bytes / (1024 * 1024 * 1024);
    // Rough estimate: S3 $0.023/GB, Glacier $0.004/GB, weighted average
    return gb * 0.01;
  }

  private getDefaultTitle(type: ReportType): string {
    const titles: Record<ReportType, string> = {
      compliance_summary: 'Compliance Retention Summary',
      retention_audit: 'Retention Audit Report',
      storage_forecast: 'Storage Forecast Report',
      source_coverage: 'Logging Coverage Report',
      gdpr_data_map: 'GDPR Article 30 Data Map',
      custom: 'Custom Log Report',
    };
    return `${titles[type]} — ${new Date().toISOString().split('T')[0]}`;
  }

  private getCategoryDescription(cat: LogCategory): string {
    const desc: Record<LogCategory, string> = {
      audit: 'Records of user actions, administrative changes, and data access events',
      security: 'Authentication events, MFA challenges, failed logins, permission denials',
      ai_model: 'AI prompt execution logs, token usage, model selection and routing decisions',
      compliance: 'PHI access logs, data export events, erasure requests, consent records',
      billing: 'Usage metering events, cost attribution, subscription changes',
      infrastructure: 'Lambda execution metrics, CDK deployments, health check results',
      application: 'API request/response logs, application errors, warnings, cold start metrics',
      collaboration: 'Guest session events, invitation tracking, restriction enforcement logs',
    };
    return desc[cat];
  }

  private getGdprLegalBasis(cat: LogCategory): string {
    const basis: Record<LogCategory, string> = {
      audit: 'Legitimate interest (security monitoring)',
      security: 'Legal obligation (security incident response)',
      ai_model: 'Legitimate interest (service operation)',
      compliance: 'Legal obligation (regulatory compliance)',
      billing: 'Contract performance (billing accuracy)',
      infrastructure: 'Legitimate interest (service reliability)',
      application: 'Legitimate interest (service operation)',
      collaboration: 'Consent (collaboration participation)',
    };
    return basis[cat];
  }

  private mapReport(row: Record<string, unknown>): LogReport {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      reportType: row.report_type as ReportType,
      title: row.title as string,
      description: row.description as string | null,
      parameters: (row.parameters as Record<string, unknown>) || {},
      dateRangeStart: row.date_range_start ? (row.date_range_start as Date).toISOString() : null,
      dateRangeEnd: row.date_range_end ? (row.date_range_end as Date).toISOString() : null,
      categories: (row.categories as LogCategory[]) || [],
      complianceKeys: (row.compliance_keys as string[]) || [],
      status: row.status as ReportStatus,
      startedAt: row.started_at ? (row.started_at as Date).toISOString() : null,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
      errorMessage: row.error_message as string | null,
      durationMs: row.duration_ms as number | null,
      summary: row.summary as Record<string, unknown> | null,
      findings: (row.findings as unknown[]) || [],
      recommendations: (row.recommendations as unknown[]) || [],
      s3Bucket: row.s3_bucket as string | null,
      s3Key: row.s3_key as string | null,
      fileSizeBytes: row.file_size_bytes ? parseInt(row.file_size_bytes as string) : null,
      pageCount: row.page_count as number | null,
      isScheduled: row.is_scheduled as boolean,
      scheduleCron: row.schedule_cron as string | null,
      nextScheduledAt: row.next_scheduled_at ? (row.next_scheduled_at as Date).toISOString() : null,
      generatedBy: row.generated_by as string,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}
