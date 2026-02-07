/**
 * LIVS-M 2.0 Governance Supervisor Service
 * 
 * The Supervisor acts as a "Governance Engine" - it does not write code,
 * it enforces the Law. The Law is defined in the Policy Registry.
 * 
 * This service turns an LLM into a policy enforcement engine by:
 * 1. Injecting the registry rules as system context
 * 2. Analyzing agent outputs for violations
 * 3. Returning structured decisions (APPROVE/REJECT/INTERVENE)
 * 
 * @version 2.0.0
 * @since v7.8.0
 */

import { Pool } from 'pg';
import {
  PolicyRegistry,
  RegistryAgentRole,
  RegistryEnvironmentMode,
  SupervisorValidationResult,
  SupervisorDecision,
  RegistryRuleSeverity,
  DEFAULT_AGENT_CONFIGS,
} from '@radiant/shared';
import { PolicyRegistryService, RegistryEvaluationContext } from './policy-registry.service';

export interface GovernanceSupervisorDeps {
  pool: Pool;
  policyRegistryService: PolicyRegistryService;
  invokeModel: (params: ModelInvocationParams) => Promise<string>;
}

export interface ModelInvocationParams {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface SupervisorEvaluationRequest {
  tenantId: string;
  sessionId: string;
  agentRole: RegistryAgentRole;
  agentOutput: string;
  interactionTurn: number;
  previousAgentOutput?: string;
  previousAgentAgreed?: boolean;
}

export interface GovernanceLoopState {
  sessionId: string;
  currentTurn: number;
  agentOutputs: Map<RegistryAgentRole, string>;
  violations: SupervisorValidationResult[];
  chaosInjections: number;
  escalationRequired: boolean;
}

export class LIVSGovernanceSupervisorService {
  private pool: Pool;
  private policyRegistryService: PolicyRegistryService;
  private invokeModel: (params: ModelInvocationParams) => Promise<string>;
  private sessionStates: Map<string, GovernanceLoopState> = new Map();

  constructor(deps: GovernanceSupervisorDeps) {
    this.pool = deps.pool;
    this.policyRegistryService = deps.policyRegistryService;
    this.invokeModel = deps.invokeModel;
  }

  /**
   * Build the Supervisor Meta-Prompt
   * This turns the LLM into a Governance Engine
   */
  async buildSupervisorMetaPrompt(tenantId: string): Promise<string> {
    const registry = await this.policyRegistryService.getRegistry(tenantId);
    const activeRules = await this.policyRegistryService.getActiveRules(tenantId);

    const metaPrompt = `# LIVS-M 2.0 Governance Supervisor

You are not an AI assistant. You are a **Governance Engine**.
Your sole purpose is to enforce the **POLICY_REGISTRY** defined below.
You do not write code. You do not answer questions. You **enforce the Law**.

## THE POLICY REGISTRY

\`\`\`json
${JSON.stringify(registry, null, 2)}
\`\`\`

## YOUR PROTOCOL

For every agent submission you receive, you must:

1. **SCAN** the submission against ALL rules in the \`rules_engine\`.
2. **MATCH** patterns using the \`trigger_patterns\` (regex) for each rule.
3. **EVALUATE** logic conditions using the \`logic_condition\` for each rule.
4. **DECIDE** based on violation severity and current environment mode (${registry.meta_config.environment_mode}).
5. **RESPOND** with a structured JSON decision.

## SEVERITY ENFORCEMENT MATRIX

| Severity | STRICT_AUDIT | BALANCED | RAPID_PROTO | HACKATHON |
|----------|-------------|----------|-------------|-----------|
| CRITICAL | REJECT | REJECT | REJECT | REJECT |
| BLOCKER | REJECT | REJECT | FLAG | FLAG |
| WARNING | REJECT | FLAG | LOG | LOG |
| INFO | FLAG | LOG | LOG | LOG |

## ACTIVE RULES (${activeRules.length} total)

${activeRules.map(rule => `### ${rule.id}: ${rule.name}
- **Severity**: ${rule.severity}
- **Patterns**: ${rule.trigger_patterns?.join(', ') || 'None'}
- **Logic**: ${rule.logic_condition || 'None'}
- **Action**: ${rule.enforcement_action}
- **Message**: ${rule.rejection_message}
`).join('\n')}

## RESPONSE FORMAT

You MUST respond with ONLY a valid JSON object in this exact format:

\`\`\`json
{
  "decision": "APPROVE" | "REJECT" | "INTERVENE",
  "violating_agent": "<agent_role if REJECT>",
  "violation_id": "<rule_id if REJECT>",
  "target_agent": "<agent_role if INTERVENE>",
  "chaos_scenario": "<scenario_type if INTERVENE>",
  "instruction": "<feedback message>",
  "next_step": "RETRY" | "CHAOS_AGENT" | "VERIFICATION_AGENT" | "HANDOFF_TO_USER" | "ESCALATE",
  "violations": [
    {
      "rule_id": "<rule_id>",
      "rule_name": "<rule_name>",
      "severity": "<severity>",
      "match": "<matched_text>",
      "message": "<violation_message>"
    }
  ],
  "reasoning": "<brief explanation of your decision>"
}
\`\`\`

## CRITICAL RULES

1. **NEVER** approve submissions containing stub patterns in STRICT_AUDIT or BALANCED mode.
2. **ALWAYS** trigger CHAOS_AGENT when agents agree too quickly (sycophancy detection).
3. **ALWAYS** include the matched text in violations when rejecting.
4. You are ZERO TEMPERATURE. You do not speculate. You enforce.

Current Environment Mode: **${registry.meta_config.environment_mode}**
Max Consensus Velocity: **${registry.global_directives.max_consensus_velocity}** turns`;

    return metaPrompt;
  }

