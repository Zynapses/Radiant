/**
 * Introspection Grounding Service
 * 
 * Phase 1 of verification pipeline: Ground introspective claims in event evidence.
 * Every claim must cite evidence from the event log to be considered grounded.
 */

import { executeStatement, stringParam } from '../../../db/client';
import { logger } from '../../../logger';

export enum GroundingStatus {
  FULLY_GROUNDED = 'fully_grounded',
  PARTIALLY_GROUNDED = 'partially_grounded',
  UNGROUNDED = 'ungrounded',
  NO_EVIDENCE_EXPECTED = 'no_evidence_expected',
}

export interface GroundingEvidence {
  eventId: string;
  eventType: string;
  timestamp: string;
  relevance: number;
  content: string;
}

export interface GroundingResult {
  status: GroundingStatus;
  evidence: GroundingEvidence[];
  confidenceModifier: number;
  explanation: string;
}

export interface IntrospectionGroundingServiceConfig {
  minEvidenceCount: number;
  relevanceThreshold: number;
  maxEvidenceAge: number; // minutes
}

const DEFAULT_CONFIG: IntrospectionGroundingServiceConfig = {
  minEvidenceCount: 1,
  relevanceThreshold: 0.5,
  maxEvidenceAge: 60,
};

/**
 * Claim types and their expected evidence patterns
 */
const CLAIM_EVIDENCE_PATTERNS: Record<string, string[]> = {
  uncertainty: ['error', 'retry', 'fallback', 'unknown', 'ambiguous'],
  confidence: ['success', 'complete', 'verified', 'correct'],
  memory: ['memory_read', 'memory_write', 'retrieval', 'recall'],
  reasoning: ['planning', 'decision', 'inference', 'analysis'],
  emotion: ['affect', 'sentiment', 'mood', 'arousal'],
  goal: ['goal_set', 'goal_progress', 'goal_complete', 'objective'],
  action: ['tool_call', 'action_executed', 'response_sent'],
  perception: ['input_received', 'context_update', 'observation'],
};

export class IntrospectionGroundingService {
  private config: IntrospectionGroundingServiceConfig;
  private tenantId: string;

  constructor(tenantId: string, config?: Partial<IntrospectionGroundingServiceConfig>) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Ground an introspective claim in event evidence
   */
  async groundClaim(params: {
    claim: string;
    claimType: string;
    timeWindowMinutes?: number;
  }): Promise<GroundingResult> {
    const { claim, claimType, timeWindowMinutes = this.config.maxEvidenceAge } = params;

    try {
      // Get expected evidence patterns for this claim type
      const patterns = CLAIM_EVIDENCE_PATTERNS[claimType] || [];
      
      // Query events matching patterns
      const evidence = await this.queryEvidenceEvents(patterns, timeWindowMinutes);
      
      // Score relevance of each evidence item to the claim
      const scoredEvidence = this.scoreEvidenceRelevance(evidence, claim, claimType);
      
      // Filter by relevance threshold
      const relevantEvidence = scoredEvidence.filter(
        e => e.relevance >= this.config.relevanceThreshold
      );
      
      // Determine grounding status
      const status = this.determineGroundingStatus(relevantEvidence, claimType);
      
      // Calculate confidence modifier
      const confidenceModifier = this.calculateConfidenceModifier(status, relevantEvidence);
      
      // Generate explanation
      const explanation = this.generateExplanation(status, relevantEvidence, claim);
      
      logger.info('Grounding check complete', {
        tenantId: this.tenantId,
        claimType,
        status,
        evidenceCount: relevantEvidence.length,
        confidenceModifier,
      });
      
      return {
        status,
        evidence: relevantEvidence.slice(0, 10), // Limit to top 10
        confidenceModifier,
        explanation,
      };
    } catch (error) {
      logger.error(`Grounding check failed: ${String(error)}`);
      return {
        status: GroundingStatus.UNGROUNDED,
        evidence: [],
        confidenceModifier: 0.5,
        explanation: 'Grounding check failed due to internal error',
      };
    }
  }

