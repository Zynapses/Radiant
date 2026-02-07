-- =============================================================================
-- RADIANT Cartridge PKI Migration
-- v6.1.0: Cryptographic signing and verification for .RADz cartridges
-- 
-- Security Architecture v8.0:
-- - Radiant Root CA → Tenant Intermediate CA → Cartridge Signatures
-- - Dual signatures: author_check (tenant) + platform_check (Radiant)
-- - SHA-256 hash + Ed25519 asymmetric encryption
-- - Federated trust for multi-cluster deployments
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

CREATE TYPE certificate_type AS ENUM ('root', 'intermediate', 'signing');
CREATE TYPE certificate_status AS ENUM ('active', 'revoked', 'expired', 'pending');
CREATE TYPE key_algorithm AS ENUM ('ed25519', 'rsa-pss-4096', 'ecdsa-p256');
CREATE TYPE signature_type AS ENUM ('author', 'platform');
CREATE TYPE pki_audit_action AS ENUM (
  'sign', 'verify', 'generate_ca', 'revoke', 
  'add_trust', 'remove_trust', 'rotate_key'
);

-- -----------------------------------------------------------------------------
-- Root CA Certificate
-- Generated at Genesis, stored offline/HSM
-- Signs all Tenant Intermediate CAs
-- -----------------------------------------------------------------------------

CREATE TABLE root_ca_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id VARCHAR(128) NOT NULL UNIQUE,
  cluster_name VARCHAR(256) NOT NULL,
  public_key TEXT NOT NULL,
  fingerprint VARCHAR(64) NOT NULL UNIQUE,
  algorithm key_algorithm NOT NULL DEFAULT 'ed25519',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,
  status certificate_status NOT NULL DEFAULT 'active',
  environment VARCHAR(32) NOT NULL DEFAULT 'production',
  region VARCHAR(64),
  version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_date_range CHECK (valid_until > valid_from)
);

CREATE INDEX idx_root_ca_status ON root_ca_certificates(status);
CREATE INDEX idx_root_ca_fingerprint ON root_ca_certificates(fingerprint);

-- -----------------------------------------------------------------------------
-- Tenant Intermediate CA Certificate
-- Signed by Root CA, stored in Genesis Vault (HSM)
-- Signs cartridges for this tenant
-- -----------------------------------------------------------------------------

CREATE TABLE tenant_ca_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_name VARCHAR(256) NOT NULL,
  root_ca_id UUID NOT NULL REFERENCES root_ca_certificates(id),
  public_key TEXT NOT NULL,
  fingerprint VARCHAR(64) NOT NULL UNIQUE,
  algorithm key_algorithm NOT NULL DEFAULT 'ed25519',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,
  status certificate_status NOT NULL DEFAULT 'active',
  signed_by_root_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  root_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  revoked_by UUID,
  
  CONSTRAINT valid_date_range CHECK (valid_until > valid_from)
);

CREATE INDEX idx_tenant_ca_tenant ON tenant_ca_certificates(tenant_id);
CREATE INDEX idx_tenant_ca_status ON tenant_ca_certificates(status);
CREATE INDEX idx_tenant_ca_fingerprint ON tenant_ca_certificates(fingerprint);
CREATE INDEX idx_tenant_ca_root ON tenant_ca_certificates(root_ca_id);

-- -----------------------------------------------------------------------------
-- Cartridge Signing Keys
-- Derived from Tenant CA, used for actual signing operations
-- -----------------------------------------------------------------------------

CREATE TABLE cartridge_signing_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_ca_id UUID NOT NULL REFERENCES tenant_ca_certificates(id),
  key_id VARCHAR(256) NOT NULL,
  key_arn VARCHAR(512),
  public_key TEXT NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  algorithm key_algorithm NOT NULL DEFAULT 'ed25519',
  purpose signature_type NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,
  status certificate_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  usage_count BIGINT NOT NULL DEFAULT 0,
  
  CONSTRAINT valid_date_range CHECK (valid_until > valid_from),
  CONSTRAINT unique_key_per_tenant_purpose UNIQUE (tenant_id, purpose, status)
);

