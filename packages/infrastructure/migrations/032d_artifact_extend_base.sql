-- ============================================================================
-- RADIANT Artifact Engine - Extend Base Artifacts Table
-- Migration: 032d_artifact_extend_base.sql
-- Version: 4.19.0
-- Depends On: 032_canvas_artifacts.sql, 032b_artifact_genui_engine.sql
-- 
-- Adds GenUI-specific columns to the existing artifacts table and creates
-- the foreign key relationship to generation sessions.
-- ============================================================================

-- Add GenUI columns to existing artifacts table
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS 
    generation_session_id UUID REFERENCES artifact_generation_sessions(id) ON DELETE SET NULL;

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS 
    verification_status VARCHAR(20) DEFAULT 'manual';
    -- Verification status values:
    -- 'manual'     - User-created artifact (not AI-generated)
    -- 'unverified' - AI-generated, validation in progress
    -- 'validated'  - AI-generated, passed Cato CBFs
    -- 'rejected'   - AI-generated, failed Cato CBFs

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS 
    verification_timestamp TIMESTAMPTZ;

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS 
    cato_validation_result JSONB;

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS 
    reflexion_count INTEGER DEFAULT 0;

-- Add index for generation session lookups
CREATE INDEX IF NOT EXISTS idx_artifacts_gen_session 
    ON artifacts(generation_session_id);

-- Add foreign key from sessions back to artifacts
ALTER TABLE artifact_generation_sessions 
    ADD CONSTRAINT fk_artifact_gen_session_artifact 
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL;

-- Update artifact_type enum to include 'react'
-- 'react' type indicates a live React component (vs 'code' which is display-only)
COMMENT ON COLUMN artifacts.artifact_type IS 
    'Valid types: code, react, markdown, mermaid, html, svg, json, table';
