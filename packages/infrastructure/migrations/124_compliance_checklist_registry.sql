-- RADIANT v4.18.0 - Migration 124: Compliance Checklist Registry
-- Versioned checklists linked to regulatory standards with auto-update support

-- ============================================================================
-- CHECKLIST VERSIONS
-- ============================================================================
-- Each regulatory standard can have multiple checklist versions

CREATE TABLE IF NOT EXISTS compliance_checklist_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id UUID NOT NULL REFERENCES regulatory_standards(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    version_date DATE NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    source_url VARCHAR(500),
    source_document VARCHAR(300),
    is_latest BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    change_summary TEXT,
    effective_date DATE,
    supersedes_version_id UUID REFERENCES compliance_checklist_versions(id),
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(standard_id, version)
);

CREATE INDEX idx_checklist_versions_standard ON compliance_checklist_versions(standard_id);
CREATE INDEX idx_checklist_versions_latest ON compliance_checklist_versions(is_latest) WHERE is_latest = true;

-- ============================================================================
-- CHECKLIST CATEGORIES
-- ============================================================================
-- Organize checklist items into categories (e.g., Pre-Audit, Documentation, Evidence)

CREATE TABLE IF NOT EXISTS compliance_checklist_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES compliance_checklist_versions(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(version_id, code)
);

CREATE INDEX idx_checklist_categories_version ON compliance_checklist_categories(version_id);

-- ============================================================================
-- CHECKLIST ITEMS
-- ============================================================================
-- Individual checklist items linked to a version

CREATE TABLE IF NOT EXISTS compliance_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES compliance_checklist_versions(id) ON DELETE CASCADE,
    category_id UUID REFERENCES compliance_checklist_categories(id) ON DELETE SET NULL,
    requirement_id UUID REFERENCES regulatory_requirements(id) ON DELETE SET NULL,
    item_code VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    guidance TEXT,
    evidence_types TEXT[], -- ['document', 'screenshot', 'config', 'log', 'attestation']
    api_endpoint VARCHAR(500), -- API endpoint for automated evidence collection
    automated_check_code VARCHAR(100), -- Link to system_audit_checks.check_code
    is_required BOOLEAN NOT NULL DEFAULT true,
    is_automatable BOOLEAN NOT NULL DEFAULT false,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    estimated_minutes INTEGER,
    display_order INTEGER NOT NULL DEFAULT 0,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(version_id, item_code)
);

CREATE INDEX idx_checklist_items_version ON compliance_checklist_items(version_id);
CREATE INDEX idx_checklist_items_category ON compliance_checklist_items(category_id);
CREATE INDEX idx_checklist_items_requirement ON compliance_checklist_items(requirement_id);
CREATE INDEX idx_checklist_items_automated ON compliance_checklist_items(automated_check_code) WHERE automated_check_code IS NOT NULL;

-- ============================================================================
-- TENANT CHECKLIST CONFIGURATION
-- ============================================================================
-- Per-tenant version selection per standard (auto = use latest)

CREATE TABLE IF NOT EXISTS tenant_checklist_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    standard_id UUID NOT NULL REFERENCES regulatory_standards(id) ON DELETE CASCADE,
    version_selection VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (version_selection IN ('auto', 'specific', 'pinned')),
    selected_version_id UUID REFERENCES compliance_checklist_versions(id) ON DELETE SET NULL,
    auto_update_enabled BOOLEAN NOT NULL DEFAULT true,
    notification_on_update BOOLEAN NOT NULL DEFAULT true,
    last_version_check_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, standard_id)
);

CREATE INDEX idx_tenant_checklist_config_tenant ON tenant_checklist_config(tenant_id);
CREATE INDEX idx_tenant_checklist_config_standard ON tenant_checklist_config(standard_id);

-- ============================================================================
-- TENANT CHECKLIST PROGRESS
-- ============================================================================
-- Track tenant progress on checklist items

CREATE TABLE IF NOT EXISTS tenant_checklist_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES compliance_checklist_items(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'not_started' 
        CHECK (status IN ('not_started', 'in_progress', 'completed', 'not_applicable', 'blocked')),
    completed_by VARCHAR(200),
    completed_at TIMESTAMPTZ,
    notes TEXT,
    evidence_ids UUID[], -- References to compliance_evidence.id
    blocked_reason TEXT,
    review_status VARCHAR(30) CHECK (review_status IN ('pending_review', 'approved', 'rejected')),
    reviewed_by VARCHAR(200),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, item_id)
);

CREATE INDEX idx_tenant_checklist_progress_tenant ON tenant_checklist_progress(tenant_id);
CREATE INDEX idx_tenant_checklist_progress_item ON tenant_checklist_progress(item_id);
CREATE INDEX idx_tenant_checklist_progress_status ON tenant_checklist_progress(status);

-- ============================================================================
-- CHECKLIST AUDIT RUNS
-- ============================================================================
-- Track when checklists are audited/reviewed

