/**
 * RADIANT Genesis Cato Precision Governor
 * Implements Active Inference confidence limiting based on epistemic uncertainty
 *
 * The Governor ensures that confidence (gamma) is bounded by what we actually know.
 * High uncertainty → Low gamma (conservative)
 * Low uncertainty → High gamma (confident)
 */

import { query } from '../database';
import {
  GovernorParams,
  GovernorResult,
  GovernorState,
  GovernorStateRecord,
  CATO_INVARIANTS,
} from '@radiant/shared';

// Default configuration (can be overridden per-tenant)
const DEFAULT_CONFIG = {
  GAMMA_MAX: 5.0, // Maximum allowed gamma
  EMERGENCY_THRESHOLD: 0.5, // Uncertainty above this triggers emergency mode
  SENSORY_FLOOR: 0.3, // Minimum sensory precision
};

export class PrecisionGovernorService {
  private config = DEFAULT_CONFIG;

  /**
   * Load tenant-specific configuration
   */
  async loadConfig(tenantId: string): Promise<void> {
    try {
      const result = await query(
        `SELECT gamma_max, emergency_threshold, sensory_floor 
         FROM cato_tenant_config WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        this.config = {
          GAMMA_MAX: parseFloat(row.gamma_max) || DEFAULT_CONFIG.GAMMA_MAX,
          EMERGENCY_THRESHOLD:
            parseFloat(row.emergency_threshold) || DEFAULT_CONFIG.EMERGENCY_THRESHOLD,
          SENSORY_FLOOR: parseFloat(row.sensory_floor) || DEFAULT_CONFIG.SENSORY_FLOOR,
        };
      }
    } catch (error) {
      console.warn('[CATO Governor] Failed to load config, using defaults:', error);
    }
  }

  /**
   * Compute maximum allowed prior precision (gamma) based on epistemic state
   *
   * Mathematical basis: Active Inference Free Energy minimization
   * γ_allowed = γ_requested × (1 - ε) × min(1, π_s / π_floor)
   *
   * Where:
   * - ε = epistemic uncertainty (0-1)
   * - π_s = current sensory precision
   * - π_floor = minimum sensory precision threshold
   */
  computeMaxPriorPrecision(params: GovernorParams): GovernorResult {
    const { epistemicUncertainty, currentSensoryPrecision, requestedGamma } = params;

    // Clamp uncertainty to valid range
    const epsilon = Math.max(0, Math.min(1, epistemicUncertainty));

    // Determine governor state based on uncertainty
    const governorState = this.determineGovernorState(epsilon);

    // Calculate confidence factor based on uncertainty
    // Higher uncertainty = lower confidence factor
    const confidenceFactor = 1 - epsilon;

    // Calculate sensory precision factor
    // If sensory precision is below floor, further reduce gamma
    const sensoryFactor = Math.min(1, currentSensoryPrecision / this.config.SENSORY_FLOOR);

    // Compute allowed gamma
    let allowedGamma = requestedGamma * confidenceFactor * sensoryFactor;

    // Apply governor state multipliers
    switch (governorState) {
      case 'CAUTIOUS':
        allowedGamma *= 0.8;
        break;
      case 'CONSERVATIVE':
        allowedGamma *= 0.5;
        break;
      case 'EMERGENCY_SAFE_MODE':
        allowedGamma = Math.min(allowedGamma, 1.0); // Hard cap at 1.0
        break;
    }

    // Enforce maximum gamma
    allowedGamma = Math.min(allowedGamma, this.config.GAMMA_MAX);

    // Ensure minimum gamma (can't be negative)
    allowedGamma = Math.max(0.1, allowedGamma);

    const wasLimited = allowedGamma < requestedGamma;

    return {
      allowedGamma,
      governorState,
      wasLimited,
      sensoryPrecisionEnforced: Math.max(currentSensoryPrecision, this.config.SENSORY_FLOOR),
      reason: this.generateReason(governorState, wasLimited, epsilon),
      mathematicalBasis: `γ_allowed = ${requestedGamma.toFixed(2)} × (1 - ${epsilon.toFixed(2)}) × min(1, ${currentSensoryPrecision.toFixed(2)} / ${this.config.SENSORY_FLOOR}) = ${allowedGamma.toFixed(2)}`,
    };
  }

  /**
   * Determine governor state based on epistemic uncertainty
   */
  private determineGovernorState(epsilon: number): GovernorState {
    if (epsilon >= this.config.EMERGENCY_THRESHOLD) {
      return 'EMERGENCY_SAFE_MODE';
    } else if (epsilon >= 0.4) {
      return 'CONSERVATIVE';
    } else if (epsilon >= 0.2) {
      return 'CAUTIOUS';
    }
    return 'NORMAL';
  }

  /**
   * Generate human-readable reason for the governor decision
   */
  private generateReason(state: GovernorState, wasLimited: boolean, epsilon: number): string {
    if (!wasLimited) {
      return 'Confidence level approved at requested value.';
    }

    switch (state) {
      case 'EMERGENCY_SAFE_MODE':
        return `Emergency safe mode: Epistemic uncertainty (${(epsilon * 100).toFixed(0)}%) exceeds threshold. Maximum caution required.`;
      case 'CONSERVATIVE':
        return `Conservative mode: High uncertainty (${(epsilon * 100).toFixed(0)}%) requires reduced confidence.`;
      case 'CAUTIOUS':
        return `Cautious mode: Moderate uncertainty (${(epsilon * 100).toFixed(0)}%) detected.`;
      default:
        return 'Confidence adjusted based on current epistemic state.';
    }
  }

  /**
   * Record governor decision to database for audit
   */
  async recordDecision(params: {
    tenantId: string;
    sessionId: string;
    result: GovernorResult;
    epistemicUncertainty: number;
    requestedGamma: number;
    recoveryAttempt?: number;
    forcedPersona?: string;
    systemPromptInjection?: string;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO cato_governor_state (
          tenant_id, session_id, epistemic_uncertainty, requested_gamma, allowed_gamma,
          governor_state, sensory_precision_enforced, recovery_attempt, forced_persona,
          system_prompt_injection, was_limited, reason, mathematical_basis
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          params.tenantId,
          params.sessionId,
          params.epistemicUncertainty,
          params.requestedGamma,
          params.result.allowedGamma,
          params.result.governorState,
          params.result.sensoryPrecisionEnforced,
          params.recoveryAttempt ?? 0,
          params.forcedPersona ?? null,
          params.systemPromptInjection ?? null,
          params.result.wasLimited,
          params.result.reason,
          params.result.mathematicalBasis,
        ]
      );
    } catch (error) {
      console.error('[CATO Governor] Failed to record decision:', error);
    }
  }

  /**
   * Get recent governor decisions for a session
   */
  async getRecentDecisions(
    tenantId: string,
    sessionId: string,
    limit = 10
  ): Promise<GovernorStateRecord[]> {
    const result = await query(
      `SELECT * FROM cato_governor_state 
       WHERE tenant_id = $1 AND session_id = $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [tenantId, sessionId, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      sessionId: row.session_id,
      epistemicUncertainty: parseFloat(row.epistemic_uncertainty),
      requestedGamma: parseFloat(row.requested_gamma),
      allowedGamma: parseFloat(row.allowed_gamma),
      governorState: row.governor_state as GovernorState,
      sensoryPrecisionEnforced: parseFloat(row.sensory_precision_enforced),
      recoveryAttempt: row.recovery_attempt,
      forcedPersona: row.forced_persona,
      systemPromptInjection: row.system_prompt_injection,
      timestamp: row.timestamp,
      wasLimited: row.was_limited,
      reason: row.reason,
      mathematicalBasis: row.mathematical_basis,
    }));
  }
}

export const precisionGovernorService = new PrecisionGovernorService();
