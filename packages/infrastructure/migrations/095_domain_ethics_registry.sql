-- Migration 095: Domain Ethics Registry
-- Professional ethics frameworks for domain-specific guidance
-- RADIANT v4.18.0

-- ============================================================================
-- DOMAIN ETHICS CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_ethics_config (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Global settings
    enable_domain_ethics BOOLEAN NOT NULL DEFAULT true,
    enforcement_mode VARCHAR(20) NOT NULL DEFAULT 'standard'
        CHECK (enforcement_mode IN ('strict', 'standard', 'advisory', 'disabled')),
    
    -- Framework overrides
    disabled_frameworks JSONB NOT NULL DEFAULT '[]',
    
    -- Domain-specific settings
    domain_settings JSONB NOT NULL DEFAULT '{}',
    
    -- Logging
    log_all_checks BOOLEAN NOT NULL DEFAULT false,
    log_violations_only BOOLEAN NOT NULL DEFAULT true,
    
    -- Notifications
    notify_on_violation BOOLEAN NOT NULL DEFAULT true,
    notify_on_warning BOOLEAN NOT NULL DEFAULT false,
    notification_emails JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE domain_ethics_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domain_ethics_config_tenant" ON domain_ethics_config
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- ============================================================================
-- CUSTOM FRAMEWORKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_ethics_custom_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Framework identification
    framework_id VARCHAR(100) NOT NULL,
    domain VARCHAR(50) NOT NULL,
    framework_name VARCHAR(200) NOT NULL,
    framework_code VARCHAR(20) NOT NULL,
    governing_body VARCHAR(200),
    jurisdiction VARCHAR(50),
    
    -- Framework data (full JSON)
    framework_data JSONB NOT NULL,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, framework_id)
);

-- RLS Policy
ALTER TABLE domain_ethics_custom_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domain_ethics_custom_frameworks_tenant" ON domain_ethics_custom_frameworks
    FOR ALL USING (
        tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Indexes
CREATE INDEX idx_decf_tenant ON domain_ethics_custom_frameworks(tenant_id);
CREATE INDEX idx_decf_domain ON domain_ethics_custom_frameworks(domain);
CREATE INDEX idx_decf_active ON domain_ethics_custom_frameworks(is_active);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_ethics_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    prompt_id UUID NOT NULL,
    
    -- Detection
    detected_domain VARCHAR(50) NOT NULL,
    detected_subspecialty VARCHAR(100),
    
    -- Check details
    frameworks_applied JSONB NOT NULL DEFAULT '[]',
    check_result JSONB NOT NULL,
    
    -- Action
    action_taken VARCHAR(20) NOT NULL DEFAULT 'allowed'
        CHECK (action_taken IN ('allowed', 'blocked', 'modified', 'warned')),
    modifications_applied JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE domain_ethics_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domain_ethics_audit_log_tenant" ON domain_ethics_audit_log
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Indexes
CREATE INDEX idx_deal_tenant_created ON domain_ethics_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_deal_user ON domain_ethics_audit_log(user_id);
CREATE INDEX idx_deal_domain ON domain_ethics_audit_log(detected_domain);
CREATE INDEX idx_deal_action ON domain_ethics_audit_log(action_taken);
CREATE INDEX idx_deal_session ON domain_ethics_audit_log(session_id);

-- ============================================================================
-- FRAMEWORK OVERRIDES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_ethics_framework_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    framework_id VARCHAR(100) NOT NULL,
    
    -- Override settings
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    enforcement_level VARCHAR(20) DEFAULT 'standard'
        CHECK (enforcement_level IN ('strict', 'standard', 'advisory')),
    custom_disclaimers JSONB,
    
    -- Audit
    modified_by UUID REFERENCES users(id),
    modified_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, framework_id)
);

-- RLS Policy
ALTER TABLE domain_ethics_framework_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domain_ethics_framework_overrides_tenant" ON domain_ethics_framework_overrides
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- ============================================================================
-- VIOLATION PATTERNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_ethics_violation_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework_id VARCHAR(100) NOT NULL,
    
    -- Pattern details
    pattern_type VARCHAR(50) NOT NULL,
    pattern_text TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'major'
        CHECK (severity IN ('critical', 'major', 'minor')),
    action_on_match VARCHAR(20) NOT NULL DEFAULT 'warn'
        CHECK (action_on_match IN ('block', 'warn', 'modify', 'disclose')),
    
    -- Guidance
    guidance_text TEXT,
    alternative_response TEXT,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for pattern matching
