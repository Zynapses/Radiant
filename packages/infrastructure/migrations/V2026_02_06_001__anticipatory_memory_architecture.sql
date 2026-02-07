-- =============================================================================
-- ANTICIPATORY MEMORY ARCHITECTURE v1.0.0
-- Migration: V2026_02_06_001__anticipatory_memory_architecture.sql
-- 
-- 5 leapfrog features that put RADIANT 3-5 years ahead of Claude's persistent memory:
--
-- 1. Autobiographical Knowledge Graph (AKG) — 4 tables
-- 2. Predictive Memory Prefetch — 3 tables
-- 3. Memory Contradiction Detector — 2 tables
-- 4. Organizational Memory Mesh — 5 tables (with regulatory compliance)
-- 5. Dream Insight Generator — 2 tables
--
-- Total: 16 tables, 5 enums, 4 helper functions, full RLS
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE akg_entity_type AS ENUM (
  'person', 'organization', 'project', 'technology', 'concept',
  'location', 'event', 'product', 'skill', 'preference',
  'goal', 'problem', 'decision', 'custom'
);

CREATE TYPE akg_relationship_type AS ENUM (
  'works_at', 'builds', 'uses', 'knows', 'prefers', 'manages',
  'created', 'depends_on', 'part_of', 'located_in', 'interested_in',
  'skilled_in', 'concerned_about', 'decided', 'avoids',
  'collaborates_with', 'reports_to', 'owns', 'studies', 'custom'
);

CREATE TYPE contradiction_type AS ENUM (
  'factual', 'temporal', 'preference', 'relationship', 'quantitative', 'sentiment'
);

CREATE TYPE contradiction_status AS ENUM (
  'detected', 'auto_resolved', 'user_resolved', 'accepted', 'dismissed'
);

CREATE TYPE memory_privacy_tier AS ENUM (
  'personal', 'team', 'department', 'org', 'public'
);

-- =============================================================================
-- 1. AUTOBIOGRAPHICAL KNOWLEDGE GRAPH (AKG)
-- =============================================================================

