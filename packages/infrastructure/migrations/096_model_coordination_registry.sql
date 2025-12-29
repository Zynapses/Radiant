-- RADIANT v4.18.0 - Model Coordination Registry
-- Persistent storage for model communication protocols and sync configuration
-- Migration: 096_model_coordination_registry.sql

-- ============================================================================
-- MODEL REGISTRY TABLE
-- Central registry of all models (external and self-hosted)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(200) UNIQUE NOT NULL,
    
    -- Classification
    source VARCHAR(20) NOT NULL CHECK (source IN ('external', 'self-hosted', 'hybrid')),
    provider VARCHAR(100) NOT NULL,
    family VARCHAR(100) NOT NULL,
    
    -- Capabilities
    capabilities TEXT[] DEFAULT '{}',
    input_modalities TEXT[] DEFAULT '{}',
    output_modalities TEXT[] DEFAULT '{}',
    
    -- Routing
    primary_endpoint_id UUID,
    routing_priority INTEGER DEFAULT 1,
    fallback_model_ids TEXT[] DEFAULT '{}',
    
    -- Proficiency link
    proficiency_profile JSONB,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated', 'pending')),
    last_synced_at TIMESTAMPTZ,
    sync_source VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_registry_read_all" ON model_registry
    FOR SELECT USING (true);

CREATE POLICY "model_registry_admin_write" ON model_registry
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin')
        )
    );

-- Indexes
CREATE INDEX idx_model_registry_source ON model_registry(source);
CREATE INDEX idx_model_registry_provider ON model_registry(provider);
CREATE INDEX idx_model_registry_status ON model_registry(status);
CREATE INDEX idx_model_registry_family ON model_registry(family);

-- ============================================================================
-- MODEL ENDPOINTS TABLE
-- Communication endpoints for each model
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(200) NOT NULL REFERENCES model_registry(model_id) ON DELETE CASCADE,
    
    -- Endpoint details
    endpoint_type VARCHAR(30) NOT NULL CHECK (endpoint_type IN (
        'openai_compatible', 'anthropic_compatible', 'sagemaker', 'bedrock', 'custom_rest', 'custom_grpc'
    )),
    base_url TEXT NOT NULL,
    path TEXT,
    method VARCHAR(10) NOT NULL DEFAULT 'POST' CHECK (method IN ('POST', 'GET')),
    
    -- Authentication
    auth_method VARCHAR(30) NOT NULL CHECK (auth_method IN (
        'api_key', 'bearer_token', 'aws_sig_v4', 'oauth2', 'custom_header', 'none'
    )),
    auth_config JSONB,
    
    -- Request/Response format
    request_format JSONB,
    response_format JSONB,
    response_mapping JSONB,
    
    -- Limits and quotas
    rate_limit_rpm INTEGER,
    rate_limit_tpm INTEGER,
    max_concurrent INTEGER,
    timeout_ms INTEGER DEFAULT 30000,
    
    -- Health monitoring
    health_check_url TEXT,
    health_check_interval INTEGER DEFAULT 300, -- seconds
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    consecutive_failures INTEGER DEFAULT 0,
    
    -- Priority and status
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE model_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_endpoints_read_all" ON model_endpoints
    FOR SELECT USING (true);

CREATE POLICY "model_endpoints_admin_write" ON model_endpoints
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin')
        )
    );

-- Indexes
CREATE INDEX idx_model_endpoints_model ON model_endpoints(model_id);
CREATE INDEX idx_model_endpoints_health ON model_endpoints(health_status);
CREATE INDEX idx_model_endpoints_active ON model_endpoints(is_active);
CREATE INDEX idx_model_endpoints_type ON model_endpoints(endpoint_type);

-- ============================================================================
-- MODEL SYNC CONFIG TABLE
-- Configuration for timed sync service
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_sync_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Sync intervals
    auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
    sync_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (sync_interval_minutes IN (5, 15, 30, 60, 360, 1440)),
    
    -- Sync sources
    sync_external_providers BOOLEAN NOT NULL DEFAULT true,
    sync_self_hosted_models BOOLEAN NOT NULL DEFAULT true,
    sync_from_huggingface BOOLEAN NOT NULL DEFAULT false,
    
    -- Auto-discovery
    auto_discovery_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_generate_proficiencies BOOLEAN NOT NULL DEFAULT true,
    
    -- Notifications
    notify_on_new_model BOOLEAN NOT NULL DEFAULT true,
    notify_on_model_removed BOOLEAN NOT NULL DEFAULT false,
    notify_on_sync_failure BOOLEAN NOT NULL DEFAULT true,
    notification_emails JSONB,
    notification_webhook TEXT,
    
    -- Last sync info
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20) CHECK (last_sync_status IN ('pending', 'running', 'completed', 'failed', 'partial')),
    last_sync_duration_ms INTEGER,
    next_scheduled_sync TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- RLS Policy
