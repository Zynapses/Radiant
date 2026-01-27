/**
 * RADIANT v5.52.40 - Ghost Inference Admin API Handler
 * 
 * Provides admin endpoints for vLLM/Ghost Inference configuration management.
 * Enables runtime tuning of self-hosted LLaMA inference parameters.
 * 
 * Base path: /api/admin/ghost-inference
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  ghostInferenceConfigService, 
  UpdateConfigInput,
  GhostInferenceConfig 
} from '../shared/services/ghost-inference-config.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Response Helpers
// ============================================================================

const jsonResponse = (data: unknown, statusCode = 200): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  },
  body: JSON.stringify(data),
});

const errorResponse = (message: string, statusCode = 500): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify({ error: message }),
});

// ============================================================================
// Auth Helpers
// ============================================================================

const getTenantId = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.authorizer?.tenantId || 'demo-tenant';
};

const getUserId = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.authorizer?.userId || 'demo-user';
};

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/admin/ghost-inference/dashboard
 * Get complete dashboard data including config, active deployment, metrics, and instance types
 */
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const dashboard = await ghostInferenceConfigService.getDashboard(tenantId);
    return jsonResponse(dashboard);
  } catch (error) {
    logger.error('Failed to get ghost inference dashboard', { error });
    return errorResponse('Failed to get dashboard', 500);
  }
};

/**
 * GET /api/admin/ghost-inference/config
 * Get current configuration for the tenant
 */
export const getConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const config = await ghostInferenceConfigService.getConfig(tenantId);
    
    if (!config) {
      return jsonResponse({ configured: false, config: null });
    }
    
    return jsonResponse({ configured: true, config });
  } catch (error) {
    logger.error('Failed to get ghost inference config', { error });
    return errorResponse('Failed to get configuration', 500);
  }
};

/**
 * POST /api/admin/ghost-inference/config
 * Create initial configuration for the tenant
 */
export const createConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    // Check if config already exists
    const existing = await ghostInferenceConfigService.getConfig(tenantId);
    if (existing) {
      return errorResponse('Configuration already exists. Use PUT to update.', 409);
    }
    
    const config = await ghostInferenceConfigService.createConfig(tenantId, userId);
    
    logger.info('Created ghost inference config', { tenantId, userId });
    return jsonResponse(config, 201);
  } catch (error) {
    logger.error('Failed to create ghost inference config', { error });
    return errorResponse('Failed to create configuration', 500);
  }
};

/**
 * PUT /api/admin/ghost-inference/config
 * Update configuration for the tenant
 */
export const updateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }
    
    const updates: UpdateConfigInput = JSON.parse(event.body);
    
    // Validate updates
    const validationErrors = validateConfigUpdates(updates);
    if (validationErrors.length > 0) {
      return errorResponse(`Validation errors: ${validationErrors.join(', ')}`, 400);
    }
    
    const config = await ghostInferenceConfigService.updateConfig(tenantId, updates, userId);
    
    logger.info('Updated ghost inference config', { tenantId, userId, fields: Object.keys(updates) });
    return jsonResponse(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update configuration';
    logger.error('Failed to update ghost inference config', { error });
    return errorResponse(message, 500);
  }
};

/**
 * GET /api/admin/ghost-inference/instance-types
 * Get available SageMaker instance types for ghost inference
 */
export const getInstanceTypes: APIGatewayProxyHandler = async () => {
  try {
    const instanceTypes = await ghostInferenceConfigService.getInstanceTypes();
    return jsonResponse({ instanceTypes });
  } catch (error) {
    logger.error('Failed to get instance types', { error });
    return errorResponse('Failed to get instance types', 500);
  }
};

/**
 * GET /api/admin/ghost-inference/deployments
 * Get deployment history for the tenant
 */
export const getDeployments: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const limit = parseInt(event.queryStringParameters?.limit || '10', 10);
    
    const deployments = await ghostInferenceConfigService.getDeployments(tenantId, limit);
    return jsonResponse({ deployments });
  } catch (error) {
    logger.error('Failed to get deployments', { error });
    return errorResponse('Failed to get deployments', 500);
  }
};

/**
 * POST /api/admin/ghost-inference/deploy
 * Initiate a new deployment with current configuration
 */
export const initiateDeployment: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    const deployment = await ghostInferenceConfigService.initiateDeployment(tenantId, userId);
    
    logger.info('Initiated ghost inference deployment', { 
      tenantId, 
      userId, 
      deploymentId: deployment.id,
      endpointName: deployment.endpointName 
    });
    
    return jsonResponse(deployment, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initiate deployment';
    logger.error('Failed to initiate deployment', { error });
    return errorResponse(message, 500);
  }
};

