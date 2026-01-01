-- Migration 046: Add domain taxonomy columns to brain_routing_history
-- RADIANT v4.18.0 - Domain-aware routing tracking

-- Add domain detection columns to brain_routing_history
ALTER TABLE brain_routing_history 
ADD COLUMN IF NOT EXISTS detected_domain_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS domain_match_score NUMERIC(5, 2);

-- Add index for domain-based queries
CREATE INDEX IF NOT EXISTS idx_brain_history_domain 
ON brain_routing_history(detected_domain_id) 
WHERE detected_domain_id IS NOT NULL;

-- Add prompt column for domain detection (store hash only for privacy)
ALTER TABLE brain_routing_history
ADD COLUMN IF NOT EXISTS prompt_hash VARCHAR(64);

-- Add domain columns to auto_resolve_requests
ALTER TABLE auto_resolve_requests
ADD COLUMN IF NOT EXISTS detected_domain_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS domain_match_score NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS domain_detection_confidence NUMERIC(3, 2);
