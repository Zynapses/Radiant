-- Migration: 163_magic_carpet.sql
-- Description: Magic Carpet - The unified navigation and experience paradigm
-- Version: 5.16.0
-- Date: 2026-01-18
-- 
-- "We are building 'The Magic Carpet.' You don't drive it. You don't write code 
-- for it. You just say where you want to go, and the ground beneath you reshapes 
-- itself to take you there instantly."

-- ============================================================================
-- MAGIC CARPETS
-- The unified navigation and experience layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS magic_carpets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Current state
    destination JSONB,
    mode VARCHAR(20) NOT NULL DEFAULT 'resting',
    altitude VARCHAR(20) NOT NULL DEFAULT 'ground',
    
    -- Reality Engine integration
    reality_engine_session_id UUID REFERENCES reality_engine_sessions(id) ON DELETE SET NULL,
    
    -- Navigation history
    journey JSONB NOT NULL DEFAULT '[]',
    current_position INTEGER NOT NULL DEFAULT -1,
    
    -- Customization
    theme JSONB NOT NULL DEFAULT '{
        "name": "Mystic Night",
        "mode": "dark",
        "primary": "#8B5CF6",
        "secondary": "#6366F1",
        "accent": "#F59E0B",
        "background": "#0F172A",
        "surface": "#1E293B",
        "carpetGradient": ["#4F46E5", "#7C3AED", "#A855F7"],
        "glowColor": "#A78BFA",
        "trailEffect": true,
        "fontFamily": "Inter",
        "fontSize": "md",
        "blur": true,
        "shadows": true,
        "animations": true
    }',
    
    preferences JSONB NOT NULL DEFAULT '{
        "autoFly": true,
        "smoothTransitions": true,
        "showJourneyTrail": true,
        "preCognitionEnabled": true,
        "showPredictions": true,
        "telepathyIntensity": "moderate",
        "showTimeline": true,
        "autoSnapshot": true,
        "snapshotInterval": 30,
        "maxParallelRealities": 4,
        "autoCompare": true,
        "reducedMotion": false,
        "highContrast": false,
        "screenReaderMode": false
    }',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_magic_carpets_tenant ON magic_carpets(tenant_id);
CREATE INDEX idx_magic_carpets_user ON magic_carpets(user_id);
CREATE INDEX idx_magic_carpets_mode ON magic_carpets(mode);

-- ============================================================================
-- CARPET DESTINATIONS
-- Pre-defined and custom destinations
-- ============================================================================

CREATE TABLE IF NOT EXISTS carpet_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Destination identity
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(10) NOT NULL DEFAULT '✨',
    
    -- Layout configuration
    layout JSONB NOT NULL DEFAULT '{}',
    
    -- Morphing sequence
    morph_sequence JSONB,
    
    -- Metadata
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    use_count INTEGER NOT NULL DEFAULT 0,
    last_visited_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carpet_destinations_tenant ON carpet_destinations(tenant_id);
CREATE INDEX idx_carpet_destinations_user ON carpet_destinations(user_id);
CREATE INDEX idx_carpet_destinations_type ON carpet_destinations(type);
CREATE INDEX idx_carpet_destinations_favorite ON carpet_destinations(user_id, is_favorite) WHERE is_favorite = true;

-- ============================================================================
-- CARPET JOURNEY HISTORY
-- Navigation history for each carpet
-- ============================================================================

CREATE TABLE IF NOT EXISTS carpet_journey_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carpet_id UUID NOT NULL REFERENCES magic_carpets(id) ON DELETE CASCADE,
    
    -- Destination visited
    destination_id UUID REFERENCES carpet_destinations(id) ON DELETE SET NULL,
    destination_snapshot JSONB NOT NULL,
    
    -- Timing
    arrived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    departed_at TIMESTAMPTZ,
    
    -- Reality Engine link
    snapshot_id UUID REFERENCES reality_snapshots(id) ON DELETE SET NULL,
    
    -- Activity summary
    actions JSONB NOT NULL DEFAULT '[]',
    ai_interactions INTEGER NOT NULL DEFAULT 0,
    morph_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_carpet_journey_carpet ON carpet_journey_points(carpet_id);
