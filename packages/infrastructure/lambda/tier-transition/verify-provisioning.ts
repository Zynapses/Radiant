/**
 * Verify Provisioning Lambda
 * 
 * Verifies that all provisioned resources are ready before proceeding.
 */

import { Handler } from 'aws-lambda';
import { SageMakerClient, DescribeEndpointCommand } from '@aws-sdk/client-sagemaker';
import { OpenSearchClient, DescribeDomainCommand } from '@aws-sdk/client-opensearch';
import { ElastiCacheClient, DescribeReplicationGroupsCommand } from '@aws-sdk/client-elasticache';
import { NeptuneClient, DescribeDBClustersCommand } from '@aws-sdk/client-neptune';
import { logger } from '../shared/logging/enhanced-logger';

const sagemaker = new SageMakerClient({});
const opensearch = new OpenSearchClient({});
const elasticache = new ElastiCacheClient({});
const neptune = new NeptuneClient({});

interface TransitionEvent {
  tenantId: string;
  toTier: string;
}

class ResourceNotReady extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceNotReady';
  }
}

export const handler: Handler<TransitionEvent, { verified: boolean; details: Record<string, string> }> = async (event) => {
  logger.info('Verifying provisioning:', { event });

  const { tenantId, toTier } = event;
  const prefix = tenantId.substring(0, 8);
  const details: Record<string, string> = {};

  // Check SageMaker endpoint
  try {
    const endpoint = await sagemaker.send(new DescribeEndpointCommand({
      EndpointName: `cato-shadow-self-${prefix}`
    }));
    
    if (endpoint.EndpointStatus !== 'InService') {
      throw new ResourceNotReady(`SageMaker endpoint status: ${endpoint.EndpointStatus}`);
    }
    details.sagemaker = 'InService';
  } catch (error: any) {
    if (error.name === 'ResourceNotReady') throw error;
    if (error.name === 'ValidationException') {
      details.sagemaker = 'NotCreated (may be scale-to-zero)';
    } else {
      throw error;
    }
  }

  // Check OpenSearch domain (for DEV/STAGING)
  if (toTier !== 'PRODUCTION') {
    try {
      const domain = await opensearch.send(new DescribeDomainCommand({
        DomainName: `cato-vectors-${prefix}`
      }));
      
      if (domain.DomainStatus?.Processing) {
        throw new ResourceNotReady('OpenSearch domain still processing');
      }
      details.opensearch = 'Active';
    } catch (error: any) {
      if (error.name === 'ResourceNotReady') throw error;
      if (error.name === 'ResourceNotFoundException') {
        details.opensearch = 'NotFound (creating)';
        throw new ResourceNotReady('OpenSearch domain not found');
      }
      throw error;
    }
  } else {
    details.opensearch = 'Serverless (auto-ready)';
  }

  // Check ElastiCache
  if (toTier !== 'DEV') {
    try {
      const result = await elasticache.send(new DescribeReplicationGroupsCommand({
        ReplicationGroupId: `cato-cache-${prefix}`
      }));
      
      const status = result.ReplicationGroups?.[0]?.Status;
      if (status !== 'available') {
        throw new ResourceNotReady(`ElastiCache status: ${status}`);
      }
      details.elasticache = 'Available';
    } catch (error: any) {
      if (error.name === 'ResourceNotReady') throw error;
      if (error.name === 'ReplicationGroupNotFoundFault') {
        throw new ResourceNotReady('ElastiCache replication group not found');
      }
      throw error;
    }
  } else {
    details.elasticache = 'Serverless (auto-ready)';
  }

  // Check Neptune
  try {
    const result = await neptune.send(new DescribeDBClustersCommand({
      DBClusterIdentifier: `cato-graph-${prefix}`
    }));
    
    const status = result.DBClusters?.[0]?.Status;
    if (status !== 'available') {
      throw new ResourceNotReady(`Neptune cluster status: ${status}`);
    }
    details.neptune = 'Available';
  } catch (error: any) {
    if (error.name === 'ResourceNotReady') throw error;
    if (error.name === 'DBClusterNotFoundFault') {
      throw new ResourceNotReady('Neptune cluster not found');
    }
    throw error;
  }

  logger.info('All resources verified:', { data: details });
  return { verified: true, details };
};
