-- ============================================================================
-- RADIANT Mission Control MCP Hybrid Interface
-- Migration: V2026_01_08_001__hybrid_protocols.sql
-- Version: 4.20.0
-- Date: January 8, 2026
-- ============================================================================

-- ============================================================================
-- PART 1: ADD MCP HYBRID PROTOCOL COLUMNS TO DOMAIN CONFIG
-- ============================================================================

-- Add model_interface_protocol column for MCP/API selection
ALTER TABLE decision_domain_config
ADD COLUMN IF NOT EXISTS model_interface_protocol VARCHAR(20) DEFAULT 'hybrid'
  CHECK (model_interface_protocol IN ('mcp_only', 'api_only', 'hybrid'));

-- Add MCP server endpoint for SSE transport
ALTER TABLE decision_domain_config
ADD COLUMN IF NOT EXISTS mcp_server_endpoint VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN decision_domain_config.model_interface_protocol IS 
  'Protocol preference: hybrid (MCP first, failover to API), mcp_only (strict MCP), api_only (LiteLLM only)';

COMMENT ON COLUMN decision_domain_config.mcp_server_endpoint IS 
  'SSE endpoint for MCP gateway when using MCP protocol';

-- ============================================================================
-- PART 2: UPDATE DEFAULT DOMAIN CONFIGURATIONS WITH PROTOCOL DEFAULTS
-- ============================================================================

-- Medical domain: hybrid by default for maximum flexibility
UPDATE decision_domain_config 
SET model_interface_protocol = 'hybrid'
WHERE domain = 'medical' AND model_interface_protocol IS NULL;

-- Financial domain: hybrid by default
UPDATE decision_domain_config 
SET model_interface_protocol = 'hybrid'
WHERE domain = 'financial' AND model_interface_protocol IS NULL;

-- Legal domain: hybrid by default
UPDATE decision_domain_config 
SET model_interface_protocol = 'hybrid'
WHERE domain = 'legal' AND model_interface_protocol IS NULL;

-- General domain: hybrid by default
UPDATE decision_domain_config 
SET model_interface_protocol = 'hybrid'
WHERE domain = 'general' AND model_interface_protocol IS NULL;

-- ============================================================================
-- PART 3: CREATE INDEX FOR PROTOCOL LOOKUPS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_domain_config_protocol 
  ON decision_domain_config(model_interface_protocol);

-- ============================================================================
-- PART 4: MIGRATION LOG
-- ============================================================================

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('V2026_01_08_001', 'Mission Control MCP Hybrid Interface v4.20.0', NOW())
ON CONFLICT DO NOTHING;
