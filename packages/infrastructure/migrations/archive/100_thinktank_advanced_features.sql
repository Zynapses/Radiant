-- RADIANT v4.18.0 - Think Tank Advanced Features Migration
-- Flash Facts, Grimoire, Economic Governor, Sentinel Agents,
-- Time Travel, Council of Rivals, Security Signals, Policy Framework

-- ============================================================================
-- Flash Facts (Fast-Access Factual Memory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS flash_facts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(64),
    category VARCHAR(32) NOT NULL DEFAULT 'general',
    fact TEXT NOT NULL,
    source VARCHAR(255),
    confidence DECIMAL(3,2) DEFAULT 0.80,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    verified_by VARCHAR(64),
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    embedding VECTOR(1536),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flash_facts_tenant ON flash_facts(tenant_id);
CREATE INDEX idx_flash_facts_user ON flash_facts(tenant_id, user_id);
CREATE INDEX idx_flash_facts_category ON flash_facts(tenant_id, category);
CREATE INDEX idx_flash_facts_tags ON flash_facts USING GIN(tags);
CREATE INDEX idx_flash_facts_embedding ON flash_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS flash_facts_config (
    tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    auto_extract BOOLEAN DEFAULT TRUE,
    min_confidence DECIMAL(3,2) DEFAULT 0.70,
    max_facts_per_user INTEGER DEFAULT 1000,
    retention_days INTEGER DEFAULT 365,
    categories TEXT[] DEFAULT '{general,technical,personal,domain}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Grimoire (Procedural Memory / Spell Book)
-- ============================================================================

CREATE TABLE IF NOT EXISTS grimoire_spells (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(32) NOT NULL,
    school VARCHAR(32) NOT NULL,
    incantation TEXT NOT NULL,
    components TEXT[] DEFAULT '{}',
    effect TEXT,
    power_level INTEGER DEFAULT 5 CHECK (power_level BETWEEN 1 AND 10),
    mana_required INTEGER DEFAULT 100,
    prerequisites TEXT[] DEFAULT '{}',
    side_effects TEXT[] DEFAULT '{}',
    counters TEXT[] DEFAULT '{}',
    is_cantrip BOOLEAN DEFAULT FALSE,
    is_ritual BOOLEAN DEFAULT FALSE,
    status VARCHAR(32) DEFAULT 'draft',
    cast_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2) DEFAULT 0.00,
    last_cast_at TIMESTAMP,
    reflexion_notes JSONB DEFAULT '[]',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grimoire_spells_tenant ON grimoire_spells(tenant_id);
CREATE INDEX idx_grimoire_spells_category ON grimoire_spells(tenant_id, category);
CREATE INDEX idx_grimoire_spells_school ON grimoire_spells(tenant_id, school);
CREATE INDEX idx_grimoire_spells_status ON grimoire_spells(tenant_id, status);

CREATE TABLE IF NOT EXISTS grimoire_casts (
    id VARCHAR(64) PRIMARY KEY,
    spell_id VARCHAR(64) NOT NULL REFERENCES grimoire_spells(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    components_used JSONB DEFAULT '{}',
    result JSONB NOT NULL,
    duration_ms INTEGER,
    mana_used INTEGER,
    cast_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grimoire_casts_spell ON grimoire_casts(spell_id);
CREATE INDEX idx_grimoire_casts_user ON grimoire_casts(tenant_id, user_id);

CREATE TABLE IF NOT EXISTS grimoire_achievements (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(64),
    achievement_type VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_grimoire_achievements_user ON grimoire_achievements(tenant_id, user_id);

-- ============================================================================
-- Economic Governor (Model Arbitrage & Cost Optimization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS economic_governor_config (
    tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    mode VARCHAR(32) DEFAULT 'balanced',
    budget_limit DECIMAL(10,2) DEFAULT 100.00,
    budget_used DECIMAL(10,2) DEFAULT 0.00,
    budget_reset_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
    cost_alert_threshold DECIMAL(5,2) DEFAULT 80.00,
    prefer_self_hosted BOOLEAN DEFAULT TRUE,
    quality_floor DECIMAL(3,2) DEFAULT 0.70,
    latency_target INTEGER DEFAULT 2000,
    model_tiers JSONB DEFAULT '[]',
    arbitrage_rules JSONB DEFAULT '[]',
    fallback_strategy VARCHAR(32) DEFAULT 'cascade',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS economic_governor_usage (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model VARCHAR(128) NOT NULL,
    tokens INTEGER NOT NULL,
    cost DECIMAL(10,6) NOT NULL,
    latency_ms INTEGER,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_economic_usage_tenant ON economic_governor_usage(tenant_id);
CREATE INDEX idx_economic_usage_recorded ON economic_governor_usage(tenant_id, recorded_at);
CREATE INDEX idx_economic_usage_model ON economic_governor_usage(tenant_id, model);

-- ============================================================================
-- Sentinel Agents (Event-Driven Autonomous Agents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sentinel_agents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(32) DEFAULT 'idle',
    watch_domain VARCHAR(64) NOT NULL,
    triggers JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    conditions JSONB DEFAULT '[]',
    cooldown_minutes INTEGER DEFAULT 5,
    last_triggered_at TIMESTAMP,
    trigger_count INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 5,
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentinel_agents_tenant ON sentinel_agents(tenant_id);
CREATE INDEX idx_sentinel_agents_type ON sentinel_agents(tenant_id, type);
CREATE INDEX idx_sentinel_agents_domain ON sentinel_agents(tenant_id, watch_domain);
CREATE INDEX idx_sentinel_agents_enabled ON sentinel_agents(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS sentinel_events (
    id VARCHAR(64) PRIMARY KEY,
    sentinel_id VARCHAR(64) NOT NULL REFERENCES sentinel_agents(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    trigger_type VARCHAR(32) NOT NULL,
    trigger_data JSONB DEFAULT '{}',
    actions_taken JSONB DEFAULT '[]',
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NOT NULL,
    duration_ms INTEGER NOT NULL
);

CREATE INDEX idx_sentinel_events_sentinel ON sentinel_events(sentinel_id);
CREATE INDEX idx_sentinel_events_tenant ON sentinel_events(tenant_id);
CREATE INDEX idx_sentinel_events_started ON sentinel_events(tenant_id, started_at);

-- ============================================================================
-- Time Travel (Conversation Forking & State Replay)
-- ============================================================================

CREATE TABLE IF NOT EXISTS time_travel_timelines (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    root_checkpoint_id VARCHAR(64) NOT NULL,
    current_checkpoint_id VARCHAR(64) NOT NULL,
    checkpoint_count INTEGER DEFAULT 1,
    fork_count INTEGER DEFAULT 0,
    status VARCHAR(32) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timelines_tenant ON time_travel_timelines(tenant_id);
CREATE INDEX idx_timelines_user ON time_travel_timelines(tenant_id, user_id);
CREATE INDEX idx_timelines_conversation ON time_travel_timelines(tenant_id, conversation_id);

CREATE TABLE IF NOT EXISTS time_travel_checkpoints (
    id VARCHAR(64) PRIMARY KEY,
    timeline_id VARCHAR(64) NOT NULL REFERENCES time_travel_timelines(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    parent_id VARCHAR(64),
    sequence INTEGER NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'auto',
    label VARCHAR(255),
    state JSONB NOT NULL,
    diff JSONB,
    branch_point BOOLEAN DEFAULT FALSE,
    child_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkpoints_timeline ON time_travel_checkpoints(timeline_id);
CREATE INDEX idx_checkpoints_parent ON time_travel_checkpoints(parent_id);
CREATE INDEX idx_checkpoints_sequence ON time_travel_checkpoints(timeline_id, sequence);

CREATE TABLE IF NOT EXISTS time_travel_forks (
    id VARCHAR(64) PRIMARY KEY,
    source_timeline_id VARCHAR(64) NOT NULL REFERENCES time_travel_timelines(id) ON DELETE CASCADE,
    target_timeline_id VARCHAR(64) NOT NULL REFERENCES time_travel_timelines(id) ON DELETE CASCADE,
    checkpoint_id VARCHAR(64) NOT NULL,
    reason TEXT,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forks_source ON time_travel_forks(source_timeline_id);
CREATE INDEX idx_forks_target ON time_travel_forks(target_timeline_id);

-- ============================================================================
-- Council of Rivals (Adversarial Consensus / Multi-Model Debate)
-- ============================================================================

CREATE TABLE IF NOT EXISTS council_of_rivals (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    members JSONB NOT NULL DEFAULT '[]',
    moderator JSONB NOT NULL,
    rules JSONB NOT NULL,
    status VARCHAR(32) DEFAULT 'idle',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_councils_tenant ON council_of_rivals(tenant_id);
CREATE INDEX idx_councils_status ON council_of_rivals(tenant_id, status);

CREATE TABLE IF NOT EXISTS council_debates (
    id VARCHAR(64) PRIMARY KEY,
    council_id VARCHAR(64) NOT NULL REFERENCES council_of_rivals(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    topic TEXT NOT NULL,
    context TEXT,
    rounds JSONB DEFAULT '[]',
    current_round INTEGER DEFAULT 0,
    status VARCHAR(32) DEFAULT 'setup',
    verdict JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_debates_council ON council_debates(council_id);
CREATE INDEX idx_debates_tenant ON council_debates(tenant_id);
CREATE INDEX idx_debates_status ON council_debates(tenant_id, status);

-- ============================================================================
-- Security Signals (SSF/CAEP Integration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_signals (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    source VARCHAR(64) NOT NULL,
    subject JSONB NOT NULL,
    event JSONB NOT NULL,
    context JSONB DEFAULT '{}',
    actions JSONB DEFAULT '[]',
    status VARCHAR(32) DEFAULT 'active',
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_signals_tenant ON security_signals(tenant_id);
CREATE INDEX idx_security_signals_type ON security_signals(tenant_id, type);
CREATE INDEX idx_security_signals_severity ON security_signals(tenant_id, severity);
CREATE INDEX idx_security_signals_status ON security_signals(tenant_id, status);
CREATE INDEX idx_security_signals_created ON security_signals(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS security_policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    triggers JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    priority INTEGER DEFAULT 5,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_policies_tenant ON security_policies(tenant_id);
CREATE INDEX idx_security_policies_enabled ON security_policies(tenant_id, enabled);

-- ============================================================================
-- Policy Framework (Strategic Intelligence & Regulatory Stance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_stances (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain VARCHAR(64) NOT NULL,
    position VARCHAR(32) NOT NULL,
    strength INTEGER DEFAULT 70 CHECK (strength BETWEEN 0 AND 100),
    rationale TEXT,
    sources JSONB DEFAULT '[]',
    implications JSONB DEFAULT '[]',
    enabled BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_stances_tenant ON policy_stances(tenant_id);
CREATE INDEX idx_policy_stances_domain ON policy_stances(tenant_id, domain);
CREATE INDEX idx_policy_stances_enabled ON policy_stances(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS policy_profiles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stances JSONB NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_profiles_tenant ON policy_profiles(tenant_id);
CREATE INDEX idx_policy_profiles_default ON policy_profiles(tenant_id, is_default);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE flash_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_facts_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE grimoire_spells ENABLE ROW LEVEL SECURITY;
ALTER TABLE grimoire_casts ENABLE ROW LEVEL SECURITY;
ALTER TABLE grimoire_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_governor_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_governor_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_travel_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_travel_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_travel_forks ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_of_rivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_stances ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'flash_facts', 'flash_facts_config', 'grimoire_spells', 'grimoire_casts',
        'grimoire_achievements', 'economic_governor_config', 'economic_governor_usage',
        'sentinel_agents', 'sentinel_events', 'time_travel_timelines',
        'time_travel_checkpoints', 'time_travel_forks', 'council_of_rivals',
        'council_debates', 'security_signals', 'security_policies',
        'policy_stances', 'policy_profiles'
    ])
    LOOP
        EXECUTE format('
            CREATE POLICY %I_tenant_isolation ON %I
            FOR ALL
            USING (tenant_id = current_setting(''app.current_tenant_id'', true))
        ', tbl, tbl);
    END LOOP;
END $$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE flash_facts IS 'Fast-access factual memory for Think Tank';
COMMENT ON TABLE grimoire_spells IS 'Procedural memory spells for Think Tank';
COMMENT ON TABLE economic_governor_config IS 'Model arbitrage and cost optimization config';
COMMENT ON TABLE sentinel_agents IS 'Event-driven autonomous agents (watchtowers)';
COMMENT ON TABLE time_travel_timelines IS 'Conversation forking and state replay timelines';
COMMENT ON TABLE council_of_rivals IS 'Multi-model debate councils';
COMMENT ON TABLE security_signals IS 'SSF/CAEP security signals';
COMMENT ON TABLE policy_stances IS 'Policy framework stances';
COMMENT ON TABLE policy_profiles IS 'Policy framework profiles';
