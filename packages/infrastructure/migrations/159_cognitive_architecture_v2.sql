-- Migration: 159_cognitive_architecture_v2.sql
-- Description: PROMPT-40 Cognitive Architecture - Ghost Memory enhancements for Active Inference
-- Version: 5.4.0
-- Date: 2026-01-10

-- =============================================================================
-- GHOST MEMORY SCHEMA ENHANCEMENTS
-- Implements: ttl_seconds, semantic_key, domain_hint for Active Inference
-- =============================================================================

-- Add new columns to ghost_vectors table
ALTER TABLE ghost_vectors 
ADD COLUMN IF NOT EXISTS ttl_seconds INTEGER DEFAULT 86400,
ADD COLUMN IF NOT EXISTS semantic_key TEXT,
ADD COLUMN IF NOT EXISTS domain_hint VARCHAR(50),
ADD COLUMN IF NOT EXISTS retrieval_confidence FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS write_back_pending BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS source_workflow VARCHAR(100),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for semantic key lookups (deduplication)
CREATE INDEX IF NOT EXISTS idx_ghost_vectors_semantic_key 
ON ghost_vectors(tenant_id, semantic_key) 
WHERE semantic_key IS NOT NULL;

-- Create index for domain-based routing
CREATE INDEX IF NOT EXISTS idx_ghost_vectors_domain_hint 
ON ghost_vectors(tenant_id, domain_hint) 
WHERE domain_hint IS NOT NULL;

-- Create index for TTL-based cleanup
CREATE INDEX IF NOT EXISTS idx_ghost_vectors_ttl_expiry 
ON ghost_vectors(tenant_id, (updated_at + (ttl_seconds || ' seconds')::interval))
WHERE ttl_seconds IS NOT NULL;

-- =============================================================================
-- COGNITIVE ROUTING TABLE
-- Tracks Economic Governor + retrieval confidence decisions
-- =============================================================================

CREATE TABLE IF NOT EXISTS cognitive_routing_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    query_preview TEXT,
    
    -- Economic Governor decision
    complexity_score FLOAT NOT NULL,
    original_model VARCHAR(100),
    selected_model VARCHAR(100) NOT NULL,
    routing_reason TEXT,
    
    -- Retrieval confidence from Ghost Memory
    retrieval_confidence FLOAT DEFAULT 1.0,
    ghost_hit BOOLEAN DEFAULT FALSE,
    semantic_key_matched TEXT,
    
    -- Routing outcome
    route_type VARCHAR(20) NOT NULL CHECK (route_type IN ('sniper', 'war_room', 'hitl')),
    fallback_triggered BOOLEAN DEFAULT FALSE,
    circuit_breaker_open BOOLEAN DEFAULT FALSE,
    
    -- Cost tracking
    estimated_cost_cents FLOAT,
    actual_cost_cents FLOAT,
    savings_cents FLOAT,
    
    -- Timing
    routing_latency_ms INTEGER,
    execution_latency_ms INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cognitive routing
CREATE INDEX IF NOT EXISTS idx_cognitive_routing_tenant_session 
ON cognitive_routing_decisions(tenant_id, session_id);

CREATE INDEX IF NOT EXISTS idx_cognitive_routing_query_hash 
ON cognitive_routing_decisions(tenant_id, query_hash);

CREATE INDEX IF NOT EXISTS idx_cognitive_routing_route_type 
ON cognitive_routing_decisions(route_type, created_at DESC);

-- RLS for cognitive routing
ALTER TABLE cognitive_routing_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cognitive_routing_tenant_isolation ON cognitive_routing_decisions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- GHOST MEMORY WRITE-BACK QUEUE
-- Tracks pending write-backs from sniper_execute to Ghost Memory
-- =============================================================================

CREATE TABLE IF NOT EXISTS ghost_memory_write_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    
    -- Content to write
    semantic_key TEXT NOT NULL,
    content TEXT NOT NULL,
    domain_hint VARCHAR(50),
    ttl_seconds INTEGER DEFAULT 86400,
    
    -- Processing state
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    
    -- Source tracking
    source_workflow VARCHAR(100),
    routing_decision_id UUID REFERENCES cognitive_routing_decisions(id),
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS idx_ghost_write_queue_pending 
ON ghost_memory_write_queue(status, created_at) 
WHERE status = 'pending';

-- RLS for write queue
ALTER TABLE ghost_memory_write_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY ghost_write_queue_tenant_isolation ON ghost_memory_write_queue
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- CIRCUIT BREAKER STATE TABLE
-- Tracks circuit breaker state for model endpoints
-- =============================================================================

