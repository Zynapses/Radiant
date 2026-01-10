/**
 * RADIANT v6.0.4-S1 - ECD Verification Service
 * Integrates ECD scoring into the brain inference pipeline
 * 
 * Project TRUTH - Trustworthy Reasoning Using Thorough Hallucination-prevention
 */

import { 
  VerificationResult, 
  ECDConfig, 
  DEFAULT_ECD_CONFIG,
  ECDScore,
  AnchoringResult,
  HIGH_RISK_DOMAINS,
  HighRiskDomain,
} from '@radiant/shared';
import { ecdScorerService } from './ecd-scorer.service';
import { factAnchorService } from './fact-anchor.service';
import { brainConfigService } from './brain-config.service';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// =============================================================================
// ECD Verification Service
// =============================================================================

class ECDVerificationService {
  /**
   * Load ECD configuration from system config
   */
  async loadConfig(): Promise<ECDConfig> {
    const [
      enabled,
      threshold,
      maxRefinements,
      blockOnFailure,
      healthcareThreshold,
      financialThreshold,
      legalThreshold,
      anchoringEnabled,
      anchoringOversight,
    ] = await Promise.all([
      brainConfigService.getBoolean('ECD_ENABLED' as any, true),
      brainConfigService.getNumber('ECD_THRESHOLD' as any, 0.1),
      brainConfigService.getNumber('ECD_MAX_REFINEMENTS' as any, 2),
      brainConfigService.getBoolean('ECD_BLOCK_ON_FAILURE' as any, false),
      brainConfigService.getNumber('ECD_HEALTHCARE_THRESHOLD' as any, 0.05),
      brainConfigService.getNumber('ECD_FINANCIAL_THRESHOLD' as any, 0.05),
      brainConfigService.getNumber('ECD_LEGAL_THRESHOLD' as any, 0.05),
      brainConfigService.getBoolean('ECD_ANCHORING_ENABLED' as any, true),
      brainConfigService.getBoolean('ECD_ANCHORING_OVERSIGHT' as any, true),
    ]);

    return {
      enabled,
      threshold,
      maxRefinements,
      strictDomains: {
        healthcare: healthcareThreshold,
        financial: financialThreshold,
        legal: legalThreshold,
      },
      criticalECDEntityTypes: DEFAULT_ECD_CONFIG.criticalECDEntityTypes,
      blockOnFailure,
      anchoringEnabled,
      anchoringOversight,
    };
  }

  /**
   * Execute inference with ECD verification loop
   */
  async executeWithVerification(params: {
    userId: string;
    tenantId: string;
    requestId?: string;
    prompt: string;
    sourceContext: string;
    flashFacts: string[];
    retrievedDocs: string[];
    domain: string;
    generateResponse: (prompt: string) => Promise<string>;
  }): Promise<VerificationResult> {
    const config = await this.loadConfig();

    // If ECD is disabled, skip verification
    if (!config.enabled) {
      const response = await params.generateResponse(params.prompt);
      return {
        passed: true,
        ecdScore: this.createEmptyScore(),
        refinementAttempts: 1,
        finalResponse: response,
        blocked: false,
        requiresOversight: false,
      };
    }

    // Determine threshold based on domain
    const isHighRisk = HIGH_RISK_DOMAINS.includes(params.domain as HighRiskDomain);
    const threshold = isHighRisk
      ? config.strictDomains[params.domain as keyof typeof config.strictDomains] || config.threshold
      : config.threshold;

    let attempts = 0;
    let lastResponse = '';
    let lastEcdScore: ECDScore | null = null;
    let refinementFeedback = '';

    // Verification loop
    do {
      attempts++;

      // Build prompt with any refinement feedback
      const inferencePrompt = refinementFeedback
        ? `${params.prompt}\n\n${refinementFeedback}`
        : params.prompt;

      // Generate response
      lastResponse = await params.generateResponse(inferencePrompt);

      // Score for ECD
      lastEcdScore = await ecdScorerService.score({
        response: lastResponse,
        sourceContext: params.sourceContext,
        flashFacts: params.flashFacts,
        retrievedDocs: params.retrievedDocs,
        userMessage: params.prompt,
        threshold,
      });

      logger.debug('ECD verification attempt', {
        attempt: attempts,
        score: lastEcdScore.score,
        threshold,
        passed: lastEcdScore.passed,
        divergentCount: lastEcdScore.divergentEntities.length,
      });

      // Check if passed
      if (lastEcdScore.passed) {
        break;
      }

      // Build refinement feedback for next attempt
      if (attempts < config.maxRefinements) {
        refinementFeedback = ecdScorerService.buildRefinementFeedback(lastEcdScore, attempts);
        
        logger.info('ECD refinement required', {
          attempt: attempts,
          score: lastEcdScore.score,
          threshold,
          divergentCount: lastEcdScore.divergentEntities.length,
        });
      }

    } while (attempts < config.maxRefinements && !lastEcdScore!.passed);

    // Check for critical fact anchoring in high-risk domains
    let anchoringResult: AnchoringResult | null = null;
    if (config.anchoringEnabled && isHighRisk) {
      anchoringResult = await factAnchorService.verify({
        response: lastResponse,
        domain: params.domain as HighRiskDomain,
        sources: params.retrievedDocs,
        flashFacts: params.flashFacts,
      });
    }

    // Determine final status
    const passed = lastEcdScore!.passed && (!anchoringResult || anchoringResult.isFullyAnchored);
    const blocked = !passed && config.blockOnFailure;
    const requiresOversight = config.anchoringOversight && (
      (anchoringResult?.requiresOversight) ||
      lastEcdScore!.hallucinations.some(h => h.severity === 'critical')
    );

    // Log metrics
    await this.logMetrics({
      userId: params.userId,
      tenantId: params.tenantId,
      requestId: params.requestId,
      ecdScore: lastEcdScore!.score,
      divergentEntities: lastEcdScore!.divergentEntities.map(e => ({
        value: e.entity.value,
        type: e.entity.type,
        reason: e.reason,
      })),
      groundedCount: lastEcdScore!.groundedEntities.length,
      refinementAttempts: attempts,
      passed,
      blocked,
      domain: params.domain,
      threshold,
    });

    // Update entity stats
    await this.updateEntityStats(params.tenantId, lastEcdScore!);

    const finalResponse = blocked
      ? ecdScorerService.buildBlockedResponse(lastEcdScore!, anchoringResult?.unanchoredFacts.length)
      : lastResponse;

    return {
      passed,
      ecdScore: lastEcdScore!,
      refinementAttempts: attempts,
      finalResponse,
      blocked,
      blockedReason: blocked ? 'Failed ECD verification after maximum refinement attempts' : undefined,
      requiresOversight,
    };
  }