CREATE TABLE IF NOT EXISTS checklist_audit_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES compliance_checklist_versions(id) ON DELETE CASCADE,
    run_type VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (run_type IN ('manual', 'scheduled', 'pre_audit', 'certification')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled', 'failed')),
    total_items INTEGER NOT NULL DEFAULT 0,
    completed_items INTEGER NOT NULL DEFAULT 0,
    passed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    skipped_items INTEGER NOT NULL DEFAULT 0,
    score DECIMAL(5,2),
    triggered_by VARCHAR(200),
    notes TEXT,
    report_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_audit_runs_tenant ON checklist_audit_runs(tenant_id);
CREATE INDEX idx_checklist_audit_runs_version ON checklist_audit_runs(version_id);

-- ============================================================================
-- REGULATORY VERSION UPDATES
-- ============================================================================
-- Track regulatory standard version updates from external sources

CREATE TABLE IF NOT EXISTS regulatory_version_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id UUID NOT NULL REFERENCES regulatory_standards(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL, -- 'manual', 'api_fetch', 'rss_feed', 'webhook'
    source_url VARCHAR(500),
    old_version VARCHAR(50),
    new_version VARCHAR(50) NOT NULL,
    change_type VARCHAR(30) NOT NULL CHECK (change_type IN ('major', 'minor', 'patch', 'errata', 'guidance')),
    change_summary TEXT,
    effective_date DATE,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processing_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'ignored')),
    processing_notes TEXT,
    checklist_version_created_id UUID REFERENCES compliance_checklist_versions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regulatory_version_updates_standard ON regulatory_version_updates(standard_id);
CREATE INDEX idx_regulatory_version_updates_status ON regulatory_version_updates(processing_status);

-- ============================================================================
-- CHECKLIST UPDATE SOURCES
-- ============================================================================
-- Configure sources for automatic regulatory updates

CREATE TABLE IF NOT EXISTS checklist_update_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id UUID NOT NULL REFERENCES regulatory_standards(id) ON DELETE CASCADE,
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('rss_feed', 'api', 'webhook', 'manual')),
    source_name VARCHAR(200) NOT NULL,
    source_url VARCHAR(500),
    api_key_secret_name VARCHAR(200),
    check_frequency_hours INTEGER NOT NULL DEFAULT 24,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    last_check_at TIMESTAMPTZ,
    last_update_found_at TIMESTAMPTZ,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_update_sources_standard ON checklist_update_sources(standard_id);
CREATE INDEX idx_checklist_update_sources_enabled ON checklist_update_sources(is_enabled) WHERE is_enabled = true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_checklist_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_checklist_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_checklist_config_isolation ON tenant_checklist_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_checklist_progress_isolation ON tenant_checklist_progress
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY checklist_audit_runs_isolation ON checklist_audit_runs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get effective checklist version for a tenant and standard
CREATE OR REPLACE FUNCTION get_effective_checklist_version(
    p_tenant_id UUID,
    p_standard_id UUID
) RETURNS UUID AS $$
DECLARE
    v_config tenant_checklist_config%ROWTYPE;
    v_version_id UUID;
BEGIN
    -- Get tenant config
    SELECT * INTO v_config
    FROM tenant_checklist_config
    WHERE tenant_id = p_tenant_id AND standard_id = p_standard_id;
    
    -- If no config or auto mode, return latest version
    IF v_config.id IS NULL OR v_config.version_selection = 'auto' THEN
        SELECT id INTO v_version_id
        FROM compliance_checklist_versions
        WHERE standard_id = p_standard_id AND is_latest = true AND is_active = true
        LIMIT 1;
        RETURN v_version_id;
    END IF;
    
    -- Return selected version
    RETURN v_config.selected_version_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate checklist completion percentage for a tenant
CREATE OR REPLACE FUNCTION calculate_checklist_completion(
    p_tenant_id UUID,
    p_version_id UUID
) RETURNS DECIMAL AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM compliance_checklist_items
    WHERE version_id = p_version_id AND is_required = true;
    
    IF v_total = 0 THEN
        RETURN 100.0;
    END IF;
    
    SELECT COUNT(*) INTO v_completed
    FROM tenant_checklist_progress p
    JOIN compliance_checklist_items i ON p.item_id = i.id
    WHERE p.tenant_id = p_tenant_id 
      AND i.version_id = p_version_id 
      AND i.is_required = true
      AND p.status IN ('completed', 'not_applicable');
    
    RETURN ROUND((v_completed::DECIMAL / v_total) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Set latest version flag (ensures only one latest per standard)
CREATE OR REPLACE FUNCTION set_latest_checklist_version(
    p_version_id UUID
) RETURNS VOID AS $$
DECLARE
    v_standard_id UUID;
BEGIN
    -- Get standard ID
    SELECT standard_id INTO v_standard_id
    FROM compliance_checklist_versions
    WHERE id = p_version_id;
    
    -- Clear previous latest
    UPDATE compliance_checklist_versions
    SET is_latest = false, updated_at = NOW()
    WHERE standard_id = v_standard_id AND is_latest = true;
    
    -- Set new latest
    UPDATE compliance_checklist_versions
    SET is_latest = true, updated_at = NOW()
    WHERE id = p_version_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA: INITIAL CHECKLIST VERSIONS
-- ============================================================================

-- SOC 2 Type II Checklist v2024.1
INSERT INTO compliance_checklist_versions (id, standard_id, version, version_date, title, description, is_latest, is_active)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    id,
    '2024.1',
    '2024-01-01',
    'SOC 2 Type II Pre-Audit Checklist',
    'Comprehensive pre-audit checklist for SOC 2 Type II certification based on AICPA Trust Services Criteria 2017',
    true,
    true
FROM regulatory_standards WHERE code = 'SOC2';

-- HIPAA Checklist v2024.1
INSERT INTO compliance_checklist_versions (id, standard_id, version, version_date, title, description, is_latest, is_active)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid,
    id,
    '2024.1',
    '2024-01-01',
    'HIPAA Compliance Checklist',
    'HIPAA Security Rule and Privacy Rule compliance checklist based on 45 CFR Parts 160, 162, and 164',
    true,
    true
FROM regulatory_standards WHERE code = 'HIPAA';

-- GDPR Checklist v2024.1
INSERT INTO compliance_checklist_versions (id, standard_id, version, version_date, title, description, is_latest, is_active)
SELECT 
    'c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid,
    id,
    '2024.1',
    '2024-01-01',
    'GDPR Compliance Checklist',
    'General Data Protection Regulation compliance checklist covering all articles and recitals',
    true,
    true
FROM regulatory_standards WHERE code = 'GDPR';

-- ISO 27001 Checklist v2022.1
INSERT INTO compliance_checklist_versions (id, standard_id, version, version_date, title, description, is_latest, is_active)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345'::uuid,
    id,
    '2022.1',
    '2022-10-25',
    'ISO 27001:2022 Compliance Checklist',
    'ISO/IEC 27001:2022 Annex A controls checklist with 93 controls across 4 themes',
    true,
    true
FROM regulatory_standards WHERE code = 'ISO27001';

-- PCI-DSS Checklist v4.0
INSERT INTO compliance_checklist_versions (id, standard_id, version, version_date, title, description, is_latest, is_active)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456'::uuid,
    id,
    '4.0',
    '2024-03-31',
    'PCI-DSS v4.0 Compliance Checklist',
    'Payment Card Industry Data Security Standard v4.0 self-assessment checklist',
    true,
    true
FROM regulatory_standards WHERE code = 'PCI-DSS';

-- ============================================================================
-- SEED DATA: SOC 2 CHECKLIST CATEGORIES
-- ============================================================================

INSERT INTO compliance_checklist_categories (version_id, code, name, description, display_order, icon) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'pre_audit', 'Pre-Audit Preparation', 'Steps to complete before the audit begins', 1, 'clipboard-list'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'documentation', 'Required Documentation', 'Documents that must be prepared and available', 2, 'file-text'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'evidence', 'Evidence Collection', 'Evidence artifacts to gather for auditors', 3, 'folder-open'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'access_control', 'Access Control (CC5)', 'Logical and physical access controls', 4, 'shield'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'change_mgmt', 'Change Management (CC8)', 'Change management and deployment controls', 5, 'git-branch'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'risk_mgmt', 'Risk Management (CC3)', 'Risk assessment and mitigation controls', 6, 'alert-triangle'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'monitoring', 'Monitoring (CC7)', 'System monitoring and alerting controls', 7, 'activity');

