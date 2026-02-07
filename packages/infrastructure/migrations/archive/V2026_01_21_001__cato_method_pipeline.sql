-- ============================================================================
-- Project Cato: Method Pipeline Schema
-- Version 5.0 - Universal Method Protocol Implementation
-- ============================================================================
-- This migration adds the core tables for Project Cato's method pipeline:
-- - Schema Registry (self-describing outputs)
-- - Method Registry (70+ composable methods)
-- - Tool Registry (MCP tool definitions)
-- - Pipeline execution tracking
-- - Method invocations and envelopes
-- - Audit prompt records
-- - Compensation log (SAGA pattern)
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Method types for the pipeline
CREATE TYPE cato_method_type AS ENUM (
    'OBSERVER',
    'PARSER',
    'ROUTER',
    'PROPOSER',
    'STRATEGIST',
    'PLANNER',
    'CRITIC',
    'VALIDATOR',
    'JUDGE',
    'DECIDER',
    'SYNTHESIZER',
    'RESOLVER',
    'EXECUTOR',
    'TRANSFORMER',
    'GENERATOR',
    'ORCHESTRATOR',
    'CHECKPOINT',
    'SPLITTER',
    'JOINER',
    'RESEARCHER',
    'FACT_CHECKER',
    'SUMMARIZER',
    'TRANSLATOR',
    'CUSTOM'
);

-- Output types produced by methods
CREATE TYPE cato_output_type AS ENUM (
    'CLASSIFICATION',
    'ANALYSIS',
    'ASSESSMENT',
    'VERIFICATION',
    'PLAN',
    'PROPOSAL',
    'RECOMMENDATION',
    'CRITIQUE',
    'APPROVAL',
    'JUDGMENT',
    'SYNTHESIS',
    'SUMMARY',
    'RESOLUTION',
    'EXECUTION_RESULT',
    'VALIDATION_RESULT',
    'CONTENT',
    'TRANSFORMATION',
    'ROUTING_DECISION',
    'CHECKPOINT_REQUEST',
    'ERROR',
    'CUSTOM'
);

-- Risk levels with CRITICAL triggering veto
CREATE TYPE cato_risk_level AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'NONE'
);

-- Context pruning strategies
CREATE TYPE cato_context_strategy AS ENUM (
    'FULL',
    'SUMMARY',
    'TAIL',
    'RELEVANT',
    'MINIMAL'
);

-- Checkpoint modes
CREATE TYPE cato_checkpoint_mode AS ENUM (
    'AUTO',
    'MANUAL',
    'CONDITIONAL',
    'DISABLED'
);

-- Checkpoint decisions
CREATE TYPE cato_checkpoint_decision AS ENUM (
    'APPROVED',
    'REJECTED',
    'MODIFIED',
    'AUTO_APPROVED',
    'TIMEOUT',
    'ESCALATED'
);

-- Triage decisions from risk engine
CREATE TYPE cato_triage_decision AS ENUM (
    'AUTO_EXECUTE',
    'CHECKPOINT_REQUIRED',
    'BLOCKED'
);

-- Compensation types for SAGA pattern
CREATE TYPE cato_compensation_type AS ENUM (
    'DELETE',
    'RESTORE',
    'NOTIFY',
    'MANUAL',
    'NONE'
);

-- Pipeline execution status
CREATE TYPE cato_pipeline_status AS ENUM (
    'PENDING',
    'RUNNING',
    'PAUSED',
    'CHECKPOINT_WAITING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'ROLLED_BACK'
);

-- Method invocation status
CREATE TYPE cato_invocation_status AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'SKIPPED',
    'CANCELLED'
);

-- ============================================================================
-- SCHEMA DEFINITIONS (Schema Registry)
-- ============================================================================
-- Stores JSON Schema definitions for self-describing outputs
-- Methods reference these via schema_ref_id instead of embedding full schemas

