// RADIANT v4.18.0 - Adapter Management Service
// Domain adapter auto-selection and rollback mechanism
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam } from '../db/client';
import { enhancedLearningService } from './enhanced-learning.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface AdapterSelection {
  adapterId: string;
  adapterName: string;
  domain: string;
  subdomain?: string;
  version: number;
  matchScore: number;
  selectionReason: string;
  performanceMetrics: {
    avgSatisfactionScore: number;
    responseCount: number;
    avgLatencyMs: number;
  };
}

export interface AdapterPerformance {
  adapterId: string;
  tenantId: string;
  domain: string;
  periodStart: Date;
  periodEnd: Date;
  responseCount: number;
  avgSatisfactionScore: number;
  avgLatencyMs: number;
  errorRate: number;
  improvementVsBaseline: number;
}

export interface RollbackDecision {
  shouldRollback: boolean;
  reason: string;
  currentVersion: number;
  targetVersion: number;
  performanceDrop: number;
  threshold: number;
}

export interface LearningEffectivenessMetrics {
  tenantId: string;
  periodDays: number;
  // Before/after training comparison
  satisfactionBeforeTraining: number;
  satisfactionAfterTraining: number;
  satisfactionImprovement: number;
  // Cache effectiveness
  patternCacheHitRate: number;
  patternCacheAvgRating: number;
  cacheResponseTimeMs: number;
  freshResponseTimeMs: number;
  // Learning signal stats
  implicitSignalsCaptured: number;
  positiveCandidatesCreated: number;
  negativeCandidatesCreated: number;
  candidatesUsedInTraining: number;
  // Adapter performance
  activeAdapters: number;
  adapterImprovementAvg: number;
  rollbacksTriggered: number;
}

// ============================================================================
// Adapter Management Service
// ============================================================================

class AdapterManagementService {
  
  // ==========================================================================
  // 4. Domain Adapter Auto-Selection
  // ==========================================================================
  
  /**
   * Automatically select the best adapter for a given domain
   */
  async selectBestAdapter(
    tenantId: string,
    domain: string,
    subdomain?: string
  ): Promise<AdapterSelection | null> {
    const config = await enhancedLearningService.getConfig(tenantId);
    if (!config?.adapterAutoSelectionEnabled) {
      return null;
    }
    
    // Get all active adapters for this domain
    const adapters = await enhancedLearningService.listDomainAdapters(tenantId, {
      domain,
      status: 'active',
    });
    
    if (adapters.length === 0) {
      logger.debug('No active adapters for domain', { tenantId, domain });
      return null;
    }
    
    // Score each adapter based on performance metrics
    const scoredAdapters = await Promise.all(
      adapters.map(async (adapter) => {
        const performance = await this.getAdapterPerformance(tenantId, adapter.id, 7);
        const matchScore = this.calculateAdapterMatchScore(adapter, domain, subdomain, performance);
        
        return {
          adapter,
          performance,
          matchScore,
        };
      })
    );
    
    // Sort by match score descending
    scoredAdapters.sort((a, b) => b.matchScore - a.matchScore);
    
    const best = scoredAdapters[0];
    if (!best || best.matchScore < 0.5) {
      logger.debug('No suitable adapter found', { tenantId, domain, bestScore: best?.matchScore });
      return null;
    }
    
    // Log selection
    await this.logAdapterSelection(tenantId, best.adapter.id, domain, subdomain, best.matchScore);
    
    return {
      adapterId: best.adapter.id,
      adapterName: best.adapter.adapterName,
      domain: best.adapter.domain,
      subdomain: best.adapter.subdomain,
      version: best.adapter.adapterVersion,
      matchScore: best.matchScore,
      selectionReason: this.generateSelectionReason(best.adapter, best.performance, best.matchScore),
      performanceMetrics: {
        avgSatisfactionScore: best.performance?.avgSatisfactionScore || 0,
        responseCount: best.performance?.responseCount || 0,
        avgLatencyMs: best.performance?.avgLatencyMs || 0,
      },
    };
  }
  
