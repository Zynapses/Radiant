-- ============================================================================
-- RADIANT v4.18.0 - Enhanced Collaboration Features Migration
-- Novel collaboration: Cross-tenant guests, AI Facilitator, Branch/Merge,
-- Time-Shifted Playback, AI Roundtable, Shared Knowledge Graph
-- ============================================================================

-- ============================================================================
-- 1. CROSS-TENANT GUEST ACCESS
-- Allow paid users to invite anyone, even outside their tenant
-- ============================================================================

-- Guest invitations that can cross tenant boundaries
CREATE TABLE collaboration_guest_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- Invite details
    invite_token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    invite_type VARCHAR(20) NOT NULL DEFAULT 'link' CHECK (invite_type IN ('email', 'link', 'qr')),
    
    -- Guest info (for email invites)
    guest_email VARCHAR(255),
    guest_name VARCHAR(255),
    
    -- Access control
    permission VARCHAR(20) NOT NULL DEFAULT 'commenter' CHECK (permission IN ('viewer', 'commenter', 'editor')),
    expires_at TIMESTAMPTZ,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    
    -- Tracking
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    
    -- Referral tracking for viral growth
    referral_code VARCHAR(32) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    signups_from_invite INTEGER DEFAULT 0
);

-- Cross-tenant guest sessions (guests from outside the tenant)
CREATE TABLE collaboration_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_id UUID NOT NULL REFERENCES collaboration_guest_invites(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- Guest identity
    guest_token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    avatar_url TEXT,
    
    -- Optional user link (if they sign up)
    linked_user_id UUID REFERENCES users(id),
    linked_tenant_id UUID REFERENCES tenants(id),
    
    -- Permissions
    permission VARCHAR(20) NOT NULL DEFAULT 'commenter',
    
    -- Presence
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    color VARCHAR(7),
    
    -- Session state
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. AI FACILITATOR MODE
-- AI actively moderates and guides the conversation
-- ============================================================================

CREATE TABLE collaboration_facilitators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- Facilitator settings
    is_enabled BOOLEAN DEFAULT true,
    facilitator_model VARCHAR(100) DEFAULT 'claude-3-5-sonnet',
    facilitator_persona VARCHAR(50) DEFAULT 'professional' CHECK (facilitator_persona IN (
        'professional', 'casual', 'academic', 'creative', 'socratic', 'coach'
    )),
    
    -- Facilitation behaviors
    auto_summarize BOOLEAN DEFAULT true,
    auto_action_items BOOLEAN DEFAULT true,
    ensure_participation BOOLEAN DEFAULT true,
    keep_on_topic BOOLEAN DEFAULT true,
    time_box_enabled BOOLEAN DEFAULT false,
    time_box_minutes INTEGER,
    
    -- Intervention thresholds
    silence_threshold_seconds INTEGER DEFAULT 120,
    tangent_detection_enabled BOOLEAN DEFAULT true,
    conflict_mediation_enabled BOOLEAN DEFAULT true,
    
    -- Session goals
    session_objective TEXT,
    session_agenda JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_session_facilitator UNIQUE (session_id)
);

-- Facilitator interventions log
CREATE TABLE facilitator_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    facilitator_id UUID NOT NULL REFERENCES collaboration_facilitators(id) ON DELETE CASCADE,
    
    -- Intervention details
    intervention_type VARCHAR(50) NOT NULL CHECK (intervention_type IN (
        'welcome', 'summarize', 'prompt_participation', 'redirect_topic',
        'mediate_conflict', 'suggest_break', 'time_check', 'action_items',
        'synthesize_viewpoints', 'ask_clarification', 'encourage', 'wrap_up'
    )),
    
    -- Content
    message_content TEXT NOT NULL,
    target_participants UUID[] DEFAULT '{}',
    
    -- Trigger info
    trigger_reason TEXT,
    trigger_data JSONB DEFAULT '{}',
    
    -- Response tracking
    was_helpful BOOLEAN,
    participant_reactions JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. BRANCH & MERGE CONVERSATIONS
-- Git-style exploration of ideas
-- ============================================================================

CREATE TABLE conversation_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- Branch metadata
    branch_name VARCHAR(100) NOT NULL,
    branch_description TEXT,
    branch_color VARCHAR(7) DEFAULT '#6366f1',
    
    -- Parent branch (null for main)
    parent_branch_id UUID REFERENCES conversation_branches(id) ON DELETE SET NULL,
    fork_point_message_id UUID REFERENCES session_messages(id) ON DELETE SET NULL,
    
    -- Branch owner
    created_by UUID NOT NULL REFERENCES session_participants(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'merged', 'abandoned', 'archived')),
    merged_into_id UUID REFERENCES conversation_branches(id),
    merged_at TIMESTAMPTZ,
    merged_by UUID REFERENCES session_participants(id),
    
    -- Exploration tracking
    exploration_hypothesis TEXT,
    exploration_conclusion TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages belong to branches
