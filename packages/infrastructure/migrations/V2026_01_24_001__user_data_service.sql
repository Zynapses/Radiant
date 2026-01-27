-- ============================================================================
-- USER DATA SERVICE (UDS) v1.0.0
-- Tiered Storage for User-Generated Content: Chats, Audits, Results, Uploads
-- Scale Target: 1M+ concurrent users
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE uds_message_role AS ENUM ('system', 'user', 'assistant', 'tool');
CREATE TYPE uds_conversation_status AS ENUM ('active', 'archived', 'deleted', 'forked');
CREATE TYPE uds_upload_status AS ENUM ('pending', 'scanning', 'clean', 'infected', 'processing', 'ready', 'failed', 'deleted');
CREATE TYPE uds_upload_source AS ENUM ('direct', 'paste', 'api', 'integration', 'import');
CREATE TYPE uds_content_type AS ENUM (
    'text', 'markdown', 'code', 'json', 'xml', 'html', 'csv',
    'image', 'pdf', 'document', 'spreadsheet', 'presentation',
    'audio', 'video', 'archive', 'binary', 'unknown'
);
CREATE TYPE uds_tier AS ENUM ('hot', 'warm', 'cold', 'glacier');
CREATE TYPE uds_audit_category AS ENUM (
    'auth', 'conversation', 'message', 'upload', 'export', 'admin', 
    'billing', 'security', 'compliance', 'system', 'gdpr'
);
CREATE TYPE uds_erasure_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'partial');
CREATE TYPE uds_erasure_scope AS ENUM ('user', 'conversation', 'tenant');

-- ============================================================================
-- UDS CONFIGURATION (Per-Tenant)
-- ============================================================================

CREATE TABLE uds_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Hot Tier Config
    hot_tier_enabled BOOLEAN DEFAULT true,
    hot_session_ttl_seconds INTEGER DEFAULT 14400,  -- 4 hours
    hot_message_ttl_seconds INTEGER DEFAULT 86400,  -- 24 hours
    hot_cache_max_conversations INTEGER DEFAULT 1000,
    
    -- Warm Tier Config
    warm_tier_enabled BOOLEAN DEFAULT true,
    warm_retention_days INTEGER DEFAULT 90,
    warm_full_text_search_enabled BOOLEAN DEFAULT true,
    warm_vector_search_enabled BOOLEAN DEFAULT true,
    
    -- Cold Tier Config
    cold_tier_enabled BOOLEAN DEFAULT true,
    cold_compression_enabled BOOLEAN DEFAULT true,
    cold_compression_algorithm VARCHAR(20) DEFAULT 'zstd',
    cold_retention_years INTEGER DEFAULT 7,
    
    -- Upload Config
    max_upload_size_mb INTEGER DEFAULT 100,
    allowed_file_types TEXT[] DEFAULT ARRAY[
        'pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt', 'md', 'json', 'xml',
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff',
        'mp3', 'wav', 'ogg', 'm4a',
        'mp4', 'webm', 'mov',
        'zip', 'tar', 'gz'
    ],
    virus_scan_enabled BOOLEAN DEFAULT true,
    auto_extract_text BOOLEAN DEFAULT true,
    generate_thumbnails BOOLEAN DEFAULT true,
    
    -- Security Config
    encryption_enabled BOOLEAN DEFAULT true,
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    per_user_encryption_keys BOOLEAN DEFAULT false,
    audit_log_enabled BOOLEAN DEFAULT true,
    merkle_chain_enabled BOOLEAN DEFAULT true,
    
    -- GDPR Config
    gdpr_auto_delete_enabled BOOLEAN DEFAULT false,
    gdpr_retention_days INTEGER DEFAULT 2555,  -- 7 years
    gdpr_anonymize_on_delete BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id)
);

-- ============================================================================
-- ENCRYPTION KEYS
-- ============================================================================

CREATE TABLE uds_encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = tenant-level key
    
    key_id VARCHAR(255) NOT NULL,  -- KMS key ID or alias
    key_type VARCHAR(50) NOT NULL DEFAULT 'tenant',  -- 'tenant', 'user', 'conversation'
    algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    
    -- Key metadata
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    
    -- Rotation tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, user_id, version)
);

CREATE INDEX idx_uds_encryption_keys_tenant ON uds_encryption_keys(tenant_id) WHERE is_active = true;
CREATE INDEX idx_uds_encryption_keys_user ON uds_encryption_keys(tenant_id, user_id) WHERE is_active = true;

