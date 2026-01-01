-- =============================================================================
-- RADIANT v6.0.4 - AGI Brain Tables Migration
-- Project AWARE - Autonomous Wakefulness And Reasoning Engine
-- =============================================================================

-- Ghost Vectors Table
-- Stores consciousness continuity through hidden state capture
CREATE TABLE IF NOT EXISTS ghost_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    vector BYTEA NOT NULL,                    -- Float32Array (4096 * 4 = 16384 bytes)
    version VARCHAR(50) NOT NULL DEFAULT 'llama3-70b-v1',
    turn_count INTEGER DEFAULT 0,
    last_reanchor_at TIMESTAMPTZ,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata_json JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_ghost_vectors_tenant ON ghost_vectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ghost_vectors_user_tenant ON ghost_vectors(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ghost_vectors_version ON ghost_vectors(version);
CREATE INDEX IF NOT EXISTS idx_ghost_vectors_updated ON ghost_vectors(updated_at);

-- Ghost Vector History (for migration/debugging)
CREATE TABLE IF NOT EXISTS ghost_vector_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ghost_id UUID NOT NULL REFERENCES ghost_vectors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    vector BYTEA NOT NULL,
    version VARCHAR(50) NOT NULL,
    turn_count INTEGER,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('reanchor', 'migration', 'manual', 'cold_start')),
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghost_history_ghost ON ghost_vector_history(ghost_id);
CREATE INDEX IF NOT EXISTS idx_ghost_history_captured ON ghost_vector_history(captured_at);

