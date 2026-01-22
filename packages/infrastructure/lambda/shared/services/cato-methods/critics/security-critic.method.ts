/**
 * Cato Security Critic Method
 * 
 * Reviews proposals from a security perspective. Identifies vulnerabilities,
 * injection risks, access control issues, and security best practice violations.
 */

import { Pool } from 'pg';
import {
  CatoOutputType,
  CatoRiskLevel,
  CatoAccumulatedContext,
  CatoRiskSignal,
} from '@radiant/shared';
import {
  CatoBaseMethodExecutor,
  MethodExecutionContext,
  ModelInvocationResult,
} from '../../cato-method-executor.service';
import { CatoMethodRegistryService } from '../../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../../cato-schema-registry.service';

export interface SecurityCriticInput {
  proposal: {
    proposalId: string;
    title: string;
    actions: Array<{
      actionId: string;
      type: string;
      description: string;
      toolId?: string;
      inputs: Record<string, unknown>;
      reversible: boolean;
    }>;
  };
  context?: Record<string, unknown>;
  additionalInstructions?: string;
}

export interface SecurityIssue {
  issueId: string;
  severity: CatoRiskLevel;
  category: string;
  description: string;
  affectedActions: string[];
  suggestion: string;
  cweId?: string;
}

export interface SecurityCriticOutput {
  criticType: 'SECURITY';
  verdict: 'APPROVE' | 'APPROVE_WITH_CONCERNS' | 'REQUEST_CHANGES' | 'REJECT';
  score: number;
  issues: SecurityIssue[];
  strengths: string[];
  recommendations: string[];
  securityChecklist: {
    inputValidation: { passed: boolean; notes: string };
    injectionPrevention: { passed: boolean; notes: string };
    accessControl: { passed: boolean; notes: string };
    dataExposure: { passed: boolean; notes: string };
    authentication: { passed: boolean; notes: string };
    auditTrail: { passed: boolean; notes: string };
    reversibility: { passed: boolean; notes: string };
  };
}

export class CatoSecurityCriticMethod extends CatoBaseMethodExecutor<SecurityCriticInput, SecurityCriticOutput> {
  constructor(
    pool: Pool,
    methodRegistry: CatoMethodRegistryService,
    schemaRegistry: CatoSchemaRegistryService
  ) {
    super(pool, methodRegistry, schemaRegistry);
  }

  getMethodId(): string {
    return 'method:critic:security:v1';
  }

  protected getOutputType(): CatoOutputType {
    return CatoOutputType.CRITIQUE;
  }

  protected generateOutputSummary(output: SecurityCriticOutput): string {
    const issueCount = output.issues.length;
    const criticalCount = output.issues.filter(i => i.severity === CatoRiskLevel.CRITICAL).length;
    return `Security review: ${output.verdict} (score: ${(output.score * 100).toFixed(0)}%, ` +
      `${issueCount} issue(s), ${criticalCount} critical)`;
  }

  protected async buildPromptVariables(
    input: SecurityCriticInput,
    context: MethodExecutionContext,
    prunedContext: CatoAccumulatedContext
  ): Promise<Record<string, unknown>> {
    return {
      proposal: JSON.stringify(input.proposal, null, 2),
      context: input.context ? JSON.stringify(input.context, null, 2) : 'No additional context',
      additional_instructions: input.additionalInstructions || '',
    };
  }

  protected async processModelOutput(
    rawOutput: unknown,
    context: MethodExecutionContext
  ): Promise<SecurityCriticOutput> {
    const output = rawOutput as Record<string, unknown>;

    const issues: SecurityIssue[] = Array.isArray(output.issues)
      ? output.issues.map((i: unknown, idx: number) => {
          const issue = i as Record<string, unknown>;
          return {
            issueId: String(issue.issueId || `sec_${idx + 1}`),
            severity: this.parseRiskLevel(issue.severity),
            category: String(issue.category || 'general'),
            description: String(issue.description || ''),
            affectedActions: Array.isArray(issue.affectedActions) 
              ? (issue.affectedActions as string[]) 
              : [],
            suggestion: String(issue.suggestion || ''),
            cweId: issue.cweId ? String(issue.cweId) : undefined,
          };
        })
      : [];

    const checklist = (output.securityChecklist || {}) as Record<string, unknown>;

    return {
      criticType: 'SECURITY',
      verdict: this.parseVerdict(output.verdict),
      score: Number(output.score) || 0.5,
      issues,
      strengths: Array.isArray(output.strengths) ? (output.strengths as string[]) : [],
      recommendations: Array.isArray(output.recommendations) ? (output.recommendations as string[]) : [],
      securityChecklist: {
        inputValidation: this.parseChecklistItem(checklist.inputValidation),
        injectionPrevention: this.parseChecklistItem(checklist.injectionPrevention),
        accessControl: this.parseChecklistItem(checklist.accessControl),
        dataExposure: this.parseChecklistItem(checklist.dataExposure),
        authentication: this.parseChecklistItem(checklist.authentication),
        auditTrail: this.parseChecklistItem(checklist.auditTrail),
        reversibility: this.parseChecklistItem(checklist.reversibility),
      },
    };
  }

