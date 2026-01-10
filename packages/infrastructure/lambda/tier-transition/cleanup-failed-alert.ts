/**
 * Cleanup Failed Alert Lambda
 * 
 * Sends alert when cleanup fails but transition continues.
 */

import { Handler } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from '../shared/logging/enhanced-logger';

const sns = new SNSClient({});

interface TransitionEvent {
  tenantId: string;
  fromTier: string;
  toTier: string;
  requestedBy: string;
  error?: {
    Error: string;
    Cause: string;
  };
}

interface AlertResult {
  status: string;
  alertSent: boolean;
  orphanedResources: string[];
}

export const handler: Handler<TransitionEvent, AlertResult> = async (event) => {
  logger.warn('Cleanup failed, sending alert:', { event });

  const { tenantId, fromTier, toTier, requestedBy, error } = event;
  const prefix = tenantId.substring(0, 8);
  const errorMessage = error?.Cause || error?.Error || 'Unknown cleanup error';

  // Identify potentially orphaned resources
  const orphanedResources: string[] = [];
  
  if (fromTier === 'PRODUCTION') {
    orphanedResources.push(
      `cato-shadow-self-${prefix}-eu-west-1`,
      `cato-shadow-self-${prefix}-ap-northeast-1`,
      `cato-vectors-${prefix} (serverless collection)`
    );
  }
  
  if (fromTier !== 'DEV' && toTier === 'DEV') {
    orphanedResources.push(
      `cato-cache-${prefix} (ElastiCache cluster)`,
      `cato-graph-${prefix} (Neptune instances)`
    );
  }

  // Send alert
  let alertSent = false;
  try {
    const topicArn = process.env.ALERT_TOPIC_ARN || process.env.NOTIFICATION_TOPIC_ARN;
    if (topicArn) {
      await sns.send(new PublishCommand({
        TopicArn: topicArn,
        Subject: `⚠️ WARNING: Cato Tier Cleanup Failed (resources may be orphaned)`,
        Message: JSON.stringify({
          event: 'TIER_CLEANUP_FAILED',
          severity: 'MEDIUM',
          tenantId,
          fromTier,
          toTier,
          requestedBy,
          error: errorMessage,
          orphanedResources,
          action: 'Manual cleanup required. The tier transition completed but old resources may still be running and incurring costs.',
          timestamp: new Date().toISOString()
        }, null, 2)
      }));
      alertSent = true;
      logger.info('Alert sent successfully');
    }
  } catch (snsError) {
    logger.error('Failed to send alert:', snsError);
  }

  return {
    status: 'CLEANUP_FAILED_ALERT_SENT',
    alertSent,
    orphanedResources
  };
};
