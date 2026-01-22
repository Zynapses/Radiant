/**
 * Infrastructure Tier Service
 * 
 * Manages Cato infrastructure tiers for multi-tenant deployments.
 * Controls scaling, resource allocation, and cost management.
 */

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
  private states: Map<string, TierState> = new Map();
  private changes: Map<string, TierChange[]> = new Map();

  async getCurrentState(tenantId: string): Promise<TierState> {
    let state = this.states.get(tenantId);
    if (!state) {
      state = {
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
      this.states.set(tenantId, state);
    }
    return state;
  }

  async getTierConfigs(tenantId: string): Promise<TierConfig[]> {
    // In production, this would fetch tenant-specific pricing
    return DEFAULT_TIER_CONFIGS;
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

    const change: TierChange = {
      id: `change_${Date.now()}`,
      tenantId,
      fromTier: state.currentTier,
      toTier: targetTier,
      status: 'in_progress',
      reason,
      initiatedBy,
      startedAt: new Date(),
      completedAt: null,
      errorMessage: null,
    };

    const tenantChanges = this.changes.get(tenantId) || [];
    tenantChanges.push(change);
    this.changes.set(tenantId, tenantChanges);

    // Update state
    state.targetTier = targetTier;
    state.transitionStatus = targetTier > state.currentTier ? 'upgrading' : 'downgrading';

    // Simulate immediate completion for now
    await this.completeTierChange(tenantId, change.id);

    return change;
  }

  async completeTierChange(tenantId: string, changeId: string): Promise<void> {
    const state = await this.getCurrentState(tenantId);
    const tenantChanges = this.changes.get(tenantId) || [];
    const change = tenantChanges.find(c => c.id === changeId);

    if (change && state.targetTier) {
      change.status = 'completed';
      change.completedAt = new Date();
      
      state.currentTier = state.targetTier;
      state.targetTier = null;
      state.transitionStatus = 'stable';
      state.lastChangedAt = new Date();
      state.nextChangeAllowedAt = new Date(Date.now() + state.cooldownHours * 60 * 60 * 1000);
      
      const config = DEFAULT_TIER_CONFIGS.find(c => c.tierName === state.currentTier);
      state.estimatedMonthlyCost = config?.monthlyBaseCost || 0;
    }
  }

  async cancelTierChange(tenantId: string, changeId: string, reason: string): Promise<void> {
    const state = await this.getCurrentState(tenantId);
    const tenantChanges = this.changes.get(tenantId) || [];
    const change = tenantChanges.find(c => c.id === changeId);

    if (change) {
      change.status = 'rolled_back';
      change.completedAt = new Date();
      change.errorMessage = reason;
      
      state.targetTier = null;
      state.transitionStatus = 'stable';
    }
  }

  async updateCooldownHours(tenantId: string, hours: number): Promise<void> {
    const state = await this.getCurrentState(tenantId);
    state.cooldownHours = hours;
  }

  async getChangeHistory(tenantId: string, limit: number = 50): Promise<TierChange[]> {
    const tenantChanges = this.changes.get(tenantId) || [];
    return tenantChanges.slice(-limit).reverse();
  }

  async getUsageMetrics(tenantId: string): Promise<{
    currentRequests: number;
    tokensUsedToday: number;
    storageUsedGb: number;
    costToDate: number;
  }> {
    return {
      currentRequests: Math.floor(Math.random() * 10),
      tokensUsedToday: Math.floor(Math.random() * 50000),
      storageUsedGb: Math.random() * 5,
      costToDate: Math.random() * 50,
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
    
    // In production, validate the token
    if (!confirmationToken.startsWith('confirm_')) {
      return { status: 'REJECTED', errors: ['Invalid confirmation token'] };
    }

    return { status: 'CONFIRMED' };
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
