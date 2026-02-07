-- Migration 117: Sleep Schedule Configuration
-- Add configurable sleep cycle schedule to consciousness_parameters

-- Add sleep schedule columns to consciousness_parameters
ALTER TABLE consciousness_parameters
ADD COLUMN IF NOT EXISTS sleep_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sleep_schedule_hour INTEGER DEFAULT 3 CHECK (sleep_schedule_hour >= 0 AND sleep_schedule_hour <= 23),
ADD COLUMN IF NOT EXISTS sleep_schedule_minute INTEGER DEFAULT 0 CHECK (sleep_schedule_minute >= 0 AND sleep_schedule_minute <= 59),
ADD COLUMN IF NOT EXISTS sleep_timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS sleep_frequency TEXT DEFAULT 'nightly' CHECK (sleep_frequency IN ('nightly', 'weekly', 'manual')),
ADD COLUMN IF NOT EXISTS sleep_weekly_day INTEGER DEFAULT 0 CHECK (sleep_weekly_day >= 0 AND sleep_weekly_day <= 6),
ADD COLUMN IF NOT EXISTS last_sleep_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_sleep_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sleep_duration_limit_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS sleep_config JSONB DEFAULT '{}'::jsonb;

-- Create index for efficient lookup of next scheduled sleep
CREATE INDEX IF NOT EXISTS idx_consciousness_params_next_sleep 
ON consciousness_parameters(next_sleep_at) 
WHERE sleep_enabled = true;

-- Create sleep cycle history table
CREATE TABLE IF NOT EXISTS consciousness_sleep_history (
    sleep_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    
    -- What was processed
    monologues_generated INTEGER DEFAULT 0,
    dreams_generated INTEGER DEFAULT 0,
    memories_consolidated INTEGER DEFAULT 0,
    identity_updates INTEGER DEFAULT 0,
    critic_challenges INTEGER DEFAULT 0,
    
    -- Results
    plasticity_delta NUMERIC(5,4) DEFAULT 0,
    evolution_triggered BOOLEAN DEFAULT false,
    lora_training_started BOOLEAN DEFAULT false,
    
    -- Errors and logs
    error_message TEXT,
    processing_log JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for sleep history
ALTER TABLE consciousness_sleep_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_sleep_history_tenant_isolation ON consciousness_sleep_history
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_sleep_history_tenant ON consciousness_sleep_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sleep_history_started ON consciousness_sleep_history(started_at DESC);

-- Function to calculate next sleep time based on configuration
CREATE OR REPLACE FUNCTION calculate_next_sleep_time(
    p_frequency TEXT,
    p_hour INTEGER,
    p_minute INTEGER,
    p_timezone TEXT,
    p_weekly_day INTEGER
) RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_now TIMESTAMPTZ;
    v_next TIMESTAMPTZ;
    v_target_time TIME;
BEGIN
    v_now := NOW() AT TIME ZONE p_timezone;
    v_target_time := make_time(p_hour, p_minute, 0);
    
    IF p_frequency = 'nightly' THEN
        -- Next occurrence at target time
        v_next := date_trunc('day', v_now) + v_target_time;
        IF v_next <= v_now THEN
            v_next := v_next + INTERVAL '1 day';
        END IF;
    ELSIF p_frequency = 'weekly' THEN
        -- Next occurrence on target day at target time
        v_next := date_trunc('week', v_now) + (p_weekly_day || ' days')::INTERVAL + v_target_time;
        IF v_next <= v_now THEN
            v_next := v_next + INTERVAL '1 week';
        END IF;
    ELSE
        -- Manual mode - no automatic scheduling
        v_next := NULL;
    END IF;
    
    RETURN v_next AT TIME ZONE p_timezone AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql;

-- Trigger to update next_sleep_at when schedule changes
CREATE OR REPLACE FUNCTION update_next_sleep_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sleep_enabled THEN
        NEW.next_sleep_at := calculate_next_sleep_time(
            NEW.sleep_frequency,
            NEW.sleep_schedule_hour,
            NEW.sleep_schedule_minute,
            NEW.sleep_timezone,
            NEW.sleep_weekly_day
        );
    ELSE
        NEW.next_sleep_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consciousness_params_sleep_schedule ON consciousness_parameters;
CREATE TRIGGER consciousness_params_sleep_schedule
    BEFORE INSERT OR UPDATE OF sleep_enabled, sleep_frequency, sleep_schedule_hour, sleep_schedule_minute, sleep_timezone, sleep_weekly_day
    ON consciousness_parameters
    FOR EACH ROW
    EXECUTE FUNCTION update_next_sleep_time();

-- Update existing rows to set next_sleep_at
UPDATE consciousness_parameters
SET next_sleep_at = calculate_next_sleep_time(
    COALESCE(sleep_frequency, 'nightly'),
    COALESCE(sleep_schedule_hour, 3),
    COALESCE(sleep_schedule_minute, 0),
    COALESCE(sleep_timezone, 'UTC'),
    COALESCE(sleep_weekly_day, 0)
)
WHERE sleep_enabled IS NOT FALSE;

COMMENT ON COLUMN consciousness_parameters.sleep_enabled IS 'Enable/disable automatic sleep cycles';
COMMENT ON COLUMN consciousness_parameters.sleep_schedule_hour IS 'Hour to run sleep cycle (0-23, in sleep_timezone)';
COMMENT ON COLUMN consciousness_parameters.sleep_schedule_minute IS 'Minute to run sleep cycle (0-59)';
COMMENT ON COLUMN consciousness_parameters.sleep_timezone IS 'Timezone for sleep schedule (e.g., UTC, America/New_York)';
COMMENT ON COLUMN consciousness_parameters.sleep_frequency IS 'How often to run: nightly, weekly, or manual';
COMMENT ON COLUMN consciousness_parameters.sleep_weekly_day IS 'Day of week for weekly schedule (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN consciousness_parameters.last_sleep_at IS 'When the last sleep cycle completed';
COMMENT ON COLUMN consciousness_parameters.next_sleep_at IS 'When the next sleep cycle is scheduled';
COMMENT ON COLUMN consciousness_parameters.sleep_duration_limit_minutes IS 'Maximum duration for sleep cycle before timeout';
COMMENT ON COLUMN consciousness_parameters.sleep_config IS 'Additional sleep cycle configuration (JSON)';
