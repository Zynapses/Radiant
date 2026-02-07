-- Migration: 171_structure_from_chaos.sql
-- Moat #20: Structure from Chaos Synthesis - Transform whiteboard chaos into structured outputs

-- Synthesis configuration per tenant
CREATE TABLE IF NOT EXISTS synthesis_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    default_output_type VARCHAR(50) NOT NULL DEFAULT 'meeting_summary',
    extract_entities BOOLEAN NOT NULL DEFAULT true,
    extract_relationships BOOLEAN NOT NULL DEFAULT true,
    generate_timeline BOOLEAN NOT NULL DEFAULT true,
    generate_action_items BOOLEAN NOT NULL DEFAULT true,
    auto_assign_tasks BOOLEAN NOT NULL DEFAULT false,
    confidence_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.70,
    max_processing_time_ms INTEGER NOT NULL DEFAULT 30000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Chaotic inputs
CREATE TABLE IF NOT EXISTS chaotic_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_id UUID,
    input_type VARCHAR(50) NOT NULL,
    raw_content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    context TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_input_type CHECK (input_type IN ('whiteboard', 'brainstorm', 'meeting_notes', 'voice_transcript', 'chat_history', 'document_dump', 'mixed'))
);

-- Structured outputs
CREATE TABLE IF NOT EXISTS structured_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_id UUID NOT NULL REFERENCES chaotic_inputs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    output_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    summary TEXT NOT NULL,
    content JSONB NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_output_type CHECK (output_type IN ('decisions', 'action_items', 'project_plan', 'meeting_summary', 'knowledge_base', 'data_table', 'timeline', 'hierarchy', 'comparison'))
);

-- Extracted entities
CREATE TABLE IF NOT EXISTS extracted_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    output_id UUID NOT NULL REFERENCES structured_outputs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    mentions JSONB NOT NULL DEFAULT '[]',
    attributes JSONB DEFAULT '{}',
    confidence DECIMAL(3,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('person', 'organization', 'project', 'product', 'date', 'location', 'concept', 'metric', 'resource'))
);

-- Entity relationships
CREATE TABLE IF NOT EXISTS entity_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    output_id UUID NOT NULL REFERENCES structured_outputs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES extracted_entities(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES extracted_entities(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    strength DECIMAL(3,2) NOT NULL,
    evidence TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_relationship_type CHECK (relationship_type IN ('owns', 'assigned_to', 'depends_on', 'blocks', 'related_to', 'parent_of', 'precedes', 'contradicts', 'supports'))
);

-- Structured items (action items, decisions, questions, etc.)
CREATE TABLE IF NOT EXISTS structured_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    output_id UUID NOT NULL REFERENCES structured_outputs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    assignee VARCHAR(200),
    due_date TIMESTAMPTZ,
    priority VARCHAR(20),
    status VARCHAR(50) DEFAULT 'pending',
    tags TEXT[] DEFAULT '{}',
    dependencies UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_item_type CHECK (item_type IN ('decision', 'action_item', 'question', 'insight', 'risk', 'opportunity', 'milestone', 'blocker')),
    CONSTRAINT valid_priority CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked'))
);

-- Whiteboard elements (for visual parsing)
CREATE TABLE IF NOT EXISTS whiteboard_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_id UUID NOT NULL REFERENCES chaotic_inputs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    element_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    position JSONB NOT NULL,
    size JSONB NOT NULL,
    color VARCHAR(50),
    connected_to UUID[],
    group_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_element_type CHECK (element_type IN ('sticky', 'shape', 'connector', 'text', 'image', 'frame'))
);

-- Synthesis metrics
CREATE TABLE IF NOT EXISTS synthesis_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_syntheses INTEGER NOT NULL DEFAULT 0,
    by_input_type JSONB NOT NULL DEFAULT '{}',
    by_output_type JSONB NOT NULL DEFAULT '{}',
    average_processing_ms INTEGER NOT NULL DEFAULT 0,
    average_confidence DECIMAL(3,2) NOT NULL DEFAULT 0,
    total_action_items INTEGER NOT NULL DEFAULT 0,
    total_decisions INTEGER NOT NULL DEFAULT 0,
    total_entities INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, period, period_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chaotic_inputs_tenant ON chaotic_inputs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chaotic_inputs_user ON chaotic_inputs(user_id);
CREATE INDEX IF NOT EXISTS idx_chaotic_inputs_type ON chaotic_inputs(input_type);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_input ON structured_outputs(input_id);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_tenant ON structured_outputs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_output ON extracted_entities(output_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_output ON entity_relationships(output_id);
CREATE INDEX IF NOT EXISTS idx_structured_items_output ON structured_items(output_id);
CREATE INDEX IF NOT EXISTS idx_structured_items_assignee ON structured_items(assignee);
CREATE INDEX IF NOT EXISTS idx_structured_items_status ON structured_items(status);
CREATE INDEX IF NOT EXISTS idx_whiteboard_elements_input ON whiteboard_elements(input_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_metrics_tenant ON synthesis_metrics(tenant_id, period_start);

-- RLS Policies
ALTER TABLE synthesis_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE chaotic_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE structured_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE structured_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY synthesis_config_tenant_isolation ON synthesis_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY chaotic_inputs_tenant_isolation ON chaotic_inputs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY structured_outputs_tenant_isolation ON structured_outputs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY extracted_entities_tenant_isolation ON extracted_entities
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY entity_relationships_tenant_isolation ON entity_relationships
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY structured_items_tenant_isolation ON structured_items
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY whiteboard_elements_tenant_isolation ON whiteboard_elements
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY synthesis_metrics_tenant_isolation ON synthesis_metrics
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Comments
COMMENT ON TABLE synthesis_config IS 'Moat #20: Structure from Chaos synthesis configuration per tenant';
COMMENT ON TABLE chaotic_inputs IS 'Moat #20: Raw chaotic inputs (whiteboards, brainstorms, meeting notes)';
COMMENT ON TABLE structured_outputs IS 'Moat #20: Structured outputs generated from chaotic inputs';
COMMENT ON TABLE extracted_entities IS 'Moat #20: Entities extracted from chaotic inputs';
COMMENT ON TABLE entity_relationships IS 'Moat #20: Relationships between extracted entities';
COMMENT ON TABLE structured_items IS 'Moat #20: Action items, decisions, questions extracted from inputs';
COMMENT ON TABLE whiteboard_elements IS 'Moat #20: Visual whiteboard elements for parsing';
COMMENT ON TABLE synthesis_metrics IS 'Moat #20: Usage metrics for chaos synthesis';
