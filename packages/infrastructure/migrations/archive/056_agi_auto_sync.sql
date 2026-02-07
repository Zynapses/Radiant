-- Migration: 056_agi_auto_sync.sql
-- RADIANT v4.18.0 - Auto-sync AGI Orchestration with Model Registry
-- Automatically updates orchestration when models, providers, or self-hosted models change

-- ============================================================================
-- MODEL CHANGE EVENTS - Track all model registry changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_registry_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event info
    event_type VARCHAR(50) NOT NULL, -- 'model_added', 'model_updated', 'model_removed', 'provider_added', 'provider_health_changed'
    
    -- Source
    source_table VARCHAR(100) NOT NULL,
    source_id VARCHAR(200),
    
    -- Change details
    model_id VARCHAR(200),
    provider VARCHAR(100),
    change_details JSONB DEFAULT '{}',
    
    -- Processing status
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_model_registry_events_unprocessed ON model_registry_events(processed, created_at) 
    WHERE processed = false;
CREATE INDEX idx_model_registry_events_model ON model_registry_events(model_id);

-- ============================================================================
-- AUTO-SYNC FUNCTIONS
-- ============================================================================

-- Analyze model capabilities and suggest specialties
CREATE OR REPLACE FUNCTION analyze_model_specialties(p_model_id VARCHAR, p_capabilities TEXT[])
RETURNS TEXT[] AS $$
DECLARE
    v_suggested_specialties TEXT[] := '{}';
    v_cap TEXT;
BEGIN
    FOREACH v_cap IN ARRAY p_capabilities LOOP
        -- Map capabilities to specialties
        CASE LOWER(v_cap)
            WHEN 'reasoning' THEN v_suggested_specialties := array_append(v_suggested_specialties, 'deep_reasoning');
            WHEN 'math' THEN v_suggested_specialties := array_append(v_suggested_specialties, 'math_computation');
            WHEN 'coding' THEN 
                v_suggested_specialties := array_append(v_suggested_specialties, 'code_generation');
                v_suggested_specialties := array_append(v_suggested_specialties, 'code_review');
                v_suggested_specialties := array_append(v_suggested_specialties, 'code_explanation');
            WHEN 'vision' THEN v_suggested_specialties := array_append(v_suggested_specialties, 'image_analysis');
            WHEN 'creative' THEN 
                v_suggested_specialties := array_append(v_suggested_specialties, 'creative_writing');
                v_suggested_specialties := array_append(v_suggested_specialties, 'content_generation');
            WHEN 'multilingual' THEN v_suggested_specialties := array_append(v_suggested_specialties, 'translation');
            WHEN 'fast' THEN 
                v_suggested_specialties := array_append(v_suggested_specialties, 'quick_answer');
                v_suggested_specialties := array_append(v_suggested_specialties, 'classification');
            WHEN 'efficient' THEN 
                v_suggested_specialties := array_append(v_suggested_specialties, 'quick_answer');
                v_suggested_specialties := array_append(v_suggested_specialties, 'summarization');
            WHEN 'long-context' THEN v_suggested_specialties := array_append(v_suggested_specialties, 'summarization');
            WHEN 'analysis' THEN 
                v_suggested_specialties := array_append(v_suggested_specialties, 'scientific_analysis');
                v_suggested_specialties := array_append(v_suggested_specialties, 'deep_reasoning');
            WHEN 'planning' THEN v_suggested_specialties := array_append(v_suggested_specialties, 'deep_reasoning');
            WHEN 'language' THEN v_suggested_specialties := array_append(v_suggested_specialties, 'content_generation');
            WHEN 'general' THEN 
                v_suggested_specialties := array_append(v_suggested_specialties, 'quick_answer');
                v_suggested_specialties := array_append(v_suggested_specialties, 'content_generation');
            ELSE NULL;
        END CASE;
    END LOOP;
    
    -- Return unique specialties
    RETURN ARRAY(SELECT DISTINCT unnest(v_suggested_specialties));
END;
$$ LANGUAGE plpgsql;