  private calculateAdapterMatchScore(
    adapter: any,
    targetDomain: string,
    targetSubdomain?: string,
    performance?: AdapterPerformance | null
  ): number {
    let score = 0;
    
    // Domain match (0.3)
    if (adapter.domain === targetDomain) {
      score += 0.3;
      
      // Subdomain match bonus (0.1)
      if (targetSubdomain && adapter.subdomain === targetSubdomain) {
        score += 0.1;
      }
    }
    
    // Performance score (0.4)
    if (performance) {
      const satisfactionScore = Math.min(performance.avgSatisfactionScore / 5, 1) * 0.25;
      const volumeScore = Math.min(performance.responseCount / 100, 1) * 0.1;
      const errorScore = (1 - performance.errorRate) * 0.05;
      score += satisfactionScore + volumeScore + errorScore;
    }
    
    // Recency score (0.2) - prefer newer adapters slightly
    const daysSinceCreation = (Date.now() - new Date(adapter.createdAt).getTime()) / (24 * 60 * 60 * 1000);
    const recencyScore = Math.max(0, 0.2 - (daysSinceCreation / 365) * 0.2);
    score += recencyScore;
    
    return score;
  }
  
  private generateSelectionReason(adapter: any, performance: AdapterPerformance | null, score: number): string {
    const reasons: string[] = [];
    
    if (performance && performance.avgSatisfactionScore >= 4.5) {
      reasons.push(`High satisfaction (${performance.avgSatisfactionScore.toFixed(1)}/5)`);
    }
    if (performance && performance.responseCount >= 100) {
      reasons.push(`Well-tested (${performance.responseCount} responses)`);
    }
    if (adapter.subdomain) {
      reasons.push(`Specialized for ${adapter.subdomain}`);
    }
    
    return reasons.length > 0 
      ? reasons.join(', ') 
      : `Best match for ${adapter.domain} (score: ${(score * 100).toFixed(0)}%)`;
  }
  
  private async getAdapterPerformance(
    tenantId: string,
    adapterId: string,
    days: number
  ): Promise<AdapterPerformance | null> {
    const result = await executeStatement(
      `SELECT 
         COUNT(*) as response_count,
         AVG(satisfaction_score) as avg_satisfaction,
         AVG(latency_ms) as avg_latency,
         SUM(CASE WHEN error = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) as error_rate
       FROM adapter_usage_logs
       WHERE tenant_id = $1::uuid AND adapter_id = $2::uuid
         AND created_at >= NOW() - INTERVAL '1 day' * $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('adapterId', adapterId),
        longParam('days', days),
      ]
    );
    
    if (!result.rows?.length || !result.rows[0].response_count) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      adapterId,
      tenantId,
      domain: '',
      periodStart: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      periodEnd: new Date(),
      responseCount: Number(row.response_count || 0),
      avgSatisfactionScore: Number(row.avg_satisfaction || 0),
      avgLatencyMs: Number(row.avg_latency || 0),
      errorRate: Number(row.error_rate || 0),
      improvementVsBaseline: 0,
    };
  }
  
  private async logAdapterSelection(
    tenantId: string,
    adapterId: string,
    domain: string,
    subdomain: string | undefined,
    matchScore: number
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO adapter_selection_log (tenant_id, adapter_id, domain, subdomain, match_score, selected_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, NOW())`,
      [
        stringParam('tenantId', tenantId),
        stringParam('adapterId', adapterId),
        stringParam('domain', domain),
        stringParam('subdomain', subdomain || ''),
        doubleParam('matchScore', matchScore),
      ]
    );
  }
  
  // ==========================================================================
  // 6. Adapter Rollback Mechanism
  // ==========================================================================
  
