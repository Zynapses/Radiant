-- Migration: 086_intelligence_features.sql
-- Description: Consolidated migration for all Intelligence Aggregator, AGI Ideas, 
--              Persistent Learning, and Enhanced Feedback features
-- Author: Radiant AI
-- Date: 2024-12-28
-- 
-- This consolidates what would have been migrations 086-090 into a single file
-- since Radiant has not been deployed to production yet.

-- ============================================================================
-- PART 1: INTELLIGENCE AGGREGATOR
-- ============================================================================

-- Uncertainty Detection Events
CREATE TABLE IF NOT EXISTS uncertainty_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    message_id UUID,
    claim_text TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    confidence_score DECIMAL(5, 4) NOT NULL,
    avg_logprob DECIMAL(10, 6),
    min_logprob DECIMAL(10, 6),
    token_count INTEGER,
    verification_triggered BOOLEAN DEFAULT false,
    verification_tool TEXT,
    verification_result JSONB,
    was_corrected BOOLEAN DEFAULT false,
    corrected_text TEXT,
    model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uncertainty_events_tenant ON uncertainty_events(tenant_id);
CREATE INDEX idx_uncertainty_events_confidence ON uncertainty_events(confidence_score);
CREATE INDEX idx_uncertainty_events_triggered ON uncertainty_events(verification_triggered) WHERE verification_triggered = true;

-- Success Memory / Gold Interactions
CREATE TABLE IF NOT EXISTS user_gold_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    prompt_embedding vector(1536),
    response_text TEXT NOT NULL,
    response_embedding vector(1536),
    rating INTEGER NOT NULL CHECK (rating >= 4 AND rating <= 5),
    domain_id UUID,
    orchestration_mode TEXT,
    model_used TEXT,
    token_count INTEGER,
    retrieval_count INTEGER DEFAULT 0,
    last_retrieved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gold_interactions_tenant ON user_gold_interactions(tenant_id);
CREATE INDEX idx_gold_interactions_user ON user_gold_interactions(user_id);
CREATE INDEX idx_gold_interactions_domain ON user_gold_interactions(domain_id);
CREATE INDEX idx_gold_interactions_prompt_embedding ON user_gold_interactions USING ivfflat (prompt_embedding vector_cosine_ops) WITH (lists = 100);

-- MoA Synthesis Sessions
CREATE TABLE IF NOT EXISTS synthesis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    prompt_text TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    proposer_models TEXT[] NOT NULL,
    synthesizer_model TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_latency_ms INTEGER,
    total_cost_cents DECIMAL(10, 4)
);

CREATE INDEX idx_synthesis_sessions_tenant ON synthesis_sessions(tenant_id);
CREATE INDEX idx_synthesis_sessions_status ON synthesis_sessions(status);

