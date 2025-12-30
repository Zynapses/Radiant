-- Migration 103: Bobble Genesis System
-- 
-- Creates tables for:
-- - Genesis state tracking
-- - Development statistics counters (Fix #1: Zeno's Paradox)
-- - Developmental stages
-- - Circuit breakers
-- - Cost tracking
-- - Neurochemistry state
--
-- See: /docs/bobble/adr/010-genesis-system.md

-- ============================================================================
-- Genesis State
-- ============================================================================

CREATE TABLE IF NOT EXISTS bobble_genesis_state (
    tenant_id TEXT NOT NULL DEFAULT 'global',
    structure_complete BOOLEAN NOT NULL DEFAULT FALSE,
    structure_completed_at TIMESTAMPTZ,
    gradient_complete BOOLEAN NOT NULL DEFAULT FALSE,
    gradient_completed_at TIMESTAMPTZ,
    first_breath_complete BOOLEAN NOT NULL DEFAULT FALSE,
    first_breath_completed_at TIMESTAMPTZ,
    genesis_version TEXT,
    domain_count INTEGER,
    initial_self_facts INTEGER,
    initial_grounded_verifications INTEGER,
    shadow_self_calibrated BOOLEAN DEFAULT FALSE,
    seed_domains_baselined TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id)
);

ALTER TABLE bobble_genesis_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_genesis_state_tenant_isolation ON bobble_genesis_state
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- ============================================================================
-- Development Counters (Fix #1: Zeno's Paradox)
-- Use atomic counters instead of table scans for developmental gates
-- ============================================================================

CREATE TABLE IF NOT EXISTS bobble_development_counters (
    tenant_id TEXT NOT NULL DEFAULT 'global',
    self_facts_count BIGINT NOT NULL DEFAULT 0,
    grounded_verifications_count BIGINT NOT NULL DEFAULT 0,
    domain_explorations_count BIGINT NOT NULL DEFAULT 0,
    successful_verifications_count BIGINT NOT NULL DEFAULT 0,
    belief_updates_count BIGINT NOT NULL DEFAULT 0,
    successful_predictions_count BIGINT NOT NULL DEFAULT 0,
    total_predictions_count BIGINT NOT NULL DEFAULT 0,
    contradiction_resolutions_count BIGINT NOT NULL DEFAULT 0,
    abstract_inferences_count BIGINT NOT NULL DEFAULT 0,
    meta_cognitive_adjustments_count BIGINT NOT NULL DEFAULT 0,
    novel_insights_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id)
);

ALTER TABLE bobble_development_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_development_counters_tenant_isolation ON bobble_development_counters
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- ============================================================================
-- Developmental Stages (Capability-Based, NOT Time-Based!)
-- ============================================================================

CREATE TYPE bobble_developmental_stage AS ENUM (
    'SENSORIMOTOR',
    'PREOPERATIONAL',
    'CONCRETE_OPERATIONAL',
    'FORMAL_OPERATIONAL'
);

CREATE TABLE IF NOT EXISTS bobble_developmental_stage (
    tenant_id TEXT NOT NULL DEFAULT 'global',
    current_stage bobble_developmental_stage NOT NULL DEFAULT 'SENSORIMOTOR',
    stage_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    previous_stage bobble_developmental_stage,
    advancement_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id)
);

ALTER TABLE bobble_developmental_stage ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_developmental_stage_tenant_isolation ON bobble_developmental_stage
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- ============================================================================
-- Circuit Breakers
-- ============================================================================

CREATE TYPE bobble_circuit_state AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

CREATE TABLE IF NOT EXISTS bobble_circuit_breakers (
    tenant_id TEXT NOT NULL DEFAULT 'global',
    name TEXT NOT NULL,
    state bobble_circuit_state NOT NULL DEFAULT 'CLOSED',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    trip_threshold INTEGER NOT NULL DEFAULT 3,
    reset_timeout_seconds INTEGER NOT NULL DEFAULT 300,
    half_open_max_attempts INTEGER NOT NULL DEFAULT 2,
    description TEXT,
    trip_count INTEGER NOT NULL DEFAULT 0,
    last_tripped_at TIMESTAMPTZ,
    last_closed_at TIMESTAMPTZ,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    half_open_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, name)
);

ALTER TABLE bobble_circuit_breakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_circuit_breakers_tenant_isolation ON bobble_circuit_breakers
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- Insert default circuit breakers
INSERT INTO bobble_circuit_breakers (tenant_id, name, trip_threshold, reset_timeout_seconds, half_open_max_attempts, description)
VALUES 
    ('global', 'master_sanity', 3, 3600, 1, 'Master safety breaker - requires admin approval to reset'),
    ('global', 'cost_budget', 1, 86400, 1, 'Trips when budget threshold exceeded'),
    ('global', 'high_anxiety', 5, 600, 3, 'Trips when anxiety sustained above 80%'),
    ('global', 'model_failures', 5, 300, 2, 'Trips on consecutive model invocation failures'),
    ('global', 'contradiction_loop', 3, 900, 2, 'Trips on repeated contradictions detected')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Circuit breaker event log
CREATE TABLE IF NOT EXISTS bobble_circuit_breaker_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'global',
    breaker_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_circuit_breaker_events_lookup 
    ON bobble_circuit_breaker_events(tenant_id, breaker_name, created_at DESC);

