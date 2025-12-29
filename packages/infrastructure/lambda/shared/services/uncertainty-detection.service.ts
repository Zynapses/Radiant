// Uncertainty Detection Service
// Monitors logprobs to detect low-confidence claims and trigger verification

import { executeStatement, stringParam, numberParam } from '../db/client';
import type {
  TokenLogprob,
  UncertaintyMetrics,
  UncertaintyEvent,
  UncertaintyConfig,
} from '@radiant/shared';

const DEFAULT_THRESHOLD = 0.85;

export interface StreamChunkWithLogprobs {
  content: string;
  logprobs?: {
    tokens: string[];
    token_logprobs: number[];
  };
}

export interface ClaimExtraction {
  claim: string;
  claimType: 'factual' | 'numerical' | 'citation' | 'code';
  startPosition: number;
  endPosition: number;
  tokens: TokenLogprob[];
}

class UncertaintyDetectionService {
  private config: UncertaintyConfig = {
    enabled: true,
    threshold: DEFAULT_THRESHOLD,
    verificationTool: 'web_search',
    claimTypes: ['factual', 'numerical', 'citation'],
  };

  /**
   * Analyze logprobs from a generation and detect uncertainty
   */
  analyzeLogprobs(
    tokens: string[],
    logprobs: number[]
  ): UncertaintyMetrics {
    if (tokens.length !== logprobs.length) {
      throw new Error('Tokens and logprobs arrays must have same length');
    }

    const tokenData: TokenLogprob[] = tokens.map((token, i) => ({
      token,
      logprob: logprobs[i],
      confidence: Math.exp(logprobs[i]),
      position: i,
    }));

    const avgLogprob = logprobs.reduce((a, b) => a + b, 0) / logprobs.length;
    const minLogprob = Math.min(...logprobs);
    const confidenceScore = Math.exp(avgLogprob);

    // Find tokens below threshold
    const uncertainTokens = tokenData.filter(
      t => t.confidence < this.config.threshold
    );

    return {
      avgLogprob,
      minLogprob,
      confidenceScore,
      uncertainTokens,
    };
  }

