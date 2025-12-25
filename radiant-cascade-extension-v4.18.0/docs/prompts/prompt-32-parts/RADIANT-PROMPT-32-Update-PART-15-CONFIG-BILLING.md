# SECTION 42: DYNAMIC CONFIGURATION MANAGEMENT SYSTEM (v4.8.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **CRITICAL: This section eliminates ALL hardcoded runtime parameters.**
> **Every configurable value is now stored in the database and editable by admins.**

---

## 42.1 ARCHITECTURE OVERVIEW

### The Problem

Before v4.8.0, RADIANT had numerous hardcoded parameters scattered throughout the codebase:

```
BEFORE (v4.7.x and earlier):
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Hardcoded Parameters Everywhere                                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                     â”‚
â”‚  TypeScript Constants:                                              â”‚
â”‚  const MAX_TOKENS = 128000;  â† Hardcoded!                          â”‚
â”‚  const DEFAULT_MARGIN = 0.40;  â† Hardcoded!                        â”‚
â”‚  const RETRY_ATTEMPTS = 3;  â† Hardcoded!                           â”‚
â”‚                                                                     â”‚
â”‚  Lambda Environment:                                                â”‚
â”‚  timeout: Duration.seconds(30)  â† Hardcoded!                       â”‚
â”‚  memorySize: 512  â† Hardcoded!                                     â”‚
â”‚                                                                     â”‚
â”‚  Rate Limits:                                                       â”‚
â”‚  maxConcurrent: 10  â† Hardcoded!                                   â”‚
â”‚  maxPerMinute: 100  â† Hardcoded!                                   â”‚
â”‚                                                                     â”‚
â”‚  Problems:                                                          â”‚
â”‚  â”œâ”€â”€ Cannot adjust without code deployment                          â”‚
â”‚  â”œâ”€â”€ No per-tenant customization                                    â”‚
â”‚  â”œâ”€â”€ No audit trail of changes                                      â”‚
â”‚  â””â”€â”€ Incident response requires developer                           â”‚
â”‚                                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### The Solution

v4.8.0 implements **complete database-driven configuration**:

```
AFTER (v4.8.0):
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Centralized Configuration Registry                                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ system_configuration (Global Defaults)                      â”‚   â”‚
â”‚  â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚   â”‚
â”‚  â”‚ â”‚ key: "pricing.external_provider_margin"                 â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ value: 0.40                                             â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ category: "pricing"                                     â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ type: "decimal"                                         â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ min: 0.00, max: 1.00                                    â”‚ â”‚   â”‚
â”‚  â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚           â”‚                                                         â”‚
â”‚           â–¼                                                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ tenant_configuration_overrides                              â”‚   â”‚
â”‚  â”‚ â”œâ”€â”€ tenant_abc: 0.35 (negotiated discount)                 â”‚   â”‚
â”‚  â”‚ â”œâ”€â”€ tenant_xyz: 0.50 (premium support)                     â”‚   â”‚
â”‚  â”‚ â””â”€â”€ (others use global default 0.40)                       â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                     â”‚
â”‚  Usage: getConfig('pricing.external_provider_margin', tenantId)    â”‚
â”‚  Returns: 0.35 for tenant_abc, 0.40 for others                     â”‚
â”‚                                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Configuration Categories (12)

| Category | Description | Example Parameters |
|----------|-------------|-------------------|
| `rate_limits` | API and service rate limits | requests_per_minute, concurrent_connections |
| `timeouts` | Request and processing timeouts | lambda_timeout, request_timeout, session_idle |
| `pricing` | Margins, markups, discounts | external_margin, self_hosted_margin, minimum_charge |
| `tokens` | Token and context limits | max_tokens_per_request, max_context_window |
| `retry` | Retry and backoff configuration | max_attempts, initial_delay, backoff_multiplier |
| `cache` | Cache TTL and invalidation | translation_bundle_ttl, model_list_ttl |
| `thresholds` | Health, confidence, quality thresholds | health_check_threshold, confidence_minimum |
| `discounts` | Volume discount tiers | tier_1_threshold, tier_1_discount |
| `session` | Auth and session settings | token_expiry, refresh_window, max_sessions |
| `translation` | i18n system settings | concurrent_limit, per_minute_limit |
| `workflow` | Workflow proposal thresholds | min_occurrences, min_unique_users |
| `notifications` | Alert and notification settings | alert_thresholds, channels, cooldown |

---

## 42.2 DATABASE SCHEMA

### Migration: 042_configuration_management.sql

```sql
-- ============================================================================
-- RADIANT v4.8.0 - Dynamic Configuration Management System
-- Migration: 042_configuration_management.sql
-- ============================================================================

-- ============================================================================
-- 42.2.1 Configuration Categories
-- ============================================================================

CREATE TABLE configuration_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 100,
    icon VARCHAR(50),  -- Material UI icon name
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuration_categories (id, name, description, display_order, icon) VALUES
('rate_limits', 'Rate Limits', 'API and service rate limiting configuration', 1, 'Speed'),
('timeouts', 'Timeouts', 'Request and processing timeout settings', 2, 'Timer'),
('pricing', 'Pricing', 'Margins, markups, and discount configuration', 3, 'AttachMoney'),
('tokens', 'Token Limits', 'Token and context window limits', 4, 'Token'),
('retry', 'Retry Configuration', 'Retry attempts and backoff settings', 5, 'Refresh'),
('cache', 'Cache Settings', 'Cache TTL and invalidation rules', 6, 'Cached'),
('thresholds', 'Thresholds', 'Health, confidence, and quality thresholds', 7, 'TrendingUp'),
('discounts', 'Volume Discounts', 'Volume-based discount tier configuration', 8, 'Discount'),
('session', 'Session & Auth', 'Authentication and session settings', 9, 'Lock'),
('translation', 'Translation System', 'i18n and translation service settings', 10, 'Translate'),
('workflow', 'Workflow Proposals', 'Dynamic workflow proposal thresholds', 11, 'AccountTree'),
('notifications', 'Notifications', 'Alert thresholds and notification channels', 12, 'Notifications');

-- ============================================================================
-- 42.2.2 Configuration Value Types
-- ============================================================================

CREATE TYPE config_value_type AS ENUM (
    'string',
    'integer', 
    'decimal',
    'boolean',
    'json',
    'duration',     -- Stored as seconds, displayed as human-readable
    'percentage',   -- Stored as decimal (0.40 = 40%)
    'enum'
);

-- ============================================================================
-- 42.2.3 System Configuration (Global Defaults)
-- ============================================================================

CREATE TABLE system_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    key VARCHAR(100) NOT NULL UNIQUE,
    category_id VARCHAR(50) NOT NULL REFERENCES configuration_categories(id),
    
    -- Value storage
    value_type config_value_type NOT NULL,
    value_string TEXT,           -- For string, enum types
    value_integer BIGINT,        -- For integer, duration types
    value_decimal DECIMAL(20,6), -- For decimal, percentage types
    value_boolean BOOLEAN,       -- For boolean type
    value_json JSONB,            -- For json type
    
    -- Metadata
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    unit VARCHAR(50),            -- e.g., 'seconds', 'requests', '%', 'tokens'
    
    -- Validation constraints
    min_value DECIMAL(20,6),
    max_value DECIMAL(20,6),
    enum_values TEXT[],          -- For enum type
    regex_pattern TEXT,          -- For string validation
    
    -- Environment scoping
    environment VARCHAR(20) DEFAULT 'all',  -- 'all', 'dev', 'staging', 'prod'
    
    -- Feature flags
    is_sensitive BOOLEAN DEFAULT FALSE,     -- Mask value in UI
    requires_restart BOOLEAN DEFAULT FALSE, -- Warn admin
    is_deprecated BOOLEAN DEFAULT FALSE,
    deprecated_replacement_key VARCHAR(100),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES administrators(id),
    
    -- Constraints
    CONSTRAINT valid_value CHECK (
        (value_type = 'string' AND value_string IS NOT NULL) OR
        (value_type = 'integer' AND value_integer IS NOT NULL) OR
        (value_type = 'decimal' AND value_decimal IS NOT NULL) OR
        (value_type = 'boolean' AND value_boolean IS NOT NULL) OR
        (value_type = 'json' AND value_json IS NOT NULL) OR
        (value_type = 'duration' AND value_integer IS NOT NULL) OR
        (value_type = 'percentage' AND value_decimal IS NOT NULL) OR
        (value_type = 'enum' AND value_string IS NOT NULL)
    )
);

CREATE INDEX idx_system_config_category ON system_configuration(category_id);
CREATE INDEX idx_system_config_key ON system_configuration(key);
CREATE INDEX idx_system_config_env ON system_configuration(environment);

-- ============================================================================
-- 42.2.4 Tenant Configuration Overrides
-- ============================================================================

CREATE TABLE tenant_configuration_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config_id UUID NOT NULL REFERENCES system_configuration(id) ON DELETE CASCADE,
    
    -- Override value (same structure as system_configuration)
    value_string TEXT,
    value_integer BIGINT,
    value_decimal DECIMAL(20,6),
    value_boolean BOOLEAN,
    value_json JSONB,
    
    -- Validity period (optional)
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,  -- NULL = forever
    
    -- Audit
    reason TEXT,              -- Why this override exists
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES administrators(id),
    updated_by UUID REFERENCES administrators(id),
    
    UNIQUE(tenant_id, config_id)
);

CREATE INDEX idx_tenant_config_tenant ON tenant_configuration_overrides(tenant_id);
CREATE INDEX idx_tenant_config_config ON tenant_configuration_overrides(config_id);
CREATE INDEX idx_tenant_config_validity ON tenant_configuration_overrides(valid_from, valid_until);

-- RLS
ALTER TABLE tenant_configuration_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_config_isolation ON tenant_configuration_overrides
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- 42.2.5 Configuration Audit Log
-- ============================================================================

CREATE TABLE configuration_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What changed
    config_id UUID REFERENCES system_configuration(id) ON DELETE SET NULL,
    tenant_override_id UUID REFERENCES tenant_configuration_overrides(id) ON DELETE SET NULL,
    config_key VARCHAR(100) NOT NULL,
    tenant_id UUID,  -- NULL for global changes
    
    -- Change details
    action VARCHAR(50) NOT NULL,  -- 'created', 'updated', 'deleted', 'override_created', 'override_deleted'
    old_value JSONB,
    new_value JSONB,
    
    -- Who made the change
    changed_by UUID REFERENCES administrators(id),
    changed_by_email VARCHAR(255),
    
    -- Context
    reason TEXT,
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_config_audit_config ON configuration_audit_log(config_id);
CREATE INDEX idx_config_audit_tenant ON configuration_audit_log(tenant_id);
CREATE INDEX idx_config_audit_created ON configuration_audit_log(created_at DESC);
CREATE INDEX idx_config_audit_key ON configuration_audit_log(config_key);

-- ============================================================================
-- 42.2.6 Configuration Cache Invalidation
-- ============================================================================

CREATE TABLE configuration_cache_invalidation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL,
    tenant_id UUID,  -- NULL = global invalidation
    invalidated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by VARCHAR(100)  -- Lambda function name that processed it
);

CREATE INDEX idx_config_cache_pending ON configuration_cache_invalidation(invalidated_at) 
    WHERE processed_at IS NULL;

-- ============================================================================
-- 42.2.7 Helper Functions
-- ============================================================================

-- Get configuration value with tenant override support
CREATE OR REPLACE FUNCTION get_config(
    p_key VARCHAR(100),
    p_tenant_id UUID DEFAULT NULL,
    p_environment VARCHAR(20) DEFAULT 'prod'
) RETURNS JSONB AS $$
DECLARE
    v_config system_configuration%ROWTYPE;
    v_override tenant_configuration_overrides%ROWTYPE;
    v_result JSONB;
BEGIN
    -- Get base configuration
    SELECT * INTO v_config
    FROM system_configuration
    WHERE key = p_key
      AND (environment = 'all' OR environment = p_environment);
    
    IF v_config IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Build base result
    v_result = jsonb_build_object(
        'key', v_config.key,
        'type', v_config.value_type,
        'value', CASE v_config.value_type
            WHEN 'string' THEN to_jsonb(v_config.value_string)
            WHEN 'integer' THEN to_jsonb(v_config.value_integer)
            WHEN 'decimal' THEN to_jsonb(v_config.value_decimal)
            WHEN 'boolean' THEN to_jsonb(v_config.value_boolean)
            WHEN 'json' THEN v_config.value_json
            WHEN 'duration' THEN to_jsonb(v_config.value_integer)
            WHEN 'percentage' THEN to_jsonb(v_config.value_decimal)
            WHEN 'enum' THEN to_jsonb(v_config.value_string)
        END,
        'is_override', false
    );
    
    -- Check for tenant override if tenant_id provided
    IF p_tenant_id IS NOT NULL THEN
        SELECT * INTO v_override
        FROM tenant_configuration_overrides
        WHERE config_id = v_config.id
          AND tenant_id = p_tenant_id
          AND valid_from <= NOW()
          AND (valid_until IS NULL OR valid_until > NOW());
        
        IF v_override IS NOT NULL THEN
            v_result = jsonb_set(v_result, '{value}', 
                CASE v_config.value_type
                    WHEN 'string' THEN to_jsonb(v_override.value_string)
                    WHEN 'integer' THEN to_jsonb(v_override.value_integer)
                    WHEN 'decimal' THEN to_jsonb(v_override.value_decimal)
                    WHEN 'boolean' THEN to_jsonb(v_override.value_boolean)
                    WHEN 'json' THEN v_override.value_json
                    WHEN 'duration' THEN to_jsonb(v_override.value_integer)
                    WHEN 'percentage' THEN to_jsonb(v_override.value_decimal)
                    WHEN 'enum' THEN to_jsonb(v_override.value_string)
                END
            );
            v_result = jsonb_set(v_result, '{is_override}', 'true'::jsonb);
        END IF;
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get all configurations for a category
CREATE OR REPLACE FUNCTION get_configs_by_category(
    p_category VARCHAR(50),
    p_tenant_id UUID DEFAULT NULL,
    p_environment VARCHAR(20) DEFAULT 'prod'
) RETURNS TABLE (
    key VARCHAR(100),
    value JSONB,
    display_name VARCHAR(200),
    description TEXT,
    value_type config_value_type,
    unit VARCHAR(50),
    is_override BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.key,
        (get_config(sc.key, p_tenant_id, p_environment))->>'value',
        sc.display_name,
        sc.description,
        sc.value_type,
        sc.unit,
        ((get_config(sc.key, p_tenant_id, p_environment))->>'is_override')::BOOLEAN
    FROM system_configuration sc
    WHERE sc.category_id = p_category
      AND (sc.environment = 'all' OR sc.environment = p_environment)
      AND sc.is_deprecated = false
    ORDER BY sc.key;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger to log configuration changes
CREATE OR REPLACE FUNCTION log_config_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO configuration_audit_log (
            config_id, config_key, action, new_value, changed_by
        ) VALUES (
            NEW.id, NEW.key, 'created',
            jsonb_build_object('value', COALESCE(
                to_jsonb(NEW.value_string),
                to_jsonb(NEW.value_integer),
                to_jsonb(NEW.value_decimal),
                to_jsonb(NEW.value_boolean),
                NEW.value_json
            )),
            NEW.updated_by
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO configuration_audit_log (
            config_id, config_key, action, old_value, new_value, changed_by
        ) VALUES (
            NEW.id, NEW.key, 'updated',
            jsonb_build_object('value', COALESCE(
                to_jsonb(OLD.value_string),
                to_jsonb(OLD.value_integer),
                to_jsonb(OLD.value_decimal),
                to_jsonb(OLD.value_boolean),
                OLD.value_json
            )),
            jsonb_build_object('value', COALESCE(
                to_jsonb(NEW.value_string),
                to_jsonb(NEW.value_integer),
                to_jsonb(NEW.value_decimal),
                to_jsonb(NEW.value_boolean),
                NEW.value_json
            )),
            NEW.updated_by
        );
        
        -- Queue cache invalidation
        INSERT INTO configuration_cache_invalidation (config_key)
        VALUES (NEW.key);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_config_changes
    AFTER INSERT OR UPDATE ON system_configuration
    FOR EACH ROW
    EXECUTE FUNCTION log_config_changes();

-- Trigger for tenant override changes
CREATE OR REPLACE FUNCTION log_tenant_override_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_config_key VARCHAR(100);
BEGIN
    SELECT key INTO v_config_key FROM system_configuration WHERE id = COALESCE(NEW.config_id, OLD.config_id);
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO configuration_audit_log (
            tenant_override_id, config_key, tenant_id, action, new_value, changed_by, reason
        ) VALUES (
            NEW.id, v_config_key, NEW.tenant_id, 'override_created',
            jsonb_build_object('value', COALESCE(
                to_jsonb(NEW.value_string),
                to_jsonb(NEW.value_integer),
                to_jsonb(NEW.value_decimal),
                to_jsonb(NEW.value_boolean),
                NEW.value_json
            )),
            NEW.created_by, NEW.reason
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO configuration_audit_log (
            tenant_override_id, config_key, tenant_id, action, old_value, new_value, changed_by, reason
        ) VALUES (
            NEW.id, v_config_key, NEW.tenant_id, 'override_updated',
            jsonb_build_object('value', COALESCE(
                to_jsonb(OLD.value_string),
                to_jsonb(OLD.value_integer),
                to_jsonb(OLD.value_decimal),
                to_jsonb(OLD.value_boolean),
                OLD.value_json
            )),
            jsonb_build_object('value', COALESCE(
                to_jsonb(NEW.value_string),
                to_jsonb(NEW.value_integer),
                to_jsonb(NEW.value_decimal),
                to_jsonb(NEW.value_boolean),
                NEW.value_json
            )),
            NEW.updated_by, NEW.reason
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO configuration_audit_log (
            config_key, tenant_id, action, old_value, changed_by
        ) VALUES (
            v_config_key, OLD.tenant_id, 'override_deleted',
            jsonb_build_object('value', COALESCE(
                to_jsonb(OLD.value_string),
                to_jsonb(OLD.value_integer),
                to_jsonb(OLD.value_decimal),
                to_jsonb(OLD.value_boolean),
                OLD.value_json
            )),
            current_setting('app.current_admin_id', true)::UUID
        );
    END IF;
    
    -- Queue cache invalidation
    INSERT INTO configuration_cache_invalidation (config_key, tenant_id)
    VALUES (v_config_key, COALESCE(NEW.tenant_id, OLD.tenant_id));
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_tenant_override_changes
    AFTER INSERT OR UPDATE OR DELETE ON tenant_configuration_overrides
    FOR EACH ROW
    EXECUTE FUNCTION log_tenant_override_changes();
```