ALTER TABLE model_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_sync_config_tenant_read" ON model_sync_config
    FOR SELECT USING (
        tenant_id IS NULL OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY "model_sync_config_admin_write" ON model_sync_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin')
        )
    );

-- Insert default global config
INSERT INTO model_sync_config (
    tenant_id, auto_sync_enabled, sync_interval_minutes,
    sync_external_providers, sync_self_hosted_models, sync_from_huggingface,
    auto_discovery_enabled, auto_generate_proficiencies,
    notify_on_new_model, notify_on_model_removed, notify_on_sync_failure
) VALUES (
    NULL, true, 60,
    true, true, false,
    true, true,
    true, false, true
) ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- MODEL SYNC JOBS TABLE
-- History of sync job executions
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES model_sync_config(id) ON DELETE CASCADE,
    
    -- Job details
    trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'new_model', 'webhook')),
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Progress
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Results
    models_scanned INTEGER DEFAULT 0,
    models_added INTEGER DEFAULT 0,
    models_updated INTEGER DEFAULT 0,
    models_removed INTEGER DEFAULT 0,
    endpoints_updated INTEGER DEFAULT 0,
    proficiencies_generated INTEGER DEFAULT 0,
    
    -- Errors and warnings
    errors JSONB DEFAULT '[]',
    warnings JSONB DEFAULT '[]',
    
    -- Source breakdown
    source_breakdown JSONB
);

-- RLS Policy
ALTER TABLE model_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_sync_jobs_read_admin" ON model_sync_jobs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin', 'operator')
        )
    );

-- Indexes
CREATE INDEX idx_model_sync_jobs_config ON model_sync_jobs(config_id);
CREATE INDEX idx_model_sync_jobs_status ON model_sync_jobs(status);
CREATE INDEX idx_model_sync_jobs_started ON model_sync_jobs(started_at DESC);

-- ============================================================================
-- NEW MODEL DETECTIONS TABLE
-- Track newly detected models for processing
-- ============================================================================

CREATE TABLE IF NOT EXISTS new_model_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(200) UNIQUE NOT NULL,
    
    -- Detection details
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detection_source VARCHAR(20) NOT NULL CHECK (detection_source IN (
        'api_call', 'health_check', 'provider_sync', 'huggingface', 'manual'
    )),
    
    -- Model info
    provider VARCHAR(100),
    family VARCHAR(100),
    capabilities TEXT[],
    
    -- Processing status
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    added_to_registry BOOLEAN DEFAULT false,
    proficiencies_generated BOOLEAN DEFAULT false,
    skip_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE new_model_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "new_model_detections_admin" ON new_model_detections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin')
        )
    );

-- Indexes
CREATE INDEX idx_new_model_detections_processed ON new_model_detections(processed);
CREATE INDEX idx_new_model_detections_detected ON new_model_detections(detected_at DESC);

-- ============================================================================
-- MODEL ROUTING RULES TABLE
-- Rules for routing requests to models
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Rule details
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Conditions (JSONB for flexibility)
    conditions JSONB NOT NULL DEFAULT '{}',
    
    -- Target models
    target_model_ids TEXT[] NOT NULL DEFAULT '{}',
    target_priority VARCHAR(20) NOT NULL DEFAULT 'first_match' CHECK (target_priority IN ('first_match', 'best_score', 'load_balanced')),
    
    -- Fallback behavior
    fallback_behavior VARCHAR(20) NOT NULL DEFAULT 'next_priority' CHECK (fallback_behavior IN (
        'next_priority', 'cheapest', 'fastest', 'most_capable', 'random'
    )),
    max_fallback_attempts INTEGER DEFAULT 3,
    
    -- Load balancing
    load_balancing_strategy VARCHAR(20) DEFAULT 'round_robin' CHECK (load_balancing_strategy IN (
        'round_robin', 'weighted', 'least_connections', 'latency_based'
    )),
    
    -- Health-aware routing
    exclude_unhealthy_endpoints BOOLEAN DEFAULT true,
    unhealthy_threshold_ms INTEGER DEFAULT 5000,
    
    -- Priority and status
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE model_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_routing_rules_tenant" ON model_routing_rules
    FOR SELECT USING (
        tenant_id IS NULL OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY "model_routing_rules_admin_write" ON model_routing_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin')
        )
    );