-- Synthesis Drafts
CREATE TABLE IF NOT EXISTS synthesis_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES synthesis_sessions(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    draft_text TEXT NOT NULL,
    token_count INTEGER,
    latency_ms INTEGER,
    cost_cents DECIMAL(10, 4),
    quality_score DECIMAL(5, 4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_synthesis_drafts_session ON synthesis_drafts(session_id);

-- Synthesis Results
CREATE TABLE IF NOT EXISTS synthesis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES synthesis_sessions(id) ON DELETE CASCADE,
    synthesized_text TEXT NOT NULL,
    synthesis_method TEXT NOT NULL DEFAULT 'consensus',
    drafts_used INTEGER,
    conflicts_resolved INTEGER DEFAULT 0,
    confidence_score DECIMAL(5, 4),
    user_rating INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_synthesis_results_session ON synthesis_results(session_id);

-- Cross-Provider Verification Sessions
CREATE TABLE IF NOT EXISTS verification_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    original_response TEXT NOT NULL,
    original_model TEXT NOT NULL,
    original_provider TEXT NOT NULL,
    adversary_model TEXT NOT NULL,
    adversary_provider TEXT NOT NULL,
    adversary_persona TEXT NOT NULL DEFAULT 'fact_checker',
    status TEXT NOT NULL DEFAULT 'pending',
    regeneration_count INTEGER DEFAULT 0,
    max_regenerations INTEGER DEFAULT 2,
    final_response TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_verification_sessions_tenant ON verification_sessions(tenant_id);
CREATE INDEX idx_verification_sessions_status ON verification_sessions(status);

-- Verification Issues
CREATE TABLE IF NOT EXISTS verification_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES verification_sessions(id) ON DELETE CASCADE,
    issue_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    description TEXT NOT NULL,
    location_hint TEXT,
    was_addressed BOOLEAN DEFAULT false,
    addressed_in_iteration INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_issues_session ON verification_issues(session_id);
CREATE INDEX idx_verification_issues_severity ON verification_issues(severity);

-- Code Execution Sessions
CREATE TABLE IF NOT EXISTS code_execution_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    language TEXT NOT NULL,
    original_code TEXT NOT NULL,
    current_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    iteration_count INTEGER DEFAULT 0,
    max_iterations INTEGER DEFAULT 3,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_code_execution_sessions_tenant ON code_execution_sessions(tenant_id);
CREATE INDEX idx_code_execution_sessions_status ON code_execution_sessions(status);

-- Code Execution Runs
CREATE TABLE IF NOT EXISTS code_execution_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES code_execution_sessions(id) ON DELETE CASCADE,
    iteration INTEGER NOT NULL,
    code_snapshot TEXT NOT NULL,
    execution_status TEXT NOT NULL,
    stdout TEXT,
    stderr TEXT,
    exit_code INTEGER,
    execution_time_ms INTEGER,
    memory_used_mb INTEGER,
    error_type TEXT,
    patch_applied TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_code_execution_runs_session ON code_execution_runs(session_id);

-- Intelligence Aggregator Configuration
CREATE TABLE IF NOT EXISTS intelligence_aggregator_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    uncertainty_enabled BOOLEAN DEFAULT true,
    uncertainty_threshold DECIMAL(5, 4) DEFAULT 0.85,
    uncertainty_verification_tool TEXT DEFAULT 'web_search',
    success_memory_enabled BOOLEAN DEFAULT true,
    success_memory_min_rating INTEGER DEFAULT 4,
    success_memory_max_interactions INTEGER DEFAULT 1000,
    success_memory_retrieval_count INTEGER DEFAULT 3,
    moa_enabled BOOLEAN DEFAULT false,
    moa_proposer_count INTEGER DEFAULT 3,
    moa_default_proposers TEXT[] DEFAULT ARRAY['gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat'],
    moa_synthesizer_model TEXT DEFAULT 'claude-3-5-sonnet',
    verification_enabled BOOLEAN DEFAULT false,
    verification_modes TEXT[] DEFAULT ARRAY['research', 'analysis'],
    verification_max_regenerations INTEGER DEFAULT 2,
    code_execution_enabled BOOLEAN DEFAULT false,
    code_execution_languages TEXT[] DEFAULT ARRAY['python', 'javascript'],
    code_execution_timeout_seconds INTEGER DEFAULT 10,
    code_execution_memory_mb INTEGER DEFAULT 128,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- ============================================================================
-- PART 2: AGI IDEAS SERVICE
-- ============================================================================

-- Prompt Patterns
CREATE TABLE IF NOT EXISTS prompt_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_code TEXT NOT NULL UNIQUE,
    pattern_regex TEXT NOT NULL,
    pattern_description TEXT,
    suggestions TEXT[] NOT NULL DEFAULT '{}',
    category TEXT,
    domain_specific BOOLEAN DEFAULT false,
    domain_ids UUID[] DEFAULT '{}',
    match_count INTEGER DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common patterns
INSERT INTO prompt_patterns (pattern_code, pattern_regex, pattern_description, suggestions, category) VALUES
    ('how_to', '^how (do|can|to|would)', 'How to do something', ARRAY['step by step', 'with examples', 'for beginners', 'best practices'], 'how_to'),
    ('explain', '^(explain|what is|what are|describe)', 'Explanation requests', ARRAY['in simple terms', 'with analogies', 'the key concepts', 'pros and cons'], 'explain'),
    ('compare', '^(compare|difference|versus|vs)', 'Comparison requests', ARRAY['with a table', 'key differences', 'which is better for', 'trade-offs'], 'compare'),
    ('code', '^(write|create|build|implement|code)', 'Code generation', ARRAY['with error handling', 'with tests', 'with documentation', 'production-ready'], 'code'),
    ('analyze', '^(analyze|review|evaluate|assess)', 'Analysis requests', ARRAY['strengths and weaknesses', 'with recommendations', 'risk assessment', 'detailed breakdown'], 'analyze'),
    ('summarize', '^(summarize|summary|tldr|brief)', 'Summary requests', ARRAY['key points', 'in bullet points', 'executive summary', 'one paragraph'], 'summarize'),
    ('debug', '^(debug|fix|error|issue|problem)', 'Debugging help', ARRAY['with explanation', 'step by step', 'root cause', 'prevention tips'], 'debug'),
    ('optimize', '^(optimize|improve|enhance|speed)', 'Optimization requests', ARRAY['for performance', 'for readability', 'trade-offs', 'benchmarks'], 'optimize')
ON CONFLICT (pattern_code) DO NOTHING;

-- User Prompt History
CREATE TABLE IF NOT EXISTS user_prompt_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    prompt_embedding vector(1536),
    domain_id UUID,
    orchestration_mode TEXT,
    response_rating INTEGER,
    was_refined BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_history_user ON user_prompt_history(user_id);
CREATE INDEX idx_prompt_history_hash ON user_prompt_history(prompt_hash);
CREATE INDEX idx_prompt_history_embedding ON user_prompt_history USING ivfflat (prompt_embedding vector_cosine_ops) WITH (lists = 100);

-- Suggestion Log
CREATE TABLE IF NOT EXISTS suggestion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    partial_prompt TEXT NOT NULL,
    cursor_position INTEGER,
    suggestions JSONB NOT NULL,
    suggestion_count INTEGER,
    selected_suggestion_id TEXT,
    selected_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    source_breakdown JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suggestion_log_user ON suggestion_log(user_id);

-- Result Ideas
CREATE TABLE IF NOT EXISTS result_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    message_id UUID,
    plan_id UUID,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_prompt TEXT,
    confidence DECIMAL(5, 4),
    priority INTEGER DEFAULT 5,
    was_clicked BOOLEAN DEFAULT false,
    clicked_at TIMESTAMPTZ,
    was_dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    source_model TEXT,
    based_on_section TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_result_ideas_user ON result_ideas(user_id);
CREATE INDEX idx_result_ideas_clicked ON result_ideas(was_clicked) WHERE was_clicked = true;

-- Proactive Suggestions
CREATE TABLE IF NOT EXISTS proactive_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    trigger_context JSONB,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_prompt TEXT NOT NULL,
    category TEXT NOT NULL,
    delivered BOOLEAN DEFAULT false,
    delivered_at TIMESTAMPTZ,
    clicked BOOLEAN DEFAULT false,
    clicked_at TIMESTAMPTZ,
    dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proactive_user ON proactive_suggestions(user_id);

-- Trending Prompts
CREATE TABLE IF NOT EXISTS trending_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_template TEXT NOT NULL,
    prompt_hash TEXT NOT NULL UNIQUE,
    domain_id UUID,
    domain_name TEXT,
    usage_count INTEGER DEFAULT 1,
    unique_users INTEGER DEFAULT 1,
    avg_rating DECIMAL(3, 2),
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trending_domain ON trending_prompts(domain_id);
CREATE INDEX idx_trending_usage ON trending_prompts(usage_count DESC);

-- AGI Ideas Configuration
CREATE TABLE IF NOT EXISTS agi_ideas_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    typeahead_enabled BOOLEAN DEFAULT true,
    typeahead_min_chars INTEGER DEFAULT 3,
    typeahead_max_suggestions INTEGER DEFAULT 5,
    typeahead_debounce_ms INTEGER DEFAULT 150,
    typeahead_sources TEXT[] DEFAULT ARRAY['pattern_match', 'domain_aware', 'user_history'],
    typeahead_use_ai BOOLEAN DEFAULT false,
    result_ideas_enabled BOOLEAN DEFAULT true,
    result_ideas_max INTEGER DEFAULT 5,
    result_ideas_min_confidence DECIMAL(5, 4) DEFAULT 0.6,
    result_ideas_categories TEXT[] DEFAULT ARRAY['explore_further', 'related_topic', 'practical_next'],
    result_ideas_modes TEXT[] DEFAULT ARRAY['research', 'analysis', 'thinking', 'extended_thinking'],
    proactive_enabled BOOLEAN DEFAULT false,
    proactive_max_per_day INTEGER DEFAULT 3,
    proactive_quiet_start INTEGER,
    proactive_quiet_end INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- ============================================================================
-- PART 3: PERSISTENT LEARNING
-- ============================================================================

-- Learned Prompts
CREATE TABLE IF NOT EXISTS agi_learned_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    prompt_embedding vector(1536),
    prompt_tokens INTEGER,
    prompt_category TEXT,
    detected_intent TEXT,
    domain_id UUID,
    domain_name TEXT,
    times_used INTEGER DEFAULT 1,
    avg_rating DECIMAL(3, 2),
    total_ratings INTEGER DEFAULT 0,
    success_rate DECIMAL(5, 4),
    common_refinements TEXT[],
    common_follow_ups TEXT[],
    best_orchestration_mode TEXT,
    best_model TEXT,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_global BOOLEAN DEFAULT false,
    user_id UUID REFERENCES users(id),
    UNIQUE(tenant_id, prompt_hash)
);

CREATE INDEX idx_learned_prompts_tenant ON agi_learned_prompts(tenant_id);
CREATE INDEX idx_learned_prompts_hash ON agi_learned_prompts(prompt_hash);
CREATE INDEX idx_learned_prompts_category ON agi_learned_prompts(prompt_category);
CREATE INDEX idx_learned_prompts_embedding ON agi_learned_prompts USING ivfflat (prompt_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_learned_prompts_success ON agi_learned_prompts(success_rate DESC) WHERE success_rate > 0.7;

-- Learned Ideas
CREATE TABLE IF NOT EXISTS agi_learned_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    idea_category TEXT NOT NULL,
    idea_title_template TEXT NOT NULL,
    idea_description_template TEXT NOT NULL,
    suggested_prompt_template TEXT,
    trigger_prompt_patterns TEXT[],
    trigger_response_patterns TEXT[],
    trigger_domains TEXT[],
    trigger_modes TEXT[],
    times_shown INTEGER DEFAULT 0,
    times_clicked INTEGER DEFAULT 0,
    click_rate DECIMAL(5, 4),
    avg_follow_up_rating DECIMAL(3, 2),
    leads_to_satisfaction DECIMAL(5, 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_shown_at TIMESTAMPTZ,
    last_clicked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_global BOOLEAN DEFAULT false,
    user_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    min_confidence DECIMAL(5, 4) DEFAULT 0.5
);

CREATE INDEX idx_learned_ideas_tenant ON agi_learned_ideas(tenant_id);
CREATE INDEX idx_learned_ideas_category ON agi_learned_ideas(idea_category);
CREATE INDEX idx_learned_ideas_click_rate ON agi_learned_ideas(click_rate DESC) WHERE click_rate > 0.1;

-- Prompt-Idea Associations
CREATE TABLE IF NOT EXISTS prompt_idea_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    learned_prompt_id UUID NOT NULL REFERENCES agi_learned_prompts(id) ON DELETE CASCADE,
    learned_idea_id UUID NOT NULL REFERENCES agi_learned_ideas(id) ON DELETE CASCADE,
    association_strength DECIMAL(5, 4) DEFAULT 0.5,
    co_occurrence_count INTEGER DEFAULT 1,
    combined_success_rate DECIMAL(5, 4),
    avg_satisfaction DECIMAL(3, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(learned_prompt_id, learned_idea_id)
);

CREATE INDEX idx_prompt_idea_assoc_prompt ON prompt_idea_associations(learned_prompt_id);
CREATE INDEX idx_prompt_idea_assoc_idea ON prompt_idea_associations(learned_idea_id);

-- Learning Events
CREATE TABLE IF NOT EXISTS agi_learning_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    session_id UUID,
    conversation_id UUID,
    plan_id UUID,
    prompt_text TEXT,
    prompt_hash TEXT,
    idea_id UUID,
    suggestion_id TEXT,
    rating INTEGER,
    orchestration_mode TEXT,
    model_used TEXT,
    domain_id UUID,
    outcome_rating INTEGER,
    outcome_success BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    outcome_recorded_at TIMESTAMPTZ
);

CREATE INDEX idx_learning_events_tenant ON agi_learning_events(tenant_id);
CREATE INDEX idx_learning_events_user ON agi_learning_events(user_id);
CREATE INDEX idx_learning_events_type ON agi_learning_events(event_type);
CREATE INDEX idx_learning_events_prompt ON agi_learning_events(prompt_hash);
CREATE INDEX idx_learning_events_recent ON agi_learning_events(created_at DESC);

-- Learning Aggregates
CREATE TABLE IF NOT EXISTS agi_learning_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aggregate_type TEXT NOT NULL,
    aggregate_key TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL,
    sample_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, aggregate_type, aggregate_key, period_start)
);