---

## 42.3 SEED CONFIGURATION DATA

### Migration: 042b_seed_configuration.sql

```sql
-- ============================================================================
-- RADIANT v4.8.0 - Seed Initial Configuration Values
-- Migration: 042b_seed_configuration.sql
-- ============================================================================

-- ============================================================================
-- Rate Limits
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('rate_limits.api.requests_per_minute', 'rate_limits', 'integer', 1000, 'API Requests per Minute', 'Maximum API requests allowed per minute per tenant', 'requests', 10, 100000),
('rate_limits.api.requests_per_hour', 'rate_limits', 'integer', 50000, 'API Requests per Hour', 'Maximum API requests allowed per hour per tenant', 'requests', 100, 1000000),
('rate_limits.api.concurrent_connections', 'rate_limits', 'integer', 100, 'Concurrent Connections', 'Maximum concurrent API connections per tenant', 'connections', 1, 10000),
('rate_limits.chat.messages_per_minute', 'rate_limits', 'integer', 60, 'Chat Messages per Minute', 'Maximum chat messages per minute per user', 'messages', 1, 1000),
('rate_limits.chat.concurrent_sessions', 'rate_limits', 'integer', 5, 'Concurrent Chat Sessions', 'Maximum concurrent chat sessions per user', 'sessions', 1, 100),
('rate_limits.file_upload.max_size_mb', 'rate_limits', 'integer', 100, 'Max File Upload Size', 'Maximum file upload size in megabytes', 'MB', 1, 1000),
('rate_limits.file_upload.per_hour', 'rate_limits', 'integer', 50, 'File Uploads per Hour', 'Maximum file uploads per hour per user', 'uploads', 1, 1000);

-- ============================================================================
-- Timeouts
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('timeouts.lambda.default', 'timeouts', 'duration', 30, 'Default Lambda Timeout', 'Default timeout for Lambda functions', 'seconds', 1, 900),
('timeouts.lambda.chat', 'timeouts', 'duration', 120, 'Chat Lambda Timeout', 'Timeout for chat processing Lambda', 'seconds', 30, 900),
('timeouts.lambda.orchestration', 'timeouts', 'duration', 300, 'Orchestration Lambda Timeout', 'Timeout for complex orchestrations', 'seconds', 60, 900),
('timeouts.lambda.batch', 'timeouts', 'duration', 900, 'Batch Processing Timeout', 'Timeout for batch processing Lambda', 'seconds', 60, 900),
('timeouts.request.api_gateway', 'timeouts', 'duration', 29, 'API Gateway Timeout', 'API Gateway integration timeout', 'seconds', 1, 29),
('timeouts.request.external_provider', 'timeouts', 'duration', 60, 'External Provider Timeout', 'Timeout for external AI provider calls', 'seconds', 10, 300),
('timeouts.session.idle', 'timeouts', 'duration', 1800, 'Session Idle Timeout', 'Time before idle session expires', 'seconds', 300, 86400),
('timeouts.session.absolute', 'timeouts', 'duration', 86400, 'Absolute Session Timeout', 'Maximum session duration', 'seconds', 3600, 604800);

-- ============================================================================
-- Pricing
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_decimal, display_name, description, unit, min_value, max_value) VALUES
('pricing.external_provider_margin', 'pricing', 'percentage', 0.40, 'External Provider Margin', 'Default markup on external AI provider costs', '%', 0.00, 1.00),
('pricing.self_hosted_margin', 'pricing', 'percentage', 0.75, 'Self-Hosted Margin', 'Default markup on self-hosted model costs', '%', 0.00, 2.00),
('pricing.minimum_charge', 'pricing', 'decimal', 0.01, 'Minimum Charge', 'Minimum charge per transaction', 'USD', 0.001, 1.00),
('pricing.tax_rate_default', 'pricing', 'percentage', 0.00, 'Default Tax Rate', 'Default tax rate applied to invoices', '%', 0.00, 0.50);

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('pricing.invoice.due_days', 'pricing', 'integer', 30, 'Invoice Due Days', 'Days until invoice is due', 'days', 1, 90),
('pricing.invoice.reminder_days', 'pricing', 'integer', 7, 'Invoice Reminder Days', 'Days before due date to send reminder', 'days', 1, 30);

-- ============================================================================
-- Token Limits
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('tokens.max_per_request', 'tokens', 'integer', 128000, 'Max Tokens per Request', 'Maximum tokens allowed in a single request', 'tokens', 1000, 1000000),
('tokens.max_context_window', 'tokens', 'integer', 200000, 'Max Context Window', 'Maximum context window size', 'tokens', 4000, 2000000),
('tokens.max_output', 'tokens', 'integer', 8192, 'Max Output Tokens', 'Maximum tokens in response', 'tokens', 100, 100000),
('tokens.streaming_chunk_size', 'tokens', 'integer', 100, 'Streaming Chunk Size', 'Tokens per streaming chunk', 'tokens', 1, 1000);

-- ============================================================================
-- Retry Configuration
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('retry.max_attempts', 'retry', 'integer', 3, 'Max Retry Attempts', 'Maximum number of retry attempts', 'attempts', 0, 10),
('retry.initial_delay_ms', 'retry', 'integer', 1000, 'Initial Retry Delay', 'Initial delay before first retry', 'ms', 100, 30000),
('retry.max_delay_ms', 'retry', 'integer', 30000, 'Max Retry Delay', 'Maximum delay between retries', 'ms', 1000, 300000);

INSERT INTO system_configuration (key, category_id, value_type, value_decimal, display_name, description, unit, min_value, max_value) VALUES
('retry.backoff_multiplier', 'retry', 'decimal', 2.0, 'Backoff Multiplier', 'Multiplier for exponential backoff', 'x', 1.0, 5.0),
('retry.jitter_factor', 'retry', 'decimal', 0.1, 'Jitter Factor', 'Random jitter added to delays', '%', 0.0, 0.5);

-- ============================================================================
-- Cache Settings
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('cache.translation_bundle_ttl', 'cache', 'duration', 300, 'Translation Bundle TTL', 'Cache duration for translation bundles', 'seconds', 60, 86400),
('cache.model_list_ttl', 'cache', 'duration', 300, 'Model List TTL', 'Cache duration for AI model lists', 'seconds', 60, 3600),
('cache.provider_health_ttl', 'cache', 'duration', 60, 'Provider Health TTL', 'Cache duration for provider health status', 'seconds', 10, 300),
('cache.user_preferences_ttl', 'cache', 'duration', 600, 'User Preferences TTL', 'Cache duration for user preferences', 'seconds', 60, 3600),
('cache.config_ttl', 'cache', 'duration', 300, 'Configuration TTL', 'Cache duration for system configuration', 'seconds', 30, 3600);

-- ============================================================================
-- Thresholds
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('thresholds.health_check.healthy', 'thresholds', 'integer', 2, 'Healthy Threshold', 'Consecutive healthy checks before marking healthy', 'checks', 1, 10),
('thresholds.health_check.unhealthy', 'thresholds', 'integer', 3, 'Unhealthy Threshold', 'Consecutive failed checks before marking unhealthy', 'checks', 1, 10);

INSERT INTO system_configuration (key, category_id, value_type, value_decimal, display_name, description, unit, min_value, max_value) VALUES
('thresholds.confidence.minimum', 'thresholds', 'percentage', 0.70, 'Minimum Confidence', 'Minimum confidence score for auto-decisions', '%', 0.00, 1.00),
('thresholds.confidence.high', 'thresholds', 'percentage', 0.90, 'High Confidence', 'Threshold for high-confidence decisions', '%', 0.00, 1.00),
('thresholds.autoscaling.target_utilization', 'thresholds', 'percentage', 0.70, 'Target Utilization', 'Target CPU utilization for autoscaling', '%', 0.30, 0.95);

-- ============================================================================
-- Volume Discounts
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('discounts.tier_1.threshold', 'discounts', 'integer', 1000000, 'Tier 1 Threshold', 'Token threshold for tier 1 discount', 'tokens', 0, 1000000000),
('discounts.tier_2.threshold', 'discounts', 'integer', 10000000, 'Tier 2 Threshold', 'Token threshold for tier 2 discount', 'tokens', 0, 1000000000),
('discounts.tier_3.threshold', 'discounts', 'integer', 100000000, 'Tier 3 Threshold', 'Token threshold for tier 3 discount', 'tokens', 0, 1000000000);

INSERT INTO system_configuration (key, category_id, value_type, value_decimal, display_name, description, unit, min_value, max_value) VALUES
('discounts.tier_1.percentage', 'discounts', 'percentage', 0.05, 'Tier 1 Discount', 'Discount percentage for tier 1', '%', 0.00, 0.50),
('discounts.tier_2.percentage', 'discounts', 'percentage', 0.10, 'Tier 2 Discount', 'Discount percentage for tier 2', '%', 0.00, 0.50),
('discounts.tier_3.percentage', 'discounts', 'percentage', 0.15, 'Tier 3 Discount', 'Discount percentage for tier 3', '%', 0.00, 0.50);

-- ============================================================================
-- Session & Auth
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('session.token_expiry', 'session', 'duration', 3600, 'Token Expiry', 'Access token expiration time', 'seconds', 300, 86400),
('session.refresh_token_expiry', 'session', 'duration', 2592000, 'Refresh Token Expiry', 'Refresh token expiration time', 'seconds', 86400, 7776000),
('session.max_per_user', 'session', 'integer', 5, 'Max Sessions per User', 'Maximum concurrent sessions per user', 'sessions', 1, 100),
('session.invitation_expiry', 'session', 'duration', 604800, 'Invitation Expiry', 'Admin invitation expiration time', 'seconds', 3600, 2592000);

-- ============================================================================
-- Translation System
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('translation.concurrent_limit', 'translation', 'integer', 10, 'Concurrent Translations', 'Maximum concurrent translation requests', 'requests', 1, 100),
('translation.per_minute_limit', 'translation', 'integer', 100, 'Translations per Minute', 'Maximum translations per minute', 'requests', 10, 1000),
('translation.per_hour_limit', 'translation', 'integer', 1000, 'Translations per Hour', 'Maximum translations per hour', 'requests', 100, 10000),
('translation.retry_attempts', 'translation', 'integer', 3, 'Translation Retry Attempts', 'Number of retry attempts for failed translations', 'attempts', 0, 10),
('translation.retry_delay_ms', 'translation', 'integer', 1000, 'Translation Retry Delay', 'Initial retry delay for translations', 'ms', 100, 30000),
('translation.queue_batch_size', 'translation', 'integer', 50, 'Translation Queue Batch', 'Number of translations to process per batch', 'items', 1, 200);

-- ============================================================================
-- Workflow Proposals
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('workflow.proposal.min_occurrences', 'workflow', 'integer', 5, 'Min Occurrences', 'Minimum pattern occurrences before proposal', 'occurrences', 1, 100),
('workflow.proposal.min_unique_users', 'workflow', 'integer', 3, 'Min Unique Users', 'Minimum unique users affected', 'users', 1, 50),
('workflow.proposal.min_time_span_hours', 'workflow', 'integer', 24, 'Min Time Span', 'Minimum hours of pattern observation', 'hours', 1, 720),
('workflow.proposal.max_per_day', 'workflow', 'integer', 10, 'Max Proposals per Day', 'Maximum new proposals per day', 'proposals', 1, 100),
('workflow.proposal.max_per_week', 'workflow', 'integer', 30, 'Max Proposals per Week', 'Maximum new proposals per week', 'proposals', 1, 500);

INSERT INTO system_configuration (key, category_id, value_type, value_decimal, display_name, description, unit, min_value, max_value) VALUES
('workflow.proposal.min_impact_score', 'workflow', 'percentage', 0.60, 'Min Impact Score', 'Minimum impact score for proposal generation', '%', 0.00, 1.00),
('workflow.proposal.min_confidence', 'workflow', 'percentage', 0.75, 'Min Confidence', 'Minimum confidence score for proposals', '%', 0.00, 1.00);

-- ============================================================================
-- Notifications
-- ============================================================================

INSERT INTO system_configuration (key, category_id, value_type, value_json, display_name, description) VALUES
('notifications.usage_alert_thresholds', 'notifications', 'json', '[50, 75, 90, 100]', 'Usage Alert Thresholds', 'Percentage thresholds for usage alerts');

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
('notifications.alert_cooldown', 'notifications', 'duration', 3600, 'Alert Cooldown', 'Minimum time between duplicate alerts', 'seconds', 60, 86400),
('notifications.digest_frequency', 'notifications', 'duration', 86400, 'Digest Frequency', 'Frequency of notification digests', 'seconds', 3600, 604800);

INSERT INTO system_configuration (key, category_id, value_type, value_boolean, display_name, description) VALUES
('notifications.email_enabled', 'notifications', 'boolean', true, 'Email Notifications', 'Enable email notifications'),
('notifications.slack_enabled', 'notifications', 'boolean', false, 'Slack Notifications', 'Enable Slack notifications'),
('notifications.webhook_enabled', 'notifications', 'boolean', false, 'Webhook Notifications', 'Enable webhook notifications');
```

---

## 42.4 TYPESCRIPT TYPES

### File: `packages/shared/src/config/types.ts`

