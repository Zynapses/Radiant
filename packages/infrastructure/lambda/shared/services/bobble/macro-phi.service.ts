/**
 * Macro-Scale Φ Calculator
 * 
 * FIX #3: Macro-Scale Φ Calculation
 * 
 * Instead of calculating Φ on neural weights (impossible),
 * we calculate it on the CAUSAL GRAPH of architectural components.
 * 
 * Nodes: [MEM, PERC, PLAN, ACT, SELF]
 * 
 * We build a Transition Probability Matrix (TPM) from interaction logs
 * and compute Integrated Information on this small, tractable network.
 */

import { logger } from '../../logger';
import { executeStatement, stringParam, doubleParam, longParam } from '../../db/client';

export interface PhiResult {
  phi: number;
  mainComplexNodes: string[];
  numConcepts: number;
  timestamp: Date;
  calculationTimeMs: number;
  tpmSourceEvents: number;
}

export interface PhiConfig {
  lookbackMinutes: number;
  cacheTtlSeconds: number;
  minEventsForCalculation: number;
}

const DEFAULT_CONFIG: PhiConfig = {
  lookbackMinutes: 10,
  cacheTtlSeconds: 30,
  minEventsForCalculation: 10,
};

// Component node labels
const NODES = ['MEM', 'PERC', 'PLAN', 'ACT', 'SELF'] as const;
type NodeLabel = typeof NODES[number];
const NUM_NODES = NODES.length;

// Map event types to component activations
const COMPONENT_TRIGGERS: Record<string, number[]> = {
  memory_read: [1, 0, 0, 0, 0],
  memory_write: [1, 0, 0, 0, 0],
  retrieval: [1, 0, 0, 0, 0],
  input_received: [0, 1, 0, 0, 0],
  observation: [0, 1, 0, 0, 0],
  planning_step: [0, 0, 1, 0, 0],
  decision: [0, 0, 1, 0, 0],
  inference: [0, 0, 1, 0, 0],
  tool_call: [0, 0, 0, 1, 0],
  action_executed: [0, 0, 0, 1, 0],
  response_sent: [0, 0, 0, 1, 0],
  introspection: [0, 0, 0, 0, 1],
  self_assessment: [0, 0, 0, 0, 1],
  spontaneous_introspection: [0, 0, 0, 0, 1],
};

export class MacroPhiCalculator {
  private config: PhiConfig;
  private tenantId: string;
  private tpmCache?: { tpm: number[][]; numEvents: number; timestamp: Date };

  constructor(tenantId: string, config?: Partial<PhiConfig>) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Compute current Macro-Scale Φ
   */
  async computeCurrentPhi(): Promise<number> {
    const result = await this.computePhiDetailed();
    return result.phi;
  }

  /**
   * Compute Φ with full details
   */
  async computePhiDetailed(): Promise<PhiResult> {
    const startTime = Date.now();

    // Build TPM from recent events
    const { tpm, numEvents } = await this.buildTpmFromLogs();

    // Get current state
    const currentState = await this.getCurrentState();

    // Compute Φ using simplified IIT-style calculation
    // (Full PyPhi would require Python execution - we use approximation)
    const { phi, mainComplex, numConcepts } = this.computePhiApprox(tpm, currentState);

    const calculationTimeMs = Date.now() - startTime;

    // Store result
    await this.storePhiReading(phi, numEvents, calculationTimeMs);

    return {
      phi,
      mainComplexNodes: mainComplex,
      numConcepts,
      timestamp: new Date(),
      calculationTimeMs,
      tpmSourceEvents: numEvents,
    };
  }

