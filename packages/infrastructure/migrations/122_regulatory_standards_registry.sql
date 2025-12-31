-- RADIANT v4.18.0 - Migration 122: Regulatory Standards Registry
-- Comprehensive registry of all regulatory standards Radiant must comply with

-- ============================================================================
-- REGULATORY STANDARDS REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS regulatory_standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    full_name VARCHAR(500),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    jurisdiction VARCHAR(100),
    governing_body VARCHAR(200),
    website_url VARCHAR(500),
    effective_date DATE,
    version VARCHAR(50),
    is_mandatory BOOLEAN NOT NULL DEFAULT false,
    applies_to_radiant BOOLEAN NOT NULL DEFAULT true,
    applies_to_thinktank BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 50,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'deprecated', 'not_applicable')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regulatory_standards_code ON regulatory_standards(code);
CREATE INDEX idx_regulatory_standards_category ON regulatory_standards(category);
CREATE INDEX idx_regulatory_standards_status ON regulatory_standards(status);

-- ============================================================================
-- REGULATORY REQUIREMENTS (Controls/Requirements per Standard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS regulatory_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id UUID NOT NULL REFERENCES regulatory_standards(id) ON DELETE CASCADE,
    requirement_code VARCHAR(100) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    control_type VARCHAR(50) CHECK (control_type IN ('technical', 'administrative', 'physical', 'procedural')),
    is_required BOOLEAN NOT NULL DEFAULT true,
    implementation_status VARCHAR(30) NOT NULL DEFAULT 'not_started' 
        CHECK (implementation_status IN ('not_started', 'in_progress', 'implemented', 'verified', 'not_applicable')),
    implementation_notes TEXT,
    evidence_location VARCHAR(500),
    owner VARCHAR(200),
    due_date DATE,
    last_reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(standard_id, requirement_code)
);

CREATE INDEX idx_regulatory_requirements_standard ON regulatory_requirements(standard_id);
CREATE INDEX idx_regulatory_requirements_status ON regulatory_requirements(implementation_status);

-- ============================================================================
-- TENANT COMPLIANCE STATUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_compliance_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    standard_id UUID NOT NULL REFERENCES regulatory_standards(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    compliance_score INTEGER DEFAULT 0 CHECK (compliance_score >= 0 AND compliance_score <= 100),
    status VARCHAR(30) NOT NULL DEFAULT 'not_assessed' 
        CHECK (status IN ('not_assessed', 'non_compliant', 'partial', 'compliant', 'certified')),
    certification_date DATE,
    certification_expiry DATE,
    certification_body VARCHAR(200),
    last_audit_date TIMESTAMPTZ,
    next_audit_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, standard_id)
);

CREATE INDEX idx_tenant_compliance_tenant ON tenant_compliance_status(tenant_id);
CREATE INDEX idx_tenant_compliance_standard ON tenant_compliance_status(standard_id);

-- ============================================================================
-- COMPLIANCE EVIDENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES regulatory_requirements(id) ON DELETE CASCADE,
    evidence_type VARCHAR(50) NOT NULL CHECK (evidence_type IN ('document', 'screenshot', 'log', 'config', 'attestation', 'audit_report', 'policy', 'procedure')),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    file_path VARCHAR(500),
    file_hash VARCHAR(128),
    uploaded_by VARCHAR(200),
    valid_from DATE,
    valid_until DATE,
    is_current BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_evidence_tenant ON compliance_evidence(tenant_id);
