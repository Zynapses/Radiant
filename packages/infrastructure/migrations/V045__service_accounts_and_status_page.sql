-- ============================================================================
-- V045: Service Accounts and Public Status Page
-- 
-- Creates service accounts table for automated system access (like status page).
-- Seeds the status-page-reader service account for public health status API.
-- 
-- SECURITY:
-- - API keys are bcrypt hashed (never stored in plaintext)
-- - Rate limiting enforced at database level
-- - Scopes are validated on every request
-- - Audit logging for all service account access
--
-- @version 7.1.0
-- @since 2026-02-04
-- ============================================================================

-- ============================================================================
-- Service Accounts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identity
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- API Key (hashed)
    api_key_id VARCHAR(36) NOT NULL UNIQUE,
    api_key_prefix VARCHAR(8) NOT NULL, -- First 8 chars for identification
    api_key_hash VARCHAR(255) NOT NULL, -- bcrypt hash
    
    -- Scopes (JSONB array)
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    
    -- Rate Limiting
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT service_accounts_name_tenant_unique UNIQUE (tenant_id, name),
    CONSTRAINT service_accounts_valid_scopes CHECK (jsonb_typeof(scopes) = 'array')
);

-- Indexes for service accounts
CREATE INDEX idx_service_accounts_tenant ON service_accounts(tenant_id);
CREATE INDEX idx_service_accounts_api_key_id ON service_accounts(api_key_id);
CREATE INDEX idx_service_accounts_api_key_prefix ON service_accounts(api_key_prefix);
CREATE INDEX idx_service_accounts_active ON service_accounts(is_active) WHERE is_active = true;

-- RLS for service accounts
ALTER TABLE service_accounts ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (system accounts have NULL tenant_id)
CREATE POLICY service_accounts_tenant_policy ON service_accounts
    FOR ALL
    USING (
        tenant_id IS NULL -- System-wide service accounts
        OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- ============================================================================
-- Service Account Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_account_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Request info
    request_id VARCHAR(36) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    
    -- Authentication
    service_account_id UUID REFERENCES service_accounts(id) ON DELETE SET NULL,
    service_account_name VARCHAR(100),
    api_key_prefix VARCHAR(8),
    
    -- Client info (sanitized)
    client_ip_hash VARCHAR(64), -- SHA-256 of IP for privacy
    user_agent TEXT,
    
    -- Response
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    
    -- Rate limiting
    rate_limit_remaining INTEGER,
    was_rate_limited BOOLEAN NOT NULL DEFAULT false,
    
    -- Error details (if any)
    error_code VARCHAR(50),
    error_message TEXT
);

-- Indexes for audit log
CREATE INDEX idx_sa_audit_timestamp ON service_account_audit_log(timestamp DESC);
CREATE INDEX idx_sa_audit_service_account ON service_account_audit_log(service_account_id);
CREATE INDEX idx_sa_audit_request_id ON service_account_audit_log(request_id);
CREATE INDEX idx_sa_audit_rate_limited ON service_account_audit_log(was_rate_limited) WHERE was_rate_limited = true;

-- Partition audit log by month for performance
-- (In production, this would be partitioned)

-- ============================================================================
-- Rate Limiting Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_account_rate_limits (
    service_account_id UUID NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    window_type VARCHAR(10) NOT NULL, -- 'minute' or 'hour'
    request_count INTEGER NOT NULL DEFAULT 1,
    
    PRIMARY KEY (service_account_id, window_start, window_type)
);

-- Auto-cleanup old rate limit windows
CREATE INDEX idx_sa_rate_limits_cleanup ON service_account_rate_limits(window_start);

-- ============================================================================
-- Public Health Status Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS public_health_status_cache (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'current',
    
    -- Cached status
    status_data JSONB NOT NULL,
    
    -- Cache metadata
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Source
    generated_by VARCHAR(100) NOT NULL DEFAULT 'system'
);

-- ============================================================================
-- Incidents Table (for public display)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Incident details
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'investigating',
    severity VARCHAR(20) NOT NULL DEFAULT 'minor',
    
    -- Affected components (JSONB array of component names)
    affected_components JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Timeline
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    -- Updates (JSONB array)
    updates JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Visibility
    is_public BOOLEAN NOT NULL DEFAULT true,
    
    -- Constraints
    CONSTRAINT incidents_valid_status CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
    CONSTRAINT incidents_valid_severity CHECK (severity IN ('minor', 'major', 'critical'))
);

CREATE INDEX idx_incidents_tenant ON public_incidents(tenant_id);
CREATE INDEX idx_incidents_status ON public_incidents(status) WHERE status != 'resolved';
CREATE INDEX idx_incidents_created ON public_incidents(created_at DESC);

-- ============================================================================
-- Scheduled Maintenance Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Maintenance details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Affected components
    affected_components JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Schedule
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    
    -- Constraints
    CONSTRAINT maintenance_valid_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT maintenance_valid_schedule CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_maintenance_tenant ON scheduled_maintenance(tenant_id);
CREATE INDEX idx_maintenance_schedule ON scheduled_maintenance(scheduled_start, scheduled_end);
CREATE INDEX idx_maintenance_status ON scheduled_maintenance(status) WHERE status IN ('scheduled', 'in_progress');

