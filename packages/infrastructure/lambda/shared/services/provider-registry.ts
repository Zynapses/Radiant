import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { executeStatement } from '../db/client';

interface ProviderConfig {
  displayName: string;
  apiBase: string;
  authType: 'api_key' | 'oauth' | 'iam' | 'service_account';
  authHeader?: string;
  authPrefix?: string;
  rateLimitRpm?: number;
  rateLimitTpm?: number;
}

interface ModelConfig {
  displayName: string;
  description?: string;
  category: 'flagship' | 'balanced' | 'fast' | 'budget' | 'specialized' | 'embedding' | 'vision' | 'audio';
  specialty?: string;
  contextWindow: number;
  maxOutputTokens?: number;
  supportedModalities?: string[];
  capabilities?: string[];
  inputCostPer1M: number;
  outputCostPer1M: number;
  isNovel?: boolean;
  minTier?: number;
}

export class ProviderRegistry {
  private kms: KMSClient;

  constructor() {
    this.kms = new KMSClient({});
  }

  async getProviders(activeOnly: boolean = true): Promise<unknown[]> {
    const whereClause = activeOnly ? 'WHERE is_active = true' : '';
    const result = await executeStatement(
      `SELECT * FROM ai_providers ${whereClause} ORDER BY priority, display_name`,
      []
    );
    return result.rows;
  }

