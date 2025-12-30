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
