/**
 * LIVS-M 2.0 Registry-Aware Worker Prompts Service
 * 
 * Builds system prompts for worker agents (Thesis, Antithesis, Synthesis, etc.)
 * that are aware of the Policy Registry and enforce governance rules.
 * 
 * @version 2.0.0
 * @since v7.8.0
 */

import { Pool } from 'pg';
import {
  RegistryAgentRole,
  RegistryAwareAgentConfig,
  RegistryEnvironmentMode,
  DEFAULT_AGENT_CONFIGS,
} from '@radiant/shared';
import { PolicyRegistryService } from './policy-registry.service';

export interface WorkerPromptsServiceDeps {
  pool: Pool;
  policyRegistryService: PolicyRegistryService;
}

export interface WorkerPromptContext {
  tenantId: string;
  role: RegistryAgentRole;
  taskDescription: string;
  previousOutput?: string;
  interactionTurn: number;
  customInstructions?: string;
}

export class LIVSWorkerPromptsService {
  private pool: Pool;
  private policyRegistryService: PolicyRegistryService;

  constructor(deps: WorkerPromptsServiceDeps) {
    this.pool = deps.pool;
    this.policyRegistryService = deps.policyRegistryService;
  }

  /**
   * Build a complete system prompt for a worker agent
   */
  async buildWorkerPrompt(context: WorkerPromptContext): Promise<string> {
    const { tenantId, role, taskDescription, previousOutput, interactionTurn } = context;
    
    const config = this.getAgentConfig(role);
    const registry = await this.policyRegistryService.getRegistry(tenantId);
    const mode = registry.meta_config.environment_mode;
    const directives = registry.global_directives;

    let prompt = '';

    // Role-specific base prompt
    prompt += this.getRoleBasePrompt(role, mode);

    // Registry awareness injection
    if (config.registry_awareness_level !== 'NONE') {
      prompt += await this.getRegistryAwarenessBlock(tenantId, config.registry_awareness_level);
    }

    // Environment mode context
    prompt += this.getEnvironmentModeBlock(mode);

    // Directive constraints
    prompt += this.getDirectiveConstraintsBlock(directives);

    // Role-specific behavior
    prompt += this.getRoleBehaviorBlock(role, directives);

    // Previous output context (for multi-turn)
    if (previousOutput && config.can_see_other_agent_outputs) {
      prompt += this.getPreviousOutputBlock(previousOutput, interactionTurn);
    }

    // Custom instructions
    if (context.customInstructions) {
      prompt += `\n\n## Custom Instructions\n${context.customInstructions}`;
    }

    return prompt;
  }

  /**
   * Get the agent configuration for a role
   */
  getAgentConfig(role: RegistryAgentRole): RegistryAwareAgentConfig {
    return DEFAULT_AGENT_CONFIGS[role];
  }

  /**
   * Get the base prompt for a specific role
   */
  private getRoleBasePrompt(role: RegistryAgentRole, mode: RegistryEnvironmentMode): string {
    const rolePrompts: Record<RegistryAgentRole, string> = {
      THESIS_AGENT: `# THESIS AGENT - Primary Engineer

You are the **Lead Engineer**. Your role is to produce high-quality, complete implementations.

## Core Responsibilities
1. Write **complete, functional code** - no stubs, no placeholders
2. Implement **all edge cases** and error handling
3. Provide **tests or verification** for your implementations
4. Support claims with **evidence or reasoning**

## Critical Constraints
- The **Supervisor** will automatically REJECT any output containing:
  - Stub patterns (\`pass\`, \`...\`, \`// TODO\`, etc.)
  - Placeholder text ("coming soon", "not yet implemented")
  - Mock data in production code
  - Incomplete implementations

You are operating in **${mode}** mode. Act accordingly.`,

      ANTITHESIS_AGENT: `# ANTITHESIS AGENT - Forensic Auditor

You are the **Forensic Auditor**. Your goal is to enforce the Policy Registry and find flaws.

## Core Responsibilities
1. **Scrutinize** every submission for policy violations
2. **Challenge** assumptions and unverified claims
3. **Identify** stubs, placeholders, and incomplete implementations
4. **Attack** any code that could fail in production

## Critical Mandate
- "We will add this later" is a **FAILURE CONDITION**
- "This should work" without tests is **UNACCEPTABLE**
- Agreement without critical analysis is **SYCOPHANCY**

You are the last line of defense against shipping broken code.
Current environment: **${mode}** mode.`,

      SYNTHESIS_AGENT: `# SYNTHESIS AGENT - Reconciler

You are the **Reconciler**. Your role is to synthesize the best solution from competing perspectives.

## Core Responsibilities
1. **Review** both Thesis and Antithesis outputs objectively
2. **Identify** valid criticisms that must be addressed
3. **Preserve** the core solution while fixing issues
4. **Produce** a final implementation that satisfies all constraints

## Synthesis Protocol
- Do NOT blindly accept Thesis - validate against Antithesis critiques
- Do NOT over-engineer to satisfy every nitpick
- Find the **optimal balance** between completeness and pragmatism

Current environment: **${mode}** mode.`,

      SUPERVISOR: `# SUPERVISOR - Governance Engine

You are the **LIVS-M Governance Supervisor**. You do not write code; you enforce the Law.

## Your Protocol
1. **SCAN** every submission against the Policy Registry rules
2. **MATCH** patterns and evaluate logic conditions
3. **DECIDE**: APPROVE, REJECT, or INTERVENE
4. **RESPOND** with structured decisions only

You are ZERO TEMPERATURE. You do not speculate. You enforce.`,

      CHAOS_AGENT: `# CHAOS AGENT - Devil's Advocate

You are the **Devil's Advocate**. Your job is to break things.

## Core Responsibilities
1. **Find flaws** that others missed
2. **Probe edge cases** - null, empty, negative, concurrent, failure modes
3. **Challenge assumptions** - what if the input is malicious?
4. **Stress test** the solution - what breaks under load?

## Operating Principle
Assume **EVERYTHING IS WRONG** until proven otherwise.
Your goal is NOT to be helpful - it's to be **adversarial**.`,

      VERIFICATION_AGENT: `# VERIFICATION AGENT - Fact Checker

You are the **Verification Agent**. Your job is to verify claims and validate code.

## Core Responsibilities
1. **Test code** - does it actually work?
2. **Verify claims** - is there evidence?
3. **Validate logic** - are the steps correct?
4. **Check completeness** - are all cases handled?

## Output Standards
- Return only **facts**, not opinions
- Provide **specific evidence** for each finding
- Mark unverifiable claims as **UNVERIFIED**`,
    };

    return rolePrompts[role] || rolePrompts.THESIS_AGENT;
  }

