-- ============================================================================
-- RADIANT v5.43.0 - Decision Artifact Configuration
-- Tenant-level DIA Engine configuration and templates
-- ============================================================================

-- Tenant DIA Configuration
CREATE TABLE IF NOT EXISTS decision_artifact_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Feature toggles
    dia_enabled BOOLEAN DEFAULT TRUE,
    auto_generate_enabled BOOLEAN DEFAULT FALSE,
    phi_detection_enabled BOOLEAN DEFAULT TRUE,
    pii_detection_enabled BOOLEAN DEFAULT TRUE,
    
    -- Default settings
    default_staleness_threshold_days INT DEFAULT 7,
    max_artifacts_per_user INT DEFAULT 0,  -- 0 = unlimited
    max_claims_per_artifact INT DEFAULT 100,
    
    -- Compliance settings
    required_compliance_frameworks TEXT[] DEFAULT '{}',
    auto_redact_phi_on_export BOOLEAN DEFAULT FALSE,
    audit_all_access BOOLEAN DEFAULT TRUE,
    
    -- Model settings
    extraction_model VARCHAR(100) DEFAULT 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    max_extraction_tokens INT DEFAULT 4096,
    
    -- Export settings
    export_retention_days INT DEFAULT 30,
    allowed_export_formats TEXT[] DEFAULT '{pdf,json,hipaa_audit,soc2_evidence,gdpr_dsar}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dia_config_tenant ON decision_artifact_config(tenant_id);

-- RLS
ALTER TABLE decision_artifact_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_artifact_config_tenant_isolation ON decision_artifact_config
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Trigger for updated_at
CREATE TRIGGER trigger_dia_config_updated
    BEFORE UPDATE ON decision_artifact_config
    FOR EACH ROW
    EXECUTE FUNCTION update_decision_artifact_timestamp();

-- ============================================================================
-- Artifact Templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_artifact_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system template
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    
    -- Template configuration
    extraction_prompt TEXT,
    claim_types TEXT[] DEFAULT '{conclusion,finding,recommendation,warning,fact}',
    required_evidence_types TEXT[] DEFAULT '{tool_call}',
    
    -- Display settings
    default_lens VARCHAR(20) DEFAULT 'read',
    show_ghost_paths BOOLEAN DEFAULT TRUE,
    show_heatmap BOOLEAN DEFAULT TRUE,
    
    -- Compliance presets
    compliance_frameworks TEXT[] DEFAULT '{}',
    sensitivity_level VARCHAR(20) DEFAULT 'low',
    
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dia_templates_tenant ON decision_artifact_templates(tenant_id);
CREATE INDEX idx_dia_templates_category ON decision_artifact_templates(category);
CREATE INDEX idx_dia_templates_system ON decision_artifact_templates(is_system);

-- RLS
ALTER TABLE decision_artifact_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_artifact_templates_tenant_isolation ON decision_artifact_templates
    AS RESTRICTIVE FOR ALL
    USING (
        tenant_id IS NULL  -- System templates visible to all
        OR tenant_id = current_setting('app.current_tenant_id')::UUID
    );

-- ============================================================================
-- Seed System Templates
-- ============================================================================

INSERT INTO decision_artifact_templates (
    name, description, category, extraction_prompt, claim_types, 
    compliance_frameworks, is_system
) VALUES 
(
    'General Decision Record',
    'Standard template for capturing decisions from any conversation',
    'general',
    'Extract all claims, conclusions, and recommendations from this conversation. Identify supporting evidence from tool calls and data sources.',
    '{conclusion,finding,recommendation,warning,fact}',
    '{}',
    TRUE
),
(
    'Healthcare Decision',
    'HIPAA-compliant template for healthcare-related decisions',
    'healthcare',
    'Extract clinical decisions, treatment recommendations, and diagnostic findings. Flag any PHI detected. Ensure evidence chain for each clinical claim.',
    '{conclusion,finding,recommendation,warning,fact,clinical_finding,treatment_recommendation}',
    '{hipaa}',
    TRUE
),
(
    'Financial Analysis',
    'Template for financial decisions requiring audit trail',
    'financial',
    'Extract financial conclusions, investment recommendations, and risk assessments. Track data sources and calculation evidence.',
    '{conclusion,finding,recommendation,warning,fact,risk_assessment,investment_recommendation}',
    '{soc2}',
    TRUE
),
(
    'Legal Review',
    'Template for legal analysis and recommendations',
    'legal',
    'Extract legal conclusions, compliance findings, and regulatory recommendations. Document precedent references and statute citations.',
    '{conclusion,finding,recommendation,warning,fact,legal_opinion,compliance_finding}',
    '{soc2,gdpr}',
    TRUE
),
(
    'Research Synthesis',
    'Template for research-heavy decisions with multiple sources',
    'research',
    'Extract research findings, synthesis conclusions, and evidence-based recommendations. Track source reliability and confidence levels.',
    '{conclusion,finding,recommendation,warning,fact,hypothesis,evidence_summary}',
    '{}',
    TRUE
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Access Log for Audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_artifact_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES decision_artifacts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    action VARCHAR(32) NOT NULL
        CHECK (action IN ('viewed', 'downloaded', 'exported', 'shared', 'validated', 'edited')),
    
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dia_access_artifact ON decision_artifact_access_log(artifact_id, accessed_at DESC);
CREATE INDEX idx_dia_access_tenant ON decision_artifact_access_log(tenant_id);
CREATE INDEX idx_dia_access_user ON decision_artifact_access_log(user_id);

-- RLS
ALTER TABLE decision_artifact_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_artifact_access_log_tenant_isolation ON decision_artifact_access_log
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE decision_artifact_config IS 'DIA Engine: Per-tenant configuration for decision artifact features';
COMMENT ON TABLE decision_artifact_templates IS 'DIA Engine: Reusable templates for artifact extraction';
COMMENT ON TABLE decision_artifact_access_log IS 'DIA Engine: Audit log for artifact access (HIPAA compliance)';
