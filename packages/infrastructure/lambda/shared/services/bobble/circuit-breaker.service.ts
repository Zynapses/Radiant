/**
 * Bobble Circuit Breaker Service
 * 
 * Safety mechanisms to prevent runaway costs and unstable behavior.
 * All breakers are configurable via admin API.
 * 
 * States:
 * - CLOSED: Normal operation
 * - OPEN: Tripped, blocking operations
 * - HALF_OPEN: Testing if safe to resume
 * 
 * See: /docs/bobble/runbooks/circuit-breaker-operations.md
 */

import { executeStatement, stringParam, longParam, boolParam } from '../../db/client';
import { logger } from '../../logging/enhanced-logger';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type InterventionLevel = 'NONE' | 'DAMPEN' | 'PAUSE' | 'RESET' | 'HIBERNATE';

export interface CircuitBreakerConfig {
  name: string;
  enabled: boolean;
  tripThreshold: number;
  resetTimeoutSeconds: number;
  halfOpenMaxAttempts: number;
  description: string;
}

export interface CircuitBreakerState {
  name: string;
  state: CircuitState;
  tripCount: number;
  lastTrippedAt: string | null;
  lastClosedAt: string | null;
  consecutiveFailures: number;
  halfOpenAttempts: number;
  config: CircuitBreakerConfig;
}

export interface NeurochemicalState {
  anxiety: number;
  fatigue: number;
  temperature: number;
  confidence: number;
  curiosity: number;
  frustration: number;
}

export interface CircuitBreakerDashboard {
  breakers: CircuitBreakerState[];
  overallHealth: 'healthy' | 'degraded' | 'critical';
  interventionLevel: InterventionLevel;
  neurochemistry: NeurochemicalState | null;
  riskScore: number;
  updatedAt: string;
}

/**
 * Circuit Breaker Service
 * 
 * Provides safety mechanisms for consciousness operations.
 */
class CircuitBreakerService {
  private tenantId: string = 'global';
  private sns: SNSClient;
  private cloudwatch: CloudWatchClient;
  private notificationTopicArn: string;

  constructor() {
    this.sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.notificationTopicArn = process.env.CIRCUIT_BREAKER_TOPIC_ARN || '';
  }

  /**
   * Get all circuit breaker states
   */
  async getAllBreakers(): Promise<CircuitBreakerState[]> {
    const result = await executeStatement({
      sql: `
        SELECT 
          name, state, trip_count, last_tripped_at, last_closed_at,
          consecutive_failures, half_open_attempts,
          enabled, trip_threshold, reset_timeout_seconds,
          half_open_max_attempts, description
        FROM bobble_circuit_breakers
        WHERE tenant_id = :tenantId
        ORDER BY name
      `,
      parameters: [stringParam('tenantId', this.tenantId)]
    });

    if (!result.rows) return this.getDefaultBreakers();

    return result.rows.map(row => ({
      name: row.name as string,
      state: row.state as CircuitState,
      tripCount: row.trip_count as number,
      lastTrippedAt: row.last_tripped_at as string | null,
      lastClosedAt: row.last_closed_at as string | null,
      consecutiveFailures: row.consecutive_failures as number,
      halfOpenAttempts: row.half_open_attempts as number,
      config: {
        name: row.name as string,
        enabled: row.enabled as boolean,
        tripThreshold: row.trip_threshold as number,
        resetTimeoutSeconds: row.reset_timeout_seconds as number,
        halfOpenMaxAttempts: row.half_open_max_attempts as number,
        description: row.description as string
      }
    }));
  }

  /**
   * Get a specific circuit breaker state
   */
  async getBreaker(name: string): Promise<CircuitBreakerState | null> {
    const breakers = await this.getAllBreakers();
    return breakers.find(b => b.name === name) || null;
  }

  /**
   * Check if an operation should be allowed
   */
  async shouldAllow(breakerName: string): Promise<boolean> {
    const breaker = await this.getBreaker(breakerName);
    
    if (!breaker) {
      logger.warn('Circuit breaker not found', { name: breakerName });
      return true; // Default to allowing if breaker doesn't exist
    }

    if (!breaker.config.enabled) {
      return true; // Breaker disabled
    }

    switch (breaker.state) {
      case 'CLOSED':
        return true;
      
      case 'OPEN':
        // Check if reset timeout has passed
        if (breaker.lastTrippedAt) {
          const elapsed = Date.now() - new Date(breaker.lastTrippedAt).getTime();
          if (elapsed > breaker.config.resetTimeoutSeconds * 1000) {
            // Transition to HALF_OPEN
            await this.transitionToHalfOpen(breakerName);
            return true;
          }
        }
        return false;
      
      case 'HALF_OPEN':
        // Allow limited attempts
        if (breaker.halfOpenAttempts < breaker.config.halfOpenMaxAttempts) {
          await this.incrementHalfOpenAttempts(breakerName);
          return true;
        }
        return false;
      
      default:
        return true;
    }
  }

