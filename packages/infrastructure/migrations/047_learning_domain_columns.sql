-- Migration 047: Add domain taxonomy columns to learning_interactions
-- RADIANT v4.18.0 - Domain-aware learning tracking

-- Add domain detection columns to learning_interactions
ALTER TABLE learning_interactions 
ADD COLUMN IF NOT EXISTS detected_domain_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS detected_subspecialty_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS domain_detection_confidence NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS domain_match_score NUMERIC(5, 2);

-- Add indexes for domain-based queries
CREATE INDEX IF NOT EXISTS idx_learning_interactions_domain 
ON learning_interactions(detected_domain_id) 
WHERE detected_domain_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learning_interactions_subspecialty 
ON learning_interactions(detected_subspecialty_id) 
WHERE detected_subspecialty_id IS NOT NULL;

-- Add domain columns to specialty insights view refresh
-- (This will be used by the learning analytics)
