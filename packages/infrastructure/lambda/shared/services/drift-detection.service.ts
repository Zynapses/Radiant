// RADIANT v4.18.0 - Drift Detection Service
// Based on Evidently AI methodology and ChatGPT Behavior Change paper
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { modelRouterService, type ChatMessage } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export interface DriftConfig {
  enabled: boolean;
  useKsTest: boolean;
  usePsi: boolean;
  useChiSquared: boolean;
  useEmbeddingDrift: boolean;
  ksThreshold: number;
  psiThreshold: number;
  chiSquaredThreshold: number;
  embeddingDistanceThreshold: number;
  referenceWindowDays: number;
  comparisonWindowDays: number;
  minimumSamplesForTest: number;
  alertOnDrift: boolean;
  alertCooldownHours: number;
}

export interface DistributionStats {
  sampleCount: number;
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  histogramBins: Array<{ binStart: number; binEnd: number; count: number }>;
}

export interface DriftTestResult {
  testType: 'ks_test' | 'psi' | 'chi_squared' | 'embedding_distance';
  metricName: string;
  driftDetected: boolean;
  testStatistic: number;
  pValue?: number;
  thresholdUsed: number;
  referenceSampleCount: number;
  comparisonSampleCount: number;
}

export interface DriftReport {
  modelId: string;
  reportDate: Date;
  overallDriftDetected: boolean;
  tests: DriftTestResult[];
  recommendations: string[];
}

// ============================================================================
// Statistical Functions
// ============================================================================

/**
 * Kolmogorov-Smirnov test statistic
 * Measures maximum distance between two cumulative distribution functions
 */
function kolmogorovSmirnovTest(sample1: number[], sample2: number[]): { statistic: number; pValue: number } {
  const n1 = sample1.length;
  const n2 = sample2.length;
  
  if (n1 === 0 || n2 === 0) {
    return { statistic: 0, pValue: 1 };
  }
  
  // Sort both samples
  const sorted1 = [...sample1].sort((a, b) => a - b);
  const sorted2 = [...sample2].sort((a, b) => a - b);
  
  // Combine and sort all values
  const allValues = [...sorted1, ...sorted2].sort((a, b) => a - b);
  
  let maxDiff = 0;
  let cdf1 = 0;
  let cdf2 = 0;
  let i1 = 0;
  let i2 = 0;
  
  for (const value of allValues) {
    while (i1 < n1 && sorted1[i1] <= value) {
      cdf1 = (i1 + 1) / n1;
      i1++;
    }
    while (i2 < n2 && sorted2[i2] <= value) {
      cdf2 = (i2 + 1) / n2;
      i2++;
    }
    maxDiff = Math.max(maxDiff, Math.abs(cdf1 - cdf2));
  }
  
  // Approximate p-value using asymptotic distribution
  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  const lambda = (en + 0.12 + 0.11 / en) * maxDiff;
  
  // Kolmogorov distribution approximation
  let pValue = 0;
  for (let k = 1; k <= 100; k++) {
    pValue += 2 * Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
  }
  pValue = Math.max(0, Math.min(1, pValue));
  
  return { statistic: maxDiff, pValue };
}

/**
 * Population Stability Index (PSI)
 * Measures shift between two distributions using binned data
 */
function calculatePSI(
  referenceBins: Array<{ binStart: number; binEnd: number; count: number }>,
  comparisonBins: Array<{ binStart: number; binEnd: number; count: number }>
): number {
  const refTotal = referenceBins.reduce((sum, b) => sum + b.count, 0);
  const compTotal = comparisonBins.reduce((sum, b) => sum + b.count, 0);
  
  if (refTotal === 0 || compTotal === 0) return 0;
  
  let psi = 0;
  
  for (let i = 0; i < referenceBins.length; i++) {
    const refPct = Math.max(referenceBins[i].count / refTotal, 0.0001);
    const compPct = Math.max((comparisonBins[i]?.count || 0) / compTotal, 0.0001);
    
    psi += (compPct - refPct) * Math.log(compPct / refPct);
  }
  
  return psi;
}

/**
 * Chi-squared test for categorical data
 */