CREATE INDEX idx_learning_aggregates_type ON agi_learning_aggregates(aggregate_type, period_start);

-- ============================================================================
-- PART 4: COMPREHENSIVE LEARNING
-- ============================================================================

-- Model Selection Outcomes
CREATE TABLE IF NOT EXISTS agi_model_selection_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    prompt_hash TEXT NOT NULL,
    prompt_category TEXT,
    domain_id UUID,
    domain_name TEXT,
    orchestration_mode TEXT,
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    selection_reason TEXT,
    selection_confidence DECIMAL(5, 4),
    alternatives_considered JSONB,
    response_rating INTEGER,
    response_latency_ms INTEGER,
    response_tokens INTEGER,
    response_cost_cents DECIMAL(10, 4),
    user_satisfaction BOOLEAN,
    was_fallback BOOLEAN DEFAULT false,
    had_error BOOLEAN DEFAULT false,
    error_type TEXT,
    model_domain_score DECIMAL(5, 4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_model_outcomes_tenant ON agi_model_selection_outcomes(tenant_id);
CREATE INDEX idx_model_outcomes_model ON agi_model_selection_outcomes(model_id);
CREATE INDEX idx_model_outcomes_domain ON agi_model_selection_outcomes(domain_id);
CREATE INDEX idx_model_outcomes_mode ON agi_model_selection_outcomes(orchestration_mode);
CREATE INDEX idx_model_outcomes_success ON agi_model_selection_outcomes(user_satisfaction) WHERE user_satisfaction = true;

-- Routing Outcomes
CREATE TABLE IF NOT EXISTS agi_routing_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    routing_path TEXT NOT NULL,
    routing_decision_hash TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    prompt_complexity TEXT,
    domain_id UUID,
    detected_intent TEXT,
    steps_taken JSONB NOT NULL,
    total_latency_ms INTEGER,
    cache_hits INTEGER DEFAULT 0,
    final_rating INTEGER,
    routing_effectiveness DECIMAL(5, 4),
    times_used INTEGER DEFAULT 1,
    avg_rating DECIMAL(3, 2),
    success_rate DECIMAL(5, 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, routing_decision_hash)
);

