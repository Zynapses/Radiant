-- ============================================================================
-- RADIANT v7.11.0 - Inference Response Cache & Heterogeneous Model Consensus
-- Migration: V2026_02_05_005
--
-- This migration creates the database schema for two new features:
--
-- 1. INFERENCE RESPONSE CACHE
--    Hash-based semantic deduplication for AI inference calls.
--    Stores prompt+model+params → response mappings to avoid redundant API calls.
--    Reduces cost by serving identical requests from cache.
--    Tenant-isolated: cache keys include tenant_id to prevent cross-tenant leaks.
--
-- 2. HETEROGENEOUS MODEL CONSENSUS
--    Cross-model agreement scoring using diverse AI providers.
--    Extends self_consistency from single-model to multi-model consensus.
--    Stores evaluation results, pairwise agreement scores, and audit trails.
--
-- Tables created:
--   inference_cache_config          - Per-tenant cache configuration
--   inference_cache_entries         - Cached responses with TTL and hit tracking
--   inference_cache_events          - Audit log of all cache operations
--   inference_cache_metrics         - Aggregated cache performance metrics
--   consensus_config                - Per-tenant consensus configuration
--   consensus_evaluations           - Complete consensus evaluation results
--   consensus_responses             - Individual model responses per evaluation
--   consensus_pairwise_agreements   - Pairwise agreement scores between models
--   consensus_metrics               - Aggregated consensus performance metrics
--
-- Indexes:
--   All tables have tenant_id + created_at indexes for efficient tenant queries.
--   Cache entries have a unique index on cache_key for O(1) lookups.
--   Consensus evaluations have indexes on agreement scores for dashboard queries.
--
-- RLS:
--   All tables use app.current_tenant_id for row-level security.
-- ============================================================================

-- ============================================================================
-- PART 1: INFERENCE RESPONSE CACHE
-- ============================================================================

-- 1.1 Cache Configuration (Per-Tenant)
-- Stores per-tenant settings for cache behavior, TTL, exclusions, etc.
CREATE TABLE IF NOT EXISTS inference_cache_config (
    tenant_id           UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    default_ttl_seconds INTEGER NOT NULL DEFAULT 604800,  -- 7 days
    max_entries          INTEGER NOT NULL DEFAULT 10000,
    max_response_size_bytes INTEGER NOT NULL DEFAULT 65536,  -- 64KB
    min_prompt_length    INTEGER NOT NULL DEFAULT 20,
    hash_algorithm       VARCHAR(10) NOT NULL DEFAULT 'sha256',
    excluded_task_types  JSONB NOT NULL DEFAULT '["creative"]'::jsonb,
    excluded_models      JSONB NOT NULL DEFAULT '["perplexity/llama-3.1-sonar-large","perplexity/llama-3.1-sonar-small"]'::jsonb,
    max_temperature      NUMERIC(3,2) NOT NULL DEFAULT 0.30,
    cache_pii_responses  BOOLEAN NOT NULL DEFAULT false,
    l1_cache_size        INTEGER NOT NULL DEFAULT 100,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by           VARCHAR(255) NOT NULL DEFAULT 'system'
);

COMMENT ON TABLE inference_cache_config IS 'Per-tenant configuration for the inference response cache. Controls caching behavior, TTL, exclusions, and capacity limits.';
COMMENT ON COLUMN inference_cache_config.default_ttl_seconds IS 'Default time-to-live for cache entries in seconds. Default: 604800 (7 days).';
COMMENT ON COLUMN inference_cache_config.max_entries IS 'Maximum number of cache entries per tenant. Oldest entries are evicted when exceeded.';
COMMENT ON COLUMN inference_cache_config.max_temperature IS 'Maximum temperature for cacheable responses. Higher temperatures produce varied outputs, making caching counterproductive.';
COMMENT ON COLUMN inference_cache_config.cache_pii_responses IS 'Whether to cache responses containing detected PII patterns. Default: false for privacy.';
COMMENT ON COLUMN inference_cache_config.l1_cache_size IS 'Number of entries in the in-memory L1 cache per Lambda instance. Set to 0 to disable.';

