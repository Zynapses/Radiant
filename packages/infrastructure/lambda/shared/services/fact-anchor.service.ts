/**
 * RADIANT v6.0.4-S1 - Critical Fact Anchor Service
 * Enforces strict grounding for high-risk domain facts
 * 
 * Project TRUTH - Trustworthy Reasoning Using Thorough Hallucination-prevention
 */

import { 
  AnchoringResult, 
  UnanchoredFact, 
  ECDEntityType,
  HighRiskDomain,
} from '@radiant/shared';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// =============================================================================
// Types
// =============================================================================

interface CriticalPattern {
  pattern: RegExp;
  type: ECDEntityType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  risk: string;
}

// =============================================================================
// Critical Fact Anchor Service
// =============================================================================

class CriticalFactAnchorService {
  // Domain-specific critical patterns
  private readonly CRITICAL_PATTERNS: Record<HighRiskDomain, CriticalPattern[]> = {
    healthcare: [
      {
        pattern: /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|mL|units?|IU)\b/gi,
        type: 'dosage',
        severity: 'critical',
        risk: 'Incorrect dosage could cause patient harm',
      },
      {
        pattern: /\b(?:once|twice|three times|four times)\s+(?:daily|a day|per day|weekly|hourly)\b/gi,
        type: 'dosage',
        severity: 'critical',
        risk: 'Incorrect frequency could cause overdose or underdose',
      },
      {
        pattern: /\b(?:diagnosis|diagnosed with|prognosis|treatment for)\s+[A-Za-z\s]+\b/gi,
        type: 'technical_term',
        severity: 'high',
        risk: 'Incorrect diagnosis/treatment information',
      },
      {
        pattern: /\b(?:contraindicated|allergic to|interaction with)\b/gi,
        type: 'technical_term',
        severity: 'critical',
        risk: 'Missing contraindication could cause adverse reaction',
      },
      {
        pattern: /\bblood (?:pressure|sugar|glucose)\s*(?:of\s*)?\d+(?:\/\d+)?/gi,
        type: 'measurement',
        severity: 'high',
        risk: 'Incorrect vital signs could affect treatment decisions',
      },
    ],
    financial: [
      {
        pattern: /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g,
        type: 'currency',
        severity: 'critical',
        risk: 'Incorrect monetary amount',
      },
      {
        pattern: /\b\d+(?:\.\d+)?%\s*(?:APR|APY|interest|rate|return)\b/gi,
        type: 'percentage',
        severity: 'critical',
        risk: 'Incorrect rate could affect financial decisions',
      },
      {
        pattern: /\b(?:P\/E|ROI|EBITDA|EPS)\s*(?:of\s*)?\d+(?:\.\d+)?\b/gi,
        type: 'number',
        severity: 'high',
        risk: 'Incorrect financial metric',
      },
      {
        pattern: /\b(?:deadline|due date|maturity)\s*(?:is\s*)?(?:on\s*)?[A-Za-z]+\s+\d{1,2},?\s*\d{4}\b/gi,
        type: 'date',
        severity: 'high',
        risk: 'Incorrect deadline could cause missed obligations',
      },
      {
        pattern: /\b(?:penalty|fee|charge)\s+(?:of\s+)?\$?\d+/gi,
        type: 'currency',
        severity: 'high',
        risk: 'Incorrect fee information',
      },
    ],
    legal: [
      {
        pattern: /\b§\s*\d+(?:\.\d+)*\b/g,
        type: 'legal_reference',
        severity: 'critical',
        risk: 'Incorrect statute reference',
      },
      {
        pattern: /\b(?:Section|Article|Clause|Paragraph)\s+\d+(?:\.\d+)*(?:\([a-z]\))?/gi,
        type: 'legal_reference',
        severity: 'critical',
        risk: 'Incorrect legal citation',
      },
      {
        pattern: /\b\d+\s+U\.?S\.?C\.?\s+§?\s*\d+\b/g,
        type: 'legal_reference',
        severity: 'critical',
        risk: 'Incorrect US Code reference',
      },
      {
        pattern: /\b(?:statute of limitations|filing deadline)\s*(?:is\s*)?\d+\s*(?:days?|months?|years?)\b/gi,
        type: 'date',
        severity: 'critical',
        risk: 'Incorrect limitation period could cause loss of rights',
      },
      {
        pattern: /\b(?:liable for|damages of|penalty up to)\s*\$?\d+/gi,
        type: 'currency',
        severity: 'high',
        risk: 'Incorrect liability/penalty amount',
      },
      {
        pattern: /\b(?:case|v\.|vs\.)\s+[A-Z][a-z]+\s+v\.?\s+[A-Z][a-z]+/g,
        type: 'technical_term',
        severity: 'high',
        risk: 'Incorrect case citation',
      },
    ],
  };

  private readonly SEVERITY_ORDER: Record<'critical' | 'high' | 'medium' | 'low', number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  /**
   * Verify all critical facts in response are anchored to sources
   */
  async verify(params: {
    response: string;
    domain: HighRiskDomain;
    sources: string[];
    flashFacts: string[];
  }): Promise<AnchoringResult> {
    const { response, domain, sources, flashFacts } = params;

    // Combine all source text
    const sourcesText = [...sources, ...flashFacts].join(' ').toLowerCase();

    // Get patterns for this domain
    const patterns = this.CRITICAL_PATTERNS[domain] || [];

    // Find all matches and check anchoring
    const unanchored: UnanchoredFact[] = [];
    let maxSeverity: 'critical' | 'high' | 'medium' | 'low' = 'low';

    for (const { pattern, type, severity, risk } of patterns) {
      // Clone pattern to reset lastIndex
      const clonedPattern = new RegExp(pattern.source, pattern.flags);
      
      let match;
      while ((match = clonedPattern.exec(response)) !== null) {
        const value = match[0];
        const normalizedValue = value.toLowerCase();

        // Check if this value appears in sources
        if (!this.isAnchored(normalizedValue, sourcesText)) {
          unanchored.push({
            fact: value,
            type,
            context: this.extractContext(response, match.index, value.length),
            severity,
            potentialRisk: risk,
          });

          // Update max severity
          if (this.SEVERITY_ORDER[severity] > this.SEVERITY_ORDER[maxSeverity]) {
            maxSeverity = severity;
          }
        }
      }
    }

    const isFullyAnchored = unanchored.length === 0;
    const requiresOversight = !isFullyAnchored && 
      unanchored.some(u => u.severity === 'critical' || u.severity === 'high');

    logger.debug('Critical fact anchoring complete', {
      domain,
      isFullyAnchored,
      unanchoredCount: unanchored.length,
      maxSeverity,
      requiresOversight,
    });

    return {
      isFullyAnchored,
      unanchoredFacts: unanchored,
      requiresOversight,
      riskLevel: maxSeverity,
      summary: this.generateSummary(unanchored, domain),
    };
  }

  /**
   * Check if a value is anchored in source text
   */
  private isAnchored(value: string, sourcesText: string): boolean {
    // Direct match
    if (sourcesText.includes(value)) return true;

    // For numbers, check with some tolerance
    const numMatch = value.match(/[\d,.]+/);
    if (numMatch) {
      const num = parseFloat(numMatch[0].replace(/,/g, ''));
      if (!isNaN(num)) {
        // Look for similar numbers in sources (within 1%)
        const lowerBound = Math.floor(num * 0.99);
        const upperBound = Math.ceil(num * 1.01);
        
        // Check if any number in this range exists in sources
        for (let n = lowerBound; n <= upperBound; n++) {
          if (sourcesText.includes(n.toString())) return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract context around a match
   */
  private extractContext(text: string, index: number, length: number): string {
    const contextSize = 30;
    const start = Math.max(0, index - contextSize);
    const end = Math.min(text.length, index + length + contextSize);
    
    let context = text.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  /**
   * Generate summary of anchoring results
   */
  private generateSummary(unanchored: UnanchoredFact[], domain: HighRiskDomain): string {
    if (unanchored.length === 0) {
      return `All critical ${domain} facts are properly anchored to source materials.`;
    }

    const critical = unanchored.filter(u => u.severity === 'critical').length;
    const high = unanchored.filter(u => u.severity === 'high').length;

    let summary = `Found ${unanchored.length} unanchored fact(s) in ${domain} response`;
    if (critical > 0) summary += ` including ${critical} CRITICAL`;
    if (high > 0) summary += ` and ${high} HIGH severity`;
    summary += '. Manual verification recommended.';

    return summary;
  }

  /**
   * Check if a domain is high-risk
   */
  isHighRiskDomain(domain: string): domain is HighRiskDomain {
    return ['healthcare', 'financial', 'legal'].includes(domain);
  }
}

export const factAnchorService = new CriticalFactAnchorService();
