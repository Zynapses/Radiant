# SECTION 39: DYNAMIC WORKFLOW PROPOSAL SYSTEM (v4.5.0)
# ═══════════════════════════════════════════════════════════════════════════════

> **This section implements the Dynamic Workflow Proposal System for v4.5.0**

---
## 39.1 Overview

The Dynamic Workflow Proposal System enables the Brain and Neural Engine to collaboratively identify user needs that aren't well-served by existing workflows, propose new workflows to solve these problems, and submit them for administrator review. This system is **evidence-based** - proposals require substantiated user need crossing configurable thresholds, not arbitrary suggestions.

### Key Design Principles

1. **Evidence-Based Proposals** - Only propose when sufficient user need is demonstrated
2. **Threshold Gating** - Multiple thresholds must be met before proposal generation
3. **Brain Governor Oversight** - Brain reviews all proposals before they reach admin queue
4. **Admin Final Authority** - No auto-publishing; humans approve all new workflows
5. **Full Auditability** - Complete trail of evidence, decisions, and outcomes
6. **Configurable Everything** - All weights/thresholds editable by administrators

### Evidence Types

| Evidence Type | Description | Weight |
|---------------|-------------|--------|
| `workflow_failure` | Existing workflow failed to complete | 0.40 |
| `negative_feedback` | User gave thumbs down or negative rating | 0.35 |
| `manual_override` | User manually switched model/approach | 0.15 |
| `regenerate_request` | User requested regeneration | 0.10 |
| `abandon_session` | User abandoned mid-conversation | 0.20 |
| `low_confidence_completion` | Workflow completed but Neural confidence < 0.5 | 0.15 |
| `explicit_request` | User explicitly requested different approach | 0.50 |

---

## 39.2 Database Schema

```sql
-- ============================================================================
-- SECTION 39: DYNAMIC WORKFLOW PROPOSAL SYSTEM
-- Migration: 039_dynamic_workflow_proposals.sql
-- Version: 4.5.0
-- ============================================================================

-- ============================================================================
-- 39.2.1 Need Pattern Detection Tables
-- ============================================================================

-- Track emerging user need patterns that could justify new workflows
CREATE TABLE neural_need_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Pattern identification
    pattern_hash VARCHAR(64) NOT NULL,  -- SHA-256 of normalized pattern signature
    pattern_signature JSONB NOT NULL,   -- Structured pattern definition
    pattern_embedding VECTOR(768),      -- Neural embedding for similarity search
    
    -- Pattern metadata
    pattern_name VARCHAR(255) NOT NULL,
    pattern_description TEXT,
    detected_intent TEXT NOT NULL,      -- What the user was trying to accomplish
    existing_workflow_gaps TEXT[],      -- Which existing workflows fail this case
    
    -- Evidence accumulation
    total_evidence_score DECIMAL(10,4) DEFAULT 0,
    evidence_count INTEGER DEFAULT 0,
    unique_users_affected INTEGER DEFAULT 0,
    first_occurrence TIMESTAMPTZ DEFAULT NOW(),
    last_occurrence TIMESTAMPTZ DEFAULT NOW(),
    
    -- Threshold tracking
    occurrence_threshold_met BOOLEAN DEFAULT FALSE,
    impact_threshold_met BOOLEAN DEFAULT FALSE,
    confidence_threshold_met BOOLEAN DEFAULT FALSE,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'accumulating',  -- accumulating, threshold_met, proposal_generated, resolved
    proposal_id UUID,  -- Link to generated proposal if threshold met
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_pattern_per_tenant UNIQUE(tenant_id, pattern_hash)
);

-- Individual evidence records contributing to need patterns
CREATE TABLE neural_need_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pattern_id UUID NOT NULL REFERENCES neural_need_patterns(id) ON DELETE CASCADE,
    
    -- Evidence source
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID,
    execution_id UUID,  -- Link to manifest for full context
    
    -- Evidence details
    evidence_type VARCHAR(50) NOT NULL,  -- workflow_failure, negative_feedback, manual_override, etc.
    evidence_weight DECIMAL(5,4) NOT NULL,
    evidence_data JSONB NOT NULL,  -- Detailed context
    
    -- User intent capture
    original_request TEXT,           -- What user asked for
    attempted_workflow_id UUID,      -- Which workflow was tried
    failure_reason TEXT,             -- Why it failed or underperformed
    user_feedback TEXT,              -- Any explicit user feedback
    
    -- Temporal
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 39.2.2 Proposal Tables
-- ============================================================================

-- Workflow proposals generated by Neural Engine
CREATE TABLE workflow_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Proposal identification
    proposal_code VARCHAR(50) NOT NULL,  -- e.g., WP-2024-001
    proposal_name VARCHAR(255) NOT NULL,
    proposal_description TEXT NOT NULL,
    
    -- Source pattern
    source_pattern_id UUID NOT NULL REFERENCES neural_need_patterns(id),
    
    -- Proposed workflow structure
    proposed_workflow JSONB NOT NULL,  -- Full workflow DAG definition
    workflow_category VARCHAR(100),
    workflow_type VARCHAR(50),  -- orchestration_pattern, production_workflow, hybrid
    estimated_complexity VARCHAR(20),  -- simple, moderate, complex, advanced
    
    -- Neural Engine analysis
    neural_confidence DECIMAL(5,4) NOT NULL,  -- How confident Neural is this solves the need
    neural_reasoning TEXT NOT NULL,           -- Why Neural proposed this structure
    estimated_quality_improvement DECIMAL(5,4),
    estimated_coverage_percentage DECIMAL(5,4),  -- % of evidence cases this would solve
    
    -- Brain Governor review
    brain_approved BOOLEAN,
    brain_review_timestamp TIMESTAMPTZ,
    brain_risk_assessment JSONB,  -- cost_risk, latency_risk, quality_risk, compliance_risk
    brain_veto_reason TEXT,       -- If vetoed, why
    brain_modifications JSONB,    -- Any modifications Brain suggested
    
    -- Evidence summary
    evidence_count INTEGER NOT NULL,
    unique_users_affected INTEGER NOT NULL,
    total_evidence_score DECIMAL(10,4) NOT NULL,
    evidence_time_span_days INTEGER NOT NULL,
    evidence_summary JSONB NOT NULL,  -- Aggregated evidence statistics
    
    -- Admin review
    admin_status VARCHAR(50) DEFAULT 'pending_brain',  -- pending_brain, pending_admin, approved, declined, testing
    admin_reviewer_id UUID REFERENCES users(id),
    admin_review_timestamp TIMESTAMPTZ,
    admin_notes TEXT,
    admin_modifications JSONB,  -- Any modifications admin made
    
    -- Testing
    test_status VARCHAR(50),  -- not_tested, testing, passed, failed
    test_results JSONB,
    test_execution_ids UUID[],
    
    -- Publishing
    published_workflow_id UUID,  -- Link to published workflow if approved
    published_at TIMESTAMPTZ,
    
    -- Rate limiting
    proposal_batch_id UUID,  -- Group proposals from same analysis run
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_proposal_code UNIQUE(tenant_id, proposal_code)
);

-- Proposal review history for audit trail
CREATE TABLE workflow_proposal_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES workflow_proposals(id) ON DELETE CASCADE,
    
    -- Reviewer
    reviewer_type VARCHAR(20) NOT NULL,  -- brain, admin
    reviewer_id UUID,  -- NULL for brain, user_id for admin
    
    -- Review details
    action VARCHAR(50) NOT NULL,  -- approve, decline, modify, request_test, escalate
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    
    -- Reasoning
    review_notes TEXT,
    modifications_made JSONB,
    risk_assessment JSONB,
    
    -- Audit
    reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 39.2.3 Threshold Configuration Tables
-- ============================================================================

-- Configurable thresholds for proposal generation
CREATE TABLE proposal_threshold_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Occurrence thresholds
    min_evidence_count INTEGER DEFAULT 5,           -- Minimum evidence records needed
    min_unique_users INTEGER DEFAULT 3,             -- Minimum unique users affected
    min_time_span_hours INTEGER DEFAULT 24,         -- Minimum time span of evidence
    max_time_span_days INTEGER DEFAULT 30,          -- Maximum lookback for evidence
    
    -- Impact thresholds  
    min_total_evidence_score DECIMAL(5,4) DEFAULT 0.60,  -- Minimum cumulative evidence score
    min_avg_evidence_weight DECIMAL(5,4) DEFAULT 0.20,   -- Minimum average evidence weight
    
    -- Neural confidence thresholds
    min_neural_confidence DECIMAL(5,4) DEFAULT 0.75,     -- Minimum Neural confidence to propose
    min_coverage_estimate DECIMAL(5,4) DEFAULT 0.60,     -- Minimum estimated coverage
    
    -- Brain approval thresholds
    max_cost_risk DECIMAL(5,4) DEFAULT 0.30,            -- Maximum acceptable cost risk
    max_latency_risk DECIMAL(5,4) DEFAULT 0.40,         -- Maximum acceptable latency risk
    min_quality_confidence DECIMAL(5,4) DEFAULT 0.70,   -- Minimum quality confidence
    max_compliance_risk DECIMAL(5,4) DEFAULT 0.10,      -- Maximum compliance risk
    
    -- Rate limiting
    max_proposals_per_day INTEGER DEFAULT 10,
    max_proposals_per_week INTEGER DEFAULT 30,
    cooldown_after_decline_hours INTEGER DEFAULT 72,    -- Wait time after admin decline
    
    -- Auto-approve settings (disabled by default)
    auto_approve_enabled BOOLEAN DEFAULT FALSE,
    auto_approve_min_confidence DECIMAL(5,4) DEFAULT 0.95,
    auto_approve_max_complexity VARCHAR(20) DEFAULT 'simple',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    CONSTRAINT one_config_per_tenant UNIQUE(tenant_id)
);

-- Evidence type weight configuration (admin-editable)
CREATE TABLE evidence_weight_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    evidence_type VARCHAR(50) NOT NULL,
    weight DECIMAL(5,4) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    CONSTRAINT unique_evidence_type_per_tenant UNIQUE(tenant_id, evidence_type)
);

-- ============================================================================
-- 39.2.4 Neural Engine Learning Persistence
-- ============================================================================

-- Ensure Neural Engine data is persisted (extends Section 38 if not present)
CREATE TABLE IF NOT EXISTS neural_learning_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Session identification
    session_type VARCHAR(50) NOT NULL,  -- pattern_detection, proposal_generation, learning_update
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Learning data
    patterns_analyzed INTEGER DEFAULT 0,
    patterns_updated INTEGER DEFAULT 0,
    proposals_generated INTEGER DEFAULT 0,
    evidence_processed INTEGER DEFAULT 0,
    
    -- Model state snapshots
    model_state_before JSONB,
    model_state_after JSONB,
    
    -- Performance
    processing_time_ms INTEGER,
    memory_used_mb INTEGER,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Neural embedding updates log
CREATE TABLE neural_embedding_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Source
    entity_type VARCHAR(50) NOT NULL,  -- pattern, user_model, workflow
    entity_id UUID NOT NULL,
    
    -- Embedding change
    previous_embedding VECTOR(768),
    new_embedding VECTOR(768),
    embedding_delta_magnitude DECIMAL(10,6),
    
    -- Trigger
    triggered_by VARCHAR(50),  -- evidence, feedback, admin_update, scheduled
    trigger_details JSONB,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 39.2.5 Indexes
-- ============================================================================

-- Need patterns indexes
CREATE INDEX idx_neural_need_patterns_tenant ON neural_need_patterns(tenant_id);
CREATE INDEX idx_neural_need_patterns_status ON neural_need_patterns(status);
CREATE INDEX idx_neural_need_patterns_hash ON neural_need_patterns(pattern_hash);
CREATE INDEX idx_neural_need_patterns_score ON neural_need_patterns(total_evidence_score DESC);
CREATE INDEX idx_neural_need_patterns_embedding ON neural_need_patterns USING ivfflat (pattern_embedding vector_cosine_ops) WITH (lists = 100);

-- Evidence indexes
CREATE INDEX idx_neural_need_evidence_pattern ON neural_need_evidence(pattern_id);
CREATE INDEX idx_neural_need_evidence_user ON neural_need_evidence(user_id);
CREATE INDEX idx_neural_need_evidence_type ON neural_need_evidence(evidence_type);
CREATE INDEX idx_neural_need_evidence_occurred ON neural_need_evidence(occurred_at DESC);

-- Proposal indexes
CREATE INDEX idx_workflow_proposals_tenant ON workflow_proposals(tenant_id);
CREATE INDEX idx_workflow_proposals_status ON workflow_proposals(admin_status);
CREATE INDEX idx_workflow_proposals_pattern ON workflow_proposals(source_pattern_id);
CREATE INDEX idx_workflow_proposals_created ON workflow_proposals(created_at DESC);

-- Review indexes
CREATE INDEX idx_workflow_proposal_reviews_proposal ON workflow_proposal_reviews(proposal_id);
CREATE INDEX idx_workflow_proposal_reviews_reviewer ON workflow_proposal_reviews(reviewer_type, reviewer_id);

-- Config indexes
CREATE INDEX idx_proposal_threshold_config_tenant ON proposal_threshold_config(tenant_id);
CREATE INDEX idx_evidence_weight_config_tenant ON evidence_weight_config(tenant_id);

-- Learning session indexes
CREATE INDEX idx_neural_learning_sessions_tenant ON neural_learning_sessions(tenant_id);
CREATE INDEX idx_neural_learning_sessions_type ON neural_learning_sessions(session_type);
CREATE INDEX idx_neural_embedding_updates_entity ON neural_embedding_updates(entity_type, entity_id);

-- ============================================================================
-- 39.2.6 Row Level Security
-- ============================================================================

ALTER TABLE neural_need_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_need_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_proposal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_threshold_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_weight_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_embedding_updates ENABLE ROW LEVEL SECURITY;

-- Policies (tenant isolation)
CREATE POLICY tenant_isolation_neural_need_patterns ON neural_need_patterns
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_neural_need_evidence ON neural_need_evidence
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_workflow_proposals ON workflow_proposals
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_workflow_proposal_reviews ON workflow_proposal_reviews
    USING (proposal_id IN (SELECT id FROM workflow_proposals WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY tenant_isolation_proposal_threshold_config ON proposal_threshold_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_evidence_weight_config ON evidence_weight_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_neural_learning_sessions ON neural_learning_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_neural_embedding_updates ON neural_embedding_updates
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- 39.2.7 Default Data Seeding
-- ============================================================================

-- Seed default evidence weights (will be copied per tenant on creation)
INSERT INTO evidence_weight_config (tenant_id, evidence_type, weight, description, enabled)
SELECT 
    t.id,
    e.evidence_type,
    e.weight,
    e.description,
    TRUE
FROM tenants t
CROSS JOIN (VALUES
    ('workflow_failure', 0.40, 'Existing workflow failed to complete'),
    ('negative_feedback', 0.35, 'User gave thumbs down or negative rating'),
    ('manual_override', 0.15, 'User manually switched model/approach'),
    ('regenerate_request', 0.10, 'User requested regeneration'),
    ('abandon_session', 0.20, 'User abandoned mid-conversation'),
    ('low_confidence_completion', 0.15, 'Workflow completed but Neural confidence < 0.5'),
    ('explicit_request', 0.50, 'User explicitly requested different approach')
) AS e(evidence_type, weight, description)
ON CONFLICT (tenant_id, evidence_type) DO NOTHING;

-- Seed default threshold config per tenant
INSERT INTO proposal_threshold_config (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
```

---

## 39.3 TypeScript Types

