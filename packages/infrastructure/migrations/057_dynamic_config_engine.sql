-- Migration: 057_dynamic_config_engine.sql
-- RADIANT v4.18.0 - Dynamic Configuration Engine
-- Hot-reload configuration without code rebuilds

-- ============================================================================
-- CONFIGURATION VERSIONS - Track all config changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS config_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Version info
    version_number BIGINT NOT NULL DEFAULT 1,
    config_type VARCHAR(100) NOT NULL, -- 'models', 'providers', 'specialties', 'orchestration', 'system'
    
    -- What changed
    change_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'bulk_update'
    change_source VARCHAR(100), -- 'admin_dashboard', 'api', 'migration', 'auto_sync'
    changed_by VARCHAR(200),
    
    -- Change details
    affected_keys TEXT[] DEFAULT '{}',
    change_summary TEXT,
    change_payload JSONB DEFAULT '{}',
    
    -- Rollback support
    previous_state JSONB,
    can_rollback BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_config_versions_type ON config_versions(config_type, version_number DESC);
CREATE INDEX idx_config_versions_time ON config_versions(created_at DESC);

-- Global version counter per config type
CREATE TABLE IF NOT EXISTS config_version_counters (
    config_type VARCHAR(100) PRIMARY KEY,
    current_version BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize counters
INSERT INTO config_version_counters (config_type, current_version) VALUES
    ('models', 0),
    ('providers', 0),
    ('specialties', 0),
    ('orchestration', 0),
    ('system', 0),
    ('tenants', 0)
ON CONFLICT (config_type) DO NOTHING;

-- ============================================================================
-- LIVE CONFIG CACHE - In-database cache for fast reads
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_config_cache (
    cache_key VARCHAR(500) PRIMARY KEY,
    config_type VARCHAR(100) NOT NULL,
    
    -- Cached value
    cached_value JSONB NOT NULL,
    
    -- Versioning
    version_number BIGINT NOT NULL,
    
    -- TTL
    expires_at TIMESTAMPTZ,
    
    -- Stats
    hit_count BIGINT DEFAULT 0,
    last_hit TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_config_cache_type ON live_config_cache(config_type);
CREATE INDEX idx_live_config_cache_expires ON live_config_cache(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- SERVICE HEARTBEATS - Track which services are running
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_instances (
    instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Service info
    service_name VARCHAR(100) NOT NULL,
    service_type VARCHAR(50) NOT NULL, -- 'lambda', 'ecs', 'ec2', 'local'
    
    -- Instance details
    instance_identifier VARCHAR(200), -- Lambda request ID, ECS task ID, etc.
    region VARCHAR(50),
    
    -- Config versions this instance has
    config_versions JSONB DEFAULT '{}', -- {config_type: version_number}
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'stale', 'terminated'
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_instances_name ON service_instances(service_name);
CREATE INDEX idx_service_instances_heartbeat ON service_instances(last_heartbeat);

-- ============================================================================
-- CONFIG CHANGE NOTIFICATIONS - For real-time propagation
-- ============================================================================

CREATE TABLE IF NOT EXISTS config_change_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What changed
    config_type VARCHAR(100) NOT NULL,
    version_number BIGINT NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    
    -- Notification details
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
    requires_restart BOOLEAN DEFAULT false,
    
    -- Payload for subscribers
    notification_payload JSONB DEFAULT '{}',
    
    -- Delivery tracking
    delivered_to TEXT[] DEFAULT '{}',
    acknowledged_by TEXT[] DEFAULT '{}',
    
    -- Expiry
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_config_change_notifications_pending ON config_change_notifications(config_type, created_at)
    WHERE expires_at > NOW();

-- ============================================================================
-- FUNCTIONS - Core engine logic
-- ============================================================================

-- Increment version and return new version number
CREATE OR REPLACE FUNCTION increment_config_version(
    p_config_type VARCHAR,
    p_change_type VARCHAR,
    p_change_source VARCHAR DEFAULT NULL,
    p_changed_by VARCHAR DEFAULT NULL,
    p_affected_keys TEXT[] DEFAULT '{}',
    p_change_summary TEXT DEFAULT NULL,
    p_change_payload JSONB DEFAULT '{}'
)
RETURNS BIGINT AS $$
DECLARE
    v_new_version BIGINT;
BEGIN
    -- Increment counter
    UPDATE config_version_counters 
    SET current_version = current_version + 1, last_updated = NOW()
    WHERE config_type = p_config_type
    RETURNING current_version INTO v_new_version;
    
    IF v_new_version IS NULL THEN
        -- Config type doesn't exist, create it
        INSERT INTO config_version_counters (config_type, current_version)
        VALUES (p_config_type, 1)
        RETURNING current_version INTO v_new_version;
    END IF;
    
    -- Log the version change
    INSERT INTO config_versions (
        version_number, config_type, change_type, change_source, 
        changed_by, affected_keys, change_summary, change_payload
    ) VALUES (
        v_new_version, p_config_type, p_change_type, p_change_source,
        p_changed_by, p_affected_keys, p_change_summary, p_change_payload
    );
    
    -- Create notification
    INSERT INTO config_change_notifications (
        config_type, version_number, change_type, notification_payload
    ) VALUES (
        p_config_type, v_new_version, p_change_type,
        jsonb_build_object(
            'version', v_new_version,
            'type', p_change_type,
            'affected_keys', p_affected_keys,
            'timestamp', NOW()
        )
    );
    
    -- Send PostgreSQL notification for real-time listeners
    PERFORM pg_notify('config_changes', json_build_object(
        'config_type', p_config_type,
        'version', v_new_version,
        'change_type', p_change_type,
        'timestamp', NOW()
    )::text);
    
    -- Invalidate affected cache entries
    UPDATE live_config_cache 
    SET expires_at = NOW() 
    WHERE config_type = p_config_type;
    
    RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;

-- Get current version for a config type
CREATE OR REPLACE FUNCTION get_config_version(p_config_type VARCHAR)
RETURNS BIGINT AS $$
DECLARE
    v_version BIGINT;
BEGIN
    SELECT current_version INTO v_version 
    FROM config_version_counters 
    WHERE config_type = p_config_type;
    
    RETURN COALESCE(v_version, 0);
END;
$$ LANGUAGE plpgsql;

-- Check if service has latest config
CREATE OR REPLACE FUNCTION check_config_freshness(p_service_versions JSONB)
RETURNS TABLE(config_type VARCHAR, current_version BIGINT, service_version BIGINT, needs_update BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cvc.config_type::VARCHAR,
        cvc.current_version,
        COALESCE((p_service_versions->>cvc.config_type)::BIGINT, 0) as service_version,
        cvc.current_version > COALESCE((p_service_versions->>cvc.config_type)::BIGINT, 0) as needs_update
    FROM config_version_counters cvc;
END;
$$ LANGUAGE plpgsql;

-- Get pending notifications for a service
CREATE OR REPLACE FUNCTION get_pending_notifications(
    p_service_id UUID,
    p_last_seen_versions JSONB
)
RETURNS TABLE(
    notification_id UUID,
    config_type VARCHAR,
    version_number BIGINT,
    change_type VARCHAR,
    priority VARCHAR,
    requires_restart BOOLEAN,
    notification_payload JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ccn.notification_id,
        ccn.config_type::VARCHAR,
        ccn.version_number,
        ccn.change_type::VARCHAR,
        ccn.priority::VARCHAR,
        ccn.requires_restart,
        ccn.notification_payload
    FROM config_change_notifications ccn
    WHERE ccn.expires_at > NOW()
      AND ccn.version_number > COALESCE((p_last_seen_versions->>ccn.config_type)::BIGINT, 0)
      AND NOT (p_service_id::TEXT = ANY(ccn.acknowledged_by))
    ORDER BY ccn.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Acknowledge notifications
CREATE OR REPLACE FUNCTION acknowledge_notifications(
    p_service_id UUID,
    p_notification_ids UUID[]
)
RETURNS void AS $$
BEGIN
    UPDATE config_change_notifications
    SET acknowledged_by = array_append(acknowledged_by, p_service_id::TEXT)
    WHERE notification_id = ANY(p_notification_ids);
END;
$$ LANGUAGE plpgsql;

-- Cache a config value
CREATE OR REPLACE FUNCTION cache_config(
    p_cache_key VARCHAR,
    p_config_type VARCHAR,
    p_value JSONB,
    p_ttl_seconds INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_version BIGINT;
    v_expires TIMESTAMPTZ;
BEGIN
    SELECT current_version INTO v_version FROM config_version_counters WHERE config_type = p_config_type;
    
    IF p_ttl_seconds IS NOT NULL THEN
        v_expires := NOW() + (p_ttl_seconds || ' seconds')::INTERVAL;
    END IF;
    
    INSERT INTO live_config_cache (cache_key, config_type, cached_value, version_number, expires_at)
    VALUES (p_cache_key, p_config_type, p_value, COALESCE(v_version, 0), v_expires)
    ON CONFLICT (cache_key) DO UPDATE SET
        cached_value = EXCLUDED.cached_value,
        version_number = EXCLUDED.version_number,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Get cached config (with freshness check)
CREATE OR REPLACE FUNCTION get_cached_config(p_cache_key VARCHAR)
RETURNS JSONB AS $$
DECLARE
    v_cached RECORD;
    v_current_version BIGINT;
BEGIN
    SELECT * INTO v_cached FROM live_config_cache WHERE cache_key = p_cache_key;
    
    IF v_cached IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check expiry
    IF v_cached.expires_at IS NOT NULL AND v_cached.expires_at < NOW() THEN
        DELETE FROM live_config_cache WHERE cache_key = p_cache_key;
        RETURN NULL;
    END IF;
    
    -- Check version freshness
    SELECT current_version INTO v_current_version 
    FROM config_version_counters 
    WHERE config_type = v_cached.config_type;
    
    IF v_current_version > v_cached.version_number THEN
        -- Stale cache
        DELETE FROM live_config_cache WHERE cache_key = p_cache_key;
        RETURN NULL;
    END IF;
    
    -- Update hit stats
    UPDATE live_config_cache 
    SET hit_count = hit_count + 1, last_hit = NOW()
    WHERE cache_key = p_cache_key;
    
    RETURN v_cached.cached_value;
END;
$$ LANGUAGE plpgsql;

-- Register/update service heartbeat
CREATE OR REPLACE FUNCTION service_heartbeat(
    p_service_name VARCHAR,
    p_service_type VARCHAR,
    p_instance_identifier VARCHAR DEFAULT NULL,
    p_config_versions JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_instance_id UUID;
BEGIN
    -- Try to find existing instance
    SELECT instance_id INTO v_instance_id
    FROM service_instances
    WHERE service_name = p_service_name
      AND instance_identifier = p_instance_identifier
      AND status = 'active';
    
    IF v_instance_id IS NOT NULL THEN
        -- Update heartbeat
        UPDATE service_instances SET
            last_heartbeat = NOW(),
            config_versions = p_config_versions
        WHERE instance_id = v_instance_id;
    ELSE
        -- Register new instance
        INSERT INTO service_instances (
            service_name, service_type, instance_identifier, config_versions
        ) VALUES (
            p_service_name, p_service_type, p_instance_identifier, p_config_versions
        )
        RETURNING instance_id INTO v_instance_id;
    END IF;
    
    RETURN v_instance_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS - Auto-version on config table changes
-- ============================================================================

-- Trigger for unified_model_registry
CREATE OR REPLACE FUNCTION version_model_registry_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM increment_config_version(
            'models', 'create', TG_TABLE_NAME, NULL,
            ARRAY[NEW.model_id], 'Model added: ' || NEW.model_id,
            jsonb_build_object('model_id', NEW.model_id, 'provider', NEW.provider)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM increment_config_version(
            'models', 'update', TG_TABLE_NAME, NULL,
            ARRAY[NEW.model_id], 'Model updated: ' || NEW.model_id,
            jsonb_build_object('model_id', NEW.model_id, 'changes', 
                jsonb_build_object(
                    'enabled', NEW.enabled,
                    'deprecated', NEW.deprecated
                ))
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_config_version(
            'models', 'delete', TG_TABLE_NAME, NULL,
            ARRAY[OLD.model_id], 'Model removed: ' || OLD.model_id,
            jsonb_build_object('model_id', OLD.model_id)
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS unified_model_registry_version ON unified_model_registry;
CREATE TRIGGER unified_model_registry_version
    AFTER INSERT OR UPDATE OR DELETE ON unified_model_registry
    FOR EACH ROW EXECUTE FUNCTION version_model_registry_change();

-- Trigger for model_specialties
CREATE OR REPLACE FUNCTION version_specialty_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM increment_config_version(
        'specialties', TG_OP, TG_TABLE_NAME, NULL,
        ARRAY[COALESCE(NEW.name, OLD.name)], 
        'Specialty ' || TG_OP || ': ' || COALESCE(NEW.name, OLD.name),
        jsonb_build_object('specialty', COALESCE(NEW.name, OLD.name))
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS model_specialties_version ON model_specialties;
CREATE TRIGGER model_specialties_version
    AFTER INSERT OR UPDATE OR DELETE ON model_specialties
    FOR EACH ROW EXECUTE FUNCTION version_specialty_change();

-- Trigger for orchestration_settings
CREATE OR REPLACE FUNCTION version_orchestration_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM increment_config_version(
        'orchestration', 'update', TG_TABLE_NAME, NULL,
        ARRAY[NEW.tenant_id::TEXT], 
        'Orchestration settings updated',
        jsonb_build_object('tenant_id', NEW.tenant_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orchestration_settings_version ON orchestration_settings;
CREATE TRIGGER orchestration_settings_version
    AFTER UPDATE ON orchestration_settings
    FOR EACH ROW EXECUTE FUNCTION version_orchestration_change();

-- Trigger for system_configuration
CREATE OR REPLACE FUNCTION version_system_config_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM increment_config_version(
        'system', TG_OP, TG_TABLE_NAME, NULL,
        ARRAY[COALESCE(NEW.key, OLD.key)], 
        'System config ' || TG_OP || ': ' || COALESCE(NEW.key, OLD.key),
        jsonb_build_object('key', COALESCE(NEW.key, OLD.key))
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS system_configuration_version ON system_configuration;
CREATE TRIGGER system_configuration_version
    AFTER INSERT OR UPDATE OR DELETE ON system_configuration
    FOR EACH ROW EXECUTE FUNCTION version_system_config_change();

-- ============================================================================
-- CLEANUP - Remove stale data
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_config_engine()
RETURNS void AS $$
BEGIN
    -- Mark stale service instances
    UPDATE service_instances 
    SET status = 'stale'
    WHERE status = 'active' 
      AND last_heartbeat < NOW() - INTERVAL '5 minutes';
    
    -- Delete old terminated instances
    DELETE FROM service_instances
    WHERE status IN ('stale', 'terminated')
      AND last_heartbeat < NOW() - INTERVAL '1 hour';
    
    -- Delete expired notifications
    DELETE FROM config_change_notifications
    WHERE expires_at < NOW();
    
    -- Delete expired cache entries
    DELETE FROM live_config_cache
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    -- Keep only last 1000 versions per config type
    DELETE FROM config_versions
    WHERE version_id IN (
        SELECT version_id FROM (
            SELECT version_id, ROW_NUMBER() OVER (
                PARTITION BY config_type ORDER BY version_number DESC
            ) as rn
            FROM config_versions
        ) sub WHERE rn > 1000
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE config_versions IS 'Tracks all configuration changes for audit and rollback';
COMMENT ON TABLE config_version_counters IS 'Current version number per config type for fast checks';
COMMENT ON TABLE live_config_cache IS 'In-database cache with automatic invalidation';
COMMENT ON TABLE service_instances IS 'Registry of running service instances and their config versions';
COMMENT ON TABLE config_change_notifications IS 'Pending notifications for config changes';
COMMENT ON FUNCTION increment_config_version IS 'Increment version, log change, and notify subscribers';
COMMENT ON FUNCTION check_config_freshness IS 'Check if a service has the latest config versions';