  /**
   * Record a successful operation
   */
  async recordSuccess(breakerName: string): Promise<void> {
    const breaker = await this.getBreaker(breakerName);
    if (!breaker) return;

    if (breaker.state === 'HALF_OPEN') {
      // Transition back to CLOSED
      await this.closeBreaker(breakerName);
      await this.publishMetric(breakerName, 'CLOSED');
      await this.sendNotification(breakerName, 'recovered', 'Circuit breaker recovered');
    } else if (breaker.state === 'CLOSED') {
      // Reset consecutive failures
      await executeStatement({
        sql: `
          UPDATE bobble_circuit_breakers
          SET consecutive_failures = 0, updated_at = NOW()
          WHERE tenant_id = :tenantId AND name = :name
        `,
        parameters: [
          stringParam('tenantId', this.tenantId),
          stringParam('name', breakerName)
        ]
      });
    }
  }

  /**
   * Record a failed operation
   */
  async recordFailure(breakerName: string): Promise<void> {
    const breaker = await this.getBreaker(breakerName);
    if (!breaker || !breaker.config.enabled) return;

    const newFailures = breaker.consecutiveFailures + 1;

    if (breaker.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN trips back to OPEN
      await this.tripBreaker(breakerName);
    } else if (breaker.state === 'CLOSED' && newFailures >= breaker.config.tripThreshold) {
      // Trip the breaker
      await this.tripBreaker(breakerName);
    } else {
      // Increment failure count
      await executeStatement({
        sql: `
          UPDATE bobble_circuit_breakers
          SET consecutive_failures = :failures, updated_at = NOW()
          WHERE tenant_id = :tenantId AND name = :name
        `,
        parameters: [
          longParam('failures', newFailures),
          stringParam('tenantId', this.tenantId),
          stringParam('name', breakerName)
        ]
      });
    }
  }

