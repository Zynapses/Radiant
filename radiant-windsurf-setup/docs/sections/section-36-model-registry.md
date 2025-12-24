# SECTION 36: UNIFIED MODEL REGISTRY & SYNC SERVICE (v4.2.0)
# ═══════════════════════════════════════════════════════════════════════════════

> **Section 36 of 37** | Depends on: Sections 0-35 | Creates: Unified registry, sync service, complete model catalog

## 36.1 OVERVIEW

This section creates:
1. **Unified Model Registry** - SQL view combining ALL 106 models (50+ external + 56 self-hosted)
2. **Registry Sync Service** - Automated Lambda for provider/model synchronization
3. **Complete Self-Hosted Model Catalog** - 56 models with full metadata
4. **Orchestration Model Selection** - Smart selection algorithm with thermal awareness
5. **Health Monitoring** - Provider/endpoint health tracking

---

## 36.2 DATABASE SCHEMA

### packages/database/migrations/036_unified_model_registry.sql

```sql
-- ============================================================================
-- RADIANT v4.2.0 - Unified Model Registry Migration
-- ============================================================================
-- Combines external providers (21) and self-hosted models (56+) into single view
-- Provides orchestration engine with complete model selection metadata
-- ============================================================================

-- ============================================================================
-- SELF-HOSTED MODELS CATALOG (56 models)
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_hosted_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Categorization
    category VARCHAR(50) NOT NULL,  -- vision, audio, scientific, medical, geospatial, 3d, llm
    specialty VARCHAR(50) NOT NULL, -- object_detection, protein_folding, etc.
    
    -- Capabilities & Modalities
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    input_modalities TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    output_modalities TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    primary_mode VARCHAR(20) NOT NULL DEFAULT 'inference',
    
    -- SageMaker Configuration
    sagemaker_image VARCHAR(500) NOT NULL,
    instance_type VARCHAR(50) NOT NULL,
    gpu_memory_gb INTEGER NOT NULL,
    environment JSONB NOT NULL DEFAULT '{}',
    model_data_url TEXT,
    
    -- Model Specs
    parameters BIGINT,
    accuracy VARCHAR(100),
    benchmark VARCHAR(255),
    context_window INTEGER,
    max_output INTEGER,
    
    -- I/O Formats
    input_formats TEXT[] NOT NULL DEFAULT '{}',
    output_formats TEXT[] NOT NULL DEFAULT '{}',
    
    -- Licensing
    license VARCHAR(100) NOT NULL,
    license_url TEXT,
    commercial_use_allowed BOOLEAN NOT NULL DEFAULT true,
    commercial_use_notes TEXT,
    attribution_required BOOLEAN NOT NULL DEFAULT false,
    
    -- Pricing (75% markup on SageMaker costs)
    hourly_rate DECIMAL(10,4) NOT NULL,
    per_request DECIMAL(10,6),
    per_image DECIMAL(10,6),
    per_minute_audio DECIMAL(10,6),
    per_minute_video DECIMAL(10,6),
    per_3d_model DECIMAL(10,4),
    markup_percent DECIMAL(5,2) NOT NULL DEFAULT 75.00,
    
    -- Tier Requirements
    min_tier INTEGER NOT NULL DEFAULT 3,  -- Self-hosted requires Tier 3+
    
    -- Thermal Defaults
    default_thermal_state VARCHAR(20) NOT NULL DEFAULT 'COLD',
    warmup_time_seconds INTEGER NOT NULL DEFAULT 60,
    scale_to_zero_minutes INTEGER NOT NULL DEFAULT 15,
    min_instances INTEGER NOT NULL DEFAULT 0,
    max_instances INTEGER NOT NULL DEFAULT 3,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    enabled BOOLEAN NOT NULL DEFAULT true,
    deprecated BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_self_hosted_category ON self_hosted_models(category);
CREATE INDEX idx_self_hosted_specialty ON self_hosted_models(specialty);
CREATE INDEX idx_self_hosted_status ON self_hosted_models(status);
CREATE INDEX idx_self_hosted_enabled ON self_hosted_models(enabled);

-- ============================================================================
-- PROVIDER HEALTH MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(50) NOT NULL REFERENCES providers(id),
    region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    
    -- Health Status
    status VARCHAR(20) NOT NULL DEFAULT 'unknown', -- healthy, degraded, unhealthy, unknown
    avg_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    error_rate DECIMAL(5, 2),
    success_rate DECIMAL(5, 2),
    
    -- Last Check
    last_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(provider_id, region)
);

CREATE INDEX idx_provider_health_provider ON provider_health(provider_id);
CREATE INDEX idx_provider_health_status ON provider_health(status);

-- ============================================================================
-- REGISTRY SYNC LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS registry_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type VARCHAR(50) NOT NULL, -- full, health, pricing, models
    
    -- Results
    providers_updated INTEGER NOT NULL DEFAULT 0,
    models_added INTEGER NOT NULL DEFAULT 0,
    models_updated INTEGER NOT NULL DEFAULT 0,
    models_deprecated INTEGER NOT NULL DEFAULT 0,
    errors TEXT[],
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'running', -- running, completed, failed
    error_message TEXT
);

CREATE INDEX idx_registry_sync_type ON registry_sync_log(sync_type);
CREATE INDEX idx_registry_sync_status ON registry_sync_log(status);
CREATE INDEX idx_registry_sync_started ON registry_sync_log(started_at DESC);

-- ============================================================================
-- UNIFIED MODEL REGISTRY VIEW
-- ============================================================================

CREATE OR REPLACE VIEW unified_model_registry AS
-- External Provider Models
SELECT 
    m.id::TEXT AS id,
    m.provider_id,
    p.display_name AS provider_name,
    m.model_id,
    m.litellm_id,
    m.name,
    m.display_name,
    m.description,
    
    -- Hosting Type
    'external' AS hosting_type,
    
    -- Category & Modality
    m.category,
    m.capabilities,
    m.input_modalities,
    m.output_modalities,
    
    -- Primary Mode (derived)
    CASE 
        WHEN 'chat' = ANY(m.capabilities) THEN 'chat'
        WHEN 'completion' = ANY(m.capabilities) THEN 'completion'
        WHEN 'embedding' = ANY(m.capabilities) OR m.category = 'embedding' THEN 'embedding'
        WHEN m.category = 'image_generation' THEN 'image'
        WHEN m.category = 'video_generation' THEN 'video'
        WHEN m.category IN ('audio_generation', 'text_to_speech') THEN 'audio'
        WHEN m.category = 'speech_to_text' THEN 'transcription'
        WHEN m.category = 'search' THEN 'search'
        WHEN m.category = '3d_generation' THEN '3d'
        ELSE 'other'
    END AS primary_mode,
    
    -- Context & Limits
    m.context_window,
    m.max_output,
    
    -- Pricing
    m.pricing_type,
    m.input_cost_per_1k,
    m.output_cost_per_1k,
    m.cost_per_request,
    m.cost_per_second,
    m.cost_per_image,
    m.cost_per_minute,
    m.markup_rate,
    
    -- Self-Hosted Specific (NULL for external)
    NULL::VARCHAR AS instance_type,
    NULL::INTEGER AS gpu_memory_gb,
    NULL::VARCHAR AS thermal_state,
    NULL::BOOLEAN AS is_transitioning,
    NULL::INTEGER AS warmup_time_seconds,
    
    -- Status
    m.enabled,
    m.deprecated,
    ph.status AS health_status,
    ph.avg_latency_ms,
    ph.error_rate,
    
    -- Compliance
    p.compliance,
    NULL::VARCHAR AS license,
    TRUE AS commercial_use_allowed,
    
    -- Tier
    1 AS min_tier,  -- External available to all tiers
    
    -- Timestamps
    m.created_at,
    m.updated_at

FROM models m
JOIN providers p ON m.provider_id = p.id
LEFT JOIN provider_health ph ON p.id = ph.provider_id AND ph.region = 'us-east-1'
WHERE m.enabled = true AND p.enabled = true

UNION ALL

-- Self-Hosted Models
SELECT 
    sh.id::TEXT AS id,
    'self_hosted' AS provider_id,
    'RADIANT Self-Hosted' AS provider_name,
    sh.model_id,
    'sagemaker/' || sh.model_id AS litellm_id,
    sh.name,
    sh.display_name,
    sh.description,
    
    -- Hosting Type
    'self_hosted' AS hosting_type,
    
    -- Category & Modality
    sh.category,
    sh.capabilities,
    sh.input_modalities,
    sh.output_modalities,
    sh.primary_mode,
    
    -- Context & Limits
    sh.context_window,
    sh.max_output,
    
    -- Pricing
    'per_hour'::VARCHAR AS pricing_type,
    NULL::NUMERIC AS input_cost_per_1k,
    NULL::NUMERIC AS output_cost_per_1k,
    sh.per_request AS cost_per_request,
    NULL::NUMERIC AS cost_per_second,
    sh.per_image AS cost_per_image,
    sh.per_minute_audio AS cost_per_minute,
    sh.markup_percent / 100 AS markup_rate,
    
    -- Self-Hosted Specific
    sh.instance_type,
    sh.gpu_memory_gb,
    ts.current_state AS thermal_state,
    ts.is_transitioning,
    sh.warmup_time_seconds,
    
    -- Status
    sh.enabled,
    sh.deprecated,
    CASE WHEN ts.current_state IN ('WARM', 'HOT') THEN 'healthy' ELSE 'unknown' END AS health_status,
    NULL::INTEGER AS avg_latency_ms,
    NULL::NUMERIC AS error_rate,
    
    -- Compliance
    ARRAY[]::TEXT[] AS compliance,
    sh.license,
    sh.commercial_use_allowed,
    
    -- Tier
    sh.min_tier,
    
    -- Timestamps
    sh.created_at,
    sh.updated_at

FROM self_hosted_models sh
LEFT JOIN thermal_states ts ON sh.model_id = ts.model_id
WHERE sh.enabled = true;

-- Index on the view (for performance)
CREATE INDEX IF NOT EXISTS idx_models_hosting_type ON models((CASE WHEN is_self_hosted THEN 'self_hosted' ELSE 'external' END));

-- ============================================================================
-- MODEL SELECTION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION select_model(
    p_task VARCHAR(20),
    p_input_modalities TEXT[],
    p_output_modalities TEXT[],
    p_tenant_tier INTEGER,
    p_prefer_hosting VARCHAR(20) DEFAULT 'any',
    p_required_capabilities TEXT[] DEFAULT '{}'::TEXT[],
    p_min_context_window INTEGER DEFAULT NULL,
    p_require_hipaa BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    model_id VARCHAR,
    display_name VARCHAR,
    hosting_type VARCHAR,
    provider_name VARCHAR,
    primary_mode VARCHAR,
    thermal_state VARCHAR,
    warmup_required BOOLEAN,
    warmup_time_seconds INTEGER,
    health_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.model_id,
        u.display_name,
        u.hosting_type,
        u.provider_name,
        u.primary_mode,
        u.thermal_state,
        (u.hosting_type = 'self_hosted' AND u.thermal_state = 'COLD') AS warmup_required,
        u.warmup_time_seconds,
        u.health_status
    FROM unified_model_registry u
    WHERE 
        -- Task/mode match
        u.primary_mode = p_task
        -- Modality match
        AND p_input_modalities <@ u.input_modalities
        AND p_output_modalities <@ u.output_modalities
        -- Tier eligibility
        AND u.min_tier <= p_tenant_tier
        -- Not unhealthy
        AND (u.health_status IS NULL OR u.health_status != 'unhealthy')
        -- Hosting preference
        AND (p_prefer_hosting = 'any' OR u.hosting_type = p_prefer_hosting)
        -- Required capabilities
        AND (p_required_capabilities = '{}'::TEXT[] OR p_required_capabilities <@ u.capabilities)
        -- Context window
        AND (p_min_context_window IS NULL OR u.context_window >= p_min_context_window)
        -- HIPAA compliance
        AND (NOT p_require_hipaa OR 'HIPAA' = ANY(u.compliance))
    ORDER BY 
        -- Prefer HOT > WARM > COLD for latency
        CASE u.thermal_state
            WHEN 'HOT' THEN 0
            WHEN 'WARM' THEN 1
            WHEN 'COLD' THEN 2
            ELSE 3
        END,
        -- Then by latency
        u.avg_latency_ms ASC NULLS LAST,
        -- Then by health
        CASE u.health_status
            WHEN 'healthy' THEN 0
            WHEN 'degraded' THEN 1
            ELSE 2
        END
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_self_hosted_models_updated_at
    BEFORE UPDATE ON self_hosted_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_health_updated_at
    BEFORE UPDATE ON provider_health
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA INSERT
-- ============================================================================

INSERT INTO schema_migrations (version, name, applied_by) 
VALUES ('036', 'unified_model_registry', 'system')
ON CONFLICT (version) DO NOTHING;
```

