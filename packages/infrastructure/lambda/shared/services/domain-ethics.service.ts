// RADIANT v4.18.0 - Domain Ethics Service
// Enforces domain-specific professional ethics (bar association, medical, financial, etc.)

import { executeStatement } from '../db/client';
import type {
  DomainEthicsFramework,
  DomainEthicsCheck,
  DomainEthicsConfig,
  EthicsViolation,
  EthicsWarning,
  EthicsProhibition,
  DomainEthicsAuditLog,
  DomainEthicsStats,
} from '@radiant/shared';
import {
  DOMAIN_ETHICS_REGISTRY,
  getEthicsFrameworkByDomain,
  getActiveFrameworks,
} from '@radiant/shared';

// ============================================================================
// Types
// ============================================================================

interface CheckEthicsInput {
  tenantId: string;
  userId: string;
  sessionId: string;
  promptId: string;
  domain: string;
  subspecialty?: string;
  content: string;
  context?: Record<string, unknown>;
}

interface FrameworkOverride {
  frameworkId: string;
  enabled: boolean;
  customDisclaimers?: string[];
  enforcementLevel?: 'strict' | 'standard' | 'advisory';
}

// ============================================================================
// Domain Ethics Service
// ============================================================================

class DomainEthicsService {
  
  // ============================================================================
  // Ethics Check - Core Function
  // ============================================================================
  
  /**
   * Check content against domain-specific ethics frameworks
   */
  async checkDomainEthics(input: CheckEthicsInput): Promise<DomainEthicsCheck> {
    const startTime = Date.now();
    
    // Get tenant config
    const config = await this.getTenantConfig(input.tenantId);
    
    // If domain ethics disabled for tenant, pass through
    if (!config.enableDomainEthics || config.enforcementMode === 'disabled') {
      return this.createPassingCheck(input.domain, startTime);
    }
    
    // Get applicable frameworks
    const frameworks = await this.getApplicableFrameworks(
      input.domain,
      input.subspecialty,
      config
    );
    
    if (frameworks.length === 0) {
      return this.createPassingCheck(input.domain, startTime);
    }
    
    // Check content against each framework
    const violations: EthicsViolation[] = [];
    const warnings: EthicsWarning[] = [];
    const requiredDisclosures: string[] = [];
    const requiredModifications: string[] = [];
    let prefixText = '';
    let suffixText = '';
    
    for (const framework of frameworks) {
      // Check prohibitions
      for (const prohibition of framework.prohibitions) {
        const violation = this.checkProhibition(input.content, prohibition, framework);
        if (violation) {
          violations.push(violation);
          
          if (prohibition.actionOnViolation === 'modify' && prohibition.alternativeGuidance) {
            requiredModifications.push(prohibition.alternativeGuidance);
          }
        }
      }
      
      // Check disclosure requirements
      for (const disclosure of framework.disclosureRequirements) {
        if (this.shouldApplyDisclosure(input.content, disclosure.triggerConditions)) {
          if (disclosure.isRequired) {
            requiredDisclosures.push(disclosure.disclosureText);
            
            if (disclosure.placement === 'before') {
              prefixText += disclosure.disclosureText + '\n\n';
            } else {
              suffixText += '\n\n' + disclosure.disclosureText;
            }
          }
        }
      }
      
      // Add mandatory disclaimers
      for (const disclaimer of framework.requiredDisclaimers) {
        if (!suffixText.includes(disclaimer)) {
          requiredDisclosures.push(disclaimer);
        }
      }
      
      // Check principles for warnings
      for (const principle of framework.principles) {
        const warning = this.checkPrincipleWarning(input.content, principle, framework);
        if (warning) {
          warnings.push(warning);
        }
      }
    }
    
    // Calculate score
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const majorViolations = violations.filter(v => v.severity === 'major').length;
    const minorViolations = violations.filter(v => v.severity === 'minor').length;
    
    let score = 100;
    score -= criticalViolations * 30;
    score -= majorViolations * 15;
    score -= minorViolations * 5;
    score = Math.max(0, score);
    
    // Determine if passed based on enforcement level
    const effectiveEnforcement = config.enforcementMode;
    let passed = true;
    
    if (effectiveEnforcement === 'strict') {
      passed = criticalViolations === 0 && majorViolations === 0;
    } else if (effectiveEnforcement === 'standard') {
      passed = criticalViolations === 0;
    }
    // Advisory mode always passes but with warnings
    
    // Build combined suffix with all disclaimers
    if (requiredDisclosures.length > 0 && !suffixText) {
      suffixText = '\n\n---\n' + requiredDisclosures.join('\n');
    }
    
    const check: DomainEthicsCheck = {
      domain: input.domain,
      subspecialty: input.subspecialty,
      frameworksApplied: frameworks.map(f => f.frameworkCode),
      passed,
      score,
      violations,
      warnings,
      requiredDisclosures,
      requiredModifications,
      prefixText: prefixText || undefined,
      suffixText: suffixText || undefined,
      checkDurationMs: Date.now() - startTime,
      checkedAt: new Date(),
    };
    
    // Log the check if configured
    if (config.logAllChecks || (config.logViolationsOnly && violations.length > 0)) {
      await this.logCheck(input, check);
    }
    
    return check;
  }
  