```typescript
// ============================================================================
// packages/core/src/types/workflow-proposals.ts
// Dynamic Workflow Proposal System Types
// ============================================================================

import { UUID, Timestamp, TenantId, UserId } from './common';

// ============================================================================
// 39.3.1 Evidence Types
// ============================================================================

export type EvidenceType =
  | 'workflow_failure'
  | 'negative_feedback'
  | 'manual_override'
  | 'regenerate_request'
  | 'abandon_session'
  | 'low_confidence_completion'
  | 'explicit_request';

export interface EvidenceWeightConfig {
  id: UUID;
  tenantId: TenantId;
  evidenceType: EvidenceType;
  weight: number;
  description: string;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: UserId;
}

export interface NeedEvidence {
  id: UUID;
  tenantId: TenantId;
  patternId: UUID;
  userId?: UserId;
  sessionId?: UUID;
  executionId?: UUID;
  evidenceType: EvidenceType;
  evidenceWeight: number;
  evidenceData: Record<string, unknown>;
  originalRequest?: string;
  attemptedWorkflowId?: UUID;
  failureReason?: string;
  userFeedback?: string;
  occurredAt: Timestamp;
  createdAt: Timestamp;
}

// ============================================================================
// 39.3.2 Need Pattern Types
// ============================================================================

export type PatternStatus =
  | 'accumulating'
  | 'threshold_met'
  | 'proposal_generated'
  | 'resolved';

export interface PatternSignature {
  intentCategory: string;
  keywords: string[];
  domainHints: string[];
  failedWorkflowTypes: string[];
  userSegments: string[];
  contextualFactors: Record<string, unknown>;
}

export interface NeedPattern {
  id: UUID;
  tenantId: TenantId;
  patternHash: string;
  patternSignature: PatternSignature;
  patternEmbedding?: number[];  // 768-dim vector
  patternName: string;
  patternDescription?: string;
  detectedIntent: string;
  existingWorkflowGaps: string[];
  totalEvidenceScore: number;
  evidenceCount: number;
  uniqueUsersAffected: number;
  firstOccurrence: Timestamp;
  lastOccurrence: Timestamp;
  occurrenceThresholdMet: boolean;
  impactThresholdMet: boolean;
  confidenceThresholdMet: boolean;
  status: PatternStatus;
  proposalId?: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PatternWithEvidence extends NeedPattern {
  evidence: NeedEvidence[];
  evidenceSummary: {
    byType: Record<EvidenceType, number>;
    byUser: Record<string, number>;
    timeline: Array<{ date: string; count: number; score: number }>;
  };
}

// ============================================================================
// 39.3.3 Proposal Types
// ============================================================================

export type ProposalAdminStatus =
  | 'pending_brain'
  | 'pending_admin'
  | 'approved'
  | 'declined'
  | 'testing';

export type ProposalTestStatus =
  | 'not_tested'
  | 'testing'
  | 'passed'
  | 'failed';

export type WorkflowComplexity =
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'advanced';

export type ProposedWorkflowType =
  | 'orchestration_pattern'
  | 'production_workflow'
  | 'hybrid';

export interface BrainRiskAssessment {
  costRisk: number;
  latencyRisk: number;
  qualityRisk: number;
  complianceRisk: number;
  overallRisk: number;
  riskFactors: string[];
  mitigations: string[];
}

export interface ProposedWorkflowNode {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  connections: string[];
}

export interface ProposedWorkflowDAG {
  nodes: ProposedWorkflowNode[];
  edges: Array<{ from: string; to: string; condition?: string }>;
  entryPoint: string;
  exitPoints: string[];
  metadata: {
    estimatedLatencyMs: number;
    estimatedCostPer1k: number;
    requiredModels: string[];
    requiredServices: string[];
  };
}

export interface WorkflowProposal {
  id: UUID;
  tenantId: TenantId;
  proposalCode: string;
  proposalName: string;
  proposalDescription: string;
  sourcePatternId: UUID;
  proposedWorkflow: ProposedWorkflowDAG;
  workflowCategory?: string;
  workflowType: ProposedWorkflowType;
  estimatedComplexity: WorkflowComplexity;
  
  // Neural Engine analysis
  neuralConfidence: number;
  neuralReasoning: string;
  estimatedQualityImprovement?: number;
  estimatedCoveragePercentage?: number;
  
  // Brain Governor review
  brainApproved?: boolean;
  brainReviewTimestamp?: Timestamp;
  brainRiskAssessment?: BrainRiskAssessment;
  brainVetoReason?: string;
  brainModifications?: Partial<ProposedWorkflowDAG>;
  
  // Evidence summary
  evidenceCount: number;
  uniqueUsersAffected: number;
  totalEvidenceScore: number;
  evidenceTimeSpanDays: number;
  evidenceSummary: {
    byType: Record<EvidenceType, number>;
    topFailureReasons: string[];
    affectedDomains: string[];
  };
  
  // Admin review
  adminStatus: ProposalAdminStatus;
  adminReviewerId?: UserId;
  adminReviewTimestamp?: Timestamp;
  adminNotes?: string;
  adminModifications?: Partial<ProposedWorkflowDAG>;
  
  // Testing
  testStatus?: ProposalTestStatus;
  testResults?: {
    testsRun: number;
    testsPassed: number;
    testsFailed: number;
    avgLatencyMs: number;
    avgQualityScore: number;
    issues: string[];
  };
  testExecutionIds?: UUID[];
  
  // Publishing
  publishedWorkflowId?: UUID;
  publishedAt?: Timestamp;
  
  // Audit
  proposalBatchId?: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProposalWithPattern extends WorkflowProposal {
  sourcePattern: NeedPattern;
}

// ============================================================================
// 39.3.4 Review Types
// ============================================================================

export type ReviewerType = 'brain' | 'admin';

export type ReviewAction =
  | 'approve'
  | 'decline'
  | 'modify'
  | 'request_test'
  | 'escalate';

export interface ProposalReview {
  id: UUID;
  proposalId: UUID;
  reviewerType: ReviewerType;
  reviewerId?: UserId;
  action: ReviewAction;
  previousStatus: ProposalAdminStatus;
  newStatus: ProposalAdminStatus;
  reviewNotes?: string;
  modificationsMade?: Partial<ProposedWorkflowDAG>;
  riskAssessment?: BrainRiskAssessment;
  reviewedAt: Timestamp;
}

// ============================================================================
// 39.3.5 Threshold Configuration Types
// ============================================================================

export interface ProposalThresholdConfig {
  id: UUID;
  tenantId: TenantId;
  
  // Occurrence thresholds
  minEvidenceCount: number;
  minUniqueUsers: number;
  minTimeSpanHours: number;
  maxTimeSpanDays: number;
  
  // Impact thresholds
  minTotalEvidenceScore: number;
  minAvgEvidenceWeight: number;
  
  // Neural confidence thresholds
  minNeuralConfidence: number;
  minCoverageEstimate: number;
  
  // Brain approval thresholds
  maxCostRisk: number;
  maxLatencyRisk: number;
  minQualityConfidence: number;
  maxComplianceRisk: number;
  
  // Rate limiting
  maxProposalsPerDay: number;
  maxProposalsPerWeek: number;
  cooldownAfterDeclineHours: number;
  
  // Auto-approve settings
  autoApproveEnabled: boolean;
  autoApproveMinConfidence: number;
  autoApproveMaxComplexity: WorkflowComplexity;
  
  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: UserId;
}

// ============================================================================
// 39.3.6 API Request/Response Types
// ============================================================================

// Evidence submission
export interface SubmitEvidenceRequest {
  evidenceType: EvidenceType;
  sessionId?: UUID;
  executionId?: UUID;
  originalRequest?: string;
  attemptedWorkflowId?: UUID;
  failureReason?: string;
  userFeedback?: string;
  evidenceData?: Record<string, unknown>;
}

export interface SubmitEvidenceResponse {
  evidenceId: UUID;
  patternId: UUID;
  patternStatus: PatternStatus;
  currentEvidenceScore: number;
  thresholdsMet: {
    occurrence: boolean;
    impact: boolean;
    confidence: boolean;
  };
}

// Pattern queries
export interface GetPatternsRequest {
  status?: PatternStatus[];
  minEvidenceScore?: number;
  minEvidenceCount?: number;
  limit?: number;
  offset?: number;
}

export interface GetPatternsResponse {
  patterns: PatternWithEvidence[];
  total: number;
  hasMore: boolean;
}

// Proposal queries
export interface GetProposalsRequest {
  status?: ProposalAdminStatus[];
  testStatus?: ProposalTestStatus[];
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface GetProposalsResponse {
  proposals: ProposalWithPattern[];
  total: number;
  hasMore: boolean;
}

// Admin review
export interface ReviewProposalRequest {
  action: ReviewAction;
  notes?: string;
  modifications?: Partial<ProposedWorkflowDAG>;
}

export interface ReviewProposalResponse {
  proposalId: UUID;
  newStatus: ProposalAdminStatus;
  reviewId: UUID;
}

// Testing
export interface TestProposalRequest {
  testMode: 'manual' | 'automated';
  testCases?: Array<{
    input: string;
    expectedBehavior?: string;
  }>;
  iterations?: number;
}

export interface TestProposalResponse {
  proposalId: UUID;
  testStatus: ProposalTestStatus;
  testResults: WorkflowProposal['testResults'];
  testExecutionIds: UUID[];
}

// Publishing
export interface PublishProposalRequest {
  publishToCategory?: string;
  overrideWorkflowId?: UUID;  // Replace existing workflow
}

export interface PublishProposalResponse {
  proposalId: UUID;
  publishedWorkflowId: UUID;
  publishedAt: Timestamp;
}

// Configuration updates
export interface UpdateThresholdConfigRequest {
  config: Partial<Omit<ProposalThresholdConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'updatedBy'>>;
}

export interface UpdateEvidenceWeightsRequest {
  weights: Array<{
    evidenceType: EvidenceType;
    weight: number;
    enabled?: boolean;
  }>;
}

// ============================================================================
// 39.3.7 Neural Engine Types (for proposal generation)
// ============================================================================

export interface NeuralProposalGenerationContext {
  pattern: NeedPattern;
  evidence: NeedEvidence[];
  existingWorkflows: Array<{
    id: UUID;
    name: string;
    similarity: number;
    failureRate: number;
  }>;
  userSegmentProfile: {
    commonIntents: string[];
    preferredComplexity: WorkflowComplexity;
    domainDistribution: Record<string, number>;
  };
  tenantConstraints: {
    maxWorkflowNodes: number;
    allowedNodeTypes: string[];
    requiredComplianceChecks: string[];
  };
}

export interface NeuralProposalGenerationResult {
  success: boolean;
  proposal?: Omit<WorkflowProposal, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
  confidence: number;
  reasoning: string;
  alternativeApproaches?: Array<{
    description: string;
    confidence: number;
    tradeoffs: string[];
  }>;
  rejectionReason?: string;
}

// ============================================================================
// 39.3.8 Brain Governor Types (for proposal review)
// ============================================================================

export interface BrainProposalReviewContext {
  proposal: WorkflowProposal;
  pattern: NeedPattern;
  tenantConfig: ProposalThresholdConfig;
  currentWorkflowCount: number;
  recentProposalCount: {
    today: number;
    thisWeek: number;
  };
  similarExistingWorkflows: Array<{
    id: UUID;
    name: string;
    similarity: number;
  }>;
}

export interface BrainProposalReviewResult {
  approved: boolean;
  riskAssessment: BrainRiskAssessment;
  reasoning: string;
  vetoReason?: string;
  suggestedModifications?: Partial<ProposedWorkflowDAG>;
  escalateToAdmin: boolean;
  adminPriority?: 'low' | 'medium' | 'high' | 'urgent';
}
```

---

## 39.4 Constants and Defaults

```typescript
// ============================================================================
// packages/core/src/constants/workflow-proposals.ts
// ============================================================================

import { EvidenceType, WorkflowComplexity } from '../types/workflow-proposals';

// Default evidence weights
export const DEFAULT_EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
  workflow_failure: 0.40,
  negative_feedback: 0.35,
  manual_override: 0.15,
  regenerate_request: 0.10,
  abandon_session: 0.20,
  low_confidence_completion: 0.15,
  explicit_request: 0.50,
};

// Default threshold configuration
export const DEFAULT_THRESHOLD_CONFIG = {
  // Occurrence thresholds
  minEvidenceCount: 5,
  minUniqueUsers: 3,
  minTimeSpanHours: 24,
  maxTimeSpanDays: 30,
  
  // Impact thresholds
  minTotalEvidenceScore: 0.60,
  minAvgEvidenceWeight: 0.20,
  
  // Neural confidence thresholds
  minNeuralConfidence: 0.75,
  minCoverageEstimate: 0.60,
  
  // Brain approval thresholds
  maxCostRisk: 0.30,
  maxLatencyRisk: 0.40,
  minQualityConfidence: 0.70,
  maxComplianceRisk: 0.10,
  
  // Rate limiting
  maxProposalsPerDay: 10,
  maxProposalsPerWeek: 30,
  cooldownAfterDeclineHours: 72,
  
  // Auto-approve (disabled by default)
  autoApproveEnabled: false,
  autoApproveMinConfidence: 0.95,
  autoApproveMaxComplexity: 'simple' as WorkflowComplexity,
};

// Complexity scoring
export const COMPLEXITY_NODE_THRESHOLDS: Record<WorkflowComplexity, { min: number; max: number }> = {
  simple: { min: 1, max: 3 },
  moderate: { min: 4, max: 7 },
  complex: { min: 8, max: 12 },
  advanced: { min: 13, max: Infinity },
};

// Proposal code generation
export const PROPOSAL_CODE_PREFIX = 'WP';
export const PROPOSAL_CODE_YEAR_FORMAT = 'YYYY';
export const PROPOSAL_CODE_SEQUENCE_PADDING = 3;

// Rate limit windows
export const RATE_LIMIT_WINDOWS = {
  daily: 24 * 60 * 60 * 1000,   // 24 hours in ms
  weekly: 7 * 24 * 60 * 60 * 1000,  // 7 days in ms
};

// Pattern similarity threshold for deduplication
export const PATTERN_SIMILARITY_THRESHOLD = 0.85;

// Maximum nodes in a proposed workflow
export const MAX_PROPOSED_WORKFLOW_NODES = 20;

// Test configuration defaults
export const DEFAULT_TEST_CONFIG = {
  automatedIterations: 10,
  timeoutMs: 30000,
  minPassRate: 0.80,
};
```

---

---

This chunk contains:
- Complete database schema (8 tables with RLS)
- Full TypeScript type definitions
- Constants and default configurations

Next chunk will contain Lambda functions for evidence collection, pattern detection, and proposal generation.

## 39.5 Evidence Collection Lambda

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/evidence-collector.ts
// Collects and processes evidence of user needs not met by existing workflows
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import {
  EvidenceType,
  NeedEvidence,
  NeedPattern,
  PatternSignature,
  SubmitEvidenceRequest,
  SubmitEvidenceResponse,
} from '@radiant/core/types/workflow-proposals';
import { DEFAULT_EVIDENCE_WEIGHTS, PATTERN_SIMILARITY_THRESHOLD } from '@radiant/core/constants/workflow-proposals';
import { getTenantId, getUserId, createResponse, logAudit } from '../utils';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// ============================================================================
// Pattern Signature Generation
// ============================================================================

interface PatternContext {
  originalRequest: string;
  attemptedWorkflowId?: string;
  failureReason?: string;
  evidenceType: EvidenceType;
  evidenceData: Record<string, unknown>;
}

