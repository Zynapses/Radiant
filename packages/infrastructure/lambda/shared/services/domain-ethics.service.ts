// RADIANT v4.18.0 - Domain Ethics Service
// Enforces domain-specific professional ethics (bar association, medical, financial, etc.)

import { executeStatement } from '../utils/database';
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
    
    for (const row of customResult.records || []) {
      const data = row[0]?.stringValue;
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
    
    if (!result.records || result.records.length === 0) {
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
    
    const row = result.records[0];
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
    
    return result.records?.[0]?.[0]?.stringValue || '';
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
    
    return (result.records || []).map(row => this.mapAuditLogRow(row, tenantId));
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
    
    const row = result.records?.[0];
    
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
    for (const domainRow of domainResult.records || []) {
      const domain = domainRow[0]?.stringValue || '';
      const count = Number(domainRow[1]?.longValue || 0);
      checksByDomain[domain] = count;
    }
    
    return {
      totalChecks: Number(row?.[0]?.longValue || 0),
      checksToday: Number(row?.[1]?.longValue || 0),
      violationsBlocked: Number(row?.[2]?.longValue || 0),
      warningsIssued: Number(row?.[3]?.longValue || 0),
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
  // Helper Methods
  // ============================================================================
  
  private mapConfigRow(row: unknown[], tenantId: string): DomainEthicsConfig {
    const r = row as Array<{ stringValue?: string; booleanValue?: boolean }>;
    
    return {
      tenantId,
      enableDomainEthics: r[1]?.booleanValue ?? true,
      enforcementMode: (r[2]?.stringValue as DomainEthicsConfig['enforcementMode']) || 'standard',
      disabledFrameworks: r[3]?.stringValue ? JSON.parse(r[3].stringValue) : [],
      customFrameworks: [],
      domainSettings: r[4]?.stringValue ? JSON.parse(r[4].stringValue) : {},
      logAllChecks: r[5]?.booleanValue ?? false,
      logViolationsOnly: r[6]?.booleanValue ?? true,
      notifyOnViolation: r[7]?.booleanValue ?? true,
      notifyOnWarning: r[8]?.booleanValue ?? false,
      notificationEmails: r[9]?.stringValue ? JSON.parse(r[9].stringValue) : undefined,
    };
  }
  
  private mapAuditLogRow(row: unknown[], tenantId: string): DomainEthicsAuditLog {
    const r = row as Array<{ stringValue?: string }>;
    
    return {
      id: r[0]?.stringValue || '',
      tenantId,
      userId: r[2]?.stringValue || '',
      sessionId: r[3]?.stringValue || '',
      promptId: r[4]?.stringValue || '',
      detectedDomain: r[5]?.stringValue || '',
      detectedSubspecialty: r[6]?.stringValue,
      frameworksApplied: r[7]?.stringValue ? JSON.parse(r[7].stringValue) : [],
      checkResult: r[8]?.stringValue ? JSON.parse(r[8].stringValue) : {},
      actionTaken: (r[9]?.stringValue as DomainEthicsAuditLog['actionTaken']) || 'allowed',
      modificationsApplied: r[10]?.stringValue ? JSON.parse(r[10].stringValue) : undefined,
      createdAt: new Date(r[11]?.stringValue || ''),
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const domainEthicsService = new DomainEthicsService();