  /**
   * Check if current adapter should be rolled back to previous version
   */
  async checkRollbackNeeded(tenantId: string, adapterId: string): Promise<RollbackDecision> {
    const config = await enhancedLearningService.getConfig(tenantId);
    if (!config?.adapterRollbackEnabled) {
      return { shouldRollback: false, reason: 'Rollback disabled', currentVersion: 0, targetVersion: 0, performanceDrop: 0, threshold: 0 };
    }
    
    // Get current adapter info
    const currentAdapter = await this.getAdapterById(tenantId, adapterId);
    if (!currentAdapter || currentAdapter.adapterVersion <= 1) {
      return { shouldRollback: false, reason: 'No previous version available', currentVersion: currentAdapter?.adapterVersion || 0, targetVersion: 0, performanceDrop: 0, threshold: 0 };
    }
    
    // Get performance for current version (last 3 days)
    const currentPerf = await this.getAdapterPerformance(tenantId, adapterId, 3);
    
    // Get performance for previous version (days 4-7)
    const previousPerf = await this.getAdapterVersionPerformance(
      tenantId, 
      currentAdapter.domain, 
      currentAdapter.adapterVersion - 1,
      7
    );
    
    if (!currentPerf || !previousPerf) {
      return { shouldRollback: false, reason: 'Insufficient performance data', currentVersion: currentAdapter.adapterVersion, targetVersion: 0, performanceDrop: 0, threshold: 0 };
    }
    
    // Calculate performance drop
    const satisfactionDrop = previousPerf.avgSatisfactionScore - currentPerf.avgSatisfactionScore;
    const dropPercentage = (satisfactionDrop / previousPerf.avgSatisfactionScore) * 100;
    
    const threshold = config.adapterRollbackThreshold || 10;
    
    if (dropPercentage >= threshold) {
      logger.warn('Adapter rollback recommended', {
        tenantId,
        adapterId,
        currentVersion: currentAdapter.adapterVersion,
        dropPercentage,
        threshold,
      });
      
      return {
        shouldRollback: true,
        reason: `Satisfaction dropped ${dropPercentage.toFixed(1)}% (threshold: ${threshold}%)`,
        currentVersion: currentAdapter.adapterVersion,
        targetVersion: currentAdapter.adapterVersion - 1,
        performanceDrop: dropPercentage,
        threshold,
      };
    }
    
    return {
      shouldRollback: false,
      reason: `Performance within threshold (${dropPercentage.toFixed(1)}% drop, threshold: ${threshold}%)`,
      currentVersion: currentAdapter.adapterVersion,
      targetVersion: currentAdapter.adapterVersion - 1,
      performanceDrop: dropPercentage,
      threshold,
    };
  }
  
  /**
   * Execute adapter rollback to previous version
   */
  async executeRollback(tenantId: string, adapterId: string, targetVersion: number): Promise<boolean> {
    try {
      // Get the previous adapter version
      const previousAdapter = await this.getAdapterByVersion(tenantId, adapterId, targetVersion);
      if (!previousAdapter) {
        logger.error('Rollback failed: previous version not found', { tenantId, adapterId, targetVersion });
        return false;
      }
      
      // Deactivate current adapter
      await executeStatement(
        `UPDATE domain_lora_adapters SET status = 'rolled_back' WHERE id = $1::uuid`,
        [stringParam('adapterId', adapterId)]
      );
      
      // Activate previous version
      await executeStatement(
        `UPDATE domain_lora_adapters SET status = 'active' WHERE id = $1::uuid`,
        [stringParam('adapterId', previousAdapter.id)]
      );
      
      // Log rollback event
      await executeStatement(
        `INSERT INTO adapter_rollback_log (tenant_id, from_adapter_id, to_adapter_id, reason, rolled_back_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, NOW())`,
        [
          stringParam('tenantId', tenantId),
          stringParam('fromAdapterId', adapterId),
          stringParam('toAdapterId', previousAdapter.id),
          stringParam('reason', 'Auto-rollback due to performance drop'),
        ]
      );
      
      logger.info('Adapter rollback executed', {
        tenantId,
        fromAdapterId: adapterId,
        toAdapterId: previousAdapter.id,
        targetVersion,
      });
      
      return true;
    } catch (error) {
      logger.error('Adapter rollback failed', { tenantId, adapterId, targetVersion, error });
      return false;
    }
  }
  
