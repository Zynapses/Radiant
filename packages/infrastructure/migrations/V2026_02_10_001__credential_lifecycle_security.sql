-- ============================================================================
-- V2026_02_10_001 — Credential Lifecycle Security Framework
--
-- Adds IP/origin restrictions, KMS envelope encryption support,
-- dormant key tracking, and rotation lineage to api_keys.
--
-- @version 1.0.0
-- @since RADIANT v4.18.0
-- ============================================================================

-- 1. Add IP allowlisting (optional per-key restriction)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS allowed_ips JSONB DEFAULT NULL;
COMMENT ON COLUMN api_keys.allowed_ips IS 'Optional JSON array of allowed CIDR ranges, e.g. ["10.0.0.0/8","203.0.113.5/32"]. NULL = unrestricted.';

-- 2. Add origin restrictions (for browser-facing keys)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS allowed_origins JSONB DEFAULT NULL;
COMMENT ON COLUMN api_keys.allowed_origins IS 'Optional JSON array of allowed HTTP origins, e.g. ["https://app.example.com"]. NULL = unrestricted.';

-- 3. Add KMS encryption envelope for key_hash (column-level encryption reference)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS encryption_key_id VARCHAR(128) DEFAULT NULL;
COMMENT ON COLUMN api_keys.encryption_key_id IS 'KMS key ID used for envelope encryption of this API key hash. NULL = platform default key.';

-- 4. Add dormant tracking
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS dormant_flagged_at TIMESTAMPTZ DEFAULT NULL;
COMMENT ON COLUMN api_keys.dormant_flagged_at IS 'Timestamp when this key was first flagged as dormant (unused >30 days).';

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS dormant_warning_level VARCHAR(10) DEFAULT NULL
  CHECK (dormant_warning_level IN ('30d', '45d', '60d'));
COMMENT ON COLUMN api_keys.dormant_warning_level IS 'Current dormant warning level: 30d, 45d, or 60d (auto-disabled).';

-- 5. Add rotation lineage
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS replaced_by_key_id UUID REFERENCES api_keys(id) DEFAULT NULL;
COMMENT ON COLUMN api_keys.replaced_by_key_id IS 'Points to the successor key if this key was auto-rotated.';

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS replaces_key_id UUID REFERENCES api_keys(id) DEFAULT NULL;
COMMENT ON COLUMN api_keys.replaces_key_id IS 'Points to the predecessor key this key replaced via auto-rotation.';

-- 6. Add default expiry policy column for tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS api_key_default_expiry_days INTEGER DEFAULT 90;
COMMENT ON COLUMN tenants.api_key_default_expiry_days IS 'Default expiry in days for new API keys created by this tenant. NULL = no expiry.';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS api_key_max_expiry_days INTEGER DEFAULT 365;
COMMENT ON COLUMN tenants.api_key_max_expiry_days IS 'Maximum allowed expiry for API keys. Enforced on creation.';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS require_api_key_ip_restriction BOOLEAN DEFAULT false;
COMMENT ON COLUMN tenants.require_api_key_ip_restriction IS 'If true, all new API keys must have allowed_ips set.';

-- 7. Index for dormant key queries
CREATE INDEX IF NOT EXISTS idx_api_keys_dormant
  ON api_keys (last_used_at, is_active)
  WHERE is_active = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_expiring
  ON api_keys (expires_at, is_active)
  WHERE is_active = true AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_rotation_lineage
  ON api_keys (replaced_by_key_id)
  WHERE replaced_by_key_id IS NOT NULL;

-- 8. Function: validate API key with IP/origin restrictions
CREATE OR REPLACE FUNCTION validate_api_key_with_restrictions(
  p_key_hash VARCHAR,
  p_interface_type VARCHAR,
  p_endpoint VARCHAR DEFAULT NULL,
  p_source_ip VARCHAR DEFAULT NULL,
  p_origin VARCHAR DEFAULT NULL
) RETURNS TABLE (
  is_valid BOOLEAN,
  key_id UUID,
  tenant_id UUID,
  scopes TEXT[],
  expires_at TIMESTAMPTZ,
  error_code VARCHAR,
  error_message TEXT
) AS $$
DECLARE
  v_key RECORD;
