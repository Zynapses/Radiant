-- ============================================================================
-- RADIANT v5.53.0 - Universal Envelope Protocol v2.0
-- Multi-modal, streaming, asynchronous AI communication protocol
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE uep_envelope_type AS ENUM (
  -- Pipeline envelopes (UEP v1.0 compatible)
  'method.output',
  'method.input',
  
  -- Streaming envelopes
  'stream.start',
  'stream.chunk',
  'stream.end',
  'stream.error',
  'stream.cancel',
  
  -- Artifact envelopes
  'artifact.created',
  'artifact.reference',
  
  -- Control envelopes
  'control.ack',
  'control.nack',
  'control.heartbeat',
  'control.capability',
  
  -- Event envelopes
  'event.checkpoint',
  'event.progress',
  'event.error'
);

CREATE TYPE uep_source_type AS ENUM (
  'method',      -- Cato method
  'tool',        -- Cato tool (Lambda, MCP)
  'model',       -- AI model directly
  'agent',       -- Agent (Curator, Think Tank)
  'service',     -- Backend service
  'user',        -- Human user
  'external'     -- External system
);

CREATE TYPE uep_delivery_type AS ENUM (
  'inline',      -- Content embedded in envelope
  'reference',   -- Content stored externally
  'chunked'      -- Content delivered in chunks
);

CREATE TYPE uep_stream_status AS ENUM (
  'active',
  'completed',
  'failed',
  'cancelled',
  'paused'
);

CREATE TYPE uep_storage_protocol AS ENUM (
  'https',
  's3',
  'radiant',
  'ipfs',
  'data'
);

CREATE TYPE uep_access_method AS ENUM (
  'presigned_url',
  'bearer_token',
  'api_key',
  'public'
);

CREATE TYPE uep_hash_algorithm AS ENUM (
  'sha256',
  'sha384',
  'sha512',
  'blake3'
);

CREATE TYPE uep_priority AS ENUM (
  'low',
  'normal',
  'high',
  'critical'
);

CREATE TYPE uep_data_classification AS ENUM (
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED'
);

