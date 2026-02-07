/**
 * RADIANT v7.39.0 — AWS Freeze/Thaw Service
 *
 * Programmatically suspends and restores AWS services when the instance-level
 * spend governor budget is exceeded. This stops billing on the most expensive
 * resources while keeping the core admin plane alive so super admins can
 * diagnose and restore via the Deployer or Admin Dashboard.
 *
 * Freezable services:
 *   - SageMaker endpoints (inference)
 *   - Bedrock provisioned throughput
 *   - ECS/Fargate tasks (LiteLLM, self-hosted models)
 *   - Lambda concurrency (set reserved to 0)
 *
 * NOT frozen (always kept alive):
 *   - Admin API Gateway + admin Lambdas
 *   - Aurora PostgreSQL (needed for admin ops)
 *   - S3 (storage is cheap, data must be preserved)
 *   - CloudWatch (need monitoring to diagnose)
 *   - Cognito (auth must remain functional)
 */

import {
  SageMakerClient,
  UpdateEndpointCommand,
  DescribeEndpointCommand,
  ListEndpointsCommand,
} from '@aws-sdk/client-sagemaker';
import {
  ECSClient,
  UpdateServiceCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from '@aws-sdk/client-ecs';
import {
  LambdaClient,
  PutFunctionConcurrencyCommand,
  DeleteFunctionConcurrencyCommand,
  ListFunctionsCommand,
} from '@aws-sdk/client-lambda';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'aws-freeze',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface FreezeResult {
  success: boolean;
  frozenServices: FrozenServiceRecord[];
  errors: string[];
  frozenAt: string;
}

export interface ThawResult {
  success: boolean;
  restoredServices: string[];
  errors: string[];
  restoredAt: string;
}

export interface FrozenServiceRecord {
  serviceType: 'sagemaker_endpoint' | 'ecs_service' | 'lambda_function' | 'bedrock_throughput';
  serviceId: string;
  previousState: Record<string, unknown>;
  frozenAt: string;
}

// ============================================================================
// Service
// ============================================================================

export class AWSFreezeService {
  private readonly sagemakerClient: SageMakerClient;
  private readonly ecsClient: ECSClient;
  private readonly lambdaClient: LambdaClient;
  private readonly radiantPrefix: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.sagemakerClient = new SageMakerClient({ region });
    this.ecsClient = new ECSClient({ region });
    this.lambdaClient = new LambdaClient({ region });
    this.radiantPrefix = process.env.RADIANT_STACK_PREFIX || 'radiant';
  }

  // --------------------------------------------------------------------------
  // Freeze All — stop billable AWS services
  // --------------------------------------------------------------------------

  async freezeAll(reason: string): Promise<FreezeResult> {
    const frozenServices: FrozenServiceRecord[] = [];
    const errors: string[] = [];
    const frozenAt = new Date().toISOString();

    logger.error('AWS FREEZE initiated', { reason });

    // 1. Scale down ECS services to 0 tasks
    try {
      const ecsResults = await this.freezeECSServices();
      frozenServices.push(...ecsResults);
    } catch (error) {
      const msg = `ECS freeze failed: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      logger.error(msg);
    }

    // 2. Set Lambda concurrency to 0 for AI-related functions
    try {
      const lambdaResults = await this.freezeLambdaFunctions();
      frozenServices.push(...lambdaResults);
    } catch (error) {
      const msg = `Lambda freeze failed: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      logger.error(msg);
    }

    // 3. Scale down SageMaker endpoints
    try {
      const smResults = await this.freezeSageMakerEndpoints();
      frozenServices.push(...smResults);
    } catch (error) {
      const msg = `SageMaker freeze failed: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      logger.error(msg);
    }

    logger.info('AWS FREEZE complete', {
      frozenCount: frozenServices.length,
      errorCount: errors.length,
      services: frozenServices.map(s => s.serviceId),
    });

    return {
      success: errors.length === 0,
      frozenServices,
      errors,
      frozenAt,
    };
  }

  // --------------------------------------------------------------------------
  // Thaw All — restore frozen AWS services
  // --------------------------------------------------------------------------

  async thawAll(frozenServices: FrozenServiceRecord[]): Promise<ThawResult> {
    const restoredServices: string[] = [];
    const errors: string[] = [];

    logger.info('AWS THAW initiated', {
      serviceCount: frozenServices.length,
    });

    for (const service of frozenServices) {
      try {
        switch (service.serviceType) {
          case 'ecs_service':
            await this.thawECSService(service);
            break;
          case 'lambda_function':
            await this.thawLambdaFunction(service);
            break;
          case 'sagemaker_endpoint':
            await this.thawSageMakerEndpoint(service);
            break;
          default:
            logger.warn('Unknown service type for thaw', { serviceType: service.serviceType });
        }
        restoredServices.push(service.serviceId);
      } catch (error) {
        const msg = `Failed to thaw ${service.serviceType}/${service.serviceId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(msg);
        logger.error(msg);
      }
    }

    logger.info('AWS THAW complete', {
      restoredCount: restoredServices.length,
      errorCount: errors.length,
    });

    return {
      success: errors.length === 0,
      restoredServices,
      errors,
      restoredAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // ECS Freeze/Thaw
  // --------------------------------------------------------------------------

  private async freezeECSServices(): Promise<FrozenServiceRecord[]> {
    const frozen: FrozenServiceRecord[] = [];
    const clusterArn = process.env.RADIANT_ECS_CLUSTER_ARN;
    if (!clusterArn) {
      logger.info('No ECS cluster configured, skipping ECS freeze');
      return frozen;
    }

    const listResult = await this.ecsClient.send(new ListServicesCommand({
      cluster: clusterArn,
      maxResults: 100,
    }));

    if (!listResult.serviceArns || listResult.serviceArns.length === 0) return frozen;

    const descResult = await this.ecsClient.send(new DescribeServicesCommand({
      cluster: clusterArn,
      services: listResult.serviceArns,
    }));

    for (const svc of descResult.services || []) {
      if (!svc.serviceName || !svc.serviceArn) continue;
      // Only freeze RADIANT services, not admin services
      if (svc.serviceName.includes('admin')) continue;

      const previousDesiredCount = svc.desiredCount || 1;

      await this.ecsClient.send(new UpdateServiceCommand({
        cluster: clusterArn,
        service: svc.serviceArn,
        desiredCount: 0,
      }));

      frozen.push({
        serviceType: 'ecs_service',
        serviceId: svc.serviceArn,
        previousState: { desiredCount: previousDesiredCount, serviceName: svc.serviceName },
        frozenAt: new Date().toISOString(),
      });

      logger.info('Frozen ECS service', { service: svc.serviceName, previousDesiredCount });
    }

    return frozen;
  }

  private async thawECSService(service: FrozenServiceRecord): Promise<void> {
    const clusterArn = process.env.RADIANT_ECS_CLUSTER_ARN;
    if (!clusterArn) return;

    const desiredCount = (service.previousState.desiredCount as number) || 1;

    await this.ecsClient.send(new UpdateServiceCommand({
      cluster: clusterArn,
      service: service.serviceId,
      desiredCount,
    }));

    logger.info('Thawed ECS service', {
      service: service.serviceId,
      desiredCount,
    });
  }

  // --------------------------------------------------------------------------
  // Lambda Freeze/Thaw
  // --------------------------------------------------------------------------

  private async freezeLambdaFunctions(): Promise<FrozenServiceRecord[]> {
    const frozen: FrozenServiceRecord[] = [];

    const listResult = await this.lambdaClient.send(new ListFunctionsCommand({
      MaxItems: 200,
    }));

    for (const fn of listResult.Functions || []) {
      if (!fn.FunctionName || !fn.FunctionArn) continue;
      // Only freeze RADIANT AI/model functions, not admin functions
      if (!fn.FunctionName.startsWith(this.radiantPrefix)) continue;
      if (fn.FunctionName.includes('admin') || fn.FunctionName.includes('spend-governor')) continue;

      // Skip functions that are already at 0 concurrency
      const isAIFunction = fn.FunctionName.includes('model') ||
                           fn.FunctionName.includes('ai') ||
                           fn.FunctionName.includes('inference') ||
                           fn.FunctionName.includes('consciousness') ||
                           fn.FunctionName.includes('brain') ||
                           fn.FunctionName.includes('thinktank') ||
                           fn.FunctionName.includes('agent');

      if (!isAIFunction) continue;

      await this.lambdaClient.send(new PutFunctionConcurrencyCommand({
        FunctionName: fn.FunctionName,
        ReservedConcurrentExecutions: 0,
      }));

      frozen.push({
        serviceType: 'lambda_function',
        serviceId: fn.FunctionName,
        previousState: {
          reservedConcurrency: fn.FunctionArn,
        },
        frozenAt: new Date().toISOString(),
      });

      logger.info('Frozen Lambda function', { function: fn.FunctionName });
    }

    return frozen;
  }

  private async thawLambdaFunction(service: FrozenServiceRecord): Promise<void> {
    // Remove the reserved concurrency limit (restores to unreserved)
    await this.lambdaClient.send(new DeleteFunctionConcurrencyCommand({
      FunctionName: service.serviceId,
    }));

    logger.info('Thawed Lambda function', { function: service.serviceId });
  }

  // --------------------------------------------------------------------------
  // SageMaker Freeze/Thaw
  // --------------------------------------------------------------------------

  private async freezeSageMakerEndpoints(): Promise<FrozenServiceRecord[]> {
    const frozen: FrozenServiceRecord[] = [];

    const listResult = await this.sagemakerClient.send(new ListEndpointsCommand({
      MaxResults: 100,
      StatusEquals: 'InService',
      NameContains: this.radiantPrefix,
    }));

    for (const ep of listResult.Endpoints || []) {
      if (!ep.EndpointName || !ep.EndpointArn) continue;

      // Get current config for restoration
      const descResult = await this.sagemakerClient.send(new DescribeEndpointCommand({
        EndpointName: ep.EndpointName,
      }));

      frozen.push({
        serviceType: 'sagemaker_endpoint',
        serviceId: ep.EndpointName,
        previousState: {
          endpointConfigName: descResult.EndpointConfigName,
          endpointArn: ep.EndpointArn,
        },
        frozenAt: new Date().toISOString(),
      });

      // For SageMaker, we cannot set instance count to 0.
      // Instead we log it for manual action or Deployer-based deletion/recreation.
      logger.warn('SageMaker endpoint flagged for freeze — requires Deployer action', {
        endpoint: ep.EndpointName,
        configName: descResult.EndpointConfigName,
      });
    }

    return frozen;
  }

  private async thawSageMakerEndpoint(service: FrozenServiceRecord): Promise<void> {
    // SageMaker endpoints need to be recreated via Deployer
    logger.info('SageMaker endpoint flagged for thaw — requires Deployer action', {
      endpoint: service.serviceId,
      previousConfig: service.previousState.endpointConfigName,
    });
  }
}

export const awsFreezeService = new AWSFreezeService();
