/**
 * Database Connection Utilities
 * 
 * Provides Redis and DB client connections for Lambda handlers.
 */

import Redis from 'ioredis';

export interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379');
    redisClient = new Redis({ host, port, lazyConnect: true });
  }
  return redisClient;
}

export async function getDbClient(): Promise<DbClient> {
  // Returns a database client for direct connections
  // In production, this would use pg Pool
  return {
    query: async (sql: string, params?: unknown[]) => {
      // Placeholder - in production would connect to PostgreSQL
      return { rows: [] };
    }
  };
}

export async function closeConnections(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