-- Flash Facts Log
-- Dual-write safety-critical information (Redis + Postgres)
CREATE TABLE IF NOT EXISTS flash_facts_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    fact_json JSONB NOT NULL,
    fact_type VARCHAR(50) NOT NULL CHECK (fact_type IN ('identity', 'allergy', 'medical', 'preference', 'constraint', 'correction')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal')),
    status VARCHAR(20) DEFAULT 'pending_dream' CHECK (status IN ('pending_dream', 'consolidated', 'failed_retry')),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    consolidated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_flash_facts_user_tenant ON flash_facts_log(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_flash_facts_status ON flash_facts_log(status) WHERE status = 'pending_dream';
CREATE INDEX IF NOT EXISTS idx_flash_facts_type ON flash_facts_log(fact_type);
CREATE INDEX IF NOT EXISTS idx_flash_facts_priority ON flash_facts_log(priority) WHERE priority IN ('critical', 'high');
CREATE INDEX IF NOT EXISTS idx_flash_facts_created ON flash_facts_log(created_at);

-- Dream Log
-- Tracks tenant dreaming/consolidation cycles
CREATE TABLE IF NOT EXISTS dream_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    reason VARCHAR(20) NOT NULL CHECK (reason IN ('low_traffic', 'twilight', 'starvation', 'manual')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    scheduled_for TIMESTAMPTZ,
    last_dream_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    report_json JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dream_log_tenant ON dream_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dream_log_status ON dream_log(status);
CREATE INDEX IF NOT EXISTS idx_dream_log_reason ON dream_log(reason);
CREATE INDEX IF NOT EXISTS idx_dream_log_scheduled ON dream_log(scheduled_for) WHERE status = 'pending';

-- Dream Queue
-- Pending dream jobs with staggered scheduling
CREATE TABLE IF NOT EXISTS dream_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    reason VARCHAR(20) NOT NULL CHECK (reason IN ('low_traffic', 'twilight', 'starvation', 'manual')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('high', 'normal')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dream_queue_status ON dream_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_dream_queue_tenant ON dream_queue(tenant_id);

-- Tenant Last Dream Tracking
CREATE TABLE IF NOT EXISTS tenant_dream_status (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    last_dream_at TIMESTAMPTZ,
    next_dream_scheduled TIMESTAMPTZ,
    dream_count INTEGER DEFAULT 0,
    last_dream_duration_ms INTEGER,
    last_dream_status VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Oversight Queue
-- Human oversight for high-risk domain insights
CREATE TABLE IF NOT EXISTS oversight_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_id UUID NOT NULL UNIQUE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    insight_json JSONB NOT NULL,
    domain VARCHAR(50) NOT NULL CHECK (domain IN ('healthcare', 'financial', 'legal', 'general')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified', 'escalated', 'expired')),
    assigned_to UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_oversight_status ON oversight_queue(status) WHERE status IN ('pending', 'escalated');
CREATE INDEX IF NOT EXISTS idx_oversight_domain ON oversight_queue(domain);
CREATE INDEX IF NOT EXISTS idx_oversight_assigned ON oversight_queue(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oversight_expires ON oversight_queue(expires_at) WHERE status IN ('pending', 'escalated');
CREATE INDEX IF NOT EXISTS idx_oversight_tenant ON oversight_queue(tenant_id);

-- Oversight Decisions
-- Audit trail for oversight reviews
CREATE TABLE IF NOT EXISTS oversight_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_id UUID NOT NULL REFERENCES oversight_queue(insight_id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected', 'modified')),
    reasoning TEXT NOT NULL,
    original_insight TEXT NOT NULL,
    modified_insight TEXT,
    attestation TEXT NOT NULL,
    reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oversight_decisions_insight ON oversight_decisions(insight_id);
CREATE INDEX IF NOT EXISTS idx_oversight_decisions_reviewer ON oversight_decisions(reviewer_id);

-- Tenant Compliance Policies
-- Immutable bottom bun of Compliance Sandwich
CREATE TABLE IF NOT EXISTS tenant_compliance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    policy_text TEXT NOT NULL,
    immutable BOOLEAN DEFAULT true,
    rules_json JSONB DEFAULT '[]'::jsonb,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_policies_tenant ON tenant_compliance_policies(tenant_id);

-- Compliance Policy History
CREATE TABLE IF NOT EXISTS compliance_policy_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES tenant_compliance_policies(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    policy_text TEXT NOT NULL,
    rules_json JSONB,
    version INTEGER NOT NULL,
    changed_by UUID,
    change_reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Memories (Long-term storage)
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source VARCHAR(50) NOT NULL CHECK (source IN ('flash_fact', 'interaction', 'explicit', 'inferred', 'dream_consolidated')),
    memory_type VARCHAR(50) DEFAULT 'general',
    embedding VECTOR(1536),  -- pgvector
    relevance_score FLOAT DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_tenant ON user_memories(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_source ON user_memories(source);
CREATE INDEX IF NOT EXISTS idx_user_memories_relevance ON user_memories(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_accessed ON user_memories(accessed_at);

-- SOFAI Routing Log
-- Tracks System 1/1.5/2 routing decisions
CREATE TABLE IF NOT EXISTS sofai_routing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL CHECK (level IN ('system1', 'system1.5', 'system2')),
    trust_score FLOAT NOT NULL,
    domain_risk FLOAT NOT NULL,
    compute_cost FLOAT NOT NULL,
    reasoning TEXT,
    prompt_hash VARCHAR(64),
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sofai_routing_tenant ON sofai_routing_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sofai_routing_level ON sofai_routing_log(level);
CREATE INDEX IF NOT EXISTS idx_sofai_routing_created ON sofai_routing_log(created_at);

-- Personalization Warmup
-- Tracks user warmup status for three-tier learning
CREATE TABLE IF NOT EXISTS personalization_warmup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    interaction_count INTEGER DEFAULT 0,
    correction_count INTEGER DEFAULT 0,
    warmup_complete BOOLEAN DEFAULT false,
    current_weight FLOAT DEFAULT 0.1,
    first_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_personalization_warmup_user ON personalization_warmup(user_id, tenant_id);

-- Brain Inference Log
-- Tracks all brain inference requests
CREATE TABLE IF NOT EXISTS brain_inference_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    session_id UUID,
    prompt_hash VARCHAR(64),
    system_level VARCHAR(20) NOT NULL,
    ghost_loaded BOOLEAN DEFAULT false,
    ghost_updated BOOLEAN DEFAULT false,
    flash_facts_count INTEGER DEFAULT 0,
    memories_count INTEGER DEFAULT 0,
    context_tokens INTEGER,
    response_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms INTEGER,
    model_used VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_inference_tenant ON brain_inference_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brain_inference_user ON brain_inference_log(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_brain_inference_created ON brain_inference_log(created_at);
CREATE INDEX IF NOT EXISTS idx_brain_inference_level ON brain_inference_log(system_level);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE ghost_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_vector_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_facts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_dream_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE oversight_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE oversight_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_compliance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sofai_routing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalization_warmup ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_inference_log ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tenant_isolation_ghost ON ghost_vectors 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_ghost_history ON ghost_vector_history 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_flash ON flash_facts_log 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_dream_log ON dream_log 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_dream_queue ON dream_queue 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_dream_status ON tenant_dream_status 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_oversight ON oversight_queue 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_oversight_decisions ON oversight_decisions 
    FOR ALL USING (insight_id IN (SELECT insight_id FROM oversight_queue WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID));

CREATE POLICY tenant_isolation_compliance ON tenant_compliance_policies 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_memories ON user_memories 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_sofai ON sofai_routing_log 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_warmup ON personalization_warmup 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_brain_log ON brain_inference_log 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to update ghost vector with history tracking
CREATE OR REPLACE FUNCTION update_ghost_vector(
    p_user_id UUID,
    p_tenant_id UUID,
    p_vector BYTEA,
    p_version VARCHAR,
    p_reason VARCHAR DEFAULT 'reanchor'
)
RETURNS UUID AS $$
DECLARE
    v_ghost_id UUID;
BEGIN
    -- Get existing ghost ID
    SELECT id INTO v_ghost_id 
    FROM ghost_vectors 
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
    
    IF v_ghost_id IS NOT NULL THEN
        -- Save to history
        INSERT INTO ghost_vector_history (ghost_id, user_id, tenant_id, vector, version, turn_count, reason)
        SELECT id, user_id, tenant_id, vector, version, turn_count, p_reason
        FROM ghost_vectors 
        WHERE id = v_ghost_id;
        
        -- Update existing
        UPDATE ghost_vectors 
        SET vector = p_vector,
            version = p_version,
            turn_count = 0,
            last_reanchor_at = NOW(),
            updated_at = NOW()
        WHERE id = v_ghost_id;
    ELSE
        -- Insert new
        INSERT INTO ghost_vectors (user_id, tenant_id, vector, version, turn_count, last_reanchor_at)
        VALUES (p_user_id, p_tenant_id, p_vector, p_version, 0, NOW())
        RETURNING id INTO v_ghost_id;
    END IF;
    
    RETURN v_ghost_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment ghost turn count
CREATE OR REPLACE FUNCTION increment_ghost_turn(p_user_id UUID, p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    UPDATE ghost_vectors 
    SET turn_count = turn_count + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
    RETURNING turn_count INTO v_new_count;
    
    RETURN COALESCE(v_new_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to process oversight timeouts
CREATE OR REPLACE FUNCTION process_oversight_timeouts()
RETURNS TABLE(expired_count INTEGER, escalated_count INTEGER) AS $$
DECLARE
    v_expired INTEGER;
    v_escalated INTEGER;
BEGIN
    -- Auto-reject expired items (7-day rule: "Silence ≠ Consent")
    UPDATE oversight_queue 
    SET status = 'expired'
    WHERE status IN ('pending', 'escalated') 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_expired = ROW_COUNT;
    
    -- Escalate items approaching timeout (3-day threshold)
    UPDATE oversight_queue 
    SET status = 'escalated', 
        escalated_at = NOW()
    WHERE status = 'pending' 
    AND created_at < NOW() - INTERVAL '3 days'
    AND expires_at >= NOW();
    
    GET DIAGNOSTICS v_escalated = ROW_COUNT;
    
    RETURN QUERY SELECT v_expired, v_escalated;
END;
$$ LANGUAGE plpgsql;

-- Function to get tenants eligible for twilight dreaming
CREATE OR REPLACE FUNCTION get_twilight_dream_tenants(p_twilight_hour INTEGER)
RETURNS TABLE(tenant_id UUID, timezone VARCHAR, hours_since_dream FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tenant_id,
        COALESCE(tds.timezone, 'UTC')::VARCHAR,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(tds.last_dream_at, NOW() - INTERVAL '100 hours'))) / 3600 AS hours_since_dream
    FROM tenants t
    LEFT JOIN tenant_dream_status tds ON t.tenant_id = tds.tenant_id
    WHERE 
        -- Local time is twilight hour
        EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(tds.timezone, 'UTC')) = p_twilight_hour
        AND EXTRACT(MINUTE FROM NOW() AT TIME ZONE COALESCE(tds.timezone, 'UTC')) < 15
        -- At least 20 hours since last dream
        AND (tds.last_dream_at IS NULL OR tds.last_dream_at < NOW() - INTERVAL '20 hours')
        -- Not already in queue
        AND NOT EXISTS (
            SELECT 1 FROM dream_queue dq 
            WHERE dq.tenant_id = t.tenant_id 
            AND dq.status = 'pending'
        )
    ORDER BY hours_since_dream DESC
    LIMIT 500;
END;
$$ LANGUAGE plpgsql;

-- Function to get starved tenants (safety net)
CREATE OR REPLACE FUNCTION get_starved_tenants(p_max_hours INTEGER)
RETURNS TABLE(tenant_id UUID, hours_since_dream FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tenant_id,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(tds.last_dream_at, NOW() - INTERVAL '100 hours'))) / 3600 AS hours_since_dream
    FROM tenants t
    LEFT JOIN tenant_dream_status tds ON t.tenant_id = tds.tenant_id
    WHERE 
        tds.last_dream_at IS NULL 
        OR tds.last_dream_at < NOW() - (p_max_hours || ' hours')::INTERVAL
    ORDER BY hours_since_dream DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;
