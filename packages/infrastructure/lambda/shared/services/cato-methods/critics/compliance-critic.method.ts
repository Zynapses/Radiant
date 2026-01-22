/**
 * Cato Compliance Critic Method
 * 
 * Reviews proposals for regulatory compliance (HIPAA, SOC2, GDPR, FDA 21 CFR Part 11).
 */

import { Pool } from 'pg';
import { CatoOutputType, CatoRiskLevel, CatoAccumulatedContext, CatoRiskSignal } from '@radiant/shared';
import { CatoBaseMethodExecutor, MethodExecutionContext, ModelInvocationResult } from '../../cato-method-executor.service';
import { CatoMethodRegistryService } from '../../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../../cato-schema-registry.service';

export interface ComplianceCriticInput {
  proposal: { proposalId: string; title: string; actions: Array<Record<string, unknown>> };
  frameworks: string[];
  context?: Record<string, unknown>;
}

export interface ComplianceCriticOutput {
  criticType: 'COMPLIANCE';
  verdict: 'APPROVE' | 'APPROVE_WITH_CONCERNS' | 'REQUEST_CHANGES' | 'REJECT';
  score: number;
  issues: Array<{ issueId: string; severity: CatoRiskLevel; framework: string; requirement: string; description: string; remediation: string }>;
  strengths: string[];
  recommendations: string[];
  frameworkAssessments: Record<string, { compliant: boolean; score: number; gaps: string[] }>;
  dataClassification: { containsPii: boolean; containsPhi: boolean; sensitiveFields: string[] };
  auditRequirements: { retentionDays: number; requiredLogs: string[]; signatureRequired: boolean };
}

export class CatoComplianceCriticMethod extends CatoBaseMethodExecutor<ComplianceCriticInput, ComplianceCriticOutput> {
  constructor(pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) {
    super(pool, methodRegistry, schemaRegistry);
  }

  getMethodId(): string { return 'method:critic:compliance:v1'; }
  protected getOutputType(): CatoOutputType { return CatoOutputType.CRITIQUE; }

  protected generateOutputSummary(output: ComplianceCriticOutput): string {
    const compliantCount = Object.values(output.frameworkAssessments).filter(f => f.compliant).length;
    const totalFrameworks = Object.keys(output.frameworkAssessments).length;
    return `Compliance review: ${output.verdict} (${compliantCount}/${totalFrameworks} frameworks compliant, ${output.issues.length} issue(s))`;
  }

  protected async buildPromptVariables(input: ComplianceCriticInput, context: MethodExecutionContext, prunedContext: CatoAccumulatedContext): Promise<Record<string, unknown>> {
    return { proposal: JSON.stringify(input.proposal, null, 2), frameworks: input.frameworks.join(', '), context: input.context ? JSON.stringify(input.context) : '' };
  }

  protected async processModelOutput(rawOutput: unknown, context: MethodExecutionContext): Promise<ComplianceCriticOutput> {
    const o = rawOutput as Record<string, unknown>;
    return {
      criticType: 'COMPLIANCE',
      verdict: (['APPROVE', 'APPROVE_WITH_CONCERNS', 'REQUEST_CHANGES', 'REJECT'].includes(String(o.verdict || '').toUpperCase()) ? String(o.verdict).toUpperCase() : 'APPROVE') as ComplianceCriticOutput['verdict'],
      score: Number(o.score) || 0.85,
      issues: Array.isArray(o.issues) ? o.issues.map((i: unknown, idx: number) => { const issue = i as Record<string, unknown>; return { issueId: String(issue.issueId || `comp_${idx}`), severity: (Object.values(CatoRiskLevel).includes(String(issue.severity) as CatoRiskLevel) ? String(issue.severity) : 'MEDIUM') as CatoRiskLevel, framework: String(issue.framework || ''), requirement: String(issue.requirement || ''), description: String(issue.description || ''), remediation: String(issue.remediation || '') }; }) : [],
      strengths: Array.isArray(o.strengths) ? o.strengths as string[] : [],
      recommendations: Array.isArray(o.recommendations) ? o.recommendations as string[] : [],
      frameworkAssessments: (o.frameworkAssessments as Record<string, { compliant: boolean; score: number; gaps: string[] }>) || {},
      dataClassification: { containsPii: Boolean((o.dataClassification as Record<string, unknown>)?.containsPii), containsPhi: Boolean((o.dataClassification as Record<string, unknown>)?.containsPhi), sensitiveFields: Array.isArray((o.dataClassification as Record<string, unknown>)?.sensitiveFields) ? (o.dataClassification as Record<string, unknown>).sensitiveFields as string[] : [] },
      auditRequirements: { retentionDays: Number((o.auditRequirements as Record<string, unknown>)?.retentionDays) || 2555, requiredLogs: Array.isArray((o.auditRequirements as Record<string, unknown>)?.requiredLogs) ? (o.auditRequirements as Record<string, unknown>).requiredLogs as string[] : [], signatureRequired: Boolean((o.auditRequirements as Record<string, unknown>)?.signatureRequired) },
    };
  }

  protected async detectRiskSignals(output: ComplianceCriticOutput, context: MethodExecutionContext): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];
    const nonCompliant = Object.entries(output.frameworkAssessments).filter(([, v]) => !v.compliant);
    if (nonCompliant.length > 0) signals.push({ signalType: 'compliance_gaps', severity: CatoRiskLevel.HIGH, description: `Non-compliant with: ${nonCompliant.map(([k]) => k).join(', ')}`, source: this.getMethodId() });
    if (output.dataClassification.containsPhi) signals.push({ signalType: 'phi_detected', severity: CatoRiskLevel.HIGH, description: 'Protected Health Information detected', source: this.getMethodId() });
    return signals;
  }

  protected async invokeModel(systemPrompt: string, userPrompt: string, context: MethodExecutionContext): Promise<ModelInvocationResult> {
    const mock: ComplianceCriticOutput = { criticType: 'COMPLIANCE', verdict: 'APPROVE', score: 0.9, issues: [], strengths: ['Proper audit logging'], recommendations: [], frameworkAssessments: { SOC2: { compliant: true, score: 0.95, gaps: [] } }, dataClassification: { containsPii: false, containsPhi: false, sensitiveFields: [] }, auditRequirements: { retentionDays: 2555, requiredLogs: ['action_log', 'access_log'], signatureRequired: false } };
    return { response: JSON.stringify(mock), parsedOutput: mock, tokensInput: 500, tokensOutput: 250, costCents: 1, latencyMs: 450, modelId: 'claude-sonnet-4-20250514', provider: 'anthropic' };
  }
}

export const createComplianceCriticMethod = (pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) => new CatoComplianceCriticMethod(pool, methodRegistry, schemaRegistry);
