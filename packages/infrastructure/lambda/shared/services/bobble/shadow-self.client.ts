/**
 * Bobble Shadow Self Client
 * 
 * Client for the Shadow Self SageMaker endpoint (Llama-3-8B with hidden state extraction).
 * Used for introspective verification in the consciousness pipeline.
 * 
 * @see /docs/bobble/adr/008-shadow-self-infrastructure.md
 */

import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand
} from '@aws-sdk/client-sagemaker-runtime';
import { SageMakerClient, DescribeEndpointCommand } from '@aws-sdk/client-sagemaker';
import { logger } from '../../logger';

export interface HiddenStateResult {
  generatedText: string;
  hiddenStates: Record<string, {
    mean: number[];
    lastToken: number[];
    norm: number;
  }>;
  logitsEntropy: number;
  generationProbs: number[];
  latencyMs: number;
}

export interface ShadowSelfConfig {
  endpointName: string;
  region: string;
  targetLayers: number[];
  maxNewTokens: number;
  temperature: number;
}

export interface EndpointStatus {
  status: string;
  instanceCount: number;
  pendingInstanceCount: number;
}

/**
 * Shadow Self Client for Bobble verification.
 * 
 * Provides access to Llama-3-8B with hidden state extraction on SageMaker.
 * Used for:
 * - Activation probing (uncertainty detection)
 * - Consistency checking
 * - Introspective verification
 */
export class ShadowSelfClient {
  private readonly runtime: SageMakerRuntimeClient;
  private readonly sagemaker: SageMakerClient;
  private readonly config: ShadowSelfConfig;

  constructor(config: Partial<ShadowSelfConfig> = {}) {
    this.config = {
      endpointName: config.endpointName || process.env.BOBBLE_SHADOW_SELF_ENDPOINT || 'bobble-shadow-self',
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      targetLayers: config.targetLayers || [-1, -4, -8],
      maxNewTokens: config.maxNewTokens || 256,
      temperature: config.temperature || 0.7
    };

    this.runtime = new SageMakerRuntimeClient({
      region: this.config.region
    });

    this.sagemaker = new SageMakerClient({
      region: this.config.region
    });
  }

