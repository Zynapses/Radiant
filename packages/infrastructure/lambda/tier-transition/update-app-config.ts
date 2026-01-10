/**
 * Update App Config Lambda
 * 
 * Updates application configuration to point to new tier resources.
 */

import { Handler } from 'aws-lambda';
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';
import { logger } from '../shared/logging/enhanced-logger';

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
  logger.info('Updating app config:', { event });

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
          UPDATE cato_infrastructure_tier
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
          UPDATE cato_tier_change_log
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
          { name: 'resources', value: { stringValue: JSON.stringify(Object.keys((newConfig as Record<string, unknown>).endpoints || {})) } }
        ]
      }));

      logger.info('Database updated successfully');
    } else {
      logger.info('Database ARNs not configured, skipping DB update');
    }
  } catch (error) {
    logger.error('Failed to update database:', error);
    // Don't fail the transition - the config is still valid
  }

  logger.info('App config updated:', { data: newConfig });
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
        sagemaker: `cato-shadow-self-${prefix}`,
        opensearch: `cato-vectors-${prefix}`,
        elasticache: `cato-cache-${prefix}.serverless`,
        neptune: `cato-graph-${prefix}`,
        kinesis: `cato-events-${prefix}`
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
        sagemaker: `cato-shadow-self-${prefix}`,
        opensearch: `cato-vectors-${prefix}`,
        elasticache: `cato-cache-${prefix}`,
        neptune: `cato-graph-${prefix}`,
        kinesis: `cato-events-${prefix}`
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
        sagemaker: `cato-shadow-self-${prefix}`,
        opensearchServerless: `cato-vectors-${prefix}`,
        elasticache: `cato-cache-${prefix}`,
        neptune: `cato-graph-${prefix}`,
        kinesis: `cato-events-${prefix}`
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
