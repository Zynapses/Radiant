/**
 * RADIANT v5.4.0 - Cognitive Metrics Service (PROMPT-40)
 * 
 * CloudWatch metrics emission for cognitive architecture observability.
 * Provides TypeScript integration with the Python Flyte workflows.
 * 
 * Metrics Namespace: Radiant/Cognitive
 * 
 * Key Metrics:
 * - GhostMemoryHit/Miss
 * - SniperExecution
 * - WarRoomExecution
 * - HITLEscalation
 * - CircuitBreakerState
 * - RoutingLatency
 * - RetrievalConfidence
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

export type RouteType = 'sniper' | 'war_room' | 'hitl';

export interface MetricDimension {
  Name: string;
  Value: string;
}

export interface CognitiveMetricData {
  name: string;
  value: number;
  unit?: StandardUnit;
  dimensions?: MetricDimension[];
  timestamp?: Date;
}

export interface GhostHitMetricParams {
  userId: string;
  semanticKey: string;
  confidence: number;
  domainHint?: string;
  latencyMs?: number;
}

export interface GhostMissMetricParams {
  userId: string;
  reason: 'not_found' | 'expired' | 'circuit_open' | 'error';
  latencyMs?: number;
}

export interface GhostWriteMetricParams {
  userId: string;
  semanticKey: string;
  ttlSeconds: number;
  domainHint?: string;
  success: boolean;
}

export interface RoutingDecisionMetricParams {
  routeType: RouteType;
  complexityScore: number;
  retrievalConfidence: number;
  ghostHit: boolean;
  domainHint?: string;
  latencyMs?: number;
}

export interface SniperExecutionMetricParams {
  latencyMs: number;
  complexityScore: number;
  success: boolean;
  model?: string;
  writeBackQueued?: boolean;
}

export interface WarRoomExecutionMetricParams {
  latencyMs: number;
  complexityScore: number;
  success: boolean;
  modelsUsed?: number;
  fallbackTriggered?: boolean;
}

export interface HITLEscalationMetricParams {
  reason: string;
  domainHint?: string;
  timeoutSeconds?: number;
}

export interface CircuitBreakerMetricParams {
  circuitName: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
}

export interface CostSavingsMetricParams {
  estimatedOriginalCost: number;
  actualCost: number;
  routeType: RouteType;
}

export class CognitiveMetricsService {
  private readonly namespace = 'Radiant/Cognitive';
  private readonly cloudwatch: CloudWatchClient;
  private readonly tenantId: string;
  private readonly enabled: boolean;
  private readonly sampleRate: number;
  private buffer: CognitiveMetricData[] = [];
  private readonly bufferSize = 20;

  constructor(config: {
    tenantId: string;
    region?: string;
    enabled?: boolean;
    sampleRate?: number;
  }) {
    this.tenantId = config.tenantId;
    this.enabled = config.enabled ?? true;
    this.sampleRate = config.sampleRate ?? 1.0;
    this.cloudwatch = new CloudWatchClient({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
    });
  }

  private shouldSample(): boolean {
    if (this.sampleRate >= 1.0) return true;
    return Math.random() < this.sampleRate;
  }

  private async emit(metric: CognitiveMetricData): Promise<void> {
    if (!this.enabled || !this.shouldSample()) return;

    // Add tenant dimension
    const dimensions: MetricDimension[] = [
      { Name: 'TenantId', Value: this.tenantId },
      ...(metric.dimensions || []),
    ];

    this.buffer.push({
      ...metric,
      dimensions,
    });

    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const metricsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await this.cloudwatch.send(
        new PutMetricDataCommand({
          Namespace: this.namespace,
          MetricData: metricsToSend.map((m) => ({
            MetricName: m.name,
            Value: m.value,
            Unit: m.unit || StandardUnit.Count,
            Dimensions: m.dimensions,
            Timestamp: m.timestamp,
          })),
        })
      );
      logger.debug('Flushed cognitive metrics', { count: metricsToSend.length });
    } catch (error) {
      logger.warn('Failed to flush cognitive metrics', { error, count: metricsToSend.length });
    }
  }

  // =========================================================================
  // Ghost Memory Metrics
  // =========================================================================

  async recordGhostHit(params: GhostHitMetricParams): Promise<void> {
    await this.emit({
      name: 'GhostMemoryHit',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [
        { Name: 'UserId', Value: params.userId.substring(0, 8) },
        { Name: 'DomainHint', Value: params.domainHint || 'general' },
      ],
    });

    await this.emit({
      name: 'GhostRetrievalConfidence',
      value: params.confidence,
      unit: StandardUnit.None,
      dimensions: [
        { Name: 'DomainHint', Value: params.domainHint || 'general' },
      ],
    });

    if (params.latencyMs !== undefined) {
      await this.emit({
        name: 'GhostMemoryLatency',
        value: params.latencyMs,
        unit: StandardUnit.Milliseconds,
      });
    }
  }

  async recordGhostMiss(params: GhostMissMetricParams): Promise<void> {
    await this.emit({
      name: 'GhostMemoryMiss',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [{ Name: 'Reason', Value: params.reason }],
    });

    if (params.latencyMs !== undefined) {
      await this.emit({
        name: 'GhostMemoryLatency',
        value: params.latencyMs,
        unit: StandardUnit.Milliseconds,
      });
    }
  }

  async recordGhostWrite(params: GhostWriteMetricParams): Promise<void> {
    await this.emit({
      name: 'GhostMemoryWrite',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [
        { Name: 'DomainHint', Value: params.domainHint || 'general' },
        { Name: 'Success', Value: String(params.success) },
      ],
    });
  }

  async recordGhostWriteFailure(userId: string, errorType: string): Promise<void> {
    await this.emit({
      name: 'GhostMemoryWriteFailure',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [{ Name: 'ErrorType', Value: errorType }],
    });
  }

  // =========================================================================
  // Routing Metrics
  // =========================================================================

  async recordRoutingDecision(params: RoutingDecisionMetricParams): Promise<void> {
    await this.emit({
      name: 'RoutingDecision',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [
        { Name: 'RouteType', Value: params.routeType },
        { Name: 'GhostHit', Value: String(params.ghostHit) },
        { Name: 'DomainHint', Value: params.domainHint || 'general' },
      ],
    });

    await this.emit({
      name: 'ComplexityScore',
      value: params.complexityScore,
      unit: StandardUnit.None,
      dimensions: [{ Name: 'RouteType', Value: params.routeType }],
    });

    await this.emit({
      name: 'RetrievalConfidence',
      value: params.retrievalConfidence,
      unit: StandardUnit.None,
      dimensions: [{ Name: 'RouteType', Value: params.routeType }],
    });

    if (params.latencyMs !== undefined) {
      await this.emit({
        name: 'RoutingLatency',
        value: params.latencyMs,
        unit: StandardUnit.Milliseconds,
      });
    }
  }

  // =========================================================================
  // Execution Metrics
  // =========================================================================

  async recordSniperExecution(params: SniperExecutionMetricParams): Promise<void> {
    await this.emit({
      name: 'SniperExecution',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [
        { Name: 'Success', Value: String(params.success) },
        { Name: 'Model', Value: params.model || 'default' },
      ],
    });

    await this.emit({
      name: 'SniperLatency',
      value: params.latencyMs,
      unit: StandardUnit.Milliseconds,
      dimensions: [{ Name: 'Success', Value: String(params.success) }],
    });

    if (params.writeBackQueued) {
      await this.emit({
        name: 'SniperWriteBackQueued',
        value: 1,
        unit: StandardUnit.Count,
      });
    }
  }

  async recordWarRoomExecution(params: WarRoomExecutionMetricParams): Promise<void> {
    await this.emit({
      name: 'WarRoomExecution',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [
        { Name: 'Success', Value: String(params.success) },
        { Name: 'FallbackTriggered', Value: String(params.fallbackTriggered ?? false) },
      ],
    });

    await this.emit({
      name: 'WarRoomLatency',
      value: params.latencyMs,
      unit: StandardUnit.Milliseconds,
    });

    if (params.modelsUsed !== undefined) {
      await this.emit({
        name: 'WarRoomModelsUsed',
        value: params.modelsUsed,
        unit: StandardUnit.Count,
      });
    }
  }

  async recordHITLEscalation(params: HITLEscalationMetricParams): Promise<void> {
    await this.emit({
      name: 'HITLEscalation',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [
        { Name: 'Reason', Value: params.reason },
        { Name: 'DomainHint', Value: params.domainHint || 'general' },
      ],
    });
  }

  async recordHITLResolution(
    resolutionTimeSeconds: number,
    resolutionType: 'resolved' | 'expired' | 'cancelled'
  ): Promise<void> {
    await this.emit({
      name: 'HITLResolution',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [{ Name: 'ResolutionType', Value: resolutionType }],
    });

    await this.emit({
      name: 'HITLResolutionTime',
      value: resolutionTimeSeconds,
      unit: StandardUnit.Seconds,
    });
  }

  // =========================================================================
  // Circuit Breaker Metrics
  // =========================================================================

  async recordCircuitBreakerState(params: CircuitBreakerMetricParams): Promise<void> {
    await this.emit({
      name: 'CircuitBreakerState',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: [
        { Name: 'CircuitName', Value: params.circuitName },
        { Name: 'State', Value: params.state },
      ],
    });

    await this.emit({
      name: 'CircuitBreakerFailures',
      value: params.failureCount,
      unit: StandardUnit.Count,
      dimensions: [{ Name: 'CircuitName', Value: params.circuitName }],
    });
  }

  // =========================================================================
  // Cost Metrics
  // =========================================================================

  async recordCostSavings(params: CostSavingsMetricParams): Promise<void> {
    const savings = Math.max(0, params.estimatedOriginalCost - params.actualCost);

    await this.emit({
      name: 'CostSavings',
      value: savings,
      unit: StandardUnit.None, // Cents
      dimensions: [{ Name: 'RouteType', Value: params.routeType }],
    });

    await this.emit({
      name: 'ActualCost',
      value: params.actualCost,
      unit: StandardUnit.None,
      dimensions: [{ Name: 'RouteType', Value: params.routeType }],
    });
  }
}

// Singleton instance factory
let metricsInstance: CognitiveMetricsService | null = null;

export function getCognitiveMetrics(tenantId: string): CognitiveMetricsService {
  if (!metricsInstance || metricsInstance['tenantId'] !== tenantId) {
    metricsInstance = new CognitiveMetricsService({ tenantId });
  }
  return metricsInstance;
}

// Convenience function for one-off metrics
export async function emitCognitiveMetric(
  tenantId: string,
  metricName: string,
  value: number,
  unit: StandardUnit = StandardUnit.Count,
  dimensions?: Record<string, string>
): Promise<void> {
  const cloudwatch = new CloudWatchClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const metricDimensions: MetricDimension[] = [
    { Name: 'TenantId', Value: tenantId },
    ...(dimensions
      ? Object.entries(dimensions).map(([k, v]) => ({ Name: k, Value: v }))
      : []),
  ];

  try {
    await cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: 'Radiant/Cognitive',
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: unit,
            Dimensions: metricDimensions,
          },
        ],
      })
    );
  } catch (error) {
    logger.warn('Failed to emit cognitive metric', { metricName, error });
  }
}
