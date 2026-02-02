-- RADIANT Neural Operations Center
-- Database schema for CORTEX network monitoring, shadow validation, and regional thermal state
-- Version: 6.0.0
-- Date: 2026-02-01

-- =============================================================================
-- CORTEX Network Status
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_network_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'offline', 'shadow')),
    parameters INTEGER NOT NULL DEFAULT 0,
    requests_per_second DECIMAL(12, 2) DEFAULT 0,
    latency_p50_ms DECIMAL(10, 4) DEFAULT 0,
    latency_p99_ms DECIMAL(10, 4) DEFAULT 0,
    error_rate DECIMAL(10, 8) DEFAULT 0,
    region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    last_deployed_at TIMESTAMPTZ,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_cortex_network_region UNIQUE (network_id, region)
);

CREATE INDEX idx_cortex_network_status_network ON cortex_network_status(network_id);
CREATE INDEX idx_cortex_network_status_region ON cortex_network_status(region);
CREATE INDEX idx_cortex_network_status_status ON cortex_network_status(status);

COMMENT ON TABLE cortex_network_status IS 'Current status of CORTEX neural networks';
COMMENT ON COLUMN cortex_network_status.network_id IS 'Network identifier: pattern, routing, topology, clarion, combination, user';
COMMENT ON COLUMN cortex_network_status.parameters IS 'Number of parameters in the network';
COMMENT ON COLUMN cortex_network_status.error_rate IS 'Current error rate as decimal (0.0001 = 0.01%)';

-- =============================================================================
-- CORTEX Network Metrics (Time Series)
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_network_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id VARCHAR(50) NOT NULL,
    region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_latency_ms DECIMAL(10, 4) DEFAULT 0,
    p50_latency_ms DECIMAL(10, 4) DEFAULT 0,
    p99_latency_ms DECIMAL(10, 4) DEFAULT 0,
    memory_usage_mb DECIMAL(10, 2) DEFAULT 0,
    cpu_utilization DECIMAL(5, 4) DEFAULT 0
);

CREATE INDEX idx_cortex_network_metrics_network ON cortex_network_metrics(network_id);
CREATE INDEX idx_cortex_network_metrics_timestamp ON cortex_network_metrics(timestamp);
CREATE INDEX idx_cortex_network_metrics_network_time ON cortex_network_metrics(network_id, timestamp DESC);

-- Partition by time for efficient querying (optional, depends on volume)
COMMENT ON TABLE cortex_network_metrics IS 'Time-series metrics for CORTEX networks';

-- =============================================================================
-- Shadow Validations
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_shadow_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id VARCHAR(50) NOT NULL,
    current_version VARCHAR(50) NOT NULL,
    candidate_version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'aborted')),
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    estimated_end_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    duration_minutes INTEGER DEFAULT 60,
    
    -- Metrics
    error_rate DECIMAL(10, 8) DEFAULT 0,
    latency_delta_ms DECIMAL(10, 4) DEFAULT 0,
    divergence_percent DECIMAL(5, 4) DEFAULT 0,
    memory_overhead_percent DECIMAL(5, 4) DEFAULT 0,
    
    -- Warnings and abort info
    warnings JSONB DEFAULT '[]'::jsonb,
    abort_reason TEXT,
    aborted_by VARCHAR(255),
    aborted_at TIMESTAMPTZ,
    
    -- Audit
    created_by VARCHAR(255) DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shadow_validations_network ON cortex_shadow_validations(network_id);
CREATE INDEX idx_shadow_validations_status ON cortex_shadow_validations(status);
CREATE INDEX idx_shadow_validations_active ON cortex_shadow_validations(status) WHERE status IN ('pending', 'running');

COMMENT ON TABLE cortex_shadow_validations IS 'Shadow validation sessions for CORTEX network updates';
COMMENT ON COLUMN cortex_shadow_validations.error_rate IS 'Shadow error rate - threshold >0.1% = FAIL';
COMMENT ON COLUMN cortex_shadow_validations.latency_delta_ms IS 'Latency increase - threshold >+50ms = WARN';
COMMENT ON COLUMN cortex_shadow_validations.divergence_percent IS 'Output divergence - threshold >15% = WARN';

-- =============================================================================
-- Network Deployments
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_network_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    previous_version VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'promoted', 'rejected', 'rolled_back')),
    region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    shadow_validation_id UUID REFERENCES cortex_shadow_validations(id),
    
    -- Deployment details
    deployed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deployed_by VARCHAR(255) DEFAULT 'system',
    rollback_reason TEXT,
    rollback_at TIMESTAMPTZ,
    rollback_by VARCHAR(255),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_network_deployments_network ON cortex_network_deployments(network_id);
