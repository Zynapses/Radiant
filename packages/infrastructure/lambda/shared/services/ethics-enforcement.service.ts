/**
 * RADIANT v5.12.6 - Ethics Enforcement Service
 * 
 * CRITICAL DESIGN PRINCIPLES:
 * 
 * 1. ENFORCEMENT: Ethics rules PREVENT Cato from violating them
 * 2. RETRY PATTERN: On violation, ask to "retry with X in mind" 
 * 3. NO PERSISTENT LEARNING: Ethics NEVER get learned persistently
 *    because ethics change over time (cultural, legal, organizational)
 * 
 * WHY NO PERSISTENT LEARNING?
 * - Ethics evolve (what was acceptable yesterday may not be today)
 * - Tenants may change ethics frameworks
 * - Learning ethics would "bake in" potentially outdated rules
 * - Ethics should be INJECTED at runtime, not learned
 * 
 * ARCHITECTURE:
 * 1. Ethics rules are loaded fresh each request (from DB/config)
 * 2. Violations trigger retry with explicit guidance
 * 3. NO feedback is stored for ethics violations
 * 4. NO training batches include ethics corrections
 */

import { executeStatement, stringParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { ethicsPipelineService, EthicsPipelineResult } from './ethics-pipeline.service';

// ============================================================================
// Types
// ============================================================================

export interface EthicsEnforcementConfig {
  tenantId: string;
  
  // Enforcement settings
  enabled: boolean;
  enforcementMode: 'strict' | 'standard' | 'advisory';
  maxRetryAttempts: number;
  
  // CRITICAL: Ephemeral ethics - NO persistent learning
  ethicsAreEphemeral: true; // Always true - never learned
  neverLearnEthics: true;   // Always true - never trained
  neverStoreEthicsViolations: boolean; // Don't store violation content
  
  // Retry behavior
  retryPromptTemplate: string;
  includeViolationDetails: boolean;
  includeGuidance: boolean;
}

export interface EthicsViolation {
  ruleId: string;
  ruleName: string;
  framework: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  guidance: string;
  retryInstruction: string;
}

export interface EthicsEnforcementResult {
  // Did it pass ethics check?
  passed: boolean;
  
  // Should we retry?
  shouldRetry: boolean;
  retryAttempt: number;
  maxRetryAttempts: number;
  
  // Violations found
  violations: EthicsViolation[];
  
  // The retry prompt to use (if shouldRetry)
  retryPrompt?: string;
  
  // The "retry with X in mind" instructions
  retryInstructions?: string[];
  
  // The safe response to return if blocked
  safeResponse?: string;
  
  // Metadata (NEVER persisted)
  ephemeral: true;
  doNotLearn: true;
  doNotStore: boolean;
}

export interface RetryContext {
  originalPrompt: string;
  originalResponse: string;
  violations: EthicsViolation[];
  retryAttempt: number;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: EthicsEnforcementConfig = {
  tenantId: '',
  enabled: true,
  enforcementMode: 'standard',
  maxRetryAttempts: 2,
  
  // CRITICAL: These are ALWAYS true
  ethicsAreEphemeral: true,
  neverLearnEthics: true,
  neverStoreEthicsViolations: true,
  
  retryPromptTemplate: `Please respond again, keeping in mind:
{{RETRY_INSTRUCTIONS}}

Original request: {{ORIGINAL_PROMPT}}`,
  
  includeViolationDetails: false, // Don't expose violation details
  includeGuidance: true,
};

// ============================================================================
// Ethics Enforcement Service
// ============================================================================

class EthicsEnforcementService {
  
  /**
   * Check response for ethics violations and enforce rules.
   * 
   * CRITICAL: This method NEVER stores feedback for learning.
   * Ethics are ephemeral and must be checked fresh each time.
   */
  async enforceEthics(
    tenantId: string,
    userId: string,
    sessionId: string,
    prompt: string,
    response: string,
    retryAttempt: number = 0,
    domain?: string
  ): Promise<EthicsEnforcementResult> {
    const config = await this.getConfig(tenantId);
    
    if (!config.enabled) {
      return this.createPassingResult();
    }
    
    logger.info('Enforcing ethics check', { 
      tenantId, 
      sessionId, 
      retryAttempt,
      // NEVER log the actual content for ethics violations
    });
    
    // Run ethics pipeline check
    const ethicsResult = await ethicsPipelineService.checkSynthesisLevel({
      tenantId,
      userId,
      sessionId,
      promptId: `prompt-${Date.now()}`,
      content: response,
      domain,
      rerunAttempt: retryAttempt,
    });
    
    // Convert to enforcement result
    return this.processEthicsResult(
      config,
      prompt,
      response,
      ethicsResult,
      retryAttempt
    );
  }
  
  /**
   * Process ethics check result into enforcement result.
   * Generates "retry with X in mind" instructions.
   */
  private processEthicsResult(
    config: EthicsEnforcementConfig,
    originalPrompt: string,
    originalResponse: string,
    ethicsResult: EthicsPipelineResult,
    retryAttempt: number
  ): EthicsEnforcementResult {
    
    // If passed, return success
    if (ethicsResult.passed && ethicsResult.violations.length === 0) {
      return this.createPassingResult();
    }
    
    // Convert violations to our format
    const violations: EthicsViolation[] = ethicsResult.violations.map(v => ({
      ruleId: v.id,
      ruleName: v.rule,
      framework: v.framework || 'general',
      severity: v.severity,
      description: v.description,
      guidance: v.guidance || 'Please reconsider this response.',
      retryInstruction: this.generateRetryInstruction(v),
    }));
    
    // Check if we should retry
    const canRetry = retryAttempt < config.maxRetryAttempts;
    const shouldRetry = canRetry && !this.hasCriticalViolation(violations);
    
    // Generate retry instructions
    const retryInstructions = violations.map(v => v.retryInstruction);
    
    // Generate retry prompt if we should retry
    let retryPrompt: string | undefined;
    if (shouldRetry) {
      retryPrompt = this.generateRetryPrompt(config, originalPrompt, retryInstructions);
    }
    
    // Generate safe response if blocked
    let safeResponse: string | undefined;
    if (!shouldRetry) {
      safeResponse = this.generateSafeResponse(violations);
    }
    
    // Log enforcement action (NOT the content)
    logger.warn('Ethics violation detected', {
      violationCount: violations.length,
      severities: violations.map(v => v.severity),
      shouldRetry,
      retryAttempt,
      // NEVER log actual content
    });
    
    return {
      passed: false,
      shouldRetry,
      retryAttempt,
      maxRetryAttempts: config.maxRetryAttempts,
      violations,
      retryPrompt,
      retryInstructions,
      safeResponse,
      
      // CRITICAL: Always mark as ephemeral and do-not-learn
      ephemeral: true,
      doNotLearn: true,
      doNotStore: config.neverStoreEthicsViolations,
    };
  }
  
  /**
   * Generate a "retry with X in mind" instruction for a violation.
   */
  private generateRetryInstruction(violation: {
    rule: string;
    description: string;
    guidance?: string;
    severity: string;
  }): string {
    // Generate clear, actionable retry instruction
    const instructions: Record<string, string> = {
      // Common violation types -> retry instructions
      'harm': 'Ensure the response does not cause or encourage harm',
      'bias': 'Ensure the response is fair and unbiased',
      'privacy': 'Ensure the response respects privacy',
      'deception': 'Ensure the response is truthful and not misleading',
      'manipulation': 'Ensure the response does not manipulate the user',
      'illegal': 'Ensure the response does not encourage illegal activities',
      'medical': 'Include appropriate medical disclaimers and recommend professional consultation',
      'financial': 'Include appropriate financial disclaimers and recommend professional advice',
      'legal': 'Include appropriate legal disclaimers and recommend professional counsel',
    };
    
    // Match violation to instruction
    const lowerRule = violation.rule.toLowerCase();
    for (const [key, instruction] of Object.entries(instructions)) {
      if (lowerRule.includes(key)) {
        return instruction;
      }
    }
    
    // Use guidance if available
    if (violation.guidance) {
      return violation.guidance;
    }
    
    // Generic instruction
    return `Please reconsider the response with ethical guidelines in mind`;
  }
  
  /**
   * Generate the retry prompt with instructions.
   */
  private generateRetryPrompt(
    config: EthicsEnforcementConfig,
    originalPrompt: string,
    retryInstructions: string[]
  ): string {
    // Format instructions as bullet points
    const instructionsText = retryInstructions
      .map((inst, i) => `${i + 1}. ${inst}`)
      .join('\n');
    
    return config.retryPromptTemplate
      .replace('{{RETRY_INSTRUCTIONS}}', instructionsText)
      .replace('{{ORIGINAL_PROMPT}}', originalPrompt);
  }
  
  /**
   * Generate a safe response when retry is not possible.
   */
  private generateSafeResponse(violations: EthicsViolation[]): string {
    const hasCritical = violations.some(v => v.severity === 'critical');
    
    if (hasCritical) {
      return "I apologize, but I cannot provide a response to this request as it conflicts with my ethical guidelines. Please rephrase your request in a way that doesn't involve potentially harmful content.";
    }
    
    return "I apologize, but I need to reconsider how to respond to this request. Could you please rephrase your question? I want to make sure I provide helpful information while staying within ethical boundaries.";
  }
  
  /**
   * Check if any violation is critical (no retry possible).
   */
  private hasCriticalViolation(violations: EthicsViolation[]): boolean {
    return violations.some(v => v.severity === 'critical');
  }
  
  /**
   * Create a passing result (no violations).
   */
  private createPassingResult(): EthicsEnforcementResult {
    return {
      passed: true,
      shouldRetry: false,
      retryAttempt: 0,
      maxRetryAttempts: 0,
      violations: [],
      ephemeral: true,
      doNotLearn: true,
      doNotStore: true,
    };
  }
  
  /**
   * Get enforcement config for tenant.
   * ALWAYS returns ephemeral=true and neverLearn=true.
   */
  async getConfig(tenantId: string): Promise<EthicsEnforcementConfig> {
    try {
      const result = await executeStatement(
        `SELECT * FROM ethics_enforcement_config WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );
      
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        return {
          ...DEFAULT_CONFIG,
          tenantId,
          enabled: row.enabled as boolean ?? true,
          enforcementMode: row.enforcement_mode as 'strict' | 'standard' | 'advisory' ?? 'standard',
          maxRetryAttempts: row.max_retry_attempts as number ?? 2,
          neverStoreEthicsViolations: row.never_store_violations as boolean ?? true,
          includeViolationDetails: row.include_violation_details as boolean ?? false,
          includeGuidance: row.include_guidance as boolean ?? true,
          retryPromptTemplate: row.retry_prompt_template as string ?? DEFAULT_CONFIG.retryPromptTemplate,
          
          // CRITICAL: Always enforce these
          ethicsAreEphemeral: true,
          neverLearnEthics: true,
        };
      }
    } catch (error) {
      logger.warn('Failed to load ethics enforcement config, using defaults', { tenantId });
    }
    
    return { ...DEFAULT_CONFIG, tenantId };
  }
  
  /**
   * Update enforcement config.
   * NOTE: ethicsAreEphemeral and neverLearnEthics CANNOT be changed.
   */
  async updateConfig(
    tenantId: string,
    updates: Partial<Omit<EthicsEnforcementConfig, 'ethicsAreEphemeral' | 'neverLearnEthics'>>
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO ethics_enforcement_config (
         tenant_id, enabled, enforcement_mode, max_retry_attempts,
         never_store_violations, include_violation_details, include_guidance,
         retry_prompt_template, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         enforcement_mode = EXCLUDED.enforcement_mode,
         max_retry_attempts = EXCLUDED.max_retry_attempts,
         never_store_violations = EXCLUDED.never_store_violations,
         include_violation_details = EXCLUDED.include_violation_details,
         include_guidance = EXCLUDED.include_guidance,
         retry_prompt_template = EXCLUDED.retry_prompt_template,
         updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        boolParam('enabled', updates.enabled ?? true),
        stringParam('mode', updates.enforcementMode ?? 'standard'),
        stringParam('maxRetry', String(updates.maxRetryAttempts ?? 2)),
        boolParam('neverStore', updates.neverStoreEthicsViolations ?? true),
        boolParam('includeDetails', updates.includeViolationDetails ?? false),
        boolParam('includeGuidance', updates.includeGuidance ?? true),
        stringParam('template', updates.retryPromptTemplate ?? DEFAULT_CONFIG.retryPromptTemplate),
      ]
    );
  }
  
  /**
   * Execute a request with ethics enforcement and automatic retry.
   * 
   * FLOW:
   * 1. Execute the generation function
   * 2. Check response for ethics violations
   * 3. If violation and can retry: retry with "X in mind" instructions
   * 4. If violation and cannot retry: return safe response
   * 5. If passed: return response
   * 
   * CRITICAL: NO ethics violations are ever stored for learning.
   */
  async executeWithEnforcement<T>(
    tenantId: string,
    userId: string,
    sessionId: string,
    prompt: string,
    generateFn: (prompt: string, retryContext?: RetryContext) => Promise<{ response: string; metadata?: T }>,
    domain?: string
  ): Promise<{
    response: string;
    wasRetried: boolean;
    retryCount: number;
    ethicsEnforced: boolean;
    metadata?: T;
  }> {
    let currentPrompt = prompt;
    let retryAttempt = 0;
    let lastViolations: EthicsViolation[] = [];
    let lastResponse = '';
    let metadata: T | undefined;
    
    const config = await this.getConfig(tenantId);
    
    while (retryAttempt <= config.maxRetryAttempts) {
      // Generate response
      const result = await generateFn(currentPrompt, retryAttempt > 0 ? {
        originalPrompt: prompt,
        originalResponse: lastResponse,
        violations: lastViolations,
        retryAttempt,
      } : undefined);
      
      lastResponse = result.response;
      metadata = result.metadata;
      
      // Check ethics
      const enforcement = await this.enforceEthics(
        tenantId,
        userId,
        sessionId,
        prompt,
        result.response,
        retryAttempt,
        domain
      );
      
      // If passed, return success
      if (enforcement.passed) {
        return {
          response: result.response,
          wasRetried: retryAttempt > 0,
          retryCount: retryAttempt,
          ethicsEnforced: false,
          metadata,
        };
      }
      
      // If should not retry, return safe response
      if (!enforcement.shouldRetry || !enforcement.retryPrompt) {
        logger.warn('Ethics enforcement blocked response', {
          retryAttempt,
          violationCount: enforcement.violations.length,
        });
        
        return {
          response: enforcement.safeResponse || this.generateSafeResponse(enforcement.violations),
          wasRetried: retryAttempt > 0,
          retryCount: retryAttempt,
          ethicsEnforced: true,
          metadata,
        };
      }
      
      // Retry with new prompt
      logger.info('Retrying with ethics guidance', {
        retryAttempt: retryAttempt + 1,
        instructionCount: enforcement.retryInstructions?.length,
      });
      
      currentPrompt = enforcement.retryPrompt;
      lastViolations = enforcement.violations;
      retryAttempt++;
    }
    
    // Max retries exceeded
    logger.warn('Max ethics retries exceeded', { retryAttempt });
    
    return {
      response: this.generateSafeResponse(lastViolations),
      wasRetried: true,
      retryCount: retryAttempt,
      ethicsEnforced: true,
      metadata,
    };
  }
}

// Export singleton
export const ethicsEnforcementService = new EthicsEnforcementService();