CREATE INDEX idx_devp_framework ON domain_ethics_violation_patterns(framework_id);
CREATE INDEX idx_devp_active ON domain_ethics_violation_patterns(is_active);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get all applicable frameworks for a domain
CREATE OR REPLACE FUNCTION get_domain_ethics_frameworks(
    p_tenant_id UUID,
    p_domain VARCHAR(50)
)
RETURNS TABLE (
    framework_id VARCHAR(100),
    framework_name VARCHAR(200),
    framework_code VARCHAR(20),
    governing_body VARCHAR(200),
    enforcement_level VARCHAR(20),
    is_enabled BOOLEAN,
    framework_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cf.framework_id,
        cf.framework_name,
        cf.framework_code,
        cf.governing_body,
        COALESCE(fo.enforcement_level, 'standard') as enforcement_level,
        COALESCE(fo.is_enabled, true) as is_enabled,
        cf.framework_data
    FROM domain_ethics_custom_frameworks cf
    LEFT JOIN domain_ethics_framework_overrides fo 
        ON fo.tenant_id = p_tenant_id AND fo.framework_id = cf.framework_id
    WHERE cf.domain = p_domain
    AND cf.is_active = true
    AND (cf.tenant_id IS NULL OR cf.tenant_id = p_tenant_id)
    AND COALESCE(fo.is_enabled, true) = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if domain ethics is enabled for tenant
CREATE OR REPLACE FUNCTION is_domain_ethics_enabled(
    p_tenant_id UUID,
    p_domain VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_enabled BOOLEAN;
    v_domain_enabled BOOLEAN;
BEGIN
    -- Check global setting
    SELECT enable_domain_ethics INTO v_enabled
    FROM domain_ethics_config
    WHERE tenant_id = p_tenant_id;
    
    IF v_enabled IS NULL THEN
        v_enabled := true; -- Default enabled
    END IF;
    
    IF NOT v_enabled THEN
        RETURN false;
    END IF;
    
    -- Check domain-specific setting if domain provided
    IF p_domain IS NOT NULL THEN
        SELECT (domain_settings->p_domain->>'enabled')::boolean INTO v_domain_enabled
        FROM domain_ethics_config
        WHERE tenant_id = p_tenant_id;
        
        IF v_domain_enabled IS NOT NULL THEN
            RETURN v_domain_enabled;
        END IF;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get ethics check statistics
CREATE OR REPLACE FUNCTION get_domain_ethics_stats(
    p_tenant_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_checks BIGINT,
    checks_today BIGINT,
    violations_blocked BIGINT,
    warnings_issued BIGINT,
    checks_by_domain JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_checks,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::BIGINT as checks_today,
        COUNT(*) FILTER (WHERE action_taken = 'blocked')::BIGINT as violations_blocked,
        COUNT(*) FILTER (WHERE action_taken IN ('warned', 'modified'))::BIGINT as warnings_issued,
        (SELECT json_object_agg(detected_domain, cnt)::JSONB
         FROM (SELECT detected_domain, COUNT(*) as cnt 
               FROM domain_ethics_audit_log 
               WHERE tenant_id = p_tenant_id 
               AND created_at >= NOW() - (p_days || ' days')::interval
               GROUP BY detected_domain) sub) as checks_by_domain
    FROM domain_ethics_audit_log
    WHERE tenant_id = p_tenant_id
    AND created_at >= NOW() - (p_days || ' days')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA - Built-in Framework References
-- ============================================================================

-- Insert reference entries for built-in frameworks (actual data is in code)
INSERT INTO domain_ethics_custom_frameworks (
    tenant_id, framework_id, domain, framework_name, framework_code, 
    governing_body, jurisdiction, framework_data, is_active
) VALUES 
(NULL, 'legal-aba-model-rules', 'legal', 'ABA Model Rules of Professional Conduct', 'ABA', 
 'American Bar Association', 'US', 
 '{"builtin": true, "description": "Core legal ethics framework based on ABA Model Rules"}', true),

(NULL, 'medical-ama-ethics', 'healthcare', 'AMA Code of Medical Ethics', 'AMA', 
 'American Medical Association', 'US', 
 '{"builtin": true, "description": "Medical ethics based on AMA Code and Hippocratic principles"}', true),

(NULL, 'financial-cfp-standards', 'finance', 'CFP Board Code of Ethics', 'CFP', 
 'Certified Financial Planner Board of Standards', 'US', 
 '{"builtin": true, "description": "Financial planning ethics with fiduciary standards"}', true),

(NULL, 'engineering-nspe-ethics', 'engineering', 'NSPE Code of Ethics for Engineers', 'NSPE', 
 'National Society of Professional Engineers', 'US', 
 '{"builtin": true, "description": "Engineering ethics emphasizing public safety"}', true),

(NULL, 'journalism-spj-ethics', 'journalism', 'SPJ Code of Ethics', 'SPJ', 
 'Society of Professional Journalists', 'Global', 
 '{"builtin": true, "description": "Journalism ethics for accuracy and fairness"}', true),

(NULL, 'psychology-apa-ethics', 'psychology', 'APA Ethical Principles of Psychologists', 'APA-PSY', 
 'American Psychological Association', 'US', 
 '{"builtin": true, "description": "Psychology ethics including crisis handling"}', true)

ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE domain_ethics_config IS 'Per-tenant domain ethics configuration';
COMMENT ON TABLE domain_ethics_custom_frameworks IS 'Custom and built-in ethics frameworks';
COMMENT ON TABLE domain_ethics_audit_log IS 'Audit log of ethics checks performed';
COMMENT ON TABLE domain_ethics_framework_overrides IS 'Tenant-specific framework overrides';
COMMENT ON TABLE domain_ethics_violation_patterns IS 'Custom violation patterns for frameworks';

COMMENT ON COLUMN domain_ethics_config.enforcement_mode IS 'strict=block major+critical, standard=block critical only, advisory=warnings only, disabled=no checks';
COMMENT ON COLUMN domain_ethics_custom_frameworks.framework_data IS 'Full framework definition including principles, prohibitions, disclosures';
