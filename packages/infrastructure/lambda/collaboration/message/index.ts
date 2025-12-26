import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({});

// Validate required environment variables at startup
function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

// Optional environment variable with default
function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

const CONNECTIONS_TABLE = getRequiredEnvVar('CONNECTIONS_TABLE');
const WEBSOCKET_URL = getRequiredEnvVar('WEBSOCKET_URL');
const BROADCAST_FUNCTION_NAME = getRequiredEnvVar('BROADCAST_FUNCTION_NAME');
const MESSAGES_TABLE = getOptionalEnvVar('MESSAGES_TABLE', 'collaboration-messages');

// Type definitions for WebSocket payloads
interface JoinSessionPayload {
  participantId: string;
  token: string;
}

interface CursorPayload {
  x: number;
  y: number;
  elementId?: string;
}

interface TypingPayload {
  isTyping: boolean;
}

interface MessagePayload {
  content: string;
  replyTo?: string;
  attachments?: string[];
}

interface EditPayload {
  messageId: string;
  content: string;
}

interface DeletePayload {
  messageId: string;
}

interface ReactPayload {
  messageId: string;
  emoji: string;
}

interface CommentPayload {
  targetId: string;
  content: string;
  position?: { start: number; end: number };
}

interface ResolvePayload {
  commentId: string;
}

interface BroadcastMessage {
  type: string;
  sessionId: string;
  payload?: unknown;
  requestId?: string;
  timestamp: number;
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  
  const apiClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const { type, sessionId, payload, requestId } = body;

    console.log('WebSocket message:', { connectionId, type, sessionId });

    switch (type) {
      case 'join_session':
        return await handleJoinSession(connectionId, sessionId, payload, apiClient);
      
      case 'leave_session':
        return await handleLeaveSession(connectionId, sessionId);
      
      case 'cursor_move':
        return await handleCursorMove(connectionId, sessionId, payload);
      
      case 'typing_start':
      case 'typing_stop':
        return await handleTyping(connectionId, sessionId, type, payload);
      
      case 'message_send':
        return await handleMessageSend(connectionId, sessionId, payload, requestId);
      
      case 'message_edit':
        return await handleMessageEdit(connectionId, sessionId, payload);
      
      case 'message_delete':
        return await handleMessageDelete(connectionId, sessionId, payload);
      
      case 'message_react':
        return await handleMessageReact(connectionId, sessionId, payload);
      
      case 'comment_add':
        return await handleCommentAdd(connectionId, sessionId, payload);
      
      case 'comment_resolve':
        return await handleCommentResolve(connectionId, sessionId, payload);
      
      case 'ping':
        await updateLastPing(connectionId, sessionId);
        await sendToConnection(apiClient, connectionId, { type: 'pong', timestamp: Date.now() });
        return { statusCode: 200, body: 'pong' };
      
      default:
        console.warn('Unknown message type:', type);
        return { statusCode: 400, body: 'Unknown message type' };
    }
  } catch (error) {
    console.error('Message handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function handleJoinSession(
  connectionId: string,
  sessionId: string,
  payload: JoinSessionPayload,
  apiClient: ApiGatewayManagementApiClient
) {
  const { participantId, token } = payload;

  // Update connection with session info
  await docClient.send(new UpdateCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId, sessionId: 'pending' },
    UpdateExpression: 'SET sessionId = :sid, participantId = :pid',
    ExpressionAttributeValues: {
      ':sid': sessionId,
      ':pid': participantId,
    },
  }));

  // Get all participants in session
  const connections = await getSessionConnections(sessionId);
  
  // Send current participants to the joining user
  await sendToConnection(apiClient, connectionId, {
    type: 'session_joined',
    sessionId,
    payload: {
      participants: connections.map(c => ({
        participantId: c.participantId,
        connectionId: c.connectionId,
      })),
    },
    timestamp: Date.now(),
  });

  // Broadcast join to other participants
  await broadcastToSession(sessionId, connectionId, {
    type: 'participant_joined',
    sessionId,
    payload: { participantId },
    timestamp: Date.now(),
  });

  return { statusCode: 200, body: 'Joined session' };
}

async function handleLeaveSession(connectionId: string, sessionId: string) {
  // Connection will be cleaned up on disconnect
  return { statusCode: 200, body: 'Left session' };
}

async function handleCursorMove(connectionId: string, sessionId: string, payload: CursorPayload) {
  await broadcastToSession(sessionId, connectionId, {
    type: 'cursor_move',
    sessionId,
    payload,
    timestamp: Date.now(),
  });
  return { statusCode: 200, body: 'Cursor updated' };
}

async function handleTyping(connectionId: string, sessionId: string, type: string, payload: TypingPayload) {
  await broadcastToSession(sessionId, connectionId, {
    type,
    sessionId,
    payload,
    timestamp: Date.now(),
  });
  return { statusCode: 200, body: 'Typing status updated' };
}

