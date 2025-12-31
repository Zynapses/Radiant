-- RADIANT v4.18.56 - Migration 129: Comprehensive Metrics & Persistent Learning Infrastructure
-- Implements: metrics collection, user memories with versioning, tenant aggregate learning,
-- cross-tenant aggregate learning with user→tenant→aggregate influence hierarchy

-- ============================================================================
-- SECTION 1: ENHANCED METRICS COLLECTION
-- ============================================================================

-- 1.1 Detailed Billing Metrics
CREATE TABLE billing_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Time tracking
    period_date DATE NOT NULL,
    period_hour SMALLINT CHECK (period_hour >= 0 AND period_hour <= 23),
    
    -- Cost breakdown
    model_id VARCHAR(100),
    provider_id VARCHAR(50),
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    
    -- Costs in cents (to avoid floating point issues)
    input_cost_cents BIGINT DEFAULT 0,
    output_cost_cents BIGINT DEFAULT 0,
    total_cost_cents BIGINT DEFAULT 0,
    
    -- Storage costs
    storage_bytes_used BIGINT DEFAULT 0,
    storage_cost_cents BIGINT DEFAULT 0,
    
    -- Compute costs (self-hosted)
    compute_seconds BIGINT DEFAULT 0,
    compute_cost_cents BIGINT DEFAULT 0,
    
    -- API call counts
    api_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    
    -- Metadata
    breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id, period_date, period_hour, model_id)
);

-- 1.2 Performance Metrics
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Time tracking
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_minute TIMESTAMPTZ NOT NULL,
    
    -- Request info
    endpoint VARCHAR(200),
    method VARCHAR(10),
    model_id VARCHAR(100),
    provider_id VARCHAR(50),
    
    -- Latency metrics (in milliseconds)
    total_latency_ms INTEGER,
    time_to_first_token_ms INTEGER,
    inference_time_ms INTEGER,
    queue_wait_ms INTEGER,
    network_latency_ms INTEGER,
    
    -- Throughput
    tokens_per_second DECIMAL(10, 2),
    
    -- Resource usage
    memory_mb INTEGER,
    cpu_percent DECIMAL(5, 2),
    gpu_utilization DECIMAL(5, 2),
    
    -- Request details
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    
    -- Status
    status_code INTEGER,
    success BOOLEAN DEFAULT true,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- 1.3 Failure Tracking
CREATE TABLE failure_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Time
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Failure classification
    failure_type VARCHAR(50) NOT NULL CHECK (failure_type IN (
        'api_error', 'model_error', 'timeout', 'rate_limit', 'auth_error',
        'validation_error', 'provider_error', 'internal_error', 'quota_exceeded',
        'content_filter', 'context_length', 'network_error', 'unknown'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Context
    endpoint VARCHAR(200),
    model_id VARCHAR(100),
    provider_id VARCHAR(50),
    orchestration_id UUID,
    conversation_id UUID,
    
    -- Error details
    error_code VARCHAR(100),
    error_message TEXT,
    error_stack TEXT,
    
    -- Request context
    request_id VARCHAR(100),
    request_payload_hash VARCHAR(64),
    
    -- Resolution
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    auto_recovered BOOLEAN DEFAULT false,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- 1.4 Prompt Violation Tracking
CREATE TABLE prompt_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Time
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Violation details
    violation_type VARCHAR(50) NOT NULL CHECK (violation_type IN (
        'content_policy', 'jailbreak_attempt', 'injection_attempt', 'pii_exposure',
        'rate_abuse', 'token_abuse', 'harassment', 'hate_speech', 'violence',
        'sexual_content', 'self_harm', 'illegal_activity', 'copyright',
        'impersonation', 'misinformation', 'other'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Context
    conversation_id UUID,
    message_id UUID,
    model_id VARCHAR(100),
    
    -- Content (hashed for privacy, original stored encrypted)
    prompt_hash VARCHAR(64),
    prompt_snippet TEXT, -- First 200 chars, sanitized
    
    -- Detection
    detection_method VARCHAR(50) CHECK (detection_method IN (
        'content_filter', 'pattern_match', 'model_refusal', 'manual_review',
        'user_report', 'automated_scan'
    )),
    confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Action taken
    action_taken VARCHAR(50) CHECK (action_taken IN (
        'blocked', 'warned', 'filtered', 'logged', 'escalated', 'ignored'
    )),
    
    -- Review
    reviewed BOOLEAN DEFAULT false,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_outcome VARCHAR(50),
    false_positive BOOLEAN,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- 1.5 System Logs
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for system-wide logs
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Time
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Log classification
    log_level VARCHAR(20) NOT NULL CHECK (log_level IN (
        'trace', 'debug', 'info', 'warn', 'error', 'fatal'
    )),
    log_source VARCHAR(100) NOT NULL, -- Service/Lambda name
    log_category VARCHAR(50), -- e.g., 'auth', 'billing', 'ai', 'storage'
    
    -- Content
    message TEXT NOT NULL,
    
    -- Context
    request_id VARCHAR(100),
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    
    -- Structured data
    data JSONB DEFAULT '{}',
    
    -- Performance
    duration_ms INTEGER,
    
    -- Environment
    environment VARCHAR(20) DEFAULT 'production',
    version VARCHAR(20)
);

-- 1.6 Metrics Aggregation Views
CREATE MATERIALIZED VIEW mv_tenant_daily_metrics AS
SELECT 
    bm.tenant_id,
    bm.period_date,
    SUM(bm.total_tokens) as total_tokens,
    SUM(bm.total_cost_cents) as total_cost_cents,
    SUM(bm.api_calls) as total_api_calls,
    SUM(bm.successful_calls) as successful_calls,
    SUM(bm.failed_calls) as failed_calls,
    CASE WHEN SUM(bm.api_calls) > 0 
        THEN (SUM(bm.successful_calls)::DECIMAL / SUM(bm.api_calls) * 100)
        ELSE 0 
    END as success_rate,
    COUNT(DISTINCT bm.user_id) as active_users,
    COUNT(DISTINCT bm.model_id) as models_used
FROM billing_metrics bm
GROUP BY bm.tenant_id, bm.period_date;

CREATE UNIQUE INDEX idx_mv_tenant_daily ON mv_tenant_daily_metrics(tenant_id, period_date);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_tenant_daily_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_daily_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 2: VERSIONED USER MEMORIES (Including Think Tank Rules)
-- ============================================================================

-- 2.1 User Memory Versions (extends existing memories table)
CREATE TABLE user_memory_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    
    -- Version tracking
    version INTEGER NOT NULL,
    version_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Content at this version
    content TEXT NOT NULL,
    embedding vector(1536),
    
    -- Change tracking
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'restore')),
    change_reason TEXT,
    changed_by VARCHAR(50), -- 'user', 'system', 'learning', 'admin'
    
    -- Previous version reference
    previous_version_id UUID REFERENCES user_memory_versions(id),
    
    -- Metadata at this version
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(memory_id, version)
);

