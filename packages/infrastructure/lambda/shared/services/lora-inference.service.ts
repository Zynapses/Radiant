// RADIANT v4.18.0 - LoRA Inference Service
// Bridges trained LoRA adapters to the inference path
// Integrates with SageMaker endpoints for dynamic adapter loading

import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { adapterManagementService } from './adapter-management.service';
import { enhancedLearningService } from './enhanced-learning.service';

// ============================================================================
// Types
// ============================================================================

export interface LoRAAdapterInfo {
  adapterId: string;
  adapterName: string;
  domain: string;
  subdomain?: string;
  version: number;
  s3Bucket: string;
  s3Key: string;
  baseModel: string;
  loraRank: number;
  loraAlpha: number;
  targetModules: string[];
  benchmarkScore?: number;
  loadTimeMs?: number;
  isActive: boolean;
}

export interface LoRAInferenceRequest {
  tenantId: string;
  modelId: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  // Optional: specify adapter directly, otherwise auto-select by domain
  adapterId?: string;
  // Optional: domain hints for auto-selection
  domain?: string;
  subdomain?: string;
}

export interface LoRAInferenceResponse {
  content: string;
  modelUsed: string;
  adapterUsed?: string;
  adapterName?: string;
  adapterDomain?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents: number;
  adapterLoadTimeMs?: number;
}

export interface LoRAEndpointConfig {
  endpointName: string;
  baseModel: string;
  maxAdaptersInMemory: number;
  currentAdapters: string[];
  isHealthy: boolean;
  lastHealthCheck: Date;
}

interface LoadedAdapter {
  adapterId: string;
  loadedAt: Date;
  lastUsedAt: Date;
  useCount: number;
}

// ============================================================================
// LoRA Inference Service
// ============================================================================

class LoRAInferenceService {
  private sagemakerClient: SageMakerRuntimeClient;
  private s3Client: S3Client;
  
  // In-memory cache of loaded adapters per endpoint
  private loadedAdapters: Map<string, LoadedAdapter[]> = new Map();
  
  // Endpoint configurations cache
  private endpointConfigs: Map<string, LoRAEndpointConfig> = new Map();
  
  constructor() {
    this.sagemakerClient = new SageMakerRuntimeClient({});
    this.s3Client = new S3Client({});
  }

  // ==========================================================================
  // Main Inference Methods
  // ==========================================================================

  /**
   * Invoke a model with optional LoRA adapter
   * This is the main entry point for LoRA-enhanced inference
   */
  async invokeWithLoRA(request: LoRAInferenceRequest): Promise<LoRAInferenceResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Determine which adapter to use (if any)
      const adapter = await this.selectAdapter(request);
      
      // 2. If no adapter, fall back to base model inference
      if (!adapter) {
        logger.debug('No LoRA adapter selected, using base model', { 
          tenantId: request.tenantId, 
          modelId: request.modelId,
          domain: request.domain 
        });
        return this.invokeBaseModel(request);
      }
      
      // 3. Ensure adapter is loaded on endpoint
      const loadStartTime = Date.now();
      await this.ensureAdapterLoaded(request.tenantId, adapter);
      const adapterLoadTimeMs = Date.now() - loadStartTime;
      
      // 4. Invoke with adapter
      const response = await this.invokeSageMakerWithAdapter(request, adapter);
      
      // 5. Record adapter usage for analytics
      await this.recordAdapterUsage(request.tenantId, adapter.adapterId, response);
      
