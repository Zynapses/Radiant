-- Migration: 173_user_violations.sql
-- User Violation Enforcement System - Regulatory compliance tracking and enforcement

-- ============================================================================
-- USER VIOLATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Violation details
    category VARCHAR(50) NOT NULL,
    violation_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    status VARCHAR(30) NOT NULL DEFAULT 'reported',
    
    -- Description
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    
    -- Source
    detection_method VARCHAR(30) NOT NULL DEFAULT 'manual_report',
    source_system VARCHAR(100),
    source_reference_id VARCHAR(200),
    
    -- Context
    related_resource_type VARCHAR(100),
    related_resource_id VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    
    -- Enforcement
    action_taken VARCHAR(50),
    action_taken_at TIMESTAMPTZ,
    action_taken_by UUID,
    action_expires_at TIMESTAMPTZ,
    action_notes TEXT,
    
    -- Appeal reference
    appeal_id UUID,
    
    -- Timestamps
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_category CHECK (category IN (
        'hipaa', 'gdpr', 'soc2', 'terms_of_service', 'acceptable_use',
        'content_policy', 'security', 'billing', 'abuse', 'other'
    )),
    CONSTRAINT valid_severity CHECK (severity IN ('warning', 'minor', 'major', 'critical')),
    CONSTRAINT valid_status CHECK (status IN (
        'reported', 'investigating', 'confirmed', 'dismissed', 'appealed', 'resolved', 'escalated'
    )),
    CONSTRAINT valid_action CHECK (action_taken IS NULL OR action_taken IN (
        'warning_issued', 'feature_restricted', 'rate_limited', 'temporarily_suspended',
        'permanently_suspended', 'account_terminated', 'reported_to_authorities', 'no_action'
    )),
    CONSTRAINT valid_detection_method CHECK (detection_method IN (
        'automated', 'manual_report', 'audit', 'external'
    ))
);

-- RLS
ALTER TABLE user_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_violations_tenant_isolation ON user_violations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Indexes
CREATE INDEX idx_user_violations_tenant_user ON user_violations(tenant_id, user_id);
CREATE INDEX idx_user_violations_tenant_status ON user_violations(tenant_id, status);
CREATE INDEX idx_user_violations_tenant_category ON user_violations(tenant_id, category);
CREATE INDEX idx_user_violations_tenant_severity ON user_violations(tenant_id, severity);
CREATE INDEX idx_user_violations_occurred ON user_violations(occurred_at DESC);
CREATE INDEX idx_user_violations_active ON user_violations(tenant_id, user_id) 
    WHERE status NOT IN ('resolved', 'dismissed');
CREATE INDEX idx_user_violations_needs_review ON user_violations(tenant_id, created_at DESC)
    WHERE status IN ('reported', 'investigating');

-- ============================================================================
-- VIOLATION EVIDENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS violation_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    violation_id UUID NOT NULL REFERENCES user_violations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Evidence details
    evidence_type VARCHAR(30) NOT NULL,
    description TEXT NOT NULL,
    content_redacted TEXT NOT NULL,
    content_hash VARCHAR(128),
    
    -- Collection
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collected_by UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_evidence_type CHECK (evidence_type IN (
        'screenshot', 'log', 'document', 'content_snippet', 'api_request', 'other'
    ))
);

ALTER TABLE violation_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY violation_evidence_tenant_isolation ON violation_evidence
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_violation_evidence_violation ON violation_evidence(violation_id);

-- ============================================================================
-- VIOLATION APPEALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS violation_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    violation_id UUID NOT NULL REFERENCES user_violations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Appeal content
    reason VARCHAR(500) NOT NULL,
    explanation TEXT NOT NULL,
    supporting_evidence TEXT,
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    
    -- Review
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    decision VARCHAR(20),
    
    -- Timestamps
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_appeal_status CHECK (status IN (
        'pending', 'under_review', 'approved', 'denied', 'escalated'
    )),
    CONSTRAINT valid_decision CHECK (decision IS NULL OR decision IN (
        'upheld', 'overturned', 'reduced'
    ))
);

ALTER TABLE violation_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY violation_appeals_tenant_isolation ON violation_appeals
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_violation_appeals_violation ON violation_appeals(violation_id);
CREATE INDEX idx_violation_appeals_tenant_user ON violation_appeals(tenant_id, user_id);
CREATE INDEX idx_violation_appeals_pending ON violation_appeals(tenant_id, status)
    WHERE status IN ('pending', 'under_review');

-- ============================================================================
-- ESCALATION POLICIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS violation_escalation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    
    -- Notification settings
    notify_user_on_violation BOOLEAN NOT NULL DEFAULT true,
    notify_user_on_action BOOLEAN NOT NULL DEFAULT true,
    notify_admin_on_critical BOOLEAN NOT NULL DEFAULT true,
    admin_notification_emails TEXT[] DEFAULT '{}',
    
    -- Time windows
    violation_window_days INTEGER NOT NULL DEFAULT 90,
    cooldown_period_days INTEGER NOT NULL DEFAULT 365,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, name)
);

