-- RADIANT v4.18.0 - Migration 073: Ethical Guardrails (Jesus's Teachings)

-- Ethical Principles Table
CREATE TABLE IF NOT EXISTS ethical_principles (
    principle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    teaching TEXT NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('love', 'mercy', 'truth', 'service', 'humility', 'peace', 'forgiveness')),
    weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ethical_principles_tenant ON ethical_principles(tenant_id);
CREATE INDEX idx_ethical_principles_category ON ethical_principles(category);

-- Ethical Evaluations Log
CREATE TABLE IF NOT EXISTS ethical_evaluations (
    evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    principles_applied JSONB NOT NULL DEFAULT '[]'::jsonb,
    ethical_score DECIMAL(4,3) NOT NULL,
    concerns JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    approved BOOLEAN NOT NULL,
    reasoning TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ethical_evaluations_tenant ON ethical_evaluations(tenant_id);
CREATE INDEX idx_ethical_evaluations_approved ON ethical_evaluations(approved);

-- RLS
ALTER TABLE ethical_principles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ethical_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_ethical_principles ON ethical_principles USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_ethical_evaluations ON ethical_evaluations USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
