/**
 * AsyncGhostReAnchorer v6.0.5
 * 
 * PURPOSE: Async re-anchor to avoid latency spikes in user-facing requests
 * 
 * PROBLEM (v6.0.2):
 *   - Re-anchoring requires 70B model inference (~1.8s)
 *   - Running inline causes latency spike
 *   - User experiences slow response every 15 turns
 * 
 * SOLUTION (Gemini):
 *   - Queue re-anchor jobs to Redis
 *   - Background worker processes queue
 *   - Fire-and-forget from main request path
 *   - Target: <100ms to queue, <5s to complete async
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/consciousness/async-ghost-re-anchorer.ts
 */

import { Redis } from 'ioredis';
import { query } from '../../database';
import { GhostVectorManager } from './ghost-vector-manager';
import { ReanchorJob, REANCHOR_CONFIG } from '../types';

export interface ReanchorQueueStats {
  pending: number;
  processing: number;
  completedToday: number;
  failedToday: number;
  avgProcessingTimeMs: number;
}

/**
 * AsyncGhostReAnchorer - Background ghost vector refresh
 * 
 * Handles the async portion of ghost re-anchoring:
 * 1. Receives jobs from Redis queue
 * 2. Calls 70B model for fresh hidden states
 * 3. Updates ghost vector
 * 4. Logs metrics
 */
export class AsyncGhostReAnchorer {
  private redis: Redis;
  private ghostManager: GhostVectorManager;
  private readonly QUEUE_KEY = 'cos:reanchor_queue';
  private readonly PROCESSING_KEY = 'cos:reanchor_processing';
  private readonly STATS_KEY = 'cos:reanchor_stats';
  private readonly MAX_RETRIES = 3;
  private readonly PROCESSING_TIMEOUT_MS = 30000; // 30 seconds
  
  constructor(redis: Redis) {
    this.redis = redis;
    this.ghostManager = new GhostVectorManager(redis);
  }
  
  /**
   * Queue a re-anchor job (called from main request path)
   * 
   * MUST complete in <100ms to avoid latency impact
   */
  async queueReanchor(params: {
    ghostId: string;
    userId: string;
    tenantId: string;
    priority?: 'normal' | 'high';
  }): Promise<string> {
    const job: ReanchorJob = {
      ...params,
      scheduledAt: new Date(),
      priority: params.priority || 'normal',
    };
    
    // Use LPUSH for normal, RPUSH for high priority (processed first with RPOP)
    if (job.priority === 'high') {
      await this.redis.rpush(this.QUEUE_KEY, JSON.stringify(job));
    } else {
      await this.redis.lpush(this.QUEUE_KEY, JSON.stringify(job));
    }
    
    console.log(`[COS] Re-anchor queued: ${params.ghostId} (priority: ${job.priority})`);
    return params.ghostId;
  }
  
