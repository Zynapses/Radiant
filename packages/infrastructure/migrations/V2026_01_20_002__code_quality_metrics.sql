-- ============================================================================
-- RADIANT v5.30.0 - Code Quality & Test Coverage Metrics
-- ============================================================================
-- Tracks test coverage, code quality metrics, and technical debt for 
-- visibility in admin dashboards and reporting
-- ============================================================================

-- ============================================================================
-- 1. Test Coverage Snapshots
-- ============================================================================

CREATE TABLE IF NOT EXISTS code_quality_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Snapshot metadata
    snapshot_type VARCHAR(50) NOT NULL CHECK (snapshot_type IN ('test_coverage', 'code_quality', 'technical_debt', 'json_safety')),
    component VARCHAR(100) NOT NULL, -- 'lambda', 'admin-dashboard', 'thinktank-admin', 'swift-deployer', 'gateway'
    
    -- Test coverage metrics
    total_files INTEGER,
    files_with_tests INTEGER,
    total_lines INTEGER,
    covered_lines INTEGER,
    total_functions INTEGER,
    covered_functions INTEGER,
    total_branches INTEGER,
    covered_branches INTEGER,
    
    -- Calculated coverage percentages
    line_coverage DECIMAL(5,2),
    function_coverage DECIMAL(5,2),
    branch_coverage DECIMAL(5,2),
    overall_coverage DECIMAL(5,2),
    
    -- Code quality metrics
    eslint_errors INTEGER DEFAULT 0,
    eslint_warnings INTEGER DEFAULT 0,
    typescript_errors INTEGER DEFAULT 0,
    
    -- Technical debt metrics
    todo_count INTEGER DEFAULT 0,
    fixme_count INTEGER DEFAULT 0,
    any_type_count INTEGER DEFAULT 0,
    unsafe_json_parse_count INTEGER DEFAULT 0,
    
    -- JSON safety migration progress
    safe_json_calls INTEGER DEFAULT 0,
    unsafe_json_calls INTEGER DEFAULT 0,
    json_safety_percentage DECIMAL(5,2),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_code_quality_snapshots_tenant ON code_quality_snapshots(tenant_id);
CREATE INDEX idx_code_quality_snapshots_type ON code_quality_snapshots(snapshot_type);
CREATE INDEX idx_code_quality_snapshots_component ON code_quality_snapshots(component);
CREATE INDEX idx_code_quality_snapshots_captured ON code_quality_snapshots(captured_at DESC);

-- ============================================================================
-- 2. Test File Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_file_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- File identification
    file_path VARCHAR(500) NOT NULL,
    component VARCHAR(100) NOT NULL,
    
    -- Test status
    has_tests BOOLEAN DEFAULT FALSE,
    test_file_path VARCHAR(500),
    test_count INTEGER DEFAULT 0,
    passing_tests INTEGER DEFAULT 0,
    failing_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    
    -- Coverage for this file
    line_coverage DECIMAL(5,2),
    function_coverage DECIMAL(5,2),
    branch_coverage DECIMAL(5,2),
    
    -- Quality metrics
    lines_of_code INTEGER,
    complexity_score INTEGER,
    
    -- Status
    needs_tests BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'low' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    
    -- Timestamps
    last_test_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, file_path)
);

CREATE INDEX idx_test_file_registry_tenant ON test_file_registry(tenant_id);
CREATE INDEX idx_test_file_registry_component ON test_file_registry(component);
CREATE INDEX idx_test_file_registry_needs_tests ON test_file_registry(needs_tests) WHERE needs_tests = TRUE;

-- ============================================================================
-- 3. JSON Parse Migration Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS json_parse_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Location
    file_path VARCHAR(500) NOT NULL,
    line_number INTEGER NOT NULL,
    component VARCHAR(100) NOT NULL,
    
    -- Status
    is_migrated BOOLEAN DEFAULT FALSE,
    migration_type VARCHAR(50), -- 'safeJsonParse', 'parseJsonWithSchema', 'parseEventBody', 'parseJsonField'
    schema_name VARCHAR(100), -- If using schema validation
    
    -- Risk assessment
    risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
    context_description TEXT,
    
    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    migrated_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, file_path, line_number)
);

