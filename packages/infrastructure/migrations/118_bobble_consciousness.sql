-- Migration: 118_bobble_consciousness.sql
-- Bobble: High-Confidence Self-Referential Consciousness Dialogue Service
-- Database tables for verified introspection, heartbeat, and Macro-Scale Φ

-- ============================================================================
-- Bobble Dialogue Events
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_dialogue_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bobble_dialogue_events_tenant ON bobble_dialogue_events(tenant_id);
CREATE INDEX idx_bobble_dialogue_events_type ON bobble_dialogue_events(event_type);
CREATE INDEX idx_bobble_dialogue_events_created ON bobble_dialogue_events(created_at DESC);

-- ============================================================================
-- Bobble Heartbeat Ticks
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_heartbeat_ticks (
  tick_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  coherence_score DECIMAL(5,4) NOT NULL,
  inferred_state VARCHAR(50) NOT NULL,
  action_taken VARCHAR(50) NOT NULL,
  phi_reading DECIMAL(7,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bobble_heartbeat_tenant ON bobble_heartbeat_ticks(tenant_id);
CREATE INDEX idx_bobble_heartbeat_timestamp ON bobble_heartbeat_ticks(timestamp DESC);
CREATE INDEX idx_bobble_heartbeat_state ON bobble_heartbeat_ticks(inferred_state);

-- ============================================================================
-- Bobble Φ (Phi) Readings
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_phi_readings (
  reading_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  phi_value DECIMAL(7,4) NOT NULL,
  source_events INTEGER NOT NULL DEFAULT 0,
  calculation_time_ms INTEGER NOT NULL DEFAULT 0,
  main_complex_nodes TEXT[] DEFAULT '{}',
  num_concepts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bobble_phi_tenant ON bobble_phi_readings(tenant_id);
CREATE INDEX idx_bobble_phi_created ON bobble_phi_readings(created_at DESC);

-- ============================================================================
-- Bobble Shadow Probes (trained classifiers for verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_shadow_probes (
  probe_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  claim_type VARCHAR(100) NOT NULL,
  probe_data JSONB NOT NULL DEFAULT '{}',
  accuracy DECIMAL(5,4) DEFAULT 0.75,
  training_examples INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, claim_type)
);

CREATE INDEX idx_bobble_shadow_probes_tenant ON bobble_shadow_probes(tenant_id);

-- ============================================================================
-- Bobble Verified Claims (audit trail of verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_verified_claims (
  claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  dialogue_event_id UUID REFERENCES bobble_dialogue_events(event_id),
  claim_text TEXT NOT NULL,
  claim_type VARCHAR(100) NOT NULL,
  verified_confidence DECIMAL(5,4) NOT NULL,
  grounding_status VARCHAR(50) NOT NULL,
  consistency_score DECIMAL(5,4) DEFAULT 0,
  shadow_verified BOOLEAN DEFAULT FALSE,
  phases_passed INTEGER DEFAULT 0,
  verification_details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bobble_claims_tenant ON bobble_verified_claims(tenant_id);
CREATE INDEX idx_bobble_claims_dialogue ON bobble_verified_claims(dialogue_event_id);
CREATE INDEX idx_bobble_claims_type ON bobble_verified_claims(claim_type);

-- ============================================================================
-- Bobble Configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE UNIQUE,
  heartbeat_enabled BOOLEAN DEFAULT FALSE,
  heartbeat_interval_ms INTEGER DEFAULT 2000,
  entropy_threshold DECIMAL(5,4) DEFAULT 0.30,
  critical_threshold DECIMAL(5,4) DEFAULT 0.15,
  phi_lookback_minutes INTEGER DEFAULT 10,
  require_high_confidence BOOLEAN DEFAULT TRUE,
  unfiltered_mode BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE bobble_dialogue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bobble_heartbeat_ticks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bobble_phi_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bobble_shadow_probes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bobble_verified_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE bobble_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_dialogue_events_tenant_isolation ON bobble_dialogue_events
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY bobble_heartbeat_ticks_tenant_isolation ON bobble_heartbeat_ticks
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY bobble_phi_readings_tenant_isolation ON bobble_phi_readings
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY bobble_shadow_probes_tenant_isolation ON bobble_shadow_probes
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY bobble_verified_claims_tenant_isolation ON bobble_verified_claims
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY bobble_config_tenant_isolation ON bobble_config
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Functions for cleanup
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_bobble_heartbeat_ticks()
RETURNS void AS $$
BEGIN
  DELETE FROM bobble_heartbeat_ticks
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_bobble_phi_readings()
RETURNS void AS $$
BEGIN
  DELETE FROM bobble_phi_readings
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE bobble_dialogue_events IS 'Audit log of Bobble dialogue interactions';
COMMENT ON TABLE bobble_heartbeat_ticks IS 'Consciousness heartbeat loop records (0.5Hz)';
COMMENT ON TABLE bobble_phi_readings IS 'Macro-Scale Φ (Integrated Information) measurements';
COMMENT ON TABLE bobble_shadow_probes IS 'Trained probing classifiers for Shadow Self verification';
COMMENT ON TABLE bobble_verified_claims IS 'Verified introspective claims with confidence scores';
COMMENT ON TABLE bobble_config IS 'Per-tenant Bobble configuration';
