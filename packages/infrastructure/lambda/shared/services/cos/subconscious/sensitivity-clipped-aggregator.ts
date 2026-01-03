/**
 * SensitivityClippedAggregator v6.0.5
 * 
 * PURPOSE: Implement differential privacy for system-wide learning
 * 
 * PROBLEM (without clipping):
 *   - Sensitivity = N users (each user's data has unbounded influence)
 *   - Noise scale = 2N (to achieve ε-DP)
 *   - Result: USELESS (noise drowns signal when N is large)
 * 
 * SOLUTION (Gemini):
 *   - Clip each tenant's contribution to 1 (bounded sensitivity)
 *   - Sensitivity = 1 (regardless of tenant count)
 *   - Noise scale = 2 (constant, useful signal preserved)
 * 
 * This enables learning from aggregate patterns WITHOUT exposing
 * individual user behavior.
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/subconscious/sensitivity-clipped-aggregator.ts
 */

import { DifferentialPrivacyResult, DifferentialPrivacyConfig, DP_DEFAULTS } from '../types';

/**
 * SensitivityClippedAggregator - Privacy-preserving aggregation
 * 
 * Implements differential privacy with sensitivity clipping:
 * - Each tenant/user contributes at most 1 to the aggregate
 * - Laplacian noise added for plausible deniability
 * - Minimum tenant threshold prevents re-identification
 */
export class SensitivityClippedAggregator {
  private config: DifferentialPrivacyConfig;
  
  constructor(config: Partial<DifferentialPrivacyConfig> = {}) {
    this.config = { ...DP_DEFAULTS, ...config };
  }
  
  /**
   * Aggregate values with differential privacy
   * 
   * @param values - Map of tenant ID to their metric value
   * @param epsilon - Privacy budget (lower = more private)
   * @returns Differentially private aggregate with metadata
   * @throws Error if fewer than minTenants
   */
  aggregate(
    values: Map<string, number>, 
    epsilon: number = this.config.epsilon
  ): DifferentialPrivacyResult {
    // Minimum tenant check (prevents re-identification)
    if (values.size < this.config.minTenants) {
      throw new Error(
        `Insufficient tenants for differential privacy: need ${this.config.minTenants}, have ${values.size}. ` +
        `This protects individual tenant privacy.`
      );
    }
    
    // SENSITIVITY CLIPPING: Each tenant contributes exactly 1 maximum
    let clippedCount = 0;
    let clippedSum = 0;
    
    for (const [, value] of values) {
      // Clip to [-1, 1] range
      const clipped = Math.max(
        -this.config.sensitivityBound, 
        Math.min(this.config.sensitivityBound, value)
      );
      
      if (clipped !== value) {
        clippedCount++;
      }
      
      clippedSum += clipped;
    }
    
    // Calculate mean (bounded by clipping)
    const originalValue = clippedSum / values.size;
    
    // Add Laplacian noise
    // With sensitivity = 1 (due to clipping), noise scale = 1/epsilon
    const noiseScale = this.config.sensitivityBound / epsilon;
    const noise = this.laplacianNoise(noiseScale);
    
    return {
      originalValue,
      noisyValue: originalValue + noise,
      noiseScale,
      epsilon,
      sensitivityClipped: true, // ALWAYS true per Gemini mandate
      clippedCount,
    };
  }
  
  /**
   * Aggregate multiple metrics at once
   */
  aggregateMultiple(
    metrics: Record<string, Map<string, number>>,
    epsilon: number = this.config.epsilon
  ): Record<string, DifferentialPrivacyResult> {
    // Split epsilon budget across metrics (composition theorem)
    const perMetricEpsilon = epsilon / Object.keys(metrics).length;
    
    const results: Record<string, DifferentialPrivacyResult> = {};
    
    for (const [metricName, values] of Object.entries(metrics)) {
      try {
        results[metricName] = this.aggregate(values, perMetricEpsilon);
      } catch (error) {
        console.warn(`[COS DP] Skipping metric ${metricName}: ${error}`);
      }
    }
    
    return results;
  }
  
  /**
   * Aggregate counts (special case for counting queries)
   */
  aggregateCount(
    tenantCounts: Map<string, number>,
    maxCountPerTenant: number = 1,
    epsilon: number = this.config.epsilon
  ): DifferentialPrivacyResult {
    // Clip counts per tenant
    const clippedCounts = new Map<string, number>();
    let clippedCount = 0;
    
    for (const [tenantId, count] of tenantCounts) {
      const clipped = Math.min(count, maxCountPerTenant);
      if (clipped !== count) clippedCount++;
      clippedCounts.set(tenantId, clipped);
    }
    
    // Sum clipped counts
    let total = 0;
    for (const count of clippedCounts.values()) {
      total += count;
    }
    
    // Add noise (sensitivity = maxCountPerTenant)
    const noiseScale = maxCountPerTenant / epsilon;
    const noise = this.laplacianNoise(noiseScale);
    
    return {
      originalValue: total,
      noisyValue: Math.max(0, total + noise), // Counts can't be negative
      noiseScale,
      epsilon,
      sensitivityClipped: true,
      clippedCount,
    };
  }
  
  /**
   * Aggregate binary values (yes/no, present/absent)
   */
  aggregateBinary(
    tenantValues: Map<string, boolean>,
    epsilon: number = this.config.epsilon
  ): DifferentialPrivacyResult & { proportion: number } {
    // Convert to numeric (0 or 1)
    const numericValues = new Map<string, number>();
    for (const [tenantId, value] of tenantValues) {
      numericValues.set(tenantId, value ? 1 : 0);
    }
    
    const result = this.aggregate(numericValues, epsilon);
    
    return {
      ...result,
      proportion: Math.max(0, Math.min(1, result.noisyValue)), // Clamp to [0, 1]
    };
  }
  
  /**
   * Check if aggregation is safe (enough tenants)
   */
  canAggregate(tenantCount: number): boolean {
    return tenantCount >= this.config.minTenants;
  }
  
  /**
   * Get privacy guarantee explanation
   */
  explainPrivacy(epsilon: number = this.config.epsilon): string {
    const ratio = Math.exp(epsilon);
    return [
      `Privacy Guarantee (ε = ${epsilon}):`,
      `- Any individual tenant's inclusion/exclusion changes output probability by at most ${ratio.toFixed(2)}x`,
      `- Sensitivity clipping ensures each tenant contributes at most ${this.config.sensitivityBound}`,
      `- Minimum ${this.config.minTenants} tenants required for aggregation`,
      `- Laplacian noise (scale = ${(this.config.sensitivityBound / epsilon).toFixed(2)}) provides plausible deniability`,
    ].join('\n');
  }
  
  /**
   * Generate Laplacian noise for DP
   * 
   * Laplace distribution: f(x) = (1/2b) * exp(-|x|/b)
   * where b is the scale parameter
   */
  private laplacianNoise(scale: number): number {
    // Generate uniform random in (-0.5, 0.5)
    const u = Math.random() - 0.5;
    
    // Inverse CDF of Laplace distribution
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DifferentialPrivacyConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): DifferentialPrivacyConfig {
    return { ...this.config };
  }
}

/**
 * Singleton instance with default config
 */
export const sensitivityClippedAggregator = new SensitivityClippedAggregator();

/**
 * Utility function for quick aggregation
 */
export function aggregateWithDP(
  values: Map<string, number>,
  epsilon: number = DP_DEFAULTS.epsilon
): DifferentialPrivacyResult {
  return sensitivityClippedAggregator.aggregate(values, epsilon);
}
