-- ============================================================================
-- RADIANT v5.43.0 - Decision Artifact Versioning Functions
-- Functions for creating immutable artifact versions
-- ============================================================================

-- Create a new version of an artifact (freezes current, creates new)
CREATE OR REPLACE FUNCTION create_decision_artifact_version(
    p_artifact_id UUID,
    p_new_content JSONB,
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_current_version INT;
    v_conversation_id UUID;
    v_tenant_id UUID;
    v_title VARCHAR(500);
    v_miner_model VARCHAR(100);
    v_compliance_frameworks TEXT[];
    v_primary_domain VARCHAR(100);
BEGIN
    -- Get current artifact data
    SELECT version, conversation_id, tenant_id, title, miner_model, 
           compliance_frameworks, primary_domain
    INTO v_current_version, v_conversation_id, v_tenant_id, v_title, 
         v_miner_model, v_compliance_frameworks, v_primary_domain
    FROM decision_artifacts
    WHERE id = p_artifact_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Artifact not found: %', p_artifact_id;
    END IF;
    
    -- Freeze current version
    UPDATE decision_artifacts
    SET status = 'frozen',
        frozen_at = NOW(),
        frozen_by = p_user_id
    WHERE id = p_artifact_id;
    
    -- Create new version
    INSERT INTO decision_artifacts (
        conversation_id, user_id, tenant_id, title,
        artifact_content, parent_artifact_id, version,
        status, miner_model, compliance_frameworks, primary_domain,
        extraction_timestamp
    )
    VALUES (
        v_conversation_id, p_user_id, v_tenant_id, v_title,
        p_new_content, p_artifact_id, v_current_version + 1,
        'active', v_miner_model, v_compliance_frameworks, v_primary_domain, NOW()
    )
    RETURNING id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Get version history for an artifact
CREATE OR REPLACE FUNCTION get_decision_artifact_version_history(
    p_artifact_id UUID
) RETURNS TABLE (
    artifact_id UUID,
    version INT,
    status VARCHAR(32),
    created_at TIMESTAMPTZ,
    frozen_at TIMESTAMPTZ,
    frozen_by UUID,
    content_hash VARCHAR(64)
) AS $$
DECLARE
    v_root_id UUID;
BEGIN
    -- Find root artifact (walk up parent chain)
    WITH RECURSIVE artifact_chain AS (
        SELECT id, parent_artifact_id, 0 as depth
        FROM decision_artifacts
        WHERE id = p_artifact_id
        
        UNION ALL
        
        SELECT da.id, da.parent_artifact_id, ac.depth + 1
        FROM decision_artifacts da
        JOIN artifact_chain ac ON da.id = ac.parent_artifact_id
    )
    SELECT id INTO v_root_id
    FROM artifact_chain
    WHERE parent_artifact_id IS NULL;
    
    -- Return all versions from root
    RETURN QUERY
    WITH RECURSIVE version_chain AS (
        SELECT id, version, status, created_at, frozen_at, frozen_by, content_hash
        FROM decision_artifacts
        WHERE id = v_root_id
        
        UNION ALL
        
        SELECT da.id, da.version, da.status, da.created_at, da.frozen_at, da.frozen_by, da.content_hash
        FROM decision_artifacts da
        JOIN version_chain vc ON da.parent_artifact_id = vc.id
    )
    SELECT * FROM version_chain
    ORDER BY version ASC;
END;
$$ LANGUAGE plpgsql;

-- Mark artifact as stale based on volatile query thresholds
CREATE OR REPLACE FUNCTION check_decision_artifact_staleness(
    p_artifact_id UUID
) RETURNS TABLE (
    is_stale BOOLEAN,
    stale_query_count INT,
    oldest_stale_query_age_hours DECIMAL
) AS $$
DECLARE
    v_artifact RECORD;
    v_stale_count INT := 0;
    v_oldest_age DECIMAL := 0;
    v_query RECORD;
    v_age_hours DECIMAL;
BEGIN
    SELECT artifact_content, staleness_threshold_days
    INTO v_artifact
    FROM decision_artifacts
    WHERE id = p_artifact_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Artifact not found: %', p_artifact_id;
    END IF;
    
    -- Check each volatile query
    FOR v_query IN 
        SELECT * FROM jsonb_array_elements(
            COALESCE(v_artifact.artifact_content->'volatile_queries', '[]'::jsonb)
        ) AS q
    LOOP
        v_age_hours := EXTRACT(EPOCH FROM (
            NOW() - (v_query.q->>'last_verified_at')::TIMESTAMPTZ
        )) / 3600;
        
        IF v_age_hours > COALESCE((v_query.q->>'staleness_threshold_hours')::DECIMAL, 168) THEN
            v_stale_count := v_stale_count + 1;
            IF v_age_hours > v_oldest_age THEN
                v_oldest_age := v_age_hours;
            END IF;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_stale_count > 0,
        v_stale_count,
        v_oldest_age;
END;
$$ LANGUAGE plpgsql;

-- Update artifact validation status based on staleness
CREATE OR REPLACE FUNCTION update_decision_artifact_staleness_status()
RETURNS INT AS $$
DECLARE
    v_updated INT := 0;
    v_artifact RECORD;
    v_staleness RECORD;
BEGIN
    FOR v_artifact IN 
        SELECT id FROM decision_artifacts 
        WHERE status = 'active' AND validation_status != 'invalidated'
    LOOP
        SELECT * INTO v_staleness 
        FROM check_decision_artifact_staleness(v_artifact.id);
        
        IF v_staleness.is_stale AND v_staleness.stale_query_count > 0 THEN
            UPDATE decision_artifacts 
            SET validation_status = 'stale'
            WHERE id = v_artifact.id AND validation_status = 'fresh';
            
            IF FOUND THEN
                v_updated := v_updated + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Utility Views
-- ============================================================================

-- Active artifacts with metrics
CREATE OR REPLACE VIEW decision_artifacts_summary AS
SELECT 
    da.id,
    da.tenant_id,
    da.user_id,
    da.conversation_id,
    da.title,
    da.status,
    da.validation_status,
    da.version,
    da.extraction_confidence,
    da.phi_detected,
    da.pii_detected,
    da.primary_domain,
    da.created_at,
    da.updated_at,
    jsonb_array_length(COALESCE(da.artifact_content->'claims', '[]'::jsonb)) as claim_count,
    jsonb_array_length(COALESCE(da.artifact_content->'dissent_events', '[]'::jsonb)) as dissent_count,
    jsonb_array_length(COALESCE(da.artifact_content->'volatile_queries', '[]'::jsonb)) as volatile_query_count,
    (da.artifact_content->'metrics'->>'overall_confidence')::DECIMAL as overall_confidence,
    (da.artifact_content->'metrics'->>'overall_risk')::DECIMAL as overall_risk
FROM decision_artifacts da
WHERE da.status = 'active';

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION create_decision_artifact_version IS 'Creates a new version of an artifact, freezing the current version';
COMMENT ON FUNCTION get_decision_artifact_version_history IS 'Returns the complete version history for an artifact';
COMMENT ON FUNCTION check_decision_artifact_staleness IS 'Checks if any volatile queries in the artifact have exceeded their staleness threshold';
COMMENT ON VIEW decision_artifacts_summary IS 'Summary view of active decision artifacts with extracted metrics';
