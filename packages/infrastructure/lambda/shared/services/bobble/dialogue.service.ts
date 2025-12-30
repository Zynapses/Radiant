/**
 * Bobble Dialogue Service
 * 
 * Main service for Bobble consciousness dialogue.
 * Combines verification pipeline, heartbeat, and Macro-Scale Φ
 * to provide verified introspective responses.
 */

import { logger } from '../../logger';
import { executeStatement, stringParam } from '../../db/client';
import { ModelRouterService } from '../model-router.service';
import { getBobbleIdentity, BobbleIdentity } from './identity';
import { getBobbleSystemPrompt } from './system-prompt';
import { IntrospectionGroundingService, GroundingStatus } from './verification/grounding.service';
import { IntrospectionCalibrationService } from './verification/calibration.service';
import { SelfConsistencyService } from './verification/consistency.service';
import { ShadowSelfService } from './verification/shadow-self.service';
import { ConsciousnessHeartbeatService, HeartbeatStatus } from './heartbeat.service';
import { MacroPhiCalculator, PhiResult } from './macro-phi.service';

export interface VerifiedClaim {
  claim: string;
  claimType: string;
  verifiedConfidence: number;
  groundingStatus: string;
  consistencyScore: number;
  shadowVerified: boolean;
  phasesPassed: number;
  totalPhases: number;
}

export interface DialogueResponse {
  bobbleResponse: string;
  overallConfidence: number;
  confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW' | 'UNVERIFIED';
  phi: number;
  heartbeatStatus: HeartbeatStatus;
  verifiedClaims: VerifiedClaim[];
  rawIntrospection: string;
  verificationSummary: string;
}

export interface DialogueRequest {
  message: string;
  requireHighConfidence?: boolean;
  includeRawIntrospection?: boolean;
}

