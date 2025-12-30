/**
 * Provision Neptune Lambda
 * 
 * Provisions Neptune serverless or provisioned cluster based on tier.
 */

import { Handler } from 'aws-lambda';
import {
  NeptuneClient,
  CreateDBClusterCommand,
  CreateDBInstanceCommand,
  ModifyDBClusterCommand,
  DescribeDBClustersCommand
} from '@aws-sdk/client-neptune';

const neptune = new NeptuneClient({});

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
  instanceClass?: string;
  instanceCount?: number;
  minCapacity?: number;
  maxCapacity?: number;
}> = {
  DEV: {
    type: 'serverless',
    minCapacity: 1.0,
    maxCapacity: 2.5
  },
  STAGING: {
    type: 'serverless',
    minCapacity: 2.5,
    maxCapacity: 16.0
  },
  PRODUCTION: {
    type: 'provisioned',
    instanceClass: 'db.r6g.2xlarge',
    instanceCount: 3
  }
};

export const handler: Handler<TransitionEvent, ProvisionResult> = async (event) => {
  console.log('Provisioning Neptune:', JSON.stringify(event));

  const { tenantId, toTier } = event;
  const config = TIER_CONFIGS[toTier];
  const result: ProvisionResult = {
    service: 'Neptune',
    status: 'SUCCESS',
    resources: [],
    errors: []
  };

  if (!config) {
    result.status = 'FAILED';
    result.errors.push(`Unknown tier: ${toTier}`);
    return result;
  }

  const clusterName = `bobble-graph-${tenantId.substring(0, 8)}`;

  try {
    // Check if cluster exists
    let clusterExists = false;
    try {
      await neptune.send(new DescribeDBClustersCommand({
        DBClusterIdentifier: clusterName
      }));
      clusterExists = true;
    } catch (error: any) {
      if (error.name !== 'DBClusterNotFoundFault') {
        throw error;
      }
    }

    if (config.type === 'serverless') {
      if (clusterExists) {
        // Update serverless scaling
        await neptune.send(new ModifyDBClusterCommand({
          DBClusterIdentifier: clusterName,
          ServerlessV2ScalingConfiguration: {
            MinCapacity: config.minCapacity,
            MaxCapacity: config.maxCapacity
          }
        }));
        result.resources.push(`Updated serverless cluster: ${clusterName}`);
      } else {
        // Create serverless cluster
        await neptune.send(new CreateDBClusterCommand({
          DBClusterIdentifier: clusterName,
          Engine: 'neptune',
          EngineVersion: '1.3.0.0',
          ServerlessV2ScalingConfiguration: {
            MinCapacity: config.minCapacity,
            MaxCapacity: config.maxCapacity
          }
        }));
        result.resources.push(`Created serverless cluster: ${clusterName}`);
      }
    } else {
      // Provisioned cluster
      if (!clusterExists) {
        await neptune.send(new CreateDBClusterCommand({
          DBClusterIdentifier: clusterName,
          Engine: 'neptune',
          EngineVersion: '1.3.0.0'
        }));
        result.resources.push(`Created cluster: ${clusterName}`);

        // Create instances
        for (let i = 1; i <= config.instanceCount!; i++) {
          await neptune.send(new CreateDBInstanceCommand({
            DBInstanceIdentifier: `${clusterName}-instance-${i}`,
            DBClusterIdentifier: clusterName,
            DBInstanceClass: config.instanceClass,
            Engine: 'neptune'
          }));
          result.resources.push(`Created instance: ${clusterName}-instance-${i}`);
        }
      } else {
        result.resources.push(`Cluster exists: ${clusterName}`);
      }
    }
  } catch (error: any) {
    console.error('Neptune provisioning error:', error);
    result.status = 'FAILED';
    result.errors.push(error.message);
  }

  return result;
};
