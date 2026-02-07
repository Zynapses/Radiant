/**
 * RADIANT v4.18.0 - Collaboration Policy Service
 *
 * Enforces guest collaboration rules:
 *  1. Compliance gates — HIPAA/GDPR/SOC2 tenants auto-restrict guest capabilities
 *  2. Permission resolution — maps viewer/commenter/editor to explicit capabilities
 *  3. Cost attribution — routes guest-originated AI costs to the correct internal user
 *  4. Restriction notifications — builds user-facing messages when features are disabled
 */

import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuestPermission = 'viewer' | 'commenter' | 'editor';
export type CostAttributionMode = 'inviting_user' | 'session_owner' | 'tenant_pool';

export interface GuestCapabilities {
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  canExecutePrompts: boolean;
  canUploadFiles: boolean;
  canDownloadFiles: boolean;
  canCreateBranch: boolean;
  canJoinRoundtable: boolean;
  complianceRestricted: boolean;
  restrictionReasons: string[];
  maxPromptsPerSession: number | null;
  maxTokensPerSession: number | null;
  sessionTimeoutMinutes: number | null;
}

export interface TenantCollaborationSettings {
  tenantId: string;
  guestAccessEnabled: boolean;
  guestPromptExecutionEnabled: boolean;
  guestFileUploadEnabled: boolean;
  guestFileDownloadEnabled: boolean;
  complianceAutoRestrict: boolean;
  complianceRestrictedFeatures: string[];
  guestCostAttribution: CostAttributionMode;
  crossTenantGuestEnabled: boolean;
  crossTenantCostSplitEnabled: boolean;
  crossTenantCostSplitPercent: number;
  guestMaxPromptsPerSession: number | null;
  guestMaxTokensPerSession: number | null;
  guestSessionTimeoutMinutes: number | null;
  notifyGuestOnRestriction: boolean;
  restrictionMessage: string;
}

export interface CostAttributionResult {
  attributedToUserId: string;
  attributionType: CostAttributionMode | 'cross_tenant_split';
  splitPercent?: number;
  hostTenantCost?: number;
  guestTenantCost?: number;
  guestTenantId?: string;
}

export interface ComplianceCheckResult {
  allowed: boolean;
  restrictions: string[];
  activeComplianceLicenses: string[];
  requiresAcknowledgment: boolean;
  notificationMessage: string | null;
}

export interface GuestUsageSummary {
  guestId: string;
  sessionId: string;
  promptsExecuted: number;
  tokensConsumed: number;
  costIncurred: number;
  limitReached: boolean;
  limitType: 'prompts' | 'tokens' | null;
}

