/**
 * Provision OpenSearch Lambda
 * 
 * Provisions OpenSearch domain or serverless collection based on tier.
 */

import { Handler } from 'aws-lambda';
import { logger } from '../shared/logging/enhanced-logger';
import { 
  OpenSearchClient, 
  CreateDomainCommand,
  UpdateDomainConfigCommand,
  DescribeDomainCommand
} from '@aws-sdk/client-opensearch';
import {
  OpenSearchServerlessClient,
  CreateCollectionCommand,
  BatchGetCollectionCommand
} from '@aws-sdk/client-opensearchserverless';

const opensearch = new OpenSearchClient({});
const aoss = new OpenSearchServerlessClient({});

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

const TIER_CONFIGS: Record<string, {
  type: 'provisioned' | 'serverless';
  instanceType?: string;
  instanceCount?: number;
  ebsVolumeSize?: number;
  minOcus?: number;
  maxOcus?: number;
}> = {
  DEV: {
    type: 'provisioned',
    instanceType: 't3.small.search',
    instanceCount: 1,
    ebsVolumeSize: 10
  },
  STAGING: {
    type: 'provisioned',
    instanceType: 'r6g.large.search',
    instanceCount: 3,
    ebsVolumeSize: 100
  },
  PRODUCTION: {
    type: 'serverless',
    minOcus: 50,
    maxOcus: 500
  }
};

export const handler: Handler<TransitionEvent, ProvisionResult> = async (event) => {
  logger.info('Provisioning OpenSearch:', { event });

  const { tenantId, toTier } = event;
  const config = TIER_CONFIGS[toTier];
  const result: ProvisionResult = {
    service: 'OpenSearch',
    status: 'SUCCESS',
    resources: [],
    errors: []
  };

  if (!config) {
    result.status = 'FAILED';
    result.errors.push(`Unknown tier: ${toTier}`);
    return result;
  }

  const domainName = `cato-vectors-${tenantId.substring(0, 8)}`;
  const collectionName = `cato-vectors-${tenantId.substring(0, 8)}`;

  try {
    if (config.type === 'serverless') {
      // Create or verify serverless collection
      try {
        await aoss.send(new BatchGetCollectionCommand({ names: [collectionName] }));
        result.resources.push(`Serverless collection exists: ${collectionName}`);
      } catch {
        await aoss.send(new CreateCollectionCommand({
          name: collectionName,
          type: 'VECTORSEARCH',
          description: 'Cato semantic vector search'
        }));
        result.resources.push(`Created serverless collection: ${collectionName}`);
      }
    } else {
      // Create or update provisioned domain
      try {
        await opensearch.send(new DescribeDomainCommand({ DomainName: domainName }));
        
        // Update existing domain
        await opensearch.send(new UpdateDomainConfigCommand({
          DomainName: domainName,
          ClusterConfig: {
            InstanceType: config.instanceType as any,
            InstanceCount: config.instanceCount
          },
          EBSOptions: {
            EBSEnabled: true,
            VolumeType: 'gp3',
            VolumeSize: config.ebsVolumeSize
          }
        }));
        result.resources.push(`Updated domain: ${domainName}`);
      } catch (error: any) {
        if (error.name === 'ResourceNotFoundException') {
          // Create new domain
          await opensearch.send(new CreateDomainCommand({
            DomainName: domainName,
            EngineVersion: 'OpenSearch_2.11',
            ClusterConfig: {
              InstanceType: config.instanceType as any,
              InstanceCount: config.instanceCount
            },
            EBSOptions: {
              EBSEnabled: true,
              VolumeType: 'gp3',
              VolumeSize: config.ebsVolumeSize
            }
          }));
          result.resources.push(`Created domain: ${domainName}`);
        } else {
          throw error;
        }
      }
    }
  } catch (error: any) {
    logger.error('OpenSearch provisioning error:', error);
    result.status = 'FAILED';
    result.errors.push(error.message);
  }

  return result;
};