-- ============================================================================
-- SEED DATA: SOC 2 CHECKLIST ITEMS (Pre-Audit Category)
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, automated_check_code, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-PRE-001',
    'Run self-audit for all frameworks',
    'Execute automated compliance self-audit to identify gaps before external audit',
    'Navigate to Security → Self-Audit and run a full audit. Review all critical failures and remediate before proceeding.',
    ARRAY['audit_report', 'screenshot'],
    '/api/admin/self-audit/run',
    'soc2_self_audit',
    true,
    true,
    'critical',
    15,
    1
FROM compliance_checklist_categories c WHERE c.code = 'pre_audit' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-PRE-002',
    'Export audit logs for review period',
    'Export all audit logs covering the audit period (typically 6-12 months)',
    'Export via Admin Dashboard → Audit Logs → Export. Ensure date range covers full audit period.',
    ARRAY['log', 'document'],
    '/api/admin/audit-logs/export',
    true,
    true,
    'high',
    30,
    2
FROM compliance_checklist_categories c WHERE c.code = 'pre_audit' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-PRE-003',
    'Verify MFA enforcement for all administrators',
    'Confirm multi-factor authentication is enabled and enforced for all admin accounts',
    'Check Cognito User Pool settings and verify no admin accounts have MFA disabled.',
    ARRAY['screenshot', 'config'],
    true,
    'critical',
    15,
    3
FROM compliance_checklist_categories c WHERE c.code = 'pre_audit' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-PRE-004',
    'Review and update security policies',
    'Ensure all security policies are current and approved by management',
    'Review Information Security Policy, Access Control Policy, Incident Response Plan, and Business Continuity Plan.',
    ARRAY['document', 'attestation'],
    true,
    'high',
    60,
    4
FROM compliance_checklist_categories c WHERE c.code = 'pre_audit' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-PRE-005',
    'Confirm data retention policies are enforced',
    'Verify automated data retention and deletion is functioning correctly',
    'Check retention policy configuration and verify scheduled deletion jobs are running.',
    ARRAY['config', 'log'],
    true,
    'high',
    20,
    5
FROM compliance_checklist_categories c WHERE c.code = 'pre_audit' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-PRE-006',
    'Verify all evidence artifacts are accessible',
    'Confirm all required evidence documents can be retrieved and presented to auditors',
    'Test access to all evidence storage locations and verify document integrity.',
    ARRAY['document'],
    true,
    'medium',
    30,
    6
FROM compliance_checklist_categories c WHERE c.code = 'pre_audit' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- ============================================================================
-- SEED DATA: SOC 2 DOCUMENTATION CATEGORY ITEMS
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-DOC-001',
    'System Security Plan (SSP)',
    'Comprehensive document describing system architecture and security controls',
    'Must include system boundaries, data flows, third-party integrations, and control descriptions.',
    ARRAY['document'],
    true,
    'critical',
    240,
    1
FROM compliance_checklist_categories c WHERE c.code = 'documentation' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-DOC-002',
    'Data Flow Diagram',
    'Visual representation of how data moves through the system',
    'Show data ingress, processing, storage, and egress points. Include encryption status at each stage.',
    ARRAY['document', 'screenshot'],
    true,
    'high',
    120,
    2
