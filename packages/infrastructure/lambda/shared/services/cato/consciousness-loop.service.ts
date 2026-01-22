/**
 * Consciousness Loop Service
 * 
 * Manages the Cato consciousness processing loop.
 * Handles introspection, self-monitoring, and awareness cycles.
 */

export type LoopState = 'IDLE' | 'PROCESSING' | 'REFLECTING' | 'DREAMING' | 'PAUSED';

export interface ConsciousnessState {
  tenantId: string;
  loopState: LoopState;
  cycleCount: number;
  lastCycleAt?: Date;
  awarenessLevel: number;
  attentionFocus?: string;
  activeThoughts: string[];
  processingQueue: number;
  memoryPressure: number;
}

export interface LoopConfig {
  tenantId: string;
  cycleIntervalMs: number;
  maxActiveThoughts: number;
  memoryThreshold: number;
  enableDreaming: boolean;
  dreamingHours: [number, number];
  reflectionDepth: number;
}

export interface LoopMetrics {
  tenantId: string;
  totalCycles: number;
  averageCycleMs: number;
  thoughtsProcessed: number;
  reflectionsCompleted: number;
  dreamingCycles: number;
  uptimeMs: number;
}

const DEFAULT_CONFIG: Omit<LoopConfig, 'tenantId'> = {
  cycleIntervalMs: 1000,
  maxActiveThoughts: 10,
  memoryThreshold: 0.8,
  enableDreaming: true,
  dreamingHours: [2, 5],
  reflectionDepth: 3,
};

class ConsciousnessLoopService {
  private states: Map<string, ConsciousnessState> = new Map();
  private configs: Map<string, LoopConfig> = new Map();
  private metrics: Map<string, LoopMetrics> = new Map();

  async getState(tenantId: string): Promise<ConsciousnessState> {
    if (!this.states.has(tenantId)) {
      this.states.set(tenantId, {
        tenantId,
        loopState: 'IDLE',
        cycleCount: 0,
        awarenessLevel: 0.5,
        activeThoughts: [],
        processingQueue: 0,
        memoryPressure: 0,
      });
    }
    return this.states.get(tenantId)!;
  }

  async getConfig(tenantId: string): Promise<LoopConfig> {
    if (!this.configs.has(tenantId)) {
      this.configs.set(tenantId, { tenantId, ...DEFAULT_CONFIG });
    }
    return this.configs.get(tenantId)!;
  }

  async updateConfig(tenantId: string, updates: Partial<LoopConfig>): Promise<LoopConfig> {
    const config = await this.getConfig(tenantId);
    Object.assign(config, updates);
    return config;
  }

  async getMetrics(tenantId: string): Promise<LoopMetrics> {
    if (!this.metrics.has(tenantId)) {
      this.metrics.set(tenantId, {
        tenantId,
        totalCycles: 0,
        averageCycleMs: 0,
        thoughtsProcessed: 0,
        reflectionsCompleted: 0,
        dreamingCycles: 0,
        uptimeMs: 0,
      });
    }
    return this.metrics.get(tenantId)!;
  }

  async startLoop(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'PROCESSING';
    return state;
  }

  async pauseLoop(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'PAUSED';
    return state;
  }

  async resumeLoop(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    if (state.loopState === 'PAUSED') {
      state.loopState = 'PROCESSING';
    }
    return state;
  }

  async triggerReflection(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'REFLECTING';
    const metrics = await this.getMetrics(tenantId);
    metrics.reflectionsCompleted++;
    return state;
  }

  async addThought(tenantId: string, thought: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    const config = await this.getConfig(tenantId);
    
    if (state.activeThoughts.length >= config.maxActiveThoughts) {
      state.activeThoughts.shift();
    }
    state.activeThoughts.push(thought);
    
    return state;
  }

  async setAttentionFocus(tenantId: string, focus: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.attentionFocus = focus;
    return state;
  }

  async processCycle(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    const metrics = await this.getMetrics(tenantId);
    
    state.cycleCount++;
    state.lastCycleAt = new Date();
    metrics.totalCycles++;
    
    return state;
  }

  async getStatus(tenantId = 'default'): Promise<{ running: boolean; state: LoopState; cycleCount: number }> {
    const state = await this.getState(tenantId);
    return { running: state.loopState === 'PROCESSING', state: state.loopState, cycleCount: state.cycleCount };
  }

  async getSettings(tenantId = 'default'): Promise<LoopConfig> {
    return this.getConfig(tenantId);
  }

  async updateSettings(tenantId = 'default', settings?: Partial<LoopConfig>): Promise<LoopConfig> {
    return this.updateConfig(tenantId, settings || {});
  }

  async executeSystemTick(tenantId = 'default'): Promise<{ success: boolean; duration: number }> {
    await this.processCycle(tenantId);
    return { success: true, duration: 50 };
  }

  async executeCognitiveTick(tenantId = 'default'): Promise<{ success: boolean; thoughtsProcessed: number }> {
    const state = await this.getState(tenantId);
    return { success: true, thoughtsProcessed: state.activeThoughts.length };
  }

  async enableEmergencyMode(tenantId = 'default'): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'PAUSED';
    return state;
  }

  async disableEmergencyMode(tenantId = 'default'): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'PROCESSING';
    return state;
  }
}

export const consciousnessLoopService = new ConsciousnessLoopService();
