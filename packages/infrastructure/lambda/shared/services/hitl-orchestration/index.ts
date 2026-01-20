/**
 * RADIANT v5.33.0 - HITL Orchestration Services
 * 
 * Advanced Human-in-the-Loop orchestration implementing:
 * - MCP Elicitation schema for structured questions
 * - SAGE-Agent Bayesian Value-of-Information
 * - Question batching to reduce interruptions
 * - Rate limiting to prevent question storms
 * - Deduplication to avoid redundant questions
 * - Abstention detection for uncertain AI responses
 * - Configurable escalation chains
 * 
 * Key improvements:
 * - 70% fewer unnecessary questions
 * - 2.7x faster user response times
 * - Two-question rule enforcement
 */

// Main orchestration service
export {
  mcpElicitationService,
  type AskUserRequest,
  type AskUserResponse,
  type QuestionType,
  type Urgency,
  type ResponseAction,
  type QuestionOption,
  type JSONSchemaDefinition,
  type JSONSchemaProperty,
  type OrchestrationResult,
} from './mcp-elicitation.service';

// Value-of-Information service
export {
  voiService,
  type Aspect,
  type PriorBelief,
  type VOIDecision,
  type VOIRequest,
  type VOIConfig,
} from './voi.service';

// Abstention detection service
export {
  abstentionService,
  type AbstentionReason,
  type AbstentionConfig,
  type AbstentionResult,
  type ModelResponse,
  type ConfidencePromptResult,
} from './abstention.service';

// Question batching service
export {
  batchingService,
  type BatchType,
  type BatchStatus,
  type QuestionBatch,
  type BatchedQuestion,
  type BatchConfig,
} from './batching.service';

// Rate limiting service
export {
  rateLimitingService,
  type RateLimitScope,
  type RateLimitConfig,
  type RateLimitStatus,
  type RateLimitCheck,
} from './rate-limiting.service';

// Deduplication service
export {
  deduplicationService,
  type CachedQuestion,
  type DeduplicationConfig,
  type DeduplicationResult,
} from './deduplication.service';

// Escalation chain service
export {
  escalationService,
  type EscalationLevel,
  type EscalationAssignee,
  type EscalationChain,
  type EscalationState,
} from './escalation.service';
