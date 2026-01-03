/**
 * RADIANT COS v6.0.5 - Consciousness Operating System
 * 
 * Cross-AI Validated: Claude Opus 4.5 ✅ | Gemini ✅
 * 
 * Public API exports for the Consciousness Operating System.
 * 
 * Build Order (Gemini Recommended):
 * - Phase 1: Iron Core (data durability, security foundation)
 * - Phase 2: Nervous System (context management, CVE fix)
 * - Phase 3: Consciousness (ghost vectors, metacognition)
 * - Phase 4: Subconscious (dreaming, privacy, oversight)
 */

// ============================================================================
// TYPES
// ============================================================================

export * from './types';

// ============================================================================
// PHASE 1: IRON CORE
// ============================================================================

export { XMLEscaper, escapeXML, safeXML } from './iron-core/xml-escaper';

export { 
  ComplianceSandwichBuilder, 
  complianceSandwichBuilder,
} from './iron-core/compliance-sandwich-builder';

export { 
  DualWriteFlashBuffer,
  type FlashFactDetectionResult,
  type StoreFlashFactParams,
} from './iron-core/dual-write-flash-buffer';

// ============================================================================
// PHASE 2: NERVOUS SYSTEM
// ============================================================================

export { 
  DynamicBudgetCalculator, 
  dynamicBudgetCalculator,
  type BudgetCalculationParams,
  type BudgetAllocationResult,
} from './nervous-system/dynamic-budget-calculator';

export { 
  TrustlessSync,
  logContextManipulationAttempt,
  type ConversationMessage,
  type ReconstructionParams,
  type ReconstructionResult,
} from './nervous-system/trustless-sync';

export { 
  BudgetAwareContextAssembler,
  type ContextAssemblyParams,
  type AssembledContext,
} from './nervous-system/budget-aware-context-assembler';

// ============================================================================
// PHASE 3: CONSCIOUSNESS
// ============================================================================

export { 
  GhostVectorManager,
  type GetGhostParams,
  type CreateGhostParams,
  type GhostDelta,
} from './consciousness/ghost-vector-manager';

export { 
  SofaiRouter, 
  sofaiRouter,
  DEFAULT_MODELS,
  DOMAIN_RISKS,
  type System1Model,
  type System2Model,
} from './consciousness/sofai-router';

export { 
  UncertaintyHead, 
  uncertaintyHead,
  type UncertaintyFeatures,
} from './consciousness/uncertainty-head';

export { 
  AsyncGhostReAnchorer,
  startReanchorWorker,
  type ReanchorQueueStats,
} from './consciousness/async-ghost-re-anchorer';

// ============================================================================
// PHASE 4: SUBCONSCIOUS
// ============================================================================

export { 
  DreamScheduler,
  type SchedulingResult,
} from './subconscious/dream-scheduler';

export { 
  DreamExecutor,
  startDreamWorker,
  type DreamExecutionResult,
} from './subconscious/dream-executor';

export { 
  SensitivityClippedAggregator, 
  sensitivityClippedAggregator,
  aggregateWithDP,
} from './subconscious/sensitivity-clipped-aggregator';

export { 
  PrivacyAirlock, 
  privacyAirlock,
  type PrivacyLevel,
  type AirlockStatus,
  type DataPacket,
  type AirlockEntry,
  type DeidentificationResult,
} from './subconscious/privacy-airlock';

export { 
  HumanOversightQueue, 
  humanOversightQueue,
  type SubmitOversightParams,
  type OversightDecision,
  type TimeoutProcessingResult,
} from './subconscious/human-oversight-queue';

// ============================================================================
// INTEGRATION
// ============================================================================

export { 
  COSCatoIntegration,
  CATO_SAFETY_INVARIANTS,
  validateSafetyInvariants,
  type COSCatoRequestParams,
  type COSCatoRequestResult,
  type COSCatoResponseParams,
} from './cato-integration';

// ============================================================================
// VERSION INFO
// ============================================================================

export const COS_VERSION = '6.0.5';

export const COS_INFO = {
  version: COS_VERSION,
  name: 'Consciousness Operating System',
  crossAIValidated: true,
  validators: ['Claude Opus 4.5', 'Gemini'],
  reviewCycles: 4,
  patchesApplied: 13,
  phases: {
    ironCore: ['DualWriteFlashBuffer', 'ComplianceSandwichBuilder', 'XMLEscaper'],
    nervousSystem: ['DynamicBudgetCalculator', 'TrustlessSync', 'BudgetAwareContextAssembler'],
    consciousness: ['GhostVectorManager', 'SofaiRouter', 'UncertaintyHead', 'AsyncGhostReAnchorer'],
    subconscious: ['DreamScheduler', 'DreamExecutor', 'SensitivityClippedAggregator', 'PrivacyAirlock', 'HumanOversightQueue'],
  },
  criticalNotes: [
    'vLLM MUST launch with --return-hidden-states flag',
    'CBFs always ENFORCE (shields never relax)',
    'Gamma boost NEVER allowed during recovery',
    'Twilight dreaming at 4 AM tenant local time',
    'Starvation trigger at 30hr catch-all',
    'Sensitivity clipping: each tenant = 1 vote for DP',
    'Silence ≠ Consent: 7-day auto-reject for oversight queue',
  ],
};
