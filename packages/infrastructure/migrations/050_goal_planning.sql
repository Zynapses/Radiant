-- Migration: 050_goal_planning.sql
-- RADIANT v4.18.0 - AGI Enhancement Phase 5: Goal Planning
-- Hierarchical Task Networks, milestones, long-horizon planning, and multi-session continuity

-- ============================================================================
-- TASK PLANS - Top-level plans with hierarchical task structure
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Plan identity
    name VARCHAR(500) NOT NULL,
    description TEXT,
    plan_embedding vector(1536),
    
    -- Root goal
    root_goal TEXT NOT NULL,
    root_goal_embedding vector(1536),
    
    -- Plan structure
    task_tree JSONB NOT NULL DEFAULT '{}', -- Hierarchical task structure
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    
    -- Dependencies
    dependencies JSONB DEFAULT '[]', -- External dependencies
    blockers JSONB DEFAULT '[]', -- Current blockers
    
    -- Timing
    estimated_duration_hours DECIMAL(10,2),
    actual_duration_hours DECIMAL(10,2),
    deadline TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed', 'failed', 'abandoned'
    progress DECIMAL(5,2) DEFAULT 0,
    current_phase VARCHAR(100),
    
    -- Multi-session
    is_multi_session BOOLEAN DEFAULT false,
    sessions_count INTEGER DEFAULT 0,
    last_session_id UUID,
    
    -- Priority and importance
    priority INTEGER DEFAULT 5,
    urgency DECIMAL(5,4) DEFAULT 0.5,
    importance DECIMAL(5,4) DEFAULT 0.5,
    
    -- Results
    final_outcome TEXT,
    success_metrics JSONB DEFAULT '{}',
    lessons_learned JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

