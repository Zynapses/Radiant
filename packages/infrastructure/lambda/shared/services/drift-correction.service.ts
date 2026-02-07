// RADIANT v4.18.0 - Drift Correction Service
// Automatic and manual drift correction: quarantine, fallback routing,
// weight penalties, temperature/prompt adjustments
// Integrates with drift-detection.service.ts and model-router.service.ts
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'drift/correction',
  category: 'infrastructure',
  sourceType: 'application',
});
import { driftDetectionService, DriftReport, DriftTestResult } from './drift-detection.service';

// ============================================================================
// Types
// ============================================================================

export interface ModelWeightConfig {
  id: string;
  tenantId: string;
  modelId: string;
  manualWeightOverride: number | null;
  driftFactorWeight: number;
  qualityFactorWeight: number;
  latencyFactorWeight: number;
  costFactorWeight: number;
  availabilityFactorWeight: number;
  currentDriftScore: number;
  currentQualityScore: number;
  currentLatencyScore: number;
  currentCostScore: number;
  currentAvailabilityScore: number;
  currentCompositeWeight: number;
  driftQuarantineThreshold: number;
  driftPenaltyThreshold: number;
  driftAutoQuarantine: boolean;
  driftAutoFallbackModelId: string | null;
  driftTemperatureCorrection: number | null;
  driftPromptPrefixCorrection: string | null;
  isQuarantined: boolean;
  quarantinedAt: string | null;
  quarantineReason: string | null;
  quarantineExpiresAt: string | null;
  quarantineAutoRelease: boolean;
  lastWeightCalculationAt: string | null;
  lastDriftCheckAt: string | null;
}

export interface WeightedModel {
  modelId: string;
  compositeWeight: number;
  driftScore: number;
  qualityScore: number;
  latencyScore: number;
  costScore: number;
  availabilityScore: number;
  isQuarantined: boolean;
  manualOverride: number | null;
}

export interface DriftCorrectionAction {
  id: string;
  tenantId: string;
  modelId: string;
  actionType: string;
  triggerType: string;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  driftReport: DriftReport | null;
  reason: string;
  performedBy: string | null;
  revertedAt: string | null;
  createdAt: string;
}

export interface CorrectionResult {
  modelId: string;
  actionTaken: string;
  previousWeight: number;
  newWeight: number;
  isQuarantined: boolean;
  fallbackModelId: string | null;
  temperatureAdjustment: number | null;
  promptAdjustment: string | null;
  reason: string;
}

export interface ModelWeightUpdate {
  driftScore?: number;
  qualityScore?: number;
  latencyScore?: number;
  costScore?: number;
  availabilityScore?: number;
  manualWeightOverride?: number | null;
  driftFactorWeight?: number;
  qualityFactorWeight?: number;
  latencyFactorWeight?: number;
  costFactorWeight?: number;
  availabilityFactorWeight?: number;
  driftQuarantineThreshold?: number;
  driftPenaltyThreshold?: number;
  driftAutoQuarantine?: boolean;
  driftAutoFallbackModelId?: string | null;
  driftTemperatureCorrection?: number | null;
  driftPromptPrefixCorrection?: string | null;
  quarantineAutoRelease?: boolean;
}

// ============================================================================
// Drift Correction Service
// ============================================================================

class DriftCorrectionService {

  // ==========================================================================
  // Core: Run drift check and apply corrections
  // ==========================================================================

  /**
   * Run drift detection for a model and automatically apply corrections.
   * Called by the security monitoring EventBridge lambda and also on-demand.
   */
  async checkAndCorrect(
    tenantId: string,
    modelId: string,
    metrics: string[] = ['response_length', 'sentiment', 'toxicity']
  ): Promise<CorrectionResult> {
    const report = await driftDetectionService.detectDrift(tenantId, modelId, metrics);
    return this.applyCorrectionFromReport(tenantId, modelId, report);
  }