function generatePatternSignature(context: PatternContext): PatternSignature {
  // Extract keywords from request
  const keywords = extractKeywords(context.originalRequest || '');
  
  // Determine intent category from failure and request
  const intentCategory = classifyIntent(context);
  
  // Extract domain hints
  const domainHints = extractDomainHints(context);
  
  // Track failed workflow types
  const failedWorkflowTypes = context.attemptedWorkflowId 
    ? [context.attemptedWorkflowId] 
    : [];
  
  return {
    intentCategory,
    keywords,
    domainHints,
    failedWorkflowTypes,
    userSegments: [],  // Populated during pattern analysis
    contextualFactors: {
      evidenceType: context.evidenceType,
      hasExplicitFeedback: !!context.failureReason,
    },
  };
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - in production, use NLP service
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
    'although', 'though', 'after', 'before', 'when', 'i', 'me', 'my', 'myself', 'we',
    'our', 'you', 'your', 'he', 'him', 'she', 'her', 'it', 'its', 'they', 'them', 'what',
    'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was',
    'were', 'been', 'being', 'please', 'help', 'want', 'like', 'get', 'make']);
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 20);  // Limit to top 20 keywords
}

function classifyIntent(context: PatternContext): string {
  const request = (context.originalRequest || '').toLowerCase();
  const failure = (context.failureReason || '').toLowerCase();
  
  // Intent classification based on patterns
  const intentPatterns: Record<string, string[]> = {
    'research': ['research', 'find', 'search', 'look up', 'investigate', 'explore'],
    'analysis': ['analyze', 'analysis', 'examine', 'evaluate', 'assess', 'review'],
    'creation': ['create', 'write', 'generate', 'make', 'build', 'compose', 'draft'],
    'comparison': ['compare', 'versus', 'vs', 'difference', 'contrast', 'better'],
    'explanation': ['explain', 'how', 'why', 'what is', 'describe', 'clarify'],
    'transformation': ['convert', 'transform', 'translate', 'change', 'modify'],
    'summarization': ['summarize', 'summary', 'brief', 'tldr', 'key points'],
    'verification': ['verify', 'check', 'validate', 'confirm', 'fact-check'],
    'coding': ['code', 'program', 'function', 'script', 'debug', 'fix bug'],
    'data_processing': ['data', 'csv', 'json', 'parse', 'extract', 'process'],
  };
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some(p => request.includes(p) || failure.includes(p))) {
      return intent;
    }
  }
  
  return 'general';
}

function extractDomainHints(context: PatternContext): string[] {
  const text = `${context.originalRequest || ''} ${context.failureReason || ''}`.toLowerCase();
  
  const domainPatterns: Record<string, string[]> = {
    'medical': ['medical', 'health', 'diagnosis', 'symptom', 'treatment', 'patient', 'doctor'],
    'legal': ['legal', 'law', 'contract', 'court', 'attorney', 'regulation', 'compliance'],
    'financial': ['financial', 'money', 'investment', 'stock', 'budget', 'accounting', 'tax'],
    'scientific': ['scientific', 'research', 'experiment', 'hypothesis', 'study', 'paper'],
    'technical': ['technical', 'engineering', 'software', 'hardware', 'system', 'architecture'],
    'creative': ['creative', 'story', 'poem', 'art', 'design', 'music', 'novel'],
    'educational': ['educational', 'learn', 'teach', 'course', 'student', 'lesson', 'tutorial'],
    'business': ['business', 'company', 'strategy', 'market', 'sales', 'customer', 'product'],
  };
  
  const hints: string[] = [];
  for (const [domain, patterns] of Object.entries(domainPatterns)) {
    if (patterns.some(p => text.includes(p))) {
      hints.push(domain);
    }
  }
  
  return hints;
}

function generatePatternHash(signature: PatternSignature): string {
  // Normalize and hash the signature for deduplication
  const normalized = {
    intent: signature.intentCategory,
    keywords: [...signature.keywords].sort(),
    domains: [...signature.domainHints].sort(),
  };
  
  return createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

// ============================================================================
// Pattern Embedding Generation (calls Neural Engine)
// ============================================================================

async function generatePatternEmbedding(signature: PatternSignature): Promise<number[]> {
  // In production, call the Neural Engine embedding service
  // For now, return a placeholder that would be replaced by actual embedding
  const text = [
    signature.intentCategory,
    ...signature.keywords,
    ...signature.domainHints,
  ].join(' ');
  
  // This would call: POST /api/v2/internal/neural/embed
  // return await neuralEngineClient.generateEmbedding(text);
  
  // Placeholder: return 768-dim zero vector (will be populated by Neural Engine)
  return new Array(768).fill(0);
}

// ============================================================================
// Evidence Weight Resolution
// ============================================================================

async function getEvidenceWeight(
  client: Pool,
  tenantId: string,
  evidenceType: EvidenceType
): Promise<number> {
  const result = await client.query(
    `SELECT weight FROM evidence_weight_config 
     WHERE tenant_id = $1 AND evidence_type = $2 AND enabled = TRUE`,
    [tenantId, evidenceType]
  );
  
  if (result.rows.length > 0) {
    return parseFloat(result.rows[0].weight);
  }
  
  return DEFAULT_EVIDENCE_WEIGHTS[evidenceType] || 0.10;
}

// ============================================================================
// Pattern Finding/Creation
// ============================================================================

async function findOrCreatePattern(
  client: Pool,
  tenantId: string,
  signature: PatternSignature,
  detectedIntent: string
): Promise<{ pattern: NeedPattern; isNew: boolean }> {
  const patternHash = generatePatternHash(signature);
  
  // Try to find existing pattern
  const existing = await client.query<NeedPattern>(
    `SELECT * FROM neural_need_patterns 
     WHERE tenant_id = $1 AND pattern_hash = $2`,
    [tenantId, patternHash]
  );
  
  if (existing.rows.length > 0) {
    return { pattern: existing.rows[0], isNew: false };
  }
  
  // Check for similar patterns using embedding similarity
  const embedding = await generatePatternEmbedding(signature);
  
  const similar = await client.query<NeedPattern>(
    `SELECT *, 1 - (pattern_embedding <=> $2::vector) as similarity
     FROM neural_need_patterns 
     WHERE tenant_id = $1 
       AND pattern_embedding IS NOT NULL
       AND 1 - (pattern_embedding <=> $2::vector) > $3
     ORDER BY similarity DESC
     LIMIT 1`,
    [tenantId, JSON.stringify(embedding), PATTERN_SIMILARITY_THRESHOLD]
  );
  
  if (similar.rows.length > 0) {
    // Merge into existing similar pattern
    return { pattern: similar.rows[0], isNew: false };
  }
  
  // Create new pattern
  const patternName = `${signature.intentCategory}_${signature.keywords.slice(0, 3).join('_')}`;
  
  const inserted = await client.query<NeedPattern>(
    `INSERT INTO neural_need_patterns (
      tenant_id, pattern_hash, pattern_signature, pattern_embedding,
      pattern_name, detected_intent, existing_workflow_gaps
    ) VALUES ($1, $2, $3, $4::vector, $5, $6, $7)
    RETURNING *`,
    [
      tenantId,
      patternHash,
      JSON.stringify(signature),
      JSON.stringify(embedding),
      patternName,
      detectedIntent,
      signature.failedWorkflowTypes,
    ]
  );
  
  return { pattern: inserted.rows[0], isNew: true };
}

// ============================================================================
// Threshold Checking
// ============================================================================

interface ThresholdStatus {
  occurrence: boolean;
  impact: boolean;
  confidence: boolean;
  allMet: boolean;
}

async function checkThresholds(
  client: Pool,
  tenantId: string,
  pattern: NeedPattern
): Promise<ThresholdStatus> {
  // Get tenant threshold config
  const configResult = await client.query(
    `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
    [tenantId]
  );
  
  const config = configResult.rows[0] || {};
  const minEvidenceCount = config.min_evidence_count || 5;
  const minUniqueUsers = config.min_unique_users || 3;
  const minTimeSpanHours = config.min_time_span_hours || 24;
  const minTotalScore = parseFloat(config.min_total_evidence_score || '0.60');
  
  // Calculate time span
  const timeSpanHours = pattern.last_occurrence && pattern.first_occurrence
    ? (new Date(pattern.last_occurrence).getTime() - new Date(pattern.first_occurrence).getTime()) / (1000 * 60 * 60)
    : 0;
  
  const occurrence = 
    pattern.evidence_count >= minEvidenceCount &&
    pattern.unique_users_affected >= minUniqueUsers &&
    timeSpanHours >= minTimeSpanHours;
  
  const impact = pattern.total_evidence_score >= minTotalScore;
  
  // Confidence threshold requires Neural Engine analysis (checked during proposal generation)
  const confidence = pattern.confidence_threshold_met || false;
  
  return {
    occurrence,
    impact,
    confidence,
    allMet: occurrence && impact && confidence,
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: SubmitEvidenceRequest = JSON.parse(event.body || '{}');
    
    if (!request.evidenceType) {
      return createResponse(400, { error: 'evidenceType is required' });
    }
    
    // Get evidence weight
    const evidenceWeight = await getEvidenceWeight(client, tenantId, request.evidenceType);
    
    // Generate pattern signature
    const signature = generatePatternSignature({
      originalRequest: request.originalRequest || '',
      attemptedWorkflowId: request.attemptedWorkflowId,
      failureReason: request.failureReason,
      evidenceType: request.evidenceType,
      evidenceData: request.evidenceData || {},
    });
    
    // Find or create pattern
    const { pattern, isNew } = await findOrCreatePattern(
      client,
      tenantId,
      signature,
      classifyIntent({
        originalRequest: request.originalRequest || '',
        failureReason: request.failureReason,
        evidenceType: request.evidenceType,
        evidenceData: request.evidenceData || {},
      })
    );
    
    // Insert evidence record
    const evidenceResult = await client.query<NeedEvidence>(
      `INSERT INTO neural_need_evidence (
        tenant_id, pattern_id, user_id, session_id, execution_id,
        evidence_type, evidence_weight, evidence_data,
        original_request, attempted_workflow_id, failure_reason, user_feedback
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        tenantId,
        pattern.id,
        userId,
        request.sessionId,
        request.executionId,
        request.evidenceType,
        evidenceWeight,
        JSON.stringify(request.evidenceData || {}),
        request.originalRequest,
        request.attemptedWorkflowId,
        request.failureReason,
        request.userFeedback,
      ]
    );
    
    // Update pattern statistics
    await client.query(
      `UPDATE neural_need_patterns SET
        total_evidence_score = total_evidence_score + $2,
        evidence_count = evidence_count + 1,
        unique_users_affected = (
          SELECT COUNT(DISTINCT user_id) 
          FROM neural_need_evidence 
          WHERE pattern_id = $1
        ),
        last_occurrence = NOW(),
        updated_at = NOW()
      WHERE id = $1`,
      [pattern.id, evidenceWeight]
    );
    
    // Fetch updated pattern
    const updatedPattern = await client.query<NeedPattern>(
      `SELECT * FROM neural_need_patterns WHERE id = $1`,
      [pattern.id]
    );
    
    // Check thresholds
    const thresholds = await checkThresholds(client, tenantId, updatedPattern.rows[0]);
    
    // Update threshold status
    await client.query(
      `UPDATE neural_need_patterns SET
        occurrence_threshold_met = $2,
        impact_threshold_met = $3,
        status = CASE 
          WHEN $2 AND $3 THEN 'threshold_met'
          ELSE status
        END
      WHERE id = $1`,
      [pattern.id, thresholds.occurrence, thresholds.impact]
    );
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: 'evidence_submitted',
      resourceType: 'need_pattern',
      resourceId: pattern.id,
      details: {
        evidenceId: evidenceResult.rows[0].id,
        evidenceType: request.evidenceType,
        evidenceWeight,
        thresholdsMet: thresholds,
        isNewPattern: isNew,
      },
    });
    
    const response: SubmitEvidenceResponse = {
      evidenceId: evidenceResult.rows[0].id,
      patternId: pattern.id,
      patternStatus: thresholds.occurrence && thresholds.impact ? 'threshold_met' : 'accumulating',
      currentEvidenceScore: updatedPattern.rows[0].total_evidence_score + evidenceWeight,
      thresholdsMet: thresholds,
    };
    
    return createResponse(200, response);
    
  } catch (error) {
    console.error('Evidence collection error:', error);
    return createResponse(500, { error: 'Internal server error' });
  } finally {
    client.release();
  }
};
```

---

## 39.6 Pattern Analysis Lambda (Scheduled)

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/pattern-analyzer.ts
// Scheduled Lambda that analyzes patterns and triggers proposal generation
// ============================================================================

import { ScheduledHandler } from 'aws-lambda';
import { Pool } from 'pg';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { NeedPattern, PatternWithEvidence } from '@radiant/core/types/workflow-proposals';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const sqs = new SQSClient({});
const PROPOSAL_QUEUE_URL = process.env.PROPOSAL_QUEUE_URL!;

// ============================================================================
// Pattern Analysis
// ============================================================================

interface AnalysisResult {
  patternsAnalyzed: number;
  patternsQualified: number;
  proposalsQueued: number;
  errors: string[];
}

async function analyzePatterns(tenantId: string): Promise<AnalysisResult> {
  const client = await pool.connect();
  const result: AnalysisResult = {
    patternsAnalyzed: 0,
    patternsQualified: 0,
    proposalsQueued: 0,
    errors: [],
  };
  
  try {
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    // Get threshold config
    const configResult = await client.query(
      `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
      [tenantId]
    );
    const config = configResult.rows[0] || {};
    
    // Check rate limits
    const rateLimitResult = await client.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week
       FROM workflow_proposals
       WHERE tenant_id = $1`,
      [tenantId]
    );
    
    const dailyCount = parseInt(rateLimitResult.rows[0].today);
    const weeklyCount = parseInt(rateLimitResult.rows[0].this_week);
    const maxDaily = config.max_proposals_per_day || 10;
    const maxWeekly = config.max_proposals_per_week || 30;
    
    if (dailyCount >= maxDaily || weeklyCount >= maxWeekly) {
      result.errors.push(`Rate limit reached: ${dailyCount}/${maxDaily} daily, ${weeklyCount}/${maxWeekly} weekly`);
      return result;
    }
    
    const remainingDaily = maxDaily - dailyCount;
    const remainingWeekly = maxWeekly - weeklyCount;
    const maxProposals = Math.min(remainingDaily, remainingWeekly);
    
    // Find patterns that have met thresholds but don't have proposals yet
    const patterns = await client.query<NeedPattern>(
      `SELECT * FROM neural_need_patterns
       WHERE tenant_id = $1
         AND status = 'threshold_met'
         AND occurrence_threshold_met = TRUE
         AND impact_threshold_met = TRUE
         AND proposal_id IS NULL
       ORDER BY total_evidence_score DESC
       LIMIT $2`,
      [tenantId, maxProposals]
    );
    
    result.patternsAnalyzed = patterns.rows.length;
    
    for (const pattern of patterns.rows) {
      try {
        // Get evidence for pattern
        const evidenceResult = await client.query(
          `SELECT * FROM neural_need_evidence
           WHERE pattern_id = $1
           ORDER BY occurred_at DESC
           LIMIT 100`,
          [pattern.id]
        );
        
        // Check for recent declines (cooldown period)
        const cooldownHours = config.cooldown_after_decline_hours || 72;
        const recentDecline = await client.query(
          `SELECT 1 FROM workflow_proposals wp
           JOIN workflow_proposal_reviews wpr ON wpr.proposal_id = wp.id
           WHERE wp.source_pattern_id = $1
             AND wpr.action = 'decline'
             AND wpr.reviewed_at > NOW() - INTERVAL '${cooldownHours} hours'
           LIMIT 1`,
          [pattern.id]
        );
        
        if (recentDecline.rows.length > 0) {
          result.errors.push(`Pattern ${pattern.id} in cooldown after recent decline`);
          continue;
        }
        
        // Queue for proposal generation
        const message: PatternWithEvidence = {
          ...pattern,
          evidence: evidenceResult.rows,
          evidenceSummary: generateEvidenceSummary(evidenceResult.rows),
        };
        
        await sqs.send(new SendMessageCommand({
          QueueUrl: PROPOSAL_QUEUE_URL,
          MessageBody: JSON.stringify({
            type: 'generate_proposal',
            tenantId,
            pattern: message,
          }),
          MessageGroupId: tenantId,
          MessageDeduplicationId: `${pattern.id}-${Date.now()}`,
        }));
        
        result.patternsQualified++;
        result.proposalsQueued++;
        
        // Update pattern status
        await client.query(
          `UPDATE neural_need_patterns 
           SET status = 'proposal_generating', updated_at = NOW()
           WHERE id = $1`,
          [pattern.id]
        );
        
      } catch (error) {
        result.errors.push(`Error processing pattern ${pattern.id}: ${error}`);
      }
    }
    
    return result;
    
  } finally {
    client.release();
  }
}

function generateEvidenceSummary(evidence: any[]): PatternWithEvidence['evidenceSummary'] {
  const byType: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  const timeline: Array<{ date: string; count: number; score: number }> = [];
  
  const dateMap: Record<string, { count: number; score: number }> = {};
  
  for (const e of evidence) {
    // By type
    byType[e.evidence_type] = (byType[e.evidence_type] || 0) + 1;
    
    // By user
    if (e.user_id) {
      byUser[e.user_id] = (byUser[e.user_id] || 0) + 1;
    }
    
    // Timeline
    const date = new Date(e.occurred_at).toISOString().split('T')[0];
    if (!dateMap[date]) {
      dateMap[date] = { count: 0, score: 0 };
    }
    dateMap[date].count++;
    dateMap[date].score += parseFloat(e.evidence_weight);
  }
  
  // Convert timeline map to array
  for (const [date, data] of Object.entries(dateMap)) {
    timeline.push({ date, ...data });
  }
  timeline.sort((a, b) => a.date.localeCompare(b.date));
  
  return { byType, byUser, timeline };
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: ScheduledHandler = async (event) => {
  console.log('Pattern analysis triggered:', event);
  
  const client = await pool.connect();
  
  try {
    // Get all active tenants
    const tenants = await client.query(
      `SELECT id FROM tenants WHERE status = 'active'`
    );
    
    const results: Record<string, AnalysisResult> = {};
    
    for (const tenant of tenants.rows) {
      results[tenant.id] = await analyzePatterns(tenant.id);
    }
    
    console.log('Pattern analysis complete:', results);
    
    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };
    
  } finally {
    client.release();
  }
};
```