-- ============================================================================
-- CONVERSATIONS
-- ============================================================================

CREATE TABLE uds_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Conversation metadata
    title VARCHAR(500),
    title_generated BOOLEAN DEFAULT false,
    summary TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Model configuration
    model_id VARCHAR(100),
    system_prompt_id UUID,
    persona_id UUID,
    temperature DECIMAL(3,2),
    max_tokens INTEGER,
    
    -- Statistics
    message_count INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cost_credits DECIMAL(12,6) DEFAULT 0,
    attachment_count INTEGER DEFAULT 0,
    
    -- Time Machine (forking)
    parent_conversation_id UUID REFERENCES uds_conversations(id),
    fork_point_message_id UUID,
    fork_sequence_number INTEGER,
    branch_name VARCHAR(200),
    is_checkpoint BOOLEAN DEFAULT false,
    checkpoint_name VARCHAR(200),
    
    -- Collaboration
    is_shared BOOLEAN DEFAULT false,
    shared_with_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
    collaboration_mode VARCHAR(50),  -- 'view', 'comment', 'edit'
    
    -- Status and lifecycle
    status uds_conversation_status DEFAULT 'active',
    starred BOOLEAN DEFAULT false,
    pinned BOOLEAN DEFAULT false,
    
    -- Tiering
    current_tier uds_tier DEFAULT 'hot',
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    promoted_to_warm_at TIMESTAMPTZ,
    archived_to_cold_at TIMESTAMPTZ,
    
    -- Encryption
    encryption_key_id UUID REFERENCES uds_encryption_keys(id),
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_uds_conversations_tenant_user ON uds_conversations(tenant_id, user_id);
CREATE INDEX idx_uds_conversations_status ON uds_conversations(tenant_id, status) WHERE status = 'active';
CREATE INDEX idx_uds_conversations_last_accessed ON uds_conversations(tenant_id, last_accessed_at DESC);
CREATE INDEX idx_uds_conversations_tier ON uds_conversations(tenant_id, current_tier);
CREATE INDEX idx_uds_conversations_parent ON uds_conversations(parent_conversation_id) WHERE parent_conversation_id IS NOT NULL;
CREATE INDEX idx_uds_conversations_tags ON uds_conversations USING GIN(tags);
CREATE INDEX idx_uds_conversations_shared ON uds_conversations(tenant_id) WHERE is_shared = true;

-- Full-text search on title and summary
CREATE INDEX idx_uds_conversations_fts ON uds_conversations 
    USING GIN(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(summary, '')));

-- ============================================================================
-- MESSAGES
-- ============================================================================

CREATE TABLE uds_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    conversation_id UUID NOT NULL REFERENCES uds_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Message content (encrypted)
    role uds_message_role NOT NULL,
    content_encrypted BYTEA,  -- NULL for tool calls
    content_iv BYTEA,         -- Initialization vector
    content_length INTEGER,   -- Original length for display
    content_hash VARCHAR(64), -- SHA-256 for deduplication
    
    -- For tool/function calls
    tool_call_id VARCHAR(100),
    tool_name VARCHAR(200),
    tool_arguments_encrypted BYTEA,
    tool_result_encrypted BYTEA,
    
    -- Token usage
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_credits DECIMAL(12,6),
    
    -- Model info
    model_id VARCHAR(100),
    model_response_id VARCHAR(255),  -- Provider's response ID
    finish_reason VARCHAR(50),
    
    -- Attachments
    attachment_ids UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Time Machine support
    sequence_number INTEGER NOT NULL,
    is_checkpoint BOOLEAN DEFAULT false,
    checkpoint_name VARCHAR(200),
    
    -- Editing
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    original_content_encrypted BYTEA,
    edit_count INTEGER DEFAULT 0,
    
    -- Reactions and feedback
    user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
    user_feedback TEXT,
    flagged BOOLEAN DEFAULT false,
    flag_reason VARCHAR(200),
    
    -- Streaming
    is_streaming BOOLEAN DEFAULT false,
    stream_completed_at TIMESTAMPTZ,
    
    -- Tiering
    current_tier uds_tier DEFAULT 'hot',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uds_messages_conversation ON uds_messages(conversation_id, sequence_number);
