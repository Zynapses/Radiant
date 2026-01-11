/**
 * Polymorphic UI Types (PROMPT-41)
 * 
 * Shared types for Think Tank's Polymorphic UI system.
 * The UI physically transforms based on task complexity, domain hints, and drive profile.
 */

/**
 * Available UI view types that the interface can morph into.
 */
export type ViewType = 
  | 'terminal_simple'   // 🎯 Sniper Mode - Command Center
  | 'mindmap'           // 🔭 Scout Mode - Infinite Canvas
  | 'diff_editor'       // 📜 Sage Mode - Split-Screen Verification
  | 'dashboard'         // Analytics & Metrics
  | 'decision_cards'    // HITL Mission Control
  | 'chat';             // Default conversation

/**
 * Execution mode determines cost and architecture.
 */
export type ExecutionMode = 'sniper' | 'war_room';

/**
 * Domain hints for compliance routing.
 */
export type DomainHint = 'medical' | 'financial' | 'legal' | 'general';

/**
 * Escalation reasons for Sniper → War Room transitions.
 */
export type EscalationReason = 
  | 'insufficient_depth'
  | 'factual_doubt'
  | 'need_alternatives'
  | 'compliance_required'
  | 'user_requested';

/**
 * Current state of the polymorphic view.
 */
export interface ViewState {
  viewType: ViewType;
  executionMode: ExecutionMode;
  dataPayload: Record<string, unknown>;
  rationale?: string;
  estimatedCostCents?: number;
  domainHint?: DomainHint;
}

/**
 * Polymorphic route decision from Economic Governor.
 */
export interface PolymorphicViewDecision {
  viewType: ViewType;
  executionMode: ExecutionMode;
  rationale: string;
  estimatedCostCents: number;
  domainHint?: DomainHint;
}

/**
 * Combined routing and view decision.
 */
export interface PolymorphicRouteDecision extends PolymorphicViewDecision {
  routeType: 'sniper' | 'war_room' | 'hitl';
  selectedModel: string;
  complexityScore: number;
  retrievalConfidence?: number;
  ghostHit?: boolean;
}

/**
 * View state history record (matches database schema).
 */
export interface ViewStateHistoryRecord {
  id: string;
  tenantId: string;
  projectId: string;
  sessionId: string;
  viewType: ViewType;
  executionMode: ExecutionMode;
  domainHint: DomainHint;
  rationale?: string;
  queryText?: string;
  queryHash?: string;
  estimatedCostCents: number;
  actualCostCents?: number;
  dataPayloadSizeBytes?: number;
  createdAt: Date;
  completedAt?: Date;
  durationMs?: number;
  userSatisfied?: boolean;
  userEscalated: boolean;
}

/**
 * Execution escalation record (matches database schema).
 */
export interface ExecutionEscalationRecord {
  id: string;
  tenantId: string;
  projectId: string;
  sessionId: string;
  sniperResponseId: string;
  originalQuery: string;
  sniperResponse?: string;
  sniperCostCents?: number;
  escalationReason: EscalationReason;
  additionalContext?: string;
  warRoomResponse?: string;
  warRoomCostCents?: number;
  warRoomSuccessful?: boolean;
  userSatisfied?: boolean;
  escalatedAt: Date;
  warRoomStartedAt?: Date;
  warRoomCompletedAt?: Date;
  viewStateId?: string;
}

/**
 * Per-tenant polymorphic UI configuration (matches database schema).
 */
export interface PolymorphicConfig {
  tenantId: string;
  enableAutoMorphing: boolean;
  enableGearboxToggle: boolean;
  enableCostDisplay: boolean;
  enableEscalationButton: boolean;
  defaultExecutionMode: ExecutionMode;
  defaultViewType: ViewType;
  sniperCostLimitCents: number;
  warRoomCostLimitCents: number;
  domainViewOverrides: Record<DomainHint, ViewType>;
  trackViewTransitions: boolean;
  trackEscalationReasons: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Render interface MCP tool parameters.
 */
export interface RenderInterfaceParams {
  view_type: ViewType;
  execution_mode: ExecutionMode;
  data_payload: Record<string, unknown>;
  rationale?: string;
  domain_hint?: DomainHint;
  estimated_cost_cents?: number;
}

/**
 * Escalate to War Room MCP tool parameters.
 */
export interface EscalateToWarRoomParams {
  original_query: string;
  sniper_response_id: string;
  escalation_reason: EscalationReason;
  additional_context?: string;
}

/**
 * Get polymorphic route MCP tool parameters.
 */
export interface GetPolymorphicRouteParams {
  query: string;
  user_tier?: string;
  retrieval_confidence?: number;
  ghost_hit?: boolean;
  domain_hint?: DomainHint;
  user_override?: ExecutionMode;
}

/**
 * View analytics result from database function.
 */
export interface ViewAnalytics {
  viewType: ViewType;
  executionMode: ExecutionMode;
  totalCount: number;
  avgCostCents: number;
  avgDurationMs: number;
  escalationRate: number;
  satisfactionRate: number;
}

/**
 * Escalation analytics result from database function.
 */
export interface EscalationAnalytics {
  escalationReason: EscalationReason;
  totalCount: number;
  avgSniperCostCents: number;
  avgWarRoomCostCents: number;
  successRate: number;
  satisfactionRate: number;
}