ALTER TABLE session_messages ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES conversation_branches(id);

-- Merge requests (like PRs but for ideas)
CREATE TABLE branch_merge_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    source_branch_id UUID NOT NULL REFERENCES conversation_branches(id) ON DELETE CASCADE,
    target_branch_id UUID NOT NULL REFERENCES conversation_branches(id) ON DELETE CASCADE,
    
    -- Merge request details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    key_insights JSONB DEFAULT '[]',
    
    -- Review
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
    reviewers UUID[] DEFAULT '{}',
    approvals UUID[] DEFAULT '{}',
    
    -- AI-generated merge summary
    ai_merge_summary TEXT,
    ai_conflict_analysis TEXT,
    
    created_by UUID NOT NULL REFERENCES session_participants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. TIME-SHIFTED PLAYBACK
-- Async participation with catch-up mode
-- ============================================================================

CREATE TABLE session_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- Recording metadata
    recording_type VARCHAR(20) NOT NULL CHECK (recording_type IN ('full', 'highlights', 'summary')),
    title VARCHAR(255),
    
    -- Time range
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Content
    events JSONB NOT NULL DEFAULT '[]', -- Array of timestamped events
    ai_summary TEXT,
    ai_key_moments JSONB DEFAULT '[]',
    
    -- Playback settings
    playback_speed_options JSONB DEFAULT '[0.5, 1, 1.5, 2]',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice/video notes attached to messages
CREATE TABLE session_media_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    message_id UUID REFERENCES session_messages(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES session_participants(id) ON DELETE CASCADE,
    
    -- Media details
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('voice', 'video', 'screen')),
    
    -- S3 storage
    s3_bucket VARCHAR(255) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    s3_region VARCHAR(50) DEFAULT 'us-east-1',
    file_size_bytes BIGINT,
    duration_seconds INTEGER,
    
    -- Transcription
    transcription TEXT,
    transcription_status VARCHAR(20) DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Metadata
    thumbnail_s3_key VARCHAR(512),
    waveform_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Async reactions and annotations
CREATE TABLE async_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- What's being annotated
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('message', 'branch', 'recording', 'summary')),
    target_id UUID NOT NULL,
    
    -- Annotation content
    annotation_type VARCHAR(20) NOT NULL CHECK (annotation_type IN (
        'agree', 'disagree', 'question', 'insight', 'action_item', 'bookmark'
    )),
    content TEXT,
    
    -- Author (can be guest)
    participant_id UUID REFERENCES session_participants(id),
    guest_id UUID REFERENCES collaboration_guests(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT require_author CHECK (participant_id IS NOT NULL OR guest_id IS NOT NULL)
);

-- ============================================================================
-- 5. AI ROUNDTABLE (Multi-Model Debate)
-- Multiple AI models discuss together
-- ============================================================================

CREATE TABLE ai_roundtables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- Roundtable configuration
    topic VARCHAR(500) NOT NULL,
    context TEXT,
    
    -- Participating models
    models JSONB NOT NULL DEFAULT '[]', -- Array of model configs with personas
    moderator_model VARCHAR(100),
    
    -- Debate settings
    debate_style VARCHAR(30) DEFAULT 'collaborative' CHECK (debate_style IN (
        'collaborative', 'adversarial', 'socratic', 'brainstorm', 'devils_advocate'
    )),
    max_rounds INTEGER DEFAULT 5,
    current_round INTEGER DEFAULT 0,
    
    -- State
    status VARCHAR(20) DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'paused', 'completed')),
    
    -- Results
    synthesis TEXT,
    consensus_points JSONB DEFAULT '[]',
    disagreement_points JSONB DEFAULT '[]',
    action_recommendations JSONB DEFAULT '[]',
    
    created_by UUID NOT NULL REFERENCES session_participants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI model contributions to roundtable
