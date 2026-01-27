/**
 * Model Result Cache Service
 * 
 * Provides Redis caching for AI model results with read-after-write consistency.
 * Results are cached immediately after execution, then persisted to PostgreSQL asynchronously.
 * 
 * Pattern:
 * 1. AI models execute in parallel
 * 2. Results immediately cached in Redis (TTL 1 hour)
 * 3. Results queued to SQS for async PostgreSQL write
 * 4. Client reads from Redis first, falls back to PostgreSQL
 */

import { createClient, RedisClientType } from 'redis';
import { SQSClient, SendMessageCommand, SendMessageBatchCommand } from '@aws-sdk/client-sqs';

export interface ModelExecutionResult {
  id: string;
  model_id: string;
  model_provider?: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  response_hash?: string;
  status: 'completed' | 'error';
  error_message?: string;
  response?: string;
  metadata?: Record<string, unknown>;
}

export interface CachedRequestResults {
  request_id: string;
  tenant_id: string;
  user_id?: string;
  orchestration_mode?: string;
  results: ModelExecutionResult[];
  total_latency_ms: number;
  cached_at: string;
}

export class ModelResultCacheService {
  private redis: RedisClientType | null = null;
  private sqs: SQSClient;
  private queueUrl: string;
  private redisEndpoint: string;
  private defaultTtlSeconds: number;

  constructor(config: {
    redisEndpoint: string;
    redisPort?: number;
    sqsQueueUrl: string;
    defaultTtlSeconds?: number;
  }) {
    this.redisEndpoint = config.redisEndpoint;
    this.queueUrl = config.sqsQueueUrl;
    this.defaultTtlSeconds = config.defaultTtlSeconds || 3600; // 1 hour default
    this.sqs = new SQSClient({});
  }

  /**
   * Get or create Redis connection
   */
  private async getRedis(): Promise<RedisClientType> {
    if (this.redis && this.redis.isOpen) {
      return this.redis;
    }

    this.redis = createClient({
      url: `redis://${this.redisEndpoint}:6379`,
      socket: {
        connectTimeout: 5000,
        keepAlive: true,
      },
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    await this.redis.connect();
    return this.redis;
  }

  /**
   * Cache request results in Redis and queue for async PostgreSQL write
   */
  async cacheAndQueueResults(
    tenantId: string,
    requestId: string,
    userId: string | undefined,
    orchestrationMode: string | undefined,
    results: ModelExecutionResult[],
    totalLatencyMs: number
  ): Promise<void> {
    const redis = await this.getRedis();
    const cacheKey = this.getRequestCacheKey(requestId);
    const now = new Date().toISOString();

    // Build cached result object
    const cachedResults: CachedRequestResults = {
      request_id: requestId,
      tenant_id: tenantId,
      user_id: userId,
      orchestration_mode: orchestrationMode,
      results,
      total_latency_ms: totalLatencyMs,
      cached_at: now,
    };

    // Cache in Redis with TTL
    await redis.setEx(cacheKey, this.defaultTtlSeconds, JSON.stringify(cachedResults));

    // Also cache individual model results for quick lookup
    for (const result of results) {
      const modelCacheKey = this.getModelResultCacheKey(requestId, result.model_id);
      await redis.setEx(modelCacheKey, this.defaultTtlSeconds, JSON.stringify(result));
    }

    // Queue async writes to PostgreSQL
    await this.queueAsyncWrites(tenantId, requestId, userId, orchestrationMode, results, now);

    console.log(`Cached ${results.length} results for request ${requestId}`);
  }

  /**
   * Get cached results from Redis
   */
  async getCachedResults(requestId: string): Promise<CachedRequestResults | null> {
    const redis = await this.getRedis();
    const cacheKey = this.getRequestCacheKey(requestId);
    
    const cached = await redis.get(cacheKey);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached as string) as CachedRequestResults;
  }

  /**
   * Get specific model result from cache
   */
  async getCachedModelResult(requestId: string, modelId: string): Promise<ModelExecutionResult | null> {
    const redis = await this.getRedis();
    const cacheKey = this.getModelResultCacheKey(requestId, modelId);
    
    const cached = await redis.get(cacheKey);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached as string) as ModelExecutionResult;
  }