-- ============================================================================
-- Uptime History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS uptime_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Date (one record per day)
    date DATE NOT NULL,
    
    -- Uptime data
    uptime_percentage DECIMAL(5, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'operational',
    incident_count INTEGER NOT NULL DEFAULT 0,
    
    -- Component breakdown (JSONB)
    component_uptime JSONB,
    
    -- Calculated at
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT uptime_history_date_tenant_unique UNIQUE (tenant_id, date)
);

CREATE INDEX idx_uptime_history_tenant_date ON uptime_history(tenant_id, date DESC);

-- ============================================================================
-- Seed System Service Account: status-page-reader
-- ============================================================================

-- Note: The actual API key is generated and stored in Secrets Manager during deployment.
-- This seeds the service account record with a placeholder hash.
-- The deployment process will:
-- 1. Generate a secure API key
-- 2. Store it in Secrets Manager
-- 3. Update this record with the bcrypt hash

INSERT INTO service_accounts (
    id,
    tenant_id,
    name,
    description,
    api_key_id,
    api_key_prefix,
    api_key_hash,
    scopes,
    is_active,
    rate_limit_per_minute,
    rate_limit_per_hour,
    created_by
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid, -- Fixed ID for status page reader
    NULL, -- System-wide (no tenant)
    'status-page-reader',
    'Service account for public status page. Read-only access to health status, metrics, incidents, and maintenance schedules.',
    'sp-reader-0001', -- Will be updated during deployment
    'sp-read-', -- Prefix for identification
    '$2b$12$placeholder.hash.will.be.updated.during.deployment', -- Placeholder
    '["status:read", "metrics:read", "incidents:read", "maintenance:read"]'::jsonb,
    true,
    60, -- 60 requests per minute
    1000, -- 1000 requests per hour
    'system'
) ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    scopes = EXCLUDED.scopes,
    rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
    rate_limit_per_hour = EXCLUDED.rate_limit_per_hour,
    updated_at = NOW();

-- ============================================================================
-- Functions for Rate Limiting
-- ============================================================================

CREATE OR REPLACE FUNCTION check_service_account_rate_limit(
    p_service_account_id UUID,
    p_limit_per_minute INTEGER,
    p_limit_per_hour INTEGER
) RETURNS TABLE (
    allowed BOOLEAN,
    minute_remaining INTEGER,
    hour_remaining INTEGER,
    reset_at TIMESTAMPTZ
) AS $$
DECLARE
    v_minute_start TIMESTAMPTZ;
    v_hour_start TIMESTAMPTZ;
    v_minute_count INTEGER;
    v_hour_count INTEGER;
BEGIN
    v_minute_start := date_trunc('minute', NOW());
    v_hour_start := date_trunc('hour', NOW());
    
    -- Get current counts
    SELECT COALESCE(SUM(request_count), 0) INTO v_minute_count
    FROM service_account_rate_limits
    WHERE service_account_id = p_service_account_id
      AND window_type = 'minute'
      AND window_start = v_minute_start;
    
    SELECT COALESCE(SUM(request_count), 0) INTO v_hour_count
    FROM service_account_rate_limits
    WHERE service_account_id = p_service_account_id
      AND window_type = 'hour'
      AND window_start = v_hour_start;
    
    -- Check if allowed
    allowed := (v_minute_count < p_limit_per_minute) AND (v_hour_count < p_limit_per_hour);
    minute_remaining := GREATEST(0, p_limit_per_minute - v_minute_count - 1);
    hour_remaining := GREATEST(0, p_limit_per_hour - v_hour_count - 1);
    reset_at := v_minute_start + INTERVAL '1 minute';
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_service_account_rate_limit(
    p_service_account_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Increment minute counter
    INSERT INTO service_account_rate_limits (service_account_id, window_start, window_type, request_count)
    VALUES (p_service_account_id, date_trunc('minute', NOW()), 'minute', 1)
    ON CONFLICT (service_account_id, window_start, window_type)
    DO UPDATE SET request_count = service_account_rate_limits.request_count + 1;
    
    -- Increment hour counter
    INSERT INTO service_account_rate_limits (service_account_id, window_start, window_type, request_count)
    VALUES (p_service_account_id, date_trunc('hour', NOW()), 'hour', 1)
    ON CONFLICT (service_account_id, window_start, window_type)
    DO UPDATE SET request_count = service_account_rate_limits.request_count + 1;
    
    -- Cleanup old windows (older than 2 hours)
    DELETE FROM service_account_rate_limits
    WHERE window_start < NOW() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE service_accounts IS 'Service accounts for automated system access (status page, integrations, etc.)';
COMMENT ON TABLE service_account_audit_log IS 'Audit log for all service account API access (SOC2 compliance)';
COMMENT ON TABLE public_health_status_cache IS 'Cached public health status to reduce database load';
COMMENT ON TABLE public_incidents IS 'Public incident reports for status page display';
COMMENT ON TABLE scheduled_maintenance IS 'Scheduled maintenance windows for status page display';
COMMENT ON TABLE uptime_history IS 'Historical uptime records for SLA reporting';
