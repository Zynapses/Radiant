-- ============================================================================
-- RADIANT v5.0 - SOVEREIGN MESH: HITL APPROVAL QUEUES
-- Migration: V2026_01_20_008
-- 
-- Human-in-the-Loop approval system for high-stakes decisions.
-- Configurable queues with SLA monitoring, escalation paths, and audit trails.
-- ============================================================================

CREATE TYPE hitl_trigger_type AS ENUM (
  'workflow_step', 'ecd_threshold', 'domain_match', 'cost_threshold', 
  'agent_plan', 'safety_flag', 'always'
);

CREATE TYPE hitl_request_status AS ENUM (
  'pending', 'approved', 'rejected', 'expired', 'escalated', 'auto_approved'
);

CREATE TYPE hitl_priority AS ENUM ('low', 'normal', 'high', 'critical');

-- ============================================================================
-- HITL QUEUE CONFIGURATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_queue_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Trigger configuration
  trigger_type hitl_trigger_type NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  
  -- Timeouts
  default_timeout_minutes INTEGER NOT NULL DEFAULT 60,
  escalation_timeout_minutes INTEGER DEFAULT 30,
  
  -- Escalation path (array of user IDs or role names)
  escalation_path JSONB DEFAULT '[]',
  max_escalation_level INTEGER DEFAULT 3,
  
  -- Actions on timeout/escalation exhausted
  on_timeout_action VARCHAR(50) DEFAULT 'escalate', -- 'escalate', 'reject', 'auto_approve'
  on_escalation_exhausted VARCHAR(50) DEFAULT 'reject',
  
  -- Notifications
  notification_config JSONB DEFAULT '{
    "email": true,
    "slack": false,
    "in_app": true
  }',
  
  -- Auto-approval rules
  auto_approve_config JSONB DEFAULT '{
    "enabled": false,
    "conditions": []
  }',
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_queue_name UNIQUE (tenant_id, name)
);

-- ============================================================================
-- HITL APPROVAL REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES hitl_queue_configs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Source references
  workflow_id UUID,
  agent_execution_id UUID REFERENCES agent_executions(id),
  decision_event_id UUID REFERENCES cato_decision_events(id),
  blueprint_id UUID REFERENCES workflow_blueprints(id),
  
  -- Request details
  request_type VARCHAR(50) NOT NULL,
  request_summary TEXT NOT NULL,
  request_details JSONB NOT NULL,
  
  -- War Room context (if applicable)
  war_room_summary TEXT,
  war_room_deliberation_id UUID,
  
  -- Proposed action
  proposed_action JSONB,
  
  -- Status
  status hitl_request_status NOT NULL DEFAULT 'pending',
  priority hitl_priority NOT NULL DEFAULT 'normal',
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  escalated_at TIMESTAMPTZ,
  escalation_level INTEGER DEFAULT 0,
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_action VARCHAR(50), -- 'approved', 'rejected', 'modified'
  resolution_notes TEXT,
  resolution_modifications JSONB,
  
  -- Audit
  merkle_hash VARCHAR(64),
  
  -- Requester
  requested_by_user UUID REFERENCES users(id),
  requested_by_agent UUID REFERENCES agents(id)
);

-- ============================================================================
-- HITL REVIEWER ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_reviewer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES hitl_queue_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Permissions
  can_approve BOOLEAN NOT NULL DEFAULT true,
  can_reject BOOLEAN NOT NULL DEFAULT true,
  can_modify BOOLEAN NOT NULL DEFAULT false,
  can_escalate BOOLEAN NOT NULL DEFAULT true,
  
  -- Limits
  max_pending INTEGER, -- NULL = unlimited
  escalation_level INTEGER NOT NULL DEFAULT 0,
  
  -- Availability
  is_active BOOLEAN NOT NULL DEFAULT true,
  available_hours JSONB, -- e.g., {"monday": ["09:00-17:00"], ...}
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_reviewer_queue UNIQUE (queue_id, user_id)
);

