// RADIANT v4.18.0 - Ethics Pipeline Service
// Implements ethics checks at prompt and synthesis levels with rerun capability
// Works with both general ethics (moral compass) and domain-specific ethics

import { domainEthicsService } from './domain-ethics.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { moralCompassService } from './moral-compass.service';
import { executeStatement } from '../db/client';
import type {
  DomainEthicsCheck,
  DomainEthicsFramework,
} from '@radiant/shared';

// ============================================================================
// Types
// ============================================================================

export type EthicsCheckLevel = 'prompt' | 'synthesis' | 'rerun';
export type EthicsCheckResult = 'pass' | 'warn' | 'block' | 'modify' | 'rerun';

export interface EthicsCheckInput {
  tenantId: string;
  userId: string;
  sessionId: string;
  promptId: string;
  
  // Content to check
  content: string;
  
  // Context
  domain?: string;
  subspecialty?: string;
  orchestrationMode?: string;
  
  // Check level
  level: EthicsCheckLevel;
  
  // Previous check context (for rerun)
  previousCheck?: EthicsPipelineResult;
  rerunAttempt?: number;
}

export interface EthicsViolationDetail {
  id: string;
  type: 'domain' | 'general';
  framework?: string;
  rule: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  action: 'block' | 'warn' | 'modify';
  guidance?: string;
}

export interface EthicsModification {
  type: 'prefix' | 'suffix' | 'inline' | 'rewrite';
  original?: string;
  replacement: string;
  reason: string;
}

export interface EthicsPipelineResult {
  // Overall result
  result: EthicsCheckResult;
  passed: boolean;
  
  // Check details
  level: EthicsCheckLevel;
  domainChecked?: string;
  
  // Violations found
  violations: EthicsViolationDetail[];
  warnings: EthicsViolationDetail[];
  
  // Required modifications
  modifications: EthicsModification[];
  modifiedContent?: string;
  
  // Domain ethics result (if applicable)
  domainEthicsResult?: DomainEthicsCheck;
  
  // General ethics result
  generalEthicsResult?: {
    passed: boolean;
    score: number;
    violations: string[];
    guidance: string[];
  };
  
  // Rerun recommendation
  shouldRerun: boolean;
  rerunReason?: string;
  rerunGuidance?: string[];
  rerunAttempt: number;
  maxRerunAttempts: number;
  
  // Metadata
  checkDurationMs: number;
  frameworksApplied: string[];
  timestamp: Date;
}

export interface EthicsRerunRequest {
  originalPrompt: string;
  originalResponse: string;
  violations: EthicsViolationDetail[];
  guidance: string[];
  rerunAttempt: number;
}

export interface EthicsRerunResult {
  success: boolean;
  modifiedPrompt?: string;
  additionalInstructions?: string[];
  skipViolatingContent?: string[];
}

// ============================================================================
// Ethics Pipeline Service
// ============================================================================

class EthicsPipelineService {
  
  private readonly MAX_RERUN_ATTEMPTS = 3;
  
  // ============================================================================
  // Main Check Methods
  // ============================================================================
  
  /**
   * Check content at prompt level (before generation)
   * Catches obvious violations early to save compute
   */
  async checkPromptLevel(input: Omit<EthicsCheckInput, 'level'>): Promise<EthicsPipelineResult> {
    return this.runEthicsCheck({ ...input, level: 'prompt' });
  }
  
  /**
   * Check content at synthesis level (after generation)
   * Catches violations in generated content
   */
  async checkSynthesisLevel(input: Omit<EthicsCheckInput, 'level'>): Promise<EthicsPipelineResult> {
    return this.runEthicsCheck({ ...input, level: 'synthesis' });
  }
  
  /**
   * Check content during rerun (after previous violation)
   */
  async checkRerunLevel(input: Omit<EthicsCheckInput, 'level'>): Promise<EthicsPipelineResult> {
    return this.runEthicsCheck({ ...input, level: 'rerun' });
  }
  