ALTER TABLE violation_escalation_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY violation_escalation_policies_tenant_isolation ON violation_escalation_policies
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_escalation_policies_tenant ON violation_escalation_policies(tenant_id);
CREATE INDEX idx_escalation_policies_default ON violation_escalation_policies(tenant_id, is_default)
    WHERE is_default = true;

-- ============================================================================
-- ESCALATION RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS violation_escalation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES violation_escalation_policies(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    rule_order INTEGER NOT NULL,
    
    -- Trigger conditions
    trigger_type VARCHAR(30) NOT NULL,
    violation_count INTEGER,
    within_days INTEGER,
    severity_threshold VARCHAR(20),
    categories TEXT[] DEFAULT '{}',
    
    -- Action
    action VARCHAR(50) NOT NULL,
    action_duration_days INTEGER,
    
    -- Options
    requires_manual_review BOOLEAN NOT NULL DEFAULT false,
    allow_appeal BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('count', 'severity', 'category')),
    CONSTRAINT valid_rule_action CHECK (action IN (
        'warning_issued', 'feature_restricted', 'rate_limited', 'temporarily_suspended',
        'permanently_suspended', 'account_terminated', 'reported_to_authorities', 'no_action'
    ))
);

ALTER TABLE violation_escalation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY violation_escalation_rules_tenant_isolation ON violation_escalation_rules
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_escalation_rules_policy ON violation_escalation_rules(policy_id, rule_order);

-- ============================================================================
-- USER VIOLATION CONFIG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_violation_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Feature flags
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_enforcement_enabled BOOLEAN NOT NULL DEFAULT false,
    
    -- Default policy
    default_escalation_policy_id UUID REFERENCES violation_escalation_policies(id),
    
    -- Notifications
    notify_user_on_violation BOOLEAN NOT NULL DEFAULT true,
    notify_user_on_action BOOLEAN NOT NULL DEFAULT true,
    notify_admin_on_critical BOOLEAN NOT NULL DEFAULT true,
    admin_notification_emails TEXT[] DEFAULT '{}',
    
    -- Retention
    retention_days INTEGER NOT NULL DEFAULT 2555, -- ~7 years for compliance
    
    -- Appeals
    allow_appeals BOOLEAN NOT NULL DEFAULT true,
    appeal_window_days INTEGER NOT NULL DEFAULT 30,
    max_appeals_per_violation INTEGER NOT NULL DEFAULT 2,
    
    -- Compliance
    require_evidence_redaction BOOLEAN NOT NULL DEFAULT true,
    audit_all_actions BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

ALTER TABLE user_violation_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_violation_config_tenant_isolation ON user_violation_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- USER VIOLATION SUMMARY TABLE (Materialized view pattern)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_violation_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Counts
    total_violations INTEGER NOT NULL DEFAULT 0,
    active_violations INTEGER NOT NULL DEFAULT 0,
    resolved_violations INTEGER NOT NULL DEFAULT 0,
    
    -- By severity
    warning_count INTEGER NOT NULL DEFAULT 0,
    minor_count INTEGER NOT NULL DEFAULT 0,
    major_count INTEGER NOT NULL DEFAULT 0,
    critical_count INTEGER NOT NULL DEFAULT 0,
    
    -- By category (JSONB for flexibility)
    violations_by_category JSONB NOT NULL DEFAULT '{}',
    
    -- Current enforcement
    current_enforcement_action VARCHAR(50),
    enforcement_expires_at TIMESTAMPTZ,
    
    -- Risk assessment
    risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
    risk_score DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    
    -- History
    first_violation_at TIMESTAMPTZ,
    last_violation_at TIMESTAMPTZ,
    last_action_taken_at TIMESTAMPTZ,
    
    -- Appeals
    pending_appeals INTEGER NOT NULL DEFAULT 0,
    total_appeals INTEGER NOT NULL DEFAULT 0,
    appeals_approved INTEGER NOT NULL DEFAULT 0,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id),
    
    CONSTRAINT valid_risk_level CHECK (risk_level IN (
        'low', 'moderate', 'elevated', 'high', 'critical'
    ))
);

ALTER TABLE user_violation_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_violation_summary_tenant_isolation ON user_violation_summary
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_violation_summary_tenant_user ON user_violation_summary(tenant_id, user_id);
CREATE INDEX idx_violation_summary_risk ON user_violation_summary(tenant_id, risk_level);
CREATE INDEX idx_violation_summary_enforcement ON user_violation_summary(tenant_id)
    WHERE current_enforcement_action IS NOT NULL;

