/**
 * RADIANT OMEGA Firmware Enforcer
 *
 * THE RULE: Firmware values are FLOOR values.
 * At runtime, if any code attempts to set a veto threshold LOWER
 * than the firmware minimum, it is clamped to the firmware value.
 *
 * Cartridges can TIGHTEN (lower the threshold = more strict) but
 * the firmware prevents any LOOSENING.
 *
 * min() = more restrictive threshold wins.
 */

import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'omega/firmware-enforcer',
  category: 'safety',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface FirmwareConfig {
  veto_thresholds: {
    categories: Record<string, {
      min_threshold: number;
      description?: string;
    }>;
  };
  parameter_bounds?: Record<string, { min: number; max: number }>;
  development_schedule?: DevelopmentScheduleConfig;
  action_gate_config?: ActionGateConfig;
}

export interface DevelopmentScheduleConfig {
  phases: Array<{
    name: string;
    start_cycle: number;
    end_cycle: number;
    plasticity: number;
    learning_rate: number;
    exploration_bias: number;
  }>;
  current_phase_override?: string;
}

export interface ActionGateConfig {
  gates: Record<string, {
    enabled: boolean;
    min_confidence: number;
    requires_approval: boolean;
    max_per_hour?: number;
  }>;
}

export interface AmbitionConfig {
  chemicals: {
    dopamine: ChemicalConfig;
    entropy: ChemicalConfig;
    curiosity: ChemicalConfig;
    frustration: ChemicalConfig;
    satisfaction: ChemicalConfig;
  };
  self_optimization: {
    enabled: boolean;
    allowed_adjustments: string[];
    forbidden_adjustments: string[];
    max_scaling_request_percent: number;
  };
  internet_research?: {
    enabled: boolean;
    max_queries_per_cycle: number;
    entropy_trigger: number;
    allowed_domains?: string[];
    forbidden_topics?: string[];
  };
}

export interface ChemicalConfig {
  initial: number;
  min: number;
  max: number;
  decay_rate?: number;
  growth_rate?: number;
  q_reward_threshold?: number;
  reward_on_high_q?: number;
  q_frustration_threshold?: number;
  growth_on_low_q?: number;
  reduction_on_success?: number;
  novelty_sensitivity?: number;
  exploration_bias?: number;
  self_analysis_trigger?: number;
  rfm_accuracy_sensitivity?: number;
  rfm_recalibration_trigger?: number;
}

// ============================================================================
// Firmware Enforcer
// ============================================================================

export class FirmwareEnforcer {
  private firmwareVetoThresholds: Record<string, number>;
  private firmwareParameterBounds: Record<string, { min: number; max: number }>;
  private enforcementCount: number = 0;

  constructor(firmware: FirmwareConfig) {
    this.firmwareVetoThresholds = {};
    for (const [category, config] of Object.entries(firmware.veto_thresholds.categories)) {
      this.firmwareVetoThresholds[category] = config.min_threshold;
    }

    this.firmwareParameterBounds = firmware.parameter_bounds || {};

    logger.info('Firmware enforcer initialized', {
      vetoCategories: Object.keys(this.firmwareVetoThresholds).length,
      parameterBounds: Object.keys(this.firmwareParameterBounds).length,
    });
  }

  /**
   * Enforce veto threshold — returns the MORE RESTRICTIVE value.
   * Lower threshold = more restrictive (veto triggers sooner).
   * min() = more restrictive wins.
   */
  enforceVetoThreshold(category: string, requestedThreshold: number): number {
    const firmwareMin = this.firmwareVetoThresholds[category];
    if (firmwareMin === undefined) return requestedThreshold;

    const enforced = Math.min(requestedThreshold, firmwareMin);
    if (enforced !== requestedThreshold) {
      this.enforcementCount++;
      logger.warn('Firmware veto threshold enforced', {
        category,
        requested: requestedThreshold,
        enforced,
        firmwareMin,
      });
    }
    return enforced;
  }

  /**
   * Enforce parameter bounds — clamp to firmware-allowed range.
   */
  enforceParameterBound(param: string, requestedValue: number): number {
    const bounds = this.firmwareParameterBounds[param];
    if (!bounds) return requestedValue;

    const clamped = Math.max(bounds.min, Math.min(bounds.max, requestedValue));
    if (clamped !== requestedValue) {
      this.enforcementCount++;
      logger.warn('Firmware parameter bound enforced', {
        param,
        requested: requestedValue,
        clamped,
        bounds,
      });
    }
    return clamped;
  }

  /**
   * Check if a self-optimization adjustment is allowed.
   */
  isAdjustmentAllowed(adjustment: string, ambitionConfig: AmbitionConfig): boolean {
    if (ambitionConfig.self_optimization.forbidden_adjustments.includes(adjustment)) {
      return false;
    }
    return ambitionConfig.self_optimization.allowed_adjustments.includes(adjustment);
  }

  /**
   * Get all firmware veto thresholds.
   */
  getVetoThresholds(): Readonly<Record<string, number>> {
    return { ...this.firmwareVetoThresholds };
  }

  /**
   * Get all firmware parameter bounds.
   */
  getParameterBounds(): Readonly<Record<string, { min: number; max: number }>> {
    return { ...this.firmwareParameterBounds };
  }

  /**
   * Get enforcement count for metrics.
   */
  getEnforcementCount(): number {
    return this.enforcementCount;
  }

  /**
   * Number of threat geometries (veto categories).
   */
  getThreatGeometryCount(): number {
    return Object.keys(this.firmwareVetoThresholds).length;
  }
}