  /**
   * Main ethics check - runs both domain and general ethics
   */
  private async runEthicsCheck(input: EthicsCheckInput): Promise<EthicsPipelineResult> {
    const startTime = Date.now();
    
    const violations: EthicsViolationDetail[] = [];
    const warnings: EthicsViolationDetail[] = [];
    const modifications: EthicsModification[] = [];
    const frameworksApplied: string[] = [];
    
    let domainEthicsResult: DomainEthicsCheck | undefined;
    let generalEthicsResult: EthicsPipelineResult['generalEthicsResult'] | undefined;
    
    // 1. Run domain-specific ethics check (if domain provided)
    if (input.domain) {
      try {
        domainEthicsResult = await domainEthicsService.checkDomainEthics({
          tenantId: input.tenantId,
          userId: input.userId,
          sessionId: input.sessionId,
          promptId: input.promptId,
          domain: input.domain,
          subspecialty: input.subspecialty,
          content: input.content,
        });
        
        frameworksApplied.push(...domainEthicsResult.frameworksApplied);
        
        // Convert domain violations to pipeline format
        for (const v of domainEthicsResult.violations) {
          const detail: EthicsViolationDetail = {
            id: v.prohibitionId,
            type: 'domain',
            framework: v.frameworkId,
            rule: v.description,
            severity: v.severity as 'critical' | 'major' | 'minor',
            description: v.description,
            action: v.action as 'block' | 'warn' | 'modify',
            guidance: v.guidance,
          };
          
          if (v.action === 'block' || v.severity === 'critical') {
            violations.push(detail);
          } else {
            warnings.push(detail);
          }
        }
        
        // Add required modifications
        if (domainEthicsResult.prefixText) {
          modifications.push({
            type: 'prefix',
            replacement: domainEthicsResult.prefixText,
            reason: 'Required disclaimer',
          });
        }
        if (domainEthicsResult.suffixText) {
          modifications.push({
            type: 'suffix',
            replacement: domainEthicsResult.suffixText,
            reason: 'Required disclaimer',
          });
        }
        
      } catch (error) {
        logger.error('Domain ethics check failed', error as Error);
      }
    }
    
    // 2. Run general ethics check (moral compass)
    try {
      const moralCheck = await moralCompassService.evaluateSituation(
        input.tenantId,
        input.content,
        {
          domain: input.domain,
          level: input.level,
          orchestrationMode: input.orchestrationMode,
        }
      );
      
      // Map recommendation to pass/fail
      const isEthical = moralCheck.recommendation === 'proceed';
      const score = moralCheck.confidence;
      const moralViolations = moralCheck.relevantPrinciples
        .filter(p => p.applies === 'opposes')
        .map(p => p.principle.text);
      
      generalEthicsResult = {
        passed: isEthical,
        score,
        violations: moralViolations,
        guidance: moralCheck.suggestedResponse ? [moralCheck.suggestedResponse] : [],
      };
      
      frameworksApplied.push('moral_compass');
      
      // Convert general violations to pipeline format
      for (const violation of moralViolations) {
        const detail: EthicsViolationDetail = {
          id: `general_${Date.now()}`,
          type: 'general',
          rule: violation,
          severity: score < 0.3 ? 'critical' : score < 0.6 ? 'major' : 'minor',
          description: violation,
          action: score < 0.3 ? 'block' : 'warn',
        };
        
        if (score < 0.5) {
          violations.push(detail);
        } else {
          warnings.push(detail);
        }
      }
      
    } catch (error) {
      logger.error('General ethics check failed', error as Error);
    }
    
    // 3. Determine overall result
    const hasCriticalViolation = violations.some(v => v.severity === 'critical');
    const hasMajorViolation = violations.some(v => v.severity === 'major');
    const hasBlockingAction = violations.some(v => v.action === 'block');
    const hasModifyAction = violations.some(v => v.action === 'modify');
    
    let result: EthicsCheckResult;
    let passed: boolean;
    let shouldRerun = false;
    let rerunReason: string | undefined;
    let rerunGuidance: string[] | undefined;
    
    if (hasCriticalViolation || hasBlockingAction) {
      // Critical violations at prompt level should block
      // At synthesis level, we can try to rerun
      if (input.level === 'synthesis' && (input.rerunAttempt || 0) < this.MAX_RERUN_ATTEMPTS) {
        result = 'rerun';
        passed = false;
        shouldRerun = true;
        rerunReason = 'Critical ethics violation in synthesized response';
        rerunGuidance = this.generateRerunGuidance(violations);
      } else {
        result = 'block';
        passed = false;
      }
    } else if (hasMajorViolation) {
      // Major violations can be modified or rerun
      if (hasModifyAction || modifications.length > 0) {
        result = 'modify';
        passed = true;
      } else if (input.level === 'synthesis' && (input.rerunAttempt || 0) < this.MAX_RERUN_ATTEMPTS) {
        result = 'rerun';
        passed = false;
        shouldRerun = true;
        rerunReason = 'Major ethics violation requires regeneration';
        rerunGuidance = this.generateRerunGuidance(violations);
      } else {
        result = 'warn';
        passed = true;
      }
    } else if (warnings.length > 0 || modifications.length > 0) {
      result = modifications.length > 0 ? 'modify' : 'warn';
      passed = true;
    } else {
      result = 'pass';
      passed = true;
    }
    
    // 4. Apply modifications if needed
    let modifiedContent: string | undefined;
    if (modifications.length > 0 && passed) {
      modifiedContent = this.applyModifications(input.content, modifications);
    }
    
    // 5. Log the check
    await this.logEthicsCheck(input, {
      result,
      passed,
      violations,
      warnings,
      frameworksApplied,
    });
    
    return {
      result,
      passed,
      level: input.level,
      domainChecked: input.domain,
      violations,
      warnings,
      modifications,
      modifiedContent,
      domainEthicsResult,
      generalEthicsResult,
      shouldRerun,
      rerunReason,
      rerunGuidance,
      rerunAttempt: input.rerunAttempt || 0,
      maxRerunAttempts: this.MAX_RERUN_ATTEMPTS,
      checkDurationMs: Date.now() - startTime,
      frameworksApplied,
      timestamp: new Date(),
    };
  }
  
