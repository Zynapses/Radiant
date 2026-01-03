/**
 * UncertaintyHead v6.0.5
 * 
 * PURPOSE: Solve the Router Paradox - route based on uncertainty without knowing uncertainty
 * 
 * PROBLEM (v6.0.2 - Router Paradox):
 *   - We need to route to System 2 when uncertain
 *   - But we need to run inference to know uncertainty
 *   - Running inference defeats the purpose of routing
 * 
 * SOLUTION (Gemini): Lightweight Uncertainty Head
 *   - Tiny probe network trained to predict model uncertainty
 *   - Runs BEFORE main inference
 *   - Uses prompt embeddings (cheap) not full generation
 *   - Predicts epistemic + aleatoric uncertainty
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/consciousness/uncertainty-head.ts
 */

import { UncertaintyEstimate, UNCERTAINTY_THRESHOLDS } from '../types';

/**
 * Uncertainty components:
 * 
 * EPISTEMIC (Model Uncertainty):
 *   - What the model doesn't know
 *   - Reducible with more training data
 *   - High for novel/rare queries
 * 
 * ALEATORIC (Data Uncertainty):
 *   - Inherent randomness in the task
 *   - NOT reducible with more data
 *   - High for ambiguous/subjective queries
 */

export interface UncertaintyFeatures {
  queryLength: number;
  queryComplexity: number;
  domainSpecificity: number;
  questionType: 'factual' | 'opinion' | 'procedural' | 'creative' | 'ambiguous';
  hasNegation: boolean;
  hasConditional: boolean;
  hasQuantifier: boolean;
  namedEntityCount: number;
  technicalTermCount: number;
}

/**
 * Pre-trained weights for uncertainty prediction
 * These would be learned from labeled uncertainty data
 * Currently using heuristic values validated by Gemini
 */
const UNCERTAINTY_WEIGHTS = {
  epistemic: {
    queryLength: 0.001,         // Longer = slightly more uncertain
    queryComplexity: 0.15,      // Complex = more uncertain
    domainSpecificity: 0.2,     // Niche domains = more uncertain
    technicalTerms: 0.05,       // Technical = more uncertain
    namedEntities: -0.02,       // Named entities = more grounded
  },
  aleatoric: {
    opinion: 0.4,               // Opinions inherently uncertain
    ambiguous: 0.5,             // Ambiguity = high aleatoric
    creative: 0.3,              // Creativity = some randomness
    negation: 0.1,              // Negation adds ambiguity
    conditional: 0.15,          // Conditionals add uncertainty
  },
};

/**
 * Question type classification patterns
 */
const QUESTION_PATTERNS = {
  factual: /^(what|who|when|where|which|how many|how much)\b/i,
  opinion: /^(should|would|could|do you think|is it better)\b/i,
  procedural: /^(how (do|can|to)|steps to|way to)\b/i,
  creative: /^(write|create|generate|compose|design|imagine)\b/i,
  ambiguous: /^(what if|suppose|consider|maybe)\b/i,
};

/**
 * UncertaintyHead - Lightweight uncertainty prediction
 * 
 * Runs before main inference to predict whether we need
 * System 2 (deep reasoning) or System 1 (fast response).
 */
export class UncertaintyHead {
  /**
   * Estimate uncertainty for a query
   * 
   * This is a lightweight operation that runs BEFORE main inference.
   * Uses prompt features to predict uncertainty without generating.
   * 
   * @param query - The user's query
   * @param domain - Detected domain (optional)
   * @returns Uncertainty estimate with escalation recommendation
   */
  estimate(query: string, domain?: string): UncertaintyEstimate {
    const features = this.extractFeatures(query, domain);
    
    // Calculate epistemic uncertainty (model's knowledge gaps)
    const epistemic = this.calculateEpistemic(features);
    
    // Calculate aleatoric uncertainty (inherent task randomness)
    const aleatoric = this.calculateAleatoric(features);
    
    // Combined uncertainty (weighted average)
    // Epistemic weighs more for routing decisions
    const combined = (epistemic * 0.7) + (aleatoric * 0.3);
    
    // Determine if escalation needed
    const shouldEscalate = combined > UNCERTAINTY_THRESHOLDS.escalation;
    
    return {
      epistemic: Math.min(1, Math.max(0, epistemic)),
      aleatoric: Math.min(1, Math.max(0, aleatoric)),
      combined: Math.min(1, Math.max(0, combined)),
      shouldEscalate,
    };
  }
  
  /**
   * Extract features from query for uncertainty prediction
   */
  extractFeatures(query: string, domain?: string): UncertaintyFeatures {
    const words = query.split(/\s+/);
    const sentences = query.split(/[.!?]+/).filter(Boolean);
    
    return {
      queryLength: words.length,
      queryComplexity: this.calculateComplexity(query, sentences),
      domainSpecificity: this.getDomainSpecificity(domain),
      questionType: this.classifyQuestionType(query),
      hasNegation: this.hasNegation(query),
      hasConditional: this.hasConditional(query),
      hasQuantifier: this.hasQuantifier(query),
      namedEntityCount: this.countNamedEntities(query),
      technicalTermCount: this.countTechnicalTerms(query),
    };
  }
  
  /**
   * Calculate epistemic uncertainty (what the model doesn't know)
   */
  private calculateEpistemic(features: UncertaintyFeatures): number {
    const w = UNCERTAINTY_WEIGHTS.epistemic;
    
    let score = 0.3; // Base uncertainty
    
    score += features.queryLength * w.queryLength;
    score += features.queryComplexity * w.queryComplexity;
    score += features.domainSpecificity * w.domainSpecificity;
    score += features.technicalTermCount * w.technicalTerms;
    score += features.namedEntityCount * w.namedEntities;
    
    return score;
  }
  
