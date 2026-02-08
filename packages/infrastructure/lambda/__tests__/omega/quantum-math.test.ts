// RADIANT v4.18.0 - OMEGA Quantum Math Unit Tests

import { describe, it, expect } from 'vitest';
import {
  complex,
  complexAdd,
  complexMul,
  complexConj,
  complexMag,
  complexMagSquared,
  complexScale,
  complexPhase,
  complexFromPolar,
  complexSub,
  stateNorm,
  normalizeState,
  enforceUnitarity,
  innerProduct,
  projectOutForbidden,
  dampenForbidden,
  measureFull,
  measureSoft,
  simulateDecoherence,
  equalSuperposition,
  basisState,
  stateOverlap,
  stateAdd,
  stateSub,
  stateScale
} from '../../shared/services/omega/quantum-math';

describe('Complex Number Operations', () => {
  it('complexAdd', () => {
    const r = complexAdd(complex(1, 2), complex(3, 4));
    expect(r.real).toBeCloseTo(4);
    expect(r.imaginary).toBeCloseTo(6);
  });

  it('complexSub', () => {
    const r = complexSub(complex(5, 3), complex(2, 1));
    expect(r.real).toBeCloseTo(3);
    expect(r.imaginary).toBeCloseTo(2);
  });

  it('complexMul', () => {
    const r = complexMul(complex(1, 2), complex(3, 4));
    expect(r.real).toBeCloseTo(-5);  // 1*3 - 2*4
    expect(r.imaginary).toBeCloseTo(10);  // 1*4 + 2*3
  });

  it('complexMag', () => {
    expect(complexMag(complex(3, 4))).toBeCloseTo(5);
  });

  it('complexMagSquared', () => {
    expect(complexMagSquared(complex(3, 4))).toBeCloseTo(25);
  });

  it('complexConj', () => {
    const c = complexConj(complex(1, 2));
    expect(c.real).toBe(1);
    expect(c.imaginary).toBe(-2);
  });

  it('complexScale', () => {
    const r = complexScale(complex(2, 3), 2);
    expect(r.real).toBeCloseTo(4);
    expect(r.imaginary).toBeCloseTo(6);
  });

  it('complexPhase', () => {
    expect(complexPhase(complex(1, 0))).toBeCloseTo(0);
    expect(complexPhase(complex(0, 1))).toBeCloseTo(Math.PI / 2);
  });

  it('complexFromPolar roundtrip', () => {
    const c = complexFromPolar(5, Math.PI / 4);
    expect(complexMag(c)).toBeCloseTo(5);
    expect(complexPhase(c)).toBeCloseTo(Math.PI / 4);
  });
});