CREATE TABLE IF NOT EXISTS cognitive_circuit_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Endpoint identification
    endpoint_type VARCHAR(50) NOT NULL, -- 'ghost_memory', 'sniper', 'war_room', 'hitl'
    endpoint_id VARCHAR(100) NOT NULL,
    
    -- Circuit breaker state
    state VARCHAR(20) DEFAULT 'CLOSED' CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    half_open_successes INTEGER DEFAULT 0,
    
    -- Configuration
    failure_threshold INTEGER DEFAULT 5,
    recovery_timeout_seconds INTEGER DEFAULT 30,
    half_open_max_requests INTEGER DEFAULT 3,
    
    -- Timing
    last_failure_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    state_changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metrics
    total_requests INTEGER DEFAULT 0,
    total_failures INTEGER DEFAULT 0,
    avg_latency_ms FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, endpoint_type, endpoint_id)
);

-- RLS for circuit breakers
ALTER TABLE cognitive_circuit_breakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY circuit_breaker_tenant_isolation ON cognitive_circuit_breakers
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- COGNITIVE METRICS TABLE
-- Stores CloudWatch-style metrics for observability
-- =============================================================================

CREATE TABLE IF NOT EXISTS cognitive_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Metric identification
    metric_namespace VARCHAR(100) NOT NULL, -- 'Radiant/Cognitive'
    metric_name VARCHAR(100) NOT NULL,
    
    -- Dimensions
    dimensions JSONB DEFAULT '{}'::jsonb,
    
    -- Values
    value FLOAT NOT NULL,
    unit VARCHAR(50) DEFAULT 'Count',
    
    -- Timestamp
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Aggregation helpers
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
);

-- Partitioning by month for metrics (if not already partitioned)
-- Note: In production, use proper table partitioning

-- Indexes for metric queries
CREATE INDEX IF NOT EXISTS idx_cognitive_metrics_namespace_name 
ON cognitive_metrics(metric_namespace, metric_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_cognitive_metrics_tenant_time 
ON cognitive_metrics(tenant_id, timestamp DESC);

-- RLS for metrics
ALTER TABLE cognitive_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY cognitive_metrics_tenant_isolation ON cognitive_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- HITL TIMEOUT TRACKING
-- Tracks HITL escalations from War Room timeout
-- =============================================================================

CREATE TABLE IF NOT EXISTS cognitive_hitl_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    
    -- Escalation source
    source_workflow VARCHAR(100) NOT NULL,
    routing_decision_id UUID REFERENCES cognitive_routing_decisions(id),
    
    -- Query context
    original_query TEXT NOT NULL,
    domain_hint VARCHAR(50),
    complexity_score FLOAT,
    
    -- Timeout details
    timeout_seconds INTEGER NOT NULL,
    war_room_attempts INTEGER DEFAULT 1,
    
    -- Resolution
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'expired', 'cancelled')),
    resolution TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Index for pending escalations
CREATE INDEX IF NOT EXISTS idx_hitl_escalations_pending 
ON cognitive_hitl_escalations(tenant_id, status, created_at) 
WHERE status = 'pending';

-- RLS for HITL escalations
ALTER TABLE cognitive_hitl_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY hitl_escalations_tenant_isolation ON cognitive_hitl_escalations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- COGNITIVE CONFIGURATION TABLE
-- Per-tenant configuration for cognitive architecture
-- =============================================================================

CREATE TABLE IF NOT EXISTS cognitive_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Ghost Memory settings
    ghost_memory_enabled BOOLEAN DEFAULT TRUE,
    ghost_default_ttl_seconds INTEGER DEFAULT 86400,
    ghost_similarity_threshold FLOAT DEFAULT 0.85,
    ghost_max_entries_per_user INTEGER DEFAULT 1000,
    
    -- Economic Governor settings
    governor_enabled BOOLEAN DEFAULT TRUE,
    governor_mode VARCHAR(20) DEFAULT 'balanced' CHECK (governor_mode IN ('off', 'cost_saver', 'balanced', 'performance')),
    governor_sniper_threshold FLOAT DEFAULT 0.3,
    governor_war_room_threshold FLOAT DEFAULT 0.7,
    
    -- Retrieval confidence settings
    retrieval_confidence_threshold FLOAT DEFAULT 0.7,
    low_confidence_route VARCHAR(20) DEFAULT 'war_room',
    
    -- Circuit breaker settings
    circuit_breaker_enabled BOOLEAN DEFAULT TRUE,
    circuit_breaker_failure_threshold INTEGER DEFAULT 5,
    circuit_breaker_recovery_seconds INTEGER DEFAULT 30,
    
    -- HITL settings
    hitl_timeout_seconds INTEGER DEFAULT 86400,
    hitl_auto_expire BOOLEAN DEFAULT TRUE,
    
    -- Metrics settings
    metrics_enabled BOOLEAN DEFAULT TRUE,
    metrics_sample_rate FLOAT DEFAULT 1.0,
    
    -- Domain routing
    domain_routing_enabled BOOLEAN DEFAULT TRUE,
    domain_routing_rules JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for config