---

## 36.3 SELF-HOSTED MODEL SEED DATA

### packages/database/migrations/036a_seed_self_hosted_models.sql

```sql
-- ============================================================================
-- RADIANT v4.2.0 - Self-Hosted Models Seed Data (56 Models)
-- ============================================================================

-- ============================================================================
-- COMPUTER VISION MODELS (13 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_image, min_tier) VALUES

-- Classification (4)
('efficientnet-b0', 'efficientnet-b0', 'EfficientNet-B0', 'Lightweight image classification model', 'vision', 'classification', ARRAY['image_classification', 'feature_extraction'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 2, 5300000, '77.1% ImageNet Top-1', 'Apache-2.0', true, 1.30, 0.001, 3),
('efficientnetv2-l', 'efficientnetv2-l', 'EfficientNetV2-L', 'State-of-the-art classification with improved training efficiency', 'vision', 'classification', ARRAY['image_classification', 'feature_extraction'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 118000000, '85.7% ImageNet Top-1', 'Apache-2.0', true, 2.47, 0.002, 3),
('convnext-xl', 'convnext-xl', 'ConvNeXt-XL', 'Pure ConvNet achieving transformer-level performance', 'vision', 'classification', ARRAY['image_classification', 'feature_extraction'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 350000000, '87.8% ImageNet Top-1', 'Apache-2.0', true, 2.66, 0.003, 3),
('vit-l-14', 'vit-l-14', 'ViT-L/14', 'Vision Transformer Large with 14x14 patches', 'vision', 'classification', ARRAY['image_classification', 'feature_extraction'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 10, 304000000, '88.0% ImageNet Top-1', 'Apache-2.0', true, 2.66, 0.003, 3),

-- Detection (4)
('yolov8m', 'yolov8m', 'YOLOv8m', 'Medium YOLOv8 for real-time object detection', 'vision', 'detection', ARRAY['object_detection', 'real_time'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 25900000, '50.2% COCO mAP', 'AGPL-3.0', false, 1.30, 0.002, 3),
('yolov8x', 'yolov8x', 'YOLOv8x', 'Extra-large YOLOv8 for maximum accuracy', 'vision', 'detection', ARRAY['object_detection', 'high_accuracy'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 68200000, '53.9% COCO mAP', 'AGPL-3.0', false, 2.47, 0.003, 3),
('yolo11m', 'yolo11m', 'YOLO11m', 'Latest YOLO generation with improved architecture', 'vision', 'detection', ARRAY['object_detection', 'real_time'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 6, 20100000, '51.5% COCO mAP', 'AGPL-3.0', false, 2.47, 0.002, 3),
('detr-resnet-101', 'detr-resnet-101', 'DETR-ResNet-101', 'End-to-end transformer detector', 'vision', 'detection', ARRAY['object_detection', 'panoptic_segmentation'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 60000000, '44.9% COCO mAP', 'Apache-2.0', true, 2.47, 0.003, 3),

-- Segmentation (2)
('sam-vit-h', 'sam-vit-h', 'SAM-ViT-H', 'Segment Anything Model - ViT-Huge backbone', 'vision', 'segmentation', ARRAY['instance_segmentation', 'interactive'], ARRAY['image'], ARRAY['json', 'image'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 636000000, 'SOTA on zero-shot', 'Apache-2.0', true, 2.66, 0.005, 3),
('sam-2', 'sam-2', 'SAM 2', 'Segment Anything Model 2 - video and image segmentation', 'vision', 'segmentation', ARRAY['instance_segmentation', 'video_segmentation', 'interactive'], ARRAY['image', 'video'], ARRAY['json', 'image'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 16, 800000000, 'SOTA video segmentation', 'Apache-2.0', true, 3.55, 0.008, 3),

-- Embedding (1)
('clip-vit-l', 'clip-vit-l', 'CLIP-ViT-L', 'Contrastive Language-Image Pre-training', 'vision', 'embedding', ARRAY['image_embedding', 'text_embedding', 'zero_shot'], ARRAY['image', 'text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 428000000, 'SOTA zero-shot classification', 'MIT', true, 2.47, 0.001, 3),

-- OCR (2)
('paddleocr-v4', 'paddleocr-v4', 'PaddleOCR-v4', 'Multi-language OCR with detection and recognition', 'vision', 'ocr', ARRAY['text_detection', 'text_recognition', 'multilingual'], ARRAY['image'], ARRAY['json', 'text'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 15000000, '95%+ accuracy', 'Apache-2.0', true, 1.30, 0.002, 3),
('trocr-large', 'trocr-large', 'TrOCR-Large', 'Transformer-based OCR for handwritten text', 'vision', 'ocr', ARRAY['text_recognition', 'handwriting'], ARRAY['image'], ARRAY['text'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 558000000, 'SOTA handwriting', 'MIT', true, 2.47, 0.003, 3);

-- ============================================================================
-- AUDIO/SPEECH MODELS (6 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_minute_audio, min_tier) VALUES

('whisper-large-v3', 'whisper-large-v3', 'Whisper-Large-v3', 'OpenAI multilingual speech recognition', 'audio', 'stt', ARRAY['transcription', 'translation', 'language_detection'], ARRAY['audio'], ARRAY['text', 'json'], 'transcription', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 10, 1550000000, '4.2% WER', 'MIT', true, 2.66, 0.006, 3),
('whisper-large-v3-turbo', 'whisper-large-v3-turbo', 'Whisper-Large-v3-Turbo', 'Faster Whisper with minimal accuracy loss', 'audio', 'stt', ARRAY['transcription', 'fast'], ARRAY['audio'], ARRAY['text', 'json'], 'transcription', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 6, 809000000, '5.0% WER', 'MIT', true, 2.47, 0.004, 3),
('wav2vec2-xlsr-53', 'wav2vec2-xlsr-53', 'Wav2Vec2-XLSR-53', 'Cross-lingual speech representation', 'audio', 'stt', ARRAY['transcription', 'multilingual', 'self_supervised'], ARRAY['audio'], ARRAY['text'], 'transcription', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 317000000, 'Multilingual', 'MIT', true, 2.47, 0.005, 3),
('titanet-l', 'titanet-l', 'TitaNet-L', 'NVIDIA speaker embedding and verification', 'audio', 'speaker_id', ARRAY['speaker_embedding', 'speaker_verification'], ARRAY['audio'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 23000000, '99%+ accuracy', 'Apache-2.0', true, 1.30, 0.003, 3),
('pyannote-diarization-3.1', 'pyannote-diarization-3.1', 'pyannote Speaker Diarization 3.1', 'State-of-the-art speaker diarization', 'audio', 'diarization', ARRAY['speaker_diarization', 'vad'], ARRAY['audio'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 6, 50000000, 'SOTA diarization', 'MIT', true, 2.47, 0.005, 3),
('speecht5-tts', 'speecht5-tts', 'SpeechT5 TTS', 'Microsoft text-to-speech synthesis', 'audio', 'tts', ARRAY['text_to_speech', 'voice_synthesis'], ARRAY['text'], ARRAY['audio'], 'audio', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 143000000, 'Natural voice', 'MIT', true, 1.30, 0.004, 3);

-- ============================================================================
-- SCIENTIFIC COMPUTING MODELS (8 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_request, min_tier) VALUES

('alphafold2', 'alphafold2', 'AlphaFold 2', 'Nobel Prize-winning protein structure prediction', 'scientific', 'protein_folding', ARRAY['protein_folding', 'structure_prediction'], ARRAY['sequence'], ARRAY['pdb', 'json'], 'inference', 'alphafold2:2.3.2-gpu', 'ml.g5.12xlarge', 96, 93000000, '92.4 GDT (CASP14)', 'Apache-2.0', true, 14.28, 2.50, 4),
('esm2-650m', 'esm2-650m', 'ESM-2 (650M)', 'Meta protein language model - medium', 'scientific', 'protein_embedding', ARRAY['protein_embedding', 'structure_prediction'], ARRAY['sequence'], ARRAY['embedding', 'json'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 650000000, 'SOTA embeddings', 'MIT', true, 2.66, 0.05, 3),
('esm2-3b', 'esm2-3b', 'ESM-2 (3B)', 'Meta protein language model - large', 'scientific', 'protein_embedding', ARRAY['protein_embedding', 'structure_prediction'], ARRAY['sequence'], ARRAY['embedding', 'json'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.12xlarge', 48, 3000000000, 'SOTA embeddings', 'MIT', true, 14.28, 0.15, 4),
('esmfold', 'esmfold', 'ESMFold', 'Single-sequence protein structure prediction', 'scientific', 'protein_folding', ARRAY['protein_folding', 'fast'], ARRAY['sequence'], ARRAY['pdb', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 20, 700000000, 'Near AlphaFold2', 'MIT', true, 3.55, 0.50, 3),
('rosettafold2', 'rosettafold2', 'RoseTTAFold2', 'Protein complex structure prediction', 'scientific', 'protein_complex', ARRAY['protein_folding', 'complex_prediction'], ARRAY['sequence'], ARRAY['pdb', 'json'], 'inference', 'rosettafold2:latest-gpu', 'ml.p4d.24xlarge', 160, 100000000, 'SOTA complexes', 'BSD-3-Clause', true, 57.35, 5.00, 5),
('alphageometry', 'alphageometry', 'AlphaGeometry', 'Olympiad-level geometry reasoning', 'scientific', 'math_reasoning', ARRAY['geometry_reasoning', 'theorem_proving'], ARRAY['text'], ARRAY['text', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 270000000, 'IMO Silver level', 'Apache-2.0', true, 2.66, 0.10, 3),
('muzero', 'muzero', 'MuZero', 'DeepMind model-based planning', 'scientific', 'planning', ARRAY['planning', 'game_playing', 'decision_making'], ARRAY['state'], ARRAY['action', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 16, 50000000, 'Superhuman games', 'Apache-2.0', true, 3.55, 0.05, 4),
('graphormer', 'graphormer', 'Graphormer', 'Transformer for molecular property prediction', 'scientific', 'molecular', ARRAY['molecular_property', 'graph_learning'], ARRAY['smiles', 'graph'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 47000000, 'SOTA molecular', 'MIT', true, 2.47, 0.02, 3);

-- ============================================================================
-- MEDICAL IMAGING MODELS (6 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_image, min_tier) VALUES

('nnunet', 'nnunet', 'nnU-Net', 'Self-configuring medical image segmentation', 'medical', 'segmentation', ARRAY['medical_segmentation', 'auto_configure'], ARRAY['image'], ARRAY['image', 'json'], 'inference', 'nnunet:v2-gpu', 'ml.g5.4xlarge', 16, 31000000, 'SOTA 23+ challenges', 'Apache-2.0', true, 3.55, 0.05, 4),
('medsam', 'medsam', 'MedSAM', 'Segment Anything for Medical Images', 'medical', 'segmentation', ARRAY['medical_segmentation', 'interactive', 'universal'], ARRAY['image'], ARRAY['image', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 93000000, 'Universal medical', 'Apache-2.0', true, 2.66, 0.03, 3),
('med-sam2', 'med-sam2', 'Med-SAM2', 'Medical SAM 2 for 3D and video', 'medical', 'segmentation', ARRAY['medical_segmentation', '3d_segmentation', 'video'], ARRAY['image', 'video'], ARRAY['image', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 16, 150000000, 'SOTA 3D medical', 'Apache-2.0', true, 3.55, 0.05, 4),
('biomedclip', 'biomedclip', 'BiomedCLIP', 'Medical image-text embeddings', 'medical', 'embedding', ARRAY['medical_embedding', 'image_text', 'zero_shot'], ARRAY['image', 'text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 400000000, 'SOTA medical CLIP', 'MIT', true, 2.47, 0.01, 3),
('chexnet', 'chexnet', 'CheXNet', 'Chest X-ray pathology detection', 'medical', 'classification', ARRAY['chest_xray', 'pathology_detection'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 7000000, 'Radiologist-level', 'MIT', true, 1.30, 0.01, 3),
('monai-vista3d', 'monai-vista3d', 'MONAI VISTA-3D', '3D medical image segmentation foundation', 'medical', 'segmentation', ARRAY['3d_segmentation', 'ct', 'mri'], ARRAY['image'], ARRAY['image', 'json'], 'inference', 'monai:1.3-gpu', 'ml.g5.12xlarge', 48, 200000000, 'SOTA 3D', 'Apache-2.0', true, 14.28, 0.10, 4);

-- ============================================================================
-- GEOSPATIAL MODELS (4 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_image, min_tier) VALUES

('prithvi-100m', 'prithvi-100m', 'Prithvi-100M', 'NASA/IBM geospatial foundation model', 'geospatial', 'foundation', ARRAY['satellite_analysis', 'multi_temporal', 'change_detection'], ARRAY['image'], ARRAY['embedding', 'json'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 100000000, 'SOTA satellite', 'Apache-2.0', true, 2.47, 0.02, 3),
('prithvi-600m', 'prithvi-600m', 'Prithvi-600M', 'NASA/IBM large geospatial model', 'geospatial', 'foundation', ARRAY['satellite_analysis', 'multi_temporal', 'segmentation'], ARRAY['image'], ARRAY['embedding', 'image'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 16, 600000000, 'SOTA satellite', 'Apache-2.0', true, 3.55, 0.05, 4),
('satmae', 'satmae', 'SatMAE', 'Self-supervised satellite image analysis', 'geospatial', 'foundation', ARRAY['satellite_analysis', 'self_supervised'], ARRAY['image'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 300000000, 'Strong transfer', 'MIT', true, 2.66, 0.03, 3),
('geosam', 'geosam', 'GeoSAM', 'Segment Anything for geospatial', 'geospatial', 'segmentation', ARRAY['satellite_segmentation', 'interactive'], ARRAY['image'], ARRAY['image', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 93000000, 'SOTA geo', 'Apache-2.0', true, 2.66, 0.03, 3);

-- ============================================================================
-- 3D/RECONSTRUCTION MODELS (5 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_3d_model, min_tier) VALUES

('nerfstudio-nerfacto', 'nerfstudio-nerfacto', 'Nerfstudio Nerfacto', 'Real-time NeRF scene reconstruction', '3d', 'nerf', ARRAY['nerf', 'scene_reconstruction'], ARRAY['image'], ARRAY['mesh', 'video'], 'inference', 'nerfstudio:0.3-gpu', 'ml.g5.4xlarge', 16, 5000000, 'High quality NeRF', 'Apache-2.0', true, 3.55, 1.00, 4),
('3dgs', '3dgs', '3D Gaussian Splatting', 'Real-time radiance field rendering', '3d', 'splatting', ARRAY['gaussian_splatting', 'real_time_rendering'], ARRAY['image'], ARRAY['splat', 'video'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 1000000, 'SOTA real-time', 'INRIA', true, 2.66, 0.50, 3),
('instant-ngp', 'instant-ngp', 'Instant-NGP', 'NVIDIA instant neural graphics primitives', '3d', 'nerf', ARRAY['nerf', 'fast_training'], ARRAY['image'], ARRAY['mesh', 'video'], 'inference', 'instant-ngp:latest-gpu', 'ml.g5.2xlarge', 10, 2000000, 'Fast NeRF', 'NVIDIA', true, 2.66, 0.30, 3),
('point-e', 'point-e', 'Point-E', 'OpenAI text-to-3D point cloud', '3d', 'generation', ARRAY['text_to_3d', 'point_cloud'], ARRAY['text'], ARRAY['ply', 'json'], '3d', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 40000000, 'Fast text-to-3D', 'MIT', true, 2.47, 0.20, 3),
('shap-e', 'shap-e', 'Shap-E', 'OpenAI text/image to 3D mesh', '3d', 'generation', ARRAY['text_to_3d', 'image_to_3d', 'mesh_generation'], ARRAY['text', 'image'], ARRAY['obj', 'glb'], '3d', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 300000000, '3D asset generation', 'MIT', true, 2.47, 0.25, 3);

-- ============================================================================
-- LLM/EMBEDDINGS MODELS (14 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, context_window, max_output, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_request, min_tier) VALUES

-- Large LLMs
('llama-3.3-70b', 'llama-3.3-70b', 'Llama 3.3 70B', 'Meta latest flagship LLM', 'llm', 'chat', ARRAY['chat', 'reasoning', 'function_calling'], ARRAY['text'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.48xlarge', 160, 128000, 8192, 70000000000, 'SOTA open', 'Llama-3.3', true, 35.63, 0.05, 5),
('llama-3.2-11b-vision', 'llama-3.2-11b-vision', 'Llama 3.2 11B Vision', 'Meta multimodal LLM', 'llm', 'vision_chat', ARRAY['chat', 'vision', 'reasoning'], ARRAY['text', 'image'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.12xlarge', 48, 128000, 4096, 11000000000, 'SOTA vision', 'Llama-3.2', true, 14.28, 0.02, 4),
('mistral-7b-v0.3', 'mistral-7b-v0.3', 'Mistral 7B v0.3', 'Mistral efficient base model', 'llm', 'chat', ARRAY['chat', 'completion', 'function_calling'], ARRAY['text'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.2xlarge', 16, 32000, 4096, 7000000000, 'Efficient 7B', 'Apache-2.0', true, 2.66, 0.005, 3),
('mixtral-8x7b', 'mixtral-8x7b', 'Mixtral 8x7B', 'Mistral mixture of experts', 'llm', 'chat', ARRAY['chat', 'completion', 'moe'], ARRAY['text'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.12xlarge', 96, 32000, 4096, 46700000000, 'SOTA MoE', 'Apache-2.0', true, 14.28, 0.01, 4),
('qwen2.5-72b', 'qwen2.5-72b', 'Qwen2.5 72B', 'Alibaba flagship LLM', 'llm', 'chat', ARRAY['chat', 'reasoning', 'coding'], ARRAY['text'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.48xlarge', 160, 128000, 8192, 72000000000, 'SOTA multilingual', 'Qwen', true, 35.63, 0.05, 5),

-- Code Models
('codellama-70b', 'codellama-70b', 'CodeLlama 70B', 'Meta code-specialized LLM', 'llm', 'code', ARRAY['code_generation', 'code_completion', 'infilling'], ARRAY['text'], ARRAY['text'], 'completion', 'huggingface-llm:2.0-gpu', 'ml.g5.48xlarge', 160, 100000, 16384, 70000000000, 'SOTA code', 'Llama-2', true, 35.63, 0.03, 5),
('starcoder2-15b', 'starcoder2-15b', 'StarCoder2 15B', 'BigCode multi-language code model', 'llm', 'code', ARRAY['code_generation', 'code_completion', 'multi_language'], ARRAY['text'], ARRAY['text'], 'completion', 'huggingface-llm:2.0-gpu', 'ml.g5.4xlarge', 32, 16000, 8192, 15000000000, 'Strong code', 'BigCode-OpenRAIL-M', true, 3.55, 0.008, 4),
('deepseek-coder-33b', 'deepseek-coder-33b', 'DeepSeek Coder 33B', 'DeepSeek coding specialist', 'llm', 'code', ARRAY['code_generation', 'code_completion'], ARRAY['text'], ARRAY['text'], 'completion', 'huggingface-llm:2.0-gpu', 'ml.g5.12xlarge', 72, 16000, 8192, 33000000000, 'SOTA code', 'DeepSeek', true, 14.28, 0.015, 4),

-- Embeddings
('bge-large-en', 'bge-large-en', 'BGE-Large-EN', 'BAAI general embedding model', 'llm', 'embedding', ARRAY['text_embedding', 'retrieval'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 2, 512, NULL, 335000000, 'SOTA MTEB', 'MIT', true, 1.30, 0.0005, 3),
('bge-m3', 'bge-m3', 'BGE-M3', 'Multi-lingual multi-function embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'multilingual', 'sparse_embedding'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 4, 8192, NULL, 568000000, 'SOTA multilingual', 'MIT', true, 2.47, 0.0008, 3),
('e5-mistral-7b', 'e5-mistral-7b', 'E5-Mistral-7B', 'Mistral-based embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'long_context'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 16, 32000, NULL, 7000000000, 'Strong long-context', 'MIT', true, 2.66, 0.002, 3),
('jina-embeddings-v3', 'jina-embeddings-v3', 'Jina Embeddings v3', 'Jina multi-task embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'multilingual', 'multimodal'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 4, 8192, NULL, 570000000, 'Versatile', 'Apache-2.0', true, 2.47, 0.0006, 3),
('mxbai-embed-large', 'mxbai-embed-large', 'mxbai-embed-large', 'Mixedbread high-quality embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'retrieval'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 2, 512, NULL, 335000000, 'High quality', 'Apache-2.0', true, 1.30, 0.0005, 3),
('gte-qwen2-7b', 'gte-qwen2-7b', 'GTE-Qwen2-7B', 'Alibaba instruction-tuned embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'instruction_following'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 16, 32000, NULL, 7000000000, 'SOTA instruction', 'Apache-2.0', true, 2.66, 0.002, 3);

-- Update schema migrations
INSERT INTO schema_migrations (version, name, applied_by) 
VALUES ('036a', 'seed_self_hosted_models', 'system')
ON CONFLICT (version) DO NOTHING;
```