-- Register new model with orchestration system
CREATE OR REPLACE FUNCTION register_model_with_orchestration(
    p_model_id VARCHAR,
    p_provider VARCHAR,
    p_source VARCHAR, -- 'external' or 'self-hosted'
    p_capabilities TEXT[],
    p_is_fast BOOLEAN DEFAULT false,
    p_quality_tier INTEGER DEFAULT 2 -- 1=premium, 2=standard, 3=economy
)
RETURNS void AS $$
DECLARE
    v_specialties TEXT[];
    v_specialty TEXT;
    v_current_models TEXT[];
    v_position INTEGER;
BEGIN
    -- Analyze capabilities to determine specialties
    v_specialties := analyze_model_specialties(p_model_id, p_capabilities);
    
    -- Register model with each relevant specialty
    FOREACH v_specialty IN ARRAY v_specialties LOOP
        -- Get current models for this specialty
        SELECT preferred_models INTO v_current_models 
        FROM model_specialties WHERE name = v_specialty;
        
        IF v_current_models IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Skip if already registered
        IF p_model_id = ANY(v_current_models) THEN
            CONTINUE;
        END IF;
        
        -- Determine position based on quality tier and source
        IF p_quality_tier = 1 THEN
            -- Premium models go to front
            v_position := 1;
        ELSIF p_source = 'self-hosted' THEN
            -- Self-hosted models go after top 2
            v_position := LEAST(3, array_length(v_current_models, 1) + 1);
        ELSE
            -- Standard models go to middle/end
            v_position := LEAST(array_length(v_current_models, 1) + 1, 5);
        END IF;
        
        -- Insert at position
        v_current_models := array_cat(
            v_current_models[1:v_position-1],
            ARRAY[p_model_id] || v_current_models[v_position:]
        );
        
        -- Limit to top 5 preferred models
        v_current_models := v_current_models[1:5];
        
        -- Update specialty
        UPDATE model_specialties 
        SET preferred_models = v_current_models
        WHERE name = v_specialty;
        
        -- Initialize performance tracking
        INSERT INTO model_specialty_performance (model_id, specialty_name, avg_quality_score, specialty_rank)
        VALUES (p_model_id, v_specialty, 
                CASE p_quality_tier WHEN 1 THEN 0.85 WHEN 2 THEN 0.75 ELSE 0.65 END,
                v_position)
        ON CONFLICT (model_id, specialty_name) DO NOTHING;
    END LOOP;
    
    -- If self-hosted, create/update pool entry
    IF p_source = 'self-hosted' THEN
        INSERT INTO self_hosted_model_pools (tenant_id, name, model_id, thermal_state)
        VALUES (NULL, p_model_id, p_model_id, 'COLD')
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Log the registration
    INSERT INTO model_registry_events (event_type, source_table, model_id, provider, change_details, processed, processed_at)
    VALUES ('model_registered_orchestration', 'orchestration_sync', p_model_id, p_provider, 
            jsonb_build_object('specialties', v_specialties, 'source', p_source, 'quality_tier', p_quality_tier),
            true, NOW());
END;
$$ LANGUAGE plpgsql;

-- Remove model from orchestration system
CREATE OR REPLACE FUNCTION unregister_model_from_orchestration(p_model_id VARCHAR)
RETURNS void AS $$
DECLARE
    v_specialty RECORD;
BEGIN
    -- Remove from all specialty preferred/fallback lists
    FOR v_specialty IN SELECT specialty_id, name, preferred_models, fallback_models FROM model_specialties LOOP
        IF p_model_id = ANY(v_specialty.preferred_models) THEN
            UPDATE model_specialties 
            SET preferred_models = array_remove(preferred_models, p_model_id)
            WHERE specialty_id = v_specialty.specialty_id;
        END IF;
        
        IF p_model_id = ANY(v_specialty.fallback_models) THEN
            UPDATE model_specialties 
            SET fallback_models = array_remove(fallback_models, p_model_id)
            WHERE specialty_id = v_specialty.specialty_id;
        END IF;
    END LOOP;
    
    -- Remove performance tracking
    DELETE FROM model_specialty_performance WHERE model_id = p_model_id;
    
    -- Remove self-hosted pool entry
    DELETE FROM self_hosted_model_pools WHERE model_id = p_model_id;
    
    -- Log the removal
    INSERT INTO model_registry_events (event_type, source_table, model_id, change_details, processed, processed_at)
    VALUES ('model_unregistered_orchestration', 'orchestration_sync', p_model_id, 
            jsonb_build_object('action', 'removed'), true, NOW());
