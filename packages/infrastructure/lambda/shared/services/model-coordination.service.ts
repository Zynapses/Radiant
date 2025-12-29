// RADIANT v4.18.0 - Model Coordination Service
// Coordinates communication between hosted and self-hosted AI models
// Includes timed sync, auto-discovery, and endpoint management

import { executeStatement } from '../utils/database';
import type {
  ModelEndpoint,
  ModelRegistryEntry,
  SyncConfig,
  SyncJob,
  SyncStatus,
  NewModelDetection,
  SyncDashboard,
} from '@radiant/shared';
import { SELF_HOSTED_MODEL_REGISTRY } from '@radiant/shared';
import { modelProficiencyService } from './model-proficiency.service';
import { inferenceComponentsService } from './inference-components.service';

// ============================================================================
// Model Coordination Service
// ============================================================================

class ModelCoordinationService {
  
  // ============================================================================
  // Sync Configuration
  // ============================================================================
  
  /**
   * Get sync configuration (global or tenant-specific)
   */
  async getSyncConfig(tenantId?: string): Promise<SyncConfig> {
    const result = await executeStatement(
      `SELECT * FROM model_sync_config 
       WHERE tenant_id IS NOT DISTINCT FROM $1`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );
    
    if (!result.records || result.records.length === 0) {
      // Return default config
      return this.getDefaultSyncConfig(tenantId);
    }
    
    return this.mapSyncConfig(result.records[0]);
  }
  