```typescript
// ============================================================================
// RADIANT v4.8.0 - Configuration Management Types
// ============================================================================

/**
 * Configuration value types
 */
export type ConfigValueType = 
  | 'string'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'json'
  | 'duration'
  | 'percentage'
  | 'enum';

/**
 * Configuration category
 */
export interface ConfigCategory {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  icon?: string;
}

/**
 * System configuration entry
 */
export interface SystemConfig {
  id: string;
  key: string;
  categoryId: string;
  valueType: ConfigValueType;
  value: string | number | boolean | object;
  displayName: string;
  description?: string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  enumValues?: string[];
  regexPattern?: string;
  environment: 'all' | 'dev' | 'staging' | 'prod';
  isSensitive: boolean;
  requiresRestart: boolean;
  isDeprecated: boolean;
  deprecatedReplacementKey?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

/**
 * Tenant configuration override
 */
export interface TenantConfigOverride {
  id: string;
  tenantId: string;
  configId: string;
  value: string | number | boolean | object;
  validFrom: string;
  validUntil?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Configuration with resolved value (after tenant override)
 */
export interface ResolvedConfig {
  key: string;
  value: string | number | boolean | object;
  type: ConfigValueType;
  isOverride: boolean;
  displayName?: string;
  unit?: string;
}

/**
 * Configuration audit log entry
 */
export interface ConfigAuditEntry {
  id: string;
  configId?: string;
  tenantOverrideId?: string;
  configKey: string;
  tenantId?: string;
  action: 'created' | 'updated' | 'deleted' | 'override_created' | 'override_updated' | 'override_deleted';
  oldValue?: object;
  newValue?: object;
  changedBy?: string;
  changedByEmail?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

/**
 * Configuration update request
 */
export interface ConfigUpdateRequest {
  value: string | number | boolean | object;
  reason?: string;
}

/**
 * Tenant override request
 */
export interface TenantOverrideRequest {
  value: string | number | boolean | object;
  reason?: string;
  validFrom?: string;
  validUntil?: string;
}

/**
 * Configuration export/import format
 */
export interface ConfigExport {
  version: string;
  exportedAt: string;
  exportedBy: string;
  configs: Array<{
    key: string;
    value: string | number | boolean | object;
  }>;
  tenantOverrides?: Array<{
    tenantId: string;
    key: string;
    value: string | number | boolean | object;
    reason?: string;
  }>;
}
```

### File: `packages/shared/src/config/constants.ts`

```typescript
// ============================================================================
// RADIANT v4.8.0 - Configuration Constants
// ============================================================================

/**
 * Configuration categories
 */
export const CONFIG_CATEGORIES = {
  RATE_LIMITS: 'rate_limits',
  TIMEOUTS: 'timeouts',
  PRICING: 'pricing',
  TOKENS: 'tokens',
  RETRY: 'retry',
  CACHE: 'cache',
  THRESHOLDS: 'thresholds',
  DISCOUNTS: 'discounts',
  SESSION: 'session',
  TRANSLATION: 'translation',
  WORKFLOW: 'workflow',
  NOTIFICATIONS: 'notifications',
} as const;

/**
 * Common configuration keys
 */
export const CONFIG_KEYS = {
  // Rate Limits
  API_REQUESTS_PER_MINUTE: 'rate_limits.api.requests_per_minute',
  API_REQUESTS_PER_HOUR: 'rate_limits.api.requests_per_hour',
  API_CONCURRENT_CONNECTIONS: 'rate_limits.api.concurrent_connections',
  CHAT_MESSAGES_PER_MINUTE: 'rate_limits.chat.messages_per_minute',
  
  // Timeouts
  LAMBDA_DEFAULT_TIMEOUT: 'timeouts.lambda.default',
  LAMBDA_CHAT_TIMEOUT: 'timeouts.lambda.chat',
  EXTERNAL_PROVIDER_TIMEOUT: 'timeouts.request.external_provider',
  SESSION_IDLE_TIMEOUT: 'timeouts.session.idle',
  
  // Pricing
  EXTERNAL_PROVIDER_MARGIN: 'pricing.external_provider_margin',
  SELF_HOSTED_MARGIN: 'pricing.self_hosted_margin',
  MINIMUM_CHARGE: 'pricing.minimum_charge',
  
  // Tokens
  MAX_TOKENS_PER_REQUEST: 'tokens.max_per_request',
  MAX_CONTEXT_WINDOW: 'tokens.max_context_window',
  MAX_OUTPUT_TOKENS: 'tokens.max_output',
  
  // Retry
  MAX_RETRY_ATTEMPTS: 'retry.max_attempts',
  INITIAL_RETRY_DELAY: 'retry.initial_delay_ms',
  BACKOFF_MULTIPLIER: 'retry.backoff_multiplier',
  
  // Cache
  TRANSLATION_BUNDLE_TTL: 'cache.translation_bundle_ttl',
  MODEL_LIST_TTL: 'cache.model_list_ttl',
  CONFIG_TTL: 'cache.config_ttl',
  
  // Thresholds
  MIN_CONFIDENCE: 'thresholds.confidence.minimum',
  HIGH_CONFIDENCE: 'thresholds.confidence.high',
  
  // Translation
  TRANSLATION_CONCURRENT_LIMIT: 'translation.concurrent_limit',
  TRANSLATION_PER_MINUTE_LIMIT: 'translation.per_minute_limit',
  
  // Workflow
  WORKFLOW_MIN_OCCURRENCES: 'workflow.proposal.min_occurrences',
  WORKFLOW_MIN_UNIQUE_USERS: 'workflow.proposal.min_unique_users',
} as const;

export type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];
```

---

## 42.5 CONFIGURATION SERVICE

### File: `packages/shared/src/config/ConfigurationService.ts`

```typescript
// ============================================================================
// RADIANT v4.8.0 - Configuration Service
// ============================================================================

import { Pool } from 'pg';
import Redis from 'ioredis';
import { 
  SystemConfig, 
  ResolvedConfig, 
  ConfigValueType,
  ConfigUpdateRequest,
  TenantOverrideRequest,
  ConfigAuditEntry 
} from './types';
import { CONFIG_KEYS } from './constants';

export class ConfigurationService {
  private pool: Pool;
  private redis: Redis | null;
  private localCache: Map<string, { value: ResolvedConfig; expiresAt: number }>;
  private defaultTtl: number = 300; // 5 minutes
  
  constructor(pool: Pool, redis?: Redis) {
    this.pool = pool;
    this.redis = redis || null;
    this.localCache = new Map();
  }
  
  /**
   * Get a configuration value with tenant override support
   */
  async get<T = any>(
    key: string, 
    tenantId?: string,
    environment: string = 'prod'
  ): Promise<T> {
    const cacheKey = this.buildCacheKey(key, tenantId, environment);
    
    // Check local cache first
    const cached = this.localCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value.value as T;
    }
    
    // Check Redis cache
    if (this.redis) {
      const redisValue = await this.redis.get(cacheKey);
      if (redisValue) {
        const parsed = JSON.parse(redisValue) as ResolvedConfig;
        this.localCache.set(cacheKey, { 
          value: parsed, 
          expiresAt: Date.now() + this.defaultTtl * 1000 
        });
        return parsed.value as T;
      }
    }
    
    // Fetch from database
    const result = await this.pool.query(
      `SELECT * FROM get_config($1, $2, $3)`,
      [key, tenantId, environment]
    );
    
    if (!result.rows[0]) {
      throw new Error(`Configuration not found: ${key}`);
    }
    
    const config = result.rows[0] as ResolvedConfig;
    const value = this.parseValue(config);
    
    // Update caches
    const resolvedConfig = { ...config, value };
    
    if (this.redis) {
      await this.redis.setex(cacheKey, this.defaultTtl, JSON.stringify(resolvedConfig));
    }
    
    this.localCache.set(cacheKey, { 
      value: resolvedConfig, 
      expiresAt: Date.now() + this.defaultTtl * 1000 
    });
    
    return value as T;
  }
  
  /**
   * Get multiple configuration values
   */
  async getMultiple(
    keys: string[],
    tenantId?: string,
    environment: string = 'prod'
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    await Promise.all(
      keys.map(async (key) => {
        try {
          results[key] = await this.get(key, tenantId, environment);
        } catch {
          results[key] = undefined;
        }
      })
    );
    
    return results;
  }
  
  /**
   * Get all configurations in a category
   */
  async getByCategory(
    categoryId: string,
    tenantId?: string,
    environment: string = 'prod'
  ): Promise<ResolvedConfig[]> {
    const result = await this.pool.query(
      `SELECT * FROM get_configs_by_category($1, $2, $3)`,
      [categoryId, tenantId, environment]
    );
    
    return result.rows;
  }
  
  /**
   * Update a global configuration value
   */
  async update(
    key: string,
    request: ConfigUpdateRequest,
    updatedBy: string
  ): Promise<SystemConfig> {
    const config = await this.getConfigByKey(key);
    
    // Validate value
    this.validateValue(config, request.value);
    
    // Update based on type
    const updateColumn = this.getValueColumn(config.valueType);
    
    const result = await this.pool.query(`
      UPDATE system_configuration
      SET ${updateColumn} = $2,
          updated_at = NOW(),
          updated_by = $3
      WHERE key = $1
      RETURNING *
    `, [key, request.value, updatedBy]);
    
    // Invalidate caches
    await this.invalidateCache(key);
    
    return result.rows[0];
  }
  
  /**
   * Create a tenant-specific override
   */
  async createTenantOverride(
    key: string,
    tenantId: string,
    request: TenantOverrideRequest,
    createdBy: string
  ): Promise<TenantConfigOverride> {
    const config = await this.getConfigByKey(key);
    
    // Validate value
    this.validateValue(config, request.value);
    
    const valueColumn = this.getValueColumn(config.valueType);
    
    const result = await this.pool.query(`
      INSERT INTO tenant_configuration_overrides (
        tenant_id, config_id, ${valueColumn}, valid_from, valid_until, reason, created_by
      ) VALUES ($1, $2, $3, COALESCE($4, NOW()), $5, $6, $7)
      ON CONFLICT (tenant_id, config_id) DO UPDATE SET
        ${valueColumn} = $3,
        valid_from = COALESCE($4, NOW()),
        valid_until = $5,
        reason = $6,
        updated_by = $7,
        updated_at = NOW()
      RETURNING *
    `, [tenantId, config.id, request.value, request.validFrom, request.validUntil, request.reason, createdBy]);
    
    // Invalidate caches
    await this.invalidateCache(key, tenantId);
    
    return result.rows[0];
  }
  
  /**
   * Delete a tenant override (revert to global)
   */
  async deleteTenantOverride(
    key: string,
    tenantId: string
  ): Promise<void> {
    const config = await this.getConfigByKey(key);
    
    await this.pool.query(`
      DELETE FROM tenant_configuration_overrides
      WHERE config_id = $1 AND tenant_id = $2
    `, [config.id, tenantId]);
    
    await this.invalidateCache(key, tenantId);
  }
  
  /**
   * Get audit log for a configuration
   */
  async getAuditLog(
    key: string,
    options: { limit?: number; offset?: number; tenantId?: string } = {}
  ): Promise<ConfigAuditEntry[]> {
    const { limit = 50, offset = 0, tenantId } = options;
    
    let query = `
      SELECT * FROM configuration_audit_log
      WHERE config_key = $1
    `;
    const params: any[] = [key];
    
    if (tenantId) {
      query += ` AND (tenant_id = $${params.length + 1} OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }
  
  /**
   * Export all configurations
   */
  async exportConfigs(tenantId?: string): Promise<ConfigExport> {
    const configs = await this.pool.query(`
      SELECT key, 
             COALESCE(value_string, value_integer::text, value_decimal::text, value_boolean::text, value_json::text) as value
      FROM system_configuration
      WHERE is_deprecated = false
    `);
    
    let tenantOverrides: any[] = [];
    if (tenantId) {
      const overrides = await this.pool.query(`
        SELECT sc.key, 
               COALESCE(tco.value_string, tco.value_integer::text, tco.value_decimal::text, tco.value_boolean::text, tco.value_json::text) as value,
               tco.reason
        FROM tenant_configuration_overrides tco
        JOIN system_configuration sc ON sc.id = tco.config_id
        WHERE tco.tenant_id = $1
      `, [tenantId]);
      
      tenantOverrides = overrides.rows.map(r => ({
        tenantId,
        key: r.key,
        value: r.value,
        reason: r.reason,
      }));
    }
    
    return {
      version: '4.8.0',
      exportedAt: new Date().toISOString(),
      exportedBy: 'system',
      configs: configs.rows,
      tenantOverrides: tenantOverrides.length > 0 ? tenantOverrides : undefined,
    };
  }
  
  // Private helpers
  
  private buildCacheKey(key: string, tenantId?: string, environment?: string): string {
    return `config:${environment || 'prod'}:${tenantId || 'global'}:${key}`;
  }
  
  private async getConfigByKey(key: string): Promise<SystemConfig> {
    const result = await this.pool.query(
      `SELECT * FROM system_configuration WHERE key = $1`,
      [key]
    );
    
    if (!result.rows[0]) {
      throw new Error(`Configuration not found: ${key}`);
    }
    
    return result.rows[0];
  }
  
  private getValueColumn(type: ConfigValueType): string {
    switch (type) {
      case 'string':
      case 'enum':
        return 'value_string';
      case 'integer':
      case 'duration':
        return 'value_integer';
      case 'decimal':
      case 'percentage':
        return 'value_decimal';
      case 'boolean':
        return 'value_boolean';
      case 'json':
        return 'value_json';
      default:
        throw new Error(`Unknown value type: ${type}`);
    }
  }
  
  private parseValue(config: ResolvedConfig): any {
    const value = config.value;
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    
    return value;
  }
  
  private validateValue(config: SystemConfig, value: any): void {
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    
    if (config.minValue !== undefined && numValue < config.minValue) {
      throw new Error(`Value must be at least ${config.minValue}`);
    }
    
    if (config.maxValue !== undefined && numValue > config.maxValue) {
      throw new Error(`Value must be at most ${config.maxValue}`);
    }
    
    if (config.enumValues && !config.enumValues.includes(String(value))) {
      throw new Error(`Value must be one of: ${config.enumValues.join(', ')}`);
    }
    
    if (config.regexPattern) {
      const regex = new RegExp(config.regexPattern);
      if (!regex.test(String(value))) {
        throw new Error(`Value does not match required pattern`);
      }
    }
  }
  
  private async invalidateCache(key: string, tenantId?: string): Promise<void> {
    // Clear local cache
    for (const cacheKey of this.localCache.keys()) {
      if (cacheKey.includes(key)) {
        this.localCache.delete(cacheKey);
      }
    }
    
    // Clear Redis cache
    if (this.redis) {
      const pattern = tenantId 
        ? `config:*:${tenantId}:${key}`
        : `config:*:*:${key}`;
      
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
    
    // Add to invalidation queue for other instances
    await this.pool.query(`
      INSERT INTO configuration_cache_invalidation (config_key, tenant_id)
      VALUES ($1, $2)
    `, [key, tenantId]);
  }
}

// Singleton instance
let configService: ConfigurationService | null = null;

export function getConfigService(pool: Pool, redis?: Redis): ConfigurationService {
  if (!configService) {
    configService = new ConfigurationService(pool, redis);
  }
  return configService;
}

/**
 * Helper function to get a config value
 */
export async function getConfig<T = any>(
  key: string,
  tenantId?: string,
  environment?: string
): Promise<T> {
  if (!configService) {
    throw new Error('ConfigurationService not initialized');
  }
  return configService.get<T>(key, tenantId, environment);
}
```

---

## 42.6 ADMIN DASHBOARD - CONFIGURATION MANAGEMENT

### File: `admin-dashboard/app/configuration/page.tsx`

```typescript
// ============================================================================
// RADIANT v4.8.0 - Configuration Management Dashboard
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  Slider,
  Select,
  MenuItem,
  Alert,
  Tooltip,
  InputAdornment,
  Collapse,
} from '@mui/material';
import {
  Edit,
  History,
  Refresh,
  Settings,
  Speed,
  Timer,
  AttachMoney,
  Token,
  Cached,
  TrendingUp,
  Discount,
  Lock,
  Translate,
  AccountTree,
  Notifications,
  ExpandMore,
  ExpandLess,
  Warning,
  Check,
} from '@mui/icons-material';
import { useTranslation } from '@/hooks/useTranslation';
import { api } from '@/lib/api';

interface ConfigCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface SystemConfig {
  id: string;
  key: string;
  categoryId: string;
  valueType: string;
  value: any;
  displayName: string;
  description: string;
  unit: string;
  minValue: number;
  maxValue: number;
  enumValues: string[];
  isSensitive: boolean;
  requiresRestart: boolean;
  isOverride: boolean;
  updatedAt: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  rate_limits: <Speed />,
  timeouts: <Timer />,
  pricing: <AttachMoney />,
  tokens: <Token />,
  retry: <Refresh />,
  cache: <Cached />,
  thresholds: <TrendingUp />,
  discounts: <Discount />,
  session: <Lock />,
  translation: <Translate />,
  workflow: <AccountTree />,
  notifications: <Notifications />,
};

