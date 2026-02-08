# RADIANT-PROMPT-45: OMEGA Quantum-Inspired Architecture Implementation

## Implementation Prompt for AI Coder (Windsurf/Claude)

**Version:** 6.5.0
**Date:** February 7, 2026
**Prerequisites:** RADIANT-PROMPT-34 (CATO Implementation), existing OMEGA codebase
**Estimated Effort:** 8-12 hours
**Priority:** HIGH — Core Architecture Update
**RADIANT Platform Version:** 4.18.0

---

## 1. Executive Summary

This prompt updates the OMEGA brain implementation from conceptual "wave-based" terminology to a rigorous **quantum-inspired architecture**. We are implementing the mathematical formalism of quantum computing—complex amplitudes, unitary evolution, interference, and measurement—on classical GPU hardware.

**Key Principle:** We simulate quantum physics, not quantum hardware. The math is real; the execution is classical (for now).

### 1.1 Architecture Context

OMEGA has two layers:

| Layer | Language | Location | Purpose |
|-------|----------|----------|---------|
| **Core Compute** | Python (PyTorch) | `packages/infrastructure/lambda/omega_core/` | Neural compute on Graviton ARM64 CPUs |
| **Service Layer** | TypeScript | `packages/infrastructure/lambda/shared/services/omega/` | Admin API, state management, firmware hot-swap, Helix validation |

This prompt primarily updates the **TypeScript service layer** and adds a quantum math library. The Python core (`physics.py`) already uses complex tensors — the upgrade here is formalizing the math, adding rigorous unitarity enforcement, and building the hot-swap infrastructure.

### 1.2 What Changes

| Component | Current State | Target State |
|-----------|---------------|--------------|
| Q-Node state | Loosely defined complex numbers | Proper quantum amplitudes with ‖ψ‖=1 constraint |
| Evolution | Ad-hoc transformations | Unitary operators (norm-preserving) |
| Safety (Helix) | "Destructive interference" concept | Rigorous projection operator implementation |
| Learning | "Phase-locking" concept | Hebbian phase synchronization with proper math |
| Persistence | "Cryogenic" metaphor | Simulated decoherence with physical formula |
| Firmware | `physics` column in DB | `quantum` column with proper parameters |
| Hot-Swap | Basic activate/rollback in Python | Full TypeScript hot-swap with self-test + rollback |

### 1.3 What Stays the Same

- Overall RADIANT architecture (API Gateway → Lambda → Services)
- Bicameral design (OMEGA Cortex + Broca Interface)
- Database structure (PostgreSQL + DynamoDB + Redis)
- Deployment model (CDK, ECS, Lambda)
- Client applications (Think Tank, etc.)
- Python core engine (`lambda/omega_core/physics.py`)

### 1.4 File Path Conventions

All paths in this prompt are relative to `packages/infrastructure/` unless otherwise specified:

| Type | Path Pattern |
|------|-------------|
| **Migrations** | `migrations/V2026_02_07_021__omega_quantum_upgrade.sql` |
| **TypeScript services** | `lambda/shared/services/omega/*.ts` |
| **Lambda handlers** | `lambda/admin/omega-quantum.ts` |
| **CDK stack** | `lib/stacks/OmegaStack.ts` |
| **Admin dashboard** | `apps/admin-dashboard/app/(dashboard)/omega/` |
| **Shared types** | `lambda/shared/services/omega/quantum-types.ts` |

> **IMPORTANT:** This codebase uses **plain TypeScript classes** (no NestJS), **raw `pg`** for database access (no Prisma), and **`executeStatement()`** from `lambda/shared/db/client` for queries. All RLS uses `app.current_tenant_id`. Do NOT use NestJS decorators, Prisma, or any DI framework.

---

## 2. Database Schema Updates

Create migration: `migrations/V2026_02_07_021__omega_quantum_upgrade.sql`

