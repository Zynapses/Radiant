/**
 * Cato Decider Method
 * 
 * Synthesizes critiques from multiple critics and makes a final decision.
 * Used in War Room deliberation pipelines.
 */

import { Pool } from 'pg';
import { CatoOutputType, CatoRiskLevel, CatoAccumulatedContext, CatoRiskSignal } from '@radiant/shared';
import { CatoBaseMethodExecutor, MethodExecutionContext, ModelInvocationResult } from '../cato-method-executor.service';
import { CatoMethodRegistryService } from '../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../cato-schema-registry.service';

export interface DeciderInput {
  proposal: { proposalId: string; title: string; actions: Array<Record<string, unknown>> };
  critiques: Array<{ criticType: string; verdict: string; score: number; issues: Array<Record<string, unknown>>; recommendations: string[] }>;
  context?: Record<string, unknown>;
}

export interface DeciderOutput {
  decision: 'PROCEED' | 'PROCEED_WITH_MODIFICATIONS' | 'BLOCK' | 'ESCALATE';
  confidence: number;
  reasoning: string;
  synthesizedIssues: Array<{ issueId: string; severity: CatoRiskLevel; description: string; source: string; resolution: string }>;
  requiredModifications: string[];
  acceptedRisks: string[];
  dissent: Array<{ criticType: string; objection: string; weight: number }>;
  consensusLevel: 'UNANIMOUS' | 'MAJORITY' | 'SPLIT' | 'DEADLOCK';
  nextSteps: string[];
}

export class CatoDeciderMethod extends CatoBaseMethodExecutor<DeciderInput, DeciderOutput> {
  constructor(pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) {
    super(pool, methodRegistry, schemaRegistry);
  }

  getMethodId(): string { return 'method:decider:v1'; }
  protected getOutputType(): CatoOutputType { return CatoOutputType.JUDGMENT; }

  protected generateOutputSummary(output: DeciderOutput): string {
    return `Decision: ${output.decision} (${output.consensusLevel} consensus, ${(output.confidence * 100).toFixed(0)}% confidence)`;
  }

  protected async buildPromptVariables(input: DeciderInput, context: MethodExecutionContext, prunedContext: CatoAccumulatedContext): Promise<Record<string, unknown>> {
    return { proposal: JSON.stringify(input.proposal, null, 2), critiques: JSON.stringify(input.critiques, null, 2), governance_preset: context.governancePreset };
  }

  protected async processModelOutput(rawOutput: unknown, context: MethodExecutionContext): Promise<DeciderOutput> {
    const o = rawOutput as Record<string, unknown>;
    return {
      decision: (['PROCEED', 'PROCEED_WITH_MODIFICATIONS', 'BLOCK', 'ESCALATE'].includes(String(o.decision || '').toUpperCase()) ? String(o.decision).toUpperCase() : 'PROCEED') as DeciderOutput['decision'],
      confidence: Number(o.confidence) || 0.8,
      reasoning: String(o.reasoning || ''),
      synthesizedIssues: Array.isArray(o.synthesizedIssues) ? o.synthesizedIssues.map((i: unknown, idx: number) => { const issue = i as Record<string, unknown>; return { issueId: String(issue.issueId || `syn_${idx}`), severity: (Object.values(CatoRiskLevel).includes(String(issue.severity) as CatoRiskLevel) ? String(issue.severity) : 'LOW') as CatoRiskLevel, description: String(issue.description || ''), source: String(issue.source || ''), resolution: String(issue.resolution || '') }; }) : [],
      requiredModifications: Array.isArray(o.requiredModifications) ? o.requiredModifications as string[] : [],
      acceptedRisks: Array.isArray(o.acceptedRisks) ? o.acceptedRisks as string[] : [],
      dissent: Array.isArray(o.dissent) ? o.dissent.map((d: unknown) => { const dis = d as Record<string, unknown>; return { criticType: String(dis.criticType || ''), objection: String(dis.objection || ''), weight: Number(dis.weight) || 0.5 }; }) : [],
      consensusLevel: (['UNANIMOUS', 'MAJORITY', 'SPLIT', 'DEADLOCK'].includes(String(o.consensusLevel || '').toUpperCase()) ? String(o.consensusLevel).toUpperCase() : 'MAJORITY') as DeciderOutput['consensusLevel'],
      nextSteps: Array.isArray(o.nextSteps) ? o.nextSteps as string[] : [],
    };
  }

  protected async detectRiskSignals(output: DeciderOutput, context: MethodExecutionContext): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];
    if (output.decision === 'BLOCK') signals.push({ signalType: 'decider_block', severity: CatoRiskLevel.HIGH, description: 'Decider recommends blocking execution', source: this.getMethodId() });
    if (output.consensusLevel === 'DEADLOCK') signals.push({ signalType: 'consensus_deadlock', severity: CatoRiskLevel.MEDIUM, description: 'Critics reached deadlock - human intervention recommended', source: this.getMethodId() });
    if (output.dissent.length > 0 && output.dissent.some(d => d.weight > 0.7)) signals.push({ signalType: 'strong_dissent', severity: CatoRiskLevel.MEDIUM, description: 'Strong dissenting opinion from critics', source: this.getMethodId() });
    return signals;
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
      temperature: 0.2,
      max_tokens: 2000,
    });

    const latencyMs = Date.now() - startTime;
    const tokensInput = response.usage?.prompt_tokens || Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const tokensOutput = response.usage?.completion_tokens || Math.ceil(response.content.length / 4);

    let parsedOutput: DeciderOutput;
    try {
      parsedOutput = JSON.parse(response.content);
    } catch {
      parsedOutput = {
        decision: 'PROCEED_WITH_MODIFICATIONS',
        confidence: 0.6,
        reasoning: response.content,
        synthesizedIssues: [],
        requiredModifications: [],
        acceptedRisks: [],
        dissent: [],
        consensusLevel: 'MAJORITY',
        nextSteps: ['Review response manually'],
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

export const createDeciderMethod = (pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) => new CatoDeciderMethod(pool, methodRegistry, schemaRegistry);
