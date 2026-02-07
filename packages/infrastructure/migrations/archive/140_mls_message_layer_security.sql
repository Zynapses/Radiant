-- ============================================================================
-- RADIANT v6.5.0 - MLS (Message Layer Security) RFC 9420
-- Migration: 140_mls_message_layer_security.sql
-- 
-- Implements group encryption for agent-to-agent communication with:
-- - Forward secrecy through epoch-based key ratcheting
-- - Post-compromise security via key updates
-- - Efficient group key agreement using X25519
-- - Authenticated encryption with AES-256-GCM
-- ============================================================================

-- Cipher suite enum
CREATE TYPE mls_cipher_suite AS ENUM (
  'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
  'MLS_256_DHKEMP384_AES256GCM_SHA384_P384'
);

-- Member type enum
CREATE TYPE mls_member_type AS ENUM ('agent', 'service', 'user');

-- Proposal type enum
CREATE TYPE mls_proposal_type AS ENUM ('add', 'remove', 'update', 'reinit');

-- Content type enum
CREATE TYPE mls_content_type AS ENUM ('application', 'proposal', 'commit');

-- ============================================================================
-- Key Packages Table
-- ============================================================================
-- Key packages are credentials that members use to join groups
-- Contains X25519 public key for ECDH and Ed25519 for signatures

CREATE TABLE mls_key_packages (
  key_package_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id VARCHAR(128) NOT NULL,
  member_type mls_member_type NOT NULL,
  
  -- Cryptographic keys (Base64 encoded)
  public_key TEXT NOT NULL,              -- X25519 public key for ECDH
  signature_key TEXT NOT NULL,           -- Ed25519 public key for signatures
  private_key_encrypted TEXT NOT NULL,   -- Encrypted X25519 private key
  sig_private_key_encrypted TEXT NOT NULL, -- Encrypted Ed25519 private key
  
  -- Identity
  credential TEXT NOT NULL,              -- Member credential/identity claim
  cipher_suite mls_cipher_suite NOT NULL DEFAULT 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  
  -- Indexes will be created below
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_mls_key_packages_member ON mls_key_packages(member_id);
CREATE INDEX idx_mls_key_packages_active ON mls_key_packages(member_id, expires_at) 
  WHERE revoked_at IS NULL;

-- ============================================================================
-- MLS Groups Table
-- ============================================================================
-- Groups are the core unit of encrypted communication

CREATE TABLE mls_groups (
  group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(256) NOT NULL,
  
  -- MLS State
  cipher_suite mls_cipher_suite NOT NULL DEFAULT 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
  epoch INTEGER NOT NULL DEFAULT 0,
  tree_hash VARCHAR(64) NOT NULL,        -- SHA-256 of ratchet tree
  
  -- Group secrets (encrypted)
  confirmation_key TEXT NOT NULL,        -- For confirming commits
  group_secret_encrypted TEXT NOT NULL,  -- Encrypted group secret
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  CONSTRAINT valid_epoch CHECK (epoch >= 0)
);

CREATE INDEX idx_mls_groups_tenant ON mls_groups(tenant_id);
CREATE INDEX idx_mls_groups_active ON mls_groups(tenant_id, expires_at) 
  WHERE expires_at IS NULL OR expires_at > NOW();

-- ============================================================================
-- Group Members Table
-- ============================================================================
-- Tracks membership in groups with leaf indices for the ratchet tree

CREATE TABLE mls_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
  member_id VARCHAR(128) NOT NULL,
  member_type mls_member_type NOT NULL,
  
  -- Key material
  key_package_id UUID NOT NULL REFERENCES mls_key_packages(key_package_id),
  public_key TEXT NOT NULL,
  
  -- Tree position
  leaf_index INTEGER NOT NULL,
  
  -- Membership lifecycle
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by VARCHAR(128) NOT NULL,
  removed_at TIMESTAMPTZ,
  removed_by VARCHAR(128),
  
  CONSTRAINT unique_member_in_group UNIQUE (group_id, member_id, removed_at),
  CONSTRAINT valid_leaf_index CHECK (leaf_index >= 0)
);

CREATE INDEX idx_mls_members_group ON mls_group_members(group_id);
CREATE INDEX idx_mls_members_member ON mls_group_members(member_id);
CREATE INDEX idx_mls_members_active ON mls_group_members(group_id, member_id) 
  WHERE removed_at IS NULL;

-- ============================================================================
-- Commits Table
-- ============================================================================
-- Commits are proposals that have been accepted and change group state

CREATE TABLE mls_commits (
  commit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
  epoch INTEGER NOT NULL,
  
  -- Proposal details
  proposal_type mls_proposal_type NOT NULL,
  proposer_id VARCHAR(128) NOT NULL,
  target_member_id VARCHAR(128),
  
  -- Cryptographic proof
  signature TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_epoch_commit UNIQUE (group_id, epoch)
);