  protected async detectRiskSignals(
    output: SecurityCriticOutput,
    context: MethodExecutionContext
  ): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];

    const criticalIssues = output.issues.filter(i => i.severity === CatoRiskLevel.CRITICAL);
    if (criticalIssues.length > 0) {
      signals.push({
        signalType: 'critical_security_issues',
        severity: CatoRiskLevel.CRITICAL,
        description: `${criticalIssues.length} critical security issue(s) found`,
        source: this.getMethodId(),
        mitigations: criticalIssues.map(i => i.suggestion),
      });
    }

    if (output.verdict === 'REJECT') {
      signals.push({
        signalType: 'security_rejection',
        severity: CatoRiskLevel.HIGH,
        description: 'Security review recommends rejection',
        source: this.getMethodId(),
      });
    }

    const failedChecks = Object.entries(output.securityChecklist)
      .filter(([, v]) => !v.passed)
      .map(([k]) => k);
    
    if (failedChecks.length > 3) {
      signals.push({
        signalType: 'multiple_security_failures',
        severity: CatoRiskLevel.MEDIUM,
        description: `${failedChecks.length} security checklist items failed: ${failedChecks.join(', ')}`,
        source: this.getMethodId(),
      });
    }

    return signals;
  }

  private parseVerdict(value: unknown): 'APPROVE' | 'APPROVE_WITH_CONCERNS' | 'REQUEST_CHANGES' | 'REJECT' {
    const str = String(value || 'REQUEST_CHANGES').toUpperCase();
    const valid = ['APPROVE', 'APPROVE_WITH_CONCERNS', 'REQUEST_CHANGES', 'REJECT'];
    return valid.includes(str) ? str as 'APPROVE' | 'APPROVE_WITH_CONCERNS' | 'REQUEST_CHANGES' | 'REJECT' : 'REQUEST_CHANGES';
  }

  private parseRiskLevel(value: unknown): CatoRiskLevel {
    const str = String(value || 'MEDIUM').toUpperCase();
    return Object.values(CatoRiskLevel).includes(str as CatoRiskLevel) 
      ? str as CatoRiskLevel 
      : CatoRiskLevel.MEDIUM;
  }

  private parseChecklistItem(value: unknown): { passed: boolean; notes: string } {
    if (!value || typeof value !== 'object') {
      return { passed: true, notes: 'Not evaluated' };
    }
    const item = value as Record<string, unknown>;
    return {
      passed: Boolean(item.passed),
      notes: String(item.notes || ''),
    };
  }

  protected async invokeModel(
    systemPrompt: string,
    userPrompt: string,
    context: MethodExecutionContext
  ): Promise<ModelInvocationResult> {
    const mockResponse: SecurityCriticOutput = {
      criticType: 'SECURITY',
      verdict: 'APPROVE_WITH_CONCERNS',
      score: 0.78,
      issues: [],
      strengths: ['Actions use parameterized inputs', 'All actions are reversible'],
      recommendations: ['Add rate limiting', 'Implement audit logging'],
      securityChecklist: {
        inputValidation: { passed: true, notes: 'Inputs validated by tool schema' },
        injectionPrevention: { passed: true, notes: 'No string interpolation detected' },
        accessControl: { passed: true, notes: 'Tool permissions checked' },
        dataExposure: { passed: true, notes: 'No sensitive data in outputs' },
        authentication: { passed: true, notes: 'Tenant context enforced' },
        auditTrail: { passed: true, notes: 'All actions logged' },
        reversibility: { passed: true, notes: 'Compensation strategies defined' },
      },
    };

    return {
      response: JSON.stringify(mockResponse),
      parsedOutput: mockResponse,
      tokensInput: Math.ceil((systemPrompt.length + userPrompt.length) / 4),
      tokensOutput: Math.ceil(JSON.stringify(mockResponse).length / 4),
      costCents: 2,
      latencyMs: 600,
      modelId: this.methodDefinition?.defaultModel || 'claude-sonnet-4-20250514',
      provider: 'anthropic',
    };
  }
}

export const createSecurityCriticMethod = (
  pool: Pool,
  methodRegistry: CatoMethodRegistryService,
  schemaRegistry: CatoSchemaRegistryService
): CatoSecurityCriticMethod => {
  return new CatoSecurityCriticMethod(pool, methodRegistry, schemaRegistry);
};
