import { executeStatement, toSqlParams } from '../db/client';
import type { SqlParameter } from '@aws-sdk/client-rds-data';

export type SelectionMode = 'auto' | 'manual' | 'favorites';
export type ModelCategory = 'standard' | 'novel' | 'self-hosted' | 'experimental';

export interface ModelInfo {
  id: string;
  modelId: string;
  displayName: string;
  provider: string;
  category: ModelCategory;
  contextWindow: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
  isNovel: boolean;
  thinktankEnabled: boolean;
  displayOrder: number;
  capabilities: string[];
  bestFor?: string;
}

export interface UserModelPreferences {
  id: string;
  userId: string;
  tenantId: string;
  selectionMode: SelectionMode;
  defaultModelId?: string;
  favoriteModels: string[];
  showStandardModels: boolean;
  showNovelModels: boolean;
  showSelfHostedModels: boolean;
  showCostPerMessage: boolean;
  maxCostPerMessage?: number;
  preferCostOptimization: boolean;
  domainModeOverrides: Record<string, string>;
  recentModels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingConfig {
  id: string;
  tenantId: string;
  externalDefaultMarkup: number;
  selfHostedDefaultMarkup: number;
  minimumChargePerRequest: number;
  priceIncreaseGracePeriodHours: number;
  autoUpdateFromProviders: boolean;
  autoUpdateFrequency: 'hourly' | 'daily' | 'weekly';
  lastAutoUpdate?: Date;
  notifyOnPriceChange: boolean;
  notifyThresholdPercent: number;
}

export interface ModelPricingOverride {
  id: string;
  tenantId: string;
  modelId: string;
  customInputPrice?: number;
  customOutputPrice?: number;
  markupPercent?: number;
  isEnabled: boolean;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
}

export class ModelSelectionService {
  async getAvailableModels(
    tenantId: string,
    userId: string,
    options?: { category?: ModelCategory; includeDisabled?: boolean }
  ): Promise<ModelInfo[]> {
    let sql = `
      SELECT m.*, mp.custom_input_price, mp.custom_output_price, mp.markup_percent, mp.is_enabled
      FROM models m
      LEFT JOIN model_pricing_overrides mp ON m.model_id = mp.model_id AND mp.tenant_id = $1
      WHERE m.thinktank_enabled = true
    `;
    const params: SqlParameter[] = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (options?.category) {
      sql += ` AND m.category = $2`;
      params.push({ name: 'category', value: { stringValue: options.category } });
    }

    if (!options?.includeDisabled) {
      sql += ` AND (mp.is_enabled IS NULL OR mp.is_enabled = true)`;
    }

    sql += ` ORDER BY m.thinktank_display_order ASC, m.display_name ASC`;

    const result = await executeStatement(sql, params);
    return result.rows as unknown as ModelInfo[];
  }

