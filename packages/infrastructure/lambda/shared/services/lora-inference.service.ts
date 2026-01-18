// RADIANT v4.18.0 - LoRA Inference Service (Tri-Layer Architecture)
// Bridges trained LoRA adapters to the inference path
// Implements adapter composition: Genesis (Base) + Cato (Global) + User (Personal)
// Integrates with SageMaker/vLLM endpoints for dynamic adapter stacking

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
  // Tri-layer classification
  adapterLayer: 'global' | 'user' | 'domain';
  // Scaling factor for weight composition (default 1.0)
  scale?: number;
  // Whether this adapter is pinned (never evicted)
  isPinned?: boolean;
}

// Tri-Layer Adapter Stack
export interface AdapterStack {
  // Layer 0: Genesis (Base Model) - implicit, always present
  baseModel: string;
  // Layer 1: Cato (Global Constitution) - pinned, never evicted
  globalAdapter?: LoRAAdapterInfo;
  // Layer 2: User Persona (Personal Context) - LRU managed
  userAdapter?: LoRAAdapterInfo;
  // Optional: Domain-specific adapter (can stack on top)
  domainAdapter?: LoRAAdapterInfo;
  // Combined scaling factors
  scales: {
    global: number;
    user: number;
    domain: number;
  };
}

// Adapter composition for inference payload
export interface AdapterComposition {
  adapters: Array<{
    name: string;
    id: string;
    scale: number;
    layer: 'global' | 'user' | 'domain';
  }>;
  totalScale: number;
}

export interface LoRAInferenceRequest {
  tenantId: string;
  userId?: string;
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
  // Tri-layer options
  useGlobalAdapter?: boolean; // Default true - include Cato global adapter
  useUserAdapter?: boolean;   // Default true - include user's personal adapter
  // Scale overrides (for drift protection)
  globalScale?: number;       // Default 1.0
  userScale?: number;         // Default 1.0
}

export interface LoRAInferenceResponse {
  content: string;
  modelUsed: string;
  // Single adapter (legacy)
  adapterUsed?: string;
  adapterName?: string;
  adapterDomain?: string;
  // Tri-layer adapter stack (new)
  adapterStack?: {
    globalAdapterId?: string;
    globalAdapterName?: string;
    userAdapterId?: string;
    userAdapterName?: string;
    domainAdapterId?: string;
    domainAdapterName?: string;
    scales: { global: number; user: number; domain: number };
  };
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents: number;
  adapterLoadTimeMs?: number;
  // Composition details
  adaptersUsedCount: number;
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
  adapterName: string;
  layer: 'global' | 'user' | 'domain';
  loadedAt: Date;
  lastUsedAt: Date;
  useCount: number;
  isPinned: boolean; // If true, never evict (global adapters)
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
  // Main Inference Methods (Tri-Layer Architecture)
  // ==========================================================================

  /**
   * Invoke a model with tri-layer LoRA adapter stack
   * Layer 0: Genesis (Base Model) - always present
   * Layer 1: Cato (Global Constitution) - pinned, never evicted
   * Layer 2: User Persona (Personal Context) - LRU managed
   * 
   * This is the main entry point for LoRA-enhanced inference
   */
  async invokeWithLoRA(request: LoRAInferenceRequest): Promise<LoRAInferenceResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Build the adapter stack (Global + User + optional Domain)
      const adapterStack = await this.buildAdapterStack(request);
      
      // 2. If no adapters in stack, fall back to base model inference
      if (!adapterStack.globalAdapter && !adapterStack.userAdapter && !adapterStack.domainAdapter) {
        logger.debug('No LoRA adapters selected, using base model', { 
          tenantId: request.tenantId, 
          modelId: request.modelId,
          domain: request.domain 
        });
        return this.invokeBaseModel(request);
      }
      
      // 3. Ensure all adapters in stack are loaded on endpoint
      const loadStartTime = Date.now();
      await this.ensureAdapterStackLoaded(request.tenantId, adapterStack);
      const adapterLoadTimeMs = Date.now() - loadStartTime;
      
      // 4. Invoke with adapter stack composition
      const response = await this.invokeSageMakerWithAdapterStack(request, adapterStack);
      
      // 5. Record adapter usage for analytics
      await this.recordAdapterStackUsage(request.tenantId, adapterStack, response);
      
