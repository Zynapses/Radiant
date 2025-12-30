/**
 * Genesis Metrics Publishing Lambda
 * 
 * EventBridge-triggered Lambda that publishes Genesis system metrics
 * to CloudWatch at regular intervals.
 * 
 * Metrics published:
 * - Circuit breaker states
 * - Risk score
 * - Intervention level
 * - Neurochemistry values
 * - Tick costs
 * - Developmental stage
 * 
 * Schedule: Every 1 minute
 */

import { ScheduledHandler } from 'aws-lambda';
import { CloudWatchClient, PutMetricDataCommand, MetricDatum } from '@aws-sdk/client-cloudwatch';
import { logger } from '../shared/logging/enhanced-logger';
import { genesisService } from '../shared/services/bobble/genesis.service';
import { circuitBreakerService } from '../shared/services/bobble/circuit-breaker.service';
import { costTrackingService } from '../shared/services/bobble/cost-tracking.service';
import { consciousnessLoopService } from '../shared/services/bobble/consciousness-loop.service';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
const NAMESPACE = 'Bobble/Consciousness';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

interface MetricBatch {
  metrics: MetricDatum[];
}

export const handler: ScheduledHandler = async (event) => {
  const startTime = Date.now();
  logger.info('Genesis metrics publishing started', { event });

  try {
    const batches: MetricBatch[] = [];

    // Collect all metrics in parallel
    const [
      circuitBreakerMetrics,
      riskMetrics,
      neurochemistryMetrics,
      developmentMetrics,
      costMetrics,
      loopMetrics
    ] = await Promise.all([
      collectCircuitBreakerMetrics(),
      collectRiskMetrics(),
      collectNeurochemistryMetrics(),
      collectDevelopmentMetrics(),
      collectCostMetrics(),
      collectLoopMetrics()
    ]);

    // Combine all metrics
    const allMetrics = [
      ...circuitBreakerMetrics,
      ...riskMetrics,
      ...neurochemistryMetrics,
      ...developmentMetrics,
      ...costMetrics,
      ...loopMetrics
    ];

    // CloudWatch allows max 1000 metrics per request, batch in groups of 20
    for (let i = 0; i < allMetrics.length; i += 20) {
      batches.push({ metrics: allMetrics.slice(i, i + 20) });
    }

    // Publish all batches
    for (const batch of batches) {
      await cloudwatch.send(new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: batch.metrics
      }));
    }

    const duration = Date.now() - startTime;
    logger.info('Genesis metrics published successfully', {
      metricsCount: allMetrics.length,
      batchCount: batches.length,
      durationMs: duration
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        metricsCount: allMetrics.length,
        durationMs: duration
      })
    };

  } catch (error) {
    logger.error('Genesis metrics publishing failed', { error });
    throw error;
  }
};