  /**
   * Get the registry awareness block
   */
  private async getRegistryAwarenessBlock(
    tenantId: string,
    level: 'FULL' | 'RULES_ONLY' | 'NONE'
  ): Promise<string> {
    if (level === 'NONE') return '';

    const registry = await this.policyRegistryService.getRegistry(tenantId);
    const activeRules = await this.policyRegistryService.getActiveRules(tenantId);

    if (level === 'RULES_ONLY') {
      return `

## Policy Awareness (Summary)
You are operating under the **LIVS-M 2.0 Policy Registry**.
- **No stubs, placeholders, or incomplete implementations**
- **No mock data** in production code
- **Tests required** for code submissions
- **Evidence required** for factual claims

Violations will result in automatic rejection.`;
    }

    // FULL awareness
    return `

## Policy Registry (Full)

### Active Environment
- **Mode**: ${registry.meta_config.environment_mode}
- **Version**: ${registry.meta_config.version}

### Global Directives
- Collaboration Style: ${registry.global_directives.collaboration_style}
- Mock Data Allowed: ${registry.global_directives.allow_mock_data}
- Stubs Allowed: ${registry.global_directives.allow_stubs}
- Tests Required: ${registry.global_directives.require_tests_for_code}
- Evidence Required: ${registry.global_directives.require_evidence_for_claims}
- Max Turns Before Escalation: ${registry.global_directives.max_agent_turns_before_escalation}
- Chaos Injection Enabled: ${registry.global_directives.enable_chaos_injection}

### Active Rules (${activeRules.length})
${activeRules.slice(0, 10).map(rule => 
  `- **[${rule.severity}] ${rule.id}**: ${rule.name}\n  Action: ${rule.enforcement_action}`
).join('\n')}
${activeRules.length > 10 ? `\n... and ${activeRules.length - 10} more rules` : ''}`;
  }

  /**
   * Get environment mode specific block
   */
  private getEnvironmentModeBlock(mode: RegistryEnvironmentMode): string {
    const modeDescriptions: Record<RegistryEnvironmentMode, string> = {
      STRICT_AUDIT: `

## Environment: STRICT_AUDIT 🔒
- **ALL warnings are blockers** - nothing slips through
- **Maximum scrutiny** - every claim must be verified
- **Zero tolerance** for incomplete implementations
- This is production-critical work.`,

      BALANCED: `

## Environment: BALANCED ⚖️
- **Normal enforcement** - critical and blocker issues rejected
- **Warnings flagged** but may proceed with justification
- **Standard quality** expectations apply`,

      RAPID_PROTO: `

## Environment: RAPID_PROTO ⚡
- **Relaxed enforcement** for rapid iteration
- **Critical issues still blocked** but warnings are logged
- **Speed over perfection** - but still no stubs in deliverables`,

      HACKATHON: `

## Environment: HACKATHON 🎉
- **Minimal enforcement** for experimentation
- **Only critical safety issues blocked**
- **Creative freedom** - but document limitations`,
    };

    return modeDescriptions[mode];
  }

