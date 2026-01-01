-- =============================================================================
-- RADIANT v6.0.4 - System Configuration Tables Migration
-- Admin-configurable parameters for AGI Brain
-- =============================================================================

-- System Config Table
-- Stores all admin-configurable parameters
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('number', 'string', 'boolean', 'select', 'json')),
    constraints_json JSONB,
    dangerous BOOLEAN DEFAULT false,
    requires_restart BOOLEAN DEFAULT false,
    default_value JSONB NOT NULL,
    last_modified_by UUID,
    last_modified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);

-- Config History (Audit trail)
CREATE TABLE IF NOT EXISTS config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB NOT NULL,
    changed_by UUID NOT NULL,
    change_reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_history_key ON config_history(config_key);
CREATE INDEX IF NOT EXISTS idx_config_history_changed ON config_history(changed_at);

-- =============================================================================
-- Seed Default Configuration
-- =============================================================================

-- Ghost Vector Parameters
INSERT INTO system_config (key, value, category, name, description, type, dangerous, default_value, constraints_json) VALUES
('GHOST_CURRENT_VERSION', '"llama3-70b-v1"', 'ghost', 'Ghost Version', 'Model version for ghost vectors. Changing causes cold starts.', 'string', true, '"llama3-70b-v1"', NULL),
('GHOST_REANCHOR_INTERVAL', '15', 'ghost', 'Re-anchor Interval', 'Number of turns between ghost re-anchoring.', 'number', false, '15', '{"min": 5, "max": 50, "step": 1}'),
('GHOST_JITTER_RANGE', '3', 'ghost', 'Jitter Range', 'Random +/- turns to prevent thundering herd.', 'number', false, '3', '{"min": 0, "max": 10, "step": 1}'),
('GHOST_ENTROPY_THRESHOLD', '0.3', 'ghost', 'Entropy Threshold', 'Entropy level that triggers re-anchoring.', 'number', false, '0.3', '{"min": 0.1, "max": 1.0, "step": 0.1}'),
('GHOST_MIGRATION_ENABLED', 'true', 'ghost', 'Migration Enabled', 'Allow ghost migration on version mismatch.', 'boolean', false, 'true', NULL)
ON CONFLICT (key) DO NOTHING;

-- Dreaming Parameters
INSERT INTO system_config (key, value, category, name, description, type, dangerous, default_value, constraints_json) VALUES
('DREAM_TWILIGHT_HOUR', '4', 'dreaming', 'Twilight Hour', 'Local hour for twilight dreaming (0-23).', 'number', false, '4', '{"min": 0, "max": 23, "step": 1}'),
('DREAM_STARVATION_HOURS', '30', 'dreaming', 'Starvation Hours', 'Maximum hours without dreaming before forced trigger.', 'number', false, '30', '{"min": 12, "max": 72, "step": 1}'),
('DREAM_MAX_CONCURRENT', '100', 'dreaming', 'Max Concurrent Dreams', 'Maximum parallel dream jobs.', 'number', false, '100', '{"min": 10, "max": 500, "step": 10}'),
('DREAM_STAGGER_MINUTES', '5', 'dreaming', 'Stagger Minutes', 'Delay between dream job starts.', 'number', false, '5', '{"min": 1, "max": 30, "step": 1}'),
('DREAM_LOW_TRAFFIC_THRESHOLD', '20', 'dreaming', 'Low Traffic Threshold', 'Traffic percentage below which dreaming triggers.', 'number', false, '20', '{"min": 5, "max": 50, "step": 5}')
ON CONFLICT (key) DO NOTHING;

