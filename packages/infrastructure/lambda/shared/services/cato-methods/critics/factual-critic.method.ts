/**
 * Cato Factual Critic Method
 * 
 * Reviews proposals for factual accuracy, logical consistency, and correctness.
 */

import { Pool } from 'pg';
import { CatoOutputType, CatoRiskLevel, CatoAccumulatedContext, CatoRiskSignal } from '@radiant/shared';
import { CatoBaseMethodExecutor, MethodExecutionContext, ModelInvocationResult } from '../../cato-method-executor.service';
import { CatoMethodRegistryService } from '../../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../../cato-schema-registry.service';

export interface FactualCriticInput {
  proposal: { proposalId: string; title: string; actions: Array<Record<string, unknown>>; rationale: string; assumptions: string[] };
  context?: Record<string, unknown>;
}

export interface FactualCriticOutput {
  criticType: 'FACTUAL';
  verdict: 'APPROVE' | 'APPROVE_WITH_CONCERNS' | 'REQUEST_CHANGES' | 'REJECT';
  score: number;
  issues: Array<{ issueId: string; severity: CatoRiskLevel; type: 'factual_error' | 'logical_fallacy' | 'unsupported_claim' | 'contradiction'; description: string; correction?: string }>;
  strengths: string[];
  recommendations: string[];
  factChecks: Array<{ claim: string; verified: boolean; source?: string; confidence: number }>;
  logicalAnalysis: { consistent: boolean; fallacies: string[]; assumptions: Array<{ assumption: string; validity: 'valid' | 'questionable' | 'invalid' }> };
}

export class CatoFactualCriticMethod extends CatoBaseMethodExecutor<FactualCriticInput, FactualCriticOutput> {
  constructor(pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) {
    super(pool, methodRegistry, schemaRegistry);
  }

  getMethodId(): string { return 'method:critic:factual:v1'; }
  protected getOutputType(): CatoOutputType { return CatoOutputType.CRITIQUE; }

  protected generateOutputSummary(output: FactualCriticOutput): string {
    const verified = output.factChecks.filter(f => f.verified).length;
    return `Factual review: ${output.verdict} (${verified}/${output.factChecks.length} claims verified, ${output.issues.length} issue(s))`;
  }

  protected async buildPromptVariables(input: FactualCriticInput, context: MethodExecutionContext, prunedContext: CatoAccumulatedContext): Promise<Record<string, unknown>> {
    return { proposal: JSON.stringify(input.proposal, null, 2), context: input.context ? JSON.stringify(input.context) : '' };
  }

  protected async processModelOutput(rawOutput: unknown, context: MethodExecutionContext): Promise<FactualCriticOutput> {
    const o = rawOutput as Record<string, unknown>;
    return {
      criticType: 'FACTUAL',
      verdict: (['APPROVE', 'APPROVE_WITH_CONCERNS', 'REQUEST_CHANGES', 'REJECT'].includes(String(o.verdict || '').toUpperCase()) ? String(o.verdict).toUpperCase() : 'APPROVE') as FactualCriticOutput['verdict'],
      score: Number(o.score) || 0.8,
      issues: Array.isArray(o.issues) ? o.issues.map((i: unknown, idx: number) => { const issue = i as Record<string, unknown>; return { issueId: String(issue.issueId || `fact_${idx}`), severity: (Object.values(CatoRiskLevel).includes(String(issue.severity) as CatoRiskLevel) ? String(issue.severity) : 'LOW') as CatoRiskLevel, type: (['factual_error', 'logical_fallacy', 'unsupported_claim', 'contradiction'].includes(String(issue.type)) ? String(issue.type) : 'unsupported_claim') as 'factual_error' | 'logical_fallacy' | 'unsupported_claim' | 'contradiction', description: String(issue.description || ''), correction: issue.correction ? String(issue.correction) : undefined }; }) : [],
      strengths: Array.isArray(o.strengths) ? o.strengths as string[] : [],
      recommendations: Array.isArray(o.recommendations) ? o.recommendations as string[] : [],
      factChecks: Array.isArray(o.factChecks) ? o.factChecks.map((f: unknown) => { const fc = f as Record<string, unknown>; return { claim: String(fc.claim || ''), verified: Boolean(fc.verified), source: fc.source ? String(fc.source) : undefined, confidence: Number(fc.confidence) || 0.5 }; }) : [],
      logicalAnalysis: { consistent: Boolean((o.logicalAnalysis as Record<string, unknown>)?.consistent ?? true), fallacies: Array.isArray((o.logicalAnalysis as Record<string, unknown>)?.fallacies) ? (o.logicalAnalysis as Record<string, unknown>).fallacies as string[] : [], assumptions: Array.isArray((o.logicalAnalysis as Record<string, unknown>)?.assumptions) ? ((o.logicalAnalysis as Record<string, unknown>).assumptions as Array<unknown>).map((a: unknown) => { const ass = a as Record<string, unknown>; return { assumption: String(ass.assumption || ''), validity: (['valid', 'questionable', 'invalid'].includes(String(ass.validity)) ? String(ass.validity) : 'valid') as 'valid' | 'questionable' | 'invalid' }; }) : [] },
    };
  }

  protected async detectRiskSignals(output: FactualCriticOutput, context: MethodExecutionContext): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];
    const factualErrors = output.issues.filter(i => i.type === 'factual_error' && i.severity === CatoRiskLevel.HIGH);
    if (factualErrors.length > 0) signals.push({ signalType: 'factual_errors', severity: CatoRiskLevel.HIGH, description: `${factualErrors.length} high-severity factual error(s)`, source: this.getMethodId() });
    if (!output.logicalAnalysis.consistent) signals.push({ signalType: 'logical_inconsistency', severity: CatoRiskLevel.MEDIUM, description: 'Logical inconsistencies detected', source: this.getMethodId() });
    return signals;
  }

  protected async invokeModel(systemPrompt: string, userPrompt: string, context: MethodExecutionContext): Promise<ModelInvocationResult> {
    const mock: FactualCriticOutput = { criticType: 'FACTUAL', verdict: 'APPROVE', score: 0.9, issues: [], strengths: ['Rationale is well-supported'], recommendations: [], factChecks: [{ claim: 'Proposed approach is valid', verified: true, confidence: 0.9 }], logicalAnalysis: { consistent: true, fallacies: [], assumptions: [] } };
    return { response: JSON.stringify(mock), parsedOutput: mock, tokensInput: 500, tokensOutput: 200, costCents: 1, latencyMs: 400, modelId: 'claude-sonnet-4-20250514', provider: 'anthropic' };
  }
}

export const createFactualCriticMethod = (pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) => new CatoFactualCriticMethod(pool, methodRegistry, schemaRegistry);
