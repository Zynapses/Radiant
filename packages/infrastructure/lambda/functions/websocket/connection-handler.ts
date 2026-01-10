/**
 * WebSocket Connection Handler Lambda
 * 
 * Handles WebSocket lifecycle events:
 * - $connect: Store connection in Redis
 * - $disconnect: Remove connection from Redis
 * - $default: Handle messages (ping/pong, subscriptions)
 * - Scheduled: Cleanup stale connections
 */

import {
  APIGatewayProxyHandler,
  APIGatewayProxyWebsocketHandlerV2,
} from 'aws-lambda';
import { Redis } from 'ioredis';
import { logger } from '../../shared/logging/enhanced-logger';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  DeleteConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';

// ============================================================================
// TYPES
// ============================================================================

interface ConnectionInfo {
  connectionId: string;
  tenantId: string;
  userId: string;
  connectedAt: string;
  lastHeartbeat: string;
  subscribedDomains: string[];
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT!, 10),
    });
  }
  return redis;
}

function getApiClient(endpoint: string): ApiGatewayManagementApiClient {
  return new ApiGatewayManagementApiClient({
    endpoint: endpoint.replace('wss://', 'https://'),
  });
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

async function storeConnection(
  connectionId: string,
  tenantId: string,
  userId: string,
  endpoint: string
): Promise<void> {
  const redisClient = getRedis();
  const now = new Date().toISOString();

  const connectionInfo: ConnectionInfo = {
    connectionId,
    tenantId,
    userId,
    connectedAt: now,
    lastHeartbeat: now,
    subscribedDomains: [],
  };

  await redisClient.hset(
    `ws:connections:${tenantId}`,
    connectionId,
    JSON.stringify(connectionInfo)
  );

  await redisClient.sadd('ws:all_connections', `${tenantId}:${connectionId}`);

  await redisClient.hset(
    `ws:connection_endpoints`,
    connectionId,
    endpoint
  );

  logger.info(`Connection stored: ${connectionId} for tenant ${tenantId}`);
}

async function removeConnection(
  connectionId: string,
  tenantId?: string
): Promise<void> {
  const redisClient = getRedis();

  if (!tenantId) {
    const allConnections = await redisClient.smembers('ws:all_connections');
    for (const entry of allConnections) {
      if (entry.endsWith(`:${connectionId}`)) {
        tenantId = entry.split(':')[0];
        break;
      }
    }
  }

  if (tenantId) {
    await redisClient.hdel(`ws:connections:${tenantId}`, connectionId);
    await redisClient.srem('ws:all_connections', `${tenantId}:${connectionId}`);
  }

  await redisClient.hdel('ws:connection_endpoints', connectionId);

  logger.info(`Connection removed: ${connectionId}`);
}

async function updateHeartbeat(
  connectionId: string,
  tenantId: string
): Promise<void> {
  const redisClient = getRedis();
  const connectionJson = await redisClient.hget(`ws:connections:${tenantId}`, connectionId);

  if (connectionJson) {
    const connection: ConnectionInfo = JSON.parse(connectionJson);
    connection.lastHeartbeat = new Date().toISOString();
    await redisClient.hset(
      `ws:connections:${tenantId}`,
      connectionId,
      JSON.stringify(connection)
    );
  }
}

async function updateSubscriptions(
  connectionId: string,
  tenantId: string,
  domains: string[]
): Promise<void> {
  const redisClient = getRedis();
  const connectionJson = await redisClient.hget(`ws:connections:${tenantId}`, connectionId);

  if (connectionJson) {
    const connection: ConnectionInfo = JSON.parse(connectionJson);
    connection.subscribedDomains = domains;
    await redisClient.hset(
      `ws:connections:${tenantId}`,
      connectionId,
      JSON.stringify(connection)
    );
  }
}

async function cleanupStaleConnections(): Promise<{
  checked: number;
  removed: number;
}> {
  const redisClient = getRedis();
  const staleThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes

  const allConnections = await redisClient.smembers('ws:all_connections');
  let checked = 0;
  let removed = 0;

  for (const entry of allConnections) {
    const [tenantId, connectionId] = entry.split(':');
    checked++;

    const connectionJson = await redisClient.hget(`ws:connections:${tenantId}`, connectionId);
    if (!connectionJson) {
      await redisClient.srem('ws:all_connections', entry);
      removed++;
      continue;
    }

    const connection: ConnectionInfo = JSON.parse(connectionJson);
    const lastHeartbeat = new Date(connection.lastHeartbeat).getTime();

    if (lastHeartbeat < staleThreshold) {
      const endpoint = await redisClient.hget('ws:connection_endpoints', connectionId);
      
      if (endpoint) {
        try {
          const apiClient = getApiClient(endpoint);
          await apiClient.send(new DeleteConnectionCommand({
            ConnectionId: connectionId,
          }));
        } catch (error) {
          // Connection already gone
        }
      }

      await removeConnection(connectionId, tenantId);
      removed++;
    }
  }

  logger.info(`Stale connection cleanup: checked=${checked}, removed=${removed}`);
  return { checked, removed };
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

async function handleMessage(
  connectionId: string,
  tenantId: string,
  message: Record<string, unknown>,
  endpoint: string
): Promise<void> {
  const action = message.action as string;

  switch (action) {
    case 'ping':
      await updateHeartbeat(connectionId, tenantId);
      const apiClient = getApiClient(endpoint);
      await apiClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify({ type: 'pong', timestamp: Date.now() })),
      }));
      break;

    case 'subscribe':
      const domains = (message.domains as string[]) || [];
      await updateSubscriptions(connectionId, tenantId, domains);
      break;

    case 'unsubscribe':
      await updateSubscriptions(connectionId, tenantId, []);
      break;

    default:
      logger.info(`Unknown action: ${action}`);
  }
}

