/**
 * RADIANT v6.1.0 - Cognition Services Index
 * Exports all cognitive enhancement services.
 */

// Core distillation pipeline
export { reasoningTeacher, ReasoningTeacherService } from '../reasoning-teacher.service';
export { inferenceStudent, InferenceStudentService } from '../inference-student.service';

// Caching layer
export { semanticCache, SemanticCacheService } from '../semantic-cache.service';

// Cognitive services
export { rewardModel, RewardModelService } from '../reward-model.service';

// Metacognition
export { metacognitionService, MetacognitionService } from '../metacognition.service';

// Advanced analytics
export { counterfactualSimulator, CounterfactualSimulatorService } from '../counterfactual-simulator.service';
export { curiosityEngine, CuriosityEngineService } from '../curiosity-engine.service';
export { causalTracker, CausalTrackerService } from '../causal-tracker.service';

// Integration
export { enhancedInference } from './integration';

// Types re-export
export type {
  TeacherModelId,
  TeacherConfig,
  ReasoningTrace,
  AlternativePath,
  StudentVersion,
  StudentInferenceRequest,
  StudentInferenceResponse,
  SemanticCacheEntry,
  ContentType,
  CacheTTLConfig,
  CacheMetrics,
  ConfidenceAssessment,
  EscalationDecision,
  SelfCorrectionResult,
  CorrectionStep,
  RewardContext,
  RewardScore,
  RewardTrainingData,
  CounterfactualResult,
  KnowledgeGap,
  Goal,
  GoalType,
  GoalStatus,
  Milestone,
  GoalGuardrails,
  CausalType,
  CausalLink,
  CausalChain,
  CausalNode,
  CausalEdge,
  DistillationJob,
  DistillationJobStatus,
  InferenceContext,
} from '@radiant/shared';

// Constants re-export
export {
  DEFAULT_TEACHER_CONFIG,
  TEACHER_MODEL_COSTS,
  STUDENT_BASE_MODELS,
  STUDENT_TRAINING_CONFIG,
  STUDENT_INFERENCE_DEFAULTS,
  CACHE_TTL_CONFIGS,
  CACHE_SIMILARITY_THRESHOLD,
  CACHE_EMBEDDING_DIMENSION,
  CACHE_MAX_ENTRIES_PER_TENANT,
  METACOGNITION_THRESHOLDS,
  ESCALATION_TARGETS,
  REWARD_MODEL_CONFIG,
  REWARD_DIMENSION_WEIGHTS,
  COUNTERFACTUAL_SAMPLING_STRATEGIES,
  COUNTERFACTUAL_MAX_DAILY_SIMULATIONS,
  DEFAULT_GOAL_GUARDRAILS,
  CAUSAL_DETECTION_PATTERNS,
  CAUSAL_CHAIN_MAX_DEPTH,
  CAUSAL_IMPORTANCE_DECAY,
  DISTILLATION_CONFIG,
} from '@radiant/shared';