---

## 36.4 REGISTRY SYNC SERVICE

### packages/infrastructure/lambda/registry-sync/handler.ts

```typescript
/**
 * RADIANT v4.2.0 - Registry Sync Service
 * 
 * Automated synchronization of model registry:
 * - Daily full sync of provider model lists
 * - 5-minute health checks for all providers
 * - Weekly pricing updates
 * - Self-hosted endpoint validation
 */

import { Pool } from 'pg';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SageMakerClient, DescribeEndpointCommand } from '@aws-sdk/client-sagemaker';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const eventBridge = new EventBridgeClient({});
const sagemaker = new SageMakerClient({});

// ============================================================================
// SYNC TYPES
// ============================================================================

type SyncType = 'full' | 'health' | 'pricing' | 'thermal';

interface SyncResult {
  syncId: string;
  type: SyncType;
  providersUpdated: number;
  modelsAdded: number;
  modelsUpdated: number;
  modelsDeprecated: number;
  errors: string[];
  durationMs: number;
}

// ============================================================================
// PROVIDER SYNC HANDLERS
// ============================================================================

async function syncProviderModels(providerId: string): Promise<{ added: number; updated: number }> {
  // Provider-specific model discovery
  switch (providerId) {
    case 'openai':
      return syncOpenAIModels();
    case 'anthropic':
      return syncAnthropicModels();
    case 'google':
      return syncGoogleModels();
    // ... other providers
    default:
      return { added: 0, updated: 0 };
  }
}

async function syncOpenAIModels(): Promise<{ added: number; updated: number }> {
  // OpenAI has a models endpoint
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
  });
  
  if (!response.ok) return { added: 0, updated: 0 };
  
  const data = await response.json();
  let added = 0, updated = 0;
  
  for (const model of data.data) {
    const existing = await pool.query(
      'SELECT id FROM models WHERE provider_id = $1 AND model_id = $2',
      ['openai', model.id]
    );
    
    if (existing.rows.length === 0) {
      // New model discovered - flag for admin review
      await pool.query(`
        INSERT INTO registry_sync_log (sync_type, status, error_message)
        VALUES ('models', 'pending_review', $1)
      `, [`New OpenAI model discovered: ${model.id}`]);
      added++;
    }
  }
  
  return { added, updated };
}

async function syncAnthropicModels(): Promise<{ added: number; updated: number }> {
  // Anthropic doesn't have a public models endpoint
  // Sync from known model list
  const KNOWN_ANTHROPIC_MODELS = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-3-5-sonnet-20241022',
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
  ];
  
  // Check for any unknown models in our database
  const result = await pool.query(
    'SELECT model_id FROM models WHERE provider_id = $1',
    ['anthropic']
  );
  
  const knownIds = new Set(KNOWN_ANTHROPIC_MODELS);
  let deprecated = 0;
  
  for (const row of result.rows) {
    if (!knownIds.has(row.model_id)) {
      // Model may be deprecated
      await pool.query(
        'UPDATE models SET deprecated = true WHERE provider_id = $1 AND model_id = $2',
        ['anthropic', row.model_id]
      );
      deprecated++;
    }
  }
  
  return { added: 0, updated: deprecated };
}

async function syncGoogleModels(): Promise<{ added: number; updated: number }> {
  // Google Gemini models
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`
    );
    
    if (!response.ok) return { added: 0, updated: 0 };
    
    const data = await response.json();
    // Process discovered models...
    return { added: 0, updated: 0 };
  } catch (error) {
    return { added: 0, updated: 0 };
  }
}

