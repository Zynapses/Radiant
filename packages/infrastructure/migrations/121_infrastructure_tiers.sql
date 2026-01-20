-- Migration: 121_infrastructure_tiers
-- Description: Infrastructure tier configuration system for RADIANT
-- 
-- This creates the database tables for managing admin-configurable
-- infrastructure tiers (DEV, STAGING, PRODUCTION) with full audit trail.

-- ============================================================================
-- Infrastructure Tier State
-- ============================================================================

CREATE TABLE IF NOT EXISTS infrastructure_tier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Current state
    current_tier VARCHAR(20) NOT NULL DEFAULT 'DEV' CHECK (current_tier IN ('DEV', 'STAGING', 'PRODUCTION', 'CUSTOM')),
    target_tier VARCHAR(20) DEFAULT NULL,
    transition_status VARCHAR(20) NOT NULL DEFAULT 'STABLE' CHECK (transition_status IN ('STABLE', 'SCALING_UP', 'SCALING_DOWN', 'FAILED', 'ROLLING_BACK')),
    
    -- Step Functions execution tracking
    transition_execution_arn TEXT,
    transition_started_at TIMESTAMPTZ,
    transition_completed_at TIMESTAMPTZ,
    
    -- Safety
    cooldown_hours INTEGER NOT NULL DEFAULT 24,
    next_change_allowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Cost tracking
    estimated_monthly_cost DECIMAL(12, 2) NOT NULL DEFAULT 350.00,
    actual_mtd_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Metadata
    last_changed_by TEXT,
    last_changed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- Index for lookups
CREATE INDEX idx_infrastructure_tier_tenant ON infrastructure_tier(tenant_id);
CREATE INDEX idx_infrastructure_tier_status ON infrastructure_tier(transition_status);

-- ============================================================================
-- Tier Configuration Templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS tier_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Tier identification
    tier_name VARCHAR(20) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Cost estimate
    estimated_monthly_cost DECIMAL(12, 2) NOT NULL,
    
    -- SageMaker configuration
    sagemaker_shadow_self_instance_type VARCHAR(50) NOT NULL DEFAULT 'ml.g5.xlarge',
    sagemaker_shadow_self_min_instances INTEGER NOT NULL DEFAULT 0,
    sagemaker_shadow_self_max_instances INTEGER NOT NULL DEFAULT 1,
    sagemaker_shadow_self_scale_to_zero BOOLEAN NOT NULL DEFAULT TRUE,
    sagemaker_shadow_self_scale_in_cooldown INTEGER NOT NULL DEFAULT 60,
    sagemaker_nli_deployment VARCHAR(50) NOT NULL DEFAULT 'shared_mme',
    
    -- Bedrock configuration
    bedrock_provisioned_throughput BOOLEAN NOT NULL DEFAULT FALSE,
    bedrock_model_units INTEGER NOT NULL DEFAULT 0,
    bedrock_default_model VARCHAR(100) NOT NULL DEFAULT 'claude-3-haiku',
    bedrock_fallback_model VARCHAR(100) DEFAULT 'claude-3-5-sonnet',
    
    -- OpenSearch configuration
    opensearch_type VARCHAR(20) NOT NULL DEFAULT 'provisioned' CHECK (opensearch_type IN ('provisioned', 'serverless')),
    opensearch_instance_type VARCHAR(50) DEFAULT 't3.small.search',
    opensearch_instance_count INTEGER DEFAULT 1,
    opensearch_ebs_volume_size INTEGER DEFAULT 10,
    opensearch_min_ocus INTEGER DEFAULT NULL,
    opensearch_max_ocus INTEGER DEFAULT NULL,
    
    -- DynamoDB configuration
    dynamodb_billing_mode VARCHAR(20) NOT NULL DEFAULT 'PAY_PER_REQUEST',
    dynamodb_regions TEXT[] NOT NULL DEFAULT ARRAY['us-east-1'],
    dynamodb_global_tables BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- ElastiCache configuration
    elasticache_type VARCHAR(20) NOT NULL DEFAULT 'serverless' CHECK (elasticache_type IN ('serverless', 'provisioned')),
    elasticache_node_type VARCHAR(50) DEFAULT NULL,
    elasticache_num_cache_nodes INTEGER DEFAULT NULL,
    elasticache_min_ecpu INTEGER DEFAULT 1000,
    elasticache_max_ecpu INTEGER DEFAULT 5000,
    elasticache_cluster_mode BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Neptune configuration
    neptune_type VARCHAR(20) NOT NULL DEFAULT 'serverless' CHECK (neptune_type IN ('serverless', 'provisioned')),
    neptune_instance_class VARCHAR(50) DEFAULT NULL,
    neptune_instance_count INTEGER DEFAULT NULL,
    neptune_min_capacity DECIMAL(4, 1) DEFAULT 1.0,
    neptune_max_capacity DECIMAL(4, 1) DEFAULT 2.5,
    
    -- Kinesis configuration
    kinesis_capacity_mode VARCHAR(20) NOT NULL DEFAULT 'ON_DEMAND' CHECK (kinesis_capacity_mode IN ('ON_DEMAND', 'PROVISIONED')),
    kinesis_shard_count INTEGER DEFAULT NULL,
    
    -- Step Functions configuration
    step_functions_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD' CHECK (step_functions_type IN ('STANDARD', 'EXPRESS')),
    
    -- Budget configuration
    budget_monthly_curiosity_limit DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
    budget_daily_exploration_cap DECIMAL(10, 2) NOT NULL DEFAULT 3.00,
    
    -- Features and limitations (JSON for flexibility)
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Metadata
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, tier_name)
);

