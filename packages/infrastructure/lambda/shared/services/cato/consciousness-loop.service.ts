/**
 * Consciousness Loop Service
 * 
 * Manages the Cato consciousness processing loop.
 * Handles introspection, self-monitoring, and awareness cycles.
 * 
 * Database-backed for Lambda cold start survival.
 */

import { executeStatement, stringParam, doubleParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';

export type LoopState = 'IDLE' | 'PROCESSING' | 'REFLECTING' | 'DREAMING' | 'PAUSED';
/** @deprecated Use LoopState instead */
export type LoopStatus = LoopState;

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

export class ConsciousnessLoopService {
  /**
   * Get consciousness state from database
   */
  async getState(tenantId: string): Promise<ConsciousnessState> {
    try {
      const result = await executeStatement(
        `SELECT * FROM cato_consciousness_state WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length > 0) {
        return this.mapRowToState(result.rows[0] as Record<string, unknown>);
      }

      // Create default state
      const defaultState: ConsciousnessState = {
        tenantId,
        loopState: 'IDLE',
        cycleCount: 0,
        awarenessLevel: 0.5,
        activeThoughts: [],
        processingQueue: 0,
        memoryPressure: 0,
      };

      await this.saveState(defaultState);
      return defaultState;
    } catch (error) {
      logger.warn('Failed to get consciousness state, using default', { error: String(error) });
      return {
        tenantId,
        loopState: 'IDLE',
        cycleCount: 0,
        awarenessLevel: 0.5,
        activeThoughts: [],
        processingQueue: 0,
        memoryPressure: 0,
      };
    }
  }

  /**
   * Save consciousness state to database
   */
  private async saveState(state: ConsciousnessState): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO cato_consciousness_state 
         (tenant_id, loop_state, cycle_count, last_cycle_at, awareness_level, attention_focus, active_thoughts, processing_queue, memory_pressure)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (tenant_id) DO UPDATE SET
           loop_state = $2,
           cycle_count = $3,
           last_cycle_at = $4,
           awareness_level = $5,
           attention_focus = $6,
           active_thoughts = $7,
           processing_queue = $8,
           memory_pressure = $9,
           updated_at = NOW()`,
        [
          stringParam('tenantId', state.tenantId),
          stringParam('loopState', state.loopState),
          { name: 'cycleCount', value: { longValue: state.cycleCount } },
          state.lastCycleAt ? stringParam('lastCycleAt', state.lastCycleAt.toISOString()) : { name: 'lastCycleAt', value: { isNull: true } },
          doubleParam('awarenessLevel', state.awarenessLevel),
          state.attentionFocus ? stringParam('attentionFocus', state.attentionFocus) : { name: 'attentionFocus', value: { isNull: true } },
          stringParam('activeThoughts', JSON.stringify(state.activeThoughts)),
          { name: 'processingQueue', value: { longValue: state.processingQueue } },
          doubleParam('memoryPressure', state.memoryPressure),
        ]
      );
    } catch (error) {
      logger.warn('Failed to save consciousness state', { error: String(error) });
    }
  }

  /**
   * Get loop configuration from database
   */
  async getConfig(tenantId: string): Promise<LoopConfig> {
    try {
      const result = await executeStatement(
        `SELECT * FROM cato_consciousness_config WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length > 0) {
        return this.mapRowToConfig(result.rows[0] as Record<string, unknown>);
      }

      // Create default config
      const defaultConfig: LoopConfig = { tenantId, ...DEFAULT_CONFIG };
      await this.saveConfig(defaultConfig);
      return defaultConfig;
    } catch (error) {
      logger.warn('Failed to get consciousness config, using default', { error: String(error) });
      return { tenantId, ...DEFAULT_CONFIG };
    }
  }

  /**
   * Save loop configuration to database
   */
  private async saveConfig(config: LoopConfig): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO cato_consciousness_config 
         (tenant_id, cycle_interval_ms, max_active_thoughts, memory_threshold, enable_dreaming, dreaming_hours, reflection_depth)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id) DO UPDATE SET
           cycle_interval_ms = $2,
           max_active_thoughts = $3,
           memory_threshold = $4,
           enable_dreaming = $5,
           dreaming_hours = $6,
           reflection_depth = $7,
           updated_at = NOW()`,
        [
          stringParam('tenantId', config.tenantId),
          { name: 'cycleIntervalMs', value: { longValue: config.cycleIntervalMs } },
          { name: 'maxActiveThoughts', value: { longValue: config.maxActiveThoughts } },
          doubleParam('memoryThreshold', config.memoryThreshold),
          { name: 'enableDreaming', value: { booleanValue: config.enableDreaming } },
          stringParam('dreamingHours', JSON.stringify(config.dreamingHours)),
          { name: 'reflectionDepth', value: { longValue: config.reflectionDepth } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to save consciousness config', { error: String(error) });
    }
  }

  /**
   * Update loop configuration
   */
  async updateConfig(tenantId: string, updates: Partial<LoopConfig>): Promise<LoopConfig> {
    const config = await this.getConfig(tenantId);
    Object.assign(config, updates);
    await this.saveConfig(config);
    return config;
  }

  /**
   * Get loop metrics from database
   */
  async getMetrics(tenantId: string): Promise<LoopMetrics> {
    try {
      const result = await executeStatement(
        `SELECT * FROM cato_consciousness_metrics WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length > 0) {
        return this.mapRowToMetrics(result.rows[0] as Record<string, unknown>);
      }

      // Create default metrics
      const defaultMetrics: LoopMetrics = {
        tenantId,
        totalCycles: 0,
        averageCycleMs: 0,
        thoughtsProcessed: 0,
        reflectionsCompleted: 0,
        dreamingCycles: 0,
        uptimeMs: 0,
      };

      await this.saveMetrics(defaultMetrics);
      return defaultMetrics;
    } catch (error) {
      logger.warn('Failed to get consciousness metrics, using default', { error: String(error) });
      return {
        tenantId,
        totalCycles: 0,
        averageCycleMs: 0,
        thoughtsProcessed: 0,
        reflectionsCompleted: 0,
        dreamingCycles: 0,
        uptimeMs: 0,
      };
    }
  }

  /**
   * Save loop metrics to database
   */
  private async saveMetrics(metrics: LoopMetrics): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO cato_consciousness_metrics 
         (tenant_id, total_cycles, average_cycle_ms, thoughts_processed, reflections_completed, dreaming_cycles, uptime_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id) DO UPDATE SET
           total_cycles = $2,
           average_cycle_ms = $3,
           thoughts_processed = $4,
           reflections_completed = $5,
           dreaming_cycles = $6,
           uptime_ms = $7,
           updated_at = NOW()`,
        [
          stringParam('tenantId', metrics.tenantId),
          { name: 'totalCycles', value: { longValue: metrics.totalCycles } },
          doubleParam('averageCycleMs', metrics.averageCycleMs),
          { name: 'thoughtsProcessed', value: { longValue: metrics.thoughtsProcessed } },
          { name: 'reflectionsCompleted', value: { longValue: metrics.reflectionsCompleted } },
          { name: 'dreamingCycles', value: { longValue: metrics.dreamingCycles } },
          { name: 'uptimeMs', value: { longValue: metrics.uptimeMs } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to save consciousness metrics', { error: String(error) });
    }
  }

  async startLoop(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'PROCESSING';
    await this.saveState(state);
    return state;
  }

  async pauseLoop(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'PAUSED';
    await this.saveState(state);
    return state;
  }

  async resumeLoop(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    if (state.loopState === 'PAUSED') {
      state.loopState = 'PROCESSING';
      await this.saveState(state);
    }
    return state;
  }

  async triggerReflection(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'REFLECTING';
    await this.saveState(state);
    
    const metrics = await this.getMetrics(tenantId);
    metrics.reflectionsCompleted++;
    await this.saveMetrics(metrics);
    
    return state;
  }

  async addThought(tenantId: string, thought: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    const config = await this.getConfig(tenantId);
    
    if (state.activeThoughts.length >= config.maxActiveThoughts) {
      state.activeThoughts.shift();
    }
    state.activeThoughts.push(thought);
    await this.saveState(state);
    
    return state;
  }

  async setAttentionFocus(tenantId: string, focus: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.attentionFocus = focus;
    await this.saveState(state);
    return state;
  }

  async processCycle(tenantId: string): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    const metrics = await this.getMetrics(tenantId);
    
    state.cycleCount++;
    state.lastCycleAt = new Date();
    await this.saveState(state);
    
    metrics.totalCycles++;
    await this.saveMetrics(metrics);
    
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
    const metrics = await this.getMetrics(tenantId);
    metrics.thoughtsProcessed += state.activeThoughts.length;
    await this.saveMetrics(metrics);
    return { success: true, thoughtsProcessed: state.activeThoughts.length };
  }

  async enableEmergencyMode(tenantId = 'default'): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'PAUSED';
    await this.saveState(state);
    return state;
  }

  async disableEmergencyMode(tenantId = 'default'): Promise<ConsciousnessState> {
    const state = await this.getState(tenantId);
    state.loopState = 'PROCESSING';
    await this.saveState(state);
    return state;
  }

  /**
   * Map database row to ConsciousnessState
   */
  private mapRowToState(row: Record<string, unknown>): ConsciousnessState {
    return {
      tenantId: String(row.tenant_id),
      loopState: String(row.loop_state) as LoopState,
      cycleCount: Number(row.cycle_count) || 0,
      lastCycleAt: row.last_cycle_at ? new Date(String(row.last_cycle_at)) : undefined,
      awarenessLevel: Number(row.awareness_level) || 0.5,
      attentionFocus: row.attention_focus ? String(row.attention_focus) : undefined,
      activeThoughts: row.active_thoughts ? JSON.parse(String(row.active_thoughts)) : [],
      processingQueue: Number(row.processing_queue) || 0,
      memoryPressure: Number(row.memory_pressure) || 0,
    };
  }

  /**
   * Map database row to LoopConfig
   */
  private mapRowToConfig(row: Record<string, unknown>): LoopConfig {
    return {
      tenantId: String(row.tenant_id),
      cycleIntervalMs: Number(row.cycle_interval_ms) || 1000,
      maxActiveThoughts: Number(row.max_active_thoughts) || 10,
      memoryThreshold: Number(row.memory_threshold) || 0.8,
      enableDreaming: row.enable_dreaming === true,
      dreamingHours: row.dreaming_hours ? JSON.parse(String(row.dreaming_hours)) : [2, 5],
      reflectionDepth: Number(row.reflection_depth) || 3,
    };
  }

  /**
   * Map database row to LoopMetrics
   */
  private mapRowToMetrics(row: Record<string, unknown>): LoopMetrics {
    return {
      tenantId: String(row.tenant_id),
      totalCycles: Number(row.total_cycles) || 0,
      averageCycleMs: Number(row.average_cycle_ms) || 0,
      thoughtsProcessed: Number(row.thoughts_processed) || 0,
      reflectionsCompleted: Number(row.reflections_completed) || 0,
      dreamingCycles: Number(row.dreaming_cycles) || 0,
      uptimeMs: Number(row.uptime_ms) || 0,
    };
  }
}

export const consciousnessLoopService = new ConsciousnessLoopService();