CREATE INDEX idx_signing_keys_tenant ON cartridge_signing_keys(tenant_id);
CREATE INDEX idx_signing_keys_status ON cartridge_signing_keys(status);
CREATE INDEX idx_signing_keys_purpose ON cartridge_signing_keys(purpose);
CREATE INDEX idx_signing_keys_fingerprint ON cartridge_signing_keys(fingerprint);

-- -----------------------------------------------------------------------------
-- Cartridge Signatures
-- Records of all cartridge signing operations
-- -----------------------------------------------------------------------------

-- App compatibility enum
CREATE TYPE radiant_app AS ENUM (
  'radiant_admin',
  'thinktank_admin', 
  'thinktank',
  'curator',
  'service_layer'
);

CREATE TABLE cartridge_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_id UUID NOT NULL REFERENCES cartridges(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  content_hash VARCHAR(64) NOT NULL,
  hash_algorithm VARCHAR(16) NOT NULL DEFAULT 'sha256',
  
  author_signature TEXT NOT NULL,
  author_key_id UUID NOT NULL REFERENCES cartridge_signing_keys(id),
  author_signed_at TIMESTAMPTZ NOT NULL,
  
  platform_signature TEXT NOT NULL,
  platform_key_id VARCHAR(256) NOT NULL,
  platform_signed_at TIMESTAMPTZ NOT NULL,
  
  signature_version VARCHAR(16) NOT NULL DEFAULT '1.0',
  expires_at TIMESTAMPTZ,
  
  root_ca_fingerprint VARCHAR(64) NOT NULL,
  tenant_ca_fingerprint VARCHAR(64) NOT NULL,
  cluster_id VARCHAR(128) NOT NULL,
  
  -- Cluster compatibility (v6.1.0+)
  source_cluster_name VARCHAR(256),
  source_cluster_version VARCHAR(32),
  min_platform_version VARCHAR(32) NOT NULL DEFAULT '6.1.0',
  max_platform_version VARCHAR(32),
  compatible_apps radiant_app[] NOT NULL DEFAULT ARRAY['curator', 'thinktank', 'thinktank_admin']::radiant_app[],
  required_features TEXT[],
  environment VARCHAR(32) NOT NULL DEFAULT 'production',
  intended_tenant_ids UUID[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_signature_per_cartridge UNIQUE (cartridge_id)
);

CREATE INDEX idx_cartridge_signatures_cartridge ON cartridge_signatures(cartridge_id);
CREATE INDEX idx_cartridge_signatures_tenant ON cartridge_signatures(tenant_id);
CREATE INDEX idx_cartridge_signatures_hash ON cartridge_signatures(content_hash);
CREATE INDEX idx_cartridge_signatures_expires ON cartridge_signatures(expires_at) WHERE expires_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Trusted Root CAs (Federation)
-- Allows cross-cluster trust (e.g., "Radiant Defense" trusting "Radiant Commercial")
-- -----------------------------------------------------------------------------

CREATE TABLE trusted_root_cas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id VARCHAR(128) NOT NULL,
  cluster_name VARCHAR(256) NOT NULL,
  public_key TEXT NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trust_level VARCHAR(16) NOT NULL DEFAULT 'full',
  allowed_tenant_ids UUID[],
  notes TEXT,
  
  CONSTRAINT unique_trusted_root UNIQUE (cluster_id, fingerprint)
);

CREATE INDEX idx_trusted_roots_active ON trusted_root_cas(is_active) WHERE is_active = true;
CREATE INDEX idx_trusted_roots_fingerprint ON trusted_root_cas(fingerprint);
CREATE INDEX idx_trusted_roots_cluster ON trusted_root_cas(cluster_id);

-- -----------------------------------------------------------------------------
-- PKI Audit Log
-- All signing, verification, and certificate operations
-- -----------------------------------------------------------------------------

CREATE TABLE pki_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action pki_audit_action NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id UUID NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  performed_by UUID,
  performed_by_email VARCHAR(256),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  
  CONSTRAINT valid_target_type CHECK (
    target_type IN ('cartridge', 'tenant_ca', 'signing_key', 'trusted_root', 'root_ca')
  )
) PARTITION BY RANGE (performed_at);