-- 1a. AKG Configuration (per-tenant)
CREATE TABLE akg_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  extraction_model VARCHAR(256) NOT NULL DEFAULT 'openai/gpt-4o-mini',
  min_entity_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.60,
  min_edge_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.50,
  max_nodes_per_user INTEGER NOT NULL DEFAULT 5000,
  max_edges_per_user INTEGER NOT NULL DEFAULT 20000,
  prune_after_days INTEGER NOT NULL DEFAULT 365,
  enabled_entity_types akg_entity_type[] DEFAULT '{}',
  generate_embeddings BOOLEAN NOT NULL DEFAULT true,
  max_extraction_tokens INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE akg_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY akg_config_tenant_isolation ON akg_config
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 1b. AKG Nodes (entities extracted from conversations)
CREATE TABLE akg_nodes (
  node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entity_type akg_entity_type NOT NULL,
  label VARCHAR(512) NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  properties JSONB DEFAULT '{}',
  embedding vector(1536),
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  mention_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  importance DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  source_conversation_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_akg_nodes_tenant_user ON akg_nodes(tenant_id, user_id);
CREATE INDEX idx_akg_nodes_entity_type ON akg_nodes(tenant_id, user_id, entity_type);
CREATE INDEX idx_akg_nodes_label ON akg_nodes(tenant_id, user_id, label);
CREATE INDEX idx_akg_nodes_importance ON akg_nodes(tenant_id, user_id, importance DESC);
CREATE INDEX idx_akg_nodes_last_seen ON akg_nodes(tenant_id, user_id, last_seen_at DESC);
CREATE INDEX idx_akg_nodes_embedding ON akg_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE akg_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY akg_nodes_tenant_isolation ON akg_nodes
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 1c. AKG Edges (relationships between entities)
CREATE TABLE akg_edges (
  edge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_node_id UUID NOT NULL REFERENCES akg_nodes(node_id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES akg_nodes(node_id) ON DELETE CASCADE,
  relationship_type akg_relationship_type NOT NULL,
  label VARCHAR(256) NOT NULL,
  properties JSONB DEFAULT '{}',
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  source_conversation_id VARCHAR(256),
  weight DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent duplicate edges between same nodes with same relationship
  CONSTRAINT uq_akg_edges_relationship UNIQUE (tenant_id, user_id, source_node_id, target_node_id, relationship_type)
);

CREATE INDEX idx_akg_edges_source ON akg_edges(tenant_id, user_id, source_node_id);
CREATE INDEX idx_akg_edges_target ON akg_edges(tenant_id, user_id, target_node_id);
CREATE INDEX idx_akg_edges_type ON akg_edges(tenant_id, user_id, relationship_type);
CREATE INDEX idx_akg_edges_weight ON akg_edges(tenant_id, user_id, weight DESC);

ALTER TABLE akg_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY akg_edges_tenant_isolation ON akg_edges
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 1d. AKG Extraction Log (tracks extraction results per conversation)
CREATE TABLE akg_extraction_log (
  extraction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  conversation_id VARCHAR(256) NOT NULL,
  new_nodes_count INTEGER NOT NULL DEFAULT 0,
  updated_nodes_count INTEGER NOT NULL DEFAULT 0,
  new_edges_count INTEGER NOT NULL DEFAULT 0,
  updated_edges_count INTEGER NOT NULL DEFAULT 0,
  contradictions_found INTEGER NOT NULL DEFAULT 0,
  extraction_latency_ms INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  model_used VARCHAR(256) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_akg_extraction_log_tenant ON akg_extraction_log(tenant_id, user_id, created_at DESC);

ALTER TABLE akg_extraction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY akg_extraction_log_tenant_isolation ON akg_extraction_log
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- 2. PREDICTIVE MEMORY PREFETCH
-- =============================================================================

-- 2a. Prefetch Configuration (per-tenant)
CREATE TABLE prefetch_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  max_prefetch_nodes INTEGER NOT NULL DEFAULT 20,
  min_prefetch_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.60,
  prediction_interval_sec INTEGER NOT NULL DEFAULT 30,
  use_temporal_features BOOLEAN NOT NULL DEFAULT true,
  use_topic_features BOOLEAN NOT NULL DEFAULT true,
  max_cache_size INTEGER NOT NULL DEFAULT 200,
  cache_ttl_sec INTEGER NOT NULL DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE prefetch_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY prefetch_config_tenant_isolation ON prefetch_config
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 2b. Memory Access Patterns (training data for prefetch model)
CREATE TABLE memory_access_patterns (
  pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  accessed_node_ids TEXT[] NOT NULL DEFAULT '{}',
  trigger_prompt_hash VARCHAR(128) NOT NULL,
  hour_of_day SMALLINT NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  topic_context TEXT[] DEFAULT '{}',
  session_duration_sec INTEGER NOT NULL DEFAULT 0,
  was_useful BOOLEAN NOT NULL DEFAULT true,
  retrieval_latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions for access patterns (high volume)
CREATE TABLE memory_access_patterns_2026_02 PARTITION OF memory_access_patterns
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE memory_access_patterns_2026_03 PARTITION OF memory_access_patterns
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE memory_access_patterns_2026_04 PARTITION OF memory_access_patterns
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX idx_access_patterns_user ON memory_access_patterns(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_access_patterns_time ON memory_access_patterns(tenant_id, user_id, hour_of_day, day_of_week);

ALTER TABLE memory_access_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY access_patterns_tenant_isolation ON memory_access_patterns
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 2c. Prefetch Predictions (for feedback loop)
CREATE TABLE prefetch_predictions (
  prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  predicted_node_ids TEXT[] NOT NULL DEFAULT '{}',
  confidences DECIMAL(5,4)[] NOT NULL DEFAULT '{}',
  features JSONB NOT NULL DEFAULT '{}',
  was_used BOOLEAN,
  prediction_latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prefetch_predictions_user ON prefetch_predictions(tenant_id, user_id, created_at DESC);

ALTER TABLE prefetch_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY prefetch_predictions_tenant_isolation ON prefetch_predictions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- 3. MEMORY CONTRADICTION DETECTOR
-- =============================================================================

-- 3a. Contradiction Configuration (per-tenant)
CREATE TABLE contradiction_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  min_similarity_for_check DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  auto_resolve_confidence_gap DECIMAL(3,2) NOT NULL DEFAULT 0.30,
  auto_resolve_recency_days INTEGER NOT NULL DEFAULT 90,
  prompt_user_resolution BOOLEAN NOT NULL DEFAULT true,
  max_unresolved_alert INTEGER NOT NULL DEFAULT 50,
  detection_model VARCHAR(256) NOT NULL DEFAULT 'openai/gpt-4o-mini',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contradiction_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY contradiction_config_tenant_isolation ON contradiction_config
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 3b. Detected Contradictions
CREATE TABLE memory_contradictions (
  contradiction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  new_fact_node_id UUID REFERENCES akg_nodes(node_id) ON DELETE SET NULL,
  new_fact_text TEXT NOT NULL,
  new_fact_source VARCHAR(256) NOT NULL,
  new_fact_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  existing_fact_node_id UUID REFERENCES akg_nodes(node_id) ON DELETE SET NULL,
  existing_fact_text TEXT NOT NULL,
  existing_fact_source VARCHAR(256) NOT NULL,
  existing_fact_date TIMESTAMPTZ NOT NULL,
  contradiction_type contradiction_type NOT NULL,
  severity DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  explanation TEXT NOT NULL,
  status contradiction_status NOT NULL DEFAULT 'detected',
  resolution JSONB,
  detection_confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_contradictions_user ON memory_contradictions(tenant_id, user_id, status);
CREATE INDEX idx_contradictions_status ON memory_contradictions(tenant_id, status, created_at DESC);
CREATE INDEX idx_contradictions_unresolved ON memory_contradictions(tenant_id, user_id)
  WHERE status = 'detected';

ALTER TABLE memory_contradictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contradictions_tenant_isolation ON memory_contradictions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- 4. ORGANIZATIONAL MEMORY MESH (with regulatory compliance)
-- =============================================================================

-- 4a. Org Memory Configuration (per-tenant)
CREATE TABLE org_memory_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  require_explicit_consent BOOLEAN NOT NULL DEFAULT true,
  default_privacy_tier memory_privacy_tier NOT NULL DEFAULT 'team',
  min_contributors_for_visibility INTEGER NOT NULL DEFAULT 2,
  auto_anonymize BOOLEAN NOT NULL DEFAULT true,
  run_compliance_scan BOOLEAN NOT NULL DEFAULT true,
  hipaa_mode BOOLEAN NOT NULL DEFAULT false,
  max_org_nodes INTEGER NOT NULL DEFAULT 50000,
  require_admin_review BOOLEAN NOT NULL DEFAULT false,
  auto_share_during_dreaming BOOLEAN NOT NULL DEFAULT true,
  retention_days INTEGER NOT NULL DEFAULT 0,
  consent_renewal_days INTEGER NOT NULL DEFAULT 365,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE org_memory_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_memory_config_tenant_isolation ON org_memory_config
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 4b. Org Memory Nodes (shared knowledge)
CREATE TABLE org_memory_nodes (
  node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  privacy_tier memory_privacy_tier NOT NULL DEFAULT 'team',
  data_classification VARCHAR(32) NOT NULL DEFAULT 'internal',
  scope_id UUID,
  label VARCHAR(512) NOT NULL,
  entity_type akg_entity_type NOT NULL,
  properties JSONB DEFAULT '{}',
  embedding vector(1536),
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  contributor_count INTEGER NOT NULL DEFAULT 1,
  importance DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  admin_reviewed BOOLEAN NOT NULL DEFAULT false,
  compliance_scan_passed BOOLEAN NOT NULL DEFAULT false,
  last_compliance_scan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_nodes_tenant ON org_memory_nodes(tenant_id, privacy_tier);
CREATE INDEX idx_org_nodes_type ON org_memory_nodes(tenant_id, entity_type);
CREATE INDEX idx_org_nodes_classification ON org_memory_nodes(tenant_id, data_classification);
CREATE INDEX idx_org_nodes_importance ON org_memory_nodes(tenant_id, importance DESC);
CREATE INDEX idx_org_nodes_unreviewed ON org_memory_nodes(tenant_id)
  WHERE admin_reviewed = false AND compliance_scan_passed = true;
CREATE INDEX idx_org_nodes_embedding ON org_memory_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE org_memory_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_memory_nodes_tenant_isolation ON org_memory_nodes
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 4c. Org Memory Consent Records (GDPR Art. 6/7 compliance)
CREATE TABLE org_memory_consents (
  consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  consented_tiers memory_privacy_tier[] NOT NULL DEFAULT '{team}',
  allowed_classifications TEXT[] NOT NULL DEFAULT '{public,internal}',
  allowed_entity_types akg_entity_type[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  processing_purpose TEXT NOT NULL DEFAULT 'Organizational knowledge sharing to improve AI assistance quality',
  legal_basis VARCHAR(32) NOT NULL DEFAULT 'consent',
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renewed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  consent_ip_address INET,
  consent_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One active consent per user per tenant
  CONSTRAINT uq_org_consent_active UNIQUE (tenant_id, user_id) WHERE (is_active = true)
);

CREATE INDEX idx_org_consents_user ON org_memory_consents(tenant_id, user_id, is_active);
CREATE INDEX idx_org_consents_active ON org_memory_consents(tenant_id)
  WHERE is_active = true;

ALTER TABLE org_memory_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_consents_tenant_isolation ON org_memory_consents
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 4d. Org Memory Contributions (tracks which user memories became org memories)
CREATE TABLE org_memory_contributions (
  contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_node_id UUID REFERENCES akg_nodes(node_id) ON DELETE SET NULL,
  org_node_id UUID NOT NULL REFERENCES org_memory_nodes(node_id) ON DELETE CASCADE,
  consent_id UUID NOT NULL REFERENCES org_memory_consents(consent_id) ON DELETE CASCADE,
  contributed_content TEXT NOT NULL,
  is_anonymized BOOLEAN NOT NULL DEFAULT true,
  sharing_method VARCHAR(32) NOT NULL DEFAULT 'auto_twilight',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_contributions_user ON org_memory_contributions(tenant_id, user_id);
CREATE INDEX idx_org_contributions_org_node ON org_memory_contributions(org_node_id);
CREATE INDEX idx_org_contributions_consent ON org_memory_contributions(consent_id);

ALTER TABLE org_memory_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_contributions_tenant_isolation ON org_memory_contributions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 4e. Org Memory Audit Log (SOC2 Type II compliance)
CREATE TABLE org_memory_audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action VARCHAR(32) NOT NULL,
  target_node_id UUID,
  details JSONB DEFAULT '{}',
  compliance_framework TEXT[] DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions for audit log (high volume, compliance retention)
CREATE TABLE org_memory_audit_log_2026_02 PARTITION OF org_memory_audit_log
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE org_memory_audit_log_2026_03 PARTITION OF org_memory_audit_log
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE org_memory_audit_log_2026_04 PARTITION OF org_memory_audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX idx_org_audit_tenant ON org_memory_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_org_audit_user ON org_memory_audit_log(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_org_audit_action ON org_memory_audit_log(tenant_id, action);

ALTER TABLE org_memory_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_audit_tenant_isolation ON org_memory_audit_log
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- 5. DREAM INSIGHT GENERATOR
-- =============================================================================

-- 5a. Dream Insight Configuration (per-tenant)
CREATE TABLE dream_insight_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  insight_model VARCHAR(256) NOT NULL DEFAULT 'anthropic/claude-3.5-sonnet',
  max_insights_per_cycle INTEGER NOT NULL DEFAULT 10,
  min_insight_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.60,
  max_tokens_per_cycle INTEGER NOT NULL DEFAULT 5000,
  enabled_insight_types TEXT[] DEFAULT '{}',
  proactive_surfacing BOOLEAN NOT NULL DEFAULT true,
  max_unsurfaced_insights INTEGER NOT NULL DEFAULT 50,
  analyze_org_memory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dream_insight_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY dream_insight_config_tenant_isolation ON dream_insight_config
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 5b. Dream Insights (generated during Twilight Dreaming)
CREATE TABLE dream_insights (
  insight_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  insight_type VARCHAR(32) NOT NULL,
  title VARCHAR(512) NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  recommendation TEXT,
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  relevance DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  priority INTEGER NOT NULL DEFAULT 50,
  surfaced BOOLEAN NOT NULL DEFAULT false,
  user_reaction VARCHAR(32),
  generated_during_dream_cycle VARCHAR(256),
  model_used VARCHAR(256) NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  surfaced_at TIMESTAMPTZ
);

CREATE INDEX idx_dream_insights_user ON dream_insights(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_dream_insights_unsurfaced ON dream_insights(tenant_id, user_id, priority DESC)
  WHERE surfaced = false;
CREATE INDEX idx_dream_insights_type ON dream_insights(tenant_id, insight_type);

ALTER TABLE dream_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY dream_insights_tenant_isolation ON dream_insights
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function 1: Compute AKG node importance based on frequency, recency, and centrality
CREATE OR REPLACE FUNCTION compute_akg_node_importance(
  p_tenant_id UUID,
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  WITH node_centrality AS (
    SELECT
      n.node_id,
      n.mention_count,
      n.last_seen_at,
      COALESCE(edge_count.total_edges, 0) AS total_edges
    FROM akg_nodes n
    LEFT JOIN (
      SELECT source_node_id AS node_id, COUNT(*) AS total_edges FROM akg_edges
      WHERE tenant_id = p_tenant_id AND user_id = p_user_id
      GROUP BY source_node_id
      UNION ALL
      SELECT target_node_id AS node_id, COUNT(*) FROM akg_edges
      WHERE tenant_id = p_tenant_id AND user_id = p_user_id
      GROUP BY target_node_id
    ) edge_count ON n.node_id = edge_count.node_id
    WHERE n.tenant_id = p_tenant_id AND n.user_id = p_user_id
  )
  UPDATE akg_nodes SET
    importance = LEAST(1.0, GREATEST(0.0,
      -- 40% frequency (log-scaled mention count)
      0.4 * LEAST(1.0, LN(nc.mention_count + 1) / LN(100)) +
      -- 30% recency (exponential decay, 30-day half-life)
      0.3 * EXP(-0.693 * EXTRACT(EPOCH FROM (NOW() - nc.last_seen_at)) / (30 * 86400)) +
      -- 30% centrality (log-scaled edge count)
      0.3 * LEAST(1.0, LN(nc.total_edges + 1) / LN(50))
    )),
    updated_at = NOW()
  FROM node_centrality nc
  WHERE akg_nodes.node_id = nc.node_id
    AND akg_nodes.tenant_id = p_tenant_id
    AND akg_nodes.user_id = p_user_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Prune stale AKG nodes not seen in N days
CREATE OR REPLACE FUNCTION prune_stale_akg_nodes(
  p_tenant_id UUID,
  p_prune_after_days INTEGER DEFAULT 365
) RETURNS INTEGER AS $$
DECLARE
  pruned_count INTEGER := 0;
BEGIN
  -- Delete nodes not seen in N days with low importance
  WITH deleted AS (
    DELETE FROM akg_nodes
    WHERE tenant_id = p_tenant_id
      AND last_seen_at < NOW() - (p_prune_after_days || ' days')::INTERVAL
      AND importance < 0.2
      AND mention_count < 3
    RETURNING node_id
  )
  SELECT COUNT(*) INTO pruned_count FROM deleted;

  RETURN pruned_count;
END;
$$ LANGUAGE plpgsql;

-- Function 3: GDPR erasure cascade for organizational memory
-- Removes all contributions from a specific user and recalculates org node confidence
CREATE OR REPLACE FUNCTION org_memory_erasure_cascade(
  p_tenant_id UUID,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  contributions_deleted INTEGER := 0;
  nodes_deleted INTEGER := 0;
  nodes_updated INTEGER := 0;
  consents_revoked INTEGER := 0;
BEGIN
  -- 1. Revoke all consents
  UPDATE org_memory_consents
  SET is_active = false, revoked_at = NOW()
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND is_active = true;
  GET DIAGNOSTICS consents_revoked = ROW_COUNT;

  -- 2. Delete all contributions
  DELETE FROM org_memory_contributions
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
  GET DIAGNOSTICS contributions_deleted = ROW_COUNT;

  -- 3. Recalculate contributor counts on affected org nodes
  UPDATE org_memory_nodes SET
    contributor_count = (
      SELECT COUNT(DISTINCT omc.user_id)
      FROM org_memory_contributions omc
      WHERE omc.org_node_id = org_memory_nodes.node_id
    ),
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND node_id IN (
      SELECT DISTINCT org_node_id FROM org_memory_contributions
      WHERE tenant_id = p_tenant_id
    );
  GET DIAGNOSTICS nodes_updated = ROW_COUNT;

  -- 4. Delete org nodes with zero contributors
  DELETE FROM org_memory_nodes
  WHERE tenant_id = p_tenant_id AND contributor_count = 0;
  GET DIAGNOSTICS nodes_deleted = ROW_COUNT;

  -- 5. Log the erasure
  INSERT INTO org_memory_audit_log (tenant_id, user_id, action, details, compliance_framework)
  VALUES (
    p_tenant_id, p_user_id, 'erasure_completed',
    jsonb_build_object(
      'contributions_deleted', contributions_deleted,
      'nodes_deleted', nodes_deleted,
      'nodes_updated', nodes_updated,
      'consents_revoked', consents_revoked
    ),
    '{gdpr,ccpa}'
  );

  RETURN jsonb_build_object(
    'contributions_deleted', contributions_deleted,
    'nodes_deleted', nodes_deleted,
    'nodes_updated', nodes_updated,
    'consents_revoked', consents_revoked
  );
END;
$$ LANGUAGE plpgsql;

-- Function 4: Compute prefetch prediction accuracy for a user
CREATE OR REPLACE FUNCTION compute_prefetch_accuracy(
  p_tenant_id UUID,
  p_user_id UUID,
  p_period_hours INTEGER DEFAULT 24
) RETURNS JSONB AS $$
DECLARE
  total_predictions INTEGER;
  used_predictions INTEGER;
  accuracy DECIMAL(5,4);
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE was_used = true)
  INTO total_predictions, used_predictions
  FROM prefetch_predictions
  WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id
    AND created_at > NOW() - (p_period_hours || ' hours')::INTERVAL;

  IF total_predictions > 0 THEN
    accuracy := used_predictions::DECIMAL / total_predictions;
  ELSE
    accuracy := 0;
  END IF;

  RETURN jsonb_build_object(
    'total_predictions', total_predictions,
    'used_predictions', used_predictions,
    'accuracy', accuracy,
    'period_hours', p_period_hours
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE akg_config IS 'Per-tenant configuration for the Autobiographical Knowledge Graph extraction system';
COMMENT ON TABLE akg_nodes IS 'Entities extracted from user conversations forming a living knowledge graph';
COMMENT ON TABLE akg_edges IS 'Directed relationships between AKG entities with temporal context';
COMMENT ON TABLE akg_extraction_log IS 'Audit trail of entity extraction runs per conversation';
COMMENT ON TABLE prefetch_config IS 'Per-tenant configuration for predictive memory prefetch';
COMMENT ON TABLE memory_access_patterns IS 'Training data for the prefetch prediction model (partitioned monthly)';
COMMENT ON TABLE prefetch_predictions IS 'Prefetch prediction results with feedback loop tracking';
COMMENT ON TABLE contradiction_config IS 'Per-tenant configuration for memory contradiction detection';
COMMENT ON TABLE memory_contradictions IS 'Detected contradictions between memory facts with resolution tracking';
COMMENT ON TABLE org_memory_config IS 'Per-tenant configuration for organizational memory mesh with regulatory compliance settings';
COMMENT ON TABLE org_memory_nodes IS 'Shared organizational knowledge nodes with privacy tiers and data classification';
COMMENT ON TABLE org_memory_consents IS 'GDPR Art. 6/7 consent records for organizational memory sharing';
COMMENT ON TABLE org_memory_contributions IS 'Tracks which user memories contributed to org knowledge (for GDPR erasure cascade)';
COMMENT ON TABLE org_memory_audit_log IS 'SOC2 Type II compliance audit log for all org memory operations (partitioned monthly)';
COMMENT ON TABLE dream_insight_config IS 'Per-tenant configuration for the Dream Insight Generator';
COMMENT ON TABLE dream_insights IS 'Insights generated during Twilight Dreaming by analyzing memory patterns';

COMMENT ON FUNCTION compute_akg_node_importance IS 'Recomputes importance scores for all AKG nodes using frequency (40%), recency (30%), and centrality (30%)';
COMMENT ON FUNCTION prune_stale_akg_nodes IS 'Removes AKG nodes not seen in N days with low importance and few mentions';
COMMENT ON FUNCTION org_memory_erasure_cascade IS 'GDPR right-to-erasure: removes all user contributions from org memory and recalculates confidence';
COMMENT ON FUNCTION compute_prefetch_accuracy IS 'Computes prefetch prediction accuracy for feedback loop optimization';
