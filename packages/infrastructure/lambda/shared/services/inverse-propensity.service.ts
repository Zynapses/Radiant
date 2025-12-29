// RADIANT v4.18.0 - Inverse Propensity Scoring Service
// Corrects selection bias in model performance estimates
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface IPSConfig {
  enabled: boolean;
  clippingThreshold: number;
  estimationMethod: 'ips' | 'snips' | 'doubly_robust';
}

export interface SelectionProbability {
  tenantId: string;
  domainId: string;
  modelId: string;
  timesSelected: number;
  timesAvailable: number;
  selectionProbability: number;
  propensityScore: number;
  inverseWeight: number;
  clippedWeight: number;
}

export interface IPSEstimate {
  tenantId: string;
  domainId: string;
  modelId: string;
  rawSuccessRate: number;
  rawSampleCount: number;
  ipsSuccessRate: number;
  ipsVariance: number;
  ipsConfidenceIntervalLower: number;
  ipsConfidenceIntervalUpper: number;
  snipsSuccessRate: number;
  drSuccessRate: number;
  estimationMethod: string;
}

export interface ModelSelectionRecord {
  modelId: string;
  wasSelected: boolean;
  wasSuccessful?: boolean;
  candidateModels: string[];
  timestamp: Date;
}

// ============================================================================
// Inverse Propensity Scoring Service
// ============================================================================

class InversePropensityService {
  
  /**
   * Record a model selection event for propensity tracking
   */
  async recordSelection(
    tenantId: string,
    domainId: string,
    selectedModelId: string,
    candidateModels: string[],
    wasSuccessful?: boolean
  ): Promise<void> {
    const periodStart = this.getCurrentPeriodStart();
    const periodEnd = this.getCurrentPeriodEnd();
    
    // Update selection counts for all candidate models
    for (const modelId of candidateModels) {
      const wasSelected = modelId === selectedModelId;
      
      await executeStatement(
        `INSERT INTO model_selection_probabilities (
          tenant_id, domain_id, model_id, period_start, period_end,
          times_selected, times_available
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, 1)
        ON CONFLICT (tenant_id, domain_id, model_id, period_start) DO UPDATE SET
          times_selected = model_selection_probabilities.times_selected + $6,
          times_available = model_selection_probabilities.times_available + 1`,
        [
          stringParam('tenantId', tenantId),
          stringParam('domainId', domainId),
          stringParam('modelId', modelId),
          stringParam('periodStart', periodStart.toISOString()),
          stringParam('periodEnd', periodEnd.toISOString()),
          longParam('selected', wasSelected ? 1 : 0),
        ]
      );
    }
    
    // If we have outcome data, record for IPS calculation
    if (wasSuccessful !== undefined) {
      await this.recordOutcome(tenantId, domainId, selectedModelId, wasSuccessful);
    }
  }
  
