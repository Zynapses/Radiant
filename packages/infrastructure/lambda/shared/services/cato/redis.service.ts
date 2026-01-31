/**
 * RADIANT Genesis Cato State Service
 * Provides state persistence for Epistemic Recovery
 * 
 * Uses Redis/ElastiCache when available (CATO_REDIS_ENDPOINT env var),
 * falls back to in-memory storage for development/testing.
 */

import { createClient, RedisClientType } from 'redis';
import { query } from '../database';
import { RecoveryState, RejectionEntry } from './types';
import { logger } from '../../logging/enhanced-logger';

// Default TTLs in seconds (for Redis) and milliseconds (for in-memory)
// These can be overridden per-tenant via cato_tenant_config
let TTL = {
  REJECTION_HISTORY: 60, // 1 minute window for livelock detection
  PERSONA_OVERRIDE: 300, // 5 minutes for persona override
  RECOVERY_STATE: 600, // 10 minutes for recovery state
};

let TTL_MS = {
  REJECTION_HISTORY: TTL.REJECTION_HISTORY * 1000,
  PERSONA_OVERRIDE: TTL.PERSONA_OVERRIDE * 1000,
  RECOVERY_STATE: TTL.RECOVERY_STATE * 1000,
};

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Redis key prefixes
const KEYS = {
  REJECTION: 'cato:rejection:',
  PERSONA: 'cato:persona:',
  RECOVERY: 'cato:recovery:',
};

class CatoStateService {
  private redisClient: RedisClientType | null = null;
  private redisConnected = false;
  private connectionAttempted = false;
  private tenantTTLs: Map<string, typeof TTL> = new Map();

  // In-memory fallback
  private rejectionHistory: Map<string, RejectionEntry[]> = new Map();
  private personaOverrides: Map<string, CacheEntry<string>> = new Map();
  private recoveryStates: Map<string, CacheEntry<RecoveryState>> = new Map();

  constructor() {
    // Periodic cleanup of in-memory entries
    setInterval(() => this.cleanup(), 30000);
    // Initialize Redis connection asynchronously
    this.initRedis();
  }