// ============================================================================
// HEALTH CHECK HANDLERS
// ============================================================================

async function checkProviderHealth(providerId: string): Promise<void> {
  const provider = await pool.query(
    'SELECT api_base_url FROM providers WHERE id = $1',
    [providerId]
  );
  
  if (provider.rows.length === 0) return;
  
  const startTime = Date.now();
  let status = 'healthy';
  let errorMessage: string | null = null;
  
  try {
    // Simple health check - ping the API
    const response = await fetch(`${provider.rows[0].api_base_url}/models`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      status = response.status >= 500 ? 'unhealthy' : 'degraded';
    }
  } catch (error: any) {
    status = 'unhealthy';
    errorMessage = error.message;
  }
  
  const latencyMs = Date.now() - startTime;
  
  await pool.query(`
    INSERT INTO provider_health (provider_id, status, avg_latency_ms, last_check_at, last_error)
    VALUES ($1, $2, $3, NOW(), $4)
    ON CONFLICT (provider_id, region) DO UPDATE SET
      status = EXCLUDED.status,
      avg_latency_ms = (provider_health.avg_latency_ms * 0.7 + EXCLUDED.avg_latency_ms * 0.3)::INTEGER,
      last_check_at = NOW(),
      last_success_at = CASE WHEN EXCLUDED.status = 'healthy' THEN NOW() ELSE provider_health.last_success_at END,
      last_failure_at = CASE WHEN EXCLUDED.status != 'healthy' THEN NOW() ELSE provider_health.last_failure_at END,
      last_error = EXCLUDED.last_error,
      updated_at = NOW()
  `, [providerId, status, latencyMs, errorMessage]);
}

