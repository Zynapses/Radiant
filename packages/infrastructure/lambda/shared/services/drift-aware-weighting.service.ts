/**
 * RADIANT v7.36.0 — Unified Drift-Aware Weighting Service
 *
 * Single API for ALL apps (Genesis, Cato, Cortex, Omega, AGI Orchestrator)
 * to get drift-aware model recommendations. Combines:
 *   - Drift detection scores (KS, PSI, chi-squared, embedding)
 *   - Drift correction actions (quarantine, fallback, weight penalties)
 *   - Quality, latency, cost, and availability scores
 *   - Manual overrides from admin dashboard
 *   - App-specific weighting profiles
 *
 * Usage:
 *   const recommendation = await driftAwareWeightingService.recommendModel(tenantId, {
 *     app: 'cato',
 *     taskType: 'code_generation',
 *     preferredCapabilities: ['reasoning', 'code'],
 *   });
 */

import { driftCorrectionService, type WeightedModel, type ModelWeightConfig } from './drift-correction.service';
import { driftDetectionService, type DriftReport } from './drift-detection.service';
import { executeStatement, stringParam, doubleParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'drift/aware-weighting',
  category: 'infrastructure',
  sourceType: 'application',
});

// =============================================================================
// Types
// =============================================================================

export type RadiantApp = 'genesis' | 'cato' | 'cortex' | 'omega' | 'orchestrator' | 'thinktank' | 'curator';

export type TaskCategory =
  | 'code_generation' | 'code_review' | 'reasoning' | 'analysis'
  | 'creative_writing' | 'summarization' | 'translation' | 'classification'
  | 'extraction' | 'conversation' | 'research' | 'training_evaluation'
  | 'shadow_comparison' | 'knowledge_graph' | 'pipeline_method' | 'general';

export interface DriftAwareSelectionRequest {
  app: RadiantApp;
  taskType?: TaskCategory;
  preferredCapabilities?: string[];
  excludeModels?: string[];
  maxResults?: number;
  minDriftScore?: number;          // Filter out models below this drift score (0-1)
  requireNonQuarantined?: boolean; // Default: true
  costSensitivity?: number;        // 0-1, how much to weight cost (0=ignore, 1=cheapest)
  latencySensitivity?: number;     // 0-1, how much to weight latency
  qualitySensitivity?: number;     // 0-1, how much to weight quality
}

export interface DriftAwareModelRecommendation {
  modelId: string;
  compositeScore: number;       // 0-1, final weighted score
  driftScore: number;           // 0-1, 1=no drift
  qualityScore: number;
  latencyScore: number;
  costScore: number;
  availabilityScore: number;
  isQuarantined: boolean;
  hasDriftWarning: boolean;     // True if drift > penalty threshold but < quarantine
  driftTrend: 'stable' | 'improving' | 'degrading' | 'unknown';
  fallbackModelId?: string;     // If quarantined, the configured fallback
  temperatureAdjustment?: number; // Drift-corrected temperature
  promptPrefixCorrection?: string; // Drift-corrected prompt prefix
  manualOverride: boolean;      // True if admin manually set weight
}

export interface DriftAwareSelectionResult {
  recommendations: DriftAwareModelRecommendation[];
  bestModel: DriftAwareModelRecommendation | null;
  tenantId: string;
  app: RadiantApp;
  taskType: TaskCategory;
  totalCandidates: number;
  filteredOut: number;          // Models excluded by drift/quarantine/caps
  driftCheckTimestamp: string;
  warnings: string[];
}

export interface AppWeightProfile {
  app: RadiantApp;
  driftWeight: number;          // How much this app cares about drift (0-1)
  qualityWeight: number;
  latencyWeight: number;
  costWeight: number;
  availabilityWeight: number;
  minAcceptableDriftScore: number; // Below this, model is excluded for this app
  preferStableModels: boolean;     // If true, penalize recently-drifted models
}

export interface DriftSummary {
  tenantId: string;
  totalModels: number;
  healthyModels: number;
  driftWarningModels: number;
  quarantinedModels: number;
  avgDriftScore: number;
  worstModel: { modelId: string; driftScore: number } | null;
  lastCheckAt: string;
}

export interface InvocationTelemetry {
  tenantId: string;
  modelId: string;
  originalRequestedModelId: string;
  wasRerouted: boolean;
  success: boolean;
  latencyMs: number;
  tokensUsed: number;
  costCents: number;
  timestamp: string;
}

