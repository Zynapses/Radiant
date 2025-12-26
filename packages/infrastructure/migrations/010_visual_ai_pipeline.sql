-- RADIANT v4.17.0 - Migration 010: Visual AI Pipeline
-- Extends database for visual AI models and pipeline jobs

-- Model thermal state tracking
ALTER TABLE models ADD COLUMN IF NOT EXISTS thermal_state VARCHAR(20) DEFAULT 'cold';
ALTER TABLE models ADD COLUMN IF NOT EXISTS warm_until TIMESTAMPTZ;
ALTER TABLE models ADD COLUMN IF NOT EXISTS auto_thermal_enabled BOOLEAN DEFAULT true;

-- Visual pipeline job tracking
CREATE TABLE visual_pipeline_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pipeline_type VARCHAR(50) NOT NULL CHECK (pipeline_type IN ('segment', 'inpaint', 'upscale', 'interpolate', 'face_restore', 'matting')),
    source_asset_key VARCHAR(500) NOT NULL,
    output_asset_key VARCHAR(500),
    models_used TEXT[] NOT NULL DEFAULT '{}',
    parameters JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    cost DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visual_jobs_tenant ON visual_pipeline_jobs(tenant_id);
CREATE INDEX idx_visual_jobs_user ON visual_pipeline_jobs(user_id);
CREATE INDEX idx_visual_jobs_status ON visual_pipeline_jobs(status);
CREATE INDEX idx_visual_jobs_created ON visual_pipeline_jobs(created_at DESC);

ALTER TABLE visual_pipeline_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY visual_jobs_tenant_isolation ON visual_pipeline_jobs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY visual_jobs_super_admin ON visual_pipeline_jobs
    FOR SELECT USING (current_setting('app.is_super_admin', true)::boolean = true);

-- Trigger for updated_at
CREATE TRIGGER update_visual_pipeline_jobs_updated_at 
    BEFORE UPDATE ON visual_pipeline_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert visual AI models
INSERT INTO providers (name, display_name, type, category, base_url, status, config) VALUES
    ('visual-ai', 'RADIANT Visual AI', 'self_hosted', 'image', 'internal://visual-pipeline', 'active', '{"markup_percent": 75}')
ON CONFLICT (name) DO NOTHING;