ALTER TABLE bobble_circuit_breaker_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_circuit_breaker_events_tenant_isolation ON bobble_circuit_breaker_events
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- ============================================================================
-- Neurochemistry State (for circuit breaker risk scoring)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bobble_neurochemistry (
    tenant_id TEXT NOT NULL DEFAULT 'global',
    anxiety DECIMAL(5,4) NOT NULL DEFAULT 0.0,
    fatigue DECIMAL(5,4) NOT NULL DEFAULT 0.0,
    temperature DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    curiosity DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    frustration DECIMAL(5,4) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id)
);

ALTER TABLE bobble_neurochemistry ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_neurochemistry_tenant_isolation ON bobble_neurochemistry
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- ============================================================================
-- Cost Tracking
-- ============================================================================

-- Per-tick cost tracking for accurate estimates
CREATE TABLE IF NOT EXISTS bobble_tick_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'global',
    tick_number BIGINT NOT NULL,
    cost_usd DECIMAL(10,6) NOT NULL,
    breakdown JSONB NOT NULL DEFAULT '{}',
    input_tokens INTEGER,
    output_tokens INTEGER,
    model_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tick_costs_recent 
    ON bobble_tick_costs(tenant_id, created_at DESC);

ALTER TABLE bobble_tick_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_tick_costs_tenant_isolation ON bobble_tick_costs
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- Pricing cache (refreshed from AWS Pricing API)
CREATE TABLE IF NOT EXISTS bobble_pricing_cache (
    id TEXT PRIMARY KEY DEFAULT 'current',
    pricing_data JSONB NOT NULL,
    last_refreshed TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PyMDP State (for PostgreSQL-based persistence alternative to DynamoDB)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bobble_pymdp_state (
    tenant_id TEXT NOT NULL DEFAULT 'global',
    qs DECIMAL(10,8)[] NOT NULL DEFAULT '{0.95, 0.01, 0.02, 0.02}',
    dominant_state TEXT,
    recommended_action TEXT,
    last_observation TEXT,
    tick BIGINT NOT NULL DEFAULT 0,
    action_history JSONB DEFAULT '[]',
    observation_history JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id)
);

ALTER TABLE bobble_pymdp_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_pymdp_state_tenant_isolation ON bobble_pymdp_state
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- PyMDP matrices storage
CREATE TABLE IF NOT EXISTS bobble_pymdp_matrices (
    tenant_id TEXT NOT NULL DEFAULT 'global',
    a_matrix JSONB NOT NULL,
    b_matrix JSONB NOT NULL,
    c_matrix JSONB NOT NULL,
    d_matrix JSONB NOT NULL,
    notes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id)
);

ALTER TABLE bobble_pymdp_matrices ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_pymdp_matrices_tenant_isolation ON bobble_pymdp_matrices
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- ============================================================================
-- Consciousness Loop Settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS bobble_consciousness_settings (
    tenant_id TEXT NOT NULL DEFAULT 'global',
    system_tick_interval_seconds INTEGER NOT NULL DEFAULT 2,
    cognitive_tick_interval_seconds INTEGER NOT NULL DEFAULT 300,
    max_cognitive_ticks_per_day INTEGER NOT NULL DEFAULT 288,
    emergency_cognitive_interval_seconds INTEGER NOT NULL DEFAULT 3600,
    state_save_interval_seconds INTEGER NOT NULL DEFAULT 600,
    settings_refresh_interval_seconds INTEGER NOT NULL DEFAULT 300,
    is_emergency_mode BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id)
);

ALTER TABLE bobble_consciousness_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_consciousness_settings_tenant_isolation ON bobble_consciousness_settings
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- Insert default settings
INSERT INTO bobble_consciousness_settings (tenant_id)
VALUES ('global')
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- Initialize default data
-- ============================================================================

-- Initialize genesis state
INSERT INTO bobble_genesis_state (tenant_id)
VALUES ('global')
ON CONFLICT (tenant_id) DO NOTHING;

-- Initialize development counters
INSERT INTO bobble_development_counters (tenant_id)
VALUES ('global')
ON CONFLICT (tenant_id) DO NOTHING;

-- Initialize developmental stage
INSERT INTO bobble_developmental_stage (tenant_id)
VALUES ('global')
ON CONFLICT (tenant_id) DO NOTHING;

-- Initialize neurochemistry
INSERT INTO bobble_neurochemistry (tenant_id, curiosity)
VALUES ('global', 0.7)
ON CONFLICT (tenant_id) DO NOTHING;

-- Initialize pymdp state with Genesis-style confused prior
INSERT INTO bobble_pymdp_state (tenant_id, qs, dominant_state, recommended_action)
VALUES ('global', '{0.95, 0.01, 0.02, 0.02}', 'CONFUSED', 'EXPLORE')
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- Loop State (for consciousness loop tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bobble_loop_state (
    tenant_id TEXT NOT NULL DEFAULT 'global',
    current_tick BIGINT NOT NULL DEFAULT 0,
    last_system_tick TIMESTAMPTZ,
    last_cognitive_tick TIMESTAMPTZ,
    cognitive_ticks_today INTEGER NOT NULL DEFAULT 0,
    loop_state TEXT NOT NULL DEFAULT 'STOPPED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id)
);

ALTER TABLE bobble_loop_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_loop_state_tenant_isolation ON bobble_loop_state
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id = 'global');

-- Initialize loop state
INSERT INTO bobble_loop_state (tenant_id)
VALUES ('global')
ON CONFLICT (tenant_id) DO NOTHING;
