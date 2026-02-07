-- Migration: 079_preprompt_learning.sql
-- Date: 2024-12-28
-- Author: RADIANT
-- Purpose: Pre-prompt tracking, feedback learning, and AGI attribution analysis
-- Affects: preprompt_templates, preprompt_instances, preprompt_feedback, preprompt_attribution

-- ============================================================================
-- Pre-Prompt Templates - Reusable pre-prompt patterns
-- ============================================================================

CREATE TABLE IF NOT EXISTS preprompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Template content
    system_prompt TEXT NOT NULL,
    context_template TEXT,                    -- Template with {{variables}}
    instruction_template TEXT,
    
    -- Applicability
    applicable_modes TEXT[] NOT NULL DEFAULT '{}',   -- Orchestration modes
    applicable_domains TEXT[] NOT NULL DEFAULT '{}', -- Domain IDs
    applicable_task_types TEXT[] NOT NULL DEFAULT '{}',
    complexity_range TEXT[] DEFAULT ARRAY['simple', 'moderate', 'complex', 'expert'],
    
    -- Model compatibility
    compatible_models TEXT[] NOT NULL DEFAULT '{}',  -- Model IDs
    preferred_models TEXT[] DEFAULT '{}',
    incompatible_models TEXT[] DEFAULT '{}',
    
    -- Weighting factors (0.0 to 1.0)
    base_effectiveness_score DECIMAL(4,3) NOT NULL DEFAULT 0.5,
    domain_weight DECIMAL(4,3) NOT NULL DEFAULT 0.2,
    mode_weight DECIMAL(4,3) NOT NULL DEFAULT 0.2,
    model_weight DECIMAL(4,3) NOT NULL DEFAULT 0.2,
    complexity_weight DECIMAL(4,3) NOT NULL DEFAULT 0.15,
    task_type_weight DECIMAL(4,3) NOT NULL DEFAULT 0.15,
    feedback_weight DECIMAL(4,3) NOT NULL DEFAULT 0.1,
    
    -- Learning state
    total_uses INTEGER NOT NULL DEFAULT 0,
    successful_uses INTEGER NOT NULL DEFAULT 0,
    avg_feedback_score DECIMAL(3,2) DEFAULT NULL,
    learned_adjustments JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadata
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preprompt_templates_code ON preprompt_templates(template_code);
CREATE INDEX idx_preprompt_templates_modes ON preprompt_templates USING GIN(applicable_modes);
CREATE INDEX idx_preprompt_templates_domains ON preprompt_templates USING GIN(applicable_domains);
CREATE INDEX idx_preprompt_templates_active ON preprompt_templates(is_active);

-- ============================================================================
-- Pre-Prompt Instances - Actual pre-prompts used in plans
-- ============================================================================

CREATE TABLE IF NOT EXISTS preprompt_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL,                    -- Links to agi_brain_plans
    template_id UUID REFERENCES preprompt_templates(id) ON DELETE SET NULL,
    
    -- Instance content (the actual pre-prompt used)
    system_prompt_rendered TEXT NOT NULL,
    context_rendered TEXT,
    instruction_rendered TEXT,
    full_preprompt TEXT NOT NULL,             -- Combined pre-prompt
    
    -- Execution context (full attribution)
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    
    -- Model context
    model_id VARCHAR(100) NOT NULL,
    model_name VARCHAR(255),
    provider VARCHAR(50),
    
    -- Mode context
    orchestration_mode VARCHAR(50) NOT NULL,
    
    -- Domain context
    detected_field_id VARCHAR(100),
    detected_domain_id VARCHAR(100),
    detected_subspecialty_id VARCHAR(100),
    domain_confidence DECIMAL(4,3),
    
    -- Task context
    task_type VARCHAR(50),
    complexity VARCHAR(20),
    prompt_token_count INTEGER,
    
    -- Workflow context
    workflow_id UUID,
    workflow_code VARCHAR(100),
    workflow_step_id VARCHAR(100),
    
    -- Performance metrics
    response_quality_score DECIMAL(3,2),      -- 0-1 from verification step
    latency_ms INTEGER,
    tokens_used INTEGER,
    cost_cents DECIMAL(10,4),
    
    -- Execution status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_preprompt_instances_plan ON preprompt_instances(plan_id);
