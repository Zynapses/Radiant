-- Migration: 115_formal_reasoning.sql
-- Description: Formal Reasoning Libraries Integration
-- 
-- Creates tables for the 8 formal reasoning libraries integrated with
-- the consciousness engine:
-- 1. Z3 Theorem Prover - SMT solving, constraint verification
-- 2. PyArg - Structured argumentation semantics
-- 3. PyReason - Temporal graph reasoning
-- 4. RDFLib - Semantic web stack, SPARQL
-- 5. OWL-RL - Ontological inference
-- 6. pySHACL - Graph constraint validation
-- 7. Logic Tensor Networks - Differentiable FOL
-- 8. DeepProbLog - Probabilistic logic programming
--
-- @see docs/FORMAL-REASONING.md
-- @see packages/shared/src/types/formal-reasoning.types.ts

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Formal reasoning library identifiers
CREATE TYPE formal_reasoning_library AS ENUM (
    'z3',           -- Z3 Theorem Prover
    'pyarg',        -- PyArg Argumentation
    'pyreason',     -- PyReason Temporal
    'rdflib',       -- RDFLib Semantic Web
    'owlrl',        -- OWL-RL Ontology
    'pyshacl',      -- pySHACL Validation
    'ltn',          -- Logic Tensor Networks
    'deepproblog'   -- DeepProbLog
);

-- Reasoning task types
CREATE TYPE reasoning_task_type AS ENUM (
    'constraint_satisfaction',
    'theorem_proving',
    'belief_verification',
    'argumentation',
    'belief_revision',
    'temporal_reasoning',
    'graph_inference',
    'sparql_query',
    'knowledge_extraction',
    'ontology_inference',
    'schema_validation',
    'differentiable_logic',
    'probabilistic_inference'
);

-- Result status from formal reasoning
CREATE TYPE reasoning_result_status AS ENUM (
    'sat',          -- Satisfiable
    'unsat',        -- Unsatisfiable
    'unknown',      -- Timeout/undetermined
    'valid',        -- Theorem valid
    'invalid',      -- Theorem invalid
    'accepted',     -- Argument accepted
    'rejected',     -- Argument rejected
    'conforms',     -- SHACL passed
    'violation',    -- SHACL failed
    'inferred',     -- Facts inferred
    'error'         -- Processing error
);

-- ============================================================================
-- CONFIGURATION TABLES
-- ============================================================================

-- Per-tenant formal reasoning configuration
CREATE TABLE formal_reasoning_config (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    enabled_libraries TEXT NOT NULL DEFAULT 'z3,pyarg,pyreason,rdflib,owlrl,pyshacl,ltn,deepproblog',
    
    -- Library-specific configurations (JSONB for flexibility)
    z3_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "timeout_ms": 5000,
        "parallel_enable": true,
        "max_memory_mb": 512,
        "unsat_core": true,
        "model": true,
        "proof": false
    }'::jsonb,
    
    pyarg_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "default_semantics": "grounded",
        "compute_explanations": true,
        "max_arguments": 1000,
        "max_attacks": 5000
    }'::jsonb,
    
    pyreason_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "default_timesteps": 10,
        "convergence_threshold": 0.001,
        "max_rules": 500,
        "enable_explanations": true,
        "parallel_cores": 4
    }'::jsonb,
    
    rdflib_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "default_format": "turtle",
        "store_backend": "memory",
        "max_triples": 100000,
        "enable_federation": false
    }'::jsonb,
    
    owlrl_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "semantics": "OWLRL",
        "axiom_triples": true,
        "datatype_axioms": true
    }'::jsonb,
    
    pyshacl_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "inference": "rdfs",
        "advanced": true,
        "js_support": false,
        "abort_on_first": false,
        "max_validation_depth": 10
    }'::jsonb,
    
    ltn_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "fuzzy_semantics": "product",
        "learning_rate": 0.001,
        "epochs": 100,
        "batch_size": 32,
        "satisfaction_threshold": 0.9
    }'::jsonb,
    
    deepproblog_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "inference_method": "exact",
        "learning_rate": 0.001,
        "epochs": 50,
        "k_samples": 100
    }'::jsonb,
    
    -- Budget limits
    budget_limits JSONB NOT NULL DEFAULT '{
        "dailyInvocations": 10000,
        "dailyCostUsd": 10,
        "monthlyInvocations": 100000,
        "monthlyCostUsd": 100
    }'::jsonb,
    
    -- LLM-Modulo configuration
    llm_modulo_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "maxAttempts": 10,
        "feedbackVerbosity": "detailed",
        "verifierLibrary": "z3",
        "fallbackOnTimeout": true
    }'::jsonb,
    
    -- Global Workspace Theory configuration
    gwt_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "attentionThreshold": 0.5,
        "broadcastCooldownMs": 100,
        "maxWorkspaceSize": 10
    }'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for enabled check
