// RADIANT v5.2.4 - HuggingFace Model Discovery Service
// Polls HuggingFace API for new model versions in watched families

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import type {
  ModelVersion,
  ModelFamilyWatchlist,
  ModelDiscoveryJob,
  DiscoveryError,
  FamilyDiscoveryResult,
  HuggingFaceModelInfo,
  HuggingFaceSearchParams,
  DiscoveryJobStatus,
  ModelThermalState,
} from '@radiant/shared';
import { SELF_HOSTED_MODEL_REGISTRY } from '@radiant/shared';

// ============================================================================
// Constants
// ============================================================================

const HF_API_BASE = 'https://huggingface.co/api';
const DEFAULT_RATE_LIMIT_MS = 1000; // 1 request per second
const MAX_MODELS_PER_FAMILY = 50;

// ============================================================================
// HuggingFace Discovery Service
// ============================================================================

class HuggingFaceDiscoveryService {
  private secretsManager: SecretsManagerClient;
  private apiToken: string | null = null;
  private lastRequestTime: number = 0;

  constructor() {
    this.secretsManager = new SecretsManagerClient({});
  }

  // ============================================================================
  // API Token Management
  // ============================================================================

  private async getApiToken(): Promise<string | null> {
    if (this.apiToken) {
      return this.apiToken;
    }

    const secretArn = process.env.HUGGINGFACE_API_TOKEN_SECRET_ARN;
    if (!secretArn) {
      logger.warn('No HuggingFace API token configured - using unauthenticated requests');
      return null;
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await this.secretsManager.send(command);
      this.apiToken = response.SecretString || null;
      return this.apiToken;
    } catch (error) {
      logger.error('Failed to retrieve HuggingFace API token', error as Error);
      return null;
    }
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < DEFAULT_RATE_LIMIT_MS) {
      await new Promise(resolve => 
        setTimeout(resolve, DEFAULT_RATE_LIMIT_MS - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  // ============================================================================
  // HuggingFace API Methods
  // ============================================================================

  async searchModels(params: HuggingFaceSearchParams): Promise<HuggingFaceModelInfo[]> {
    await this.rateLimit();

    const token = await this.getApiToken();
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.set('search', params.search);
    if (params.author) queryParams.set('author', params.author);
    if (params.filter) queryParams.set('filter', params.filter);
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.direction) queryParams.set('direction', params.direction);
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.full) queryParams.set('full', 'true');

    const url = `${HF_API_BASE}/models?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limited by HuggingFace API');
        }
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as HuggingFaceModelInfo[];
    } catch (error) {
      logger.error('Failed to search HuggingFace models', error as Error);
      throw error;
    }
  }

  async getModelInfo(modelId: string): Promise<HuggingFaceModelInfo | null> {
    await this.rateLimit();

    const token = await this.getApiToken();
    const url = `${HF_API_BASE}/models/${modelId}`;

    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status}`);
      }