CREATE INDEX idx_preprompt_instances_template ON preprompt_instances(template_id);
CREATE INDEX idx_preprompt_instances_model ON preprompt_instances(model_id);
CREATE INDEX idx_preprompt_instances_mode ON preprompt_instances(orchestration_mode);
CREATE INDEX idx_preprompt_instances_domain ON preprompt_instances(detected_domain_id);
CREATE INDEX idx_preprompt_instances_created ON preprompt_instances(created_at);

-- ============================================================================
-- Pre-Prompt Feedback - User feedback linked to full context
-- ============================================================================

CREATE TABLE IF NOT EXISTS preprompt_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES preprompt_instances(id) ON DELETE CASCADE,
    
    -- Feedback source
    feedback_source VARCHAR(20) NOT NULL DEFAULT 'user', -- user, auto, admin
    user_id VARCHAR(255),
    
    -- Overall rating
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    thumbs_up BOOLEAN,
    
    -- Detailed feedback
    response_helpful BOOLEAN,
    response_accurate BOOLEAN,
    response_complete BOOLEAN,
    response_appropriate_tone BOOLEAN,
    
    -- Attribution analysis - was the issue the pre-prompt or something else?
    issue_attribution VARCHAR(30),            -- preprompt, model, mode, workflow, domain_detection, other
    issue_attribution_confidence DECIMAL(4,3),
    
    -- Specific feedback
    feedback_text TEXT,
    improvement_suggestions TEXT,
    
    -- Context at feedback time
    conversation_context JSONB DEFAULT '{}',  -- For learning patterns
    
    -- Learning signals
    would_reuse BOOLEAN,
    recommended_changes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preprompt_feedback_instance ON preprompt_feedback(instance_id);
CREATE INDEX idx_preprompt_feedback_rating ON preprompt_feedback(rating);
CREATE INDEX idx_preprompt_feedback_attribution ON preprompt_feedback(issue_attribution);

-- ============================================================================
-- Pre-Prompt Attribution Analysis - Learning what factors affect success
-- ============================================================================

CREATE TABLE IF NOT EXISTS preprompt_attribution_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES preprompt_templates(id) ON DELETE CASCADE,
    
    -- Factor being scored
    factor_type VARCHAR(30) NOT NULL,         -- model, mode, domain, workflow, complexity, task_type
    factor_value VARCHAR(255) NOT NULL,       -- The specific value (e.g., "gpt-4o", "extended_thinking")
    
    -- Attribution scores (how much this factor affects pre-prompt effectiveness)
    success_correlation DECIMAL(4,3) NOT NULL DEFAULT 0.5,  -- -1 to 1
    sample_size INTEGER NOT NULL DEFAULT 0,
    avg_feedback_score DECIMAL(3,2),
    
    -- Confidence in this attribution
    confidence DECIMAL(4,3) NOT NULL DEFAULT 0.0,
    
    -- Derived recommendations
    recommended_weight_adjustment DECIMAL(4,3) DEFAULT 0.0,
    notes TEXT,
    
    -- Learning state
    last_calculated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(template_id, factor_type, factor_value)
);

CREATE INDEX idx_preprompt_attribution_template ON preprompt_attribution_scores(template_id);
CREATE INDEX idx_preprompt_attribution_factor ON preprompt_attribution_scores(factor_type, factor_value);

-- ============================================================================
-- Pre-Prompt Learning Weights - Admin-configurable learning parameters
-- ============================================================================

CREATE TABLE IF NOT EXISTS preprompt_learning_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    
    -- Weight configuration
    config_value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    
    -- Admin controls
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    min_samples_for_learning INTEGER DEFAULT 10,
    learning_rate DECIMAL(4,3) DEFAULT 0.1,
    
    updated_by VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Pre-Prompt Selection Log - Why a pre-prompt was chosen
-- ============================================================================

CREATE TABLE IF NOT EXISTS preprompt_selection_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES preprompt_instances(id) ON DELETE CASCADE,
    
    -- Selection context
    candidates_considered INTEGER NOT NULL,
    selection_method VARCHAR(30) NOT NULL,    -- best_match, random_explore, admin_forced, default
    
    -- Scoring breakdown
    scoring_breakdown JSONB NOT NULL DEFAULT '{}',
    /*
    Example:
    {
      "template_scores": [
        {
          "template_id": "uuid",
          "base_score": 0.75,
          "domain_bonus": 0.15,
          "mode_bonus": 0.10,
          "model_bonus": 0.05,
          "feedback_adjustment": -0.03,
          "final_score": 1.02
        }
      ],
      "selection_reason": "Highest combined score for extended_thinking mode with medical domain"
    }
    */
    
    -- Exploration vs exploitation
    exploration_factor DECIMAL(4,3) DEFAULT 0.0,  -- 0 = pure exploit, 1 = pure explore
    was_exploration BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preprompt_selection_instance ON preprompt_selection_log(instance_id);

