/**
 * RADIANT v4.18.0 - Infrastructure Tiers
 * SINGLE SOURCE OF TRUTH
 */
import type { TierConfig, TierLevel, TierName } from '../types';
export declare const TIER_NAMES: Record<TierLevel, TierName>;
export declare const TIER_CONFIGS: Record<TierLevel, TierConfig>;
export declare function getTierConfig(tier: TierLevel): TierConfig;
export declare function getTierName(tier: TierLevel): TierName;
export declare function validateTierForEnvironment(tier: TierLevel, environment: string): void;
export declare function getFeatureFlagsForTier(tier: TierLevel): {
    selfHostedModels: boolean;
    multiRegion: boolean;
    waf: boolean;
    guardDuty: boolean;
    hipaaCompliance: boolean;
    advancedAnalytics: boolean;
    customBranding: boolean;
    sla: boolean;
};
//# sourceMappingURL=tiers.d.ts.map