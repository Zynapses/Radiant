/**
 * Bobble NLI Scorer Service
 * 
 * Uses Natural Language Inference (DeBERTa-large-MNLI) for surprise measurement.
 * Replaces cosine similarity which cannot detect negation.
 * 
 * @see /docs/bobble/adr/004-nli-entailment.md
 */

import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand
} from '@aws-sdk/client-sagemaker-runtime';
import { logger } from '../../logger';

export type NLILabel = 'entailment' | 'neutral' | 'contradiction';

export interface NLIResult {
  label: NLILabel;
  scores: {
    entailment: number;
    neutral: number;
    contradiction: number;
  };
  confidence: number;
  surprise: number;
  latencyMs: number;
}

export interface NLIConfig {
  endpointName: string;
  region: string;
  targetModel: string;
}

/**
 * NLI Scorer Service for Bobble verification.
 * 
 * Uses DeBERTa-large-MNLI to classify the relationship between
 * predictions and outcomes, enabling proper surprise measurement
 * that can detect negation (unlike cosine similarity).
 * 
 * Surprise scores:
 * - ENTAILMENT = 0.0 (expected outcome)
 * - NEUTRAL = 0.5 (uncertain)
 * - CONTRADICTION = 1.0 (surprising)
 */
export class NLIScorerService {
  private readonly runtime: SageMakerRuntimeClient;
  private readonly config: NLIConfig;

  constructor(config: Partial<NLIConfig> = {}) {
    this.config = {
      endpointName: config.endpointName || process.env.BOBBLE_NLI_ENDPOINT || 'bobble-nli-mme',
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      targetModel: config.targetModel || 'deberta-large-mnli.tar.gz'
    };

    this.runtime = new SageMakerRuntimeClient({
      region: this.config.region
    });
  }

  /**
   * Classify the relationship between premise and hypothesis.
   * 
   * @param premise - The reference text (e.g., prediction)
   * @param hypothesis - The text to compare (e.g., actual outcome)
   * @returns NLIResult with label, scores, and surprise value
   */
  async classify(
    premise: string,
    hypothesis: string
  ): Promise<NLIResult> {
    const startTime = Date.now();

    try {
      const payload = {
        inputs: {
          premise,
          hypothesis
        }
      };

      const command = new InvokeEndpointCommand({
        EndpointName: this.config.endpointName,
        ContentType: 'application/json',
        Body: JSON.stringify(payload),
        TargetModel: this.config.targetModel
      });

      const response = await this.runtime.send(command);
      const result = JSON.parse(
        new TextDecoder().decode(response.Body)
      );

      const latencyMs = Date.now() - startTime;

      // Parse scores from model output
      const scores = this.parseScores(result);

      // Determine label (highest scoring)
      const label = this.getLabel(scores);
      const confidence = scores[label];

      // Calculate surprise score
      const surprise = this.calculateSurprise(label, confidence);

      logger.debug('NLI classification complete', {
        label,
        confidence,
        surprise,
        latencyMs
      });

      return {
        label,
        scores,
        confidence,
        surprise,
        latencyMs
      };

    } catch (error) {
      logger.error(`NLI classification failed: ${String(error)}`);

      // Return neutral result on error
      return {
        label: 'neutral',
        scores: { entailment: 0.33, neutral: 0.34, contradiction: 0.33 },
        confidence: 0.34,
        surprise: 0.5,
        latencyMs: Date.now() - startTime
      };
    }
  }

