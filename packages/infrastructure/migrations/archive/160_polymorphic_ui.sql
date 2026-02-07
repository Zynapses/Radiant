-- ============================================================================
-- RADIANT v5.5.0 - Polymorphic UI Integration (PROMPT-41)
-- ============================================================================
-- 
-- This migration adds tables for the Polymorphic UI system:
-- - view_state_history: Tracks UI morphing decisions
-- - execution_escalations: Tracks Sniper → War Room escalations
-- - polymorphic_config: Per-tenant configuration
--
-- Uses IF NOT EXISTS to avoid conflicts with existing schema.
-- ============================================================================

-- ============================================================================
-- VIEW STATE HISTORY TABLE
-- Tracks when and why the UI morphed to different view types
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'view_state_history') THEN
        CREATE TABLE view_state_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            project_id UUID NOT NULL,
            session_id UUID NOT NULL,
            
            -- View type: terminal_simple, mindmap, diff_editor, dashboard, decision_cards, chat
            view_type TEXT NOT NULL CHECK (
                view_type IN ('terminal_simple', 'mindmap', 'diff_editor', 'dashboard', 'decision_cards', 'chat')
            ),
            
            -- Execution mode: sniper (fast/cheap) or war_room (deep/expensive)
            execution_mode TEXT NOT NULL CHECK (execution_mode IN ('sniper', 'war_room')),
            
            -- Domain hint for compliance routing
            domain_hint TEXT DEFAULT 'general' CHECK (
                domain_hint IN ('medical', 'financial', 'legal', 'general')
            ),
            
            -- Why the UI morphed (shown as toast)
            rationale TEXT,
            
            -- Query that triggered this view
            query_text TEXT,
            query_hash TEXT,
            
            -- Cost tracking
            estimated_cost_cents INTEGER DEFAULT 1,
            actual_cost_cents INTEGER,
            
            -- Data payload size for analytics
            data_payload_size_bytes INTEGER,
            
            -- Timing
            created_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            duration_ms INTEGER,
            
            -- User feedback
            user_satisfied BOOLEAN,
            user_escalated BOOLEAN DEFAULT FALSE
        );
        
        RAISE NOTICE 'Created view_state_history table';
    ELSE
        RAISE NOTICE 'view_state_history table already exists';
        
        -- Add missing columns to existing table
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'view_state_history' AND column_name = 'query_hash') THEN
            ALTER TABLE view_state_history ADD COLUMN query_hash TEXT;
            RAISE NOTICE 'Added query_hash column';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'view_state_history' AND column_name = 'user_escalated') THEN
            ALTER TABLE view_state_history ADD COLUMN user_escalated BOOLEAN DEFAULT FALSE;
            RAISE NOTICE 'Added user_escalated column';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- EXECUTION ESCALATIONS TABLE
-- Tracks when users escalate from Sniper → War Room (the "Gearbox" override)
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'execution_escalations') THEN
        CREATE TABLE execution_escalations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            project_id UUID NOT NULL,
            session_id UUID NOT NULL,
            
            -- Original Sniper response that was escalated
            sniper_response_id UUID NOT NULL,
            original_query TEXT NOT NULL,
            sniper_response TEXT,
            sniper_cost_cents INTEGER,
            
            -- Escalation reason
            escalation_reason TEXT NOT NULL CHECK (
                escalation_reason IN ('insufficient_depth', 'factual_doubt', 'need_alternatives', 'compliance_required', 'user_requested')
            ),
            additional_context TEXT,
            
            -- War Room response
            war_room_response TEXT,
            war_room_cost_cents INTEGER,
            
            -- Outcome
            war_room_successful BOOLEAN,
            user_satisfied BOOLEAN,
            
            -- Timing
            escalated_at TIMESTAMPTZ DEFAULT NOW(),
            war_room_started_at TIMESTAMPTZ,
            war_room_completed_at TIMESTAMPTZ,
            
            -- View state reference
            view_state_id UUID REFERENCES view_state_history(id)
        );
        
        RAISE NOTICE 'Created execution_escalations table';
    ELSE
        RAISE NOTICE 'execution_escalations table already exists';
    END IF;
END $$;

