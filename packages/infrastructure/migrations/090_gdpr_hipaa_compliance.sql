-- RADIANT v4.18.0 - GDPR & HIPAA Compliance Enhancement
-- Full implementation of data subject rights and PHI handling

-- ============================================================================
-- CONSENT RECORDS (GDPR Article 7)
-- Tracks all user consent for data processing
-- ============================================================================

CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Consent details
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN (
        'essential',      -- Required for service
        'analytics',      -- Usage analytics
        'marketing',      -- Marketing communications
        'ai_training',    -- Use data for AI training
        'data_sharing',   -- Share with third parties
        'research',       -- Research purposes
        'personalization' -- Personalized experience
    )),
    
    -- Consent state
    granted BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    consent_version VARCHAR(20) NOT NULL DEFAULT '1.0', -- Policy version consented to
    consent_source VARCHAR(50) DEFAULT 'signup', -- signup, settings, prompt
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id, consent_type)
);

CREATE INDEX idx_consent_records_user ON consent_records(user_id);
CREATE INDEX idx_consent_records_tenant ON consent_records(tenant_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);
CREATE INDEX idx_consent_records_granted ON consent_records(granted) WHERE granted = true;

-- Alias for compatibility with compliance reporter
CREATE VIEW user_consents AS SELECT * FROM consent_records;

-- ============================================================================
-- GDPR DATA SUBJECT REQUESTS
-- Tracks all GDPR requests (access, rectification, erasure, portability, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gdpr_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Request type (GDPR Articles 15-22)
    request_type VARCHAR(30) NOT NULL CHECK (request_type IN (
        'access',        -- Article 15: Right to access
        'rectification', -- Article 16: Right to rectification
        'erasure',       -- Article 17: Right to erasure (right to be forgotten)
        'restriction',   -- Article 18: Right to restriction
        'portability',   -- Article 20: Right to data portability
        'objection',     -- Article 21: Right to object
        'automated'      -- Article 22: Automated decision-making
    )),
    
    -- Request details
    details TEXT,
    fields_requested JSONB DEFAULT '[]', -- Specific fields for rectification
    
    -- Verification
    verification_method VARCHAR(50) NOT NULL DEFAULT 'email', -- email, id_document, mfa
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    
    -- Processing
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Awaiting processing
        'verified',     -- Identity verified
        'in_progress',  -- Being processed
        'completed',    -- Request fulfilled
        'rejected',     -- Request rejected (with reason)
        'expired'       -- Request expired
    )),
    
    -- Compliance deadline (30 days per GDPR)
    deadline TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    
    -- Fulfillment
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    response_data JSONB, -- Export data or confirmation
    rejection_reason TEXT,
    
    -- Audit
    processing_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gdpr_requests_user ON gdpr_requests(user_id);
CREATE INDEX idx_gdpr_requests_tenant ON gdpr_requests(tenant_id);
CREATE INDEX idx_gdpr_requests_type ON gdpr_requests(request_type);
CREATE INDEX idx_gdpr_requests_status ON gdpr_requests(status);
CREATE INDEX idx_gdpr_requests_deadline ON gdpr_requests(deadline) WHERE status NOT IN ('completed', 'rejected');

-- ============================================================================
-- DATA RETENTION POLICIES
-- Configurable retention periods per data type
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global policy
    
    -- Policy definition
    data_type VARCHAR(100) NOT NULL, -- e.g., 'session_data', 'audit_logs', 'user_data'
    retention_days INTEGER NOT NULL,
    legal_basis VARCHAR(50) NOT NULL CHECK (legal_basis IN (
        'consent',           -- User consent
        'contract',          -- Necessary for contract
        'legal_obligation',  -- Legal requirement
        'vital_interests',   -- Protect vital interests
        'public_interest',   -- Public interest
        'legitimate_interest' -- Legitimate business interest
    )),
    
    -- Actions
    action_on_expiry VARCHAR(30) NOT NULL DEFAULT 'delete' CHECK (action_on_expiry IN (
        'delete',      -- Hard delete
        'anonymize',   -- Remove PII but keep data
        'archive',     -- Move to archive
        'review'       -- Flag for manual review
    )),
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, data_type)
);

-- ============================================================================
-- PHI ACCESS LOG (HIPAA)
-- Detailed logging of all PHI access
-- ============================================================================

CREATE TABLE IF NOT EXISTS phi_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Access details
    access_type VARCHAR(30) NOT NULL CHECK (access_type IN (
        'view',
        'create',
        'update',
        'delete',
        'export',
        'print'
    )),
    
    -- Resource
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    phi_fields TEXT[], -- Which PHI fields were accessed
    
    -- Context
    purpose VARCHAR(100), -- Why PHI was accessed
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    
    -- Audit
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phi_access_tenant ON phi_access_log(tenant_id);
CREATE INDEX idx_phi_access_user ON phi_access_log(user_id);
CREATE INDEX idx_phi_access_resource ON phi_access_log(resource_type, resource_id);
CREATE INDEX idx_phi_access_time ON phi_access_log(accessed_at);