FROM compliance_checklist_categories c WHERE c.code = 'documentation' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-DOC-003',
    'Access Control Matrix',
    'Document mapping roles to permissions across all systems',
    'Include all user roles, their permissions, and the approval process for access changes.',
    ARRAY['document'],
    true,
    'high',
    90,
    3
FROM compliance_checklist_categories c WHERE c.code = 'documentation' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-DOC-004',
    'Incident Response Plan',
    'Documented procedures for handling security incidents',
    'Must include incident classification, escalation procedures, communication templates, and post-incident review process.',
    ARRAY['document'],
    true,
    'critical',
    180,
    4
FROM compliance_checklist_categories c WHERE c.code = 'documentation' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-DOC-005',
    'Business Continuity Plan',
    'Plan for maintaining operations during disruptions',
    'Include RTO/RPO targets, backup procedures, failover processes, and recovery testing results.',
    ARRAY['document'],
    true,
    'high',
    180,
    5
FROM compliance_checklist_categories c WHERE c.code = 'documentation' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-DOC-006',
    'Vendor Management Policy',
    'Policy for evaluating and managing third-party vendors',
    'Include vendor risk assessment criteria, security questionnaire, and ongoing monitoring requirements.',
    ARRAY['document'],
    true,
    'medium',
    90,
    6
FROM compliance_checklist_categories c WHERE c.code = 'documentation' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- ============================================================================
-- SEED DATA: SOC 2 EVIDENCE CATEGORY ITEMS
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-EVD-001',
    'Audit log samples',
    'Export samples of audit logs demonstrating logging completeness',
    'Include samples showing login attempts, data access, configuration changes, and admin actions.',
    ARRAY['log'],
    '/api/admin/audit-logs/export',
    true,
    true,
    'high',
    30,
    1
FROM compliance_checklist_categories c WHERE c.code = 'evidence' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-EVD-002',
    'User access review evidence',
    'Documentation of periodic user access reviews',
    'Show evidence of quarterly access reviews with approvals and any access removals.',
    ARRAY['document', 'screenshot'],
    '/api/admin/users/access-logs/export',
    true,
    true,
    'high',
    45,
    2
FROM compliance_checklist_categories c WHERE c.code = 'evidence' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-EVD-003',
    'Encryption configuration screenshots',
    'Evidence of encryption at rest and in transit',
    'Include KMS key policies, TLS configuration, and database encryption settings.',
    ARRAY['screenshot', 'config'],
    true,
    'high',
    30,
    3
FROM compliance_checklist_categories c WHERE c.code = 'evidence' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-EVD-004',
    'Change management tickets',
    'Sample of change requests with approvals',
    'Provide 5-10 samples of production changes showing request, approval, testing, and deployment.',
    ARRAY['document', 'screenshot'],
    true,
    'high',
    60,
    4
FROM compliance_checklist_categories c WHERE c.code = 'evidence' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-EVD-005',
    'Vulnerability scan reports',
    'Recent vulnerability assessment results',
    'Include internal and external scans, remediation status, and risk acceptance documentation.',
    ARRAY['audit_report'],
    true,
    'high',
    30,
    5
FROM compliance_checklist_categories c WHERE c.code = 'evidence' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    c.id,
    'SOC2-EVD-006',
    'Backup and recovery test results',
    'Evidence of backup testing and successful restoration',
    'Show backup configuration, test schedule, and results of recent recovery test.',
    ARRAY['document', 'log'],
    true,
    'high',
    45,
    6
FROM compliance_checklist_categories c WHERE c.code = 'evidence' AND c.version_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- ============================================================================
-- SEED DATA: HIPAA CHECKLIST CATEGORIES
-- ============================================================================

INSERT INTO compliance_checklist_categories (version_id, code, name, description, display_order, icon) VALUES
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'admin_safeguards', 'Administrative Safeguards', '45 CFR §164.308 - Administrative requirements', 1, 'users'),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'physical_safeguards', 'Physical Safeguards', '45 CFR §164.310 - Physical access controls', 2, 'building'),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'technical_safeguards', 'Technical Safeguards', '45 CFR §164.312 - Technical security measures', 3, 'shield'),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'policies', 'Policies & Procedures', '45 CFR §164.316 - Required documentation', 4, 'file-text'),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'breach', 'Breach Notification', '45 CFR §164.400-414 - Breach procedures', 5, 'alert-triangle');

-- ============================================================================
-- SEED DATA: HIPAA ADMINISTRATIVE SAFEGUARDS ITEMS
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-ADMIN-001',
    'Designate Security Officer',
    'Appoint a Security Officer responsible for HIPAA compliance',
    'Document the appointment with name, role, responsibilities, and effective date. Must have authority to implement security policies.',
    ARRAY['document', 'attestation'],
    true,
    'critical',
    30,
    1
FROM compliance_checklist_categories c WHERE c.code = 'admin_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-ADMIN-002',
    'Conduct Risk Analysis',
    'Perform comprehensive risk analysis of PHI handling',
    'Identify all systems that create, receive, maintain, or transmit PHI. Document threats, vulnerabilities, and risk levels.',
    ARRAY['document', 'audit_report'],
    true,
    'critical',
    480,
    2
FROM compliance_checklist_categories c WHERE c.code = 'admin_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-ADMIN-003',
    'Implement Risk Management Plan',
    'Create and implement measures to reduce identified risks',
    'Document security measures implemented for each identified risk. Include timeline and responsible parties.',
    ARRAY['document'],
    true,
    'critical',
    240,
    3
