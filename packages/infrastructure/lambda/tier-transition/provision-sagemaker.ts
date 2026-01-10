/**
 * Provision SageMaker Lambda
 * 
 * Provisions SageMaker endpoints based on target tier configuration.
 */

import { Handler } from 'aws-lambda';
import { logger } from '../shared/logging/enhanced-logger';
import { 
  SageMakerClient, 
  CreateEndpointCommand,
  CreateEndpointConfigCommand,
  DescribeEndpointCommand,
  UpdateEndpointWeightsAndCapacitiesCommand
} from '@aws-sdk/client-sagemaker';

const sagemaker = new SageMakerClient({});

interface TransitionEvent {
  tenantId: string;
  fromTier: string;
  toTier: string;
  direction: string;
}

interface ProvisionResult {
  service: string;
  status: string;
  resources: string[];
  errors: string[];
}

// Tier configurations for SageMaker
const TIER_CONFIGS: Record<string, {
  instanceType: string;
  minInstances: number;
  maxInstances: number;
  scaleToZero: boolean;
}> = {
  DEV: {
    instanceType: 'ml.g5.xlarge',
    minInstances: 0,
    maxInstances: 1,
    scaleToZero: true
  },
  STAGING: {
    instanceType: 'ml.g5.2xlarge',
    minInstances: 2,
    maxInstances: 20,
    scaleToZero: false
  },
  PRODUCTION: {
    instanceType: 'ml.g5.2xlarge',
    minInstances: 50,
    maxInstances: 300,
    scaleToZero: false
  }
};

export const handler: Handler<TransitionEvent, ProvisionResult> = async (event) => {
  logger.info('Provisioning SageMaker:', { event });

  const { tenantId, toTier } = event;
  const config = TIER_CONFIGS[toTier];
  const result: ProvisionResult = {
    service: 'SageMaker',
    status: 'SUCCESS',
    resources: [],
    errors: []
  };

  if (!config) {
    result.status = 'FAILED';
    result.errors.push(`Unknown tier: ${toTier}`);
    return result;
  }

  const endpointName = `cato-shadow-self-${tenantId.substring(0, 8)}`;
  const endpointConfigName = `${endpointName}-config`;

  try {
    // Check if endpoint exists
    try {
      const describeResult = await sagemaker.send(new DescribeEndpointCommand({
        EndpointName: endpointName
      }));

      // Endpoint exists - update scaling
      logger.info(`Endpoint ${endpointName} exists, updating scaling...`);
      
      await sagemaker.send(new UpdateEndpointWeightsAndCapacitiesCommand({
        EndpointName: endpointName,
        DesiredWeightsAndCapacities: [{
          VariantName: 'AllTraffic',
          DesiredInstanceCount: config.minInstances || 1
        }]
      }));

      result.resources.push(`Updated endpoint: ${endpointName}`);
      logger.info('Endpoint updated successfully');

    } catch (error: any) {
      if (error.name === 'ResourceNotFound' || error.name === 'ValidationException') {
        // Endpoint doesn't exist - create it
        logger.info(`Creating new endpoint: ${endpointName}`);

        // Create endpoint config
        await sagemaker.send(new CreateEndpointConfigCommand({
          EndpointConfigName: endpointConfigName,
          ProductionVariants: [{
            VariantName: 'AllTraffic',
            ModelName: 'cato-shadow-self-model',
            InstanceType: config.instanceType as any,
            InitialInstanceCount: config.minInstances || 1,
            InitialVariantWeight: 1.0
          }]
        }));
        result.resources.push(`Created endpoint config: ${endpointConfigName}`);

        // Create endpoint
        await sagemaker.send(new CreateEndpointCommand({
          EndpointName: endpointName,
          EndpointConfigName: endpointConfigName
        }));
        result.resources.push(`Created endpoint: ${endpointName}`);

        logger.info('Endpoint creation initiated');
      } else {
        throw error;
      }
    }

  } catch (error: any) {
    logger.error('SageMaker provisioning error:', error);
    result.status = 'FAILED';
    result.errors.push(error.message);
  }

  return result;
};