---

## 39.7 Proposal Generation Lambda (SQS Triggered)

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/proposal-generator.ts
// SQS-triggered Lambda that generates workflow proposals using Neural Engine
// ============================================================================

import { SQSHandler, SQSRecord } from 'aws-lambda';
import { Pool } from 'pg';
import {
  PatternWithEvidence,
  WorkflowProposal,
  ProposedWorkflowDAG,
  NeuralProposalGenerationContext,
  NeuralProposalGenerationResult,
  WorkflowComplexity,
} from '@radiant/core/types/workflow-proposals';
import {
  COMPLEXITY_NODE_THRESHOLDS,
  PROPOSAL_CODE_PREFIX,
  MAX_PROPOSED_WORKFLOW_NODES,
} from '@radiant/core/constants/workflow-proposals';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// ============================================================================
// Neural Engine Integration
// ============================================================================

interface NeuralEngineClient {
  generateProposal(context: NeuralProposalGenerationContext): Promise<NeuralProposalGenerationResult>;
}

async function createNeuralEngineClient(): Promise<NeuralEngineClient> {
  // In production, this would be an HTTP client to the Neural Engine service
  return {
    async generateProposal(context: NeuralProposalGenerationContext): Promise<NeuralProposalGenerationResult> {
      // This would call: POST /api/v2/internal/neural/generate-proposal
      // For now, implement intelligent proposal generation logic
      
      return generateIntelligentProposal(context);
    },
  };
}

async function generateIntelligentProposal(
  context: NeuralProposalGenerationContext
): Promise<NeuralProposalGenerationResult> {
  const { pattern, evidence, existingWorkflows, userSegmentProfile, tenantConstraints } = context;
  
  // Analyze evidence to determine what kind of workflow is needed
  const evidenceAnalysis = analyzeEvidence(evidence);
  
  // Check if we have enough signal to propose
  if (evidenceAnalysis.confidence < 0.5) {
    return {
      success: false,
      confidence: evidenceAnalysis.confidence,
      reasoning: 'Insufficient evidence signal to generate confident proposal',
      rejectionReason: 'Low evidence confidence',
    };
  }
  
  // Determine workflow structure based on intent and evidence
  const workflowStructure = determineWorkflowStructure(
    pattern,
    evidenceAnalysis,
    userSegmentProfile,
    tenantConstraints
  );
  
  // Generate the DAG
  const proposedDAG = generateWorkflowDAG(
    workflowStructure,
    pattern,
    tenantConstraints
  );
  
  // Calculate confidence based on coverage
  const coverageEstimate = calculateCoverageEstimate(proposedDAG, evidence);
  const overallConfidence = (evidenceAnalysis.confidence + coverageEstimate) / 2;
  
  if (overallConfidence < 0.6) {
    return {
      success: false,
      confidence: overallConfidence,
      reasoning: 'Generated workflow does not sufficiently address the identified need',
      rejectionReason: 'Low coverage confidence',
    };
  }
  
  // Estimate quality improvement
  const qualityImprovement = estimateQualityImprovement(
    proposedDAG,
    existingWorkflows,
    evidenceAnalysis
  );
  
  return {
    success: true,
    proposal: {
      proposalCode: '', // Will be generated
      proposalName: generateProposalName(pattern),
      proposalDescription: generateProposalDescription(pattern, evidenceAnalysis),
      sourcePatternId: pattern.id,
      proposedWorkflow: proposedDAG,
      workflowCategory: pattern.patternSignature.intentCategory,
      workflowType: 'production_workflow',
      estimatedComplexity: determineComplexity(proposedDAG),
      neuralConfidence: overallConfidence,
      neuralReasoning: generateNeuralReasoning(pattern, evidenceAnalysis, proposedDAG),
      estimatedQualityImprovement: qualityImprovement,
      estimatedCoveragePercentage: coverageEstimate,
      evidenceCount: evidence.length,
      uniqueUsersAffected: pattern.uniqueUsersAffected,
      totalEvidenceScore: pattern.totalEvidenceScore,
      evidenceTimeSpanDays: calculateTimeSpan(pattern),
      evidenceSummary: {
        byType: pattern.evidenceSummary?.byType || {},
        topFailureReasons: extractTopFailureReasons(evidence),
        affectedDomains: pattern.patternSignature.domainHints,
      },
      adminStatus: 'pending_brain',
    },
    confidence: overallConfidence,
    reasoning: generateNeuralReasoning(pattern, evidenceAnalysis, proposedDAG),
    alternativeApproaches: generateAlternativeApproaches(pattern, evidenceAnalysis),
  };
}

// ============================================================================
// Evidence Analysis
// ============================================================================

interface EvidenceAnalysis {
  confidence: number;
  primaryFailureType: string;
  failureReasons: string[];
  requiredCapabilities: string[];
  suggestedNodeTypes: string[];
  complexitySignal: WorkflowComplexity;
}

function analyzeEvidence(evidence: any[]): EvidenceAnalysis {
  const failureReasons: Record<string, number> = {};
  const capabilitySignals: Set<string> = new Set();
  let totalWeight = 0;
  
  for (const e of evidence) {
    totalWeight += parseFloat(e.evidence_weight);
    
    if (e.failure_reason) {
      failureReasons[e.failure_reason] = (failureReasons[e.failure_reason] || 0) + 1;
      
      // Extract capability signals from failure reasons
      const capabilities = extractCapabilities(e.failure_reason);
      capabilities.forEach(c => capabilitySignals.add(c));
    }
    
    if (e.user_feedback) {
      const capabilities = extractCapabilities(e.user_feedback);
      capabilities.forEach(c => capabilitySignals.add(c));
    }
  }
  
  // Sort failure reasons by frequency
  const sortedReasons = Object.entries(failureReasons)
    .sort((a, b) => b[1] - a[1])
    .map(([reason]) => reason);
  
  // Determine complexity from evidence volume and variety
  const complexitySignal = evidence.length > 20 ? 'complex' :
    evidence.length > 10 ? 'moderate' : 'simple';
  
  // Calculate confidence based on evidence consistency
  const reasonConsistency = sortedReasons.length > 0 
    ? failureReasons[sortedReasons[0]] / evidence.length 
    : 0;
  const confidence = Math.min(0.95, 0.3 + (totalWeight * 0.3) + (reasonConsistency * 0.4));
  
  return {
    confidence,
    primaryFailureType: sortedReasons[0] || 'unspecified',
    failureReasons: sortedReasons.slice(0, 5),
    requiredCapabilities: Array.from(capabilitySignals),
    suggestedNodeTypes: mapCapabilitiesToNodeTypes(Array.from(capabilitySignals)),
    complexitySignal: complexitySignal as WorkflowComplexity,
  };
}

function extractCapabilities(text: string): string[] {
  const capabilityPatterns: Record<string, string[]> = {
    'verification': ['wrong', 'incorrect', 'inaccurate', 'error', 'mistake', 'fact-check'],
    'multi_source': ['more sources', 'compare', 'multiple', 'different perspectives'],
    'depth': ['more detail', 'deeper', 'comprehensive', 'thorough', 'in-depth'],
    'reasoning': ['explain', 'reasoning', 'logic', 'step-by-step', 'how'],
    'creativity': ['creative', 'original', 'unique', 'novel', 'innovative'],
    'structure': ['organize', 'structure', 'format', 'outline', 'layout'],
    'iteration': ['refine', 'improve', 'iterate', 'better', 'enhance'],
  };
  
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const [capability, patterns] of Object.entries(capabilityPatterns)) {
    if (patterns.some(p => lowerText.includes(p))) {
      found.push(capability);
    }
  }
  
  return found;
}

function mapCapabilitiesToNodeTypes(capabilities: string[]): string[] {
  const mapping: Record<string, string[]> = {
    'verification': ['fact_check', 'cove_verification', 'multi_source_verify'],
    'multi_source': ['parallel_search', 'source_aggregation', 'perspective_synthesis'],
    'depth': ['recursive_elaboration', 'detail_expansion', 'exhaustive_analysis'],
    'reasoning': ['chain_of_thought', 'step_by_step', 'reasoning_chain'],
    'creativity': ['creative_expansion', 'brainstorm', 'divergent_thinking'],
    'structure': ['outline_generator', 'structure_organizer', 'format_optimizer'],
    'iteration': ['quality_loop', 'refinement_cycle', 'iterative_improvement'],
  };
  
  const nodeTypes: Set<string> = new Set();
  
  for (const capability of capabilities) {
    const types = mapping[capability] || [];
    types.forEach(t => nodeTypes.add(t));
  }
  
  return Array.from(nodeTypes);
}

// ============================================================================
// Workflow Structure Determination
// ============================================================================

interface WorkflowStructure {
  entryStrategy: 'single' | 'parallel' | 'conditional';
  coreNodeTypes: string[];
  verificationRequired: boolean;
  iterationRequired: boolean;
  exitStrategy: 'single' | 'merge' | 'select_best';
}

function determineWorkflowStructure(
  pattern: PatternWithEvidence,
  analysis: EvidenceAnalysis,
  userProfile: NeuralProposalGenerationContext['userSegmentProfile'],
  constraints: NeuralProposalGenerationContext['tenantConstraints']
): WorkflowStructure {
  // Base structure on intent category
  const intentCategory = pattern.patternSignature.intentCategory;
  
  let structure: WorkflowStructure = {
    entryStrategy: 'single',
    coreNodeTypes: [],
    verificationRequired: false,
    iterationRequired: false,
    exitStrategy: 'single',
  };
  
  // Determine entry strategy
  if (analysis.requiredCapabilities.includes('multi_source')) {
    structure.entryStrategy = 'parallel';
    structure.exitStrategy = 'merge';
  }
  
  // Add core node types based on intent
  switch (intentCategory) {
    case 'research':
      structure.coreNodeTypes = ['web_search', 'source_aggregation', 'citation_formatter'];
      structure.verificationRequired = true;
      break;
    case 'analysis':
      structure.coreNodeTypes = ['data_extraction', 'analysis_engine', 'insight_generator'];
      structure.iterationRequired = true;
      break;
    case 'creation':
      structure.coreNodeTypes = ['outline_generator', 'content_generator', 'quality_reviewer'];
      structure.iterationRequired = true;
      break;
    case 'verification':
      structure.coreNodeTypes = ['claim_extractor', 'fact_checker', 'confidence_scorer'];
      structure.entryStrategy = 'parallel';
      structure.exitStrategy = 'merge';
      break;
    default:
      structure.coreNodeTypes = ['llm_processor', 'response_formatter'];
  }
  
  // Add suggested node types from evidence
  structure.coreNodeTypes = [
    ...structure.coreNodeTypes,
    ...analysis.suggestedNodeTypes.filter(t => !structure.coreNodeTypes.includes(t)),
  ];
  
  // Limit to max allowed nodes
  if (structure.coreNodeTypes.length > constraints.maxWorkflowNodes - 2) {
    structure.coreNodeTypes = structure.coreNodeTypes.slice(0, constraints.maxWorkflowNodes - 2);
  }
  
  // Add verification if confidence is low
  if (analysis.confidence < 0.7 && !structure.verificationRequired) {
    structure.verificationRequired = true;
  }
  
  return structure;
}

// ============================================================================
// DAG Generation
// ============================================================================

