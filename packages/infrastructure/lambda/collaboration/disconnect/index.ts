import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({});

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  
  console.log('WebSocket disconnect:', { connectionId });

  try {
    // Find connection to get session info
    const queryResult = await docClient.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      KeyConditionExpression: 'connectionId = :connId',
      ExpressionAttributeValues: {
        ':connId': connectionId,
      },
    }));

    const connection = queryResult.Items?.[0];
    
    if (connection && connection.sessionId !== 'pending') {
      // Delete the connection
      await docClient.send(new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: {
          connectionId,
          sessionId: connection.sessionId,
        },
      }));

      // Broadcast presence update to remaining participants
      await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.BROADCAST_FUNCTION_NAME,
        InvocationType: 'Event',
        Payload: JSON.stringify({
          sessionId: connection.sessionId,
          excludeConnectionId: connectionId,
          message: {
            type: 'presence_update',
            sessionId: connection.sessionId,
            payload: {
              participantId: connection.participantId,
              action: 'left',
            },
            timestamp: Date.now(),
          },
        }),
      }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected' }),
    };
  } catch (error) {
    console.error('Disconnect error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to disconnect' }),
    };
  }
};