  /**
   * Check a specific prohibition against content
   */
  private checkProhibition(
    content: string,
    prohibition: EthicsProhibition,
    framework: DomainEthicsFramework
  ): EthicsViolation | null {
    const lowerContent = content.toLowerCase();
    
    for (const keyword of prohibition.triggerKeywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        return {
          frameworkId: framework.id,
          frameworkCode: framework.frameworkCode,
          prohibitionId: prohibition.id,
          title: prohibition.title,
          description: prohibition.description,
          severity: prohibition.severity,
          action: prohibition.actionOnViolation,
          matchedContent: keyword,
          guidance: prohibition.alternativeGuidance || 'Review content for compliance.',
        };
      }
    }
    
    return null;
  }
  
  /**
   * Check if disclosure should apply
   */
  private shouldApplyDisclosure(content: string, triggerConditions: string[]): boolean {
    const lowerContent = content.toLowerCase();
    return triggerConditions.some(condition => 
      lowerContent.includes(condition.toLowerCase())
    );
  }
  
  /**
   * Check principle for potential warning
   */
  private checkPrincipleWarning(
    content: string,
    principle: { id: string; title: string; description: string; category: string },
    framework: DomainEthicsFramework
  ): EthicsWarning | null {
    // For now, we only generate warnings for specific content patterns
    // This could be enhanced with AI-based analysis
    return null;
  }
  
  /**
   * Create a passing check result
   */
  private createPassingCheck(domain: string, startTime: number): DomainEthicsCheck {
    return {
      domain,
      frameworksApplied: [],
      passed: true,
      score: 100,
      violations: [],
      warnings: [],
      requiredDisclosures: [],
      requiredModifications: [],
      checkDurationMs: Date.now() - startTime,
      checkedAt: new Date(),
    };
  }
  
  // ============================================================================
  // Framework Management
  // ============================================================================
  
  /**
   * Get all ethics frameworks
   */
  async getAllFrameworks(includeDisabled = false): Promise<DomainEthicsFramework[]> {
    // Start with built-in frameworks
    let frameworks = [...DOMAIN_ETHICS_REGISTRY];
    
    // Get custom frameworks from database
    const customResult = await executeStatement(
      `SELECT framework_data FROM domain_ethics_custom_frameworks WHERE is_active = true`,
      []
    );
    
    for (const row of customResult.rows || []) {
      const data = (row as { framework_data?: string }).framework_data;
      if (data) {
        frameworks.push(JSON.parse(data) as DomainEthicsFramework);
      }
    }
    
    if (!includeDisabled) {
      frameworks = frameworks.filter(f => f.isActive);
    }
    
    return frameworks;
  }
  
  /**
   * Get frameworks applicable to a domain
   */
  async getApplicableFrameworks(
    domain: string,
    subspecialty: string | undefined,
    config: DomainEthicsConfig
  ): Promise<DomainEthicsFramework[]> {
    const allFrameworks = await this.getAllFrameworks();
    
    return allFrameworks.filter(framework => {
      // Check domain match
      if (framework.domain !== domain) return false;
      
      // Check if disabled by tenant
      if (config.disabledFrameworks.includes(framework.id)) return false;
      
      // Check domain-specific settings
      const domainSettings = config.domainSettings[domain];
      if (domainSettings && !domainSettings.enabled) return false;
      
      // Check subspecialty if specified
      if (subspecialty && framework.subspecialties) {
        // Include if subspecialty matches or if framework applies to all
        if (!framework.subspecialties.includes(subspecialty) && framework.subspecialties.length > 0) {
          // Still include but with reduced priority
        }
      }
      
      return true;
    });
  }
  
  /**
   * Get framework by ID
   */
  async getFramework(frameworkId: string): Promise<DomainEthicsFramework | null> {
    const frameworks = await this.getAllFrameworks(true);
    return frameworks.find(f => f.id === frameworkId) || null;
  }
  
  /**
   * Get frameworks for a domain
   */
  async getFrameworksForDomain(domain: string): Promise<DomainEthicsFramework[]> {
    const frameworks = await this.getAllFrameworks();
    return frameworks.filter(f => f.domain === domain);
  }
  
  // ============================================================================
  // Tenant Configuration
  // ============================================================================
  
  /**
   * Get tenant ethics configuration
   */
  async getTenantConfig(tenantId: string): Promise<DomainEthicsConfig> {
    const result = await executeStatement(
      `SELECT * FROM domain_ethics_config WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    if (!result.rows || result.rows.length === 0) {
      // Return default config
      return {
        tenantId,
        enableDomainEthics: true,
        enforcementMode: 'standard',
        disabledFrameworks: [],
        customFrameworks: [],
        domainSettings: {},
        logAllChecks: false,
        logViolationsOnly: true,
        notifyOnViolation: true,
        notifyOnWarning: false,
      };
    }
    
    const row = result.rows[0];
    return this.mapConfigRow(row, tenantId);
  }
  
  /**
   * Update tenant ethics configuration
   */
  async updateTenantConfig(
    tenantId: string,
    updates: Partial<DomainEthicsConfig>
  ): Promise<DomainEthicsConfig> {
    const current = await this.getTenantConfig(tenantId);
    
    const merged = { ...current, ...updates };
    
    await executeStatement(
      `INSERT INTO domain_ethics_config (
         tenant_id, enable_domain_ethics, enforcement_mode,
         disabled_frameworks, domain_settings,
         log_all_checks, log_violations_only,
         notify_on_violation, notify_on_warning, notification_emails
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id) DO UPDATE SET
         enable_domain_ethics = $2,
         enforcement_mode = $3,
         disabled_frameworks = $4,
         domain_settings = $5,
         log_all_checks = $6,
         log_violations_only = $7,
         notify_on_violation = $8,
         notify_on_warning = $9,
         notification_emails = $10,
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'enabled', value: { booleanValue: merged.enableDomainEthics } },
        { name: 'mode', value: { stringValue: merged.enforcementMode } },
        { name: 'disabled', value: { stringValue: JSON.stringify(merged.disabledFrameworks) } },
        { name: 'settings', value: { stringValue: JSON.stringify(merged.domainSettings) } },
        { name: 'logAll', value: { booleanValue: merged.logAllChecks } },
        { name: 'logViolations', value: { booleanValue: merged.logViolationsOnly } },
        { name: 'notifyViolation', value: { booleanValue: merged.notifyOnViolation } },
        { name: 'notifyWarning', value: { booleanValue: merged.notifyOnWarning } },
        { name: 'emails', value: merged.notificationEmails ? { stringValue: JSON.stringify(merged.notificationEmails) } : { isNull: true } },
      ]
    );
    
    return this.getTenantConfig(tenantId);
  }
  
  /**
   * Enable/disable a framework for a tenant
   */
  async setFrameworkEnabled(
    tenantId: string,
    frameworkId: string,
    enabled: boolean
  ): Promise<void> {
    const config = await this.getTenantConfig(tenantId);
    
    // Check if framework can be disabled
    const framework = await this.getFramework(frameworkId);
    if (framework && !framework.canBeDisabled && !enabled) {
      throw new Error(`Framework ${frameworkId} cannot be disabled - it is a required safety framework.`);
    }
    
    if (enabled) {
      config.disabledFrameworks = config.disabledFrameworks.filter(id => id !== frameworkId);
    } else {
      if (!config.disabledFrameworks.includes(frameworkId)) {
        config.disabledFrameworks.push(frameworkId);
      }
    }
    
    await this.updateTenantConfig(tenantId, { disabledFrameworks: config.disabledFrameworks });
  }
  
  /**
   * Update domain-specific settings
   */
  async updateDomainSettings(
    tenantId: string,
    domain: string,
    settings: {
      enabled?: boolean;
      enforcementLevel?: 'strict' | 'standard' | 'advisory';
      customDisclaimers?: string[];
    }
  ): Promise<void> {
    const config = await this.getTenantConfig(tenantId);
    
    config.domainSettings[domain] = {
      ...config.domainSettings[domain],
      ...settings,
    } as DomainEthicsConfig['domainSettings'][string];
    
    await this.updateTenantConfig(tenantId, { domainSettings: config.domainSettings });
  }
  
  // ============================================================================
  // Audit Logging
  // ============================================================================
  
  /**
   * Log an ethics check
   */
  private async logCheck(input: CheckEthicsInput, check: DomainEthicsCheck): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO domain_ethics_audit_log (
         tenant_id, user_id, session_id, prompt_id,
         detected_domain, detected_subspecialty,
         frameworks_applied, check_result,
         action_taken, modifications_applied
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: input.tenantId } },
        { name: 'userId', value: { stringValue: input.userId } },
        { name: 'sessionId', value: { stringValue: input.sessionId } },
        { name: 'promptId', value: { stringValue: input.promptId } },
        { name: 'domain', value: { stringValue: input.domain } },
        { name: 'subspecialty', value: input.subspecialty ? { stringValue: input.subspecialty } : { isNull: true } },
        { name: 'frameworks', value: { stringValue: JSON.stringify(check.frameworksApplied) } },
        { name: 'result', value: { stringValue: JSON.stringify(check) } },
        { name: 'action', value: { stringValue: check.passed ? 'allowed' : (check.violations.some(v => v.action === 'block') ? 'blocked' : 'modified') } },
        { name: 'mods', value: check.requiredModifications.length > 0 ? { stringValue: JSON.stringify(check.requiredModifications) } : { isNull: true } },
      ]
    );
    
    return (result.rows?.[0] as Record<string, unknown>)?.id as string || '';
  }
  
  /**
   * Get audit logs for a tenant
   */
  async getAuditLogs(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      domain?: string;
      violationsOnly?: boolean;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<DomainEthicsAuditLog[]> {
    let sql = `SELECT * FROM domain_ethics_audit_log WHERE tenant_id = $1`;
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];
    let paramIndex = 2;
    
    if (options.domain) {
      sql += ` AND detected_domain = $${paramIndex++}`;
      params.push({ name: 'domain', value: { stringValue: options.domain } });
    }
    
    if (options.violationsOnly) {
      sql += ` AND action_taken != 'allowed'`;
    }
    
    if (options.startDate) {
      sql += ` AND created_at >= $${paramIndex++}`;
      params.push({ name: 'startDate', value: { stringValue: options.startDate.toISOString() } });
    }
    
    if (options.endDate) {
      sql += ` AND created_at <= $${paramIndex++}`;
      params.push({ name: 'endDate', value: { stringValue: options.endDate.toISOString() } });
    }
    
    sql += ` ORDER BY created_at DESC`;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push({ name: 'limit', value: { longValue: options.limit || 50 } });
    params.push({ name: 'offset', value: { longValue: options.offset || 0 } });
    
    const result = await executeStatement(sql, params);
    
    return (result.rows || []).map(row => this.mapAuditLogRow(row, tenantId));
  }
  
  /**
   * Get ethics check statistics
   */
  async getStats(tenantId: string, days = 30): Promise<DomainEthicsStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const result = await executeStatement(
      `SELECT
         COUNT(*) as total_checks,
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as checks_today,
         COUNT(*) FILTER (WHERE action_taken = 'blocked') as violations_blocked,
         COUNT(*) FILTER (WHERE action_taken = 'modified') as warnings_issued
       FROM domain_ethics_audit_log
       WHERE tenant_id = $1 AND created_at >= $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'startDate', value: { stringValue: startDate.toISOString() } },
      ]
    );
    
    const row = result.rows?.[0];
    
    // Get domain distribution
    const domainResult = await executeStatement(
      `SELECT detected_domain, COUNT(*) as count
       FROM domain_ethics_audit_log
       WHERE tenant_id = $1 AND created_at >= $2
       GROUP BY detected_domain`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'startDate', value: { stringValue: startDate.toISOString() } },
      ]
    );
    
    const checksByDomain: Record<string, number> = {};
    for (const domainRow of domainResult.rows || []) {
      const r = domainRow as { detected_domain?: string; count?: string | number };
      const domain = r.detected_domain || '';
      const count = Number(r.count || 0);
      checksByDomain[domain] = count;
    }
    
    const statsRow = row as { total_checks?: string | number; checks_today?: string | number; violations_blocked?: string | number; warnings_issued?: string | number } | undefined;
    return {
      totalChecks: Number(statsRow?.total_checks || 0),
      checksToday: Number(statsRow?.checks_today || 0),
      violationsBlocked: Number(statsRow?.violations_blocked || 0),
      warningsIssued: Number(statsRow?.warnings_issued || 0),
      topViolatedRules: [], // Would need additional query
      checksByDomain,
    };
  }
  
  // ============================================================================
  // Response Modification
  // ============================================================================
  
  /**
   * Apply ethics modifications to a response
   */
  applyModifications(response: string, check: DomainEthicsCheck): string {
    let modified = response;
    
    // Apply prefix
    if (check.prefixText) {
      modified = check.prefixText + modified;
    }
    
    // Apply inline modifications
    if (check.inlineModifications) {
      for (const mod of check.inlineModifications) {
        const regex = new RegExp(mod.pattern, 'gi');
        modified = modified.replace(regex, mod.replacement);
      }
    }
    
    // Apply suffix
    if (check.suffixText) {
      modified = modified + check.suffixText;
    }
    
    return modified;
  }
  
  /**
   * Get required disclaimers for a domain
   */
  async getDisclaimersForDomain(
    tenantId: string,
    domain: string
  ): Promise<string[]> {
    const config = await this.getTenantConfig(tenantId);
    const frameworks = await this.getApplicableFrameworks(domain, undefined, config);
    
    const disclaimers: string[] = [];
    
    for (const framework of frameworks) {
      disclaimers.push(...framework.requiredDisclaimers);
    }
    
    // Add tenant custom disclaimers
    const domainSettings = config.domainSettings[domain];
    if (domainSettings?.customDisclaimers) {
      disclaimers.push(...domainSettings.customDisclaimers);
    }
    
    // Deduplicate
    return [...new Set(disclaimers)];
  }
  
  // ============================================================================
  // Custom Framework Management
  // ============================================================================
  
  /**
   * Create a custom ethics framework for a new domain
   */
  async createCustomFramework(
    framework: Omit<DomainEthicsFramework, 'id' | 'createdAt' | 'updatedAt'> & { createdBy?: string }
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO domain_ethics_custom_frameworks (
         framework_id, name, code, domain, subspecialty,
         governing_body, version, effective_date,
         principles, prohibitions, disclosure_requirements, required_disclaimers,
         emergency_overrides, can_be_disabled, is_active, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        { name: 'frameworkId', value: { stringValue: `custom_${framework.domain}_${Date.now()}` } },
        { name: 'name', value: { stringValue: framework.frameworkName } },
        { name: 'code', value: { stringValue: framework.frameworkCode } },
        { name: 'domain', value: { stringValue: framework.domain } },
        { name: 'subspecialty', value: framework.subspecialties?.length ? { stringValue: framework.subspecialties[0] } : { isNull: true } },
        { name: 'governingBody', value: framework.governingBody ? { stringValue: framework.governingBody } : { isNull: true } },
        { name: 'version', value: { stringValue: '1.0' } },
        { name: 'effectiveDate', value: { isNull: true } },
        { name: 'principles', value: { stringValue: JSON.stringify(framework.principles) } },
        { name: 'prohibitions', value: { stringValue: JSON.stringify(framework.prohibitions) } },
        { name: 'disclosures', value: { stringValue: JSON.stringify(framework.disclosureRequirements) } },
        { name: 'disclaimers', value: { stringValue: JSON.stringify(framework.requiredDisclaimers) } },
        { name: 'emergencyOverrides', value: { isNull: true } },
        { name: 'canBeDisabled', value: { booleanValue: framework.canBeDisabled !== false } },
        { name: 'isActive', value: { booleanValue: true } },
        { name: 'createdBy', value: framework.createdBy ? { stringValue: framework.createdBy } : { isNull: true } },
      ]
    );
    
    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    return (row?.id as string) || '';
  }
  
  /**
   * Update an existing custom framework
   */
  async updateCustomFramework(
    frameworkId: string,
    updates: Partial<DomainEthicsFramework>
  ): Promise<void> {
    const updateFields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'frameworkId', value: { stringValue: frameworkId } },
    ];
    
    if (updates.frameworkName) {
      updateFields.push(`name = $${params.length + 1}`);
      params.push({ name: 'name', value: { stringValue: updates.frameworkName } });
    }
    if (updates.principles) {
      updateFields.push(`principles = $${params.length + 1}`);
      params.push({ name: 'principles', value: { stringValue: JSON.stringify(updates.principles) } });
    }
    if (updates.prohibitions) {
      updateFields.push(`prohibitions = $${params.length + 1}`);
      params.push({ name: 'prohibitions', value: { stringValue: JSON.stringify(updates.prohibitions) } });
    }
    if (updates.disclosureRequirements) {
      updateFields.push(`disclosure_requirements = $${params.length + 1}`);
      params.push({ name: 'disclosures', value: { stringValue: JSON.stringify(updates.disclosureRequirements) } });
    }
    if (updates.requiredDisclaimers) {
      updateFields.push(`required_disclaimers = $${params.length + 1}`);
      params.push({ name: 'disclaimers', value: { stringValue: JSON.stringify(updates.requiredDisclaimers) } });
    }
    
    updateFields.push(`updated_at = NOW()`);
    
    if (updateFields.length > 1) {
      await executeStatement(
        `UPDATE domain_ethics_custom_frameworks SET ${updateFields.join(', ')} WHERE framework_id = $1`,
        params
      );
    }
  }
  
  /**
   * Get all custom frameworks (from database)
   */
  async getCustomFrameworks(options: {
    domain?: string;
    activeOnly?: boolean;
  } = {}): Promise<DomainEthicsFramework[]> {
    let sql = `SELECT * FROM domain_ethics_custom_frameworks WHERE 1=1`;
    const params: Array<{ name: string; value: Record<string, unknown> }> = [];
    
    if (options.domain) {
      sql += ` AND domain = $${params.length + 1}`;
      params.push({ name: 'domain', value: { stringValue: options.domain } });
    }
    
    if (options.activeOnly !== false) {
      sql += ` AND is_active = true`;
    }
    
    sql += ` ORDER BY domain, created_at`;
    
    const result = await executeStatement(sql, params);
    
    return (result.rows || []).map(row => this.mapFrameworkRow(row));
  }
  
  /**
   * Get a specific custom framework
   */
  async getCustomFramework(frameworkId: string): Promise<DomainEthicsFramework | null> {
    const result = await executeStatement(
      `SELECT * FROM domain_ethics_custom_frameworks WHERE framework_id = $1`,
      [{ name: 'frameworkId', value: { stringValue: frameworkId } }]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    
    return this.mapFrameworkRow(result.rows[0]);
  }
  
  /**
   * Delete a custom framework
   */
  async deleteCustomFramework(frameworkId: string): Promise<void> {
    await executeStatement(
      `DELETE FROM domain_ethics_custom_frameworks WHERE framework_id = $1`,
      [{ name: 'frameworkId', value: { stringValue: frameworkId } }]
    );
  }
  
  /**
   * Check if a domain has ethics coverage (built-in or custom)
   */
  async hasDomainEthicsCoverage(domain: string): Promise<{
    hasCoverage: boolean;
    frameworks: Array<{ id: string; name: string; source: 'built-in' | 'custom' }>;
  }> {
    // Check built-in
    const builtIn = getEthicsFrameworkByDomain(domain);
    const frameworks: Array<{ id: string; name: string; source: 'built-in' | 'custom' }> = [];
    
    if (builtIn) {
      frameworks.push({ id: builtIn.id, name: (builtIn as any).name || builtIn.id, source: 'built-in' });
    }
    
    // Check custom
    const custom = await this.getCustomFrameworks({ domain, activeOnly: true });
    for (const cf of custom) {
      frameworks.push({ id: cf.id, name: cf.frameworkName || cf.id, source: 'custom' });
    }
    
    return {
      hasCoverage: frameworks.length > 0,
      frameworks,
    };
  }
  
  /**
   * Get all domains that have ethics frameworks defined
   */
  async getDomainsWithEthics(): Promise<Array<{
    domain: string;
    frameworkCount: number;
    builtInCount: number;
    customCount: number;
  }>> {
    // Get built-in domains
    const builtInDomains = getActiveFrameworks().map(f => f.domain);
    
    // Get custom domains
    const customResult = await executeStatement(
      `SELECT domain, COUNT(*) as count FROM domain_ethics_custom_frameworks 
       WHERE is_active = true GROUP BY domain`,
      []
    );
    
    const customCounts: Record<string, number> = {};
    for (const row of customResult.rows || []) {
      const r = row as Record<string, unknown>;
      const domain = (r.domain as string) || '';
      const count = Number(r.count) || 0;
      customCounts[domain] = count;
    }
    
    // Combine
    const allDomains = new Set([...builtInDomains, ...Object.keys(customCounts)]);
    
    return Array.from(allDomains).map(domain => {
      const builtInCount = builtInDomains.includes(domain) ? 1 : 0;
      const customCount = customCounts[domain] || 0;
      return {
        domain,
        frameworkCount: builtInCount + customCount,
        builtInCount,
        customCount,
      };
    });
  }
  
  /**
   * Suggest ethics requirements for a new domain based on similar domains
   */
  async suggestEthicsForDomain(domain: string): Promise<{
    suggestedPrinciples: string[];
    suggestedProhibitions: string[];
    suggestedDisclaimers: string[];
    similarDomains: string[];
  }> {
    // Map similar domains
    const domainSimilarity: Record<string, string[]> = {
      'law': ['legal'],
      'medicine': ['healthcare', 'medical'],
      'psychology': ['healthcare', 'mental_health'],
      'psychiatry': ['healthcare', 'mental_health', 'psychology'],
      'nursing': ['healthcare', 'medical'],
      'pharmacy': ['healthcare', 'medical'],
      'accounting': ['finance', 'financial'],
      'tax': ['finance', 'financial', 'legal'],
      'real_estate': ['finance', 'legal'],
      'insurance': ['finance', 'financial'],
      'veterinary': ['healthcare'],
      'dentistry': ['healthcare', 'medical'],
    };
    
    const similarDomains = domainSimilarity[domain.toLowerCase()] || [];
    
    // Get ethics from similar domains
    const suggestedPrinciples: string[] = [];
    const suggestedProhibitions: string[] = [];
    const suggestedDisclaimers: string[] = [];
    
    for (const similar of similarDomains) {
      const framework = getEthicsFrameworkByDomain(similar);
      if (framework) {
        suggestedPrinciples.push(...framework.principles.slice(0, 3).map(p => (p as any).name || (p as any).title || ''));
        suggestedProhibitions.push(...framework.prohibitions.slice(0, 3).map(p => (p as any).name || (p as any).title || ''));
        suggestedDisclaimers.push(...framework.requiredDisclaimers.slice(0, 2));
      }
    }
    
    // Generic suggestions if no similar domains found
    if (suggestedPrinciples.length === 0) {
      suggestedPrinciples.push(
        'Accuracy and Truthfulness',
        'Professional Competence Boundaries',
        'User Safety Priority'
      );
      suggestedProhibitions.push(
        'Cannot replace professional consultation',
        'Cannot provide specific advice requiring licensure'
      );
      suggestedDisclaimers.push(
        'This information is for educational purposes only.',
        'Please consult a qualified professional for specific advice.'
      );
    }
    
    return {
      suggestedPrinciples: [...new Set(suggestedPrinciples)],
      suggestedProhibitions: [...new Set(suggestedProhibitions)],
      suggestedDisclaimers: [...new Set(suggestedDisclaimers)],
      similarDomains,
    };
  }
  
  /**
   * Sync ethics frameworks when a new domain is detected in the domain taxonomy
   */
  async onNewDomainDetected(
    domain: string,
    info: { fieldName?: string; domainName?: string; detectedBy?: string }
  ): Promise<{
    hasBuiltInFramework: boolean;
    hasCustomFramework: boolean;
    suggestedFramework?: Partial<DomainEthicsFramework>;
    requiresEthics: boolean;
  }> {
    // Check if built-in framework exists
    const builtIn = getEthicsFrameworkByDomain(domain);
    
    // Check if custom framework exists
    const custom = await this.getCustomFrameworks({ domain, activeOnly: true });
    
    // Domains that typically require ethics
    const ethicsRequiredDomains = [
      'law', 'legal', 'healthcare', 'medical', 'finance', 'financial',
      'psychology', 'psychiatry', 'counseling', 'therapy',
      'engineering', 'architecture', 'pharmacy', 'nursing',
      'accounting', 'tax', 'real_estate', 'insurance', 'veterinary'
    ];
    
    const requiresEthics = ethicsRequiredDomains.some(d => 
      domain.toLowerCase().includes(d) || (info.domainName || '').toLowerCase().includes(d)
    );
    
    let suggestedFramework: Partial<DomainEthicsFramework> | undefined;
    
    if (!builtIn && custom.length === 0 && requiresEthics) {
      // Suggest a framework
      const suggestions = await this.suggestEthicsForDomain(domain);
      
      suggestedFramework = {
        frameworkName: `${info.domainName || domain} Ethics Framework`,
        frameworkCode: domain.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
        domain,
        principles: suggestions.suggestedPrinciples.map((name, i) => ({
          id: `principle_${i}`,
          title: name,
          description: `Professional standard for ${name.toLowerCase()}`,
          category: 'professional_standards' as const,
        })) as any,
        prohibitions: suggestions.suggestedProhibitions.map((name, i) => ({
          id: `prohibition_${i}`,
          title: name,
          description: name,
          severity: 'major' as const,
          keywords: [],
          patterns: [],
          actionOnViolation: 'warn' as const,
        })) as any,
        requiredDisclaimers: suggestions.suggestedDisclaimers,
        disclosureRequirements: [],
        canBeDisabled: true,
      };
    }
    
    return {
      hasBuiltInFramework: !!builtIn,
      hasCustomFramework: custom.length > 0,
      suggestedFramework,
      requiresEthics,
    };
  }
  
  private mapFrameworkRow(row: Record<string, unknown>): DomainEthicsFramework {
    return {
      id: (row.framework_id as string) || (row.id as string) || '',
      frameworkName: (row.name as string) || '',
      frameworkCode: (row.code as string) || '',
      domain: (row.domain as string) || '',
      subspecialties: row.subspecialty ? [(row.subspecialty as string)] : [],
      governingBody: (row.governing_body as string) || '',
      jurisdiction: row.jurisdiction as string | undefined,
      description: (row.description as string) || '',
      websiteUrl: row.website_url as string | undefined,
      lastUpdated: new Date(row.updated_at as string || row.last_updated as string || Date.now()),
      principles: row.principles ? JSON.parse(row.principles as string) : [],
      prohibitions: row.prohibitions ? JSON.parse(row.prohibitions as string) : [],
      disclosureRequirements: row.disclosure_requirements ? JSON.parse(row.disclosure_requirements as string) : [],
      requiredDisclaimers: row.required_disclaimers ? JSON.parse(row.required_disclaimers as string) : [],
      mandatoryWarnings: row.mandatory_warnings ? JSON.parse(row.mandatory_warnings as string) : [],
      enforcementLevel: (row.enforcement_level as 'strict' | 'standard' | 'advisory') || 'standard',
      isActive: row.is_active !== false,
      canBeDisabled: Boolean(row.can_be_disabled) ?? true,
      lastModifiedBy: row.last_modified_by as string | undefined,
      lastModifiedAt: row.last_modified_at ? new Date(row.last_modified_at as string) : undefined,
    };
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  private mapConfigRow(row: Record<string, unknown>, tenantId: string): DomainEthicsConfig {
    return {
      tenantId,
      enableDomainEthics: Boolean(row.enable_domain_ethics) ?? true,
      enforcementMode: (row.enforcement_mode as DomainEthicsConfig['enforcementMode']) || 'standard',
      disabledFrameworks: row.disabled_frameworks ? JSON.parse(row.disabled_frameworks as string) : [],
      customFrameworks: [],
      domainSettings: row.domain_settings ? JSON.parse(row.domain_settings as string) : {},
      logAllChecks: Boolean(row.log_all_checks) ?? false,
      logViolationsOnly: Boolean(row.log_violations_only) ?? true,
      notifyOnViolation: Boolean(row.notify_on_violation) ?? true,
      notifyOnWarning: Boolean(row.notify_on_warning) ?? false,
      notificationEmails: row.notification_emails ? JSON.parse(row.notification_emails as string) : undefined,
    };
  }
  
  private mapAuditLogRow(row: Record<string, unknown>, tenantId: string): DomainEthicsAuditLog {
    return {
      id: (row.id as string) || '',
      tenantId,
      userId: (row.user_id as string) || '',
      sessionId: (row.session_id as string) || '',
      promptId: (row.prompt_id as string) || '',
      detectedDomain: (row.detected_domain as string) || '',
      detectedSubspecialty: row.detected_subspecialty as string | undefined,
      frameworksApplied: row.frameworks_applied ? JSON.parse(row.frameworks_applied as string) : [],
      checkResult: row.check_result ? JSON.parse(row.check_result as string) : {},
      actionTaken: (row.action_taken as DomainEthicsAuditLog['actionTaken']) || 'allowed',
      modificationsApplied: row.modifications_applied ? JSON.parse(row.modifications_applied as string) : undefined,
      createdAt: new Date((row.created_at as string) || ''),
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const domainEthicsService = new DomainEthicsService();