CREATE INDEX idx_uds_messages_tenant_user ON uds_messages(tenant_id, user_id);
CREATE INDEX idx_uds_messages_created ON uds_messages(tenant_id, created_at DESC);
CREATE INDEX idx_uds_messages_tier ON uds_messages(tenant_id, current_tier);
CREATE INDEX idx_uds_messages_checkpoints ON uds_messages(conversation_id) WHERE is_checkpoint = true;
CREATE INDEX idx_uds_messages_flagged ON uds_messages(tenant_id) WHERE flagged = true;
CREATE INDEX idx_uds_messages_hash ON uds_messages(content_hash) WHERE content_hash IS NOT NULL;

-- ============================================================================
-- MESSAGE ATTACHMENTS (Inline content like code blocks, images)
-- ============================================================================

CREATE TABLE uds_message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    message_id UUID NOT NULL REFERENCES uds_messages(id) ON DELETE CASCADE,
    
    -- Attachment metadata
    attachment_type VARCHAR(50) NOT NULL,  -- 'code', 'image', 'file', 'link'
    content_type uds_content_type NOT NULL,
    mime_type VARCHAR(100),
    
    -- For code blocks
    language VARCHAR(50),
    filename VARCHAR(255),
    
    -- Content (encrypted, inline for small items)
    content_encrypted BYTEA,
    content_iv BYTEA,
    content_size INTEGER,
    
    -- For file references
    upload_id UUID REFERENCES uds_uploads(id),
    
    -- Display
    display_order INTEGER DEFAULT 0,
    alt_text VARCHAR(500),
    caption TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uds_message_attachments_message ON uds_message_attachments(message_id);
CREATE INDEX idx_uds_message_attachments_upload ON uds_message_attachments(upload_id) WHERE upload_id IS NOT NULL;

-- ============================================================================
-- UPLOADS (Files, Documents, Images)
-- ============================================================================

CREATE TABLE uds_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES uds_conversations(id) ON DELETE SET NULL,
    
    -- File metadata
    original_filename VARCHAR(500) NOT NULL,
    sanitized_filename VARCHAR(500) NOT NULL,
    file_extension VARCHAR(20),
    mime_type VARCHAR(100) NOT NULL,
    content_type uds_content_type NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    
    -- Storage location
    storage_bucket VARCHAR(255) NOT NULL,
    storage_key VARCHAR(1000) NOT NULL,
    storage_class VARCHAR(50) DEFAULT 'STANDARD',
    
    -- Encryption
    encryption_key_id UUID REFERENCES uds_encryption_keys(id),
    encrypted BOOLEAN DEFAULT true,
    
    -- Content hashes
    sha256_hash VARCHAR(64) NOT NULL,
    md5_hash VARCHAR(32),
    content_fingerprint VARCHAR(100),  -- For duplicate detection
    
    -- Processing status
    status uds_upload_status DEFAULT 'pending',
    upload_source uds_upload_source DEFAULT 'direct',
    
    -- Virus scanning
    virus_scan_status VARCHAR(50) DEFAULT 'pending',
    virus_scan_result JSONB,
    scanned_at TIMESTAMPTZ,
    
    -- Content extraction
    extracted_text TEXT,
    extracted_text_encrypted BYTEA,
    text_extraction_status VARCHAR(50),
    text_extraction_error TEXT,
    
    -- Vector embedding for semantic search
    embedding vector(1536),
    embedding_model VARCHAR(100),
    embedded_at TIMESTAMPTZ,
    
    -- Thumbnails (for images, videos, documents)
    thumbnail_key VARCHAR(1000),
    thumbnail_generated BOOLEAN DEFAULT false,
    preview_key VARCHAR(1000),
    
    -- Metadata extraction
    extracted_metadata JSONB DEFAULT '{}',
    -- For images: width, height, exif
    -- For documents: page_count, author, created_date
    -- For audio/video: duration, codec, bitrate
    
    -- OCR for images/PDFs
    ocr_text TEXT,
    ocr_status VARCHAR(50),
    ocr_confidence DECIMAL(5,4),
    
    -- Usage tracking
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    
    -- Tiering
    current_tier uds_tier DEFAULT 'warm',
    promoted_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    
    -- Lifecycle
    expires_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uds_uploads_tenant_user ON uds_uploads(tenant_id, user_id);
