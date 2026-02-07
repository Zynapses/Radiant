-- ============================================================================
-- RADIANT v4.18.0 - Centralized Log Retention & Compliance System
-- Provides: log categories, retention policies driven by compliance licenses,
-- log source auto-registration, hourly index pointers to S3/Glacier archives,
-- and per-tenant configuration.
-- ============================================================================

-- ============================================================================
-- 1. LOG CATEGORIES
-- Canonical classification for all log data
-- ============================================================================

CREATE TYPE log_category AS ENUM (
    'audit',          -- User actions, admin changes, data access
    'security',       -- Auth events, MFA, failed logins, permission denials
    'ai_model',       -- Prompt execution, token usage, model selection
    'compliance',     -- PHI access, data exports, erasure, consent
    'billing',        -- Usage events, cost attribution, guest costs
    'infrastructure', -- Lambda execution, CDK deploys, health checks
    'application',    -- API calls, errors, warnings, cold starts
    'collaboration'   -- Guest joins, session events, restriction enforcement
);

CREATE TYPE log_storage_tier AS ENUM (
    'hot',           -- Aurora PostgreSQL (0-30d, indexed, queryable)
    'warm',          -- S3 Standard (30-90d, fast retrieval)
    'cold',          -- S3 Glacier (90d-7yr, archive)
    'deep_archive'   -- S3 Glacier Deep Archive (7yr+, regulatory minimum)
);

CREATE TYPE log_source_type AS ENUM (
    'lambda',        -- AWS Lambda function
    'api_gateway',   -- API Gateway access logs
    'cloudwatch',    -- CloudWatch log group
    'aurora',        -- Aurora PostgreSQL query/audit logs
    'cognito',       -- Cognito auth events
    's3',            -- S3 access logs
    'cloudfront',    -- CloudFront access logs
    'waf',           -- WAF logs
    'dynamodb',      -- DynamoDB streams
    'application',   -- Application-level structured logs
    'custom'         -- Custom log sources
);

-- ============================================================================
-- 2. COMPLIANCE RETENTION REQUIREMENTS
-- Maps each compliance license to minimum retention per log category
-- ============================================================================

CREATE TABLE compliance_retention_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Which compliance license
    compliance_key VARCHAR(50) NOT NULL,
    
    -- Which log category
    category log_category NOT NULL,
    
    -- Retention requirements
    min_retention_days INTEGER NOT NULL,
    max_retention_days INTEGER, -- NULL = no max (GDPR may impose max)
    
    -- Storage requirements
    min_hot_days INTEGER NOT NULL DEFAULT 30,
    min_warm_days INTEGER NOT NULL DEFAULT 60,
    
    -- Immutability requirements
    immutable BOOLEAN NOT NULL DEFAULT false, -- Cannot be deleted even by admin
    tamper_evident BOOLEAN NOT NULL DEFAULT false, -- Requires hash chain verification
    
    -- Regulatory reference
    regulation_section VARCHAR(100),
    regulation_description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_compliance_category UNIQUE (compliance_key, category)
);

-- Seed: default retention (no compliance)
INSERT INTO compliance_retention_requirements (compliance_key, category, min_retention_days, max_retention_days, min_hot_days, min_warm_days, immutable, tamper_evident, regulation_section) VALUES
('none', 'audit',          90,  NULL, 30, 30, false, false, NULL),
('none', 'security',       90,  NULL, 30, 30, false, false, NULL),
('none', 'ai_model',       30,  NULL, 15, 15, false, false, NULL),
('none', 'compliance',     30,  NULL, 15, 15, false, false, NULL),
('none', 'billing',        365, NULL, 30, 60, false, false, NULL),
('none', 'infrastructure', 30,  NULL, 7,  15, false, false, NULL),
('none', 'application',    30,  NULL, 7,  15, false, false, NULL),
('none', 'collaboration',  90,  NULL, 30, 30, false, false, NULL);