  /**
   * Process next job from queue (called by background worker)
   * 
   * @returns true if a job was processed, false if queue empty
   */
  async processNext(): Promise<boolean> {
    // Pop from queue
    const jobJson = await this.redis.rpop(this.QUEUE_KEY);
    if (!jobJson) return false;
    
    const job = JSON.parse(jobJson) as ReanchorJob;
    const startTime = Date.now();
    
    // Mark as processing (with timeout for stale detection)
    await this.redis.setex(
      `${this.PROCESSING_KEY}:${job.ghostId}`,
      this.PROCESSING_TIMEOUT_MS / 1000,
      JSON.stringify({ ...job, startedAt: new Date() })
    );
    
    try {
      // Get fresh hidden states from 70B model
      // In production, this would call the actual model
      const hiddenStates = await this.getHiddenStatesFrom70B(job);
      
      // Update ghost with new anchor
      await this.ghostManager.reanchor(job.userId, hiddenStates);
      
      // Log success metrics
      const processingTimeMs = Date.now() - startTime;
      await this.logMetrics('completed', processingTimeMs);
      
      console.log(`[COS] Re-anchor completed: ${job.ghostId} in ${processingTimeMs}ms`);
      return true;
      
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      await this.logMetrics('failed', processingTimeMs);
      
      console.error(`[COS] Re-anchor failed: ${job.ghostId}`, error);
      
      // Implement retry logic with exponential backoff
      const retryCount = (job as ReanchorJob & { retryCount?: number }).retryCount || 0;
      if (retryCount < this.MAX_RETRIES) {
        const backoffMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`[COS] Scheduling retry ${retryCount + 1}/${this.MAX_RETRIES} for ${job.ghostId} in ${backoffMs}ms`);
        
        // Schedule retry with backoff
        setTimeout(async () => {
          await this.queueReanchor({
            ...job,
            priority: 'high',
          });
          // Store retry count in Redis for tracking
          await this.redis.set(
            `${this.PROCESSING_KEY}:retry:${job.ghostId}`,
            String(retryCount + 1),
            'EX',
            3600 // 1 hour TTL
          );
        }, backoffMs);
      } else {
        console.error(`[COS] Re-anchor exhausted retries for ${job.ghostId}`);
        // Log permanent failure for alerting
        await query(
          `INSERT INTO cos_reanchor_failures (ghost_id, user_id, tenant_id, error, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [job.ghostId, job.userId, job.tenantId, error instanceof Error ? error.message : 'Unknown']
        ).catch(() => {});
      }
      return true;
      
    } finally {
      // Clear processing marker
      await this.redis.del(`${this.PROCESSING_KEY}:${job.ghostId}`);
    }
  }
  
  /**
   * Process all pending jobs (batch mode)
   */
  async processAll(maxJobs: number = 100): Promise<number> {
    let processed = 0;
    
    while (processed < maxJobs) {
      const hasMore = await this.processNext();
      if (!hasMore) break;
      processed++;
    }
    
    return processed;
  }
  
  /**
   * Get queue statistics
   */
  async getStats(): Promise<ReanchorQueueStats> {
    const pending = await this.redis.llen(this.QUEUE_KEY);
    const processingKeys = await this.redis.keys(`${this.PROCESSING_KEY}:*`);
    
    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const statsJson = await this.redis.get(`${this.STATS_KEY}:${today}`);
    const stats = statsJson ? JSON.parse(statsJson) : { completed: 0, failed: 0, totalTimeMs: 0 };
    
    return {
      pending,
      processing: processingKeys.length,
      completedToday: stats.completed,
      failedToday: stats.failed,
      avgProcessingTimeMs: stats.completed > 0 ? stats.totalTimeMs / stats.completed : 0,
    };
  }
  
  /**
   * Recover stale processing jobs
   * 
   * Jobs that exceeded timeout are likely stuck - requeue them
   */
  async recoverStaleJobs(): Promise<number> {
    const processingKeys = await this.redis.keys(`${this.PROCESSING_KEY}:*`);
    let recovered = 0;
    
    for (const key of processingKeys) {
      const ttl = await this.redis.ttl(key);
      
      // If TTL is -2 (expired) or -1 (no expiry set), job is stale
      if (ttl < 0) {
        const jobJson = await this.redis.get(key);
        if (jobJson) {
          const job = JSON.parse(jobJson) as ReanchorJob;
          
          // Requeue with high priority
          await this.queueReanchor({
            ...job,
            priority: 'high',
          });
          
          recovered++;
        }
        
        await this.redis.del(key);
      }
    }
    
    if (recovered > 0) {
      console.log(`[COS] Recovered ${recovered} stale re-anchor jobs`);
    }
    
    return recovered;
  }
  
  /**
   * Clear all pending jobs (admin operation)
   */
  async clearQueue(): Promise<number> {
    const count = await this.redis.llen(this.QUEUE_KEY);
    await this.redis.del(this.QUEUE_KEY);
    return count;
  }
  
  /**
   * Get hidden states from 70B model
   * 
   * Calls vLLM embedding endpoint to get neural embeddings
   * Falls back to deterministic hash-based generation if unavailable
   */
  private async getHiddenStatesFrom70B(job: ReanchorJob): Promise<number[]> {
    // Load conversation context
    const contextResult = await query(
      `SELECT content FROM conversation_messages 
       WHERE user_id = $1 AND tenant_id = $2 
       ORDER BY created_at DESC LIMIT 10`,
      [job.userId, job.tenantId]
    );
    
    const context = contextResult.rows.map(r => r.content).join('\n');
    
    // Call vLLM embedding endpoint for neural embeddings
    const vllmUrl = process.env.VLLM_INFERENCE_URL || process.env.LITELLM_PROXY_URL || 'http://localhost:8000';
    const vllmModel = process.env.VLLM_GHOST_MODEL || 'meta-llama/Llama-3-70b-chat-hf';
    
    try {
      const response = await fetch(`${vllmUrl}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VLLM_API_KEY || process.env.LITELLM_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: vllmModel,
          input: context.substring(0, 8000),
          encoding_format: 'float',
        }),
        signal: AbortSignal.timeout(25000), // 25s timeout (within 30s processing limit)
      });

      if (!response.ok) {
        console.warn(`[COS] vLLM embedding call failed: ${response.status}, using fallback`);
        return this.generateFallbackHiddenStates(context);
      }

      const data = await response.json() as { data?: Array<{ embedding: number[] }> };
      const embedding = data.data?.[0]?.embedding;
      
      if (embedding && embedding.length > 0) {
        // Pad or truncate to 4096 dimensions
        const hiddenStates = new Array(4096).fill(0);
        for (let i = 0; i < Math.min(embedding.length, 4096); i++) {
          hiddenStates[i] = embedding[i];
        }
        return hiddenStates;
      }
      
      return this.generateFallbackHiddenStates(context);
    } catch (error) {
      console.warn(`[COS] vLLM call error: ${error instanceof Error ? error.message : 'Unknown'}, using fallback`);
      return this.generateFallbackHiddenStates(context);
    }
  }

  /**
   * Fallback hidden state generation when vLLM is unavailable
   * Generates deterministic values based on context hash
   */
  private generateFallbackHiddenStates(context: string): number[] {
    const contextHash = this.hashString(context);
    const hiddenStates: number[] = [];
    
    for (let i = 0; i < 4096; i++) {
      const seed = (contextHash + i * 31) % 1000000;
      hiddenStates.push((Math.sin(seed) + 1) / 2);
    }
    
    return hiddenStates;
  }
  
  /**
   * Log metrics for monitoring
   */
  private async logMetrics(outcome: 'completed' | 'failed', processingTimeMs: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `${this.STATS_KEY}:${today}`;
    
    // Atomic increment
    await this.redis.hincrby(statsKey, outcome, 1);
    await this.redis.hincrbyfloat(statsKey, 'totalTimeMs', processingTimeMs);
    
    // Set expiry (keep stats for 7 days)
    await this.redis.expire(statsKey, 7 * 24 * 60 * 60);
    
    // Log to database for long-term analytics
    await query(
      `INSERT INTO cos_reanchor_metrics (outcome, processing_time_ms, created_at)
       VALUES ($1, $2, NOW())`,
      [outcome, processingTimeMs]
    ).catch(err => console.error('[COS] Failed to log reanchor metrics:', err));
  }
  
  /**
   * Simple string hash for deterministic pseudo-random generation
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Background worker function
 * 
 * Run this in a separate process/Lambda:
 * ```
 * const worker = new AsyncGhostReAnchorer(redis);
 * setInterval(() => worker.processNext(), 1000);
 * ```
 */
export async function startReanchorWorker(redis: Redis, intervalMs: number = 1000): Promise<void> {
  const worker = new AsyncGhostReAnchorer(redis);
  
  console.log('[COS] Re-anchor worker started');
  
  // Process jobs continuously
  const processLoop = async () => {
    try {
      // Recover any stale jobs first
      await worker.recoverStaleJobs();
      
      // Process pending jobs
      await worker.processAll(10);
      
    } catch (error) {
      console.error('[COS] Re-anchor worker error:', error);
    }
    
    // Schedule next iteration
    setTimeout(processLoop, intervalMs);
  };
  
  processLoop();
}
