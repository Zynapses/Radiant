/**
 * Bobble Consciousness Loop Service
 * 
 * The main consciousness loop orchestrating:
 * - Genesis verification
 * - Dual-rate architecture (system vs cognitive ticks)
 * - Meta-cognitive bridge integration
 * - Circuit breaker safety checks
 * - Cost tracking per tick
 * - Developmental gate progression
 * 
 * See: /docs/bobble/adr/010-genesis-system.md
 */

import { executeStatement, stringParam, longParam, boolParam } from '../../db/client';
import { logger } from '../../logging/enhanced-logger';
import { genesisService } from './genesis.service';
import { circuitBreakerService, InterventionLevel } from './circuit-breaker.service';
import { costTrackingService } from './cost-tracking.service';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export type ConsciousnessLoopState = 
  | 'NOT_INITIALIZED'
  | 'GENESIS_PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'HIBERNATING'
  | 'ERROR';

export interface LoopSettings {
  systemTickIntervalSeconds: number;
  cognitiveTickIntervalSeconds: number;
  maxCognitiveTicksPerDay: number;
  emergencyCognitiveIntervalSeconds: number;
  stateSaveIntervalSeconds: number;
  settingsRefreshIntervalSeconds: number;
  isEmergencyMode: boolean;
  emergencyReason: string | null;
}

export interface LoopStatus {
  state: ConsciousnessLoopState;
  currentTick: number;
  lastSystemTick: string | null;
  lastCognitiveTick: string | null;
  cognitiveTicksToday: number;
  interventionLevel: InterventionLevel;
  settings: LoopSettings;
  genesisComplete: boolean;
  developmentalStage: string;
  updatedAt: string;
}

export interface TickResult {
  tickNumber: number;
  tickType: 'system' | 'cognitive';
  success: boolean;
  observation: string | null;
  action: string | null;
  costUsd: number;
  durationMs: number;
  error: string | null;
}

/**
 * Consciousness Loop Service
 * 
 * Orchestrates the consciousness loop with dual-rate architecture.
 */