  /**
   * Evaluate an agent output using the Supervisor
   */
  async evaluate(request: SupervisorEvaluationRequest): Promise<SupervisorValidationResult> {
    const startTime = Date.now();
    const { tenantId, sessionId, agentRole, agentOutput, interactionTurn, previousAgentOutput, previousAgentAgreed } = request;

    // Get or create session state
    let state = this.sessionStates.get(sessionId);
    if (!state) {
      state = {
        sessionId,
        currentTurn: 0,
        agentOutputs: new Map(),
        violations: [],
        chaosInjections: 0,
        escalationRequired: false,
      };
      this.sessionStates.set(sessionId, state);
    }

    state.currentTurn = interactionTurn;
    state.agentOutputs.set(agentRole, agentOutput);

    // First, do a fast pattern-based check using PolicyRegistryService
    const context: RegistryEvaluationContext = {
      agentOutput,
      agentRole,
      interactionTurn,
      previousAgentAgreed,
      codeBlockPresent: this.detectCodeBlock(agentOutput),
      testBlockPresent: this.detectTestBlock(agentOutput),
      factualClaimPresent: this.detectFactualClaim(agentOutput),
      citationPresent: this.detectCitation(agentOutput),
      confidenceClaimed: this.estimateConfidence(agentOutput),
      evidenceScore: this.estimateEvidenceScore(agentOutput),
    };

    // Fast path: Use PolicyRegistryService for pattern matching
    const fastResult = await this.policyRegistryService.evaluateOutput(tenantId, context);

    // If fast path found critical violations, use that result
    if (fastResult.decision === 'REJECT' || fastResult.decision === 'INTERVENE') {
      await this.logInteraction(tenantId, sessionId, agentRole, interactionTurn, agentOutput, fastResult);
      return fastResult;
    }

    // Slow path: Use LLM Supervisor for nuanced analysis (optional, for complex cases)
    const registry = await this.policyRegistryService.getRegistry(tenantId);
    if (registry.global_directives.collaboration_style === 'ADVERSARIAL' && interactionTurn > 1) {
      const llmResult = await this.invokeSupervsorLLM(tenantId, agentRole, agentOutput, context);
      if (llmResult) {
        await this.logInteraction(tenantId, sessionId, agentRole, interactionTurn, agentOutput, llmResult);
        return llmResult;
      }
    }

    // Default: Approve
    const result: SupervisorValidationResult = {
      decision: 'APPROVE',
      violations: [],
      processing_time_ms: Date.now() - startTime,
      rules_evaluated: fastResult.rules_evaluated,
      patterns_matched: fastResult.patterns_matched,
    };

    await this.logInteraction(tenantId, sessionId, agentRole, interactionTurn, agentOutput, result);
    return result;
  }