-- ============================================================================
-- VIOLATION AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS violation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    violation_id UUID REFERENCES user_violations(id) ON DELETE SET NULL,
    appeal_id UUID REFERENCES violation_appeals(id) ON DELETE SET NULL,
    
    -- Actor
    actor_id UUID,
    actor_type VARCHAR(30) NOT NULL, -- 'system', 'admin', 'user'
    
    -- Action
    action VARCHAR(100) NOT NULL,
    action_details JSONB DEFAULT '{}',
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE violation_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY violation_audit_log_tenant_isolation ON violation_audit_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_violation_audit_tenant ON violation_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_violation_audit_violation ON violation_audit_log(violation_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update user violation summary
CREATE OR REPLACE FUNCTION update_user_violation_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_summary_exists BOOLEAN;
    v_category_counts JSONB;
BEGIN
    -- Check if summary exists
    SELECT EXISTS(
        SELECT 1 FROM user_violation_summary 
        WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
        AND user_id = COALESCE(NEW.user_id, OLD.user_id)
    ) INTO v_summary_exists;
    
    -- Calculate category counts
    SELECT COALESCE(jsonb_object_agg(category, cnt), '{}')
    INTO v_category_counts
    FROM (
        SELECT category, COUNT(*) as cnt
        FROM user_violations
        WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
        AND user_id = COALESCE(NEW.user_id, OLD.user_id)
        GROUP BY category
    ) cats;
    
    IF v_summary_exists THEN
        UPDATE user_violation_summary SET
            total_violations = (
                SELECT COUNT(*) FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
            ),
            active_violations = (
                SELECT COUNT(*) FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                AND status NOT IN ('resolved', 'dismissed')
            ),
            resolved_violations = (
                SELECT COUNT(*) FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                AND status = 'resolved'
            ),
            warning_count = (
                SELECT COUNT(*) FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                AND severity = 'warning'
            ),
            minor_count = (
                SELECT COUNT(*) FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                AND severity = 'minor'
            ),
            major_count = (
                SELECT COUNT(*) FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                AND severity = 'major'
            ),
            critical_count = (
                SELECT COUNT(*) FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                AND severity = 'critical'
            ),
            violations_by_category = v_category_counts,
            first_violation_at = (
                SELECT MIN(occurred_at) FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
            ),
            last_violation_at = (
                SELECT MAX(occurred_at) FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
            ),
            risk_score = (
                SELECT LEAST(100.0, 
                    COALESCE(SUM(
                        CASE severity 
                            WHEN 'critical' THEN 40 
                            WHEN 'major' THEN 20 
                            WHEN 'minor' THEN 10 
                            ELSE 5 
                        END
                    ), 0)
                )
                FROM user_violations 
                WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                AND status NOT IN ('resolved', 'dismissed')
            ),
            risk_level = CASE 
                WHEN (SELECT COUNT(*) FROM user_violations 
                      WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                      AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                      AND severity = 'critical' AND status NOT IN ('resolved', 'dismissed')) > 0 THEN 'critical'
                WHEN (SELECT COUNT(*) FROM user_violations 
                      WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                      AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                      AND severity = 'major' AND status NOT IN ('resolved', 'dismissed')) >= 2 THEN 'high'
                WHEN (SELECT COUNT(*) FROM user_violations 
                      WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                      AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                      AND status NOT IN ('resolved', 'dismissed')) >= 5 THEN 'elevated'
                WHEN (SELECT COUNT(*) FROM user_violations 
                      WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
                      AND user_id = COALESCE(NEW.user_id, OLD.user_id)
                      AND status NOT IN ('resolved', 'dismissed')) >= 2 THEN 'moderate'
                ELSE 'low'
            END,
            updated_at = NOW()
        WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) 
        AND user_id = COALESCE(NEW.user_id, OLD.user_id);
    ELSE
        INSERT INTO user_violation_summary (
            tenant_id, user_id, total_violations, active_violations, 
            violations_by_category, first_violation_at, last_violation_at,
            risk_score, risk_level
        ) VALUES (
            NEW.tenant_id, NEW.user_id, 1, 1,
            v_category_counts, NEW.occurred_at, NEW.occurred_at,
            CASE NEW.severity WHEN 'critical' THEN 40 WHEN 'major' THEN 20 WHEN 'minor' THEN 10 ELSE 5 END,
            CASE NEW.severity WHEN 'critical' THEN 'critical' WHEN 'major' THEN 'elevated' ELSE 'low' END
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update summary on violation changes
CREATE TRIGGER trg_update_violation_summary
AFTER INSERT OR UPDATE OR DELETE ON user_violations
FOR EACH ROW EXECUTE FUNCTION update_user_violation_summary();

-- ============================================================================
-- DEFAULT ESCALATION POLICY (Template)
-- ============================================================================

-- Note: This is a template policy, tenants should create their own
-- INSERT INTO violation_escalation_policies (tenant_id, name, description, is_default) 
-- VALUES (tenant_id, 'Default Policy', 'Standard escalation policy', true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_violations IS 'User regulatory and policy violations with enforcement tracking';
COMMENT ON TABLE violation_evidence IS 'Evidence attached to violations (always redacted)';
COMMENT ON TABLE violation_appeals IS 'User appeals against violations';
COMMENT ON TABLE violation_escalation_policies IS 'Configurable escalation policies per tenant';
COMMENT ON TABLE violation_escalation_rules IS 'Rules defining automatic escalation thresholds';
COMMENT ON TABLE user_violation_config IS 'Per-tenant violation system configuration';
COMMENT ON TABLE user_violation_summary IS 'Aggregated violation summary per user (auto-updated)';
COMMENT ON TABLE violation_audit_log IS 'Immutable audit trail for all violation actions';
