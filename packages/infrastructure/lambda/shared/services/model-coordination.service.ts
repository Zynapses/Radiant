// RADIANT v4.18.0 - Model Coordination Service
// Coordinates communication between hosted and self-hosted AI models
// Includes timed sync, auto-discovery, and endpoint management

import { executeStatement, stringParam, longParam } from '../db/client';
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
    
    if (!result.rows || result.rows.length === 0) {
      // Return default config
      return this.getDefaultSyncConfig(tenantId);
    }
    
    return this.mapSyncConfig(result.rows[0]);
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
    errors: Array<{ errorType: 'connection' | 'auth' | 'format' | 'validation' | 'unknown'; message: string; timestamp: Date }>;
  }> {
    const result = { scanned: 0, updated: 0, endpointsUpdated: 0, errors: [] as Array<{ errorType: 'connection' | 'auth' | 'format' | 'validation' | 'unknown'; message: string; timestamp: Date }> };
    
    // Get all external endpoints
    const endpointsResult = await executeStatement(
      `SELECT me.* FROM model_endpoints me
       JOIN model_registry mr ON me.model_id = mr.model_id
       WHERE mr.source = 'external' AND me.is_active = true`,
      []
    );
    
    for (const row of endpointsResult.rows || []) {
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
   * Check endpoint health via HTTP request
   */
  private async checkEndpointHealth(
    endpoint: ModelEndpoint
  ): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    // If no health check URL configured, return current status
    if (!endpoint.healthCheckUrl) {
      return endpoint.healthStatus === 'unknown' ? 'healthy' : endpoint.healthStatus as 'healthy' | 'degraded' | 'unhealthy';
    }
    
    const startTime = Date.now();
    const timeoutMs = 5000; // 5 second timeout
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(endpoint.healthCheckUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      
      // Check response status
      if (response.ok) {
        // Check if response time indicates degraded performance
        if (latencyMs > 2000) {
          return 'degraded';
        }
        
        // Try to parse response body for additional health info
        try {
          const body = await response.json() as { status?: string; healthy?: boolean };
          if (body.status === 'unhealthy' || body.healthy === false) {
            return 'unhealthy';
          }
          if (body.status === 'degraded') {
            return 'degraded';
          }
        } catch {
          // Body parsing failed, but response was OK
        }
        
        return 'healthy';
      } else if (response.status >= 500) {
        return 'unhealthy';
      } else if (response.status >= 400) {
        return 'degraded';
      }
      
      return 'healthy';
    } catch (error) {
      // Network error, timeout, or connection refused
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
        return 'degraded'; // Timeout suggests slow but possibly working
      }
      
      return 'unhealthy'; // Connection failed
    }
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
    
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    
    return this.mapRegistryEntry(result.rows[0]);
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
    
    return (result.rows || []).map(row => this.mapRegistryEntry(row));
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
    
    return String(result.rows?.[0]?.id || '');
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
    
    return String(result.rows?.[0]?.id || '');
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
    
    const detectionId = String(result.rows?.[0]?.id || '');
    
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
    
    return (result.rows || []).map(row => this.mapDetection(row));
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
    
    const statsRow = statsResult.rows?.[0];
    const endpointRow = endpointStatsResult.rows?.[0];
    
    return {
      config,
      lastSync: lastJobResult.rows?.[0] ? this.mapSyncJob(lastJobResult.rows[0]) : undefined,
      recentJobs: (recentJobsResult.rows || []).map(row => this.mapSyncJob(row)),
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
    
    return String(result.rows?.[0]?.id || '');
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
  
  private mapSyncConfig(row: Record<string, unknown>): SyncConfig {
    return {
      id: String(row.id || ''),
      tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
      autoSyncEnabled: row.auto_sync_enabled !== false,
      syncIntervalMinutes: Number(row.sync_interval_minutes || 60),
      syncExternalProviders: row.sync_external_providers !== false,
      syncSelfHostedModels: row.sync_self_hosted_models !== false,
      syncFromHuggingFace: Boolean(row.sync_from_huggingface),
      autoDiscoveryEnabled: row.auto_discovery_enabled !== false,
      autoGenerateProficiencies: row.auto_generate_proficiencies !== false,
      notifyOnNewModel: row.notify_on_new_model !== false,
      notifyOnModelRemoved: Boolean(row.notify_on_model_removed),
      notifyOnSyncFailure: row.notify_on_sync_failure !== false,
      notificationEmails: row.notification_emails ? (row.notification_emails as string[]) : undefined,
      notificationWebhook: row.notification_webhook ? String(row.notification_webhook) : undefined,
      lastSyncAt: row.last_sync_at ? new Date(String(row.last_sync_at)) : undefined,
      lastSyncStatus: row.last_sync_status as SyncStatus,
      lastSyncDurationMs: row.last_sync_duration_ms ? Number(row.last_sync_duration_ms) : undefined,
      nextScheduledSync: row.next_scheduled_sync ? new Date(String(row.next_scheduled_sync)) : undefined,
      createdAt: new Date(String(row.created_at || '')),
      updatedAt: new Date(String(row.updated_at || '')),
    };
  }
  
  private mapSyncJob(row: Record<string, unknown>): SyncJob {
    return {
      id: String(row.id || ''),
      configId: String(row.config_id || ''),
      triggerType: (String(row.trigger_type || 'manual')) as SyncJob['triggerType'],
      triggeredBy: row.triggered_by ? String(row.triggered_by) : undefined,
      status: (String(row.status || 'pending')) as SyncStatus,
      startedAt: new Date(String(row.started_at || '')),
      completedAt: row.completed_at ? new Date(String(row.completed_at)) : undefined,
      durationMs: row.duration_ms ? Number(row.duration_ms) : undefined,
      modelsScanned: Number(row.models_scanned || 0),
      modelsAdded: Number(row.models_added || 0),
      modelsUpdated: Number(row.models_updated || 0),
      modelsRemoved: Number(row.models_removed || 0),
      endpointsUpdated: Number(row.endpoints_updated || 0),
      proficienciesGenerated: Number(row.proficiencies_generated || 0),
      errors: row.errors ? (typeof row.errors === 'string' ? JSON.parse(row.errors) : row.errors) : [],
      warnings: row.warnings ? (typeof row.warnings === 'string' ? JSON.parse(row.warnings) : row.warnings) : [],
    };
  }
  
  private mapRegistryEntry(row: Record<string, unknown>): ModelRegistryEntry {
    return {
      id: String(row.id || ''),
      modelId: String(row.model_id || ''),
      source: (String(row.source || 'external')) as ModelRegistryEntry['source'],
      provider: String(row.provider || ''),
      family: String(row.family || ''),
      capabilities: row.capabilities as string[] || [],
      inputModalities: row.input_modalities as string[] || [],
      outputModalities: row.output_modalities as string[] || [],
      endpoints: row.endpoints ? (typeof row.endpoints === 'string' ? JSON.parse(row.endpoints) : row.endpoints) : [],
      primaryEndpointId: String(row.primary_endpoint_id || ''),
      routingPriority: Number(row.routing_priority || 1),
      fallbackModelIds: row.fallback_model_ids as string[] || [],
      status: (String(row.status || 'active')) as ModelRegistryEntry['status'],
      lastSyncedAt: row.last_synced_at ? new Date(String(row.last_synced_at)) : undefined,
      syncSource: row.sync_source ? String(row.sync_source) : undefined,
      createdAt: new Date(String(row.created_at || '')),
      updatedAt: new Date(String(row.updated_at || '')),
    };
  }
  
  private mapEndpointRow(row: Record<string, unknown>): ModelEndpoint {
    return {
      id: String(row.id || ''),
      modelId: String(row.model_id || ''),
      endpointType: (String(row.endpoint_type || 'custom_rest')) as ModelEndpoint['endpointType'],
      baseUrl: String(row.base_url || ''),
      path: row.path ? String(row.path) : undefined,
      method: (String(row.method || 'POST')) as 'POST' | 'GET',
      authMethod: (String(row.auth_method || 'api_key')) as ModelEndpoint['authMethod'],
      authConfig: row.auth_config ? (typeof row.auth_config === 'string' ? JSON.parse(row.auth_config) : row.auth_config) : undefined,
      requestFormat: row.request_format ? (typeof row.request_format === 'string' ? JSON.parse(row.request_format) : row.request_format) : { contentType: 'application/json', messageField: 'messages' },
      responseFormat: row.response_format ? (typeof row.response_format === 'string' ? JSON.parse(row.response_format) : row.response_format) : { contentType: 'application/json', textPath: 'content' },
      rateLimitRpm: row.rate_limit_rpm ? Number(row.rate_limit_rpm) : undefined,
      rateLimitTpm: row.rate_limit_tpm ? Number(row.rate_limit_tpm) : undefined,
      maxConcurrent: row.max_concurrent ? Number(row.max_concurrent) : undefined,
      timeoutMs: row.timeout_ms ? Number(row.timeout_ms) : undefined,
      healthCheckUrl: row.health_check_url ? String(row.health_check_url) : undefined,
      healthCheckInterval: row.health_check_interval ? Number(row.health_check_interval) : undefined,
      lastHealthCheck: row.last_health_check ? new Date(String(row.last_health_check)) : undefined,
      healthStatus: (String(row.health_status || 'unknown')) as ModelEndpoint['healthStatus'],
      priority: Number(row.priority || 1),
      isActive: row.is_active !== false,
      createdAt: new Date(String(row.created_at || '')),
      updatedAt: new Date(String(row.updated_at || '')),
    };
  }
  
  private mapDetection(row: Record<string, unknown>): NewModelDetection {
    return {
      id: String(row.id || ''),
      modelId: String(row.model_id || ''),
      detectedAt: new Date(String(row.detected_at || '')),
      detectionSource: (String(row.detection_source || 'manual')) as NewModelDetection['detectionSource'],
      provider: row.provider ? String(row.provider) : undefined,
      family: row.family ? String(row.family) : undefined,
      capabilities: row.capabilities as string[] || undefined,
      processed: Boolean(row.processed),
      processedAt: row.processed_at ? new Date(String(row.processed_at)) : undefined,
      addedToRegistry: Boolean(row.added_to_registry),
      proficienciesGenerated: Boolean(row.proficiencies_generated),
      skipReason: row.skip_reason ? String(row.skip_reason) : undefined,
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const modelCoordinationService = new ModelCoordinationService();