-- 1.2 Cache Entries
-- The actual cached responses. Primary key is the SHA-256 cache key.
CREATE TABLE IF NOT EXISTS inference_cache_entries (
    cache_key           VARCHAR(128) NOT NULL,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id            VARCHAR(255) NOT NULL,
    prompt_hash         VARCHAR(128) NOT NULL,
    prompt_length       INTEGER NOT NULL,
    system_prompt_hash  VARCHAR(128),
    temperature         NUMERIC(4,3) NOT NULL,
    max_tokens          INTEGER NOT NULL,
    cached_response     TEXT NOT NULL,
    input_tokens        INTEGER NOT NULL DEFAULT 0,
    output_tokens       INTEGER NOT NULL DEFAULT 0,
    original_cost_usd   NUMERIC(12,8) NOT NULL DEFAULT 0,
    original_latency_ms INTEGER NOT NULL DEFAULT 0,
    provider            VARCHAR(50) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    hit_count           INTEGER NOT NULL DEFAULT 0,
    total_cost_saved_usd NUMERIC(12,8) NOT NULL DEFAULT 0,
    total_latency_saved_ms BIGINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    invalidated_at      TIMESTAMPTZ,
    invalidation_reason VARCHAR(30),
    PRIMARY KEY (cache_key, tenant_id)
);

COMMENT ON TABLE inference_cache_entries IS 'Cached inference responses. Each entry maps a prompt+model+params hash to a stored response. Tenant-isolated via composite primary key.';
COMMENT ON COLUMN inference_cache_entries.cache_key IS 'SHA-256 hash of: tenantId + modelId + prompt + systemPrompt + temperature + maxTokens';
COMMENT ON COLUMN inference_cache_entries.hit_count IS 'Number of times this entry has been served from cache. Used for LRU eviction and cost tracking.';
COMMENT ON COLUMN inference_cache_entries.total_cost_saved_usd IS 'Cumulative cost saved by serving this entry from cache (hit_count × original_cost_usd).';
COMMENT ON COLUMN inference_cache_entries.status IS 'Lifecycle: active → expired/invalidated/evicted';

-- Index for fast cache lookups (the hot path)
CREATE INDEX IF NOT EXISTS idx_cache_entries_lookup
    ON inference_cache_entries (cache_key, tenant_id, status)
    WHERE status = 'active';

-- Index for TTL expiration cleanup
CREATE INDEX IF NOT EXISTS idx_cache_entries_expiry
    ON inference_cache_entries (expires_at)
    WHERE status = 'active';

-- Index for tenant-level queries (dashboard, metrics)
CREATE INDEX IF NOT EXISTS idx_cache_entries_tenant
    ON inference_cache_entries (tenant_id, created_at DESC);

-- Index for model-level analytics
CREATE INDEX IF NOT EXISTS idx_cache_entries_model
    ON inference_cache_entries (tenant_id, model_id, status);

-- Index for eviction (LRU: oldest last_accessed_at)
CREATE INDEX IF NOT EXISTS idx_cache_entries_lru
    ON inference_cache_entries (tenant_id, last_accessed_at ASC)
    WHERE status = 'active';

-- 1.3 Cache Events (Audit Log)
-- Every cache operation is logged for transparency and debugging.
CREATE TABLE IF NOT EXISTS inference_cache_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cache_key           VARCHAR(128) NOT NULL,
    event_type          VARCHAR(20) NOT NULL,  -- hit, miss, store, evict, invalidate, purge
    model_id            VARCHAR(255) NOT NULL,
    prompt_hash         VARCHAR(128) NOT NULL,
    response_time_ms    INTEGER NOT NULL DEFAULT 0,
    cost_saved_usd      NUMERIC(12,8) NOT NULL DEFAULT 0,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE inference_cache_events IS 'Audit log of all cache operations. Used for debugging, metrics aggregation, and compliance.';

-- Partition-friendly index for time-range queries
CREATE INDEX IF NOT EXISTS idx_cache_events_tenant_time
    ON inference_cache_events (tenant_id, created_at DESC);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_cache_events_type
    ON inference_cache_events (event_type, created_at DESC);