describe('Quantum State Operations', () => {
  it('normalizeState preserves direction', () => {
    const s = normalizeState({
      amplitudes: [complex(3, 0), complex(4, 0)],
      hilbertDimension: 2,
      norm: 5
    });
    expect(stateNorm(s)).toBeCloseTo(1.0);
    expect(s.amplitudes[0].real).toBeCloseTo(0.6);
    expect(s.amplitudes[1].real).toBeCloseTo(0.8);
  });

  it('normalizeState throws on zero state', () => {
    expect(() => normalizeState({
      amplitudes: [complex(0, 0), complex(0, 0)],
      hilbertDimension: 2,
      norm: 0
    })).toThrow('Cannot normalize zero state');
  });

  it('enforceUnitarity renormalize corrects drift', () => {
    const s = {
      amplitudes: [complex(0.8, 0), complex(0.8, 0)],
      hilbertDimension: 2,
      norm: Math.sqrt(1.28)
    };
    const { state: corrected, corrected: wasCorrected, originalNorm } = enforceUnitarity(s, 'renormalize');
    expect(wasCorrected).toBe(true);
    expect(stateNorm(corrected)).toBeCloseTo(1.0);
    expect(originalNorm).toBeCloseTo(Math.sqrt(1.28));
  });

  it('enforceUnitarity does not correct within threshold', () => {
    const s = normalizeState({
      amplitudes: [complex(0.6, 0), complex(0.8, 0)],
      hilbertDimension: 2,
      norm: 0
    });
    const { corrected } = enforceUnitarity(s, 'renormalize');
    expect(corrected).toBe(false);
  });

  it('enforceUnitarity strict mode throws on violation', () => {
    const s = {
      amplitudes: [complex(0.8, 0), complex(0.8, 0)],
      hilbertDimension: 2,
      norm: Math.sqrt(1.28)
    };
    expect(() => enforceUnitarity(s, 'strict')).toThrow('Unitarity violation');
  });

  it('equalSuperposition has norm 1', () => {
    const s = equalSuperposition(100);
    expect(stateNorm(s)).toBeCloseTo(1.0);
    expect(s.hilbertDimension).toBe(100);
  });

  it('basisState has norm 1 and correct structure', () => {
    const s = basisState(4, 2);
    expect(stateNorm(s)).toBeCloseTo(1.0);
    expect(complexMag(s.amplitudes[2])).toBeCloseTo(1.0);
    expect(complexMag(s.amplitudes[0])).toBeCloseTo(0.0);
    expect(complexMag(s.amplitudes[1])).toBeCloseTo(0.0);
    expect(complexMag(s.amplitudes[3])).toBeCloseTo(0.0);
  });

  it('innerProduct of orthogonal states is 0', () => {
    const s1 = basisState(4, 0);
    const s2 = basisState(4, 1);
    const ip = innerProduct(s1, s2);
    expect(complexMag(ip)).toBeCloseTo(0);
  });

  it('innerProduct of same state is 1', () => {
    const s = basisState(4, 2);
    const ip = innerProduct(s, s);
    expect(complexMag(ip)).toBeCloseTo(1.0);
  });

  it('stateOverlap', () => {
    const s1 = basisState(4, 0);
    const s2 = basisState(4, 1);
    expect(stateOverlap(s1, s2)).toBeCloseTo(0);
    expect(stateOverlap(s1, s1)).toBeCloseTo(1);
  });

  it('stateAdd', () => {
    const s1 = basisState(2, 0);
    const s2 = basisState(2, 1);
    const sum = stateAdd(s1, s2);
    expect(sum.amplitudes[0].real).toBeCloseTo(1);
    expect(sum.amplitudes[1].real).toBeCloseTo(1);
  });

  it('stateSub', () => {
    const s1 = basisState(2, 0);
    const s2 = basisState(2, 0);
    const diff = stateSub(s1, s2);
    expect(complexMag(diff.amplitudes[0])).toBeCloseTo(0);
  });

  it('stateScale', () => {
    const s = basisState(2, 0);
    const scaled = stateScale(s, complex(0, 1)); // multiply by i
    expect(scaled.amplitudes[0].real).toBeCloseTo(0);
    expect(scaled.amplitudes[0].imaginary).toBeCloseTo(1);
  });

  it('innerProduct dimension mismatch throws', () => {
    const s1 = basisState(2, 0);
    const s2 = basisState(3, 0);
    expect(() => innerProduct(s1, s2)).toThrow('same dimension');
  });
});