-- Seed: HIPAA
INSERT INTO compliance_retention_requirements (compliance_key, category, min_retention_days, max_retention_days, min_hot_days, min_warm_days, immutable, tamper_evident, regulation_section, regulation_description) VALUES
('hipaa', 'audit',          2190, NULL, 90, 365, true,  true,  '§164.312(b)',    'Audit controls - 6 year minimum for all audit trails'),
('hipaa', 'security',       2190, NULL, 90, 365, true,  true,  '§164.312(b)',    'Security incident logs must be retained 6 years'),
('hipaa', 'ai_model',       2190, NULL, 90, 365, true,  true,  '§164.312(b)',    'AI interactions with PHI require full audit trail'),
('hipaa', 'compliance',     2190, NULL, 90, 365, true,  true,  '§164.530(j)',    'Compliance documentation retained 6 years from creation'),
('hipaa', 'billing',        2555, NULL, 90, 365, false, false, '§164.530(j)',    'Financial records 7 year minimum'),
('hipaa', 'infrastructure', 365,  NULL, 30, 90,  false, false, '§164.312(b)',    'Infrastructure audit logs 1 year minimum'),
('hipaa', 'application',    365,  NULL, 30, 90,  false, false, '§164.312(b)',    'Application logs 1 year minimum'),
('hipaa', 'collaboration',  2190, NULL, 90, 365, true,  true,  '§164.312(b)',    'Guest access to PHI systems requires full audit');

-- Seed: GDPR
INSERT INTO compliance_retention_requirements (compliance_key, category, min_retention_days, max_retention_days, min_hot_days, min_warm_days, immutable, tamper_evident, regulation_section, regulation_description) VALUES
('gdpr', 'audit',          365,  730,  30, 90,  false, true,  'Art. 5(1)(e)',   'Data minimization - retain only as needed, max 2 years recommended'),
('gdpr', 'security',       365,  730,  30, 90,  false, true,  'Art. 32',        'Security logs for breach detection, 1-2 year window'),
('gdpr', 'ai_model',       365,  730,  30, 60,  false, false, 'Art. 22',        'Automated decision-making audit trail'),
('gdpr', 'compliance',     365,  730,  30, 90,  false, true,  'Art. 5(2)',      'Accountability records, exempt from erasure'),
('gdpr', 'billing',        2555, NULL, 30, 90,  false, false, 'Art. 17(3)(e)', 'Financial records exempt from right to erasure'),
('gdpr', 'infrastructure', 90,   365,  7,  30,  false, false, 'Art. 5(1)(e)',   'Minimize infrastructure log retention'),
('gdpr', 'application',    90,   365,  7,  30,  false, false, 'Art. 5(1)(e)',   'Minimize application log retention'),
('gdpr', 'collaboration',  365,  730,  30, 90,  false, true,  'Art. 5(2)',      'Cross-tenant data sharing accountability');

-- Seed: SOC2
INSERT INTO compliance_retention_requirements (compliance_key, category, min_retention_days, max_retention_days, min_hot_days, min_warm_days, immutable, tamper_evident, regulation_section, regulation_description) VALUES
('soc2', 'audit',          365, NULL, 30, 90, false, true,  'CC7.2', 'Monitor system components for anomalies'),
('soc2', 'security',       365, NULL, 30, 90, false, true,  'CC6.1', 'Logical access security events'),
('soc2', 'ai_model',       365, NULL, 30, 60, false, false, 'CC7.2', 'AI processing monitoring'),
('soc2', 'compliance',     365, NULL, 30, 90, false, true,  'CC7.2', 'Compliance monitoring logs'),
('soc2', 'billing',        2555,NULL, 30, 90, false, false, 'CC7.2', 'Financial transaction logs'),
('soc2', 'infrastructure', 365, NULL, 30, 90, false, false, 'CC7.1', 'Infrastructure change management'),
('soc2', 'application',    90,  NULL, 7,  30, false, false, 'CC7.2', 'Application monitoring'),
('soc2', 'collaboration',  365, NULL, 30, 90, false, true,  'CC6.1', 'External access monitoring');