CREATE INDEX idx_carpet_journey_arrived ON carpet_journey_points(carpet_id, arrived_at DESC);

-- ============================================================================
-- CARPET THEMES
-- Custom themes for personalization
-- ============================================================================

CREATE TABLE IF NOT EXISTS carpet_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Theme identity
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Theme configuration
    theme_config JSONB NOT NULL,
    
    -- Metadata
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carpet_themes_tenant ON carpet_themes(tenant_id);
CREATE INDEX idx_carpet_themes_user ON carpet_themes(user_id);

-- ============================================================================
-- CARPET ANALYTICS
-- Usage analytics for the Magic Carpet
-- ============================================================================

CREATE TABLE IF NOT EXISTS carpet_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carpet_id UUID NOT NULL REFERENCES magic_carpets(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Event data
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    
    -- Performance
    duration_ms INTEGER,
    was_precognized BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carpet_analytics_carpet ON carpet_analytics(carpet_id);
CREATE INDEX idx_carpet_analytics_tenant ON carpet_analytics(tenant_id);
CREATE INDEX idx_carpet_analytics_type ON carpet_analytics(event_type);
CREATE INDEX idx_carpet_analytics_time ON carpet_analytics(created_at DESC);

-- ============================================================================
-- DEFAULT DESTINATIONS
-- System-provided destinations
-- ============================================================================

INSERT INTO carpet_destinations (id, type, name, description, icon, layout, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', 'dashboard', 'Command Center', 'Overview of your workspace', '🏠', 
     '{"type": "docked", "regions": [{"id": "main", "position": "center", "content": {"type": "morphic", "componentId": "dashboard"}}]}', true),
    ('00000000-0000-0000-0000-000000000002', 'workspace', 'Workshop', 'Build and create', '🔨',
     '{"type": "docked", "regions": [{"id": "main", "position": "center", "content": {"type": "morphic", "componentId": "workspace"}}]}', true),
    ('00000000-0000-0000-0000-000000000003', 'timeline', 'Time Stream', 'Navigate through time', '⏳',
     '{"type": "docked", "regions": [{"id": "timeline", "position": "south", "content": {"type": "timeline", "view": "scrubber"}}, {"id": "preview", "position": "center", "content": {"type": "morphic", "componentId": "preview"}}]}', true),
    ('00000000-0000-0000-0000-000000000004', 'multiverse', 'Quantum Realm', 'Explore parallel realities', '🌌',
     '{"type": "split", "regions": [{"id": "branches", "position": "center", "content": {"type": "branches", "view": "split"}}]}', true),
    ('00000000-0000-0000-0000-000000000005', 'oracle', 'Oracle''s Chamber', 'See what comes next', '🔮',
     '{"type": "docked", "regions": [{"id": "predictions", "position": "center", "content": {"type": "predictions", "view": "cards"}}]}', true),
    ('00000000-0000-0000-0000-000000000006', 'gallery', 'Gallery', 'View your creations', '🖼️',
     '{"type": "docked", "regions": [{"id": "main", "position": "center", "content": {"type": "morphic", "componentId": "gallery"}}]}', true),
    ('00000000-0000-0000-0000-000000000007', 'vault', 'Vault', 'Saved and bookmarked items', '🔐',
     '{"type": "docked", "regions": [{"id": "main", "position": "center", "content": {"type": "morphic", "componentId": "vault"}}]}', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- DEFAULT THEMES
-- System-provided themes
-- ============================================================================

INSERT INTO carpet_themes (id, name, description, theme_config, is_system, is_default) VALUES
    ('00000000-0000-0000-0001-000000000001', 'Mystic Night', 'Deep purple mystical theme', 
     '{"mode": "dark", "primary": "#8B5CF6", "secondary": "#6366F1", "accent": "#F59E0B", "background": "#0F172A", "surface": "#1E293B", "carpetGradient": ["#4F46E5", "#7C3AED", "#A855F7"], "glowColor": "#A78BFA", "carpetPattern": "persian", "trailEffect": true}', 
     true, true),
    ('00000000-0000-0000-0001-000000000002', 'Desert Sun', 'Warm golden theme',
     '{"mode": "light", "primary": "#F59E0B", "secondary": "#D97706", "accent": "#7C3AED", "background": "#FFFBEB", "surface": "#FEF3C7", "carpetGradient": ["#F59E0B", "#D97706", "#B45309"], "glowColor": "#FCD34D", "carpetPattern": "geometric", "trailEffect": true}',
     true, false),
    ('00000000-0000-0000-0001-000000000003', 'Ocean Deep', 'Cool blue aquatic theme',
     '{"mode": "dark", "primary": "#0EA5E9", "secondary": "#06B6D4", "accent": "#F97316", "background": "#0C1222", "surface": "#1E3A5F", "carpetGradient": ["#0284C7", "#0891B2", "#0D9488"], "glowColor": "#38BDF8", "carpetPattern": "waves", "trailEffect": true}',
     true, false),
    ('00000000-0000-0000-0001-000000000004', 'Cosmic Void', 'Dark minimalist theme',
     '{"mode": "dark", "primary": "#A855F7", "secondary": "#8B5CF6", "accent": "#EC4899", "background": "#030712", "surface": "#111827", "carpetGradient": ["#1F2937", "#374151", "#4B5563"], "glowColor": "#C084FC", "carpetPattern": "stars", "trailEffect": false}',
     true, false),
    ('00000000-0000-0000-0001-000000000005', 'Neon Circuit', 'Cyberpunk electric theme',
     '{"mode": "dark", "primary": "#22D3EE", "secondary": "#A855F7", "accent": "#F43F5E", "background": "#0A0A0A", "surface": "#1A1A2E", "carpetGradient": ["#0891B2", "#7C3AED", "#DB2777"], "glowColor": "#22D3EE", "carpetPattern": "circuits", "trailEffect": true}',
     true, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE magic_carpets ENABLE ROW LEVEL SECURITY;
ALTER TABLE carpet_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE carpet_journey_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE carpet_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE carpet_analytics ENABLE ROW LEVEL SECURITY;

-- Policies for magic_carpets
CREATE POLICY magic_carpets_tenant_isolation ON magic_carpets
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Policies for carpet_destinations (allow system destinations + tenant-specific)
CREATE POLICY carpet_destinations_access ON carpet_destinations
    FOR ALL USING (
        is_system = true 
        OR tenant_id = current_setting('app.current_tenant_id')::UUID
    );

-- Policies for carpet_journey_points
CREATE POLICY carpet_journey_points_access ON carpet_journey_points
    FOR ALL USING (
        carpet_id IN (
            SELECT id FROM magic_carpets 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Policies for carpet_themes (allow system themes + tenant-specific)
CREATE POLICY carpet_themes_access ON carpet_themes
    FOR ALL USING (
        is_system = true 
        OR tenant_id = current_setting('app.current_tenant_id')::UUID
    );

-- Policies for carpet_analytics
CREATE POLICY carpet_analytics_tenant_isolation ON carpet_analytics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER magic_carpets_updated_at
    BEFORE UPDATE ON magic_carpets
    FOR EACH ROW EXECUTE FUNCTION update_reality_engine_updated_at();

CREATE TRIGGER carpet_destinations_updated_at
    BEFORE UPDATE ON carpet_destinations
    FOR EACH ROW EXECUTE FUNCTION update_reality_engine_updated_at();

CREATE TRIGGER carpet_themes_updated_at
    BEFORE UPDATE ON carpet_themes
    FOR EACH ROW EXECUTE FUNCTION update_reality_engine_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE magic_carpets IS 'Magic Carpet - The unified navigation and experience paradigm. "You just say where you want to go, and the ground reshapes itself."';
COMMENT ON TABLE carpet_destinations IS 'Available destinations for Magic Carpet navigation';
COMMENT ON TABLE carpet_journey_points IS 'Navigation history tracking for each Magic Carpet session';
COMMENT ON TABLE carpet_themes IS 'Visual themes for Magic Carpet personalization';
COMMENT ON TABLE carpet_analytics IS 'Usage analytics for Magic Carpet interactions';