END;
$$ LANGUAGE plpgsql;

-- Sync all models from unified registry to orchestration
CREATE OR REPLACE FUNCTION sync_orchestration_from_registry()
RETURNS TABLE(models_synced INTEGER, models_removed INTEGER, errors TEXT[]) AS $$
DECLARE
    v_model RECORD;
    v_synced INTEGER := 0;
    v_removed INTEGER := 0;
    v_errors TEXT[] := '{}';
    v_capabilities TEXT[];
    v_quality_tier INTEGER;
BEGIN
    -- Sync enabled models from unified registry
    FOR v_model IN 
        SELECT model_id, provider, source, capabilities, 
               CASE 
                   WHEN input_price_per_1m > 10 THEN 1 -- Premium
                   WHEN input_price_per_1m > 1 THEN 2 -- Standard
                   ELSE 3 -- Economy
               END as quality_tier
        FROM unified_model_registry 
        WHERE enabled = true AND deprecated = false
    LOOP
        BEGIN
            v_capabilities := COALESCE(v_model.capabilities, '{}');
            PERFORM register_model_with_orchestration(
                v_model.model_id,
                v_model.provider,
                v_model.source,
                v_capabilities,
                'fast' = ANY(v_capabilities),
                v_model.quality_tier
            );
            v_synced := v_synced + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, v_model.model_id || ': ' || SQLERRM);
        END;
    END LOOP;
    
    -- Remove disabled/deprecated models from orchestration
    FOR v_model IN
        SELECT DISTINCT msp.model_id 
        FROM model_specialty_performance msp
        LEFT JOIN unified_model_registry umr ON msp.model_id = umr.model_id
        WHERE umr.model_id IS NULL 
           OR umr.enabled = false 
           OR umr.deprecated = true
    LOOP
        BEGIN
            PERFORM unregister_model_from_orchestration(v_model.model_id);
            v_removed := v_removed + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 'Remove ' || v_model.model_id || ': ' || SQLERRM);
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_synced, v_removed, v_errors;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS - Auto-sync on model registry changes
-- ============================================================================