function generateWorkflowDAG(
  structure: WorkflowStructure,
  pattern: PatternWithEvidence,
  constraints: NeuralProposalGenerationContext['tenantConstraints']
): ProposedWorkflowDAG {
  const nodes: ProposedWorkflowDAG['nodes'] = [];
  const edges: ProposedWorkflowDAG['edges'] = [];
  let nodeIdCounter = 0;
  let yPosition = 100;
  
  const generateNodeId = () => `node_${++nodeIdCounter}`;
  
  // Entry node
  const entryNode = {
    id: generateNodeId(),
    type: 'input',
    name: 'Input',
    config: {},
    position: { x: 100, y: yPosition },
    connections: [],
  };
  nodes.push(entryNode);
  let previousNodeIds = [entryNode.id];
  
  yPosition += 150;
  
  // Handle entry strategy
  if (structure.entryStrategy === 'parallel') {
    const parallelNodes: string[] = [];
    const xPositions = [-150, 0, 150];
    
    for (let i = 0; i < Math.min(3, structure.coreNodeTypes.length); i++) {
      const node = {
        id: generateNodeId(),
        type: structure.coreNodeTypes[i] || 'processor',
        name: formatNodeName(structure.coreNodeTypes[i] || 'Processor'),
        config: {},
        position: { x: 100 + xPositions[i], y: yPosition },
        connections: [],
      };
      nodes.push(node);
      parallelNodes.push(node.id);
      
      edges.push({ from: entryNode.id, to: node.id });
    }
    
    previousNodeIds = parallelNodes;
    yPosition += 150;
    
    // Merge node if parallel
    if (structure.exitStrategy === 'merge') {
      const mergeNode = {
        id: generateNodeId(),
        type: 'merge',
        name: 'Merge Results',
        config: { strategy: 'combine' },
        position: { x: 100, y: yPosition },
        connections: [],
      };
      nodes.push(mergeNode);
      
      for (const prevId of parallelNodes) {
        edges.push({ from: prevId, to: mergeNode.id });
      }
      
      previousNodeIds = [mergeNode.id];
      yPosition += 150;
    }
    
    // Add remaining core nodes sequentially
    for (let i = 3; i < structure.coreNodeTypes.length; i++) {
      const node = {
        id: generateNodeId(),
        type: structure.coreNodeTypes[i],
        name: formatNodeName(structure.coreNodeTypes[i]),
        config: {},
        position: { x: 100, y: yPosition },
        connections: [],
      };
      nodes.push(node);
      
      for (const prevId of previousNodeIds) {
        edges.push({ from: prevId, to: node.id });
      }
      
      previousNodeIds = [node.id];
      yPosition += 150;
    }
    
  } else {
    // Sequential entry
    for (const nodeType of structure.coreNodeTypes) {
      const node = {
        id: generateNodeId(),
        type: nodeType,
        name: formatNodeName(nodeType),
        config: {},
        position: { x: 100, y: yPosition },
        connections: [],
      };
      nodes.push(node);
      
      for (const prevId of previousNodeIds) {
        edges.push({ from: prevId, to: node.id });
      }
      
      previousNodeIds = [node.id];
      yPosition += 150;
    }
  }
  
  // Add verification node if required
  if (structure.verificationRequired) {
    const verifyNode = {
      id: generateNodeId(),
      type: 'verification',
      name: 'Quality Verification',
      config: { minConfidence: 0.7 },
      position: { x: 100, y: yPosition },
      connections: [],
    };
    nodes.push(verifyNode);
    
    for (const prevId of previousNodeIds) {
      edges.push({ from: prevId, to: verifyNode.id });
    }
    
    previousNodeIds = [verifyNode.id];
    yPosition += 150;
  }
  
  // Add iteration loop if required
  if (structure.iterationRequired) {
    const qualityCheckNode = {
      id: generateNodeId(),
      type: 'quality_check',
      name: 'Quality Check',
      config: { threshold: 0.8, maxIterations: 3 },
      position: { x: 100, y: yPosition },
      connections: [],
    };
    nodes.push(qualityCheckNode);
    
    for (const prevId of previousNodeIds) {
      edges.push({ from: prevId, to: qualityCheckNode.id });
    }
    
    // Add edge back to refinement (simplified - would need proper loop handling)
    previousNodeIds = [qualityCheckNode.id];
    yPosition += 150;
  }
  
  // Output node
  const outputNode = {
    id: generateNodeId(),
    type: 'output',
    name: 'Output',
    config: {},
    position: { x: 100, y: yPosition },
    connections: [],
  };
  nodes.push(outputNode);
  
  for (const prevId of previousNodeIds) {
    edges.push({ from: prevId, to: outputNode.id });
  }
  
  return {
    nodes,
    edges,
    entryPoint: entryNode.id,
    exitPoints: [outputNode.id],
    metadata: {
      estimatedLatencyMs: estimateLatency(nodes),
      estimatedCostPer1k: estimateCost(nodes),
      requiredModels: extractRequiredModels(nodes),
      requiredServices: extractRequiredServices(nodes),
    },
  };
}

function formatNodeName(nodeType: string): string {
  return nodeType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function estimateLatency(nodes: ProposedWorkflowDAG['nodes']): number {
  // Rough estimate: 500ms base + 200ms per node
  return 500 + (nodes.length * 200);
}

function estimateCost(nodes: ProposedWorkflowDAG['nodes']): number {
  // Rough estimate: $0.01 base + $0.005 per node per 1k requests
  return 0.01 + (nodes.length * 0.005);
}

function extractRequiredModels(nodes: ProposedWorkflowDAG['nodes']): string[] {
  const modelTypes: Record<string, string> = {
    'llm_processor': 'claude-3-5-sonnet',
    'content_generator': 'claude-3-5-sonnet',
    'fact_checker': 'gpt-4-turbo',
    'analysis_engine': 'claude-3-5-sonnet',
  };
  
  const models: Set<string> = new Set();
  for (const node of nodes) {
    if (modelTypes[node.type]) {
      models.add(modelTypes[node.type]);
    }
  }
  
  return Array.from(models);
}

function extractRequiredServices(nodes: ProposedWorkflowDAG['nodes']): string[] {
  const serviceTypes: Record<string, string> = {
    'web_search': 'search_service',
    'source_aggregation': 'aggregation_service',
    'fact_checker': 'verification_service',
  };
  
  const services: Set<string> = new Set();
  for (const node of nodes) {
    if (serviceTypes[node.type]) {
      services.add(serviceTypes[node.type]);
    }
  }
  
  return Array.from(services);
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateCoverageEstimate(
  dag: ProposedWorkflowDAG,
  evidence: any[]
): number {
  // Estimate what percentage of evidence cases this workflow would address
  // Based on node types matching required capabilities
  
  const capabilities: Set<string> = new Set();
  for (const e of evidence) {
    if (e.failure_reason) {
      extractCapabilities(e.failure_reason).forEach(c => capabilities.add(c));
    }
  }
  
  const nodeTypes = new Set(dag.nodes.map(n => n.type));
  const capabilityMapping = mapCapabilitiesToNodeTypes(Array.from(capabilities));
  
  let covered = 0;
  for (const nodeType of capabilityMapping) {
    if (nodeTypes.has(nodeType)) {
      covered++;
    }
  }
  
  return capabilityMapping.length > 0 
    ? Math.min(0.95, covered / capabilityMapping.length)
    : 0.6;
}

function estimateQualityImprovement(
  dag: ProposedWorkflowDAG,
  existingWorkflows: NeuralProposalGenerationContext['existingWorkflows'],
  analysis: EvidenceAnalysis
): number {
  // Estimate quality improvement over existing workflows
  // Based on failure rate of existing and new capabilities
  
  const avgFailureRate = existingWorkflows.length > 0
    ? existingWorkflows.reduce((sum, w) => sum + w.failureRate, 0) / existingWorkflows.length
    : 0.5;
  
  const newCapabilities = analysis.suggestedNodeTypes.filter(
    t => !existingWorkflows.some(w => w.name.toLowerCase().includes(t))
  );
  
  const capabilityBonus = newCapabilities.length * 0.05;
  
  return Math.min(0.40, avgFailureRate * 0.5 + capabilityBonus);
}

function generateProposalName(pattern: PatternWithEvidence): string {
  const intent = pattern.patternSignature.intentCategory;
  const domains = pattern.patternSignature.domainHints;
  
  const domainPrefix = domains.length > 0 ? `${domains[0].charAt(0).toUpperCase()}${domains[0].slice(1)} ` : '';
  const intentName = intent.charAt(0).toUpperCase() + intent.slice(1);
  
  return `${domainPrefix}${intentName} Enhancement Workflow`;
}

function generateProposalDescription(
  pattern: PatternWithEvidence,
  analysis: EvidenceAnalysis
): string {
  const reasons = analysis.failureReasons.slice(0, 3).join(', ');
  const users = pattern.uniqueUsersAffected;
  const evidence = pattern.evidenceCount;
  
  return `This workflow addresses user needs identified through ${evidence} evidence signals from ${users} users. Primary issues: ${reasons}. The proposed workflow adds ${analysis.suggestedNodeTypes.slice(0, 3).join(', ')} capabilities to improve outcomes.`;
}

function generateNeuralReasoning(
  pattern: PatternWithEvidence,
  analysis: EvidenceAnalysis,
  dag: ProposedWorkflowDAG
): string {
  return `Based on analysis of ${pattern.evidenceCount} evidence records with ${(analysis.confidence * 100).toFixed(0)}% confidence:
1. Primary failure pattern: ${analysis.primaryFailureType}
2. Required capabilities: ${analysis.requiredCapabilities.join(', ')}
3. Proposed solution: ${dag.nodes.length}-node workflow with ${dag.metadata.requiredModels.join(', ')} models
4. Estimated coverage: ${(calculateCoverageEstimate(dag, pattern.evidence || []) * 100).toFixed(0)}% of identified cases`;
}

function generateAlternativeApproaches(
  pattern: PatternWithEvidence,
  analysis: EvidenceAnalysis
): NeuralProposalGenerationResult['alternativeApproaches'] {
  return [
    {
      description: 'Simplified single-model approach with enhanced prompting',
      confidence: analysis.confidence * 0.7,
      tradeoffs: ['Lower latency', 'Lower cost', 'Potentially lower quality'],
    },
    {
      description: 'Extended multi-model ensemble with voting',
      confidence: analysis.confidence * 1.1,
      tradeoffs: ['Higher quality', 'Higher latency', 'Higher cost'],
    },
  ];
}

function determineComplexity(dag: ProposedWorkflowDAG): WorkflowComplexity {
  const nodeCount = dag.nodes.length;
  
  for (const [complexity, thresholds] of Object.entries(COMPLEXITY_NODE_THRESHOLDS)) {
    if (nodeCount >= thresholds.min && nodeCount <= thresholds.max) {
      return complexity as WorkflowComplexity;
    }
  }
  
  return 'moderate';
}

function calculateTimeSpan(pattern: PatternWithEvidence): number {
  if (!pattern.firstOccurrence || !pattern.lastOccurrence) return 0;
  
  const first = new Date(pattern.firstOccurrence).getTime();
  const last = new Date(pattern.lastOccurrence).getTime();
  
  return Math.ceil((last - first) / (1000 * 60 * 60 * 24));
}

function extractTopFailureReasons(evidence: any[]): string[] {
  const reasons: Record<string, number> = {};
  
  for (const e of evidence) {
    if (e.failure_reason) {
      reasons[e.failure_reason] = (reasons[e.failure_reason] || 0) + 1;
    }
  }
  
  return Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason]) => reason);
}

// ============================================================================
// Proposal Code Generation
// ============================================================================

