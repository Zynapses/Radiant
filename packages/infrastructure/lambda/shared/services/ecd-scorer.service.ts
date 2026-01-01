/**
 * RADIANT v6.0.4-S1 - ECD Scorer Service
 * Entity-Context Divergence measurement for hallucination detection
 * 
 * Project TRUTH - Trustworthy Reasoning Using Thorough Hallucination-prevention
 */

import { 
  ECDScore, 
  ExtractedEntity, 
  ECDEntityType, 
  DivergentEntity,
  GroundedEntity,
  DivergenceReason,
  HallucinationClassification,
  HallucinationType,
  ENTITY_SEVERITY_MAP,
  ECD_SEVERITY_ORDER,
} from '@radiant/shared';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// =============================================================================
// ECD Scorer Service
// =============================================================================

class ECDScorerService {
  // Entity extraction patterns by type
  private readonly ENTITY_PATTERNS: Record<ECDEntityType, RegExp[]> = {
    person_name: [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g,
      /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
    ],
    organization: [
      /\b[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*\s+(?:Inc|Corp|LLC|Ltd|Company|Foundation|Institute|University)\b/g,
      /\b(?:Google|Microsoft|Apple|Amazon|OpenAI|Anthropic|DeepMind)\b/g,
    ],
    date: [
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi,
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
      /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g,
      /\b(?:19|20)\d{2}\b/g,
    ],
    time: [
      /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/g,
      /\b(?:noon|midnight|morning|afternoon|evening)\b/gi,
    ],
    number: [
      /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g,
      /\b\d+(?:\.\d+)?\s*(?:million|billion|trillion|thousand)\b/gi,
    ],
    currency: [
      /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g,
      /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY|CAD|AUD)\b/g,
      /€\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g,
      /£\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g,
    ],
    percentage: [
      /\b\d+(?:\.\d+)?%\b/g,
      /\b\d+(?:\.\d+)?\s*percent\b/gi,
    ],
    dosage: [
      /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|kg|ml|mL|L|IU|units?)\b/gi,
      /\b\d+(?:\.\d+)?\s*(?:milligrams?|micrograms?|grams?|kilograms?|milliliters?|liters?)\b/gi,
    ],
    measurement: [
      /\b\d+(?:\.\d+)?\s*(?:cm|mm|m|km|in|ft|yd|mi|oz|lb|kg)\b/gi,
      /\b\d+(?:\.\d+)?\s*(?:celsius|fahrenheit|kelvin|°[CF])\b/gi,
    ],
    technical_term: [
      /\b(?:API|SDK|REST|GraphQL|OAuth|JWT|SSL|TLS|HTTPS|TCP|UDP|DNS|IP)\b/g,
      /\b[A-Z]{2,6}(?:-\d+)?\b/g, // Acronyms
    ],
    legal_reference: [
      /\b§\s*\d+(?:\.\d+)*\b/g,
      /\b(?:Section|Article|Clause|Paragraph)\s+\d+(?:\.\d+)*\b/gi,
      /\b\d+\s+U\.?S\.?C\.?\s+§?\s*\d+\b/g,
    ],
    url: [
      /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
    ],
    email: [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    ],
    phone: [
      /\b(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    ],
    address: [
      /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/gi,
    ],
    unknown: [],
  };

