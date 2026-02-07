/**
 * Cato Forensic Critic Method (LIVS-M)
 * 
 * Performs dialectical verification on proposals/responses:
 * - Phase 1: Surface scan for code stubs and placeholders
 * - Phase 2: Evidence chain validation
 * - Phase 3: Contradiction detection
 * - Phase 4: Confidence calibration
 * 
 * Implements the "Antithesis" role in the Thesis/Antithesis/Synthesis model.
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  CatoOutputType,
  CatoRiskLevel,
  CatoAccumulatedContext,
  CatoRiskSignal,
  DEFAULT_STUB_PATTERNS,
  LIVSEnforcementAction,
} from '@radiant/shared';
import {
  CatoBaseMethodExecutor,
  MethodExecutionContext,
} from '../../cato-method-executor.service';
import { CatoMethodRegistryService } from '../../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../../cato-schema-registry.service';

export interface ForensicCriticInput {
  proposal: {
    proposalId: string;
    title: string;
    content: string;
    actions?: Array<{
      actionId: string;
      type: string;
      description: string;
      code?: string;
    }>;
    claimedConfidence?: number;
  };
  originalQuery?: string;
  stubPatterns?: string[];
  enforcementAction?: LIVSEnforcementAction;
  enableDialectical?: boolean;
}

export interface StubFinding {
  findingId: string;
  pattern: string;
  match: string;
  lineNumber?: number;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface EvidenceGap {
  gapId: string;
  claim: string;
  missingEvidence: string;
  severity: CatoRiskLevel;
}

export interface ContradictionFinding {
  contradictionId: string;
  statement1: string;
  statement2: string;
  explanation: string;
  severity: CatoRiskLevel;
}

export interface ForensicCriticOutput {
  criticType: 'FORENSIC';
  verdict: 'APPROVE' | 'APPROVE_WITH_CONCERNS' | 'REQUEST_CHANGES' | 'REJECT';
  score: number;
  
  // Phase 1: Stub detection
  stubFindings: StubFinding[];
  stubsBlocked: boolean;
  retryPrompt?: string;
  
  // Phase 2: Evidence validation
  evidenceGaps: EvidenceGap[];
  evidenceScore: number;
  
  // Phase 3: Contradiction detection
  contradictions: ContradictionFinding[];
  consistencyScore: number;
  
  // Phase 4: Confidence calibration
  claimedConfidence: number;
  calibratedConfidence: number;
  confidenceDelta: number;
  
  // Dialectical output (if enabled)
  challenges: string[];
  counterarguments: string[];
  synthesisRecommendation?: string;
  
  // Summary
  forensicChecklist: {
    noStubs: { passed: boolean; notes: string };
    evidenceProvided: { passed: boolean; notes: string };
    internalConsistency: { passed: boolean; notes: string };
    confidenceCalibrated: { passed: boolean; notes: string };
    noHedging: { passed: boolean; notes: string };
    noDeflection: { passed: boolean; notes: string };
  };
}

export class CatoForensicCriticMethod extends CatoBaseMethodExecutor<ForensicCriticInput, ForensicCriticOutput> {
  constructor(
    pool: Pool,
    methodRegistry: CatoMethodRegistryService,
    schemaRegistry: CatoSchemaRegistryService
  ) {
    super(pool, methodRegistry, schemaRegistry);
  }

  getMethodId(): string {
    return 'method:critic:forensic:v1';
  }

  protected getOutputType(): CatoOutputType {
    return CatoOutputType.CRITIQUE;
  }

  protected generateOutputSummary(output: ForensicCriticOutput): string {
    const stubCount = output.stubFindings.length;
    const gapCount = output.evidenceGaps.length;
    const contradictionCount = output.contradictions.length;
    return `Forensic review: ${output.verdict} (score: ${(output.score * 100).toFixed(0)}%, ` +
      `${stubCount} stub(s), ${gapCount} evidence gap(s), ${contradictionCount} contradiction(s))`;
  }

  protected async buildPromptVariables(
    input: ForensicCriticInput,
    context: MethodExecutionContext,
    prunedContext: CatoAccumulatedContext
  ): Promise<Record<string, unknown>> {
    // Phase 1: Detect stubs before LLM call
    const stubFindings = this.detectStubs(
      input.proposal.content,
      input.stubPatterns || DEFAULT_STUB_PATTERNS
    );

    return {
      proposal: JSON.stringify(input.proposal, null, 2),
      original_query: input.originalQuery || 'Not provided',
      stub_findings: stubFindings.length > 0 
        ? JSON.stringify(stubFindings, null, 2)
        : 'No stubs detected',
      enable_dialectical: input.enableDialectical ?? true,
      claimed_confidence: input.proposal.claimedConfidence ?? 0.8,
    };
  }

  protected async processModelOutput(
    rawOutput: unknown,
    context: MethodExecutionContext
  ): Promise<ForensicCriticOutput> {
    const output = rawOutput as Record<string, unknown>;
    const input = context.previousEnvelopes?.[0]?.output?.data as ForensicCriticInput;

    // Get stub findings from pre-processing
    const stubFindings = this.detectStubs(
      input?.proposal?.content || '',
      input?.stubPatterns || DEFAULT_STUB_PATTERNS
    );

    const claimedConfidence = Number(input?.proposal?.claimedConfidence ?? output.claimedConfidence ?? 0.8);
    const calibratedConfidence = Number(output.calibratedConfidence ?? claimedConfidence);

    // Parse evidence gaps
    const evidenceGaps: EvidenceGap[] = Array.isArray(output.evidenceGaps)
      ? output.evidenceGaps.map((g: unknown, idx: number) => {
          const gap = g as Record<string, unknown>;
          return {
            gapId: String(gap.gapId || `gap_${idx + 1}`),
            claim: String(gap.claim || ''),
            missingEvidence: String(gap.missingEvidence || ''),
            severity: this.parseRiskLevel(gap.severity),
          };
        })
      : [];

    // Parse contradictions
    const contradictions: ContradictionFinding[] = Array.isArray(output.contradictions)
      ? output.contradictions.map((c: unknown, idx: number) => {
          const contradiction = c as Record<string, unknown>;
          return {
            contradictionId: String(contradiction.contradictionId || `cont_${idx + 1}`),
            statement1: String(contradiction.statement1 || ''),
            statement2: String(contradiction.statement2 || ''),
            explanation: String(contradiction.explanation || ''),
            severity: this.parseRiskLevel(contradiction.severity),
          };
        })
      : [];

    // Determine if stubs should block
    const enforcementAction = input?.enforcementAction || 'REJECT_AND_RETRY';
    const stubsBlocked = stubFindings.length > 0 && 
      (enforcementAction === 'BLOCK' || enforcementAction === 'REJECT_AND_RETRY');

    // Generate retry prompt if stubs found
    let retryPrompt: string | undefined;
    if (stubFindings.length > 0) {
      const stubList = stubFindings.slice(0, 3).map(s => `"${s.match}"`).join(', ');
      retryPrompt = `Your response contains placeholder code (detected: ${stubList}). ` +
        `Please provide a complete implementation without stubs, TODOs, or placeholders.`;
    }

    // Calculate scores
    const evidenceScore = evidenceGaps.length === 0 ? 1.0 : Math.max(0, 1 - (evidenceGaps.length * 0.15));
    const consistencyScore = contradictions.length === 0 ? 1.0 : Math.max(0, 1 - (contradictions.length * 0.25));
    const stubScore = stubFindings.length === 0 ? 1.0 : 0;

    const overallScore = (evidenceScore + consistencyScore + stubScore) / 3;

    // Parse forensic checklist
    const checklist = (output.forensicChecklist || {}) as Record<string, unknown>;

    // Determine verdict
    let verdict: 'APPROVE' | 'APPROVE_WITH_CONCERNS' | 'REQUEST_CHANGES' | 'REJECT' = 'APPROVE';
    if (stubsBlocked) {
      verdict = 'REJECT';
    } else if (contradictions.some(c => c.severity === CatoRiskLevel.CRITICAL)) {
      verdict = 'REJECT';
    } else if (overallScore < 0.5) {
      verdict = 'REQUEST_CHANGES';
    } else if (overallScore < 0.8 || evidenceGaps.length > 0 || contradictions.length > 0) {
      verdict = 'APPROVE_WITH_CONCERNS';
    }

    return {
      criticType: 'FORENSIC',
      verdict,
      score: overallScore,
      stubFindings,
      stubsBlocked,
      retryPrompt,
      evidenceGaps,
      evidenceScore,
      contradictions,
      consistencyScore,
      claimedConfidence,
      calibratedConfidence,
      confidenceDelta: claimedConfidence - calibratedConfidence,
      challenges: Array.isArray(output.challenges) ? (output.challenges as string[]) : [],
      counterarguments: Array.isArray(output.counterarguments) ? (output.counterarguments as string[]) : [],
      synthesisRecommendation: output.synthesisRecommendation ? String(output.synthesisRecommendation) : undefined,
      forensicChecklist: {
        noStubs: {
          passed: stubFindings.length === 0,
          notes: stubFindings.length === 0 ? 'No stubs detected' : `Found ${stubFindings.length} stub(s)`,
        },
        evidenceProvided: this.parseChecklistItem(checklist.evidenceProvided, evidenceGaps.length === 0),
        internalConsistency: this.parseChecklistItem(checklist.internalConsistency, contradictions.length === 0),
        confidenceCalibrated: {
          passed: Math.abs(claimedConfidence - calibratedConfidence) < 0.2,
          notes: `Claimed: ${(claimedConfidence * 100).toFixed(0)}%, Calibrated: ${(calibratedConfidence * 100).toFixed(0)}%`,
        },
        noHedging: this.parseChecklistItem(checklist.noHedging),
        noDeflection: this.parseChecklistItem(checklist.noDeflection),
      },
    };
  }

  protected async detectRiskSignals(
    output: ForensicCriticOutput,
    context: MethodExecutionContext
  ): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];

    // Stub detection signals
    if (output.stubsBlocked) {
      signals.push({
        signalType: 'stubs_detected',
        severity: CatoRiskLevel.HIGH,
        description: `${output.stubFindings.length} code stub(s) detected - response blocked`,
        source: this.getMethodId(),
        mitigations: [output.retryPrompt || 'Provide complete implementation'],
      });
    }

    // Evidence gap signals
    const criticalGaps = output.evidenceGaps.filter(g => g.severity === CatoRiskLevel.CRITICAL);
    if (criticalGaps.length > 0) {
      signals.push({
        signalType: 'critical_evidence_gaps',
        severity: CatoRiskLevel.CRITICAL,
        description: `${criticalGaps.length} critical evidence gap(s) found`,
        source: this.getMethodId(),
        mitigations: criticalGaps.map(g => `Provide evidence for: ${g.claim}`),
      });
    }

    // Contradiction signals
    if (output.contradictions.length > 0) {
      const maxSeverity = output.contradictions.reduce(
        (max, c) => this.compareSeverity(c.severity, max) > 0 ? c.severity : max,
        CatoRiskLevel.LOW
      );
      signals.push({
        signalType: 'contradictions_detected',
        severity: maxSeverity,
        description: `${output.contradictions.length} contradiction(s) found`,
        source: this.getMethodId(),
      });
    }

    // Confidence miscalibration
    if (output.confidenceDelta > 0.3) {
      signals.push({
        signalType: 'confidence_inflation',
        severity: CatoRiskLevel.MEDIUM,
        description: `Confidence inflated by ${(output.confidenceDelta * 100).toFixed(0)}%`,
        source: this.getMethodId(),
      });
    }

    // Overall forensic rejection
    if (output.verdict === 'REJECT') {
      signals.push({
        signalType: 'forensic_rejection',
        severity: CatoRiskLevel.HIGH,
        description: 'Forensic review recommends rejection',
        source: this.getMethodId(),
      });
    }

    return signals;
  }

  /**
   * Phase 1: Detect code stubs and placeholders
   */
  private detectStubs(content: string, patterns: string[]): StubFinding[] {
    const findings: StubFinding[] = [];
    const lines = content.split('\n');

    for (const patternStr of patterns) {
      try {
        const pattern = new RegExp(patternStr, 'gim');
        
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];
          const matches = line.matchAll(pattern);
          
          for (const match of matches) {
            const startLine = Math.max(0, lineNum - 1);
            const endLine = Math.min(lines.length - 1, lineNum + 1);
            const context = lines.slice(startLine, endLine + 1).join('\n');

            findings.push({
              findingId: `stub_${uuidv4().substring(0, 8)}`,
              pattern: patternStr,
              match: match[0],
              lineNumber: lineNum + 1,
              context,
              severity: this.determineStubSeverity(match[0]),
            });
          }
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }

    return findings;
  }

  private determineStubSeverity(match: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowerMatch = match.toLowerCase();
    
    // Critical: explicit not implemented
    if (lowerMatch.includes('notimplemented') || lowerMatch.includes('raise')) {
      return 'critical';
    }
    
    // High: obvious placeholders
    if (lowerMatch.includes('todo') || lowerMatch.includes('fixme') || lowerMatch === 'pass') {
      return 'high';
    }
    
    // Medium: suspicious returns
    if (lowerMatch.includes('return') && (
      lowerMatch.includes('[]') || 
      lowerMatch.includes('{}') || 
      lowerMatch.includes('null') ||
      lowerMatch.includes('true') ||
      lowerMatch.includes('false')
    )) {
      return 'medium';
    }
    
    return 'low';
  }

  private parseRiskLevel(value: unknown): CatoRiskLevel {
    const str = String(value || 'MEDIUM').toUpperCase();
    return Object.values(CatoRiskLevel).includes(str as CatoRiskLevel) 
      ? str as CatoRiskLevel 
      : CatoRiskLevel.MEDIUM;
  }

  private parseChecklistItem(
    value: unknown, 
    defaultPassed: boolean = true
  ): { passed: boolean; notes: string } {
    if (!value || typeof value !== 'object') {
      return { passed: defaultPassed, notes: defaultPassed ? 'Passed' : 'Not evaluated' };
    }
    const item = value as Record<string, unknown>;
    return {
      passed: Boolean(item.passed ?? defaultPassed),
      notes: String(item.notes || ''),
    };
  }

  private compareSeverity(a: CatoRiskLevel, b: CatoRiskLevel): number {
    const order = [CatoRiskLevel.LOW, CatoRiskLevel.MEDIUM, CatoRiskLevel.HIGH, CatoRiskLevel.CRITICAL];
    return order.indexOf(a) - order.indexOf(b);
  }
}

export const createForensicCriticMethod = (
  pool: Pool,
  methodRegistry: CatoMethodRegistryService,
  schemaRegistry: CatoSchemaRegistryService
): CatoForensicCriticMethod => {
  return new CatoForensicCriticMethod(pool, methodRegistry, schemaRegistry);
};