CREATE INDEX idx_uds_uploads_conversation ON uds_uploads(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_uds_uploads_status ON uds_uploads(tenant_id, status);
CREATE INDEX idx_uds_uploads_content_type ON uds_uploads(tenant_id, content_type);
CREATE INDEX idx_uds_uploads_hash ON uds_uploads(sha256_hash);
CREATE INDEX idx_uds_uploads_fingerprint ON uds_uploads(content_fingerprint) WHERE content_fingerprint IS NOT NULL;
CREATE INDEX idx_uds_uploads_tier ON uds_uploads(tenant_id, current_tier);
CREATE INDEX idx_uds_uploads_embedding ON uds_uploads USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_uds_uploads_fts ON uds_uploads USING GIN(to_tsvector('english', COALESCE(extracted_text, '') || ' ' || COALESCE(ocr_text, '')));

-- ============================================================================
-- UPLOAD CHUNKS (For large file uploads)
-- ============================================================================

CREATE TABLE uds_upload_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID NOT NULL,  -- Not FK because upload may not exist yet
    tenant_id UUID NOT NULL,
    
    chunk_number INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    chunk_size_bytes INTEGER NOT NULL,
    
    storage_key VARCHAR(1000) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(upload_id, chunk_number)
);

CREATE INDEX idx_uds_upload_chunks_upload ON uds_upload_chunks(upload_id);

-- ============================================================================
-- AUDIT LOG (Append-only, tamper-evident)
-- ============================================================================

CREATE TABLE uds_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,  -- NULL for system events
    
    -- Event identification
    event_type VARCHAR(100) NOT NULL,
    event_category uds_audit_category NOT NULL,
    event_severity VARCHAR(20) DEFAULT 'info',  -- 'debug', 'info', 'warning', 'error', 'critical'
    
    -- Resource affected
    resource_type VARCHAR(100),
    resource_id UUID,
    resource_name VARCHAR(500),
    
    -- Action details
    action VARCHAR(100) NOT NULL,  -- 'create', 'read', 'update', 'delete', 'export', etc.
    action_details JSONB DEFAULT '{}',
    
    -- State tracking (for compliance)
    previous_state_hash VARCHAR(64),
    new_state_hash VARCHAR(64),
    changes JSONB,  -- Diff of what changed
    
    -- Merkle chain for tamper evidence
    merkle_hash VARCHAR(64) NOT NULL,
    previous_merkle_hash VARCHAR(64),
    merkle_tree_root VARCHAR(64),
    sequence_number BIGINT NOT NULL,
    
    -- Request context
    request_id VARCHAR(100),
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    geo_location JSONB,  -- country, region, city if available
    
    -- Additional context
    metadata JSONB DEFAULT '{}',
    
    -- Immutable timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partitioning by month for efficient archival
-- In production, create partitions automatically