CREATE INDEX idx_json_parse_locations_tenant ON json_parse_locations(tenant_id);
CREATE INDEX idx_json_parse_locations_migrated ON json_parse_locations(is_migrated);
CREATE INDEX idx_json_parse_locations_risk ON json_parse_locations(risk_level);

-- ============================================================================
-- 4. Technical Debt Items
-- ============================================================================

CREATE TABLE IF NOT EXISTS technical_debt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Item identification
    debt_id VARCHAR(20) NOT NULL, -- e.g., 'TD-019'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Classification
    category VARCHAR(50) NOT NULL CHECK (category IN ('type_safety', 'test_coverage', 'code_quality', 'security', 'performance', 'documentation', 'architecture')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('p0_critical', 'p1_high', 'p2_medium', 'p3_low')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'deferred', 'wont_fix')),
    
    -- Location
    file_paths TEXT[], -- Array of affected file paths
    component VARCHAR(100),
    
    -- Effort estimation
    estimated_hours INTEGER,
    actual_hours INTEGER,
    
    -- Resolution
    resolution_notes TEXT,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, debt_id)
);

CREATE INDEX idx_technical_debt_items_tenant ON technical_debt_items(tenant_id);
CREATE INDEX idx_technical_debt_items_status ON technical_debt_items(status);
CREATE INDEX idx_technical_debt_items_priority ON technical_debt_items(priority);
CREATE INDEX idx_technical_debt_items_category ON technical_debt_items(category);

-- ============================================================================
-- 5. Code Quality Alerts
-- ============================================================================

CREATE TABLE IF NOT EXISTS code_quality_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('coverage_drop', 'new_debt', 'test_failure', 'quality_regression', 'security_issue')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Context
    component VARCHAR(100),
    file_path VARCHAR(500),
    metric_name VARCHAR(100),
    previous_value DECIMAL(10,2),
    current_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_code_quality_alerts_tenant ON code_quality_alerts(tenant_id);
CREATE INDEX idx_code_quality_alerts_status ON code_quality_alerts(status);
CREATE INDEX idx_code_quality_alerts_severity ON code_quality_alerts(severity);
CREATE INDEX idx_code_quality_alerts_type ON code_quality_alerts(alert_type);

-- ============================================================================
-- 6. Aggregated Views
-- ============================================================================

-- Latest coverage by component
CREATE OR REPLACE VIEW v_latest_test_coverage AS
SELECT DISTINCT ON (tenant_id, component)
    id,
    tenant_id,
    component,
    total_files,
    files_with_tests,
    line_coverage,
    function_coverage,
    branch_coverage,
    overall_coverage,
    captured_at
FROM code_quality_snapshots
WHERE snapshot_type = 'test_coverage'
ORDER BY tenant_id, component, captured_at DESC;

-- Latest JSON safety by component
CREATE OR REPLACE VIEW v_json_safety_progress AS
SELECT DISTINCT ON (tenant_id, component)
    id,
    tenant_id,
    component,
    safe_json_calls,
    unsafe_json_calls,
    json_safety_percentage,
    captured_at
FROM code_quality_snapshots
WHERE snapshot_type = 'json_safety'
ORDER BY tenant_id, component, captured_at DESC;

