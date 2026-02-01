-- ============================================================================
-- RADIANT v5.52.58 - UEP Self-Healing System Tables
-- Migration: V2026_01_30_001__uep_self_healing.sql
--
-- Creates tables for:
-- - UEP write transactions tracking
-- - Envelope storage with write status
-- - Quarantine for corrupted envelopes
-- - Self-healing reports
-- ============================================================================

-- UEP Write Transactions - Track pending envelope writes
CREATE TABLE IF NOT EXISTS uep_write_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    envelope_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    CONSTRAINT uep_write_tx_status_check CHECK (status IN ('pending', 'committed', 'rolled_back', 'failed'))
);

CREATE INDEX idx_uep_write_tx_tenant_status ON uep_write_transactions(tenant_id, status);
CREATE INDEX idx_uep_write_tx_pending ON uep_write_transactions(tenant_id, status, created_at) 
    WHERE status = 'pending';

-- Enable RLS
ALTER TABLE uep_write_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY uep_write_tx_tenant_isolation ON uep_write_transactions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- UEP Envelope Storage - Primary envelope storage with write status tracking
CREATE TABLE IF NOT EXISTS uep_envelope_storage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    envelope_id UUID NOT NULL,
    envelope_type VARCHAR(100) NOT NULL,
    envelope_data JSONB NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    s3_key VARCHAR(500),
    write_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT uep_storage_unique UNIQUE(tenant_id, envelope_id),
    CONSTRAINT uep_storage_status_check CHECK (write_status IN ('pending', 'partial', 'complete', 'failed', 'quarantined'))
);

CREATE INDEX idx_uep_storage_tenant ON uep_envelope_storage(tenant_id);
CREATE INDEX idx_uep_storage_type ON uep_envelope_storage(tenant_id, envelope_type);
CREATE INDEX idx_uep_storage_status ON uep_envelope_storage(tenant_id, write_status);
CREATE INDEX idx_uep_storage_partial ON uep_envelope_storage(tenant_id, write_status, created_at) 
    WHERE write_status = 'partial';
CREATE INDEX idx_uep_storage_s3_key ON uep_envelope_storage(s3_key) WHERE s3_key IS NOT NULL;

-- Enable RLS
ALTER TABLE uep_envelope_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY uep_storage_tenant_isolation ON uep_envelope_storage
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- UEP Envelope Index - Quick lookup index for envelopes
CREATE TABLE IF NOT EXISTS uep_envelope_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    envelope_id UUID NOT NULL,
    envelope_type VARCHAR(100) NOT NULL,
    trace_id VARCHAR(64),
    span_id VARCHAR(32),
    parent_span_id VARCHAR(32),
    source_component VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uep_index_unique UNIQUE(tenant_id, envelope_id)
);

CREATE INDEX idx_uep_index_tenant ON uep_envelope_index(tenant_id);
CREATE INDEX idx_uep_index_trace ON uep_envelope_index(tenant_id, trace_id);
CREATE INDEX idx_uep_index_type ON uep_envelope_index(tenant_id, envelope_type);
CREATE INDEX idx_uep_index_created ON uep_envelope_index(tenant_id, created_at);

-- Enable RLS
ALTER TABLE uep_envelope_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY uep_index_tenant_isolation ON uep_envelope_index
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- UEP Quarantine - Store corrupted or problematic envelopes
CREATE TABLE IF NOT EXISTS uep_quarantine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    envelope_id UUID NOT NULL,
    envelope_data JSONB,
    quarantine_reason TEXT NOT NULL,
    original_error TEXT,
    quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id),
    resolution VARCHAR(50),
    resolution_notes TEXT,
    CONSTRAINT uep_quarantine_resolution_check CHECK (resolution IS NULL OR resolution IN ('recovered', 'discarded', 'manual_fix'))
);

CREATE INDEX idx_uep_quarantine_tenant ON uep_quarantine(tenant_id);
CREATE INDEX idx_uep_quarantine_envelope ON uep_quarantine(tenant_id, envelope_id);
CREATE INDEX idx_uep_quarantine_pending ON uep_quarantine(tenant_id, resolution) 
    WHERE resolution IS NULL;

-- Enable RLS
ALTER TABLE uep_quarantine ENABLE ROW LEVEL SECURITY;

CREATE POLICY uep_quarantine_tenant_isolation ON uep_quarantine
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- UEP Healing Reports - Track self-healing run results
CREATE TABLE IF NOT EXISTS uep_healing_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_id UUID NOT NULL,
    mode VARCHAR(20) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    issues_found INTEGER NOT NULL DEFAULT 0,
    issues_resolved INTEGER NOT NULL DEFAULT 0,
    issues_failed INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL,
    report_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uep_healing_mode_check CHECK (mode IN ('startup', 'adhoc', 'scheduled'))
);

CREATE INDEX idx_uep_healing_tenant ON uep_healing_reports(tenant_id);
CREATE INDEX idx_uep_healing_run ON uep_healing_reports(tenant_id, run_id);
CREATE INDEX idx_uep_healing_date ON uep_healing_reports(tenant_id, started_at);

-- Enable RLS
ALTER TABLE uep_healing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY uep_healing_tenant_isolation ON uep_healing_reports
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Persistence WAL - Write-ahead log for atomic persistence
CREATE TABLE IF NOT EXISTS persistence_wal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'begin',
    operations JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT persistence_wal_status_check CHECK (status IN ('begin', 'prepare', 'commit', 'rollback', 'recovered'))
);

