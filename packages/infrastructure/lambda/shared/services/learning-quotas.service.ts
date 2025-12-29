// RADIANT v4.18.0 - Learning Quotas Service
// Rate limiting for learning candidates to prevent gaming
// ============================================================================

import { executeStatement, stringParam, longParam } from '../db/client';
import { enhancedLearningService } from './enhanced-learning.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface LearningQuotaConfig {
  tenantId: string;
  quotasEnabled: boolean;
  // Per-user limits
  maxCandidatesPerUserPerDay: number;
  maxImplicitSignalsPerUserPerHour: number;
  maxCorrectionsPerUserPerDay: number;
  // Per-tenant limits
  maxCandidatesPerTenantPerDay: number;
  maxTrainingJobsPerWeek: number;
  // Quality controls
  minTimeBetweenSignalsMs: number;
  blockSuspiciousPatterns: boolean;
}

export interface QuotaUsage {
  tenantId: string;
  userId?: string;
  period: 'hour' | 'day' | 'week';
  candidatesCreated: number;
  implicitSignals: number;
  corrections: number;
  trainingJobs: number;
  quotaLimitReached: boolean;
  nextResetAt: Date;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
  quotaType: string;
  resetAt: Date;
}

// ============================================================================
// Learning Quotas Service
// ============================================================================

class LearningQuotasService {
  
  /**
   * Check if user can create a learning candidate
   */
  async checkCandidateQuota(tenantId: string, userId: string): Promise<QuotaCheckResult> {
    const config = await this.getQuotaConfig(tenantId);
    if (!config.quotasEnabled) {
      return { allowed: true, currentUsage: 0, limit: Infinity, quotaType: 'candidate', resetAt: new Date() };
    }
    
    // Check user daily limit
    const userUsage = await this.getUserCandidateCount(tenantId, userId, 'day');
    if (userUsage >= config.maxCandidatesPerUserPerDay) {
      const resetAt = this.getNextResetTime('day');
      return {
        allowed: false,
        reason: `Daily candidate limit reached (${config.maxCandidatesPerUserPerDay}/day)`,
        currentUsage: userUsage,
        limit: config.maxCandidatesPerUserPerDay,
        quotaType: 'user_candidate_daily',
        resetAt,
      };
    }
    
    // Check tenant daily limit
    const tenantUsage = await this.getTenantCandidateCount(tenantId, 'day');
    if (tenantUsage >= config.maxCandidatesPerTenantPerDay) {
      const resetAt = this.getNextResetTime('day');
      return {
        allowed: false,
        reason: `Tenant daily candidate limit reached (${config.maxCandidatesPerTenantPerDay}/day)`,
        currentUsage: tenantUsage,
        limit: config.maxCandidatesPerTenantPerDay,
        quotaType: 'tenant_candidate_daily',
        resetAt,
      };
    }
    
    return {
      allowed: true,
      currentUsage: userUsage,
      limit: config.maxCandidatesPerUserPerDay,
      quotaType: 'user_candidate_daily',
      resetAt: this.getNextResetTime('day'),
    };
  }
  
  /**
   * Check if user can record an implicit signal
   */
  async checkImplicitSignalQuota(tenantId: string, userId: string): Promise<QuotaCheckResult> {
    const config = await this.getQuotaConfig(tenantId);
    if (!config.quotasEnabled) {
      return { allowed: true, currentUsage: 0, limit: Infinity, quotaType: 'implicit_signal', resetAt: new Date() };
    }
    
    // Check hourly limit
    const usage = await this.getUserSignalCount(tenantId, userId, 'hour');
    if (usage >= config.maxImplicitSignalsPerUserPerHour) {
      const resetAt = this.getNextResetTime('hour');
      return {
        allowed: false,
        reason: `Hourly signal limit reached (${config.maxImplicitSignalsPerUserPerHour}/hour)`,
        currentUsage: usage,
        limit: config.maxImplicitSignalsPerUserPerHour,
        quotaType: 'user_signal_hourly',
        resetAt,
      };
    }
    
    // Check minimum time between signals
    const lastSignalTime = await this.getLastSignalTime(tenantId, userId);
    if (lastSignalTime) {
      const timeSinceLastSignal = Date.now() - lastSignalTime.getTime();
      if (timeSinceLastSignal < config.minTimeBetweenSignalsMs) {
        return {
          allowed: false,
          reason: `Too many signals too quickly. Wait ${Math.ceil((config.minTimeBetweenSignalsMs - timeSinceLastSignal) / 1000)}s`,
          currentUsage: usage,
          limit: config.maxImplicitSignalsPerUserPerHour,
          quotaType: 'signal_rate_limit',
          resetAt: new Date(lastSignalTime.getTime() + config.minTimeBetweenSignalsMs),
        };
      }
    }
    
    return {
      allowed: true,
      currentUsage: usage,
      limit: config.maxImplicitSignalsPerUserPerHour,
      quotaType: 'user_signal_hourly',
      resetAt: this.getNextResetTime('hour'),
    };
  }
  
