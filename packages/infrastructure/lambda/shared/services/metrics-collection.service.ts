/**
 * RADIANT v4.18.56 - Metrics Collection Service
 * Comprehensive metrics collection for billing, performance, failures, violations, and logs
 */

import { Pool } from 'pg';
import {
  BillingMetric,
  BillingMetricInput,
  PerformanceMetric,
  PerformanceMetricInput,
  FailureEvent,
  FailureEventInput,
  PromptViolation,
  PromptViolationInput,
  SystemLog,
  SystemLogInput,
  MetricsSummary,
  TenantDailyMetrics,
  MetricsDashboard,
  MetricsQueryParams,
} from '@radiant/shared';
import { createHash } from 'crypto';

export class MetricsCollectionService {
  constructor(private pool: Pool) {}

  // ============================================================================
  // BILLING METRICS
  // ============================================================================

  async recordBillingMetric(input: BillingMetricInput): Promise<string> {
    const now = new Date();
    const periodDate = now.toISOString().split('T')[0];
    const periodHour = now.getHours();

    const result = await this.pool.query(
      `INSERT INTO billing_metrics (
        tenant_id, user_id, period_date, period_hour,
        model_id, provider_id,
        input_tokens, output_tokens, total_tokens,
        input_cost_cents, output_cost_cents, total_cost_cents,
        storage_bytes_used, storage_cost_cents,
        compute_seconds, compute_cost_cents,
        api_calls, successful_calls, failed_calls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (tenant_id, user_id, period_date, period_hour, model_id)
      DO UPDATE SET
        input_tokens = billing_metrics.input_tokens + EXCLUDED.input_tokens,
        output_tokens = billing_metrics.output_tokens + EXCLUDED.output_tokens,
        total_tokens = billing_metrics.total_tokens + EXCLUDED.total_tokens,
        input_cost_cents = billing_metrics.input_cost_cents + EXCLUDED.input_cost_cents,
        output_cost_cents = billing_metrics.output_cost_cents + EXCLUDED.output_cost_cents,
        total_cost_cents = billing_metrics.total_cost_cents + EXCLUDED.total_cost_cents,
        storage_bytes_used = COALESCE(EXCLUDED.storage_bytes_used, billing_metrics.storage_bytes_used),
        api_calls = billing_metrics.api_calls + 1,
        successful_calls = billing_metrics.successful_calls + CASE WHEN $18 THEN 1 ELSE 0 END,
        failed_calls = billing_metrics.failed_calls + CASE WHEN $18 THEN 0 ELSE 1 END
      RETURNING id`,
      [
        input.tenantId,
        input.userId || null,
        periodDate,
        periodHour,
        input.modelId || null,
        input.providerId || null,
        input.inputTokens || 0,
        input.outputTokens || 0,
        (input.inputTokens || 0) + (input.outputTokens || 0),
        0, // input_cost_cents - calculated separately
        0, // output_cost_cents - calculated separately
        input.costCents || 0,
        input.storageBytesUsed || 0,
        0, // storage_cost_cents
        input.computeSeconds || 0,
        0, // compute_cost_cents
        1,
        input.success !== false ? 1 : 0,
        input.success === false ? 1 : 0,
      ]
    );

    return result.rows[0].id;
  }

  async getBillingMetrics(
    tenantId: string,
    params: MetricsQueryParams
  ): Promise<BillingMetric[]> {
    const result = await this.pool.query(
      `SELECT * FROM billing_metrics
       WHERE tenant_id = $1
         AND period_date >= $2
         AND period_date <= $3
         ${params.userId ? 'AND user_id = $4' : ''}
         ${params.modelId ? `AND model_id = $${params.userId ? 5 : 4}` : ''}
       ORDER BY period_date DESC, period_hour DESC
       LIMIT $${params.userId && params.modelId ? 6 : params.userId || params.modelId ? 5 : 4}
       OFFSET $${params.userId && params.modelId ? 7 : params.userId || params.modelId ? 6 : 5}`,
      [
        tenantId,
        params.startDate,
        params.endDate,
        ...(params.userId ? [params.userId] : []),
        ...(params.modelId ? [params.modelId] : []),
        params.limit || 100,
        params.offset || 0,
      ].filter(Boolean)
    );

    return result.rows.map(this.mapBillingMetric);
  }

  // ============================================================================
  // PERFORMANCE METRICS
  // ============================================================================

