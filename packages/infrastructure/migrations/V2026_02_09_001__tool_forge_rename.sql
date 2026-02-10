-- ============================================================================
-- Tool Forge Rename Migration
-- Renames genesis_tool_requests → tool_forge_requests
-- Renames genesis_tool_results → tool_forge_results
-- Part of subsystem naming audit: Genesis Auto-Tool → Tool Forge
-- ============================================================================

-- Rename tables
ALTER TABLE IF EXISTS genesis_tool_requests RENAME TO tool_forge_requests;
ALTER TABLE IF EXISTS genesis_tool_results RENAME TO tool_forge_results;

-- Rename indexes (PostgreSQL auto-renames constraints but not indexes)
ALTER INDEX IF EXISTS idx_genesis_requests_tenant RENAME TO idx_tool_forge_requests_tenant;
ALTER INDEX IF EXISTS idx_genesis_requests_user RENAME TO idx_tool_forge_requests_user;
ALTER INDEX IF EXISTS idx_genesis_requests_status RENAME TO idx_tool_forge_requests_status;
ALTER INDEX IF EXISTS idx_genesis_requests_created RENAME TO idx_tool_forge_requests_created;
ALTER INDEX IF EXISTS idx_genesis_results_request RENAME TO idx_tool_forge_results_request;
ALTER INDEX IF EXISTS idx_genesis_results_tool RENAME TO idx_tool_forge_results_tool;
ALTER INDEX IF EXISTS idx_genesis_results_deployed RENAME TO idx_tool_forge_results_deployed;

-- Rename RLS policies
ALTER POLICY IF EXISTS genesis_requests_tenant_isolation ON tool_forge_requests RENAME TO tool_forge_requests_tenant_isolation;
ALTER POLICY IF EXISTS genesis_results_tenant_isolation ON tool_forge_results RENAME TO tool_forge_results_tenant_isolation;

-- Create backward-compatible views for any code that hasn't been updated yet
CREATE OR REPLACE VIEW genesis_tool_requests AS SELECT * FROM tool_forge_requests;
CREATE OR REPLACE VIEW genesis_tool_results AS SELECT * FROM tool_forge_results;

COMMENT ON VIEW genesis_tool_requests IS 'Backward compatibility view — use tool_forge_requests instead';
COMMENT ON VIEW genesis_tool_results IS 'Backward compatibility view — use tool_forge_results instead';