-- ============================================================================
-- POLYMORPHIC CONFIG TABLE
-- Per-tenant configuration for Polymorphic UI behavior
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'polymorphic_config') THEN
        CREATE TABLE polymorphic_config (
            tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
            
            -- Feature toggles
            enable_auto_morphing BOOLEAN DEFAULT TRUE,
            enable_gearbox_toggle BOOLEAN DEFAULT TRUE,
            enable_cost_display BOOLEAN DEFAULT TRUE,
            enable_escalation_button BOOLEAN DEFAULT TRUE,
            
            -- Default execution mode
            default_execution_mode TEXT DEFAULT 'sniper' CHECK (
                default_execution_mode IN ('sniper', 'war_room')
            ),
            
            -- View preferences
            default_view_type TEXT DEFAULT 'chat' CHECK (
                default_view_type IN ('terminal_simple', 'mindmap', 'diff_editor', 'dashboard', 'decision_cards', 'chat')
            ),
            
            -- Cost thresholds (cents)
            sniper_cost_limit_cents INTEGER DEFAULT 10,
            war_room_cost_limit_cents INTEGER DEFAULT 100,
            
            -- Domain-specific overrides (JSONB for flexibility)
            domain_view_overrides JSONB DEFAULT '{
                "medical": "diff_editor",
                "financial": "diff_editor", 
                "legal": "diff_editor",
                "general": "chat"
            }'::jsonb,
            
            -- Analytics
            track_view_transitions BOOLEAN DEFAULT TRUE,
            track_escalation_reasons BOOLEAN DEFAULT TRUE,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        RAISE NOTICE 'Created polymorphic_config table';
    ELSE
        RAISE NOTICE 'polymorphic_config table already exists';
    END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_view_state_session 
ON view_state_history(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_view_state_tenant_analytics 
ON view_state_history(tenant_id, created_at DESC, view_type, execution_mode);

CREATE INDEX IF NOT EXISTS idx_view_state_query_hash 
ON view_state_history(query_hash) WHERE query_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escalations_session 
ON execution_escalations(session_id, escalated_at DESC);

CREATE INDEX IF NOT EXISTS idx_escalations_reason_analytics 
ON execution_escalations(tenant_id, escalation_reason, escalated_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

DO $$ 
BEGIN
    -- view_state_history RLS
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'view_state_history' AND policyname = 'view_state_history_tenant_isolation') THEN
        ALTER TABLE view_state_history ENABLE ROW LEVEL SECURITY;
        CREATE POLICY view_state_history_tenant_isolation ON view_state_history
            USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
        RAISE NOTICE 'Created view_state_history RLS policy';
    END IF;
    
    -- execution_escalations RLS
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'execution_escalations' AND policyname = 'execution_escalations_tenant_isolation') THEN
        ALTER TABLE execution_escalations ENABLE ROW LEVEL SECURITY;
        CREATE POLICY execution_escalations_tenant_isolation ON execution_escalations
            USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
        RAISE NOTICE 'Created execution_escalations RLS policy';
    END IF;
    
    -- polymorphic_config RLS
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'polymorphic_config' AND policyname = 'polymorphic_config_tenant_isolation') THEN
        ALTER TABLE polymorphic_config ENABLE ROW LEVEL SECURITY;
        CREATE POLICY polymorphic_config_tenant_isolation ON polymorphic_config
            USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
        RAISE NOTICE 'Created polymorphic_config RLS policy';
    END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get view analytics for a tenant
CREATE OR REPLACE FUNCTION get_view_analytics(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    view_type TEXT,
    execution_mode TEXT,
    total_count BIGINT,
    avg_cost_cents NUMERIC,
    avg_duration_ms NUMERIC,
    escalation_rate NUMERIC,
    satisfaction_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.view_type,
        v.execution_mode,
        COUNT(*)::BIGINT AS total_count,
        AVG(v.actual_cost_cents)::NUMERIC AS avg_cost_cents,
        AVG(v.duration_ms)::NUMERIC AS avg_duration_ms,
        (COUNT(*) FILTER (WHERE v.user_escalated = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) AS escalation_rate,
        (COUNT(*) FILTER (WHERE v.user_satisfied = TRUE)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE v.user_satisfied IS NOT NULL), 0)) AS satisfaction_rate
    FROM view_state_history v
    WHERE v.tenant_id = p_tenant_id
      AND v.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY v.view_type, v.execution_mode
    ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get escalation analytics
