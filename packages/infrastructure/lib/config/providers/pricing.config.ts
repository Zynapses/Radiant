/**
 * Pricing Configuration - RADIANT v4.18.0
 * Markup rates and cost calculation utilities
 */

// ============================================================================
// MARKUP CONFIGURATION
// ============================================================================

export const EXTERNAL_MARKUP = 1.40;  // 40% markup on external providers
export const SELF_HOSTED_MARKUP = 1.75;  // 75% markup on self-hosted models

// ============================================================================
// TIER PRICING MULTIPLIERS
// ============================================================================

export const TIER_MULTIPLIERS: Record<number, number> = {
  1: 1.0,    // Free tier - standard pricing
  2: 0.95,   // Starter - 5% discount
  3: 0.90,   // Pro - 10% discount
  4: 0.85,   // Team - 15% discount
  5: 0.75,   // Enterprise - 25% discount
};

// ============================================================================
// COST CALCULATION UTILITIES
// ============================================================================

export interface CostBreakdown {
  baseCost: number;
  markup: number;
  tierDiscount: number;
  finalCost: number;
  currency: 'USD';
}

export function calculateFinalCost(
  baseCost: number,
  isExternal: boolean,
  tier: number = 1
): CostBreakdown {
  const markup = isExternal ? EXTERNAL_MARKUP : SELF_HOSTED_MARKUP;
  const tierMultiplier = TIER_MULTIPLIERS[tier] || 1.0;
  const markedUpCost = baseCost * markup;
  const tierDiscount = markedUpCost * (1 - tierMultiplier);
  const finalCost = markedUpCost - tierDiscount;

  return {
    baseCost,
    markup: markedUpCost - baseCost,
    tierDiscount,
    finalCost,
    currency: 'USD',
  };
}

export function formatCost(amount: number, precision: number = 6): string {
  return `$${amount.toFixed(precision)}`;
}

// ============================================================================
// USAGE THRESHOLDS
// ============================================================================

export const USAGE_THRESHOLDS = {
  free: {
    monthlyCredits: 5.00,
    dailyRequests: 100,
    maxConcurrentRequests: 2,
  },
  starter: {
    monthlyCredits: 50.00,
    dailyRequests: 1000,
    maxConcurrentRequests: 5,
  },
  pro: {
    monthlyCredits: 200.00,
    dailyRequests: 10000,
    maxConcurrentRequests: 20,
  },
  team: {
    monthlyCredits: 1000.00,
    dailyRequests: 50000,
    maxConcurrentRequests: 50,
  },
  enterprise: {
    monthlyCredits: -1, // Unlimited
    dailyRequests: -1,
    maxConcurrentRequests: 200,
  },
};

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

export const DEFAULT_RATE_LIMITS = {
  requestsPerMinute: 60,
  tokensPerMinute: 100000,
  requestsPerDay: 10000,
  concurrentRequests: 10,
};

export function getRateLimitsForTier(tier: number): typeof DEFAULT_RATE_LIMITS {
  const multipliers: Record<number, number> = {
    1: 1,
    2: 2,
    3: 5,
    4: 10,
    5: 50,
  };

  const multiplier = multipliers[tier] || 1;

  return {
    requestsPerMinute: DEFAULT_RATE_LIMITS.requestsPerMinute * multiplier,
    tokensPerMinute: DEFAULT_RATE_LIMITS.tokensPerMinute * multiplier,
    requestsPerDay: DEFAULT_RATE_LIMITS.requestsPerDay * multiplier,
    concurrentRequests: Math.min(
      DEFAULT_RATE_LIMITS.concurrentRequests * multiplier,
      200
    ),
  };
}

// ============================================================================
// BILLING PERIODS
// ============================================================================

export type BillingPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

export function getBillingPeriodMs(period: BillingPeriod): number {
  switch (period) {
    case 'hourly':
      return 60 * 60 * 1000;
    case 'daily':
      return 24 * 60 * 60 * 1000;
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000;
    case 'monthly':
      return 30 * 24 * 60 * 60 * 1000;
  }
}
