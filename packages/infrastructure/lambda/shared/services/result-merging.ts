// RADIANT v4.18.0 - Result Merging Service
// AI response synthesis from concurrent/multi-model queries

import { withRetry, isRetryableHttpStatus } from '../utils/retry';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { getPoolClient } from '../db/centralized-pool';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || process.env.LITELLM_ENDPOINT;
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || process.env.LITELLM_API_KEY;

export interface ModelResponse {
  modelId: string;
  content: string;
  tokensUsed: number;
  latencyMs: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface MergeStrategy {
  type: 'best' | 'consensus' | 'synthesis' | 'weighted' | 'chain';
  options?: {
    preferredModel?: string;
    weights?: Record<string, number>;
    synthesisModel?: string;
    confidenceThreshold?: number;
  };
}

export interface MergedResult {
  content: string;
  sources: {
    modelId: string;
    contribution: number;
    selected: boolean;
  }[];
  strategy: MergeStrategy['type'];
  totalTokens: number;
  processingTimeMs: number;
  confidence: number;
}

export class ResultMergingService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async mergeResponses(
    responses: ModelResponse[],
    strategy: MergeStrategy
  ): Promise<MergedResult> {
    const startTime = Date.now();

    if (responses.length === 0) {
      throw new Error('No responses to merge');
    }

    if (responses.length === 1) {
      return this.singleResponse(responses[0], startTime);
    }

    switch (strategy.type) {
      case 'best':
        return this.selectBest(responses, strategy.options, startTime);
      case 'consensus':
        return this.buildConsensus(responses, strategy.options, startTime);
      case 'synthesis':
        return this.synthesize(responses, strategy.options, startTime);
      case 'weighted':
        return this.weightedMerge(responses, strategy.options, startTime);
      case 'chain':
        return this.chainResponses(responses, strategy.options, startTime);
      default:
        return this.selectBest(responses, strategy.options, startTime);
    }
  }

  private singleResponse(response: ModelResponse, startTime: number): MergedResult {
    return {
      content: response.content,
      sources: [
        {
          modelId: response.modelId,
          contribution: 1.0,
          selected: true,
        },
      ],
      strategy: 'best',
      totalTokens: response.tokensUsed,
      processingTimeMs: Date.now() - startTime,
      confidence: response.confidence || 0.9,
    };
  }

  private selectBest(
    responses: ModelResponse[],
    options: MergeStrategy['options'],
    startTime: number
  ): MergedResult {
    let selected: ModelResponse;

    if (options?.preferredModel) {
      const preferred = responses.find((r) => r.modelId === options.preferredModel);
      selected = preferred || responses[0];
    } else {
      // Select based on confidence or latency
      selected = responses.reduce((best, current) => {
        const bestScore = (best.confidence || 0.8) / (best.latencyMs || 1000);
        const currentScore = (current.confidence || 0.8) / (current.latencyMs || 1000);
        return currentScore > bestScore ? current : best;
      });
    }

    return {
      content: selected.content,
      sources: responses.map((r) => ({
        modelId: r.modelId,
        contribution: r.modelId === selected.modelId ? 1.0 : 0.0,
        selected: r.modelId === selected.modelId,
      })),
      strategy: 'best',
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      processingTimeMs: Date.now() - startTime,
      confidence: selected.confidence || 0.85,
    };
  }