CREATE INDEX idx_uds_audit_log_tenant ON uds_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_uds_audit_log_user ON uds_audit_log(tenant_id, user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_uds_audit_log_event ON uds_audit_log(tenant_id, event_type, created_at DESC);
CREATE INDEX idx_uds_audit_log_resource ON uds_audit_log(tenant_id, resource_type, resource_id);
CREATE INDEX idx_uds_audit_log_category ON uds_audit_log(tenant_id, event_category, created_at DESC);
CREATE INDEX idx_uds_audit_log_sequence ON uds_audit_log(tenant_id, sequence_number);
CREATE INDEX idx_uds_audit_log_merkle ON uds_audit_log(merkle_hash);

-- ============================================================================
-- AUDIT MERKLE TREE (For tamper evidence verification)
-- ============================================================================

CREATE TABLE uds_audit_merkle_tree (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Tree structure
    tree_height INTEGER NOT NULL,
    leaf_count BIGINT NOT NULL,
    root_hash VARCHAR(64) NOT NULL,
    
    -- Coverage
    first_sequence_number BIGINT NOT NULL,
    last_sequence_number BIGINT NOT NULL,
    first_entry_at TIMESTAMPTZ NOT NULL,
    last_entry_at TIMESTAMPTZ NOT NULL,
    
    -- Verification
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by VARCHAR(100),
    
    -- Storage
    tree_data_key VARCHAR(1000),  -- S3 key for full tree
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uds_audit_merkle_tree_tenant ON uds_audit_merkle_tree(tenant_id, created_at DESC);
CREATE INDEX idx_uds_audit_merkle_tree_sequence ON uds_audit_merkle_tree(tenant_id, first_sequence_number, last_sequence_number);

-- ============================================================================
-- EXPORT REQUESTS (Compliance exports)
-- ============================================================================

CREATE TABLE uds_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),  -- NULL for tenant-wide exports
    requested_by_user_id UUID NOT NULL REFERENCES users(id),
    
    -- Export scope
    export_type VARCHAR(50) NOT NULL,  -- 'user_data', 'conversations', 'audit_log', 'compliance', 'gdpr'
    scope_type VARCHAR(50) NOT NULL,   -- 'user', 'tenant', 'date_range', 'conversation'
    
    -- Filters
    date_range_start TIMESTAMPTZ,
    date_range_end TIMESTAMPTZ,
    conversation_ids UUID[],
    include_attachments BOOLEAN DEFAULT true,
    include_metadata BOOLEAN DEFAULT true,
    
    -- Format
    export_format VARCHAR(50) NOT NULL DEFAULT 'json',  -- 'json', 'csv', 'pdf', 'html', 'zip'
    encryption_enabled BOOLEAN DEFAULT true,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed', 'expired'
    progress_percent INTEGER DEFAULT 0,
    
    -- Result
    result_bucket VARCHAR(255),
    result_key VARCHAR(1000),
    result_size_bytes BIGINT,
    result_checksum VARCHAR(64),
    download_url TEXT,
    download_expires_at TIMESTAMPTZ,
    download_count INTEGER DEFAULT 0,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Audit
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_uds_export_requests_tenant ON uds_export_requests(tenant_id, created_at DESC);
CREATE INDEX idx_uds_export_requests_user ON uds_export_requests(tenant_id, user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_uds_export_requests_status ON uds_export_requests(tenant_id, status);

-- ============================================================================
-- GDPR ERASURE REQUESTS
-- ============================================================================

CREATE TABLE uds_erasure_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),  -- Target user (NULL for conversation-specific)
    conversation_id UUID,               -- For single conversation deletion
    requested_by_user_id UUID NOT NULL REFERENCES users(id),
    
    -- Scope
    scope uds_erasure_scope NOT NULL,
    
    -- What to erase
    erase_conversations BOOLEAN DEFAULT true,
    erase_messages BOOLEAN DEFAULT true,
    erase_uploads BOOLEAN DEFAULT true,
    erase_audit_log BOOLEAN DEFAULT false,  -- Usually keep for compliance
    erase_from_backups BOOLEAN DEFAULT false,
    anonymize_remaining BOOLEAN DEFAULT true,
    
    -- Status tracking per tier
    status uds_erasure_status DEFAULT 'pending',
    hot_tier_status uds_erasure_status DEFAULT 'pending',
    warm_tier_status uds_erasure_status DEFAULT 'pending',
    cold_tier_status uds_erasure_status DEFAULT 'pending',
    backup_status uds_erasure_status DEFAULT 'pending',
    
    -- Progress
    conversations_deleted INTEGER DEFAULT 0,
    messages_deleted INTEGER DEFAULT 0,
    uploads_deleted INTEGER DEFAULT 0,
    bytes_deleted BIGINT DEFAULT 0,
    
    -- Verification
    verification_hash VARCHAR(64),  -- Hash of deleted content for audit
    
    -- Legal/compliance
    legal_basis VARCHAR(100),  -- 'gdpr_article_17', 'user_request', 'retention_policy'
    legal_reference VARCHAR(500),
    
    -- Timing
    scheduled_at TIMESTAMPTZ,  -- For delayed execution
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uds_erasure_requests_tenant ON uds_erasure_requests(tenant_id, created_at DESC);
CREATE INDEX idx_uds_erasure_requests_user ON uds_erasure_requests(tenant_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_uds_erasure_requests_status ON uds_erasure_requests(tenant_id, status);

-- ============================================================================
-- TIER TRANSITION LOG
-- ============================================================================

CREATE TABLE uds_tier_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- What moved
    resource_type VARCHAR(50) NOT NULL,  -- 'conversation', 'message', 'upload'
    resource_id UUID NOT NULL,
    
    -- Transition
    from_tier uds_tier NOT NULL,
    to_tier uds_tier NOT NULL,
    
    -- Reason
    transition_reason VARCHAR(100) NOT NULL,  -- 'ttl_expiry', 'manual', 'access_pattern', 'archival'
    
    -- Metrics
    size_bytes BIGINT,
    duration_ms INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uds_tier_transitions_tenant ON uds_tier_transitions(tenant_id, created_at DESC);
CREATE INDEX idx_uds_tier_transitions_resource ON uds_tier_transitions(resource_type, resource_id);

-- ============================================================================
-- DATA FLOW METRICS (For monitoring tier health)
-- ============================================================================

CREATE TABLE uds_data_flow_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    period VARCHAR(20) NOT NULL,  -- 'hour', 'day', 'week'
    period_start TIMESTAMPTZ NOT NULL,
    
    -- Hot tier metrics
    hot_conversations_count INTEGER DEFAULT 0,
    hot_messages_count INTEGER DEFAULT 0,
    hot_cache_hits INTEGER DEFAULT 0,
    hot_cache_misses INTEGER DEFAULT 0,
    
    -- Warm tier metrics
    warm_conversations_count INTEGER DEFAULT 0,
    warm_messages_count INTEGER DEFAULT 0,
    warm_query_count INTEGER DEFAULT 0,
    warm_query_latency_p99_ms INTEGER,
    
    -- Cold tier metrics
    cold_conversations_count INTEGER DEFAULT 0,
    cold_retrieval_count INTEGER DEFAULT 0,
    cold_retrieval_latency_p99_ms INTEGER,
    
    -- Transitions
    hot_to_warm_count INTEGER DEFAULT 0,
    warm_to_cold_count INTEGER DEFAULT 0,
    cold_to_warm_count INTEGER DEFAULT 0,
    
    -- Storage
    total_storage_bytes BIGINT DEFAULT 0,
    hot_storage_bytes BIGINT DEFAULT 0,
    warm_storage_bytes BIGINT DEFAULT 0,
    cold_storage_bytes BIGINT DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, period, period_start)
);

