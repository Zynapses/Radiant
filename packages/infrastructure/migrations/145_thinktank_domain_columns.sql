-- Migration 048: Add domain taxonomy columns to Think Tank tables
-- RADIANT v4.18.0 - Think Tank domain taxonomy integration

-- Add domain detection columns to thinktank_conversations
ALTER TABLE thinktank_conversations 
ADD COLUMN IF NOT EXISTS detected_field_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS detected_domain_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS detected_subspecialty_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS domain_detection_confidence NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS domain_proficiency_match NUMERIC(5, 2);

-- Add indexes for domain-based queries
CREATE INDEX IF NOT EXISTS idx_thinktank_conversations_domain 
ON thinktank_conversations(detected_domain_id) 
WHERE detected_domain_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_thinktank_conversations_field 
ON thinktank_conversations(detected_field_id) 
WHERE detected_field_id IS NOT NULL;

-- Add domain taxonomy preferences to user model preferences
ALTER TABLE thinktank_user_model_preferences
ADD COLUMN IF NOT EXISTS enable_domain_detection BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS default_field_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS default_domain_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS default_subspecialty_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS domain_model_overrides JSONB DEFAULT '{}';

-- Add domain detection to thinktank_messages for per-message tracking
ALTER TABLE thinktank_messages
ADD COLUMN IF NOT EXISTS detected_domain_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS domain_proficiency_match NUMERIC(5, 2);

-- Add domain columns to thinktank_sessions (for Think Tank reasoning sessions)
ALTER TABLE thinktank_sessions
ADD COLUMN IF NOT EXISTS detected_field_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS detected_domain_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS detected_subspecialty_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS domain_detection_confidence NUMERIC(3, 2);
