-- ============================================================================
-- RADIANT v5.43.0 - Decision Intelligence Artifacts (DIA Engine)
-- Core tables for the Glass Box Decision Engine
-- ============================================================================

-- Decision Artifacts - The main artifact storage
CREATE TABLE IF NOT EXISTS decision_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES thinktank_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Artifact metadata
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    status VARCHAR(32) DEFAULT 'active' 
        CHECK (status IN ('active', 'frozen', 'archived', 'invalidated')),
    version INT DEFAULT 1,
    parent_artifact_id UUID REFERENCES decision_artifacts(id) ON DELETE SET NULL,
    
    -- The structured decision graph (JSONB)
    artifact_content JSONB NOT NULL DEFAULT '{}',
    
    -- Extraction metadata
    miner_model VARCHAR(100),
    extraction_confidence DECIMAL(3,2) CHECK (extraction_confidence BETWEEN 0 AND 1),
    extraction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Validation tracking
    last_validated_at TIMESTAMPTZ,
    validation_status VARCHAR(32) DEFAULT 'fresh'
        CHECK (validation_status IN ('fresh', 'stale', 'verified', 'invalidated')),
    staleness_threshold_days INT DEFAULT 7,
    
    -- Heatmap support (pre-computed for performance)
    heatmap_data JSONB DEFAULT '[]',
    
    -- Compliance metadata
    compliance_frameworks TEXT[] DEFAULT '{}',
    phi_detected BOOLEAN DEFAULT FALSE,
    pii_detected BOOLEAN DEFAULT FALSE,
    data_classification VARCHAR(32) DEFAULT 'internal'
        CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
    
    -- Domain classification
    primary_domain VARCHAR(100),
    secondary_domains TEXT[] DEFAULT '{}',
    
    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    frozen_at TIMESTAMPTZ,
    frozen_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Tamper evidence
    content_hash VARCHAR(64),
    signature_timestamp TIMESTAMPTZ
);

-- Indexes for decision_artifacts
CREATE INDEX idx_dia_conversation ON decision_artifacts(conversation_id);
CREATE INDEX idx_dia_user ON decision_artifacts(user_id);
CREATE INDEX idx_dia_tenant ON decision_artifacts(tenant_id);
CREATE INDEX idx_dia_status ON decision_artifacts(status);
CREATE INDEX idx_dia_parent ON decision_artifacts(parent_artifact_id);
CREATE INDEX idx_dia_validation ON decision_artifacts(validation_status, last_validated_at);
CREATE INDEX idx_dia_content ON decision_artifacts USING gin(artifact_content jsonb_path_ops);
CREATE INDEX idx_dia_compliance ON decision_artifacts USING gin(compliance_frameworks);
CREATE INDEX idx_dia_domain ON decision_artifacts(primary_domain);
CREATE INDEX idx_dia_created ON decision_artifacts(created_at DESC);
CREATE INDEX idx_dia_tenant_user ON decision_artifacts(tenant_id, user_id, created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_decision_artifact_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decision_artifact_updated
    BEFORE UPDATE ON decision_artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_decision_artifact_timestamp();

-- Auto-compute hash on freeze
CREATE OR REPLACE FUNCTION auto_compute_artifact_hash_on_freeze()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'frozen' AND OLD.status != 'frozen' THEN
        NEW.content_hash = encode(sha256(NEW.artifact_content::text::bytea), 'hex');
        NEW.signature_timestamp = NOW();
        NEW.frozen_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_compute_artifact_hash_on_freeze
    BEFORE UPDATE ON decision_artifacts
    FOR EACH ROW
    WHEN (NEW.status = 'frozen' AND OLD.status != 'frozen')
    EXECUTE FUNCTION auto_compute_artifact_hash_on_freeze();

-- ============================================================================
-- Validation Log Table - Track Sniper validation results
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_artifact_validation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES decision_artifacts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    query_id VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    validation_status VARCHAR(32) NOT NULL
        CHECK (validation_status IN ('unchanged', 'changed', 'error', 'unavailable')),
    original_result_hash VARCHAR(64),
    new_result_hash VARCHAR(64),
    diff_summary TEXT,
    significance VARCHAR(32)
        CHECK (significance IN ('none', 'minor', 'moderate', 'significant', 'critical')),
    api_cost_cents INT DEFAULT 0,
    validated_at TIMESTAMPTZ DEFAULT NOW(),
    validated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_dia_validation_artifact ON decision_artifact_validation_log(artifact_id, validated_at DESC);
CREATE INDEX idx_dia_validation_tenant ON decision_artifact_validation_log(tenant_id);

-- ============================================================================
-- Export Log Table - Track compliance exports
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_artifact_export_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES decision_artifacts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    export_format VARCHAR(32) NOT NULL
        CHECK (export_format IN ('pdf', 'json', 'hipaa_audit', 'soc2_evidence', 'gdpr_dsar', 'mcp_resource')),
    compliance_framework VARCHAR(32),
    exported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exported_at TIMESTAMPTZ DEFAULT NOW(),
    recipient_description TEXT,
    purpose TEXT,
    export_hash VARCHAR(64),
    s3_key VARCHAR(500),
    file_size_bytes BIGINT,
    redaction_applied BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_dia_export_artifact ON decision_artifact_export_log(artifact_id);
CREATE INDEX idx_dia_export_tenant ON decision_artifact_export_log(tenant_id);
CREATE INDEX idx_dia_export_format ON decision_artifact_export_log(export_format);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE decision_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_artifact_validation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_artifact_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_artifacts_tenant_isolation ON decision_artifacts
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY decision_artifact_validation_log_tenant_isolation ON decision_artifact_validation_log
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY decision_artifact_export_log_tenant_isolation ON decision_artifact_export_log
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE decision_artifacts IS 'DIA Engine: Glass Box decision records with evidence provenance';
COMMENT ON TABLE decision_artifact_validation_log IS 'DIA Engine: Sniper validation results for volatile data';
COMMENT ON TABLE decision_artifact_export_log IS 'DIA Engine: Compliance export audit trail';

COMMENT ON COLUMN decision_artifacts.artifact_content IS 'JSONB containing claims, evidence, dissent events, volatile queries, actions, compliance metadata, and heatmap segments';
COMMENT ON COLUMN decision_artifacts.heatmap_data IS 'Pre-computed heatmap segments for UI rendering performance';
COMMENT ON COLUMN decision_artifacts.validation_status IS 'fresh=new, stale=needs revalidation, verified=recently validated, invalidated=data changed significantly';