      // 6. Build response with stack info
      const adaptersUsed = [
        adapterStack.globalAdapter,
        adapterStack.userAdapter,
        adapterStack.domainAdapter,
      ].filter(Boolean);
      
      return {
        ...response,
        // Legacy single-adapter fields (use primary adapter)
        adapterUsed: adapterStack.userAdapter?.adapterId || adapterStack.globalAdapter?.adapterId,
        adapterName: adapterStack.userAdapter?.adapterName || adapterStack.globalAdapter?.adapterName,
        adapterDomain: adapterStack.domainAdapter?.domain,
        // New tri-layer stack info
        adapterStack: {
          globalAdapterId: adapterStack.globalAdapter?.adapterId,
          globalAdapterName: adapterStack.globalAdapter?.adapterName,
          userAdapterId: adapterStack.userAdapter?.adapterId,
          userAdapterName: adapterStack.userAdapter?.adapterName,
          domainAdapterId: adapterStack.domainAdapter?.adapterId,
          domainAdapterName: adapterStack.domainAdapter?.adapterName,
          scales: adapterStack.scales,
        },
        adapterLoadTimeMs,
        latencyMs: Date.now() - startTime,
        adaptersUsedCount: adaptersUsed.length,
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
   * Build the tri-layer adapter stack for a request
   * Implements: W_Final = W_Genesis + (scale × W_Cato) + (scale × W_User)
   */
  private async buildAdapterStack(request: LoRAInferenceRequest): Promise<AdapterStack> {
    const stack: AdapterStack = {
      baseModel: request.modelId,
      scales: {
        global: request.globalScale ?? 1.0,
        user: request.userScale ?? 1.0,
        domain: 1.0,
      },
    };

    // Layer 1: Global "Cato" Adapter (unless explicitly disabled)
    if (request.useGlobalAdapter !== false) {
      stack.globalAdapter = await this.getGlobalCatoAdapter(request.tenantId, request.modelId) ?? undefined;
    }

    // Layer 2: User Personal Adapter (unless explicitly disabled)
    if (request.useUserAdapter !== false && request.userId) {
      stack.userAdapter = await this.getUserPersonalAdapter(request.tenantId, request.userId) ?? undefined;
    }

    // Optional Layer 3: Domain-specific adapter (if domain hint provided or adapter specified)
    if (request.adapterId) {
      stack.domainAdapter = await this.getAdapterById(request.tenantId, request.adapterId) ?? undefined;
    } else if (request.domain) {
      stack.domainAdapter = await this.selectDomainAdapter(request) ?? undefined;
    }

    logger.debug('Built adapter stack', {
      tenantId: request.tenantId,
      hasGlobal: !!stack.globalAdapter,
      hasUser: !!stack.userAdapter,
      hasDomain: !!stack.domainAdapter,
      scales: stack.scales,
    });

    return stack;
  }

  /**
   * Get the global "Cato" adapter for a tenant
   * This is the collective conscience adapter trained on all users
   */
  private async getGlobalCatoAdapter(tenantId: string, baseModel: string): Promise<LoRAAdapterInfo | null> {
    const result = await executeStatement(
      `SELECT * FROM domain_lora_adapters 
       WHERE tenant_id = $1 
         AND adapter_layer = 'global' 
         AND base_model = $2
         AND status = 'active'
       ORDER BY adapter_version DESC LIMIT 1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'baseModel', value: { stringValue: baseModel } },
      ]
    );
    
    if (!result.rows?.length) {
      // Try to find any global adapter for this tenant
      const fallback = await executeStatement(
        `SELECT * FROM domain_lora_adapters 
         WHERE tenant_id = $1 
           AND (adapter_layer = 'global' OR adapter_name LIKE '%cato%' OR adapter_name LIKE '%global%')
           AND status = 'active'
         ORDER BY adapter_version DESC LIMIT 1`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      if (!fallback.rows?.length) return null;
      const adapter = this.mapAdapterRow(fallback.rows[0] as Record<string, unknown>);
      adapter.adapterLayer = 'global';
      adapter.isPinned = true;
      return adapter;
    }
    
    const adapter = this.mapAdapterRow(result.rows[0] as Record<string, unknown>);
    adapter.adapterLayer = 'global';
    adapter.isPinned = true;
    return adapter;
  }

  /**
   * Get user's personal adapter
   * This stores the user's specific context, style, and preferences
   */
  private async getUserPersonalAdapter(tenantId: string, userId: string): Promise<LoRAAdapterInfo | null> {
    const result = await executeStatement(
      `SELECT * FROM domain_lora_adapters 
       WHERE tenant_id = $1 
         AND (adapter_layer = 'user' OR user_id = $2)
         AND status = 'active'
       ORDER BY adapter_version DESC LIMIT 1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
    
    if (!result.rows?.length) return null;
    const adapter = this.mapAdapterRow(result.rows[0] as Record<string, unknown>);
    adapter.adapterLayer = 'user';
    adapter.isPinned = false;
    return adapter;
  }

  /**
   * Select domain-specific adapter based on request hints
   */
  private async selectDomainAdapter(request: LoRAInferenceRequest): Promise<LoRAAdapterInfo | null> {
    if (!request.domain) return null;
    
    const selection = await adapterManagementService.selectBestAdapter(
      request.tenantId,
      request.domain,
      request.subdomain
    );
    
    if (!selection) return null;
    
    const adapter = await this.getAdapterById(request.tenantId, selection.adapterId);
    if (adapter) {
      adapter.adapterLayer = 'domain';
      adapter.isPinned = false;
    }
    return adapter;
  }

  /**
   * Legacy: Select single best adapter for the request
   * @deprecated Use buildAdapterStack for tri-layer composition
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
        adapterName: adapter.adapterName,
        layer: adapter.adapterLayer,
        loadedAt: new Date(),
        lastUsedAt: new Date(),
        useCount: 1,
        isPinned: adapter.isPinned ?? false,
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
   * IMPORTANT: Never evict pinned adapters (global "Cato" adapters)
   */
  private async evictLeastRecentlyUsedAdapter(endpointName: string): Promise<void> {
    const loaded = this.loadedAdapters.get(endpointName) || [];
    if (loaded.length === 0) return;
    
    // Filter out pinned adapters - they are NEVER evicted
    const evictable = loaded.filter(a => !a.isPinned);
    if (evictable.length === 0) {
      logger.warn('No evictable adapters (all pinned), cannot load new adapter', { endpointName });
      return;
    }
    
    // Find LRU adapter among evictable ones
    evictable.sort((a, b) => a.lastUsedAt.getTime() - b.lastUsedAt.getTime());
    const lruAdapter = evictable[0];
    
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
      adaptersUsedCount: 1,
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
      adaptersUsedCount: 0,
    };
  }

  // ==========================================================================
  // Tri-Layer Adapter Stack Methods
  // ==========================================================================

  /**
   * Ensure all adapters in the stack are loaded on the endpoint
   * Global adapter is loaded first and pinned
   */
  private async ensureAdapterStackLoaded(tenantId: string, stack: AdapterStack): Promise<void> {
    const adaptersToLoad = [
      stack.globalAdapter,
      stack.userAdapter,
      stack.domainAdapter,
    ].filter((a): a is LoRAAdapterInfo => !!a);

    for (const adapter of adaptersToLoad) {
      await this.ensureAdapterLoaded(tenantId, adapter);
    }
  }

  /**
   * Invoke SageMaker with adapter stack composition
   * Implements: W_Final = W_Genesis + (scale × W_Cato) + (scale × W_User) + (scale × W_Domain)
   */
  private async invokeSageMakerWithAdapterStack(
    request: LoRAInferenceRequest,
    stack: AdapterStack
  ): Promise<LoRAInferenceResponse> {
    const startTime = Date.now();
    const baseModel = stack.globalAdapter?.baseModel || stack.userAdapter?.baseModel || stack.domainAdapter?.baseModel || request.modelId;
    const endpointName = await this.getEndpointForModel(baseModel);
    
    // Build adapter composition array for vLLM/LoRAX
    const adapters: Array<{ name: string; id: string; scale: number }> = [];
    
    if (stack.globalAdapter) {
      adapters.push({
        name: stack.globalAdapter.adapterName,
        id: stack.globalAdapter.adapterId,
        scale: stack.scales.global,
      });
    }
    
    if (stack.userAdapter) {
      adapters.push({
        name: stack.userAdapter.adapterName,
        id: stack.userAdapter.adapterId,
        scale: stack.scales.user,
      });
    }
    
    if (stack.domainAdapter) {
      adapters.push({
        name: stack.domainAdapter.adapterName,
        id: stack.domainAdapter.adapterId,
        scale: stack.scales.domain,
      });
    }
    
    // Payload for vLLM/LoRAX with multi-adapter support
    const payload = {
      action: 'generate',
      // Multi-adapter composition (vLLM/LoRAX format)
      adapters: adapters.map(a => ({
        name: a.name,
        scale: a.scale,
      })),
      // Legacy single adapter fallback
      adapter_id: adapters[0]?.id,
      inputs: request.prompt,
      parameters: {
        max_new_tokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.7,
        do_sample: true,
        top_p: 0.9,
      },
      system_prompt: request.systemPrompt,
    };
    
    logger.debug('Invoking with adapter stack', {
      endpointName,
      adapterCount: adapters.length,
      adapters: adapters.map(a => a.name),
    });
    
    const response = await this.sagemakerClient.send(new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: JSON.stringify(payload),
    }));
    
