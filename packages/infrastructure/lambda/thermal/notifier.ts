/**
 * Client Notification Lambda
 * 
 * Sends real-time notifications to clients via WebSocket when:
 * - Model warm-up starts
 * - Model becomes ready
 * - Model goes cold/offline
 * - Service state changes
 * - Errors occur
 */

import { 
  ApiGatewayManagementApiClient, 
  PostToConnectionCommand 
} from '@aws-sdk/client-apigatewaymanagementapi';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { executeStatement } from '../shared/db/client';
import { logger } from '../shared/logger';

const sns = new SNSClient({});

export interface ThermalNotification {
  type: 
    | 'thermal_state_change'
    | 'warmup_requested'
    | 'warmup_started'
    | 'warmup_failed'
    | 'model_ready'
    | 'scaled_to_zero'
    | 'service_state_change'
    | 'error';
  appId: string;
  environment: string;
  modelId?: string;
  serviceId?: string;
  targetState?: string;
  state?: string;
  estimatedWaitSeconds?: number;
  estimatedSeconds?: number;
  warmupDurationMs?: number;
  reason?: string;
  error?: string;
  timestamp: string;
}

// ============================================================================
// NOTIFICATION PUBLISHER
// ============================================================================

export async function publishNotification(notification: ThermalNotification): Promise<void> {
  const { appId, environment } = notification;

  try {
    // 1. Publish to SNS for async processing
    const topicArn = process.env.THERMAL_NOTIFICATIONS_TOPIC_ARN;
    if (topicArn) {
      await sns.send(new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(notification),
        MessageAttributes: {
          appId: { DataType: 'String', StringValue: appId },
          environment: { DataType: 'String', StringValue: environment },
          type: { DataType: 'String', StringValue: notification.type },
        },
      }));
    }

    // 2. Send to connected WebSocket clients
    await notifyWebSocketClients(notification);

    // 3. Log the notification
    await logNotification(notification);
  } catch (error) {
    logger.error('Failed to publish notification', error instanceof Error ? error : undefined);
  }
}

// ============================================================================
// WEBSOCKET NOTIFICATIONS
// ============================================================================

async function notifyWebSocketClients(notification: ThermalNotification): Promise<void> {
  const { appId, environment } = notification;

  // Get active WebSocket connections for this app
  const connectionsResult = await executeStatement(`
    SELECT connection_id, api_endpoint
    FROM websocket_connections
    WHERE app_id = $1 
      AND environment = $2 
      AND connected_at > NOW() - INTERVAL '24 hours'
  `, [
    { name: 'appId', value: { stringValue: appId } },
    { name: 'environment', value: { stringValue: environment } },
  ]);

  const message = JSON.stringify({
    event: 'thermal_notification',
    data: notification,
  });

  const disconnectedConnections: string[] = [];

  for (const conn of connectionsResult.rows as { connection_id: string; api_endpoint: string }[]) {
    try {
      const client = new ApiGatewayManagementApiClient({
        endpoint: conn.api_endpoint,
      });

      await client.send(new PostToConnectionCommand({
        ConnectionId: conn.connection_id,
        Data: Buffer.from(message),
      }));
    } catch (error: unknown) {
      const errorWithCode = error as { statusCode?: number };
      if (errorWithCode.statusCode === 410) {
        // Connection is stale, mark for removal
        disconnectedConnections.push(conn.connection_id);
      } else {
        logger.error('Failed to notify connection', error instanceof Error ? error : undefined, { connectionId: conn.connection_id });
      }
    }
  }

  // Clean up stale connections
  if (disconnectedConnections.length > 0) {
    await executeStatement(`
      DELETE FROM websocket_connections
      WHERE connection_id = ANY($1::text[])
    `, [
      { name: 'connectionIds', value: { stringValue: JSON.stringify(disconnectedConnections) } },
    ]);
  }
}

// ============================================================================
// NOTIFICATION LOGGING
// ============================================================================

async function logNotification(notification: ThermalNotification): Promise<void> {
  await executeStatement(`
    INSERT INTO thermal_notifications (
      app_id, environment, type, model_id, service_id, 
      payload, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
  `, [
    { name: 'appId', value: { stringValue: notification.appId } },
    { name: 'environment', value: { stringValue: notification.environment } },
    { name: 'type', value: { stringValue: notification.type } },
    { name: 'modelId', value: notification.modelId ? { stringValue: notification.modelId } : { isNull: true } },
    { name: 'serviceId', value: notification.serviceId ? { stringValue: notification.serviceId } : { isNull: true } },
    { name: 'payload', value: { stringValue: JSON.stringify(notification) } },
  ]);
}

// ============================================================================
// NOTIFICATION HANDLERS
// ============================================================================

export async function handleModelReady(
  appId: string,
  environment: string,
  modelId: string
): Promise<void> {
  await publishNotification({
    type: 'model_ready',
    appId,
    environment,
    modelId,
    timestamp: new Date().toISOString(),
  });
}

export async function handleWarmupStarted(
  appId: string,
  environment: string,
  modelId: string,
  estimatedSeconds: number
): Promise<void> {
  await publishNotification({
    type: 'warmup_started',
    appId,
    environment,
    modelId,
    estimatedSeconds,
    timestamp: new Date().toISOString(),
  });
}

export async function handleServiceStateChange(
  appId: string,
  environment: string,
  serviceId: string,
  newState: string,
  reason?: string
): Promise<void> {
  await publishNotification({
    type: 'service_state_change',
    appId,
    environment,
    serviceId,
    state: newState,
    reason,
    timestamp: new Date().toISOString(),
  });
}

export async function handleError(
  appId: string,
  environment: string,
  modelId: string,
  error: string
): Promise<void> {
  await publishNotification({
    type: 'error',
    appId,
    environment,
    modelId,
    error,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// BATCH NOTIFICATIONS
// ============================================================================

export async function notifyBulkStateChange(
  appId: string,
  environment: string,
  changes: { modelId: string; targetState: string }[]
): Promise<void> {
  for (const change of changes) {
    await publishNotification({
      type: 'thermal_state_change',
      appId,
      environment,
      modelId: change.modelId,
      targetState: change.targetState,
      timestamp: new Date().toISOString(),
    });
  }
}