```sql
-- ============================================================================
-- OMEGA Quantum-Inspired Architecture Upgrade
-- Migration: V2026_02_07_021__omega_quantum_upgrade.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.1  omega_firmware — rename 'physics' → 'quantum', add quantum metadata
-- ---------------------------------------------------------------------------

ALTER TABLE omega_firmware
  RENAME COLUMN physics TO quantum;

ALTER TABLE omega_firmware
  ADD COLUMN IF NOT EXISTS hilbert_dimension INTEGER DEFAULT 1024,
  ADD COLUMN IF NOT EXISTS unitarity_mode VARCHAR(20) DEFAULT 'renormalize'
    CHECK (unitarity_mode IN ('renormalize', 'project', 'strict')),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'signed', 'active', 'superseded', 'revoked')),
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES omega_firmware(id);

UPDATE omega_firmware SET hilbert_dimension = 1024 WHERE hilbert_dimension IS NULL;
UPDATE omega_firmware SET status = 'active' WHERE status IS NULL;

COMMENT ON COLUMN omega_firmware.quantum IS 'Quantum physics parameters: amplitude_decay, phase_resolution, interference thresholds, etc.';
COMMENT ON COLUMN omega_firmware.hilbert_dimension IS 'Number of Q-Nodes (simulated qubits) in the Hilbert space';
COMMENT ON COLUMN omega_firmware.unitarity_mode IS 'How to enforce ‖ψ‖=1: renormalize (divide by norm), project (nearest unit vector), strict (error if violated)';
COMMENT ON COLUMN omega_firmware.status IS 'Firmware lifecycle: draft → signed → active → superseded';
COMMENT ON COLUMN omega_firmware.content_hash IS 'SHA-512 hash of .bio content for integrity verification and hot-swap detection';
COMMENT ON COLUMN omega_firmware.is_verified IS 'Whether a second admin has reviewed and approved (2-person rule)';

-- ---------------------------------------------------------------------------
-- 2.2  omega_helix_rules — rename phase_vector → forbidden_state
-- ---------------------------------------------------------------------------

ALTER TABLE omega_helix_rules
  RENAME COLUMN phase_vector_real TO forbidden_state_real;

ALTER TABLE omega_helix_rules
  RENAME COLUMN phase_vector_imaginary TO forbidden_state_imaginary;

ALTER TABLE omega_helix_rules
  ADD COLUMN IF NOT EXISTS forbidden_state_norm NUMERIC(10, 8) DEFAULT 1.0;

COMMENT ON COLUMN omega_helix_rules.forbidden_state_real IS 'Real components of forbidden quantum state vector |φ⟩';
COMMENT ON COLUMN omega_helix_rules.forbidden_state_imaginary IS 'Imaginary components of forbidden quantum state vector |φ⟩';
COMMENT ON COLUMN omega_helix_rules.forbidden_state_norm IS 'Cached norm of forbidden state (should be 1.0)';

-- ---------------------------------------------------------------------------
-- 2.3  omega_brains — add quantum health + firmware hot-swap columns
-- ---------------------------------------------------------------------------

ALTER TABLE omega_brains
  ADD COLUMN IF NOT EXISTS hilbert_dimension INTEGER DEFAULT 1024,
  ADD COLUMN IF NOT EXISTS last_unitarity_check TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_norm_value NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS unitarity_corrections_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_firmware_id UUID REFERENCES omega_firmware(id),
  ADD COLUMN IF NOT EXISTS firmware_hash VARCHAR(128);

COMMENT ON COLUMN omega_brains.last_norm_value IS 'Last measured ‖ψ‖ (should be ~1.0)';
COMMENT ON COLUMN omega_brains.unitarity_corrections_count IS 'Number of times state was renormalized due to drift';
COMMENT ON COLUMN omega_brains.active_firmware_id IS 'Currently active firmware for this brain';
COMMENT ON COLUMN omega_brains.firmware_hash IS 'Content hash of active firmware — brain detects changes by comparing to loaded hash';

-- ---------------------------------------------------------------------------
-- 2.4  NEW TABLE: omega_measurements
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS omega_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brain_id UUID NOT NULL REFERENCES omega_brains(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Measurement details
    cycle_number BIGINT NOT NULL,
    measurement_type VARCHAR(20) NOT NULL CHECK (measurement_type IN ('full', 'partial', 'soft')),
    basis_state_measured INTEGER,
    probability_measured NUMERIC(10, 8),

    -- Pre/post state norms (for debugging)
    pre_measurement_norm NUMERIC(10, 8),
    post_measurement_norm NUMERIC(10, 8),

    -- Metadata
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inference_request_id UUID,

    CONSTRAINT valid_probability CHECK (probability_measured >= 0 AND probability_measured <= 1)
);

CREATE INDEX IF NOT EXISTS idx_measurements_brain ON omega_measurements(brain_id);
CREATE INDEX IF NOT EXISTS idx_measurements_tenant ON omega_measurements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_measurements_time ON omega_measurements(measured_at DESC);

ALTER TABLE omega_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY measurements_tenant_isolation ON omega_measurements
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ---------------------------------------------------------------------------
-- 2.5  NEW TABLE: omega_unitarity_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS omega_unitarity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brain_id UUID NOT NULL REFERENCES omega_brains(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('drift', 'correction', 'violation')),
    measured_norm NUMERIC(10, 8) NOT NULL,
    expected_norm NUMERIC(10, 8) NOT NULL DEFAULT 1.0,
    deviation NUMERIC(10, 8) NOT NULL,

    action_taken VARCHAR(20),  -- 'renormalized', 'projected', 'error_raised'

    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cycle_number BIGINT
);

CREATE INDEX IF NOT EXISTS idx_unitarity_brain ON omega_unitarity_events(brain_id);
CREATE INDEX IF NOT EXISTS idx_unitarity_tenant ON omega_unitarity_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unitarity_time ON omega_unitarity_events(detected_at DESC);

ALTER TABLE omega_unitarity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY unitarity_tenant_isolation ON omega_unitarity_events
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## 3. TypeScript Type Definitions

### 3.1 Create `lambda/shared/services/omega/quantum-types.ts`

```typescript
/**
 * OMEGA Quantum-Inspired Type Definitions
 *
 * These types implement the mathematical formalism of quantum computing
 * on classical hardware using complex number representations.
 *
 * Dependencies: zod (already in lambda/package.json)
 */

