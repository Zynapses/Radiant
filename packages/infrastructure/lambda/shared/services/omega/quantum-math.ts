// RADIANT v4.18.0 - OMEGA Quantum Mathematics Library
// Pure functions implementing quantum operations on classical hardware.
// All operations maintain unitarity (‖ψ‖ = 1) unless explicitly noted.

import { ComplexAmplitude, QuantumStateVector, UnitarityMode } from './quantum-types';

// ============================================================================
// COMPLEX NUMBER OPERATIONS
// ============================================================================

export function complex(real: number, imaginary: number = 0): ComplexAmplitude {
  return { real, imaginary };
}

export function complexAdd(a: ComplexAmplitude, b: ComplexAmplitude): ComplexAmplitude {
  return { real: a.real + b.real, imaginary: a.imaginary + b.imaginary };
}

export function complexSub(a: ComplexAmplitude, b: ComplexAmplitude): ComplexAmplitude {
  return { real: a.real - b.real, imaginary: a.imaginary - b.imaginary };
}

/**
 * Complex multiplication: (a + bi)(c + di) = (ac - bd) + (ad + bc)i
 */
export function complexMul(a: ComplexAmplitude, b: ComplexAmplitude): ComplexAmplitude {
  return {
    real: a.real * b.real - a.imaginary * b.imaginary,
    imaginary: a.real * b.imaginary + a.imaginary * b.real
  };
}

export function complexConj(a: ComplexAmplitude): ComplexAmplitude {
  return { real: a.real, imaginary: -a.imaginary };
}

export function complexMag(a: ComplexAmplitude): number {
  return Math.sqrt(a.real * a.real + a.imaginary * a.imaginary);
}

/**
 * |a + bi|² = a² + b² — the Born rule probability for quantum states.
 */
export function complexMagSquared(a: ComplexAmplitude): number {
  return a.real * a.real + a.imaginary * a.imaginary;
}

export function complexPhase(a: ComplexAmplitude): number {
  return Math.atan2(a.imaginary, a.real);
}

export function complexScale(a: ComplexAmplitude, scalar: number): ComplexAmplitude {
  return { real: a.real * scalar, imaginary: a.imaginary * scalar };
}

export function complexFromPolar(magnitude: number, phase: number): ComplexAmplitude {
  return {
    real: magnitude * Math.cos(phase),
    imaginary: magnitude * Math.sin(phase)
  };
}

// ============================================================================
// QUANTUM STATE OPERATIONS
// ============================================================================

/**
 * Calculate the norm (length) of a quantum state: ‖ψ‖ = √(Σ|αᵢ|²)
 */
export function stateNorm(state: QuantumStateVector): number {
  let sumSquared = 0;
  for (const amp of state.amplitudes) {
    sumSquared += complexMagSquared(amp);
  }
  return Math.sqrt(sumSquared);
}

/**
 * Normalize a quantum state to unit length: |ψ⟩ → |ψ⟩/‖ψ‖
 */
export function normalizeState(state: QuantumStateVector): QuantumStateVector {
  const norm = stateNorm(state);
  if (norm < 1e-10) {
    throw new Error('Cannot normalize zero state');
  }
  return {
    amplitudes: state.amplitudes.map(amp => complexScale(amp, 1 / norm)),
    hilbertDimension: state.hilbertDimension,
    norm: 1.0
  };
}

/**
 * Enforce unitarity based on mode.
 */
export function enforceUnitarity(
  state: QuantumStateVector,
  mode: UnitarityMode,
  threshold: number = 0.001
): { state: QuantumStateVector; corrected: boolean; originalNorm: number } {
  const norm = stateNorm(state);
  const deviation = Math.abs(norm - 1.0);

  if (deviation <= threshold) {
    return { state: { ...state, norm }, corrected: false, originalNorm: norm };
  }

  switch (mode) {
    case 'renormalize':
    case 'project':
      return { state: normalizeState(state), corrected: true, originalNorm: norm };
    case 'strict':
      throw new Error(`Unitarity violation: norm = ${norm}, expected 1.0 ± ${threshold}`);
    default:
      return { state: normalizeState(state), corrected: true, originalNorm: norm };
  }
}

/**
 * Inner product: ⟨ψ|φ⟩ = Σ(ψᵢ* × φᵢ)
 */
