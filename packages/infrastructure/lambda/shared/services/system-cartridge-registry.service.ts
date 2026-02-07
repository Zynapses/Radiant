/**
 * RADIANT System Cartridge Registry Service
 * v6.1.0: Domain experts as system cartridges with full audit trail
 * 
 * Features:
 * - Register system cartridges (via RADz import or Curator)
 * - Tenant visibility toggles (enabled by default, can hide)
 * - Full audit trail for HIPAA/SOC2/GDPR compliance
 * - Thermal state management for inference optimization
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { executeStatement, stringParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'system/cartridge-registry',
  category: 'infrastructure',
  sourceType: 'application',
});
import type {
  CartridgeCategory,
  CartridgeThermalState,
  SystemCartridgeEntry,
  SystemCartridgeAuditEntry,
  SystemCartridgeAuditAction,
  TenantCartridgeVisibility,
  RegisterSystemCartridgeRequest,
  UpdateTenantVisibilityRequest,
  SystemCartridgeDashboard,
  ListSystemCartridgesRequest,
  ListSystemCartridgesResponse,
  CartridgeManifest,
} from '@radiant/shared';

// =============================================================================
// Constants
// =============================================================================

const CARTRIDGE_BUCKET = process.env.CARTRIDGE_BUCKET || 'radiant-cartridges';
const SYSTEM_CARTRIDGE_PREFIX = 'system/';

// =============================================================================
// Types
// =============================================================================

interface AuditContext {
  userId: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  complianceFlags?: string[];
}

// =============================================================================
// Service
// =============================================================================

class SystemCartridgeRegistryService {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  // ===========================================================================
  // Dashboard
  // ===========================================================================

  async getDashboard(): Promise<SystemCartridgeDashboard> {
    try {
      const [cartridges, recentAudit, thermalStats, hiddenStats] = await Promise.all([
        this.listSystemCartridges({}),
        this.getRecentAuditLog(50),
        this.getThermalStateStats(),
        this.getTenantsWithHiddenCartridges(),
      ]);

      const domainExperts = cartridges.cartridges.filter(c => c.category === 'domain_expert');
      const generalCartridges = cartridges.cartridges.filter(c => c.category === 'general');

      // Count recent audit actions (last 24 hours)
      const recentAuditActions = recentAudit.filter(
        a => new Date(a.performedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      ).length;

      return {
        summary: {
          totalSystemCartridges: cartridges.total,
          totalDomainExperts: domainExperts.length,
          totalGeneralCartridges: generalCartridges.length,
          thermalStates: thermalStats,
          recentAuditActions,
        },
        cartridges: cartridges.cartridges,
        recentAudit,
        tenantsWithHiddenCartridges: hiddenStats,
      };
    } catch (error) {
      logger.error('Failed to get system cartridge dashboard', { error });
      throw error;
    }
  }

  // ===========================================================================
  // Registration (Admin Only)
  // ===========================================================================

  /**
   * Register a system cartridge from RADz import or Curator
   * Only accessible by super admins
   */
  async registerSystemCartridge(
    request: RegisterSystemCartridgeRequest,
    context: AuditContext
  ): Promise<SystemCartridgeEntry> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      let manifest: CartridgeManifest | undefined;
      let storageKey = '';
      let fileSizeBytes = 0;
      let checksum = '';

      // If RADz import, validate and get manifest
      if (request.registeredVia === 'radz_import' && request.fileKey) {
        const validation = await this.validateRADzFile(request.fileKey);
        if (!validation.isValid) {
          throw new Error(`Invalid RADz file: ${validation.errors.join(', ')}`);
        }
        manifest = validation.manifest;
        storageKey = `${SYSTEM_CARTRIDGE_PREFIX}${id}.radz`;
        
        // Copy to system cartridge location
        await this.copyToSystemStorage(request.fileKey, storageKey);
        fileSizeBytes = validation.fileSizeBytes;
        checksum = validation.checksum;
      }

      const name = request.name || manifest?.name || `System Cartridge ${id.slice(0, 8)}`;
      const description = request.description || manifest?.description || '';
      const domains = manifest?.domains || (request.domainId ? [request.domainId] : []);

      // Insert cartridge record
      await executeStatement(
        `INSERT INTO cartridges (
          id, tenant_id, name, description, version, scope, status, category,
          domain_id, domain_display_name, storage_key, storage_bucket, file_size_bytes, checksum,
          domains, has_lora_adapters, has_curator_knowledge, has_ghost_compression, has_domain_experts,
          allow_user_override, overridable_fields, is_enabled,
          thermal_state, thermal_state_changed_at, inference_count,
          registered_at, registered_by, registered_via, version_history,
          created_at, created_by, updated_at
        ) VALUES (
          :id, '00000000-0000-0000-0000-000000000000', :name, :description, '1.0.0', 'system', 'active', :category,
          :domain_id, :domain_display_name, :storage_key, :bucket, :file_size, :checksum,
          :domains, :has_lora, :has_curator, :has_ghost, :has_domain,
          false, '[]'::jsonb, true,
          'cold', NOW(), 0,
          NOW(), :registered_by, :registered_via, '[]'::jsonb,
          :created_at, :created_by, :updated_at
        )`,
        [
          stringParam('id', id),
          stringParam('name', name),
          stringParam('description', description),
          stringParam('category', request.category),
          stringParam('domain_id', request.domainId || ''),
          stringParam('domain_display_name', request.domainId ? this.formatDomainName(request.domainId) : ''),
          stringParam('storage_key', storageKey),
          stringParam('bucket', CARTRIDGE_BUCKET),
          stringParam('file_size', String(fileSizeBytes)),
          stringParam('checksum', checksum),
          stringParam('domains', JSON.stringify(domains)),
          boolParam('has_lora', manifest?.hasLoraAdapters ?? false),
          boolParam('has_curator', manifest?.hasCuratorKnowledge ?? false),
          boolParam('has_ghost', manifest?.hasGhostCompression ?? false),
          boolParam('has_domain', manifest?.hasDomainExperts ?? (request.category === 'domain_expert')),
          stringParam('registered_by', context.userId),
          stringParam('registered_via', request.registeredVia),
          stringParam('created_at', now.toISOString()),
          stringParam('created_by', context.userId),
          stringParam('updated_at', now.toISOString()),
        ]
      );

      // Log audit event
      await this.logAuditEvent(id, 'created', context, undefined, {
        name,
        category: request.category,
        domainId: request.domainId,
        registeredVia: request.registeredVia,
      });

      logger.info('System cartridge registered', {
        cartridgeId: id,
        category: request.category,
        domainId: request.domainId,
        registeredVia: request.registeredVia,
        userId: context.userId,
      });

      return (await this.getSystemCartridge(id))!;
    } catch (error) {
      logger.error('Failed to register system cartridge', { error, request });
      throw error;
    }
  }

  /**
   * Update a system cartridge (new version)
   */
  async updateSystemCartridge(
    cartridgeId: string,
    updates: Partial<Pick<SystemCartridgeEntry, 'name' | 'description' | 'complianceNotes'>>,
    context: AuditContext
  ): Promise<SystemCartridgeEntry> {
    try {
      const current = await this.getSystemCartridge(cartridgeId);
      if (!current) {
        throw new Error(`System cartridge not found: ${cartridgeId}`);
      }

      const updateClauses: string[] = [];
      const params = [stringParam('id', cartridgeId)];

      if (updates.name !== undefined) {
        updateClauses.push('name = :name');
        params.push(stringParam('name', updates.name));
      }

      if (updates.description !== undefined) {
        updateClauses.push('description = :description');
        params.push(stringParam('description', updates.description));
      }

      if (updates.complianceNotes !== undefined) {
        updateClauses.push('compliance_notes = :compliance_notes');
        updateClauses.push('compliance_reviewed_at = NOW()');
        updateClauses.push('compliance_reviewed_by = :reviewed_by');
        params.push(stringParam('compliance_notes', updates.complianceNotes));
        params.push(stringParam('reviewed_by', context.userId));
      }

      updateClauses.push('updated_at = NOW()');

      await executeStatement(
        `UPDATE cartridges SET ${updateClauses.join(', ')} WHERE id = :id`,
        params
      );

      // Log audit event
      await this.logAuditEvent(cartridgeId, 'updated', context, current as unknown as Record<string, unknown>, updates as Record<string, unknown>);

      logger.info('System cartridge updated', { cartridgeId, updates, userId: context.userId });
      return (await this.getSystemCartridge(cartridgeId))!;
    } catch (error) {
      logger.error('Failed to update system cartridge', { error, cartridgeId });
      throw error;
    }
  }

  /**
   * Delete (archive) a system cartridge
   */
  async deleteSystemCartridge(cartridgeId: string, context: AuditContext): Promise<void> {
    try {
      const current = await this.getSystemCartridge(cartridgeId);
      if (!current) {
        throw new Error(`System cartridge not found: ${cartridgeId}`);
      }

      await executeStatement(
        `UPDATE cartridges 
         SET status = 'archived', archived_at = NOW(), archived_by = :user_id
         WHERE id = :id`,
        [stringParam('id', cartridgeId), stringParam('user_id', context.userId)]
      );

      // Log audit event
      await this.logAuditEvent(cartridgeId, 'deleted', context, current as unknown as Record<string, unknown>, { status: 'archived' });

      logger.info('System cartridge deleted', { cartridgeId, userId: context.userId });
    } catch (error) {
      logger.error('Failed to delete system cartridge', { error, cartridgeId });
      throw error;
    }
  }

  /**
   * Upgrade a system cartridge to a new version (from new RADz file)
   */
  async upgradeSystemCartridge(
    cartridgeId: string,
    newRADzFileKey: string,
    context: AuditContext
  ): Promise<SystemCartridgeEntry> {
    try {
      const current = await this.getSystemCartridge(cartridgeId);
      if (!current) {
        throw new Error(`System cartridge not found: ${cartridgeId}`);
      }

      // Validate new RADz file
      const validation = await this.validateRADzFile(newRADzFileKey);
      if (!validation.isValid) {
        throw new Error(`Invalid RADz file: ${validation.errors.join(', ')}`);
      }

      // Copy to system storage with versioned key
      const newVersion = this.incrementVersion(current.version);
      const newStorageKey = `${SYSTEM_CARTRIDGE_PREFIX}${cartridgeId}/v${newVersion}.radz`;
      await this.copyToSystemStorage(newRADzFileKey, newStorageKey);

      // Update cartridge
      const versionHistory = [...current.versionHistory, current.version];

      await executeStatement(
        `UPDATE cartridges SET
          version = :version,
          storage_key = :storage_key,
          file_size_bytes = :file_size,
          checksum = :checksum,
          previous_version_id = :prev_id,
          version_history = :version_history,
          updated_at = NOW()
        WHERE id = :id`,
        [
          stringParam('id', cartridgeId),
          stringParam('version', newVersion),
          stringParam('storage_key', newStorageKey),
          stringParam('file_size', String(validation.fileSizeBytes)),
          stringParam('checksum', validation.checksum),
          stringParam('prev_id', cartridgeId),
          stringParam('version_history', JSON.stringify(versionHistory)),
        ]
      );

      // Log audit event
      await this.logAuditEvent(cartridgeId, 'version_upgraded', context, {
        version: current.version,
      }, {
        version: newVersion,
        versionHistory,
      });

      logger.info('System cartridge upgraded', {
        cartridgeId,
        oldVersion: current.version,
        newVersion,
        userId: context.userId,
      });

      return (await this.getSystemCartridge(cartridgeId))!;
    } catch (error) {
      logger.error('Failed to upgrade system cartridge', { error, cartridgeId });
      throw error;
    }
  }

  // ===========================================================================
  // Tenant Visibility (Tenant Admin)
  // ===========================================================================

  /**
   * Update tenant visibility for a system cartridge
   * When disabled, the cartridge is completely hidden from that tenant's users
   */
  async updateTenantVisibility(
    tenantId: string,
    request: UpdateTenantVisibilityRequest,
    context: AuditContext
  ): Promise<TenantCartridgeVisibility> {
    try {
      const cartridge = await this.getSystemCartridge(request.cartridgeId);
      if (!cartridge) {
        throw new Error(`System cartridge not found: ${request.cartridgeId}`);
      }

      const now = new Date();

      await executeStatement(
        `INSERT INTO tenant_cartridge_visibility (
          tenant_id, cartridge_id, is_visible,
          disabled_at, disabled_by, disabled_reason,
          enabled_at, enabled_by
        ) VALUES (
          :tenant_id, :cartridge_id, :is_visible,
          :disabled_at, :disabled_by, :disabled_reason,
          :enabled_at, :enabled_by
        )
        ON CONFLICT (tenant_id, cartridge_id) DO UPDATE SET
          is_visible = EXCLUDED.is_visible,
          disabled_at = CASE WHEN EXCLUDED.is_visible = false THEN NOW() ELSE tenant_cartridge_visibility.disabled_at END,
          disabled_by = CASE WHEN EXCLUDED.is_visible = false THEN EXCLUDED.disabled_by ELSE tenant_cartridge_visibility.disabled_by END,
          disabled_reason = CASE WHEN EXCLUDED.is_visible = false THEN EXCLUDED.disabled_reason ELSE tenant_cartridge_visibility.disabled_reason END,
          enabled_at = CASE WHEN EXCLUDED.is_visible = true THEN NOW() ELSE tenant_cartridge_visibility.enabled_at END,
          enabled_by = CASE WHEN EXCLUDED.is_visible = true THEN EXCLUDED.enabled_by ELSE tenant_cartridge_visibility.enabled_by END,
          updated_at = NOW()`,
        [
          stringParam('tenant_id', tenantId),
          stringParam('cartridge_id', request.cartridgeId),
          boolParam('is_visible', request.isVisible),
          stringParam('disabled_at', request.isVisible ? '' : now.toISOString()),
          stringParam('disabled_by', request.isVisible ? '' : context.userId),
          stringParam('disabled_reason', request.isVisible ? '' : (request.reason || '')),
          stringParam('enabled_at', request.isVisible ? now.toISOString() : ''),
          stringParam('enabled_by', request.isVisible ? context.userId : ''),
        ]
      );

      // Log audit event
      await this.logAuditEvent(
        request.cartridgeId,
        request.isVisible ? 'enabled' : 'disabled',
        { ...context, complianceFlags: ['tenant_visibility'] },
        { tenantId, isVisible: !request.isVisible },
        { tenantId, isVisible: request.isVisible, reason: request.reason }
      );

      logger.info('Tenant visibility updated', {
        tenantId,
        cartridgeId: request.cartridgeId,
        isVisible: request.isVisible,
        userId: context.userId,
      });

      return {
        tenantId,
        cartridgeId: request.cartridgeId,
        isVisible: request.isVisible,
        disabledAt: request.isVisible ? undefined : now,
        disabledBy: request.isVisible ? undefined : context.userId,
        disabledReason: request.isVisible ? undefined : request.reason,
        enabledAt: request.isVisible ? now : undefined,
        enabledBy: request.isVisible ? context.userId : undefined,
      };
    } catch (error) {
      logger.error('Failed to update tenant visibility', { error, tenantId, request });
      throw error;
    }
  }

  /**
   * Get visibility status for all system cartridges for a tenant
   */
  async getTenantVisibility(tenantId: string): Promise<TenantCartridgeVisibility[]> {
    try {
      const result = await executeStatement(
        `SELECT 
          c.id AS cartridge_id,
          c.name,
          c.category,
          c.domain_id,
          COALESCE(tcv.is_visible, true) AS is_visible,
          tcv.disabled_at,
          tcv.disabled_by,
          tcv.disabled_reason,
          tcv.enabled_at,
          tcv.enabled_by
        FROM cartridges c
        LEFT JOIN tenant_cartridge_visibility tcv 
          ON tcv.cartridge_id = c.id AND tcv.tenant_id = :tenant_id
        WHERE c.scope = 'system' AND c.status = 'active' AND c.archived_at IS NULL
        ORDER BY c.category, c.name`,
        [stringParam('tenant_id', tenantId)]
      );

      return (result.rows || []).map((row: Record<string, unknown>) => ({
        tenantId,
        cartridgeId: String(row.cartridge_id),
        isVisible: Boolean(row.is_visible),
        disabledAt: row.disabled_at ? new Date(String(row.disabled_at)) : undefined,
        disabledBy: row.disabled_by ? String(row.disabled_by) : undefined,
        disabledReason: row.disabled_reason ? String(row.disabled_reason) : undefined,
        enabledAt: row.enabled_at ? new Date(String(row.enabled_at)) : undefined,
        enabledBy: row.enabled_by ? String(row.enabled_by) : undefined,
      }));
    } catch (error) {
      logger.error('Failed to get tenant visibility', { error, tenantId });
      throw error;
    }
  }

  /**
   * Get visible system cartridges for a tenant (used by inference stack)
   */
  async getVisibleCartridgesForTenant(tenantId: string): Promise<SystemCartridgeEntry[]> {
    try {
      const result = await executeStatement(
        `SELECT c.* FROM cartridges c
         WHERE c.scope = 'system'
           AND c.status = 'active'
           AND c.archived_at IS NULL
           AND (
             NOT EXISTS (
               SELECT 1 FROM tenant_cartridge_visibility tcv
               WHERE tcv.cartridge_id = c.id AND tcv.tenant_id = :tenant_id
             )
             OR EXISTS (
               SELECT 1 FROM tenant_cartridge_visibility tcv
               WHERE tcv.cartridge_id = c.id AND tcv.tenant_id = :tenant_id AND tcv.is_visible = true
             )
           )
         ORDER BY c.category, c.name`,
        [stringParam('tenant_id', tenantId)]
      );

      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToSystemCartridge(row));
    } catch (error) {
      logger.error('Failed to get visible cartridges for tenant', { error, tenantId });
      throw error;
    }
  }

  // ===========================================================================
  // Thermal State Management
  // ===========================================================================

  /**
   * Update thermal state with history tracking
   */
  async updateThermalState(
    cartridgeId: string,
    newState: CartridgeThermalState,
    triggerReason: string = 'manual'
  ): Promise<void> {
    try {
      await executeStatement(
        `SELECT update_cartridge_thermal_state(:id, :state::cartridge_thermal_state, :reason)`,
        [
          stringParam('id', cartridgeId),
          stringParam('state', newState),
          stringParam('reason', triggerReason),
        ]
      );

      logger.info('Thermal state updated', { cartridgeId, newState, triggerReason });
    } catch (error) {
      logger.error('Failed to update thermal state', { error, cartridgeId });
      throw error;
    }
  }

  /**
   * Record inference and potentially warm up cartridge
   */
  async recordInference(cartridgeId: string, tenantId: string, latencyMs: number): Promise<void> {
    try {
      // Update inference count and last inference time
      await executeStatement(
        `UPDATE cartridges 
         SET inference_count = inference_count + 1,
             last_inference_at = NOW()
         WHERE id = :id`,
        [stringParam('id', cartridgeId)]
      );

      // Check if we need to warm up (3+ inferences in last 5 minutes → warm, 10+ → hot)
      const result = await executeStatement(
        `SELECT inference_count, thermal_state,
                (SELECT COUNT(*) FROM system_cartridge_inference_metrics 
                 WHERE cartridge_id = :id 
                   AND bucket_start > NOW() - interval '5 minutes') as recent_count
         FROM cartridges WHERE id = :id`,
        [stringParam('id', cartridgeId)]
      );

      if (result.rows?.[0]) {
        const row = result.rows[0];
        const recentCount = Number(row.recent_count) || 0;
        const currentState = String(row.thermal_state) as CartridgeThermalState;

        if (recentCount >= 10 && currentState !== 'hot') {
          await this.updateThermalState(cartridgeId, 'hot', 'inference_spike');
        } else if (recentCount >= 3 && currentState === 'cold') {
          await this.updateThermalState(cartridgeId, 'warm', 'usage_warmup');
        }
      }

      // Record metrics (1-hour bucket)
      const bucketStart = new Date();
      bucketStart.setMinutes(0, 0, 0);
      const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000);

      await executeStatement(
        `INSERT INTO system_cartridge_inference_metrics (
          cartridge_id, tenant_id, bucket_start, bucket_end,
          inference_count, success_count, avg_latency_ms
        ) VALUES (
          :cartridge_id, :tenant_id, :bucket_start, :bucket_end,
          1, 1, :latency
        )
        ON CONFLICT (cartridge_id, tenant_id, bucket_start) DO UPDATE SET
          inference_count = system_cartridge_inference_metrics.inference_count + 1,
          success_count = system_cartridge_inference_metrics.success_count + 1,
          avg_latency_ms = (system_cartridge_inference_metrics.avg_latency_ms * system_cartridge_inference_metrics.inference_count + :latency) / (system_cartridge_inference_metrics.inference_count + 1)`,
        [
          stringParam('cartridge_id', cartridgeId),
          stringParam('tenant_id', tenantId),
          stringParam('bucket_start', bucketStart.toISOString()),
          stringParam('bucket_end', bucketEnd.toISOString()),
          stringParam('latency', String(latencyMs)),
        ]
      );
    } catch (error) {
      logger.warn('Failed to record inference', { error, cartridgeId });
      // Non-critical, don't throw
    }
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  async getSystemCartridge(cartridgeId: string): Promise<SystemCartridgeEntry | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM cartridges 
         WHERE id = :id AND scope = 'system' AND archived_at IS NULL`,
        [stringParam('id', cartridgeId)]
      );

      if (!result.rows?.length) return null;
      return this.mapRowToSystemCartridge(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get system cartridge', { error, cartridgeId });
      throw error;
    }
  }

  async listSystemCartridges(request: ListSystemCartridgesRequest): Promise<ListSystemCartridgesResponse> {
    try {
      const limit = request.limit || 50;
      const offset = request.offset || 0;

      let whereClause = `scope = 'system' AND archived_at IS NULL`;
      const params: ReturnType<typeof stringParam>[] = [];

      if (request.category) {
        whereClause += ` AND category = :category`;
        params.push(stringParam('category', request.category));
      }

      if (request.thermalState) {
        whereClause += ` AND thermal_state = :thermal_state`;
        params.push(stringParam('thermal_state', request.thermalState));
      }

      if (request.domainId) {
        whereClause += ` AND domain_id = :domain_id`;
        params.push(stringParam('domain_id', request.domainId));
      }

      const countResult = await executeStatement(
        `SELECT COUNT(*) as total FROM cartridges WHERE ${whereClause}`,
        params
      );

      const result = await executeStatement(
        `SELECT * FROM cartridges WHERE ${whereClause}
         ORDER BY category, name
         LIMIT ${limit} OFFSET ${offset}`,
        params
      );

      return {
        cartridges: (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToSystemCartridge(row)),
        total: Number(countResult.rows?.[0]?.total || 0),
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Failed to list system cartridges', { error, request });
      throw error;
    }
  }

  // ===========================================================================
  // Audit Log
  // ===========================================================================

  private async logAuditEvent(
    cartridgeId: string,
    action: SystemCartridgeAuditAction,
    context: AuditContext,
    previousState?: Record<string, unknown>,
    newState?: Record<string, unknown>
  ): Promise<void> {
    try {
      await executeStatement(
        `SELECT log_system_cartridge_audit(
          :cartridge_id::uuid,
          :action::system_cartridge_audit_action,
          :performed_by::uuid,
          :performed_by_email,
          :previous_state::jsonb,
          :new_state::jsonb,
          :reason,
          :ip_address::inet,
          :user_agent,
          :compliance_flags::text[]
        )`,
        [
          stringParam('cartridge_id', cartridgeId),
          stringParam('action', action),
          stringParam('performed_by', context.userId),
          stringParam('performed_by_email', context.userEmail || ''),
          stringParam('previous_state', previousState ? JSON.stringify(previousState) : ''),
          stringParam('new_state', newState ? JSON.stringify(newState) : ''),
          stringParam('reason', context.reason || ''),
          stringParam('ip_address', context.ipAddress || ''),
          stringParam('user_agent', context.userAgent || ''),
          stringParam('compliance_flags', `{${(context.complianceFlags || ['HIPAA', 'SOC2', 'GDPR']).join(',')}}`),
        ]
      );
    } catch (error) {
      logger.warn('Failed to log audit event', { error, cartridgeId, action });
      // Non-critical, don't throw
    }
  }

  async getRecentAuditLog(limit: number = 100): Promise<SystemCartridgeAuditEntry[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM system_cartridge_audit_log
         ORDER BY performed_at DESC
         LIMIT ${limit}`,
        []
      );

      return (result.rows || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        cartridgeId: String(row.cartridge_id),
        action: row.action as SystemCartridgeAuditAction,
        performedBy: String(row.performed_by),
        performedByEmail: row.performed_by_email ? String(row.performed_by_email) : undefined,
        performedAt: new Date(String(row.performed_at)),
        previousState: row.previous_state as Record<string, unknown> | undefined,
        newState: row.new_state as Record<string, unknown> | undefined,
        reason: row.reason ? String(row.reason) : undefined,
        ipAddress: row.ip_address ? String(row.ip_address) : undefined,
        userAgent: row.user_agent ? String(row.user_agent) : undefined,
        complianceFlags: row.compliance_flags as string[] | undefined,
      }));
    } catch (error) {
      logger.error('Failed to get audit log', { error });
      return [];
    }
  }

  async getAuditLogForCartridge(cartridgeId: string): Promise<SystemCartridgeAuditEntry[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM system_cartridge_audit_log
         WHERE cartridge_id = :cartridge_id
         ORDER BY performed_at DESC`,
        [stringParam('cartridge_id', cartridgeId)]
      );

      return (result.rows || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        cartridgeId: String(row.cartridge_id),
        action: row.action as SystemCartridgeAuditAction,
        performedBy: String(row.performed_by),
        performedByEmail: row.performed_by_email ? String(row.performed_by_email) : undefined,
        performedAt: new Date(String(row.performed_at)),
        previousState: row.previous_state as Record<string, unknown> | undefined,
        newState: row.new_state as Record<string, unknown> | undefined,
        reason: row.reason ? String(row.reason) : undefined,
        ipAddress: row.ip_address ? String(row.ip_address) : undefined,
        userAgent: row.user_agent ? String(row.user_agent) : undefined,
        complianceFlags: row.compliance_flags as string[] | undefined,
      }));
    } catch (error) {
      logger.error('Failed to get audit log for cartridge', { error, cartridgeId });
      return [];
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private async validateRADzFile(fileKey: string): Promise<{
    isValid: boolean;
    errors: string[];
    manifest?: CartridgeManifest;
    fileSizeBytes: number;
    checksum: string;
  }> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: CARTRIDGE_BUCKET,
        Key: fileKey,
      }));

      const body = await response.Body?.transformToString();
      if (!body) {
        return { isValid: false, errors: ['Empty file'], fileSizeBytes: 0, checksum: '' };
      }

      // For now, assume JSON manifest (real implementation would parse ZIP)
      const manifest = JSON.parse(body) as CartridgeManifest;
      const checksum = await this.calculateChecksum(body);

      return {
        isValid: true,
        errors: [],
        manifest,
        fileSizeBytes: body.length,
        checksum,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [(error as Error).message],
        fileSizeBytes: 0,
        checksum: '',
      };
    }
  }

  private async copyToSystemStorage(sourceKey: string, destKey: string): Promise<void> {
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: CARTRIDGE_BUCKET,
      Key: sourceKey,
    }));

    const body = await response.Body?.transformToByteArray();
    if (!body) throw new Error('Failed to read source file');

    await this.s3Client.send(new PutObjectCommand({
      Bucket: CARTRIDGE_BUCKET,
      Key: destKey,
      Body: body,
    }));
  }

  private async calculateChecksum(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private formatDomainName(domainId: string): string {
    return domainId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    return parts.join('.');
  }

  private async getThermalStateStats(): Promise<{
    cold: number;
    warming: number;
    warm: number;
    hot: number;
  }> {
    try {
      const result = await executeStatement(
        `SELECT thermal_state, COUNT(*) as count
         FROM cartridges
         WHERE scope = 'system' AND archived_at IS NULL
         GROUP BY thermal_state`,
        []
      );

      const stats = { cold: 0, warming: 0, warm: 0, hot: 0 };
      for (const row of result.rows || []) {
        const state = String(row.thermal_state) as CartridgeThermalState;
        stats[state] = Number(row.count) || 0;
      }
      return stats;
    } catch {
      return { cold: 0, warming: 0, warm: 0, hot: 0 };
    }
  }

  private async getTenantsWithHiddenCartridges(): Promise<number> {
    try {
      const result = await executeStatement(
        `SELECT COUNT(DISTINCT tenant_id) as count
         FROM tenant_cartridge_visibility
         WHERE is_visible = false`,
        []
      );
      return Number(result.rows?.[0]?.count || 0);
    } catch {
      return 0;
    }
  }

  private mapRowToSystemCartridge(row: Record<string, unknown>): SystemCartridgeEntry {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      userId: row.user_id ? String(row.user_id) : undefined,
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      version: String(row.version || '1.0.0'),
      scope: 'system',
      status: String(row.status) as SystemCartridgeEntry['status'],
      storageKey: String(row.storage_key || ''),
      storageBucket: String(row.storage_bucket || CARTRIDGE_BUCKET),
      fileSizeBytes: Number(row.file_size_bytes) || 0,
      checksum: String(row.checksum || ''),
      domains: row.domains ? JSON.parse(String(row.domains)) : [],
      hasLoraAdapters: Boolean(row.has_lora_adapters),
      hasCuratorKnowledge: Boolean(row.has_curator_knowledge),
      hasGhostCompression: Boolean(row.has_ghost_compression),
      hasDomainExperts: Boolean(row.has_domain_experts),
      allowUserOverride: Boolean(row.allow_user_override),
      overridableFields: row.overridable_fields ? JSON.parse(String(row.overridable_fields)) : [],
      isEnabled: Boolean(row.is_enabled),
      tags: row.tags ? JSON.parse(String(row.tags)) : undefined,
      createdAt: new Date(String(row.created_at)),
      createdBy: String(row.created_by),
      updatedAt: new Date(String(row.updated_at)),
      archivedAt: row.archived_at ? new Date(String(row.archived_at)) : undefined,
      archivedBy: row.archived_by ? String(row.archived_by) : undefined,
      
      // System cartridge specific
      registeredAt: new Date(String(row.registered_at || row.created_at)),
      registeredBy: String(row.registered_by || row.created_by),
      registeredVia: (row.registered_via as 'radz_import' | 'curator') || 'curator',
      category: (row.category as CartridgeCategory) || 'general',
      domainId: row.domain_id ? String(row.domain_id) : undefined,
      domainDisplayName: row.domain_display_name ? String(row.domain_display_name) : undefined,
      thermalState: (row.thermal_state as CartridgeThermalState) || 'cold',
      thermalStateChangedAt: row.thermal_state_changed_at ? new Date(String(row.thermal_state_changed_at)) : undefined,
      lastInferenceAt: row.last_inference_at ? new Date(String(row.last_inference_at)) : undefined,
      inferenceCount: Number(row.inference_count) || 0,
      previousVersionId: row.previous_version_id ? String(row.previous_version_id) : undefined,
      versionHistory: row.version_history ? JSON.parse(String(row.version_history)) : [],
      complianceReviewedAt: row.compliance_reviewed_at ? new Date(String(row.compliance_reviewed_at)) : undefined,
      complianceReviewedBy: row.compliance_reviewed_by ? String(row.compliance_reviewed_by) : undefined,
      complianceNotes: row.compliance_notes ? String(row.compliance_notes) : undefined,
    };
  }
}

export const systemCartridgeRegistryService = new SystemCartridgeRegistryService();
