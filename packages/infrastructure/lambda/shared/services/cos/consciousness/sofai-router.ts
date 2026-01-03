/**
 * SofaiRouter v6.0.5
 * 
 * PURPOSE: Economic metacognition - route System 1 (fast) vs System 2 (deep)
 * 
 * FORMULA: shouldUseSystem2 = (1 - trust) * domainRisk > threshold
 * 
 * System 1 (Fast):
 *   - 8B model (Llama 3 8B, Haiku)
 *   - 300ms latency
 *   - Low cost
 *   - Good for routine queries
 * 
 * System 2 (Deep):
 *   - 70B+ model (Claude Opus, GPT-4)
 *   - 1500ms latency
 *   - Higher cost
 *   - Required for high-risk domains
 * 
 * CRITICAL: Healthcare/Financial/Legal = ALWAYS System 2
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/consciousness/sofai-router.ts
 */

import { 
  SOFAIRoutingContext, 
  SOFAIRoutingResult, 
  SOFAIDecision, 
  HIGH_RISK_DOMAINS,
  HighRiskDomain,
  UNCERTAINTY_THRESHOLDS,
} from '../types';

export interface System1Model {
  id: string;
  name: string;
  latencyMs: number;
  costPer1kTokens: number;
}

export interface System2Model {
  id: string;
  name: string;
  latencyMs: number;
  costPer1kTokens: number;
}

/**
 * Default model configurations
 */
export const DEFAULT_MODELS = {
  system1: {
    id: 'llama-3-8b',
    name: 'Llama 3 8B',
    latencyMs: 300,
    costPer1kTokens: 0.0001,
  } as System1Model,
  system2: {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    latencyMs: 1500,
    costPer1kTokens: 0.015,
  } as System2Model,
};

/**
 * Domain risk levels (0-1 scale)
 */
export const DOMAIN_RISKS: Record<string, number> = {
  healthcare: 1.0,
  medical: 1.0,
  financial: 1.0,
  legal: 1.0,
  insurance: 0.9,
  tax: 0.9,
  investment: 0.9,
  education: 0.5,
  science: 0.5,
  technology: 0.4,
  coding: 0.4,
  creative: 0.2,
  general: 0.3,
  casual: 0.1,
};

/**
 * SofaiRouter - System 1/2 Routing Decision Engine
 * 
 * Based on Kahneman's dual-process theory:
 * - System 1: Fast, intuitive, automatic
 * - System 2: Slow, deliberate, analytical
 * 
 * The router decides which "thinking mode" to use based on:
 * 1. Domain risk (healthcare = always System 2)
 * 2. Trust level (new users = more System 2)
 * 3. Uncertainty estimate (confused = System 2)
 * 4. Cost constraints (budget aware)
 */
export class SofaiRouter {
  private readonly COST_THRESHOLD = 0.3;
  private system1Model: System1Model;
  private system2Model: System2Model;
  
  constructor(
    system1Model: System1Model = DEFAULT_MODELS.system1,
    system2Model: System2Model = DEFAULT_MODELS.system2
  ) {
    this.system1Model = system1Model;
    this.system2Model = system2Model;
  }
  
  /**
   * Route query to appropriate system
   * 
   * @param context - Routing context with all factors
   * @returns Routing decision with reasoning
   */
  route(context: SOFAIRoutingContext): SOFAIRoutingResult {
    // MANDATORY: High-risk domains always use System 2
    if (this.isHighRiskDomain(context.domain)) {
      return {
        decision: 'SYSTEM_2',
        confidence: 1.0,
        reasoning: `Domain '${context.domain}' requires System 2 (high-risk mandate)`,
        estimatedLatency: this.system2Model.latencyMs,
        estimatedCost: context.system2Cost,
      };
    }
    
    // Calculate routing score
    // Higher score = more reason to use System 2
    const riskScore = (1 - context.trustLevel) * context.domainRisk;
    const uncertaintyBonus = context.uncertaintyEstimate > UNCERTAINTY_THRESHOLDS.system2Routing ? 0.2 : 0;
    const totalScore = riskScore + uncertaintyBonus;
    
    // Budget check - if we can't afford System 2, use System 1
    if (context.budgetRemaining < context.system2Cost) {
      return {
        decision: 'SYSTEM_1',
        confidence: 0.6,
        reasoning: `Budget constraint: ${context.budgetRemaining} < ${context.system2Cost} required for System 2`,
        estimatedLatency: this.system1Model.latencyMs,
        estimatedCost: context.system1Cost,
      };
    }
    
    // Make routing decision
    const useSystem2 = totalScore > this.COST_THRESHOLD || 
                       context.uncertaintyEstimate > UNCERTAINTY_THRESHOLDS.escalation;
    
    // Calculate confidence (how sure we are about the decision)
    const confidence = Math.min(1, Math.abs(totalScore - this.COST_THRESHOLD) + 0.5);
    
    return {
      decision: useSystem2 ? 'SYSTEM_2' : 'SYSTEM_1',
      confidence,
      reasoning: this.buildReasoning(context, totalScore, useSystem2),
      estimatedLatency: useSystem2 ? this.system2Model.latencyMs : this.system1Model.latencyMs,
      estimatedCost: useSystem2 ? context.system2Cost : context.system1Cost,
    };
  }
  
