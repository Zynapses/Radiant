/**
 * RADIANT v5.52.40 - Ghost Inference Configuration Service
 * 
 * Manages admin-configurable vLLM settings for ghost vector extraction.
 * Provides CRUD operations for ghost inference configuration and deployment management.
 */

import { executeStatement, stringParam, numberParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { SageMakerClient, DescribeEndpointCommand, UpdateEndpointCommand } from '@aws-sdk/client-sagemaker';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export type GhostInferenceDtype = 'float16' | 'bfloat16' | 'float32';
export type GhostInferenceStatus = 'active' | 'warming' | 'scaling' | 'error' | 'disabled';
export type DeploymentStatus = 'pending' | 'deploying' | 'active' | 'failed' | 'terminated';
export type QuantizationType = 'awq' | 'gptq' | 'squeezellm' | 'fp8' | null;

export interface GhostInferenceConfig {
  id: string;
  tenantId: string;
  
  // Model Configuration
  modelName: string;
  modelVersion: string | null;
  
  // vLLM Parameters
  tensorParallelSize: number;
  maxModelLen: number;
  dtype: GhostInferenceDtype;
  gpuMemoryUtilization: number;
  
  // Hidden State Extraction
  returnHiddenStates: boolean;
  hiddenStateLayer: number;
  ghostVectorDimension: number;
  
  // Performance Tuning
  maxNumSeqs: number;
  maxNumBatchedTokens: number | null;
  swapSpaceGb: number;
  enforceEager: boolean;
  
  // Quantization
  quantization: QuantizationType;
  
  // Infrastructure
  instanceType: string;
  minInstances: number;
  maxInstances: number;
  scaleToZero: boolean;
  warmupInstances: number;
  
  // Async Inference
  maxConcurrentInvocations: number;
  startupHealthCheckTimeoutSeconds: number;
  
  // Endpoint naming
  endpointNamePrefix: string;
  
  // Status
  status: GhostInferenceStatus;
  lastDeploymentAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface GhostInferenceDeployment {
  id: string;
  tenantId: string;
  configSnapshot: GhostInferenceConfig;
  endpointName: string;
  endpointArn: string | null;
  sagemakerModelName: string | null;
  status: DeploymentStatus;
  startedAt: string;
  completedAt: string | null;
  terminatedAt: string | null;
  startupDurationSeconds: number | null;
  totalInvocations: number;
  totalErrors: number;
  avgLatencyMs: number | null;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
  estimatedHourlyCost: number | null;
  actualCostUsd: number;
  createdBy: string | null;
}

export interface GhostInferenceInstanceType {
  instanceType: string;
  gpuCount: number;
  gpuType: string;
  gpuMemoryGb: number;
  vcpuCount: number;
  memoryGb: number;
  hourlyCostUsd: number;
  maxTensorParallel: number;
  recommendedFor: string[];
  isAvailable: boolean;
}

export interface GhostInferenceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  tokensProcessed: number;
  hiddenStatesExtracted: number;
  costUsd: number;
}

export interface GhostInferenceDashboard {
  config: GhostInferenceConfig | null;
  activeDeployment: GhostInferenceDeployment | null;
  metrics24h: GhostInferenceMetrics;
  instanceTypes: GhostInferenceInstanceType[];
}

export interface UpdateConfigInput {
  modelName?: string;
  modelVersion?: string | null;
  tensorParallelSize?: number;
  maxModelLen?: number;
  dtype?: GhostInferenceDtype;
  gpuMemoryUtilization?: number;
  returnHiddenStates?: boolean;
  hiddenStateLayer?: number;
  ghostVectorDimension?: number;
  maxNumSeqs?: number;
  maxNumBatchedTokens?: number | null;
  swapSpaceGb?: number;
  enforceEager?: boolean;
  quantization?: QuantizationType;
  instanceType?: string;
  minInstances?: number;
  maxInstances?: number;
  scaleToZero?: boolean;
  warmupInstances?: number;
  maxConcurrentInvocations?: number;
  startupHealthCheckTimeoutSeconds?: number;
  endpointNamePrefix?: string;
}

// ============================================================================
// Service
// ============================================================================

class GhostInferenceConfigService {
  private sagemakerClient: SageMakerClient;

  constructor() {
    this.sagemakerClient = new SageMakerClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  /**
   * Get the full dashboard data for a tenant
   */
  async getDashboard(tenantId: string): Promise<GhostInferenceDashboard> {
    try {
      const result = await executeStatement(
        `SELECT get_ghost_inference_dashboard($1) as dashboard`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length === 0) {
        return this.getEmptyDashboard();
      }

      const dashboard = (result.rows[0] as { dashboard: GhostInferenceDashboard }).dashboard;
      return this.transformDashboard(dashboard);
    } catch (error) {
      logger.error('Failed to get ghost inference dashboard', { tenantId, error });
      throw error;
    }
  }

  /**
   * Get or create config for a tenant
   */
  async getConfig(tenantId: string): Promise<GhostInferenceConfig | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM ghost_inference_config WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.transformConfig(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      logger.error('Failed to get ghost inference config', { tenantId, error });
      throw error;
    }
  }

  /**
   * Create default config for a tenant
   */
  async createConfig(tenantId: string, userId?: string): Promise<GhostInferenceConfig> {
    try {
      const result = await executeStatement(
        `INSERT INTO ghost_inference_config (tenant_id, created_by, updated_by)
         VALUES ($1, $2, $2)
         RETURNING *`,
        [
          stringParam('tenantId', tenantId),
          userId ? stringParam('userId', userId) : stringParam('userId', ''),
        ]
      );

      logger.info('Created ghost inference config', { tenantId });
      return this.transformConfig(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      logger.error('Failed to create ghost inference config', { tenantId, error });
      throw error;
    }
  }

  /**
   * Update config for a tenant
   */
  async updateConfig(
    tenantId: string,
    updates: UpdateConfigInput,
    userId?: string
  ): Promise<GhostInferenceConfig> {
    try {
      // Validate tensor parallel size against instance type
      if (updates.tensorParallelSize || updates.instanceType) {
        await this.validateTensorParallelism(
          tenantId,
          updates.tensorParallelSize,
          updates.instanceType
        );
      }

      // Build dynamic update query
      const setClauses: string[] = [];
      const params: Array<{ name: string; value: { stringValue?: string; longValue?: number; booleanValue?: boolean; doubleValue?: number } }> = [
        stringParam('tenantId', tenantId),
      ];
      let paramIndex = 2;

      const fieldMappings: Record<string, string> = {
        modelName: 'model_name',
        modelVersion: 'model_version',
        tensorParallelSize: 'tensor_parallel_size',
        maxModelLen: 'max_model_len',
        dtype: 'dtype',
        gpuMemoryUtilization: 'gpu_memory_utilization',
        returnHiddenStates: 'return_hidden_states',
        hiddenStateLayer: 'hidden_state_layer',
        ghostVectorDimension: 'ghost_vector_dimension',
        maxNumSeqs: 'max_num_seqs',
        maxNumBatchedTokens: 'max_num_batched_tokens',
        swapSpaceGb: 'swap_space_gb',
        enforceEager: 'enforce_eager',
        quantization: 'quantization',
        instanceType: 'instance_type',
        minInstances: 'min_instances',
        maxInstances: 'max_instances',
        scaleToZero: 'scale_to_zero',
        warmupInstances: 'warmup_instances',
        maxConcurrentInvocations: 'max_concurrent_invocations',
        startupHealthCheckTimeoutSeconds: 'startup_health_check_timeout_seconds',
        endpointNamePrefix: 'endpoint_name_prefix',
      };

      for (const [key, dbColumn] of Object.entries(fieldMappings)) {
        const value = updates[key as keyof UpdateConfigInput];
        if (value !== undefined) {
          setClauses.push(`${dbColumn} = $${paramIndex}`);
          
          if (typeof value === 'boolean') {
            params.push(boolParam(key, value));
          } else if (typeof value === 'number') {
            params.push(numberParam(key, value));
          } else {
            params.push(stringParam(key, value as string));
          }
          paramIndex++;
        }
      }

      if (userId) {
        setClauses.push(`updated_by = $${paramIndex}`);
        params.push(stringParam('userId', userId));
      }

      if (setClauses.length === 0) {
        const existing = await this.getConfig(tenantId);
        if (!existing) throw new Error('Config not found');
        return existing;
      }

      const result = await executeStatement(
        `UPDATE ghost_inference_config 
         SET ${setClauses.join(', ')}
         WHERE tenant_id = $1
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        throw new Error('Config not found');
      }

      logger.info('Updated ghost inference config', { tenantId, updates: Object.keys(updates) });
      return this.transformConfig(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      logger.error('Failed to update ghost inference config', { tenantId, error });
      throw error;
    }
  }

  /**
   * Get available instance types
   */
  async getInstanceTypes(): Promise<GhostInferenceInstanceType[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM ghost_inference_instance_types WHERE is_available = true ORDER BY hourly_cost_usd`,
        []
      );

      return result.rows.map((row) => this.transformInstanceType(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to get instance types', { error });
      throw error;
    }
  }

  /**
   * Get deployment history for a tenant
   */
  async getDeployments(
    tenantId: string,
    limit: number = 10
  ): Promise<GhostInferenceDeployment[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM ghost_inference_deployments 
         WHERE tenant_id = $1 
         ORDER BY started_at DESC 
         LIMIT $2`,
        [stringParam('tenantId', tenantId), numberParam('limit', limit)]
      );

      return result.rows.map((row) => this.transformDeployment(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to get deployments', { tenantId, error });
      throw error;
    }
  }

  /**
   * Initiate a new deployment
   */
  async initiateDeployment(tenantId: string, userId?: string): Promise<GhostInferenceDeployment> {
    try {
      const config = await this.getConfig(tenantId);
      if (!config) {
        throw new Error('No configuration found. Please configure ghost inference first.');
      }

      // Generate unique endpoint name
      const environment = process.env.ENVIRONMENT || 'dev';
      const endpointName = `${config.endpointNamePrefix}-${environment}-${Date.now()}`;

      // Create deployment record
      const result = await executeStatement(
        `INSERT INTO ghost_inference_deployments (
           tenant_id, config_snapshot, endpoint_name, status, created_by
         ) VALUES ($1, $2, $3, 'pending', $4)
         RETURNING *`,
        [
          stringParam('tenantId', tenantId),
          stringParam('configSnapshot', JSON.stringify(config)),
          stringParam('endpointName', endpointName),
          userId ? stringParam('userId', userId) : stringParam('userId', ''),
        ]
      );

      // Update config status
      await executeStatement(
        `UPDATE ghost_inference_config SET status = 'warming' WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      logger.info('Initiated ghost inference deployment', { tenantId, endpointName });
      return this.transformDeployment(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      logger.error('Failed to initiate deployment', { tenantId, error });
      throw error;
    }
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(
    deploymentId: string,
    status: DeploymentStatus,
    details?: {
      endpointArn?: string;
      sagemakerModelName?: string;
      errorMessage?: string;
      errorDetails?: Record<string, unknown>;
      startupDurationSeconds?: number;
    }
  ): Promise<void> {
    try {
      const setClauses = ['status = $2'];
      const params: Array<{ name: string; value: { stringValue?: string; longValue?: number } }> = [
        stringParam('deploymentId', deploymentId),
        stringParam('status', status),
      ];
      let paramIndex = 3;

      if (status === 'active') {
        setClauses.push(`completed_at = CURRENT_TIMESTAMP`);
      } else if (status === 'terminated') {
        setClauses.push(`terminated_at = CURRENT_TIMESTAMP`);
      }

      if (details?.endpointArn) {
        setClauses.push(`endpoint_arn = $${paramIndex++}`);
        params.push(stringParam('endpointArn', details.endpointArn));
      }
      if (details?.sagemakerModelName) {
        setClauses.push(`sagemaker_model_name = $${paramIndex++}`);
        params.push(stringParam('sagemakerModelName', details.sagemakerModelName));
      }
      if (details?.errorMessage) {
        setClauses.push(`error_message = $${paramIndex++}`);
        params.push(stringParam('errorMessage', details.errorMessage));
      }
      if (details?.errorDetails) {
        setClauses.push(`error_details = $${paramIndex++}`);
        params.push(stringParam('errorDetails', JSON.stringify(details.errorDetails)));
      }
      if (details?.startupDurationSeconds !== undefined) {
        setClauses.push(`startup_duration_seconds = $${paramIndex++}`);
        params.push(numberParam('startupDurationSeconds', details.startupDurationSeconds));
      }

      await executeStatement(
        `UPDATE ghost_inference_deployments SET ${setClauses.join(', ')} WHERE id = $1`,
        params
      );

      // Update config status based on deployment status
      if (status === 'active' || status === 'failed' || status === 'terminated') {
        const configStatus: GhostInferenceStatus = 
          status === 'active' ? 'active' : 
          status === 'failed' ? 'error' : 'disabled';

        await executeStatement(
          `UPDATE ghost_inference_config 
           SET status = $2, 
               last_deployment_at = CASE WHEN $2 = 'active' THEN CURRENT_TIMESTAMP ELSE last_deployment_at END,
               last_error = CASE WHEN $2 = 'error' THEN $3 ELSE NULL END,
               last_error_at = CASE WHEN $2 = 'error' THEN CURRENT_TIMESTAMP ELSE NULL END
           FROM ghost_inference_deployments d
           WHERE ghost_inference_config.tenant_id = d.tenant_id AND d.id = $1`,
          [
            stringParam('deploymentId', deploymentId),
            stringParam('status', configStatus),
            stringParam('errorMessage', details?.errorMessage || ''),
          ]
        );
      }

      logger.info('Updated deployment status', { deploymentId, status });
    } catch (error) {
      logger.error('Failed to update deployment status', { deploymentId, error });
      throw error;
    }
  }

  /**
   * Record metrics
   */
  async recordMetrics(
    tenantId: string,
    deploymentId: string,
    metrics: {
      windowStart: Date;
      windowEnd: Date;
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      avgLatencyMs?: number;
      p50LatencyMs?: number;
      p95LatencyMs?: number;
      p99LatencyMs?: number;
      maxLatencyMs?: number;
      tokensProcessed?: number;
      hiddenStatesExtracted?: number;
      avgGpuUtilization?: number;
      avgGpuMemoryUtilization?: number;
      avgCpuUtilization?: number;
      activeInstances?: number;
      costUsd?: number;
    }
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO ghost_inference_metrics (
           tenant_id, deployment_id, window_start, window_end,
           total_requests, successful_requests, failed_requests,
           avg_latency_ms, p50_latency_ms, p95_latency_ms, p99_latency_ms, max_latency_ms,
           tokens_processed, hidden_states_extracted,
           avg_gpu_utilization, avg_gpu_memory_utilization, avg_cpu_utilization,
           active_instances, cost_usd
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('deploymentId', deploymentId),
          stringParam('windowStart', metrics.windowStart.toISOString()),
          stringParam('windowEnd', metrics.windowEnd.toISOString()),
          numberParam('totalRequests', metrics.totalRequests),
          numberParam('successfulRequests', metrics.successfulRequests),
          numberParam('failedRequests', metrics.failedRequests),
          numberParam('avgLatencyMs', metrics.avgLatencyMs || 0),
          numberParam('p50LatencyMs', metrics.p50LatencyMs || 0),
          numberParam('p95LatencyMs', metrics.p95LatencyMs || 0),
          numberParam('p99LatencyMs', metrics.p99LatencyMs || 0),
          numberParam('maxLatencyMs', metrics.maxLatencyMs || 0),
          numberParam('tokensProcessed', metrics.tokensProcessed || 0),
          numberParam('hiddenStatesExtracted', metrics.hiddenStatesExtracted || 0),
          numberParam('avgGpuUtilization', metrics.avgGpuUtilization || 0),
          numberParam('avgGpuMemoryUtilization', metrics.avgGpuMemoryUtilization || 0),
          numberParam('avgCpuUtilization', metrics.avgCpuUtilization || 0),
          numberParam('activeInstances', metrics.activeInstances || 0),
          numberParam('costUsd', metrics.costUsd || 0),
        ]
      );
    } catch (error) {
      logger.error('Failed to record metrics', { tenantId, deploymentId, error });
      throw error;
    }
  }

  /**
   * Get endpoint status from SageMaker
   */
  async getEndpointStatus(endpointName: string): Promise<{
    status: string;
    instanceCount: number;
    lastModifiedTime: Date | null;
  } | null> {
    try {
      const response = await this.sagemakerClient.send(
        new DescribeEndpointCommand({ EndpointName: endpointName })
      );

      return {
        status: response.EndpointStatus || 'Unknown',
        instanceCount: response.ProductionVariants?.[0]?.CurrentInstanceCount || 0,
        lastModifiedTime: response.LastModifiedTime || null,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'ResourceNotFoundException') {
        return null;
      }
      logger.error('Failed to get endpoint status', { endpointName, error });
      throw error;
    }
  }

  /**
   * Build vLLM environment variables from config
   */
  buildVllmEnvironment(config: GhostInferenceConfig): Record<string, string> {
    const env: Record<string, string> = {
      'VLLM_MODEL_NAME': config.modelName,
      'VLLM_TENSOR_PARALLEL_SIZE': config.tensorParallelSize.toString(),
      'VLLM_MAX_MODEL_LEN': config.maxModelLen.toString(),
      'VLLM_DTYPE': config.dtype,
      'VLLM_GPU_MEMORY_UTILIZATION': config.gpuMemoryUtilization.toString(),
      'VLLM_RETURN_HIDDEN_STATES': config.returnHiddenStates.toString(),
      'VLLM_HIDDEN_STATE_LAYER': config.hiddenStateLayer.toString(),
      'VLLM_MAX_NUM_SEQS': config.maxNumSeqs.toString(),
      'VLLM_SWAP_SPACE': config.swapSpaceGb.toString(),
      'VLLM_ENFORCE_EAGER': config.enforceEager.toString(),
    };

    if (config.maxNumBatchedTokens) {
      env['VLLM_MAX_NUM_BATCHED_TOKENS'] = config.maxNumBatchedTokens.toString();
    }

    if (config.quantization) {
      env['VLLM_QUANTIZATION'] = config.quantization;
    }

    if (config.modelVersion && config.modelVersion !== 'latest') {
      env['VLLM_REVISION'] = config.modelVersion;
    }

    return env;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async validateTensorParallelism(
    tenantId: string,
    tensorParallelSize?: number,
    instanceType?: string
  ): Promise<void> {
    // Get current config if needed
    let currentConfig: GhostInferenceConfig | null = null;
    if (!tensorParallelSize || !instanceType) {
      currentConfig = await this.getConfig(tenantId);
    }

    const tp = tensorParallelSize ?? currentConfig?.tensorParallelSize ?? 4;
    const it = instanceType ?? currentConfig?.instanceType ?? 'ml.g5.12xlarge';

    // Get instance type info
    const result = await executeStatement(
      `SELECT max_tensor_parallel FROM ghost_inference_instance_types WHERE instance_type = $1`,
      [stringParam('instanceType', it)]
    );

    if (result.rows.length === 0) {
      throw new Error(`Unknown instance type: ${it}`);
    }

    const maxTp = (result.rows[0] as { max_tensor_parallel: number }).max_tensor_parallel;
    if (tp > maxTp) {
      throw new Error(
        `Tensor parallel size ${tp} exceeds maximum ${maxTp} for instance type ${it}`
      );
    }
  }

  private getEmptyDashboard(): GhostInferenceDashboard {
    return {
      config: null,
      activeDeployment: null,
      metrics24h: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatencyMs: null,
        p95LatencyMs: null,
        tokensProcessed: 0,
        hiddenStatesExtracted: 0,
        costUsd: 0,
      },
      instanceTypes: [],
    };
  }

  private transformDashboard(raw: GhostInferenceDashboard): GhostInferenceDashboard {
    return {
      config: raw.config ? this.transformConfig(raw.config as unknown as Record<string, unknown>) : null,
      activeDeployment: raw.activeDeployment 
        ? this.transformDeployment(raw.activeDeployment as unknown as Record<string, unknown>) 
        : null,
      metrics24h: raw.metrics24h || this.getEmptyDashboard().metrics24h,
      instanceTypes: (raw.instanceTypes || []).map((it) => 
        this.transformInstanceType(it as unknown as Record<string, unknown>)
      ),
    };
  }

  private transformConfig(row: Record<string, unknown>): GhostInferenceConfig {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      modelName: row.model_name as string,
      modelVersion: row.model_version as string | null,
      tensorParallelSize: row.tensor_parallel_size as number,
      maxModelLen: row.max_model_len as number,
      dtype: row.dtype as GhostInferenceDtype,
      gpuMemoryUtilization: parseFloat(row.gpu_memory_utilization as string),
      returnHiddenStates: row.return_hidden_states as boolean,
      hiddenStateLayer: row.hidden_state_layer as number,
      ghostVectorDimension: row.ghost_vector_dimension as number,
      maxNumSeqs: row.max_num_seqs as number,
      maxNumBatchedTokens: row.max_num_batched_tokens as number | null,
      swapSpaceGb: row.swap_space_gb as number,
      enforceEager: row.enforce_eager as boolean,
      quantization: row.quantization as QuantizationType,
      instanceType: row.instance_type as string,
      minInstances: row.min_instances as number,
      maxInstances: row.max_instances as number,
      scaleToZero: row.scale_to_zero as boolean,
      warmupInstances: row.warmup_instances as number,
      maxConcurrentInvocations: row.max_concurrent_invocations as number,
      startupHealthCheckTimeoutSeconds: row.startup_health_check_timeout_seconds as number,
      endpointNamePrefix: row.endpoint_name_prefix as string,
      status: row.status as GhostInferenceStatus,
      lastDeploymentAt: row.last_deployment_at as string | null,
      lastError: row.last_error as string | null,
      lastErrorAt: row.last_error_at as string | null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      createdBy: row.created_by as string | null,
      updatedBy: row.updated_by as string | null,
    };
  }

  private transformDeployment(row: Record<string, unknown>): GhostInferenceDeployment {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      configSnapshot: typeof row.config_snapshot === 'string' 
        ? JSON.parse(row.config_snapshot) 
        : row.config_snapshot as GhostInferenceConfig,
      endpointName: row.endpoint_name as string,
      endpointArn: row.endpoint_arn as string | null,
      sagemakerModelName: row.sagemaker_model_name as string | null,
      status: row.status as DeploymentStatus,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | null,
      terminatedAt: row.terminated_at as string | null,
      startupDurationSeconds: row.startup_duration_seconds as number | null,
      totalInvocations: row.total_invocations as number || 0,
      totalErrors: row.total_errors as number || 0,
      avgLatencyMs: row.avg_latency_ms ? parseFloat(row.avg_latency_ms as string) : null,
      errorMessage: row.error_message as string | null,
      errorDetails: row.error_details as Record<string, unknown> | null,
      estimatedHourlyCost: row.estimated_hourly_cost 
        ? parseFloat(row.estimated_hourly_cost as string) 
        : null,
      actualCostUsd: parseFloat(row.actual_cost_usd as string) || 0,
      createdBy: row.created_by as string | null,
    };
  }

  private transformInstanceType(row: Record<string, unknown>): GhostInferenceInstanceType {
    return {
      instanceType: row.instance_type as string,
      gpuCount: row.gpu_count as number,
      gpuType: row.gpu_type as string,
      gpuMemoryGb: row.gpu_memory_gb as number,
      vcpuCount: row.vcpu_count as number,
      memoryGb: row.memory_gb as number,
      hourlyCostUsd: parseFloat(row.hourly_cost_usd as string),
      maxTensorParallel: row.max_tensor_parallel as number,
      recommendedFor: row.recommended_for as string[],
      isAvailable: row.is_available as boolean,
    };
  }
}

export const ghostInferenceConfigService = new GhostInferenceConfigService();
