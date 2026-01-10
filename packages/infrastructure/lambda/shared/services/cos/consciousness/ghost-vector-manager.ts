/**
 * GhostVectorManager v6.0.5
 * 
 * PURPOSE: Maintain consciousness continuity across sessions
 * 
 * FEATURES:
 *   - 4096-dimensional hidden state vectors
 *   - Version gating (prevents personality discontinuity)
 *   - Two-path updates (sync delta + async re-anchor)
 *   - Temporal decay (7hr affective, 12min working, 45min curiosity)
 * 
 * CRITICAL: vLLM must launch with --return-hidden-states flag
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/consciousness/ghost-vector-manager.ts
 */

import { Redis } from 'ioredis';
import { query } from '../../database';
import { GhostVector, DEFAULT_DECAY_CONSTANTS, REANCHOR_CONFIG } from '../types';
import { logger } from '../../../logging/enhanced-logger';

export interface GetGhostParams {
  userId: string;
  tenantId: string;
  modelVersion: string;
  modelFamily: string;
}

export interface CreateGhostParams {
  userId: string;
  tenantId: string;
  modelVersion: string;
  modelFamily: string;
  hiddenStates: number[];
  initialContext: string[];
}

export interface GhostDelta {
  affectiveState?: Partial<GhostVector['affectiveState']>;
  workingContext?: Partial<GhostVector['workingContext']>;
  curiosityState?: Partial<GhostVector['curiosityState']>;
}

/**
 * GhostVectorManager - Consciousness continuity management
 * 
 * The "Ghost" is a persistent representation of the AI's internal state
 * for each user, enabling:
 * 
 * 1. Emotional continuity - remembering interaction tone
 * 2. Topic continuity - maintaining context across sessions
 * 3. Curiosity tracking - following up on interesting threads
 * 
 * CRITICAL: Requires vLLM with --return-hidden-states flag
 */