export interface GenesisDriftFeedback {
  tenantId: string;
  totalInvocations: number;
  reroutedInvocations: number;
  failedInvocations: number;
  rerouteRate: number;           // 0-1, fraction of calls that needed rerouting
  failureRate: number;           // 0-1, fraction of calls that failed
  avgLatencyMs: number;
  modelHealthMap: Record<string, {
    invocations: number;
    failures: number;
    reroutes: number;
    avgLatencyMs: number;
  }>;
  driftSummary: DriftSummary;
  overallHealthScore: number;    // 0-1, composite health for Genesis gating
  windowStartAt: string;
  windowEndAt: string;
}

// =============================================================================
// App-Specific Weight Profiles
// =============================================================================

const APP_WEIGHT_PROFILES: Record<RadiantApp, AppWeightProfile> = {
  // Genesis: developmental safety — strong drift sensitivity, quality focus
  genesis: {
    app: 'genesis',
    driftWeight: 0.35,
    qualityWeight: 0.30,
    latencyWeight: 0.10,
    costWeight: 0.10,
    availabilityWeight: 0.15,
    minAcceptableDriftScore: 0.5,
    preferStableModels: true,
  },
  // Cato: pipeline methods — balanced, needs reliability
  cato: {
    app: 'cato',
    driftWeight: 0.30,
    qualityWeight: 0.25,
    latencyWeight: 0.15,
    costWeight: 0.15,
    availabilityWeight: 0.15,
    minAcceptableDriftScore: 0.4,
    preferStableModels: true,
  },
  // Cortex: knowledge graph — quality and accuracy critical
  cortex: {
    app: 'cortex',
    driftWeight: 0.30,
    qualityWeight: 0.35,
    latencyWeight: 0.10,
    costWeight: 0.10,
    availabilityWeight: 0.15,
    minAcceptableDriftScore: 0.45,
    preferStableModels: true,
  },
  // Omega: shadow comparison — needs consistent baseline, highest drift sensitivity
  omega: {
    app: 'omega',
    driftWeight: 0.40,
    qualityWeight: 0.25,
    latencyWeight: 0.10,
    costWeight: 0.10,
    availabilityWeight: 0.15,
    minAcceptableDriftScore: 0.5,
    preferStableModels: true,
  },
  // Orchestrator: general routing — balanced
  orchestrator: {
    app: 'orchestrator',
    driftWeight: 0.25,
    qualityWeight: 0.30,
    latencyWeight: 0.15,
    costWeight: 0.15,
    availabilityWeight: 0.15,
    minAcceptableDriftScore: 0.3,
    preferStableModels: false,
  },
  // Think Tank: user-facing — latency matters more
  thinktank: {
    app: 'thinktank',
    driftWeight: 0.20,
    qualityWeight: 0.30,
    latencyWeight: 0.25,
    costWeight: 0.10,
    availabilityWeight: 0.15,
    minAcceptableDriftScore: 0.3,
    preferStableModels: false,
  },
  // Curator: content curation — quality focus
  curator: {
    app: 'curator',
    driftWeight: 0.25,
    qualityWeight: 0.35,
    latencyWeight: 0.10,
    costWeight: 0.15,
    availabilityWeight: 0.15,
    minAcceptableDriftScore: 0.35,
    preferStableModels: false,
  },
};

// =============================================================================
// Service
// =============================================================================

class DriftAwareWeightingService {
  private driftTrendCache = new Map<string, { trend: string; cachedAt: number }>();
  private TREND_CACHE_TTL = 60_000; // 1 minute

  // =========================================================================
  // TELEMETRY RING BUFFER (v7.37.0)
  // In-memory circular buffer storing recent invocation telemetry.
  // Used by Genesis gate checks to assess real-time model health.
  // Max 10,000 entries per tenant, auto-evicted oldest-first.
  // =========================================================================
  private telemetryBuffer = new Map<string, InvocationTelemetry[]>();
  private readonly MAX_TELEMETRY_PER_TENANT = 10_000;
  private readonly TELEMETRY_WINDOW_MS = 3_600_000; // 1 hour

  // ===========================================================================
  // PRIMARY API: Recommend models for an app
  // ===========================================================================

  /**
   * Get drift-aware model recommendations for any RADIANT app.
   * This is the single entry point all apps should use for model selection.
   */
  async recommendModels(
    tenantId: string,
    request: DriftAwareSelectionRequest,
  ): Promise<DriftAwareSelectionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const taskType = request.taskType || 'general';
    const profile = APP_WEIGHT_PROFILES[request.app] || APP_WEIGHT_PROFILES.orchestrator;