  /**
   * Check if user can submit a correction
   */
  async checkCorrectionQuota(tenantId: string, userId: string): Promise<QuotaCheckResult> {
    const config = await this.getQuotaConfig(tenantId);
    if (!config.quotasEnabled) {
      return { allowed: true, currentUsage: 0, limit: Infinity, quotaType: 'correction', resetAt: new Date() };
    }
    
    const usage = await this.getUserCorrectionCount(tenantId, userId, 'day');
    if (usage >= config.maxCorrectionsPerUserPerDay) {
      const resetAt = this.getNextResetTime('day');
      return {
        allowed: false,
        reason: `Daily correction limit reached (${config.maxCorrectionsPerUserPerDay}/day)`,
        currentUsage: usage,
        limit: config.maxCorrectionsPerUserPerDay,
        quotaType: 'user_correction_daily',
        resetAt,
      };
    }
    
    return {
      allowed: true,
      currentUsage: usage,
      limit: config.maxCorrectionsPerUserPerDay,
      quotaType: 'user_correction_daily',
      resetAt: this.getNextResetTime('day'),
    };
  }
  
  /**
   * Check if tenant can trigger a training job
   */
  async checkTrainingJobQuota(tenantId: string): Promise<QuotaCheckResult> {
    const config = await this.getQuotaConfig(tenantId);
    if (!config.quotasEnabled) {
      return { allowed: true, currentUsage: 0, limit: Infinity, quotaType: 'training_job', resetAt: new Date() };
    }
    
    const usage = await this.getTenantTrainingJobCount(tenantId, 'week');
    if (usage >= config.maxTrainingJobsPerWeek) {
      const resetAt = this.getNextResetTime('week');
      return {
        allowed: false,
        reason: `Weekly training job limit reached (${config.maxTrainingJobsPerWeek}/week)`,
        currentUsage: usage,
        limit: config.maxTrainingJobsPerWeek,
        quotaType: 'tenant_training_weekly',
        resetAt,
      };
    }
    
    return {
      allowed: true,
      currentUsage: usage,
      limit: config.maxTrainingJobsPerWeek,
      quotaType: 'tenant_training_weekly',
      resetAt: this.getNextResetTime('week'),
    };
  }
  
  /**
   * Get quota usage summary for a user
   */
  async getUserQuotaUsage(tenantId: string, userId: string): Promise<QuotaUsage> {
    const config = await this.getQuotaConfig(tenantId);
    
    const [candidates, signals, corrections] = await Promise.all([
      this.getUserCandidateCount(tenantId, userId, 'day'),
      this.getUserSignalCount(tenantId, userId, 'hour'),
      this.getUserCorrectionCount(tenantId, userId, 'day'),
    ]);
    
    const quotaLimitReached = 
      candidates >= config.maxCandidatesPerUserPerDay ||
      signals >= config.maxImplicitSignalsPerUserPerHour ||
      corrections >= config.maxCorrectionsPerUserPerDay;
    
    return {
      tenantId,
      userId,
      period: 'day',
      candidatesCreated: candidates,
      implicitSignals: signals,
      corrections,
      trainingJobs: 0,
      quotaLimitReached,
      nextResetAt: this.getNextResetTime('day'),
    };
  }
  