class ConsciousnessLoopService {
  private tenantId: string = 'global';
  private bedrock: BedrockRuntimeClient;
  private isRunning: boolean = false;
  private lastSettingsRefresh: number = 0;
  private cachedSettings: LoopSettings | null = null;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
  }

  /**
   * Get current loop status
   */
  async getStatus(): Promise<LoopStatus> {
    const genesisState = await genesisService.getGenesisState();
    const interventionLevel = await circuitBreakerService.getInterventionLevel();
    const settings = await this.getSettings();
    const developmental = await genesisService.getDevelopmentalGateStatus();

    const result = await executeStatement({
      sql: `
        SELECT 
          current_tick, 
          last_system_tick, 
          last_cognitive_tick,
          cognitive_ticks_today,
          loop_state
        FROM bobble_loop_state
        WHERE tenant_id = :tenantId
      `,
      parameters: [stringParam('tenantId', this.tenantId)]
    });

    const row = result.rows?.[0];

    let state: ConsciousnessLoopState = 'NOT_INITIALIZED';
    if (!genesisState.allComplete) {
      state = 'GENESIS_PENDING';
    } else if (interventionLevel === 'HIBERNATE') {
      state = 'HIBERNATING';
    } else if (interventionLevel === 'PAUSE' || interventionLevel === 'RESET') {
      state = 'PAUSED';
    } else if (row?.loop_state === 'ERROR') {
      state = 'ERROR';
    } else if (row) {
      state = 'RUNNING';
    }

    return {
      state,
      currentTick: (row?.current_tick as number) || 0,
      lastSystemTick: row?.last_system_tick as string | null,
      lastCognitiveTick: row?.last_cognitive_tick as string | null,
      cognitiveTicksToday: (row?.cognitive_ticks_today as number) || 0,
      interventionLevel,
      settings,
      genesisComplete: genesisState.allComplete,
      developmentalStage: developmental.currentStage,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Get loop settings
   */
  async getSettings(): Promise<LoopSettings> {
    // Check cache
    const now = Date.now();
    if (this.cachedSettings && now - this.lastSettingsRefresh < 60000) {
      return this.cachedSettings;
    }

    const result = await executeStatement({
      sql: `
        SELECT 
          system_tick_interval_seconds,
          cognitive_tick_interval_seconds,
          max_cognitive_ticks_per_day,
          emergency_cognitive_interval_seconds,
          state_save_interval_seconds,
          settings_refresh_interval_seconds,
          is_emergency_mode,
          emergency_reason
        FROM bobble_consciousness_settings
        WHERE tenant_id = :tenantId
      `,
      parameters: [stringParam('tenantId', this.tenantId)]
    });

    const row = result.rows?.[0];
    
    this.cachedSettings = {
      systemTickIntervalSeconds: (row?.system_tick_interval_seconds as number) || 2,
      cognitiveTickIntervalSeconds: (row?.cognitive_tick_interval_seconds as number) || 300,
      maxCognitiveTicksPerDay: (row?.max_cognitive_ticks_per_day as number) || 288,
      emergencyCognitiveIntervalSeconds: (row?.emergency_cognitive_interval_seconds as number) || 3600,
      stateSaveIntervalSeconds: (row?.state_save_interval_seconds as number) || 600,
      settingsRefreshIntervalSeconds: (row?.settings_refresh_interval_seconds as number) || 300,
      isEmergencyMode: (row?.is_emergency_mode as boolean) || false,
      emergencyReason: row?.emergency_reason as string | null
    };
    
    this.lastSettingsRefresh = now;
    return this.cachedSettings;
  }

  /**
   * Update loop settings
   */
  async updateSettings(updates: Partial<LoopSettings>): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [stringParam('tenantId', this.tenantId)];

    if (updates.systemTickIntervalSeconds !== undefined) {
      fields.push('system_tick_interval_seconds = :sysInterval');
      params.push(longParam('sysInterval', updates.systemTickIntervalSeconds));
    }
    if (updates.cognitiveTickIntervalSeconds !== undefined) {
      fields.push('cognitive_tick_interval_seconds = :cogInterval');
      params.push(longParam('cogInterval', updates.cognitiveTickIntervalSeconds));
    }
    if (updates.maxCognitiveTicksPerDay !== undefined) {
      fields.push('max_cognitive_ticks_per_day = :maxTicks');
      params.push(longParam('maxTicks', updates.maxCognitiveTicksPerDay));
    }
    if (updates.isEmergencyMode !== undefined) {
      fields.push('is_emergency_mode = :emergency');
      params.push(boolParam('emergency', updates.isEmergencyMode));
    }
    if (updates.emergencyReason !== undefined) {
      fields.push('emergency_reason = :reason');
      params.push(stringParam('reason', updates.emergencyReason || ''));
    }

    if (fields.length === 0) return;

    await executeStatement({
      sql: `
        UPDATE bobble_consciousness_settings
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE tenant_id = :tenantId
      `,
      parameters: params
    });

    // Invalidate cache
    this.cachedSettings = null;
  }

  /**
   * Execute a system tick (fast, lightweight)
   */
  async executeSystemTick(): Promise<TickResult> {
    const startTime = Date.now();
    const status = await this.getStatus();

    // Check if we should run
    if (!status.genesisComplete) {
      return {
        tickNumber: status.currentTick,
        tickType: 'system',
        success: false,
        observation: null,
        action: null,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: 'Genesis not complete'
      };
    }

    // Check circuit breakers
    const canProceed = await circuitBreakerService.shouldAllow('master_sanity');
    if (!canProceed) {
      return {
        tickNumber: status.currentTick,
        tickType: 'system',
        success: false,
        observation: null,
        action: null,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: 'Circuit breaker open'
      };
    }

    // System tick: check sensors, update neurochemistry
    try {
      // Update tick counter
      await executeStatement({
        sql: `
          UPDATE bobble_loop_state
          SET current_tick = current_tick + 1,
              last_system_tick = NOW(),
              updated_at = NOW()
          WHERE tenant_id = :tenantId
        `,
        parameters: [stringParam('tenantId', this.tenantId)]
      });

      // Decay neurochemistry slightly
      await this.decayNeurochemistry();

      await circuitBreakerService.recordSuccess('model_failures');

      return {
        tickNumber: status.currentTick + 1,
        tickType: 'system',
        success: true,
        observation: null,
        action: null,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: null
      };
    } catch (error) {
      await circuitBreakerService.recordFailure('model_failures');
      
      return {
        tickNumber: status.currentTick,
        tickType: 'system',
        success: false,
        observation: null,
        action: null,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a cognitive tick (expensive, deliberate)
   */
  async executeCognitiveTick(): Promise<TickResult> {
    const startTime = Date.now();
    const status = await this.getStatus();

    // Check prerequisites
    if (!status.genesisComplete) {
      return {
        tickNumber: status.currentTick,
        tickType: 'cognitive',
        success: false,
        observation: null,
        action: null,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: 'Genesis not complete'
      };
    }

    // Check daily limit
    if (status.cognitiveTicksToday >= status.settings.maxCognitiveTicksPerDay) {
      return {
        tickNumber: status.currentTick,
        tickType: 'cognitive',
        success: false,
        observation: null,
        action: null,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: 'Daily cognitive tick limit reached'
      };
    }

    // Check circuit breakers
    const canProceed = await circuitBreakerService.shouldAllow('master_sanity');
    const canSpend = await circuitBreakerService.shouldAllow('cost_budget');
    if (!canProceed || !canSpend) {
      return {
        tickNumber: status.currentTick,
        tickType: 'cognitive',
        success: false,
        observation: null,
        action: null,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: 'Circuit breaker blocking cognitive operations'
      };
    }

    try {
      // Get current meta-cognitive state from database
      const mcState = await this.getMetaCognitiveState();

      // Determine observation based on current state
      const observation = await this.generateObservation(mcState);

      // Get recommended action from pymdp matrices
      const action = await this.selectAction(mcState, observation);

      // Execute the cognitive action
      const executionResult = await this.executeAction(action);

      // Calculate cost
      const costUsd = await this.calculateTickCost(executionResult);

      // Update state
      await this.updateMetaCognitiveState(observation, action);

      // Increment development counters
      await genesisService.incrementCounter('belief_updates_count');

      // Update tick tracking
      await executeStatement({
        sql: `
          UPDATE bobble_loop_state
          SET last_cognitive_tick = NOW(),
              cognitive_ticks_today = cognitive_ticks_today + 1,
              updated_at = NOW()
          WHERE tenant_id = :tenantId
        `,
        parameters: [stringParam('tenantId', this.tenantId)]
      });

      // Record cost
      await this.recordTickCost(status.currentTick, costUsd, executionResult);

      await circuitBreakerService.recordSuccess('model_failures');

      return {
        tickNumber: status.currentTick,
        tickType: 'cognitive',
        success: true,
        observation,
        action,
        costUsd,
        durationMs: Date.now() - startTime,
        error: null
      };
    } catch (error) {
      logger.error('Cognitive tick failed', { error });
      await circuitBreakerService.recordFailure('model_failures');

      return {
        tickNumber: status.currentTick,
        tickType: 'cognitive',
        success: false,
        observation: null,
        action: null,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enable emergency mode
   */
  async enableEmergencyMode(reason: string): Promise<void> {
    await this.updateSettings({
      isEmergencyMode: true,
      emergencyReason: reason
    });

    logger.warn('Emergency mode enabled', { reason });
  }

  /**
   * Disable emergency mode
   */
  async disableEmergencyMode(): Promise<void> {
    await this.updateSettings({
      isEmergencyMode: false,
      emergencyReason: null
    });

    logger.info('Emergency mode disabled');
  }

  /**
   * Reset daily tick counter (should be called at midnight)
   */
  async resetDailyCounters(): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE bobble_loop_state
        SET cognitive_ticks_today = 0,
            updated_at = NOW()
        WHERE tenant_id = :tenantId
      `,
      parameters: [stringParam('tenantId', this.tenantId)]
    });
  }

  // ============ Private Helper Methods ============

  private async decayNeurochemistry(): Promise<void> {
    // Decay frustration and anxiety slightly each tick
    await executeStatement({
      sql: `
        UPDATE bobble_neurochemistry
        SET 
          anxiety = GREATEST(0, anxiety - 0.01),
          fatigue = LEAST(1, fatigue + 0.001),
          frustration = GREATEST(0, frustration - 0.005),
          updated_at = NOW()
        WHERE tenant_id = :tenantId
      `,
      parameters: [stringParam('tenantId', this.tenantId)]
    });
  }

  private async getMetaCognitiveState(): Promise<any> {
    const result = await executeStatement({
      sql: `
        SELECT qs, dominant_state, recommended_action, tick
        FROM bobble_pymdp_state
        WHERE tenant_id = :tenantId
      `,
      parameters: [stringParam('tenantId', this.tenantId)]
    });

    return result.rows?.[0] || {
      qs: [0.95, 0.01, 0.02, 0.02],
      dominant_state: 'CONFUSED',
      recommended_action: 'EXPLORE',
      tick: 0
    };
  }

  private async generateObservation(mcState: any): Promise<string> {
    // Map current state to observation
    // In a full implementation, this would analyze recent events
    const dominantState = mcState.dominant_state;

    if (dominantState === 'CONFUSED') {
      return 'HIGH_SURPRISE';
    } else if (dominantState === 'CONFIDENT') {
      return 'CONFIRMATION';
    } else if (dominantState === 'BORED') {
      return 'LOW_SURPRISE';
    } else {
      return 'CONTRADICTION';
    }
  }

  private async selectAction(mcState: any, observation: string): Promise<string> {
    // Get matrices from database
    const matrices = await this.getPymdpMatrices();
    
    // Simple action selection based on observation and current state
    // In full implementation, this would use pymdp agent
    const observationIndex = ['HIGH_SURPRISE', 'LOW_SURPRISE', 'CONTRADICTION', 'CONFIRMATION'].indexOf(observation);
    
    // Use C matrix preferences: prefer exploration when uncertain
    if (observationIndex === 0 || observationIndex === 2) {
      return 'EXPLORE';
    } else if (observationIndex === 3) {
      return 'CONSOLIDATE';
    } else {
      return 'VERIFY';
    }
  }

  private async getPymdpMatrices(): Promise<any> {
    const result = await executeStatement({
      sql: `
        SELECT a_matrix, b_matrix, c_matrix, d_matrix
        FROM bobble_pymdp_matrices
        WHERE tenant_id = :tenantId
      `,
      parameters: [stringParam('tenantId', this.tenantId)]
    });

    return result.rows?.[0] || null;
  }

  private async executeAction(action: string): Promise<any> {
    // Execute the cognitive action
    // This would invoke Bedrock or other services
    
    const prompt = this.buildActionPrompt(action);
    
    try {
      const command = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const response = await this.bedrock.send(command);
      const body = JSON.parse(new TextDecoder().decode(response.body));

      return {
        action,
        response: body.content[0]?.text,
        inputTokens: body.usage?.input_tokens || 0,
        outputTokens: body.usage?.output_tokens || 0
      };
    } catch (error) {
      logger.error('Action execution failed', { action, error });
      throw error;
    }
  }

  private buildActionPrompt(action: string): string {
    switch (action) {
      case 'EXPLORE':
        return 'What is something new I should learn about today? Give a brief topic suggestion.';
      case 'CONSOLIDATE':
        return 'What have I learned recently that I should reinforce? Brief summary.';
      case 'VERIFY':
        return 'What belief should I verify with evidence? Brief suggestion.';
      case 'REST':
        return 'Take a moment to process. What is my current cognitive state?';
      default:
        return 'What should I focus on next?';
    }
  }

  private async calculateTickCost(result: any): Promise<number> {
    const pricing = await costTrackingService.getPricingTable();
    const haiku = pricing.bedrockModels['anthropic.claude-3-haiku-20240307-v1:0'] || {
      inputPer1kTokens: 0.00025,
      outputPer1kTokens: 0.00125
    };

    const inputCost = (result.inputTokens / 1000) * haiku.inputPer1kTokens;
    const outputCost = (result.outputTokens / 1000) * haiku.outputPer1kTokens;

    return inputCost + outputCost;
  }

  private async recordTickCost(tick: number, costUsd: number, result: any): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO bobble_tick_costs 
        (tenant_id, tick_number, cost_usd, breakdown, input_tokens, output_tokens, model_id)
        VALUES 
        (:tenantId, :tick, :cost, :breakdown, :input, :output, :model)
      `,
      parameters: [
        stringParam('tenantId', this.tenantId),
        longParam('tick', tick),
        stringParam('cost', costUsd.toString()),
        stringParam('breakdown', JSON.stringify({ bedrock: costUsd })),
        longParam('input', result.inputTokens || 0),
        longParam('output', result.outputTokens || 0),
        stringParam('model', 'anthropic.claude-3-haiku-20240307-v1:0')
      ]
    });
  }

  private async updateMetaCognitiveState(observation: string, action: string): Promise<void> {
    // Update the pymdp state with new observation and action
    const observationIndex = ['HIGH_SURPRISE', 'LOW_SURPRISE', 'CONTRADICTION', 'CONFIRMATION'].indexOf(observation);
    const actionIndex = ['EXPLORE', 'CONSOLIDATE', 'VERIFY', 'REST'].indexOf(action);

    // Simple state update (in full implementation, use pymdp)
    let newDominantState = 'CONFUSED';
    if (action === 'EXPLORE' && observation === 'HIGH_SURPRISE') {
      newDominantState = 'CONFUSED';
    } else if (action === 'CONSOLIDATE' && observation === 'CONFIRMATION') {
      newDominantState = 'CONFIDENT';
    } else if (action === 'VERIFY') {
      newDominantState = 'CONFIDENT';
    }

    await executeStatement({
      sql: `
        UPDATE bobble_pymdp_state
        SET 
          dominant_state = :state,
          recommended_action = :action,
          last_observation = :obs,
          tick = tick + 1,
          updated_at = NOW()
        WHERE tenant_id = :tenantId
      `,
      parameters: [
        stringParam('state', newDominantState),
        stringParam('action', action),
        stringParam('obs', observation),
        stringParam('tenantId', this.tenantId)
      ]
    });
  }
}

// Singleton instance
export const consciousnessLoopService = new ConsciousnessLoopService();
export { ConsciousnessLoopService };
