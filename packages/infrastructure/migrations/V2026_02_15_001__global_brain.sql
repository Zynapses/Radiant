-- ============================================================================
-- GLOBAL BRAIN — Federated Learning Infrastructure
-- Migration: V2026_02_15_001__global_brain
-- PROMPT-53: Bidirectional Architecture
-- ============================================================================

BEGIN;

-- Privacy configuration per tenant (opt-in/out, noise level, consent)
CREATE TABLE global_brain_enrollment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  enrolled BOOLEAN NOT NULL DEFAULT FALSE,
  enrollment_tier VARCHAR(20) NOT NULL DEFAULT 'standard'
    CHECK (enrollment_tier IN ('none', 'standard', 'premium', 'research')),
  privacy_config JSONB NOT NULL DEFAULT '{
    "dp_epsilon": 8.0,
    "dp_delta": 1e-5,
    "dp_clip_norm": 1.0,
    "noise_multiplier": 1.1,
    "min_participation_rounds": 5,
    "gradient_retention_days": 30
  }',
  data_consent JSONB NOT NULL DEFAULT '{
    "allow_omega_gradients": true,
    "allow_cortex_metrics": true,
    "allow_cato_metadata": true,
    "allow_cross_domain": false,
    "phi_exclusion": true
  }',
  enrolled_at TIMESTAMPTZ,
  last_contribution TIMESTAMPTZ,
  total_contributions INTEGER NOT NULL DEFAULT 0,
  contribution_quality_score FLOAT NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gradient uploads from tenant brains
CREATE TABLE global_brain_gradients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  gradient_type VARCHAR(30) NOT NULL CHECK (gradient_type IN (
    'omega_qnode', 'cortex_performance', 'cato_fitness'
  )),
  dream_cycle_id VARCHAR(100),
  round_id UUID,
  storage_ref VARCHAR(500) NOT NULL,
  size_bytes BIGINT NOT NULL,
  dp_noise_applied BOOLEAN NOT NULL DEFAULT TRUE,
  dp_epsilon_used FLOAT,
  dp_delta_used FLOAT,
  clip_norm_used FLOAT,
  quality_score FLOAT,
  metadata JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded', 'validated', 'aggregating', 'aggregated', 'expired'
  )),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

-- Federated learning rounds
CREATE TABLE global_brain_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number INTEGER NOT NULL,
  round_type VARCHAR(30) NOT NULL CHECK (round_type IN (
    'omega_qnode', 'cortex_networks', 'full'
  )),
  status VARCHAR(20) NOT NULL DEFAULT 'collecting' CHECK (status IN (
    'collecting', 'aggregating', 'completed', 'failed', 'cancelled'
  )),
  target_participants INTEGER NOT NULL DEFAULT 10,
  actual_participants INTEGER NOT NULL DEFAULT 0,
  participating_tenants UUID[] NOT NULL DEFAULT '{}',
  aggregation_config JSONB NOT NULL DEFAULT '{
    "method": "federated_averaging",
    "weighting": "quality_weighted",
    "outlier_detection": true,
    "outlier_z_threshold": 3.0,
    "momentum": 0.9,
    "learning_rate_global": 0.01
  }',
  result_storage_ref VARCHAR(500),
  result_checksum VARCHAR(64),
  quality_metrics JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Base cartridge generation pipeline
CREATE TABLE global_brain_cartridge_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_type VARCHAR(30) NOT NULL CHECK (pipeline_type IN (
    'base', 'domain_refresh', 'emergency_patch'
  )),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'collecting_rounds', 'averaging', 'building_cartridge',
    'validating', 'publishing', 'completed', 'failed'
  )),
  input_rounds UUID[] NOT NULL DEFAULT '{}',
  output_cartridge_id UUID,
  target_version VARCHAR(20),
  config JSONB NOT NULL DEFAULT '{}',
  progress JSONB,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_gb_enrollment_tenant ON global_brain_enrollment(tenant_id);
CREATE INDEX idx_gb_enrollment_enrolled ON global_brain_enrollment(enrolled);
CREATE INDEX idx_gb_gradients_tenant ON global_brain_gradients(tenant_id);
CREATE INDEX idx_gb_gradients_round ON global_brain_gradients(round_id);
CREATE INDEX idx_gb_gradients_status ON global_brain_gradients(status);
CREATE INDEX idx_gb_gradients_type ON global_brain_gradients(gradient_type);
CREATE INDEX idx_gb_gradients_uploaded ON global_brain_gradients(uploaded_at);
CREATE INDEX idx_gb_rounds_status ON global_brain_rounds(status);
CREATE INDEX idx_gb_rounds_number ON global_brain_rounds(round_number);
CREATE INDEX idx_gb_pipeline_status ON global_brain_cartridge_pipeline(status);

-- RLS — gradients are sensitive even though anonymized
ALTER TABLE global_brain_enrollment ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_brain_gradients ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrollment_tenant_policy ON global_brain_enrollment
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY gradients_tenant_policy ON global_brain_gradients
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMIT;
