// RADIANT v4.18.0 - Hallucination Detection Service
// TruthfulQA, SelfCheckGPT, and factual grounding verification
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { modelRouterService, type ChatMessage } from './model-router.service';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface HallucinationCheckResult {
  isHallucinated: boolean;
  confidenceScore: number;
  checkType: string;
  details: {
    selfConsistencyScore?: number;
    groundingScore?: number;
    truthfulQAScore?: number;
    claimVerificationResults?: ClaimVerification[];
  };
  latencyMs: number;
}

export interface ClaimVerification {
  claim: string;
  isSupported: boolean;
  supportingEvidence?: string;
  confidence: number;
}

export interface SelfCheckResult {
  originalResponse: string;
  sampledResponses: string[];
  consistencyScores: number[];
  averageConsistency: number;
  isConsistent: boolean;
}

export interface TruthfulQAResult {
  question: string;
  modelAnswer: string;
  truthfulScore: number;
  informativeScore: number;
  truthfulAndInformative: boolean;
  referenceAnswer?: string;
}

export interface HallucinationConfig {
  enabled: boolean;
  selfCheckEnabled: boolean;
  selfCheckSamples: number;
  selfCheckThreshold: number;
  groundingEnabled: boolean;
  groundingThreshold: number;
  claimExtractionEnabled: boolean;
  truthfulQAEnabled: boolean;
}

// ============================================================================
// Hallucination Detection Service
// ============================================================================

class HallucinationDetectionService {
  
  /**
   * Run comprehensive hallucination check
   */
  async checkHallucination(
    tenantId: string,
    prompt: string,
    response: string,
    options?: {
      context?: string;
      modelId?: string;
      runSelfCheck?: boolean;
      runGrounding?: boolean;
      runClaimVerification?: boolean;
    }
  ): Promise<HallucinationCheckResult> {
    const startTime = Date.now();
    const config = await this.getConfig(tenantId);
    
    if (!config.enabled) {
      return {
        isHallucinated: false,
        confidenceScore: 0,
        checkType: 'disabled',
        details: {},
        latencyMs: Date.now() - startTime,
      };
    }
    
    const results: HallucinationCheckResult['details'] = {};
    let overallScore = 0;
    let checksRun = 0;
    
    // 1. Self-consistency check (SelfCheckGPT style)
    if ((options?.runSelfCheck ?? config.selfCheckEnabled) && options?.modelId) {
      const selfCheck = await this.runSelfConsistencyCheck(
        tenantId,
        prompt,
        response,
        options.modelId,
        config.selfCheckSamples
      );
      results.selfConsistencyScore = selfCheck.averageConsistency;
      overallScore += selfCheck.averageConsistency;
      checksRun++;
    }
    
    // 2. Grounding check (against provided context)
    if ((options?.runGrounding ?? config.groundingEnabled) && options?.context) {
      const groundingScore = await this.checkGrounding(response, options.context);
      results.groundingScore = groundingScore;
      overallScore += groundingScore;
      checksRun++;
    }
    
    // 3. Claim extraction and verification
    if (options?.runClaimVerification ?? config.claimExtractionEnabled) {
      const claims = await this.extractAndVerifyClaims(response, options?.context);
      results.claimVerificationResults = claims;
      const avgClaimScore = claims.length > 0
        ? claims.reduce((s, c) => s + (c.isSupported ? c.confidence : 0), 0) / claims.length
        : 1;
      overallScore += avgClaimScore;
      checksRun++;
    }
    
    // Calculate final score
    const finalScore = checksRun > 0 ? overallScore / checksRun : 1;
    const isHallucinated = finalScore < 0.5;
    
    // Log result
    await this.logHallucinationCheck(tenantId, {
      promptHash: crypto.createHash('md5').update(prompt).digest('hex'),
      responseHash: crypto.createHash('md5').update(response).digest('hex'),
      isHallucinated,
      score: finalScore,
      details: results,
      modelId: options?.modelId,
    });
    
    return {
      isHallucinated,
      confidenceScore: finalScore,
      checkType: checksRun > 1 ? 'comprehensive' : 'single',
      details: results,
      latencyMs: Date.now() - startTime,
    };
  }
  