CREATE INDEX idx_compliance_evidence_requirement ON compliance_evidence(requirement_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_compliance_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_compliance_status_isolation ON tenant_compliance_status
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY compliance_evidence_isolation ON compliance_evidence
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- SEED DATA: REGULATORY STANDARDS
-- ============================================================================

INSERT INTO regulatory_standards (code, name, full_name, category, description, jurisdiction, governing_body, website_url, is_mandatory, priority, status) VALUES

-- Data Privacy Standards
('GDPR', 'GDPR', 'General Data Protection Regulation', 'Data Privacy', 
 'European Union regulation on data protection and privacy. Applies to any organization processing EU resident data.',
 'European Union', 'European Data Protection Board', 'https://gdpr.eu/', true, 100, 'active'),

('CCPA', 'CCPA', 'California Consumer Privacy Act', 'Data Privacy',
 'California state privacy law giving consumers control over personal information collected by businesses.',
 'California, USA', 'California Attorney General', 'https://oag.ca.gov/privacy/ccpa', true, 90, 'active'),

('CPRA', 'CPRA', 'California Privacy Rights Act', 'Data Privacy',
 'Amendment to CCPA expanding consumer privacy rights and establishing California Privacy Protection Agency.',
 'California, USA', 'California Privacy Protection Agency', 'https://cppa.ca.gov/', true, 90, 'active'),

('LGPD', 'LGPD', 'Lei Geral de Proteção de Dados', 'Data Privacy',
 'Brazilian general data protection law similar to GDPR.',
 'Brazil', 'ANPD', 'https://www.gov.br/anpd/', false, 70, 'active'),

('PIPEDA', 'PIPEDA', 'Personal Information Protection and Electronic Documents Act', 'Data Privacy',
 'Canadian federal privacy law for private-sector organizations.',
 'Canada', 'Office of the Privacy Commissioner of Canada', 'https://www.priv.gc.ca/', false, 70, 'active'),

('APPI', 'APPI', 'Act on Protection of Personal Information', 'Data Privacy',
 'Japan''s primary data protection law.',
 'Japan', 'Personal Information Protection Commission', 'https://www.ppc.go.jp/', false, 60, 'active'),

('PDPA', 'PDPA', 'Personal Data Protection Act', 'Data Privacy',
 'Singapore''s data protection law governing collection, use, and disclosure of personal data.',
 'Singapore', 'PDPC Singapore', 'https://www.pdpc.gov.sg/', false, 60, 'active'),

-- Healthcare Standards
('HIPAA', 'HIPAA', 'Health Insurance Portability and Accountability Act', 'Healthcare',
 'US law providing data privacy and security provisions for safeguarding medical information.',
 'United States', 'HHS Office for Civil Rights', 'https://www.hhs.gov/hipaa/', true, 100, 'active'),

('HITECH', 'HITECH', 'Health Information Technology for Economic and Clinical Health Act', 'Healthcare',
 'Expands HIPAA requirements for electronic health records.',
 'United States', 'HHS', 'https://www.hhs.gov/hipaa/for-professionals/special-topics/hitech-act/', true, 95, 'active'),

('HITRUST', 'HITRUST CSF', 'HITRUST Common Security Framework', 'Healthcare',
 'Certifiable framework harmonizing healthcare security requirements.',
 'United States', 'HITRUST Alliance', 'https://hitrustalliance.net/', false, 85, 'active'),

-- Security Standards
('SOC2', 'SOC 2', 'Service Organization Control 2', 'Security',
 'AICPA framework for managing customer data based on five trust service criteria.',
 'United States', 'AICPA', 'https://www.aicpa.org/soc2', true, 100, 'active'),

('SOC1', 'SOC 1', 'Service Organization Control 1', 'Security',
 'Report on controls at a service organization relevant to user entities'' internal control over financial reporting.',
 'United States', 'AICPA', 'https://www.aicpa.org/', false, 70, 'active'),

('ISO27001', 'ISO 27001', 'ISO/IEC 27001 Information Security Management', 'Security',
 'International standard for information security management systems (ISMS).',
 'International', 'ISO/IEC', 'https://www.iso.org/isoiec-27001-information-security.html', true, 95, 'active'),

('ISO27017', 'ISO 27017', 'ISO/IEC 27017 Cloud Security', 'Security',
 'Code of practice for information security controls for cloud services.',
 'International', 'ISO/IEC', 'https://www.iso.org/', false, 80, 'active'),

('ISO27018', 'ISO 27018', 'ISO/IEC 27018 PII in Public Clouds', 'Security',
 'Code of practice for protection of personally identifiable information in public clouds.',
 'International', 'ISO/IEC', 'https://www.iso.org/', false, 80, 'active'),

('ISO27701', 'ISO 27701', 'ISO/IEC 27701 Privacy Information Management', 'Security',
 'Extension to ISO 27001 for privacy information management.',
 'International', 'ISO/IEC', 'https://www.iso.org/', false, 75, 'active'),

('CSA-STAR', 'CSA STAR', 'Cloud Security Alliance STAR', 'Security',
 'Cloud-specific security assurance program.',
 'International', 'Cloud Security Alliance', 'https://cloudsecurityalliance.org/star/', false, 70, 'active'),

('NIST-CSF', 'NIST CSF', 'NIST Cybersecurity Framework', 'Security',
 'Framework for improving critical infrastructure cybersecurity.',
 'United States', 'NIST', 'https://www.nist.gov/cyberframework', false, 85, 'active'),

('NIST-800-53', 'NIST 800-53', 'NIST Special Publication 800-53', 'Security',
 'Security and privacy controls for federal information systems.',
 'United States', 'NIST', 'https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final', false, 80, 'active'),

('CIS', 'CIS Controls', 'Center for Internet Security Controls', 'Security',
 'Prioritized set of actions to protect organizations from cyber attacks.',
 'International', 'CIS', 'https://www.cisecurity.org/controls', false, 75, 'active'),

-- Financial Standards
('PCI-DSS', 'PCI DSS', 'Payment Card Industry Data Security Standard', 'Financial',
 'Information security standard for organizations handling branded credit cards.',
 'International', 'PCI SSC', 'https://www.pcisecuritystandards.org/', true, 90, 'active'),

('SOX', 'SOX', 'Sarbanes-Oxley Act', 'Financial',
 'US law setting requirements for financial record keeping and reporting.',
 'United States', 'SEC', 'https://www.sec.gov/', false, 70, 'active'),

('GLBA', 'GLBA', 'Gramm-Leach-Bliley Act', 'Financial',
 'US law requiring financial institutions to explain information-sharing practices.',
 'United States', 'FTC', 'https://www.ftc.gov/', false, 65, 'active'),

-- Government Standards
('FedRAMP', 'FedRAMP', 'Federal Risk and Authorization Management Program', 'Government',
 'US government program providing standardized approach to security assessment for cloud products.',
 'United States', 'GSA', 'https://www.fedramp.gov/', false, 85, 'active'),

('StateRAMP', 'StateRAMP', 'State Risk and Authorization Management Program', 'Government',
 'Security framework for state and local government cloud services.',
 'United States', 'StateRAMP', 'https://stateramp.org/', false, 70, 'active'),

('ITAR', 'ITAR', 'International Traffic in Arms Regulations', 'Government',
 'US regulations controlling export of defense-related articles and services.',
 'United States', 'DDTC', 'https://www.pmddtc.state.gov/', false, 60, 'pending'),

('CMMC', 'CMMC', 'Cybersecurity Maturity Model Certification', 'Government',
 'DoD cybersecurity standard for defense industrial base.',
 'United States', 'DoD', 'https://www.acq.osd.mil/cmmc/', false, 75, 'active'),

-- AI-Specific Standards
('EU-AI-ACT', 'EU AI Act', 'European Union Artificial Intelligence Act', 'AI Governance',
 'EU regulation on artificial intelligence establishing risk-based requirements.',
 'European Union', 'European Commission', 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai', true, 100, 'active'),

('NIST-AI-RMF', 'NIST AI RMF', 'NIST AI Risk Management Framework', 'AI Governance',
 'Voluntary framework for managing AI risks throughout the AI lifecycle.',
 'United States', 'NIST', 'https://www.nist.gov/itl/ai-risk-management-framework', false, 90, 'active'),

('ISO42001', 'ISO 42001', 'ISO/IEC 42001 AI Management System', 'AI Governance',
 'International standard for AI management systems.',
 'International', 'ISO/IEC', 'https://www.iso.org/', false, 85, 'active'),

('IEEE-7000', 'IEEE 7000', 'IEEE 7000 Model Process for Addressing Ethical Concerns', 'AI Governance',
 'Standard for ethical system design considerations.',
 'International', 'IEEE', 'https://ethicsinaction.ieee.org/', false, 70, 'active'),

-- Accessibility Standards
('WCAG', 'WCAG 2.1', 'Web Content Accessibility Guidelines', 'Accessibility',
 'Guidelines for making web content accessible to people with disabilities.',
 'International', 'W3C', 'https://www.w3.org/WAI/WCAG21/quickref/', true, 80, 'active'),

('ADA', 'ADA', 'Americans with Disabilities Act', 'Accessibility',
 'US civil rights law prohibiting discrimination based on disability.',
 'United States', 'DOJ', 'https://www.ada.gov/', true, 85, 'active'),

('SECTION-508', 'Section 508', 'Section 508 of the Rehabilitation Act', 'Accessibility',
 'US law requiring federal agencies to make electronic content accessible.',
 'United States', 'GSA', 'https://www.section508.gov/', false, 75, 'active'),

-- Industry-Specific
('FERPA', 'FERPA', 'Family Educational Rights and Privacy Act', 'Education',
 'US law protecting privacy of student education records.',
 'United States', 'Department of Education', 'https://www2.ed.gov/policy/gen/guid/fpco/ferpa/', false, 70, 'active'),

('COPPA', 'COPPA', 'Children''s Online Privacy Protection Act', 'Child Privacy',
 'US law imposing requirements on operators of websites directed to children under 13.',
 'United States', 'FTC', 'https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa', true, 85, 'active')

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    jurisdiction = EXCLUDED.jurisdiction,
    governing_body = EXCLUDED.governing_body,
    website_url = EXCLUDED.website_url,
    is_mandatory = EXCLUDED.is_mandatory,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    updated_at = NOW();

-- ============================================================================
-- SEED DATA: KEY REQUIREMENTS FOR MAJOR STANDARDS
-- ============================================================================

-- GDPR Requirements
INSERT INTO regulatory_requirements (standard_id, requirement_code, title, description, category, control_type, is_required) 
SELECT s.id, r.code, r.title, r.description, r.category, r.control_type, r.is_required
FROM regulatory_standards s
CROSS JOIN (VALUES
    ('GDPR-5', 'Lawful Basis for Processing', 'Establish lawful basis for all data processing activities', 'Data Processing', 'administrative', true),
    ('GDPR-6', 'Consent Management', 'Obtain and manage valid consent for data processing', 'Consent', 'technical', true),
    ('GDPR-7', 'Data Subject Rights', 'Implement all data subject rights (access, erasure, portability, etc.)', 'Rights Management', 'technical', true),
    ('GDPR-25', 'Privacy by Design', 'Implement data protection by design and by default', 'Design', 'procedural', true),
    ('GDPR-30', 'Records of Processing', 'Maintain records of all processing activities', 'Documentation', 'administrative', true),
    ('GDPR-32', 'Security of Processing', 'Implement appropriate technical and organizational measures', 'Security', 'technical', true),
    ('GDPR-33', 'Breach Notification', 'Notify authorities within 72 hours of breach discovery', 'Incident Response', 'procedural', true),
    ('GDPR-35', 'Data Protection Impact Assessment', 'Conduct DPIAs for high-risk processing', 'Risk Assessment', 'administrative', true),
    ('GDPR-37', 'Data Protection Officer', 'Appoint DPO where required', 'Governance', 'administrative', false),
    ('GDPR-44', 'Cross-Border Transfers', 'Ensure lawful transfers outside EEA', 'Data Transfer', 'administrative', true)
) AS r(code, title, description, category, control_type, is_required)
WHERE s.code = 'GDPR'
ON CONFLICT (standard_id, requirement_code) DO NOTHING;

-- HIPAA Requirements
INSERT INTO regulatory_requirements (standard_id, requirement_code, title, description, category, control_type, is_required)
SELECT s.id, r.code, r.title, r.description, r.category, r.control_type, r.is_required
FROM regulatory_standards s
CROSS JOIN (VALUES
    ('HIPAA-164.308', 'Administrative Safeguards', 'Implement administrative safeguards for ePHI', 'Administrative', 'administrative', true),
    ('HIPAA-164.310', 'Physical Safeguards', 'Implement physical safeguards for systems containing ePHI', 'Physical', 'physical', true),
    ('HIPAA-164.312', 'Technical Safeguards', 'Implement technical safeguards including access control and encryption', 'Technical', 'technical', true),
    ('HIPAA-164.314', 'Business Associate Agreements', 'Establish BAAs with all business associates', 'Contracts', 'administrative', true),
    ('HIPAA-164.316', 'Policies and Procedures', 'Maintain documented policies and procedures', 'Documentation', 'administrative', true),
    ('HIPAA-164.502', 'Minimum Necessary', 'Limit PHI use and disclosure to minimum necessary', 'Data Handling', 'procedural', true),
    ('HIPAA-164.524', 'Access to PHI', 'Provide individuals access to their PHI', 'Rights', 'technical', true),
    ('HIPAA-164.528', 'Accounting of Disclosures', 'Maintain accounting of PHI disclosures', 'Audit', 'technical', true)
) AS r(code, title, description, category, control_type, is_required)
WHERE s.code = 'HIPAA'
ON CONFLICT (standard_id, requirement_code) DO NOTHING;

-- SOC 2 Requirements (Trust Service Criteria)
INSERT INTO regulatory_requirements (standard_id, requirement_code, title, description, category, control_type, is_required)
SELECT s.id, r.code, r.title, r.description, r.category, r.control_type, r.is_required
FROM regulatory_standards s
CROSS JOIN (VALUES
    ('CC1', 'Control Environment', 'COSO principle - demonstrate commitment to integrity and ethical values', 'Security', 'administrative', true),
    ('CC2', 'Communication and Information', 'Internal and external communication of security information', 'Security', 'administrative', true),
    ('CC3', 'Risk Assessment', 'Identify and analyze risks to objectives', 'Security', 'administrative', true),
    ('CC4', 'Monitoring Activities', 'Select and develop monitoring activities', 'Security', 'technical', true),
    ('CC5', 'Control Activities', 'Select and develop control activities', 'Security', 'technical', true),
    ('CC6', 'Logical and Physical Access Controls', 'Implement logical and physical access controls', 'Security', 'technical', true),
    ('CC7', 'System Operations', 'Manage system operations to detect and respond to security events', 'Security', 'technical', true),
    ('CC8', 'Change Management', 'Implement change management controls', 'Security', 'procedural', true),
    ('CC9', 'Risk Mitigation', 'Identify, assess, and manage vendor and business partner risks', 'Security', 'administrative', true),
    ('A1', 'Availability Commitments', 'Meet availability commitments and system requirements', 'Availability', 'technical', false),
    ('PI1', 'Processing Integrity', 'System processing is complete, valid, accurate, timely, and authorized', 'Processing Integrity', 'technical', false),
    ('C1', 'Confidentiality', 'Protect confidential information as committed', 'Confidentiality', 'technical', true),
    ('P1', 'Privacy', 'Collect, use, retain, disclose personal information per privacy notice', 'Privacy', 'administrative', false)
) AS r(code, title, description, category, control_type, is_required)
WHERE s.code = 'SOC2'
ON CONFLICT (standard_id, requirement_code) DO NOTHING;

-- EU AI Act Requirements
INSERT INTO regulatory_requirements (standard_id, requirement_code, title, description, category, control_type, is_required)
SELECT s.id, r.code, r.title, r.description, r.category, r.control_type, r.is_required
FROM regulatory_standards s
CROSS JOIN (VALUES
    ('AI-ACT-9', 'Risk Management System', 'Establish and maintain risk management system for high-risk AI', 'Risk Management', 'administrative', true),
    ('AI-ACT-10', 'Data Governance', 'Ensure training data meets quality criteria', 'Data Quality', 'technical', true),
    ('AI-ACT-11', 'Technical Documentation', 'Prepare technical documentation before market placement', 'Documentation', 'administrative', true),
    ('AI-ACT-12', 'Record-Keeping', 'Enable automatic logging of events', 'Audit', 'technical', true),
    ('AI-ACT-13', 'Transparency', 'Ensure transparency and provide information to users', 'Transparency', 'administrative', true),
    ('AI-ACT-14', 'Human Oversight', 'Design for effective human oversight', 'Human Control', 'technical', true),
    ('AI-ACT-15', 'Accuracy and Robustness', 'Achieve appropriate levels of accuracy and robustness', 'Quality', 'technical', true),
    ('AI-ACT-52', 'Transparency for Users', 'Inform users they are interacting with AI', 'Transparency', 'technical', true),
    ('AI-ACT-50', 'Prohibited Practices', 'Avoid prohibited AI practices (manipulation, social scoring, etc.)', 'Ethics', 'procedural', true)
) AS r(code, title, description, category, control_type, is_required)
WHERE s.code = 'EU-AI-ACT'
ON CONFLICT (standard_id, requirement_code) DO NOTHING;

-- PCI-DSS Requirements
INSERT INTO regulatory_requirements (standard_id, requirement_code, title, description, category, control_type, is_required)
SELECT s.id, r.code, r.title, r.description, r.category, r.control_type, r.is_required
FROM regulatory_standards s
CROSS JOIN (VALUES
    ('PCI-1', 'Firewall Configuration', 'Install and maintain network security controls', 'Network Security', 'technical', true),
    ('PCI-2', 'Secure Configuration', 'Apply secure configurations to all system components', 'Configuration', 'technical', true),
    ('PCI-3', 'Protect Stored Data', 'Protect stored account data', 'Data Protection', 'technical', true),
    ('PCI-4', 'Encrypt Transmissions', 'Protect cardholder data during transmission', 'Encryption', 'technical', true),
    ('PCI-5', 'Malware Protection', 'Protect systems against malware', 'Security', 'technical', true),
    ('PCI-6', 'Secure Development', 'Develop and maintain secure systems and software', 'Development', 'procedural', true),
    ('PCI-7', 'Access Control', 'Restrict access to system components and cardholder data', 'Access Control', 'technical', true),
    ('PCI-8', 'User Authentication', 'Identify users and authenticate access', 'Authentication', 'technical', true),
    ('PCI-9', 'Physical Security', 'Restrict physical access to cardholder data', 'Physical', 'physical', true),
    ('PCI-10', 'Logging and Monitoring', 'Log and monitor all access to network resources', 'Monitoring', 'technical', true),
    ('PCI-11', 'Security Testing', 'Test security of systems and networks regularly', 'Testing', 'procedural', true),
    ('PCI-12', 'Security Policies', 'Support information security with organizational policies', 'Governance', 'administrative', true)
) AS r(code, title, description, category, control_type, is_required)
WHERE s.code = 'PCI-DSS'
ON CONFLICT (standard_id, requirement_code) DO NOTHING;

-- ISO 27001 Requirements (Selected Annex A Controls)
INSERT INTO regulatory_requirements (standard_id, requirement_code, title, description, category, control_type, is_required)
SELECT s.id, r.code, r.title, r.description, r.category, r.control_type, r.is_required
FROM regulatory_standards s
CROSS JOIN (VALUES
    ('A.5', 'Information Security Policies', 'Management direction for information security', 'Policies', 'administrative', true),
    ('A.6', 'Organization of Information Security', 'Internal organization and mobile/teleworking security', 'Organization', 'administrative', true),
    ('A.7', 'Human Resource Security', 'Security responsibilities for employees', 'HR', 'administrative', true),
    ('A.8', 'Asset Management', 'Responsibility for assets and information classification', 'Assets', 'administrative', true),
    ('A.9', 'Access Control', 'Business requirements and user access management', 'Access Control', 'technical', true),
    ('A.10', 'Cryptography', 'Cryptographic controls', 'Cryptography', 'technical', true),
    ('A.11', 'Physical and Environmental Security', 'Secure areas and equipment', 'Physical', 'physical', true),
    ('A.12', 'Operations Security', 'Operational procedures and responsibilities', 'Operations', 'procedural', true),
    ('A.13', 'Communications Security', 'Network security management', 'Network', 'technical', true),
    ('A.14', 'System Acquisition', 'Security in development and support processes', 'Development', 'procedural', true),
    ('A.15', 'Supplier Relationships', 'Information security in supplier relationships', 'Vendors', 'administrative', true),
    ('A.16', 'Incident Management', 'Management of security incidents', 'Incident Response', 'procedural', true),
    ('A.17', 'Business Continuity', 'Information security aspects of business continuity', 'BCM', 'administrative', true),
    ('A.18', 'Compliance', 'Compliance with legal and contractual requirements', 'Compliance', 'administrative', true)
) AS r(code, title, description, category, control_type, is_required)
WHERE s.code = 'ISO27001'
ON CONFLICT (standard_id, requirement_code) DO NOTHING;

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_regulatory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_regulatory_standards_updated
    BEFORE UPDATE ON regulatory_standards
    FOR EACH ROW EXECUTE FUNCTION update_regulatory_timestamp();

CREATE TRIGGER trigger_regulatory_requirements_updated
    BEFORE UPDATE ON regulatory_requirements
    FOR EACH ROW EXECUTE FUNCTION update_regulatory_timestamp();

CREATE TRIGGER trigger_tenant_compliance_status_updated
    BEFORE UPDATE ON tenant_compliance_status
    FOR EACH ROW EXECUTE FUNCTION update_regulatory_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE regulatory_standards IS 'Registry of all regulatory standards and frameworks applicable to Radiant';
COMMENT ON TABLE regulatory_requirements IS 'Individual requirements/controls within each regulatory standard';
COMMENT ON TABLE tenant_compliance_status IS 'Per-tenant compliance status for each standard';
COMMENT ON TABLE compliance_evidence IS 'Evidence artifacts demonstrating compliance with requirements';