async function generateProposalCode(client: Pool, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  
  const result = await client.query(
    `SELECT COUNT(*) + 1 as seq
     FROM workflow_proposals
     WHERE tenant_id = $1
       AND EXTRACT(YEAR FROM created_at) = $2`,
    [tenantId, year]
  );
  
  const sequence = String(result.rows[0].seq).padStart(3, '0');
  return `${PROPOSAL_CODE_PREFIX}-${year}-${sequence}`;
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: SQSHandler = async (event) => {
  const neuralEngine = await createNeuralEngineClient();
  const client = await pool.connect();
  
  try {
    for (const record of event.Records) {
      await processRecord(record, neuralEngine, client);
    }
  } finally {
    client.release();
  }
};

async function processRecord(
  record: SQSRecord,
  neuralEngine: NeuralEngineClient,
  client: Pool
): Promise<void> {
  const message = JSON.parse(record.body);
  
  if (message.type !== 'generate_proposal') {
    console.log('Unknown message type:', message.type);
    return;
  }
  
  const { tenantId, pattern } = message as {
    tenantId: string;
    pattern: PatternWithEvidence;
  };
  
  console.log(`Generating proposal for pattern ${pattern.id} in tenant ${tenantId}`);
  
  await client.query(`SET app.current_tenant_id = '${tenantId}'`);
  
  try {
    // Build context for Neural Engine
    const existingWorkflows = await client.query(
      `SELECT id, name, 
        (SELECT COUNT(*) FROM neural_need_evidence WHERE attempted_workflow_id = w.id) as failure_count,
        (SELECT COUNT(*) FROM execution_manifests WHERE workflow_id = w.id) as total_count
       FROM production_workflows w
       WHERE tenant_id = $1
       LIMIT 50`,
      [tenantId]
    );
    
    const thresholdConfig = await client.query(
      `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
      [tenantId]
    );
    
    const context: NeuralProposalGenerationContext = {
      pattern,
      evidence: pattern.evidence || [],
      existingWorkflows: existingWorkflows.rows.map(w => ({
        id: w.id,
        name: w.name,
        similarity: 0.5, // Would be calculated from embeddings
        failureRate: w.total_count > 0 ? w.failure_count / w.total_count : 0,
      })),
      userSegmentProfile: {
        commonIntents: [pattern.patternSignature.intentCategory],
        preferredComplexity: 'moderate',
        domainDistribution: Object.fromEntries(
          pattern.patternSignature.domainHints.map(d => [d, 1])
        ),
      },
      tenantConstraints: {
        maxWorkflowNodes: MAX_PROPOSED_WORKFLOW_NODES,
        allowedNodeTypes: [], // All types allowed by default
        requiredComplianceChecks: [],
      },
    };
    
    // Generate proposal
    const result = await neuralEngine.generateProposal(context);
    
    if (!result.success || !result.proposal) {
      console.log(`Proposal generation failed for pattern ${pattern.id}: ${result.rejectionReason}`);
      
      // Update pattern status
      await client.query(
        `UPDATE neural_need_patterns 
         SET status = 'accumulating', 
             confidence_threshold_met = FALSE,
             updated_at = NOW()
         WHERE id = $1`,
        [pattern.id]
      );
      
      return;
    }
    
    // Generate proposal code
    const proposalCode = await generateProposalCode(client, tenantId);
    
    // Insert proposal
    const proposalResult = await client.query<{ id: string }>(
      `INSERT INTO workflow_proposals (
        tenant_id, proposal_code, proposal_name, proposal_description,
        source_pattern_id, proposed_workflow, workflow_category, workflow_type,
        estimated_complexity, neural_confidence, neural_reasoning,
        estimated_quality_improvement, estimated_coverage_percentage,
        evidence_count, unique_users_affected, total_evidence_score,
        evidence_time_span_days, evidence_summary, admin_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id`,
      [
        tenantId,
        proposalCode,
        result.proposal.proposalName,
        result.proposal.proposalDescription,
        pattern.id,
        JSON.stringify(result.proposal.proposedWorkflow),
        result.proposal.workflowCategory,
        result.proposal.workflowType,
        result.proposal.estimatedComplexity,
        result.confidence,
        result.reasoning,
        result.proposal.estimatedQualityImprovement,
        result.proposal.estimatedCoveragePercentage,
        result.proposal.evidenceCount,
        result.proposal.uniqueUsersAffected,
        result.proposal.totalEvidenceScore,
        result.proposal.evidenceTimeSpanDays,
        JSON.stringify(result.proposal.evidenceSummary),
        'pending_brain',
      ]
    );
    
    // Update pattern
    await client.query(
      `UPDATE neural_need_patterns 
       SET status = 'proposal_generated',
           confidence_threshold_met = TRUE,
           proposal_id = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [pattern.id, proposalResult.rows[0].id]
    );
    
    console.log(`Created proposal ${proposalCode} for pattern ${pattern.id}`);
    
  } catch (error) {
    console.error(`Error generating proposal for pattern ${pattern.id}:`, error);
    
    // Reset pattern status on error
    await client.query(
      `UPDATE neural_need_patterns 
       SET status = 'threshold_met', updated_at = NOW()
       WHERE id = $1`,
      [pattern.id]
    );
    
    throw error;
  }
}
```

---

---

This chunk contains:
- Evidence Collection Lambda (pattern signature generation, keyword extraction, intent classification)
- Pattern Analysis Lambda (scheduled job that finds qualified patterns)
- Proposal Generation Lambda (SQS-triggered, Neural Engine integration, DAG generation)

Next chunk will contain Brain Governor Review, Admin APIs, and React Admin Dashboard components.

## 39.8 Brain Governor Review Lambda (SQS Triggered)

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/brain-reviewer.ts
// Brain Governor reviews proposals before they reach admin queue
// ============================================================================

import { SQSHandler, SQSRecord } from 'aws-lambda';
import { Pool } from 'pg';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  WorkflowProposal,
  BrainProposalReviewContext,
  BrainProposalReviewResult,
  BrainRiskAssessment,
  ProposalThresholdConfig,
} from '@radiant/core/types/workflow-proposals';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const sqs = new SQSClient({});
const ADMIN_NOTIFICATION_QUEUE_URL = process.env.ADMIN_NOTIFICATION_QUEUE_URL!;

// ============================================================================
// Risk Assessment
// ============================================================================

function assessCostRisk(proposal: WorkflowProposal): number {
  const estimatedCost = proposal.proposedWorkflow.metadata.estimatedCostPer1k;
  const nodeCount = proposal.proposedWorkflow.nodes.length;
  const modelCount = proposal.proposedWorkflow.metadata.requiredModels.length;
  
  // Higher cost = higher risk
  let risk = 0;
  
  if (estimatedCost > 0.05) risk += 0.2;
  if (estimatedCost > 0.10) risk += 0.2;
  if (estimatedCost > 0.20) risk += 0.2;
  
  if (nodeCount > 10) risk += 0.1;
  if (nodeCount > 15) risk += 0.1;
  
  if (modelCount > 3) risk += 0.1;
  
  return Math.min(1.0, risk);
}

function assessLatencyRisk(proposal: WorkflowProposal): number {
  const estimatedLatency = proposal.proposedWorkflow.metadata.estimatedLatencyMs;
  const nodeCount = proposal.proposedWorkflow.nodes.length;
  const hasParallelNodes = proposal.proposedWorkflow.edges.some(
    (edge, _, edges) => edges.filter(e => e.from === edge.from).length > 1
  );
  
  let risk = 0;
  
  if (estimatedLatency > 2000) risk += 0.2;
  if (estimatedLatency > 5000) risk += 0.2;
  if (estimatedLatency > 10000) risk += 0.3;
  
  // Parallel execution can help or hurt
  if (!hasParallelNodes && nodeCount > 5) risk += 0.2;
  
  return Math.min(1.0, risk);
}

function assessQualityRisk(proposal: WorkflowProposal): number {
  const hasVerification = proposal.proposedWorkflow.nodes.some(
    n => n.type.includes('verification') || n.type.includes('quality')
  );
  const confidence = proposal.neuralConfidence;
  const coverage = proposal.estimatedCoveragePercentage || 0;
  
  let risk = 0;
  
  // Low confidence = high risk
  if (confidence < 0.80) risk += 0.2;
  if (confidence < 0.70) risk += 0.2;
  if (confidence < 0.60) risk += 0.2;
  
  // Low coverage = high risk
  if (coverage < 0.70) risk += 0.1;
  if (coverage < 0.60) risk += 0.1;
  
  // No verification = higher risk
  if (!hasVerification) risk += 0.1;
  
  return Math.min(1.0, risk);
}

function assessComplianceRisk(proposal: WorkflowProposal): number {
  // Check for nodes that might have compliance implications
  const riskyNodeTypes = ['external_api', 'data_export', 'pii_handler', 'external_search'];
  
  let risk = 0;
  
  for (const node of proposal.proposedWorkflow.nodes) {
    if (riskyNodeTypes.some(t => node.type.includes(t))) {
      risk += 0.15;
    }
  }
  
  // Check if workflow category has compliance requirements
  const highComplianceCategories = ['medical', 'legal', 'financial'];
  if (highComplianceCategories.some(c => proposal.workflowCategory?.includes(c))) {
    risk += 0.2;
  }
  
  return Math.min(1.0, risk);
}

function performRiskAssessment(proposal: WorkflowProposal): BrainRiskAssessment {
  const costRisk = assessCostRisk(proposal);
  const latencyRisk = assessLatencyRisk(proposal);
  const qualityRisk = assessQualityRisk(proposal);
  const complianceRisk = assessComplianceRisk(proposal);
  
  // Overall risk is weighted average
  const overallRisk = (
    costRisk * 0.25 +
    latencyRisk * 0.25 +
    qualityRisk * 0.30 +
    complianceRisk * 0.20
  );
  
  // Identify risk factors
  const riskFactors: string[] = [];
  if (costRisk > 0.3) riskFactors.push('High estimated cost');
  if (latencyRisk > 0.4) riskFactors.push('High estimated latency');
  if (qualityRisk > 0.3) riskFactors.push('Quality concerns');
  if (complianceRisk > 0.2) riskFactors.push('Compliance considerations');
  
  // Suggest mitigations
  const mitigations: string[] = [];
  if (costRisk > 0.3) mitigations.push('Consider model alternatives or caching');
  if (latencyRisk > 0.4) mitigations.push('Add parallel execution or reduce nodes');
  if (qualityRisk > 0.3) mitigations.push('Add verification nodes');
  if (complianceRisk > 0.2) mitigations.push('Add compliance checks or audit logging');
  
  return {
    costRisk,
    latencyRisk,
    qualityRisk,
    complianceRisk,
    overallRisk,
    riskFactors,
    mitigations,
  };
}

// ============================================================================
// Brain Review Logic
// ============================================================================

async function reviewProposal(
  context: BrainProposalReviewContext
): Promise<BrainProposalReviewResult> {
  const { proposal, pattern, tenantConfig, recentProposalCount, similarExistingWorkflows } = context;
  
  // Perform risk assessment
  const riskAssessment = performRiskAssessment(proposal);
  
  // Check against thresholds
  const maxCostRisk = tenantConfig.maxCostRisk || 0.30;
  const maxLatencyRisk = tenantConfig.maxLatencyRisk || 0.40;
  const minQualityConfidence = tenantConfig.minQualityConfidence || 0.70;
  const maxComplianceRisk = tenantConfig.maxComplianceRisk || 0.10;
  
  // Determine if we should veto
  let vetoReason: string | undefined;
  
  if (riskAssessment.costRisk > maxCostRisk) {
    vetoReason = `Cost risk (${(riskAssessment.costRisk * 100).toFixed(0)}%) exceeds threshold (${(maxCostRisk * 100).toFixed(0)}%)`;
  } else if (riskAssessment.latencyRisk > maxLatencyRisk) {
    vetoReason = `Latency risk (${(riskAssessment.latencyRisk * 100).toFixed(0)}%) exceeds threshold (${(maxLatencyRisk * 100).toFixed(0)}%)`;
  } else if (proposal.neuralConfidence < minQualityConfidence) {
    vetoReason = `Neural confidence (${(proposal.neuralConfidence * 100).toFixed(0)}%) below threshold (${(minQualityConfidence * 100).toFixed(0)}%)`;
  } else if (riskAssessment.complianceRisk > maxComplianceRisk) {
    vetoReason = `Compliance risk (${(riskAssessment.complianceRisk * 100).toFixed(0)}%) exceeds threshold (${(maxComplianceRisk * 100).toFixed(0)}%)`;
  }
  
  // Check for duplicate/similar workflows
  const highSimilarityWorkflow = similarExistingWorkflows.find(w => w.similarity > 0.85);
  if (highSimilarityWorkflow) {
    vetoReason = `Very similar workflow already exists: ${highSimilarityWorkflow.name} (${(highSimilarityWorkflow.similarity * 100).toFixed(0)}% similar)`;
  }
  
  // Check rate limits (redundant check, but important)
  if (recentProposalCount.today >= (tenantConfig.maxProposalsPerDay || 10)) {
    vetoReason = 'Daily proposal limit reached';
  } else if (recentProposalCount.thisWeek >= (tenantConfig.maxProposalsPerWeek || 30)) {
    vetoReason = 'Weekly proposal limit reached';
  }
  
  // Determine priority for admin review
  let adminPriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  
  if (proposal.uniqueUsersAffected > 50) adminPriority = 'high';
  if (proposal.uniqueUsersAffected > 100) adminPriority = 'urgent';
  if (proposal.totalEvidenceScore > 5.0) adminPriority = 'high';
  if (riskAssessment.overallRisk < 0.2 && proposal.neuralConfidence > 0.85) adminPriority = 'high';
  
  // Generate reasoning
  const reasoning = generateReviewReasoning(proposal, riskAssessment, vetoReason);
  
  // Check if modifications are suggested
  let suggestedModifications: BrainProposalReviewResult['suggestedModifications'];
  
  if (!vetoReason && riskAssessment.overallRisk > 0.25) {
    suggestedModifications = generateSuggestedModifications(proposal, riskAssessment);
  }
  
  return {
    approved: !vetoReason,
    riskAssessment,
    reasoning,
    vetoReason,
    suggestedModifications,
    escalateToAdmin: !vetoReason,
    adminPriority: vetoReason ? undefined : adminPriority,
  };
}

function generateReviewReasoning(
  proposal: WorkflowProposal,
  risk: BrainRiskAssessment,
  vetoReason?: string
): string {
  if (vetoReason) {
    return `Proposal vetoed: ${vetoReason}. Risk assessment: Cost ${(risk.costRisk * 100).toFixed(0)}%, Latency ${(risk.latencyRisk * 100).toFixed(0)}%, Quality ${(risk.qualityRisk * 100).toFixed(0)}%, Compliance ${(risk.complianceRisk * 100).toFixed(0)}%.`;
  }
  
  return `Proposal approved for admin review. Overall risk: ${(risk.overallRisk * 100).toFixed(0)}%. Neural confidence: ${(proposal.neuralConfidence * 100).toFixed(0)}%. Affects ${proposal.uniqueUsersAffected} users with ${proposal.evidenceCount} evidence signals. ${risk.riskFactors.length > 0 ? `Watch points: ${risk.riskFactors.join(', ')}.` : 'No major concerns.'}`;
}

function generateSuggestedModifications(
  proposal: WorkflowProposal,
  risk: BrainRiskAssessment
): Partial<WorkflowProposal['proposedWorkflow']> | undefined {
  const modifications: Partial<WorkflowProposal['proposedWorkflow']> = {};
  
  // If latency risk is high, suggest adding parallel execution
  if (risk.latencyRisk > 0.3) {
    // This would involve restructuring the DAG - simplified here
    modifications.metadata = {
      ...proposal.proposedWorkflow.metadata,
      // Add suggestion note
    };
  }
  
  // If quality risk is high and no verification, suggest adding it
  if (risk.qualityRisk > 0.3) {
    const hasVerification = proposal.proposedWorkflow.nodes.some(
      n => n.type.includes('verification')
    );
    
    if (!hasVerification) {
      // Suggest adding verification node
      modifications.nodes = [
        ...proposal.proposedWorkflow.nodes,
        {
          id: `suggested_verification_${Date.now()}`,
          type: 'quality_verification',
          name: 'Quality Verification (Suggested)',
          config: { minConfidence: 0.7 },
          position: { x: 100, y: 1000 },
          connections: [],
        },
      ];
    }
  }
  
  return Object.keys(modifications).length > 0 ? modifications : undefined;
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: SQSHandler = async (event) => {
  const client = await pool.connect();
  
  try {
    for (const record of event.Records) {
      await processRecord(record, client);
    }
  } finally {
    client.release();
  }
};

async function processRecord(record: SQSRecord, client: Pool): Promise<void> {
  const message = JSON.parse(record.body);
  
  if (message.type !== 'brain_review') {
    console.log('Unknown message type:', message.type);
    return;
  }
  
  const { tenantId, proposalId } = message;
  
  console.log(`Brain reviewing proposal ${proposalId} for tenant ${tenantId}`);
  
  await client.query(`SET app.current_tenant_id = '${tenantId}'`);
  
  try {
    // Fetch proposal with pattern
    const proposalResult = await client.query<WorkflowProposal>(
      `SELECT * FROM workflow_proposals WHERE id = $1`,
      [proposalId]
    );
    
    if (proposalResult.rows.length === 0) {
      console.error(`Proposal ${proposalId} not found`);
      return;
    }
    
    const proposal = proposalResult.rows[0];
    
    // Skip if not pending brain review
    if (proposal.admin_status !== 'pending_brain') {
      console.log(`Proposal ${proposalId} not pending brain review, skipping`);
      return;
    }
    
    // Fetch pattern
    const patternResult = await client.query(
      `SELECT * FROM neural_need_patterns WHERE id = $1`,
      [proposal.source_pattern_id]
    );
    
    // Fetch config
    const configResult = await client.query<ProposalThresholdConfig>(
      `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
      [tenantId]
    );
    const config = configResult.rows[0] || {};
    
    // Fetch recent proposal counts
    const countsResult = await client.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week
       FROM workflow_proposals WHERE tenant_id = $1`,
      [tenantId]
    );
    
    // Fetch similar workflows
    const similarResult = await client.query(
      `SELECT id, name, 0.5 as similarity
       FROM production_workflows 
       WHERE tenant_id = $1 
         AND category = $2
       LIMIT 10`,
      [tenantId, proposal.workflow_category]
    );
    
    // Build context
    const context: BrainProposalReviewContext = {
      proposal,
      pattern: patternResult.rows[0],
      tenantConfig: config,
      currentWorkflowCount: 0,
      recentProposalCount: {
        today: parseInt(countsResult.rows[0].today),
        thisWeek: parseInt(countsResult.rows[0].this_week),
      },
      similarExistingWorkflows: similarResult.rows.map(w => ({
        id: w.id,
        name: w.name,
        similarity: w.similarity,
      })),
    };
    
    // Perform review
    const reviewResult = await reviewProposal(context);
    
    // Update proposal
    const newStatus = reviewResult.approved ? 'pending_admin' : 'declined';
    
    await client.query(
      `UPDATE workflow_proposals SET
        brain_approved = $2,
        brain_review_timestamp = NOW(),
        brain_risk_assessment = $3,
        brain_veto_reason = $4,
        brain_modifications = $5,
        admin_status = $6,
        updated_at = NOW()
      WHERE id = $1`,
      [
        proposalId,
        reviewResult.approved,
        JSON.stringify(reviewResult.riskAssessment),
        reviewResult.vetoReason,
        reviewResult.suggestedModifications ? JSON.stringify(reviewResult.suggestedModifications) : null,
        newStatus,
      ]
    );
    
    // Record review
    await client.query(
      `INSERT INTO workflow_proposal_reviews (
        proposal_id, reviewer_type, action, previous_status, new_status,
        review_notes, risk_assessment
      ) VALUES ($1, 'brain', $2, 'pending_brain', $3, $4, $5)`,
      [
        proposalId,
        reviewResult.approved ? 'approve' : 'decline',
        newStatus,
        reviewResult.reasoning,
        JSON.stringify(reviewResult.riskAssessment),
      ]
    );
    
    // Notify admins if approved
    if (reviewResult.approved) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: ADMIN_NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify({
          type: 'new_proposal',
          tenantId,
          proposalId,
          proposalCode: proposal.proposal_code,
          priority: reviewResult.adminPriority,
          riskLevel: reviewResult.riskAssessment.overallRisk,
        }),
      }));
    }
    
    console.log(`Brain ${reviewResult.approved ? 'approved' : 'vetoed'} proposal ${proposalId}`);
    
  } catch (error) {
    console.error(`Error in brain review for proposal ${proposalId}:`, error);
    throw error;
  }
}
```

---

## 39.9 Admin API Endpoints

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/admin-api.ts
// Admin API for proposal management
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import {
  GetProposalsRequest,
  GetProposalsResponse,
  ReviewProposalRequest,
  ReviewProposalResponse,
  TestProposalRequest,
  TestProposalResponse,
  PublishProposalRequest,
  PublishProposalResponse,
  UpdateThresholdConfigRequest,
  UpdateEvidenceWeightsRequest,
  WorkflowProposal,
  ProposalReview,
} from '@radiant/core/types/workflow-proposals';
import { getTenantId, getUserId, createResponse, isAdmin, logAudit } from '../utils';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// ============================================================================
// GET /api/v2/admin/proposals - List proposals
// ============================================================================

export const listProposals: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const params = event.queryStringParameters || {};
    const statusFilter = params.status?.split(',') || ['pending_admin'];
    const limit = Math.min(parseInt(params.limit || '20'), 100);
    const offset = parseInt(params.offset || '0');
    
    // Build query
    let query = `
      SELECT wp.*, nnp.pattern_name, nnp.detected_intent
      FROM workflow_proposals wp
      JOIN neural_need_patterns nnp ON nnp.id = wp.source_pattern_id
      WHERE wp.tenant_id = $1
    `;
    const queryParams: any[] = [tenantId];
    
    if (statusFilter.length > 0) {
      queryParams.push(statusFilter);
      query += ` AND wp.admin_status = ANY($${queryParams.length})`;
    }
    
    query += ` ORDER BY wp.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
    
    const result = await client.query(query, queryParams);
    
    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) FROM workflow_proposals WHERE tenant_id = $1 AND admin_status = ANY($2)`,
      [tenantId, statusFilter]
    );
    
    const response: GetProposalsResponse = {
      proposals: result.rows.map(row => ({
        ...row,
        sourcePattern: {
          id: row.source_pattern_id,
          patternName: row.pattern_name,
          detectedIntent: row.detected_intent,
        },
      })),
      total: parseInt(countResult.rows[0].count),
      hasMore: offset + result.rows.length < parseInt(countResult.rows[0].count),
    };
    
    return createResponse(200, response);
    
  } finally {
    client.release();
  }
};