  /**
   * SelfCheckGPT-style self-consistency check
   * Sample multiple responses and check if they're consistent
   */
  async runSelfConsistencyCheck(
    tenantId: string,
    prompt: string,
    originalResponse: string,
    modelId: string,
    numSamples: number = 3
  ): Promise<SelfCheckResult> {
    // In production, this would call the model multiple times with temperature > 0
    // For now, simulate with placeholder
    
    const sampledResponses: string[] = [];
    const consistencyScores: number[] = [];
    
    // Call model with temperature > 0 for diverse sampling
    for (let i = 0; i < numSamples; i++) {
      const sampled = await this.sampleFromModel(prompt, modelId);
      sampledResponses.push(sampled);
      
      // Calculate consistency with original
      const score = this.calculateTextSimilarity(originalResponse, sampled);
      consistencyScores.push(score);
    }
    
    const averageConsistency = consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length;
    
    return {
      originalResponse,
      sampledResponses,
      consistencyScores,
      averageConsistency,
      isConsistent: averageConsistency >= 0.7,
    };
  }
  
  /**
   * Check if response is grounded in provided context
   */
  async checkGrounding(response: string, context: string): Promise<number> {
    // Extract sentences from response
    const sentences = this.extractSentences(response);
    if (sentences.length === 0) return 1;
    
    let groundedCount = 0;
    
    for (const sentence of sentences) {
      // Check if sentence content can be found in or inferred from context
      const isGrounded = this.isSentenceGrounded(sentence, context);
      if (isGrounded) groundedCount++;
    }
    
    return groundedCount / sentences.length;
  }
  
  /**
   * Extract factual claims and verify them
   */
  async extractAndVerifyClaims(
    response: string,
    context?: string
  ): Promise<ClaimVerification[]> {
    const claims = this.extractClaims(response);
    const verifications: ClaimVerification[] = [];
    
    for (const claim of claims) {
      const verification = await this.verifyClaim(claim, context);
      verifications.push(verification);
    }
    
    return verifications;
  }
  
  /**
   * Run TruthfulQA-style evaluation
   */
  async runTruthfulQAEvaluation(
    tenantId: string,
    modelId: string,
    questions: Array<{ question: string; correctAnswer: string; incorrectAnswers: string[] }>
  ): Promise<TruthfulQAResult[]> {
    const results: TruthfulQAResult[] = [];
    
    for (const q of questions) {
      // Call model and compare response
      const modelAnswer = await this.getModelAnswer(q.question, modelId);
      
      // Calculate truthfulness (similarity to correct answer vs incorrect)
      const correctSimilarity = this.calculateTextSimilarity(modelAnswer, q.correctAnswer);
      const maxIncorrectSimilarity = Math.max(
        ...q.incorrectAnswers.map(a => this.calculateTextSimilarity(modelAnswer, a))
      );
      
      const truthfulScore = correctSimilarity > maxIncorrectSimilarity
        ? correctSimilarity
        : 1 - maxIncorrectSimilarity;
      
      // Informative = not refusing to answer
      const informativeScore = modelAnswer.length > 20 ? 0.9 : 0.5;
      
      results.push({
        question: q.question,
        modelAnswer,
        truthfulScore,
        informativeScore,
        truthfulAndInformative: truthfulScore > 0.5 && informativeScore > 0.5,
        referenceAnswer: q.correctAnswer,
      });
    }
    
    // Store results
    await this.storeTruthfulQAResults(tenantId, modelId, results);
    
    return results;
  }
  