  async getProvider(providerId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT * FROM ai_providers WHERE provider_id = $1`,
      [{ name: 'providerId', value: { stringValue: providerId } }]
    );
    return result.rows[0];
  }

  async createProvider(providerId: string, config: ProviderConfig): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO ai_providers 
       (provider_id, display_name, api_base, auth_type, auth_header, auth_prefix, rate_limit_rpm, rate_limit_tpm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        { name: 'providerId', value: { stringValue: providerId } },
        { name: 'displayName', value: { stringValue: config.displayName } },
        { name: 'apiBase', value: { stringValue: config.apiBase } },
        { name: 'authType', value: { stringValue: config.authType } },
        { name: 'authHeader', value: config.authHeader ? { stringValue: config.authHeader } : { isNull: true } },
        { name: 'authPrefix', value: config.authPrefix ? { stringValue: config.authPrefix } : { isNull: true } },
        { name: 'rateLimitRpm', value: config.rateLimitRpm ? { longValue: config.rateLimitRpm } : { isNull: true } },
        { name: 'rateLimitTpm', value: config.rateLimitTpm ? { longValue: config.rateLimitTpm } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getModels(providerId?: string, category?: string, activeOnly: boolean = true): Promise<unknown[]> {
    let sql = `SELECT m.*, p.provider_id, p.display_name as provider_name 
               FROM ai_models m 
               JOIN ai_providers p ON m.provider_id = p.id
               WHERE 1=1`;
    const params: Array<{ name: string; value: { stringValue: string } }> = [];

    if (activeOnly) {
      sql += ` AND m.is_active = true`;
    }

    if (providerId) {
      sql += ` AND p.provider_id = $${params.length + 1}`;
      params.push({ name: 'providerId', value: { stringValue: providerId } });
    }

    if (category) {
      sql += ` AND m.category = $${params.length + 1}`;
      params.push({ name: 'category', value: { stringValue: category } });
    }

    sql += ` ORDER BY m.category, m.display_name`;

    const result = await executeStatement(sql, params as Parameters<typeof executeStatement>[1]);
    return result.rows;
  }

  async getModel(modelId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT m.*, p.provider_id, p.display_name as provider_name, p.api_base
       FROM ai_models m 
       JOIN ai_providers p ON m.provider_id = p.id
       WHERE m.model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );
    return result.rows[0];
  }

  async createModel(modelId: string, providerId: string, config: ModelConfig): Promise<string> {
    // Get provider UUID
    const providerResult = await executeStatement(
      `SELECT id FROM ai_providers WHERE provider_id = $1`,
      [{ name: 'providerId', value: { stringValue: providerId } }]
    );

    if (providerResult.rows.length === 0) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const providerUuid = String((providerResult.rows[0] as Record<string, unknown>)?.id);

    const result = await executeStatement(
      `INSERT INTO ai_models 
       (model_id, provider_id, display_name, description, category, specialty,
        context_window, max_output_tokens, supported_modalities, capabilities,
        input_cost_per_1m, output_cost_per_1m, is_novel, min_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'providerUuid', value: { stringValue: providerUuid } },
        { name: 'displayName', value: { stringValue: config.displayName } },
        { name: 'description', value: config.description ? { stringValue: config.description } : { isNull: true } },
        { name: 'category', value: { stringValue: config.category } },
        { name: 'specialty', value: config.specialty ? { stringValue: config.specialty } : { isNull: true } },
        { name: 'contextWindow', value: { longValue: config.contextWindow } },
        { name: 'maxOutputTokens', value: { longValue: config.maxOutputTokens || 4096 } },
        { name: 'supportedModalities', value: { stringValue: `{${(config.supportedModalities || ['text']).join(',')}}` } },
        { name: 'capabilities', value: { stringValue: `{${(config.capabilities || []).join(',')}}` } },
        { name: 'inputCostPer1M', value: { doubleValue: config.inputCostPer1M } },
        { name: 'outputCostPer1M', value: { doubleValue: config.outputCostPer1M } },
        { name: 'isNovel', value: { booleanValue: config.isNovel || false } },
        { name: 'minTier', value: { longValue: config.minTier || 1 } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: Array<{ name: string; value: { stringValue?: string; doubleValue?: number } }> = [
      { name: 'modelId', value: { stringValue: modelId } },
    ];

    if (updates.displayName) {
      params.push({ name: 'displayName', value: { stringValue: updates.displayName } });
      setClauses.push(`display_name = $${params.length}`);
    }
    if (updates.inputCostPer1M !== undefined) {
      params.push({ name: 'inputCost', value: { doubleValue: updates.inputCostPer1M } });
      setClauses.push(`input_cost_per_1m = $${params.length}`);
    }
    if (updates.outputCostPer1M !== undefined) {
      params.push({ name: 'outputCost', value: { doubleValue: updates.outputCostPer1M } });
      setClauses.push(`output_cost_per_1m = $${params.length}`);
    }

    await executeStatement(
      `UPDATE ai_models SET ${setClauses.join(', ')} WHERE model_id = $1`,
      params as Parameters<typeof executeStatement>[1]
    );
  }

  async setModelActive(modelId: string, isActive: boolean): Promise<void> {
    await executeStatement(
      `UPDATE ai_models SET is_active = $2, updated_at = NOW() WHERE model_id = $1`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'isActive', value: { booleanValue: isActive } },
      ]
    );
  }

  async storeCredential(tenantId: string, providerId: string, apiKey: string): Promise<void> {
    // Get provider UUID
    const providerResult = await executeStatement(
      `SELECT id FROM ai_providers WHERE provider_id = $1`,
      [{ name: 'providerId', value: { stringValue: providerId } }]
    );

    if (providerResult.rows.length === 0) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const providerUuid = String((providerResult.rows[0] as Record<string, unknown>)?.id);

    // Encrypt the API key
    const encrypted = await this.encryptValue(apiKey, tenantId);

    await executeStatement(
      `INSERT INTO provider_credentials (tenant_id, provider_id, encrypted_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, provider_id) 
       DO UPDATE SET encrypted_value = $3, updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'providerUuid', value: { stringValue: providerUuid } },
        { name: 'encrypted', value: { blobValue: encrypted } },
      ]
    );
  }

  async getCredential(tenantId: string, providerId: string): Promise<string | null> {
    const result = await executeStatement(
      `SELECT pc.encrypted_value 
       FROM provider_credentials pc
       JOIN ai_providers p ON pc.provider_id = p.id
       WHERE pc.tenant_id = $1 AND p.provider_id = $2 AND pc.is_active = true`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'providerId', value: { stringValue: providerId } },
      ]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const encrypted = (result.rows[0] as Record<string, unknown>).encrypted_value as Uint8Array;
    return this.decryptValue(encrypted, tenantId);
  }

  async updateProviderHealth(providerId: string, status: 'healthy' | 'degraded' | 'unhealthy'): Promise<void> {
    await executeStatement(
      `UPDATE ai_providers SET health_status = $2, last_health_check = NOW() WHERE provider_id = $1`,
      [
        { name: 'providerId', value: { stringValue: providerId } },
        { name: 'status', value: { stringValue: status } },
      ]
    );
  }

  private async encryptValue(plaintext: string, tenantId: string): Promise<Uint8Array> {
    const keyArn = this.getKeyArnForTenant(tenantId);
    const response = await this.kms.send(
      new EncryptCommand({
        KeyId: keyArn,
        Plaintext: Buffer.from(plaintext),
      })
    );
    return response.CiphertextBlob!;
  }

  private async decryptValue(ciphertext: Uint8Array, tenantId: string): Promise<string> {
    const keyArn = this.getKeyArnForTenant(tenantId);
    const response = await this.kms.send(
      new DecryptCommand({
        KeyId: keyArn,
        CiphertextBlob: ciphertext,
      })
    );
    return Buffer.from(response.Plaintext!).toString();
  }

  private getKeyArnForTenant(tenantId: string): string {
    const accountId = process.env.AWS_ACCOUNT_ID || '000000000000';
    const region = process.env.AWS_REGION || 'us-east-1';
    return `arn:aws:kms:${region}:${accountId}:alias/radiant-${tenantId}`;
  }
}

export const providerRegistry = new ProviderRegistry();
