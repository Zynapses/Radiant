-- =============================================================================
-- OMEGA Instance Registry & Genesis Forge Schema
-- V2026_02_06_004 — Omega Instance Registry, Forge Sessions, Forge Artifacts
-- =============================================================================

-- Omega Instance Registry: Every OMEGA brain instance is registered here
-- Genesis Forge can connect to any instance by ID
CREATE TABLE omega_instance_registry (
    id                  TEXT        PRIMARY KEY,
    name                TEXT        NOT NULL,
    tenant_id           TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    endpoint            TEXT        NOT NULL,
    region              TEXT        NOT NULL DEFAULT 'us-east-1',
    status              TEXT        NOT NULL DEFAULT 'offline'
                                    CHECK (status IN ('online', 'offline', 'dreaming', 'forging')),
    bridge_mode         TEXT        NOT NULL DEFAULT 'shadow'
                                    CHECK (bridge_mode IN ('active', 'shadow', 'disabled')),
    firmware_version    TEXT        NOT NULL DEFAULT '1.0.0',
    coherence_score     REAL        NOT NULL DEFAULT 0.5,
    entropy_level       REAL        NOT NULL DEFAULT 0.5,
    cpu_temp            REAL        NOT NULL DEFAULT 25.0,
    ram_usage           REAL        NOT NULL DEFAULT 0.0,
    stability_score     REAL        NOT NULL DEFAULT 1.0,
    total_cycles        BIGINT      NOT NULL DEFAULT 0,
    neural_density_mb   REAL        NOT NULL DEFAULT 0.0,
    last_heartbeat      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for registry lookups
CREATE INDEX idx_omega_registry_tenant ON omega_instance_registry(tenant_id);
CREATE INDEX idx_omega_registry_status ON omega_instance_registry(status);
CREATE INDEX idx_omega_registry_region ON omega_instance_registry(region);

-- RLS: Tenants can only see their own instances
ALTER TABLE omega_instance_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY omega_registry_tenant_isolation ON omega_instance_registry
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Forge Sessions: Track every Forge session (graph topology + result)
CREATE TABLE omega_forge_sessions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id         TEXT        NOT NULL REFERENCES omega_instance_registry(id) ON DELETE CASCADE,
    tenant_id           TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_name        TEXT,
    graph_topology      JSONB       NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    telemetry_snapshot  JSONB,
    forge_status        TEXT        NOT NULL DEFAULT 'drafting'
                                    CHECK (forge_status IN ('drafting', 'simulating', 'forging', 'completed', 'failed')),
    stability_at_forge  REAL,
    firmware_binary_key TEXT,
    firmware_hash       TEXT,
    error_message       TEXT,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forge_sessions_instance ON omega_forge_sessions(instance_id);
CREATE INDEX idx_forge_sessions_tenant ON omega_forge_sessions(tenant_id);
CREATE INDEX idx_forge_sessions_status ON omega_forge_sessions(forge_status);

ALTER TABLE omega_forge_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY forge_sessions_tenant_isolation ON omega_forge_sessions
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Forge Artifacts: Compiled .bin files from forge sessions
CREATE TABLE omega_forge_artifacts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        NOT NULL REFERENCES omega_forge_sessions(id) ON DELETE CASCADE,
    tenant_id           TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    artifact_name       TEXT        NOT NULL,
    artifact_type       TEXT        NOT NULL DEFAULT 'firmware_bin'
                                    CHECK (artifact_type IN ('firmware_bin', 'simulation_log', 'thermal_report', 'topology_export')),
    s3_key              TEXT        NOT NULL,
    size_bytes          BIGINT      NOT NULL DEFAULT 0,
    sha256_hash         TEXT        NOT NULL,
    metadata            JSONB       NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forge_artifacts_session ON omega_forge_artifacts(session_id);
CREATE INDEX idx_forge_artifacts_tenant ON omega_forge_artifacts(tenant_id);

ALTER TABLE omega_forge_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY forge_artifacts_tenant_isolation ON omega_forge_artifacts
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Shadow Omega Telemetry History: Time-series telemetry from WebSocket streams
CREATE TABLE omega_telemetry_history (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id         TEXT        NOT NULL REFERENCES omega_instance_registry(id) ON DELETE CASCADE,
    tenant_id           TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cpu_temp            REAL        NOT NULL,
    ram_usage           REAL        NOT NULL,
    stability_score     REAL        NOT NULL,
    coherence_score     REAL        NOT NULL,
    entropy_level       REAL        NOT NULL,
    power_budget_hours  REAL,
    thermal_map         REAL[]      NOT NULL DEFAULT '{}',
    inference_latency_ms REAL,
    bridge_injection_norm REAL,
    watcher_surprise    REAL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (recorded_at);

-- Monthly partitions for telemetry
CREATE TABLE omega_telemetry_history_2026_02 PARTITION OF omega_telemetry_history
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE omega_telemetry_history_2026_03 PARTITION OF omega_telemetry_history
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX idx_telemetry_instance_time ON omega_telemetry_history(instance_id, recorded_at DESC);

ALTER TABLE omega_telemetry_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY telemetry_tenant_isolation ON omega_telemetry_history
    USING (tenant_id = current_setting('app.current_tenant_id', true));