CREATE TABLE pki_audit_log_2026_01 PARTITION OF pki_audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE pki_audit_log_2026_02 PARTITION OF pki_audit_log
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE pki_audit_log_2026_03 PARTITION OF pki_audit_log
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE pki_audit_log_2026_04 PARTITION OF pki_audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE pki_audit_log_2026_05 PARTITION OF pki_audit_log
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE pki_audit_log_2026_06 PARTITION OF pki_audit_log
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_pki_audit_action ON pki_audit_log(action);
CREATE INDEX idx_pki_audit_target ON pki_audit_log(target_type, target_id);
CREATE INDEX idx_pki_audit_tenant ON pki_audit_log(tenant_id);
CREATE INDEX idx_pki_audit_performed_at ON pki_audit_log(performed_at DESC);

-- -----------------------------------------------------------------------------
-- Signature Verification Cache
-- Cache verification results to avoid re-verification
-- -----------------------------------------------------------------------------

CREATE TABLE signature_verification_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash VARCHAR(64) NOT NULL,
  cartridge_id UUID REFERENCES cartridges(id) ON DELETE CASCADE,
  verification_status VARCHAR(32) NOT NULL,
  is_valid BOOLEAN NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  author_valid BOOLEAN NOT NULL,
  platform_valid BOOLEAN NOT NULL,
  hash_valid BOOLEAN NOT NULL,
  chain_valid BOOLEAN NOT NULL,
  errors TEXT[],
  warnings TEXT[],
  
  CONSTRAINT unique_verification UNIQUE (content_hash)
);