  async recordPerformanceMetric(input: PerformanceMetricInput): Promise<string> {
    const now = new Date();
    const periodMinute = new Date(now.setSeconds(0, 0));

    const result = await this.pool.query(
      `INSERT INTO performance_metrics (
        tenant_id, user_id, recorded_at, period_minute,
        endpoint, method, model_id, provider_id,
        total_latency_ms, time_to_first_token_ms, inference_time_ms,
        request_size_bytes, response_size_bytes,
        status_code, success
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        input.tenantId,
        input.userId || null,
        now.toISOString(),
        periodMinute.toISOString(),
        input.endpoint || null,
        input.method || null,
        input.modelId || null,
        input.providerId || null,
        input.totalLatencyMs || null,
        input.timeToFirstTokenMs || null,
        input.inferenceTimeMs || null,
        input.requestSizeBytes || null,
        input.responseSizeBytes || null,
        input.statusCode || null,
        input.success !== false,
      ]
    );

    return result.rows[0].id;
  }

  async getPerformanceMetrics(
    tenantId: string,
    params: MetricsQueryParams
  ): Promise<PerformanceMetric[]> {
    const result = await this.pool.query(
      `SELECT * FROM performance_metrics
       WHERE tenant_id = $1
         AND recorded_at >= $2
         AND recorded_at <= $3
       ORDER BY recorded_at DESC
       LIMIT $4 OFFSET $5`,
      [
        tenantId,
        params.startDate,
        params.endDate,
        params.limit || 100,
        params.offset || 0,
      ]
    );

    return result.rows.map(this.mapPerformanceMetric);
  }

  async getLatencyPercentiles(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    avg: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_latency_ms) as p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_latency_ms) as p75,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_latency_ms) as p90,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY total_latency_ms) as p99,
        AVG(total_latency_ms) as avg
       FROM performance_metrics
       WHERE tenant_id = $1
         AND recorded_at >= $2
         AND recorded_at <= $3
         AND total_latency_ms IS NOT NULL`,
      [tenantId, startDate, endDate]
    );

    const row = result.rows[0];
    return {
      p50: Number(row.p50) || 0,
      p75: Number(row.p75) || 0,
      p90: Number(row.p90) || 0,
      p95: Number(row.p95) || 0,
      p99: Number(row.p99) || 0,
      avg: Number(row.avg) || 0,
    };
  }

  // ============================================================================
  // FAILURE TRACKING
  // ============================================================================