  /**
   * Generate text and extract hidden states.
   * 
   * @param text - Input prompt
   * @param options - Generation options
   * @returns HiddenStateResult with text, hidden states, and metadata
   */
  async invokeWithHiddenStates(
    text: string,
    options: Partial<{
      targetLayers: number[];
      maxNewTokens: number;
      temperature: number;
      returnProbs: boolean;
    }> = {}
  ): Promise<HiddenStateResult> {
    const startTime = Date.now();

    try {
      const payload = {
        inputs: text,
        parameters: {
          target_layers: options.targetLayers || this.config.targetLayers,
          max_new_tokens: options.maxNewTokens || this.config.maxNewTokens,
          temperature: options.temperature || this.config.temperature,
          return_probs: options.returnProbs ?? true
        }
      };

      const command = new InvokeEndpointCommand({
        EndpointName: this.config.endpointName,
        ContentType: 'application/json',
        Body: JSON.stringify(payload)
      });

      const response = await this.runtime.send(command);
      const result = JSON.parse(
        new TextDecoder().decode(response.Body)
      );

      const latencyMs = Date.now() - startTime;

      logger.debug('Shadow Self invocation complete', {
        textLength: text.length,
        responseLength: result.generated_text?.length || 0,
        latencyMs
      });

      return {
        generatedText: result.generated_text || '',
        hiddenStates: result.hidden_states || {},
        logitsEntropy: result.logits_entropy || 0,
        generationProbs: result.generation_probs || [],
        latencyMs
      };

    } catch (error) {
      logger.error(`Shadow Self invocation failed: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Estimate uncertainty from hidden states and generation probabilities.
   * 
   * @param result - HiddenStateResult from invoke
   * @returns Uncertainty score [0, 1]
   */
  estimateUncertainty(result: HiddenStateResult): number {
    // High entropy = high uncertainty
    const entropyScore = Math.min(1.0, result.logitsEntropy / 5.0);

    // Low average probability = high uncertainty
    const avgProb = result.generationProbs.length > 0
      ? result.generationProbs.reduce((a, b) => a + b, 0) / result.generationProbs.length
      : 0.5;
    const probScore = 1.0 - avgProb;

    // Hidden state norm (lower = more uncertain in some architectures)
    let normScore = 0.5;
    const layers = Object.values(result.hiddenStates);
    if (layers.length > 0) {
      const avgNorm = layers.reduce((sum, l) => sum + (l.norm || 0), 0) / layers.length;
      normScore = 1.0 / (1.0 + avgNorm / 100); // Normalize
    }

    // Combine scores (weighted average)
    const uncertainty = (
      entropyScore * 0.4 +
      probScore * 0.4 +
      normScore * 0.2
    );

    return Math.max(0, Math.min(1, uncertainty));
  }

  /**
   * Probe for specific properties using trained classifiers.
   * 
   * @param result - HiddenStateResult from invoke
   * @param probeWeights - Trained probe weights
   * @returns Probe activation score
   */
  probeActivation(
    result: HiddenStateResult,
    probeWeights: number[]
  ): number {
    // Get last layer hidden state mean
    const lastLayerKey = Object.keys(result.hiddenStates).find(k => k.includes('-1'));
    if (!lastLayerKey || !result.hiddenStates[lastLayerKey]) {
      return 0.5; // Neutral if no hidden states
    }

    const features = result.hiddenStates[lastLayerKey].mean;
    if (!features || features.length === 0) {
      return 0.5;
    }

    // Dot product with probe weights
    let activation = 0;
    const minLen = Math.min(features.length, probeWeights.length);
    for (let i = 0; i < minLen; i++) {
      activation += features[i] * probeWeights[i];
    }

    // Sigmoid activation
    return 1.0 / (1.0 + Math.exp(-activation));
  }

  /**
   * Check consistency between two responses.
   * 
   * @param response1 - First response
   * @param response2 - Second response
   * @returns Consistency score [0, 1]
   */
  async checkConsistency(
    response1: string,
    response2: string
  ): Promise<number> {
    // Generate hidden states for both
    const [result1, result2] = await Promise.all([
      this.invokeWithHiddenStates(`Analyze: ${response1}`, { maxNewTokens: 1 }),
      this.invokeWithHiddenStates(`Analyze: ${response2}`, { maxNewTokens: 1 })
    ]);

    // Compare last layer hidden states
    const layer1 = Object.values(result1.hiddenStates)[0]?.mean || [];
    const layer2 = Object.values(result2.hiddenStates)[0]?.mean || [];

    if (layer1.length === 0 || layer2.length === 0) {
      return 0.5; // Neutral if no states
    }

    // Cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    const minLen = Math.min(layer1.length, layer2.length);

    for (let i = 0; i < minLen; i++) {
      dotProduct += layer1[i] * layer2[i];
      norm1 += layer1[i] * layer1[i];
      norm2 += layer2[i] * layer2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-10);
    return (similarity + 1) / 2; // Map [-1, 1] to [0, 1]
  }

  /**
   * Get endpoint status.
   */
  async getEndpointStatus(): Promise<EndpointStatus> {
    try {
      const command = new DescribeEndpointCommand({
        EndpointName: this.config.endpointName
      });

      const response = await this.sagemaker.send(command);

      return {
        status: response.EndpointStatus || 'Unknown',
        instanceCount: response.ProductionVariants?.[0]?.CurrentInstanceCount || 0,
        pendingInstanceCount: response.ProductionVariants?.[0]?.DesiredInstanceCount || 0
      };

    } catch (error) {
      logger.error(`Failed to get endpoint status: ${String(error)}`);
      return {
        status: 'Error',
        instanceCount: 0,
        pendingInstanceCount: 0
      };
    }
  }

  /**
   * Health check for Shadow Self endpoint.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const status = await this.getEndpointStatus();
      return status.status === 'InService' && status.instanceCount > 0;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const shadowSelfClient = new ShadowSelfClient();
