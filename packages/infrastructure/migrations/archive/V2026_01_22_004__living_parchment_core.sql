-- RADIANT v5.44.0 - Living Parchment 2029 Vision Core Tables
-- Migration: V2026_01_22_004__living_parchment_core.sql
-- 
-- Creates core tables for all Living Parchment features:
-- - War Room, Memory Palace, Oracle View, Synthesis Engine
-- - Cognitive Load, Council of Experts, Temporal Drift, Debate Arena

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE war_room_status AS ENUM ('planning', 'active', 'deliberating', 'decided', 'archived');
CREATE TYPE stake_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE advisor_type AS ENUM ('ai_model', 'human_expert', 'domain_specialist');
CREATE TYPE participant_role AS ENUM ('owner', 'advisor', 'observer', 'stakeholder');

CREATE TYPE knowledge_node_type AS ENUM ('fact', 'procedure', 'concept', 'experience', 'insight');
CREATE TYPE memory_connection_type AS ENUM ('causal', 'temporal', 'conceptual', 'procedural', 'associative');

CREATE TYPE council_status AS ENUM ('convening', 'debating', 'converging', 'concluded');
CREATE TYPE expert_argument_type AS ENUM ('assertion', 'rebuttal', 'concession', 'question', 'synthesis');

CREATE TYPE debate_status AS ENUM ('setup', 'opening', 'main', 'rebuttal', 'closing', 'resolved');
CREATE TYPE debater_style AS ENUM ('aggressive', 'balanced', 'defensive', 'socratic');
CREATE TYPE debate_argument_type AS ENUM ('claim', 'evidence', 'reasoning', 'rebuttal', 'concession');

CREATE TYPE drift_alert_type AS ENUM ('drift_detected', 'reversal', 'contradiction', 'staleness');
CREATE TYPE drift_severity AS ENUM ('info', 'warning', 'critical');

CREATE TYPE synthesis_source_type AS ENUM ('document', 'conversation', 'database', 'api', 'expert');
CREATE TYPE synthesis_claim_type AS ENUM ('consensus', 'majority', 'contested', 'unique');

-- =============================================================================
-- WAR ROOM TABLES
-- =============================================================================

CREATE TABLE war_room_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status war_room_status NOT NULL DEFAULT 'planning',
    stake_level stake_level NOT NULL DEFAULT 'medium',
    deadline TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- JSONB fields for complex nested data
    confidence_terrain JSONB DEFAULT '{}',
    decision_paths JSONB DEFAULT '[]',
    decision JSONB,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE war_room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES war_room_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    role participant_role NOT NULL DEFAULT 'observer',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_focus JSONB, -- {x, y, z}
    
    UNIQUE(session_id, user_id)
);

CREATE TABLE war_room_advisors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES war_room_sessions(id) ON DELETE CASCADE,
    advisor_type advisor_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    model_id VARCHAR(255),
    specialization VARCHAR(500),
    confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
    breathing_aura JSONB DEFAULT '{"color": "#3b82f6", "rate": 6, "intensity": 0.5}',
    current_position JSONB DEFAULT '{}',
    agreement_map JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MEMORY PALACE TABLES
-- =============================================================================

CREATE TABLE memory_palaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID, -- NULL for org-level
    name VARCHAR(255) NOT NULL,
    freshness_fog_config JSONB DEFAULT '{"enabled": true, "maxDensity": 0.8, "stalenessThresholdDays": 30}',
    last_explored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_knowledge INTEGER DEFAULT 0,
    fresh_knowledge INTEGER DEFAULT 0,
    stale_knowledge INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id, name)
);

