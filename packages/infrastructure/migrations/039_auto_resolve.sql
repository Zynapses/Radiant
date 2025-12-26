-- ============================================================================
-- RADIANT v4.17.0 - Auto-Resolve API Migration
-- ============================================================================

CREATE TABLE auto_resolve_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    request_type VARCHAR(50) NOT NULL,
    selected_model VARCHAR(100) NOT NULL,
    selection_reason TEXT,
    user_preferences JSONB DEFAULT '{}',
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost DECIMAL(10, 6),
    latency_ms INTEGER,
    success BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auto_resolve_user ON auto_resolve_requests(tenant_id, user_id);
CREATE INDEX idx_auto_resolve_model ON auto_resolve_requests(selected_model);
CREATE INDEX idx_auto_resolve_created ON auto_resolve_requests(created_at DESC);
CREATE INDEX idx_auto_resolve_type ON auto_resolve_requests(request_type);

ALTER TABLE auto_resolve_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_resolve_isolation ON auto_resolve_requests 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
