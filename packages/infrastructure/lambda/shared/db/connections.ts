/**
 * Database Connection Utilities
 * 
 * Provides Redis and DB client connections for Lambda handlers.
 */

import Redis from 'ioredis';
import { executeStatement } from './client';

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

/**
 * Creates a DbClient adapter that wraps the Aurora Data API executeStatement.
 * This allows services using the DbClient interface to work with Aurora PostgreSQL.
 */
export function getDbClient(): DbClient {
  return {
    query: async (sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> => {
      // Convert positional params ($1, $2, etc.) to named params (:p0, :p1, etc.)
      // and create the parameter array in the format executeStatement expects
      const namedParams = params?.map((value, idx) => {
        if (value === null || value === undefined) {
          return { name: `p${idx}`, value: { isNull: true } };
        }
        if (typeof value === 'string') {
          return { name: `p${idx}`, value: { stringValue: value } };
        }
        if (typeof value === 'number') {
          return { name: `p${idx}`, value: Number.isInteger(value) ? { longValue: value } : { doubleValue: value } };
        }
        if (typeof value === 'boolean') {
          return { name: `p${idx}`, value: { booleanValue: value } };
        }
        // For objects/arrays, serialize to JSON
        return { name: `p${idx}`, value: { stringValue: JSON.stringify(value) } };
      });

      // Replace $1, $2, etc. with :p0, :p1, etc. for named parameter binding
      let convertedSql = sql;
      if (params && params.length > 0) {
        for (let i = params.length; i >= 1; i--) {
          convertedSql = convertedSql.replace(new RegExp(`\\$${i}`, 'g'), `:p${i - 1}`);
        }
      }

      const result = await executeStatement(convertedSql, namedParams);
      return { rows: result.rows as Record<string, unknown>[] };
    }
  };
}

export async function closeConnections(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