  /**
   * Batch classify multiple premise-hypothesis pairs.
   * 
   * @param pairs - Array of [premise, hypothesis] pairs
   * @returns Array of NLIResults
   */
  async classifyBatch(
    pairs: Array<[string, string]>
  ): Promise<NLIResult[]> {
    // Process in parallel with concurrency limit
    const concurrencyLimit = 10;
    const results: NLIResult[] = [];

    for (let i = 0; i < pairs.length; i += concurrencyLimit) {
      const batch = pairs.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(([premise, hypothesis]) => this.classify(premise, hypothesis))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Check if two statements are consistent (entailment or neutral).
   */
  async isConsistent(
    statement1: string,
    statement2: string
  ): Promise<boolean> {
    const result = await this.classify(statement1, statement2);
    return result.label !== 'contradiction';
  }

  /**
   * Check if outcome contradicts prediction (high surprise).
   */
  async isContradiction(
    prediction: string,
    outcome: string
  ): Promise<boolean> {
    const result = await this.classify(prediction, outcome);
    return result.label === 'contradiction';
  }

  /**
   * Calculate information gain from prediction vs outcome.
   * Higher surprise = more learning potential.
   */
  async calculateInformationGain(
    prediction: string,
    outcome: string,
    confidence: number = 0.5
  ): Promise<number> {
    const result = await this.classify(prediction, outcome);

    // Information gain is higher when:
    // 1. Surprise is high (contradiction or unexpected neutral)
    // 2. Initial confidence was high (confident prediction was wrong)
    const surpriseFactor = result.surprise;
    const confidenceFactor = confidence; // High confidence + wrong = more info

    return surpriseFactor * confidenceFactor;
  }

  /**
   * Parse scores from model output.
   */
  private parseScores(result: unknown): { entailment: number; neutral: number; contradiction: number } {
    // Handle different model output formats
    if (Array.isArray(result)) {
      // [entailment, neutral, contradiction] format
      return {
        entailment: result[0] ?? 0.33,
        neutral: result[1] ?? 0.34,
        contradiction: result[2] ?? 0.33
      };
    }

    if (typeof result === 'object' && result !== null) {
      const obj = result as Record<string, unknown>;

      // {scores: [...]} format
      if (Array.isArray(obj.scores)) {
        return {
          entailment: (obj.scores as number[])[0] ?? 0.33,
          neutral: (obj.scores as number[])[1] ?? 0.34,
          contradiction: (obj.scores as number[])[2] ?? 0.33
        };
      }

      // {entailment: x, neutral: y, contradiction: z} format
      if ('entailment' in obj) {
        return {
          entailment: obj.entailment as number ?? 0.33,
          neutral: obj.neutral as number ?? 0.34,
          contradiction: obj.contradiction as number ?? 0.33
        };
      }

      // {label: 'ENTAILMENT', score: 0.95} format
      if ('label' in obj && 'score' in obj) {
        const label = (obj.label as string).toLowerCase() as NLILabel;
        const score = obj.score as number;
        const remaining = (1 - score) / 2;
        return {
          entailment: label === 'entailment' ? score : remaining,
          neutral: label === 'neutral' ? score : remaining,
          contradiction: label === 'contradiction' ? score : remaining
        };
      }
    }

    // Default: uniform distribution
    return { entailment: 0.33, neutral: 0.34, contradiction: 0.33 };
  }

  /**
   * Get the label with highest score.
   */
  private getLabel(scores: { entailment: number; neutral: number; contradiction: number }): NLILabel {
    if (scores.entailment >= scores.neutral && scores.entailment >= scores.contradiction) {
      return 'entailment';
    }
    if (scores.contradiction >= scores.neutral) {
      return 'contradiction';
    }
    return 'neutral';
  }

  /**
   * Calculate surprise score from NLI label and confidence.
   * 
   * - ENTAILMENT (expected) = 0.0
   * - NEUTRAL (uncertain) = 0.5
   * - CONTRADICTION (surprising) = 1.0
   * 
   * Weighted by confidence for smoother gradients.
   */
  private calculateSurprise(label: NLILabel, confidence: number): number {
    let baseSurprise: number;

    switch (label) {
      case 'entailment':
        baseSurprise = 0.0;
        break;
      case 'neutral':
        baseSurprise = 0.5;
        break;
      case 'contradiction':
        baseSurprise = 1.0;
        break;
    }

    // Weight by confidence: high confidence = stronger signal
    // Low confidence = closer to neutral (0.5)
    return baseSurprise * confidence + 0.5 * (1 - confidence);
  }
}

// Export singleton instance
export const nliScorerService = new NLIScorerService();