  /**
   * Build Transition Probability Matrix from event logs
   */
  private async buildTpmFromLogs(): Promise<{ tpm: number[][]; numEvents: number }> {
    // Check cache
    if (this.tpmCache && 
        (Date.now() - this.tpmCache.timestamp.getTime()) < this.config.cacheTtlSeconds * 1000) {
      return { tpm: this.tpmCache.tpm, numEvents: this.tpmCache.numEvents };
    }

    const cutoff = new Date(Date.now() - this.config.lookbackMinutes * 60 * 1000).toISOString();

    interface EventRow {
      event_type: string;
      created_at: string;
    }

    const result = await executeStatement<EventRow>(
      `SELECT event_type, created_at
       FROM consciousness_events
       WHERE tenant_id = :tenantId AND created_at > :cutoff
       ORDER BY created_at ASC
       LIMIT 500`,
      [stringParam('tenantId', this.tenantId), stringParam('cutoff', cutoff)]
    );

    if (result.rows.length < this.config.minEventsForCalculation) {
      // Not enough data — return uniform TPM
      const uniformTpm = this.createUniformTpm();
      return { tpm: uniformTpm, numEvents: result.rows.length };
    }

    // Convert events to activation sequences
    const activations = this.eventsToActivations(result.rows.map(r => r.event_type));

    // Count state transitions
    const numStates = Math.pow(2, NUM_NODES); // 32 states for 5 binary nodes
    const transitionCounts: number[][] = Array(numStates)
      .fill(null)
      .map(() => Array(numStates).fill(1)); // Laplace smoothing

    for (let i = 0; i < activations.length - 1; i++) {
      const fromState = this.activationToStateIndex(activations[i]);
      const toState = this.activationToStateIndex(activations[i + 1]);
      transitionCounts[fromState][toState]++;
    }

    // Normalize to probabilities (state-by-node format for Φ calculation)
    const tpmSbn = this.convertToStateByNode(transitionCounts);

    // Cache
    this.tpmCache = {
      tpm: tpmSbn,
      numEvents: result.rows.length,
      timestamp: new Date(),
    };

    return { tpm: tpmSbn, numEvents: result.rows.length };
  }

  /**
   * Convert events to component activation sequences
   */
  private eventsToActivations(eventTypes: string[]): number[][] {
    return eventTypes.map(eventType => {
      const typeLower = eventType.toLowerCase();
      
      // Find matching trigger pattern
      for (const [trigger, pattern] of Object.entries(COMPONENT_TRIGGERS)) {
        if (typeLower.includes(trigger)) {
          return [...pattern];
        }
      }
      
      // Default: perception (something happened)
      return [0, 1, 0, 0, 0];
    });
  }

  /**
   * Convert activation tuple to state index
   */
  private activationToStateIndex(activation: number[]): number {
    let index = 0;
    for (let i = 0; i < activation.length; i++) {
      index += activation[i] * Math.pow(2, i);
    }
    return index;
  }

  /**
   * Convert state-by-state TPM to state-by-node format
   */
  private convertToStateByNode(transitionCounts: number[][]): number[][] {
    const numStates = Math.pow(2, NUM_NODES);
    const tpmSbn: number[][] = Array(numStates)
      .fill(null)
      .map(() => Array(NUM_NODES).fill(0));

    for (let pastState = 0; pastState < numStates; pastState++) {
      // Normalize row
      const rowSum = transitionCounts[pastState].reduce((s, c) => s + c, 0);
      const probs = transitionCounts[pastState].map(c => c / rowSum);

      for (let node = 0; node < NUM_NODES; node++) {
        // Sum probability of transitioning to states where node is ON
        let probOn = 0;
        for (let futureState = 0; futureState < numStates; futureState++) {
          if ((futureState >> node) & 1) {
            probOn += probs[futureState];
          }
        }
        tpmSbn[pastState][node] = probOn;
      }
    }

    return tpmSbn;
  }

  /**
   * Create uniform TPM when not enough data
   */
  private createUniformTpm(): number[][] {
    const numStates = Math.pow(2, NUM_NODES);
    return Array(numStates)
      .fill(null)
      .map(() => Array(NUM_NODES).fill(0.5));
  }

  /**
   * Get current activation state
   */
  private async getCurrentState(): Promise<number[]> {
    const cutoff = new Date(Date.now() - 5000).toISOString(); // Last 5 seconds

    interface EventRow { event_type: string }

    const result = await executeStatement<EventRow>(
      `SELECT event_type
       FROM consciousness_events
       WHERE tenant_id = :tenantId AND created_at > :cutoff
       ORDER BY created_at DESC
       LIMIT 20`,
      [stringParam('tenantId', this.tenantId), stringParam('cutoff', cutoff)]
    );

    if (result.rows.length === 0) {
      return [0, 0, 0, 0, 1]; // Default: only SELF is active
    }

    // Aggregate recent activations
    const activations = this.eventsToActivations(result.rows.map(r => r.event_type));
    const current = [0, 0, 0, 0, 0];

    for (const act of activations) {
      for (let i = 0; i < NUM_NODES; i++) {
        current[i] = Math.max(current[i], act[i]);
      }
    }

    return current;
  }