  /**
   * Load tenant-specific TTL settings from database
   */
  async loadTenantTTLs(tenantId: string): Promise<void> {
    try {
      const result = await query(
        `SELECT redis_rejection_ttl_seconds, redis_persona_override_ttl_seconds, redis_recovery_state_ttl_seconds
         FROM cato_tenant_config WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        this.tenantTTLs.set(tenantId, {
          REJECTION_HISTORY: row.redis_rejection_ttl_seconds ?? TTL.REJECTION_HISTORY,
          PERSONA_OVERRIDE: row.redis_persona_override_ttl_seconds ?? TTL.PERSONA_OVERRIDE,
          RECOVERY_STATE: row.redis_recovery_state_ttl_seconds ?? TTL.RECOVERY_STATE,
        });
      }
    } catch (error) {
      logger.error('[CATO State] Failed to load tenant TTLs:', error);
    }
  }

  /**
   * Get TTL for a tenant (with fallback to defaults)
   */
  private getTTL(tenantId?: string): typeof TTL {
    if (tenantId && this.tenantTTLs.has(tenantId)) {
      return this.tenantTTLs.get(tenantId)!;
    }
    return TTL;
  }

  /**
   * Initialize Redis connection if endpoint is configured
   */
  private async initRedis(): Promise<void> {
    if (this.connectionAttempted) return;
    this.connectionAttempted = true;

    const redisEndpoint = process.env.CATO_REDIS_ENDPOINT;
    const redisPort = process.env.CATO_REDIS_PORT || '6379';

    if (!redisEndpoint) {
      logger.info('[CATO State] No Redis endpoint configured, using in-memory storage');
      return;
    }

    try {
      this.redisClient = createClient({
        socket: {
          host: redisEndpoint,
          port: parseInt(redisPort, 10),
          connectTimeout: 5000,
          reconnectStrategy: (retries: number) => {
            if (retries > 3) {
              logger.warn('[CATO State] Redis reconnect failed, falling back to in-memory');
              return false;
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('[CATO State] Redis error:', undefined, { data: err.message });
        this.redisConnected = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('[CATO State] Redis connected');
        this.redisConnected = true;
      });

      this.redisClient.on('disconnect', () => {
        logger.info('[CATO State] Redis disconnected');
        this.redisConnected = false;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.warn('[CATO State] Failed to connect to Redis, using in-memory:', { data: error });
      this.redisClient = null;
    }
  }

  /**
   * Check if Redis is available
   */
  private useRedis(): boolean {
    return this.redisConnected && this.redisClient !== null;
  }

  private cleanup(): void {
    const now = Date.now();

    // Clean up persona overrides
    for (const [key, entry] of Array.from(this.personaOverrides)) {
      if (entry.expiresAt < now) {
        this.personaOverrides.delete(key);
      }
    }

    // Clean up recovery states
    for (const [key, entry] of Array.from(this.recoveryStates)) {
      if (entry.expiresAt < now) {
        this.recoveryStates.delete(key);
      }
    }

    // Clean up old rejection history
    const cutoff = now - TTL_MS.REJECTION_HISTORY;
    for (const [key, entries] of Array.from(this.rejectionHistory)) {
      const filtered = entries.filter((e) => e.timestamp > cutoff);
      if (filtered.length === 0) {
        this.rejectionHistory.delete(key);
      } else {
        this.rejectionHistory.set(key, filtered);
      }
    }
  }

  /**
   * Record a rejection event for livelock detection
   */
  async recordRejection(
    sessionId: string,
    rejection: RejectionEntry
  ): Promise<number> {
    if (this.useRedis()) {
      try {
        const key = KEYS.REJECTION + sessionId;
        await this.redisClient!.rPush(key, JSON.stringify(rejection));
        await this.redisClient!.expire(key, TTL.REJECTION_HISTORY);
        const length = await this.redisClient!.lLen(key);
        return length;
      } catch (error) {
        logger.error('[CATO State] Redis recordRejection failed:', error);
        // Fall through to in-memory
      }
    }

    // In-memory fallback
    const existing = this.rejectionHistory.get(sessionId) || [];
    const now = Date.now();
    const cutoff = now - TTL_MS.REJECTION_HISTORY;
    const updated = [...existing.filter((e) => e.timestamp > cutoff), rejection];
    this.rejectionHistory.set(sessionId, updated);
    return updated.length;
  }

  /**
   * Get rejection history for a session
   */
  async getRejectionHistory(sessionId: string): Promise<RejectionEntry[]> {
    if (this.useRedis()) {
      try {
        const key = KEYS.REJECTION + sessionId;
        const entries = await this.redisClient!.lRange(key, 0, -1);
        return entries.map((e: string) => JSON.parse(e) as RejectionEntry);
      } catch (error) {
        logger.error('[CATO State] Redis getRejectionHistory failed:', error);
      }
    }

    // In-memory fallback
    const entries = this.rejectionHistory.get(sessionId) || [];
    const now = Date.now();
    const cutoff = now - TTL_MS.REJECTION_HISTORY;
    return entries.filter((e) => e.timestamp > cutoff);
  }

  /**
   * Clear rejection history for a session (called on success)
   */
  async clearRejectionHistory(sessionId: string): Promise<void> {
    if (this.useRedis()) {
      try {
        await this.redisClient!.del(KEYS.REJECTION + sessionId);
        return;
      } catch (error) {
        logger.error('[CATO State] Redis clearRejectionHistory failed:', error);
      }
    }
    this.rejectionHistory.delete(sessionId);
  }

  /**
   * Set temporary persona override for Epistemic Recovery
   */
  async setPersonaOverride(sessionId: string, personaName: string): Promise<void> {
    if (this.useRedis()) {
      try {
        const key = KEYS.PERSONA + sessionId;
        await this.redisClient!.set(key, personaName, { EX: TTL.PERSONA_OVERRIDE });
        logger.info(`[CATO] Session ${sessionId} persona override set to: ${personaName} (Redis)`);
        return;
      } catch (error) {
        logger.error('[CATO State] Redis setPersonaOverride failed:', error);
      }
    }

    // In-memory fallback
    this.personaOverrides.set(sessionId, {
      value: personaName,
      expiresAt: Date.now() + TTL_MS.PERSONA_OVERRIDE,
    });
    logger.info(`[CATO] Session ${sessionId} persona override set to: ${personaName}`);
  }

  /**
   * Get persona override for a session
   */
  async getPersonaOverride(sessionId: string): Promise<string | null> {
    if (this.useRedis()) {
      try {
        const value = await this.redisClient!.get(KEYS.PERSONA + sessionId);
        return value as string | null;
      } catch (error) {
        logger.error('[CATO State] Redis getPersonaOverride failed:', error);
      }
    }

    // In-memory fallback
    const entry = this.personaOverrides.get(sessionId);
    if (!entry || entry.expiresAt < Date.now()) {
      this.personaOverrides.delete(sessionId);
      return null;
    }
    return entry.value;
  }

  /**
   * Clear persona override
   */
  async clearPersonaOverride(sessionId: string): Promise<void> {
    if (this.useRedis()) {
      try {
        await this.redisClient!.del(KEYS.PERSONA + sessionId);
        return;
      } catch (error) {
        logger.error('[CATO State] Redis clearPersonaOverride failed:', error);
      }
    }
    this.personaOverrides.delete(sessionId);
  }

  /**
   * Set recovery state
   */
  async setRecoveryState(sessionId: string, state: RecoveryState): Promise<void> {
    if (this.useRedis()) {
      try {
        const key = KEYS.RECOVERY + sessionId;
        await this.redisClient!.set(key, JSON.stringify(state), { EX: TTL.RECOVERY_STATE });
        return;
      } catch (error) {
        logger.error('[CATO State] Redis setRecoveryState failed:', error);
      }
    }

    // In-memory fallback
    this.recoveryStates.set(sessionId, {
      value: state,
      expiresAt: Date.now() + TTL_MS.RECOVERY_STATE,
    });
  }

  /**
   * Get recovery state
   */
  async getRecoveryState(sessionId: string): Promise<RecoveryState | null> {
    if (this.useRedis()) {
      try {
        const value = await this.redisClient!.get(KEYS.RECOVERY + sessionId);
        return value ? JSON.parse(value as string) as RecoveryState : null;
      } catch (error) {
        logger.error('[CATO State] Redis getRecoveryState failed:', error);
      }
    }

    // In-memory fallback
    const entry = this.recoveryStates.get(sessionId);
    if (!entry || entry.expiresAt < Date.now()) {
      this.recoveryStates.delete(sessionId);
      return null;
    }
    return entry.value;
  }

  /**
   * Clear recovery state
   */
  async clearRecoveryState(sessionId: string): Promise<void> {
    if (this.useRedis()) {
      try {
        await this.redisClient!.del(KEYS.RECOVERY + sessionId);
        return;
      } catch (error) {
        logger.error('[CATO State] Redis clearRecoveryState failed:', error);
      }
    }
    this.recoveryStates.delete(sessionId);
  }

  /**
   * Reset all Cato state for a session
   */
  async resetSession(sessionId: string): Promise<void> {
    if (this.useRedis()) {
      try {
        await this.redisClient!.del([
          KEYS.REJECTION + sessionId,
          KEYS.PERSONA + sessionId,
          KEYS.RECOVERY + sessionId,
        ]);
        return;
      } catch (error) {
        logger.error('[CATO State] Redis resetSession failed:', error);
      }
    }

    // In-memory fallback
    await Promise.all([
      this.clearRejectionHistory(sessionId),
      this.clearPersonaOverride(sessionId),
      this.clearRecoveryState(sessionId),
    ]);
  }

  /**
   * Check if Redis is connected (for health checks)
   */
  isRedisConnected(): boolean {
    return this.redisConnected;
  }
}

export const catoStateService = new CatoStateService();