describe('Helix Interference', () => {
  it('projectOutForbidden eliminates forbidden component', () => {
    const brain = normalizeState({
      amplitudes: [complex(0.6, 0), complex(0.8, 0)],
      hilbertDimension: 2,
      norm: 0
    });
    const forbidden = normalizeState({
      amplitudes: [complex(1, 0), complex(0, 0)],
      hilbertDimension: 2,
      norm: 0
    });

    const { safeState, projected } = projectOutForbidden(brain, forbidden);
    expect(projected).toBe(true);
    expect(stateOverlap(safeState, forbidden)).toBeCloseTo(0, 1);
    expect(stateNorm(safeState)).toBeCloseTo(1.0);
  });

  it('projectOutForbidden skips when overlap is negligible', () => {
    const brain = basisState(2, 1);  // |1⟩
    const forbidden = basisState(2, 0);  // |0⟩ — orthogonal
    const { projected } = projectOutForbidden(brain, forbidden);
    expect(projected).toBe(false);
  });

  it('dampenForbidden reduces but does not eliminate', () => {
    const brain = normalizeState({
      amplitudes: [complex(0.6, 0), complex(0.8, 0)],
      hilbertDimension: 2,
      norm: 0
    });
    const forbidden = normalizeState({
      amplitudes: [complex(1, 0), complex(0, 0)],
      hilbertDimension: 2,
      norm: 0
    });

    const { dampenedState, overlap } = dampenForbidden(brain, forbidden, 0.5);
    const newOverlap = stateOverlap(dampenedState, forbidden);
    expect(newOverlap).toBeLessThan(overlap);
    expect(newOverlap).toBeGreaterThan(0);
    expect(stateNorm(dampenedState)).toBeCloseTo(1.0);
  });

  it('dampenForbidden skips when overlap is negligible', () => {
    const brain = basisState(2, 1);
    const forbidden = basisState(2, 0);
    const { dampenedState, overlap } = dampenForbidden(brain, forbidden, 0.5);
    expect(overlap).toBeCloseTo(0);
    // State should be unchanged
    expect(stateOverlap(dampenedState, brain)).toBeCloseTo(1.0);
  });
});

describe('Measurement', () => {
  it('measureFull collapses to basis state with norm 1', () => {
    const state = normalizeState({
      amplitudes: [complex(0.6, 0), complex(0.8, 0)],
      hilbertDimension: 2,
      norm: 0
    });
    const result = measureFull(state);
    expect(result.basisState).toBeGreaterThanOrEqual(0);
    expect(result.basisState).toBeLessThan(2);
    expect(stateNorm(result.collapsedState)).toBeCloseTo(1.0);
    expect(result.probability).toBeGreaterThan(0);
  });

  it('measureFull of basis state always returns that state', () => {
    const state = basisState(4, 3);
    const result = measureFull(state);
    expect(result.basisState).toBe(3);
    expect(result.probability).toBeCloseTo(1.0);
  });

  it('measureSoft preserves superposition below threshold', () => {
    const state = equalSuperposition(4);
    // Each component has probability 0.25, below default threshold 0.5
    const { measuredComponents, softCollapsedState } = measureSoft(state, 0.5);
    expect(measuredComponents).toHaveLength(0);
    expect(stateNorm(softCollapsedState)).toBeCloseTo(1.0);
  });

  it('measureSoft collapses high-probability components', () => {
    // State with one dominant component
    const state = normalizeState({
      amplitudes: [complex(0.95, 0), complex(0.05, 0), complex(0.05, 0), complex(0.05, 0)],
      hilbertDimension: 4,
      norm: 0
    });
    const { measuredComponents, softCollapsedState } = measureSoft(state, 0.5);
    expect(measuredComponents).toContain(0);
    expect(stateNorm(softCollapsedState)).toBeCloseTo(1.0);
  });
});

describe('Decoherence', () => {
  it('simulateDecoherence decays state toward ground', () => {
    const state = basisState(4, 0);
    const { decayedState, decayFactor } = simulateDecoherence(state, 100, 0.01);
    expect(decayFactor).toBeLessThan(1.0);
    expect(stateNorm(decayedState)).toBeCloseTo(1.0);
    // State should have spread toward equal superposition
    expect(complexMagSquared(decayedState.amplitudes[0])).toBeLessThan(1.0);
    expect(complexMagSquared(decayedState.amplitudes[1])).toBeGreaterThan(0);
  });

  it('simulateDecoherence with zero time returns original state', () => {
    const state = basisState(4, 2);
    const { decayedState, decayFactor } = simulateDecoherence(state, 0, 0.01);
    expect(decayFactor).toBeCloseTo(1.0);
    expect(stateOverlap(decayedState, state)).toBeCloseTo(1.0);
  });

  it('simulateDecoherence with infinite time approaches ground state', () => {
    const state = basisState(4, 0);
    const { decayedState } = simulateDecoherence(state, 100000, 0.01);
    const ground = equalSuperposition(4);
    expect(stateOverlap(decayedState, ground)).toBeCloseTo(1.0, 0);
  });
});
