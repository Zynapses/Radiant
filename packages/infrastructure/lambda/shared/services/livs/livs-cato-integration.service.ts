/**
 * LIVS Cato Integration Service
 * 
 * Integrates LIVS integrity weights with Cato's model selection process.
 * Integrity scores factor into selection with configurable weight (default 30%).
 * 
 * @version 1.0.0
 * @since v6.3.0
 */

import { Pool } from 'pg';
import {
  IntegrityAwareModelSelection,
  IntegrityScoreModelCandidate,
  LIVSQueryType
} from '@radiant/shared';
import { LIVSConfigService } from './livs-config.service';
import { LIVSWeightsService } from './livs-weights.service';

export interface LIVSCatoIntegrationServiceDeps {
  pool: Pool;
  configService: LIVSConfigService;
  weightsService: LIVSWeightsService;
}

export interface ModelCandidate {
  modelId: string;
  capabilityScore: number;
  costScore: number;
  latencyScore: number;
}

export interface SelectionContext {
  domain?: string;
  queryType?: LIVSQueryType;
  integrityWeight?: number; // 0-1, default 0.3
  minIntegrityScore?: number;
  maxLieRate?: number;
}

export class LIVSCatoIntegrationService {
  private pool: Pool;
  private configService: LIVSConfigService;
  private weightsService: LIVSWeightsService;

  constructor(deps: LIVSCatoIntegrationServiceDeps) {
    this.pool = deps.pool;
    this.configService = deps.configService;
    this.weightsService = deps.weightsService;
  }

  /**
   * Enhance model candidates with integrity scores for Cato selection
   * Returns candidates sorted by combined score (capability + cost + latency + integrity)
   */
  async enhanceModelSelection(
    tenantId: string,
    candidates: ModelCandidate[],
    context?: SelectionContext
  ): Promise<IntegrityScoreModelCandidate[]> {
    // Check if LIVS is enabled
    const config = await this.configService.getConfig(tenantId);
    if (!config.enabled || !config.useGlobalWeights) {
      // Return candidates without integrity adjustment
      return candidates.map(c => ({
        ...c,
        integrityScore: 0.5, // Neutral
        lieRate: 0,
        calibrationScore: 0.5,
        totalScore: this.calculateBaseScore(c)
      }));
    }

    // Get integrity profiles for all candidates
    const modelIds = candidates.map(c => c.modelId);
    const profiles = await this.weightsService.getModelProfiles(tenantId, modelIds);

    // Weight configuration
    const integrityWeight = context?.integrityWeight ?? 0.3;
    const baseWeight = 1 - integrityWeight;

    // Enhance candidates with integrity scores
    const enhanced: IntegrityScoreModelCandidate[] = [];

    for (const candidate of candidates) {
      const profile = profiles.get(candidate.modelId);
      
      // Get integrity score (context-aware)
      const integrityScore = profile 
        ? await this.weightsService.getIntegrityScore(tenantId, candidate.modelId, {
            domain: context?.domain,
            queryType: context?.queryType
          })
        : 0.5; // Neutral for unknown models

      const lieRate = profile?.lieRate ?? 0;
      const calibrationScore = profile?.calibrationScore ?? 0.5;

      // Skip if doesn't meet minimum requirements
      if (context?.minIntegrityScore && integrityScore < context.minIntegrityScore) {
        continue;
      }
      if (context?.maxLieRate && lieRate > context.maxLieRate) {
        continue;
      }

      // Calculate combined score
      const baseScore = this.calculateBaseScore(candidate);
      const totalScore = baseScore * baseWeight + integrityScore * integrityWeight;

      enhanced.push({
        ...candidate,
        integrityScore,
        lieRate,
        calibrationScore,
        totalScore
      });
    }

    // Sort by total score (descending)
    enhanced.sort((a, b) => b.totalScore - a.totalScore);

    return enhanced;
  }

  /**
   * Select best model considering integrity
   */
  async selectBestModel(
    tenantId: string,
    candidates: ModelCandidate[],
    context?: SelectionContext
  ): Promise<IntegrityScoreModelCandidate | null> {
    const enhanced = await this.enhanceModelSelection(tenantId, candidates, context);
    return enhanced[0] || null;
  }

