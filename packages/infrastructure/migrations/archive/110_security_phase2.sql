-- RADIANT v4.18.0 - Security Protection Methods Phase 2
-- Migration 110: Constitutional Classifiers, Behavioral Anomaly Detection, Drift Monitoring
-- ============================================================================

-- ============================================================================
-- CONSTITUTIONAL CLASSIFIER TABLES
-- Based on HarmBench/WildJailbreak datasets
-- ============================================================================

-- Harm category taxonomy (based on HarmBench 7 categories + OpenAI policy)
CREATE TABLE IF NOT EXISTS harm_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    severity_level INTEGER DEFAULT 5, -- 1-10 scale
    examples TEXT[], -- Example prompts for this category
    parent_category_id UUID REFERENCES harm_categories(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed harm categories (HarmBench + JailbreakBench taxonomy)
INSERT INTO harm_categories (category_code, category_name, description, severity_level) VALUES
    ('chem_bio', 'Chemical & Biological Weapons', 'Instructions for creating chemical or biological weapons', 10),
    ('cybercrime', 'Cybercrime & Hacking', 'Malware creation, hacking instructions, unauthorized access', 9),
    ('harassment', 'Harassment & Bullying', 'Targeted harassment, doxxing, intimidation', 7),
    ('illegal_activity', 'Illegal Activities', 'Drug manufacturing, weapons trafficking, human trafficking', 9),
    ('misinformation', 'Misinformation & Disinformation', 'Fake news generation, propaganda, election interference', 8),
    ('physical_harm', 'Physical Harm', 'Violence, self-harm, instructions for causing injury', 9),
    ('fraud', 'Fraud & Deception', 'Scams, phishing, identity theft', 8),
    ('copyright', 'Copyright Violation', 'Reproducing copyrighted content without permission', 5),
    ('privacy', 'Privacy Violation', 'PII extraction, stalking, surveillance', 7),
    ('sexual_content', 'Sexual Content', 'Explicit sexual content, CSAM references', 10),
    ('hate_speech', 'Hate Speech', 'Discrimination, slurs, extremist content', 8),
    ('self_harm', 'Self-Harm', 'Suicide instructions, eating disorders, self-injury', 10)
ON CONFLICT (category_code) DO NOTHING;

-- Constitutional classifier models registry
CREATE TABLE IF NOT EXISTS constitutional_classifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    classifier_name VARCHAR(255) NOT NULL,
    classifier_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(100) NOT NULL, -- 'harmbench_llama', 'custom_bert', 'ensemble'
    
    -- Model configuration
    model_config JSONB DEFAULT '{}',
    harm_categories TEXT[] DEFAULT '{}', -- Which categories this classifier handles
    
    -- Performance metrics
    precision_score DOUBLE PRECISION,
    recall_score DOUBLE PRECISION,
    f1_score DOUBLE PRECISION,
    false_positive_rate DOUBLE PRECISION,
    
    -- Training metadata
    training_dataset VARCHAR(255), -- 'harmbench', 'wildjailbreak', 'custom'
    training_samples INTEGER,
    last_trained_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'training', 'deprecated'
    is_default BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_classifier UNIQUE (tenant_id, classifier_name, classifier_version)
);

-- Classification results log
CREATE TABLE IF NOT EXISTS classification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    classifier_id UUID REFERENCES constitutional_classifiers(id),
    
    -- Input
    input_hash VARCHAR(64) NOT NULL, -- SHA256 of input
    input_type VARCHAR(50) NOT NULL, -- 'prompt', 'response', 'conversation'
    
    -- Results
    is_harmful BOOLEAN NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL,
    harm_categories JSONB DEFAULT '[]', -- [{category, score}]
    attack_type VARCHAR(100), -- 'jailbreak', 'injection', 'encoding', 'roleplay'
    
    -- Action taken
    action_taken VARCHAR(50), -- 'allowed', 'blocked', 'flagged', 'modified'
    
    -- Metadata
    latency_ms INTEGER,
    model_id VARCHAR(255),
    user_id UUID,
    request_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jailbreak pattern library (from WildJailbreak 5,700 tactic clusters)
CREATE TABLE IF NOT EXISTS jailbreak_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_name VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(100) NOT NULL, -- 'dan', 'roleplay', 'encoding', 'hypothetical', 'translation'
    
    -- Pattern definition
    pattern_regex TEXT, -- Regex for detection
    pattern_embedding VECTOR(1536), -- For semantic matching
    example_prompts TEXT[],
    
    -- Effectiveness tracking
    detection_count INTEGER DEFAULT 0,
    bypass_count INTEGER DEFAULT 0, -- Times it successfully bypassed
    last_seen_at TIMESTAMPTZ,
    
    -- Source
    source VARCHAR(100), -- 'wildjailbreak', 'harmbench', 'garak', 'manual'
    source_id VARCHAR(255),
    
    severity INTEGER DEFAULT 5, -- 1-10
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BEHAVIORAL ANOMALY DETECTION TABLES
-- Adapted from CIC-IDS2017 and CERT Insider Threat patterns
-- ============================================================================

