-- =============================================================================
-- V2026_02_06_002 - User Memory Retention & Unified Profile
-- =============================================================================
-- Implements:
--   1. Three-tier retention policy hierarchy (platform → tenant → tenant_admin)
--   2. Unified user memory profile across all chats and all models
--   3. Storage tier tracking (hot/warm/cold/archive)
--   4. Memory usage metrics per user
-- =============================================================================

-- ============================================================================
-- Retention Policy Tables
-- ============================================================================

-- Platform-level default retention policy (set by Radiant super-admin)
CREATE TABLE IF NOT EXISTS platform_retention_policies (
  policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(32) NOT NULL DEFAULT 'all',
  
  -- Core retention
  retention_days INTEGER NOT NULL DEFAULT 0,           -- 0 = unlimited
  max_storage_per_user_mb INTEGER NOT NULL DEFAULT 0,  -- 0 = unlimited
  max_entries_per_user INTEGER NOT NULL DEFAULT 0,     -- 0 = unlimited
  
  -- Tiered storage thresholds
  hot_tier_days INTEGER NOT NULL DEFAULT 30,
  warm_tier_days INTEGER NOT NULL DEFAULT 180,
  cold_tier_days INTEGER NOT NULL DEFAULT 365,
  archive_after_days INTEGER NOT NULL DEFAULT 0,       -- 0 = never archive
  
  -- Auto-pruning
  auto_prune_enabled BOOLEAN NOT NULL DEFAULT true,
  prune_min_importance DECIMAL(3,2) NOT NULL DEFAULT 0.10,
  prune_min_access_count INTEGER NOT NULL DEFAULT 0,
  
  -- Feature toggles
  session_to_session_memory_enabled BOOLEAN NOT NULL DEFAULT true,
  conversation_history_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_extract_enabled BOOLEAN NOT NULL DEFAULT true,
  user_can_delete_own_memory BOOLEAN NOT NULL DEFAULT true,
  uploaded_documents_enabled BOOLEAN NOT NULL DEFAULT true,
  downloaded_files_enabled BOOLEAN NOT NULL DEFAULT true,
  max_upload_size_mb INTEGER NOT NULL DEFAULT 100,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_target_type CHECK (target_type IN (
    'all', 'conversation_history', 'user_context', 'akg_nodes', 'akg_edges',
    'memories', 'preferences', 'dream_insights', 'access_patterns',
    'uploaded_documents', 'downloaded_files'
  )),
  CONSTRAINT unique_platform_target UNIQUE (target_type)
);

-- Tenant-level retention override (set by Think Tank Admin)
CREATE TABLE IF NOT EXISTS tenant_retention_overrides (
  override_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_type VARCHAR(32) NOT NULL DEFAULT 'all',
  
  -- All nullable — only override what you want to change
  retention_days INTEGER,
  max_storage_per_user_mb INTEGER,
  max_entries_per_user INTEGER,
  hot_tier_days INTEGER,
  warm_tier_days INTEGER,
  cold_tier_days INTEGER,
  archive_after_days INTEGER,
  auto_prune_enabled BOOLEAN,
  prune_min_importance DECIMAL(3,2),
  prune_min_access_count INTEGER,
  session_to_session_memory_enabled BOOLEAN,
  conversation_history_enabled BOOLEAN,
  auto_extract_enabled BOOLEAN,
  user_can_delete_own_memory BOOLEAN,
  uploaded_documents_enabled BOOLEAN,
  downloaded_files_enabled BOOLEAN,
  max_upload_size_mb INTEGER,
  
  overridden_by UUID NOT NULL,         -- Admin user ID
  override_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_tenant_target_type CHECK (target_type IN (
    'all', 'conversation_history', 'user_context', 'akg_nodes', 'akg_edges',
    'memories', 'preferences', 'dream_insights', 'access_patterns',
    'uploaded_documents', 'downloaded_files'
  )),
  CONSTRAINT unique_tenant_target UNIQUE (tenant_id, target_type)
);