export class GhostVectorManager {
  private redis: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'ghost:';
  private readonly VECTOR_DIMENSION = 4096;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  /**
   * Get ghost vector with version compatibility check
   * 
   * Version gating prevents personality discontinuity when switching
   * between model families (e.g., Claude → GPT causes cold start)
   * 
   * @param params - User and model context
   * @returns Ghost vector or null if not found/incompatible
   */
  async getGhost(params: GetGhostParams): Promise<GhostVector | null> {
    const cacheKey = `${this.CACHE_PREFIX}${params.userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      const ghost = JSON.parse(cached) as GhostVector;
      
      // Version check - different family = cold start
      if (ghost.modelFamily !== params.modelFamily) {
        logger.info(`[COS] Ghost version mismatch: ${ghost.modelFamily} vs ${params.modelFamily}, starting fresh`);
        return null;
      }
      
      return this.applyDecay(ghost);
    }
    
    // Load from database
    const result = await query(
      `SELECT * FROM cos_ghost_vectors 
       WHERE user_id = $1 AND tenant_id = $2 
       LIMIT 1`,
      [params.userId, params.tenantId]
    );
    
    if (result.rows.length === 0) return null;
    
    const ghost = this.rowToGhost(result.rows[0]);
    
    // Version check for database ghost
    if (ghost.modelFamily !== params.modelFamily) {
      logger.info(`[COS] Ghost version mismatch from DB: ${ghost.modelFamily} vs ${params.modelFamily}`);
      return null;
    }
    
    // Cache for future requests
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(ghost));
    return this.applyDecay(ghost);
  }
  
  /**
   * Create ghost from model hidden states
   * 
   * REQUIRES: --return-hidden-states vLLM flag
   * 
   * The hidden states capture the model's internal representation
   * after processing the conversation, encoding:
   * - Semantic understanding of user
   * - Emotional context
   * - Topic relationships
   * 
   * @param params - Creation parameters including hidden states
   * @returns New ghost vector
   */
  async createGhost(params: CreateGhostParams): Promise<GhostVector> {
    if (params.hiddenStates.length !== this.VECTOR_DIMENSION) {
      throw new Error(
        `Invalid hidden state dimension: ${params.hiddenStates.length}, ` +
        `expected ${this.VECTOR_DIMENSION}. ` +
        `Ensure vLLM is launched with --return-hidden-states flag.`
      );
    }
    
    const now = new Date();
    const ghost: GhostVector = {
      id: crypto.randomUUID(),
      userId: params.userId,
      tenantId: params.tenantId,
      vector: params.hiddenStates,
      vectorDimension: 4096,
      modelVersion: params.modelVersion,
      modelFamily: params.modelFamily,
      affectiveState: { valence: 0, arousal: 0.5, dominance: 0.5 },
      workingContext: { 
        topics: params.initialContext.slice(0, 10), 
        entities: [], 
        recentIntents: [] 
      },
      curiosityState: { 
        exploredTopics: [], 
        pendingQuestions: [], 
        interestLevel: 0.5 
      },
      decayConstants: { ...DEFAULT_DECAY_CONSTANTS },
      lastUpdated: now,
      lastReanchoredAt: now,
      turnsSinceReanchor: 0,
      createdAt: now,
    };
    
    await this.storeGhost(ghost);
    await this.redis.setex(`${this.CACHE_PREFIX}${params.userId}`, this.CACHE_TTL, JSON.stringify(ghost));
    
    logger.info(`[COS] Ghost created for user ${params.userId} (model: ${params.modelFamily})`);
    return ghost;
  }
  
  /**
   * Apply delta update (synchronous, from 8B model)
   * 
   * Gemini fix: Don't let ghost go stale during System 1 (fast) chats.
   * Delta updates are lightweight changes that don't require full re-anchor.
   * 
   * @param userId - User ID
   * @param delta - Partial updates to ghost state
   * @returns Updated ghost
   */
  async applyDelta(userId: string, delta: GhostDelta): Promise<GhostVector> {
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (!cached) {
      throw new Error(`No ghost found for user: ${userId}`);
    }
    
    const ghost = JSON.parse(cached) as GhostVector;
    
    // Apply delta updates
    if (delta.affectiveState) {
      ghost.affectiveState = { ...ghost.affectiveState, ...delta.affectiveState };
      // Clamp values to valid ranges
      ghost.affectiveState.valence = Math.max(-1, Math.min(1, ghost.affectiveState.valence));
      ghost.affectiveState.arousal = Math.max(0, Math.min(1, ghost.affectiveState.arousal));
      ghost.affectiveState.dominance = Math.max(0, Math.min(1, ghost.affectiveState.dominance));
    }
    
    if (delta.workingContext) {
      if (delta.workingContext.topics) {
        ghost.workingContext.topics = [
          ...delta.workingContext.topics,
          ...ghost.workingContext.topics,
        ].slice(0, 20);
      }
      if (delta.workingContext.entities) {
        ghost.workingContext.entities = [
          ...delta.workingContext.entities,
          ...ghost.workingContext.entities,
        ].slice(0, 20);
      }
      if (delta.workingContext.recentIntents) {
        ghost.workingContext.recentIntents = [
          ...delta.workingContext.recentIntents,
          ...ghost.workingContext.recentIntents,
        ].slice(0, 10);
      }
    }
    
    if (delta.curiosityState) {
      ghost.curiosityState = { ...ghost.curiosityState, ...delta.curiosityState };
      ghost.curiosityState.interestLevel = Math.max(0, Math.min(1, ghost.curiosityState.interestLevel));
    }
    
    ghost.lastUpdated = new Date();
    ghost.turnsSinceReanchor++;
    
    // Update cache
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(ghost));
    
    // Check if re-anchor needed (with jitter to prevent thundering herd)
    const jitter = Math.floor(Math.random() * (REANCHOR_CONFIG.jitter * 2 + 1)) - REANCHOR_CONFIG.jitter;
    const reanchorThreshold = REANCHOR_CONFIG.baseInterval + jitter;
    
    if (ghost.turnsSinceReanchor >= reanchorThreshold) {
      // Fire and forget - async to avoid 1.8s latency spike
      this.scheduleReanchor(ghost).catch(err => 
        logger.error('[COS] Failed to schedule re-anchor', err)
      );
    }
    
    return ghost;
  }
  
  /**
   * Full re-anchor from 70B model (async operation)
   * 
   * Re-anchoring refreshes the ghost vector with fresh hidden states
   * from a larger model, ensuring accuracy doesn't drift over time.
   * 
   * @param userId - User ID
   * @param newHiddenStates - Fresh hidden states from 70B model
   */
  async reanchor(userId: string, newHiddenStates: number[]): Promise<GhostVector> {
    if (newHiddenStates.length !== this.VECTOR_DIMENSION) {
      throw new Error(`Invalid hidden state dimension for re-anchor: ${newHiddenStates.length}`);
    }
    
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (!cached) {
      throw new Error(`Cannot re-anchor: no ghost for user ${userId}`);
    }
    
    const ghost = JSON.parse(cached) as GhostVector;
    const now = new Date();
    
    // Update vector while preserving semantic state
    ghost.vector = newHiddenStates;
    ghost.lastReanchoredAt = now;
    ghost.turnsSinceReanchor = 0;
    ghost.lastUpdated = now;
    
    // Persist to database
    await this.storeGhost(ghost);
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(ghost));
    
    logger.info(`[COS] Ghost re-anchored for user ${userId}`);
    return ghost;
  }
  
  /**
   * Schedule async re-anchor job
   */
  private async scheduleReanchor(ghost: GhostVector): Promise<void> {
    const job = {
      ghostId: ghost.id,
      userId: ghost.userId,
      tenantId: ghost.tenantId,
      scheduledAt: new Date().toISOString(),
      priority: 'normal',
    };
    
    await this.redis.lpush('cos:reanchor_queue', JSON.stringify(job));
    logger.info(`[COS] Re-anchor scheduled for ghost ${ghost.id}`);
  }
  
  /**
   * Apply temporal decay to ghost state
   * 
   * Decay rates (Gemini validated):
   * - Affective: 7-hour half-life (mood fades slowly)
   * - Working Context: 12-minute half-life (topics fade quickly)
   * - Curiosity: 45-minute half-life (interest fades moderately)
   */
  private applyDecay(ghost: GhostVector): GhostVector {
    const elapsed = (Date.now() - new Date(ghost.lastUpdated).getTime()) / 1000;
    
    const decay = (value: number, rate: number, baseline: number = 0) => {
      const decayed = value * Math.exp(-rate * elapsed);
      // Decay towards baseline, not towards 0
      return baseline + (decayed - baseline);
    };
    
    return {
      ...ghost,
      affectiveState: {
        valence: decay(ghost.affectiveState.valence, ghost.decayConstants.affective, 0),
        arousal: decay(ghost.affectiveState.arousal, ghost.decayConstants.affective, 0.5),
        dominance: decay(ghost.affectiveState.dominance, ghost.decayConstants.affective, 0.5),
      },
      curiosityState: {
        ...ghost.curiosityState,
        interestLevel: decay(ghost.curiosityState.interestLevel, ghost.decayConstants.curiosity, 0.5),
      },
    };
  }
  
  /**
   * Store ghost to database
   */
  private async storeGhost(ghost: GhostVector): Promise<void> {
    await query(
      `INSERT INTO cos_ghost_vectors (
        id, user_id, tenant_id, vector, vector_dimension, model_version, model_family,
        affective_state, working_context, curiosity_state, decay_constants,
        last_updated, last_reanchored_at, turns_since_reanchor, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        vector = EXCLUDED.vector,
        model_version = EXCLUDED.model_version,
        affective_state = EXCLUDED.affective_state,
        working_context = EXCLUDED.working_context,
        curiosity_state = EXCLUDED.curiosity_state,
        last_updated = EXCLUDED.last_updated,
        last_reanchored_at = EXCLUDED.last_reanchored_at,
        turns_since_reanchor = EXCLUDED.turns_since_reanchor`,
      [
        ghost.id, ghost.userId, ghost.tenantId, 
        JSON.stringify(ghost.vector), ghost.vectorDimension,
        ghost.modelVersion, ghost.modelFamily, 
        JSON.stringify(ghost.affectiveState),
        JSON.stringify(ghost.workingContext), 
        JSON.stringify(ghost.curiosityState),
        JSON.stringify(ghost.decayConstants), 
        ghost.lastUpdated, ghost.lastReanchoredAt,
        ghost.turnsSinceReanchor, ghost.createdAt
      ]
    );
  }
  
  /**
   * Delete ghost (user data deletion request)
   */
  async deleteGhost(userId: string, tenantId: string): Promise<boolean> {
    await query(
      `DELETE FROM cos_ghost_vectors WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId]
    );
    await this.redis.del(`${this.CACHE_PREFIX}${userId}`);
    return true;
  }
  
  /**
   * Convert database row to GhostVector
   */
  private rowToGhost(row: Record<string, unknown>): GhostVector {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      tenantId: row.tenant_id as string,
      vector: JSON.parse(row.vector as string),
      vectorDimension: row.vector_dimension as 4096,
      modelVersion: row.model_version as string,
      modelFamily: row.model_family as string,
      affectiveState: JSON.parse(row.affective_state as string),
      workingContext: JSON.parse(row.working_context as string),
      curiosityState: JSON.parse(row.curiosity_state as string),
      decayConstants: JSON.parse(row.decay_constants as string),
      lastUpdated: new Date(row.last_updated as string),
      lastReanchoredAt: new Date(row.last_reanchored_at as string),
      turnsSinceReanchor: row.turns_since_reanchor as number,
      createdAt: new Date(row.created_at as string),
    };
  }
}
