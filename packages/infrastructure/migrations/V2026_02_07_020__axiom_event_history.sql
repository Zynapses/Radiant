-- =============================================================================
-- V2026_02_07_020: AXIOM Event History for Cold-Start Resilience
-- =============================================================================
-- Persists AXIOM/CLARION session events to survive Lambda cold starts.
-- Events are session-scoped and short-lived (auto-cleanup after 24 hours).
-- =============================================================================

-- AXIOM event history table
CREATE TABLE IF NOT EXISTS axiom_event_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id      VARCHAR(255) NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast session-based lookups
CREATE INDEX IF NOT EXISTS idx_axiom_event_history_session
    ON axiom_event_history (session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_axiom_event_history_tenant
    ON axiom_event_history (tenant_id, created_at DESC);

-- Auto-cleanup: events older than 24 hours (sessions are short-lived)
CREATE INDEX IF NOT EXISTS idx_axiom_event_history_cleanup
    ON axiom_event_history (created_at)
    WHERE created_at < NOW() - INTERVAL '24 hours';

-- RLS
ALTER TABLE axiom_event_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY axiom_event_history_tenant_isolation ON axiom_event_history
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_axiom_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM axiom_event_history
    WHERE created_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE axiom_event_history IS 'Persists AXIOM/CLARION session events for cold-start replay (v7.43.0)';
