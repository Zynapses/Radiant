// API Services Index
export { api } from './client';
export { chatService } from './chat';
export { modelsService } from './models';
export { rulesService } from './rules';
export { settingsService } from './settings';
export { brainPlanService } from './brain-plan';
export { analyticsService } from './analytics';
export { governorService } from './governor';

// v5.52.16 - New API Services (previously unwired)
export { timeTravelService } from './time-travel';
export { grimoireService } from './grimoire';
export { flashFactsService } from './flash-facts';
export { derivationHistoryService } from './derivation-history';
export { collaborationService } from './collaboration';
export { artifactsService } from './artifacts';
export { ideasService } from './ideas';
export { exportConversation, getConversationArtifacts } from './compliance-export';

// Types
export * from './types';
export type { ExportFormat, ExportOptions, ExportResult } from './compliance-export';
export type { Timeline, Checkpoint, Fork } from './time-travel';
export type { Spell, SpellVariable } from './grimoire';
export type { FlashFact, FlashFactCollection } from './flash-facts';
export type { DerivationChain, DerivationNode, ProvenanceReport } from './derivation-history';
export type { CollaborationSession, Participant } from './collaboration';
export type { Artifact, ArtifactVersion } from './artifacts';
export type { Idea, IdeaBoard } from './ideas';