-- Index for tier lookups
CREATE INDEX idx_tier_config_tenant ON tier_config(tenant_id);
CREATE INDEX idx_tier_config_name ON tier_config(tier_name);

-- ============================================================================
-- Tier Change Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS tier_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Change details
    from_tier VARCHAR(20) NOT NULL,
    to_tier VARCHAR(20) NOT NULL,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('SCALING_UP', 'SCALING_DOWN')),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ROLLED_BACK')),
    
    -- Execution
    execution_arn TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Actor
    changed_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    bypassed_cooldown BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Results
    resources_provisioned JSONB DEFAULT '[]'::jsonb,
    resources_cleaned_up JSONB DEFAULT '[]'::jsonb,
    errors JSONB DEFAULT '[]'::jsonb,
    
    -- Cost impact
    estimated_cost_change DECIMAL(12, 2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX idx_tier_change_log_tenant ON tier_change_log(tenant_id);
CREATE INDEX idx_tier_change_log_status ON tier_change_log(status);
CREATE INDEX idx_tier_change_log_date ON tier_change_log(created_at DESC);

-- ============================================================================
-- Resource Inventory (tracks what's provisioned)
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Resource identification
    resource_type VARCHAR(50) NOT NULL,
    resource_id TEXT NOT NULL,
    resource_arn TEXT,
    resource_name TEXT,
    
    -- State
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PROVISIONING', 'ACTIVE', 'DELETING', 'DELETED', 'FAILED')),
    tier VARCHAR(20) NOT NULL,
    
    -- Configuration snapshot
    config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Cost
    hourly_cost DECIMAL(10, 4) DEFAULT 0,
    
    -- Metadata
    provisioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, resource_type, resource_id)
);

-- Index for resource lookups
CREATE INDEX idx_resource_inventory_tenant ON resource_inventory(tenant_id);
CREATE INDEX idx_resource_inventory_type ON resource_inventory(resource_type);
CREATE INDEX idx_resource_inventory_status ON resource_inventory(status);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE infrastructure_tier ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_inventory ENABLE ROW LEVEL SECURITY;