/**
 * GET /api/admin/ghost-inference/deployments/:deploymentId
 * Get specific deployment details
 */
export const getDeployment: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const deploymentId = event.pathParameters?.deploymentId;
    
    if (!deploymentId) {
      return errorResponse('Deployment ID is required', 400);
    }
    
    const deployments = await ghostInferenceConfigService.getDeployments(tenantId, 100);
    const deployment = deployments.find(d => d.id === deploymentId);
    
    if (!deployment) {
      return errorResponse('Deployment not found', 404);
    }
    
    return jsonResponse(deployment);
  } catch (error) {
    logger.error('Failed to get deployment', { error });
    return errorResponse('Failed to get deployment', 500);
  }
};

/**
 * GET /api/admin/ghost-inference/endpoint-status
 * Get current SageMaker endpoint status
 */
export const getEndpointStatus: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const dashboard = await ghostInferenceConfigService.getDashboard(tenantId);
    
    if (!dashboard.activeDeployment?.endpointName) {
      return jsonResponse({ 
        hasEndpoint: false, 
        status: null,
        message: 'No active deployment' 
      });
    }
    
    const status = await ghostInferenceConfigService.getEndpointStatus(
      dashboard.activeDeployment.endpointName
    );
    
    if (!status) {
      return jsonResponse({ 
        hasEndpoint: false, 
        status: null,
        message: 'Endpoint not found in SageMaker' 
      });
    }
    
    return jsonResponse({
      hasEndpoint: true,
      endpointName: dashboard.activeDeployment.endpointName,
      ...status,
    });
  } catch (error) {
    logger.error('Failed to get endpoint status', { error });
    return errorResponse('Failed to get endpoint status', 500);
  }
};

/**
 * GET /api/admin/ghost-inference/vllm-env
 * Get the vLLM environment variables that would be used for deployment
 */
export const getVllmEnvironment: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const config = await ghostInferenceConfigService.getConfig(tenantId);
    
    if (!config) {
      return errorResponse('Configuration not found', 404);
    }
    
    const environment = ghostInferenceConfigService.buildVllmEnvironment(config);
    
    return jsonResponse({
      environment,
      description: 'These environment variables will be passed to the vLLM container on deployment',
    });
  } catch (error) {
    logger.error('Failed to get vLLM environment', { error });
    return errorResponse('Failed to get vLLM environment', 500);
  }
};

/**
 * POST /api/admin/ghost-inference/validate
 * Validate configuration without saving
 */
export const validateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }
    
    const config: UpdateConfigInput = JSON.parse(event.body);
    const errors = validateConfigUpdates(config);
    
    // Check tensor parallelism compatibility
    if (config.tensorParallelSize && config.instanceType) {
      const instanceTypes = await ghostInferenceConfigService.getInstanceTypes();
      const instanceType = instanceTypes.find(it => it.instanceType === config.instanceType);
      
      if (!instanceType) {
        errors.push(`Unknown instance type: ${config.instanceType}`);
      } else if (config.tensorParallelSize > instanceType.maxTensorParallel) {
        errors.push(
          `Tensor parallel size ${config.tensorParallelSize} exceeds maximum ` +
          `${instanceType.maxTensorParallel} for ${config.instanceType}`
        );
      }
    }
    
    // Estimate cost
    let estimatedHourlyCost: number | null = null;
    if (config.instanceType) {
      const instanceTypes = await ghostInferenceConfigService.getInstanceTypes();
      const instanceType = instanceTypes.find(it => it.instanceType === config.instanceType);
      if (instanceType) {
        const instanceCount = config.minInstances ?? 1;
        estimatedHourlyCost = instanceType.hourlyCostUsd * instanceCount;
      }
    }
    
    return jsonResponse({
      valid: errors.length === 0,
      errors,
      warnings: generateWarnings(config),
      estimatedHourlyCost,
      estimatedMonthlyCost: estimatedHourlyCost ? estimatedHourlyCost * 24 * 30 : null,
    });
  } catch (error) {
    logger.error('Failed to validate config', { error });
    return errorResponse('Failed to validate configuration', 500);
  }
};