      return {
        ...response,
        adapterUsed: adapter.adapterId,
        adapterName: adapter.adapterName,
        adapterDomain: adapter.domain,
        adapterLoadTimeMs,
        latencyMs: Date.now() - startTime,
      };
      
    } catch (error) {
      logger.error('LoRA inference failed', { 
        tenantId: request.tenantId, 
        modelId: request.modelId,
        error: error instanceof Error ? error.message : 'Unknown'
      });
      
      // Fallback to base model on adapter failure
      logger.info('Falling back to base model after adapter failure');
      return this.invokeBaseModel(request);
    }
  }

  /**
   * Select the best adapter for the request
   */
  private async selectAdapter(request: LoRAInferenceRequest): Promise<LoRAAdapterInfo | null> {
    // If adapter explicitly specified, use it
    if (request.adapterId) {
      return this.getAdapterById(request.tenantId, request.adapterId);
    }
    
    // If domain specified, auto-select best adapter for domain
    if (request.domain) {
      const selection = await adapterManagementService.selectBestAdapter(
        request.tenantId,
        request.domain,
        request.subdomain
      );
      
      if (selection) {
        return this.getAdapterById(request.tenantId, selection.adapterId);
      }
    }
    
    // Check if tenant has a default/active adapter
    const activeAdapter = await this.getTenantActiveAdapter(request.tenantId);
    return activeAdapter;
  }

  /**
   * Get adapter by ID
   */
  private async getAdapterById(tenantId: string, adapterId: string): Promise<LoRAAdapterInfo | null> {
    const result = await executeStatement(
      `SELECT * FROM domain_lora_adapters 
       WHERE tenant_id = $1 AND id = $2 AND status = 'active'`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'adapterId', value: { stringValue: adapterId } },
      ]
    );
    
    if (!result.rows?.length) return null;
    return this.mapAdapterRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Get tenant's active/default adapter (most recent successful training)
   */
  private async getTenantActiveAdapter(tenantId: string): Promise<LoRAAdapterInfo | null> {
    const result = await executeStatement(
      `SELECT da.* FROM domain_lora_adapters da
       JOIN consciousness_evolution_state ces ON da.id::text = ces.current_adapter_id
       WHERE da.tenant_id = $1 AND da.status = 'active'
       LIMIT 1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    if (!result.rows?.length) return null;
    return this.mapAdapterRow(result.rows[0] as Record<string, unknown>);
  }

  // ==========================================================================
  // Adapter Loading
  // ==========================================================================

  /**
   * Ensure adapter is loaded on the appropriate SageMaker endpoint
   */
  private async ensureAdapterLoaded(tenantId: string, adapter: LoRAAdapterInfo): Promise<void> {
    const endpointName = await this.getEndpointForModel(adapter.baseModel);
    
    // Check if already loaded
    const loaded = this.loadedAdapters.get(endpointName) || [];
    const isLoaded = loaded.some(l => l.adapterId === adapter.adapterId);
    
    if (isLoaded) {
      // Update last used time
      const loadedAdapter = loaded.find(l => l.adapterId === adapter.adapterId);
      if (loadedAdapter) {
        loadedAdapter.lastUsedAt = new Date();
        loadedAdapter.useCount++;
      }
      return;
    }
    
    // Load adapter to endpoint
    await this.loadAdapterToEndpoint(tenantId, endpointName, adapter);
  }

  /**
   * Load adapter weights to SageMaker endpoint
   */
  private async loadAdapterToEndpoint(
    tenantId: string, 
    endpointName: string, 
    adapter: LoRAAdapterInfo
  ): Promise<void> {
    const config = await this.getEndpointConfig(endpointName);
    
    // Check if we need to evict an adapter first
    const loaded = this.loadedAdapters.get(endpointName) || [];
    if (loaded.length >= config.maxAdaptersInMemory) {
      await this.evictLeastRecentlyUsedAdapter(endpointName);
    }
    
    logger.info('Loading LoRA adapter to endpoint', {
      tenantId,
      endpointName,
      adapterId: adapter.adapterId,
      adapterName: adapter.adapterName,
    });
    
    // Verify adapter exists in S3
    const adapterExists = await this.verifyAdapterInS3(adapter);
    if (!adapterExists) {
      throw new Error(`Adapter not found in S3: ${adapter.s3Bucket}/${adapter.s3Key}`);
    }
    
    // Send load command to endpoint
    // This uses a special "load_adapter" action in the model serving container
    const loadCommand = {
      action: 'load_adapter',
      adapter_id: adapter.adapterId,
      adapter_name: adapter.adapterName,
      s3_bucket: adapter.s3Bucket,
      s3_key: adapter.s3Key,
      lora_rank: adapter.loraRank,
      lora_alpha: adapter.loraAlpha,
      target_modules: adapter.targetModules,
    };
    
    try {
      await this.sagemakerClient.send(new InvokeEndpointCommand({
        EndpointName: endpointName,
        ContentType: 'application/json',
        Body: JSON.stringify(loadCommand),
        CustomAttributes: 'action=load_adapter',
      }));
      
      // Update loaded adapters cache
      loaded.push({
        adapterId: adapter.adapterId,
        loadedAt: new Date(),
        lastUsedAt: new Date(),
        useCount: 1,
      });
      this.loadedAdapters.set(endpointName, loaded);
      
      // Log adapter load event
      await this.logAdapterLoadEvent(tenantId, adapter.adapterId, endpointName, 'loaded');
      
    } catch (error) {
      logger.error('Failed to load adapter to endpoint', {
        endpointName,
        adapterId: adapter.adapterId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  /**
   * Evict the least recently used adapter from endpoint
   */
  private async evictLeastRecentlyUsedAdapter(endpointName: string): Promise<void> {
    const loaded = this.loadedAdapters.get(endpointName) || [];
    if (loaded.length === 0) return;
    
    // Find LRU adapter
    loaded.sort((a, b) => a.lastUsedAt.getTime() - b.lastUsedAt.getTime());
    const lruAdapter = loaded[0];
    
    logger.info('Evicting LRU adapter from endpoint', {
      endpointName,
      adapterId: lruAdapter.adapterId,
      lastUsedAt: lruAdapter.lastUsedAt,
    });
    
    // Send unload command
    const unloadCommand = {
      action: 'unload_adapter',
      adapter_id: lruAdapter.adapterId,
    };
    
    try {
      await this.sagemakerClient.send(new InvokeEndpointCommand({
        EndpointName: endpointName,
        ContentType: 'application/json',
        Body: JSON.stringify(unloadCommand),
        CustomAttributes: 'action=unload_adapter',
      }));
      
      // Remove from cache
      this.loadedAdapters.set(endpointName, loaded.slice(1));
      
    } catch (error) {
      logger.warn('Failed to evict adapter, continuing anyway', {
        endpointName,
        adapterId: lruAdapter.adapterId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // Still remove from cache to allow new adapter
      this.loadedAdapters.set(endpointName, loaded.slice(1));
    }
  }

  // ==========================================================================
  // SageMaker Invocation
  // ==========================================================================

  /**
   * Invoke SageMaker endpoint with loaded LoRA adapter
   */
  private async invokeSageMakerWithAdapter(
    request: LoRAInferenceRequest,
    adapter: LoRAAdapterInfo
  ): Promise<LoRAInferenceResponse> {
    const startTime = Date.now();
    const endpointName = await this.getEndpointForModel(adapter.baseModel);
    
    const payload = {
      action: 'generate',
      adapter_id: adapter.adapterId,
      inputs: request.prompt,
      parameters: {
        max_new_tokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.7,
        do_sample: true,
        top_p: 0.9,
      },
      system_prompt: request.systemPrompt,
    };
    
    const response = await this.sagemakerClient.send(new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: JSON.stringify(payload),
    }));
    
    const result = JSON.parse(new TextDecoder().decode(response.Body));
    
    // Extract response content
    const content = result.generated_text || result.outputs || result[0]?.generated_text || '';
    const inputTokens = result.usage?.input_tokens || Math.ceil(request.prompt.length / 4);
    const outputTokens = result.usage?.output_tokens || Math.ceil(content.length / 4);
    
    // Calculate cost (self-hosted models are cheaper)
    const costCents = this.calculateSelfHostedCost(inputTokens, outputTokens);
    
    return {
      content,
      modelUsed: adapter.baseModel,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      costCents,
    };
  }

  /**
   * Invoke base model without adapter (fallback)
   */
  private async invokeBaseModel(request: LoRAInferenceRequest): Promise<LoRAInferenceResponse> {
    const startTime = Date.now();
    
    // Get default self-hosted endpoint
    const endpointName = await this.getDefaultEndpoint(request.tenantId);
    
    const payload = {
      action: 'generate',
      inputs: request.prompt,
      parameters: {
        max_new_tokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.7,
        do_sample: true,
        top_p: 0.9,
      },
      system_prompt: request.systemPrompt,
    };
    
    const response = await this.sagemakerClient.send(new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: JSON.stringify(payload),
    }));
    
    const result = JSON.parse(new TextDecoder().decode(response.Body));
    const content = result.generated_text || result.outputs || result[0]?.generated_text || '';
    const inputTokens = result.usage?.input_tokens || Math.ceil(request.prompt.length / 4);
    const outputTokens = result.usage?.output_tokens || Math.ceil(content.length / 4);
    
    return {
      content,
      modelUsed: request.modelId,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      costCents: this.calculateSelfHostedCost(inputTokens, outputTokens),
    };
  }

  // ==========================================================================
  // Endpoint Management
  // ==========================================================================

  /**
   * Get the SageMaker endpoint for a given base model
   */
  private async getEndpointForModel(baseModel: string): Promise<string> {
    // Check cache first
    for (const [endpoint, config] of this.endpointConfigs) {
      if (config.baseModel === baseModel && config.isHealthy) {
        return endpoint;
      }
    }
    
    // Query database for endpoint
    const result = await executeStatement(
      `SELECT endpoint_name FROM shared_inference_endpoints 
       WHERE base_model = $1 AND status = 'active'
       ORDER BY priority DESC LIMIT 1`,
      [{ name: 'baseModel', value: { stringValue: baseModel } }]
    );
    
    if (result.rows?.length) {
      return String((result.rows[0] as Record<string, unknown>).endpoint_name);
    }
    
    // Fallback to default naming convention
    const sanitizedModel = baseModel.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return `radiant-lora-${sanitizedModel}`;
  }

  /**
   * Get default endpoint for tenant
   */
  private async getDefaultEndpoint(tenantId: string): Promise<string> {
    const result = await executeStatement(
      `SELECT default_inference_endpoint FROM tenant_ai_config 
       WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    if (result.rows?.length) {
      const endpoint = (result.rows[0] as Record<string, unknown>).default_inference_endpoint;
      if (endpoint) return String(endpoint);
    }
    
    // Global default
    return process.env.DEFAULT_SAGEMAKER_ENDPOINT || 'radiant-lora-llama3-70b';
  }

  /**
   * Get endpoint configuration
   */
  private async getEndpointConfig(endpointName: string): Promise<LoRAEndpointConfig> {
    // Check cache
    const cached = this.endpointConfigs.get(endpointName);
    if (cached && (Date.now() - cached.lastHealthCheck.getTime()) < 60000) {
      return cached;
    }
    
    // Query database
    const result = await executeStatement(
      `SELECT * FROM shared_inference_endpoints WHERE endpoint_name = $1`,
      [{ name: 'endpointName', value: { stringValue: endpointName } }]
    );
    
    if (result.rows?.length) {
      const row = result.rows[0] as Record<string, unknown>;
      const config: LoRAEndpointConfig = {
        endpointName,
        baseModel: String(row.base_model || 'llama-3-70b'),
        maxAdaptersInMemory: Number(row.max_adapters_in_memory || 5),
        currentAdapters: (row.current_adapters as string[]) || [],
        isHealthy: row.status === 'active',
        lastHealthCheck: new Date(),
      };
      this.endpointConfigs.set(endpointName, config);
      return config;
    }
    
    // Return defaults
    return {
      endpointName,
      baseModel: 'llama-3-70b',
      maxAdaptersInMemory: 5,
      currentAdapters: [],
      isHealthy: true,
      lastHealthCheck: new Date(),
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Verify adapter file exists in S3
   */
  private async verifyAdapterInS3(adapter: LoRAAdapterInfo): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: adapter.s3Bucket,
        Key: adapter.s3Key,
      }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate cost for self-hosted inference
   */
  private calculateSelfHostedCost(inputTokens: number, outputTokens: number): number {
    // Self-hosted costs are primarily compute time, estimated at ~$0.0001 per 1k tokens
    const costPerThousand = 0.0001;
    return Math.ceil((inputTokens + outputTokens) / 1000 * costPerThousand * 100);
  }

  /**
   * Map database row to adapter info
   */
  private mapAdapterRow(row: Record<string, unknown>): LoRAAdapterInfo {
    return {
      adapterId: String(row.id),
      adapterName: String(row.adapter_name || row.name || 'unnamed'),
      domain: String(row.domain || 'general'),
      subdomain: row.subdomain ? String(row.subdomain) : undefined,
      version: Number(row.adapter_version || row.version || 1),
      s3Bucket: String(row.s3_bucket || process.env.EVOLUTION_S3_BUCKET || 'radiant-evolution-data'),
      s3Key: String(row.s3_key || row.adapter_s3_path || ''),
      baseModel: String(row.base_model || 'llama-3-70b'),
      loraRank: Number(row.lora_rank || 16),
      loraAlpha: Number(row.lora_alpha || 32),
      targetModules: (row.target_modules as string[]) || ['q_proj', 'k_proj', 'v_proj', 'o_proj'],
      benchmarkScore: row.benchmark_score ? Number(row.benchmark_score) : undefined,
      loadTimeMs: row.load_time_ms ? Number(row.load_time_ms) : undefined,
      isActive: row.status === 'active',
    };
  }

  /**
   * Record adapter usage for analytics
   */
  private async recordAdapterUsage(
    tenantId: string,
    adapterId: string,
    response: LoRAInferenceResponse
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO adapter_usage_log (tenant_id, adapter_id, input_tokens, output_tokens, latency_ms, cost_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'adapterId', value: { stringValue: adapterId } },
          { name: 'inputTokens', value: { longValue: response.inputTokens } },
          { name: 'outputTokens', value: { longValue: response.outputTokens } },
          { name: 'latencyMs', value: { longValue: response.latencyMs } },
          { name: 'costCents', value: { longValue: response.costCents } },
        ]
      );
    } catch {
      // Non-critical, log and continue
      logger.debug('Failed to record adapter usage');
    }
  }

  /**
   * Log adapter load/unload event
   */
  private async logAdapterLoadEvent(
    tenantId: string,
    adapterId: string,
    endpointName: string,
    action: 'loaded' | 'unloaded'
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO component_load_events (tenant_id, component_id, endpoint_name, action)
         VALUES ($1, $2, $3, $4)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'adapterId', value: { stringValue: adapterId } },
          { name: 'endpointName', value: { stringValue: endpointName } },
          { name: 'action', value: { stringValue: action } },
        ]
      );
    } catch {
      // Non-critical
    }
  }

  // ==========================================================================
  // Public API for External Use
  // ==========================================================================

  /**
   * Get all adapters for a tenant
   */
  async getAdapters(tenantId: string): Promise<LoRAAdapterInfo[]> {
    return enhancedLearningService.listDomainAdapters(tenantId).then(adapters => 
      adapters.map(a => ({
        adapterId: a.id,
        adapterName: a.adapterName,
        domain: a.domain,
        subdomain: a.subdomain,
        version: a.adapterVersion,
        s3Bucket: a.s3Bucket || process.env.EVOLUTION_S3_BUCKET || 'radiant-evolution-data',
        s3Key: a.s3Key || '',
        baseModel: a.baseModel || 'llama-3-70b',
        loraRank: 16, // Default LoRA rank
        loraAlpha: 32, // Default LoRA alpha
        targetModules: ['q_proj', 'k_proj', 'v_proj', 'o_proj'], // Default target modules
        benchmarkScore: a.accuracyScore, // Map from accuracyScore
        loadTimeMs: undefined, // Not tracked in DomainLoraAdapter
        isActive: a.status === 'active',
      }))
    );
  }

  /**
   * Check if LoRA is enabled for tenant
   */
  async isLoRAEnabled(tenantId: string): Promise<boolean> {
    const config = await enhancedLearningService.getConfig(tenantId);
    return config?.adapterAutoSelectionEnabled ?? false;
  }

  /**
   * Preload adapters for common domains
   */
  async preloadAdapters(tenantId: string, domains: string[]): Promise<void> {
    for (const domain of domains) {
      try {
        const adapter = await enhancedLearningService.getActiveAdapter(tenantId, domain);
        if (adapter) {
          const adapterInfo = this.mapAdapterRow(adapter as unknown as Record<string, unknown>);
          await this.ensureAdapterLoaded(tenantId, adapterInfo);
          logger.info('Preloaded adapter', { tenantId, domain, adapterId: adapterInfo.adapterId });
        }
      } catch (error) {
        logger.warn('Failed to preload adapter', { tenantId, domain, error });
      }
    }
  }
}

export const loraInferenceService = new LoRAInferenceService();