CREATE TABLE memory_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    palace_id UUID NOT NULL REFERENCES memory_palaces(id) ON DELETE CASCADE,
    parent_room_id UUID REFERENCES memory_rooms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "z": 0}',
    size JSONB NOT NULL DEFAULT '{"width": 100, "height": 100, "depth": 100}',
    clarity INTEGER DEFAULT 100 CHECK (clarity >= 0 AND clarity <= 100),
    atmosphere JSONB DEFAULT '{"fogDensity": 0, "lightLevel": 100, "color": "#ffffff"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES memory_rooms(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    node_type knowledge_node_type NOT NULL DEFAULT 'fact',
    confidence INTEGER DEFAULT 80 CHECK (confidence >= 0 AND confidence <= 100),
    freshness_score INTEGER DEFAULT 100 CHECK (freshness_score >= 0 AND freshness_score <= 100),
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    learned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_ids UUID[] DEFAULT '{}',
    position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "z": 0}',
    visual_style JSONB DEFAULT '{"glow": 0.5, "size": 10, "color": "#3b82f6"}',
    decay_rate NUMERIC(5,4) DEFAULT 0.01, -- per day
    connection_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memory_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    strength INTEGER DEFAULT 50 CHECK (strength >= 0 AND strength <= 100),
    connection_type memory_connection_type NOT NULL DEFAULT 'associative',
    visual_style JSONB DEFAULT '{"thickness": 2, "luminosity": 0.5, "color": "#6366f1", "animated": false}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(source_node_id, target_node_id)
);

CREATE TABLE discovery_hotspots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    palace_id UUID NOT NULL REFERENCES memory_palaces(id) ON DELETE CASCADE,
    position JSONB NOT NULL,
    potential_insight TEXT NOT NULL,
    related_node_ids UUID[] DEFAULT '{}',
    breathing_beacon JSONB DEFAULT '{"color": "#f59e0b", "rate": 8, "radius": 20}',
    exploration_prompt TEXT,
    discovered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ORACLE VIEW TABLES
-- =============================================================================