  /**
   * Update sync configuration
   */
  async updateSyncConfig(
    tenantId: string | undefined,
    updates: Partial<SyncConfig>
  ): Promise<SyncConfig> {
    const current = await this.getSyncConfig(tenantId);
    const merged = { ...current, ...updates };
    
    await executeStatement(
      `INSERT INTO model_sync_config (
         tenant_id, auto_sync_enabled, sync_interval_minutes,
         sync_external_providers, sync_self_hosted_models, sync_from_huggingface,
         auto_discovery_enabled, auto_generate_proficiencies,
         notify_on_new_model, notify_on_model_removed, notify_on_sync_failure,
         notification_emails, notification_webhook
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (tenant_id) DO UPDATE SET
         auto_sync_enabled = $2,
         sync_interval_minutes = $3,
         sync_external_providers = $4,
         sync_self_hosted_models = $5,
         sync_from_huggingface = $6,
         auto_discovery_enabled = $7,
         auto_generate_proficiencies = $8,
         notify_on_new_model = $9,
         notify_on_model_removed = $10,
         notify_on_sync_failure = $11,
         notification_emails = $12,
         notification_webhook = $13,
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'autoSync', value: { booleanValue: merged.autoSyncEnabled } },
        { name: 'interval', value: { longValue: merged.syncIntervalMinutes } },
        { name: 'syncExternal', value: { booleanValue: merged.syncExternalProviders } },
        { name: 'syncSelfHosted', value: { booleanValue: merged.syncSelfHostedModels } },
        { name: 'syncHuggingFace', value: { booleanValue: merged.syncFromHuggingFace } },
        { name: 'autoDiscovery', value: { booleanValue: merged.autoDiscoveryEnabled } },
        { name: 'autoProficiency', value: { booleanValue: merged.autoGenerateProficiencies } },
        { name: 'notifyNew', value: { booleanValue: merged.notifyOnNewModel } },
        { name: 'notifyRemoved', value: { booleanValue: merged.notifyOnModelRemoved } },
        { name: 'notifyFail', value: { booleanValue: merged.notifyOnSyncFailure } },
        { name: 'emails', value: merged.notificationEmails ? { stringValue: JSON.stringify(merged.notificationEmails) } : { isNull: true } },
        { name: 'webhook', value: merged.notificationWebhook ? { stringValue: merged.notificationWebhook } : { isNull: true } },
      ]
    );
    
    return this.getSyncConfig(tenantId);
  }
  
  private getDefaultSyncConfig(tenantId?: string): SyncConfig {
    return {
      id: 'default',
      tenantId,
      autoSyncEnabled: true,
      syncIntervalMinutes: 60, // Hourly by default
      syncExternalProviders: true,
      syncSelfHostedModels: true,
      syncFromHuggingFace: false,
      autoDiscoveryEnabled: true,
      autoGenerateProficiencies: true,
      notifyOnNewModel: true,
      notifyOnModelRemoved: false,
      notifyOnSyncFailure: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  
  // ============================================================================
  // Sync Execution
  // ============================================================================
  
  /**
   * Execute a full sync job
   */
  async executeSync(
    tenantId: string | undefined,
    triggerType: 'scheduled' | 'manual' | 'new_model' | 'webhook',
    triggeredBy?: string
  ): Promise<SyncJob> {
    const config = await this.getSyncConfig(tenantId);
    const jobId = await this.createSyncJob(config.id, triggerType, triggeredBy);
    
    const job: SyncJob = {
      id: jobId,
      configId: config.id,
      triggerType,
      triggeredBy,
      status: 'running',
      startedAt: new Date(),
      modelsScanned: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsRemoved: 0,
      endpointsUpdated: 0,
      proficienciesGenerated: 0,
      errors: [],
      warnings: [],
    };
    
    try {
      // Sync self-hosted models from code registry
      if (config.syncSelfHostedModels) {
        const selfHostedResult = await this.syncSelfHostedModels();
        job.modelsScanned += selfHostedResult.scanned;
        job.modelsAdded += selfHostedResult.added;
        job.modelsUpdated += selfHostedResult.updated;
        job.endpointsUpdated += selfHostedResult.endpointsUpdated;
        
        if (config.autoGenerateProficiencies && selfHostedResult.added > 0) {
          const profResult = await modelProficiencyService.syncToDatabase();
          job.proficienciesGenerated = profResult.added + profResult.updated;
        }
      }
      
      // Sync external providers (check health, update endpoints)
      if (config.syncExternalProviders) {
        const externalResult = await this.syncExternalProviders();
        job.modelsScanned += externalResult.scanned;
        job.modelsUpdated += externalResult.updated;
        job.endpointsUpdated += externalResult.endpointsUpdated;
        job.errors.push(...externalResult.errors);
      }
      
      // Mark complete
      job.status = job.errors.length > 0 ? 'partial' : 'completed';
      job.completedAt = new Date();
      job.durationMs = job.completedAt.getTime() - job.startedAt.getTime();
      
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.durationMs = job.completedAt.getTime() - job.startedAt.getTime();
      job.errors.push({
        errorType: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }
    
    // Update job in database
    await this.updateSyncJob(job);
    
    // Update config with last sync info
    await this.updateSyncConfigAfterJob(config.id, job);
    
    return job;
  }
  
  /**
   * Sync self-hosted models from code registry to database
   */
  private async syncSelfHostedModels(): Promise<{
    scanned: number;
    added: number;
    updated: number;
    endpointsUpdated: number;
  }> {
    const result = { scanned: 0, added: 0, updated: 0, endpointsUpdated: 0 };
    
    for (const model of SELF_HOSTED_MODEL_REGISTRY) {
      result.scanned++;
      
      // Check if model exists in registry
      const existing = await this.getRegistryEntry(model.id);
      
      if (!existing) {
        // Add new model
        await this.createRegistryEntry({
          modelId: model.id,
          source: 'self-hosted',
          provider: 'sagemaker',
          family: model.family,
          capabilities: model.capabilities,
          inputModalities: model.inputModalities,
          outputModalities: model.outputModalities,
          status: 'active',
        });
        result.added++;
        
        // Create default endpoint
        await this.createEndpoint({
          modelId: model.id,
          endpointType: 'sagemaker',
          baseUrl: '', // Will be populated when deployed
          method: 'POST',
          authMethod: 'aws_sig_v4',
          healthStatus: 'unknown',
          priority: 1,
          isActive: true,
        });
        result.endpointsUpdated++;
        
        // Log discovery
        await modelProficiencyService.logModelDiscovery(model.id, 'registry_sync');
        
        // Auto-tier new self-hosted model for inference components
        try {
          await inferenceComponentsService.autoTierNewModel(model.id, 'default');
        } catch (tierError) {
          // Non-fatal - model sync should succeed even if tiering fails
          console.warn('Failed to auto-tier model:', model.id, tierError);
        }
        
      } else {
        // Update existing
        await this.updateRegistryEntry(model.id, {
          capabilities: model.capabilities,
          inputModalities: model.inputModalities,
          outputModalities: model.outputModalities,
        });
        result.updated++;
      }
    }
    
    return result;
  }
  
  /**
   * Sync external providers (check health, update status)
   */
  private async syncExternalProviders(): Promise<{
    scanned: number;
    updated: number;
    endpointsUpdated: number;
    errors: Array<{ errorType: string; message: string; timestamp: Date }>;
  }> {
    const result = { scanned: 0, updated: 0, endpointsUpdated: 0, errors: [] as Array<{ errorType: string; message: string; timestamp: Date }> };
    
    // Get all external endpoints
    const endpointsResult = await executeStatement(
      `SELECT me.* FROM model_endpoints me
       JOIN model_registry mr ON me.model_id = mr.model_id
       WHERE mr.source = 'external' AND me.is_active = true`,
      []
    );
    
    for (const row of endpointsResult.records || []) {
      result.scanned++;
      
      const endpoint = this.mapEndpointRow(row);
      
      // Check health if health check URL configured
      if (endpoint.healthCheckUrl) {
        try {
          const healthStatus = await this.checkEndpointHealth(endpoint);
          
          if (healthStatus !== endpoint.healthStatus) {
            await this.updateEndpointHealth(endpoint.id, healthStatus);
            result.endpointsUpdated++;
          }
        } catch (error) {
          result.errors.push({
            errorType: 'connection',
            message: `Health check failed for ${endpoint.modelId}: ${error instanceof Error ? error.message : 'Unknown'}`,
            timestamp: new Date(),
          });
        }
      }
    }
    
    return result;
  }
  
  /**
   * Check endpoint health
   */
  private async checkEndpointHealth(
    endpoint: ModelEndpoint
  ): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    // In real implementation, would make HTTP request to health check URL
    // For now, return current status
    return endpoint.healthStatus === 'unknown' ? 'healthy' : endpoint.healthStatus as 'healthy' | 'degraded' | 'unhealthy';
  }
  
  // ============================================================================
  // Model Registry CRUD
  // ============================================================================
  
  /**
   * Get registry entry by model ID
   */
  async getRegistryEntry(modelId: string): Promise<ModelRegistryEntry | null> {
    const result = await executeStatement(
      `SELECT mr.*, 
         (SELECT json_agg(me.*) FROM model_endpoints me WHERE me.model_id = mr.model_id) as endpoints
       FROM model_registry mr
       WHERE mr.model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );
    
    if (!result.records || result.records.length === 0) {
      return null;
    }
    
    return this.mapRegistryEntry(result.records[0]);
  }
  
