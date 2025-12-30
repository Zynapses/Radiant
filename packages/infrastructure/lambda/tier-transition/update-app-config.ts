/**
 * Update App Config Lambda
 * 
 * Updates application configuration to point to new tier resources.
 */

import { Handler } from 'aws-lambda';
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';

const rdsData = new RDSDataClient({});

interface TransitionEvent {
  tenantId: string;
  fromTier: string;
  toTier: string;
  direction: string;
  requestedBy: string;
}

interface UpdateResult {
  updated: boolean;
  config: Record<string, unknown>;
}

export const handler: Handler<TransitionEvent, UpdateResult> = async (event) => {
  console.log('Updating app config:', JSON.stringify(event));

  const { tenantId, toTier, direction, requestedBy } = event;
  const prefix = tenantId.substring(0, 8);

  // Build new configuration based on tier
  const newConfig = buildTierConfig(toTier, prefix);

  // Update database
  try {
    const clusterArn = process.env.DB_CLUSTER_ARN;
    const secretArn = process.env.DB_SECRET_ARN;
    const database = process.env.DB_NAME || 'radiant';

    if (clusterArn && secretArn) {
      // Update infrastructure tier table
      await rdsData.send(new ExecuteStatementCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database: database,
        sql: `
          UPDATE bobble_infrastructure_tier
          SET 
            current_tier = :tier,
            target_tier = NULL,
            transition_status = 'STABLE',
            transition_completed_at = NOW(),
            last_changed_by = :changedBy,
            last_changed_at = NOW(),
            estimated_monthly_cost = :cost,
            updated_at = NOW()
          WHERE tenant_id = :tenantId::uuid
        `,
        parameters: [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'tier', value: { stringValue: toTier } },
          { name: 'changedBy', value: { stringValue: requestedBy } },
          { name: 'cost', value: { doubleValue: newConfig.estimatedMonthlyCost as number } }
        ]
      }));

      // Update audit log
      await rdsData.send(new ExecuteStatementCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database: database,
        sql: `
          UPDATE bobble_tier_change_log
          SET 
            status = 'IN_PROGRESS',
            resources_provisioned = :resources::jsonb
          WHERE tenant_id = :tenantId::uuid
            AND status = 'INITIATED'
          ORDER BY created_at DESC
          LIMIT 1
        `,
        parameters: [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'resources', value: { stringValue: JSON.stringify(Object.keys(newConfig.endpoints)) } }
        ]
      }));

      console.log('Database updated successfully');
    } else {
      console.log('Database ARNs not configured, skipping DB update');
    }
  } catch (error) {
    console.error('Failed to update database:', error);
    // Don't fail the transition - the config is still valid
  }

  console.log('App config updated:', newConfig);
  return {
    updated: true,
    config: newConfig
  };
};

function buildTierConfig(tier: string, prefix: string): Record<string, unknown> {
  const configs: Record<string, Record<string, unknown>> = {
    DEV: {
      estimatedMonthlyCost: 350,
      endpoints: {
        sagemaker: `bobble-shadow-self-${prefix}`,
        opensearch: `bobble-vectors-${prefix}`,
        elasticache: `bobble-cache-${prefix}.serverless`,
        neptune: `bobble-graph-${prefix}`,
        kinesis: `bobble-events-${prefix}`
      },
      settings: {
        sagemakerScaleToZero: true,
        opensearchType: 'provisioned',
        elasticacheType: 'serverless',
        neptuneType: 'serverless'
      }
    },
    STAGING: {
      estimatedMonthlyCost: 35000,
      endpoints: {
        sagemaker: `bobble-shadow-self-${prefix}`,
        opensearch: `bobble-vectors-${prefix}`,
        elasticache: `bobble-cache-${prefix}`,
        neptune: `bobble-graph-${prefix}`,
        kinesis: `bobble-events-${prefix}`
      },
      settings: {
        sagemakerScaleToZero: false,
        opensearchType: 'provisioned',
        elasticacheType: 'provisioned',
        neptuneType: 'serverless'
      }
    },
    PRODUCTION: {
      estimatedMonthlyCost: 750000,
      endpoints: {
        sagemaker: `bobble-shadow-self-${prefix}`,
        opensearchServerless: `bobble-vectors-${prefix}`,
        elasticache: `bobble-cache-${prefix}`,
        neptune: `bobble-graph-${prefix}`,
        kinesis: `bobble-events-${prefix}`
      },
      settings: {
        sagemakerScaleToZero: false,
        opensearchType: 'serverless',
        elasticacheType: 'provisioned',
        neptuneType: 'provisioned',
        globalTables: true
      }
    }
  };

  return configs[tier] || configs.DEV;
}
