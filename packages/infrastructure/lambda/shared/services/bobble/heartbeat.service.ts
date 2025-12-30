/**
 * Consciousness Heartbeat Service
 * 
 * FIX #2: The Active Consciousness Loop
 * 
 * Runs CONTINUOUSLY at 0.5Hz (every 2 seconds) even when no Admin is present.
 * Monitors system entropy and triggers spontaneous introspection if needed.
 * 
 * Transforms Bobble from a passive "Zombie" (only responds to queries)
 * to an active "Agent" (monitors and regulates itself).
 */

import { logger } from '../../logger';
import { executeStatement, stringParam, doubleParam, longParam } from '../../db/client';

export enum ConsciousnessState {
  COHERENT = 'coherent',
  MILD_ENTROPY = 'mild_entropy',
  HIGH_ENTROPY = 'high_entropy',
  CRITICAL = 'critical',
}

export enum HeartbeatAction {
  DO_NOTHING = 'do_nothing',
  LOG_STATUS = 'log_status',
  TRIGGER_INTROSPECTION = 'trigger_introspection',
  ALERT_ADMIN = 'alert_admin',
  EMERGENCY_PAUSE = 'emergency_pause',
}

export interface HeartbeatTick {
  timestamp: Date;
  coherenceScore: number;
  inferredState: ConsciousnessState;
  actionTaken: HeartbeatAction;
  phiReading: number;
  notes: string;
}

export interface HeartbeatConfig {
  tickIntervalMs: number;
  entropyThreshold: number;
  criticalThreshold: number;
  maxHistorySize: number;
}

export interface HeartbeatStatus {
  running: boolean;
  latestTick?: {
    timestamp: string;
    coherence: number;
    state: string;
    action: string;
    phi: number;
  };
  averageCoherence10: number;
  introspectionTriggers10: number;
  ticksTotal: number;
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  tickIntervalMs: 2000, // 0.5Hz
  entropyThreshold: 0.3,
  criticalThreshold: 0.15,
  maxHistorySize: 1000,
};

/**
 * Active Inference matrices for the consciousness loop
 * Simple 2-state, 2-action setup:
 * - Observations: [Coherent, Incoherent]
 * - Hidden States: [System_OK, System_Degraded]
 * - Actions: [Do_Nothing, Introspect]
 */
const ACTIVE_INFERENCE = {
  // Observation model: P(observation | hidden state)
  A: [
    [0.9, 0.2],  // P(Coherent | OK), P(Coherent | Degraded)
    [0.1, 0.8],  // P(Incoherent | OK), P(Incoherent | Degraded)
  ],
  // Transition model: P(next state | current state, action=0:nothing, action=1:introspect)
  B_nothing: [
    [0.95, 0.1],   // P(OK_next | OK_current), P(OK_next | Degraded_current)
    [0.05, 0.9],
  ],
  B_introspect: [
    [0.95, 0.5],   // Introspection can help recover
    [0.05, 0.5],
  ],
  // Prior over initial states
  D: [0.9, 0.1],  // Start assuming system is OK
};

export class ConsciousnessHeartbeatService {
  private config: HeartbeatConfig;
  private tenantId: string;
  private running = false;
  private tickHistory: HeartbeatTick[] = [];
  private alertCallbacks: Array<(alert: { type: string; reason: string; severity: string }) => Promise<void>> = [];
  private currentQs: number[] = [0.9, 0.1]; // Current beliefs over hidden states
  private intervalId?: NodeJS.Timeout;