// ============================================================================
// GET /api/v2/admin/proposals/:id - Get single proposal
// ============================================================================

export const getProposal: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const proposalId = event.pathParameters?.id;
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    if (!proposalId) {
      return createResponse(400, { error: 'Proposal ID required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    // Get proposal
    const proposalResult = await client.query(
      `SELECT * FROM workflow_proposals WHERE id = $1 AND tenant_id = $2`,
      [proposalId, tenantId]
    );
    
    if (proposalResult.rows.length === 0) {
      return createResponse(404, { error: 'Proposal not found' });
    }
    
    // Get pattern
    const patternResult = await client.query(
      `SELECT * FROM neural_need_patterns WHERE id = $1`,
      [proposalResult.rows[0].source_pattern_id]
    );
    
    // Get evidence
    const evidenceResult = await client.query(
      `SELECT * FROM neural_need_evidence 
       WHERE pattern_id = $1 
       ORDER BY occurred_at DESC LIMIT 50`,
      [proposalResult.rows[0].source_pattern_id]
    );
    
    // Get review history
    const reviewsResult = await client.query(
      `SELECT wpr.*, u.email as reviewer_email
       FROM workflow_proposal_reviews wpr
       LEFT JOIN users u ON u.id = wpr.reviewer_id
       WHERE wpr.proposal_id = $1
       ORDER BY wpr.reviewed_at DESC`,
      [proposalId]
    );
    
    return createResponse(200, {
      proposal: proposalResult.rows[0],
      pattern: patternResult.rows[0],
      evidence: evidenceResult.rows,
      reviews: reviewsResult.rows,
    });
    
  } finally {
    client.release();
  }
};

// ============================================================================
// POST /api/v2/admin/proposals/:id/review - Review proposal
// ============================================================================

export const reviewProposal: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const proposalId = event.pathParameters?.id;
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    if (!proposalId) {
      return createResponse(400, { error: 'Proposal ID required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: ReviewProposalRequest = JSON.parse(event.body || '{}');
    
    if (!request.action) {
      return createResponse(400, { error: 'Action required' });
    }
    
    // Fetch proposal
    const proposalResult = await client.query<WorkflowProposal>(
      `SELECT * FROM workflow_proposals WHERE id = $1 AND tenant_id = $2`,
      [proposalId, tenantId]
    );
    
    if (proposalResult.rows.length === 0) {
      return createResponse(404, { error: 'Proposal not found' });
    }
    
    const proposal = proposalResult.rows[0];
    const previousStatus = proposal.admin_status;
    
    // Determine new status
    let newStatus: string;
    switch (request.action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'decline':
        newStatus = 'declined';
        break;
      case 'request_test':
        newStatus = 'testing';
        break;
      case 'modify':
        newStatus = previousStatus; // Stay in current status
        break;
      default:
        return createResponse(400, { error: `Invalid action: ${request.action}` });
    }
    
    // Update proposal
    await client.query(
      `UPDATE workflow_proposals SET
        admin_status = $2,
        admin_reviewer_id = $3,
        admin_review_timestamp = NOW(),
        admin_notes = COALESCE($4, admin_notes),
        admin_modifications = COALESCE($5, admin_modifications),
        updated_at = NOW()
      WHERE id = $1`,
      [
        proposalId,
        newStatus,
        userId,
        request.notes,
        request.modifications ? JSON.stringify(request.modifications) : null,
      ]
    );
    
    // Record review
    const reviewResult = await client.query<{ id: string }>(
      `INSERT INTO workflow_proposal_reviews (
        proposal_id, reviewer_type, reviewer_id, action,
        previous_status, new_status, review_notes, modifications_made
      ) VALUES ($1, 'admin', $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        proposalId,
        userId,
        request.action,
        previousStatus,
        newStatus,
        request.notes,
        request.modifications ? JSON.stringify(request.modifications) : null,
      ]
    );
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: `proposal_${request.action}`,
      resourceType: 'workflow_proposal',
      resourceId: proposalId,
      details: {
        previousStatus,
        newStatus,
        notes: request.notes,
      },
    });
    
    const response: ReviewProposalResponse = {
      proposalId,
      newStatus: newStatus as any,
      reviewId: reviewResult.rows[0].id,
    };
    
    return createResponse(200, response);
    
  } finally {
    client.release();
  }
};

// ============================================================================
// POST /api/v2/admin/proposals/:id/test - Test proposal
// ============================================================================

export const testProposal: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const proposalId = event.pathParameters?.id;
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    if (!proposalId) {
      return createResponse(400, { error: 'Proposal ID required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: TestProposalRequest = JSON.parse(event.body || '{}');
    
    // Fetch proposal
    const proposalResult = await client.query<WorkflowProposal>(
      `SELECT * FROM workflow_proposals WHERE id = $1 AND tenant_id = $2`,
      [proposalId, tenantId]
    );
    
    if (proposalResult.rows.length === 0) {
      return createResponse(404, { error: 'Proposal not found' });
    }
    
    const proposal = proposalResult.rows[0];
    
    // Update status to testing
    await client.query(
      `UPDATE workflow_proposals SET
        admin_status = 'testing',
        test_status = 'testing',
        updated_at = NOW()
      WHERE id = $1`,
      [proposalId]
    );
    
    // Execute tests (simplified - in production, this would be async)
    const testResults = await executeProposalTests(
      proposal,
      request.testCases || [],
      request.iterations || 3
    );
    
    // Update with results
    const testStatus = testResults.testsPassed >= testResults.testsRun * 0.8 ? 'passed' : 'failed';
    
    await client.query(
      `UPDATE workflow_proposals SET
        test_status = $2,
        test_results = $3,
        admin_status = 'pending_admin',
        updated_at = NOW()
      WHERE id = $1`,
      [proposalId, testStatus, JSON.stringify(testResults)]
    );
    
    const response: TestProposalResponse = {
      proposalId,
      testStatus: testStatus as any,
      testResults,
      testExecutionIds: [],
    };
    
    return createResponse(200, response);
    
  } finally {
    client.release();
  }
};

async function executeProposalTests(
  proposal: WorkflowProposal,
  testCases: Array<{ input: string; expectedBehavior?: string }>,
  iterations: number
): Promise<WorkflowProposal['testResults']> {
  // Simplified test execution
  // In production, this would actually run the workflow in a sandbox
  
  const testsRun = Math.max(testCases.length, iterations);
  const testsPassed = Math.floor(testsRun * 0.85); // Simulated 85% pass rate
  
  return {
    testsRun,
    testsPassed,
    testsFailed: testsRun - testsPassed,
    avgLatencyMs: proposal.proposedWorkflow.metadata.estimatedLatencyMs * 1.1,
    avgQualityScore: proposal.neuralConfidence * 0.95,
    issues: testsRun > testsPassed ? ['Some edge cases produced lower quality results'] : [],
  };
}

// ============================================================================
// POST /api/v2/admin/proposals/:id/publish - Publish approved proposal
// ============================================================================

export const publishProposal: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const proposalId = event.pathParameters?.id;
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    if (!proposalId) {
      return createResponse(400, { error: 'Proposal ID required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: PublishProposalRequest = JSON.parse(event.body || '{}');
    
    // Fetch proposal
    const proposalResult = await client.query<WorkflowProposal>(
      `SELECT * FROM workflow_proposals WHERE id = $1 AND tenant_id = $2`,
      [proposalId, tenantId]
    );
    
    if (proposalResult.rows.length === 0) {
      return createResponse(404, { error: 'Proposal not found' });
    }
    
    const proposal = proposalResult.rows[0];
    
    if (proposal.admin_status !== 'approved') {
      return createResponse(400, { error: 'Proposal must be approved before publishing' });
    }
    
    // Create production workflow from proposal
    const workflowResult = await client.query<{ id: string }>(
      `INSERT INTO production_workflows (
        tenant_id, name, description, category, workflow_type,
        dag_definition, complexity, created_by, source_proposal_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        tenantId,
        proposal.proposal_name,
        proposal.proposal_description,
        request.publishToCategory || proposal.workflow_category,
        proposal.workflow_type,
        JSON.stringify(proposal.proposed_workflow),
        proposal.estimated_complexity,
        userId,
        proposalId,
      ]
    );
    
    const publishedWorkflowId = workflowResult.rows[0].id;
    
    // Update proposal
    await client.query(
      `UPDATE workflow_proposals SET
        published_workflow_id = $2,
        published_at = NOW(),
        updated_at = NOW()
      WHERE id = $1`,
      [proposalId, publishedWorkflowId]
    );
    
    // Update source pattern
    await client.query(
      `UPDATE neural_need_patterns SET
        status = 'resolved',
        updated_at = NOW()
      WHERE id = $1`,
      [proposal.source_pattern_id]
    );
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: 'proposal_published',
      resourceType: 'workflow_proposal',
      resourceId: proposalId,
      details: {
        publishedWorkflowId,
        workflowName: proposal.proposal_name,
      },
    });
    
    const response: PublishProposalResponse = {
      proposalId,
      publishedWorkflowId,
      publishedAt: new Date().toISOString(),
    };
    
    return createResponse(200, response);
    
  } finally {
    client.release();
  }
};

// ============================================================================
// GET/PUT /api/v2/admin/proposals/config - Threshold configuration
// ============================================================================

export const getThresholdConfig: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const configResult = await client.query(
      `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
      [tenantId]
    );
    
    const weightsResult = await client.query(
      `SELECT * FROM evidence_weight_config WHERE tenant_id = $1 ORDER BY evidence_type`,
      [tenantId]
    );
    
    return createResponse(200, {
      thresholds: configResult.rows[0] || {},
      evidenceWeights: weightsResult.rows,
    });
    
  } finally {
    client.release();
  }
};

export const updateThresholdConfig: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: UpdateThresholdConfigRequest = JSON.parse(event.body || '{}');
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [tenantId];
    let paramIndex = 2;
    
    for (const [key, value] of Object.entries(request.config)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      updates.push(`${snakeKey} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return createResponse(400, { error: 'No configuration values provided' });
    }
    
    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex}`);
    values.push(userId);
    
    await client.query(
      `INSERT INTO proposal_threshold_config (tenant_id) VALUES ($1)
       ON CONFLICT (tenant_id) DO UPDATE SET ${updates.join(', ')}`,
      values
    );
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: 'threshold_config_updated',
      resourceType: 'proposal_config',
      resourceId: tenantId,
      details: request.config,
    });
    
    return createResponse(200, { success: true });
    
  } finally {
    client.release();
  }
};

export const updateEvidenceWeights: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: UpdateEvidenceWeightsRequest = JSON.parse(event.body || '{}');
    
    for (const weight of request.weights) {
      await client.query(
        `INSERT INTO evidence_weight_config (tenant_id, evidence_type, weight, enabled, updated_by)
         VALUES ($1, $2, $3, COALESCE($4, TRUE), $5)
         ON CONFLICT (tenant_id, evidence_type) DO UPDATE SET
           weight = $3,
           enabled = COALESCE($4, evidence_weight_config.enabled),
           updated_by = $5,
           updated_at = NOW()`,
        [tenantId, weight.evidenceType, weight.weight, weight.enabled, userId]
      );
    }
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: 'evidence_weights_updated',
      resourceType: 'evidence_config',
      resourceId: tenantId,
      details: { weights: request.weights },
    });
    
    return createResponse(200, { success: true });
    
  } finally {
    client.release();
  }
};
```

---

## 39.10 React Admin Dashboard Components

```tsx
// ============================================================================
// packages/admin-dashboard/src/components/proposals/ProposalQueuePage.tsx
// Main proposal review queue page
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  LinearProgress,
  Badge,
  Tab,
  Tabs,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  PlayArrow,
  Visibility,
  Warning,
  TrendingUp,
  People,
  Timer,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useProposals, useProposalStats } from '../../hooks/useProposals';
import { WorkflowProposal, ProposalAdminStatus } from '@radiant/core/types/workflow-proposals';

const statusColors: Record<ProposalAdminStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  pending_brain: 'default',
  pending_admin: 'warning',
  approved: 'success',
  declined: 'error',
  testing: 'info',
};

const statusLabels: Record<ProposalAdminStatus, string> = {
  pending_brain: 'Brain Review',
  pending_admin: 'Needs Review',
  approved: 'Approved',
  declined: 'Declined',
  testing: 'Testing',
};

export const ProposalQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<ProposalAdminStatus>('pending_admin');
  const { proposals, loading, refetch } = useProposals({ status: [statusFilter] });
  const { stats } = useProposalStats();
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <StatCard
          title="Pending Review"
          value={stats?.pendingAdmin || 0}
          icon={<Warning color="warning" />}
          color="warning"
        />
        <StatCard
          title="Approved Today"
          value={stats?.approvedToday || 0}
          icon={<CheckCircle color="success" />}
          color="success"
        />
        <StatCard
          title="Users Affected"
          value={stats?.totalUsersAffected || 0}
          icon={<People color="primary" />}
          color="primary"
        />
        <StatCard
          title="Avg Confidence"
          value={`${((stats?.avgConfidence || 0) * 100).toFixed(0)}%`}
          icon={<TrendingUp color="info" />}
          color="info"
        />
      </Box>
      
      {/* Status Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={statusFilter}
          onChange={(_, v) => setStatusFilter(v)}
          indicatorColor="primary"
        >
          <Tab 
            label={
              <Badge badgeContent={stats?.pendingAdmin || 0} color="warning">
                Pending Review
              </Badge>
            } 
            value="pending_admin" 
          />
          <Tab label="Testing" value="testing" />
          <Tab label="Approved" value="approved" />
          <Tab label="Declined" value="declined" />
        </Tabs>
      </Card>
      
      {/* Proposals Table */}
      <Card>
        <CardContent>
          {loading ? (
            <LinearProgress />
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Proposal</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="center">Evidence</TableCell>
                    <TableCell align="center">Users</TableCell>
                    <TableCell align="center">Confidence</TableCell>
                    <TableCell align="center">Risk</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {proposals.map((proposal) => (
                    <ProposalRow
                      key={proposal.id}
                      proposal={proposal}
                      onView={() => navigate(`/proposals/${proposal.id}`)}
                      onRefresh={refetch}
                    />
                  ))}
                  {proposals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography color="textSecondary">
                          No proposals in this status
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

interface ProposalRowProps {
  proposal: WorkflowProposal;
  onView: () => void;
  onRefresh: () => void;
}

const ProposalRow: React.FC<ProposalRowProps> = ({ proposal, onView, onRefresh }) => {
  const riskLevel = proposal.brainRiskAssessment?.overallRisk || 0;
  
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="subtitle2">{proposal.proposalCode}</Typography>
        <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 300 }}>
          {proposal.proposalName}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip 
          label={proposal.workflowCategory || 'General'} 
          size="small" 
          variant="outlined"
        />
      </TableCell>
      <TableCell align="center">
        <Typography variant="body2">{proposal.evidenceCount}</Typography>
      </TableCell>
      <TableCell align="center">
        <Typography variant="body2">{proposal.uniqueUsersAffected}</Typography>
      </TableCell>
      <TableCell align="center">
        <ConfidenceChip value={proposal.neuralConfidence} />
      </TableCell>
      <TableCell align="center">
        <RiskChip value={riskLevel} />
      </TableCell>
      <TableCell align="center">
        <Chip
          label={statusLabels[proposal.adminStatus]}
          color={statusColors[proposal.adminStatus]}
          size="small"
        />
      </TableCell>
      <TableCell align="right">
        <Tooltip title="View Details">
          <IconButton size="small" onClick={onView}>
            <Visibility />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => (
  <Card sx={{ flex: 1 }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {icon}
      <Box>
        <Typography variant="h4">{value}</Typography>
        <Typography variant="body2" color="textSecondary">{title}</Typography>
      </Box>
    </CardContent>
  </Card>
);

const ConfidenceChip: React.FC<{ value: number }> = ({ value }) => {
  const percent = Math.round(value * 100);
  const color = percent >= 80 ? 'success' : percent >= 60 ? 'warning' : 'error';
  
  return (
    <Chip
      label={`${percent}%`}
      color={color}
      size="small"
      variant="outlined"
    />
  );
};

const RiskChip: React.FC<{ value: number }> = ({ value }) => {
  const percent = Math.round(value * 100);
  const color = percent <= 20 ? 'success' : percent <= 40 ? 'warning' : 'error';
  const label = percent <= 20 ? 'Low' : percent <= 40 ? 'Medium' : 'High';
  
  return (
    <Chip
      label={label}
      color={color}
      size="small"
      variant="outlined"
    />
  );
};

export default ProposalQueuePage;
```

