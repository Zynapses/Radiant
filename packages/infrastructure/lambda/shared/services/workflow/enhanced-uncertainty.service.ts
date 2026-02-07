/**
 * Enhanced Uncertainty Service
 * RADIANT v5.53.0
 * 
 * Implements Gemini's "Surprise Metric" recommendation by ENHANCING Semantic Entropy,
 * NOT creating a parallel system.
 * 
 * MITIGATION: Active Inference / Free Energy is still academic. Instead, we:
 * 1. Add "surprise" as a component within existing Semantic Entropy
 * 2. Use cross-entropy between samples as surprise proxy
 * 3. Trigger System 2 reflexion when surprise exceeds threshold
 * 4. All integrated into existing UEP envelopes
 */

import { v4 as uuidv4 } from 'uuid';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'workflow/enhanced-uncertainty',
  category: 'infrastructure',
  sourceType: 'application',
});
import { modelRouterService } from '../model-router.service';

// =============================================================================
// Types
// =============================================================================

export interface UncertaintyMetrics {
  semanticEntropy: number;
  surpriseScore: number;
  confidenceInterval: [number, number];
  clusterCount: number;
  dominantClusterRatio: number;
  sampleAgreement: number;
  triggerReflexion: boolean;
  reflexionReason?: string;
}

export interface EnhancedEntropyResult {
  response: string;
  uncertainty: UncertaintyMetrics;
  samples: Array<{ content: string; clusterId: number; localSurprise: number }>;
  processingTimeMs: number;
  tokensUsed: number;
}

export interface EntropyParams {
  sampleCount?: number;
  temperature?: number;
  clusteringMethod?: 'nli' | 'exact' | 'embedding';
  surpriseThreshold?: number;
  reflexionThreshold?: number;
}

// =============================================================================
// Enhanced Uncertainty Service
// =============================================================================

class EnhancedUncertaintyService {
  private readonly DEFAULT_SAMPLE_COUNT = 5;
  private readonly DEFAULT_TEMPERATURE = 0.7;
  private readonly DEFAULT_SURPRISE_THRESHOLD = 0.7;
  private readonly DEFAULT_REFLEXION_THRESHOLD = 0.8;
  