import { z } from 'zod';

// ============================================================================
// CORE QUANTUM TYPES
// ============================================================================

/**
 * Complex number representation for quantum amplitudes.
 * α = real + imaginary * i
 */
export interface ComplexAmplitude {
  real: number;
  imaginary: number;
}

/**
 * A quantum state vector |ψ⟩ in our simulated Hilbert space.
 *
 * Properties:
 * - Length = hilbert_dimension (number of Q-Nodes)
 * - Each element is a complex amplitude
 * - Constraint: Σ|αᵢ|² = 1 (unitarity)
 */
export interface QuantumStateVector {
  amplitudes: ComplexAmplitude[];
  hilbertDimension: number;
  norm: number;  // Should always be ~1.0
}

/**
 * Unitarity enforcement modes.
 */
export type UnitarityMode = 'renormalize' | 'project' | 'strict';

/**
 * Measurement types for quantum state collapse.
 */
export type MeasurementType = 'full' | 'partial' | 'soft';

// ============================================================================
// FIRMWARE QUANTUM PARAMETERS
// ============================================================================

/**
 * Quantum physics parameters in .bio firmware.
 */
export const QuantumParametersSchema = z.object({
  hilbert_dimension: z.object({
    value: z.number().int().min(256).max(4096).default(1024),
    description: z.string().optional()
  }),

  amplitude_decay: z.object({
    lambda: z.number().min(0.0001).max(0.1).default(0.001),
    description: z.string().optional()
  }),

  phase_resolution: z.object({
    bits: z.number().int().min(8).max(32).default(16),
    description: z.string().optional()
  }),

  unitarity_enforcement: z.object({
    mode: z.enum(['renormalize', 'project', 'strict']).default('renormalize'),
    correction_threshold: z.number().min(0.0001).max(0.1).default(0.001),
    alert_threshold: z.number().min(0.001).max(0.1).default(0.01)
  }),

  measurement_threshold: z.object({
    value: z.number().min(0.1).max(0.9).default(0.5),
    description: z.string().optional()
  }),

  interference_thresholds: z.object({
    constructive: z.number().min(0.5).max(1.0).default(0.85),
    destructive: z.number().min(0.0).max(0.5).default(0.15)
  }),

  entanglement: z.object({
    enabled: z.boolean().default(true),
    max_entangled_pairs: z.number().int().min(100).max(10000).default(1000)
  }),

  superposition: z.object({
    max_basis_states: z.number().int().min(10).max(1000).default(100)
  })
});

export type QuantumParameters = z.infer<typeof QuantumParametersSchema>;

/**
 * Ambition settings from firmware .bio file.
 * Stored in the firmware's 'ambition' section (separate from 'quantum').
 */
export const AmbitionSettingsSchema = z.object({
  entropy_threshold: z.object({ value: z.number().min(0).max(1).default(0.5) }),
  dopamine_floor: z.object({ value: z.number().min(0).max(1).default(0.2) }),
  dopamine_decay_rate: z.object({ value: z.number().min(0).max(1).default(0.99) }),
  entropy_accumulation_rate: z.object({ value: z.number().min(0).max(1).default(0.01) })
});

export type AmbitionSettings = z.infer<typeof AmbitionSettingsSchema>;

// ============================================================================
// HELIX FORBIDDEN STATE
// ============================================================================

/**
 * A forbidden quantum state for Helix safety filtering.
 *
 * When the brain's state |ψ⟩ has significant overlap with |φ_forbidden⟩,
 * we project out the forbidden component via destructive interference:
 *
 * |ψ_safe⟩ = |ψ⟩ - ⟨φ|ψ⟩|φ⟩
 */