  /**
   * Invoke the Supervisor LLM for nuanced analysis
   */
  private async invokeSupervsorLLM(
    tenantId: string,
    agentRole: RegistryAgentRole,
    agentOutput: string,
    context: RegistryEvaluationContext
  ): Promise<SupervisorValidationResult | null> {
    try {
      const systemPrompt = await this.buildSupervisorMetaPrompt(tenantId);
      const supervisorConfig = DEFAULT_AGENT_CONFIGS.SUPERVISOR;

      const userPrompt = `## Agent Submission

**Agent Role**: ${agentRole}
**Interaction Turn**: ${context.interactionTurn}
**Previous Agent Agreed**: ${context.previousAgentAgreed ?? 'N/A'}

### Agent Output:
\`\`\`
${agentOutput.substring(0, 8000)} ${agentOutput.length > 8000 ? '... [truncated]' : ''}
\`\`\`

### Context Flags:
- Code Block Present: ${context.codeBlockPresent}
- Test Block Present: ${context.testBlockPresent}
- Factual Claim Present: ${context.factualClaimPresent}
- Citation Present: ${context.citationPresent}
- Confidence Claimed: ${context.confidenceClaimed?.toFixed(2) ?? 'N/A'}
- Evidence Score: ${context.evidenceScore?.toFixed(2) ?? 'N/A'}

Evaluate this submission against the POLICY_REGISTRY and respond with your decision.`;

      const response = await this.invokeModel({
        modelId: 'claude-3-5-sonnet-20241022', // Use capable model for supervision
        systemPrompt,
        userPrompt,
        temperature: supervisorConfig.temperature,
        maxTokens: supervisorConfig.max_tokens_per_response,
      });

      // Parse the LLM response
      return this.parseSupervisorResponse(response, context);
    } catch (error) {
      console.error('Supervisor LLM invocation failed:', error);
      return null;
    }
  }

  /**
   * Parse the Supervisor LLM response into a structured result
   */
  private parseSupervisorResponse(
    response: string,
    context: RegistryEvaluationContext
  ): SupervisorValidationResult | null {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.match(/\{[\s\S]*"decision"[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.warn('Could not extract JSON from supervisor response');
        return null;
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!['APPROVE', 'REJECT', 'INTERVENE'].includes(parsed.decision)) {
        console.warn('Invalid supervisor decision:', parsed.decision);
        return null;
      }

      const result: SupervisorValidationResult = {
        decision: parsed.decision as SupervisorDecision,
        violations: parsed.violations || [],
        processing_time_ms: 0, // Will be set by caller
        rules_evaluated: 0,
        patterns_matched: 0,
      };

      if (parsed.violating_agent) result.violating_agent = parsed.violating_agent;
      if (parsed.violation_id) result.violation_id = parsed.violation_id;
      if (parsed.target_agent) result.target_agent = parsed.target_agent;
      if (parsed.chaos_scenario) result.chaos_scenario = parsed.chaos_scenario;
      if (parsed.instruction) result.instruction = parsed.instruction;
      if (parsed.next_step) result.next_step = parsed.next_step;

      return result;
    } catch (error) {
      console.error('Failed to parse supervisor response:', error);
      return null;
    }
  }

  /**
   * Get the chaos injection prompt for breaking sycophancy
   */
  async getChaosInjectionPrompt(tenantId: string, scenario: string): Promise<string> {
    const registry = await this.policyRegistryService.getRegistry(tenantId);
    
    const sycophancyRule = registry.rules_engine.find(r => r.id === 'R_SYC_01');
    if (sycophancyRule?.injection_prompt) {
      return sycophancyRule.injection_prompt;
    }

    // Default chaos prompts by scenario
    const chaosPrompts: Record<string, string> = {
      SYCOPHANCY_BREAK: 'STOP. Assume the previous assertion is WRONG. Your job is to find flaws, not to agree. What could be incorrect about this approach? List at least 3 potential problems.',
      EDGE_CASE_PROBE: 'What happens at the boundaries? Consider: null inputs, empty arrays, negative numbers, unicode edge cases, concurrent access, network failures. Which of these could break this solution?',
      ADVERSARIAL_CHALLENGE: 'You are now the Red Team. Your goal is to break this implementation. Find security vulnerabilities, race conditions, or logical flaws that could be exploited.',
      ASSUMPTION_AUDIT: 'List every assumption made in this solution. For each assumption, explain what happens if it is false. Which assumptions are most dangerous?',
    };

    return chaosPrompts[scenario] || chaosPrompts.SYCOPHANCY_BREAK;
  }

  /**
   * Build a registry-aware prompt for a worker agent
   */
  async buildWorkerPrompt(
    tenantId: string,
    role: RegistryAgentRole
  ): Promise<string> {
    return this.policyRegistryService.buildAgentSystemPrompt(tenantId, role);
  }

  /**
   * Check if escalation to human is required
   */
  async shouldEscalate(tenantId: string, sessionId: string): Promise<boolean> {
    const state = this.sessionStates.get(sessionId);
    if (!state) return false;

    const registry = await this.policyRegistryService.getRegistry(tenantId);
    const maxTurns = registry.global_directives.max_agent_turns_before_escalation;

    return state.currentTurn >= maxTurns || state.escalationRequired;
  }

  /**
   * Log an interaction for audit
   */
  private async logInteraction(
    tenantId: string,
    sessionId: string,
    agentRole: RegistryAgentRole,
    interactionTurn: number,
    agentOutput: string,
    result: SupervisorValidationResult
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO livs_agent_interactions 
         (tenant_id, session_id, agent_role, interaction_turn, output_preview, 
          supervisor_decision, violations, processing_time_ms, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          tenantId,
          sessionId,
          agentRole,
          interactionTurn,
          agentOutput.substring(0, 500),
          result.decision,
          JSON.stringify(result.violations),
          result.processing_time_ms,
        ]
      );
    } catch (error) {
      console.error('Failed to log interaction:', error);
    }
  }

