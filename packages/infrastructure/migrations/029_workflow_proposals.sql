-- RADIANT v4.17.0 - Migration 029: Dynamic Workflow Proposals
-- Evidence-based workflow proposal system

CREATE TABLE neural_need_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    pattern_hash VARCHAR(64) NOT NULL,
    pattern_signature JSONB NOT NULL,
    pattern_embedding vector(768),
    
    pattern_name VARCHAR(255) NOT NULL,
    pattern_description TEXT,
    detected_intent TEXT NOT NULL,
    existing_workflow_gaps TEXT[],
    
    total_evidence_score DECIMAL(10, 4) DEFAULT 0,
    evidence_count INTEGER DEFAULT 0,
    unique_users_affected INTEGER DEFAULT 0,
    first_occurrence TIMESTAMPTZ DEFAULT NOW(),
    last_occurrence TIMESTAMPTZ DEFAULT NOW(),
    
    occurrence_threshold_met BOOLEAN DEFAULT false,
    impact_threshold_met BOOLEAN DEFAULT false,
    confidence_threshold_met BOOLEAN DEFAULT false,
    
    status VARCHAR(50) DEFAULT 'accumulating' CHECK (status IN ('accumulating', 'threshold_met', 'proposal_generated', 'resolved')),
    proposal_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_pattern_per_tenant UNIQUE(tenant_id, pattern_hash)
);

CREATE TABLE neural_need_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pattern_id UUID NOT NULL REFERENCES neural_need_patterns(id) ON DELETE CASCADE,
    
    user_id UUID,
    session_id UUID,
    execution_id UUID,
    
    evidence_type VARCHAR(50) NOT NULL CHECK (evidence_type IN (
        'workflow_failure', 'negative_feedback', 'manual_override', 'regenerate_request',
        'abandon_session', 'low_confidence_completion', 'explicit_request'
    )),
    evidence_weight DECIMAL(5, 4) NOT NULL,
    evidence_data JSONB NOT NULL DEFAULT '{}',
    
    original_request TEXT,
    attempted_workflow_id UUID,
    failure_reason TEXT,
    user_feedback TEXT,
    
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    proposal_code VARCHAR(50) NOT NULL,
    proposal_name VARCHAR(255) NOT NULL,
    proposal_description TEXT NOT NULL,
    
    source_pattern_id UUID NOT NULL REFERENCES neural_need_patterns(id),
    
    proposed_workflow JSONB NOT NULL,
    workflow_category VARCHAR(100),
    workflow_type VARCHAR(50) CHECK (workflow_type IN ('orchestration_pattern', 'production_workflow', 'hybrid')),
    estimated_complexity VARCHAR(20),
    
    neural_confidence DECIMAL(5, 4) NOT NULL,
    neural_reasoning TEXT NOT NULL,
    estimated_quality_improvement DECIMAL(5, 4),
    estimated_coverage_percentage DECIMAL(5, 4),
    
    brain_approved BOOLEAN,
    brain_review_timestamp TIMESTAMPTZ,
    brain_risk_assessment JSONB,
    brain_veto_reason TEXT,
    brain_modifications JSONB,
    
    admin_status VARCHAR(30) DEFAULT 'pending' CHECK (admin_status IN ('pending', 'reviewing', 'approved', 'rejected', 'deferred')),
    admin_reviewer_id UUID,
    admin_review_timestamp TIMESTAMPTZ,
    admin_notes TEXT,
    admin_modifications JSONB,
    
    published_workflow_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE proposal_evidence_weights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    evidence_type VARCHAR(50) NOT NULL,
    weight DECIMAL(5, 4) NOT NULL,
    description TEXT,
    
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, evidence_type)
);

CREATE INDEX idx_neural_need_patterns_tenant ON neural_need_patterns(tenant_id);
CREATE INDEX idx_neural_need_patterns_status ON neural_need_patterns(status);
CREATE INDEX idx_neural_need_evidence_pattern ON neural_need_evidence(pattern_id);
CREATE INDEX idx_neural_need_evidence_type ON neural_need_evidence(evidence_type);
CREATE INDEX idx_workflow_proposals_tenant ON workflow_proposals(tenant_id);
CREATE INDEX idx_workflow_proposals_status ON workflow_proposals(admin_status);
CREATE INDEX idx_workflow_proposals_pattern ON workflow_proposals(source_pattern_id);

ALTER TABLE neural_need_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_need_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_evidence_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY neural_need_patterns_isolation ON neural_need_patterns
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY neural_need_evidence_isolation ON neural_need_evidence
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY workflow_proposals_isolation ON workflow_proposals
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY proposal_evidence_weights_read ON proposal_evidence_weights
    FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Insert default evidence weights
INSERT INTO proposal_evidence_weights (evidence_type, weight, description, is_default) VALUES
    ('workflow_failure', 0.40, 'Existing workflow failed to complete', true),
    ('negative_feedback', 0.35, 'User gave thumbs down or negative rating', true),
    ('manual_override', 0.15, 'User manually switched model/approach', true),
    ('regenerate_request', 0.10, 'User requested regeneration', true),
    ('abandon_session', 0.20, 'User abandoned mid-conversation', true),
    ('low_confidence_completion', 0.15, 'Workflow completed but Neural confidence < 0.5', true),
    ('explicit_request', 0.50, 'User explicitly requested different approach', true);

CREATE TRIGGER update_neural_need_patterns_updated_at 
    BEFORE UPDATE ON neural_need_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_proposals_updated_at 
    BEFORE UPDATE ON workflow_proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
