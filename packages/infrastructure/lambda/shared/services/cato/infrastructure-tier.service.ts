/**
 * Infrastructure Tier Service
 * 
 * Manages Cato infrastructure tiers for multi-tenant deployments.
 * Controls scaling, resource allocation, and cost management.
 * 
 * Uses database persistence for state that must survive Lambda invocations.
 */

import { executeStatement } from '../../database/aurora-client';
import { logger } from '../../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export type InfrastructureTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'dedicated';

export interface TierConfig {
  tierName: InfrastructureTier;
  displayName: string;
  description: string;
  monthlyBaseCost: number;
  maxConcurrentRequests: number;
  maxTokensPerMinute: number;
  maxStorageGb: number;
  selfHostedModelsEnabled: boolean;
  dedicatedResourcesEnabled: boolean;
  prioritySupport: boolean;
  slaUptime: number;
  features: string[];
  sagemakerShadowSelfMinInstances?: number;
  sagemakerShadowSelfMaxInstances?: number;
  estimatedMonthlyCost?: number;
}

export interface TierState {
  tenantId: string;
  currentTier: InfrastructureTier;
  targetTier: InfrastructureTier | null;
  transitionStatus: 'stable' | 'upgrading' | 'downgrading' | 'pending';
  lastChangedAt: Date;
  lastChangedBy: string;
  cooldownHours: number;
  nextChangeAllowedAt: Date;
  estimatedMonthlyCost: number;
  actualMtdCost: number;
}

export interface TierChange {
  id: string;
  tenantId: string;
  fromTier: InfrastructureTier;
  toTier: InfrastructureTier;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  reason: string;
  initiatedBy: string;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_TIER_CONFIGS: TierConfig[] = [
  {
    tierName: 'free',
    displayName: 'Free',
    description: 'For exploration and testing',
    monthlyBaseCost: 0,
    maxConcurrentRequests: 2,
    maxTokensPerMinute: 10000,
    maxStorageGb: 1,
    selfHostedModelsEnabled: false,
    dedicatedResourcesEnabled: false,
    prioritySupport: false,
    slaUptime: 0.95,
    features: ['basic_chat', 'limited_models'],
  },
  {
    tierName: 'starter',
    displayName: 'Starter',
    description: 'For individuals and small teams',
    monthlyBaseCost: 29,
    maxConcurrentRequests: 5,
    maxTokensPerMinute: 50000,
    maxStorageGb: 10,
    selfHostedModelsEnabled: false,
    dedicatedResourcesEnabled: false,
    prioritySupport: false,
    slaUptime: 0.99,
    features: ['basic_chat', 'all_external_models', 'basic_analytics'],
  },
  {
    tierName: 'professional',
    displayName: 'Professional',
    description: 'For growing businesses',
    monthlyBaseCost: 99,
    maxConcurrentRequests: 20,
    maxTokensPerMinute: 200000,
    maxStorageGb: 100,
    selfHostedModelsEnabled: true,
    dedicatedResourcesEnabled: false,
    prioritySupport: true,
    slaUptime: 0.995,
    features: ['all_features', 'self_hosted_models', 'advanced_analytics', 'api_access'],
  },
  {
    tierName: 'enterprise',
    displayName: 'Enterprise',
    description: 'For large organizations',
    monthlyBaseCost: 499,
    maxConcurrentRequests: 100,
    maxTokensPerMinute: 1000000,
    maxStorageGb: 1000,
    selfHostedModelsEnabled: true,
    dedicatedResourcesEnabled: true,
    prioritySupport: true,
    slaUptime: 0.999,
    features: ['all_features', 'dedicated_support', 'custom_models', 'sso', 'audit_logs'],
  },
  {
    tierName: 'dedicated',
    displayName: 'Dedicated',
    description: 'Fully isolated infrastructure',
    monthlyBaseCost: 2999,
    maxConcurrentRequests: 500,
    maxTokensPerMinute: 5000000,
    maxStorageGb: 10000,
    selfHostedModelsEnabled: true,
    dedicatedResourcesEnabled: true,
    prioritySupport: true,
    slaUptime: 0.9999,
    features: ['all_features', 'dedicated_infrastructure', 'custom_sla', 'on_premise_option'],
  },
];

// ============================================================================
// Service Implementation
// ============================================================================

class InfrastructureTierService {
  async getCurrentState(tenantId: string): Promise<TierState> {
    try {
      const result = await executeStatement(
        `SELECT current_tier, target_tier, transition_status, last_changed_at, 
                last_changed_by, cooldown_hours, next_change_allowed_at,
                estimated_monthly_cost, actual_mtd_cost
         FROM infrastructure_tier WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length === 0) {
        // Initialize state for new tenant
        await this.initializeState(tenantId);
        return this.getCurrentState(tenantId);
      }

      const row = result.rows[0] as Record<string, unknown>;
      return {
        tenantId,
        currentTier: (row.current_tier as string || 'free').toLowerCase() as InfrastructureTier,
        targetTier: row.target_tier ? (row.target_tier as string).toLowerCase() as InfrastructureTier : null,
        transitionStatus: (row.transition_status as string || 'stable') as TierState['transitionStatus'],
        lastChangedAt: new Date(row.last_changed_at as string || Date.now()),
        lastChangedBy: row.last_changed_by as string || 'system',
        cooldownHours: row.cooldown_hours as number || 24,
        nextChangeAllowedAt: new Date(row.next_change_allowed_at as string || Date.now()),
        estimatedMonthlyCost: row.estimated_monthly_cost as number || 0,
        actualMtdCost: row.actual_mtd_cost as number || 0,
      };
    } catch (error) {
      logger.warn('Failed to fetch tier state from database, using defaults', { tenantId, error: String(error) });
      return this.createDefaultState(tenantId);
    }
  }

  private async initializeState(tenantId: string): Promise<void> {
    await executeStatement(
      `INSERT INTO infrastructure_tier (tenant_id, current_tier, transition_status, estimated_monthly_cost)
       VALUES ($1, 'FREE', 'stable', 0)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId]
    );
  }

