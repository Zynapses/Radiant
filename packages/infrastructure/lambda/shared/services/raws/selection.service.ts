/**
 * RAWS v1.1 - Selection Service
 * Main model selection with 8-dimension scoring and binary compliance
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Domain,
  SystemType,
  WeightProfileId,
  ScoringWeights,
  DimensionScores,
  ExternalModel,
  SelfHostedModel,
  Model,
  SelectionRequest,
  SelectionResult,
  ScoredModel,
  ThermalState,
  THERMAL_AVAILABILITY_SCORES,
  WEIGHT_PROFILES,
} from './types.js';
import { DomainDetectorService } from './domain-detector.service.js';
import { WeightProfileService } from './weight-profile.service.js';

// Selection timeout budget (ms)
const SELECTION_TIMEOUT_MS = 50;

// Latency score thresholds
const LATENCY_EXCELLENT_MS = 300;
const LATENCY_GOOD_MS = 800;
const LATENCY_ACCEPTABLE_MS = 2000;
const LATENCY_POOR_MS = 5000;

export class RAWSSelectionService {
  private domainDetector: DomainDetectorService;
  private weightProfiles: WeightProfileService;
  private externalModels: Map<string, ExternalModel> = new Map();
  private selfHostedModels: Map<string, SelfHostedModel> = new Map();
  private providerHealth: Map<string, boolean> = new Map();
  private learningScores: Map<string, number> = new Map(); // tenant:model -> score

  constructor(
    domainDetector?: DomainDetectorService,
    weightProfiles?: WeightProfileService
  ) {
    this.domainDetector = domainDetector || new DomainDetectorService();
    this.weightProfiles = weightProfiles || new WeightProfileService();
  }

  /**
   * Main selection entry point
   */
  async select(request: SelectionRequest): Promise<SelectionResult> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      // Phase 1: Context Resolution
      const { domain, domainConfidence } = this.resolveDomain(request);
      const systemType = this.resolveSystemType(request, domain);
      const { weights, profileId, profile } = this.weightProfiles.resolveWeights({
        weightProfileId: request.weightProfileId,
        optimizeFor: request.optimizeFor,
        domain,
        systemType,
      });

      // Phase 2: Filtering
      const candidates = this.filterCandidates(request, profile);

      if (candidates.length === 0) {
        throw new Error('No models match the specified requirements');
      }

      // Phase 3: Scoring
      const scored = await this.scoreModels(
        candidates,
        weights,
        request,
        domain
      );

      // Phase 4: Ranking & Selection
      const ranked = scored
        .filter(s => s.passesConstraints)
        .sort((a, b) => b.compositeScore - a.compositeScore);

      if (ranked.length === 0) {
        // Fall back to best scoring even if constraints violated
        ranked.push(...scored.sort((a, b) => b.compositeScore - a.compositeScore));
      }

      const selected = ranked[0];
      const fallbacks = ranked.slice(1, 4).map(s => s.model);

      const selectionLatencyMs = Date.now() - startTime;

      // Build result
      const result: SelectionResult = {
        selectedModel: selected.model,
        fallbackModels: fallbacks,
        compositeScore: selected.compositeScore,
        dimensionScores: selected.dimensionScores,
        appliedWeights: weights,
        resolvedDomain: domain,
        domainConfidence,
        resolvedProfile: profileId,
        resolvedSystemType: systemType,
        selectionLatencyMs,
        requestId,
        warnings: this.collectWarnings(selected, request, selectionLatencyMs),
      };

      // Add cost estimate if token counts provided
      if (request.estimatedInputTokens || request.estimatedOutputTokens) {
        result.estimatedCost = this.estimateCost(
          selected.model,
          request.estimatedInputTokens || 0,
          request.estimatedOutputTokens || 0
        );
      }

      return result;
    } catch (error) {
      const selectionLatencyMs = Date.now() - startTime;
      throw new Error(
        `RAWS selection failed after ${selectionLatencyMs}ms: ${(error as Error).message}`
      );
    }
  }

  /**
   * Load models (call during initialization)
   */
  loadModels(external: ExternalModel[], selfHosted: SelfHostedModel[]): void {
    this.externalModels.clear();
    this.selfHostedModels.clear();

    for (const model of external) {
      if (model.status === 'active') {
        this.externalModels.set(model.id, model);
      }
    }

    for (const model of selfHosted) {
      if (model.status === 'active') {
        this.selfHostedModels.set(model.id, model);
      }
    }
  }

  /**
   * Update provider health
   */
  updateProviderHealth(providerId: string, isHealthy: boolean): void {
    this.providerHealth.set(providerId, isHealthy);
  }

  /**
   * Update learning score for tenant+model
   */
  updateLearningScore(tenantId: string, modelId: string, score: number): void {
    this.learningScores.set(`${tenantId}:${modelId}`, score);
  }

  /**
   * Update thermal state for self-hosted model
   */
  updateThermalState(modelId: string, state: ThermalState): void {
    const model = this.selfHostedModels.get(modelId);
    if (model) {
      model.thermalState = state;
    }
  }

  // =====================================================
  // Phase 1: Context Resolution
  // =====================================================

  private resolveDomain(request: SelectionRequest): {
    domain: Domain;
    domainConfidence: number;
  } {
    // Explicit domain wins
    if (request.domain) {
      return { domain: request.domain, domainConfidence: 1.0 };
    }

    // Detect from content
    const detection = this.domainDetector.detectWithContext({
      text: request.prompt,
      taskType: request.taskType,
    });

    return {
      domain: detection.domain,
      domainConfidence: detection.confidence,
    };
  }

  private resolveSystemType(request: SelectionRequest, domain: Domain): SystemType {
    // Explicit system type
    if (request.systemType) {
      return request.systemType;
    }

    // Domain profile may force system type
    const domainProfile = WEIGHT_PROFILES[domain.toUpperCase() as WeightProfileId];
    if (domainProfile?.forcedSystemType) {
      return domainProfile.forcedSystemType;
    }

    // Default based on optimization preference
    if (request.optimizeFor === 'latency' || request.optimizeFor === 'cost') {
      return 'SYSTEM_1';
    }

    return 'SYSTEM_2';
  }

  // =====================================================
  // Phase 2: Filtering
  // =====================================================

  private filterCandidates(
    request: SelectionRequest,
    profile: ReturnType<WeightProfileService['getSystemProfile']>
  ): Model[] {
    const candidates: Model[] = [];

    // Filter external models
    for (const model of this.externalModels.values()) {
      if (this.passesBasicFilters(model, request, profile)) {
        candidates.push(model);
      }
    }

    // Filter self-hosted models (if thermal-aware enabled)
    if (request.enableThermalAware !== false) {
      for (const model of this.selfHostedModels.values()) {
        if (
          model.thermalState !== 'OFF' &&
          this.passesBasicFilters(model, request, profile)
        ) {
          candidates.push(model);
        }
      }
    }

    return candidates;
  }

  private passesBasicFilters(
    model: Model,
    request: SelectionRequest,
    profile: ReturnType<WeightProfileService['getSystemProfile']>
  ): boolean {
    // Provider exclusion
    if ('providerId' in model) {
      if (request.excludedProviders?.includes(model.providerId)) {
        return false;
      }
      if (
        request.preferredProviders?.length &&
        !request.preferredProviders.includes(model.providerId)
      ) {
        return false;
      }
      // Provider health check
      if (this.providerHealth.get(model.providerId) === false) {
        return false;
      }
    }

    // Model exclusion
    if (request.excludedModels?.includes(model.id)) {
      return false;
    }

    // Capability requirements
    const requiredCaps = [
      ...(request.requiredCapabilities || []),
      ...(profile.requiredCapabilities || []),
    ];
    if (requiredCaps.length > 0) {
      const hasCaps = requiredCaps.every(cap =>
        model.capabilities.includes(cap)
      );
      if (!hasCaps) {
        return false;
      }
    }

    return true;
  }

  // =====================================================
  // Phase 3: Scoring
  // =====================================================

  private async scoreModels(
    models: Model[],
    weights: ScoringWeights,
    request: SelectionRequest,
    domain: Domain
  ): Promise<ScoredModel[]> {
    return models.map(model => this.scoreModel(model, weights, request, domain));
  }

  private scoreModel(
    model: Model,
    weights: ScoringWeights,
    request: SelectionRequest,
    domain: Domain
  ): ScoredModel {
    const scores = this.calculateDimensionScores(model, request, domain);
    const compositeScore = this.calculateCompositeScore(scores, weights);
    const { passes, violations } = this.checkConstraints(model, request, domain);

    return {
      model,
      compositeScore,
      dimensionScores: scores,
      passesConstraints: passes,
      constraintViolations: violations,
    };
  }

  private calculateDimensionScores(
    model: Model,
    request: SelectionRequest,
    domain: Domain
  ): DimensionScores {
    return {
      quality: this.scoreQuality(model),
      cost: this.scoreCost(model),
      latency: this.scoreLatency(model),
      capability: this.scoreCapability(model, request),
      reliability: this.scoreReliability(model),
      compliance: this.scoreCompliance(model, request, domain), // Binary!
      availability: this.scoreAvailability(model),
      learning: this.scoreLearning(model, request.tenantId),
    };
  }

  /**
   * Quality Score (Q): Based on quality_score from model
   */
  private scoreQuality(model: Model): number {
    return model.qualityScore;
  }

  /**
   * Cost Score (C): Inverted - cheaper = higher score
   */
  private scoreCost(model: Model): number {
    if ('inputCostPer1kTokens' in model) {
      // External model
      const cost = model.inputCostPer1kTokens + model.outputCostPer1kTokens;
      // Normalize: assume max cost is $0.20/1k, min is $0.0001/1k
      const maxCost = 0.20;
      const minCost = 0.0001;
      const normalized = (maxCost - cost) / (maxCost - minCost);
      return Math.max(0, Math.min(100, normalized * 100));
    } else {
      // Self-hosted - assume lower cost
      return 80;
    }
  }

  /**
   * Latency Score (L): Based on TTFT
   */
  private scoreLatency(model: Model): number {
    if ('avgTtftMs' in model && model.avgTtftMs) {
      const ttft = model.avgTtftMs;
      if (ttft <= LATENCY_EXCELLENT_MS) return 95;
      if (ttft <= LATENCY_GOOD_MS) return 80;
      if (ttft <= LATENCY_ACCEPTABLE_MS) return 60;
      if (ttft <= LATENCY_POOR_MS) return 35;
      return 20;
    }
    // Self-hosted with cold start
    if ('coldStartMs' in model && model.thermalState === 'COLD') {
      return 30;
    }
    return 70; // Default
  }

  /**
   * Capability Score (K): Match percentage
   */
  private scoreCapability(model: Model, request: SelectionRequest): number {
    const required = request.requiredCapabilities || [];
    if (required.length === 0) {
      return 100;
    }
    const matched = required.filter(cap => model.capabilities.includes(cap));
    return (matched.length / required.length) * 100;
  }

  /**
   * Reliability Score (R): Uptime and error rate
   */
  private scoreReliability(model: Model): number {
    if ('uptimePercent30d' in model) {
      const uptime = model.uptimePercent30d;
      const errorRate = model.errorRate7d;
      return uptime * 0.7 + (1 - errorRate) * 100 * 0.3;
    }
    return 90; // Self-hosted default
  }

  /**
   * Compliance Score (P): Framework count × 15 (capped at 100)
   * Per RAWS v1.1 spec: P = min(100, compliance_frameworks_count × 15)
   */
  private scoreCompliance(
    model: Model,
    request: SelectionRequest,
    domain: Domain
  ): number {
    const modelCompliance =
      'complianceCertifications' in model
        ? model.complianceCertifications
        : [];

    // Score based on number of compliance frameworks
    return Math.min(100, modelCompliance.length * 15);
  }

  /**
   * Availability Score (A): Thermal state for self-hosted
   */
  private scoreAvailability(model: Model): number {
    if ('thermalState' in model) {
      return THERMAL_AVAILABILITY_SCORES[model.thermalState];
    }
    return 100; // External APIs always available (if healthy)
  }

  /**
   * Learning Score (E): Historical performance for tenant
   */
  private scoreLearning(model: Model, tenantId: string): number {
    const key = `${tenantId}:${model.id}`;
    const score = this.learningScores.get(key);
    return score ?? 50; // Default neutral
  }

  /**
   * Composite Score: Weighted sum
   */
  private calculateCompositeScore(
    scores: DimensionScores,
    weights: ScoringWeights
  ): number {
    return (
      scores.quality * weights.Q +
      scores.cost * weights.C +
      scores.latency * weights.L +
      scores.capability * weights.K +
      scores.reliability * weights.R +
      scores.compliance * weights.P +
      scores.availability * weights.A +
      scores.learning * weights.E
    );
  }

  // =====================================================
  // Constraint Checking
  // =====================================================

  private checkConstraints(
    model: Model,
    request: SelectionRequest,
    domain: Domain
  ): { passes: boolean; violations: string[] } {
    const violations: string[] = [];
    const domainProfile = WEIGHT_PROFILES[domain.toUpperCase() as WeightProfileId];

    // Quality threshold
    const minQuality =
      request.minQualityScore ?? domainProfile?.minQualityScore;
    if (minQuality && model.qualityScore < minQuality) {
      violations.push(
        `Quality ${model.qualityScore} below minimum ${minQuality}`
      );
    }

    // Cost threshold
    if (request.maxCostPer1kTokens && 'inputCostPer1kTokens' in model) {
      const totalCost =
        model.inputCostPer1kTokens + model.outputCostPer1kTokens;
      if (totalCost > request.maxCostPer1kTokens) {
        violations.push(
          `Cost ${totalCost} exceeds maximum ${request.maxCostPer1kTokens}`
        );
      }
    }

    // Latency threshold
    if (request.maxLatencyMs && 'avgTtftMs' in model && model.avgTtftMs) {
      if (model.avgTtftMs > request.maxLatencyMs) {
        violations.push(
          `Latency ${model.avgTtftMs}ms exceeds maximum ${request.maxLatencyMs}ms`
        );
      }
    }

    // Compliance (hard constraint for regulated domains)
    const requiredCompliance = [
      ...(request.requiredCompliance || []),
      ...(domainProfile?.requiredCompliance || []),
    ];
    if (requiredCompliance.length > 0) {
      const modelCompliance =
        'complianceCertifications' in model
          ? model.complianceCertifications
          : [];
      const missing = requiredCompliance.filter(
        cert => !modelCompliance.includes(cert)
      );
      if (missing.length > 0) {
        violations.push(`Missing compliance: ${missing.join(', ')}`);
      }
    }

    return {
      passes: violations.length === 0,
      violations,
    };
  }

  // =====================================================
  // Utilities
  // =====================================================

  private estimateCost(
    model: Model,
    inputTokens: number,
    outputTokens: number
  ): SelectionResult['estimatedCost'] {
    if ('inputCostPer1kTokens' in model) {
      const inputCost = (inputTokens / 1000) * model.inputCostPer1kTokens;
      const outputCost = (outputTokens / 1000) * model.outputCostPer1kTokens;
      const markup = 1 + model.markupPercent / 100;
      return {
        inputCost: inputCost * markup,
        outputCost: outputCost * markup,
        totalCost: (inputCost + outputCost) * markup,
        currency: 'USD',
      };
    }
    return undefined;
  }

  private collectWarnings(
    selected: ScoredModel,
    request: SelectionRequest,
    latencyMs: number
  ): string[] {
    const warnings: string[] = [];

    if (latencyMs > SELECTION_TIMEOUT_MS) {
      warnings.push(
        `Selection took ${latencyMs}ms, exceeding ${SELECTION_TIMEOUT_MS}ms budget`
      );
    }

    if (selected.constraintViolations?.length) {
      warnings.push(
        `Selected model has constraint violations: ${selected.constraintViolations.join('; ')}`
      );
    }

    if (selected.dimensionScores.compliance === 0) {
      warnings.push('Selected model does not meet compliance requirements');
    }

    return warnings.length > 0 ? warnings : undefined as any;
  }
}

export const rawsSelectionService = new RAWSSelectionService();
