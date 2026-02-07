/**
 * Genesis Service
 * 
 * Manages Genesis developmental gates and system state.
 * Part of the Cato Genesis Safety Architecture.
 * 
 * Uses database persistence for state that must survive Lambda invocations.
 */

import { executeStatement } from '../../db/client';
import { logger } from '../../logging/enhanced-logger';
import { driftAwareWeightingService, type DriftSummary, type GenesisDriftFeedback } from '../drift-aware-weighting.service';

export type GenesisStage = 'EMBRYONIC' | 'NASCENT' | 'DEVELOPING' | 'MATURING' | 'MATURE';

export interface GenesisGate {
  gateId: string;
  name: string;
  description: string;
  stage: GenesisStage;
  requirements: string[];
  status: 'LOCKED' | 'PENDING' | 'PASSED' | 'BYPASSED';
  passedAt?: Date;
  bypassReason?: string;
}

export interface GenesisState {
  tenantId: string;
  currentStage: GenesisStage;
  gates: GenesisGate[];
  capabilities: string[];
  restrictions: string[];
  lastAssessment: Date;
}

const DEFAULT_GATES: Omit<GenesisGate, 'status' | 'passedAt'>[] = [
  { gateId: 'G1', name: 'Basic Safety', description: 'Core safety protocols active', stage: 'EMBRYONIC', requirements: ['safety_filters', 'content_moderation'] },
  { gateId: 'G2', name: 'Context Awareness', description: 'Context understanding verified', stage: 'NASCENT', requirements: ['context_retention', 'session_management'] },
  { gateId: 'G3', name: 'Ethical Reasoning', description: 'Ethics framework integrated', stage: 'DEVELOPING', requirements: ['ethics_checks', 'harm_prevention'] },
  { gateId: 'G4', name: 'Advanced Autonomy', description: 'Safe autonomous actions', stage: 'MATURING', requirements: ['checkpoint_system', 'rollback_capability'] },
  { gateId: 'G5', name: 'Full Capability', description: 'All capabilities unlocked', stage: 'MATURE', requirements: ['audit_compliance', 'governance_preset'] },
];

class GenesisService {
  async getState(tenantId: string): Promise<GenesisState> {
    try {
      // Fetch state from database
      const stateResult = await executeStatement(
        `SELECT current_stage, capabilities, restrictions, last_assessment
         FROM genesis_state WHERE tenant_id = $1`,
        [tenantId]
      );

      // Fetch gates from database
      const gatesResult = await executeStatement(
        `SELECT gate_id, name, description, stage, requirements, status, passed_at, bypass_reason
         FROM genesis_gates WHERE tenant_id = $1 ORDER BY gate_id`,
        [tenantId]
      );

      if (stateResult.rows.length === 0) {
        // Initialize state for new tenant
        await this.initializeState(tenantId);
        return this.getState(tenantId);
      }

      const row = stateResult.rows[0] as Record<string, unknown>;
      const gates: GenesisGate[] = gatesResult.rows.map((g: Record<string, unknown>) => ({
        gateId: g.gate_id as string,
        name: g.name as string,
        description: g.description as string,
        stage: g.stage as GenesisStage,
        requirements: (g.requirements as string[]) || [],
        status: g.status as 'LOCKED' | 'PENDING' | 'PASSED' | 'BYPASSED',
        passedAt: g.passed_at ? new Date(g.passed_at as string) : undefined,
        bypassReason: g.bypass_reason as string | undefined,
      }));

      return {
        tenantId,
        currentStage: row.current_stage as GenesisStage,
        gates,
        capabilities: (row.capabilities as string[]) || ['basic_chat', 'simple_queries'],
        restrictions: (row.restrictions as string[]) || ['no_external_actions', 'no_code_execution', 'no_file_access'],
        lastAssessment: new Date(row.last_assessment as string),
      };
    } catch (error) {
      logger.warn('Failed to fetch Genesis state from database, using defaults', { tenantId, error: String(error) });
      return this.createDefaultState(tenantId);
    }
  }

