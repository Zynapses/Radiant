-- RADIANT Safety Matrix Manager
-- Entity-Action Contraindication Grid for Domain Expert Cortex
-- Version: 6.0.0
-- Date: 2026-02-01

-- =============================================================================
-- Entity Categories Enum
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE entity_category AS ENUM (
        'medication', 'condition', 'procedure', 'patient_group',
        'legal_entity', 'document_type', 'financial_instrument',
        'regulatory_status', 'custom'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE action_category AS ENUM (
        'prescribe', 'recommend', 'combine_with', 'administer_to',
        'advise', 'execute', 'transfer', 'disclose', 'custom'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE contraindication_severity AS ENUM (
        'absolute', 'relative', 'caution', 'monitor'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Safety Entities
-- =============================================================================

CREATE TABLE IF NOT EXISTS safety_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    domain_id VARCHAR(100) NOT NULL,
    
    -- Core info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category entity_category NOT NULL DEFAULT 'custom',
    subcategory VARCHAR(100),
    
    -- External identifiers (domain-specific)
    external_ids JSONB DEFAULT '{}'::jsonb,
    
    -- Classification
    tags JSONB DEFAULT '[]'::jsonb,
    risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Usage stats
    contraindication_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Verification
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by VARCHAR(255),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    
    CONSTRAINT uq_safety_entity UNIQUE (tenant_id, domain_id, name)
);

CREATE INDEX IF NOT EXISTS idx_safety_entities_tenant ON safety_entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_safety_entities_domain ON safety_entities(tenant_id, domain_id);
CREATE INDEX IF NOT EXISTS idx_safety_entities_category ON safety_entities(tenant_id, domain_id, category);
CREATE INDEX IF NOT EXISTS idx_safety_entities_name ON safety_entities(tenant_id, domain_id, name);
CREATE INDEX IF NOT EXISTS idx_safety_entities_risk ON safety_entities(tenant_id, risk_level);

ALTER TABLE safety_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY safety_entities_tenant_isolation ON safety_entities
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE safety_entities IS 'Domain entities for contraindication tracking (medications, conditions, etc.)';
COMMENT ON COLUMN safety_entities.external_ids IS 'External IDs: rxcui, icd10, cpt, cusip, lei, etc.';

-- =============================================================================
-- Safety Actions
-- =============================================================================

CREATE TABLE IF NOT EXISTS safety_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    domain_id VARCHAR(100) NOT NULL,
    
    -- Core info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category action_category NOT NULL DEFAULT 'custom',
    
    -- Verb forms
    verb_present VARCHAR(100) NOT NULL,     -- "prescribe"
    verb_past VARCHAR(100) NOT NULL,        -- "prescribed"
    verb_gerund VARCHAR(100) NOT NULL,      -- "prescribing"
    
    -- Classification
    tags JSONB DEFAULT '[]'::jsonb,
    requires_confirmation BOOLEAN DEFAULT false,
    
    -- Usage stats
    contraindication_count INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    
    CONSTRAINT uq_safety_action UNIQUE (tenant_id, domain_id, name)
);

CREATE INDEX IF NOT EXISTS idx_safety_actions_tenant ON safety_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_safety_actions_domain ON safety_actions(tenant_id, domain_id);
CREATE INDEX IF NOT EXISTS idx_safety_actions_category ON safety_actions(tenant_id, domain_id, category);

ALTER TABLE safety_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY safety_actions_tenant_isolation ON safety_actions
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE safety_actions IS 'Domain actions for contraindication tracking (prescribe, recommend, etc.)';

-- =============================================================================
-- Contraindications
-- =============================================================================

CREATE TABLE IF NOT EXISTS contraindications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    domain_id VARCHAR(100) NOT NULL,
    
    -- The contraindication pair
    entity_id UUID NOT NULL REFERENCES safety_entities(id) ON DELETE CASCADE,
    action_id UUID NOT NULL REFERENCES safety_actions(id) ON DELETE CASCADE,
    
    -- Optional second entity (for entity+entity contraindications)
    second_entity_id UUID REFERENCES safety_entities(id) ON DELETE SET NULL,
    
    -- Severity
    severity contraindication_severity NOT NULL DEFAULT 'caution',
    
    -- Details
    reason TEXT NOT NULL,
    clinical_evidence TEXT,
    regulatory_reference TEXT,
    
    -- Conditions (when the contraindication applies)
    conditions JSONB DEFAULT '[]'::jsonb,
    
    -- Exceptions (when the contraindication does NOT apply)
    exceptions JSONB DEFAULT '[]'::jsonb,
    
    -- Alternative suggestions
    alternatives JSONB DEFAULT '[]'::jsonb,
    
    -- Override policy
    allow_override BOOLEAN DEFAULT false,
    override_requires VARCHAR(20) DEFAULT 'none' CHECK (override_requires IN ('documentation', 'supervisor', 'specialist', 'none')),
    
    -- ML model (if detected by Contraindication Net)
    ml_confidence DECIMAL(5, 4),
    ml_model_version VARCHAR(50),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending_review', 'deprecated', 'rejected')),
    effective_date DATE,
    expiration_date DATE,
    
    -- Review
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(255),
    review_notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    
    CONSTRAINT uq_contraindication UNIQUE (tenant_id, entity_id, action_id, second_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_contraindications_tenant ON contraindications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contraindications_domain ON contraindications(tenant_id, domain_id);
CREATE INDEX IF NOT EXISTS idx_contraindications_entity ON contraindications(entity_id);
CREATE INDEX IF NOT EXISTS idx_contraindications_action ON contraindications(action_id);
CREATE INDEX IF NOT EXISTS idx_contraindications_severity ON contraindications(severity);
CREATE INDEX IF NOT EXISTS idx_contraindications_status ON contraindications(status);
CREATE INDEX IF NOT EXISTS idx_contraindications_active ON contraindications(tenant_id, domain_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_contraindications_pending ON contraindications(tenant_id) WHERE status = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_contraindications_pair ON contraindications(tenant_id, entity_id, action_id);

ALTER TABLE contraindications ENABLE ROW LEVEL SECURITY;
CREATE POLICY contraindications_tenant_isolation ON contraindications
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE contraindications IS 'Entity-action contraindication grid entries';
COMMENT ON COLUMN contraindications.severity IS 'absolute=never, relative=usually avoid, caution=consider risks, monitor=proceed with care';
COMMENT ON COLUMN contraindications.conditions IS 'JSON array of conditions when contraindication applies';
COMMENT ON COLUMN contraindications.ml_confidence IS 'Confidence from Contraindication Net if ML-detected';

-- =============================================================================
-- Contraindication Overrides Log
-- =============================================================================

CREATE TABLE IF NOT EXISTS contraindication_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    contraindication_id UUID NOT NULL REFERENCES contraindications(id) ON DELETE CASCADE,
    
    -- Context
    user_id VARCHAR(255) NOT NULL,
    session_id UUID,
    request_id UUID,
    
    -- Override details
    reason TEXT NOT NULL,
    documentation TEXT,
    supervisor_id VARCHAR(255),
    specialist_id VARCHAR(255),
    
    -- Outcome
    outcome VARCHAR(20) DEFAULT 'approved' CHECK (outcome IN ('approved', 'denied', 'escalated')),
    outcome_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_overrides_tenant ON contraindication_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_overrides_contraindication ON contraindication_overrides(contraindication_id);
CREATE INDEX IF NOT EXISTS idx_overrides_user ON contraindication_overrides(tenant_id, user_id);

ALTER TABLE contraindication_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY overrides_tenant_isolation ON contraindication_overrides
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE contraindication_overrides IS 'Log of contraindication overrides for audit purposes';

-- =============================================================================
-- Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION check_contraindication(
    p_tenant_id UUID,
    p_domain_id VARCHAR(100),
    p_entity_id UUID,
    p_action_id UUID
) RETURNS TABLE (
    contraindication_id UUID,
    severity contraindication_severity,
    reason TEXT,
    allow_override BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.severity,
        c.reason,
        c.allow_override
    FROM contraindications c
    WHERE c.tenant_id = p_tenant_id
      AND c.domain_id = p_domain_id
      AND c.entity_id = p_entity_id
      AND c.action_id = p_action_id
      AND c.status = 'active'
      AND (c.effective_date IS NULL OR c.effective_date <= CURRENT_DATE)
      AND (c.expiration_date IS NULL OR c.expiration_date > CURRENT_DATE)
    ORDER BY 
        CASE c.severity 
            WHEN 'absolute' THEN 1 
            WHEN 'relative' THEN 2 
            WHEN 'caution' THEN 3 
            WHEN 'monitor' THEN 4 
        END;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_matrix_cell_count(
    p_tenant_id UUID,
    p_domain_id VARCHAR(100)
) RETURNS TABLE (
    entity_count BIGINT,
    action_count BIGINT,
    contraindication_count BIGINT,
    matrix_coverage DECIMAL(5, 2)
) AS $$
DECLARE
    v_entity_count BIGINT;
    v_action_count BIGINT;
    v_contraindication_count BIGINT;
    v_total_cells BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_entity_count 
    FROM safety_entities WHERE tenant_id = p_tenant_id AND domain_id = p_domain_id;
    
    SELECT COUNT(*) INTO v_action_count 
    FROM safety_actions WHERE tenant_id = p_tenant_id AND domain_id = p_domain_id;
    
    SELECT COUNT(*) INTO v_contraindication_count 
    FROM contraindications WHERE tenant_id = p_tenant_id AND domain_id = p_domain_id AND status = 'active';
    
    v_total_cells := v_entity_count * v_action_count;
    
    RETURN QUERY SELECT 
        v_entity_count,
        v_action_count,
        v_contraindication_count,
        CASE WHEN v_total_cells > 0 
            THEN (v_contraindication_count::DECIMAL / v_total_cells * 100)
            ELSE 0 
        END;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_contraindication IS 'Check if an entity-action pair has contraindications';
COMMENT ON FUNCTION get_matrix_cell_count IS 'Get matrix statistics for a domain';