-- Policies for tenant isolation
CREATE POLICY infrastructure_tier_tenant_policy ON infrastructure_tier
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tier_config_tenant_policy ON tier_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tier_change_log_tenant_policy ON tier_change_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY resource_inventory_tenant_policy ON resource_inventory
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Default Tier Configurations Function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_tier_configs(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    -- DEV Tier (~$350/month)
    INSERT INTO tier_config (
        tenant_id, tier_name, display_name, description, is_default,
        estimated_monthly_cost,
        sagemaker_shadow_self_instance_type, sagemaker_shadow_self_min_instances,
        sagemaker_shadow_self_max_instances, sagemaker_shadow_self_scale_to_zero,
        sagemaker_nli_deployment,
        bedrock_default_model, bedrock_fallback_model,
        opensearch_type, opensearch_instance_type, opensearch_instance_count, opensearch_ebs_volume_size,
        elasticache_type, elasticache_min_ecpu, elasticache_max_ecpu,
        neptune_type, neptune_min_capacity, neptune_max_capacity,
        kinesis_capacity_mode, step_functions_type,
        budget_monthly_curiosity_limit, budget_daily_exploration_cap,
        features, limitations
    ) VALUES (
        p_tenant_id, 'DEV', 'Development', 'Minimal resources for development and testing. Scale-to-zero when idle.', TRUE,
        350.00,
        'ml.g5.xlarge', 0, 1, TRUE, 'shared_mme',
        'claude-3-haiku', 'claude-3-5-sonnet',
        'provisioned', 't3.small.search', 1, 10,
        'serverless', 1000, 5000,
        'serverless', 1.0, 2.5,
        'ON_DEMAND', 'STANDARD',
        100.00, 3.00,
        '["SageMaker scale-to-zero", "OpenSearch Provisioned (t3.small)", "Single region", "On-demand pricing"]'::jsonb,
        '["Cold start latency (~30s for Shadow Self)", "Limited throughput", "No multi-region"]'::jsonb
    ) ON CONFLICT (tenant_id, tier_name) DO NOTHING;
    
    -- STAGING Tier (~$35K/month)
    INSERT INTO tier_config (
        tenant_id, tier_name, display_name, description, is_default,
        estimated_monthly_cost,
        sagemaker_shadow_self_instance_type, sagemaker_shadow_self_min_instances,
        sagemaker_shadow_self_max_instances, sagemaker_shadow_self_scale_to_zero,
        sagemaker_nli_deployment,
        bedrock_default_model,
        opensearch_type, opensearch_instance_type, opensearch_instance_count, opensearch_ebs_volume_size,
        elasticache_type, elasticache_node_type, elasticache_num_cache_nodes,
        neptune_type, neptune_min_capacity, neptune_max_capacity,
        kinesis_capacity_mode, kinesis_shard_count, step_functions_type,
        budget_monthly_curiosity_limit, budget_daily_exploration_cap,
        features, limitations
    ) VALUES (
        p_tenant_id, 'STAGING', 'Staging', 'Pre-production environment for load testing and validation.', FALSE,
        35000.00,
        'ml.g5.2xlarge', 2, 20, FALSE, 'dedicated_mme',
        'claude-3-5-sonnet',
        'provisioned', 'r6g.large.search', 3, 100,
        'provisioned', 'cache.r7g.large', 2,
        'serverless', 2.5, 16.0,
        'PROVISIONED', 5, 'EXPRESS',
        5000.00, 150.00,
        '["Always-on SageMaker (2-20 instances)", "OpenSearch Provisioned (r6g.large)", "Single region", "Moderate throughput"]'::jsonb,
        '["No multi-region", "Not for production traffic"]'::jsonb
    ) ON CONFLICT (tenant_id, tier_name) DO NOTHING;
    
    -- PRODUCTION Tier (~$750K/month)
    INSERT INTO tier_config (
        tenant_id, tier_name, display_name, description, is_default,
        estimated_monthly_cost,
        sagemaker_shadow_self_instance_type, sagemaker_shadow_self_min_instances,
        sagemaker_shadow_self_max_instances, sagemaker_shadow_self_scale_to_zero,
        sagemaker_nli_deployment,
        bedrock_provisioned_throughput, bedrock_model_units, bedrock_default_model,
        opensearch_type, opensearch_min_ocus, opensearch_max_ocus,
        dynamodb_regions, dynamodb_global_tables,
        elasticache_type, elasticache_node_type, elasticache_num_cache_nodes, elasticache_cluster_mode,
        neptune_type, neptune_instance_class, neptune_instance_count,
        kinesis_capacity_mode, kinesis_shard_count, step_functions_type,
        budget_monthly_curiosity_limit, budget_daily_exploration_cap,
        features, limitations
    ) VALUES (
        p_tenant_id, 'PRODUCTION', 'Production', 'Full-scale production for 10MM+ users.', FALSE,
        750000.00,
        'ml.g5.2xlarge', 50, 300, FALSE, 'dedicated_cluster',
        TRUE, 5, 'claude-3-5-sonnet',
        'serverless', 50, 500,
        ARRAY['us-east-1', 'eu-west-1', 'ap-northeast-1'], TRUE,
        'provisioned', 'cache.r7g.xlarge', 6, TRUE,
        'provisioned', 'db.r6g.2xlarge', 3,
        'PROVISIONED', 20, 'EXPRESS',
        50000.00, 1500.00,
        '["SageMaker (50-300 instances)", "OpenSearch Serverless (auto-scale)", "Multi-region (3 regions)", "DynamoDB Global Tables", "Provisioned throughput"]'::jsonb,
        '[]'::jsonb
    ) ON CONFLICT (tenant_id, tier_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger to create default configs for new tenants
-- ============================================================================

CREATE OR REPLACE FUNCTION on_tenant_created_create_tier_configs()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_tier_configs(NEW.id);
    
    -- Also create initial tier state
    INSERT INTO infrastructure_tier (tenant_id, current_tier, estimated_monthly_cost)
    VALUES (NEW.id, 'DEV', 350.00)
    ON CONFLICT (tenant_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Attach this trigger to your tenants table
-- CREATE TRIGGER trigger_create_tier_configs
--     AFTER INSERT ON tenants
--     FOR EACH ROW EXECUTE FUNCTION on_tenant_created_create_tier_configs();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE infrastructure_tier IS 'Current infrastructure tier state per tenant';
COMMENT ON TABLE tier_config IS 'Tier configuration templates (admin-editable)';
COMMENT ON TABLE tier_change_log IS 'Audit log of all tier changes';
COMMENT ON TABLE resource_inventory IS 'Inventory of provisioned resources per tier';