FROM compliance_checklist_categories c WHERE c.code = 'admin_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-ADMIN-004',
    'Workforce Training Program',
    'Train all workforce members on PHI handling',
    'Maintain training records including date, attendees, topics covered, and acknowledgment signatures.',
    ARRAY['document', 'log'],
    true,
    'high',
    120,
    4
FROM compliance_checklist_categories c WHERE c.code = 'admin_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-ADMIN-005',
    'Sanction Policy',
    'Establish sanctions for workforce members who violate policies',
    'Document sanction levels, escalation procedures, and examples. Ensure HR alignment.',
    ARRAY['document', 'policy'],
    true,
    'high',
    60,
    5
FROM compliance_checklist_categories c WHERE c.code = 'admin_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-ADMIN-006',
    'Contingency Plan',
    'Create data backup and disaster recovery plan',
    'Include RTO/RPO targets, backup procedures, emergency mode operations, and testing schedule.',
    ARRAY['document', 'procedure'],
    true,
    'critical',
    180,
    6
FROM compliance_checklist_categories c WHERE c.code = 'admin_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

-- ============================================================================
-- SEED DATA: HIPAA TECHNICAL SAFEGUARDS ITEMS
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-TECH-001',
    'Unique User Identification',
    'Assign unique identifier for each user accessing PHI',
    'Verify all users have unique IDs. No shared accounts for PHI access.',
    ARRAY['screenshot', 'config'],
    '/api/admin/users',
    true,
    true,
    'critical',
    30,
    1
FROM compliance_checklist_categories c WHERE c.code = 'technical_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-TECH-002',
    'Automatic Logoff',
    'Implement automatic session termination after inactivity',
    'Configure session timeout ≤15 minutes for PHI systems. Document configuration.',
    ARRAY['screenshot', 'config'],
    '/api/admin/security/sessions',
    true,
    true,
    'high',
    20,
    2
FROM compliance_checklist_categories c WHERE c.code = 'technical_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-TECH-003',
    'Encryption at Rest',
    'Encrypt all PHI stored in databases and file systems',
    'Verify AES-256 encryption for all PHI storage. Document KMS key policies.',
    ARRAY['config', 'screenshot'],
    '/api/admin/security/encryption',
    true,
    true,
    'critical',
    30,
    3
FROM compliance_checklist_categories c WHERE c.code = 'technical_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-TECH-004',
    'Encryption in Transit',
    'Encrypt all PHI during transmission',
    'Verify TLS 1.2+ for all connections. Document certificate management.',
    ARRAY['config', 'screenshot'],
    true,
    'critical',
    30,
    4
FROM compliance_checklist_categories c WHERE c.code = 'technical_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-TECH-005',
    'Audit Controls',
    'Implement audit logging for all PHI access',
    'Verify all PHI access is logged with user, timestamp, action, and resource.',
    ARRAY['log', 'config'],
    '/api/admin/audit-logs',
    true,
    true,
    'critical',
    45,
    5
FROM compliance_checklist_categories c WHERE c.code = 'technical_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-TECH-006',
    'Integrity Controls',
    'Implement mechanisms to ensure PHI is not improperly altered',
    'Document integrity verification methods (checksums, digital signatures).',
    ARRAY['document', 'config'],
    true,
    'high',
    60,
    6
FROM compliance_checklist_categories c WHERE c.code = 'technical_safeguards' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

-- ============================================================================
-- SEED DATA: HIPAA BREACH NOTIFICATION ITEMS
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-BREACH-001',
    'Breach Response Plan',
    'Document procedures for responding to PHI breaches',
    'Include detection, containment, investigation, notification, and remediation steps.',
    ARRAY['document', 'procedure'],
    true,
    'critical',
    180,
    1
FROM compliance_checklist_categories c WHERE c.code = 'breach' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-BREACH-002',
    '60-Day Notification Timeline',
    'Establish process to notify within 60 days of discovery',
    'Document notification templates, contact lists, and escalation procedures.',
    ARRAY['document', 'procedure'],
    true,
    'critical',
    60,
    2
FROM compliance_checklist_categories c WHERE c.code = 'breach' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    c.id,
    'HIPAA-BREACH-003',
    'HHS Notification Process',
    'Document process for notifying HHS of breaches',
    'Include thresholds (500+ individuals = immediate, <500 = annual log).',
    ARRAY['document', 'procedure'],
    true,
    'high',
    45,
    3
FROM compliance_checklist_categories c WHERE c.code = 'breach' AND c.version_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

-- ============================================================================
-- SEED DATA: GDPR CHECKLIST CATEGORIES
-- ============================================================================

INSERT INTO compliance_checklist_categories (version_id, code, name, description, display_order, icon) VALUES
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'lawful_basis', 'Lawful Basis', 'Article 6 - Legal grounds for processing', 1, 'scale'),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'data_rights', 'Data Subject Rights', 'Articles 12-23 - Individual rights', 2, 'user'),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'security', 'Security Measures', 'Article 32 - Technical and organizational measures', 3, 'shield'),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'transfers', 'International Transfers', 'Articles 44-49 - Cross-border data transfers', 4, 'globe'),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'accountability', 'Accountability', 'Article 5(2) - Demonstrating compliance', 5, 'clipboard-check');

-- ============================================================================
-- SEED DATA: GDPR DATA RIGHTS ITEMS
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'c3d4e5f6-a7b8-9012-cdef-345678901234',
    c.id,
    'GDPR-RIGHTS-001',
    'Right of Access (Art. 15)',
    'Provide mechanism for data subject access requests',
    'Implement DSAR portal. Response within 30 days. Include all personal data categories.',
    ARRAY['document', 'screenshot'],
    '/api/gdpr/request/access',
    true,
    true,
    'critical',
    120,
    1
