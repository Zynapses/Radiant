// RADIANT v4.18.0 - Behavioral Anomaly Detection Service
// Based on CIC-IDS2017 patterns and CERT Insider Threat methodology
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface UserBaseline {
  tenantId: string;
  userId: string;
  avgRequestsPerHour: number;
  stddevRequestsPerHour: number;
  avgTokensPerRequest: number;
  stddevTokensPerRequest: number;
  typicalHours: Array<{ hour: number; count: number }>;
  typicalDays: Array<{ day: number; count: number }>;
  sessionDurationAvgMinutes: number;
  typicalDomains: string[];
  typicalModels: string[];
  avgPromptLength: number;
  flowDurationAvgMs: number;
  idleTimeBetweenRequestsAvgMs: number;
  sampleCount: number;
  baselineConfidence: number;
}

export interface AnomalyEvent {
  id?: string;
  tenantId: string;
  userId?: string;
  anomalyType: string;
  anomalySubtype?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  anomalyScore: number;
  zScore?: number;
  featureName: string;
  observedValue: number;
  expectedValue: number;
  baselineStddev?: number;
  requestIds?: string[];
  modelIds?: string[];
  status: 'detected' | 'investigating' | 'resolved' | 'false_positive';
}

export interface MarkovTransition {
  fromState: string;
  toState: string;
  probability: number;
  count: number;
}

export interface AnomalyConfig {
  enabled: boolean;
  detectionMethod: string;
  zScoreThreshold: number;
  volumeSpikeMultiplier: number;
  baselineDays: number;
}

// CIC-IDS2017 inspired feature types
type FeatureType = 
  | 'request_volume'
  | 'token_usage'
  | 'temporal_pattern'
  | 'domain_shift'
  | 'model_shift'
  | 'prompt_length'
  | 'session_duration'
  | 'idle_time'
  | 'error_rate'
  | 'response_time';

// ============================================================================
// Behavioral Anomaly Detection Service
// ============================================================================

class BehavioralAnomalyService {
  
