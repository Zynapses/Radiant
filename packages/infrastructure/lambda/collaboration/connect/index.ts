import { APIGatewayProxyWebsocketHandlerV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;

// Extended event type that includes queryStringParameters from $connect route
type WebSocketConnectEvent = APIGatewayProxyWebsocketEventV2 & {
  queryStringParameters?: Record<string, string | undefined>;
};

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectEvent = event as WebSocketConnectEvent;
  const connectionId = event.requestContext.connectionId;
  const queryParams = connectEvent.queryStringParameters || {};
  
  console.log('WebSocket connect:', { connectionId, queryParams });

  try {
    // Store connection with TTL (24 hours)
    const ttl = Math.floor(Date.now() / 1000) + 86400;
    
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        sessionId: queryParams.sessionId || 'pending',
        participantId: queryParams.participantId || 'pending',
        token: queryParams.token,
        connectedAt: new Date().toISOString(),
        lastPingAt: new Date().toISOString(),
        ttl,
      },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connected' }),
    };
  } catch (error) {
    console.error('Connect error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to connect' }),
    };
  }
};