export default function ConfigurationPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<ConfigCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('rate_limits');
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [editDialog, setEditDialog] = useState<SystemConfig | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [historyDialog, setHistoryDialog] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (activeCategory) {
      loadConfigs(activeCategory);
    }
  }, [activeCategory]);

  async function loadCategories() {
    try {
      const res = await api.get('/configuration/categories');
      setCategories(res.data);
      if (res.data.length > 0) {
        setActiveCategory(res.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async function loadConfigs(categoryId: string) {
    setLoading(true);
    try {
      const res = await api.get(`/configuration/category/${categoryId}`);
      setConfigs(res.data);
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editDialog) return;
    try {
      await api.put(`/configuration/${editDialog.key}`, {
        value: editValue,
        reason: 'Updated via Admin Dashboard',
      });
      setEditDialog(null);
      loadConfigs(activeCategory);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  async function loadAuditLog(key: string) {
    try {
      const res = await api.get(`/configuration/${key}/audit`);
      setAuditLog(res.data);
      setHistoryDialog(key);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    }
  }

  function renderValueEditor(config: SystemConfig) {
    switch (config.valueType) {
      case 'boolean':
        return (
          <Switch
            checked={editValue === true || editValue === 'true'}
            onChange={(e) => setEditValue(e.target.checked)}
          />
        );
      
      case 'integer':
      case 'duration':
        return (
          <Box>
            <Slider
              value={Number(editValue)}
              onChange={(_, v) => setEditValue(v)}
              min={config.minValue || 0}
              max={config.maxValue || 100}
              valueLabelDisplay="auto"
            />
            <TextField
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(Number(e.target.value))}
              InputProps={{
                endAdornment: config.unit && (
                  <InputAdornment position="end">{config.unit}</InputAdornment>
                ),
              }}
              fullWidth
              sx={{ mt: 2 }}
            />
          </Box>
        );
      
      case 'decimal':
      case 'percentage':
        return (
          <Box>
            <Slider
              value={Number(editValue) * (config.valueType === 'percentage' ? 100 : 1)}
              onChange={(_, v) => setEditValue(
                (v as number) / (config.valueType === 'percentage' ? 100 : 1)
              )}
              min={(config.minValue || 0) * (config.valueType === 'percentage' ? 100 : 1)}
              max={(config.maxValue || 1) * (config.valueType === 'percentage' ? 100 : 1)}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => config.valueType === 'percentage' ? `${v}%` : v}
            />
            <TextField
              type="number"
              value={config.valueType === 'percentage' ? (editValue * 100).toFixed(0) : editValue}
              onChange={(e) => {
                const val = Number(e.target.value);
                setEditValue(config.valueType === 'percentage' ? val / 100 : val);
              }}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              fullWidth
              sx={{ mt: 2 }}
            />
          </Box>
        );
      
      case 'enum':
        return (
          <Select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            fullWidth
          >
            {config.enumValues?.map((val) => (
              <MenuItem key={val} value={val}>{val}</MenuItem>
            ))}
          </Select>
        );
      
      case 'json':
        return (
          <TextField
            multiline
            rows={6}
            value={typeof editValue === 'string' ? editValue : JSON.stringify(editValue, null, 2)}
            onChange={(e) => {
              try {
                setEditValue(JSON.parse(e.target.value));
              } catch {
                setEditValue(e.target.value);
              }
            }}
            fullWidth
            sx={{ fontFamily: 'monospace' }}
          />
        );
      
      default:
        return (
          <TextField
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            fullWidth
          />
        );
    }
  }

  function formatValue(config: SystemConfig): string {
    if (config.isSensitive) return 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢';
    
    switch (config.valueType) {
      case 'boolean':
        return config.value ? 'Enabled' : 'Disabled';
      case 'percentage':
        return `${(config.value * 100).toFixed(0)}%`;
      case 'duration':
        if (config.value >= 86400) return `${(config.value / 86400).toFixed(1)} days`;
        if (config.value >= 3600) return `${(config.value / 3600).toFixed(1)} hours`;
        if (config.value >= 60) return `${(config.value / 60).toFixed(0)} min`;
        return `${config.value} sec`;
      case 'json':
        return JSON.stringify(config.value);
      default:
        return `${config.value}${config.unit ? ` ${config.unit}` : ''}`;
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          <Settings sx={{ mr: 1, verticalAlign: 'middle' }} />
          {t('admin.configuration.title')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => loadConfigs(activeCategory)}
        >
          {t('admin.buttons.refresh')}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Category Tabs (Vertical) */}
        <Paper sx={{ minWidth: 250 }}>
          <Tabs
            orientation="vertical"
            value={activeCategory}
            onChange={(_, v) => setActiveCategory(v)}
            sx={{ borderRight: 1, borderColor: 'divider' }}
          >
            {categories.map((cat) => (
              <Tab
                key={cat.id}
                value={cat.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {CATEGORY_ICONS[cat.id]}
                    <span>{cat.name}</span>
                  </Box>
                }
                sx={{ justifyContent: 'flex-start' }}
              />
            ))}
          </Tabs>
        </Paper>

        {/* Configuration Table */}
        <Box sx={{ flex: 1 }}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.configuration.parameter')}</TableCell>
                  <TableCell>{t('admin.configuration.value')}</TableCell>
                  <TableCell>{t('admin.configuration.status')}</TableCell>
                  <TableCell align="right">{t('admin.configuration.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {configs.map((config) => (
                  <React.Fragment key={config.key}>
                    <TableRow hover>
                      <TableCell>
                        <Box>
                          <Typography fontWeight="medium">
                            {config.displayName}
                            {config.requiresRestart && (
                              <Tooltip title="Requires restart">
                                <Warning fontSize="small" color="warning" sx={{ ml: 1 }} />
                              </Tooltip>
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {config.key}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography fontFamily="monospace">
                          {formatValue(config)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {config.isOverride ? (
                          <Chip size="small" color="info" label="Override" />
                        ) : (
                          <Chip size="small" color="default" label="Default" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={t('admin.buttons.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditDialog(config);
                              setEditValue(config.value);
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('admin.configuration.history')}>
                          <IconButton
                            size="small"
                            onClick={() => loadAuditLog(config.key)}
                          >
                            <History fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const newSet = new Set(expandedKeys);
                            if (newSet.has(config.key)) {
                              newSet.delete(config.key);
                            } else {
                              newSet.add(config.key);
                            }
                            setExpandedKeys(newSet);
                          }}
                        >
                          {expandedKeys.has(config.key) ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4} sx={{ py: 0 }}>
                        <Collapse in={expandedKeys.has(config.key)}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                            <Typography variant="body2" color="text.secondary">
                              {config.description}
                            </Typography>
                            {config.minValue !== null && (
                              <Typography variant="caption" display="block">
                                Min: {config.minValue} | Max: {config.maxValue}
                              </Typography>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('admin.configuration.edit_parameter')}
        </DialogTitle>
        <DialogContent>
          {editDialog && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {editDialog.displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {editDialog.description}
              </Typography>
              <Box sx={{ mt: 3 }}>
                {renderValueEditor(editDialog)}
              </Box>
              {editDialog.requiresRestart && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {t('admin.configuration.requires_restart_warning')}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)}>
            {t('admin.buttons.cancel')}
          </Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            {t('admin.buttons.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyDialog} onClose={() => setHistoryDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {t('admin.configuration.change_history')}: {historyDialog}
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.configuration.date')}</TableCell>
                  <TableCell>{t('admin.configuration.action')}</TableCell>
                  <TableCell>{t('admin.configuration.old_value')}</TableCell>
                  <TableCell>{t('admin.configuration.new_value')}</TableCell>
                  <TableCell>{t('admin.configuration.changed_by')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={entry.action} />
                    </TableCell>
                    <TableCell>
                      <code>{JSON.stringify(entry.oldValue?.value)}</code>
                    </TableCell>
                    <TableCell>
                      <code>{JSON.stringify(entry.newValue?.value)}</code>
                    </TableCell>
                    <TableCell>{entry.changedByEmail || 'System'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog(null)}>
            {t('admin.buttons.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

---

## 42.7 API LAMBDA

### File: `lambda/configuration/api.ts`

```typescript
// ============================================================================
// RADIANT v4.8.0 - Configuration API Lambda
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { extractAuthContext, requireRoles } from '../shared/auth';
import { ConfigurationService } from '@radiant/shared/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const configService = new ConfigurationService(pool);

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const { httpMethod, path, pathParameters, body } = event;
  
  try {
    const auth = extractAuthContext(event);
    requireRoles(auth, ['admin', 'super_admin']);

    // GET /configuration/categories
    if (httpMethod === 'GET' && path === '/configuration/categories') {
      return await getCategories();
    }

    // GET /configuration/category/:id
    if (httpMethod === 'GET' && path.match(/\/configuration\/category\/[a-z_]+$/)) {
      return await getByCategory(pathParameters?.id!, auth.tenantId);
    }

    // GET /configuration/:key
    if (httpMethod === 'GET' && path.match(/\/configuration\/[a-z_.]+$/)) {
      return await getConfig(pathParameters?.key!, auth.tenantId);
    }

    // PUT /configuration/:key
    if (httpMethod === 'PUT' && path.match(/\/configuration\/[a-z_.]+$/)) {
      requireRoles(auth, ['super_admin']);
      return await updateConfig(pathParameters?.key!, JSON.parse(body || '{}'), auth.userId);
    }

    // GET /configuration/:key/audit
    if (httpMethod === 'GET' && path.match(/\/configuration\/[a-z_.]+\/audit$/)) {
      return await getAuditLog(pathParameters?.key!, auth.tenantId);
    }

    // POST /configuration/:key/tenant-override
    if (httpMethod === 'POST' && path.match(/\/configuration\/[a-z_.]+\/tenant-override$/)) {
      requireRoles(auth, ['super_admin']);
      const { tenantId, ...rest } = JSON.parse(body || '{}');
      return await createTenantOverride(pathParameters?.key!, tenantId, rest, auth.userId);
    }

    // DELETE /configuration/:key/tenant-override/:tenantId
    if (httpMethod === 'DELETE' && path.match(/\/configuration\/[a-z_.]+\/tenant-override\/[a-f0-9-]+$/)) {
      requireRoles(auth, ['super_admin']);
      return await deleteTenantOverride(pathParameters?.key!, pathParameters?.tenantId!);
    }

    // POST /configuration/export
    if (httpMethod === 'POST' && path === '/configuration/export') {
      return await exportConfigs(auth.tenantId);
    }

    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    console.error('Configuration API error:', error);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function getCategories(): Promise<APIGatewayProxyResult> {
  const result = await pool.query(`
    SELECT id, name, description, display_order, icon
    FROM configuration_categories
    ORDER BY display_order
  `);

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows),
  };
}

async function getByCategory(categoryId: string, tenantId: string): Promise<APIGatewayProxyResult> {
  const configs = await configService.getByCategory(categoryId, tenantId);
  
  return {
    statusCode: 200,
    body: JSON.stringify(configs),
  };
}

async function getConfig(key: string, tenantId: string): Promise<APIGatewayProxyResult> {
  const value = await configService.get(key, tenantId);
  
  return {
    statusCode: 200,
    body: JSON.stringify({ key, value }),
  };
}

async function updateConfig(key: string, data: any, userId: string): Promise<APIGatewayProxyResult> {
  const config = await configService.update(key, data, userId);
  
  return {
    statusCode: 200,
    body: JSON.stringify(config),
  };
}

async function getAuditLog(key: string, tenantId: string): Promise<APIGatewayProxyResult> {
  const log = await configService.getAuditLog(key, { tenantId, limit: 100 });
  
  return {
    statusCode: 200,
    body: JSON.stringify(log),
  };
}

async function createTenantOverride(
  key: string, 
  tenantId: string, 
  data: any, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const override = await configService.createTenantOverride(key, tenantId, data, userId);
  
  return {
    statusCode: 201,
    body: JSON.stringify(override),
  };
}

async function deleteTenantOverride(key: string, tenantId: string): Promise<APIGatewayProxyResult> {
  await configService.deleteTenantOverride(key, tenantId);
  
  return {
    statusCode: 204,
    body: '',
  };
}

async function exportConfigs(tenantId: string): Promise<APIGatewayProxyResult> {
  const exportData = await configService.exportConfigs(tenantId);
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="radiant-config-${new Date().toISOString().split('T')[0]}.json"`,
    },
    body: JSON.stringify(exportData, null, 2),
  };
}
```

---

## 42.8 USAGE EXAMPLE - UPDATING CODE TO USE CONFIGURABLE VALUES

### Before (Hardcoded):

```typescript
// OLD CODE - Hardcoded values
const DEFAULT_MARGIN = 0.40;
const MAX_RETRY_ATTEMPTS = 3;
const SESSION_TIMEOUT = 1800;

async function calculateCost(providerCost: number): Promise<number> {
  return providerCost * (1 + DEFAULT_MARGIN);  // â† HARDCODED!
}

async function retryRequest(fn: () => Promise<any>): Promise<any> {
  for (let i = 0; i < MAX_RETRY_ATTEMPTS; i++) {  // â† HARDCODED!
    try {
      return await fn();
    } catch (error) {
      if (i === MAX_RETRY_ATTEMPTS - 1) throw error;
      await sleep(1000 * Math.pow(2, i));
    }
  }
}
```

### After (Database-Driven):

```typescript
// NEW CODE - Database-driven with ConfigurationService
import { getConfig, CONFIG_KEYS } from '@radiant/shared/config';

async function calculateCost(providerCost: number, tenantId: string): Promise<number> {
  const margin = await getConfig<number>(
    CONFIG_KEYS.EXTERNAL_PROVIDER_MARGIN, 
    tenantId
  );
  return providerCost * (1 + margin);  // âœ“ CONFIGURABLE!
}

async function retryRequest(fn: () => Promise<any>, tenantId: string): Promise<any> {
  const [maxAttempts, initialDelay, backoffMultiplier] = await Promise.all([
    getConfig<number>(CONFIG_KEYS.MAX_RETRY_ATTEMPTS, tenantId),
    getConfig<number>(CONFIG_KEYS.INITIAL_RETRY_DELAY, tenantId),
    getConfig<number>(CONFIG_KEYS.BACKOFF_MULTIPLIER, tenantId),
  ]);
  
  for (let i = 0; i < maxAttempts; i++) {  // âœ“ CONFIGURABLE!
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await sleep(initialDelay * Math.pow(backoffMultiplier, i));
    }
  }
}
```

---

## 42.9 LOCALIZATION STRINGS FOR CONFIGURATION UI

### Add to migration 041b_seed_localization.sql:

```sql
-- Configuration Management Strings
INSERT INTO localization_registry (key, default_text, category, context, source_app) VALUES
('admin.configuration.title', 'Configuration Management', 'features.admin', 'Page title', 'admin'),
('admin.configuration.parameter', 'Parameter', 'features.admin', 'Table header', 'admin'),
('admin.configuration.value', 'Value', 'features.admin', 'Table header', 'admin'),
('admin.configuration.status', 'Status', 'features.admin', 'Table header', 'admin'),
('admin.configuration.actions', 'Actions', 'features.admin', 'Table header', 'admin'),
('admin.configuration.history', 'History', 'features.admin', 'Button tooltip', 'admin'),
('admin.configuration.edit_parameter', 'Edit Parameter', 'features.admin', 'Dialog title', 'admin'),
('admin.configuration.change_history', 'Change History', 'features.admin', 'Dialog title', 'admin'),
('admin.configuration.date', 'Date', 'features.admin', 'Table header', 'admin'),
('admin.configuration.action', 'Action', 'features.admin', 'Table header', 'admin'),
('admin.configuration.old_value', 'Old Value', 'features.admin', 'Table header', 'admin'),
('admin.configuration.new_value', 'New Value', 'features.admin', 'Table header', 'admin'),
('admin.configuration.changed_by', 'Changed By', 'features.admin', 'Table header', 'admin'),
('admin.configuration.requires_restart_warning', 'This change requires a service restart to take effect.', 'features.admin', 'Warning message', 'admin');
```

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# IMPLEMENTATION VERIFICATION CHECKLIST
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## Complete v4.8.0 Verification

### Section 42: Dynamic Configuration Management System

- [ ] Migration 042_configuration_management.sql applied successfully
- [ ] Migration 042b_seed_configuration.sql applied with all parameters
- [ ] configuration_categories table created with 12 categories
- [ ] system_configuration table created with type validation
- [ ] tenant_configuration_overrides table created with RLS
- [ ] configuration_audit_log table created
- [ ] configuration_cache_invalidation table created
- [ ] get_config() function working with tenant override support
- [ ] get_configs_by_category() function returning configs
- [ ] Audit log triggers capturing all changes
- [ ] Cache invalidation triggers working
- [ ] ConfigurationService TypeScript class implemented
- [ ] getConfig() helper function working with caching
- [ ] Redis caching layer integrated
- [ ] Configuration API Lambda deployed
- [ ] Admin /configuration page accessible
- [ ] Category tabs displaying all 12 categories
- [ ] Edit dialog with type-appropriate editors
- [ ] History dialog showing audit log
- [ ] Tenant override creation working
- [ ] Configuration export/import working
- [ ] All hardcoded values replaced with getConfig() calls
- [ ] Localization strings added for configuration UI

### Section 41: Complete Internationalization System (from v4.7.0)

- [ ] All previous v4.7.0 checklist items verified

### Section 40: Application-Level Data Isolation (from v4.6.0)

- [ ] All previous v4.6.0 checklist items verified

### Integration Verification

- [ ] All Lambda functions using ConfigurationService
- [ ] No hardcoded rate limits remaining
- [ ] No hardcoded timeouts remaining
- [ ] No hardcoded pricing margins remaining
- [ ] No hardcoded token limits remaining
- [ ] No hardcoded retry configurations remaining
- [ ] Configuration changes propagate without deployment
- [ ] Per-tenant overrides working correctly
- [ ] Audit trail complete for all changes

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 43: BILLING & CREDITS SYSTEM (v4.13.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **Version: 4.13.0 | Adds 7-tier subscriptions and prepaid credits system**

---

## 43.1 BILLING SYSTEM OVERVIEW

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     RADIANT v4.13.0 - BILLING SYSTEM                            â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                                  â”‚
â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                   â”‚
â”‚   â”‚     7-TIER SUBSCRIPTION MODEL           â”‚                                   â”‚
â”‚   â”‚     (Similar to OpenAI/ChatGPT)         â”‚                                   â”‚
â”‚   â”‚                                          â”‚                                   â”‚
â”‚   â”‚  â€¢ FREE - Trial ($0, 0.5 credits)       â”‚                                   â”‚
â”‚   â”‚  â€¢ INDIVIDUAL - Personal ($29/mo)       â”‚                                   â”‚
â”‚   â”‚  â€¢ FAMILY - Household ($49/mo, 5 users) â”‚                                   â”‚
â”‚   â”‚  â€¢ TEAM - Small biz ($25/user, 2-25)    â”‚                                   â”‚
â”‚   â”‚  â€¢ BUSINESS - Mid-market ($45/user)     â”‚                                   â”‚
â”‚   â”‚  â€¢ ENTERPRISE - Large orgs (Custom)     â”‚                                   â”‚
â”‚   â”‚  â€¢ ENTERPRISE PLUS - Compliance incl.   â”‚                                   â”‚
â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                   â”‚
â”‚                                                                                  â”‚
â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                   â”‚
â”‚   â”‚     PREPAID CREDITS SYSTEM              â”‚                                   â”‚
â”‚   â”‚     (Similar to Windsurf Pro)           â”‚                                   â”‚
â”‚   â”‚                                          â”‚                                   â”‚
â”‚   â”‚  â€¢ $10 = 1 Credit (any quantity)        â”‚                                   â”‚
â”‚   â”‚  â€¢ Volume discounts (5% to 25% off)     â”‚                                   â”‚
â”‚   â”‚  â€¢ Bonus credits for bulk purchases     â”‚                                   â”‚
â”‚   â”‚  â€¢ Credit pools for families/teams      â”‚                                   â”‚
â”‚   â”‚  â€¢ Auto-purchase when balance low       â”‚                                   â”‚
â”‚   â”‚  â€¢ Credits never expire                 â”‚                                   â”‚
â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                   â”‚
â”‚                                                                                  â”‚
â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                   â”‚
â”‚   â”‚     COMPLIANCE ADD-ON ($25/user/mo)     â”‚                                   â”‚
â”‚   â”‚     Available for TEAM+ tiers           â”‚                                   â”‚
â”‚   â”‚                                          â”‚                                   â”‚
â”‚   â”‚  â€¢ HIPAA + BAA                          â”‚                                   â”‚
â”‚   â”‚  â€¢ SOC 2 Type II                        â”‚                                   â”‚
â”‚   â”‚  â€¢ GDPR/CCPA compliance                 â”‚                                   â”‚
â”‚   â”‚  â€¢ Customer-managed encryption keys     â”‚                                   â”‚
â”‚   â”‚  â€¢ Enhanced audit logging               â”‚                                   â”‚
â”‚   â”‚  â€¢ Data residency options               â”‚                                   â”‚
â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                   â”‚
â”‚                                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 43.2 SUBSCRIPTION TIERS

### packages/shared/src/billing/tiers.ts

```typescript
/**
 * RADIANT Subscription Tiers
 * 7-tier model from FREE to ENTERPRISE PLUS
 * 
 * @version 4.13.0
 * @module @radiant/shared/billing
 */

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

export type SubscriptionTierId = 
  | 'FREE'
  | 'INDIVIDUAL'
  | 'FAMILY'
  | 'TEAM'
  | 'BUSINESS'
  | 'ENTERPRISE'
  | 'ENTERPRISE_PLUS';

export interface SubscriptionTier {
  id: SubscriptionTierId;
  displayName: string;  // Fallback - use localizationKey at runtime
  description: string;  // Fallback - use localizationKey at runtime
  localizationKey: string;  // e.g., 'billing.tiers.free' for i18n lookup
  
  // Pricing
  pricing: {
    monthly: number | null;           // null = contact sales
    annual: number | null;
    perUser: boolean;
    minUsers?: number;
    maxUsers?: number;
    currency: string;
    contactSales?: boolean;
  };
  
  // Credits
  includedCreditsPerUser: number;     // Monthly credits per user/seat
  
  // Rate limits
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    concurrentRequests: number;
  };
  
  // Features
  features: TierFeatures;
  
  // Add-ons available
  availableAddOns: string[];
  
  // Display
  isPublic: boolean;
  sortOrder: number;
  badge?: string;
}

export interface TierFeatures {
  modelAccess: 'limited' | 'full' | 'full_plus_beta' | 'all';
  maxModelsPerMonth: number | null;
  maxRequestsPerDay: number | null;
  maxTokensPerRequest: number;
  priorityQueue: boolean;
  apiAccess: boolean;
  exportFormats: string[];
  supportLevel: 'community' | 'email' | 'priority_email' | 'priority' | 'dedicated';
  dataRetention: string;
  watermarkedOutputs: boolean;
  conversationHistory: boolean;
  customInstructions: boolean;
  
  // Sharing features
  sharedCreditPool: boolean;
  teamWorkspaces: boolean;
  sharedConversations: boolean;
  
  // Admin features
  teamAdminDashboard: boolean;
  usageAnalytics: boolean;
  roleBasedAccess: boolean;
  inviteManagement: boolean;
  
  // Enterprise features
  ssoIntegration: boolean;
  scimProvisioning: boolean;
  auditLogs: boolean;
  dataExport: boolean;
  customBranding: boolean;
  dedicatedAccountManager: boolean;
  apiRateLimitCustomization: boolean;
  webhooks: boolean;
  ipWhitelisting: boolean;
  
  // Family features
  parentalControls?: boolean;
  familyAdminDashboard?: boolean;
  perMemberUsageLimits?: boolean;
  
  // Enterprise Plus features
  slaGuarantee?: boolean;
  uptimeGuarantee?: string;
  customModelFineTuning?: boolean;
  dedicatedInfrastructure?: boolean;
  multiRegionDeployment?: boolean;
  onPremiseDeployment?: boolean;
}

// ============================================================================
// TIER REGISTRY
// ============================================================================

export const SUBSCRIPTION_TIERS: Record<SubscriptionTierId, SubscriptionTier> = {
  FREE: {
    id: 'FREE',
    displayName: 'Free Trial',  // Fallback
    description: 'Try RADIANT with limited features',  // Fallback
    localizationKey: 'billing.tiers.free',
    pricing: { monthly: 0, annual: 0, perUser: false, currency: 'USD' },
    includedCreditsPerUser: 0.5,
    rateLimits: { requestsPerMinute: 10, tokensPerMinute: 20_000, concurrentRequests: 1 },
    features: {
      modelAccess: 'limited', maxModelsPerMonth: 5, maxRequestsPerDay: 50,
      maxTokensPerRequest: 4_000, priorityQueue: false, apiAccess: false,
      exportFormats: ['txt'], supportLevel: 'community', dataRetention: '7_days',
      watermarkedOutputs: true, conversationHistory: false, customInstructions: false,
      sharedCreditPool: false, teamWorkspaces: false, sharedConversations: false,
      teamAdminDashboard: false, usageAnalytics: false, roleBasedAccess: false,
      inviteManagement: false, ssoIntegration: false, scimProvisioning: false,
      auditLogs: false, dataExport: false, customBranding: false,
      dedicatedAccountManager: false, apiRateLimitCustomization: false,
      webhooks: false, ipWhitelisting: false,
    },
    availableAddOns: [],
    isPublic: true,
    sortOrder: 0,
  },
  
  INDIVIDUAL: {
    id: 'INDIVIDUAL',
    displayName: 'Individual',  // Fallback
    description: 'Full-featured personal plan',  // Fallback
    localizationKey: 'billing.tiers.individual',
    pricing: { monthly: 29, annual: 290, perUser: false, currency: 'USD' },
    includedCreditsPerUser: 3,
    rateLimits: { requestsPerMinute: 60, tokensPerMinute: 100_000, concurrentRequests: 5 },
    features: {
      modelAccess: 'full', maxModelsPerMonth: null, maxRequestsPerDay: 1_000,
      maxTokensPerRequest: 128_000, priorityQueue: true, apiAccess: true,
      exportFormats: ['txt', 'md', 'pdf', 'docx'], supportLevel: 'email',
      dataRetention: '90_days', watermarkedOutputs: false, conversationHistory: true,
      customInstructions: true, sharedCreditPool: false, teamWorkspaces: false,
      sharedConversations: false, teamAdminDashboard: false, usageAnalytics: false,
      roleBasedAccess: false, inviteManagement: false, ssoIntegration: false,
      scimProvisioning: false, auditLogs: false, dataExport: false,
      customBranding: false, dedicatedAccountManager: false,
      apiRateLimitCustomization: false, webhooks: false, ipWhitelisting: false,
    },
    availableAddOns: ['API_POWER_PACK'],
    isPublic: true,
    sortOrder: 1,
  },
  
  FAMILY: {
    id: 'FAMILY',
    displayName: 'Family',  // Fallback
    description: 'Share AI across your household',  // Fallback
    localizationKey: 'billing.tiers.family',
    id: 'FAMILY',
    displayName: 'Family',
    description: 'Share AI across your household',
    pricing: { monthly: 49, annual: 490, perUser: false, maxUsers: 5, currency: 'USD' },
    includedCreditsPerUser: 6,
    rateLimits: { requestsPerMinute: 120, tokensPerMinute: 200_000, concurrentRequests: 10 },
    features: {
      modelAccess: 'full', maxModelsPerMonth: null, maxRequestsPerDay: 2_000,
      maxTokensPerRequest: 128_000, priorityQueue: true, apiAccess: true,
      exportFormats: ['txt', 'md', 'pdf', 'docx'], supportLevel: 'email',
      dataRetention: '90_days', watermarkedOutputs: false, conversationHistory: true,
      customInstructions: true, sharedCreditPool: true, teamWorkspaces: false,
      sharedConversations: false, teamAdminDashboard: false, usageAnalytics: false,
      roleBasedAccess: false, inviteManagement: true, ssoIntegration: false,
      scimProvisioning: false, auditLogs: false, dataExport: false,
      customBranding: false, dedicatedAccountManager: false,
      apiRateLimitCustomization: false, webhooks: false, ipWhitelisting: false,
      parentalControls: true, familyAdminDashboard: true, perMemberUsageLimits: true,
    },
    availableAddOns: ['API_POWER_PACK'],
    isPublic: true,
    sortOrder: 2,
  },
  
  TEAM: {
    id: 'TEAM',
    displayName: 'Team',
    description: 'Collaborate with your small team',
    pricing: { monthly: 25, annual: 250, perUser: true, minUsers: 2, maxUsers: 25, currency: 'USD' },
    includedCreditsPerUser: 3,
    rateLimits: { requestsPerMinute: 300, tokensPerMinute: 500_000, concurrentRequests: 20 },
    features: {
      modelAccess: 'full', maxModelsPerMonth: null, maxRequestsPerDay: null,
      maxTokensPerRequest: 200_000, priorityQueue: true, apiAccess: true,
      exportFormats: ['txt', 'md', 'pdf', 'docx', 'html'], supportLevel: 'priority_email',
      dataRetention: '1_year', watermarkedOutputs: false, conversationHistory: true,
      customInstructions: true, sharedCreditPool: true, teamWorkspaces: true,
      sharedConversations: true, teamAdminDashboard: true, usageAnalytics: true,
      roleBasedAccess: true, inviteManagement: true, ssoIntegration: false,
      scimProvisioning: false, auditLogs: false, dataExport: false,
      customBranding: false, dedicatedAccountManager: false,
      apiRateLimitCustomization: false, webhooks: false, ipWhitelisting: false,
    },
    availableAddOns: ['COMPLIANCE_ADDON', 'PRIORITY_SUPPORT'],
    isPublic: true,
    sortOrder: 3,
    badge: 'Most Popular',
  },
  
  BUSINESS: {
    id: 'BUSINESS',
    displayName: 'Business',
    description: 'Enterprise features for growing companies',
    pricing: { monthly: 45, annual: 450, perUser: true, minUsers: 5, maxUsers: 150, currency: 'USD' },
    includedCreditsPerUser: 5,
    rateLimits: { requestsPerMinute: 1_000, tokensPerMinute: 2_000_000, concurrentRequests: 50 },
    features: {
      modelAccess: 'full_plus_beta', maxModelsPerMonth: null, maxRequestsPerDay: null,
      maxTokensPerRequest: 500_000, priorityQueue: true, apiAccess: true,
      exportFormats: ['txt', 'md', 'pdf', 'docx', 'html', 'json'], supportLevel: 'priority',
      dataRetention: '2_years', watermarkedOutputs: false, conversationHistory: true,
      customInstructions: true, sharedCreditPool: true, teamWorkspaces: true,
      sharedConversations: true, teamAdminDashboard: true, usageAnalytics: true,
      roleBasedAccess: true, inviteManagement: true, ssoIntegration: true,
      scimProvisioning: true, auditLogs: true, dataExport: true,
      customBranding: true, dedicatedAccountManager: false,
      apiRateLimitCustomization: true, webhooks: true, ipWhitelisting: true,
    },
    availableAddOns: ['COMPLIANCE_ADDON', 'PRIORITY_SUPPORT'],
    isPublic: true,
    sortOrder: 4,
  },
  
  ENTERPRISE: {
    id: 'ENTERPRISE',
    displayName: 'Enterprise',
    description: 'Full-scale enterprise deployment',
    pricing: { monthly: null, annual: null, perUser: true, minUsers: 50, currency: 'USD', contactSales: true },
    includedCreditsPerUser: 10,
    rateLimits: { requestsPerMinute: 5_000, tokensPerMinute: 10_000_000, concurrentRequests: 200 },
    features: {
      modelAccess: 'all', maxModelsPerMonth: null, maxRequestsPerDay: null,
      maxTokensPerRequest: 1_000_000, priorityQueue: true, apiAccess: true,
      exportFormats: ['txt', 'md', 'pdf', 'docx', 'html', 'json', 'csv'],
      supportLevel: 'dedicated', dataRetention: 'custom', watermarkedOutputs: false,
      conversationHistory: true, customInstructions: true, sharedCreditPool: true,
      teamWorkspaces: true, sharedConversations: true, teamAdminDashboard: true,
      usageAnalytics: true, roleBasedAccess: true, inviteManagement: true,
      ssoIntegration: true, scimProvisioning: true, auditLogs: true, dataExport: true,
      customBranding: true, dedicatedAccountManager: true,
      apiRateLimitCustomization: true, webhooks: true, ipWhitelisting: true,
      slaGuarantee: true, uptimeGuarantee: '99.9%', customModelFineTuning: true,
      multiRegionDeployment: true,
    },
    availableAddOns: ['COMPLIANCE_ADDON'],
    isPublic: true,
    sortOrder: 5,
  },
  
  ENTERPRISE_PLUS: {
    id: 'ENTERPRISE_PLUS',
    displayName: 'Enterprise Plus',
    description: 'Maximum security and compliance for regulated industries',
    pricing: { monthly: null, annual: null, perUser: true, minUsers: 100, currency: 'USD', contactSales: true },
    includedCreditsPerUser: 15,
    rateLimits: { requestsPerMinute: 20_000, tokensPerMinute: 50_000_000, concurrentRequests: -1 },
    features: {
      modelAccess: 'all', maxModelsPerMonth: null, maxRequestsPerDay: null,
      maxTokensPerRequest: 2_000_000, priorityQueue: true, apiAccess: true,
      exportFormats: ['txt', 'md', 'pdf', 'docx', 'html', 'json', 'csv', 'xml'],
      supportLevel: 'dedicated', dataRetention: 'custom', watermarkedOutputs: false,
      conversationHistory: true, customInstructions: true, sharedCreditPool: true,
      teamWorkspaces: true, sharedConversations: true, teamAdminDashboard: true,
      usageAnalytics: true, roleBasedAccess: true, inviteManagement: true,
      ssoIntegration: true, scimProvisioning: true, auditLogs: true, dataExport: true,
      customBranding: true, dedicatedAccountManager: true,
      apiRateLimitCustomization: true, webhooks: true, ipWhitelisting: true,
      slaGuarantee: true, uptimeGuarantee: '99.99%', customModelFineTuning: true,
      dedicatedInfrastructure: true, multiRegionDeployment: true, onPremiseDeployment: true,
    },
    availableAddOns: [], // Compliance included
    isPublic: true,
    sortOrder: 6,
    badge: 'Full Compliance Included',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTier(tierId: SubscriptionTierId): SubscriptionTier {
  return SUBSCRIPTION_TIERS[tierId];
}

export function canUpgrade(fromTier: SubscriptionTierId, toTier: SubscriptionTierId): boolean {
  return SUBSCRIPTION_TIERS[toTier].sortOrder > SUBSCRIPTION_TIERS[fromTier].sortOrder;
}

export function getAnnualSavings(tier: SubscriptionTier): number {
  if (!tier.pricing.monthly || !tier.pricing.annual) return 0;
  return (tier.pricing.monthly * 12) - tier.pricing.annual;
}
```

---

## 43.3 CREDITS SYSTEM

### packages/shared/src/billing/credits.ts

```typescript
/**
 * RADIANT Credits System
 * Prepaid AI usage currency
 * 
 * @version 4.13.0
 * @module @radiant/shared/billing
 */

// ============================================================================
// CREDIT TYPES
// ============================================================================

export interface CreditPool {
  id: string;
  type: CreditPoolType;
  ownerId: string;
  organizationId?: string;
  tenantId: string;
  
  balance: {
    available: number;
    reserved: number;
    total: number;
  };
  
  monthlyIncluded: {
    total: number;
    used: number;
    remaining: number;
    resetsAt: string;
  };
  
  purchased: {
    total: number;
    remaining: number;
    lastPurchaseAt?: string;
  };
  
  bonus: {
    total: number;
    remaining: number;
  };
  
  members: CreditPoolMember[];
  settings: CreditPoolSettings;
  
  createdAt: string;
  updatedAt: string;
}

export type CreditPoolType = 'individual' | 'family' | 'team' | 'organization' | 'enterprise';

export interface CreditPoolMember {
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | 'restricted';
  
  limits?: {
    dailyCredits?: number;
    monthlyCredits?: number;
    maxCostPerRequest?: number;
  };
  
  permissions: CreditPoolPermissions;
  status: 'active' | 'invited' | 'suspended';
  joinedAt: string;
  lastActiveAt?: string;
  
  usage: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
  };
}

export interface CreditPoolPermissions {
  canPurchaseCredits: boolean;
  canViewPoolBalance: boolean;
  canViewOtherUsage: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canModifySettings: boolean;
}

export interface CreditPoolSettings {
  autoPurchase: {
    enabled: boolean;
    thresholdCredits: number;
    purchaseAmount: number;
    maxMonthlyAutoPurchase?: number;
    paymentMethodId?: string;
  };
  
  notifications: {
    lowBalanceThreshold: number;
    lowBalanceRecipients: string[];
    usageSummaryFrequency: 'daily' | 'weekly' | 'monthly';
    unusualUsageAlerts: boolean;
  };
  
  accessControl: {
    requireApprovalAbove?: number;
    blockedModels?: string[];
    allowedModels?: string[];
  };
  
  familySettings?: {
    parentalControlsEnabled: boolean;
    contentFiltering: 'strict' | 'moderate' | 'off';
    underageMembers: string[];
  };
}

// ============================================================================
// CREDIT TRANSACTIONS
// ============================================================================

export type CreditTransactionType = 
  | 'purchase' | 'subscription_grant' | 'bonus_grant' | 'consumption'
  | 'refund' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'expiration';

export interface CreditTransaction {
  id: string;
  poolId: string;
  userId?: string;
  transactionType: CreditTransactionType;
  
  amount: number;
  balanceAfter: number;
  
  sourceType?: 'included' | 'purchased' | 'bonus';
  sourceId?: string;
  
  modelId?: string;
  requestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  
  paymentIntentId?: string;
  paymentAmountCents?: number;
  paymentCurrency?: string;
  
  description?: string;
  metadata?: Record<string, any>;
  
  createdAt: string;
}

// ============================================================================
// CREDIT PRICING
// ============================================================================

export const CREDIT_PRICING = {
  basePrice: 10.00, // $10 = 1 Credit
  
  volumeDiscounts: [
    { minCredits: 1, discount: 0, bonus: 0 },
    { minCredits: 5, discount: 0, bonus: 0 },
    { minCredits: 10, discount: 0.05, bonus: 0.05 },   // 5% off, 5% bonus
    { minCredits: 25, discount: 0.10, bonus: 0.10 },   // 10% off, 10% bonus
    { minCredits: 50, discount: 0.15, bonus: 0.15 },   // 15% off, 15% bonus
    { minCredits: 100, discount: 0.20, bonus: 0.20 },  // 20% off, 20% bonus
  ],
  
  consumption: {
    text: {
      inputTokensPer1Credit: 1_000_000,
      outputTokensPer1Credit: 250_000,
    },
    image: {
      standardGenerationCredits: 0.02,
      hdGenerationCredits: 0.04,
    },
    audio: {
      transcriptionMinuteCredits: 0.01,
      ttsCharacterCredits: 0.00001,
    },
  },
};

export function calculatePurchasePrice(credits: number): {
  basePrice: number;
  discount: number;
  bonusCredits: number;
  finalPrice: number;
  totalCredits: number;
} {
  const tier = [...CREDIT_PRICING.volumeDiscounts]
    .reverse()
    .find(t => credits >= t.minCredits) || CREDIT_PRICING.volumeDiscounts[0];
  
  const basePrice = credits * CREDIT_PRICING.basePrice;
  const discount = basePrice * tier.discount;
  const bonusCredits = credits * tier.bonus;
  
  return {
    basePrice,
    discount,
    bonusCredits,
    finalPrice: basePrice - discount,
    totalCredits: credits + bonusCredits,
  };
}
```

---

## 43.4 DATABASE SCHEMA

### packages/infrastructure/migrations/043_billing_system.sql

```sql
-- ============================================================================
-- RADIANT v4.13.0 - Billing & Credits Schema
-- Migration: 043_billing_system.sql
-- ============================================================================

-- Subscription Tiers
CREATE TABLE subscription_tiers (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    price_monthly DECIMAL(10,2),
    price_annual DECIMAL(10,2),
    price_per_user BOOLEAN DEFAULT FALSE,
    min_users INTEGER DEFAULT 1,
    max_users INTEGER,
    currency VARCHAR(3) DEFAULT 'USD',
    
    included_credits_per_user DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    requests_per_minute INTEGER NOT NULL,
    tokens_per_minute BIGINT NOT NULL,
    concurrent_requests INTEGER NOT NULL,
    
    features JSONB NOT NULL DEFAULT '{}',
    available_add_ons TEXT[] DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    badge VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Add-Ons
CREATE TABLE subscription_add_ons (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    price_monthly_cents INTEGER NOT NULL,
    price_annual_cents INTEGER,
    price_per_user BOOLEAN DEFAULT FALSE,
    
    available_for_tiers TEXT[] NOT NULL,
    included_in_tiers TEXT[] DEFAULT '{}',
    
    features JSONB NOT NULL DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Pools
CREATE TABLE credit_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_type VARCHAR(20) NOT NULL CHECK (pool_type IN ('individual', 'family', 'team', 'organization', 'enterprise')),
    owner_user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    balance_available DECIMAL(12,4) NOT NULL DEFAULT 0,
    balance_reserved DECIMAL(12,4) NOT NULL DEFAULT 0,
    
    monthly_included_total DECIMAL(12,4) NOT NULL DEFAULT 0,
    monthly_included_used DECIMAL(12,4) NOT NULL DEFAULT 0,
    monthly_resets_at TIMESTAMPTZ,
    
    purchased_total DECIMAL(12,4) NOT NULL DEFAULT 0,
    purchased_remaining DECIMAL(12,4) NOT NULL DEFAULT 0,
    last_purchase_at TIMESTAMPTZ,
    
    bonus_total DECIMAL(12,4) NOT NULL DEFAULT 0,
    bonus_remaining DECIMAL(12,4) NOT NULL DEFAULT 0,
    
    settings JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_pools_owner ON credit_pools(owner_user_id);
CREATE INDEX idx_credit_pools_org ON credit_pools(organization_id);
CREATE INDEX idx_credit_pools_tenant ON credit_pools(tenant_id);

-- Credit Pool Members
CREATE TABLE credit_pool_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES credit_pools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'restricted')),
    permissions JSONB NOT NULL DEFAULT '{}',
    
    daily_credit_limit DECIMAL(10,4),
    monthly_credit_limit DECIMAL(10,4),
    max_cost_per_request DECIMAL(10,4),
    
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspended_reason TEXT,
    
    usage_today DECIMAL(12,4) NOT NULL DEFAULT 0,
    usage_this_week DECIMAL(12,4) NOT NULL DEFAULT 0,
    usage_this_month DECIMAL(12,4) NOT NULL DEFAULT 0,
    usage_all_time DECIMAL(12,4) NOT NULL DEFAULT 0,
    last_usage_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(pool_id, user_id)
);

CREATE INDEX idx_pool_members_user ON credit_pool_members(user_id);
CREATE INDEX idx_pool_members_pool ON credit_pool_members(pool_id);

-- Credit Transactions
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES credit_pools(id),
    user_id UUID REFERENCES users(id),
    
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'purchase', 'subscription_grant', 'bonus_grant', 'consumption',
        'refund', 'adjustment', 'transfer_in', 'transfer_out', 'expiration'
    )),
    
    amount DECIMAL(12,4) NOT NULL,
    balance_after DECIMAL(12,4) NOT NULL,
    
    source_type VARCHAR(30),
    source_id VARCHAR(100),
    
    model_id VARCHAR(100),
    request_id UUID,
    input_tokens INTEGER,
    output_tokens INTEGER,
    
    payment_intent_id VARCHAR(100),
    payment_amount_cents INTEGER,
    payment_currency VARCHAR(3),
    
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_pool ON credit_transactions(pool_id);
CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_created ON credit_transactions(created_at);

-- Credit Purchases
CREATE TABLE credit_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES credit_pools(id),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    credits_amount DECIMAL(10,4) NOT NULL,
    bonus_credits DECIMAL(10,4) NOT NULL DEFAULT 0,
    total_credits DECIMAL(10,4) NOT NULL,
    
    payment_amount_cents INTEGER NOT NULL,
    payment_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50),
    
    stripe_payment_intent_id VARCHAR(100),
    stripe_charge_id VARCHAR(100),
    stripe_invoice_id VARCHAR(100),
    stripe_receipt_url TEXT,
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'
    )),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    
    is_auto_purchase BOOLEAN DEFAULT FALSE,
    auto_purchase_trigger VARCHAR(50),
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_purchases_pool ON credit_purchases(pool_id);
CREATE INDEX idx_credit_purchases_user ON credit_purchases(user_id);
CREATE INDEX idx_credit_purchases_status ON credit_purchases(status);
CREATE INDEX idx_credit_purchases_stripe ON credit_purchases(stripe_payment_intent_id);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    credit_pool_id UUID REFERENCES credit_pools(id),
    
    tier_id VARCHAR(50) NOT NULL REFERENCES subscription_tiers(id),
    billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
    
    seat_count INTEGER NOT NULL DEFAULT 1,
    add_ons JSONB NOT NULL DEFAULT '[]',
    
    price_per_unit_cents INTEGER NOT NULL,
    total_price_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    stripe_subscription_id VARCHAR(100),
    stripe_customer_id VARCHAR(100) NOT NULL,
    stripe_price_id VARCHAR(100),
    
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
        'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'
    )),
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Auto-Purchase Settings
CREATE TABLE auto_purchase_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES credit_pools(id) UNIQUE,
    
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    threshold_credits DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    purchase_credits DECIMAL(10,4) NOT NULL DEFAULT 10.0,
    max_monthly_auto_purchase DECIMAL(10,4),
    
    stripe_payment_method_id VARCHAR(100),
    
    auto_purchases_this_month INTEGER NOT NULL DEFAULT 0,
    auto_purchase_spend_this_month DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_auto_purchase_at TIMESTAMPTZ,
    month_reset_at TIMESTAMPTZ,
    
    notify_on_auto_purchase BOOLEAN DEFAULT TRUE,
    notification_emails TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Usage (for analytics)
CREATE TABLE credit_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    pool_id UUID NOT NULL REFERENCES credit_pools(id),
    user_id UUID NOT NULL REFERENCES users(id),
    transaction_id UUID REFERENCES credit_transactions(id),
    
    request_id UUID NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    provider_id VARCHAR(50) NOT NULL,
    
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cached_tokens INTEGER NOT NULL DEFAULT 0,
    
    credits_consumed DECIMAL(12,6) NOT NULL,
    credit_rate_multiplier DECIMAL(6,4) NOT NULL DEFAULT 1.0,
    
    credits_from_included DECIMAL(12,6) NOT NULL DEFAULT 0,
    credits_from_purchased DECIMAL(12,6) NOT NULL DEFAULT 0,
    credits_from_bonus DECIMAL(12,6) NOT NULL DEFAULT 0,
    
    request_type VARCHAR(50),
    latency_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_usage_pool ON credit_usage(pool_id);
CREATE INDEX idx_credit_usage_user ON credit_usage(user_id);
CREATE INDEX idx_credit_usage_model ON credit_usage(model_id);
CREATE INDEX idx_credit_usage_created ON credit_usage(created_at);

-- Billing Events
CREATE TABLE billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    stripe_event_id VARCHAR(100),
    
    pool_id UUID REFERENCES credit_pools(id),
    user_id UUID REFERENCES users(id),
    subscription_id UUID REFERENCES subscriptions(id),
    purchase_id UUID REFERENCES credit_purchases(id),
    
    data JSONB NOT NULL DEFAULT '{}',
    
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_events_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_processed ON billing_events(processed) WHERE processed = FALSE;
CREATE INDEX idx_billing_events_stripe ON billing_events(stripe_event_id);

-- Row Level Security
ALTER TABLE credit_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_pools_tenant_isolation ON credit_pools
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY credit_pool_members_access ON credit_pool_members FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id')::UUID OR
        pool_id IN (
            SELECT pool_id FROM credit_pool_members 
            WHERE user_id = current_setting('app.current_user_id')::UUID 
            AND role IN ('owner', 'admin')
        )
    );
```

---

## 43.5 CREDITS SERVICE

### packages/functions/src/services/credits.ts

```typescript
/**
 * Credits Service
 * Manages credit consumption, purchases, and balances
 * 
 * @version 4.13.0
 */

import { Pool } from 'pg';
import Stripe from 'stripe';
import { CREDIT_PRICING, calculatePurchasePrice } from '@radiant/shared/billing/credits';

export class CreditsService {
  constructor(
    private pool: Pool,
    private stripe: Stripe
  ) {}

  async getBalance(userId: string): Promise<{
    available: number;
    reserved: number;
    includedRemaining: number;
    purchasedRemaining: number;
    bonusRemaining: number;
  }> {
    const result = await this.pool.query(`
      SELECT 
        cp.balance_available,
        cp.balance_reserved,
        cp.monthly_included_total - cp.monthly_included_used as included_remaining,
        cp.purchased_remaining,
        cp.bonus_remaining
      FROM credit_pools cp
      JOIN credit_pool_members cpm ON cpm.pool_id = cp.id
      WHERE cpm.user_id = $1 AND cpm.status = 'active'
    `, [userId]);

    if (result.rows.length === 0) {
      return { available: 0, reserved: 0, includedRemaining: 0, purchasedRemaining: 0, bonusRemaining: 0 };
    }

    const row = result.rows[0];
    return {
      available: parseFloat(row.balance_available),
      reserved: parseFloat(row.balance_reserved),
      includedRemaining: parseFloat(row.included_remaining),
      purchasedRemaining: parseFloat(row.purchased_remaining),
      bonusRemaining: parseFloat(row.bonus_remaining),
    };
  }

  async reserveCredits(userId: string, amount: number): Promise<boolean> {
    const result = await this.pool.query(`
      UPDATE credit_pools cp
      SET 
        balance_available = balance_available - $2,
        balance_reserved = balance_reserved + $2,
        updated_at = NOW()
      FROM credit_pool_members cpm
      WHERE cpm.pool_id = cp.id
        AND cpm.user_id = $1
        AND cpm.status = 'active'
        AND cp.balance_available >= $2
      RETURNING cp.id
    `, [userId, amount]);

    return result.rowCount > 0;
  }

  async consumeCredits(
    userId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    requestId: string
  ): Promise<{ consumed: number; remaining: number }> {
    const creditCost = this.calculateCreditCost(modelId, inputTokens, outputTokens);
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Consume from reserved first, then available
      const consumeResult = await client.query(`
        UPDATE credit_pools cp
        SET 
          balance_reserved = GREATEST(0, balance_reserved - $2),
          balance_available = CASE 
            WHEN balance_reserved >= $2 THEN balance_available
            ELSE balance_available - ($2 - balance_reserved)
          END,
          updated_at = NOW()
        FROM credit_pool_members cpm
        WHERE cpm.pool_id = cp.id
          AND cpm.user_id = $1
          AND cpm.status = 'active'
        RETURNING cp.id, cp.balance_available
      `, [userId, creditCost]);

      if (consumeResult.rows.length === 0) {
        throw new Error('No active credit pool found');
      }

      // Record transaction
      await client.query(`
        INSERT INTO credit_transactions (
          pool_id, user_id, transaction_type, amount, balance_after,
          model_id, request_id, input_tokens, output_tokens
        ) VALUES ($1, $2, 'consumption', $3, $4, $5, $6, $7, $8)
      `, [
        consumeResult.rows[0].id, userId, -creditCost,
        consumeResult.rows[0].balance_available, modelId, requestId,
        inputTokens, outputTokens
      ]);

      // Record usage for analytics
      await client.query(`
        INSERT INTO credit_usage (
          pool_id, user_id, request_id, model_id, provider_id,
          input_tokens, output_tokens, credits_consumed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        consumeResult.rows[0].id, userId, requestId, modelId, 'auto',
        inputTokens, outputTokens, creditCost
      ]);

      // Update member usage stats
      await client.query(`
        UPDATE credit_pool_members
        SET 
          usage_today = usage_today + $2,
          usage_this_month = usage_this_month + $2,
          usage_all_time = usage_all_time + $2,
          last_usage_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
      `, [userId, creditCost]);

      await client.query('COMMIT');

      return {
        consumed: creditCost,
        remaining: parseFloat(consumeResult.rows[0].balance_available),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async purchaseCredits(
    userId: string,
    poolId: string,
    credits: number,
    paymentMethodId: string
  ): Promise<{ purchaseId: string; totalCredits: number }> {
    const pricing = calculatePurchasePrice(credits);
    
    // Create Stripe payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(pricing.finalPrice * 100),
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        poolId,
        userId,
        credits: credits.toString(),
        bonusCredits: pricing.bonusCredits.toString(),
      },
    });

    // Record purchase
    const result = await this.pool.query(`
      INSERT INTO credit_purchases (
        pool_id, user_id, tenant_id,
        credits_amount, bonus_credits, total_credits,
        payment_amount_cents, stripe_payment_intent_id,
        status, completed_at
      )
      SELECT 
        $1, $2, cp.tenant_id,
        $3, $4, $5, $6, $7, 'completed', NOW()
      FROM credit_pools cp WHERE cp.id = $1
      RETURNING id
    `, [
      poolId, userId,
      credits, pricing.bonusCredits, pricing.totalCredits,
      Math.round(pricing.finalPrice * 100), paymentIntent.id
    ]);

    // Add credits to pool
    await this.pool.query(`
      UPDATE credit_pools
      SET 
        purchased_total = purchased_total + $2,
        purchased_remaining = purchased_remaining + $2,
        bonus_total = bonus_total + $3,
        bonus_remaining = bonus_remaining + $3,
        balance_available = balance_available + $2 + $3,
        last_purchase_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [poolId, credits, pricing.bonusCredits]);

    return {
      purchaseId: result.rows[0].id,
      totalCredits: pricing.totalCredits,
    };
  }

  private calculateCreditCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const inputCredits = inputTokens / CREDIT_PRICING.consumption.text.inputTokensPer1Credit;
    const outputCredits = outputTokens / CREDIT_PRICING.consumption.text.outputTokensPer1Credit;
    return inputCredits + outputCredits;
  }
}
```

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 44: STORAGE BILLING SYSTEM (v4.14.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **Version: 4.14.0 | Tiered storage billing for S3 and database usage**

---

## 44.1 STORAGE BILLING OVERVIEW

| Tier | S3 ($/GB/mo) | DB ($/GB/mo) | Backup ($/GB/mo) | Included |
|------|--------------|--------------|------------------|----------|
| FREE | $0 | $0 | N/A | 1GB S3, 500MB DB |
| INDIVIDUAL | $0.10 | $0.15 | Included | 10GB S3, 2GB DB |
| FAMILY | $0.08 | $0.12 | Included | 25GB S3, 5GB DB |
| TEAM | $0.06 | $0.10 | Included | 100GB S3, 20GB DB |
| BUSINESS | $0.04 | $0.08 | Included | 500GB S3, 100GB DB |
| ENTERPRISE | Custom | Custom | Custom | Unlimited |

---

## 44.2 DATABASE SCHEMA

### packages/infrastructure/migrations/044_storage_billing.sql

```sql
-- ============================================================================
-- RADIANT v4.14.0 - Storage Billing Schema
-- ============================================================================

-- Storage Usage Tracking
CREATE TABLE storage_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    app_id UUID REFERENCES applications(id),
    
    storage_type VARCHAR(20) NOT NULL CHECK (storage_type IN ('s3', 'database', 'backup', 'embeddings')),
    
    bytes_used BIGINT NOT NULL DEFAULT 0,
    bytes_quota BIGINT,
    
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    price_per_gb_cents INTEGER NOT NULL,
    total_cost_cents INTEGER NOT NULL DEFAULT 0,
    
    is_over_quota BOOLEAN DEFAULT FALSE,
    quota_warning_sent BOOLEAN DEFAULT FALSE,
    quota_exceeded_sent BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_storage_usage_tenant ON storage_usage(tenant_id);
CREATE INDEX idx_storage_usage_type ON storage_usage(storage_type);
CREATE INDEX idx_storage_usage_period ON storage_usage(period_start, period_end);

-- Storage Pricing Configuration
CREATE TABLE storage_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id VARCHAR(50) NOT NULL REFERENCES subscription_tiers(id),
    storage_type VARCHAR(20) NOT NULL,
    
    price_per_gb_cents INTEGER NOT NULL,
    included_gb DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_gb DECIMAL(10,2),
    overage_price_per_gb_cents INTEGER,
    
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tier_id, storage_type, effective_from)
);

-- Storage Events
CREATE TABLE storage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'upload', 'delete', 'archive', 'restore', 'expire', 'quota_warning', 'quota_exceeded'
    )),
    
    storage_type VARCHAR(20) NOT NULL,
    bytes_delta BIGINT NOT NULL,
    
    resource_id VARCHAR(255),
    resource_type VARCHAR(50),
    resource_path TEXT,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_storage_events_tenant ON storage_events(tenant_id);
