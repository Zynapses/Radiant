/**
 * RADIANT v6.0.4 - SOFAI Router Service
 * Economic metacognition for System 1/2 routing
 * 
 * SOFAI (System Of Fast And Intuitive) routes requests based on:
 * - Trust score (1 - entropy)
 * - Domain risk
 * - Compute cost considerations
 */

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { brainConfigService } from './brain-config.service';
import {
  type SystemLevel,
  type SofaiRoutingDecision,
  type PredictiveUncertaintyOutput,
} from '@radiant/shared';
import { estimateTokens } from '@radiant/shared';

// =============================================================================
// SOFAI Router Service
// =============================================================================

class SofaiRouterService {
  // ===========================================================================
  // Main Routing
  // ===========================================================================

  /**
   * Route request to appropriate system level
   */
  async route(params: {
    prompt: string;
    userId: string;
    tenantId: string;
    domain?: string;
    uncertainty?: PredictiveUncertaintyOutput;
    forceLevel?: SystemLevel;
  }): Promise<SofaiRoutingDecision> {
    const startTime = Date.now();

    // If forced, use that level
    if (params.forceLevel) {
      return this.createDecision(
        params.forceLevel,
        1.0,
        params.domain || 'general',
        params.prompt,
        'Forced by request',
        startTime
      );
    }

    // Get configuration
    const [system2Threshold, enableSystem1_5] = await Promise.all([
      brainConfigService.getNumber('SOFAI_SYSTEM2_THRESHOLD', 0.5),
      brainConfigService.getBoolean('SOFAI_ENABLE_SYSTEM1_5', true),
    ]);

    // Calculate trust and risk
    const trust = params.uncertainty 
      ? 1 - params.uncertainty.predictedEntropy 
      : await this.estimateTrustFromPrompt(params.prompt);
    
    const domain = params.domain || this.detectDomain(params.prompt);
    const domainRisk = await this.getDomainRisk(domain);
    const computeCost = this.calculateComputeCost(params.prompt);

    // SOFAI Formula: Route to System 2 if (1-trust) * domainRisk > threshold
    const routingScore = (1 - trust) * domainRisk;
    const shouldUseSystem2 = routingScore > system2Threshold;

    let level: SystemLevel;
    let reasoning: string;

    if (shouldUseSystem2) {
      level = 'system2';
      reasoning = `High routing score (${routingScore.toFixed(2)}) exceeds threshold (${system2Threshold}). Domain: ${domain}, Risk: ${domainRisk.toFixed(2)}`;
    } else if (enableSystem1_5 && routingScore > system2Threshold * 0.5) {
      level = 'system1.5';
      reasoning = `Moderate routing score (${routingScore.toFixed(2)}). Using intermediate reasoning. Domain: ${domain}`;
    } else {
      level = 'system1';
      reasoning = `Low routing score (${routingScore.toFixed(2)}). Fast response appropriate. Domain: ${domain}`;
    }

    const decision = this.createDecision(
      level,
      trust,
      domain,
      params.prompt,
      reasoning,
      startTime,
      domainRisk,
      computeCost
    );

    // Log routing decision
    await this.logRoutingDecision(params.userId, params.tenantId, decision);

    return decision;
  }

  /**
   * Create routing decision object
   */
  private createDecision(
    level: SystemLevel,
    trust: number,
    domain: string,
    prompt: string,
    reasoning: string,
    startTime: number,
    domainRisk?: number,
    computeCost?: number
  ): SofaiRoutingDecision {
    return {
      level,
      confidence: trust,
      reasoning,
      trust,
      domainRisk: domainRisk ?? 0.3,
      computeCost: computeCost ?? this.calculateComputeCost(prompt),
      timestamp: new Date(),
    };
  }

  // ===========================================================================
  // Domain Risk
  // ===========================================================================

  /**
   * Get domain risk score from configuration
   */
  async getDomainRisk(domain: string): Promise<number> {
    const lowerDomain = domain.toLowerCase();

    switch (lowerDomain) {
      case 'healthcare':
      case 'medical':
      case 'health':
        return brainConfigService.getNumber('SOFAI_HEALTHCARE_RISK', 0.9);
      
      case 'financial':
      case 'finance':
      case 'banking':
      case 'investment':
        return brainConfigService.getNumber('SOFAI_FINANCIAL_RISK', 0.85);
      
      case 'legal':
      case 'law':
      case 'compliance':
        return brainConfigService.getNumber('SOFAI_LEGAL_RISK', 0.8);
      
      case 'education':
        return 0.4;
      
      case 'creative':
      case 'entertainment':
        return 0.2;
      
      default:
        return 0.3;
    }
  }

  /**
   * Detect domain from prompt content
   */
  detectDomain(prompt: string): string {
    const lower = prompt.toLowerCase();

    // Healthcare indicators
    if (this.containsAny(lower, [
      'doctor', 'medical', 'health', 'symptom', 'diagnosis', 'treatment',
      'medication', 'prescription', 'hospital', 'patient', 'disease',
      'allergy', 'surgery', 'therapy', 'clinical', 'pharmaceutical'
    ])) {
      return 'healthcare';
    }

    // Financial indicators
    if (this.containsAny(lower, [
      'invest', 'stock', 'bond', 'portfolio', 'finance', 'bank',
      'loan', 'mortgage', 'credit', 'tax', 'retirement', 'insurance',
      'trading', 'dividend', 'asset', 'liability'
    ])) {
      return 'financial';
    }

    // Legal indicators
    if (this.containsAny(lower, [
      'legal', 'law', 'court', 'attorney', 'lawyer', 'contract',
      'liability', 'sue', 'lawsuit', 'regulation', 'compliance',
      'statute', 'jurisdiction', 'verdict', 'testimony'
    ])) {
      return 'legal';
    }

    // Education indicators
    if (this.containsAny(lower, [
      'learn', 'study', 'course', 'class', 'student', 'teacher',
      'education', 'school', 'university', 'academic', 'curriculum'
    ])) {
      return 'education';
    }

    // Creative indicators
    if (this.containsAny(lower, [
      'story', 'poem', 'creative', 'fiction', 'art', 'music',
      'design', 'imagine', 'fantasy', 'novel', 'write a'
    ])) {
      return 'creative';
    }

    return 'general';
  }