  private createDefaultState(tenantId: string): TierState {
    return {
      tenantId,
      currentTier: 'free',
      targetTier: null,
      transitionStatus: 'stable',
      lastChangedAt: new Date(),
      lastChangedBy: 'system',
      cooldownHours: 24,
      nextChangeAllowedAt: new Date(),
      estimatedMonthlyCost: 0,
      actualMtdCost: 0,
    };
  }

  async getTierConfigs(tenantId: string): Promise<TierConfig[]> {
    // Fetch tenant-specific pricing overrides from database
    try {
      const result = await executeStatement(
        `SELECT tier_name, monthly_base_cost_override, max_concurrent_requests_override,
                max_tokens_per_minute_override, max_storage_gb_override, custom_features,
                discount_percent
         FROM tenant_tier_pricing
         WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
      );

      if (result.rows.length === 0) {
        // No custom pricing, return defaults
        return DEFAULT_TIER_CONFIGS;
      }

      // Merge overrides with defaults
      const overrides = new Map<string, Record<string, unknown>>();
      for (const row of result.rows as Record<string, unknown>[]) {
        overrides.set(row.tier_name as string, row);
      }

      return DEFAULT_TIER_CONFIGS.map(config => {
        const override = overrides.get(config.tierName.toUpperCase());
        if (!override) return config;

        const discountMultiplier = 1 - ((override.discount_percent as number) || 0) / 100;
        
        return {
          ...config,
          monthlyBaseCost: override.monthly_base_cost_override != null 
            ? (override.monthly_base_cost_override as number) 
            : config.monthlyBaseCost * discountMultiplier,
          maxConcurrentRequests: override.max_concurrent_requests_override != null 
            ? (override.max_concurrent_requests_override as number) 
            : config.maxConcurrentRequests,
          maxTokensPerMinute: override.max_tokens_per_minute_override != null 
            ? (override.max_tokens_per_minute_override as number) 
            : config.maxTokensPerMinute,
          maxStorageGb: override.max_storage_gb_override != null 
            ? (override.max_storage_gb_override as number) 
            : config.maxStorageGb,
          features: override.custom_features 
            ? [...config.features, ...(override.custom_features as string[])]
            : config.features,
        };
      });
    } catch (error) {
      logger.warn('Failed to fetch tenant-specific pricing, using defaults', { tenantId, error });
      return DEFAULT_TIER_CONFIGS;
    }
  }

  async getAllTierConfigs(): Promise<TierConfig[]> {
    return DEFAULT_TIER_CONFIGS;
  }

  async initiateTierChange(
    tenantId: string,
    targetTier: InfrastructureTier,
    reason: string,
    initiatedBy: string
  ): Promise<TierChange> {
    const state = await this.getCurrentState(tenantId);
    
    if (new Date() < state.nextChangeAllowedAt) {
      throw new Error('Tier change is in cooldown period');
    }

    const transitionStatus = this.compareTiers(targetTier, state.currentTier) > 0 ? 'upgrading' : 'downgrading';

    // Insert change log entry
    const changeResult = await executeStatement(
      `INSERT INTO tier_change_log (tenant_id, from_tier, to_tier, status, reason, initiated_by, started_at)
       VALUES ($1, $2, $3, 'in_progress', $4, $5, NOW())
       RETURNING id, started_at`,
      [tenantId, state.currentTier.toUpperCase(), targetTier.toUpperCase(), reason, initiatedBy]
    );

    const changeRow = changeResult.rows[0] as Record<string, unknown>;
    const changeId = changeRow.id as string;

    // Update tier state
    await executeStatement(
      `UPDATE infrastructure_tier 
       SET target_tier = $2, transition_status = $3, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, targetTier.toUpperCase(), transitionStatus]
    );

    const change: TierChange = {
      id: changeId,
      tenantId,
      fromTier: state.currentTier,
      toTier: targetTier,
      status: 'in_progress',
      reason,
      initiatedBy,
      startedAt: new Date(changeRow.started_at as string),
      completedAt: null,
      errorMessage: null,
    };

    // Complete the tier change
    await this.completeTierChange(tenantId, changeId);

    return change;
  }