CREATE INDEX idx_storage_events_type ON storage_events(event_type);

-- Enable RLS
ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY storage_usage_tenant ON storage_usage
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY storage_events_tenant ON storage_events
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## 44.3 STORAGE SERVICE

### packages/functions/src/services/storage-billing.ts

```typescript
/**
 * Storage Billing Service
 * @version 4.14.0
 */

import { Pool } from 'pg';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export class StorageBillingService {
  constructor(private pool: Pool, private s3Client: S3Client) {}

  async getStorageUsage(tenantId: string): Promise<{
    storageType: string;
    bytesUsed: number;
    bytesQuota: number | null;
    pricePerGbCents: number;
    includedGb: number;
    totalCostCents: number;
  }[]> {
    const result = await this.pool.query(`
      SELECT 
        su.storage_type,
        su.bytes_used,
        su.bytes_quota,
        sp.price_per_gb_cents,
        sp.included_gb,
        CASE 
          WHEN su.bytes_used <= sp.included_gb * 1073741824 THEN 0
          ELSE CEIL((su.bytes_used - sp.included_gb * 1073741824) / 1073741824.0) * sp.price_per_gb_cents
        END as total_cost_cents
      FROM storage_usage su
      JOIN subscriptions s ON s.tenant_id = su.tenant_id AND s.status = 'active'
      JOIN storage_pricing sp ON sp.tier_id = s.tier_id AND sp.storage_type = su.storage_type
      WHERE su.tenant_id = $1 AND sp.is_active = TRUE AND su.period_end > NOW()
    `, [tenantId]);

    return result.rows;
  }

  async recordStorageEvent(
    tenantId: string,
    userId: string | null,
    eventType: string,
    storageType: string,
    bytesDelta: number,
    resourceId?: string
  ): Promise<void> {
    await this.pool.query(`
      INSERT INTO storage_events (tenant_id, user_id, event_type, storage_type, bytes_delta, resource_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [tenantId, userId, eventType, storageType, bytesDelta, resourceId]);

    await this.updateStorageUsage(tenantId, storageType, bytesDelta);
  }

  private async updateStorageUsage(tenantId: string, storageType: string, bytesDelta: number): Promise<void> {
    await this.pool.query(`
      INSERT INTO storage_usage (tenant_id, storage_type, bytes_used, period_start, period_end, price_per_gb_cents)
      SELECT $1, $2, GREATEST(0, $3), date_trunc('month', NOW()), date_trunc('month', NOW()) + INTERVAL '1 month',
        COALESCE((SELECT price_per_gb_cents FROM storage_pricing sp 
          JOIN subscriptions s ON s.tier_id = sp.tier_id AND s.tenant_id = $1
          WHERE sp.storage_type = $2 AND sp.is_active = TRUE LIMIT 1), 10)
      ON CONFLICT (tenant_id, storage_type, period_start, period_end)
      DO UPDATE SET bytes_used = GREATEST(0, storage_usage.bytes_used + $3), updated_at = NOW()
    `, [tenantId, storageType, bytesDelta]);
  }

  async calculateS3Usage(tenantId: string): Promise<number> {
    let totalBytes = 0;
    let continuationToken: string | undefined;

    do {
      const response = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET_NAME,
        Prefix: `tenants/${tenantId}/`,
        ContinuationToken: continuationToken,
      }));

      if (response.Contents) {
        totalBytes += response.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return totalBytes;
  }
}
```

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 45: VERSIONED SUBSCRIPTIONS & GRANDFATHERING (v4.15.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **Version: 4.15.0 | Preserves original pricing/features when plans change**

---

## 45.1 GRANDFATHERING PRINCIPLES

- **Existing subscribers keep original terms** when plans change
- **Price increases don't affect** current subscribers
- **Migration offers with incentives** encourage voluntary upgrades
- **Complete audit trail** of all plan changes

---

## 45.2 DATABASE SCHEMA

### packages/infrastructure/migrations/045_versioned_subscriptions.sql

```sql
-- ============================================================================
-- RADIANT v4.15.0 - Versioned Subscriptions & Grandfathering
-- ============================================================================