CREATE TABLE roundtable_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roundtable_id UUID NOT NULL REFERENCES ai_roundtables(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- Model info
    model_id VARCHAR(100) NOT NULL,
    model_persona VARCHAR(100),
    model_role VARCHAR(50), -- e.g., "optimist", "skeptic", "pragmatist"
    
    -- Contribution
    round_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    
    -- Response to
    responding_to_id UUID REFERENCES roundtable_contributions(id),
    
    -- Metadata
    tokens_used INTEGER,
    latency_ms INTEGER,
    
    -- Human reactions
    human_reactions JSONB DEFAULT '{}',
    human_votes INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. SHARED KNOWLEDGE GRAPH
-- Collective understanding visualization
-- ============================================================================

CREATE TABLE session_knowledge_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- Graph metadata
    title VARCHAR(255) DEFAULT 'Session Knowledge',
    description TEXT,
    
    -- Graph state (stored as JSON for flexibility)
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    
    -- Layout
    layout_type VARCHAR(20) DEFAULT 'force' CHECK (layout_type IN ('force', 'hierarchical', 'radial', 'timeline')),
    layout_config JSONB DEFAULT '{}',
    
    -- AI-generated insights
    ai_gaps JSONB DEFAULT '[]', -- Knowledge gaps identified
    ai_suggestions JSONB DEFAULT '[]', -- Topics to explore
    ai_summary TEXT,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    last_updated_by UUID REFERENCES session_participants(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_session_graph UNIQUE (session_id)
);

-- Knowledge graph nodes
CREATE TABLE knowledge_graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    graph_id UUID NOT NULL REFERENCES session_knowledge_graphs(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    
    -- Node content
    node_type VARCHAR(30) NOT NULL CHECK (node_type IN (
        'concept', 'fact', 'question', 'decision', 'action_item', 'person', 'resource'
    )),
    label VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Visual
    color VARCHAR(7),
    icon VARCHAR(50),
    size INTEGER DEFAULT 1,
    
    -- Position (for manual layout)
    x FLOAT,
    y FLOAT,
    
    -- Source
    source_message_id UUID REFERENCES session_messages(id),
    source_branch_id UUID REFERENCES conversation_branches(id),
    
    -- Metadata
    confidence FLOAT DEFAULT 1.0,
    importance INTEGER DEFAULT 1,
    
    created_by UUID REFERENCES session_participants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge graph edges
CREATE TABLE knowledge_graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    graph_id UUID NOT NULL REFERENCES session_knowledge_graphs(id) ON DELETE CASCADE,
    
    -- Connection
    source_node_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
    
    -- Edge properties
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN (
        'relates_to', 'causes', 'depends_on', 'contradicts', 'supports',
        'part_of', 'leads_to', 'answers', 'blocks', 'enables'
    )),
    label VARCHAR(100),
    weight FLOAT DEFAULT 1.0,
    
    -- Visual
    color VARCHAR(7),
    style VARCHAR(20) DEFAULT 'solid' CHECK (style IN ('solid', 'dashed', 'dotted')),
    
    created_by UUID REFERENCES session_participants(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. COLLABORATION ATTACHMENTS WITH S3 CLEANUP
-- Large files stored in S3 with automatic cleanup
-- ============================================================================

CREATE TABLE collaboration_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    message_id UUID REFERENCES session_messages(id) ON DELETE SET NULL,
    
    -- Uploader
    participant_id UUID REFERENCES session_participants(id),
    guest_id UUID REFERENCES collaboration_guests(id),
    
    -- File details
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    
    -- S3 storage
    s3_bucket VARCHAR(255) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    s3_region VARCHAR(50) DEFAULT 'us-east-1',
    
    -- Thumbnail for images/videos
    thumbnail_s3_key VARCHAR(512),
    
    -- Processing status
    processing_status VARCHAR(20) DEFAULT 'uploaded' CHECK (processing_status IN (
        'uploading', 'uploaded', 'processing', 'ready', 'failed'
    )),
    processing_metadata JSONB DEFAULT '{}',
    
    -- Access tracking
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT require_uploader CHECK (participant_id IS NOT NULL OR guest_id IS NOT NULL)
);

-- S3 cleanup trigger - when attachment is deleted, queue S3 cleanup
CREATE TABLE s3_cleanup_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    s3_bucket VARCHAR(255) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    s3_region VARCHAR(50) DEFAULT 'us-east-1',
    
    -- Source tracking
    source_table VARCHAR(100) NOT NULL,
    source_id UUID NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Trigger function to queue S3 cleanup
CREATE OR REPLACE FUNCTION queue_s3_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue the S3 object for deletion
    IF OLD.s3_key IS NOT NULL THEN
        INSERT INTO s3_cleanup_queue (s3_bucket, s3_key, s3_region, source_table, source_id)
        VALUES (OLD.s3_bucket, OLD.s3_key, OLD.s3_region, TG_TABLE_NAME, OLD.id);
        
        -- Also queue thumbnail if exists
        IF OLD.thumbnail_s3_key IS NOT NULL THEN
            INSERT INTO s3_cleanup_queue (s3_bucket, s3_key, s3_region, source_table, source_id)
            VALUES (OLD.s3_bucket, OLD.thumbnail_s3_key, OLD.s3_region, TG_TABLE_NAME, OLD.id);
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach cleanup triggers
CREATE TRIGGER cleanup_collaboration_attachments
    AFTER DELETE ON collaboration_attachments
    FOR EACH ROW EXECUTE FUNCTION queue_s3_cleanup();

CREATE TRIGGER cleanup_session_media_notes
    AFTER DELETE ON session_media_notes
    FOR EACH ROW EXECUTE FUNCTION queue_s3_cleanup();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Guest invites
CREATE INDEX idx_guest_invites_session ON collaboration_guest_invites(session_id);
CREATE INDEX idx_guest_invites_token ON collaboration_guest_invites(invite_token);
CREATE INDEX idx_guest_invites_email ON collaboration_guest_invites(guest_email) WHERE guest_email IS NOT NULL;
CREATE INDEX idx_guest_invites_referral ON collaboration_guest_invites(referral_code);

-- Guests
CREATE INDEX idx_collab_guests_session ON collaboration_guests(session_id);
CREATE INDEX idx_collab_guests_token ON collaboration_guests(guest_token);
CREATE INDEX idx_collab_guests_online ON collaboration_guests(session_id, is_online) WHERE is_online = true;

-- Facilitators
CREATE INDEX idx_facilitators_session ON collaboration_facilitators(session_id);
CREATE INDEX idx_facilitator_interventions_session ON facilitator_interventions(session_id, created_at DESC);

-- Branches
CREATE INDEX idx_branches_session ON conversation_branches(session_id);
CREATE INDEX idx_branches_parent ON conversation_branches(parent_branch_id);
CREATE INDEX idx_branches_active ON conversation_branches(session_id, status) WHERE status = 'active';
CREATE INDEX idx_messages_branch ON session_messages(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_merge_requests_session ON branch_merge_requests(session_id);

-- Recordings
CREATE INDEX idx_recordings_session ON session_recordings(session_id, created_at DESC);
CREATE INDEX idx_media_notes_session ON session_media_notes(session_id);
CREATE INDEX idx_media_notes_message ON session_media_notes(message_id);
CREATE INDEX idx_async_annotations_target ON async_annotations(target_type, target_id);

-- Roundtables
CREATE INDEX idx_roundtables_session ON ai_roundtables(session_id);
CREATE INDEX idx_roundtable_contributions ON roundtable_contributions(roundtable_id, round_number);

-- Knowledge graphs
CREATE INDEX idx_kg_nodes_graph ON knowledge_graph_nodes(graph_id);
CREATE INDEX idx_kg_nodes_type ON knowledge_graph_nodes(graph_id, node_type);
CREATE INDEX idx_kg_edges_graph ON knowledge_graph_edges(graph_id);
CREATE INDEX idx_kg_edges_source ON knowledge_graph_edges(source_node_id);
CREATE INDEX idx_kg_edges_target ON knowledge_graph_edges(target_node_id);

-- Attachments
CREATE INDEX idx_attachments_session ON collaboration_attachments(session_id);
CREATE INDEX idx_attachments_message ON collaboration_attachments(message_id);

-- S3 cleanup
CREATE INDEX idx_s3_cleanup_pending ON s3_cleanup_queue(status, created_at) WHERE status = 'pending';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE collaboration_guest_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_facilitators ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilitator_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_merge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_media_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_roundtables ENABLE ROW LEVEL SECURITY;
ALTER TABLE roundtable_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_knowledge_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_attachments ENABLE ROW LEVEL SECURITY;

-- Session-based isolation (all tables relate back to session which has tenant_id)
CREATE OR REPLACE FUNCTION check_session_tenant(p_session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM collaborative_sessions 
        WHERE id = p_session_id 
        AND tenant_id = current_setting('app.current_tenant_id')::UUID
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Apply policies
CREATE POLICY guest_invites_isolation ON collaboration_guest_invites
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY guests_isolation ON collaboration_guests
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY facilitators_isolation ON collaboration_facilitators
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY interventions_isolation ON facilitator_interventions
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY branches_isolation ON conversation_branches
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY merge_requests_isolation ON branch_merge_requests
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY recordings_isolation ON session_recordings
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY media_notes_isolation ON session_media_notes
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY annotations_isolation ON async_annotations
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY roundtables_isolation ON ai_roundtables
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY contributions_isolation ON roundtable_contributions
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY kg_isolation ON session_knowledge_graphs
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY kg_nodes_isolation ON knowledge_graph_nodes
    FOR ALL USING (check_session_tenant(session_id));

CREATE POLICY kg_edges_isolation ON knowledge_graph_edges
    FOR ALL USING (
        graph_id IN (SELECT id FROM session_knowledge_graphs WHERE check_session_tenant(session_id))
    );

CREATE POLICY attachments_isolation ON collaboration_attachments
    FOR ALL USING (check_session_tenant(session_id));