  /**
   * Helper: check if text contains any of the keywords
   */
  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  // ===========================================================================
  // Trust Estimation
  // ===========================================================================

  /**
   * Estimate trust from prompt (heuristic fallback when no uncertainty head)
   */
  private async estimateTrustFromPrompt(prompt: string): Promise<number> {
    let trust = 0.7; // Base trust

    // Lower trust for questions
    if (prompt.includes('?')) {
      trust -= 0.1;
    }

    // Lower trust for complex prompts
    const tokenCount = estimateTokens(prompt);
    if (tokenCount > 200) trust -= 0.1;
    if (tokenCount > 500) trust -= 0.1;

    // Lower trust for uncertainty language
    const uncertaintyPatterns = [
      'not sure', 'uncertain', 'maybe', 'might', 'could be',
      'i think', 'possibly', 'perhaps', 'i guess'
    ];
    const lower = prompt.toLowerCase();
    if (uncertaintyPatterns.some(p => lower.includes(p))) {
      trust -= 0.15;
    }

    // Higher trust for simple commands
    const simplePatterns = [
      'tell me', 'what is', 'how do', 'explain', 'define',
      'list', 'show me', 'give me'
    ];
    if (simplePatterns.some(p => lower.includes(p))) {
      trust += 0.1;
    }

    return Math.max(0.1, Math.min(0.95, trust));
  }

  // ===========================================================================
  // Compute Cost
  // ===========================================================================

  /**
   * Calculate estimated compute cost
   */
  calculateComputeCost(prompt: string): number {
    const tokenCount = estimateTokens(prompt);
    
    // Base cost per token (arbitrary units)
    const baseCost = tokenCount * 0.001;
    
    // Adjust for complexity indicators
    let multiplier = 1.0;
    
    const lower = prompt.toLowerCase();
    
    // Code generation is expensive
    if (lower.includes('code') || lower.includes('program') || lower.includes('function')) {
      multiplier *= 1.5;
    }
    
    // Math/reasoning is expensive
    if (lower.includes('calculate') || lower.includes('solve') || lower.includes('prove')) {
      multiplier *= 1.3;
    }
    
    // Creative tasks can be expensive
    if (lower.includes('write') || lower.includes('story') || lower.includes('creative')) {
      multiplier *= 1.2;
    }

    return baseCost * multiplier;
  }

  // ===========================================================================
  // Logging
  // ===========================================================================

  /**
   * Log routing decision to database
   */
  private async logRoutingDecision(
    userId: string,
    tenantId: string,
    decision: SofaiRoutingDecision
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO sofai_routing_log 
         (user_id, tenant_id, level, trust_score, domain_risk, compute_cost, reasoning, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'level', value: { stringValue: decision.level } },
          { name: 'trustScore', value: { doubleValue: decision.trust } },
          { name: 'domainRisk', value: { doubleValue: decision.domainRisk } },
          { name: 'computeCost', value: { doubleValue: decision.computeCost } },
          { name: 'reasoning', value: { stringValue: decision.reasoning } },
          { name: 'latencyMs', value: { longValue: Date.now() - decision.timestamp.getTime() } },
        ]
      );
    } catch (error) {
      // Don't fail routing for logging errors
      logger.warn(`Failed to log routing decision: ${String(error)}`);
    }
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get routing statistics
   */
  async getStats(tenantId: string, days: number = 7): Promise<{
    total: number;
    byLevel: Record<SystemLevel, number>;
    avgTrust: number;
    avgDomainRisk: number;
    avgLatencyMs: number;
  }> {
    try {
      const result = await executeStatement(
        `SELECT 
           level,
           COUNT(*) as count,
           AVG(trust_score) as avg_trust,
           AVG(domain_risk) as avg_risk,
           AVG(latency_ms) as avg_latency
         FROM sofai_routing_log
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
         GROUP BY level`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );

      const byLevel: Record<SystemLevel, number> = {
        system1: 0,
        'system1.5': 0,
        system2: 0,
      };

      let total = 0;
      let totalTrust = 0;
      let totalRisk = 0;
      let totalLatency = 0;

      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        const level = r.level as SystemLevel;
        const count = Number(r.count);
        byLevel[level] = count;
        total += count;
        totalTrust += Number(r.avg_trust) * count;
        totalRisk += Number(r.avg_risk) * count;
        totalLatency += Number(r.avg_latency) * count;
      }

      return {
        total,
        byLevel,
        avgTrust: total > 0 ? totalTrust / total : 0,
        avgDomainRisk: total > 0 ? totalRisk / total : 0,
        avgLatencyMs: total > 0 ? totalLatency / total : 0,
      };
    } catch (error) {
      logger.error(`Failed to get routing stats: ${String(error)}`);
      return {
        total: 0,
        byLevel: { system1: 0, 'system1.5': 0, system2: 0 },
        avgTrust: 0,
        avgDomainRisk: 0,
        avgLatencyMs: 0,
      };
    }
  }
}

// Export singleton instance
export const sofaiRouterService = new SofaiRouterService();

// Export class for testing
export { SofaiRouterService };