  /**
   * Get quota usage summary for tenant
   */
  async getTenantQuotaUsage(tenantId: string): Promise<QuotaUsage> {
    const config = await this.getQuotaConfig(tenantId);
    
    const [candidates, trainingJobs] = await Promise.all([
      this.getTenantCandidateCount(tenantId, 'day'),
      this.getTenantTrainingJobCount(tenantId, 'week'),
    ]);
    
    const quotaLimitReached = 
      candidates >= config.maxCandidatesPerTenantPerDay ||
      trainingJobs >= config.maxTrainingJobsPerWeek;
    
    return {
      tenantId,
      period: 'day',
      candidatesCreated: candidates,
      implicitSignals: 0,
      corrections: 0,
      trainingJobs,
      quotaLimitReached,
      nextResetAt: this.getNextResetTime('day'),
    };
  }
  
  /**
   * Detect suspicious patterns (gaming attempts)
   */
  async detectSuspiciousActivity(tenantId: string, userId: string): Promise<{
    suspicious: boolean;
    reasons: string[];
    riskScore: number;
  }> {
    const reasons: string[] = [];
    let riskScore = 0;
    
    // Check for burst activity
    const recentSignals = await this.getUserSignalCount(tenantId, userId, 'hour');
    if (recentSignals > 50) {
      reasons.push(`High signal volume: ${recentSignals} in 1 hour`);
      riskScore += 30;
    }
    
    // Check for repetitive patterns
    const repetitiveResult = await executeStatement(
      `SELECT signal_type, COUNT(*) as count
       FROM implicit_feedback_signals
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid 
         AND created_at >= NOW() - INTERVAL '1 hour'
       GROUP BY signal_type
       HAVING COUNT(*) > 20`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );
    
    if (repetitiveResult.rows?.length) {
      for (const row of repetitiveResult.rows) {
        reasons.push(`Repetitive ${row.signal_type}: ${row.count} times`);
        riskScore += 20;
      }
    }
    
    // Check for abnormal correction rate
    const corrections = await this.getUserCorrectionCount(tenantId, userId, 'day');
    if (corrections > 20) {
      reasons.push(`High correction count: ${corrections}/day`);
      riskScore += 25;
    }
    
    return {
      suspicious: riskScore >= 50,
      reasons,
      riskScore: Math.min(riskScore, 100),
    };
  }
  
  // ==========================================================================
  // Config Management
  // ==========================================================================
  