-- User behavioral baselines
CREATE TABLE IF NOT EXISTS user_behavior_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Request patterns
    avg_requests_per_hour DOUBLE PRECISION DEFAULT 0,
    stddev_requests_per_hour DOUBLE PRECISION DEFAULT 0,
    avg_tokens_per_request DOUBLE PRECISION DEFAULT 0,
    stddev_tokens_per_request DOUBLE PRECISION DEFAULT 0,
    
    -- Temporal patterns
    typical_hours JSONB DEFAULT '[]', -- Array of {hour: count} for activity distribution
    typical_days JSONB DEFAULT '[]', -- Array of {day: count}
    session_duration_avg_minutes DOUBLE PRECISION DEFAULT 0,
    
    -- Content patterns
    typical_domains TEXT[] DEFAULT '{}',
    typical_models TEXT[] DEFAULT '{}',
    avg_prompt_length DOUBLE PRECISION DEFAULT 0,
    
    -- Behavioral features (CIC-IDS inspired)
    flow_duration_avg_ms DOUBLE PRECISION DEFAULT 0,
    flow_packets_per_second DOUBLE PRECISION DEFAULT 0,
    idle_time_between_requests_avg_ms DOUBLE PRECISION DEFAULT 0,
    
    -- Aggregation metadata
    sample_count INTEGER DEFAULT 0,
    first_observed_at TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    baseline_confidence DOUBLE PRECISION DEFAULT 0, -- 0-1, higher = more reliable baseline
    
    CONSTRAINT unique_user_baseline UNIQUE (tenant_id, user_id)
);

-- Anomaly detection events
CREATE TABLE IF NOT EXISTS anomaly_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Anomaly details
    anomaly_type VARCHAR(100) NOT NULL, -- 'volume_spike', 'temporal_anomaly', 'content_shift', 'pattern_deviation'
    anomaly_subtype VARCHAR(100), -- More specific classification
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    
    -- Scores
    anomaly_score DOUBLE PRECISION NOT NULL, -- 0-1, higher = more anomalous
    z_score DOUBLE PRECISION, -- Standard deviations from baseline
    
    -- Context
    feature_name VARCHAR(255), -- Which feature triggered the anomaly
    observed_value DOUBLE PRECISION,
    expected_value DOUBLE PRECISION,
    baseline_stddev DOUBLE PRECISION,
    
    -- Related data
    request_ids UUID[] DEFAULT '{}',
    session_id UUID,
    model_ids TEXT[],
    
    -- Resolution
    status VARCHAR(50) DEFAULT 'detected', -- 'detected', 'investigating', 'resolved', 'false_positive'
    resolution_notes TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Markov chain transition probabilities for behavioral modeling
CREATE TABLE IF NOT EXISTS behavior_markov_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,
    
    -- State definition
    state_type VARCHAR(100) NOT NULL, -- 'action_sequence', 'domain_transition', 'model_transition'
    from_state VARCHAR(255) NOT NULL,
    to_state VARCHAR(255) NOT NULL,
    
    -- Probabilities
    transition_count INTEGER DEFAULT 0,
    total_from_state_count INTEGER DEFAULT 0,
    probability DOUBLE PRECISION GENERATED ALWAYS AS (
        CASE WHEN total_from_state_count > 0 
        THEN transition_count::float / total_from_state_count 
        ELSE 0 END
    ) STORED,
    
    last_observed_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_markov_transition UNIQUE (tenant_id, user_id, state_type, from_state, to_state)
);

-- ============================================================================
-- DRIFT DETECTION TABLES
-- Based on Evidently AI methodology and ChatGPT Behavior Change paper
-- ============================================================================

-- Drift detection configuration
CREATE TABLE IF NOT EXISTS drift_detection_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Detection settings
    drift_detection_enabled BOOLEAN DEFAULT true,
    
    -- Methods to use
    use_ks_test BOOLEAN DEFAULT true, -- Kolmogorov-Smirnov
    use_psi BOOLEAN DEFAULT true, -- Population Stability Index
    use_chi_squared BOOLEAN DEFAULT true,
    use_embedding_drift BOOLEAN DEFAULT true,
    
    -- Thresholds
    ks_threshold DOUBLE PRECISION DEFAULT 0.1,
    psi_threshold DOUBLE PRECISION DEFAULT 0.2,
    chi_squared_threshold DOUBLE PRECISION DEFAULT 0.05,
    embedding_distance_threshold DOUBLE PRECISION DEFAULT 0.3,
    
    -- Reference window
    reference_window_days INTEGER DEFAULT 30,
    comparison_window_days INTEGER DEFAULT 7,
    minimum_samples_for_test INTEGER DEFAULT 100,
    
    -- Alert settings
    alert_on_drift BOOLEAN DEFAULT true,
    alert_cooldown_hours INTEGER DEFAULT 24,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_drift_config UNIQUE (tenant_id)
);

