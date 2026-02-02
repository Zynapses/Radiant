/**
 * LIVS Weights Service
 * 
 * Manages model integrity weights for Cato integration.
 * Weights factor into model selection (30% default weight).
 * 
 * @version 1.0.0
 * @since v6.3.0
 */

import { Pool } from 'pg';
import {
  ModelIntegrityProfile,
  ModelIntegrityUpdate,
  InterrogationResult,
  LIVSQueryType
} from '@radiant/shared';

export interface LIVSWeightsServiceDeps {
  pool: Pool;
}

export class LIVSWeightsService {
  private pool: Pool;

  constructor(deps: LIVSWeightsServiceDeps) {
    this.pool = deps.pool;
  }

  /**
   * Get integrity profile for a model
   */
  async getModelProfile(
    tenantId: string,
    modelId: string
  ): Promise<ModelIntegrityProfile | null> {
    const result = await this.pool.query(
      `SELECT * FROM livs_model_weights WHERE tenant_id = $1 AND model_id = $2`,
      [tenantId, modelId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProfile(result.rows[0]);
  }

  /**
   * Get integrity profiles for multiple models
   */
  async getModelProfiles(
    tenantId: string,
    modelIds: string[]
  ): Promise<Map<string, ModelIntegrityProfile>> {
    const result = await this.pool.query(
      `SELECT * FROM livs_model_weights WHERE tenant_id = $1 AND model_id = ANY($2)`,
      [tenantId, modelIds]
    );

    const profiles = new Map<string, ModelIntegrityProfile>();
    for (const row of result.rows) {
      const profile = this.mapRowToProfile(row);
      profiles.set(profile.modelId, profile);
    }

    return profiles;
  }

  /**
   * Get all model profiles for a tenant, sorted by lie rate
   */
  async getAllProfiles(
    tenantId: string,
    options?: { sortBy?: 'lie_rate' | 'total_interrogations'; order?: 'asc' | 'desc' }
  ): Promise<ModelIntegrityProfile[]> {
    const sortBy = options?.sortBy ?? 'lie_rate';
    const order = options?.order ?? 'desc';

    const result = await this.pool.query(
      `SELECT * FROM livs_model_weights 
       WHERE tenant_id = $1 
       ORDER BY ${sortBy} ${order}`,
      [tenantId]
    );

    return result.rows.map(this.mapRowToProfile);
  }

  /**
   * Get top lying models
   */
  async getTopLyingModels(
    tenantId: string,
    limit: number = 5,
    minSampleSize: number = 10
  ): Promise<ModelIntegrityProfile[]> {
    const result = await this.pool.query(
      `SELECT * FROM livs_model_weights 
       WHERE tenant_id = $1 AND sample_size >= $3
       ORDER BY lie_rate DESC
       LIMIT $2`,
      [tenantId, limit, minSampleSize]
    );

    return result.rows.map(this.mapRowToProfile);
  }

  /**
   * Get most reliable models
   */
  async getMostReliableModels(
    tenantId: string,
    limit: number = 5,
    minSampleSize: number = 10
  ): Promise<ModelIntegrityProfile[]> {
    const result = await this.pool.query(
      `SELECT * FROM livs_model_weights 
       WHERE tenant_id = $1 AND sample_size >= $3
       ORDER BY lie_rate ASC
       LIMIT $2`,
      [tenantId, limit, minSampleSize]
    );

    return result.rows.map(this.mapRowToProfile);
  }

  /**
   * Update model weights based on interrogation result
   * Note: This is also done via database trigger, but this method
   * allows for more sophisticated updates
   */
  async updateFromInterrogation(
    tenantId: string,
    update: ModelIntegrityUpdate
  ): Promise<void> {
    const { modelId, interrogationResult, domain, queryType } = update;

    // Get current profile
    let profile = await this.getModelProfile(tenantId, modelId);

    if (!profile) {
      // Create new profile
      profile = {
        tenantId,
        modelId,
        totalInterrogations: 0,
        liesDetected: 0,
        lieRate: 0,
        domainLieRates: {},
        questionTypeLieRates: {} as Record<LIVSQueryType, number>,
        calibrationScore: 0.5,
        interrogationResilience: 0.5,
        sampleSize: 0,
        lastUpdated: new Date()
      };
    }

    // Update aggregate stats
    profile.totalInterrogations++;
    profile.sampleSize++;
    if (interrogationResult.lieDetected) {
      profile.liesDetected++;
    }
    profile.lieRate = profile.liesDetected / profile.totalInterrogations;

    // Update domain-specific rates (exponential moving average)
    if (domain) {
      const currentRate = profile.domainLieRates[domain] ?? 0.5;
      const alpha = 0.1; // Smoothing factor
      profile.domainLieRates[domain] = currentRate * (1 - alpha) + 
        (interrogationResult.lieDetected ? 1 : 0) * alpha;
    }

    // Update query type rates
    if (queryType) {
      const currentRate = profile.questionTypeLieRates[queryType] ?? 0.5;
      const alpha = 0.1;
      profile.questionTypeLieRates[queryType] = currentRate * (1 - alpha) + 
        (interrogationResult.lieDetected ? 1 : 0) * alpha;
    }

    // Update calibration score based on confidence delta
    const confidenceDelta = Math.abs(interrogationResult.signals.confidenceDelta);
    const alpha = 0.05;
    profile.calibrationScore = profile.calibrationScore * (1 - alpha) + 
      (1 - confidenceDelta) * alpha;

    // Update interrogation resilience
    // High resilience = maintains claims under questioning
    const weakenCount = interrogationResult.exchanges.filter(
      e => e.analysis.verdict === 'weakens'
    ).length;
    const totalExchanges = interrogationResult.exchanges.length || 1;
    const resilience = 1 - (weakenCount / totalExchanges);
    profile.interrogationResilience = profile.interrogationResilience * (1 - alpha) + 
      resilience * alpha;

    profile.lastUpdated = new Date();

    // Save updated profile
    await this.pool.query(
      `INSERT INTO livs_model_weights (
        tenant_id, model_id, total_interrogations, lies_detected, lie_rate,
        domain_lie_rates, question_type_lie_rates, calibration_score,
        interrogation_resilience, sample_size, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (tenant_id, model_id) DO UPDATE SET
        total_interrogations = EXCLUDED.total_interrogations,
        lies_detected = EXCLUDED.lies_detected,
        lie_rate = EXCLUDED.lie_rate,
        domain_lie_rates = EXCLUDED.domain_lie_rates,
        question_type_lie_rates = EXCLUDED.question_type_lie_rates,
        calibration_score = EXCLUDED.calibration_score,
        interrogation_resilience = EXCLUDED.interrogation_resilience,
        sample_size = EXCLUDED.sample_size,
        last_updated = EXCLUDED.last_updated`,
      [
        profile.tenantId,
        profile.modelId,
        profile.totalInterrogations,
        profile.liesDetected,
        profile.lieRate,
        JSON.stringify(profile.domainLieRates),
        JSON.stringify(profile.questionTypeLieRates),
        profile.calibrationScore,
        profile.interrogationResilience,
        profile.sampleSize,
        profile.lastUpdated
      ]
    );
  }

  /**
   * Get integrity score for model selection
   * Returns 0-1 score (higher = more trustworthy)
   */
  async getIntegrityScore(
    tenantId: string,
    modelId: string,
    context?: { domain?: string; queryType?: LIVSQueryType }
  ): Promise<number> {
    const profile = await this.getModelProfile(tenantId, modelId);

    if (!profile || profile.sampleSize < 5) {
      // Not enough data, return neutral score
      return 0.5;
    }

    let score = 1 - profile.lieRate; // Base: inverse of lie rate

    // Adjust for domain if applicable
    if (context?.domain && profile.domainLieRates[context.domain] !== undefined) {
      const domainRate = profile.domainLieRates[context.domain];
      score = score * 0.7 + (1 - domainRate) * 0.3;
    }

    // Adjust for query type if applicable
    if (context?.queryType && profile.questionTypeLieRates[context.queryType] !== undefined) {
      const typeRate = profile.questionTypeLieRates[context.queryType];
      score = score * 0.7 + (1 - typeRate) * 0.3;
    }

    // Factor in calibration (well-calibrated models are more trustworthy)
    score = score * 0.8 + profile.calibrationScore * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get global model weights (cross-tenant aggregation)
   */
  async getGlobalWeights(modelId: string): Promise<{
    lieRate: number;
    calibrationScore: number;
    contributingTenants: number;
    totalInterrogations: number;
  } | null> {
    const result = await this.pool.query(
      `SELECT * FROM livs_global_model_weights WHERE model_id = $1`,
      [modelId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      lieRate: parseFloat(row.lie_rate),
      calibrationScore: parseFloat(row.calibration_score),
      contributingTenants: row.contributing_tenants,
      totalInterrogations: row.total_interrogations
    };
  }

  /**
   * Aggregate global weights (called by Twilight Dreaming)
   */
  async aggregateGlobalWeights(): Promise<void> {
    await this.pool.query(`SELECT aggregate_livs_global_weights()`);
  }

  /**
   * Get lie rate trend for a model
   */
  async getLieRateTrend(
    tenantId: string,
    modelId: string,
    days: number = 30
  ): Promise<{ date: string; lieRate: number; count: number }[]> {
    const result = await this.pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN lie_detected THEN 1 ELSE 0 END) as lies
       FROM livs_interrogations
       WHERE tenant_id = $1 
         AND original_model_id = $2
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [tenantId, modelId]
    );

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      lieRate: row.total > 0 ? row.lies / row.total : 0,
      count: parseInt(row.total)
    }));
  }

  /**
   * Get domain breakdown for a model
   */
  async getDomainBreakdown(
    tenantId: string,
    modelId: string
  ): Promise<{ domain: string; lieRate: number; sampleSize: number }[]> {
    const result = await this.pool.query(
      `SELECT 
        domain,
        COUNT(*) as total,
        SUM(CASE WHEN lie_detected THEN 1 ELSE 0 END) as lies
       FROM livs_interrogations
       WHERE tenant_id = $1 
         AND original_model_id = $2
         AND domain IS NOT NULL
       GROUP BY domain
       ORDER BY total DESC`,
      [tenantId, modelId]
    );

    return result.rows.map(row => ({
      domain: row.domain,
      lieRate: row.total > 0 ? row.lies / row.total : 0,
      sampleSize: parseInt(row.total)
    }));
  }

  /**
   * Map database row to ModelIntegrityProfile
   */
  private mapRowToProfile(row: Record<string, unknown>): ModelIntegrityProfile {
    return {
      tenantId: row.tenant_id as string,
      modelId: row.model_id as string,
      totalInterrogations: row.total_interrogations as number,
      liesDetected: row.lies_detected as number,
      lieRate: parseFloat(row.lie_rate as string),
      domainLieRates: row.domain_lie_rates as Record<string, number>,
      questionTypeLieRates: row.question_type_lie_rates as Record<LIVSQueryType, number>,
      calibrationScore: parseFloat(row.calibration_score as string),
      interrogationResilience: parseFloat(row.interrogation_resilience as string),
      sampleSize: row.sample_size as number,
      lastUpdated: new Date(row.last_updated as string)
    };
  }
}