-- Indexes
CREATE INDEX idx_model_routing_rules_tenant ON model_routing_rules(tenant_id);
CREATE INDEX idx_model_routing_rules_active ON model_routing_rules(is_active);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get active endpoints for a model
CREATE OR REPLACE FUNCTION get_model_endpoints(p_model_id TEXT)
RETURNS TABLE (
    endpoint_id UUID,
    endpoint_type VARCHAR(30),
    base_url TEXT,
    auth_method VARCHAR(30),
    health_status VARCHAR(20),
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        me.id,
        me.endpoint_type,
        me.base_url,
        me.auth_method,
        me.health_status,
        me.priority
    FROM model_endpoints me
    WHERE me.model_id = p_model_id
    AND me.is_active = true
    ORDER BY me.priority DESC, me.health_status = 'healthy' DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get best endpoint for a model (health-aware)
CREATE OR REPLACE FUNCTION get_best_endpoint(p_model_id TEXT)
RETURNS TABLE (
    endpoint_id UUID,
    endpoint_type VARCHAR(30),
    base_url TEXT,
    auth_method VARCHAR(30),
    auth_config JSONB,
    request_format JSONB,
    response_format JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        me.id,
        me.endpoint_type,
        me.base_url,
        me.auth_method,
        me.auth_config,
        me.request_format,
        me.response_format
    FROM model_endpoints me
    WHERE me.model_id = p_model_id
    AND me.is_active = true
    AND me.health_status IN ('healthy', 'unknown')
    ORDER BY 
        me.priority DESC,
        CASE me.health_status WHEN 'healthy' THEN 0 WHEN 'unknown' THEN 1 ELSE 2 END
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sync dashboard stats
CREATE OR REPLACE FUNCTION get_sync_dashboard_stats()
RETURNS TABLE (
    total_models BIGINT,
    external_models BIGINT,
    self_hosted_models BIGINT,
    active_endpoints BIGINT,
    healthy_endpoints BIGINT,
    pending_detections BIGINT,
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM model_registry WHERE status = 'active'),
        (SELECT COUNT(*) FROM model_registry WHERE source = 'external' AND status = 'active'),
        (SELECT COUNT(*) FROM model_registry WHERE source = 'self-hosted' AND status = 'active'),
        (SELECT COUNT(*) FROM model_endpoints WHERE is_active = true),
        (SELECT COUNT(*) FROM model_endpoints WHERE is_active = true AND health_status = 'healthy'),
        (SELECT COUNT(*) FROM new_model_detections WHERE processed = false),
        (SELECT last_sync_at FROM model_sync_config WHERE tenant_id IS NULL),
        (SELECT next_scheduled_sync FROM model_sync_config WHERE tenant_id IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to match models by routing rules
CREATE OR REPLACE FUNCTION match_models_by_rules(
    p_tenant_id UUID,
    p_domain TEXT DEFAULT NULL,
    p_mode TEXT DEFAULT NULL,
    p_capability TEXT DEFAULT NULL
)
RETURNS TABLE (
    model_id VARCHAR(200),
    rule_name VARCHAR(200),
    match_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (mr.model_id)
        mr.model_id,
        mrr.name,
        CASE 
            WHEN mrr.conditions->>'domain' = p_domain THEN 10
            WHEN mrr.conditions->>'mode' = p_mode THEN 5
            WHEN mrr.conditions->>'capability' = p_capability THEN 3
            ELSE 1
        END as match_score
    FROM model_registry mr
    JOIN model_routing_rules mrr ON mr.model_id = ANY(mrr.target_model_ids)
    WHERE mr.status = 'active'
    AND mrr.is_active = true
    AND (mrr.tenant_id IS NULL OR mrr.tenant_id = p_tenant_id)
    AND (
        p_domain IS NULL OR mrr.conditions->>'domain' IS NULL OR mrr.conditions->>'domain' = p_domain
    )
    AND (
        p_mode IS NULL OR mrr.conditions->>'mode' IS NULL OR mrr.conditions->>'mode' = p_mode
    )
    ORDER BY mr.model_id, match_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_model_coordination_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_registry_updated
    BEFORE UPDATE ON model_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_model_coordination_timestamp();

CREATE TRIGGER model_endpoints_updated
    BEFORE UPDATE ON model_endpoints
    FOR EACH ROW
    EXECUTE FUNCTION update_model_coordination_timestamp();

CREATE TRIGGER model_sync_config_updated
    BEFORE UPDATE ON model_sync_config
    FOR EACH ROW
    EXECUTE FUNCTION update_model_coordination_timestamp();

CREATE TRIGGER model_routing_rules_updated
    BEFORE UPDATE ON model_routing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_model_coordination_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE model_registry IS 'Central registry of all AI models (external and self-hosted) with capabilities and routing info';
COMMENT ON TABLE model_endpoints IS 'Communication endpoints for models with auth, format, and health monitoring';
COMMENT ON TABLE model_sync_config IS 'Configuration for timed model registry sync service';
COMMENT ON TABLE model_sync_jobs IS 'History of sync job executions with results and errors';
COMMENT ON TABLE new_model_detections IS 'Newly detected models pending processing';
COMMENT ON TABLE model_routing_rules IS 'Rules for routing requests to appropriate models';

COMMENT ON FUNCTION get_model_endpoints(TEXT) IS 'Get all active endpoints for a model';
COMMENT ON FUNCTION get_best_endpoint(TEXT) IS 'Get the best healthy endpoint for a model';
COMMENT ON FUNCTION get_sync_dashboard_stats() IS 'Get statistics for sync dashboard';
COMMENT ON FUNCTION match_models_by_rules(UUID, TEXT, TEXT, TEXT) IS 'Match models based on routing rules';