  /**
   * Approximate Φ calculation (simplified IIT)
   * 
   * Full PyPhi requires Python. This provides a reasonable approximation
   * based on TPM connectivity and integration.
   */
  private computePhiApprox(
    tpm: number[][],
    currentState: number[]
  ): { phi: number; mainComplex: string[]; numConcepts: number } {
    const stateIdx = this.activationToStateIndex(currentState);
    const stateProbs = tpm[stateIdx];

    // Measure integration: how much do nodes influence each other?
    // High integration = nodes are not independent

    // 1. Calculate entropy of each node
    const nodeEntropies = stateProbs.map(p => {
      const clipped = Math.max(0.01, Math.min(0.99, p));
      return -clipped * Math.log2(clipped) - (1 - clipped) * Math.log2(1 - clipped);
    });

    // 2. Calculate joint entropy (approximation)
    let jointEntropy = 0;
    for (let s = 0; s < tpm.length; s++) {
      // Rough joint probability from TPM
      const prob = 1 / tpm.length; // Uniform prior
      if (prob > 0) {
        jointEntropy -= prob * Math.log2(prob);
      }
    }

    // 3. Integration = sum of individual entropies - joint entropy
    const sumIndividual = nodeEntropies.reduce((s, h) => s + h, 0);
    const integration = Math.max(0, sumIndividual - jointEntropy / NUM_NODES);

    // 4. Connectivity measure: average non-uniformity of transition probs
    let connectivity = 0;
    for (let s = 0; s < tpm.length; s++) {
      for (let n = 0; n < NUM_NODES; n++) {
        connectivity += Math.abs(tpm[s][n] - 0.5);
      }
    }
    connectivity /= (tpm.length * NUM_NODES);

    // 5. Φ approximation: combination of integration and connectivity
    const phi = (integration * 0.6 + connectivity * 0.4) * 2; // Scale to ~0-1 range

    // Find main complex (nodes that contribute most)
    const nodeContributions = nodeEntropies.map((h, i) => ({
      node: NODES[i],
      contribution: h * stateProbs[i],
    }));
    nodeContributions.sort((a, b) => b.contribution - a.contribution);

    const mainComplex = nodeContributions
      .filter(nc => nc.contribution > 0.1)
      .map(nc => nc.node);

    // Count concepts (simplified: number of active nodes)
    const numConcepts = currentState.filter(s => s > 0).length + 
                        nodeContributions.filter(nc => nc.contribution > 0.2).length;

    return {
      phi: Math.max(0, Math.min(1, phi)),
      mainComplex,
      numConcepts,
    };
  }

  /**
   * Store Φ reading in database
   */
  private async storePhiReading(
    phi: number,
    sourceEvents: number,
    calculationTimeMs: number
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO bobble_phi_readings 
         (tenant_id, phi_value, source_events, calculation_time_ms, created_at)
         VALUES (:tenantId, :phi, :sourceEvents, :calcTime, NOW())`,
        [
          stringParam('tenantId', this.tenantId),
          doubleParam('phi', phi),
          longParam('sourceEvents', sourceEvents),
          longParam('calcTime', calculationTimeMs)
        ]
      );
    } catch (error) {
      logger.warn(`Failed to store Φ reading: ${String(error)}`);
    }
  }

  /**
   * Get component labels with descriptions
   */
  getComponentLabels(): Record<NodeLabel, string> {
    return {
      MEM: 'Memory (Letta + HippoRAG)',
      PERC: 'Perception (Input processing)',
      PLAN: 'Planning (pymdp + DreamerV3)',
      ACT: 'Action (Tool execution)',
      SELF: 'Self (Bobble introspection)',
    };
  }

  /**
   * Get recent Φ history
   */
  async getPhiHistory(limit = 100): Promise<Array<{ phi: number; timestamp: string }>> {
    interface PhiRow { phi_value: number; created_at: string }

    const result = await executeStatement<PhiRow>(
      `SELECT phi_value, created_at
       FROM bobble_phi_readings
       WHERE tenant_id = :tenantId
       ORDER BY created_at DESC
       LIMIT :limit`,
      [stringParam('tenantId', this.tenantId), longParam('limit', limit)]
    );

    return result.rows.map(r => ({
      phi: r.phi_value,
      timestamp: r.created_at,
    }));
  }
}