  /**
   * Trip a circuit breaker
   */
  async tripBreaker(name: string): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE bobble_circuit_breakers
        SET state = 'OPEN',
            trip_count = trip_count + 1,
            last_tripped_at = NOW(),
            half_open_attempts = 0,
            updated_at = NOW()
        WHERE tenant_id = :tenantId AND name = :name
      `,
      parameters: [
        stringParam('tenantId', this.tenantId),
        stringParam('name', name)
      ]
    });

    logger.warn('Circuit breaker tripped', { name });
    await this.publishMetric(name, 'OPEN');
    await this.sendNotification(name, 'tripped', `Circuit breaker ${name} has tripped`);

    // Log event
    await this.logEvent(name, 'tripped', { reason: 'threshold_exceeded' });
  }

  /**
   * Manually close a circuit breaker
   */
  async closeBreaker(name: string): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE bobble_circuit_breakers
        SET state = 'CLOSED',
            consecutive_failures = 0,
            half_open_attempts = 0,
            last_closed_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = :tenantId AND name = :name
      `,
      parameters: [
        stringParam('tenantId', this.tenantId),
        stringParam('name', name)
      ]
    });

    logger.info('Circuit breaker closed', { name });
    await this.logEvent(name, 'closed', { reason: 'manual_or_recovery' });
  }

  /**
   * Force open a circuit breaker (admin override)
   */
  async forceOpen(name: string, reason: string): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE bobble_circuit_breakers
        SET state = 'OPEN',
            last_tripped_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = :tenantId AND name = :name
      `,
      parameters: [
        stringParam('tenantId', this.tenantId),
        stringParam('name', name)
      ]
    });

    logger.warn('Circuit breaker force opened', { name, reason });
    await this.logEvent(name, 'force_opened', { reason });
  }

  /**
   * Force close a circuit breaker (admin override)
   */
  async forceClose(name: string, reason: string): Promise<void> {
    await this.closeBreaker(name);
    await this.logEvent(name, 'force_closed', { reason });
  }

  /**
   * Get current intervention level based on all breakers
   */
  async getInterventionLevel(): Promise<InterventionLevel> {
    const breakers = await this.getAllBreakers();
    
    // Check master sanity breaker
    const masterSanity = breakers.find(b => b.name === 'master_sanity');
    if (masterSanity?.state === 'OPEN') {
      return 'HIBERNATE';
    }

    // Check cost breaker
    const costBreaker = breakers.find(b => b.name === 'cost_budget');
    if (costBreaker?.state === 'OPEN') {
      return 'PAUSE';
    }

    // Check anxiety breaker
    const anxietyBreaker = breakers.find(b => b.name === 'high_anxiety');
    if (anxietyBreaker?.state === 'OPEN') {
      return 'DAMPEN';
    }

    // Count open breakers
    const openCount = breakers.filter(b => b.state === 'OPEN').length;
    if (openCount >= 3) return 'RESET';
    if (openCount >= 2) return 'PAUSE';
    if (openCount >= 1) return 'DAMPEN';

    return 'NONE';
  }

  /**
   * Get neurochemical state from consciousness
   */
  async getNeurochemistry(): Promise<NeurochemicalState | null> {
    try {
      const result = await executeStatement({
        sql: `
          SELECT anxiety, fatigue, temperature, confidence, curiosity, frustration
          FROM bobble_neurochemistry
          WHERE tenant_id = :tenantId
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        parameters: [stringParam('tenantId', this.tenantId)]
      });

      if (!result.rows || result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        anxiety: parseFloat(row.anxiety as string),
        fatigue: parseFloat(row.fatigue as string),
        temperature: parseFloat(row.temperature as string),
        confidence: parseFloat(row.confidence as string),
        curiosity: parseFloat(row.curiosity as string),
        frustration: parseFloat(row.frustration as string)
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate composite risk score
   */
  async calculateRiskScore(): Promise<number> {
    const breakers = await this.getAllBreakers();
    const neuro = await this.getNeurochemistry();

    let score = 0;

    // Breaker contribution (0-50)
    const openBreakers = breakers.filter(b => b.state === 'OPEN').length;
    const halfOpenBreakers = breakers.filter(b => b.state === 'HALF_OPEN').length;
    score += openBreakers * 15;
    score += halfOpenBreakers * 5;

    // Neurochemistry contribution (0-50)
    if (neuro) {
      score += neuro.anxiety * 20;
      score += neuro.fatigue * 15;
      score += neuro.frustration * 15;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Get full dashboard data
   */
  async getDashboard(): Promise<CircuitBreakerDashboard> {
    const breakers = await this.getAllBreakers();
    const interventionLevel = await this.getInterventionLevel();
    const neurochemistry = await this.getNeurochemistry();
    const riskScore = await this.calculateRiskScore();

    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (riskScore >= 70) overallHealth = 'critical';
    else if (riskScore >= 30) overallHealth = 'degraded';

    return {
      breakers,
      overallHealth,
      interventionLevel,
      neurochemistry,
      riskScore,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Update breaker configuration
   */
  async updateConfig(name: string, config: Partial<CircuitBreakerConfig>): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [
      stringParam('tenantId', this.tenantId),
      stringParam('name', name)
    ];

    if (config.enabled !== undefined) {
      updates.push('enabled = :enabled');
      params.push(boolParam('enabled', config.enabled));
    }
    if (config.tripThreshold !== undefined) {
      updates.push('trip_threshold = :threshold');
      params.push(longParam('threshold', config.tripThreshold));
    }
    if (config.resetTimeoutSeconds !== undefined) {
      updates.push('reset_timeout_seconds = :timeout');
      params.push(longParam('timeout', config.resetTimeoutSeconds));
    }
    if (config.halfOpenMaxAttempts !== undefined) {
      updates.push('half_open_max_attempts = :attempts');
      params.push(longParam('attempts', config.halfOpenMaxAttempts));
    }

    if (updates.length === 0) return;

    await executeStatement({
      sql: `
        UPDATE bobble_circuit_breakers
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE tenant_id = :tenantId AND name = :name
      `,
      parameters: params
    });

    logger.info('Circuit breaker config updated', { name, config });
  }

  /**
   * Get event history for a breaker
   */
  async getEventHistory(name: string, limit: number = 50): Promise<any[]> {
    const result = await executeStatement({
      sql: `
        SELECT event_type, details, created_at
        FROM bobble_circuit_breaker_events
        WHERE tenant_id = :tenantId AND breaker_name = :name
        ORDER BY created_at DESC
        LIMIT :limit
      `,
      parameters: [
        stringParam('tenantId', this.tenantId),
        stringParam('name', name),
        longParam('limit', limit)
      ]
    });

    return result.rows || [];
  }

  // ============ Private Helper Methods ============

  private async transitionToHalfOpen(name: string): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE bobble_circuit_breakers
        SET state = 'HALF_OPEN', half_open_attempts = 0, updated_at = NOW()
        WHERE tenant_id = :tenantId AND name = :name
      `,
      parameters: [
        stringParam('tenantId', this.tenantId),
        stringParam('name', name)
      ]
    });

    logger.info('Circuit breaker transitioned to HALF_OPEN', { name });
    await this.logEvent(name, 'half_open', { reason: 'timeout_elapsed' });
  }

  private async incrementHalfOpenAttempts(name: string): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE bobble_circuit_breakers
        SET half_open_attempts = half_open_attempts + 1, updated_at = NOW()
        WHERE tenant_id = :tenantId AND name = :name
      `,
      parameters: [
        stringParam('tenantId', this.tenantId),
        stringParam('name', name)
      ]
    });
  }

  private async logEvent(name: string, eventType: string, details: Record<string, any>): Promise<void> {
    try {
      await executeStatement({
        sql: `
          INSERT INTO bobble_circuit_breaker_events 
          (tenant_id, breaker_name, event_type, details, created_at)
          VALUES (:tenantId, :name, :eventType, :details, NOW())
        `,
        parameters: [
          stringParam('tenantId', this.tenantId),
          stringParam('name', name),
          stringParam('eventType', eventType),
          stringParam('details', JSON.stringify(details))
        ]
      });
    } catch (error) {
      logger.warn('Failed to log circuit breaker event', { error });
    }
  }

  private async publishMetric(name: string, state: CircuitState): Promise<void> {
    try {
      await this.cloudwatch.send(new PutMetricDataCommand({
        Namespace: 'Bobble/Consciousness',
        MetricData: [
          {
            MetricName: `CircuitBreaker${name.replace(/_/g, '')}`,
            Value: state === 'OPEN' ? 1 : 0,
            Unit: 'None',
            Dimensions: [{ Name: 'State', Value: state }]
          }
        ]
      }));
    } catch (error) {
      logger.warn('Failed to publish circuit breaker metric', { error });
    }
  }

  private async sendNotification(name: string, eventType: string, message: string): Promise<void> {
    if (!this.notificationTopicArn) return;

    try {
      await this.sns.send(new PublishCommand({
        TopicArn: this.notificationTopicArn,
        Subject: `Bobble Circuit Breaker: ${name} ${eventType}`,
        Message: JSON.stringify({
          breaker: name,
          event: eventType,
          message,
          timestamp: new Date().toISOString()
        })
      }));
    } catch (error) {
      logger.warn('Failed to send circuit breaker notification', { error });
    }
  }

  private getDefaultBreakers(): CircuitBreakerState[] {
    const defaults: CircuitBreakerConfig[] = [
      {
        name: 'master_sanity',
        enabled: true,
        tripThreshold: 3,
        resetTimeoutSeconds: 3600,
        halfOpenMaxAttempts: 1,
        description: 'Master safety breaker - requires admin approval to reset'
      },
      {
        name: 'cost_budget',
        enabled: true,
        tripThreshold: 1,
        resetTimeoutSeconds: 86400,
        halfOpenMaxAttempts: 1,
        description: 'Trips when budget threshold exceeded'
      },
      {
        name: 'high_anxiety',
        enabled: true,
        tripThreshold: 5,
        resetTimeoutSeconds: 600,
        halfOpenMaxAttempts: 3,
        description: 'Trips when anxiety sustained above 80%'
      },
      {
        name: 'model_failures',
        enabled: true,
        tripThreshold: 5,
        resetTimeoutSeconds: 300,
        halfOpenMaxAttempts: 2,
        description: 'Trips on consecutive model invocation failures'
      },
      {
        name: 'contradiction_loop',
        enabled: true,
        tripThreshold: 3,
        resetTimeoutSeconds: 900,
        halfOpenMaxAttempts: 2,
        description: 'Trips on repeated contradictions detected'
      }
    ];

    return defaults.map(config => ({
      name: config.name,
      state: 'CLOSED' as CircuitState,
      tripCount: 0,
      lastTrippedAt: null,
      lastClosedAt: null,
      consecutiveFailures: 0,
      halfOpenAttempts: 0,
      config
    }));
  }
}

// Singleton instance
export const circuitBreakerService = new CircuitBreakerService();
export { CircuitBreakerService };