CREATE INDEX idx_formal_reasoning_config_enabled ON formal_reasoning_config(enabled) WHERE enabled = true;

-- ============================================================================
-- INVOCATION LOGGING
-- ============================================================================

-- Log all formal reasoning invocations for metrics, debugging, and billing
CREATE TABLE formal_reasoning_invocations (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Request details
    library formal_reasoning_library NOT NULL,
    task_type reasoning_task_type NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    
    -- Result
    status reasoning_result_status NOT NULL,
    input_summary TEXT NOT NULL,
    output_summary TEXT NOT NULL,
    error TEXT,
    
    -- Metrics
    compute_time_ms INTEGER NOT NULL,
    memory_used_mb REAL DEFAULT 0,
    input_size INTEGER DEFAULT 0,
    output_size INTEGER DEFAULT 0,
    iterations INTEGER,
    satisfaction_score REAL,
    
    -- Cost
    cost_usd REAL NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_formal_reasoning_invocations_tenant ON formal_reasoning_invocations(tenant_id);
CREATE INDEX idx_formal_reasoning_invocations_library ON formal_reasoning_invocations(library);
CREATE INDEX idx_formal_reasoning_invocations_status ON formal_reasoning_invocations(status);
CREATE INDEX idx_formal_reasoning_invocations_created ON formal_reasoning_invocations(created_at DESC);
CREATE INDEX idx_formal_reasoning_invocations_tenant_date ON formal_reasoning_invocations(tenant_id, created_at DESC);

-- Partition by month for performance (optional, for high-volume)
-- This would be enabled in production with proper partitioning strategy

-- ============================================================================
-- COST AGGREGATES
-- ============================================================================

-- Pre-aggregated cost data for dashboard queries
CREATE TABLE formal_reasoning_cost_aggregates (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    library formal_reasoning_library NOT NULL,
    
    invocation_count INTEGER NOT NULL DEFAULT 0,
    successful_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    total_cost_usd REAL NOT NULL DEFAULT 0,
    
    -- Latency stats
    avg_latency_ms REAL DEFAULT 0,
    min_latency_ms INTEGER DEFAULT 0,
    max_latency_ms INTEGER DEFAULT 0,
    p95_latency_ms INTEGER DEFAULT 0,
    p99_latency_ms INTEGER DEFAULT 0,
    
    -- Memory stats
    avg_memory_mb REAL DEFAULT 0,
    max_memory_mb REAL DEFAULT 0,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, date, library)
);

-- Index for date range queries
CREATE INDEX idx_formal_reasoning_cost_agg_date ON formal_reasoning_cost_aggregates(date DESC);

-- ============================================================================
-- KNOWLEDGE GRAPH STORAGE (RDFLib Integration)
-- ============================================================================