CREATE TABLE cato_schema_definitions (
    schema_ref_id       VARCHAR(100) PRIMARY KEY,
    schema_name         VARCHAR(100) NOT NULL,
    version             VARCHAR(20) NOT NULL,
    
    -- The actual JSON Schema definition
    json_schema         JSONB NOT NULL,
    
    -- Human-readable field descriptions
    field_descriptions  JSONB NOT NULL DEFAULT '{}',
    
    -- Which output types use this schema
    used_by_output_types cato_output_type[] NOT NULL DEFAULT '{}',
    
    -- Which methods produce this schema
    produced_by_methods VARCHAR(100)[] NOT NULL DEFAULT '{}',
    
    -- Example payload for documentation
    example_payload     JSONB,
    
    -- Scope: SYSTEM (built-in) or TENANT (custom)
    scope               VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    tenant_id           UUID REFERENCES tenants(id),
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_scope CHECK (
        (scope = 'SYSTEM' AND tenant_id IS NULL) OR
        (scope = 'TENANT' AND tenant_id IS NOT NULL)
    )
);

-- ============================================================================
-- METHOD DEFINITIONS (Method Registry)
-- ============================================================================
-- Defines all available methods with their capabilities, context strategies,
-- and prompt templates

CREATE TABLE cato_method_definitions (
    method_id           VARCHAR(100) PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    description         TEXT NOT NULL,
    method_type         cato_method_type NOT NULL,
    version             VARCHAR(20) NOT NULL,
    
    -- Capabilities and output types
    capabilities        VARCHAR(100)[] NOT NULL DEFAULT '{}',
    output_types        cato_output_type[] NOT NULL,
    use_cases           TEXT[] DEFAULT '{}',
    
    -- Context requirements
    requires_in_context JSONB NOT NULL DEFAULT '[]',
    accepts_output_types cato_output_type[] NOT NULL DEFAULT '{}',
    typical_predecessors VARCHAR(100)[] DEFAULT '{}',
    typical_successors  VARCHAR(100)[] DEFAULT '{}',
    
    -- Context strategy configuration
    context_strategy    JSONB NOT NULL,
    
    -- Model configuration
    supported_models    JSONB NOT NULL,
    default_model       VARCHAR(100) NOT NULL,
    system_prompt_template TEXT NOT NULL,
    user_prompt_template TEXT,
    prompt_variables    JSONB DEFAULT '[]',
    
    -- Output schema reference
    output_schema_ref   VARCHAR(100) REFERENCES cato_schema_definitions(schema_ref_id),
    
    -- Execution metadata
    estimated_cost_cents INTEGER DEFAULT 0,
    estimated_duration_ms INTEGER DEFAULT 1000,
    risk_category       cato_risk_level DEFAULT 'LOW',
    parallelizable      BOOLEAN DEFAULT FALSE,
    idempotent          BOOLEAN DEFAULT FALSE,
    
    -- Scope and access control
    scope               VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    tenant_id           UUID REFERENCES tenants(id),
    enabled             BOOLEAN DEFAULT TRUE,
    min_tier            VARCHAR(50) DEFAULT 'FREE',
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_method_scope CHECK (
        (scope = 'SYSTEM' AND tenant_id IS NULL) OR
        (scope = 'TENANT' AND tenant_id IS NOT NULL)
    )
);

-- ============================================================================
-- TOOL DEFINITIONS (MCP Tool Registry)
-- ============================================================================
-- Defines available tools (MCP or Lambda-based) that can be invoked by methods

CREATE TABLE cato_tool_definitions (
    tool_id             VARCHAR(100) PRIMARY KEY,
    tool_name           VARCHAR(200) NOT NULL,
    description         TEXT NOT NULL,
    
    -- Execution configuration
    -- For MCP: mcp_server contains server URL
    -- For Lambda: mcp_server contains 'lambda://{function_name}'
    mcp_server          VARCHAR(255) NOT NULL,
    
    -- Schema definitions
    input_schema        JSONB NOT NULL,
    output_schema       JSONB NOT NULL,
    
    -- Risk and reversibility
    risk_category       cato_risk_level NOT NULL DEFAULT 'MEDIUM',
    supports_dry_run    BOOLEAN NOT NULL DEFAULT FALSE,
    is_reversible       BOOLEAN NOT NULL DEFAULT FALSE,
    compensation_type   cato_compensation_type NOT NULL DEFAULT 'NONE',
    compensation_tool   VARCHAR(100),
    
    -- Cost and limits
    estimated_cost_cents INTEGER DEFAULT 0,
    rate_limit          JSONB,
    required_permissions VARCHAR(100)[] DEFAULT '{}',
    
    -- Categorization
    category            VARCHAR(100),
    tags                VARCHAR(50)[] DEFAULT '{}',
    
    -- Scope and access
    scope               VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    tenant_id           UUID REFERENCES tenants(id),
    enabled             BOOLEAN DEFAULT TRUE,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_tool_scope CHECK (
        (scope = 'SYSTEM' AND tenant_id IS NULL) OR
        (scope = 'TENANT' AND tenant_id IS NOT NULL)
    )
);

