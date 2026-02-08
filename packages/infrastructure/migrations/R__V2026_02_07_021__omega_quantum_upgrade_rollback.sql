-- ROLLBACK: V2026_02_07_021__omega_quantum_upgrade.sql
-- Reverts all schema changes from the OMEGA Quantum Architecture upgrade.
-- Run this ONLY if you need to fully undo the quantum upgrade.

-- 1. Drop new tables
DROP TABLE IF EXISTS omega_unitarity_events CASCADE;
DROP TABLE IF EXISTS omega_measurements CASCADE;

-- 2. Remove new columns from omega_brains
ALTER TABLE omega_brains
  DROP COLUMN IF EXISTS hilbert_dimension,
  DROP COLUMN IF EXISTS last_unitarity_check,
  DROP COLUMN IF EXISTS last_norm_value,
  DROP COLUMN IF EXISTS unitarity_corrections_count,
  DROP COLUMN IF EXISTS active_firmware_id,
  DROP COLUMN IF EXISTS firmware_hash;

-- 3. Remove new columns from omega_firmware
ALTER TABLE omega_firmware
  DROP COLUMN IF EXISTS hilbert_dimension,
  DROP COLUMN IF EXISTS unitarity_mode,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS content_hash,
  DROP COLUMN IF EXISTS is_verified,
  DROP COLUMN IF EXISTS signed_by,
  DROP COLUMN IF EXISTS superseded_by;

-- 4. Revert column renames
ALTER TABLE omega_firmware RENAME COLUMN quantum TO physics;

ALTER TABLE omega_helix_rules RENAME COLUMN forbidden_state_real TO phase_vector_real;
ALTER TABLE omega_helix_rules RENAME COLUMN forbidden_state_imaginary TO phase_vector_imaginary;
ALTER TABLE omega_helix_rules DROP COLUMN IF EXISTS forbidden_state_norm;

-- Manual cleanup (not SQL):
-- rm -rf lambda/shared/services/omega/
-- rm lambda/admin/omega-firmware.ts lambda/admin/omega-quantum.ts
-- rm -rf apps/admin-dashboard/app/(dashboard)/omega/