  private compareTiers(a: InfrastructureTier, b: InfrastructureTier): number {
    const order: InfrastructureTier[] = ['free', 'starter', 'professional', 'enterprise', 'dedicated'];
    return order.indexOf(a) - order.indexOf(b);
  }

  async completeTierChange(tenantId: string, changeId: string): Promise<void> {
    // Get current state to determine target tier
    const stateResult = await executeStatement(
      `SELECT target_tier, cooldown_hours FROM infrastructure_tier WHERE tenant_id = $1`,
      [tenantId]
    );

    if (stateResult.rows.length === 0) return;

    const row = stateResult.rows[0] as Record<string, unknown>;
    const targetTier = row.target_tier as string;
    const cooldownHours = row.cooldown_hours as number || 24;

    if (!targetTier) return;

    const config = DEFAULT_TIER_CONFIGS.find(c => c.tierName === targetTier.toLowerCase());
    const estimatedCost = config?.monthlyBaseCost || 0;

    // Update change log
    await executeStatement(
      `UPDATE tier_change_log SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [changeId]
    );

    // Update tier state
    await executeStatement(
      `UPDATE infrastructure_tier 
       SET current_tier = $2, target_tier = NULL, transition_status = 'stable',
           last_changed_at = NOW(), next_change_allowed_at = NOW() + ($3 || ' hours')::interval,
           estimated_monthly_cost = $4, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, targetTier, cooldownHours, estimatedCost]
    );
  }