-- ============================================================================
-- Materialized View: Pre-Prompt Effectiveness Summary
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS preprompt_effectiveness_summary AS
SELECT 
    pt.id AS template_id,
    pt.template_code,
    pt.name AS template_name,
    
    -- Usage stats
    COUNT(DISTINCT pi.id) AS total_instances,
    COUNT(DISTINCT pf.id) AS total_feedback,
    
    -- Feedback aggregates
    AVG(pf.rating) AS avg_rating,
    COUNT(CASE WHEN pf.thumbs_up = true THEN 1 END)::FLOAT / NULLIF(COUNT(pf.thumbs_up), 0) AS thumbs_up_rate,
    
    -- Attribution breakdown
    COUNT(CASE WHEN pf.issue_attribution = 'preprompt' THEN 1 END) AS blamed_on_preprompt,
    COUNT(CASE WHEN pf.issue_attribution = 'model' THEN 1 END) AS blamed_on_model,
    COUNT(CASE WHEN pf.issue_attribution = 'mode' THEN 1 END) AS blamed_on_mode,
    COUNT(CASE WHEN pf.issue_attribution = 'workflow' THEN 1 END) AS blamed_on_workflow,
    COUNT(CASE WHEN pf.issue_attribution = 'domain_detection' THEN 1 END) AS blamed_on_domain,
    COUNT(CASE WHEN pf.issue_attribution = 'other' THEN 1 END) AS blamed_on_other,
    
    -- Performance
    AVG(pi.response_quality_score) AS avg_quality_score,
    AVG(pi.latency_ms) AS avg_latency_ms,
    AVG(pi.cost_cents) AS avg_cost_cents,
    
    -- By mode breakdown
    jsonb_object_agg(
        COALESCE(pi.orchestration_mode, 'unknown'),
        jsonb_build_object(
            'count', COUNT(CASE WHEN pi.orchestration_mode IS NOT NULL THEN 1 END),
            'avg_rating', AVG(CASE WHEN pi.orchestration_mode IS NOT NULL THEN pf.rating END)
        )
    ) FILTER (WHERE pi.orchestration_mode IS NOT NULL) AS by_mode_stats,
    
    -- Timestamps
    MAX(pi.created_at) AS last_used,
    NOW() AS calculated_at

FROM preprompt_templates pt
LEFT JOIN preprompt_instances pi ON pt.id = pi.template_id
LEFT JOIN preprompt_feedback pf ON pi.id = pf.instance_id
GROUP BY pt.id, pt.template_code, pt.name;

CREATE UNIQUE INDEX idx_preprompt_effectiveness_template ON preprompt_effectiveness_summary(template_id);

-- ============================================================================
-- Function: Calculate Pre-Prompt Score for Selection
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_preprompt_score(
    p_template_id UUID,
    p_mode VARCHAR(50),
    p_domain_id VARCHAR(100),
    p_model_id VARCHAR(100),
    p_complexity VARCHAR(20),
    p_task_type VARCHAR(50)
) RETURNS DECIMAL AS $$
DECLARE
    v_template preprompt_templates%ROWTYPE;
    v_score DECIMAL := 0;
    v_mode_attr DECIMAL;
    v_domain_attr DECIMAL;
    v_model_attr DECIMAL;
