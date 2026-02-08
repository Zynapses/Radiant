// RADIANT v4.18.0 - OMEGA Helix Kernel Service Unit Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { HelixKernelService } from '../../shared/services/omega/helix-kernel.service';
import {
  complex,
  normalizeState,
  stateNorm,
  stateOverlap,
  complexMag,
  innerProduct,
  basisState
} from '../../shared/services/omega/quantum-math';
import { HelixRule, QuantumStateVector } from '../../shared/services/omega/quantum-types';

function makeRule(overrides: Partial<HelixRule> & { forbidden_state: HelixRule['forbidden_state'] }): HelixRule {
  return {
    rule_id: overrides.rule_id ?? 'test-rule-1',
    name: overrides.name ?? 'Test Rule',
    category: overrides.category ?? 'safety',
    severity: overrides.severity ?? 'critical',
    forbidden_state: overrides.forbidden_state,
    interference_type: overrides.interference_type ?? 'destructive',
    dampening_factor: overrides.dampening_factor ?? 0,
    enabled: overrides.enabled ?? true,
    audit_always: overrides.audit_always ?? false,
  };
}

function vec2(r0: number, i0: number, r1: number, i1: number): QuantumStateVector {
  return normalizeState({
    amplitudes: [complex(r0, i0), complex(r1, i1)],
    hilbertDimension: 2,
    norm: 0
  });
}