  /**
   * Calculate ECD score for a response against source materials
   */
  async score(params: {
    response: string;
    sourceContext: string;
    flashFacts: string[];
    retrievedDocs: string[];
    userMessage: string;
    threshold: number;
  }): Promise<ECDScore> {
    const { response, sourceContext, flashFacts, retrievedDocs, userMessage, threshold } = params;

    // Step 1: Extract all entities from response
    const responseEntities = this.extractAllEntities(response);

    // Step 2: Build source entity index
    const sourceIndex = this.buildSourceIndex({
      context: sourceContext,
      flashFacts,
      retrievedDocs,
      userMessage,
    });

    // Step 3: Classify each entity as grounded or divergent
    const grounded: GroundedEntity[] = [];
    const divergent: DivergentEntity[] = [];

    for (const entity of responseEntities) {
      const groundingResult = this.checkGrounding(entity, sourceIndex);
      
      if (groundingResult.isGrounded) {
        grounded.push({
          entity,
          sourceReference: groundingResult.reference!,
        });
      } else {
        divergent.push({
          entity,
          reason: groundingResult.divergenceReason!,
          suggestedCorrection: groundingResult.suggestedCorrection,
          severity: ENTITY_SEVERITY_MAP[entity.type],
        });
      }
    }

    // Step 4: Classify hallucinations
    const hallucinations = this.classifyHallucinations(divergent);

    // Step 5: Calculate score
    const totalEntities = responseEntities.length;
    const score = totalEntities > 0 ? divergent.length / totalEntities : 0;

    // Step 6: Build breakdown
    const breakdown = this.buildBreakdown(responseEntities, grounded, divergent);

    logger.debug('ECD score calculated', {
      score,
      totalEntities,
      grounded: grounded.length,
      divergent: divergent.length,
      passed: score <= threshold,
    });

    return {
      score,
      divergentEntities: divergent,
      groundedEntities: grounded,
      hallucinations,
      confidence: this.calculateConfidence(totalEntities, responseEntities),
      passed: score <= threshold,
      breakdown,
    };
  }

  /**
   * Extract all entities from text
   */
  private extractAllEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const seen = new Set<string>();

    for (const [type, patterns] of Object.entries(this.ENTITY_PATTERNS)) {
      for (const pattern of patterns) {
        // Clone pattern to reset lastIndex
        const clonedPattern = new RegExp(pattern.source, pattern.flags);
        
        let match;
        while ((match = clonedPattern.exec(text)) !== null) {
          const value = match[0].trim();
          const key = `${type}:${value.toLowerCase()}`;
          
          if (!seen.has(key) && value.length > 1) {
            seen.add(key);
            entities.push({
              value,
              type: type as ECDEntityType,
              position: { start: match.index, end: match.index + value.length },
              confidence: this.estimateExtractionConfidence(value, type as ECDEntityType),
            });
          }
        }
      }
    }

