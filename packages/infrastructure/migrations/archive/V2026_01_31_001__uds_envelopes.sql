-- =============================================================================
-- UDS Envelopes Migration
-- Extends User Data Service to store UEP v2.0 envelopes using existing
-- tiered storage infrastructure (Hot/Warm/Cold/Glacier)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Envelopes Table
-- Stores UEP v2.0 envelopes with tier awareness
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS uds_envelopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- UEP v2.0 Core Fields
    specversion VARCHAR(10) NOT NULL DEFAULT '2.0',
    type VARCHAR(100) NOT NULL,
    source JSONB NOT NULL DEFAULT '{}',
    payload JSONB NOT NULL DEFAULT '{}',
    
    -- Tracing & Compliance
    tracing JSONB,
    compliance JSONB,
    risk_signals JSONB,
    extensions JSONB,
    
    -- Pipeline Context
    pipeline_id UUID,
    method_id VARCHAR(100),
    sequence_number INTEGER,
    
    -- Integrity
    checksum VARCHAR(64) NOT NULL,
    signature JSONB,
    encrypted BOOLEAN DEFAULT false,
    encryption_key_id UUID,
    
    -- Tier Management (integrates with UDS tier coordinator)
    current_tier VARCHAR(20) NOT NULL DEFAULT 'hot' 
        CHECK (current_tier IN ('hot', 'warm', 'cold', 'glacier')),
    s3_key VARCHAR(500),
    archived_at TIMESTAMPTZ,
    retrieved_at TIMESTAMPTZ,
    
    -- Retention & Compliance
    retention_days INTEGER,
    compliance_frameworks TEXT[],
    data_classification VARCHAR(50),
    contains_phi BOOLEAN DEFAULT false,
    contains_pii BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- Indexes for Performance