-- ============================================================================
-- PIPELINE TEMPLATES
-- ============================================================================
-- Pre-defined method chains for common workflows

CREATE TABLE cato_pipeline_templates (
    template_id         VARCHAR(100) PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    description         TEXT NOT NULL,
    
    -- Method chain configuration
    method_chain        VARCHAR(100)[] NOT NULL,
    checkpoint_positions JSONB NOT NULL DEFAULT '{}',
    
    -- Default configuration
    default_config      JSONB NOT NULL DEFAULT '{}',
    
    -- Categorization
    category            VARCHAR(100),
    tags                VARCHAR(50)[] DEFAULT '{}',
    
    -- Scope
    scope               VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    tenant_id           UUID REFERENCES tenants(id),
    enabled             BOOLEAN DEFAULT TRUE,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PIPELINE EXECUTIONS
-- ============================================================================
-- Tracks each pipeline run from trigger to completion

CREATE TABLE cato_pipeline_executions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID,
    
    -- Status tracking
    status              cato_pipeline_status NOT NULL DEFAULT 'PENDING',
    
    -- Template used (if any)
    template_id         VARCHAR(100) REFERENCES cato_pipeline_templates(template_id),
    
    -- Configuration
    config              JSONB NOT NULL DEFAULT '{}',
    governance_preset   VARCHAR(50) NOT NULL DEFAULT 'BALANCED',
    
    -- Original request
    original_request    JSONB NOT NULL,
    original_request_hash VARCHAR(64) NOT NULL,
    
    -- Execution tracking
    methods_executed    VARCHAR(100)[] NOT NULL DEFAULT '{}',
    current_method      VARCHAR(100),
    current_sequence    INTEGER DEFAULT 0,
    
    -- Cost and duration
    total_cost_cents    INTEGER NOT NULL DEFAULT 0,
    total_duration_ms   INTEGER NOT NULL DEFAULT 0,
    total_tokens        INTEGER NOT NULL DEFAULT 0,
    
    -- Final result
    final_envelope_id   UUID,
    execution_result    JSONB,
    error               JSONB,
    
    -- Tracing
    trace_id            VARCHAR(64) NOT NULL,
    
    -- Timestamps
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PIPELINE ENVELOPES
-- ============================================================================
-- Stores the full envelope passed between methods (Universal Method Protocol)

CREATE TABLE cato_pipeline_envelopes (
    envelope_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id         UUID NOT NULL REFERENCES cato_pipeline_executions(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    
    -- Sequence in pipeline
    sequence            INTEGER NOT NULL,
    envelope_version    VARCHAR(10) NOT NULL DEFAULT '5.0',
    
    -- Source method
    source_method_id    VARCHAR(100) NOT NULL,
    source_method_type  cato_method_type NOT NULL,
    source_method_name  VARCHAR(200) NOT NULL,
    
    -- Destination method (if known)
    destination_method_id VARCHAR(100),
    routing_reason      TEXT,
    
    -- Output
    output_type         cato_output_type NOT NULL,
    output_schema_ref   VARCHAR(100) REFERENCES cato_schema_definitions(schema_ref_id),
    output_data         JSONB NOT NULL,
    output_data_hash    VARCHAR(64) NOT NULL,
    output_summary      TEXT NOT NULL,
    
    -- Confidence
    confidence_score    DECIMAL(5,4),
    confidence_factors  JSONB DEFAULT '[]',
    
    -- Context strategy applied
    context_strategy    cato_context_strategy NOT NULL,
    context             JSONB NOT NULL,
    
    -- Risk signals
    risk_signals        JSONB DEFAULT '[]',
    
    -- Tracing
    trace_id            VARCHAR(64) NOT NULL,
    span_id             VARCHAR(32) NOT NULL,
    parent_span_id      VARCHAR(32),
    
    -- Compliance
    compliance_frameworks VARCHAR(50)[] NOT NULL DEFAULT '{}',
    data_classification VARCHAR(50) DEFAULT 'INTERNAL',
    contains_pii        BOOLEAN NOT NULL DEFAULT FALSE,
    contains_phi        BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Execution metadata
    models_used         JSONB DEFAULT '[]',
    duration_ms         INTEGER NOT NULL DEFAULT 0,
    cost_cents          INTEGER NOT NULL DEFAULT 0,
    tokens_used         INTEGER NOT NULL DEFAULT 0,
    
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- METHOD INVOCATIONS
-- ============================================================================
-- Detailed record of each method invocation

CREATE TABLE cato_method_invocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id         UUID NOT NULL REFERENCES cato_pipeline_executions(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    envelope_id         UUID REFERENCES cato_pipeline_envelopes(envelope_id),
    
    -- Method info
    method_id           VARCHAR(100) NOT NULL,
    method_name         VARCHAR(200) NOT NULL,
    method_type         cato_method_type NOT NULL,
    sequence            INTEGER NOT NULL,
    
    -- Input/Output references
    input_envelope_ref  UUID REFERENCES cato_pipeline_envelopes(envelope_id),
    output_envelope_ref UUID REFERENCES cato_pipeline_envelopes(envelope_id),
    
    -- Models used
    models_used         JSONB NOT NULL DEFAULT '[]',
    
    -- Status
    status              cato_invocation_status NOT NULL DEFAULT 'PENDING',
    error               JSONB,
    retry_count         INTEGER DEFAULT 0,
    
    -- Metrics
    duration_ms         INTEGER NOT NULL DEFAULT 0,
    cost_cents          INTEGER NOT NULL DEFAULT 0,
    tokens_input        INTEGER NOT NULL DEFAULT 0,
    tokens_output       INTEGER NOT NULL DEFAULT 0,
    
    -- Tracing
    trace_id            VARCHAR(64) NOT NULL,
    span_id             VARCHAR(32) NOT NULL,
    
    -- Timestamps
    started_at          TIMESTAMPTZ NOT NULL,
    completed_at        TIMESTAMPTZ,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AUDIT PROMPT RECORDS
-- ============================================================================
-- Every AI prompt and response captured for compliance

CREATE TABLE cato_audit_prompt_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id         UUID NOT NULL REFERENCES cato_pipeline_executions(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    invocation_id       UUID NOT NULL REFERENCES cato_method_invocations(id) ON DELETE CASCADE,
    
    -- Sequence within invocation (methods may have multiple prompts)
    prompt_sequence     INTEGER NOT NULL,
    
    -- Prompt metadata
    prompt_type         VARCHAR(50) NOT NULL,
    model_id            VARCHAR(100) NOT NULL,
    model_provider      VARCHAR(50) NOT NULL,
    
    -- Actual prompts (may be redacted for PII)
    system_prompt       TEXT NOT NULL,
    user_prompt         TEXT NOT NULL,
    prompt_variables    JSONB,
    
    -- Response
    model_response      TEXT NOT NULL,
    response_metadata   JSONB NOT NULL,
    
    -- Compliance
    compliance_frameworks VARCHAR(50)[] NOT NULL DEFAULT '{}',
    contains_pii        BOOLEAN NOT NULL DEFAULT FALSE,
    contains_phi        BOOLEAN NOT NULL DEFAULT FALSE,
    pii_redacted        BOOLEAN NOT NULL DEFAULT FALSE,
    redaction_log       JSONB,
    
    -- Cost
    tokens_input        INTEGER NOT NULL DEFAULT 0,
    tokens_output       INTEGER NOT NULL DEFAULT 0,
    cost_cents          INTEGER NOT NULL DEFAULT 0,
    latency_ms          INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    prompt_sent_at      TIMESTAMPTZ NOT NULL,
    response_received_at TIMESTAMPTZ NOT NULL,
    
    -- Integrity
    content_hash        VARCHAR(64) NOT NULL,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CHECKPOINT CONFIGURATIONS
-- ============================================================================
-- Per-tenant checkpoint configuration

CREATE TABLE cato_checkpoint_configurations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    
    -- Preset selection
    preset              VARCHAR(50) NOT NULL DEFAULT 'BALANCED',
    
    -- Individual checkpoint configurations
    -- CP1: Context Gate, CP2: Plan Gate, CP3: Review Gate, 
    -- CP4: Execution Gate, CP5: Post-Mortem Gate
    checkpoints         JSONB NOT NULL DEFAULT '{
        "CP1": {"mode": "CONDITIONAL", "trigger_on": ["ambiguous_intent", "missing_context"]},
        "CP2": {"mode": "CONDITIONAL", "trigger_on": ["high_cost", "irreversible_actions"]},
        "CP3": {"mode": "CONDITIONAL", "trigger_on": ["objections_raised", "consensus_not_reached"]},
        "CP4": {"mode": "CONDITIONAL", "trigger_on": ["risk_above_threshold", "cost_above_threshold"]},
        "CP5": {"mode": "DISABLED", "trigger_on": []}
    }',
    
    -- Domain-specific overrides
    domain_overrides    JSONB NOT NULL DEFAULT '{}',
    
    -- Action type overrides
    action_type_overrides JSONB NOT NULL DEFAULT '{}',
    
    -- Timeout configuration
    default_timeout_seconds INTEGER DEFAULT 3600,
    timeout_action      cato_checkpoint_decision DEFAULT 'ESCALATED',
    
    -- Escalation chain
    escalation_chain    JSONB NOT NULL DEFAULT '[]',
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CHECKPOINT DECISIONS
-- ============================================================================
-- Records of human decisions at checkpoints

CREATE TABLE cato_checkpoint_decisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id         UUID NOT NULL REFERENCES cato_pipeline_executions(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    envelope_id         UUID NOT NULL REFERENCES cato_pipeline_envelopes(envelope_id),
    
    -- Checkpoint identification
    checkpoint_type     VARCHAR(10) NOT NULL, -- CP1, CP2, CP3, CP4, CP5
    checkpoint_name     VARCHAR(100) NOT NULL,
    trigger_reason      TEXT NOT NULL,
    
    -- Data presented to human
    presented_data      JSONB NOT NULL,
    available_actions   JSONB NOT NULL,
    
    -- Decision
    status              VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    decision            cato_checkpoint_decision,
    decided_by          VARCHAR(100),
    decided_by_user_id  UUID,
    modifications       TEXT[],
    feedback            TEXT,
    
    -- Timeout handling
    deadline            TIMESTAMPTZ NOT NULL,
    timeout_action      cato_checkpoint_decision NOT NULL DEFAULT 'ESCALATED',
    
    -- Escalation
    escalation_level    INTEGER NOT NULL DEFAULT 0,
    escalated_to        VARCHAR(100)[],
    
    -- Timestamps
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at          TIMESTAMPTZ,
    decision_time_ms    INTEGER,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RISK ASSESSMENTS
-- ============================================================================
-- Risk calculations with veto logic

CREATE TABLE cato_risk_assessments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id         UUID NOT NULL REFERENCES cato_pipeline_executions(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    envelope_id         UUID NOT NULL REFERENCES cato_pipeline_envelopes(envelope_id),
    
    -- Overall assessment
    overall_risk        cato_risk_level NOT NULL,
    overall_risk_score  DECIMAL(5,4) NOT NULL,
    
    -- Veto logic
    veto_applied        BOOLEAN NOT NULL DEFAULT FALSE,
    veto_factor         VARCHAR(100),
    veto_reason         TEXT,
    
    -- Individual risk factors
    risk_factors        JSONB NOT NULL DEFAULT '[]',
    
    -- Triage decision
    triage_decision     cato_triage_decision NOT NULL,
    triage_reason       TEXT NOT NULL,
    
    -- Thresholds used
    auto_execute_threshold DECIMAL(5,4) NOT NULL,
    veto_threshold      DECIMAL(5,4) NOT NULL,
    
    -- Unmitigated risks
    unmitigated_risks   TEXT[] DEFAULT '{}',
    mitigation_suggestions JSONB DEFAULT '[]',
    
    assessed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- COMPENSATION LOG (SAGA Pattern)
-- ============================================================================
-- Records compensating transactions for rollback

CREATE TABLE cato_compensation_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id         UUID NOT NULL REFERENCES cato_pipeline_executions(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    invocation_id       UUID REFERENCES cato_method_invocations(id),
    
    -- Step identification
    step_number         INTEGER NOT NULL,
    step_name           VARCHAR(200),
    
    -- Compensation details
    compensation_type   cato_compensation_type NOT NULL,
    compensation_tool   VARCHAR(100),
    compensation_inputs JSONB,
    compensation_deadline TIMESTAMPTZ,
    
    -- Affected resources
    affected_resources  JSONB NOT NULL DEFAULT '[]',
    
    -- Status
    status              VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    priority            INTEGER DEFAULT 0,
    
    -- Execution
    executed_at         TIMESTAMPTZ,
    result              JSONB,
    error               TEXT,
    retry_count         INTEGER DEFAULT 0,
    
    -- Original action reference
    original_action     JSONB NOT NULL,
    original_result     JSONB,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CATO MERKLE CHAIN (Extended)
-- ============================================================================
-- Extends existing merkle_chain for pipeline-specific records

CREATE TABLE cato_merkle_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    pipeline_id         UUID REFERENCES cato_pipeline_executions(id),
    
    -- Sequence
    sequence_number     BIGSERIAL NOT NULL,
    
    -- Record reference
    record_type         VARCHAR(50) NOT NULL,
    record_id           UUID NOT NULL,
    record_hash         VARCHAR(64) NOT NULL,
    
    -- Chain
    previous_hash       VARCHAR(64) NOT NULL,
    merkle_root         VARCHAR(64) NOT NULL,
    
    -- Verification
    verified            BOOLEAN DEFAULT FALSE,
    verified_at         TIMESTAMPTZ,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, sequence_number)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Schema definitions
CREATE INDEX idx_cato_schema_scope ON cato_schema_definitions(scope, tenant_id);
CREATE INDEX idx_cato_schema_output_types ON cato_schema_definitions USING GIN(used_by_output_types);

-- Method definitions
CREATE INDEX idx_cato_method_type ON cato_method_definitions(method_type);
CREATE INDEX idx_cato_method_scope ON cato_method_definitions(scope, tenant_id);
CREATE INDEX idx_cato_method_enabled ON cato_method_definitions(enabled);

-- Tool definitions
CREATE INDEX idx_cato_tool_category ON cato_tool_definitions(category);
CREATE INDEX idx_cato_tool_risk ON cato_tool_definitions(risk_category);
CREATE INDEX idx_cato_tool_scope ON cato_tool_definitions(scope, tenant_id);

-- Pipeline executions
CREATE INDEX idx_cato_pipeline_tenant ON cato_pipeline_executions(tenant_id);
CREATE INDEX idx_cato_pipeline_status ON cato_pipeline_executions(status);
CREATE INDEX idx_cato_pipeline_user ON cato_pipeline_executions(user_id);
CREATE INDEX idx_cato_pipeline_trace ON cato_pipeline_executions(trace_id);
CREATE INDEX idx_cato_pipeline_started ON cato_pipeline_executions(started_at DESC);

-- Pipeline envelopes
CREATE INDEX idx_cato_envelope_pipeline ON cato_pipeline_envelopes(pipeline_id);
CREATE INDEX idx_cato_envelope_tenant ON cato_pipeline_envelopes(tenant_id);
CREATE INDEX idx_cato_envelope_sequence ON cato_pipeline_envelopes(pipeline_id, sequence);
CREATE INDEX idx_cato_envelope_trace ON cato_pipeline_envelopes(trace_id);
CREATE INDEX idx_cato_envelope_output_type ON cato_pipeline_envelopes(output_type);

-- Method invocations
CREATE INDEX idx_cato_invocation_pipeline ON cato_method_invocations(pipeline_id);
CREATE INDEX idx_cato_invocation_tenant ON cato_method_invocations(tenant_id);
CREATE INDEX idx_cato_invocation_method ON cato_method_invocations(method_id);
CREATE INDEX idx_cato_invocation_status ON cato_method_invocations(status);

-- Audit prompt records
CREATE INDEX idx_cato_audit_pipeline ON cato_audit_prompt_records(pipeline_id);
CREATE INDEX idx_cato_audit_tenant ON cato_audit_prompt_records(tenant_id);
CREATE INDEX idx_cato_audit_invocation ON cato_audit_prompt_records(invocation_id);
CREATE INDEX idx_cato_audit_model ON cato_audit_prompt_records(model_id);
CREATE INDEX idx_cato_audit_compliance ON cato_audit_prompt_records USING GIN(compliance_frameworks);

-- Checkpoint decisions
CREATE INDEX idx_cato_checkpoint_pipeline ON cato_checkpoint_decisions(pipeline_id);
CREATE INDEX idx_cato_checkpoint_tenant ON cato_checkpoint_decisions(tenant_id);
CREATE INDEX idx_cato_checkpoint_status ON cato_checkpoint_decisions(status);
CREATE INDEX idx_cato_checkpoint_pending ON cato_checkpoint_decisions(tenant_id, status) 
    WHERE status = 'PENDING';

-- Risk assessments
CREATE INDEX idx_cato_risk_pipeline ON cato_risk_assessments(pipeline_id);
CREATE INDEX idx_cato_risk_tenant ON cato_risk_assessments(tenant_id);
CREATE INDEX idx_cato_risk_level ON cato_risk_assessments(overall_risk);
CREATE INDEX idx_cato_risk_veto ON cato_risk_assessments(veto_applied) WHERE veto_applied = TRUE;

-- Compensation log
CREATE INDEX idx_cato_compensation_pipeline ON cato_compensation_log(pipeline_id);
CREATE INDEX idx_cato_compensation_tenant ON cato_compensation_log(tenant_id);
CREATE INDEX idx_cato_compensation_status ON cato_compensation_log(status);
CREATE INDEX idx_cato_compensation_pending ON cato_compensation_log(tenant_id, status) 
    WHERE status = 'PENDING';

-- Merkle entries
CREATE INDEX idx_cato_merkle_tenant ON cato_merkle_entries(tenant_id);
CREATE INDEX idx_cato_merkle_pipeline ON cato_merkle_entries(pipeline_id);
CREATE INDEX idx_cato_merkle_record ON cato_merkle_entries(record_type, record_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cato_schema_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_method_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_tool_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_pipeline_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_pipeline_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_pipeline_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_method_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_audit_prompt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_checkpoint_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_checkpoint_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_compensation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_merkle_entries ENABLE ROW LEVEL SECURITY;

-- Policies for system-scoped tables (allow access to system records + tenant records)
CREATE POLICY cato_schema_access ON cato_schema_definitions
    FOR ALL USING (
        scope = 'SYSTEM' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY cato_method_access ON cato_method_definitions
    FOR ALL USING (
        scope = 'SYSTEM' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY cato_tool_access ON cato_tool_definitions
    FOR ALL USING (
        scope = 'SYSTEM' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY cato_template_access ON cato_pipeline_templates
    FOR ALL USING (
        scope = 'SYSTEM' OR 
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

-- Policies for tenant-isolated tables
CREATE POLICY cato_pipeline_tenant_isolation ON cato_pipeline_executions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cato_envelope_tenant_isolation ON cato_pipeline_envelopes
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cato_invocation_tenant_isolation ON cato_method_invocations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cato_audit_tenant_isolation ON cato_audit_prompt_records
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cato_checkpoint_config_tenant_isolation ON cato_checkpoint_configurations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cato_checkpoint_decision_tenant_isolation ON cato_checkpoint_decisions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cato_risk_tenant_isolation ON cato_risk_assessments
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cato_compensation_tenant_isolation ON cato_compensation_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cato_merkle_tenant_isolation ON cato_merkle_entries
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cato_schema_definitions IS 'Schema Registry - stores JSON Schema definitions for self-describing method outputs';
COMMENT ON TABLE cato_method_definitions IS 'Method Registry - defines 70+ composable methods with context strategies and prompt templates';
COMMENT ON TABLE cato_tool_definitions IS 'Tool Registry - defines MCP and Lambda tools available for execution';
COMMENT ON TABLE cato_pipeline_templates IS 'Pre-defined method chains for common workflows';
COMMENT ON TABLE cato_pipeline_executions IS 'Tracks each pipeline run from trigger to completion';
COMMENT ON TABLE cato_pipeline_envelopes IS 'Universal Method Protocol - stores envelopes passed between methods';
COMMENT ON TABLE cato_method_invocations IS 'Detailed record of each method invocation';
COMMENT ON TABLE cato_audit_prompt_records IS 'Every AI prompt and response captured for compliance';
COMMENT ON TABLE cato_checkpoint_configurations IS 'Per-tenant checkpoint configuration with presets';
COMMENT ON TABLE cato_checkpoint_decisions IS 'Records of human decisions at checkpoints';
COMMENT ON TABLE cato_risk_assessments IS 'Risk calculations with veto logic';
COMMENT ON TABLE cato_compensation_log IS 'SAGA pattern - compensating transactions for rollback';
COMMENT ON TABLE cato_merkle_entries IS 'Merkle chain entries for audit integrity verification';