  async cancelTierChange(tenantId: string, changeId: string, reason: string): Promise<void> {
    // Update change log
    await executeStatement(
      `UPDATE tier_change_log SET status = 'rolled_back', completed_at = NOW(), error_message = $2
       WHERE id = $1`,
      [changeId, reason]
    );

    // Reset tier state
    await executeStatement(
      `UPDATE infrastructure_tier 
       SET target_tier = NULL, transition_status = 'stable', updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId]
    );
  }

  async updateCooldownHours(tenantId: string, hours: number): Promise<void> {
    await executeStatement(
      `UPDATE infrastructure_tier SET cooldown_hours = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId, hours]
    );
  }

  async getChangeHistory(tenantId: string, limit: number = 50): Promise<TierChange[]> {
    const result = await executeStatement(
      `SELECT id, from_tier, to_tier, status, reason, initiated_by, started_at, completed_at, error_message
       FROM tier_change_log WHERE tenant_id = $1
       ORDER BY started_at DESC LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId,
      fromTier: (row.from_tier as string).toLowerCase() as InfrastructureTier,
      toTier: (row.to_tier as string).toLowerCase() as InfrastructureTier,
      status: row.status as TierChange['status'],
      reason: row.reason as string,
      initiatedBy: row.initiated_by as string,
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
      errorMessage: row.error_message as string | null,
    }));
  }

  async getUsageMetrics(tenantId: string): Promise<{
    currentRequests: number;
    tokensUsedToday: number;
    storageUsedGb: number;
    costToDate: number;
  }> {
    try {
      // Get actual usage from database
      const usageResult = await executeStatement(
        `SELECT 
           COALESCE((SELECT COUNT(*) FROM usage_records WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 hour'), 0) as current_requests,
           COALESCE((SELECT SUM(tokens_used) FROM usage_records WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day'), 0) as tokens_today,
           COALESCE((SELECT SUM(size_bytes) / 1073741824.0 FROM storage_items WHERE tenant_id = $1), 0) as storage_gb,
           COALESCE((SELECT SUM(cost) FROM usage_records WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('month', NOW())), 0) as cost_mtd`,
        [tenantId]
      );

      if (usageResult.rows.length > 0) {
        const row = usageResult.rows[0] as Record<string, unknown>;
        return {
          currentRequests: Number(row.current_requests) || 0,
          tokensUsedToday: Number(row.tokens_today) || 0,
          storageUsedGb: Number(row.storage_gb) || 0,
          costToDate: Number(row.cost_mtd) || 0,
        };
      }
    } catch (error) {
      logger.warn('Failed to fetch usage metrics from database', { tenantId, error: String(error) });
    }

    return {
      currentRequests: 0,
      tokensUsedToday: 0,
      storageUsedGb: 0,
      costToDate: 0,
    };
  }

  async getTierComparison(tenantId: string): Promise<TierConfig[]> {
    return DEFAULT_TIER_CONFIGS;
  }

  async getTierConfig(tenantId: string, tierName: string): Promise<TierConfig | null> {
    return DEFAULT_TIER_CONFIGS.find(c => c.tierName === tierName) || null;
  }

  async updateTierConfig(tenantId: string, tierName: string, updates: Partial<TierConfig>): Promise<void> {
    const config = DEFAULT_TIER_CONFIGS.find(c => c.tierName === tierName);
    if (config) {
      Object.assign(config, updates);
    }
  }

  async requestTierChange(
    tenantId: string,
    requestedBy: string,
    options: { targetTier: InfrastructureTier; reason: string; bypassCooldown?: boolean }
  ): Promise<{ status: string; confirmationToken?: string; errors?: string[] }> {
    const state = await this.getCurrentState(tenantId);
    
    if (!options.bypassCooldown && new Date() < state.nextChangeAllowedAt) {
      return { status: 'REJECTED', errors: ['Tier change is in cooldown period'] };
    }

    const confirmationToken = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { status: 'PENDING_CONFIRMATION', confirmationToken };
  }

  async confirmTierChange(
    tenantId: string,
    confirmationToken: string,
    confirmedBy: string
  ): Promise<{ status: string; errors?: string[] }> {
    const state = await this.getCurrentState(tenantId);
    
    // Validate the confirmation token
    const tokenValidation = await this.validateConfirmationToken(tenantId, confirmationToken, confirmedBy);
    if (!tokenValidation.valid) {
      return { status: 'REJECTED', errors: tokenValidation.errors };
    }

    // Mark token as used
    await executeStatement(
      `UPDATE infrastructure_confirmation_tokens 
       SET used_at = NOW(), used_by = $3 
       WHERE tenant_id = $1 AND token = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'token', value: { stringValue: confirmationToken } },
        { name: 'confirmedBy', value: { stringValue: confirmedBy } },
      ]
    );

    return { status: 'CONFIRMED' };
  }

  /**
   * Validate a confirmation token for infrastructure changes
   */
  private async validateConfirmationToken(
    tenantId: string,
    token: string,
    userId: string
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    
    // Check token format
    if (!token || !token.startsWith('confirm_')) {
      errors.push('Invalid token format');
      return { valid: false, errors };
    }
    
    // Check token exists and is valid in database
    const result = await executeStatement(
      `SELECT id, expires_at, used_at, allowed_users, action_type, created_by
       FROM infrastructure_confirmation_tokens
       WHERE tenant_id = $1 AND token = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'token', value: { stringValue: token } },
      ]
    );
    
    if (result.rows.length === 0) {
      errors.push('Token not found or expired');
      return { valid: false, errors };
    }
    
    const tokenRecord = result.rows[0];
    
    // Check if already used
    if (tokenRecord.used_at) {
      errors.push('Token has already been used');
      return { valid: false, errors };
    }
    
    // Check expiration
    if (new Date(tokenRecord.expires_at) < new Date()) {
      errors.push('Token has expired');
      return { valid: false, errors };
    }
    
    // Check user authorization
    const allowedUsers = tokenRecord.allowed_users as string[] | null;
    if (allowedUsers && allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
      errors.push('User not authorized to use this token');
      return { valid: false, errors };
    }
    
    // Verify token hasn't been tampered with (HMAC validation)
    const expectedPayload = `${tenantId}:${tokenRecord.action_type}:${tokenRecord.created_by}`;
    const crypto = await import('crypto');
    const secret = process.env.CONFIRMATION_TOKEN_SECRET || 'radiant-default-secret';
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(expectedPayload)
      .digest('hex')
      .substring(0, 16);
    
    const tokenSignature = token.replace('confirm_', '').split('_')[0];
    if (tokenSignature !== expectedSignature) {
      errors.push('Token signature verification failed');
      return { valid: false, errors };
    }
    
    return { valid: true };
  }

  async getTransitionStatus(tenantId: string): Promise<{
    isTransitioning: boolean;
    currentPhase: string;
    progress: number;
    estimatedCompletion: Date | null;
  }> {
    const state = await this.getCurrentState(tenantId);
    return {
      isTransitioning: state.transitionStatus !== 'stable',
      currentPhase: state.transitionStatus,
      progress: state.transitionStatus === 'stable' ? 100 : 50,
      estimatedCompletion: state.transitionStatus === 'stable' ? null : new Date(Date.now() + 300000),
    };
  }
}

export const infrastructureTierService = new InfrastructureTierService();
