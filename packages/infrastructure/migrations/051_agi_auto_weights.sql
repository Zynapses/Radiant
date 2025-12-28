-- Migration 051: AGI Auto Weights Default
-- RADIANT v4.18.0 - Enable auto-tuning by default with user-adjustable parameters

-- Add auto_mode column to service weights
ALTER TABLE agi_service_weights
ADD COLUMN IF NOT EXISTS auto_mode BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_weight NUMERIC(4, 3),
ADD COLUMN IF NOT EXISTS user_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_auto_tuned_at TIMESTAMPTZ;

-- Add comment explaining the columns
COMMENT ON COLUMN agi_service_weights.auto_mode IS 'When true, weight is automatically adjusted based on performance';
COMMENT ON COLUMN agi_service_weights.auto_weight IS 'The last auto-calculated weight (for comparison/reference)';
COMMENT ON COLUMN agi_service_weights.user_override IS 'When true, user has manually set this weight and it won''t be auto-tuned';

-- Update default self-improvement config to enable auto-tune
UPDATE agi_self_improvement_config 
SET auto_tune_weights = true,
    learning_rate = 0.15,
    exploration_rate = 0.1
WHERE tenant_id IS NULL;

-- Add auto-tune tracking columns to consciousness weights
ALTER TABLE agi_consciousness_weights
ADD COLUMN IF NOT EXISTS auto_mode BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS user_override BOOLEAN DEFAULT false;

-- Add auto-tune tracking to decision weights
ALTER TABLE agi_decision_weights
ADD COLUMN IF NOT EXISTS auto_mode BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS user_override BOOLEAN DEFAULT false;

-- Create table for weight history (for learning from adjustments)
CREATE TABLE IF NOT EXISTS agi_weight_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    weight_type VARCHAR(30) NOT NULL, -- 'service', 'consciousness', 'decision'
    weight_id VARCHAR(100) NOT NULL,
    old_weight NUMERIC(4, 3) NOT NULL,
    new_weight NUMERIC(4, 3) NOT NULL,
    change_reason VARCHAR(50) NOT NULL, -- 'auto_tune', 'user_manual', 'performance', 'feedback'
    performance_delta NUMERIC(5, 3), -- How much performance improved/declined
    samples_used INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_weight_history_tenant ON agi_weight_history(tenant_id);
CREATE INDEX idx_weight_history_type ON agi_weight_history(weight_type, weight_id);
CREATE INDEX idx_weight_history_created ON agi_weight_history(created_at DESC);

-- Create table for parameter defaults (user-adjustable with defaults)
CREATE TABLE IF NOT EXISTS agi_parameter_defaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    parameter_category VARCHAR(50) NOT NULL,
    parameter_name VARCHAR(100) NOT NULL,
    default_value NUMERIC(10, 4) NOT NULL,
    min_value NUMERIC(10, 4),
    max_value NUMERIC(10, 4),
    current_value NUMERIC(10, 4),
    auto_mode BOOLEAN DEFAULT true,
    user_override BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, parameter_category, parameter_name)
);

-- Insert global parameter defaults
INSERT INTO agi_parameter_defaults (tenant_id, parameter_category, parameter_name, default_value, min_value, max_value, current_value, description)
VALUES
-- Domain Detection Parameters
(NULL, 'domain_detection', 'min_confidence', 0.3, 0.0, 1.0, 0.3, 'Minimum confidence threshold for domain detection'),
(NULL, 'domain_detection', 'max_results', 5, 1, 20, 5, 'Maximum number of domain results to return'),
(NULL, 'domain_detection', 'cache_ttl_seconds', 300, 0, 3600, 300, 'Cache duration for domain detection results'),

-- Model Selection Parameters
(NULL, 'model_selection', 'min_match_score', 50, 0, 100, 50, 'Minimum model match score for selection'),
(NULL, 'model_selection', 'max_models', 5, 1, 20, 5, 'Maximum number of models to consider'),
(NULL, 'model_selection', 'cost_weight', 0.3, 0, 1, 0.3, 'Weight for cost in model scoring'),
(NULL, 'model_selection', 'quality_weight', 0.5, 0, 1, 0.5, 'Weight for quality in model scoring'),
(NULL, 'model_selection', 'latency_weight', 0.2, 0, 1, 0.2, 'Weight for latency in model scoring'),

-- Consciousness Parameters
(NULL, 'consciousness', 'global_workspace_cycles', 5, 1, 20, 5, 'Number of global workspace broadcast cycles'),
(NULL, 'consciousness', 'recurrence_depth', 3, 1, 10, 3, 'Depth of recurrent processing'),
(NULL, 'consciousness', 'phi_threshold', 0.5, 0, 1, 0.5, 'Integrated information (phi) threshold'),
(NULL, 'consciousness', 'self_model_update_rate', 0.1, 0, 1, 0.1, 'Rate of self-model updates'),

-- Ethics Parameters
(NULL, 'ethics', 'moral_concern_threshold', 0.7, 0, 1, 0.7, 'Threshold for flagging moral concerns'),
(NULL, 'ethics', 'principle_check_depth', 5, 1, 20, 5, 'Number of moral principles to evaluate'),
(NULL, 'ethics', 'escalation_threshold', 0.3, 0, 1, 0.3, 'Threshold for escalating to human review'),

-- Self-Improvement Parameters
(NULL, 'self_improvement', 'learning_rate', 0.15, 0, 1, 0.15, 'Rate of weight adjustment from feedback'),
(NULL, 'self_improvement', 'exploration_rate', 0.1, 0, 1, 0.1, 'Probability of trying non-optimal paths'),
(NULL, 'self_improvement', 'min_samples', 100, 10, 10000, 100, 'Minimum samples before auto-tuning'),
(NULL, 'self_improvement', 'tune_interval_hours', 24, 1, 168, 24, 'Hours between auto-tune cycles'),

-- Performance Parameters
(NULL, 'performance', 'default_timeout_ms', 10000, 1000, 60000, 10000, 'Default timeout for service calls'),
(NULL, 'performance', 'max_concurrent', 5, 1, 20, 5, 'Maximum concurrent service calls'),
(NULL, 'performance', 'cache_ttl_ms', 300000, 0, 3600000, 300000, 'Default cache TTL'),

-- Confidence Parameters
(NULL, 'confidence', 'min_for_action', 0.6, 0, 1, 0.6, 'Minimum confidence to take action'),
(NULL, 'confidence', 'high_threshold', 0.85, 0, 1, 0.85, 'Threshold for high confidence'),
(NULL, 'confidence', 'low_threshold', 0.4, 0, 1, 0.4, 'Threshold for low confidence warning')

ON CONFLICT (tenant_id, parameter_category, parameter_name) DO NOTHING;

-- Update existing service weights to auto mode
UPDATE agi_service_weights 
SET auto_mode = true, user_override = false 
WHERE tenant_id IS NULL;

-- Update consciousness weights to auto mode
UPDATE agi_consciousness_weights 
SET auto_mode = true, user_override = false 
WHERE tenant_id IS NULL;

-- Update decision weights to auto mode  
UPDATE agi_decision_weights 
SET auto_mode = true, user_override = false 
WHERE tenant_id IS NULL;
