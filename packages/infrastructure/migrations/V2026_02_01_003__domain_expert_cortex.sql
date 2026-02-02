-- RADIANT Domain Expert Cortex
-- Database schema for 7 specialized neural networks per domain
-- Version: 6.0.0
-- Date: 2026-02-01

-- =============================================================================
-- Domain Expert Configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS domain_expert_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    domain_id VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    
    -- Domain flags
    is_training_domain BOOLEAN DEFAULT false,        -- Shows "Example Domain" badge
    enabled BOOLEAN DEFAULT true,
    
    -- Entity configuration
    num_entities INTEGER DEFAULT 0,
    num_actions INTEGER DEFAULT 0,
    num_protocols INTEGER DEFAULT 0,
    
    -- Safety configuration
    safety_threshold DECIMAL(3, 2) DEFAULT 0.50 CHECK (safety_threshold >= 0 AND safety_threshold <= 1),
    citation_required BOOLEAN DEFAULT false,
    
    -- Model preferences
    default_models JSONB DEFAULT '[]'::jsonb,
    safety_model VARCHAR(255),
    
    -- Network overrides
    network_overrides JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    
    CONSTRAINT uq_domain_expert_config UNIQUE (tenant_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_domain_expert_configs_tenant ON domain_expert_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_expert_configs_domain ON domain_expert_configs(tenant_id, domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_expert_configs_training ON domain_expert_configs(tenant_id) WHERE is_training_domain = true;

-- RLS Policy
ALTER TABLE domain_expert_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY domain_expert_configs_tenant_isolation ON domain_expert_configs
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE domain_expert_configs IS 'Configuration for domain expert networks';
COMMENT ON COLUMN domain_expert_configs.is_training_domain IS 'If true, shows "Example Domain" badge in UI';
COMMENT ON COLUMN domain_expert_configs.safety_threshold IS 'Minimum confidence for safety-critical decisions (0.0-1.0)';

-- =============================================================================
-- Domain Expert Networks
-- =============================================================================

CREATE TABLE IF NOT EXISTS domain_expert_networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    domain_id VARCHAR(100) NOT NULL,
    network_type VARCHAR(50) NOT NULL CHECK (network_type IN (
        'entity_classifier',
        'contraindication_net',
        'protocol_matcher',
        'severity_assessor',
        'personalization_net',
        'citation_network',
        'orchestration_selector'
    )),
    
    -- Version and status
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'training', 'validating', 'inactive', 'failed')),
    
    -- Network parameters
    parameters INTEGER DEFAULT 4000000,              -- ~4M per network
    input_dim INTEGER NOT NULL,
    output_dim INTEGER NOT NULL,
    
    -- Storage
    storage_key VARCHAR(500),
    storage_bucket VARCHAR(255),
    file_size_bytes BIGINT DEFAULT 0,
    checksum VARCHAR(64),
    
    -- Performance metrics
    latency_p50_ms DECIMAL(10, 4) DEFAULT 0,
    latency_p99_ms DECIMAL(10, 4) DEFAULT 0,
    error_rate DECIMAL(10, 8) DEFAULT 0,
    requests_per_second DECIMAL(12, 2) DEFAULT 0,
    
    -- Training info
    trained_at TIMESTAMPTZ,
    trained_by VARCHAR(255),
    training_dataset_id UUID,
    training_metrics JSONB,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deployed_at TIMESTAMPTZ,
    deployed_by VARCHAR(255),
    
    CONSTRAINT uq_domain_expert_network UNIQUE (tenant_id, domain_id, network_type)
);