// ============================================================================
// Main Router
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event, context) => {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/api\/admin\/ghost-inference\/?/, '');
  
  logger.info('Ghost inference API request', { method, path });
  
  try {
    // Route to appropriate handler
    if (method === 'GET' && path === 'dashboard') {
      return getDashboard(event, context, () => {});
    }
    if (method === 'GET' && path === 'config') {
      return getConfig(event, context, () => {});
    }
    if (method === 'POST' && path === 'config') {
      return createConfig(event, context, () => {});
    }
    if (method === 'PUT' && path === 'config') {
      return updateConfig(event, context, () => {});
    }
    if (method === 'GET' && path === 'instance-types') {
      return getInstanceTypes(event, context, () => {});
    }
    if (method === 'GET' && path === 'deployments') {
      return getDeployments(event, context, () => {});
    }
    if (method === 'POST' && path === 'deploy') {
      return initiateDeployment(event, context, () => {});
    }
    if (method === 'GET' && path.startsWith('deployments/')) {
      return getDeployment(event, context, () => {});
    }
    if (method === 'GET' && path === 'endpoint-status') {
      return getEndpointStatus(event, context, () => {});
    }
    if (method === 'GET' && path === 'vllm-env') {
      return getVllmEnvironment(event, context, () => {});
    }
    if (method === 'POST' && path === 'validate') {
      return validateConfig(event, context, () => {});
    }
    
    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Unhandled error in ghost inference API', { error });
    return errorResponse('Internal server error', 500);
  }
};

// ============================================================================
// Validation Helpers
// ============================================================================

function validateConfigUpdates(updates: UpdateConfigInput): string[] {
  const errors: string[] = [];
  
  if (updates.tensorParallelSize !== undefined) {
    if (![1, 2, 4, 8].includes(updates.tensorParallelSize)) {
      errors.push('tensorParallelSize must be 1, 2, 4, or 8');
    }
  }
  
  if (updates.maxModelLen !== undefined) {
    if (updates.maxModelLen < 1024 || updates.maxModelLen > 131072) {
      errors.push('maxModelLen must be between 1024 and 131072');
    }
  }
  
  if (updates.gpuMemoryUtilization !== undefined) {
    if (updates.gpuMemoryUtilization < 0.5 || updates.gpuMemoryUtilization > 0.99) {
      errors.push('gpuMemoryUtilization must be between 0.50 and 0.99');
    }
  }
  
  if (updates.hiddenStateLayer !== undefined) {
    if (updates.hiddenStateLayer < -80 || updates.hiddenStateLayer > 0) {
      errors.push('hiddenStateLayer must be between -80 and 0');
    }
  }
  
  if (updates.maxNumSeqs !== undefined) {
    if (updates.maxNumSeqs < 1 || updates.maxNumSeqs > 1024) {
      errors.push('maxNumSeqs must be between 1 and 1024');
    }
  }
  
  if (updates.swapSpaceGb !== undefined) {
    if (updates.swapSpaceGb < 0 || updates.swapSpaceGb > 64) {
      errors.push('swapSpaceGb must be between 0 and 64');
    }
  }
  
  if (updates.minInstances !== undefined && updates.maxInstances !== undefined) {
    if (updates.minInstances > updates.maxInstances) {
      errors.push('minInstances cannot exceed maxInstances');
    }
  }
  
  if (updates.maxConcurrentInvocations !== undefined) {
    if (updates.maxConcurrentInvocations < 1 || updates.maxConcurrentInvocations > 32) {
      errors.push('maxConcurrentInvocations must be between 1 and 32');
    }
  }
  
  if (updates.startupHealthCheckTimeoutSeconds !== undefined) {
    if (updates.startupHealthCheckTimeoutSeconds < 120 || updates.startupHealthCheckTimeoutSeconds > 1800) {
      errors.push('startupHealthCheckTimeoutSeconds must be between 120 and 1800');
    }
  }
  
  if (updates.dtype !== undefined) {
    if (!['float16', 'bfloat16', 'float32'].includes(updates.dtype)) {
      errors.push('dtype must be float16, bfloat16, or float32');
    }
  }
  
  if (updates.quantization !== undefined && updates.quantization !== null) {
    if (!['awq', 'gptq', 'squeezellm', 'fp8'].includes(updates.quantization)) {
      errors.push('quantization must be awq, gptq, squeezellm, fp8, or null');
    }
  }
  
  return errors;
}

function generateWarnings(config: UpdateConfigInput): string[] {
  const warnings: string[] = [];
  
  if (config.gpuMemoryUtilization && config.gpuMemoryUtilization > 0.95) {
    warnings.push('GPU memory utilization above 95% may cause OOM errors under load');
  }
  
  if (config.scaleToZero) {
    warnings.push('Scale-to-zero will cause cold starts (5-10 min startup time)');
  }
  
  if (config.enforceEager) {
    warnings.push('Eager mode disables CUDA graphs, reducing throughput but improving compatibility');
  }
  
  if (config.maxModelLen && config.maxModelLen > 32768) {
    warnings.push('Context lengths above 32k require significant GPU memory');
  }
  
  if (config.quantization) {
    warnings.push(`${config.quantization.toUpperCase()} quantization reduces memory but may impact quality`);
  }
  
  return warnings;
}
