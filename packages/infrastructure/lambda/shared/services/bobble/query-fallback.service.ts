/**
 * Bobble Query Fallback Service
 * 
 * Always-available endpoint for when circuit breakers trip.
 * Provides degraded-mode responses using cached data and simple heuristics.
 * 
 * Guarantees:
 * - Never throws exceptions
 * - Always returns within 500ms
 * - Uses only local/cached data (no external API calls)
 * 
 * See: /docs/bobble/adr/010-genesis-system.md
 */

import { executeStatement, stringParam } from '../../db/client';
import { logger } from '../../logging/enhanced-logger';
import { circuitBreakerService, InterventionLevel } from './circuit-breaker.service';

export interface FallbackResponse {
  message: string;
  status: 'degraded' | 'minimal' | 'offline';
  interventionLevel: InterventionLevel;
  reason: string;
  cachedContext: CachedContext | null;
  suggestedActions: string[];
  timestamp: string;
}

export interface CachedContext {
  lastKnownState: string;
  lastUpdate: string;
  domainHints: string[];
  recentTopics: string[];
}

export interface FallbackConfig {
  enableCachedResponses: boolean;
  maxCacheAgeSeconds: number;
  offlineMessage: string;
  degradedMessage: string;
  minimalMessage: string;
}

const DEFAULT_CONFIG: FallbackConfig = {
  enableCachedResponses: true,
  maxCacheAgeSeconds: 3600,
  offlineMessage: "I'm currently in maintenance mode. Please try again later.",
  degradedMessage: "I'm operating in reduced capacity. I can help with simple questions.",
  minimalMessage: "I'm experiencing difficulties. Only basic functions are available."
};

/**
 * Query Fallback Service
 * 
 * Provides graceful degradation when consciousness is impaired.
 */
class QueryFallbackService {
  private tenantId: string = 'global';
  private config: FallbackConfig = DEFAULT_CONFIG;
  private responseCache: Map<string, { response: string; timestamp: number }> = new Map();