  /**
   * Given a drift report, determine and apply the appropriate correction.
   * Drift score is computed as 1.0 - (max test statistic normalized to [0,1]).
   * Score of 1.0 = no drift. Score of 0.0 = maximum drift.
   */
  async applyCorrectionFromReport(
    tenantId: string,
    modelId: string,
    report: DriftReport
  ): Promise<CorrectionResult> {
    // Ensure weight config exists
    await this.ensureWeightConfig(tenantId, modelId);

    const config = await this.getWeightConfig(tenantId, modelId);
    if (!config) {
      return {
        modelId,
        actionTaken: 'none',
        previousWeight: 1.0,
        newWeight: 1.0,
        isQuarantined: false,
        fallbackModelId: null,
        temperatureAdjustment: null,
        promptAdjustment: null,
        reason: 'Could not load weight config',
      };
    }

    const previousWeight = config.currentCompositeWeight;

    // Compute drift score from report (1.0 = no drift, 0.0 = max drift)
    const driftScore = this.computeDriftScoreFromReport(report);

    // Apply the drift score to the model's weight config
    const penaltyResult = await executeStatement(
      `SELECT * FROM apply_drift_penalty($1::uuid, $2, $3, NULL)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        doubleParam('driftScore', driftScore),
      ]
    );

    const row = penaltyResult.rows?.[0] || {};
    const actionTaken = String(row.action_taken || 'none');
    const newWeight = Number(row.new_weight || 0);

    // Determine additional corrections
    let fallbackModelId: string | null = null;
    let temperatureAdjustment: number | null = null;
    let promptAdjustment: string | null = null;

    if (actionTaken === 'quarantine' && config.driftAutoFallbackModelId) {
      fallbackModelId = config.driftAutoFallbackModelId;
      await this.logCorrectionAction(tenantId, modelId, 'fallback_activated', 'auto_drift', {
        fallbackModelId: config.driftAutoFallbackModelId,
        originalWeight: previousWeight,
      }, { fallbackModelId: config.driftAutoFallbackModelId }, report,
        `Fallback activated to ${config.driftAutoFallbackModelId} due to quarantine`);
    }

    if (actionTaken === 'weight_penalty') {
      // Apply temperature correction if configured
      if (config.driftTemperatureCorrection !== null) {
        temperatureAdjustment = config.driftTemperatureCorrection;
        await this.logCorrectionAction(tenantId, modelId, 'temperature_adjust', 'auto_drift',
          { temperature: null }, { temperature: config.driftTemperatureCorrection }, report,
          `Temperature adjusted to ${config.driftTemperatureCorrection} due to drift`);
      }

      // Apply prompt prefix correction if configured
      if (config.driftPromptPrefixCorrection) {
        promptAdjustment = config.driftPromptPrefixCorrection;
        await this.logCorrectionAction(tenantId, modelId, 'prompt_adjust', 'auto_drift',
          { promptPrefix: null }, { promptPrefix: config.driftPromptPrefixCorrection }, report,
          'Prompt prefix correction applied due to drift');
      }
    }

    logger.info('Drift correction applied', {
      tenantId, modelId, driftScore, actionTaken, previousWeight, newWeight,
      isQuarantined: actionTaken === 'quarantine',
    });

    return {
      modelId,
      actionTaken,
      previousWeight,
      newWeight,
      isQuarantined: actionTaken === 'quarantine',
      fallbackModelId,
      temperatureAdjustment,
      promptAdjustment,
      reason: String(row.message || ''),
    };
  }

  // ==========================================================================
  // Model Weight Management
  // ==========================================================================

  /**
   * Get all model weights for a tenant, sorted by composite weight descending.
   * This is the primary method used by the model router for drift-aware selection.
   */
  async getWeightedModels(tenantId: string, excludeQuarantined = true): Promise<WeightedModel[]> {
    const result = await executeStatement(
      `SELECT * FROM get_weighted_models($1::uuid, NULL, $2)`,
      [stringParam('tenantId', tenantId), boolParam('excludeQuarantined', excludeQuarantined)]
    );

    return (result.rows || []).map(row => ({
      modelId: String(row.model_id),
      compositeWeight: Number(row.composite_weight || 0),
      driftScore: Number(row.drift_score || 1),
      qualityScore: Number(row.quality_score || 1),
      latencyScore: Number(row.latency_score || 1),
      costScore: Number(row.cost_score || 1),
      availabilityScore: Number(row.availability_score || 1),
      isQuarantined: row.is_quarantined === true,
      manualOverride: row.manual_override != null ? Number(row.manual_override) : null,
    }));
  }

  /**
   * Get weight config for a specific model
   */
  async getWeightConfig(tenantId: string, modelId: string): Promise<ModelWeightConfig | null> {
    const result = await executeStatement(
      `SELECT * FROM model_weight_config WHERE tenant_id = $1::uuid AND model_id = $2`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId)]
    );

    const row = result.rows?.[0];
    if (!row) return null;

    return this.rowToWeightConfig(row);
  }

  /**
   * Get all weight configs for a tenant
   */
  async getAllWeightConfigs(tenantId: string): Promise<ModelWeightConfig[]> {
    const result = await executeStatement(
      `SELECT * FROM model_weight_config WHERE tenant_id = $1::uuid ORDER BY current_composite_weight DESC`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => this.rowToWeightConfig(row));
  }

  /**
   * Update weight config for a model (admin manual override or factor update)
   */
  async updateWeightConfig(
    tenantId: string,
    modelId: string,
    update: ModelWeightUpdate,
    performedBy?: string
  ): Promise<ModelWeightConfig> {
    await this.ensureWeightConfig(tenantId, modelId);

    const setClauses: string[] = [];
    const params: ReturnType<typeof stringParam>[] = [
      stringParam('tenantId', tenantId),
      stringParam('modelId', modelId),
    ];
    let paramIdx = 3;

    const fieldMap: Record<string, string> = {
      driftScore: 'current_drift_score',
      qualityScore: 'current_quality_score',
      latencyScore: 'current_latency_score',
      costScore: 'current_cost_score',
      availabilityScore: 'current_availability_score',
      manualWeightOverride: 'manual_weight_override',
      driftFactorWeight: 'drift_factor_weight',
      qualityFactorWeight: 'quality_factor_weight',
      latencyFactorWeight: 'latency_factor_weight',
      costFactorWeight: 'cost_factor_weight',
      availabilityFactorWeight: 'availability_factor_weight',
      driftQuarantineThreshold: 'drift_quarantine_threshold',
      driftPenaltyThreshold: 'drift_penalty_threshold',
      driftAutoQuarantine: 'drift_auto_quarantine',
      driftAutoFallbackModelId: 'drift_auto_fallback_model_id',
      driftTemperatureCorrection: 'drift_temperature_correction',
      driftPromptPrefixCorrection: 'drift_prompt_prefix_correction',
      quarantineAutoRelease: 'quarantine_auto_release',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (key in update) {
        const value = (update as Record<string, unknown>)[key];
        setClauses.push(`${column} = $${paramIdx}`);
        if (typeof value === 'boolean') {
          params.push(boolParam(`p${paramIdx}`, value));
        } else if (typeof value === 'number') {
          params.push(doubleParam(`p${paramIdx}`, value));
        } else if (value === null) {
          params.push(stringParam(`p${paramIdx}`, ''));
          // Use NULL for null values
          setClauses[setClauses.length - 1] = `${column} = NULL`;
          params.pop();
          continue;
        } else {
          params.push(stringParam(`p${paramIdx}`, String(value)));
        }
        paramIdx++;
      }
    }

    if (setClauses.length === 0) {
      const config = await this.getWeightConfig(tenantId, modelId);
      return config!;
    }

    setClauses.push('updated_at = NOW()');

    await executeStatement(
      `UPDATE model_weight_config SET ${setClauses.join(', ')} WHERE tenant_id = $1::uuid AND model_id = $2`,
      params
    );

    // Log as manual override if performed by admin
    if (performedBy) {
      await this.logCorrectionAction(tenantId, modelId, 'manual_override', 'manual',
        {}, update as Record<string, unknown>, null,
        'Manual weight configuration update', performedBy);
    }

    // Recalculate composite weight
    await executeStatement(
      `SELECT calculate_composite_weight($1::uuid, $2)`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId)]
    );

    return (await this.getWeightConfig(tenantId, modelId))!;
  }

  /**
   * Quarantine a model manually
   */
  async quarantineModel(
    tenantId: string,
    modelId: string,
    reason: string,
    durationHours = 24,
    performedBy?: string
  ): Promise<{ success: boolean; message: string }> {
    const result = await executeStatement(
      `SELECT * FROM quarantine_model($1::uuid, $2, $3, $4, $5::uuid)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        stringParam('reason', reason),
        longParam('durationHours', durationHours),
        stringParam('performedBy', performedBy || ''),
      ]
    );