  private buildConsensus(
    responses: ModelResponse[],
    options: MergeStrategy['options'],
    startTime: number
  ): MergedResult {
    const threshold = options?.confidenceThreshold || 0.7;
    
    // Calculate similarity scores between all pairs of responses
    const similarityScores = responses.map((r1, i) => {
      let totalSimilarity = 0;
      for (let j = 0; j < responses.length; j++) {
        if (i !== j) {
          totalSimilarity += this.calculateTextSimilarity(r1.content, responses[j].content);
        }
      }
      return {
        response: r1,
        avgSimilarity: totalSimilarity / (responses.length - 1),
      };
    });

    // Select the response most similar to all others (highest consensus)
    similarityScores.sort((a, b) => b.avgSimilarity - a.avgSimilarity);
    const selected = similarityScores[0].response;
    const consensusConfidence = similarityScores[0].avgSimilarity;

    return {
      content: selected.content,
      sources: responses.map((r) => ({
        modelId: r.modelId,
        contribution: r.modelId === selected.modelId ? 0.8 : 0.2 / (responses.length - 1),
        selected: r.modelId === selected.modelId,
      })),
      strategy: 'consensus',
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      processingTimeMs: Date.now() - startTime,
      confidence: Math.max(threshold, consensusConfidence),
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Jaccard similarity on word tokens
    const words1Arr = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2Arr = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words1 = new Set(words1Arr);
    const words2 = new Set(words2Arr);
    
    const intersectionArr = words1Arr.filter(w => words2.has(w));
    const unionArr = [...words1Arr, ...words2Arr.filter(w => !words1.has(w))];
    
    if (unionArr.length === 0) return 0;
    return intersectionArr.length / unionArr.length;
  }

  private async synthesize(
    responses: ModelResponse[],
    options: MergeStrategy['options'],
    startTime: number
  ): Promise<MergedResult> {
    const synthesisModel = options?.synthesisModel || 'gpt-4o-mini';
    
    const synthesisPrompt = `You are an expert at synthesizing multiple AI responses into a single, comprehensive answer. Analyze the following responses and create a synthesized response that:
1. Combines the best and most accurate elements from each
2. Resolves any contradictions by choosing the most well-reasoned position
3. Maintains a coherent and natural flow
4. Preserves important details from all sources

${responses.map((r, i) => `=== Response ${i + 1} (${r.modelId}) ===\n${r.content}`).join('\n\n')}

=== Synthesized Response ===`;

    if (AI_SERVICE_URL) {
      try {
        const response = await withRetry(
          async () => {
            const res = await fetch(`${AI_SERVICE_URL}/v1/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(AI_SERVICE_API_KEY && { 'Authorization': `Bearer ${AI_SERVICE_API_KEY}` }),
              },
              body: JSON.stringify({
                model: synthesisModel,
                messages: [{ role: 'user', content: synthesisPrompt }],
                max_tokens: 4096,
                temperature: 0.3,
              }),
            });

            if (!res.ok && isRetryableHttpStatus(res.status)) {
              throw new Error(`Synthesis API error: ${res.status}`);
            }
            return res;
          },
          { maxAttempts: 3 }
        );

        if (response.ok) {
          const result = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { total_tokens?: number };
          };
          
          const synthesizedContent = result.choices?.[0]?.message?.content;
          if (synthesizedContent) {
            const synthesisTokens = result.usage?.total_tokens || 0;
            
            return {
              content: synthesizedContent,
              sources: responses.map((r) => ({
                modelId: r.modelId,
                contribution: 1.0 / responses.length,
                selected: true,
              })),
              strategy: 'synthesis',
              totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0) + synthesisTokens,
              processingTimeMs: Date.now() - startTime,
              confidence: 0.92,
            };
          }
        }
      } catch (error) {
        logger.error('Synthesis API call failed, falling back to best response', error instanceof Error ? error : undefined);
      }
    }

    // Fallback: select the response with highest confidence and longest content
    const fallback = responses.reduce((best, current) => {
      const bestScore = (best.confidence || 0.8) * Math.log(best.content.length + 1);
      const currentScore = (current.confidence || 0.8) * Math.log(current.content.length + 1);
      return currentScore > bestScore ? current : best;
    });

    return {
      content: fallback.content,
      sources: responses.map((r) => ({
        modelId: r.modelId,
        contribution: r.modelId === fallback.modelId ? 0.7 : 0.3 / (responses.length - 1),
        selected: r.modelId === fallback.modelId,
      })),
      strategy: 'synthesis',
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      processingTimeMs: Date.now() - startTime,
      confidence: 0.85,
    };
  }

  private weightedMerge(
    responses: ModelResponse[],
    options: MergeStrategy['options'],
    startTime: number
  ): MergedResult {
    const weights = options?.weights || {};
    
    // Calculate weighted scores
    const scoredResponses = responses.map((r) => ({
      response: r,
      weight: weights[r.modelId] || 1.0,
      score: (r.confidence || 0.8) * (weights[r.modelId] || 1.0),
    }));

    // Sort by score descending
    scoredResponses.sort((a, b) => b.score - a.score);
    const selected = scoredResponses[0].response;

    const totalWeight = scoredResponses.reduce((sum, s) => sum + s.weight, 0);

    return {
      content: selected.content,
      sources: scoredResponses.map((s) => ({
        modelId: s.response.modelId,
        contribution: s.weight / totalWeight,
        selected: s.response.modelId === selected.modelId,
      })),
      strategy: 'weighted',
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      processingTimeMs: Date.now() - startTime,
      confidence: scoredResponses[0].score / scoredResponses[0].weight,
    };
  }

  private chainResponses(
    responses: ModelResponse[],
    options: MergeStrategy['options'],
    startTime: number
  ): MergedResult {
    // Chain responses in order, building upon each other
    // The last response is considered the final refined answer
    const final = responses[responses.length - 1];

    return {
      content: final.content,
      sources: responses.map((r, i) => ({
        modelId: r.modelId,
        contribution: i === responses.length - 1 ? 0.6 : 0.4 / (responses.length - 1),
        selected: i === responses.length - 1,
      })),
      strategy: 'chain',
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      processingTimeMs: Date.now() - startTime,
      confidence: final.confidence || 0.85,
    };
  }

  async logMergeOperation(
    sessionId: string,
    result: MergedResult
  ): Promise<void> {
    const client = await getPoolClient();

    try {
      await client.query(
        `INSERT INTO result_merge_log 
         (tenant_id, session_id, strategy, sources, total_tokens, processing_time_ms, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          this.tenantId,
          sessionId,
          result.strategy,
          JSON.stringify(result.sources),
          result.totalTokens,
          result.processingTimeMs,
          result.confidence,
        ]
      );
    } finally {
      client.release();
    }
  }
}

export const createResultMergingService = (tenantId: string) =>
  new ResultMergingService(tenantId);
