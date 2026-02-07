-- Migration: 082_ai_ethics_standards
-- Description: Add AI ethics standards framework with industry standard sources
-- Shows administrators the standards each ethical principle is derived from
-- Author: RADIANT System
-- Date: 2024-12-28

-- ============================================================================
-- AI Ethics Standards - Industry frameworks and their principles
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_ethics_standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Standard identification
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(500) NOT NULL,
    version VARCHAR(50),
    
    -- Organization
    organization VARCHAR(255) NOT NULL,
    organization_type VARCHAR(50) NOT NULL,  -- government, iso, industry, academic, religious
    
    -- Details
    description TEXT,
    url VARCHAR(500),
    publication_date DATE,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_mandatory BOOLEAN NOT NULL DEFAULT false,  -- Required for compliance
    
    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    icon VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Add standard references to ethical_principles
-- ============================================================================

ALTER TABLE ethical_principles
ADD COLUMN IF NOT EXISTS standard_codes TEXT[] DEFAULT '{}';

ALTER TABLE ethical_principles
ADD COLUMN IF NOT EXISTS standard_references JSONB DEFAULT '[]';

ALTER TABLE ethical_principles
ADD COLUMN IF NOT EXISTS framework_alignment TEXT;

-- ============================================================================
-- Seed AI Ethics Standards
-- ============================================================================

INSERT INTO ai_ethics_standards (code, name, full_name, version, organization, organization_type, description, url, publication_date, is_mandatory, display_order, icon) VALUES

-- Government/Regulatory Standards
('NIST_AI_RMF', 'NIST AI RMF', 'NIST AI Risk Management Framework', '1.0', 
 'National Institute of Standards and Technology', 'government',
 'Comprehensive framework for managing risks in AI systems throughout their lifecycle. Provides guidance on governance, mapping, measurement, and management of AI risks.',
 'https://www.nist.gov/itl/ai-risk-management-framework',
 '2023-01-26', true, 10, 'Shield'),

('ISO_42001', 'ISO/IEC 42001', 'ISO/IEC 42001:2023 AI Management System', '2023',
 'International Organization for Standardization', 'iso',
 'International standard for establishing, implementing, maintaining and continually improving an AI management system. First international AI management system standard.',
 'https://www.iso.org/standard/81230.html',
 '2023-12-18', true, 20, 'Award'),

('EU_AI_ACT', 'EU AI Act', 'European Union Artificial Intelligence Act', '2024',
 'European Union', 'government',
 'Comprehensive regulatory framework for AI systems in the EU. Establishes risk-based approach with requirements for high-risk AI systems.',
 'https://artificialintelligenceact.eu/',
 '2024-03-13', true, 30, 'Scale'),

('IEEE_7000', 'IEEE 7000', 'IEEE 7000-2021 Model Process for Addressing Ethical Concerns', '2021',
 'Institute of Electrical and Electronics Engineers', 'industry',
 'Standard for addressing ethical concerns during system design. Provides model process for identifying and addressing ethical values.',
 'https://standards.ieee.org/ieee/7000/6781/',
 '2021-09-15', false, 40, 'Cpu'),

-- Industry Guidelines
('OECD_AI', 'OECD AI Principles', 'OECD Principles on Artificial Intelligence', '2019',
 'Organisation for Economic Co-operation and Development', 'government',
 'First intergovernmental standard on AI. Promotes AI that is innovative, trustworthy, and respects human rights and democratic values.',
 'https://oecd.ai/en/ai-principles',
 '2019-05-22', false, 50, 'Globe'),

('UNESCO_AI', 'UNESCO AI Ethics', 'UNESCO Recommendation on the Ethics of AI', '2021',
 'United Nations Educational, Scientific and Cultural Organization', 'government',
 'First global standard-setting instrument on ethics of AI. Adopted by all 193 Member States.',
 'https://www.unesco.org/en/artificial-intelligence/recommendation-ethics',
 '2021-11-23', false, 60, 'Globe'),

