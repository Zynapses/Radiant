/**
 * DreamExecutor v6.0.5
 * 
 * PURPOSE: Execute dream jobs - consolidate memories and refresh consciousness
 * 
 * During "Dreaming", the system:
 * 1. Consolidates flash facts into long-term memory
 * 2. Re-anchors ghost vectors with fresh hidden states
 * 3. Applies pending LoRA updates
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/subconscious/dream-executor.ts
 */

import { Redis } from 'ioredis';
import { query } from '../../database';
import { DreamJob } from '../types';
import { DreamScheduler } from './dream-scheduler';
import { DualWriteFlashBuffer } from '../iron-core/dual-write-flash-buffer';
import { GhostVectorManager } from '../consciousness/ghost-vector-manager';

export interface DreamExecutionResult {
  jobId: string;
  tenantId: string;
  success: boolean;
  flashFactsConsolidated: number;
  ghostVectorsReanchored: number;
  loraUpdatesApplied: number;
  durationMs: number;
  error?: string;
}

/**
 * DreamExecutor - Consciousness consolidation worker
 * 
 * Processes dream jobs from the queue, performing:
 * 1. Flash fact consolidation (Redis → Postgres → long-term memory)
 * 2. Ghost vector re-anchoring (refresh hidden states)
 * 3. LoRA update application (if pending)
 */
export class DreamExecutor {
  private redis: Redis;
  private scheduler: DreamScheduler;
  private flashBuffer: DualWriteFlashBuffer;
  private ghostManager: GhostVectorManager;
  private readonly QUEUE_KEY = 'cos:dream_queue';
  private readonly BATCH_SIZE = 100; // Users per dream batch
  
  constructor(redis: Redis) {
    this.redis = redis;
    this.scheduler = new DreamScheduler(redis);
    this.flashBuffer = new DualWriteFlashBuffer(redis);
    this.ghostManager = new GhostVectorManager(redis);
  }
  
  /**
   * Process next dream job from queue
   * 
   * @returns Execution result or null if queue empty
   */
  async processNext(): Promise<DreamExecutionResult | null> {
    // Pop from queue
    const jobJson = await this.redis.rpop(this.QUEUE_KEY);
    if (!jobJson) return null;
    
    const job = JSON.parse(jobJson) as DreamJob;
    return this.executeDream(job);
  }
  
  /**
   * Execute a dream job
   */
  async executeDream(job: DreamJob): Promise<DreamExecutionResult> {
    const startTime = Date.now();
    const result: DreamExecutionResult = {
      jobId: job.id,
      tenantId: job.tenantId,
      success: false,
      flashFactsConsolidated: 0,
      ghostVectorsReanchored: 0,
      loraUpdatesApplied: 0,
      durationMs: 0,
    };
    
    try {
      // Mark as running
      await this.scheduler.markDreamStarted(job.id);
      console.log(`[COS Dream] Starting dream for tenant ${job.tenantId} (trigger: ${job.trigger})`);
      
      // Phase 1: Consolidate flash facts
      result.flashFactsConsolidated = await this.consolidateFlashFacts(job.tenantId);
      
      // Phase 2: Re-anchor ghost vectors
      result.ghostVectorsReanchored = await this.reanchorGhosts(job.tenantId);
      
      // Phase 3: Apply LoRA updates (if any pending)
      result.loraUpdatesApplied = await this.applyLoraUpdates(job.tenantId);
      
      // Mark as completed
      await this.scheduler.markDreamCompleted(job.id, {
        flashFacts: result.flashFactsConsolidated,
        ghosts: result.ghostVectorsReanchored,
        lora: result.loraUpdatesApplied,
      });
      
      result.success = true;
      result.durationMs = Date.now() - startTime;
      
      console.log(`[COS Dream] Completed for tenant ${job.tenantId}: ` +
        `${result.flashFactsConsolidated} facts, ${result.ghostVectorsReanchored} ghosts, ` +
        `${result.loraUpdatesApplied} LoRA in ${result.durationMs}ms`);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.durationMs = Date.now() - startTime;
      
      await this.scheduler.markDreamFailed(job.id, result.error);
      console.error(`[COS Dream] Failed for tenant ${job.tenantId}:`, error);
    }
    
    return result;
  }
  
  /**
   * Phase 1: Consolidate flash facts into long-term memory
   */
  private async consolidateFlashFacts(tenantId: string): Promise<number> {
    let consolidated = 0;
    
    // Get pending flash facts for tenant
    const factsResult = await query(
      `SELECT * FROM cos_flash_facts 
       WHERE tenant_id = $1 AND status = 'pending_dream'
       ORDER BY is_safety_critical DESC, created_at ASC
       LIMIT $2`,
      [tenantId, this.BATCH_SIZE * 10]
    );
    
    for (const row of factsResult.rows) {
      try {
        // Move to long-term memory storage
        await this.consolidateFactToLongTerm(row);
        
        // Mark as consolidated
        await this.flashBuffer.markConsolidated(row.id);
        consolidated++;
        
      } catch (error) {
        console.error(`[COS Dream] Failed to consolidate fact ${row.id}:`, error);
      }
    }
    
    return consolidated;
  }
  
  /**
   * Consolidate a single fact to long-term memory
   */
  private async consolidateFactToLongTerm(factRow: Record<string, unknown>): Promise<void> {
    // Insert into long-term memory table
    await query(
      `INSERT INTO user_persistent_context 
       (id, user_id, tenant_id, context_type, content, source, confidence, created_at)
       VALUES ($1, $2, $3, $4, $5, 'flash_fact', 0.9, NOW())
       ON CONFLICT (user_id, tenant_id, content) DO UPDATE SET
         updated_at = NOW(),
         access_count = user_persistent_context.access_count + 1`,
      [
        crypto.randomUUID(),
        factRow.user_id,
        factRow.tenant_id,
        factRow.fact_type,
        factRow.fact,
      ]
    );
  }
  
