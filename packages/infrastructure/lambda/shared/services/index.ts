/**
 * RADIANT v4.18.0 - Services Index
 * 
 * Unified export point for all services.
 * For better tree-shaking and organization, prefer importing from domain-specific barrels:
 * - ./agi       - AGI, consciousness, learning services
 * - ./core      - Database, cache, config, observability
 * - ./platform  - Business features, billing, collaboration
 * - ./models    - Model routing, selection, ML services
 */

// ============================================================================
// Domain-Specific Barrel Re-exports
// ============================================================================

// AGI Services (consciousness, learning, orchestration, ethics)
export * from './agi';

// Core Infrastructure Services (database, cache, config, observability)
export * from './core';

// Platform Services (billing, collaboration, workflows)
export * from './platform';

// Model Services (routing, selection, ML, thermal)
export * from './models';

// ============================================================================
// Domain Taxonomy & Specialty
// ============================================================================

export { SpecialtyRankingService, specialtyRankingService, SPECIALTY_CATEGORIES, type SpecialtyCategory, type SpecialtyRanking } from './specialty-ranking.service';
export { DomainTaxonomyService, domainTaxonomyService } from './domain-taxonomy.service';

// ============================================================================
// Delight System
// ============================================================================

export { DelightService, delightService } from './delight.service';
export { DelightOrchestrationService, delightOrchestrationService } from './delight-orchestration.service';
export { DelightEventsService, delightEventsService, createDelightEventStream, emitDelightForPlanExecution } from './delight-events.service';

// ============================================================================
// AGI Orchestration Settings & Brain Planning
// ============================================================================

export { AGIOrchestrationSettingsService, agiOrchestrationSettingsService } from './agi-orchestration-settings.service';
export { AGIBrainPlannerService, agiBrainPlannerService } from './agi-brain-planner.service';
export { ArtifactPipelineService, artifactPipeline } from './artifact-pipeline.service';
export { AGIResponsePipelineService, agiResponsePipeline } from './agi-response-pipeline.service';

// ============================================================================
// Genesis Cato Safety Architecture
// ============================================================================

export { 
  catoSafetyPipeline,
  CatoSafetyPipeline,
} from './cato/safety-pipeline.service';
export { 
  precisionGovernorService,
  PrecisionGovernorService,
} from './cato/precision-governor.service';
export { 
  controlBarrierService,
  ControlBarrierService,
} from './cato/control-barrier.service';
export { 
  epistemicRecoveryService,
  EpistemicRecoveryService,
} from './cato/epistemic-recovery.service';
export { 
  sensoryVetoService,
  SensoryVetoService,
} from './cato/sensory-veto.service';
export { 
  adaptiveEntropyService,
  AdaptiveEntropyService,
} from './cato/adaptive-entropy.service';
export { 
  redundantPerceptionService,
  RedundantPerceptionService,
} from './cato/redundant-perception.service';
export { 
  fractureDetectionService,
  FractureDetectionService,
} from './cato/fracture-detection.service';
export { 
  merkleAuditService as catoMerkleAuditService,
  MerkleAuditService as CatoMerkleAuditService,
} from './cato/merkle-audit.service';
export { 
  personaService as catoPersonaService,
  PersonaService as CatoPersonaService,
} from './cato/persona.service';
export { 
  catoStateService,
} from './cato/redis.service';

// ============================================================================
// Cedar Authorization (Gateway ABAC)
// ============================================================================

export {
  CedarAuthorizationService,
  getCedarAuthorizationService,
  type Principal,
  type PrincipalType,
  type ActionType,
  type Resource,
  type ToolResource,
  type ModelResource,
  type SessionResource,
  type TenantResource,
  type AuthorizationContext,
  type AuthorizationRequest,
  type AuthorizationResult,
} from './cedar';

// ============================================================================
// Types
// ============================================================================

export * from '../types/agi-response.types';