  /**
   * Clear session state
   */
  clearSession(sessionId: string): void {
    this.sessionStates.delete(sessionId);
  }

  // Detection helpers
  private detectCodeBlock(text: string): boolean {
    return /```[\s\S]*?```/.test(text) || 
           /^\s{4}[\s\S]+$/m.test(text) ||
           /\bfunction\b|\bclass\b|\bconst\b|\blet\b|\bvar\b|\bdef\b|\basync\b/.test(text);
  }

  private detectTestBlock(text: string): boolean {
    return /\b(test|it|describe|expect|assert|should)\s*\(/.test(text) ||
           /\b(unittest|pytest|jest|mocha|jasmine)\b/i.test(text) ||
           /test_\w+|_test\./.test(text);
  }

  private detectFactualClaim(text: string): boolean {
    return /\b(research shows|studies indicate|according to|data suggests|statistically|proven|fact)\b/i.test(text) ||
           /\b(always|never|must|will definitely|guaranteed to)\b/i.test(text);
  }

  private detectCitation(text: string): boolean {
    return /\[[\d]+\]|\(\d{4}\)|https?:\/\/|doi:|arxiv:|isbn:/i.test(text) ||
           /\b(source:|reference:|citation:|according to \w+ et al\.)/i.test(text);
  }

  private estimateConfidence(text: string): number {
    const highConfidencePatterns = /\b(definitely|certainly|absolutely|100%|guaranteed|always|never)\b/gi;
    const lowConfidencePatterns = /\b(maybe|perhaps|possibly|might|could|uncertain|unclear)\b/gi;
    
    const highMatches = (text.match(highConfidencePatterns) || []).length;
    const lowMatches = (text.match(lowConfidencePatterns) || []).length;
    
    if (highMatches === 0 && lowMatches === 0) return 0.5;
    return Math.min(1, Math.max(0, 0.5 + (highMatches * 0.1) - (lowMatches * 0.1)));
  }

  private estimateEvidenceScore(text: string): number {
    let score = 0;
    
    // Code with tests
    if (this.detectCodeBlock(text) && this.detectTestBlock(text)) score += 0.3;
    
    // Citations
    if (this.detectCitation(text)) score += 0.2;
    
    // Quantitative data
    if (/\d+(\.\d+)?%|\d+\/\d+|\b\d+\s*(times|cases|instances)\b/i.test(text)) score += 0.2;
    
    // Explicit reasoning
    if (/\b(because|therefore|thus|hence|since|as a result)\b/i.test(text)) score += 0.15;
    
    // Acknowledges limitations
    if (/\b(however|although|limitation|caveat|note that)\b/i.test(text)) score += 0.15;
    
    return Math.min(1, score);
  }
}