    // 1. Get all weighted models from drift correction service
    const allModels = await driftCorrectionService.getWeightedModels(
      tenantId,
      false, // Include quarantined so we can report them
    );

    if (allModels.length === 0) {
      warnings.push('No models found in weight config. Using default model router.');
      return {
        recommendations: [],
        bestModel: null,
        tenantId,
        app: request.app,
        taskType,
        totalCandidates: 0,
        filteredOut: 0,
        driftCheckTimestamp: new Date().toISOString(),
        warnings,
      };
    }

    const totalCandidates = allModels.length;
    let filtered = allModels;

    // 2. Filter quarantined (unless explicitly allowed)
    if (request.requireNonQuarantined !== false) {
      filtered = filtered.filter(m => !m.isQuarantined);
    }

    // 3. Filter by minimum drift score (app profile or request override)
    const minDrift = request.minDriftScore ?? profile.minAcceptableDriftScore;
    filtered = filtered.filter(m => m.driftScore >= minDrift);

    // 4. Filter excluded models
    if (request.excludeModels?.length) {
      filtered = filtered.filter(m => !request.excludeModels!.includes(m.modelId));
    }

    const filteredOut = totalCandidates - filtered.length;

    if (filteredOut > 0) {
      warnings.push(`${filteredOut} model(s) excluded (quarantined, drift below ${minDrift.toFixed(2)}, or explicitly excluded)`);
    }

    // 5. Get full weight configs for remaining models (for fallback/correction data)
    const configs = new Map<string, ModelWeightConfig>();
    for (const model of filtered) {
      const config = await driftCorrectionService.getWeightConfig(tenantId, model.modelId);
      if (config) configs.set(model.modelId, config);
    }

    // 6. Compute app-specific composite scores
    const recommendations: DriftAwareModelRecommendation[] = [];

    for (const model of filtered) {
      const config = configs.get(model.modelId);

      // Apply request-level sensitivity overrides
      const driftW = request.app === 'omega' ? profile.driftWeight : (profile.driftWeight);
      const qualityW = request.qualitySensitivity ?? profile.qualityWeight;
      const latencyW = request.latencySensitivity ?? profile.latencyWeight;
      const costW = request.costSensitivity ?? profile.costWeight;
      const availW = profile.availabilityWeight;

      // Normalize weights
      const totalW = driftW + qualityW + latencyW + costW + availW;
      const nDrift = driftW / totalW;
      const nQuality = qualityW / totalW;
      const nLatency = latencyW / totalW;
      const nCost = costW / totalW;
      const nAvail = availW / totalW;

      // Compute composite
      let compositeScore =
        nDrift * model.driftScore +
        nQuality * model.qualityScore +
        nLatency * model.latencyScore +
        nCost * model.costScore +
        nAvail * model.availabilityScore;

      // Stability penalty: if app prefers stable models and drift is borderline
      if (profile.preferStableModels && model.driftScore < 0.7) {
        const stabilityPenalty = (0.7 - model.driftScore) * 0.15;
        compositeScore -= stabilityPenalty;
      }

      // Manual override takes precedence
      if (model.manualOverride !== null) {
        compositeScore = model.manualOverride;
      }

      compositeScore = Math.max(0, Math.min(1, compositeScore));

      // Determine drift trend
      const trend = await this.getDriftTrend(tenantId, model.modelId);

      // Determine if drift warning applies
      const penaltyThreshold = config?.driftPenaltyThreshold ?? 0.6;
      const quarantineThreshold = config?.driftQuarantineThreshold ?? 0.3;
      const hasDriftWarning = model.driftScore < penaltyThreshold && model.driftScore >= quarantineThreshold;

      if (hasDriftWarning) {
        warnings.push(`Model ${model.modelId} has drift warning (score: ${model.driftScore.toFixed(3)})`);
      }

      recommendations.push({
        modelId: model.modelId,
        compositeScore,
        driftScore: model.driftScore,
        qualityScore: model.qualityScore,
        latencyScore: model.latencyScore,
        costScore: model.costScore,
        availabilityScore: model.availabilityScore,
        isQuarantined: model.isQuarantined,
        hasDriftWarning,
        driftTrend: trend as 'stable' | 'improving' | 'degrading' | 'unknown',
        fallbackModelId: config?.driftAutoFallbackModelId || undefined,
        temperatureAdjustment: config?.driftTemperatureCorrection ?? undefined,
        promptPrefixCorrection: config?.driftPromptPrefixCorrection ?? undefined,
        manualOverride: model.manualOverride !== null,
      });
    }

