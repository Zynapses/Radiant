-- RADIANT v4.18.0 - Migration 098: SageMaker Inference Components
-- Enables efficient multi-model hosting with reduced cold starts
-- Models share infrastructure via Inference Components instead of dedicated endpoints

-- ============================================================================
-- 1. INFERENCE COMPONENTS CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS inference_components_config (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Feature flags
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_tiering_enabled BOOLEAN NOT NULL DEFAULT true,
    predictive_loading_enabled BOOLEAN NOT NULL DEFAULT true,
    fallback_to_external_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Tier thresholds (JSON)
    tier_thresholds JSONB NOT NULL DEFAULT '{
        "hotTierMinRequestsPerDay": 100,
        "warmTierMinRequestsPerDay": 10,
        "offTierInactiveDays": 30
    }'::jsonb,
    
    -- Endpoint configuration
    default_instance_type VARCHAR(50) NOT NULL DEFAULT 'ml.g5.xlarge',
    max_shared_endpoints INTEGER NOT NULL DEFAULT 3,
    max_components_per_endpoint INTEGER NOT NULL DEFAULT 15,
    
    -- Loading behavior
    default_load_timeout_ms INTEGER NOT NULL DEFAULT 30000,
    preload_window_minutes INTEGER NOT NULL DEFAULT 15,
    unload_after_idle_minutes INTEGER NOT NULL DEFAULT 30,
    
    -- Cost controls
    max_monthly_budget DECIMAL(12,2),
    alert_threshold_percent INTEGER NOT NULL DEFAULT 80,
    
    -- Notifications
    notify_on_tier_change BOOLEAN NOT NULL DEFAULT true,
    notify_on_load_failure BOOLEAN NOT NULL DEFAULT true,
    notify_on_budget_alert BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

CREATE INDEX idx_inference_config_tenant ON inference_components_config(tenant_id);

COMMENT ON TABLE inference_components_config IS 'Per-tenant configuration for SageMaker Inference Components';

