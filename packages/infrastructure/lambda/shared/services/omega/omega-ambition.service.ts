/**
 * RADIANT OMEGA Ambition Service — Cartridge-Driven Chemical System
 *
 * Reads ALL chemical parameters from ambition_config.json in cartridge.
 *
 * BEFORE: const DOPAMINE_DECAY = 0.99;  // hardcoded
 * AFTER:  const DOPAMINE_DECAY = config.chemicals.dopamine.decay_rate;  // from cartridge
 */

import { createRegisteredLogger } from '../logging-registry.service';
import { type AmbitionConfig, type ChemicalConfig } from './omega-firmware-enforcer.service';

const logger = createRegisteredLogger({
  serviceName: 'omega/ambition',
  category: 'intelligence',
  sourceType: 'application',
});

// ============================================================================
// Factory Defaults — used when no cartridge is loaded
// ============================================================================

const FACTORY_DEFAULT_CONFIG: AmbitionConfig = {
  chemicals: {
    dopamine: {
      initial: 0.5,
      min: 0.0,
      max: 1.0,
      decay_rate: 0.99,
      q_reward_threshold: 0.7,
      reward_on_high_q: 0.05,
    },
    entropy: {
      initial: 0.0,
      min: 0.0,
      max: 1.0,
      growth_rate: 0.01,
      self_analysis_trigger: 0.6,
    },
    curiosity: {
      initial: 0.3,
      min: 0.0,
      max: 1.0,
      decay_rate: 0.995,
      novelty_sensitivity: 0.1,
      exploration_bias: 0.5,
    },
    frustration: {
      initial: 0.0,
      min: 0.0,
      max: 1.0,
      q_frustration_threshold: 0.3,
      growth_on_low_q: 0.03,
      reduction_on_success: 0.1,
      self_analysis_trigger: 0.7,
    },
    satisfaction: {
      initial: 0.5,
      min: 0.0,
      max: 1.0,
      decay_rate: 0.98,
      rfm_accuracy_sensitivity: 0.05,
      rfm_recalibration_trigger: 0.3,
    },
  },
  self_optimization: {
    enabled: false,
    allowed_adjustments: ['learning_rate', 'exploration_bias'],
    forbidden_adjustments: ['veto_thresholds', 'safety_rules', 'firmware_params'],
    max_scaling_request_percent: 10,
  },
  internet_research: {
    enabled: false,
    max_queries_per_cycle: 0,
    entropy_trigger: 0.8,
  },
};

// ============================================================================
// Ambition Service
// ============================================================================

export class OmegaAmbitionService {
  private config: AmbitionConfig;
  private chemicals: {
    dopamine: number;
    entropy: number;
    curiosity: number;
    frustration: number;
    satisfaction: number;
  };

  constructor(config?: AmbitionConfig) {
    this.config = config || FACTORY_DEFAULT_CONFIG;
    this.chemicals = {
      dopamine: this.config.chemicals.dopamine.initial,
      entropy: this.config.chemicals.entropy.initial,
      curiosity: this.config.chemicals.curiosity.initial,
      frustration: this.config.chemicals.frustration.initial,
      satisfaction: this.config.chemicals.satisfaction.initial,
    };

    logger.info('Ambition service initialized', {
      source: config ? 'cartridge' : 'factory_defaults',
      dopamine: this.chemicals.dopamine,
      entropy: this.chemicals.entropy,
      curiosity: this.chemicals.curiosity,
      selfOptEnabled: this.config.self_optimization.enabled,
      internetResearchEnabled: this.config.internet_research?.enabled ?? false,
    });
  }

