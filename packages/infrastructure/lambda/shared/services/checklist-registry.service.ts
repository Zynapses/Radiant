/**
 * RADIANT v4.18.0 - Compliance Checklist Registry Service
 * 
 * Manages versioned compliance checklists linked to regulatory standards.
 * Supports auto-update from external sources and per-tenant version selection.
 */

import { Pool } from 'pg';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ChecklistVersion {
  id: string;
  standardId: string;
  standardCode: string;
  standardName: string;
  version: string;
  versionDate: string;
  title: string;
  description?: string;
  sourceUrl?: string;
  sourceDocument?: string;
  isLatest: boolean;
  isActive: boolean;
  changeSummary?: string;
  effectiveDate?: string;
  supersedesVersionId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistCategory {
  id: string;
  versionId: string;
  code: string;
  name: string;
  description?: string;
  displayOrder: number;
  icon?: string;
  itemCount?: number;
  completedCount?: number;
}

export interface ChecklistItem {
  id: string;
  versionId: string;
  categoryId?: string;
  categoryCode?: string;
  categoryName?: string;
  requirementId?: string;
  itemCode: string;
  title: string;
  description?: string;
  guidance?: string;
  evidenceTypes: string[];
  apiEndpoint?: string;
  automatedCheckCode?: string;
  isRequired: boolean;
  isAutomatable: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedMinutes?: number;
  displayOrder: number;
  tags: string[];
  status?: string;
  completedAt?: string;
  completedBy?: string;
}

export interface TenantChecklistConfig {
  id: string;
  tenantId: string;
  standardId: string;
  standardCode: string;
  versionSelection: 'auto' | 'specific' | 'pinned';
  selectedVersionId?: string;
  selectedVersion?: string;
  autoUpdateEnabled: boolean;
  notificationOnUpdate: boolean;
  lastVersionCheckAt?: string;
  effectiveVersionId?: string;
  effectiveVersion?: string;
}

export interface ChecklistProgress {
  tenantId: string;
  versionId: string;
  standardCode: string;
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  notApplicableItems: number;
  blockedItems: number;
  completionPercentage: number;
  estimatedRemainingMinutes: number;
}

export interface ChecklistAuditRun {
  id: string;
  tenantId: string;
  versionId: string;
  runType: 'manual' | 'scheduled' | 'pre_audit' | 'certification';
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'cancelled' | 'failed';
  totalItems: number;
  completedItems: number;
  passedItems: number;
  failedItems: number;
  skippedItems: number;
  score?: number;
  triggeredBy?: string;
  notes?: string;
  reportUrl?: string;
}

export interface RegulatoryVersionUpdate {
  id: string;
  standardId: string;
  standardCode: string;
  source: string;
  sourceUrl?: string;
  oldVersion?: string;
  newVersion: string;
  changeType: 'major' | 'minor' | 'patch' | 'errata' | 'guidance';
  changeSummary?: string;
  effectiveDate?: string;
  detectedAt: string;
  processedAt?: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'ignored';
  processingNotes?: string;
  checklistVersionCreatedId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ChecklistRegistryService {
  constructor(private pool: Pool) {}

  // --------------------------------------------------------------------------
  // CHECKLIST VERSIONS
  // --------------------------------------------------------------------------

  async getVersionsForStandard(standardId: string): Promise<ChecklistVersion[]> {
    const result = await this.pool.query(`
      SELECT 
        cv.*,
        rs.code as standard_code,
        rs.name as standard_name
      FROM compliance_checklist_versions cv
      JOIN regulatory_standards rs ON cv.standard_id = rs.id
      WHERE cv.standard_id = $1
      ORDER BY cv.version_date DESC
    `, [standardId]);

    return result.rows.map(this.mapChecklistVersion);
  }

  async getLatestVersion(standardCode: string): Promise<ChecklistVersion | null> {
    const result = await this.pool.query(`
      SELECT 
        cv.*,
        rs.code as standard_code,
        rs.name as standard_name
      FROM compliance_checklist_versions cv
      JOIN regulatory_standards rs ON cv.standard_id = rs.id
      WHERE rs.code = $1 AND cv.is_latest = true AND cv.is_active = true
      LIMIT 1
    `, [standardCode]);

    return result.rows[0] ? this.mapChecklistVersion(result.rows[0]) : null;
  }

  async getVersionById(versionId: string): Promise<ChecklistVersion | null> {
    const result = await this.pool.query(`
      SELECT 
        cv.*,
        rs.code as standard_code,
        rs.name as standard_name
      FROM compliance_checklist_versions cv
      JOIN regulatory_standards rs ON cv.standard_id = rs.id
      WHERE cv.id = $1
    `, [versionId]);

    return result.rows[0] ? this.mapChecklistVersion(result.rows[0]) : null;
  }

  async createVersion(data: {
    standardId: string;
    version: string;
    versionDate: string;
    title: string;
    description?: string;
    sourceUrl?: string;
    sourceDocument?: string;
    changeSummary?: string;
    effectiveDate?: string;
    supersedesVersionId?: string;
    createdBy?: string;
    setAsLatest?: boolean;
  }): Promise<ChecklistVersion> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO compliance_checklist_versions (
          standard_id, version, version_date, title, description,
          source_url, source_document, change_summary, effective_date,
          supersedes_version_id, created_by, is_latest, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
        RETURNING *
      `, [
        data.standardId,
        data.version,
        data.versionDate,
        data.title,
        data.description,
        data.sourceUrl,
        data.sourceDocument,
        data.changeSummary,
        data.effectiveDate,
        data.supersedesVersionId,
        data.createdBy,
        data.setAsLatest ?? false
      ]);

      if (data.setAsLatest) {
        await client.query(`SELECT set_latest_checklist_version($1)`, [result.rows[0].id]);
      }

      await client.query('COMMIT');

      return this.mapChecklistVersion(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async setLatestVersion(versionId: string): Promise<void> {
    await this.pool.query(`SELECT set_latest_checklist_version($1)`, [versionId]);
  }

  // --------------------------------------------------------------------------
  // CHECKLIST CATEGORIES
  // --------------------------------------------------------------------------

  async getCategoriesForVersion(versionId: string): Promise<ChecklistCategory[]> {
    const result = await this.pool.query(`
      SELECT 
        c.*,
        COUNT(i.id) as item_count,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_count
      FROM compliance_checklist_categories c
      LEFT JOIN compliance_checklist_items i ON i.category_id = c.id
      LEFT JOIN tenant_checklist_progress p ON p.item_id = i.id
      WHERE c.version_id = $1
      GROUP BY c.id
      ORDER BY c.display_order
    `, [versionId]);

    return result.rows.map(this.mapChecklistCategory);
  }

  async createCategory(data: {
    versionId: string;
    code: string;
    name: string;
    description?: string;
    displayOrder?: number;
    icon?: string;
  }): Promise<ChecklistCategory> {
    const result = await this.pool.query(`
      INSERT INTO compliance_checklist_categories (
        version_id, code, name, description, display_order, icon
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      data.versionId,
      data.code,
      data.name,
      data.description,
      data.displayOrder ?? 0,
      data.icon
    ]);

    return this.mapChecklistCategory(result.rows[0]);
  }

  // --------------------------------------------------------------------------
  // CHECKLIST ITEMS
  // --------------------------------------------------------------------------

  async getItemsForVersion(versionId: string, tenantId?: string): Promise<ChecklistItem[]> {
    const result = await this.pool.query(`
      SELECT 
        i.*,
        c.code as category_code,
        c.name as category_name,
        p.status,
        p.completed_at,
        p.completed_by
      FROM compliance_checklist_items i
      LEFT JOIN compliance_checklist_categories c ON i.category_id = c.id
      LEFT JOIN tenant_checklist_progress p ON p.item_id = i.id ${tenantId ? 'AND p.tenant_id = $2' : ''}
      WHERE i.version_id = $1
      ORDER BY c.display_order, i.display_order
    `, tenantId ? [versionId, tenantId] : [versionId]);

    return result.rows.map(this.mapChecklistItem);
  }

  async getItemsByCategory(versionId: string, categoryCode: string, tenantId?: string): Promise<ChecklistItem[]> {
    const result = await this.pool.query(`
      SELECT 
        i.*,
        c.code as category_code,
        c.name as category_name,
        p.status,
        p.completed_at,
        p.completed_by
      FROM compliance_checklist_items i
      JOIN compliance_checklist_categories c ON i.category_id = c.id
      LEFT JOIN tenant_checklist_progress p ON p.item_id = i.id ${tenantId ? 'AND p.tenant_id = $3' : ''}
      WHERE i.version_id = $1 AND c.code = $2
      ORDER BY i.display_order
    `, tenantId ? [versionId, categoryCode, tenantId] : [versionId, categoryCode]);

    return result.rows.map(this.mapChecklistItem);
  }

  async createItem(data: {
    versionId: string;
    categoryId?: string;
    requirementId?: string;
    itemCode: string;
    title: string;
    description?: string;
    guidance?: string;
    evidenceTypes?: string[];
    apiEndpoint?: string;
    automatedCheckCode?: string;
    isRequired?: boolean;
    isAutomatable?: boolean;
    priority?: 'critical' | 'high' | 'medium' | 'low';
    estimatedMinutes?: number;
    displayOrder?: number;
    tags?: string[];
  }): Promise<ChecklistItem> {
    const result = await this.pool.query(`
      INSERT INTO compliance_checklist_items (
        version_id, category_id, requirement_id, item_code, title,
        description, guidance, evidence_types, api_endpoint, automated_check_code,
        is_required, is_automatable, priority, estimated_minutes, display_order, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      data.versionId,
      data.categoryId,
      data.requirementId,
      data.itemCode,
      data.title,
      data.description,
      data.guidance,
      data.evidenceTypes ?? [],
      data.apiEndpoint,
      data.automatedCheckCode,
      data.isRequired ?? true,
      data.isAutomatable ?? false,
      data.priority ?? 'medium',
      data.estimatedMinutes,
      data.displayOrder ?? 0,
      data.tags ?? []
    ]);

    return this.mapChecklistItem(result.rows[0]);
  }

  // --------------------------------------------------------------------------
  // TENANT CONFIGURATION
  // --------------------------------------------------------------------------

  async getTenantConfig(tenantId: string, standardId: string): Promise<TenantChecklistConfig | null> {
    const result = await this.pool.query(`
      SELECT 
        tcc.*,
        rs.code as standard_code,
        cv.version as selected_version,
        ecv.id as effective_version_id,
        ecv.version as effective_version
      FROM tenant_checklist_config tcc
      JOIN regulatory_standards rs ON tcc.standard_id = rs.id
      LEFT JOIN compliance_checklist_versions cv ON tcc.selected_version_id = cv.id
      LEFT JOIN compliance_checklist_versions ecv ON ecv.id = get_effective_checklist_version($1, $2)
      WHERE tcc.tenant_id = $1 AND tcc.standard_id = $2
    `, [tenantId, standardId]);

    return result.rows[0] ? this.mapTenantConfig(result.rows[0]) : null;
  }

  async getAllTenantConfigs(tenantId: string): Promise<TenantChecklistConfig[]> {
    const result = await this.pool.query(`
      SELECT 
        tcc.*,
        rs.code as standard_code,
        cv.version as selected_version
      FROM tenant_checklist_config tcc
      JOIN regulatory_standards rs ON tcc.standard_id = rs.id
      LEFT JOIN compliance_checklist_versions cv ON tcc.selected_version_id = cv.id
      WHERE tcc.tenant_id = $1
    `, [tenantId]);

    return result.rows.map(this.mapTenantConfig);
  }

  async setTenantConfig(tenantId: string, standardId: string, config: {
    versionSelection: 'auto' | 'specific' | 'pinned';
    selectedVersionId?: string;
    autoUpdateEnabled?: boolean;
    notificationOnUpdate?: boolean;
  }): Promise<TenantChecklistConfig> {
    const result = await this.pool.query(`
      INSERT INTO tenant_checklist_config (
        tenant_id, standard_id, version_selection, selected_version_id,
        auto_update_enabled, notification_on_update
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, standard_id) DO UPDATE SET
        version_selection = EXCLUDED.version_selection,
        selected_version_id = EXCLUDED.selected_version_id,
        auto_update_enabled = COALESCE(EXCLUDED.auto_update_enabled, tenant_checklist_config.auto_update_enabled),
        notification_on_update = COALESCE(EXCLUDED.notification_on_update, tenant_checklist_config.notification_on_update),
        updated_at = NOW()
      RETURNING *
    `, [
      tenantId,
      standardId,
      config.versionSelection,
      config.selectedVersionId,
      config.autoUpdateEnabled ?? true,
      config.notificationOnUpdate ?? true
    ]);

    return this.mapTenantConfig(result.rows[0]);
  }

  async getEffectiveVersion(tenantId: string, standardId: string): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT get_effective_checklist_version($1, $2) as version_id`,
      [tenantId, standardId]
    );
    return result.rows[0]?.version_id;
  }

  // --------------------------------------------------------------------------
  // TENANT PROGRESS
  // --------------------------------------------------------------------------

  async getTenantProgress(tenantId: string, versionId: string): Promise<ChecklistProgress> {
    const result = await this.pool.query(`
      SELECT
        $1 as tenant_id,
        $2 as version_id,
        rs.code as standard_code,
        COUNT(i.id) as total_items,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_items,
        COUNT(CASE WHEN p.status = 'in_progress' THEN 1 END) as in_progress_items,
        COUNT(CASE WHEN p.status = 'not_applicable' THEN 1 END) as not_applicable_items,
        COUNT(CASE WHEN p.status = 'blocked' THEN 1 END) as blocked_items,
        COALESCE(calculate_checklist_completion($1, $2), 0) as completion_percentage,
        COALESCE(SUM(CASE WHEN p.status NOT IN ('completed', 'not_applicable') THEN i.estimated_minutes ELSE 0 END), 0) as estimated_remaining_minutes
      FROM compliance_checklist_items i
      JOIN compliance_checklist_versions cv ON i.version_id = cv.id
      JOIN regulatory_standards rs ON cv.standard_id = rs.id
      LEFT JOIN tenant_checklist_progress p ON p.item_id = i.id AND p.tenant_id = $1
      WHERE i.version_id = $2
      GROUP BY rs.code
    `, [tenantId, versionId]);

    return this.mapChecklistProgress(result.rows[0] || {
      tenant_id: tenantId,
      version_id: versionId,
      total_items: 0,
      completed_items: 0,
      in_progress_items: 0,
      not_applicable_items: 0,
      blocked_items: 0,
      completion_percentage: 0,
      estimated_remaining_minutes: 0
    });
  }

  async updateItemProgress(tenantId: string, itemId: string, data: {
    status: 'not_started' | 'in_progress' | 'completed' | 'not_applicable' | 'blocked';
    completedBy?: string;
    notes?: string;
    evidenceIds?: string[];
    blockedReason?: string;
  }): Promise<void> {
    await this.pool.query(`
      INSERT INTO tenant_checklist_progress (
        tenant_id, item_id, status, completed_by, completed_at, notes, evidence_ids, blocked_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, item_id) DO UPDATE SET
        status = EXCLUDED.status,
        completed_by = CASE WHEN EXCLUDED.status = 'completed' THEN EXCLUDED.completed_by ELSE tenant_checklist_progress.completed_by END,
        completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN NOW() ELSE tenant_checklist_progress.completed_at END,
        notes = COALESCE(EXCLUDED.notes, tenant_checklist_progress.notes),
        evidence_ids = COALESCE(EXCLUDED.evidence_ids, tenant_checklist_progress.evidence_ids),
        blocked_reason = CASE WHEN EXCLUDED.status = 'blocked' THEN EXCLUDED.blocked_reason ELSE NULL END,
        updated_at = NOW()
    `, [
      tenantId,
      itemId,
      data.status,
      data.completedBy,
      data.status === 'completed' ? new Date().toISOString() : null,
      data.notes,
      data.evidenceIds,
      data.blockedReason
    ]);
  }

  // --------------------------------------------------------------------------
  // AUDIT RUNS
  // --------------------------------------------------------------------------

  async startAuditRun(tenantId: string, versionId: string, data: {
    runType: 'manual' | 'scheduled' | 'pre_audit' | 'certification';
    triggeredBy?: string;
    notes?: string;
  }): Promise<ChecklistAuditRun> {
    const itemCount = await this.pool.query(
      `SELECT COUNT(*) as count FROM compliance_checklist_items WHERE version_id = $1`,
      [versionId]
    );

    const result = await this.pool.query(`
      INSERT INTO checklist_audit_runs (
        tenant_id, version_id, run_type, triggered_by, notes, total_items
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      tenantId,
      versionId,
      data.runType,
      data.triggeredBy,
      data.notes,
      itemCount.rows[0].count
    ]);

    return this.mapAuditRun(result.rows[0]);
  }

  async completeAuditRun(runId: string, data: {
    status: 'completed' | 'cancelled' | 'failed';
    passedItems: number;
    failedItems: number;
    skippedItems: number;
    score?: number;
    reportUrl?: string;
  }): Promise<ChecklistAuditRun> {
    const result = await this.pool.query(`
      UPDATE checklist_audit_runs SET
        completed_at = NOW(),
        status = $2,
        completed_items = $3 + $4 + $5,
        passed_items = $3,
        failed_items = $4,
        skipped_items = $5,
        score = $6,
        report_url = $7
      WHERE id = $1
      RETURNING *
    `, [
      runId,
      data.status,
      data.passedItems,
      data.failedItems,
      data.skippedItems,
      data.score,
      data.reportUrl
    ]);

    return this.mapAuditRun(result.rows[0]);
  }

  async getAuditRunHistory(tenantId: string, limit: number = 20): Promise<ChecklistAuditRun[]> {
    const result = await this.pool.query(`
      SELECT car.*, cv.version, rs.code as standard_code
      FROM checklist_audit_runs car
      JOIN compliance_checklist_versions cv ON car.version_id = cv.id
      JOIN regulatory_standards rs ON cv.standard_id = rs.id
      WHERE car.tenant_id = $1
      ORDER BY car.started_at DESC
      LIMIT $2
    `, [tenantId, limit]);

    return result.rows.map(this.mapAuditRun);
  }

  // --------------------------------------------------------------------------
  // REGULATORY VERSION UPDATES (AUTO-UPDATE)
  // --------------------------------------------------------------------------

  async recordVersionUpdate(data: {
    standardId: string;
    source: string;
    sourceUrl?: string;
    oldVersion?: string;
    newVersion: string;
    changeType: 'major' | 'minor' | 'patch' | 'errata' | 'guidance';
    changeSummary?: string;
    effectiveDate?: string;
  }): Promise<RegulatoryVersionUpdate> {
    const result = await this.pool.query(`
      INSERT INTO regulatory_version_updates (
        standard_id, source, source_url, old_version, new_version,
        change_type, change_summary, effective_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.standardId,
      data.source,
      data.sourceUrl,
      data.oldVersion,
      data.newVersion,
      data.changeType,
      data.changeSummary,
      data.effectiveDate
    ]);

    return this.mapVersionUpdate(result.rows[0]);
  }

  async getPendingUpdates(): Promise<RegulatoryVersionUpdate[]> {
    const result = await this.pool.query(`
      SELECT rvu.*, rs.code as standard_code
      FROM regulatory_version_updates rvu
      JOIN regulatory_standards rs ON rvu.standard_id = rs.id
      WHERE rvu.processing_status = 'pending'
      ORDER BY rvu.detected_at
    `);

    return result.rows.map(this.mapVersionUpdate);
  }

  async processVersionUpdate(updateId: string, data: {
    status: 'completed' | 'failed' | 'ignored';
    notes?: string;
    checklistVersionCreatedId?: string;
  }): Promise<void> {
    await this.pool.query(`
      UPDATE regulatory_version_updates SET
        processing_status = $2,
        processed_at = NOW(),
        processing_notes = $3,
        checklist_version_created_id = $4
      WHERE id = $1
    `, [updateId, data.status, data.notes, data.checklistVersionCreatedId]);
  }

  async checkForUpdates(standardId: string): Promise<RegulatoryVersionUpdate[]> {
    // Get update sources for this standard
    const sources = await this.pool.query(`
      SELECT * FROM checklist_update_sources
      WHERE standard_id = $1 AND is_enabled = true
    `, [standardId]);

    const updates: RegulatoryVersionUpdate[] = [];

    for (const source of sources.rows) {
      try {
        // Update last check timestamp
        await this.pool.query(`
          UPDATE checklist_update_sources SET last_check_at = NOW(), error_count = 0
          WHERE id = $1
        `, [source.id]);

        // In a real implementation, this would fetch from the source
        // For now, we just log that we checked
        logger.debug('Checked update source', { sourceName: source.source_name, standardId });

      } catch (error) {
        // Record error
        await this.pool.query(`
          UPDATE checklist_update_sources SET
            error_count = error_count + 1,
            last_error = $2
          WHERE id = $1
        `, [source.id, (error as Error).message]);
      }
    }

    return updates;
  }

  // --------------------------------------------------------------------------
  // DASHBOARD DATA
  // --------------------------------------------------------------------------

  async getDashboardData(tenantId: string): Promise<{
    standards: Array<{
      standardId: string;
      standardCode: string;
      standardName: string;
      effectiveVersionId: string | null;
      effectiveVersion: string | null;
      versionSelection: string;
      progress: ChecklistProgress | null;
      lastAuditRun: ChecklistAuditRun | null;
    }>;
    pendingUpdates: number;
    recentAuditRuns: ChecklistAuditRun[];
  }> {
    // Get all standards with tenant config
    const standardsResult = await this.pool.query(`
      SELECT 
        rs.id as standard_id,
        rs.code as standard_code,
        rs.name as standard_name,
        COALESCE(tcc.version_selection, 'auto') as version_selection,
        get_effective_checklist_version($1, rs.id) as effective_version_id
      FROM regulatory_standards rs
      LEFT JOIN tenant_checklist_config tcc ON tcc.standard_id = rs.id AND tcc.tenant_id = $1
      WHERE rs.status = 'active' AND rs.applies_to_radiant = true
      ORDER BY rs.priority DESC
    `, [tenantId]);

    const standards = await Promise.all(standardsResult.rows.map(async (row) => {
      let progress = null;
      let lastAuditRun = null;
      let effectiveVersion = null;

      if (row.effective_version_id) {
        progress = await this.getTenantProgress(tenantId, row.effective_version_id);
        
        const versionResult = await this.pool.query(
          `SELECT version FROM compliance_checklist_versions WHERE id = $1`,
          [row.effective_version_id]
        );
        effectiveVersion = versionResult.rows[0]?.version;

        const auditResult = await this.pool.query(`
          SELECT * FROM checklist_audit_runs
          WHERE tenant_id = $1 AND version_id = $2
          ORDER BY started_at DESC LIMIT 1
        `, [tenantId, row.effective_version_id]);
        
        if (auditResult.rows[0]) {
          lastAuditRun = this.mapAuditRun(auditResult.rows[0]);
        }
      }

      return {
        standardId: row.standard_id,
        standardCode: row.standard_code,
        standardName: row.standard_name,
        effectiveVersionId: row.effective_version_id,
        effectiveVersion,
        versionSelection: row.version_selection,
        progress,
        lastAuditRun
      };
    }));

    // Get pending updates count
    const pendingResult = await this.pool.query(`
      SELECT COUNT(*) as count FROM regulatory_version_updates WHERE processing_status = 'pending'
    `);

    // Get recent audit runs
    const recentAuditRuns = await this.getAuditRunHistory(tenantId, 5);

    return {
      standards,
      pendingUpdates: parseInt(pendingResult.rows[0].count),
      recentAuditRuns
    };
  }

  // --------------------------------------------------------------------------
  // MAPPERS
  // --------------------------------------------------------------------------

  private mapChecklistVersion(row: any): ChecklistVersion {
    return {
      id: row.id,
      standardId: row.standard_id,
      standardCode: row.standard_code,
      standardName: row.standard_name,
      version: row.version,
      versionDate: row.version_date,
      title: row.title,
      description: row.description,
      sourceUrl: row.source_url,
      sourceDocument: row.source_document,
      isLatest: row.is_latest,
      isActive: row.is_active,
      changeSummary: row.change_summary,
      effectiveDate: row.effective_date,
      supersedesVersionId: row.supersedes_version_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapChecklistCategory(row: any): ChecklistCategory {
    return {
      id: row.id,
      versionId: row.version_id,
      code: row.code,
      name: row.name,
      description: row.description,
      displayOrder: row.display_order,
      icon: row.icon,
      itemCount: parseInt(row.item_count) || 0,
      completedCount: parseInt(row.completed_count) || 0
    };
  }

  private mapChecklistItem(row: any): ChecklistItem {
    return {
      id: row.id,
      versionId: row.version_id,
      categoryId: row.category_id,
      categoryCode: row.category_code,
      categoryName: row.category_name,
      requirementId: row.requirement_id,
      itemCode: row.item_code,
      title: row.title,
      description: row.description,
      guidance: row.guidance,
      evidenceTypes: row.evidence_types || [],
      apiEndpoint: row.api_endpoint,
      automatedCheckCode: row.automated_check_code,
      isRequired: row.is_required,
      isAutomatable: row.is_automatable,
      priority: row.priority,
      estimatedMinutes: row.estimated_minutes,
      displayOrder: row.display_order,
      tags: row.tags || [],
      status: row.status,
      completedAt: row.completed_at,
      completedBy: row.completed_by
    };
  }

  private mapTenantConfig(row: any): TenantChecklistConfig {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      standardId: row.standard_id,
      standardCode: row.standard_code,
      versionSelection: row.version_selection,
      selectedVersionId: row.selected_version_id,
      selectedVersion: row.selected_version,
      autoUpdateEnabled: row.auto_update_enabled,
      notificationOnUpdate: row.notification_on_update,
      lastVersionCheckAt: row.last_version_check_at,
      effectiveVersionId: row.effective_version_id,
      effectiveVersion: row.effective_version
    };
  }

  private mapChecklistProgress(row: any): ChecklistProgress {
    return {
      tenantId: row.tenant_id,
      versionId: row.version_id,
      standardCode: row.standard_code,
      totalItems: parseInt(row.total_items) || 0,
      completedItems: parseInt(row.completed_items) || 0,
      inProgressItems: parseInt(row.in_progress_items) || 0,
      notApplicableItems: parseInt(row.not_applicable_items) || 0,
      blockedItems: parseInt(row.blocked_items) || 0,
      completionPercentage: parseFloat(row.completion_percentage) || 0,
      estimatedRemainingMinutes: parseInt(row.estimated_remaining_minutes) || 0
    };
  }

  private mapAuditRun(row: any): ChecklistAuditRun {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      versionId: row.version_id,
      runType: row.run_type,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      totalItems: row.total_items,
      completedItems: row.completed_items,
      passedItems: row.passed_items,
      failedItems: row.failed_items,
      skippedItems: row.skipped_items,
      score: row.score ? parseFloat(row.score) : undefined,
      triggeredBy: row.triggered_by,
      notes: row.notes,
      reportUrl: row.report_url
    };
  }

  private mapVersionUpdate(row: any): RegulatoryVersionUpdate {
    return {
      id: row.id,
      standardId: row.standard_id,
      standardCode: row.standard_code,
      source: row.source,
      sourceUrl: row.source_url,
      oldVersion: row.old_version,
      newVersion: row.new_version,
      changeType: row.change_type,
      changeSummary: row.change_summary,
      effectiveDate: row.effective_date,
      detectedAt: row.detected_at,
      processedAt: row.processed_at,
      processingStatus: row.processing_status,
      processingNotes: row.processing_notes,
      checklistVersionCreatedId: row.checklist_version_created_id
    };
  }
}

// Singleton instance
let checklistRegistryService: ChecklistRegistryService | null = null;

export function getChecklistRegistryService(pool: Pool): ChecklistRegistryService {
  if (!checklistRegistryService) {
    checklistRegistryService = new ChecklistRegistryService(pool);
  }
  return checklistRegistryService;
}
