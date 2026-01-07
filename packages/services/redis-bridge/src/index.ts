/**
 * Redis Bridge Service
 * 
 * Long-running ECS Fargate service that:
 * - Subscribes to Redis pub/sub channels for decision events
 * - Broadcasts messages to WebSocket connections via API Gateway
 * - Provides health check endpoint
 */

import express, { Request, Response } from 'express';
import { Redis } from 'ioredis';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';

// ============================================================================
// CONFIGURATION
// ============================================================================

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const PORT = parseInt(process.env.PORT || '3000', 10);

const CHANNELS = [
  'decision_pending:*',
  'decision_resolved:*',
  'decision_expired:*',
  'decision_escalated:*',
  'swarm_event:*',
];

// ============================================================================
// REDIS CLIENTS
// ============================================================================

const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

const redisSubscriber = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// ============================================================================
// API GATEWAY CLIENT
// ============================================================================

function getApiClient(): ApiGatewayManagementApiClient {
  const endpoint = WEBSOCKET_API_ENDPOINT.replace('wss://', 'https://');
  return new ApiGatewayManagementApiClient({
    region: AWS_REGION,
    endpoint,
  });
}

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

interface BroadcastMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// BROADCAST FUNCTIONS
// ============================================================================

async function broadcastToTenant(
  tenantId: string,
  message: BroadcastMessage
): Promise<{ sent: number; failed: number }> {
  const api = getApiClient();
  let sent = 0;
  let failed = 0;

  const connections = await redisClient.hgetall(`ws:connections:${tenantId}`);
  const messageBuffer = Buffer.from(JSON.stringify(message));

  for (const [connectionId, connectionJson] of Object.entries(connections)) {
    try {
      const connection: ConnectionInfo = JSON.parse(connectionJson);

      if (
        message.data.domain &&
        connection.subscribedDomains.length > 0 &&
        !connection.subscribedDomains.includes(message.data.domain as string)
      ) {
        continue;
      }

      await api.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: messageBuffer,
        })
      );

      sent++;
    } catch (error: any) {
      if (error.statusCode === 410) {
        console.log(`Removing stale connection: ${connectionId}`);
        await redisClient.hdel(`ws:connections:${tenantId}`, connectionId);
        await redisClient.srem('ws:all_connections', `${tenantId}:${connectionId}`);
      } else {
        console.error(`Failed to send to ${connectionId}:`, error.message);
      }
      failed++;
    }
  }

  return { sent, failed };
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

function parseChannelAndTenant(channel: string): { eventType: string; tenantId: string } | null {
  const parts = channel.split(':');
  if (parts.length !== 2) return null;

  return {
    eventType: parts[0],
    tenantId: parts[1],
  };
}

async function handleRedisMessage(channel: string, message: string): Promise<void> {
  const parsed = parseChannelAndTenant(channel);
  if (!parsed) {
    console.warn(`Invalid channel format: ${channel}`);
    return;
  }

  const { eventType, tenantId } = parsed;

  try {
    const data = JSON.parse(message);

    const broadcastMessage: BroadcastMessage = {
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
    };

    const result = await broadcastToTenant(tenantId, broadcastMessage);

    console.log(`Broadcast ${eventType} to ${tenantId}: sent=${result.sent}, failed=${result.failed}`);
  } catch (error) {
    console.error(`Failed to handle message on ${channel}:`, error);
  }
}

// ============================================================================
// EXPRESS SERVER
// ============================================================================

const app = express();

app.get('/health', async (req: Request, res: Response) => {
  try {
    await redisClient.ping();
    await redisSubscriber.ping();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: {
        client: 'connected',
        subscriber: 'connected',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

app.get('/stats', async (req: Request, res: Response) => {
  try {
    const allConnections = await redisClient.smembers('ws:all_connections');

    const byTenant: Record<string, number> = {};
    for (const entry of allConnections) {
      const tenantId = entry.split(':')[0];
      byTenant[tenantId] = (byTenant[tenantId] || 0) + 1;
    }

    res.json({
      totalConnections: allConnections.length,
      byTenant,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown' });
  }
});

app.get('/ready', async (req: Request, res: Response) => {
  res.json({ ready: true });
});

// ============================================================================
// STARTUP
// ============================================================================

async function start(): Promise<void> {
  console.log('Starting Redis Bridge Service...');
  console.log(`Redis: ${REDIS_HOST}:${REDIS_PORT}`);
  console.log(`WebSocket API: ${WEBSOCKET_API_ENDPOINT}`);

  for (const pattern of CHANNELS) {
    await redisSubscriber.psubscribe(pattern);
    console.log(`Subscribed to: ${pattern}`);
  }

  redisSubscriber.on('pmessage', async (pattern, channel, message) => {
    await handleRedisMessage(channel, message);
  });

  redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
  });

  redisSubscriber.on('error', (err) => {
    console.error('Redis subscriber error:', err);
  });

  app.listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
  });
}

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');

  await redisSubscriber.punsubscribe();
  await redisSubscriber.quit();
  await redisClient.quit();

  process.exit(0);
});

start().catch((error) => {
  console.error('Failed to start Redis Bridge Service:', error);
  process.exit(1);
});