-- ============================================================================
-- 2. SHARED INFERENCE ENDPOINTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS shared_inference_endpoints (
    endpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_name VARCHAR(255) NOT NULL UNIQUE,
    endpoint_arn VARCHAR(512) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Instance configuration
    instance_type VARCHAR(50) NOT NULL,
    instance_count INTEGER NOT NULL DEFAULT 1,
    
    -- Capacity tracking
    total_compute_units INTEGER NOT NULL DEFAULT 0,
    allocated_compute_units INTEGER NOT NULL DEFAULT 0,
    available_compute_units INTEGER NOT NULL DEFAULT 0,
    
    -- Components hosted
    component_count INTEGER NOT NULL DEFAULT 0,
    max_components INTEGER NOT NULL DEFAULT 15,
    component_ids UUID[] DEFAULT '{}',
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'creating',
    
    -- Cost tracking
    hourly_base_cost DECIMAL(8,4) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shared_endpoints_tenant ON shared_inference_endpoints(tenant_id);
CREATE INDEX idx_shared_endpoints_status ON shared_inference_endpoints(status);
CREATE INDEX idx_shared_endpoints_available ON shared_inference_endpoints(available_compute_units DESC);

COMMENT ON TABLE shared_inference_endpoints IS 'SageMaker endpoints that host multiple Inference Components';
COMMENT ON COLUMN shared_inference_endpoints.total_compute_units IS 'Total compute units available on this endpoint';
COMMENT ON COLUMN shared_inference_endpoints.allocated_compute_units IS 'Compute units allocated to components';

-- ============================================================================
-- 3. INFERENCE COMPONENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS inference_components (
    component_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_name VARCHAR(255) NOT NULL UNIQUE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    
    -- Endpoint association
    endpoint_name VARCHAR(255) NOT NULL REFERENCES shared_inference_endpoints(endpoint_name) ON DELETE CASCADE,
    endpoint_arn VARCHAR(512) NOT NULL,
    variant_name VARCHAR(100) NOT NULL DEFAULT 'AllTraffic',
    
    -- Component configuration
    compute_units INTEGER NOT NULL DEFAULT 1,
    min_copies INTEGER NOT NULL DEFAULT 0,
    max_copies INTEGER NOT NULL DEFAULT 5,
    current_copies INTEGER NOT NULL DEFAULT 0,
    
    -- Model artifact
    model_artifact_s3_uri VARCHAR(1024),
    container_image VARCHAR(512),
    framework VARCHAR(50) NOT NULL DEFAULT 'pytorch',
    framework_version VARCHAR(50) NOT NULL DEFAULT '2.0',
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'creating',
    last_loaded_at TIMESTAMPTZ,
    last_unloaded_at TIMESTAMPTZ,
    load_time_ms INTEGER,
    
    -- Metrics
    requests_last_24h INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms INTEGER NOT NULL DEFAULT 0,
    error_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inference_components_tenant ON inference_components(tenant_id);
CREATE INDEX idx_inference_components_model ON inference_components(model_id);
CREATE INDEX idx_inference_components_endpoint ON inference_components(endpoint_name);
CREATE INDEX idx_inference_components_status ON inference_components(status);

COMMENT ON TABLE inference_components IS 'SageMaker Inference Components for efficient multi-model hosting';
COMMENT ON COLUMN inference_components.compute_units IS 'Compute resources allocated to this component';
COMMENT ON COLUMN inference_components.current_copies IS 'Number of model copies currently loaded';
COMMENT ON COLUMN inference_components.load_time_ms IS 'Average time to load model weights';

-- ============================================================================
-- 4. TIER ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tier_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Current and recommended tiers
    current_tier VARCHAR(20) NOT NULL DEFAULT 'cold',
    recommended_tier VARCHAR(20) NOT NULL DEFAULT 'cold',
    tier_reason TEXT,
    
    -- Usage metrics
    requests_last_24h INTEGER NOT NULL DEFAULT 0,
    requests_last_7d INTEGER NOT NULL DEFAULT 0,
    avg_daily_requests DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_request_at TIMESTAMPTZ,
    days_since_last_request DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Cost analysis
    current_monthly_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    projected_monthly_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    potential_savings DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Override (admin can force a tier)
    tier_override VARCHAR(20),
    override_reason TEXT,
    override_expires_at TIMESTAMPTZ,
    overridden_by VARCHAR(255),
    
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_current_tier CHECK (current_tier IN ('hot', 'warm', 'cold', 'off')),
    CONSTRAINT valid_recommended_tier CHECK (recommended_tier IN ('hot', 'warm', 'cold', 'off')),
    CONSTRAINT valid_tier_override CHECK (tier_override IS NULL OR tier_override IN ('hot', 'warm', 'cold', 'off'))
);

CREATE INDEX idx_tier_assignments_model ON tier_assignments(model_id);
CREATE INDEX idx_tier_assignments_current ON tier_assignments(current_tier);
CREATE INDEX idx_tier_assignments_recommended ON tier_assignments(recommended_tier);
CREATE INDEX idx_tier_assignments_savings ON tier_assignments(potential_savings DESC);

COMMENT ON TABLE tier_assignments IS 'Model hosting tier assignments based on usage patterns';
COMMENT ON COLUMN tier_assignments.current_tier IS 'hot=dedicated, warm=inference component, cold=serverless, off=not deployed';

-- ============================================================================
-- 5. TIER TRANSITIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tier_transitions (
    transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(255) NOT NULL,
    
    -- Transition details
    from_tier VARCHAR(20) NOT NULL,
    to_tier VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Rollback info
    can_rollback BOOLEAN NOT NULL DEFAULT true,
    rollback_deadline TIMESTAMPTZ,
    rolled_back_at TIMESTAMPTZ,
    
    CONSTRAINT valid_from_tier CHECK (from_tier IN ('hot', 'warm', 'cold', 'off')),
    CONSTRAINT valid_to_tier CHECK (to_tier IN ('hot', 'warm', 'cold', 'off')),
    CONSTRAINT valid_transition_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back'))
);

CREATE INDEX idx_tier_transitions_model ON tier_transitions(model_id);
CREATE INDEX idx_tier_transitions_status ON tier_transitions(status);
CREATE INDEX idx_tier_transitions_started ON tier_transitions(started_at DESC);

COMMENT ON TABLE tier_transitions IS 'History of tier changes for models';

-- ============================================================================
-- 6. COMPONENT LOAD EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_load_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES inference_components(component_id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    requester_user_id VARCHAR(255),
    reason TEXT,
    
    -- Result
    success BOOLEAN NOT NULL DEFAULT false,
    load_time_ms INTEGER,
    from_cache BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_event_type CHECK (event_type IN ('load', 'unload', 'preload', 'evict')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX idx_component_load_events_component ON component_load_events(component_id);
CREATE INDEX idx_component_load_events_model ON component_load_events(model_id);
CREATE INDEX idx_component_load_events_created ON component_load_events(created_at DESC);

COMMENT ON TABLE component_load_events IS 'History of model loading/unloading events';

-- ============================================================================
-- 7. INFERENCE COMPONENT EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS inference_component_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL,
    component_id UUID,
    model_id VARCHAR(255),
    endpoint_id UUID,
    
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ic_events_tenant ON inference_component_events(tenant_id);
CREATE INDEX idx_ic_events_type ON inference_component_events(event_type);
CREATE INDEX idx_ic_events_created ON inference_component_events(created_at DESC);

COMMENT ON TABLE inference_component_events IS 'Audit log of all inference component events';

-- ============================================================================
-- 8. ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE inference_components_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_inference_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE inference_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE inference_component_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ic_config ON inference_components_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_shared_endpoints ON shared_inference_endpoints
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_inference_components ON inference_components
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_ic_events ON inference_component_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 9. TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_inference_components_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ic_config_timestamp
    BEFORE UPDATE ON inference_components_config
    FOR EACH ROW EXECUTE FUNCTION update_inference_components_timestamp();

CREATE TRIGGER update_shared_endpoints_timestamp
    BEFORE UPDATE ON shared_inference_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_inference_components_timestamp();

CREATE TRIGGER update_inference_components_timestamp_trigger
    BEFORE UPDATE ON inference_components
    FOR EACH ROW EXECUTE FUNCTION update_inference_components_timestamp();

CREATE TRIGGER update_tier_assignments_timestamp
    BEFORE UPDATE ON tier_assignments
    FOR EACH ROW EXECUTE FUNCTION update_inference_components_timestamp();

-- ============================================================================
-- 10. AUTO-TIER NEW MODELS TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_tier_new_self_hosted_model()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process self-hosted models
    IF NEW.source = 'self_hosted' THEN
        -- Create default tier assignment (warm tier for new models)
        INSERT INTO tier_assignments (
            model_id,
            current_tier,
            recommended_tier,
            tier_reason,
            last_evaluated_at
        ) VALUES (
            NEW.model_id,
            'warm',
            'warm',
            'New self-hosted model auto-assigned to WARM tier',
            NOW()
        ) ON CONFLICT (model_id) DO NOTHING;
        
        -- Log the event
        INSERT INTO inference_component_events (
            tenant_id,
            event_type,
            model_id,
            details
        ) VALUES (
            NEW.tenant_id,
            'tier_changed',
            NEW.model_id,
            jsonb_build_object(
                'action', 'auto_tier_new_model',
                'assigned_tier', 'warm',
                'model_name', NEW.name
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to model registry if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'model_registry') THEN
        DROP TRIGGER IF EXISTS auto_tier_new_model_trigger ON model_registry;
        CREATE TRIGGER auto_tier_new_model_trigger
            AFTER INSERT ON model_registry
            FOR EACH ROW EXECUTE FUNCTION auto_tier_new_self_hosted_model();
    END IF;
END $$;

-- ============================================================================
-- 11. USAGE TRACKING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_model_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update tier assignment usage stats when usage_events are inserted
    UPDATE tier_assignments SET
        requests_last_24h = (
            SELECT COUNT(*) FROM usage_events 
            WHERE model_id = NEW.model_id 
            AND created_at > NOW() - INTERVAL '24 hours'
        ),
        requests_last_7d = (
            SELECT COUNT(*) FROM usage_events 
            WHERE model_id = NEW.model_id 
            AND created_at > NOW() - INTERVAL '7 days'
        ),
        last_request_at = NOW(),
        days_since_last_request = 0,
        updated_at = NOW()
    WHERE model_id = NEW.model_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to usage_events if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_events') THEN
        DROP TRIGGER IF EXISTS update_usage_stats_trigger ON usage_events;
        CREATE TRIGGER update_usage_stats_trigger
            AFTER INSERT ON usage_events
            FOR EACH ROW EXECUTE FUNCTION update_model_usage_stats();
    END IF;
END $$;

-- ============================================================================
-- 12. DEFAULT CONFIGURATIONS FOR EXISTING TENANTS
-- ============================================================================

INSERT INTO inference_components_config (
    tenant_id,
    enabled,
    auto_tiering_enabled,
    predictive_loading_enabled,
    fallback_to_external_enabled,
    tier_thresholds,
    default_instance_type,
    max_shared_endpoints,
    max_components_per_endpoint,
    default_load_timeout_ms,
    preload_window_minutes,
    unload_after_idle_minutes,
    alert_threshold_percent,
    notify_on_tier_change,
    notify_on_load_failure,
    notify_on_budget_alert
)
SELECT 
    id,
    true,
    true,
    true,
    true,
    '{"hotTierMinRequestsPerDay": 100, "warmTierMinRequestsPerDay": 10, "offTierInactiveDays": 30}'::jsonb,
    'ml.g5.xlarge',
    3,
    15,
    30000,
    15,
    30,
    80,
    true,
    true,
    true
FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM inference_components_config)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- 13. DEFAULT TIER ASSIGNMENTS FOR EXISTING SELF-HOSTED MODELS
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'model_registry') THEN
        INSERT INTO tier_assignments (
            model_id,
            current_tier,
            recommended_tier,
            tier_reason,
            last_evaluated_at
        )
        SELECT 
            model_id,
            'cold',
            'cold',
            'Existing model assigned to COLD tier pending usage evaluation',
            NOW()
        FROM model_registry
        WHERE source = 'self_hosted'
        AND model_id NOT IN (SELECT model_id FROM tier_assignments)
        ON CONFLICT (model_id) DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- 14. VIEWS FOR DASHBOARD
-- ============================================================================

CREATE OR REPLACE VIEW inference_components_dashboard AS
SELECT 
    icc.tenant_id,
    icc.enabled,
    icc.auto_tiering_enabled,
    
    -- Model counts by tier
    (SELECT COUNT(*) FROM tier_assignments ta 
     JOIN model_registry mr ON ta.model_id = mr.model_id 
     WHERE mr.tenant_id = icc.tenant_id AND ta.current_tier = 'hot') as hot_tier_count,
    (SELECT COUNT(*) FROM tier_assignments ta 
     JOIN model_registry mr ON ta.model_id = mr.model_id 
     WHERE mr.tenant_id = icc.tenant_id AND ta.current_tier = 'warm') as warm_tier_count,
    (SELECT COUNT(*) FROM tier_assignments ta 
     JOIN model_registry mr ON ta.model_id = mr.model_id 
     WHERE mr.tenant_id = icc.tenant_id AND ta.current_tier = 'cold') as cold_tier_count,
    (SELECT COUNT(*) FROM tier_assignments ta 
     JOIN model_registry mr ON ta.model_id = mr.model_id 
     WHERE mr.tenant_id = icc.tenant_id AND ta.current_tier = 'off') as off_tier_count,
    
    -- Endpoint stats
    (SELECT COUNT(*) FROM shared_inference_endpoints WHERE tenant_id = icc.tenant_id) as endpoint_count,
    (SELECT COALESCE(SUM(total_compute_units), 0) FROM shared_inference_endpoints WHERE tenant_id = icc.tenant_id) as total_compute_units,
    (SELECT COALESCE(SUM(allocated_compute_units), 0) FROM shared_inference_endpoints WHERE tenant_id = icc.tenant_id) as allocated_compute_units,
    
    -- Component stats
    (SELECT COUNT(*) FROM inference_components WHERE tenant_id = icc.tenant_id) as component_count,
    (SELECT COUNT(*) FROM inference_components WHERE tenant_id = icc.tenant_id AND status = 'in_service') as active_component_count,
    
    -- Cost stats
    (SELECT COALESCE(SUM(hourly_base_cost), 0) * 24 * 30 FROM shared_inference_endpoints WHERE tenant_id = icc.tenant_id) as estimated_monthly_cost,
    
    -- Potential savings
    (SELECT COALESCE(SUM(potential_savings), 0) FROM tier_assignments ta 
     JOIN model_registry mr ON ta.model_id = mr.model_id 
     WHERE mr.tenant_id = icc.tenant_id) as total_potential_savings
    
FROM inference_components_config icc;

COMMENT ON VIEW inference_components_dashboard IS 'Aggregated dashboard view for inference components per tenant';

-- ============================================================================
-- 15. COST TRACKING VIEW
-- ============================================================================

CREATE OR REPLACE VIEW inference_components_cost_summary AS
SELECT 
    se.tenant_id,
    se.endpoint_name,
    se.instance_type,
    se.instance_count,
    se.hourly_base_cost,
    se.hourly_base_cost * 24 as daily_cost,
    se.hourly_base_cost * 24 * 30 as monthly_cost,
    se.component_count,
    CASE WHEN se.component_count > 0 
         THEN (se.hourly_base_cost * 24 * 30) / se.component_count 
         ELSE 0 
    END as cost_per_component_monthly,
    se.total_compute_units,
    se.allocated_compute_units,
    CASE WHEN se.total_compute_units > 0 
         THEN (se.allocated_compute_units::decimal / se.total_compute_units) * 100 
         ELSE 0 
    END as utilization_percent
FROM shared_inference_endpoints se
WHERE se.status = 'in_service';

COMMENT ON VIEW inference_components_cost_summary IS 'Cost breakdown per shared endpoint';