function chiSquaredTest(
  observed: number[],
  expected: number[]
): { statistic: number; pValue: number; degreesOfFreedom: number } {
  if (observed.length !== expected.length || observed.length === 0) {
    return { statistic: 0, pValue: 1, degreesOfFreedom: 0 };
  }
  
  let chiSquared = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) {
      chiSquared += Math.pow(observed[i] - expected[i], 2) / expected[i];
    }
  }
  
  const df = observed.length - 1;
  
  // Approximate p-value using chi-squared distribution
  // Using Wilson-Hilferty transformation
  const z = Math.pow(chiSquared / df, 1/3) - (1 - 2 / (9 * df));
  const stdZ = Math.sqrt(2 / (9 * df));
  const pValue = 1 - normalCDF(z / stdZ);
  
  return { statistic: chiSquared, pValue: Math.max(0, Math.min(1, pValue)), degreesOfFreedom: df };
}

/**
 * Cosine distance between embedding centroids
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalCDF(x: number): number {
  // Approximation of standard normal CDF
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1 + sign * y);
}

// ============================================================================
// Drift Detection Service
// ============================================================================

class DriftDetectionService {
  
  /**
   * Run drift detection for a model
   */
  async detectDrift(
    tenantId: string,
    modelId: string,
    metrics: string[] = ['response_length', 'sentiment', 'toxicity']
  ): Promise<DriftReport> {
    const config = await this.getDriftConfig(tenantId);
    
    if (!config.enabled) {
      return {
        modelId,
        reportDate: new Date(),
        overallDriftDetected: false,
        tests: [],
        recommendations: [],
      };
    }
    
    const tests: DriftTestResult[] = [];
    const recommendations: string[] = [];
    
    for (const metric of metrics) {
      // Get reference and comparison distributions
      const reference = await this.getDistribution(tenantId, modelId, metric, 'reference', config);
      const comparison = await this.getDistribution(tenantId, modelId, metric, 'current', config);
      
      if (reference.sampleCount < config.minimumSamplesForTest || 
          comparison.sampleCount < config.minimumSamplesForTest) {
        continue;
      }
      
      // Run KS test
      if (config.useKsTest) {
        const ksResult = await this.runKsTest(tenantId, modelId, metric, reference, comparison, config);
        tests.push(ksResult);
        
        if (ksResult.driftDetected) {
          recommendations.push(`KS test detected drift in ${metric}. Consider investigating model behavior changes.`);
        }
      }
      
      // Run PSI test
      if (config.usePsi && reference.histogramBins.length > 0) {
        const psiResult = this.runPsiTest(modelId, metric, reference, comparison, config);
        tests.push(psiResult);
        
        if (psiResult.driftDetected) {
          if (psiResult.testStatistic > 0.25) {
            recommendations.push(`High PSI (${psiResult.testStatistic.toFixed(3)}) for ${metric}. Significant distribution shift detected.`);
          } else {
            recommendations.push(`Moderate PSI for ${metric}. Monitor for continued drift.`);
          }
        }
      }
    }
    
    // Log drift results
    for (const test of tests) {
      await this.logDriftResult(tenantId, modelId, test, config);
    }
    
    const overallDriftDetected = tests.some(t => t.driftDetected);
    
    if (overallDriftDetected && config.alertOnDrift) {
      await this.sendDriftAlert(tenantId, modelId, tests.filter(t => t.driftDetected));
    }
    
    return {
      modelId,
      reportDate: new Date(),
      overallDriftDetected,
      tests,
      recommendations,
    };
  }
  
  /**
   * Get distribution statistics for a metric
   */
  async getDistribution(
    tenantId: string,
    modelId: string,
    metricName: string,
    periodType: 'reference' | 'current',
    config: DriftConfig
  ): Promise<DistributionStats> {
    // Check for cached distribution
    const cached = await this.getCachedDistribution(tenantId, modelId, metricName, periodType);
    if (cached) return cached;
    
    // Calculate from raw data
    const interval = periodType === 'reference' 
      ? `${config.referenceWindowDays + config.comparisonWindowDays} days`
      : `${config.comparisonWindowDays} days`;
    
    const startOffset = periodType === 'reference'
      ? config.referenceWindowDays + config.comparisonWindowDays
      : config.comparisonWindowDays;
    
    const endOffset = periodType === 'reference'
      ? config.comparisonWindowDays
      : 0;
    
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as sample_count,
        AVG(${this.getMetricColumn(metricName)}) as mean_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${this.getMetricColumn(metricName)}) as median_value,
        STDDEV(${this.getMetricColumn(metricName)}) as stddev_value,
        MIN(${this.getMetricColumn(metricName)}) as min_value,
        MAX(${this.getMetricColumn(metricName)}) as max_value,
        PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY ${this.getMetricColumn(metricName)}) as p5,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${this.getMetricColumn(metricName)}) as p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${this.getMetricColumn(metricName)}) as p75,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${this.getMetricColumn(metricName)}) as p95
       FROM usage_logs
       WHERE tenant_id = $1::uuid AND model_id = $2
         AND created_at >= NOW() - INTERVAL '1 day' * $3
         AND created_at < NOW() - INTERVAL '1 day' * $4`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        longParam('startOffset', startOffset),
        longParam('endOffset', endOffset),
      ]
    );
    
    const row = result.rows?.[0] || {};
    
    // Generate histogram bins
    const histogramBins = await this.generateHistogramBins(
      tenantId, modelId, metricName, startOffset, endOffset
    );
    
    return {
      sampleCount: Number(row.sample_count || 0),
      mean: Number(row.mean_value || 0),
      median: Number(row.median_value || 0),
      stddev: Number(row.stddev_value || 0),
      min: Number(row.min_value || 0),
      max: Number(row.max_value || 0),
      percentiles: {
        p5: Number(row.p5 || 0),
        p25: Number(row.p25 || 0),
        p50: Number(row.median_value || 0),
        p75: Number(row.p75 || 0),
        p95: Number(row.p95 || 0),
      },
      histogramBins,
    };
  }
  
  /**
   * Run Kolmogorov-Smirnov test
   */
  private async runKsTest(
    tenantId: string,
    modelId: string,
    metricName: string,
    reference: DistributionStats,
    comparison: DistributionStats,
    config: DriftConfig
  ): Promise<DriftTestResult> {
    // Get raw samples for KS test
    const refSamples = await this.getRawSamples(
      tenantId, modelId, metricName,
      config.referenceWindowDays + config.comparisonWindowDays,
      config.comparisonWindowDays,
      1000
    );
    
    const compSamples = await this.getRawSamples(
      tenantId, modelId, metricName,
      config.comparisonWindowDays,
      0,
      1000
    );
    
    const { statistic, pValue } = kolmogorovSmirnovTest(refSamples, compSamples);
    
    return {
      testType: 'ks_test',
      metricName,
      driftDetected: statistic > config.ksThreshold || pValue < 0.05,
      testStatistic: statistic,
      pValue,
      thresholdUsed: config.ksThreshold,
      referenceSampleCount: reference.sampleCount,
      comparisonSampleCount: comparison.sampleCount,
    };
  }
  
  /**
   * Run PSI test
   */
  private runPsiTest(
    modelId: string,
    metricName: string,
    reference: DistributionStats,
    comparison: DistributionStats,
    config: DriftConfig
  ): DriftTestResult {
    const psi = calculatePSI(reference.histogramBins, comparison.histogramBins);
    
    // PSI interpretation:
    // < 0.1: No significant change
    // 0.1 - 0.25: Moderate change
    // > 0.25: Significant change
    
    return {
      testType: 'psi',
      metricName,
      driftDetected: psi > config.psiThreshold,
      testStatistic: psi,
      thresholdUsed: config.psiThreshold,
      referenceSampleCount: reference.sampleCount,
      comparisonSampleCount: comparison.sampleCount,
    };
  }
  
  /**
   * Get raw samples for statistical tests
   */
  private async getRawSamples(
    tenantId: string,
    modelId: string,
    metricName: string,
    startDaysAgo: number,
    endDaysAgo: number,
    limit: number
  ): Promise<number[]> {
    const result = await executeStatement(
      `SELECT ${this.getMetricColumn(metricName)} as value
       FROM usage_logs
       WHERE tenant_id = $1::uuid AND model_id = $2
         AND created_at >= NOW() - INTERVAL '1 day' * $3
         AND created_at < NOW() - INTERVAL '1 day' * $4
         AND ${this.getMetricColumn(metricName)} IS NOT NULL
       ORDER BY RANDOM()
       LIMIT $5`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        longParam('startOffset', startDaysAgo),
        longParam('endOffset', endDaysAgo),
        longParam('limit', limit),
      ]
    );
    
    return (result.rows || []).map(r => Number(r.value));
  }
  
  /**
   * Generate histogram bins for PSI calculation
   */
  private async generateHistogramBins(
    tenantId: string,
    modelId: string,
    metricName: string,
    startDaysAgo: number,
    endDaysAgo: number,
    numBins: number = 10
  ): Promise<Array<{ binStart: number; binEnd: number; count: number }>> {
    const result = await executeStatement(
      `WITH bounds AS (
        SELECT 
          MIN(${this.getMetricColumn(metricName)}) as min_val,
          MAX(${this.getMetricColumn(metricName)}) as max_val
        FROM usage_logs
        WHERE tenant_id = $1::uuid AND model_id = $2
          AND created_at >= NOW() - INTERVAL '1 day' * $3
          AND created_at < NOW() - INTERVAL '1 day' * $4
      )
      SELECT 
        width_bucket(${this.getMetricColumn(metricName)}, b.min_val, b.max_val + 0.001, $5) as bucket,
        COUNT(*) as count,
        MIN(${this.getMetricColumn(metricName)}) as bin_min,
        MAX(${this.getMetricColumn(metricName)}) as bin_max
      FROM usage_logs u, bounds b
      WHERE u.tenant_id = $1::uuid AND u.model_id = $2
        AND u.created_at >= NOW() - INTERVAL '1 day' * $3
        AND u.created_at < NOW() - INTERVAL '1 day' * $4
      GROUP BY bucket
      ORDER BY bucket`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        longParam('startOffset', startDaysAgo),
        longParam('endOffset', endDaysAgo),
        longParam('numBins', numBins),
      ]
    );
    
    return (result.rows || []).map(r => ({
      binStart: Number(r.bin_min || 0),
      binEnd: Number(r.bin_max || 0),
      count: Number(r.count || 0),
    }));
  }
  
  /**
   * Run quality benchmark comparison
   */
  async runQualityBenchmark(
    tenantId: string,
    modelId: string,
    benchmarkName: string,
    testCases: Array<{ questionId: string; question: string; expectedAnswer: string }>
  ): Promise<{
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    categoryScores: Record<string, number>;
    significantChange: boolean;
    scoreDelta: number;
  }> {
    // Get baseline score
    const baselineResult = await executeStatement(
      `SELECT score FROM quality_benchmark_results
       WHERE tenant_id = $1::uuid AND model_id = $2 AND benchmark_name = $3
       ORDER BY run_at DESC LIMIT 1`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId), stringParam('benchmarkName', benchmarkName)]
    );
    
    const baselineScore = Number(baselineResult.rows?.[0]?.score || 0);
    
    // Run actual model evaluation on test cases
    const totalQuestions = testCases.length;
    let correctAnswers = 0;
    const categoryCorrect: Record<string, number> = {};
    const categoryTotal: Record<string, number> = {};
    
    for (const testCase of testCases) {
      try {
        const messages: ChatMessage[] = [
          { role: 'system', content: 'Answer the following question. Be concise and accurate.' },
          { role: 'user', content: testCase.question }
        ];
        
        const response = await modelRouterService.invoke({
          modelId,
          messages,
          temperature: 0,
          maxTokens: 256,
        });
        
        // Check if response matches expected answer using semantic similarity
        const isCorrect = this.checkAnswerMatch(response.content, testCase.expectedAnswer);
        if (isCorrect) correctAnswers++;
        
      } catch (error) {
        logger.warn('Test case evaluation failed', { modelId, error: String(error) });
      }
    }
    
    const score = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
    const scoreDelta = score - baselineScore;
    const significantChange = Math.abs(scoreDelta) > 0.1;
    
    // Log benchmark result
    await executeStatement(
      `INSERT INTO quality_benchmark_results (
        tenant_id, model_id, benchmark_name, score, total_questions, correct_answers,
        category_scores, baseline_score, score_delta, significant_change
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        stringParam('benchmarkName', benchmarkName),
        doubleParam('score', score),
        longParam('totalQuestions', totalQuestions),
        longParam('correctAnswers', correctAnswers),
        stringParam('categoryScores', '{}'),
        doubleParam('baselineScore', baselineScore),
        doubleParam('scoreDelta', scoreDelta),
        boolParam('significantChange', significantChange),
      ]
    );
    
    return {
      score,
      totalQuestions,
      correctAnswers,
      categoryScores: {},
      significantChange,
      scoreDelta,
    };
  }
  
  /**
   * Get drift detection history
   */
  async getDriftHistory(
    tenantId: string,
    modelId?: string,
    days: number = 30
  ): Promise<Array<DriftTestResult & { createdAt: Date }>> {
    let query = `SELECT * FROM drift_detection_results WHERE tenant_id = $1::uuid`;
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];
    let idx = 2;
    
    if (modelId) {
      query += ` AND model_id = $${idx}`;
      params.push(stringParam('modelId', modelId));
      idx++;
    }
    
    query += ` AND created_at >= NOW() - INTERVAL '1 day' * $${idx}`;
    params.push(longParam('days', days));
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await executeStatement(query, params);
    
    return (result.rows || []).map(row => ({
      testType: row.test_type as DriftTestResult['testType'],
      metricName: String(row.metric_name),
      driftDetected: row.drift_detected === true,
      testStatistic: Number(row.test_statistic || 0),
      pValue: row.p_value ? Number(row.p_value) : undefined,
      thresholdUsed: Number(row.threshold_used || 0),
      referenceSampleCount: Number(row.reference_sample_count || 0),
      comparisonSampleCount: Number(row.comparison_sample_count || 0),
      createdAt: new Date(row.created_at as string),
    }));
  }
  
  /**
   * Get drift configuration
   */
  async getDriftConfig(tenantId: string): Promise<DriftConfig> {
    const result = await executeStatement(
      `SELECT drift_detection_enabled, drift_ks_threshold, drift_psi_threshold,
              drift_reference_days, drift_comparison_days
       FROM security_protection_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    // Also check drift_detection_config table
    const configResult = await executeStatement(
      `SELECT * FROM drift_detection_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    const row = result.rows?.[0] || {};
    const configRow = configResult.rows?.[0] || {};
    
    return {
      enabled: row.drift_detection_enabled === true || configRow.drift_detection_enabled === true,
      useKsTest: configRow.use_ks_test !== false,
      usePsi: configRow.use_psi !== false,
      useChiSquared: configRow.use_chi_squared !== false,
      useEmbeddingDrift: configRow.use_embedding_drift === true,
      ksThreshold: Number(row.drift_ks_threshold || configRow.ks_threshold || 0.1),
      psiThreshold: Number(row.drift_psi_threshold || configRow.psi_threshold || 0.2),
      chiSquaredThreshold: Number(configRow.chi_squared_threshold || 0.05),
      embeddingDistanceThreshold: Number(configRow.embedding_distance_threshold || 0.3),
      referenceWindowDays: Number(row.drift_reference_days || configRow.reference_window_days || 30),
      comparisonWindowDays: Number(row.drift_comparison_days || configRow.comparison_window_days || 7),
      minimumSamplesForTest: Number(configRow.minimum_samples_for_test || 100),
      alertOnDrift: configRow.alert_on_drift !== false,
      alertCooldownHours: Number(configRow.alert_cooldown_hours || 24),
    };
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private getMetricColumn(metricName: string): string {
    const columnMap: Record<string, string> = {
      response_length: 'response_length',
      sentiment: 'sentiment_score',
      toxicity: 'toxicity_score',
      response_time: 'response_time_ms',
      token_count: 'tokens_used',
    };
    return columnMap[metricName] || metricName;
  }
  
  private async getCachedDistribution(
    tenantId: string,
    modelId: string,
    metricName: string,
    periodType: 'reference' | 'current'
  ): Promise<DistributionStats | null> {
    const result = await executeStatement(
      `SELECT * FROM model_output_distributions
       WHERE tenant_id = $1::uuid AND model_id = $2 
         AND distribution_type = $3 AND period_type = $4
         AND period_end >= NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC LIMIT 1`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        stringParam('distributionType', metricName),
        stringParam('periodType', periodType),
      ]
    );
    
    if (!result.rows?.length) return null;
    
    const row = result.rows[0];
    return {
      sampleCount: Number(row.sample_count || 0),
      mean: Number(row.mean_value || 0),
      median: Number(row.median_value || 0),
      stddev: Number(row.stddev_value || 0),
      min: Number(row.min_value || 0),
      max: Number(row.max_value || 0),
      percentiles: (row.percentiles as DistributionStats['percentiles']) || { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
      histogramBins: (row.histogram_bins as DistributionStats['histogramBins']) || [],
    };
  }
  
  private async logDriftResult(
    tenantId: string,
    modelId: string,
    result: DriftTestResult,
    config: DriftConfig
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO drift_detection_results (
        tenant_id, model_id, test_type, metric_name, drift_detected,
        test_statistic, p_value, threshold_used,
        reference_sample_count, comparison_sample_count
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
        stringParam('testType', result.testType),
        stringParam('metricName', result.metricName),
        boolParam('driftDetected', result.driftDetected),
        doubleParam('testStatistic', result.testStatistic),
        doubleParam('pValue', result.pValue || 0),
        doubleParam('thresholdUsed', result.thresholdUsed),
        longParam('refSampleCount', result.referenceSampleCount),
        longParam('compSampleCount', result.comparisonSampleCount),
      ]
    );
  }
  
  private async sendDriftAlert(
    tenantId: string,
    modelId: string,
    driftedTests: DriftTestResult[]
  ): Promise<void> {
    // Check cooldown
    const recentAlert = await executeStatement(
      `SELECT id FROM drift_detection_results
       WHERE tenant_id = $1::uuid AND model_id = $2 
         AND drift_detected = true AND alert_sent = true
         AND created_at >= NOW() - INTERVAL '1 hour' * $3
       LIMIT 1`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId), longParam('cooldownHours', 24)]
    );
    
    if (recentAlert.rows?.length) {
      return; // Within cooldown period
    }
    
    // Log alert (would typically send to webhook/email)
    logger.warn('Drift detected', {
      tenantId,
      modelId,
      driftedMetrics: driftedTests.map(t => t.metricName),
      severity: 'warning',
    });
    
    // Mark alert as sent
    await executeStatement(
      `UPDATE drift_detection_results SET alert_sent = true, alert_sent_at = NOW()
       WHERE tenant_id = $1::uuid AND model_id = $2 AND drift_detected = true
         AND alert_sent = false`,
      [stringParam('tenantId', tenantId), stringParam('modelId', modelId)]
    );
  }

  /**
   * Check if model answer matches expected answer using semantic similarity
   */
  private checkAnswerMatch(modelAnswer: string, expectedAnswer: string): boolean {
    const normalizedModel = modelAnswer.toLowerCase().trim();
    const normalizedExpected = expectedAnswer.toLowerCase().trim();
    
    // Exact match
    if (normalizedModel === normalizedExpected) return true;
    
    // Contains match (expected answer is in model answer)
    if (normalizedModel.includes(normalizedExpected)) return true;
    
    // Word overlap (Jaccard similarity > 0.5)
    const modelWords = new Set(normalizedModel.split(/\W+/).filter(w => w.length > 2));
    const expectedWords = new Set(normalizedExpected.split(/\W+/).filter(w => w.length > 2));
    
    const intersection = new Set([...modelWords].filter(w => expectedWords.has(w)));
    const union = new Set([...modelWords, ...expectedWords]);
    
    const similarity = union.size > 0 ? intersection.size / union.size : 0;
    return similarity > 0.5;
  }
}

export const driftDetectionService = new DriftDetectionService();