-- Subscription Plan Versions
CREATE TABLE subscription_plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id VARCHAR(50) NOT NULL REFERENCES subscription_tiers(id),
    version_number INTEGER NOT NULL,
    
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    price_monthly_cents INTEGER,
    price_annual_cents INTEGER,
    price_per_user BOOLEAN DEFAULT FALSE,
    
    included_credits_per_user DECIMAL(10,2) NOT NULL,
    features JSONB NOT NULL,
    rate_limits JSONB NOT NULL,
    
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    
    change_reason TEXT,
    changed_by UUID REFERENCES administrators(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tier_id, version_number)
);

CREATE INDEX idx_plan_versions_tier ON subscription_plan_versions(tier_id);
CREATE INDEX idx_plan_versions_effective ON subscription_plan_versions(effective_from, effective_until);

-- Grandfathered Subscriptions
CREATE TABLE grandfathered_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    plan_version_id UUID NOT NULL REFERENCES subscription_plan_versions(id),
    
    locked_price_monthly_cents INTEGER,
    locked_price_annual_cents INTEGER,
    locked_features JSONB NOT NULL,
    locked_rate_limits JSONB NOT NULL,
    locked_credits_per_user DECIMAL(10,2) NOT NULL,
    
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'opted_out', 'migrated', 'expired')),
    
    migration_offered BOOLEAN DEFAULT FALSE,
    migration_offer_date TIMESTAMPTZ,
    migration_incentive JSONB,
    migration_response VARCHAR(20),
    migration_response_date TIMESTAMPTZ,
    
    grandfathered_at TIMESTAMPTZ DEFAULT NOW(),
    grandfathered_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grandfathered_subscription ON grandfathered_subscriptions(subscription_id);
