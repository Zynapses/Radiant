/**
 * Provision Kinesis Lambda
 * 
 * Provisions Kinesis data streams based on tier configuration.
 */

import { Handler } from 'aws-lambda';
import { logger } from '../shared/logging/enhanced-logger';
import {
  KinesisClient,
  CreateStreamCommand,
  UpdateShardCountCommand,
  DescribeStreamSummaryCommand
} from '@aws-sdk/client-kinesis';

const kinesis = new KinesisClient({});

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
  capacityMode: 'ON_DEMAND' | 'PROVISIONED';
  shardCount?: number;
}> = {
  DEV: {
    capacityMode: 'ON_DEMAND'
  },
  STAGING: {
    capacityMode: 'PROVISIONED',
    shardCount: 5
  },
  PRODUCTION: {
    capacityMode: 'PROVISIONED',
    shardCount: 20
  }
};

export const handler: Handler<TransitionEvent, ProvisionResult> = async (event) => {
  logger.info('Provisioning Kinesis:', { event });

  const { tenantId, toTier } = event;
  const config = TIER_CONFIGS[toTier];
  const result: ProvisionResult = {
    service: 'Kinesis',
    status: 'SUCCESS',
    resources: [],
    errors: []
  };

  if (!config) {
    result.status = 'FAILED';
    result.errors.push(`Unknown tier: ${toTier}`);
    return result;
  }

  const streamName = `cato-events-${tenantId.substring(0, 8)}`;

  try {
    // Check if stream exists
    let streamExists = false;
    let currentShardCount = 0;
    try {
      const description = await kinesis.send(new DescribeStreamSummaryCommand({
        StreamName: streamName
      }));
      streamExists = true;
      currentShardCount = description.StreamDescriptionSummary?.OpenShardCount || 0;
    } catch (error: any) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    if (!streamExists) {
      // Create new stream
      await kinesis.send(new CreateStreamCommand({
        StreamName: streamName,
        StreamModeDetails: {
          StreamMode: config.capacityMode
        },
        ShardCount: config.capacityMode === 'PROVISIONED' ? config.shardCount : undefined
      }));
      result.resources.push(`Created stream: ${streamName} (${config.capacityMode})`);
    } else if (config.capacityMode === 'PROVISIONED' && config.shardCount && currentShardCount !== config.shardCount) {
      // Update shard count
      await kinesis.send(new UpdateShardCountCommand({
        StreamName: streamName,
        TargetShardCount: config.shardCount,
        ScalingType: 'UNIFORM_SCALING'
      }));
      result.resources.push(`Updated stream shards: ${streamName} (${currentShardCount} -> ${config.shardCount})`);
    } else {
      result.resources.push(`Stream exists: ${streamName}`);
    }
  } catch (error: any) {
    logger.error('Kinesis provisioning error:', error);
    result.status = 'FAILED';
    result.errors.push(error.message);
  }

  return result;
};
