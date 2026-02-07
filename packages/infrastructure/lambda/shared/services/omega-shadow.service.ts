// RADIANT v4.18.0 - OMEGA Shadow Mode Service
// Enables parallel routing to OMEGA bio-mimetic AI alongside standard orchestration
// Shadow mode allows testing OMEGA responses without affecting production output

import { executeStatement } from '../db/client';
import { driftAwareWeightingService, type DriftSummary } from './drift-aware-weighting.service';

// ============================================================================
// Types
// ============================================================================

export interface OmegaShadowConfig {
  enabled: boolean;
  omegaApiUrl: string;
  shadowPercentage: number; // 0-100, percentage of requests to shadow
  captureResponses: boolean;
  compareResponses: boolean;
  tenantAllowlist?: string[]; // If set, only these tenants use shadow mode
  tenantDenylist?: string[]; // If set, these tenants never use shadow mode
}

export interface OmegaInferenceRequest {
  tenant_id: string;
  session_id?: string;
  prompt: string;
  context?: string[];
  max_tokens?: number;
  temperature?: number;
  firmware_id?: string;
}

export interface OmegaInferenceResponse {
  success: boolean;
  tenant_id: string;
  response: string;
  brain_state: {
    coherence_score: number;
    entropy_level: number;
    thermal_status: 'warm' | 'cooling' | 'cold' | 'frozen';
    cycle_count: number;
  };
  vectorized_count: number;
  time_warp_applied: boolean;
  sleep_duration_seconds: number;
  latency_ms: number;
  timestamp: string;
}

export interface ShadowComparison {
  comparison_id: string;
  tenant_id: string;
  prompt_hash: string;
  standard_response: string;
  omega_response: string;
  standard_latency_ms: number;
  omega_latency_ms: number;
  similarity_score: number;
  omega_coherence: number;
  omega_entropy: number;
  created_at: string;
  // v7.36.0: Drift-aware tracking
  standard_model_drift_score?: number;
  drift_warnings?: string[];
}