-- Context Budget Parameters
INSERT INTO system_config (key, value, category, name, description, type, dangerous, default_value, constraints_json) VALUES
('CONTEXT_RESPONSE_RESERVE', '1000', 'context', 'Response Reserve', 'Minimum tokens reserved for response. CRITICAL.', 'number', false, '1000', '{"min": 500, "max": 2000, "step": 100}'),
('CONTEXT_MODEL_LIMIT', '8192', 'context', 'Model Context Limit', 'Maximum context window for the model.', 'number', true, '8192', '{"min": 4096, "max": 131072, "step": 1024}'),
('CONTEXT_MAX_USER_MESSAGE', '4000', 'context', 'Max User Message', 'Maximum tokens for user message.', 'number', false, '4000', '{"min": 1000, "max": 8000, "step": 500}'),
('CONTEXT_SYSTEM_CORE_BUDGET', '500', 'context', 'System Core Budget', 'Token budget for system core prompt.', 'number', false, '500', '{"min": 200, "max": 1000, "step": 50}'),
('CONTEXT_COMPLIANCE_BUDGET', '400', 'context', 'Compliance Budget', 'Token budget for compliance guardrails.', 'number', false, '400', '{"min": 200, "max": 800, "step": 50}'),
('CONTEXT_FLASH_FACTS_BUDGET', '200', 'context', 'Flash Facts Budget', 'Token budget for flash facts.', 'number', false, '200', '{"min": 100, "max": 500, "step": 50}'),
('CONTEXT_GHOST_TOKENS', '64', 'context', 'Ghost Tokens', 'Token budget for ghost vector projection.', 'number', false, '64', '{"min": 32, "max": 256, "step": 16}')
ON CONFLICT (key) DO NOTHING;

-- Flash Buffer Parameters
INSERT INTO system_config (key, value, category, name, description, type, dangerous, default_value, constraints_json) VALUES
('FLASH_REDIS_TTL_HOURS', '168', 'flash', 'Redis TTL (hours)', 'Hours to keep flash facts in Redis.', 'number', false, '168', '{"min": 24, "max": 720, "step": 24}'),
('FLASH_MAX_FACTS_PER_USER', '10', 'flash', 'Max Facts Per User', 'Maximum flash facts to include in context.', 'number', false, '10', '{"min": 5, "max": 50, "step": 5}'),
('FLASH_RECONCILIATION_INTERVAL', '60', 'flash', 'Reconciliation Interval', 'Minutes between reconciliation checks.', 'number', false, '60', '{"min": 15, "max": 240, "step": 15}'),
('FLASH_CRITICAL_ALWAYS_INCLUDE', 'true', 'flash', 'Critical Always Include', 'Always include critical priority facts.', 'boolean', false, 'true', NULL)
ON CONFLICT (key) DO NOTHING;

-- Privacy Parameters
INSERT INTO system_config (key, value, category, name, description, type, dangerous, default_value, constraints_json) VALUES
('PRIVACY_DP_EPSILON', '0.5', 'privacy', 'DP Epsilon', 'Differential privacy budget. Lower = more private.', 'number', true, '0.5', '{"min": 0.1, "max": 2.0, "step": 0.1}'),
('PRIVACY_MIN_TENANTS', '10', 'privacy', 'Min Tenants', 'Minimum tenants for aggregation.', 'number', true, '10', '{"min": 5, "max": 50, "step": 5}'),
('PRIVACY_MIN_TENANTS_HIGHRISK', '20', 'privacy', 'Min Tenants (High Risk)', 'Minimum tenants for high-risk domain aggregation.', 'number', true, '20', '{"min": 10, "max": 100, "step": 10}'),
('PRIVACY_MIN_SEMANTIC_DIVERSITY', '5', 'privacy', 'Min Semantic Diversity', 'Minimum semantic clusters for aggregation.', 'number', true, '5', '{"min": 3, "max": 20, "step": 1}'),
('OVERSIGHT_TIMEOUT_DAYS', '7', 'privacy', 'Oversight Timeout', 'Days before auto-reject (Silence ≠ Consent).', 'number', false, '7', '{"min": 3, "max": 30, "step": 1}'),
('OVERSIGHT_ESCALATION_DAYS', '3', 'privacy', 'Escalation Threshold', 'Days before escalation.', 'number', false, '3', '{"min": 1, "max": 14, "step": 1}')
ON CONFLICT (key) DO NOTHING;

