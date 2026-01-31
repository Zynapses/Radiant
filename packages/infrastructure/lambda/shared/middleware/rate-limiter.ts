/**
 * Rate Limiter Middleware
 * Applies rate limiting to Lambda handlers with tier-based limits
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({});
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE || 'radiant-rate-limits';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (event: APIGatewayProxyEvent) => string;
  skipPaths?: string[];
  skip?: (event: APIGatewayProxyEvent) => boolean;
}

interface AuthenticatedEvent extends APIGatewayProxyEvent {
  auth?: { tenantId?: string; userId?: string; tier?: string };
}

const TIER_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  free: { requests: 100, windowMs: 60000 },
  starter: { requests: 500, windowMs: 60000 },
  professional: { requests: 2000, windowMs: 60000 },
  business: { requests: 5000, windowMs: 60000 },
  enterprise: { requests: 20000, windowMs: 60000 },
};

// Provider-specific rate limits (requests per minute)
// These are the external API limits we must respect
export const PROVIDER_RATE_LIMITS: Record<string, { rpm: number; tpm?: number; dailyLimit?: number }> = {
  groq: { rpm: 30, tpm: 15000, dailyLimit: 14400 },           // Free tier limits
  anthropic: { rpm: 60, tpm: 100000 },                        // Claude API limits
  openai: { rpm: 60, tpm: 150000 },                           // GPT-4 limits
  perplexity: { rpm: 50 },                                    // Perplexity limits
  together: { rpm: 60, tpm: 100000 },                         // Together AI
  xai: { rpm: 60 },                                           // xAI/Grok limits
  bedrock: { rpm: 1000 },                                     // AWS Bedrock (high limit)
  litellm: { rpm: 500 },                                      // Self-hosted, configurable
};

// Current provider usage tracking (in-memory, per Lambda instance)
const providerUsage = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if a provider call is allowed based on rate limits
 */
export function checkProviderRateLimit(provider: string): { 
  allowed: boolean; 
  remaining: number; 
  resetInMs: number;
  limit: number;
} {
  const limits = PROVIDER_RATE_LIMITS[provider];
  if (!limits) {
    return { allowed: true, remaining: 999, resetInMs: 0, limit: 999 };
  }

  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const key = `provider:${provider}`;
  const usage = providerUsage.get(key);

  if (!usage || usage.resetAt < now) {
    providerUsage.set(key, { count: 1, resetAt: now + windowMs });
    return { 
      allowed: true, 
      remaining: limits.rpm - 1, 
      resetInMs: windowMs,
      limit: limits.rpm
    };
  }

  if (usage.count >= limits.rpm) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetInMs: usage.resetAt - now,
      limit: limits.rpm
    };
  }

  usage.count++;
  return { 
    allowed: true, 
    remaining: limits.rpm - usage.count, 
    resetInMs: usage.resetAt - now,
    limit: limits.rpm
  };
}

/**
 * Get current rate limit status for all providers
 */
export function getProviderRateLimitStatus(): Record<string, {
  limit: number;
  used: number;
  remaining: number;
  resetInMs: number;
}> {
  const now = Date.now();
  const status: Record<string, { limit: number; used: number; remaining: number; resetInMs: number }> = {};

  for (const [provider, limits] of Object.entries(PROVIDER_RATE_LIMITS)) {
    const key = `provider:${provider}`;
    const usage = providerUsage.get(key);
    
    if (!usage || usage.resetAt < now) {
      status[provider] = { limit: limits.rpm, used: 0, remaining: limits.rpm, resetInMs: 0 };
    } else {
      status[provider] = {
        limit: limits.rpm,
        used: usage.count,
        remaining: Math.max(0, limits.rpm - usage.count),
        resetInMs: usage.resetAt - now
      };
    }
  }

  return status;
}

/**
 * In-memory rate limit store for fallback
 */
const memoryStore = new Map<string, { count: number; resetAt: number }>();
const MAX_MEMORY_STORE_SIZE = 10000;