-- ============================================================================
-- HITL REQUEST COMMENTS (discussion thread)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES hitl_approval_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  comment TEXT NOT NULL,
  
  -- Attachments
  attachments JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- HITL SLA METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_sla_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES hitl_queue_configs(id) ON DELETE CASCADE,
  
  metric_date DATE NOT NULL,
  
  -- Counts
  total_requests INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  expired_count INTEGER DEFAULT 0,
  escalated_count INTEGER DEFAULT 0,
  
  -- Timing (in minutes)
  avg_resolution_time INTEGER,
  p50_resolution_time INTEGER,
  p95_resolution_time INTEGER,
  max_resolution_time INTEGER,
  
  -- SLA compliance
  within_sla_count INTEGER DEFAULT 0,
  sla_breach_count INTEGER DEFAULT 0,
  
  CONSTRAINT unique_queue_date UNIQUE (queue_id, metric_date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_hitl_queues_tenant ON hitl_queue_configs(tenant_id);
CREATE INDEX idx_hitl_queues_active ON hitl_queue_configs(is_active) WHERE is_active;

CREATE INDEX idx_hitl_requests_queue ON hitl_approval_requests(queue_id);
CREATE INDEX idx_hitl_requests_tenant ON hitl_approval_requests(tenant_id);
CREATE INDEX idx_hitl_requests_status ON hitl_approval_requests(status);
CREATE INDEX idx_hitl_requests_pending ON hitl_approval_requests(tenant_id, status, priority DESC) 
  WHERE status = 'pending';
CREATE INDEX idx_hitl_requests_expires ON hitl_approval_requests(expires_at) 
  WHERE status = 'pending';
CREATE INDEX idx_hitl_requests_agent ON hitl_approval_requests(agent_execution_id) 
  WHERE agent_execution_id IS NOT NULL;

CREATE INDEX idx_hitl_reviewers_queue ON hitl_reviewer_assignments(queue_id);
CREATE INDEX idx_hitl_reviewers_user ON hitl_reviewer_assignments(user_id);
CREATE INDEX idx_hitl_reviewers_active ON hitl_reviewer_assignments(is_active) WHERE is_active;

CREATE INDEX idx_hitl_comments_request ON hitl_request_comments(request_id);

CREATE INDEX idx_hitl_sla_queue_date ON hitl_sla_metrics(queue_id, metric_date);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE hitl_queue_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_reviewer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_sla_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY hitl_queues_isolation ON hitl_queue_configs FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY hitl_requests_isolation ON hitl_approval_requests FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY hitl_reviewers_isolation ON hitl_reviewer_assignments FOR ALL USING (
  queue_id IN (
    SELECT id FROM hitl_queue_configs 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

CREATE POLICY hitl_comments_isolation ON hitl_request_comments FOR ALL USING (
  request_id IN (
    SELECT id FROM hitl_approval_requests 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

CREATE POLICY hitl_sla_isolation ON hitl_sla_metrics FOR ALL USING (
  queue_id IN (
    SELECT id FROM hitl_queue_configs 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_hitl_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hitl_queue_updated_at
  BEFORE UPDATE ON hitl_queue_configs
  FOR EACH ROW EXECUTE FUNCTION update_hitl_queue_timestamp();

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_hitl_pending_by_queue AS
SELECT 
  q.id as queue_id,
  q.name as queue_name,
  q.tenant_id,
  COUNT(r.id) as pending_count,
  COUNT(CASE WHEN r.priority = 'critical' THEN 1 END) as critical_count,
  COUNT(CASE WHEN r.priority = 'high' THEN 1 END) as high_count,
  MIN(r.created_at) as oldest_request,
  MIN(r.expires_at) as next_expiry
FROM hitl_queue_configs q
LEFT JOIN hitl_approval_requests r ON r.queue_id = q.id AND r.status = 'pending'
WHERE q.is_active = true
GROUP BY q.id, q.name, q.tenant_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE hitl_queue_configs IS 'Configurable HITL approval queues with escalation rules';
COMMENT ON TABLE hitl_approval_requests IS 'Individual approval requests in the queue';
COMMENT ON TABLE hitl_reviewer_assignments IS 'User assignments to review queues with permissions';
COMMENT ON TABLE hitl_request_comments IS 'Discussion thread on approval requests';
COMMENT ON TABLE hitl_sla_metrics IS 'Daily SLA metrics per queue';
