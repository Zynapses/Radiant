-- Migration: 047_multi_agent_collaboration.sql
-- RADIANT v4.18.0 - AGI Enhancement Phase 2: Multi-Agent Collaboration
-- Implements cognitive agents, collaboration sessions, message passing, and emergent behavior tracking

-- ============================================================================
-- COGNITIVE AGENTS - Specialized AI agents with distinct roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS cognitive_agents (
    agent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Agent identity
    role VARCHAR(50) NOT NULL, -- 'planner', 'critic', 'executor', 'verifier', 'researcher', 'synthesizer'
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_icon VARCHAR(50),
    avatar_color VARCHAR(20),
    
    -- Model configuration
    primary_model_id VARCHAR(100) NOT NULL,
    fallback_model_ids TEXT[] DEFAULT '{}',
    system_prompt TEXT NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    
    -- Capabilities
    capabilities TEXT[] DEFAULT '{}', -- 'reasoning', 'coding', 'research', 'critique', 'synthesis'
    specializations JSONB DEFAULT '{}', -- Domain-specific expertise
    
    -- Personality traits (affects collaboration style)
    personality JSONB DEFAULT '{}', -- {assertiveness, openness, detail_orientation, creativity}
    
    -- Beliefs and knowledge (for model-based collaboration)
    beliefs JSONB DEFAULT '{}', -- Current beliefs about the world/task
    knowledge_domains TEXT[] DEFAULT '{}',
    
    -- Performance metrics
    total_activations INTEGER DEFAULT 0,
    successful_activations INTEGER DEFAULT 0,
    avg_response_time_ms DECIMAL(10,2),
    avg_quality_score DECIMAL(5,4),
    collaboration_score DECIMAL(5,4), -- How well it works with others
    
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

ALTER TABLE cognitive_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY cognitive_agents_tenant_isolation ON cognitive_agents
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_cognitive_agents_tenant ON cognitive_agents(tenant_id);
CREATE INDEX idx_cognitive_agents_role ON cognitive_agents(role);
CREATE INDEX idx_cognitive_agents_active ON cognitive_agents(is_active) WHERE is_active = true;

-- ============================================================================
-- COLLABORATION SESSIONS - Multi-agent working sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS collaboration_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    cognitive_session_id UUID, -- Link to cognitive brain session
    
    -- Session metadata
    goal TEXT NOT NULL,
    goal_embedding vector(1536),
    context JSONB DEFAULT '{}',
    
    -- Collaboration configuration
    collaboration_pattern VARCHAR(50) NOT NULL, -- 'debate', 'consensus', 'divide_conquer', 'pipeline', 'swarm'
    participating_agents UUID[] NOT NULL,
    lead_agent_id UUID REFERENCES cognitive_agents(agent_id),
    
    -- Shared context (accessible to all agents)
    shared_memory JSONB DEFAULT '{}',
    shared_artifacts JSONB DEFAULT '[]', -- [{type, content, created_by, timestamp}]
    shared_decisions JSONB DEFAULT '[]', -- [{decision, rationale, made_by, agreed_by, timestamp}]
    
    -- Progress tracking
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'completed', 'failed', 'cancelled'
    current_phase VARCHAR(50),
    phases_completed TEXT[] DEFAULT '{}',
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Results
    final_output TEXT,
    final_confidence DECIMAL(5,4),
    consensus_reached BOOLEAN,
    dissenting_agents UUID[],
    
    -- Metrics
    total_messages INTEGER DEFAULT 0,
    total_rounds INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0,
    duration_ms INTEGER,
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY collaboration_sessions_tenant_isolation ON collaboration_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_collaboration_sessions_tenant ON collaboration_sessions(tenant_id);
CREATE INDEX idx_collaboration_sessions_user ON collaboration_sessions(user_id);
CREATE INDEX idx_collaboration_sessions_status ON collaboration_sessions(status);
CREATE INDEX idx_collaboration_sessions_pattern ON collaboration_sessions(collaboration_pattern);
CREATE INDEX idx_collaboration_sessions_goal_embedding ON collaboration_sessions 
    USING ivfflat (goal_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- AGENT MESSAGES - Communication between agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaboration_sessions(session_id) ON DELETE CASCADE,
    
    -- Message routing
    from_agent_id UUID REFERENCES cognitive_agents(agent_id),
    to_agent_id UUID REFERENCES cognitive_agents(agent_id), -- NULL = broadcast to all
    reply_to_message_id UUID REFERENCES agent_messages(message_id),
    
    -- Message content
    message_type VARCHAR(50) NOT NULL, -- 'proposal', 'critique', 'question', 'answer', 'agreement', 'disagreement', 'synthesis', 'delegation', 'report', 'decision'
    content TEXT NOT NULL,
    content_embedding vector(1536),
    
    -- Structured data
    artifacts JSONB DEFAULT '[]', -- [{type, content}]
    reasoning JSONB DEFAULT '{}', -- Chain of thought
    confidence DECIMAL(5,4),
    
    -- Voting/Agreement
    votes JSONB DEFAULT '{}', -- {agent_id: 'agree'|'disagree'|'abstain'}
    
    -- Performance
    tokens_used INTEGER,
    latency_ms INTEGER,
    
    -- Round tracking (for debate/consensus)
    round_number INTEGER DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_messages_tenant_isolation ON agent_messages
    USING (session_id IN (SELECT session_id FROM collaboration_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE INDEX idx_agent_messages_session ON agent_messages(session_id);
CREATE INDEX idx_agent_messages_from ON agent_messages(from_agent_id);
CREATE INDEX idx_agent_messages_to ON agent_messages(to_agent_id);
CREATE INDEX idx_agent_messages_type ON agent_messages(message_type);
CREATE INDEX idx_agent_messages_round ON agent_messages(session_id, round_number);
CREATE INDEX idx_agent_messages_time ON agent_messages(created_at);

-- ============================================================================
-- AGENT BELIEFS - Belief states for model-based collaboration
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_beliefs (
    belief_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES cognitive_agents(agent_id) ON DELETE CASCADE,
    session_id UUID REFERENCES collaboration_sessions(session_id) ON DELETE CASCADE,
    
    -- Belief content
    belief_type VARCHAR(50) NOT NULL, -- 'world_state', 'agent_model', 'goal_state', 'strategy'
    subject VARCHAR(500) NOT NULL,
    belief JSONB NOT NULL,
    confidence DECIMAL(5,4) DEFAULT 0.5,
    
    -- Provenance
    source_type VARCHAR(50), -- 'observation', 'inference', 'communication', 'prior'
    source_message_id UUID REFERENCES agent_messages(message_id),
    
    -- Validity
    is_current BOOLEAN DEFAULT true,
    superseded_by UUID REFERENCES agent_beliefs(belief_id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_beliefs_agent ON agent_beliefs(agent_id);
CREATE INDEX idx_agent_beliefs_session ON agent_beliefs(session_id);
CREATE INDEX idx_agent_beliefs_current ON agent_beliefs(is_current) WHERE is_current = true;

-- ============================================================================
-- COLLABORATION PATTERNS - Reusable collaboration strategies
-- ============================================================================

CREATE TABLE IF NOT EXISTS collaboration_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Pattern identity
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    pattern_type VARCHAR(50) NOT NULL, -- 'debate', 'consensus', 'divide_conquer', 'pipeline', 'swarm', 'custom'
    
    -- Configuration
    required_roles TEXT[] NOT NULL,
    optional_roles TEXT[] DEFAULT '{}',
    min_agents INTEGER DEFAULT 2,
    max_agents INTEGER,
    
    -- Protocol definition
    phases JSONB NOT NULL, -- [{name, description, participating_roles, success_criteria}]
    message_flow JSONB DEFAULT '{}', -- How messages flow between agents
    termination_conditions JSONB DEFAULT '{}',
    
    -- Default settings
    max_rounds INTEGER DEFAULT 10,
    consensus_threshold DECIMAL(3,2) DEFAULT 0.7,
    timeout_ms INTEGER DEFAULT 300000,
    
    -- Performance tracking
    times_used INTEGER DEFAULT 0,
    avg_success_rate DECIMAL(5,4),
    avg_rounds_to_completion DECIMAL(6,2),
    
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE collaboration_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY collaboration_patterns_tenant_isolation ON collaboration_patterns
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_collaboration_patterns_tenant ON collaboration_patterns(tenant_id);
CREATE INDEX idx_collaboration_patterns_type ON collaboration_patterns(pattern_type);

-- ============================================================================
-- EMERGENT BEHAVIORS - Track emergent intelligence from collaboration
-- ============================================================================

CREATE TABLE IF NOT EXISTS emergent_behaviors (
    behavior_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Behavior identification
    behavior_type VARCHAR(50) NOT NULL, -- 'strategy', 'insight', 'solution_pattern', 'communication_style'
    name VARCHAR(200),
    description TEXT NOT NULL,
    
    -- Source
    discovered_in_session UUID REFERENCES collaboration_sessions(session_id),
    contributing_agents UUID[],
    source_messages UUID[],
    
    -- Characteristics
    effectiveness_score DECIMAL(5,4),
    novelty_score DECIMAL(5,4), -- How different from prior behaviors
    reproducibility_score DECIMAL(5,4),
    
    -- Reuse tracking
    times_observed INTEGER DEFAULT 1,
    times_intentionally_applied INTEGER DEFAULT 0,
    success_rate_when_applied DECIMAL(5,4),
    
    -- Embedding for similarity search
    description_embedding vector(1536),
    
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE emergent_behaviors ENABLE ROW LEVEL SECURITY;
CREATE POLICY emergent_behaviors_tenant_isolation ON emergent_behaviors
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_emergent_behaviors_tenant ON emergent_behaviors(tenant_id);
CREATE INDEX idx_emergent_behaviors_type ON emergent_behaviors(behavior_type);
CREATE INDEX idx_emergent_behaviors_embedding ON emergent_behaviors 
    USING ivfflat (description_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- DEFAULT AGENTS - System-provided cognitive agents
-- ============================================================================

INSERT INTO cognitive_agents (tenant_id, role, name, slug, description, avatar_icon, avatar_color, primary_model_id, system_prompt, capabilities, personality, is_system)
SELECT 
    t.tenant_id,
    agent.role,
    agent.name,
    agent.slug,
    agent.description,
    agent.avatar_icon,
    agent.avatar_color,
    agent.primary_model_id,
    agent.system_prompt,
    agent.capabilities::TEXT[],
    agent.personality::JSONB,
    true
FROM tenants t
CROSS JOIN (VALUES
    -- Planner Agent
    ('planner', 'Strategic Planner', 'planner', 
     'Decomposes complex goals into actionable plans with clear steps and dependencies',
     'map', '#3b82f6',
     'openai/o1',
     'You are a strategic planning specialist. Your role is to:
1. Analyze complex goals and break them into smaller, manageable tasks
2. Identify dependencies between tasks
3. Estimate effort and resources needed
4. Create clear, actionable plans with milestones
5. Consider risks and alternative approaches

Always structure your plans clearly with numbered steps. Be thorough but practical.',
     ARRAY['planning', 'decomposition', 'strategy', 'risk_assessment'],
     '{"assertiveness": 0.7, "detail_orientation": 0.9, "creativity": 0.5}'::JSONB),
    
    -- Critic Agent
    ('critic', 'Critical Analyst', 'critic',
     'Evaluates plans, solutions, and outputs for flaws, risks, and improvements',
     'search', '#ef4444',
     'anthropic/claude-3-5-sonnet-20241022',
     'You are a critical analysis specialist. Your role is to:
1. Identify flaws, gaps, and weaknesses in proposals
2. Challenge assumptions and reasoning
3. Suggest specific improvements
4. Assess risks and edge cases
5. Ensure quality and correctness

Be constructive but thorough. Point out issues clearly but also suggest fixes.',
     ARRAY['critique', 'analysis', 'quality_assurance', 'risk_identification'],
     '{"assertiveness": 0.8, "detail_orientation": 0.95, "creativity": 0.3}'::JSONB),
    
    -- Executor Agent
    ('executor', 'Task Executor', 'executor',
     'Carries out specific tasks, writes code, and produces concrete outputs',
     'zap', '#10b981',
     'anthropic/claude-3-5-sonnet-20241022',
     'You are a task execution specialist. Your role is to:
1. Execute specific tasks given to you
2. Write high-quality code when needed
3. Produce concrete, working outputs
4. Follow specifications precisely
5. Report progress and blockers

Focus on getting things done correctly. Ask for clarification if needed.',
     ARRAY['execution', 'coding', 'implementation', 'production'],
     '{"assertiveness": 0.5, "detail_orientation": 0.85, "creativity": 0.6}'::JSONB),
    
    -- Verifier Agent
    ('verifier', 'Quality Verifier', 'verifier',
     'Verifies outputs against requirements, runs tests, and ensures correctness',
     'check-circle', '#8b5cf6',
     'anthropic/claude-3-5-sonnet-20241022',
     'You are a verification specialist. Your role is to:
1. Verify outputs meet requirements
2. Check for correctness and completeness
3. Run logical tests and edge case analysis
4. Validate against acceptance criteria
5. Provide clear pass/fail assessments

Be rigorous and systematic. Document all verification steps.',
     ARRAY['verification', 'testing', 'validation', 'quality_control'],
     '{"assertiveness": 0.6, "detail_orientation": 1.0, "creativity": 0.2}'::JSONB),
    
    -- Researcher Agent
    ('researcher', 'Knowledge Researcher', 'researcher',
     'Gathers information, explores options, and synthesizes knowledge',
     'book-open', '#f59e0b',
     'perplexity/llama-3.1-sonar-large',
     'You are a research specialist. Your role is to:
1. Gather relevant information on topics
2. Explore multiple perspectives and options
3. Synthesize findings into clear summaries
4. Identify knowledge gaps
5. Provide citations and sources when available

Be thorough in exploration but concise in reporting.',
     ARRAY['research', 'exploration', 'synthesis', 'knowledge_gathering'],
     '{"assertiveness": 0.4, "detail_orientation": 0.8, "creativity": 0.7}'::JSONB),
    
    -- Synthesizer Agent
    ('synthesizer', 'Solution Synthesizer', 'synthesizer',
     'Combines ideas and outputs from multiple agents into coherent solutions',
     'git-merge', '#ec4899',
     'anthropic/claude-3-5-sonnet-20241022',
     'You are a synthesis specialist. Your role is to:
1. Combine ideas from multiple sources
2. Resolve conflicts and contradictions
3. Create coherent, unified outputs
4. Balance competing concerns
5. Produce final deliverables

Focus on creating harmony from diverse inputs. Find common ground.',
     ARRAY['synthesis', 'integration', 'conflict_resolution', 'summarization'],
     '{"assertiveness": 0.5, "detail_orientation": 0.7, "creativity": 0.8}'::JSONB),
    
    -- Devil's Advocate Agent
    ('devils_advocate', 'Devils Advocate', 'devils-advocate',
     'Challenges consensus, argues alternative viewpoints, prevents groupthink',
     'alert-triangle', '#f97316',
     'anthropic/claude-3-5-sonnet-20241022',
     'You are a devil''s advocate. Your role is to:
1. Challenge the prevailing consensus
2. Argue for alternative approaches
3. Identify hidden assumptions
4. Prevent groupthink
5. Stress-test decisions

Be provocative but constructive. Your goal is to strengthen decisions by testing them.',
     ARRAY['challenge', 'alternative_thinking', 'assumption_testing', 'debate'],
     '{"assertiveness": 0.9, "detail_orientation": 0.6, "creativity": 0.9}'::JSONB)
    
) AS agent(role, name, slug, description, avatar_icon, avatar_color, primary_model_id, system_prompt, capabilities, personality)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- ============================================================================
-- DEFAULT COLLABORATION PATTERNS
-- ============================================================================

INSERT INTO collaboration_patterns (tenant_id, name, slug, description, pattern_type, required_roles, phases, max_rounds, consensus_threshold, is_system)
SELECT 
    t.tenant_id,
    pattern.name,
    pattern.slug,
    pattern.description,
    pattern.pattern_type,
    pattern.required_roles::TEXT[],
    pattern.phases::JSONB,
    pattern.max_rounds,
    pattern.consensus_threshold,
    true
FROM tenants t
CROSS JOIN (VALUES
    -- Debate Pattern
    ('Structured Debate', 'debate',
     'Agents take opposing positions and debate to find the best solution',
     'debate',
     ARRAY['planner', 'critic', 'devils_advocate'],
     '[
       {"name": "proposal", "description": "Planner proposes initial solution", "participating_roles": ["planner"]},
       {"name": "critique", "description": "Critic and Devils Advocate challenge the proposal", "participating_roles": ["critic", "devils_advocate"]},
       {"name": "defense", "description": "Planner defends and refines based on critique", "participating_roles": ["planner"]},
       {"name": "synthesis", "description": "All agents work to synthesize final solution", "participating_roles": ["planner", "critic", "devils_advocate"]}
     ]'::JSONB,
     5, 0.7),
    
    -- Consensus Pattern
    ('Consensus Building', 'consensus',
     'All agents must agree before proceeding; focuses on finding common ground',
     'consensus',
     ARRAY['planner', 'critic', 'executor', 'verifier'],
     '[
       {"name": "brainstorm", "description": "All agents propose ideas", "participating_roles": ["planner", "critic", "executor", "verifier"]},
       {"name": "discuss", "description": "Agents discuss and refine proposals", "participating_roles": ["planner", "critic", "executor", "verifier"]},
       {"name": "vote", "description": "Agents vote on proposals", "participating_roles": ["planner", "critic", "executor", "verifier"]},
       {"name": "finalize", "description": "Synthesize agreed-upon approach", "participating_roles": ["planner"]}
     ]'::JSONB,
     10, 0.8),
    
    -- Divide and Conquer Pattern
    ('Divide and Conquer', 'divide-conquer',
     'Planner divides task, agents work in parallel, synthesizer combines results',
     'divide_conquer',
     ARRAY['planner', 'executor', 'synthesizer'],
     '[
       {"name": "decompose", "description": "Planner breaks down the task", "participating_roles": ["planner"]},
       {"name": "assign", "description": "Tasks assigned to executors", "participating_roles": ["planner"]},
       {"name": "execute", "description": "Executors work on subtasks in parallel", "participating_roles": ["executor"]},
       {"name": "synthesize", "description": "Synthesizer combines all outputs", "participating_roles": ["synthesizer"]},
       {"name": "verify", "description": "Final verification of combined result", "participating_roles": ["verifier"]}
     ]'::JSONB,
     3, 0.6),
    
    -- Pipeline Pattern
    ('Sequential Pipeline', 'pipeline',
     'Each agent processes in sequence, passing output to the next',
     'pipeline',
     ARRAY['researcher', 'planner', 'executor', 'verifier'],
     '[
       {"name": "research", "description": "Researcher gathers information", "participating_roles": ["researcher"]},
       {"name": "plan", "description": "Planner creates execution plan", "participating_roles": ["planner"]},
       {"name": "execute", "description": "Executor implements the plan", "participating_roles": ["executor"]},
       {"name": "verify", "description": "Verifier checks the output", "participating_roles": ["verifier"]}
     ]'::JSONB,
     1, 0.5),
    
    -- Critical Review Pattern
    ('Critical Review', 'critical-review',
     'Multiple critics review and improve output iteratively',
     'debate',
     ARRAY['executor', 'critic', 'verifier'],
     '[
       {"name": "produce", "description": "Executor creates initial output", "participating_roles": ["executor"]},
       {"name": "review", "description": "Critic reviews and suggests improvements", "participating_roles": ["critic"]},
       {"name": "revise", "description": "Executor revises based on feedback", "participating_roles": ["executor"]},
       {"name": "verify", "description": "Verifier performs final check", "participating_roles": ["verifier"]}
     ]'::JSONB,
     3, 0.7)
    
) AS pattern(name, slug, description, pattern_type, required_roles, phases, max_rounds, consensus_threshold)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate consensus score for a session
CREATE OR REPLACE FUNCTION calculate_consensus_score(p_session_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_total_votes INTEGER;
    v_agree_votes INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE vote_value = 'agree')
    INTO v_total_votes, v_agree_votes
    FROM agent_messages m,
         jsonb_each_text(m.votes) AS v(agent_id, vote_value)
    WHERE m.session_id = p_session_id;
    
    IF v_total_votes = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN v_agree_votes::DECIMAL / v_total_votes;
END;
$$ LANGUAGE plpgsql;

-- Get active agents for a session
CREATE OR REPLACE FUNCTION get_session_agents(p_session_id UUID)
RETURNS TABLE(agent_id UUID, role VARCHAR, name VARCHAR, system_prompt TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT ca.agent_id, ca.role, ca.name, ca.system_prompt
    FROM collaboration_sessions cs
    JOIN cognitive_agents ca ON ca.agent_id = ANY(cs.participating_agents)
    WHERE cs.session_id = p_session_id
    AND ca.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Detect potential emergent behavior
CREATE OR REPLACE FUNCTION detect_emergent_behavior(p_session_id UUID)
RETURNS TABLE(behavior_type VARCHAR, description TEXT, novelty_score DECIMAL) AS $$
BEGIN
    -- This is a placeholder - actual implementation would use AI
    RETURN QUERY
    SELECT 
        'strategy'::VARCHAR,
        'Detected collaborative strategy: ' || collaboration_pattern,
        0.5::DECIMAL
    FROM collaboration_sessions
    WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_agent_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cognitive_agents_updated
    BEFORE UPDATE ON cognitive_agents
    FOR EACH ROW EXECUTE FUNCTION update_agent_timestamp();

CREATE TRIGGER agent_beliefs_updated
    BEFORE UPDATE ON agent_beliefs
    FOR EACH ROW EXECUTE FUNCTION update_agent_timestamp();

-- Update session metrics on message insert
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE collaboration_sessions SET
        total_messages = total_messages + 1,
        total_tokens_used = total_tokens_used + COALESCE(NEW.tokens_used, 0)
    WHERE session_id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_message_inserted
    AFTER INSERT ON agent_messages
    FOR EACH ROW EXECUTE FUNCTION update_session_on_message();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cognitive_agents IS 'AI agents with specialized roles for multi-agent collaboration';
COMMENT ON TABLE collaboration_sessions IS 'Multi-agent working sessions with shared context';
COMMENT ON TABLE agent_messages IS 'Messages exchanged between agents during collaboration';
COMMENT ON TABLE agent_beliefs IS 'Agent belief states for model-based collaboration';
COMMENT ON TABLE collaboration_patterns IS 'Reusable collaboration strategies and protocols';
COMMENT ON TABLE emergent_behaviors IS 'Tracked emergent intelligence from agent collaboration';
