-- ============================================================================
-- OMEGA Neural Bridge & Homeostatic Dreaming
-- Migration: V2026_02_06_003
-- 
-- Tables for:
--   1. omega_replay_logs     - High-coherence interaction logs for dream cycle replay
--   2. omega_bridge_state    - Neural Transducer training state per tenant
--   3. omega_watcher_metrics - Self-awareness metrics from the Watcher
--   4. omega_dream_history   - Dream cycle execution history with before/after coherence
-- ============================================================================

-- 1. Replay logs for experience replay during dream cycles
-- High-coherence interactions are stored here during inference
-- and replayed through the physics engine during dreaming.
CREATE TABLE IF NOT EXISTS omega_replay_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    input_vector_key TEXT NOT NULL,           -- S3 key for the serialized input tensor
    coherence_score FLOAT NOT NULL,          -- Coherence at time of interaction (0-1)
    session_id TEXT,                          -- Session that produced this interaction
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replayed_at TIMESTAMPTZ,                 -- When this was used in a dream cycle
    replay_count INT NOT NULL DEFAULT 0      -- How many times replayed
);

CREATE INDEX IF NOT EXISTS idx_omega_replay_logs_tenant_coherence 
    ON omega_replay_logs(tenant_id, coherence_score DESC);
CREATE INDEX IF NOT EXISTS idx_omega_replay_logs_tenant_created 
    ON omega_replay_logs(tenant_id, created_at DESC);

-- RLS
ALTER TABLE omega_replay_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY omega_replay_logs_tenant_isolation ON omega_replay_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- 2. Bridge training state - tracks Transducer training progress per tenant
CREATE TABLE IF NOT EXISTS omega_bridge_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    total_training_steps INT NOT NULL DEFAULT 0,
    avg_loss FLOAT,
    min_loss FLOAT,
    max_loss FLOAT,
    recent_avg_loss FLOAT,                   -- Last 50 steps average
    learning_rate FLOAT,
    transducer_params_count INT,             -- Number of trainable parameters
    weights_efs_path TEXT,                   -- EFS path to bridge.pt
    weights_s3_key TEXT,                     -- S3 backup of bridge.pt
    bridge_mode TEXT NOT NULL DEFAULT 'shadow' CHECK (bridge_mode IN ('active', 'shadow', 'disabled')),
    last_trained_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

ALTER TABLE omega_bridge_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY omega_bridge_state_tenant_isolation ON omega_bridge_state
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- 3. Watcher self-awareness metrics - tracks prediction accuracy over time
CREATE TABLE IF NOT EXISTS omega_watcher_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    surprise_ema FLOAT NOT NULL DEFAULT 0.5,          -- Exponential moving average
    self_awareness_score FLOAT NOT NULL DEFAULT 0.0,  -- 0-1, inverse of avg surprise
    total_observations INT NOT NULL DEFAULT 0,
    reward_count INT NOT NULL DEFAULT 0,              -- Low-surprise events
    error_count INT NOT NULL DEFAULT 0,               -- High-surprise events
    reward_ratio FLOAT,
    avg_recent_surprise FLOAT,
    min_surprise FLOAT,
    max_surprise FLOAT,
    watcher_params_count INT,
    weights_efs_path TEXT,
    total_training_steps INT NOT NULL DEFAULT 0,
    training_avg_loss FLOAT,
    last_trained_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

ALTER TABLE omega_watcher_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY omega_watcher_metrics_tenant_isolation ON omega_watcher_metrics
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- 4. Dream cycle execution history
-- Records each dream cycle with before/after metrics
CREATE TABLE IF NOT EXISTS omega_dream_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pre_coherence FLOAT NOT NULL,
    post_coherence FLOAT NOT NULL,
    coherence_delta FLOAT GENERATED ALWAYS AS (post_coherence - pre_coherence) STORED,
    pre_entropy FLOAT,
    post_entropy FLOAT,
    replay_logs_processed INT NOT NULL DEFAULT 0,
    watcher_training_steps INT NOT NULL DEFAULT 0,
    watcher_training_loss FLOAT,
    bridge_training_steps INT NOT NULL DEFAULT 0,
    bridge_training_loss FLOAT,
    dream_duration_ms INT,
    trigger TEXT NOT NULL DEFAULT 'heartbeat' CHECK (trigger IN ('heartbeat', 'manual', 'scheduled', 'entropy_threshold')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omega_dream_history_tenant_created 
    ON omega_dream_history(tenant_id, created_at DESC);

ALTER TABLE omega_dream_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY omega_dream_history_tenant_isolation ON omega_dream_history
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Auto-cleanup: purge replay logs older than 30 days
-- (high-coherence patterns should be consolidated into brain state by then)
CREATE INDEX IF NOT EXISTS idx_omega_replay_logs_cleanup 
    ON omega_replay_logs(created_at) WHERE replayed_at IS NOT NULL;