BEGIN
  -- Find the key
  SELECT * INTO v_key FROM api_keys
  WHERE key_hash = p_key_hash AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::TEXT[], NULL::TIMESTAMPTZ,
      'INVALID_KEY'::VARCHAR, 'API key not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Check expiration
  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < NOW() THEN
    RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, v_key.expires_at,
      'KEY_EXPIRED'::VARCHAR, 'API key has expired'::TEXT;
    RETURN;
  END IF;

  -- Check interface type
  IF v_key.interface_type != 'all' AND v_key.interface_type != p_interface_type THEN
    RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, v_key.expires_at,
      'INTERFACE_DENIED'::VARCHAR, format('Key not authorized for %s interface', p_interface_type)::TEXT;
    RETURN;
  END IF;

  -- Check IP restriction
  IF p_source_ip IS NOT NULL AND v_key.allowed_ips IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_key.allowed_ips) AS cidr
      WHERE inet(p_source_ip) <<= inet(cidr)
    ) THEN
      RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, v_key.expires_at,
        'IP_DENIED'::VARCHAR, format('Source IP %s is not in allowed list', p_source_ip)::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Check origin restriction
  IF p_origin IS NOT NULL AND v_key.allowed_origins IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_key.allowed_origins) AS allowed
      WHERE p_origin = allowed
    ) THEN
      RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, v_key.expires_at,
        'ORIGIN_DENIED'::VARCHAR, format('Origin %s is not in allowed list', p_origin)::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Check endpoint restrictions
  IF p_endpoint IS NOT NULL THEN
    IF v_key.denied_endpoints IS NOT NULL AND p_endpoint = ANY(v_key.denied_endpoints) THEN
      RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, v_key.expires_at,
        'ENDPOINT_DENIED'::VARCHAR, format('Endpoint %s is explicitly denied', p_endpoint)::TEXT;
      RETURN;
    END IF;

    IF v_key.allowed_endpoints IS NOT NULL AND array_length(v_key.allowed_endpoints, 1) > 0 THEN
      IF NOT p_endpoint = ANY(v_key.allowed_endpoints) THEN
        RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, v_key.expires_at,
          'ENDPOINT_DENIED'::VARCHAR, format('Endpoint %s is not in allowed list', p_endpoint)::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Update usage
  UPDATE api_keys SET
    last_used_at = NOW(),
    use_count = use_count + 1,
    dormant_flagged_at = NULL,
    dormant_warning_level = NULL,
    updated_at = NOW()
  WHERE id = v_key.id;

  -- Success
  RETURN QUERY SELECT true, v_key.id, v_key.tenant_id, v_key.scopes, v_key.expires_at,
    NULL::VARCHAR, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 9. Function: self-service key rotation
CREATE OR REPLACE FUNCTION rotate_api_key(
  p_old_key_id UUID,
  p_new_key_prefix VARCHAR,
  p_new_key_hash VARCHAR,
  p_new_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  new_key_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_old_key RECORD;
  v_new_id UUID;
  v_default_expiry INTEGER;
BEGIN
  -- Find old key
  SELECT * INTO v_old_key FROM api_keys WHERE id = p_old_key_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Original key not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Get tenant default expiry
  SELECT api_key_default_expiry_days INTO v_default_expiry
  FROM tenants WHERE id = v_old_key.tenant_id;

  -- Create new key inheriting permissions
  INSERT INTO api_keys (
    tenant_id, name, key_prefix, key_hash,
    interface_type, scopes, allowed_endpoints, denied_endpoints,
    allowed_ips, allowed_origins,
    rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
    is_active, expires_at,
    created_by, created_by_app,
    replaces_key_id, metadata
  ) VALUES (
    v_old_key.tenant_id,
    v_old_key.name || ' (rotated)',
    p_new_key_prefix,
    p_new_key_hash,
    v_old_key.interface_type,
    v_old_key.scopes,
    v_old_key.allowed_endpoints,
    v_old_key.denied_endpoints,
    v_old_key.allowed_ips,
    v_old_key.allowed_origins,
    v_old_key.rate_limit_per_minute,
    v_old_key.rate_limit_per_hour,
    v_old_key.rate_limit_per_day,
    true,
    COALESCE(p_new_expires_at, NOW() + (COALESCE(v_default_expiry, 90) || ' days')::INTERVAL),
    v_old_key.created_by,
    'api',
    p_old_key_id,
    jsonb_build_object('rotation_type', 'self_service', 'rotated_at', NOW()::text)
  )
  RETURNING id INTO v_new_id;

  -- Link old key to new
  UPDATE api_keys SET replaced_by_key_id = v_new_id, updated_at = NOW()
  WHERE id = p_old_key_id;

  -- Log audit event
  INSERT INTO api_key_audit_log (tenant_id, key_id, action, details)
  VALUES (
    v_old_key.tenant_id,
    p_old_key_id,
    'updated',
    jsonb_build_object(
      'action', 'self_service_rotation',
      'new_key_id', v_new_id::text,
      'new_key_prefix', p_new_key_prefix
    )
  );

  RETURN QUERY SELECT true, v_new_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;
