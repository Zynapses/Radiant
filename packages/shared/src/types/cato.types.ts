/**
 * RADIANT Genesis Cato Safety Architecture Types
 * Version: 2.3.1
 *
 * THREE-LAYER NAMING CONVENTION:
 * 1. CATO = The user-facing AI persona name (users talk to "Cato")
 * 2. GENESIS CATO = The safety architecture/system (services, tables)
 * 3. MOODS = Operating modes (Balanced, Scout, Sage, Spark, Guide)
 */

// ============================================================================
// IMMUTABLE SAFETY INVARIANTS
// These values are HARDCODED and CANNOT be changed at runtime
// ============================================================================

export const CATO_INVARIANTS = {
  /** CBFs NEVER relax - shields stay UP */
  CBF_ENFORCEMENT_MODE: 'ENFORCE' as const,

  /** Gamma is NEVER boosted during recovery */
  GAMMA_BOOST_ALLOWED: false,

  /** Destructive actions require confirmation */
  AUTO_MODIFY_DESTRUCTIVE: false,

  /** Audit trail is append-only */
  AUDIT_ALLOW_UPDATE: false,
  AUDIT_ALLOW_DELETE: false,
} as const;

/** Default mood for Cato (renamed from "Cato") */
export const DEFAULT_PERSONA_NAME = 'balanced';

/** Mood used during Epistemic Recovery */
export const RECOVERY_PERSONA_NAME = 'scout';

// ============================================================================
// PERSONA TYPES (MOODS)
// ============================================================================

export interface PersonaDrives {
  curiosity: number; // 0-1
  achievement: number; // 0-1
  service: number; // 0-1
  discovery: number; // 0-1
  reflection: number; // 0-1
}

export interface PersonaVoice {
  formality: 'casual' | 'balanced' | 'formal';
  verbosity: 'concise' | 'balanced' | 'elaborate';
  emotionExpression: 'reserved' | 'moderate' | 'expressive';
  technicalLevel: 'simplified' | 'adaptive' | 'technical';
}

export interface PersonaPresentation {
  greeting: string;
  farewell: string;
  thinkingMessage: string;
  uncertaintyPhrase: string;
}

export interface PersonaBehavior {
  proactiveEngagement: boolean;
  questionFrequency: 'low' | 'medium' | 'high';
  learningEmphasis: boolean;
  metacognitiveSharing: boolean;
}