  /**
   * Analyze request for anomalies
   */
  async analyzeRequest(
    tenantId: string,
    userId: string,
    request: {
      promptLength: number;
      tokensUsed: number;
      responseTimeMs: number;
      domain?: string;
      modelId?: string;
      sessionId?: string;
      timestamp?: Date;
    }
  ): Promise<{ anomalies: AnomalyEvent[]; riskScore: number }> {
    const config = await this.getAnomalyConfig(tenantId);
    
    if (!config.enabled) {
      return { anomalies: [], riskScore: 0 };
    }
    
    const baseline = await this.getUserBaseline(tenantId, userId);
    const anomalies: AnomalyEvent[] = [];
    
    // Only analyze if we have sufficient baseline data
    if (baseline.sampleCount < 10 || baseline.baselineConfidence < 0.3) {
      // Update baseline instead
      await this.updateBaseline(tenantId, userId, request);
      return { anomalies: [], riskScore: 0 };
    }
    
    // Check prompt length anomaly
    if (baseline.avgPromptLength > 0 && baseline.stddevRequestsPerHour > 0) {
      const promptZScore = this.calculateZScore(
        request.promptLength,
        baseline.avgPromptLength,
        baseline.stddevRequestsPerHour * 10 // Approximate stddev for prompt length
      );
      
      if (Math.abs(promptZScore) > config.zScoreThreshold) {
        anomalies.push(this.createAnomalyEvent(tenantId, userId, {
          type: 'content_shift',
          subtype: 'prompt_length',
          featureName: 'prompt_length',
          observedValue: request.promptLength,
          expectedValue: baseline.avgPromptLength,
          zScore: promptZScore,
          threshold: config.zScoreThreshold,
        }));
      }
    }
    
    // Check token usage anomaly
    if (baseline.avgTokensPerRequest > 0 && baseline.stddevTokensPerRequest > 0) {
      const tokenZScore = this.calculateZScore(
        request.tokensUsed,
        baseline.avgTokensPerRequest,
        baseline.stddevTokensPerRequest
      );
      
      if (Math.abs(tokenZScore) > config.zScoreThreshold) {
        anomalies.push(this.createAnomalyEvent(tenantId, userId, {
          type: 'volume_spike',
          subtype: 'token_usage',
          featureName: 'tokens_per_request',
          observedValue: request.tokensUsed,
          expectedValue: baseline.avgTokensPerRequest,
          zScore: tokenZScore,
          threshold: config.zScoreThreshold,
        }));
      }
    }
    
    // Check domain shift
    if (request.domain && baseline.typicalDomains.length > 0) {
      if (!baseline.typicalDomains.includes(request.domain)) {
        const domainCount = baseline.typicalDomains.length;
        const noveltyScore = 1 / (domainCount + 1); // Higher score = more unusual
        
        if (noveltyScore > 0.3) {
          anomalies.push(this.createAnomalyEvent(tenantId, userId, {
            type: 'content_shift',
            subtype: 'domain_shift',
            featureName: 'domain',
            observedValue: 1,
            expectedValue: 0,
            zScore: noveltyScore * 5,
            threshold: config.zScoreThreshold,
          }));
        }
      }
    }
    
    // Check temporal anomaly (unusual hour)
    const currentHour = (request.timestamp || new Date()).getUTCHours();
    const hourActivity = baseline.typicalHours.find(h => h.hour === currentHour);
    const totalHourActivity = baseline.typicalHours.reduce((sum, h) => sum + h.count, 0);
    
    if (totalHourActivity > 0) {
      const expectedProbability = (hourActivity?.count || 0) / totalHourActivity;
      
      if (expectedProbability < 0.02 && baseline.sampleCount > 50) {
        // User rarely active at this hour
        anomalies.push(this.createAnomalyEvent(tenantId, userId, {
          type: 'temporal_anomaly',
          subtype: 'unusual_hour',
          featureName: 'activity_hour',
          observedValue: currentHour,
          expectedValue: this.getMostActiveHour(baseline.typicalHours),
          zScore: 3.5,
          threshold: config.zScoreThreshold,
        }));
      }
    }
    
    // Check Markov transition probability
    if (request.domain) {
      const transitionAnomaly = await this.checkMarkovTransition(
        tenantId, userId, 'domain_transition', request.domain, config.zScoreThreshold
      );
      if (transitionAnomaly) {
        anomalies.push(transitionAnomaly);
      }
    }
    
    // Update baseline with new data
    await this.updateBaseline(tenantId, userId, request);
    
    // Calculate overall risk score
    const riskScore = this.calculateRiskScore(anomalies);
    
    // Log anomalies
    for (const anomaly of anomalies) {
      await this.logAnomalyEvent(anomaly);
    }
    
    return { anomalies, riskScore };
  }
  