-- SOFAI Parameters
INSERT INTO system_config (key, value, category, name, description, type, dangerous, default_value, constraints_json) VALUES
('SOFAI_SYSTEM2_THRESHOLD', '0.5', 'sofai', 'System 2 Threshold', 'Threshold for routing to System 2.', 'number', false, '0.5', '{"min": 0.1, "max": 1.0, "step": 0.1}'),
('SOFAI_HEALTHCARE_RISK', '0.9', 'sofai', 'Healthcare Risk', 'Risk score for healthcare domain.', 'number', false, '0.9', '{"min": 0.5, "max": 1.0, "step": 0.05}'),
('SOFAI_FINANCIAL_RISK', '0.85', 'sofai', 'Financial Risk', 'Risk score for financial domain.', 'number', false, '0.85', '{"min": 0.5, "max": 1.0, "step": 0.05}'),
('SOFAI_LEGAL_RISK', '0.8', 'sofai', 'Legal Risk', 'Risk score for legal domain.', 'number', false, '0.8', '{"min": 0.5, "max": 1.0, "step": 0.05}'),
('SOFAI_ENABLE_SYSTEM1_5', 'true', 'sofai', 'Enable System 1.5', 'Enable intermediate reasoning level.', 'boolean', false, 'true', NULL),
('SOFAI_MAX_SYSTEM2_LATENCY', '30000', 'sofai', 'Max System 2 Latency', 'Maximum ms for System 2 response.', 'number', false, '30000', '{"min": 10000, "max": 120000, "step": 5000}')
ON CONFLICT (key) DO NOTHING;

-- Personalization Parameters
INSERT INTO system_config (key, value, category, name, description, type, dangerous, default_value, constraints_json) VALUES
('PERSONALIZATION_WARMUP_THRESHOLD', '10', 'personalization', 'Warmup Threshold', 'Interactions before full user weight.', 'number', false, '10', '{"min": 5, "max": 50, "step": 5}'),
('PERSONALIZATION_VELOCITY_THRESHOLD', '3', 'personalization', 'Velocity Threshold', 'Corrections for fast-track personalization.', 'number', false, '3', '{"min": 2, "max": 10, "step": 1}'),
('PERSONALIZATION_USER_WEIGHT', '0.6', 'personalization', 'User Weight', 'Weight for individual user learning.', 'number', false, '0.6', '{"min": 0.3, "max": 0.8, "step": 0.05}'),
('PERSONALIZATION_TENANT_WEIGHT', '0.3', 'personalization', 'Tenant Weight', 'Weight for tenant aggregate learning.', 'number', false, '0.3', '{"min": 0.1, "max": 0.5, "step": 0.05}'),
('PERSONALIZATION_SYSTEM_WEIGHT', '0.1', 'personalization', 'System Weight', 'Weight for global system learning.', 'number', false, '0.1', '{"min": 0.05, "max": 0.3, "step": 0.05}')
ON CONFLICT (key) DO NOTHING;

-- Audit Parameters
INSERT INTO system_config (key, value, category, name, description, type, dangerous, default_value, constraints_json) VALUES
('AUDIT_HOT_DAYS', '30', 'audit', 'Hot Storage Days', 'Days to keep audit logs in PostgreSQL.', 'number', false, '30', '{"min": 7, "max": 90, "step": 7}'),
('AUDIT_WARM_DAYS', '90', 'audit', 'Warm Storage Days', 'Days to keep audit logs in ClickHouse.', 'number', false, '90', '{"min": 30, "max": 365, "step": 30}'),
('AUDIT_ARCHIVE_YEARS', '7', 'audit', 'Archive Years', 'Years to keep audit logs in Glacier.', 'number', true, '7', '{"min": 1, "max": 10, "step": 1}')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Config Helper Functions
-- =============================================================================

