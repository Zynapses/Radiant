// RADIANT v5.2.1 - SageMaker Inference Components Service
// Manages multi-model hosting with reduced cold starts via Inference Components
// Now with resilience patterns: circuit breaker, retry, timeout

import {
  SageMakerClient,
  CreateInferenceComponentCommand,
  DeleteInferenceComponentCommand,
  DescribeInferenceComponentCommand,
  UpdateInferenceComponentCommand,
  ListInferenceComponentsCommand,
  CreateEndpointCommand,
  DescribeEndpointCommand,
  UpdateEndpointCommand,
  DeleteEndpointCommand,
  CreateEndpointConfigCommand,
  CreateModelCommand,
  ProductionVariantInstanceType,
} from '@aws-sdk/client-sagemaker';
import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { callWithResilience } from './resilient-provider.service';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import type {
  InferenceComponent,
  InferenceComponentStatus,
  InferenceFramework,
  SharedInferenceEndpoint,
  SharedEndpointStatus,
  ModelHostingTier,
  TierAssignment,
  TierTransition,
  TierThresholds,
  ComponentLoadRequest,
  ComponentLoadResult,
  ModelRoutingDecision,
  RoutingTarget,
  InferenceComponentsConfig,
  InferenceComponentsDashboard,
} from '@radiant/shared';
import { DEFAULT_TIER_THRESHOLDS } from '@radiant/shared';

// ============================================================================
// Configuration
// ============================================================================

const sagemaker = new SageMakerClient({});
const sagemakerRuntime = new SageMakerRuntimeClient({});

const REGION = process.env.AWS_REGION || 'us-east-1';
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID || '';

// Cost estimates per instance type (hourly)
const INSTANCE_COSTS: Record<string, number> = {
  'ml.g5.xlarge': 1.408,
  'ml.g5.2xlarge': 2.816,
  'ml.g5.4xlarge': 5.632,
  'ml.g5.8xlarge': 11.264,
  'ml.g5.12xlarge': 16.896,
  'ml.p4d.24xlarge': 37.688,
  'ml.inf2.xlarge': 0.758,
  'ml.inf2.8xlarge': 2.273,
};

// ============================================================================
// Inference Components Service
// ============================================================================

class InferenceComponentsService {
  // ==========================================================================
  // Configuration Management
  // ==========================================================================