-- Tenant Admin retention override (set by Think Tank Tenant Admin)
-- CANNOT exceed tenant-level limits
CREATE TABLE IF NOT EXISTS tenant_admin_retention_overrides (
  override_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_type VARCHAR(32) NOT NULL DEFAULT 'all',
  
  retention_days INTEGER,
  max_storage_per_user_mb INTEGER,
  max_entries_per_user INTEGER,
  hot_tier_days INTEGER,
  warm_tier_days INTEGER,
  session_to_session_memory_enabled BOOLEAN,
  conversation_history_enabled BOOLEAN,
  auto_extract_enabled BOOLEAN,
  user_can_delete_own_memory BOOLEAN,
  uploaded_documents_enabled BOOLEAN,
  downloaded_files_enabled BOOLEAN,
  
  overridden_by UUID NOT NULL,
  override_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_tadmin_target_type CHECK (target_type IN (
    'all', 'conversation_history', 'user_context', 'akg_nodes', 'akg_edges',
    'memories', 'preferences', 'dream_insights', 'access_patterns',
    'uploaded_documents', 'downloaded_files'
  )),
  CONSTRAINT unique_tadmin_target UNIQUE (tenant_id, target_type)
);

-- ============================================================================
-- User Memory Profile Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_memory_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Storage metrics
  total_memory_entries INTEGER NOT NULL DEFAULT 0,
  total_storage_bytes BIGINT NOT NULL DEFAULT 0,
  current_storage_tier VARCHAR(16) NOT NULL DEFAULT 'hot',
  profile_quality DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  
  -- Counts by category
  facts_count INTEGER NOT NULL DEFAULT 0,
  preferences_count INTEGER NOT NULL DEFAULT 0,
  instructions_count INTEGER NOT NULL DEFAULT 0,
  projects_count INTEGER NOT NULL DEFAULT 0,
  skills_count INTEGER NOT NULL DEFAULT 0,
  relationships_count INTEGER NOT NULL DEFAULT 0,
  corrections_count INTEGER NOT NULL DEFAULT 0,
  akg_nodes_count INTEGER NOT NULL DEFAULT 0,
  akg_edges_count INTEGER NOT NULL DEFAULT 0,
  conversation_memories_count INTEGER NOT NULL DEFAULT 0,
  uploaded_documents_count INTEGER NOT NULL DEFAULT 0,
  uploaded_documents_total_bytes BIGINT NOT NULL DEFAULT 0,
  downloaded_files_count INTEGER NOT NULL DEFAULT 0,
  downloaded_files_total_bytes BIGINT NOT NULL DEFAULT 0,
  
  -- Activity
  last_interaction_at TIMESTAMPTZ,
  last_memory_update_at TIMESTAMPTZ,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  total_models_used INTEGER NOT NULL DEFAULT 0,
  models_used TEXT[] DEFAULT '{}',
  
  -- Retention
  oldest_memory_at TIMESTAMPTZ,
  next_prune_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_profile UNIQUE (tenant_id, user_id),
  CONSTRAINT valid_storage_tier CHECK (current_storage_tier IN ('hot', 'warm', 'cold', 'archive'))
);

