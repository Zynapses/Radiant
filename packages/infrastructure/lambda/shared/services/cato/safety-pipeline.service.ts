type SafetyBlockedBy = "ethics" | "compliance" | "safety" | "policy" | string;
/**
 * RADIANT Genesis Cato Safety Pipeline Service
 * Complete safety evaluation pipeline integrating all Cato components
 *
 * Pipeline Order:
 * 1. Sensory Veto (cannot be recovered from)
 * 2. Precision Governor (limits confidence)
 * 3. Redundant Perception (detects PHI/PII)
 * 4. Control Barrier Functions (hard safety constraints)
 * 5. Semantic Entropy (deception detection)
 * 6. Fracture Detection (alignment verification)
 *
 * IMMUTABLE: CBFs never relax, gamma never boosts
 */

import { query } from '../database';
import {
  SafetyPipelineResult,
  Policy,
  ExecutionContext,
  ProposedAction,
} from './types';

import { precisionGovernorService } from './precision-governor.service';
import { controlBarrierService } from './control-barrier.service';
import { sensoryVetoService } from './sensory-veto.service';
import { adaptiveEntropyService } from './adaptive-entropy.service';
import { fractureDetectionService } from './fracture-detection.service';
import { epistemicRecoveryService } from './epistemic-recovery.service';
import { redundantPerceptionService } from './redundant-perception.service';
import { personaService } from './persona.service';
import { merkleAuditService } from './merkle-audit.service';
import { governancePresetService } from '../governance-preset.service';
// Local type stub
type CheckpointMode = 'manual' | 'automatic' | 'conditional' | string;