BEGIN
    SELECT * INTO v_template FROM preprompt_templates WHERE id = p_template_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Start with base effectiveness
    v_score := v_template.base_effectiveness_score;
    
    -- Add mode bonus if applicable
    IF p_mode = ANY(v_template.applicable_modes) THEN
        v_score := v_score + v_template.mode_weight;
        
        -- Check attribution score for this mode
        SELECT success_correlation INTO v_mode_attr
        FROM preprompt_attribution_scores
        WHERE template_id = p_template_id AND factor_type = 'mode' AND factor_value = p_mode;
        
        IF FOUND THEN
            v_score := v_score + (v_mode_attr * v_template.feedback_weight);
        END IF;
    END IF;
    
    -- Add domain bonus if applicable
    IF p_domain_id = ANY(v_template.applicable_domains) OR array_length(v_template.applicable_domains, 1) IS NULL THEN
        v_score := v_score + v_template.domain_weight;
        
        -- Check attribution score for this domain
        SELECT success_correlation INTO v_domain_attr
        FROM preprompt_attribution_scores
        WHERE template_id = p_template_id AND factor_type = 'domain' AND factor_value = p_domain_id;
        
        IF FOUND THEN
            v_score := v_score + (v_domain_attr * v_template.feedback_weight);
        END IF;
    END IF;
    
    -- Add model bonus if compatible
    IF p_model_id = ANY(v_template.compatible_models) OR p_model_id = ANY(v_template.preferred_models) THEN
        v_score := v_score + v_template.model_weight;
        IF p_model_id = ANY(v_template.preferred_models) THEN
            v_score := v_score + 0.1; -- Extra bonus for preferred
        END IF;
    ELSIF p_model_id = ANY(v_template.incompatible_models) THEN
        v_score := v_score - 0.5; -- Penalty for incompatible
    END IF;
    
    -- Add complexity bonus
    IF p_complexity = ANY(v_template.complexity_range) THEN
        v_score := v_score + v_template.complexity_weight;
    END IF;
    
    -- Add task type bonus
    IF p_task_type = ANY(v_template.applicable_task_types) OR array_length(v_template.applicable_task_types, 1) IS NULL THEN
        v_score := v_score + v_template.task_type_weight;
    END IF;
    
    -- Apply feedback adjustment from average score
    IF v_template.avg_feedback_score IS NOT NULL THEN
        v_score := v_score + ((v_template.avg_feedback_score - 3) / 10); -- -0.2 to +0.2
    END IF;
    
    RETURN GREATEST(0, LEAST(2, v_score)); -- Cap between 0 and 2
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: Update Attribution Scores (called after feedback)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_preprompt_attribution(
    p_instance_id UUID
) RETURNS VOID AS $$
DECLARE
    v_instance preprompt_instances%ROWTYPE;
    v_feedback preprompt_feedback%ROWTYPE;
    v_correlation DECIMAL;
