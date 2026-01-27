/**
 * Cato Validator Method (Risk Engine)
 * 
 * Performs comprehensive risk assessment and triage decisions.
 * Implements veto logic for CRITICAL risks.
 */

import { Pool } from 'pg';
import { CatoOutputType, CatoRiskLevel, CatoTriageDecision, CatoAccumulatedContext, CatoRiskSignal, CatoRiskFactor, CATO_GOVERNANCE_PRESETS } from '@radiant/shared';
import { CatoBaseMethodExecutor, MethodExecutionContext, ModelInvocationResult } from '../cato-method-executor.service';
import { CatoMethodRegistryService } from '../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../cato-schema-registry.service';

export interface ValidatorInput {
  proposal: { proposalId: string; title: string; actions: Array<Record<string, unknown>>; estimatedImpact: { costCents: number; riskLevel: string } };
  critiques?: Array<{ criticType: string; verdict: string; score: number; issues: Array<Record<string, unknown>> }>;
  governancePreset: 'COWBOY' | 'BALANCED' | 'PARANOID';
}

export interface ValidatorOutput {
  overallRisk: CatoRiskLevel;
  overallRiskScore: number;
  triageDecision: CatoTriageDecision;
  triageReason: string;
  vetoApplied: boolean;
  vetoFactor?: string;
  vetoReason?: string;
  riskFactors: CatoRiskFactor[];
  autoExecuteThreshold: number;
  vetoThreshold: number;
  unmitigatedRisks: string[];
  mitigationSuggestions: Array<{ riskFactorId: string; suggestion: string; estimatedReduction: number }>;
}

export class CatoValidatorMethod extends CatoBaseMethodExecutor<ValidatorInput, ValidatorOutput> {
  constructor(pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) {
    super(pool, methodRegistry, schemaRegistry);
  }

  getMethodId(): string { return 'method:validator:v1'; }
  protected getOutputType(): CatoOutputType { return CatoOutputType.ASSESSMENT; }

  protected generateOutputSummary(output: ValidatorOutput): string {
    return `Risk assessment: ${output.overallRisk} (score: ${(output.overallRiskScore * 100).toFixed(0)}%) → ${output.triageDecision}${output.vetoApplied ? ' [VETOED]' : ''}`;
  }

  protected async buildPromptVariables(input: ValidatorInput, context: MethodExecutionContext, prunedContext: CatoAccumulatedContext): Promise<Record<string, unknown>> {
    const preset = CATO_GOVERNANCE_PRESETS[input.governancePreset];
    return {
      proposal: JSON.stringify(input.proposal, null, 2),
      critiques: input.critiques ? JSON.stringify(input.critiques, null, 2) : '[]',
      governance_preset: input.governancePreset,
      auto_execute_threshold: preset.riskThresholds.autoExecute,
      veto_threshold: preset.riskThresholds.veto,
    };
  }

  protected async processModelOutput(rawOutput: unknown, context: MethodExecutionContext): Promise<ValidatorOutput> {
    const o = rawOutput as Record<string, unknown>;
    const preset = CATO_GOVERNANCE_PRESETS[context.governancePreset];
    
    const riskFactors: CatoRiskFactor[] = Array.isArray(o.riskFactors) ? o.riskFactors.map((f: unknown, idx: number) => {
      const factor = f as Record<string, unknown>;
      return {
        factorId: String(factor.factorId || `risk_${idx}`),
        name: String(factor.name || ''),
        category: String(factor.category || 'general'),
        level: (Object.values(CatoRiskLevel).includes(String(factor.level) as CatoRiskLevel) ? String(factor.level) : 'LOW') as CatoRiskLevel,
        score: Number(factor.score) || 0,
        weight: Number(factor.weight) || 0.1,
        description: String(factor.description || ''),
        source: String(factor.source || 'validator'),
        mitigations: Array.isArray(factor.mitigations) ? factor.mitigations as string[] : [],
        vetoTrigger: Boolean(factor.vetoTrigger),
      };
    }) : [];

    // Calculate overall risk score
    const overallRiskScore = riskFactors.length > 0 
      ? riskFactors.reduce((sum, f) => sum + f.score * f.weight, 0) / riskFactors.reduce((sum, f) => sum + f.weight, 0)
      : 0;

    // Check for CRITICAL veto
    const criticalFactor = riskFactors.find(f => f.level === CatoRiskLevel.CRITICAL || f.vetoTrigger);
    const vetoApplied = criticalFactor !== undefined || overallRiskScore >= preset.riskThresholds.veto;

    // Determine triage decision
    let triageDecision: CatoTriageDecision;
    let triageReason: string;
    
    if (vetoApplied) {
      triageDecision = CatoTriageDecision.BLOCKED;
      triageReason = criticalFactor ? `CRITICAL risk: ${criticalFactor.name}` : `Risk score ${(overallRiskScore * 100).toFixed(0)}% exceeds veto threshold`;
    } else if (overallRiskScore >= preset.riskThresholds.autoExecute) {
      triageDecision = CatoTriageDecision.CHECKPOINT_REQUIRED;
      triageReason = `Risk score ${(overallRiskScore * 100).toFixed(0)}% requires human approval`;
    } else {
      triageDecision = CatoTriageDecision.AUTO_EXECUTE;
      triageReason = `Risk score ${(overallRiskScore * 100).toFixed(0)}% within auto-execute threshold`;
    }

    // Determine overall risk level
    const maxRiskLevel = riskFactors.reduce((max, f) => {
      const order = [CatoRiskLevel.NONE, CatoRiskLevel.LOW, CatoRiskLevel.MEDIUM, CatoRiskLevel.HIGH, CatoRiskLevel.CRITICAL];
      return order.indexOf(f.level) > order.indexOf(max) ? f.level : max;
    }, CatoRiskLevel.NONE);

    return {
      overallRisk: maxRiskLevel,
      overallRiskScore,
      triageDecision,
      triageReason,
      vetoApplied,
      vetoFactor: criticalFactor?.factorId,
      vetoReason: criticalFactor?.description,
      riskFactors,
      autoExecuteThreshold: preset.riskThresholds.autoExecute,
      vetoThreshold: preset.riskThresholds.veto,
      unmitigatedRisks: riskFactors.filter(f => f.level !== CatoRiskLevel.NONE && f.mitigations?.length === 0).map(f => f.name),
      mitigationSuggestions: Array.isArray(o.mitigationSuggestions) ? o.mitigationSuggestions.map((s: unknown) => { const sug = s as Record<string, unknown>; return { riskFactorId: String(sug.riskFactorId || ''), suggestion: String(sug.suggestion || ''), estimatedReduction: Number(sug.estimatedReduction) || 0.1 }; }) : [],
    };
  }

  protected async detectRiskSignals(output: ValidatorOutput, context: MethodExecutionContext): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];
    if (output.vetoApplied) signals.push({ signalType: 'veto_applied', severity: CatoRiskLevel.CRITICAL, description: output.vetoReason || 'Veto triggered', source: this.getMethodId() });
    if (output.triageDecision === CatoTriageDecision.CHECKPOINT_REQUIRED) signals.push({ signalType: 'checkpoint_required', severity: CatoRiskLevel.MEDIUM, description: output.triageReason, source: this.getMethodId() });
    return signals;
  }

}

export const createValidatorMethod = (pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService) => new CatoValidatorMethod(pool, methodRegistry, schemaRegistry);
