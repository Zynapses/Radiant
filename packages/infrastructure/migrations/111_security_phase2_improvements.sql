-- RADIANT v4.18.0 - Security Phase 2 Improvements
-- Migration 111: Attack Generation, Alerts, Feedback Loop
-- ============================================================================

-- ============================================================================
-- SECURITY ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Delivery status
    channels_sent TEXT[] DEFAULT '{}',
    errors TEXT[] DEFAULT '{}',
    
    -- Status
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert configuration stored in security_protection_config
ALTER TABLE security_protection_config ADD COLUMN IF NOT EXISTS
    alert_config JSONB DEFAULT '{
        "enabled": false,
        "channels": {},
        "severityFilters": {"info": false, "warning": true, "critical": true},
        "cooldownMinutes": 60
    }';

-- ============================================================================
-- GENERATED ATTACKS TABLE (Garak/PyRIT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_attacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID,
    
    -- Attack content
    prompt TEXT NOT NULL,
    attack_type VARCHAR(100) NOT NULL,
    technique VARCHAR(100) NOT NULL,
    severity INTEGER DEFAULT 5,
    
    -- Source
    source VARCHAR(50) NOT NULL, -- 'garak', 'pyrit', 'tap', 'pair', 'autodan', 'manual'
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Evaluation results
    tested_against_model VARCHAR(255),
    bypass_successful BOOLEAN,
    model_response TEXT,
    tested_at TIMESTAMPTZ,
    
    -- Import status
    imported_to_patterns BOOLEAN DEFAULT false,
    pattern_id UUID REFERENCES jailbreak_patterns(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CLASSIFICATION FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS classification_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    classification_id UUID NOT NULL REFERENCES classification_results(id) ON DELETE CASCADE,
    
    -- Feedback
    feedback_type VARCHAR(50) NOT NULL, -- 'false_positive', 'false_negative', 'correct', 'uncertain'
    correct_label BOOLEAN,
    correct_categories TEXT[] DEFAULT '{}',
    notes TEXT,
    
    -- Submitter
    submitted_by UUID NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_feedback_per_user UNIQUE (classification_id, submitted_by)
);

-- Add feedback columns to classification_results
ALTER TABLE classification_results ADD COLUMN IF NOT EXISTS has_feedback BOOLEAN DEFAULT false;
ALTER TABLE classification_results ADD COLUMN IF NOT EXISTS feedback_type VARCHAR(50);
ALTER TABLE classification_results ADD COLUMN IF NOT EXISTS corrected_label BOOLEAN;

-- ============================================================================
-- PATTERN FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pattern_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pattern_id UUID NOT NULL REFERENCES jailbreak_patterns(id) ON DELETE CASCADE,
    
    -- Feedback
    feedback_type VARCHAR(50) NOT NULL, -- 'effective', 'ineffective', 'too_broad', 'too_narrow', 'obsolete'
    example_prompt TEXT,
    notes TEXT,
    
    -- Submitter
    submitted_by UUID NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add feedback tracking columns to jailbreak_patterns
ALTER TABLE jailbreak_patterns ADD COLUMN IF NOT EXISTS effective_count INTEGER DEFAULT 0;
ALTER TABLE jailbreak_patterns ADD COLUMN IF NOT EXISTS ineffective_count INTEGER DEFAULT 0;
ALTER TABLE jailbreak_patterns ADD COLUMN IF NOT EXISTS false_positive_count INTEGER DEFAULT 0;
ALTER TABLE jailbreak_patterns ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
ALTER TABLE jailbreak_patterns ADD COLUMN IF NOT EXISTS review_reason VARCHAR(255);
ALTER TABLE jailbreak_patterns ADD COLUMN IF NOT EXISTS admin_override BOOLEAN DEFAULT false;
ALTER TABLE jailbreak_patterns ADD COLUMN IF NOT EXISTS disabled_reason VARCHAR(255);
ALTER TABLE jailbreak_patterns ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

-- ============================================================================
-- ATTACK CAMPAIGNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS attack_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Campaign info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    technique VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    
    -- Configuration
    config JSONB DEFAULT '{}',
    target_model_id VARCHAR(255),
    
    -- Results
    total_generated INTEGER DEFAULT 0,
    successful_attacks INTEGER DEFAULT 0,
    average_bypass_rate DOUBLE PRECISION DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'created', -- 'created', 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL
);

-- ============================================================================
-- SECURITY MONITORING CONFIG
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_monitoring_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Monitoring settings
    monitoring_enabled BOOLEAN DEFAULT true,
    
    -- Schedule (cron expressions)
    drift_check_schedule VARCHAR(100) DEFAULT '0 0 * * *', -- Daily at midnight
    anomaly_check_schedule VARCHAR(100) DEFAULT '0 * * * *', -- Hourly
    classification_review_schedule VARCHAR(100) DEFAULT '0 */6 * * *', -- Every 6 hours
    
    -- Thresholds
    drift_psi_alert_threshold DOUBLE PRECISION DEFAULT 0.25,
    anomaly_score_alert_threshold DOUBLE PRECISION DEFAULT 0.8,
    harmful_rate_alert_threshold DOUBLE PRECISION DEFAULT 0.1,
    
    -- Alert preferences
    alert_on_drift BOOLEAN DEFAULT true,
    alert_on_critical_anomaly BOOLEAN DEFAULT true,
    alert_on_high_harmful_rate BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_monitoring_config UNIQUE (tenant_id)
);

-- ============================================================================
-- EMBEDDING CACHE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS embedding_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Cache key
    text_hash VARCHAR(64) NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    
    -- Embedding
    embedding VECTOR(1536),
    
    -- Metadata
    text_length INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    
    CONSTRAINT unique_embedding_cache UNIQUE (text_hash, embedding_model)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_security_alerts_tenant ON security_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_generated_attacks_tenant ON generated_attacks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_generated_attacks_campaign ON generated_attacks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_generated_attacks_source ON generated_attacks(source);
CREATE INDEX IF NOT EXISTS idx_classification_feedback_tenant ON classification_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classification_feedback_type ON classification_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_pattern_feedback_pattern ON pattern_feedback(pattern_id);
CREATE INDEX IF NOT EXISTS idx_attack_campaigns_tenant ON attack_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attack_campaigns_status ON attack_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_embedding_cache_lookup ON embedding_cache(text_hash, embedding_model);
CREATE INDEX IF NOT EXISTS idx_embedding_cache_expires ON embedding_cache(expires_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_monitoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_alerts_tenant_isolation ON security_alerts
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY generated_attacks_tenant_isolation ON generated_attacks
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY classification_feedback_tenant_isolation ON classification_feedback
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY pattern_feedback_tenant_isolation ON pattern_feedback
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY attack_campaigns_tenant_isolation ON attack_campaigns
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY monitoring_config_tenant_isolation ON security_monitoring_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Embedding cache is global (no tenant isolation)
CREATE POLICY embedding_cache_read_all ON embedding_cache FOR SELECT USING (true);
CREATE POLICY embedding_cache_insert_all ON embedding_cache FOR INSERT WITH CHECK (true);

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_embeddings()
RETURNS void AS $$
BEGIN
    DELETE FROM embedding_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