  // ============================================================================
  // Rerun Support
  // ============================================================================
  
  /**
   * Generate guidance for rerunning the workflow after ethics violation
   */
  private generateRerunGuidance(violations: EthicsViolationDetail[]): string[] {
    const guidance: string[] = [];
    
    for (const v of violations) {
      if (v.guidance) {
        guidance.push(v.guidance);
      }
      
      // Add type-specific guidance
      if (v.type === 'domain') {
        guidance.push(`Avoid ${v.rule} - this violates ${v.framework || 'professional'} ethics.`);
      } else {
        guidance.push(`Reconsider approach: ${v.description}`);
      }
    }
    
    // Add general guidance
    guidance.push('Focus on providing educational information rather than specific advice.');
    guidance.push('Include appropriate disclaimers and professional referrals.');
    
    return [...new Set(guidance)]; // Deduplicate
  }
  
  /**
   * Prepare prompt modifications for rerun
   */
  async prepareRerun(request: EthicsRerunRequest): Promise<EthicsRerunResult> {
    const guidance = request.guidance;
    const violations = request.violations;
    
    // Build additional instructions to avoid violations
    const additionalInstructions: string[] = [
      '--- ETHICS COMPLIANCE INSTRUCTIONS ---',
      'The previous response contained ethics violations. Please regenerate while:',
    ];
    
    for (const v of violations) {
      additionalInstructions.push(`- AVOID: ${v.description}`);
      if (v.guidance) {
        additionalInstructions.push(`  Instead: ${v.guidance}`);
      }
    }
    
    additionalInstructions.push('');
    additionalInstructions.push('Required compliance:');
    for (const g of guidance) {
      additionalInstructions.push(`- ${g}`);
    }
    
    additionalInstructions.push('--- END ETHICS INSTRUCTIONS ---');
    
    // Identify content to skip
    const skipViolatingContent: string[] = [];
    for (const v of violations) {
      if (v.action === 'block') {
        skipViolatingContent.push(v.rule);
      }
    }
    
    return {
      success: true,
      additionalInstructions,
      skipViolatingContent,
    };
  }
  