CREATE INDEX idx_uds_data_flow_metrics_tenant ON uds_data_flow_metrics(tenant_id, period, period_start DESC);

-- ============================================================================
-- SEARCH INDEX (For full-text and semantic search)
-- ============================================================================

CREATE TABLE uds_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Source
    source_type VARCHAR(50) NOT NULL,  -- 'conversation', 'message', 'upload'
    source_id UUID NOT NULL,
    conversation_id UUID,
    
    -- Searchable content
    content_text TEXT NOT NULL,
    content_tsvector TSVECTOR,
    
    -- Vector embedding for semantic search
    embedding vector(1536),
    embedding_model VARCHAR(100),
    
    -- Metadata for filtering
    created_at TIMESTAMPTZ NOT NULL,
    content_type VARCHAR(50),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uds_search_index_tenant_user ON uds_search_index(tenant_id, user_id);
CREATE INDEX idx_uds_search_index_conversation ON uds_search_index(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_uds_search_index_fts ON uds_search_index USING GIN(content_tsvector);
CREATE INDEX idx_uds_search_index_embedding ON uds_search_index USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_uds_search_index_tags ON uds_search_index USING GIN(tags);

-- Trigger to update tsvector
CREATE OR REPLACE FUNCTION uds_search_index_update_tsvector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_tsvector := to_tsvector('english', NEW.content_text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_uds_search_index_tsvector
    BEFORE INSERT OR UPDATE OF content_text ON uds_search_index
    FOR EACH ROW EXECUTE FUNCTION uds_search_index_update_tsvector();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE uds_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_upload_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_audit_merkle_tree ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_erasure_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_tier_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_data_flow_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE uds_search_index ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tenant_isolation_uds_config ON uds_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_uds_encryption_keys ON uds_encryption_keys
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Conversation policies: user sees own, admin sees all in tenant
CREATE POLICY user_isolation_uds_conversations ON uds_conversations
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        AND (
            user_id = current_setting('app.current_user_id')::UUID
            OR current_setting('app.is_admin', true)::BOOLEAN = true
            OR current_setting('app.current_user_id')::UUID = ANY(shared_with_user_ids)
        )
    );

-- Message policies: follows conversation access
CREATE POLICY user_isolation_uds_messages ON uds_messages
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        AND (
            user_id = current_setting('app.current_user_id')::UUID
            OR current_setting('app.is_admin', true)::BOOLEAN = true
        )
    );

CREATE POLICY tenant_isolation_uds_message_attachments ON uds_message_attachments
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Upload policies
CREATE POLICY user_isolation_uds_uploads ON uds_uploads
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        AND (
            user_id = current_setting('app.current_user_id')::UUID
            OR current_setting('app.is_admin', true)::BOOLEAN = true
        )
    );