FROM compliance_checklist_categories c WHERE c.code = 'data_rights' AND c.version_id = 'c3d4e5f6-a7b8-9012-cdef-345678901234';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'c3d4e5f6-a7b8-9012-cdef-345678901234',
    c.id,
    'GDPR-RIGHTS-002',
    'Right to Erasure (Art. 17)',
    'Implement data deletion capability',
    'Support deletion requests. Document retention exceptions. Verify cascade deletion.',
    ARRAY['document', 'log'],
    '/api/gdpr/request/erasure',
    true,
    true,
    'critical',
    90,
    2
FROM compliance_checklist_categories c WHERE c.code = 'data_rights' AND c.version_id = 'c3d4e5f6-a7b8-9012-cdef-345678901234';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'c3d4e5f6-a7b8-9012-cdef-345678901234',
    c.id,
    'GDPR-RIGHTS-003',
    'Right to Portability (Art. 20)',
    'Enable data export in machine-readable format',
    'Support JSON/CSV export. Include all personal data. Automated delivery.',
    ARRAY['document', 'screenshot'],
    '/api/gdpr/request/portability',
    true,
    true,
    'high',
    60,
    3
FROM compliance_checklist_categories c WHERE c.code = 'data_rights' AND c.version_id = 'c3d4e5f6-a7b8-9012-cdef-345678901234';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'c3d4e5f6-a7b8-9012-cdef-345678901234',
    c.id,
    'GDPR-RIGHTS-004',
    'Right to Rectification (Art. 16)',
    'Allow data subjects to correct inaccurate data',
    'Provide self-service data editing. Log all changes. Propagate to third parties.',
    ARRAY['document', 'screenshot'],
    true,
    'high',
    45,
    4
FROM compliance_checklist_categories c WHERE c.code = 'data_rights' AND c.version_id = 'c3d4e5f6-a7b8-9012-cdef-345678901234';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'c3d4e5f6-a7b8-9012-cdef-345678901234',
    c.id,
    'GDPR-RIGHTS-005',
    '72-Hour Breach Notification',
    'Notify supervisory authority within 72 hours of breach',
    'Document breach detection process, notification templates, and DPO contact.',
    ARRAY['document', 'procedure'],
    true,
    'critical',
    90,
    5
FROM compliance_checklist_categories c WHERE c.code = 'data_rights' AND c.version_id = 'c3d4e5f6-a7b8-9012-cdef-345678901234';

-- ============================================================================
-- SEED DATA: ISO 27001:2022 CHECKLIST CATEGORIES
-- ============================================================================

INSERT INTO compliance_checklist_categories (version_id, code, name, description, display_order, icon) VALUES
('d4e5f6a7-b8c9-0123-defa-456789012345', 'organizational', 'Organizational Controls', 'Annex A.5 - 37 organizational controls', 1, 'building'),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'people', 'People Controls', 'Annex A.6 - 8 people controls', 2, 'users'),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'physical', 'Physical Controls', 'Annex A.7 - 14 physical controls', 3, 'lock'),
('d4e5f6a7-b8c9-0123-defa-456789012345', 'technological', 'Technological Controls', 'Annex A.8 - 34 technological controls', 4, 'cpu');

-- ============================================================================
-- SEED DATA: ISO 27001 ORGANIZATIONAL CONTROLS
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-ORG-001',
    'A.5.1 Information Security Policies',
    'Define and approve information security policy and topic-specific policies',
    'Create comprehensive ISMS policy approved by management. Include scope, objectives, and responsibilities.',
    ARRAY['document', 'policy'],
    true,
    'critical',
    240,
    1
FROM compliance_checklist_categories c WHERE c.code = 'organizational' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-ORG-002',
    'A.5.2 Information Security Roles',
    'Define and allocate information security roles and responsibilities',
    'Document CISO, Security Team, and department responsibilities. Include RACI matrix.',
    ARRAY['document'],
    true,
    'critical',
    120,
    2
FROM compliance_checklist_categories c WHERE c.code = 'organizational' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-ORG-003',
    'A.5.3 Segregation of Duties',
    'Separate conflicting duties to reduce fraud and error risk',
    'Document duty segregation for financial, development, and operations functions.',
    ARRAY['document', 'config'],
    true,
    'high',
    90,
    3
FROM compliance_checklist_categories c WHERE c.code = 'organizational' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-ORG-004',
    'A.5.4 Management Responsibilities',
    'Ensure management enforces security policy compliance',
    'Document management commitment, security governance, and enforcement mechanisms.',
    ARRAY['document', 'attestation'],
    true,
    'high',
    60,
    4
FROM compliance_checklist_categories c WHERE c.code = 'organizational' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-ORG-005',
    'A.5.7 Threat Intelligence',
    'Collect and analyze threat intelligence',
    'Subscribe to threat feeds, document analysis process, integrate with SIEM.',
    ARRAY['document', 'log'],
    true,
    'high',
    120,
    5
FROM compliance_checklist_categories c WHERE c.code = 'organizational' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-ORG-006',
    'A.5.8 Project Security',
    'Integrate security into project management',
    'Define security gates for projects. Include security requirements in project charters.',
    ARRAY['document', 'procedure'],
    true,
    'medium',
    90,
    6
FROM compliance_checklist_categories c WHERE c.code = 'organizational' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

