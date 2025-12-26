-- RADIANT v4.17.0 - Migration 024: Orchestration Engine
-- Database-driven workflow and task orchestration

CREATE TABLE workflow_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('generation', 'analysis', 'transformation', 'pipeline', 'custom')),
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    
    dag_definition JSONB NOT NULL DEFAULT '{}',
    input_schema JSONB NOT NULL DEFAULT '{}',
    output_schema JSONB NOT NULL DEFAULT '{}',
    default_parameters JSONB NOT NULL DEFAULT '{}',
    
    timeout_seconds INTEGER DEFAULT 3600,
    max_retries INTEGER DEFAULT 3,
    min_tier INTEGER DEFAULT 1,
    
    is_active BOOLEAN DEFAULT true,
    requires_audit_trail BOOLEAN DEFAULT false,
    hipaa_compliant BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE TABLE workflow_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    task_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('model_inference', 'transformation', 'condition', 'parallel', 'aggregation', 'external_api', 'human_review')),
    model_id VARCHAR(100),
    service_id VARCHAR(100),
    
    config JSONB NOT NULL DEFAULT '{}',
    input_mapping JSONB DEFAULT '{}',
    output_mapping JSONB DEFAULT '{}',
    
    sequence_order INTEGER DEFAULT 0,
    depends_on TEXT[] DEFAULT '{}',
    condition_expression TEXT,
    timeout_seconds INTEGER DEFAULT 300,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workflow_id, task_id)
);

CREATE TABLE workflow_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    parameter_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,
    
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'array', 'object', 'file')),
    default_value JSONB,
    validation_rules JSONB DEFAULT '{}',
    
    ui_component VARCHAR(50) DEFAULT 'text',
    ui_config JSONB DEFAULT '{}',
    
    is_required BOOLEAN DEFAULT false,
    user_configurable BOOLEAN DEFAULT true,
    admin_only BOOLEAN DEFAULT false,
    sequence_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workflow_id, parameter_name)
);

CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    
    input_parameters JSONB NOT NULL DEFAULT '{}',
    resolved_parameters JSONB DEFAULT '{}',
    output_data JSONB,
    
    error_message TEXT,
    error_details JSONB,
    
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    estimated_cost_usd DECIMAL(10, 4),
    actual_cost_usd DECIMAL(10, 4),
    
    checkpoint_data JSONB,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE task_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    task_id VARCHAR(100) NOT NULL,
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'retrying')),
    attempt_number INTEGER DEFAULT 1,
    
    input_data JSONB,
    output_data JSONB,
    
    error_message TEXT,
    error_code VARCHAR(50),
    
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    resource_usage JSONB DEFAULT '{}',
    cost_usd DECIMAL(10, 4),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_definitions_category ON workflow_definitions(category);
CREATE INDEX idx_workflow_definitions_active ON workflow_definitions(is_active) WHERE is_active = true;
CREATE INDEX idx_workflow_tasks_workflow ON workflow_tasks(workflow_id, sequence_order);
CREATE INDEX idx_workflow_executions_tenant ON workflow_executions(tenant_id, created_at DESC);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_task_executions_workflow ON task_executions(workflow_execution_id);
CREATE INDEX idx_task_executions_status ON task_executions(status);

ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;

-- Workflow definitions are visible to all
CREATE POLICY workflow_definitions_read ON workflow_definitions FOR SELECT USING (true);
CREATE POLICY workflow_tasks_read ON workflow_tasks FOR SELECT USING (true);
CREATE POLICY workflow_parameters_read ON workflow_parameters FOR SELECT USING (true);

-- Executions are tenant-isolated
CREATE POLICY workflow_executions_isolation ON workflow_executions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY task_executions_isolation ON task_executions
    FOR ALL USING (
        workflow_execution_id IN (
            SELECT id FROM workflow_executions 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

CREATE TRIGGER update_workflow_definitions_updated_at 
    BEFORE UPDATE ON workflow_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_executions_updated_at 
    BEFORE UPDATE ON workflow_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