  async getConfig(tenantId: string): Promise<InferenceComponentsConfig> {
    const result = await executeStatement(
      `SELECT * FROM inference_components_config WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) {
      return this.createDefaultConfig(tenantId);
    }

    return this.mapConfig(result.rows[0] as Record<string, unknown>);
  }

  async updateConfig(
    tenantId: string,
    updates: Partial<InferenceComponentsConfig>
  ): Promise<InferenceComponentsConfig> {
    const config = await this.getConfig(tenantId);
    const merged = { ...config, ...updates };

    await executeStatement(
      `UPDATE inference_components_config SET
        enabled = $2,
        auto_tiering_enabled = $3,
        predictive_loading_enabled = $4,
        fallback_to_external_enabled = $5,
        tier_thresholds = $6,
        default_instance_type = $7,
        max_shared_endpoints = $8,
        max_components_per_endpoint = $9,
        default_load_timeout_ms = $10,
        preload_window_minutes = $11,
        unload_after_idle_minutes = $12,
        max_monthly_budget = $13,
        alert_threshold_percent = $14,
        notify_on_tier_change = $15,
        notify_on_load_failure = $16,
        notify_on_budget_alert = $17,
        updated_at = NOW()
      WHERE tenant_id = $1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'enabled', value: { booleanValue: merged.enabled } },
        { name: 'autoTiering', value: { booleanValue: merged.autoTieringEnabled } },
        { name: 'predictive', value: { booleanValue: merged.predictiveLoadingEnabled } },
        { name: 'fallback', value: { booleanValue: merged.fallbackToExternalEnabled } },
        { name: 'thresholds', value: { stringValue: JSON.stringify(merged.tierThresholds) } },
        { name: 'instanceType', value: { stringValue: merged.defaultInstanceType } },
        { name: 'maxEndpoints', value: { longValue: merged.maxSharedEndpoints } },
        { name: 'maxComponents', value: { longValue: merged.maxComponentsPerEndpoint } },
        { name: 'loadTimeout', value: { longValue: merged.defaultLoadTimeoutMs } },
        { name: 'preloadWindow', value: { longValue: merged.preloadWindowMinutes } },
        { name: 'unloadIdle', value: { longValue: merged.unloadAfterIdleMinutes } },
        { name: 'budget', value: merged.maxMonthlyBudget ? { doubleValue: merged.maxMonthlyBudget } : { isNull: true } },
        { name: 'alertThreshold', value: { longValue: merged.alertThresholdPercent } },
        { name: 'notifyTier', value: { booleanValue: merged.notifyOnTierChange } },
        { name: 'notifyLoad', value: { booleanValue: merged.notifyOnLoadFailure } },
        { name: 'notifyBudget', value: { booleanValue: merged.notifyOnBudgetAlert } },
      ]
    );

    return this.getConfig(tenantId);
  }

  private async createDefaultConfig(tenantId: string): Promise<InferenceComponentsConfig> {
    const now = new Date().toISOString();
    await executeStatement(
      `INSERT INTO inference_components_config (
        tenant_id, enabled, auto_tiering_enabled, predictive_loading_enabled,
        fallback_to_external_enabled, tier_thresholds, default_instance_type,
        max_shared_endpoints, max_components_per_endpoint, default_load_timeout_ms,
        preload_window_minutes, unload_after_idle_minutes, alert_threshold_percent,
        notify_on_tier_change, notify_on_load_failure, notify_on_budget_alert
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (tenant_id) DO NOTHING`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'enabled', value: { booleanValue: true } },
        { name: 'autoTiering', value: { booleanValue: true } },
        { name: 'predictive', value: { booleanValue: true } },
        { name: 'fallback', value: { booleanValue: true } },
        { name: 'thresholds', value: { stringValue: JSON.stringify(DEFAULT_TIER_THRESHOLDS) } },
        { name: 'instanceType', value: { stringValue: 'ml.g5.xlarge' } },
        { name: 'maxEndpoints', value: { longValue: 3 } },
        { name: 'maxComponents', value: { longValue: 15 } },
        { name: 'loadTimeout', value: { longValue: 30000 } },
        { name: 'preloadWindow', value: { longValue: 15 } },
        { name: 'unloadIdle', value: { longValue: 30 } },
        { name: 'alertThreshold', value: { longValue: 80 } },
        { name: 'notifyTier', value: { booleanValue: true } },
        { name: 'notifyLoad', value: { booleanValue: true } },
        { name: 'notifyBudget', value: { booleanValue: true } },
      ]
    );

    return {
      tenantId,
      enabled: true,
      autoTieringEnabled: true,
      predictiveLoadingEnabled: true,
      fallbackToExternalEnabled: true,
      tierThresholds: DEFAULT_TIER_THRESHOLDS,
      defaultInstanceType: 'ml.g5.xlarge',
      maxSharedEndpoints: 3,
      maxComponentsPerEndpoint: 15,
      defaultLoadTimeoutMs: 30000,
      preloadWindowMinutes: 15,
      unloadAfterIdleMinutes: 30,
      alertThresholdPercent: 80,
      notifyOnTierChange: true,
      notifyOnLoadFailure: true,
      notifyOnBudgetAlert: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ==========================================================================
  // Shared Endpoint Management
  // ==========================================================================

  async createSharedEndpoint(
    tenantId: string,
    instanceType: string,
    instanceCount: number = 1
  ): Promise<SharedInferenceEndpoint> {
    const endpointName = `radiant-shared-${tenantId.substring(0, 8)}-${Date.now()}`;
    const configName = `${endpointName}-config`;

    logger.info('Creating shared inference endpoint', { tenantId, endpointName, instanceType });

    // Create endpoint config
    await sagemaker.send(new CreateEndpointConfigCommand({
      EndpointConfigName: configName,
      ExecutionRoleArn: process.env.SAGEMAKER_EXECUTION_ROLE_ARN,
      ProductionVariants: [{
        VariantName: 'AllTraffic',
        InstanceType: instanceType as ProductionVariantInstanceType,
        InitialInstanceCount: instanceCount,
        ModelDataDownloadTimeoutInSeconds: 3600,
        ContainerStartupHealthCheckTimeoutInSeconds: 600,
      }],
    }));

    // Create endpoint
    await sagemaker.send(new CreateEndpointCommand({
      EndpointName: endpointName,
      EndpointConfigName: configName,
    }));

    const endpointArn = `arn:aws:sagemaker:${REGION}:${ACCOUNT_ID}:endpoint/${endpointName}`;
    const totalUnits = this.calculateComputeUnits(instanceType) * instanceCount;
    const hourlyCost = (INSTANCE_COSTS[instanceType] || 2.0) * instanceCount;

    // Store in database
    await executeStatement(
      `INSERT INTO shared_inference_endpoints (
        endpoint_name, endpoint_arn, tenant_id, instance_type, instance_count,
        total_compute_units, allocated_compute_units, available_compute_units,
        component_count, max_components, status, hourly_base_cost
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, $6, 0, $7, 'creating', $8)
      RETURNING endpoint_id`,
      [
        { name: 'name', value: { stringValue: endpointName } },
        { name: 'arn', value: { stringValue: endpointArn } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'instanceType', value: { stringValue: instanceType } },
        { name: 'instanceCount', value: { longValue: instanceCount } },
        { name: 'totalUnits', value: { longValue: totalUnits } },
        { name: 'maxComponents', value: { longValue: 15 } },
        { name: 'hourlyCost', value: { doubleValue: hourlyCost } },
      ]
    );

    // Wait for endpoint to be in service
    await this.waitForEndpointReady(endpointName);

    return this.getSharedEndpoint(endpointName);
  }

  async getSharedEndpoint(endpointName: string): Promise<SharedInferenceEndpoint> {
    const result = await executeStatement(
      `SELECT * FROM shared_inference_endpoints WHERE endpoint_name = $1`,
      [{ name: 'name', value: { stringValue: endpointName } }]
    );

    if (result.rows.length === 0) {
      throw new Error(`Shared endpoint ${endpointName} not found`);
    }

    return this.mapSharedEndpoint(result.rows[0] as Record<string, unknown>);
  }

  async listSharedEndpoints(tenantId: string): Promise<SharedInferenceEndpoint[]> {
    const result = await executeStatement(
      `SELECT * FROM shared_inference_endpoints WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapSharedEndpoint(row as Record<string, unknown>));
  }

  async findAvailableEndpoint(tenantId: string, requiredUnits: number): Promise<SharedInferenceEndpoint | null> {
    const result = await executeStatement(
      `SELECT * FROM shared_inference_endpoints 
       WHERE tenant_id = $1 
         AND status = 'in_service' 
         AND available_compute_units >= $2
         AND component_count < max_components
       ORDER BY available_compute_units ASC
       LIMIT 1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'requiredUnits', value: { longValue: requiredUnits } },
      ]
    );

    if (result.rows.length === 0) return null;
    return this.mapSharedEndpoint(result.rows[0] as Record<string, unknown>);
  }

  async deleteSharedEndpoint(endpointName: string): Promise<void> {
    logger.info('Deleting shared endpoint', { endpointName });

    // Delete from SageMaker
    await sagemaker.send(new DeleteEndpointCommand({
      EndpointName: endpointName,
    }));

    // Update database
    await executeStatement(
      `UPDATE shared_inference_endpoints SET status = 'deleting', updated_at = NOW() WHERE endpoint_name = $1`,
      [{ name: 'name', value: { stringValue: endpointName } }]
    );
  }

  private async waitForEndpointReady(endpointName: string, maxWaitMs: number = 600000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const response = await sagemaker.send(new DescribeEndpointCommand({
        EndpointName: endpointName,
      }));

      if (response.EndpointStatus === 'InService') {
        await executeStatement(
          `UPDATE shared_inference_endpoints SET status = 'in_service', updated_at = NOW() WHERE endpoint_name = $1`,
          [{ name: 'name', value: { stringValue: endpointName } }]
        );
        return;
      }

      if (response.EndpointStatus === 'Failed') {
        throw new Error(`Endpoint ${endpointName} failed to create: ${response.FailureReason}`);
      }

      await this.sleep(10000);
    }

    throw new Error(`Timeout waiting for endpoint ${endpointName} to be ready`);
  }

  // ==========================================================================
  // Inference Component Management
  // ==========================================================================

  async createInferenceComponent(
    tenantId: string,
    modelId: string,
    modelName: string,
    modelArtifactS3Uri: string,
    containerImage: string,
    framework: InferenceFramework,
    frameworkVersion: string,
    computeUnits: number = 1
  ): Promise<InferenceComponent> {
    logger.info('Creating inference component', { tenantId, modelId, modelName });

    // Find or create a shared endpoint
    let endpoint = await this.findAvailableEndpoint(tenantId, computeUnits);
    if (!endpoint) {
      const config = await this.getConfig(tenantId);
      endpoint = await this.createSharedEndpoint(tenantId, config.defaultInstanceType);
    }

    const componentName = `${modelId.replace(/[^a-zA-Z0-9-]/g, '-')}-${Date.now()}`;

    // Create SageMaker model first
    const sagemakerModelName = `radiant-model-${modelId.substring(0, 20)}-${Date.now()}`;
    await sagemaker.send(new CreateModelCommand({
      ModelName: sagemakerModelName,
      PrimaryContainer: {
        Image: containerImage,
        ModelDataUrl: modelArtifactS3Uri,
        Environment: {
          SAGEMAKER_PROGRAM: 'inference.py',
          SAGEMAKER_SUBMIT_DIRECTORY: modelArtifactS3Uri,
        },
      },
      ExecutionRoleArn: process.env.SAGEMAKER_EXECUTION_ROLE_ARN,
    }));

    // Create inference component
    await sagemaker.send(new CreateInferenceComponentCommand({
      InferenceComponentName: componentName,
      EndpointName: endpoint.endpointName,
      VariantName: 'AllTraffic',
      Specification: {
        ModelName: sagemakerModelName,
        ComputeResourceRequirements: {
          NumberOfCpuCoresRequired: computeUnits,
          MinMemoryRequiredInMb: computeUnits * 4096,
        },
      },
      RuntimeConfig: {
        CopyCount: 1,
      },
    }));

    // Store in database
    const result = await executeStatement(
      `INSERT INTO inference_components (
        component_name, model_id, model_name, endpoint_name, endpoint_arn,
        variant_name, compute_units, min_copies, max_copies, current_copies,
        model_artifact_s3_uri, container_image, framework, framework_version,
        status, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, 'AllTraffic', $6, 0, 5, 1, $7, $8, $9, $10, 'creating', $11)
      RETURNING component_id`,
      [
        { name: 'componentName', value: { stringValue: componentName } },
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'modelName', value: { stringValue: modelName } },
        { name: 'endpointName', value: { stringValue: endpoint.endpointName } },
        { name: 'endpointArn', value: { stringValue: endpoint.endpointArn } },
        { name: 'computeUnits', value: { longValue: computeUnits } },
        { name: 'artifactUri', value: { stringValue: modelArtifactS3Uri } },
        { name: 'containerImage', value: { stringValue: containerImage } },
        { name: 'framework', value: { stringValue: framework } },
        { name: 'frameworkVersion', value: { stringValue: frameworkVersion } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );

    // Update endpoint capacity
    await executeStatement(
      `UPDATE shared_inference_endpoints SET
        allocated_compute_units = allocated_compute_units + $2,
        available_compute_units = available_compute_units - $2,
        component_count = component_count + 1,
        component_ids = array_append(component_ids, $3),
        updated_at = NOW()
      WHERE endpoint_name = $1`,
      [
        { name: 'endpointName', value: { stringValue: endpoint.endpointName } },
        { name: 'computeUnits', value: { longValue: computeUnits } },
        { name: 'componentId', value: { stringValue: (result.rows[0] as { component_id: string }).component_id } },
      ]
    );

    // Update model tier assignment
    await this.updateTierAssignment(modelId, 'warm', 'Created as inference component');

    return this.getInferenceComponent(componentName);
  }

  async getInferenceComponent(componentName: string): Promise<InferenceComponent> {
    const result = await executeStatement(
      `SELECT * FROM inference_components WHERE component_name = $1`,
      [{ name: 'name', value: { stringValue: componentName } }]
    );

    if (result.rows.length === 0) {
      throw new Error(`Inference component ${componentName} not found`);
    }

    return this.mapInferenceComponent(result.rows[0] as Record<string, unknown>);
  }

  async getComponentByModelId(modelId: string): Promise<InferenceComponent | null> {
    const result = await executeStatement(
      `SELECT * FROM inference_components WHERE model_id = $1 AND status != 'deleting'`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapInferenceComponent(result.rows[0] as Record<string, unknown>);
  }

  async listInferenceComponents(tenantId: string): Promise<InferenceComponent[]> {
    const result = await executeStatement(
      `SELECT * FROM inference_components WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapInferenceComponent(row as Record<string, unknown>));
  }

  async deleteInferenceComponent(componentName: string): Promise<void> {
    logger.info('Deleting inference component', { componentName });

    const component = await this.getInferenceComponent(componentName);

    // Delete from SageMaker
    await sagemaker.send(new DeleteInferenceComponentCommand({
      InferenceComponentName: componentName,
    }));

    // Update endpoint capacity
    await executeStatement(
      `UPDATE shared_inference_endpoints SET
        allocated_compute_units = allocated_compute_units - $2,
        available_compute_units = available_compute_units + $2,
        component_count = component_count - 1,
        component_ids = array_remove(component_ids, $3),
        updated_at = NOW()
      WHERE endpoint_name = $1`,
      [
        { name: 'endpointName', value: { stringValue: component.endpointName } },
        { name: 'computeUnits', value: { longValue: component.computeUnits } },
        { name: 'componentId', value: { stringValue: component.componentId } },
      ]
    );

    // Update database
    await executeStatement(
      `UPDATE inference_components SET status = 'deleting', updated_at = NOW() WHERE component_name = $1`,
      [{ name: 'name', value: { stringValue: componentName } }]
    );
  }

  // ==========================================================================
  // Component Loading & Routing
  // ==========================================================================

  async loadComponent(request: ComponentLoadRequest): Promise<ComponentLoadResult> {
    const startTime = Date.now();
    const { componentId, priority, timeoutMs = 30000 } = request;

    logger.info('Loading inference component', { componentId, priority });

    try {
      const result = await executeStatement(
        `SELECT * FROM inference_components WHERE component_id = $1`,
        [{ name: 'componentId', value: { stringValue: componentId } }]
      );

      if (result.rows.length === 0) {
        return { componentId, success: false, loadTimeMs: 0, fromCache: false, errorMessage: 'Component not found' };
      }

      const component = this.mapInferenceComponent(result.rows[0] as Record<string, unknown>);

      if (component.status === 'in_service' && component.currentCopies > 0) {
        return { componentId, success: true, loadTimeMs: 0, fromCache: true };
      }

      // Scale up copies with resilience
      await callWithResilience(
        () => sagemaker.send(new UpdateInferenceComponentCommand({
          InferenceComponentName: component.componentName,
          RuntimeConfig: {
            CopyCount: 1,
          },
        })),
        {
          provider: 'sagemaker',
          operation: 'scale-component',
          timeoutMs: 30000,
          maxRetries: 2,
        }
      );

      // Wait for component to be ready
      const ready = await this.waitForComponentReady(component.componentName, timeoutMs);

      const loadTimeMs = Date.now() - startTime;

      // Update metrics
      await executeStatement(
        `UPDATE inference_components SET
          status = 'in_service',
          current_copies = 1,
          last_loaded_at = NOW(),
          load_time_ms = $2,
          updated_at = NOW()
        WHERE component_id = $1`,
        [
          { name: 'componentId', value: { stringValue: componentId } },
          { name: 'loadTime', value: { longValue: loadTimeMs } },
        ]
      );

      return { componentId, success: ready, loadTimeMs, fromCache: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load component', { componentId, error: errorMessage });
      return { componentId, success: false, loadTimeMs: Date.now() - startTime, fromCache: false, errorMessage };
    }
  }

  async unloadComponent(componentId: string): Promise<void> {
    logger.info('Unloading inference component', { componentId });

    const result = await executeStatement(
      `SELECT component_name FROM inference_components WHERE component_id = $1`,
      [{ name: 'componentId', value: { stringValue: componentId } }]
    );

    if (result.rows.length === 0) return;

    const componentName = (result.rows[0] as { component_name: string }).component_name;

    // Scale to zero copies with resilience
    await callWithResilience(
      () => sagemaker.send(new UpdateInferenceComponentCommand({
        InferenceComponentName: componentName,
        RuntimeConfig: {
          CopyCount: 0,
        },
      })),
      {
        provider: 'sagemaker',
        operation: 'unload-component',
        timeoutMs: 30000,
        maxRetries: 2,
      }
    );

    await executeStatement(
      `UPDATE inference_components SET
        status = 'unloaded',
        current_copies = 0,
        last_unloaded_at = NOW(),
        updated_at = NOW()
      WHERE component_id = $1`,
      [{ name: 'componentId', value: { stringValue: componentId } }]
    );
  }

  async getRoutingDecision(modelId: string): Promise<ModelRoutingDecision> {
    // Check for existing component
    const component = await this.getComponentByModelId(modelId);

    if (component) {
      const isReady = component.status === 'in_service' && component.currentCopies > 0;

      const primaryTarget: RoutingTarget = {
        type: 'inference_component',
        targetId: component.componentId,
        targetName: component.componentName,
        isReady,
        estimatedLatencyMs: isReady ? 100 : (component.loadTimeMs || 10000),
      };

      return {
        modelId,
        routingStrategy: isReady ? 'direct' : 'load_and_route',
        primaryTarget,
        fallbackTargets: [],
        estimatedLatencyMs: primaryTarget.estimatedLatencyMs,
        requiresLoading: !isReady,
        estimatedLoadTimeMs: isReady ? undefined : (component.loadTimeMs || 10000),
      };
    }

    // No component - check tier assignment
    const tier = await this.getTierAssignment(modelId);

    if (tier?.currentTier === 'hot') {
      // Should have dedicated endpoint
      return {
        modelId,
        routingStrategy: 'direct',
        primaryTarget: {
          type: 'dedicated_endpoint',
          targetId: modelId,
          targetName: modelId,
          isReady: true,
          estimatedLatencyMs: 100,
        },
        fallbackTargets: [],
        estimatedLatencyMs: 100,
        requiresLoading: false,
      };
    }

    // Fallback to external provider
    return {
      modelId,
      routingStrategy: 'fallback',
      primaryTarget: {
        type: 'external_provider',
        targetId: 'external',
        targetName: 'External Provider',
        isReady: true,
        estimatedLatencyMs: 500,
      },
      fallbackTargets: [],
      estimatedLatencyMs: 500,
      requiresLoading: false,
    };
  }

  private async waitForComponentReady(componentName: string, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = await callWithResilience(
        () => sagemaker.send(new DescribeInferenceComponentCommand({
          InferenceComponentName: componentName,
        })),
        {
          provider: 'sagemaker',
          operation: 'describe-component',
          timeoutMs: 10000,
          maxRetries: 2,
        }
      );

      if (response.InferenceComponentStatus === 'InService') {
        return true;
      }

      if (response.InferenceComponentStatus === 'Failed') {
        throw new Error(`Component ${componentName} failed: ${response.FailureReason}`);
      }

      await this.sleep(2000);
    }

    return false;
  }

  // ==========================================================================
  // Tier Management
  // ==========================================================================

  async evaluateTier(modelId: string): Promise<TierAssignment> {
    logger.info('Evaluating tier for model', { modelId });

    // Get usage metrics
    const metricsResult = await executeStatement(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as requests_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as requests_7d,
        COUNT(*) / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 86400) as avg_daily,
        MAX(created_at) as last_request
      FROM usage_events WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    const metrics = metricsResult.rows[0] as Record<string, unknown>;
    const requestsLast24h = parseInt(String(metrics.requests_24h || 0), 10);
    const requestsLast7d = parseInt(String(metrics.requests_7d || 0), 10);
    const avgDailyRequests = parseFloat(String(metrics.avg_daily || 0));
    const lastRequestAt = metrics.last_request as string | null;
    const daysSinceLastRequest = lastRequestAt
      ? (Date.now() - new Date(lastRequestAt).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // Get current tier
    const currentTier = await this.getCurrentTier(modelId);

    // Determine recommended tier
    const thresholds = DEFAULT_TIER_THRESHOLDS;
    let recommendedTier: ModelHostingTier;
    let tierReason: string;

    if (daysSinceLastRequest > thresholds.offTierInactiveDays) {
      recommendedTier = 'off';
      tierReason = `No requests in ${thresholds.offTierInactiveDays} days`;
    } else if (avgDailyRequests >= thresholds.hotTierMinRequestsPerDay) {
      recommendedTier = 'hot';
      tierReason = `High usage: ${avgDailyRequests.toFixed(0)} requests/day`;
    } else if (avgDailyRequests >= thresholds.warmTierMinRequestsPerDay) {
      recommendedTier = 'warm';
      tierReason = `Moderate usage: ${avgDailyRequests.toFixed(0)} requests/day`;
    } else {
      recommendedTier = 'cold';
      tierReason = `Low usage: ${avgDailyRequests.toFixed(0)} requests/day`;
    }

    // Calculate costs
    const currentMonthlyCost = this.estimateMonthlyCost(modelId, currentTier);
    const projectedMonthlyCost = this.estimateMonthlyCost(modelId, recommendedTier);
    const potentialSavings = currentMonthlyCost - projectedMonthlyCost;

    const assignment: TierAssignment = {
      modelId,
      currentTier,
      recommendedTier,
      tierReason,
      requestsLast24h,
      requestsLast7d,
      avgDailyRequests,
      lastRequestAt: lastRequestAt || undefined,
      daysSinceLastRequest,
      currentMonthlyCost,
      projectedMonthlyCost,
      potentialSavings,
      lastEvaluatedAt: new Date().toISOString(),
    };

    // Store evaluation
    await executeStatement(
      `INSERT INTO tier_assignments (
        model_id, current_tier, recommended_tier, tier_reason,
        requests_last_24h, requests_last_7d, avg_daily_requests,
        last_request_at, days_since_last_request,
        current_monthly_cost, projected_monthly_cost, potential_savings,
        last_evaluated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (model_id) DO UPDATE SET
        recommended_tier = $3,
        tier_reason = $4,
        requests_last_24h = $5,
        requests_last_7d = $6,
        avg_daily_requests = $7,
        last_request_at = $8,
        days_since_last_request = $9,
        current_monthly_cost = $10,
        projected_monthly_cost = $11,
        potential_savings = $12,
        last_evaluated_at = NOW()`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'currentTier', value: { stringValue: currentTier } },
        { name: 'recommendedTier', value: { stringValue: recommendedTier } },
        { name: 'tierReason', value: { stringValue: tierReason } },
        { name: 'requests24h', value: { longValue: requestsLast24h } },
        { name: 'requests7d', value: { longValue: requestsLast7d } },
        { name: 'avgDaily', value: { doubleValue: avgDailyRequests } },
        { name: 'lastRequest', value: lastRequestAt ? { stringValue: lastRequestAt } : { isNull: true } },
        { name: 'daysSince', value: { doubleValue: daysSinceLastRequest } },
        { name: 'currentCost', value: { doubleValue: currentMonthlyCost } },
        { name: 'projectedCost', value: { doubleValue: projectedMonthlyCost } },
        { name: 'savings', value: { doubleValue: potentialSavings } },
      ]
    );

    return assignment;
  }

  async transitionTier(
    modelId: string,
    targetTier: ModelHostingTier,
    reason: string
  ): Promise<TierTransition> {
    const currentTier = await this.getCurrentTier(modelId);

    logger.info('Transitioning model tier', { modelId, from: currentTier, to: targetTier });

    // Create transition record
    const result = await executeStatement(
      `INSERT INTO tier_transitions (
        model_id, from_tier, to_tier, reason, status, started_at
      ) VALUES ($1, $2, $3, $4, 'in_progress', NOW())
      RETURNING transition_id`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'fromTier', value: { stringValue: currentTier } },
        { name: 'toTier', value: { stringValue: targetTier } },
        { name: 'reason', value: { stringValue: reason } },
      ]
    );

    const transitionId = (result.rows[0] as { transition_id: string }).transition_id;

    try {
      // Perform transition
      await this.performTierTransition(modelId, currentTier, targetTier);

      // Update tier assignment
      await this.updateTierAssignment(modelId, targetTier, reason);

      // Complete transition
      await executeStatement(
        `UPDATE tier_transitions SET
          status = 'completed',
          completed_at = NOW()
        WHERE transition_id = $1`,
        [{ name: 'transitionId', value: { stringValue: transitionId } }]
      );

      return {
        transitionId,
        modelId,
        fromTier: currentTier,
        toTier: targetTier,
        reason,
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        canRollback: true,
        rollbackDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await executeStatement(
        `UPDATE tier_transitions SET
          status = 'failed',
          error_message = $2,
          completed_at = NOW()
        WHERE transition_id = $1`,
        [
          { name: 'transitionId', value: { stringValue: transitionId } },
          { name: 'error', value: { stringValue: errorMessage } },
        ]
      );

      throw error;
    }
  }

  private async performTierTransition(
    modelId: string,
    fromTier: ModelHostingTier,
    toTier: ModelHostingTier
  ): Promise<void> {
    // Handle transition logic based on tier change
    if (toTier === 'warm' && fromTier !== 'warm') {
      // Create inference component for WARM tier
      const modelInfo = await this.getModelInfo(modelId);
      if (modelInfo) {
        await this.createInferenceComponent(
          modelInfo.tenantId,
          modelId,
          modelInfo.name,
          modelInfo.artifactUri,
          modelInfo.containerImage,
          modelInfo.framework as InferenceFramework,
          modelInfo.frameworkVersion
        );
      }
    } else if (fromTier === 'warm' && toTier !== 'warm') {
      // Delete inference component when leaving WARM tier
      const component = await this.getComponentByModelId(modelId);
      if (component) {
        await this.deleteInferenceComponent(component.componentName);
      }
    }

    // Handle other tier transitions (HOT, COLD, OFF) as needed
    // These would involve dedicated endpoints or serverless configurations
  }

  private async getCurrentTier(modelId: string): Promise<ModelHostingTier> {
    const result = await executeStatement(
      `SELECT current_tier FROM tier_assignments WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (result.rows.length === 0) return 'cold';
    return (result.rows[0] as { current_tier: ModelHostingTier }).current_tier;
  }

  async getTierAssignment(modelId: string): Promise<TierAssignment | null> {
    const result = await executeStatement(
      `SELECT * FROM tier_assignments WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapTierAssignment(result.rows[0] as Record<string, unknown>);
  }

  private async updateTierAssignment(modelId: string, tier: ModelHostingTier, reason: string): Promise<void> {
    await executeStatement(
      `INSERT INTO tier_assignments (model_id, current_tier, recommended_tier, tier_reason, last_evaluated_at)
       VALUES ($1, $2, $2, $3, NOW())
       ON CONFLICT (model_id) DO UPDATE SET
         current_tier = $2,
         tier_reason = $3,
         updated_at = NOW()`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'tier', value: { stringValue: tier } },
        { name: 'reason', value: { stringValue: reason } },
      ]
    );
  }

  private async getModelInfo(modelId: string): Promise<{
    tenantId: string;
    name: string;
    artifactUri: string;
    containerImage: string;
    framework: string;
    frameworkVersion: string;
  } | null> {
    const result = await executeStatement(
      `SELECT tenant_id, name, config FROM model_registry WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});

    return {
      tenantId: String(row.tenant_id || ''),
      name: String(row.name || ''),
      artifactUri: config.model_artifact_s3_uri || '',
      containerImage: config.container_image || '',
      framework: config.framework || 'pytorch',
      frameworkVersion: config.framework_version || '2.0',
    };
  }

  // ==========================================================================
  // Auto-Tiering for New Models
  // ==========================================================================

  async autoTierNewModel(modelId: string, tenantId: string): Promise<TierAssignment> {
    logger.info('Auto-tiering new model', { modelId, tenantId });

    const config = await this.getConfig(tenantId);

    if (!config.enabled || !config.autoTieringEnabled) {
      // Default to COLD tier if auto-tiering disabled
      await this.updateTierAssignment(modelId, 'cold', 'Auto-tiering disabled, defaulting to COLD');
      return this.evaluateTier(modelId);
    }

    // New models start in WARM tier (inference component)
    // This provides good balance of cost and latency
    await this.transitionTier(modelId, 'warm', 'New model auto-assigned to WARM tier');

    return this.evaluateTier(modelId);
  }

  async runAutoTieringJob(tenantId: string): Promise<{ evaluated: number; transitioned: number }> {
    logger.info('Running auto-tiering job', { tenantId });

    const config = await this.getConfig(tenantId);
    if (!config.enabled || !config.autoTieringEnabled) {
      return { evaluated: 0, transitioned: 0 };
    }

    // Get all self-hosted models
    const result = await executeStatement(
      `SELECT model_id FROM model_registry WHERE tenant_id = $1 AND source = 'self_hosted'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    let evaluated = 0;
    let transitioned = 0;

    for (const row of result.rows) {
      const modelId = (row as { model_id: string }).model_id;

      try {
        const assignment = await this.evaluateTier(modelId);
        evaluated++;

        if (assignment.currentTier !== assignment.recommendedTier && !assignment.tierOverride) {
          await this.transitionTier(modelId, assignment.recommendedTier, assignment.tierReason);
          transitioned++;
        }
      } catch (error) {
        logger.error('Error evaluating tier', { modelId, error: error instanceof Error ? error.message : 'Unknown' });
      }
    }

    return { evaluated, transitioned };
  }

  // ==========================================================================
  // Dashboard
  // ==========================================================================

  async getDashboard(tenantId: string): Promise<InferenceComponentsDashboard> {
    // Get tier counts
    const tierResult = await executeStatement(
      `SELECT current_tier, COUNT(*) as count FROM tier_assignments 
       WHERE model_id IN (SELECT model_id FROM model_registry WHERE tenant_id = $1)
       GROUP BY current_tier`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const modelsByTier: Record<ModelHostingTier, number> = { hot: 0, warm: 0, cold: 0, off: 0 };
    let totalModels = 0;
    for (const row of tierResult.rows) {
      const r = row as { current_tier: ModelHostingTier; count: string };
      modelsByTier[r.current_tier] = parseInt(r.count, 10);
      totalModels += parseInt(r.count, 10);
    }

    // Get endpoints
    const endpoints = await this.listSharedEndpoints(tenantId);
    const totalComputeUnits = endpoints.reduce((sum, e) => sum + e.totalComputeUnits, 0);
    const usedComputeUnits = endpoints.reduce((sum, e) => sum + e.allocatedComputeUnits, 0);

    // Get components
    const components = await this.listInferenceComponents(tenantId);
    const activeComponents = components.filter(c => c.status === 'in_service').length;

    // Get recent transitions
    const transitionsResult = await executeStatement(
      `SELECT * FROM tier_transitions 
       WHERE model_id IN (SELECT model_id FROM model_registry WHERE tenant_id = $1)
       ORDER BY started_at DESC LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    // Calculate costs
    const hourlyEndpointCost = endpoints.reduce((sum, e) => sum + e.hourlyBaseCost, 0);
    const currentMonthCost = hourlyEndpointCost * 24 * 30;

    return {
      totalModels,
      modelsByTier,
      totalComponents: components.length,
      activeComponents,
      sharedEndpoints: endpoints,
      totalComputeUnits,
      usedComputeUnits,
      utilizationPercent: totalComputeUnits > 0 ? (usedComputeUnits / totalComputeUnits) * 100 : 0,
      currentMonthCost,
      projectedMonthCost: currentMonthCost,
      costByTier: {
        hot: modelsByTier.hot * 500,  // Estimate
        warm: modelsByTier.warm * 100,
        cold: modelsByTier.cold * 10,
        off: 0,
      },
      savingsVsDedicated: modelsByTier.warm * 400,  // Savings from not having dedicated endpoints
      avgLoadTimeMs: components.length > 0
        ? components.reduce((sum, c) => sum + (c.loadTimeMs || 10000), 0) / components.length
        : 10000,
      avgLatencyMs: 150,
      cacheHitRate: 0.7,
      recentTransitions: transitionsResult.rows.map(r => this.mapTierTransition(r as Record<string, unknown>)),
      recentLoadEvents: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private calculateComputeUnits(instanceType: string): number {
    const unitMap: Record<string, number> = {
      'ml.g5.xlarge': 4,
      'ml.g5.2xlarge': 8,
      'ml.g5.4xlarge': 16,
      'ml.g5.8xlarge': 32,
      'ml.g5.12xlarge': 48,
      'ml.p4d.24xlarge': 96,
      'ml.inf2.xlarge': 4,
      'ml.inf2.8xlarge': 32,
    };
    return unitMap[instanceType] || 4;
  }

  private estimateMonthlyCost(modelId: string, tier: ModelHostingTier): number {
    // Simplified cost estimation
    const costMap: Record<ModelHostingTier, number> = {
      hot: 500,    // Dedicated endpoint always on
      warm: 100,   // Shared infrastructure
      cold: 10,    // Pay per request
      off: 0,      // No cost
    };
    return costMap[tier];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Mappers
  // ==========================================================================

  private mapConfig(row: Record<string, unknown>): InferenceComponentsConfig {
    return {
      tenantId: String(row.tenant_id),
      enabled: Boolean(row.enabled),
      autoTieringEnabled: Boolean(row.auto_tiering_enabled),
      predictiveLoadingEnabled: Boolean(row.predictive_loading_enabled),
      fallbackToExternalEnabled: Boolean(row.fallback_to_external_enabled),
      tierThresholds: typeof row.tier_thresholds === 'string'
        ? JSON.parse(row.tier_thresholds)
        : (row.tier_thresholds as TierThresholds) || DEFAULT_TIER_THRESHOLDS,
      defaultInstanceType: String(row.default_instance_type || 'ml.g5.xlarge'),
      maxSharedEndpoints: Number(row.max_shared_endpoints || 3),
      maxComponentsPerEndpoint: Number(row.max_components_per_endpoint || 15),
      defaultLoadTimeoutMs: Number(row.default_load_timeout_ms || 30000),
      preloadWindowMinutes: Number(row.preload_window_minutes || 15),
      unloadAfterIdleMinutes: Number(row.unload_after_idle_minutes || 30),
      maxMonthlyBudget: row.max_monthly_budget ? Number(row.max_monthly_budget) : undefined,
      alertThresholdPercent: Number(row.alert_threshold_percent || 80),
      notifyOnTierChange: Boolean(row.notify_on_tier_change),
      notifyOnLoadFailure: Boolean(row.notify_on_load_failure),
      notifyOnBudgetAlert: Boolean(row.notify_on_budget_alert),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapSharedEndpoint(row: Record<string, unknown>): SharedInferenceEndpoint {
    return {
      endpointId: String(row.endpoint_id),
      endpointName: String(row.endpoint_name),
      endpointArn: String(row.endpoint_arn),
      instanceType: String(row.instance_type),
      instanceCount: Number(row.instance_count || 1),
      totalComputeUnits: Number(row.total_compute_units || 0),
      allocatedComputeUnits: Number(row.allocated_compute_units || 0),
      availableComputeUnits: Number(row.available_compute_units || 0),
      componentCount: Number(row.component_count || 0),
      maxComponents: Number(row.max_components || 15),
      componentIds: Array.isArray(row.component_ids) ? row.component_ids as string[] : [],
      status: (row.status as SharedEndpointStatus) || 'creating',
      hourlyBaseCost: Number(row.hourly_base_cost || 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapInferenceComponent(row: Record<string, unknown>): InferenceComponent {
    return {
      componentId: String(row.component_id),
      componentName: String(row.component_name),
      modelId: String(row.model_id),
      modelName: String(row.model_name),
      endpointName: String(row.endpoint_name),
      endpointArn: String(row.endpoint_arn),
      variantName: String(row.variant_name || 'AllTraffic'),
      computeUnits: Number(row.compute_units || 1),
      minCopies: Number(row.min_copies || 0),
      maxCopies: Number(row.max_copies || 5),
      currentCopies: Number(row.current_copies || 0),
      modelArtifactS3Uri: String(row.model_artifact_s3_uri || ''),
      containerImage: String(row.container_image || ''),
      framework: (row.framework as InferenceFramework) || 'pytorch',
      frameworkVersion: String(row.framework_version || '2.0'),
      status: (row.status as InferenceComponentStatus) || 'creating',
      lastLoadedAt: row.last_loaded_at ? String(row.last_loaded_at) : undefined,
      lastUnloadedAt: row.last_unloaded_at ? String(row.last_unloaded_at) : undefined,
      loadTimeMs: row.load_time_ms ? Number(row.load_time_ms) : undefined,
      requestsLast24h: Number(row.requests_last_24h || 0),
      avgLatencyMs: Number(row.avg_latency_ms || 0),
      errorRate: Number(row.error_rate || 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapTierAssignment(row: Record<string, unknown>): TierAssignment {
    return {
      modelId: String(row.model_id),
      currentTier: (row.current_tier as ModelHostingTier) || 'cold',
      recommendedTier: (row.recommended_tier as ModelHostingTier) || 'cold',
      tierReason: String(row.tier_reason || ''),
      requestsLast24h: Number(row.requests_last_24h || 0),
      requestsLast7d: Number(row.requests_last_7d || 0),
      avgDailyRequests: Number(row.avg_daily_requests || 0),
      lastRequestAt: row.last_request_at ? String(row.last_request_at) : undefined,
      daysSinceLastRequest: Number(row.days_since_last_request || 0),
      currentMonthlyCost: Number(row.current_monthly_cost || 0),
      projectedMonthlyCost: Number(row.projected_monthly_cost || 0),
      potentialSavings: Number(row.potential_savings || 0),
      tierOverride: row.tier_override ? (row.tier_override as ModelHostingTier) : undefined,
      overrideReason: row.override_reason ? String(row.override_reason) : undefined,
      overrideExpiresAt: row.override_expires_at ? String(row.override_expires_at) : undefined,
      lastEvaluatedAt: String(row.last_evaluated_at || row.updated_at),
    };
  }

  private mapTierTransition(row: Record<string, unknown>): TierTransition {
    return {
      transitionId: String(row.transition_id),
      modelId: String(row.model_id),
      fromTier: (row.from_tier as ModelHostingTier) || 'cold',
      toTier: (row.to_tier as ModelHostingTier) || 'cold',
      reason: String(row.reason || ''),
      status: (row.status as TierTransition['status']) || 'pending',
      startedAt: String(row.started_at),
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
      errorMessage: row.error_message ? String(row.error_message) : undefined,
      canRollback: Boolean(row.can_rollback ?? true),
      rollbackDeadline: row.rollback_deadline ? String(row.rollback_deadline) : undefined,
    };
  }
}

export const inferenceComponentsService = new InferenceComponentsService();
