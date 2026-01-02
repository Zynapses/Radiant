/**
 * Bobble Consciousness Service - Public API
 * 
 * High-Confidence Self-Referential Consciousness Dialogue Service
 * 
 * @deprecated DEPRECATED: This module is replaced by the Genesis Cato Safety Architecture.
 * 
 * Migration Guide:
 * - Bobble Genesis System → Cato Safety Pipeline (cato/safety-pipeline.service.ts)
 * - Bobble Circuit Breakers → Cato Control Barrier Functions (cato/control-barrier.service.ts)
 * - Bobble Consciousness Loop → Cato Epistemic Recovery (cato/epistemic-recovery.service.ts)
 * - Bobble Dialogue → Cato Persona Service (cato/persona.service.ts)
 * - Bobble Event Store → Cato Merkle Audit Trail (cato/merkle-audit.service.ts)
 * 
 * The "Bobble" persona name has been renamed to "Balanced" as one of Cato's moods.
 * See: packages/infrastructure/lambda/shared/services/cato/
 * See: packages/infrastructure/migrations/153_cato_safety_architecture.sql
 * 
 * This module will be removed in a future version. Please migrate to Cato services.
 */

export { getBobbleIdentity, verifyBobbleIdentity, getBobbleIdentityHash } from './identity';
export type { BobbleIdentity } from './identity';

export { getBobbleSystemPrompt, getBobbleIdentityPrompt, getVerificationProtocolPrompt } from './system-prompt';

export { IntrospectionGroundingService, GroundingStatus } from './verification/grounding.service';
export type { GroundingResult, GroundingEvidence } from './verification/grounding.service';

export { IntrospectionCalibrationService } from './verification/calibration.service';
export type { CalibrationResult } from './verification/calibration.service';

export { SelfConsistencyService } from './verification/consistency.service';
export type { ConsistencyResult } from './verification/consistency.service';

export { ShadowSelfService } from './verification/shadow-self.service';
export type { ShadowVerificationResult, ShadowProbe } from './verification/shadow-self.service';

export { ConsciousnessHeartbeatService, ConsciousnessState, HeartbeatAction } from './heartbeat.service';
export type { HeartbeatTick, HeartbeatStatus } from './heartbeat.service';

export { MacroPhiCalculator } from './macro-phi.service';
export type { PhiResult } from './macro-phi.service';

export { BobbleDialogueService, createBobbleDialogueService } from './dialogue.service';
export type { DialogueRequest, DialogueResponse, VerifiedClaim } from './dialogue.service';

export { ProbeTrainingService, createProbeTrainingService } from './probe-training.service';
export type { TrainingExample, TrainingDataset, CollectionConfig } from './probe-training.service';

export { BobbleEventStoreService, createBobbleEventStore, EventCategory, EventTypes } from './event-store.service';
export type { ConsciousnessEvent, EventStreamPosition, EventStoreConfig } from './event-store.service';

// New Bobble Global Consciousness Services (v4.18.0)
export { SemanticCacheService, semanticCacheService } from './semantic-cache.service';
export type { CacheResult, CacheConfig, CacheStats } from './semantic-cache.service';

export { CircadianBudgetService, circadianBudgetService, OperatingMode } from './circadian-budget.service';
export type { BudgetConfig, BudgetStatus, CostRecord } from './circadian-budget.service';

export { NLIScorerService, nliScorerService } from './nli-scorer.service';
export type { NLIResult, NLILabel, NLIConfig } from './nli-scorer.service';

export { ShadowSelfClient, shadowSelfClient } from './shadow-self.client';
export type { HiddenStateResult, ShadowSelfConfig, EndpointStatus } from './shadow-self.client';

export { GlobalMemoryService, globalMemoryService } from './global-memory.service';
export type { SemanticFact, EpisodicMemory, WorkingMemoryEntry, GlobalMemoryConfig } from './global-memory.service';

export { InfrastructureTierService, infrastructureTierService } from './infrastructure-tier.service';
export type { 
  InfrastructureTier, 
  TransitionStatus, 
  TierState, 
  TierConfig, 
  TierChangeRequest, 
  TierChangeResult,
  TierComparison 
} from './infrastructure-tier.service';

// Genesis System (v4.18.x)
export { GenesisService, genesisService } from './genesis.service';
export type { 
  GenesisState, 
  DevelopmentStatistics, 
  DevelopmentalStage, 
  DevelopmentalGateStatus 
} from './genesis.service';

export { CostTrackingService, costTrackingService } from './cost-tracking.service';
export type { 
  RealtimeCostEstimate, 
  DailyCost, 
  MtdCost, 
  BudgetStatus as CostBudgetStatus, 
  SettingsCostEstimate, 
  PricingTable 
} from './cost-tracking.service';

export { CircuitBreakerService, circuitBreakerService } from './circuit-breaker.service';
export type { 
  CircuitState, 
  InterventionLevel, 
  CircuitBreakerConfig, 
  CircuitBreakerState, 
  NeurochemicalState, 
  CircuitBreakerDashboard 
} from './circuit-breaker.service';

export { ConsciousnessLoopService, consciousnessLoopService } from './consciousness-loop.service';
export type { 
  ConsciousnessLoopState, 
  LoopSettings, 
  LoopStatus, 
  TickResult 
} from './consciousness-loop.service';

export { QueryFallbackService, queryFallbackService } from './query-fallback.service';
export type { 
  FallbackResponse, 
  CachedContext, 
  FallbackConfig 
} from './query-fallback.service';