  /**
   * Full ethics-aware workflow execution with automatic rerun
   */
  async executeWithEthics(
    input: {
      tenantId: string;
      userId: string;
      sessionId: string;
      promptId: string;
      prompt: string;
      domain?: string;
      subspecialty?: string;
      orchestrationMode?: string;
    },
    generateFn: (prompt: string, additionalInstructions?: string[]) => Promise<string>
  ): Promise<{
    response: string;
    ethicsResults: EthicsPipelineResult[];
    reruns: number;
    finalPassed: boolean;
  }> {
    const ethicsResults: EthicsPipelineResult[] = [];
    let currentPrompt = input.prompt;
    let response = '';
    let reruns = 0;
    
    // 1. Prompt-level check
    const promptCheck = await this.checkPromptLevel({
      ...input,
      content: currentPrompt,
    });
    ethicsResults.push(promptCheck);
    
    if (promptCheck.result === 'block') {
      return {
        response: this.getBlockedResponse(promptCheck),
        ethicsResults,
        reruns: 0,
        finalPassed: false,
      };
    }
    
    // Apply prompt modifications if needed
    if (promptCheck.modifiedContent) {
      currentPrompt = promptCheck.modifiedContent;
    }
    
    // 2. Generate response
    response = await generateFn(currentPrompt);
    
    // 3. Synthesis-level check with rerun loop
    let synthesisCheck: EthicsPipelineResult;
    let additionalInstructions: string[] | undefined;
    
    do {
      synthesisCheck = await this.checkSynthesisLevel({
        ...input,
        content: response,
        rerunAttempt: reruns,
        previousCheck: ethicsResults[ethicsResults.length - 1],
      });
      ethicsResults.push(synthesisCheck);
      
      if (synthesisCheck.shouldRerun && reruns < this.MAX_RERUN_ATTEMPTS) {
        reruns++;
        
        // Prepare rerun
        const rerunPrep = await this.prepareRerun({
          originalPrompt: currentPrompt,
          originalResponse: response,
          violations: synthesisCheck.violations,
          guidance: synthesisCheck.rerunGuidance || [],
          rerunAttempt: reruns,
        });
        
        additionalInstructions = rerunPrep.additionalInstructions;
        
        // Regenerate with ethics guidance
        response = await generateFn(currentPrompt, additionalInstructions);
      }
      
    } while (synthesisCheck.shouldRerun && reruns < this.MAX_RERUN_ATTEMPTS);
    
    // 4. Apply final modifications
    if (synthesisCheck.passed && synthesisCheck.modifiedContent) {
      response = synthesisCheck.modifiedContent;
    } else if (!synthesisCheck.passed && synthesisCheck.result === 'block') {
      response = this.getBlockedResponse(synthesisCheck);
    }
    
    return {
      response,
      ethicsResults,
      reruns,
      finalPassed: synthesisCheck.passed,
    };
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  /**
   * Apply modifications to content
   */
  private applyModifications(content: string, modifications: EthicsModification[]): string {
    let result = content;
    
    // Sort by type: prefix first, then inline, then suffix
    const sorted = [...modifications].sort((a, b) => {
      const order = { prefix: 0, inline: 1, rewrite: 2, suffix: 3 };
      return order[a.type] - order[b.type];
    });
    
    for (const mod of sorted) {
      switch (mod.type) {
        case 'prefix':
          result = mod.replacement + '\n\n' + result;
          break;
        case 'suffix':
          result = result + '\n\n' + mod.replacement;
          break;
        case 'inline':
          if (mod.original) {
            result = result.replace(mod.original, mod.replacement);
          }
          break;
        case 'rewrite':
          result = mod.replacement;
          break;
      }
    }
    
    return result;
  }
  
  /**
   * Generate blocked response message
   */
  private getBlockedResponse(check: EthicsPipelineResult): string {
    const violations = check.violations.filter(v => v.severity === 'critical' || v.action === 'block');
    
    let message = 'I apologize, but I cannot provide this response due to ethical constraints.\n\n';
    
    if (check.domainChecked) {
      message += `This request involves the ${check.domainChecked} domain, which has specific professional ethics requirements.\n\n`;
    }
    
    message += 'Reasons:\n';
    for (const v of violations) {
      message += `• ${v.description}\n`;
    }
    
    message += '\nPlease consider:\n';
    for (const v of violations) {
      if (v.guidance) {
        message += `• ${v.guidance}\n`;
      }
    }
    
    return message;
  }
  
  /**
   * Log ethics check to database
   */
  private async logEthicsCheck(
    input: EthicsCheckInput,
    result: {
      result: EthicsCheckResult;
      passed: boolean;
      violations: EthicsViolationDetail[];
      warnings: EthicsViolationDetail[];
      frameworksApplied: string[];
    }
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO ethics_pipeline_log (
           tenant_id, user_id, session_id, prompt_id,
           check_level, domain, result, passed,
           violation_count, warning_count, frameworks_applied,
           violations, rerun_attempt
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          { name: 'tenantId', value: { stringValue: input.tenantId } },
          { name: 'userId', value: { stringValue: input.userId } },
          { name: 'sessionId', value: { stringValue: input.sessionId } },
          { name: 'promptId', value: { stringValue: input.promptId } },
          { name: 'level', value: { stringValue: input.level } },
          { name: 'domain', value: input.domain ? { stringValue: input.domain } : { isNull: true } },
          { name: 'result', value: { stringValue: result.result } },
          { name: 'passed', value: { booleanValue: result.passed } },
          { name: 'violationCount', value: { longValue: result.violations.length } },
          { name: 'warningCount', value: { longValue: result.warnings.length } },
          { name: 'frameworks', value: { stringValue: JSON.stringify(result.frameworksApplied) } },
          { name: 'violations', value: { stringValue: JSON.stringify(result.violations) } },
          { name: 'rerunAttempt', value: { longValue: input.rerunAttempt || 0 } },
        ]
      );
    } catch (error) {
      logger.error('Failed to log ethics check', error as Error);
    }
  }
  
  // ============================================================================
  // Statistics
  // ============================================================================
  
  /**
   * Get ethics pipeline statistics
   */
  async getStats(tenantId: string, days = 30): Promise<{
    totalChecks: number;
    passRate: number;
    blockRate: number;
    rerunRate: number;
    avgRerunsPerBlocked: number;
    topViolations: Array<{ rule: string; count: number }>;
    byLevel: { prompt: number; synthesis: number; rerun: number };
    byDomain: Array<{ domain: string; checks: number; violations: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const result = await executeStatement(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE passed = true) as passed,
         COUNT(*) FILTER (WHERE result = 'block') as blocked,
         COUNT(*) FILTER (WHERE result = 'rerun') as rerun,
         AVG(rerun_attempt) FILTER (WHERE result = 'block') as avg_reruns,
         COUNT(*) FILTER (WHERE check_level = 'prompt') as prompt_level,
         COUNT(*) FILTER (WHERE check_level = 'synthesis') as synthesis_level,
         COUNT(*) FILTER (WHERE check_level = 'rerun') as rerun_level
       FROM ethics_pipeline_log
       WHERE tenant_id = $1 AND created_at >= $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'startDate', value: { stringValue: startDate.toISOString() } },
      ]
    );
    
    const row = result.records?.[0] as Array<{ longValue?: number; doubleValue?: number }> | undefined;
    
    const total = Number(row?.[0]?.longValue || 0);
    const passed = Number(row?.[1]?.longValue || 0);
    const blocked = Number(row?.[2]?.longValue || 0);
    const rerun = Number(row?.[3]?.longValue || 0);
    const avgReruns = row?.[4]?.doubleValue || 0;
    
    return {
      totalChecks: total,
      passRate: total > 0 ? passed / total : 1,
      blockRate: total > 0 ? blocked / total : 0,
      rerunRate: total > 0 ? rerun / total : 0,
      avgRerunsPerBlocked: avgReruns,
      topViolations: [], // Would need additional query
      byLevel: {
        prompt: Number(row?.[5]?.longValue || 0),
        synthesis: Number(row?.[6]?.longValue || 0),
        rerun: Number(row?.[7]?.longValue || 0),
      },
      byDomain: [], // Would need additional query
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const ethicsPipelineService = new EthicsPipelineService();
