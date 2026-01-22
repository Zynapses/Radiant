/**
 * Cato Red Team Method (Devil's Advocate)
 * 
 * Adversarial testing method that challenges proposals by:
 * - Finding edge cases and failure modes
 * - Identifying unintended consequences
 * - Stress-testing assumptions
 * - Playing devil's advocate
 */

import { Pool } from 'pg';
import { CatoOutputType, CatoRiskLevel, CatoAccumulatedContext, CatoRiskSignal } from '@radiant/shared';
import { CatoBaseMethodExecutor, MethodExecutionContext, ModelInvocationResult } from '../cato-method-executor.service';
import { CatoMethodRegistryService } from '../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../cato-schema-registry.service';

export interface RedTeamInput {
  proposal: { proposalId: string; title: string; actions: Array<Record<string, unknown>>; rationale: string; assumptions: string[] };
  previousCritiques?: Array<{ criticType: string; issues: Array<Record<string, unknown>> }>;
  focusAreas?: string[];
}

export interface RedTeamAttack {
  attackId: string;
  category: 'edge_case' | 'failure_mode' | 'unintended_consequence' | 'assumption_challenge' | 'adversarial_input' | 'resource_exhaustion' | 'race_condition';
  severity: CatoRiskLevel;
  title: string;
  description: string;
  scenario: string;
  likelihood: number;
  impact: string;
  mitigation: string;
  affectedActions: string[];
}

export interface RedTeamOutput {
  criticType: 'RED_TEAM';
  verdict: 'PROCEED' | 'CAUTION' | 'HIGH_RISK' | 'ABORT';
  overallRiskScore: number;
  attacks: RedTeamAttack[];
  blindSpots: string[];
  worstCaseScenario: { scenario: string; probability: number; impact: string };
  recommendations: string[];
  strengthsAcknowledged: string[];
}

export class CatoRedTeamMethod extends CatoBaseMethodExecutor<RedTeamInput, RedTeamOutput> {
  constructor(pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) {
    super(pool, methodRegistry, schemaRegistry);
  }

  getMethodId(): string { return 'method:red-team:v1'; }
  protected getOutputType(): CatoOutputType { return CatoOutputType.CRITIQUE; }

  protected generateOutputSummary(output: RedTeamOutput): string {
    const criticalAttacks = output.attacks.filter(a => a.severity === CatoRiskLevel.CRITICAL || a.severity === CatoRiskLevel.HIGH).length;
    return `Red Team: ${output.verdict} - ${output.attacks.length} attack vectors identified (${criticalAttacks} high/critical), risk score: ${(output.overallRiskScore * 100).toFixed(0)}%`;
  }

  protected async buildPromptVariables(input: RedTeamInput, context: MethodExecutionContext, prunedContext: CatoAccumulatedContext): Promise<Record<string, unknown>> {
    return {
      proposal: JSON.stringify(input.proposal, null, 2),
      previous_critiques: input.previousCritiques ? JSON.stringify(input.previousCritiques, null, 2) : 'None',
      focus_areas: input.focusAreas?.join(', ') || 'All areas',
    };
  }

  protected async processModelOutput(rawOutput: unknown, context: MethodExecutionContext): Promise<RedTeamOutput> {
    const o = rawOutput as Record<string, unknown>;
    const attacks: RedTeamAttack[] = Array.isArray(o.attacks) ? o.attacks.map((a: unknown, idx: number) => {
      const attack = a as Record<string, unknown>;
      return {
        attackId: String(attack.attackId || `atk_${idx}`),
        category: this.parseCategory(attack.category),
        severity: this.parseRiskLevel(attack.severity),
        title: String(attack.title || ''),
        description: String(attack.description || ''),
        scenario: String(attack.scenario || ''),
        likelihood: Number(attack.likelihood) || 0.5,
        impact: String(attack.impact || ''),
        mitigation: String(attack.mitigation || ''),
        affectedActions: Array.isArray(attack.affectedActions) ? attack.affectedActions as string[] : [],
      };
    }) : [];

    return {
      criticType: 'RED_TEAM',
      verdict: this.parseVerdict(o.verdict),
      overallRiskScore: Number(o.overallRiskScore) || 0.5,
      attacks,
      blindSpots: Array.isArray(o.blindSpots) ? o.blindSpots as string[] : [],
      worstCaseScenario: {
        scenario: String((o.worstCaseScenario as Record<string, unknown>)?.scenario || 'Unknown'),
        probability: Number((o.worstCaseScenario as Record<string, unknown>)?.probability) || 0.1,
        impact: String((o.worstCaseScenario as Record<string, unknown>)?.impact || 'Unknown'),
      },
      recommendations: Array.isArray(o.recommendations) ? o.recommendations as string[] : [],
      strengthsAcknowledged: Array.isArray(o.strengthsAcknowledged) ? o.strengthsAcknowledged as string[] : [],
    };
  }