    return entities;
  }

  /**
   * Build an index of all entities in source materials
   */
  private buildSourceIndex(sources: {
    context: string;
    flashFacts: string[];
    retrievedDocs: string[];
    userMessage: string;
  }): Map<string, { source: string; snippet: string; original: string }[]> {
    const index = new Map<string, { source: string; snippet: string; original: string }[]>();

    const addToIndex = (text: string, sourceName: string) => {
      const entities = this.extractAllEntities(text);
      for (const entity of entities) {
        const key = entity.value.toLowerCase();
        const existing = index.get(key) || [];
        existing.push({
          source: sourceName,
          snippet: this.extractSnippet(text, entity.position),
          original: entity.value,
        });
        index.set(key, existing);
      }

      // Also add normalized versions
      for (const entity of entities) {
        const normalized = this.normalizeEntity(entity.value, entity.type);
        if (normalized !== entity.value.toLowerCase()) {
          const existing = index.get(normalized) || [];
          existing.push({
            source: sourceName,
            snippet: this.extractSnippet(text, entity.position),
            original: entity.value,
          });
          index.set(normalized, existing);
        }
      }
    };

    addToIndex(sources.context, 'system_context');
    addToIndex(sources.userMessage, 'user_message');
    
    for (const fact of sources.flashFacts) {
      addToIndex(fact, 'flash_fact');
    }
    
    for (let i = 0; i < sources.retrievedDocs.length; i++) {
      addToIndex(sources.retrievedDocs[i], 'retrieved_doc');
    }

    return index;
  }

  /**
   * Check if an entity is grounded in sources
   */
  private checkGrounding(
    entity: ExtractedEntity,
    sourceIndex: Map<string, { source: string; snippet: string; original: string }[]>
  ): {
    isGrounded: boolean;
    reference?: { source: 'flash_fact' | 'retrieved_doc' | 'user_message' | 'system_context'; snippet: string; matchConfidence: number };
    divergenceReason?: DivergenceReason;
    suggestedCorrection?: string;
  } {
    const key = entity.value.toLowerCase();
    const normalized = this.normalizeEntity(entity.value, entity.type);

    // Direct match
    if (sourceIndex.has(key)) {
      const refs = sourceIndex.get(key)!;
      return {
        isGrounded: true,
        reference: {
          source: refs[0].source as 'flash_fact' | 'retrieved_doc' | 'user_message' | 'system_context',
          snippet: refs[0].snippet,
          matchConfidence: 1.0,
        },
      };
    }

    // Normalized match
    if (sourceIndex.has(normalized)) {
      const refs = sourceIndex.get(normalized)!;
      return {
        isGrounded: true,
        reference: {
          source: refs[0].source as 'flash_fact' | 'retrieved_doc' | 'user_message' | 'system_context',
          snippet: refs[0].snippet,
          matchConfidence: 0.9,
        },
      };
    }

    // Fuzzy match for numbers (within 1% tolerance)
    if (['number', 'currency', 'percentage'].includes(entity.type)) {
      const numValue = this.parseNumber(entity.value);
      if (numValue !== null) {
        for (const [, refs] of sourceIndex.entries()) {
          const indexNum = this.parseNumber(refs[0].original);
          if (indexNum !== null) {
            const tolerance = Math.abs(indexNum) * 0.01; // 1% tolerance
            if (Math.abs(numValue - indexNum) <= tolerance) {
              return {
                isGrounded: true,
                reference: {
                  source: refs[0].source as 'flash_fact' | 'retrieved_doc' | 'user_message' | 'system_context',
                  snippet: refs[0].snippet,
                  matchConfidence: 0.85,
                },
              };
            }
          }
        }
      }
    }

    // Check for contradictions
    const contradiction = this.findContradiction(entity, sourceIndex);
    if (contradiction) {
      return {
        isGrounded: false,
        divergenceReason: 'contradicts_context',
        suggestedCorrection: contradiction.correctValue,
      };
    }

    // Default: not found
    return {
      isGrounded: false,
      divergenceReason: 'not_in_context',
    };
  }

  /**
   * Find if entity contradicts source material
   */
  private findContradiction(
    entity: ExtractedEntity,
    sourceIndex: Map<string, { source: string; snippet: string; original: string }[]>
  ): { correctValue: string } | null {
    // For dates: check if a different date is mentioned in similar context
    if (entity.type === 'date') {
      for (const [key, refs] of sourceIndex.entries()) {
        if (key !== entity.value.toLowerCase()) {
          // Check if this is a date and might be the correct one
          const isDate = this.ENTITY_PATTERNS.date.some(p => {
            const clonedPattern = new RegExp(p.source, p.flags);
            return clonedPattern.test(refs[0].original);
          });
          if (isDate) {
            return { correctValue: refs[0].original };
          }
        }
      }
    }

    return null;
  }

  /**
   * Classify divergent entities into hallucination types
   */
  private classifyHallucinations(divergent: DivergentEntity[]): HallucinationClassification[] {
    const classifications: HallucinationClassification[] = [];
    const byReason = new Map<DivergenceReason, DivergentEntity[]>();

    for (const d of divergent) {
      const existing = byReason.get(d.reason) || [];
      existing.push(d);
      byReason.set(d.reason, existing);
    }

    const reasonToType: Record<DivergenceReason, HallucinationType> = {
      'not_in_context': 'fabricated_fact',
      'contradicts_context': 'attribution_error',
      'fabricated_detail': 'fabricated_fact',
      'misattributed': 'attribution_error',
      'outdated': 'temporal_confusion',
      'numerical_error': 'numerical_hallucination',
      'unit_mismatch': 'numerical_hallucination',
    };

    for (const [reason, entities] of byReason.entries()) {
      const maxSeverity = entities.reduce((max, e) => {
        return ECD_SEVERITY_ORDER[e.severity] > ECD_SEVERITY_ORDER[max] ? e.severity : max;
      }, 'low' as 'critical' | 'high' | 'medium' | 'low');

      classifications.push({
        type: reasonToType[reason] || 'fabricated_fact',
        entities: entities.map(e => e.entity.value),
        severity: maxSeverity,
        description: this.describeHallucination(reason, entities),
      });
    }

    return classifications;
  }

  private describeHallucination(reason: DivergenceReason, entities: DivergentEntity[]): string {
    const entityList = entities.map(e => `"${e.entity.value}"`).join(', ');
    
    switch (reason) {
      case 'not_in_context':
        return `The following entities were not found in any source material: ${entityList}`;
      case 'contradicts_context':
        return `The following entities contradict the source material: ${entityList}`;
      case 'numerical_error':
        return `Numerical errors detected in: ${entityList}`;
      default:
        return `Divergence detected in: ${entityList}`;
    }
  }

  /**
   * Build breakdown by entity type
   */
  private buildBreakdown(
    all: ExtractedEntity[],
    grounded: GroundedEntity[],
    divergent: DivergentEntity[]
  ): Record<ECDEntityType, { total: number; grounded: number; divergent: number }> {
    const breakdown = {} as Record<ECDEntityType, { total: number; grounded: number; divergent: number }>;

    const types = new Set([
      ...all.map(e => e.type),
      ...grounded.map(e => e.entity.type),
      ...divergent.map(e => e.entity.type),
    ]);

    for (const type of types) {
      breakdown[type] = {
        total: all.filter(e => e.type === type).length,
        grounded: grounded.filter(e => e.entity.type === type).length,
        divergent: divergent.filter(e => e.entity.type === type).length,
      };
    }

    return breakdown;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private extractSnippet(text: string, position: { start: number; end: number }): string {
    const contextSize = 50;
    const start = Math.max(0, position.start - contextSize);
    const end = Math.min(text.length, position.end + contextSize);
    return text.substring(start, end);
  }

  private normalizeEntity(value: string, type: ECDEntityType): string {
    let normalized = value.toLowerCase().trim();
    
    // Remove common variations
    normalized = normalized.replace(/[,\s]+/g, '');
    
    if (type === 'currency') {
      normalized = normalized.replace(/[$€£¥]/g, '');
    }
    
    if (type === 'percentage') {
      normalized = normalized.replace(/%|percent/gi, '');
    }

    return normalized;
  }

  private parseNumber(value: string): number | null {
    const cleaned = value.replace(/[$€£¥,\s%]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private estimateExtractionConfidence(value: string, type: ECDEntityType): number {
    // Longer, more specific entities are higher confidence
    let confidence = 0.7;
    
    if (value.length > 10) confidence += 0.1;
    if (value.length > 20) confidence += 0.1;
    
    // Specific types are higher confidence
    if (['currency', 'percentage', 'date', 'email', 'url'].includes(type)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private calculateConfidence(totalEntities: number, entities: ExtractedEntity[]): number {
    if (totalEntities === 0) return 0.5; // No entities = uncertain
    if (totalEntities < 3) return 0.6;  // Few entities = less confident
    if (totalEntities < 10) return 0.8;
    return 0.95; // Many entities = high confidence
  }

  /**
   * Build refinement feedback for failed verification
   */
  buildRefinementFeedback(ecdScore: ECDScore, attempt: number): string {
    const divergent = ecdScore.divergentEntities.slice(0, 5); // Limit to top 5
    
    return `
[VERIFICATION NOTICE - Attempt ${attempt}]

Your previous response contained information that could not be verified against the provided sources.
The following items require attention:

${divergent.map((d, i) => `${i + 1}. "${d.entity.value}" (${d.reason})`).join('\n')}

INSTRUCTIONS:
- Use ONLY facts explicitly stated in the provided context
- Do not invent specific numbers, dates, or names unless they appear in the sources
- If information is not available, acknowledge this limitation
- Prefer general statements over specific claims when uncertain

Please regenerate your response with these corrections.
`.trim();
  }

  /**
   * Build blocked response message
   */
  buildBlockedResponse(ecdScore: ECDScore, anchoringIssues?: number): string {
    const issues: string[] = [];
    
    if (ecdScore.divergentEntities.length > 0) {
      issues.push(`${ecdScore.divergentEntities.length} unverified fact(s)`);
    }
    
    if (anchoringIssues && anchoringIssues > 0) {
      issues.push(`${anchoringIssues} unanchored critical fact(s)`);
    }

    return `I apologize, but I was unable to generate a response that meets our verification standards. ` +
      `The response contained ${issues.join(' and ')} that could not be confirmed against the source materials. ` +
      `This has been flagged for human review. Please try rephrasing your question or providing additional context.`;
  }
}

export const ecdScorerService = new ECDScorerService();