    // 7. Sort by composite score descending
    recommendations.sort((a, b) => b.compositeScore - a.compositeScore);

    // 8. Limit results
    const maxResults = request.maxResults || 10;
    const limited = recommendations.slice(0, maxResults);

    const elapsed = Date.now() - startTime;
    logger.info('Drift-aware model recommendation', {
      tenantId, app: request.app, taskType,
      totalCandidates, filteredOut, returned: limited.length,
      bestModel: limited[0]?.modelId, bestScore: limited[0]?.compositeScore,
      elapsedMs: elapsed,
    });

    return {
      recommendations: limited,
      bestModel: limited[0] || null,
      tenantId,
      app: request.app,
      taskType,
      totalCandidates,
      filteredOut,
      driftCheckTimestamp: new Date().toISOString(),
      warnings,
    };
  }

  // ===========================================================================
  // CONVENIENCE: Get single best model for an app
  // ===========================================================================

  async getBestModel(
    tenantId: string,
    app: RadiantApp,
    taskType: TaskCategory = 'general',
    excludeModels?: string[],
  ): Promise<{ modelId: string; driftScore: number; temperatureAdjustment?: number; promptPrefix?: string } | null> {
    const result = await this.recommendModels(tenantId, {
      app,
      taskType,
      excludeModels,
      maxResults: 1,
    });

    if (!result.bestModel) return null;

    return {
      modelId: result.bestModel.modelId,
      driftScore: result.bestModel.driftScore,
      temperatureAdjustment: result.bestModel.temperatureAdjustment,
      promptPrefix: result.bestModel.promptPrefixCorrection,
    };
  }

  // ===========================================================================
  // CONVENIENCE: Check if a specific model is safe to use
  // ===========================================================================

  async isModelSafe(
    tenantId: string,
    modelId: string,
    app: RadiantApp,
  ): Promise<{
    safe: boolean;
    driftScore: number;
    isQuarantined: boolean;
    hasDriftWarning: boolean;
    fallbackModelId?: string;
    reason?: string;
  }> {
    const profile = APP_WEIGHT_PROFILES[app];
    const config = await driftCorrectionService.getWeightConfig(tenantId, modelId);

    if (!config) {
      return { safe: true, driftScore: 1.0, isQuarantined: false, hasDriftWarning: false };
    }

    const isQuarantined = config.isQuarantined;
    const driftScore = config.currentDriftScore;
    const belowMinDrift = driftScore < profile.minAcceptableDriftScore;
    const hasDriftWarning = driftScore < config.driftPenaltyThreshold && !isQuarantined;

    const safe = !isQuarantined && !belowMinDrift;

    let reason: string | undefined;
    if (isQuarantined) reason = `Model quarantined since ${config.quarantinedAt}: ${config.quarantineReason}`;
    else if (belowMinDrift) reason = `Drift score ${driftScore.toFixed(3)} below ${app} minimum ${profile.minAcceptableDriftScore}`;

    return {
      safe,
      driftScore,
      isQuarantined,
      hasDriftWarning,
      fallbackModelId: config.driftAutoFallbackModelId || undefined,
      reason,
    };
  }

  // ===========================================================================
  // SUMMARY: Get drift health summary for a tenant
  // ===========================================================================

  async getDriftSummary(tenantId: string): Promise<DriftSummary> {
    const allModels = await driftCorrectionService.getWeightedModels(tenantId, false);

    const healthy = allModels.filter(m => !m.isQuarantined && m.driftScore >= 0.7);
    const warning = allModels.filter(m => !m.isQuarantined && m.driftScore < 0.7 && m.driftScore >= 0.3);
    const quarantined = allModels.filter(m => m.isQuarantined);

    const avgDrift = allModels.length > 0
      ? allModels.reduce((sum, m) => sum + m.driftScore, 0) / allModels.length
      : 1.0;

    const worst = allModels.length > 0
      ? allModels.reduce((w, m) => m.driftScore < w.driftScore ? m : w)
      : null;

    return {
      tenantId,
      totalModels: allModels.length,
      healthyModels: healthy.length,
      driftWarningModels: warning.length,
      quarantinedModels: quarantined.length,
      avgDriftScore: avgDrift,
      worstModel: worst ? { modelId: worst.modelId, driftScore: worst.driftScore } : null,
      lastCheckAt: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // RUN DRIFT CHECK: Trigger detection + correction for all models
  // ===========================================================================

  async runFullDriftCheck(
    tenantId: string,
    metrics: string[] = ['response_length', 'sentiment', 'toxicity'],
  ): Promise<{
    modelsChecked: number;
    driftDetected: number;
    correctionsApplied: number;
    quarantined: number;
    results: Array<{ modelId: string; driftScore: number; action: string }>;
  }> {
    const allConfigs = await driftCorrectionService.getAllWeightConfigs(tenantId);
    const results: Array<{ modelId: string; driftScore: number; action: string }> = [];
    let driftDetected = 0;
    let correctionsApplied = 0;
    let quarantined = 0;

    for (const config of allConfigs) {
      const correction = await driftCorrectionService.checkAndCorrect(
        tenantId, config.modelId, metrics,
      );

      results.push({
        modelId: config.modelId,
        driftScore: correction.newWeight,
        action: correction.actionTaken,
      });

      if (correction.actionTaken !== 'none') {
        driftDetected++;
        if (correction.actionTaken !== 'none' && correction.actionTaken !== 'no_drift') {
          correctionsApplied++;
        }
        if (correction.isQuarantined) quarantined++;
      }
    }

    logger.info('Full drift check completed', {
      tenantId, modelsChecked: allConfigs.length,
      driftDetected, correctionsApplied, quarantined,
    });

    return {
      modelsChecked: allConfigs.length,
      driftDetected,
      correctionsApplied,
      quarantined,
      results,
    };
  }

  // ===========================================================================
  // TELEMETRY: Record invocation results for Genesis feedback (v7.37.0)
  // ===========================================================================

  async recordInvocationTelemetry(telemetry: InvocationTelemetry): Promise<void> {
    const buffer = this.telemetryBuffer.get(telemetry.tenantId) || [];
    buffer.push(telemetry);

    // Evict oldest entries if buffer exceeds max
    while (buffer.length > this.MAX_TELEMETRY_PER_TENANT) {
      buffer.shift();
    }

    this.telemetryBuffer.set(telemetry.tenantId, buffer);

    // Also persist to database for cross-Lambda visibility (fire-and-forget)
    try {
      await executeStatement(
        `INSERT INTO drift_invocation_telemetry (
          tenant_id, model_id, original_model_id, was_rerouted,
          success, latency_ms, tokens_used, cost_cents, invoked_at
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)`,
        [
          stringParam('tenantId', telemetry.tenantId),
          stringParam('modelId', telemetry.modelId),
          stringParam('originalModelId', telemetry.originalRequestedModelId),
          boolParam('wasRerouted', telemetry.wasRerouted),
          boolParam('success', telemetry.success),
          doubleParam('latencyMs', telemetry.latencyMs),
          doubleParam('tokensUsed', telemetry.tokensUsed),
          doubleParam('costCents', telemetry.costCents),
          stringParam('invokedAt', telemetry.timestamp),
        ],
      );
    } catch {
      // DB write failure is non-fatal — in-memory buffer still works
    }
  }

  // ===========================================================================
  // GENESIS FEEDBACK: Aggregated drift health for Genesis gate decisions
  // ===========================================================================

  async getGenesisDriftFeedback(tenantId: string): Promise<GenesisDriftFeedback> {
    const now = Date.now();
    const windowStart = now - this.TELEMETRY_WINDOW_MS;
    const windowStartIso = new Date(windowStart).toISOString();
    const windowEndIso = new Date(now).toISOString();

    // Try in-memory buffer first, fall back to database
    let entries = (this.telemetryBuffer.get(tenantId) || [])
      .filter(t => new Date(t.timestamp).getTime() >= windowStart);

    // If in-memory buffer is sparse, supplement from database
    if (entries.length < 10) {
      try {
        const dbResult = await executeStatement(
          `SELECT model_id, original_model_id, was_rerouted, success,
                  latency_ms, tokens_used, cost_cents, invoked_at
           FROM drift_invocation_telemetry
           WHERE tenant_id = $1::uuid AND invoked_at >= $2::timestamptz
           ORDER BY invoked_at DESC LIMIT 1000`,
          [
            stringParam('tenantId', tenantId),
            stringParam('windowStart', windowStartIso),
          ],
        );

        if (dbResult.rows && dbResult.rows.length > entries.length) {
          entries = dbResult.rows.map((row: Record<string, unknown>) => ({
            tenantId,
            modelId: String(row.model_id),
            originalRequestedModelId: String(row.original_model_id),
            wasRerouted: Boolean(row.was_rerouted),
            success: Boolean(row.success),
            latencyMs: Number(row.latency_ms || 0),
            tokensUsed: Number(row.tokens_used || 0),
            costCents: Number(row.cost_cents || 0),
            timestamp: String(row.invoked_at),
          }));
        }
      } catch {
        // DB read failure — use whatever we have in memory
      }
    }

    // Aggregate telemetry
    const totalInvocations = entries.length;
    const reroutedInvocations = entries.filter(e => e.wasRerouted).length;
    const failedInvocations = entries.filter(e => !e.success).length;
    const avgLatencyMs = totalInvocations > 0
      ? entries.reduce((sum, e) => sum + e.latencyMs, 0) / totalInvocations
      : 0;

    // Per-model health map
    const modelHealthMap: Record<string, {
      invocations: number; failures: number; reroutes: number; avgLatencyMs: number;
    }> = {};

    for (const entry of entries) {
      const key = entry.modelId;
      if (!modelHealthMap[key]) {
        modelHealthMap[key] = { invocations: 0, failures: 0, reroutes: 0, avgLatencyMs: 0 };
      }
      modelHealthMap[key].invocations++;
      if (!entry.success) modelHealthMap[key].failures++;
      if (entry.wasRerouted) modelHealthMap[key].reroutes++;
      modelHealthMap[key].avgLatencyMs += entry.latencyMs;
    }

    for (const key of Object.keys(modelHealthMap)) {
      if (modelHealthMap[key].invocations > 0) {
        modelHealthMap[key].avgLatencyMs /= modelHealthMap[key].invocations;
      }
    }

    // Get drift summary
    const driftSummary = await this.getDriftSummary(tenantId);

    // Compute overall health score for Genesis gating (0-1)
    // Weighted: 40% drift health + 30% reroute rate + 30% failure rate
    const rerouteRate = totalInvocations > 0 ? reroutedInvocations / totalInvocations : 0;
    const failureRate = totalInvocations > 0 ? failedInvocations / totalInvocations : 0;
    const driftHealth = driftSummary.avgDriftScore;
    const overallHealthScore = Math.max(0, Math.min(1,
      0.40 * driftHealth +
      0.30 * (1 - rerouteRate) +
      0.30 * (1 - failureRate)
    ));

    return {
      tenantId,
      totalInvocations,
      reroutedInvocations,
      failedInvocations,
      rerouteRate,
      failureRate,
      avgLatencyMs,
      modelHealthMap,
      driftSummary,
      overallHealthScore,
      windowStartAt: windowStartIso,
      windowEndAt: windowEndIso,
    };
  }

  // ===========================================================================
  // APP PROFILES: Get/update weight profiles
  // ===========================================================================

  getAppProfile(app: RadiantApp): AppWeightProfile {
    const profile = APP_WEIGHT_PROFILES[app];
    return profile ? { ...profile } : { ...APP_WEIGHT_PROFILES.orchestrator };
  }

  getAllAppProfiles(): Record<RadiantApp, AppWeightProfile> {
    return { ...APP_WEIGHT_PROFILES };
  }

  // ===========================================================================
  // INTERNAL: Drift trend detection
  // ===========================================================================

  private async getDriftTrend(tenantId: string, modelId: string): Promise<string> {
    const cacheKey = `${tenantId}:${modelId}`;
    const cached = this.driftTrendCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.TREND_CACHE_TTL) {
      return cached.trend;
    }

    try {
      const result = await executeStatement(
        `SELECT current_drift_score, 
                LAG(current_drift_score) OVER (ORDER BY last_drift_check_at) as prev_score
         FROM model_weight_config 
         WHERE tenant_id = $1::uuid AND model_id = $2
         LIMIT 1`,
        [stringParam('tenantId', tenantId), stringParam('modelId', modelId)],
      );

      let trend = 'unknown';
      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const current = Number(row.current_drift_score || 1);
        const prev = row.prev_score != null ? Number(row.prev_score) : null;

        if (prev === null) trend = 'unknown';
        else if (current > prev + 0.05) trend = 'improving';
        else if (current < prev - 0.05) trend = 'degrading';
        else trend = 'stable';
      }

      this.driftTrendCache.set(cacheKey, { trend, cachedAt: Date.now() });
      return trend;
    } catch {
      return 'unknown';
    }
  }
}

// =============================================================================
// Singleton export
// =============================================================================

export const driftAwareWeightingService = new DriftAwareWeightingService();
