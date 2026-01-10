/**
 * Cleanup ElastiCache Lambda
 * 
 * Cleans up ElastiCache resources when scaling down.
 */

import { Handler } from 'aws-lambda';
import { logger } from '../shared/logging/enhanced-logger';
import {
  ElastiCacheClient,
  DeleteReplicationGroupCommand,
  DescribeReplicationGroupsCommand,
  ModifyReplicationGroupCommand
} from '@aws-sdk/client-elasticache';

const elasticache = new ElastiCacheClient({});

interface TransitionEvent {
  tenantId: string;
  fromTier: string;
  toTier: string;
  timestamp: string;
}

interface CleanupResult {
  service: string;
  status: string;
  deleted: string[];
  scaled: string[];
  snapshots: string[];
  errors: string[];
}

export const handler: Handler<TransitionEvent, CleanupResult> = async (event) => {
  logger.info('Cleaning up ElastiCache:', { event });

  const { tenantId, fromTier, toTier, timestamp } = event;
  const prefix = tenantId.substring(0, 8);
  const result: CleanupResult = {
    service: 'ElastiCache',
    status: 'SUCCESS',
    deleted: [],
    scaled: [],
    snapshots: [],
    errors: []
  };

  const clusterName = `cato-cache-${prefix}`;

  try {
    // When going to DEV, delete provisioned cluster (will use serverless)
    if (toTier === 'DEV' && fromTier !== 'DEV') {
      try {
        await elasticache.send(new DescribeReplicationGroupsCommand({
          ReplicationGroupId: clusterName
        }));

        // Create snapshot before deletion
        const snapshotName = `${clusterName}-backup-${timestamp?.replace(/[:.]/g, '-') || Date.now()}`;
        
        await elasticache.send(new DeleteReplicationGroupCommand({
          ReplicationGroupId: clusterName,
          FinalSnapshotIdentifier: snapshotName
        }));

        result.deleted.push(clusterName);
        result.snapshots.push(snapshotName);
        logger.info(`Deleted cluster ${clusterName} with snapshot ${snapshotName}`);

      } catch (error: any) {
        if (error.name === 'ReplicationGroupNotFoundFault') {
          logger.info('Cluster does not exist, nothing to cleanup');
        } else {
          throw error;
        }
      }
    }

    // When scaling from PRODUCTION to STAGING, reduce nodes
    if (fromTier === 'PRODUCTION' && toTier === 'STAGING') {
      try {
        await elasticache.send(new ModifyReplicationGroupCommand({
          ReplicationGroupId: clusterName,
          CacheNodeType: 'cache.r7g.large',
          ApplyImmediately: true
        }));
        result.scaled.push(`Scaled down to cache.r7g.large: ${clusterName}`);
      } catch (error: any) {
        if (error.name !== 'ReplicationGroupNotFoundFault') {
          result.errors.push(`Failed to scale cluster: ${error.message}`);
        }
      }
    }

  } catch (error: any) {
    logger.error('ElastiCache cleanup error:', error);
    result.status = 'PARTIAL';
    result.errors.push(error.message);
  }

  return result;
};