-- Partition by month for efficient querying (HIPAA requires 6 years retention)
-- Note: Partitioning would be done in production

-- ============================================================================
-- DATA PROCESSING AGREEMENTS (DPA)
-- Track DPAs with sub-processors
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_processing_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = platform-level
    
    -- Processor details
    processor_name VARCHAR(200) NOT NULL,
    processor_type VARCHAR(30) NOT NULL CHECK (processor_type IN (
        'ai_provider',
        'cloud_infrastructure',
        'analytics',
        'payment',
        'support',
        'other'
    )),
    
    -- Agreement
    dpa_signed_date DATE,
    dpa_expiry_date DATE,
    dpa_document_url TEXT,
    
    -- Data handled
    data_categories TEXT[], -- e.g., ['user_data', 'usage_data', 'phi']
    processing_purposes TEXT[],
    data_locations TEXT[], -- Regions where data is processed
    
    -- Security measures
    security_measures JSONB DEFAULT '{}',
    certifications TEXT[], -- e.g., ['SOC2', 'ISO27001', 'HIPAA']
    
    -- Contact
    dpo_contact VARCHAR(255),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
        'pending',
        'active', 
        'expired',
        'terminated'
    )),
    
    -- Audit
    last_review_date DATE,
    next_review_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- DATA BREACH INCIDENTS