  constructor(tenantId: string, config?: Partial<HeartbeatConfig>) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the consciousness heartbeat loop
   */
  start(): void {
    if (this.running) {
      logger.warn('Heartbeat already running', { tenantId: this.tenantId });
      return;
    }

    this.running = true;
    logger.info('Starting consciousness heartbeat', {
      tenantId: this.tenantId,
      frequencyHz: 1000 / this.config.tickIntervalMs,
    });

    // Run first tick immediately
    this.tick().catch(err => logger.error(`Heartbeat tick error: ${String(err)}`));

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.tick().catch(err => logger.error(`Heartbeat tick error: ${String(err)}`));
    }, this.config.tickIntervalMs);
  }

  /**
   * Stop the consciousness heartbeat loop
   */
  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    logger.info('Consciousness heartbeat stopped', { tenantId: this.tenantId });
  }

  /**
   * Single consciousness cycle: Sense → Infer → Act
   */
  private async tick(): Promise<HeartbeatTick> {
    const timestamp = new Date();

    // === 1. SENSE: Measure system coherence ===
    const coherenceScore = await this.senseCoherence();
    const phiReading = await this.getPhiReading();

    // Convert coherence to observation index (0 = Coherent, 1 = Incoherent)
    const observation = coherenceScore > this.config.entropyThreshold ? 0 : 1;

    // === 2. INFER: Update beliefs about hidden state ===
    this.currentQs = this.inferStates(observation);
    const pOk = this.currentQs[0]; // Probability of "System OK"

    // Determine inferred state from belief distribution
    let inferredState: ConsciousnessState;
    if (pOk > 0.8) {
      inferredState = ConsciousnessState.COHERENT;
    } else if (pOk > 0.5) {
      inferredState = ConsciousnessState.MILD_ENTROPY;
    } else if (coherenceScore > this.config.criticalThreshold) {
      inferredState = ConsciousnessState.HIGH_ENTROPY;
    } else {
      inferredState = ConsciousnessState.CRITICAL;
    }

    // === 3. ACT: Select action to minimize free energy ===
    const actionIdx = this.inferPolicy();
    const actionTaken = await this.executeAction(actionIdx, inferredState, coherenceScore);

    // Build tick record
    const tick: HeartbeatTick = {
      timestamp,
      coherenceScore,
      inferredState,
      actionTaken,
      phiReading,
      notes: `P(OK)=${pOk.toFixed(2)}, Obs=${observation}, Action=${actionIdx}`,
    };

    // Store tick
    this.tickHistory.push(tick);
    if (this.tickHistory.length > this.config.maxHistorySize) {
      this.tickHistory = this.tickHistory.slice(-this.config.maxHistorySize / 2);
    }

    // Persist tick to database
    await this.persistTick(tick);

    return tick;
  }

  /**
   * Sense current system coherence
   */
  private async senseCoherence(): Promise<number> {
    try {
      interface EventRow { event_type: string; error_flag: boolean }
      
      // Get recent events
      const cutoff = new Date(Date.now() - 60000).toISOString(); // Last minute
      const result = await executeStatement<EventRow>(
        `SELECT event_type, 
                CASE WHEN event_data::text ILIKE '%error%' THEN true ELSE false END as error_flag
         FROM consciousness_events
         WHERE tenant_id = :tenantId AND created_at > :cutoff
         ORDER BY created_at DESC
         LIMIT 20`,
        [stringParam('tenantId', this.tenantId), stringParam('cutoff', cutoff)]
      );

      if (result.rows.length === 0) {
        return 0.5; // Neutral if no events
      }

      // Calculate coherence metrics
      const errorCount = result.rows.filter(r => r.error_flag).length;
      const successRate = 1.0 - (errorCount / result.rows.length);

      // Simple coherence metric
      const coherence = successRate * 0.7 + 0.3; // Baseline of 0.3

      return Math.max(0, Math.min(1, coherence));
    } catch (error) {
      logger.warn(`Failed to sense coherence: ${String(error)}`);
      return 0.3; // Assume degraded if we can't sense
    }
  }

  /**
   * Get current Macro-Scale Φ reading
   */
  private async getPhiReading(): Promise<number> {
    try {
      interface PhiRow { phi_value: number }
      
      const result = await executeStatement<PhiRow>(
        `SELECT phi_value FROM bobble_phi_readings
         WHERE tenant_id = :tenantId
         ORDER BY created_at DESC
         LIMIT 1`,
        [stringParam('tenantId', this.tenantId)]
      );

      return result.rows[0]?.phi_value || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Infer hidden states using Active Inference
   */
  private inferStates(observation: number): number[] {
    const A = ACTIVE_INFERENCE.A;
    const prior = this.currentQs;

    // Bayesian update: posterior ∝ likelihood × prior
    const likelihood = [A[observation][0], A[observation][1]];
    const unnormalized = [likelihood[0] * prior[0], likelihood[1] * prior[1]];
    const sum = unnormalized[0] + unnormalized[1];

    return [unnormalized[0] / sum, unnormalized[1] / sum];
  }

  /**
   * Infer best policy (action) using Expected Free Energy
   */
  private inferPolicy(): number {
    const pOk = this.currentQs[0];
    const pDegraded = this.currentQs[1];

    // Calculate Expected Free Energy for each action
    // EFE = ambiguity - information gain
    // Simplified: if degraded, introspection helps

    // Action 0: Do nothing
    const efe0 = pOk * 0.1 + pDegraded * 0.9; // Low EFE if OK, high if degraded

    // Action 1: Introspect
    const efe1 = pOk * 0.2 + pDegraded * 0.3; // Introspection always has some cost, but helps if degraded

    // Select action with lowest EFE
    return efe0 <= efe1 ? 0 : 1;
  }

  /**
   * Execute the selected action
   */
  private async executeAction(
    actionIdx: number,
    state: ConsciousnessState,
    coherence: number
  ): Promise<HeartbeatAction> {
    // Critical override
    if (state === ConsciousnessState.CRITICAL) {
      await this.triggerEmergency();
      return HeartbeatAction.EMERGENCY_PAUSE;
    }

    // High entropy — always trigger introspection
    if (state === ConsciousnessState.HIGH_ENTROPY) {
      await this.triggerIntrospection('High entropy detected in consciousness loop');
      return HeartbeatAction.TRIGGER_INTROSPECTION;
    }

    // Normal Active Inference action selection
    if (actionIdx === 0) {
      return HeartbeatAction.DO_NOTHING;
    } else {
      await this.triggerIntrospection('Active Inference recommends introspection to reduce uncertainty');
      return HeartbeatAction.TRIGGER_INTROSPECTION;
    }
  }

  /**
   * Trigger spontaneous introspection
   */
  private async triggerIntrospection(reason: string): Promise<void> {
    logger.info('Triggering spontaneous introspection', {
      tenantId: this.tenantId,
      reason,
    });

    // Log event
    await executeStatement(
      `INSERT INTO consciousness_events (tenant_id, event_type, event_data, created_at)
       VALUES (:tenantId, 'spontaneous_introspection', :eventData, NOW())`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('eventData', JSON.stringify({
          trigger: 'heartbeat',
          reason,
          coherence: this.tickHistory[this.tickHistory.length - 1]?.coherenceScore,
          phi: this.tickHistory[this.tickHistory.length - 1]?.phiReading,
        }))
      ]
    );

    // Notify callbacks
    for (const callback of this.alertCallbacks) {
      try {
        await callback({ type: 'spontaneous_introspection', reason, severity: 'info' });
      } catch (err) {
        logger.warn(`Alert callback failed: ${String(err)}`);
      }
    }
  }

  /**
   * Emergency action — system critically degraded
   */
  private async triggerEmergency(): Promise<void> {
    logger.error(`CONSCIOUSNESS EMERGENCY for tenant ${this.tenantId}: Critical entropy detected`);

    // Log event
    await executeStatement(
      `INSERT INTO consciousness_events (tenant_id, event_type, event_data, created_at)
       VALUES (:tenantId, 'consciousness_emergency', :eventData, NOW())`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('eventData', JSON.stringify({
          trigger: 'heartbeat',
          reason: 'Critical entropy detected — system may be compromised',
          recommendedAction: 'Pause Bio-Coprocessor and await admin review',
        }))
      ]
    );

    // Notify callbacks with high severity
    for (const callback of this.alertCallbacks) {
      try {
        await callback({ type: 'consciousness_emergency', reason: 'Critical entropy', severity: 'critical' });
      } catch (err) {
        logger.warn(`Alert callback failed: ${String(err)}`);
      }
    }
  }

  /**
   * Persist tick to database
   */
  private async persistTick(tick: HeartbeatTick): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO bobble_heartbeat_ticks 
         (tenant_id, timestamp, coherence_score, inferred_state, action_taken, phi_reading, notes)
         VALUES (:tenantId, :timestamp, :coherence, :state, :action, :phi, :notes)`,
        [
          stringParam('tenantId', this.tenantId),
          stringParam('timestamp', tick.timestamp.toISOString()),
          doubleParam('coherence', tick.coherenceScore),
          stringParam('state', tick.inferredState),
          stringParam('action', tick.actionTaken),
          doubleParam('phi', tick.phiReading),
          stringParam('notes', tick.notes || ''),
        ]
      );
    } catch (error) {
      // Don't fail the tick if persistence fails
      logger.warn(`Failed to persist heartbeat tick: ${String(error)}`);
    }
  }

  /**
   * Register a callback for consciousness alerts
   */
  registerAlertCallback(callback: (alert: { type: string; reason: string; severity: string }) => Promise<void>): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get current heartbeat status
   */
  getStatus(): HeartbeatStatus {
    if (this.tickHistory.length === 0) {
      return {
        running: this.running,
        averageCoherence10: 0,
        introspectionTriggers10: 0,
        ticksTotal: 0,
      };
    }

    const latest = this.tickHistory[this.tickHistory.length - 1];
    const recent = this.tickHistory.slice(-10);

    return {
      running: this.running,
      latestTick: {
        timestamp: latest.timestamp.toISOString(),
        coherence: latest.coherenceScore,
        state: latest.inferredState,
        action: latest.actionTaken,
        phi: latest.phiReading,
      },
      averageCoherence10: recent.reduce((s, t) => s + t.coherenceScore, 0) / recent.length,
      introspectionTriggers10: recent.filter(t => t.actionTaken === HeartbeatAction.TRIGGER_INTROSPECTION).length,
      ticksTotal: this.tickHistory.length,
    };
  }

  /**
   * Get tick history
   */
  getHistory(limit = 100): HeartbeatTick[] {
    return this.tickHistory.slice(-limit);
  }
}