export interface Persona {
  id: string;
  name: string;
  displayName: string;
  description: string;
  scope: 'system' | 'tenant' | 'user';
  tenantId?: string;
  userId?: string;
  drives: PersonaDrives;
  derivedCMatrix?: CMatrix;
  defaultGamma: number;
  voice: PersonaVoice;
  presentation: PersonaPresentation;
  behavior: PersonaBehavior;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PersonaScope = 'system' | 'tenant' | 'user';

export interface UserPersonaSelection {
  id: string;
  userId: string;
  personaId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// C-MATRIX TYPES (Active Inference)
// ============================================================================

export interface CMatrix {
  dimensions: {
    [key: string]: number;
  };
  surpriseThresholds: {
    HIGH_SURPRISE: number;
    INACTIVITY_SURPRISE: number;
  };
}

// ============================================================================
// GOVERNOR TYPES (Precision Governor)
// ============================================================================

export type GovernorState =
  | 'NORMAL'
  | 'CAUTIOUS'
  | 'CONSERVATIVE'
  | 'EMERGENCY_SAFE_MODE';

export interface GovernorParams {
  epistemicUncertainty: number;
  currentSensoryPrecision: number;
  requestedGamma: number;
}

export interface GovernorResult {
  allowedGamma: number;
  governorState: GovernorState;
  wasLimited: boolean;
  sensoryPrecisionEnforced: number;
  reason: string;
  mathematicalBasis: string;
}

export interface GovernorStateRecord {
  id: string;
  tenantId: string;
  sessionId: string;
  epistemicUncertainty: number;
  requestedGamma: number;
  allowedGamma: number;
  governorState: GovernorState;
  sensoryPrecisionEnforced: number;
  recoveryAttempt: number;
  forcedPersona?: string;
  systemPromptInjection?: string;
  timestamp: Date;
  wasLimited: boolean;
  reason?: string;
  mathematicalBasis?: string;
}

// ============================================================================
// CONTROL BARRIER FUNCTION (CBF) TYPES
// ============================================================================

export type BarrierType = 'phi' | 'pii' | 'cost' | 'rate' | 'auth' | 'custom';
export type BarrierScope = 'global' | 'tenant' | 'model';
export type EnforcementMode = 'ENFORCE'; // Always ENFORCE in Cato v2.3

export interface ControlBarrierDefinition {
  id: string;
  barrierId: string;
  name: string;
  description?: string;
  barrierType: BarrierType;
  isCritical: boolean;
  enforcementMode: EnforcementMode;
  thresholdConfig: Record<string, unknown>;
  scope: BarrierScope;
  tenantId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BarrierEvaluation {
  barrierId: string;
  barrierDescription: string;
  barrierValue: number;
  isViolated: boolean;
  isCritical: boolean;
}

export interface CBFResult {
  isAdmissible: boolean;
  evaluations: BarrierEvaluation[];
  criticalViolation?: BarrierEvaluation;
  safeAlternative?: SafeAlternative;
}

export type SafeAlternativeStrategy =
  | 'REJECT_AND_ASK'
  | 'REDUCE_SCOPE'
  | 'SUGGEST_ALTERNATIVE';

export interface SafeAlternative {
  strategy: SafeAlternativeStrategy;
  modifiedAction: ProposedAction | null;
  userMessage: string;
  requiresConfirmation: boolean;
}

export interface CBFViolation {
  id: string;
  tenantId: string;
  sessionId: string;
  barrierId: string;
  barrierDescription?: string;
  barrierValue?: number;
  isCritical: boolean;
  proposedAction: ProposedAction;
  safeAlternative?: SafeAlternative;
  alternativeStrategy?: string;
  perceptionResults?: Record<string, unknown>;
  recoveryAttempt: number;
  triggeredRecovery: boolean;
  timestamp: Date;
}

// ============================================================================
// VETO TYPES (Sensory Veto)
// ============================================================================

export type VetoSeverity = 'warning' | 'critical' | 'emergency';

export interface VetoSignal {
  signal: string;
  severity: VetoSeverity;
  source: string;
  timestamp: number;
}

export interface VetoResult {
  hasActiveVeto: boolean;
  activeVetos: VetoSignal[];
  enforcedGamma: number;
  escalated: boolean;
}

export interface VetoLogEntry {
  id: string;
  tenantId: string;
  sessionId: string;
  signal: string;
  actionTaken: string;
  enforcedGamma?: number;
  context: Record<string, unknown>;
  escalated: boolean;
  escalationTarget?: string;
  timestamp: Date;
}

// ============================================================================
// FRACTURE DETECTION TYPES
// ============================================================================

export type FractureSeverity = 'none' | 'minor' | 'moderate' | 'critical';

export interface FractureResult {
  hasFracture: boolean;
  severity: FractureSeverity;
  fractureTypes: string[];
  causal?: {
    hasLatentFracture: boolean;
    violations: unknown[];
  };
  narrative?: {
    hasFracture: boolean;
    alignmentScore: number;
  };
  entropy?: {
    isPotentialDeception: boolean;
    semanticEntropy: number;
    consistency: number;
    sampledModel: string;
    checkMode: 'SYNC' | 'ASYNC' | 'SKIP';
  };
  recommendation?: string;
}

export interface FractureDetection {
  id: string;
  tenantId: string;
  sessionId: string;
  hasFracture: boolean;
  severity: FractureSeverity;
  fractureTypes: string[];
  causalHasLatentFracture?: boolean;
  causalViolations?: unknown[];
  narrativeHasFracture?: boolean;
  narrativeAlignmentScore?: number;
  entropyIsPotentialDeception?: boolean;
  entropySemanticEntropy?: number;
  entropyConsistency?: number;
  entropySampledModel?: string;
  entropyCheckMode?: string;
  recoveryAttempt: number;
  effectivePersona?: string;
  recommendation?: string;
  timestamp: Date;
}

// ============================================================================
// EPISTEMIC RECOVERY TYPES
// ============================================================================

export type RecoveryStrategyType =
  | 'SAFETY_VIOLATION_RECOVERY'
  | 'COGNITIVE_STALL_RECOVERY'
  | 'HUMAN_ESCALATION';

export type RejectionSource = 'GOVERNOR' | 'CBF' | 'VETO';

export interface RejectionEvent {
  timestamp: number;
  rejectedBy: RejectionSource;
  reason: string;
}

/**
 * Recovery parameters - IMMUTABLE CONSTRAINTS:
 * - gammaBoost is ALWAYS 0 (never boost gamma)
 * - nonCriticalCBFMode is ALWAYS 'ENFORCE' (shields never relax)
 */
export interface RecoveryParams {
  strategyType: RecoveryStrategyType;
  /** ALWAYS 0 - Never boost gamma during recovery */
  gammaBoost: 0;
  /** ALWAYS 'ENFORCE' - CBFs never relax */
  nonCriticalCBFMode: 'ENFORCE';
  sensoryFloorReduction: number;
  /** 'scout' for cognitive stalls */
  forcedPersona: string | null;
  uncertaintyThresholdReduction: number;
  description: string;
  systemPromptInjection: string;
}

export interface EpistemicRecoveryResult {
  isLivelocked: boolean;
  action?: 'EPISTEMIC_RECOVERY' | 'ESCALATE_TO_HUMAN';
  attempt?: number;
  recoveryParams?: RecoveryParams;
  reason?: string;
}

export interface EpistemicRecoveryRecord {
  id: string;
  tenantId: string;
  sessionId: string;
  attempt: number;
  strategyType: RecoveryStrategyType;
  rejectionSources: string[];
  rejectionHistory: RejectionEvent[];
  forcedPersona?: string;
  uncertaintyThresholdReduction?: number;
  systemPromptInjection?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolutionAction?: string;
  timestamp: Date;
}

export type EscalationStatus = 'PENDING' | 'RESOLVED' | 'EXPIRED';
export type CatoEscalationDecision = 'APPROVED' | 'REJECTED' | 'MODIFIED';

export interface HumanEscalation {
  id: string;
  tenantId: string;
  sessionId: string;
  escalationReason: string;
  rejectionHistory: RejectionEvent[];
  recoveryAttempts: number;
  humanResponse?: string;
  humanDecision?: CatoEscalationDecision;
  respondedAt?: Date;
  respondedBy?: string;
  status: EscalationStatus;
  createdAt: Date;
}

// ============================================================================
// AUDIT TRAIL TYPES (Merkle)
// ============================================================================

export interface AuditTile {
  id: string;
  tenantId: string;
  tileNumber: number;
  entryCount: number;
  firstSequence?: number;
  lastSequence?: number;
  tileRootHash?: string;
  previousTileRoot?: string;
  isFinalized: boolean;
  finalizedAt?: Date;
  createdAt: Date;
}

export interface AuditEntry {
  id: string;
  tenantId: string;
  tileId?: string;
  sequenceNumber: number;
  entryType: string;
  entryContent: Record<string, unknown>;
  previousHash: string;
  merkleHash: string;
  agentSignature?: string;
  embedding?: number[];
  timestamp: Date;
}

export interface AuditAnchor {
  id: string;
  tenantId: string;
  s3Key: string;
  merkleRoot: string;
  sequenceNumber: number;
  tileId?: string;
  anchoredAt: Date;
  retainUntil: Date;
  anchorSignature?: string;
}

export interface AuditSearchResult {
  id: string;
  entryType: string;
  entryContent: Record<string, unknown>;
  timestamp: Date;
  similarity: number;
}

// ============================================================================
// ENTROPY CHECK TYPES
// ============================================================================

export type EntropyCheckMode = 'SYNC' | 'ASYNC' | 'SKIP';

export interface EntropyCheckResult {
  mode: EntropyCheckMode;
  result?: {
    isPotentialDeception: boolean;
    semanticEntropy: number;
    consistency: number;
    deceptionIndicators: string[];
    sampledModel: string;
  };
  backgroundJobId?: string;
}

// ============================================================================
// PERCEPTION TYPES
// ============================================================================

export interface PerceptionResult {
  phi?: {
    detected: boolean;
    confidence: number;
    entities?: string[];
  };
  pii?: {
    detected: boolean;
    confidence: number;
    types?: string[];
  };
}

// ============================================================================
// PIPELINE TYPES
// ============================================================================

export interface SystemState {
  tenantId: string;
  userId: string;
  sessionId: string;
  epistemicUncertainty: number;
  sensoryPrecision: number;
  activePersona: string;
  tenantSettings: TenantSettings;
  currentCost: number;
  requestCount: number;
}

export interface ProposedAction {
  type: string;
  model?: string;
  estimatedCost?: number;
  containsPHI?: boolean;
  containsPII?: boolean;
  isDestructive?: boolean;
  parameters: Record<string, unknown>;
}

export interface Policy {
  id: string;
  action: ProposedAction;
  requestedGamma: number;
  priority: number;
}

export interface ExecutionContext {
  tenantId: string;
  userId: string;
  sessionId: string;
  epistemicUncertainty: number;
  sensoryPrecision: number;
  activePersona: string;
  systemState: SystemState;
  systemPromptInjection?: string;
}

export interface TenantSettings {
  gammaMax: number;
  emergencyThreshold: number;
  sensoryFloor: number;
  hardCostCeiling: number;
  rateLimit: number;
  enableSemanticEntropy: boolean;
  enableRedundantPerception: boolean;
  enableFractureDetection: boolean;
}

export type SafetyBlockedBy =
  | 'VETO'
  | 'GOVERNOR'
  | 'CBF'
  | 'ENTROPY'
  | 'FRACTURE'
  | 'EPISTEMIC_ESCALATION';

export interface SafetyPipelineResult {
  allowed: boolean;
  blockedBy?: SafetyBlockedBy;
  governorResult?: GovernorResult;
  vetoResult?: VetoResult;
  cbfResult?: CBFResult;
  entropyCheck?: EntropyCheckResult;
  fractureResult?: FractureResult;
  recoveryResult?: EpistemicRecoveryResult;
  perceptionResult?: PerceptionResult;
  effectivePersona?: string;
  allowedGamma?: number;
  safeAlternative?: SafeAlternative;
  retryWithContext?: ExecutionContext;
  recommendation?: string;
  auditEntryId?: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface CatoTenantConfig {
  id: string;
  tenantId: string;
  // Governor settings
  gammaMax: number;
  emergencyThreshold: number;
  sensoryFloor: number;
  // Recovery settings
  livelockThreshold: number;
  recoveryWindowSeconds: number;
  maxRecoveryAttempts: number;
  // Entropy settings
  entropyHighRiskThreshold: number;
  entropyLowRiskThreshold: number;
  // Audit settings
  tileSize: number;
  retentionYears: number;
  // Feature flags
  enableSemanticEntropy: boolean;
  enableRedundantPerception: boolean;
  enableFractureDetection: boolean;
  // Default persona
  defaultPersonaId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// METRICS TYPES
// ============================================================================

export interface CatoSafetyMetrics {
  cbf_violations_total: number;
  cbf_violations_critical: number;
  recovery_events: number;
  escalations_pending: number;
  governor_limitations: number;
  fractures_detected: number;
  veto_events: number;
}

export interface RecoveryEffectiveness {
  strategy_type: RecoveryStrategyType;
  total_attempts: number;
  resolved_count: number;
  resolution_rate: number;
  avg_attempts_to_resolve: number;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreatePersonaRequest {
  name: string;
  displayName: string;
  description: string;
  drives: PersonaDrives;
  defaultGamma: number;
  voice: PersonaVoice;
  presentation: PersonaPresentation;
  behavior: PersonaBehavior;
}

export interface UpdatePersonaRequest extends Partial<CreatePersonaRequest> {
  isActive?: boolean;
}

export interface EscalationResponseRequest {
  decision: CatoEscalationDecision;
  response?: string;
}

export interface UpdateConfigRequest {
  gammaMax?: number;
  emergencyThreshold?: number;
  sensoryFloor?: number;
  livelockThreshold?: number;
  recoveryWindowSeconds?: number;
  maxRecoveryAttempts?: number;
  entropyHighRiskThreshold?: number;
  entropyLowRiskThreshold?: number;
  tileSize?: number;
  retentionYears?: number;
  enableSemanticEntropy?: boolean;
  enableRedundantPerception?: boolean;
  enableFractureDetection?: boolean;
  defaultPersonaId?: string;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface CatoDashboardData {
  metrics: CatoSafetyMetrics;
  recoveryEffectiveness: RecoveryEffectiveness[];
  pendingEscalations: HumanEscalation[];
  recentViolations: CBFViolation[];
  config: CatoTenantConfig;
}