CREATE TABLE oracle_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    time_horizon_start TIMESTAMPTZ NOT NULL,
    time_horizon_end TIMESTAMPTZ NOT NULL,
    probability_heatmap JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE TABLE oracle_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oracle_view_id UUID NOT NULL REFERENCES oracle_views(id) ON DELETE CASCADE,
    statement TEXT NOT NULL,
    probability NUMERIC(5,4) NOT NULL CHECK (probability >= 0 AND probability <= 1),
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    timeframe VARCHAR(255),
    category VARCHAR(255),
    supporting_evidence JSONB DEFAULT '[]',
    model_consensus JSONB DEFAULT '[]',
    position JSONB DEFAULT '{"x": 0, "y": 0}',
    visual_style JSONB DEFAULT '{"brightness": 0.5, "pulseRate": 6, "color": "#3b82f6"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bifurcation_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oracle_view_id UUID NOT NULL REFERENCES oracle_views(id) ON DELETE CASCADE,
    position JSONB NOT NULL,
    trigger_event TEXT NOT NULL,
    probability NUMERIC(5,4) NOT NULL,
    branches JSONB NOT NULL DEFAULT '[]',
    animation JSONB DEFAULT '{"forkAngle": 30, "pulseIntensity": 0.5}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ghost_futures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oracle_view_id UUID NOT NULL REFERENCES oracle_views(id) ON DELETE CASCADE,
    scenario TEXT NOT NULL,
    probability NUMERIC(5,4) NOT NULL,
    divergence_point VARCHAR(500),
    outcomes JSONB DEFAULT '[]',
    overlay JSONB DEFAULT '{"opacity": 0.3, "color": "#8b5cf6", "positions": []}',
    impacts JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE black_swan_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oracle_view_id UUID NOT NULL REFERENCES oracle_views(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    probability NUMERIC(7,6) NOT NULL, -- Very small probabilities
    impact INTEGER NOT NULL CHECK (impact >= 0 AND impact <= 100),
    position JSONB NOT NULL,
    visual_style JSONB DEFAULT '{"emberColor": "#ef4444", "dormantOpacity": 0.2, "activationThreshold": 0.1}',
    triggers JSONB DEFAULT '[]',
    mitigations JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SYNTHESIS ENGINE TABLES
-- =============================================================================

CREATE TABLE synthesis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    fusion_result JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE TABLE synthesis_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES synthesis_sessions(id) ON DELETE CASCADE,
    source_type synthesis_source_type NOT NULL,
    name VARCHAR(500) NOT NULL,
    content TEXT,
    credibility_score INTEGER DEFAULT 80 CHECK (credibility_score >= 0 AND credibility_score <= 100),
    position JSONB DEFAULT '{"x": 0, "y": 0}',
    visual_stream JSONB DEFAULT '{"color": "#3b82f6", "flowRate": 1, "width": 2, "path": []}',
    contribution_weight NUMERIC(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE synthesis_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES synthesis_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source_ids UUID[] DEFAULT '{}',
    citation_count INTEGER DEFAULT 0,
    agreement_score INTEGER DEFAULT 0 CHECK (agreement_score >= -100 AND agreement_score <= 100),
    confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
    living_ink JSONB DEFAULT '{}',
    position JSONB DEFAULT '{"x": 0, "y": 0}',
    claim_type synthesis_claim_type NOT NULL DEFAULT 'unique',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agreement_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES synthesis_sessions(id) ON DELETE CASCADE,
    claim_ids UUID[] NOT NULL,
    source_ids UUID[] NOT NULL,
    agreement_level INTEGER DEFAULT 50 CHECK (agreement_level >= 0 AND agreement_level <= 100),
    visual_style JSONB DEFAULT '{"glowColor": "#22c55e", "warmth": 0.5, "pulseRate": 6}',
    bounding_box JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tension_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES synthesis_sessions(id) ON DELETE CASCADE,
    claim_ids UUID[] NOT NULL,
    conflicting_sources JSONB NOT NULL DEFAULT '[]',
    tension_level INTEGER DEFAULT 50 CHECK (tension_level >= 0 AND tension_level <= 100),
    visual_style JSONB DEFAULT '{"crackleColor": "#ef4444", "energyLevel": 0.5, "sparkFrequency": 2}',
    resolution_suggestion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- COGNITIVE LOAD TABLES
-- =============================================================================

CREATE TABLE cognitive_load_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    current_load INTEGER DEFAULT 0 CHECK (current_load >= 0 AND current_load <= 100),
    fatigue_level VARCHAR(50) DEFAULT 'fresh',
    session_duration INTEGER DEFAULT 0, -- minutes
    break_suggested BOOLEAN DEFAULT FALSE,
    overwhelm_active BOOLEAN DEFAULT FALSE,
    overwhelm_level INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attention_heatmap JSONB DEFAULT '{}',
    adaptations_applied JSONB DEFAULT '[]'
);

CREATE TABLE cognitive_load_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES cognitive_load_sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    load_value INTEGER NOT NULL CHECK (load_value >= 0 AND load_value <= 100),
    factors JSONB DEFAULT '{}',
    content_id VARCHAR(255),
    interaction_type VARCHAR(50)
);

CREATE TABLE complexity_gradients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES cognitive_load_sessions(id) ON DELETE CASCADE,
    content_id VARCHAR(255) NOT NULL,
    position JSONB NOT NULL,
    complexity_score INTEGER NOT NULL CHECK (complexity_score >= 0 AND complexity_score <= 100),
    suggested_action VARCHAR(50),
    visual_style JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- COUNCIL OF EXPERTS TABLES
-- =============================================================================