-- ============================================================================
-- SEED DATA: ISO 27001 TECHNOLOGICAL CONTROLS
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-TECH-001',
    'A.8.1 User Endpoint Devices',
    'Secure user endpoint devices',
    'Implement endpoint protection, encryption, and mobile device management.',
    ARRAY['config', 'screenshot'],
    '/api/admin/security/endpoints',
    true,
    true,
    'high',
    60,
    1
FROM compliance_checklist_categories c WHERE c.code = 'technological' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-TECH-002',
    'A.8.2 Privileged Access Rights',
    'Restrict and manage privileged access',
    'Implement PAM solution. Document privileged accounts and review schedule.',
    ARRAY['config', 'log'],
    '/api/admin/users/privileged',
    true,
    true,
    'critical',
    90,
    2
FROM compliance_checklist_categories c WHERE c.code = 'technological' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-TECH-003',
    'A.8.5 Secure Authentication',
    'Implement secure authentication mechanisms',
    'Enforce MFA for all users. Document password policies and authentication methods.',
    ARRAY['config', 'screenshot'],
    '/api/admin/security/authentication',
    true,
    true,
    'critical',
    45,
    3
FROM compliance_checklist_categories c WHERE c.code = 'technological' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-TECH-004',
    'A.8.9 Configuration Management',
    'Define and maintain secure configurations',
    'Document baseline configurations. Implement configuration drift detection.',
    ARRAY['config', 'document'],
    '/api/admin/security/config-baseline',
    true,
    true,
    'high',
    120,
    4
FROM compliance_checklist_categories c WHERE c.code = 'technological' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-TECH-005',
    'A.8.15 Logging',
    'Produce and protect activity logs',
    'Configure comprehensive logging. Ensure log integrity and retention.',
    ARRAY['config', 'log'],
    '/api/admin/audit-logs',
    true,
    true,
    'critical',
    60,
    5
FROM compliance_checklist_categories c WHERE c.code = 'technological' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    c.id,
    'ISO-TECH-006',
    'A.8.24 Use of Cryptography',
    'Define and implement cryptographic controls',
    'Document encryption algorithms, key management, and certificate lifecycle.',
    ARRAY['document', 'config'],
    true,
    'critical',
    90,
    6
FROM compliance_checklist_categories c WHERE c.code = 'technological' AND c.version_id = 'd4e5f6a7-b8c9-0123-defa-456789012345';

-- ============================================================================
-- SEED DATA: PCI-DSS v4.0 CHECKLIST CATEGORIES
-- ============================================================================

INSERT INTO compliance_checklist_categories (version_id, code, name, description, display_order, icon) VALUES
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req1_network', 'Req 1: Network Security', 'Install and maintain network security controls', 1, 'shield'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req2_secure_config', 'Req 2: Secure Configurations', 'Apply secure configurations to all system components', 2, 'settings'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req3_protect_data', 'Req 3: Protect Stored Data', 'Protect stored account data', 3, 'database'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req4_encryption', 'Req 4: Encryption in Transit', 'Protect cardholder data with strong cryptography during transmission', 4, 'lock'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req5_malware', 'Req 5: Protect Against Malware', 'Protect all systems and networks from malicious software', 5, 'bug'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req6_secure_dev', 'Req 6: Secure Development', 'Develop and maintain secure systems and software', 6, 'code'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req7_access', 'Req 7: Restrict Access', 'Restrict access to cardholder data by business need-to-know', 7, 'user-x'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req8_identify', 'Req 8: Identify Users', 'Identify users and authenticate access to system components', 8, 'user-check'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req9_physical', 'Req 9: Physical Access', 'Restrict physical access to cardholder data', 9, 'building'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req10_logging', 'Req 10: Log and Monitor', 'Log and monitor all access to system components and cardholder data', 10, 'activity'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req11_testing', 'Req 11: Test Security', 'Test security of systems and networks regularly', 11, 'search'),
('e5f6a7b8-c9d0-1234-efab-567890123456', 'req12_policy', 'Req 12: Security Policy', 'Support information security with organizational policies and programs', 12, 'file-text');

-- ============================================================================
-- SEED DATA: PCI-DSS REQ 1 - NETWORK SECURITY
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-1.1',
    '1.1 Network Security Controls Defined',
    'Processes and mechanisms for installing and maintaining NSCs are defined and understood',
    'Document firewall rules, network segmentation, and security control configurations.',
    ARRAY['document', 'config'],
    true,
    'critical',
    120,
    1
FROM compliance_checklist_categories c WHERE c.code = 'req1_network' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-1.2',
    '1.2 NSCs Configured and Maintained',
    'Network security controls are configured and maintained',
    'Review firewall rulesets. Document deny-all default and exceptions.',
    ARRAY['config', 'screenshot'],
    true,
    'critical',
    90,
    2
FROM compliance_checklist_categories c WHERE c.code = 'req1_network' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-1.3',
    '1.3 Network Access Restricted',
    'Network access to and from the CDE is restricted',
    'Document CDE boundaries and all inbound/outbound traffic flows.',
    ARRAY['document', 'config'],
    true,
    'critical',
    60,
    3
FROM compliance_checklist_categories c WHERE c.code = 'req1_network' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

-- ============================================================================
-- SEED DATA: PCI-DSS REQ 3 - PROTECT STORED DATA
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-3.1',
    '3.1 Data Retention Defined',
    'Processes for protecting stored account data are defined and understood',
    'Document retention periods, disposal procedures, and data flow diagrams.',
    ARRAY['document'],
    true,
    'critical',
    90,
    1