// ============================================================================
// LAMBDA HANDLERS
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId!;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const endpoint = `https://${domainName}/${stage}`;

  logger.info(`WebSocket event: ${routeKey}, connectionId: ${connectionId}`);

  try {
    if (routeKey === '$connect') {
      const tenantId = event.queryStringParameters?.tenantId;
      const userId = event.queryStringParameters?.userId;

      if (!tenantId) {
        return {
          statusCode: 401,
          body: 'Missing tenantId',
        };
      }

      await storeConnection(connectionId, tenantId, userId || 'anonymous', endpoint);

      return {
        statusCode: 200,
        body: 'Connected',
      };
    }

    if (routeKey === '$disconnect') {
      await removeConnection(connectionId);

      return {
        statusCode: 200,
        body: 'Disconnected',
      };
    }

    if (routeKey === '$default') {
      let tenantId = '';
      const redisClient = getRedis();
      const allConnections = await redisClient.smembers('ws:all_connections');
      
      for (const entry of allConnections) {
        if (entry.endsWith(`:${connectionId}`)) {
          tenantId = entry.split(':')[0];
          break;
        }
      }

      if (!tenantId) {
        return {
          statusCode: 400,
          body: 'Connection not found',
        };
      }

      let message: Record<string, unknown> = {};
      if (event.body) {
        try {
          message = JSON.parse(event.body);
        } catch {
          message = {};
        }
      }

      await handleMessage(connectionId, tenantId, message, endpoint);

      return {
        statusCode: 200,
        body: 'OK',
      };
    }

    return {
      statusCode: 400,
      body: 'Unknown route',
    };
  } catch (error) {
    logger.error('WebSocket handler error:', error);
    return {
      statusCode: 500,
      body: 'Internal error',
    };
  }
};

export const scheduledHandler = async (event: { action?: string }): Promise<void> => {
  if (event.action === 'cleanup_stale') {
    const result = await cleanupStaleConnections();
    logger.info('Scheduled cleanup completed', { result });
  }
};