CREATE INDEX idx_verification_cache_hash ON signature_verification_cache(content_hash);
CREATE INDEX idx_verification_cache_expires ON signature_verification_cache(expires_at);
CREATE INDEX idx_verification_cache_cartridge ON signature_verification_cache(cartridge_id);

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION log_pki_operation(
  p_action pki_audit_action,
  p_target_type VARCHAR(32),
  p_target_id UUID,
  p_tenant_id UUID,
  p_performed_by UUID,
  p_performed_by_email VARCHAR(256),
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO pki_audit_log (
    action, target_type, target_id, tenant_id,
    performed_by, performed_by_email, success,
    error_message, details, ip_address, user_agent
  ) VALUES (
    p_action, p_target_type, p_target_id, p_tenant_id,
    p_performed_by, p_performed_by_email, p_success,
    p_error_message, p_details, p_ip_address, p_user_agent
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_signing_key_usage(
  p_key_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE cartridge_signing_keys
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = p_key_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_active_signing_key(
  p_tenant_id UUID,
  p_purpose signature_type
) RETURNS cartridge_signing_keys AS $$
DECLARE
  v_key cartridge_signing_keys;
BEGIN
  SELECT * INTO v_key
  FROM cartridge_signing_keys
  WHERE tenant_id = p_tenant_id
    AND purpose = p_purpose
    AND status = 'active'
    AND valid_from <= NOW()
    AND valid_until > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_key;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_cartridge_signature_valid(
  p_cartridge_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_cache signature_verification_cache;
BEGIN
  SELECT * INTO v_cache
  FROM signature_verification_cache
  WHERE cartridge_id = p_cartridge_id
    AND expires_at > NOW()
    AND is_valid = true
  LIMIT 1;
  
  RETURN v_cache.id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_verification_cache()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM signature_verification_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_pki_dashboard AS
SELECT
  (SELECT cluster_id FROM root_ca_certificates WHERE status = 'active' LIMIT 1) as root_cluster_id,
  (SELECT fingerprint FROM root_ca_certificates WHERE status = 'active' LIMIT 1) as root_fingerprint,
  (SELECT valid_until FROM root_ca_certificates WHERE status = 'active' LIMIT 1) as root_valid_until,
  (SELECT COUNT(*) FROM tenant_ca_certificates) as total_tenant_cas,
  (SELECT COUNT(*) FROM tenant_ca_certificates WHERE status = 'active') as active_tenant_cas,
  (SELECT COUNT(*) FROM tenant_ca_certificates WHERE status = 'active' AND valid_until < NOW() + INTERVAL '30 days') as expiring_tenant_cas,
  (SELECT COUNT(*) FROM tenant_ca_certificates WHERE status = 'revoked') as revoked_tenant_cas,
  (SELECT COUNT(*) FROM cartridge_signing_keys) as total_signing_keys,
  (SELECT COUNT(*) FROM cartridge_signing_keys WHERE status = 'active') as active_signing_keys,
  (SELECT COUNT(*) FROM cartridge_signing_keys WHERE last_used_at > NOW() - INTERVAL '1 day') as keys_used_today,
  (SELECT COUNT(*) FROM cartridge_signatures) as total_signatures,
  (SELECT COUNT(*) FROM cartridge_signatures WHERE created_at > NOW() - INTERVAL '1 day') as signatures_today,
  (SELECT COUNT(*) FROM pki_audit_log WHERE action = 'verify' AND performed_at > NOW() - INTERVAL '1 day') as verifications_today,
  (SELECT COUNT(*) FROM pki_audit_log WHERE action = 'verify' AND success = false AND performed_at > NOW() - INTERVAL '1 day') as failed_verifications_today,
  (SELECT COUNT(*) FROM trusted_root_cas) as total_trusted_roots,
  (SELECT COUNT(*) FROM trusted_root_cas WHERE is_active = true) as active_trusted_roots;

CREATE OR REPLACE VIEW v_tenant_signing_status AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  tc.id as tenant_ca_id,
  tc.fingerprint as tenant_ca_fingerprint,
  tc.status as tenant_ca_status,
  tc.valid_until as tenant_ca_expires,
  sk_author.id as author_key_id,
  sk_author.status as author_key_status,
  sk_author.usage_count as author_key_usage,
  sk_platform.id as platform_key_id,
  sk_platform.status as platform_key_status,
  (SELECT COUNT(*) FROM cartridge_signatures cs WHERE cs.tenant_id = t.id) as total_signed_cartridges
FROM tenants t
LEFT JOIN tenant_ca_certificates tc ON tc.tenant_id = t.id AND tc.status = 'active'
LEFT JOIN cartridge_signing_keys sk_author ON sk_author.tenant_id = t.id AND sk_author.purpose = 'author' AND sk_author.status = 'active'
LEFT JOIN cartridge_signing_keys sk_platform ON sk_platform.tenant_id = t.id AND sk_platform.purpose = 'platform' AND sk_platform.status = 'active';

-- -----------------------------------------------------------------------------
-- Extend cartridges table with signature reference
-- -----------------------------------------------------------------------------

ALTER TABLE cartridges ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false;
ALTER TABLE cartridges ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE cartridges ADD COLUMN IF NOT EXISTS signature_id UUID REFERENCES cartridge_signatures(id);

CREATE INDEX idx_cartridges_is_signed ON cartridges(is_signed) WHERE is_signed = true;

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE root_ca_certificates IS 'Radiant Root CA certificates - generated at Genesis, signs all Tenant CAs';
COMMENT ON TABLE tenant_ca_certificates IS 'Tenant Intermediate CA certificates - signed by Root CA, signs cartridges';
COMMENT ON TABLE cartridge_signing_keys IS 'Active signing keys for cartridge operations';
COMMENT ON TABLE cartridge_signatures IS 'Complete signature records for signed cartridges';
COMMENT ON TABLE trusted_root_cas IS 'Federated trust - external Root CAs we trust';
COMMENT ON TABLE pki_audit_log IS 'Audit trail for all PKI operations';
COMMENT ON TABLE signature_verification_cache IS 'Cache for verification results';

COMMENT ON FUNCTION log_pki_operation IS 'Log a PKI operation to the audit trail';
COMMENT ON FUNCTION increment_signing_key_usage IS 'Increment usage counter for a signing key';
COMMENT ON FUNCTION get_active_signing_key IS 'Get the active signing key for a tenant and purpose';
COMMENT ON FUNCTION is_cartridge_signature_valid IS 'Check if a cartridge has a valid cached signature';
