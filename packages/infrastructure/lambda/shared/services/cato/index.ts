/**
 * RADIANT Genesis Cato Safety Architecture
 * Core service exports
 *
 * THREE-LAYER NAMING:
 * 1. CATO = User-facing AI persona name (users talk to "Cato")
 * 2. GENESIS CATO = Safety architecture/system (these services)
 * 3. MOODS = Operating modes (Balanced, Scout, Sage, Spark, Guide)
 */

export * from './precision-governor.service';
export * from './epistemic-recovery.service';
export * from './control-barrier.service';
export * from './sensory-veto.service';
export * from './persona.service';
export * from './merkle-audit.service';
export * from './adaptive-entropy.service';
export * from './redundant-perception.service';
export * from './fracture-detection.service';
export * from './safety-pipeline.service';
export * from './redis.service';
export * from './hitl-integration.service';
export * from './scout-hitl-integration.service';
export * from './neural-decision.service';
export * from './types';

// Dialogue and Consciousness Services
export * from './dialogue.service';
export * from './genesis.service';
export * from './cost-tracking.service';
export * from './circuit-breaker.service';
export * from './query-fallback.service';
export * from './consciousness-loop.service';

// Global Services
export * from './circadian-budget.service';
export * from './semantic-cache.service';
export * from './global-memory.service';
export * from './shadow-self.service';
export * from './nli-scorer.service';

// Operating Mode Enum
export enum OperatingMode {
  BALANCED = 'BALANCED',
  SCOUT = 'SCOUT',
  SAGE = 'SAGE',
  SPARK = 'SPARK',
  GUIDE = 'GUIDE',
  EMERGENCY = 'EMERGENCY',
}