  async computeEnhancedEntropy(
    prompt: string,
    params: EntropyParams = {},
    tenantId?: string
  ): Promise<EnhancedEntropyResult> {
    const startTime = Date.now();
    const sampleCount = params.sampleCount ?? this.DEFAULT_SAMPLE_COUNT;
    const temperature = params.temperature ?? this.DEFAULT_TEMPERATURE;
    const surpriseThreshold = params.surpriseThreshold ?? this.DEFAULT_SURPRISE_THRESHOLD;
    const reflexionThreshold = params.reflexionThreshold ?? this.DEFAULT_REFLEXION_THRESHOLD;
    
    let totalTokens = 0;
    
    // 1. Generate multiple samples
    const samples: Array<{ content: string; tokens: number }> = [];
    for (let i = 0; i < sampleCount; i++) {
      const result = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        maxTokens: 1024,
        tenantId,
      });
      samples.push({ content: result.content, tokens: result.inputTokens + result.outputTokens });
      totalTokens += result.inputTokens + result.outputTokens;
    }
    
    // 2. Cluster samples by semantic meaning
    const clusters = await this.clusterSamples(samples.map(s => s.content), params.clusteringMethod || 'nli');
    
    // 3. Compute semantic entropy: H = -Σ p(c) * log2(p(c))
    let entropy = 0;
    for (const cluster of clusters) {
      const p = cluster.length / sampleCount;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(clusters.length) || 1;
    const semanticEntropy = Math.min(1, entropy / maxEntropy);
    
    // 4. Compute surprise: cross-entropy between sample distributions
    const sampleSurprises = this.computeSampleSurprises(samples.map(s => s.content), clusters);
    const surpriseScore = sampleSurprises.reduce((a, b) => a + b, 0) / sampleSurprises.length;
    
    // 5. Calculate aggregate metrics
    const dominantClusterRatio = Math.max(...clusters.map(c => c.length)) / sampleCount;
    const sampleAgreement = dominantClusterRatio;
    const confidenceInterval: [number, number] = [
      Math.max(0, semanticEntropy - 0.15),
      Math.min(1, semanticEntropy + 0.15)
    ];
    
    // 6. Determine if reflexion should be triggered
    const combinedUncertainty = (semanticEntropy + surpriseScore) / 2;
    const triggerReflexion = combinedUncertainty > reflexionThreshold || surpriseScore > surpriseThreshold;
    
    let reflexionReason: string | undefined;
    if (triggerReflexion) {
      reflexionReason = surpriseScore > surpriseThreshold
        ? `High surprise (${(surpriseScore * 100).toFixed(0)}%) indicates unexpected outputs`
        : `Combined uncertainty (${(combinedUncertainty * 100).toFixed(0)}%) exceeds threshold`;
    }
    
    // 7. Select best response from largest cluster
    const largestCluster = clusters.sort((a, b) => b.length - a.length)[0];
    const bestResponse = largestCluster[0];
    
    // 8. Build annotated samples
    const annotatedSamples = samples.map((s, i) => ({
      content: s.content,
      clusterId: clusters.findIndex(c => c.includes(s.content)),
      localSurprise: sampleSurprises[i],
    }));
    
    return {
      response: bestResponse,
      uncertainty: {
        semanticEntropy,
        surpriseScore,
        confidenceInterval,
        clusterCount: clusters.length,
        dominantClusterRatio,
        sampleAgreement,
        triggerReflexion,
        reflexionReason,
      },
      samples: annotatedSamples,
      processingTimeMs: Date.now() - startTime,
      tokensUsed: totalTokens,
    };
  }
  
  async quickUncertaintyCheck(prompt: string): Promise<{ uncertain: boolean; score: number; shouldEscalate: boolean }> {
    const result = await this.computeEnhancedEntropy(prompt, {
      sampleCount: 3,
      temperature: 0.8,
      clusteringMethod: 'exact',
    });
    return {
      uncertain: result.uncertainty.semanticEntropy > 0.5,
      score: result.uncertainty.semanticEntropy,
      shouldEscalate: result.uncertainty.triggerReflexion,
    };
  }
  
  private async clusterSamples(samples: string[], method: 'nli' | 'exact' | 'embedding'): Promise<string[][]> {
    if (method === 'exact') {
      const clusterMap = new Map<string, string[]>();
      for (const sample of samples) {
        const key = sample.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 100);
        if (!clusterMap.has(key)) clusterMap.set(key, []);
        clusterMap.get(key)!.push(sample);
      }
      return Array.from(clusterMap.values());
    }
    
    // NLI-based clustering
    const clusters: string[][] = [];
    for (const sample of samples) {
      let foundCluster = false;
      for (const cluster of clusters) {
        if (await this.areSemanticlyEquivalent(sample, cluster[0])) {
          cluster.push(sample);
          foundCluster = true;
          break;
        }
      }
      if (!foundCluster) clusters.push([sample]);
    }
    return clusters;
  }
  
  private async areSemanticlyEquivalent(a: string, b: string, tenantId?: string): Promise<boolean> {
    const result = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-5-haiku-20241022',
      messages: [{
        role: 'user',
        content: `Do these two statements convey the same meaning? Answer only YES or NO.\nA: ${a.substring(0, 500)}\nB: ${b.substring(0, 500)}`,
      }],
      maxTokens: 10,
      temperature: 0,
      tenantId,
    });
    return result.content.toUpperCase().includes('YES');
  }
  
  private computeSampleSurprises(samples: string[], clusters: string[][]): number[] {
    // Surprise = how different is this sample from the dominant cluster?
    const dominantCluster = clusters.sort((a, b) => b.length - a.length)[0];
    const dominantContent = dominantCluster[0].toLowerCase();
    
    return samples.map(sample => {
      const sampleLower = sample.toLowerCase();
      // Simple Jaccard-based surprise
      const sampleWords = new Set(sampleLower.split(/\s+/));
      const dominantWords = new Set(dominantContent.split(/\s+/));
      const intersection = [...sampleWords].filter(w => dominantWords.has(w)).length;
      const union = new Set([...sampleWords, ...dominantWords]).size;
      const jaccard = union > 0 ? intersection / union : 0;
      return 1 - jaccard; // Surprise = 1 - similarity
    });
  }
}

export const enhancedUncertaintyService = new EnhancedUncertaintyService();
export default enhancedUncertaintyService;