CREATE TABLE council_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    topic VARCHAR(500) NOT NULL,
    question TEXT NOT NULL,
    status council_status NOT NULL DEFAULT 'convening',
    consensus_level INTEGER DEFAULT 0 CHECK (consensus_level >= 0 AND consensus_level <= 100),
    consensus_state JSONB DEFAULT '{}',
    conclusion JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE TABLE council_experts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
    persona VARCHAR(255) NOT NULL,
    specialization VARCHAR(500) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    avatar JSONB DEFAULT '{"color": "#3b82f6", "icon": "user"}',
    breathing_aura JSONB DEFAULT '{"color": "#3b82f6", "rate": 6, "radius": 30}',
    current_position JSONB DEFAULT '{}',
    credibility_score INTEGER DEFAULT 80 CHECK (credibility_score >= 0 AND credibility_score <= 100),
    agreement_with JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expert_arguments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id UUID NOT NULL REFERENCES council_experts(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    argument_type expert_argument_type NOT NULL DEFAULT 'assertion',
    living_ink JSONB DEFAULT '{"fontWeight": 400, "conviction": 50}',
    targeted_at UUID REFERENCES council_experts(id),
    round_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE minority_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
    expert_id UUID NOT NULL REFERENCES council_experts(id) ON DELETE CASCADE,
    position TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    validity_score INTEGER DEFAULT 50 CHECK (validity_score >= 0 AND validity_score <= 100),
    visual_panel JSONB DEFAULT '{"opacity": 0.7, "ghostStyle": true}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TEMPORAL DRIFT TABLES
-- =============================================================================

CREATE TABLE drifting_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    original_content TEXT NOT NULL,
    original_learned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_confidence INTEGER DEFAULT 80 CHECK (current_confidence >= 0 AND current_confidence <= 100),
    stability_score INTEGER DEFAULT 100 CHECK (stability_score >= 0 AND stability_score <= 100),
    drift_history JSONB DEFAULT '[]',
    living_ink JSONB DEFAULT '{}',
    category VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE drift_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fact_id UUID NOT NULL REFERENCES drifting_facts(id) ON DELETE CASCADE,
    alert_type drift_alert_type NOT NULL,
    severity drift_severity NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    visual_indicator JSONB DEFAULT '{"color": "#f59e0b", "pulseRate": 8, "icon": "alert"}'
);

CREATE TABLE version_ghosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fact_id UUID NOT NULL REFERENCES drifting_facts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    confidence INTEGER DEFAULT 80,
    visual_overlay JSONB DEFAULT '{"opacity": 0.5, "layerOffset": 10, "ghostColor": "#8b5cf6"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE citation_half_lives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category VARCHAR(255) NOT NULL,
    estimated_half_life INTEGER NOT NULL, -- days
    confidence_in_estimate INTEGER DEFAULT 50,
    based_on_samples INTEGER DEFAULT 0,
    decay_curve JSONB DEFAULT '[]',
    visual_indicator JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, category)
);

-- =============================================================================
-- DEBATE ARENA TABLES
-- =============================================================================