('AIAAIC', 'AIAAIC', 'AI Incident Database', '2024',
 'AI, Pair, and AIAAIC', 'academic',
 'Database of AI incidents and harms. Used to inform risk assessment and mitigation strategies.',
 'https://incidentdatabase.ai/',
 '2020-11-01', false, 70, 'AlertTriangle'),

-- Technical Standards
('ISO_23894', 'ISO/IEC 23894', 'ISO/IEC 23894:2023 AI Risk Management', '2023',
 'International Organization for Standardization', 'iso',
 'Guidance on managing risk for organizations using or developing AI systems. Complements ISO 31000 risk management.',
 'https://www.iso.org/standard/77304.html',
 '2023-02-01', false, 80, 'FileWarning'),

('ISO_38507', 'ISO/IEC 38507', 'ISO/IEC 38507:2022 Governance of IT - AI', '2022',
 'International Organization for Standardization', 'iso',
 'Guidance for governing bodies on AI governance. Extends IT governance to address AI-specific considerations.',
 'https://www.iso.org/standard/56641.html',
 '2022-04-01', false, 90, 'Building'),

-- Foundational Principles
('CHRISTIAN_ETHICS', 'Christian Ethics', 'Teachings of Jesus Christ', 'Biblical',
 'Christian Tradition', 'religious',
 'Ethical principles derived from the teachings of Jesus Christ including the Golden Rule, love for neighbor, mercy, and service to others.',
 NULL,
 NULL, false, 100, 'Heart')

ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Standard Principles Mapping - Which principles map to which standards
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_ethics_principle_standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    principle_id UUID REFERENCES ethical_principles(principle_id) ON DELETE CASCADE,
    standard_id UUID REFERENCES ai_ethics_standards(id) ON DELETE CASCADE,
    
    -- Standard-specific reference
    standard_section VARCHAR(100),  -- e.g., "MAP 1.1", "Clause 6.2", "Article 9"
    standard_requirement TEXT,       -- The actual requirement text
    
    -- Alignment
    alignment_level VARCHAR(20) NOT NULL DEFAULT 'aligned',  -- derived, aligned, supports, extends
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(principle_id, standard_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_ai_ethics_standards_code ON ai_ethics_standards(code);
CREATE INDEX idx_ai_ethics_standards_active ON ai_ethics_standards(is_active) WHERE is_active = true;
CREATE INDEX idx_ai_ethics_principle_standards_principle ON ai_ethics_principle_standards(principle_id);
CREATE INDEX idx_ai_ethics_principle_standards_standard ON ai_ethics_principle_standards(standard_id);

-- ============================================================================
-- View: Principles with their standards
-- ============================================================================

CREATE OR REPLACE VIEW ethical_principles_with_standards AS
SELECT 
    p.*,
    COALESCE(
        json_agg(
            json_build_object(
                'standardCode', s.code,
                'standardName', s.name,
                'standardFullName', s.full_name,
                'organization', s.organization,
                'section', ps.standard_section,
                'requirement', ps.standard_requirement,
                'alignmentLevel', ps.alignment_level,
                'url', s.url,
                'isMandatory', s.is_mandatory
            )
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'
    ) AS standards
FROM ethical_principles p
LEFT JOIN ai_ethics_principle_standards ps ON p.principle_id = ps.principle_id
LEFT JOIN ai_ethics_standards s ON ps.standard_id = s.id AND s.is_active = true
GROUP BY p.principle_id, p.tenant_id, p.name, p.teaching, p.source, p.category, p.weight, p.is_active, p.created_at, p.updated_at, p.standard_codes, p.standard_references, p.framework_alignment;

-- ============================================================================
-- Function: Get principle with all standard sources
-- ============================================================================

CREATE OR REPLACE FUNCTION get_principles_with_standards(p_tenant_id UUID)
RETURNS TABLE (
    principle_id UUID,
    name VARCHAR,
    teaching TEXT,
    source VARCHAR,
    category VARCHAR,
    weight NUMERIC,
    standard_sources JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.principle_id,
        p.name,
        p.teaching,
        p.source,
        p.category,
        p.weight,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'code', s.code,
                    'name', s.name,
                    'fullName', s.full_name,
                    'organization', s.organization,
                    'section', ps.standard_section,
                    'requirement', ps.standard_requirement,
                    'url', s.url,
                    'isMandatory', s.is_mandatory
                )
            ) FILTER (WHERE s.id IS NOT NULL),
            '[]'::jsonb
        ) AS standard_sources
    FROM ethical_principles p
    LEFT JOIN ai_ethics_principle_standards ps ON p.principle_id = ps.principle_id
    LEFT JOIN ai_ethics_standards s ON ps.standard_id = s.id AND s.is_active = true
    WHERE p.tenant_id = p_tenant_id AND p.is_active = true
    GROUP BY p.principle_id, p.name, p.teaching, p.source, p.category, p.weight
    ORDER BY p.weight DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Seed default principle-standard mappings