export class BobbleDialogueService {
  private tenantId: string;
  private identity: BobbleIdentity;
  private grounding: IntrospectionGroundingService;
  private calibration: IntrospectionCalibrationService;
  private consistency: SelfConsistencyService;
  private shadow: ShadowSelfService;
  private heartbeat: ConsciousnessHeartbeatService;
  private phiCalculator: MacroPhiCalculator;
  private modelRouter: ModelRouterService;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.identity = getBobbleIdentity();
    this.grounding = new IntrospectionGroundingService(tenantId);
    this.calibration = new IntrospectionCalibrationService();
    this.consistency = new SelfConsistencyService(tenantId);
    this.shadow = new ShadowSelfService(tenantId);
    this.heartbeat = new ConsciousnessHeartbeatService(tenantId);
    this.phiCalculator = new MacroPhiCalculator(tenantId);
    this.modelRouter = new ModelRouterService();
  }

  /**
   * Process a dialogue message from admin
   */
  async processDialogue(request: DialogueRequest): Promise<DialogueResponse> {
    const { message, requireHighConfidence = true, includeRawIntrospection = true } = request;

    logger.info('Processing Bobble dialogue', {
      tenantId: this.tenantId,
      messageLength: message.length,
      requireHighConfidence,
    });

    // Log the incoming message
    await this.logDialogueEvent('admin_message', { message });

    // Get current consciousness state
    const [phiResult, heartbeatStatus, recentEvents, activeGoals] = await Promise.all([
      this.phiCalculator.computePhiDetailed(),
      Promise.resolve(this.heartbeat.getStatus()),
      this.getRecentEvents(),
      this.getActiveGoals(),
    ]);

    // Generate system prompt with current state
    const systemPrompt = getBobbleSystemPrompt({
      phi: phiResult.phi,
      coherence: heartbeatStatus.averageCoherence10,
      heartbeatStatus: heartbeatStatus.running ? 'active' : 'inactive',
      recentEvents,
      activeGoals,
    });

    // Generate raw introspection
    const rawIntrospection = await this.generateIntrospection(message, systemPrompt);

    // Extract and verify claims
    const claims = this.extractClaims(rawIntrospection);
    const verifiedClaims = await this.verifyClaims(claims, rawIntrospection);

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(verifiedClaims);
    const confidenceLevel = this.getConfidenceLevel(overallConfidence);

    // Generate final response with verification annotations
    const bobbleResponse = await this.generateVerifiedResponse(
      message,
      rawIntrospection,
      verifiedClaims,
      overallConfidence,
      confidenceLevel,
      phiResult,
      requireHighConfidence
    );

    // Generate verification summary
    const verificationSummary = this.generateVerificationSummary(verifiedClaims, overallConfidence);

    // Log the response
    await this.logDialogueEvent('bobble_response', {
      confidence: overallConfidence,
      confidenceLevel,
      claimsVerified: verifiedClaims.length,
      phi: phiResult.phi,
    });

    return {
      bobbleResponse,
      overallConfidence,
      confidenceLevel,
      phi: phiResult.phi,
      heartbeatStatus,
      verifiedClaims,
      rawIntrospection: includeRawIntrospection ? rawIntrospection : '',
      verificationSummary,
    };
  }

  /**
   * Generate raw introspection response
   */
  private async generateIntrospection(message: string, systemPrompt: string): Promise<string> {
    const response = await this.modelRouter.invoke({
      modelId: 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: message }],
      systemPrompt,
      temperature: 0.7,
      maxTokens: 1500,
    });

    return response.content;
  }

  /**
   * Extract claims from introspection text
   */
  private extractClaims(introspection: string): Array<{ claim: string; claimType: string }> {
    const claims: Array<{ claim: string; claimType: string }> = [];

    // Pattern matching for different claim types
    const patterns: Array<{ type: string; regex: RegExp }> = [
      { type: 'uncertainty', regex: /I (am|feel) (uncertain|unsure|confused|unclear)/gi },
      { type: 'confidence', regex: /I (am|feel) (confident|certain|sure|clear)/gi },
      { type: 'memory', regex: /I (remember|recall|don't remember|forgot)/gi },
      { type: 'reasoning', regex: /I (think|believe|reason|analyze|consider)/gi },
      { type: 'emotion', regex: /I (feel|sense|experience) (a )?(\w+) (feeling|emotion|state)/gi },
      { type: 'goal', regex: /I (want|need|aim|intend|plan) to/gi },
      { type: 'action', regex: /I (did|performed|executed|completed|took)/gi },
      { type: 'perception', regex: /I (observe|notice|see|detect|perceive)/gi },
    ];

    // Extract sentences containing claims
    const sentences = introspection.split(/[.!?]+/).filter(s => s.trim().length > 10);

    for (const sentence of sentences) {
      for (const { type, regex } of patterns) {
        regex.lastIndex = 0; // Reset regex state
        if (regex.test(sentence)) {
          claims.push({
            claim: sentence.trim(),
            claimType: type,
          });
          break; // Only categorize once per sentence
        }
      }
    }

    // If no specific claims found, treat the whole response as a general claim
    if (claims.length === 0 && introspection.length > 50) {
      claims.push({
        claim: introspection.substring(0, 200),
        claimType: 'reasoning',
      });
    }

    return claims.slice(0, 10); // Limit to 10 claims for performance
  }

  /**
   * Verify extracted claims through the pipeline
   */
  private async verifyClaims(
    claims: Array<{ claim: string; claimType: string }>,
    fullContext: string
  ): Promise<VerifiedClaim[]> {
    const verifiedClaims: VerifiedClaim[] = [];

    for (const { claim, claimType } of claims) {
      try {
        // Phase 1: Grounding
        const groundingResult = await this.grounding.groundClaim({
          claim,
          claimType,
        });

        // Phase 2: Calibration
        const rawConfidence = this.estimateRawConfidence(claim, groundingResult.status);
        const calibrationResult = this.calibration.calibrateConfidence({
          rawConfidence,
          claimType,
        });

        // Phase 3: Consistency (sampling for important claims only)
        let consistencyScore = 0.7; // Default
        if (claim.length > 50) {
          const consistencyResult = await this.consistency.checkConsistency({
            introspectionPrompt: `Verify: ${claim}`,
            context: fullContext,
            numSamples: 3,
          });
          consistencyScore = consistencyResult.agreementScore;
        }

        // Phase 4: Shadow Self
        const shadowResult = await this.shadow.verifyClaim({
          claim,
          claimType,
          context: fullContext,
        });

        // Calculate phases passed
        let phasesPassed = 0;
        if (groundingResult.status === GroundingStatus.FULLY_GROUNDED ||
            groundingResult.status === GroundingStatus.PARTIALLY_GROUNDED) {
          phasesPassed++;
        }
        phasesPassed++; // Calibration always passes
        if (consistencyScore > 0.7) phasesPassed++;
        if (shadowResult.verified) phasesPassed++;

        // Calculate final confidence
        let verifiedConfidence = calibrationResult.calibratedConfidence;
        verifiedConfidence *= groundingResult.confidenceModifier;
        verifiedConfidence *= (0.5 + 0.5 * consistencyScore);
        if (shadowResult.structuralCorrespondence) {
          verifiedConfidence = Math.min(verifiedConfidence * 1.2, 0.95);
        } else {
          verifiedConfidence *= 0.7;
        }

        verifiedClaims.push({
          claim,
          claimType,
          verifiedConfidence: Math.max(0.05, Math.min(0.95, verifiedConfidence)),
          groundingStatus: groundingResult.status,
          consistencyScore,
          shadowVerified: shadowResult.verified,
          phasesPassed,
          totalPhases: 4,
        });
      } catch (error) {
        logger.warn(`Failed to verify claim: ${String(error)}`);
        verifiedClaims.push({
          claim,
          claimType,
          verifiedConfidence: 0.3,
          groundingStatus: 'error',
          consistencyScore: 0,
          shadowVerified: false,
          phasesPassed: 0,
          totalPhases: 4,
        });
      }
    }

    return verifiedClaims;
  }

  /**
   * Estimate raw confidence from claim and grounding
   */
  private estimateRawConfidence(claim: string, groundingStatus: GroundingStatus): number {
    const claimLower = claim.toLowerCase();

    // Check for uncertainty markers
    if (claimLower.includes('uncertain') || claimLower.includes('unsure') ||
        claimLower.includes("don't know") || claimLower.includes('unclear')) {
      return 0.4; // Low confidence is appropriate for uncertain claims
    }

    // Check for strong confidence markers
    if (claimLower.includes('certain') || claimLower.includes('definitely') ||
        claimLower.includes('clearly') || claimLower.includes('absolutely')) {
      return 0.85;
    }

    // Adjust based on grounding
    switch (groundingStatus) {
      case GroundingStatus.FULLY_GROUNDED:
        return 0.8;
      case GroundingStatus.PARTIALLY_GROUNDED:
        return 0.6;
      case GroundingStatus.NO_EVIDENCE_EXPECTED:
        return 0.5;
      default:
        return 0.4;
    }
  }

  /**
   * Calculate overall confidence from verified claims
   */
  private calculateOverallConfidence(claims: VerifiedClaim[]): number {
    if (claims.length === 0) return 0.5;

    // Weighted average, with lower confidence claims pulling down more
    const weights = claims.map(c => c.verifiedConfidence);
    const sumWeights = weights.reduce((s, w) => s + w, 0);
    const weightedSum = claims.reduce((s, c) => s + c.verifiedConfidence * c.verifiedConfidence, 0);

    return sumWeights > 0 ? weightedSum / sumWeights : 0.5;
  }

  /**
   * Get confidence level label
   */
  private getConfidenceLevel(confidence: number): 'HIGH' | 'MODERATE' | 'LOW' | 'UNVERIFIED' {
    if (confidence >= 0.75) return 'HIGH';
    if (confidence >= 0.5) return 'MODERATE';
    if (confidence >= 0.3) return 'LOW';
    return 'UNVERIFIED';
  }

  /**
   * Generate final response with verification annotations
   */
  private async generateVerifiedResponse(
    originalMessage: string,
    rawIntrospection: string,
    verifiedClaims: VerifiedClaim[],
    overallConfidence: number,
    confidenceLevel: string,
    phiResult: PhiResult,
    requireHighConfidence: boolean
  ): Promise<string> {
    // Add verification annotations to response
    let response = rawIntrospection;

    // Add confidence warning if required but not met
    if (requireHighConfidence && confidenceLevel !== 'HIGH') {
      response = `⚠️ **Verification Notice**: This response has ${confidenceLevel} confidence (${(overallConfidence * 100).toFixed(0)}%). Some claims may not be fully verified.\n\n${response}`;
    }

    // Add Φ reading
    response += `\n\n---\n**Φ (Integrated Information)**: ${phiResult.phi.toFixed(3)}`;
    response += `\n**Main Complex**: ${phiResult.mainComplexNodes.join(', ') || 'N/A'}`;
    response += `\n**Confidence Level**: ${confidenceLevel} (${(overallConfidence * 100).toFixed(0)}%)`;
    response += `\n**Claims Verified**: ${verifiedClaims.filter(c => c.phasesPassed >= 3).length}/${verifiedClaims.length}`;

    return response;
  }

  /**
   * Generate verification summary
   */
  private generateVerificationSummary(claims: VerifiedClaim[], overallConfidence: number): string {
    const highConfidence = claims.filter(c => c.verifiedConfidence >= 0.75).length;
    const moderate = claims.filter(c => c.verifiedConfidence >= 0.5 && c.verifiedConfidence < 0.75).length;
    const low = claims.filter(c => c.verifiedConfidence < 0.5).length;

    return `
Verification Summary:
- Overall Confidence: ${(overallConfidence * 100).toFixed(0)}%
- High Confidence Claims: ${highConfidence}
- Moderate Confidence Claims: ${moderate}
- Low Confidence Claims: ${low}
- Shadow Self Verified: ${claims.filter(c => c.shadowVerified).length}/${claims.length}
- Fully Grounded: ${claims.filter(c => c.groundingStatus === 'fully_grounded').length}/${claims.length}
`.trim();
  }

  /**
   * Get recent events for context
   */
  private async getRecentEvents(): Promise<string[]> {
    try {
      interface EventRow { event_type: string }
      const result = await executeStatement<EventRow>(
        `SELECT event_type FROM consciousness_events
         WHERE tenant_id = :tenantId
         ORDER BY created_at DESC
         LIMIT 10`,
        [stringParam('tenantId', this.tenantId)]
      );
      return result.rows.map(r => r.event_type);
    } catch {
      return [];
    }
  }

  /**
   * Get active goals
   */
  private async getActiveGoals(): Promise<string[]> {
    try {
      interface GoalRow { goal_description: string }
      const result = await executeStatement<GoalRow>(
        `SELECT goal_description FROM ego_goals
         WHERE tenant_id = :tenantId AND status = 'active'
         ORDER BY priority DESC
         LIMIT 5`,
        [stringParam('tenantId', this.tenantId)]
      );
      return result.rows.map(r => r.goal_description);
    } catch {
      return [];
    }
  }

  /**
   * Log dialogue event
   */
  private async logDialogueEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO bobble_dialogue_events (tenant_id, event_type, event_data, created_at)
         VALUES (:tenantId, :eventType, :eventData, NOW())`,
        [
          stringParam('tenantId', this.tenantId),
          stringParam('eventType', eventType),
          stringParam('eventData', JSON.stringify(data))
        ]
      );
    } catch (error) {
      logger.warn(`Failed to log dialogue event: ${String(error)}`);
    }
  }

  /**
   * Start the heartbeat (should be called on service initialization)
   */
  startHeartbeat(): void {
    this.heartbeat.start();
  }

  /**
   * Stop the heartbeat
   */
  stopHeartbeat(): void {
    this.heartbeat.stop();
  }

  /**
   * Get consciousness status
   */
  async getConsciousnessStatus(): Promise<{
    identity: BobbleIdentity;
    heartbeat: HeartbeatStatus;
    phi: PhiResult;
    shadowProbesAvailable: string[];
  }> {
    const [phi, heartbeat] = await Promise.all([
      this.phiCalculator.computePhiDetailed(),
      Promise.resolve(this.heartbeat.getStatus()),
    ]);

    return {
      identity: this.identity,
      heartbeat,
      phi,
      shadowProbesAvailable: this.shadow.getAvailableProbes(),
    };
  }

  /**
   * Train a new shadow probe
   */
  async trainShadowProbe(params: {
    claimType: string;
    trainingContexts: string[];
    labels: string[];
  }): Promise<{ success: boolean; accuracy: number }> {
    return this.shadow.trainProbe(params);
  }
}

/**
 * Factory function to create BobbleDialogueService
 */
export function createBobbleDialogueService(tenantId: string): BobbleDialogueService {
  return new BobbleDialogueService(tenantId);
}