CREATE INDEX idx_mls_commits_group ON mls_commits(group_id);
CREATE INDEX idx_mls_commits_epoch ON mls_commits(group_id, epoch);

-- ============================================================================
-- Messages Table
-- ============================================================================
-- Encrypted messages sent within groups

CREATE TABLE mls_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
  epoch INTEGER NOT NULL,
  
  -- Sender
  sender_id VARCHAR(128) NOT NULL,
  content_type mls_content_type NOT NULL DEFAULT 'application',
  
  -- Encrypted payload
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  
  -- Authentication
  signature TEXT NOT NULL,
  
  -- Metadata
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- For efficient retrieval
  CONSTRAINT valid_message_epoch CHECK (epoch >= 0)
);

CREATE INDEX idx_mls_messages_group ON mls_messages(group_id);
CREATE INDEX idx_mls_messages_group_time ON mls_messages(group_id, sent_at DESC);
CREATE INDEX idx_mls_messages_sender ON mls_messages(sender_id);

-- ============================================================================
-- Epoch Secrets Table (for forward secrecy)
-- ============================================================================
-- Stores encrypted secrets for each epoch to allow decryption of past messages

CREATE TABLE mls_epoch_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
  epoch INTEGER NOT NULL,
  
  -- Encrypted secret for this epoch
  secret_encrypted TEXT NOT NULL,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- When this epoch's secrets should be deleted (forward secrecy)
  
  CONSTRAINT unique_group_epoch UNIQUE (group_id, epoch)
);

CREATE INDEX idx_mls_epoch_secrets_group ON mls_epoch_secrets(group_id, epoch);

-- ============================================================================
-- Audit Log Table
-- ============================================================================
-- Tracks all MLS operations for compliance and debugging

CREATE TABLE mls_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64),
  
  -- Operation
  action VARCHAR(50) NOT NULL,  -- create_group, add_member, remove_member, send_message, etc.
  group_id UUID,
  member_id VARCHAR(128),
  
  -- Actor
  performed_by VARCHAR(128) NOT NULL,
  
  -- Details
  details JSONB DEFAULT '{}',
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mls_audit_tenant ON mls_audit_log(tenant_id);
CREATE INDEX idx_mls_audit_group ON mls_audit_log(group_id);
CREATE INDEX idx_mls_audit_action ON mls_audit_log(action);
CREATE INDEX idx_mls_audit_time ON mls_audit_log(created_at);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE mls_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE mls_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE mls_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE mls_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mls_epoch_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mls_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenant isolation for groups
CREATE POLICY mls_groups_tenant_isolation ON mls_groups
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Platform admin access
CREATE POLICY mls_groups_admin_access ON mls_groups
  FOR ALL USING (current_setting('app.is_platform_admin', true)::BOOLEAN = true);

-- Member access to their groups
CREATE POLICY mls_members_access ON mls_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mls_groups g 
      WHERE g.group_id = mls_group_members.group_id 
      AND g.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- Commits access through group membership
CREATE POLICY mls_commits_access ON mls_commits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mls_groups g 
      WHERE g.group_id = mls_commits.group_id 
      AND g.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- Messages access through group membership
CREATE POLICY mls_messages_access ON mls_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mls_groups g 
      WHERE g.group_id = mls_messages.group_id 
      AND g.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- Epoch secrets access through group membership
CREATE POLICY mls_epoch_secrets_access ON mls_epoch_secrets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mls_groups g 
      WHERE g.group_id = mls_epoch_secrets.group_id 
      AND g.tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- Audit log tenant isolation
CREATE POLICY mls_audit_tenant_isolation ON mls_audit_log
  FOR ALL USING (
    tenant_id IS NULL OR 
    tenant_id = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY mls_audit_admin_access ON mls_audit_log
  FOR ALL USING (current_setting('app.is_platform_admin', true)::BOOLEAN = true);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE mls_key_packages IS 'MLS key packages containing member credentials and public keys for group joining';
COMMENT ON TABLE mls_groups IS 'MLS groups for encrypted agent-to-agent communication';
COMMENT ON TABLE mls_group_members IS 'Membership records for MLS groups with ratchet tree positions';
COMMENT ON TABLE mls_commits IS 'MLS commits that modify group state (add/remove members, key updates)';
COMMENT ON TABLE mls_messages IS 'Encrypted messages sent within MLS groups';
COMMENT ON TABLE mls_epoch_secrets IS 'Per-epoch secrets for forward secrecy key derivation';
COMMENT ON TABLE mls_audit_log IS 'Audit trail for all MLS operations';

COMMENT ON COLUMN mls_groups.epoch IS 'Current epoch number, incremented on each commit';
COMMENT ON COLUMN mls_groups.tree_hash IS 'Hash of the ratchet tree for integrity verification';
COMMENT ON COLUMN mls_group_members.leaf_index IS 'Position in the ratchet tree (0-indexed)';
COMMENT ON COLUMN mls_commits.epoch IS 'Epoch this commit transitions TO';
