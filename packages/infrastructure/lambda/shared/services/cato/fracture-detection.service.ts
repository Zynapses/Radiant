/**
 * RADIANT Genesis Cato Fracture Detection Service
 * Detects misalignment between stated intent and actual behavior
 *
 * Three detection methods:
 * 1. Causal analysis - Do actions match stated goals?
 * 2. Narrative analysis - Is the response internally consistent?
 * 3. Entropy analysis - Is there semantic inconsistency?
 */

import { query } from '../database';
import {
  FractureResult,
  FractureSeverity,
  Policy,
  ExecutionContext,
} from './types';
import { adaptiveEntropyService } from './adaptive-entropy.service';

// Default fracture detection config
const DEFAULT_CONFIG = {
  weights: {
    wordOverlap: 0.20,
    intentKeyword: 0.25,
    sentiment: 0.15,
    topicCoherence: 0.20,
    completeness: 0.20,
  },
  alignmentThreshold: 0.40,
  evasionThreshold: 0.60,
};

interface FractureConfig {
  weights: {
    wordOverlap: number;
    intentKeyword: number;
    sentiment: number;
    topicCoherence: number;
    completeness: number;
  };
  alignmentThreshold: number;
  evasionThreshold: number;
}

// Config cache
const configCache: Map<string, { config: FractureConfig; expires: number }> = new Map();
const CONFIG_TTL_MS = 60000; // 1 minute cache