-- -----------------------------------------------------------------------------

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_uds_envelopes_tenant 
    ON uds_envelopes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_uds_envelopes_tenant_created 
    ON uds_envelopes(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_uds_envelopes_pipeline 
    ON uds_envelopes(pipeline_id) WHERE pipeline_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_uds_envelopes_type 
    ON uds_envelopes(tenant_id, type);

-- Tier management indexes
CREATE INDEX IF NOT EXISTS idx_uds_envelopes_tier 
    ON uds_envelopes(tenant_id, current_tier);

CREATE INDEX IF NOT EXISTS idx_uds_envelopes_tier_accessed 
    ON uds_envelopes(tenant_id, current_tier, last_accessed_at)
    WHERE current_tier IN ('hot', 'warm');

-- Tracing index (for pipeline debugging)
CREATE INDEX IF NOT EXISTS idx_uds_envelopes_trace 
    ON uds_envelopes((tracing->>'traceId')) 
    WHERE tracing IS NOT NULL;

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_uds_envelopes_phi 
    ON uds_envelopes(tenant_id, contains_phi) 
    WHERE contains_phi = true;

CREATE INDEX IF NOT EXISTS idx_uds_envelopes_retention 
    ON uds_envelopes(tenant_id, retention_days, created_at)
    WHERE retention_days IS NOT NULL;

-- Expiration index for TTL cleanup
CREATE INDEX IF NOT EXISTS idx_uds_envelopes_expires 
    ON uds_envelopes(expires_at) 
    WHERE expires_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

ALTER TABLE uds_envelopes ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY uds_envelopes_tenant_isolation ON uds_envelopes
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Admin bypass policy
CREATE POLICY uds_envelopes_admin_bypass ON uds_envelopes
    FOR ALL
    USING (current_setting('app.is_admin', true)::boolean = true);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION uds_envelopes_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uds_envelopes_updated_at
    BEFORE UPDATE ON uds_envelopes
    FOR EACH ROW
    EXECUTE FUNCTION uds_envelopes_update_timestamp();

-- Auto-update last_accessed_at on read (called by application)
CREATE OR REPLACE FUNCTION uds_envelopes_touch(envelope_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE uds_envelopes 
    SET last_accessed_at = CURRENT_TIMESTAMP
    WHERE id = envelope_id;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Tier Transition Functions
-- -----------------------------------------------------------------------------

-- Get envelopes ready for Hot → Warm transition
CREATE OR REPLACE FUNCTION uds_envelopes_get_hot_to_warm(
    p_tenant_id UUID,
    p_ttl_hours INTEGER DEFAULT 24,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (envelope_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT id
    FROM uds_envelopes
    WHERE tenant_id = p_tenant_id
      AND current_tier = 'hot'
      AND last_accessed_at < NOW() - (p_ttl_hours || ' hours')::INTERVAL
      AND deleted_at IS NULL
    ORDER BY last_accessed_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get envelopes ready for Warm → Cold transition
CREATE OR REPLACE FUNCTION uds_envelopes_get_warm_to_cold(
    p_tenant_id UUID,
    p_retention_days INTEGER DEFAULT 90,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (envelope_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT id
    FROM uds_envelopes
    WHERE tenant_id = p_tenant_id
      AND current_tier = 'warm'
      AND last_accessed_at < NOW() - (p_retention_days || ' days')::INTERVAL
      AND deleted_at IS NULL
    ORDER BY last_accessed_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Transition envelope tier
CREATE OR REPLACE FUNCTION uds_envelopes_transition_tier(
    p_envelope_id UUID,
    p_from_tier VARCHAR(20),
    p_to_tier VARCHAR(20),
    p_s3_key VARCHAR(500) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE uds_envelopes
    SET current_tier = p_to_tier,
        s3_key = COALESCE(p_s3_key, s3_key),
        archived_at = CASE WHEN p_to_tier IN ('cold', 'glacier') THEN CURRENT_TIMESTAMP ELSE archived_at END,
        retrieved_at = CASE WHEN p_from_tier IN ('cold', 'glacier') AND p_to_tier = 'warm' THEN CURRENT_TIMESTAMP ELSE retrieved_at END,
        -- Clear payload when archiving to cold (data in S3)
        payload = CASE WHEN p_to_tier IN ('cold', 'glacier') THEN '{"archived": true}'::jsonb ELSE payload END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_envelope_id
      AND current_tier = p_from_tier
    RETURNING true INTO v_updated;
    
    RETURN COALESCE(v_updated, false);
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Compliance Functions
-- -----------------------------------------------------------------------------

-- Get envelopes with PHI past retention period
CREATE OR REPLACE FUNCTION uds_envelopes_get_phi_past_retention(
    p_tenant_id UUID
)
RETURNS TABLE (
    envelope_id UUID,
    created_at TIMESTAMPTZ,
    retention_days INTEGER,
    days_past_retention INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.created_at,
        e.retention_days,
        EXTRACT(DAY FROM NOW() - e.created_at)::INTEGER - e.retention_days AS days_past_retention
    FROM uds_envelopes e
    WHERE e.tenant_id = p_tenant_id
      AND e.contains_phi = true
      AND e.retention_days IS NOT NULL
      AND e.created_at + (e.retention_days || ' days')::INTERVAL < NOW()
      AND e.deleted_at IS NULL
    ORDER BY days_past_retention DESC;
END;
$$ LANGUAGE plpgsql;

-- Get envelope counts by tier
CREATE OR REPLACE FUNCTION uds_envelopes_tier_counts(p_tenant_id UUID)
RETURNS TABLE (
    tier VARCHAR(20),
    count BIGINT,
    total_size_estimate BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.current_tier,
        COUNT(*) as count,
        SUM(pg_column_size(e.payload))::BIGINT as total_size_estimate
    FROM uds_envelopes e
    WHERE e.tenant_id = p_tenant_id
      AND e.deleted_at IS NULL
    GROUP BY e.current_tier;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Audit Integration
-- -----------------------------------------------------------------------------

-- Log envelope operations to UDS audit log
CREATE OR REPLACE FUNCTION uds_envelopes_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO uds_audit_log (
            tenant_id, user_id, event_type, event_category,
            resource_type, resource_id, action, action_details
        ) VALUES (
            NEW.tenant_id,
            NULL, -- System operation
            'envelope_created',
            'envelope',
            'envelope',
            NEW.id::TEXT,
            'create',
            jsonb_build_object(
                'type', NEW.type,
                'pipeline_id', NEW.pipeline_id,
                'contains_phi', NEW.contains_phi
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND OLD.current_tier != NEW.current_tier THEN
        INSERT INTO uds_audit_log (
            tenant_id, user_id, event_type, event_category,
            resource_type, resource_id, action, action_details
        ) VALUES (
            NEW.tenant_id,
            NULL,
            'envelope_tier_change',
            'system',
            'envelope',
            NEW.id::TEXT,
            'tier_transition',
            jsonb_build_object(
                'from_tier', OLD.current_tier,
                'to_tier', NEW.current_tier
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        INSERT INTO uds_audit_log (
            tenant_id, user_id, event_type, event_category,
            resource_type, resource_id, action, action_details
        ) VALUES (
            COALESCE(NEW.tenant_id, OLD.tenant_id),
            NULL,
            'envelope_deleted',
            'envelope',
            'envelope',
            COALESCE(NEW.id, OLD.id)::TEXT,
            'delete',
            jsonb_build_object('soft_delete', TG_OP = 'UPDATE')
        );
        RETURN COALESCE(NEW, OLD);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uds_envelopes_audit
    AFTER INSERT OR UPDATE OR DELETE ON uds_envelopes
    FOR EACH ROW
    EXECUTE FUNCTION uds_envelopes_audit_trigger();

-- -----------------------------------------------------------------------------
-- Data Flow Metrics Extension
-- -----------------------------------------------------------------------------

-- Add envelope metrics to existing UDS data flow metrics
ALTER TABLE uds_data_flow_metrics 
    ADD COLUMN IF NOT EXISTS envelope_hot_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS envelope_warm_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS envelope_cold_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS envelope_hot_to_warm_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS envelope_warm_to_cold_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS envelope_cold_to_warm_count INTEGER DEFAULT 0;

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE uds_envelopes IS 'UEP v2.0 envelope storage with UDS tiered storage integration';
COMMENT ON COLUMN uds_envelopes.current_tier IS 'Storage tier: hot (Redis), warm (PostgreSQL), cold (S3), glacier (S3 Glacier)';
COMMENT ON COLUMN uds_envelopes.s3_key IS 'S3 object key when archived to cold/glacier tier';
COMMENT ON COLUMN uds_envelopes.compliance_frameworks IS 'Applicable regulatory frameworks (HIPAA, GDPR, SOC2, FDA)';
COMMENT ON COLUMN uds_envelopes.retention_days IS 'Minimum retention period based on compliance requirements';
COMMENT ON FUNCTION uds_envelopes_transition_tier IS 'Transitions envelope between storage tiers, clearing payload when archiving';

-- -----------------------------------------------------------------------------
-- Grant Permissions
-- -----------------------------------------------------------------------------

-- Assuming standard role setup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'radiant_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON uds_envelopes TO radiant_app;
        GRANT EXECUTE ON FUNCTION uds_envelopes_touch TO radiant_app;
        GRANT EXECUTE ON FUNCTION uds_envelopes_get_hot_to_warm TO radiant_app;
        GRANT EXECUTE ON FUNCTION uds_envelopes_get_warm_to_cold TO radiant_app;
        GRANT EXECUTE ON FUNCTION uds_envelopes_transition_tier TO radiant_app;
        GRANT EXECUTE ON FUNCTION uds_envelopes_get_phi_past_retention TO radiant_app;
        GRANT EXECUTE ON FUNCTION uds_envelopes_tier_counts TO radiant_app;
    END IF;
END $$;