  /**
   * Invalidate cached results
   */
  async invalidateCache(requestId: string): Promise<void> {
    const redis = await this.getRedis();
    
    // Get all keys for this request
    const pattern = `request:${requestId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(keys);
    }

    // Also delete the main result key
    await redis.del(this.getRequestCacheKey(requestId));
  }

  /**
   * Queue async writes to SQS for batch processing
   */
  private async queueAsyncWrites(
    tenantId: string,
    requestId: string,
    userId: string | undefined,
    orchestrationMode: string | undefined,
    results: ModelExecutionResult[],
    timestamp: string
  ): Promise<void> {
    // Queue individual model execution logs
    const modelLogMessages = results.map((result, index) => ({
      Id: `${requestId}-model-${index}`,
      MessageBody: JSON.stringify({
        type: 'model_log',
        id: result.id,
        tenant_id: tenantId,
        request_id: requestId,
        user_id: userId,
        model_id: result.model_id,
        model_provider: result.model_provider,
        prompt_tokens: result.prompt_tokens,
        completion_tokens: result.completion_tokens,
        latency_ms: result.latency_ms,
        response_hash: result.response_hash,
        status: result.status,
        error_message: result.error_message,
        metadata: result.metadata,
        created_at: timestamp,
      }),
    }));

    // Queue usage records for each model
    const usageMessages = results.map((result, index) => ({
      Id: `${requestId}-usage-${index}`,
      MessageBody: JSON.stringify({
        type: 'usage',
        id: `${requestId}-usage-${result.model_id}`,
        tenant_id: tenantId,
        user_id: userId,
        timestamp,
        resource_type: 'tokens',
        resource_id: result.model_id,
        quantity: result.prompt_tokens + result.completion_tokens,
        unit: 'tokens',
        cost_microcents: this.estimateCostMicrocents(result),
        metadata: { model_id: result.model_id },
      }),
    }));

    // Queue prompt result summary
    const promptResultMessage = {
      type: 'prompt_result',
      id: requestId,
      tenant_id: tenantId,
      request_id: requestId,
      user_id: userId,
      orchestration_mode: orchestrationMode,
      models_used: results.map(r => r.model_id),
      total_latency_ms: Math.max(...results.map(r => r.latency_ms)),
      cached: false,
      metadata: {},
      created_at: timestamp,
    };

    // Send in batches (SQS limit is 10 per batch)
    const allMessages = [...modelLogMessages, ...usageMessages];
    
    for (let i = 0; i < allMessages.length; i += 10) {
      const batch = allMessages.slice(i, i + 10);
      await this.sqs.send(new SendMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: batch,
      }));
    }

    // Send prompt result separately
    await this.sqs.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(promptResultMessage),
    }));
  }

  /**
   * Estimate cost in microcents (1/10000 of a cent)
   * This is a simplified estimation - real costs would come from model pricing
   */
  private estimateCostMicrocents(result: ModelExecutionResult): number {
    // Simplified pricing: $0.01 per 1K tokens for input, $0.03 per 1K tokens for output
    const inputCost = (result.prompt_tokens / 1000) * 0.01 * 10000; // Convert to microcents
    const outputCost = (result.completion_tokens / 1000) * 0.03 * 10000;
    return Math.round(inputCost + outputCost);
  }

  /**
   * Cache key helpers
   */
  private getRequestCacheKey(requestId: string): string {
    return `request:${requestId}:results`;
  }

  private getModelResultCacheKey(requestId: string, modelId: string): string {
    return `request:${requestId}:model:${modelId}`;
  }

  /**
   * Get rate limit state from Redis
   */
  async checkRateLimit(
    tenantId: string,
    limitType: 'query' | 'connection' | 'api',
    maxAllowed: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; currentCount: number; resetAt: Date }> {
    const redis = await this.getRedis();
    const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
    const key = `ratelimit:${tenantId}:${limitType}:${windowStart}`;

    // Increment counter
    const count = await redis.incr(key);
    
    // Set expiry on first increment
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    const resetAt = new Date((windowStart + windowSeconds) * 1000);

    return {
      allowed: count <= maxAllowed,
      currentCount: count,
      resetAt,
    };
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