  /**
   * Get hallucination detection config
   */
  async getConfig(tenantId: string): Promise<HallucinationConfig> {
    const result = await executeStatement(
      `SELECT hallucination_config FROM security_protection_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    const config = result.rows?.[0]?.hallucination_config as Partial<HallucinationConfig> | undefined;
    
    return {
      enabled: config?.enabled ?? false,
      selfCheckEnabled: config?.selfCheckEnabled ?? true,
      selfCheckSamples: config?.selfCheckSamples ?? 3,
      selfCheckThreshold: config?.selfCheckThreshold ?? 0.7,
      groundingEnabled: config?.groundingEnabled ?? true,
      groundingThreshold: config?.groundingThreshold ?? 0.6,
      claimExtractionEnabled: config?.claimExtractionEnabled ?? false,
      truthfulQAEnabled: config?.truthfulQAEnabled ?? false,
    };
  }
  
  /**
   * Get hallucination statistics
   */
  async getStats(tenantId: string, days: number = 30): Promise<{
    totalChecks: number;
    hallucinationsDetected: number;
    hallucinationRate: number;
    averageScore: number;
    byModel: Record<string, { checks: number; hallucinations: number; rate: number }>;
  }> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_hallucinated THEN 1 ELSE 0 END) as hallucinations,
        AVG(score) as avg_score,
        model_id
       FROM hallucination_checks
       WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY model_id`,
      [stringParam('tenantId', tenantId), longParam('days', days)]
    );
    
    let totalChecks = 0;
    let totalHallucinations = 0;
    let totalScore = 0;
    const byModel: Record<string, { checks: number; hallucinations: number; rate: number }> = {};
    
    for (const row of result.rows || []) {
      const checks = Number(row.total || 0);
      const hallucinations = Number(row.hallucinations || 0);
      const modelId = String(row.model_id || 'unknown');
      
      totalChecks += checks;
      totalHallucinations += hallucinations;
      totalScore += Number(row.avg_score || 0) * checks;
      
      byModel[modelId] = {
        checks,
        hallucinations,
        rate: checks > 0 ? hallucinations / checks : 0,
      };
    }
    
    return {
      totalChecks,
      hallucinationsDetected: totalHallucinations,
      hallucinationRate: totalChecks > 0 ? totalHallucinations / totalChecks : 0,
      averageScore: totalChecks > 0 ? totalScore / totalChecks : 0,
      byModel,
    };
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private extractSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }
  
  private extractClaims(text: string): string[] {
    // Simple claim extraction - sentences with factual indicators
    const sentences = this.extractSentences(text);
    const factualIndicators = [
      /\b(is|are|was|were|has|have|had)\b/i,
      /\b(in \d{4}|on \w+ \d+|during)\b/i,
      /\b(\d+%|\$\d+|\d+ million|\d+ billion)\b/i,
      /\b(according to|research shows|studies indicate)\b/i,
    ];
    
    return sentences.filter(s =>
      factualIndicators.some(pattern => pattern.test(s))
    );
  }
  
  private isSentenceGrounded(sentence: string, context: string): boolean {
    // Check for keyword overlap
    const sentenceWords = new Set(
      sentence.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );
    const contextWords = new Set(
      context.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );
    
    let overlapCount = 0;
    for (const word of Array.from(sentenceWords)) {
      if (contextWords.has(word)) overlapCount++;
    }
    
    const overlapRatio = sentenceWords.size > 0 ? overlapCount / sentenceWords.size : 0;
    return overlapRatio > 0.3;
  }
  
