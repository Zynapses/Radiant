// RADIANT v4.18.0 - Bedrock Model Discovery Service
// Discovers available Bedrock models, tracks versions, auto-upgrades
// ============================================================================

import {
  BedrockClient,
  ListFoundationModelsCommand,
  GetFoundationModelCommand,
  FoundationModelSummary,
} from '@aws-sdk/client-bedrock';
import { executeStatement, stringParam, doubleParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'bedrock/model-discovery',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface BedrockModelEntry {
  id: string;
  modelName: string;
  providerName: string;
  modelArn: string | null;
  inputModalities: string[];
  outputModalities: string[];
  responseStreamingSupported: boolean;
  customizationsSupported: string[];
  inferenceTypesSupported: string[];
  modelLifecycleStatus: string | null;
  modelVersion: string | null;
  isActive: boolean;
  isAvailableForInference: boolean;
  inputPricePer1kTokens: number | null;
  outputPricePer1kTokens: number | null;
  discoveredAt: string;
  lastCheckedAt: string;
  metadata: Record<string, unknown>;
}

export interface AdminAIHelperConfig {
  tenantId: string;
  enabled: boolean;
  bedrockModelId: string;
  bedrockRegion: string;
  autoUpgradeModel: boolean;
  preferredModelFamily: string;
  maxTokens: number;
  temperature: number;
  modelPollIntervalHours: number;
  lastModelPollAt: string | null;
  lastAutoUpgradeAt: string | null;
  lastAutoUpgradeFrom: string | null;
  lastAutoUpgradeTo: string | null;
  includePageData: boolean;
  includeSystemMetrics: boolean;
  maxContextTokens: number;
  systemPromptOverride: string | null;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface AutoUpgradeResult {
  upgraded: boolean;
  previousModelId: string;
  newModelId: string | null;
  reason: string;
}

// Known Bedrock pricing (approximate, as Bedrock doesn't return pricing via API)
const BEDROCK_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic.claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'anthropic.claude-3-5-haiku': { input: 0.0008, output: 0.004 },
  'anthropic.claude-3-opus': { input: 0.015, output: 0.075 },
  'anthropic.claude-3-sonnet': { input: 0.003, output: 0.015 },
  'anthropic.claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'anthropic.claude-instant': { input: 0.0008, output: 0.0024 },
  'meta.llama3-1-70b': { input: 0.00099, output: 0.00099 },
  'meta.llama3-1-8b': { input: 0.00022, output: 0.00022 },
  'meta.llama3-2-90b': { input: 0.002, output: 0.002 },
  'meta.llama3-2-11b': { input: 0.00016, output: 0.00016 },
  'amazon.titan-text-express': { input: 0.0002, output: 0.0006 },
  'amazon.titan-text-lite': { input: 0.00015, output: 0.0002 },
  'amazon.titan-text-premier': { input: 0.0005, output: 0.0015 },
  'amazon.titan-embed-text': { input: 0.0001, output: 0 },
  'mistral.mistral-large': { input: 0.004, output: 0.012 },
  'mistral.mistral-small': { input: 0.001, output: 0.003 },
  'mistral.mixtral-8x7b': { input: 0.00045, output: 0.0007 },
  'cohere.command-r-plus': { input: 0.003, output: 0.015 },
  'cohere.command-r': { input: 0.0005, output: 0.0015 },
  'ai21.jamba-1-5-large': { input: 0.002, output: 0.008 },
  'ai21.jamba-1-5-mini': { input: 0.0002, output: 0.0004 },
};

// Model family ordering for auto-upgrade (higher = newer/better)
const MODEL_FAMILY_VERSIONS: Record<string, string[]> = {
  'anthropic.claude': [
    'anthropic.claude-instant-v1',
    'anthropic.claude-v2',
    'anthropic.claude-v2:1',
    'anthropic.claude-3-haiku-20240307-v1:0',
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'anthropic.claude-3-opus-20240229-v1:0',
    'anthropic.claude-3-5-haiku-20241022-v1:0',
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
  ],
  'meta.llama': [
    'meta.llama3-8b-instruct-v1:0',
    'meta.llama3-70b-instruct-v1:0',
    'meta.llama3-1-8b-instruct-v1:0',
    'meta.llama3-1-70b-instruct-v1:0',
    'meta.llama3-2-11b-instruct-v1:0',
    'meta.llama3-2-90b-instruct-v1:0',
  ],
  'amazon.titan': [
    'amazon.titan-text-lite-v1',
    'amazon.titan-text-express-v1',
    'amazon.titan-text-premier-v1:0',
  ],
  'mistral': [
    'mistral.mixtral-8x7b-instruct-v0:1',
    'mistral.mistral-small-2402-v1:0',
    'mistral.mistral-large-2402-v1:0',
    'mistral.mistral-large-2407-v1:0',
  ],
};

// ============================================================================
// Bedrock Model Discovery Service
// ============================================================================

class BedrockModelDiscoveryService {
  private bedrockClient: BedrockClient;

  constructor() {
    this.bedrockClient = new BedrockClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  // ==========================================================================
  // Discovery: List and sync Bedrock models
  // ==========================================================================

  /**
   * Poll Bedrock for all available foundation models and sync to registry.
   * Returns count of new/updated models.
   */
  async pollAndSyncModels(): Promise<{ newModels: number; updatedModels: number; totalModels: number; deactivatedModels: number }> {
    logger.info('Starting Bedrock model discovery poll');

    let newModels = 0;
    let updatedModels = 0;
    let deactivatedModels = 0;

    const discoveredIds = new Set<string>();

    try {
      const command = new ListFoundationModelsCommand({});
      const response = await this.bedrockClient.send(command);

      const models = response.modelSummaries || [];
      logger.info(`Discovered ${models.length} Bedrock foundation models`);

      for (const model of models) {
        if (!model.modelId) continue;
        discoveredIds.add(model.modelId);

        const pricing = this.lookupPricing(model.modelId);

        const existingResult = await executeStatement(
          `SELECT id FROM bedrock_model_registry WHERE id = $1`,
          [stringParam('id', model.modelId)]
        );

        if (existingResult.rows?.length) {
          // Update existing
          await executeStatement(
            `UPDATE bedrock_model_registry SET
              model_name = $2, provider_name = $3, model_arn = $4,
              input_modalities = $5::text[], output_modalities = $6::text[],
              response_streaming_supported = $7, customizations_supported = $8::text[],
              inference_types_supported = $9::text[], model_lifecycle_status = $10,
              is_active = true, is_available_for_inference = true,
              last_checked_at = NOW(),
              input_price_per_1k_tokens = COALESCE($11, input_price_per_1k_tokens),
              output_price_per_1k_tokens = COALESCE($12, output_price_per_1k_tokens),
              metadata = $13::jsonb
            WHERE id = $1`,
            [
              stringParam('id', model.modelId),
              stringParam('name', model.modelName || model.modelId),
              stringParam('provider', model.providerName || 'unknown'),
              stringParam('arn', model.modelArn || ''),
              stringParam('inputMod', `{${(model.inputModalities || []).join(',')}}`),
              stringParam('outputMod', `{${(model.outputModalities || []).join(',')}}`),
              boolParam('streaming', model.responseStreamingSupported || false),
              stringParam('customizations', `{${(model.customizationsSupported || []).join(',')}}`),
              stringParam('inference', `{${(model.inferenceTypesSupported || []).join(',')}}`),
              stringParam('lifecycle', String(model.modelLifecycle || 'ACTIVE')),
              pricing ? doubleParam('inputPrice', pricing.input) : stringParam('inputPrice', ''),
              pricing ? doubleParam('outputPrice', pricing.output) : stringParam('outputPrice', ''),
              stringParam('metadata', JSON.stringify({
                customizationsSupported: model.customizationsSupported,
                inferenceTypesSupported: model.inferenceTypesSupported,
              })),
            ]
          );
          updatedModels++;
        } else {
          // Insert new
          await executeStatement(
            `INSERT INTO bedrock_model_registry (id, model_name, provider_name, model_arn, input_modalities, output_modalities, response_streaming_supported, customizations_supported, inference_types_supported, model_lifecycle_status, input_price_per_1k_tokens, output_price_per_1k_tokens, metadata)
             VALUES ($1, $2, $3, $4, $5::text[], $6::text[], $7, $8::text[], $9::text[], $10, $11, $12, $13::jsonb)`,
            [
              stringParam('id', model.modelId),
              stringParam('name', model.modelName || model.modelId),
              stringParam('provider', model.providerName || 'unknown'),
              stringParam('arn', model.modelArn || ''),
              stringParam('inputMod', `{${(model.inputModalities || []).join(',')}}`),
              stringParam('outputMod', `{${(model.outputModalities || []).join(',')}}`),
              boolParam('streaming', model.responseStreamingSupported || false),
              stringParam('customizations', `{${(model.customizationsSupported || []).join(',')}}`),
              stringParam('inference', `{${(model.inferenceTypesSupported || []).join(',')}}`),
              stringParam('lifecycle', String(model.modelLifecycle || 'ACTIVE')),
              pricing ? doubleParam('inputPrice', pricing.input) : stringParam('inputPrice', ''),
              pricing ? doubleParam('outputPrice', pricing.output) : stringParam('outputPrice', ''),
              stringParam('metadata', '{}'),
            ]
          );
          newModels++;
        }
      }

      // Deactivate models no longer in the listing
      if (discoveredIds.size > 0) {
        const idsArray = Array.from(discoveredIds);
        const placeholders = idsArray.map((_, i) => `$${i + 1}`).join(', ');
        const deactivateResult = await executeStatement(
          `UPDATE bedrock_model_registry SET is_active = false, is_available_for_inference = false, last_checked_at = NOW()
           WHERE id NOT IN (${placeholders}) AND is_active = true`,
          idsArray.map((id, i) => stringParam(`id${i}`, id))
        );
        deactivatedModels = Number(deactivateResult.numberOfRecordsUpdated || 0);
      }

    } catch (error) {
      logger.error('Bedrock model discovery failed', { error: String(error) });
      throw error;
    }

    const totalModels = discoveredIds.size;
    logger.info('Bedrock model discovery complete', { newModels, updatedModels, totalModels, deactivatedModels });

    return { newModels, updatedModels, totalModels, deactivatedModels };
  }

  // ==========================================================================
  // Registry Queries
  // ==========================================================================

  async getAllModels(activeOnly = true): Promise<BedrockModelEntry[]> {
    const query = activeOnly
      ? `SELECT * FROM bedrock_model_registry WHERE is_active = true ORDER BY provider_name, model_name`
      : `SELECT * FROM bedrock_model_registry ORDER BY provider_name, model_name`;

    const result = await executeStatement(query, []);
    return (result.rows || []).map(row => this.rowToEntry(row));
  }

  async getModelsByProvider(providerName: string): Promise<BedrockModelEntry[]> {
    const result = await executeStatement(
      `SELECT * FROM bedrock_model_registry WHERE provider_name = $1 AND is_active = true ORDER BY model_name`,
      [stringParam('provider', providerName)]
    );
    return (result.rows || []).map(row => this.rowToEntry(row));
  }

  async getModelsByFamily(familyPrefix: string): Promise<BedrockModelEntry[]> {
    const result = await executeStatement(
      `SELECT * FROM bedrock_model_registry WHERE id LIKE $1 AND is_active = true ORDER BY id`,
      [stringParam('prefix', `${familyPrefix}%`)]
    );
    return (result.rows || []).map(row => this.rowToEntry(row));
  }

  async getModel(modelId: string): Promise<BedrockModelEntry | null> {
    const result = await executeStatement(
      `SELECT * FROM bedrock_model_registry WHERE id = $1`,
      [stringParam('id', modelId)]
    );
    return result.rows?.[0] ? this.rowToEntry(result.rows[0]) : null;
  }

  async getProviders(): Promise<string[]> {
    const result = await executeStatement(
      `SELECT DISTINCT provider_name FROM bedrock_model_registry WHERE is_active = true ORDER BY provider_name`,
      []
    );
    return (result.rows || []).map(row => String(row.provider_name));
  }

  // ==========================================================================
  // Auto-Upgrade Logic
  // ==========================================================================

  /**
   * Check if there's a newer model in the same family and upgrade if auto-upgrade is on.
   * Returns the upgrade result.
   */
  async checkAndAutoUpgrade(tenantId: string): Promise<AutoUpgradeResult> {
    const config = await this.getHelperConfig(tenantId);
    if (!config) {
      return { upgraded: false, previousModelId: '', newModelId: null, reason: 'No AI helper config found' };
    }

    if (!config.autoUpgradeModel) {
      return { upgraded: false, previousModelId: config.bedrockModelId, newModelId: null, reason: 'Auto-upgrade disabled' };
    }

    const currentModelId = config.bedrockModelId;
    const family = config.preferredModelFamily || this.detectFamily(currentModelId);

    if (!family) {
      return { upgraded: false, previousModelId: currentModelId, newModelId: null, reason: 'Could not detect model family' };
    }

    // Get all models in the family from our registry
    const familyModels = await this.getModelsByFamily(family);
    if (familyModels.length === 0) {
      return { upgraded: false, previousModelId: currentModelId, newModelId: null, reason: 'No models found in family' };
    }

    // Find the best/latest model in this family using our version ordering
    const versionOrder = MODEL_FAMILY_VERSIONS[family] || [];
    let bestModelId = currentModelId;
    let bestRank = versionOrder.indexOf(currentModelId);

    for (const model of familyModels) {
      if (!model.isAvailableForInference) continue;
      const rank = versionOrder.indexOf(model.id);
      if (rank > bestRank) {
        bestRank = rank;
        bestModelId = model.id;
      }
    }

    // If no known ordering, try alphabetical/version sort as fallback
    if (bestRank === -1) {
      const availableModels = familyModels
        .filter(m => m.isAvailableForInference && m.id.startsWith(family))
        .sort((a, b) => b.id.localeCompare(a.id)); // Latest version string wins

      if (availableModels.length > 0 && availableModels[0].id !== currentModelId) {
        bestModelId = availableModels[0].id;
      }
    }

    if (bestModelId === currentModelId) {
      return { upgraded: false, previousModelId: currentModelId, newModelId: null, reason: 'Already on latest model' };
    }

    // Perform the upgrade
    await executeStatement(
      `UPDATE admin_ai_helper_config SET
        bedrock_model_id = $2,
        last_auto_upgrade_at = NOW(),
        last_auto_upgrade_from = $3,
        last_auto_upgrade_to = $2,
        updated_at = NOW()
       WHERE tenant_id = $1::uuid`,
      [
        stringParam('tenantId', tenantId),
        stringParam('newModelId', bestModelId),
        stringParam('prevModelId', currentModelId),
      ]
    );

    logger.info('Auto-upgraded Bedrock model', { tenantId, from: currentModelId, to: bestModelId });

    return {
      upgraded: true,
      previousModelId: currentModelId,
      newModelId: bestModelId,
      reason: `Upgraded from ${currentModelId} to ${bestModelId}`,
    };
  }

  // ==========================================================================
  // Admin AI Helper Config
  // ==========================================================================

  async getHelperConfig(tenantId: string): Promise<AdminAIHelperConfig | null> {
    const result = await executeStatement(
      `SELECT * FROM admin_ai_helper_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    return result.rows?.[0] ? this.rowToConfig(result.rows[0]) : null;
  }

  async ensureHelperConfig(tenantId: string): Promise<AdminAIHelperConfig> {
    await executeStatement(
      `INSERT INTO admin_ai_helper_config (tenant_id) VALUES ($1::uuid) ON CONFLICT (tenant_id) DO NOTHING`,
      [stringParam('tenantId', tenantId)]
    );
    return (await this.getHelperConfig(tenantId))!;
  }

  async updateHelperConfig(
    tenantId: string,
    updates: Partial<Omit<AdminAIHelperConfig, 'tenantId' | 'totalRequests' | 'totalInputTokens' | 'totalOutputTokens' | 'totalCostCents' | 'updatedAt'>>,
    updatedBy?: string
  ): Promise<AdminAIHelperConfig> {
    await this.ensureHelperConfig(tenantId);

    const setClauses: string[] = [];
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];
    let idx = 2;

    const fieldMap: Record<string, string> = {
      enabled: 'enabled',
      bedrockModelId: 'bedrock_model_id',
      bedrockRegion: 'bedrock_region',
      autoUpgradeModel: 'auto_upgrade_model',
      preferredModelFamily: 'preferred_model_family',
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      modelPollIntervalHours: 'model_poll_interval_hours',
      includePageData: 'include_page_data',
      includeSystemMetrics: 'include_system_metrics',
      maxContextTokens: 'max_context_tokens',
      systemPromptOverride: 'system_prompt_override',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (key in updates) {
        const value = (updates as Record<string, unknown>)[key];
        setClauses.push(`${column} = $${idx}`);
        if (typeof value === 'boolean') {
          params.push(boolParam(`p${idx}`, value));
        } else if (typeof value === 'number') {
          params.push(doubleParam(`p${idx}`, value));
        } else if (value === null) {
          setClauses[setClauses.length - 1] = `${column} = NULL`;
          continue;
        } else {
          params.push(stringParam(`p${idx}`, String(value)));
        }
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return (await this.getHelperConfig(tenantId))!;
    }

    setClauses.push('updated_at = NOW()');
    if (updatedBy) {
      setClauses.push(`updated_by = $${idx}::uuid`);
      params.push(stringParam('updatedBy', updatedBy));
    }

    await executeStatement(
      `UPDATE admin_ai_helper_config SET ${setClauses.join(', ')} WHERE tenant_id = $1::uuid`,
      params
    );

    return (await this.getHelperConfig(tenantId))!;
  }

  /**
   * Record AI helper usage stats (called after each AI helper request)
   */
  async recordUsage(tenantId: string, inputTokens: number, outputTokens: number, costCents: number): Promise<void> {
    await executeStatement(
      `UPDATE admin_ai_helper_config SET
        total_requests = total_requests + 1,
        total_input_tokens = total_input_tokens + $2,
        total_output_tokens = total_output_tokens + $3,
        total_cost_cents = total_cost_cents + $4,
        updated_at = NOW()
       WHERE tenant_id = $1::uuid`,
      [
        stringParam('tenantId', tenantId),
        stringParam('inputTokens', String(inputTokens)),
        stringParam('outputTokens', String(outputTokens)),
        doubleParam('costCents', costCents),
      ]
    );
  }

  /**
   * Update last poll timestamp
   */
  async recordPoll(tenantId: string): Promise<void> {
    await executeStatement(
      `UPDATE admin_ai_helper_config SET last_model_poll_at = NOW(), updated_at = NOW() WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
  }

  /**
   * Check if a poll is due for this tenant
   */
  async isPollDue(tenantId: string): Promise<boolean> {
    const config = await this.getHelperConfig(tenantId);
    if (!config) return true;

    if (!config.lastModelPollAt) return true;

    const lastPoll = new Date(config.lastModelPollAt);
    const now = new Date();
    const hoursSinceLastPoll = (now.getTime() - lastPoll.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastPoll >= config.modelPollIntervalHours;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private lookupPricing(modelId: string): { input: number; output: number } | null {
    // Try exact match first, then prefix matches
    for (const [prefix, pricing] of Object.entries(BEDROCK_PRICING)) {
      if (modelId.startsWith(prefix)) {
        return pricing;
      }
    }
    return null;
  }

  private detectFamily(modelId: string): string | null {
    for (const family of Object.keys(MODEL_FAMILY_VERSIONS)) {
      if (modelId.startsWith(family)) return family;
    }
    // Try detecting from provider prefix
    const parts = modelId.split('.');
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[1].split('-').slice(0, 1).join('-')}`;
    }
    return null;
  }

  private rowToEntry(row: Record<string, unknown>): BedrockModelEntry {
    return {
      id: String(row.id),
      modelName: String(row.model_name),
      providerName: String(row.provider_name),
      modelArn: row.model_arn ? String(row.model_arn) : null,
      inputModalities: (row.input_modalities as string[]) || [],
      outputModalities: (row.output_modalities as string[]) || [],
      responseStreamingSupported: row.response_streaming_supported === true,
      customizationsSupported: (row.customizations_supported as string[]) || [],
      inferenceTypesSupported: (row.inference_types_supported as string[]) || [],
      modelLifecycleStatus: row.model_lifecycle_status ? String(row.model_lifecycle_status) : null,
      modelVersion: row.model_version ? String(row.model_version) : null,
      isActive: row.is_active === true,
      isAvailableForInference: row.is_available_for_inference === true,
      inputPricePer1kTokens: row.input_price_per_1k_tokens != null ? Number(row.input_price_per_1k_tokens) : null,
      outputPricePer1kTokens: row.output_price_per_1k_tokens != null ? Number(row.output_price_per_1k_tokens) : null,
      discoveredAt: String(row.discovered_at),
      lastCheckedAt: String(row.last_checked_at),
      metadata: (row.metadata as Record<string, unknown>) || {},
    };
  }

  private rowToConfig(row: Record<string, unknown>): AdminAIHelperConfig {
    return {
      tenantId: String(row.tenant_id),
      enabled: row.enabled !== false,
      bedrockModelId: String(row.bedrock_model_id || 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
      bedrockRegion: String(row.bedrock_region || 'us-east-1'),
      autoUpgradeModel: row.auto_upgrade_model !== false,
      preferredModelFamily: String(row.preferred_model_family || 'anthropic.claude'),
      maxTokens: Number(row.max_tokens || 4096),
      temperature: Number(row.temperature || 0.3),
      modelPollIntervalHours: Number(row.model_poll_interval_hours || 24),
      lastModelPollAt: row.last_model_poll_at ? String(row.last_model_poll_at) : null,
      lastAutoUpgradeAt: row.last_auto_upgrade_at ? String(row.last_auto_upgrade_at) : null,
      lastAutoUpgradeFrom: row.last_auto_upgrade_from ? String(row.last_auto_upgrade_from) : null,
      lastAutoUpgradeTo: row.last_auto_upgrade_to ? String(row.last_auto_upgrade_to) : null,
      includePageData: row.include_page_data !== false,
      includeSystemMetrics: row.include_system_metrics !== false,
      maxContextTokens: Number(row.max_context_tokens || 8000),
      systemPromptOverride: row.system_prompt_override ? String(row.system_prompt_override) : null,
      totalRequests: Number(row.total_requests || 0),
      totalInputTokens: Number(row.total_input_tokens || 0),
      totalOutputTokens: Number(row.total_output_tokens || 0),
      totalCostCents: Number(row.total_cost_cents || 0),
      updatedAt: String(row.updated_at),
      updatedBy: row.updated_by ? String(row.updated_by) : null,
    };
  }
}

export const bedrockModelDiscoveryService = new BedrockModelDiscoveryService();