// ---------------------------------------------------------------------------
// Default settings (used when no tenant_collaboration_settings row exists)
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: Omit<TenantCollaborationSettings, 'tenantId'> = {
  guestAccessEnabled: true,
  guestPromptExecutionEnabled: false,
  guestFileUploadEnabled: false,
  guestFileDownloadEnabled: true,
  complianceAutoRestrict: true,
  complianceRestrictedFeatures: ['prompt_execution', 'file_upload', 'file_download', 'branch_create', 'roundtable_join'],
  guestCostAttribution: 'inviting_user',
  crossTenantGuestEnabled: true,
  crossTenantCostSplitEnabled: false,
  crossTenantCostSplitPercent: 50,
  guestMaxPromptsPerSession: 20,
  guestMaxTokensPerSession: 50000,
  guestSessionTimeoutMinutes: 120,
  notifyGuestOnRestriction: true,
  restrictionMessage: 'Some features are restricted by your organization\'s compliance policies.',
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CollaborationPolicyService {
  constructor(private pool: Pool) {}

  // =========================================================================
  // 1. TENANT SETTINGS
  // =========================================================================

  async getSettings(tenantId: string): Promise<TenantCollaborationSettings> {
    const result = await this.pool.query(
      `SELECT * FROM tenant_collaboration_settings WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return { tenantId, ...DEFAULT_SETTINGS };
    }

    return this.mapSettings(result.rows[0]);
  }

  async upsertSettings(
    tenantId: string,
    updates: Partial<Omit<TenantCollaborationSettings, 'tenantId'>>
  ): Promise<TenantCollaborationSettings> {
    const current = await this.getSettings(tenantId);
    const merged = { ...current, ...updates, tenantId };

    const result = await this.pool.query(
      `INSERT INTO tenant_collaboration_settings (
        tenant_id, guest_access_enabled, guest_prompt_execution_enabled,
        guest_file_upload_enabled, guest_file_download_enabled,
        compliance_auto_restrict, compliance_restricted_features,
        guest_cost_attribution, cross_tenant_guest_enabled,
        cross_tenant_cost_split_enabled, cross_tenant_cost_split_percent,
        guest_max_prompts_per_session, guest_max_tokens_per_session,
        guest_session_timeout_minutes, notify_guest_on_restriction,
        restriction_message, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        guest_access_enabled = EXCLUDED.guest_access_enabled,
        guest_prompt_execution_enabled = EXCLUDED.guest_prompt_execution_enabled,
        guest_file_upload_enabled = EXCLUDED.guest_file_upload_enabled,
        guest_file_download_enabled = EXCLUDED.guest_file_download_enabled,
        compliance_auto_restrict = EXCLUDED.compliance_auto_restrict,
        compliance_restricted_features = EXCLUDED.compliance_restricted_features,
        guest_cost_attribution = EXCLUDED.guest_cost_attribution,
        cross_tenant_guest_enabled = EXCLUDED.cross_tenant_guest_enabled,
        cross_tenant_cost_split_enabled = EXCLUDED.cross_tenant_cost_split_enabled,
        cross_tenant_cost_split_percent = EXCLUDED.cross_tenant_cost_split_percent,
        guest_max_prompts_per_session = EXCLUDED.guest_max_prompts_per_session,
        guest_max_tokens_per_session = EXCLUDED.guest_max_tokens_per_session,
        guest_session_timeout_minutes = EXCLUDED.guest_session_timeout_minutes,
        notify_guest_on_restriction = EXCLUDED.notify_guest_on_restriction,
        restriction_message = EXCLUDED.restriction_message,
        updated_at = NOW()
      RETURNING *`,
      [
        merged.tenantId,
        merged.guestAccessEnabled,
        merged.guestPromptExecutionEnabled,
        merged.guestFileUploadEnabled,
        merged.guestFileDownloadEnabled,
        merged.complianceAutoRestrict,
        JSON.stringify(merged.complianceRestrictedFeatures),
        merged.guestCostAttribution,
        merged.crossTenantGuestEnabled,
        merged.crossTenantCostSplitEnabled,
        merged.crossTenantCostSplitPercent,
        merged.guestMaxPromptsPerSession,
        merged.guestMaxTokensPerSession,
        merged.guestSessionTimeoutMinutes,
        merged.notifyGuestOnRestriction,
        merged.restrictionMessage,
      ]
    );

    return this.mapSettings(result.rows[0]);
  }

  // =========================================================================
  // 2. COMPLIANCE CHECK (before creating guest invite)
  // =========================================================================

  async checkComplianceForGuestInvite(tenantId: string): Promise<ComplianceCheckResult> {
    const settings = await this.getSettings(tenantId);

    // Check if guest access is enabled at all
    if (!settings.guestAccessEnabled) {
      return {
        allowed: false,
        restrictions: ['Guest access is disabled for this organization.'],
        activeComplianceLicenses: [],
        requiresAcknowledgment: false,
        notificationMessage: 'Guest collaboration is not available. Contact your administrator.',
      };
    }

    // Find active compliance licenses
    const licenseResult = await this.pool.query(
      `SELECT license_key FROM tenant_licenses
       WHERE tenant_id = $1 AND license_type = 'compliance' AND status = 'active'`,
      [tenantId]
    );
    const activeComplianceLicenses = licenseResult.rows.map((r: { license_key: string }) => r.license_key);

    // If no compliance licenses, allow freely
    if (activeComplianceLicenses.length === 0) {
      return {
        allowed: true,
        restrictions: [],
        activeComplianceLicenses: [],
        requiresAcknowledgment: false,
        notificationMessage: null,
      };
    }

    // Compliance licenses exist — determine restrictions
    const restrictions: string[] = [];

    if (settings.complianceAutoRestrict) {
      if (settings.complianceRestrictedFeatures.includes('prompt_execution')) {
        restrictions.push('Guests cannot execute AI prompts (compliance policy).');
      }
      if (settings.complianceRestrictedFeatures.includes('file_upload')) {
        restrictions.push('Guests cannot upload files (compliance policy).');
      }
      if (settings.complianceRestrictedFeatures.includes('file_download')) {
        restrictions.push('Guests cannot download files (compliance policy).');
      }
    }

    // HIPAA-specific: always require acknowledgment
    const isHipaa = activeComplianceLicenses.some(
      (l: string) => l.startsWith('hipaa')
    );
    const isGdpr = activeComplianceLicenses.includes('gdpr');

    let notificationMessage: string | null = null;
    if (isHipaa) {
      notificationMessage =
        'This organization operates under HIPAA compliance. Guest participants ' +
        'will have restricted access. Protected Health Information (PHI) must not ' +
        'be shared in guest-accessible sessions.';
    } else if (isGdpr) {
      notificationMessage =
        'This organization operates under GDPR compliance. Guest data will be ' +
        'processed in accordance with data protection regulations. Guests will be ' +
        'informed of applicable restrictions.';
    } else if (restrictions.length > 0) {
      notificationMessage = settings.restrictionMessage;
    }

    return {
      allowed: true,
      restrictions,
      activeComplianceLicenses,
      requiresAcknowledgment: isHipaa || isGdpr,
      notificationMessage,
    };
  }

  // =========================================================================
  // 3. RESOLVE GUEST CAPABILITIES
  // =========================================================================

  async resolveCapabilities(
    tenantId: string,
    permission: GuestPermission
  ): Promise<GuestCapabilities> {
    const settings = await this.getSettings(tenantId);

    // Master switch
    if (!settings.guestAccessEnabled) {
      return {
        canView: false,
        canComment: false,
        canEdit: false,
        canExecutePrompts: false,
        canUploadFiles: false,
        canDownloadFiles: false,
        canCreateBranch: false,
        canJoinRoundtable: false,
        complianceRestricted: true,
        restrictionReasons: ['Guest access is disabled for this organization.'],
        maxPromptsPerSession: null,
        maxTokensPerSession: null,
        sessionTimeoutMinutes: null,
      };
    }

    // Base capabilities from permission level
    const capabilities: GuestCapabilities = {
      canView: true,
      canComment: permission === 'commenter' || permission === 'editor',
      canEdit: permission === 'editor',
      canExecutePrompts: false,
      canUploadFiles: false,
      canDownloadFiles: settings.guestFileDownloadEnabled,
      canCreateBranch: permission === 'editor',
      canJoinRoundtable: permission === 'commenter' || permission === 'editor',
      complianceRestricted: false,
      restrictionReasons: [],
      maxPromptsPerSession: settings.guestMaxPromptsPerSession,
      maxTokensPerSession: settings.guestMaxTokensPerSession,
      sessionTimeoutMinutes: settings.guestSessionTimeoutMinutes,
    };

    // Prompt execution: ONLY editors AND only if tenant explicitly allows
    if (permission === 'editor' && settings.guestPromptExecutionEnabled) {
      capabilities.canExecutePrompts = true;
    }

    // File upload: ONLY editors AND only if tenant allows
    if (permission === 'editor' && settings.guestFileUploadEnabled) {
      capabilities.canUploadFiles = true;
    }

    // Compliance override
    const complianceCheck = await this.checkComplianceForGuestInvite(tenantId);
    if (complianceCheck.activeComplianceLicenses.length > 0 && settings.complianceAutoRestrict) {
      const restricted = settings.complianceRestrictedFeatures;

      if (restricted.includes('prompt_execution')) capabilities.canExecutePrompts = false;
      if (restricted.includes('file_upload')) capabilities.canUploadFiles = false;
      if (restricted.includes('file_download')) capabilities.canDownloadFiles = false;
      if (restricted.includes('branch_create')) capabilities.canCreateBranch = false;
      if (restricted.includes('roundtable_join')) capabilities.canJoinRoundtable = false;

      capabilities.complianceRestricted = true;
      capabilities.restrictionReasons = complianceCheck.restrictions;
    }

    return capabilities;
  }

  // =========================================================================
  // 4. COST ATTRIBUTION
  // =========================================================================

  async resolveCostAttribution(
    tenantId: string,
    guestId: string,
    sessionId: string
  ): Promise<CostAttributionResult> {
    const settings = await this.getSettings(tenantId);

    // Look up the guest to find inviting user and potential linked tenant
    const guestResult = await this.pool.query(
      `SELECT g.*, i.created_by AS inviting_user_id, i.id AS invite_id
       FROM collaboration_guests g
       JOIN collaboration_guest_invites i ON g.invite_id = i.id
       WHERE g.id = $1 AND g.session_id = $2`,
      [guestId, sessionId]
    );

    if (guestResult.rows.length === 0) {
      throw new Error(`Guest ${guestId} not found in session ${sessionId}`);
    }

    const guest = guestResult.rows[0];
    const invitingUserId: string = guest.inviting_user_id;
    const linkedTenantId: string | null = guest.linked_tenant_id;

    // Cross-tenant split: if guest is from another tenant and splitting is enabled
    if (linkedTenantId && linkedTenantId !== tenantId && settings.crossTenantCostSplitEnabled) {
      return {
        attributedToUserId: invitingUserId,
        attributionType: 'cross_tenant_split',
        splitPercent: settings.crossTenantCostSplitPercent,
        guestTenantId: linkedTenantId,
      };
    }

    // Standard attribution based on tenant setting
    switch (settings.guestCostAttribution) {
      case 'session_owner': {
        const sessionResult = await this.pool.query(
          `SELECT owner_id FROM collaborative_sessions WHERE id = $1`,
          [sessionId]
        );
        return {
          attributedToUserId: sessionResult.rows[0]?.owner_id ?? invitingUserId,
          attributionType: 'session_owner',
        };
      }

      case 'tenant_pool': {
        // Attribute to the inviting user for tracking, but mark as pool
        return {
          attributedToUserId: invitingUserId,
          attributionType: 'tenant_pool',
        };
      }

      case 'inviting_user':
      default: {
        return {
          attributedToUserId: invitingUserId,
          attributionType: 'inviting_user',
        };
      }
    }
  }

  async recordGuestUsage(
    guestId: string,
    sessionId: string,
    tenantId: string,
    attribution: CostAttributionResult,
    usage: {
      modelId: string;
      inputTokens: number;
      outputTokens: number;
      providerCost: number;
      billedCost: number;
      requestId?: string;
      requestType?: string;
      latencyMs?: number;
    }
  ): Promise<void> {
    const totalTokens = usage.inputTokens + usage.outputTokens;

    // Calculate split costs for cross-tenant
    let hostTenantCost: number | null = null;
    let guestTenantCost: number | null = null;
    if (attribution.attributionType === 'cross_tenant_split' && attribution.splitPercent != null) {
      hostTenantCost = usage.billedCost * (attribution.splitPercent / 100);
      guestTenantCost = usage.billedCost - hostTenantCost;
    }

    // Insert into attribution log
    await this.pool.query(
      `INSERT INTO guest_cost_attribution_log (
        guest_id, session_id, tenant_id, attributed_to_user_id, attribution_type,
        model_id, input_tokens, output_tokens, total_tokens,
        provider_cost, billed_cost, split_percent,
        host_tenant_cost, guest_tenant_cost, guest_tenant_id,
        request_id, request_type, latency_ms
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        guestId, sessionId, tenantId, attribution.attributedToUserId, attribution.attributionType,
        usage.modelId, usage.inputTokens, usage.outputTokens, totalTokens,
        usage.providerCost, usage.billedCost, attribution.splitPercent ?? null,
        hostTenantCost, guestTenantCost, attribution.guestTenantId ?? null,
        usage.requestId ?? null, usage.requestType ?? 'chat', usage.latencyMs ?? null,
      ]
    );

    // Update running totals on the guest record
    await this.pool.query(
      `UPDATE collaboration_guests
       SET prompts_executed = prompts_executed + 1,
           tokens_consumed = tokens_consumed + $1,
           cost_incurred = cost_incurred + $2,
           updated_at = NOW()
       WHERE id = $3`,
      [totalTokens, usage.billedCost, guestId]
    );
  }

  // =========================================================================
  // 5. USAGE LIMIT CHECK
  // =========================================================================

  async checkGuestUsageLimits(
    guestId: string,
    sessionId: string,
    tenantId: string
  ): Promise<GuestUsageSummary> {
    const settings = await this.getSettings(tenantId);

    const guestResult = await this.pool.query(
      `SELECT prompts_executed, tokens_consumed, cost_incurred
       FROM collaboration_guests WHERE id = $1 AND session_id = $2`,
      [guestId, sessionId]
    );

    if (guestResult.rows.length === 0) {
      throw new Error(`Guest ${guestId} not found in session ${sessionId}`);
    }

    const guest = guestResult.rows[0];
    const promptsExecuted = guest.prompts_executed as number;
    const tokensConsumed = guest.tokens_consumed as number;
    const costIncurred = parseFloat(guest.cost_incurred as string) || 0;

    let limitReached = false;
    let limitType: 'prompts' | 'tokens' | null = null;

    if (settings.guestMaxPromptsPerSession != null && promptsExecuted >= settings.guestMaxPromptsPerSession) {
      limitReached = true;
      limitType = 'prompts';
    }

    if (settings.guestMaxTokensPerSession != null && tokensConsumed >= settings.guestMaxTokensPerSession) {
      limitReached = true;
      limitType = 'tokens';
    }

    return {
      guestId,
      sessionId,
      promptsExecuted,
      tokensConsumed,
      costIncurred,
      limitReached,
      limitType,
    };
  }

  // =========================================================================
  // 6. RESTRICTION LOGGING
  // =========================================================================

  async logRestriction(
    tenantId: string,
    sessionId: string,
    guestId: string | null,
    feature: string,
    reason: string,
    complianceLicenses: string[],
    notificationMessage: string | null
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO guest_compliance_restriction_log (
        tenant_id, session_id, guest_id, restricted_feature,
        restriction_reason, compliance_licenses,
        guest_notified, notification_message
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        tenantId, sessionId, guestId, feature,
        reason, JSON.stringify(complianceLicenses),
        notificationMessage != null, notificationMessage,
      ]
    );
  }

  // =========================================================================
  // 7. BUILD GUEST RESTRICTION NOTIFICATION
  // =========================================================================

  buildRestrictionNotification(
    capabilities: GuestCapabilities,
    settings: TenantCollaborationSettings
  ): { show: boolean; title: string; message: string; restrictions: string[] } | null {
    if (!capabilities.complianceRestricted && capabilities.canExecutePrompts) {
      return null;
    }

    const restrictions: string[] = [];

    if (!capabilities.canExecutePrompts) {
      restrictions.push('AI prompt execution is not available in this session.');
    }
    if (!capabilities.canUploadFiles) {
      restrictions.push('File uploads are not available in this session.');
    }
    if (!capabilities.canDownloadFiles) {
      restrictions.push('File downloads are not available in this session.');
    }
    if (!capabilities.canCreateBranch) {
      restrictions.push('Creating conversation branches is not available.');
    }

    if (restrictions.length === 0) return null;

    return {
      show: settings.notifyGuestOnRestriction,
      title: capabilities.complianceRestricted
        ? 'Compliance Policy Restrictions'
        : 'Guest Access Restrictions',
      message: settings.restrictionMessage,
      restrictions,
    };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private mapSettings(row: Record<string, unknown>): TenantCollaborationSettings {
    return {
      tenantId: row.tenant_id as string,
      guestAccessEnabled: row.guest_access_enabled as boolean,
      guestPromptExecutionEnabled: row.guest_prompt_execution_enabled as boolean,
      guestFileUploadEnabled: row.guest_file_upload_enabled as boolean,
      guestFileDownloadEnabled: row.guest_file_download_enabled as boolean,
      complianceAutoRestrict: row.compliance_auto_restrict as boolean,
      complianceRestrictedFeatures: (row.compliance_restricted_features as string[]) || [],
      guestCostAttribution: row.guest_cost_attribution as CostAttributionMode,
      crossTenantGuestEnabled: row.cross_tenant_guest_enabled as boolean,
      crossTenantCostSplitEnabled: row.cross_tenant_cost_split_enabled as boolean,
      crossTenantCostSplitPercent: row.cross_tenant_cost_split_percent as number,
      guestMaxPromptsPerSession: row.guest_max_prompts_per_session as number | null,
      guestMaxTokensPerSession: row.guest_max_tokens_per_session as number | null,
      guestSessionTimeoutMinutes: row.guest_session_timeout_minutes as number | null,
      notifyGuestOnRestriction: row.notify_guest_on_restriction as boolean,
      restrictionMessage: row.restriction_message as string,
    };
  }
}