CREATE TABLE debate_arenas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    topic VARCHAR(500) NOT NULL,
    proposition TEXT NOT NULL,
    status debate_status NOT NULL DEFAULT 'setup',
    resolution_balance INTEGER DEFAULT 0 CHECK (resolution_balance >= -100 AND resolution_balance <= 100),
    resolution_tracker JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE TABLE debaters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID NOT NULL REFERENCES debate_arenas(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    side VARCHAR(50) NOT NULL CHECK (side IN ('proposition', 'opposition')),
    model_id VARCHAR(255) NOT NULL,
    style debater_style NOT NULL DEFAULT 'balanced',
    position_heatmap JSONB DEFAULT '{}',
    current_strength INTEGER DEFAULT 50 CHECK (current_strength >= 0 AND current_strength <= 100),
    avatar JSONB DEFAULT '{"color": "#3b82f6", "icon": "user"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE debate_arguments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID NOT NULL REFERENCES debate_arenas(id) ON DELETE CASCADE,
    debater_id UUID NOT NULL REFERENCES debaters(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    argument_type debate_argument_type NOT NULL DEFAULT 'claim',
    strength INTEGER DEFAULT 50 CHECK (strength >= 0 AND strength <= 100),
    target_argument_id UUID REFERENCES debate_arguments(id),
    supporting_argument_ids UUID[] DEFAULT '{}',
    living_ink JSONB DEFAULT '{}',
    position JSONB DEFAULT '{"x": 0, "y": 0}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attack_defense_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID NOT NULL REFERENCES debate_arenas(id) ON DELETE CASCADE,
    attacker_id UUID NOT NULL REFERENCES debaters(id) ON DELETE CASCADE,
    defender_id UUID NOT NULL REFERENCES debaters(id) ON DELETE CASCADE,
    attack_argument_id UUID NOT NULL REFERENCES debate_arguments(id) ON DELETE CASCADE,
    defense_argument_id UUID REFERENCES debate_arguments(id) ON DELETE SET NULL,
    flow_visualization JSONB DEFAULT '{}',
    effectiveness INTEGER DEFAULT 50 CHECK (effectiveness >= 0 AND effectiveness <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE weak_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID NOT NULL REFERENCES debate_arenas(id) ON DELETE CASCADE,
    argument_id UUID NOT NULL REFERENCES debate_arguments(id) ON DELETE CASCADE,
    debater_id UUID NOT NULL REFERENCES debaters(id) ON DELETE CASCADE,
    vulnerability TEXT NOT NULL,
    exploited_by UUID REFERENCES debaters(id),
    breathing_indicator JSONB DEFAULT '{"color": "#ef4444", "rate": 12, "intensity": 0.7}',
    position JSONB DEFAULT '{"x": 0, "y": 0}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE steel_man_overlays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID NOT NULL REFERENCES debate_arenas(id) ON DELETE CASCADE,
    argument_id UUID NOT NULL REFERENCES debate_arguments(id) ON DELETE CASCADE,
    stronger_version TEXT NOT NULL,
    improvements JSONB DEFAULT '[]',
    visual_overlay JSONB DEFAULT '{}',
    shown BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CONFIGURATION TABLE
-- =============================================================================

CREATE TABLE living_parchment_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Feature toggles
    war_room_enabled BOOLEAN DEFAULT TRUE,
    memory_palace_enabled BOOLEAN DEFAULT TRUE,
    oracle_view_enabled BOOLEAN DEFAULT TRUE,
    synthesis_engine_enabled BOOLEAN DEFAULT TRUE,
    cognitive_load_enabled BOOLEAN DEFAULT TRUE,
    council_of_experts_enabled BOOLEAN DEFAULT TRUE,
    temporal_drift_enabled BOOLEAN DEFAULT TRUE,
    debate_arena_enabled BOOLEAN DEFAULT TRUE,
    
    -- Defaults
    breathing_rate_base INTEGER DEFAULT 6,
    confidence_threshold INTEGER DEFAULT 70,
    staleness_threshold_days INTEGER DEFAULT 30,
    max_advisors INTEGER DEFAULT 10,
    max_experts INTEGER DEFAULT 8,
    max_debate_rounds INTEGER DEFAULT 5,
    
    -- Visual settings
    heatmap_color_scheme VARCHAR(50) DEFAULT 'standard',
    custom_colors JSONB DEFAULT '{}',
    animation_intensity VARCHAR(50) DEFAULT 'normal',
    ghost_opacity NUMERIC(3,2) DEFAULT 0.5,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- War Room
CREATE INDEX idx_war_room_sessions_tenant ON war_room_sessions(tenant_id);
CREATE INDEX idx_war_room_sessions_status ON war_room_sessions(status);
CREATE INDEX idx_war_room_participants_session ON war_room_participants(session_id);
CREATE INDEX idx_war_room_advisors_session ON war_room_advisors(session_id);

-- Memory Palace
CREATE INDEX idx_memory_palaces_tenant ON memory_palaces(tenant_id);
CREATE INDEX idx_memory_rooms_palace ON memory_rooms(palace_id);
CREATE INDEX idx_knowledge_nodes_room ON knowledge_nodes(room_id);
CREATE INDEX idx_knowledge_nodes_tenant ON knowledge_nodes(tenant_id);
CREATE INDEX idx_memory_connections_source ON memory_connections(source_node_id);
CREATE INDEX idx_discovery_hotspots_palace ON discovery_hotspots(palace_id);

-- Oracle View
CREATE INDEX idx_oracle_views_tenant ON oracle_views(tenant_id);
CREATE INDEX idx_oracle_predictions_view ON oracle_predictions(oracle_view_id);
CREATE INDEX idx_bifurcation_points_view ON bifurcation_points(oracle_view_id);
CREATE INDEX idx_ghost_futures_view ON ghost_futures(oracle_view_id);
CREATE INDEX idx_black_swan_indicators_view ON black_swan_indicators(oracle_view_id);

-- Synthesis Engine
CREATE INDEX idx_synthesis_sessions_tenant ON synthesis_sessions(tenant_id);
CREATE INDEX idx_synthesis_sources_session ON synthesis_sources(session_id);
CREATE INDEX idx_synthesis_claims_session ON synthesis_claims(session_id);
CREATE INDEX idx_agreement_zones_session ON agreement_zones(session_id);
CREATE INDEX idx_tension_zones_session ON tension_zones(session_id);

-- Cognitive Load
CREATE INDEX idx_cognitive_load_sessions_tenant ON cognitive_load_sessions(tenant_id);
CREATE INDEX idx_cognitive_load_sessions_user ON cognitive_load_sessions(user_id);
CREATE INDEX idx_cognitive_load_history_session ON cognitive_load_history(session_id);

-- Council of Experts
CREATE INDEX idx_council_sessions_tenant ON council_sessions(tenant_id);
CREATE INDEX idx_council_experts_session ON council_experts(session_id);
CREATE INDEX idx_expert_arguments_expert ON expert_arguments(expert_id);
CREATE INDEX idx_expert_arguments_session ON expert_arguments(session_id);
CREATE INDEX idx_minority_reports_session ON minority_reports(session_id);

-- Temporal Drift
CREATE INDEX idx_drifting_facts_tenant ON drifting_facts(tenant_id);
CREATE INDEX idx_drift_alerts_fact ON drift_alerts(fact_id);
CREATE INDEX idx_drift_alerts_unacknowledged ON drift_alerts(acknowledged) WHERE acknowledged = FALSE;
CREATE INDEX idx_version_ghosts_fact ON version_ghosts(fact_id);

-- Debate Arena
CREATE INDEX idx_debate_arenas_tenant ON debate_arenas(tenant_id);
CREATE INDEX idx_debaters_arena ON debaters(arena_id);
CREATE INDEX idx_debate_arguments_arena ON debate_arguments(arena_id);
CREATE INDEX idx_debate_arguments_debater ON debate_arguments(debater_id);
CREATE INDEX idx_attack_defense_flows_arena ON attack_defense_flows(arena_id);
CREATE INDEX idx_weak_points_arena ON weak_points(arena_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE war_room_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_room_advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_palaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bifurcation_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_futures ENABLE ROW LEVEL SECURITY;
ALTER TABLE black_swan_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tension_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_load_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_load_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE complexity_gradients ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_experts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_arguments ENABLE ROW LEVEL SECURITY;
ALTER TABLE minority_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE drifting_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_ghosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_half_lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE debaters ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_arguments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_defense_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE weak_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE steel_man_overlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE living_parchment_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using app.current_tenant_id)
CREATE POLICY war_room_sessions_tenant_isolation ON war_room_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY war_room_participants_tenant_isolation ON war_room_participants
    USING (session_id IN (SELECT id FROM war_room_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY war_room_advisors_tenant_isolation ON war_room_advisors
    USING (session_id IN (SELECT id FROM war_room_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY memory_palaces_tenant_isolation ON memory_palaces
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY memory_rooms_tenant_isolation ON memory_rooms
    USING (palace_id IN (SELECT id FROM memory_palaces WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY knowledge_nodes_tenant_isolation ON knowledge_nodes
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY memory_connections_tenant_isolation ON memory_connections
    USING (source_node_id IN (SELECT id FROM knowledge_nodes WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY discovery_hotspots_tenant_isolation ON discovery_hotspots
    USING (palace_id IN (SELECT id FROM memory_palaces WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY oracle_views_tenant_isolation ON oracle_views
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY oracle_predictions_tenant_isolation ON oracle_predictions
    USING (oracle_view_id IN (SELECT id FROM oracle_views WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY bifurcation_points_tenant_isolation ON bifurcation_points
    USING (oracle_view_id IN (SELECT id FROM oracle_views WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY ghost_futures_tenant_isolation ON ghost_futures
    USING (oracle_view_id IN (SELECT id FROM oracle_views WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY black_swan_indicators_tenant_isolation ON black_swan_indicators
    USING (oracle_view_id IN (SELECT id FROM oracle_views WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY synthesis_sessions_tenant_isolation ON synthesis_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY synthesis_sources_tenant_isolation ON synthesis_sources
    USING (session_id IN (SELECT id FROM synthesis_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY synthesis_claims_tenant_isolation ON synthesis_claims
    USING (session_id IN (SELECT id FROM synthesis_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY agreement_zones_tenant_isolation ON agreement_zones
    USING (session_id IN (SELECT id FROM synthesis_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY tension_zones_tenant_isolation ON tension_zones
    USING (session_id IN (SELECT id FROM synthesis_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY cognitive_load_sessions_tenant_isolation ON cognitive_load_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cognitive_load_history_tenant_isolation ON cognitive_load_history
    USING (session_id IN (SELECT id FROM cognitive_load_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY complexity_gradients_tenant_isolation ON complexity_gradients
    USING (session_id IN (SELECT id FROM cognitive_load_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY council_sessions_tenant_isolation ON council_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY council_experts_tenant_isolation ON council_experts
    USING (session_id IN (SELECT id FROM council_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY expert_arguments_tenant_isolation ON expert_arguments
    USING (session_id IN (SELECT id FROM council_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY minority_reports_tenant_isolation ON minority_reports
    USING (session_id IN (SELECT id FROM council_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY drifting_facts_tenant_isolation ON drifting_facts
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY drift_alerts_tenant_isolation ON drift_alerts
    USING (fact_id IN (SELECT id FROM drifting_facts WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY version_ghosts_tenant_isolation ON version_ghosts
    USING (fact_id IN (SELECT id FROM drifting_facts WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY citation_half_lives_tenant_isolation ON citation_half_lives
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY debate_arenas_tenant_isolation ON debate_arenas
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY debaters_tenant_isolation ON debaters
    USING (arena_id IN (SELECT id FROM debate_arenas WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY debate_arguments_tenant_isolation ON debate_arguments
    USING (arena_id IN (SELECT id FROM debate_arenas WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY attack_defense_flows_tenant_isolation ON attack_defense_flows
    USING (arena_id IN (SELECT id FROM debate_arenas WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY weak_points_tenant_isolation ON weak_points
    USING (arena_id IN (SELECT id FROM debate_arenas WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY steel_man_overlays_tenant_isolation ON steel_man_overlays
    USING (arena_id IN (SELECT id FROM debate_arenas WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY living_parchment_config_tenant_isolation ON living_parchment_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- TRIGGERS FOR updated_at
-- =============================================================================

CREATE TRIGGER update_war_room_sessions_updated_at BEFORE UPDATE ON war_room_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memory_palaces_updated_at BEFORE UPDATE ON memory_palaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_nodes_updated_at BEFORE UPDATE ON knowledge_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_views_updated_at BEFORE UPDATE ON oracle_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_synthesis_sessions_updated_at BEFORE UPDATE ON synthesis_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_council_sessions_updated_at BEFORE UPDATE ON council_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drifting_facts_updated_at BEFORE UPDATE ON drifting_facts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_citation_half_lives_updated_at BEFORE UPDATE ON citation_half_lives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debate_arenas_updated_at BEFORE UPDATE ON debate_arenas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_living_parchment_config_updated_at BEFORE UPDATE ON living_parchment_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE war_room_sessions IS 'Strategic decision theater sessions with advisors and confidence terrain';
COMMENT ON TABLE memory_palaces IS 'Navigable 3D knowledge topology with freshness fog';
COMMENT ON TABLE oracle_views IS 'Predictive confidence landscapes with bifurcation points and ghost futures';
COMMENT ON TABLE synthesis_sessions IS 'Multi-source fusion views with agreement and tension zones';
COMMENT ON TABLE cognitive_load_sessions IS 'User cognitive state tracking with attention heatmaps';
COMMENT ON TABLE council_sessions IS 'Multi-persona expert consultations with consensus tracking';
COMMENT ON TABLE drifting_facts IS 'Temporal drift monitoring for fact evolution';
COMMENT ON TABLE debate_arenas IS 'Adversarial exploration with attack/defense flows and steel-man overlays';
COMMENT ON TABLE living_parchment_config IS 'Per-tenant configuration for all Living Parchment features';