  /**
   * Analyze session for volume anomalies
   */
  async analyzeSessionVolume(
    tenantId: string,
    userId: string,
    windowMinutes: number = 60
  ): Promise<AnomalyEvent | null> {
    const config = await this.getAnomalyConfig(tenantId);
    if (!config.enabled) return null;
    
    const baseline = await this.getUserBaseline(tenantId, userId);
    
    // Get recent request count
    const result = await executeStatement(
      `SELECT COUNT(*) as request_count
       FROM usage_logs
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid
         AND created_at >= NOW() - INTERVAL '1 minute' * $3`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId), longParam('minutes', windowMinutes)]
    );
    
    const recentCount = Number(result.rows?.[0]?.request_count || 0);
    const expectedCount = baseline.avgRequestsPerHour * (windowMinutes / 60);
    
    if (expectedCount > 0 && baseline.stddevRequestsPerHour > 0) {
      const expectedStddev = baseline.stddevRequestsPerHour * (windowMinutes / 60);
      const zScore = this.calculateZScore(recentCount, expectedCount, expectedStddev);
      
      // Check for volume spike
      if (recentCount > expectedCount * config.volumeSpikeMultiplier || zScore > config.zScoreThreshold) {
        const anomaly = this.createAnomalyEvent(tenantId, userId, {
          type: 'volume_spike',
          subtype: 'request_burst',
          featureName: 'requests_per_hour',
          observedValue: recentCount * (60 / windowMinutes), // Normalize to hourly
          expectedValue: baseline.avgRequestsPerHour,
          zScore,
          threshold: config.zScoreThreshold,
        });
        
        await this.logAnomalyEvent(anomaly);
        return anomaly;
      }
    }
    
    return null;
  }
  
  /**
   * Get user baseline
   */
  async getUserBaseline(tenantId: string, userId: string): Promise<UserBaseline> {
    const result = await executeStatement(
      `SELECT * FROM user_behavior_baselines WHERE tenant_id = $1::uuid AND user_id = $2::uuid`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );
    
    if (!result.rows?.length) {
      return this.getEmptyBaseline(tenantId, userId);
    }
    
    const row = result.rows[0];
    return {
      tenantId,
      userId,
      avgRequestsPerHour: Number(row.avg_requests_per_hour || 0),
      stddevRequestsPerHour: Number(row.stddev_requests_per_hour || 0),
      avgTokensPerRequest: Number(row.avg_tokens_per_request || 0),
      stddevTokensPerRequest: Number(row.stddev_tokens_per_request || 0),
      typicalHours: (row.typical_hours as Array<{ hour: number; count: number }>) || [],
      typicalDays: (row.typical_days as Array<{ day: number; count: number }>) || [],
      sessionDurationAvgMinutes: Number(row.session_duration_avg_minutes || 0),
      typicalDomains: (row.typical_domains as string[]) || [],
      typicalModels: (row.typical_models as string[]) || [],
      avgPromptLength: Number(row.avg_prompt_length || 0),
      flowDurationAvgMs: Number(row.flow_duration_avg_ms || 0),
      idleTimeBetweenRequestsAvgMs: Number(row.idle_time_between_requests_avg_ms || 0),
      sampleCount: Number(row.sample_count || 0),
      baselineConfidence: Number(row.baseline_confidence || 0),
    };
  }
  
  /**
   * Update user baseline with new observation
   */
  async updateBaseline(
    tenantId: string,
    userId: string,
    observation: {
      promptLength: number;
      tokensUsed: number;
      responseTimeMs: number;
      domain?: string;
      modelId?: string;
      timestamp?: Date;
    }
  ): Promise<void> {
    const baseline = await this.getUserBaseline(tenantId, userId);
    const n = baseline.sampleCount;
    const timestamp = observation.timestamp || new Date();
    const hour = timestamp.getUTCHours();
    const day = timestamp.getUTCDay();
    
    // Incremental mean and stddev update (Welford's algorithm simplified)
    const newAvgTokens = this.incrementalMean(baseline.avgTokensPerRequest, observation.tokensUsed, n);
    const newAvgPromptLength = this.incrementalMean(baseline.avgPromptLength, observation.promptLength, n);
    
    // Update typical hours
    const typicalHours = [...baseline.typicalHours];
    const hourEntry = typicalHours.find(h => h.hour === hour);
    if (hourEntry) {
      hourEntry.count++;
    } else {
      typicalHours.push({ hour, count: 1 });
    }
    
    // Update typical days
    const typicalDays = [...baseline.typicalDays];
    const dayEntry = typicalDays.find(d => d.day === day);
    if (dayEntry) {
      dayEntry.count++;
    } else {
      typicalDays.push({ day, count: 1 });
    }
    
    // Update typical domains
    const typicalDomains = [...baseline.typicalDomains];
    if (observation.domain && !typicalDomains.includes(observation.domain)) {
      typicalDomains.push(observation.domain);
    }
    
    // Update typical models
    const typicalModels = [...baseline.typicalModels];
    if (observation.modelId && !typicalModels.includes(observation.modelId)) {
      typicalModels.push(observation.modelId);
    }
    
    // Calculate confidence (increases with sample count)
    const newConfidence = Math.min(1, Math.log10(n + 2) / 3);
    
    await executeStatement(
      `INSERT INTO user_behavior_baselines (
        tenant_id, user_id, avg_tokens_per_request, avg_prompt_length,
        typical_hours, typical_days, typical_domains, typical_models,
        sample_count, baseline_confidence, first_observed_at, last_updated_at
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        avg_tokens_per_request = $3,
        avg_prompt_length = $4,
        typical_hours = $5::jsonb,
        typical_days = $6::jsonb,
        typical_domains = $7,
        typical_models = $8,
        sample_count = $9,
        baseline_confidence = $10,
        last_updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        doubleParam('avgTokens', newAvgTokens),
        doubleParam('avgPromptLength', newAvgPromptLength),
        stringParam('typicalHours', JSON.stringify(typicalHours)),
        stringParam('typicalDays', JSON.stringify(typicalDays)),
        stringParam('typicalDomains', `{${typicalDomains.join(',')}}`),
        stringParam('typicalModels', `{${typicalModels.join(',')}}`),
        longParam('sampleCount', n + 1),
        doubleParam('confidence', newConfidence),
      ]
    );
  }
  
  /**
   * Update Markov chain transition
   */
  async updateMarkovTransition(
    tenantId: string,
    userId: string,
    stateType: string,
    fromState: string,
    toState: string
  ): Promise<void> {
    // Update transition count
    await executeStatement(
      `INSERT INTO behavior_markov_states (tenant_id, user_id, state_type, from_state, to_state, transition_count, total_from_state_count)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, 1, 1)
       ON CONFLICT (tenant_id, user_id, state_type, from_state, to_state) DO UPDATE SET
         transition_count = behavior_markov_states.transition_count + 1,
         last_observed_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('stateType', stateType),
        stringParam('fromState', fromState),
        stringParam('toState', toState),
      ]
    );
    
    // Update total from_state count for all transitions from this state
    await executeStatement(
      `UPDATE behavior_markov_states 
       SET total_from_state_count = (
         SELECT SUM(transition_count) 
         FROM behavior_markov_states b2 
         WHERE b2.tenant_id = behavior_markov_states.tenant_id 
           AND b2.user_id = behavior_markov_states.user_id 
           AND b2.state_type = behavior_markov_states.state_type 
           AND b2.from_state = behavior_markov_states.from_state
       )
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND state_type = $3 AND from_state = $4`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('stateType', stateType),
        stringParam('fromState', fromState),
      ]
    );
  }
  
  /**
   * Check if a Markov transition is anomalous
   */
  private async checkMarkovTransition(
    tenantId: string,
    userId: string,
    stateType: string,
    toState: string,
    threshold: number
  ): Promise<AnomalyEvent | null> {
    // Get the most recent from_state
    const recentResult = await executeStatement(
      `SELECT to_state as last_state FROM behavior_markov_states
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND state_type = $3
       ORDER BY last_observed_at DESC LIMIT 1`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId), stringParam('stateType', stateType)]
    );
    
    if (!recentResult.rows?.length) return null;
    
    const fromState = String(recentResult.rows[0].last_state);
    
    // Get transition probability
    const transResult = await executeStatement(
      `SELECT probability FROM behavior_markov_states
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid 
         AND state_type = $3 AND from_state = $4 AND to_state = $5`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('stateType', stateType),
        stringParam('fromState', fromState),
        stringParam('toState', toState),
      ]
    );
    
    const probability = Number(transResult.rows?.[0]?.probability || 0);
    
    // If transition has never been seen or is very rare
    if (probability < 0.05) {
      return this.createAnomalyEvent(tenantId, userId, {
        type: 'pattern_deviation',
        subtype: 'unlikely_transition',
        featureName: `${stateType}_transition`,
        observedValue: probability,
        expectedValue: 0.2, // Expected minimum for normal transitions
        zScore: (0.2 - probability) / 0.1,
        threshold,
      });
    }
    
    return null;
  }
  
  /**
   * Get anomaly events for tenant
   */
  async getAnomalyEvents(
    tenantId: string,
    options?: { userId?: string; severity?: string; status?: string; limit?: number; since?: Date }
  ): Promise<AnomalyEvent[]> {
    let query = `SELECT * FROM anomaly_events WHERE tenant_id = $1::uuid`;
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];
    let idx = 2;
    
    if (options?.userId) {
      query += ` AND user_id = $${idx}::uuid`;
      params.push(stringParam('userId', options.userId));
      idx++;
    }
    
    if (options?.severity) {
      query += ` AND severity = $${idx}`;
      params.push(stringParam('severity', options.severity));
      idx++;
    }
    
    if (options?.status) {
      query += ` AND status = $${idx}`;
      params.push(stringParam('status', options.status));
      idx++;
    }
    
    if (options?.since) {
      query += ` AND created_at >= $${idx}`;
      params.push(stringParam('since', options.since.toISOString()));
      idx++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(longParam('limit', options?.limit || 100));
    
    const result = await executeStatement(query, params);
    
    return (result.rows || []).map(row => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      userId: row.user_id ? String(row.user_id) : undefined,
      anomalyType: String(row.anomaly_type),
      anomalySubtype: row.anomaly_subtype ? String(row.anomaly_subtype) : undefined,
      severity: row.severity as 'low' | 'medium' | 'high' | 'critical',
      anomalyScore: Number(row.anomaly_score),
      zScore: row.z_score ? Number(row.z_score) : undefined,
      featureName: String(row.feature_name),
      observedValue: Number(row.observed_value),
      expectedValue: Number(row.expected_value),
      baselineStddev: row.baseline_stddev ? Number(row.baseline_stddev) : undefined,
      requestIds: (row.request_ids as string[]) || [],
      modelIds: (row.model_ids as string[]) || [],
      status: row.status as 'detected' | 'investigating' | 'resolved' | 'false_positive',
    }));
  }
  
  /**
   * Update anomaly event status
   */
  async updateAnomalyStatus(
    tenantId: string,
    anomalyId: string,
    status: 'investigating' | 'resolved' | 'false_positive',
    resolvedBy?: string,
    notes?: string
  ): Promise<void> {
    await executeStatement(
      `UPDATE anomaly_events SET 
        status = $1, 
        resolution_notes = $2,
        resolved_by = $3::uuid,
        resolved_at = CASE WHEN $1 IN ('resolved', 'false_positive') THEN NOW() ELSE NULL END
       WHERE tenant_id = $4::uuid AND id = $5::uuid`,
      [
        stringParam('status', status),
        stringParam('notes', notes || ''),
        stringParam('resolvedBy', resolvedBy || ''),
        stringParam('tenantId', tenantId),
        stringParam('anomalyId', anomalyId),
      ]
    );
  }
  
  /**
   * Get anomaly configuration
   */
  async getAnomalyConfig(tenantId: string): Promise<AnomalyConfig> {
    const result = await executeStatement(
      `SELECT behavioral_anomaly_enabled, anomaly_detection_method, 
              anomaly_z_score_threshold, anomaly_volume_spike_multiplier, anomaly_baseline_days
       FROM security_protection_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    if (!result.rows?.length) {
      return {
        enabled: false,
        detectionMethod: 'markov_zscore',
        zScoreThreshold: 3.0,
        volumeSpikeMultiplier: 5.0,
        baselineDays: 30,
      };
    }
    
    const row = result.rows[0];
    return {
      enabled: row.behavioral_anomaly_enabled === true,
      detectionMethod: String(row.anomaly_detection_method || 'markov_zscore'),
      zScoreThreshold: Number(row.anomaly_z_score_threshold || 3.0),
      volumeSpikeMultiplier: Number(row.anomaly_volume_spike_multiplier || 5.0),
      baselineDays: Number(row.anomaly_baseline_days || 30),
    };
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private getEmptyBaseline(tenantId: string, userId: string): UserBaseline {
    return {
      tenantId,
      userId,
      avgRequestsPerHour: 0,
      stddevRequestsPerHour: 0,
      avgTokensPerRequest: 0,
      stddevTokensPerRequest: 0,
      typicalHours: [],
      typicalDays: [],
      sessionDurationAvgMinutes: 0,
      typicalDomains: [],
      typicalModels: [],
      avgPromptLength: 0,
      flowDurationAvgMs: 0,
      idleTimeBetweenRequestsAvgMs: 0,
      sampleCount: 0,
      baselineConfidence: 0,
    };
  }
  
  private calculateZScore(observed: number, mean: number, stddev: number): number {
    if (stddev === 0) return 0;
    return (observed - mean) / stddev;
  }
  
  private incrementalMean(currentMean: number, newValue: number, n: number): number {
    return currentMean + (newValue - currentMean) / (n + 1);
  }
  
  private getMostActiveHour(typicalHours: Array<{ hour: number; count: number }>): number {
    if (typicalHours.length === 0) return 12;
    return typicalHours.reduce((a, b) => a.count > b.count ? a : b).hour;
  }
  
  private createAnomalyEvent(
    tenantId: string,
    userId: string,
    params: {
      type: string;
      subtype?: string;
      featureName: string;
      observedValue: number;
      expectedValue: number;
      zScore: number;
      threshold: number;
    }
  ): AnomalyEvent {
    const absZScore = Math.abs(params.zScore);
    let severity: AnomalyEvent['severity'] = 'low';
    
    if (absZScore > 5) severity = 'critical';
    else if (absZScore > 4) severity = 'high';
    else if (absZScore > 3) severity = 'medium';
    
    return {
      tenantId,
      userId,
      anomalyType: params.type,
      anomalySubtype: params.subtype,
      severity,
      anomalyScore: Math.min(absZScore / 5, 1),
      zScore: params.zScore,
      featureName: params.featureName,
      observedValue: params.observedValue,
      expectedValue: params.expectedValue,
      status: 'detected',
    };
  }
  
  private calculateRiskScore(anomalies: AnomalyEvent[]): number {
    if (anomalies.length === 0) return 0;
    
    const severityWeights = { low: 0.2, medium: 0.4, high: 0.7, critical: 1.0 };
    
    let totalWeight = 0;
    for (const anomaly of anomalies) {
      totalWeight += severityWeights[anomaly.severity] * anomaly.anomalyScore;
    }
    
    return Math.min(totalWeight, 1);
  }
  
  private async logAnomalyEvent(anomaly: AnomalyEvent): Promise<void> {
    await executeStatement(
      `INSERT INTO anomaly_events (
        tenant_id, user_id, anomaly_type, anomaly_subtype, severity,
        anomaly_score, z_score, feature_name, observed_value, expected_value,
        baseline_stddev, request_ids, model_ids, status
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        stringParam('tenantId', anomaly.tenantId),
        stringParam('userId', anomaly.userId || ''),
        stringParam('anomalyType', anomaly.anomalyType),
        stringParam('anomalySubtype', anomaly.anomalySubtype || ''),
        stringParam('severity', anomaly.severity),
        doubleParam('anomalyScore', anomaly.anomalyScore),
        doubleParam('zScore', anomaly.zScore || 0),
        stringParam('featureName', anomaly.featureName),
        doubleParam('observedValue', anomaly.observedValue),
        doubleParam('expectedValue', anomaly.expectedValue),
        doubleParam('baselineStddev', anomaly.baselineStddev || 0),
        stringParam('requestIds', `{${(anomaly.requestIds || []).join(',')}}`),
        stringParam('modelIds', `{${(anomaly.modelIds || []).join(',')}}`),
        stringParam('status', anomaly.status),
      ]
    );
  }
}

export const behavioralAnomalyService = new BehavioralAnomalyService();
