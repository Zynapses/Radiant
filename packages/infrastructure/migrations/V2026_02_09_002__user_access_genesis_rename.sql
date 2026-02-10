-- ============================================================================
-- User Access Column Rename Migration
-- Renames has_access_genesis → has_access_omega_lab in users table
-- Part of subsystem naming audit: Genesis App → OMEGA Lab
-- ============================================================================

-- Rename the column
ALTER TABLE users RENAME COLUMN has_access_genesis TO has_access_omega_lab;

-- Update any check constraints that reference the old column name
-- (PostgreSQL auto-updates column references in constraints, but not names)

-- Create backward-compatible alias for any code not yet updated
CREATE OR REPLACE VIEW users_genesis_compat AS
  SELECT *, has_access_omega_lab AS has_access_genesis FROM users;

COMMENT ON VIEW users_genesis_compat IS 'Backward compatibility view — use has_access_omega_lab column instead';