CREATE INDEX IF NOT EXISTS idx_domain_expert_networks_tenant ON domain_expert_networks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_expert_networks_domain ON domain_expert_networks(tenant_id, domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_expert_networks_type ON domain_expert_networks(network_type);
CREATE INDEX IF NOT EXISTS idx_domain_expert_networks_status ON domain_expert_networks(status);
CREATE INDEX IF NOT EXISTS idx_domain_expert_networks_active ON domain_expert_networks(tenant_id, domain_id) WHERE status = 'active';

-- RLS Policy
ALTER TABLE domain_expert_networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY domain_expert_networks_tenant_isolation ON domain_expert_networks
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE domain_expert_networks IS '7 specialized neural networks per domain';
COMMENT ON COLUMN domain_expert_networks.network_type IS 'One of: entity_classifier, contraindication_net, protocol_matcher, severity_assessor, personalization_net, citation_network, orchestration_selector';
COMMENT ON COLUMN domain_expert_networks.parameters IS 'Number of parameters in the network (~4M each)';

-- =============================================================================
-- Training Jobs
-- =============================================================================

CREATE TABLE IF NOT EXISTS domain_expert_training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    domain_id VARCHAR(100) NOT NULL,
    network_type VARCHAR(50) NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'training', 'validating', 'completed', 'failed')),
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    current_epoch INTEGER DEFAULT 0,
    total_epochs INTEGER DEFAULT 100,
    
    -- Configuration
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Dataset
    dataset_id UUID NOT NULL,
    dataset_size INTEGER DEFAULT 0,
    train_split DECIMAL(3, 2) DEFAULT 0.80,
    validation_split DECIMAL(3, 2) DEFAULT 0.20,
    
    -- Metrics
    metrics JSONB,
    
    -- Output
    output_network_id UUID REFERENCES domain_expert_networks(id),
    output_version VARCHAR(50),
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_time_remaining INTEGER,                 -- Seconds
    
    -- Error
    error TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_tenant ON domain_expert_training_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON domain_expert_training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_active ON domain_expert_training_jobs(tenant_id) WHERE status IN ('pending', 'preparing', 'training', 'validating');
CREATE INDEX IF NOT EXISTS idx_training_jobs_recent ON domain_expert_training_jobs(tenant_id, created_at DESC);

COMMENT ON TABLE domain_expert_training_jobs IS 'Training job tracking for domain expert networks';

-- =============================================================================
-- Inference Metrics (Time Series)
-- =============================================================================

CREATE TABLE IF NOT EXISTS domain_expert_inference_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    domain_id VARCHAR(100) NOT NULL,
    network_type VARCHAR(50) NOT NULL,
    
    -- Metrics
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_latency_ms DECIMAL(10, 4) DEFAULT 0,
    avg_confidence DECIMAL(5, 4) DEFAULT 0,
    
    -- Aggregation period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inference_metrics_tenant ON domain_expert_inference_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inference_metrics_time ON domain_expert_inference_metrics(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inference_metrics_network ON domain_expert_inference_metrics(tenant_id, domain_id, network_type, timestamp DESC);

COMMENT ON TABLE domain_expert_inference_metrics IS 'Time-series metrics for domain expert inference';

-- =============================================================================
-- Seed Predefined Domains (for all tenants - use trigger or application logic)
-- =============================================================================

-- Note: Actual seeding should be done per-tenant when tenant is created
-- This is a reference for the predefined domains

COMMENT ON TABLE domain_expert_configs IS '
Predefined domains (seed per tenant):
- healthcare: 50K entities, 1K actions, 500 protocols, safety=0.95, citations required
- legal: 30K entities, 500 actions, 200 protocols, safety=0.90, citations required
- finance: 25K entities, 800 actions, 300 protocols, safety=0.85, citations required
- fitness: 5K entities, 200 actions, 100 protocols, safety=0.70 (training domain)
- education: 10K entities, 300 actions, 150 protocols, safety=0.60
- technology: 15K entities, 400 actions, 100 protocols, safety=0.50
';

-- =============================================================================
-- Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_domain_expert_suite(
    p_tenant_id UUID,
    p_domain_id VARCHAR(100)
) RETURNS TABLE (
    domain_id VARCHAR(100),
    display_name VARCHAR(255),
    is_training_domain BOOLEAN,
    network_type VARCHAR(50),
    network_status VARCHAR(20),
    network_version VARCHAR(50),
    network_parameters INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.domain_id,
        c.display_name,
        c.is_training_domain,
        n.network_type,
        n.status,
        n.version,
        n.parameters
    FROM domain_expert_configs c
    LEFT JOIN domain_expert_networks n 
        ON n.tenant_id = c.tenant_id 
        AND n.domain_id = c.domain_id
    WHERE c.tenant_id = p_tenant_id
      AND c.domain_id = p_domain_id
    ORDER BY n.network_type;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION count_domain_expert_completeness(
    p_tenant_id UUID,
    p_domain_id VARCHAR(100)
) RETURNS INTEGER AS $$
DECLARE
    active_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_count
    FROM domain_expert_networks
    WHERE tenant_id = p_tenant_id
      AND domain_id = p_domain_id
      AND status = 'active';
    
    RETURN ROUND((active_count::DECIMAL / 7) * 100);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_domain_expert_suite IS 'Get all networks for a domain expert suite';
COMMENT ON FUNCTION count_domain_expert_completeness IS 'Calculate percentage of 7 networks deployed for a domain';
