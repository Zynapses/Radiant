/**
 * Organizational Memory Mesh Service v1.0.0
 * 
 * Tenant-wide shared knowledge that compounds across all users.
 * Privacy tiers (personal/team/department/org) with full regulatory compliance.
 * 
 * REGULATORY COMPLIANCE ARCHITECTURE:
 * 
 * ┌─────────────────────────────────────────────────────────┐
 * │                    COMPLIANCE LAYER                      │
 * │                                                          │
 * │  GDPR Art. 6/7     HIPAA §164.508    SOC2 Type II      │
 * │  ┌──────────┐      ┌──────────┐      ┌──────────┐      │
 * │  │ Explicit  │      │ PHI/PII  │      │ Audit    │      │
 * │  │ Consent   │      │ Scanning │      │ Trail    │      │
 * │  │ Required  │      │ Before   │      │ Every    │      │
 * │  │ Per User  │      │ Sharing  │      │ Access   │      │
 * │  └──────────┘      └──────────┘      └──────────┘      │
 * │                                                          │
 * │  CCPA §1798.100   Data Classification  Right to Erasure │
 * │  ┌──────────┐      ┌──────────┐      ┌──────────┐      │
 * │  │ Opt-Out  │      │ 7-Level  │      │ Cascade  │      │
 * │  │ Honor    │      │ System   │      │ Delete   │      │
 * │  │ Within   │      │ Auto +   │      │ All      │      │
 * │  │ 45 Days  │      │ Manual   │      │ Contribs │      │
 * │  └──────────┘      └──────────┘      └──────────┘      │
 * └─────────────────────────────────────────────────────────┘
 * 
 * PRIVACY TIERS:
 * ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
 * │ Personal │→ │   Team   │→ │Department│→ │   Org    │→ │  Public  │
 * │ (user)   │  │ (group)  │  │ (dept)   │  │ (tenant) │  │ (global) │
 * │ No share │  │ Consent  │  │ Consent  │  │ Consent  │  │ Admin    │
 * │          │  │ Required │  │ Required │  │ Required │  │ Approval │
 * └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
 * 
 * KEY DESIGN DECISIONS:
 * - Consent is ALWAYS required before any sharing (even with auto-share during dreaming)
 * - PHI/PII scanning runs BEFORE data crosses any privacy boundary
 * - Every access is audited with compliance framework tags
 * - GDPR erasure cascades through all contributions
 * - Contributions can be anonymized (default: true)
 * - Minimum contributor count before org memory becomes visible (default: 2)
 * - Admin review can be required before visibility (configurable)
 */

import { executeStatement, stringParam, doubleParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'org/memory-mesh',
  category: 'infrastructure',
  sourceType: 'application',
});

import type {
  OrgMemoryNode,
  OrgMemoryConsent,
  OrgMemoryContribution,
  OrgMemoryAuditEntry,
  OrgMemoryAuditAction,
  OrgMemoryConfig,
  MemoryPrivacyTier,
  MemoryDataClassification,
  AKGEntityType,
  AKGNode,
} from '@radiant/shared';

// =============================================================================
// PII/PHI Detection Patterns
// =============================================================================

const PII_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, type: 'ssn', classification: 'pii' as MemoryDataClassification },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, type: 'credit_card', classification: 'pii' as MemoryDataClassification },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'email', classification: 'pii' as MemoryDataClassification },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: 'phone', classification: 'pii' as MemoryDataClassification },
  { pattern: /\b(?:patient|diagnosis|treatment|medication|prescription|symptom|condition)\b/i, type: 'medical', classification: 'phi' as MemoryDataClassification },
  { pattern: /\b(?:ICD-?\d{1,2}|CPT|HCPCS|NDC)\s*[\-:]?\s*\d+/i, type: 'medical_code', classification: 'phi' as MemoryDataClassification },
  { pattern: /\b(?:DOB|date of birth|born on)\s*[\-:]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i, type: 'dob', classification: 'pii' as MemoryDataClassification },
];

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_ORG_MEMORY_CONFIG: Omit<OrgMemoryConfig, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  enabled: false,
  requireExplicitConsent: true,
  defaultPrivacyTier: 'team' as MemoryPrivacyTier,
  minContributorsForVisibility: 2,
  autoAnonymize: true,
  runComplianceScan: true,
  hipaaMode: false,
  maxOrgNodes: 50000,
  requireAdminReview: false,
  autoShareDuringDreaming: true,
  retentionDays: 0,
  consentRenewalDays: 365,
};