CREATE INDEX idx_routing_outcomes_tenant ON agi_routing_outcomes(tenant_id);
CREATE INDEX idx_routing_outcomes_path ON agi_routing_outcomes(routing_path);
CREATE INDEX idx_routing_outcomes_success ON agi_routing_outcomes(success_rate DESC);

-- Domain Detection Feedback
CREATE TABLE IF NOT EXISTS agi_domain_detection_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    prompt_text TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    prompt_embedding vector(1536),
    detected_field_id UUID,
    detected_field_name TEXT,
    detected_domain_id UUID,
    detected_domain_name TEXT,
    detected_subspecialty_id UUID,
    detection_confidence DECIMAL(5, 4),
    feedback_type TEXT NOT NULL,
    correct_field_id UUID,
    correct_domain_id UUID,
    correct_subspecialty_id UUID,
    was_correct BOOLEAN,
    updated_detection_model BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_domain_feedback_tenant ON agi_domain_detection_feedback(tenant_id);
CREATE INDEX idx_domain_feedback_hash ON agi_domain_detection_feedback(prompt_hash);
CREATE INDEX idx_domain_feedback_domain ON agi_domain_detection_feedback(detected_domain_id);
CREATE INDEX idx_domain_feedback_embedding ON agi_domain_detection_feedback USING ivfflat (prompt_embedding vector_cosine_ops) WITH (lists = 100);