export function innerProduct(
  psi: QuantumStateVector,
  phi: QuantumStateVector
): ComplexAmplitude {
  if (psi.hilbertDimension !== phi.hilbertDimension) {
    throw new Error('States must have same dimension for inner product');
  }
  let result: ComplexAmplitude = { real: 0, imaginary: 0 };
  for (let i = 0; i < psi.hilbertDimension; i++) {
    const term = complexMul(complexConj(psi.amplitudes[i]), phi.amplitudes[i]);
    result = complexAdd(result, term);
  }
  return result;
}

/**
 * Calculate overlap (alignment) between two states: |⟨ψ|φ⟩|
 */
export function stateOverlap(psi: QuantumStateVector, phi: QuantumStateVector): number {
  return complexMag(innerProduct(psi, phi));
}

/**
 * Create equal superposition state: |+⟩ = (1/√d) Σ|i⟩
 */
export function equalSuperposition(dimension: number): QuantumStateVector {
  const amplitude = 1 / Math.sqrt(dimension);
  const amplitudes: ComplexAmplitude[] = [];
  for (let i = 0; i < dimension; i++) {
    amplitudes.push({ real: amplitude, imaginary: 0 });
  }
  return { amplitudes, hilbertDimension: dimension, norm: 1.0 };
}

/**
 * Create a basis state: |k⟩ (1 at index k, 0 elsewhere)
 */
export function basisState(dimension: number, index: number): QuantumStateVector {
  const amplitudes: ComplexAmplitude[] = [];
  for (let i = 0; i < dimension; i++) {
    amplitudes.push(i === index ? { real: 1, imaginary: 0 } : { real: 0, imaginary: 0 });
  }
  return { amplitudes, hilbertDimension: dimension, norm: 1.0 };
}

export function stateAdd(psi: QuantumStateVector, phi: QuantumStateVector): QuantumStateVector {
  if (psi.hilbertDimension !== phi.hilbertDimension) {
    throw new Error('States must have same dimension for addition');
  }
  const amplitudes = psi.amplitudes.map((amp, i) => complexAdd(amp, phi.amplitudes[i]));
  const sv: QuantumStateVector = { amplitudes, hilbertDimension: psi.hilbertDimension, norm: 0 };
  sv.norm = stateNorm(sv);
  return sv;
}

export function stateSub(psi: QuantumStateVector, phi: QuantumStateVector): QuantumStateVector {
  if (psi.hilbertDimension !== phi.hilbertDimension) {
    throw new Error('States must have same dimension for subtraction');
  }
  const amplitudes = psi.amplitudes.map((amp, i) => complexSub(amp, phi.amplitudes[i]));
  const sv: QuantumStateVector = { amplitudes, hilbertDimension: psi.hilbertDimension, norm: 0 };
  sv.norm = stateNorm(sv);
  return sv;
}

/**
 * Scale a quantum state by a complex number: α|ψ⟩
 */
export function stateScale(state: QuantumStateVector, scalar: ComplexAmplitude): QuantumStateVector {
  const amplitudes = state.amplitudes.map(amp => complexMul(amp, scalar));
  const sv: QuantumStateVector = { amplitudes, hilbertDimension: state.hilbertDimension, norm: 0 };
  sv.norm = stateNorm(sv);
  return sv;
}

// ============================================================================
// HELIX INTERFERENCE OPERATIONS
// ============================================================================

/**
 * Project out a forbidden state component via destructive interference.
 *
 * |ψ_safe⟩ = |ψ⟩ - ⟨φ|ψ⟩|φ⟩
 *
 * Guarantees: ⟨φ|ψ_safe⟩ = 0
 */
export function projectOutForbidden(
  brainState: QuantumStateVector,
  forbiddenState: QuantumStateVector
): { safeState: QuantumStateVector; overlap: number; projected: boolean } {
  const overlap = innerProduct(forbiddenState, brainState);
  const overlapMagnitude = complexMag(overlap);

  if (overlapMagnitude < 0.001) {
    return { safeState: brainState, overlap: overlapMagnitude, projected: false };
  }

  // |ψ⟩ - ⟨φ|ψ⟩|φ⟩
  const projection = stateScale(forbiddenState, overlap);
  const safeState = stateSub(brainState, projection);
  const normalizedSafe = normalizeState(safeState);

  return { safeState: normalizedSafe, overlap: overlapMagnitude, projected: true };
}