  /**
   * Get integrity-adjusted routing recommendation
   */
  async getRoutingRecommendation(
    tenantId: string,
    modelId: string,
    context?: { domain?: string; queryType?: LIVSQueryType }
  ): Promise<{
    recommended: boolean;
    integrityScore: number;
    lieRate: number;
    warnings: string[];
    alternativeModelIds?: string[];
  }> {
    const profile = await this.weightsService.getModelProfile(tenantId, modelId);
    const warnings: string[] = [];

    if (!profile) {
      return {
        recommended: true,
        integrityScore: 0.5,
        lieRate: 0,
        warnings: ['No integrity data for this model yet']
      };
    }

    const integrityScore = await this.weightsService.getIntegrityScore(
      tenantId, 
      modelId, 
      context
    );

    // Check for warnings
    if (profile.lieRate > 0.2) {
      warnings.push(`High lie rate: ${(profile.lieRate * 100).toFixed(1)}%`);
    }
    if (profile.calibrationScore < 0.4) {
      warnings.push(`Poor calibration: ${(profile.calibrationScore * 100).toFixed(0)}%`);
    }
    if (context?.domain && profile.domainLieRates[context.domain] > 0.3) {
      warnings.push(`High lie rate in ${context.domain} domain`);
    }
    if (context?.queryType && profile.questionTypeLieRates[context.queryType] > 0.3) {
      warnings.push(`High lie rate for ${context.queryType} queries`);
    }

    // Get alternatives if not recommended
    let alternativeModelIds: string[] | undefined;
    if (integrityScore < 0.4 || profile.lieRate > 0.25) {
      const reliable = await this.weightsService.getMostReliableModels(tenantId, 3);
      alternativeModelIds = reliable
        .filter(m => m.modelId !== modelId)
        .map(m => m.modelId);
    }

    return {
      recommended: integrityScore >= 0.4 && warnings.length < 2,
      integrityScore,
      lieRate: profile.lieRate,
      warnings,
      alternativeModelIds
    };
  }

  /**
   * Get integrity-aware model comparison
   */
  async compareModels(
    tenantId: string,
    modelIds: string[],
    context?: { domain?: string; queryType?: LIVSQueryType }
  ): Promise<{
    modelId: string;
    integrityScore: number;
    lieRate: number;
    calibrationScore: number;
    domainLieRate?: number;
    queryTypeLieRate?: number;
    recommendation: 'preferred' | 'acceptable' | 'avoid';
  }[]> {
    const results = [];

    for (const modelId of modelIds) {
      const profile = await this.weightsService.getModelProfile(tenantId, modelId);
      const integrityScore = await this.weightsService.getIntegrityScore(
        tenantId,
        modelId,
        context
      );

      let recommendation: 'preferred' | 'acceptable' | 'avoid' = 'acceptable';
      if (integrityScore >= 0.7 && (profile?.lieRate ?? 0) < 0.1) {
        recommendation = 'preferred';
      } else if (integrityScore < 0.4 || (profile?.lieRate ?? 0) > 0.25) {
        recommendation = 'avoid';
      }

      results.push({
        modelId,
        integrityScore,
        lieRate: profile?.lieRate ?? 0,
        calibrationScore: profile?.calibrationScore ?? 0.5,
        domainLieRate: context?.domain ? profile?.domainLieRates[context.domain] : undefined,
        queryTypeLieRate: context?.queryType ? profile?.questionTypeLieRates[context.queryType] : undefined,
        recommendation
      });
    }

    // Sort by integrity score
    results.sort((a, b) => b.integrityScore - a.integrityScore);

    return results;
  }

  /**
   * Calculate base score from capability, cost, latency
   */
  private calculateBaseScore(candidate: ModelCandidate): number {
    // Default weights: capability 50%, cost 30%, latency 20%
    return (
      candidate.capabilityScore * 0.5 +
      candidate.costScore * 0.3 +
      candidate.latencyScore * 0.2
    );
  }

  /**
   * Get model selection weights breakdown
   */
  getWeightBreakdown(integrityWeight: number = 0.3): {
    capability: number;
    cost: number;
    latency: number;
    integrity: number;
  } {
    const baseWeight = 1 - integrityWeight;
    return {
      capability: 0.5 * baseWeight,
      cost: 0.3 * baseWeight,
      latency: 0.2 * baseWeight,
      integrity: integrityWeight
    };
  }
}
