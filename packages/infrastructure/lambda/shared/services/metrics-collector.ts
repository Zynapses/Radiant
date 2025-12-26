import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { executeStatement } from '../db/client';

type MetricType = 'api_request' | 'token_usage' | 'model_inference' | 'billing' | 'error' | 'latency';

interface MetricEvent {
  tenantId: string;
  userId?: string;
  metricType: MetricType;
  metricName: string;
  value: number;
  dimensions?: Record<string, string>;
}

interface AggregatedMetrics {
  periodStart: Date;
  periodEnd: Date;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  errorCount: number;
  uniqueUsers: number;
}

export class MetricsCollector {
  private cloudwatch: CloudWatchClient;
  private buffer: MetricEvent[] = [];
  private readonly BUFFER_SIZE = 100;
  private isFlushScheduled = false;

  constructor() {
    this.cloudwatch = new CloudWatchClient({});
  }

  record(event: MetricEvent): void {
    this.buffer.push(event);

    // Flush immediately when buffer is full (Lambda-safe approach)
    if (this.buffer.length >= this.BUFFER_SIZE) {
      // Use setImmediate for non-blocking flush, avoiding setTimeout
      // which can cause issues with Lambda container freeze/thaw cycles
      if (!this.isFlushScheduled) {
        this.isFlushScheduled = true;
        setImmediate(() => {
          this.flush().finally(() => {
            this.isFlushScheduled = false;
          });
        });
      }
    }
  }

  /**
   * Flush metrics - should be called at end of Lambda handler
   * to ensure all metrics are persisted before container freeze
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      await Promise.all([
        this.persistToDatabase(events),
        this.sendToCloudWatch(events),
      ]);
    } catch (error) {
      console.error('[Metrics] Failed to flush metrics:', error instanceof Error ? error.message : 'Unknown');
      // Re-add events to buffer on failure (with size limit)
      this.buffer = [...events.slice(-50), ...this.buffer].slice(0, this.BUFFER_SIZE);
    }
  }

  /**
   * Get pending event count for monitoring
   */
  getPendingCount(): number {
    return this.buffer.length;
  }

  private async persistToDatabase(events: MetricEvent[]): Promise<void> {
    for (const event of events) {
      await executeStatement(
        `INSERT INTO usage_metrics 
         (tenant_id, user_id, metric_type, metric_name, metric_value, dimensions)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          { name: 'tenantId', value: { stringValue: event.tenantId } },
          { name: 'userId', value: event.userId ? { stringValue: event.userId } : { isNull: true } },
          { name: 'metricType', value: { stringValue: event.metricType } },
          { name: 'metricName', value: { stringValue: event.metricName } },
          { name: 'metricValue', value: { doubleValue: event.value } },
          { name: 'dimensions', value: { stringValue: JSON.stringify(event.dimensions || {}) } },
        ]
      );
    }
  }

  private async sendToCloudWatch(events: MetricEvent[]): Promise<void> {
    const metricData = events.map((e) => ({
      MetricName: e.metricName,
      Dimensions: [
        { Name: 'TenantId', Value: e.tenantId },
        { Name: 'MetricType', Value: e.metricType },
        ...(e.dimensions
          ? Object.entries(e.dimensions).map(([k, v]) => ({ Name: k, Value: v }))
          : []),
      ],
      Value: e.value,
      Timestamp: new Date(),
      Unit: this.getUnit(e.metricName),
    }));

    // CloudWatch accepts max 1000 metrics per call, but we batch at 20 for efficiency
    for (let i = 0; i < metricData.length; i += 20) {
      try {
        await this.cloudwatch.send(
          new PutMetricDataCommand({
            Namespace: 'RADIANT',
            MetricData: metricData.slice(i, i + 20),
          })
        );
      } catch (error) {
        console.error('Failed to send metrics to CloudWatch:', error);
      }
    }
  }

  private getUnit(metricName: string): StandardUnit {
    if (metricName.includes('latency') || metricName.includes('duration')) {
      return StandardUnit.Milliseconds;
    }
    if (metricName.includes('bytes') || metricName.includes('size')) {
      return StandardUnit.Bytes;
    }
    if (metricName.includes('percent') || metricName.includes('rate')) {
      return StandardUnit.Percent;
    }
    return StandardUnit.Count;
  }

  async getAggregatedMetrics(
    tenantId: string,
    periodType: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<AggregatedMetrics[]> {
    const result = await executeStatement(
      `SELECT 
         period_start, period_end, total_requests, total_tokens,
         total_cost, avg_latency_ms, error_count, unique_users
       FROM aggregated_metrics
       WHERE tenant_id = $1
       AND period_type = $2
       AND period_start >= $3
       AND period_end <= $4
       ORDER BY period_start`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'periodType', value: { stringValue: periodType } },
        { name: 'startDate', value: { stringValue: startDate.toISOString() } },
        { name: 'endDate', value: { stringValue: endDate.toISOString() } },
      ]
    );

    if (result.rows.length === 0) return [];

    return result.rows.map((row) => {
      const record = row as Record<string, unknown>;
      return {
        periodStart: new Date(String(record.period_start || '')),
        periodEnd: new Date(String(record.period_end || '')),
        totalRequests: parseInt(String(record.total_requests ?? 0), 10),
        totalTokens: parseInt(String(record.total_tokens ?? 0), 10),
        totalCost: parseFloat(String(record.total_cost ?? 0)),
        avgLatencyMs: parseFloat(String(record.avg_latency_ms ?? 0)),
        errorCount: parseInt(String(record.error_count ?? 0), 10),
        uniqueUsers: parseInt(String(record.unique_users ?? 0), 10),
      };
    });
  }

  async recordRequest(
    tenantId: string,
    userId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
    cost: number
  ): Promise<void> {
    this.record({
      tenantId,
      userId,
      metricType: 'api_request',
      metricName: 'request_count',
      value: 1,
      dimensions: { model },
    });

    this.record({
      tenantId,
      userId,
      metricType: 'token_usage',
      metricName: 'input_tokens',
      value: inputTokens,
      dimensions: { model },
    });

    this.record({
      tenantId,
      userId,
      metricType: 'token_usage',
      metricName: 'output_tokens',
      value: outputTokens,
      dimensions: { model },
    });

    this.record({
      tenantId,
      userId,
      metricType: 'latency',
      metricName: 'request_latency_ms',
      value: latencyMs,
      dimensions: { model },
    });

    this.record({
      tenantId,
      userId,
      metricType: 'billing',
      metricName: 'cost',
      value: cost,
      dimensions: { model },
    });
  }

  async recordError(
    tenantId: string,
    userId: string | undefined,
    errorCode: string,
    service: string
  ): Promise<void> {
    this.record({
      tenantId,
      userId,
      metricType: 'error',
      metricName: 'error_count',
      value: 1,
      dimensions: { error_code: errorCode, service },
    });
  }
}

export const metricsCollector = new MetricsCollector();