  /**
   * Record outcome for selected model
   */
  async recordOutcome(
    tenantId: string,
    domainId: string,
    modelId: string,
    wasSuccessful: boolean
  ): Promise<void> {
    // Store in a separate outcomes table or usage_logs
    // This is used for calculating success rates
    await executeStatement(
      `INSERT INTO usage_logs (tenant_id, domain_id, model_id, was_successful, created_at)
       VALUES ($1::uuid, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [
        stringParam('tenantId', tenantId),
        stringParam('domainId', domainId),
        stringParam('modelId', modelId),
        boolParam('wasSuccessful', wasSuccessful),
      ]
    );
  }
  
  /**
   * Calculate propensity scores for models in a domain
   */
  async calculatePropensityScores(
    tenantId: string,
    domainId: string
  ): Promise<SelectionProbability[]> {
    const config = await this.getIPSConfig(tenantId);
    
    const result = await executeStatement(
      `SELECT model_id, times_selected, times_available, selection_probability
       FROM model_selection_probabilities
       WHERE tenant_id = $1::uuid AND domain_id = $2
         AND period_start >= NOW() - INTERVAL '30 days'`,
      [stringParam('tenantId', tenantId), stringParam('domainId', domainId)]
    );
    
    const probabilities: SelectionProbability[] = [];
    
    for (const row of result.rows || []) {
      const selectionProb = Number(row.selection_probability || 0);
      const propensityScore = Math.max(selectionProb, 0.01); // Minimum to avoid division by zero
      const inverseWeight = 1 / propensityScore;
      const clippedWeight = Math.min(inverseWeight, config.clippingThreshold);
      
      probabilities.push({
        tenantId,
        domainId,
        modelId: String(row.model_id),
        timesSelected: Number(row.times_selected || 0),
        timesAvailable: Number(row.times_available || 0),
        selectionProbability: selectionProb,
        propensityScore,
        inverseWeight,
        clippedWeight,
      });
      
      // Update propensity scores in database
      await executeStatement(
        `UPDATE model_selection_probabilities SET
          propensity_score = $1,
          inverse_propensity_weight = $2,
          clipped_ipw = $3
         WHERE tenant_id = $4::uuid AND domain_id = $5 AND model_id = $6
           AND period_start >= NOW() - INTERVAL '30 days'`,
        [
          doubleParam('propensityScore', propensityScore),
          doubleParam('inverseWeight', inverseWeight),
          doubleParam('clippedWeight', clippedWeight),
          stringParam('tenantId', tenantId),
          stringParam('domainId', domainId),
          stringParam('modelId', String(row.model_id)),
        ]
      );
    }
    
    return probabilities;
  }
  
  /**
   * Calculate IPS-corrected performance estimates
   */
  async calculateIPSEstimates(
    tenantId: string,
    domainId: string
  ): Promise<IPSEstimate[]> {
    const config = await this.getIPSConfig(tenantId);
    
    if (!config.enabled) {
      return [];
    }
    
    // Get propensity scores
    const propensities = await this.calculatePropensityScores(tenantId, domainId);
    const propensityMap = new Map(propensities.map(p => [p.modelId, p]));
    
    // Get raw success rates
    const rawResult = await executeStatement(
      `SELECT 
        model_id,
        COUNT(*) as sample_count,
        SUM(CASE WHEN was_successful THEN 1 ELSE 0 END) as successes
       FROM usage_logs
       WHERE tenant_id = $1::uuid AND domain_id = $2
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY model_id`,
      [stringParam('tenantId', tenantId), stringParam('domainId', domainId)]
    );
    
    const estimates: IPSEstimate[] = [];
    
    for (const row of rawResult.rows || []) {
      const modelId = String(row.model_id);
      const sampleCount = Number(row.sample_count || 0);
      const successes = Number(row.successes || 0);
      const rawSuccessRate = sampleCount > 0 ? successes / sampleCount : 0;
      
      const propensity = propensityMap.get(modelId);
      
      if (!propensity || sampleCount < 5) {
        // Not enough data for IPS
        estimates.push({
          tenantId,
          domainId,
          modelId,
          rawSuccessRate,
          rawSampleCount: sampleCount,
          ipsSuccessRate: rawSuccessRate,
          ipsVariance: 0,
          ipsConfidenceIntervalLower: rawSuccessRate,
          ipsConfidenceIntervalUpper: rawSuccessRate,
          snipsSuccessRate: rawSuccessRate,
          drSuccessRate: rawSuccessRate,
          estimationMethod: 'raw',
        });
        continue;
      }
      
      // Calculate IPS estimate
      const ipsEstimate = this.calculateIPS(successes, sampleCount, propensity.clippedWeight);
      
      // Calculate SNIPS (Self-Normalized IPS)
      const snipsEstimate = this.calculateSNIPS(successes, sampleCount, propensity.clippedWeight);
      
      // Calculate Doubly Robust estimate
      const drEstimate = this.calculateDoublyRobust(
        successes, sampleCount, propensity.clippedWeight, rawSuccessRate
      );
      
      // Calculate variance and confidence interval
      const { variance, lower, upper } = this.calculateIPSVariance(
        successes, sampleCount, propensity.clippedWeight, ipsEstimate
      );
      
      const estimate: IPSEstimate = {
        tenantId,
        domainId,
        modelId,
        rawSuccessRate,
        rawSampleCount: sampleCount,
        ipsSuccessRate: ipsEstimate,
        ipsVariance: variance,
        ipsConfidenceIntervalLower: lower,
        ipsConfidenceIntervalUpper: upper,
        snipsSuccessRate: snipsEstimate,
        drSuccessRate: drEstimate,
        estimationMethod: config.estimationMethod,
      };
      
      estimates.push(estimate);
      
      // Store estimate
      await this.storeIPSEstimate(estimate);
    }
    
    return estimates;
  }
  
  /**
   * Get IPS-corrected model ranking for selection
   */
  async getIPSCorrectedRanking(
    tenantId: string,
    domainId: string,
    candidateModels: string[]
  ): Promise<Array<{ modelId: string; correctedScore: number; confidence: number }>> {
    const config = await this.getIPSConfig(tenantId);
    
    if (!config.enabled) {
      // Return raw scores if IPS disabled
      return candidateModels.map(modelId => ({
        modelId,
        correctedScore: 0.5, // Neutral score
        confidence: 0,
      }));
    }
    
    const estimates = await this.getStoredIPSEstimates(tenantId, domainId);
    const estimateMap = new Map(estimates.map(e => [e.modelId, e]));
    
    const ranking: Array<{ modelId: string; correctedScore: number; confidence: number }> = [];
    
    for (const modelId of candidateModels) {
      const estimate = estimateMap.get(modelId);
      
      if (estimate) {
        // Use the configured estimation method
        let score: number;
        switch (config.estimationMethod) {
          case 'snips':
            score = estimate.snipsSuccessRate;
            break;
          case 'doubly_robust':
            score = estimate.drSuccessRate;
            break;
          case 'ips':
          default:
            score = estimate.ipsSuccessRate;
        }
        
        // Calculate confidence based on sample size and variance
        const confidence = this.calculateConfidence(estimate);
        
        ranking.push({ modelId, correctedScore: score, confidence });
      } else {
        // No estimate available, use exploration bonus
        ranking.push({ modelId, correctedScore: 0.5, confidence: 0 });
      }
    }
    
    // Sort by corrected score descending
    ranking.sort((a, b) => b.correctedScore - a.correctedScore);
    
    return ranking;
  }
  
  /**
   * Get IPS configuration
   */
  async getIPSConfig(tenantId: string): Promise<IPSConfig> {
    const result = await executeStatement(
      `SELECT ips_enabled, ips_clipping_threshold, ips_estimation_method
       FROM security_protection_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    if (!result.rows?.length) {
      return {
        enabled: false,
        clippingThreshold: 10.0,
        estimationMethod: 'snips',
      };
    }
    
    const row = result.rows[0];
    return {
      enabled: row.ips_enabled === true,
      clippingThreshold: Number(row.ips_clipping_threshold || 10.0),
      estimationMethod: (row.ips_estimation_method as IPSConfig['estimationMethod']) || 'snips',
    };
  }
  
  /**
   * Get selection bias report
   */
  async getSelectionBiasReport(
    tenantId: string,
    domainId?: string
  ): Promise<{
    totalSelections: number;
    uniqueModels: number;
    mostSelectedModel: { modelId: string; percentage: number } | null;
    leastSelectedModel: { modelId: string; percentage: number } | null;
    selectionEntropy: number;
    biasIndex: number;
    recommendations: string[];
  }> {
    let query = `SELECT model_id, SUM(times_selected) as total_selected, SUM(times_available) as total_available
                 FROM model_selection_probabilities
                 WHERE tenant_id = $1::uuid`;
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];
    
    if (domainId) {
      query += ` AND domain_id = $2`;
      params.push(stringParam('domainId', domainId));
    }
    
    query += ` AND period_start >= NOW() - INTERVAL '30 days' GROUP BY model_id`;
    
    const result = await executeStatement(query, params);
    
    if (!result.rows?.length) {
      return {
        totalSelections: 0,
        uniqueModels: 0,
        mostSelectedModel: null,
        leastSelectedModel: null,
        selectionEntropy: 0,
        biasIndex: 0,
        recommendations: ['Not enough data to analyze selection bias.'],
      };
    }
    
    const models = result.rows.map(r => ({
      modelId: String(r.model_id),
      selected: Number(r.total_selected || 0),
      available: Number(r.total_available || 0),
    }));
    
    const totalSelections = models.reduce((sum, m) => sum + m.selected, 0);
    const uniqueModels = models.length;
    
    // Calculate selection percentages
    const modelPercentages = models.map(m => ({
      modelId: m.modelId,
      percentage: totalSelections > 0 ? m.selected / totalSelections : 0,
    }));
    
    modelPercentages.sort((a, b) => b.percentage - a.percentage);
    
    const mostSelectedModel = modelPercentages[0] || null;
    const leastSelectedModel = modelPercentages[modelPercentages.length - 1] || null;
    
    // Calculate Shannon entropy for selection distribution
    let entropy = 0;
    for (const m of modelPercentages) {
      if (m.percentage > 0) {
        entropy -= m.percentage * Math.log2(m.percentage);
      }
    }
    
    // Maximum entropy for uniform distribution
    const maxEntropy = Math.log2(uniqueModels);
    
    // Bias index: 0 = uniform, 1 = completely biased
    const biasIndex = maxEntropy > 0 ? 1 - (entropy / maxEntropy) : 0;
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (biasIndex > 0.7) {
      recommendations.push('High selection bias detected. Consider increasing exploration.');
    }
    
    if (mostSelectedModel && mostSelectedModel.percentage > 0.8) {
      recommendations.push(`${mostSelectedModel.modelId} receives ${(mostSelectedModel.percentage * 100).toFixed(1)}% of selections. IPS correction may significantly adjust estimates.`);
    }
    
    if (leastSelectedModel && leastSelectedModel.percentage < 0.05 && uniqueModels > 3) {
      recommendations.push(`${leastSelectedModel.modelId} is under-explored (${(leastSelectedModel.percentage * 100).toFixed(1)}%). Consider forced exploration.`);
    }
    
    if (biasIndex < 0.3) {
      recommendations.push('Selection distribution is relatively balanced. IPS corrections will be minimal.');
    }
    
    return {
      totalSelections,
      uniqueModels,
      mostSelectedModel,
      leastSelectedModel,
      selectionEntropy: entropy,
      biasIndex,
      recommendations,
    };
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private getCurrentPeriodStart(): Date {
    const now = new Date();
    // Round down to start of day
    now.setUTCHours(0, 0, 0, 0);
    return now;
  }
  
  private getCurrentPeriodEnd(): Date {
    const now = new Date();
    // Round up to end of day
    now.setUTCHours(23, 59, 59, 999);
    return now;
  }
  
  /**
   * Standard IPS estimator
   * E[Y] = (1/n) * Σ (Y_i * w_i)
   * where w_i = 1/P(selected)
   */
  private calculateIPS(successes: number, sampleCount: number, weight: number): number {
    if (sampleCount === 0) return 0;
    // Weighted success rate
    return Math.min(1, Math.max(0, (successes / sampleCount) * weight));
  }
  
  /**
   * Self-Normalized IPS (SNIPS)
   * More stable than IPS, especially with high variance weights
   * E[Y] = Σ(Y_i * w_i) / Σ(w_i)
   */
  private calculateSNIPS(successes: number, sampleCount: number, weight: number): number {
    if (sampleCount === 0) return 0;
    
    const weightedSum = successes * weight;
    const normalizer = sampleCount * weight;
    
    if (normalizer === 0) return 0;
    
    return Math.min(1, Math.max(0, weightedSum / normalizer));
  }
  
  /**
   * Doubly Robust estimator
   * Combines IPS with a direct method (regression) for lower variance
   * DR = (1/n) * Σ [ (Y_i - μ(x_i)) * w_i + μ(x_i) ]
   */
  private calculateDoublyRobust(
    successes: number,
    sampleCount: number,
    weight: number,
    directEstimate: number
  ): number {
    if (sampleCount === 0) return directEstimate;
    
    const observedRate = successes / sampleCount;
    const ipsCorrection = (observedRate - directEstimate) * weight;
    
    return Math.min(1, Math.max(0, directEstimate + ipsCorrection));
  }
  
  /**
   * Calculate variance and confidence intervals for IPS estimate
   */
  private calculateIPSVariance(
    successes: number,
    sampleCount: number,
    weight: number,
    ipsEstimate: number
  ): { variance: number; lower: number; upper: number } {
    if (sampleCount < 2) {
      return { variance: 0, lower: ipsEstimate, upper: ipsEstimate };
    }
    
    // Variance of weighted estimate
    const rawRate = successes / sampleCount;
    const variance = (weight * weight * rawRate * (1 - rawRate)) / sampleCount;
    
    // 95% confidence interval
    const z = 1.96;
    const se = Math.sqrt(variance);
    
    return {
      variance,
      lower: Math.max(0, ipsEstimate - z * se),
      upper: Math.min(1, ipsEstimate + z * se),
    };
  }
  
  /**
   * Calculate confidence based on sample size and variance
   */
  private calculateConfidence(estimate: IPSEstimate): number {
    // Confidence is higher with more samples and lower variance
    const sampleFactor = Math.min(1, estimate.rawSampleCount / 100);
    const varianceFactor = 1 - Math.min(1, estimate.ipsVariance * 10);
    const intervalWidth = estimate.ipsConfidenceIntervalUpper - estimate.ipsConfidenceIntervalLower;
    const intervalFactor = 1 - Math.min(1, intervalWidth);
    
    return (sampleFactor * 0.4 + varianceFactor * 0.3 + intervalFactor * 0.3);
  }
  
  /**
   * Store IPS estimate in database
   */
  private async storeIPSEstimate(estimate: IPSEstimate): Promise<void> {
    await executeStatement(
      `INSERT INTO ips_corrected_estimates (
        tenant_id, domain_id, model_id, raw_success_rate, raw_sample_count,
        ips_success_rate, ips_variance, ips_confidence_interval_lower, ips_confidence_interval_upper,
        snips_success_rate, dr_success_rate, estimation_method, period_start, period_end
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW() - INTERVAL '30 days', NOW())
      ON CONFLICT DO NOTHING`,
      [
        stringParam('tenantId', estimate.tenantId),
        stringParam('domainId', estimate.domainId),
        stringParam('modelId', estimate.modelId),
        doubleParam('rawSuccessRate', estimate.rawSuccessRate),
        longParam('rawSampleCount', estimate.rawSampleCount),
        doubleParam('ipsSuccessRate', estimate.ipsSuccessRate),
        doubleParam('ipsVariance', estimate.ipsVariance),
        doubleParam('ipsLower', estimate.ipsConfidenceIntervalLower),
        doubleParam('ipsUpper', estimate.ipsConfidenceIntervalUpper),
        doubleParam('snipsSuccessRate', estimate.snipsSuccessRate),
        doubleParam('drSuccessRate', estimate.drSuccessRate),
        stringParam('estimationMethod', estimate.estimationMethod),
      ]
    );
  }
  
  /**
   * Get stored IPS estimates
   */
  private async getStoredIPSEstimates(
    tenantId: string,
    domainId: string
  ): Promise<IPSEstimate[]> {
    const result = await executeStatement(
      `SELECT * FROM ips_corrected_estimates
       WHERE tenant_id = $1::uuid AND domain_id = $2
         AND created_at >= NOW() - INTERVAL '1 day'
       ORDER BY created_at DESC`,
      [stringParam('tenantId', tenantId), stringParam('domainId', domainId)]
    );
    
    const seen = new Set<string>();
    const estimates: IPSEstimate[] = [];
    
    for (const row of result.rows || []) {
      const modelId = String(row.model_id);
      if (seen.has(modelId)) continue;
      seen.add(modelId);
      
      estimates.push({
        tenantId,
        domainId,
        modelId,
        rawSuccessRate: Number(row.raw_success_rate || 0),
        rawSampleCount: Number(row.raw_sample_count || 0),
        ipsSuccessRate: Number(row.ips_success_rate || 0),
        ipsVariance: Number(row.ips_variance || 0),
        ipsConfidenceIntervalLower: Number(row.ips_confidence_interval_lower || 0),
        ipsConfidenceIntervalUpper: Number(row.ips_confidence_interval_upper || 0),
        snipsSuccessRate: Number(row.snips_success_rate || 0),
        drSuccessRate: Number(row.dr_success_rate || 0),
        estimationMethod: String(row.estimation_method || 'ips'),
      });
    }
    
    return estimates;
  }
}

export const inversePropensityService = new InversePropensityService();
