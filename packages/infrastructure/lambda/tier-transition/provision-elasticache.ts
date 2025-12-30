/**
 * Provision ElastiCache Lambda
 * 
 * Provisions ElastiCache serverless or cluster based on tier.
 */

import { Handler } from 'aws-lambda';
import { 
  ElastiCacheClient,
  CreateReplicationGroupCommand,
  ModifyReplicationGroupCommand,
  DescribeReplicationGroupsCommand,
  CreateServerlessCacheCommand,
  DescribeServerlessCachesCommand
} from '@aws-sdk/client-elasticache';

const elasticache = new ElastiCacheClient({});

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
  type: 'serverless' | 'provisioned';
  nodeType?: string;
  numCacheNodes?: number;
  minEcpu?: number;
  maxEcpu?: number;
  clusterMode?: boolean;
}> = {
  DEV: {
    type: 'serverless',
    minEcpu: 1000,
    maxEcpu: 5000
  },
  STAGING: {
    type: 'provisioned',
    nodeType: 'cache.r7g.large',
    numCacheNodes: 2,
    clusterMode: false
  },
  PRODUCTION: {
    type: 'provisioned',
    nodeType: 'cache.r7g.xlarge',
    numCacheNodes: 6,
    clusterMode: true
  }
};

export const handler: Handler<TransitionEvent, ProvisionResult> = async (event) => {
  console.log('Provisioning ElastiCache:', JSON.stringify(event));

  const { tenantId, toTier } = event;
  const config = TIER_CONFIGS[toTier];
  const result: ProvisionResult = {
    service: 'ElastiCache',
    status: 'SUCCESS',
    resources: [],
    errors: []
  };

  if (!config) {
    result.status = 'FAILED';
    result.errors.push(`Unknown tier: ${toTier}`);
    return result;
  }

  const clusterName = `bobble-cache-${tenantId.substring(0, 8)}`;

  try {
    if (config.type === 'serverless') {
      // Create serverless cache
      try {
        await elasticache.send(new DescribeServerlessCachesCommand({
          ServerlessCacheName: clusterName
        }));
        result.resources.push(`Serverless cache exists: ${clusterName}`);
      } catch (error: any) {
        if (error.name === 'ServerlessCacheNotFoundFault') {
          await elasticache.send(new CreateServerlessCacheCommand({
            ServerlessCacheName: clusterName,
            Engine: 'valkey',
            Description: 'Bobble semantic cache',
            CacheUsageLimits: {
              ECPUPerSecond: { Maximum: config.maxEcpu }
            }
          }));
          result.resources.push(`Created serverless cache: ${clusterName}`);
        } else {
          throw error;
        }
      }
    } else {
      // Create or update replication group
      try {
        await elasticache.send(new DescribeReplicationGroupsCommand({
          ReplicationGroupId: clusterName
        }));

        // Update existing
        await elasticache.send(new ModifyReplicationGroupCommand({
          ReplicationGroupId: clusterName,
          CacheNodeType: config.nodeType,
          ApplyImmediately: true
        }));
        result.resources.push(`Updated replication group: ${clusterName}`);
      } catch (error: any) {
        if (error.name === 'ReplicationGroupNotFoundFault') {
          await elasticache.send(new CreateReplicationGroupCommand({
            ReplicationGroupId: clusterName,
            ReplicationGroupDescription: 'Bobble semantic cache cluster',
            Engine: 'valkey',
            CacheNodeType: config.nodeType,
            NumCacheClusters: config.numCacheNodes,
            AutomaticFailoverEnabled: config.numCacheNodes! > 1
          }));
          result.resources.push(`Created replication group: ${clusterName}`);
        } else {
          throw error;
        }
      }
    }
  } catch (error: any) {
    console.error('ElastiCache provisioning error:', error);
    result.status = 'FAILED';
    result.errors.push(error.message);
  }

  return result;
};