-- Orchestration Mode Outcomes
CREATE TABLE IF NOT EXISTS agi_orchestration_mode_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    orchestration_mode TEXT NOT NULL,
    prompt_category TEXT,
    domain_id UUID,
    task_complexity TEXT,
    prompt_length INTEGER,
    mode_config JSONB,
    response_rating INTEGER,
    response_quality_score DECIMAL(5, 4),
    response_latency_ms INTEGER,
    total_cost_cents DECIMAL(10, 4),
    times_used INTEGER DEFAULT 1,
    avg_rating DECIMAL(3, 2),
    avg_latency_ms INTEGER,
    success_rate DECIMAL(5, 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, orchestration_mode, prompt_category, COALESCE(domain_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

CREATE INDEX idx_mode_outcomes_tenant ON agi_orchestration_mode_outcomes(tenant_id);
CREATE INDEX idx_mode_outcomes_mode ON agi_orchestration_mode_outcomes(orchestration_mode);
CREATE INDEX idx_mode_outcomes_success ON agi_orchestration_mode_outcomes(success_rate DESC);

-- Response Quality Metrics
CREATE TABLE IF NOT EXISTS agi_response_quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID,
    conversation_id UUID,
    message_id UUID,
    accuracy_score DECIMAL(5, 4),
    completeness_score DECIMAL(5, 4),
    clarity_score DECIMAL(5, 4),
    relevance_score DECIMAL(5, 4),
    helpfulness_score DECIMAL(5, 4),
    explicit_rating INTEGER,
    was_copied BOOLEAN DEFAULT false,
    was_regenerated BOOLEAN DEFAULT false,
    was_edited BOOLEAN DEFAULT false,
    time_spent_reading_ms INTEGER,
    response_length INTEGER,
    has_code_blocks BOOLEAN DEFAULT false,
    has_lists BOOLEAN DEFAULT false,
    has_tables BOOLEAN DEFAULT false,
    reading_level TEXT,
    model_used TEXT,
    orchestration_mode TEXT,
    domain_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quality_metrics_tenant ON agi_response_quality_metrics(tenant_id);
CREATE INDEX idx_quality_metrics_rating ON agi_response_quality_metrics(explicit_rating DESC);
CREATE INDEX idx_quality_metrics_model ON agi_response_quality_metrics(model_used);

-- Preprompt Effectiveness
CREATE TABLE IF NOT EXISTS agi_preprompt_effectiveness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    preprompt_id UUID,
    preprompt_hash TEXT NOT NULL,
    preprompt_version INTEGER DEFAULT 1,
    domain_id UUID,
    orchestration_mode TEXT,
    model_id TEXT,
    response_rating INTEGER,
    user_satisfaction BOOLEAN,
    times_used INTEGER DEFAULT 1,
    avg_rating DECIMAL(3, 2),
    success_rate DECIMAL(5, 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, preprompt_hash, domain_id, orchestration_mode)
);

CREATE INDEX idx_preprompt_eff_tenant ON agi_preprompt_effectiveness(tenant_id);
CREATE INDEX idx_preprompt_eff_success ON agi_preprompt_effectiveness(success_rate DESC);

-- User Learning Profile
CREATE TABLE IF NOT EXISTS agi_user_learning_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferred_response_length TEXT,
    preferred_format TEXT,
    preferred_code_style TEXT,
    preferred_tone TEXT,
    top_domains JSONB,
    preferred_models JSONB,
    peak_usage_hours INTEGER[],
    avg_session_length_minutes INTEGER,
    min_acceptable_confidence DECIMAL(5, 4),
    prefers_verification BOOLEAN DEFAULT false,
    total_interactions INTEGER DEFAULT 0,
    total_ratings_given INTEGER DEFAULT 0,
    avg_rating_given DECIMAL(3, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_user_learning_tenant ON agi_user_learning_profile(tenant_id);
CREATE INDEX idx_user_learning_user ON agi_user_learning_profile(user_id);

-- Unified Learning Log
CREATE TABLE IF NOT EXISTS agi_unified_learning_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    learning_type TEXT NOT NULL,
    event_subtype TEXT,
    session_id UUID,
    conversation_id UUID,
    plan_id UUID,
    input_hash TEXT,
    input_embedding vector(1536),
    decision_type TEXT,
    decision_value TEXT,
    decision_confidence DECIMAL(5, 4),
    outcome_rating INTEGER,
    outcome_success BOOLEAN,
    outcome_recorded_at TIMESTAMPTZ,
    metadata JSONB,
    processed_for_learning BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_unified_log_tenant ON agi_unified_learning_log(tenant_id);
CREATE INDEX idx_unified_log_type ON agi_unified_learning_log(learning_type);
CREATE INDEX idx_unified_log_unprocessed ON agi_unified_learning_log(processed_for_learning) WHERE processed_for_learning = false;
CREATE INDEX idx_unified_log_recent ON agi_unified_learning_log(created_at DESC);

-- ============================================================================
-- PART 5: ENHANCED FEEDBACK SYSTEM
-- ============================================================================

-- Response Feedback
CREATE TABLE IF NOT EXISTS response_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    message_id UUID,
    plan_id UUID,
    response_hash TEXT,
    feedback_type TEXT NOT NULL DEFAULT 'star_rating',
    thumbs TEXT,
    star_rating INTEGER CHECK (star_rating >= 1 AND star_rating <= 5),
    accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    helpfulness_rating INTEGER CHECK (helpfulness_rating >= 1 AND helpfulness_rating <= 5),
    clarity_rating INTEGER CHECK (clarity_rating >= 1 AND clarity_rating <= 5),
    completeness_rating INTEGER CHECK (completeness_rating >= 1 AND completeness_rating <= 5),
    tone_rating INTEGER CHECK (tone_rating >= 1 AND tone_rating <= 5),
    comment TEXT,
    comment_categories TEXT[],
    source TEXT NOT NULL DEFAULT 'think_tank',
    model_used TEXT,
    orchestration_mode TEXT,
    domain_id UUID,
    prompt_length INTEGER,
    response_length INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_feedback CHECK (
        (feedback_type = 'thumbs' AND thumbs IS NOT NULL) OR
        (feedback_type = 'star_rating' AND star_rating IS NOT NULL)
    )
);

CREATE INDEX idx_feedback_tenant ON response_feedback(tenant_id);
CREATE INDEX idx_feedback_user ON response_feedback(user_id);
CREATE INDEX idx_feedback_conversation ON response_feedback(conversation_id);
CREATE INDEX idx_feedback_message ON response_feedback(message_id);
CREATE INDEX idx_feedback_plan ON response_feedback(plan_id);
CREATE INDEX idx_feedback_rating ON response_feedback(star_rating);
CREATE INDEX idx_feedback_model ON response_feedback(model_used);
CREATE INDEX idx_feedback_mode ON response_feedback(orchestration_mode);
CREATE INDEX idx_feedback_domain ON response_feedback(domain_id);
CREATE INDEX idx_feedback_recent ON response_feedback(created_at DESC);
CREATE INDEX idx_feedback_with_comment ON response_feedback(id) WHERE comment IS NOT NULL;

-- Feedback Summaries
CREATE TABLE IF NOT EXISTS feedback_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL,
    scope_value TEXT,
    thumbs_up INTEGER DEFAULT 0,
    thumbs_down INTEGER DEFAULT 0,
    total_star_ratings INTEGER DEFAULT 0,
    sum_star_ratings INTEGER DEFAULT 0,
    avg_star_rating DECIMAL(3, 2),
    star_1_count INTEGER DEFAULT 0,
    star_2_count INTEGER DEFAULT 0,
    star_3_count INTEGER DEFAULT 0,
    star_4_count INTEGER DEFAULT 0,
    star_5_count INTEGER DEFAULT 0,
    avg_accuracy DECIMAL(3, 2),
    avg_helpfulness DECIMAL(3, 2),
    avg_clarity DECIMAL(3, 2),
    avg_completeness DECIMAL(3, 2),
    avg_tone DECIMAL(3, 2),
    total_with_comments INTEGER DEFAULT 0,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, scope_type, scope_value, period_start)
);