-- Trigger function for unified_model_registry changes
CREATE OR REPLACE FUNCTION on_model_registry_change()
RETURNS TRIGGER AS $$
DECLARE
    v_capabilities TEXT[];
    v_quality_tier INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Log the event
        INSERT INTO model_registry_events (event_type, source_table, source_id, model_id, provider, change_details)
        VALUES ('model_added', 'unified_model_registry', NEW.id::VARCHAR, NEW.model_id, NEW.provider,
                jsonb_build_object('source', NEW.source, 'capabilities', NEW.capabilities));
        
        -- Auto-register if enabled and not deprecated
        IF NEW.enabled AND NOT NEW.deprecated THEN
            v_capabilities := COALESCE(NEW.capabilities, '{}');
            v_quality_tier := CASE 
                WHEN NEW.input_price_per_1m > 10 THEN 1
                WHEN NEW.input_price_per_1m > 1 THEN 2
                ELSE 3
            END;
            
            PERFORM register_model_with_orchestration(
                NEW.model_id, NEW.provider, NEW.source, v_capabilities,
                'fast' = ANY(v_capabilities), v_quality_tier
            );
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log the event
        INSERT INTO model_registry_events (event_type, source_table, source_id, model_id, provider, change_details)
        VALUES ('model_updated', 'unified_model_registry', NEW.id::VARCHAR, NEW.model_id, NEW.provider,
                jsonb_build_object(
                    'enabled_changed', OLD.enabled IS DISTINCT FROM NEW.enabled,
                    'deprecated_changed', OLD.deprecated IS DISTINCT FROM NEW.deprecated,
                    'capabilities_changed', OLD.capabilities IS DISTINCT FROM NEW.capabilities
                ));
        
        -- Handle enable/disable/deprecate changes
        IF (OLD.enabled AND NOT NEW.enabled) OR (NOT OLD.deprecated AND NEW.deprecated) THEN
            -- Model disabled or deprecated - remove from orchestration
            PERFORM unregister_model_from_orchestration(NEW.model_id);
        ELSIF (NOT OLD.enabled AND NEW.enabled) OR (OLD.deprecated AND NOT NEW.deprecated) THEN
            -- Model enabled or un-deprecated - add to orchestration
            v_capabilities := COALESCE(NEW.capabilities, '{}');
            v_quality_tier := CASE 
                WHEN NEW.input_price_per_1m > 10 THEN 1
                WHEN NEW.input_price_per_1m > 1 THEN 2
                ELSE 3
            END;
            
            PERFORM register_model_with_orchestration(
                NEW.model_id, NEW.provider, NEW.source, v_capabilities,
                'fast' = ANY(v_capabilities), v_quality_tier
            );
        ELSIF OLD.capabilities IS DISTINCT FROM NEW.capabilities THEN
            -- Capabilities changed - re-register
            PERFORM unregister_model_from_orchestration(NEW.model_id);
            
            v_capabilities := COALESCE(NEW.capabilities, '{}');
            v_quality_tier := CASE 
                WHEN NEW.input_price_per_1m > 10 THEN 1
                WHEN NEW.input_price_per_1m > 1 THEN 2
                ELSE 3
            END;
            
            PERFORM register_model_with_orchestration(
                NEW.model_id, NEW.provider, NEW.source, v_capabilities,
                'fast' = ANY(v_capabilities), v_quality_tier
            );
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Log the event
        INSERT INTO model_registry_events (event_type, source_table, source_id, model_id, provider, change_details)
        VALUES ('model_removed', 'unified_model_registry', OLD.id::VARCHAR, OLD.model_id, OLD.provider,
                jsonb_build_object('removed', true));
        
        -- Remove from orchestration
        PERFORM unregister_model_from_orchestration(OLD.model_id);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on unified_model_registry
DROP TRIGGER IF EXISTS unified_model_registry_orchestration_sync ON unified_model_registry;
CREATE TRIGGER unified_model_registry_orchestration_sync
    AFTER INSERT OR UPDATE OR DELETE ON unified_model_registry
    FOR EACH ROW EXECUTE FUNCTION on_model_registry_change();

