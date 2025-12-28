import { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { enhancedLogger as logger } from '../../shared/logging/enhanced-logger';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const WEBSOCKET_URL = process.env.WEBSOCKET_URL!;

interface BroadcastMessage {
  type: string;
  sessionId: string;
  payload?: unknown;
  requestId?: string;
  timestamp: number;
}

interface BroadcastEvent {
  sessionId: string;
  excludeConnectionId?: string;
  message: BroadcastMessage;
}

export const handler: Handler<BroadcastEvent> = async (event) => {
  const { sessionId, excludeConnectionId, message } = event;
  
  logger.info('Broadcasting to session', { sessionId, messageType: message.type });

  // Parse WebSocket URL to get endpoint
  const urlParts = WEBSOCKET_URL.replace('wss://', '').split('/');
  const endpoint = `https://${urlParts[0]}/${urlParts[1]}`;
  
  const apiClient = new ApiGatewayManagementApiClient({ endpoint });

  try {
    // Get all connections for this session
    const result = await docClient.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'sessionId-index',
      KeyConditionExpression: 'sessionId = :sid',
      ExpressionAttributeValues: {
        ':sid': sessionId,
      },
    }));

    const connections = result.Items || [];
    logger.debug(`Found ${connections.length} connections for session ${sessionId}`);

    // Send to all connections (except excluded one)
    const sendPromises = connections
      .filter(conn => conn.connectionId !== excludeConnectionId)
      .map(async (conn) => {
        try {
          await apiClient.send(new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: JSON.stringify(message),
          }));
        } catch (error: unknown) {
          const err = error as { statusCode?: number };
          if (err.statusCode === 410) {
            // Connection is stale, remove it
            logger.debug('Removing stale connection', { connectionId: conn.connectionId });
            await docClient.send(new DeleteCommand({
              TableName: CONNECTIONS_TABLE,
              Key: {
                connectionId: conn.connectionId,
                sessionId: conn.sessionId,
              },
            }));
          } else {
            logger.error('Failed to send to connection', error, { connectionId: conn.connectionId });
          }
        }
      });

    await Promise.all(sendPromises);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        sentTo: connections.length - (excludeConnectionId ? 1 : 0),
      }),
    };
  } catch (error) {
    logger.error('Broadcast error', error);
    throw error;
  }
};
