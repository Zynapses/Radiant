import { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const WEBSOCKET_URL = process.env.WEBSOCKET_URL!;

interface BroadcastEvent {
  sessionId: string;
  excludeConnectionId?: string;
  message: any;
}

export const handler: Handler<BroadcastEvent> = async (event) => {
  const { sessionId, excludeConnectionId, message } = event;
  
  console.log('Broadcasting to session:', { sessionId, messageType: message.type });

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
    console.log(`Found ${connections.length} connections for session ${sessionId}`);

    // Send to all connections (except excluded one)
    const sendPromises = connections
      .filter(conn => conn.connectionId !== excludeConnectionId)
      .map(async (conn) => {
        try {
          await apiClient.send(new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: JSON.stringify(message),
          }));
        } catch (error: any) {
          if (error.statusCode === 410) {
            // Connection is stale, remove it
            console.log('Removing stale connection:', conn.connectionId);
            await docClient.send(new DeleteCommand({
              TableName: CONNECTIONS_TABLE,
              Key: {
                connectionId: conn.connectionId,
                sessionId: conn.sessionId,
              },
            }));
          } else {
            console.error('Failed to send to connection:', conn.connectionId, error);
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
    console.error('Broadcast error:', error);
    throw error;
  }
};