  /**
   * Get all registry entries
   */
  async getAllRegistryEntries(options: {
    source?: 'external' | 'self-hosted';
    status?: 'active' | 'inactive' | 'deprecated';
    limit?: number;
    offset?: number;
  } = {}): Promise<ModelRegistryEntry[]> {
    let sql = `SELECT mr.*, 
         (SELECT json_agg(me.*) FROM model_endpoints me WHERE me.model_id = mr.model_id) as endpoints
       FROM model_registry mr WHERE 1=1`;
    const params: Array<{ name: string; value: Record<string, unknown> }> = [];
    let paramIndex = 1;
    
    if (options.source) {
      sql += ` AND mr.source = $${paramIndex++}`;
      params.push({ name: 'source', value: { stringValue: options.source } });
    }
    
    if (options.status) {
      sql += ` AND mr.status = $${paramIndex++}`;
      params.push({ name: 'status', value: { stringValue: options.status } });
    }
    
    sql += ` ORDER BY mr.routing_priority DESC, mr.created_at DESC`;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push({ name: 'limit', value: { longValue: options.limit || 100 } });
    params.push({ name: 'offset', value: { longValue: options.offset || 0 } });
    
    const result = await executeStatement(sql, params);
    
    return (result.records || []).map(row => this.mapRegistryEntry(row));
  }
  