-- 2.2 User Think Tank Rules (versioned)
CREATE TABLE user_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Rule identification
    rule_name VARCHAR(200) NOT NULL,
    rule_category VARCHAR(50) CHECK (rule_category IN (
        'behavior', 'format', 'tone', 'content', 'restriction', 'preference',
        'domain', 'persona', 'workflow', 'other'
    )),
    
    -- Current version
    current_version INTEGER NOT NULL DEFAULT 1,
    
    -- Rule content
    rule_content TEXT NOT NULL,
    rule_priority INTEGER DEFAULT 50 CHECK (rule_priority >= 0 AND rule_priority <= 100),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Scope
    applies_to_models TEXT[], -- NULL = all models
    applies_to_tasks TEXT[], -- NULL = all tasks
    
    -- Effectiveness tracking
    times_applied INTEGER DEFAULT 0,
    times_effective INTEGER DEFAULT 0, -- Based on user satisfaction
    effectiveness_score DECIMAL(3, 2) DEFAULT 0.50,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_applied_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, user_id, rule_name)
);

-- 2.3 User Rules Version History
CREATE TABLE user_rules_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES user_rules(id) ON DELETE CASCADE,
    
    -- Version info
    version INTEGER NOT NULL,
    version_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Content at this version
    rule_content TEXT NOT NULL,
    rule_priority INTEGER,
    is_active BOOLEAN,
    
    -- Change tracking
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'restore')),
    change_reason TEXT,
    changed_by VARCHAR(50),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(rule_id, version)
);

-- 2.4 User Learned Preferences (AGI Brain learning about user)
CREATE TABLE user_learned_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Preference identification
    preference_key VARCHAR(100) NOT NULL,
    preference_category VARCHAR(50) CHECK (preference_category IN (
        'communication_style', 'response_format', 'detail_level', 'expertise_level',
        'topic_interest', 'model_preference', 'time_preference', 'language',
        'accessibility', 'privacy', 'other'
    )),
    
    -- Current value
    current_version INTEGER NOT NULL DEFAULT 1,
    preference_value JSONB NOT NULL,
    
    -- Learning metadata
    confidence DECIMAL(3, 2) DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
    evidence_count INTEGER DEFAULT 1,
    last_evidence_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Source tracking
    learned_from VARCHAR(50) CHECK (learned_from IN (
        'explicit_setting', 'implicit_behavior', 'feedback', 'conversation',
        'pattern_detection', 'admin_set', 'default'
    )),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id, preference_key)
);

-- 2.5 User Preference Versions
CREATE TABLE user_preference_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    preference_id UUID NOT NULL REFERENCES user_learned_preferences(id) ON DELETE CASCADE,
    
    version INTEGER NOT NULL,
    version_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    preference_value JSONB NOT NULL,
    confidence DECIMAL(3, 2),
    
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'strengthen', 'weaken', 'reset')),
    change_reason TEXT,
    
    UNIQUE(preference_id, version)
);

-- ============================================================================
-- SECTION 3: TENANT-LEVEL AGGREGATE LEARNING
-- ============================================================================

