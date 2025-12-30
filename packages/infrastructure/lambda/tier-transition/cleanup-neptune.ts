/**
 * Cleanup Neptune Lambda
 * 
 * Cleans up Neptune resources when scaling down.
 */

import { Handler } from 'aws-lambda';
import {
  NeptuneClient,
  DeleteDBInstanceCommand,
  DescribeDBInstancesCommand,
  ModifyDBClusterCommand
} from '@aws-sdk/client-neptune';

const neptune = new NeptuneClient({});

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
  console.log('Cleaning up Neptune:', JSON.stringify(event));

  const { tenantId, fromTier, toTier, timestamp } = event;
  const prefix = tenantId.substring(0, 8);
  const result: CleanupResult = {
    service: 'Neptune',
    status: 'SUCCESS',
    deleted: [],
    scaled: [],
    snapshots: [],
    errors: []
  };

  const clusterName = `bobble-graph-${prefix}`;

  try {
    // When going from PRODUCTION (provisioned) to serverless
    if (fromTier === 'PRODUCTION' && toTier !== 'PRODUCTION') {
      // Delete provisioned instances
      try {
        const instances = await neptune.send(new DescribeDBInstancesCommand({
          Filters: [{ Name: 'db-cluster-id', Values: [clusterName] }]
        }));

        for (const instance of instances.DBInstances || []) {
          const instanceId = instance.DBInstanceIdentifier!;
          const snapshotId = `${instanceId}-final-${timestamp?.replace(/[:.]/g, '-') || Date.now()}`;

          await neptune.send(new DeleteDBInstanceCommand({
            DBInstanceIdentifier: instanceId,
            SkipFinalSnapshot: false,
            FinalDBSnapshotIdentifier: snapshotId
          }));

          result.deleted.push(instanceId);
          result.snapshots.push(snapshotId);
          console.log(`Deleted instance ${instanceId} with snapshot ${snapshotId}`);
        }
      } catch (error: any) {
        if (error.name !== 'DBInstanceNotFoundFault') {
          result.errors.push(`Failed to delete instances: ${error.message}`);
        }
      }

      // Convert cluster to serverless
      try {
        const targetConfig = toTier === 'DEV' 
          ? { MinCapacity: 1.0, MaxCapacity: 2.5 }
          : { MinCapacity: 2.5, MaxCapacity: 16.0 };

        await neptune.send(new ModifyDBClusterCommand({
          DBClusterIdentifier: clusterName,
          ServerlessV2ScalingConfiguration: targetConfig
        }));
        result.scaled.push(`Converted to serverless: ${clusterName}`);
      } catch (error: any) {
        result.errors.push(`Failed to convert to serverless: ${error.message}`);
      }
    }

    // When going from STAGING to DEV, reduce serverless capacity
    if (fromTier === 'STAGING' && toTier === 'DEV') {
      try {
        await neptune.send(new ModifyDBClusterCommand({
          DBClusterIdentifier: clusterName,
          ServerlessV2ScalingConfiguration: {
            MinCapacity: 1.0,
            MaxCapacity: 2.5
          }
        }));
        result.scaled.push(`Reduced serverless capacity: ${clusterName}`);
      } catch (error: any) {
        result.errors.push(`Failed to reduce capacity: ${error.message}`);
      }
    }

  } catch (error: any) {
    console.error('Neptune cleanup error:', error);
    result.status = 'PARTIAL';
    result.errors.push(error.message);
  }

  return result;
};
