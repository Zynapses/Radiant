/**
 * LIVS-M 2.0 Policy Registry Service
 * 
 * Manages the "Soft Registry" - a JSON-based policy configuration that
 * decouples AI behavior logic from enforcement rules. Admins can modify
 * the registry to change AI team behavior without touching code.
 * 
 * @version 2.0.0
 * @since v7.8.0
 */

import { Pool } from 'pg';
import {
  PolicyRegistry,
  RegistryRule,
  RegistryEnvironmentMode,
  RegistryEnforcementAction,
  RegistryRuleSeverity,
  RegistryMetaConfig,
  RegistryGlobalDirectives,
  RegistryAgentRole,
  RegistryAwareAgentConfig,
  DEFAULT_POLICY_REGISTRY,
  DEFAULT_AGENT_CONFIGS,
  SupervisorValidationResult,
  SupervisorDecision,
} from '@radiant/shared';

export interface PolicyRegistryServiceDeps {
  pool: Pool;
}

export interface RuleViolation {
  rule_id: string;
  rule_name: string;
  severity: RegistryRuleSeverity;
  match?: string;
  message: string;
}

export interface RegistryEvaluationContext {
  agentOutput: string;
  agentRole: RegistryAgentRole;
  interactionTurn: number;
  previousAgentAgreed?: boolean;
  codeBlockPresent?: boolean;
  testBlockPresent?: boolean;
  factualClaimPresent?: boolean;
  citationPresent?: boolean;
  confidenceClaimed?: number;
  evidenceScore?: number;
}

export class PolicyRegistryService {
  private pool: Pool;
  private registryCache: Map<string, { registry: PolicyRegistry; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache

  constructor(deps: PolicyRegistryServiceDeps) {
    this.pool = deps.pool;
  }

  /**
   * Get the policy registry for a tenant
   * Returns default registry if none exists
   */
  async getRegistry(tenantId: string): Promise<PolicyRegistry> {
    // Check cache first
    const cached = this.registryCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.registry;
    }

    const result = await this.pool.query(
      `SELECT registry, updated_at FROM livs_policy_registry WHERE tenant_id = $1`,
      [tenantId]
    );

    let registry: PolicyRegistry;
    if (result.rows.length === 0) {
      registry = this.cloneRegistry(DEFAULT_POLICY_REGISTRY);
    } else {
      registry = this.mergeWithDefaults(result.rows[0].registry);
    }

    // Update cache
    this.registryCache.set(tenantId, { registry, timestamp: Date.now() });

    return registry;
  }

  /**
   * Update the policy registry for a tenant
   */
  async updateRegistry(
    tenantId: string,
    registry: Partial<PolicyRegistry>,
    updatedBy?: string
  ): Promise<PolicyRegistry> {
    const currentRegistry = await this.getRegistry(tenantId);
    const mergedRegistry = this.deepMerge(currentRegistry as any, registry as any) as PolicyRegistry;

    // Update version info
    (mergedRegistry.meta_config as any).last_updated = new Date().toISOString();

    await this.pool.query(
      `INSERT INTO livs_policy_registry (tenant_id, registry, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (tenant_id) DO UPDATE SET
         registry = $2,
         updated_at = NOW(),
         updated_by = $3`,
      [tenantId, JSON.stringify(mergedRegistry), updatedBy]
    );

    // Invalidate cache
    this.registryCache.delete(tenantId);

    return mergedRegistry;
  }

  /**
   * Reset registry to defaults
   */
  async resetRegistry(tenantId: string, updatedBy?: string): Promise<PolicyRegistry> {
    await this.pool.query(
      `DELETE FROM livs_policy_registry WHERE tenant_id = $1`,
      [tenantId]
    );

    // Invalidate cache
    this.registryCache.delete(tenantId);

    return this.cloneRegistry(DEFAULT_POLICY_REGISTRY);
  }

  /**
   * Get the current environment mode
   */
  async getEnvironmentMode(tenantId: string): Promise<RegistryEnvironmentMode> {
    const registry = await this.getRegistry(tenantId);
    return registry.meta_config.environment_mode;
  }

  /**
   * Set the environment mode
   */
  async setEnvironmentMode(
    tenantId: string,
    mode: RegistryEnvironmentMode,
    updatedBy?: string
  ): Promise<void> {
    await this.updateRegistry(
      tenantId,
      { meta_config: { environment_mode: mode } as RegistryMetaConfig },
      updatedBy
    );
  }