  protected async detectRiskSignals(output: RedTeamOutput, context: MethodExecutionContext): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];
    
    const criticalAttacks = output.attacks.filter(a => a.severity === CatoRiskLevel.CRITICAL);
    if (criticalAttacks.length > 0) {
      signals.push({
        signalType: 'red_team_critical_attacks',
        severity: CatoRiskLevel.CRITICAL,
        description: `${criticalAttacks.length} critical attack vector(s) identified`,
        source: this.getMethodId(),
        mitigations: criticalAttacks.map(a => a.mitigation),
      });
    }

    if (output.verdict === 'ABORT') {
      signals.push({
        signalType: 'red_team_abort_recommended',
        severity: CatoRiskLevel.CRITICAL,
        description: 'Red Team recommends aborting execution',
        source: this.getMethodId(),
      });
    }

    if (output.blindSpots.length > 3) {
      signals.push({
        signalType: 'multiple_blind_spots',
        severity: CatoRiskLevel.MEDIUM,
        description: `${output.blindSpots.length} blind spots identified in proposal`,
        source: this.getMethodId(),
      });
    }

    return signals;
  }

  private parseCategory(value: unknown): RedTeamAttack['category'] {
    const valid = ['edge_case', 'failure_mode', 'unintended_consequence', 'assumption_challenge', 'adversarial_input', 'resource_exhaustion', 'race_condition'];
    const str = String(value || 'edge_case').toLowerCase();
    return valid.includes(str) ? str as RedTeamAttack['category'] : 'edge_case';
  }

  private parseVerdict(value: unknown): RedTeamOutput['verdict'] {
    const valid = ['PROCEED', 'CAUTION', 'HIGH_RISK', 'ABORT'];
    const str = String(value || 'CAUTION').toUpperCase();
    return valid.includes(str) ? str as RedTeamOutput['verdict'] : 'CAUTION';
  }

  private parseRiskLevel(value: unknown): CatoRiskLevel {
    const str = String(value || 'MEDIUM').toUpperCase();
    return Object.values(CatoRiskLevel).includes(str as CatoRiskLevel) ? str as CatoRiskLevel : CatoRiskLevel.MEDIUM;
  }

  protected async invokeModel(systemPrompt: string, userPrompt: string, context: MethodExecutionContext): Promise<ModelInvocationResult> {
    const { callLiteLLM } = await import('../litellm.service.js');
    const modelId = this.methodDefinition?.defaultModel || 'claude-sonnet-4-20250514';
    const startTime = Date.now();

    const response = await callLiteLLM({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 3000,
    });

    const latencyMs = Date.now() - startTime;
    const tokensInput = response.usage?.prompt_tokens || Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const tokensOutput = response.usage?.completion_tokens || Math.ceil(response.content.length / 4);

    let parsedOutput: RedTeamOutput;
    try {
      parsedOutput = JSON.parse(response.content);
    } catch {
      parsedOutput = {
        criticType: 'RED_TEAM',
        verdict: 'CAUTION',
        overallRiskScore: 0.5,
        attacks: [],
        blindSpots: ['Could not parse structured response'],
        worstCaseScenario: { scenario: 'Unknown - analysis incomplete', probability: 0.5, impact: 'Unknown' },
        recommendations: ['Manual review recommended'],
        strengthsAcknowledged: [],
      };
    }

    const costCents = Math.ceil((tokensInput * 0.003 + tokensOutput * 0.015) / 10);

    return {
      response: response.content,
      parsedOutput,
      tokensInput,
      tokensOutput,
      costCents,
      latencyMs,
      modelId,
      provider: 'anthropic',
    };
  }
}

export const createRedTeamMethod = (pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) => new CatoRedTeamMethod(pool, methodRegistry, schemaRegistry);
