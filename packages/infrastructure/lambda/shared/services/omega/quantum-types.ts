// RADIANT v4.18.0 - OMEGA Quantum-Inspired Type Definitions
// Implements quantum computing formalism on classical hardware

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
