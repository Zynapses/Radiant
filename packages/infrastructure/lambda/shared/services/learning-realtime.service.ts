// RADIANT v4.18.0 - Learning Real-time Dashboard Service
// WebSocket and SSE support for live learning metrics
// ============================================================================

import { executeStatement, stringParam, longParam } from '../db/client';
import { enhancedLearningService } from './enhanced-learning.service';
import { adapterManagementService } from './adapter-management.service';
import { learningQuotasService } from './learning-quotas.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface RealtimeMetrics {
  timestamp: string;
  tenantId: string;
  // Live counters (last 5 minutes)
  live: {
    requestsPerMinute: number;
    cacheHitsPerMinute: number;
    signalsPerMinute: number;
    candidatesCreated: number;
    avgResponseTimeMs: number;
    avgSatisfactionScore: number;
  };
  // Rolling stats (last hour)
  hourly: {
    totalRequests: number;
    cacheHitRate: number;
    implicitSignals: number;
    candidatesCreated: number;
    avgSatisfactionScore: number;
    topDomains: Array<{ domain: string; count: number }>;
  };
  // Training status
  training: {
    pendingCandidates: number;
    readyForTraining: boolean;
    lastTrainingAt?: string;
    nextScheduledAt?: string;
    currentJobStatus?: string;
  };
  // Alerts
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    createdAt: string;
  }>;
}

export interface MetricsSnapshot {
  timestamp: string;
  requestCount: number;
  cacheHits: number;
  cacheMisses: number;
  avgResponseTimeMs: number;
  avgSatisfactionScore: number;
  signalCount: number;
  candidateCount: number;
}

export type MetricEventType = 
  | 'metrics_update'
  | 'cache_hit'
  | 'cache_miss'
  | 'signal_recorded'
  | 'candidate_created'
  | 'training_started'
  | 'training_completed'
  | 'alert_triggered'
  | 'quota_warning';

export interface MetricEvent {
  eventType: MetricEventType;
  tenantId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Real-time Metrics Service
// ============================================================================

class LearningRealtimeService {
  
  // In-memory event buffer for SSE streaming
  private eventBuffers: Map<string, MetricEvent[]> = new Map();
  private readonly MAX_BUFFER_SIZE = 100;
  
  /**
   * Get current real-time metrics snapshot
   */
  async getRealtimeMetrics(tenantId: string): Promise<RealtimeMetrics> {
    const [live, hourly, training, alerts] = await Promise.all([
      this.getLiveMetrics(tenantId),
      this.getHourlyMetrics(tenantId),
      this.getTrainingStatus(tenantId),
      this.getRecentAlerts(tenantId),
    ]);
    
    return {
      timestamp: new Date().toISOString(),
      tenantId,
      live,
      hourly,
      training,
      alerts,
    };
  }
  
  /**
   * Get metrics for the last 5 minutes
   */
  private async getLiveMetrics(tenantId: string): Promise<RealtimeMetrics['live']> {
    const result = await executeStatement(
      `WITH recent_requests AS (
         SELECT 
           COUNT(*) as request_count,
           AVG(response_time_ms) as avg_response_time,
           AVG(CASE WHEN satisfaction_score > 0 THEN satisfaction_score END) as avg_satisfaction
         FROM usage_logs
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '5 minutes'
       ),
       recent_cache AS (
         SELECT 
           SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits
         FROM usage_logs
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '5 minutes'
       ),
       recent_signals AS (
         SELECT COUNT(*) as signal_count
         FROM implicit_feedback_signals
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '5 minutes'
       ),
       recent_candidates AS (
         SELECT COUNT(*) as candidate_count
         FROM learning_candidates
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '5 minutes'
       )
       SELECT 
         r.request_count,
         r.avg_response_time,
         r.avg_satisfaction,
         c.cache_hits,
         s.signal_count,
         ca.candidate_count
       FROM recent_requests r, recent_cache c, recent_signals s, recent_candidates ca`,
      [stringParam('tenantId', tenantId)]
    );
    
    const row = result.rows?.[0] || {};
    const requestCount = Number(row.request_count || 0);
    
    return {
      requestsPerMinute: requestCount / 5,
      cacheHitsPerMinute: Number(row.cache_hits || 0) / 5,
      signalsPerMinute: Number(row.signal_count || 0) / 5,
      candidatesCreated: Number(row.candidate_count || 0),
      avgResponseTimeMs: Number(row.avg_response_time || 0),
      avgSatisfactionScore: Number(row.avg_satisfaction || 0),
    };
  }
  
