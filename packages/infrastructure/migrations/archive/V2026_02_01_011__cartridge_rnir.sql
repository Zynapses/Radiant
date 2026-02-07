-- ============================================================================
-- RNIR (Radiant Neural Intermediate Representation) Schema
-- Model-agnostic cognitive source code for cartridges
-- 
-- Version: 1.0.0
-- Date: 2026-02-01
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

CREATE TYPE rnir_compilation_target AS ENUM (
  'lora',
  'system_prompt',
  'few_shot',
  'rag_chunks',
  'all'
);

CREATE TYPE rnir_model_family AS ENUM (
  'llama',
  'qwen',
  'mistral',
  'claude',
  'gpt',
  'gemini',
  'universal'
);

CREATE TYPE rnir_compilation_status AS ENUM (
  'pending',
  'queued',
  'compiling',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE rnir_example_source AS ENUM (
  'curator',
  'manual',
  'synthetic',
  'imported'
);

-- ----------------------------------------------------------------------------
-- RNIR Documents Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rnir_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Document metadata
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  domain VARCHAR(100) NOT NULL,
  
  -- Statistics
  example_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  avg_quality DECIMAL(3,2),
  
  -- Storage
  s3_path TEXT,
  size_bytes BIGINT,
  checksum VARCHAR(64),
  
  -- Generation info
  generated_by VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT rnir_doc_cartridge_domain_unique UNIQUE (cartridge_id, domain)
);

-- Enable RLS
ALTER TABLE rnir_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY rnir_documents_tenant_isolation ON rnir_documents
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_rnir_documents_cartridge ON rnir_documents(cartridge_id);
CREATE INDEX idx_rnir_documents_tenant ON rnir_documents(tenant_id);
CREATE INDEX idx_rnir_documents_domain ON rnir_documents(tenant_id, domain);

-- ----------------------------------------------------------------------------
-- RNIR Examples Table (for searchable examples)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rnir_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES rnir_documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Example content
  user_input TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  system_context TEXT,
  
  -- Metadata
  domain VARCHAR(100),
  tags JSONB DEFAULT '[]'::jsonb,
  quality DECIMAL(3,2),
  source rnir_example_source NOT NULL DEFAULT 'curator',
  
  -- Token counts
  user_tokens INTEGER,
  assistant_tokens INTEGER,
  
  -- Embedding for semantic search
  embedding vector(1536),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rnir_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY rnir_examples_tenant_isolation ON rnir_examples
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_rnir_examples_document ON rnir_examples(document_id);
CREATE INDEX idx_rnir_examples_tenant ON rnir_examples(tenant_id);
CREATE INDEX idx_rnir_examples_domain ON rnir_examples(tenant_id, domain);
CREATE INDEX idx_rnir_examples_quality ON rnir_examples(quality DESC) WHERE quality IS NOT NULL;
CREATE INDEX idx_rnir_examples_embedding ON rnir_examples USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ----------------------------------------------------------------------------
-- RNIR Compilation Jobs
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rnir_compilation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cartridge_id UUID NOT NULL,
  
  -- Compilation settings
  target rnir_compilation_target NOT NULL,
  model_family rnir_model_family NOT NULL,
  model_id VARCHAR(100),
  
  -- LoRA settings (if target is lora)
  lora_settings JSONB,
  
  -- System prompt settings (if target is system_prompt)
  prompt_settings JSONB,
  
  -- Status
  status rnir_compilation_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  current_step TEXT,
  
  -- Priority
  priority INTEGER NOT NULL DEFAULT 5,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error info
  error TEXT,
  error_details JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rnir_compilation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY rnir_compilation_jobs_tenant_isolation ON rnir_compilation_jobs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_rnir_compilation_jobs_tenant ON rnir_compilation_jobs(tenant_id);
CREATE INDEX idx_rnir_compilation_jobs_cartridge ON rnir_compilation_jobs(cartridge_id);
CREATE INDEX idx_rnir_compilation_jobs_status ON rnir_compilation_jobs(status, priority DESC) WHERE status IN ('pending', 'queued');
CREATE INDEX idx_rnir_compilation_jobs_active ON rnir_compilation_jobs(tenant_id, status) WHERE status IN ('pending', 'queued', 'compiling');

-- ----------------------------------------------------------------------------
-- RNIR Compiled Artifacts
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rnir_compiled_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES rnir_compilation_jobs(id) ON DELETE CASCADE,
  cartridge_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  
  -- Artifact info
  target rnir_compilation_target NOT NULL,
  model_family rnir_model_family NOT NULL,
  model_id VARCHAR(100),
  
  -- Storage
  artifact_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  
  -- Status
  status rnir_compilation_status NOT NULL DEFAULT 'completed',
  
  -- Metrics
  training_loss DECIMAL(10,6),
  validation_loss DECIMAL(10,6),
  examples_processed INTEGER,
  compilation_time_seconds INTEGER,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rnir_compiled_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY rnir_compiled_artifacts_tenant_isolation ON rnir_compiled_artifacts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_rnir_artifacts_job ON rnir_compiled_artifacts(job_id);
CREATE INDEX idx_rnir_artifacts_cartridge ON rnir_compiled_artifacts(cartridge_id);
CREATE INDEX idx_rnir_artifacts_tenant ON rnir_compiled_artifacts(tenant_id);
CREATE INDEX idx_rnir_artifacts_target ON rnir_compiled_artifacts(cartridge_id, target, model_family);

-- ----------------------------------------------------------------------------
-- Update triggers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_rnir_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rnir_documents_update_timestamp
  BEFORE UPDATE ON rnir_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_rnir_timestamp();

CREATE TRIGGER rnir_compilation_jobs_update_timestamp
  BEFORE UPDATE ON rnir_compilation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_rnir_timestamp();

-- ----------------------------------------------------------------------------
-- Helper function to update document stats
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_rnir_document_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rnir_documents
  SET 
    example_count = (SELECT COUNT(*) FROM rnir_examples WHERE document_id = COALESCE(NEW.document_id, OLD.document_id)),
    total_tokens = (SELECT COALESCE(SUM(user_tokens + assistant_tokens), 0) FROM rnir_examples WHERE document_id = COALESCE(NEW.document_id, OLD.document_id)),
    avg_quality = (SELECT AVG(quality) FROM rnir_examples WHERE document_id = COALESCE(NEW.document_id, OLD.document_id) AND quality IS NOT NULL),
    modified_at = NOW()
  WHERE id = COALESCE(NEW.document_id, OLD.document_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rnir_examples_stats_insert
  AFTER INSERT ON rnir_examples
  FOR EACH ROW
  EXECUTE FUNCTION update_rnir_document_stats();

CREATE TRIGGER rnir_examples_stats_delete
  AFTER DELETE ON rnir_examples
  FOR EACH ROW
  EXECUTE FUNCTION update_rnir_document_stats();

-- ----------------------------------------------------------------------------
-- Comments
-- ----------------------------------------------------------------------------

COMMENT ON TABLE rnir_documents IS 'RNIR documents - model-agnostic cognitive source code';
COMMENT ON TABLE rnir_examples IS 'Individual training examples within RNIR documents';
COMMENT ON TABLE rnir_compilation_jobs IS 'Jobs for compiling RNIR to LoRA/prompts';
COMMENT ON TABLE rnir_compiled_artifacts IS 'Compiled artifacts from RNIR (LoRA weights, prompts, etc.)';