-- Seed: FedRAMP
INSERT INTO compliance_retention_requirements (compliance_key, category, min_retention_days, max_retention_days, min_hot_days, min_warm_days, immutable, tamper_evident, regulation_section, regulation_description) VALUES
('fedramp', 'audit',          1095, NULL, 90, 365, true,  true,  'AU-11', 'Audit record retention - 3 years'),
('fedramp', 'security',       1095, NULL, 90, 365, true,  true,  'AU-11', 'Security event retention - 3 years'),
('fedramp', 'ai_model',       365,  NULL, 90, 180, true,  true,  'AU-11', 'AI/ML audit trail'),
('fedramp', 'compliance',     1095, NULL, 90, 365, true,  true,  'AU-11', 'Compliance documentation'),
('fedramp', 'billing',        2555, NULL, 90, 365, false, false, 'AU-11', 'Financial records'),
('fedramp', 'infrastructure', 365,  NULL, 90, 180, true,  true,  'AU-11', 'Infrastructure audit'),
('fedramp', 'application',    365,  NULL, 30, 90,  false, false, 'AU-11', 'Application logs'),
('fedramp', 'collaboration',  1095, NULL, 90, 365, true,  true,  'AU-11', 'External access audit');

-- Seed: PCI-DSS
INSERT INTO compliance_retention_requirements (compliance_key, category, min_retention_days, max_retention_days, min_hot_days, min_warm_days, immutable, tamper_evident, regulation_section, regulation_description) VALUES
('pci_dss', 'audit',          365, NULL, 90, 180, true,  true,  'Req 10.7', 'Audit trail history for at least one year'),
('pci_dss', 'security',       365, NULL, 90, 180, true,  true,  'Req 10.7', 'Security events retained one year'),
('pci_dss', 'ai_model',       365, NULL, 30, 90,  false, false, 'Req 10.7', 'AI processing logs'),
('pci_dss', 'compliance',     365, NULL, 90, 180, true,  true,  'Req 10.7', 'Compliance logs'),
('pci_dss', 'billing',        2555,NULL, 90, 365, true,  true,  'Req 10.7', 'Payment-related logs 7 years'),
('pci_dss', 'infrastructure', 365, NULL, 90, 180, true,  true,  'Req 10.7', 'Infrastructure logs one year'),
('pci_dss', 'application',    90,  NULL, 30, 60,  false, false, 'Req 10.7', 'Application logs 90 days minimum'),
('pci_dss', 'collaboration',  365, NULL, 90, 180, true,  true,  'Req 10.7', 'Third-party access logs');

-- ============================================================================
-- 3. LOG SOURCE REGISTRY
-- Auto-populated catalog of all log-producing services
-- ============================================================================

CREATE TABLE log_source_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source identification
    source_name VARCHAR(200) NOT NULL UNIQUE,
    source_type log_source_type NOT NULL,
    source_arn VARCHAR(500),
    
    -- Classification
    category log_category NOT NULL,
    subcategory VARCHAR(100),
    
    -- CloudWatch integration
    cloudwatch_log_group VARCHAR(500),
    cloudwatch_log_stream_prefix VARCHAR(200),
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    logging_enforced BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    last_indexed_at TIMESTAMPTZ,
    
    -- Volume metrics (updated by hourly indexer)
    avg_daily_bytes BIGINT DEFAULT 0,
    avg_daily_events INTEGER DEFAULT 0,
    estimated_monthly_cost_usd DECIMAL(10,4) DEFAULT 0,
    
    -- Registration
    registered_by VARCHAR(100) DEFAULT 'auto', -- 'auto', 'manual', 'decorator'
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    description TEXT,
    service_owner VARCHAR(100),
    tags JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. LOG INDEX
-- Hourly pointers to archived log data in S3/Glacier
-- ============================================================================