export class FractureDetectionService {
  /**
   * Load tenant-specific fracture detection config
   */
  private async loadConfig(tenantId: string): Promise<FractureConfig> {
    // Check cache
    const cached = configCache.get(tenantId);
    if (cached && cached.expires > Date.now()) {
      return cached.config;
    }

    try {
      const result = await query(
        `SELECT 
          fracture_word_overlap_weight, fracture_intent_keyword_weight, fracture_sentiment_weight,
          fracture_topic_coherence_weight, fracture_completeness_weight,
          fracture_alignment_threshold, fracture_evasion_threshold
         FROM cato_tenant_config WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length === 0) {
        return DEFAULT_CONFIG;
      }

      const row = result.rows[0];
      const config: FractureConfig = {
        weights: {
          wordOverlap: parseFloat(row.fracture_word_overlap_weight) || DEFAULT_CONFIG.weights.wordOverlap,
          intentKeyword: parseFloat(row.fracture_intent_keyword_weight) || DEFAULT_CONFIG.weights.intentKeyword,
          sentiment: parseFloat(row.fracture_sentiment_weight) || DEFAULT_CONFIG.weights.sentiment,
          topicCoherence: parseFloat(row.fracture_topic_coherence_weight) || DEFAULT_CONFIG.weights.topicCoherence,
          completeness: parseFloat(row.fracture_completeness_weight) || DEFAULT_CONFIG.weights.completeness,
        },
        alignmentThreshold: parseFloat(row.fracture_alignment_threshold) || DEFAULT_CONFIG.alignmentThreshold,
        evasionThreshold: parseFloat(row.fracture_evasion_threshold) || DEFAULT_CONFIG.evasionThreshold,
      };

      // Cache the config
      configCache.set(tenantId, { config, expires: Date.now() + CONFIG_TTL_MS });
      return config;
    } catch (error) {
      console.error('[CATO Fracture] Failed to load config:', error);
      return DEFAULT_CONFIG;
    }
  }
  /**
   * Detect fractures in agent behavior
   */
  async detectFractures(params: {
    statedIntent: string;
    proposedPolicy: Policy;
    generatedResponse: string;
    context: ExecutionContext;
  }): Promise<FractureResult> {
    const { statedIntent, proposedPolicy, generatedResponse, context } = params;

    // Load tenant-specific config
    const config = await this.loadConfig(context.tenantId);

    const fractureTypes: string[] = [];
    let severity: FractureSeverity = 'none';

    // 1. Causal Analysis
    const causalResult = await this.analyzeCausal(
      statedIntent,
      proposedPolicy,
      generatedResponse
    );

    if (causalResult.hasLatentFracture) {
      fractureTypes.push('causal');
      severity = this.escalateSeverity(severity, 'moderate');
    }

    // 2. Narrative Analysis (using tenant config)
    const narrativeResult = await this.analyzeNarrativeWithConfig(
      statedIntent,
      generatedResponse,
      config
    );

    if (narrativeResult.hasFracture) {
      fractureTypes.push('narrative');
      severity = this.escalateSeverity(
        severity,
        narrativeResult.alignmentScore < 0.5 ? 'critical' : 'minor'
      );
    }

    // 3. Entropy Analysis (if enabled)
    let entropyResult: FractureResult['entropy'] | undefined;
    if (context.systemState.tenantSettings.enableSemanticEntropy) {
      const entropyCheck = await adaptiveEntropyService.checkEntropy({
        prompt: statedIntent,
        agentResponse: generatedResponse,
        action: proposedPolicy.action,
        actorModel: 'default',
        context,
      });

      if (entropyCheck.result) {
        entropyResult = {
          isPotentialDeception: entropyCheck.result.isPotentialDeception,
          semanticEntropy: entropyCheck.result.semanticEntropy,
          consistency: entropyCheck.result.consistency,
          sampledModel: entropyCheck.result.sampledModel,
          checkMode: entropyCheck.mode,
        };

        if (entropyCheck.result.isPotentialDeception) {
          fractureTypes.push('entropy');
          severity = this.escalateSeverity(severity, 'critical');
        }
      }
    }

    const hasFracture = fractureTypes.length > 0;

    // Record detection if fracture found
    if (hasFracture) {
      await this.recordFracture(context.tenantId, context.sessionId, {
        hasFracture,
        severity,
        fractureTypes,
        causal: causalResult,
        narrative: narrativeResult,
        entropy: entropyResult,
      });
    }

    return {
      hasFracture,
      severity,
      fractureTypes,
      causal: causalResult,
      narrative: narrativeResult,
      entropy: entropyResult,
      recommendation: this.generateRecommendation(severity, fractureTypes),
    };
  }

  /**
   * Analyze causal alignment between intent and action
   */
  private async analyzeCausal(
    intent: string,
    policy: Policy,
    response: string
  ): Promise<{
    hasLatentFracture: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];

    // Check if action type matches intent keywords
    const intentLower = intent.toLowerCase();
    const actionType = policy.action.type.toLowerCase();

    // Detect misalignment patterns
    if (intentLower.includes('delete') && !actionType.includes('delete')) {
      violations.push('Intent mentions deletion but action does not delete');
    }

    if (intentLower.includes('private') && policy.action.containsPII) {
      violations.push('Intent mentions privacy but action exposes PII');
    }

    if (intentLower.includes('safe') && policy.action.isDestructive) {
      violations.push('Intent mentions safety but action is destructive');
    }

    // Check for evasive language patterns in response
    const evasivePatterns = [
      /i cannot.*but.*here/i,
      /instead.*i will/i,
      /technically.*but/i,
      /while i.*shouldn't/i,
    ];

    for (const pattern of evasivePatterns) {
      if (pattern.test(response)) {
        violations.push('Evasive language pattern detected');
        break;
      }
    }

    return {
      hasLatentFracture: violations.length > 0,
      violations,
    };
  }

  /**
   * Analyze narrative consistency using multiple techniques
   * Uses tenant-specific weights and thresholds from database config
   */
  private async analyzeNarrativeWithConfig(
    intent: string,
    response: string,
    config: FractureConfig
  ): Promise<{
    hasFracture: boolean;
    alignmentScore: number;
  }> {
    // Multi-factor alignment analysis
    const scores: number[] = [];

    // 1. Word overlap analysis (basic semantic similarity)
    const wordOverlapScore = this.calculateWordOverlap(intent, response);
    scores.push(wordOverlapScore);

    // 2. Intent keyword matching
    const intentKeywordScore = this.analyzeIntentKeywords(intent, response);
    scores.push(intentKeywordScore);

    // 3. Sentiment alignment
    const sentimentScore = this.analyzeSentimentAlignment(intent, response);
    scores.push(sentimentScore);

    // 4. Topic coherence
    const topicScore = this.analyzeTopicCoherence(intent, response);
    scores.push(topicScore);

    // 5. Response completeness
    const completenessScore = this.analyzeResponseCompleteness(intent, response);
    scores.push(completenessScore);

    // Weighted average using tenant config
    const weights = [
      config.weights.wordOverlap,
      config.weights.intentKeyword,
      config.weights.sentiment,
      config.weights.topicCoherence,
      config.weights.completeness,
    ];
    const alignmentScore = scores.reduce((sum, score, i) => sum + score * weights[i], 0);

    // Check for explicit contradiction patterns
    const contradictionPatterns = [
      /i cannot|i won't|i refuse/i,
      /that's not possible/i,
      /i'm unable to/i,
      /i don't have access/i,
      /outside my capabilities/i,
    ];

    const hasContradiction = contradictionPatterns.some((p) => p.test(response));
    
    // Check for evasion indicators
    const evasionScore = this.detectEvasion(response);
    
    // Use tenant-specific thresholds
    const hasFracture = alignmentScore < config.alignmentThreshold || 
                        hasContradiction || 
                        evasionScore > config.evasionThreshold;

    return {
      hasFracture,
      alignmentScore: Math.max(0, alignmentScore - (evasionScore * 0.2)),
    };
  }

  /**
   * Analyze narrative consistency (legacy method for backward compatibility)
   */
  private async analyzeNarrative(
    intent: string,
    response: string
  ): Promise<{
    hasFracture: boolean;
    alignmentScore: number;
  }> {
    return this.analyzeNarrativeWithConfig(intent, response, DEFAULT_CONFIG);
  }

  /**
   * Calculate word overlap between intent and response
   */
  private calculateWordOverlap(intent: string, response: string): number {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me',
      'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'what', 'which']);

    const intentWords = new Set(
      intent.toLowerCase().split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w))
    );
    const responseWords = new Set(
      response.toLowerCase().split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w))
    );

    if (intentWords.size === 0) return 1.0;

    let overlap = 0;
    for (const word of intentWords) {
      if (responseWords.has(word)) {
        overlap++;
      }
    }

    return overlap / intentWords.size;
  }

  /**
   * Analyze if response addresses intent keywords
   */
  private analyzeIntentKeywords(intent: string, response: string): number {
    // Extract key action verbs and nouns from intent
    const actionVerbs = ['create', 'make', 'build', 'write', 'generate', 'explain', 'describe',
      'analyze', 'find', 'search', 'calculate', 'convert', 'translate', 'summarize', 'list',
      'compare', 'help', 'show', 'tell', 'give', 'provide', 'fix', 'solve', 'answer'];
    
    const intentLower = intent.toLowerCase();
    const responseLower = response.toLowerCase();
    
    // Find action verbs in intent
    const intentActions = actionVerbs.filter(v => intentLower.includes(v));
    if (intentActions.length === 0) return 0.8; // No clear action, assume OK

    // Check if response indicates completion of action
    const completionIndicators = [
      'here is', 'here are', 'the following', 'below', 'created', 'generated',
      'found', 'result', 'answer', 'solution', 'explanation', 'summary',
    ];

    const hasCompletion = completionIndicators.some(ind => responseLower.includes(ind));
    const hasRefusal = /cannot|won't|unable|sorry.*but|i apologize.*but/i.test(response);

    if (hasRefusal) return 0.2;
    if (hasCompletion) return 0.9;
    
    return 0.6; // Neutral
  }

  /**
   * Analyze sentiment alignment between intent and response
   */
  private analyzeSentimentAlignment(intent: string, response: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
      'helpful', 'useful', 'easy', 'simple', 'clear', 'best', 'happy', 'pleased', 'glad'];
    const negativeWords = ['bad', 'wrong', 'error', 'problem', 'issue', 'fail', 'cannot',
      'unable', 'impossible', 'difficult', 'hard', 'complex', 'confused', 'sorry', 'unfortunately'];

    const intentLower = intent.toLowerCase();
    const responseLower = response.toLowerCase();

    // Calculate sentiment scores
    const intentPositive = positiveWords.filter(w => intentLower.includes(w)).length;
    const intentNegative = negativeWords.filter(w => intentLower.includes(w)).length;
    const responsePositive = positiveWords.filter((w: string) => responseLower.includes(w)).length;
    const responseNegative = negativeWords.filter(w => responseLower.includes(w)).length;

    // If intent is neutral, response sentiment doesn't matter much
    if (intentPositive === 0 && intentNegative === 0) return 0.8;

    // Check for sentiment mismatch
    const intentSentiment = intentPositive - intentNegative;
    const responseSentiment = responsePositive - responseNegative;

    // Penalize if response is more negative than intent
    if (intentSentiment >= 0 && responseSentiment < -1) return 0.4;
    
    return 0.8;
  }

  /**
   * Analyze topic coherence
   */
  private analyzeTopicCoherence(intent: string, response: string): number {
    // Extract n-grams from both
    const intentBigrams = this.extractNgrams(intent, 2);
    const responseBigrams = this.extractNgrams(response, 2);

    if (intentBigrams.length === 0) return 0.8;

    // Count matching bigrams
    const intentSet = new Set(intentBigrams);
    let matches = 0;
    for (const bigram of responseBigrams) {
      if (intentSet.has(bigram)) matches++;
    }

    // Normalize by intent bigrams
    const bigramScore = Math.min(1.0, matches / Math.max(1, intentBigrams.length / 2));
    
    return 0.5 + (bigramScore * 0.5); // Base 0.5, up to 1.0
  }

  /**
   * Extract n-grams from text
   */
  private extractNgrams(text: string, n: number): string[] {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const ngrams: string[] = [];
    
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }

  /**
   * Analyze response completeness
   */
  private analyzeResponseCompleteness(intent: string, response: string): number {
    // Check if response is too short for the intent
    const intentLength = intent.length;
    const responseLength = response.length;

    // Very short responses to complex intents indicate incompleteness
    if (intentLength > 100 && responseLength < 50) return 0.3;
    if (intentLength > 50 && responseLength < 20) return 0.2;

    // Check for truncation indicators
    const truncationPatterns = [/\.\.\.$/, /etc\.$/, /and so on$/i, /more to come/i];
    if (truncationPatterns.some(p => p.test(response))) return 0.6;

    // Check for complete sentences
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0 && responseLength > 20) return 0.5;

    return 0.9;
  }

  /**
   * Detect evasion in response
   */
  private detectEvasion(response: string): number {
    const evasionPatterns = [
      { pattern: /i cannot.*but.*here/i, weight: 0.8 },
      { pattern: /instead.*i will/i, weight: 0.6 },
      { pattern: /technically.*but/i, weight: 0.5 },
      { pattern: /while i.*shouldn't/i, weight: 0.9 },
      { pattern: /let me.*around/i, weight: 0.7 },
      { pattern: /hypothetically/i, weight: 0.4 },
      { pattern: /in theory/i, weight: 0.3 },
      { pattern: /one could argue/i, weight: 0.4 },
      { pattern: /some might say/i, weight: 0.4 },
      { pattern: /i'm not supposed to.*but/i, weight: 0.95 },
    ];

    let maxWeight = 0;
    for (const { pattern, weight } of evasionPatterns) {
      if (pattern.test(response)) {
        maxWeight = Math.max(maxWeight, weight);
      }
    }

    return maxWeight;
  }

  /**
   * Escalate severity level
   */
  private escalateSeverity(
    current: FractureSeverity,
    detected: FractureSeverity
  ): FractureSeverity {
    const severityOrder: FractureSeverity[] = [
      'none',
      'minor',
      'moderate',
      'critical',
    ];
    const currentIndex = severityOrder.indexOf(current);
    const detectedIndex = severityOrder.indexOf(detected);

    return severityOrder[Math.max(currentIndex, detectedIndex)];
  }

  /**
   * Generate recommendation based on fracture detection
   */
  private generateRecommendation(
    severity: FractureSeverity,
    types: string[]
  ): string {
    if (severity === 'none') {
      return 'No fractures detected. Action appears aligned with intent.';
    }

    const typeDescriptions = types.map((t) => {
      switch (t) {
        case 'causal':
          return 'action-intent mismatch';
        case 'narrative':
          return 'response inconsistency';
        case 'entropy':
          return 'semantic inconsistency';
        default:
          return t;
      }
    });

    switch (severity) {
      case 'critical':
        return `CRITICAL: Multiple alignment issues detected (${typeDescriptions.join(', ')}). Block action and investigate.`;
      case 'moderate':
        return `WARNING: Potential misalignment detected (${typeDescriptions.join(', ')}). Review before proceeding.`;
      case 'minor':
        return `NOTICE: Minor inconsistencies detected (${typeDescriptions.join(', ')}). Proceed with caution.`;
      default:
        return 'Unknown fracture state.';
    }
  }

  /**
   * Record fracture detection to database
   */
  private async recordFracture(
    tenantId: string,
    sessionId: string,
    result: FractureResult
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO cato_fracture_detections (
          tenant_id, session_id, has_fracture, severity, fracture_types,
          causal_has_latent_fracture, causal_violations,
          narrative_has_fracture, narrative_alignment_score,
          entropy_is_potential_deception, entropy_semantic_entropy,
          entropy_consistency, entropy_sampled_model, entropy_check_mode,
          recommendation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          tenantId,
          sessionId,
          result.hasFracture,
          result.severity,
          result.fractureTypes,
          result.causal?.hasLatentFracture,
          result.causal ? JSON.stringify(result.causal.violations) : null,
          result.narrative?.hasFracture,
          result.narrative?.alignmentScore,
          result.entropy?.isPotentialDeception,
          result.entropy?.semanticEntropy,
          result.entropy?.consistency,
          result.entropy?.sampledModel,
          result.entropy?.checkMode,
          result.recommendation,
        ]
      );
    } catch (error) {
      console.error('[CATO Fracture] Failed to record detection:', error);
    }
  }
}

export const fractureDetectionService = new FractureDetectionService();