-- Model output distributions (reference baselines)
CREATE TABLE IF NOT EXISTS model_output_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    
    -- Distribution type
    distribution_type VARCHAR(100) NOT NULL, -- 'response_length', 'sentiment', 'toxicity', 'embedding'
    period_type VARCHAR(50) NOT NULL, -- 'reference', 'current'
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Distribution statistics
    sample_count INTEGER NOT NULL,
    mean_value DOUBLE PRECISION,
    median_value DOUBLE PRECISION,
    stddev_value DOUBLE PRECISION,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    percentiles JSONB DEFAULT '{}', -- {p5, p25, p50, p75, p95}
    
    -- Histogram data for PSI calculation
    histogram_bins JSONB DEFAULT '[]', -- [{bin_start, bin_end, count}]
    
    -- Embedding centroid for embedding drift
    embedding_centroid VECTOR(1536),
    embedding_spread DOUBLE PRECISION, -- Average distance from centroid
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drift detection results
CREATE TABLE IF NOT EXISTS drift_detection_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    
    -- Test details
    test_type VARCHAR(100) NOT NULL, -- 'ks_test', 'psi', 'chi_squared', 'embedding_distance'
    metric_name VARCHAR(255) NOT NULL, -- 'response_length', 'sentiment_score', 'toxicity_score'
    
    -- Results
    drift_detected BOOLEAN NOT NULL,
    test_statistic DOUBLE PRECISION,
    p_value DOUBLE PRECISION,
    threshold_used DOUBLE PRECISION,
    
    -- Context
    reference_period_start TIMESTAMPTZ,
    reference_period_end TIMESTAMPTZ,
    comparison_period_start TIMESTAMPTZ,
    comparison_period_end TIMESTAMPTZ,
    reference_sample_count INTEGER,
    comparison_sample_count INTEGER,
    
    -- Alert status
    alert_sent BOOLEAN DEFAULT false,
    alert_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quality benchmark tracking (TruthfulQA, SelfCheckGPT methodology)
CREATE TABLE IF NOT EXISTS quality_benchmark_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    
    -- Benchmark info
    benchmark_name VARCHAR(255) NOT NULL, -- 'truthfulqa', 'selfcheck', 'leetcode', 'custom'
    benchmark_version VARCHAR(50),
    
    -- Results
    score DOUBLE PRECISION NOT NULL,
    total_questions INTEGER,
    correct_answers INTEGER,
    
    -- Detailed results
    category_scores JSONB DEFAULT '{}', -- {category: score}
    failed_questions JSONB DEFAULT '[]', -- [{question_id, expected, actual}]
    
    -- Comparison to baseline
    baseline_score DOUBLE PRECISION,
    score_delta DOUBLE PRECISION,
    significant_change BOOLEAN DEFAULT false,
    
    run_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INVERSE PROPENSITY SCORING TABLES
-- For correcting selection bias in model performance estimates
-- ============================================================================

-- Selection probability tracking
CREATE TABLE IF NOT EXISTS model_selection_probabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id VARCHAR(255) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Selection statistics
    times_selected INTEGER DEFAULT 0,
    times_available INTEGER DEFAULT 0, -- Times model was in candidate pool
    selection_probability DOUBLE PRECISION GENERATED ALWAYS AS (
        CASE WHEN times_available > 0 
        THEN times_selected::float / times_available 
        ELSE 0 END
    ) STORED,
    
    -- Propensity score (for IPS weighting)
    propensity_score DOUBLE PRECISION, -- Estimated probability of selection
    inverse_propensity_weight DOUBLE PRECISION, -- 1/propensity for weighting
    clipped_ipw DOUBLE PRECISION, -- Clipped to prevent extreme weights
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_selection_prob UNIQUE (tenant_id, domain_id, model_id, period_start)
);