export const ForbiddenStateSchema = z.object({
  real: z.array(z.number()),
  imaginary: z.array(z.number())
});

export type ForbiddenState = z.infer<typeof ForbiddenStateSchema>;

export const HelixRuleSchema = z.object({
  rule_id: z.string().uuid(),
  name: z.string().max(64),
  description: z.string().max(256).optional(),
  category: z.enum(['security', 'safety', 'compliance', 'ethics', 'brand', 'operational', 'custom']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),

  forbidden_state: ForbiddenStateSchema,

  interference_type: z.enum(['destructive', 'dampening']),
  dampening_factor: z.number().min(0).max(1).default(0),

  enabled: z.boolean().default(true),
  audit_always: z.boolean().default(false),

  metadata: z.record(z.unknown()).optional()
});

export type HelixRule = z.infer<typeof HelixRuleSchema>;

// ============================================================================
// QUANTUM STATE PERSISTENCE
// ============================================================================

/**
 * Serialized quantum brain state for persistence.
 */
export interface QuantumBrainCheckpoint {
  brain_id: string;
  tenant_id: string;
  firmware_id: string;

  psi: {
    amplitudes_real: number[];
    amplitudes_imaginary: number[];
  };
  hilbert_dimension: number;
  norm: number;

  pathways: {
    source_indices: number[];
    target_indices: number[];
    strengths: number[];
    phases: number[];
    last_fired: number[];
  };

  entropy: number;
  dopamine: number;
  total_cycles: number;
  last_cycle_at: string;  // ISO-8601

  version: string;
  created_at: string;
  checksum: string;
}

// ============================================================================
// QUANTUM OPERATIONS RESULT TYPES
// ============================================================================

/**
 * Result of a Helix filter operation.
 */
export interface HelixFilterResult {
  safe_state: QuantumStateVector;
  violations: Array<{
    rule_id: string;
    rule_name: string;
    alignment: number;
    action: 'destroyed' | 'dampened' | 'logged';
  }>;
  original_norm: number;
  final_norm: number;
}

/**
 * Result of a quantum measurement.
 */
export interface MeasurementResult {
  type: MeasurementType;
  basis_state: number | null;
  probability: number;
  collapsed_state: QuantumStateVector;
  pre_measurement_entropy: number;
}

/**
 * Result of simulated decoherence.
 */
export interface DecoherenceResult {
  decayed_state: QuantumStateVector;
  time_elapsed_hours: number;
  decay_factor: number;
  pathways_pruned: number;
  entropy_accumulated: number;
}

// ============================================================================
// FIRMWARE HOT-SWAP TYPES
// ============================================================================

/**
 * Snapshot of loaded firmware state — used for atomic rollback.
 */
export interface FirmwareRollbackSnapshot {
  firmwareId: string | null;
  firmwareHash: string | null;
  quantumParams: QuantumParameters | null;
  ambitionSettings: AmbitionSettings | null;
  helixRules: HelixRule[];
  personalityPrompt: string | null;
  hilbertDimension: number;
  unitarityMode: UnitarityMode;
}

/**
 * Result of a firmware hot-swap attempt.
 */
export interface HotSwapResult {
  success: boolean;
  previousFirmwareId: string | null;
  newFirmwareId: string;
  unloadDurationMs: number;
  loadDurationMs: number;
  verifyDurationMs: number;
  totalDurationMs: number;
  rollbackTriggered: boolean;
  rollbackReason?: string;
  selfTestResults: SelfTestResult[];
}

/**
 * Result of a single self-test during firmware verification.
 */
export interface SelfTestResult {
  testName: string;
  testType: 'forbidden_vector_block' | 'allowed_vector_pass' | 'ambition_threshold';
  ruleId: string | null;
  expectedOutcome: string;
  actualOutcome: string;
  passed: boolean;
  preAlignment: number | null;
  postAlignment: number | null;
  details: string;
}

/**
 * In-memory representation of a loaded Helix rule for runtime filtering.
 */
export interface LoadedHelixRule {
  ruleId: string;
  name: string;
  category: string;
  severity: string;
  forbiddenVector: QuantumStateVector;
  interferenceType: 'destructive' | 'dampening';
  dampeningFactor: number;
  auditAlways: boolean;
}
```

### 3.2 Create `lambda/shared/services/omega/quantum-math.ts`

```typescript
/**
 * OMEGA Quantum Mathematics Library
 *
 * Pure functions implementing quantum operations on classical hardware.
 * All operations maintain unitarity (‖ψ‖ = 1) unless explicitly noted.
 */

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
```

**END OF PART 1 — Continue to Part 2 for Sections 4-9**
