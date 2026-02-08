-- ============================================================================
-- OMEGA Quantum-Inspired Architecture Upgrade
-- Migration: V2026_02_07_021__omega_quantum_upgrade.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.1  omega_firmware — rename 'physics' → 'quantum', add quantum metadata
-- ---------------------------------------------------------------------------

ALTER TABLE omega_firmware
  RENAME COLUMN physics TO quantum;

ALTER TABLE omega_firmware
  ADD COLUMN IF NOT EXISTS hilbert_dimension INTEGER DEFAULT 1024,
  ADD COLUMN IF NOT EXISTS unitarity_mode VARCHAR(20) DEFAULT 'renormalize'
    CHECK (unitarity_mode IN ('renormalize', 'project', 'strict')),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'signed', 'active', 'superseded', 'revoked')),
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES omega_firmware(id);

UPDATE omega_firmware SET hilbert_dimension = 1024 WHERE hilbert_dimension IS NULL;
UPDATE omega_firmware SET status = 'active' WHERE status IS NULL;

COMMENT ON COLUMN omega_firmware.quantum IS 'Quantum physics parameters: amplitude_decay, phase_resolution, interference thresholds, etc.';
COMMENT ON COLUMN omega_firmware.hilbert_dimension IS 'Number of Q-Nodes (simulated qubits) in the Hilbert space';
COMMENT ON COLUMN omega_firmware.unitarity_mode IS 'How to enforce ‖ψ‖=1: renormalize (divide by norm), project (nearest unit vector), strict (error if violated)';
COMMENT ON COLUMN omega_firmware.status IS 'Firmware lifecycle: draft → signed → active → superseded';
COMMENT ON COLUMN omega_firmware.content_hash IS 'SHA-512 hash of .bio content for integrity verification and hot-swap detection';
COMMENT ON COLUMN omega_firmware.is_verified IS 'Whether a second admin has reviewed and approved (2-person rule)';

-- ---------------------------------------------------------------------------
-- 2.2  omega_helix_rules — rename phase_vector → forbidden_state
-- ---------------------------------------------------------------------------

ALTER TABLE omega_helix_rules
  RENAME COLUMN phase_vector_real TO forbidden_state_real;

ALTER TABLE omega_helix_rules
  RENAME COLUMN phase_vector_imaginary TO forbidden_state_imaginary;

ALTER TABLE omega_helix_rules
  ADD COLUMN IF NOT EXISTS forbidden_state_norm NUMERIC(10, 8) DEFAULT 1.0;

COMMENT ON COLUMN omega_helix_rules.forbidden_state_real IS 'Real components of forbidden quantum state vector |φ⟩';
COMMENT ON COLUMN omega_helix_rules.forbidden_state_imaginary IS 'Imaginary components of forbidden quantum state vector |φ⟩';
COMMENT ON COLUMN omega_helix_rules.forbidden_state_norm IS 'Cached norm of forbidden state (should be 1.0)';

-- ---------------------------------------------------------------------------
-- 2.3  omega_brains — add quantum health + firmware hot-swap columns
-- ---------------------------------------------------------------------------

ALTER TABLE omega_brains
  ADD COLUMN IF NOT EXISTS hilbert_dimension INTEGER DEFAULT 1024,
  ADD COLUMN IF NOT EXISTS last_unitarity_check TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_norm_value NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS unitarity_corrections_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_firmware_id UUID REFERENCES omega_firmware(id),
  ADD COLUMN IF NOT EXISTS firmware_hash VARCHAR(128);

COMMENT ON COLUMN omega_brains.last_norm_value IS 'Last measured ‖ψ‖ (should be ~1.0)';
COMMENT ON COLUMN omega_brains.unitarity_corrections_count IS 'Number of times state was renormalized due to drift';
COMMENT ON COLUMN omega_brains.active_firmware_id IS 'Currently active firmware for this brain';
COMMENT ON COLUMN omega_brains.firmware_hash IS 'Content hash of active firmware — brain detects changes by comparing to loaded hash';

-- ---------------------------------------------------------------------------
-- 2.4  NEW TABLE: omega_measurements
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS omega_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brain_id UUID NOT NULL REFERENCES omega_brains(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Measurement details
    cycle_number BIGINT NOT NULL,
    measurement_type VARCHAR(20) NOT NULL CHECK (measurement_type IN ('full', 'partial', 'soft')),
    basis_state_measured INTEGER,
    probability_measured NUMERIC(10, 8),

    -- Pre/post state norms (for debugging)
    pre_measurement_norm NUMERIC(10, 8),
    post_measurement_norm NUMERIC(10, 8),

    -- Metadata
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inference_request_id UUID,

    CONSTRAINT valid_probability CHECK (probability_measured >= 0 AND probability_measured <= 1)
);

CREATE INDEX IF NOT EXISTS idx_measurements_brain ON omega_measurements(brain_id);
CREATE INDEX IF NOT EXISTS idx_measurements_tenant ON omega_measurements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_measurements_time ON omega_measurements(measured_at DESC);

ALTER TABLE omega_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY measurements_tenant_isolation ON omega_measurements
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ---------------------------------------------------------------------------
-- 2.5  NEW TABLE: omega_unitarity_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS omega_unitarity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brain_id UUID NOT NULL REFERENCES omega_brains(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('drift', 'correction', 'violation')),
    measured_norm NUMERIC(10, 8) NOT NULL,
    expected_norm NUMERIC(10, 8) NOT NULL DEFAULT 1.0,
    deviation NUMERIC(10, 8) NOT NULL,

    action_taken VARCHAR(20),  -- 'renormalized', 'projected', 'error_raised'

    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cycle_number BIGINT
);

CREATE INDEX IF NOT EXISTS idx_unitarity_brain ON omega_unitarity_events(brain_id);
CREATE INDEX IF NOT EXISTS idx_unitarity_tenant ON omega_unitarity_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unitarity_time ON omega_unitarity_events(detected_at DESC);

ALTER TABLE omega_unitarity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY unitarity_tenant_isolation ON omega_unitarity_events
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
