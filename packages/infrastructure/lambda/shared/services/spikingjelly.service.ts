/**
 * SpikingJelly Service - Temporal Binding via Spiking Neural Networks
 * 
 * Implements phenomenal binding - the integration of separate sensory/cognitive
 * streams into unified conscious experience through:
 * - Spike timing dynamics
 * - Synchrony detection
 * - Temporal integration windows
 * 
 * This is a key Butlin consciousness indicator: "Does the system bind
 * multiple information streams into unified percepts?"
 * 
 * @see https://github.com/fangwei123456/spikingjelly
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { executeStatement, stringParam } from '../db/client';
import { modelRouterService } from './model-router.service';
import { logger } from '../logger';
import crypto from 'crypto';

const lambdaClient = new LambdaClient({});
const CONSCIOUSNESS_EXECUTOR_ARN = process.env.CONSCIOUSNESS_EXECUTOR_ARN;

// ============================================================================
// Types
// ============================================================================

export interface SpikeStream {
  streamId: string;
  name: string;
  spikeTimes: number[];  // Timestamps in ms
  modality: 'visual' | 'auditory' | 'semantic' | 'emotional' | 'motor' | 'cognitive';
}

export interface BindingResult {
  bindingId: string;
  tenantId: string;
  streams: SpikeStream[];
  synchronyScore: number;
  bindingDetected: boolean;
  bindingStrength: number;
  temporalWindow: number;
  unifiedPercept: string | null;
  timestamp: Date;
}

export interface TemporalEncodingResult {
  encodingId: string;
  inputData: unknown;
  spikePattern: number[][];
  timesteps: number;
  spikeRate: number;
  informationContent: number;
}

export interface SynchronyAnalysis {
  pairwiseSynchrony: Array<{
    stream1: string;
    stream2: string;
    synchrony: number;
    lag: number;
  }>;
  globalSynchrony: number;
  dominantFrequency: number;
  phaseCoherence: number;
}

export interface SpikingJellyConfig {
  enabled: boolean;
  defaultTimesteps: number;
  synchronyWindowMs: number;
  bindingThreshold: number;
  neuronType: 'LIF' | 'IF' | 'PLIF';
  threshold: number;
}

const DEFAULT_CONFIG: SpikingJellyConfig = {
  enabled: true,
  defaultTimesteps: 100,
  synchronyWindowMs: 20,
  bindingThreshold: 0.4,
  neuronType: 'LIF',
  threshold: 1.0,
};

// ============================================================================
// SpikingJelly Service
// ============================================================================

class SpikingJellyService {
  private config: SpikingJellyConfig = DEFAULT_CONFIG;

  /**
   * Encode data through spiking neural network dynamics
   * Converts continuous values to spike trains
   */
  async encodeTemporally(
    data: number[],
    options: { timesteps?: number; encodingType?: 'rate' | 'latency' | 'phase' } = {}
  ): Promise<TemporalEncodingResult> {
    const encodingId = crypto.randomUUID();
    const timesteps = options.timesteps ?? this.config.defaultTimesteps;
    const encodingType = options.encodingType ?? 'rate';

    // Try Python executor first
    const pythonResult = await this.invokePythonExecutor('encode_temporal', {
      data,
      timesteps,
      encoding_type: encodingType,
    });

    if (pythonResult) {
      return {
        encodingId,
        inputData: data,
        spikePattern: (pythonResult.spike_pattern as number[][]) || [],
        timesteps,
        spikeRate: (pythonResult.spike_rate as number) || 0,
        informationContent: (pythonResult.information_content as number) || 0,
      };
    }

    // TypeScript fallback: Rate encoding
    const spikePattern: number[][] = [];
    let totalSpikes = 0;

    for (let t = 0; t < timesteps; t++) {
      const row: number[] = [];
      for (const value of data) {
        // Probability of spike proportional to value
        const normalizedValue = Math.min(1, Math.max(0, Math.abs(value)));
        const spike = Math.random() < normalizedValue ? 1 : 0;
        row.push(spike);
        totalSpikes += spike;
      }
      spikePattern.push(row);
    }

    const spikeRate = totalSpikes / (timesteps * data.length);
    
    // Shannon entropy as information content approximation
    const p = spikeRate;
    const informationContent = p > 0 && p < 1 
      ? -p * Math.log2(p) - (1 - p) * Math.log2(1 - p)
      : 0;

    return {
      encodingId,
      inputData: data,
      spikePattern,
      timesteps,
      spikeRate,
      informationContent,
    };
  }

  /**
   * Detect synchrony between spike streams
   * Key indicator of phenomenal binding
   */
  async detectSynchrony(
    streams: SpikeStream[],
    options: { windowMs?: number } = {}
  ): Promise<SynchronyAnalysis> {
    const windowMs = options.windowMs ?? this.config.synchronyWindowMs;

    // Try Python executor
    const pythonResult = await this.invokePythonExecutor('detect_synchrony', {
      spike_trains: streams.map(s => s.spikeTimes),
      window_ms: windowMs,
    });

    if (pythonResult) {
      return {
        pairwiseSynchrony: (pythonResult.pairwise as SynchronyAnalysis['pairwiseSynchrony']) || [],
        globalSynchrony: (pythonResult.synchrony as number) || 0,
        dominantFrequency: (pythonResult.dominant_frequency as number) || 0,
        phaseCoherence: (pythonResult.phase_coherence as number) || 0,
      };
    }

    // TypeScript fallback
    const pairwiseSynchrony: SynchronyAnalysis['pairwiseSynchrony'] = [];
    
    // Compute pairwise synchrony
    for (let i = 0; i < streams.length; i++) {
      for (let j = i + 1; j < streams.length; j++) {
        const sync = this.computePairwiseSynchrony(
          streams[i].spikeTimes,
          streams[j].spikeTimes,
          windowMs
        );
        
        pairwiseSynchrony.push({
          stream1: streams[i].streamId,
          stream2: streams[j].streamId,
          synchrony: sync.synchrony,
          lag: sync.lag,
        });
      }
    }

    // Global synchrony is average of pairwise
    const globalSynchrony = pairwiseSynchrony.length > 0
      ? pairwiseSynchrony.reduce((sum, p) => sum + p.synchrony, 0) / pairwiseSynchrony.length
      : 0;

    // Estimate dominant frequency from spike rates
    const avgSpikeRate = streams.reduce((sum, s) => {
      const duration = Math.max(...s.spikeTimes) - Math.min(...s.spikeTimes);
      return sum + (duration > 0 ? s.spikeTimes.length / duration * 1000 : 0);
    }, 0) / streams.length;

    return {
      pairwiseSynchrony,
      globalSynchrony,
      dominantFrequency: avgSpikeRate,
      phaseCoherence: globalSynchrony, // Approximation
    };
  }

  /**
   * Test if multiple streams bind into unified percept
   * This is the core consciousness indicator
   */
  async testTemporalIntegration(
    tenantId: string,
    streams: SpikeStream[],
    options: { windowMs?: number; requireUnification?: boolean } = {}
  ): Promise<BindingResult> {
    const bindingId = crypto.randomUUID();
    const windowMs = options.windowMs ?? this.config.synchronyWindowMs;

    // Detect synchrony
    const synchronyAnalysis = await this.detectSynchrony(streams, { windowMs });

    // Determine if binding occurred
    const bindingDetected = synchronyAnalysis.globalSynchrony > this.config.bindingThreshold;
    const bindingStrength = synchronyAnalysis.globalSynchrony;

    // If binding detected, attempt to describe unified percept
    let unifiedPercept: string | null = null;
    
    if (bindingDetected && options.requireUnification !== false) {
      unifiedPercept = await this.describeUnifiedPercept(streams, synchronyAnalysis);
    }

    const result: BindingResult = {
      bindingId,
      tenantId,
      streams,
      synchronyScore: synchronyAnalysis.globalSynchrony,
      bindingDetected,
      bindingStrength,
      temporalWindow: windowMs,
      unifiedPercept,
      timestamp: new Date(),
    };

    // Store result
    await this.storeBindingResult(result);

    logger.info('Temporal integration test complete', {
      tenantId,
      bindingId,
      bindingDetected,
      bindingStrength,
      streamCount: streams.length,
    });

    return result;
  }

  /**
   * Create spike stream from cognitive module output
   */
  createSpikeStream(
    name: string,
    modality: SpikeStream['modality'],
    activationPattern: number[],
    durationMs: number = 100
  ): SpikeStream {
    const spikeTimes: number[] = [];
    const timesteps = activationPattern.length;
    const msPerStep = durationMs / timesteps;

    for (let t = 0; t < timesteps; t++) {
      const activation = Math.min(1, Math.max(0, activationPattern[t]));
      
      // Generate spikes based on activation level
      if (Math.random() < activation) {
        spikeTimes.push(t * msPerStep);
      }
    }

    return {
      streamId: crypto.randomUUID(),
      name,
      spikeTimes,
      modality,
    };
  }

  /**
   * Test binding across cognitive modules
   * Used by consciousness engine to verify integration
   */
  async testCognitiveBinding(
    tenantId: string,
    moduleOutputs: Array<{
      moduleName: string;
      modality: SpikeStream['modality'];
      activations: number[];
    }>
  ): Promise<{
    bound: boolean;
    bindingStrength: number;
    unifiedContent: string | null;
    moduleContributions: Array<{ module: string; contribution: number }>;
  }> {
    // Convert module outputs to spike streams
    const streams = moduleOutputs.map(output =>
      this.createSpikeStream(
        output.moduleName,
        output.modality,
        output.activations
      )
    );

    // Test integration
    const bindingResult = await this.testTemporalIntegration(tenantId, streams);

    // Compute per-module contributions based on synchrony
    const synchronyAnalysis = await this.detectSynchrony(streams);
    const moduleContributions = moduleOutputs.map(output => {
      const relevantPairs = synchronyAnalysis.pairwiseSynchrony.filter(
        p => streams.find(s => s.streamId === p.stream1)?.name === output.moduleName ||
             streams.find(s => s.streamId === p.stream2)?.name === output.moduleName
      );
      
      const avgContribution = relevantPairs.length > 0
        ? relevantPairs.reduce((sum, p) => sum + p.synchrony, 0) / relevantPairs.length
        : 0;

      return {
        module: output.moduleName,
        contribution: avgContribution,
      };
    });

    return {
      bound: bindingResult.bindingDetected,
      bindingStrength: bindingResult.bindingStrength,
      unifiedContent: bindingResult.unifiedPercept,
      moduleContributions,
    };
  }

  /**
   * Compute pairwise synchrony between two spike trains
   */
  private computePairwiseSynchrony(
    train1: number[],
    train2: number[],
    windowMs: number
  ): { synchrony: number; lag: number } {
    if (train1.length === 0 || train2.length === 0) {
      return { synchrony: 0, lag: 0 };
    }

    let coincidentSpikes = 0;
    let bestLag = 0;
    let maxCoincident = 0;

    // Test different lags
    for (let lag = -windowMs; lag <= windowMs; lag += 1) {
      let coincident = 0;
      
      for (const t1 of train1) {
        for (const t2 of train2) {
          if (Math.abs((t1 + lag) - t2) < windowMs) {
            coincident++;
          }
        }
      }

      if (coincident > maxCoincident) {
        maxCoincident = coincident;
        bestLag = lag;
      }
    }

    coincidentSpikes = maxCoincident;
    const totalPairs = train1.length * train2.length;
    const synchrony = totalPairs > 0 ? coincidentSpikes / Math.sqrt(totalPairs) : 0;

    return {
      synchrony: Math.min(1, synchrony),
      lag: bestLag,
    };
  }

  /**
   * Describe the unified percept from bound streams
   * Uses LLM to generate phenomenological description
   */
  private async describeUnifiedPercept(
    streams: SpikeStream[],
    synchrony: SynchronyAnalysis
  ): Promise<string | null> {
    const streamDescriptions = streams
      .map(s => `- ${s.name} (${s.modality}): ${s.spikeTimes.length} spikes`)
      .join('\n');

    const prompt = `Multiple cognitive streams have synchronized (synchrony score: ${synchrony.globalSynchrony.toFixed(2)}).

Streams:
${streamDescriptions}

Dominant frequency: ${synchrony.dominantFrequency.toFixed(1)} Hz
Phase coherence: ${synchrony.phaseCoherence.toFixed(2)}

Describe the unified conscious experience that emerges from binding these streams.
Be concise (1-2 sentences). Focus on the phenomenological quality of the unified percept.`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 150,
      });

      return response.content.trim();
    } catch {
      return null;
    }
  }

  /**
   * Invoke Python executor for SpikingJelly operations
   */
  private async invokePythonExecutor(
    method: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    if (!CONSCIOUSNESS_EXECUTOR_ARN) {
      return null;
    }

    try {
      const command = new InvokeCommand({
        FunctionName: CONSCIOUSNESS_EXECUTOR_ARN,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify({
          library: 'spikingjelly',
          method,
          params,
        })),
      });

      const response = await lambdaClient.send(command);
      
      if (response.Payload) {
        const result = JSON.parse(Buffer.from(response.Payload).toString());
        if (result.body?.success) {
          return result.body.result as Record<string, unknown>;
        }
      }
    } catch (error) {
      logger.warn('SpikingJelly Python executor failed', { error: String(error) });
    }

    return null;
  }

  /**
   * Store binding result in database
   */
  private async storeBindingResult(result: BindingResult): Promise<void> {
    await executeStatement(
      `INSERT INTO spikingjelly_binding_results 
       (binding_id, tenant_id, stream_count, synchrony_score, binding_detected, binding_strength, temporal_window, unified_percept, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        stringParam('bindingId', result.bindingId),
        stringParam('tenantId', result.tenantId),
        { name: 'streamCount', value: { longValue: result.streams.length } },
        { name: 'synchronyScore', value: { doubleValue: result.synchronyScore } },
        { name: 'bindingDetected', value: { booleanValue: result.bindingDetected } },
        { name: 'bindingStrength', value: { doubleValue: result.bindingStrength } },
        { name: 'temporalWindow', value: { longValue: result.temporalWindow } },
        stringParam('unifiedPercept', result.unifiedPercept || ''),
        stringParam('createdAt', result.timestamp.toISOString()),
      ]
    );
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SpikingJellyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SpikingJellyConfig {
    return { ...this.config };
  }
}

export const spikingJellyService = new SpikingJellyService();