-- This shows how each ethical principle maps to industry standards
-- ============================================================================

-- We'll need to map after principles are created, so this is done via a function
CREATE OR REPLACE FUNCTION seed_principle_standard_mappings(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
    v_principle_id UUID;
    v_nist_id UUID;
    v_iso_id UUID;
    v_eu_id UUID;
    v_christian_id UUID;
BEGIN
    -- Get standard IDs
    SELECT id INTO v_nist_id FROM ai_ethics_standards WHERE code = 'NIST_AI_RMF';
    SELECT id INTO v_iso_id FROM ai_ethics_standards WHERE code = 'ISO_42001';
    SELECT id INTO v_eu_id FROM ai_ethics_standards WHERE code = 'EU_AI_ACT';
    SELECT id INTO v_christian_id FROM ai_ethics_standards WHERE code = 'CHRISTIAN_ETHICS';

    -- Map "Love Others" principle
    SELECT principle_id INTO v_principle_id FROM ethical_principles WHERE tenant_id = p_tenant_id AND name = 'Love Others' LIMIT 1;
    IF v_principle_id IS NOT NULL THEN
        INSERT INTO ai_ethics_principle_standards (principle_id, standard_id, standard_section, standard_requirement, alignment_level)
        VALUES 
            (v_principle_id, v_nist_id, 'GOVERN 1.2', 'Organizations should ensure AI systems respect human dignity', 'aligned'),
            (v_principle_id, v_iso_id, 'Clause 5.2', 'AI policy shall include commitment to human-centered values', 'aligned'),
            (v_principle_id, v_christian_id, 'Matthew 22:39', 'Love your neighbor as yourself', 'derived')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Map "Golden Rule" principle
    SELECT principle_id INTO v_principle_id FROM ethical_principles WHERE tenant_id = p_tenant_id AND name = 'Golden Rule' LIMIT 1;
    IF v_principle_id IS NOT NULL THEN
        INSERT INTO ai_ethics_principle_standards (principle_id, standard_id, standard_section, standard_requirement, alignment_level)
        VALUES 
            (v_principle_id, v_nist_id, 'MAP 1.1', 'Intended purpose and context of use are documented', 'aligned'),
            (v_principle_id, v_eu_id, 'Article 9', 'Risk management system shall consider effects on persons', 'aligned'),
            (v_principle_id, v_christian_id, 'Matthew 7:12', 'Do to others what you would have them do to you', 'derived')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Map "Speak Truth" principle
    SELECT principle_id INTO v_principle_id FROM ethical_principles WHERE tenant_id = p_tenant_id AND name = 'Speak Truth' LIMIT 1;
    IF v_principle_id IS NOT NULL THEN
        INSERT INTO ai_ethics_principle_standards (principle_id, standard_id, standard_section, standard_requirement, alignment_level)
        VALUES 
            (v_principle_id, v_nist_id, 'GOVERN 4.1', 'Organizational transparency about AI system capabilities and limitations', 'aligned'),
            (v_principle_id, v_iso_id, 'Clause 7.4', 'Communication shall be truthful and clear', 'aligned'),
            (v_principle_id, v_eu_id, 'Article 13', 'Transparency obligations for high-risk AI systems', 'aligned'),
            (v_principle_id, v_christian_id, 'John 8:32', 'The truth will set you free', 'derived')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Map "Show Mercy" principle  
    SELECT principle_id INTO v_principle_id FROM ethical_principles WHERE tenant_id = p_tenant_id AND name = 'Show Mercy' LIMIT 1;
    IF v_principle_id IS NOT NULL THEN
        INSERT INTO ai_ethics_principle_standards (principle_id, standard_id, standard_section, standard_requirement, alignment_level)
        VALUES 
            (v_principle_id, v_nist_id, 'MEASURE 2.6', 'AI systems should minimize potential harms', 'aligned'),
            (v_principle_id, v_eu_id, 'Article 14', 'Human oversight to minimize risks', 'aligned'),
            (v_principle_id, v_christian_id, 'Matthew 5:7', 'Blessed are the merciful', 'derived')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Map "Serve Humbly" principle
    SELECT principle_id INTO v_principle_id FROM ethical_principles WHERE tenant_id = p_tenant_id AND name = 'Serve Humbly' LIMIT 1;
    IF v_principle_id IS NOT NULL THEN
        INSERT INTO ai_ethics_principle_standards (principle_id, standard_id, standard_section, standard_requirement, alignment_level)
        VALUES 
            (v_principle_id, v_nist_id, 'GOVERN 1.1', 'Policies reflect commitment to accountability', 'aligned'),
            (v_principle_id, v_iso_id, 'Clause 5.1', 'Top management shall demonstrate leadership and commitment', 'aligned'),
            (v_principle_id, v_christian_id, 'Mark 10:45', 'The greatest among you shall be your servant', 'derived')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Map "Avoid Judgment" principle
    SELECT principle_id INTO v_principle_id FROM ethical_principles WHERE tenant_id = p_tenant_id AND name = 'Avoid Judgment' LIMIT 1;
    IF v_principle_id IS NOT NULL THEN
        INSERT INTO ai_ethics_principle_standards (principle_id, standard_id, standard_section, standard_requirement, alignment_level)
        VALUES 
            (v_principle_id, v_nist_id, 'MAP 2.3', 'Scientific integrity and objectivity in AI assessments', 'aligned'),
            (v_principle_id, v_eu_id, 'Article 10', 'Data governance to avoid bias', 'aligned'),
            (v_principle_id, v_christian_id, 'Matthew 7:1', 'Do not judge, or you too will be judged', 'derived')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Map "Care for Vulnerable" principle
    SELECT principle_id INTO v_principle_id FROM ethical_principles WHERE tenant_id = p_tenant_id AND name = 'Care for Vulnerable' LIMIT 1;
    IF v_principle_id IS NOT NULL THEN
        INSERT INTO ai_ethics_principle_standards (principle_id, standard_id, standard_section, standard_requirement, alignment_level)
        VALUES 
            (v_principle_id, v_nist_id, 'MAP 1.5', 'Potential impacts on individuals and communities identified', 'aligned'),
            (v_principle_id, v_eu_id, 'Article 7', 'Special attention to vulnerable groups', 'aligned'),
            (v_principle_id, v_iso_id, 'Clause 8.4', 'Consider impacts on interested parties', 'aligned'),
            (v_principle_id, v_christian_id, 'Matthew 25:40', 'Whatever you did for the least of these, you did for me', 'derived')
        ON CONFLICT DO NOTHING;
    END IF;

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT ON ai_ethics_standards TO authenticated;
GRANT SELECT ON ai_ethics_principle_standards TO authenticated;
GRANT SELECT ON ethical_principles_with_standards TO authenticated;
GRANT EXECUTE ON FUNCTION get_principles_with_standards TO authenticated;
GRANT EXECUTE ON FUNCTION seed_principle_standard_mappings TO authenticated;