  async getUserPreferences(tenantId: string, userId: string): Promise<UserModelPreferences | null> {
    const result = await executeStatement(
      `SELECT * FROM thinktank_user_model_preferences WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    return result.rows.length > 0 ? (result.rows[0] as unknown as UserModelPreferences) : null;
  }

  async saveUserPreferences(
    tenantId: string,
    userId: string,
    preferences: Partial<UserModelPreferences>
  ): Promise<void> {
    const existing = await this.getUserPreferences(tenantId, userId);

    if (existing) {
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: SqlParameter[] = [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ];
      let paramIndex = 3;

      if (preferences.selectionMode !== undefined) {
        setClauses.push(`selection_mode = $${paramIndex++}`);
        params.push({ name: 'selectionMode', value: { stringValue: preferences.selectionMode } });
      }
      if (preferences.defaultModelId !== undefined) {
        setClauses.push(`default_model_id = $${paramIndex++}`);
        params.push({ name: 'defaultModelId', value: { stringValue: preferences.defaultModelId } });
      }
      if (preferences.favoriteModels !== undefined) {
        setClauses.push(`favorite_models = $${paramIndex++}::jsonb`);
        params.push({ name: 'favoriteModels', value: { stringValue: JSON.stringify(preferences.favoriteModels) } });
      }
      if (preferences.showStandardModels !== undefined) {
        setClauses.push(`show_standard_models = $${paramIndex++}`);
        params.push({ name: 'showStandard', value: { booleanValue: preferences.showStandardModels } });
      }
      if (preferences.showNovelModels !== undefined) {
        setClauses.push(`show_novel_models = $${paramIndex++}`);
        params.push({ name: 'showNovel', value: { booleanValue: preferences.showNovelModels } });
      }
      if (preferences.maxCostPerMessage !== undefined) {
        setClauses.push(`max_cost_per_message = $${paramIndex++}`);
        params.push({ name: 'maxCost', value: { doubleValue: preferences.maxCostPerMessage } });
      }
      if (preferences.preferCostOptimization !== undefined) {
        setClauses.push(`prefer_cost_optimization = $${paramIndex++}`);
        params.push({ name: 'preferCost', value: { booleanValue: preferences.preferCostOptimization } });
      }
      if (preferences.domainModeOverrides !== undefined) {
        setClauses.push(`domain_mode_model_overrides = $${paramIndex++}::jsonb`);
        params.push({ name: 'domainOverrides', value: { stringValue: JSON.stringify(preferences.domainModeOverrides) } });
      }

      await executeStatement(
        `UPDATE thinktank_user_model_preferences SET ${setClauses.join(', ')} WHERE tenant_id = $1 AND user_id = $2`,
        params
      );
    } else {
      await executeStatement(
        `INSERT INTO thinktank_user_model_preferences (
           tenant_id, user_id, selection_mode, default_model_id, favorite_models,
           show_standard_models, show_novel_models, show_self_hosted_models,
           show_cost_per_message, max_cost_per_message, prefer_cost_optimization,
           domain_mode_model_overrides, recent_models
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'selectionMode', value: { stringValue: preferences.selectionMode || 'auto' } },
          { name: 'defaultModelId', value: preferences.defaultModelId ? { stringValue: preferences.defaultModelId } : { isNull: true } },
          { name: 'favoriteModels', value: { stringValue: JSON.stringify(preferences.favoriteModels || []) } },
          { name: 'showStandard', value: { booleanValue: preferences.showStandardModels ?? true } },
          { name: 'showNovel', value: { booleanValue: preferences.showNovelModels ?? true } },
          { name: 'showSelfHosted', value: { booleanValue: preferences.showSelfHostedModels ?? false } },
          { name: 'showCost', value: { booleanValue: preferences.showCostPerMessage ?? true } },
          { name: 'maxCost', value: preferences.maxCostPerMessage ? { doubleValue: preferences.maxCostPerMessage } : { isNull: true } },
          { name: 'preferCost', value: { booleanValue: preferences.preferCostOptimization ?? false } },
          { name: 'domainOverrides', value: { stringValue: JSON.stringify(preferences.domainModeOverrides || {}) } },
          { name: 'recentModels', value: { stringValue: JSON.stringify(preferences.recentModels || []) } },
        ]
      );
    }
  }

  async addToRecentModels(tenantId: string, userId: string, modelId: string): Promise<void> {
    const prefs = await this.getUserPreferences(tenantId, userId);
    const recentModels = prefs?.recentModels || [];

    const filtered = recentModels.filter((m) => m !== modelId);
    filtered.unshift(modelId);
    const updated = filtered.slice(0, 10);

    await executeStatement(
      `UPDATE thinktank_user_model_preferences 
       SET recent_models = $3::jsonb, updated_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'recentModels', value: { stringValue: JSON.stringify(updated) } },
      ]
    );
  }

  async toggleFavorite(tenantId: string, userId: string, modelId: string): Promise<boolean> {
    const prefs = await this.getUserPreferences(tenantId, userId);
    const favorites = prefs?.favoriteModels || [];

    const isFavorite = favorites.includes(modelId);
    const updated = isFavorite ? favorites.filter((m) => m !== modelId) : [...favorites, modelId];

    await executeStatement(
      `UPDATE thinktank_user_model_preferences 
       SET favorite_models = $3::jsonb, updated_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'favorites', value: { stringValue: JSON.stringify(updated) } },
      ]
    );

    return !isFavorite;
  }

  async getPricingConfig(tenantId: string): Promise<PricingConfig | null> {
    const result = await executeStatement(
      `SELECT * FROM pricing_config WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.length > 0 ? (result.rows[0] as unknown as PricingConfig) : null;
  }

  async updatePricingConfig(tenantId: string, config: Partial<PricingConfig>): Promise<void> {
    const existing = await this.getPricingConfig(tenantId);

    if (existing) {
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: SqlParameter[] = [
        { name: 'tenantId', value: { stringValue: tenantId } },
      ];
      let paramIndex = 2;

      if (config.externalDefaultMarkup !== undefined) {
        setClauses.push(`external_default_markup = $${paramIndex++}`);
        params.push({ name: 'markup', value: { doubleValue: config.externalDefaultMarkup } });
      }
      if (config.selfHostedDefaultMarkup !== undefined) {
        setClauses.push(`self_hosted_default_markup = $${paramIndex++}`);
        params.push({ name: 'selfHostedMarkup', value: { doubleValue: config.selfHostedDefaultMarkup } });
      }
      if (config.minimumChargePerRequest !== undefined) {
        setClauses.push(`minimum_charge_per_request = $${paramIndex++}`);
        params.push({ name: 'minCharge', value: { doubleValue: config.minimumChargePerRequest } });
      }
      if (config.autoUpdateFromProviders !== undefined) {
        setClauses.push(`auto_update_from_providers = $${paramIndex++}`);
        params.push({ name: 'autoUpdate', value: { booleanValue: config.autoUpdateFromProviders } });
      }

      await executeStatement(
        `UPDATE pricing_config SET ${setClauses.join(', ')} WHERE tenant_id = $1`,
        params
      );
    } else {
      await executeStatement(
        `INSERT INTO pricing_config (
           tenant_id, external_default_markup, self_hosted_default_markup,
           minimum_charge_per_request, auto_update_from_providers
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'externalMarkup', value: { doubleValue: config.externalDefaultMarkup ?? 0.40 } },
          { name: 'selfHostedMarkup', value: { doubleValue: config.selfHostedDefaultMarkup ?? 0.75 } },
          { name: 'minCharge', value: { doubleValue: config.minimumChargePerRequest ?? 0.001 } },
          { name: 'autoUpdate', value: { booleanValue: config.autoUpdateFromProviders ?? true } },
        ]
      );
    }
  }

  async setModelPricingOverride(
    tenantId: string,
    modelId: string,
    override: Partial<ModelPricingOverride>
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO model_pricing_overrides (
         tenant_id, model_id, custom_input_price, custom_output_price,
         markup_percent, is_enabled, effective_from, effective_until
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, model_id)
       DO UPDATE SET
         custom_input_price = COALESCE(EXCLUDED.custom_input_price, model_pricing_overrides.custom_input_price),
         custom_output_price = COALESCE(EXCLUDED.custom_output_price, model_pricing_overrides.custom_output_price),
         markup_percent = COALESCE(EXCLUDED.markup_percent, model_pricing_overrides.markup_percent),
         is_enabled = COALESCE(EXCLUDED.is_enabled, model_pricing_overrides.is_enabled),
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'inputPrice', value: override.customInputPrice ? { doubleValue: override.customInputPrice } : { isNull: true } },
        { name: 'outputPrice', value: override.customOutputPrice ? { doubleValue: override.customOutputPrice } : { isNull: true } },
        { name: 'markup', value: override.markupPercent ? { doubleValue: override.markupPercent } : { isNull: true } },
        { name: 'isEnabled', value: { booleanValue: override.isEnabled ?? true } },
        { name: 'effectiveFrom', value: override.effectiveFrom ? { stringValue: override.effectiveFrom.toISOString() } : { isNull: true } },
        { name: 'effectiveUntil', value: override.effectiveUntil ? { stringValue: override.effectiveUntil.toISOString() } : { isNull: true } },
      ]
    );
  }

  async calculateMessageCost(
    tenantId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<{ baseCost: number; finalCost: number; markup: number }> {
    const modelResult = await executeStatement(
      `SELECT m.input_price_per_1m, m.output_price_per_1m, m.is_self_hosted,
              mp.custom_input_price, mp.custom_output_price, mp.markup_percent
       FROM models m
       LEFT JOIN model_pricing_overrides mp ON m.model_id = mp.model_id AND mp.tenant_id = $1
       WHERE m.model_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'modelId', value: { stringValue: modelId } },
      ]
    );

    if (modelResult.rows.length === 0) {
      return { baseCost: 0, finalCost: 0, markup: 0 };
    }

    const model = modelResult.rows[0] as Record<string, unknown>;
    const config = await this.getPricingConfig(tenantId);

    const inputPrice = (model.custom_input_price as number) ?? (model.input_price_per_1m as number) ?? 0;
    const outputPrice = (model.custom_output_price as number) ?? (model.output_price_per_1m as number) ?? 0;

    const baseCost = (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;

    const isSelfHosted = model.is_self_hosted as boolean;
    const defaultMarkup = isSelfHosted
      ? config?.selfHostedDefaultMarkup ?? 0.75
      : config?.externalDefaultMarkup ?? 0.40;
    const markup = (model.markup_percent as number) ?? defaultMarkup;

    const finalCost = Math.max(baseCost * (1 + markup), config?.minimumChargePerRequest ?? 0.001);

    return { baseCost, finalCost, markup };
  }
}

export const modelSelectionService = new ModelSelectionService();