-- Technical debt summary
CREATE OR REPLACE VIEW v_technical_debt_summary AS
SELECT
    tenant_id,
    COUNT(*) FILTER (WHERE status = 'open') AS open_items,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_items,
    COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_items,
    COUNT(*) FILTER (WHERE priority = 'p0_critical' AND status IN ('open', 'in_progress')) AS critical_count,
    COUNT(*) FILTER (WHERE priority = 'p1_high' AND status IN ('open', 'in_progress')) AS high_count,
    COUNT(*) FILTER (WHERE priority = 'p2_medium' AND status IN ('open', 'in_progress')) AS medium_count,
    COUNT(*) FILTER (WHERE priority = 'p3_low' AND status IN ('open', 'in_progress')) AS low_count,
    SUM(estimated_hours) FILTER (WHERE status IN ('open', 'in_progress')) AS total_estimated_hours
FROM technical_debt_items
GROUP BY tenant_id;

-- ============================================================================
-- 7. Row-Level Security
-- ============================================================================

ALTER TABLE code_quality_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_file_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE json_parse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_debt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_quality_alerts ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY code_quality_snapshots_tenant_policy ON code_quality_snapshots
    FOR ALL USING (
        tenant_id IS NULL OR -- Platform-wide metrics
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY test_file_registry_tenant_policy ON test_file_registry
    FOR ALL USING (
        tenant_id IS NULL OR
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY json_parse_locations_tenant_policy ON json_parse_locations
    FOR ALL USING (
        tenant_id IS NULL OR
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY technical_debt_items_tenant_policy ON technical_debt_items
    FOR ALL USING (
        tenant_id IS NULL OR
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY code_quality_alerts_tenant_policy ON code_quality_alerts
    FOR ALL USING (
        tenant_id IS NULL OR
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

-- ============================================================================
-- 8. Register Report Types
-- ============================================================================

INSERT INTO report_types (id, name, description, category, config)
VALUES
    ('code-quality-coverage', 'Test Coverage Report', 'Test coverage metrics across all components', 'code_quality', 
     '{"metrics": ["line_coverage", "function_coverage", "branch_coverage"], "groupBy": "component"}'::JSONB),
    ('code-quality-debt', 'Technical Debt Report', 'Summary of technical debt items by priority and status', 'code_quality',
     '{"includeResolved": false, "groupBy": "category"}'::JSONB),
    ('code-quality-json-safety', 'JSON Safety Migration Report', 'Progress of JSON.parse migration to safe utilities', 'code_quality',
     '{"showLocations": true, "groupBy": "component"}'::JSONB)
ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    config = EXCLUDED.config;

-- ============================================================================
-- 9. Seed Initial Data
-- ============================================================================

-- Insert current known technical debt items
INSERT INTO technical_debt_items (tenant_id, debt_id, title, description, category, priority, status, component, estimated_hours)
VALUES
    (NULL, 'TD-003', 'Low Test Coverage', 'Only ~45% of services have tests', 'test_coverage', 'p1_high', 'in_progress', 'lambda', 40),
    (NULL, 'TD-010', 'Excessive any/unknown Types', '1,505 instances across 182 files', 'type_safety', 'p2_medium', 'open', 'lambda', 80),
    (NULL, 'TD-011', 'Unvalidated JSON.parse Calls', '429 JSON.parse calls need migration to safe utilities', 'security', 'p1_high', 'in_progress', 'lambda', 20),
    (NULL, 'TD-012', 'Environment Variables Without Validation', '162 process.env accesses need migration', 'security', 'p2_medium', 'open', 'lambda', 16)
ON CONFLICT (tenant_id, debt_id) DO NOTHING;

-- ============================================================================
-- 10. Comments
-- ============================================================================

COMMENT ON TABLE code_quality_snapshots IS 'Periodic snapshots of code quality metrics for trend analysis';
COMMENT ON TABLE test_file_registry IS 'Registry of source files and their test coverage status';
COMMENT ON TABLE json_parse_locations IS 'Tracking JSON.parse locations for migration to safe utilities';
COMMENT ON TABLE technical_debt_items IS 'Technical debt tracking aligned with TECHNICAL_DEBT.md';
COMMENT ON TABLE code_quality_alerts IS 'Alerts for code quality regressions and issues';