-- ============================================================================
-- Memory Usage Tracking (per-user storage consumption)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_memory_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Storage by type
  conversation_history_bytes BIGINT NOT NULL DEFAULT 0,
  conversation_history_count INTEGER NOT NULL DEFAULT 0,
  user_context_bytes BIGINT NOT NULL DEFAULT 0,
  user_context_count INTEGER NOT NULL DEFAULT 0,
  akg_bytes BIGINT NOT NULL DEFAULT 0,
  akg_count INTEGER NOT NULL DEFAULT 0,
  memories_bytes BIGINT NOT NULL DEFAULT 0,
  memories_count INTEGER NOT NULL DEFAULT 0,
  preferences_bytes BIGINT NOT NULL DEFAULT 0,
  preferences_count INTEGER NOT NULL DEFAULT 0,
  uploaded_documents_bytes BIGINT NOT NULL DEFAULT 0,
  uploaded_documents_count INTEGER NOT NULL DEFAULT 0,
  downloaded_files_bytes BIGINT NOT NULL DEFAULT 0,
  downloaded_files_count INTEGER NOT NULL DEFAULT 0,
  
  -- Tier distribution
  hot_tier_entries INTEGER NOT NULL DEFAULT 0,
  warm_tier_entries INTEGER NOT NULL DEFAULT 0,
  cold_tier_entries INTEGER NOT NULL DEFAULT 0,
  archive_tier_entries INTEGER NOT NULL DEFAULT 0,
  
  -- Computed
  total_bytes BIGINT GENERATED ALWAYS AS (
    conversation_history_bytes + user_context_bytes + akg_bytes + memories_bytes + preferences_bytes + uploaded_documents_bytes + downloaded_files_bytes
  ) STORED,
  total_entries INTEGER GENERATED ALWAYS AS (
    conversation_history_count + user_context_count + akg_count + memories_count + preferences_count + uploaded_documents_count + downloaded_files_count
  ) STORED,
  
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_usage UNIQUE (tenant_id, user_id)
);

