// RADIANT v4.18.0 - Cognitive Brain Service
// AGI-like cognitive mesh with specialized brain regions

import { executeStatement } from '../db/client';
import { modelRouterService, ModelResponse } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export interface BrainRegion {
  regionId: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color: string;
  cognitiveFunction: string;
  humanBrainAnalog?: string;
  primaryModelId: string;
  fallbackModelIds: string[];
  activationTriggers: ActivationTrigger[];
  priority: number;
  maxLatencyMs: number;
  maxTokensPerCall: number;
  learningRate: number;
  isActive: boolean;
  isSystem: boolean;
  metrics: RegionMetrics;
}

export interface ActivationTrigger {
  type: 'keyword' | 'intent' | 'sentiment' | 'context' | 'capability' | 'always';
  condition: Record<string, unknown>;
  weight: number;
}

export interface RegionMetrics {
  totalActivations: number;
  successfulActivations: number;
  avgLatencyMs: number;
  avgSatisfactionScore: number;
}

export interface CognitivePattern {
  patternId: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  tags: string[];
  triggerType: string;
  triggerConditions: Record<string, unknown>;
  triggerThreshold: number;
  regionSequence: RegionStep[];
  executionMode: 'sequential' | 'parallel' | 'adaptive';
  basePriority: number;
  isActive: boolean;
}

export interface RegionStep {
  regionSlug: string;
  action: string;
  inputMapping?: Record<string, string>;
}

export interface NeuralBlueprint {
  blueprintId: string;
  name: string;
  slug: string;
  version: string;
  description?: string;
  category: string;
  tags: string[];
  configuration: BlueprintConfiguration;
  learningConfig: LearningConfig;
  isPublic: boolean;
  downloadCount: number;
  rating: number;
  isActive: boolean;
}

export interface BlueprintConfiguration {
  regions: Partial<BrainRegion>[];
  patterns: Partial<CognitivePattern>[];
  settings: Record<string, unknown>;
}

export interface LearningConfig {
  enabled: boolean;
  learningRate: number;
  memoryRetentionDays: number;
  preferenceExtraction: boolean;
  behaviorTracking: boolean;
}

export interface CognitiveBrainSettings {
  cognitiveBrainEnabled: boolean;
  learningEnabled: boolean;
  adaptationEnabled: boolean;
  defaultBlueprintId?: string;
  maxConcurrentRegions: number;
  maxTokensPerRequest: number;
  maxLatencyMs: number;
  dailyCostLimitCents: number;
  monthlyCostLimitCents: number;
  globalLearningRate: number;
  memoryRetentionDays: number;
  insightConfidenceThreshold: number;
  enableMetacognition: boolean;
  enableTheoryOfMind: boolean;
  enableCreativeSynthesis: boolean;
  enableSelfCorrection: boolean;
  customSystemPrompt?: string;
  regionOverrides: Record<string, Partial<BrainRegion>>;
}

export interface CognitiveSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  conversationId?: string;
  activeBlueprintId?: string;
  state: Record<string, unknown>;
  activeRegions: string[];
  startedAt: Date;
}

export interface RegionActivationResult {
  regionId: string;
  regionSlug: string;
  success: boolean;
  output: unknown;
  latencyMs: number;
  tokensUsed: number;
  costCents: number;
  modelUsed: string;
  error?: string;
}

export interface CognitiveResponse {
  sessionId: string;
  response: string;
  regionsActivated: string[];
  activationResults: RegionActivationResult[];
  totalLatencyMs: number;
  totalTokens: number;
  totalCostCents: number;
  confidence: number;
}

// ============================================================================
// Cognitive Brain Service
// ============================================================================

export class CognitiveBrainService {
  private regionCache: Map<string, BrainRegion[]> = new Map();

  constructor() {
    // Model routing handled by modelRouterService
  }