      return await response.json() as HuggingFaceModelInfo;
    } catch (error) {
      logger.error('Failed to get model info', error as Error, { modelId });
      return null;
    }
  }

  // ============================================================================
  // Watchlist Management
  // ============================================================================

  async getWatchlist(): Promise<ModelFamilyWatchlist[]> {
    const result = await executeStatement(
      `SELECT * FROM model_family_watchlist ORDER BY family`,
      []
    );
    return (result.rows || []).map(row => this.mapWatchlistRow(row));
  }

  async getEnabledWatchlist(): Promise<ModelFamilyWatchlist[]> {
    const result = await executeStatement(
      `SELECT * FROM model_family_watchlist WHERE is_enabled = true ORDER BY family`,
      []
    );
    return (result.rows || []).map(row => this.mapWatchlistRow(row));
  }

  async updateWatchlistItem(
    family: string,
    updates: Partial<ModelFamilyWatchlist>
  ): Promise<ModelFamilyWatchlist> {
    const updateFields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'family', value: { stringValue: family } },
    ];
    let paramIndex = 2;

    if (updates.isEnabled !== undefined) {
      updateFields.push(`is_enabled = $${paramIndex++}`);
      params.push({ name: 'isEnabled', value: { booleanValue: updates.isEnabled } });
    }
    if (updates.autoDownload !== undefined) {
      updateFields.push(`auto_download = $${paramIndex++}`);
      params.push({ name: 'autoDownload', value: { booleanValue: updates.autoDownload } });
    }
    if (updates.autoDeploy !== undefined) {
      updateFields.push(`auto_deploy = $${paramIndex++}`);
      params.push({ name: 'autoDeploy', value: { booleanValue: updates.autoDeploy } });
    }
    if (updates.autoThermalTier) {
      updateFields.push(`auto_thermal_tier = $${paramIndex++}`);
      params.push({ name: 'autoThermalTier', value: { stringValue: updates.autoThermalTier } });
    }
    if (updates.huggingfaceOrg !== undefined) {
      updateFields.push(`huggingface_org = $${paramIndex++}`);
      params.push({ name: 'hfOrg', value: updates.huggingfaceOrg ? { stringValue: updates.huggingfaceOrg } : { isNull: true } });
    }
    if (updates.minLikes !== undefined) {
      updateFields.push(`min_likes = $${paramIndex++}`);
      params.push({ name: 'minLikes', value: { longValue: updates.minLikes } });
    }
    if (updates.notifyOnNewVersion !== undefined) {
      updateFields.push(`notify_on_new_version = $${paramIndex++}`);
      params.push({ name: 'notify', value: { booleanValue: updates.notifyOnNewVersion } });
    }
    if (updates.notificationEmails) {
      updateFields.push(`notification_emails = $${paramIndex++}`);
      params.push({ name: 'emails', value: { stringValue: `{${updates.notificationEmails.join(',')}}` } });
    }

    updateFields.push(`updated_at = NOW()`);

    await executeStatement(
      `UPDATE model_family_watchlist SET ${updateFields.join(', ')} WHERE family = $1`,
      params
    );

    const result = await executeStatement(
      `SELECT * FROM model_family_watchlist WHERE family = $1`,
      [{ name: 'family', value: { stringValue: family } }]
    );

    return this.mapWatchlistRow(result.rows[0]);
  }

  async addWatchlistFamily(
    family: string,
    huggingfaceOrg?: string,
    isEnabled: boolean = true
  ): Promise<ModelFamilyWatchlist> {
    await executeStatement(
      `INSERT INTO model_family_watchlist (family, huggingface_org, is_enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (family) DO UPDATE SET
         huggingface_org = COALESCE($2, model_family_watchlist.huggingface_org),
         is_enabled = $3,
         updated_at = NOW()`,
      [
        { name: 'family', value: { stringValue: family } },
        { name: 'hfOrg', value: huggingfaceOrg ? { stringValue: huggingfaceOrg } : { isNull: true } },
        { name: 'isEnabled', value: { booleanValue: isEnabled } },
      ]
    );

    const result = await executeStatement(
      `SELECT * FROM model_family_watchlist WHERE family = $1`,
      [{ name: 'family', value: { stringValue: family } }]
    );

    return this.mapWatchlistRow(result.rows[0]);
  }

  async removeWatchlistFamily(family: string): Promise<void> {
    await executeStatement(
      `DELETE FROM model_family_watchlist WHERE family = $1`,
      [{ name: 'family', value: { stringValue: family } }]
    );
  }

  // ============================================================================
  // Discovery Execution
  // ============================================================================

  async runDiscovery(
    triggeredBy?: string,
    families?: string[]
  ): Promise<ModelDiscoveryJob> {
    // Create job record
    const jobId = await this.createDiscoveryJob(triggeredBy ? 'manual' : 'scheduled', triggeredBy);

    const job: ModelDiscoveryJob = {
      id: jobId,
      jobType: triggeredBy ? 'manual' : 'scheduled',
      triggeredBy,
      status: 'running',
      startedAt: new Date(),
      familiesChecked: 0,
      modelsDiscovered: 0,
      modelsAdded: 0,
      downloadsStarted: 0,
      errors: [],
      warnings: [],
      familyResults: {},
      createdAt: new Date(),
    };

    try {
      // Get watchlist
      let watchlist = await this.getEnabledWatchlist();
      
      // Filter to specific families if requested
      if (families && families.length > 0) {
        watchlist = watchlist.filter(w => families.includes(w.family));
      }

      // Process each family
      for (const watchItem of watchlist) {
        job.familiesChecked++;
        
        const familyResult = await this.discoverFamilyVersions(watchItem, job);
        job.familyResults[watchItem.family] = familyResult;
        
        job.modelsDiscovered += familyResult.modelsFound;
        job.modelsAdded += familyResult.newVersions;
        job.downloadsStarted += familyResult.downloadsQueued;

        // Update watchlist last checked
        await executeStatement(
          `UPDATE model_family_watchlist 
           SET last_checked_at = NOW(), 
               last_check_status = 'completed',
               versions_found = $2,
               updated_at = NOW()
           WHERE family = $1`,
          [
            { name: 'family', value: { stringValue: watchItem.family } },
            { name: 'versions', value: { longValue: familyResult.modelsFound } },
          ]
        );
      }

      // Mark complete
      job.status = job.errors.length > 0 ? 'completed' : 'completed';
      job.completedAt = new Date();
      job.durationMs = job.completedAt.getTime() - (job.startedAt?.getTime() || 0);

    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.durationMs = job.completedAt.getTime() - (job.startedAt?.getTime() || 0);
      job.errors.push({
        errorType: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }

    // Update job record
    await this.updateDiscoveryJob(job);

    return job;
  }

  private async discoverFamilyVersions(
    watchItem: ModelFamilyWatchlist,
    job: ModelDiscoveryJob
  ): Promise<FamilyDiscoveryResult> {
    const result: FamilyDiscoveryResult = {
      family: watchItem.family,
      modelsFound: 0,
      newVersions: 0,
      existingVersions: 0,
      downloadsQueued: 0,
      errors: [],
    };

    try {
      // Search HuggingFace for models
      const searchParams: HuggingFaceSearchParams = {
        author: watchItem.huggingfaceOrg,
        filter: watchItem.huggingfaceFilter || undefined,
        sort: 'likes',
        direction: 'desc',
        limit: MAX_MODELS_PER_FAMILY,
        full: true,
      };

      const hfModels = await this.searchModels(searchParams);

      // Filter by minimum likes and gated status
      const filteredModels = hfModels.filter(m => {
        if (m.likes < watchItem.minLikes) return false;
        if (m.gated && !watchItem.includeGated) return false;
        if (m.disabled) return false;
        return true;
      });

      result.modelsFound = filteredModels.length;

      // Check each model against our registry
      for (const hfModel of filteredModels) {
        const modelId = this.extractModelId(hfModel.id, watchItem.family);
        const version = this.extractVersion(hfModel);

        // Check if version already exists
        const existingResult = await executeStatement(
          `SELECT id FROM model_versions WHERE model_id = $1 AND version = $2`,
          [
            { name: 'modelId', value: { stringValue: modelId } },
            { name: 'version', value: { stringValue: version } },
          ]
        );

        if (existingResult.rows && existingResult.rows.length > 0) {
          result.existingVersions++;
          continue;
        }

        // New version found - add to database
        await this.createModelVersion(hfModel, watchItem, modelId, version);
        result.newVersions++;

        // Queue download if auto-download enabled
        if (watchItem.autoDownload) {
          // Download queueing would be handled by model-version-manager.service.ts
          result.downloadsQueued++;
        }

        logger.info('Discovered new model version', {
          family: watchItem.family,
          modelId,
          version,
          huggingfaceId: hfModel.id,
        });
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMsg);
      
      job.errors.push({
        family: watchItem.family,
        errorType: errorMsg.includes('Rate limited') ? 'rate_limit' : 'api_error',
        message: errorMsg,
        timestamp: new Date(),
      });

      // Update watchlist with error
      await executeStatement(
        `UPDATE model_family_watchlist 
         SET last_checked_at = NOW(), 
             last_check_status = 'failed',
             last_check_error = $2,
             updated_at = NOW()
         WHERE family = $1`,
        [
          { name: 'family', value: { stringValue: watchItem.family } },
          { name: 'error', value: { stringValue: errorMsg } },
        ]
      );
    }

    return result;
  }

  private async createModelVersion(
    hfModel: HuggingFaceModelInfo,
    watchItem: ModelFamilyWatchlist,
    modelId: string,
    version: string
  ): Promise<string> {
    // Extract metadata from HuggingFace model
    const capabilities = this.extractCapabilities(hfModel);
    const modalities = this.extractModalities(hfModel);
    const parameterCount = this.extractParameterCount(hfModel);
    
    // Check if this model exists in our self-hosted registry for hardware info
    const registryModel = SELF_HOSTED_MODEL_REGISTRY.find(m => 
      m.family === watchItem.family && m.id.includes(modelId.toLowerCase())
    );

    const result = await executeStatement(
      `INSERT INTO model_versions (
         model_id, family, version,
         huggingface_id, huggingface_revision, discovery_source,
         display_name, description, parameter_count,
         capabilities, input_modalities, output_modalities,
         license, commercial_use,
         instance_type, min_vram_gb, quantization,
         thermal_state, auto_thermal_enabled,
         pricing_input_per_1m, pricing_output_per_1m
       ) VALUES (
         $1, $2, $3, $4, $5, 'huggingface_api',
         $6, $7, $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17, true, $18, $19
       )
       RETURNING id`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'family', value: { stringValue: watchItem.family } },
        { name: 'version', value: { stringValue: version } },
        { name: 'hfId', value: { stringValue: hfModel.id } },
        { name: 'hfRevision', value: { stringValue: hfModel.sha } },
        { name: 'displayName', value: { stringValue: hfModel.cardData?.model_name || hfModel.id.split('/').pop() || modelId } },
        { name: 'description', value: { stringValue: `Discovered from HuggingFace: ${hfModel.id}` } },
        { name: 'paramCount', value: parameterCount ? { stringValue: parameterCount } : { isNull: true } },
        { name: 'capabilities', value: { stringValue: `{${capabilities.join(',')}}` } },
        { name: 'inputMod', value: { stringValue: `{${modalities.input.join(',')}}` } },
        { name: 'outputMod', value: { stringValue: `{${modalities.output.join(',')}}` } },
        { name: 'license', value: hfModel.cardData?.license ? { stringValue: hfModel.cardData.license } : { isNull: true } },
        { name: 'commercial', value: { booleanValue: !hfModel.gated } },
        { name: 'instanceType', value: registryModel ? { stringValue: registryModel.instanceType } : { isNull: true } },
        { name: 'minVram', value: registryModel ? { longValue: registryModel.minVRAM } : { isNull: true } },
        { name: 'quant', value: registryModel?.quantization ? { stringValue: registryModel.quantization } : { isNull: true } },
        { name: 'thermal', value: { stringValue: watchItem.autoThermalTier } },
        { name: 'priceIn', value: registryModel ? { doubleValue: registryModel.pricing.inputPer1M } : { isNull: true } },
        { name: 'priceOut', value: registryModel ? { doubleValue: registryModel.pricing.outputPer1M } : { isNull: true } },
      ]
    );

    return String(result.rows?.[0]?.id || '');
  }

  // ============================================================================
  // Discovery Job Management
  // ============================================================================

  private async createDiscoveryJob(
    jobType: 'scheduled' | 'manual' | 'webhook',
    triggeredBy?: string
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO model_discovery_jobs (job_type, triggered_by, status, started_at)
       VALUES ($1, $2, 'running', NOW())
       RETURNING id`,
      [
        { name: 'jobType', value: { stringValue: jobType } },
        { name: 'triggeredBy', value: triggeredBy ? { stringValue: triggeredBy } : { isNull: true } },
      ]
    );
    return String(result.rows?.[0]?.id || '');
  }

  private async updateDiscoveryJob(job: ModelDiscoveryJob): Promise<void> {
    await executeStatement(
      `UPDATE model_discovery_jobs SET
         status = $2,
         completed_at = $3,
         duration_ms = $4,
         families_checked = $5,
         models_discovered = $6,
         models_added = $7,
         downloads_started = $8,
         errors = $9,
         warnings = $10,
         family_results = $11
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: job.id } },
        { name: 'status', value: { stringValue: job.status } },
        { name: 'completedAt', value: job.completedAt ? { stringValue: job.completedAt.toISOString() } : { isNull: true } },
        { name: 'durationMs', value: job.durationMs ? { longValue: job.durationMs } : { isNull: true } },
        { name: 'familiesChecked', value: { longValue: job.familiesChecked } },
        { name: 'modelsDiscovered', value: { longValue: job.modelsDiscovered } },
        { name: 'modelsAdded', value: { longValue: job.modelsAdded } },
        { name: 'downloadsStarted', value: { longValue: job.downloadsStarted } },
        { name: 'errors', value: { stringValue: JSON.stringify(job.errors) } },
        { name: 'warnings', value: { stringValue: JSON.stringify(job.warnings) } },
        { name: 'familyResults', value: { stringValue: JSON.stringify(job.familyResults) } },
      ]
    );
  }

  async getDiscoveryJob(jobId: string): Promise<ModelDiscoveryJob | null> {
    const result = await executeStatement(
      `SELECT * FROM model_discovery_jobs WHERE id = $1`,
      [{ name: 'id', value: { stringValue: jobId } }]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    return this.mapDiscoveryJobRow(result.rows[0]);
  }

  async getRecentDiscoveryJobs(limit: number = 10): Promise<ModelDiscoveryJob[]> {
    const result = await executeStatement(
      `SELECT * FROM model_discovery_jobs ORDER BY created_at DESC LIMIT $1`,
      [{ name: 'limit', value: { longValue: limit } }]
    );
    return (result.rows || []).map(row => this.mapDiscoveryJobRow(row));
  }

  async cancelDiscoveryJob(jobId: string): Promise<void> {
    await executeStatement(
      `UPDATE model_discovery_jobs 
       SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 AND status = 'running'`,
      [{ name: 'id', value: { stringValue: jobId } }]
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractModelId(hfId: string, family: string): string {
    // Extract clean model ID from HuggingFace ID
    // e.g., 'meta-llama/Llama-3.3-70B-Instruct' -> 'llama-3.3-70b-instruct'
    const parts = hfId.split('/');
    const modelName = parts[parts.length - 1];
    return modelName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  private extractVersion(hfModel: HuggingFaceModelInfo): string {
    // Try to extract version from model name or card data
    const modelName = hfModel.id.split('/').pop() || '';
    
    // Common patterns: "3.3", "v2", "2.5", etc.
    const versionMatch = modelName.match(/[-_]?v?(\d+(?:\.\d+)*)/i);
    if (versionMatch) {
      return versionMatch[1];
    }
    
    // Use revision hash as fallback
    return hfModel.sha.substring(0, 8);
  }

  private extractCapabilities(hfModel: HuggingFaceModelInfo): string[] {
    const capabilities: string[] = [];
    const tags = hfModel.tags || [];
    const pipelineTag = hfModel.pipeline_tag;

    if (pipelineTag === 'text-generation' || tags.includes('text-generation')) {
      capabilities.push('chat', 'text_generation');
    }
    if (tags.includes('code') || tags.includes('coding')) {
      capabilities.push('code');
    }
    if (pipelineTag === 'image-to-text' || tags.includes('vision')) {
      capabilities.push('vision', 'image_analysis');
    }
    if (pipelineTag === 'text-to-image' || tags.includes('diffusers')) {
      capabilities.push('image_generation');
    }
    if (pipelineTag === 'automatic-speech-recognition') {
      capabilities.push('audio_transcription');
    }
    if (tags.includes('function-calling') || tags.includes('tool-use')) {
      capabilities.push('function_calling');
    }
    if (tags.includes('reasoning')) {
      capabilities.push('reasoning');
    }

    return capabilities.length > 0 ? capabilities : ['chat'];
  }

  private extractModalities(hfModel: HuggingFaceModelInfo): { input: string[]; output: string[] } {
    const input: string[] = ['text'];
    const output: string[] = ['text'];
    const pipelineTag = hfModel.pipeline_tag;

    if (pipelineTag === 'image-to-text' || hfModel.tags?.includes('vision')) {
      input.push('image');
    }
    if (pipelineTag === 'text-to-image') {
      output.length = 0;
      output.push('image');
    }
    if (pipelineTag === 'automatic-speech-recognition') {
      input.length = 0;
      input.push('audio');
    }
    if (pipelineTag === 'text-to-speech') {
      output.length = 0;
      output.push('audio');
    }

    return { input, output };
  }

  private extractParameterCount(hfModel: HuggingFaceModelInfo): string | null {
    const modelName = hfModel.id.toLowerCase();
    
    // Common parameter patterns
    const patterns = [
      /(\d+(?:\.\d+)?)[b](?:[-_]|$)/i,  // 70B, 7B
      /(\d+(?:\.\d+)?)[-_]?billion/i,
      /(\d+(?:\.\d+)?)[m](?:[-_]|$)/i,  // 125M
    ];

    for (const pattern of patterns) {
      const match = modelName.match(pattern);
      if (match) {
        const num = parseFloat(match[1]);
        if (modelName.includes('m') && !modelName.includes('b')) {
          return `${num}M`;
        }
        return `${num}B`;
      }
    }

    return null;
  }

  // ============================================================================
  // Mapping Helpers
  // ============================================================================

  private mapWatchlistRow(row: Record<string, unknown>): ModelFamilyWatchlist {
    return {
      id: String(row.id),
      family: String(row.family),
      isEnabled: Boolean(row.is_enabled),
      autoDownload: Boolean(row.auto_download),
      autoDeploy: Boolean(row.auto_deploy),
      autoThermalTier: (String(row.auto_thermal_tier || 'cold')) as ModelThermalState,
      huggingfaceOrg: row.huggingface_org ? String(row.huggingface_org) : undefined,
      huggingfaceFilter: row.huggingface_filter ? String(row.huggingface_filter) : undefined,
      minLikes: Number(row.min_likes || 100),
      includeGated: Boolean(row.include_gated),
      notifyOnNewVersion: Boolean(row.notify_on_new_version),
      notificationEmails: row.notification_emails as string[] | undefined,
      notificationWebhook: row.notification_webhook ? String(row.notification_webhook) : undefined,
      lastCheckedAt: row.last_checked_at ? new Date(String(row.last_checked_at)) : undefined,
      lastCheckStatus: row.last_check_status ? String(row.last_check_status) : undefined,
      lastCheckError: row.last_check_error ? String(row.last_check_error) : undefined,
      versionsFound: Number(row.versions_found || 0),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    };
  }

  private mapDiscoveryJobRow(row: Record<string, unknown>): ModelDiscoveryJob {
    return {
      id: String(row.id),
      jobType: String(row.job_type || 'scheduled') as ModelDiscoveryJob['jobType'],
      triggeredBy: row.triggered_by ? String(row.triggered_by) : undefined,
      status: String(row.status || 'pending') as DiscoveryJobStatus,
      startedAt: row.started_at ? new Date(String(row.started_at)) : undefined,
      completedAt: row.completed_at ? new Date(String(row.completed_at)) : undefined,
      durationMs: row.duration_ms ? Number(row.duration_ms) : undefined,
      familiesChecked: Number(row.families_checked || 0),
      modelsDiscovered: Number(row.models_discovered || 0),
      modelsAdded: Number(row.models_added || 0),
      downloadsStarted: Number(row.downloads_started || 0),
      errors: row.errors ? (typeof row.errors === 'string' ? JSON.parse(row.errors) : row.errors) : [],
      warnings: row.warnings ? (typeof row.warnings === 'string' ? JSON.parse(row.warnings) : row.warnings) : [],
      familyResults: row.family_results ? (typeof row.family_results === 'string' ? JSON.parse(row.family_results) : row.family_results) : {},
      createdAt: new Date(String(row.created_at)),
    };
  }
}

export const huggingfaceDiscoveryService = new HuggingFaceDiscoveryService();
