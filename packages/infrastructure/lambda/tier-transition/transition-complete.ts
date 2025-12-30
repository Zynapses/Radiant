/**
 * Transition Complete Lambda
 * 
 * Finalizes a successful tier transition.
 */

import { Handler } from 'aws-lambda';
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const rdsData = new RDSDataClient({});
const sns = new SNSClient({});

interface TransitionEvent {
  tenantId: string;
  fromTier: string;
  toTier: string;
  direction: string;
  requestedBy: string;
  reason: string;
  timestamp: string;
}

interface CompletionResult {
  status: string;
  tier: string;
  completedAt: string;
  notificationSent: boolean;
}

export const handler: Handler<TransitionEvent, CompletionResult> = async (event) => {
  console.log('Completing transition:', JSON.stringify(event));

  const { tenantId, fromTier, toTier, direction, requestedBy, reason } = event;
  const completedAt = new Date().toISOString();

  // Update database
  try {
    const clusterArn = process.env.DB_CLUSTER_ARN;
    const secretArn = process.env.DB_SECRET_ARN;
    const database = process.env.DB_NAME || 'radiant';

    if (clusterArn && secretArn) {
      // Set cooldown period (24 hours)
      const nextChangeAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Update tier state
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
            transition_execution_arn = NULL,
            transition_completed_at = :completedAt::timestamptz,
            next_change_allowed_at = :nextChange::timestamptz,
            last_changed_by = :changedBy,
            last_changed_at = :completedAt::timestamptz,
            updated_at = NOW()
          WHERE tenant_id = :tenantId::uuid
        `,
        parameters: [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'tier', value: { stringValue: toTier } },
          { name: 'completedAt', value: { stringValue: completedAt } },
          { name: 'nextChange', value: { stringValue: nextChangeAllowed } },
          { name: 'changedBy', value: { stringValue: requestedBy } }
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
            status = 'COMPLETED',
            completed_at = :completedAt::timestamptz,
            duration_seconds = EXTRACT(EPOCH FROM (:completedAt::timestamptz - started_at))::integer
          WHERE tenant_id = :tenantId::uuid
            AND status IN ('INITIATED', 'IN_PROGRESS')
          ORDER BY created_at DESC
          LIMIT 1
        `,
        parameters: [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'completedAt', value: { stringValue: completedAt } }
        ]
      }));

      console.log('Database updated successfully');
    }
  } catch (error) {
    console.error('Failed to update database:', error);
  }

  // Send notification
  let notificationSent = false;
  try {
    const topicArn = process.env.NOTIFICATION_TOPIC_ARN;
    if (topicArn) {
      await sns.send(new PublishCommand({
        TopicArn: topicArn,
        Subject: `Bobble Tier Transition Complete: ${fromTier} → ${toTier}`,
        Message: JSON.stringify({
          event: 'TIER_TRANSITION_COMPLETE',
          tenantId,
          fromTier,
          toTier,
          direction,
          requestedBy,
          reason,
          completedAt
        }, null, 2)
      }));
      notificationSent = true;
      console.log('Notification sent');
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
  }

  console.log(`Transition complete: ${fromTier} → ${toTier}`);

  return {
    status: 'COMPLETED',
    tier: toTier,
    completedAt,
    notificationSent
  };
};
