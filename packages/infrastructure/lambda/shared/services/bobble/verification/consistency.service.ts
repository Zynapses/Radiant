/**
 * Self-Consistency Service
 * 
 * Phase 3 of verification pipeline: Multi-sample consistency verification.
 * Uses Chain of Verification (CoVe) and Reflexion patterns.
 */

import { logger } from '../../../logger';
import { ModelRouterService } from '../../model-router.service';

export interface ConsistencyResult {
  agreementScore: number;
  samples: string[];
  clusters: number;
  majorityResponse: string;
  confidenceFromConsistency: number;
  method: string;
}

export interface ConsistencyConfig {
  numSamples: number;
  temperatureVariation: number[];
  similarityThreshold: number;
  useCoVe: boolean;
}

const DEFAULT_CONFIG: ConsistencyConfig = {
  numSamples: 5,
  temperatureVariation: [0.3, 0.5, 0.7, 0.9, 1.1],
  similarityThreshold: 0.7,
  useCoVe: true,
};

export class SelfConsistencyService {
  private config: ConsistencyConfig;
  private tenantId: string;

  constructor(tenantId: string, config?: Partial<ConsistencyConfig>) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check consistency across multiple introspection samples
   */
  async checkConsistency(params: {
    introspectionPrompt: string;
    context?: string;
    numSamples?: number;
  }): Promise<ConsistencyResult> {
    const { introspectionPrompt, context = '', numSamples = this.config.numSamples } = params;

    try {
      // Generate multiple samples with temperature variation
      const samples = await this.generateSamples(introspectionPrompt, context, numSamples);

      // Compute pairwise similarities
      const similarities = this.computePairwiseSimilarities(samples);

      // Cluster samples by semantic similarity
      const clusters = this.clusterSamples(samples, similarities);

      // Find majority cluster
      const majorityCluster = this.findMajorityCluster(clusters);
      const majorityResponse = majorityCluster[0] || samples[0];

      // Calculate agreement score
      const agreementScore = majorityCluster.length / samples.length;

      // Apply CoVe if enabled
      let finalAgreement = agreementScore;
      if (this.config.useCoVe && agreementScore < 0.9) {
        finalAgreement = await this.applyChainOfVerification(
          majorityResponse,
          samples,
          introspectionPrompt
        );
      }

      // Convert agreement to confidence
      const confidenceFromConsistency = this.agreementToConfidence(finalAgreement);

      logger.info('Consistency check complete', {
        tenantId: this.tenantId,
        numSamples: samples.length,
        clusters: clusters.length,
        agreementScore: finalAgreement,
        confidenceFromConsistency,
      });

      return {
        agreementScore: finalAgreement,
        samples,
        clusters: clusters.length,
        majorityResponse,
        confidenceFromConsistency,
        method: this.config.useCoVe ? 'multi_sample_cove' : 'multi_sample',
      };
    } catch (error) {
      logger.error(`Consistency check failed: ${String(error)}`);
      return {
        agreementScore: 0.5,
        samples: [],
        clusters: 1,
        majorityResponse: '',
        confidenceFromConsistency: 0.5,
        method: 'fallback',
      };
    }
  }

  /**
   * Generate multiple samples with temperature variation
   */
  private async generateSamples(
    prompt: string,
    context: string,
    numSamples: number
  ): Promise<string[]> {
    const samples: string[] = [];
    const temperatures = this.config.temperatureVariation.slice(0, numSamples);

    // Generate samples in parallel
    const promises = temperatures.map(async (temp, idx) => {
      try {
        const modelRouter = new ModelRouterService();
        const response = await modelRouter.invoke({
          modelId: 'anthropic/claude-3-haiku',
          messages: [{ role: 'user', content: `${context}\n\n${prompt}\n\nProvide a brief, direct introspective response.` }],
          systemPrompt: 'You are examining your own cognitive state. Be concise and honest.',
          temperature: temp,
          maxTokens: 200,
        });
        return response.content;
      } catch (error) {
        logger.warn(`Sample ${idx} generation failed: ${String(error)}`);
        return null;
      }
    });

    const results = await Promise.all(promises);
    for (const result of results) {
      if (result) samples.push(result);
    }

    return samples;
  }

  /**
   * Compute pairwise semantic similarities using simple word overlap
   */
  private computePairwiseSimilarities(samples: string[]): number[][] {
    const n = samples.length;
    const similarities: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          similarities[i][j] = 1.0;
        } else {
          const sim = this.computeJaccardSimilarity(samples[i], samples[j]);
          similarities[i][j] = sim;
          similarities[j][i] = sim;
        }
      }
    }

    return similarities;
  }

  /**
   * Compute Jaccard similarity between two texts
   */
  private computeJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    if (words1.size === 0 && words2.size === 0) return 1.0;
    if (words1.size === 0 || words2.size === 0) return 0.0;

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Cluster samples by similarity
   */
  private clusterSamples(samples: string[], similarities: number[][]): string[][] {
    const n = samples.length;
    const assigned = new Set<number>();
    const clusters: string[][] = [];

    for (let i = 0; i < n; i++) {
      if (assigned.has(i)) continue;

      const cluster: string[] = [samples[i]];
      assigned.add(i);

      for (let j = i + 1; j < n; j++) {
        if (!assigned.has(j) && similarities[i][j] >= this.config.similarityThreshold) {
          cluster.push(samples[j]);
          assigned.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters.sort((a, b) => b.length - a.length);
  }

  /**
   * Find the majority cluster
   */
  private findMajorityCluster(clusters: string[][]): string[] {
    if (clusters.length === 0) return [];
    return clusters[0]; // Already sorted by size
  }

  /**
   * Apply Chain of Verification (CoVe)
   */
  private async applyChainOfVerification(
    majorityResponse: string,
    allSamples: string[],
    originalPrompt: string
  ): Promise<number> {
    try {
      // Generate verification questions
      const verificationPrompt = `
Original introspection prompt: ${originalPrompt}

Majority response: ${majorityResponse}

Other responses:
${allSamples.filter(s => s !== majorityResponse).slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n')}

As Bobble, verify: Is the majority response accurate? Rate agreement 0-1.
Respond with just a number.
`;

      const modelRouter = new ModelRouterService();
      const response = await modelRouter.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: verificationPrompt }],
        systemPrompt: 'You are verifying introspective consistency. Output only a number 0-1.',
        temperature: 0.1,
        maxTokens: 10,
      });

      const rating = parseFloat(response.content);
      if (!isNaN(rating) && rating >= 0 && rating <= 1) {
        return rating;
      }
    } catch (error) {
      logger.warn(`CoVe verification failed: ${String(error)}`);
    }

    // Fallback to original agreement
    return allSamples.filter(s => s === majorityResponse).length / allSamples.length;
  }

  /**
   * Convert agreement score to confidence
   */
  private agreementToConfidence(agreement: number): number {
    // Non-linear mapping: low agreement = very low confidence
    if (agreement >= 0.9) return 0.95;
    if (agreement >= 0.8) return 0.85;
    if (agreement >= 0.7) return 0.75;
    if (agreement >= 0.6) return 0.60;
    if (agreement >= 0.5) return 0.45;
    return 0.30;
  }
}