-- Trigger function for provider_health changes
CREATE OR REPLACE FUNCTION on_provider_health_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log significant health changes
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO model_registry_events (event_type, source_table, source_id, provider, change_details)
        VALUES ('provider_health_changed', 'provider_health', NEW.id::VARCHAR, NEW.provider_id,
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        
        -- If provider became unhealthy, we might want to adjust routing
        -- This is handled by the orchestrator at runtime, but we log for auditing
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on provider_health
DROP TRIGGER IF EXISTS provider_health_orchestration_notify ON provider_health;
CREATE TRIGGER provider_health_orchestration_notify
    AFTER UPDATE ON provider_health
    FOR EACH ROW EXECUTE FUNCTION on_provider_health_change();

-- Trigger function for self-hosted model changes
CREATE OR REPLACE FUNCTION on_self_hosted_model_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO model_registry_events (event_type, source_table, source_id, model_id, change_details)
        VALUES ('self_hosted_added', 'self_hosted_model_pools', NEW.pool_id::VARCHAR, NEW.model_id,
                jsonb_build_object('thermal_state', NEW.thermal_state));
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log thermal state changes
        IF NEW.thermal_state IS DISTINCT FROM OLD.thermal_state THEN
            INSERT INTO model_registry_events (event_type, source_table, source_id, model_id, change_details)
            VALUES ('self_hosted_thermal_changed', 'self_hosted_model_pools', NEW.pool_id::VARCHAR, NEW.model_id,
                    jsonb_build_object('old_state', OLD.thermal_state, 'new_state', NEW.thermal_state));
        END IF;
        
        -- Log instance count changes
        IF NEW.healthy_instances IS DISTINCT FROM OLD.healthy_instances THEN
            INSERT INTO model_registry_events (event_type, source_table, source_id, model_id, change_details)
            VALUES ('self_hosted_instances_changed', 'self_hosted_model_pools', NEW.pool_id::VARCHAR, NEW.model_id,
                    jsonb_build_object('old_instances', OLD.healthy_instances, 'new_instances', NEW.healthy_instances));
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO model_registry_events (event_type, source_table, source_id, model_id, change_details)
        VALUES ('self_hosted_removed', 'self_hosted_model_pools', OLD.pool_id::VARCHAR, OLD.model_id,
                jsonb_build_object('removed', true));
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on self_hosted_model_pools
DROP TRIGGER IF EXISTS self_hosted_model_pools_orchestration_sync ON self_hosted_model_pools;
CREATE TRIGGER self_hosted_model_pools_orchestration_sync
    AFTER INSERT OR UPDATE OR DELETE ON self_hosted_model_pools
    FOR EACH ROW EXECUTE FUNCTION on_self_hosted_model_change();

-- ============================================================================
-- SCHEDULED SYNC JOB (for catching any missed changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestration_sync_log (
    sync_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'triggered'
    models_synced INTEGER DEFAULT 0,
    models_removed INTEGER DEFAULT 0,
    errors TEXT[] DEFAULT '{}',
    duration_ms INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Function to run periodic full sync
CREATE OR REPLACE FUNCTION run_orchestration_sync(p_sync_type VARCHAR DEFAULT 'incremental')
RETURNS UUID AS $$
DECLARE
    v_sync_id UUID;
    v_start TIMESTAMPTZ := NOW();
    v_result RECORD;
BEGIN
    INSERT INTO orchestration_sync_log (sync_type, started_at)
    VALUES (p_sync_type, v_start)
    RETURNING sync_id INTO v_sync_id;
    
    -- Run sync
    SELECT * INTO v_result FROM sync_orchestration_from_registry();
    
    -- Update log
    UPDATE orchestration_sync_log SET
        models_synced = v_result.models_synced,
        models_removed = v_result.models_removed,
        errors = v_result.errors,
        duration_ms = EXTRACT(MILLISECONDS FROM NOW() - v_start)::INTEGER,
        completed_at = NOW()
    WHERE sync_id = v_sync_id;
    
    RETURN v_sync_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- NOTIFICATION SYSTEM - For real-time updates
-- ============================================================================

-- Create notification channel
CREATE OR REPLACE FUNCTION notify_orchestration_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('orchestration_changes', json_build_object(
        'event_type', NEW.event_type,
        'model_id', NEW.model_id,
        'provider', NEW.provider,
        'timestamp', NEW.created_at
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS model_registry_events_notify ON model_registry_events;
CREATE TRIGGER model_registry_events_notify
    AFTER INSERT ON model_registry_events
    FOR EACH ROW EXECUTE FUNCTION notify_orchestration_change();

-- ============================================================================
-- INITIAL SYNC - Run full sync on migration
-- ============================================================================

DO $$
DECLARE
    v_sync_id UUID;
BEGIN
    SELECT run_orchestration_sync('initial_migration') INTO v_sync_id;
    RAISE NOTICE 'Initial orchestration sync completed: %', v_sync_id;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE model_registry_events IS 'Tracks all changes to model registry for orchestration sync';
COMMENT ON TABLE orchestration_sync_log IS 'Log of orchestration sync operations';
COMMENT ON FUNCTION register_model_with_orchestration IS 'Registers a model with the AGI orchestration system';
COMMENT ON FUNCTION unregister_model_from_orchestration IS 'Removes a model from AGI orchestration';
COMMENT ON FUNCTION sync_orchestration_from_registry IS 'Full sync of model registry to orchestration';
COMMENT ON FUNCTION analyze_model_specialties IS 'Maps model capabilities to orchestration specialties';