  /**
   * Create registry entry
   */
  async createRegistryEntry(entry: {
    modelId: string;
    source: 'external' | 'self-hosted' | 'hybrid';
    provider: string;
    family: string;
    capabilities: string[];
    inputModalities: string[];
    outputModalities: string[];
    status?: 'active' | 'inactive' | 'deprecated' | 'pending';
  }): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO model_registry (
         model_id, source, provider, family,
         capabilities, input_modalities, output_modalities,
         status, last_synced_at, sync_source
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'registry_sync')
       RETURNING id`,
      [
        { name: 'modelId', value: { stringValue: entry.modelId } },
        { name: 'source', value: { stringValue: entry.source } },
        { name: 'provider', value: { stringValue: entry.provider } },
        { name: 'family', value: { stringValue: entry.family } },
        { name: 'capabilities', value: { stringValue: `{${entry.capabilities.join(',')}}` } },
        { name: 'inputModalities', value: { stringValue: `{${entry.inputModalities.join(',')}}` } },
        { name: 'outputModalities', value: { stringValue: `{${entry.outputModalities.join(',')}}` } },
        { name: 'status', value: { stringValue: entry.status || 'active' } },
      ]
    );
    
    return result.records?.[0]?.[0]?.stringValue || '';
  }
  
  /**
   * Update registry entry
   */
  async updateRegistryEntry(
    modelId: string,
    updates: Partial<ModelRegistryEntry>
  ): Promise<void> {
    const updateFields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'modelId', value: { stringValue: modelId } },
    ];
    
    if (updates.capabilities) {
      updateFields.push(`capabilities = $${params.length + 1}`);
      params.push({ name: 'capabilities', value: { stringValue: `{${updates.capabilities.join(',')}}` } });
    }
    if (updates.inputModalities) {
      updateFields.push(`input_modalities = $${params.length + 1}`);
      params.push({ name: 'inputModalities', value: { stringValue: `{${updates.inputModalities.join(',')}}` } });
    }
    if (updates.outputModalities) {
      updateFields.push(`output_modalities = $${params.length + 1}`);
      params.push({ name: 'outputModalities', value: { stringValue: `{${updates.outputModalities.join(',')}}` } });
    }
    if (updates.status) {
      updateFields.push(`status = $${params.length + 1}`);
      params.push({ name: 'status', value: { stringValue: updates.status } });
    }
    
    updateFields.push(`last_synced_at = NOW()`);
    updateFields.push(`updated_at = NOW()`);
    
    if (updateFields.length > 0) {
      await executeStatement(
        `UPDATE model_registry SET ${updateFields.join(', ')} WHERE model_id = $1`,
        params
      );
    }
  }
  
  // ============================================================================
  // Endpoint Management
  // ============================================================================
  
  /**
   * Create endpoint for a model
   */
  async createEndpoint(endpoint: Partial<ModelEndpoint> & { modelId: string }): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO model_endpoints (
         model_id, endpoint_type, base_url, path, method,
         auth_method, auth_config, request_format, response_format,
         rate_limit_rpm, rate_limit_tpm, max_concurrent, timeout_ms,
         health_check_url, health_status, priority, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [
        { name: 'modelId', value: { stringValue: endpoint.modelId } },
        { name: 'endpointType', value: { stringValue: endpoint.endpointType || 'custom_rest' } },
        { name: 'baseUrl', value: { stringValue: endpoint.baseUrl || '' } },
        { name: 'path', value: endpoint.path ? { stringValue: endpoint.path } : { isNull: true } },
        { name: 'method', value: { stringValue: endpoint.method || 'POST' } },
        { name: 'authMethod', value: { stringValue: endpoint.authMethod || 'api_key' } },
        { name: 'authConfig', value: endpoint.authConfig ? { stringValue: JSON.stringify(endpoint.authConfig) } : { isNull: true } },
        { name: 'requestFormat', value: endpoint.requestFormat ? { stringValue: JSON.stringify(endpoint.requestFormat) } : { isNull: true } },
        { name: 'responseFormat', value: endpoint.responseFormat ? { stringValue: JSON.stringify(endpoint.responseFormat) } : { isNull: true } },
        { name: 'rateLimitRpm', value: endpoint.rateLimitRpm ? { longValue: endpoint.rateLimitRpm } : { isNull: true } },
        { name: 'rateLimitTpm', value: endpoint.rateLimitTpm ? { longValue: endpoint.rateLimitTpm } : { isNull: true } },
        { name: 'maxConcurrent', value: endpoint.maxConcurrent ? { longValue: endpoint.maxConcurrent } : { isNull: true } },
        { name: 'timeoutMs', value: endpoint.timeoutMs ? { longValue: endpoint.timeoutMs } : { isNull: true } },
        { name: 'healthCheckUrl', value: endpoint.healthCheckUrl ? { stringValue: endpoint.healthCheckUrl } : { isNull: true } },
        { name: 'healthStatus', value: { stringValue: endpoint.healthStatus || 'unknown' } },
        { name: 'priority', value: { longValue: endpoint.priority || 1 } },
        { name: 'isActive', value: { booleanValue: endpoint.isActive !== false } },
      ]
    );
    
    return result.records?.[0]?.[0]?.stringValue || '';
  }
  
  /**
   * Update endpoint health status
   */
  async updateEndpointHealth(
    endpointId: string,
    healthStatus: 'healthy' | 'degraded' | 'unhealthy'
  ): Promise<void> {
    await executeStatement(
      `UPDATE model_endpoints SET
         health_status = $2,
         last_health_check = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: endpointId } },
        { name: 'status', value: { stringValue: healthStatus } },
      ]
    );
  }
  
  // ============================================================================
  // New Model Detection
  // ============================================================================
  
  /**
   * Detect a new model (called when unknown model is encountered)
   */
  async detectNewModel(
    modelId: string,
    source: 'api_call' | 'health_check' | 'provider_sync' | 'huggingface' | 'manual',
    info?: { provider?: string; family?: string; capabilities?: string[] }
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO new_model_detections (
         model_id, detection_source, provider, family, capabilities, processed
       ) VALUES ($1, $2, $3, $4, $5, false)
       ON CONFLICT (model_id) DO UPDATE SET
         detection_source = $2,
         detected_at = NOW()
       RETURNING id`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'source', value: { stringValue: source } },
        { name: 'provider', value: info?.provider ? { stringValue: info.provider } : { isNull: true } },
        { name: 'family', value: info?.family ? { stringValue: info.family } : { isNull: true } },
        { name: 'capabilities', value: info?.capabilities ? { stringValue: `{${info.capabilities.join(',')}}` } : { isNull: true } },
      ]
    );
    
    const detectionId = result.records?.[0]?.[0]?.stringValue || '';
    
    // Trigger sync if auto-discovery enabled
    const config = await this.getSyncConfig();
    if (config.autoDiscoveryEnabled) {
      // Queue async sync
      await this.executeSync(undefined, 'new_model');
    }
    
    return detectionId;
  }
  
  /**
   * Get pending model detections
   */
  async getPendingDetections(): Promise<NewModelDetection[]> {
    const result = await executeStatement(
      `SELECT * FROM new_model_detections WHERE processed = false ORDER BY detected_at DESC`,
      []
    );
    
    return (result.records || []).map(row => this.mapDetection(row));
  }
  
  // ============================================================================
  // Dashboard
  // ============================================================================
  
  /**
   * Get sync dashboard data
   */
  async getDashboard(tenantId?: string): Promise<SyncDashboard> {
    const config = await this.getSyncConfig(tenantId);
    
    // Get last sync job
    const lastJobResult = await executeStatement(
      `SELECT * FROM model_sync_jobs WHERE config_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [{ name: 'configId', value: { stringValue: config.id } }]
    );
    
    // Get recent jobs
    const recentJobsResult = await executeStatement(
      `SELECT * FROM model_sync_jobs WHERE config_id = $1 ORDER BY started_at DESC LIMIT 10`,
      [{ name: 'configId', value: { stringValue: config.id } }]
    );
    
    // Get registry stats
    const statsResult = await executeStatement(
      `SELECT
         COUNT(*) as total_models,
         COUNT(*) FILTER (WHERE source = 'external') as external_models,
         COUNT(*) FILTER (WHERE source = 'self-hosted') as self_hosted_models
       FROM model_registry WHERE status = 'active'`,
      []
    );
    
    const endpointStatsResult = await executeStatement(
      `SELECT
         COUNT(*) as total_endpoints,
         COUNT(*) FILTER (WHERE health_status = 'healthy') as healthy_endpoints
       FROM model_endpoints WHERE is_active = true`,
      []
    );
    
    // Get pending detections
    const pendingDetections = await this.getPendingDetections();
    
    const statsRow = statsResult.records?.[0];
    const endpointRow = endpointStatsResult.records?.[0];
    
    return {
      config,
      lastSync: lastJobResult.records?.[0] ? this.mapSyncJob(lastJobResult.records[0]) : undefined,
      recentJobs: (recentJobsResult.records || []).map(row => this.mapSyncJob(row)),
      registryStats: {
        totalModels: Number((statsRow?.[0] as { longValue?: number })?.longValue || 0),
        externalModels: Number((statsRow?.[1] as { longValue?: number })?.longValue || 0),
        selfHostedModels: Number((statsRow?.[2] as { longValue?: number })?.longValue || 0),
        activeEndpoints: Number((endpointRow?.[0] as { longValue?: number })?.longValue || 0),
        healthyEndpoints: Number((endpointRow?.[1] as { longValue?: number })?.longValue || 0),
      },
      pendingDetections,
    };
  }
  
  // ============================================================================
  // Sync Job Management
  // ============================================================================
  
  private async createSyncJob(
    configId: string,
    triggerType: string,
    triggeredBy?: string
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO model_sync_jobs (config_id, trigger_type, triggered_by, status, started_at)
       VALUES ($1, $2, $3, 'running', NOW())
       RETURNING id`,
      [
        { name: 'configId', value: { stringValue: configId } },
        { name: 'triggerType', value: { stringValue: triggerType } },
        { name: 'triggeredBy', value: triggeredBy ? { stringValue: triggeredBy } : { isNull: true } },
      ]
    );
    
    return result.records?.[0]?.[0]?.stringValue || '';
  }
  
  private async updateSyncJob(job: SyncJob): Promise<void> {
    await executeStatement(
      `UPDATE model_sync_jobs SET
         status = $2,
         completed_at = $3,
         duration_ms = $4,
         models_scanned = $5,
         models_added = $6,
         models_updated = $7,
         models_removed = $8,
         endpoints_updated = $9,
         proficiencies_generated = $10,
         errors = $11,
         warnings = $12
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: job.id } },
        { name: 'status', value: { stringValue: job.status } },
        { name: 'completedAt', value: job.completedAt ? { stringValue: job.completedAt.toISOString() } : { isNull: true } },
        { name: 'durationMs', value: job.durationMs ? { longValue: job.durationMs } : { isNull: true } },
        { name: 'modelsScanned', value: { longValue: job.modelsScanned } },
        { name: 'modelsAdded', value: { longValue: job.modelsAdded } },
        { name: 'modelsUpdated', value: { longValue: job.modelsUpdated } },
        { name: 'modelsRemoved', value: { longValue: job.modelsRemoved } },
        { name: 'endpointsUpdated', value: { longValue: job.endpointsUpdated } },
        { name: 'proficienciesGenerated', value: { longValue: job.proficienciesGenerated } },
        { name: 'errors', value: { stringValue: JSON.stringify(job.errors) } },
        { name: 'warnings', value: { stringValue: JSON.stringify(job.warnings) } },
      ]
    );
  }
  
  private async updateSyncConfigAfterJob(configId: string, job: SyncJob): Promise<void> {
    // Calculate next scheduled sync
    const config = await this.getSyncConfig();
    const nextSync = new Date();
    nextSync.setMinutes(nextSync.getMinutes() + config.syncIntervalMinutes);
    
    await executeStatement(
      `UPDATE model_sync_config SET
         last_sync_at = $2,
         last_sync_status = $3,
         last_sync_duration_ms = $4,
         next_scheduled_sync = $5
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: configId } },
        { name: 'lastSyncAt', value: { stringValue: job.completedAt?.toISOString() || new Date().toISOString() } },
        { name: 'lastSyncStatus', value: { stringValue: job.status } },
        { name: 'lastSyncDurationMs', value: job.durationMs ? { longValue: job.durationMs } : { isNull: true } },
        { name: 'nextSync', value: { stringValue: nextSync.toISOString() } },
      ]
    );
  }
  
  // ============================================================================
  // Mapping Helpers
  // ============================================================================
  
  private mapSyncConfig(row: unknown[]): SyncConfig {
    const r = row as Array<{ stringValue?: string; booleanValue?: boolean; longValue?: number }>;
    
    return {
      id: r[0]?.stringValue || '',
      tenantId: r[1]?.stringValue,
      autoSyncEnabled: r[2]?.booleanValue ?? true,
      syncIntervalMinutes: Number(r[3]?.longValue || 60),
      syncExternalProviders: r[4]?.booleanValue ?? true,
      syncSelfHostedModels: r[5]?.booleanValue ?? true,
      syncFromHuggingFace: r[6]?.booleanValue ?? false,
      autoDiscoveryEnabled: r[7]?.booleanValue ?? true,
      autoGenerateProficiencies: r[8]?.booleanValue ?? true,
      notifyOnNewModel: r[9]?.booleanValue ?? true,
      notifyOnModelRemoved: r[10]?.booleanValue ?? false,
      notifyOnSyncFailure: r[11]?.booleanValue ?? true,
      notificationEmails: r[12]?.stringValue ? JSON.parse(r[12].stringValue) : undefined,
      notificationWebhook: r[13]?.stringValue,
      lastSyncAt: r[14]?.stringValue ? new Date(r[14].stringValue) : undefined,
      lastSyncStatus: r[15]?.stringValue as SyncStatus,
      lastSyncDurationMs: r[16]?.longValue,
      nextScheduledSync: r[17]?.stringValue ? new Date(r[17].stringValue) : undefined,
      createdAt: new Date(r[18]?.stringValue || ''),
      updatedAt: new Date(r[19]?.stringValue || ''),
    };
  }
  
  private mapSyncJob(row: unknown[]): SyncJob {
    const r = row as Array<{ stringValue?: string; longValue?: number }>;
    
    return {
      id: r[0]?.stringValue || '',
      configId: r[1]?.stringValue || '',
      triggerType: (r[2]?.stringValue || 'manual') as SyncJob['triggerType'],
      triggeredBy: r[3]?.stringValue,
      status: (r[4]?.stringValue || 'pending') as SyncStatus,
      startedAt: new Date(r[5]?.stringValue || ''),
      completedAt: r[6]?.stringValue ? new Date(r[6].stringValue) : undefined,
      durationMs: r[7]?.longValue,
      modelsScanned: Number(r[8]?.longValue || 0),
      modelsAdded: Number(r[9]?.longValue || 0),
      modelsUpdated: Number(r[10]?.longValue || 0),
      modelsRemoved: Number(r[11]?.longValue || 0),
      endpointsUpdated: Number(r[12]?.longValue || 0),
      proficienciesGenerated: Number(r[13]?.longValue || 0),
      errors: r[14]?.stringValue ? JSON.parse(r[14].stringValue) : [],
      warnings: r[15]?.stringValue ? JSON.parse(r[15].stringValue) : [],
    };
  }
  
  private mapRegistryEntry(row: unknown[]): ModelRegistryEntry {
    const r = row as Array<{ stringValue?: string; longValue?: number }>;
    
    return {
      id: r[0]?.stringValue || '',
      modelId: r[1]?.stringValue || '',
      source: (r[2]?.stringValue || 'external') as ModelRegistryEntry['source'],
      provider: r[3]?.stringValue || '',
      family: r[4]?.stringValue || '',
      capabilities: r[5]?.stringValue ? (r[5].stringValue as unknown as string[]) : [],
      inputModalities: r[6]?.stringValue ? (r[6].stringValue as unknown as string[]) : [],
      outputModalities: r[7]?.stringValue ? (r[7].stringValue as unknown as string[]) : [],
      endpoints: r[8]?.stringValue ? JSON.parse(r[8].stringValue) : [],
      primaryEndpointId: r[9]?.stringValue || '',
      routingPriority: Number(r[10]?.longValue || 1),
      fallbackModelIds: r[11]?.stringValue ? (r[11].stringValue as unknown as string[]) : [],
      status: (r[12]?.stringValue || 'active') as ModelRegistryEntry['status'],
      lastSyncedAt: r[13]?.stringValue ? new Date(r[13].stringValue) : undefined,
      syncSource: r[14]?.stringValue,
      createdAt: new Date(r[15]?.stringValue || ''),
      updatedAt: new Date(r[16]?.stringValue || ''),
    };
  }
  
  private mapEndpointRow(row: unknown[]): ModelEndpoint {
    const r = row as Array<{ stringValue?: string; longValue?: number; booleanValue?: boolean }>;
    
    return {
      id: r[0]?.stringValue || '',
      modelId: r[1]?.stringValue || '',
      endpointType: (r[2]?.stringValue || 'custom_rest') as ModelEndpoint['endpointType'],
      baseUrl: r[3]?.stringValue || '',
      path: r[4]?.stringValue,
      method: (r[5]?.stringValue || 'POST') as 'POST' | 'GET',
      authMethod: (r[6]?.stringValue || 'api_key') as ModelEndpoint['authMethod'],
      authConfig: r[7]?.stringValue ? JSON.parse(r[7].stringValue) : undefined,
      requestFormat: r[8]?.stringValue ? JSON.parse(r[8].stringValue) : { contentType: 'application/json', messageField: 'messages' },
      responseFormat: r[9]?.stringValue ? JSON.parse(r[9].stringValue) : { contentType: 'application/json', textPath: 'content' },
      rateLimitRpm: r[10]?.longValue,
      rateLimitTpm: r[11]?.longValue,
      maxConcurrent: r[12]?.longValue,
      timeoutMs: r[13]?.longValue,
      healthCheckUrl: r[14]?.stringValue,
      healthCheckInterval: r[15]?.longValue,
      lastHealthCheck: r[16]?.stringValue ? new Date(r[16].stringValue) : undefined,
      healthStatus: (r[17]?.stringValue || 'unknown') as ModelEndpoint['healthStatus'],
      priority: Number(r[18]?.longValue || 1),
      isActive: r[19]?.booleanValue ?? true,
      createdAt: new Date(r[20]?.stringValue || ''),
      updatedAt: new Date(r[21]?.stringValue || ''),
    };
  }
  
  private mapDetection(row: unknown[]): NewModelDetection {
    const r = row as Array<{ stringValue?: string; booleanValue?: boolean }>;
    
    return {
      id: r[0]?.stringValue || '',
      modelId: r[1]?.stringValue || '',
      detectedAt: new Date(r[2]?.stringValue || ''),
      detectionSource: (r[3]?.stringValue || 'manual') as NewModelDetection['detectionSource'],
      provider: r[4]?.stringValue,
      family: r[5]?.stringValue,
      capabilities: r[6]?.stringValue ? (r[6].stringValue as unknown as string[]) : undefined,
      processed: r[7]?.booleanValue || false,
      processedAt: r[8]?.stringValue ? new Date(r[8].stringValue) : undefined,
      addedToRegistry: r[9]?.booleanValue || false,
      proficienciesGenerated: r[10]?.booleanValue || false,
      skipReason: r[11]?.stringValue,
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const modelCoordinationService = new ModelCoordinationService();