ALTER TABLE task_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_plans_tenant_isolation ON task_plans
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_task_plans_tenant_user ON task_plans(tenant_id, user_id);
CREATE INDEX idx_task_plans_status ON task_plans(status);
CREATE INDEX idx_task_plans_active ON task_plans(status) WHERE status = 'active';
CREATE INDEX idx_task_plans_goal_embedding ON task_plans 
    USING ivfflat (root_goal_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- PLAN TASKS - Individual tasks within a plan (Hierarchical Task Network nodes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES task_plans(plan_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Task identity
    name VARCHAR(500) NOT NULL,
    description TEXT,
    task_embedding vector(1536),
    
    -- Hierarchy
    parent_task_id UUID REFERENCES plan_tasks(task_id),
    depth INTEGER DEFAULT 0,
    path TEXT, -- e.g., '1.2.3' for navigation
    sequence_number INTEGER DEFAULT 0,
    
    -- Task type (HTN terminology)
    task_type VARCHAR(50) NOT NULL, -- 'compound' (has subtasks), 'primitive' (atomic action)
    decomposition_method VARCHAR(100), -- How compound tasks are broken down
    
    -- Execution
    action_type VARCHAR(100), -- For primitive tasks: 'generate', 'search', 'analyze', 'code', 'review', etc.
    action_params JSONB DEFAULT '{}',
    expected_output TEXT,
    
    -- Dependencies
    depends_on UUID[] DEFAULT '{}', -- Task IDs this depends on
    blocks UUID[] DEFAULT '{}', -- Task IDs blocked by this
    
    -- Preconditions and effects (HTN planning)
    preconditions JSONB DEFAULT '[]', -- [{condition, required_value}]
    effects JSONB DEFAULT '[]', -- [{variable, new_value}]
    
    -- Status and progress
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'ready', 'in_progress', 'completed', 'failed', 'skipped', 'blocked'
    progress DECIMAL(5,2) DEFAULT 0,
    
    -- Timing
    estimated_duration_mins INTEGER,
    actual_duration_mins INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Execution tracking
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    
    -- Results
    output TEXT,
    output_artifacts JSONB DEFAULT '[]',
    success BOOLEAN,
    quality_score DECIMAL(5,4),
    
    -- Assignee (for multi-agent)
    assigned_agent_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_tasks_tenant_isolation ON plan_tasks
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_plan_tasks_plan ON plan_tasks(plan_id);
CREATE INDEX idx_plan_tasks_parent ON plan_tasks(parent_task_id);
CREATE INDEX idx_plan_tasks_status ON plan_tasks(status);
CREATE INDEX idx_plan_tasks_path ON plan_tasks(path);
CREATE INDEX idx_plan_tasks_ready ON plan_tasks(plan_id, status) WHERE status = 'ready';

-- ============================================================================
-- MILESTONES - Key checkpoints in plan execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_milestones (
    milestone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES task_plans(plan_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Milestone identity
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sequence_number INTEGER NOT NULL,
    
    -- Criteria
    success_criteria JSONB NOT NULL, -- [{criterion, metric, target_value}]
    required_tasks UUID[] DEFAULT '{}', -- Tasks that must be complete
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'achieved', 'missed'
    
    -- Timing
    target_date TIMESTAMPTZ,
    achieved_date TIMESTAMPTZ,
    
    -- Verification
    verification_method VARCHAR(50), -- 'automatic', 'manual', 'agent_review'
    verified_by UUID, -- Agent or user who verified
    verification_notes TEXT,
    
    -- Results
    actual_metrics JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_milestones_tenant_isolation ON plan_milestones
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_plan_milestones_plan ON plan_milestones(plan_id);
CREATE INDEX idx_plan_milestones_status ON plan_milestones(status);

-- ============================================================================
-- PLAN SESSIONS - Track work sessions on a plan
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES task_plans(plan_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Session timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_mins INTEGER,
    
    -- Progress
    progress_at_start DECIMAL(5,2),
    progress_at_end DECIMAL(5,2),
    tasks_completed INTEGER DEFAULT 0,
    
    -- Context
    session_context JSONB DEFAULT '{}', -- State at session start
    session_notes TEXT,
    
    -- What was worked on
    tasks_worked_on UUID[] DEFAULT '{}',
    milestones_achieved UUID[] DEFAULT '{}',
    
    -- Handoff for next session
    next_session_context JSONB DEFAULT '{}', -- State to resume from
    next_steps JSONB DEFAULT '[]', -- Suggested next actions
    blockers_discovered JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_sessions_tenant_isolation ON plan_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_plan_sessions_plan ON plan_sessions(plan_id);
CREATE INDEX idx_plan_sessions_user ON plan_sessions(user_id);
CREATE INDEX idx_plan_sessions_time ON plan_sessions(started_at DESC);

-- ============================================================================
-- PLAN REVISIONS - Track changes to plans (replanning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_revisions (
    revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES task_plans(plan_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Revision details
    revision_number INTEGER NOT NULL,
    revision_type VARCHAR(50) NOT NULL, -- 'initial', 'refinement', 'replan', 'scope_change', 'recovery'
    
    -- What changed
    change_summary TEXT NOT NULL,
    previous_task_tree JSONB,
    new_task_tree JSONB,
    tasks_added UUID[] DEFAULT '{}',
    tasks_removed UUID[] DEFAULT '{}',
    tasks_modified UUID[] DEFAULT '{}',
    
    -- Why it changed
    trigger_reason VARCHAR(100), -- 'task_failure', 'new_requirement', 'blocker', 'user_request', 'optimization'
    trigger_details JSONB DEFAULT '{}',
    
    -- Impact
    estimated_impact JSONB DEFAULT '{}', -- {timeline_change, effort_change, etc}
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(50) -- 'system', 'user', agent_id
);

ALTER TABLE plan_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_revisions_tenant_isolation ON plan_revisions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_plan_revisions_plan ON plan_revisions(plan_id);
CREATE INDEX idx_plan_revisions_type ON plan_revisions(revision_type);

-- ============================================================================
-- EXECUTION LOG - Detailed log of plan execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_execution_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES task_plans(plan_id) ON DELETE CASCADE,
    task_id UUID REFERENCES plan_tasks(task_id),
    session_id UUID REFERENCES plan_sessions(session_id),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- 'task_started', 'task_completed', 'task_failed', 'milestone_achieved', 'replan', 'blocked', 'unblocked'
    event_details JSONB DEFAULT '{}',
    
    -- Context
    plan_state_snapshot JSONB, -- State of plan at this point
    
    -- Actor
    triggered_by VARCHAR(50), -- 'system', 'user', agent_id
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_execution_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_execution_log_tenant_isolation ON plan_execution_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_plan_execution_log_plan ON plan_execution_log(plan_id);
CREATE INDEX idx_plan_execution_log_task ON plan_execution_log(task_id);
CREATE INDEX idx_plan_execution_log_session ON plan_execution_log(session_id);
CREATE INDEX idx_plan_execution_log_time ON plan_execution_log(created_at DESC);

-- ============================================================================
-- PLAN TEMPLATES - Reusable plan structures
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Template identity
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    
    -- Template structure
    task_tree_template JSONB NOT NULL,
    milestones_template JSONB DEFAULT '[]',
    
    -- Parameterization
    parameters JSONB DEFAULT '[]', -- [{name, type, description, default_value}]
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    avg_success_rate DECIMAL(5,4),
    avg_completion_time_hours DECIMAL(10,2),
    
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

ALTER TABLE plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_templates_tenant_isolation ON plan_templates
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_plan_templates_tenant ON plan_templates(tenant_id);
CREATE INDEX idx_plan_templates_category ON plan_templates(category);

-- ============================================================================
-- GOAL PLANNING SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS goal_planning_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Planning behavior
    auto_decomposition_enabled BOOLEAN DEFAULT true,
    max_decomposition_depth INTEGER DEFAULT 5,
    default_max_attempts INTEGER DEFAULT 3,
    
    -- Replanning
    auto_replan_on_failure BOOLEAN DEFAULT true,
    replan_threshold DECIMAL(3,2) DEFAULT 0.3, -- Replan if > 30% of tasks fail
    
    -- Multi-session
    multi_session_enabled BOOLEAN DEFAULT true,
    session_handoff_detail_level VARCHAR(20) DEFAULT 'detailed', -- 'minimal', 'standard', 'detailed'
    
    -- Milestones
    auto_milestone_generation BOOLEAN DEFAULT true,
    milestone_check_frequency VARCHAR(20) DEFAULT 'per_task', -- 'per_task', 'per_session', 'manual'
    
    -- Templates
    suggest_templates BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE goal_planning_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY goal_planning_settings_tenant_isolation ON goal_planning_settings
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate plan progress based on completed tasks
CREATE OR REPLACE FUNCTION calculate_plan_progress(p_plan_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total, v_completed
    FROM plan_tasks
    WHERE plan_id = p_plan_id AND task_type = 'primitive';
    
    IF v_total = 0 THEN RETURN 0; END IF;
    RETURN (v_completed::DECIMAL / v_total * 100);
END;
$$ LANGUAGE plpgsql;

-- Get ready tasks (dependencies satisfied)
CREATE OR REPLACE FUNCTION get_ready_tasks(p_plan_id UUID)
RETURNS TABLE(task_id UUID, name VARCHAR, task_type VARCHAR, path TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT pt.task_id, pt.name, pt.task_type, pt.path
    FROM plan_tasks pt
    WHERE pt.plan_id = p_plan_id
      AND pt.status = 'pending'
      AND NOT EXISTS (
          SELECT 1 FROM plan_tasks dep
          WHERE dep.task_id = ANY(pt.depends_on)
            AND dep.status NOT IN ('completed', 'skipped')
      );
END;
$$ LANGUAGE plpgsql;

-- Update task status and cascade effects
CREATE OR REPLACE FUNCTION update_task_status(
    p_task_id UUID,
    p_status VARCHAR,
    p_output TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_plan_id UUID;
BEGIN
    -- Get plan ID
    SELECT plan_id INTO v_plan_id FROM plan_tasks WHERE task_id = p_task_id;
    
    -- Update task
    UPDATE plan_tasks SET
        status = p_status,
        output = COALESCE(p_output, output),
        completed_at = CASE WHEN p_status IN ('completed', 'failed', 'skipped') THEN NOW() ELSE completed_at END,
        success = CASE WHEN p_status = 'completed' THEN true WHEN p_status = 'failed' THEN false ELSE success END,
        updated_at = NOW()
    WHERE task_id = p_task_id;
    
    -- Update blocked tasks if this one completed
    IF p_status = 'completed' THEN
        UPDATE plan_tasks SET
            status = 'pending',
            updated_at = NOW()
        WHERE plan_id = v_plan_id
          AND status = 'blocked'
          AND p_task_id = ANY(depends_on)
          AND NOT EXISTS (
              SELECT 1 FROM plan_tasks dep
              WHERE dep.task_id = ANY(depends_on)
                AND dep.task_id != p_task_id
                AND dep.status NOT IN ('completed', 'skipped')
          );
    END IF;
    
    -- Update plan progress
    UPDATE task_plans SET
        progress = calculate_plan_progress(v_plan_id),
        completed_tasks = (SELECT COUNT(*) FROM plan_tasks WHERE plan_id = v_plan_id AND status = 'completed'),
        updated_at = NOW()
    WHERE plan_id = v_plan_id;
END;
$$ LANGUAGE plpgsql;

-- Start a new plan session
CREATE OR REPLACE FUNCTION start_plan_session(p_plan_id UUID, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_progress DECIMAL;
BEGIN
    SELECT progress INTO v_progress FROM task_plans WHERE plan_id = p_plan_id;
    
    INSERT INTO plan_sessions (plan_id, tenant_id, user_id, progress_at_start, session_context)
    SELECT p_plan_id, tenant_id, p_user_id, v_progress,
           jsonb_build_object('ready_tasks', (SELECT array_agg(task_id) FROM get_ready_tasks(p_plan_id)))
    FROM task_plans WHERE plan_id = p_plan_id
    RETURNING session_id INTO v_session_id;
    
    -- Update plan
    UPDATE task_plans SET
        sessions_count = sessions_count + 1,
        last_session_id = v_session_id,
        status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW()
    WHERE plan_id = p_plan_id;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- End a plan session with handoff
CREATE OR REPLACE FUNCTION end_plan_session(
    p_session_id UUID,
    p_next_steps JSONB DEFAULT '[]',
    p_notes TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_plan_id UUID;
    v_progress DECIMAL;
BEGIN
    SELECT plan_id INTO v_plan_id FROM plan_sessions WHERE session_id = p_session_id;
    SELECT progress INTO v_progress FROM task_plans WHERE plan_id = v_plan_id;
    
    UPDATE plan_sessions SET
        ended_at = NOW(),
        duration_mins = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60,
        progress_at_end = v_progress,
        tasks_completed = (
            SELECT COUNT(*) FROM plan_tasks
            WHERE plan_id = v_plan_id AND status = 'completed'
              AND completed_at >= (SELECT started_at FROM plan_sessions WHERE session_id = p_session_id)
        ),
        next_steps = p_next_steps,
        session_notes = p_notes,
        next_session_context = jsonb_build_object(
            'progress', v_progress,
            'ready_tasks', (SELECT array_agg(task_id) FROM get_ready_tasks(v_plan_id)),
            'blockers', (SELECT blockers FROM task_plans WHERE plan_id = v_plan_id)
        )
    WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_plans_updated
    BEFORE UPDATE ON task_plans
    FOR EACH ROW EXECUTE FUNCTION update_plan_timestamp();

CREATE TRIGGER plan_tasks_updated
    BEFORE UPDATE ON plan_tasks
    FOR EACH ROW EXECUTE FUNCTION update_plan_timestamp();

CREATE TRIGGER goal_planning_settings_updated
    BEFORE UPDATE ON goal_planning_settings
    FOR EACH ROW EXECUTE FUNCTION update_plan_timestamp();

-- Log task status changes
CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO plan_execution_log (plan_id, task_id, tenant_id, event_type, event_details, triggered_by)
        VALUES (
            NEW.plan_id,
            NEW.task_id,
            NEW.tenant_id,
            'task_' || NEW.status,
            jsonb_build_object('previous_status', OLD.status, 'new_status', NEW.status, 'output', NEW.output),
            'system'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_tasks_status_change
    AFTER UPDATE ON plan_tasks
    FOR EACH ROW EXECUTE FUNCTION log_task_status_change();

-- ============================================================================
-- DEFAULT SETTINGS AND TEMPLATES
-- ============================================================================

INSERT INTO goal_planning_settings (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Default plan templates
INSERT INTO plan_templates (tenant_id, name, slug, description, category, task_tree_template, milestones_template, is_system)
SELECT 
    t.tenant_id,
    template.name,
    template.slug,
    template.description,
    template.category,
    template.task_tree_template::JSONB,
    template.milestones_template::JSONB,
    true
FROM tenants t
CROSS JOIN (VALUES
    ('Software Feature Implementation', 'feature-implementation',
     'Standard workflow for implementing a new software feature',
     'development',
     '{
       "root": {
         "name": "Implement Feature",
         "type": "compound",
         "children": [
           {"name": "Requirements Analysis", "type": "compound", "children": [
             {"name": "Gather requirements", "type": "primitive", "action_type": "analyze"},
             {"name": "Define acceptance criteria", "type": "primitive", "action_type": "generate"}
           ]},
           {"name": "Design", "type": "compound", "children": [
             {"name": "Create technical design", "type": "primitive", "action_type": "generate"},
             {"name": "Review design", "type": "primitive", "action_type": "review"}
           ]},
           {"name": "Implementation", "type": "compound", "children": [
             {"name": "Write code", "type": "primitive", "action_type": "code"},
             {"name": "Write tests", "type": "primitive", "action_type": "code"},
             {"name": "Code review", "type": "primitive", "action_type": "review"}
           ]},
           {"name": "Testing", "type": "compound", "children": [
             {"name": "Run unit tests", "type": "primitive", "action_type": "execute"},
             {"name": "Integration testing", "type": "primitive", "action_type": "execute"}
           ]},
           {"name": "Deployment", "type": "primitive", "action_type": "execute"}
         ]
       }
     }',
     '[
       {"name": "Design Complete", "sequence_number": 1, "success_criteria": [{"criterion": "Design reviewed and approved"}]},
       {"name": "Implementation Complete", "sequence_number": 2, "success_criteria": [{"criterion": "All code written and reviewed"}]},
       {"name": "Testing Complete", "sequence_number": 3, "success_criteria": [{"criterion": "All tests passing"}]},
       {"name": "Deployed", "sequence_number": 4, "success_criteria": [{"criterion": "Feature live in production"}]}
     ]'),
    
    ('Research and Analysis', 'research-analysis',
     'Structured approach to researching a topic and producing analysis',
     'research',
     '{
       "root": {
         "name": "Research Topic",
         "type": "compound",
         "children": [
           {"name": "Define Scope", "type": "compound", "children": [
             {"name": "Clarify research question", "type": "primitive", "action_type": "analyze"},
             {"name": "Identify key areas", "type": "primitive", "action_type": "generate"}
           ]},
           {"name": "Information Gathering", "type": "compound", "children": [
             {"name": "Search for sources", "type": "primitive", "action_type": "search"},
             {"name": "Review and extract", "type": "primitive", "action_type": "analyze"}
           ]},
           {"name": "Analysis", "type": "compound", "children": [
             {"name": "Synthesize findings", "type": "primitive", "action_type": "analyze"},
             {"name": "Draw conclusions", "type": "primitive", "action_type": "generate"}
           ]},
           {"name": "Report", "type": "primitive", "action_type": "generate"}
         ]
       }
     }',
     '[
       {"name": "Scope Defined", "sequence_number": 1, "success_criteria": [{"criterion": "Clear research question"}]},
       {"name": "Research Complete", "sequence_number": 2, "success_criteria": [{"criterion": "Sufficient sources gathered"}]},
       {"name": "Analysis Complete", "sequence_number": 3, "success_criteria": [{"criterion": "Conclusions drawn"}]}
     ]'),
    
    ('Problem Debugging', 'problem-debugging',
     'Systematic approach to debugging and fixing issues',
     'debugging',
     '{
       "root": {
         "name": "Debug Problem",
         "type": "compound",
         "children": [
           {"name": "Understand Problem", "type": "compound", "children": [
             {"name": "Reproduce issue", "type": "primitive", "action_type": "execute"},
             {"name": "Gather context", "type": "primitive", "action_type": "analyze"}
           ]},
           {"name": "Diagnose", "type": "compound", "children": [
             {"name": "Form hypotheses", "type": "primitive", "action_type": "analyze"},
             {"name": "Test hypotheses", "type": "primitive", "action_type": "execute"},
             {"name": "Identify root cause", "type": "primitive", "action_type": "analyze"}
           ]},
           {"name": "Fix", "type": "compound", "children": [
             {"name": "Implement fix", "type": "primitive", "action_type": "code"},
             {"name": "Verify fix", "type": "primitive", "action_type": "execute"}
           ]},
           {"name": "Prevent Recurrence", "type": "primitive", "action_type": "generate"}
         ]
       }
     }',
     '[
       {"name": "Problem Understood", "sequence_number": 1, "success_criteria": [{"criterion": "Issue reproducible"}]},
       {"name": "Root Cause Found", "sequence_number": 2, "success_criteria": [{"criterion": "Cause identified"}]},
       {"name": "Fixed", "sequence_number": 3, "success_criteria": [{"criterion": "Issue resolved"}]}
     ]')
    
) AS template(name, slug, description, category, task_tree_template, milestones_template)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE task_plans IS 'Top-level plans with hierarchical task structure for long-horizon planning';
COMMENT ON TABLE plan_tasks IS 'Individual tasks in HTN structure with dependencies and execution tracking';
COMMENT ON TABLE plan_milestones IS 'Key checkpoints for measuring plan progress';
COMMENT ON TABLE plan_sessions IS 'Work sessions on plans for multi-session continuity';
COMMENT ON TABLE plan_revisions IS 'Track changes to plans for replanning and recovery';
COMMENT ON TABLE plan_execution_log IS 'Detailed execution history for analysis and debugging';
COMMENT ON TABLE plan_templates IS 'Reusable plan structures for common task types';
COMMENT ON TABLE goal_planning_settings IS 'Per-tenant configuration for goal planning features';
