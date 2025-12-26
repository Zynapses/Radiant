-- ============================================================================
-- RADIANT v4.17.0 - Canvas & Artifacts Migration
-- ============================================================================

CREATE TABLE canvases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    chat_id UUID REFERENCES chats(id),
    canvas_name VARCHAR(200),
    canvas_type VARCHAR(50) NOT NULL DEFAULT 'general',
    content JSONB NOT NULL DEFAULT '{}',
    version INTEGER DEFAULT 1,
    is_published BOOLEAN DEFAULT false,
    published_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL,
    title VARCHAR(200),
    content TEXT NOT NULL,
    language VARCHAR(50),
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 400,
    height INTEGER DEFAULT 300,
    z_index INTEGER DEFAULT 0,
    is_collapsed BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artifact_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_canvases_user ON canvases(tenant_id, user_id);
CREATE INDEX idx_canvases_chat ON canvases(chat_id);
CREATE INDEX idx_artifacts_canvas ON artifacts(canvas_id);
CREATE INDEX idx_artifact_versions ON artifact_versions(artifact_id, version DESC);

ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY canvases_isolation ON canvases 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY artifacts_isolation ON artifacts 
    USING (canvas_id IN (SELECT id FROM canvases WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));
CREATE POLICY artifact_versions_isolation ON artifact_versions 
    USING (artifact_id IN (SELECT a.id FROM artifacts a JOIN canvases c ON a.canvas_id = c.id WHERE c.tenant_id = current_setting('app.current_tenant_id')::UUID));