-- 1.4 Cache Metrics (Aggregated)
-- Pre-computed metrics for the dashboard. Updated by a periodic job.
CREATE TABLE IF NOT EXISTS inference_cache_metrics (
    metric_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = global
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    total_requests      INTEGER NOT NULL DEFAULT 0,
    cache_hits          INTEGER NOT NULL DEFAULT 0,
    cache_misses        INTEGER NOT NULL DEFAULT 0,
    hit_rate            NUMERIC(5,4) NOT NULL DEFAULT 0,
    total_cost_saved_usd NUMERIC(12,8) NOT NULL DEFAULT 0,
    avg_cost_per_hit_usd NUMERIC(12,8) NOT NULL DEFAULT 0,
    total_latency_saved_ms BIGINT NOT NULL DEFAULT 0,
    avg_latency_reduction_ms INTEGER NOT NULL DEFAULT 0,
    avg_cache_response_time_ms INTEGER NOT NULL DEFAULT 0,
    total_entries       INTEGER NOT NULL DEFAULT 0,
    active_entries      INTEGER NOT NULL DEFAULT 0,
    expired_entries     INTEGER NOT NULL DEFAULT 0,
    total_storage_bytes BIGINT NOT NULL DEFAULT 0,
    evictions           INTEGER NOT NULL DEFAULT 0,
    invalidations       INTEGER NOT NULL DEFAULT 0,
    top_cached_models   JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE inference_cache_metrics IS 'Aggregated cache performance metrics. Computed periodically for dashboard display.';

CREATE INDEX IF NOT EXISTS idx_cache_metrics_tenant_period
    ON inference_cache_metrics (tenant_id, period_start DESC);

-- ============================================================================
-- PART 2: HETEROGENEOUS MODEL CONSENSUS
-- ============================================================================

-- 2.1 Consensus Configuration (Per-Tenant)
CREATE TABLE IF NOT EXISTS consensus_config (
    tenant_id               UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled                 BOOLEAN NOT NULL DEFAULT true,
    min_models              INTEGER NOT NULL DEFAULT 3,
    max_models              INTEGER NOT NULL DEFAULT 5,
    min_providers           INTEGER NOT NULL DEFAULT 2,
    max_cost_per_eval_usd   NUMERIC(8,4) NOT NULL DEFAULT 0.50,
    max_latency_ms          INTEGER NOT NULL DEFAULT 30000,
    reflexion_threshold     NUMERIC(3,2) NOT NULL DEFAULT 0.60,
    hallucination_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.40,
    winner_selection        VARCHAR(30) NOT NULL DEFAULT 'quality_weighted',
    default_panel           JSONB NOT NULL DEFAULT '[]'::jsonb,
    auto_apply_task_types   JSONB NOT NULL DEFAULT '[]'::jsonb,
    use_embedding_similarity BOOLEAN NOT NULL DEFAULT true,
    embedding_model         VARCHAR(255) NOT NULL DEFAULT 'amazon/titan-embed-text',
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by              VARCHAR(255) NOT NULL DEFAULT 'system'
);

COMMENT ON TABLE consensus_config IS 'Per-tenant configuration for heterogeneous model consensus. Controls model selection, agreement thresholds, and cost limits.';
COMMENT ON COLUMN consensus_config.min_models IS 'Minimum number of models to query. Default: 3 for meaningful majority voting.';
COMMENT ON COLUMN consensus_config.min_providers IS 'Minimum unique providers required. Default: 2 for cross-provider validation.';
COMMENT ON COLUMN consensus_config.reflexion_threshold IS 'Agreement below this triggers a reflexion/self-correction loop.';
COMMENT ON COLUMN consensus_config.hallucination_threshold IS 'Agreement below this flags the response as potentially hallucinated.';
COMMENT ON COLUMN consensus_config.winner_selection IS 'Strategy: majority_vote, quality_weighted, cost_weighted, highest_quality';

-- 2.2 Consensus Evaluations
-- Stores the complete result of each consensus evaluation.
CREATE TABLE IF NOT EXISTS consensus_evaluations (
    consensus_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id                     UUID,
    prompt_hash                 VARCHAR(128) NOT NULL,
    prompt_length               INTEGER NOT NULL,
    task_type                   VARCHAR(50),
    participant_count           INTEGER NOT NULL,
    provider_count              INTEGER NOT NULL,
    architecture_family_count   INTEGER NOT NULL,
    overall_agreement           NUMERIC(5,4) NOT NULL DEFAULT 0,
    cross_provider_agreement    NUMERIC(5,4) NOT NULL DEFAULT 0,
    cross_architecture_agreement NUMERIC(5,4) NOT NULL DEFAULT 0,
    confidence                  NUMERIC(5,4) NOT NULL DEFAULT 0,
    winning_response            TEXT NOT NULL,
    winning_model               VARCHAR(255) NOT NULL,
    winning_provider            VARCHAR(50) NOT NULL,
    agreement_count             INTEGER NOT NULL DEFAULT 0,
    dissenting_models           JSONB NOT NULL DEFAULT '[]'::jsonb,
    hallucination_risk          NUMERIC(5,4) NOT NULL DEFAULT 0,
    trigger_reflexion           BOOLEAN NOT NULL DEFAULT false,
    reflexion_reason            TEXT,
    total_cost_usd              NUMERIC(12,8) NOT NULL DEFAULT 0,
    total_latency_ms            INTEGER NOT NULL DEFAULT 0,
    scoring_latency_ms          INTEGER NOT NULL DEFAULT 0,
    total_tokens_used           INTEGER NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE consensus_evaluations IS 'Complete results of heterogeneous model consensus evaluations. Stores agreement scores, winning response, cost, and audit data.';
COMMENT ON COLUMN consensus_evaluations.overall_agreement IS 'Weighted mean of all pairwise semantic similarities (0.0-1.0).';
COMMENT ON COLUMN consensus_evaluations.cross_provider_agreement IS 'Agreement only between DIFFERENT providers. The most meaningful signal for correctness.';
COMMENT ON COLUMN consensus_evaluations.hallucination_risk IS '1.0 - crossProviderAgreement when agreement is low. Higher = more likely hallucinated.';
COMMENT ON COLUMN consensus_evaluations.trigger_reflexion IS 'True when agreement is below reflexion_threshold, indicating self-correction may be needed.';

-- Index for tenant dashboard queries
CREATE INDEX IF NOT EXISTS idx_consensus_eval_tenant
    ON consensus_evaluations (tenant_id, created_at DESC);

-- Index for agreement-based queries (finding low-confidence evaluations)
CREATE INDEX IF NOT EXISTS idx_consensus_eval_agreement
    ON consensus_evaluations (tenant_id, overall_agreement ASC);

-- Index for hallucination risk monitoring
CREATE INDEX IF NOT EXISTS idx_consensus_eval_hallucination
    ON consensus_evaluations (tenant_id, hallucination_risk DESC)
    WHERE hallucination_risk > 0.4;

-- 2.3 Individual Model Responses
-- Stores each model's response within an evaluation.
CREATE TABLE IF NOT EXISTS consensus_responses (
    response_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consensus_id        UUID NOT NULL REFERENCES consensus_evaluations(consensus_id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id            VARCHAR(255) NOT NULL,
    provider            VARCHAR(50) NOT NULL,
    architecture_family VARCHAR(50) NOT NULL,
    quality_tier        INTEGER NOT NULL DEFAULT 2,
    consensus_weight    NUMERIC(4,3) NOT NULL DEFAULT 0.5,
    response_text       TEXT NOT NULL,
    extracted_answer    TEXT NOT NULL,
    input_tokens        INTEGER NOT NULL DEFAULT 0,
    output_tokens       INTEGER NOT NULL DEFAULT 0,
    cost_usd            NUMERIC(12,8) NOT NULL DEFAULT 0,
    latency_ms          INTEGER NOT NULL DEFAULT 0,
    success             BOOLEAN NOT NULL DEFAULT true,
    error_message       TEXT,
    self_reported_confidence NUMERIC(4,3),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE consensus_responses IS 'Individual model responses within a consensus evaluation. Links to the parent evaluation via consensus_id.';

CREATE INDEX IF NOT EXISTS idx_consensus_responses_eval
    ON consensus_responses (consensus_id);

CREATE INDEX IF NOT EXISTS idx_consensus_responses_model
    ON consensus_responses (tenant_id, model_id, created_at DESC);

-- 2.4 Pairwise Agreement Scores
-- Stores the agreement score between each pair of models in an evaluation.
CREATE TABLE IF NOT EXISTS consensus_pairwise_agreements (
    agreement_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consensus_id        UUID NOT NULL REFERENCES consensus_evaluations(consensus_id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_a             VARCHAR(255) NOT NULL,
    model_b             VARCHAR(255) NOT NULL,
    provider_a          VARCHAR(50) NOT NULL,
    provider_b          VARCHAR(50) NOT NULL,
    semantic_similarity NUMERIC(5,4) NOT NULL DEFAULT 0,
    exact_match         BOOLEAN NOT NULL DEFAULT false,
    cross_provider      BOOLEAN NOT NULL DEFAULT false,
    cross_architecture  BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE consensus_pairwise_agreements IS 'Pairwise agreement scores between model pairs in a consensus evaluation. Used to compute overall and cross-provider agreement.';

CREATE INDEX IF NOT EXISTS idx_consensus_pairwise_eval
    ON consensus_pairwise_agreements (consensus_id);

CREATE INDEX IF NOT EXISTS idx_consensus_pairwise_cross
    ON consensus_pairwise_agreements (tenant_id, cross_provider)
    WHERE cross_provider = true;

-- 2.5 Consensus Metrics (Aggregated)
CREATE TABLE IF NOT EXISTS consensus_metrics (
    metric_id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = global
    period_start                TIMESTAMPTZ NOT NULL,
    period_end                  TIMESTAMPTZ NOT NULL,
    total_evaluations           INTEGER NOT NULL DEFAULT 0,
    avg_agreement               NUMERIC(5,4) NOT NULL DEFAULT 0,
    avg_cross_provider_agreement NUMERIC(5,4) NOT NULL DEFAULT 0,
    avg_confidence              NUMERIC(5,4) NOT NULL DEFAULT 0,
    avg_hallucination_risk      NUMERIC(5,4) NOT NULL DEFAULT 0,
    reflexion_trigger_count     INTEGER NOT NULL DEFAULT 0,
    total_cost_usd              NUMERIC(12,8) NOT NULL DEFAULT 0,
    avg_cost_per_eval_usd       NUMERIC(12,8) NOT NULL DEFAULT 0,
    avg_latency_ms              INTEGER NOT NULL DEFAULT 0,
    p95_latency_ms              INTEGER NOT NULL DEFAULT 0,
    model_participation         JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider_distribution       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE consensus_metrics IS 'Aggregated consensus performance metrics. Pre-computed for dashboard display.';

CREATE INDEX IF NOT EXISTS idx_consensus_metrics_tenant_period
    ON consensus_metrics (tenant_id, period_start DESC);

-- ============================================================================
-- PART 3: ROW-LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE inference_cache_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE inference_cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inference_cache_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inference_cache_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensus_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensus_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensus_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensus_pairwise_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensus_metrics ENABLE ROW LEVEL SECURITY;

-- Cache tables RLS policies
CREATE POLICY cache_config_tenant_isolation ON inference_cache_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY cache_entries_tenant_isolation ON inference_cache_entries
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY cache_events_tenant_isolation ON inference_cache_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY cache_metrics_tenant_isolation ON inference_cache_metrics
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Consensus tables RLS policies
CREATE POLICY consensus_config_tenant_isolation ON consensus_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consensus_eval_tenant_isolation ON consensus_evaluations
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consensus_responses_tenant_isolation ON consensus_responses
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consensus_pairwise_tenant_isolation ON consensus_pairwise_agreements
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consensus_metrics_tenant_isolation ON consensus_metrics
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- PART 4: HELPER FUNCTIONS
-- ============================================================================

-- Function to expire stale cache entries
CREATE OR REPLACE FUNCTION expire_stale_cache_entries()
RETURNS TABLE(expired_count INTEGER, freed_bytes BIGINT) AS $$
DECLARE
    v_expired INTEGER;
    v_freed BIGINT;
BEGIN
    WITH expired AS (
        UPDATE inference_cache_entries
        SET status = 'expired',
            invalidated_at = NOW(),
            invalidation_reason = 'ttl_expired'
        WHERE status = 'active'
          AND expires_at < NOW()
        RETURNING octet_length(cached_response)
    )
    SELECT COUNT(*)::INTEGER, COALESCE(SUM(octet_length), 0)::BIGINT
    INTO v_expired, v_freed
    FROM expired;

    RETURN QUERY SELECT v_expired, v_freed;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_stale_cache_entries IS 'Expires cache entries that have exceeded their TTL. Returns count of expired entries and bytes freed.';

-- Function to evict oldest entries when capacity is exceeded
CREATE OR REPLACE FUNCTION evict_cache_entries_for_tenant(
    p_tenant_id UUID,
    p_max_entries INTEGER DEFAULT 10000
)
RETURNS INTEGER AS $$
DECLARE
    v_current_count INTEGER;
    v_evict_count INTEGER;
    v_evicted INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_current_count
    FROM inference_cache_entries
    WHERE tenant_id = p_tenant_id AND status = 'active';

    IF v_current_count <= p_max_entries THEN
        RETURN 0;
    END IF;

    v_evict_count := v_current_count - p_max_entries + (p_max_entries / 10); -- Evict 10% extra buffer

    WITH to_evict AS (
        SELECT cache_key
        FROM inference_cache_entries
        WHERE tenant_id = p_tenant_id AND status = 'active'
        ORDER BY last_accessed_at ASC
        LIMIT v_evict_count
    )
    UPDATE inference_cache_entries
    SET status = 'evicted',
        invalidated_at = NOW(),
        invalidation_reason = 'capacity_eviction'
    WHERE tenant_id = p_tenant_id
      AND cache_key IN (SELECT cache_key FROM to_evict);

    GET DIAGNOSTICS v_evicted = ROW_COUNT;
    RETURN v_evicted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION evict_cache_entries_for_tenant IS 'LRU eviction: removes oldest-accessed cache entries when tenant exceeds capacity limit. Evicts 10% extra as buffer.';

-- Function to compute cache metrics for a tenant
CREATE OR REPLACE FUNCTION compute_cache_metrics(
    p_tenant_id UUID,
    p_period_hours INTEGER DEFAULT 24
)
RETURNS UUID AS $$
DECLARE
    v_metric_id UUID := gen_random_uuid();
    v_period_start TIMESTAMPTZ := NOW() - (p_period_hours || ' hours')::interval;
    v_period_end TIMESTAMPTZ := NOW();
BEGIN
    INSERT INTO inference_cache_metrics (
        metric_id, tenant_id, period_start, period_end,
        total_requests, cache_hits, cache_misses, hit_rate,
        total_cost_saved_usd, avg_cost_per_hit_usd,
        total_latency_saved_ms, avg_latency_reduction_ms,
        avg_cache_response_time_ms,
        total_entries, active_entries, expired_entries,
        total_storage_bytes, evictions, invalidations,
        top_cached_models
    )
    SELECT
        v_metric_id,
        p_tenant_id,
        v_period_start,
        v_period_end,
        COALESCE(hits.cnt + misses.cnt, 0),
        COALESCE(hits.cnt, 0),
        COALESCE(misses.cnt, 0),
        CASE WHEN COALESCE(hits.cnt + misses.cnt, 0) > 0
            THEN hits.cnt::NUMERIC / (hits.cnt + misses.cnt)
            ELSE 0 END,
        COALESCE(hits.cost_saved, 0),
        CASE WHEN hits.cnt > 0 THEN hits.cost_saved / hits.cnt ELSE 0 END,
        COALESCE(hits.latency_saved, 0),
        CASE WHEN hits.cnt > 0 THEN (hits.latency_saved / hits.cnt)::INTEGER ELSE 0 END,
        COALESCE(hits.avg_response_time, 0),
        entries.total_count,
        entries.active_count,
        entries.expired_count,
        COALESCE(entries.total_size, 0),
        COALESCE(evictions.cnt, 0),
        COALESCE(invalidations.cnt, 0),
        COALESCE(top_models.models, '[]'::jsonb)
    FROM
        (SELECT
            COUNT(*) as cnt,
            SUM(cost_saved_usd) as cost_saved,
            SUM(response_time_ms)::BIGINT as latency_saved,
            AVG(response_time_ms)::INTEGER as avg_response_time
         FROM inference_cache_events
         WHERE tenant_id = p_tenant_id
           AND event_type = 'hit'
           AND created_at BETWEEN v_period_start AND v_period_end
        ) hits,
        (SELECT COUNT(*) as cnt
         FROM inference_cache_events
         WHERE tenant_id = p_tenant_id
           AND event_type = 'miss'
           AND created_at BETWEEN v_period_start AND v_period_end
        ) misses,
        (SELECT
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE status = 'active') as active_count,
            COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
            SUM(octet_length(cached_response))::BIGINT as total_size
         FROM inference_cache_entries
         WHERE tenant_id = p_tenant_id
        ) entries,
        (SELECT COUNT(*) as cnt
         FROM inference_cache_events
         WHERE tenant_id = p_tenant_id
           AND event_type = 'evict'
           AND created_at BETWEEN v_period_start AND v_period_end
        ) evictions,
        (SELECT COUNT(*) as cnt
         FROM inference_cache_events
         WHERE tenant_id = p_tenant_id
           AND event_type = 'invalidate'
           AND created_at BETWEEN v_period_start AND v_period_end
        ) invalidations,
        (SELECT jsonb_agg(row_to_json(m)) as models
         FROM (
            SELECT model_id, COUNT(*) as hit_count, SUM(cost_saved_usd) as cost_saved_usd
            FROM inference_cache_events
            WHERE tenant_id = p_tenant_id
              AND event_type = 'hit'
              AND created_at BETWEEN v_period_start AND v_period_end
            GROUP BY model_id
            ORDER BY hit_count DESC
            LIMIT 10
         ) m
        ) top_models;

    RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION compute_cache_metrics IS 'Computes aggregated cache metrics for a tenant over a given period. Inserts result into inference_cache_metrics and returns the metric ID.';
