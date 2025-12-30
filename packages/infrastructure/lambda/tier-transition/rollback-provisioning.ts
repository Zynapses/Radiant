/**
 * Rollback Provisioning Lambda
 * 
 * Rolls back partially provisioned resources on failure.
 */

import { Handler } from 'aws-lambda';
import { SageMakerClient, DeleteEndpointCommand, DescribeEndpointCommand } from '@aws-sdk/client-sagemaker';
import { ElastiCacheClient, DeleteReplicationGroupCommand, DescribeReplicationGroupsCommand } from '@aws-sdk/client-elasticache';
import { NeptuneClient, DeleteDBClusterCommand, DescribeDBClustersCommand } from '@aws-sdk/client-neptune';

const sagemaker = new SageMakerClient({});
const elasticache = new ElastiCacheClient({});
const neptune = new NeptuneClient({});

interface TransitionEvent {
  tenantId: string;
  fromTier: string;
  toTier: string;
  error?: {
    Error: string;
    Cause: string;
  };
}

interface RollbackResult {
  status: string;
  rolledBack: string[];
  errors: string[];
}

export const handler: Handler<TransitionEvent, RollbackResult> = async (event) => {
  console.log('Rolling back provisioning:', JSON.stringify(event));

  const { tenantId, toTier } = event;
  const prefix = tenantId.substring(0, 8);
  const result: RollbackResult = {
    status: 'ROLLED_BACK',
    rolledBack: [],
    errors: []
  };

  // Only rollback resources that were being created for the NEW tier
  // Don't touch existing resources from the old tier

  const endpointName = `bobble-shadow-self-${prefix}`;
  const cacheName = `bobble-cache-${prefix}`;
  const clusterName = `bobble-graph-${prefix}`;

  // Rollback SageMaker if it was being created
  try {
    const endpoint = await sagemaker.send(new DescribeEndpointCommand({ EndpointName: endpointName }));
    
    // Only delete if it's still creating (not InService from old tier)
    if (endpoint.EndpointStatus === 'Creating' || endpoint.EndpointStatus === 'Updating') {
      await sagemaker.send(new DeleteEndpointCommand({ EndpointName: endpointName }));
      result.rolledBack.push(`SageMaker endpoint: ${endpointName}`);
    }
  } catch (error: any) {
    if (error.name !== 'ValidationException') {
      result.errors.push(`SageMaker rollback error: ${error.message}`);
    }
  }

  // Rollback ElastiCache if being created
  try {
    const cache = await elasticache.send(new DescribeReplicationGroupsCommand({ ReplicationGroupId: cacheName }));
    
    if (cache.ReplicationGroups?.[0]?.Status === 'creating') {
      await elasticache.send(new DeleteReplicationGroupCommand({ 
        ReplicationGroupId: cacheName,
        FinalSnapshotIdentifier: `${cacheName}-rollback-${Date.now()}`
      }));
      result.rolledBack.push(`ElastiCache cluster: ${cacheName}`);
    }
  } catch (error: any) {
    if (error.name !== 'ReplicationGroupNotFoundFault') {
      result.errors.push(`ElastiCache rollback error: ${error.message}`);
    }
  }

  // Rollback Neptune if being created
  try {
    const cluster = await neptune.send(new DescribeDBClustersCommand({ DBClusterIdentifier: clusterName }));
    
    if (cluster.DBClusters?.[0]?.Status === 'creating') {
      await neptune.send(new DeleteDBClusterCommand({
        DBClusterIdentifier: clusterName,
        SkipFinalSnapshot: false,
        FinalDBSnapshotIdentifier: `${clusterName}-rollback-${Date.now()}`
      }));
      result.rolledBack.push(`Neptune cluster: ${clusterName}`);
    }
  } catch (error: any) {
    if (error.name !== 'DBClusterNotFoundFault') {
      result.errors.push(`Neptune rollback error: ${error.message}`);
    }
  }

  if (result.errors.length > 0) {
    result.status = 'PARTIAL_ROLLBACK';
  }

  console.log('Rollback complete:', result);
  return result;
};
