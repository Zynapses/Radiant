/**
 * RAWS v1.1 - Weight Profile Service
 * Manages weight profiles and resolves weights for selection
 */

import {
  WeightProfile,
  WeightProfileId,
  Domain,
  ScoringWeights,
  SystemType,
  WEIGHT_PROFILES,
  DOMAIN_PROFILE_MAP,
} from './types.js';

export class WeightProfileService {
  private customProfiles: Map<string, WeightProfile> = new Map();

  constructor() {
    // System profiles are loaded from constants
  }

  /**
   * Get a system profile by ID
   */
  getSystemProfile(id: WeightProfileId): WeightProfile {
    const profile = WEIGHT_PROFILES[id];
    if (!profile) {
      throw new Error(`Unknown system profile: ${id}`);
    }
    return profile;
  }

  /**
   * Get profile for a domain
   */
  getDomainProfile(domain: Domain): WeightProfile {
    const profileId = DOMAIN_PROFILE_MAP[domain];
    return this.getSystemProfile(profileId);
  }

  /**
   * Get any profile (system or custom)
   */
  getProfile(id: string): WeightProfile | null {
    // Check system profiles first
    if (id in WEIGHT_PROFILES) {
      return WEIGHT_PROFILES[id as WeightProfileId];
    }

    // Check custom profiles
    return this.customProfiles.get(id) || null;
  }

  /**
   * Resolve weights based on request context
   * Priority: explicit profile > optimization preference > domain > system type > default
   */
  resolveWeights(options: {
    weightProfileId?: WeightProfileId | string;
    optimizeFor?: 'quality' | 'cost' | 'latency';
    domain?: Domain;
    systemType?: SystemType;
  }): { weights: ScoringWeights; profileId: WeightProfileId; profile: WeightProfile } {
    
    // 1. Explicit weight profile takes precedence
    if (options.weightProfileId) {
      const profile = this.getProfile(options.weightProfileId);
      if (profile) {
        return {
          weights: profile.weights,
          profileId: profile.id,
          profile
        };
      }
    }

    // 2. Optimization preference mapping
    if (options.optimizeFor) {
      switch (options.optimizeFor) {
        case 'quality':
          return this.getProfileResult('QUALITY_FIRST');
        case 'cost':
          return this.getProfileResult('COST_OPTIMIZED');
        case 'latency':
          return this.getProfileResult('LATENCY_CRITICAL');
      }
    }

    // 3. Domain-specific profile
    if (options.domain && options.domain !== 'general') {
      const profile = this.getDomainProfile(options.domain);
      return {
        weights: profile.weights,
        profileId: profile.id,
        profile
      };
    }

    // 4. SOFAI system type profile
    if (options.systemType) {
      return this.getProfileResult(options.systemType);
    }

    // 5. Default to BALANCED
    return this.getProfileResult('BALANCED');
  }

  /**
   * Get constraints from profile
   */
  getProfileConstraints(profile: WeightProfile): {
    minQualityScore?: number;
    maxPriceMultiplier?: number;
    maxLatencyMs?: number;
    requiredCapabilities?: string[];
    requiredCompliance?: string[];
    forcedSystemType?: SystemType;
    requireTruthEngine?: boolean;
    requireSourceCitation?: boolean;
    maxEcdThreshold?: number;
  } {
    return {
      minQualityScore: profile.minQualityScore,
      maxPriceMultiplier: profile.maxPriceMultiplier,
      maxLatencyMs: profile.maxLatencyMs,
      requiredCapabilities: profile.requiredCapabilities,
      requiredCompliance: profile.requiredCompliance,
      forcedSystemType: profile.forcedSystemType,
      requireTruthEngine: profile.requireTruthEngine,
      requireSourceCitation: profile.requireSourceCitation,
      maxEcdThreshold: profile.maxEcdThreshold,
    };
  }

  /**
   * Validate that weights sum to 1.0
   */
  validateWeights(weights: ScoringWeights): boolean {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1.0) < 0.01;
  }

  /**
   * Create custom profile (for tenant-specific profiles)
   */
  createCustomProfile(
    id: string,
    displayName: string,
    description: string,
    weights: ScoringWeights,
    options?: Partial<Omit<WeightProfile, 'id' | 'displayName' | 'description' | 'weights'>>
  ): WeightProfile {
    if (!this.validateWeights(weights)) {
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      throw new Error(`Weights must sum to 1.0, got ${sum}`);
    }

    const profile: WeightProfile = {
      id: id as WeightProfileId,
      displayName,
      description,
      category: options?.category || 'optimization',
      weights,
      isSystemProfile: false,
      isDefault: false,
      ...options
    };

    this.customProfiles.set(id, profile);
    return profile;
  }

  /**
   * List all available profiles
   */
  listProfiles(): WeightProfile[] {
    const systemProfiles = Object.values(WEIGHT_PROFILES);
    const custom = Array.from(this.customProfiles.values());
    return [...systemProfiles, ...custom];
  }

  /**
   * Get profiles by category
   */
  getProfilesByCategory(category: 'optimization' | 'domain' | 'sofai'): WeightProfile[] {
    return this.listProfiles().filter(p => p.category === category);
  }

  private getProfileResult(id: WeightProfileId): {
    weights: ScoringWeights;
    profileId: WeightProfileId;
    profile: WeightProfile;
  } {
    const profile = this.getSystemProfile(id);
    return {
      weights: profile.weights,
      profileId: id,
      profile
    };
  }
}

export const weightProfileService = new WeightProfileService();