-- 3.1 Tenant Aggregate Learning State
CREATE TABLE tenant_aggregate_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Learning dimensions
    learning_dimension VARCHAR(100) NOT NULL, -- e.g., 'model_performance', 'task_patterns', 'error_recovery'
    
    -- Current state
    current_version INTEGER NOT NULL DEFAULT 1,
    state_data JSONB NOT NULL DEFAULT '{}',
    
    -- Confidence and evidence
    confidence DECIMAL(3, 2) DEFAULT 0.50,
    sample_count INTEGER DEFAULT 0,
    
    -- Contributing users (anonymized count)
    contributing_users INTEGER DEFAULT 0,
    
    -- Last updated
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_learning_event_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, learning_dimension)
);

-- 3.2 Tenant Learning Events
CREATE TABLE tenant_learning_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aggregate_learning_id UUID REFERENCES tenant_aggregate_learning(id) ON DELETE SET NULL,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'model_success', 'model_failure', 'user_correction', 'pattern_detected',
        'preference_learned', 'error_recovered', 'optimization_applied',
        'feedback_incorporated', 'rule_effectiveness'
    )),
    
    -- Source (anonymized)
    source_user_hash VARCHAR(64), -- Hashed user ID for privacy
    
    -- Event data
    event_data JSONB NOT NULL DEFAULT '{}',
    
    -- Impact
    impact_score DECIMAL(3, 2) DEFAULT 0.50,
    was_incorporated BOOLEAN DEFAULT false,
    
    -- Timestamp
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 Tenant Model Performance Aggregate
CREATE TABLE tenant_model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    
    -- Aggregate scores
    quality_score DECIMAL(5, 4) DEFAULT 0.5000,
    speed_score DECIMAL(5, 4) DEFAULT 0.5000,
    cost_efficiency_score DECIMAL(5, 4) DEFAULT 0.5000,
    reliability_score DECIMAL(5, 4) DEFAULT 0.5000,
    
    -- Counts
    total_uses INTEGER DEFAULT 0,
    successful_uses INTEGER DEFAULT 0,
    positive_feedback INTEGER DEFAULT 0,
    negative_feedback INTEGER DEFAULT 0,
    
    -- Confidence
    confidence DECIMAL(3, 2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, model_id, task_type)
);

-- ============================================================================
-- SECTION 4: CROSS-TENANT AGGREGATE LEARNING (Global Intelligence)
-- ============================================================================

-- 4.1 Global Aggregate Learning
CREATE TABLE global_aggregate_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Learning dimension
    learning_dimension VARCHAR(100) NOT NULL UNIQUE,
    
    -- Current state
    current_version INTEGER NOT NULL DEFAULT 1,
    state_data JSONB NOT NULL DEFAULT '{}',
    
    -- Confidence and evidence
    confidence DECIMAL(3, 2) DEFAULT 0.50,
    sample_count BIGINT DEFAULT 0,
    
    -- Contributing tenants (count only, anonymized)
    contributing_tenants INTEGER DEFAULT 0,
    contributing_users BIGINT DEFAULT 0,
    
    -- Privacy controls
    min_tenant_threshold INTEGER DEFAULT 5, -- Minimum tenants before global aggregation
    anonymization_level VARCHAR(20) DEFAULT 'high' CHECK (anonymization_level IN ('low', 'medium', 'high')),
    
    -- Timestamps
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_aggregation_at TIMESTAMPTZ
);

-- 4.2 Global Model Performance (anonymized cross-tenant)
CREATE TABLE global_model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    
    -- Aggregate scores (weighted by confidence)
    quality_score DECIMAL(5, 4) DEFAULT 0.5000,
    speed_score DECIMAL(5, 4) DEFAULT 0.5000,
    cost_efficiency_score DECIMAL(5, 4) DEFAULT 0.5000,
    reliability_score DECIMAL(5, 4) DEFAULT 0.5000,
    
    -- Aggregate counts
    total_tenants_using INTEGER DEFAULT 0,
    total_uses BIGINT DEFAULT 0,
    positive_feedback_rate DECIMAL(5, 4) DEFAULT 0.5000,
    
    -- Confidence
    confidence DECIMAL(3, 2) DEFAULT 0.00,
    
    -- Last aggregation
    last_aggregated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(model_id, task_type)
);

-- 4.3 Global Pattern Library (anonymized successful patterns)
CREATE TABLE global_pattern_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Pattern identification
    pattern_hash VARCHAR(64) NOT NULL UNIQUE, -- Hash of pattern for deduplication
    pattern_category VARCHAR(50) NOT NULL,
    pattern_name VARCHAR(200),
    
    -- Pattern content (anonymized, no PII)
    pattern_template TEXT NOT NULL,
    pattern_description TEXT,
    
    -- Usage stats
    tenant_adoption_count INTEGER DEFAULT 1,
    successful_applications BIGINT DEFAULT 0,
    total_applications BIGINT DEFAULT 0,
    success_rate DECIMAL(5, 4),
    
    -- Applicability
    applicable_tasks TEXT[],
    applicable_domains TEXT[],
    
    -- Quality
    confidence DECIMAL(3, 2) DEFAULT 0.50,
    peer_validated BOOLEAN DEFAULT false,
    
    -- Timestamps
    first_discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_applied_at TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 5: LEARNING INFLUENCE HIERARCHY (User → Tenant → Global)
-- ============================================================================