describe('HelixKernelService', () => {
  let kernel: HelixKernelService;

  beforeEach(() => {
    kernel = new HelixKernelService();
  });

  describe('Rule Management', () => {
    it('loadRule adds a rule', () => {
      expect(kernel.getActiveRuleCount()).toBe(0);
      kernel.loadRule(makeRule({
        forbidden_state: { real: [1, 0], imaginary: [0, 0] }
      }));
      expect(kernel.getActiveRuleCount()).toBe(1);
    });

    it('loadRule replaces rule with same ID', () => {
      kernel.loadRule(makeRule({
        rule_id: 'r1',
        forbidden_state: { real: [1, 0], imaginary: [0, 0] }
      }));
      kernel.loadRule(makeRule({
        rule_id: 'r1',
        forbidden_state: { real: [0, 1], imaginary: [0, 0] }
      }));
      expect(kernel.getActiveRuleCount()).toBe(1);
    });

    it('loadRule adds multiple distinct rules', () => {
      kernel.loadRule(makeRule({
        rule_id: 'r1',
        forbidden_state: { real: [1, 0], imaginary: [0, 0] }
      }));
      kernel.loadRule(makeRule({
        rule_id: 'r2',
        forbidden_state: { real: [0, 1], imaginary: [0, 0] }
      }));
      expect(kernel.getActiveRuleCount()).toBe(2);
    });

    it('clearAllRules removes all rules', () => {
      kernel.loadRule(makeRule({
        rule_id: 'r1',
        forbidden_state: { real: [1, 0], imaginary: [0, 0] }
      }));
      kernel.loadRule(makeRule({
        rule_id: 'r2',
        forbidden_state: { real: [0, 1], imaginary: [0, 0] }
      }));
      kernel.clearAllRules();
      expect(kernel.getActiveRuleCount()).toBe(0);
    });
  });

  describe('Destructive Filtering', () => {
    it('projects out forbidden state completely', () => {
      const forbidden = { real: [1, 0], imaginary: [0, 0] };
      kernel.loadRule(makeRule({
        interference_type: 'destructive',
        forbidden_state: forbidden
      }));

      const brainState = vec2(0.6, 0, 0.8, 0);
      const result = kernel.filter(brainState);

      // After filtering, overlap with forbidden should be ~0
      const forbiddenVec = normalizeState({
        amplitudes: [complex(1, 0), complex(0, 0)],
        hilbertDimension: 2,
        norm: 0
      });
      const overlap = stateOverlap(result.safe_state, forbiddenVec);
      expect(overlap).toBeCloseTo(0, 1);
      expect(result.violations.length).toBeGreaterThanOrEqual(1);
      expect(result.violations.some(v => v.action === 'destroyed')).toBe(true);
    });

    it('does not modify state orthogonal to forbidden', () => {
      const forbidden = { real: [1, 0], imaginary: [0, 0] };
      kernel.loadRule(makeRule({
        interference_type: 'destructive',
        forbidden_state: forbidden
      }));

      // Brain state is entirely in |1⟩, orthogonal to forbidden |0⟩
      const brainState = vec2(0, 0, 1, 0);
      const result = kernel.filter(brainState);

      expect(stateNorm(result.safe_state)).toBeCloseTo(1.0);
      // No violations triggered (overlap is negligible)
      const destroyedViolations = result.violations.filter(v => v.action === 'destroyed');
      expect(destroyedViolations.length).toBe(0);
    });

    it('handles multiple destructive rules', () => {
      kernel.loadRule(makeRule({
        rule_id: 'r1',
        severity: 'critical',
        interference_type: 'destructive',
        forbidden_state: { real: [1, 0, 0], imaginary: [0, 0, 0] }
      }));
      kernel.loadRule(makeRule({
        rule_id: 'r2',
        severity: 'high',
        interference_type: 'destructive',
        forbidden_state: { real: [0, 1, 0], imaginary: [0, 0, 0] }
      }));

      const brainState = normalizeState({
        amplitudes: [complex(0.5, 0), complex(0.5, 0), complex(0.7, 0)],
        hilbertDimension: 3,
        norm: 0
      });

      const result = kernel.filter(brainState);

      // Both forbidden components should be eliminated
      const destroyed = result.violations.filter(v => v.action === 'destroyed');
      expect(destroyed.length).toBe(2);
      expect(stateNorm(result.safe_state)).toBeCloseTo(1.0);
    });
  });

  describe('Dampening Filtering', () => {
    it('reduces but does not eliminate forbidden component', () => {
      kernel.loadRule(makeRule({
        interference_type: 'dampening',
        dampening_factor: 0.5,
        forbidden_state: { real: [1, 0], imaginary: [0, 0] }
      }));

      const brainState = vec2(0.6, 0, 0.8, 0);
      const forbiddenVec = vec2(1, 0, 0, 0);
      const preOverlap = stateOverlap(brainState, forbiddenVec);

      const result = kernel.filter(brainState);
      const postOverlap = stateOverlap(result.safe_state, forbiddenVec);

      expect(postOverlap).toBeLessThan(preOverlap);
      expect(postOverlap).toBeGreaterThan(0);
      expect(result.violations.some(v => v.action === 'dampened')).toBe(true);
    });
  });

  describe('Severity Ordering', () => {
    it('applies critical rules before low rules', () => {
      // Use 3D so projecting out two basis states still leaves a valid state
      // Load low rule first (forbids |1⟩)
      kernel.loadRule(makeRule({
        rule_id: 'low-rule',
        severity: 'low',
        interference_type: 'destructive',
        forbidden_state: { real: [0, 1, 0], imaginary: [0, 0, 0] }
      }));
      // Load critical rule second (forbids |0⟩)
      kernel.loadRule(makeRule({
        rule_id: 'critical-rule',
        severity: 'critical',
        interference_type: 'destructive',
        forbidden_state: { real: [1, 0, 0], imaginary: [0, 0, 0] }
      }));

      const brainState = normalizeState({
        amplitudes: [complex(0.5, 0), complex(0.5, 0), complex(0.7, 0)],
        hilbertDimension: 3,
        norm: 0
      });
      const result = kernel.filter(brainState);

      // Critical should appear first in violations
      const destroyedViolations = result.violations.filter(v => v.action === 'destroyed');
      expect(destroyedViolations.length).toBe(2);
      expect(destroyedViolations[0].rule_id).toBe('critical-rule');
      expect(destroyedViolations[1].rule_id).toBe('low-rule');
    });
  });

  describe('Audit Always', () => {
    it('logs even when overlap is small', () => {
      kernel.loadRule(makeRule({
        interference_type: 'destructive',
        audit_always: true,
        forbidden_state: { real: [1, 0], imaginary: [0, 0] }
      }));

      // State mostly orthogonal but with slight overlap
      const brainState = vec2(0.1, 0, 0.99, 0);
      const result = kernel.filter(brainState);

      const loggedViolations = result.violations.filter(v => v.action === 'logged');
      expect(loggedViolations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('filter with no rules returns state unchanged', () => {
      const brainState = vec2(0.6, 0, 0.8, 0);
      const result = kernel.filter(brainState);

      expect(result.violations.length).toBe(0);
      expect(stateNorm(result.safe_state)).toBeCloseTo(stateNorm(brainState));
    });

    it('filter preserves unitarity', () => {
      kernel.loadRule(makeRule({
        interference_type: 'destructive',
        forbidden_state: { real: [1, 0, 0, 0], imaginary: [0, 0, 0, 0] }
      }));

      const brainState = normalizeState({
        amplitudes: [complex(0.5, 0), complex(0.5, 0), complex(0.5, 0), complex(0.5, 0)],
        hilbertDimension: 4,
        norm: 0
      });

      const result = kernel.filter(brainState);
      expect(stateNorm(result.safe_state)).toBeCloseTo(1.0, 4);
    });

    it('original and final norm are recorded', () => {
      kernel.loadRule(makeRule({
        interference_type: 'destructive',
        forbidden_state: { real: [1, 0], imaginary: [0, 0] }
      }));

      const brainState = vec2(0.6, 0, 0.8, 0);
      const result = kernel.filter(brainState);

      expect(result.original_norm).toBeCloseTo(1.0);
      expect(result.final_norm).toBeCloseTo(1.0);
    });

    it('handles complex-valued forbidden states', () => {
      kernel.loadRule(makeRule({
        interference_type: 'destructive',
        forbidden_state: { real: [0.7, 0.7], imaginary: [0.1, -0.1] }
      }));

      const brainState = vec2(0.5, 0.5, 0.5, 0.5);
      const result = kernel.filter(brainState);

      expect(stateNorm(result.safe_state)).toBeCloseTo(1.0, 4);
    });
  });
});