-- RDF triples storage for tenant knowledge graphs
CREATE TABLE formal_reasoning_triples (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    graph_id TEXT NOT NULL DEFAULT 'default',
    
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    object_type TEXT NOT NULL DEFAULT 'uri' CHECK (object_type IN ('uri', 'literal', 'bnode')),
    datatype TEXT,
    language TEXT,
    
    -- Source tracking
    source TEXT,  -- e.g., 'llm', 'user', 'inference'
    confidence REAL DEFAULT 1.0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for SPARQL-like queries
CREATE INDEX idx_formal_reasoning_triples_tenant ON formal_reasoning_triples(tenant_id);
CREATE INDEX idx_formal_reasoning_triples_subject ON formal_reasoning_triples(tenant_id, subject);
CREATE INDEX idx_formal_reasoning_triples_predicate ON formal_reasoning_triples(tenant_id, predicate);
CREATE INDEX idx_formal_reasoning_triples_object ON formal_reasoning_triples(tenant_id, object) WHERE object_type = 'uri';
CREATE INDEX idx_formal_reasoning_triples_spo ON formal_reasoning_triples(tenant_id, subject, predicate, object);
CREATE INDEX idx_formal_reasoning_triples_graph ON formal_reasoning_triples(tenant_id, graph_id);

-- ============================================================================
-- ARGUMENTATION FRAMEWORKS (PyArg Integration)
-- ============================================================================

-- Store argumentation frameworks
CREATE TABLE formal_reasoning_af (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Framework data
    arguments JSONB NOT NULL DEFAULT '[]'::jsonb,
    attacks JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Computed extensions (cached)
    grounded_extension JSONB,
    preferred_extensions JSONB,
    stable_extensions JSONB,
    
    -- Metadata
    source TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formal_reasoning_af_tenant ON formal_reasoning_af(tenant_id);

-- ============================================================================
-- TEMPORAL RULES (PyReason Integration)
-- ============================================================================

-- Store PyReason rules for temporal reasoning
CREATE TABLE formal_reasoning_rules (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    
    -- Rule definition
    head TEXT NOT NULL,
    body TEXT NOT NULL,
    annotation_lower REAL DEFAULT 0,
    annotation_upper REAL DEFAULT 1,
    immediate BOOLEAN DEFAULT false,
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formal_reasoning_rules_tenant ON formal_reasoning_rules(tenant_id);
CREATE INDEX idx_formal_reasoning_rules_enabled ON formal_reasoning_rules(tenant_id, enabled) WHERE enabled = true;

-- ============================================================================
-- SHACL SHAPES (pySHACL Integration)
-- ============================================================================

-- Store SHACL shapes for validation
CREATE TABLE formal_reasoning_shapes (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Shape definition (Turtle format or JSONB)
    shape_turtle TEXT,
    shape_json JSONB,
    
    -- Target
    target_class TEXT,
    target_node TEXT,
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,
    severity TEXT DEFAULT 'Violation' CHECK (severity IN ('Violation', 'Warning', 'Info')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formal_reasoning_shapes_tenant ON formal_reasoning_shapes(tenant_id);

-- ============================================================================
-- ONTOLOGIES (OWL-RL Integration)
-- ============================================================================

-- Store ontologies for inference
CREATE TABLE formal_reasoning_ontologies (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Ontology data (Turtle format)
    ontology_turtle TEXT NOT NULL,
    
    -- Inferred triples count
    original_triple_count INTEGER DEFAULT 0,
    inferred_triple_count INTEGER DEFAULT 0,
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_inference_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formal_reasoning_ontologies_tenant ON formal_reasoning_ontologies(tenant_id);

-- ============================================================================
-- LTN MODELS (Logic Tensor Networks Integration)
-- ============================================================================

-- Store LTN model configurations
CREATE TABLE formal_reasoning_ltn_models (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Model definition
    predicates JSONB NOT NULL DEFAULT '[]'::jsonb,
    functions JSONB NOT NULL DEFAULT '[]'::jsonb,
    constants JSONB NOT NULL DEFAULT '{}'::jsonb,
    axioms JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Training config
    fuzzy_semantics TEXT DEFAULT 'product' CHECK (fuzzy_semantics IN ('product', 'lukasiewicz', 'godel')),
    learning_rate REAL DEFAULT 0.001,
    epochs INTEGER DEFAULT 100,
    
    -- Model weights (serialized)
    weights_path TEXT,
    last_training_loss REAL,
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,
    trained BOOLEAN NOT NULL DEFAULT false,
    last_trained_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formal_reasoning_ltn_models_tenant ON formal_reasoning_ltn_models(tenant_id);

-- ============================================================================
-- DEEPPROBLOG PROGRAMS
-- ============================================================================

-- Store DeepProbLog programs
CREATE TABLE formal_reasoning_problog_programs (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Program definition
    facts JSONB NOT NULL DEFAULT '[]'::jsonb,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    neural_predicates JSONB NOT NULL DEFAULT '[]'::jsonb,
    queries JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Inference config
    inference_method TEXT DEFAULT 'exact' CHECK (inference_method IN ('exact', 'sampling', 'geometric_mean')),
    k_samples INTEGER DEFAULT 100,
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formal_reasoning_problog_tenant ON formal_reasoning_problog_programs(tenant_id);

-- ============================================================================
-- BELIEF STORE
-- ============================================================================

-- Store verified beliefs from consciousness reasoning
CREATE TABLE formal_reasoning_beliefs (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Belief content
    claim TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Verification
    verified BOOLEAN NOT NULL DEFAULT false,
    verifier_library formal_reasoning_library,
    verification_result JSONB,
    
    -- Argumentation support
    supporting_arguments JSONB DEFAULT '[]'::jsonb,
    attacking_arguments JSONB DEFAULT '[]'::jsonb,
    
    -- Source
    source TEXT,  -- 'llm', 'user', 'inference'
    source_context JSONB,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revised', 'retracted')),
    revised_by TEXT REFERENCES formal_reasoning_beliefs(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formal_reasoning_beliefs_tenant ON formal_reasoning_beliefs(tenant_id);
CREATE INDEX idx_formal_reasoning_beliefs_verified ON formal_reasoning_beliefs(tenant_id, verified);
CREATE INDEX idx_formal_reasoning_beliefs_status ON formal_reasoning_beliefs(tenant_id, status);

-- ============================================================================
-- GLOBAL WORKSPACE BROADCASTS
-- ============================================================================

-- Log GWT workspace broadcasts for consciousness integration
CREATE TABLE formal_reasoning_gwt_broadcasts (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    source_module TEXT NOT NULL,
    content JSONB NOT NULL,
    salience REAL NOT NULL CHECK (salience >= 0 AND salience <= 1),
    
    recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    acknowledged_by JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formal_reasoning_gwt_tenant ON formal_reasoning_gwt_broadcasts(tenant_id);
CREATE INDEX idx_formal_reasoning_gwt_created ON formal_reasoning_gwt_broadcasts(created_at DESC);

-- Retention: auto-delete broadcasts older than 24 hours (handled by scheduled task)

-- ============================================================================
-- LIBRARY HEALTH TRACKING
-- ============================================================================

-- Track library health and availability
CREATE TABLE formal_reasoning_health (
    id SERIAL PRIMARY KEY,
    library formal_reasoning_library NOT NULL,
    
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unavailable')),
    last_success_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    
    -- 24h stats
    success_count_24h INTEGER DEFAULT 0,
    error_count_24h INTEGER DEFAULT 0,
    avg_latency_24h REAL DEFAULT 0,
    
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formal_reasoning_health_library ON formal_reasoning_health(library);
CREATE INDEX idx_formal_reasoning_health_checked ON formal_reasoning_health(checked_at DESC);

-- Keep only latest health record per library
CREATE UNIQUE INDEX idx_formal_reasoning_health_latest ON formal_reasoning_health(library) 
    WHERE checked_at = (SELECT MAX(checked_at) FROM formal_reasoning_health fh2 WHERE fh2.library = formal_reasoning_health.library);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Dashboard view for tenant formal reasoning stats
CREATE OR REPLACE VIEW formal_reasoning_dashboard AS
SELECT 
    c.tenant_id,
    c.enabled,
    c.enabled_libraries,
    
    -- Today's stats
    COALESCE(today.invocations, 0) as today_invocations,
    COALESCE(today.cost_usd, 0) as today_cost_usd,
    COALESCE(today.success_rate, 0) as today_success_rate,
    
    -- This month's stats
    COALESCE(month.invocations, 0) as month_invocations,
    COALESCE(month.cost_usd, 0) as month_cost_usd,
    
    -- Budget usage
    CASE 
        WHEN (c.budget_limits->>'dailyCostUsd')::real > 0 
        THEN (COALESCE(today.cost_usd, 0) / (c.budget_limits->>'dailyCostUsd')::real) * 100
        ELSE 0 
    END as daily_budget_percent,
    
    c.updated_at as config_updated_at

FROM formal_reasoning_config c
LEFT JOIN (
    SELECT 
        tenant_id,
        SUM(invocation_count) as invocations,
        SUM(total_cost_usd) as cost_usd,
        CASE WHEN SUM(invocation_count) > 0 
             THEN SUM(successful_count)::real / SUM(invocation_count) * 100 
             ELSE 0 END as success_rate
    FROM formal_reasoning_cost_aggregates
    WHERE date = CURRENT_DATE
    GROUP BY tenant_id
) today ON c.tenant_id = today.tenant_id
LEFT JOIN (
    SELECT 
        tenant_id,
        SUM(invocation_count) as invocations,
        SUM(total_cost_usd) as cost_usd
    FROM formal_reasoning_cost_aggregates
    WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY tenant_id
) month ON c.tenant_id = month.tenant_id;

-- Library usage breakdown view
CREATE OR REPLACE VIEW formal_reasoning_library_usage AS
SELECT 
    tenant_id,
    library,
    SUM(invocation_count) as total_invocations,
    SUM(total_cost_usd) as total_cost_usd,
    AVG(avg_latency_ms) as avg_latency_ms,
    MAX(max_latency_ms) as max_latency_ms,
    CASE WHEN SUM(invocation_count) > 0 
         THEN SUM(successful_count)::real / SUM(invocation_count) * 100 
         ELSE 0 END as success_rate
FROM formal_reasoning_cost_aggregates
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tenant_id, library;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE formal_reasoning_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_cost_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_triples ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_af ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_ontologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_ltn_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_problog_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_beliefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_reasoning_gwt_broadcasts ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other tables)
CREATE POLICY formal_reasoning_config_tenant_isolation ON formal_reasoning_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_invocations_tenant_isolation ON formal_reasoning_invocations
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_cost_agg_tenant_isolation ON formal_reasoning_cost_aggregates
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_triples_tenant_isolation ON formal_reasoning_triples
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_af_tenant_isolation ON formal_reasoning_af
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_rules_tenant_isolation ON formal_reasoning_rules
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_shapes_tenant_isolation ON formal_reasoning_shapes
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_ontologies_tenant_isolation ON formal_reasoning_ontologies
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_ltn_tenant_isolation ON formal_reasoning_ltn_models
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_problog_tenant_isolation ON formal_reasoning_problog_programs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_beliefs_tenant_isolation ON formal_reasoning_beliefs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY formal_reasoning_gwt_tenant_isolation ON formal_reasoning_gwt_broadcasts
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- TRIGGER: Update timestamps
-- ============================================================================

CREATE TRIGGER formal_reasoning_config_updated_at
    BEFORE UPDATE ON formal_reasoning_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER formal_reasoning_triples_updated_at
    BEFORE UPDATE ON formal_reasoning_triples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER formal_reasoning_af_updated_at
    BEFORE UPDATE ON formal_reasoning_af
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER formal_reasoning_rules_updated_at
    BEFORE UPDATE ON formal_reasoning_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER formal_reasoning_shapes_updated_at
    BEFORE UPDATE ON formal_reasoning_shapes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER formal_reasoning_ontologies_updated_at
    BEFORE UPDATE ON formal_reasoning_ontologies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER formal_reasoning_ltn_updated_at
    BEFORE UPDATE ON formal_reasoning_ltn_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER formal_reasoning_problog_updated_at
    BEFORE UPDATE ON formal_reasoning_problog_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER formal_reasoning_beliefs_updated_at
    BEFORE UPDATE ON formal_reasoning_beliefs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE formal_reasoning_config IS 'Per-tenant configuration for formal reasoning libraries (Z3, PyArg, PyReason, RDFLib, OWL-RL, pySHACL, LTN, DeepProbLog)';
COMMENT ON TABLE formal_reasoning_invocations IS 'Log of all formal reasoning invocations for metrics, debugging, and billing';
COMMENT ON TABLE formal_reasoning_cost_aggregates IS 'Pre-aggregated daily cost and usage statistics by library';
COMMENT ON TABLE formal_reasoning_triples IS 'RDF triple storage for tenant knowledge graphs (RDFLib integration)';
COMMENT ON TABLE formal_reasoning_af IS 'Argumentation frameworks for structured reasoning (PyArg integration)';
COMMENT ON TABLE formal_reasoning_rules IS 'Temporal reasoning rules (PyReason integration)';
COMMENT ON TABLE formal_reasoning_shapes IS 'SHACL shapes for graph validation (pySHACL integration)';
COMMENT ON TABLE formal_reasoning_ontologies IS 'OWL ontologies for inference (OWL-RL integration)';
COMMENT ON TABLE formal_reasoning_ltn_models IS 'Logic Tensor Network model configurations';
COMMENT ON TABLE formal_reasoning_problog_programs IS 'DeepProbLog probabilistic logic programs';
COMMENT ON TABLE formal_reasoning_beliefs IS 'Verified beliefs from consciousness reasoning with argumentation support';
COMMENT ON TABLE formal_reasoning_gwt_broadcasts IS 'Global Workspace Theory broadcast log for consciousness integration';
COMMENT ON TABLE formal_reasoning_health IS 'Library health and availability tracking';