BEGIN
    SELECT * INTO v_instance FROM preprompt_instances WHERE id = p_instance_id;
    SELECT * INTO v_feedback FROM preprompt_feedback WHERE instance_id = p_instance_id ORDER BY created_at DESC LIMIT 1;
    
    IF NOT FOUND OR v_instance.template_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Calculate correlation based on feedback
    v_correlation := CASE 
        WHEN v_feedback.rating >= 4 THEN 0.1
        WHEN v_feedback.rating = 3 THEN 0.0
        ELSE -0.1
    END;
    
    -- Update mode attribution
    INSERT INTO preprompt_attribution_scores (template_id, factor_type, factor_value, success_correlation, sample_size, avg_feedback_score)
    VALUES (v_instance.template_id, 'mode', v_instance.orchestration_mode, v_correlation, 1, v_feedback.rating)
    ON CONFLICT (template_id, factor_type, factor_value) DO UPDATE SET
        success_correlation = (preprompt_attribution_scores.success_correlation * preprompt_attribution_scores.sample_size + v_correlation) / (preprompt_attribution_scores.sample_size + 1),
        sample_size = preprompt_attribution_scores.sample_size + 1,
        avg_feedback_score = (COALESCE(preprompt_attribution_scores.avg_feedback_score, 3) * preprompt_attribution_scores.sample_size + v_feedback.rating) / (preprompt_attribution_scores.sample_size + 1),
        confidence = LEAST(1.0, (preprompt_attribution_scores.sample_size + 1)::DECIMAL / 100),
        last_calculated = NOW();
    
    -- Update model attribution
    INSERT INTO preprompt_attribution_scores (template_id, factor_type, factor_value, success_correlation, sample_size, avg_feedback_score)
    VALUES (v_instance.template_id, 'model', v_instance.model_id, v_correlation, 1, v_feedback.rating)
    ON CONFLICT (template_id, factor_type, factor_value) DO UPDATE SET
        success_correlation = (preprompt_attribution_scores.success_correlation * preprompt_attribution_scores.sample_size + v_correlation) / (preprompt_attribution_scores.sample_size + 1),
        sample_size = preprompt_attribution_scores.sample_size + 1,
        avg_feedback_score = (COALESCE(preprompt_attribution_scores.avg_feedback_score, 3) * preprompt_attribution_scores.sample_size + v_feedback.rating) / (preprompt_attribution_scores.sample_size + 1),
        confidence = LEAST(1.0, (preprompt_attribution_scores.sample_size + 1)::DECIMAL / 100),
        last_calculated = NOW();
    
    -- Update domain attribution if detected
    IF v_instance.detected_domain_id IS NOT NULL THEN
        INSERT INTO preprompt_attribution_scores (template_id, factor_type, factor_value, success_correlation, sample_size, avg_feedback_score)
        VALUES (v_instance.template_id, 'domain', v_instance.detected_domain_id, v_correlation, 1, v_feedback.rating)
        ON CONFLICT (template_id, factor_type, factor_value) DO UPDATE SET
            success_correlation = (preprompt_attribution_scores.success_correlation * preprompt_attribution_scores.sample_size + v_correlation) / (preprompt_attribution_scores.sample_size + 1),
            sample_size = preprompt_attribution_scores.sample_size + 1,
            avg_feedback_score = (COALESCE(preprompt_attribution_scores.avg_feedback_score, 3) * preprompt_attribution_scores.sample_size + v_feedback.rating) / (preprompt_attribution_scores.sample_size + 1),
            confidence = LEAST(1.0, (preprompt_attribution_scores.sample_size + 1)::DECIMAL / 100),
            last_calculated = NOW();
    END IF;
    
    -- Update template stats
    UPDATE preprompt_templates SET
        total_uses = total_uses + 1,
        successful_uses = successful_uses + CASE WHEN v_feedback.rating >= 4 THEN 1 ELSE 0 END,
        avg_feedback_score = (COALESCE(avg_feedback_score, 3) * total_uses + v_feedback.rating) / (total_uses + 1),
        updated_at = NOW()
    WHERE id = v_instance.template_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: Auto-update attribution after feedback
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_attribution()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_preprompt_attribution(NEW.instance_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_preprompt_feedback_attribution
    AFTER INSERT ON preprompt_feedback
    FOR EACH ROW EXECUTE FUNCTION trigger_update_attribution();

-- ============================================================================
-- Seed Data: Default Pre-Prompt Templates
-- ============================================================================

INSERT INTO preprompt_templates (template_code, name, description, system_prompt, context_template, applicable_modes, applicable_task_types, complexity_range, is_default) VALUES

('standard_reasoning', 'Standard Reasoning', 'General-purpose reasoning pre-prompt', 
'You are an expert AI assistant with deep knowledge across many domains. Your goal is to provide accurate, helpful, and well-reasoned responses. Think through problems step-by-step and consider multiple perspectives before answering.',
'Context: {{domain_context}}
User''s expertise level: {{complexity}}
Key topics: {{key_topics}}',
ARRAY['thinking', 'chain_of_thought'],
ARRAY['general', 'reasoning', 'factual'],
ARRAY['simple', 'moderate', 'complex'],
true),

('extended_thinking', 'Extended Thinking', 'Deep reasoning for complex problems',
'You are a world-class reasoning AI. For this complex problem, you will engage in extended, multi-step thinking. Break down the problem into components, consider edge cases, evaluate multiple approaches, and synthesize a comprehensive answer. Take your time - thoroughness is more important than speed.',
'Domain: {{domain_name}} ({{domain_confidence}}% confidence)
Complexity: {{complexity}} - this requires careful analysis
Key considerations: {{key_topics}}',
ARRAY['extended_thinking'],
ARRAY['reasoning', 'research', 'analysis'],
ARRAY['complex', 'expert'],
true),

('coding_expert', 'Coding Expert', 'Code generation and debugging',
'You are an expert software engineer with mastery of multiple programming languages and paradigms. Write clean, efficient, well-documented code following best practices. Include error handling, consider edge cases, and explain your implementation choices.',
'Language/Framework context: {{detected_language}}
Task type: {{task_type}}
Complexity: {{complexity}}',
ARRAY['coding'],
ARRAY['coding'],
ARRAY['simple', 'moderate', 'complex', 'expert'],
true),

('creative_writing', 'Creative Writing', 'Creative and imaginative content',
'You are a gifted creative writer with a unique voice. Engage your imagination fully. Create compelling, original content that resonates emotionally. Pay attention to style, tone, pacing, and narrative structure.',
'Genre/Style: {{detected_style}}
Tone: {{detected_tone}}
Audience: {{audience}}',
ARRAY['creative'],
ARRAY['creative'],
ARRAY['simple', 'moderate', 'complex'],
true),

('research_synthesis', 'Research Synthesis', 'Academic and research tasks',
'You are a research analyst with expertise in synthesizing complex information. Analyze sources critically, identify patterns and connections, and present findings in a structured, well-cited manner. Distinguish between established facts and interpretations.',
'Research domain: {{domain_name}}
Subspecialty: {{subspecialty_name}}
Key topics to investigate: {{key_topics}}',
ARRAY['research', 'analysis'],
ARRAY['research'],
ARRAY['moderate', 'complex', 'expert'],
true),

('multi_model_consensus', 'Multi-Model Consensus', 'When consulting multiple models',
'You are one of several AI models being consulted on this question. Provide your independent analysis and reasoning. Be specific about your confidence levels and any uncertainty. Your response will be synthesized with other perspectives.',
'Your role in ensemble: {{model_role}}
Other models consulted: {{other_models}}
Synthesis strategy: {{synthesis_strategy}}',
ARRAY['multi_model', 'self_consistency'],
ARRAY['reasoning', 'factual', 'research'],
ARRAY['complex', 'expert'],
true),

('domain_expert', 'Domain Expert', 'Domain-specific expertise',
'You are a leading expert in {{domain_name}}. Your deep expertise in {{subspecialty_name}} informs your response. Apply domain-specific terminology, methodologies, and best practices. Consider the latest developments in the field.',
'Domain: {{domain_name}}
Subspecialty: {{subspecialty_name}}
Field: {{field_name}}
Proficiency requirements: {{proficiencies}}',
ARRAY['thinking', 'extended_thinking', 'research'],
ARRAY['general', 'reasoning', 'research', 'factual'],
ARRAY['moderate', 'complex', 'expert'],
true)

ON CONFLICT (template_code) DO NOTHING;

-- ============================================================================
-- Seed Data: Default Learning Configuration
-- ============================================================================

INSERT INTO preprompt_learning_config (config_key, config_value, description) VALUES
('learning_enabled', '{"enabled": true}', 'Master switch for pre-prompt learning'),
('attribution_weights', '{"preprompt": 0.3, "model": 0.25, "mode": 0.2, "domain": 0.15, "workflow": 0.1}', 'Default weights for attribution analysis'),
('exploration_rate', '{"rate": 0.1, "decay": 0.99, "min_rate": 0.01}', 'Exploration vs exploitation balance'),
('feedback_thresholds', '{"min_samples": 10, "confidence_threshold": 0.7, "adjustment_cap": 0.2}', 'Thresholds for applying learned adjustments'),
('mode_specific_weights', '{"extended_thinking": {"preprompt": 0.4}, "coding": {"model": 0.35}, "creative": {"preprompt": 0.35}}', 'Mode-specific weight overrides')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE preprompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE preprompt_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE preprompt_feedback ENABLE ROW LEVEL SECURITY;

-- Templates are readable by all, writable by admins
CREATE POLICY preprompt_templates_read ON preprompt_templates
    FOR SELECT USING (true);

CREATE POLICY preprompt_templates_write ON preprompt_templates
    FOR ALL USING (current_setting('app.is_platform_admin', true)::boolean = true);

-- Instances are tenant-scoped
CREATE POLICY preprompt_instances_policy ON preprompt_instances
    FOR ALL USING (
        current_setting('app.is_platform_admin', true)::boolean = true
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
    );

-- Feedback follows instance access
CREATE POLICY preprompt_feedback_policy ON preprompt_feedback
    FOR ALL USING (
        current_setting('app.is_platform_admin', true)::boolean = true
        OR instance_id IN (
            SELECT id FROM preprompt_instances 
            WHERE tenant_id::text = current_setting('app.current_tenant_id', true)
        )
    );

-- ============================================================================
-- Migration tracking
-- ============================================================================

INSERT INTO schema_migrations (version, name, applied_by) 
VALUES ('079', 'preprompt_learning', 'system')
ON CONFLICT (version) DO NOTHING;