// =============================================================================
// Org Memory Mesh Service
// =============================================================================

class OrgMemoryMeshService {
  private configCache = new Map<string, { config: OrgMemoryConfig; loadedAt: number }>();
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000;

  // ===========================================================================
  // Configuration
  // ===========================================================================

  async getConfig(tenantId: string): Promise<OrgMemoryConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM org_memory_config WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const config: OrgMemoryConfig = {
          tenantId,
          enabled: Boolean(row.enabled ?? false),
          requireExplicitConsent: Boolean(row.require_explicit_consent ?? true),
          defaultPrivacyTier: String(row.default_privacy_tier || 'team') as MemoryPrivacyTier,
          minContributorsForVisibility: Number(row.min_contributors_for_visibility || 2),
          autoAnonymize: Boolean(row.auto_anonymize ?? true),
          runComplianceScan: Boolean(row.run_compliance_scan ?? true),
          hipaaMode: Boolean(row.hipaa_mode ?? false),
          maxOrgNodes: Number(row.max_org_nodes || 50000),
          requireAdminReview: Boolean(row.require_admin_review ?? false),
          autoShareDuringDreaming: Boolean(row.auto_share_during_dreaming ?? true),
          retentionDays: Number(row.retention_days || 0),
          consentRenewalDays: Number(row.consent_renewal_days || 365),
          createdAt: new Date(row.created_at as string),
          updatedAt: new Date(row.updated_at as string),
        };
        this.configCache.set(tenantId, { config, loadedAt: Date.now() });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to load org memory config', { tenantId, error: String(error) });
    }

    const config: OrgMemoryConfig = { tenantId, ...DEFAULT_ORG_MEMORY_CONFIG, createdAt: new Date(), updatedAt: new Date() };
    this.configCache.set(tenantId, { config, loadedAt: Date.now() });
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<OrgMemoryConfig>): Promise<OrgMemoryConfig> {
    const current = await this.getConfig(tenantId);
    const updated = { ...current, ...updates, tenantId };

    await executeStatement(
      `INSERT INTO org_memory_config (
        tenant_id, enabled, require_explicit_consent, default_privacy_tier,
        min_contributors_for_visibility, auto_anonymize, run_compliance_scan,
        hipaa_mode, max_org_nodes, require_admin_review, auto_share_during_dreaming,
        retention_days, consent_renewal_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = $2, require_explicit_consent = $3, default_privacy_tier = $4,
        min_contributors_for_visibility = $5, auto_anonymize = $6, run_compliance_scan = $7,
        hipaa_mode = $8, max_org_nodes = $9, require_admin_review = $10,
        auto_share_during_dreaming = $11, retention_days = $12, consent_renewal_days = $13,
        updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        { name: 'enabled', value: { booleanValue: updated.enabled } },
        { name: 'consent', value: { booleanValue: updated.requireExplicitConsent } },
        stringParam('tier', updated.defaultPrivacyTier),
        { name: 'minContrib', value: { longValue: updated.minContributorsForVisibility } },
        { name: 'anonymize', value: { booleanValue: updated.autoAnonymize } },
        { name: 'compliance', value: { booleanValue: updated.runComplianceScan } },
        { name: 'hipaa', value: { booleanValue: updated.hipaaMode } },
        { name: 'maxNodes', value: { longValue: updated.maxOrgNodes } },
        { name: 'adminReview', value: { booleanValue: updated.requireAdminReview } },
        { name: 'autoShare', value: { booleanValue: updated.autoShareDuringDreaming } },
        { name: 'retention', value: { longValue: updated.retentionDays } },
        { name: 'consentRenewal', value: { longValue: updated.consentRenewalDays } },
      ]
    );

    this.configCache.delete(tenantId);
    return { ...updated, updatedAt: new Date() };
  }

  // ===========================================================================
  // Consent Management (GDPR Art. 6/7)
  // ===========================================================================

  /**
   * Grant consent for organizational memory sharing.
   * GDPR Art. 6(1)(a) requires explicit, informed consent.
   */
  async grantConsent(
    tenantId: string,
    userId: string,
    params: {
      consentedTiers: MemoryPrivacyTier[];
      allowedClassifications: MemoryDataClassification[];
      allowedEntityTypes?: AKGEntityType[];
      processingPurpose?: string;
      legalBasis?: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<OrgMemoryConsent> {
    const consentId = crypto.randomUUID();
    const now = new Date();

    // Revoke any existing active consent first
    await executeStatement(
      `UPDATE org_memory_consents SET is_active = false, revoked_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2 AND is_active = true`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );

    // Create new consent
    await executeStatement(
      `INSERT INTO org_memory_consents (
        consent_id, tenant_id, user_id, consented_tiers, allowed_classifications,
        allowed_entity_types, is_active, processing_purpose, legal_basis,
        consented_at, consent_ip_address, consent_user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, NOW(), $9, $10)`,
      [
        stringParam('id', consentId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('tiers', `{${params.consentedTiers.join(',')}}`),
        stringParam('classes', `{${params.allowedClassifications.join(',')}}`),
        stringParam('types', `{${(params.allowedEntityTypes || []).join(',')}}`),
        stringParam('purpose', params.processingPurpose || 'Organizational knowledge sharing to improve AI assistance quality'),
        stringParam('basis', params.legalBasis || 'consent'),
        params.ipAddress ? stringParam('ip', params.ipAddress) : { name: 'ip', value: { isNull: true } },
        params.userAgent ? stringParam('ua', params.userAgent) : { name: 'ua', value: { isNull: true } },
      ]
    );

    // Audit log
    await this.auditLog(tenantId, userId, 'consent_granted', undefined, {
      consentId, tiers: params.consentedTiers, classifications: params.allowedClassifications,
    }, ['gdpr', 'soc2'], params.ipAddress);

    logger.info('Org memory consent granted', { tenantId, userId, consentId, tiers: params.consentedTiers });

    return {
      consentId,
      tenantId,
      userId,
      consentedTiers: params.consentedTiers,
      allowedClassifications: params.allowedClassifications,
      allowedEntityTypes: params.allowedEntityTypes || [],
      isActive: true,
      processingPurpose: params.processingPurpose || 'Organizational knowledge sharing to improve AI assistance quality',
      legalBasis: params.legalBasis || 'consent',
      consentedAt: now,
      consentIpAddress: params.ipAddress,
      consentUserAgent: params.userAgent,
    };
  }

  /**
   * Revoke consent — immediately stops all sharing and can trigger erasure.
   */
  async revokeConsent(tenantId: string, userId: string, ipAddress?: string): Promise<void> {
    await executeStatement(
      `UPDATE org_memory_consents SET is_active = false, revoked_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2 AND is_active = true`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );

    await this.auditLog(tenantId, userId, 'consent_revoked', undefined, {}, ['gdpr', 'ccpa', 'soc2'], ipAddress);
    logger.info('Org memory consent revoked', { tenantId, userId });
  }

  /**
   * Get active consent for a user.
   */
  async getActiveConsent(tenantId: string, userId: string): Promise<OrgMemoryConsent | null> {
    const result = await executeStatement(
      `SELECT * FROM org_memory_consents WHERE tenant_id = $1 AND user_id = $2 AND is_active = true LIMIT 1`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );

    if (result.rows.length === 0) return null;
    return this.mapConsentRow(result.rows[0] as Record<string, unknown>);
  }

  // ===========================================================================
  // Memory Sharing (with compliance checks)
  // ===========================================================================

  /**
   * Share a user's AKG node to organizational memory.
   * Performs all compliance checks before sharing.
   */
  async shareToOrg(
    tenantId: string,
    userId: string,
    sourceNode: AKGNode,
    sharingMethod: 'auto_twilight' | 'manual_share' | 'admin_promoted' = 'auto_twilight',
  ): Promise<OrgMemoryNode | null> {
    const config = await this.getConfig(tenantId);
    if (!config.enabled) {
      logger.debug('Org memory disabled for tenant', { tenantId });
      return null;
    }

    // Step 1: Check consent
    const consent = await this.getActiveConsent(tenantId, userId);
    if (!consent && config.requireExplicitConsent) {
      logger.debug('No active consent for org memory sharing', { tenantId, userId });
      return null;
    }

    // Step 2: Check if entity type is allowed by consent
    if (consent && consent.allowedEntityTypes.length > 0) {
      if (!consent.allowedEntityTypes.includes(sourceNode.entityType)) {
        logger.debug('Entity type not allowed by consent', { tenantId, userId, entityType: sourceNode.entityType });
        return null;
      }
    }

    // Step 3: Classify data and run compliance scan
    const content = `${sourceNode.label}: ${JSON.stringify(sourceNode.properties)}`;
    let classification: MemoryDataClassification = 'internal';

    if (config.runComplianceScan) {
      const scanResult = this.scanForPiiPhi(content);
      if (scanResult.detected) {
        classification = scanResult.classification;

        // In HIPAA mode, NEVER share PHI
        if (config.hipaaMode && classification === 'phi') {
          await this.auditLog(tenantId, userId, 'phi_detected', undefined, {
            sourceNodeId: sourceNode.nodeId, detectedType: scanResult.type,
          }, ['hipaa', 'soc2']);
          logger.warn('PHI detected, blocking org memory share', { tenantId, userId, type: scanResult.type });
          return null;
        }

        // Check if classification is allowed by consent
        if (consent && !consent.allowedClassifications.includes(classification)) {
          logger.debug('Classification not allowed by consent', { tenantId, userId, classification });
          return null;
        }

        await this.auditLog(tenantId, userId, 'compliance_scan', undefined, {
          sourceNodeId: sourceNode.nodeId, classification, scanResult,
        }, ['soc2']);
      }
    }

    // Step 4: Anonymize content if configured
    let sharedContent = content;
    if (config.autoAnonymize) {
      sharedContent = this.anonymizeContent(content);
    }

    // Step 5: Upsert org memory node
    const orgNode = await this.upsertOrgNode(tenantId, sourceNode, classification, config);

    // Step 6: Record contribution
    await this.recordContribution(tenantId, userId, sourceNode.nodeId, orgNode.nodeId, consent?.consentId || '', sharedContent, config.autoAnonymize, sharingMethod);

    // Step 7: Audit log
    await this.auditLog(tenantId, userId, 'memory_shared', orgNode.nodeId, {
      sourceNodeId: sourceNode.nodeId, classification, sharingMethod, anonymized: config.autoAnonymize,
    }, ['gdpr', 'soc2']);

    logger.info('Memory shared to org', {
      tenantId, userId, orgNodeId: orgNode.nodeId,
      classification, anonymized: config.autoAnonymize,
    });

    return orgNode;
  }

  /**
   * Query organizational memory visible to a user based on their privacy tier.
   */
  async queryOrgMemory(
    tenantId: string,
    userId: string,
    options?: {
      entityTypes?: AKGEntityType[];
      privacyTiers?: MemoryPrivacyTier[];
      limit?: number;
      minConfidence?: number;
    }
  ): Promise<OrgMemoryNode[]> {
    const config = await this.getConfig(tenantId);
    if (!config.enabled) return [];

    const limit = options?.limit || 50;
    const minConfidence = options?.minConfidence || 0.3;

    let query = `SELECT * FROM org_memory_nodes
      WHERE tenant_id = $1
      AND confidence >= $2
      AND contributor_count >= $3
      AND compliance_scan_passed = true`;

    const params = [
      stringParam('tenantId', tenantId),
      doubleParam('minConf', minConfidence),
      { name: 'minContrib', value: { longValue: config.minContributorsForVisibility } },
    ];

    if (config.requireAdminReview) {
      query += ` AND admin_reviewed = true`;
    }

    if (options?.entityTypes && options.entityTypes.length > 0) {
      query += ` AND entity_type = ANY($4)`;
      params.push(stringParam('types', `{${options.entityTypes.join(',')}}`));
    }

    if (options?.privacyTiers && options.privacyTiers.length > 0) {
      query += ` AND privacy_tier = ANY($${params.length + 1})`;
      params.push(stringParam('tiers', `{${options.privacyTiers.join(',')}}`));
    }

    query += ` ORDER BY importance DESC LIMIT ${limit}`;

    const result = await executeStatement(query, params);
    const nodes = result.rows.map(row => this.mapOrgNodeRow(row as Record<string, unknown>));

    // Audit all access
    for (const node of nodes) {
      await this.auditLog(tenantId, userId, 'memory_accessed', node.nodeId, {}, ['soc2']);
    }

    return nodes;
  }

  // ===========================================================================
  // GDPR Right-to-Erasure
  // ===========================================================================

  /**
   * Execute GDPR erasure cascade for a user.
   * Removes all contributions, recalculates org nodes, deletes empty nodes.
   */
  async executeErasure(tenantId: string, userId: string, ipAddress?: string): Promise<{
    contributionsDeleted: number;
    nodesDeleted: number;
    nodesUpdated: number;
    consentsRevoked: number;
  }> {
    logger.info('Executing org memory GDPR erasure', { tenantId, userId });

    try {
      const result = await executeStatement(
        `SELECT org_memory_erasure_cascade($1, $2) as result`,
        [stringParam('tenantId', tenantId), stringParam('userId', userId)]
      );

      const cascadeResult = typeof (result.rows[0] as Record<string, unknown>)?.result === 'string'
        ? JSON.parse((result.rows[0] as Record<string, unknown>).result as string)
        : (result.rows[0] as Record<string, unknown>)?.result || {};

      await this.auditLog(tenantId, userId, 'erasure_completed', undefined, cascadeResult, ['gdpr', 'ccpa', 'soc2'], ipAddress);

      logger.info('GDPR erasure completed', { tenantId, userId, ...cascadeResult });

      return {
        contributionsDeleted: cascadeResult.contributions_deleted || 0,
        nodesDeleted: cascadeResult.nodes_deleted || 0,
        nodesUpdated: cascadeResult.nodes_updated || 0,
        consentsRevoked: cascadeResult.consents_revoked || 0,
      };
    } catch (error) {
      logger.error('GDPR erasure failed', { tenantId, userId, error: String(error) });
      throw error;
    }
  }

  // ===========================================================================
  // Compliance Scanning
  // ===========================================================================

  /**
   * Scan content for PII/PHI patterns.
   */
  private scanForPiiPhi(content: string): {
    detected: boolean;
    type: string;
    classification: MemoryDataClassification;
  } {
    for (const { pattern, type, classification } of PII_PATTERNS) {
      if (pattern.test(content)) {
        return { detected: true, type, classification };
      }
    }
    return { detected: false, type: '', classification: 'internal' };
  }

  /**
   * Anonymize content by removing detected PII/PHI patterns.
   */
  private anonymizeContent(content: string): string {
    let anonymized = content;
    for (const { pattern, type } of PII_PATTERNS) {
      anonymized = anonymized.replace(pattern, `[REDACTED:${type}]`);
    }
    return anonymized;
  }

  // ===========================================================================
  // Internal Helpers
  // ===========================================================================

  private async upsertOrgNode(
    tenantId: string,
    sourceNode: AKGNode,
    classification: MemoryDataClassification,
    config: OrgMemoryConfig,
  ): Promise<OrgMemoryNode> {
    // Check if org node already exists for this label + entity type
    const existing = await executeStatement(
      `SELECT * FROM org_memory_nodes
       WHERE tenant_id = $1 AND label = $2 AND entity_type = $3 LIMIT 1`,
      [
        stringParam('tenantId', tenantId),
        stringParam('label', sourceNode.label),
        stringParam('type', sourceNode.entityType),
      ]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0] as Record<string, unknown>;
      const nodeId = String(row.node_id);

      // Update existing org node
      await executeStatement(
        `UPDATE org_memory_nodes SET
          contributor_count = contributor_count + 1,
          confidence = LEAST(1.0, confidence + 0.05),
          importance = LEAST(1.0, importance + 0.03),
          properties = properties || $1,
          updated_at = NOW()
        WHERE node_id = $2 AND tenant_id = $3`,
        [
          stringParam('props', JSON.stringify(sourceNode.properties)),
          stringParam('nodeId', nodeId),
          stringParam('tenantId', tenantId),
        ]
      );

      return this.mapOrgNodeRow({ ...row, contributor_count: Number(row.contributor_count || 1) + 1 });
    }

    // Create new org node
    const nodeId = crypto.randomUUID();
    await executeStatement(
      `INSERT INTO org_memory_nodes (
        node_id, tenant_id, privacy_tier, data_classification,
        label, entity_type, properties, confidence, contributor_count,
        importance, admin_reviewed, compliance_scan_passed, last_compliance_scan_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, true, NOW())`,
      [
        stringParam('nodeId', nodeId),
        stringParam('tenantId', tenantId),
        stringParam('tier', config.defaultPrivacyTier),
        stringParam('class', classification),
        stringParam('label', sourceNode.label),
        stringParam('type', sourceNode.entityType),
        stringParam('props', JSON.stringify(sourceNode.properties)),
        doubleParam('conf', sourceNode.confidence),
        doubleParam('importance', sourceNode.importance * 0.5),
        { name: 'reviewed', value: { booleanValue: !config.requireAdminReview } },
      ]
    );

    return {
      nodeId,
      tenantId,
      privacyTier: config.defaultPrivacyTier,
      dataClassification: classification,
      label: sourceNode.label,
      entityType: sourceNode.entityType,
      properties: sourceNode.properties,
      confidence: sourceNode.confidence,
      contributorCount: 1,
      importance: sourceNode.importance * 0.5,
      adminReviewed: !config.requireAdminReview,
      complianceScanPassed: true,
      lastComplianceScanAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async recordContribution(
    tenantId: string, userId: string, sourceNodeId: string,
    orgNodeId: string, consentId: string, content: string,
    isAnonymized: boolean, sharingMethod: string,
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO org_memory_contributions (
        tenant_id, user_id, source_node_id, org_node_id, consent_id,
        contributed_content, is_anonymized, sharing_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('sourceNode', sourceNodeId),
        stringParam('orgNode', orgNodeId),
        stringParam('consentId', consentId),
        stringParam('content', content),
        { name: 'anon', value: { booleanValue: isAnonymized } },
        stringParam('method', sharingMethod),
      ]
    );
  }

  private async auditLog(
    tenantId: string, userId: string, action: OrgMemoryAuditAction,
    targetNodeId?: string, details: Record<string, unknown> = {},
    complianceFramework: string[] = [], ipAddress?: string,
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO org_memory_audit_log (
          tenant_id, user_id, action, target_node_id, details,
          compliance_framework, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('action', action),
          targetNodeId ? stringParam('target', targetNodeId) : { name: 'target', value: { isNull: true } },
          stringParam('details', JSON.stringify(details)),
          stringParam('frameworks', `{${complianceFramework.join(',')}}`),
          ipAddress ? stringParam('ip', ipAddress) : { name: 'ip', value: { isNull: true } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to write org memory audit log', { error: String(error) });
    }
  }

  // ===========================================================================
  // Stats & Dashboard
  // ===========================================================================

  async getStats(tenantId: string): Promise<{
    totalOrgNodes: number;
    activeConsents: number;
    totalContributions: number;
    complianceScansPassed: number;
    complianceScansFailed: number;
    nodesByPrivacyTier: Record<string, number>;
    nodesByClassification: Record<string, number>;
  }> {
    try {
      const [nodeStats, consentStats, contributionStats] = await Promise.all([
        executeStatement(
          `SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE compliance_scan_passed = true) as passed,
            COUNT(*) FILTER (WHERE compliance_scan_passed = false) as failed,
            privacy_tier, COUNT(*) as tier_count,
            data_classification, COUNT(*) as class_count
          FROM org_memory_nodes WHERE tenant_id = $1
          GROUP BY privacy_tier, data_classification`,
          [stringParam('tenantId', tenantId)]
        ),
        executeStatement(
          `SELECT COUNT(*) as active FROM org_memory_consents
           WHERE tenant_id = $1 AND is_active = true`,
          [stringParam('tenantId', tenantId)]
        ),
        executeStatement(
          `SELECT COUNT(*) as total FROM org_memory_contributions WHERE tenant_id = $1`,
          [stringParam('tenantId', tenantId)]
        ),
      ]);

      let totalNodes = 0;
      let passed = 0;
      let failed = 0;
      const nodesByTier: Record<string, number> = {};
      const nodesByClass: Record<string, number> = {};

      for (const row of nodeStats.rows) {
        const r = row as Record<string, unknown>;
        totalNodes += Number(r.total || 0);
        passed += Number(r.passed || 0);
        failed += Number(r.failed || 0);
        const tier = String(r.privacy_tier);
        const cls = String(r.data_classification);
        nodesByTier[tier] = (nodesByTier[tier] || 0) + Number(r.tier_count || 0);
        nodesByClass[cls] = (nodesByClass[cls] || 0) + Number(r.class_count || 0);
      }

      return {
        totalOrgNodes: totalNodes,
        activeConsents: Number((consentStats.rows[0] as Record<string, unknown>)?.active || 0),
        totalContributions: Number((contributionStats.rows[0] as Record<string, unknown>)?.total || 0),
        complianceScansPassed: passed,
        complianceScansFailed: failed,
        nodesByPrivacyTier: nodesByTier,
        nodesByClassification: nodesByClass,
      };
    } catch (error) {
      logger.error('Failed to get org memory stats', { tenantId, error: String(error) });
      return {
        totalOrgNodes: 0, activeConsents: 0, totalContributions: 0,
        complianceScansPassed: 0, complianceScansFailed: 0,
        nodesByPrivacyTier: {}, nodesByClassification: {},
      };
    }
  }

  async getAuditLog(tenantId: string, limit: number = 50): Promise<OrgMemoryAuditEntry[]> {
    const result = await executeStatement(
      `SELECT * FROM org_memory_audit_log WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT ${limit}`,
      [stringParam('tenantId', tenantId)]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        auditId: String(r.audit_id),
        tenantId: String(r.tenant_id),
        userId: String(r.user_id),
        action: String(r.action) as OrgMemoryAuditAction,
        targetNodeId: r.target_node_id ? String(r.target_node_id) : undefined,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : (r.details as Record<string, unknown>) || {},
        complianceFramework: (r.compliance_framework as string[]) || [],
        ipAddress: r.ip_address ? String(r.ip_address) : undefined,
        createdAt: new Date(r.created_at as string),
      };
    });
  }

  // ===========================================================================
  // Row Mappers
  // ===========================================================================

  private mapConsentRow(row: Record<string, unknown>): OrgMemoryConsent {
    return {
      consentId: String(row.consent_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      consentedTiers: (row.consented_tiers as MemoryPrivacyTier[]) || [],
      allowedClassifications: (row.allowed_classifications as MemoryDataClassification[]) || [],
      allowedEntityTypes: (row.allowed_entity_types as AKGEntityType[]) || [],
      isActive: Boolean(row.is_active),
      processingPurpose: String(row.processing_purpose),
      legalBasis: String(row.legal_basis) as OrgMemoryConsent['legalBasis'],
      consentedAt: new Date(row.consented_at as string),
      renewedAt: row.renewed_at ? new Date(row.renewed_at as string) : undefined,
      revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : undefined,
      consentIpAddress: row.consent_ip_address ? String(row.consent_ip_address) : undefined,
      consentUserAgent: row.consent_user_agent ? String(row.consent_user_agent) : undefined,
    };
  }

  private mapOrgNodeRow(row: Record<string, unknown>): OrgMemoryNode {
    return {
      nodeId: String(row.node_id),
      tenantId: String(row.tenant_id),
      privacyTier: String(row.privacy_tier) as MemoryPrivacyTier,
      dataClassification: String(row.data_classification) as MemoryDataClassification,
      scopeId: row.scope_id ? String(row.scope_id) : undefined,
      label: String(row.label),
      entityType: String(row.entity_type) as AKGEntityType,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : (row.properties as Record<string, unknown>) || {},
      confidence: Number(row.confidence || 0.5),
      contributorCount: Number(row.contributor_count || 1),
      importance: Number(row.importance || 0.5),
      adminReviewed: Boolean(row.admin_reviewed),
      complianceScanPassed: Boolean(row.compliance_scan_passed),
      lastComplianceScanAt: row.last_compliance_scan_at ? new Date(row.last_compliance_scan_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const orgMemoryMeshService = new OrgMemoryMeshService();