  /**
   * Quick check for high-risk domain
   */
  isHighRiskDomain(domain: string): boolean {
    const normalized = domain.toLowerCase();
    return HIGH_RISK_DOMAINS.includes(normalized as HighRiskDomain) ||
           normalized.includes('health') ||
           normalized.includes('medical') ||
           normalized.includes('financial') ||
           normalized.includes('legal');
  }
  
  /**
   * Get risk level for a domain
   */
  getDomainRisk(domain: string): number {
    const normalized = domain.toLowerCase();
    
    // Check exact match
    if (DOMAIN_RISKS[normalized] !== undefined) {
      return DOMAIN_RISKS[normalized];
    }
    
    // Check partial matches
    for (const [key, risk] of Object.entries(DOMAIN_RISKS)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return risk;
      }
    }
    
    // Default to moderate risk
    return 0.5;
  }
  
  /**
   * Batch routing for multiple queries (optimization)
   */
  routeBatch(contexts: SOFAIRoutingContext[]): SOFAIRoutingResult[] {
    return contexts.map(ctx => this.route(ctx));
  }
  
  /**
   * Get routing statistics for monitoring
   */
  getRoutingStats(decisions: SOFAIRoutingResult[]): {
    system1Count: number;
    system2Count: number;
    system1Percent: number;
    avgConfidence: number;
    totalEstimatedCost: number;
  } {
    const system1Count = decisions.filter(d => d.decision === 'SYSTEM_1').length;
    const system2Count = decisions.filter(d => d.decision === 'SYSTEM_2').length;
    const total = decisions.length || 1;
    
    return {
      system1Count,
      system2Count,
      system1Percent: (system1Count / total) * 100,
      avgConfidence: decisions.reduce((sum, d) => sum + d.confidence, 0) / total,
      totalEstimatedCost: decisions.reduce((sum, d) => sum + d.estimatedCost, 0),
    };
  }
  
  /**
   * Build human-readable reasoning string
   */
  private buildReasoning(
    context: SOFAIRoutingContext, 
    score: number, 
    useSystem2: boolean
  ): string {
    const parts: string[] = [];
    
    parts.push(`Score: ${score.toFixed(3)} (threshold: ${this.COST_THRESHOLD})`);
    parts.push(`Trust: ${context.trustLevel.toFixed(2)}`);
    parts.push(`Domain risk: ${context.domainRisk.toFixed(2)}`);
    
    if (context.uncertaintyEstimate > UNCERTAINTY_THRESHOLDS.system2Routing) {
      parts.push(`High uncertainty: ${context.uncertaintyEstimate.toFixed(2)}`);
    }
    
    parts.push(`Decision: ${useSystem2 ? 'System 2 (deep)' : 'System 1 (fast)'}`);
    
    return parts.join(' | ');
  }
  
  /**
   * Update model configurations
   */
  setModels(system1?: System1Model, system2?: System2Model): void {
    if (system1) this.system1Model = system1;
    if (system2) this.system2Model = system2;
  }
  
  /**
   * Create routing context from request
   */
  static createContext(params: {
    query: string;
    domain: string;
    userId: string;
    interactionCount: number;
    budgetRemaining: number;
  }): SOFAIRoutingContext {
    const router = new SofaiRouter();
    
    // Calculate trust based on interaction history
    const trustLevel = Math.min(1, params.interactionCount / 20);
    
    // Default uncertainty (can be overridden by UncertaintyHead)
    const uncertaintyEstimate = 0.5;
    
    return {
      query: params.query,
      domain: params.domain,
      domainRisk: router.getDomainRisk(params.domain),
      uncertaintyEstimate,
      trustLevel,
      system1Cost: DEFAULT_MODELS.system1.costPer1kTokens * 2, // ~2k tokens
      system2Cost: DEFAULT_MODELS.system2.costPer1kTokens * 2,
      budgetRemaining: params.budgetRemaining,
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const sofaiRouter = new SofaiRouter();