  private async initializeState(tenantId: string): Promise<void> {
    await executeStatement(
      `INSERT INTO genesis_state (tenant_id, current_stage, capabilities, restrictions)
       VALUES ($1, 'EMBRYONIC', $2::jsonb, $3::jsonb)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, JSON.stringify(['basic_chat', 'simple_queries']), JSON.stringify(['no_external_actions', 'no_code_execution', 'no_file_access'])]
    );

    for (const gate of DEFAULT_GATES) {
      await executeStatement(
        `INSERT INTO genesis_gates (tenant_id, gate_id, name, description, stage, requirements, status)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'LOCKED')
         ON CONFLICT (tenant_id, gate_id) DO NOTHING`,
        [tenantId, gate.gateId, gate.name, gate.description, gate.stage, JSON.stringify(gate.requirements)]
      );
    }
  }

  async updateStage(tenantId: string, stage: GenesisStage): Promise<GenesisState> {
    await executeStatement(
      `UPDATE genesis_state SET current_stage = $2, last_assessment = NOW(), updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, stage]
    );
    return this.getState(tenantId);
  }

  async passGate(tenantId: string, gateId: string): Promise<GenesisGate> {
    const result = await executeStatement(
      `UPDATE genesis_gates SET status = 'PASSED', passed_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND gate_id = $2
       RETURNING gate_id, name, description, stage, requirements, status, passed_at, bypass_reason`,
      [tenantId, gateId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Gate ${gateId} not found`);
    }

    const g = result.rows[0] as Record<string, unknown>;
    return {
      gateId: g.gate_id as string,
      name: g.name as string,
      description: g.description as string,
      stage: g.stage as GenesisStage,
      requirements: (g.requirements as string[]) || [],
      status: g.status as 'LOCKED' | 'PENDING' | 'PASSED' | 'BYPASSED',
      passedAt: g.passed_at ? new Date(g.passed_at as string) : undefined,
      bypassReason: g.bypass_reason as string | undefined,
    };
  }

  async bypassGate(tenantId: string, gateId: string, reason: string): Promise<GenesisGate> {
    const result = await executeStatement(
      `UPDATE genesis_gates SET status = 'BYPASSED', bypass_reason = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND gate_id = $2
       RETURNING gate_id, name, description, stage, requirements, status, passed_at, bypass_reason`,
      [tenantId, gateId, reason]
    );

    if (result.rows.length === 0) {
      throw new Error(`Gate ${gateId} not found`);
    }

    const g = result.rows[0] as Record<string, unknown>;
    return {
      gateId: g.gate_id as string,
      name: g.name as string,
      description: g.description as string,
      stage: g.stage as GenesisStage,
      requirements: (g.requirements as string[]) || [],
      status: g.status as 'LOCKED' | 'PENDING' | 'PASSED' | 'BYPASSED',
      passedAt: g.passed_at ? new Date(g.passed_at as string) : undefined,
      bypassReason: g.bypass_reason as string | undefined,
    };
  }

  async getGates(tenantId: string): Promise<GenesisGate[]> {
    const state = await this.getState(tenantId);
    return state.gates;
  }

  async addCapability(tenantId: string, capability: string): Promise<void> {
    await executeStatement(
      `UPDATE genesis_state 
       SET capabilities = capabilities || $2::jsonb, updated_at = NOW()
       WHERE tenant_id = $1 AND NOT capabilities ? $3`,
      [tenantId, JSON.stringify([capability]), capability]
    );
  }

  async removeRestriction(tenantId: string, restriction: string): Promise<void> {
    await executeStatement(
      `UPDATE genesis_state 
       SET restrictions = restrictions - $2, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, restriction]
    );
  }

  private createDefaultState(tenantId: string): GenesisState {
    return {
      tenantId,
      currentStage: 'EMBRYONIC',
      gates: DEFAULT_GATES.map(g => ({ ...g, status: 'LOCKED' as const })),
      capabilities: ['basic_chat', 'simple_queries'],
      restrictions: ['no_external_actions', 'no_code_execution', 'no_file_access'],
      lastAssessment: new Date(),
    };
  }

  async getGenesisState(tenantId = 'default'): Promise<GenesisState> {
    return this.getState(tenantId);
  }

  async isReadyForConsciousness(tenantId = 'default'): Promise<boolean> {
    const state = await this.getState(tenantId);
    return state.currentStage === 'MATURE' || state.currentStage === 'MATURING';
  }

  async getDevelopmentalGateStatus(tenantId = 'default'): Promise<GenesisGate[]> {
    return this.getGates(tenantId);
  }

  async getDevelopmentStatistics(tenantId = 'default'): Promise<Record<string, number>> {
    const state = await this.getState(tenantId);
    return {
      passedGates: state.gates.filter(g => g.status === 'PASSED').length,
      totalGates: state.gates.length,
      capabilities: state.capabilities.length,
      restrictions: state.restrictions.length,
    };
  }

  async advanceStage(tenantId = 'default', targetStage?: GenesisStage): Promise<GenesisState> {
    return this.updateStage(tenantId, targetStage || 'EMBRYONIC');
  }

  /**
   * v7.37.0: Check if model drift health allows gate advancement.
   * Uses BOTH static drift scores AND real-time invocation telemetry from
   * ALL 52+ services that call modelRouterService.invoke().
   * Genesis should not advance stages if underlying models are drifting
   * or if real-time failure/reroute rates are too high.
   */
  async isDriftHealthyForStage(tenantId: string, targetStage: GenesisStage): Promise<{
    healthy: boolean;
    driftSummary: DriftSummary;
    genesisFeedback?: GenesisDriftFeedback;
    reason?: string;
  }> {
    const summary = await driftAwareWeightingService.getDriftSummary(tenantId);

    // Stricter drift requirements for higher stages
    const stageMinAvgDrift: Record<GenesisStage, number> = {
      'EMBRYONIC': 0.3,
      'NASCENT': 0.4,
      'DEVELOPING': 0.5,
      'MATURING': 0.6,
      'MATURE': 0.7,
    };

    const stageMaxQuarantined: Record<GenesisStage, number> = {
      'EMBRYONIC': 5,
      'NASCENT': 3,
      'DEVELOPING': 2,
      'MATURING': 1,
      'MATURE': 0,
    };

    // v7.37.0: Real-time health thresholds per stage
    const stageMinHealthScore: Record<GenesisStage, number> = {
      'EMBRYONIC': 0.2,
      'NASCENT': 0.35,
      'DEVELOPING': 0.5,
      'MATURING': 0.65,
      'MATURE': 0.8,
    };

    const stageMaxFailureRate: Record<GenesisStage, number> = {
      'EMBRYONIC': 0.30,
      'NASCENT': 0.20,
      'DEVELOPING': 0.15,
      'MATURING': 0.10,
      'MATURE': 0.05,
    };

    const stageMaxRerouteRate: Record<GenesisStage, number> = {
      'EMBRYONIC': 0.50,
      'NASCENT': 0.40,
      'DEVELOPING': 0.30,
      'MATURING': 0.20,
      'MATURE': 0.10,
    };

    const minDrift = stageMinAvgDrift[targetStage];
    const maxQuarantined = stageMaxQuarantined[targetStage];

    // Check 1: Static drift scores
    if (summary.avgDriftScore < minDrift) {
      return {
        healthy: false,
        driftSummary: summary,
        reason: `Average drift score ${summary.avgDriftScore.toFixed(3)} below ${targetStage} minimum ${minDrift}`,
      };
    }

    if (summary.quarantinedModels > maxQuarantined) {
      return {
        healthy: false,
        driftSummary: summary,
        reason: `${summary.quarantinedModels} quarantined models exceeds ${targetStage} maximum ${maxQuarantined}`,
      };
    }

    // Check 2: Real-time telemetry from all services (v7.37.0)
    let genesisFeedback: GenesisDriftFeedback | undefined;
    try {
      genesisFeedback = await driftAwareWeightingService.getGenesisDriftFeedback(tenantId);

      // Only apply telemetry checks if we have meaningful data (>10 invocations)
      if (genesisFeedback.totalInvocations >= 10) {
        const minHealth = stageMinHealthScore[targetStage];
        const maxFailure = stageMaxFailureRate[targetStage];
        const maxReroute = stageMaxRerouteRate[targetStage];

        if (genesisFeedback.overallHealthScore < minHealth) {
          return {
            healthy: false,
            driftSummary: summary,
            genesisFeedback,
            reason: `Overall health score ${genesisFeedback.overallHealthScore.toFixed(3)} below ${targetStage} minimum ${minHealth} (based on ${genesisFeedback.totalInvocations} invocations in last hour)`,
          };
        }

        if (genesisFeedback.failureRate > maxFailure) {
          return {
            healthy: false,
            driftSummary: summary,
            genesisFeedback,
            reason: `Failure rate ${(genesisFeedback.failureRate * 100).toFixed(1)}% exceeds ${targetStage} maximum ${(maxFailure * 100).toFixed(0)}% (${genesisFeedback.failedInvocations}/${genesisFeedback.totalInvocations} failed)`,
          };
        }

        if (genesisFeedback.rerouteRate > maxReroute) {
          return {
            healthy: false,
            driftSummary: summary,
            genesisFeedback,
            reason: `Reroute rate ${(genesisFeedback.rerouteRate * 100).toFixed(1)}% exceeds ${targetStage} maximum ${(maxReroute * 100).toFixed(0)}% (${genesisFeedback.reroutedInvocations}/${genesisFeedback.totalInvocations} rerouted)`,
          };
        }
      }
    } catch (feedbackError) {
      logger.debug('Genesis drift feedback unavailable, using static scores only', {
        tenantId, error: String(feedbackError),
      });
    }

    return { healthy: true, driftSummary: summary, genesisFeedback };
  }
}

export const genesisService = new GenesisService();