    const row = result.rows?.[0] || {};
    return { success: row.success === true, message: String(row.message || '') };
  }

  /**
   * Unquarantine a model manually
   */
  async unquarantineModel(
    tenantId: string,
    modelId: string,
    performedBy?: string
  ): Promise<{ success: boolean; newWeight: number; message: string }> {
    const result = await executeStatement(
      `SELECT * FROM unquarantine_model($1::uuid, $2, $3::uuid)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        stringParam('performedBy', performedBy || ''),
      ]
    );

    const row = result.rows?.[0] || {};
    return {
      success: row.success === true,
      newWeight: Number(row.new_weight || 0),
      message: String(row.message || ''),
    };
  }

  // ==========================================================================
  // Drift-Aware Routing Helpers
  // ==========================================================================

  /**
   * Get the best model for a request, accounting for drift weights.
   * Returns the model ID with the highest composite weight that matches
   * the requested capabilities, or null if all are quarantined.
   */
  async getBestModel(
    tenantId: string,
    requestedModelId: string,
    capabilities?: string[]
  ): Promise<{ modelId: string; weight: number; corrected: boolean; corrections: { temperature?: number; promptPrefix?: string } }> {
    const config = await this.getWeightConfig(tenantId, requestedModelId);

    // If no weight config exists, use the model as-is
    if (!config) {
      return { modelId: requestedModelId, weight: 1.0, corrected: false, corrections: {} };
    }

    // If not quarantined, use it (possibly with corrections)
    if (!config.isQuarantined) {
      const corrections: { temperature?: number; promptPrefix?: string } = {};
      let corrected = false;

      // Apply temperature correction if drift is below penalty threshold
      if (config.currentDriftScore < config.driftPenaltyThreshold && config.driftTemperatureCorrection !== null) {
        corrections.temperature = config.driftTemperatureCorrection;
        corrected = true;
      }

      // Apply prompt prefix correction
      if (config.currentDriftScore < config.driftPenaltyThreshold && config.driftPromptPrefixCorrection) {
        corrections.promptPrefix = config.driftPromptPrefixCorrection;
        corrected = true;
      }

      return {
        modelId: requestedModelId,
        weight: config.currentCompositeWeight,
        corrected,
        corrections,
      };
    }

    // Model is quarantined — try fallback
    if (config.driftAutoFallbackModelId) {
      const fallbackConfig = await this.getWeightConfig(tenantId, config.driftAutoFallbackModelId);
      if (fallbackConfig && !fallbackConfig.isQuarantined) {
        return {
          modelId: config.driftAutoFallbackModelId,
          weight: fallbackConfig.currentCompositeWeight,
          corrected: true,
          corrections: {},
        };
      }
    }

    // Try to find the best alternative from all weighted models
    const weightedModels = await this.getWeightedModels(tenantId, true);
    if (weightedModels.length > 0) {
      const best = weightedModels[0];
      return {
        modelId: best.modelId,
        weight: best.compositeWeight,
        corrected: true,
        corrections: {},
      };
    }

    // All models quarantined — use original model anyway with warning
    logger.warn('All models quarantined, using original model', { tenantId, modelId: requestedModelId });
    return { modelId: requestedModelId, weight: 0.1, corrected: false, corrections: {} };
  }

  // ==========================================================================
  // Weight History & Correction Actions
  // ==========================================================================

  async getWeightHistory(
    tenantId: string,
    modelId?: string,
    days = 30,
    limit = 200
  ): Promise<Array<{
    modelId: string;
    driftScore: number;
    qualityScore: number;
    latencyScore: number;
    costScore: number;
    availabilityScore: number;
    compositeWeight: number;
    calculationMethod: string;
    factors: Record<string, unknown>;
    createdAt: string;
  }>> {
    let query = `SELECT * FROM model_weight_history WHERE tenant_id = $1::uuid`;
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];
    let idx = 2;

    if (modelId) {
      query += ` AND model_id = $${idx}`;
      params.push(stringParam('modelId', modelId));
      idx++;
    }

    query += ` AND created_at >= NOW() - INTERVAL '1 day' * $${idx}`;
    params.push(longParam('days', days));
    idx++;

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(longParam('limit', limit));

    const result = await executeStatement(query, params);

    return (result.rows || []).map(row => ({
      modelId: String(row.model_id),
      driftScore: Number(row.drift_score || 0),
      qualityScore: Number(row.quality_score || 0),
      latencyScore: Number(row.latency_score || 0),
      costScore: Number(row.cost_score || 0),
      availabilityScore: Number(row.availability_score || 0),
      compositeWeight: Number(row.composite_weight || 0),
      calculationMethod: String(row.calculation_method),
      factors: (row.factors as Record<string, unknown>) || {},
      createdAt: String(row.created_at),
    }));
  }

  async getCorrectionActions(
    tenantId: string,
    modelId?: string,
    days = 30,
    limit = 100
  ): Promise<DriftCorrectionAction[]> {
    let query = `SELECT * FROM drift_correction_actions WHERE tenant_id = $1::uuid`;
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];
    let idx = 2;

    if (modelId) {
      query += ` AND model_id = $${idx}`;
      params.push(stringParam('modelId', modelId));
      idx++;
    }

    query += ` AND created_at >= NOW() - INTERVAL '1 day' * $${idx}`;
    params.push(longParam('days', days));
    idx++;

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(longParam('limit', limit));

    const result = await executeStatement(query, params);

    return (result.rows || []).map(row => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      modelId: String(row.model_id),
      actionType: String(row.action_type),
      triggerType: String(row.trigger_type),
      previousState: (row.previous_state as Record<string, unknown>) || {},
      newState: (row.new_state as Record<string, unknown>) || {},
      driftReport: row.drift_report as DriftReport | null,
      reason: String(row.reason || ''),
      performedBy: row.performed_by ? String(row.performed_by) : null,
      revertedAt: row.reverted_at ? String(row.reverted_at) : null,
      createdAt: String(row.created_at),
    }));
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Run drift check and correction for ALL models in a tenant.
   * Called by the security monitoring EventBridge lambda.
   */
  async checkAndCorrectAllModels(tenantId: string): Promise<CorrectionResult[]> {
    // Get all models used in the last 7 days
    const modelsResult = await executeStatement(
      `SELECT DISTINCT model_id FROM usage_logs WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '7 days'`,
      [stringParam('tenantId', tenantId)]
    );

    const results: CorrectionResult[] = [];

    for (const row of (modelsResult.rows || [])) {
      const modelId = String(row.model_id);
      try {
        const result = await this.checkAndCorrect(tenantId, modelId);
        results.push(result);
      } catch (error) {
        logger.error('Drift check failed for model', { tenantId, modelId, error: String(error) });
        results.push({
          modelId,
          actionTaken: 'error',
          previousWeight: 0,
          newWeight: 0,
          isQuarantined: false,
          fallbackModelId: null,
          temperatureAdjustment: null,
          promptAdjustment: null,
          reason: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return results;
  }

  /**
   * Update quality, latency, cost, and availability scores for a model
   * based on recent usage data. Called periodically.
   */
  async recalculateModelScores(tenantId: string, modelId: string): Promise<void> {
    await this.ensureWeightConfig(tenantId, modelId);

    // Quality score: from quality_benchmark_results (latest score)
    const qualityResult = await executeStatement(
      `SELECT score FROM quality_benchmark_results WHERE tenant_id = $1::uuid AND model_id = $2 ORDER BY run_at DESC LIMIT 1`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId)]
    );
    const qualityScore = qualityResult.rows?.[0] ? Number(qualityResult.rows[0].score) : 0.7;

    // Latency score: from usage_logs (normalized: 0ms=1.0, 10000ms=0.0)
    const latencyResult = await executeStatement(
      `SELECT AVG(response_time_ms) as avg_latency FROM usage_logs WHERE tenant_id = $1::uuid AND model_id = $2 AND created_at >= NOW() - INTERVAL '7 days'`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId)]
    );
    const avgLatency = Number(latencyResult.rows?.[0]?.avg_latency || 1000);
    const latencyScore = Math.max(0, 1 - (avgLatency / 10000));

    // Cost score: from model config (normalized: $0=1.0, $0.1/1k=0.0)
    const costResult = await executeStatement(
      `SELECT AVG(cost_cents) as avg_cost FROM usage_logs WHERE tenant_id = $1::uuid AND model_id = $2 AND created_at >= NOW() - INTERVAL '7 days'`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId)]
    );
    const avgCost = Number(costResult.rows?.[0]?.avg_cost || 1);
    const costScore = Math.max(0, 1 - (avgCost / 50)); // $0.50 per request = 0.0

    // Availability score: success rate over last 7 days
    const availResult = await executeStatement(
      `SELECT COUNT(*) FILTER (WHERE success = true) as successes, COUNT(*) as total
       FROM usage_logs WHERE tenant_id = $1::uuid AND model_id = $2 AND created_at >= NOW() - INTERVAL '7 days'`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId)]
    );
    const total = Number(availResult.rows?.[0]?.total || 0);
    const successes = Number(availResult.rows?.[0]?.successes || 0);
    const availabilityScore = total > 0 ? successes / total : 1.0;

    // Update all scores
    await executeStatement(
      `UPDATE model_weight_config
       SET current_quality_score = $3, current_latency_score = $4, current_cost_score = $5, current_availability_score = $6, updated_at = NOW()
       WHERE tenant_id = $1::uuid AND model_id = $2`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        doubleParam('quality', qualityScore),
        doubleParam('latency', latencyScore),
        doubleParam('cost', costScore),
        doubleParam('availability', availabilityScore),
      ]
    );

    // Recalculate composite
    await executeStatement(
      `SELECT calculate_composite_weight($1::uuid, $2)`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId)]
    );
  }

  // ==========================================================================
  // Dashboard Data
  // ==========================================================================

  async getDashboard(tenantId: string): Promise<{
    models: ModelWeightConfig[];
    recentActions: DriftCorrectionAction[];
    quarantinedCount: number;
    averageCompositeWeight: number;
    driftAlertCount: number;
    weightHistory: Array<{ modelId: string; compositeWeight: number; createdAt: string }>;
  }> {
    const [models, recentActions, statsResult, weightHistory] = await Promise.all([
      this.getAllWeightConfigs(tenantId),
      this.getCorrectionActions(tenantId, undefined, 7, 20),
      executeStatement(
        `SELECT
          COUNT(*) FILTER (WHERE is_quarantined = true) as quarantined_count,
          AVG(current_composite_weight) as avg_weight,
          (SELECT COUNT(*) FROM drift_correction_actions WHERE tenant_id = $1::uuid AND action_type = 'quarantine' AND created_at >= NOW() - INTERVAL '24 hours') as drift_alert_count
         FROM model_weight_config WHERE tenant_id = $1::uuid`,
        [stringParam('tenantId', tenantId)]
      ),
      this.getWeightHistory(tenantId, undefined, 7, 50),
    ]);

    const stats = statsResult.rows?.[0] || {};

    return {
      models,
      recentActions,
      quarantinedCount: Number(stats.quarantined_count || 0),
      averageCompositeWeight: Number(stats.avg_weight || 1),
      driftAlertCount: Number(stats.drift_alert_count || 0),
      weightHistory: weightHistory.map(h => ({ modelId: h.modelId, compositeWeight: h.compositeWeight, createdAt: h.createdAt })),
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private computeDriftScoreFromReport(report: DriftReport): number {
    if (!report.overallDriftDetected || report.tests.length === 0) {
      return 1.0; // No drift
    }

    // Compute score from the worst drift test
    // KS test statistic: 0=no drift, 1=max drift → score = 1 - statistic
    // PSI: 0=no drift, 0.25+=significant → score = max(0, 1 - PSI*4)
    let worstScore = 1.0;

    for (const test of report.tests) {
      let score: number;
      switch (test.testType) {
        case 'ks_test':
          score = Math.max(0, 1 - test.testStatistic);
          break;
        case 'psi':
          score = Math.max(0, 1 - test.testStatistic * 4);
          break;
        case 'chi_squared':
          score = test.pValue != null ? Math.min(1, test.pValue * 10) : 0.5;
          break;
        case 'embedding_distance':
          score = Math.max(0, 1 - test.testStatistic * 3);
          break;
        default:
          score = 0.5;
      }
      worstScore = Math.min(worstScore, score);
    }

    return Math.max(0, Math.min(1, worstScore));
  }

  private async ensureWeightConfig(tenantId: string, modelId: string): Promise<void> {
    await executeStatement(
      `INSERT INTO model_weight_config (tenant_id, model_id) VALUES ($1::uuid, $2)
       ON CONFLICT (tenant_id, model_id) DO NOTHING`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId)]
    );
  }

  private async logCorrectionAction(
    tenantId: string,
    modelId: string,
    actionType: string,
    triggerType: string,
    previousState: Record<string, unknown>,
    newState: Record<string, unknown>,
    driftReport: DriftReport | null,
    reason: string,
    performedBy?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO drift_correction_actions (tenant_id, model_id, action_type, trigger_type, previous_state, new_state, drift_report, reason, performed_by)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::uuid)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        stringParam('actionType', actionType),
        stringParam('triggerType', triggerType),
        stringParam('prevState', JSON.stringify(previousState)),
        stringParam('newState', JSON.stringify(newState)),
        stringParam('driftReport', driftReport ? JSON.stringify(driftReport) : '{}'),
        stringParam('reason', reason),
        stringParam('performedBy', performedBy || ''),
      ]
    );
  }

  private rowToWeightConfig(row: Record<string, unknown>): ModelWeightConfig {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      modelId: String(row.model_id),
      manualWeightOverride: row.manual_weight_override != null ? Number(row.manual_weight_override) : null,
      driftFactorWeight: Number(row.drift_factor_weight || 0.25),
      qualityFactorWeight: Number(row.quality_factor_weight || 0.30),
      latencyFactorWeight: Number(row.latency_factor_weight || 0.15),
      costFactorWeight: Number(row.cost_factor_weight || 0.15),
      availabilityFactorWeight: Number(row.availability_factor_weight || 0.15),
      currentDriftScore: Number(row.current_drift_score || 1),
      currentQualityScore: Number(row.current_quality_score || 1),
      currentLatencyScore: Number(row.current_latency_score || 1),
      currentCostScore: Number(row.current_cost_score || 1),
      currentAvailabilityScore: Number(row.current_availability_score || 1),
      currentCompositeWeight: Number(row.current_composite_weight || 1),
      driftQuarantineThreshold: Number(row.drift_quarantine_threshold || 0.3),
      driftPenaltyThreshold: Number(row.drift_penalty_threshold || 0.6),
      driftAutoQuarantine: row.drift_auto_quarantine !== false,
      driftAutoFallbackModelId: row.drift_auto_fallback_model_id ? String(row.drift_auto_fallback_model_id) : null,
      driftTemperatureCorrection: row.drift_temperature_correction != null ? Number(row.drift_temperature_correction) : null,
      driftPromptPrefixCorrection: row.drift_prompt_prefix_correction ? String(row.drift_prompt_prefix_correction) : null,
      isQuarantined: row.is_quarantined === true,
      quarantinedAt: row.quarantined_at ? String(row.quarantined_at) : null,
      quarantineReason: row.quarantine_reason ? String(row.quarantine_reason) : null,
      quarantineExpiresAt: row.quarantine_expires_at ? String(row.quarantine_expires_at) : null,
      quarantineAutoRelease: row.quarantine_auto_release !== false,
      lastWeightCalculationAt: row.last_weight_calculation_at ? String(row.last_weight_calculation_at) : null,
      lastDriftCheckAt: row.last_drift_check_at ? String(row.last_drift_check_at) : null,
    };
  }
}

export const driftCorrectionService = new DriftCorrectionService();