  /**
   * Get metrics for the last hour
   */
  private async getHourlyMetrics(tenantId: string): Promise<RealtimeMetrics['hourly']> {
    const [requestsResult, signalsResult, candidatesResult, domainsResult] = await Promise.all([
      executeStatement(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) as hit_rate,
           AVG(CASE WHEN satisfaction_score > 0 THEN satisfaction_score END) as avg_satisfaction
         FROM usage_logs
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 hour'`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT COUNT(*) as count FROM implicit_feedback_signals
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 hour'`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT COUNT(*) as count FROM learning_candidates
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 hour'`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT COALESCE(domain_detected, 'unknown') as domain, COUNT(*) as count
         FROM learning_candidates
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 hour'
         GROUP BY domain_detected
         ORDER BY count DESC
         LIMIT 5`,
        [stringParam('tenantId', tenantId)]
      ),
    ]);
    
    const reqRow = requestsResult.rows?.[0] || {};
    
    return {
      totalRequests: Number(reqRow.total || 0),
      cacheHitRate: Number(reqRow.hit_rate || 0),
      implicitSignals: Number(signalsResult.rows?.[0]?.count || 0),
      candidatesCreated: Number(candidatesResult.rows?.[0]?.count || 0),
      avgSatisfactionScore: Number(reqRow.avg_satisfaction || 0),
      topDomains: (domainsResult.rows || []).map(r => ({
        domain: String(r.domain),
        count: Number(r.count),
      })),
    };
  }
  
  /**
   * Get training status
   */
  private async getTrainingStatus(tenantId: string): Promise<RealtimeMetrics['training']> {
    const config = await enhancedLearningService.getConfig(tenantId);
    
    const [pendingResult, lastJobResult, currentJobResult] = await Promise.all([
      executeStatement(
        `SELECT COUNT(*) as count FROM learning_candidates
         WHERE tenant_id = $1::uuid AND training_status = 'pending' AND expires_at > NOW()`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT completed_at FROM lora_evolution_jobs
         WHERE tenant_id = $1::uuid AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 1`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT status FROM lora_evolution_jobs
         WHERE tenant_id = $1::uuid AND status IN ('pending', 'running')
         ORDER BY scheduled_at DESC LIMIT 1`,
        [stringParam('tenantId', tenantId)]
      ),
    ]);
    
    const pendingCount = Number(pendingResult.rows?.[0]?.count || 0);
    
    return {
      pendingCandidates: pendingCount,
      readyForTraining: pendingCount >= (config?.minCandidatesForTraining || 25),
      lastTrainingAt: lastJobResult.rows?.[0]?.completed_at 
        ? new Date(lastJobResult.rows[0].completed_at as string).toISOString() 
        : undefined,
      nextScheduledAt: undefined, // Would come from EventBridge schedule
      currentJobStatus: currentJobResult.rows?.[0]?.status as string | undefined,
    };
  }
  
  /**
   * Get recent alerts
   */
  private async getRecentAlerts(tenantId: string): Promise<RealtimeMetrics['alerts']> {
    const result = await executeStatement(
      `SELECT alert_type, severity, message, created_at
       FROM learning_alerts_log
       WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC LIMIT 10`,
      [stringParam('tenantId', tenantId)]
    );
    
    return (result.rows || []).map(row => ({
      type: String(row.alert_type),
      severity: String(row.severity),
      message: String(row.message),
      createdAt: new Date(row.created_at as string).toISOString(),
    }));
  }
  
  /**
   * Get historical metrics for charting
   */
  async getMetricsHistory(
    tenantId: string,
    periodHours: number = 24,
    granularityMinutes: number = 15
  ): Promise<MetricsSnapshot[]> {
    const result = await executeStatement(
      `WITH time_buckets AS (
         SELECT generate_series(
           date_trunc('hour', NOW() - INTERVAL '1 hour' * $2),
           NOW(),
           INTERVAL '1 minute' * $3
         ) as bucket_start
       )
       SELECT 
         tb.bucket_start as timestamp,
         COUNT(u.*) as request_count,
         SUM(CASE WHEN u.cache_hit THEN 1 ELSE 0 END) as cache_hits,
         SUM(CASE WHEN NOT u.cache_hit THEN 1 ELSE 0 END) as cache_misses,
         AVG(u.response_time_ms) as avg_response_time,
         AVG(CASE WHEN u.satisfaction_score > 0 THEN u.satisfaction_score END) as avg_satisfaction,
         (SELECT COUNT(*) FROM implicit_feedback_signals s 
          WHERE s.tenant_id = $1::uuid 
            AND s.created_at >= tb.bucket_start 
            AND s.created_at < tb.bucket_start + INTERVAL '1 minute' * $3) as signal_count,
         (SELECT COUNT(*) FROM learning_candidates c 
          WHERE c.tenant_id = $1::uuid 
            AND c.created_at >= tb.bucket_start 
            AND c.created_at < tb.bucket_start + INTERVAL '1 minute' * $3) as candidate_count
       FROM time_buckets tb
       LEFT JOIN usage_logs u ON u.tenant_id = $1::uuid 
         AND u.created_at >= tb.bucket_start 
         AND u.created_at < tb.bucket_start + INTERVAL '1 minute' * $3
       GROUP BY tb.bucket_start
       ORDER BY tb.bucket_start`,
      [
        stringParam('tenantId', tenantId),
        longParam('periodHours', periodHours),
        longParam('granularityMinutes', granularityMinutes),
      ]
    );
    
    return (result.rows || []).map(row => ({
      timestamp: new Date(row.timestamp as string).toISOString(),
      requestCount: Number(row.request_count || 0),
      cacheHits: Number(row.cache_hits || 0),
      cacheMisses: Number(row.cache_misses || 0),
      avgResponseTimeMs: Number(row.avg_response_time || 0),
      avgSatisfactionScore: Number(row.avg_satisfaction || 0),
      signalCount: Number(row.signal_count || 0),
      candidateCount: Number(row.candidate_count || 0),
    }));
  }
  
  // ==========================================================================
  // Event Streaming (SSE Support)
  // ==========================================================================
  
  /**
   * Emit a metric event for streaming
   */
  emitEvent(tenantId: string, event: Omit<MetricEvent, 'tenantId' | 'timestamp'>): void {
    const fullEvent: MetricEvent = {
      ...event,
      tenantId,
      timestamp: new Date().toISOString(),
    };
    
    let buffer = this.eventBuffers.get(tenantId);
    if (!buffer) {
      buffer = [];
      this.eventBuffers.set(tenantId, buffer);
    }
    
    buffer.push(fullEvent);
    
    // Trim buffer if too large
    if (buffer.length > this.MAX_BUFFER_SIZE) {
      buffer.shift();
    }
    
    logger.debug('Emitted metric event', { tenantId, eventType: event.eventType });
  }
  
  /**
   * Get recent events for SSE initial payload
   */
  getRecentEvents(tenantId: string, limit: number = 20): MetricEvent[] {
    const buffer = this.eventBuffers.get(tenantId) || [];
    return buffer.slice(-limit);
  }
  
  /**
   * Create SSE stream generator
   */
  async *createEventStream(tenantId: string): AsyncGenerator<string> {
    // Send initial metrics
    const metrics = await this.getRealtimeMetrics(tenantId);
    yield `event: metrics_update\ndata: ${JSON.stringify(metrics)}\n\n`;
    
    // Send recent events
    const recentEvents = this.getRecentEvents(tenantId);
    for (const event of recentEvents) {
      yield `event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`;
    }
    
    // Keep-alive and updates (in real implementation, would use Redis pub/sub)
    let lastEventCount = recentEvents.length;
    
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
      
      // Check for new events
      const currentEvents = this.eventBuffers.get(tenantId) || [];
      if (currentEvents.length > lastEventCount) {
        const newEvents = currentEvents.slice(lastEventCount);
        for (const event of newEvents) {
          yield `event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`;
        }
        lastEventCount = currentEvents.length;
      }
      
      // Send periodic metrics update
      const updatedMetrics = await this.getRealtimeMetrics(tenantId);
      yield `event: metrics_update\ndata: ${JSON.stringify(updatedMetrics)}\n\n`;
    }
  }
  
  // ==========================================================================
  // Event Recording Helpers
  // ==========================================================================
  
  /**
   * Record cache hit event
   */
  recordCacheHit(tenantId: string, promptHash: string, rating: number): void {
    this.emitEvent(tenantId, {
      eventType: 'cache_hit',
      data: { promptHash, rating },
    });
  }
  
  /**
   * Record cache miss event
   */
  recordCacheMiss(tenantId: string, promptHash: string): void {
    this.emitEvent(tenantId, {
      eventType: 'cache_miss',
      data: { promptHash },
    });
  }
  
  /**
   * Record signal event
   */
  recordSignal(tenantId: string, signalType: string, userId: string): void {
    this.emitEvent(tenantId, {
      eventType: 'signal_recorded',
      data: { signalType, userId },
    });
  }
  
  /**
   * Record candidate created event
   */
  recordCandidateCreated(tenantId: string, candidateType: string, qualityScore: number): void {
    this.emitEvent(tenantId, {
      eventType: 'candidate_created',
      data: { candidateType, qualityScore },
    });
  }
  
  /**
   * Record training event
   */
  recordTrainingEvent(tenantId: string, status: 'started' | 'completed', jobId: string): void {
    this.emitEvent(tenantId, {
      eventType: status === 'started' ? 'training_started' : 'training_completed',
      data: { jobId },
    });
  }
  
  /**
   * Record alert event
   */
  recordAlert(tenantId: string, alertType: string, severity: string, message: string): void {
    this.emitEvent(tenantId, {
      eventType: 'alert_triggered',
      data: { alertType, severity, message },
    });
  }
  
  /**
   * Record quota warning
   */
  recordQuotaWarning(tenantId: string, quotaType: string, usage: number, limit: number): void {
    this.emitEvent(tenantId, {
      eventType: 'quota_warning',
      data: { quotaType, usage, limit, percentUsed: (usage / limit) * 100 },
    });
  }
}

export const learningRealtimeService = new LearningRealtimeService();