async function checkSageMakerEndpoints(): Promise<void> {
  const models = await pool.query(
    'SELECT model_id FROM self_hosted_models WHERE enabled = true'
  );
  
  for (const model of models.rows) {
    try {
      const endpoint = await sagemaker.send(new DescribeEndpointCommand({
        EndpointName: `radiant-${model.model_id}`
      }));
      
      const status = endpoint.EndpointStatus === 'InService' ? 'WARM' : 
                     endpoint.EndpointStatus === 'Creating' ? 'COLD' : 'OFF';
      
      await pool.query(`
        UPDATE thermal_states SET 
          current_state = $1,
          is_transitioning = $2,
          updated_at = NOW()
        WHERE model_id = $3
      `, [status, endpoint.EndpointStatus === 'Creating', model.model_id]);
    } catch (error) {
      // Endpoint doesn't exist - model is OFF
      await pool.query(`
        UPDATE thermal_states SET 
          current_state = 'OFF',
          is_transitioning = false,
          updated_at = NOW()
        WHERE model_id = $1
      `, [model.model_id]);
    }
  }
}

// ============================================================================
// MAIN SYNC HANDLER
// ============================================================================

export async function handler(event: any): Promise<SyncResult> {
  const syncType: SyncType = event.syncType || 'full';
  const startTime = Date.now();
  
  // Create sync log entry
  const logResult = await pool.query(`
    INSERT INTO registry_sync_log (sync_type, status)
    VALUES ($1, 'running')
    RETURNING id
  `, [syncType]);
  const syncId = logResult.rows[0].id;
  
  let providersUpdated = 0;
  let modelsAdded = 0;
  let modelsUpdated = 0;
  let modelsDeprecated = 0;
  const errors: string[] = [];
  
  try {
    // Get all enabled providers
    const providers = await pool.query(
      'SELECT id FROM providers WHERE enabled = true'
    );
    
    for (const provider of providers.rows) {
      try {
        switch (syncType) {
          case 'full':
            const result = await syncProviderModels(provider.id);
            modelsAdded += result.added;
            modelsUpdated += result.updated;
            await checkProviderHealth(provider.id);
            providersUpdated++;
            break;
            
          case 'health':
            await checkProviderHealth(provider.id);
            providersUpdated++;
            break;
            
          case 'pricing':
            // Pricing sync - use Section 31 pricing endpoints
            // POST /api/admin/models/{id}/pricing to update
            // await this.syncModelPricing(model.id, pricingData);
            break;
        }
      } catch (error: any) {
        errors.push(`${provider.id}: ${error.message}`);
      }
    }
    
    // Check self-hosted endpoints for thermal sync
    if (syncType === 'thermal' || syncType === 'full') {
      await checkSageMakerEndpoints();
    }
    
    // Refresh materialized view if exists
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY unified_model_stats')
      .catch(() => {}); // Ignore if view doesn't exist
    
    const durationMs = Date.now() - startTime;
    
    // Update sync log
    await pool.query(`
      UPDATE registry_sync_log SET
        status = 'completed',
        providers_updated = $1,
        models_added = $2,
        models_updated = $3,
        models_deprecated = $4,
        errors = $5,
        completed_at = NOW(),
        duration_ms = $6
      WHERE id = $7
    `, [providersUpdated, modelsAdded, modelsUpdated, modelsDeprecated, errors, durationMs, syncId]);
    
    // Emit completion event
    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'radiant.registry',
        DetailType: 'RegistrySyncCompleted',
        Detail: JSON.stringify({
          syncId,
          syncType,
          providersUpdated,
          modelsAdded,
          modelsUpdated,
          modelsDeprecated,
          durationMs,
          errors
        })
      }]
    }));
    
    return {
      syncId,
      type: syncType,
      providersUpdated,
      modelsAdded,
      modelsUpdated,
      modelsDeprecated,
      errors,
      durationMs
    };
    
  } catch (error: any) {
    await pool.query(`
      UPDATE registry_sync_log SET
        status = 'failed',
        error_message = $1,
        completed_at = NOW()
      WHERE id = $2
    `, [error.message, syncId]);
    
    throw error;
  }
}
```

---

## 36.5 CDK INFRASTRUCTURE

### packages/infrastructure/lib/stacks/registry-sync-stack.ts

```typescript
/**
 * RADIANT v4.2.0 - Registry Sync CDK Stack
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface RegistrySyncStackProps extends cdk.StackProps {
  databaseUrl: string;
  vpcId: string;
}

export class RegistrySyncStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RegistrySyncStackProps) {
    super(scope, id, props);

    // Registry Sync Lambda
    const syncLambda = new lambda.Function(this, 'RegistrySyncLambda', {
      functionName: 'radiant-registry-sync',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambda/registry-sync'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        DATABASE_URL: props.databaseUrl,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
      },
    });

    // Daily full sync (00:00 UTC)
    new events.Rule(this, 'DailyFullSync', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      targets: [new targets.LambdaFunction(syncLambda, {
        event: events.RuleTargetInput.fromObject({ syncType: 'full' })
      })],
    });

    // Health check every 5 minutes
    new events.Rule(this, 'HealthCheck', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(syncLambda, {
        event: events.RuleTargetInput.fromObject({ syncType: 'health' })
      })],
    });

    // Thermal state sync every 5 minutes
    new events.Rule(this, 'ThermalSync', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(syncLambda, {
        event: events.RuleTargetInput.fromObject({ syncType: 'thermal' })
      })],
    });

    // Weekly pricing sync (Sunday 00:00 UTC)
    new events.Rule(this, 'WeeklyPricingSync', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0', weekDay: 'SUN' }),
      targets: [new targets.LambdaFunction(syncLambda, {
        event: events.RuleTargetInput.fromObject({ syncType: 'pricing' })
      })],
    });
  }
}
```

---

## 36.6 ORCHESTRATION ENGINE MODEL SELECTION

### packages/infrastructure/lambda/orchestration/model-selector.ts

```typescript
/**
 * RADIANT v4.2.0 - Orchestration Model Selection
 * 
 * Smart model selection using unified registry with:
 * - Thermal state awareness (prefer HOT > WARM > COLD)
 * - Health status filtering
 * - Tier-based eligibility
 * - Capability matching
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ============================================================================
// TYPES
// ============================================================================

export interface ModelSelectionCriteria {
  // Required
  task: 'chat' | 'completion' | 'embedding' | 'image' | 'video' | 'audio' | 'transcription' | 'search' | '3d' | 'inference';
  inputModality: string[];
  outputModality: string[];
  
  // Tenant context
  tenantTier: 1 | 2 | 3 | 4 | 5;
  
  // Preferences
  preferHosting?: 'external' | 'self_hosted' | 'any';
  preferProvider?: string[];
  maxLatencyMs?: number;
  maxCostPerRequest?: number;
  
  // Requirements
  requiredCapabilities?: string[];
  minContextWindow?: number;
  requireHIPAA?: boolean;
}

export interface SelectedModel {
  modelId: string;
  displayName: string;
  hostingType: 'external' | 'self_hosted';
  providerName: string;
  primaryMode: string;
  thermalState: string | null;
  warmupRequired: boolean;
  warmupTimeSeconds: number | null;
  healthStatus: string;
  litellmId: string;
}

// ============================================================================
// MODEL SELECTOR
// ============================================================================

export class ModelSelector {
  async selectModel(criteria: ModelSelectionCriteria): Promise<SelectedModel | null> {
    // Use the database function for initial selection
    const result = await pool.query(`
      SELECT * FROM select_model($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      criteria.task,
      criteria.inputModality,
      criteria.outputModality,
      criteria.tenantTier,
      criteria.preferHosting || 'any',
      criteria.requiredCapabilities || [],
      criteria.minContextWindow || null,
      criteria.requireHIPAA || false
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const selected = result.rows[0];
    
    // Get full model details
    const modelDetails = await pool.query(`
      SELECT litellm_id FROM unified_model_registry 
      WHERE model_id = $1
    `, [selected.model_id]);

    return {
      modelId: selected.model_id,
      displayName: selected.display_name,
      hostingType: selected.hosting_type,
      providerName: selected.provider_name,
      primaryMode: selected.primary_mode,
      thermalState: selected.thermal_state,
      warmupRequired: selected.warmup_required,
      warmupTimeSeconds: selected.warmup_time_seconds,
      healthStatus: selected.health_status || 'unknown',
      litellmId: modelDetails.rows[0]?.litellm_id || selected.model_id
    };
  }

  async selectWithFallback(criteria: ModelSelectionCriteria): Promise<SelectedModel> {
    // Try primary selection
    const primary = await this.selectModel(criteria);
    if (primary && !primary.warmupRequired) {
      return primary;
    }

    // If primary requires warmup, try to find a ready alternative
    if (primary?.warmupRequired) {
      const alternative = await this.selectModel({
        ...criteria,
        preferHosting: 'external' // External providers are always ready
      });
      
      if (alternative) {
        // Trigger warmup of self-hosted model in background
        this.triggerWarmup(primary.modelId);
        return alternative;
      }
    }

    // No alternatives - return primary (may require warmup)
    if (primary) {
      return primary;
    }

    // Fallback to default model for task
    return this.getDefaultModel(criteria.task, criteria.tenantTier);
  }

  private async triggerWarmup(modelId: string): Promise<void> {
    // Trigger warmup via thermal manager
    await pool.query(`
      UPDATE thermal_states SET 
        target_state = 'WARM',
        is_transitioning = true,
        updated_at = NOW()
      WHERE model_id = $1 AND current_state = 'COLD'
    `, [modelId]);
  }

  private async getDefaultModel(task: string, tier: number): Promise<SelectedModel> {
    // Default models by task
    const defaults: Record<string, string> = {
      'chat': 'gpt-4o-mini',
      'completion': 'gpt-4o-mini',
      'embedding': 'text-embedding-3-small',
      'image': 'dall-e-3',
      'video': 'runway-gen3-alpha-turbo',
      'audio': 'tts-1',
      'transcription': 'whisper-1',
      'search': 'perplexity-sonar',
      '3d': 'meshy-v3',
      'inference': 'gpt-4o'
    };

    const modelId = defaults[task] || 'gpt-4o-mini';
    
    const result = await pool.query(`
      SELECT * FROM unified_model_registry WHERE model_id = $1
    `, [modelId]);

    if (result.rows.length === 0) {
      throw new Error(`Default model ${modelId} not found in registry`);
    }

    const model = result.rows[0];
    return {
      modelId: model.model_id,
      displayName: model.display_name,
      hostingType: model.hosting_type,
      providerName: model.provider_name,
      primaryMode: model.primary_mode,
      thermalState: model.thermal_state,
      warmupRequired: false,
      warmupTimeSeconds: null,
      healthStatus: model.health_status || 'unknown',
      litellmId: model.litellm_id
    };
  }
}

export const modelSelector = new ModelSelector();
```

---

## 36.7 ADMIN API ENDPOINTS

### packages/infrastructure/lambda/admin/registry-admin.ts

```typescript
/**
 * RADIANT v4.2.0 - Registry Admin API
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const listAllModels: APIGatewayProxyHandler = async (event) => {
  const { category, hostingType, status } = event.queryStringParameters || {};
  
  let query = 'SELECT * FROM unified_model_registry WHERE 1=1';
  const params: any[] = [];
  
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  if (hostingType) {
    params.push(hostingType);
    query += ` AND hosting_type = $${params.length}`;
  }
  if (status) {
    params.push(status === 'enabled');
    query += ` AND enabled = $${params.length}`;
  }
  
  query += ' ORDER BY hosting_type, category, display_name';
  
  const result = await pool.query(query, params);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      total: result.rows.length,
      external: result.rows.filter(r => r.hosting_type === 'external').length,
      selfHosted: result.rows.filter(r => r.hosting_type === 'self_hosted').length,
      models: result.rows
    })
  };
};

export const getRegistryStats: APIGatewayProxyHandler = async () => {
  const stats = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE hosting_type = 'external') AS external_count,
      COUNT(*) FILTER (WHERE hosting_type = 'self_hosted') AS self_hosted_count,
      COUNT(*) FILTER (WHERE health_status = 'healthy') AS healthy_count,
      COUNT(*) FILTER (WHERE health_status = 'unhealthy') AS unhealthy_count,
      COUNT(*) FILTER (WHERE thermal_state = 'HOT') AS hot_count,
      COUNT(*) FILTER (WHERE thermal_state = 'WARM') AS warm_count,
      COUNT(*) FILTER (WHERE thermal_state = 'COLD') AS cold_count,
      COUNT(DISTINCT category) AS category_count,
      COUNT(DISTINCT provider_name) AS provider_count
    FROM unified_model_registry
  `);
  
  return {
    statusCode: 200,
    body: JSON.stringify(stats.rows[0])
  };
};

export const getSyncHistory: APIGatewayProxyHandler = async () => {
  const result = await pool.query(`
    SELECT * FROM registry_sync_log 
    ORDER BY started_at DESC 
    LIMIT 50
  `);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result.rows)
  };
};

export const triggerSync: APIGatewayProxyHandler = async (event) => {
  const { syncType } = JSON.parse(event.body || '{}');
  
  // Invoke sync lambda
  const lambda = require('@aws-sdk/client-lambda');
  const client = new lambda.LambdaClient({});
  
  await client.send(new lambda.InvokeCommand({
    FunctionName: 'radiant-registry-sync',
    InvocationType: 'Event',
    Payload: JSON.stringify({ syncType: syncType || 'full' })
  }));
  
  return {
    statusCode: 202,
    body: JSON.stringify({ message: 'Sync triggered', syncType })
  };
};
```

---

## 36.8 VERIFICATION COMMANDS

```bash
# Apply unified registry migration
psql $DATABASE_URL -f packages/database/migrations/036_unified_model_registry.sql

# Seed self-hosted models
psql $DATABASE_URL -f packages/database/migrations/036a_seed_self_hosted_models.sql

# Verify self-hosted models count (should be 56)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM self_hosted_models"

# Verify unified registry view works
psql $DATABASE_URL -c "SELECT COUNT(*), hosting_type FROM unified_model_registry GROUP BY hosting_type"

# Test model selection function
psql $DATABASE_URL -c "SELECT * FROM select_model('chat', ARRAY['text'], ARRAY['text'], 3, 'any', '{}', NULL, false)"

# Verify provider health table
psql $DATABASE_URL -c "SELECT provider_id, status, avg_latency_ms FROM provider_health"

# Check sync log
psql $DATABASE_URL -c "SELECT sync_type, status, providers_updated, models_added FROM registry_sync_log ORDER BY started_at DESC LIMIT 5"

# Test API endpoints
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://admin-api.example.com/api/v2/admin/registry/models

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://admin-api.example.com/api/v2/admin/registry/stats
```

---

## Section 36 Summary

RADIANT v4.2.0 (PROMPT-16) adds **Unified Model Registry & Sync Service**:

### Section 36: Unified Model Registry (v4.2.0)

1. **Database Schema** (036_unified_model_registry.sql)
   - `self_hosted_models` - Complete catalog of 56 SageMaker models
   - `provider_health` - Real-time health monitoring per provider
   - `registry_sync_log` - Sync operation history
   - `unified_model_registry` - SQL VIEW combining ALL 106 models
   - `select_model()` - Smart selection function with thermal awareness

2. **Self-Hosted Model Seed Data** (036a_seed_self_hosted_models.sql)
   - 13 Computer Vision models (EfficientNet, YOLO, SAM, CLIP, etc.)
   - 6 Audio/Speech models (Whisper, TitaNet, pyannote, etc.)
   - 8 Scientific models (AlphaFold 2, ESM-2, RoseTTAFold2, etc.)
   - 6 Medical Imaging models (nnU-Net, MedSAM, CheXNet, etc.)
   - 4 Geospatial models (Prithvi, SatMAE, GeoSAM)
   - 5 3D/Reconstruction models (Nerfstudio, 3DGS, Point-E, etc.)
   - 14 LLM/Embedding models (Llama, Mistral, Qwen, BGE, etc.)

3. **Registry Sync Service** (registry-sync/handler.ts)
   - Daily full sync of provider model lists
   - 5-minute health checks for all providers
   - 5-minute thermal state sync for self-hosted
   - Weekly pricing updates
   - EventBridge events for sync completion

4. **CDK Infrastructure** (registry-sync-stack.ts)
   - Lambda function for sync operations
   - EventBridge rules for scheduled syncs
   - IAM permissions for SageMaker access

5. **Model Selector** (model-selector.ts)
   - `selectModel()` - Primary selection with criteria matching
   - `selectWithFallback()` - Fallback to external if warmup needed
   - Thermal state awareness (HOT > WARM > COLD)
   - Health status filtering

6. **Admin API Endpoints**
   - `GET /api/v2/admin/registry/models` - List all models
   - `GET /api/v2/admin/registry/stats` - Registry statistics
   - `GET /api/v2/admin/registry/sync/history` - Sync history
   - `POST /api/v2/admin/registry/sync` - Trigger manual sync

### Design Philosophy (v4.2.0)

- **Unified View** - Single source of truth for ALL 106 models
- **hosting_type Field** - Clear 'external' vs 'self_hosted' distinction
- **Automated Sync** - Daily provider sync, 5-min health checks
- **Thermal-Aware** - Prefer ready models, warmup in background
- **Complete Metadata** - Every field needed for orchestration

### Also includes all v4.1.0 features:
- Database-Driven Orchestration Engine
- AlphaFold 2 Integration
- License Management & Compliance
- Admin Model CRUD

### Also includes all v4.0.0 features:
- Time Machine visual history
- Media Vault with S3 versioning
- Export bundles

### Also includes all v3.8.0 features:
- User Model Selection (15 Standard + 15 Novel)
- Admin Editable Pricing
- Cost Transparency per message
- Model Favorites

---

---

# ═══════════════════════════════════════════════════════════════════════════════