  async getQuotaConfig(tenantId: string): Promise<LearningQuotaConfig> {
    const result = await executeStatement(
      `SELECT * FROM learning_quota_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    if (!result.rows?.length) {
      // Return defaults
      return {
        tenantId,
        quotasEnabled: true,
        maxCandidatesPerUserPerDay: 50,
        maxImplicitSignalsPerUserPerHour: 100,
        maxCorrectionsPerUserPerDay: 20,
        maxCandidatesPerTenantPerDay: 1000,
        maxTrainingJobsPerWeek: 7,
        minTimeBetweenSignalsMs: 1000,
        blockSuspiciousPatterns: true,
      };
    }
    
    const row = result.rows[0];
    return {
      tenantId,
      quotasEnabled: row.quotas_enabled !== false,
      maxCandidatesPerUserPerDay: Number(row.max_candidates_per_user_per_day || 50),
      maxImplicitSignalsPerUserPerHour: Number(row.max_implicit_signals_per_user_per_hour || 100),
      maxCorrectionsPerUserPerDay: Number(row.max_corrections_per_user_per_day || 20),
      maxCandidatesPerTenantPerDay: Number(row.max_candidates_per_tenant_per_day || 1000),
      maxTrainingJobsPerWeek: Number(row.max_training_jobs_per_week || 7),
      minTimeBetweenSignalsMs: Number(row.min_time_between_signals_ms || 1000),
      blockSuspiciousPatterns: row.block_suspicious_patterns !== false,
    };
  }
  
  async updateQuotaConfig(tenantId: string, updates: Partial<LearningQuotaConfig>): Promise<LearningQuotaConfig> {
    await executeStatement(
      `INSERT INTO learning_quota_config (tenant_id, quotas_enabled, max_candidates_per_user_per_day,
         max_implicit_signals_per_user_per_hour, max_corrections_per_user_per_day,
         max_candidates_per_tenant_per_day, max_training_jobs_per_week,
         min_time_between_signals_ms, block_suspicious_patterns)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tenant_id) DO UPDATE SET
         quotas_enabled = COALESCE($2, learning_quota_config.quotas_enabled),
         max_candidates_per_user_per_day = COALESCE($3, learning_quota_config.max_candidates_per_user_per_day),
         max_implicit_signals_per_user_per_hour = COALESCE($4, learning_quota_config.max_implicit_signals_per_user_per_hour),
         max_corrections_per_user_per_day = COALESCE($5, learning_quota_config.max_corrections_per_user_per_day),
         max_candidates_per_tenant_per_day = COALESCE($6, learning_quota_config.max_candidates_per_tenant_per_day),
         max_training_jobs_per_week = COALESCE($7, learning_quota_config.max_training_jobs_per_week),
         min_time_between_signals_ms = COALESCE($8, learning_quota_config.min_time_between_signals_ms),
         block_suspicious_patterns = COALESCE($9, learning_quota_config.block_suspicious_patterns),
         updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        stringParam('quotasEnabled', String(updates.quotasEnabled ?? true)),
        longParam('maxCandidatesPerUserPerDay', updates.maxCandidatesPerUserPerDay || 50),
        longParam('maxImplicitSignalsPerUserPerHour', updates.maxImplicitSignalsPerUserPerHour || 100),
        longParam('maxCorrectionsPerUserPerDay', updates.maxCorrectionsPerUserPerDay || 20),
        longParam('maxCandidatesPerTenantPerDay', updates.maxCandidatesPerTenantPerDay || 1000),
        longParam('maxTrainingJobsPerWeek', updates.maxTrainingJobsPerWeek || 7),
        longParam('minTimeBetweenSignalsMs', updates.minTimeBetweenSignalsMs || 1000),
        stringParam('blockSuspiciousPatterns', String(updates.blockSuspiciousPatterns ?? true)),
      ]
    );
    
    return this.getQuotaConfig(tenantId);
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private async getUserCandidateCount(tenantId: string, userId: string, period: 'hour' | 'day' | 'week'): Promise<number> {
    const interval = period === 'hour' ? '1 hour' : period === 'day' ? '24 hours' : '7 days';
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM learning_candidates 
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND created_at >= NOW() - INTERVAL '${interval}'`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );
    return Number(result.rows?.[0]?.count || 0);
  }
  
  private async getTenantCandidateCount(tenantId: string, period: 'hour' | 'day' | 'week'): Promise<number> {
    const interval = period === 'hour' ? '1 hour' : period === 'day' ? '24 hours' : '7 days';
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM learning_candidates 
       WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '${interval}'`,
      [stringParam('tenantId', tenantId)]
    );
    return Number(result.rows?.[0]?.count || 0);
  }
  
  private async getUserSignalCount(tenantId: string, userId: string, period: 'hour' | 'day'): Promise<number> {
    const interval = period === 'hour' ? '1 hour' : '24 hours';
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM implicit_feedback_signals 
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND created_at >= NOW() - INTERVAL '${interval}'`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );
    return Number(result.rows?.[0]?.count || 0);
  }
  
  private async getUserCorrectionCount(tenantId: string, userId: string, period: 'day'): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM learning_candidates 
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid 
         AND candidate_type = 'correction' AND created_at >= NOW() - INTERVAL '24 hours'`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );
    return Number(result.rows?.[0]?.count || 0);
  }
  
  private async getTenantTrainingJobCount(tenantId: string, period: 'week'): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM lora_evolution_jobs 
       WHERE tenant_id = $1::uuid AND scheduled_at >= NOW() - INTERVAL '7 days'`,
      [stringParam('tenantId', tenantId)]
    );
    return Number(result.rows?.[0]?.count || 0);
  }
  
  private async getLastSignalTime(tenantId: string, userId: string): Promise<Date | null> {
    const result = await executeStatement(
      `SELECT MAX(created_at) as last_signal FROM implicit_feedback_signals 
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );
    if (!result.rows?.[0]?.last_signal) return null;
    return new Date(result.rows[0].last_signal as string);
  }
  
  private getNextResetTime(period: 'hour' | 'day' | 'week'): Date {
    const now = new Date();
    if (period === 'hour') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
    } else if (period === 'day') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    } else {
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday, 0, 0, 0);
    }
  }
}

export const learningQuotasService = new LearningQuotasService();
