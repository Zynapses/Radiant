/**
 * Genesis Service
 * 
 * Manages Genesis developmental gates and system state.
 * Part of the Cato Genesis Safety Architecture.
 */

import { v4 as uuidv4 } from 'uuid';

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
  private states: Map<string, GenesisState> = new Map();

  async getState(tenantId: string): Promise<GenesisState> {
    if (!this.states.has(tenantId)) {
      this.states.set(tenantId, this.createDefaultState(tenantId));
    }
    return this.states.get(tenantId)!;
  }

  async updateStage(tenantId: string, stage: GenesisStage): Promise<GenesisState> {
    const state = await this.getState(tenantId);
    state.currentStage = stage;
    state.lastAssessment = new Date();
    return state;
  }

  async passGate(tenantId: string, gateId: string): Promise<GenesisGate> {
    const state = await this.getState(tenantId);
    const gate = state.gates.find(g => g.gateId === gateId);
    if (!gate) throw new Error(`Gate ${gateId} not found`);
    gate.status = 'PASSED';
    gate.passedAt = new Date();
    return gate;
  }

  async bypassGate(tenantId: string, gateId: string, reason: string): Promise<GenesisGate> {
    const state = await this.getState(tenantId);
    const gate = state.gates.find(g => g.gateId === gateId);
    if (!gate) throw new Error(`Gate ${gateId} not found`);
    gate.status = 'BYPASSED';
    gate.bypassReason = reason;
    return gate;
  }

  async getGates(tenantId: string): Promise<GenesisGate[]> {
    const state = await this.getState(tenantId);
    return state.gates;
  }

  async addCapability(tenantId: string, capability: string): Promise<void> {
    const state = await this.getState(tenantId);
    if (!state.capabilities.includes(capability)) {
      state.capabilities.push(capability);
    }
  }

  async removeRestriction(tenantId: string, restriction: string): Promise<void> {
    const state = await this.getState(tenantId);
    state.restrictions = state.restrictions.filter(r => r !== restriction);
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
}

export const genesisService = new GenesisService();