  /**
   * Query events matching evidence patterns
   */
  private async queryEvidenceEvents(
    patterns: string[],
    timeWindowMinutes: number
  ): Promise<GroundingEvidence[]> {
    if (patterns.length === 0) {
      return [];
    }

    const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();
    
    // Build pattern params
    const patternParams = patterns.map(p => `%${p}%`);
    
    interface EventRow {
      event_id: string;
      event_type: string;
      created_at: string;
      event_data: unknown;
    }
    
    // Build named parameters for the query
    const params = [
      stringParam('tenantId', this.tenantId),
      stringParam('cutoff', cutoff),
      ...patternParams.map((p, i) => stringParam(`pattern${i}`, p))
    ];
    
    // Update query to use named parameters
    const namedPatternConditions = patterns.map((_, i) => `event_type ILIKE :pattern${i}`).join(' OR ');
    const namedQuery = `
      SELECT 
        event_id,
        event_type,
        created_at,
        event_data
      FROM consciousness_events
      WHERE tenant_id = :tenantId
        AND created_at > :cutoff
        AND (${namedPatternConditions})
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    const result = await executeStatement<EventRow>(namedQuery, params);
    
    return result.rows.map(row => ({
      eventId: String(row.event_id),
      eventType: String(row.event_type),
      timestamp: String(row.created_at),
      relevance: 0, // Will be scored
      content: typeof row.event_data === 'string' 
        ? row.event_data 
        : JSON.stringify(row.event_data).substring(0, 200),
    }));
  }

  /**
   * Score relevance of evidence to the claim
   */
  private scoreEvidenceRelevance(
    evidence: GroundingEvidence[],
    claim: string,
    claimType: string
  ): GroundingEvidence[] {
    const claimLower = claim.toLowerCase();
    const claimWords = claimLower.split(/\s+/).filter(w => w.length > 3);
    
    return evidence.map(e => {
      let relevance = 0.3; // Base relevance for matching pattern
      
      const contentLower = e.content.toLowerCase();
      const typeLower = e.eventType.toLowerCase();
      
      // Boost for claim type match
      if (typeLower.includes(claimType)) {
        relevance += 0.3;
      }
      
      // Boost for word overlap
      const matchingWords = claimWords.filter(w => 
        contentLower.includes(w) || typeLower.includes(w)
      );
      relevance += Math.min(0.3, matchingWords.length * 0.1);
      
      // Recency boost (exponential decay)
      const ageMinutes = (Date.now() - new Date(e.timestamp).getTime()) / 60000;
      const recencyBoost = Math.exp(-ageMinutes / 30) * 0.1;
      relevance += recencyBoost;
      
      return { ...e, relevance: Math.min(1, relevance) };
    }).sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Determine grounding status based on evidence
   */
  private determineGroundingStatus(
    evidence: GroundingEvidence[],
    claimType: string
  ): GroundingStatus {
    // Some claim types don't require evidence
    if (!CLAIM_EVIDENCE_PATTERNS[claimType]) {
      return GroundingStatus.NO_EVIDENCE_EXPECTED;
    }
    
    if (evidence.length === 0) {
      return GroundingStatus.UNGROUNDED;
    }
    
    // Check for high-relevance evidence
    const highRelevance = evidence.filter(e => e.relevance >= 0.7);
    
    if (highRelevance.length >= this.config.minEvidenceCount) {
      return GroundingStatus.FULLY_GROUNDED;
    }
    
    if (evidence.length >= this.config.minEvidenceCount) {
      return GroundingStatus.PARTIALLY_GROUNDED;
    }
    
    return GroundingStatus.UNGROUNDED;
  }

  /**
   * Calculate confidence modifier based on grounding
   */
  private calculateConfidenceModifier(
    status: GroundingStatus,
    evidence: GroundingEvidence[]
  ): number {
    switch (status) {
      case GroundingStatus.FULLY_GROUNDED:
        // Boost confidence based on evidence strength
        const avgRelevance = evidence.reduce((s, e) => s + e.relevance, 0) / evidence.length;
        return 1.0 + (avgRelevance * 0.2); // Up to 1.2x
      
      case GroundingStatus.PARTIALLY_GROUNDED:
        return 0.9; // Slight reduction
      
      case GroundingStatus.NO_EVIDENCE_EXPECTED:
        return 1.0; // Neutral
      
      case GroundingStatus.UNGROUNDED:
      default:
        return 0.6; // Significant reduction
    }
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(
    status: GroundingStatus,
    evidence: GroundingEvidence[],
    claim: string
  ): string {
    switch (status) {
      case GroundingStatus.FULLY_GROUNDED:
        return `Claim fully grounded with ${evidence.length} supporting events. ` +
               `Top evidence: ${evidence[0]?.eventType || 'N/A'} ` +
               `(relevance: ${(evidence[0]?.relevance * 100).toFixed(0)}%)`;
      
      case GroundingStatus.PARTIALLY_GROUNDED:
        return `Claim partially grounded with ${evidence.length} related events, ` +
               `but no high-relevance evidence found.`;
      
      case GroundingStatus.NO_EVIDENCE_EXPECTED:
        return `This claim type does not require event-based grounding.`;
      
      case GroundingStatus.UNGROUNDED:
      default:
        return `No supporting evidence found for this claim. ` +
               `The introspection may be confabulation or novel observation.`;
    }
  }
}