function cleanupMemoryStore(): void {
  const now = Date.now();
  for (const [key, value] of Array.from(memoryStore.entries())) {
    if (value.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Cleanup on each request instead of global interval (Lambda-safe)
 * Only cleanup if store exceeds threshold to avoid overhead
 */
function maybeCleanupMemoryStore(): void {
  if (memoryStore.size > MAX_MEMORY_STORE_SIZE) {
    cleanupMemoryStore();
  }
}

/**
 * Get rate limit key from event
 */
function defaultKeyGenerator(event: APIGatewayProxyEvent): string {
  const authEvent = event as AuthenticatedEvent;
  const tenantId = authEvent.auth?.tenantId;
  
  if (tenantId) {
    return `tenant:${tenantId}`;
  }
  
  const ip = event.requestContext?.identity?.sourceIp || 'unknown';
  return `ip:${ip}`;
}

/**
 * Check rate limit using DynamoDB
 */
async function checkRateLimitDynamoDB(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    const result = await dynamodb.send(new UpdateItemCommand({
      TableName: RATE_LIMIT_TABLE,
      Key: { pk: { S: key } },
      UpdateExpression: `
        SET #count = if_not_exists(#count, :zero) + :inc,
            #resetAt = if_not_exists(#resetAt, :resetAt),
            #ttl = :ttl
      `,
      ConditionExpression: 'attribute_not_exists(#resetAt) OR #resetAt > :windowStart',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#resetAt': 'resetAt',
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':zero': { N: '0' },
        ':inc': { N: '1' },
        ':resetAt': { N: String(now + windowMs) },
        ':windowStart': { N: String(windowStart) },
        ':ttl': { N: String(Math.floor((now + windowMs * 2) / 1000)) },
      },
      ReturnValues: 'ALL_NEW',
    }));

    const count = parseInt(result.Attributes?.count?.N || '1', 10);
    const resetAt = parseInt(result.Attributes?.resetAt?.N || String(now + windowMs), 10);

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt,
    };
  } catch (error) {
    // Reset window if condition failed (window expired)
    if ((error as Error).name === 'ConditionalCheckFailedException') {
      await dynamodb.send(new UpdateItemCommand({
        TableName: RATE_LIMIT_TABLE,
        Key: { pk: { S: key } },
        UpdateExpression: 'SET #count = :one, #resetAt = :resetAt, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#count': 'count',
          '#resetAt': 'resetAt',
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':one': { N: '1' },
          ':resetAt': { N: String(now + windowMs) },
          ':ttl': { N: String(Math.floor((now + windowMs * 2) / 1000)) },
        },
      }));

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
      };
    }

    // Fallback to memory store on DynamoDB error
    return checkRateLimitMemory(key, maxRequests, windowMs);
  }
}

/**
 * Check rate limit using in-memory store (fallback)
 */
function checkRateLimitMemory(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  // Lambda-safe cleanup on each request
  maybeCleanupMemoryStore();
  
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;
  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit middleware
 */
export function rateLimiter(config: Partial<RateLimitConfig> = {}) {
  const {
    keyGenerator = defaultKeyGenerator,
    skipPaths = ['/health', '/metrics', '/v2/health'],
    skip,
  } = config;

  return function <T extends (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>>(
    handler: T
  ): T {
    return (async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
      // Skip rate limiting for certain paths
      if (skipPaths.some(p => event.path?.startsWith(p))) {
        return handler(event, context);
      }

      // Custom skip function
      if (skip && skip(event)) {
        return handler(event, context);
      }

      // Get tier-based limits
      const authEvent = event as AuthenticatedEvent;
      const tier = authEvent.auth?.tier || 'free';
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
      const { requests: maxRequests, windowMs } = config.maxRequests 
        ? { requests: config.maxRequests, windowMs: config.windowMs || 60000 }
        : limits;

      const key = keyGenerator(event);
      const result = RATE_LIMIT_TABLE
        ? await checkRateLimitDynamoDB(key, maxRequests, windowMs)
        : checkRateLimitMemory(key, maxRequests, windowMs);

      // Add rate limit headers
      const addRateLimitHeaders = (response: APIGatewayProxyResult): APIGatewayProxyResult => ({
        ...response,
        headers: {
          ...response.headers,
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      });

      if (!result.allowed) {
        return addRateLimitHeaders({
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please try again later.',
            },
          }),
        });
      }

      const response = await handler(event, context);
      return addRateLimitHeaders(response);
    }) as T;
  };
}

/**
 * Apply rate limiting to a handler
 */
export function withRateLimit<T extends (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>>(
  handler: T,
  config?: Partial<RateLimitConfig>
): T {
  return rateLimiter(config)(handler);
}
