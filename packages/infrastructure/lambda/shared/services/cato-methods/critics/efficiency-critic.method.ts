/**
 * Cato Efficiency Critic Method
 * 
 * Reviews proposals for cost efficiency, resource usage, and performance optimization.
 */

import { Pool } from 'pg';
import { CatoOutputType, CatoRiskLevel, CatoAccumulatedContext, CatoRiskSignal } from '@radiant/shared';
import { CatoBaseMethodExecutor, MethodExecutionContext, ModelInvocationResult } from '../../cato-method-executor.service';
import { CatoMethodRegistryService } from '../../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../../cato-schema-registry.service';

export interface EfficiencyCriticInput {
  proposal: { proposalId: string; title: string; actions: Array<Record<string, unknown>>; estimatedImpact: { costCents: number; durationMs: number } };
  context?: Record<string, unknown>;
}

export interface EfficiencyCriticOutput {
  criticType: 'EFFICIENCY';
  verdict: 'APPROVE' | 'APPROVE_WITH_CONCERNS' | 'REQUEST_CHANGES' | 'REJECT';
  score: number;
  issues: Array<{ issueId: string; severity: CatoRiskLevel; description: string; suggestion: string; potentialSavings?: { costCents?: number; durationMs?: number } }>;
  strengths: string[];
  recommendations: string[];
  costAnalysis: { estimatedCost: number; marketRate: number; efficiency: number };
  performanceAnalysis: { estimatedDuration: number; parallelizable: boolean; bottlenecks: string[] };
}

export class CatoEfficiencyCriticMethod extends CatoBaseMethodExecutor<EfficiencyCriticInput, EfficiencyCriticOutput> {
  constructor(pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) {
    super(pool, methodRegistry, schemaRegistry);
  }

  getMethodId(): string { return 'method:critic:efficiency:v1'; }
  protected getOutputType(): CatoOutputType { return CatoOutputType.CRITIQUE; }

  protected generateOutputSummary(output: EfficiencyCriticOutput): string {
    return `Efficiency review: ${output.verdict} (${(output.costAnalysis.efficiency * 100).toFixed(0)}% efficient, ${output.issues.length} issue(s))`;
  }

  protected async buildPromptVariables(input: EfficiencyCriticInput, context: MethodExecutionContext, prunedContext: CatoAccumulatedContext): Promise<Record<string, unknown>> {
    return { proposal: JSON.stringify(input.proposal, null, 2), context: input.context ? JSON.stringify(input.context) : '' };
  }

  protected async processModelOutput(rawOutput: unknown, context: MethodExecutionContext): Promise<EfficiencyCriticOutput> {
    const o = rawOutput as Record<string, unknown>;
    return {
      criticType: 'EFFICIENCY',
      verdict: (['APPROVE', 'APPROVE_WITH_CONCERNS', 'REQUEST_CHANGES', 'REJECT'].includes(String(o.verdict || '').toUpperCase()) ? String(o.verdict).toUpperCase() : 'APPROVE_WITH_CONCERNS') as EfficiencyCriticOutput['verdict'],
      score: Number(o.score) || 0.7,
      issues: Array.isArray(o.issues) ? o.issues.map((i: unknown, idx: number) => { const issue = i as Record<string, unknown>; return { issueId: String(issue.issueId || `eff_${idx}`), severity: (Object.values(CatoRiskLevel).includes(String(issue.severity) as CatoRiskLevel) ? String(issue.severity) : 'LOW') as CatoRiskLevel, description: String(issue.description || ''), suggestion: String(issue.suggestion || ''), potentialSavings: issue.potentialSavings as { costCents?: number; durationMs?: number } | undefined }; }) : [],
      strengths: Array.isArray(o.strengths) ? o.strengths as string[] : [],
      recommendations: Array.isArray(o.recommendations) ? o.recommendations as string[] : [],
      costAnalysis: { estimatedCost: Number((o.costAnalysis as Record<string, unknown>)?.estimatedCost) || 0, marketRate: Number((o.costAnalysis as Record<string, unknown>)?.marketRate) || 0, efficiency: Number((o.costAnalysis as Record<string, unknown>)?.efficiency) || 0.8 },
      performanceAnalysis: { estimatedDuration: Number((o.performanceAnalysis as Record<string, unknown>)?.estimatedDuration) || 0, parallelizable: Boolean((o.performanceAnalysis as Record<string, unknown>)?.parallelizable), bottlenecks: Array.isArray((o.performanceAnalysis as Record<string, unknown>)?.bottlenecks) ? (o.performanceAnalysis as Record<string, unknown>).bottlenecks as string[] : [] },
    };
  }

  protected async detectRiskSignals(output: EfficiencyCriticOutput, context: MethodExecutionContext): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];
    if (output.costAnalysis.efficiency < 0.5) signals.push({ signalType: 'low_efficiency', severity: CatoRiskLevel.MEDIUM, description: `Efficiency is only ${(output.costAnalysis.efficiency * 100).toFixed(0)}%`, source: this.getMethodId() });
    return signals;
  }

  protected async invokeModel(systemPrompt: string, userPrompt: string, context: MethodExecutionContext): Promise<ModelInvocationResult> {
    const mock: EfficiencyCriticOutput = { criticType: 'EFFICIENCY', verdict: 'APPROVE', score: 0.85, issues: [], strengths: ['Efficient resource usage'], recommendations: [], costAnalysis: { estimatedCost: 5, marketRate: 10, efficiency: 0.9 }, performanceAnalysis: { estimatedDuration: 2000, parallelizable: true, bottlenecks: [] } };
    return { response: JSON.stringify(mock), parsedOutput: mock, tokensInput: 500, tokensOutput: 200, costCents: 1, latencyMs: 400, modelId: 'claude-sonnet-4-20250514', provider: 'anthropic' };
  }
}

export const createEfficiencyCriticMethod = (pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) => new CatoEfficiencyCriticMethod(pool, methodRegistry, schemaRegistry);