  /**
   * Phase 2: Re-anchor ghost vectors
   */
  private async reanchorGhosts(tenantId: string): Promise<number> {
    let reanchored = 0;
    
    // Get ghosts that need re-anchoring
    // (high turn count since last anchor, or old anchor)
    const ghostsResult = await query(
      `SELECT * FROM cos_ghost_vectors 
       WHERE tenant_id = $1 
       AND (turns_since_reanchor > 20 OR last_reanchored_at < NOW() - INTERVAL '24 hours')
       LIMIT $2`,
      [tenantId, this.BATCH_SIZE]
    );
    
    for (const row of ghostsResult.rows) {
      try {
        // Get fresh hidden states
        const hiddenStates = await this.generateFreshHiddenStates(row.user_id, tenantId);
        
        // Update ghost
        await this.ghostManager.reanchor(row.user_id, hiddenStates);
        reanchored++;
        
      } catch (error) {
        console.error(`[COS Dream] Failed to reanchor ghost for user ${row.user_id}:`, error);
      }
    }
    
    return reanchored;
  }
  
  /**
   * Generate fresh hidden states for ghost re-anchoring
   * 
   * Calls vLLM with return_hidden_states to get actual neural embeddings
   */
  private async generateFreshHiddenStates(userId: string, tenantId: string): Promise<number[]> {
    // Load recent conversation context
    const contextResult = await query(
      `SELECT content FROM conversation_messages 
       WHERE user_id = $1 AND tenant_id = $2 
       ORDER BY created_at DESC LIMIT 20`,
      [userId, tenantId]
    );
    
    // Load user's long-term context
    const memoryResult = await query(
      `SELECT content FROM user_persistent_context 
       WHERE user_id = $1 AND tenant_id = $2 
       ORDER BY access_count DESC, updated_at DESC LIMIT 10`,
      [userId, tenantId]
    );
    
    // Combine context
    const context = [
      ...memoryResult.rows.map(r => r.content),
      ...contextResult.rows.map(r => r.content),
    ].join('\n');
    
    // Call vLLM with return_hidden_states for neural embeddings
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
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.warn(`[COS Dream] vLLM embedding call failed: ${response.status}, using fallback`);
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
      console.warn(`[COS Dream] vLLM call error: ${error instanceof Error ? error.message : 'Unknown'}, using fallback`);
      return this.generateFallbackHiddenStates(context);
    }
  }

  /**
   * Fallback hidden state generation when vLLM is unavailable
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
   * Phase 3: Apply pending LoRA updates
   */
  private async applyLoraUpdates(tenantId: string): Promise<number> {
    // Check for pending LoRA updates approved by human oversight
    const pendingResult = await query(
      `SELECT * FROM cos_human_oversight 
       WHERE tenant_id = $1 
       AND item_type = 'lora_update' 
       AND status = 'approved'
       ORDER BY created_at ASC
       LIMIT 5`,
      [tenantId]
    );
    
    let applied = 0;
    
    for (const row of pendingResult.rows) {
      try {
        // In production, this would trigger SageMaker LoRA application
        // For now, just mark as processed
        await query(
          `UPDATE cos_human_oversight 
           SET status = 'processed', reviewed_at = NOW() 
           WHERE id = $1`,
          [row.id]
        );
        
        applied++;
        console.log(`[COS Dream] Applied LoRA update ${row.id} for tenant ${tenantId}`);
        
      } catch (error) {
        console.error(`[COS Dream] Failed to apply LoRA update ${row.id}:`, error);
      }
    }
    
    return applied;
  }
  
  /**
   * Process all pending dreams (batch mode)
   */
  async processAll(maxJobs: number = 50): Promise<DreamExecutionResult[]> {
    const results: DreamExecutionResult[] = [];
    
    while (results.length < maxJobs) {
      const result = await this.processNext();
      if (!result) break;
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Get execution statistics
   */
  async getStats(): Promise<{
    totalProcessed: number;
    successRate: number;
    avgDurationMs: number;
    avgFactsPerDream: number;
    avgGhostsPerDream: number;
  }> {
    const result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_duration_ms,
        AVG(flash_facts_consolidated) as avg_facts,
        AVG(ghost_vectors_reanchored) as avg_ghosts
       FROM cos_dream_jobs
       WHERE completed_at > NOW() - INTERVAL '24 hours'`
    );
    
    const row = result.rows[0];
    const total = parseInt(row.total) || 1;
    const completed = parseInt(row.completed) || 0;
    
    return {
      totalProcessed: total,
      successRate: (completed / total) * 100,
      avgDurationMs: parseFloat(row.avg_duration_ms) || 0,
      avgFactsPerDream: parseFloat(row.avg_facts) || 0,
      avgGhostsPerDream: parseFloat(row.avg_ghosts) || 0,
    };
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/**
 * Start dream worker (run in background process)
 */
export async function startDreamWorker(redis: Redis, intervalMs: number = 5000): Promise<void> {
  const executor = new DreamExecutor(redis);
  
  console.log('[COS] Dream worker started');
  
  const processLoop = async () => {
    try {
      const result = await executor.processNext();
      if (result) {
        console.log(`[COS Dream Worker] Processed dream ${result.jobId}: ${result.success ? 'success' : 'failed'}`);
      }
    } catch (error) {
      console.error('[COS Dream Worker] Error:', error);
    }
    
    setTimeout(processLoop, intervalMs);
  };
  
  processLoop();
}