  private async getAdapterById(tenantId: string, adapterId: string): Promise<any | null> {
    const result = await executeStatement(
      `SELECT * FROM domain_lora_adapters WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [stringParam('tenantId', tenantId), stringParam('adapterId', adapterId)]
    );
    return result.rows?.[0] || null;
  }
  
  private async getAdapterByVersion(tenantId: string, adapterId: string, version: number): Promise<any | null> {
    // Get adapter by domain and version (previous version of same domain adapter)
    const current = await this.getAdapterById(tenantId, adapterId);
    if (!current) return null;
    
    const result = await executeStatement(
      `SELECT * FROM domain_lora_adapters 
       WHERE tenant_id = $1::uuid AND domain = $2 AND adapter_version = $3
       ORDER BY created_at DESC LIMIT 1`,
      [
        stringParam('tenantId', tenantId),
        stringParam('domain', current.domain),
        longParam('version', version),
      ]
    );
    return result.rows?.[0] || null;
  }
  
  private async getAdapterVersionPerformance(
    tenantId: string,
    domain: string,
    version: number,
    days: number
  ): Promise<AdapterPerformance | null> {
    const result = await executeStatement(
      `SELECT 
         a.id as adapter_id,
         COUNT(u.*) as response_count,
         AVG(u.satisfaction_score) as avg_satisfaction,
         AVG(u.latency_ms) as avg_latency,
         SUM(CASE WHEN u.error = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(u.*), 0) as error_rate
       FROM domain_lora_adapters a
       LEFT JOIN adapter_usage_logs u ON a.id = u.adapter_id
       WHERE a.tenant_id = $1::uuid AND a.domain = $2 AND a.adapter_version = $3
         AND (u.created_at IS NULL OR u.created_at >= NOW() - INTERVAL '1 day' * $4)
       GROUP BY a.id`,
      [
        stringParam('tenantId', tenantId),
        stringParam('domain', domain),
        longParam('version', version),
        longParam('days', days),
      ]
    );
    
    if (!result.rows?.length) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      adapterId: String(row.adapter_id),
      tenantId,
      domain,
      periodStart: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      periodEnd: new Date(),
      responseCount: Number(row.response_count || 0),
      avgSatisfactionScore: Number(row.avg_satisfaction || 0),
      avgLatencyMs: Number(row.avg_latency || 0),
      errorRate: Number(row.error_rate || 0),
      improvementVsBaseline: 0,
    };
  }
  
  // ==========================================================================
  // 5. Learning Effectiveness Metrics
  // ==========================================================================
  
  /**
   * Get comprehensive learning effectiveness metrics
   */
  async getLearningEffectivenessMetrics(tenantId: string, periodDays: number = 30): Promise<LearningEffectivenessMetrics> {
    const [
      satisfactionMetrics,
      cacheMetrics,
      signalMetrics,
      adapterMetrics,
    ] = await Promise.all([
      this.getSatisfactionMetrics(tenantId, periodDays),
      this.getCacheMetrics(tenantId, periodDays),
      this.getSignalMetrics(tenantId, periodDays),
      this.getAdapterMetrics(tenantId, periodDays),
    ]);
    
    return {
      tenantId,
      periodDays,
      ...satisfactionMetrics,
      ...cacheMetrics,
      ...signalMetrics,
      ...adapterMetrics,
    };
  }
  
  private async getSatisfactionMetrics(tenantId: string, periodDays: number): Promise<{
    satisfactionBeforeTraining: number;
    satisfactionAfterTraining: number;
    satisfactionImprovement: number;
  }> {
    // Get last training date
    const trainingResult = await executeStatement(
      `SELECT MAX(completed_at) as last_training FROM lora_evolution_jobs 
       WHERE tenant_id = $1::uuid AND status = 'completed'`,
      [stringParam('tenantId', tenantId)]
    );
    
    const lastTraining = trainingResult.rows?.[0]?.last_training;
    if (!lastTraining) {
      return { satisfactionBeforeTraining: 0, satisfactionAfterTraining: 0, satisfactionImprovement: 0 };
    }
    
    // Compare satisfaction before and after training
    const lastTrainingStr = String(lastTraining);
    const [beforeResult, afterResult] = await Promise.all([
      executeStatement(
        `SELECT AVG(rating) as avg_rating FROM user_feedback 
         WHERE tenant_id = $1::uuid AND created_at < $2::timestamptz
         AND created_at >= $2::timestamptz - INTERVAL '7 days'`,
        [stringParam('tenantId', tenantId), stringParam('lastTraining', lastTrainingStr)]
      ),
      executeStatement(
        `SELECT AVG(rating) as avg_rating FROM user_feedback 
         WHERE tenant_id = $1::uuid AND created_at >= $2::timestamptz`,
        [stringParam('tenantId', tenantId), stringParam('lastTraining', lastTrainingStr)]
      ),
    ]);
    
    const before = Number(beforeResult.rows?.[0]?.avg_rating || 0);
    const after = Number(afterResult.rows?.[0]?.avg_rating || 0);
    const improvement = before > 0 ? ((after - before) / before) * 100 : 0;
    
    return {
      satisfactionBeforeTraining: before,
      satisfactionAfterTraining: after,
      satisfactionImprovement: improvement,
    };
  }
  
  private async getCacheMetrics(tenantId: string, periodDays: number): Promise<{
    patternCacheHitRate: number;
    patternCacheAvgRating: number;
    cacheResponseTimeMs: number;
    freshResponseTimeMs: number;
  }> {
    const result = await executeStatement(
      `SELECT 
         SUM(cache_hits) as total_hits,
         SUM(occurrence_count) as total_occurrences,
         AVG(average_rating) as avg_rating
       FROM successful_pattern_cache 
       WHERE tenant_id = $1::uuid AND last_used_at >= NOW() - INTERVAL '1 day' * $2`,
      [stringParam('tenantId', tenantId), longParam('days', periodDays)]
    );
    
    const row = result.rows?.[0] || {};
    const totalHits = Number(row.total_hits || 0);
    const totalOccurrences = Number(row.total_occurrences || 0);
    
    return {
      patternCacheHitRate: totalOccurrences > 0 ? totalHits / totalOccurrences : 0,
      patternCacheAvgRating: Number(row.avg_rating || 0),
      cacheResponseTimeMs: 5, // Redis/cache is ~5ms
      freshResponseTimeMs: 2000, // Fresh LLM response is ~2s
    };
  }
  
  private async getSignalMetrics(tenantId: string, periodDays: number): Promise<{
    implicitSignalsCaptured: number;
    positiveCandidatesCreated: number;
    negativeCandidatesCreated: number;
    candidatesUsedInTraining: number;
  }> {
    const [signalsResult, positivesResult, negativesResult, trainedResult] = await Promise.all([
      executeStatement(
        `SELECT COUNT(*) as count FROM implicit_feedback_signals 
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 day' * $2`,
        [stringParam('tenantId', tenantId), longParam('days', periodDays)]
      ),
      executeStatement(
        `SELECT COUNT(*) as count FROM learning_candidates 
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 day' * $2`,
        [stringParam('tenantId', tenantId), longParam('days', periodDays)]
      ),
      executeStatement(
        `SELECT COUNT(*) as count FROM negative_learning_candidates 
         WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 day' * $2`,
        [stringParam('tenantId', tenantId), longParam('days', periodDays)]
      ),
      executeStatement(
        `SELECT COUNT(*) as count FROM learning_candidates 
         WHERE tenant_id = $1::uuid AND training_status = 'completed'
         AND trained_at >= NOW() - INTERVAL '1 day' * $2`,
        [stringParam('tenantId', tenantId), longParam('days', periodDays)]
      ),
    ]);
    
    return {
      implicitSignalsCaptured: Number(signalsResult.rows?.[0]?.count || 0),
      positiveCandidatesCreated: Number(positivesResult.rows?.[0]?.count || 0),
      negativeCandidatesCreated: Number(negativesResult.rows?.[0]?.count || 0),
      candidatesUsedInTraining: Number(trainedResult.rows?.[0]?.count || 0),
    };
  }
  
  private async getAdapterMetrics(tenantId: string, periodDays: number): Promise<{
    activeAdapters: number;
    adapterImprovementAvg: number;
    rollbacksTriggered: number;
  }> {
    const [adaptersResult, rollbacksResult] = await Promise.all([
      executeStatement(
        `SELECT COUNT(*) as count FROM domain_lora_adapters 
         WHERE tenant_id = $1::uuid AND status = 'active'`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT COUNT(*) as count FROM adapter_rollback_log 
         WHERE tenant_id = $1::uuid AND rolled_back_at >= NOW() - INTERVAL '1 day' * $2`,
        [stringParam('tenantId', tenantId), longParam('days', periodDays)]
      ),
    ]);
    
    return {
      activeAdapters: Number(adaptersResult.rows?.[0]?.count || 0),
      adapterImprovementAvg: 0, // Would need baseline comparison
      rollbacksTriggered: Number(rollbacksResult.rows?.[0]?.count || 0),
    };
  }
  
  /**
   * Get A/B test results comparing cached vs fresh responses
   */
  async getCachedVsFreshComparison(tenantId: string, periodDays: number = 7): Promise<{
    cachedResponseCount: number;
    cachedAvgRating: number;
    freshResponseCount: number;
    freshAvgRating: number;
    cacheWinRate: number;
  }> {
    // This would require tracking which responses came from cache vs fresh
    // For now, return estimated values based on cache hit rate
    const cacheMetrics = await this.getCacheMetrics(tenantId, periodDays);
    
    return {
      cachedResponseCount: 0,
      cachedAvgRating: cacheMetrics.patternCacheAvgRating,
      freshResponseCount: 0,
      freshAvgRating: 0,
      cacheWinRate: 0,
    };
  }
}

export const adapterManagementService = new AdapterManagementService();