-- 5.1 Learning Influence Configuration
CREATE TABLE learning_influence_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Influence weights (must sum to 1.0)
    user_weight DECIMAL(3, 2) NOT NULL DEFAULT 0.60,
    tenant_weight DECIMAL(3, 2) NOT NULL DEFAULT 0.30,
    global_weight DECIMAL(3, 2) NOT NULL DEFAULT 0.10,
    
    -- Per-dimension overrides
    dimension_overrides JSONB DEFAULT '{}',
    
    -- Feature flags
    enable_user_learning BOOLEAN DEFAULT true,
    enable_tenant_aggregation BOOLEAN DEFAULT true,
    enable_global_learning BOOLEAN DEFAULT true,
    
    -- Privacy controls
    contribute_to_global BOOLEAN DEFAULT true,
    anonymization_level VARCHAR(20) DEFAULT 'high',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id),
    
    CHECK (user_weight + tenant_weight + global_weight = 1.00)
);

-- 5.2 Learning Decision Log (tracks influence hierarchy usage)
CREATE TABLE learning_decision_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Decision context
    decision_type VARCHAR(50) NOT NULL, -- e.g., 'model_selection', 'format_choice', 'response_style'
    decision_context JSONB NOT NULL DEFAULT '{}',
    
    -- Influence sources used
    user_influence_used JSONB, -- What user-level learning contributed
    tenant_influence_used JSONB, -- What tenant-level learning contributed
    global_influence_used JSONB, -- What global learning contributed
    
    -- Weights applied
    user_weight_applied DECIMAL(3, 2),
    tenant_weight_applied DECIMAL(3, 2),
    global_weight_applied DECIMAL(3, 2),
    
    -- Final decision
    final_decision JSONB NOT NULL,
    
    -- Outcome (for future learning)
    outcome_recorded BOOLEAN DEFAULT false,
    outcome_positive BOOLEAN,
    outcome_recorded_at TIMESTAMPTZ,
    
    -- Timestamp
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 6: PERSISTENCE & REBOOT RECOVERY
-- ============================================================================

-- 6.1 Learning Snapshot (for fast recovery after reboot)
CREATE TABLE learning_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scope
    scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('user', 'tenant', 'global')),
    scope_id UUID, -- user_id for user, tenant_id for tenant, NULL for global
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for global
    
    -- Snapshot content
    snapshot_version INTEGER NOT NULL,
    snapshot_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Compressed learning state
    learning_state JSONB NOT NULL, -- Complete learning state at this point
    
    -- Checksums for integrity
    state_checksum VARCHAR(64) NOT NULL,
    
    -- Metadata
    model_versions JSONB DEFAULT '{}', -- Model versions at snapshot time
    total_samples BIGINT,
    
    -- Status
    is_current BOOLEAN DEFAULT true,
    
    -- Recovery info
    can_recover_from BOOLEAN DEFAULT true,
    recovery_tested_at TIMESTAMPTZ,
    
    UNIQUE(scope_type, scope_id, snapshot_version)
);

-- 6.2 Learning Recovery Log
CREATE TABLE learning_recovery_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Recovery event
    recovery_type VARCHAR(50) NOT NULL CHECK (recovery_type IN (
        'cold_start', 'warm_restart', 'snapshot_restore', 'incremental_rebuild',
        'migration', 'rollback', 'manual_restore'
    )),
    
    -- Scope
    scope_type VARCHAR(20) NOT NULL,
    scope_id UUID,
    tenant_id UUID,
    
    -- Snapshot used
    snapshot_id UUID REFERENCES learning_snapshots(id),
    
    -- Recovery details
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    success BOOLEAN,
    
    -- Stats
    records_recovered BIGINT,
    time_to_recover_ms INTEGER,
    
    -- Errors
    error_message TEXT,
    error_details JSONB
);

-- ============================================================================
-- SECTION 7: INDEXES
-- ============================================================================

