/**
 * Bobble Consciousness Service - Public API
 * 
 * High-Confidence Self-Referential Consciousness Dialogue Service
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