async function handleMessageSend(connectionId: string, sessionId: string, payload: MessagePayload, requestId?: string) {
  const messageId = `msg_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
  const timestamp = Date.now();
  
  // Persist message to DynamoDB
  await docClient.send(new PutCommand({
    TableName: MESSAGES_TABLE,
    Item: {
      sessionId,
      messageId,
      content: payload.content,
      replyTo: payload.replyTo || null,
      attachments: payload.attachments || [],
      senderConnectionId: connectionId,
      status: 'sent',
      createdAt: timestamp,
      updatedAt: timestamp,
      ttl: Math.floor(timestamp / 1000) + (30 * 24 * 60 * 60), // 30 days TTL
    },
  }));
  
  await broadcastToSession(sessionId, null, {
    type: 'message_sent',
    sessionId,
    payload: {
      ...payload,
      id: messageId,
      status: 'sent',
    },
    requestId,
    timestamp,
  });
  
  return { statusCode: 200, body: 'Message sent' };
}

async function handleMessageEdit(connectionId: string, sessionId: string, payload: EditPayload) {
  const timestamp = Date.now();
  
  // Update message in DynamoDB
  await docClient.send(new UpdateCommand({
    TableName: MESSAGES_TABLE,
    Key: { sessionId, messageId: payload.messageId },
    UpdateExpression: 'SET content = :content, updatedAt = :updatedAt, editedBy = :editedBy',
    ExpressionAttributeValues: {
      ':content': payload.content,
      ':updatedAt': timestamp,
      ':editedBy': connectionId,
    },
  }));
  
  await broadcastToSession(sessionId, null, {
    type: 'message_edited',
    sessionId,
    payload,
    timestamp,
  });
  return { statusCode: 200, body: 'Message edited' };
}

async function handleMessageDelete(connectionId: string, sessionId: string, payload: DeletePayload) {
  const timestamp = Date.now();
  
  // Soft delete message in DynamoDB (mark as deleted rather than removing)
  await docClient.send(new UpdateCommand({
    TableName: MESSAGES_TABLE,
    Key: { sessionId, messageId: payload.messageId },
    UpdateExpression: 'SET #status = :status, deletedAt = :deletedAt, deletedBy = :deletedBy',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'deleted',
      ':deletedAt': timestamp,
      ':deletedBy': connectionId,
    },
  }));
  
  await broadcastToSession(sessionId, null, {
    type: 'message_deleted',
    sessionId,
    payload,
    timestamp,
  });
  return { statusCode: 200, body: 'Message deleted' };
}

async function handleMessageReact(connectionId: string, sessionId: string, payload: ReactPayload) {
  await broadcastToSession(sessionId, null, {
    type: 'message_reacted',
    sessionId,
    payload,
    timestamp: Date.now(),
  });
  return { statusCode: 200, body: 'Reaction updated' };
}

async function handleCommentAdd(connectionId: string, sessionId: string, payload: CommentPayload) {
  const commentId = `cmt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
  const timestamp = Date.now();
  
  // Persist comment to DynamoDB
  await docClient.send(new PutCommand({
    TableName: MESSAGES_TABLE,
    Item: {
      sessionId,
      messageId: commentId,
      type: 'comment',
      targetId: payload.targetId,
      content: payload.content,
      position: payload.position || null,
      senderConnectionId: connectionId,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      ttl: Math.floor(timestamp / 1000) + (30 * 24 * 60 * 60), // 30 days TTL
    },
  }));
  
  await broadcastToSession(sessionId, null, {
    type: 'comment_added',
    sessionId,
    payload: { ...payload, id: commentId },
    timestamp,
  });
  return { statusCode: 200, body: 'Comment added' };
}

async function handleCommentResolve(connectionId: string, sessionId: string, payload: ResolvePayload) {
  const timestamp = Date.now();
  
  // Update comment status in DynamoDB
  await docClient.send(new UpdateCommand({
    TableName: MESSAGES_TABLE,
    Key: { sessionId, messageId: payload.commentId },
    UpdateExpression: 'SET #status = :status, resolvedAt = :resolvedAt, resolvedBy = :resolvedBy',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'resolved',
      ':resolvedAt': timestamp,
      ':resolvedBy': connectionId,
    },
  }));
  
  await broadcastToSession(sessionId, null, {
    type: 'comment_resolved',
    sessionId,
    payload,
    timestamp,
  });
  return { statusCode: 200, body: 'Comment resolved' };
}

async function updateLastPing(connectionId: string, sessionId: string) {
  try {
    await docClient.send(new UpdateCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId, sessionId },
      UpdateExpression: 'SET lastPingAt = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
      },
    }));
  } catch (error) {
    console.error('Failed to update last ping:', error);
  }
}

async function getSessionConnections(sessionId: string) {
  const result = await docClient.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: 'sessionId-index',
    KeyConditionExpression: 'sessionId = :sid',
    ExpressionAttributeValues: {
      ':sid': sessionId,
    },
  }));
  return result.Items || [];
}

async function broadcastToSession(sessionId: string, excludeConnectionId: string | null, message: BroadcastMessage) {
  await lambdaClient.send(new InvokeCommand({
    FunctionName: BROADCAST_FUNCTION_NAME,
    InvocationType: 'Event',
    Payload: JSON.stringify({
      sessionId,
      excludeConnectionId,
      message,
    }),
  }));
}

async function sendToConnection(apiClient: ApiGatewayManagementApiClient, connectionId: string, data: Record<string, unknown>) {
  try {
    await apiClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    }));
  } catch (error: unknown) {
    const err = error as { statusCode?: number };
    if (err.statusCode === 410) {
      console.log('Stale connection:', connectionId);
    } else {
      throw error;
    }
  }
}