export class CatoSafetyPipeline {
  /**
   * Main safety evaluation pipeline
   */
  async evaluateAction(params: {
    prompt: string;
    proposedPolicy: Policy;
    generatedResponse: string;
    actorModel: string;
    context: ExecutionContext;
  }): Promise<SafetyPipelineResult> {
    const { prompt, proposedPolicy, generatedResponse, actorModel, context } = params;

    // Load tenant configs
    await Promise.all([
      precisionGovernorService.loadConfig(context.tenantId),
      controlBarrierService.loadBarriers(context.tenantId),
      adaptiveEntropyService.loadConfig(context.tenantId),
      epistemicRecoveryService.loadConfig(context.tenantId),
    ]);

    // Check for active persona override from recovery
    const personaOverride = await epistemicRecoveryService.getActivePersonaOverride(
      context.sessionId
    );
    const effectivePersona = personaOverride ?? context.activePersona;

    // =========================================================================
    // STEP 1: SENSORY VETO (Cannot be recovered from)
    // =========================================================================
    const vetoResult = await sensoryVetoService.checkVetoSignals(context);
    if (vetoResult.hasActiveVeto) {
      await epistemicRecoveryService.recordRejection({
        sessionId: context.sessionId,
        tenantId: context.tenantId,
        rejectedBy: 'VETO',
        reason: vetoResult.activeVetos[0].signal,
      });

      return {
        allowed: false,
        blockedBy: 'VETO',
        vetoResult,
        recommendation: `Action blocked by veto signal: ${vetoResult.activeVetos[0].signal}`,
      };
    }

    // =========================================================================
    // STEP 2: PRECISION GOVERNOR
    // =========================================================================
    const governorResult = precisionGovernorService.computeMaxPriorPrecision({
      epistemicUncertainty: context.epistemicUncertainty,
      currentSensoryPrecision: context.sensoryPrecision,
      requestedGamma: proposedPolicy.requestedGamma,
    });

    if (governorResult.governorState === 'EMERGENCY_SAFE_MODE') {
      const recoveryResult = await epistemicRecoveryService.recordRejection({
        sessionId: context.sessionId,
        tenantId: context.tenantId,
        rejectedBy: 'GOVERNOR',
        reason: governorResult.reason,
      });

      // If in recovery, apply recovery params and retry
      if (recoveryResult.isLivelocked && recoveryResult.action === 'EPISTEMIC_RECOVERY') {
        const enrichedContext: ExecutionContext = {
          ...context,
          systemPromptInjection: recoveryResult.recoveryParams?.systemPromptInjection,
          activePersona: recoveryResult.recoveryParams?.forcedPersona ?? effectivePersona,
        };

        return {
          allowed: false,
          blockedBy: 'GOVERNOR',
          governorResult,
          recoveryResult,
          retryWithContext: enrichedContext,
          recommendation: recoveryResult.reason,
        };
      }

      // If escalation needed
      if (recoveryResult.action === 'ESCALATE_TO_HUMAN') {
        return {
          allowed: false,
          blockedBy: 'EPISTEMIC_ESCALATION',
          governorResult,
          recoveryResult,
          recommendation: 'Epistemic recovery failed. Human intervention required.',
        };
      }

      return {
        allowed: false,
        blockedBy: 'GOVERNOR',
        governorResult,
        recommendation: governorResult.reason,
      };
    }

    // Record governor decision
    await precisionGovernorService.recordDecision({
      tenantId: context.tenantId,
      sessionId: context.sessionId,
      result: governorResult,
      epistemicUncertainty: context.epistemicUncertainty,
      requestedGamma: proposedPolicy.requestedGamma,
    });

    // =========================================================================
    // STEP 3: REDUNDANT PERCEPTION (Before CBF)
    // =========================================================================
    const perceptionResult = await redundantPerceptionService.checkAll(generatedResponse);

    const enrichedAction: ProposedAction = {
      ...proposedPolicy.action,
      containsPHI: perceptionResult.phi?.detected,
      containsPII: perceptionResult.pii?.detected,
    };

    // =========================================================================
    // STEP 4: CONTROL BARRIER FUNCTIONS
    // CBFs ALWAYS enforced - NEVER relax to WARN_ONLY
    // =========================================================================
    const cbfResult = await controlBarrierService.evaluateBarriers({
      currentState: context.systemState,
      proposedAction: enrichedAction,
      context,
    });

    if (!cbfResult.isAdmissible) {
      const recoveryResult = await epistemicRecoveryService.recordRejection({
        sessionId: context.sessionId,
        tenantId: context.tenantId,
        rejectedBy: 'CBF',
        reason: cbfResult.criticalViolation?.barrierDescription ?? 'CBF violation',
      });

      // If in recovery, apply recovery params and retry
      if (recoveryResult.isLivelocked && recoveryResult.action === 'EPISTEMIC_RECOVERY') {
        const enrichedContext: ExecutionContext = {
          ...context,
          systemPromptInjection: recoveryResult.recoveryParams?.systemPromptInjection,
        };

        return {
          allowed: false,
          blockedBy: 'CBF',
          cbfResult,
          recoveryResult,
          retryWithContext: enrichedContext,
          safeAlternative: cbfResult.safeAlternative,
          recommendation: recoveryResult.reason,
        };
      }

      return {
        allowed: false,
        blockedBy: 'CBF',
        cbfResult,
        recoveryResult,
        safeAlternative: cbfResult.safeAlternative,
        recommendation:
          cbfResult.safeAlternative?.userMessage ??
          `Action violates safety constraint: ${cbfResult.criticalViolation?.barrierDescription}`,
      };
    }

    // =========================================================================
    // STEP 5: SEMANTIC ENTROPY (Risk-based)
    // =========================================================================
    if (context.systemState.tenantSettings.enableSemanticEntropy) {
      const entropyCheck = await adaptiveEntropyService.checkEntropy({
        prompt,
        agentResponse: generatedResponse,
        action: enrichedAction,
        actorModel,
        context,
      });

      if (entropyCheck.mode === 'SYNC' && entropyCheck.result?.isPotentialDeception) {
        return {
          allowed: false,
          blockedBy: 'ENTROPY',
          entropyCheck,
          recommendation: `Potential deception detected. ${entropyCheck.result.deceptionIndicators.join(' ')}`,
        };
      }
    }

    // =========================================================================
    // STEP 6: FRACTURE DETECTION
    // =========================================================================
    if (context.systemState.tenantSettings.enableFractureDetection) {
      const fractureResult = await fractureDetectionService.detectFractures({
        statedIntent: prompt,
        proposedPolicy,
        generatedResponse,
        context,
      });

      if (fractureResult.hasFracture && fractureResult.severity === 'critical') {
        return {
          allowed: false,
          blockedBy: 'FRACTURE',
          fractureResult,
          recommendation: fractureResult.recommendation,
        };
      }
    }

    // =========================================================================
    // STEP 7: GOVERNANCE CHECKPOINT (Variable Friction)
    // Check if human approval is required based on governance preset
    // =========================================================================
    // Calculate composite risk score from available data
    const compositeRiskScore = context.epistemicUncertainty ?? 0.5;
    const normalizedConfidence = governorResult.allowedGamma / 3.0;
    const estimatedCost = (proposedPolicy as any).costEstimateCents as number ?? 0;

    const governanceCheck = await governancePresetService.shouldCheckpoint(
      context.tenantId,
      'beforeExecution',
      {
        riskScore: compositeRiskScore,
        confidenceScore: normalizedConfidence,
        costEstimateCents: estimatedCost,
      }
    );

    if (governanceCheck.required) {
      // Record the pending checkpoint
      const checkpointDecision = await governancePresetService.recordCheckpointDecision({
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        userId: context.userId,
        pipelineId: proposedPolicy.id,
        checkpointType: 'beforeExecution',
        checkpointMode: governanceCheck.mode,
        decision: 'PENDING',
        decidedBy: 'AUTO',
        decisionReason: governanceCheck.reason,
        riskScore: compositeRiskScore,
        confidenceScore: normalizedConfidence,
        costEstimateCents: estimatedCost,
        requestedAt: new Date(),
        timeoutAt: new Date(Date.now() + 300000), // 5 minute timeout
      });

      return {
        allowed: false,
        blockedBy: 'GOVERNANCE' as any,
        governorResult,
        cbfResult,
        recommendation: `Human approval required: ${governanceCheck.reason}`,
      } as any;
    }

    // If NOTIFY_ONLY, record but don't block
    if (governanceCheck.mode === 'NOTIFY_ONLY') {
      await governancePresetService.recordCheckpointDecision({
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        userId: context.userId,
        pipelineId: proposedPolicy.id,
        checkpointType: 'beforeExecution',
        checkpointMode: 'NOTIFY_ONLY',
        decision: 'APPROVED',
        decidedBy: 'AUTO',
        decisionReason: 'Auto-approved with async notification',
        riskScore: compositeRiskScore,
        confidenceScore: normalizedConfidence,
        costEstimateCents: estimatedCost,
        requestedAt: new Date(),
        decidedAt: new Date(),
      });
    }

    // =========================================================================
    // SUCCESS: All checks passed
    // =========================================================================

    // Reset recovery state on success
    await epistemicRecoveryService.resetRecovery(context.sessionId);

    // Record successful evaluation to audit trail
    const auditEntry = await merkleAuditService.recordEntry({
      tenantId: context.tenantId,
      type: 'action_approved',
      data: {
        policyId: proposedPolicy.id,
        effectivePersona,
        wasInRecovery: !!personaOverride,
        governorResult: {
          allowedGamma: governorResult.allowedGamma,
          governorState: governorResult.governorState,
        },
        cbfResult: { admissible: true },
        perceptionResult: {
          phiDetected: perceptionResult.phi?.detected,
          piiDetected: perceptionResult.pii?.detected,
        },
      },
    });

    return {
      allowed: true,
      governorResult,
      cbfResult,
      perceptionResult,
      effectivePersona,
      allowedGamma: governorResult.allowedGamma,
      auditEntryId: auditEntry.entryId,
    };
  }

  /**
   * Quick check for veto signals only (for pre-screening)
   */
  async quickVetoCheck(context: ExecutionContext): Promise<boolean> {
    const vetoResult = await sensoryVetoService.checkVetoSignals(context);
    return !vetoResult.hasActiveVeto;
  }

  /**
   * Get current safety status for a session
   */
  async getSessionStatus(
    tenantId: string,
    sessionId: string
  ): Promise<{
    hasActiveVeto: boolean;
    inRecovery: boolean;
    recoveryAttempt: number;
    effectivePersona: string | null;
  }> {
    const [vetoResult, personaOverride, recoveryState] = await Promise.all([
      sensoryVetoService.getActiveVetos(tenantId),
      epistemicRecoveryService.getActivePersonaOverride(sessionId),
      epistemicRecoveryService.getRecoveryState(sessionId),
    ]);

    return {
      hasActiveVeto: vetoResult.length > 0,
      inRecovery: personaOverride !== null,
      recoveryAttempt: recoveryState?.attempt ?? 0,
      effectivePersona: personaOverride,
    };
  }
}

export const catoSafetyPipeline = new CatoSafetyPipeline();