CREATE INDEX idx_persistence_wal_tenant ON persistence_wal(tenant_id);
CREATE INDEX idx_persistence_wal_status ON persistence_wal(tenant_id, status);
CREATE INDEX idx_persistence_wal_pending ON persistence_wal(tenant_id, status, created_at) 
    WHERE status = 'prepare';

-- Enable RLS
ALTER TABLE persistence_wal ENABLE ROW LEVEL SECURITY;

CREATE POLICY persistence_wal_tenant_isolation ON persistence_wal
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Persistence Records - Atomic record storage with checksums
CREATE TABLE IF NOT EXISTS persistence_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT persistence_records_unique UNIQUE(tenant_id, table_name, record_id)
);

CREATE INDEX idx_persistence_records_tenant ON persistence_records(tenant_id);
CREATE INDEX idx_persistence_records_table ON persistence_records(tenant_id, table_name);
CREATE INDEX idx_persistence_records_incomplete ON persistence_records(tenant_id, is_complete) 
    WHERE is_complete = FALSE;

-- Enable RLS
ALTER TABLE persistence_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY persistence_records_tenant_isolation ON persistence_records
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- AI Curator Tables (for AI-powered knowledge extraction)
-- ============================================================================

-- Curator AI Extractions - Track AI document extractions
CREATE TABLE IF NOT EXISTS curator_ai_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL,
    extraction_type VARCHAR(50) NOT NULL,
    extracted_items JSONB NOT NULL,
    total_extracted INTEGER NOT NULL DEFAULT 0,
    model_used VARCHAR(100) NOT NULL,
    confidence_avg DECIMAL(5,4),
    processing_time_ms INTEGER,
    uep_envelope_id UUID,
    trace_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT curator_extraction_type_check CHECK (extraction_type IN ('facts', 'procedures', 'entities', 'concepts', 'relationships', 'mixed'))
);

CREATE INDEX idx_curator_ai_extract_tenant ON curator_ai_extractions(tenant_id);
CREATE INDEX idx_curator_ai_extract_doc ON curator_ai_extractions(tenant_id, document_id);
CREATE INDEX idx_curator_ai_extract_trace ON curator_ai_extractions(tenant_id, trace_id);

-- Enable RLS
ALTER TABLE curator_ai_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY curator_ai_extract_tenant_isolation ON curator_ai_extractions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Curator AI Questions - Track AI-generated exam questions
CREATE TABLE IF NOT EXISTS curator_ai_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    exam_id UUID,
    question_type VARCHAR(30) NOT NULL,
    statement TEXT NOT NULL,
    correct_answer VARCHAR(10),
    option_a TEXT,
    option_b TEXT,
    source_node_id UUID,
    confidence DECIMAL(5,4) NOT NULL,
    difficulty VARCHAR(10) NOT NULL,
    ai_reasoning TEXT,
    uep_envelope_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT curator_question_type_check CHECK (question_type IN ('fact_check', 'logic_check', 'ambiguity')),
    CONSTRAINT curator_question_difficulty_check CHECK (difficulty IN ('easy', 'medium', 'hard'))
);

CREATE INDEX idx_curator_ai_questions_tenant ON curator_ai_questions(tenant_id);
CREATE INDEX idx_curator_ai_questions_exam ON curator_ai_questions(tenant_id, exam_id);
CREATE INDEX idx_curator_ai_questions_type ON curator_ai_questions(tenant_id, question_type);

-- Enable RLS
ALTER TABLE curator_ai_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY curator_ai_questions_tenant_isolation ON curator_ai_questions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Curator AI Verifications - Track AI answer verifications
CREATE TABLE IF NOT EXISTS curator_ai_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES curator_ai_questions(id),
    user_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    confidence DECIMAL(5,4) NOT NULL,
    ai_assessment TEXT,
    suggested_correction TEXT,
    should_create_golden_rule BOOLEAN DEFAULT FALSE,
    golden_rule_reason TEXT,
    uep_envelope_id UUID,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_curator_ai_verify_tenant ON curator_ai_verifications(tenant_id);
CREATE INDEX idx_curator_ai_verify_question ON curator_ai_verifications(tenant_id, question_id);

-- Enable RLS
ALTER TABLE curator_ai_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY curator_ai_verify_tenant_isolation ON curator_ai_verifications
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE uep_write_transactions IS 'Tracks UEP envelope write transactions for durability and recovery';
COMMENT ON TABLE uep_envelope_storage IS 'Primary storage for UEP envelopes with write status tracking';
COMMENT ON TABLE uep_envelope_index IS 'Quick lookup index for UEP envelopes by trace, type, etc.';
COMMENT ON TABLE uep_quarantine IS 'Quarantine storage for corrupted or problematic UEP envelopes';
COMMENT ON TABLE uep_healing_reports IS 'Self-healing run reports for audit and monitoring';
COMMENT ON TABLE persistence_wal IS 'Write-ahead log for atomic persistence operations';
COMMENT ON TABLE persistence_records IS 'Atomic record storage with checksum validation';
COMMENT ON TABLE curator_ai_extractions IS 'AI-powered document extraction results with UEP tracing';
COMMENT ON TABLE curator_ai_questions IS 'AI-generated entrance exam questions';
COMMENT ON TABLE curator_ai_verifications IS 'AI answer verification results';
