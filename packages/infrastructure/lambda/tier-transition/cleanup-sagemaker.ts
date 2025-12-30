/**
 * Cleanup SageMaker Lambda
 * 
 * Cleans up SageMaker resources when scaling down.
 */

import { Handler } from 'aws-lambda';
import {
  SageMakerClient,
  DeleteEndpointCommand,
  DeleteEndpointConfigCommand,
  DescribeEndpointCommand,
  UpdateEndpointWeightsAndCapacitiesCommand
} from '@aws-sdk/client-sagemaker';

const sagemaker = new SageMakerClient({});

interface TransitionEvent {
  tenantId: string;
  fromTier: string;
  toTier: string;
}

interface CleanupResult {
  service: string;
  status: string;
  deleted: string[];
  scaled: string[];
  errors: string[];
}

export const handler: Handler<TransitionEvent, CleanupResult> = async (event) => {
  console.log('Cleaning up SageMaker:', JSON.stringify(event));

  const { tenantId, fromTier, toTier } = event;
  const prefix = tenantId.substring(0, 8);
  const result: CleanupResult = {
    service: 'SageMaker',
    status: 'SUCCESS',
    deleted: [],
    scaled: [],
    errors: []
  };

  const endpointName = `bobble-shadow-self-${prefix}`;

  try {
    // Check if endpoint exists
    try {
      await sagemaker.send(new DescribeEndpointCommand({ EndpointName: endpointName }));
    } catch (error: any) {
      if (error.name === 'ValidationException') {
        console.log('Endpoint does not exist, nothing to cleanup');
        return result;
      }
      throw error;
    }

    // Determine action based on target tier
    if (toTier === 'DEV') {
      // Scale to zero for DEV (if supported) or delete
      try {
        await sagemaker.send(new UpdateEndpointWeightsAndCapacitiesCommand({
          EndpointName: endpointName,
          DesiredWeightsAndCapacities: [{
            VariantName: 'AllTraffic',
            DesiredInstanceCount: 0
          }]
        }));
        result.scaled.push(`Scaled to zero: ${endpointName}`);
      } catch {
        // If scale to zero not supported, keep endpoint with min instances
        result.scaled.push(`Kept at minimum: ${endpointName}`);
      }
    } else if (toTier === 'STAGING' && fromTier === 'PRODUCTION') {
      // Scale down from PRODUCTION to STAGING
      await sagemaker.send(new UpdateEndpointWeightsAndCapacitiesCommand({
        EndpointName: endpointName,
        DesiredWeightsAndCapacities: [{
          VariantName: 'AllTraffic',
          DesiredInstanceCount: 2 // STAGING min
        }]
      }));
      result.scaled.push(`Scaled down to 2 instances: ${endpointName}`);
    }

    // Delete multi-region endpoints when scaling from PRODUCTION
    if (fromTier === 'PRODUCTION' && toTier !== 'PRODUCTION') {
      const multiRegionEndpoints = [
        `bobble-shadow-self-${prefix}-eu-west-1`,
        `bobble-shadow-self-${prefix}-ap-northeast-1`
      ];

      for (const epName of multiRegionEndpoints) {
        try {
          await sagemaker.send(new DeleteEndpointCommand({ EndpointName: epName }));
          result.deleted.push(epName);
        } catch (error: any) {
          if (error.name !== 'ValidationException') {
            result.errors.push(`Failed to delete ${epName}: ${error.message}`);
          }
        }
      }
    }

  } catch (error: any) {
    console.error('SageMaker cleanup error:', error);
    result.status = 'PARTIAL';
    result.errors.push(error.message);
  }

  return result;
};