CREATE TYPE uep_encryption_algorithm AS ENUM (
  'aes-256-gcm',
  'chacha20-poly1305',
  'mls'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Extended envelope table for v2.0
CREATE TABLE uep_envelopes_v2 (
  envelope_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specversion VARCHAR(10) NOT NULL DEFAULT '2.0',
  type uep_envelope_type NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Source
  source_id VARCHAR(255) NOT NULL,
  source_type uep_source_type NOT NULL,
  source_name VARCHAR(255),
  source_version VARCHAR(50),
  source_registry_ref JSONB,
  source_ai_model JSONB,
  source_capabilities TEXT[],
  source_execution_context JSONB,
  
  -- Destination
  destination_id VARCHAR(255),
  destination_type uep_source_type,
  destination_routing_key VARCHAR(255),
  destination_routing_reason TEXT,
  destination_delivery JSONB,
  destination_expects_response BOOLEAN DEFAULT FALSE,
  destination_response_timeout_ms INTEGER,
  destination_response_callback JSONB,
  
  -- Payload
  payload_content_type VARCHAR(255) NOT NULL,
  payload_content_encoding VARCHAR(50),
  payload_delivery uep_delivery_type NOT NULL,
  payload_data JSONB,
  payload_data_binary BYTEA,
  payload_reference JSONB,
  payload_parts JSONB,
  payload_schema_ref VARCHAR(255),
  payload_schema_version VARCHAR(50),
  payload_hash_algorithm uep_hash_algorithm,
  payload_hash_value VARCHAR(128),
  payload_size_bytes BIGINT,
  
  -- Streaming
  stream_id UUID,
  sequence_current INTEGER,
  sequence_total INTEGER,
  sequence_is_first BOOLEAN DEFAULT FALSE,
  sequence_is_last BOOLEAN DEFAULT FALSE,
  progress_bytes_transferred BIGINT,
  progress_bytes_total BIGINT,
  progress_percent_complete DECIMAL(5, 2),
  progress_estimated_remaining_ms INTEGER,
  resumable BOOLEAN DEFAULT FALSE,
  resume_token VARCHAR(255),
  upload_offset BIGINT,
  requires_ordering BOOLEAN DEFAULT TRUE,
  completion_callback JSONB,
  
  -- Tracing
  trace_id VARCHAR(64) NOT NULL,
  span_id VARCHAR(32) NOT NULL,
  parent_span_id VARCHAR(32),
  tracing_baggage JSONB,
  
  -- Governance - Confidence
  confidence_score DECIMAL(4, 3),
  confidence_factors JSONB,
  
  -- Governance - Risk
  risk_signals JSONB,
  
  -- Governance - Compliance
  compliance_frameworks TEXT[],
  compliance_data_classification uep_data_classification,
  compliance_contains_pii BOOLEAN DEFAULT FALSE,
  compliance_contains_phi BOOLEAN DEFAULT FALSE,
  compliance_retention_days INTEGER,
  
  -- Metrics
  metrics_duration_ms INTEGER,
  metrics_cost_cents DECIMAL(10, 4),
  metrics_tokens_used INTEGER,
  metrics_model_id VARCHAR(100),
  metrics_provider VARCHAR(50),
  
  -- Context
  context_history_count INTEGER,
  context_pruning_applied VARCHAR(20),
  context_tokens_estimate INTEGER,
  
  -- Security
  encryption_algorithm uep_encryption_algorithm,
  encryption_key_id VARCHAR(255),
  signature_algorithm VARCHAR(50),
  signature_value TEXT,
  signature_key_id VARCHAR(255),
  
  -- Extensions
  extensions JSONB,
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uep_envelopes_v2_stream_sequence_unique 
    UNIQUE (stream_id, sequence_current) WHERE stream_id IS NOT NULL,
  CONSTRAINT uep_envelopes_v2_confidence_range
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  CONSTRAINT uep_envelopes_v2_progress_range
    CHECK (progress_percent_complete IS NULL OR (progress_percent_complete >= 0 AND progress_percent_complete <= 100))
);

-- Indexes for common queries
CREATE INDEX idx_uep_envelopes_v2_tenant_time ON uep_envelopes_v2(tenant_id, timestamp DESC);
CREATE INDEX idx_uep_envelopes_v2_stream ON uep_envelopes_v2(stream_id, sequence_current) WHERE stream_id IS NOT NULL;
CREATE INDEX idx_uep_envelopes_v2_trace ON uep_envelopes_v2(trace_id);
CREATE INDEX idx_uep_envelopes_v2_source ON uep_envelopes_v2(source_id, source_type);
CREATE INDEX idx_uep_envelopes_v2_destination ON uep_envelopes_v2(destination_id) WHERE destination_id IS NOT NULL;
CREATE INDEX idx_uep_envelopes_v2_type ON uep_envelopes_v2(type);
CREATE INDEX idx_uep_envelopes_v2_pipeline ON uep_envelopes_v2(tenant_id, (source_execution_context->>'pipelineId')) 
  WHERE source_execution_context->>'pipelineId' IS NOT NULL;

-- Partial index for active streams
CREATE INDEX idx_uep_envelopes_v2_active_streams 
  ON uep_envelopes_v2(stream_id, timestamp DESC) 
  WHERE type IN ('stream.start', 'stream.chunk') 
    AND sequence_is_last = FALSE;

-- GIN index for JSONB queries
CREATE INDEX idx_uep_envelopes_v2_extensions ON uep_envelopes_v2 USING GIN(extensions);
CREATE INDEX idx_uep_envelopes_v2_source_context ON uep_envelopes_v2 USING GIN(source_execution_context);

-- ============================================================================
-- STREAM MANAGEMENT
-- ============================================================================

CREATE TABLE uep_streams (
  stream_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Stream metadata
  content_type VARCHAR(255) NOT NULL,
  total_size_bytes BIGINT,
  total_chunks INTEGER,
  chunk_size_bytes INTEGER DEFAULT 1048576, -- 1MB default
  
  -- Status
  status uep_stream_status NOT NULL DEFAULT 'active',
  error_message TEXT,
  error_code VARCHAR(50),
  
  -- Resume info
  last_chunk_sequence INTEGER DEFAULT 0,
  last_chunk_offset BIGINT DEFAULT 0,
  resume_token VARCHAR(255),
  resume_expiry TIMESTAMPTZ,
  
  -- Source/destination
  source_id VARCHAR(255) NOT NULL,
  source_type uep_source_type NOT NULL,
  destination_id VARCHAR(255),
  destination_type uep_source_type,
  
  -- Tracing
  trace_id VARCHAR(64) NOT NULL,
  parent_span_id VARCHAR(32),
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_chunk_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  timeout_seconds INTEGER DEFAULT 3600, -- 1 hour default
  
  -- Final artifact reference
  final_artifact_id UUID,
  final_artifact_uri TEXT,
  final_artifact_hash_algorithm uep_hash_algorithm,
  final_artifact_hash_value VARCHAR(128),
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uep_streams_status_check 
    CHECK (status IN ('active', 'completed', 'failed', 'cancelled', 'paused'))
);

CREATE INDEX idx_uep_streams_tenant ON uep_streams(tenant_id, started_at DESC);
CREATE INDEX idx_uep_streams_active ON uep_streams(status, expires_at) WHERE status = 'active';
CREATE INDEX idx_uep_streams_trace ON uep_streams(trace_id);
CREATE INDEX idx_uep_streams_source ON uep_streams(source_id, source_type);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION uep_streams_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uep_streams_updated_at
  BEFORE UPDATE ON uep_streams
  FOR EACH ROW
  EXECUTE FUNCTION uep_streams_update_timestamp();

-- ============================================================================
-- ARTIFACT REGISTRY
-- ============================================================================

CREATE TABLE uep_artifacts (
  artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Content info
  content_type VARCHAR(255) NOT NULL,
  filename VARCHAR(500),
  size_bytes BIGINT NOT NULL,
  
  -- Storage
  storage_protocol uep_storage_protocol NOT NULL,
  storage_uri TEXT NOT NULL,
  storage_region VARCHAR(50),
  storage_bucket VARCHAR(255),
  storage_key TEXT,
  
  -- Access
  access_method uep_access_method NOT NULL DEFAULT 'presigned_url',
  supports_range_requests BOOLEAN DEFAULT TRUE,
  
  -- Integrity
  hash_algorithm uep_hash_algorithm NOT NULL,
  hash_value VARCHAR(128) NOT NULL,
  
  -- Source
  source_envelope_id UUID REFERENCES uep_envelopes_v2(envelope_id),
  source_stream_id UUID REFERENCES uep_streams(stream_id),
  source_id VARCHAR(255),
  source_type uep_source_type,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB,
  tags TEXT[],
  
  -- Constraints
  CONSTRAINT uep_artifacts_hash_unique UNIQUE (tenant_id, hash_algorithm, hash_value)
);

CREATE INDEX idx_uep_artifacts_tenant ON uep_artifacts(tenant_id, created_at DESC);
CREATE INDEX idx_uep_artifacts_hash ON uep_artifacts(hash_algorithm, hash_value);
CREATE INDEX idx_uep_artifacts_stream ON uep_artifacts(source_stream_id) WHERE source_stream_id IS NOT NULL;
CREATE INDEX idx_uep_artifacts_envelope ON uep_artifacts(source_envelope_id) WHERE source_envelope_id IS NOT NULL;
CREATE INDEX idx_uep_artifacts_tags ON uep_artifacts USING GIN(tags);
CREATE INDEX idx_uep_artifacts_active ON uep_artifacts(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- ENCRYPTION KEY MANAGEMENT
-- ============================================================================

CREATE TABLE uep_encryption_keys (
  key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Key info
  key_type VARCHAR(50) NOT NULL, -- 'envelope', 'stream', 'artifact'
  algorithm uep_encryption_algorithm NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  
  -- KMS reference (we don't store actual keys)
  kms_key_arn TEXT NOT NULL,
  kms_region VARCHAR(50) NOT NULL,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  
  -- Rotation
  rotated_from_key_id UUID REFERENCES uep_encryption_keys(key_id),
  rotation_reason TEXT,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uep_encryption_keys_version_unique UNIQUE (tenant_id, key_type, key_version)
);

CREATE INDEX idx_uep_encryption_keys_tenant ON uep_encryption_keys(tenant_id, key_type);
CREATE INDEX idx_uep_encryption_keys_active ON uep_encryption_keys(tenant_id, key_type, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- SIGNATURE VERIFICATION LOG
-- ============================================================================

CREATE TABLE uep_signature_verifications (
  verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  envelope_id UUID NOT NULL REFERENCES uep_envelopes_v2(envelope_id),
  
  -- Verification details
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_valid BOOLEAN NOT NULL,
  failure_reason TEXT,
  
  -- Key info
  signature_algorithm VARCHAR(50) NOT NULL,
  key_id VARCHAR(255) NOT NULL,
  
  -- Verifier
  verified_by VARCHAR(255) NOT NULL, -- service/agent that verified
  
  -- Metadata
  metadata JSONB
);

CREATE INDEX idx_uep_signature_verifications_envelope ON uep_signature_verifications(envelope_id);
CREATE INDEX idx_uep_signature_verifications_tenant ON uep_signature_verifications(tenant_id, verified_at DESC);

-- ============================================================================
-- ROUTING TABLE (for cross-subsystem routing)
-- ============================================================================

CREATE TABLE uep_routing_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id), -- NULL for system-wide rules
  
  -- Matching criteria
  source_type uep_source_type,
  source_id_pattern VARCHAR(255), -- supports wildcards
  envelope_type uep_envelope_type,
  content_type_pattern VARCHAR(255), -- supports wildcards
  
  -- Routing target
  target_subsystem VARCHAR(50) NOT NULL, -- cato, brain, cortex, genesis, etc.
  target_endpoint TEXT NOT NULL,
  target_method VARCHAR(10) DEFAULT 'POST',
  
  -- Priority (lower = higher priority)
  priority INTEGER NOT NULL DEFAULT 100,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Metadata
  description TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uep_routing_rules_active ON uep_routing_rules(is_active, priority) WHERE is_active = TRUE;
CREATE INDEX idx_uep_routing_rules_tenant ON uep_routing_rules(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- DEAD LETTER QUEUE
-- ============================================================================

CREATE TABLE uep_dead_letters (
  dead_letter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  envelope_id UUID NOT NULL REFERENCES uep_envelopes_v2(envelope_id),
  
  -- Failure info
  failure_reason TEXT NOT NULL,
  failure_code VARCHAR(50),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  
  -- Original destination
  original_destination_id VARCHAR(255),
  original_destination_type uep_source_type,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, retrying, failed, resolved
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  CONSTRAINT uep_dead_letters_status_check
    CHECK (status IN ('pending', 'retrying', 'failed', 'resolved'))
);

CREATE INDEX idx_uep_dead_letters_tenant ON uep_dead_letters(tenant_id, created_at DESC);
CREATE INDEX idx_uep_dead_letters_pending ON uep_dead_letters(status, next_retry_at) 
  WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_uep_dead_letters_envelope ON uep_dead_letters(envelope_id);

-- ============================================================================
-- METRICS & ANALYTICS
-- ============================================================================

CREATE TABLE uep_metrics (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Time bucket (1-minute granularity)
  bucket_time TIMESTAMPTZ NOT NULL,
  
  -- Dimensions
  source_type uep_source_type,
  envelope_type uep_envelope_type,
  content_type VARCHAR(255),
  
  -- Counts
  envelope_count BIGINT NOT NULL DEFAULT 0,
  stream_count BIGINT NOT NULL DEFAULT 0,
  artifact_count BIGINT NOT NULL DEFAULT 0,
  error_count BIGINT NOT NULL DEFAULT 0,
  
  -- Sizes
  total_bytes_transferred BIGINT NOT NULL DEFAULT 0,
  avg_payload_size_bytes BIGINT,
  
  -- Timing
  avg_latency_ms INTEGER,
  p50_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  p99_latency_ms INTEGER,
  
  -- Cost
  total_cost_cents DECIMAL(12, 4) DEFAULT 0,
  
  CONSTRAINT uep_metrics_bucket_unique UNIQUE (tenant_id, bucket_time, source_type, envelope_type, content_type)
);

CREATE INDEX idx_uep_metrics_tenant_time ON uep_metrics(tenant_id, bucket_time DESC);
CREATE INDEX idx_uep_metrics_bucket ON uep_metrics(bucket_time DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE uep_envelopes_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE uep_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE uep_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE uep_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE uep_signature_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE uep_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE uep_dead_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE uep_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for tenant isolation
CREATE POLICY uep_envelopes_v2_tenant_isolation ON uep_envelopes_v2
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY uep_streams_tenant_isolation ON uep_streams
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY uep_artifacts_tenant_isolation ON uep_artifacts
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY uep_encryption_keys_tenant_isolation ON uep_encryption_keys
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY uep_signature_verifications_tenant_isolation ON uep_signature_verifications
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY uep_routing_rules_tenant_isolation ON uep_routing_rules
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY uep_dead_letters_tenant_isolation ON uep_dead_letters
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY uep_metrics_tenant_isolation ON uep_metrics
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get stream progress
CREATE OR REPLACE FUNCTION uep_get_stream_progress(p_stream_id UUID)
RETURNS TABLE (
  stream_id UUID,
  status uep_stream_status,
  chunks_received INTEGER,
  total_chunks INTEGER,
  bytes_transferred BIGINT,
  total_bytes BIGINT,
  percent_complete DECIMAL(5, 2),
  estimated_remaining_ms INTEGER,
  last_chunk_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.stream_id,
    s.status,
    s.last_chunk_sequence AS chunks_received,
    s.total_chunks,
    s.last_chunk_offset AS bytes_transferred,
    s.total_size_bytes AS total_bytes,
    CASE 
      WHEN s.total_size_bytes > 0 THEN 
        ROUND((s.last_chunk_offset::DECIMAL / s.total_size_bytes) * 100, 2)
      WHEN s.total_chunks > 0 THEN 
        ROUND((s.last_chunk_sequence::DECIMAL / s.total_chunks) * 100, 2)
      ELSE 0
    END AS percent_complete,
    CASE 
      WHEN s.last_chunk_at IS NOT NULL AND s.last_chunk_sequence > 0 THEN
        ROUND(
          EXTRACT(EPOCH FROM (s.last_chunk_at - s.started_at)) * 1000 / s.last_chunk_sequence * 
          (COALESCE(s.total_chunks, 0) - s.last_chunk_sequence)
        )::INTEGER
      ELSE NULL
    END AS estimated_remaining_ms,
    s.last_chunk_at
  FROM uep_streams s
  WHERE s.stream_id = p_stream_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate resume token
CREATE OR REPLACE FUNCTION uep_generate_resume_token(p_stream_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := encode(
    digest(
      p_stream_id::TEXT || NOW()::TEXT || random()::TEXT,
      'sha256'
    ),
    'base64'
  );
  
  UPDATE uep_streams
  SET resume_token = v_token,
      resume_expiry = NOW() + INTERVAL '24 hours'
  WHERE stream_id = p_stream_id;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- Function to validate resume token
CREATE OR REPLACE FUNCTION uep_validate_resume_token(p_stream_id UUID, p_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT (resume_token = p_token AND resume_expiry > NOW())
  INTO v_valid
  FROM uep_streams
  WHERE stream_id = p_stream_id;
  
  RETURN COALESCE(v_valid, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to record metrics
CREATE OR REPLACE FUNCTION uep_record_metric(
  p_tenant_id UUID,
  p_source_type uep_source_type,
  p_envelope_type uep_envelope_type,
  p_content_type VARCHAR(255),
  p_bytes BIGINT DEFAULT 0,
  p_latency_ms INTEGER DEFAULT NULL,
  p_cost_cents DECIMAL(12, 4) DEFAULT 0,
  p_is_error BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  v_bucket_time TIMESTAMPTZ;
BEGIN
  -- Round to nearest minute
  v_bucket_time := date_trunc('minute', NOW());
  
  INSERT INTO uep_metrics (
    tenant_id, bucket_time, source_type, envelope_type, content_type,
    envelope_count, total_bytes_transferred, total_cost_cents, error_count
  )
  VALUES (
    p_tenant_id, v_bucket_time, p_source_type, p_envelope_type, p_content_type,
    1, p_bytes, p_cost_cents, CASE WHEN p_is_error THEN 1 ELSE 0 END
  )
  ON CONFLICT (tenant_id, bucket_time, source_type, envelope_type, content_type)
  DO UPDATE SET
    envelope_count = uep_metrics.envelope_count + 1,
    total_bytes_transferred = uep_metrics.total_bytes_transferred + EXCLUDED.total_bytes_transferred,
    total_cost_cents = uep_metrics.total_cost_cents + EXCLUDED.total_cost_cents,
    error_count = uep_metrics.error_count + EXCLUDED.error_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON uep_envelopes_v2 TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON uep_streams TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON uep_artifacts TO radiant_app;
GRANT SELECT, INSERT ON uep_encryption_keys TO radiant_app;
GRANT SELECT, INSERT ON uep_signature_verifications TO radiant_app;
GRANT SELECT ON uep_routing_rules TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON uep_dead_letters TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON uep_metrics TO radiant_app;

GRANT EXECUTE ON FUNCTION uep_get_stream_progress TO radiant_app;
GRANT EXECUTE ON FUNCTION uep_generate_resume_token TO radiant_app;
GRANT EXECUTE ON FUNCTION uep_validate_resume_token TO radiant_app;
GRANT EXECUTE ON FUNCTION uep_record_metric TO radiant_app;

-- Admin grants
GRANT ALL ON uep_routing_rules TO radiant_admin;
GRANT UPDATE ON uep_encryption_keys TO radiant_admin;