  // Session Management
  async createSession(tenantId: string, userId: string, conversationId?: string): Promise<CognitiveSession> {
    const result = await executeStatement(
      `INSERT INTO cognitive_sessions (tenant_id, user_id, conversation_id)
       VALUES ($1, $2, $3) RETURNING session_id, started_at`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'conversationId', value: conversationId ? { stringValue: conversationId } : { isNull: true } },
      ]
    );
    const row = result.rows[0] as { session_id: string; started_at: string };
    return {
      sessionId: row.session_id, tenantId, userId, conversationId,
      state: {}, activeRegions: [], startedAt: new Date(row.started_at),
    };
  }

  async getSession(sessionId: string): Promise<CognitiveSession | null> {
    const result = await executeStatement(
      `SELECT * FROM cognitive_sessions WHERE session_id = $1`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      sessionId: String(row.session_id), tenantId: String(row.tenant_id),
      userId: String(row.user_id), conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
      activeBlueprintId: row.active_blueprint_id ? String(row.active_blueprint_id) : undefined,
      state: (row.state as Record<string, unknown>) || {},
      activeRegions: (row.active_regions as string[]) || [],
      startedAt: new Date(row.started_at as string),
    };
  }

  // Brain Region Management
  async getBrainRegions(tenantId: string): Promise<BrainRegion[]> {
    const cached = this.regionCache.get(tenantId);
    if (cached) return cached;
    const result = await executeStatement(
      `SELECT * FROM brain_regions WHERE tenant_id = $1 AND is_active = true ORDER BY priority DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    const regions = result.rows.map((row) => this.mapBrainRegion(row as Record<string, unknown>));
    this.regionCache.set(tenantId, regions);
    return regions;
  }

  async createBrainRegion(tenantId: string, region: Partial<BrainRegion>): Promise<BrainRegion> {
    const result = await executeStatement(
      `INSERT INTO brain_regions (tenant_id, name, slug, description, icon, color,
        cognitive_function, human_brain_analog, primary_model_id, fallback_model_ids,
        activation_triggers, priority, max_latency_ms, max_tokens_per_call, learning_rate, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'name', value: { stringValue: region.name || 'New Region' } },
        { name: 'slug', value: { stringValue: region.slug || 'new-region' } },
        { name: 'description', value: region.description ? { stringValue: region.description } : { isNull: true } },
        { name: 'icon', value: { stringValue: region.icon || 'brain' } },
        { name: 'color', value: { stringValue: region.color || '#6366f1' } },
        { name: 'cognitiveFunction', value: { stringValue: region.cognitiveFunction || 'general' } },
        { name: 'humanBrainAnalog', value: region.humanBrainAnalog ? { stringValue: region.humanBrainAnalog } : { isNull: true } },
        { name: 'primaryModelId', value: { stringValue: region.primaryModelId || 'openai/gpt-4o' } },
        { name: 'fallbackModelIds', value: { stringValue: `{${(region.fallbackModelIds || []).join(',')}}` } },
        { name: 'activationTriggers', value: { stringValue: JSON.stringify(region.activationTriggers || []) } },
        { name: 'priority', value: { longValue: region.priority || 50 } },
        { name: 'maxLatencyMs', value: { longValue: region.maxLatencyMs || 5000 } },
        { name: 'maxTokensPerCall', value: { longValue: region.maxTokensPerCall || 4096 } },
        { name: 'learningRate', value: { doubleValue: region.learningRate || 0.01 } },
        { name: 'isActive', value: { booleanValue: region.isActive !== false } },
      ]
    );
    this.regionCache.delete(tenantId);
    return this.mapBrainRegion(result.rows[0] as Record<string, unknown>);
  }

  async updateBrainRegion(tenantId: string, regionId: string, updates: Partial<BrainRegion>): Promise<void> {
    const sets: string[] = [];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'regionId', value: { stringValue: regionId } },
    ];
    let i = 3;
    if (updates.name) { sets.push(`name = $${i}`); params.push({ name: `p${i++}`, value: { stringValue: updates.name } }); }
    if (updates.primaryModelId) { sets.push(`primary_model_id = $${i}`); params.push({ name: `p${i++}`, value: { stringValue: updates.primaryModelId } }); }
    if (updates.priority !== undefined) { sets.push(`priority = $${i}`); params.push({ name: `p${i++}`, value: { longValue: updates.priority } }); }
    if (updates.isActive !== undefined) { sets.push(`is_active = $${i}`); params.push({ name: `p${i++}`, value: { booleanValue: updates.isActive } }); }
    if (sets.length > 0) {
      await executeStatement(`UPDATE brain_regions SET ${sets.join(', ')}, updated_at = NOW() WHERE tenant_id = $1 AND region_id = $2`, params);
      this.regionCache.delete(tenantId);
    }
  }

  async initializeTenantRegions(tenantId: string): Promise<void> {
    await executeStatement(`SELECT initialize_tenant_brain_regions($1)`, [{ name: 'tenantId', value: { stringValue: tenantId } }]);
    this.regionCache.delete(tenantId);
  }

  // Settings Management
  async getSettings(tenantId: string): Promise<CognitiveBrainSettings> {
    const result = await executeStatement(`SELECT * FROM cognitive_brain_settings WHERE tenant_id = $1`, [{ name: 'tenantId', value: { stringValue: tenantId } }]);
    if (result.rows.length === 0) {
      await executeStatement(`INSERT INTO cognitive_brain_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`, [{ name: 'tenantId', value: { stringValue: tenantId } }]);
      return this.getDefaultSettings();
    }
    return this.mapSettings(result.rows[0] as Record<string, unknown>);
  }

  async updateSettings(tenantId: string, updates: Partial<CognitiveBrainSettings>): Promise<void> {
    const sets: string[] = [];
    const params: Array<{ name: string; value: unknown }> = [{ name: 'tenantId', value: { stringValue: tenantId } }];
    let i = 2;
    if (updates.cognitiveBrainEnabled !== undefined) { sets.push(`cognitive_brain_enabled = $${i}`); params.push({ name: `p${i++}`, value: { booleanValue: updates.cognitiveBrainEnabled } }); }
    if (updates.learningEnabled !== undefined) { sets.push(`learning_enabled = $${i}`); params.push({ name: `p${i++}`, value: { booleanValue: updates.learningEnabled } }); }
    if (updates.maxConcurrentRegions !== undefined) { sets.push(`max_concurrent_regions = $${i}`); params.push({ name: `p${i++}`, value: { longValue: updates.maxConcurrentRegions } }); }
    if (updates.dailyCostLimitCents !== undefined) { sets.push(`daily_cost_limit_cents = $${i}`); params.push({ name: `p${i++}`, value: { longValue: updates.dailyCostLimitCents } }); }
    if (updates.globalLearningRate !== undefined) { sets.push(`global_learning_rate = $${i}`); params.push({ name: `p${i++}`, value: { doubleValue: updates.globalLearningRate } }); }
    await executeStatement(`INSERT INTO cognitive_brain_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`, [{ name: 'tenantId', value: { stringValue: tenantId } }]);
    if (sets.length > 0) {
      await executeStatement(`UPDATE cognitive_brain_settings SET ${sets.join(', ')}, updated_at = NOW() WHERE tenant_id = $1`, params);
    }
  }

  // Main Processing Loop
  async process(tenantId: string, sessionId: string, input: string): Promise<CognitiveResponse> {
    const startTime = Date.now();
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    const settings = await this.getSettings(tenantId);
    if (!settings.cognitiveBrainEnabled) throw new Error('Cognitive brain disabled');
    const regions = await this.getBrainRegions(tenantId);
    
    // Simple routing: use reasoning region by default
    const reasoningRegion = regions.find((r) => r.cognitiveFunction === 'reasoning') || regions[0];
    if (!reasoningRegion) throw new Error('No brain regions configured');

    const result = await this.activateRegion(tenantId, sessionId, reasoningRegion, input, settings);
    const response = result.success ? String(result.output) : 'Processing failed. Please try again.';

    return {
      sessionId,
      response,
      regionsActivated: result.success ? [result.regionSlug] : [],
      activationResults: [result],
      totalLatencyMs: Date.now() - startTime,
      totalTokens: result.tokensUsed,
      totalCostCents: result.costCents,
      confidence: result.success ? 0.85 : 0.2,
    };
  }

  private async activateRegion(tenantId: string, sessionId: string, region: BrainRegion, input: string, settings: CognitiveBrainSettings): Promise<RegionActivationResult> {
    const startTime = Date.now();
    try {
      const systemPrompt = this.buildRegionPrompt(region, settings);
      const modelResponse = await this.callModel(region.primaryModelId, systemPrompt, input, region.maxTokensPerCall);
      const latency = Date.now() - startTime;
      await this.logActivation(tenantId, sessionId, region.regionId, true, latency, modelResponse.modelUsed);
      return {
        regionId: region.regionId,
        regionSlug: region.slug,
        success: true,
        output: modelResponse.content,
        latencyMs: modelResponse.latencyMs,
        tokensUsed: modelResponse.inputTokens + modelResponse.outputTokens,
        costCents: modelResponse.costCents,
        modelUsed: modelResponse.modelUsed,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      await this.logActivation(tenantId, sessionId, region.regionId, false, latency, region.primaryModelId);
      return { regionId: region.regionId, regionSlug: region.slug, success: false, output: null, latencyMs: latency, tokensUsed: 0, costCents: 0, modelUsed: region.primaryModelId, error: error instanceof Error ? error.message : 'Unknown' };
    }
  }

  private buildRegionPrompt(region: BrainRegion, settings: CognitiveBrainSettings): string {
    const prompts: Record<string, string> = {
      reasoning: 'You are a logical reasoning specialist. Analyze problems step by step.',
      memory: 'You are a memory retrieval specialist. Find relevant information.',
      language_production: 'You are a language specialist. Generate clear responses.',
      emotion: 'You are an emotional intelligence specialist. Detect sentiment and tone.',
      vision: 'You are a visual processing specialist. Analyze visual content.',
      procedural: 'You are a technical specialist. Focus on code and procedures.',
      creativity: 'You are a creative specialist. Generate novel ideas.',
    };
    return settings.customSystemPrompt || prompts[region.cognitiveFunction] || 'You are an AI assistant.';
  }

  private async callModel(modelId: string, systemPrompt: string, input: string, maxTokens: number): Promise<ModelResponse> {
    // Use hybrid model router: Bedrock (primary) -> LiteLLM (fallback) -> Direct (specialized)
    return modelRouterService.invoke({
      modelId,
      messages: [{ role: 'user', content: input }],
      systemPrompt,
      maxTokens,
    });
  }

  private async logActivation(tenantId: string, sessionId: string, regionId: string, success: boolean, latencyMs: number, modelUsed: string): Promise<void> {
    await executeStatement(
      `INSERT INTO region_activation_log (tenant_id, session_id, region_id, success, latency_ms, model_used) VALUES ($1, $2, $3, $4, $5, $6)`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }, { name: 'sessionId', value: { stringValue: sessionId } }, { name: 'regionId', value: { stringValue: regionId } }, { name: 'success', value: { booleanValue: success } }, { name: 'latencyMs', value: { longValue: latencyMs } }, { name: 'modelUsed', value: { stringValue: modelUsed } }]
    );
  }

  private mapBrainRegion(row: Record<string, unknown>): BrainRegion {
    return {
      regionId: String(row.region_id), name: String(row.name), slug: String(row.slug),
      description: row.description ? String(row.description) : undefined,
      icon: String(row.icon || 'brain'), color: String(row.color || '#6366f1'),
      cognitiveFunction: String(row.cognitive_function),
      humanBrainAnalog: row.human_brain_analog ? String(row.human_brain_analog) : undefined,
      primaryModelId: String(row.primary_model_id), fallbackModelIds: (row.fallback_model_ids as string[]) || [],
      activationTriggers: typeof row.activation_triggers === 'string' ? JSON.parse(row.activation_triggers) : (row.activation_triggers as ActivationTrigger[]) || [],
      priority: Number(row.priority || 50), maxLatencyMs: Number(row.max_latency_ms || 5000),
      maxTokensPerCall: Number(row.max_tokens_per_call || 4096), learningRate: Number(row.learning_rate || 0.01),
      isActive: Boolean(row.is_active), isSystem: Boolean(row.is_system),
      metrics: { totalActivations: Number(row.total_activations || 0), successfulActivations: Number(row.successful_activations || 0), avgLatencyMs: Number(row.avg_latency_ms || 0), avgSatisfactionScore: Number(row.avg_satisfaction_score || 0) },
    };
  }

  private mapSettings(row: Record<string, unknown>): CognitiveBrainSettings {
    return {
      cognitiveBrainEnabled: Boolean(row.cognitive_brain_enabled ?? true), learningEnabled: Boolean(row.learning_enabled ?? true),
      adaptationEnabled: Boolean(row.adaptation_enabled ?? true), defaultBlueprintId: row.default_blueprint_id ? String(row.default_blueprint_id) : undefined,
      maxConcurrentRegions: Number(row.max_concurrent_regions || 5), maxTokensPerRequest: Number(row.max_tokens_per_request || 16000),
      maxLatencyMs: Number(row.max_latency_ms || 10000), dailyCostLimitCents: Number(row.daily_cost_limit_cents || 10000),
      monthlyCostLimitCents: Number(row.monthly_cost_limit_cents || 100000), globalLearningRate: Number(row.global_learning_rate || 0.01),
      memoryRetentionDays: Number(row.memory_retention_days || 90), insightConfidenceThreshold: Number(row.insight_confidence_threshold || 0.7),
      enableMetacognition: Boolean(row.enable_metacognition ?? true), enableTheoryOfMind: Boolean(row.enable_theory_of_mind ?? true),
      enableCreativeSynthesis: Boolean(row.enable_creative_synthesis ?? true), enableSelfCorrection: Boolean(row.enable_self_correction ?? true),
      customSystemPrompt: row.custom_system_prompt ? String(row.custom_system_prompt) : undefined,
      regionOverrides: typeof row.region_overrides === 'string' ? JSON.parse(row.region_overrides) : (row.region_overrides as Record<string, Partial<BrainRegion>>) || {},
    };
  }

  private getDefaultSettings(): CognitiveBrainSettings {
    return {
      cognitiveBrainEnabled: true, learningEnabled: true, adaptationEnabled: true,
      maxConcurrentRegions: 5, maxTokensPerRequest: 16000, maxLatencyMs: 10000,
      dailyCostLimitCents: 10000, monthlyCostLimitCents: 100000, globalLearningRate: 0.01,
      memoryRetentionDays: 90, insightConfidenceThreshold: 0.7,
      enableMetacognition: true, enableTheoryOfMind: true, enableCreativeSynthesis: true, enableSelfCorrection: true,
      regionOverrides: {},
    };
  }
}

export const cognitiveBrainService = new CognitiveBrainService();