CREATE POLICY tenant_isolation_uds_upload_chunks ON uds_upload_chunks
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Audit log: admin only
CREATE POLICY admin_only_uds_audit_log ON uds_audit_log
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        AND current_setting('app.is_admin', true)::BOOLEAN = true
    );

CREATE POLICY admin_only_uds_audit_merkle_tree ON uds_audit_merkle_tree
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        AND current_setting('app.is_admin', true)::BOOLEAN = true
    );

-- Export/Erasure requests: user sees own, admin sees all
CREATE POLICY user_isolation_uds_export_requests ON uds_export_requests
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        AND (
            requested_by_user_id = current_setting('app.current_user_id')::UUID
            OR current_setting('app.is_admin', true)::BOOLEAN = true
        )
    );

CREATE POLICY admin_only_uds_erasure_requests ON uds_erasure_requests
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        AND current_setting('app.is_admin', true)::BOOLEAN = true
    );

CREATE POLICY tenant_isolation_uds_tier_transitions ON uds_tier_transitions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_uds_data_flow_metrics ON uds_data_flow_metrics
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY user_isolation_uds_search_index ON uds_search_index
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        AND (
            user_id = current_setting('app.current_user_id')::UUID
            OR current_setting('app.is_admin', true)::BOOLEAN = true
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get next audit sequence number (thread-safe)
CREATE OR REPLACE FUNCTION uds_next_audit_sequence(p_tenant_id UUID)
RETURNS BIGINT AS $$
DECLARE
    v_sequence BIGINT;
BEGIN
    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_sequence
    FROM uds_audit_log
    WHERE tenant_id = p_tenant_id;
    RETURN v_sequence;
END;
$$ LANGUAGE plpgsql;

-- Calculate Merkle hash for audit entry
CREATE OR REPLACE FUNCTION uds_calculate_merkle_hash(
    p_event_type TEXT,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID,
    p_previous_hash TEXT,
    p_timestamp TIMESTAMPTZ
)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        sha256(
            (COALESCE(p_event_type, '') || 
             COALESCE(p_action, '') || 
             COALESCE(p_resource_type, '') || 
             COALESCE(p_resource_id::TEXT, '') || 
             COALESCE(p_previous_hash, '') ||
             COALESCE(p_timestamp::TEXT, ''))::BYTEA
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-update conversation stats
CREATE OR REPLACE FUNCTION uds_update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE uds_conversations
        SET message_count = message_count + 1,
            total_input_tokens = total_input_tokens + COALESCE(NEW.input_tokens, 0),
            total_output_tokens = total_output_tokens + COALESCE(NEW.output_tokens, 0),
            total_cost_credits = total_cost_credits + COALESCE(NEW.cost_credits, 0),
            last_message_at = NEW.created_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE uds_conversations
        SET message_count = GREATEST(message_count - 1, 0),
            total_input_tokens = GREATEST(total_input_tokens - COALESCE(OLD.input_tokens, 0), 0),
            total_output_tokens = GREATEST(total_output_tokens - COALESCE(OLD.output_tokens, 0), 0),
            total_cost_credits = GREATEST(total_cost_credits - COALESCE(OLD.cost_credits, 0), 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.conversation_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_uds_update_conversation_stats
    AFTER INSERT OR DELETE ON uds_messages
    FOR EACH ROW EXECUTE FUNCTION uds_update_conversation_stats();

-- Auto-update attachment count
CREATE OR REPLACE FUNCTION uds_update_attachment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.conversation_id IS NOT NULL THEN
        UPDATE uds_conversations
        SET attachment_count = attachment_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;
    ELSIF TG_OP = 'DELETE' AND OLD.conversation_id IS NOT NULL THEN
        UPDATE uds_conversations
        SET attachment_count = GREATEST(attachment_count - 1, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.conversation_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_uds_update_attachment_count
    AFTER INSERT OR DELETE ON uds_uploads
    FOR EACH ROW EXECUTE FUNCTION uds_update_attachment_count();

-- Initialize UDS for tenant
CREATE OR REPLACE FUNCTION uds_initialize_tenant(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Create default config
    INSERT INTO uds_config (tenant_id)
    VALUES (p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;
    
    -- Create tenant encryption key entry (actual key in KMS)
    INSERT INTO uds_encryption_keys (tenant_id, key_id, key_type)
    VALUES (p_tenant_id, 'aws/kms/uds-tenant-' || p_tenant_id, 'tenant')
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO radiant_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO radiant_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO radiant_app;