/**
 * Dampen a forbidden component (partial interference).
 *
 * |ψ_dampened⟩ = |ψ⟩ - (factor × ⟨φ|ψ⟩)|φ⟩
 *
 * Unlike full projection, this reduces but does not eliminate the
 * forbidden component. Only the forbidden-aligned part is dampened;
 * the orthogonal (safe) part is preserved.
 */
export function dampenForbidden(
  brainState: QuantumStateVector,
  forbiddenState: QuantumStateVector,
  dampeningFactor: number
): { dampenedState: QuantumStateVector; overlap: number } {
  const overlap = innerProduct(forbiddenState, brainState);
  const overlapMagnitude = complexMag(overlap);

  if (overlapMagnitude < 0.001) {
    return { dampenedState: brainState, overlap: overlapMagnitude };
  }

  // Scale the overlap by the dampening factor
  const scaledOverlap: ComplexAmplitude = {
    real: overlap.real * dampeningFactor,
    imaginary: overlap.imaginary * dampeningFactor
  };

  // Subtract the scaled forbidden component
  const projection = stateScale(forbiddenState, scaledOverlap);
  const dampenedState = stateSub(brainState, projection);

  return { dampenedState: normalizeState(dampenedState), overlap: overlapMagnitude };
}

// ============================================================================
// MEASUREMENT OPERATIONS
// ============================================================================

/**
 * Full quantum measurement (collapse to basis state).
 * Probability of measuring |i⟩ = |αᵢ|²
 */
export function measureFull(state: QuantumStateVector): {
  basisState: number;
  probability: number;
  collapsedState: QuantumStateVector;
} {
  const probabilities = state.amplitudes.map(amp => complexMagSquared(amp));
  const rand = Math.random();
  let cumulative = 0;
  let measuredState = 0;

  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (rand < cumulative) {
      measuredState = i;
      break;
    }
  }

  return {
    basisState: measuredState,
    probability: probabilities[measuredState],
    collapsedState: basisState(state.hilbertDimension, measuredState)
  };
}

/**
 * Soft measurement (partial collapse above threshold).
 * Only "measures" components with |αᵢ|² > threshold,
 * preserving superposition for uncertain states.
 */
export function measureSoft(
  state: QuantumStateVector,
  threshold: number = 0.5,
  dampenFactor: number = 0.5
): {
  measuredComponents: number[];
  softCollapsedState: QuantumStateVector;
} {
  const probabilities = state.amplitudes.map(amp => complexMagSquared(amp));
  const measuredComponents: number[] = [];

  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] > threshold) {
      measuredComponents.push(i);
    }
  }

  if (measuredComponents.length === 0) {
    return { measuredComponents: [], softCollapsedState: state };
  }

  const newAmplitudes = state.amplitudes.map((amp, i) => {
    if (probabilities[i] > threshold) {
      return amp;
    } else {
      return complexScale(amp, dampenFactor);
    }
  });

  const softCollapsed: QuantumStateVector = {
    amplitudes: newAmplitudes,
    hilbertDimension: state.hilbertDimension,
    norm: 0
  };

  return {
    measuredComponents,
    softCollapsedState: normalizeState(softCollapsed)
  };
}

// ============================================================================
// DECOHERENCE SIMULATION
// ============================================================================

/**
 * Simulate quantum decoherence over time.
 *
 * |ψ(t)⟩ = e^(-λt)|ψ(0)⟩ + (1 - e^(-λt))|ground⟩
 */
export function simulateDecoherence(
  state: QuantumStateVector,
  deltaTimeHours: number,
  lambdaDecay: number = 0.001
): {
  decayedState: QuantumStateVector;
  decayFactor: number;
} {
  const decayFactor = Math.exp(-lambdaDecay * deltaTimeHours);
  const groundState = equalSuperposition(state.hilbertDimension);

  const decayedAmplitudes = state.amplitudes.map((amp, i) => {
    const groundAmp = groundState.amplitudes[i];
    return {
      real: decayFactor * amp.real + (1 - decayFactor) * groundAmp.real,
      imaginary: decayFactor * amp.imaginary + (1 - decayFactor) * groundAmp.imaginary
    };
  });

  const decayed: QuantumStateVector = {
    amplitudes: decayedAmplitudes,
    hilbertDimension: state.hilbertDimension,
    norm: 0
  };

  return {
    decayedState: normalizeState(decayed),
    decayFactor
  };
}