  async recordFailure(input: FailureEventInput): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO failure_events (
        tenant_id, user_id, occurred_at,
        failure_type, severity,
        endpoint, model_id, provider_id,
        orchestration_id, conversation_id,
        error_code, error_message, error_stack,
        request_id
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        input.tenantId,
        input.userId || null,
        input.failureType,
        input.severity,
        input.endpoint || null,
        input.modelId || null,
        input.providerId || null,
        input.orchestrationId || null,
        input.conversationId || null,
        input.errorCode || null,
        input.errorMessage || null,
        input.errorStack || null,
        input.requestId || null,
      ]
    );

    return result.rows[0].id;
  }

  async getFailures(
    tenantId: string,
    params: MetricsQueryParams & { severity?: string; unresolved?: boolean }
  ): Promise<FailureEvent[]> {
    let query = `SELECT * FROM failure_events
                 WHERE tenant_id = $1
                   AND occurred_at >= $2
                   AND occurred_at <= $3`;
    const queryParams: unknown[] = [tenantId, params.startDate, params.endDate];
    let paramIndex = 4;

    if (params.severity) {
      query += ` AND severity = $${paramIndex++}`;
      queryParams.push(params.severity);
    }

    if (params.unresolved) {
      query += ` AND resolved = false`;
    }

    query += ` ORDER BY occurred_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    queryParams.push(params.limit || 100, params.offset || 0);

    const result = await this.pool.query(query, queryParams);
    return result.rows.map(this.mapFailureEvent);
  }

  async resolveFailure(
    failureId: string,
    notes: string,
    tenantId: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE failure_events 
       SET resolved = true, resolved_at = NOW(), resolution_notes = $1
       WHERE id = $2 AND tenant_id = $3`,
      [notes, failureId, tenantId]
    );
  }

  // ============================================================================
  // PROMPT VIOLATIONS
  // ============================================================================

  async recordViolation(input: PromptViolationInput): Promise<string> {
    const promptHash = input.promptSnippet
      ? createHash('sha256').update(input.promptSnippet).digest('hex')
      : null;

    const result = await this.pool.query(
      `INSERT INTO prompt_violations (
        tenant_id, user_id, occurred_at,
        violation_type, severity,
        conversation_id, message_id, model_id,
        prompt_hash, prompt_snippet,
        detection_method, confidence, action_taken
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        input.tenantId,
        input.userId,
        input.violationType,
        input.severity,
        input.conversationId || null,
        input.messageId || null,
        input.modelId || null,
        promptHash,
        input.promptSnippet?.substring(0, 200) || null,
        input.detectionMethod || null,
        input.confidence || null,
        input.actionTaken || 'logged',
      ]
    );

    return result.rows[0].id;
  }

  async getViolations(
    tenantId: string,
    params: MetricsQueryParams & { violationType?: string; unreviewed?: boolean }
  ): Promise<PromptViolation[]> {
    let query = `SELECT * FROM prompt_violations
                 WHERE tenant_id = $1
                   AND occurred_at >= $2
                   AND occurred_at <= $3`;
    const queryParams: unknown[] = [tenantId, params.startDate, params.endDate];
    let paramIndex = 4;

    if (params.violationType) {
      query += ` AND violation_type = $${paramIndex++}`;
      queryParams.push(params.violationType);
    }

    if (params.unreviewed) {
      query += ` AND reviewed = false`;
    }

    query += ` ORDER BY occurred_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    queryParams.push(params.limit || 100, params.offset || 0);

    const result = await this.pool.query(query, queryParams);
    return result.rows.map(this.mapViolation);
  }

  async reviewViolation(
    violationId: string,
    reviewerId: string,
    outcome: string,
    falsePositive: boolean,
    tenantId: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE prompt_violations 
       SET reviewed = true, reviewed_by = $1, reviewed_at = NOW(), 
           review_outcome = $2, false_positive = $3
       WHERE id = $4 AND tenant_id = $5`,
      [reviewerId, outcome, falsePositive, violationId, tenantId]
    );
  }

  // ============================================================================
  // SYSTEM LOGS
  // ============================================================================

  async log(input: SystemLogInput): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO system_logs (
        tenant_id, user_id, logged_at,
        log_level, log_source, log_category,
        message, request_id, trace_id,
        data, duration_ms, environment, version
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        input.tenantId || null,
        input.userId || null,
        input.logLevel,
        input.logSource,
        input.logCategory || null,
        input.message,
        input.requestId || null,
        input.traceId || null,
        JSON.stringify(input.data || {}),
        input.durationMs || null,
        process.env.ENVIRONMENT || 'production',
        process.env.VERSION || '4.18.56',
      ]
    );

    return result.rows[0].id;
  }

  async getLogs(
    tenantId: string | null,
    params: MetricsQueryParams & { logLevel?: string; logSource?: string }
  ): Promise<SystemLog[]> {
    let query = `SELECT * FROM system_logs WHERE logged_at >= $1 AND logged_at <= $2`;
    const queryParams: unknown[] = [params.startDate, params.endDate];
    let paramIndex = 3;

    if (tenantId) {
      query += ` AND tenant_id = $${paramIndex++}`;
      queryParams.push(tenantId);
    }

    if (params.logLevel) {
      query += ` AND log_level = $${paramIndex++}`;
      queryParams.push(params.logLevel);
    }

    if (params.logSource) {
      query += ` AND log_source = $${paramIndex++}`;
      queryParams.push(params.logSource);
    }

    query += ` ORDER BY logged_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    queryParams.push(params.limit || 100, params.offset || 0);

    const result = await this.pool.query(query, queryParams);
    return result.rows.map(this.mapSystemLog);
  }

  // ============================================================================
  // METRICS SUMMARY & DASHBOARD
  // ============================================================================

  async getMetricsSummary(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<MetricsSummary> {
    const result = await this.pool.query(
      `SELECT * FROM get_metrics_summary($1, $2::date, $3::date)`,
      [tenantId, startDate, endDate]
    );

    const row = result.rows[0];
    return {
      totalCostCents: Number(row.total_cost_cents) || 0,
      totalTokens: Number(row.total_tokens) || 0,
      totalApiCalls: Number(row.total_api_calls) || 0,
      successRate: Number(row.success_rate) || 0,
      avgLatencyMs: Number(row.avg_latency_ms) || 0,
      failureCount: Number(row.failure_count) || 0,
      violationCount: Number(row.violation_count) || 0,
      activeUsers: Number(row.active_users) || 0,
      modelsUsed: row.models_used || [],
    };
  }

  async getDailyMetrics(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<TenantDailyMetrics[]> {
    // Refresh materialized view first
    await this.pool.query('SELECT refresh_tenant_daily_metrics()');

    const result = await this.pool.query(
      `SELECT * FROM mv_tenant_daily_metrics
       WHERE tenant_id = $1
         AND period_date >= $2
         AND period_date <= $3
       ORDER BY period_date DESC`,
      [tenantId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      tenantId: row.tenant_id,
      periodDate: row.period_date,
      totalTokens: Number(row.total_tokens),
      totalCostCents: Number(row.total_cost_cents),
      totalApiCalls: Number(row.total_api_calls),
      successfulCalls: Number(row.successful_calls),
      failedCalls: Number(row.failed_calls),
      successRate: Number(row.success_rate),
      activeUsers: Number(row.active_users),
      modelsUsed: Number(row.models_used),
    }));
  }

  async getDashboard(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<MetricsDashboard> {
    const [summary, dailyMetrics, topModels, recentFailures, recentViolations, learningStatus] =
      await Promise.all([
        this.getMetricsSummary(tenantId, startDate, endDate),
        this.getDailyMetrics(tenantId, startDate, endDate),
        this.getTopModels(tenantId, startDate, endDate),
        this.getFailures(tenantId, { startDate, endDate, limit: 10 }),
        this.getViolations(tenantId, { startDate, endDate, limit: 10 }),
        this.getLearningStatus(tenantId),
      ]);

    return {
      summary,
      dailyMetrics,
      topModels,
      recentFailures,
      recentViolations,
      learningStatus,
    };
  }

  private async getTopModels(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<{ modelId: string; totalUses: number; totalCostCents: number; avgLatencyMs: number }[]> {
    const result = await this.pool.query(
      `SELECT 
        model_id,
        SUM(api_calls) as total_uses,
        SUM(total_cost_cents) as total_cost_cents,
        AVG(pm.total_latency_ms) as avg_latency_ms
       FROM billing_metrics bm
       LEFT JOIN performance_metrics pm ON pm.tenant_id = bm.tenant_id AND pm.model_id = bm.model_id
       WHERE bm.tenant_id = $1
         AND bm.period_date >= $2
         AND bm.period_date <= $3
         AND bm.model_id IS NOT NULL
       GROUP BY model_id
       ORDER BY total_uses DESC
       LIMIT 10`,
      [tenantId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      modelId: row.model_id,
      totalUses: Number(row.total_uses),
      totalCostCents: Number(row.total_cost_cents),
      avgLatencyMs: Number(row.avg_latency_ms) || 0,
    }));
  }

  private async getLearningStatus(tenantId: string): Promise<{
    userPreferencesCount: number;
    tenantPatternsCount: number;
    lastSnapshotAt?: string;
    recoveryReady: boolean;
  }> {
    const [prefsResult, patternsResult, snapshotResult] = await Promise.all([
      this.pool.query(
        `SELECT COUNT(*) as count FROM user_learned_preferences WHERE tenant_id = $1`,
        [tenantId]
      ),
      this.pool.query(
        `SELECT COUNT(*) as count FROM tenant_aggregate_learning WHERE tenant_id = $1`,
        [tenantId]
      ),
      this.pool.query(
        `SELECT snapshot_timestamp, can_recover_from 
         FROM learning_snapshots 
         WHERE (scope_type = 'tenant' AND scope_id = $1) OR scope_type = 'global'
         ORDER BY snapshot_timestamp DESC 
         LIMIT 1`,
        [tenantId]
      ),
    ]);

    return {
      userPreferencesCount: Number(prefsResult.rows[0]?.count) || 0,
      tenantPatternsCount: Number(patternsResult.rows[0]?.count) || 0,
      lastSnapshotAt: snapshotResult.rows[0]?.snapshot_timestamp,
      recoveryReady: snapshotResult.rows[0]?.can_recover_from === true,
    };
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapBillingMetric(row: Record<string, unknown>): BillingMetric {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | undefined,
      periodDate: row.period_date as string,
      periodHour: row.period_hour as number | undefined,
      modelId: row.model_id as string | undefined,
      providerId: row.provider_id as string | undefined,
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      totalTokens: Number(row.total_tokens),
      inputCostCents: Number(row.input_cost_cents),
      outputCostCents: Number(row.output_cost_cents),
      totalCostCents: Number(row.total_cost_cents),
      storageBytesUsed: Number(row.storage_bytes_used),
      storageCostCents: Number(row.storage_cost_cents),
      computeSeconds: Number(row.compute_seconds),
      computeCostCents: Number(row.compute_cost_cents),
      apiCalls: Number(row.api_calls),
      successfulCalls: Number(row.successful_calls),
      failedCalls: Number(row.failed_calls),
      breakdown: row.breakdown as Record<string, unknown>,
      createdAt: row.created_at as string,
    };
  }

  private mapPerformanceMetric(row: Record<string, unknown>): PerformanceMetric {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | undefined,
      recordedAt: row.recorded_at as string,
      periodMinute: row.period_minute as string,
      endpoint: row.endpoint as string | undefined,
      method: row.method as string | undefined,
      modelId: row.model_id as string | undefined,
      providerId: row.provider_id as string | undefined,
      totalLatencyMs: row.total_latency_ms as number | undefined,
      timeToFirstTokenMs: row.time_to_first_token_ms as number | undefined,
      inferenceTimeMs: row.inference_time_ms as number | undefined,
      queueWaitMs: row.queue_wait_ms as number | undefined,
      networkLatencyMs: row.network_latency_ms as number | undefined,
      tokensPerSecond: row.tokens_per_second as number | undefined,
      memoryMb: row.memory_mb as number | undefined,
      cpuPercent: row.cpu_percent as number | undefined,
      gpuUtilization: row.gpu_utilization as number | undefined,
      requestSizeBytes: row.request_size_bytes as number | undefined,
      responseSizeBytes: row.response_size_bytes as number | undefined,
      statusCode: row.status_code as number | undefined,
      success: row.success as boolean,
      metadata: row.metadata as Record<string, unknown>,
    };
  }

  private mapFailureEvent(row: Record<string, unknown>): FailureEvent {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | undefined,
      occurredAt: row.occurred_at as string,
      failureType: row.failure_type as FailureEvent['failureType'],
      severity: row.severity as FailureEvent['severity'],
      endpoint: row.endpoint as string | undefined,
      modelId: row.model_id as string | undefined,
      providerId: row.provider_id as string | undefined,
      orchestrationId: row.orchestration_id as string | undefined,
      conversationId: row.conversation_id as string | undefined,
      errorCode: row.error_code as string | undefined,
      errorMessage: row.error_message as string | undefined,
      errorStack: row.error_stack as string | undefined,
      requestId: row.request_id as string | undefined,
      requestPayloadHash: row.request_payload_hash as string | undefined,
      resolved: row.resolved as boolean,
      resolvedAt: row.resolved_at as string | undefined,
      resolutionNotes: row.resolution_notes as string | undefined,
      autoRecovered: row.auto_recovered as boolean,
      retryCount: row.retry_count as number,
      metadata: row.metadata as Record<string, unknown>,
    };
  }

  private mapViolation(row: Record<string, unknown>): PromptViolation {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      occurredAt: row.occurred_at as string,
      violationType: row.violation_type as PromptViolation['violationType'],
      severity: row.severity as PromptViolation['severity'],
      conversationId: row.conversation_id as string | undefined,
      messageId: row.message_id as string | undefined,
      modelId: row.model_id as string | undefined,
      promptHash: row.prompt_hash as string | undefined,
      promptSnippet: row.prompt_snippet as string | undefined,
      detectionMethod: row.detection_method as PromptViolation['detectionMethod'],
      confidence: row.confidence as number | undefined,
      actionTaken: row.action_taken as PromptViolation['actionTaken'],
      reviewed: row.reviewed as boolean,
      reviewedBy: row.reviewed_by as string | undefined,
      reviewedAt: row.reviewed_at as string | undefined,
      reviewOutcome: row.review_outcome as string | undefined,
      falsePositive: row.false_positive as boolean | undefined,
      metadata: row.metadata as Record<string, unknown>,
    };
  }

  private mapSystemLog(row: Record<string, unknown>): SystemLog {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string | undefined,
      userId: row.user_id as string | undefined,
      loggedAt: row.logged_at as string,
      logLevel: row.log_level as SystemLog['logLevel'],
      logSource: row.log_source as string,
      logCategory: row.log_category as string | undefined,
      message: row.message as string,
      requestId: row.request_id as string | undefined,
      traceId: row.trace_id as string | undefined,
      spanId: row.span_id as string | undefined,
      data: row.data as Record<string, unknown>,
      durationMs: row.duration_ms as number | undefined,
      environment: row.environment as string,
      version: row.version as string | undefined,
    };
  }
}

export const metricsCollectionService = new MetricsCollectionService(
  null as unknown as Pool // Will be initialized with actual pool
);