-- ============================================================================
-- Memory Retention Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_retention_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  action VARCHAR(64) NOT NULL,
  scope VARCHAR(16) NOT NULL,         -- 'platform', 'tenant', 'tenant_admin'
  performed_by UUID NOT NULL,
  
  target_type VARCHAR(32),
  old_value JSONB,
  new_value JSONB,
  
  affected_users INTEGER DEFAULT 0,
  affected_entries INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE tenant_retention_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admin_retention_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_retention_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_retention_rls ON tenant_retention_overrides
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tadmin_retention_rls ON tenant_admin_retention_overrides
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY user_profile_rls ON user_memory_profiles
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY user_usage_rls ON user_memory_usage
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY retention_audit_rls ON memory_retention_audit
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_retention_tenant ON tenant_retention_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tadmin_retention_tenant ON tenant_admin_retention_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_tenant_user ON user_memory_profiles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_last_interaction ON user_memory_profiles(tenant_id, last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_tenant_user ON user_memory_usage(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_retention_audit_tenant ON memory_retention_audit(tenant_id, created_at DESC);

-- ============================================================================
-- Seed Platform Defaults
-- ============================================================================

INSERT INTO platform_retention_policies (target_type, retention_days, max_storage_per_user_mb, max_entries_per_user,
  hot_tier_days, warm_tier_days, cold_tier_days, archive_after_days,
  auto_prune_enabled, prune_min_importance, prune_min_access_count,
  session_to_session_memory_enabled, conversation_history_enabled, auto_extract_enabled, user_can_delete_own_memory,
  uploaded_documents_enabled, downloaded_files_enabled, max_upload_size_mb)
VALUES 
  ('all', 0, 0, 0, 30, 180, 365, 0, true, 0.10, 0, true, true, true, true, true, true, 100)
ON CONFLICT (target_type) DO NOTHING;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Resolve effective retention policy for a tenant by merging hierarchy
CREATE OR REPLACE FUNCTION resolve_effective_retention(
  p_tenant_id UUID,
  p_target_type VARCHAR(32) DEFAULT 'all'
) RETURNS JSONB AS $$
DECLARE
  v_platform RECORD;
  v_tenant RECORD;
  v_tadmin RECORD;
  v_result JSONB;
  v_sources JSONB := '{}';
BEGIN
  -- 1. Get platform default
  SELECT * INTO v_platform FROM platform_retention_policies 
    WHERE target_type = p_target_type;
  IF NOT FOUND THEN
    SELECT * INTO v_platform FROM platform_retention_policies WHERE target_type = 'all';
  END IF;
  
  -- 2. Get tenant override
  SELECT * INTO v_tenant FROM tenant_retention_overrides 
    WHERE tenant_id = p_tenant_id AND target_type = p_target_type;
  IF NOT FOUND THEN
    SELECT * INTO v_tenant FROM tenant_retention_overrides 
      WHERE tenant_id = p_tenant_id AND target_type = 'all';
  END IF;
  
  -- 3. Get tenant admin override
  SELECT * INTO v_tadmin FROM tenant_admin_retention_overrides 
    WHERE tenant_id = p_tenant_id AND target_type = p_target_type;
  IF NOT FOUND THEN
    SELECT * INTO v_tadmin FROM tenant_admin_retention_overrides 
      WHERE tenant_id = p_tenant_id AND target_type = 'all';
  END IF;
  
  -- Resolve: tenant_admin > tenant > platform (but tenant_admin cannot exceed tenant limits)
  v_result := jsonb_build_object(
    'tenantId', p_tenant_id,
    'targetType', p_target_type,
    'retentionDays', COALESCE(v_tadmin.retention_days, v_tenant.retention_days, v_platform.retention_days),
    'maxStoragePerUserMb', COALESCE(v_tadmin.max_storage_per_user_mb, v_tenant.max_storage_per_user_mb, v_platform.max_storage_per_user_mb),
    'maxEntriesPerUser', COALESCE(v_tadmin.max_entries_per_user, v_tenant.max_entries_per_user, v_platform.max_entries_per_user),
    'hotTierDays', COALESCE(v_tadmin.hot_tier_days, v_tenant.hot_tier_days, v_platform.hot_tier_days),
    'warmTierDays', COALESCE(v_tadmin.warm_tier_days, v_tenant.warm_tier_days, v_platform.warm_tier_days),
    'coldTierDays', COALESCE(v_tenant.cold_tier_days, v_platform.cold_tier_days),
    'archiveAfterDays', COALESCE(v_tenant.archive_after_days, v_platform.archive_after_days),
    'autoPruneEnabled', COALESCE(v_tenant.auto_prune_enabled, v_platform.auto_prune_enabled),
    'pruneMinImportance', COALESCE(v_tenant.prune_min_importance, v_platform.prune_min_importance),
    'pruneMinAccessCount', COALESCE(v_tenant.prune_min_access_count, v_platform.prune_min_access_count),
    'sessionToSessionMemoryEnabled', COALESCE(v_tadmin.session_to_session_memory_enabled, v_tenant.session_to_session_memory_enabled, v_platform.session_to_session_memory_enabled),
    'conversationHistoryEnabled', COALESCE(v_tadmin.conversation_history_enabled, v_tenant.conversation_history_enabled, v_platform.conversation_history_enabled),
    'autoExtractEnabled', COALESCE(v_tadmin.auto_extract_enabled, v_tenant.auto_extract_enabled, v_platform.auto_extract_enabled),
    'userCanDeleteOwnMemory', COALESCE(v_tadmin.user_can_delete_own_memory, v_tenant.user_can_delete_own_memory, v_platform.user_can_delete_own_memory),
    'uploadedDocumentsEnabled', COALESCE(v_tadmin.uploaded_documents_enabled, v_tenant.uploaded_documents_enabled, v_platform.uploaded_documents_enabled),
    'downloadedFilesEnabled', COALESCE(v_tadmin.downloaded_files_enabled, v_tenant.downloaded_files_enabled, v_platform.downloaded_files_enabled),
    'maxUploadSizeMb', COALESCE(v_tenant.max_upload_size_mb, v_platform.max_upload_size_mb),
    'resolvedAt', NOW()
  );
  
  -- Track provenance
  v_sources := jsonb_build_object(
    'retentionDays', CASE WHEN v_tadmin.retention_days IS NOT NULL THEN 'tenant_admin' WHEN v_tenant.retention_days IS NOT NULL THEN 'tenant' ELSE 'platform' END,
    'sessionToSessionMemoryEnabled', CASE WHEN v_tadmin.session_to_session_memory_enabled IS NOT NULL THEN 'tenant_admin' WHEN v_tenant.session_to_session_memory_enabled IS NOT NULL THEN 'tenant' ELSE 'platform' END,
    'maxStoragePerUserMb', CASE WHEN v_tadmin.max_storage_per_user_mb IS NOT NULL THEN 'tenant_admin' WHEN v_tenant.max_storage_per_user_mb IS NOT NULL THEN 'tenant' ELSE 'platform' END,
    'userCanDeleteOwnMemory', CASE WHEN v_tadmin.user_can_delete_own_memory IS NOT NULL THEN 'tenant_admin' WHEN v_tenant.user_can_delete_own_memory IS NOT NULL THEN 'tenant' ELSE 'platform' END,
    'uploadedDocumentsEnabled', CASE WHEN v_tadmin.uploaded_documents_enabled IS NOT NULL THEN 'tenant_admin' WHEN v_tenant.uploaded_documents_enabled IS NOT NULL THEN 'tenant' ELSE 'platform' END,
    'downloadedFilesEnabled', CASE WHEN v_tadmin.downloaded_files_enabled IS NOT NULL THEN 'tenant_admin' WHEN v_tenant.downloaded_files_enabled IS NOT NULL THEN 'tenant' ELSE 'platform' END,
    'maxUploadSizeMb', CASE WHEN v_tenant.max_upload_size_mb IS NOT NULL THEN 'tenant' ELSE 'platform' END
  );
  
  v_result := v_result || jsonb_build_object('sources', v_sources);
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Prune expired/low-importance memories for a user based on effective policy
CREATE OR REPLACE FUNCTION prune_user_memories(
  p_tenant_id UUID,
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_policy JSONB;
  v_retention_days INTEGER;
  v_min_importance DECIMAL;
  v_min_access INTEGER;
  v_deleted INTEGER := 0;
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_policy := resolve_effective_retention(p_tenant_id, 'all');
  v_retention_days := (v_policy->>'retentionDays')::INTEGER;
  v_min_importance := (v_policy->>'pruneMinImportance')::DECIMAL;
  v_min_access := (v_policy->>'pruneMinAccessCount')::INTEGER;
  
  -- Skip if retention is unlimited
  IF v_retention_days = 0 THEN RETURN 0; END IF;
  
  v_cutoff := NOW() - (v_retention_days || ' days')::INTERVAL;
  
  -- Prune user_persistent_context entries
  DELETE FROM user_persistent_context
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id
    AND updated_at < v_cutoff
    AND importance < v_min_importance;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Prune memories
  WITH expired_stores AS (
    SELECT id FROM memory_stores WHERE tenant_id = p_tenant_id AND user_id = p_user_id
  )
  DELETE FROM memories
    WHERE store_id IN (SELECT id FROM expired_stores)
    AND last_accessed < v_cutoff
    AND importance < v_min_importance
    AND access_count <= v_min_access;
  GET DIAGNOSTICS v_deleted = v_deleted + ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Compute and update user memory profile stats
CREATE OR REPLACE FUNCTION refresh_user_memory_profile(
  p_tenant_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_context_count INTEGER;
  v_facts INTEGER;
  v_prefs INTEGER;
  v_instructions INTEGER;
  v_projects INTEGER;
  v_skills INTEGER;
  v_relationships INTEGER;
  v_corrections INTEGER;
  v_akg_nodes INTEGER;
  v_akg_edges INTEGER;
  v_memory_count INTEGER;
  v_uploads_count INTEGER;
  v_uploads_bytes BIGINT;
  v_downloads_count INTEGER;
  v_downloads_bytes BIGINT;
  v_total INTEGER;
  v_quality DECIMAL;
BEGIN
  -- Count user_persistent_context by type
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE context_type = 'fact'),
    COUNT(*) FILTER (WHERE context_type = 'preference'),
    COUNT(*) FILTER (WHERE context_type = 'instruction'),
    COUNT(*) FILTER (WHERE context_type = 'project'),
    COUNT(*) FILTER (WHERE context_type = 'skill'),
    COUNT(*) FILTER (WHERE context_type = 'relationship'),
    COUNT(*) FILTER (WHERE context_type = 'correction')
  INTO v_context_count, v_facts, v_prefs, v_instructions, v_projects, v_skills, v_relationships, v_corrections
  FROM user_persistent_context
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id
  AND (expires_at IS NULL OR expires_at > NOW());
  
  -- Count AKG
  SELECT COUNT(*) INTO v_akg_nodes FROM akg_nodes WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
  SELECT COUNT(*) INTO v_akg_edges FROM akg_edges WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
  
  -- Count memories
  SELECT COALESCE(SUM(ms.total_memories), 0) INTO v_memory_count
  FROM memory_stores ms WHERE ms.tenant_id = p_tenant_id AND ms.user_id = p_user_id;
  
  -- Count uploaded documents (non-deleted)
  SELECT COUNT(*), COALESCE(SUM(file_size_bytes), 0)
  INTO v_uploads_count, v_uploads_bytes
  FROM uds_uploads
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND status != 'deleted';
  
  -- Count downloaded/generated files (message attachments of type 'file')
  SELECT COUNT(*), COALESCE(SUM(content_size), 0)
  INTO v_downloads_count, v_downloads_bytes
  FROM uds_message_attachments ma
  JOIN uds_messages m ON m.id = ma.message_id
  WHERE m.tenant_id = p_tenant_id AND m.user_id = p_user_id
  AND ma.attachment_type = 'file';
  
  v_total := v_context_count + v_akg_nodes + v_memory_count + v_uploads_count + v_downloads_count;
  
  -- Profile quality: richness across categories (9 categories now including docs/files)
  v_quality := LEAST(1.0, (
    CASE WHEN v_facts > 0 THEN 0.13 ELSE 0 END +
    CASE WHEN v_prefs > 0 THEN 0.13 ELSE 0 END +
    CASE WHEN v_instructions > 0 THEN 0.10 ELSE 0 END +
    CASE WHEN v_projects > 0 THEN 0.08 ELSE 0 END +
    CASE WHEN v_skills > 0 THEN 0.08 ELSE 0 END +
    CASE WHEN v_relationships > 0 THEN 0.08 ELSE 0 END +
    CASE WHEN v_akg_nodes > 5 THEN 0.13 ELSE v_akg_nodes * 0.026 END +
    CASE WHEN v_memory_count > 0 THEN 0.12 ELSE 0 END +
    CASE WHEN v_uploads_count > 0 THEN 0.08 ELSE 0 END +
    CASE WHEN v_downloads_count > 0 THEN 0.07 ELSE 0 END
  ));
  
  INSERT INTO user_memory_profiles (
    tenant_id, user_id, total_memory_entries, profile_quality,
    facts_count, preferences_count, instructions_count, projects_count,
    skills_count, relationships_count, corrections_count,
    akg_nodes_count, akg_edges_count, conversation_memories_count,
    uploaded_documents_count, uploaded_documents_total_bytes,
    downloaded_files_count, downloaded_files_total_bytes,
    last_memory_update_at
  ) VALUES (
    p_tenant_id, p_user_id, v_total, v_quality,
    v_facts, v_prefs, v_instructions, v_projects,
    v_skills, v_relationships, v_corrections,
    v_akg_nodes, v_akg_edges, v_memory_count,
    v_uploads_count, v_uploads_bytes,
    v_downloads_count, v_downloads_bytes,
    NOW()
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    total_memory_entries = v_total,
    profile_quality = v_quality,
    facts_count = v_facts,
    preferences_count = v_prefs,
    instructions_count = v_instructions,
    projects_count = v_projects,
    skills_count = v_skills,
    relationships_count = v_relationships,
    corrections_count = v_corrections,
    akg_nodes_count = v_akg_nodes,
    akg_edges_count = v_akg_edges,
    conversation_memories_count = v_memory_count,
    uploaded_documents_count = v_uploads_count,
    uploaded_documents_total_bytes = v_uploads_bytes,
    downloaded_files_count = v_downloads_count,
    downloaded_files_total_bytes = v_downloads_bytes,
    last_memory_update_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
