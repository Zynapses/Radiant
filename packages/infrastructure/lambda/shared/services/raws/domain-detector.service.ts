/**
 * RAWS v1.1 - Domain Detection Service
 * Detects domain from text with confidence thresholds
 */

import {
  Domain,
  DomainDetectionResult,
  DomainConfig,
  DOMAIN_KEYWORDS,
} from './types.js';

// Default confidence threshold - only apply domain profile if above this
const DEFAULT_CONFIDENCE_THRESHOLD = 0.70;

// Minimum keyword matches required
const MIN_KEYWORD_MATCHES = 2;

// Weight multipliers for different match types
const EXACT_MATCH_WEIGHT = 1.0;
const PARTIAL_MATCH_WEIGHT = 0.5;

export class DomainDetectorService {
  private domainConfigs: Map<Domain, DomainConfig> = new Map();

  constructor(domainConfigs?: DomainConfig[]) {
    if (domainConfigs) {
      for (const config of domainConfigs) {
        this.domainConfigs.set(config.id, config);
      }
    }
  }

  /**
   * Detect domain from text content with confidence scoring
   */
  detectFromText(text: string): DomainDetectionResult {
    if (!text || text.trim().length === 0) {
      return this.createResult('general', 0, []);
    }

    const lowerText = text.toLowerCase();
    const words = this.tokenize(lowerText);
    
    const scores: Record<Domain, { count: number; keywords: string[] }> = {
      healthcare: { count: 0, keywords: [] },
      financial: { count: 0, keywords: [] },
      legal: { count: 0, keywords: [] },
      scientific: { count: 0, keywords: [] },
      creative: { count: 0, keywords: [] },
      engineering: { count: 0, keywords: [] },
      general: { count: 0, keywords: [] }
    };

    // Score each domain
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (domain === 'general') continue;
      
      for (const keyword of keywords) {
        // Check for exact word match (higher weight)
        if (words.includes(keyword)) {
          scores[domain as Domain].count += EXACT_MATCH_WEIGHT;
          if (!scores[domain as Domain].keywords.includes(keyword)) {
            scores[domain as Domain].keywords.push(keyword);
          }
        }
        // Check for partial/substring match (lower weight)
        else if (lowerText.includes(keyword)) {
          scores[domain as Domain].count += PARTIAL_MATCH_WEIGHT;
          if (!scores[domain as Domain].keywords.includes(keyword)) {
            scores[domain as Domain].keywords.push(keyword);
          }
        }
      }
    }

    // Find highest scoring domain
    let maxScore = 0;
    let detectedDomain: Domain = 'general';
    let matchedKeywords: string[] = [];

    for (const [domain, data] of Object.entries(scores)) {
      if (domain !== 'general' && data.count > maxScore) {
        maxScore = data.count;
        detectedDomain = domain as Domain;
        matchedKeywords = data.keywords;
      }
    }

    // Calculate confidence based on:
    // 1. Number of keyword matches
    // 2. Ratio of matches to domain keywords
    // 3. Absence of competing domain matches
    const confidence = this.calculateConfidence(
      maxScore,
      matchedKeywords.length,
      scores,
      detectedDomain
    );

    // Apply minimum threshold
    if (matchedKeywords.length < MIN_KEYWORD_MATCHES || confidence < DEFAULT_CONFIDENCE_THRESHOLD) {
      return this.createResult('general', confidence, matchedKeywords);
    }

    return this.createResult(detectedDomain, confidence, matchedKeywords);
  }

  /**
   * Detect domain from explicit task type
   */
  detectFromTaskType(taskType: string): DomainDetectionResult | null {
    const taskTypeMap: Record<string, Domain> = {
      // Healthcare
      'medical_qa': 'healthcare',
      'clinical_documentation': 'healthcare',
      'patient_analysis': 'healthcare',
      'diagnosis_support': 'healthcare',
      'drug_interaction': 'healthcare',
      
      // Financial
      'investment_analysis': 'financial',
      'financial_reporting': 'financial',
      'tax_preparation': 'financial',
      'portfolio_analysis': 'financial',
      'risk_assessment': 'financial',
      
      // Legal
      'contract_analysis': 'legal',
      'legal_research': 'legal',
      'compliance_review': 'legal',
      'case_law_research': 'legal',
      'regulatory_analysis': 'legal',
      
      // Scientific
      'research_analysis': 'scientific',
      'literature_review': 'scientific',
      'data_analysis': 'scientific',
      'hypothesis_testing': 'scientific',
      'peer_review': 'scientific',
      
      // Creative
      'content_writing': 'creative',
      'creative_writing': 'creative',
      'marketing_copy': 'creative',
      'storytelling': 'creative',
      'brainstorming': 'creative',
      
      // Engineering
      'code_generation': 'engineering',
      'code_review': 'engineering',
      'debugging': 'engineering',
      'architecture_design': 'engineering',
      'api_development': 'engineering',
    };

    const domain = taskTypeMap[taskType];
    if (domain) {
      return this.createResult(domain, 1.0, [taskType]);
    }

    return null;
  }

  /**
   * Combine multiple detection signals
   */
  detectWithContext(options: {
    text?: string;
    taskType?: string;
    explicitDomain?: Domain;
  }): DomainDetectionResult {
    // Explicit domain always wins
    if (options.explicitDomain) {
      return this.createResult(options.explicitDomain, 1.0, ['explicit']);
    }

    // Task type is high confidence
    if (options.taskType) {
      const taskResult = this.detectFromTaskType(options.taskType);
      if (taskResult && taskResult.domain !== 'general') {
        return taskResult;
      }
    }

    // Fall back to text detection
    if (options.text) {
      return this.detectFromText(options.text);
    }

    return this.createResult('general', 0, []);
  }

  /**
   * Check if confidence meets threshold for applying domain constraints
   */
  meetsConfidenceThreshold(
    result: DomainDetectionResult,
    customThreshold?: number
  ): boolean {
    const threshold = customThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    return result.confidence >= threshold && result.domain !== 'general';
  }

  /**
   * Get domain configuration
   */
  getDomainConfig(domain: Domain): DomainConfig | undefined {
    return this.domainConfigs.get(domain);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    rawScore: number,
    keywordCount: number,
    allScores: Record<Domain, { count: number; keywords: string[] }>,
    detectedDomain: Domain
  ): number {
    if (rawScore === 0 || keywordCount === 0) {
      return 0;
    }

    // Base confidence from keyword count (0.3-0.7)
    const keywordFactor = Math.min(keywordCount / 5, 1.0);
    const baseConfidence = 0.3 + (keywordFactor * 0.4);

    // Boost if no competing domains (0-0.2)
    let competingScore = 0;
    for (const [domain, data] of Object.entries(allScores)) {
      if (domain !== detectedDomain && domain !== 'general') {
        competingScore += data.count;
      }
    }
    const exclusivityBonus = competingScore === 0 ? 0.2 : 
      Math.max(0, 0.2 - (competingScore / rawScore) * 0.2);

    // Raw score bonus (0-0.1)
    const scoreBonus = Math.min(rawScore / 10, 0.1);

    return Math.min(baseConfidence + exclusivityBonus + scoreBonus, 1.0);
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Create detection result
   */
  private createResult(
    domain: Domain,
    confidence: number,
    matchedKeywords: string[]
  ): DomainDetectionResult {
    return {
      domain,
      confidence: Math.round(confidence * 100) / 100,
      matchedKeywords,
      keywordCount: matchedKeywords.length
    };
  }
}

export const domainDetectorService = new DomainDetectorService();
