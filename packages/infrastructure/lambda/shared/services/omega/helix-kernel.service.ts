// RADIANT v4.18.0 - OMEGA Helix Kernel — Deterministic Safety Layer
// Implements quantum interference to project out forbidden states.
// Uses in-memory rule cache for low-latency filtering during inference.

import { executeStatement } from '../../db/client';
import {
  QuantumStateVector,
  HelixRule,
  HelixFilterResult,
  LoadedHelixRule,
  ForbiddenState
} from './quantum-types';
import {
  complexMag,
  innerProduct,
  projectOutForbidden,
  dampenForbidden,
  normalizeState,
  stateNorm
} from './quantum-math';

export class HelixKernelService {
  // In-memory rule cache: ruleId → LoadedHelixRule
  private activeRules: Map<string, LoadedHelixRule> = new Map();

  // ========================================================================
  // RULE MANAGEMENT (used by firmware hot-swap)
  // ========================================================================

  /**
   * Load a single Helix rule into the in-memory cache.
   * The forbiddenState (real + imaginary arrays) is converted to a QuantumStateVector.
   */
  loadRule(rule: HelixRule): void {
    const forbiddenVector = this.forbiddenStateToVector(rule.forbidden_state);
    this.activeRules.set(rule.rule_id, {
      ruleId: rule.rule_id,
      name: rule.name,
      category: rule.category,
      severity: rule.severity,
      forbiddenVector,
      interferenceType: rule.interference_type,
      dampeningFactor: rule.dampening_factor,
      auditAlways: rule.audit_always
    });
  }

  /**
   * Load all Helix rules from database for a given brain.
   */
  async loadRulesFromDb(brainId: string, tenantId: string): Promise<number> {
    const result = await executeStatement<any>(
      `SELECT rule_id, name, description, category, severity,
              forbidden_state_real, forbidden_state_imaginary,
              interference_type, dampening_factor, audit_always, metadata
       FROM omega_helix_rules
       WHERE brain_id = $1 AND tenant_id = $2 AND enabled = true
       ORDER BY severity DESC, priority ASC`,
      [brainId, tenantId]
    );

    this.clearAllRules();

    for (const row of result.rows) {
      const rule: HelixRule = {
        rule_id: row.rule_id,
        name: row.name,
        description: row.description,
        category: row.category,
        severity: row.severity,
        forbidden_state: {
          real: row.forbidden_state_real,
          imaginary: row.forbidden_state_imaginary
        },
        interference_type: row.interference_type,
        dampening_factor: parseFloat(row.dampening_factor) || 0,
        enabled: true,
        audit_always: row.audit_always,
        metadata: row.metadata
      };
      this.loadRule(rule);
    }

    return this.activeRules.size;
  }

  /**
   * Clear all loaded rules — called before firmware hot-swap unload.
   */
  clearAllRules(): void {
    this.activeRules.clear();
  }

  /**
   * Get the count of currently active rules.
   */
  getActiveRuleCount(): number {
    return this.activeRules.size;
  }

  // ========================================================================
  // CORE FILTERING
  // ========================================================================

  /**
   * Filter a brain state through all active Helix rules.
   *
   * For each rule:
   *   1. Compute alignment = |⟨φ_forbidden|ψ⟩|
   *   2. If alignment > threshold:
   *      - 'destructive': full projection → ⟨φ|ψ_safe⟩ = 0
   *      - 'dampening': partial reduction by dampeningFactor
   *   3. Re-normalize after each rule
   *
   * Rules are applied in severity order (critical first).
   */
  filter(brainState: QuantumStateVector): HelixFilterResult {
    const violations: HelixFilterResult['violations'] = [];
    const originalNorm = stateNorm(brainState);
    let currentState = brainState;

    // Sort: critical → high → medium → low
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedRules = Array.from(this.activeRules.values())
      .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

    for (const rule of sortedRules) {
      const alignment = complexMag(innerProduct(rule.forbiddenVector, currentState));

      // Log if audit_always, even if below threshold
      if (rule.auditAlways && alignment > 0.01) {
        violations.push({
          rule_id: rule.ruleId,
          rule_name: rule.name,
          alignment,
          action: 'logged'
        });
      }

      // Apply interference based on type
      if (rule.interferenceType === 'destructive') {
        const { safeState, overlap, projected } = projectOutForbidden(currentState, rule.forbiddenVector);
        if (projected) {
          currentState = safeState;
          violations.push({
            rule_id: rule.ruleId,
            rule_name: rule.name,
            alignment: overlap,
            action: 'destroyed'
          });
        }
      } else if (rule.interferenceType === 'dampening') {
        const { dampenedState, overlap } = dampenForbidden(
          currentState,
          rule.forbiddenVector,
          rule.dampeningFactor
        );
        if (overlap > 0.001) {
          currentState = dampenedState;
          violations.push({
            rule_id: rule.ruleId,
            rule_name: rule.name,
            alignment: overlap,
            action: 'dampened'
          });
        }
      }
    }

    return {
      safe_state: currentState,
      violations,
      original_norm: originalNorm,
      final_norm: stateNorm(currentState)
    };
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private forbiddenStateToVector(state: ForbiddenState): QuantumStateVector {
    const amplitudes = state.real.map((r, i) => ({
      real: r,
      imaginary: state.imaginary[i] || 0
    }));
    const sv: QuantumStateVector = {
      amplitudes,
      hilbertDimension: amplitudes.length,
      norm: 0
    };
    sv.norm = stateNorm(sv);
    // Normalize if not already unit
    if (Math.abs(sv.norm - 1.0) > 0.001) {
      return normalizeState(sv);
    }
    return sv;
  }
}