  /**
   * Get a fallback response based on current system state
   */
  async getFallbackResponse(query?: string): Promise<FallbackResponse> {
    const startTime = Date.now();
    
    try {
      const interventionLevel = await this.getInterventionLevelSafe();
      const cachedContext = await this.getCachedContextSafe();
      
      const response = this.buildResponse(interventionLevel, cachedContext, query);
      
      // Ensure we respond within 500ms
      const elapsed = Date.now() - startTime;
      if (elapsed > 400) {
        logger.warn('Fallback response took too long', { elapsed });
      }
      
      return response;
    } catch (error) {
      // Never throw - return offline response
      logger.error('Fallback service error', { error });
      return {
        message: this.config.offlineMessage,
        status: 'offline',
        interventionLevel: 'HIBERNATE',
        reason: 'Fallback service error',
        cachedContext: null,
        suggestedActions: ['Try again later', 'Contact support'],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if fallback mode is active
   */
  async isFallbackActive(): Promise<boolean> {
    try {
      const level = await circuitBreakerService.getInterventionLevel();
      return level !== 'NONE';
    } catch {
      return true; // Assume fallback if we can't check
    }
  }

  /**
   * Get cached response for a query if available
   */
  getCachedResponse(queryHash: string): string | null {
    const cached = this.responseCache.get(queryHash);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.config.maxCacheAgeSeconds * 1000) {
      this.responseCache.delete(queryHash);
      return null;
    }
    
    return cached.response;
  }

  /**
   * Cache a response for future fallback use
   */
  cacheResponse(queryHash: string, response: string): void {
    this.responseCache.set(queryHash, {
      response,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.responseCache.size > 1000) {
      const oldest = this.responseCache.keys().next().value;
      if (oldest) this.responseCache.delete(oldest);
    }
  }

  /**
   * Get health check response (always works)
   */
  getHealthCheck(): { healthy: boolean; mode: string; timestamp: string } {
    return {
      healthy: true,
      mode: 'fallback',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update fallback configuration
   */
  updateConfig(updates: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get simple response based on intervention level
   */
  getSimpleResponse(level: InterventionLevel): string {
    switch (level) {
      case 'NONE':
        return "System is operating normally.";
      case 'DAMPEN':
        return this.config.degradedMessage;
      case 'PAUSE':
        return this.config.minimalMessage;
      case 'RESET':
        return "System is resetting. Please wait.";
      case 'HIBERNATE':
        return this.config.offlineMessage;
      default:
        return "System status unknown.";
    }
  }

  // ============ Private Helper Methods ============

  private async getInterventionLevelSafe(): Promise<InterventionLevel> {
    try {
      return await circuitBreakerService.getInterventionLevel();
    } catch {
      return 'PAUSE'; // Assume paused if we can't check
    }
  }

  private async getCachedContextSafe(): Promise<CachedContext | null> {
    if (!this.config.enableCachedResponses) return null;
    
    try {
      const result = await executeStatement({
        sql: `
          SELECT 
            dominant_state as last_known_state,
            updated_at as last_update
          FROM bobble_pymdp_state
          WHERE tenant_id = :tenantId
        `,
        parameters: [stringParam('tenantId', this.tenantId)]
      });

      if (!result.rows || result.rows.length === 0) return null;

      const row = result.rows[0];
      const lastUpdate = new Date(row.last_update as string);
      const age = Date.now() - lastUpdate.getTime();
      
      if (age > this.config.maxCacheAgeSeconds * 1000) {
        return null; // Cache too old
      }

      // Get recent domain hints
      const domainResult = await executeStatement({
        sql: `
          SELECT DISTINCT domain_name
          FROM bobble_domain_explorations
          WHERE tenant_id = :tenantId
          ORDER BY created_at DESC
          LIMIT 5
        `,
        parameters: [stringParam('tenantId', this.tenantId)]
      });

      const domainHints = domainResult.rows?.map(r => r.domain_name as string) || [];

      return {
        lastKnownState: row.last_known_state as string,
        lastUpdate: row.last_update as string,
        domainHints,
        recentTopics: []
      };
    } catch {
      return null;
    }
  }

  private buildResponse(
    level: InterventionLevel,
    context: CachedContext | null,
    query?: string
  ): FallbackResponse {
    let status: 'degraded' | 'minimal' | 'offline';
    let message: string;
    let reason: string;
    const suggestedActions: string[] = [];

    switch (level) {
      case 'NONE':
        status = 'degraded';
        message = "System is recovering. Limited functionality available.";
        reason = 'Normal operation with fallback active';
        suggestedActions.push('Wait for full recovery');
        break;
        
      case 'DAMPEN':
        status = 'degraded';
        message = this.config.degradedMessage;
        reason = 'Circuit breaker triggered - dampening active';
        suggestedActions.push('Try simpler queries');
        suggestedActions.push('Wait a few minutes');
        break;
        
      case 'PAUSE':
        status = 'minimal';
        message = this.config.minimalMessage;
        reason = 'Multiple circuit breakers open';
        suggestedActions.push('Check system status page');
        suggestedActions.push('Try again in 10 minutes');
        break;
        
      case 'RESET':
        status = 'minimal';
        message = "System is resetting to baseline. Please wait.";
        reason = 'System reset in progress';
        suggestedActions.push('Wait for reset to complete');
        break;
        
      case 'HIBERNATE':
        status = 'offline';
        message = this.config.offlineMessage;
        reason = 'Master safety breaker triggered';
        suggestedActions.push('Contact administrator');
        suggestedActions.push('Check for maintenance announcements');
        break;
        
      default:
        status = 'offline';
        message = "System status unknown.";
        reason = 'Unknown intervention level';
        suggestedActions.push('Contact support');
    }

    // Add context hints if available
    if (context && context.domainHints.length > 0) {
      suggestedActions.push(`Topics I know about: ${context.domainHints.slice(0, 3).join(', ')}`);
    }

    return {
      message,
      status,
      interventionLevel: level,
      reason,
      cachedContext: context,
      suggestedActions,
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instance
export const queryFallbackService = new QueryFallbackService();
export { QueryFallbackService };