CREATE INDEX idx_network_deployments_status ON cortex_network_deployments(status);
CREATE INDEX idx_network_deployments_deployed ON cortex_network_deployments(deployed_at DESC);

COMMENT ON TABLE cortex_network_deployments IS 'Deployment history for CORTEX networks';

-- =============================================================================
-- Regional Status
-- =============================================================================

CREATE TABLE IF NOT EXISTS neural_region_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id VARCHAR(50) NOT NULL UNIQUE,
    region_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'degraded', 'offline')),
    thermal_state VARCHAR(20) NOT NULL DEFAULT 'cold' CHECK (thermal_state IN ('cold', 'warming', 'warm', 'hot')),
    
    -- Active cartridge
    cartridge_id VARCHAR(255),
    cartridge_name VARCHAR(255),
    cartridge_version VARCHAR(50),
    
    -- Network status summary
    networks_active INTEGER DEFAULT 0,
    networks_degraded INTEGER DEFAULT 0,
    networks_offline INTEGER DEFAULT 0,
    
    -- Metrics
    latency_ms DECIMAL(10, 2) DEFAULT 0,
    requests_per_second DECIMAL(12, 2) DEFAULT 0,
    
    -- Health
    last_health_check TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    health_check_failures INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_neural_region_status_thermal ON neural_region_status(thermal_state);
CREATE INDEX idx_neural_region_status_status ON neural_region_status(status);

COMMENT ON TABLE neural_region_status IS 'Status and thermal state for each AWS region';

-- =============================================================================
-- Thermal State Overrides
-- =============================================================================

CREATE TABLE IF NOT EXISTS neural_thermal_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id VARCHAR(50) NOT NULL UNIQUE,
    target_state VARCHAR(20) NOT NULL CHECK (target_state IN ('cold', 'warming', 'warm', 'hot')),
    reason TEXT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    auto_revert BOOLEAN DEFAULT true,
    reverted_at TIMESTAMPTZ,
    
    CONSTRAINT fk_thermal_override_region FOREIGN KEY (region_id) 
        REFERENCES neural_region_status(region_id) ON DELETE CASCADE
);

CREATE INDEX idx_thermal_overrides_active ON neural_thermal_overrides(region_id) 
    WHERE reverted_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

COMMENT ON TABLE neural_thermal_overrides IS 'Manual thermal state overrides for regions';

-- =============================================================================
-- Neural Alerts
-- =============================================================================

CREATE TABLE IF NOT EXISTS neural_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    network_id VARCHAR(50),
    region_id VARCHAR(50),
    
    -- Acknowledgment
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_neural_alerts_severity ON neural_alerts(severity);
CREATE INDEX idx_neural_alerts_unacknowledged ON neural_alerts(created_at DESC) WHERE acknowledged = false;
CREATE INDEX idx_neural_alerts_network ON neural_alerts(network_id) WHERE network_id IS NOT NULL;
CREATE INDEX idx_neural_alerts_region ON neural_alerts(region_id) WHERE region_id IS NOT NULL;

COMMENT ON TABLE neural_alerts IS 'Alerts for neural operations monitoring';

-- =============================================================================
-- Seed Default Region Data
-- =============================================================================

INSERT INTO neural_region_status (region_id, region_name, status, thermal_state, networks_active)
VALUES 
    ('us-east-1', 'US East (N. Virginia)', 'online', 'warm', 6),
    ('eu-central-1', 'EU (Frankfurt)', 'online', 'warm', 6),
    ('ap-northeast-1', 'Asia Pacific (Tokyo)', 'online', 'cold', 6)
ON CONFLICT (region_id) DO NOTHING;

-- =============================================================================
-- Seed Default Network Status
-- =============================================================================

INSERT INTO cortex_network_status (network_id, version, status, parameters, region)
VALUES 
    ('pattern', 'v1.0.0', 'active', 1200000, 'us-east-1'),
    ('routing', 'v1.0.0', 'active', 200000, 'us-east-1'),
    ('topology', 'v1.0.0', 'active', 800000, 'us-east-1'),
    ('clarion', 'v1.0.0', 'active', 200000, 'us-east-1'),
    ('combination', 'v1.0.0', 'active', 50000, 'us-east-1'),
    ('user', 'v1.0.0', 'active', 50000, 'us-east-1')
ON CONFLICT (network_id, region) DO NOTHING;