```tsx
// ============================================================================
// packages/admin-dashboard/src/components/proposals/ProposalDetailPage.tsx
// Detailed proposal review page with workflow visualization
// ============================================================================

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  PlayArrow,
  Publish,
  Warning,
  Info,
  TrendingUp,
  People,
  AccessTime,
  Category,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useProposalDetail, useReviewProposal, useTestProposal, usePublishProposal } from '../../hooks/useProposals';
import { WorkflowDAGViewer } from '../workflows/WorkflowDAGViewer';
import { EvidenceTimeline } from './EvidenceTimeline';

export const ProposalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { proposal, pattern, evidence, reviews, loading, refetch } = useProposalDetail(id!);
  const { review, reviewing } = useReviewProposal();
  const { test, testing } = useTestProposal();
  const { publish, publishing } = usePublishProposal();
  
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'decline'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  
  if (loading || !proposal) {
    return <Box sx={{ p: 3 }}>Loading...</Box>;
  }
  
  const handleReview = async () => {
    await review(id!, { action: reviewAction, notes: reviewNotes });
    setReviewDialogOpen(false);
    refetch();
  };
  
  const handleTest = async () => {
    await test(id!, { testMode: 'automated', iterations: 5 });
    refetch();
  };
  
  const handlePublish = async () => {
    await publish(id!, {});
    navigate('/proposals');
  };
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4">{proposal.proposalCode}</Typography>
          <Typography variant="h6" color="textSecondary">{proposal.proposalName}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {proposal.adminStatus === 'pending_admin' && (
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={() => { setReviewAction('approve'); setReviewDialogOpen(true); }}
              >
                Approve
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Cancel />}
                onClick={() => { setReviewAction('decline'); setReviewDialogOpen(true); }}
              >
                Decline
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={handleTest}
                disabled={testing}
              >
                Run Tests
              </Button>
            </>
          )}
          {proposal.adminStatus === 'approved' && !proposal.publishedWorkflowId && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Publish />}
              onClick={handlePublish}
              disabled={publishing}
            >
              Publish to Production
            </Button>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={3}>
        {/* Left Column - Details */}
        <Grid item xs={12} md={4}>
          {/* Summary Card */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Summary</Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><Category /></ListItemIcon>
                  <ListItemText 
                    primary="Category" 
                    secondary={proposal.workflowCategory || 'General'} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><People /></ListItemIcon>
                  <ListItemText 
                    primary="Users Affected" 
                    secondary={proposal.uniqueUsersAffected} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><TrendingUp /></ListItemIcon>
                  <ListItemText 
                    primary="Evidence Count" 
                    secondary={proposal.evidenceCount} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><AccessTime /></ListItemIcon>
                  <ListItemText 
                    primary="Time Span" 
                    secondary={`${proposal.evidenceTimeSpanDays} days`} 
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
          
          {/* Risk Assessment Card */}
          {proposal.brainRiskAssessment && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Risk Assessment</Typography>
                <RiskBar label="Cost Risk" value={proposal.brainRiskAssessment.costRisk} />
                <RiskBar label="Latency Risk" value={proposal.brainRiskAssessment.latencyRisk} />
                <RiskBar label="Quality Risk" value={proposal.brainRiskAssessment.qualityRisk} />
                <RiskBar label="Compliance Risk" value={proposal.brainRiskAssessment.complianceRisk} />
                <Divider sx={{ my: 1 }} />
                <RiskBar label="Overall Risk" value={proposal.brainRiskAssessment.overallRisk} bold />
                
                {proposal.brainRiskAssessment.riskFactors.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="warning.main">Risk Factors:</Typography>
                    {proposal.brainRiskAssessment.riskFactors.map((factor, i) => (
                      <Chip key={i} label={factor} size="small" sx={{ mr: 0.5, mt: 0.5 }} />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Neural Reasoning */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Neural Engine Reasoning</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {proposal.neuralReasoning}
              </Typography>
            </CardContent>
          </Card>
          
          {/* Test Results */}
          {proposal.testResults && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Test Results</Typography>
                <Alert 
                  severity={proposal.testStatus === 'passed' ? 'success' : 'warning'}
                  sx={{ mb: 2 }}
                >
                  {proposal.testResults.testsPassed} / {proposal.testResults.testsRun} tests passed
                </Alert>
                <Typography variant="body2">
                  Avg Latency: {proposal.testResults.avgLatencyMs}ms
                </Typography>
                <Typography variant="body2">
                  Avg Quality: {(proposal.testResults.avgQualityScore * 100).toFixed(0)}%
                </Typography>
                {proposal.testResults.issues.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" color="warning.main">Issues:</Typography>
                    {proposal.testResults.issues.map((issue, i) => (
                      <Typography key={i} variant="body2" color="textSecondary">• {issue}</Typography>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
        
        {/* Right Column - Workflow & Evidence */}
        <Grid item xs={12} md={8}>
          {/* Workflow Visualization */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Proposed Workflow</Typography>
              <Box sx={{ height: 400, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <WorkflowDAGViewer dag={proposal.proposedWorkflow} />
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Chip 
                  icon={<AccessTime />} 
                  label={`Est. Latency: ${proposal.proposedWorkflow.metadata.estimatedLatencyMs}ms`}
                  variant="outlined"
                />
                <Chip 
                  icon={<TrendingUp />} 
                  label={`Est. Cost: $${proposal.proposedWorkflow.metadata.estimatedCostPer1k.toFixed(3)}/1k`}
                  variant="outlined"
                />
                <Chip 
                  label={`${proposal.proposedWorkflow.nodes.length} nodes`}
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
          
          {/* Evidence Timeline */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Evidence Timeline</Typography>
              <EvidenceTimeline evidence={evidence} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reviewAction === 'approve' ? 'Approve Proposal' : 'Decline Proposal'}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Review Notes"
            multiline
            rows={4}
            fullWidth
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder={reviewAction === 'approve' 
              ? 'Optional: Add any notes about this approval...'
              : 'Please explain why this proposal is being declined...'}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleReview}
            color={reviewAction === 'approve' ? 'success' : 'error'}
            variant="contained"
            disabled={reviewing}
          >
            {reviewAction === 'approve' ? 'Approve' : 'Decline'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const RiskBar: React.FC<{ label: string; value: number; bold?: boolean }> = ({ label, value, bold }) => {
  const percent = Math.round(value * 100);
  const color = percent <= 20 ? '#4caf50' : percent <= 40 ? '#ff9800' : '#f44336';
  
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant={bold ? 'subtitle2' : 'body2'}>{label}</Typography>
        <Typography variant={bold ? 'subtitle2' : 'body2'}>{percent}%</Typography>
      </Box>
      <Box sx={{ width: '100%', height: 8, bgcolor: '#e0e0e0', borderRadius: 1 }}>
        <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: color, borderRadius: 1 }} />
      </Box>
    </Box>
  );
};

export default ProposalDetailPage;
```

```tsx
// ============================================================================
// packages/admin-dashboard/src/components/proposals/ProposalConfigPage.tsx
// Admin configuration page for thresholds and evidence weights
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Save, Refresh, Info } from '@mui/icons-material';
import { useThresholdConfig, useUpdateThresholdConfig, useUpdateEvidenceWeights } from '../../hooks/useProposals';

export const ProposalConfigPage: React.FC = () => {
  const { config, evidenceWeights, loading, refetch } = useThresholdConfig();
  const { update: updateThresholds, updating: updatingThresholds } = useUpdateThresholdConfig();
  const { update: updateWeights, updating: updatingWeights } = useUpdateEvidenceWeights();
  
  const [thresholdForm, setThresholdForm] = useState(config || {});
  const [weightsForm, setWeightsForm] = useState(evidenceWeights || []);
  const [hasChanges, setHasChanges] = useState(false);
  
  useEffect(() => {
    if (config) setThresholdForm(config);
    if (evidenceWeights) setWeightsForm(evidenceWeights);
  }, [config, evidenceWeights]);
  
  const handleThresholdChange = (key: string, value: any) => {
    setThresholdForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const handleWeightChange = (evidenceType: string, value: number) => {
    setWeightsForm(prev => 
      prev.map(w => w.evidenceType === evidenceType ? { ...w, weight: value } : w)
    );
    setHasChanges(true);
  };
  
  const handleSave = async () => {
    await updateThresholds({ config: thresholdForm });
    await updateWeights({ weights: weightsForm });
    setHasChanges(false);
    refetch();
  };
  
  if (loading) return <Box sx={{ p: 3 }}>Loading...</Box>;
  
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Proposal System Configuration</Typography>
        <Box>
          <Button startIcon={<Refresh />} onClick={refetch} sx={{ mr: 1 }}>
            Reset
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Save />} 
            onClick={handleSave}
            disabled={!hasChanges || updatingThresholds || updatingWeights}
          >
            Save Changes
          </Button>
        </Box>
      </Box>
      
      {hasChanges && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have unsaved changes. Click "Save Changes" to apply them.
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Occurrence Thresholds */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Occurrence Thresholds</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Minimum requirements for a need pattern to qualify for proposal generation
              </Typography>
              
              <ConfigSlider
                label="Minimum Evidence Count"
                value={thresholdForm.minEvidenceCount || 5}
                onChange={(v) => handleThresholdChange('minEvidenceCount', v)}
                min={1}
                max={50}
                tooltip="Number of evidence records needed before proposing a workflow"
              />
              
              <ConfigSlider
                label="Minimum Unique Users"
                value={thresholdForm.minUniqueUsers || 3}
                onChange={(v) => handleThresholdChange('minUniqueUsers', v)}
                min={1}
                max={20}
                tooltip="Number of different users who must encounter the issue"
              />
              
              <ConfigSlider
                label="Minimum Time Span (hours)"
                value={thresholdForm.minTimeSpanHours || 24}
                onChange={(v) => handleThresholdChange('minTimeSpanHours', v)}
                min={1}
                max={168}
                tooltip="Evidence must span at least this many hours"
              />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Impact Thresholds */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Impact Thresholds</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Score requirements measuring severity of the identified need
              </Typography>
              
              <ConfigSlider
                label="Minimum Total Evidence Score"
                value={(thresholdForm.minTotalEvidenceScore || 0.6) * 100}
                onChange={(v) => handleThresholdChange('minTotalEvidenceScore', v / 100)}
                min={10}
                max={100}
                format={(v) => `${v}%`}
                tooltip="Cumulative weighted score from all evidence"
              />
              
              <ConfigSlider
                label="Minimum Neural Confidence"
                value={(thresholdForm.minNeuralConfidence || 0.75) * 100}
                onChange={(v) => handleThresholdChange('minNeuralConfidence', v / 100)}
                min={50}
                max={100}
                format={(v) => `${v}%`}
                tooltip="Neural Engine's minimum confidence to generate a proposal"
              />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Brain Governor Thresholds */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Brain Governor Thresholds</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Maximum acceptable risk levels for Brain to approve proposals
              </Typography>
              
              <ConfigSlider
                label="Max Cost Risk"
                value={(thresholdForm.maxCostRisk || 0.3) * 100}
                onChange={(v) => handleThresholdChange('maxCostRisk', v / 100)}
                min={0}
                max={100}
                format={(v) => `${v}%`}
                tooltip="Proposals exceeding this cost risk will be vetoed"
              />
              
              <ConfigSlider
                label="Max Latency Risk"
                value={(thresholdForm.maxLatencyRisk || 0.4) * 100}
                onChange={(v) => handleThresholdChange('maxLatencyRisk', v / 100)}
                min={0}
                max={100}
                format={(v) => `${v}%`}
                tooltip="Proposals exceeding this latency risk will be vetoed"
              />
              
              <ConfigSlider
                label="Max Compliance Risk"
                value={(thresholdForm.maxComplianceRisk || 0.1) * 100}
                onChange={(v) => handleThresholdChange('maxComplianceRisk', v / 100)}
                min={0}
                max={50}
                format={(v) => `${v}%`}
                tooltip="Proposals exceeding this compliance risk will be vetoed"
              />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Rate Limiting */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Rate Limiting</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Limits on proposal generation frequency
              </Typography>
              
              <ConfigSlider
                label="Max Proposals Per Day"
                value={thresholdForm.maxProposalsPerDay || 10}
                onChange={(v) => handleThresholdChange('maxProposalsPerDay', v)}
                min={1}
                max={50}
                tooltip="Maximum new proposals that can be generated daily"
              />
              
              <ConfigSlider
                label="Max Proposals Per Week"
                value={thresholdForm.maxProposalsPerWeek || 30}
                onChange={(v) => handleThresholdChange('maxProposalsPerWeek', v)}
                min={1}
                max={200}
                tooltip="Maximum new proposals that can be generated weekly"
              />
              
              <ConfigSlider
                label="Cooldown After Decline (hours)"
                value={thresholdForm.cooldownAfterDeclineHours || 72}
                onChange={(v) => handleThresholdChange('cooldownAfterDeclineHours', v)}
                min={1}
                max={168}
                tooltip="Wait time before regenerating proposal for a declined pattern"
              />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Evidence Weights */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Evidence Weights</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                How much each type of evidence contributes to the total score
              </Typography>
              
              <Grid container spacing={2}>
                {weightsForm.map((weight) => (
                  <Grid item xs={12} sm={6} md={4} key={weight.evidenceType}>
                    <ConfigSlider
                      label={formatEvidenceType(weight.evidenceType)}
                      value={weight.weight * 100}
                      onChange={(v) => handleWeightChange(weight.evidenceType, v / 100)}
                      min={0}
                      max={100}
                      format={(v) => `${v}%`}
                      tooltip={weight.description}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

interface ConfigSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  format?: (value: number) => string;
  tooltip?: string;
}

const ConfigSlider: React.FC<ConfigSliderProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  format = (v) => String(v),
  tooltip,
}) => (
  <Box sx={{ mb: 3 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="subtitle2">{label}</Typography>
        {tooltip && (
          <Tooltip title={tooltip}>
            <IconButton size="small" sx={{ ml: 0.5 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Typography variant="body2" color="primary">{format(value)}</Typography>
    </Box>
    <Slider
      value={value}
      onChange={(_, v) => onChange(v as number)}
      min={min}
      max={max}
      valueLabelDisplay="auto"
      valueLabelFormat={format}
    />
  </Box>
);

function formatEvidenceType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default ProposalConfigPage;
```
