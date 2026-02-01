/**
 * Workflow Services Index
 * RADIANT v5.53.0
 * 
 * Exports all workflow-related services including UEP integration,
 * Gemini enhancements (sidecars, sandboxed expressions, CRDTs, etc.)
 */

// UEP Node Service - Central UEP integration for workflows
export {
  UEPNodeService,
  uepNodeService,
  type WorkflowUEPEnvelope,
  type StreamOutput,
  type NodeType,
  type NodeCondition,
  type StreamEvaluationMode,
  type StreamEvaluationConfig,
  type ConditionAction,
  type EnvelopeTransform,
  type ConditionEvaluationResult,
  type NodeExecutionContext,
} from './uep-node.service.js';

// Multimedia Sidecar Service - Cognitive sidecars for cross-modal AI
export {
  multimediaSidecarService,
  type CognitiveSidecar,
  type MultimediaStream,
  type MediaType,
  type SidecarStatus,
  type BridgeResult,
  type SidecarGenerationOptions,
} from './multimedia-sidecar.service.js';

// Sandboxed Expression Engine - Safe condition evaluation
export {
  sandboxedExpressionService,
  type EvaluationContext,
  type EvaluationResult,
} from './sandboxed-expression.service.js';

// Vector Semantic Router - Semantic similarity for routing decisions
export {
  vectorSemanticRouterService,
  type SemanticVector,
  type VectorMatch,
  type RoutingRecommendation,
} from './vector-semantic-router.service.js';

// Enhanced Uncertainty Service - Surprise metrics for Semantic Entropy
export {
  enhancedUncertaintyService,
  type UncertaintyMetrics,
  type EnhancedEntropyResult,
  type EntropyParams,
} from './enhanced-uncertainty.service.js';

// Cost Negotiation Service - Budget-aware model selection
export {
  costNegotiationService,
  type ModelBid,
  type BudgetAllocation,
  type NegotiationRequest,
  type NegotiationResult,
} from './cost-negotiation.service.js';

// CRDT Workflow Service - Real-time collaborative editing
export {
  crdtWorkflowService,
  type CRDTOperation,
  type CRDTWorkflowState,
  type WorkflowNode,
  type WorkflowEdge,
  type CollaboratorPresence,
  type VectorClock,
} from './crdt-workflow.service.js';