CREATE INDEX idx_summaries_tenant ON feedback_summaries(tenant_id);
CREATE INDEX idx_summaries_scope ON feedback_summaries(scope_type, scope_value);

-- Feedback Configuration
CREATE TABLE IF NOT EXISTS feedback_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    default_feedback_type TEXT DEFAULT 'star_rating',
    show_category_ratings BOOLEAN DEFAULT false,
    show_comment_box BOOLEAN DEFAULT true,
    comment_required BOOLEAN DEFAULT false,
    comment_required_threshold INTEGER DEFAULT 2,
    star_labels JSONB DEFAULT '{"1": "Poor", "2": "Fair", "3": "Good", "4": "Very Good", "5": "Excellent"}',
    enabled_categories TEXT[] DEFAULT ARRAY['accuracy', 'helpfulness', 'overall'],
    feedback_prompt_delay_ms INTEGER DEFAULT 3000,
    show_feedback_prompt BOOLEAN DEFAULT true,
    feedback_prompt_text TEXT DEFAULT 'How was this response?',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Part 1: Intelligence Aggregator
ALTER TABLE uncertainty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gold_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_execution_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_execution_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_aggregator_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY uncertainty_events_tenant ON uncertainty_events FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY gold_interactions_tenant ON user_gold_interactions FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY synthesis_sessions_tenant ON synthesis_sessions FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY verification_sessions_tenant ON verification_sessions FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY code_execution_sessions_tenant ON code_execution_sessions FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY aggregator_config_tenant ON intelligence_aggregator_config FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Part 2: AGI Ideas
ALTER TABLE user_prompt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_ideas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY prompt_history_tenant ON user_prompt_history FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY suggestion_log_tenant ON suggestion_log FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY result_ideas_tenant ON result_ideas FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY proactive_tenant ON proactive_suggestions FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY ideas_config_tenant ON agi_ideas_config FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Part 3: Persistent Learning
ALTER TABLE agi_learned_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_learned_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_idea_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_learning_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY learned_prompts_tenant ON agi_learned_prompts FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY learned_ideas_tenant ON agi_learned_ideas FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY prompt_idea_assoc_tenant ON prompt_idea_associations FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY learning_events_tenant ON agi_learning_events FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY learning_aggregates_tenant ON agi_learning_aggregates FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Part 4: Comprehensive Learning
ALTER TABLE agi_model_selection_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_routing_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_domain_detection_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_orchestration_mode_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_response_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_preprompt_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_user_learning_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_unified_learning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY model_outcomes_tenant ON agi_model_selection_outcomes FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY routing_outcomes_tenant ON agi_routing_outcomes FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY domain_feedback_tenant ON agi_domain_detection_feedback FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY mode_outcomes_tenant ON agi_orchestration_mode_outcomes FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY quality_metrics_tenant ON agi_response_quality_metrics FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY preprompt_eff_tenant ON agi_preprompt_effectiveness FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY user_learning_tenant ON agi_user_learning_profile FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY unified_log_tenant ON agi_unified_learning_log FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Part 5: Enhanced Feedback
ALTER TABLE response_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_tenant ON response_feedback FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY summaries_tenant ON feedback_summaries FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY config_tenant ON feedback_config FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Learn from prompt
CREATE OR REPLACE FUNCTION learn_from_prompt(
    p_tenant_id UUID,
    p_user_id UUID,
    p_prompt_text TEXT,
    p_prompt_embedding vector(1536) DEFAULT NULL,
    p_domain_id UUID DEFAULT NULL,
    p_domain_name TEXT DEFAULT NULL,
    p_orchestration_mode TEXT DEFAULT NULL,
    p_rating INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_prompt_hash TEXT;
    v_learned_id UUID;
    v_category TEXT;
BEGIN
    v_prompt_hash := encode(sha256(p_prompt_text::bytea), 'hex');
    
    v_category := CASE
        WHEN p_prompt_text ~* '^how (do|can|to|would)' THEN 'how_to'
        WHEN p_prompt_text ~* '^(explain|what is|what are|describe)' THEN 'explain'
        WHEN p_prompt_text ~* '^(compare|difference|versus|vs)' THEN 'compare'
        WHEN p_prompt_text ~* '^(write|create|build|implement|code)' THEN 'code'
        WHEN p_prompt_text ~* '^(analyze|review|evaluate|assess)' THEN 'analyze'
        ELSE 'general'
    END;
    
    INSERT INTO agi_learned_prompts (
        tenant_id, prompt_text, prompt_hash, prompt_embedding,
        prompt_category, domain_id, domain_name,
        best_orchestration_mode, user_id
    ) VALUES (
        p_tenant_id, p_prompt_text, v_prompt_hash, p_prompt_embedding,
        v_category, p_domain_id, p_domain_name,
        p_orchestration_mode, p_user_id
    )
    ON CONFLICT (tenant_id, prompt_hash) DO UPDATE SET
        times_used = agi_learned_prompts.times_used + 1,
        last_used_at = NOW(),
        avg_rating = CASE 
            WHEN p_rating IS NOT NULL THEN 
                (COALESCE(agi_learned_prompts.avg_rating, 0) * agi_learned_prompts.total_ratings + p_rating) / (agi_learned_prompts.total_ratings + 1)
            ELSE agi_learned_prompts.avg_rating
        END,
        total_ratings = CASE WHEN p_rating IS NOT NULL THEN agi_learned_prompts.total_ratings + 1 ELSE agi_learned_prompts.total_ratings END,
        best_orchestration_mode = COALESCE(p_orchestration_mode, agi_learned_prompts.best_orchestration_mode)
    RETURNING id INTO v_learned_id;
    
    INSERT INTO agi_learning_events (
        tenant_id, user_id, event_type,
        prompt_text, prompt_hash, orchestration_mode, domain_id
    ) VALUES (
        p_tenant_id, p_user_id, 'prompt_submitted',
        p_prompt_text, v_prompt_hash, p_orchestration_mode, p_domain_id
    );
    
    RETURN v_learned_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit feedback
CREATE OR REPLACE FUNCTION submit_response_feedback(
    p_tenant_id UUID,
    p_user_id UUID,
    p_conversation_id UUID DEFAULT NULL,
    p_message_id UUID DEFAULT NULL,
    p_plan_id UUID DEFAULT NULL,
    p_feedback_type TEXT DEFAULT 'star_rating',
    p_thumbs TEXT DEFAULT NULL,
    p_star_rating INTEGER DEFAULT NULL,
    p_comment TEXT DEFAULT NULL,
    p_comment_categories TEXT[] DEFAULT NULL,
    p_model_used TEXT DEFAULT NULL,
    p_orchestration_mode TEXT DEFAULT NULL,
    p_domain_id UUID DEFAULT NULL,
    p_accuracy_rating INTEGER DEFAULT NULL,
    p_helpfulness_rating INTEGER DEFAULT NULL,
    p_clarity_rating INTEGER DEFAULT NULL,
    p_completeness_rating INTEGER DEFAULT NULL,
    p_tone_rating INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_feedback_id UUID;
BEGIN
    INSERT INTO response_feedback (
        tenant_id, user_id, conversation_id, message_id, plan_id,
        feedback_type, thumbs, star_rating,
        comment, comment_categories,
        model_used, orchestration_mode, domain_id,
        accuracy_rating, helpfulness_rating, clarity_rating,
        completeness_rating, tone_rating
    ) VALUES (
        p_tenant_id, p_user_id, p_conversation_id, p_message_id, p_plan_id,
        p_feedback_type, p_thumbs, p_star_rating,
        p_comment, p_comment_categories,
        p_model_used, p_orchestration_mode, p_domain_id,
        p_accuracy_rating, p_helpfulness_rating, p_clarity_rating,
        p_completeness_rating, p_tone_rating
    )
    RETURNING id INTO v_feedback_id;
    
    -- Trigger learning
    INSERT INTO agi_unified_learning_log (
        tenant_id, user_id, learning_type, event_subtype,
        conversation_id, plan_id,
        outcome_rating, outcome_success, outcome_recorded_at,
        metadata
    ) VALUES (
        p_tenant_id, p_user_id, 'quality', 'feedback_submitted',
        p_conversation_id, p_plan_id,
        p_star_rating, (p_star_rating >= 4 OR p_thumbs = 'up'), NOW(),
        jsonb_build_object(
            'feedback_type', p_feedback_type,
            'model_used', p_model_used,
            'has_comment', p_comment IS NOT NULL
        )
    );
    
    RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get best model for context
CREATE OR REPLACE FUNCTION get_best_model_for_context(
    p_tenant_id UUID,
    p_domain_id UUID DEFAULT NULL,
    p_orchestration_mode TEXT DEFAULT NULL,
    p_prompt_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    model_id TEXT,
    provider TEXT,
    success_rate DECIMAL,
    avg_rating DECIMAL,
    usage_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mso.model_id,
        mso.provider,
        AVG(CASE WHEN mso.user_satisfaction THEN 1.0 ELSE 0.0 END)::decimal as success_rate,
        AVG(mso.response_rating)::decimal as avg_rating,
        COUNT(*)::bigint as usage_count
    FROM agi_model_selection_outcomes mso
    WHERE mso.tenant_id = p_tenant_id
      AND (p_domain_id IS NULL OR mso.domain_id = p_domain_id)
      AND (p_orchestration_mode IS NULL OR mso.orchestration_mode = p_orchestration_mode)
      AND (p_prompt_category IS NULL OR mso.prompt_category = p_prompt_category)
      AND mso.response_rating IS NOT NULL
    GROUP BY mso.model_id, mso.provider
    HAVING COUNT(*) >= 5
    ORDER BY AVG(CASE WHEN mso.user_satisfaction THEN 1.0 ELSE 0.0 END) DESC, COUNT(*) DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION learn_from_prompt TO authenticated;
GRANT EXECUTE ON FUNCTION submit_response_feedback TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_model_for_context TO authenticated;