CREATE INDEX idx_grandfathered_status ON grandfathered_subscriptions(status);

-- Plan Change Audit
CREATE TABLE plan_change_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id VARCHAR(50) NOT NULL REFERENCES subscription_tiers(id),
    
    old_version_id UUID REFERENCES subscription_plan_versions(id),
    new_version_id UUID NOT NULL REFERENCES subscription_plan_versions(id),
    
    change_type VARCHAR(30) NOT NULL CHECK (change_type IN (
        'price_increase', 'price_decrease', 'feature_add', 'feature_remove',
        'limit_increase', 'limit_decrease', 'credit_change', 'terms_change'
    )),
    
    change_summary TEXT NOT NULL,
    affected_subscribers INTEGER NOT NULL DEFAULT 0,
    grandfathered_count INTEGER NOT NULL DEFAULT 0,
    
    changed_by UUID REFERENCES administrators(id),
    approved_by UUID REFERENCES administrators(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function: Get effective plan for subscription
CREATE OR REPLACE FUNCTION get_effective_plan(p_subscription_id UUID)
RETURNS TABLE (
    tier_id VARCHAR(50),
    version_number INTEGER,
    price_monthly_cents INTEGER,
    price_annual_cents INTEGER,
    features JSONB,
    rate_limits JSONB,
    credits_per_user DECIMAL(10,2),
    is_grandfathered BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.tier_id,
        COALESCE(pv.version_number, 0),
        COALESCE(gs.locked_price_monthly_cents, st.price_monthly::INTEGER * 100),
        COALESCE(gs.locked_price_annual_cents, st.price_annual::INTEGER * 100),
        COALESCE(gs.locked_features, st.features),
        COALESCE(gs.locked_rate_limits, jsonb_build_object(
            'requestsPerMinute', st.requests_per_minute,
            'tokensPerMinute', st.tokens_per_minute,
            'concurrentRequests', st.concurrent_requests
        )),
        COALESCE(gs.locked_credits_per_user, st.included_credits_per_user),
        (gs.id IS NOT NULL) as is_grandfathered
    FROM subscriptions s
    JOIN subscription_tiers st ON st.id = s.tier_id
    LEFT JOIN grandfathered_subscriptions gs ON gs.subscription_id = s.id AND gs.status = 'active'
    LEFT JOIN subscription_plan_versions pv ON pv.id = gs.plan_version_id
    WHERE s.id = p_subscription_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 45.3 GRANDFATHERING SERVICE

### packages/functions/src/services/grandfathering.ts

```typescript
/**
 * Grandfathering Service
 * @version 4.15.0
 */

import { Pool } from 'pg';

export class GrandfatheringService {
  constructor(private pool: Pool) {}

  async createPlanVersion(
    tierId: string,
    changeType: string,
    changeSummary: string,
    changedBy: string,
    approvedBy: string
  ): Promise<{ versionId: string; grandfatheredCount: number }> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current tier and latest version
      const tierResult = await client.query(`SELECT * FROM subscription_tiers WHERE id = $1`, [tierId]);
      const tier = tierResult.rows[0];

      const versionResult = await client.query(`
        SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
        FROM subscription_plan_versions WHERE tier_id = $1
      `, [tierId]);
      const nextVersion = versionResult.rows[0].next_version;

      // Close previous version
      await client.query(`
        UPDATE subscription_plan_versions SET effective_until = NOW()
        WHERE tier_id = $1 AND effective_until IS NULL
      `, [tierId]);

      // Create new version
      const newVersionResult = await client.query(`
        INSERT INTO subscription_plan_versions (
          tier_id, version_number, display_name, description,
          price_monthly_cents, price_annual_cents, price_per_user,
          included_credits_per_user, features, rate_limits, change_reason, changed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        tierId, nextVersion, tier.display_name, tier.description,
        tier.price_monthly ? tier.price_monthly * 100 : null,
        tier.price_annual ? tier.price_annual * 100 : null,
        tier.price_per_user, tier.included_credits_per_user, tier.features,
        JSON.stringify({ requestsPerMinute: tier.requests_per_minute, tokensPerMinute: tier.tokens_per_minute, concurrentRequests: tier.concurrent_requests }),
        changeSummary, changedBy
      ]);

      const newVersionId = newVersionResult.rows[0].id;

      // Get previous version for grandfathering
      const prevVersionResult = await client.query(`
        SELECT id FROM subscription_plan_versions WHERE tier_id = $1 AND version_number = $2 - 1
      `, [tierId, nextVersion]);

      let grandfatheredCount = 0;

      if (prevVersionResult.rows.length > 0) {
        const prevVersionId = prevVersionResult.rows[0].id;

        // Grandfather all active subscriptions
        const grandfatherResult = await client.query(`
          INSERT INTO grandfathered_subscriptions (
            subscription_id, plan_version_id, locked_price_monthly_cents, locked_price_annual_cents,
            locked_features, locked_rate_limits, locked_credits_per_user, grandfathered_reason
          )
          SELECT s.id, $1, pv.price_monthly_cents, pv.price_annual_cents,
            pv.features, pv.rate_limits, pv.included_credits_per_user, $2
          FROM subscriptions s
          JOIN subscription_plan_versions pv ON pv.id = $1
          WHERE s.tier_id = $3 AND s.status IN ('active', 'trialing')
            AND NOT EXISTS (SELECT 1 FROM grandfathered_subscriptions gs WHERE gs.subscription_id = s.id AND gs.status = 'active')
        `, [prevVersionId, changeSummary, tierId]);

        grandfatheredCount = grandfatherResult.rowCount || 0;
      }

      // Record audit
      await client.query(`
        INSERT INTO plan_change_audit (tier_id, old_version_id, new_version_id, change_type, change_summary, affected_subscribers, grandfathered_count, changed_by, approved_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [tierId, prevVersionResult.rows[0]?.id, newVersionId, changeType, changeSummary, grandfatheredCount, grandfatheredCount, changedBy, approvedBy]);

      await client.query('COMMIT');
      return { versionId: newVersionId, grandfatheredCount };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEffectivePlan(subscriptionId: string): Promise<{
    grandfathered: boolean;
    priceMonthly: number | null;
    features: Record<string, any>;
    rateLimits: Record<string, number>;
    creditsPerUser: number;
  }> {
    const result = await this.pool.query(`SELECT * FROM get_effective_plan($1)`, [subscriptionId]);
    const row = result.rows[0];

    return {
      grandfathered: row.is_grandfathered,
      priceMonthly: row.price_monthly_cents,
      features: row.features,
      rateLimits: row.rate_limits,
      creditsPerUser: row.credits_per_user,
    };
  }

  async offerMigration(subscriptionId: string, incentive: { bonusCredits?: number; discountPercent?: number }): Promise<void> {
    await this.pool.query(`
      UPDATE grandfathered_subscriptions
      SET migration_offered = TRUE, migration_offer_date = NOW(), migration_incentive = $2, updated_at = NOW()
      WHERE subscription_id = $1 AND status = 'active'
    `, [subscriptionId, JSON.stringify(incentive)]);
  }

  async acceptMigration(subscriptionId: string): Promise<void> {
    await this.pool.query(`
      UPDATE grandfathered_subscriptions
      SET status = 'migrated', migration_response = 'accepted', migration_response_date = NOW(), updated_at = NOW()
      WHERE subscription_id = $1 AND status = 'active'
    `, [subscriptionId]);
  }
}
```

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 46: DUAL-ADMIN MIGRATION APPROVAL (v4.16.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **Version: 4.16.0 | Two-person approval for production database migrations**

---

## 46.1 DUAL-ADMIN APPROVAL PRINCIPLES

- **Production migrations require 2 approvals** (configurable)
- **Requestor cannot self-approve**
- **Complete audit trail** of all decisions
- **Configurable policies** per tenant/environment

---

## 46.2 DATABASE SCHEMA

### packages/infrastructure/migrations/046_dual_admin_approval.sql

```sql
-- ============================================================================
-- RADIANT v4.16.0 - Dual-Admin Migration Approval
-- ============================================================================

-- Migration Approval Requests
CREATE TABLE migration_approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    migration_name VARCHAR(255) NOT NULL,
    migration_version VARCHAR(50) NOT NULL,
    migration_checksum VARCHAR(64) NOT NULL,
    migration_sql TEXT NOT NULL,
    
    environment VARCHAR(20) NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    
    requested_by UUID NOT NULL REFERENCES administrators(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    request_reason TEXT,
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'executed', 'failed', 'cancelled'
    )),
    
    approvals_required INTEGER NOT NULL DEFAULT 2,
    approvals_received INTEGER NOT NULL DEFAULT 0,
    
    executed_at TIMESTAMPTZ,
    executed_by UUID REFERENCES administrators(id),
    execution_time_ms INTEGER,
    execution_error TEXT,
    rollback_sql TEXT,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_migration_approval_tenant ON migration_approval_requests(tenant_id);
CREATE INDEX idx_migration_approval_status ON migration_approval_requests(status);
CREATE INDEX idx_migration_approval_env ON migration_approval_requests(environment);

-- Individual Approvals
CREATE TABLE migration_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES migration_approval_requests(id) ON DELETE CASCADE,
    
    admin_id UUID NOT NULL REFERENCES administrators(id),
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected')),
    reason TEXT,
    
    reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(request_id, admin_id)
);

CREATE INDEX idx_migration_approvals_request ON migration_approvals(request_id);

-- Approval Policies
CREATE TABLE migration_approval_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    environment VARCHAR(20) NOT NULL,
    
    approvals_required INTEGER NOT NULL DEFAULT 2,
    self_approval_allowed BOOLEAN DEFAULT FALSE,
    auto_approve_development BOOLEAN DEFAULT TRUE,
    
    allowed_approvers UUID[] DEFAULT '{}',
    required_approvers UUID[],
    
    notification_channels JSONB DEFAULT '{}',
    escalation_after_hours INTEGER DEFAULT 24,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, environment)
);

-- Trigger: Update approval count
CREATE OR REPLACE FUNCTION update_approval_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.decision = 'approved' THEN
        UPDATE migration_approval_requests
        SET approvals_received = approvals_received + 1,
            status = CASE WHEN approvals_received + 1 >= approvals_required THEN 'approved' ELSE status END,
            updated_at = NOW()
        WHERE id = NEW.request_id;
    ELSIF NEW.decision = 'rejected' THEN
        UPDATE migration_approval_requests SET status = 'rejected', updated_at = NOW() WHERE id = NEW.request_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER migration_approval_update
    AFTER INSERT ON migration_approvals
    FOR EACH ROW EXECUTE FUNCTION update_approval_count();

-- Enable RLS
ALTER TABLE migration_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_approval_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY mar_tenant ON migration_approval_requests
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY map_tenant ON migration_approval_policies
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## 46.3 MIGRATION APPROVAL SERVICE

### packages/functions/src/services/migration-approval.ts

```typescript
/**
 * Dual-Admin Migration Approval Service
 * @version 4.16.0
 */

import { Pool } from 'pg';
import crypto from 'crypto';

export class MigrationApprovalService {
  constructor(private pool: Pool) {}

  async createRequest(
    tenantId: string,
    adminId: string,
    migrationName: string,
    migrationVersion: string,
    migrationSql: string,
    environment: string,
    reason?: string
  ): Promise<{ id: string; status: string; approvalsRequired: number }> {
    // Get policy
    const policyResult = await this.pool.query(`
      SELECT * FROM migration_approval_policies
      WHERE tenant_id = $1 AND environment = $2 AND is_active = TRUE
    `, [tenantId, environment]);

    let approvalsRequired = environment === 'production' ? 2 : (environment === 'staging' ? 1 : 0);
    if (policyResult.rows.length > 0) {
      const policy = policyResult.rows[0];
      approvalsRequired = policy.approvals_required;
      if (environment === 'development' && policy.auto_approve_development) approvalsRequired = 0;
    }

    const checksum = crypto.createHash('sha256').update(migrationSql).digest('hex');

    const result = await this.pool.query(`
      INSERT INTO migration_approval_requests (
        tenant_id, migration_name, migration_version, migration_checksum,
        migration_sql, environment, requested_by, request_reason,
        approvals_required, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, status, approvals_required
    `, [tenantId, migrationName, migrationVersion, checksum, migrationSql, environment, adminId, reason, approvalsRequired, approvalsRequired === 0 ? 'approved' : 'pending']);

    return result.rows[0];
  }

  async submitApproval(
    requestId: string,
    adminId: string,
    decision: 'approved' | 'rejected',
    reason?: string
  ): Promise<{ success: boolean; requestStatus: string; canExecute: boolean }> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get request
      const requestResult = await client.query(`SELECT * FROM migration_approval_requests WHERE id = $1`, [requestId]);
      if (requestResult.rows.length === 0) throw new Error('Request not found');
      const request = requestResult.rows[0];

      if (request.status !== 'pending') throw new Error(`Request is already ${request.status}`);

      // Check self-approval
      const policyResult = await client.query(`
        SELECT self_approval_allowed FROM migration_approval_policies
        WHERE tenant_id = $1 AND environment = $2 AND is_active = TRUE
      `, [request.tenant_id, request.environment]);
      
      const selfApprovalAllowed = policyResult.rows[0]?.self_approval_allowed ?? false;
      if (request.requested_by === adminId && !selfApprovalAllowed) {
        throw new Error('Self-approval is not allowed for this environment');
      }

      // Check duplicate
      const existingApproval = await client.query(`
        SELECT id FROM migration_approvals WHERE request_id = $1 AND admin_id = $2
      `, [requestId, adminId]);
      if (existingApproval.rows.length > 0) throw new Error('You have already submitted an approval');

      // Insert approval
      await client.query(`
        INSERT INTO migration_approvals (request_id, admin_id, decision, reason)
        VALUES ($1, $2, $3, $4)
      `, [requestId, adminId, decision, reason]);

      // Get updated status
      const updatedResult = await client.query(`
        SELECT status, approvals_received, approvals_required FROM migration_approval_requests WHERE id = $1
      `, [requestId]);
      const updated = updatedResult.rows[0];

      await client.query('COMMIT');

      return {
        success: true,
        requestStatus: updated.status,
        canExecute: updated.status === 'approved'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async executeMigration(requestId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const requestResult = await client.query(`
        SELECT * FROM migration_approval_requests WHERE id = $1 AND status = 'approved' FOR UPDATE
      `, [requestId]);
      if (requestResult.rows.length === 0) throw new Error('Request not found or not approved');

      const request = requestResult.rows[0];
      const startTime = Date.now();

      try {
        await client.query(request.migration_sql);
        
        await client.query(`
          UPDATE migration_approval_requests
          SET status = 'executed', executed_at = NOW(), executed_by = $2, execution_time_ms = $3, updated_at = NOW()
          WHERE id = $1
        `, [requestId, adminId, Date.now() - startTime]);

        await client.query('COMMIT');
        return { success: true };
      } catch (execError: any) {
        await client.query('ROLLBACK');
        await this.pool.query(`
          UPDATE migration_approval_requests SET status = 'failed', execution_error = $2, updated_at = NOW() WHERE id = $1
        `, [requestId, execError.message]);
        return { success: false, error: execError.message };
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPendingRequests(tenantId: string, adminId: string): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT mar.*, NOT EXISTS (SELECT 1 FROM migration_approvals ma WHERE ma.request_id = mar.id AND ma.admin_id = $2) as can_approve
      FROM migration_approval_requests mar
      WHERE mar.tenant_id = $1 AND mar.status = 'pending' AND mar.requested_by != $2
      ORDER BY mar.created_at DESC
    `, [tenantId, adminId]);
    return result.rows;
  }
}
```

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# IMPLEMENTATION VERIFICATION CHECKLIST (v4.13.0 - v4.16.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## Section 43: Billing & Credits (v4.13.0)
- [ ] Migration 043_billing_system.sql applied
- [ ] All 7 subscription tiers seeded
- [ ] credit_pools table created with RLS
- [ ] credit_transactions table created
- [ ] subscriptions table created
- [ ] CreditsService implemented
- [ ] Stripe integration working

## Section 44: Storage Billing (v4.14.0)
- [ ] Migration 044_storage_billing.sql applied
- [ ] storage_usage table created
- [ ] storage_pricing configured per tier
- [ ] StorageBillingService implemented
- [ ] S3 usage calculation working
- [ ] Quota warnings sending

## Section 45: Versioned Subscriptions (v4.15.0)
- [ ] Migration 045_versioned_subscriptions.sql applied
- [ ] subscription_plan_versions table created
- [ ] grandfathered_subscriptions table created
- [ ] get_effective_plan() function working
- [ ] GrandfatheringService implemented
- [ ] Migration offers working

## Section 46: Dual-Admin Approval (v4.16.0)
- [ ] Migration 046_dual_admin_approval.sql applied
- [ ] migration_approval_requests table created
- [ ] migration_approvals table created
- [ ] Approval count trigger working
- [ ] MigrationApprovalService implemented
- [ ] Self-approval prevention working

---

**RADIANT v4.17.0 - AI-Optimized for Code Generation**
**Version: 4.17.0 | December 2024 | Prompt 32**
**Total Sections: 47 (0-46)**

## v4.17.0 AI Code Generation Enhancements:
- âœ… Complete RadiantDeployerApp.swift with @main struct
- âœ… Package.swift manifest for Swift Package Manager
- âœ… Info.plist and entitlements templates
- âœ… RADIANT_VERSION constant (replaces hardcoded strings)
- âœ… DOMAIN_PLACEHOLDER constant for configuration
- âœ… Sendable conformance for all types crossing actor boundaries
- âœ… Swift file creation order for AI implementation
- âœ… Platform requirements (macOS 13.0+, Swift 5.9+, Xcode 15+)
- âœ… AWS CLI path detection (Homebrew ARM64 + Intel + system)
- âœ… DeploymentResult.create() factory method
- âœ… Enhanced DeploymentError with helpful messages

## Previous Fixes (v4.16.1):
- âœ… RLS variable standardization (`app.current_tenant_id`)
- âœ… Type deduplication (`SelfHostedModelPricing`, `ExternalProviderPricing`)
- âœ… Billing tier localization registry entries

---

# END OF RADIANT-PROMPT-32-v4.17.0