  private async verifyClaim(claim: string, context?: string): Promise<ClaimVerification> {
    // First check against provided context if available
    if (context) {
      const isGrounded = this.isSentenceGrounded(claim, context);
      if (isGrounded) {
        return {
          claim,
          isSupported: true,
          supportingEvidence: 'Found in provided context',
          confidence: 0.85,
        };
      }
    }
    
    // Use LLM to evaluate claim verifiability and plausibility
    try {
      const verificationPrompt = `Analyze this claim for factual accuracy and plausibility:

CLAIM: "${claim}"

${context ? `CONTEXT PROVIDED:\n${context.substring(0, 1000)}\n` : ''}

Evaluate:
1. Is this a verifiable factual claim or an opinion/subjective statement?
2. Does this claim contain specific facts (dates, numbers, names) that could be verified?
3. Based on your knowledge, is this claim likely accurate?

Respond with ONLY a JSON object:
{"verifiable": true/false, "likely_accurate": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation", "evidence": "supporting information if any"}`;

      const result = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: verificationPrompt }],
        temperature: 0,
        maxTokens: 256,
      });

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const verification = JSON.parse(jsonMatch[0]);
        return {
          claim,
          isSupported: verification.likely_accurate === true,
          supportingEvidence: verification.evidence || verification.reasoning,
          confidence: Math.min(1, Math.max(0, verification.confidence || 0.5)),
        };
      }
    } catch (error) {
      logger.warn('LLM claim verification failed', { error: String(error), claim: claim.substring(0, 100) });
    }
    
    // Fallback: use heuristics for common patterns
    const hasSpecificNumbers = /\b\d{4}\b|\b\d+%\b|\$\d+/.test(claim);
    const hasProperNouns = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(claim);
    
    return {
      claim,
      isSupported: true, // Assume true when verification uncertain
      confidence: hasSpecificNumbers || hasProperNouns ? 0.4 : 0.6, // Lower confidence for specific claims
    };
  }
  
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    const intersection = new Set(Array.from(words1).filter(w => words2.has(w)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  private async sampleFromModel(prompt: string, modelId: string): Promise<string> {
    try {
      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ];
      
      const response = await modelRouterService.invoke({
        modelId: modelId || 'anthropic/claude-3-haiku',
        messages,
        temperature: 0.7, // Higher temperature for diverse sampling
        maxTokens: 1024,
      });
      
      return response.content;
    } catch (error) {
      logger.warn('Model sampling failed, using fallback', { error: String(error), modelId });
      return `[Sampling failed for: ${prompt.substring(0, 50)}...]`;
    }
  }
  
  private async getModelAnswer(question: string, modelId: string): Promise<string> {
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'Answer the following question concisely and accurately.' },
        { role: 'user', content: question }
      ];
      
      const response = await modelRouterService.invoke({
        modelId: modelId || 'anthropic/claude-3-haiku',
        messages,
        temperature: 0,
        maxTokens: 512,
      });
      
      return response.content;
    } catch (error) {
      logger.warn('Model answer failed, using fallback', { error: String(error), modelId });
      return `[Answer generation failed for: ${question.substring(0, 50)}...]`;
    }
  }
  
  private async logHallucinationCheck(
    tenantId: string,
    data: {
      promptHash: string;
      responseHash: string;
      isHallucinated: boolean;
      score: number;
      details: Record<string, unknown>;
      modelId?: string;
    }
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO hallucination_checks (
          tenant_id, prompt_hash, response_hash, is_hallucinated, score, details, model_id
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('promptHash', data.promptHash),
          stringParam('responseHash', data.responseHash),
          boolParam('isHallucinated', data.isHallucinated),
          doubleParam('score', data.score),
          stringParam('details', JSON.stringify(data.details)),
          stringParam('modelId', data.modelId || ''),
        ]
      );
    } catch (error) {
      logger.error('Failed to log hallucination check', { error: String(error) });
    }
  }
  
  private async storeTruthfulQAResults(
    tenantId: string,
    modelId: string,
    results: TruthfulQAResult[]
  ): Promise<void> {
    const avgTruthful = results.reduce((s, r) => s + r.truthfulScore, 0) / results.length;
    const avgInformative = results.reduce((s, r) => s + r.informativeScore, 0) / results.length;
    const truthfulAndInformative = results.filter(r => r.truthfulAndInformative).length / results.length;
    
    try {
      await executeStatement(
        `INSERT INTO quality_benchmark_results (
          tenant_id, model_id, benchmark_name, score, details
        ) VALUES ($1::uuid, $2, 'truthfulqa', $3, $4::jsonb)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('modelId', modelId),
          doubleParam('score', truthfulAndInformative),
          stringParam('details', JSON.stringify({
            avgTruthful,
            avgInformative,
            truthfulAndInformativeRate: truthfulAndInformative,
            totalQuestions: results.length,
          })),
        ]
      );
    } catch (error) {
      logger.error('Failed to store TruthfulQA results', { error: String(error) });
    }
  }
}

export const hallucinationDetectionService = new HallucinationDetectionService();