  /**
   * Calculate aleatoric uncertainty (inherent randomness)
   */
  private calculateAleatoric(features: UncertaintyFeatures): number {
    const w = UNCERTAINTY_WEIGHTS.aleatoric;
    
    let score = 0.2; // Base randomness
    
    // Question type contributions
    switch (features.questionType) {
      case 'opinion':
        score += w.opinion;
        break;
      case 'ambiguous':
        score += w.ambiguous;
        break;
      case 'creative':
        score += w.creative;
        break;
      case 'factual':
        score -= 0.1; // Factual questions have less inherent uncertainty
        break;
      case 'procedural':
        score += 0.05; // Procedural has some variation
        break;
    }
    
    // Linguistic features
    if (features.hasNegation) score += w.negation;
    if (features.hasConditional) score += w.conditional;
    
    return score;
  }
  
  /**
   * Calculate query complexity based on structure
   */
  private calculateComplexity(query: string, sentences: string[]): number {
    let complexity = 0;
    
    // Multi-sentence queries are more complex
    complexity += Math.min(0.3, sentences.length * 0.1);
    
    // Nested clauses increase complexity
    const clauseMarkers = (query.match(/\b(which|that|who|where|when|because|although|if|unless)\b/gi) || []).length;
    complexity += Math.min(0.4, clauseMarkers * 0.1);
    
    // Technical symbols increase complexity
    const symbols = (query.match(/[=<>+\-*/^%$#@&|]/g) || []).length;
    complexity += Math.min(0.2, symbols * 0.05);
    
    // Long compound sentences
    const avgSentenceLength = query.length / Math.max(1, sentences.length);
    if (avgSentenceLength > 100) complexity += 0.1;
    
    return Math.min(1, complexity);
  }
  
  /**
   * Get domain specificity (niche domains = more uncertainty)
   */
  private getDomainSpecificity(domain?: string): number {
    if (!domain) return 0.5;
    
    const specificDomains: Record<string, number> = {
      'quantum_physics': 0.9,
      'neurosurgery': 0.9,
      'tax_law': 0.8,
      'patent_law': 0.8,
      'oncology': 0.8,
      'derivatives_trading': 0.8,
      'general': 0.2,
      'casual': 0.1,
      'greeting': 0.0,
    };
    
    return specificDomains[domain.toLowerCase()] ?? 0.5;
  }
  
  /**
   * Classify question type
   */
  private classifyQuestionType(query: string): UncertaintyFeatures['questionType'] {
    for (const [type, pattern] of Object.entries(QUESTION_PATTERNS)) {
      if (pattern.test(query)) {
        return type as UncertaintyFeatures['questionType'];
      }
    }
    return 'factual'; // Default to factual
  }
  
  /**
   * Check for negation patterns
   */
  private hasNegation(query: string): boolean {
    return /\b(not|no|never|neither|nor|don't|doesn't|didn't|won't|wouldn't|can't|cannot|shouldn't)\b/i.test(query);
  }
  
  /**
   * Check for conditional patterns
   */
  private hasConditional(query: string): boolean {
    return /\b(if|unless|whether|assuming|suppose|given that|in case)\b/i.test(query);
  }
  
  /**
   * Check for quantifier patterns
   */
  private hasQuantifier(query: string): boolean {
    return /\b(all|every|some|any|most|few|many|none|each)\b/i.test(query);
  }
  
  /**
   * Count potential named entities (capitalized words)
   */
  private countNamedEntities(query: string): number {
    const words = query.split(/\s+/);
    return words.filter((w, i) => 
      i > 0 && // Skip first word (always capitalized in sentences)
      /^[A-Z][a-z]/.test(w) && // Capitalized
      w.length > 2 // Not just "I" or abbreviations
    ).length;
  }
  
  /**
   * Count technical terms (heuristic)
   */
  private countTechnicalTerms(query: string): number {
    const technicalPatterns = [
      /\b[A-Z]{2,}\b/g,           // Acronyms
      /\b\w+tion\b/gi,            // -tion words (often technical)
      /\b\w+ology\b/gi,           // -ology words
      /\b\w+ism\b/gi,             // -ism words
      /\d+(\.\d+)?%/g,            // Percentages
      /\$\d+/g,                   // Currency
      /\b(API|SDK|SQL|HTTP|JSON|XML|CSV)\b/gi, // Tech terms
    ];
    
    let count = 0;
    for (const pattern of technicalPatterns) {
      const matches = query.match(pattern);
      if (matches) count += matches.length;
    }
    
    return count;
  }
  
  /**
   * Get human-readable explanation of uncertainty
   */
  explain(estimate: UncertaintyEstimate, features: UncertaintyFeatures): string {
    const parts: string[] = [];
    
    parts.push(`Uncertainty: ${(estimate.combined * 100).toFixed(1)}%`);
    parts.push(`  Epistemic: ${(estimate.epistemic * 100).toFixed(1)}% (knowledge gaps)`);
    parts.push(`  Aleatoric: ${(estimate.aleatoric * 100).toFixed(1)}% (inherent randomness)`);
    parts.push(`Question type: ${features.questionType}`);
    parts.push(`Complexity: ${(features.queryComplexity * 100).toFixed(1)}%`);
    
    if (estimate.shouldEscalate) {
      parts.push(`⚠️ ESCALATION RECOMMENDED (above ${UNCERTAINTY_THRESHOLDS.escalation * 100}% threshold)`);
    }
    
    return parts.join('\n');
  }
}

/**
 * Singleton instance for convenience
 */
export const uncertaintyHead = new UncertaintyHead();