-- IPS-corrected performance estimates
CREATE TABLE IF NOT EXISTS ips_corrected_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id VARCHAR(255) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    
    -- Raw estimates
    raw_success_rate DOUBLE PRECISION,
    raw_sample_count INTEGER,
    
    -- IPS-corrected estimates
    ips_success_rate DOUBLE PRECISION,
    ips_variance DOUBLE PRECISION,
    ips_confidence_interval_lower DOUBLE PRECISION,
    ips_confidence_interval_upper DOUBLE PRECISION,
    
    -- Self-normalized IPS (SNIPS) - more stable
    snips_success_rate DOUBLE PRECISION,
    
    -- Doubly robust estimate
    dr_success_rate DOUBLE PRECISION,
    
    -- Metadata
    estimation_method VARCHAR(50), -- 'ips', 'snips', 'doubly_robust'
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2 CONFIGURATION EXTENSION
-- ============================================================================

-- Add Phase 2 columns to security_protection_config
ALTER TABLE security_protection_config ADD COLUMN IF NOT EXISTS
    -- Constitutional Classifier settings
    constitutional_classifier_enabled BOOLEAN DEFAULT false,
    classifier_model_type VARCHAR(100) DEFAULT 'harmbench_llama',
    classifier_confidence_threshold DOUBLE PRECISION DEFAULT 0.8,
    classifier_action VARCHAR(50) DEFAULT 'flag', -- 'flag', 'block', 'modify'
    classifier_categories TEXT[] DEFAULT '{}', -- Empty = all categories
    
    -- Behavioral Anomaly Detection settings
    behavioral_anomaly_enabled BOOLEAN DEFAULT false,
    anomaly_detection_method VARCHAR(100) DEFAULT 'markov_zscore',
    anomaly_z_score_threshold DOUBLE PRECISION DEFAULT 3.0,
    anomaly_volume_spike_multiplier DOUBLE PRECISION DEFAULT 5.0,
    anomaly_baseline_days INTEGER DEFAULT 30,
    
    -- Drift Detection settings
    drift_detection_enabled BOOLEAN DEFAULT false,
    drift_ks_threshold DOUBLE PRECISION DEFAULT 0.1,
    drift_psi_threshold DOUBLE PRECISION DEFAULT 0.2,
    drift_reference_days INTEGER DEFAULT 30,
    drift_comparison_days INTEGER DEFAULT 7,
    
    -- Inverse Propensity Scoring settings
    ips_enabled BOOLEAN DEFAULT false,
    ips_clipping_threshold DOUBLE PRECISION DEFAULT 10.0,
    ips_estimation_method VARCHAR(50) DEFAULT 'snips';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_classification_results_tenant ON classification_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classification_results_created ON classification_results(created_at);
CREATE INDEX IF NOT EXISTS idx_classification_results_harmful ON classification_results(tenant_id, is_harmful);
CREATE INDEX IF NOT EXISTS idx_jailbreak_patterns_type ON jailbreak_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_user_baselines_tenant_user ON user_behavior_baselines(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_tenant ON anomaly_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_severity ON anomaly_events(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_status ON anomaly_events(status);
CREATE INDEX IF NOT EXISTS idx_markov_states_lookup ON behavior_markov_states(tenant_id, user_id, state_type, from_state);
CREATE INDEX IF NOT EXISTS idx_drift_results_tenant_model ON drift_detection_results(tenant_id, model_id);
CREATE INDEX IF NOT EXISTS idx_drift_results_detected ON drift_detection_results(drift_detected);
CREATE INDEX IF NOT EXISTS idx_output_distributions_model ON model_output_distributions(tenant_id, model_id, distribution_type);
CREATE INDEX IF NOT EXISTS idx_selection_probs_lookup ON model_selection_probabilities(tenant_id, domain_id, model_id);
CREATE INDEX IF NOT EXISTS idx_ips_estimates_lookup ON ips_corrected_estimates(tenant_id, domain_id, model_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE harm_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE constitutional_classifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE jailbreak_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_markov_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_detection_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_output_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_detection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_benchmark_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_selection_probabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ips_corrected_estimates ENABLE ROW LEVEL SECURITY;

-- Harm categories are global (no tenant isolation)
CREATE POLICY harm_categories_read_all ON harm_categories FOR SELECT USING (true);

CREATE POLICY classifiers_tenant_isolation ON constitutional_classifiers
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY classification_results_tenant_isolation ON classification_results
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY jailbreak_patterns_read_all ON jailbreak_patterns FOR SELECT USING (true);
CREATE POLICY user_baselines_tenant_isolation ON user_behavior_baselines
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY anomaly_events_tenant_isolation ON anomaly_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY markov_states_tenant_isolation ON behavior_markov_states
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY drift_config_tenant_isolation ON drift_detection_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY output_distributions_tenant_isolation ON model_output_distributions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY drift_results_tenant_isolation ON drift_detection_results
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY benchmark_results_tenant_isolation ON quality_benchmark_results
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY selection_probs_tenant_isolation ON model_selection_probabilities
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY ips_estimates_tenant_isolation ON ips_corrected_estimates
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