-- Track and manage security breaches (GDPR Article 33-34, HIPAA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_breach_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = platform-wide
    
    -- Incident details
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN (
        'unauthorized_access',
        'data_theft',
        'ransomware',
        'accidental_disclosure',
        'system_breach',
        'insider_threat',
        'other'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    
    -- Discovery
    discovered_at TIMESTAMPTZ NOT NULL,
    discovered_by UUID REFERENCES users(id),
    discovery_method VARCHAR(100),
    
    -- Impact assessment
    data_types_affected TEXT[],
    records_affected INTEGER,
    users_affected INTEGER,
    phi_involved BOOLEAN DEFAULT false,
    
    -- Description
    description TEXT NOT NULL,
    root_cause TEXT,
    
    -- Containment
    contained_at TIMESTAMPTZ,
    containment_actions TEXT,
    
    -- Notification (GDPR: 72 hours to DPA, HIPAA: 60 days to affected)
    dpa_notified_at TIMESTAMPTZ,
    dpa_notification_ref VARCHAR(100),
    users_notified_at TIMESTAMPTZ,
    notification_method VARCHAR(50),
    
    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolution_actions TEXT,
    lessons_learned TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN (
        'open',
        'contained',
        'notifying',
        'resolved',
        'closed'
    )),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_breach_tenant ON data_breach_incidents(tenant_id);
CREATE INDEX idx_data_breach_status ON data_breach_incidents(status);
CREATE INDEX idx_data_breach_severity ON data_breach_incidents(severity);

-- ============================================================================
-- HIPAA CONFIGURATION
-- Per-tenant HIPAA settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS hipaa_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- HIPAA enablement
    hipaa_enabled BOOLEAN NOT NULL DEFAULT false,
    baa_signed_date DATE,
    baa_document_url TEXT,
    
    -- PHI handling
    phi_detection_enabled BOOLEAN DEFAULT true,
    phi_encryption_enabled BOOLEAN DEFAULT true,
    enhanced_logging_enabled BOOLEAN DEFAULT true,
    
    -- Access controls
    mfa_required BOOLEAN DEFAULT true,
    session_timeout_minutes INTEGER DEFAULT 15,
    access_review_days INTEGER DEFAULT 90,
    
    -- Data retention
    phi_retention_days INTEGER DEFAULT 2190, -- 6 years per HIPAA
    audit_retention_days INTEGER DEFAULT 2555, -- 7 years
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE phi_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_processing_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_breach_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hipaa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY consent_records_tenant_isolation ON consent_records
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY gdpr_requests_tenant_isolation ON gdpr_requests
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY data_retention_policies_isolation ON data_retention_policies
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY phi_access_log_tenant_isolation ON phi_access_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY dpa_tenant_isolation ON data_processing_agreements
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY breach_tenant_isolation ON data_breach_incidents
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY hipaa_config_tenant_isolation ON hipaa_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- DEFAULT DATA RETENTION POLICIES
-- ============================================================================

INSERT INTO data_retention_policies (tenant_id, data_type, retention_days, legal_basis, action_on_expiry, description)
VALUES 
    (NULL, 'session_data', 90, 'legitimate_interest', 'delete', 'User session and temporary data'),
    (NULL, 'usage_analytics', 730, 'legitimate_interest', 'anonymize', 'Usage metrics and analytics'),
    (NULL, 'audit_logs', 2555, 'legal_obligation', 'archive', 'Security and compliance audit logs (7 years)'),
    (NULL, 'user_account', 0, 'contract', 'delete', 'Active user account data (retained until deletion request)'),
    (NULL, 'phi_data', 2190, 'legal_obligation', 'archive', 'Protected Health Information (6 years per HIPAA)'),
    (NULL, 'billing_records', 2555, 'legal_obligation', 'archive', 'Financial records (7 years)'),
    (NULL, 'gdpr_requests', 1095, 'legal_obligation', 'archive', 'GDPR request records (3 years)'),
    (NULL, 'consent_records', 2555, 'legal_obligation', 'archive', 'Consent proof (7 years)')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEFAULT SUB-PROCESSORS
-- ============================================================================

INSERT INTO data_processing_agreements (processor_name, processor_type, dpa_signed_date, data_categories, processing_purposes, data_locations, certifications, status)
VALUES
    ('Amazon Web Services', 'cloud_infrastructure', '2024-01-01', 
     ARRAY['all'], ARRAY['hosting', 'storage', 'compute'], ARRAY['us-east-1', 'eu-west-1'], 
     ARRAY['SOC2', 'ISO27001', 'HIPAA', 'FedRAMP'], 'active'),
    ('Anthropic', 'ai_provider', '2024-01-01',
     ARRAY['prompts', 'responses'], ARRAY['ai_inference'], ARRAY['us'],
     ARRAY['SOC2'], 'active'),
    ('OpenAI', 'ai_provider', '2024-01-01',
     ARRAY['prompts', 'responses'], ARRAY['ai_inference'], ARRAY['us'],
     ARRAY['SOC2'], 'active'),
    ('Google Cloud', 'ai_provider', '2024-01-01',
     ARRAY['prompts', 'responses'], ARRAY['ai_inference'], ARRAY['us', 'eu'],
     ARRAY['SOC2', 'ISO27001', 'HIPAA'], 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has given consent
CREATE OR REPLACE FUNCTION check_consent(
    p_user_id UUID,
    p_consent_type VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
    v_granted BOOLEAN;
BEGIN
    SELECT granted INTO v_granted
    FROM consent_records
    WHERE user_id = p_user_id AND consent_type = p_consent_type;
    
    RETURN COALESCE(v_granted, false);
END;
$$ LANGUAGE plpgsql;

-- Function to record consent
CREATE OR REPLACE FUNCTION record_consent(
    p_tenant_id UUID,
    p_user_id UUID,
    p_consent_type VARCHAR(50),
    p_granted BOOLEAN,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO consent_records (
        tenant_id, user_id, consent_type, granted, 
        granted_at, ip_address, user_agent
    ) VALUES (
        p_tenant_id, p_user_id, p_consent_type, p_granted,
        CASE WHEN p_granted THEN NOW() ELSE NULL END,
        p_ip_address, p_user_agent
    )
    ON CONFLICT (tenant_id, user_id, consent_type)
    DO UPDATE SET 
        granted = p_granted,
        granted_at = CASE WHEN p_granted THEN NOW() ELSE consent_records.granted_at END,
        withdrawn_at = CASE WHEN NOT p_granted THEN NOW() ELSE NULL END,
        ip_address = COALESCE(p_ip_address, consent_records.ip_address),
        user_agent = COALESCE(p_user_agent, consent_records.user_agent),
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log PHI access
CREATE OR REPLACE FUNCTION log_phi_access(
    p_tenant_id UUID,
    p_user_id UUID,
    p_access_type VARCHAR(30),
    p_resource_type VARCHAR(100),
    p_resource_id VARCHAR(255),
    p_phi_fields TEXT[],
    p_purpose VARCHAR(100) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_session_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO phi_access_log (
        tenant_id, user_id, access_type, resource_type, resource_id,
        phi_fields, purpose, ip_address, session_id
    ) VALUES (
        p_tenant_id, p_user_id, p_access_type, p_resource_type, p_resource_id,
        p_phi_fields, p_purpose, p_ip_address, p_session_id
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check HIPAA status
CREATE OR REPLACE FUNCTION is_hipaa_enabled(p_tenant_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    v_enabled BOOLEAN;
BEGIN
    SELECT hipaa_enabled INTO v_enabled
    FROM hipaa_config
    WHERE tenant_id = p_tenant_id;
    
    RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql;
