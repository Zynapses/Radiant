-- Migration 155: Cato Mood Attribute Fixes
-- Fixes mood attributes to match Genesis Cato v2.3.1 specification
-- Version: 6.1.1

-- ============================================================================
-- PART 1: FIX MOOD ATTRIBUTES TO MATCH SPEC
-- ============================================================================

-- Fix SAGE mood: discovery should be 0.6 (was 0.8)
UPDATE genesis_personas 
SET drives = '{"curiosity": 0.7, "achievement": 0.8, "service": 0.8, "discovery": 0.6, "reflection": 0.9}'::jsonb,
    updated_at = NOW()
WHERE name = 'sage' AND scope = 'system';

-- Fix SPARK mood: achievement should be 0.5 (was 0.7), reflection should be 0.4 (was 0.6)
UPDATE genesis_personas 
SET drives = '{"curiosity": 0.85, "achievement": 0.5, "service": 0.6, "discovery": 0.75, "reflection": 0.4}'::jsonb,
    updated_at = NOW()
WHERE name = 'spark' AND scope = 'system';

-- Fix GUIDE mood: discovery should be 0.5 (was 0.7), reflection should be 0.7 (was 0.5)
UPDATE genesis_personas 
SET drives = '{"curiosity": 0.6, "achievement": 0.9, "service": 0.95, "discovery": 0.5, "reflection": 0.7}'::jsonb,
    updated_at = NOW()
WHERE name = 'guide' AND scope = 'system';

-- ============================================================================
-- PART 2: ADD TENANT DEFAULT PERSONA SUPPORT
-- ============================================================================

-- Add column for tenant-specific default persona override
ALTER TABLE cato_tenant_config 
ADD COLUMN IF NOT EXISTS default_mood VARCHAR(50) DEFAULT 'balanced';

-- Add comment for documentation
COMMENT ON COLUMN cato_tenant_config.default_mood IS 
'Tenant-specific default mood override. Must match a mood name (balanced, scout, sage, spark, guide). Default: balanced';

-- ============================================================================
-- PART 3: ADD API OVERRIDE SUPPORT TABLE
-- ============================================================================

-- Table to store API-level persona overrides (temporary, session-based)
CREATE TABLE IF NOT EXISTS cato_api_persona_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  persona_name VARCHAR(50) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  reason TEXT,
  UNIQUE(tenant_id, session_id)
);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_api_persona_overrides_session 
ON cato_api_persona_overrides(session_id, expires_at);

-- RLS policy
ALTER TABLE cato_api_persona_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_persona_overrides_access ON cato_api_persona_overrides USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

-- ============================================================================
-- PART 4: VERIFICATION
-- ============================================================================

-- Verify mood attributes are correct
DO $$
DECLARE
  balanced_drives JSONB;
  scout_drives JSONB;
  sage_drives JSONB;
  spark_drives JSONB;
  guide_drives JSONB;
BEGIN
  SELECT drives INTO balanced_drives FROM genesis_personas WHERE name = 'balanced' AND scope = 'system';
  SELECT drives INTO scout_drives FROM genesis_personas WHERE name = 'scout' AND scope = 'system';
  SELECT drives INTO sage_drives FROM genesis_personas WHERE name = 'sage' AND scope = 'system';
  SELECT drives INTO spark_drives FROM genesis_personas WHERE name = 'spark' AND scope = 'system';
  SELECT drives INTO guide_drives FROM genesis_personas WHERE name = 'guide' AND scope = 'system';
  
  -- Verify Balanced
  IF (balanced_drives->>'curiosity')::NUMERIC != 0.8 THEN
    RAISE EXCEPTION 'Balanced curiosity mismatch';
  END IF;
  
  -- Verify Sage
  IF (sage_drives->>'discovery')::NUMERIC != 0.6 THEN
    RAISE EXCEPTION 'Sage discovery mismatch: expected 0.6, got %', sage_drives->>'discovery';
  END IF;
  
  -- Verify Spark
  IF (spark_drives->>'achievement')::NUMERIC != 0.5 THEN
    RAISE EXCEPTION 'Spark achievement mismatch: expected 0.5, got %', spark_drives->>'achievement';
  END IF;
  IF (spark_drives->>'reflection')::NUMERIC != 0.4 THEN
    RAISE EXCEPTION 'Spark reflection mismatch: expected 0.4, got %', spark_drives->>'reflection';
  END IF;
  
  -- Verify Guide
  IF (guide_drives->>'discovery')::NUMERIC != 0.5 THEN
    RAISE EXCEPTION 'Guide discovery mismatch: expected 0.5, got %', guide_drives->>'discovery';
  END IF;
  IF (guide_drives->>'reflection')::NUMERIC != 0.7 THEN
    RAISE EXCEPTION 'Guide reflection mismatch: expected 0.7, got %', guide_drives->>'reflection';
  END IF;
  
  RAISE NOTICE 'All mood attributes verified successfully!';
END $$;