FROM compliance_checklist_categories c WHERE c.code = 'req3_protect_data' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-3.4',
    '3.4 PAN Rendered Unreadable',
    'PAN is rendered unreadable anywhere it is stored',
    'Verify encryption or tokenization of all stored PAN data.',
    ARRAY['config', 'log'],
    '/api/admin/security/encryption',
    true,
    true,
    'critical',
    45,
    2
FROM compliance_checklist_categories c WHERE c.code = 'req3_protect_data' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-3.5',
    '3.5 Cryptographic Keys Protected',
    'Primary Account Number is secured with strong cryptographic keys',
    'Document key management procedures including generation, distribution, storage, rotation, and destruction.',
    ARRAY['document', 'config'],
    true,
    'critical',
    120,
    3
FROM compliance_checklist_categories c WHERE c.code = 'req3_protect_data' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

-- ============================================================================
-- SEED DATA: PCI-DSS REQ 8 - IDENTIFY USERS
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-8.2',
    '8.2 User Identification Managed',
    'User identification and related accounts are strictly managed',
    'Ensure unique IDs for all users. No shared or generic accounts.',
    ARRAY['config', 'screenshot'],
    '/api/admin/users',
    true,
    true,
    'critical',
    60,
    1
FROM compliance_checklist_categories c WHERE c.code = 'req8_identify' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-8.3',
    '8.3 Strong Authentication',
    'Strong authentication for users and administrators is established',
    'Implement MFA for all access to CDE. Document authentication requirements.',
    ARRAY['config', 'screenshot'],
    '/api/admin/security/mfa',
    true,
    true,
    'critical',
    45,
    2
FROM compliance_checklist_categories c WHERE c.code = 'req8_identify' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-8.4',
    '8.4 MFA for CDE Access',
    'MFA is implemented to secure access into the CDE',
    'Verify MFA is required for all remote and console access to CDE.',
    ARRAY['config', 'screenshot'],
    true,
    'critical',
    30,
    3
FROM compliance_checklist_categories c WHERE c.code = 'req8_identify' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

-- ============================================================================
-- SEED DATA: PCI-DSS REQ 10 - LOGGING
-- ============================================================================

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, api_endpoint, is_required, is_automatable, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-10.2',
    '10.2 Audit Logs Implemented',
    'Audit logs are implemented to support detection of anomalies',
    'Log all access to cardholder data, authentication events, and administrative actions.',
    ARRAY['config', 'log'],
    '/api/admin/audit-logs',
    true,
    true,
    'critical',
    90,
    1
FROM compliance_checklist_categories c WHERE c.code = 'req10_logging' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-10.3',
    '10.3 Audit Logs Protected',
    'Audit logs are protected from destruction and unauthorized modifications',
    'Implement log integrity verification. Store logs in write-once storage.',
    ARRAY['config', 'document'],
    true,
    'critical',
    60,
    2
FROM compliance_checklist_categories c WHERE c.code = 'req10_logging' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-10.4',
    '10.4 Logs Reviewed',
    'Audit logs are reviewed to identify anomalies or suspicious activity',
    'Document daily log review process. Configure automated alerting.',
    ARRAY['document', 'procedure'],
    true,
    'high',
    120,
    3
FROM compliance_checklist_categories c WHERE c.code = 'req10_logging' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

INSERT INTO compliance_checklist_items (version_id, category_id, item_code, title, description, guidance, evidence_types, is_required, priority, estimated_minutes, display_order)
SELECT 
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    c.id,
    'PCI-10.7',
    '10.7 Log Retention',
    'Audit log history is retained and available for analysis',
    'Retain logs for at least 12 months, with 3 months immediately available.',
    ARRAY['config', 'document'],
    true,
    'high',
    30,
    4
FROM compliance_checklist_categories c WHERE c.code = 'req10_logging' AND c.version_id = 'e5f6a7b8-c9d0-1234-efab-567890123456';

-- ============================================================================
-- UPDATE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_checklist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER checklist_versions_updated
    BEFORE UPDATE ON compliance_checklist_versions
    FOR EACH ROW EXECUTE FUNCTION update_checklist_timestamp();

CREATE TRIGGER checklist_items_updated
    BEFORE UPDATE ON compliance_checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_checklist_timestamp();

CREATE TRIGGER tenant_checklist_config_updated
    BEFORE UPDATE ON tenant_checklist_config
    FOR EACH ROW EXECUTE FUNCTION update_checklist_timestamp();

CREATE TRIGGER tenant_checklist_progress_updated
    BEFORE UPDATE ON tenant_checklist_progress
    FOR EACH ROW EXECUTE FUNCTION update_checklist_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE compliance_checklist_versions IS 'Versioned compliance checklists linked to regulatory standards';
COMMENT ON TABLE compliance_checklist_categories IS 'Categories for organizing checklist items';
COMMENT ON TABLE compliance_checklist_items IS 'Individual checklist items with guidance and automation support';
COMMENT ON TABLE tenant_checklist_config IS 'Per-tenant version selection (auto/specific) per standard';
COMMENT ON TABLE tenant_checklist_progress IS 'Track tenant progress on completing checklist items';
COMMENT ON TABLE checklist_audit_runs IS 'History of checklist audit/review runs';
COMMENT ON TABLE regulatory_version_updates IS 'Track regulatory standard version updates from external sources';
COMMENT ON TABLE checklist_update_sources IS 'Configure sources for automatic regulatory updates';
COMMENT ON FUNCTION get_effective_checklist_version IS 'Returns the effective checklist version for a tenant (auto or selected)';
COMMENT ON FUNCTION calculate_checklist_completion IS 'Calculates completion percentage for a tenant checklist';