CREATE TABLE log_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source reference
    source_id UUID NOT NULL REFERENCES log_source_registry(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for platform-level logs
    
    -- Time window
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    
    -- Classification
    category log_category NOT NULL,
    
    -- Storage location
    storage_tier log_storage_tier NOT NULL DEFAULT 'hot',
    s3_bucket VARCHAR(255),
    s3_key VARCHAR(512),
    s3_region VARCHAR(50) DEFAULT 'us-east-1',
    
    -- Archive info
    glacier_vault_name VARCHAR(255),
    glacier_archive_id VARCHAR(255),
    glacier_retrieval_job_id VARCHAR(255),
    
    -- Content metrics
    event_count INTEGER NOT NULL DEFAULT 0,
    byte_size BIGINT NOT NULL DEFAULT 0,
    compressed_size BIGINT,
    
    -- Integrity
    sha256_hash VARCHAR(64),
    
    -- Retention
    retention_expires_at TIMESTAMPTZ, -- When this index entry (and its data) can be deleted
    immutable BOOLEAN NOT NULL DEFAULT false,
    
    -- Status
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partitioned index for efficient time-range queries
CREATE INDEX idx_log_index_time ON log_index (window_start DESC, window_end DESC);
CREATE INDEX idx_log_index_category ON log_index (category, window_start DESC);
CREATE INDEX idx_log_index_source ON log_index (source_id, window_start DESC);
CREATE INDEX idx_log_index_tenant ON log_index (tenant_id, category, window_start DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_log_index_tier ON log_index (storage_tier, retention_expires_at) WHERE retention_expires_at IS NOT NULL;
CREATE INDEX idx_log_index_archive ON log_index (storage_tier, archived_at) WHERE storage_tier IN ('warm', 'cold', 'deep_archive');

-- ============================================================================
-- 5. TENANT LOG RETENTION OVERRIDES
-- Tenants can increase (but not decrease below compliance minimum) retention
-- ============================================================================

CREATE TABLE tenant_log_retention_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Which category to override
    category log_category NOT NULL,
    
    -- Override values (must be >= compliance minimum)
    retention_days INTEGER NOT NULL,
    hot_days INTEGER NOT NULL,
    warm_days INTEGER NOT NULL,
    
    -- Who set this
    set_by UUID REFERENCES users(id),
    reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_category UNIQUE (tenant_id, category)
);

-- ============================================================================
-- 6. LOG RETENTION AUDIT
-- Track all changes to retention policies
-- ============================================================================

CREATE TABLE log_retention_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    action VARCHAR(50) NOT NULL, -- 'override_set', 'override_removed', 'tier_transition', 'deletion', 'retrieval'
    category log_category,
    
    -- Details
    previous_value JSONB,
    new_value JSONB,
    
    -- Compliance context
    compliance_licenses JSONB DEFAULT '[]',
    min_retention_days INTEGER,
    
    -- Actor
    performed_by UUID REFERENCES users(id),
    performed_by_system BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. LOG INDEXER STATE
-- Tracks the hourly indexer's progress per source
-- ============================================================================

CREATE TABLE log_indexer_state (
    source_id UUID PRIMARY KEY REFERENCES log_source_registry(id) ON DELETE CASCADE,
    
    last_indexed_window_end TIMESTAMPTZ NOT NULL DEFAULT '2020-01-01',
    last_run_at TIMESTAMPTZ,
    last_run_duration_ms INTEGER,
    last_run_events_processed INTEGER DEFAULT 0,
    last_run_bytes_processed BIGINT DEFAULT 0,
    last_error TEXT,
    consecutive_errors INTEGER DEFAULT 0,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. FUNCTION: Resolve effective retention for a tenant + category
-- Takes the MAX of: default, all active compliance licenses, tenant override
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_log_retention(
    p_tenant_id UUID,
    p_category log_category
)
RETURNS TABLE (
    retention_days INTEGER,
    hot_days INTEGER,
    warm_days INTEGER,
    max_retention_days INTEGER,
    immutable BOOLEAN,
    tamper_evident BOOLEAN,
    driving_compliance VARCHAR(50),
    driving_regulation VARCHAR(100)
) AS $$
DECLARE
    v_compliance_keys TEXT[];
    v_max_retention INTEGER := 0;
    v_max_hot INTEGER := 0;
    v_max_warm INTEGER := 0;
    v_min_max_retention INTEGER := NULL;
    v_immutable BOOLEAN := false;
    v_tamper_evident BOOLEAN := false;
    v_driving_compliance VARCHAR(50) := 'none';
    v_driving_regulation VARCHAR(100) := NULL;
    v_override_retention INTEGER := NULL;
    v_override_hot INTEGER := NULL;
    v_override_warm INTEGER := NULL;
    v_req RECORD;
BEGIN
    -- Get active compliance licenses for this tenant
    SELECT ARRAY_AGG(license_key)
    INTO v_compliance_keys
    FROM tenant_licenses
    WHERE tenant_id = p_tenant_id
    AND license_type = 'compliance'
    AND status = 'active';
    
    -- Always include 'none' defaults
    v_compliance_keys := COALESCE(v_compliance_keys, ARRAY[]::TEXT[]) || ARRAY['none'];
    
    -- Find the strictest requirements across all applicable compliance keys
    FOR v_req IN
        SELECT * FROM compliance_retention_requirements
        WHERE compliance_key = ANY(v_compliance_keys)
        AND category = p_category
        ORDER BY min_retention_days DESC
    LOOP
        IF v_req.min_retention_days > v_max_retention THEN
            v_max_retention := v_req.min_retention_days;
            v_driving_compliance := v_req.compliance_key;
            v_driving_regulation := v_req.regulation_section;
        END IF;
        IF v_req.min_hot_days > v_max_hot THEN v_max_hot := v_req.min_hot_days; END IF;
        IF v_req.min_warm_days > v_max_warm THEN v_max_warm := v_req.min_warm_days; END IF;
        IF v_req.max_retention_days IS NOT NULL THEN
            IF v_min_max_retention IS NULL OR v_req.max_retention_days < v_min_max_retention THEN
                v_min_max_retention := v_req.max_retention_days;
            END IF;
        END IF;
        IF v_req.immutable THEN v_immutable := true; END IF;
        IF v_req.tamper_evident THEN v_tamper_evident := true; END IF;
    END LOOP;
    
    -- Check for tenant override (can only increase, not decrease)
    SELECT o.retention_days, o.hot_days, o.warm_days
    INTO v_override_retention, v_override_hot, v_override_warm
    FROM tenant_log_retention_overrides o
    WHERE o.tenant_id = p_tenant_id AND o.category = p_category;
    
    IF v_override_retention IS NOT NULL AND v_override_retention > v_max_retention THEN
        -- Respect max if GDPR imposes a ceiling
        IF v_min_max_retention IS NOT NULL AND v_override_retention > v_min_max_retention THEN
            v_max_retention := v_min_max_retention;
        ELSE
            v_max_retention := v_override_retention;
        END IF;
    END IF;
    IF v_override_hot IS NOT NULL AND v_override_hot > v_max_hot THEN v_max_hot := v_override_hot; END IF;
    IF v_override_warm IS NOT NULL AND v_override_warm > v_max_warm THEN v_max_warm := v_override_warm; END IF;
    
    RETURN QUERY SELECT
        v_max_retention,
        v_max_hot,
        v_max_warm,
        v_min_max_retention,
        v_immutable,
        v_tamper_evident,
        v_driving_compliance,
        v_driving_regulation;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_compliance_retention ON compliance_retention_requirements (compliance_key, category);
CREATE INDEX idx_log_source_active ON log_source_registry (is_active, category);
CREATE INDEX idx_log_source_type ON log_source_registry (source_type);
CREATE INDEX idx_tenant_log_overrides ON tenant_log_retention_overrides (tenant_id, category);
CREATE INDEX idx_log_retention_audit_tenant ON log_retention_audit (tenant_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_log_retention_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_retention_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_log_overrides_isolation ON tenant_log_retention_overrides
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY log_retention_audit_isolation ON log_retention_audit
    FOR ALL USING (
        tenant_id IS NULL
        OR tenant_id = current_setting('app.current_tenant_id')::UUID
    );
