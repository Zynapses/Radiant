-- ============================================================================
-- MIGRATION: 127_file_conversion_service.sql
-- RADIANT v4.18.55 - Intelligent File Conversion Service
-- ============================================================================
-- Tracks file conversions for AI provider compatibility
-- Radiant decides when/how to convert files, not Think Tank
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: FILE CONVERSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Original file info
    filename VARCHAR(500) NOT NULL,
    original_format VARCHAR(50) NOT NULL,
    original_size BIGINT NOT NULL,
    original_checksum VARCHAR(64),
    
    -- Target provider/model
    target_provider VARCHAR(100) NOT NULL,
    target_model VARCHAR(200),
    
    -- Conversion decision
    needs_conversion BOOLEAN NOT NULL DEFAULT true,
    strategy VARCHAR(50) NOT NULL,  -- none, extract_text, ocr, transcribe, etc.
    decision_reason TEXT,
    
    -- Conversion result
    converted_format VARCHAR(50),
    converted_size BIGINT,
    converted_token_estimate INTEGER,
    conversion_status VARCHAR(20) DEFAULT 'pending'
        CHECK (conversion_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    
    -- Storage references
    original_s3_key VARCHAR(1000),
    converted_s3_key VARCHAR(1000),
    
    -- Metadata
    conversation_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_file_conversions_tenant ON file_conversions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_conversions_status ON file_conversions(conversion_status) WHERE conversion_status != 'completed';
CREATE INDEX IF NOT EXISTS idx_file_conversions_provider ON file_conversions(target_provider, original_format);
CREATE INDEX IF NOT EXISTS idx_file_conversions_conversation ON file_conversions(conversation_id) WHERE conversation_id IS NOT NULL;

COMMENT ON TABLE file_conversions IS 'Tracks intelligent file conversions - Radiant decides if/how to convert for AI providers';
COMMENT ON COLUMN file_conversions.strategy IS 'Conversion strategy: none, extract_text, ocr, transcribe, describe_image, describe_video, parse_data, decompress, render_code, unsupported';

-- ============================================================================
-- SECTION 2: PROVIDER CAPABILITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_file_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(100) NOT NULL UNIQUE,
    
    -- Supported formats (stored as JSONB array)
    supported_formats JSONB NOT NULL DEFAULT '[]'::jsonb,
    native_document_formats JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Size limits (bytes)
    max_file_size BIGINT NOT NULL DEFAULT 20971520,  -- 20MB default
    max_image_size BIGINT,
    max_audio_size BIGINT,
    max_video_size BIGINT,
    
    -- Capability flags
    supports_vision BOOLEAN DEFAULT false,
    supports_audio BOOLEAN DEFAULT false,
    supports_video BOOLEAN DEFAULT false,
    supports_documents BOOLEAN DEFAULT false,
    
    -- Model-specific overrides (JSON map of model_id -> capabilities)
    model_overrides JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    last_verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default provider capabilities
INSERT INTO provider_file_capabilities (provider_id, supported_formats, native_document_formats, max_file_size, supports_vision, supports_audio, supports_video, supports_documents) VALUES
('openai', '["png", "jpg", "jpeg", "gif", "webp", "txt", "md", "json", "csv"]', '["txt", "md", "json", "csv"]', 20971520, true, true, false, false),
('anthropic', '["png", "jpg", "jpeg", "gif", "webp", "pdf", "txt", "md", "json", "csv"]', '["pdf", "txt", "md", "json", "csv"]', 33554432, true, false, false, true),
('google', '["png", "jpg", "jpeg", "gif", "webp", "pdf", "txt", "md", "json", "csv", "mp3", "wav", "mp4"]', '["pdf", "txt", "md", "json", "csv"]', 104857600, true, true, true, true),
('xai', '["png", "jpg", "jpeg", "gif", "webp", "txt", "md", "json"]', '["txt", "md", "json"]', 20971520, true, false, false, false),
('deepseek', '["txt", "md", "json", "csv"]', '["txt", "md", "json", "csv"]', 10485760, false, false, false, false),
('self-hosted', '["txt", "md", "json", "csv", "png", "jpg", "jpeg"]', '["txt", "md", "json", "csv"]', 52428800, true, true, false, false)
ON CONFLICT (provider_id) DO UPDATE SET
    supported_formats = EXCLUDED.supported_formats,
    native_document_formats = EXCLUDED.native_document_formats,
    max_file_size = EXCLUDED.max_file_size,
    supports_vision = EXCLUDED.supports_vision,
    supports_audio = EXCLUDED.supports_audio,
    supports_video = EXCLUDED.supports_video,
    supports_documents = EXCLUDED.supports_documents,
    updated_at = NOW();

COMMENT ON TABLE provider_file_capabilities IS 'File format capabilities per AI provider - used by Radiant to decide conversions';

-- ============================================================================
-- SECTION 3: CONVERSION STATISTICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW v_file_conversion_stats AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', created_at) AS day,
    target_provider,
    original_format,
    strategy,
    COUNT(*) AS total_conversions,
    SUM(CASE WHEN needs_conversion THEN 1 ELSE 0 END) AS conversions_needed,
    SUM(CASE WHEN NOT needs_conversion THEN 1 ELSE 0 END) AS no_conversion_needed,
    SUM(CASE WHEN conversion_status = 'completed' THEN 1 ELSE 0 END) AS successful,
    SUM(CASE WHEN conversion_status = 'failed' THEN 1 ELSE 0 END) AS failed,
    AVG(processing_time_ms)::INTEGER AS avg_processing_ms,
    SUM(original_size) AS total_original_bytes,
    SUM(converted_size) AS total_converted_bytes,
    SUM(converted_token_estimate) AS total_tokens_estimated
FROM file_conversions
GROUP BY tenant_id, DATE_TRUNC('day', created_at), target_provider, original_format, strategy;

COMMENT ON VIEW v_file_conversion_stats IS 'Aggregated file conversion statistics by tenant, day, provider, and format';

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE file_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_file_capabilities ENABLE ROW LEVEL SECURITY;

-- File conversions - tenant isolation
DROP POLICY IF EXISTS tenant_isolation_file_conversions ON file_conversions;
CREATE POLICY tenant_isolation_file_conversions ON file_conversions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Super admin access for file conversions
DROP POLICY IF EXISTS super_admin_file_conversions ON file_conversions;
CREATE POLICY super_admin_file_conversions ON file_conversions
    FOR ALL
    USING (current_setting('app.is_super_admin', true)::boolean = true);

-- Provider capabilities - read access for all authenticated users
DROP POLICY IF EXISTS read_provider_capabilities ON provider_file_capabilities;
CREATE POLICY read_provider_capabilities ON provider_file_capabilities
    FOR SELECT
    USING (true);  -- Public read access

-- Provider capabilities - admin write access
DROP POLICY IF EXISTS admin_write_provider_capabilities ON provider_file_capabilities;
CREATE POLICY admin_write_provider_capabilities ON provider_file_capabilities
    FOR ALL
    USING (current_setting('app.is_super_admin', true)::boolean = true);

-- ============================================================================
-- SECTION 5: HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a format is supported by a provider
CREATE OR REPLACE FUNCTION check_format_supported(
    p_provider_id VARCHAR,
    p_format VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_formats JSONB;
BEGIN
    SELECT supported_formats INTO v_formats
    FROM provider_file_capabilities
    WHERE provider_id = p_provider_id;
    
    IF v_formats IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN v_formats ? p_format;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_format_supported IS 'Check if a file format is supported by an AI provider';

-- Function to get conversion statistics for a tenant
CREATE OR REPLACE FUNCTION get_conversion_stats(
    p_tenant_id UUID,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    total_files BIGINT,
    converted_count BIGINT,
    native_count BIGINT,
    failed_count BIGINT,
    total_bytes_processed BIGINT,
    avg_processing_ms INTEGER,
    most_common_format VARCHAR,
    most_common_strategy VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_files,
        SUM(CASE WHEN needs_conversion THEN 1 ELSE 0 END)::BIGINT AS converted_count,
        SUM(CASE WHEN NOT needs_conversion THEN 1 ELSE 0 END)::BIGINT AS native_count,
        SUM(CASE WHEN conversion_status = 'failed' THEN 1 ELSE 0 END)::BIGINT AS failed_count,
        COALESCE(SUM(original_size), 0)::BIGINT AS total_bytes_processed,
        COALESCE(AVG(processing_time_ms), 0)::INTEGER AS avg_processing_ms,
        (SELECT original_format FROM file_conversions fc2 
         WHERE fc2.tenant_id = p_tenant_id 
         AND fc2.created_at >= NOW() - (p_days || ' days')::INTERVAL
         GROUP BY original_format ORDER BY COUNT(*) DESC LIMIT 1) AS most_common_format,
        (SELECT strategy FROM file_conversions fc3 
         WHERE fc3.tenant_id = p_tenant_id 
         AND fc3.created_at >= NOW() - (p_days || ' days')::INTERVAL
         GROUP BY strategy ORDER BY COUNT(*) DESC LIMIT 1) AS most_common_strategy
    FROM file_conversions fc
    WHERE fc.tenant_id = p_tenant_id
    AND fc.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_conversion_stats IS 'Get file conversion statistics for a tenant over a specified period';

-- ============================================================================
-- SECTION 6: CLEANUP FUNCTION
-- ============================================================================

-- Function to clean up old conversion records and S3 files
CREATE OR REPLACE FUNCTION cleanup_old_conversions(
    p_retention_days INTEGER DEFAULT 30
) RETURNS TABLE (
    deleted_count INTEGER,
    s3_keys_to_delete TEXT[]
) AS $$
DECLARE
    v_deleted INTEGER;
    v_s3_keys TEXT[];
BEGIN
    -- Collect S3 keys before deleting
    SELECT ARRAY_AGG(DISTINCT key) INTO v_s3_keys
    FROM (
        SELECT original_s3_key AS key FROM file_conversions 
        WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
        AND original_s3_key IS NOT NULL
        UNION
        SELECT converted_s3_key AS key FROM file_conversions 
        WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
        AND converted_s3_key IS NOT NULL
    ) AS keys;
    
    -- Delete old records
    WITH deleted AS (
        DELETE FROM file_conversions
        WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO v_deleted FROM deleted;
    
    RETURN QUERY SELECT v_deleted, v_s3_keys;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_conversions IS 'Clean up old file conversion records and return S3 keys for deletion';

-- ============================================================================
-- SECTION 7: UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS file_conversions_updated_at ON file_conversions;
CREATE TRIGGER file_conversions_updated_at
    BEFORE UPDATE ON file_conversions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS provider_capabilities_updated_at ON provider_file_capabilities;
CREATE TRIGGER provider_capabilities_updated_at
    BEFORE UPDATE ON provider_file_capabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 8: GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON file_conversions TO radiant_app;
GRANT SELECT ON provider_file_capabilities TO radiant_app;
GRANT SELECT ON v_file_conversion_stats TO radiant_app;
GRANT EXECUTE ON FUNCTION check_format_supported TO radiant_app;
GRANT EXECUTE ON FUNCTION get_conversion_stats TO radiant_app;

COMMIT;
