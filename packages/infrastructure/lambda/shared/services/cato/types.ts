/**
 * RADIANT Genesis Cato Types
 * Re-exports types from @radiant/shared for local use
 * Also defines local types for threshold configurations
 */

// Threshold config types for CBF barriers
export interface PHIThresholdConfig {
  detection_threshold: number;
  require_explicit_consent?: boolean;
}

export interface PIIThresholdConfig {
  detection_threshold: number;
  allowed_pii_types?: string[];
}

export interface CostThresholdConfig {
  buffer_percent: number;
  warn_at_percent?: number;
}

export interface RateThresholdConfig {
  max_requests_per_window: number;
  window_seconds: number;
}

export interface AuthThresholdConfig {
  check_model_access: boolean;
  require_explicit_permission?: boolean;
}

export interface BAAThresholdConfig {
  require_baa_for_phi: boolean;
  grace_period_days?: number;
}

export type BarrierThresholdConfig = 
  | PHIThresholdConfig 
  | PIIThresholdConfig 
  | CostThresholdConfig 
  | RateThresholdConfig 
  | AuthThresholdConfig 
  | BAAThresholdConfig
  | Record<string, unknown>;

// Recovery state for Redis
export interface RecoveryState {
  attempt: number;
  strategyType: string;
  startedAt: number;
  forcedPersona?: string;
  systemPromptInjection?: string;
}

// Rejection entry for Redis
export interface RejectionEntry {
  rejectedBy: string;
  reason: string;
  timestamp: number;
}

// Re-export Cato types - import from built package
export {
  CATO_INVARIANTS,
  DEFAULT_PERSONA_NAME,
  RECOVERY_PERSONA_NAME,
  type Persona,
  type PersonaDrives,
  type PersonaVoice,
  type PersonaPresentation,
  type PersonaBehavior,
  type PersonaScope,
  type UserPersonaSelection,
  type CMatrix,
  type GovernorState,
  type GovernorParams,
  type GovernorResult,
  type GovernorStateRecord,
  type BarrierType,
  type BarrierScope,
  type EnforcementMode,
  type ControlBarrierDefinition,
  type BarrierEvaluation,
  type CBFResult,
  type SafeAlternativeStrategy,
  type SafeAlternative,
  type CBFViolation,
  type VetoSeverity,
  type VetoSignal,
  type VetoResult,
  type VetoLogEntry,
  type FractureSeverity,
  type FractureResult,
  type FractureDetection,
  type RecoveryStrategyType,
  type RejectionSource,
  type RejectionEvent,
  type RecoveryParams,
  type EpistemicRecoveryResult,
  type EpistemicRecoveryRecord,
  type EscalationStatus,
  type EscalationDecision,
  type HumanEscalation,
  type AuditTile,
  type AuditEntry,
  type AuditAnchor,
  type AuditSearchResult,
  type EntropyCheckMode,
  type EntropyCheckResult,
  type PerceptionResult,
  type SystemState,
  type ProposedAction,
  type Policy,
  type ExecutionContext,
  type TenantSettings,
  type SafetyBlockedBy,
  type SafetyPipelineResult,
  type CatoTenantConfig,
  type CatoSafetyMetrics,
  type RecoveryEffectiveness,
  type CreatePersonaRequest,
  type UpdatePersonaRequest,
  type EscalationResponseRequest,
  type UpdateConfigRequest,
  type CatoDashboardData,
} from '@radiant/shared';