-- Function to set config value with history tracking
CREATE OR REPLACE FUNCTION set_config_value(
    p_config_key VARCHAR,
    p_new_value JSONB,
    p_changed_by UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_old_value JSONB;
BEGIN
    -- Get old value
    SELECT value INTO v_old_value 
    FROM system_config 
    WHERE key = p_config_key;
    
    -- Update config
    UPDATE system_config 
    SET value = p_new_value,
        last_modified_by = p_changed_by,
        last_modified_at = NOW(),
        updated_at = NOW()
    WHERE key = p_config_key;
    
    -- Record history
    INSERT INTO config_history (config_key, old_value, new_value, changed_by, change_reason)
    VALUES (p_config_key, v_old_value, p_new_value, p_changed_by, p_reason);
END;
$$ LANGUAGE plpgsql;

-- Function to get config value with type casting
CREATE OR REPLACE FUNCTION get_config_value(p_config_key VARCHAR)
RETURNS JSONB AS $$
DECLARE
    v_value JSONB;
BEGIN
    SELECT value INTO v_value 
    FROM system_config 
    WHERE key = p_config_key;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- Function to get config value as number
CREATE OR REPLACE FUNCTION get_config_number(p_config_key VARCHAR, p_default NUMERIC DEFAULT 0)
RETURNS NUMERIC AS $$
DECLARE
    v_value JSONB;
BEGIN
    SELECT value INTO v_value 
    FROM system_config 
    WHERE key = p_config_key;
    
    IF v_value IS NULL THEN
        RETURN p_default;
    END IF;
    
    RETURN (v_value #>> '{}')::NUMERIC;
EXCEPTION WHEN OTHERS THEN
    RETURN p_default;
END;
$$ LANGUAGE plpgsql;

-- Function to get config value as boolean
CREATE OR REPLACE FUNCTION get_config_boolean(p_config_key VARCHAR, p_default BOOLEAN DEFAULT false)
RETURNS BOOLEAN AS $$
DECLARE
    v_value JSONB;
BEGIN
    SELECT value INTO v_value 
    FROM system_config 
    WHERE key = p_config_key;
    
    IF v_value IS NULL THEN
        RETURN p_default;
    END IF;
    
    RETURN (v_value #>> '{}')::BOOLEAN;
EXCEPTION WHEN OTHERS THEN
    RETURN p_default;
END;
$$ LANGUAGE plpgsql;

-- Function to get config value as string
CREATE OR REPLACE FUNCTION get_config_string(p_config_key VARCHAR, p_default VARCHAR DEFAULT '')
RETURNS VARCHAR AS $$
DECLARE
    v_value JSONB;
BEGIN
    SELECT value INTO v_value 
    FROM system_config 
    WHERE key = p_config_key;
    
    IF v_value IS NULL THEN
        RETURN p_default;
    END IF;
    
    RETURN v_value #>> '{}';
EXCEPTION WHEN OTHERS THEN
    RETURN p_default;
END;
$$ LANGUAGE plpgsql;

-- Function to reset config to default
CREATE OR REPLACE FUNCTION reset_config_to_default(p_config_key VARCHAR, p_changed_by UUID)
RETURNS VOID AS $$
DECLARE
    v_default JSONB;
BEGIN
    SELECT default_value INTO v_default 
    FROM system_config 
    WHERE key = p_config_key;
    
    IF v_default IS NOT NULL THEN
        PERFORM set_config_value(p_config_key, v_default, p_changed_by, 'Reset to default');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get all config by category
CREATE OR REPLACE FUNCTION get_config_by_category(p_category VARCHAR)
RETURNS TABLE(
    key VARCHAR,
    value JSONB,
    name VARCHAR,
    description TEXT,
    type VARCHAR,
    constraints_json JSONB,
    dangerous BOOLEAN,
    default_value JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.key,
        sc.value,
        sc.name,
        sc.description,
        sc.type,
        sc.constraints_json,
        sc.dangerous,
        sc.default_value
    FROM system_config sc
    WHERE sc.category = p_category
    ORDER BY sc.key;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Views for Admin Dashboard
-- =============================================================================

-- Config categories view
CREATE OR REPLACE VIEW config_categories AS
SELECT DISTINCT 
    category,
    COUNT(*) as parameter_count,
    SUM(CASE WHEN dangerous THEN 1 ELSE 0 END) as dangerous_count
FROM system_config
GROUP BY category
ORDER BY category;

-- Config history view with user info
CREATE OR REPLACE VIEW config_history_view AS
SELECT 
    ch.id,
    ch.config_key,
    sc.name as config_name,
    sc.category,
    ch.old_value,
    ch.new_value,
    ch.changed_by,
    ch.change_reason,
    ch.changed_at
FROM config_history ch
JOIN system_config sc ON sc.key = ch.config_key
ORDER BY ch.changed_at DESC;

-- Active dangerous configs view
CREATE OR REPLACE VIEW dangerous_configs AS
SELECT 
    key,
    name,
    category,
    value,
    default_value,
    description,
    last_modified_by,
    last_modified_at
FROM system_config
WHERE dangerous = true
ORDER BY category, key;