  /**
   * Get all active rules for the current mode
   */
  async getActiveRules(tenantId: string): Promise<RegistryRule[]> {
    const registry = await this.getRegistry(tenantId);
    const mode = registry.meta_config.environment_mode;

    return registry.rules_engine
      .filter(rule => {
        if (!rule.is_active) return false;
        if (rule.applies_to_modes && !rule.applies_to_modes.includes(mode)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get a specific rule by ID
   */
  async getRule(tenantId: string, ruleId: string): Promise<RegistryRule | null> {
    const registry = await this.getRegistry(tenantId);
    return registry.rules_engine.find(r => r.id === ruleId) || null;
  }

  /**
   * Add or update a rule
   */
  async upsertRule(
    tenantId: string,
    rule: RegistryRule,
    updatedBy?: string
  ): Promise<PolicyRegistry> {
    const registry = await this.getRegistry(tenantId);
    const existingIndex = registry.rules_engine.findIndex(r => r.id === rule.id);

    if (existingIndex >= 0) {
      registry.rules_engine[existingIndex] = rule;
    } else {
      registry.rules_engine.push(rule);
    }

    return this.updateRegistry(tenantId, registry, updatedBy);
  }

  /**
   * Remove a rule
   */
  async removeRule(
    tenantId: string,
    ruleId: string,
    updatedBy?: string
  ): Promise<PolicyRegistry> {
    const registry = await this.getRegistry(tenantId);
    registry.rules_engine = registry.rules_engine.filter(r => r.id !== ruleId);
    return this.updateRegistry(tenantId, registry, updatedBy);
  }

  /**
   * Enable or disable a rule
   */
  async setRuleActive(
    tenantId: string,
    ruleId: string,
    isActive: boolean,
    updatedBy?: string
  ): Promise<PolicyRegistry> {
    const registry = await this.getRegistry(tenantId);
    const rule = registry.rules_engine.find(r => r.id === ruleId);
    if (rule) {
      rule.is_active = isActive;
    }
    return this.updateRegistry(tenantId, registry, updatedBy);
  }

  /**
   * Get global directives
   */
  async getGlobalDirectives(tenantId: string): Promise<RegistryGlobalDirectives> {
    const registry = await this.getRegistry(tenantId);
    return registry.global_directives;
  }

  /**
   * Update global directives
   */
  async updateGlobalDirectives(
    tenantId: string,
    directives: Partial<RegistryGlobalDirectives>,
    updatedBy?: string
  ): Promise<PolicyRegistry> {
    const registry = await this.getRegistry(tenantId);
    registry.global_directives = { ...registry.global_directives, ...directives };
    return this.updateRegistry(tenantId, registry, updatedBy);
  }

  /**
   * Evaluate an agent output against the registry rules
   * Returns violations found
   */
  async evaluateOutput(
    tenantId: string,
    context: RegistryEvaluationContext
  ): Promise<SupervisorValidationResult> {
    const startTime = Date.now();
    const registry = await this.getRegistry(tenantId);
    const activeRules = await this.getActiveRules(tenantId);
    const mode = registry.meta_config.environment_mode;
    const directives = registry.global_directives;

    const violations: RuleViolation[] = [];
    let patternsMatched = 0;

    for (const rule of activeRules) {
      const violation = this.checkRule(rule, context, mode, directives);
      if (violation) {
        violations.push(violation);
        if (rule.trigger_patterns && rule.trigger_patterns.length > 0) {
          patternsMatched++;
        }
      }
    }

    // Determine decision based on violations
    const decision = this.determineDecision(violations, mode);
    const nextStep = this.determineNextStep(violations, decision);

    const result: SupervisorValidationResult = {
      decision,
      violations,
      processing_time_ms: Date.now() - startTime,
      rules_evaluated: activeRules.length,
      patterns_matched: patternsMatched,
    };

    if (decision === 'REJECT') {
      const mostSevere = violations[0];
      result.violating_agent = context.agentRole;
      result.violation_id = mostSevere?.rule_id;
      result.instruction = this.formatRejectionMessage(
        mostSevere?.message || 'Policy violation detected',
        mode,
        mostSevere?.match
      );
      result.next_step = nextStep;
    } else if (decision === 'INTERVENE') {
      const chaosViolation = violations.find(
        v => v.rule_id === 'R_SYC_01' // Sycophancy detection
      );
      result.target_agent = context.agentRole;
      result.chaos_scenario = 'SYCOPHANCY_BREAK';
      result.instruction = this.getChaosInjectionPrompt(chaosViolation?.rule_id, registry);
      result.next_step = 'CHAOS_AGENT';
    }

    return result;
  }

  /**
   * Check if a specific rule is violated
   */
  private checkRule(
    rule: RegistryRule,
    context: RegistryEvaluationContext,
    mode: RegistryEnvironmentMode,
    directives: RegistryGlobalDirectives
  ): RuleViolation | null {
    // Check pattern-based triggers
    if (rule.trigger_patterns && rule.trigger_patterns.length > 0) {
      for (const pattern of rule.trigger_patterns) {
        try {
          const regex = new RegExp(pattern, 'gi');
          const match = context.agentOutput.match(regex);
          if (match) {
            return {
              rule_id: rule.id,
              rule_name: rule.name,
              severity: rule.severity,
              match: match[0],
              message: rule.rejection_message,
            };
          }
        } catch {
          // Invalid regex, skip
          console.warn(`Invalid regex pattern in rule ${rule.id}: ${pattern}`);
        }
      }
    }

    // Check logic-based conditions
    if (rule.logic_condition) {
      const violated = this.evaluateLogicCondition(rule.logic_condition, context, directives);
      if (violated) {
        return {
          rule_id: rule.id,
          rule_name: rule.name,
          severity: rule.severity,
          message: rule.rejection_message,
        };
      }
    }

    return null;
  }

  /**
   * Evaluate a logic condition string
   */
  private evaluateLogicCondition(
    condition: string,
    context: RegistryEvaluationContext,
    directives: RegistryGlobalDirectives
  ): boolean {
    // Parse simple logic conditions
    // Format: "IF <condition> AND <condition> ..."

    const conditionPart = condition.replace(/^IF\s+/i, '').trim();
    const clauses = conditionPart.split(/\s+AND\s+/i);

    for (const clause of clauses) {
      const match = clause.match(/(\w+)\s*(==|!=|<|>|<=|>=)\s*(.+)/);
      if (!match) continue;

      const [, variable, operator, valueStr] = match;
      const actualValue = this.getContextValue(variable, context, directives);
      const expectedValue = this.parseValue(valueStr.trim());

      if (!this.compareValues(actualValue, operator, expectedValue)) {
        return false; // Condition not met
      }
    }

    return true; // All conditions met = violation
  }

  /**
   * Get value from context or directives
   */
  private getContextValue(
    variable: string,
    context: RegistryEvaluationContext,
    directives: RegistryGlobalDirectives
  ): unknown {
    const contextMap: Record<string, unknown> = {
      current_agent_agreement: context.previousAgentAgreed,
      interaction_turn: context.interactionTurn,
      code_block_present: context.codeBlockPresent,
      test_block_present: context.testBlockPresent,
      factual_claim_present: context.factualClaimPresent,
      citation_present: context.citationPresent,
      confidence_claimed: context.confidenceClaimed,
      evidence_score: context.evidenceScore,
      max_consensus_velocity: directives.max_consensus_velocity,
    };
    return contextMap[variable];
  }

  /**
   * Parse a value string to appropriate type
   */
  private parseValue(valueStr: string): unknown {
    if (valueStr === 'TRUE' || valueStr === 'true') return true;
    if (valueStr === 'FALSE' || valueStr === 'false') return false;
    if (!isNaN(Number(valueStr))) return Number(valueStr);
    return valueStr;
  }

  /**
   * Compare two values with an operator
   */
  private compareValues(actual: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case '==':
        return actual === expected;
      case '!=':
        return actual !== expected;
      case '<':
        return (actual as number) < (expected as number);
      case '>':
        return (actual as number) > (expected as number);
      case '<=':
        return (actual as number) <= (expected as number);
      case '>=':
        return (actual as number) >= (expected as number);
      default:
        return false;
    }
  }

  /**
   * Determine the supervisor decision based on violations
   */
  private determineDecision(
    violations: RuleViolation[],
    mode: RegistryEnvironmentMode
  ): SupervisorDecision {
    if (violations.length === 0) {
      return 'APPROVE';
    }

    // Check for sycophancy violations (require intervention, not rejection)
    const hasSycophancyViolation = violations.some(v => v.rule_id === 'R_SYC_01');
    if (hasSycophancyViolation) {
      return 'INTERVENE';
    }

    // Check severity based on mode
    for (const violation of violations) {
      if (violation.severity === 'CRITICAL') {
        return 'REJECT';
      }
      if (violation.severity === 'BLOCKER' && (mode === 'STRICT_AUDIT' || mode === 'BALANCED')) {
        return 'REJECT';
      }
      if (violation.severity === 'WARNING' && mode === 'STRICT_AUDIT') {
        return 'REJECT';
      }
    }

    // INFO severity or relaxed modes - approve but with flag
    return 'APPROVE';
  }

  /**
   * Determine the next step based on violations
   */
  private determineNextStep(
    violations: RuleViolation[],
    decision: SupervisorDecision
  ): SupervisorValidationResult['next_step'] {
    if (decision === 'APPROVE') {
      return undefined;
    }

    // Find the highest priority violation's action
    const rule = violations[0];
    if (!rule) return 'RETRY';

    // Map enforcement action to next step
    const actionMap: Record<RegistryEnforcementAction, SupervisorValidationResult['next_step']> = {
      REJECT_IMMEDIATE: 'ESCALATE',
      REQUEST_AMENDMENT: 'RETRY',
      TRIGGER_CHAOS_AGENT: 'CHAOS_AGENT',
      TRIGGER_VERIFICATION: 'VERIFICATION_AGENT',
      FLAG_FOR_REVIEW: undefined,
      LOG_ONLY: undefined,
      ESCALATE_TO_HUMAN: 'HANDOFF_TO_USER',
    };

    // Look up the rule from the registry to get its enforcement_action
    // For now, use a default based on severity
    if (rule.severity === 'CRITICAL') {
      return 'RETRY';
    }
    return 'RETRY';
  }

  /**
   * Format a rejection message with placeholders
   */
  private formatRejectionMessage(
    template: string,
    mode: RegistryEnvironmentMode,
    match?: string
  ): string {
    return template
      .replace('{MODE}', mode)
      .replace('{MATCH}', match || 'unknown');
  }

  /**
   * Get the chaos injection prompt for a rule
   */
  private getChaosInjectionPrompt(ruleId: string | undefined, registry: PolicyRegistry): string {
    if (!ruleId) {
      return 'STOP. Challenge the previous assertion. What could be wrong?';
    }

    const rule = registry.rules_engine.find(r => r.id === ruleId);
    return rule?.injection_prompt || 'STOP. Challenge the previous assertion. What could be wrong?';
  }

  /**
   * Get agent configuration for a role
   */
  getAgentConfig(role: RegistryAgentRole): RegistryAwareAgentConfig {
    return DEFAULT_AGENT_CONFIGS[role];
  }

  /**
   * Build the system prompt prefix for an agent based on registry
   */
  async buildAgentSystemPrompt(
    tenantId: string,
    role: RegistryAgentRole
  ): Promise<string> {
    const config = this.getAgentConfig(role);
    const registry = await this.getRegistry(tenantId);
    const mode = registry.meta_config.environment_mode;
    const directives = registry.global_directives;

    let prompt = config.system_prompt_prefix;

    // Add mode awareness
    prompt += `\n\nCurrent Environment Mode: ${mode}`;

    // Add directive awareness based on registry awareness level
    if (config.registry_awareness_level === 'FULL') {
      prompt += `\n\n## Active Directives:\n`;
      prompt += `- Collaboration Style: ${directives.collaboration_style}\n`;
      prompt += `- Mock Data Allowed: ${directives.allow_mock_data}\n`;
      prompt += `- Stubs Allowed: ${directives.allow_stubs}\n`;
      prompt += `- Tests Required: ${directives.require_tests_for_code}\n`;
      prompt += `- Evidence Required: ${directives.require_evidence_for_claims}\n`;
      prompt += `- Max Turns Before Escalation: ${directives.max_agent_turns_before_escalation}\n`;

      // Add active rules summary
      const activeRules = await this.getActiveRules(tenantId);
      if (activeRules.length > 0) {
        prompt += `\n## Active Rules (${activeRules.length}):\n`;
        for (const rule of activeRules.slice(0, 5)) {
          prompt += `- [${rule.severity}] ${rule.name}: ${rule.description || rule.rejection_message}\n`;
        }
        if (activeRules.length > 5) {
          prompt += `- ... and ${activeRules.length - 5} more rules\n`;
        }
      }
    } else if (config.registry_awareness_level === 'RULES_ONLY') {
      prompt += `\n\nKey Policy: No stubs, no placeholders, no incomplete implementations.`;
      if (!directives.allow_mock_data) {
        prompt += ` No mock data.`;
      }
    }

    return prompt;
  }

  /**
   * Log a registry evaluation for audit
   */
  async logEvaluation(
    tenantId: string,
    context: RegistryEvaluationContext,
    result: SupervisorValidationResult
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO livs_registry_evaluations 
       (tenant_id, agent_role, agent_output_preview, decision, violations, 
        rules_evaluated, patterns_matched, processing_time_ms, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        tenantId,
        context.agentRole,
        context.agentOutput.substring(0, 500), // Preview only
        result.decision,
        JSON.stringify(result.violations),
        result.rules_evaluated,
        result.patterns_matched,
        result.processing_time_ms,
      ]
    );
  }

  /**
   * Clone a registry to avoid mutation
   */
  private cloneRegistry(registry: PolicyRegistry): PolicyRegistry {
    return JSON.parse(JSON.stringify(registry));
  }

  /**
   * Merge registry with defaults
   */
  private mergeWithDefaults(partial: Partial<PolicyRegistry>): PolicyRegistry {
    return this.deepMerge(this.cloneRegistry(DEFAULT_POLICY_REGISTRY) as any, partial as any) as PolicyRegistry;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key of Object.keys(source) as Array<keyof T>) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[keyof T];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[keyof T];
      }
    }

    return result;
  }
}