ALTER TABLE cognitive_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY cognitive_config_tenant_isolation ON cognitive_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if ghost memory entry is expired
CREATE OR REPLACE FUNCTION is_ghost_expired(
    p_updated_at TIMESTAMPTZ,
    p_ttl_seconds INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    IF p_ttl_seconds IS NULL OR p_ttl_seconds <= 0 THEN
        RETURN FALSE; -- No TTL means never expires
    END IF;
    RETURN p_updated_at + (p_ttl_seconds || ' seconds')::interval < NOW();
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate semantic similarity (placeholder - real impl uses pgvector)
CREATE OR REPLACE FUNCTION ghost_semantic_match(
    p_tenant_id UUID,
    p_semantic_key TEXT,
    p_threshold FLOAT DEFAULT 0.85
) RETURNS TABLE (
    ghost_id UUID,
    user_id UUID,
    semantic_key TEXT,
    similarity FLOAT,
    domain_hint VARCHAR(50),
    ttl_seconds INTEGER,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Simple exact match for now; pgvector would use cosine similarity
    RETURN QUERY
    SELECT 
        gv.id AS ghost_id,
        gv.user_id::UUID,
        gv.semantic_key,
        1.0::FLOAT AS similarity,
        gv.domain_hint,
        gv.ttl_seconds,
        gv.updated_at
    FROM ghost_vectors gv
    WHERE gv.tenant_id = p_tenant_id
      AND gv.semantic_key = p_semantic_key
      AND NOT is_ghost_expired(gv.updated_at, gv.ttl_seconds)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to record cognitive routing decision
CREATE OR REPLACE FUNCTION record_cognitive_routing(
    p_tenant_id UUID,
    p_session_id UUID,
    p_query_hash VARCHAR(64),
    p_query_preview TEXT,
    p_complexity_score FLOAT,
    p_original_model VARCHAR(100),
    p_selected_model VARCHAR(100),
    p_routing_reason TEXT,
    p_retrieval_confidence FLOAT,
    p_ghost_hit BOOLEAN,
    p_semantic_key_matched TEXT,
    p_route_type VARCHAR(20),
    p_estimated_cost_cents FLOAT,
    p_routing_latency_ms INTEGER
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO cognitive_routing_decisions (
        tenant_id, session_id, query_hash, query_preview,
        complexity_score, original_model, selected_model, routing_reason,
        retrieval_confidence, ghost_hit, semantic_key_matched,
        route_type, estimated_cost_cents, routing_latency_ms
    ) VALUES (
        p_tenant_id, p_session_id, p_query_hash, p_query_preview,
        p_complexity_score, p_original_model, p_selected_model, p_routing_reason,
        p_retrieval_confidence, p_ghost_hit, p_semantic_key_matched,
        p_route_type, p_estimated_cost_cents, p_routing_latency_ms
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update circuit breaker state
CREATE OR REPLACE FUNCTION update_circuit_breaker(
    p_tenant_id UUID,
    p_endpoint_type VARCHAR(50),
    p_endpoint_id VARCHAR(100),
    p_success BOOLEAN,
    p_latency_ms INTEGER DEFAULT NULL
) RETURNS TABLE (
    new_state VARCHAR(20),
    should_allow BOOLEAN
) AS $$
DECLARE
    v_record cognitive_circuit_breakers%ROWTYPE;
    v_new_state VARCHAR(20);
    v_should_allow BOOLEAN := TRUE;
BEGIN
    -- Get or create circuit breaker record
    SELECT * INTO v_record
    FROM cognitive_circuit_breakers
    WHERE tenant_id = p_tenant_id 
      AND endpoint_type = p_endpoint_type 
      AND endpoint_id = p_endpoint_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        INSERT INTO cognitive_circuit_breakers (tenant_id, endpoint_type, endpoint_id)
        VALUES (p_tenant_id, p_endpoint_type, p_endpoint_id)
        RETURNING * INTO v_record;
    END IF;
    
    -- Update based on success/failure
    IF p_success THEN
        IF v_record.state = 'HALF_OPEN' THEN
            v_record.half_open_successes := v_record.half_open_successes + 1;
            IF v_record.half_open_successes >= v_record.half_open_max_requests THEN
                v_new_state := 'CLOSED';
                v_record.failure_count := 0;
            ELSE
                v_new_state := v_record.state;
            END IF;
        ELSE
            v_new_state := 'CLOSED';
            v_record.failure_count := 0;
        END IF;
        v_record.success_count := v_record.success_count + 1;
        v_record.last_success_at := NOW();
    ELSE
        v_record.failure_count := v_record.failure_count + 1;
        v_record.total_failures := v_record.total_failures + 1;
        v_record.last_failure_at := NOW();
        
        IF v_record.failure_count >= v_record.failure_threshold THEN
            v_new_state := 'OPEN';
        ELSIF v_record.state = 'HALF_OPEN' THEN
            v_new_state := 'OPEN';
        ELSE
            v_new_state := v_record.state;
        END IF;
    END IF;
    
    -- Check if OPEN circuit should transition to HALF_OPEN
    IF v_record.state = 'OPEN' AND 
       v_record.last_failure_at + (v_record.recovery_timeout_seconds || ' seconds')::interval < NOW() THEN
        v_new_state := 'HALF_OPEN';
        v_record.half_open_successes := 0;
    END IF;
    
    -- Determine if request should be allowed
    v_should_allow := v_new_state IN ('CLOSED', 'HALF_OPEN');
    
    -- Update record
    UPDATE cognitive_circuit_breakers SET
        state = COALESCE(v_new_state, state),
        failure_count = v_record.failure_count,
        success_count = v_record.success_count,
        half_open_successes = v_record.half_open_successes,
        last_failure_at = v_record.last_failure_at,
        last_success_at = v_record.last_success_at,
        total_requests = total_requests + 1,
        avg_latency_ms = CASE 
            WHEN p_latency_ms IS NOT NULL THEN 
                (COALESCE(avg_latency_ms, 0) * total_requests + p_latency_ms) / (total_requests + 1)
            ELSE avg_latency_ms
        END,
        state_changed_at = CASE WHEN COALESCE(v_new_state, state) != state THEN NOW() ELSE state_changed_at END,
        updated_at = NOW()
    WHERE id = v_record.id;
    
    RETURN QUERY SELECT COALESCE(v_new_state, v_record.state), v_should_allow;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired ghost entries
CREATE OR REPLACE FUNCTION cleanup_expired_ghosts(
    p_tenant_id UUID DEFAULT NULL,
    p_batch_size INTEGER DEFAULT 1000
) RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM ghost_vectors
        WHERE id IN (
            SELECT id FROM ghost_vectors
            WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
              AND ttl_seconds IS NOT NULL
              AND ttl_seconds > 0
              AND is_ghost_expired(updated_at, ttl_seconds)
            LIMIT p_batch_size
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted FROM deleted;
    
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function to emit cognitive metric
CREATE OR REPLACE FUNCTION emit_cognitive_metric(
    p_tenant_id UUID,
    p_metric_name VARCHAR(100),
    p_value FLOAT,
    p_unit VARCHAR(50) DEFAULT 'Count',
    p_dimensions JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO cognitive_metrics (
        tenant_id, metric_namespace, metric_name, value, unit, dimensions
    ) VALUES (
        p_tenant_id, 'Radiant/Cognitive', p_metric_name, p_value, p_unit, p_dimensions
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger to update ghost access stats
CREATE OR REPLACE FUNCTION update_ghost_access_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- This would be called when ghost is read
    UPDATE ghost_vectors 
    SET last_accessed_at = NOW(),
        access_count = access_count + 1
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-cleanup old metrics (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_cognitive_metrics()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM cognitive_metrics
    WHERE timestamp < NOW() - INTERVAL '30 days';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup trigger (runs occasionally)
DROP TRIGGER IF EXISTS trg_cleanup_cognitive_metrics ON cognitive_metrics;
CREATE TRIGGER trg_cleanup_cognitive_metrics
    AFTER INSERT ON cognitive_metrics
    FOR EACH STATEMENT
    WHEN (random() < 0.01) -- 1% chance on each insert batch
    EXECUTE FUNCTION cleanup_old_cognitive_metrics();

-- =============================================================================
-- SEED DEFAULT CONFIGURATIONS
-- =============================================================================

-- Insert default cognitive config for system tenant if not exists
INSERT INTO cognitive_config (tenant_id)
SELECT id FROM tenants WHERE name = 'system'
ON CONFLICT (tenant_id) DO NOTHING;

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cognitive_routing_decisions TO radiant_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ghost_memory_write_queue TO radiant_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON cognitive_circuit_breakers TO radiant_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON cognitive_metrics TO radiant_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON cognitive_hitl_escalations TO radiant_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON cognitive_config TO radiant_api;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO radiant_api;