CREATE OR REPLACE FUNCTION get_escalation_analytics(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    escalation_reason TEXT,
    total_count BIGINT,
    avg_sniper_cost_cents NUMERIC,
    avg_war_room_cost_cents NUMERIC,
    success_rate NUMERIC,
    satisfaction_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.escalation_reason,
        COUNT(*)::BIGINT AS total_count,
        AVG(e.sniper_cost_cents)::NUMERIC AS avg_sniper_cost_cents,
        AVG(e.war_room_cost_cents)::NUMERIC AS avg_war_room_cost_cents,
        (COUNT(*) FILTER (WHERE e.war_room_successful = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) AS success_rate,
        (COUNT(*) FILTER (WHERE e.user_satisfied = TRUE)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE e.user_satisfied IS NOT NULL), 0)) AS satisfaction_rate
    FROM execution_escalations e
    WHERE e.tenant_id = p_tenant_id
      AND e.escalated_at BETWEEN p_start_date AND p_end_date
    GROUP BY e.escalation_reason
    ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log a view state transition
CREATE OR REPLACE FUNCTION log_view_transition(
    p_tenant_id UUID,
    p_project_id UUID,
    p_session_id UUID,
    p_view_type TEXT,
    p_execution_mode TEXT,
    p_domain_hint TEXT DEFAULT 'general',
    p_rationale TEXT DEFAULT NULL,
    p_query_text TEXT DEFAULT NULL,
    p_estimated_cost_cents INTEGER DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO view_state_history (
        tenant_id, project_id, session_id, view_type, execution_mode,
        domain_hint, rationale, query_text, query_hash, estimated_cost_cents
    ) VALUES (
        p_tenant_id, p_project_id, p_session_id, p_view_type, p_execution_mode,
        p_domain_hint, p_rationale, p_query_text, 
        CASE WHEN p_query_text IS NOT NULL THEN md5(p_query_text) ELSE NULL END,
        p_estimated_cost_cents
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log an escalation from Sniper to War Room
CREATE OR REPLACE FUNCTION log_escalation(
    p_tenant_id UUID,
    p_project_id UUID,
    p_session_id UUID,
    p_sniper_response_id UUID,
    p_original_query TEXT,
    p_escalation_reason TEXT,
    p_sniper_response TEXT DEFAULT NULL,
    p_sniper_cost_cents INTEGER DEFAULT NULL,
    p_additional_context TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO execution_escalations (
        tenant_id, project_id, session_id, sniper_response_id,
        original_query, escalation_reason, sniper_response,
        sniper_cost_cents, additional_context
    ) VALUES (
        p_tenant_id, p_project_id, p_session_id, p_sniper_response_id,
        p_original_query, p_escalation_reason, p_sniper_response,
        p_sniper_cost_cents, p_additional_context
    )
    RETURNING id INTO v_id;
    
    -- Update the view state history to mark as escalated
    UPDATE view_state_history 
    SET user_escalated = TRUE 
    WHERE session_id = p_session_id 
      AND created_at = (
          SELECT MAX(created_at) FROM view_state_history WHERE session_id = p_session_id
      );
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE view_state_history IS 'PROMPT-41: Tracks Polymorphic UI view morphing decisions and outcomes';
COMMENT ON TABLE execution_escalations IS 'PROMPT-41: Tracks Sniper → War Room escalations via the Gearbox';
COMMENT ON TABLE polymorphic_config IS 'PROMPT-41: Per-tenant configuration for Polymorphic UI behavior';
COMMENT ON FUNCTION get_view_analytics IS 'PROMPT-41: Returns view type analytics for a tenant';
COMMENT ON FUNCTION get_escalation_analytics IS 'PROMPT-41: Returns escalation reason analytics for a tenant';
COMMENT ON FUNCTION log_view_transition IS 'PROMPT-41: Logs a UI view transition with all metadata';
COMMENT ON FUNCTION log_escalation IS 'PROMPT-41: Logs a Sniper → War Room escalation';