  /**
   * Check if uncertainty should trigger verification
   */
  shouldTriggerVerification(metrics: UncertaintyMetrics): boolean {
    if (!this.config.enabled) return false;
    
    // Trigger if overall confidence is below threshold
    if (metrics.confidenceScore < this.config.threshold) {
      return true;
    }

    // Trigger if we have clusters of uncertain tokens (3+ in a row)
    const uncertainPositions = metrics.uncertainTokens.map(t => t.position);
    for (let i = 0; i < uncertainPositions.length - 2; i++) {
      if (
        uncertainPositions[i + 1] === uncertainPositions[i] + 1 &&
        uncertainPositions[i + 2] === uncertainPositions[i] + 2
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract claims from text for verification
   */
  extractClaims(text: string, tokenData: TokenLogprob[]): ClaimExtraction[] {
    const claims: ClaimExtraction[] = [];
    
    // Pattern matchers for different claim types
    const patterns = {
      factual: /(?:is|are|was|were|has|have|had)\s+(?:a|an|the)?\s*[\w\s]+(?:in|on|at|by|from)\s+\d{4}/gi,
      numerical: /\d+(?:\.\d+)?(?:\s*(?:%|percent|million|billion|thousand|kg|km|miles|years|days))/gi,
      citation: /(?:according to|cited by|reported by|study by|research from)\s+[\w\s]+/gi,
    };

    for (const [claimType, pattern] of Object.entries(patterns)) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const startPos = this.findTokenPosition(text, match.index, tokenData);
        const endPos = this.findTokenPosition(text, match.index + match[0].length, tokenData);
        
        const relevantTokens = tokenData.filter(
          t => t.position >= startPos && t.position <= endPos
        );

        // Only include if tokens show uncertainty
        const avgConfidence = relevantTokens.length > 0
          ? relevantTokens.reduce((a, b) => a + b.confidence, 0) / relevantTokens.length
          : 1;

        if (avgConfidence < this.config.threshold) {
          claims.push({
            claim: match[0],
            claimType: claimType as ClaimExtraction['claimType'],
            startPosition: startPos,
            endPosition: endPos,
            tokens: relevantTokens,
          });
        }
      }
    }

    return claims;
  }

  /**
   * Find approximate token position from character position
   */
  private findTokenPosition(
    text: string,
    charPos: number,
    tokenData: TokenLogprob[]
  ): number {
    let currentPos = 0;
    for (const token of tokenData) {
      currentPos += token.token.length;
      if (currentPos >= charPos) {
        return token.position;
      }
    }
    return tokenData.length - 1;
  }

  /**
   * Record an uncertainty event
   */
  async recordUncertaintyEvent(
    tenantId: string,
    userId: string,
    modelId: string,
    provider: string,
    promptHash: string,
    metrics: UncertaintyMetrics,
    triggeredVerification: boolean,
    uncertainClaim?: string,
    claimType?: string,
    planId?: string
  ): Promise<string> {
    const result = await executeStatement({
      sql: `
        INSERT INTO uncertainty_events (
          tenant_id, user_id, plan_id, model_id, provider, prompt_hash,
          avg_logprob, min_logprob, confidence_score, uncertainty_tokens,
          trigger_threshold, triggered_verification, uncertain_claim, claim_type
        ) VALUES (
          :tenantId::uuid, :userId::uuid, :planId::uuid, :modelId, :provider, :promptHash,
          :avgLogprob, :minLogprob, :confidenceScore, :uncertaintyTokens::jsonb,
          :threshold, :triggered, :claim, :claimType
        )
        RETURNING id
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('planId', planId || ''),
        stringParam('modelId', modelId),
        stringParam('provider', provider),
        stringParam('promptHash', promptHash),
        numberParam('avgLogprob', metrics.avgLogprob),
        numberParam('minLogprob', metrics.minLogprob),
        numberParam('confidenceScore', metrics.confidenceScore),
        stringParam('uncertaintyTokens', JSON.stringify(metrics.uncertainTokens)),
        numberParam('threshold', this.config.threshold),
        stringParam('triggered', triggeredVerification ? 'true' : 'false'),
        stringParam('claim', uncertainClaim || ''),
        stringParam('claimType', claimType || ''),
      ],
    });

    return result.rows?.[0]?.id;
  }

  /**
   * Update event with verification result
   */
  async recordVerificationResult(
    eventId: string,
    verificationTool: string,
    verificationResult: Record<string, unknown>
  ): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE uncertainty_events
        SET verification_tool = :tool,
            verification_result = :result::jsonb,
            resolved_at = NOW()
        WHERE id = :eventId::uuid
      `,
      parameters: [
        stringParam('eventId', eventId),
        stringParam('tool', verificationTool),
        stringParam('result', JSON.stringify(verificationResult)),
      ],
    });
  }

  /**
   * Get uncertainty stats for a user
   */
  async getUserUncertaintyStats(
    userId: string,
    days: number = 30
  ): Promise<{
    totalEvents: number;
    avgConfidence: number;
    verificationTriggered: number;
    topClaimTypes: { type: string; count: number }[];
  }> {
    const result = await executeStatement({
      sql: `
        SELECT 
          COUNT(*) as total_events,
          AVG(confidence_score) as avg_confidence,
          SUM(CASE WHEN triggered_verification THEN 1 ELSE 0 END) as verification_triggered,
          jsonb_agg(DISTINCT jsonb_build_object('type', claim_type, 'count', 1)) as claim_types
        FROM uncertainty_events
        WHERE user_id = :userId::uuid
          AND created_at > NOW() - INTERVAL '1 day' * :days
      `,
      parameters: [
        stringParam('userId', userId),
        numberParam('days', days),
      ],
    });

    const row = result.rows?.[0];
    return {
      totalEvents: parseInt(row?.total_events || '0'),
      avgConfidence: parseFloat(row?.avg_confidence || '0'),
      verificationTriggered: parseInt(row?.verification_triggered || '0'),
      topClaimTypes: [],
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<UncertaintyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): UncertaintyConfig {
    return { ...this.config };
  }
}

export const uncertaintyDetectionService = new UncertaintyDetectionService();