  /**
   * Log ECD metrics to database
   */
  private async logMetrics(metrics: {
    userId: string;
    tenantId: string;
    requestId?: string;
    ecdScore: number;
    divergentEntities: Array<{ value: string; type: string; reason: string }>;
    groundedCount: number;
    refinementAttempts: number;
    passed: boolean;
    blocked: boolean;
    domain: string;
    threshold: number;
  }): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO ecd_metrics 
         (user_id, tenant_id, request_id, ecd_score, divergent_entities, 
          grounded_entities_count, refinement_attempts, passed, blocked, domain, threshold_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          { name: 'userId', value: { stringValue: metrics.userId } },
          { name: 'tenantId', value: { stringValue: metrics.tenantId } },
          { name: 'requestId', value: metrics.requestId ? { stringValue: metrics.requestId } : { isNull: true } },
          { name: 'ecdScore', value: { doubleValue: metrics.ecdScore } },
          { name: 'divergentEntities', value: { stringValue: JSON.stringify(metrics.divergentEntities) } },
          { name: 'groundedCount', value: { longValue: metrics.groundedCount } },
          { name: 'refinementAttempts', value: { longValue: metrics.refinementAttempts } },
          { name: 'passed', value: { booleanValue: metrics.passed } },
          { name: 'blocked', value: { booleanValue: metrics.blocked } },
          { name: 'domain', value: { stringValue: metrics.domain } },
          { name: 'threshold', value: { doubleValue: metrics.threshold } },
        ]
      );
    } catch (error) {
      logger.error(`Failed to log ECD metrics: ${String(error)}`);
    }
  }

  /**
   * Update entity type statistics
   */
  private async updateEntityStats(tenantId: string, ecdScore: ECDScore): Promise<void> {
    try {
      for (const [entityType, stats] of Object.entries(ecdScore.breakdown)) {
        if (stats.total > 0) {
          await executeStatement(
            `SELECT update_ecd_entity_stats($1, $2, $3, $4)`,
            [
              { name: 'tenantId', value: { stringValue: tenantId } },
              { name: 'entityType', value: { stringValue: entityType } },
              { name: 'grounded', value: { longValue: stats.grounded } },
              { name: 'divergent', value: { longValue: stats.divergent } },
            ]
          );
        }
      }
    } catch (error) {
      logger.error(`Failed to update ECD entity stats: ${String(error)}`);
    }
  }

  /**
   * Create an empty ECD score for when verification is disabled
   */
  private createEmptyScore(): ECDScore {
    return {
      score: 0,
      divergentEntities: [],
      groundedEntities: [],
      hallucinations: [],
      confidence: 1,
      passed: true,
      breakdown: {} as ECDScore['breakdown'],
    };
  }

  /**
   * Estimate ECD risk for a prompt (used by SOFAI router)
   */
  estimateECDRisk(prompt: string): number {
    let risk = 0.3; // Baseline risk

    // Queries asking for specific facts are higher risk
    const factualPatterns = [
      /\bwhat is\b/i,
      /\bhow much\b/i,
      /\bwhen did\b/i,
      /\bwho is\b/i,
      /\bhow many\b/i,
      /\bexactly\b/i,
      /\bspecifically\b/i,
    ];
    
    for (const pattern of factualPatterns) {
      if (pattern.test(prompt)) {
        risk += 0.1;
        break; // Only count once
      }
    }

    // Queries with numbers/dates have higher ECD risk
    if (/\d{4}|\d+%|\$\d+|\d+\s*(?:mg|ml|kg)/.test(prompt)) {
      risk += 0.15;
    }

    // Medical/legal/financial keywords indicate high-risk domains
    const highRiskKeywords = [
      /\bdosage\b/i, /\bmedication\b/i, /\bprescription\b/i, /\bdiagnosis\b/i,
      /\blawsuit\b/i, /\bcontract\b/i, /\bliability\b/i, /\bstatute\b/i,
      /\binvestment\b/i, /\binterest rate\b/i, /\btax\b/i, /\bpenalty\b/i,
    ];
    
    for (const pattern of highRiskKeywords) {
      if (pattern.test(prompt)) {
        risk += 0.2;
        break;
      }
    }

    // Questions about specific people or events are higher risk
    if (/\b(?:who|when|where)\s+(?:did|was|is)\b/i.test(prompt)) {
      risk += 0.1;
    }

    return Math.min(risk, 1.0);
  }
}

export const ecdVerificationService = new ECDVerificationService();
