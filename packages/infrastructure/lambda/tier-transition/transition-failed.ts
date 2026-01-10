/**
 * Transition Failed Lambda
 * 
 * Handles failed tier transitions and sends alerts.
 */

import { Handler } from 'aws-lambda';
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from '../shared/logging/enhanced-logger';

const rdsData = new RDSDataClient({});
const sns = new SNSClient({});

interface TransitionEvent {
  tenantId: string;
  fromTier: string;
  toTier: string;
  direction: string;
  requestedBy: string;
  reason: string;
  error?: {
    Error: string;
    Cause: string;
  };
}

interface FailureResult {
  status: string;
  tier: string;
  error: string;
  alertSent: boolean;
}

export const handler: Handler<TransitionEvent, FailureResult> = async (event) => {
  logger.error('Transition failed:', undefined, { event });

  const { tenantId, fromTier, toTier, requestedBy, error } = event;
  const failedAt = new Date().toISOString();
  const errorMessage = error?.Cause || error?.Error || 'Unknown error';

  // Update database - revert to original tier
  try {
    const clusterArn = process.env.DB_CLUSTER_ARN;
    const secretArn = process.env.DB_SECRET_ARN;
    const database = process.env.DB_NAME || 'radiant';

    if (clusterArn && secretArn) {
      // Revert tier state
      await rdsData.send(new ExecuteStatementCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database: database,
        sql: `
          UPDATE cato_infrastructure_tier
          SET 
            target_tier = NULL,
            transition_status = 'FAILED',
            transition_execution_arn = NULL,
            updated_at = NOW()
          WHERE tenant_id = :tenantId::uuid
        `,
        parameters: [
          { name: 'tenantId', value: { stringValue: tenantId } }
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
            status = 'FAILED',
            completed_at = :failedAt::timestamptz,
            errors = :errors::jsonb,
            duration_seconds = EXTRACT(EPOCH FROM (:failedAt::timestamptz - started_at))::integer
          WHERE tenant_id = :tenantId::uuid
            AND status IN ('INITIATED', 'IN_PROGRESS')
          ORDER BY created_at DESC
          LIMIT 1
        `,
        parameters: [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'failedAt', value: { stringValue: failedAt } },
          { name: 'errors', value: { stringValue: JSON.stringify([errorMessage]) } }
        ]
      }));

      logger.info('Database updated with failure status');
    }
  } catch (dbError) {
    logger.error('Failed to update database:', dbError);
  }

  // Send alert
  let alertSent = false;
  try {
    const topicArn = process.env.ALERT_TOPIC_ARN || process.env.NOTIFICATION_TOPIC_ARN;
    if (topicArn) {
      await sns.send(new PublishCommand({
        TopicArn: topicArn,
        Subject: `🚨 ALERT: Cato Tier Transition FAILED: ${fromTier} → ${toTier}`,
        Message: JSON.stringify({
          event: 'TIER_TRANSITION_FAILED',
          severity: 'HIGH',
          tenantId,
          fromTier,
          toTier,
          requestedBy,
          error: errorMessage,
          failedAt,
          action: 'Manual intervention may be required. Check Step Functions execution logs.'
        }, null, 2)
      }));
      alertSent = true;
      logger.info('Alert sent');
    }
  } catch (snsError) {
    logger.error('Failed to send alert:', snsError);
  }

  return {
    status: 'FAILED',
    tier: fromTier, // Stayed on original tier
    error: errorMessage,
    alertSent
  };
};
