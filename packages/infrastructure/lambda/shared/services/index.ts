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
// Types
// ============================================================================

export * from '../types/agi-response.types';