async function collectCircuitBreakerMetrics(): Promise<MetricDatum[]> {
  const metrics: MetricDatum[] = [];
  const timestamp = new Date();

  try {
    const breakers = await circuitBreakerService.getAllBreakers();
    let openCount = 0;
    let halfOpenCount = 0;

    for (const breaker of breakers) {
      const stateValue = breaker.state === 'OPEN' ? 1 : breaker.state === 'HALF_OPEN' ? 0.5 : 0;
      
      if (breaker.state === 'OPEN') openCount++;
      if (breaker.state === 'HALF_OPEN') halfOpenCount++;

      // Individual breaker state
      metrics.push({
        MetricName: `CircuitBreaker${breaker.name.replace(/_/g, '')}`,
        Value: stateValue,
        Unit: 'None',
        Timestamp: timestamp,
        Dimensions: [
          { Name: 'Environment', Value: ENVIRONMENT },
          { Name: 'State', Value: breaker.state }
        ]
      });

      // Trip count
      metrics.push({
        MetricName: `CircuitBreakerTripCount`,
        Value: breaker.tripCount,
        Unit: 'Count',
        Timestamp: timestamp,
        Dimensions: [
          { Name: 'Environment', Value: ENVIRONMENT },
          { Name: 'BreakerName', Value: breaker.name }
        ]
      });
    }

    // Aggregate metrics
    metrics.push({
      MetricName: 'CircuitBreakerOpen',
      Value: openCount,
      Unit: 'Count',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    metrics.push({
      MetricName: 'CircuitBreakerHalfOpen',
      Value: halfOpenCount,
      Unit: 'Count',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

  } catch (error) {
    logger.warn('Failed to collect circuit breaker metrics', { error });
  }

  return metrics;
}

async function collectRiskMetrics(): Promise<MetricDatum[]> {
  const metrics: MetricDatum[] = [];
  const timestamp = new Date();

  try {
    const riskScore = await circuitBreakerService.calculateRiskScore();
    const interventionLevel = await circuitBreakerService.getInterventionLevel();

    // Risk score
    metrics.push({
      MetricName: 'RiskScore',
      Value: riskScore,
      Unit: 'Percent',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Intervention level as numeric
    const levelMap: Record<string, number> = {
      'NONE': 0,
      'DAMPEN': 1,
      'PAUSE': 2,
      'RESET': 3,
      'HIBERNATE': 4
    };

    metrics.push({
      MetricName: 'InterventionLevel',
      Value: levelMap[interventionLevel] || 0,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

  } catch (error) {
    logger.warn('Failed to collect risk metrics', { error });
  }

  return metrics;
}

async function collectNeurochemistryMetrics(): Promise<MetricDatum[]> {
  const metrics: MetricDatum[] = [];
  const timestamp = new Date();

  try {
    const neuro = await circuitBreakerService.getNeurochemistry();
    
    if (neuro) {
      const neuroMetrics = [
        { name: 'Anxiety', value: neuro.anxiety },
        { name: 'Fatigue', value: neuro.fatigue },
        { name: 'Temperature', value: neuro.temperature },
        { name: 'Confidence', value: neuro.confidence },
        { name: 'Curiosity', value: neuro.curiosity },
        { name: 'Frustration', value: neuro.frustration }
      ];

      for (const m of neuroMetrics) {
        metrics.push({
          MetricName: `Neurochemistry${m.name}`,
          Value: m.value,
          Unit: 'None',
          Timestamp: timestamp,
          Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
        });
      }
    }

  } catch (error) {
    logger.warn('Failed to collect neurochemistry metrics', { error });
  }

  return metrics;
}

async function collectDevelopmentMetrics(): Promise<MetricDatum[]> {
  const metrics: MetricDatum[] = [];
  const timestamp = new Date();

  try {
    const status = await genesisService.getDevelopmentalGateStatus();
    const stats = status.statistics;

    // Stage as numeric
    const stageMap: Record<string, number> = {
      'SENSORIMOTOR': 1,
      'PREOPERATIONAL': 2,
      'CONCRETE_OPERATIONAL': 3,
      'FORMAL_OPERATIONAL': 4
    };

    metrics.push({
      MetricName: 'DevelopmentalStage',
      Value: stageMap[status.currentStage] || 0,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Ready to advance
    metrics.push({
      MetricName: 'ReadyToAdvance',
      Value: status.readyToAdvance ? 1 : 0,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Key counters
    const counterMetrics = [
      { name: 'SelfFacts', value: stats.selfFactsCount },
      { name: 'GroundedVerifications', value: stats.groundedVerificationsCount },
      { name: 'DomainExplorations', value: stats.domainExplorationsCount },
      { name: 'BeliefUpdates', value: stats.beliefUpdatesCount },
      { name: 'NovelInsights', value: stats.novelInsightsCount }
    ];

    for (const m of counterMetrics) {
      metrics.push({
        MetricName: `Development${m.name}`,
        Value: m.value,
        Unit: 'Count',
        Timestamp: timestamp,
        Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
      });
    }

  } catch (error) {
    logger.warn('Failed to collect development metrics', { error });
  }

  return metrics;
}

async function collectCostMetrics(): Promise<MetricDatum[]> {
  const metrics: MetricDatum[] = [];
  const timestamp = new Date();

  try {
    const realtime = await costTrackingService.getRealtimeEstimate();
    const budget = await costTrackingService.getBudgetStatus();

    // Today's cost
    metrics.push({
      MetricName: 'DailyCostEstimate',
      Value: realtime.estimatedCostUsd,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Breakdown
    metrics.push({
      MetricName: 'CostBedrock',
      Value: realtime.breakdown.bedrock,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    metrics.push({
      MetricName: 'CostSageMaker',
      Value: realtime.breakdown.sagemaker,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Invocations
    metrics.push({
      MetricName: 'BedrockInvocations',
      Value: realtime.invocations.bedrock,
      Unit: 'Count',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    metrics.push({
      MetricName: 'InputTokens',
      Value: realtime.invocations.inputTokens,
      Unit: 'Count',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    metrics.push({
      MetricName: 'OutputTokens',
      Value: realtime.invocations.outputTokens,
      Unit: 'Count',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Budget utilization
    if (budget.limitUsd > 0) {
      const utilization = (budget.actualUsd / budget.limitUsd) * 100;
      metrics.push({
        MetricName: 'BudgetUtilization',
        Value: utilization,
        Unit: 'Percent',
        Timestamp: timestamp,
        Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
      });
    }

    // On track indicator
    metrics.push({
      MetricName: 'BudgetOnTrack',
      Value: budget.onTrack ? 1 : 0,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

  } catch (error) {
    logger.warn('Failed to collect cost metrics', { error });
  }

  return metrics;
}

async function collectLoopMetrics(): Promise<MetricDatum[]> {
  const metrics: MetricDatum[] = [];
  const timestamp = new Date();

  try {
    const status = await consciousnessLoopService.getStatus();

    // Current tick
    metrics.push({
      MetricName: 'CurrentTick',
      Value: status.currentTick,
      Unit: 'Count',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Cognitive ticks today
    metrics.push({
      MetricName: 'CognitiveTicksToday',
      Value: status.cognitiveTicksToday,
      Unit: 'Count',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Genesis complete
    metrics.push({
      MetricName: 'GenesisComplete',
      Value: status.genesisComplete ? 1 : 0,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Emergency mode
    metrics.push({
      MetricName: 'EmergencyMode',
      Value: status.settings.isEmergencyMode ? 1 : 0,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

    // Loop state
    const stateMap: Record<string, number> = {
      'NOT_INITIALIZED': 0,
      'GENESIS_PENDING': 1,
      'RUNNING': 2,
      'PAUSED': 3,
      'HIBERNATING': 4,
      'ERROR': 5
    };

    metrics.push({
      MetricName: 'LoopState',
      Value: stateMap[status.state] || 0,
      Unit: 'None',
      Timestamp: timestamp,
      Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }]
    });

  } catch (error) {
    logger.warn('Failed to collect loop metrics', { error });
  }

  return metrics;
}