-- Billing metrics indexes
CREATE INDEX idx_billing_metrics_tenant_date ON billing_metrics(tenant_id, period_date DESC);
CREATE INDEX idx_billing_metrics_user ON billing_metrics(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_billing_metrics_model ON billing_metrics(model_id);

-- Performance metrics indexes
CREATE INDEX idx_perf_metrics_tenant_time ON performance_metrics(tenant_id, recorded_at DESC);
CREATE INDEX idx_perf_metrics_endpoint ON performance_metrics(endpoint);
CREATE INDEX idx_perf_metrics_model ON performance_metrics(model_id);
CREATE INDEX idx_perf_metrics_latency ON performance_metrics(total_latency_ms) WHERE total_latency_ms > 1000;

-- Failure events indexes
CREATE INDEX idx_failure_events_tenant_time ON failure_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_failure_events_type ON failure_events(failure_type);
CREATE INDEX idx_failure_events_unresolved ON failure_events(tenant_id) WHERE resolved = false;
CREATE INDEX idx_failure_events_severity ON failure_events(severity) WHERE severity IN ('high', 'critical');

-- Prompt violations indexes
CREATE INDEX idx_violations_tenant_time ON prompt_violations(tenant_id, occurred_at DESC);
CREATE INDEX idx_violations_user ON prompt_violations(user_id);
CREATE INDEX idx_violations_type ON prompt_violations(violation_type);
CREATE INDEX idx_violations_unreviewed ON prompt_violations(tenant_id) WHERE reviewed = false;

-- System logs indexes
CREATE INDEX idx_system_logs_time ON system_logs(logged_at DESC);
CREATE INDEX idx_system_logs_tenant ON system_logs(tenant_id, logged_at DESC);
CREATE INDEX idx_system_logs_level ON system_logs(log_level) WHERE log_level IN ('error', 'fatal');
CREATE INDEX idx_system_logs_source ON system_logs(log_source);
CREATE INDEX idx_system_logs_request ON system_logs(request_id);

-- User memory versions indexes
CREATE INDEX idx_memory_versions_memory ON user_memory_versions(memory_id, version DESC);
CREATE INDEX idx_memory_versions_time ON user_memory_versions(version_timestamp DESC);

-- User rules indexes
CREATE INDEX idx_user_rules_tenant_user ON user_rules(tenant_id, user_id);
CREATE INDEX idx_user_rules_active ON user_rules(tenant_id, user_id) WHERE is_active = true;
CREATE INDEX idx_user_rules_category ON user_rules(rule_category);

-- User preferences indexes
CREATE INDEX idx_user_prefs_tenant_user ON user_learned_preferences(tenant_id, user_id);
CREATE INDEX idx_user_prefs_key ON user_learned_preferences(preference_key);
CREATE INDEX idx_user_prefs_confidence ON user_learned_preferences(confidence DESC);

-- Tenant learning indexes
CREATE INDEX idx_tenant_learning_dimension ON tenant_aggregate_learning(learning_dimension);
CREATE INDEX idx_tenant_learning_events_time ON tenant_learning_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_tenant_model_perf ON tenant_model_performance(tenant_id, model_id);

-- Global learning indexes
CREATE INDEX idx_global_model_perf ON global_model_performance(model_id, task_type);
CREATE INDEX idx_global_patterns_category ON global_pattern_library(pattern_category);
CREATE INDEX idx_global_patterns_success ON global_pattern_library(success_rate DESC) WHERE success_rate IS NOT NULL;

-- Learning decision log indexes
CREATE INDEX idx_learning_decisions_tenant_user ON learning_decision_log(tenant_id, user_id, decided_at DESC);
CREATE INDEX idx_learning_decisions_pending ON learning_decision_log(tenant_id) WHERE outcome_recorded = false;

-- Learning snapshots indexes
CREATE INDEX idx_snapshots_scope ON learning_snapshots(scope_type, scope_id);
CREATE INDEX idx_snapshots_current ON learning_snapshots(scope_type, scope_id) WHERE is_current = true;
CREATE INDEX idx_snapshots_time ON learning_snapshots(snapshot_timestamp DESC);

-- ============================================================================
-- SECTION 8: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE billing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rules_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learned_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preference_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_aggregate_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_influence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_recovery_log ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY billing_metrics_isolation ON billing_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY performance_metrics_isolation ON performance_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY failure_events_isolation ON failure_events
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY violations_isolation ON prompt_violations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY system_logs_isolation ON system_logs
    FOR ALL USING (
        tenant_id IS NULL OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY user_rules_isolation ON user_rules
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY user_rules_versions_isolation ON user_rules_versions
    FOR ALL USING (
        rule_id IN (SELECT id FROM user_rules WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

CREATE POLICY user_prefs_isolation ON user_learned_preferences
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_learning_isolation ON tenant_aggregate_learning
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_events_isolation ON tenant_learning_events
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_model_perf_isolation ON tenant_model_performance
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY learning_config_isolation ON learning_influence_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY learning_decisions_isolation ON learning_decision_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY snapshots_isolation ON learning_snapshots
    FOR ALL USING (
        scope_type = 'global' OR
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Global tables readable by all (anonymized data)
CREATE POLICY global_learning_read ON global_aggregate_learning FOR SELECT USING (true);
CREATE POLICY global_model_perf_read ON global_model_performance FOR SELECT USING (true);
CREATE POLICY global_patterns_read ON global_pattern_library FOR SELECT USING (true);

-- Super admin access
CREATE POLICY billing_metrics_super ON billing_metrics
    FOR SELECT USING (current_setting('app.is_super_admin', true)::boolean = true);

CREATE POLICY performance_metrics_super ON performance_metrics
    FOR SELECT USING (current_setting('app.is_super_admin', true)::boolean = true);

CREATE POLICY failure_events_super ON failure_events
    FOR SELECT USING (current_setting('app.is_super_admin', true)::boolean = true);

CREATE POLICY violations_super ON prompt_violations
    FOR SELECT USING (current_setting('app.is_super_admin', true)::boolean = true);

-- ============================================================================
-- SECTION 9: FUNCTIONS
-- ============================================================================

-- 9.1 Function to get combined learning influence
CREATE OR REPLACE FUNCTION get_learning_influence(
    p_tenant_id UUID,
    p_user_id UUID,
    p_decision_type VARCHAR(50),
    p_context JSONB DEFAULT '{}'
)
RETURNS TABLE (
    user_influence JSONB,
    tenant_influence JSONB,
    global_influence JSONB,
    user_weight DECIMAL(3, 2),
    tenant_weight DECIMAL(3, 2),
    global_weight DECIMAL(3, 2),
    combined_recommendation JSONB
) AS $$
DECLARE
    v_config learning_influence_config%ROWTYPE;
    v_user_data JSONB := '{}';
    v_tenant_data JSONB := '{}';
    v_global_data JSONB := '{}';
BEGIN
    -- Get config or use defaults
    SELECT * INTO v_config 
    FROM learning_influence_config 
    WHERE tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        v_config.user_weight := 0.60;
        v_config.tenant_weight := 0.30;
        v_config.global_weight := 0.10;
        v_config.enable_user_learning := true;
        v_config.enable_tenant_aggregation := true;
        v_config.enable_global_learning := true;
    END IF;
    
    -- Get user-level learning
    IF v_config.enable_user_learning THEN
        SELECT jsonb_object_agg(preference_key, jsonb_build_object(
            'value', preference_value,
            'confidence', confidence,
            'evidence_count', evidence_count
        )) INTO v_user_data
        FROM user_learned_preferences
        WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
    END IF;
    
    -- Get tenant-level learning
    IF v_config.enable_tenant_aggregation THEN
        SELECT jsonb_object_agg(learning_dimension, jsonb_build_object(
            'state', state_data,
            'confidence', confidence,
            'sample_count', sample_count
        )) INTO v_tenant_data
        FROM tenant_aggregate_learning
        WHERE tenant_id = p_tenant_id;
    END IF;
    
    -- Get global learning
    IF v_config.enable_global_learning THEN
        SELECT jsonb_object_agg(learning_dimension, jsonb_build_object(
            'state', state_data,
            'confidence', confidence,
            'sample_count', sample_count
        )) INTO v_global_data
        FROM global_aggregate_learning
        WHERE contributing_tenants >= 
            (SELECT COALESCE(MIN(min_tenant_threshold), 5) FROM global_aggregate_learning);
    END IF;
    
    RETURN QUERY SELECT 
        COALESCE(v_user_data, '{}'),
        COALESCE(v_tenant_data, '{}'),
        COALESCE(v_global_data, '{}'),
        v_config.user_weight,
        v_config.tenant_weight,
        v_config.global_weight,
        jsonb_build_object(
            'user', v_user_data,
            'tenant', v_tenant_data,
            'global', v_global_data,
            'weights', jsonb_build_object(
                'user', v_config.user_weight,
                'tenant', v_config.tenant_weight,
                'global', v_config.global_weight
            )
        );
END;
$$ LANGUAGE plpgsql;

-- 9.2 Function to record learning event and update aggregates
CREATE OR REPLACE FUNCTION record_learning_event(
    p_tenant_id UUID,
    p_user_id UUID,
    p_event_type VARCHAR(50),
    p_learning_dimension VARCHAR(100),
    p_event_data JSONB,
    p_impact_score DECIMAL(3, 2) DEFAULT 0.50
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_aggregate_id UUID;
    v_current_state JSONB;
    v_new_state JSONB;
BEGIN
    -- Insert event
    INSERT INTO tenant_learning_events (
        tenant_id, event_type, source_user_hash,
        event_data, impact_score, occurred_at
    ) VALUES (
        p_tenant_id, p_event_type, encode(sha256(p_user_id::text::bytea), 'hex'),
        p_event_data, p_impact_score, NOW()
    ) RETURNING id INTO v_event_id;
    
    -- Update or create tenant aggregate
    SELECT id, state_data INTO v_aggregate_id, v_current_state
    FROM tenant_aggregate_learning
    WHERE tenant_id = p_tenant_id AND learning_dimension = p_learning_dimension;
    
    IF NOT FOUND THEN
        INSERT INTO tenant_aggregate_learning (
            tenant_id, learning_dimension, state_data, sample_count, contributing_users
        ) VALUES (
            p_tenant_id, p_learning_dimension, p_event_data, 1, 1
        ) RETURNING id INTO v_aggregate_id;
    ELSE
        -- Simple state update (in production, use more sophisticated merging)
        UPDATE tenant_aggregate_learning
        SET 
            state_data = state_data || p_event_data,
            sample_count = sample_count + 1,
            last_updated = NOW(),
            last_learning_event_at = NOW()
        WHERE id = v_aggregate_id;
    END IF;
    
    -- Link event to aggregate
    UPDATE tenant_learning_events
    SET aggregate_learning_id = v_aggregate_id, was_incorporated = true
    WHERE id = v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- 9.3 Function to create learning snapshot
CREATE OR REPLACE FUNCTION create_learning_snapshot(
    p_scope_type VARCHAR(20),
    p_scope_id UUID DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_snapshot_id UUID;
    v_version INTEGER;
    v_state JSONB;
    v_checksum VARCHAR(64);
BEGIN
    -- Get next version
    SELECT COALESCE(MAX(snapshot_version), 0) + 1 INTO v_version
    FROM learning_snapshots
    WHERE scope_type = p_scope_type AND scope_id IS NOT DISTINCT FROM p_scope_id;
    
    -- Build state based on scope
    IF p_scope_type = 'user' THEN
        SELECT jsonb_build_object(
            'preferences', (SELECT jsonb_agg(row_to_json(p)) FROM user_learned_preferences p 
                           WHERE user_id = p_scope_id AND tenant_id = p_tenant_id),
            'rules', (SELECT jsonb_agg(row_to_json(r)) FROM user_rules r 
                     WHERE user_id = p_scope_id AND tenant_id = p_tenant_id),
            'memories', (SELECT jsonb_agg(row_to_json(m)) FROM memories m 
                        JOIN memory_stores ms ON m.store_id = ms.id 
                        WHERE ms.user_id = p_scope_id AND ms.tenant_id = p_tenant_id)
        ) INTO v_state;
    ELSIF p_scope_type = 'tenant' THEN
        SELECT jsonb_build_object(
            'aggregate_learning', (SELECT jsonb_agg(row_to_json(a)) FROM tenant_aggregate_learning a 
                                  WHERE tenant_id = p_scope_id),
            'model_performance', (SELECT jsonb_agg(row_to_json(m)) FROM tenant_model_performance m 
                                 WHERE tenant_id = p_scope_id),
            'influence_config', (SELECT row_to_json(c) FROM learning_influence_config c 
                                WHERE tenant_id = p_scope_id)
        ) INTO v_state;
    ELSIF p_scope_type = 'global' THEN
        SELECT jsonb_build_object(
            'aggregate_learning', (SELECT jsonb_agg(row_to_json(g)) FROM global_aggregate_learning g),
            'model_performance', (SELECT jsonb_agg(row_to_json(m)) FROM global_model_performance m),
            'pattern_library', (SELECT jsonb_agg(row_to_json(p)) FROM global_pattern_library p)
        ) INTO v_state;
    END IF;
    
    -- Calculate checksum
    v_checksum := encode(sha256(v_state::text::bytea), 'hex');
    
    -- Mark previous as not current
    UPDATE learning_snapshots
    SET is_current = false
    WHERE scope_type = p_scope_type AND scope_id IS NOT DISTINCT FROM p_scope_id;
    
    -- Insert snapshot
    INSERT INTO learning_snapshots (
        scope_type, scope_id, tenant_id,
        snapshot_version, learning_state, state_checksum,
        is_current
    ) VALUES (
        p_scope_type, p_scope_id, p_tenant_id,
        v_version, v_state, v_checksum,
        true
    ) RETURNING id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- 9.4 Function to get metrics summary
CREATE OR REPLACE FUNCTION get_metrics_summary(
    p_tenant_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_cost_cents BIGINT,
    total_tokens BIGINT,
    total_api_calls BIGINT,
    success_rate DECIMAL(5, 2),
    avg_latency_ms DECIMAL(10, 2),
    failure_count BIGINT,
    violation_count BIGINT,
    active_users BIGINT,
    models_used TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(bm.total_cost_cents), 0)::BIGINT as total_cost_cents,
        COALESCE(SUM(bm.total_tokens), 0)::BIGINT as total_tokens,
        COALESCE(SUM(bm.api_calls), 0)::BIGINT as total_api_calls,
        CASE WHEN COALESCE(SUM(bm.api_calls), 0) > 0 
            THEN (COALESCE(SUM(bm.successful_calls), 0)::DECIMAL / SUM(bm.api_calls) * 100)
            ELSE 0 
        END as success_rate,
        COALESCE(AVG(pm.total_latency_ms), 0) as avg_latency_ms,
        (SELECT COUNT(*) FROM failure_events fe 
         WHERE fe.tenant_id = p_tenant_id 
         AND fe.occurred_at::date BETWEEN p_start_date AND p_end_date)::BIGINT as failure_count,
        (SELECT COUNT(*) FROM prompt_violations pv 
         WHERE pv.tenant_id = p_tenant_id 
         AND pv.occurred_at::date BETWEEN p_start_date AND p_end_date)::BIGINT as violation_count,
        (SELECT COUNT(DISTINCT bm2.user_id) FROM billing_metrics bm2 
         WHERE bm2.tenant_id = p_tenant_id 
         AND bm2.period_date BETWEEN p_start_date AND p_end_date)::BIGINT as active_users,
        (SELECT ARRAY_AGG(DISTINCT bm3.model_id) FROM billing_metrics bm3 
         WHERE bm3.tenant_id = p_tenant_id 
         AND bm3.period_date BETWEEN p_start_date AND p_end_date) as models_used
    FROM billing_metrics bm
    LEFT JOIN performance_metrics pm ON pm.tenant_id = bm.tenant_id 
        AND pm.recorded_at::date = bm.period_date
    WHERE bm.tenant_id = p_tenant_id
    AND bm.period_date BETWEEN p_start_date AND p_end_date
    GROUP BY bm.tenant_id;
END;
$$ LANGUAGE plpgsql;

-- 9.5 Trigger to auto-version user rules
CREATE OR REPLACE FUNCTION auto_version_user_rule()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Only version if content actually changed
        IF OLD.rule_content IS DISTINCT FROM NEW.rule_content OR
           OLD.rule_priority IS DISTINCT FROM NEW.rule_priority OR
           OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            
            INSERT INTO user_rules_versions (
                rule_id, version, rule_content, rule_priority, is_active,
                change_type, change_reason
            ) VALUES (
                NEW.id, NEW.current_version, NEW.rule_content, NEW.rule_priority, NEW.is_active,
                'update', 'Auto-versioned on update'
            );
            
            NEW.current_version := NEW.current_version + 1;
            NEW.updated_at := NOW();
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO user_rules_versions (
            rule_id, version, rule_content, rule_priority, is_active,
            change_type, change_reason
        ) VALUES (
            NEW.id, 1, NEW.rule_content, NEW.rule_priority, NEW.is_active,
            'create', 'Initial creation'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_version_user_rule
    BEFORE INSERT OR UPDATE ON user_rules
    FOR EACH ROW EXECUTE FUNCTION auto_version_user_rule();

-- 9.6 Function to aggregate to global (scheduled job)
CREATE OR REPLACE FUNCTION aggregate_to_global()
RETURNS void AS $$
DECLARE
    v_min_tenants INTEGER := 5;
BEGIN
    -- Aggregate model performance across tenants
    INSERT INTO global_model_performance (model_id, task_type, quality_score, speed_score, 
        cost_efficiency_score, reliability_score, total_tenants_using, total_uses, 
        positive_feedback_rate, confidence, last_aggregated_at)
    SELECT 
        tmp.model_id,
        tmp.task_type,
        AVG(tmp.quality_score) as quality_score,
        AVG(tmp.speed_score) as speed_score,
        AVG(tmp.cost_efficiency_score) as cost_efficiency_score,
        AVG(tmp.reliability_score) as reliability_score,
        COUNT(DISTINCT tmp.tenant_id) as total_tenants_using,
        SUM(tmp.total_uses) as total_uses,
        AVG(CASE WHEN tmp.total_uses > 0 
            THEN tmp.positive_feedback::DECIMAL / (tmp.positive_feedback + tmp.negative_feedback)
            ELSE 0.5 END) as positive_feedback_rate,
        CASE WHEN COUNT(DISTINCT tmp.tenant_id) >= v_min_tenants THEN 0.80 ELSE 0.30 END as confidence,
        NOW()
    FROM tenant_model_performance tmp
    GROUP BY tmp.model_id, tmp.task_type
    HAVING COUNT(DISTINCT tmp.tenant_id) >= v_min_tenants
    ON CONFLICT (model_id, task_type) DO UPDATE SET
        quality_score = EXCLUDED.quality_score,
        speed_score = EXCLUDED.speed_score,
        cost_efficiency_score = EXCLUDED.cost_efficiency_score,
        reliability_score = EXCLUDED.reliability_score,
        total_tenants_using = EXCLUDED.total_tenants_using,
        total_uses = EXCLUDED.total_uses,
        positive_feedback_rate = EXCLUDED.positive_feedback_rate,
        confidence = EXCLUDED.confidence,
        last_aggregated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 10: DEFAULT CONFIGURATIONS
-- ============================================================================

-- Insert default global learning dimensions
INSERT INTO global_aggregate_learning (learning_dimension, state_data, confidence, min_tenant_threshold)
VALUES 
    ('model_performance', '{}', 0.10, 5),
    ('task_patterns', '{}', 0.10, 5),
    ('error_recovery', '{}', 0.10, 5),
    ('format_preferences', '{}', 0.10, 5),
    ('domain_expertise', '{}', 0.10, 5)
ON CONFLICT (learning_dimension) DO NOTHING;

-- ============================================================================
-- SECTION 11: COMMENTS
-- ============================================================================

COMMENT ON TABLE billing_metrics IS 'Detailed billing and cost tracking per tenant/user/model';
COMMENT ON TABLE performance_metrics IS 'API and model performance metrics with latency tracking';
COMMENT ON TABLE failure_events IS 'Comprehensive failure and error tracking';
COMMENT ON TABLE prompt_violations IS 'Content policy and prompt violation tracking';
COMMENT ON TABLE system_logs IS 'Centralized system logging';
COMMENT ON TABLE user_memory_versions IS 'Versioned history of user memories for rollback/audit';
COMMENT ON TABLE user_rules IS 'User-defined Think Tank rules with versioning';
COMMENT ON TABLE user_learned_preferences IS 'AGI Brain learned user preferences';
COMMENT ON TABLE tenant_aggregate_learning IS 'Tenant-level aggregated learning state';
COMMENT ON TABLE global_aggregate_learning IS 'Cross-tenant anonymized aggregate learning';
COMMENT ON TABLE learning_influence_config IS 'Per-tenant configuration for learning influence weights';
COMMENT ON TABLE learning_snapshots IS 'Snapshots for fast recovery after system reboot';
COMMENT ON FUNCTION get_learning_influence IS 'Gets combined user→tenant→global learning influence for decisions';
COMMENT ON FUNCTION record_learning_event IS 'Records learning event and updates aggregates';
COMMENT ON FUNCTION create_learning_snapshot IS 'Creates point-in-time snapshot for recovery';