    const result = JSON.parse(new TextDecoder().decode(response.Body));
    
    const content = result.generated_text || result.outputs || result[0]?.generated_text || '';
    const inputTokens = result.usage?.input_tokens || Math.ceil(request.prompt.length / 4);
    const outputTokens = result.usage?.output_tokens || Math.ceil(content.length / 4);
    const costCents = this.calculateSelfHostedCost(inputTokens, outputTokens);
    
    return {
      content,
      modelUsed: baseModel,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      costCents,
      adaptersUsedCount: adapters.length,
    };
  }

  /**
   * Record usage for all adapters in the stack
   */
  private async recordAdapterStackUsage(
    tenantId: string,
    stack: AdapterStack,
    response: LoRAInferenceResponse
  ): Promise<void> {
    const adapters = [
      stack.globalAdapter,
      stack.userAdapter,
      stack.domainAdapter,
    ].filter((a): a is LoRAAdapterInfo => !!a);

    for (const adapter of adapters) {
      await this.recordAdapterUsage(tenantId, adapter.adapterId, response);
    }
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
    // Determine adapter layer from database or infer from name
    let adapterLayer: 'global' | 'user' | 'domain' = 'domain';
    if (row.adapter_layer) {
      adapterLayer = row.adapter_layer as 'global' | 'user' | 'domain';
    } else if (row.user_id) {
      adapterLayer = 'user';
    } else if (String(row.adapter_name || '').toLowerCase().includes('cato') || 
               String(row.adapter_name || '').toLowerCase().includes('global')) {
      adapterLayer = 'global';
    }
    
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
      adapterLayer,
      isPinned: adapterLayer === 'global',
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
      adapters.map(a => {
        // Infer adapter layer from name or default to domain
        let adapterLayer: 'global' | 'user' | 'domain' = 'domain';
        if (a.adapterName.toLowerCase().includes('cato') || a.adapterName.toLowerCase().includes('global')) {
          adapterLayer = 'global';
        }
        
        return {
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
          adapterLayer,
          isPinned: adapterLayer === 'global',
        };
      })
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

  // ==========================================================================
  // Warm-Up / Boot Hydration
  // ==========================================================================

  /**
   * Warm up endpoints by pre-loading global "Cato" adapters
   * Called on container boot or deployment to eliminate cold-start latency
   * 
   * This ensures the first user request doesn't have to wait for adapter loading.
   */
  async warmUpGlobalAdapters(): Promise<WarmUpResult> {
    const startTime = Date.now();
    const results: WarmUpResult = {
      success: true,
      tenantsProcessed: 0,
      adaptersLoaded: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // Get all active tenants with LoRA enabled
      const tenantsResult = await executeStatement(
        `SELECT DISTINCT t.id as tenant_id, t.name as tenant_name
         FROM tenants t
         JOIN enhanced_learning_config elc ON t.id = elc.tenant_id
         WHERE elc.adapter_auto_selection_enabled = true
           AND t.status = 'active'
         LIMIT 100`, // Safety limit
        []
      );

      if (!tenantsResult.rows?.length) {
        logger.info('No tenants with LoRA enabled, skipping warm-up');
        results.durationMs = Date.now() - startTime;
        return results;
      }

      logger.info('Starting global adapter warm-up', {
        tenantCount: tenantsResult.rows.length,
      });

      for (const row of tenantsResult.rows) {
        const tenantId = String((row as Record<string, unknown>).tenant_id);
        const tenantName = String((row as Record<string, unknown>).tenant_name);

        try {
          // Get the global Cato adapter for this tenant
          const globalAdapter = await this.getGlobalCatoAdapter(tenantId, 'llama-3-70b');
          
          if (globalAdapter) {
            await this.ensureAdapterLoaded(tenantId, globalAdapter);
            results.adaptersLoaded++;
            logger.info('Warmed up global adapter', {
              tenantId,
              tenantName,
              adapterId: globalAdapter.adapterId,
              adapterName: globalAdapter.adapterName,
            });
          }

          results.tenantsProcessed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({ tenantId, error: errorMsg });
          logger.warn('Failed to warm up tenant', { tenantId, tenantName, error: errorMsg });
        }
      }

      results.durationMs = Date.now() - startTime;
      logger.info('Global adapter warm-up complete', {
        success: results.success,
        tenantsProcessed: results.tenantsProcessed,
        adaptersLoaded: results.adaptersLoaded,
        errorCount: results.errors.length,
        durationMs: results.durationMs,
      });
      return results;

    } catch (error) {
      results.success = false;
      results.errors.push({ tenantId: 'global', error: error instanceof Error ? error.message : 'Unknown' });
      results.durationMs = Date.now() - startTime;
      logger.error('Global adapter warm-up failed', { error });
      return results;
    }
  }

  /**
   * Warm up a specific endpoint by pre-loading its most-used adapters
   * Useful for warming up after endpoint scaling events
   */
  async warmUpEndpoint(endpointName: string, maxAdapters: number = 3): Promise<EndpointWarmUpResult> {
    const startTime = Date.now();
    const result: EndpointWarmUpResult = {
      endpointName,
      adaptersLoaded: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // Find most frequently used adapters for this endpoint
      const adaptersResult = await executeStatement(
        `SELECT dla.*, COUNT(aul.id) as usage_count
         FROM domain_lora_adapters dla
         LEFT JOIN adapter_usage_log aul ON dla.id::text = aul.adapter_id
         WHERE dla.status = 'active'
           AND (dla.adapter_layer = 'global' OR dla.adapter_name LIKE '%cato%')
         GROUP BY dla.id
         ORDER BY 
           CASE WHEN dla.adapter_layer = 'global' THEN 0 ELSE 1 END,
           usage_count DESC
         LIMIT $1`,
        [{ name: 'maxAdapters', value: { longValue: maxAdapters } }]
      );

      for (const row of adaptersResult.rows || []) {
        try {
          const adapter = this.mapAdapterRow(row as Record<string, unknown>);
          const tenantId = String((row as Record<string, unknown>).tenant_id);
          await this.ensureAdapterLoaded(tenantId, adapter);
          result.adaptersLoaded++;
        } catch (error) {
          result.errors.push(error instanceof Error ? error.message : 'Unknown');
        }
      }

      result.durationMs = Date.now() - startTime;
      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown');
      result.durationMs = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Health check for warm-up status
   * Returns which global adapters are currently loaded
   */
  async getWarmUpStatus(): Promise<WarmUpStatus> {
    const loadedGlobalAdapters: Array<{ endpointName: string; adapterId: string; adapterName: string }> = [];

    for (const [endpointName, adapters] of this.loadedAdapters) {
      for (const adapter of adapters) {
        if (adapter.isPinned) {
          loadedGlobalAdapters.push({
            endpointName,
            adapterId: adapter.adapterId,
            adapterName: adapter.adapterName,
          });
        }
      }
    }

    return {
      isWarmedUp: loadedGlobalAdapters.length > 0,
      loadedGlobalAdapters,
      endpointCount: this.loadedAdapters.size,
      totalLoadedAdapters: Array.from(this.loadedAdapters.values()).reduce((sum, a) => sum + a.length, 0),
    };
  }
}

// Warm-up result types
export interface WarmUpResult {
  success: boolean;
  tenantsProcessed: number;
  adaptersLoaded: number;
  errors: Array<{ tenantId: string; error: string }>;
  durationMs: number;
}

export interface EndpointWarmUpResult {
  endpointName: string;
  adaptersLoaded: number;
  errors: string[];
  durationMs: number;
}

export interface WarmUpStatus {
  isWarmedUp: boolean;
  loadedGlobalAdapters: Array<{ endpointName: string; adapterId: string; adapterName: string }>;
  endpointCount: number;
  totalLoadedAdapters: number;
}

export const loraInferenceService = new LoRAInferenceService();