  /**
   * Called after each processing cycle.
   */
  updateAfterCycle(qSquared: number, noveltySignal: number, rfmAccuracy: number): void {
    const c = this.config.chemicals;

    // DOPAMINE — reward on high Q²
    if (qSquared > (c.dopamine.q_reward_threshold ?? 0.7)) {
      this.chemicals.dopamine = Math.min(
        c.dopamine.max,
        this.chemicals.dopamine + (c.dopamine.reward_on_high_q ?? 0.05)
      );
    }

    // FRUSTRATION — grows on low Q²
    if (qSquared < (c.frustration.q_frustration_threshold ?? 0.3)) {
      this.chemicals.frustration = Math.min(
        c.frustration.max,
        this.chemicals.frustration + (c.frustration.growth_on_low_q ?? 0.03)
      );
    } else {
      this.chemicals.frustration = Math.max(
        c.frustration.min,
        this.chemicals.frustration - (c.frustration.reduction_on_success ?? 0.1)
      );
    }

    // CURIOSITY — grows with novelty
    this.chemicals.curiosity = Math.min(
      c.curiosity.max,
      this.chemicals.curiosity + noveltySignal * (c.curiosity.novelty_sensitivity ?? 0.1)
    );

    // SATISFACTION — correlates with RFM accuracy
    this.chemicals.satisfaction = Math.min(
      c.satisfaction.max,
      this.chemicals.satisfaction + rfmAccuracy * (c.satisfaction.rfm_accuracy_sensitivity ?? 0.05)
    );
  }

  /**
   * Called each idle cycle (no processing happening).
   */
  updateIdle(): void {
    const c = this.config.chemicals;
    this.chemicals.dopamine *= (c.dopamine.decay_rate ?? 0.99);
    this.chemicals.entropy = Math.min(
      c.entropy.max,
      this.chemicals.entropy + (c.entropy.growth_rate ?? 0.01)
    );
    this.chemicals.curiosity *= (c.curiosity.decay_rate ?? 0.995);
    this.chemicals.satisfaction *= (c.satisfaction.decay_rate ?? 0.98);
  }

  /**
   * Check if brain should trigger self-analysis (frustration or entropy high).
   */
  shouldSelfAnalyze(): boolean {
    return this.chemicals.frustration > (this.config.chemicals.frustration.self_analysis_trigger ?? 0.7)
      || this.chemicals.entropy > (this.config.chemicals.entropy.self_analysis_trigger ?? 0.6);
  }

  /**
   * Check if brain should research on the internet.
   */
  shouldResearchInternet(): boolean {
    return this.config.self_optimization.enabled
      && (this.config.internet_research?.enabled ?? false)
      && this.chemicals.entropy > (this.config.internet_research?.entropy_trigger ?? 0.6);
  }

  /**
   * Check if brain should explore new pathways.
   */
  shouldExplore(): boolean {
    return this.chemicals.curiosity > (this.config.chemicals.curiosity.exploration_bias ?? 0.5);
  }

  /**
   * Check if brain should recalibrate RFM.
   */
  shouldRecalibrateRFM(): boolean {
    return this.chemicals.satisfaction < (this.config.chemicals.satisfaction.rfm_recalibration_trigger ?? 0.3);
  }

  /**
   * Get list of adjustments the brain is allowed to make.
   */
  getAllowedAdjustments(): string[] {
    return this.config.self_optimization.allowed_adjustments;
  }

  /**
   * Get list of adjustments the brain is NEVER allowed to make.
   */
  getForbiddenAdjustments(): string[] {
    return this.config.self_optimization.forbidden_adjustments;
  }

  /**
   * Max percentage scaling the brain can request.
   */
  getMaxScalingPercent(): number {
    return this.config.self_optimization.max_scaling_request_percent;
  }

  /**
   * Get internet research config.
   */
  getInternetResearchConfig(): AmbitionConfig['internet_research'] {
    return this.config.internet_research;
  }

  /**
   * Get current chemical levels.
   */
  getChemicals() {
    return { ...this.chemicals };
  }

  /**
   * Get the full config for serialization.
   */
  getConfig(): AmbitionConfig {
    return this.config;
  }

  /**
   * Override chemicals (e.g. when restoring from checkpoint).
   */
  setChemicals(overrides: Partial<typeof this.chemicals>): void {
    Object.assign(this.chemicals, overrides);
  }
}

/**
 * Create an ambition service from factory defaults.
 */
export function createFactoryAmbitionService(): OmegaAmbitionService {
  return new OmegaAmbitionService();
}