export interface ShadowStats {
  total_shadow_requests: number;
  successful_omega_responses: number;
  failed_omega_responses: number;
  avg_omega_latency_ms: number;
  avg_similarity_score: number;
  avg_omega_coherence: number;
  thermal_distribution: {
    warm: number;
    cooling: number;
    cold: number;
    frozen: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OMEGA_CONFIG: OmegaShadowConfig = {
  enabled: false,
  omegaApiUrl: process.env.OMEGA_API_URL || 'http://localhost:3001/api/omega',
  shadowPercentage: 10,
  captureResponses: true,
  compareResponses: true,
};

// ============================================================================
// OMEGA Shadow Service
// ============================================================================

class OmegaShadowService {
  private config: OmegaShadowConfig = DEFAULT_OMEGA_CONFIG;

  // ==========================================================================
  // Configuration
  // ==========================================================================

  async getConfig(tenantId: string): Promise<OmegaShadowConfig> {
    try {
      const result = await executeStatement(
        `SELECT config FROM omega_shadow_config WHERE tenant_id = $1`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const config = typeof row.config === 'string' 
          ? JSON.parse(row.config) 
          : row.config;
        return { ...DEFAULT_OMEGA_CONFIG, ...config };
      }

      // Check global config
      const globalResult = await executeStatement(
        `SELECT config FROM omega_shadow_config WHERE tenant_id = 'global'`,
        []
      );

      if (globalResult.rows.length > 0) {
        const row = globalResult.rows[0] as Record<string, unknown>;
        const config = typeof row.config === 'string' 
          ? JSON.parse(row.config) 
          : row.config;
        return { ...DEFAULT_OMEGA_CONFIG, ...config };
      }

      return DEFAULT_OMEGA_CONFIG;
    } catch {
      return DEFAULT_OMEGA_CONFIG;
    }
  }

  async setConfig(tenantId: string, config: Partial<OmegaShadowConfig>): Promise<void> {
    const mergedConfig = { ...DEFAULT_OMEGA_CONFIG, ...config };

    await executeStatement(
      `INSERT INTO omega_shadow_config (tenant_id, config, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         config = $2,
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'config', value: { stringValue: JSON.stringify(mergedConfig) } },
      ]
    );
  }

  // ==========================================================================
  // Shadow Mode Decision
  // ==========================================================================

  async shouldShadow(tenantId: string): Promise<boolean> {
    const config = await this.getConfig(tenantId);

    if (!config.enabled) return false;

    // Check allowlist
    if (config.tenantAllowlist && config.tenantAllowlist.length > 0) {
      if (!config.tenantAllowlist.includes(tenantId)) return false;
    }

    // Check denylist
    if (config.tenantDenylist && config.tenantDenylist.includes(tenantId)) {
      return false;
    }

    // Probabilistic shadow based on percentage
    return Math.random() * 100 < config.shadowPercentage;
  }

  // ==========================================================================
  // OMEGA Inference
  // ==========================================================================

  async invokeOmega(request: OmegaInferenceRequest): Promise<OmegaInferenceResponse | null> {
    const config = await this.getConfig(request.tenant_id);
    const startTime = Date.now();

    try {
      const response = await fetch(`${config.omegaApiUrl}/inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        console.error(`OMEGA inference failed: ${response.status}`);
        await this.recordFailure(request.tenant_id, 'http_error', response.status);
        return null;
      }

      const data = await response.json() as OmegaInferenceResponse;
      data.latency_ms = Date.now() - startTime;

      return data;
    } catch (error) {
      console.error('OMEGA inference error:', error);
      await this.recordFailure(
        request.tenant_id, 
        'exception', 
        error instanceof Error ? error.message : 'unknown'
      );
      return null;
    }
  }

  // ==========================================================================
  // Shadow Execution (Parallel with Standard)
  // ==========================================================================

  async executeShadow(
    tenantId: string,
    prompt: string,
    standardResponse: string,
    standardLatencyMs: number,
    sessionId?: string
  ): Promise<ShadowComparison | null> {
    const config = await this.getConfig(tenantId);

    if (!config.enabled) return null;

    // Invoke OMEGA in parallel (fire and forget if not capturing)
    const omegaPromise = this.invokeOmega({
      tenant_id: tenantId,
      session_id: sessionId,
      prompt,
    });

    if (!config.captureResponses) {
      // Fire and forget
      omegaPromise.catch(() => {}); // Suppress unhandled rejection
      return null;
    }

    const omegaResponse = await omegaPromise;

    if (!omegaResponse || !omegaResponse.success) {
      return null;
    }

    // Calculate similarity if enabled
    let similarityScore = 0;
    if (config.compareResponses) {
      similarityScore = this.calculateSimilarity(standardResponse, omegaResponse.response);
    }

    // v7.36.0: Get drift summary to track alongside shadow comparison
    let standardModelDriftScore: number | undefined;
    let driftWarnings: string[] | undefined;
    try {
      const driftSummary = await driftAwareWeightingService.getDriftSummary(tenantId);
      standardModelDriftScore = driftSummary.avgDriftScore;
      if (driftSummary.quarantinedModels > 0 || driftSummary.driftWarningModels > 0) {
        driftWarnings = [];
        if (driftSummary.quarantinedModels > 0) {
          driftWarnings.push(`${driftSummary.quarantinedModels} model(s) quarantined`);
        }
        if (driftSummary.driftWarningModels > 0) {
          driftWarnings.push(`${driftSummary.driftWarningModels} model(s) with drift warnings`);
        }
        if (driftSummary.worstModel) {
          driftWarnings.push(`Worst: ${driftSummary.worstModel.modelId} (score: ${driftSummary.worstModel.driftScore.toFixed(3)})`);
        }
      }
    } catch {
      // Drift summary failed, continue without it
    }

    // Store comparison
    const comparison: ShadowComparison = {
      comparison_id: crypto.randomUUID(),
      tenant_id: tenantId,
      prompt_hash: this.hashPrompt(prompt),
      standard_response: standardResponse.substring(0, 10000), // Limit size
      omega_response: omegaResponse.response.substring(0, 10000),
      standard_latency_ms: standardLatencyMs,
      omega_latency_ms: omegaResponse.latency_ms,
      similarity_score: similarityScore,
      omega_coherence: omegaResponse.brain_state.coherence_score,
      omega_entropy: omegaResponse.brain_state.entropy_level,
      created_at: new Date().toISOString(),
      standard_model_drift_score: standardModelDriftScore,
      drift_warnings: driftWarnings,
    };

    await this.storeComparison(comparison);

    return comparison;
  }

  // ==========================================================================
  // Comparison Storage & Analysis
  // ==========================================================================

  private async storeComparison(comparison: ShadowComparison): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO omega_shadow_comparisons (
          comparison_id, tenant_id, prompt_hash, 
          standard_response, omega_response,
          standard_latency_ms, omega_latency_ms,
          similarity_score, omega_coherence, omega_entropy,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          { name: 'comparisonId', value: { stringValue: comparison.comparison_id } },
          { name: 'tenantId', value: { stringValue: comparison.tenant_id } },
          { name: 'promptHash', value: { stringValue: comparison.prompt_hash } },
          { name: 'standardResponse', value: { stringValue: comparison.standard_response } },
          { name: 'omegaResponse', value: { stringValue: comparison.omega_response } },
          { name: 'standardLatencyMs', value: { longValue: comparison.standard_latency_ms } },
          { name: 'omegaLatencyMs', value: { longValue: comparison.omega_latency_ms } },
          { name: 'similarityScore', value: { doubleValue: comparison.similarity_score } },
          { name: 'omegaCoherence', value: { doubleValue: comparison.omega_coherence } },
          { name: 'omegaEntropy', value: { doubleValue: comparison.omega_entropy } },
          { name: 'createdAt', value: { stringValue: comparison.created_at } },
        ]
      );
    } catch (error) {
      console.error('Failed to store shadow comparison:', error);
    }
  }

  async getComparisons(
    tenantId: string,
    limit = 100,
    offset = 0
  ): Promise<ShadowComparison[]> {
    const result = await executeStatement(
      `SELECT * FROM omega_shadow_comparisons 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
        { name: 'offset', value: { longValue: offset } },
      ]
    );

    return result.rows.map(row => this.mapComparison(row as Record<string, unknown>));
  }

  async getShadowStats(tenantId: string, days = 7): Promise<ShadowStats> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN omega_response IS NOT NULL THEN 1 END) as successful,
        AVG(omega_latency_ms) as avg_latency,
        AVG(similarity_score) as avg_similarity,
        AVG(omega_coherence) as avg_coherence
       FROM omega_shadow_comparisons
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const failureResult = await executeStatement(
      `SELECT COUNT(*) as count FROM omega_shadow_failures
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const row = result.rows[0] as Record<string, unknown>;
    const failureRow = failureResult.rows[0] as Record<string, unknown>;

    return {
      total_shadow_requests: Number(row.total || 0) + Number(failureRow.count || 0),
      successful_omega_responses: Number(row.successful || 0),
      failed_omega_responses: Number(failureRow.count || 0),
      avg_omega_latency_ms: Number(row.avg_latency || 0),
      avg_similarity_score: Number(row.avg_similarity || 0),
      avg_omega_coherence: Number(row.avg_coherence || 0),
      thermal_distribution: {
        warm: 0,
        cooling: 0,
        cold: 0,
        frozen: 0,
      },
    };
  }

  // ==========================================================================
  // Failure Tracking
  // ==========================================================================

  private async recordFailure(
    tenantId: string,
    errorType: string,
    errorDetail: string | number
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO omega_shadow_failures (tenant_id, error_type, error_detail, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'errorType', value: { stringValue: errorType } },
          { name: 'errorDetail', value: { stringValue: String(errorDetail) } },
        ]
      );
    } catch {
      // Silent fail for failure recording
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity on word sets
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private hashPrompt(prompt: string): string {
    // Simple hash for prompt deduplication
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private mapComparison(row: Record<string, unknown>): ShadowComparison {
    return {
      comparison_id: String(row.comparison_id),
      tenant_id: String(row.tenant_id),
      prompt_hash: String(row.prompt_hash),
      standard_response: String(row.standard_response || ''),
      omega_response: String(row.omega_response || ''),
      standard_latency_ms: Number(row.standard_latency_ms || 0),
      omega_latency_ms: Number(row.omega_latency_ms || 0),
      similarity_score: Number(row.similarity_score || 0),
      omega_coherence: Number(row.omega_coherence || 0),
      omega_entropy: Number(row.omega_entropy || 0),
      created_at: String(row.created_at),
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const omegaShadowService = new OmegaShadowService();
