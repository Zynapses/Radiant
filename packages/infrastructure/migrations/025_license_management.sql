-- RADIANT v4.17.0 - Migration 025: License Management
-- Model license tracking and compliance

CREATE TABLE model_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    
    license_type VARCHAR(50) NOT NULL CHECK (license_type IN ('open_source', 'proprietary', 'academic', 'commercial', 'custom')),
    license_spdx VARCHAR(50),
    license_name VARCHAR(200) NOT NULL,
    license_url VARCHAR(500),
    
    commercial_use BOOLEAN DEFAULT true,
    commercial_notes TEXT,
    attribution_required BOOLEAN DEFAULT false,
    attribution_text TEXT,
    share_alike BOOLEAN DEFAULT false,
    modifications_allowed BOOLEAN DEFAULT true,
    
    compliance_status VARCHAR(20) DEFAULT 'pending' CHECK (compliance_status IN ('compliant', 'pending', 'review_needed', 'non_compliant')),
    last_compliance_review TIMESTAMPTZ,
    reviewed_by UUID,
    compliance_notes TEXT,
    
    expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE model_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    
    dependency_type VARCHAR(50) NOT NULL CHECK (dependency_type IN ('base_model', 'dataset', 'framework', 'library', 'weights')),
    dependency_name VARCHAR(200) NOT NULL,
    dependency_version VARCHAR(50),
    dependency_url VARCHAR(500),
    
    dependency_size_gb DECIMAL(10, 2),
    dependency_license VARCHAR(100),
    
    is_required BOOLEAN DEFAULT true,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE license_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    license_id UUID REFERENCES model_licenses(id) ON DELETE SET NULL,
    
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    
    performed_by UUID,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_licenses_model ON model_licenses(model_id);
CREATE INDEX idx_model_licenses_status ON model_licenses(compliance_status);
CREATE INDEX idx_model_licenses_expiring ON model_licenses(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_model_dependencies_model ON model_dependencies(model_id);
CREATE INDEX idx_license_audit_log_model ON license_audit_log(model_id, created_at DESC);

ALTER TABLE model_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_audit_log ENABLE ROW LEVEL SECURITY;

-- License info is visible to all
CREATE POLICY model_licenses_read ON model_licenses FOR SELECT USING (true);
CREATE POLICY model_dependencies_read ON model_dependencies FOR SELECT USING (true);
CREATE POLICY license_audit_log_read ON license_audit_log FOR SELECT USING (true);

-- View for license summary
CREATE OR REPLACE VIEW license_summary AS
SELECT 
    COUNT(*) as total_models,
    COUNT(*) FILTER (WHERE ml.commercial_use = true AND ml.compliance_status = 'compliant') as commercial_ok,
    COUNT(*) FILTER (WHERE ml.compliance_status = 'review_needed') as review_needed,
    COUNT(*) FILTER (WHERE ml.compliance_status = 'non_compliant') as non_compliant,
    COUNT(*) FILTER (WHERE ml.expires_at IS NOT NULL AND ml.expires_at < NOW() + INTERVAL '30 days') as expiring_in_30_days
FROM ai_models am
LEFT JOIN model_licenses ml ON am.id = ml.model_id
WHERE am.is_active = true;

CREATE TRIGGER update_model_licenses_updated_at 
    BEFORE UPDATE ON model_licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