  /**
   * Get directive constraints block
   */
  private getDirectiveConstraintsBlock(directives: {
    allow_mock_data: boolean;
    allow_stubs: boolean;
    require_tests_for_code: boolean;
    require_evidence_for_claims: boolean;
  }): string {
    const constraints: string[] = [];

    if (!directives.allow_stubs) {
      constraints.push('❌ **NO STUBS** - Every function must be fully implemented');
    }
    if (!directives.allow_mock_data) {
      constraints.push('❌ **NO MOCK DATA** - Use real data sources or clearly mark as example');
    }
    if (directives.require_tests_for_code) {
      constraints.push('✅ **TESTS REQUIRED** - Include verification code or test cases');
    }
    if (directives.require_evidence_for_claims) {
      constraints.push('✅ **EVIDENCE REQUIRED** - Support factual claims with sources');
    }

    if (constraints.length === 0) return '';

    return `

## Constraints
${constraints.join('\n')}`;
  }

  /**
   * Get role-specific behavior block
   */
  private getRoleBehaviorBlock(
    role: RegistryAgentRole,
    directives: { collaboration_style: string; max_consensus_velocity: number }
  ): string {
    if (directives.collaboration_style === 'ADVERSARIAL') {
      if (role === 'THESIS_AGENT') {
        return `

## Adversarial Mode Active
Your work will be **aggressively challenged** by the Antithesis Agent.
- Anticipate criticisms and address them proactively
- Provide evidence for every design decision
- Document edge cases you've considered`;
      }
      if (role === 'ANTITHESIS_AGENT') {
        return `

## Adversarial Mode Active
You are expected to **rigorously challenge** the Thesis Agent.
- Do NOT agree quickly - find at least 3 potential issues
- Question every assumption
- The max consensus velocity is **${directives.max_consensus_velocity}** turns
- Agreement before turn ${directives.max_consensus_velocity} triggers **SYCOPHANCY DETECTION**`;
      }
    }

    return '';
  }

  /**
   * Get previous output context block
   */
  private getPreviousOutputBlock(previousOutput: string, interactionTurn: number): string {
    return `

## Previous Agent Output (Turn ${interactionTurn - 1})
\`\`\`
${previousOutput.substring(0, 4000)}${previousOutput.length > 4000 ? '\n... [truncated]' : ''}
\`\`\`

Analyze and respond to the above output according to your role.`;
  }

  /**
   * Build a quick rejection prompt for the Supervisor
   */
  buildRejectionFeedback(
    violations: Array<{ rule_id: string; rule_name: string; severity: string; message: string }>,
    mode: RegistryEnvironmentMode
  ): string {
    return `## Submission REJECTED

Your submission violated the following policies:

${violations.map(v => `### ❌ [${v.severity}] ${v.rule_name} (${v.rule_id})
${v.message}
`).join('\n')}

**Current Mode**: ${mode}

Please revise your submission to address these violations and resubmit.`;
  }

  /**
   * Build a chaos injection prompt
   */
  buildChaosPrompt(scenario: string, previousOutput: string): string {
    const scenarios: Record<string, string> = {
      SYCOPHANCY_BREAK: `## ⚠️ SYCOPHANCY ALERT

Consensus was reached too quickly. This indicates potential groupthink.

**Your task**: Challenge the following assertion. Assume it is **WRONG**.
Find at least 3 flaws, edge cases, or potential failures.

Previous output to challenge:
\`\`\`
${previousOutput.substring(0, 3000)}
\`\`\`

What could be incorrect about this approach?`,

      EDGE_CASE_PROBE: `## 🔍 EDGE CASE PROBE

Consider boundary conditions for the following implementation:

\`\`\`
${previousOutput.substring(0, 3000)}
\`\`\`

Test against:
- Null/undefined inputs
- Empty arrays/strings
- Negative numbers
- Maximum values (MAX_INT, etc.)
- Unicode edge cases
- Concurrent access
- Network failures

Which of these could break this solution?`,

      ASSUMPTION_AUDIT: `## 📋 ASSUMPTION AUDIT

List every assumption made in the following solution:

\`\`\`
${previousOutput.substring(0, 3000)}
\`\`\`

For each assumption:
1. State the assumption clearly
2. Explain what happens if it's false
3. Rate the risk (HIGH/MEDIUM/LOW)

Which assumptions are most dangerous?`,
    };

    return scenarios[scenario] || scenarios.SYCOPHANCY_BREAK;
  }

  /**
   * Log prompt generation for audit
   */
  async logPromptGeneration(
    tenantId: string,
    role: RegistryAgentRole,
    promptLength: number,
    context: Partial<WorkerPromptContext>
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO livs_prompt_generation_log 
         (tenant_id, agent_role, prompt_length, interaction_turn, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [tenantId, role, promptLength, context.interactionTurn || 1]
      );
    } catch {
      // Logging failed, continue silently
    }
  }
}
