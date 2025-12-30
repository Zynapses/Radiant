/**
 * Cleanup OpenSearch Lambda
 * 
 * Cleans up OpenSearch resources when scaling down.
 */

import { Handler } from 'aws-lambda';
import {
  OpenSearchClient,
  UpdateDomainConfigCommand,
  DescribeDomainCommand
} from '@aws-sdk/client-opensearch';
import {
  OpenSearchServerlessClient,
  DeleteCollectionCommand,
  GetCollectionCommand
} from '@aws-sdk/client-opensearchserverless';

const opensearch = new OpenSearchClient({});
const aoss = new OpenSearchServerlessClient({});

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
  console.log('Cleaning up OpenSearch:', JSON.stringify(event));

  const { tenantId, fromTier, toTier } = event;
  const prefix = tenantId.substring(0, 8);
  const result: CleanupResult = {
    service: 'OpenSearch',
    status: 'SUCCESS',
    deleted: [],
    scaled: [],
    errors: []
  };

  const domainName = `bobble-vectors-${prefix}`;
  const collectionName = `bobble-vectors-${prefix}`;

  try {
    // If coming from PRODUCTION (serverless), delete collection if going to provisioned
    if (fromTier === 'PRODUCTION' && toTier !== 'PRODUCTION') {
      try {
        await aoss.send(new GetCollectionCommand({ names: [collectionName] }));
        await aoss.send(new DeleteCollectionCommand({ name: collectionName }));
        result.deleted.push(`Serverless collection: ${collectionName}`);
      } catch (error: any) {
        if (error.name !== 'ResourceNotFoundException') {
          result.errors.push(`Failed to delete collection: ${error.message}`);
        }
      }
    }

    // Scale down provisioned domain
    if (fromTier !== 'PRODUCTION' && toTier === 'DEV') {
      try {
        await opensearch.send(new DescribeDomainCommand({ DomainName: domainName }));
        
        await opensearch.send(new UpdateDomainConfigCommand({
          DomainName: domainName,
          ClusterConfig: {
            InstanceType: 't3.small.search',
            InstanceCount: 1
          },
          EBSOptions: {
            EBSEnabled: true,
            VolumeType: 'gp3',
            VolumeSize: 10
          }
        }));
        result.scaled.push(`Scaled down domain: ${domainName}`);
      } catch (error: any) {
        if (error.name !== 'ResourceNotFoundException') {
          result.errors.push(`Failed to scale domain: ${error.message}`);
        }
      }
    }

  } catch (error: any) {
    console.error('OpenSearch cleanup error:', error);
    result.status = 'PARTIAL';
    result.errors.push(error.message);
  }

  return result;
};
